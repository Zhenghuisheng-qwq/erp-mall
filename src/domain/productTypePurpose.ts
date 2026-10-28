import { roleOfType } from './compatibility'
import type { AppData, ProductType } from './types'
import type { TemplateCompatibilityConfig } from './templateCompatibilityTypes'

export const productTypePurposes = [
  {value:'', label:'未指定'},
  {value:'host', label:'主机／设备'},
  {value:'accessory', label:'配件'},
  {value:'other', label:'其他'},
] as const
export const productTypePurposeLabel = (value: ProductType['catalogRole']) => productTypePurposes.find(item => item.value === (value || ''))?.label || '未指定'
export const validProductTypePurpose = (value: unknown): value is ProductType['catalogRole'] => value === undefined || ['host','accessory','other'].includes(String(value)) && typeof value === 'string'

/** Check directional evidence and actual role-dependent consumers, never names or mere publication history. */
export function productTypePurposeChangeMessage(data: AppData, typeId: string, nextRole: ProductType['catalogRole']): string {
  const type = data.productTypes.find(item => item.id === typeId)
  if (!type || type.catalogRole === nextRole) return ''
  const models = new Set(data.specCanvases.filter(item => item.productTypeId === typeId).map(item => item.templateId))
  const skuIds = new Set(data.skus.filter(sku => {
    const family = data.families.find(item => item.id === sku.familyId)
    // Archived explicit ownership wins over the current model's type, as in device resolution.
    return !!family && (family.productTypeId || data.specCanvases.find(item => item.templateId === (family.productModelId || family.templateId))?.productTypeId) === typeId
  }).map(sku => sku.id))
  const hostOwned = (host: {productTypeId: string; productModelId: string}) => host.productTypeId === typeId || models.has(host.productModelId)
  const configs: TemplateCompatibilityConfig[] = [
    ...(data.templateCompatibilityConfigs || []),
    ...data.specModelVersions.flatMap(version => version.templateCompatibilitySnapshot ? [version.templateCompatibilitySnapshot.config] : []),
  ]
  const claims = configs.flatMap(config => [...config.defaultRule.claims, ...config.exceptions.flatMap(rule => rule.claims)])
  const hostEvidence = claims.some(claim => hostOwned(claim.host))
    || data.nodeCompatibilityRules.some(rule => rule.hosts.some(hostOwned))
    || data.compatibilities.some(link => hostOwned(link.host))
    || (data.deviceModels || []).some(item => item.productTypeId === typeId)
    || (data.deviceBindings || []).some(item => hostOwned(item.host))

  if (hostEvidence && nextRole !== 'host') return '此类型被适用声明或设备身份作为主机引用。请先在「适用关系／设备身份」处理引用；历史依据仍受保护，不能改变为非主机用途。'
  const accessoryEvidence = configs.some(config => models.has(config.modelId) && (config.defaultRule.configured || config.defaultRule.claims.length || config.exceptions.length))
    || data.nodeCompatibilityRules.some(rule => models.has(rule.templateId) && rule.hosts.length)
    || data.compatibilities.some(link => skuIds.has(link.targetId || link.accessorySkuId))
  if (accessoryEvidence && nextRole !== 'accessory') return '此类型的模型或商品已有配件适用配置（含发布快照）。请进入「适用关系」核对；不能改变已有配件依据的解释。'
  const next = {...data, productTypes: data.productTypes.map(item => item.id === typeId ? {...item, catalogRole: nextRole} : item)}
  if (roleOfType(data, typeId) === roleOfType(next, typeId)) return ''
  // PLN and real archives participate in host/accessory resolution even without an explicit declaration.
  if (skuIds.size || data.planningRecords.some(item => models.has(item.productModelId))) return '此变更会改变已有 SKU／MAT 或 PLN 的主机、配件解释。请在「适用关系」核对来源；保留原用途，或为新用途新建产品类型。'
  return ''
}
