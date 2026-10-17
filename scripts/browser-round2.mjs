import { createRequire } from 'node:module'
import { assertDefaultPhone, defaultPhonePaths } from './phone-expect.mjs'
import { existsSync } from 'node:fs'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5193'
const out = new URL('../tmp-smoke/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const notes = []

function persona(name) {
  const clicks = []
  return {
    name,
    clicks,
    async click(page, locator, label) {
      await locator.click()
      clicks.push(label)
    },
  }
}

async function shot(page, name) {
  const file = new URL(name, out)
  await page.screenshot({ path: fileURLToPath(file), fullPage: true })
}

try {
  const employee = persona('新员工')
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await employee.click(page, page.getByRole('button', { name: '新增商品' }), '商品列表 → 新增商品')
  await page.getByRole('heading', { name: '新增商品' }).waitFor()
  await employee.click(page, page.locator('.panel .el-select').first(), '打开分类')
  await employee.click(page, page.locator('.el-select-dropdown__item').filter({ hasText: /^\s*手机$/ }).first(), '选择分类「手机」')
  await page.getByRole('main').getByText('产品类型').waitFor()
  await page.getByRole('main').getByText('商品模型').waitFor()
  await shot(page, 'employee-context.png')
  await page.getByRole('button', { name: /Apple/ }).filter({ hasText: '128G' }).filter({ hasText: '黑色' }).first().waitFor()
  const target = page.getByRole('button', { name: /Apple/ }).filter({ hasText: '128G' }).filter({ hasText: '黑色' }).first()
  await employee.click(page, target, '选择 Apple iPhone 128G 黑色')
  await employee.click(page, page.getByRole('button', { name: '创建物料' }), '创建物料')
  await page.getByRole('dialog', { name: '创建物料' }).waitFor()
  await shot(page, 'employee-dialog.png')
  const dialogText = await page.getByRole('dialog', { name: '创建物料' }).innerText()
  if (!dialogText.includes('不用再填') || dialogText.includes('选择容量') || dialogText.includes('选择颜色')) throw new Error('创建框仍在要求填规格：' + dialogText)
  await page.getByRole('dialog', { name: '创建物料' }).locator('button').first().focus()
  await page.keyboard.press('Tab')
  if (await page.getByRole('dialog', { name: /选择属性|新增属性/ }).count()) throw new Error('Tab 打开了属性弹窗')
  await employee.click(page, page.getByRole('button', { name: '确认创建' }), '确认创建')
  await page.getByText(/已创建物料 MAT-/).waitFor()
  await page.locator('p.meta').filter({ hasText: /已有 1 条物料 · MAT-/ }).waitFor()
  if (!page.url().includes('/products/new')) throw new Error('创建后离开了当前页')
  await shot(page, 'employee-done.png')
  notes.push({ persona: employee.name, clicks: employee.clicks, count: employee.clicks.length, url: page.url(), errors })

  const boss = persona('老板')
  const studioContext = await browser.newContext()
  const studio = await studioContext.newPage({ viewport: { width: 1440, height: 900 } })
  const bossErrors = []
  studio.on('pageerror', (error) => bossErrors.push(String(error)))
  await studio.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  await studio.locator('.combo-toggle').first().click()
  assertDefaultPhone(await studio.locator('section.insight').innerText())
  await boss.click(studio, studio.getByRole('button', { name: '发布模型' }), '发布模型')
  await studio.getByText(`${defaultPhonePaths.length} 条已有规划编号`).waitFor()
  await studio.getByText('结构视图', { exact: true }).waitFor()
  await boss.click(studio, studio.getByRole('button', { name: /128G/ }).filter({ hasText: '黑色' }).filter({ hasText: 'Apple' }).first(), '在模型里点选 128G 黑色')
  await shot(studio, 'boss-selected.png')
  await boss.click(studio, studio.getByRole('button', { name: '创建物料' }), '创建物料')
  const bossDialog = await studio.getByRole('dialog', { name: '创建物料' }).innerText()
  if (bossDialog.includes('选择容量')) throw new Error('模型入口仍要求重选规格')
  await boss.click(studio, studio.getByRole('button', { name: '确认创建' }), '确认创建')
  await studio.locator('p.meta').filter({ hasText: /已有 1 条物料 · MAT-/ }).waitFor()
  if (!studio.url().includes('/specs')) throw new Error('创建后离开了模型页')
  const operator = persona('熟练运营')
  await operator.click(studio, studio.getByRole('button', { name: '创建物料' }), '同一规格再创建')
  await operator.click(studio, studio.getByRole('button', { name: '确认创建' }), '确认第二条')
  await studio.locator('p.meta').filter({ hasText: /已有 2 条物料 · MAT-/ }).waitFor()
  await operator.click(studio, studio.getByRole('button', { name: '查看已有物料' }), '查看已有物料')
  await studio.getByRole('dialog', { name: '已有物料' }).waitFor()
  const listText = await studio.getByRole('dialog', { name: '已有物料' }).innerText()
  const codes = listText.match(/MAT-\d+/g) || []
  if (new Set(codes).size !== 2) throw new Error('同一规格没有两条独立物料：' + listText)
  await studio.keyboard.press('Escape')
  await operator.click(studio, studio.getByRole('button', { name: /256G/ }).filter({ hasText: '白色' }).filter({ hasText: 'Apple' }).first(), '换到 256G 白色')
  await operator.click(studio, studio.getByRole('button', { name: '创建物料' }), '新规格创建物料')
  await operator.click(studio, studio.getByRole('button', { name: '确认创建' }), '确认新规格')
  await studio.locator('p.meta').filter({ hasText: /已有 1 条物料 · MAT-/ }).waitFor()
  await studio.reload({ waitUntil: 'networkidle' })
  await studio.locator('.combo-toggle').first().click()
  await studio.getByRole('button', { name: /256G/ }).filter({ hasText: '白色' }).filter({ hasText: 'Apple' }).first().click()
  await studio.locator('p.meta').filter({ hasText: /已有 1 条物料 · MAT-/ }).waitFor()
  const temp = await studioContext.newPage({ viewport: { width: 1440, height: 900 } })
  await temp.goto(`${base}/products/new`, { waitUntil: 'networkidle' })
  await temp.locator('.panel .el-select').first().click()
  await temp.locator('.el-select-dropdown__item').filter({ hasText: '手表' }).first().click()
  await temp.getByRole('button', { name: '创建临时物料' }).click()
  const tempDialog = temp.getByRole('dialog', { name: '创建临时物料' })
  await tempDialog.waitFor()
  await tempDialog.getByRole('button', { name: '改为手工填写' }).first().click()
  await tempDialog.getByPlaceholder(/填写/).first().fill('临时经营值')
  await tempDialog.getByPlaceholder('例如 MAT-900001 或业务自己的编码').fill('WATCH-TMP-9001')
  await tempDialog.getByRole('button', { name: '保存临时物料' }).click()
  await temp.getByText('已创建临时物料 WATCH-TMP-9001').waitFor()
  await shot(studio, 'operator-done.png')
  const stored = await studio.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}'))
  const materials = (stored.data?.skus || []).filter((item) => item.materialCode)
  const iphone = (stored.data?.families || []).find((item) => item.id === 'f-iphone')
  if (!iphone) throw new Error('旧商品丢了')
  if (iphone.line) throw new Error('旧商品被改成 v3')
  if (materials.length < 3) throw new Error('物料数量不对 ' + materials.length)
  if (new Set(materials.map((item) => item.materialCode)).size !== materials.length) throw new Error('物料编码重复')
  const watch = materials.find((item) => item.materialCode === 'WATCH-TMP-9001')
  const watchPlan = (stored.data?.planningRecords || []).find((item) => item.planningId === watch?.planningId)
  if (!watch || !String(watch.planningId).startsWith('TMP-') || watchPlan?.origin !== 'temporary') throw new Error('临时物料没有独立编号')
  if ((stored.data?.params || []).some((item) => (item.values || []).includes('临时经营值'))) throw new Error('临时值写进了属性词典')
  const v1 = (stored.data?.specModelVersions || []).find((item) => item.id === 'phone-model-v1')
  if ((v1?.nodesSnapshot || []).filter((item) => !item.parentId).length !== 1) throw new Error('手机已发布快照被改写')
  notes.push({ persona: boss.name, clicks: boss.clicks, count: boss.clicks.length, stayed: studio.url().includes('/specs'), errors: bossErrors })
  notes.push({ persona: operator.name, clicks: operator.clicks, count: operator.clicks.length, codes, materialCount: materials.length })
  await writeFile(new URL('notes.json', out), JSON.stringify({ notes, dialogSample: dialogText.slice(0, 400) }, null, 2))
  console.log(JSON.stringify({ ok: true, notes }, null, 2))
  await page.close()
  await studio.close()
} finally {
  await browser.close()
}
