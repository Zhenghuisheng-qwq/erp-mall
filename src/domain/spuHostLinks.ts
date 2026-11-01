import type {AppData} from './types'
import {isRealSku} from './catalogIdentity'
import {familyProductTypeId} from './productIdentity'
import {roleOfType,productTypeAvailabilityProblem} from './productTypePurpose'
import {shelfOf} from './logic'
export interface SpuHostLink {id:string;accessorySpuId:string;hostSpuIds:string[];revision:number;createdAt:string;updatedAt:string}
export function linkSpuProblem(data:AppData,id:string,role:'host'|'accessory'){
 const rows=data.families.filter(f=>f.id===id),spu=rows[0];if(rows.length!==1||!spu||spu.line==='v3')return '请选择商品 SPU，物料档案不能建立关联'
 const typeId=familyProductTypeId(data,spu.id)
 return productTypeAvailabilityProblem(data,typeId)||(roleOfType(data,typeId)!==role?(role==='host'?'请选择主机分类下的 SPU':'请选择配件分类下的 SPU'):'')
}
export function linkSpuOptions(data:AppData,role:'host'|'accessory'){return data.families.filter(f=>!linkSpuProblem(data,f.id,role)).map(f=>({id:f.id,name:f.name,code:f.oaProductId||f.id,status:shelfOf(f),skuCount:data.skus.filter(s=>s.familyId===f.id&&isRealSku(data,s)).length,typeId:familyProductTypeId(data,f.id)}))}
export function spuLinkLabel(data:AppData,id:string){const f=data.families.find(f=>f.id===id);return f?`${f.name} · ${f.oaProductId||f.id}`:'SPU 已失效 · '+id}
export function saveSpuHostLink(data:AppData,accessorySpuId:string,hostSpuIds:string[],revision:number,now:string){
 const old=data.spuHostLinks?.find(r=>r.accessorySpuId===accessorySpuId)
 if(revision!==(old?.revision||0))return {ok:false,message:'关联已被修改，请重新打开核对；当前选择保留'}
 const issue=linkSpuProblem(data,accessorySpuId,'accessory');if(issue)return {ok:false,message:issue}
 if(!Array.isArray(hostSpuIds)||!hostSpuIds.length||hostSpuIds.length>1000||hostSpuIds.some(id=>typeof id!=='string')||new Set(hostSpuIds).size!==hostSpuIds.length)return {ok:false,message:'请勾选一个或多个主机 SPU，不能重复'}
 for(const id of hostSpuIds){const problem=linkSpuProblem(data,id,'host');if(problem)return {ok:false,message:problem}}
 const ids=[...hostSpuIds].sort();if(old&&JSON.stringify([...old.hostSpuIds].sort())===JSON.stringify(ids))return {ok:true,record:old}
 const record:SpuHostLink={id:old?.id||accessorySpuId,accessorySpuId,hostSpuIds:ids,revision:revision+1,createdAt:old?.createdAt||now,updatedAt:now}
 data.spuHostLinks=[...(data.spuHostLinks||[]).filter(r=>r.accessorySpuId!==accessorySpuId),record];return {ok:true,record}
}
export function removeSpuHostLink(data:AppData,id:string,revision:number){const record=data.spuHostLinks?.find(r=>r.id===id);if(!record||record.revision!==revision)return {ok:false,message:'关联已变化，请刷新后重新操作'};data.spuHostLinks=data.spuHostLinks!.filter(r=>r.id!==id);return {ok:true}}
export function spuHostLinkStorageProblems(data:AppData){const rows=data.spuHostLinks;if(rows===undefined)return [];if(!Array.isArray(rows))return ['SKU 主机关联集合无效'];const ids=new Set<string>(),accessories=new Set<string>();for(const r of rows){if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.accessorySpuId!=='string'||!r.accessorySpuId||accessories.has(r.accessorySpuId)||!Array.isArray(r.hostSpuIds)||!r.hostSpuIds.length||r.hostSpuIds.length>1000||r.hostSpuIds.some(id=>typeof id!=='string'||!id)||new Set(r.hostSpuIds).size!==r.hostSpuIds.length||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.createdAt!=='string'||typeof r.updatedAt!=='string')return ['SKU 主机关联身份、引用或修订格式无效'];ids.add(r.id);accessories.add(r.accessorySpuId)}return []}

/** Retain the original SKU records as historical input and migrate once by stable familyId. */
export function migrateSpuHostLinks(data:AppData){
 if(data.spuHostLinkMigrationVersion===1)return false
 const grouped=new Map((data.spuHostLinks||[]).map(r=>[r.accessorySpuId,{...r,hostSpuIds:[...r.hostSpuIds]}])),issues:string[]=[]
 for(const row of data.skuHostLinks||[]){const accessory=data.skus.find(s=>s.id===row.accessorySkuId),hosts=row.hostSkuIds.map(id=>data.skus.find(s=>s.id===id));if(!accessory||!data.families.some(f=>f.id===accessory.familyId)||hosts.some(s=>!s||!data.families.some(f=>f.id===s.familyId))){issues.push(row.accessorySkuId);continue}
  const previous=grouped.get(accessory.familyId),hostIds=[...new Set([...(previous?.hostSpuIds||[]),...hosts.map(s=>s!.familyId)])].sort()
  grouped.set(accessory.familyId,{id:previous?.id||accessory.familyId,accessorySpuId:accessory.familyId,hostSpuIds:hostIds,revision:Math.max(previous?.revision||0,row.revision)+1,createdAt:previous&&previous.createdAt<row.createdAt?previous.createdAt:row.createdAt,updatedAt:previous&&previous.updatedAt>row.updatedAt?previous.updatedAt:row.updatedAt})
 }
 if(grouped.size||data.spuHostLinks)data.spuHostLinks=[...grouped.values()]
 if(issues.length)data.spuHostLinkMigrationIssues=issues
 data.spuHostLinkMigrationVersion=1;return true
}
