import type {AppData,ColumnPref,ListQuery} from '../types'
import {cloneRecord} from '../recordCopy'
import {installPhone18Demo,phone18DemoKeys} from './phone18Demo'
import {createV3Material} from '../material'
import {ensureProductListPages} from '../productListPages'

export const phoneCatalogKeys=[...phone18DemoKeys,'productPlans','materialReceipts','materialRelations','materialContributions','deviceModels','deviceBindings','nodeCompatibilityRules','templateCompatibilityConfigs','templateCompatibilityOrigins','rules','brands','productGroups','columns','listQuery','listViews','activeViewId','productListViews','activeProductListViewId','productListPages','benefitSalesLists','phoneDemoCatalogVersion'] as const satisfies readonly (keyof AppData)[]
/** Explicitly requested demo replacement; system identities and confirmed snapshots are retained. */
export function replacePhoneCatalogDemo(current:AppData,columns:ColumnPref[],listQuery:ListQuery){
 const clean=cloneRecord(current)
 Object.assign(clean,{categories:[{id:'c-phone',name:'手机',parentId:null,sort:1,enabled:true}],productTypes:[
  {id:'pt-case',name:'手机壳',categoryId:'c-phone',catalogRole:'accessory',sort:1,status:'enabled',description:''},
  {id:'pt-film',name:'手机膜',categoryId:'c-phone',catalogRole:'accessory',sort:2,status:'enabled',description:''},
  {id:'pt-leaf-c-charge',name:'充电器',categoryId:'c-phone',catalogRole:'accessory',sort:3,status:'enabled',description:''},
  {id:'pt-phone',name:'手机',categoryId:'c-phone',catalogRole:'host',sort:4,status:'enabled',description:''}
 ],params:[],templates:[],templateParams:[],mappings:[],productSpecNodes:[],specCanvases:[],specModelVersions:[],planningRecords:[],productPlans:[],families:[],skus:[],compatibilities:[],generalCompatibilityClaims:[],deviceModels:[],deviceBindings:[],nodeCompatibilityRules:[],templateCompatibilityConfigs:[],templateCompatibilityOrigins:[],materialReceipts:[],materialRelations:[],materialContributions:[],rules:[],brands:[{id:'brand-demo18-apple',name:'Apple',logo:'',description:'软件演示品牌',status:'enabled'}],productGroups:[],benefitTypeGroups:[],benefitSalesLists:(current.benefitSalesLists||[]).filter(s=>s.status==='confirmed'),columns:cloneRecord(columns),listQuery:cloneRecord(listQuery),listViews:[],activeViewId:'',productListViews:[],activeProductListViewId:'',phoneDemoCatalogVersion:1})
 delete clean.productListPages
 const installed=installPhone18Demo(clean)
 if(!installed.ok)return installed
 const next=installed.next;let sequence=0
 for(const plan of next.planningRecords){const typeId=next.specCanvases.find(c=>c.templateId===plan.productModelId)!.productTypeId!
  const made=createV3Material(next,{productModelId:plan.productModelId,modelVersionId:plan.modelVersionId,planningId:plan.planningId,requestId:`demo18-mat-${plan.planningId}`,categoryId:'c-phone',productTypeId:typeId,skuName:`${next.productTypes.find(t=>t.id===typeId)!.name}物料 · ${plan.steps.filter(s=>s.role==='variant').map(s=>s.valueId).join(' / ')}`,now:'2026-10-30T08:00:00.000Z',nextId:prefix=>`demo18-mat-${prefix}-${++sequence}`})
  if(!made.ok)return {ok:false as const,message:`物料创建失败：${made.message}。当前数据未改变。`}
  const material=next.skus.find(s=>s.id===made.skuId)!,family=next.families.find(f=>f.id===made.familyId)!
  // MAT retains its material identity even while its archive is available/online.
  material.status='on_sale';family.lifecycle='ready';family.shelfStatus='online'
 }
 ensureProductListPages(next)
 return {ok:true as const,next,message:'旧商品演示数据已清理。手机分类现有 4 个产品类型、4 个已发布模型、10 个在售 SKU、10 条已建档 MAT 和 2 个权益包。'}
}
