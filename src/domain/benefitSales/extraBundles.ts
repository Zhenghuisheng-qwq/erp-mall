import type {AppData} from '../types'
import type {ExtraBundle,SaleLine,SaleScope} from './types'
import {saleQuery,saleProblem,saleLabel,availableBenefitGroups,deviceKey} from './query'
import {roleOfType} from '../productTypePurpose'
import {familyProductTypeId} from '../productIdentity'
export const lineKey=(line:SaleLine)=>line.bundle?line.bundle.id+':'+line.skuId:line.skuId
export function validBundle(b:ExtraBundle){return !!b&&typeof b.id==='string'&&!!b.id&&b.id.length<=100&&typeof b.hostSkuId==='string'&&!!b.hostSkuId&&typeof b.withAccessories==='boolean'&&['gift','sale'].includes(b.kind)}
export function bundleCandidates(data:AppData,scope:SaleScope,bundle:ExtraBundle){
 const empty:ReturnType<typeof saleQuery>['candidates']=[]
 if(!validBundle(bundle)||bundle.kind!=='gift'||bundle.parentGroupId!==undefined&&bundle.parentGroupId!==scope.groupId||bundle.parentDeviceKey!==undefined&&bundle.parentDeviceKey!==deviceKey(scope.device)||saleQuery(data,scope).error)return empty
 const host=data.skus.find(s=>s.id===bundle.hostSkuId)
 if(!host||saleProblem(data,host.id)||roleOfType(data,familyProductTypeId(data,host.familyId))!=='host')return empty
 const device={kind:'sku' as const,skuId:host.id},group=availableBenefitGroups(data,device)[0]
 const hostCandidate={id:host.id,...saleLabel(data,host.id),publicSpuIds:[] as string[],sources:[],note:'赠送主机'}
 if(!bundle.withAccessories||!group)return [hostCandidate]
 const query=saleQuery(data,{mode:'group',groupId:group.id,categoryId:group.categoryId,productTypeIds:group.productTypeIds,device,purchaseMode:'with_accessories'})
 return query.candidates
}
