import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require = createRequire(existsSync('D:/tmp/pw/package.json') ? 'D:/tmp/pw/package.json' : import.meta.url)
const { chromium } = require('playwright-core')
const base = process.env.SMOKE_URL || 'http://127.0.0.1:5267'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

async function readGraph() {
  return page.evaluate(() => {
    const raw = localStorage.getItem('iyge-v2-mock-db')
    const data = JSON.parse(raw).data
    const nodes = data.productSpecNodes.filter((item) => item.templateId === 't-case-model')
    const canvas = data.specCanvases.find((item) => item.templateId === 't-case-model')
    const dom = [...document.querySelectorAll('.vue-flow__node')].map((node) => {
      const rect = node.getBoundingClientRect()
      return {
        id: node.getAttribute('data-id'),
        label: (node.querySelector('strong, span')?.textContent || '').trim(),
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      }
    })
    const byId = new Map(dom.map((item) => [item.id, item]))
    const band = (id) => {
      const self = byId.get(id)
      if (!self) return null
      let top = self.top
      let bottom = self.bottom
      let right = self.right
      nodes.filter((item) => item.parentId === id).forEach((child) => {
        const next = band(child.id)
        if (!next) return
        top = Math.min(top, next.top)
        bottom = Math.max(bottom, next.bottom)
        right = Math.max(right, next.right)
      })
      return { top, bottom, right }
    }
    const roots = nodes.filter((item) => !item.parentId).sort((a, b) => (byId.get(a.id)?.top || 0) - (byId.get(b.id)?.top || 0))
    const crossings = []
    for (let index = 1; index < roots.length; index += 1) {
      const previous = band(roots[index - 1].id)
      const next = band(roots[index].id)
      if (previous && next && previous.bottom > next.top + 1) crossings.push(`${byId.get(roots[index - 1].id)?.label}/${byId.get(roots[index].id)?.label}`)
    }
    const hits = []
    dom.forEach((left, index) => {
      dom.slice(index + 1).forEach((right) => {
        const separated = left.right <= right.left + 1 || right.right <= left.left + 1 || left.bottom <= right.top + 1 || right.bottom <= left.top + 1
        if (!separated) hits.push(`${left.label}/${right.label}`)
      })
    })
    const lineHits = []
    ;[...document.querySelectorAll('path.tree-bus')].forEach((path) => {
      const length = path.getTotalLength()
      if (!length) return
      const samples = 12
      for (let step = 0; step <= samples; step += 1) {
        const point = path.getPointAtLength((length * step) / samples)
        const host = path.ownerSVGElement?.getBoundingClientRect()
        if (!host) continue
        const x = host.left + point.x
        const y = host.top + point.y
        dom.forEach((node) => {
          const inside = x > node.left + 6 && x < node.right - 6 && y > node.top + 4 && y < node.bottom - 4
          if (inside) lineHits.push(node.label)
        })
      }
    })
    const find = (label) => dom.find((item) => item.label === label)
    const flowBand = (id) => {
      const self = nodes.find((item) => item.id === id)
      if (!self) return null
      const height = self.nodeType === 'VALUE' ? 34 : self.id === 'model-root' ? 48 : 42
      let top = self.positionY || 0
      let bottom = top + height
      nodes.filter((item) => item.parentId === id).forEach((child) => {
        const next = flowBand(child.id)
        if (!next) return
        top = Math.min(top, next.top)
        bottom = Math.max(bottom, next.bottom)
      })
      return { top, bottom }
    }
    const flowOf = (label) => {
      const node = nodes.find((item) => !item.parentId && data.params.find((param) => param.id === item.attributeId)?.name === label)
      return node?.positionY
    }
    const model = nodes.find((item) => item.valueId === '' && data.params.find((param) => param.id === item.attributeId)?.name === '型号' && !item.parentId)
    const modelBand = model ? band(model.id) : null
    return {
      direction: canvas?.direction,
      locked: canvas?.layoutLocked === true,
      crossings,
      hits,
      lineHits: [...new Set(lineHits)],
      seriesY: flowOf('系列'),
      colorY: flowOf('颜色'),
      modelTop: find('型号')?.top,
      modelBand: model ? Math.round((flowBand(model.id)?.bottom || 0) - (flowBand(model.id)?.top || 0)) : 0,
      modelId: model?.id || '',
      modelChildren: model ? nodes.filter((item) => item.parentId === model.id).map((item) => `${item.id}:${item.valueId}`) : [],
      domIds: dom.map((item) => `${item.id}:${item.label}`),
      stored: nodes.map((item) => `${item.id}:${item.parentId || ''}:${item.sort}:${item.positionY}`).join('|'),
      identity: nodes.map((item) => `${item.id}:${item.parentId || ''}:${item.attributeId}:${item.valueId}:${item.sort}`).sort().join('|'),
      frozen: data.specModelVersions.find((item) => item.id === 'phone-model-v1')?.nodesSnapshot.find((item) => item.id === 'sn-apple-cap-128')?.valueId,
      plans: (data.planningRecords || []).map((item) => item.planningId).join(','),
    }
  })
}

