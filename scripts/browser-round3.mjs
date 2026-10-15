import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5211'
const out = new URL('../tmp-smoke/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const clicks = []
function field(page, name) {
  return page.locator('.sheet label').filter({ hasText: name }).first().locator('input, textarea')
}
async function click(page, locator, label) {
  await locator.click()
  clicks.push(label)
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
try {
  await page.goto(`${base}/products/new`, { waitUntil: 'networkidle' })
  await click(page, page.locator('.panel .el-select').first(), '打开分类')
  await click(page, page.locator('.el-select-dropdown__item').filter({ hasText: /^\s*手机$/ }).first(), '选择手机')
  await click(page, page.getByRole('button', { name: '生成可建档规格' }), '生成可建档规格')
  await click(page, page.getByRole('button', { name: /Apple/ }).filter({ hasText: '128G' }).filter({ hasText: '黑色' }).first(), '选择黑色 128G')
  await click(page, page.getByRole('button', { name: '创建物料' }), '创建物料')
  await click(page, page.getByRole('button', { name: '确认创建' }), '确认创建')
  await page.getByText(/刚创建 MAT-/).waitFor()
  await click(page, page.getByRole('button', { name: '查看', exact: true }), '查看刚创建的物料')
  await click(page, page.getByRole('dialog', { name: '已有物料' }).getByRole('button', { name: '打开' }), '打开档案')
  await page.getByRole('heading', { name: 'Apple iPhone' }).waitFor()
  await page.getByText('系统物料编码').waitFor()
  const code = await field(page, '系统物料编码').inputValue()
  await field(page, '物料名称').fill('苹果 iPhone 128G 黑色 国行')
  clicks.push('修改物料名称')
  await field(page, '物料描述').fill('国行现货')
  clicks.push('填写描述')
  await field(page, '供应商编码').fill('SUP-1')
  clicks.push('填写供应商编码')
  await field(page, '管家婆编号').fill('GJP-9')
  clicks.push('填写管家婆编号')
  await click(page, page.getByRole('button', { name: '保存物料' }), '保存物料')
  await page.getByText('物料已保存').waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await field(page, '物料描述').waitFor()
  const description = await field(page, '物料描述').inputValue()
  const supplier = await field(page, '供应商编码').inputValue()
  const name = await field(page, '物料名称').inputValue()
  const codeAgain = await field(page, '系统物料编码').inputValue()
  if (description !== '国行现货' || supplier !== 'SUP-1' || name !== '苹果 iPhone 128G 黑色 国行' || codeAgain !== code) {
    throw new Error(`刷新后不一致 ${name} ${description} ${supplier} ${code} ${codeAgain}`)
  }
  await page.screenshot({ path: fileURLToPath(new URL('round3-archive.png', out)), fullPage: true })
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}'))
  const sku = (stored.data?.skus || []).find((item) => item.materialCode === code)
  if (!sku || sku.planningId == null || sku.modelVersionId == null || sku.guanjiapoCode !== 'GJP-9') throw new Error('存储里的档案不完整')
  if ((stored.data?.families || []).find((item) => item.id === 'f-iphone')?.line) throw new Error('旧商品被改线')
  console.log(JSON.stringify({ ok: true, clicks: clicks.length, steps: clicks, code, description, supplier }, null, 2))
} finally {
  await browser.close()
}
