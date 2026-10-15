import { installAcceptanceCatalog } from './acceptanceCatalog'
import { addCompatibility, compatibilityModelBlock, compatibilitySkuBlock, hostFrom, linksOfHost, linksOfSku, listHostModels } from './compatibility'
import { installCompatibilitySamples } from './compatibilitySamples'
import { applyExcelImport, observedMaterials, previewSheet, suggestMapping, type SheetProfile } from './excelImport'
import { updateV3Material } from './material'
import { reconcilePlanningRecords } from './planning'
import { createSeed } from './seed'

export interface CheckResult { id: string; ok: boolean; detail: string }

export function runCompatibilityChecks(material?: SheetProfile): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const data = createSeed()
  const phoneSku = data.skus.find((item) => item.familyId === 'f-iphone')
  let seq = 0
  const nextId = (prefix: string) => `${prefix}-${++seq}`
  const sample = installCompatibilitySamples(data, nextId)
  const pro17 = sample.hosts.find((item) => item.modelName === 'iPhone 17 Pro Max')
  const pro18 = sample.hosts.find((item) => item.modelName === 'iPhone 18 Pro Max')
  check('A-hosts', Boolean(pro17 && pro18 && pro17.host.identityKey !== pro18.host.identityKey && pro17.planningIds.length === 2), `${pro17?.label || ''} / ${pro18?.label || ''}`)
  const modelValues = data.params.find((item) => item.name === '型号')?.values || []
  const seriesValues = data.params.find((item) => item.name === '系列')?.values || []
  check('dict', !modelValues.includes('iPhone 18 Pro Max') && !seriesValues.includes('iPhone 18') && modelValues.includes('iPhone 17 Pro Max'), `型号 ${modelValues.join('、')}`)
  if (!pro17 || !pro18 || !phoneSku) return results
  const first = addCompatibility(data, { accessorySkuIds: [sample.filmA], hosts: [pro17.host, pro18.host], nextId })
  const fromFilm = linksOfSku(data, sample.filmA)
  const from17 = linksOfHost(data, pro17.host).filter((item) => item.accessorySkuId === sample.filmA)
  const from18 = linksOfHost(data, pro18.host).filter((item) => item.accessorySkuId === sample.filmA)
  check('A', first.created.length === 2 && fromFilm.length === 2 && from17.length === 1 && from18.length === 1, `新增 ${first.created.length}`)
  const many = addCompatibility(data, { accessorySkuIds: [sample.filmA, sample.filmB, sample.caseSku], hosts: [pro17.host], nextId })
  const types = new Set(linksOfHost(data, pro17.host).map((item) => data.families.find((family) => family.id === data.skus.find((sku) => sku.id === item.accessorySkuId)?.familyId)?.productTypeId))
  check('B', many.created.length === 2 && many.skipped === 1 && types.size === 2, `新增 ${many.created.length} 跳过 ${many.skipped} 类型 ${types.size}`)
  check('C', sample.filmA !== sample.filmB && linksOfHost(data, pro17.host).filter((item) => item.accessorySkuId === sample.filmA || item.accessorySkuId === sample.filmB).length === 2, '两条膜都在')
  const again = addCompatibility(data, { accessorySkuIds: [sample.filmA], hosts: [pro17.host], nextId })
  check('D', again.created.length === 0 && again.skipped === 1 && linksOfSku(data, sample.filmA).length === 2, `跳过 ${again.skipped}`)
  const batch = addCompatibility(data, { accessorySkuIds: [sample.caseSku], hosts: [pro17.host, pro18.host], nextId })
  check('E', batch.created.length === 1 && batch.skipped === 1 && linksOfSku(data, sample.caseSku).length === 2, `新增 ${batch.created.length} 跳过 ${batch.skipped}`)
  const drop = fromFilm.find((item) => item.host.identityKey === pro18.host.identityKey)
  data.compatibilities = data.compatibilities.filter((item) => item.id !== drop?.id)
  check('F', linksOfSku(data, sample.filmA).length === 1 && linksOfSku(data, sample.filmA)[0].host.identityKey === pro17.host.identityKey && data.skus.some((item) => item.id === sample.filmA), '只取消了一款主机')
  const beforeName = data.skus.find((item) => item.id === sample.filmA)?.skuName
  updateV3Material(data, { skuId: sample.filmA, skuName: '【测试样例】改名后的膜', supplierCode: '', guanjiapoCode: '', oaSkuId: '', materialDescription: '' })
  check('G', linksOfSku(data, sample.filmA).length === 1 && data.skus.find((item) => item.id === sample.filmA)?.skuName !== beforeName, '改名后关系还在')
  const linkKey = linksOfSku(data, sample.filmA)[0].host.identityKey
  const version = data.specModelVersions.find((item) => item.id === 't-compat-sample-v1')
  if (version) data.planningRecords = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: 't-compat-sample', modelVersionId: version.id, nodes: version.nodesSnapshot, now: '2026-10-15T18:00:00.000Z' }).records
  const still = listHostModels(data).find((item) => item.modelName === 'iPhone 17 Pro Max')
  check('H', Boolean(still && still.host.identityKey === linkKey && data.skus.find((item) => item.id === sample.filmA)?.modelVersionId !== 't-compat-sample-v1'), '重发后关系身份没被改写')
  const blockedSku = compatibilitySkuBlock(data, sample.filmA)
  const blockedModel = compatibilityModelBlock(data, ['t-compat-sample'])
  check('I', blockedSku.includes('不能删除') && blockedSku.includes('1') && blockedModel.includes('适用'), `${blockedSku} | ${blockedModel}`)
  const refused = addCompatibility(data, { accessorySkuIds: [phoneSku.id], hosts: [pro17.host], nextId })
  const foreign = { ...pro17.host, productModelId: 't-other-model' }
  check('isolate', linksOfHost(data, foreign).length === 0 && linksOfHost(data, pro17.host).some((item) => item.accessorySkuId === sample.filmA), '相同型号文字不会串到另一个模型')
  check('K', refused.created.length === 0 && refused.failed.length === 1 && refused.failed[0].message.includes('不是配件'), refused.failed[0]?.message || '')
  const blackId = pro17.planningIds.find((id) => data.planningRecords.find((item) => item.planningId === id)?.steps.some((step) => step.valueId === '黑色'))
  const precise = blackId ? addCompatibility(data, { accessorySkuIds: [sample.filmB], hosts: [hostFrom(pro17.host.productTypeId, pro17.host.productModelId, pro17.host.steps, blackId)], nextId }) : { created: [] }
  check('precise', precise.created.length === 1 && precise.created[0]?.host.scope === 'planning' && precise.created[0]?.host.planningId === blackId, blackId || '')
  check('J', material ? excelCase(material, nextId) : false, material ? '真实保护壳只手工关联了一条，档案没有被改写' : '没有传入真实物料表')
  return results
}

