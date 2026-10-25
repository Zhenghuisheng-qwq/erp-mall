import { resolveBenefitRange, frameworkSelectionIssues, frameworkImportProblems, frameworkSnapshotProblem, frameworkReference } from './benefitFrameworks'
import { referencePriceProblem, referenceLine, benefitReferenceTotals } from './benefitPricing'
import { isRealSku } from './catalogIdentity'
import { compatibilityRecordRole } from './deviceResolution'
import { queryDeviceAccessories, queryModelAccessories } from './accessoryCompatibilityQuery'
import { savedSkuCode, savedSkuName, savedSkuSpec } from './productList'
import { shelfOf } from './logic'
import type { AppData, CompatibilityHost } from './types'
import type { AccessoryMatch, AccessoryQueryResult } from './accessoryCompatibilityTypes'
import type { BenefitCapabilitySummary, BenefitCompatibilitySummary, BenefitConditionConfirmation, BenefitDeliveryPreview, BenefitDeliverySnapshot, BenefitDeviceContext, BenefitIssue, BenefitPackage, BenefitPackageDraft, BenefitSkuSummary, BenefitValidation } from './benefitPackageTypes'

/** Preserve invalid numeric input until validation, instead of JSON silently turning NaN into null. */
export function cloneBenefit<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => cloneBenefit(item)) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneBenefit(item)])) as T
  return value
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
export function validBenefitQuantity(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 }
export function validBenefitCents(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
export function multiplyBenefitQuantity(left: number, right: number): number {
  if (!validBenefitQuantity(left) || !validBenefitQuantity(right) || !Number.isSafeInteger(left * right)) throw new Error('数量必须为正整数，且计算结果不能超过安全范围。')
  return left * right
}
export function parseBenefitAmount(text: string): number | null {
  const value = text.trim()
  if (!value) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('报价须为非负金额，最多两位小数。')
  const [whole = '', fraction = ''] = value.split('.'), exact=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')), cents = Number(exact)
  if (exact>BigInt(Number.MAX_SAFE_INTEGER)||!validBenefitCents(cents)) throw new Error('报价超出安全范围。')
  return cents
}
export function formatBenefitAmount(cents: number | null): string {
  if (cents === null) return '未报价'
  if (!validBenefitCents(cents)) return '报价无效'
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}
export function newBenefitPackageDraft(device: BenefitDeviceContext = null): BenefitPackageDraft {
  return { id: '', code: '', revision: 0, name: '', status: 'draft', favorite: false, device: cloneBenefit(device), includedPhoneSkuId: '', requireFastCharge: false, goods: [], services: [], rulesEnabled: false, groups: [], quote: { currency: 'CNY', amountCents: null, reviewedBasis: '' }, confirmations: [], issues: [], createdAt: '', updatedAt: '' }
}
export function benefitCompositionBasis(draft: BenefitPackageDraft): string {
  return stable({ device: draft.device, includedPhoneSkuId: draft.includedPhoneSkuId, requireFastCharge: draft.requireFastCharge, goods: draft.goods.map(line => ({ id: line.id, skuId: line.skuId, quantity: line.quantity, ...(line.referencePrice ? {referencePrice:line.referencePrice} : {}) })), ...(draft.framework ? {framework:draft.framework} : {}), services: draft.services, rulesEnabled: draft.rulesEnabled, groups: draft.groups })
}
export function reviewBenefitQuote(draft: BenefitPackageDraft): BenefitPackageDraft {
  const next = cloneBenefit(draft); next.quote.reviewedBasis = benefitCompositionBasis(next); return next
}
export function copyBenefitPackageDraft(source: BenefitPackage): BenefitPackageDraft {
  const next = cloneBenefit(source)
  next.id = ''; next.code = ''; next.revision = 0; next.name = `${source.name || '权益包'} 副本`; next.status = 'draft'
  next.createdAt = ''; next.updatedAt = ''; delete next.creationRequestId
  next.confirmations = []; next.issues = []; next.quote.reviewedBasis = ''
  return next
}
export function benefitSkuSummary(data: AppData, skuId: string): BenefitSkuSummary | undefined {
  const sku = data.skus.find(item => item.id === skuId), family = sku && data.families.find(item => item.id === sku.familyId)
  if (!sku || !family || !isRealSku(data, sku)) return undefined
  const productTypeId = family.productTypeId || data.specCanvases.find(item => item.templateId === (family.productModelId || family.templateId))?.productTypeId || ''
  return { skuId: sku.id, code: savedSkuCode(sku), name: savedSkuName(sku), familyId: family.id, familyName: family.name, spec: savedSkuSpec(family, sku), productTypeId, typeName: data.productTypes.find(item => item.id === productTypeId)?.name || '未分类', status: sku.status }
}
function deviceQuery(data: AppData, device: BenefitDeviceContext): AccessoryQueryResult | undefined {
  if (!device) return undefined
  return device.kind === 'sku' ? queryDeviceAccessories(data, device.skuId) : queryModelAccessories(data, device.host)
}
export function benefitSkuCandidates(data: AppData, device: BenefitDeviceContext, options: { keyword?: string; productTypeId?: string; accessoriesOnly?: boolean } = {}): BenefitSkuSummary[] {
  const query = options.accessoriesOnly ? deviceQuery(data, device) : undefined
  const suggested = query ? new Set(query.sales.map(item => item.target.id)) : undefined
  const keyword = (options.keyword || '').trim().toLocaleLowerCase()
  return data.skus.flatMap(sku => {
    const summary = benefitSkuSummary(data, sku.id), family = data.families.find(item => item.id === sku.familyId)
    if (!summary || !family || sku.status !== 'on_sale' || shelfOf(family) !== 'online') return []
    if (options.accessoriesOnly && (!suggested || !suggested.has(sku.id))) return []
    if (options.productTypeId && summary.productTypeId !== options.productTypeId) return []
    return keyword && !`${summary.name} ${summary.code} ${summary.familyName} ${summary.spec}`.toLocaleLowerCase().includes(keyword) ? [] : [summary]
  })
}
function touchComposition(draft: BenefitPackageDraft) { draft.confirmations = []; return draft }
export function addBenefitSku(data: AppData, draft: BenefitPackageDraft, skuId: string, quantity?: number): BenefitPackageDraft {
  const summary = benefitSkuSummary(data, skuId)
  if (!summary) throw new Error('请选择真实销售 SKU，物料、规划或商品主体不能加入实物清单。')
  const family = data.families.find(item => item.id === summary.familyId)
  if (summary.status !== 'on_sale' || !family || shelfOf(family) !== 'online') throw new Error('该商品当前未在售，不能新增到包内。')
  const range=resolveBenefitRange(data,draft), reason=range.reason(skuId)
  if(range.problems.length || reason && draft.framework)throw Error(range.problems.join(' ')||reason)
  const hits=range.membership(skuId)
  if(hits.length>1)throw Error('商品同时命中多个选配组，不能默认取第一组。')
  const group=hits[0]
  const amount = quantity ?? group?.defaultQuantity ?? 1
  if (!validBenefitQuantity(amount)) throw new Error('每包商品数量必须为安全范围内的正整数。')
  const next = cloneBenefit(draft), existing = next.goods.find(line => line.skuId === skuId)
  if (existing) {
    if (!validBenefitQuantity(existing.quantity) || !Number.isSafeInteger(existing.quantity + amount)) throw new Error('合并后的商品数量超出安全范围。')
    existing.quantity += amount
  } else next.goods.push({ id: `goods:${skuId}`, skuId, quantity: amount, snapshot: summary })
  if(draft.framework){const issues=frameworkSelectionIssues(data,next).filter(i=>i.skuId===skuId||i.groupId===group?.id&&next.goods.filter(l=>range.membership(l.skuId).some(g=>g.id===group?.id)).length>(group?.maxKinds||Infinity));if(issues.length)throw Error(issues.map(i=>i.message).join(' '))}
  return touchComposition(next)
}
export function replaceBenefitSku(data: AppData, draft: BenefitPackageDraft, lineId: string, newSkuId: string): BenefitPackageDraft {
  const line = draft.goods.find(item => item.id === lineId)
  if (!line) throw new Error('待替换商品已不存在，请重新查看清单。')
  if (line.skuId === newSkuId) return cloneBenefit(draft)
  const next = cloneBenefit(draft); next.goods = next.goods.filter(item => item.id !== lineId)
  const added = addBenefitSku(data, next, newSkuId, line.quantity)
  if (added.includedPhoneSkuId === line.skuId) added.includedPhoneSkuId = compatibilityRecordRole(data, newSkuId) === 'host' ? newSkuId : ''
  return added
}
export function setBenefitDevice(data: AppData, draft: BenefitPackageDraft, device: BenefitDeviceContext, replaceIncludedPhone = false): BenefitPackageDraft {
  const next = cloneBenefit(draft), previous = next.includedPhoneSkuId
  next.device = cloneBenefit(device)
  if (replaceIncludedPhone && previous) {
    if (device?.kind !== 'sku' || compatibilityRecordRole(data, device.skuId) !== 'host') throw new Error('替换包内手机须选择具体销售手机 SKU。')
    const original = next.goods.find(line => line.skuId === previous)
    if (original) {
      next.goods = next.goods.filter(line => line.skuId !== previous)
      next.includedPhoneSkuId=device.skuId
      const replaced = addBenefitSku(data, next, device.skuId, original.quantity)
      replaced.includedPhoneSkuId = device.skuId
      return touchComposition(replaced)
    }
  }
  return touchComposition(next)
}
export function setBenefitIncludedPhone(data: AppData, draft: BenefitPackageDraft, include: boolean): BenefitPackageDraft {
  const next = cloneBenefit(draft)
  if (!include) { next.goods = next.goods.filter(line => line.skuId !== next.includedPhoneSkuId); next.includedPhoneSkuId = ''; return touchComposition(next) }
  if (next.device?.kind !== 'sku' || compatibilityRecordRole(data, next.device.skuId) !== 'host') throw new Error('只有具体销售手机 SKU 才能加入实物清单。')
  const target = next.device.skuId
  // The explicit inclusion switch links an existing row; it does not increment it again.
  next.includedPhoneSkuId=target
  const result = next.goods.some(line => line.skuId === target) ? next : addBenefitSku(data, next, target)
  result.includedPhoneSkuId = target
  return touchComposition(result)
}
function compatibilitySummary(skuId: string, match: AccessoryMatch | undefined, needsCheck: boolean, hasDevice: boolean): BenefitCompatibilitySummary {
  const capabilities: BenefitCapabilitySummary[] = (match?.capabilities || []).map(capability => ({ capability: capability.capability, status: capability.status, conditions: capability.conditions.map(condition => ({ state: condition.state, label: condition.label })), declarationIds: capability.declarations.map(link => link.id), sources: capability.declarations.map(link => link.source || '历史正式适用关系；核验依据未记录') }))
  const basic = capabilities.find(item => item.capability === 'basic'), fast = capabilities.find(item => item.capability === 'fast-charge')
  return { skuId, basicStatus: !hasDevice ? 'unchecked' : !needsCheck ? 'not-required' : basic?.status || 'pending', fastChargeStatus: fast?.status || (!hasDevice ? 'unchecked' : 'pending'), reasons: match?.reasons || [!hasDevice ? '普通组合包，未做设备适配校验。' : !needsCheck ? '该项目不作为配件执行适配声明校验。' : '尚无可确认的销售 SKU 基本使用声明，请维护适用关系。'], capabilities }
}
function confirmationKey(skuId: string, capability: 'basic' | 'fast-charge') { return stable([skuId, capability]) }
function hasConfirmation(draft: BenefitPackageDraft, key: string, basis: string) { return draft.confirmations.some(item => item.key === key && item.basis === basis && item.note.trim() && Number.isFinite(Date.parse(item.confirmedAt))) }
export function validateBenefitPackage(data: AppData, draft: BenefitPackageDraft): BenefitValidation {
  const issues: BenefitIssue[] = benefitRuleStructureIssues(draft.groups), add = (code: string, message: string, structural = false, extra: Partial<BenefitIssue> = {}) => issues.push({ code, message, severity: 'error', structural, ...extra })
  if (!draft.name.trim()) add('name', '请填写权益包名称。')
  if (!draft.goods.length && !draft.services.length) add('empty', '请至少添加一项商品或服务权益。')
  if (!['draft', 'available', 'disabled'].includes(draft.status)) add('status', '权益包状态无效。', true)
  if (!Number.isSafeInteger(draft.revision) || draft.revision < 0) add('revision', '权益包修订版本无效。', true)
  if (draft.quote.currency !== 'CNY' || draft.quote.amountCents !== null && !validBenefitCents(draft.quote.amountCents)) add('quote', '报价必须为空或安全范围内的非负整数分。', true)
  const query = deviceQuery(data, draft.device), deviceValid = !draft.device || query?.device.status === 'resolved'
  const deviceLabel = !draft.device ? '普通组合包 · 未做设备适配校验' : draft.device.kind === 'sku' ? [benefitSkuSummary(data, draft.device.skuId)?.name || draft.device.skuId, query?.device.host?.steps.map(step => step.valueId).join(' · ')].filter(Boolean).join(' · ') : draft.device.host.steps.map(step => step.valueId).join(' · ')
  if (!deviceValid) add('device', query?.device.message || '适配设备尚未唯一确认，请处理型号或引用。')
  const matches = new Map([...(query?.sales || []), ...(query?.materials || []), ...(query?.pending || []), ...(query?.excluded || []), ...(query?.unavailable || [])].filter(item => item.target.kind === 'sku').map(item => [item.target.id, item]))
  const lineIds = new Set<string>(), skuIds = new Set<string>()
  let physicalCount = 0, serviceCount = 0
  const goods = draft.goods.map(line => {
    const summary = benefitSkuSummary(data, line.skuId), original = data.skus.find(sku => sku.id === line.skuId), family = original && data.families.find(item => item.id === original.familyId)
    if (!line.id || lineIds.has(line.id) || skuIds.has(line.skuId)) add('goods-identity', '商品行身份重复，请合并同一 SKU。', true, { skuId: line.skuId })
    lineIds.add(line.id); skuIds.add(line.skuId)
    if (!validBenefitQuantity(line.quantity)) add('goods-quantity', `${summary?.name || line.snapshot.name}的每包数量须为正整数。`, true, { skuId: line.skuId })
    else { physicalCount += line.quantity; if (!Number.isSafeInteger(physicalCount)) add('goods-total', '商品汇总数量超出安全范围。', true) }
    const available = Boolean(summary && family && summary.status === 'on_sale' && shelfOf(family) === 'online')
    if (!summary) add('sku-reference', `${line.snapshot.name || line.skuId}的销售 SKU 引用失效，原条目已保留。`, false, { skuId: line.skuId })
    else if (!available) add('sku-unavailable', `${summary.name}当前不在售，请替换或移除。`, false, { skuId: line.skuId })
    if (draft.device && summary && (!summary.productTypeId || !data.productTypes.some(type => type.id === summary.productTypeId))) add('sku-type-reference', `${summary.name}的产品类型尚未确认，无法完成设备适配校验。`, false, { skuId: line.skuId })
    const compatibility = compatibilitySummary(line.skuId, matches.get(line.skuId), compatibilityRecordRole(data, line.skuId) === 'accessory', Boolean(draft.device))
    return { line, summary: summary || cloneBenefit(line.snapshot), available, compatibility }
  })
  for (const service of draft.services) {
    if (!service.id || lineIds.has(service.id)) add('service-identity', '服务条目 ID 缺失或重复。', true)
    lineIds.add(service.id)
    if (!service.name.trim() || !service.unit.trim()) add('service-description', '请填写服务名称和单位。', false, { serviceId: service.id, field: !service.name.trim() ? 'name' : 'unit' })
    if (!validBenefitQuantity(service.quantity)) add('service-quantity', '服务数量必须为正整数。', true, { serviceId: service.id, field: 'quantity' })
    else { serviceCount += service.quantity; if (!Number.isSafeInteger(serviceCount)) add('service-total', '服务汇总数量超出安全范围。', true) }
    if (!['per-package', 'per-delivery'].includes(service.measurement)) add('service-measurement', '服务计量方式无效。', true)
  }
  if (draft.includedPhoneSkuId && (!draft.goods.some(line => line.skuId === draft.includedPhoneSkuId) || compatibilityRecordRole(data, draft.includedPhoneSkuId) !== 'host')) add('included-phone', '包内手机引用失效，需明确移除或替换。')
  if(!draft.framework&&draft.groups.some(g=>g.scope))add('unsupported-scope','旧白名单规则中的扩展范围尚不支持，请使用正式类型框架。')
  if (draft.rulesEnabled && !draft.framework) {
    const owners = new Map<string, string>()
    for (const group of draft.groups.filter(item => item.enabled)) {
      const extra = { groupId: group.id }
      if (!group.name.trim()) add('group-name', '请填写选配组名称。', false, extra)
      if (!group.candidateSkuIds.length || new Set(group.candidateSkuIds).size !== group.candidateSkuIds.length) add('group-candidates', `选配组「${group.name}」候选不能为空或重复。`, false, extra)
      const kindsInvalid = !Number.isSafeInteger(group.minKinds) || group.minKinds < 0 || !validBenefitQuantity(group.maxKinds)
      if (!kindsInvalid && (group.minKinds > group.maxKinds || group.maxKinds > group.candidateSkuIds.length || group.required && group.minKinds < 1)) add('group-kinds', `选配组「${group.name}」的种数范围无效。`, false, { ...extra, field: 'maxKinds' })
      const quantityInvalid = ![group.defaultQuantity, group.minQuantity, group.maxQuantity].every(validBenefitQuantity)
      if (!quantityInvalid && (group.minQuantity > group.defaultQuantity || group.defaultQuantity > group.maxQuantity)) add('group-quantity', `选配组「${group.name}」的每种件数范围无效。`, false, { ...extra, field: 'defaultQuantity' })
      for (const skuId of group.candidateSkuIds) {
        const summary = benefitSkuSummary(data, skuId), family = summary && data.families.find(item => item.id === summary.familyId)
        if (!summary || summary.status !== 'on_sale' || !family || shelfOf(family) !== 'online') add('group-reference', `选配组「${group.name}」的候选 ${summary?.name || skuId}已停售或引用失效。`, false, { ...extra, skuId })
        const owner = owners.get(skuId)
        if (owner) add('group-overlap', `SKU ${summary?.code || skuId}同时属于「${owner}」和「${group.name}」，不能重复归属启用组。`, false, { ...extra, skuId })
        owners.set(skuId, group.name)
      }
      const selected = draft.goods.filter(line => group.candidateSkuIds.includes(line.skuId)), effectiveMin = group.required || selected.length ? group.minKinds : 0
      if (selected.length < effectiveMin || selected.length > group.maxKinds) add('group-selection', `选配组「${group.name}」须选择 ${effectiveMin}～${group.maxKinds} 种商品，当前 ${selected.length} 种。`, false, extra)
      for (const line of selected) if (!group.adjustable ? line.quantity !== group.defaultQuantity : line.quantity < group.minQuantity || line.quantity > group.maxQuantity) add('group-selected-quantity', `选配组「${group.name}」中每种商品的数量不符合 ${group.adjustable ? `${group.minQuantity}～${group.maxQuantity}` : group.defaultQuantity} 件约定。`, false, { ...extra, skuId: line.skuId })
    }
  }
  if(draft.framework&&frameworkSnapshotProblem(draft.framework))add('framework-structure',frameworkSnapshotProblem(draft.framework),true)
  else issues.push(...frameworkSelectionIssues(data,draft))
  for(const line of draft.goods)try{referenceLine(line.referencePrice,line.quantity)}catch(e){add('reference-price',String(e),true,{skuId:line.skuId})}
  for(const line of draft.services)try{referenceLine(line.referencePrice,line.quantity)}catch(e){add('reference-price',String(e),true,{serviceId:line.id})}
  try{benefitReferenceTotals(draft)}catch(e){add('reference-price',e instanceof Error?e.message:String(e),true)}
  const relevantIds = new Set(draft.goods.map(line => line.skuId))
  const basis = stable({ composition: benefitCompositionBasis(draft), device: query ? { status: query.device.status, host: query.device.host, planningId: query.device.planningId, attributes: query.device.attributes, sourceStamp: query.device.sourceStamp } : null, goods: goods.map(item => ({ summary: item.summary, available: item.available, compatibility: item.compatibility })), declarations: data.compatibilities.filter(link => relevantIds.has(link.targetId || link.accessorySkuId)) })
  const assess = (item: BenefitValidation['goods'][number], capability: 'basic' | 'fast-charge') => {
    const status = capability === 'basic' ? item.compatibility.basicStatus : item.compatibility.fastChargeStatus, label = capability === 'basic' ? '基本使用' : '快充能力'
    if (status === 'incompatible') add('compatibility-excluded', `${item.summary.name}的${label}明确不适用，不能生成正式清单。`, false, { skuId: item.line.skuId })
    else if (status === 'pending') add('compatibility-pending', `${item.summary.name}的${label}尚未确认，请维护适用关系。`, false, { skuId: item.line.skuId })
    else if (status === 'conditional') {
      const key = confirmationKey(item.line.skuId, capability)
      if (!hasConfirmation(draft, key, basis)) issues.push({ code: 'condition-confirmation', message: `${item.summary.name}的${label}有使用前提，须确认按当前条件交付。`, severity: 'condition', skuId: item.line.skuId, confirmationKey: key })
    }
  }
  if (draft.device && deviceValid) {
    for (const item of goods) if (compatibilityRecordRole(data, item.line.skuId) === 'accessory') assess(item, 'basic')
    if (draft.requireFastCharge) {
      const capable = goods.filter(item => item.compatibility.capabilities.some(capability => capability.capability === 'fast-charge'))
      if (!capable.length) add('fast-charge-unconfirmed', '尚无已维护快充能力的包内商品，不能承诺整包快充。')
      for (const item of capable) assess(item, 'fast-charge')
    }
  } else if (draft.requireFastCharge && !draft.device) add('fast-charge-device', '要求快充能力时，请先选择并确认适配设备。')
  const quoteNeedsReview = draft.quote.amountCents !== null && draft.quote.reviewedBasis !== benefitCompositionBasis(draft)
  if (quoteNeedsReview) issues.push({ code: 'quote-review', message: '组成或数量已变化，当前报价保留为待复核参考；正式交付须确认完整组成和报价。', severity: 'warning' })
  return { issues, goods, deviceLabel, deviceValid, canSaveDraft: !issues.some(issue => issue.structural), canSaveAvailable: !issues.some(issue => issue.severity === 'error'), canDeliver: !issues.some(issue => issue.severity === 'error' || issue.severity === 'condition'), basis, physicalCount, serviceCount, quoteNeedsReview }
}
export function confirmBenefitCondition(data: AppData, draft: BenefitPackageDraft, skuId: string, note: string, now: string, capability: 'basic' | 'fast-charge' = 'basic'): BenefitPackageDraft {
  if (!note.trim() || !Number.isFinite(Date.parse(now))) throw new Error('请填写本次条件确认说明和有效时间。')
  const validation = validateBenefitPackage(data, draft), line = validation.goods.find(item => item.line.skuId === skuId), detail = line?.compatibility.capabilities.find(item => item.capability === capability)
  if (!line || !detail || detail.status !== 'conditional') throw new Error('只有当前明确有条件适用的项目可以按前提确认；待确认或不适用不能人工升级。')
  const key = confirmationKey(skuId, capability), next = cloneBenefit(draft)
  const confirmation: BenefitConditionConfirmation = { key, skuId, capability, device: cloneBenefit(draft.device), declarationIds: cloneBenefit(detail.declarationIds), conditionLabels: detail.conditions.map(condition => condition.label), note: note.trim(), confirmedAt: now, basis: validation.basis }
  next.confirmations = next.confirmations.filter(item => item.key !== key); next.confirmations.push(confirmation)
  return next
}
export function previewBenefitDelivery(data: AppData, saved: BenefitPackage, packageCount: number): BenefitDeliveryPreview {
  const validation = validateBenefitPackage(data, saved), issues = cloneBenefit(validation.issues)
  if (!saved.id || !saved.code || saved.revision < 1) issues.push({ code: 'unsaved', message: '请先保存权益包，再生成交付清单。', severity: 'error' })
  if (saved.status !== 'available') issues.push({ code: 'package-status', message: saved.status === 'disabled' ? '停用包不能生成新的交付清单。' : '请先将完整配置保存为可用权益包。', severity: 'error' })
  if (!validBenefitQuantity(packageCount)) issues.push({ code: 'package-count', message: '本次包数必须为安全范围内的正整数。', severity: 'error' })
  const product = (quantity: number, factor: number): number => { try { return multiplyBenefitQuantity(quantity, factor) } catch { issues.push({ code: 'delivery-quantity', message: '交付数量无效或乘法溢出。', severity: 'error' }); return 0 } }
  const price=(p:Parameters<typeof referenceLine>[0],q:number)=>{try{return referenceLine(p,q)}catch(e){issues.push({code:'reference-price',message:String(e),severity:'error'});return null}}
  const goods = validation.goods.map(item => ({ ...cloneBenefit(item.summary), lineId: item.line.id, ...(item.line.referencePrice?{referencePrice:cloneBenefit(item.line.referencePrice)}:{}),referenceLineCents:price(item.line.referencePrice,item.line.quantity),referenceTotalCents:price(item.line.referencePrice,product(item.line.quantity,packageCount)), perPackageQuantity: item.line.quantity, totalQuantity: product(item.line.quantity, packageCount), compatibility: cloneBenefit(item.compatibility) }))
  const hostSkuIds = goods.filter(item => compatibilityRecordRole(data, item.skuId) === 'host').map(item => item.skuId)
  const services = saved.services.map(service => ({ ...cloneBenefit(service),referenceLineCents:price(service.referencePrice,service.quantity),referenceTotalCents:price(service.referencePrice,service.measurement==='per-delivery'?service.quantity:product(service.quantity,packageCount)), perPackageQuantity: service.quantity, totalQuantity: service.measurement === 'per-delivery' ? service.quantity : product(service.quantity, packageCount) }))
  const totalCents = saved.quote.amountCents === null ? null : saved.quote.amountCents * packageCount
  if (totalCents !== null && !validBenefitCents(totalCents)) issues.push({ code: 'delivery-quote', message: '本次总报价无效或超出安全范围。', severity: 'error' })
  let referenceTotals:ReturnType<typeof benefitReferenceTotals>|undefined
  try{referenceTotals=benefitReferenceTotals(saved,packageCount)}catch(e){issues.push({code:'reference-price',message:String(e),severity:'error'})}
  if(saved.framework&&validation.quoteNeedsReview)issues.push({code:'quote-review',message:'组成或参考价格已变，请明确复核整包报价。',severity:'error'})
  else if(saved.goods.some(l=>l.referencePrice)||saved.services.some(l=>l.referencePrice)){if(validation.quoteNeedsReview)issues.push({code:'quote-review',message:'参考价格或成员已变，请明确复核整包报价。',severity:'error'})}
  const basis = stable({ validation: validation.basis, packageId: saved.id, sourceRevision: saved.revision, name: saved.name, packageCount, quote: saved.quote, confirmations: saved.confirmations })
  return { ...(saved.framework?{framework:cloneBenefit(saved.framework)}:{}),...(referenceTotals?{referenceTotals}:{}), packageId: saved.id, packageCode: saved.code, sourceRevision: saved.revision, packageName: saved.name, packageCount, device: cloneBenefit(saved.device), deviceLabel: validation.deviceLabel, includedPhoneSkuId: saved.includedPhoneSkuId, hostSkuIds, goods, services, quote: { currency: 'CNY', amountCents: saved.quote.amountCents, totalCents, needsReview: validation.quoteNeedsReview }, confirmations: saved.confirmations.filter(item => item.basis === validation.basis).map(cloneBenefit), issues, canConfirm: !issues.some(issue => issue.severity === 'error' || issue.severity === 'condition'), basis }
}
export function createBenefitDeliverySnapshot(preview: BenefitDeliveryPreview, identity: { id: string; code: string; requestId: string; generatedAt: string }): BenefitDeliverySnapshot {
  if (!preview.canConfirm || !identity.id || !identity.code || !identity.requestId || !Number.isFinite(Date.parse(identity.generatedAt))) throw new Error('交付清单尚未通过确认校验。')
  return { ...cloneBenefit(preview), ...identity, snapshotVersion: 1 }
}

function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function string(value: unknown): value is string { return typeof value === 'string' }
function strings(value: unknown) { return Array.isArray(value) && value.every(string) }
function hostShape(value: unknown): value is CompatibilityHost {
  return object(value) && ['model', 'planning'].includes(String(value.scope)) && string(value.productTypeId) && string(value.productModelId) && string(value.identityKey) && Array.isArray(value.steps) && value.steps.every(step => object(step) && string(step.attributeId) && string(step.attributeName) && string(step.valueId)) && (value.scope !== 'planning' || string(value.planningId))
}
function deviceShape(value: unknown) { return value === null || object(value) && (value.kind === 'sku' ? string(value.skuId) : value.kind === 'model' && hostShape(value.host)) }
function summaryShape(value: unknown) { return object(value) && ['skuId', 'code', 'name', 'familyId', 'familyName', 'spec', 'productTypeId', 'typeName', 'status'].every(key => string(value[key])) }
function capabilityShape(value: unknown) { return object(value) && ['basic', 'fast-charge', 'other'].includes(String(value.capability)) && ['compatible', 'conditional', 'incompatible', 'pending', 'not-required', 'unchecked'].includes(String(value.status)) && strings(value.declarationIds) && strings(value.sources) && Array.isArray(value.conditions) && value.conditions.every(item => object(item) && ['met', 'unmet', 'unknown'].includes(String(item.state)) && string(item.label)) }
function compatibilityShape(value: unknown) { return object(value) && string(value.skuId) && ['compatible', 'conditional', 'incompatible', 'pending', 'not-required', 'unchecked'].includes(String(value.basicStatus)) && ['compatible', 'conditional', 'incompatible', 'pending', 'not-required', 'unchecked'].includes(String(value.fastChargeStatus)) && strings(value.reasons) && Array.isArray(value.capabilities) && value.capabilities.every(capabilityShape) }
function serviceShape(value: unknown) { return object(value) && ['id', 'name', 'unit', 'validity', 'description'].every(key => string(value[key])) && validBenefitQuantity(value.quantity) && ['per-package', 'per-delivery'].includes(String(value.measurement)) }
function validDate(value: unknown) { return string(value) && Number.isFinite(Date.parse(value)) }
function confirmationShape(value: unknown) { return object(value) && ['key', 'skuId', 'note', 'basis'].every(key => string(value[key]) && Boolean(value[key].trim())) && validDate(value.confirmedAt) && ['basic', 'fast-charge'].includes(String(value.capability)) && value.key === confirmationKey(String(value.skuId), value.capability as 'basic' | 'fast-charge') && deviceShape(value.device) && strings(value.declarationIds) && strings(value.conditionLabels) }
/** The same persisted rule shape is required while enabled, disabled, saving or loading.
 * Business completeness (candidate availability, ranges and selection) is checked separately. */
export function benefitRuleStructureIssues(groups: unknown): BenefitIssue[] {
  const issues: BenefitIssue[] = []
  const add = (message: string, groupId?: string, field?: string) => issues.push({ code: 'group-structure', message, severity: 'error', structural: true, groupId, field })
  if (!Array.isArray(groups)) { add('选配规则集合必须为数组。', undefined, 'groups'); return issues }
  const ids = new Set<string>()
  const numericFields = { minKinds: '最少选择种数', maxKinds: '最多选择种数', defaultQuantity: '每种默认件数', minQuantity: '每种最少件数', maxQuantity: '每种最多件数' }
  for (const [index, group] of groups.entries()) {
    if (!object(group)) { add(`第 ${index + 1} 个选配组结构无效。`, undefined, 'groups'); continue }
    const groupId = string(group.id) ? group.id : undefined, label = string(group.name) && group.name.trim() ? `「${group.name}」` : `第 ${index + 1} 个选配组`
    if (!groupId || ids.has(groupId)) add(`${label}身份缺失或重复。`, groupId, 'id')
    if (groupId) ids.add(groupId)
    if (!string(group.name)) add(`${label}名称结构无效。`, groupId, 'name')
    for (const field of ['enabled', 'required', 'adjustable'] as const) if (typeof group[field] !== 'boolean') add(`${label}启用与选配设置结构无效。`, groupId, field)
    if(group.scope!==undefined&&(!object(group.scope)||typeof group.scope.kind!=='string'||!strings(group.scope.productTypeIds)||typeof group.scope.compatibleOnly!=='boolean'))add(`${label}类型范围结构无效。`,groupId,'scope')
    if (!strings(group.candidateSkuIds)) add(`${label}候选 SKU 集合结构无效。`, groupId, 'candidateSkuIds')
    for (const [field, title] of Object.entries(numericFields)) {
      const value = group[field], valid = field === 'minKinds' ? typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 : validBenefitQuantity(value)
      if (!valid) add(`${label}的${title}必须是安全范围内的${field === 'minKinds' ? '非负整数（可为 0）' : '正整数（至少 1）'}；停用时也需修正后保存。`, groupId, field)
    }
  }
  return issues
}
/** Structural import validation intentionally retains dangling configuration references and independent history. */
export function benefitPackageImportProblems(data: unknown): string[] {
  if (!object(data)) return ['权益包数据结构无效。']
  const problems: string[] = [], packageIds = new Set<string>(), packageCodes = new Set<string>(), requests = new Set<string>()
  if (data.benefitPackages !== undefined && !Array.isArray(data.benefitPackages)) problems.push('权益包配置集合须为数组。')
  for (const value of Array.isArray(data.benefitPackages) ? data.benefitPackages : []) {
    if (!object(value) || !['id', 'code', 'name', 'createdAt', 'updatedAt', 'includedPhoneSkuId'].every(key => string(value[key])) || !value.id || !value.code || !validDate(value.createdAt) || !validDate(value.updatedAt) || !validBenefitQuantity(value.revision) || !['draft', 'available', 'disabled'].includes(String(value.status)) || typeof value.favorite !== 'boolean' || typeof value.requireFastCharge !== 'boolean' || typeof value.rulesEnabled !== 'boolean' || !deviceShape(value.device) || !strings(value.issues)) { problems.push('权益包身份或基本结构无效。'); continue }
    if (packageIds.has(String(value.id)) || packageCodes.has(String(value.code))) problems.push('权益包 ID 或编号重复。')
    packageIds.add(String(value.id)); packageCodes.add(String(value.code))
    if (value.creationRequestId !== undefined) { if (!string(value.creationRequestId) || !value.creationRequestId || requests.has(value.creationRequestId)) problems.push('权益包创建请求重复或无效。'); else requests.add(value.creationRequestId) }
    if (!Array.isArray(value.goods) || value.goods.some(line => !object(line) || !string(line.id) || !line.id || !string(line.skuId) || !line.skuId || !validBenefitQuantity(line.quantity) || !summaryShape(line.snapshot) || !object(line.snapshot) || line.snapshot.skuId !== line.skuId)) problems.push('权益包实物条目结构、身份或数量无效。')
    else if (new Set(value.goods.map(line => line.skuId)).size !== value.goods.length || new Set(value.goods.map(line => line.id)).size !== value.goods.length) problems.push('权益包实物身份重复。')
    if (!Array.isArray(value.services) || !value.services.every(serviceShape) || new Set(value.services.map(line => line.id)).size !== value.services.length || value.services.some(line => !line.id || Array.isArray(value.goods) && value.goods.some(goods => object(goods) && goods.id === line.id))) problems.push('权益包服务条目无效。')
    problems.push(...benefitRuleStructureIssues(value.groups).map(issue => `权益包「${value.name || value.code}」：${issue.message}`))
    if (!object(value.quote) || value.quote.currency !== 'CNY' || value.quote.amountCents !== null && !validBenefitCents(value.quote.amountCents) || !string(value.quote.reviewedBasis)) problems.push('权益包报价无效。')
    if (!Array.isArray(value.confirmations) || !value.confirmations.every(confirmationShape) || new Set(value.confirmations.map(item => item.key)).size !== value.confirmations.length) problems.push('权益包人工条件确认结构无效。')
  }
  const deliveryIds = new Set<string>(), deliveryCodes = new Set<string>(), deliveryRequests = new Set<string>()
  if (data.benefitDeliveries !== undefined && !Array.isArray(data.benefitDeliveries)) problems.push('交付清单集合须为数组。')
  for (const value of Array.isArray(data.benefitDeliveries) ? data.benefitDeliveries : []) {
    if (!object(value) || !['id', 'code', 'requestId', 'generatedAt', 'packageId', 'packageCode', 'packageName', 'deviceLabel', 'includedPhoneSkuId', 'basis'].every(key => string(value[key])) || !value.id || !value.code || !value.requestId || !value.packageId || !value.packageCode || !value.packageName || !value.basis || !validDate(value.generatedAt) || value.snapshotVersion !== 1 || !validBenefitQuantity(value.sourceRevision) || !validBenefitQuantity(value.packageCount) || !deviceShape(value.device) || value.canConfirm !== true) { problems.push('交付清单身份或快照结构无效。'); continue }
    if (deliveryIds.has(String(value.id)) || deliveryCodes.has(String(value.code)) || deliveryRequests.has(String(value.requestId))) problems.push('交付清单 ID、编号或请求重复。')
    deliveryIds.add(String(value.id)); deliveryCodes.add(String(value.code)); deliveryRequests.add(String(value.requestId))
    if (!Array.isArray(value.goods) || value.goods.some(line => !summaryShape(line) || !object(line) || !line.skuId || !string(line.lineId) || !line.lineId || !validBenefitQuantity(line.perPackageQuantity) || !validBenefitQuantity(line.totalQuantity) || !Number.isSafeInteger(Number(line.perPackageQuantity) * Number(value.packageCount)) || line.totalQuantity !== Number(line.perPackageQuantity) * Number(value.packageCount) || !compatibilityShape(line.compatibility) || !object(line.compatibility) || line.compatibility.skuId !== line.skuId) || new Set(value.goods.map(line => line.skuId)).size !== value.goods.length || new Set(value.goods.map(line => line.lineId)).size !== value.goods.length || value.includedPhoneSkuId && !value.goods.some(line => line.skuId === value.includedPhoneSkuId)) problems.push('交付商品身份、明细或总数量无效。')
    if (!strings(value.hostSkuIds) || !Array.isArray(value.hostSkuIds) || new Set(value.hostSkuIds).size !== value.hostSkuIds.length || value.hostSkuIds.some(id => !id || !Array.isArray(value.goods) || !value.goods.some(line => object(line) && line.skuId === id)) || string(value.includedPhoneSkuId) && value.includedPhoneSkuId && !value.hostSkuIds.includes(value.includedPhoneSkuId)) problems.push('交付主机身份须为商品明细中的唯一 SKU 引用。')
    if (!Array.isArray(value.services) || value.services.some(line => !serviceShape(line) || !object(line) || !string(line.id) || !line.id || !string(line.name) || !line.name.trim() || !string(line.unit) || !line.unit.trim() || !validBenefitQuantity(line.perPackageQuantity) || !validBenefitQuantity(line.totalQuantity) || line.quantity !== line.perPackageQuantity || line.totalQuantity !== (line.measurement === 'per-delivery' ? line.quantity : Number(line.quantity) * Number(value.packageCount))) || new Set(value.services.map(line => line.id)).size !== value.services.length) problems.push('交付服务明细或计量无效。')
    if (!object(value.quote) || value.quote.currency !== 'CNY' || typeof value.quote.needsReview !== 'boolean' || (value.quote.amountCents === null ? value.quote.totalCents !== null : !validBenefitCents(value.quote.amountCents) || !validBenefitCents(value.quote.totalCents) || value.quote.totalCents !== Number(value.quote.amountCents) * Number(value.packageCount))) problems.push('交付清单报价无效。')
    if (!Array.isArray(value.confirmations) || !value.confirmations.every(confirmationShape) || !Array.isArray(value.issues) || value.issues.some(issue => !object(issue) || !string(issue.code) || !string(issue.message) || issue.severity !== 'warning')) problems.push('交付清单条件或确认说明无效。')
  }
  for(const record of [...(Array.isArray(data.benefitPackages)?data.benefitPackages:[]),...(Array.isArray(data.benefitDeliveries)?data.benefitDeliveries:[])])if(object(record)){
    for(const key of ['goods','services'])if(Array.isArray(record[key]))for(const line of record[key])if(object(line)){const e=referencePriceProblem(line.referencePrice);if(e)problems.push(e)}
  }
  if(!problems.length)for(const d of (data.benefitDeliveries||[]) as BenefitDeliverySnapshot[]){
    if(d.referenceTotals!==undefined){try{
      const totals=benefitReferenceTotals({goods:d.goods.map(l=>({...l,id:l.lineId,snapshot:l,quantity:l.perPackageQuantity})),services:d.services,quote:{...d.quote,reviewedBasis:''}},d.packageCount)
      if(stable(totals)!==stable(d.referenceTotals))problems.push('交付参考合计与冻结行金额不一致。')
      for(const l of [...d.goods,...d.services])if(l.referenceLineCents!==referenceLine(l.referencePrice,l.perPackageQuantity)||l.referenceTotalCents!==referenceLine(l.referencePrice,l.totalQuantity))problems.push('交付参考行金额与冻结数量不一致。')
    }catch(e){problems.push(`交付参考金额无效：${String(e)}`)}}
    else if([...d.goods,...d.services].some(l=>l.referencePrice!==undefined||l.referenceLineCents!==undefined||l.referenceTotalCents!==undefined))problems.push('新参考价格明细缺少冻结合计。')
  }
  if(!problems.length)problems.push(...frameworkImportProblems(data as unknown as AppData))
  return [...new Set(problems)]
}
export function benefitPackageReferenceProblem(data: AppData, kind: 'sku' | 'model' | 'type' | 'plan', id: string): string | undefined {
  if(kind==='type'){const block=frameworkReference(data,'type',id);if(block)return block}
  for (const item of data.benefitPackages || []) {
    const skuIds = new Set([...item.goods.map(line => line.skuId), ...item.groups.flatMap(group => group.candidateSkuIds), ...(item.device?.kind === 'sku' ? [item.device.skuId] : [])])
    const affected = kind === 'sku' ? skuIds.has(id) : item.device?.kind === 'model' && (kind === 'model' ? [id, `device:${id}`, `template:${id}`].includes(item.device.host.productModelId) : kind === 'type' ? item.device.host.productTypeId === id : item.device.host.planningId === id) || [...skuIds].some(skuId => {
      const sku = data.skus.find(record => record.id === skuId), family = sku && data.families.find(record => record.id === sku.familyId)
      return kind === 'model' ? [family?.templateId, family?.productModelId, sku?.creationSource?.templateId].includes(id) : kind === 'type' ? family?.productTypeId === id : [sku?.creationSource?.productPlanId, family?.productPlanId].includes(id)
    })
    if (affected) return `不能删除：权益包「${item.name || item.code}」（${item.code}）仍引用该对象。请到权益包管理移除或更换配置引用。`
  }
  return undefined
}
