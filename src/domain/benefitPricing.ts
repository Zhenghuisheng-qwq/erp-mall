import type { BenefitPackageDraft, BenefitReferencePrice, BenefitReferenceTotals } from './benefitPackageTypes'
import { validBenefitCents, validBenefitQuantity, parseBenefitAmount } from './benefitPackages'
export function referencePriceProblem(value:unknown):string {
 if(value===undefined)return ''
 if(!value||typeof value!=='object'||Array.isArray(value))return '参考单价结构无效。'
 const p=value as BenefitReferencePrice
 if(p.inputText!==undefined){try{if(typeof p.inputText!=='string'||parseBenefitAmount(p.inputText)!==p.amountCents)return '参考单价输入与金额不一致，请修正原输入。'}catch{return '参考单价须为非负金额，最多两位小数，且不能超出安全范围。'}}
 return p.source!=='manual'||!Number.isFinite(Date.parse(p.enteredAt))||p.amountCents!==null&&!validBenefitCents(p.amountCents)?'参考单价须为空或安全范围内的非负整数分，来源须为本次人工输入。':''
}
export function referenceLine(price:BenefitReferencePrice|undefined,quantity:number):number|null {
 const problem=referencePriceProblem(price);if(problem)throw Error(problem)
 if(!validBenefitQuantity(quantity))throw Error('参考金额数量无效。')
 if(price?.amountCents===undefined||price.amountCents===null)return null
 const total=price.amountCents*quantity;if(!validBenefitCents(total))throw Error('参考金额乘法溢出。');return total
}
export function benefitReferenceTotals(draft:Pick<BenefitPackageDraft,'goods'|'services'|'quote'>,count=1):BenefitReferenceTotals {
 if(!validBenefitQuantity(count))throw Error('包数无效。')
 let perPackageKnownCents=0,perDeliveryKnownCents=0,missingCount=0
 for(const line of [...draft.goods,...draft.services]){
  const amount=referenceLine(line.referencePrice,line.quantity);if(amount===null)missingCount++
  if('measurement' in line&&line.measurement==='per-delivery')perDeliveryKnownCents+=amount||0;else perPackageKnownCents+=amount||0
  if(!validBenefitCents(perPackageKnownCents)||!validBenefitCents(perDeliveryKnownCents))throw Error('参考金额累加溢出。')
 }
 const subtotal=perPackageKnownCents*count,totalKnownCents=subtotal+perDeliveryKnownCents
 if(!validBenefitCents(subtotal)||!validBenefitCents(totalKnownCents))throw Error('本次参考金额超出安全范围。')
 const quote=draft.quote.amountCents,quoted=quote===null?null:quote*count
 if(quoted!==null&&!validBenefitCents(quoted))throw Error('整包报价乘法溢出。')
 const differenceCents=missingCount||quoted===null?null:totalKnownCents-quoted
 if(differenceCents!==null&&!Number.isSafeInteger(differenceCents))throw Error('参考差额溢出。')
 return {perPackageKnownCents,perDeliveryKnownCents,totalKnownCents,missingCount,complete:missingCount===0,differenceCents}
}
