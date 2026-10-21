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
    families: data.families.map((item) => ({ id: item.id, name: item.name, line: item.line || '' })),
    skus: data.skus.map((item) => ({ id: item.id, familyId: item.familyId, materialCode: item.materialCode || '', planningId: item.planningId || '' })),
    plans: (data.planningRecords || []).map((item) => item.planningId),
    receipts: (data.materialReceipts || []).map((item) => item.materialCode),
  })
})

async function pack() {
  return page.evaluate(() => window.__pack(JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}').data))
}
async function names() {
  return page.locator('.spu-table .linkish, .sku-table .linkish').allInnerTexts()
}
async function choose(name) {
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: name }).click()
}
async function closeDialog() {
  await page.locator('.el-dialog__headerbtn').last().click()
}
async function pick(label, option) {
  await page.getByText(label, { exact: true }).last().click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await page.locator('.el-select__popper').last().waitFor({ state: 'hidden' }).catch(() => undefined)
}

try {
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '新建视图' }).click()
  await page.getByPlaceholder('视图名称').fill('视图甲')
  await page.getByRole('button', { name: '创建' }).click()
  await page.locator('.view-current', { hasText: '视图甲' }).waitFor()
  await page.getByRole('button', { name: '新建视图' }).click()
  await page.getByPlaceholder('视图名称').fill('视图乙')
  await page.getByRole('button', { name: '创建' }).click()
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    raw.data.families.unshift({ id: 'fam-4c', name: '4C物料款', templateId: 't-phone', productModelId: 't-phone', modelVersionId: 'phone-model-v1', productTypeId: 'pt-phone', line: 'v3', categoryId: 'c-phone', oaProductId: '', commonAttrs: { 品牌: 'Apple' }, productGroupIds: [], lifecycle: 'draft', shelfStatus: 'draft', origin: 'created', createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' })
    raw.data.skus.push({ id: 'mat-4c', familyId: 'fam-4c', code: '', oaSkuId: '', status: 'draft', variantAttrs: { 颜色: '蓝色' }, projectedAttrs: { 颜色: '蓝色' }, skuName: '物料甲', planningId: 'PLN-4C', materialCode: 'MAT-4C' })
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  const before = await pack()

  await choose('视图甲')
  await page.locator('[data-exposed="brand"]').click()
  await page.getByRole('option', { name: 'Apple', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.locator('.spu-table').first().waitFor()
  const appleNames = await names()
  if (appleNames.some((item) => item.includes('都市款'))) throw new Error('品牌筛选没有排除无品牌商品：' + appleNames.join('|'))
  if (!appleNames.some((item) => item.includes('Apple iPhone 17'))) throw new Error('Apple 商品丢了')

  await choose('视图乙')
  await page.getByText('都市款').first().waitFor()
  await choose('视图甲')
  if ((await names()).some((item) => item.includes('都市款'))) throw new Error('切回视图甲后品牌条件丢了')

  await page.locator('[data-filter-count]').click()
  await page.getByRole('button', { name: '添加条件' }).click()
  const rows = page.locator('.filter-row')
  await rows.last().locator('.el-select').nth(0).click()
  await page.getByRole('option', { name: '商品状态', exact: true }).click()
  await rows.last().locator('.el-select').nth(2).click()
  await page.getByRole('option', { name: '已发布', exact: true }).click()
  await page.keyboard.press('Escape')
  await closeDialog()
  if ((await page.locator('[data-result-count]').innerText()).includes('0')) throw new Error('已发布的 Apple 商品被滤空了')
  await page.locator('[data-filter-count]').click()
  await rows.last().locator('.el-select').nth(2).click()
  await page.getByRole('option', { name: '已下架', exact: true }).click()
  await page.keyboard.press('Escape')
  await closeDialog()
  await page.locator('[data-empty="spu"]').waitFor()
  await page.locator('[data-filter-count]').click()
  await page.locator('.filter-row', { hasText: '商品状态' }).getByRole('button', { name: '删除' }).click()
  await closeDialog()
  await page.locator('.spu-table .linkish', { hasText: 'Apple iPhone 17' }).waitFor()

  await page.locator('[data-filter-count]').click()
  await page.locator('[data-expose-field="brand"]').click()
  await closeDialog()
  if (await page.locator('[data-exposed="brand"]').count()) throw new Error('取消外露后品牌控件还在')
  if (!(await page.locator('[data-filter-count]').innerText()).match(/[1-9]/)) throw new Error('隐藏外露后筛选数量丢了')
  await page.locator('[data-filter-count]').click()
  await page.locator('[data-expose-field="brand"]').click()
  await closeDialog()
  await page.locator('[data-exposed="brand"]').waitFor()

  await page.getByRole('button', { name: '分组', exact: true }).click()
  await pick('分组字段', '商品分类')
  await page.locator('[data-group-key]').first().waitFor()
  const groupText = await page.locator('[data-group-key]').allInnerTexts()
  if (!groupText.some((item) => item.includes('手机') && item.includes('（'))) throw new Error('分组标题不对：' + groupText.join('|'))
  await page.locator('[data-group-key]').first().click()
  await page.locator('[data-group-key]', { hasText: '展开' }).first().waitFor()
  await page.getByRole('button', { name: '分组', exact: true }).click()
  await page.getByRole('button', { name: '清除分组' }).click()
  if (await page.locator('[data-group-key]').count()) throw new Error('分组没有清除')

  await page.getByRole('button', { name: '排序', exact: true }).click()
  await pick('排序字段', '商品名称')
  const asc = (await names())[0]
  await page.getByRole('button', { name: '排序', exact: true }).click()
  await page.getByText('降序', { exact: true }).last().click()
  const desc = (await names())[0]
  if (!asc || asc === desc) throw new Error(`排序没有变化 ${asc} / ${desc}`)
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    raw.data.listQuery.pageSize = 2
    raw.data.listQuery.page = 1
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.el-pagination .btn-next').click()
  await page.locator('.spu-table .linkish').first().waitFor()
  if ((await page.locator('.el-pagination .is-active').innerText()) !== '2') throw new Error('没有翻到第 2 页')

  await page.getByText('SKU 视图', { exact: true }).click()
  await page.locator('.sku-table [data-sku-id]').first().waitFor()
  const skuText = await page.locator('.sku-table').innerText()
  if (skuText.includes('MAT-4C') || skuText.includes('PLN-4C') || skuText.includes('物料甲')) throw new Error('SKU 视图混入了物料')
  await page.getByText('SPU 视图', { exact: true }).click()
  await page.getByRole('button', { name: '列设置' }).click()
  await page.locator('[data-column-key="brand"] .el-checkbox').click()
  await page.waitForFunction(() => ![...document.querySelectorAll('.spu-table .el-table__header-wrapper th .cell')].some((item) => item.textContent.trim() === '品牌'))
  await page.locator('[data-column-key="brand"] .el-checkbox').click()

  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.view-current', { hasText: '视图甲' }).waitFor()
  if ((await page.locator('.list-switch').getAttribute('data-mode')) !== 'spu') throw new Error('刷新后模式丢了')
  if ((await names()).some((item) => item.includes('都市款'))) throw new Error('刷新后品牌筛选丢了')

  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    raw.data.listQuery.pageSize = 20
    raw.data.listQuery.page = 1
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.spu-table tr.el-table__row', { hasText: 'Apple iPhone 17' }).locator('.el-table__expand-icon').click()
  await page.locator('.sku-expand[data-family-id="f-iphone"]').waitFor()
  const expanded = await page.locator('.sku-expand[data-family-id="f-iphone"]').innerText()
  if (!expanded.includes('s-iphone-blue') || !expanded.includes('颜色 蓝色') || expanded.includes('MAT-4C')) throw new Error('展开明细不对：' + expanded)
  await page.locator('.spu-table .linkish', { hasText: 'Apple iPhone 17' }).click()
  await page.waitForURL('**/products/f-iphone')
  await page.getByRole('heading', { name: '基本信息' }).waitFor()
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.locator('.spu-table tr.el-table__row', { hasText: '4C物料款' }).getByRole('button', { name: '管理物料' }).click()
  await page.getByText('MAT-4C').first().waitFor()
  await page.goto(`${base}/products/new`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '新增商品' }).waitFor()
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  const keyword = page.getByPlaceholder('名称、分类、属性、SKU、OA 编号')
  await keyword.fill('蓝色')
  await keyword.press('Enter')
  await page.locator('.spu-table .linkish', { hasText: 'Apple iPhone 17' }).waitFor()
  if ((await names()).some((item) => item.includes('MacBook'))) throw new Error('关键字没有滤掉不相关商品')

  const after = await pack()
  if (before !== after) throw new Error('浏览之后业务数据变了')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, asc, desc, groups: groupText.length, apple: appleNames.length }))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
