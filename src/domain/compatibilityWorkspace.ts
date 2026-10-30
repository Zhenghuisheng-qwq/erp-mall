import type {AppData,CompatibilityLink} from './types'
import type {CompatibilityChange,DeclarationDraft} from './accessoryCompatibilityCommands'
import {applyCompatibilityChanges} from './accessoryCompatibilityCommands'
import {applyGeneralChanges,type GeneralChange} from './generalCompatibility'
import {deviceHostKey,listDeviceModels} from './deviceResolution'
import {declarationDefaults} from './accessoryCompatibilityQuery'
import {cloneRecord} from './recordCopy'
export const workspaceBasis=(data:AppData,skuIds:string[])=>JSON.stringify([data.skus.filter(s=>skuIds.includes(s.id)),data.families.filter(f=>data.skus.some(s=>skuIds.includes(s.id)&&s.familyId===f.id)),data.productTypes.filter(t=>data.families.some(f=>data.skus.some(s=>skuIds.includes(s.id)&&s.familyId===f.id)&&f.productTypeId===t.id)),(data.compatibilities||[]).filter(c=>skuIds.includes(c.targetId||c.accessorySkuId)),(data.generalCompatibilityClaims||[]).filter(c=>skuIds.includes(c.skuId))])
export function previewWorkspace(data:AppData,changes:CompatibilityChange[],general:GeneralChange[]){const candidate=cloneRecord(data);candidate.compatibilities||=[];let n=0;const first=changes.length?applyCompatibilityChanges(candidate,changes,()=> 'preview-model-'+ ++n,new Date().toISOString()):{ok:true as const,message:''};if(!first.ok)return {ok:false as const,message:first.message||'型号资料无效'};const second=general.length?applyGeneralChanges(candidate,general,()=> 'preview-general-'+ ++n,new Date().toISOString()):{ok:true as const,message:''};return second.ok?{ok:true as const,candidate}:{ok:false as const,message:second.message||'通用资料无效'}}
export function simpleClaims(data:AppData,skuIds:string[],capability='basic'){return (data.compatibilities||[]).filter(c=>skuIds.includes(c.targetId||c.accessorySkuId)&&c.targetKind==='sku'&&c.host.scope==='model'&&declarationDefaults(c).capability===capability&&!c.conditions?.length)}
export function modelChanges(data:AppData,skuIds:string[],touches:Record<string,boolean>,removeMode:'remove'|'deny',form:{conclusion:'compatible'|'incompatible';verification:'confirmed'|'pending';source:string;capability:'basic'|'fast-charge'|'other'},allowOpposite=false){
 const changes:CompatibilityChange[]=[],rows=simpleClaims(data,skuIds,form.capability),options=listDeviceModels(data)
 for(const [key,checked]of Object.entries(touches)){const option=options.find(o=>o.key===key);if(!option)return {ok:false as const,message:'设备型号已变化，请重新核对。'}
  for(const skuId of skuIds){const existing=rows.filter(c=>(c.targetId||c.accessorySkuId)===skuId&&deviceHostKey(c.host)===key)
   if(!checked&&removeMode==='remove'){for(const c of existing)changes.push({kind:'remove',id:c.id});continue}
   const conclusion=checked?form.conclusion:'incompatible'
   if(checked&&existing.some(c=>c.verification==='confirmed'&&c.conclusion!==conclusion)&&!allowOpposite)return {ok:false as const,message:'所选型号存在相反结论，请明确确认修改，或保留原资料。'}
   const draft:DeclarationDraft={target:{kind:'sku',id:skuId},host:cloneRecord(option.host),conclusion,verification:form.verification,capability:form.capability,conditions:[],source:form.source,note:'',provenance:{kind:'manual',detail:'商品适用管理'}}
   if(existing.length){for(const c of existing)changes.push({kind:'edit',id:c.id,draft})}else if(checked||removeMode==='deny')changes.push({kind:'add',draft})
  }
 }
 return {ok:true as const,changes}
}
export function claimStatus(claim:CompatibilityLink){const c=declarationDefaults(claim);return c.verification!=='confirmed'?'待核验':c.conclusion==='incompatible'?'明确不适用':c.conclusion==='conditional'?'条件适用':'已确认适用'}

/** Lightweight association editing; advanced, negative and general facts are never replaced. */
export function associationChanges(data:AppData,skuIds:string[],modelKeys:string[],mode:'add'|'replace',source:string){
 const changes:CompatibilityChange[]=[],options=listDeviceModels(data),known=new Set(options.map(m=>m.key)),keys=new Set(modelKeys),rows=simpleClaims(data,skuIds)
 if(!skuIds.length||new Set(skuIds).size!==skuIds.length)return {ok:false as const,message:'请明确选择需要维护的商品'}
 if(modelKeys.some(key=>!known.has(key)))return {ok:false as const,message:'所选型号已变化，请重新选择'}
 if(mode==='add'&&!modelKeys.length)return {ok:false as const,message:'请选择要新增的适用型号'}
 for(const skuId of skuIds){const existing=rows.filter(c=>(c.targetId||c.accessorySkuId)===skuId)
  if(mode==='replace')for(const c of existing){const d=declarationDefaults(c);if(d.conclusion==='compatible'&&d.verification==='confirmed'&&known.has(deviceHostKey(c.host))&&!keys.has(deviceHostKey(c.host)))changes.push({kind:'remove',id:c.id})}
  for(const key of keys){const pair=existing.filter(c=>deviceHostKey(c.host)===key)
   if(pair.some(c=>{const d=declarationDefaults(c);return d.conclusion==='incompatible'&&d.verification==='confirmed'}))return {ok:false as const,message:'所选商品已有明确不适用记录，本次未修改；请先核对该商品的实际资料。'}
   if(pair.some(c=>{const d=declarationDefaults(c);return d.conclusion==='compatible'&&d.verification==='confirmed'}))continue
   const pending=pair.find(c=>{const d=declarationDefaults(c);return d.conclusion==='compatible'&&d.verification==='pending'})
   const draft:DeclarationDraft={target:{kind:'sku',id:skuId},host:cloneRecord(options.find(m=>m.key===key)!.host),conclusion:'compatible',verification:'confirmed',capability:'basic',conditions:[],source,note:'',provenance:{kind:'manual',detail:'管理员明确选择适用型号；未附加资料说明'}}
   if(pending){draft.source=[pending.source,source].filter(Boolean).join('；');draft.note=pending.note||''}
   changes.push(pending?{kind:'edit',id:pending.id,draft}:{kind:'add',draft})
  }
 }
 return {ok:true as const,changes}
}
