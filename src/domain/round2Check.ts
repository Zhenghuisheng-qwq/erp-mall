import { installCatalogTestLocks } from '../../scripts/catalog-storage-test-env'
installCatalogTestLocks()
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { listHostModels } from './compatibility'
import { createTemporaryMaterial, createV3Material, temporaryAttributeFields } from './material'
import { createSeed } from './seed'
import { useCatalogStore } from '../stores/catalog'
import { DATA_VERSION, STORAGE_KEY } from './types'

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

export async function runRound2Checks() {
  const results: { id: string; ok: boolean; detail: string }[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const store = boot()
  const snapshotBefore = JSON.stringify(store.data.specModelVersions)
  const plansBefore = store.data.productPlans.map((item) => item.id).join()
  const v2Sku = store.data.skus.find((item) => item.id === 's-iphone-blue')
  const dictBefore = store.data.params.map((item) => `${item.id}:${item.values.join(',')}`).join('|')
  const published = (await store.publishSpecModel('t-phone'))
  const apple = store.data.planningRecords.find((item) => item.productModelId === 't-phone' && item.status === 'active' && item.steps.some((step) => step.valueId === 'Apple') && item.steps.some((step) => step.valueId === '黑色'))
  const huawei = store.data.planningRecords.find((item) => item.productModelId === 't-phone' && item.status === 'active' && item.steps.some((step) => step.valueId === '华为'))
  let seq = 0
  const nextId = (prefix: string) => `${prefix}-r2-${++seq}`
  const input = (planningId: string, requestId: string) => ({
    productModelId: 't-phone',
    modelVersionId: 'phone-model-v1',
    planningId,
    requestId,
    categoryId: 'c-phone',
    productTypeId: 'pt-phone',
    now: '2026-10-16T08:00:00.000Z',
    nextId,
  })
  const first = apple ? createV3Material(store.data, input(apple.planningId, 'designer-a')) : { ok: false as const, message: '没有苹果规划' }
  const second = apple ? createV3Material(store.data, input(apple.planningId, 'list-b')) : { ok: false as const, message: '没有苹果规划' }
  const replay = apple ? createV3Material(store.data, input(apple.planningId, 'designer-a')) : { ok: false as const, message: '没有苹果规划' }
  const linked = store.data.skus.filter((item) => item.planningId === apple?.planningId)
  check('same-plan-two-materials', Boolean(published.ok && first.ok && first.created && second.ok && second.created && first.planningId === second.planningId && first.skuId !== second.skuId && first.materialCode !== second.materialCode && linked.length === 2 && replay.ok && !replay.created && replay.skuId === first.skuId), `A ${first.ok ? first.materialCode : first.message} B ${second.ok ? second.materialCode : second.message} 规划 ${apple?.planningId || ''}`)
  const removed = first.ok ? store.removeSku(first.skuId) : '没有物料'
  const planAfterDelete = store.data.planningRecords.find((item) => item.planningId === apple?.planningId)
  const left = store.data.skus.filter((item) => item.planningId === apple?.planningId)
  check('delete-keeps-plan', removed === '' && planAfterDelete?.status === 'active' && left.length === 1 && left[0]?.id === (second.ok ? second.skuId : ''), `${removed || '已删除'} 剩余 ${left.map((item) => item.materialCode).join(',')}`)
  if (second.ok) {
    store.data.compatibilities.push({ id: 'compat-r2', accessorySkuId: second.skuId, host: { scope: 'model', productTypeId: 'pt-phone', productModelId: 't-phone', identityKey: 'r2', steps: [] }, note: '', createdAt: '2026-10-16T08:01:00.000Z', updatedAt: '2026-10-16T08:01:00.000Z' })
  }
  const blocked = second.ok ? store.removeSku(second.skuId) : '没有第二条'
  check('compat-blocks', blocked.includes('不能删除') && store.data.skus.some((item) => item.id === (second.ok ? second.skuId : '')), blocked)
  const hosts = listHostModels(store.data)
  const appleHost = hosts.find((item) => item.modelName === 'iPhone 17')
  const mateHost = hosts.find((item) => item.series === 'Mate' || item.modelName === 'Mate')
  const huaweiMade = huawei ? createV3Material(store.data, input(huawei.planningId, 'huawei-file')) : { ok: false as const, message: '没有华为规划' }
  check('huawei-identity-gap', Boolean(huawei && !huawei.steps.some((step) => step.attributeName === '型号') && huawei.steps.some((step) => step.attributeName === '系列' && step.valueId === 'Mate') && !mateHost && appleHost && huaweiMade.ok), `主机清单 ${hosts.map((item) => item.modelName || item.label).join('、') || '空'}；华为建档 ${huaweiMade.ok ? huaweiMade.materialCode : huaweiMade.message}`)
  const watchType = store.data.productTypes.find((item) => item.categoryId === 'c-watch')
  const fields = watchType ? temporaryAttributeFields(store.data, { categoryId: 'c-watch', productTypeId: watchType.id }) : []
  const versionsBeforeTemp = JSON.stringify(store.data.specModelVersions)
  const plnBefore = store.data.planningRecords.filter((item) => item.planningId.startsWith('PLN-')).map((item) => item.planningId).sort().join()
  const temp = watchType && fields[0] ? createTemporaryMaterial(store.data, {
    requestId: 'watch-tmp',
    categoryId: 'c-watch',
    productTypeId: watchType.id,
    attrs: [{ attributeId: fields[0].attributeId, value: '临时经营值', source: 'manual' }],
    materialCode: 'WATCH-TMP-9001',
    now: '2026-10-16T09:00:00.000Z',
    nextId,
  }) : { ok: false as const, message: '没有手表类型或属性' }
  const tempSku = temp.ok ? store.data.skus.find((item) => item.id === temp.skuId) : undefined
  const tempPlan = store.data.planningRecords.find((item) => item.planningId === tempSku?.planningId)
  const plnAfter = store.data.planningRecords.filter((item) => item.planningId.startsWith('PLN-')).map((item) => item.planningId).sort().join()
  check('temp-without-published-model', Boolean(temp.ok && temp.created && temp.planningId.startsWith('TMP-') && tempPlan?.origin === 'temporary' && !tempPlan.modelVersionId && fields.length > 0 && plnAfter === plnBefore && JSON.stringify(store.data.specModelVersions) === versionsBeforeTemp && !store.data.params.some((item) => item.values.includes('临时经营值'))), `字段 ${fields.map((item) => item.name).join('、')}；${temp.ok ? temp.planningId : temp.message}`)
  const iphone = store.data.families.find((item) => item.id === 'f-iphone')
  const blue = store.data.skus.find((item) => item.id === 's-iphone-blue')
  const v1Before = (JSON.parse(snapshotBefore) as { id: string; nodesSnapshot: unknown }[]).find((item) => item.id === 'phone-model-v1')
  const v1After = store.data.specModelVersions.find((item) => item.id === 'phone-model-v1')
  check('v2-untouched', Boolean(iphone && !iphone.line && blue && !blue.planningId && !blue.materialCode && blue.id === v2Sku?.id && JSON.stringify(v1After?.nodesSnapshot) === JSON.stringify(v1Before?.nodesSnapshot) && store.data.productPlans.map((item) => item.id).join() === plansBefore && store.data.params.map((item) => `${item.id}:${item.values.join(',')}`).join('|') === dictBefore), `旧商品 ${iphone?.line || 'v2'} SKU ${blue?.id || '丢失'}`)
  await nextTick()
  return results
}
