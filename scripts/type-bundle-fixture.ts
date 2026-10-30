import {createSeed} from '../src/domain/seed'
import {completePhoneBenefitDemo} from '../src/domain/benefitSales/demo'
import {installPhone18Demo} from '../src/domain/benefitSales/phone18Demo'
import {writeSale} from '../src/domain/benefitSales/commands'
export function bundleFixture(){
 const legacy=createSeed(false);completePhoneBenefitDemo(legacy);const installed=installPhone18Demo(legacy);if(!installed.ok)throw Error(installed.message);const data=installed.next,now='2026-10-30T00:00:00Z'
 data.productTypes.push({id:'bundle-empty-type',name:'演示零商品类型',categoryId:'c-phone',catalogRole:'other',status:'enabled',sort:100,description:'隔离检查，无 SKU'})
 const saved=writeSale(data,{id:'',scope:{mode:'group',groupId:'demo-phone-basic',categoryId:'c-phone',productTypeIds:[...data.benefitTypeGroups![0]!.productTypeIds],device:{kind:'sku',skuId:'s-iphone-blue'}},lines:[{skuId:'s-demo-charger',quantity:2,unitPriceCents:12345}],status:'confirmed'},0,()=> 'historical-sale',now)
 if(!saved.ok)throw Error(saved.message)
 data.compatibilities=data.compatibilities.filter(l=>l.targetId!=='s-demo-earphones')
 return {data,history:saved.record}
}
