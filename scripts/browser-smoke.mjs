import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { assertDefaultPhone, defaultPhonePaths } from './phone-expect.mjs'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5190'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

function pairs(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

try {
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  await page.locator('.combo-toggle').first().click()
  const before = await page.locator('section.insight').innerText()
  assertDefaultPhone(before)
  if (!before.includes('0 条已有规划编号') || !before.includes('发布后自动编号')) {
    throw new Error('发布前预览不对：' + before)
  }
  await page.getByText('结构视图', { exact: true }).click()
  await page.locator('.vue-flow').waitFor()
  await page.getByText('大纲视图', { exact: true }).click()
  await page.locator('.outline-row').first().waitFor()
  await page.getByText('幕布模式', { exact: true }).click()
  await page.locator('.outline.is-mubu').waitFor()
  await page.getByText('大纲视图', { exact: true }).click()
  await page.getByRole('button', { name: '发布模型' }).click()
  await page.getByText(`${defaultPhonePaths.length} 条已有规划编号`).waitFor()
  const published = pairs(await page.locator('section.insight').innerText())
  const publishedIds = published.filter((line) => line.includes('PLN-'))
  if (publishedIds.length !== defaultPhonePaths.length) throw new Error('发布后编号和合法路径数量不一致：' + publishedIds.length)
  assertDefaultPhone(published.join('\n'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.combo-toggle').first().click()
  await page.getByText(`${defaultPhonePaths.length} 条已有规划编号`).waitFor()
  const refreshed = pairs(await page.locator('section.insight').innerText())
  if (refreshed.join('\n') !== published.join('\n')) throw new Error('刷新后组合或编号变了')
  await page.getByText('大纲视图', { exact: true }).click()
  const black = page.locator('input.line[data-line="sn-apple-128-black"]')
  await black.focus()
  await black.press('ArrowDown')
  await page.getByRole('button', { name: '发布模型' }).click()
  await page.locator('.version-name', { hasText: 'V2' }).waitFor()
  await page.getByText(`${defaultPhonePaths.length} 条已有规划编号`).waitFor()
  const reordered = pairs(await page.locator('section.insight').innerText()).filter((line) => line.includes('PLN-'))
  const sameIds = publishedIds.every((line) => reordered.includes(line)) && reordered.length === defaultPhonePaths.length
  if (!sameIds) throw new Error('调整顺序后编号没有保持')
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}'))
  const versions = (stored.data?.specModelVersions || []).filter((item) => item.templateId === 't-phone')
  const v1 = versions.find((item) => item.id === 'phone-model-v1')
  const blackNode = v1?.nodesSnapshot?.find((item) => item.id === 'sn-apple-128-black')
  const active = (stored.data?.planningRecords || []).filter((item) => item.productModelId === 't-phone' && item.status === 'active')
  if (stored.version !== 12) throw new Error('存储版本不是 12')
  if (versions.length !== 2) throw new Error('手机模型版本数 ' + versions.length)
  if (blackNode?.sort !== 1) throw new Error('V1 快照被改写，黑色顺序变成 ' + blackNode?.sort)
  if (active.length !== defaultPhonePaths.length) throw new Error('有效规划 ' + active.length)
  if ((stored.data?.families || []).some((item) => item.line)) throw new Error('旧商品被写入 line')
  if ((stored.data?.skus || []).some((item) => item.planningId)) throw new Error('旧 SKU 被写入 planningId')
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.getByText('Apple iPhone 17').waitFor()
  await page.goto(`${base}/products/new`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '新增商品' }).waitFor()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({
    ok: true,
    previewBefore: publishedIds.length,
    afterRefresh: refreshed.filter((line) => line.includes('PLN-')).length,
    afterReorder: reordered.length,
    versions: versions.map((item) => item.versionName),
    v1BlackSort: blackNode?.sort,
    activePlans: active.length,
  }))
} finally {
  await browser.close()
}
