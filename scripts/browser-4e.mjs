import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

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

try {
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.locator('[data-category-trigger]').click()
  await page.locator('[data-category-tree]').waitFor()
  const beforeSelect = await names()
  await page.locator('[data-expand-id="c-host"]').click()
  if ((await names()).join() !== beforeSelect.join()) throw new Error('点展开箭头改变了筛选')
  await page.locator('[data-category-id="c-phone"]').click()
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  if ((await names()).some((item) => item.includes('Watch') || item.includes('MacBook'))) throw new Error('选中手机后仍有其他分类商品')
  await page.getByRole('button', { name: '全部分类' }).click()
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()

  await page.getByRole('button', { name: '停靠左侧' }).click()
  await page.locator('[data-category-side]').waitFor()
  await page.locator('[data-category-layout="sidebar"]').waitFor()
  await page.locator('[data-category-side] [data-expand-id="c-host"]').click()
  await page.locator('[data-category-side] [data-category-id="c-watch"]').click()
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()
  if ((await names()).some((item) => item.includes('iPhone'))) throw new Error('左侧选手表后仍有手机')
  await page.locator('[data-category-side]').getByRole('button', { name: '收起' }).click()
  await page.locator('[data-category-chip]').waitFor()
  if ((await names()).some((item) => item.includes('iPhone'))) throw new Error('收起分类树把筛选清掉了')
  await page.getByRole('button', { name: '展开分类树' }).click()
  await page.locator('[data-category-tree]').waitFor()
  await page.getByRole('button', { name: '停靠左侧' }).click()
  await page.getByRole('button', { name: '回到顶部' }).click()
  await page.locator('[data-category-layout="popover"]').waitFor()

  await page.getByRole('button', { name: '新建视图' }).click()
  await page.getByPlaceholder('视图名称').fill('分类甲')
  await page.getByRole('button', { name: '创建' }).click()
  await page.locator('[data-category-trigger]').click()
  await page.locator('[data-expand-id="c-host"]').click()
  await page.locator('[data-category-id="c-phone"]').click()
  await page.getByRole('button', { name: '停靠左侧' }).click()
  await page.getByRole('button', { name: '新建视图' }).click()
  await page.getByPlaceholder('视图名称').fill('分类乙')
  await page.getByRole('button', { name: '创建' }).click()
  await page.locator('[data-category-side] [data-expand-id="c-host"]').click()
  await page.locator('[data-category-side] [data-category-id="c-watch"]').click()
  await page.locator('[data-category-side]').getByRole('button', { name: '回到顶部' }).click()
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: '分类甲' }).click()
  await page.locator('[data-category-layout="sidebar"]').waitFor()
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.view-current', { hasText: '分类甲' }).waitFor()
  await page.locator('[data-category-layout="sidebar"]').waitFor()
  const business = await pack()

  await page.locator('[data-filter-count]').click()
  await page.locator('[data-condition="category"]').waitFor()
  await page.locator('.el-dialog__headerbtn').last().click()
  await page.locator('[data-category-side]').getByRole('button', { name: '全部分类' }).click()
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()

  await page.getByRole('button', { name: /排序/ }).click()
  await page.getByText('手工排序', { exact: true }).click()
  await page.locator('[data-category-side] [data-expand-id="c-host"]').click()
  await page.locator('[data-category-side] [data-category-id="c-phone"]').click()
  await page.locator('[data-drag-id]').first().waitFor()
  const one = await names()
  await page.locator('[data-drag-id]').first().dragTo(page.locator('[data-drag-id]').first())
  await page.locator('[data-category-side]').getByRole('button', { name: '全部分类' }).click()
  const allNames = await names()
  if (allNames.length < one.length) throw new Error('清除分类后记录变少了')

  await page.locator('[data-pick-id]').first().click()
  await page.getByRole('button', { name: '加入排序暂存区' }).click()
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: '分类乙' }).click()
  await page.getByRole('button', { name: '取消' }).click()
  await page.locator('.view-current', { hasText: '分类甲' }).waitFor()
  await page.getByText('排序暂存区（1）').waitFor()
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: '分类乙' }).click()
  await page.getByRole('button', { name: '确定' }).click()
  if (await page.getByText('排序暂存区（1）').count()) throw new Error('确认切换后暂存还在')

  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    const families = raw.data.families
    for (let index = 0; index < 280; index += 1) {
      families.push({ id: `bulk-${String(index).padStart(3, '0')}`, name: `批量商品${String(index).padStart(3, '0')}`, templateId: 't-phone', categoryId: 'c-phone', oaProductId: '', commonAttrs: { 品牌: 'Apple' }, productGroupIds: [], lifecycle: 'draft', shelfStatus: 'draft', origin: 'created', createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' })
    }
    raw.data.listQuery.pageSize = 20
    raw.data.listQuery.page = 1
    const view = raw.data.productListViews.find((item) => item.name === '分类乙')
    if (view) {
      view.mode = 'spu'
      view.spuQuery.filters = []
      view.spuQuery.keyword = ''
      view.spuQuery.sortMode = 'manual'
      view.spuQuery.grouping = null
      view.manualOrder = view.manualOrder || { spuIds: [], skuIds: [] }
      view.manualOrder.spuIds = families.map((item) => item.id)
    }
    raw.data.activeProductListViewId = view?.id
    raw.data.productListMode = 'spu'
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  const baseline = await pack()
  const totalBefore = await page.locator('[data-result-count]').innerText()
  await page.locator('[data-pick-id]').nth(0).click()
  await page.locator('[data-pick-id]').nth(1).click()
  await page.getByRole('button', { name: '加入排序暂存区' }).click()
  for (let index = 0; index < 13; index += 1) await page.locator('.el-pagination .btn-next').click()
  await page.locator('.el-pagination .is-active', { hasText: '14' }).waitFor()
  await page.locator('[data-pick-id]').first().waitFor()
  const target = (await names())[0]
  await page.getByRole('button', { name: '插到前面' }).first().click()
  await page.getByRole('button', { name: '确定' }).click()
  await page.getByText('展示顺序已更新').waitFor()
  const totalAfter = await page.locator('[data-result-count]').innerText()
  if (totalBefore !== totalAfter) throw new Error(`跨页插入后数量变了 ${totalBefore} / ${totalAfter}`)
  const after = await pack()
  if (baseline !== after) throw new Error('跨页插入改了商品 id 集合')

  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, target, totalAfter }))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
