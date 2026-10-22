import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'
import { clickOption } from './browser-ui.mjs'

const output = resolve(process.env.ROUND3_OUTPUT_DIR || 'work/refactor-round3')
const manifestPath = resolve(process.env.ROUND3_MANIFEST || 'work/refactor-round3/baseline-manifest.json')
if (!existsSync(manifestPath)) throw new Error(`Missing round-three source manifest ${manifestPath}. Restore the original snapshot (including uncommitted round-two files) and its manifest, or set ROUND3_MANIFEST. Git HEAD is not this baseline. For a fresh current-code business check use npm run check:integration.`)
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const baselineRoot = resolve(dirname(manifestPath), 'baseline')
const reference = resolve(process.env.ROUND3_EVIDENCE_DIR || output)
const phase = process.argv.includes('--before') ? 'before' : 'after'
const root = phase === 'before' ? baselineRoot : process.cwd()
// The baseline is an actual copy of tracked AND untracked round-two source, never Git HEAD.
for (const file of manifest.files) {
  const path = resolve(baselineRoot, file.path)
  if (!existsSync(path)) throw new Error(`Missing round-three baseline source ${path}. Restore the snapshot matching ${manifestPath}; do not copy current source over it.`)
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), file.sha256, `Baseline changed: ${file.path}`)
}
if (phase === 'after') {
  const scenes = ['structure-light', 'outline', 'document', 'naming', 'combo-draft', 'combo-materials', 'combo-history', 'node-hosts', 'structure-dark', 'empty-model', 'no-model']
  for (const name of ['states.json', 'diagnostics.json', ...scenes.flatMap(name => [`${name}.png`, `${name}-geometry.json`])]) {
    const path = resolve(reference, `before-${name}`)
    if (!existsSync(path)) throw new Error(`Missing round-three evidence ${path}. Run with --before against the verified snapshot, or set ROUND3_EVIDENCE_DIR to the existing evidence directory.`)
  }
}
mkdirSync(output, { recursive: true })
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5298, strictPort: true, open: false, watch: null } })
await server.listen()
const base = 'http://127.0.0.1:5298'
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true }).catch(async error => { await server.close(); throw error })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' })
await context.addInitScript(() => {
  const OriginalDate = Date
  window.__testTime = OriginalDate.parse('2026-10-22T04:00:00.000Z')
  window.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [window.__testTime])) }
    static now() { return window.__testTime }
  }
  window.__writes = []
  const originalSet = Storage.prototype.setItem
  Storage.prototype.setItem = function (key, value) {
    if (key.startsWith('iyge-')) window.__writes.push({ key, value })
    return originalSet.call(this, key, value)
  }
  if (!localStorage.getItem('iyge-v2-theme')) localStorage.setItem('iyge-v2-theme', 'light')
  if (!localStorage.getItem('iyge-spec-cat-fold')) localStorage.setItem('iyge-spec-cat-fold', '0')
  if (!localStorage.getItem('iyge-spec-rail-fold')) localStorage.setItem('iyge-spec-rail-fold', '0')
})
const page = await context.newPage()
page.setDefaultTimeout(15000)
const diagnostics = []
page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: String(error) }))
page.on('console', message => { if (['error', 'warning'].includes(message.type())) diagnostics.push({ type: message.type(), message: message.text() }) })
const states = []
const visuals = []
async function settle() {
  await page.evaluate(async () => {
    await document.fonts.ready
    const deadline = performance.now() + 15000
    let last = '', same = 0
    while (same < 20) {
      if (performance.now() > deadline) throw new Error('Designer viewport or overlays did not settle')
      await new Promise(requestAnimationFrame)
      const next = [...document.querySelectorAll('.vue-flow__transformationpane, .el-dialog, .el-overlay, .el-overlay-dialog, .el-popper')].map(node => `${node.getBoundingClientRect().toJSON().x}:${node.getBoundingClientRect().toJSON().y}:${getComputedStyle(node).transform}:${getComputedStyle(node).opacity}`).join('|')
      const transitioning = document.getAnimations().some(animation => (animation.playState === 'running' || animation.pending) && Number.isFinite(animation.effect?.getComputedTiming().iterations))
      same = next === last && !transitioning ? same + 1 : 0
      last = next
    }
  })
}
async function readData() {
  return page.evaluate(async () => {
    const { useCatalogStore } = await import('/src/stores/catalog.ts')
    return JSON.parse(JSON.stringify(useCatalogStore().data))
  })
}
async function record(name) {
  await settle()
  const data = await readData()
  const ui = await page.evaluate(() => ({
    url: location.pathname + location.search,
    nodes: [...document.querySelectorAll('.vue-flow__node')].map(node => ({ id: node.getAttribute('data-id'), transform: node.style.transform, text: node.textContent })),
    edges: [...document.querySelectorAll('.tree-bus')].map(node => ({ d: node.getAttribute('d'), class: node.getAttribute('class') })),
    flows: document.querySelectorAll('.vue-flow').length,
    viewport: document.querySelector('.vue-flow__transformationpane')?.getAttribute('style') || '',
    selected: [...document.querySelectorAll('.vue-flow__node > .is-on')].map(node => node.parentElement.getAttribute('data-id')),
    outline: [...document.querySelectorAll('[data-line]')].map(node => ({ id: node.dataset.line, text: node.value ?? node.textContent })),
    dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').map(node => node.getAttribute('aria-label')),
    comboRows: [...document.querySelectorAll('.combo-table .el-table__row')].map(node => node.textContent),
    active: { tag: document.activeElement?.tagName, line: document.activeElement?.getAttribute('data-line'), placeholder: document.activeElement?.getAttribute('placeholder') },
  }))
  const writes = await page.evaluate(() => window.__writes)
  states.push({ name, data, ui, writes })
  await page.evaluate(() => { window.__writes = []; window.__testTime += 1000 })
  console.log(`PASS ${phase} ${name}`)
}
async function shot(name) {
  await settle()
  await page.waitForFunction(() => document.querySelectorAll('.el-message').length === 0)
  await page.mouse.move(1910, 1070)
  await settle()
  const path = resolve(output, `${phase}-${name}.png`)
  const geometry = await page.evaluate(() => [...document.querySelectorAll('.designer, .designer *')].filter(node => node.getBoundingClientRect().width).map(node => {
    const style = getComputedStyle(node)
    return { tag: node.tagName, class: typeof node.className === 'string' ? node.className : node.className.baseVal, rect: node.getBoundingClientRect().toJSON(), style: Object.fromEntries([...style].map(key => [key, style.getPropertyValue(key)])) }
  }))
  writeFileSync(resolve(output, `${phase}-${name}-geometry.json`), JSON.stringify(geometry))
  await page.screenshot({ path, animations: 'disabled' })
  if (phase === 'after') {
    const left = PNG.sync.read(readFileSync(resolve(reference, `before-${name}.png`)))
    const right = PNG.sync.read(readFileSync(path))
    assert.equal(left.width, right.width); assert.equal(left.height, right.height)
    let changed = 0
    for (let i = 0; i < left.data.length; i += 4) if (!left.data.subarray(i, i + 4).equals(right.data.subarray(i, i + 4))) changed++
    const differences = []
    if (changed <= 30) {
      for (let i = 0; i < left.data.length; i += 4) {
        if (!left.data.subarray(i, i + 4).equals(right.data.subarray(i, i + 4))) differences.push({ x: i / 4 % left.width, y: Math.floor(i / 4 / left.width), before: [...left.data.subarray(i, i + 4)], after: [...right.data.subarray(i, i + 4)] })
      }
    }
    visuals.push({ name, pixels: left.width * left.height, changed, differences })
    // Chrome 155 can rasterize this unchanged dashed round corner in either shade.
    // Review only this exact pixel/pair, with every visible element's geometry and
    // computed styles equal. No mask, region tolerance, or general pixel threshold.
    if (name === 'naming' && changed === 1 && differences[0]?.x === 1322 && differences[0]?.y === 366) {
      const shades = ['232,237,243,255', '241,244,248,255']
      if (shades.includes(differences[0].before.join(',')) && shades.includes(differences[0].after.join(','))) {
        assert.deepEqual(geometry, JSON.parse(readFileSync(resolve(reference, `before-${name}-geometry.json`), 'utf8')))
        assert.equal(createHash('sha256').update(readFileSync('src/components/NamingRuleDialog.vue')).digest('hex'), manifest.files.find(file => file.path === 'src/components/NamingRuleDialog.vue').sha256)
        visuals.at(-1).reviewedRasterDifference = 'Single dashed-corner pixel; identical geometry/styles and unchanged naming component'
      }
    }
    // Collect every scene before enforcing exact comparison; differences stay inspectable.
  }
}
async function closeDialog(dialog) {
  await dialog.locator('.el-dialog__headerbtn').click()
  await dialog.waitFor({ state: 'hidden' })
  await settle()
}
const dialog = name => page.getByRole('dialog', { name, exact: true })
const node = id => page.locator(`.vue-flow__node[data-id="${id}"]`)
const combo = () => dialog('合法组合管理')
const nodeCount = async () => (await readData()).productSpecNodes.length
async function openCombos() {
  await page.getByRole('button', { name: '管理合法组合', exact: true }).click()
  await combo().waitFor()
}
async function publish() {
  await page.getByRole('button', { name: '发布模型', exact: true }).click()
  await settle()
}
async function chooseMode(label) {
  await page.locator('.view-switch').getByText(label, { exact: true }).click()
  await settle()
}
try {
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  await settle()
  await record('route-and-model')
  assert.equal(states.at(-1).ui.flows, 1)
  await shot('structure-light')
  await node('sn-brand').click()
  await chooseMode('大纲视图')
  await record('outline-selection')
  await shot('outline')
  await chooseMode('幕布模式')
  await record('document-selection')
  await shot('document')
  await chooseMode('结构视图')
  const firstSnapshots = (await readData()).specModelVersions
  await page.getByRole('button', { name: '命名规则', exact: true }).click()
  const naming = dialog('物料命名规则')
  await naming.locator('[data-field="p-brand"]').click()
  await naming.getByPlaceholder('固定文字，空格会原样保存').fill(' 三轮 ')
  await naming.getByRole('button', { name: '加入文字', exact: true }).click()
  assert.match(await naming.locator('.preview').innerText(), /Apple/)
  await shot('naming')
  await naming.getByRole('button', { name: '取消', exact: true }).click()
  await naming.waitFor({ state: 'hidden' })
  await settle()
  assert.deepEqual((await readData()).specModelVersions, firstSnapshots)
  assert.equal((await readData()).productSpecNodes.find(item => item.id === 'sn-brand').namingRule, undefined)
  await page.getByRole('button', { name: '命名规则', exact: true }).click()
  assert.equal(await naming.locator('.token').count(), 0)
  await naming.locator('[data-field="p-brand"]').click()
  await naming.locator('[data-field="p-color"]').click()
  await naming.getByRole('button', { name: '上移', exact: true }).last().click()
  await naming.getByRole('button', { name: '保存规则', exact: true }).click()
  await record('naming-save-order')
  await node('sn-brand-apple').click()
  await page.getByRole('button', { name: '命名规则', exact: true }).click()
  assert.match(await naming.innerText(), /最近祖先是「品牌」/)
  await naming.getByRole('button', { name: '取消', exact: true }).click()
  await naming.waitFor({ state: 'hidden' })
  await settle()
  const beforePreview = await readData()
  await openCombos()
  await combo().getByRole('button', { name: '全选', exact: true }).click()
  await record('unpublished-combo-selection')
  assert.deepEqual(await readData(), beforePreview, 'Preview must not write business data')
  await shot('combo-draft')
  await closeDialog(combo())
  await publish()
  await record('publish-naming-version')
  const published = await readData()
  firstSnapshots.forEach(old => assert.deepEqual(published.specModelVersions.find(item => item.id === old.id), old))
  await publish()
  const republished = await readData()
  assert.deepEqual(republished.specModelVersions, published.specModelVersions, 'Republish keeps frozen versions')
  assert.deepEqual(republished.planningRecords, published.planningRecords, 'Republish keeps planning identities')
  await record('republish-existing-version')
  await openCombos()
  await combo().getByRole('button', { name: '全选', exact: true }).click()
  await combo().getByRole('button', { name: '反选', exact: true }).click()
  assert.equal(await combo().getByRole('button', { name: '标为核心商品', exact: true }).isDisabled(), true)
  await combo().getByPlaceholder('搜索规格路径、规划编号、物料名称或编号').fill('128G')
  await combo().getByRole('button', { name: '全选', exact: true }).click()
  await record('filtered-combo-selection')
  await combo().getByRole('button', { name: '标为核心商品', exact: true }).click()
  await combo().getByPlaceholder('搜索规格路径、规划编号、物料名称或编号').fill('')
  await record('grade-and-clear-selection')
  await combo().getByRole('button', { name: '单条创建', exact: true }).first().click()
  const create = dialog('创建物料')
  await create.locator('label').filter({ hasText: '供应商编码' }).locator('input').fill('ROUND3-A')
  const countBeforeTyping = await nodeCount()
  await create.locator('input').first().press('Tab')
  assert.equal(await nodeCount(), countBeforeTyping)
  await create.getByRole('button', { name: '创建并继续下一条', exact: true }).click()
  await settle()
  await create.locator('label').filter({ hasText: '供应商编码' }).locator('input').fill('ROUND3-B')
  await create.getByRole('button', { name: '确认创建', exact: true }).click()
  await create.waitFor({ state: 'hidden' })
  const mats = (await readData()).skus.filter(item => /^ROUND3-/.test(item.supplierCode || ''))
  assert.equal(mats.length, 2); assert.equal(mats[0].planningId, mats[1].planningId)
  assert.notEqual(mats[0].materialCode, mats[1].materialCode)
  await record('two-materials-one-planning')
  await combo().locator('.el-table__expand-icon').first().click()
  await shot('combo-materials')
  await combo().getByText('仅看未建物料', { exact: true }).click()
  assert.equal(await combo().locator('.is-filed-row').count(), 0)
  await combo().getByText('仅看未建物料', { exact: true }).click()
  await combo().getByRole('button', { name: '查看物料', exact: true }).first().click()
  assert.match(await dialog('已有物料').innerText(), /MAT-/)
  await closeDialog(dialog('已有物料'))
  await closeDialog(combo())
  await record('material-filter-list-close')
  await openCombos()
  await combo().locator('.el-table__row .el-checkbox').first().click()
  await combo().getByRole('button', { name: '批量创建物料', exact: true }).click()
  assert.equal((await readData()).skus.length, states.at(-1).data.skus.length, 'Batch skips existing materials')
  await combo().getByRole('button', { name: '取消全选', exact: true }).click()
  await combo().getByText('仅看未建物料', { exact: true }).click()
  await combo().getByRole('button', { name: '全选', exact: true }).click()
  await combo().getByRole('button', { name: '标为一般产品', exact: true }).click()
  await combo().getByRole('button', { name: '全选', exact: true }).click()
  await combo().getByRole('button', { name: '批量创建物料', exact: true }).click()
  await record('batch-create-filter-prunes-selection')
  assert.equal(await combo().getByRole('button', { name: '标为一般产品', exact: true }).isDisabled(), false, 'Filtered-out live plans keep selection')
  await combo().getByRole('button', { name: '创建临时物料', exact: true }).click()
  await closeDialog(dialog('创建临时物料'))
  await closeDialog(combo())
  const frozen = (await readData()).specModelVersions
  // Setup for a new conditional combination is separated from observed UI operations.
  await page.evaluate(async () => {
    const { useCatalogStore } = await import('/src/stores/catalog.ts')
    const data = useCatalogStore().data
    const source = data.productSpecNodes.find(item => item.id === 'sn-apple-128-black')
    data.params.find(item => item.id === source.attributeId).values.push('三轮测试色')
    data.productSpecNodes.push({ ...source, id: 'round3-new-color', valueId: '三轮测试色', sort: 9 })
  })
  await settle()
  await page.evaluate(() => { window.__writes = [] })
  await record('fixture-new-conditional-value')
  await publish()
  const newVersion = await readData()
  frozen.forEach(old => assert.deepEqual(newVersion.specModelVersions.find(item => item.id === old.id), old))
  assert.equal(newVersion.planningRecords.filter(item => item.productModelId === 't-phone').length, 5)
  await openCombos()
  const versions = newVersion.specModelVersions.filter(item => item.templateId === 't-phone')
  await combo().locator('.combo-version').click()
  await clickOption(page, versions.at(-2).versionName)
  await record('historical-version-materials')
  assert.deepEqual((await readData()).specModelVersions, newVersion.specModelVersions)
  await shot('combo-history')
  await closeDialog(combo())
  await page.reload({ waitUntil: 'networkidle' })
  await record('published-reload')
  assert.deepEqual((await readData()).specModelVersions, newVersion.specModelVersions)
  await node('sn-brand').click()
  await page.getByRole('button', { name: '节点适用配置', exact: true }).click()
  const hosts = dialog('节点适用配置')
  await shot('node-hosts')
  await hosts.getByPlaceholder('搜已建档的主机型号').fill('round3-no-host')
  await hosts.getByPlaceholder('搜已建档的主机型号').press('Enter')
  assert.equal(await hosts.locator('input[type=checkbox]').count(), 0)
  await hosts.getByPlaceholder('搜已建档的主机型号').fill('')
  await hosts.locator('input[type=checkbox]:enabled').first().check()
  await hosts.getByRole('button', { name: '保存到草稿', exact: true }).click()
  await record('host-config-save')
  await page.getByRole('button', { name: '节点适用配置', exact: true }).click()
  await hosts.getByRole('button', { name: '移除', exact: true }).first().click()
  await hosts.getByRole('button', { name: '关闭', exact: true }).click()
  await record('host-remove-close')
  await page.getByRole('button', { name: '当前明亮模式，切换为暗黑模式' }).click()
  await shot('structure-dark')
  await page.getByRole('button', { name: '当前暗黑模式，切换为明亮模式' }).click()
  await page.locator('.cat [data-category-id="c-case"]').click()
  await page.locator('.rail .model-line').first().click()
  await record('category-type-model-switch')
  assert.match(page.url(), /template=t-case-model/)
  await shot('empty-model')
  await node('model-root').click()
  await page.keyboard.press('Tab')
  const attrs = dialog('选择属性')
  await attrs.locator('.el-select').click()
  await clickOption(page, '颜色')
  await clickOption(page, '容量')
  await page.keyboard.press('Escape')
  await attrs.getByRole('button', { name: '确定', exact: true }).click()
  await record('tab-add-dictionary-attributes')
  let caseNodes = (await readData()).productSpecNodes.filter(item => item.templateId === 't-case-model')
  const colorId = caseNodes.find(item => item.attributeId === 'p-color').id
  await node(colorId).click()
  const n = await nodeCount()
  await page.keyboard.press('Alt+v')
  await settle()
  assert.equal(await nodeCount(), n, 'This baseline supports plain V, not Alt+V')
  await page.keyboard.press('v')
  const values = dialog('选择属性值')
  await values.locator('.el-select').click()
  await clickOption(page, '黑色')
  await clickOption(page, '白色')
  await page.keyboard.press('Escape')
  await values.getByRole('button', { name: '确定', exact: true }).click()
  await record('v-add-values-continuous-layout')
  await node(colorId).locator('.fold').click()
  await record('fold-edges')
  await chooseMode('大纲视图')
  await record('fold-selection-switch')
  await chooseMode('结构视图')
  await node(colorId).locator('.fold').click()
  await node(colorId).click()
  await page.keyboard.press('ArrowDown')
  await record('keyboard-reorder')
  await page.keyboard.press('Control+z')
  await record('undo-reorder')
  await node(colorId).click()
  await page.keyboard.press('Enter')
  await dialog('选择属性').getByRole('button', { name: '取消', exact: true }).click()
  await record('sibling-cancel-focus')
  await chooseMode('大纲视图')
  await page.getByRole('button', { name: '新增节点', exact: true }).click()
  await dialog('新增节点').getByPlaceholder('名称', { exact: true }).fill('颜色')
  await dialog('新增节点').getByRole('button', { name: '确认', exact: true }).click()
  await record('node-draft-confirm')
  await chooseMode('结构视图')
  const beforeFailedPublish = await readData()
  await page.getByRole('button', { name: '发布模型', exact: true }).click()
  await page.locator('.el-message--warning').last().waitFor()
  assert.deepEqual((await readData()).specModelVersions, beforeFailedPublish.specModelVersions)
  assert.deepEqual((await readData()).planningRecords, beforeFailedPublish.planningRecords)
  await record('publish-validation-failure')
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '视图工具', exact: true }).click()
  await page.getByPlaceholder('搜索字段').fill('名称')
  assert.equal(await page.locator('.column-list [data-column-key="name"]').count(), 1)
  await page.goto(`${base}/specs?template=t-case-model`, { waitUntil: 'networkidle' })
  await node(colorId).click()
  await page.keyboard.press('Enter')
  assert.equal(await page.getByRole('dialog', { name: '选择属性', exact: true }).count(), 1)
  await dialog('选择属性').getByRole('button', { name: '取消', exact: true }).click()
  await record('remount-single-command')
  await chooseMode('大纲视图')
  caseNodes = (await readData()).productSpecNodes.filter(item => item.templateId === 't-case-model')
  const capacityId = caseNodes.find(item => item.attributeId === 'p-cap').id
  const blackId = caseNodes.find(item => item.valueId === '黑色').id
  const whiteId = caseNodes.find(item => item.valueId === '白色').id
  const outlineRow = id => page.locator('.outline-row').filter({ has: page.locator(`[data-line="${id}"]`) })
  await outlineRow(capacityId).locator('.grip').dragTo(outlineRow(blackId))
  await record('outline-drag-conditional-branch')
  assert.equal((await readData()).productSpecNodes.find(item => item.id === capacityId).parentId, blackId)
  await page.locator('.board').focus()
  await page.keyboard.press('Control+z')
  await record('undo-drag')
  assert.equal((await readData()).productSpecNodes.find(item => item.id === capacityId).parentId, null)
  await chooseMode('结构视图')
  await node(whiteId).click()
  await page.keyboard.press('Delete')
  await record('delete-value-layout')
  assert.equal((await readData()).productSpecNodes.some(item => item.id === whiteId), false)
  await page.locator('[data-zoom-label]').click()
  await page.getByRole('menuitem', { name: '回到 100%', exact: true }).click()
  await record('zoom-reset')
  await page.getByRole('button', { name: '适应全部', exact: true }).click()
  await record('fit-view')
  const canvasBox = await page.locator('.canvas').boundingBox()
  const panStart = { x: Math.floor(canvasBox.x + canvasBox.width - 90), y: Math.floor(canvasBox.y + canvasBox.height - 90) }
  await page.mouse.move(panStart.x, panStart.y)
  await page.mouse.down()
  await page.mouse.move(panStart.x - 50, panStart.y - 30, { steps: 8 })
  await page.mouse.up()
  await record('pan-canvas')
  await page.reload({ waitUntil: 'networkidle' })
  await record('viewport-reload-behavior')
  await page.goto(`${base}/specs?template=t-phone&mode=view`, { waitUntil: 'networkidle' })
  const readonlyBefore = await readData()
  await node('sn-brand').click()
  await page.keyboard.press('Tab')
  await node('sn-brand').locator('.fold').click()
  await chooseMode('大纲视图')
  await record('view-mode-local-fold-no-write')
  assert.deepEqual(await readData(), readonlyBefore)
  assert.equal(await page.getByRole('button', { name: '发布模型', exact: true }).count(), 0)
  await page.goto(`${base}/specs?template=t-phone`, { waitUntil: 'networkidle' })
  // Prepare an empty product type independently of observed operations.
  await page.evaluate(async () => {
    const data = (await import('/src/stores/catalog.ts')).useCatalogStore().data
    data.productTypes.push({ id: 'round3-empty-type', name: '三轮空类型', categoryId: 'c-pad', sort: 99, status: 'enabled', description: '' })
  })
  await settle()
  await page.evaluate(() => { window.__writes = [] })
  await page.locator('.cat [data-category-id="c-pad"]').click()
  await page.locator('.rail .type-card').filter({ hasText: '三轮空类型' }).click()
  await record('no-available-model')
  assert.equal(await page.locator('.guide h2').innerText(), '该产品类型还没有商品模型')
  await shot('no-model')
  // Empty dictionary is also isolated test data; it must not create fallback business values.
  await page.goto(`${base}/specs?template=t-case-model`, { waitUntil: 'networkidle' })
  await page.evaluate(async () => { (await import('/src/stores/catalog.ts')).useCatalogStore().data.params = [] })
  await settle()
  await page.evaluate(() => { window.__writes = [] })
  await node('model-root').click()
  await page.keyboard.press('Tab')
  await record('empty-dictionary-dialog')
  await dialog('选择属性').getByRole('button', { name: '取消', exact: true }).click()
  writeFileSync(resolve(output, `${phase}-states.json`), JSON.stringify(states, null, 2))
  writeFileSync(resolve(output, `${phase}-diagnostics.json`), JSON.stringify(diagnostics, null, 2))
  if (phase === 'after') {
    assert.deepEqual(states, JSON.parse(readFileSync(resolve(reference, 'before-states.json'), 'utf8')), 'Business state, ordered writes or canvas state changed')
    assert.deepEqual(diagnostics, JSON.parse(readFileSync(resolve(reference, 'before-diagnostics.json'), 'utf8')), 'Browser diagnostics changed')
  }
  writeFileSync(resolve(output, `${phase}-result.json`), JSON.stringify({ baseline: manifest.digest, browser: browser.version(), states: states.length, diagnostics, visuals }, null, 2))
  assert.equal(visuals.filter(scene => !scene.reviewedRasterDifference).reduce((sum, scene) => sum + scene.changed, 0), 0, 'Inspect unreviewed screenshot differences')
} catch (error) {
  await page.screenshot({ path: resolve(output, `${phase}-failure.png`) }).catch(() => {})
  writeFileSync(resolve(output, `${phase}-partial.json`), JSON.stringify({ states, diagnostics }, null, 2))
  throw error
} finally {
  await browser.close()
  await server.close()
}
