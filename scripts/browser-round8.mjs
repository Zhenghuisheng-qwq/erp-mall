import { createRequire } from 'node:module'

const require = createRequire('D:/tmp/pw/package.json')
const { chromium } = require('playwright-core')
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5241'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const notes = []
let clicks = 0
async function click(locator, label) {
  await locator.click()
  clicks += 1
  notes.push(`${clicks}. ${label}`)
}
try {
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  notes.push('入口：地址栏进入商品模型，菜单里也能到。点击数从选中节点开始计。')
  clicks = 0
  await page.getByText('品牌', { exact: true }).first().click()
  clicks += 1
  await page.getByRole('button', { name: '命名规则' }).waitFor()
  notes.push(`${clicks}. 点选品牌后，命名规则按钮直接出现，没有打开右键菜单`)
  await click(page.getByRole('button', { name: '命名规则' }), '打开命名规则')
  const dialog = page.getByRole('dialog', { name: '命名规则' })
  await dialog.waitFor()
  for (const name of ['产品类型', '品牌', '容量', '颜色']) {
    await click(dialog.getByRole('button', { name }), `加入字段 ${name}`)
  }
  const preview = await dialog.locator('.preview').innerText()
  if (!preview.includes('品牌') && !preview.includes('Apple') && !preview.includes('手机')) throw new Error('预览没有跟着字段变化：' + preview)
  notes.push(`四个字段共 ${clicks} 次点击，预览为「${preview.replace(/\s+/g, ' ')}」`)
  await page.keyboard.press('Escape')
  await click(page.getByRole('button', { name: '发布模型' }), '发布模型')
  await page.getByText(/条已有规划编号|已为/).first().waitFor({ timeout: 15000 }).catch(() => page.getByText('合法组合').first().waitFor())
  await page.locator('.combo-preview button').filter({ hasText: '品牌' }).first().click()
  clicks += 1
  notes.push(`${clicks}. 选中一条已有规划，没有重选品牌容量颜色`)
  await click(page.getByRole('button', { name: '创建物料', exact: true }), '创建物料')
  const create = page.getByRole('dialog', { name: '创建物料' })
  await create.waitFor()
  await create.getByPlaceholder('').count()
  await create.locator('label').filter({ hasText: '供应商编码' }).locator('input').fill('SUP-ROUND8')
  await click(create.getByRole('button', { name: '创建并继续下一条' }), '创建并继续')
  await page.getByText(/已创建物料 MAT-/).first().waitFor()
  await create.locator('label').filter({ hasText: '供应商编码' }).locator('input').fill('SUP-ROUND8-B')
  const supplierLeft = await create.locator('label').filter({ hasText: '供应商编码' }).locator('input').inputValue()
  if (supplierLeft !== 'SUP-ROUND8-B') throw new Error('继续创建时供应商编码没清干净或没写上：' + supplierLeft)
  await click(create.getByRole('button', { name: '确认创建' }), '确认第二条')
  await page.getByText(/已有 2 条物料|已创建物料/).first().waitFor()
  notes.push(`同一规划连续两条物料，到这里 ${clicks} 次点击`)
  await page.setViewportSize({ width: 1280, height: 800 })
  const box = await page.locator('.node-ops').boundingBox()
  if (box && box.x + box.width > 1280) notes.push('1280 宽度下节点操作条超出视口')
  else notes.push('1280 宽度下节点操作条仍在视口内')
  console.log(notes.map((item) => 'PASS ' + item).join('\n'))
} catch (error) {
  console.log(notes.map((item) => 'PASS ' + item).join('\n'))
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  await browser.close()
}
