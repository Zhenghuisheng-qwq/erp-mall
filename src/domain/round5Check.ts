import { createPinia, setActivePinia } from 'pinia'
import { addCompatibility, linksOfHost } from './compatibility'
import { installCompatibilitySamples } from './compatibilitySamples'
import { createTemporaryMaterial, createV3Material } from './material'
import { addDraftNodeHosts, freezeDraftNodeHosts, readDraftNodeHosts, readVersionNodeHosts, traceNodeCompatibility } from './nodeCompatibility'
import { outlineChoices, rebindSpecNode } from './outlineEdit'
import { createSeed } from './seed'
import { normalizeStored, useCatalogStore } from '../stores/catalog'
import { DATA_VERSION, STORAGE_KEY, type AppData } from './types'

function boot() {
  const memory = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
      key: () => null,
      get length() { return memory.size },
    },
  })
  memory.set(STORAGE_KEY, JSON.stringify({ version: DATA_VERSION, data: createSeed() }))
  setActivePinia(createPinia())
  return useCatalogStore()
}

export function runRound5Checks() {
  const results: { group: string; id: string; ok: boolean; detail: string }[] = []
  const check = (group: string, id: string, ok: boolean, detail: string) => results.push({ group, id, ok, detail })
  const store = boot()
  const data = store.data
  const snapshotBefore = JSON.stringify(data.specModelVersions)
  const plansBefore = JSON.stringify(data.planningRecords)
  const node128 = data.productSpecNodes.find((item) => item.id === 'sn-apple-cap-128')
  const capChoices = outlineChoices(data, 'sn-apple-cap-128').map((item) => item.value)
  const attrChoices = outlineChoices(data, 'sn-apple-cap').map((item) => item.value)
  check('R5-A', 'value-choices', capChoices.includes('128G') && capChoices.includes('512G') && !capChoices.includes('256G') && !capChoices.includes('黑色'), capChoices.join(','))
  check('R5-A', 'attribute-choices', attrChoices.includes('p-cap') && attrChoices.includes('p-color') && !attrChoices.includes('128G'), attrChoices.join(','))
  const changed = rebindSpecNode(data, 'sn-apple-cap-128', { valueId: '512G' })
  check('R5-A', 'rebind-value', Boolean(changed.ok && changed.changed && node128?.valueId === '512G' && node128.attributeId === 'p-cap' && node128.id === 'sn-apple-cap-128'), `${changed.message} ${node128?.valueId}`)
  check('R5-A', 'same-tree', data.productSpecNodes.filter((item) => item.id === 'sn-apple-cap-128').length === 1, '节点没有被复制')
  check('R5-A', 'snapshot-untouched', JSON.stringify(data.specModelVersions) === snapshotBefore && JSON.stringify(data.planningRecords) === plansBefore, '快照和规划被改动')
  const duplicate = rebindSpecNode(data, 'sn-apple-cap-128', { valueId: '256G' })
  check('R5-A', 'duplicate-value', !duplicate.ok && node128?.valueId === '512G', duplicate.message)
  const forged = rebindSpecNode(data, 'sn-apple-cap-128', { valueId: '金色' })
  check('R5-A', 'illegal-value', !forged.ok && node128?.valueId === '512G', forged.message)
  const emptyAttr = rebindSpecNode(data, 'sn-apple-cap', { attributeId: '' })
  check('R5-A', 'unbound-attribute', !emptyAttr.ok && data.productSpecNodes.find((item) => item.id === 'sn-apple-cap')?.attributeId === 'p-cap', emptyAttr.message)
  const blockedAttr = rebindSpecNode(data, 'sn-apple-cap', { attributeId: 'p-color' })
  const capNode = data.productSpecNodes.find((item) => item.id === 'sn-apple-cap')
  check('R5-A', 'keep-children', !blockedAttr.ok && capNode?.attributeId === 'p-cap' && data.productSpecNodes.some((item) => item.id === 'sn-apple-cap-256' && item.valueId === '256G'), blockedAttr.message)
  data.productSpecNodes.push({ id: 'sn-extra-brand', templateId: 't-phone', parentId: null, nodeType: 'ATTRIBUTE', attributeId: 'p-color', valueId: '', sort: 9 })
  const duplicatedAttr = rebindSpecNode(data, 'sn-extra-brand', { attributeId: 'p-brand' })
  check('R5-A', 'duplicate-attribute', !duplicatedAttr.ok && data.productSpecNodes.find((item) => item.id === 'sn-extra-brand')?.attributeId === 'p-color', duplicatedAttr.message)
  const roundTrip = JSON.parse(JSON.stringify(data.productSpecNodes)) as AppData['productSpecNodes']
  check('R5-A', 'refresh-id', roundTrip.find((item) => item.id === 'sn-apple-cap-128')?.valueId === '512G', '序列化后取值丢失')

  const samples = installCompatibilitySamples(data, (prefix) => `${prefix}-r5`)
  const hostA = samples.hosts.find((item) => item.modelName === 'iPhone 17 Pro Max')
  const hostB = samples.hosts.find((item) => item.modelName === 'iPhone 18 Pro Max')
  const compatBefore = data.compatibilities.length
  const oldVersion = JSON.stringify(data.specModelVersions.find((item) => item.id === 'phone-model-v1'))
  const plan = data.planningRecords.find((item) => item.productModelId === 't-compat-sample' && item.steps.some((step) => step.valueId === 'iPhone 17 Pro Max'))
  const modelNodeId = plan?.steps.find((step) => step.valueId === 'iPhone 17 Pro Max')?.valueNodeId || ''
  const parentId = data.productSpecNodes.find((item) => item.id === modelNodeId)?.parentId || ''
  const firstAdd = hostA && hostB ? addDraftNodeHosts(data, { templateId: 't-compat-sample', nodeId: modelNodeId, hosts: [hostA.host, hostB.host], nextId: (prefix) => `${prefix}-1`, now: '2026-10-16T10:00:00.000Z' }) : { added: [], skipped: 0, failed: [{ message: '没有样例主机' }] }
  const again = hostA ? addDraftNodeHosts(data, { templateId: 't-compat-sample', nodeId: modelNodeId, hosts: [hostA.host], nextId: (prefix) => `${prefix}-2`, now: '2026-10-16T10:01:00.000Z' }) : { added: [], skipped: 0, failed: [{ message: '没有样例主机' }] }
  const fake = addDraftNodeHosts(data, { templateId: 't-compat-sample', nodeId: modelNodeId, hosts: [{ scope: 'model', productTypeId: 'pt-phone', productModelId: 'missing', identityKey: 'nope', steps: [{ attributeId: 'p-model', attributeName: '型号', valueId: '不存在' }] }], nextId: (prefix) => `${prefix}-3` })
  const stored = readDraftNodeHosts(data, 't-compat-sample', modelNodeId)
  check('R5-B', 'two-hosts', firstAdd.added.length === 2 && stored.length === 2 && stored.every((item) => item.identityKey.includes('p-model')), stored.map((item) => item.identityKey).join(' | '))
  check('R5-B', 'skip-duplicate', again.skipped === 1 && stored.length === 2, `跳过 ${again.skipped}`)
  check('R5-B', 'reject-unknown', fake.failed.length === 1 && stored.length === 2, fake.failed[0]?.message || '')
  const modelParam = data.params.find((item) => item.id === 'p-model')
  if (modelParam) modelParam.name = '型号展示'
  const afterRename = readDraftNodeHosts(data, 't-compat-sample', modelNodeId)
  check('R5-B', 'rename-stable', afterRename.length === 2 && afterRename[0]?.identityKey === stored[0]?.identityKey, afterRename[0]?.identityKey || '')
  if (modelParam) modelParam.name = '型号'
  check('R5-B', 'sku-links-unchanged', data.compatibilities.length === compatBefore, String(data.compatibilities.length))
  const phoneNode = 'sn-apple-model-17'
  if (hostA && hostB) addDraftNodeHosts(data, { templateId: 't-phone', nodeId: phoneNode, hosts: [hostA.host, hostB.host], nextId: (prefix) => `${prefix}-phone`, now: '2026-10-16T10:02:00.000Z' })
  data.productSpecNodes = data.productSpecNodes.filter((item) => item.id !== 'sn-extra-brand')
  const phoneSnapshot = JSON.stringify(data.specModelVersions.find((item) => item.id === 'phone-model-v1')?.nodesSnapshot)
  const published = store.publishSpecModel('t-phone')
  const phoneVersion = data.specModelVersions.filter((item) => item.templateId === 't-phone').slice().sort((a, b) => a.version - b.version).at(-1)
  const phoneFrozen = phoneVersion ? readVersionNodeHosts(data, phoneVersion.id, phoneNode) : []
  freezeDraftNodeHosts(data, 't-compat-sample', 't-compat-sample-v2', '2026-10-16T10:03:00.000Z', (prefix) => `${prefix}-freeze`)
  const frozen = readVersionNodeHosts(data, 't-compat-sample-v2', modelNodeId)
  check('R5-B', 'publish-copies', Boolean(published.ok && phoneVersion && phoneVersion.id !== 'phone-model-v1' && phoneFrozen.length === 2 && frozen.length === 2 && JSON.stringify(data.specModelVersions.find((item) => item.id === 'phone-model-v1')?.nodesSnapshot) === phoneSnapshot), published.message)
  const previousFrozen = JSON.stringify(frozen)
  if (hostA) addDraftNodeHosts(data, { templateId: 't-compat-sample', nodeId: parentId, hosts: [hostA.host], nextId: (prefix) => `${prefix}-parent` })
  check('R5-B', 'child-not-inherited', readDraftNodeHosts(data, 't-compat-sample', modelNodeId).length === 2 && readDraftNodeHosts(data, 't-compat-sample', parentId).length === 1, '父子配置串了')
  check('R5-B', 'frozen-stable', JSON.stringify(readVersionNodeHosts(data, 't-compat-sample-v2', modelNodeId)) === previousFrozen, '已发布副本被草稿改写')
  check('R5-B', 'old-phone-version', JSON.stringify(data.specModelVersions.find((item) => item.id === 'phone-model-v1')) === oldVersion && readVersionNodeHosts(data, 'phone-model-v1', modelNodeId).length === 0, '旧手机版本被带动')
  data.productSpecNodes.push({ id: 'sn-r5-extra', templateId: 't-compat-sample', parentId: modelNodeId, nodeType: 'ATTRIBUTE', attributeId: 'p-color', valueId: '', sort: 9 })
  if (hostA) addDraftNodeHosts(data, { templateId: 't-compat-sample', nodeId: 'sn-r5-extra', hosts: [hostA.host], nextId: (prefix) => `${prefix}-extra` })
  const removed = store.removeSpecNode('sn-r5-extra')
  check('R5-B', 'delete-draft-only', removed === '' && readDraftNodeHosts(data, 't-compat-sample', 'sn-r5-extra').length === 0 && readVersionNodeHosts(data, 't-compat-sample-v2', modelNodeId).length === 2 && readDraftNodeHosts(data, 't-compat-sample', modelNodeId).length === 2, removed || '草稿已清，版本副本还在')
  const trace = traceNodeCompatibility(data, 't-compat-sample', modelNodeId)
  let materialSeq = 0
  const materialId = (prefix: string) => `${prefix}-mat-${++materialSeq}`
  const madeA = plan ? createV3Material(data, { productModelId: 't-compat-sample', modelVersionId: 't-compat-sample-v1', planningId: plan.planningId, requestId: 'film-plan-a', categoryId: 'c-phone', productTypeId: 'pt-phone', now: '2026-10-16T11:00:00.000Z', nextId: materialId }) : { ok: false as const, message: '没有规划' }
  const madeB = plan ? createV3Material(data, { productModelId: 't-compat-sample', modelVersionId: 't-compat-sample-v1', planningId: plan.planningId, requestId: 'film-plan-b', categoryId: 'c-phone', productTypeId: 'pt-phone', now: '2026-10-16T11:01:00.000Z', nextId: materialId }) : { ok: false as const, message: '没有规划' }
  const traced = traceNodeCompatibility(data, 't-compat-sample', modelNodeId)
  check('R5-B', 'trace-two-materials', Boolean(madeA.ok && madeB.ok && traced.materials.length === 2 && traced.materials.every((item) => item.inherited === false && item.directLinkCount === 0) && traced.inheritance === 'unconfirmed' && traced.planningIds.includes(plan?.planningId || '')), `${traced.materials.length} 条，继承 ${traced.inheritance}`)
  if (madeA.ok) {
    const sku = data.skus.find((item) => item.id === madeA.skuId)
    const family = sku && data.families.find((item) => item.id === sku.familyId)
    if (family) family.productTypeId = 'pt-case'
  }
  const hostForLink = hostA?.host
  const linked = madeA.ok && hostForLink ? addCompatibility(data, { accessorySkuIds: [madeA.skuId], hosts: [hostForLink], nextId: (prefix) => `${prefix}-link` }) : { created: [], skipped: 0, failed: [{ message: madeA.ok ? '没有主机' : madeA.message }] }
  const afterLink = traceNodeCompatibility(data, 't-compat-sample', modelNodeId)
  const direct = madeA.ok ? afterLink.materials.find((item) => item.skuId === madeA.skuId) : undefined
  const other = madeB.ok ? afterLink.materials.find((item) => item.skuId === madeB.skuId) : undefined
  check('R5-B', 'direct-separate', Boolean(linked.created.length === 1 && direct?.directLinkCount === 1 && direct.inherited === false && other?.directLinkCount === 0), `直接 ${direct?.directLinkCount} / ${other?.directLinkCount}`)
  const visible = hostForLink ? linksOfHost(data, hostForLink).length : 0
  check('R5-B', 'query-stays-sku', visible === 1 && data.nodeCompatibilityRules.some((item) => item.modelVersionId === ''), `查询 ${visible} 条`)
  const rulesBeforeTemp = data.nodeCompatibilityRules.length
  const temp = createTemporaryMaterial(data, { requestId: 'r5-tmp', categoryId: 'c-watch', productTypeId: data.productTypes.find((item) => item.categoryId === 'c-watch')?.id || '', attrs: [{ attributeId: 'p-brand', value: '临时', source: 'manual' }], materialCode: 'R5-TMP-1', now: '2026-10-16T12:00:00.000Z', nextId: (prefix) => `${prefix}-tmp` })
  check('R5-B', 'temporary-no-rule', Boolean(temp.ok && data.nodeCompatibilityRules.length === rulesBeforeTemp), temp.ok ? temp.materialCode : temp.message)
  const fresh = createSeed()
  delete (fresh as Partial<AppData>).nodeCompatibilityRules
  const migrated = normalizeStored({ version: 12, data: fresh })
  check('R5-B', 'old-data-readable', Boolean(migrated && migrated.nodeCompatibilityRules.length === 0 && migrated.specModelVersions.some((item) => item.id === 'phone-model-v1') && migrated.productSpecNodes.some((item) => item.id === 'sn-brand-apple' && item.valueId === 'Apple')), migrated ? '可读' : '读取失败')
  check('R5-A', 'trace-before-material', trace.materials.length === 0 && trace.draftHosts.length === 2, '建档前不应已经有物料')
  return results
}