async function pickOptions(title, names) {
  const dialog = page.getByRole('dialog', { name: title, exact: true })
  await dialog.waitFor()
  await dialog.locator('.el-select').click()
  for (const name of names) await page.getByRole('option', { name, exact: true }).click()
  await dialog.locator('.el-dialog__header').click()
  await dialog.getByRole('button', { name: '确定', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
}

async function addAttributes(names) {
  const empty = page.getByRole('button', { name: '添加属性', exact: true })
  if (await empty.count()) await empty.first().click()
  else {
    await page.locator('.model-root').click()
    await page.getByRole('button', { name: '添加属性', exact: true }).click()
  }
  await pickOptions('选择属性', names)
}

async function addValuesUnder(label, names) {
  await page.locator('.vue-flow__node').filter({ has: page.locator('strong', { hasText: new RegExp(`^${label}$`) }) }).click({ force: true })
  await page.getByRole('button', { name: '添加属性值' }).click()
  await pickOptions('选择属性值', names)
}

try {
  await page.goto(`${base}/specs?template=t-case-model`, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const key = 'iyge-v2-mock-db'
    const parsed = JSON.parse(localStorage.getItem(key))
    const param = parsed.data.params.find((item) => item.id === 'p-model')
    for (let index = 1; index <= 7; index += 1) {
      const name = `测试值${index}`
      if (!param.values.includes(name)) param.values.push(name)
    }
    localStorage.setItem(key, JSON.stringify(parsed))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '100%' }).click()
  const zoomAt100 = await page.locator('.vue-flow__transformationpane').evaluate((el) => getComputedStyle(el).transform)

  await addAttributes(['表带尺码', '表带类型', '表带颜色', '表壳', '车身颜色'])
  await addValuesUnder('表带尺码', ['S/M', 'M/L'])
  await addValuesUnder('表带类型', ['运动表带'])
  await addValuesUnder('表壳', ['铝金属表壳'])
  await addValuesUnder('车身颜色', ['黑色', '白色'])
  await addAttributes(['系列', '型号', '颜色'])
  const baseRow = await readGraph()
  if (baseRow.crossings.length || baseRow.hits.length) throw new Error('初始兄弟已交错 ' + JSON.stringify(baseRow.crossings.concat(baseRow.hits)))
  if (page.url().includes('auto')) throw new Error('不该依赖地址参数')

  const rows = [{ step: '未新增', modelBand: baseRow.modelBand, seriesY: baseRow.seriesY, colorY: baseRow.colorY, crossings: baseRow.crossings.length }]
  let addedValues = 0
  for (const name of ['iPhone 17 Pro', 'iPhone 17', 'iPhone 17 Pro Max']) {
    const before = await readGraph()
    await addValuesUnder('型号', [name])
    await page.locator('.vue-flow__node').filter({ has: page.locator('span', { hasText: new RegExp(`^${name}$`) }) }).waitFor()
    const after = await readGraph()
    addedValues += 1
    if (after.crossings.length || after.hits.length || after.lineHits.length) throw new Error(`${name} 后布局冲突 ` + JSON.stringify({ crossings: after.crossings, hits: after.hits, lineHits: after.lineHits }))
    if (addedValues >= 2) {
      if (after.modelBand <= before.modelBand) throw new Error(`${name} 后型号子树没有变高 ${before.modelBand} -> ${after.modelBand}`)
      if (!(after.colorY > before.colorY + 4)) throw new Error(`${name} 后颜色没有避让 ${before.colorY} -> ${after.colorY}`)
    }
    rows.push({ step: name, modelBand: after.modelBand, seriesY: after.seriesY, colorY: after.colorY, crossings: after.crossings.length })
  }
  const three = await readGraph()
  await addValuesUnder('型号', ['iPhone 16', 'iPad Air', 'MacBook Air', 'Watch 42', '测试值1', '测试值2', '测试值3'])
  const ten = await readGraph()
  const valueCount = await page.locator('.vue-flow__node span').count()
  if (ten.modelBand <= three.modelBand) throw new Error('加到更多取值后型号子树没有继续变高')
  if (ten.crossings.length || ten.hits.length || ten.lineHits.length) throw new Error('十个值后冲突 ' + JSON.stringify(ten))
  if (!(ten.colorY > three.colorY + 4)) throw new Error('十个值后颜色没有继续下移')

  const beforeDelete = await readGraph()
  await page.locator('.vue-flow__node').filter({ has: page.locator('span', { hasText: /^测试值3$/ }) }).click()
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.locator('.vue-flow__node').filter({ has: page.locator('span', { hasText: /^测试值3$/ }) }).waitFor({ state: 'detached' })
  const afterDelete = await readGraph()
  if (!(afterDelete.colorY < beforeDelete.colorY - 4)) throw new Error('删除后没有回收空间 ' + beforeDelete.colorY + ' -> ' + afterDelete.colorY)
  if (afterDelete.crossings.length) throw new Error('删除后交错 ' + afterDelete.crossings.join(','))

  const openColor = (await readGraph()).colorY
  await page.locator('.vue-flow__node').filter({ has: page.locator('strong', { hasText: /^型号$/ }) }).locator('.fold').evaluate((el) => el.click())
  await page.locator('.vue-flow__node').filter({ has: page.locator('span', { hasText: /^iPhone 17$/ }) }).waitFor({ state: 'detached' })
  const closed = await readGraph()
  if (!(closed.colorY + 8 < openColor)) throw new Error('收起后颜色没有上移 ' + closed.colorY + ' / ' + openColor)
  if (closed.crossings.length) throw new Error('收起后交错')
  await page.locator('.vue-flow__node').filter({ has: page.locator('strong', { hasText: /^型号$/ }) }).locator('.fold').evaluate((el) => el.click())
  const reopened = await readGraph()
  if (!(reopened.colorY > closed.colorY + 8)) throw new Error('展开后颜色没有再次避让')

  await page.getByText('大纲视图', { exact: true }).click()
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.outline-row')]
    const source = rows.find((row) => row.querySelector('button.line')?.textContent?.trim() === '表壳')
    const target = rows.find((row) => row.querySelector('button.line')?.textContent?.trim() === '系列')
    const grip = source?.querySelector('.grip')
    if (!grip || !target) throw new Error('大纲里没有表壳或系列')
    const dataTransfer = new DataTransfer()
    grip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
    const rect = target.getBoundingClientRect()
    const clientY = rect.top + rect.height / 2
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, clientY, dataTransfer }))
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, clientY, dataTransfer }))
  })
  await page.waitForTimeout(300)
  const moved = await readGraph()
  if (moved.crossings.length || moved.hits.length) throw new Error('移动后交错 ' + moved.crossings.concat(moved.hits).join(','))
  const shellParent = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data
    const nodes = data.productSpecNodes.filter((item) => item.templateId === 't-case-model')
    const shell = nodes.find((item) => item.attributeId === 'p-case' && item.nodeType === 'ATTRIBUTE')
    const parent = nodes.find((item) => item.id === shell?.parentId)
    if (!parent) return '根'
    return data.params.find((item) => item.id === parent.attributeId)?.name || parent.valueId || parent.id
  })
  if (shellParent !== '系列') throw new Error('表壳没有移到系列下面，现在挂在 ' + shellParent)

  const beforeSwitch = await readGraph()
  await page.getByText('大纲视图', { exact: true }).click()
  await page.getByText('结构视图', { exact: true }).click()
  const afterSwitch = await readGraph()
  if (beforeSwitch.identity !== afterSwitch.identity) throw new Error('切换视图改了节点身份')
  if (afterSwitch.crossings.length) throw new Error('切回结构视图后交错')

  const beforeReload = await readGraph()
  await page.reload({ waitUntil: 'networkidle' })
  const afterReload = await readGraph()
  if (beforeReload.identity !== afterReload.identity) throw new Error('刷新后节点身份变了')
  if (afterReload.frozen !== '128G') throw new Error('发布快照被改写')
  if (afterReload.crossings.length) throw new Error('刷新后布局退回交错')

  const storedBeforeZoom = afterReload.stored
  await page.getByRole('button', { name: '100%', exact: true }).click({ force: true })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '缩小', exact: true }).click({ force: true })
  await page.getByRole('button', { name: '缩小', exact: true }).click({ force: true })
  await page.waitForTimeout(400)
  const zoomSmall = await page.locator('.vue-flow__transformationpane').evaluate((el) => getComputedStyle(el).transform)
  const small = await readGraph()
  await page.getByRole('button', { name: '100%', exact: true }).click({ force: true })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '放大', exact: true }).click({ force: true })
  await page.getByRole('button', { name: '放大', exact: true }).click({ force: true })
  await page.waitForTimeout(400)
  const zoomLarge = await page.locator('.vue-flow__transformationpane').evaluate((el) => getComputedStyle(el).transform)
  const large = await readGraph()
  if (small.stored !== storedBeforeZoom || large.stored !== storedBeforeZoom) throw new Error('缩放改了领域坐标')
  if (zoomSmall === zoomAt100 || zoomLarge === zoomAt100) throw new Error(`缩放没有变化 ${zoomAt100} | ${zoomSmall} | ${zoomLarge}`)
  if (small.crossings.length || large.crossings.length) throw new Error('缩放后交错')

  await page.getByRole('button', { name: '适应全部' }).click({ force: true })
  await page.waitForTimeout(300)
  const manualBefore = await readGraph()
  await page.getByRole('button', { name: '手工摆放' }).click({ force: true })
  await addValuesUnder('型号', ['测试值4'])
  const manualAfter = await readGraph()
  if (Math.abs(manualAfter.colorY - manualBefore.colorY) > 2) throw new Error('手工模式挪动了颜色 ' + manualBefore.colorY + ' -> ' + manualAfter.colorY)
  await page.getByRole('button', { name: '自动布局' }).click()
  const restored = await readGraph()
  if (!(restored.colorY > manualAfter.colorY + 4) || restored.crossings.length) throw new Error('恢复自动布局失败 ' + JSON.stringify({ manual: manualAfter.colorY, restored: restored.colorY, crossings: restored.crossings }))
  await page.screenshot({ path: 'D:/tmp/layout-live.png' })
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({
    ok: true,
    valueCount,
    rows: rows.map((item) => ({ step: item.step, modelBand: item.modelBand, seriesY: item.seriesY, colorY: item.colorY, crossings: item.crossings?.length ?? item.crossings })),
    ten: { modelBand: ten.modelBand, seriesY: ten.seriesY, colorY: ten.colorY },
    deletedColorY: afterDelete.colorY,
    closedColorY: closed.colorY,
    reopenedColorY: reopened.colorY,
    zoom: { at100: zoomAt100, small: zoomSmall, large: zoomLarge },
    plans: restored.plans,
    frozen: restored.frozen,
  }, null, 2))
} catch (error) {
  console.error('FAIL', error)
  await page.screenshot({ path: 'D:/tmp/layout-live-fail.png' }).catch(() => undefined)
  process.exitCode = 1
} finally {
  await browser.close()
}
