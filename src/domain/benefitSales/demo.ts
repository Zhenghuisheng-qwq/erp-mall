import {resolveDeviceSku} from '../deviceResolution'
import type {AppData,ProductFamily,Sku} from '../types'

const time='2026-10-30T00:00:00.000Z'
export const phoneDemoTypes=['pt-phone','pt-case','pt-film','pt-leaf-c-charge','pt-earphones','pt-demo-repair']
/** Only called by fresh seed creation. Existing data uses the explicit, atomic supplement command. */
export function completePhoneBenefitDemo(data:AppData){
 for(const [id,name,sort] of [['pt-case','手机壳',2],['pt-film','手机膜',3]] as const){const type=data.productTypes.find(t=>t.id===id)!;Object.assign(type,{name,categoryId:'c-phone',sort})}
 Object.assign(data.productTypes.find(t=>t.id==='pt-leaf-c-charge')!,{name:'充电器',categoryId:'c-phone',catalogRole:'accessory',sort:4,description:'手机选配演示'})
 data.productTypes=data.productTypes.filter(t=>t.id!=='pt-leaf-c-film')
 data.productTypes.push({id:'pt-earphones',name:'耳机',categoryId:'c-phone',catalogRole:'accessory',status:'enabled',sort:5,description:'手机选配演示'})
 data.params.push({id:'p-demo-port',name:'接口（演示）',values:['USB-C'],valueGroups:[],participateInStructure:false})
 data.templateParams.push({templateId:'t-phone',paramId:'p-demo-port',role:'variant',required:false})
 const iphone=data.families.find(f=>f.id==='f-iphone')!;iphone.name='Apple iPhone 17 · 演示'
 for(const id of ['s-iphone-blue','s-iphone-white']){const sku=data.skus.find(s=>s.id===id)!;sku.variantAttrs['p-demo-port']='USB-C';sku.code=id==='s-iphone-blue'?'DEMO-IP17-BLUE':'DEMO-IP17-WHITE';sku.recordKind='sku'}
 const nodes=data.specModelVersions.find(v=>v.id==='phone-demo-v2')!.nodesSnapshot.filter(n=>n.id==='sn-brand'||n.id.startsWith('sn-apple')||n.id==='sn-brand-apple').map(n=>({...n,id:`demo16-${n.id}`,parentId:n.parentId?`demo16-${n.parentId}`:null,valueId:n.valueId==='iPhone 17'?'iPhone 16':n.valueId}))
 data.specModelVersions.push({id:'phone-benefit-demo-v3',templateId:'t-phone',version:3,versionName:'手机选配演示',status:'published',nodesSnapshot:nodes,createdTime:time,publishTime:time})
 data.families.push({...JSON.parse(JSON.stringify(iphone)),id:'f-demo-iphone16',name:'Apple iPhone 16 · 演示',commonAttrs:{品牌:'Apple',系列:'iPhone 16',型号:'iPhone 16'},modelVersionId:'phone-benefit-demo-v3',createdAt:time,updatedAt:time})
 data.skus.push({id:'s-demo-iphone16',familyId:'f-demo-iphone16',code:'DEMO-IP16-WHITE',oaSkuId:'',recordKind:'sku',status:'on_sale',variantAttrs:{容量:'256G',颜色:'白色','p-demo-port':'USB-C'},projectedAttrs:{},modelVersionId:'phone-benefit-demo-v3',sourceNodeIds:['sn-brand-apple','sn-apple-series-iphone','sn-apple-model-17','sn-apple-cap-256','sn-apple-256-white'].map(id=>`demo16-${id}`),creationSource:{kind:'model',templateId:'t-phone',modelVersionId:'phone-benefit-demo-v3',createdAt:time}})
 const caseFamily=data.families.find(f=>f.id==='f-case')!,filmFamily=data.families.find(f=>f.id==='f-film')!
 Object.assign(caseFamily,{name:'iPhone 17 手机壳 · 演示',categoryId:'c-phone'})
 Object.assign(filmFamily,{name:'iPhone 17 手机膜 · 演示',categoryId:'c-phone',productTypeId:'pt-film',productModelId:'t-film'})
 data.mappings.find(m=>m.templateId==='t-film')!.categoryId='c-phone'
 data.specCanvases.push({templateId:'t-film',productTypeId:'pt-film',name:'手机膜',zoom:1,panX:0,panY:0,status:'draft',version:1,versionName:'',direction:'ltr'})
 const family=(id:string,name:string,type:string,templateId:string):ProductFamily=>({id,name,productTypeId:type,templateId,productModelId:templateId,categoryId:'c-phone',oaProductId:'',commonAttrs:{},productGroupIds:[],lifecycle:'ready',shelfStatus:'online',origin:'sample',createdAt:time,updatedAt:time})
 const sku=(id:string,familyId:string,name:string,color:string):Sku=>({id,familyId,skuName:name,code:id.toUpperCase(),oaSkuId:'',recordKind:'sku',status:'on_sale',variantAttrs:{颜色:color},projectedAttrs:{},createdAt:time,updatedAt:time})
 data.families.push(family('f-demo-case16','iPhone 16 手机壳 · 演示','pt-case','t-case-model'),family('f-demo-film16','iPhone 16 手机膜 · 演示','pt-film','t-film'))
 data.skus.push(sku('s-demo-case16','f-demo-case16','iPhone 16 透明保护壳 · 演示','透明'),sku('s-demo-film16','f-demo-film16','iPhone 16 高清保护膜 · 演示','透明'))
 for(const [type,kind,name,color] of [['pt-leaf-c-charge','charger','USB-C 公用充电器 · 演示','白色'],['pt-earphones','earphones','有线耳机 · 演示','白色']] as const){
  const templateId=`t-demo-${kind}`
  data.templates.push({id:templateId,name,parentId:'t-acc',enabled:true,structureOrder:['p-color']})
  data.templateParams.push({templateId,paramId:'p-color',role:'variant',required:true})
  data.mappings.push({templateId,categoryId:'c-phone'})
  data.specCanvases.push({templateId,productTypeId:type,name,zoom:1,panX:0,panY:0,status:'draft',version:1,versionName:'',direction:'ltr'})
  data.families.push(family(`f-demo-${kind}`,name,type,templateId));data.skus.push(sku(`s-demo-${kind}`,`f-demo-${kind}`,name,color))
 }
 data.productTypes.push({id:'pt-demo-repair',name:'手机维修零件（演示）',categoryId:'c-phone',catalogRole:'accessory',status:'enabled',sort:6,description:'完整建档与选购演示'})
 data.params.push({id:'p-demo-repair-part',name:'维修部件（演示）',values:['扬声器模组'],valueGroups:[],participateInStructure:true})
 data.templates.push({id:'t-demo-repair',name:'手机维修零件演示模型',parentId:'t-acc',enabled:true,structureOrder:['p-demo-repair-part']})
 data.templateParams.push({templateId:'t-demo-repair',paramId:'p-demo-repair-part',role:'variant',required:true});data.mappings.push({templateId:'t-demo-repair',categoryId:'c-phone'})
 const repairNodes=[{id:'demo-repair-attr',templateId:'t-demo-repair',parentId:null,nodeType:'ATTRIBUTE' as const,attributeId:'p-demo-repair-part',valueId:'',sort:1,role:'VARIANT' as const},{id:'demo-repair-speaker',templateId:'t-demo-repair',parentId:'demo-repair-attr',nodeType:'VALUE' as const,attributeId:'p-demo-repair-part',valueId:'扬声器模组',sort:1}]
 data.productSpecNodes.push(...repairNodes);data.specCanvases.push({templateId:'t-demo-repair',productTypeId:'pt-demo-repair',name:'手机维修零件演示模型',zoom:1,panX:0,panY:0,status:'published',version:1,versionName:'V1'})
 data.specModelVersions.push({id:'demo-repair-v1',templateId:'t-demo-repair',version:1,versionName:'V1',status:'published',nodesSnapshot:JSON.parse(JSON.stringify(repairNodes)),createdTime:time,publishTime:time})
 data.families.push({...family('f-demo-repair','iPhone 17 扬声器模组 · 演示','pt-demo-repair','t-demo-repair'),modelVersionId:'demo-repair-v1'})
 data.skus.push({...sku('s-demo-repair','f-demo-repair','iPhone 17 扬声器模组 · 演示',''),variantAttrs:{'p-demo-repair-part':'扬声器模组'},modelVersionId:'demo-repair-v1',sourceNodeIds:['demo-repair-speaker'],creationSource:{kind:'model',templateId:'t-demo-repair',modelVersionId:'demo-repair-v1',createdAt:time}})
 const source='仅供软件演示的适用资料，不代表真实供应商核验或实际商品承诺。'
 for(const [phone,targets] of [['s-iphone-blue',['s-case-clear','s-case-orange','s-film-1','s-demo-earphones','s-demo-repair']],['s-demo-iphone16',['s-demo-case16','s-demo-film16','s-demo-earphones']]] as const){
  const device=resolveDeviceSku(data,phone);if(device.status!=='resolved'||!device.host)throw new Error(`演示设备无法解析：${phone}`)
  for(const target of targets){data.compatibilities.push({id:`demo-benefit-${phone}-${target}`,accessorySkuId:target,targetKind:'sku',targetId:target,host:device.host,capability:'basic',conclusion:'compatible',verification:'confirmed',conditions:[],source,note:'演示依据',createdAt:time,updatedAt:time})}
 }
 data.generalCompatibilityClaims=[{id:'demo-benefit-general-charger',skuId:'s-demo-charger',deviceTypeIds:['pt-phone'],capability:'basic',conditions:[{kind:'attribute',attributeId:'p-demo-port',operator:'eq',value:'USB-C'}],conclusion:'compatible',verification:'confirmed',source,note:'仅演示基本使用，不承诺快充',revision:1,createdAt:time,updatedAt:time}]
 data.benefitTypeGroups=[{id:'demo-phone-basic',name:'手机基础权益包',categoryId:'c-phone',productTypeIds:[...phoneDemoTypes],enabled:true,sort:1,revision:1,createdAt:time,updatedAt:time}]
}

