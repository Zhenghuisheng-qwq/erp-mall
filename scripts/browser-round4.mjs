import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5243'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

function overlaps(boxes) {
  const hits = []
  boxes.forEach((left, index) => {
    boxes.slice(index + 1).forEach((right) => {
      const separated = left.right <= right.left || right.right <= left.left || left.bottom <= right.top || right.bottom <= left.top
      if (!separated) hits.push(`${left.id}/${right.id}`)
    })
  })
  return hits
}

try {
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '自动布局' }).click()
  await page.waitForTimeout(300)
  const boxes = await page.locator('.vue-flow__node').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { id: node.getAttribute('data-id'), left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
  }))
  const hits = overlaps(boxes.filter((item) => item.right - item.left > 2))
  if (hits.length) throw new Error('结构节点重叠 ' + hits.slice(0, 8).join(','))
  const apple = boxes.find((item) => item.id === 'sn-brand-apple')
  const huawei = boxes.find((item) => item.id === 'sn-brand-huawei')
  if (!apple || !huawei || Math.abs(apple.top - huawei.top) < 8) throw new Error('品牌分支没有分开 ' + JSON.stringify({ apple, huawei, nodes: boxes.length }))
  await page.goto(`${base}/plans`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '商品规划' }).waitFor()
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '新增商品' }).waitFor()
  await page.goto(`${base}/compatibility`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '适用关系' }).waitFor()
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, nodes: boxes.length, appleTop: apple.top, huaweiTop: huawei.top }))
} catch (error) {
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  await browser.close()
}
