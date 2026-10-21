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
  await page.getByRole('button', { name: '排序', exact: true }).click()
  await page.getByText('手工排序', { exact: true }).click()
  await page.locator('[data-drag-id]').first().waitFor()
  const beforeDrag = await names()
  const handles = page.locator('[data-drag-id]')
  await handles.nth(0).dragTo(handles.nth(2))
  const afterDrag = await names()
  if (afterDrag.join('|') === beforeDrag.join('|')) throw new Error('拖拽后顺序没变：' + afterDrag.join('|'))
  await page.reload({ waitUntil: 'networkidle' })
  const refreshed = await names()
  if (refreshed.join('|') !== afterDrag.join('|')) throw new Error(`刷新后顺序变了 ${refreshed.join('|')}`)
  const business = await pack()

  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    raw.data.listQuery.pageSize = 2
    raw.data.listQuery.page = 1
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  const pageOne = await page.locator('[data-pick-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-pick-id')))
  await page.locator('[data-pick-id]').nth(0).click()
  await page.locator('[data-pick-id]').nth(1).click()
  await page.getByRole('button', { name: '加入排序暂存区' }).click()
  await page.locator('.el-pagination .btn-next').click()
  await page.locator('[data-pick-id]').first().waitFor()
  await page.locator('[data-pick-id]').nth(0).click()
  await page.locator('[data-pick-id]').nth(1).click()
  await page.getByRole('button', { name: '加入排序暂存区' }).click()
  await page.getByText('排序暂存区（4）').waitFor()
  await page.locator('.el-pagination .btn-next').click()
  await page.locator('.spu-table').first().waitFor()
  const target = (await names())[0]
  await page.getByRole('button', { name: '插到前面' }).first().click()
  await page.getByRole('button', { name: '确定' }).click()
  await page.getByText('展示顺序已更新').waitFor()
  if (await page.getByText('排序暂存区（4）').count()) throw new Error('确认后暂存区没有清空')
  const totalText = await page.locator('[data-result-count]').innerText()
  await page.reload({ waitUntil: 'networkidle' })
  if (!(await page.locator('button', { hasText: '手工排序' }).count()) && !(await page.getByRole('button', { name: /手工排序/ }).count())) {
    throw new Error('刷新后不是手工排序')
  }
  if ((await pack()) !== business) throw new Error('插入改变了业务数据')

  await page.getByRole('button', { name: '新建视图' }).click()
  await page.getByPlaceholder('视图名称').fill('字段视图')
  await page.getByRole('button', { name: '创建' }).click()
  await page.getByRole('button', { name: /排序/ }).click()
  await page.getByText('按字段排序', { exact: true }).click()
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: '默认视图' }).click()
  if (await page.getByText('清空暂存').count()) await page.getByRole('button', { name: '确定' }).click()
  await page.getByRole('button', { name: /手工排序/ }).waitFor()
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: '字段视图' }).click()
  if (await page.getByText('清空暂存').count()) await page.getByRole('button', { name: '确定' }).click()
  await page.getByRole('button', { name: '排序：按字段' }).waitFor()

  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: '默认视图' }).click()
  await page.locator('[data-exposed="category"]').click()
  await page.getByRole('option', { name: '主机 / 手机', exact: true }).click()
  await page.keyboard.press('Escape')
  const filtered = await names()
  if (!filtered.some((item) => item.includes('iPhone')) || filtered.some((item) => item.includes('MacBook'))) throw new Error('分类筛选不对：' + filtered.join('|'))
  await page.getByRole('button', { name: '保存当前筛选' }).click()
  await page.locator('[data-exposed="category"] .el-tag__close').click()
  await page.getByText('筛选1').click()
  await page.locator('.spu-table .linkish', { hasText: 'iPhone' }).waitFor()
  if ((await names()).some((item) => item.includes('MacBook'))) throw new Error('重新应用筛选后分类条件丢了')
  await page.getByRole('button', { name: /手工排序/ }).waitFor()

  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, before: beforeDrag[0], after: afterDrag[0], stagedFrom: pageOne, target, totalText }))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