export const demoKeys=['categories','productTypes','params','templates','templateParams','mappings','specCanvases','productSpecNodes','specModelVersions','planningRecords','families','skus','compatibilities','generalCompatibilityClaims','benefitTypeGroups'] as const
function stable(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(stable).join(',')}]`
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')+'}'
 return JSON.stringify(value)
}
function identity(key:string,row:Record<string,unknown>){return key==='planningRecords'?String(row.planningId):key==='templateParams'?`${row.templateId}:${row.paramId}`:key==='mappings'?String(row.templateId):key==='specCanvases'?String(row.templateId):String(row.id)}
/** Exact known seed records only. A conflict aborts the whole supplement; no fuzzy matching or partial writes. */
export function supplementPhoneDemo(current:AppData,before:AppData,after:AppData){
 const next=JSON.parse(JSON.stringify(current)) as AppData,conflicts:string[]=[];let added=0,updated=0
 for(const key of demoKeys){
  const old=(before[key]||[]) as unknown as Record<string,unknown>[],fresh=(after[key]||[]) as unknown as Record<string,unknown>[],live=(next[key]||[]) as unknown as Record<string,unknown>[]
  for(const row of fresh){const id=identity(key,row),previous=old.find(r=>identity(key,r)===id),changed=stable(previous)!==stable(row)
   // Shared model/parameter/category dependencies also have to retain their exact demo identities.
   const dependency=(key==='params'&&['p-brand','p-series','p-model','p-cap','p-color'].includes(id))||(key==='categories'&&['c-host','c-phone'].includes(id))||(key==='templates'&&['t-phone','t-host','t-acc','t-film','t-case-model'].includes(id))||(key==='specModelVersions'&&id==='phone-demo-v2')||(key==='specCanvases'&&['t-phone','t-case-model'].includes(id))
   if(!changed&&!dependency)continue
   const matches=live.filter(r=>identity(key,r)===id),found=matches[0]
   if(matches.length>1){conflicts.push(`${key}/${id}`);continue}
   if(found&&stable(found)===stable(row))continue
   const priorBundle=key==='benefitTypeGroups'&&id==='demo-phone-basic'&&stable(found)===stable({...row,productTypeIds:phoneDemoTypes.filter(t=>t!=='pt-demo-repair')})
   if(priorBundle){live[live.indexOf(found!)]=JSON.parse(JSON.stringify(row));updated++;continue}
   if(found&&(!previous||stable(found)!==stable(previous))){conflicts.push(`${key}/${id}`);continue}
   if(!found){live.push(JSON.parse(JSON.stringify(row)));added++}else if(changed){live[live.indexOf(found)]=JSON.parse(JSON.stringify(row));updated++}
  }
  Object.assign(next,{[key]:live})
 }
 // Remove only the exact unused auto-generated film stub, never a user-maintained type.
 const redundant=current.productTypes.find(t=>t.id==='pt-leaf-c-film'),original=before.productTypes.find(t=>t.id==='pt-leaf-c-film')
 if(redundant){if(stable(redundant)!==stable(original)||Object.entries(current).some(([key,value])=>key!=='productTypes'&&JSON.stringify(value)?.includes(JSON.stringify(redundant.id))))conflicts.push('原始保护膜占位类型已被使用');else{next.productTypes=next.productTypes.filter(t=>t.id!==redundant.id);updated++}}
 const movedTypes=new Set(before.productTypes.filter(t=>after.productTypes.some(n=>n.id===t.id&&n.categoryId!==t.categoryId)).map(t=>t.id))
 const changedFamilies=new Set(before.families.filter(f=>after.families.some(n=>n.id===f.id&&stable(n)!==stable(f))).map(f=>f.id))
 for(const f of current.families)if(!before.families.some(old=>old.id===f.id)&&!after.families.some(row=>row.id===f.id)&&(movedTypes.has(f.productTypeId||'')||current.specCanvases.some(c=>c.templateId===(f.productModelId||f.templateId)&&movedTypes.has(c.productTypeId||''))))conflicts.push(`演示类型已关联自建商品/${f.id}`)
 for(const sku of current.skus)if(changedFamilies.has(sku.familyId)&&!before.skus.some(old=>old.id===sku.id)&&!after.skus.some(row=>row.id===sku.id))conflicts.push(`演示商品已增加自建规格/${sku.id}`)
 // The reused phone category must remain a leaf, including any user-created descendants.
 if(current.categories.some(c=>c.parentId==='c-phone'))conflicts.push('手机分类已有子分类')
 if(conflicts.length)return {ok:false as const,message:`以下演示记录或依赖已被修改，本次未写入任何数据：${conflicts.slice(0,6).join('、')}。请保留现有数据，按系统说明手动配置。`}
 return {ok:true as const,next,added,updated,message:added||updated?`已补充 ${added} 条、更新 ${updated} 条原始演示记录`:'演示数据已完整，无需重复补充'}
}
