import { chromium } from 'playwright-core'
import { chooseView, closeTools, createView, openTools, waitUiSettled } from './browser-ui.mjs'

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5190'
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
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
  return page.locator('.spu-table button[data-family-id]').allInnerTexts()
}
async function pack() {
  return page.evaluate(() => window.__pack(JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}').data))
}
async function openCategory() {
  if (await page.locator('[data-category-side]').count()) return
  await page.locator('[data-category-trigger]').click()
  await page.locator('[data-category-tree]').waitFor()
}
async function showCategory(id) {
  const node = page.locator(`[data-category-id="${id}"]`)
  if (await node.count()) return node.first()
  await page.locator('[data-expand-id="c-host"]').first().click()
  await node.first().waitFor()
  return node.first()
}

try {
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await openCategory()
  const beforeSelect = await names()
  await page.locator('[data-expand-id="c-host"]').click()
  if ((await names()).join() !== beforeSelect.join()) throw new Error('点展开箭头改变了筛选')
  await page.locator('[data-category-id="c-host"]').click()
  if ((await names()).some((item) => item.includes('iPhone') || item.includes('Watch') || item.includes('MacBook'))) {
    throw new Error('父分类被当成包含子类')
  }
  await page.locator('[data-category-id="c-host"]').click()
  await page.locator('[data-category-id="c-phone"]').click()
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  if ((await names()).some((item) => item.includes('Watch') || item.includes('MacBook'))) throw new Error('选中手机后仍有其他分类商品')

  await page.getByRole('button', { name: '停靠左侧' }).click()
  await page.locator('[data-category-side]').waitFor()
  await page.locator('[data-category-layout="sidebar"]').waitFor()
  await page.locator('[data-category-side]').getByRole('button', { name: '收起' }).click()
  await page.locator('[data-category-chip]').waitFor()
  const chip = await page.locator('[data-category-chip]').innerText()
  if (!chip.includes('分类：手机')) throw new Error('收起后没有显示分类：手机：' + chip)
  if ((await names()).some((item) => item.includes('Watch') || item.includes('MacBook'))) throw new Error('收起分类树把筛选清掉了')
  await page.getByRole('button', { name: '清除分类' }).click()
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()
  await page.locator('.spu-table .linkish', { hasText: 'MacBook' }).waitFor()
  if (await page.locator('[data-category-chip]').count()) throw new Error('清除分类后提示还在')

  await page.getByRole('button', { name: '展开分类树' }).click()
  await page.locator('[data-category-tree]').waitFor()
  await page.getByRole('button', { name: '停靠左侧' }).click()
  await page.locator('[data-category-side] [data-expand-id="c-host"]').click()
  await page.locator('[data-category-side] [data-category-id="c-watch"]').click()
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()
  if ((await names()).some((item) => item.includes('iPhone'))) throw new Error('左侧选手表后仍有手机')
  await page.locator('[data-category-side]').getByRole('button', { name: '回到顶部' }).click()
  await page.locator('[data-category-layout="popover"]').waitFor()

  await createView(page, '分类甲')
  await openCategory()
  await page.getByRole('button', { name: '全部分类' }).first().click()
  await (await showCategory('c-phone')).click()
  await page.getByRole('button', { name: '停靠左侧' }).click()
  await page.locator('[data-category-layout="sidebar"]').waitFor()
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  await createView(page, '分类乙')
  await page.locator('[data-category-side]').getByRole('button', { name: '全部分类' }).click()
  await (await showCategory('c-watch')).click()
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()
  await page.locator('[data-category-side]').getByRole('button', { name: '回到顶部' }).click()
  await page.locator('[data-category-layout="popover"]').waitFor()
  await chooseView(page, '分类甲')
  await page.locator('[data-category-layout="sidebar"]').waitFor()
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  if ((await names()).some((item) => item.includes('Watch'))) throw new Error('分类甲串进了手表')
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.view-current', { hasText: '分类甲' }).waitFor()
  await page.locator('[data-category-layout="sidebar"]').waitFor()
  if ((await names()).some((item) => item.includes('Watch'))) throw new Error('刷新后分类甲条件丢了')
  const business = await pack()
  await chooseView(page, '分类乙')
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()
  if ((await names()).some((item) => item.includes('iPhone'))) throw new Error('刷新后切到分类乙仍有手机')
  await page.reload({ waitUntil: 'networkidle' })
  await chooseView(page, '分类甲')
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  if ((await names()).some((item) => item.includes('Watch'))) throw new Error('再次刷新切换后分类条件互相覆盖')

  await page.locator('[data-filter-count]').click()
  await page.locator('[data-condition="category"]').waitFor()
  await page.locator('.el-dialog__headerbtn').last().click()
  await waitUiSettled(page)
  await page.locator('[data-category-side]').getByRole('button', { name: '全部分类' }).click()
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()

  await openTools(page)
  await page.locator('.view-tools .el-radio-button', { hasText: '手工排序' }).click()
  await closeTools(page)
  await (await showCategory('c-phone')).click()
  await page.locator('[data-drag-id]').first().waitFor()
  const phoneOnly = await names()
  if (!phoneOnly.some((item) => item.includes('iPhone')) || phoneOnly.some((item) => item.includes('Watch') || item.includes('MacBook'))) {
    throw new Error('手工排序下分类筛选丢了：' + phoneOnly.join('|'))
  }
  await page.locator('[data-category-side]').getByRole('button', { name: '全部分类' }).click()
  const allNames = await names()
  if (allNames.length < phoneOnly.length) throw new Error('清除分类后记录变少了')

  await page.locator('[data-pick-id]').first().click()
  await page.getByRole('button', { name: '加入排序暂存区' }).click()
  await page.getByText('排序暂存区（1）').waitFor()
  await chooseView(page, '分类乙')
  await page.getByRole('dialog', { name: '清空暂存' }).getByRole('button', { name: '取消' }).click()
  await page.locator('.view-current', { hasText: '分类甲' }).waitFor()
  await page.getByText('排序暂存区（1）').waitFor()
  await chooseView(page, '分类乙')
  await page.getByRole('dialog', { name: '清空暂存' }).getByRole('button', { name: '确定' }).click()
  await page.locator('.view-current', { hasText: '分类乙' }).waitFor()
  if (await page.getByText('排序暂存区（1）').count()) throw new Error('确认切换后暂存还在')

  await chooseView(page, '分类甲')
  await openCategory()
  await page.getByRole('button', { name: '全部分类' }).first().click()
  await (await showCategory('c-phone')).click()
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '保存当前筛选', exact: true }).click()
  await page.locator('.el-tag', { hasText: '筛选1' }).waitFor()
  await closeTools(page)
  const clearAll = page.locator('[data-category-side]').getByRole('button', { name: '全部分类' })
  if (await clearAll.count()) await clearAll.click()
  else await page.getByRole('button', { name: '全部分类' }).click()
  await page.locator('.spu-table .linkish', { hasText: 'Watch' }).waitFor()
  await page.locator('.el-tag', { hasText: '筛选1' }).click()
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  if ((await names()).some((item) => item.includes('Watch') || item.includes('MacBook'))) throw new Error('旧筛选预设没有把分类树同步回来')
  await showCategory('c-phone')
  await page.locator('li.is-on [data-category-id="c-phone"]').waitFor()

  if ((await pack()) !== business) throw new Error('分类操作改了商品数据')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, chip: chip.replace(/\s+/g, ' '), phone: phoneOnly.length, restored: allNames.length }))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
