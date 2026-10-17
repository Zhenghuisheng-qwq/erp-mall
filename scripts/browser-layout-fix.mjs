import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5265'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

async function boxes() {
  return page.locator('.vue-flow__node').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return {
      id: node.getAttribute('data-id'),
      text: (node.textContent || '').replace(/\s+/g, ' ').trim(),
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    }
  }))
}
function named(list, text) {
  return list.find((item) => item.text === text || item.text.startsWith(text))
}
function overlaps(left, right) {
  return !(left.right <= right.left || right.right <= left.left || left.bottom <= right.top || right.bottom <= left.top)
}

try {
  await page.goto(`${base}/specs?template=t-case-model`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '100%' }).click()
  await page.getByRole('button', { name: '添加属性' }).click()
  const dialog = page.locator('.el-dialog').filter({ hasText: '选择属性' })
  await dialog.locator('.el-select').click()
  for (const name of ['型号', '系列', '颜色', '容量']) {
    await page.getByRole('option', { name, exact: true }).click()
  }
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: '确定' }).click()
  await page.locator('.vue-flow__node', { hasText: '型号' }).first().waitFor()
  const zoomBefore = await page.locator('.vue-flow__viewport').evaluate((el) => getComputedStyle(el).transform)
  const before = await boxes()
  const seriesBefore = named(before, '系列')
  if (!seriesBefore) throw new Error('没有系列节点 ' + before.map((item) => item.text).join('|'))

  await page.locator('.vue-flow__node', { hasText: '型号' }).first().click()
  await page.getByRole('button', { name: '添加属性值' }).click()
  const valueDialog = page.locator('.el-dialog').filter({ hasText: '选择属性值' })
  await valueDialog.locator('.el-select').click()
  for (const name of ['iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max']) {
    await page.getByRole('option', { name, exact: true }).click()
  }
  await page.keyboard.press('Escape')
  await valueDialog.getByRole('button', { name: '确定' }).click()
  await page.locator('.vue-flow__node', { hasText: 'iPhone 17 Pro Max' }).first().waitFor()
  const zoomAfter = await page.locator('.vue-flow__viewport').evaluate((el) => getComputedStyle(el).transform)
  const after = await boxes()
  const series = named(after, '系列')
  const color = named(after, '颜色')
  const capacity = named(after, '容量')
  const values = ['iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max'].map((name) => named(after, name))
  if (values.some((item) => !item) || !series || !color || !capacity) throw new Error('节点缺失 ' + after.map((item) => item.text).join('|'))
  const valueBottom = Math.max(...values.map((item) => item.bottom))
  if (!(series.top >= valueBottom - 1 && color.top >= series.bottom - 1 && capacity.top >= color.bottom - 1)) {
    throw new Error('兄弟没有避开型号子树 ' + JSON.stringify({ series, color, capacity, valueBottom, seriesBefore: seriesBefore.top }))
  }
  if (!(series.top > seriesBefore.top + 8)) throw new Error('系列没有下移 ' + seriesBefore.top + ' -> ' + series.top)
  const hits = []
  after.forEach((left, index) => {
    after.slice(index + 1).forEach((right) => {
      if (overlaps(left, right)) hits.push(`${left.text}/${right.text}`)
    })
  })
  if (hits.length) throw new Error('节点重叠 ' + hits.join(','))
  if (zoomBefore !== zoomAfter) throw new Error('新增后缩放被重置 ' + zoomBefore + ' -> ' + zoomAfter)
  await page.screenshot({ path: 'D:/tmp/layout-auto.png' })

  const kept = capacity.top
  await page.getByRole('button', { name: '手工摆放' }).click()
  await page.locator('.vue-flow__node', { hasText: '型号' }).first().click()
  await page.getByRole('button', { name: '添加属性值' }).click()
  const again = page.locator('.el-dialog').filter({ hasText: '选择属性值' })
  await again.locator('.el-select').click()
  await page.getByRole('option', { name: 'iPhone 16', exact: true }).click()
  await page.keyboard.press('Escape')
  await again.getByRole('button', { name: '确定' }).click()
  await page.locator('.vue-flow__node', { hasText: 'iPhone 16' }).first().waitFor()
  const manual = named(await boxes(), '容量')
  if (!manual || Math.abs(manual.top - kept) > 2) throw new Error('手工模式挪动了已有节点 ' + kept + ' -> ' + manual?.top)
  await page.screenshot({ path: 'D:/tmp/layout-manual.png' })

  await page.getByRole('button', { name: '自动布局' }).click()
  await page.waitForTimeout(200)
  const restored = await boxes()
  const restoredCapacity = named(restored, '容量')
  const restoredValues = restored.filter((item) => item.text.startsWith('iPhone'))
  const restoredBottom = Math.max(...restoredValues.map((item) => item.bottom))
  if (!restoredCapacity || restoredCapacity.top < restoredBottom - 1) throw new Error('自动布局没有把容量放到取值下面 ' + JSON.stringify({ restoredCapacity, restoredBottom }))
  await page.screenshot({ path: 'D:/tmp/layout-restored.png' })

  const ids = await page.evaluate(() => {
    const raw = localStorage.getItem('iyge-v2-mock-db')
    const data = JSON.parse(raw).data
    const nodes = data.productSpecNodes.filter((item) => item.templateId === 't-case-model')
    const version = data.specModelVersions.find((item) => item.id === 'phone-model-v1')
    return {
      count: nodes.length,
      ids: nodes.map((item) => `${item.id}:${item.attributeId}:${item.valueId}`).join('|'),
      frozen: version.nodesSnapshot.find((item) => item.id === 'sn-apple-cap-128')?.valueId,
    }
  })
  if (ids.frozen !== '128G') throw new Error('旧快照被改写 ' + ids.frozen)
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, seriesBefore: seriesBefore.top, seriesAfter: series.top, valueBottom, capacity: capacity.top, manualCapacity: manual.top, restored: restoredCapacity.top, nodes: ids.count }))
} catch (error) {
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  await browser.close()
}
