import assert from 'node:assert/strict'
import { captureEditor, editorEntry, prepareEditorUndo } from '../src/domain/editorHistory'
import { functionalGapsFixture } from './functional-gaps-fixture'
import type { AppData } from '../src/domain/types'
import { rebindSpecNode } from '../src/domain/outlineEdit'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { useCatalogStore } from '../src/stores/catalog'
const checks: string[] = []
function fixture() {
  const { data } = functionalGapsFixture()
  data.templates.push({ id: 'b', name: 'B', parentId: null, enabled: true, structureOrder: [] })
  return data
}
function apply(data: AppData, candidate: ReturnType<typeof prepareEditorUndo>) {
  assert(candidate.ok)
  data.productSpecNodes = candidate.nodes
  data.templateParams = candidate.bindings
  data.params = candidate.params
}
{
  const data = fixture(), before = captureEditor(data, 'gaps-model')
  data.productSpecNodes.find(n => n.id === 'g-cap')!.sort = 9
  const entry = editorEntry('gaps-model', 1, before, captureEditor(data, 'gaps-model'))!
  const unchanged = JSON.stringify(data)
  assert(!prepareEditorUndo(data, entry, 'b', 1).ok)
  assert(!prepareEditorUndo(data, entry, 'gaps-model', 2).ok)
  assert.equal(JSON.stringify(data), unchanged)
  data.params.push({ id: 'later', name: '后来新增', values: [], valueGroups: [], participateInStructure: true })
  data.params.find(p => p.id === 'gaps-color')!.name = '后来改名'
  data.templateParams.push({ templateId: 'b', paramId: 'later', role: 'variant', required: false })
  data.productSpecNodes.push({ id: 'b-node', templateId: 'b', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'later', valueId: '', sort: 1 })
  const untouched = JSON.stringify([data.params, data.templateParams, data.productSpecNodes.filter(n => n.templateId === 'b'), data.specModelVersions])
  apply(data, prepareEditorUndo(data, entry, 'gaps-model', 1))
  assert.equal(JSON.stringify([data.params, data.templateParams, data.productSpecNodes.filter(n => n.templateId === 'b'), data.specModelVersions]), untouched)
  assert.equal(data.productSpecNodes.find(n => n.id === 'g-cap')!.sort, 1)
  checks.push('model/session rejection atomic; unrelated later dictionary, B bindings/nodes and published snapshots preserved')
}
{
  const data = fixture(), before = captureEditor(data, 'gaps-model')
  data.params.push({ id: 'new', name: '同名', values: ['新值'], valueGroups: [], participateInStructure: true })
  data.productSpecNodes.push({ id: 'new-node', templateId: 'gaps-model', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'new', valueId: '', sort: 3 })
  data.templateParams.push({ templateId: 'gaps-model', paramId: 'new', role: 'variant', required: false })
  const entry = editorEntry('gaps-model', 1, before, captureEditor(data, 'gaps-model'))!
  assert.equal(entry.dictionary.length, 1)
  data.templateParams.push({ templateId: 'b', paramId: 'new', role: 'variant', required: false })
  const conflict = JSON.stringify(data)
  assert(!prepareEditorUndo(data, entry, 'gaps-model', 1).ok)
  assert.equal(JSON.stringify(data), conflict)
  data.templateParams.pop()
  data.params.push({ id: 'same-name', name: '同名', values: [], valueGroups: [], participateInStructure: true })
  const safe = prepareEditorUndo(data, entry, 'gaps-model', 1)
  assert(safe.ok)
  assert(safe.params.some(p => p.id === 'same-name'))
  assert(!safe.params.some(p => p.id === 'new'))
  assert(!safe.nodes.some(n => n.id === 'new-node'))
  checks.push('new shared dictionary refuses atomically; same entry succeeds after reference removed; same-name ID preserved')
}
{
  const data = fixture()
  data.params.push({ id: 'own', name: '原名称', values: ['原值'], valueGroups: [], participateInStructure: true })
  const before = captureEditor(data, 'gaps-model')
  data.params.find(p => p.id === 'own')!.name = '新名称'
  data.params.find(p => p.id === 'own')!.values.push('新增值')
  const entry = editorEntry('gaps-model', 1, before, captureEditor(data, 'gaps-model'))!
  const result = prepareEditorUndo(data, entry, 'gaps-model', 1)
  assert(result.ok)
  assert.equal(result.params.find(p => p.id === 'own')!.name, '原名称')
  assert.deepEqual(result.params.find(p => p.id === 'own')!.values, ['原值'])
  data.params.find(p => p.id === 'own')!.name = '后续修改'
  assert(!prepareEditorUndo(data, entry, 'gaps-model', 1).ok)
  checks.push('rename/value creation really undone by ID; later mutation refuses')
}
{
  const data = fixture(), before = captureEditor(data, 'gaps-model')
  data.productSpecNodes = data.productSpecNodes.filter(n => n.id !== 'g-cap-0')
  const entry = editorEntry('gaps-model', 1, before, captureEditor(data, 'gaps-model'))!
  data.params.find(p => p.id === 'gaps-cap')!.values = ['2GB']
  assert(!prepareEditorUndo(data, entry, 'gaps-model', 1).ok)
  data.params.find(p => p.id === 'gaps-cap')!.values.unshift('1GB')
  data.productSpecNodes.push({ ...before.nodes.find(n => n.id === 'g-cap-0')!, templateId: 'b' })
  assert(!prepareEditorUndo(data, entry, 'gaps-model', 1).ok)
  checks.push('deleted-node restoration rejects missing values and global ID collision')
}
{
  const data = fixture()
  const before = captureEditor(data, 'gaps-model')
  data.productSpecNodes.find(n => n.id === 'g-cap')!.positionX = 987
  data.productSpecNodes.find(n => n.id === 'g-cap')!.expanded = false
  assert.equal(editorEntry('gaps-model', 1, before, captureEditor(data, 'gaps-model')), undefined)
  data.params.push({ id: 'alias', name: '同容量另一个 ID', values: ['1GB', '2GB'], valueGroups: [], participateInStructure: true })
  data.productSpecNodes.push({ id: 'b-alias', templateId: 'b', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'alias', valueId: '', sort: 1 })
  const start = captureEditor(data, 'gaps-model')
  assert(rebindSpecNode(data, 'g-cap', { attributeId: 'alias' }).ok)
  const entry = editorEntry('gaps-model', 1, start, captureEditor(data, 'gaps-model'))!
  const result = prepareEditorUndo(data, entry, 'gaps-model', 1)
  assert(result.ok)
  assert.equal(result.nodes.find(n => n.id === 'g-cap-0')!.attributeId, 'gaps-cap')
  assert.equal(result.nodes.find(n => n.id === 'b-alias')!.attributeId, 'alias')
  const state = JSON.stringify(data)
  assert(!rebindSpecNode(data, 'g-cap', { attributeId: 'gaps-color' }).ok)
  assert.equal(JSON.stringify(data), state)
  checks.push('layout/expansion no history; legal rebind restores child references, B root does not collide; invalid rebind atomic')
}
{
  const data = fixture()
  data.nodeCompatibilityRules = [{ id: 'a-rule', templateId: 'gaps-model', nodeId: 'g-cap-0', modelVersionId: '', hosts: [], updatedAt: 'before' }]
  const before = captureEditor(data, 'gaps-model')
  data.productSpecNodes = data.productSpecNodes.filter(n => n.id !== 'g-cap-0')
  data.nodeCompatibilityRules = []
  const entry = editorEntry('gaps-model', 1, before, captureEditor(data, 'gaps-model'))!
  data.nodeCompatibilityRules.push({ id: 'b-rule', templateId: 'b', nodeId: 'b-node', modelVersionId: '', hosts: [], updatedAt: 'later' })
  const result = prepareEditorUndo(data, entry, 'gaps-model', 1)
  assert(result.ok)
  assert.deepEqual(result.nodeRules.map(r => r.id).sort(), ['a-rule', 'b-rule'])
  checks.push('delete undo restores its draft node rules without overwriting B rules')
}
{
  const restore = installCatalogTestLocks(), disk = new Map<string, string>()
  disk.set('iyge-v2-mock-db', JSON.stringify({ version: 15, data: fixture() }))
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value) } })
  setActivePinia(createPinia())
  const store = useCatalogStore()
  await store.waitForPersistence()
  const before = JSON.stringify(store.data.specCanvases)
  let current = true
  const saving = store.saveModelDraft('gaps-model', () => current)
  current = false
  assert(!(await saving).ok)
  assert.equal(JSON.stringify(store.data.specCanvases), before)
  store.$dispose(); restore()
  checks.push('queued draft save revalidates context inside persistence coordinator')
}
console.log(`PASS editor safety: ${checks.length} groups`)
