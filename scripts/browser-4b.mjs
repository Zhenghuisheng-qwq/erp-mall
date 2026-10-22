import { chromium } from 'playwright-core'
import { createView, openTools, waitUiSettled } from './browser-ui.mjs'

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5190'
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

await page.addInitScript(() => {
  window.__pack = (data) => JSON.stringify({
    families: data.families.map((item) => ({ id: item.id, name: item.name, line: item.line || '' })),
    skus: data.skus.map((item) => ({ id: item.id, familyId: item.familyId, code: item.code || '', materialCode: item.materialCode || '', planningId: item.planningId || '' })),
    plans: (data.planningRecords || []).map((item) => item.planningId),
    receipts: (data.materialReceipts || []).map((item) => `${item.skuId}:${item.materialCode}`),
  })
})

async function pack() {
  return page.evaluate(() => window.__pack(JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}').data))
}

async function headers() {
  const cells = page.locator('.el-table__header-wrapper th .cell')
  return (await cells.allInnerTexts()).map((item) => item.trim()).filter(Boolean)
}

async function chooseView(name) {
  await waitUiSettled(page)
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: new RegExp(`^${name}$`) }).click()
  await page.locator('.view-current', { hasText: name }).waitFor()
}

try {
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.locator('.view-current', { hasText: '默认视图' }).waitFor()
  if ((await page.locator('.list-switch').getAttribute('data-mode')) !== 'spu') throw new Error('默认视图不是 SPU')

  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '新建视图', exact: true }).click()
  await page.getByRole('dialog', { name: '新建视图' }).getByPlaceholder('视图名称').fill('商品总览')
  await page.getByRole('dialog', { name: '新建视图' }).getByRole('button', { name: '创建', exact: true }).click()
  await page.locator('.view-current', { hasText: '商品总览' }).waitFor()
  await waitUiSettled(page)
  const overviewId = await page.locator('.list-switch').getAttribute('data-view-id')

  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '新建视图', exact: true }).click()
  await page.getByRole('dialog', { name: '新建视图' }).getByPlaceholder('视图名称').fill('SKU 明细')
  await page.getByRole('dialog', { name: '新建视图' }).getByRole('button', { name: '创建', exact: true }).click()
  await page.locator('.view-current', { hasText: 'SKU 明细' }).waitFor()
  await waitUiSettled(page)
  const before = await pack()

  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '新建视图', exact: true }).click()
  const createDialog = page.getByRole('dialog', { name: '新建视图' })
  await createDialog.getByPlaceholder('视图名称').fill('SKU 明细')
  await createDialog.getByRole('button', { name: '创建', exact: true }).click()
  await page.getByText('已经有同名视图。').waitFor()
  await createDialog.getByPlaceholder('视图名称').fill('   ')
  await createDialog.getByRole('button', { name: '创建', exact: true }).click()
  await page.getByText('请填写视图名称。').waitFor()
  await createDialog.getByRole('button', { name: '取消', exact: true }).click()
  await waitUiSettled(page)

  await chooseView('商品总览')
  await page.locator('.list-switch[data-mode="spu"]').waitFor()
  await openTools(page)
  await page.locator('[data-column-key="brand"]').waitFor()
  await page.locator('[data-column-key="brand"] .el-checkbox').click()
  await page.waitForFunction(() => ![...document.querySelectorAll('.spu-table .el-table__header-wrapper th .cell')].some((item) => item.textContent.trim() === '品牌'))
  await page.locator('[data-column-key="brand"] .el-checkbox').click()
  await page.waitForFunction(() => [...document.querySelectorAll('.spu-table .el-table__header-wrapper th .cell')].some((item) => item.textContent.trim() === '品牌'))
  const orderBefore = await page.locator('[data-column-key]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-column-key')))
  await page.locator('[data-column-key="brand"]').dragTo(page.locator('[data-column-key="category"]'))
  const orderAfter = await page.locator('[data-column-key]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-column-key')))
  if (orderAfter.indexOf('brand') > orderAfter.indexOf('category') || orderAfter.join() === orderBefore.join()) {
    throw new Error(`拖动后顺序不对 ${orderAfter.join(',')}`)
  }
  await page.locator('[data-column-key="brand"] .el-checkbox').click()
  await page.locator('[data-column-key="brand"] .el-checkbox').click()
  const orderKept = await page.locator('[data-column-key]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-column-key')))
  if (orderKept.join() !== orderAfter.join()) throw new Error('隐藏后再显示，顺序变了')
  const spuHeaders = await headers()
  if (spuHeaders.indexOf('品牌') > spuHeaders.indexOf('商品分类') || !spuHeaders.includes('SKU 数量')) {
    throw new Error('表头没有跟上列设置：' + spuHeaders.join('|'))
  }

  await chooseView('SKU 明细')
  await page.getByRole('button', { name: 'SKU 管理', exact: true }).click()
  await page.waitForURL('**/skus')
  await page.locator('[data-sku-workbench]').waitFor()
  await createView(page, 'SKU 明细')
  await page.locator('.list-switch[data-mode="sku"]').waitFor()
  const skuHeaders = await headers()
  if (!skuHeaders.includes('SKU 编号') || !skuHeaders.includes('完整规格') || skuHeaders.includes('SKU 数量') || skuHeaders.includes('规格数')) {
    throw new Error('SKU 列不对：' + skuHeaders.join('|'))
  }
  const skuIds = await page.locator('.sku-table [data-sku-id]').allInnerTexts()
  if (skuIds.length !== 10 || skuIds.some((item) => item.startsWith('MAT-'))) throw new Error('SKU 行不对：' + skuIds.join())
  const overviewStill = await page.evaluate((id) => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    return raw.data.productListPages.spu.views.find((item) => item.id === id)?.mode
  }, overviewId)
  if (overviewStill !== 'spu') throw new Error('改 SKU 明细时把商品总览也改了')

  await page.getByRole('button', { name: 'SPU 管理', exact: true }).click()
  await chooseView('商品总览')
  await page.locator('.list-switch[data-mode="spu"]').waitFor()
  const restored = await headers()
  if (restored.indexOf('品牌') > restored.indexOf('商品分类')) throw new Error('切回后列顺序丢失：' + restored.join('|'))

  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.view-current', { hasText: '商品总览' }).waitFor()
  if ((await page.locator('.list-switch').getAttribute('data-view-id')) !== overviewId) throw new Error('刷新后视图变了')
  if ((await page.locator('.list-switch').getAttribute('data-mode')) !== 'spu') throw new Error('刷新后模式变了')
  const refreshed = await headers()
  if (refreshed.indexOf('品牌') > refreshed.indexOf('商品分类') || !refreshed.includes('品牌')) throw new Error('刷新后列不对：' + refreshed.join('|'))

  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '视图设置', exact: true }).click()
  await page.getByPlaceholder('视图名称').fill('商品总览改')
  await page.getByRole('button', { name: '保存名称' }).click()
  await page.locator('.view-current', { hasText: '商品总览改' }).waitFor()
  if ((await page.locator('.list-switch').getAttribute('data-view-id')) !== overviewId) throw new Error('重命名后编号变了')
  await page.locator('.el-dialog').getByRole('button', { name: '复制' }).click()
  await page.locator('.view-current', { hasText: '商品总览改 副本' }).waitFor()
  const copyId = await page.locator('.list-switch').getAttribute('data-view-id')
  if (copyId === overviewId) throw new Error('复制没有使用新编号')
  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '视图设置', exact: true }).click()
  await page.locator('.el-dialog').getByRole('button', { name: '删除' }).click()
  await page.getByRole('button', { name: '确定' }).click()
  await page.locator('.view-current', { hasText: '默认视图' }).waitFor()
  await waitUiSettled(page)
  await page.locator('.view-current').click()
  await page.locator('[data-saved-view]').filter({ hasText: '商品总览改' }).waitFor()
  await page.keyboard.press('Escape')

  await openTools(page)
  await page.locator('.view-tools').getByRole('button', { name: '视图设置', exact: true }).click()
  const deleteDefault = page.locator('.el-dialog').getByRole('button', { name: '删除' })
  if (await deleteDefault.isEnabled()) throw new Error('默认视图可以被删除')
  await page.keyboard.press('Escape')

  const after = await pack()
  if (before !== after) throw new Error('视图操作改变了商品数据')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, overviewId, copyId, spuHeaders, skuHeaders, refreshed }))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
