import { resolveBenefitRange, frameworkSelectionIssues, frameworkImportProblems, frameworkSnapshotProblem, frameworkReference } from './benefitFrameworks'
import type { BenefitSelectionIndex } from './benefitFrameworks'
import { benefitCompositionVersion, benefitPositionStructureIssues, benefitGroupSelection } from './benefitPositions'
import { referencePriceProblem, referenceLine, benefitReferenceTotals } from './benefitPricing'
import { isRealSku } from './catalogIdentity'
import { compatibilityRecordRole } from './deviceResolution'
import { queryDeviceAccessories, queryModelAccessories } from './accessoryCompatibilityQuery'
import { savedSkuCode, savedSkuName, savedSkuSpec } from './productList'
import { shelfOf } from './logic'
import { salesDeviceAdmission } from './salesCatalog'
import { salesMetadataProblems, salesPositionIdentityProblems, salesPositionCompatibility, salesSelectionEvidence, salesSelectionIssues, synchronizeSalesGroupIds, pruneSalesContexts } from './salesSelection'
import type { AppData, CompatibilityHost } from './types'
import type { AccessoryMatch, AccessoryQueryResult } from './accessoryCompatibilityTypes'
import type { BenefitCapabilitySummary, BenefitCompatibilitySummary, BenefitConditionConfirmation, BenefitDeliveryPreview, BenefitDeliverySnapshot, BenefitDeviceContext, BenefitIssue, BenefitPackage, BenefitPackageDraft, BenefitSkuSummary, BenefitValidation, BenefitReferencePrice, BenefitDeliveryGoods, BenefitDeliverySkuTotal } from './benefitPackageTypes'
let positionSequence = 0
const newPositionId = () => `position:${Date.now().toString(36)}:${++positionSequence}`

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
  return { compositionVersion: 2, id: '', code: '', revision: 0, name: '', status: 'draft', favorite: false, device: cloneBenefit(device), includedPhoneSkuId: '', requireFastCharge: false, goods: [], services: [], rulesEnabled: false, groups: [], quote: { currency: 'CNY', amountCents: null, reviewedBasis: '' }, confirmations: [], issues: [], createdAt: '', updatedAt: '' }
}
export function benefitCompositionBasis(draft: BenefitPackageDraft): string {
  return stable({ ...(draft.compositionVersion!==undefined?{compositionVersion:draft.compositionVersion}:{}), ...(draft.sales?{sales:draft.sales}:{}), device: draft.device, includedPhoneSkuId: draft.includedPhoneSkuId, requireFastCharge: draft.requireFastCharge, goods: draft.goods.map(line => ({ id: line.id, skuId: line.skuId, quantity: line.quantity, ...(line.groupId!==undefined?{groupId:line.groupId}:{}),...(line.role!==undefined?{role:line.role}:{}), ...(line.referencePrice ? {referencePrice:line.referencePrice} : {}) })), ...(draft.framework ? {framework:draft.framework} : {}), services: draft.services, rulesEnabled: draft.rulesEnabled, groups: draft.groups })
}
export function reviewBenefitQuote(draft: BenefitPackageDraft,data?:AppData,index?:BenefitSelectionIndex): BenefitPackageDraft {
  if(benefitCompositionVersion(draft)===2&&!data)throw Error('新版组合报价复核需要当前商品及适配依据，请重新执行复核。')
  const next = cloneBenefit(draft); next.quote.reviewedBasis = benefitCompositionVersion(next)===2?`selection:${validateBenefitPackage(data!,next,index).basis}`:benefitCompositionBasis(next); return next
}
export function copyBenefitPackageDraft(source: BenefitPackage): BenefitPackageDraft {
  const next = cloneBenefit(source)
  next.id = ''; next.code = ''; next.revision = 0; next.name = `${source.name || '权益包'} 副本`; next.status = 'draft'
  next.createdAt = ''; next.updatedAt = ''; delete next.creationRequestId
  delete next.creationIntent; delete next.saveReceipt; delete next.saveReceipts
  if(benefitCompositionVersion(next)===2){const ids=new Map(next.goods.map(line=>[line.id,newPositionId()]));for(const line of next.goods)line.id=ids.get(line.id)!;if(next.sales?.schemaVersion===1){for(const origin of next.sales.origins){origin.positionId=ids.get(origin.positionId)||origin.positionId;if(origin.sourcePositionId)origin.sourcePositionId=ids.get(origin.sourcePositionId)||origin.sourcePositionId}for(const context of next.sales.contexts)if(context.sourcePositionId)context.sourcePositionId=ids.get(context.sourcePositionId)||context.sourcePositionId}}
  next.confirmations = []; next.issues = []; next.quote.reviewedBasis = ''
  synchronizeSalesGroupIds(next)
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
export function addBenefitSku(data: AppData, draft: BenefitPackageDraft, skuId: string, quantity?: number, options: {groupId?:string|null;role?:'host'|'item';positionId?:string;index?:BenefitSelectionIndex} = {}): BenefitPackageDraft {
  const summary = benefitSkuSummary(data, skuId)
  if (!summary) throw new Error('请选择真实销售 SKU，物料、规划或商品主体不能加入实物清单。')
  const family = data.families.find(item => item.id === summary.familyId)
  if (summary.status !== 'on_sale' || !family || shelfOf(family) !== 'online') throw new Error('该商品当前未在售，不能新增到包内。')
  const range=resolveBenefitRange(data,draft,options.index)
  if(benefitCompositionVersion(draft)===2){
    const role=options.role||'item',hits=range.membership(skuId),groupId=role==='host'?null:options.groupId!==undefined?options.groupId:hits.length===1?hits[0].id:null
    if(role==='host'&&compatibilityRecordRole(data,skuId)!=='host')throw Error('主机实物位置只能引用真实销售主机 SKU。')
    if(role==='host'&&draft.goods.some(line=>line.role==='host'&&line.skuId!==skuId))throw Error('已有主机实物位置，请明确替换或移除，不会静默换机。')
    const reason=range.reason(skuId,groupId,role);if(range.problems.length||reason)throw Error(range.problems.join(' ')||reason)
    const group=role==='host'?undefined:range.groups.find(item=>item.id===groupId),amount=quantity??group?.defaultQuantity??1
    if(!validBenefitQuantity(amount))throw Error('位置数量必须为安全范围内的正整数。')
    const next=cloneBenefit(draft),existing=next.goods.find(line=>line.groupId===groupId&&line.role===role&&line.skuId===skuId),total=amount+(existing?.quantity||0)
    if(!validBenefitQuantity(total))throw Error('合并后的商品数量超出安全范围。')
    if(group&&(group.adjustable?total<group.minQuantity||total>group.maxQuantity:total!==group.defaultQuantity))throw Error(`「${group.name}」每种 SKU 件数须符合 ${group.adjustable?`${group.minQuantity}～${group.maxQuantity}`:group.defaultQuantity} 件约定。`)
    if(group&&!existing&&new Set(next.goods.filter(line=>line.role!=='host'&&line.groupId===group.id).map(line=>line.skuId)).size>=group.maxKinds)throw Error(`「${group.name}」最多选择 ${group.maxKinds} 种 SKU。`)
    if(existing)existing.quantity=total
    else{const id=options.positionId||newPositionId();if(next.goods.some(line=>line.id===id)||next.services.some(line=>line.id===id))throw Error('位置 ID 已被使用。');next.goods.push({id,skuId,quantity:amount,snapshot:summary,groupId,role})}
    if(role==='host')next.includedPhoneSkuId=skuId
    return touchComposition(next)
  }
  if(benefitCompositionVersion(draft)!==1)throw Error('不支持的组成版本，不能改写。')
  const reason=range.reason(skuId)
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
export function replaceBenefitSku(data: AppData, draft: BenefitPackageDraft, lineId: string, newSkuId: string,index?:BenefitSelectionIndex): BenefitPackageDraft {
  const line = draft.goods.find(item => item.id === lineId)
  if (!line) throw new Error('待替换商品已不存在，请重新查看清单。')
  if (line.skuId === newSkuId) return cloneBenefit(draft)
  if(benefitCompositionVersion(draft)===2){if(draft.goods.some(other=>other.id!==lineId&&other.groupId===line.groupId&&other.role===line.role&&other.skuId===newSkuId))throw Error('目标组已有该 SKU 位置，请明确调整数量；不会合并不同参考价格。');const next=removeBenefitPosition(draft,lineId);return addBenefitSku(data,next,newSkuId,line.quantity,{groupId:line.groupId,role:line.role,positionId:line.id,index})}
  const next = cloneBenefit(draft); next.goods = next.goods.filter(item => item.id !== lineId)
  const added = addBenefitSku(data, next, newSkuId, line.quantity)
  if (added.includedPhoneSkuId === line.skuId) added.includedPhoneSkuId = compatibilityRecordRole(data, newSkuId) === 'host' ? newSkuId : ''
  return added
}
export function removeBenefitPosition(draft:BenefitPackageDraft,lineId:string):BenefitPackageDraft{
 const next=cloneBenefit(draft),line=next.goods.find(item=>item.id===lineId)
 if(!line)throw Error('商品位置已不存在。')
 next.goods=next.goods.filter(item=>item.id!==lineId)
 if(line.role==='host'||benefitCompositionVersion(next)===1&&line.skuId===next.includedPhoneSkuId)next.includedPhoneSkuId=''
 if(next.sales?.schemaVersion===1){next.sales.origins=next.sales.origins.filter(origin=>origin.positionId!==lineId);pruneSalesContexts(next);next.groups=next.groups.filter(group=>!group.id.startsWith('sales:')||next.goods.some(item=>item.groupId===group.id))}
 return touchComposition(next)
}
export function setBenefitPositionQuantity(data:AppData,draft:BenefitPackageDraft,lineId:string,quantity:number,index?:BenefitSelectionIndex):BenefitPackageDraft{if(!validBenefitQuantity(quantity))throw Error('位置数量必须是安全范围内的正整数。');const next=cloneBenefit(draft),line=next.goods.find(item=>item.id===lineId);if(!line)throw Error('商品位置已不存在。');const range=resolveBenefitRange(data,next,index),group=benefitCompositionVersion(next)===2?range.groups.find(item=>item.id===line.groupId):range.membership(line.skuId)[0];if(group&&(group.adjustable?quantity<group.minQuantity||quantity>group.maxQuantity:quantity!==group.defaultQuantity))throw Error(`「${group.name}」件数超出该组约定。`);line.quantity=quantity;return touchComposition(next)}
export function setBenefitPositionPrice(draft:BenefitPackageDraft,lineId:string,price:BenefitReferencePrice|undefined):BenefitPackageDraft{const problem=referencePriceProblem(price);if(problem)throw Error(problem);const next=cloneBenefit(draft),line=next.goods.find(item=>item.id===lineId);if(!line)throw Error('商品位置已不存在。');if(price===undefined)delete line.referencePrice;else line.referencePrice=cloneBenefit(price);return touchComposition(next)}
export function assignBenefitPositionGroup(data:AppData,draft:BenefitPackageDraft,lineId:string,groupId:string|null,index?:BenefitSelectionIndex):BenefitPackageDraft{if(benefitCompositionVersion(draft)!==2)throw Error('请先明确采用新版组成结构。');const next=cloneBenefit(draft),line=next.goods.find(item=>item.id===lineId);if(!line)throw Error('商品位置已不存在。');if(line.role==='host'&&groupId!==null)throw Error('主机实物位置不计入配件组选配。');const range=resolveBenefitRange(data,next,index);if(groupId!==null&&!range.membership(line.skuId).some(group=>group.id===groupId))throw Error('商品不在该启用组的真实类型范围内。');if(next.goods.some(other=>other.id!==line.id&&other.groupId===groupId&&other.role===line.role&&other.skuId===line.skuId))throw Error('目标组已有同一 SKU，请明确调整位置，不会合并不同参考价格。');line.groupId=groupId;return touchComposition(next)}
export function setBenefitDevice(data: AppData, draft: BenefitPackageDraft, device: BenefitDeviceContext, replaceIncludedPhone = false): BenefitPackageDraft {
  if(device?.kind==='sku'){const admission=salesDeviceAdmission(data,device.skuId);if(!admission.allowed)throw Error(admission.reason)}
  const next = cloneBenefit(draft), previous = next.includedPhoneSkuId
  next.device = cloneBenefit(device)
  if(benefitCompositionVersion(next)===2&&replaceIncludedPhone&&previous){if(device?.kind!=='sku'||compatibilityRecordRole(data,device.skuId)!=='host')throw Error('替换主机须选择具体销售主机 SKU。');const line=next.goods.find(item=>item.role==='host');if(line){const removed=removeBenefitPosition(next,line.id);return addBenefitSku(data,removed,device.skuId,line.quantity,{role:'host',groupId:null,positionId:line.id})}}
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
  if(benefitCompositionVersion(next)===2){if(!include){next.goods=next.goods.filter(line=>line.role!=='host');next.includedPhoneSkuId='';return touchComposition(next)}if(next.device?.kind!=='sku'||compatibilityRecordRole(data,next.device.skuId)!=='host')throw Error('只有具体销售主机 SKU 才能加入主机实物位置。');const target=next.device.skuId;if(next.goods.some(line=>line.role==='host'&&line.skuId===target))return next;return addBenefitSku(data,next,target,1,{role:'host',groupId:null})}
  if (!include) { next.goods = next.goods.filter(line => line.skuId !== next.includedPhoneSkuId); next.includedPhoneSkuId = ''; return touchComposition(next) }
  if (next.device?.kind !== 'sku' || compatibilityRecordRole(data, next.device.skuId) !== 'host') throw new Error('只有具体销售手机 SKU 才能加入实物清单。')
  const target = next.device.skuId
  // The explicit inclusion switch links an existing row; it does not increment it again.
  next.includedPhoneSkuId=target
  const result = next.goods.some(line => line.skuId === target) ? next : addBenefitSku(data, next, target)
  result.includedPhoneSkuId = target
  return touchComposition(result)
}
export function benefitCompatibilitySummary(skuId: string, match: AccessoryMatch | undefined, needsCheck: boolean, hasDevice: boolean): BenefitCompatibilitySummary {
  const capabilities: BenefitCapabilitySummary[] = (match?.capabilities || []).map(capability => ({ capability: capability.capability, status: capability.status, conditions: capability.conditions.map(condition => ({ state: condition.state, label: condition.label })), declarationIds: capability.declarations.map(link => link.id), sources: capability.declarations.map(link => link.source || '历史正式适用关系；核验依据未记录') }))
  const basic = capabilities.find(item => item.capability === 'basic'), fast = capabilities.find(item => item.capability === 'fast-charge')
  return { skuId, basicStatus: !hasDevice ? 'unchecked' : !needsCheck ? 'not-required' : basic?.status || 'pending', fastChargeStatus: fast?.status || (!hasDevice ? 'unchecked' : 'pending'), reasons: match?.reasons || [!hasDevice ? '普通组合包，未做设备适配校验。' : !needsCheck ? '该项目不作为配件执行适配声明校验。' : '尚无可确认的销售 SKU 基本使用声明，请维护适用关系。'], capabilities }
}
function confirmationKey(skuId: string, capability: 'basic' | 'fast-charge') { return stable([skuId, capability]) }
function positionConfirmationKey(positionId:string,skuId:string,capability:'basic'|'fast-charge'){return stable([positionId,skuId,capability])}
function hasConfirmation(draft: BenefitPackageDraft, key: string, basis: string) { return draft.confirmations.some(item => item.key === key && item.basis === basis && item.note.trim() && Number.isFinite(Date.parse(item.confirmedAt))) }
export function benefitDraftStructureIssues(draft:unknown):BenefitIssue[]{
 const fail=(message:string):BenefitIssue[]=>[{code:'package-structure',message,severity:'error',structural:true}]
 if(!object(draft)||!['id','code','name','includedPhoneSkuId','createdAt','updatedAt','status'].every(key=>string(draft[key]))||typeof draft.favorite!=='boolean'||typeof draft.requireFastCharge!=='boolean'||typeof draft.rulesEnabled!=='boolean'||!deviceShape(draft.device)||!Array.isArray(draft.goods)||!Array.isArray(draft.services)||!object(draft.quote)||draft.quote.currency!=='CNY'||!string(draft.quote.reviewedBasis)||!Array.isArray(draft.confirmations)||!draft.confirmations.every(confirmationShape)||!strings(draft.issues))return fail('组合基本字段、商品／服务容器、报价或确认记录结构无效，原输入保留。')
 if(draft.services.some(line=>!object(line)||!['id','name','unit','measurement','validity','description'].every(key=>string(line[key]))))return fail('服务条目结构无效，原输入保留。')
 if(draft.framework!==undefined&&frameworkSnapshotProblem(draft.framework))return fail(frameworkSnapshotProblem(draft.framework))
 if(salesMetadataProblems(draft.sales).length)return fail(salesMetadataProblems(draft.sales).join('；'))
 if(salesPositionIdentityProblems(draft as unknown as BenefitPackageDraft).length)return fail(salesPositionIdentityProblems(draft as unknown as BenefitPackageDraft).join('；'))
 return [...benefitPositionStructureIssues(draft as unknown as BenefitPackageDraft),...benefitRuleStructureIssues(draft.groups)]
}
export function validateBenefitPackage(data: AppData, draft: BenefitPackageDraft, suppliedIndex?:BenefitSelectionIndex): BenefitValidation {
  const malformed=benefitDraftStructureIssues(draft)
  if(malformed.length)return {issues:malformed,goods:[],deviceLabel:'配置结构待修正',deviceValid:false,canSaveDraft:false,canSaveAvailable:false,canDeliver:false,basis:'invalid-structure',physicalCount:0,serviceCount:0,quoteNeedsReview:false}
  const issues: BenefitIssue[] = benefitRuleStructureIssues(draft.groups), add = (code: string, message: string, structural = false, extra: Partial<BenefitIssue> = {}) => issues.push({ code, message, severity: 'error', structural, ...extra })
  if (!draft.name.trim()) add('name', '请填写权益包名称。')
  if (!draft.goods.length && !draft.services.length) add('empty', '请至少添加一项商品或服务权益。')
  if (!['draft', 'available', 'disabled'].includes(draft.status)) add('status', '权益包状态无效。', true)
  if (!Number.isSafeInteger(draft.revision) || draft.revision < 0) add('revision', '权益包修订版本无效。', true)
  if (draft.quote.currency !== 'CNY' || draft.quote.amountCents !== null && !validBenefitCents(draft.quote.amountCents)) add('quote', '报价必须为空或安全范围内的非负整数分。', true)
  const range=resolveBenefitRange(data,draft,suppliedIndex),query=range.query,deviceAdmission=draft.device?.kind==='sku'?salesDeviceAdmission(data,draft.device.skuId):undefined,deviceValid = !draft.device || query?.device.status === 'resolved'&&deviceAdmission?.allowed!==false
  const deviceLabel = !draft.device ? '普通组合包 · 未做设备适配校验' : draft.device.kind === 'sku' ? [benefitSkuSummary(data, draft.device.skuId)?.name || draft.device.skuId, query?.device.host?.steps.map(step => step.valueId).join(' · ')].filter(Boolean).join(' · ') : draft.device.host.steps.map(step => step.valueId).join(' · ')
  if (!deviceValid) add('device', deviceAdmission?.reason || query?.device.message || '适配设备尚未唯一确认，请处理型号或引用。')
  const matches = range.matches
  const lineIds = new Set<string>(), skuIds = new Set<string>()
  if(benefitCompositionVersion(draft)===2){const hosts=draft.goods.filter(line=>line.role==='host');if(hosts.length===1?draft.includedPhoneSkuId!==hosts[0].skuId:!!draft.includedPhoneSkuId)add('position-host-identity','主机实物位置与包含主机标识不一致。',true,{positionId:hosts[0]?.id})}
  let physicalCount = 0, serviceCount = 0
  const goods = draft.goods.map(line => {
    const summary = range.index.summaries.get(line.skuId), original = data.skus.find(sku => sku.id === line.skuId), family = original && data.families.find(item => item.id === original.familyId)
    if(benefitCompositionVersion(draft)===2&&original&&family&&(!isRealSku(data,original)||line.role==='host'&&compatibilityRecordRole(data,line.skuId)!=='host'))add('position-host-identity','商品位置的实际销售 SKU／主机身份不符，不能把配件或 MAT 标成主机实物。',true,{skuId:line.skuId,positionId:line.id})
    if (!line.id || lineIds.has(line.id) || benefitCompositionVersion(draft)===1&&skuIds.has(line.skuId)) add('goods-identity', '商品行身份重复，请合并同一 SKU。', true, { skuId: line.skuId,positionId:line.id })
    lineIds.add(line.id); skuIds.add(line.skuId)
    if (!validBenefitQuantity(line.quantity)) add('goods-quantity', `${summary?.name || line.snapshot.name}的每包数量须为正整数。`, true, { skuId: line.skuId })
    else { physicalCount += line.quantity; if (!Number.isSafeInteger(physicalCount)) add('goods-total', '商品汇总数量超出安全范围。', true) }
    const available = Boolean(summary && family && summary.status === 'on_sale' && shelfOf(family) === 'online')
    if (!summary) add('sku-reference', `${line.snapshot.name || line.skuId}的销售 SKU 引用失效，原条目已保留。`, false, { skuId: line.skuId })
    else if (!available) add('sku-unavailable', `${summary.name}当前不在售，请替换或移除。`, false, { skuId: line.skuId })
    if (draft.device && summary && (!summary.productTypeId || !data.productTypes.some(type => type.id === summary.productTypeId))) add('sku-type-reference', `${summary.name}的产品类型尚未确认，无法完成设备适配校验。`, false, { skuId: line.skuId })
    const compatibility = salesPositionCompatibility(data,draft,line.id,range.index) || benefitCompatibilitySummary(line.skuId, matches.get(line.skuId), compatibilityRecordRole(data, line.skuId) === 'accessory', Boolean(draft.device))
    if(benefitCompositionVersion(draft)===2&&line.role==='item'&&line.groupId!==null&&!range.groups.some(group=>group.id===line.groupId&&group.enabled))add('position-group-reference','商品位置原选配组已失效，请明确重新指定或移除；原位置保留。',false,{positionId:line.id,skuId:line.skuId,groupId:line.groupId||undefined})
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
        if (owner && benefitCompositionVersion(draft) === 1) add('group-overlap', `SKU ${summary?.code || skuId}同时属于「${owner}」和「${group.name}」，不能重复归属启用组。`, false, { ...extra, skuId })
        owners.set(skuId, group.name)
      }
      const { lines: selected, kinds } = benefitGroupSelection(draft, group, skuId => group.candidateSkuIds.includes(skuId)), effectiveMin = group.required || kinds ? group.minKinds : 0
      if (kinds < effectiveMin || kinds > group.maxKinds) add('group-selection', `选配组「${group.name}」须选择 ${effectiveMin}～${group.maxKinds} 种商品，当前 ${kinds} 种。`, false, extra)
      for (const line of selected) if (!group.adjustable ? line.quantity !== group.defaultQuantity : line.quantity < group.minQuantity || line.quantity > group.maxQuantity) add('group-selected-quantity', `选配组「${group.name}」中每种商品的数量不符合 ${group.adjustable ? `${group.minQuantity}～${group.maxQuantity}` : group.defaultQuantity} 件约定。`, false, { ...extra, skuId: line.skuId })
    }
  }
  if(draft.framework&&frameworkSnapshotProblem(draft.framework))add('framework-structure',frameworkSnapshotProblem(draft.framework),true)
  if (!draft.framework && benefitCompositionVersion(draft) === 2) for (const line of draft.goods) {
    if (line.role === 'item' && line.groupId !== null && !range.membership(line.skuId).some(group => group.id === line.groupId)) add('group-member', '商品位置不属于所指定的启用选配组，请重新指定组。', false, { positionId: line.id, skuId: line.skuId, groupId: line.groupId || undefined })
  }
  else issues.push(...frameworkSelectionIssues(data,draft,range))
  for(const line of draft.goods)try{referenceLine(line.referencePrice,line.quantity)}catch(e){add('reference-price',String(e),true,{skuId:line.skuId})}
  for(const line of draft.services)try{referenceLine(line.referencePrice,line.quantity)}catch(e){add('reference-price',String(e),true,{serviceId:line.id})}
  try{benefitReferenceTotals(draft)}catch(e){add('reference-price',e instanceof Error?e.message:String(e),true)}
  const relevantIds = new Set(draft.goods.map(line => line.skuId))
  issues.push(...salesSelectionIssues(data,draft))
  const basis = stable({ composition: benefitCompositionBasis(draft), ...(draft.sales?{sales:salesSelectionEvidence(data,draft)}:{}), device: query ? { status: query.device.status, host: query.device.host, planningId: query.device.planningId, attributes: query.device.attributes, sourceStamp: query.device.sourceStamp } : null, goods: goods.map(item => ({ summary: item.summary, available: item.available, compatibility: item.compatibility })), declarations: data.compatibilities.filter(link => relevantIds.has(link.targetId || link.accessorySkuId)) })
  const assess = (item: BenefitValidation['goods'][number], capability: 'basic' | 'fast-charge') => {
    const status = capability === 'basic' ? item.compatibility.basicStatus : item.compatibility.fastChargeStatus, label = capability === 'basic' ? '基本使用' : '快充能力'
    if (status === 'incompatible') add('compatibility-excluded', `${item.summary.name}的${label}明确不适用，不能生成正式清单。`, false, { skuId: item.line.skuId })
    else if (status === 'pending') add('compatibility-pending', `${item.summary.name}的${label}尚未确认，请维护适用关系。`, false, { skuId: item.line.skuId })
    else if (status === 'conditional') {
      const key = benefitCompositionVersion(draft)===2?positionConfirmationKey(item.line.id,item.line.skuId,capability):confirmationKey(item.line.skuId, capability)
      if (!hasConfirmation(draft, key, basis)) issues.push({ code: 'condition-confirmation', message: `${item.summary.name}的${label}有使用前提，须确认按当前条件交付。`, severity: 'condition', skuId: item.line.skuId, positionId:item.line.id,groupId:item.line.groupId||undefined,confirmationKey: key })
    }
  }
  if (draft.device && deviceValid || draft.sales) {
    for (const item of goods) if (draft.sales?.origins.some(origin=>origin.positionId===item.line.id) || draft.device&&deviceValid&&compatibilityRecordRole(data, item.line.skuId) === 'accessory') assess(item, 'basic')
    if (draft.requireFastCharge) {
      const capable = goods.filter(item => item.compatibility.capabilities.some(capability => capability.capability === 'fast-charge'))
      if (!capable.length) add('fast-charge-unconfirmed', '尚无已维护快充能力的包内商品，不能承诺整包快充。')
      for (const item of capable) assess(item, 'fast-charge')
    }
  }
  if (draft.requireFastCharge && !draft.device) add('fast-charge-device', '要求快充能力时，请先选择并确认适配设备。')
  const quoteNeedsReview = draft.quote.amountCents !== null && draft.quote.reviewedBasis !== (benefitCompositionVersion(draft)===2?`selection:${basis}`:benefitCompositionBasis(draft))
  if (quoteNeedsReview) issues.push({ code: 'quote-review', message: '报价依据已变化，请重新复核报价。当前报价及草稿保留。', severity: 'warning' })
  return { issues, goods, deviceLabel, deviceValid, canSaveDraft: !issues.some(issue => issue.structural), canSaveAvailable: !issues.some(issue => issue.severity === 'error'||benefitCompositionVersion(draft)===2&&issue.severity==='condition'), canDeliver: !(requiresBenefitQuoteReview(draft) && quoteNeedsReview) && !issues.some(issue => issue.severity === 'error' || issue.severity === 'condition'), basis, physicalCount, serviceCount, quoteNeedsReview }
}
export function confirmBenefitCondition(data: AppData, draft: BenefitPackageDraft, skuId: string, note: string, now: string, capability: 'basic' | 'fast-charge' = 'basic'): BenefitPackageDraft {
  if (!note.trim() || !Number.isFinite(Date.parse(now))) throw new Error('请填写本次条件确认说明和有效时间。')
  const validation = validateBenefitPackage(data, draft), matching=validation.goods.filter(item=>item.line.id===skuId||item.line.skuId===skuId)
  if(benefitCompositionVersion(draft)===2&&matching.length>1)throw Error('同一 SKU 有多个选配位置，请逐个按位置 ID 确认。')
  const line=matching[0],detail = line?.compatibility.capabilities.find(item => item.capability === capability)
  if (!line || !detail || detail.status !== 'conditional') throw new Error('只有当前明确有条件适用的项目可以按前提确认；待确认或不适用不能人工升级。')
  const targetSku=line.line.skuId,key = benefitCompositionVersion(draft)===2?positionConfirmationKey(line.line.id,targetSku,capability):confirmationKey(targetSku, capability), next = cloneBenefit(draft)
  const confirmation: BenefitConditionConfirmation = { key, skuId:targetSku,...(benefitCompositionVersion(draft)===2?{positionId:line.line.id}:{}), capability, device: cloneBenefit(draft.device), declarationIds: cloneBenefit(detail.declarationIds), conditionLabels: detail.conditions.map(condition => condition.label), note: note.trim(), confirmedAt: now, basis: validation.basis }
  next.confirmations = next.confirmations.filter(item => item.key !== key); next.confirmations.push(confirmation)
  return next
}
export function previewBenefitDelivery(data: AppData, saved: BenefitPackage, packageCount: number): BenefitDeliveryPreview {
  const validation = validateBenefitPackage(data, saved), issues = cloneBenefit(validation.issues)
  if(issues.some(issue=>issue.structural))return {packageId:saved?.id||'',packageCode:saved?.code||'',sourceRevision:saved?.revision||0,packageName:saved?.name||'',packageCount,device:saved?.device||null,deviceLabel:validation.deviceLabel,includedPhoneSkuId:saved?.includedPhoneSkuId||'',hostSkuIds:[],goods:[],services:[],quote:{currency:'CNY',amountCents:null,totalCents:null,needsReview:false},confirmations:[],issues,canConfirm:false,basis:validation.basis}
  if (!saved.id || !saved.code || saved.revision < 1) issues.push({ code: 'unsaved', message: '请先保存权益包，再生成交付清单。', severity: 'error' })
  if (saved.status !== 'available') issues.push({ code: 'package-status', message: saved.status === 'disabled' ? '停用包不能生成新的交付清单。' : '请先将完整配置保存为可用权益包。', severity: 'error' })
  if (!validBenefitQuantity(packageCount)) issues.push({ code: 'package-count', message: '本次包数必须为安全范围内的正整数。', severity: 'error' })
  const product = (quantity: number, factor: number): number => { try { return multiplyBenefitQuantity(quantity, factor) } catch { issues.push({ code: 'delivery-quantity', message: '交付数量无效或乘法溢出。', severity: 'error' }); return 0 } }
  const price=(p:Parameters<typeof referenceLine>[0],q:number)=>{try{return referenceLine(p,q)}catch(e){issues.push({code:'reference-price',message:String(e),severity:'error'});return null}}
  const goods = validation.goods.map(item => ({ ...cloneBenefit(item.summary), lineId: item.line.id, ...(benefitCompositionVersion(saved)===2?{groupId:item.line.groupId!,role:item.line.role!,groupName:item.line.role==='host'?'主机实物':(saved.framework?.groups||saved.groups).find(group=>group.id===item.line.groupId)?.name||'未分组'}:{}), ...(item.line.referencePrice?{referencePrice:cloneBenefit(item.line.referencePrice)}:{}),referenceLineCents:price(item.line.referencePrice,item.line.quantity),referenceTotalCents:price(item.line.referencePrice,product(item.line.quantity,packageCount)), perPackageQuantity: item.line.quantity, totalQuantity: product(item.line.quantity, packageCount), compatibility: cloneBenefit(item.compatibility) }))
  const hostSkuIds = [...new Set(goods.filter(item => compatibilityRecordRole(data, item.skuId) === 'host').map(item => item.skuId))]
  const services = saved.services.map(service => ({ ...cloneBenefit(service),referenceLineCents:price(service.referencePrice,service.quantity),referenceTotalCents:price(service.referencePrice,service.measurement==='per-delivery'?service.quantity:product(service.quantity,packageCount)), perPackageQuantity: service.quantity, totalQuantity: service.measurement === 'per-delivery' ? service.quantity : product(service.quantity, packageCount) }))
  const totalCents = saved.quote.amountCents === null ? null : saved.quote.amountCents * packageCount
  if (totalCents !== null && !validBenefitCents(totalCents)) issues.push({ code: 'delivery-quote', message: '本次总报价无效或超出安全范围。', severity: 'error' })
  let referenceTotals:ReturnType<typeof benefitReferenceTotals>|undefined
  try{referenceTotals=benefitReferenceTotals(saved,packageCount)}catch(e){issues.push({code:'reference-price',message:String(e),severity:'error'})}
  if (requiresBenefitQuoteReview(saved) && validation.quoteNeedsReview) issues.push({code:'quote-review',message:'报价依据已变化，请重新复核报价。',severity:'error'})
  const basis = stable({ validation: validation.basis, packageId: saved.id, sourceRevision: saved.revision, name: saved.name, packageCount, quote: saved.quote, confirmations: saved.confirmations })
  let goodsSummary:BenefitDeliverySkuTotal[]|undefined
  if(benefitCompositionVersion(saved)===2)try{goodsSummary=summarizeBenefitDeliveryGoods(goods)}catch(error){issues.push({code:'delivery-summary',message:error instanceof Error?error.message:String(error),severity:'error'})}
  return { ...(saved.compositionVersion!==undefined?{compositionVersion:saved.compositionVersion}:{}),...(saved.sales?{sales:cloneBenefit(saved.sales)}:{}),...(goodsSummary?{goodsSummary}:{}),...(saved.framework?{framework:cloneBenefit(saved.framework)}:{}),...(referenceTotals?{referenceTotals}:{}), packageId: saved.id, packageCode: saved.code, sourceRevision: saved.revision, packageName: saved.name, packageCount, device: cloneBenefit(saved.device), deviceLabel: validation.deviceLabel, includedPhoneSkuId: saved.includedPhoneSkuId, hostSkuIds, goods, services, quote: { currency: 'CNY', amountCents: saved.quote.amountCents, totalCents, needsReview: validation.quoteNeedsReview }, confirmations: saved.confirmations.filter(item => item.basis === validation.basis).map(cloneBenefit), issues, canConfirm: !issues.some(issue => issue.severity === 'error' || issue.severity === 'condition'), basis }
}
export function summarizeBenefitDeliveryGoods(goods:BenefitDeliveryGoods[]):BenefitDeliverySkuTotal[]{const totals=new Map<string,BenefitDeliverySkuTotal>();for(const line of goods){const total=totals.get(line.skuId)||{skuId:line.skuId,code:line.code,name:line.name,perPackageQuantity:0,totalQuantity:0,positionIds:[]};total.perPackageQuantity+=line.perPackageQuantity;total.totalQuantity+=line.totalQuantity;if(!validBenefitQuantity(total.perPackageQuantity)||!validBenefitQuantity(total.totalQuantity))throw Error('按 SKU 汇总商品数量超出安全范围。');total.positionIds.push(line.lineId);totals.set(line.skuId,total)}return [...totals.values()]}
export function createBenefitDeliverySnapshot(preview: BenefitDeliveryPreview, identity: { id: string; code: string; requestId: string; generatedAt: string }): BenefitDeliverySnapshot {
  if(salesMetadataProblems(preview.sales).length)throw Error(salesMetadataProblems(preview.sales).join('；'))
  if('snapshotVersion' in preview&&preview.snapshotVersion!==1&&preview.snapshotVersion!==2)throw Error('不支持的历史清单版本，不能降级执行。')
  if (!preview.canConfirm || !identity.id || !identity.code || !identity.requestId || !Number.isFinite(Date.parse(identity.generatedAt))) throw new Error('交付清单尚未通过确认校验。')
  if(preview.compositionVersion!==undefined&&preview.compositionVersion!==1&&preview.compositionVersion!==2)throw Error('不支持的组成版本，不能生成新清单。')
  if (requiresBenefitQuoteReview(preview) && preview.quote.amountCents !== null && preview.quote.needsReview) throw Error('报价依据已变化，请重新复核报价。')
  return { ...cloneBenefit(preview), ...identity, snapshotVersion: preview.compositionVersion===2?2:1 }
}

function requiresBenefitQuoteReview(value: Pick<BenefitPackageDraft, 'compositionVersion' | 'framework'> & { goods: {referencePrice?: BenefitReferencePrice}[]; services: {referencePrice?: BenefitReferencePrice}[] }) {
  return benefitCompositionVersion(value) === 2 || Boolean(value.framework) || value.goods.some(line => line.referencePrice) || value.services.some(line => line.referencePrice)
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
function confirmationShape(value: unknown) { return object(value) && ['key', 'skuId', 'note', 'basis'].every(key => string(value[key]) && Boolean(value[key].trim())) && (value.positionId===undefined||string(value.positionId)&&!!value.positionId) && validDate(value.confirmedAt) && ['basic', 'fast-charge'].includes(String(value.capability)) && value.key === (value.positionId===undefined?confirmationKey(String(value.skuId), value.capability as 'basic' | 'fast-charge'):positionConfirmationKey(String(value.positionId),String(value.skuId),value.capability as 'basic'|'fast-charge')) && deviceShape(value.device) && strings(value.declarationIds) && strings(value.conditionLabels) }
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
  const acceptedRequests=new Map<string,{owner:string;intent?:string;sourceRevision?:number;resultRevision?:number}>()
  const accepted=(owner:string,requestId:unknown,intent:unknown,receipt?:Record<string,unknown>)=>{if(!string(requestId)||!requestId)return;const next={owner,...(string(intent)&&intent?{intent}:{}),...(receipt&&Number.isSafeInteger(receipt.sourceRevision)?{sourceRevision:Number(receipt.sourceRevision),resultRevision:Number(receipt.resultRevision)}:{})},previous=acceptedRequests.get(requestId);if(previous&&(previous.owner!==owner||previous.intent!==undefined&&next.intent!==undefined&&previous.intent!==next.intent||previous.sourceRevision!==undefined&&next.sourceRevision!==undefined&&(previous.sourceRevision!==next.sourceRevision||previous.resultRevision!==next.resultRevision)))problems.push('组合已受理请求身份或原始执行意图冲突，不能跨组合复用。');else acceptedRequests.set(requestId,{...previous,...next})}
  if (data.benefitPackages !== undefined && !Array.isArray(data.benefitPackages)) problems.push('权益包配置集合须为数组。')
  for (const value of Array.isArray(data.benefitPackages) ? data.benefitPackages : []) {
    if (!object(value) || !['id', 'code', 'name', 'createdAt', 'updatedAt', 'includedPhoneSkuId'].every(key => string(value[key])) || !value.id || !value.code || !validDate(value.createdAt) || !validDate(value.updatedAt) || !validBenefitQuantity(value.revision) || !['draft', 'available', 'disabled'].includes(String(value.status)) || typeof value.favorite !== 'boolean' || typeof value.requireFastCharge !== 'boolean' || typeof value.rulesEnabled !== 'boolean' || !deviceShape(value.device) || !strings(value.issues)) { problems.push('权益包身份或基本结构无效。'); continue }
    if (packageIds.has(String(value.id)) || packageCodes.has(String(value.code))) problems.push('权益包 ID 或编号重复。')
    packageIds.add(String(value.id)); packageCodes.add(String(value.code))
    if (value.creationRequestId !== undefined) { if (!string(value.creationRequestId) || !value.creationRequestId || requests.has(value.creationRequestId)) problems.push('权益包创建请求重复或无效。'); else requests.add(value.creationRequestId) }
    if(value.compositionVersion!==undefined&&(!Number.isSafeInteger(value.compositionVersion)||Number(value.compositionVersion)<1))problems.push('组成版本必须为正整数，未知版本保留但不能执行。')
    if(value.creationIntent!==undefined&&(!string(value.creationIntent)||!value.creationIntent))problems.push('组合创建意图回执无效。')
    if(value.saveReceipt!==undefined&&(!object(value.saveReceipt)||!string(value.saveReceipt.requestId)||!value.saveReceipt.requestId||!string(value.saveReceipt.intent)||!value.saveReceipt.intent||!Number.isSafeInteger(value.saveReceipt.sourceRevision)||Number(value.saveReceipt.sourceRevision)<0||!validBenefitQuantity(value.saveReceipt.resultRevision)||Number(value.saveReceipt.resultRevision)!==Number(value.saveReceipt.sourceRevision)+1||Number(value.saveReceipt.resultRevision)>Number(value.revision)))problems.push('组合保存回执结构或修订依据无效。')
    if(value.saveReceipts!==undefined){if(!Array.isArray(value.saveReceipts)||value.saveReceipts.some(receipt=>!object(receipt)||!string(receipt.requestId)||!receipt.requestId||!string(receipt.intent)||!receipt.intent||!Number.isSafeInteger(receipt.sourceRevision)||Number(receipt.sourceRevision)<0||!validBenefitQuantity(receipt.resultRevision)||Number(receipt.resultRevision)!==Number(receipt.sourceRevision)+1||Number(receipt.resultRevision)>Number(value.revision))||new Set(value.saveReceipts.map(receipt=>object(receipt)?receipt.requestId:undefined)).size!==value.saveReceipts.length)problems.push('组合保存回执集合结构、身份或修订依据无效。')}
    accepted(String(value.id),value.creationRequestId,value.creationIntent)
    if(value.sales!==undefined&&(!object(value.sales)||!Number.isSafeInteger(value.sales.schemaVersion)||Number(value.sales.schemaVersion)<1))problems.push('销售方案来源版本无效。')
    else if(object(value.sales)&&value.sales.schemaVersion===1){problems.push(...salesMetadataProblems(value.sales));problems.push(...salesPositionIdentityProblems(value as unknown as BenefitPackageDraft))}
    if(object(value.saveReceipt))accepted(String(value.id),value.saveReceipt.requestId,value.saveReceipt.intent,value.saveReceipt)
    if(Array.isArray(value.saveReceipts))for(const receipt of value.saveReceipts)if(object(receipt))accepted(String(value.id),receipt.requestId,receipt.intent,receipt)
    if (!Array.isArray(value.goods) || value.goods.some(line => !object(line) || !string(line.id) || !line.id || !string(line.skuId) || !line.skuId || !validBenefitQuantity(line.quantity) || !summaryShape(line.snapshot) || !object(line.snapshot) || line.snapshot.skuId !== line.skuId)) problems.push('权益包实物条目结构、身份或数量无效。')
    else if ((value.compositionVersion===undefined||value.compositionVersion===1)&&new Set(value.goods.map(line => line.skuId)).size !== value.goods.length || Array.isArray(value.goods)&&new Set(value.goods.map(line => object(line)?line.id:undefined)).size !== value.goods.length) problems.push('权益包实物身份重复。')
    if(value.compositionVersion===2){
      problems.push(...benefitPositionStructureIssues(value as unknown as BenefitPackageDraft).map(issue=>issue.message))
      if(Array.isArray(value.goods)){
        const hosts=value.goods.filter(line=>object(line)&&line.role==='host')
        if(hosts.length===1?value.includedPhoneSkuId!==hosts[0].skuId:!!value.includedPhoneSkuId)problems.push('主机实物位置与包含主机标识不一致。')
        if(Array.isArray(data.skus)&&Array.isArray(data.families))for(const line of value.goods.filter(object)){const sku=data.skus.find(sku=>object(sku)&&sku.id===line.skuId),family=object(sku)&&data.families.find(family=>object(family)&&family.id===sku.familyId);if(sku&&family&&(!isRealSku(data as unknown as AppData,sku as unknown as AppData['skus'][number])||line.role==='host'&&Array.isArray(data.productTypes)&&Array.isArray(data.specCanvases)&&compatibilityRecordRole(data as unknown as AppData,String(line.skuId))!=='host'))problems.push('新版商品位置的实际销售 SKU／主机身份不符。')}
      }
    }
    if (!Array.isArray(value.services) || !value.services.every(serviceShape) || new Set(value.services.map(line => line.id)).size !== value.services.length || value.services.some(line => !line.id || Array.isArray(value.goods) && value.goods.some(goods => object(goods) && goods.id === line.id))) problems.push('权益包服务条目无效。')
    problems.push(...benefitRuleStructureIssues(value.groups).map(issue => `权益包「${value.name || value.code}」：${issue.message}`))
    if (!object(value.quote) || value.quote.currency !== 'CNY' || value.quote.amountCents !== null && !validBenefitCents(value.quote.amountCents) || !string(value.quote.reviewedBasis)) problems.push('权益包报价无效。')
    if (!Array.isArray(value.confirmations) || !value.confirmations.every(confirmationShape) || new Set(value.confirmations.map(item => item.key)).size !== value.confirmations.length) problems.push('权益包人工条件确认结构无效。')
    if(value.compositionVersion===2){const goods=value.goods,confirmations=value.confirmations;if(Array.isArray(confirmations)&&Array.isArray(goods)&&confirmations.some(item=>!object(item)||!string(item.positionId)||!goods.some(line=>object(line)&&line.id===item.positionId&&line.skuId===item.skuId)))problems.push('新版组合条件确认必须定位到真实组成位置。')}
  }
  const deliveryIds = new Set<string>(), deliveryCodes = new Set<string>(), deliveryRequests = new Set<string>()
  if (data.benefitDeliveries !== undefined && !Array.isArray(data.benefitDeliveries)) problems.push('交付清单集合须为数组。')
  for (const value of Array.isArray(data.benefitDeliveries) ? data.benefitDeliveries : []) {
    if (!object(value) || !['id', 'code', 'requestId', 'generatedAt', 'packageId', 'packageCode', 'packageName', 'deviceLabel', 'includedPhoneSkuId', 'basis'].every(key => string(value[key])) || !value.id || !value.code || !value.requestId || !value.packageId || !value.packageCode || !value.packageName || !value.basis || !validDate(value.generatedAt) || !validBenefitQuantity(value.snapshotVersion) || !validBenefitQuantity(value.sourceRevision) || !validBenefitQuantity(value.packageCount) || !deviceShape(value.device) || value.canConfirm !== true) { problems.push('交付清单身份或快照结构无效。'); continue }
    if (deliveryIds.has(String(value.id)) || deliveryCodes.has(String(value.code)) || deliveryRequests.has(String(value.requestId))) problems.push('交付清单 ID、编号或请求重复。')
    deliveryIds.add(String(value.id)); deliveryCodes.add(String(value.code)); deliveryRequests.add(String(value.requestId))
    if(value.sales!==undefined&&(!object(value.sales)||!Number.isSafeInteger(value.sales.schemaVersion)||Number(value.sales.schemaVersion)<1))problems.push('销售交付来源版本无效。')
    else if(object(value.sales)&&value.sales.schemaVersion===1)problems.push(...salesMetadataProblems(value.sales))
    if(value.snapshotVersion!==1&&value.snapshotVersion!==2){if(!Array.isArray(value.goods)||!Array.isArray(value.services)||value.goods.some(line=>!object(line))||value.services.some(line=>!object(line)))problems.push('未知清单版本的明细容器损坏。');continue}
    if (!Array.isArray(value.goods) || value.goods.some(line => !summaryShape(line) || !object(line) || !line.skuId || !string(line.lineId) || !line.lineId || !validBenefitQuantity(line.perPackageQuantity) || !validBenefitQuantity(line.totalQuantity) || !Number.isSafeInteger(Number(line.perPackageQuantity) * Number(value.packageCount)) || line.totalQuantity !== Number(line.perPackageQuantity) * Number(value.packageCount) || !compatibilityShape(line.compatibility) || !object(line.compatibility) || line.compatibility.skuId !== line.skuId) || value.snapshotVersion===1&&new Set(value.goods.map(line => line.skuId)).size !== value.goods.length || new Set(value.goods.map(line => line.lineId)).size !== value.goods.length || value.includedPhoneSkuId && !value.goods.some(line => line.skuId === value.includedPhoneSkuId)) problems.push('交付商品身份、明细或总数量无效。')
    if(value.snapshotVersion===2){
      if(value.compositionVersion!==2||!Array.isArray(value.goods)||value.goods.some(line=>!object(line)||!(line.groupId===null||string(line.groupId)&&!!line.groupId)||!['host','item'].includes(String(line.role))||line.groupName!==undefined&&!string(line.groupName)||line.role==='host'&&line.groupId!==null))problems.push('新版交付位置归组或角色结构无效。')
      else try{if(!Array.isArray(value.goodsSummary)||stable(summarizeBenefitDeliveryGoods(value.goods as unknown as BenefitDeliveryGoods[]))!==stable(value.goodsSummary))problems.push('新版交付按 SKU 汇总与冻结位置不一致。')}catch{problems.push('新版交付按 SKU 汇总数量无效。')}
      if(Array.isArray(value.goods)){const hosts=value.goods.filter(line=>object(line)&&line.role==='host');if(hosts.length===1?value.includedPhoneSkuId!==hosts[0].skuId:!!value.includedPhoneSkuId)problems.push('冻结主机位置与包含主机标识不一致。')}
      if(Array.isArray(value.goods)&&new Set(value.goods.map(line=>object(line)?stable([line.groupId,line.role,line.skuId]):undefined)).size!==value.goods.length)problems.push('新版交付同组 SKU 位置身份重复。')
    }
    if (!strings(value.hostSkuIds) || !Array.isArray(value.hostSkuIds) || new Set(value.hostSkuIds).size !== value.hostSkuIds.length || value.hostSkuIds.some(id => !id || !Array.isArray(value.goods) || !value.goods.some(line => object(line) && line.skuId === id)) || string(value.includedPhoneSkuId) && value.includedPhoneSkuId && !value.hostSkuIds.includes(value.includedPhoneSkuId)) problems.push('交付主机身份须为商品明细中的唯一 SKU 引用。')
    if (!Array.isArray(value.services) || value.services.some(line => !serviceShape(line) || !object(line) || !string(line.id) || !line.id || !string(line.name) || !line.name.trim() || !string(line.unit) || !line.unit.trim() || !validBenefitQuantity(line.perPackageQuantity) || !validBenefitQuantity(line.totalQuantity) || line.quantity !== line.perPackageQuantity || line.totalQuantity !== (line.measurement === 'per-delivery' ? line.quantity : Number(line.quantity) * Number(value.packageCount))) || new Set(value.services.map(line => line.id)).size !== value.services.length) problems.push('交付服务明细或计量无效。')
    if(object(value.sales)&&value.sales.schemaVersion===1&&Array.isArray(value.goods)&&value.goods.every(object)&&Array.isArray(value.services))problems.push(...salesPositionIdentityProblems({sales:value.sales,goods:value.goods.map(line=>({...line,id:line.lineId,snapshot:line})),services:value.services} as unknown as BenefitPackageDraft))
    if (!object(value.quote) || value.quote.currency !== 'CNY' || typeof value.quote.needsReview !== 'boolean' || (value.quote.amountCents === null ? value.quote.totalCents !== null : !validBenefitCents(value.quote.amountCents) || !validBenefitCents(value.quote.totalCents) || value.quote.totalCents !== Number(value.quote.amountCents) * Number(value.packageCount))) problems.push('交付清单报价无效。')
    if (!Array.isArray(value.confirmations) || !value.confirmations.every(confirmationShape) || !Array.isArray(value.issues) || value.issues.some(issue => !object(issue) || !string(issue.code) || !string(issue.message) || issue.severity !== 'warning')) problems.push('交付清单条件或确认说明无效。')
  }
  for(const record of [...(Array.isArray(data.benefitPackages)?data.benefitPackages:[]),...(Array.isArray(data.benefitDeliveries)?data.benefitDeliveries:[])])if(object(record)){
    if(record.snapshotVersion!==undefined&&record.snapshotVersion!==1&&record.snapshotVersion!==2||record.compositionVersion!==undefined&&record.compositionVersion!==1&&record.compositionVersion!==2)continue
    for(const key of ['goods','services'])if(Array.isArray(record[key]))for(const line of record[key])if(object(line)){const e=referencePriceProblem(line.referencePrice);if(e)problems.push(e)}
  }
  if(!problems.length)for(const d of (data.benefitDeliveries||[]) as BenefitDeliverySnapshot[]){
    if(d.snapshotVersion!==1&&d.snapshotVersion!==2)continue
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
