import {createSeed} from '../src/domain/seed'
import {ensureRbac} from '../src/domain/rbac'
import type {BenefitSale} from '../src/domain/benefitSales/types'
export function bundleFixture(){
 const data=createSeed(),now='2026-10-30T00:00:00Z'
 data.productTypes.push({id:'bundle-empty-type',name:'零商品类型',categoryId:'c-phone',catalogRole:'other',status:'enabled',sort:100,description:'隔离检查，无 SKU'})
 // Stored historical payload; never recreate it by executing retired business logic.
 const scope={mode:'group' as const,groupId:'demo18-bundle-full',categoryId:'c-phone',productTypeIds:[...data.benefitTypeGroups![0]!.productTypeIds],device:{kind:'sku' as const,skuId:'demo18-sku-phone-1'}}
 const line={skuId:'demo18-sku-case-1',quantity:2,unitPriceCents:12345}
 const history:BenefitSale={id:'historical-sale',scope,lines:[line],status:'confirmed',revision:1,createdAt:now,updatedAt:now,snapshot:{device:{host:{steps:[{valueId:'Apple'},{valueId:'iPhone 18 Pro Max'}]}},scope:structuredClone(scope),lines:[{...line,name:'历史保护壳名称',spec:'历史透明规格',code:'HISTORY-001',declarations:[{id:'archived',source:'历史原始内容',opaque:{keep:true}}]}],totalCents:24690,confirmedAt:now}}
 data.benefitSalesLists=[history,{id:'historical-draft',scope:structuredClone(scope),lines:[{...line,unitPriceCents:null}],status:'draft',revision:1,createdAt:now,updatedAt:now}]
 ensureRbac(data)
 return {data,history}
}
