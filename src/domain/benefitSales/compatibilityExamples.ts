import type {AppData} from '../types'
import {resolveDeviceSku} from '../deviceResolution'
import {cloneRecord} from '../recordCopy'
/** Explicit seed/menu action only; ordinary reads never install or overwrite facts. */
export function addCompatibilityExamples(data:AppData){
 const now='2026-10-30T12:00:00.000Z',source='内部模拟核对资料：仅用于功能演示，不代表真实供应商适用承诺。'
 const occupied=new Set([...(data.compatibilities||[]).map(c=>c.targetId||c.accessorySkuId),...(data.generalCompatibilityClaims||[]).map(c=>c.skuId)])
 let added=0;const claims=[...(data.compatibilities||[])],general=[...(data.generalCompatibilityClaims||[])]
 for(const prefix of ['demo18','huawei']){const device=resolveDeviceSku(data,prefix+'-sku-phone-1');if(device.status!=='resolved'||!device.host)continue
  for(const kind of ['case','film'])for(const s of data.skus.filter(s=>s.id.startsWith(prefix+'-sku-'+kind+'-'))){if(occupied.has(s.id))continue;claims.push({id:'sample-'+s.id,accessorySkuId:s.id,targetId:s.id,targetKind:'sku',host:cloneRecord(device.host),conclusion:'compatible',verification:'confirmed',capability:'basic',conditions:[],source,note:'内部模拟资料',createdAt:now,updatedAt:now});added++}
 }
 const port=data.params.find(p=>p.id==='demo18-port'),phoneType=data.productTypes.find(t=>t.id==='pt-phone'&&t.catalogRole==='host')
 if(port&&phoneType)for(const id of ['demo18-sku-charger-1','demo18-sku-charger-2']){if(occupied.has(id)||!data.skus.some(s=>s.id===id))continue;general.push({id:'sample-general-'+id,skuId:id,deviceTypeIds:[phoneType.id],capability:'basic',conditions:[{kind:'attribute',attributeId:port.id,operator:'eq',value:'USB-C'}],conclusion:'compatible',verification:'confirmed',source,note:'仅确认基本使用，未确认快充',revision:1,createdAt:now,updatedAt:now});added++
  if(id.endsWith('-2')){const device=resolveDeviceSku(data,'huawei-sku-phone-1');if(device.host){claims.push({id:'sample-deny-'+id,accessorySkuId:id,targetId:id,targetKind:'sku',host:cloneRecord(device.host),conclusion:'incompatible',verification:'confirmed',capability:'basic',conditions:[],source,note:'内部模拟：具体限制阻断通用支持',createdAt:now,updatedAt:now});added++}}
 }
 const pendingSku=data.skus.find(s=>s.id==='demo18-sku-case-2'),other=resolveDeviceSku(data,'huawei-sku-phone-1');if(pendingSku&&!occupied.has(pendingSku.id)&&other.host){claims.push({id:'sample-pending-'+pendingSku.id,accessorySkuId:pendingSku.id,targetId:pendingSku.id,targetKind:'sku',host:cloneRecord(other.host),conclusion:'compatible',verification:'pending',capability:'basic',conditions:[],source,note:'内部模拟：尚未完成核对',createdAt:now,updatedAt:now});added++}
 if(added){data.compatibilities=claims;data.generalCompatibilityClaims=general}return {ok:true as const,added,message:added?'已补充 '+added+' 条内部模拟适用资料；已有商品关系原样保留。':'没有需要补充的适用资料；已有关系与商品保持。'}
}
