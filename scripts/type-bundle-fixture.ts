import {deviceSourceStamp} from '../src/domain/deviceResolution'
import {createAccessoryCompatibilityFixture} from './accessory-compatibility-fixtures'
import {ensureRbac} from '../src/domain/rbac'
import {copy} from '../src/domain/benefitSales/commands'
export function bundleFixture(){const {data,hosts}=createAccessoryCompatibilityFixture()
 data.productTypes.push({id:'type-empty',name:'暂无商品的耳机',catalogRole:'accessory',categoryId:'cat-accessory-test',status:'enabled',sort:10,description:'隔离样例'})
 const film=data.skus.find(s=>s.id==='film-sku')!,decl=data.compatibilities.find(d=>d.id==='decl-film-a')!
 data.skus.push({...copy(film),id:'film-b',code:'FILM-B',skuName:'只适用 B 的膜'})
 data.compatibilities.push({...copy(decl),id:'decl-film-b',accessorySkuId:'film-b',targetId:'film-b',host:copy(hosts.b)},{...copy(data.compatibilities.find(d=>d.id==='decl-charger-basic')!),id:'decl-charger-b',host:copy(hosts.b)})
 data.specCanvases.push({templateId:'template-device-test',productTypeId:'type-device',name:'测试手机模型',status:'draft',version:1,versionName:'',zoom:1,panX:0,panY:0,direction:'ltr'})
 data.productSpecNodes.push({id:'node-model',templateId:'template-device-test',parentId:null,nodeType:'ATTRIBUTE',attributeId:'attr-device-model',valueId:'',sort:1,role:'COMMON'},{id:'node-a',templateId:'template-device-test',parentId:'node-model',nodeType:'VALUE',attributeId:'attr-device-model',valueId:'Orion A',sort:1})
 Object.assign(data,{benefitGroups:[{id:'old',name:'旧限制包',hostRanges:[{kind:'snapshot',versionId:'old-only'}]}],benefitSelections:[{id:'old-confirmed',status:'confirmed',snapshot:{raw:'保留原文'}}]})
 ensureRbac(data)
 const codes=['product:bundle-sale:read','product:bundle-sale:create','product:bundle-sale:update','product:bundle-sale:confirm','product:type-bundle:read','product:category:read','product:type:read','product:sku:read','product:spu:read','product:compatibility:read']
 data.rbac!.roles.push({id:'test-sales',code:'test-sales',name:'隔离销售',description:'无永久配置修改权限',enabled:true,permissionCodes:codes})
 data.users.push({id:'test-sales',username:'test-sales',displayName:'隔离销售',role:'operator',enabled:true,roleIds:['test-sales']})
 return {data,hosts}
}

export function generalFixture(){const fixture=bundleFixture(),{data}=fixture
 for(const [id,name] of [['type-tablet','测试平板'],['type-computer','测试电脑']])data.productTypes.push({id:id!,name:name!,catalogRole:'host',categoryId:'cat-device-test',status:'enabled',sort:20,description:'隔离设备事实'})
 for(const [id,type,port] of [['tablet','type-tablet','USB-C'],['computer','type-computer','USB-C'],['phone-wrong','type-device','Lightning'],['phone-new','type-device','USB-C']]){
  const family={...copy(data.families.find(f=>f.id==='family-device')!),id:`family-${id}`,productTypeId:type!,name:`隔离 ${id}`};data.families.push(family)
  const sku={...copy(data.skus.find(s=>s.id==='phone-a')!),id:id!,familyId:family.id,skuName:`隔离 ${id}`,code:id!,variantAttrs:{接口:port!}};data.skus.push(sku)
  data.deviceModels!.push({id:`model-${id}`,name:`隔离型号 ${id}`,productTypeId:type!,attributes:{},createdAt:'2026-10-29',updatedAt:'2026-10-29'})
  data.deviceBindings!.push({skuId:id!,host:{scope:'model',productTypeId:type!,productModelId:`device:model-${id}`,identityKey:`device:model-${id}`,steps:[{attributeId:'device-model',attributeName:'设备型号',valueId:`隔离型号 ${id}`}]},sourceStamp:deviceSourceStamp(data,id!),createdAt:'2026-10-29',updatedAt:'2026-10-29'})
 }
 data.skus.push({...copy(data.skus.find(s=>s.id==='charger-sku')!),id:'charger-white',skuName:'隔离白色充电器',code:'CHARGER-WHITE'})
 // General-scope tests begin with no charger-specific basic proof; other fixtures remain intact.
 data.compatibilities=data.compatibilities.filter(c=>c.targetId!=='charger-sku'||c.capability!=='basic')
 return fixture
}
