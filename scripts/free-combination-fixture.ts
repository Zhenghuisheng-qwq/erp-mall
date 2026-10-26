import { createAccessoryCompatibilityFixture, ACCESSORY_TEST_TIME } from './accessory-compatibility-fixtures'
import { applyBenefitFramework, frameworkSnapshot } from '../src/domain/benefitFrameworks'
import { newBenefitPackageDraft } from '../src/domain/benefitPackages'
import type { BenefitFramework, BenefitSelectionGroup } from '../src/domain/benefitPackageTypes'
export function freeCombinationGroup(id:string,typeId:string):BenefitSelectionGroup{return {id,name:`【隔离测试】${id}`,enabled:true,scope:{kind:'product-types',productTypeIds:[typeId],compatibleOnly:false},candidateSkuIds:[],required:false,minKinds:1,maxKinds:2,defaultQuantity:1,adjustable:true,minQuantity:1,maxQuantity:5}}
export function createFreeCombinationFixture(){
 const base=createAccessoryCompatibilityFixture(),framework:BenefitFramework={id:'free-framework',kind:'type-v2',rules:[],name:'【隔离测试】自由组合框架',status:'available',revision:1,groups:[freeCombinationGroup('buy','type-case'),freeCombinationGroup('gift','type-case'),freeCombinationGroup('film','type-film'),freeCombinationGroup('cable','type-cable')],createdAt:ACCESSORY_TEST_TIME,updatedAt:ACCESSORY_TEST_TIME,creationRequestId:'free-fixture-create',creationIntent:'isolated-fixture',history:[]}
 framework.history=[frameworkSnapshot(framework)];base.data.benefitFrameworks=[framework];base.data.benefitPackages=[];base.data.benefitDeliveries=[]
 const createDraft=()=>{const draft=applyBenefitFramework(newBenefitPackageDraft({kind:'sku',skuId:base.ids.phoneA}),framework);draft.name='【隔离测试】本次自由组合';return draft}
 return {...base,framework,createDraft}
}
