import type {AppData,CompatibilityLink} from './types'
import {cloneRecord} from './recordCopy'
import {applyCompatibilityChanges,declarationDraft,type CompatibilityChange,type DeclarationDraft} from './accessoryCompatibilityCommands'
import {applyGeneralChanges,type GeneralChange} from './generalCompatibility'
import {deviceHostKey,listDeviceModels} from './deviceResolution'
export const compatibilityWorkspaceBasis=(data:AppData)=>JSON.stringify([data.compatibilities,data.generalCompatibilityClaims,data.skus,data.families,data.productTypes,data.params,data.specCanvases,data.specModelVersions,data.deviceBindings,data.deviceModels,data.templates,data.templateParams,data.planningRecords,data.productPlans])
export const skuDeclarations=(data:AppData,skuId:string)=>data.compatibilities.filter(l=>(l.targetKind==='sku'&&l.targetId===skuId))
export const selectableModelLinks=(data:AppData,skuId:string,capability:DeclarationDraft['capability']='basic')=>skuDeclarations(data,skuId).filter(l=>l.host.scope==='model'&&(l.capability||'basic')===capability&&l.conclusion!=='incompatible'&&!(l.conditions||[]).length)
export function selectedModelKeys(data:AppData,skuIds:string[],capability:DeclarationDraft['capability']='basic'){return listDeviceModels(data).filter(m=>skuIds.length&&skuIds.every(id=>selectableModelLinks(data,id,capability).some(l=>deviceHostKey(l.host)===m.key))).map(m=>m.key)}
export function modelSelectionChanges(data:AppData,skuIds:string[],before:string[],after:string[],removal:'remove'|'deny',common:Pick<DeclarationDraft,'source'|'verification'|'conclusion'|'capability'>){
 const changes:CompatibilityChange[]=[],models=listDeviceModels(data)
 for(const skuId of skuIds){
  for(const key of before.filter(k=>!after.includes(k)))for(const row of selectableModelLinks(data,skuId,common.capability).filter(l=>deviceHostKey(l.host)===key))changes.push(removal==='remove'?{kind:'remove',id:row.id}:{kind:'edit',id:row.id,draft:{...declarationDraft(row),conclusion:'incompatible',verification:common.verification,source:common.source||row.source||'',note:'管理员明确改为不适用'}})
  for(const key of after.filter(k=>!before.includes(k))){const option=models.find(m=>m.key===key);if(option)changes.push({kind:'add',draft:{target:{kind:'sku',id:skuId},host:cloneRecord(option.host),...common,conditions:[],note:'',provenance:{kind:'manual',detail:common.source}}})}
 }
 return changes
}
/** Run the production command validators on a detached candidate; never change saved records during preview. */
export function previewWorkspace(data:AppData,changes:CompatibilityChange[],general:GeneralChange[]){
 const candidate=cloneRecord(data);let seq=0
 const explicit=applyCompatibilityChanges(candidate,changes,()=>`preview-explicit-${++seq}`,'preview')
 if(!explicit.ok)return {ok:false as const,message:explicit.preview?.items.filter(i=>['invalid','conflict'].includes(i.state)).map(i=>i.message).join('；')||explicit.message||'型号资料无效',candidate}
 if(general.length){const result=applyGeneralChanges(candidate,general,()=>`preview-general-${++seq}`,'preview');if(!result.ok)return {ok:false as const,message:result.message||'通用条件无效',candidate}}
 return {ok:true as const,message:'',candidate}
}
export function mergeModelChanges(generated:CompatibilityChange[],edits:Record<string,DeclarationDraft>,removed:string[]){
 const keyed=new Map<string,CompatibilityChange>(),added:CompatibilityChange[]=[]
 for(const c of generated)if(c.kind==='add')added.push(c);else keyed.set(c.id,c)
 for(const [id,draft] of Object.entries(edits))keyed.set(id,{kind:'edit',id,draft})
 for(const id of removed)keyed.set(id,{kind:'remove',id})
 return [...keyed.values(),...added]
}
export const declarationLabel=(row:CompatibilityLink)=>row.conclusion==='incompatible'?'明确不适用':row.verification==='confirmed'?'已核验':'待核验'
