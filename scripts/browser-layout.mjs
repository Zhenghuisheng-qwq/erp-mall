import { createRequire } from 'node:module'

const require = createRequire('D:/tmp/pw/package.json')
const { chromium } = require('playwright-core')
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5243'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
async function readData() {
  return page.evaluate(() => {
    const raw = localStorage.getItem('iyge-v2-mock-db')
    return raw ? JSON.parse(raw).data : null
  })
}
async function readNodes() {
  const data = await readData()
  if (!data) return []
  return data.productSpecNodes.filter((item) => item.templateId === 't-phone').map((item) => ({
      id: item.id,
      parentId: item.parentId,
      type: item.nodeType,
      attributeId: item.attributeId,
      valueId: item.valueId,
      x: item.positionX,
      y: item.positionY,
    }))
}
try {
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  const before = await readData()
  const beforePlans = before ? before.planningRecords.length : 0
  await page.getByText('容量', { exact: true }).first().click()
  await page.getByRole('button', { name: '添加属性值' }).click()
  const dialog = page.getByRole('dialog', { name: '选择属性值' })
  await dialog.waitFor()
  await dialog.locator('.el-select').click()
  await page.getByRole('option', { name: '512G', exact: true }).click()
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: '确定' }).click()
  await page.getByText('512G', { exact: true }).first().waitFor()
  let nodes = await readNodes()
  const cap = nodes.find((item) => item.type === 'ATTRIBUTE' && item.attributeId === 'p-cap')
  const added = nodes.find((item) => item.valueId === '512G')
  if (!cap || !added || added.parentId !== cap.id) throw new Error('512G 没有挂在容量下面 ' + JSON.stringify(added))
  if (!(added.x > cap.x) || added.y < 10) throw new Error(`512G 仍游离 x=${added.x} y=${added.y} 容量 x=${cap.x} y=${cap.y}`)
  await page.getByText('颜色', { exact: true }).first().click()
  await page.getByRole('button', { name: '添加属性值' }).click()
  await dialog.waitFor()
  await dialog.locator('.el-select').click()
  await page.getByRole('option', { name: '蓝色', exact: true }).click()
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: '确定' }).click()
  await page.getByText('蓝色', { exact: true }).first().waitFor()
  nodes = await readNodes()
  const color = nodes.find((item) => item.type === 'ATTRIBUTE' && item.attributeId === 'p-color')
  const blue = nodes.find((item) => item.valueId === '蓝色')
  const capValue = nodes.find((item) => item.valueId === '512G')
  if (!color || !blue || blue.parentId !== color.id) throw new Error('蓝色没有挂在颜色下面')
  if (!(blue.x > color.x) || Math.abs(blue.y - (capValue?.y || 0)) < 8 && blue.x === capValue?.x) throw new Error(`蓝色和容量值叠在一起 ${JSON.stringify({ blue, capValue, color })}`)
  await page.getByText('大纲视图', { exact: true }).click()
  await page.getByText('结构视图', { exact: true }).click()
  await page.reload({ waitUntil: 'networkidle' })
  nodes = await readNodes()
  const blueAgain = nodes.find((item) => item.valueId === '蓝色')
  const plans = (await readData()).planningRecords.length
  if (!blueAgain || blueAgain.parentId !== color.id || !(blueAgain.x > 100)) throw new Error('刷新后蓝色又游离了 ' + JSON.stringify(blueAgain))
  if (plans !== beforePlans) throw new Error(`规划编号数量变了 ${beforePlans} -> ${plans}`)
  console.log(`PASS 512G 在容量右侧 x=${added.x} y=${added.y}`)
  console.log(`PASS 蓝色在颜色右侧 x=${blueAgain.x} y=${blueAgain.y}`)
  console.log(`PASS 规划档仍是 ${plans} 条`)
} catch (error) {
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  await browser.close()
}
