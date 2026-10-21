import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5261'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

async function nodeState() {
  return page.evaluate(() => {
    const raw = localStorage.getItem('iyge-v2-mock-db')
    const data = JSON.parse(raw).data
    const node = data.productSpecNodes.find((item) => item.id === 'sn-apple-cap-128')
    const version = data.specModelVersions.find((item) => item.id === 'phone-model-v1')
    const frozen = version.nodesSnapshot.find((item) => item.id === 'sn-apple-cap-128')
    return {
      id: node?.id,
      valueId: node?.valueId,
      attributeId: node?.attributeId,
      frozenValue: frozen?.valueId,
      rules: (data.nodeCompatibilityRules || []).filter((item) => item.modelVersionId === '').length,
    }
  })
}

try {
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  await page.getByText('大纲视图', { exact: true }).click()
  await page.locator('[data-line="sn-apple-cap-128"]').click()
  await page.getByRole('option', { name: '512G', exact: true }).click()
  const edited = await nodeState()
  if (edited.valueId !== '512G' || edited.attributeId !== 'p-cap' || edited.id !== 'sn-apple-cap-128' || edited.frozenValue !== '128G') {
    throw new Error('大纲保存不正确 ' + JSON.stringify(edited))
  }
  await page.getByText('结构视图', { exact: true }).click()
  await page.locator('.vue-flow__node', { hasText: '512G' }).first().waitFor()
  await page.getByText('大纲视图', { exact: true }).click()
  await page.locator('[data-line="sn-apple-cap-128"]', { hasText: '512G' }).waitFor()
  await page.getByText('幕布模式', { exact: true }).click()
  await page.locator('[data-line="sn-apple-cap-128"]', { hasText: '512G' }).waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('大纲视图', { exact: true }).click()
  await page.locator('[data-line="sn-apple-cap-128"]', { hasText: '512G' }).waitFor()
  await page.locator('[data-line="sn-apple-cap-128"]').click()
  const absent = await page.getByRole('option', { name: '256G', exact: true }).count()
  if (absent !== 0) throw new Error('同级已有的 256G 仍出现在下拉里')
  await page.keyboard.press('Delete')
  const kept = await nodeState()
  if (kept.valueId !== '512G') throw new Error('下拉打开时 Delete 改掉了节点 ' + JSON.stringify(kept))
  await page.keyboard.press('Escape')

  await page.goto(`${base}/compatibility`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '放入测试样例' }).click()
  await page.getByText('iPhone 17 Pro Max').first().waitFor()
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  await page.getByText('大纲视图', { exact: true }).click()
  await page.locator('[data-line="sn-apple-model-17"]').click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '节点适用配置' }).click()
  await page.getByText('不会自动建立现有物料的适用关系').waitFor()
  const box = page.locator('.el-dialog label', { hasText: 'iPhone 17 Pro Max' }).first().locator('input')
  await box.check()
  await page.getByRole('button', { name: '保存到草稿' }).click()
  await page.getByText('已保存到模型草稿').waitFor()
  const saved = await nodeState()
  if (saved.rules < 1 || saved.frozenValue !== '128G') throw new Error('节点配置没有留下或改了旧快照 ' + JSON.stringify(saved))
  await page.getByText('结构视图', { exact: true }).click()
  await page.getByRole('button', { name: '节点适用配置' }).click()
  await page.locator('.el-dialog').getByText('iPhone 17 Pro Max').first().waitFor()
  await page.getByRole('button', { name: '关闭', exact: true }).click()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('大纲视图', { exact: true }).click()
  await page.locator('[data-line="sn-apple-model-17"]').click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '节点适用配置' }).click()
  await page.locator('.el-dialog').getByText('iPhone 17 Pro Max').first().waitFor()

  await page.goto(`${base}/products/f-iphone`, { waitUntil: 'networkidle' })
  await page.getByText('iPhone').first().waitFor()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, valueId: saved.valueId, rules: saved.rules, frozenValue: saved.frozenValue }))
} catch (error) {
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  await browser.close()
}
