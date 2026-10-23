import { projectAttrs, shelfOf } from './logic'
import { roleOfType } from './compatibility'
import { compatibilityFamilyTypeId, compatibilityRecordRole, createDeviceResolutionContext, deviceHostKey, resolveDeviceSku, sameDeviceHost, validateCompatibilityHost } from './deviceResolution'
import type { DeviceResolutionContext } from './deviceResolution'
import type { AppData, CompatibilityLink } from './types'
import type { AccessoryMatch, AccessoryQueryResult, AccessoryTarget, CapabilityEvaluation, CompatibilityCapability, CompatibilityCondition, ConditionEvaluation, DeviceResolution, ReverseCompatibilityResult } from './accessoryCompatibilityTypes'

export function compatibilityTarget(link: CompatibilityLink): AccessoryTarget { return { kind: link?.targetKind || 'material', id: link?.targetId || link?.accessorySkuId || '' } }
export function declarationDefaults(link: CompatibilityLink) {
  const legacy = link.targetKind === undefined && link.conclusion === undefined && link.verification === undefined && link.capability === undefined && link.conditions === undefined
  return { target: compatibilityTarget(link), conclusion: link.conclusion || 'compatible', verification: link.verification || (legacy ? 'confirmed' : 'pending'), capability: link.capability || 'basic', conditions: Array.isArray(link.conditions) ? link.conditions : [], source: link.source || (legacy ? '历史正式适用关系；核验依据未记录' : '依据未记录'), provenance: link.provenance || { kind: legacy ? 'legacy' as const : 'manual' as const, detail: legacy ? '历史正式适用关系；核验依据未记录' : '人工维护；依据未记录' } }
}
function conditionProblem(data: AppData, condition: CompatibilityCondition): string {
  if (!condition || typeof condition !== 'object') return '使用条件结构无效。'
  if (condition.kind === 'attribute') {
    if (!data.params.some(param => param.id === condition.attributeId)) return '使用条件的设备属性引用已失效。'
    if (!['eq', 'in', 'gte'].includes(condition.operator)) return '使用条件的运算规则无效。'
    if (condition.operator === 'in' ? !Array.isArray(condition.value) || !condition.value.length || condition.value.some(value => typeof value !== 'string') : typeof condition.value !== 'string' || !condition.value.trim()) return '使用条件缺少有效值。'
    if (condition.operator === 'gte' && !Number.isFinite(Number(condition.value))) return '数值条件必须使用明确数字。'
    return ''
  }
  if (!['equipment', 'capability', 'manual'].includes(condition.kind) || typeof condition.text !== 'string' || !condition.text.trim()) return '使用条件类型或说明无效。'
  if (condition.kind === 'capability' && condition.powerWatts !== undefined && (!Number.isFinite(condition.powerWatts) || condition.powerWatts <= 0)) return '能力条件的功率要求无效。'
  return ''
}
export function evaluateCompatibilityCondition(data: AppData, condition: CompatibilityCondition, device: DeviceResolution): ConditionEvaluation {
  if (condition.kind !== 'attribute') {
    const text = condition.kind === 'capability' ? [condition.text, condition.protocol ? `协议 ${condition.protocol}` : '', condition.powerWatts ? `功率要求 ${condition.powerWatts}W（不代表实际充电功率）` : ''].filter(Boolean).join('；') : condition.text
    return { condition, state: 'unknown', label: condition.kind === 'equipment' ? `需搭配${text}，请确认配套条件` : `${text}；仍需人工确认` }
  }
  const name = data.params.find(param => param.id === condition.attributeId)?.name || '设备属性', actual = device.attributes[condition.attributeId]
  const expected = Array.isArray(condition.value) ? condition.value.join('、') : condition.value
  const label = `${name} ${condition.operator === 'gte' ? '至少' : condition.operator === 'in' ? '属于' : '为'} ${expected}`
  if (!actual) return { condition, state: 'unknown', label: `${label}；设备未记录该属性` }
  if (condition.operator === 'gte') {
    if (!Number.isFinite(Number(actual))) return { condition, state: 'unknown', label: `${label}；实际值不是可核验数字` }
    return { condition, state: Number(actual) >= Number(condition.value) ? 'met' : 'unmet', label }
  }
  return { condition, state: (Array.isArray(condition.value) ? condition.value.includes(actual) : actual === condition.value) ? 'met' : 'unmet', label }
}
function capabilityResult(data: AppData, capability: CompatibilityCapability, declarations: CompatibilityLink[], device: DeviceResolution): CapabilityEvaluation {
  const confirmed = declarations.filter(link => declarationDefaults(link).verification === 'confirmed')
  const applicable = confirmed.map(link => ({ link, conditions: declarationDefaults(link).conditions.map(condition => evaluateCompatibilityCondition(data, condition, device)) })).filter(item => !item.conditions.some(condition => condition.state === 'unmet'))
  const deny = applicable.filter(item => declarationDefaults(item.link).conclusion === 'incompatible' && item.conditions.every(condition => condition.state === 'met'))
  const unknownDeny = applicable.filter(item => declarationDefaults(item.link).conclusion === 'incompatible' && item.conditions.some(condition => condition.state === 'unknown'))
  const allow = confirmed.filter(link => declarationDefaults(link).conclusion !== 'incompatible')
  const applicableAllows = applicable.filter(item => declarationDefaults(item.link).conclusion !== 'incompatible')
  const conditions = declarations.flatMap(link => declarationDefaults(link).conditions.map(condition => evaluateCompatibilityCondition(data, condition, device)))
  const branches = allow.map(link => {
    const rule = declarationDefaults(link), evaluated = rule.conditions.map(condition => evaluateCompatibilityCondition(data, condition, device))
    return evaluated.some(item => item.state === 'unmet') ? 'incompatible' : rule.conclusion === 'conditional' || evaluated.some(item => item.state === 'unknown') ? 'conditional' : 'compatible'
  })
  const status = deny.length ? 'incompatible' : unknownDeny.length ? 'pending' : branches.includes('compatible') ? 'compatible' : branches.includes('conditional') ? 'conditional' : branches.length ? 'incompatible' : 'pending'
  if (allow.some(link => declarationDefaults(link).conclusion === 'conditional' && !declarationDefaults(link).conditions.length)) conditions.push({ condition: { kind: 'manual', text: '有条件声明的使用前提尚未补全' }, state: 'unknown', label: '有条件声明的使用前提尚未补全，需确认' })
  return { capability, status, conflict: Boolean(deny.length && applicableAllows.length), conditions, declarations }
}
function evaluateCapabilities(data: AppData, declarations: CompatibilityLink[], device: DeviceResolution) {
  const order: CompatibilityCapability[] = ['basic', 'fast-charge', 'other']
  return order.flatMap(capability => {
    const matching = declarations.filter(link => declarationDefaults(link).capability === capability)
    return matching.length ? [capabilityResult(data, capability, matching, device)] : []
  })
}
function overallCapabilityStatus(capabilities: CapabilityEvaluation[]): AccessoryMatch['status'] {
  const basic = capabilities.find(item => item.capability === 'basic')
  if (basic) return basic.status
  // Specific abilities cannot establish basic use. Mixed or uncertain ability
  // facts require confirmation; their array order must never pick a winner.
  if (!capabilities.length || capabilities.some(item => item.status === 'pending')) return 'pending'
  if (capabilities.every(item => item.status === 'incompatible')) return 'incompatible'
  if (capabilities.some(item => item.status === 'incompatible')) return 'pending'
  return 'conditional'
}
function declarationProblem(data: AppData, link: CompatibilityLink, context: DeviceResolutionContext, hostOptions: Map<string, DeviceResolutionContext['hostOptions'][number]>) {
  if (link.provenance?.template?.state === 'stale') return '规格已改变，模板兼容来源待重新确认。'
  if (link.targetId !== undefined && link.targetKind === undefined) return '配件对象类型缺失，请明确销售 SKU 或物料。'
  if (link.targetKind !== undefined && !['sku', 'material'].includes(link.targetKind)) return '配件对象类型无效。'
  if (link.targetKind !== undefined && (typeof link.targetId !== 'string' || !link.targetId.trim())) return '配件对象标识无效。'
  if (link.targetKind !== undefined && link.targetId !== link.accessorySkuId) return '配件对象身份矛盾，请核对目标记录，未自动改指向。'
  if (link.conclusion !== undefined && !['compatible', 'conditional', 'incompatible'].includes(link.conclusion)) return '兼容结论无效。'
  if (link.verification !== undefined && !['confirmed', 'pending'].includes(link.verification)) return '核验状态无效。'
  if (link.capability !== undefined && !['basic', 'fast-charge', 'other'].includes(link.capability)) return '能力类型无效。'
  if (link.conditions !== undefined && !Array.isArray(link.conditions)) return '使用条件结构无效。'
  if (link.source !== undefined && typeof link.source !== 'string') return '声明依据格式无效。'
  const target = compatibilityTarget(link), sku = context.skus.get(target.id)
  if (!sku || (target.kind === 'sku' ? !context.realSkuIds.has(sku.id) : !context.materialIds.has(sku.id))) return '配件对象引用失效或销售 SKU/MAT 身份不符。'
  const family = context.families.get(sku.familyId), typeId = family?.productTypeId || compatibilityFamilyTypeId(data, sku.familyId)
  if (!typeId || roleOfType(data, typeId) !== 'accessory') return '配件产品类型引用失效。'
  const knownHost = link.host ? hostOptions.get(deviceHostKey(link.host)) : undefined
  return validateCompatibilityHost(data, link.host, knownHost ? [knownHost] : []) || (link.conditions || []).map(condition => conditionProblem(data, condition)).find(Boolean) || ''
}
function queryResolvedDevice(data: AppData, device: DeviceResolution, options: { keyword?: string; productTypeId?: string } = {}, context = createDeviceResolutionContext(data)): AccessoryQueryResult {
  const result: AccessoryQueryResult = { device, sales: [], materials: [], pending: [], excluded: [], unavailable: [], issues: [], counts: { sales: 0, materials: 0, pending: 0, excluded: 0, unavailable: 0, declarations: 0, models: device.host ? 1 : 0 } }
  if (device.status !== 'resolved' || !device.host) return result
  const hostOptions = new Map(context.hostOptions.map(option => [option.key, option])), groups = new Map<string, CompatibilityLink[]>()
  const bySku = context.skus, byFamily = context.families, byType = new Map(data.productTypes.map(type => [type.id, type]))
  for (const link of data.compatibilities || []) {
    if (!link) { result.issues.push({ message: '声明结构无效，待处理。' }); continue }
    if (!link?.host || !Array.isArray(link.host.steps)) { result.issues.push({ declarationId: link?.id, message: '声明的主机引用结构无效，待处理。' }); continue }
    if (!sameDeviceHost(link.host, device.host, false)) continue
    const problem = declarationProblem(data, link, context, hostOptions)
    if (problem) { result.issues.push({ declarationId: link.id, message: problem }); continue }
    if (link.host.scope === 'planning' && (!device.planningId || link.host.planningId !== device.planningId)) continue
    const target = compatibilityTarget(link), key = JSON.stringify([target.kind, target.id]), group = groups.get(key)
    if (group) group.push(link); else groups.set(key, [link])
  }
  const text = (options.keyword || '').trim().toLocaleLowerCase()
  for (const declarations of groups.values()) {
    const first = declarations[0]
    if (!first) continue
    const target = compatibilityTarget(first), sku = bySku.get(target.id), family = sku && byFamily.get(sku.familyId)
    if (!sku || !family) continue
    const productTypeId = family.productTypeId || compatibilityFamilyTypeId(data, family.id), productTypeName = byType.get(productTypeId)?.name || '未分类'
    const name = sku.skuName || sku.code, code = target.kind === 'material' ? sku.materialCode || sku.code : sku.code
    const spec = Object.entries(projectAttrs(family, sku)).filter(([, value]) => value.trim()).map(([key, value]) => `${key} ${value}`).join(' · ')
    if ((options.productTypeId && options.productTypeId !== productTypeId) || (text && !`${name} ${code} ${spec} ${productTypeName}`.toLocaleLowerCase().includes(text))) continue
    const capabilities = evaluateCapabilities(data, declarations, device)
    const basic = capabilities.find(item => item.capability === 'basic'), status = overallCapabilityStatus(capabilities)
    const conditions = capabilities.flatMap(item => item.conditions)
    const reasons = [...new Set(declarations.flatMap(link => {
      const rule = declarationDefaults(link)
      return [link.host.scope === 'planning' ? `仅适用于当前规划规格 ${link.host.planningId}` : '适用于当前设备型号；型号级声明不限定容量和颜色', rule.provenance.kind === 'material-copy' ? `从物料 ${rule.provenance.materialSnapshot?.code || rule.provenance.materialId || '历史来源'} 的适用关系确认复制` : target.kind === 'sku' ? '来自销售 SKU 声明' : '来自物料 MAT 声明', rule.source]
    }))]
    if (!basic) reasons.push('此处为特定能力结论，基本使用能力尚未单独维护。')
    if (conditions.some(item => item.state === 'unmet')) reasons.push('部分声明的设备属性条件不满足；请查看各条匹配依据。')
    const match: AccessoryMatch = { target, sku, name, code, spec, productTypeId, productTypeName, status, recommendable: (status === 'compatible' || status === 'conditional') && (target.kind === 'material' || (sku.status === 'on_sale' && shelfOf(family) === 'online')), conflict: capabilities.some(item => item.conflict), reasons, conditions, declarations, capabilities }
    if (status === 'pending') result.pending.push(match)
    else if (status === 'incompatible') result.excluded.push(match)
    else if (target.kind === 'material') result.materials.push(match)
    else if (match.recommendable) result.sales.push(match)
    else result.unavailable.push(match)
    result.counts.declarations += declarations.length
  }
  for (const key of ['sales', 'materials', 'pending', 'excluded', 'unavailable'] as const) result.counts[key] = result[key].length
  return result
}
export function queryDeviceAccessories(data: AppData, skuId: string, options: { keyword?: string; productTypeId?: string; includeUnavailable?: boolean } = {}) { const context = createDeviceResolutionContext(data); return queryResolvedDevice(data, resolveDeviceSku(data, skuId, context), options, context) }
/** Management model lookup deliberately does not match any PLN-limited declarations. */
export function queryModelAccessories(data: AppData, host: DeviceResolution['host'], options: { keyword?: string; productTypeId?: string } = {}) {
  const problem = host ? validateCompatibilityHost(data, host) : '尚未确认设备型号。'
  return queryResolvedDevice(data, { status: problem ? 'invalid' : 'resolved', skuId: '', host, candidates: [], message: problem, source: '指定主机型号', attributes: {}, sourceStamp: '' }, options)
}
export function queryAccessoryDevices(data: AppData, target: AccessoryTarget): ReverseCompatibilityResult {
  const result: ReverseCompatibilityResult = { target, hosts: [], issues: [], counts: { models: 0, declarations: 0, devices: 0 } }
  const context = createDeviceResolutionContext(data), options = context.hostOptions, hostOptions = new Map(options.map(option => [option.key, option])), groups = new Map<string, CompatibilityLink[]>()
  for (const link of data.compatibilities || []) {
    if (!link) { result.issues.push({ message: '声明结构无效，待处理。' }); continue }
    const actual = compatibilityTarget(link)
    if (actual.kind !== target.kind || actual.id !== target.id) continue
    const problem = declarationProblem(data, link, context, hostOptions)
    if (problem) { result.issues.push({ declarationId: link.id, message: problem }); continue }
    const key = deviceHostKey(link.host), group = groups.get(key)
    if (group) group.push(link); else groups.set(key, [link])
  }
  const allDevices = data.skus.filter(sku => context.realSkuIds.has(sku.id) && compatibilityRecordRole(data, sku.id) === 'host').map(sku => ({ sku, resolution: resolveDeviceSku(data, sku.id, context) }))
  for (const [key, declarations] of groups) {
    const first = declarations[0], option = options.find(item => item.key === key)
    if (!first || !option) continue
    const devices = allDevices.flatMap(({ sku, resolution }) => {
      if (resolution.status !== 'resolved' || !resolution.host || !sameDeviceHost(resolution.host, first.host, false)) return []
      const applicable = declarations.filter(link => link.host.scope === 'model' || (resolution.planningId && link.host.planningId === resolution.planningId))
      if (!applicable.length) return []
      const status = overallCapabilityStatus(evaluateCapabilities(data, applicable, resolution))
      return [{ skuId: sku.id, code: sku.code, name: sku.skuName || sku.code, status }]
    })
    // Each model can have different PLN facts. The summary stays conservative;
    // actual phone decisions are always evaluated above with their own scope.
    const modelDeclarations = declarations.filter(link => link.host.scope === 'model'), limited = declarations.some(link => link.host.scope === 'planning')
    const modelDevice: DeviceResolution = { status: 'resolved', skuId: '', host: option.host, candidates: [], message: '', source: '管理汇总', attributes: {}, sourceStamp: '' }
    const capabilities = evaluateCapabilities(data, modelDeclarations, modelDevice), summaryStatus = overallCapabilityStatus(capabilities)
    const status = limited && summaryStatus === 'compatible' ? 'conditional' : summaryStatus
    const scopeSummary = [limited ? '包含指定 PLN 的限定声明；具体设备须按其规格判定，不代表全型号适用' : '型号级声明，不限定容量和颜色；使用条件仍须核验', capabilities.some(item => item.capability === 'basic') ? '' : '基本使用能力尚未单独维护，不能由特定能力结论代替'].filter(Boolean).join('；')
    result.hosts.push({ key, host: option.host, label: option.label, declarations, devices, status, conflict: capabilities.some(item => item.conflict), scopeSummary, capabilities })
  }
  result.counts = { models: result.hosts.length, declarations: result.hosts.reduce((sum, host) => sum + host.declarations.length, 0), devices: new Set(result.hosts.flatMap(host => host.devices.map(device => device.skuId))).size }
  return result
}
