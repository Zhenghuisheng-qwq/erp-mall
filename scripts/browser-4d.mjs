import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { chooseView, closeTools, createView, openTools } from './browser-ui.mjs'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5190'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
await page.addInitScript(() => {
  window.__pack = (data) => JSON.stringify({
    families: data.families.map((item) => item.id),
    skus: data.skus.map((item) => `${item.id}:${item.materialCode || ''}:${item.planningId || ''}`),
    plans: (data.planningRecords || []).map((item) => item.planningId),
  })
})

async function names() {
  return page.locator('.spu-table .linkish').allInnerTexts()
}
async function pack() {
  return page.evaluate(() => window.__pack(JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}').data))
}
async function totalNumber() {
  const text = await page.locator('[data-result-count]').innerText()
  return Number((text.match(/\d+/) || ['0'])[0])
}
async function orderState() {
  return page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    const view = (raw.data.productListViews || []).find((item) => item.id === raw.data.activeProductListViewId)
    return view?.manualOrder?.spuIds || []
  })
}
async function goToPage(target) {
  for (let guard = 0; guard < 40; guard += 1) {
    const current = Number(await page.locator('.el-pagination .is-active').innerText())
    if (current === target) return
    const forward = current < target
    const next = current + (forward ? 1 : -1)
    await page.locator(forward ? '.el-pagination .btn-next' : '.el-pagination .btn-prev').click()
    await page.waitForFunction((expected) => (document.querySelector('.el-pagination .is-active')?.textContent || '').trim() === String(expected), next)
  }
  throw new Error(`没有翻到第 ${target} 页`)
}
async function stageVisible(indexes) {
  const ids = []
  for (const index of indexes) {
    const box = page.locator('[data-pick-id]').nth(index)
    ids.push(await box.getAttribute('data-pick-id'))
    await box.click()
  }
  await page.getByRole('button', { name: '加入排序暂存区' }).click()
  return ids
}

