import {familyProductTypeId} from './productIdentity'
import {generalReferenceProblem,generalConditionProblem,generalFactProblem,type GeneralCompatibilityClaim,type CompatibilityEvidence} from './generalCompatibility'
import { projectAttrs, shelfOf } from './logic'
import { roleOfType } from './compatibility'
import { compatibilityRecordRole, createDeviceResolutionContext, deviceHostKey, resolveDeviceSku, sameDeviceHost, validateCompatibilityHost } from './deviceResolution'
import type { DeviceResolutionContext } from './deviceResolution'
import type { AppData, CompatibilityLink } from './types'
import type { AccessoryMatch, AccessoryQueryResult, AccessoryTarget, AccessoryUseEvaluation, CapabilityEvaluation, CompatibilityCapability, CompatibilityCondition, ConditionEvaluation, DeviceResolution, ReverseCompatibilityResult } from './accessoryCompatibilityTypes'

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
function capabilityResult(data: AppData, capability: CompatibilityCapability, declarations: CompatibilityLink[], device: DeviceResolution, general:GeneralCompatibilityClaim[]=[]): CapabilityEvaluation {
  const modelRows=declarations.map(record=>({kind:'model' as const,record,rule:declarationDefaults(record),conditions:declarationDefaults(record).conditions.map(c=>evaluateCompatibilityCondition(data,c,device)),problem:''}))
  const generalRows=general.map(record=>{const problem=generalReferenceProblem(data,record)||(!record.conditions.length?'必要条件尚未完善':'');const conditions:ConditionEvaluation[]=record.conditions.map(c=>{const invalid=generalConditionProblem(data,c)||generalFactProblem(data,c,device);return invalid?{condition:c,state:'unknown',label:invalid}:evaluateCompatibilityCondition(data,c,device)});if(problem)conditions.push({condition:{kind:'manual',text:problem},state:'unknown',label:problem});return {kind:'general' as const,record,rule:record,conditions,problem}})
  const rows=[...modelRows,...generalRows],confirmed=rows.filter(r=>r.rule.verification==='confirmed')
  const met=(r:typeof rows[number])=>!r.problem&&r.conditions.every(c=>c.state==='met')
  const deny=confirmed.filter(r=>r.rule.conclusion==='incompatible'&&met(r))
  // Preserve the existing model negative-unknown safeguard. A general rule only
  // applies when all its prerequisites are proven; its unknowns are not negatives.
  const unknownDeny=confirmed.filter(r=>r.kind==='model'&&r.rule.conclusion==='incompatible'&&!r.conditions.some(c=>c.state==='unmet')&&r.conditions.some(c=>c.state==='unknown'))
  const allow=confirmed.filter(r=>r.rule.conclusion!=='incompatible')
  const branches=allow.map(r=>r.kind==='general'?met(r)?r.rule.conclusion==='conditional'?'conditional':'compatible':'pending':r.conditions.some(c=>c.state==='unmet')?'incompatible':r.rule.conclusion==='conditional'||r.conditions.some(c=>c.state==='unknown')?'conditional':'compatible')
  const status=deny.length?'incompatible':unknownDeny.length?'pending':branches.includes('compatible')?'compatible':branches.includes('conditional')?'conditional':branches.includes('incompatible')&&!branches.includes('pending')?'incompatible':'pending'
  const positive=allow.filter(r=>r.kind==='general'?met(r):!r.conditions.some(c=>c.state==='unmet'))
  const conditions=rows.flatMap(r=>r.conditions)
  if(allow.some(r=>r.kind==='model'&&r.rule.conclusion==='conditional'&&!r.conditions.length))conditions.push({condition:{kind:'manual',text:'有条件声明的使用前提尚未补全'},state:'unknown',label:'有条件声明的使用前提尚未补全，需确认'})
  const evidence:CompatibilityEvidence[]=rows.map(r=>({key:`${r.kind}:${r.record.id}`,kind:r.kind,record:r.record,scopeLabel:r.kind==='general'?(r.record as GeneralCompatibilityClaim).deviceTypeIds.map(id=>data.productTypes.find(t=>t.id===id)?.name||'类型已失效').join('、'):(r.record as CompatibilityLink).host.steps.map(s=>s.valueId).join(' · '),conditions:r.conditions,effective:r.rule.verification==='confirmed'&&met(r)&&!(r.rule.conclusion==='conditional'&&!r.conditions.length),reason:r.problem||(r.rule.verification!=='confirmed'?'声明尚未确认':r.conditions.some(c=>c.state==='unmet')?'必要条件不满足，此声明不提供适用证明':r.conditions.some(c=>c.state==='unknown')?'设备资料不足，无法核验':'条件满足')}))
  return {capability,status,conflict:!!(deny.length&&positive.length),conditions,declarations,evidence}
}
function evaluateCapabilities(data: AppData, declarations: CompatibilityLink[], device: DeviceResolution, general:GeneralCompatibilityClaim[]=[]):CapabilityEvaluation[] {
  return (['basic','fast-charge','other'] as CompatibilityCapability[]).flatMap(capability=>{const matching=declarations.filter(l=>declarationDefaults(l).capability===capability),wide=general.filter(l=>l.capability===capability);return matching.length||wide.length?[capabilityResult(data,capability,matching,device,wide)]:[]})
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
function missingCapability(capability: CompatibilityCapability): CapabilityEvaluation {
  return { capability, status: 'pending', conflict: false, conditions: [], declarations: [] }
}
/** Consume a single host query's evaluated facts; never infer basic use from
 * a specialty ability or rescan/replace the actual SKU and PLN context. */
export function accessoryUseEvaluation(match: (Pick<AccessoryMatch, 'capabilities'> & Partial<Pick<AccessoryMatch, 'basic'>>) | undefined, options: { requireFastCharge?: boolean } = {}): AccessoryUseEvaluation {
  const basic = match?.basic || match?.capabilities.find(item => item.capability === 'basic') || missingCapability('basic')
  const fastCharge = match?.capabilities.find(item => item.capability === 'fast-charge') || missingCapability('fast-charge')
  const required = options.requireFastCharge ? [basic, fastCharge] : [basic]
  const status = required.some(item => item.status === 'incompatible') ? 'incompatible' : required.some(item => item.status === 'pending') ? 'pending' : required.some(item => item.status === 'conditional') ? 'conditional' : 'compatible'
  return { status, conflict: required.some(item => item.conflict), conditions: required.flatMap(item => item.conditions), declarations: [...new Map(required.flatMap(item => item.declarations).map(link => [link.id, link])).values()], evidence:[...new Map(required.flatMap(c=>c.evidence||[]).map(e=>[e.key,e])).values()], basic, fastCharge, missingBasic: !(basic.evidence?.length??basic.declarations.length), requiresFastCharge: Boolean(options.requireFastCharge) }
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
  const family = context.families.get(sku.familyId), typeId = family?.productTypeId || familyProductTypeId(data, sku.familyId)
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
  const generalBySku=new Map<string,GeneralCompatibilityClaim[]>()
  result.generalDiagnostics=[]
  for(const claim of data.generalCompatibilityClaims||[]){
    if(!claim.deviceTypeIds.includes(device.host.productTypeId)){result.generalDiagnostics.push({skuId:claim.skuId,claimId:claim.id,reason:'当前设备不属于声明设备产品类型'});continue}
    const problem=generalReferenceProblem(data,claim)
    if(problem)result.generalDiagnostics.push({skuId:claim.skuId,claimId:claim.id,reason:problem})
    const records=generalBySku.get(claim.skuId)||[];records.push(claim);generalBySku.set(claim.skuId,records)
    const key=JSON.stringify(['sku',claim.skuId]);if(!groups.has(key))groups.set(key,[])
  }
  const text = (options.keyword || '').trim().toLocaleLowerCase()
  for (const [groupKey,declarations] of groups) {
    const [kind,id]=JSON.parse(groupKey) as ['sku'|'material',string]
    const target:AccessoryTarget={kind,id}, sku = bySku.get(target.id), family = sku && byFamily.get(sku.familyId)
    if (!sku || !family || (target.kind==='sku'&&!context.realSkuIds.has(sku.id))) continue
    const productTypeId = family.productTypeId || familyProductTypeId(data, family.id), productTypeName = byType.get(productTypeId)?.name || '未分类'
    const name = sku.skuName || sku.code, code = target.kind === 'material' ? sku.materialCode || sku.code : sku.code
    const spec = Object.entries(projectAttrs(family, sku)).filter(([, value]) => value.trim()).map(([key, value]) => `${key} ${value}`).join(' · ')
    if ((options.productTypeId && options.productTypeId !== productTypeId) || (text && !`${name} ${code} ${spec} ${productTypeName}`.toLocaleLowerCase().includes(text))) continue
    const general=target.kind==='sku'?generalBySku.get(sku.id)||[]:[]
    const capabilities = evaluateCapabilities(data, declarations, device,general)
    const basic = capabilities.find(item => item.capability === 'basic') || missingCapability('basic'), status = overallCapabilityStatus(capabilities)
    const conditions = capabilities.flatMap(item => item.conditions)
    const reasons = [...new Set(declarations.flatMap(link => {
      const rule = declarationDefaults(link)
      return [link.host.scope === 'planning' ? `仅适用于当前规划规格 ${link.host.planningId}` : '适用于当前设备型号；型号级声明不限定容量和颜色', rule.provenance.kind === 'material-copy' ? `从物料 ${rule.provenance.materialSnapshot?.code || rule.provenance.materialId || '历史来源'} 的适用关系确认复制` : target.kind === 'sku' ? '来自销售 SKU 声明' : '来自物料 MAT 声明', rule.source]
    }))]
    const evidence=capabilities.flatMap(c=>c.evidence||[])
    for(const e of evidence.filter(e=>e.kind==='general'))reasons.push(`通用条件 · ${e.record.source} · ${e.reason}`,...e.conditions.map(c=>c.label+'：'+({met:'已满足',unmet:'未满足',unknown:'待核验'}[c.state])))
    if (!(basic.evidence?.length??basic.declarations.length)) reasons.push('此处为特定能力结论，基本使用能力尚未单独维护。')
    if (conditions.some(item => item.state === 'unmet')) reasons.push('部分声明的设备属性条件不满足；请查看各条匹配依据。')
    const bucketStatus = target.kind === 'material' ? status : basic.status
    const match: AccessoryMatch = { target, sku, name, code, spec, productTypeId, productTypeName, status, recommendable: (bucketStatus === 'compatible' || bucketStatus === 'conditional') && (target.kind === 'material' || (sku.status === 'on_sale' && shelfOf(family) === 'online')), conflict: capabilities.some(item => item.conflict), reasons, conditions, declarations, capabilities, basic, evidence }
    // Management keeps every capability and its conservative summary. Ordinary
    // sales recommendations, however, need their own basic-use declaration.
    if (bucketStatus === 'pending') result.pending.push(match)
    else if (bucketStatus === 'incompatible') result.excluded.push(match)
    else if (target.kind === 'material') result.materials.push(match)
    else if (match.recommendable) result.sales.push(match)
    else result.unavailable.push(match)
    result.counts.declarations += declarations.length+general.length
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
  const result: ReverseCompatibilityResult = { target, hosts: [], generalDeclarations:target.kind==='sku'?(data.generalCompatibilityClaims||[]).filter(c=>c.skuId===target.id):[], generalDevices:[], issues: [], counts: { models: 0, declarations: 0, devices: 0 } }
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
      const capabilities=evaluateCapabilities(data,applicable,resolution,(result.generalDeclarations||[]).filter(c=>c.deviceTypeIds.includes(resolution.host!.productTypeId))),status = overallCapabilityStatus(capabilities)
      return [{ skuId: sku.id, code: sku.code, name: sku.skuName || sku.code, status, capabilities, planningId:resolution.planningId }]
    })
    // Each model can have different PLN facts. The summary stays conservative;
    // actual phone decisions are always evaluated above with their own scope.
    const modelDeclarations = declarations.filter(link => link.host.scope === 'model'), limited = declarations.some(link => link.host.scope === 'planning')
    const modelDevice: DeviceResolution = { status: 'resolved', skuId: '', host: option.host, candidates: [], message: '', source: '管理汇总', attributes: {}, sourceStamp: '' }
    const capabilities = evaluateCapabilities(data, modelDeclarations, modelDevice,(result.generalDeclarations||[]).filter(c=>c.deviceTypeIds.includes(option.host.productTypeId))), summaryStatus = overallCapabilityStatus(capabilities)
    const status = limited && summaryStatus === 'compatible' ? 'conditional' : summaryStatus
    const scopeSummary = [limited ? '包含指定 PLN 的限定声明；具体设备须按其规格判定，不代表全型号适用' : '型号级声明，不限定容量和颜色；使用条件仍须核验', capabilities.some(item => item.capability === 'basic') ? '' : '基本使用能力尚未单独维护，不能由特定能力结论代替'].filter(Boolean).join('；')
    result.hosts.push({ key, host: option.host, label: option.label, declarations, devices, status, conflict: capabilities.some(item => item.conflict), scopeSummary, capabilities })
  }
  for(const claim of result.generalDeclarations||[]){const problem=generalReferenceProblem(data,claim);if(problem)result.issues.push({message:`通用条件：${problem}`})}
  if(result.generalDeclarations?.length)for(const {sku,resolution} of allDevices){if(!resolution.host||resolution.status!=='resolved'||!result.generalDeclarations.some(c=>c.deviceTypeIds.includes(resolution.host!.productTypeId)))continue;const forward=queryResolvedDevice(data,resolution,{},context),match=[...forward.sales,...forward.pending,...forward.excluded,...forward.unavailable].find(m=>m.target.id===target.id&&m.target.kind===target.kind);if(match)result.generalDevices!.push({skuId:sku.id,name:sku.skuName||sku.code,capabilities:match.capabilities})}
  result.counts = { models: result.hosts.length, declarations: result.hosts.reduce((sum, host) => sum + host.declarations.length, 0)+(result.generalDeclarations?.length||0), devices: new Set(result.hosts.flatMap(host => host.devices.map(device => device.skuId))).size }
  return result
}

/** Reverse model summaries keep PLN restrictions only for the requested abilities.
 * A fast-charge-only exception cannot narrow an unconditional basic-use result. */
export function reverseAccessoryUseEvaluation(host: ReverseCompatibilityResult['hosts'][number], options: { requireFastCharge?: boolean } = {}) {
  const evaluation=accessoryUseEvaluation(host,options)
  const limited=host.declarations.some(link=>link.host.scope==='planning'&&(declarationDefaults(link).capability==='basic'||options.requireFastCharge&&declarationDefaults(link).capability==='fast-charge'))
  return {...evaluation,status:limited&&evaluation.status==='compatible'?'conditional' as const:evaluation.status,hasSpecDifferences:limited}
}

/** Explicit, resolved model/combination context, without creating a pretend SKU. */
export function queryDeviceContextAccessories(data:AppData,device:DeviceResolution){return queryResolvedDevice(data,device)}