function excelCase(sheet: SheetProfile, nextId: (prefix: string) => string) {
  const mapping = suggestMapping(sheet.headers, sheet.sample)
  const data = createSeed()
  installAcceptanceCatalog(data, observedMaterials(sheet, mapping))
  const phoneType = data.productTypes.find((item) => item.id === 'pt-phone')
  const preview = previewSheet(data, sheet, mapping, 'compat-excel', { modelChoice: { [phoneType?.id || '']: 't-excel-phone' } })
  const row = preview.find((item) => item.block === 'formal' && item.productTypeName === '保护壳')
  if (!row) return false
  const applied = applyExcelImport(data, [row], nextId)
  const sku = data.skus.find((item) => item.supplierCode === row.supplierCode && item.guanjiapoCode === row.guanjiapoCode)
  if (!applied[0]?.ok || !sku) return false
  const fingerprint = `${sku.materialCode}|${sku.planningId}|${sku.modelVersionId}|${sku.skuName}`
  const host = listHostModels(data).find((item) => item.modelName === 'iPhone 16 Pro')
  if (!host) return false
  const linked = addCompatibility(data, { accessorySkuIds: [sku.id], hosts: [host.host], nextId })
  const after = data.skus.find((item) => item.id === sku.id)
  return linked.created.length === 1 && data.compatibilities.length === 1 && `${after?.materialCode}|${after?.planningId}|${after?.modelVersionId}|${after?.skuName}` === fingerprint
}