try {
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.locator('[data-result-count]').waitFor()
  await page.getByPlaceholder('名称、分类、属性、SKU、OA 编号').fill('4d')
  await page.waitForFunction(() => Array.isArray(JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}').data?.families))
  const beforeTotal = await page.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.families.length)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    const families = raw.data.families
    for (let index = 0; index < 280; index += 1) {
      const id = `bulk-${String(index).padStart(3, '0')}`
      if (families.some((item) => item.id === id)) continue
      families.push({
        id,
        name: `批量商品${String(index).padStart(3, '0')}`,
        templateId: 't-phone',
        categoryId: 'c-phone',
        oaProductId: '',
        commonAttrs: { 品牌: 'Apple' },
        productGroupIds: [],
        lifecycle: 'draft',
        shelfStatus: 'draft',
        origin: 'created',
        createdAt: '2026-10-20T00:00:00.000Z',
        updatedAt: '2026-10-20T00:00:00.000Z',
      })
    }
    raw.data.listQuery.pageSize = 20
    raw.data.listQuery.page = 1
    const view = (raw.data.productListViews || []).find((item) => item.id === raw.data.activeProductListViewId) || raw.data.productListViews?.[0]
    if (view) {
      view.mode = 'spu'
      view.spuQuery.keyword = ''
      view.spuQuery.filters = []
      view.spuQuery.grouping = null
      view.spuQuery.sorting = null
      view.spuQuery.sortMode = 'default'
      view.manualOrder = { spuIds: [], skuIds: [] }
    }
    raw.data.productListMode = 'spu'
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  const prepared = await totalNumber()
  if (prepared !== beforeTotal + 280 || prepared <= 260) throw new Error(`跨页夹具数量不对：${beforeTotal} -> ${prepared}`)
  const business = await pack()

  await openTools(page)
  await page.locator('.view-tools .el-radio-button', { hasText: '手工排序' }).click()
  await closeTools(page)
  if (await page.locator('.view-tools').isVisible()) throw new Error('视图工具没有按空白处关闭')
  await page.locator('[data-drag-id]').first().waitFor()
  const beforeDrag = await names()
  const handles = page.locator('[data-drag-id]')
  await handles.nth(0).dragTo(handles.nth(2))
  const afterDrag = await names()
  if (afterDrag.join('|') === beforeDrag.join('|')) throw new Error('拖拽后顺序没变：' + afterDrag.join('|'))
  const dragged = await orderState()
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-sort-state]', { hasText: '手工排序' }).waitFor()
  if ((await names()).join('|') !== afterDrag.join('|')) throw new Error('刷新后拖拽顺序变了')
  if ((await orderState()).join('|') !== dragged.join('|')) throw new Error('刷新后手工顺序配置变了')

  const pageOne = await stageVisible([0, 1])
  await goToPage(2)
  await page.locator('[data-pick-id]').first().waitFor()
  const pageTwo = await stageVisible([0, 1])
  await page.getByText('排序暂存区（4）').waitFor()
  const staged = [...pageOne, ...pageTwo]
  await goToPage(14)
  await page.locator('[data-pick-id]').first().waitFor()
  const targetName = (await names())[0]
  const targetId = await page.locator('[data-pick-id]').first().getAttribute('data-pick-id')
  const totalBefore = await page.locator('[data-result-count]').innerText()
  await page.getByRole('button', { name: '插到前面' }).first().click()
  await page.getByRole('button', { name: '确定' }).click()
  await page.getByText('展示顺序已更新').waitFor()
  if (await page.getByText('排序暂存区（4）').count()) throw new Error('确认后暂存区没有清空')
  const totalAfter = await page.locator('[data-result-count]').innerText()
  if (totalBefore !== totalAfter) throw new Error(`跨页插入后数量变了 ${totalBefore} / ${totalAfter}`)
  const inserted = await orderState()
  const at = inserted.indexOf(targetId)
  if (at < staged.length || inserted.slice(at - staged.length, at).join('|') !== staged.join('|')) {
    throw new Error(`没有插到目标前面 ${targetId} ${inserted.slice(Math.max(0, at - 4), at + 1).join('|')}`)
  }
  if (new Set(inserted).size !== inserted.length || inserted.length !== prepared) {
    throw new Error(`手工顺序出现重复或遗漏 ${inserted.length}/${new Set(inserted).size}/${prepared}`)
  }
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-sort-state]', { hasText: '手工排序' }).waitFor()
  if ((await orderState()).join('|') !== inserted.join('|')) throw new Error('刷新后跨页插入顺序变了')
  if ((await pack()) !== business) throw new Error('插入改变了业务数据')

  await goToPage(1)
  const moving = (await stageVisible([0]))[0]
  const afterTarget = await page.locator('[data-pick-id]').nth(2).getAttribute('data-pick-id')
  await page.locator('tr', { has: page.locator(`[data-pick-id="${afterTarget}"]`) }).getByRole('button', { name: '插到后面' }).click()
  await page.getByRole('button', { name: '确定' }).click()
  await page.getByText('展示顺序已更新').waitFor()
  const afterInsert = await orderState()
  if (afterInsert[afterInsert.indexOf(afterTarget) + 1] !== moving) throw new Error('没有插到目标后面')
  if (new Set(afterInsert).size !== afterInsert.length || afterInsert.length !== prepared) throw new Error('插到后面后记录重复或遗漏')
  const totalStill = await page.locator('[data-result-count]').innerText()
  if (totalStill !== totalAfter) throw new Error(`插到后面后数量变了 ${totalStill}`)

  await createView(page, '字段视图')
  await openTools(page)
  await page.locator('.view-tools .el-radio-button', { hasText: '按字段排序' }).click()
  await closeTools(page)
  await chooseView(page, '默认视图')
  await page.locator('[data-sort-state]', { hasText: '手工排序' }).waitFor()
  await stageVisible([0])
  await page.getByText('排序暂存区（1）').waitFor()
  await chooseView(page, '字段视图')
  await page.getByRole('dialog', { name: '清空暂存' }).getByRole('button', { name: '取消' }).click()
  await page.locator('.view-current', { hasText: '默认视图' }).waitFor()
  await page.getByText('排序暂存区（1）').waitFor()
  await chooseView(page, '字段视图')
  await page.getByRole('dialog', { name: '清空暂存' }).getByRole('button', { name: '确定' }).click()
  await page.locator('.view-current', { hasText: '字段视图' }).waitFor()
  await page.locator('[data-sort-state]', { hasText: '按字段' }).waitFor()
  if (await page.getByText('排序暂存区（1）').count()) throw new Error('确认切换后暂存还在')

  await chooseView(page, '默认视图')
  await page.locator('[data-sort-state]', { hasText: '手工排序' }).waitFor()
  await page.locator('[data-category-trigger]').click()
  await page.locator('[data-category-tree]').waitFor()
  if (!(await page.locator('[data-category-id="c-phone"]').count())) await page.locator('[data-expand-id="c-host"]').click()
  await page.locator('[data-category-id="c-phone"]').click()
  await page.getByRole('heading', { name: '商品列表' }).click()
  await page.locator('[data-category-tree]').waitFor({ state: 'hidden' })
  const filteredTotal = await totalNumber()
  const filtered = await names()
  if (filtered.some((item) => item.includes('MacBook') || item.includes('Watch'))) throw new Error('分类筛选不对：' + filtered.join('|'))
  if (!filteredTotal || filteredTotal >= prepared) throw new Error('分类筛选没有缩小结果：' + filteredTotal)
  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '保存当前筛选', exact: true }).click()
  await page.locator('.el-tag', { hasText: '筛选1' }).waitFor()
  await closeTools(page)
  await page.locator('[data-category-trigger]').click()
  await page.getByRole('button', { name: '全部分类' }).click()
  await page.getByRole('heading', { name: '商品列表' }).click()
  if ((await totalNumber()) !== prepared) throw new Error('清除分类后数量没有恢复')
  await page.locator('.el-tag', { hasText: '筛选1' }).click()
  if ((await totalNumber()) !== filteredTotal) throw new Error('重新应用筛选后分类条件丢了')
  await page.locator('[data-sort-state]', { hasText: '手工排序' }).waitFor()
  if ((await pack()) !== business) throw new Error('筛选和排序改变了业务数据')

  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, prepared, before: beforeDrag[0], after: afterDrag[0], staged, target: targetName, targetId, total: totalAfter, filteredTotal }))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
