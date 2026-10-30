import { installCatalogTestLocks } from '../../scripts/catalog-storage-test-env'
installCatalogTestLocks()
import { createPinia, setActivePinia } from 'pinia'
import { outlineChoices, rebindSpecNode } from './outlineEdit'
import { createSeed } from './seed'
import { useCatalogStore } from '../stores/catalog'
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

export async function runRound5Checks() {
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

  return results
}
