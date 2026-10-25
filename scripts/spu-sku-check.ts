import {mkdirSync,writeFileSync} from 'node:fs'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
import { installCatalogTestLocks } from './catalog-storage-test-env'
installCatalogTestLocks()
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { catalogFixture, FIXED_NOW } from './spu-sku-fixtures'
import { appendSkuBatch, editSku, previewSkuAppend, saveSpu, spuRemovalBlock, type SkuGeneration } from '../src/domain/spuSku'
import { isMaterialArchive, isRealSku } from '../src/domain/catalogIdentity'
import { ensureProductListPages, productListPageData } from '../src/domain/productListPages'
import { activeProductListView, setViewKeyword, setProductListColumnVisible } from '../src/domain/productListViews'
import { newSpuDraft } from '../src/domain/spuDraft'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
import { canAccessLocation, sanitizeMenu, MENU_KEY, defaultMenuNodes } from '../src/domain/menuConfig'
import { planSkuLines } from '../src/domain/logic'
import { accessoryCandidates } from '../src/domain/compatibility'

// Preserve undefined as well as values and array order when checking input immutability.
const clone = <T>(value: T): T => Array.isArray(value) ? value.map(item => clone(item)) as T : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T : value
const data = catalogFixture()
const original = clone(data)
let sequence = 0
const nextId = () => `appended-sku-${++sequence}`
let checks = 0
const checkNames:string[]=[]
function pass(name: string) { checkNames.push(name);console.log(`PASS spu-sku ${++checks} ${name}`) }
const manual = (color: string): SkuGeneration => ({ kind: 'manual', rows: [{ code: '', oaSkuId: '', skuName: '同名 SKU', status: 'draft', variantAttrs: { 颜色: color } }] })
function append(id: string, generation: SkuGeneration, selectedKeys?: string[]) {
  const preview = previewSkuAppend(data, id, generation)
  return appendSkuBatch(data, { familyId: id, generation, selectedKeys: selectedKeys || preview.rows.filter(row => row.state === 'new').map(row => row.key), now: FIXED_NOW, nextId })
}
const empty = { ...newSpuDraft(data, { categoryId: 'c-film' }), id: 'empty', name: '空 SPU' }
assert.equal(saveSpu(data, empty, FIXED_NOW).ok, true)
assert.deepEqual(data.skus, original.skus)
assert.ok(data.families.some(item => item.id === 'empty'))
pass('保存空 SPU 不创建或删除任何子记录')
const beforePreview = clone(data)
assert.ok(previewSkuAppend(data, 'missing', manual('蓝色')).problem)
assert.ok(previewSkuAppend(data, 'empty', manual('蓝色')).problem)
const firstPreview = previewSkuAppend(data, 'test-template-spu', manual('蓝色'))
assert.equal(firstPreview.rows[0]?.state, 'new')
assert.deepEqual(data, beforePreview)
assert.equal(sequence, 0)
pass('缺失主体或方案明确失败；预览只读且不分配 ID')
const first = append('test-template-spu', manual('蓝色'))
assert.ok(first.ok && first.ids.length === 1)
const beforeSecond = clone(data.skus)
const generated: SkuGeneration = { kind: 'template', selections: { 颜色: ['蓝色', '白色', '黑色'] } }
const preview = previewSkuAppend(data, 'test-template-spu', generated)
assert.deepEqual(preview.rows.map(row => row.state), ['existing', 'new', 'new'])
assert.ok(append('test-template-spu', generated).ok)
assert.deepEqual(data.skus.slice(0, beforeSecond.length), beforeSecond)
pass('多次追加保留旧记录顺序；模板批量区分新增和已有')
const beforeRepeat = clone(data)
const calls = sequence
assert.deepEqual(append('test-template-spu', generated), { ok: true, ids: [], skipped: 0 })
assert.deepEqual(data, beforeRepeat); assert.equal(sequence, calls)
const rows = manual('橙色').rows!
const duplicates = previewSkuAppend(data, 'test-template-spu', { kind: 'manual', rows: [...rows, ...clone(rows)] })
assert.deepEqual(duplicates.rows.map(row => row.state), ['new', 'existing'])
pass('重复来源、重复点击和批内重复均幂等；无新增不写入')
const invalid: SkuGeneration = { kind: 'manual', rows: [...rows, ...manual('').rows!] }
const invalidPreview = previewSkuAppend(data, 'test-template-spu', invalid)
assert.deepEqual(invalidPreview.rows.map(row => row.state), ['new', 'invalid'])
assert.equal(append('test-template-spu', invalid, invalidPreview.rows.map(row => row.key)).ok, false)
assert.deepEqual(data, beforeRepeat)
assert.equal(append('test-template-spu', generated, ['stale-key']).ok, false)
pass('提交重验无效或过期候选，全批拒绝且保留输入数据')
const another = { ...clone(data.families.find(item => item.id === 'test-template-spu')!), id: 'another', name: '另一个同名规格主体' }
assert.equal(saveSpu(data, another, FIXED_NOW).ok, true)
assert.ok(append('another', manual('蓝色')).ok)
assert.equal(data.skus.filter(item => item.skuName === '同名 SKU').length, 2)
pass('按 SPU 内规格身份去重，名称不参与，跨 SPU 不互斥')
const firstSku = data.skus.find(item => item.id === (first.ok ? first.ids[0] : ''))!
const siblings = clone(data.skus.filter(item => item.id !== firstSku.id))
assert.equal(editSku(data, firstSku.id, { ...firstSku, skuName: '已编辑' }, FIXED_NOW).ok, true)
assert.deepEqual(data.skus.filter(item => item.id !== firstSku.id), siblings)
assert.equal(editSku(data, firstSku.id, { ...firstSku, variantAttrs: { 颜色: '白色' } }, FIXED_NOW).ok, false)
pass('单 SKU 编辑不影响同级或 MAT，编辑规格也检查重复')
const family = data.families.find(item => item.id === 'test-template-spu')!
const children = clone(data.skus)
assert.equal(saveSpu(data, { ...family, name: '改名后的 SPU' }, FIXED_NOW).ok, true)
assert.equal(saveSpu(data, { ...family, commonAttrs: { 品牌: '不同品牌' } }, FIXED_NOW).ok, false)
assert.deepEqual(data.skus, children)
assert.match(spuRemovalBlock(data, family.id), /不会级联删除/)
pass('SPU 公共信息单独保存；有子记录时锁定身份并阻止删除')
const modelPreview = previewSkuAppend(data, 'test-model-spu', { kind: 'model' })
assert.equal(modelPreview.problem, '')
assert.deepEqual(modelPreview.rows.map(row => row.draft.variantAttrs), [{ 容量: '128G', 颜色: '黑色' }, { 容量: '128G', 颜色: '白色' }, { 容量: '256G', 颜色: '白色' }])
assert.equal(modelPreview.rows.every(row => row.state === 'new'), true)
pass('绑定模型按实际条件分支展开，保持顺序且没有 256G 黑色')
const planA: SkuGeneration = { kind: 'plan', planId: 'test-plan-a' }
const planRows = previewSkuAppend(data, 'test-model-spu', planA)
assert.deepEqual(planRows.rows.map(row => row.draft.variantAttrs), planSkuLines(data, data.productPlans.find(item => item.id === 'test-plan-a')!)?.skus.map(row => row.variantAttrs))
assert.ok(append('test-model-spu', planA, [planRows.rows[0]!.key]).ok)
assert.ok(append('test-model-spu', { kind: 'plan', planId: 'test-plan-b' }).ok)
const fromPlans = data.skus.filter(item => item.familyId === 'test-model-spu')
assert.deepEqual(fromPlans.map(item => item.creationSource?.productPlanId), ['test-plan-a', 'test-plan-b', 'test-plan-b'])
assert.ok(fromPlans.every(item => item.creationSource?.modelVersionId === 'phone-model-v1'))
assert.equal(data.families.find(item => item.id === 'test-model-spu')?.productPlanId, undefined)
const beforePlanRepeat = clone(data)
assert.ok(append('test-model-spu', planA).ok)
assert.deepEqual(data, beforePlanRepeat)
assert.equal(editSku(data, fromPlans[0]!.id, { ...fromPlans[0]!, variantAttrs: { 容量: '256G', 颜色: '白色' } }, FIXED_NOW).ok, false)
pass('两个规划分批追加保留逐条来源，不覆盖父级；重复执行无写入')
const version = clone(data.specModelVersions[0]!)
data.specModelVersions.push({ ...clone(version), id: 'new-version', version: 2, versionName: 'V2', nodesSnapshot: [] })
assert.equal(previewSkuAppend(data, 'test-model-spu', { kind: 'model' }).rows.length, 3)
assert.deepEqual(data.specModelVersions[0], version)
const versionFamily = data.families.find(item => item.id === 'test-model-spu')!
versionFamily.modelVersionId = 'missing-history'
assert.match(previewSkuAppend(data, versionFamily.id, { kind: 'model' }).problem, /不会自动切换/)
versionFamily.modelVersionId = version.id
pass('历史发布版本保持；失效历史版本拒绝，不回退最新')
const matFamily = data.families.find(item => item.line === 'v3')!
const beforeMats = clone(data.skus.filter(item => isMaterialArchive(data, item)))
const matPreview = previewSkuAppend(data, matFamily.id, { kind: 'model' })
assert.ok(matPreview.rows.some(row => row.state === 'new'))
assert.ok(append(matFamily.id, { kind: 'model' }).ok)
assert.equal(data.skus.filter(item => item.familyId === matFamily.id && isRealSku(data, item)).length, 3)
assert.deepEqual(data.skus.filter(item => isMaterialArchive(data, item)), beforeMats)
assert.equal(beforeMats.filter(item => item.familyId === matFamily.id).length, 2)
assert.equal(new Set(beforeMats.filter(item => item.familyId === matFamily.id).map(item => item.planningId)).size, 1)
pass('V3 主体支持显式真实 SKU，两个 MAT 仍属于同一 PLN，物料保持原样')
const legacyViews = clone(data)
delete legacyViews.productListPages
const legacy = activeProductListView(legacyViews)
legacy.mode = 'sku'; legacy.spuQuery!.keyword = 'SPU 搜索'; legacy.skuQuery!.keyword = 'SKU 搜索'
legacy.spuColumns.find(column => column.key === 'category')!.visible = false; legacy.skuColumns.find(column => column.key === 'spec')!.visible = false
legacy.manualOrder = { spuIds: ['a', 'b'], skuIds: ['c', 'd'] }
const oldViews = clone(legacyViews.productListViews)
assert.equal(ensureProductListPages(legacyViews), true)
const migrated = clone(legacyViews)
assert.equal(ensureProductListPages(legacyViews), false)
assert.deepEqual(legacyViews, migrated)
assert.deepEqual(legacyViews.productListViews, oldViews)
assert.equal(activeProductListView(productListPageData(legacyViews, 'spu')).spuQuery?.keyword, 'SPU 搜索')
assert.equal(activeProductListView(productListPageData(legacyViews, 'sku')).skuQuery?.keyword, 'SKU 搜索')
const savedSpuPage = clone(legacyViews.productListPages!.spu)
setViewKeyword(productListPageData(legacyViews, 'sku'), '仅修改 SKU')
setProductListColumnVisible(productListPageData(legacyViews, 'sku'), legacy.id, 'sku', 'category', false)
assert.deepEqual(legacyViews.productListPages!.spu, savedSpuPage)
pass('旧双模式查询/列/手工顺序均迁移；重复迁移稳定，双页设置独立')
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) }, configurable: true })
const oldRecords = clone(original)
const loaded = normalizeStored({ version: 13, data: clone(oldRecords) })!
assert.deepEqual(loaded.skus, oldRecords.skus)
assert.deepEqual(normalizeStored({ version: DATA_VERSION, data: clone(loaded) }), loaded)
assert.equal(loaded.skus.some(item => !oldRecords.skus.find(old => old.id === item.id)?.recordKind && item.recordKind), false)
pass('旧数据加载不补写记录类型、不变更 ID；持久化迁移可重复执行')
storage.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data }))
setActivePinia(createPinia())
const store = useCatalogStore(); await store.waitForPersistence()
const last = store.data.skus.find(item => item.familyId === 'another')!
assert.equal(store.removeSku(last.id), '')
assert.ok(store.data.families.some(item => item.id === 'another'))
assert.ok(store.removeFamily(matFamily.id))
assert.ok(store.data.families.some(item => item.id === matFamily.id))
assert.equal(store.removeFamily('another'), '')
await nextTick()
assert.ok(JSON.parse(storage.get(STORAGE_KEY)!).data.families.some((item: { id: string }) => item.id === 'empty'))
pass('真实 store 删除最后 SKU 保留 SPU，带物料主体拒删，空主体可删并持久化')
const storeBefore = clone(store.data)
assert.equal((await store.saveBundle({ ...store.data.families.find(item => item.id === family.id)!, name: '兼容入口改名' }, [])).ok, true)
assert.deepEqual(store.data.skus, storeBefore.skus)
const foreign = clone(store.data.skus.find(item => item.familyId !== family.id && isRealSku(store.data, item))!)
const afterName = clone(store.data)
assert.equal((await store.saveBundle(store.data.families.find(item => item.id === family.id)!, [foreign])).ok, false)
assert.deepEqual(store.data, afterName)
pass('旧 saveBundle 不再整体替换子记录；跨主体记录整批拒绝')
const beforeStale = clone(store.data)
assert.equal((await store.saveSpu({ ...empty, id: 'deleted-spu-id' })).ok, false)
assert.deepEqual(store.data, beforeStale)
const realNow = Date.now
try {
  Date.now = () => 123456789
  const stamp = Date.now().toString(36)
  const occupied = Array.from({ length: 20 }, (_, index) => `fam-${stamp}-${index + 1}`)
  store.data.families.push(...occupied.map(id => ({ ...empty, id })))
  const result = (await store.saveSpu({ ...empty, id: '', name: '碰撞后新 SPU' }))
  assert.ok(result.ok && !occupied.includes(result.id))
  assert.equal(store.data.families.filter(item => occupied.includes(item.id)).length, occupied.length)
  const tombstones = Array.from({ length: 40 }, (_, index) => `sku-${stamp}-${index + 1}`)
  await nextTick();await store.waitForPersistence()
  const receiptsBackup=JSON.parse(store.exportJson());receiptsBackup.data.materialReceipts.push(...tombstones.map(skuId => ({ requestId: `deleted-${skuId}`, skuId, planningId: '', materialCode: '', createdTime: FIXED_NOW, lifecycle: 'deleted' as const })));await store.importJson(JSON.stringify(receiptsBackup))
  const generation = manual('橙色')
  const candidate = previewSkuAppend(store.data, family.id, generation)
  const appended = (await store.appendSkus(family.id, generation, candidate.rows.map(row => row.key)))
  assert.ok(appended.ok && appended.ids.length === 1 && !tombstones.includes(appended.ids[0]!))
} finally { Date.now = realNow }
pass('固定时钟 ID 碰撞及删除回执 ID 均避让；失效 SPU 编辑不重建主体')
const legacyMenu = defaultMenuNodes().filter(item => !['page:/spus', 'page:/skus'].includes(item.id))
legacyMenu.push({ id: 'page:/products', kind: 'page', route: '/products', title: '旧管理', parentId: 'manage', sort: 4, hidden: false, roles: ['admin'] })
const menu = sanitizeMenu(legacyMenu)
assert.deepEqual(menu.filter(item => ['/spus', '/skus'].includes(item.route)).map(item => item.roles), [['admin'], ['admin']])
storage.set(MENU_KEY, JSON.stringify({ version: 1, nodes: menu }))
for (const path of ['/spus', '/skus', '/spus/new', '/skus/new', '/materials/new', '/products/old']) assert.equal(canAccessLocation('operator', path), false)
assert.equal(canAccessLocation('admin', '/skus/new'), true)
pass('菜单迁移继承旧权限；新增、旧链接和物料路由权限一致')
assert.ok(accessoryCandidates(data, 'pt-case').every(item => isMaterialArchive(data, data.skus.find(sku => sku.id === item.skuId)!)))
assert.deepEqual(data.planningRecords, original.planningRecords)
assert.deepEqual(data.materialReceipts, original.materialReceipts)
assert.deepEqual(data.specModelVersions[0], original.specModelVersions[0])
pass('业务操作不改 PLN、建档回执和发布快照')
console.log(`PASS ${checks} SPU/SKU regression groups`)

const reportDir=process.env.SPU_SKU_OUTPUT||`work/business-guide/regression/spu-sku-${RBAC_ENFORCEMENT_ENABLED?'strict':'default'}`;mkdirSync(reportDir,{recursive:true});writeFileSync(`${reportDir}/result.json`,JSON.stringify({result:'PASS',strict:RBAC_ENFORCEMENT_ENABLED,checks:checkNames},null,2)+'\n');store.$dispose()
