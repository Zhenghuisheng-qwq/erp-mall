import type {AppData} from '../types'
import {usedIntakeModels} from './intakeModel'
import {intakeChain,type IntakeField} from './intake'
import type {UsedGoods,UsedSku} from './index'
export function usedListFields(data:AppData){const fields=new Map<string,IntakeField>();for(const m of usedIntakeModels(data))for(const f of intakeChain(data,m.templateId).fields)fields.set(f.key,f);for(const sku of data.usedGoods?.skus||[])for(const f of sku.intake?.fields||[])if(!fields.has(f.key))fields.set(f.key,{key:f.key,label:f.label});return [...fields.values()]}
export function usedFieldValue(data:UsedGoods,sku:UsedSku,field:IntakeField){const spu=data.spus.find(p=>p.id===sku.spuId);if(field.key==='brand')return spu?.brand||'';if(field.key==='model')return spu?.model||'';if(field.key==='color')return sku.color;const saved=sku.intake?.fields.find(f=>f.key===field.key),extra=sku.extra.find(e=>e.key===field.label||e.key===saved?.label);return extra?.value??saved?.value??''}
export function usedSpuFieldValues(data:UsedGoods,spuId:string,field:IntakeField){const spu=data.spus.find(p=>p.id===spuId);if(field.key==='brand')return spu?.brand?[spu.brand]:[];if(field.key==='model')return spu?.model?[spu.model]:[];return [...new Set(data.skus.filter(s=>s.spuId===spuId).map(s=>usedFieldValue(data,s,field)).filter(Boolean))]}
