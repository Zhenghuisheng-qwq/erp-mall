import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5211'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const clicks = []
async function click(locator, label) {
  await locator.click()
  clicks.push(label)
}
try {
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  await click(page.getByText('大纲视图', { exact: true }), '打开大纲')
  const brand = page.locator('input.line[value="品牌"]')
  await brand.waitFor()
  await brand.click({ button: 'right' })
  clicks.push('右键品牌')
  await click(page.getByRole('button', { name: '命名规则' }), '打开命名规则')
  await page.getByRole('dialog', { name: '命名规则' }).waitFor()
  const dialog = page.getByRole('dialog', { name: '命名规则' })
  async function addField(label) {
    await dialog.locator('.el-select').first().click()
    clicks.push('打开字段列表')
    await page.getByRole('option', { name: label, exact: true }).click()
    clicks.push(`选择${label}`)
    await dialog.getByRole('button', { name: '加入', exact: true }).click()
    clicks.push(`加入${label}`)
  }
  await addField('产品类型')
  await addField('品牌')
  await addField('容量')
  await addField('颜色')
  const preview = (await page.locator('.preview').innerText()).trim()
  if (!preview.includes('手机') || preview.includes('undefined') || preview.includes('  ')) {
    throw new Error('预览不对：' + preview)
  }
  await click(page.getByRole('button', { name: '保存规则' }), '保存规则')
  await click(page.getByRole('button', { name: '发布模型' }), '发布模型')
  await page.getByText(/已发布 V/).waitFor()
  await page.getByRole('button', { name: /128G/ }).filter({ hasText: '黑色' }).filter({ hasText: 'Apple' }).first().click()
  clicks.push('选择黑色规格')
  await click(page.getByRole('button', { name: '创建物料' }), '创建物料')
  const createDialog = page.getByRole('dialog', { name: '创建物料' })
  await createDialog.waitFor()
  const name = await createDialog.locator('input').last().inputValue()
  if (!name.includes('手机') || !name.includes('Apple') || name.includes('undefined')) throw new Error(`建档名称 ${name} 预览 ${preview}`)
  const planBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.planningRecords.length)
  await click(createDialog.getByRole('button', { name: '确认创建' }), '确认创建')
  await page.getByText(/已创建物料 MAT-/).waitFor()
  const planAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.planningRecords.length)
  if (planAfter !== planBefore) throw new Error('创建物料改变了规划编号数量')
  console.log(JSON.stringify({ ok: true, clicks: clicks.length, preview, name }, null, 2))
} finally {
  await browser.close()
}
