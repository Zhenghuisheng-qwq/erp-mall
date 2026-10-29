import {createAccessoryCompatibilityFixture,ACCESSORY_TEST_TIME as now} from './accessory-compatibility-fixtures'
import {hostFrom} from '../src/domain/compatibility'
import {ensureRbac,permissionRegistry} from '../src/domain/rbac'
import type {ProductSpecNode,CompatibilityLink} from '../src/domain/types'
/** Isolated explicit demonstration evidence; never called during normal loading. */
export function benefitsFixture(){
 const {data}=createAccessoryCompatibilityFixture(),modelId='benefits-demo-model',versionId='benefits-demo-v1'
 data.templates.push({id:modelId,name:'演示双型号手机',parentId:null,enabled:true,structureOrder:['attr-device-model','attr-color']})
 data.specCanvases.push({templateId:modelId,productTypeId:'type-device',name:'演示双型号手机',status:'published',version:1,versionName:'演示 V1',zoom:1,panX:0,panY:0})
 data.categories.push({id:'cat-case',name:'壳与膜',parentId:'cat-accessory-test',enabled:true,sort:1},{id:'cat-charge',name:'独立充电目录',parentId:null,enabled:true,sort:3})
 for(const t of data.productTypes)if(t.catalogRole==='accessory')t.categoryId=['type-charger','type-cable'].includes(t.id)?'cat-charge':'cat-case'
 const nodes:ProductSpecNode[]=[
  {id:'demo-brand',templateId:modelId,parentId:null,nodeType:'ATTRIBUTE',attributeId:'attr-brand',valueId:'',sort:1,role:'COMMON'},
  ...['A','B'].flatMap((x,i):ProductSpecNode[]=>[
   {id:'demo-brand-'+x,templateId:modelId,parentId:'demo-brand',nodeType:'VALUE',attributeId:'attr-brand',valueId:x==='A'?'Apple（演示）':'华为（演示）',sort:i+1},
   {id:'demo-model-'+x,templateId:modelId,parentId:'demo-brand-'+x,nodeType:'ATTRIBUTE',attributeId:'attr-device-model',valueId:'',sort:1,role:'COMMON'},
   {id:'demo-'+x,templateId:modelId,parentId:'demo-model-'+x,nodeType:'VALUE',attributeId:'attr-device-model',valueId:'Orion '+x,sort:1},
  ])]
 data.productSpecNodes=nodes;data.specModelVersions=[{id:versionId,templateId:modelId,version:1,versionName:'演示 V1',status:'published',nodesSnapshot:structuredClone(nodes),createdTime:now,publishTime:now}]
 const family=data.families.find(f=>f.id==='family-device')!;Object.assign(family,{templateId:modelId,productModelId:modelId,modelVersionId:versionId})
 data.deviceBindings=[];data.deviceModels=[]
 for(const x of ['a','b']){const sku=data.skus.find(s=>s.id==='phone-'+x)!;Object.assign(sku,{skuName:'演示手机 '+x.toUpperCase(),modelVersionId:versionId,sourceNodeIds:['demo-'+x.toUpperCase()],creationSource:{kind:'model',templateId:modelId,modelVersionId:versionId,createdAt:now}})}
 delete family.commonAttrs['品牌'];for(const x of ['a','b'])data.skus.find(s=>s.id==='phone-'+x)!.variantAttrs['品牌']=x==='a'?'Apple（演示）':'华为（演示）'
 const hosts={a:hostFrom('type-device',modelId,[{attributeId:'attr-brand',attributeName:'品牌',valueId:'Apple（演示）'},{attributeId:'attr-device-model',attributeName:'测试设备型号',valueId:'Orion A'}]),b:hostFrom('type-device',modelId,[{attributeId:'attr-brand',attributeName:'品牌',valueId:'华为（演示）'},{attributeId:'attr-device-model',attributeName:'测试设备型号',valueId:'Orion B'}])}
 const link=(id:string,target:string,key:'a'|'b',extra:Partial<CompatibilityLink>={}):CompatibilityLink=>({id,accessorySkuId:target,targetKind:'sku',targetId:target,host:structuredClone(hosts[key]),capability:'basic',conclusion:'compatible',verification:'confirmed',conditions:[],source:'仅限隔离演示的适用依据，不代表真实设备核验',note:'演示',createdAt:now,updatedAt:now,...extra})
 data.skus.push({...structuredClone(data.skus.find(s=>s.id==='case-sku')!),id:'case-a-sku',code:'APPLE-CASE-DEMO',skuName:'Apple 专用壳（演示）'})
 data.compatibilities=[link('demo-apple-case','case-a-sku','a'),link('demo-a','film-sku','a'),link('demo-b','cable-sku','b'),link('demo-common-a','case-sku','a'),link('demo-common-b','case-sku','b'),link('demo-pending','pending-sku','a',{verification:'pending'}),link('demo-off','off-sale-sku','a'),link('demo-mat','mat-only','a',{targetKind:'material'}),link('demo-fast-basic','charger-sku','a'),link('demo-fast','charger-sku','a',{capability:'fast-charge',conclusion:'conditional',conditions:[{kind:'manual',text:'演示协议待核对'}]}),link('demo-condition','copy-sku','a',{conclusion:'conditional',conditions:[{kind:'manual',text:'演示条件待核对'}]})]
 data.benefitGroups=[];data.benefitSelections=[];ensureRbac(data)
 const read=['product:benefit-selection:read','product:benefit-group:read','product:sku:read','product:spu:read','product:type:read','product:compatibility:read']
 data.rbac!.roles.push({id:'demo-sales',code:'demo-sales',name:'演示销售',description:'无兼容性维护和权益包配置权限',enabled:true,permissionCodes:[...read,'product:benefit-selection:create','product:benefit-selection:update','product:benefit-selection:confirm']})
 data.users.push({id:'demo-sales-user',username:'demo-sales',displayName:'演示销售',role:'operator',enabled:true,roleIds:['demo-sales']})
 data.rbac!.permissions=permissionRegistry()
 return {data,modelId,versionId,hosts,now,link}
}
