import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {specPublishProblems} from '../src/domain/logic'
import {legalPlanningCombinations} from '../src/domain/planning'
import {useCatalogStore} from '../src/stores/catalog'
import {STORAGE_KEY,DATA_VERSION} from '../src/domain/types'
import {intakeChain} from '../src/domain/usedGoods/intake'
import {usedListFields,usedFieldValue,usedSpuFieldValues} from '../src/domain/usedGoods/listFields'
installCatalogTestLocks();const data=createSeed(),disk=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>disk.set(k,v),removeItem:(k:string)=>disk.delete(k)}})
const id='used-phone-intake-model',nodes=data.productSpecNodes.filter(n=>n.templateId===id)
assert.deepEqual(specPublishProblems(data,nodes),[]);
const other=JSON.parse(JSON.stringify(data));other.categories.push({id:'used-child',name:'回收机',parentId:'phone-used',sort:1,enabled:true});other.productTypes.push({id:'another-type',name:'另一产品类型',categoryId:'used-child',status:'enabled',sort:1,description:''});other.specCanvases.push({...other.specCanvases.find((m:{templateId:string})=>m.templateId===id),templateId:'arbitrary-model',productTypeId:'another-type',name:'任意名称'});assert.deepEqual(specPublishProblems(other,nodes.map(n=>({...n,templateId:'arbitrary-model'}))),[]);
assert.deepEqual(legalPlanningCombinations(data,id,nodes),[])
const normal=JSON.parse(JSON.stringify(data));normal.productTypes.find((t:{id:string})=>t.id==='used-phone-type').categoryId='phone-new';assert(specPublishProblems(normal,nodes).some(s=>s.includes('没有取值')))
assert(specPublishProblems(data,nodes.map((n,i)=>i===0?{...n,attributeId:'missing'}:n)).some(s=>s.includes('属性词典')))
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence();const before=JSON.stringify([store.data.planningRecords,store.data.skus,store.data.materialReceipts]);assert((await store.publishSpecModel(id)).ok);assert.equal(JSON.stringify([store.data.planningRecords,store.data.skus,store.data.materialReceipts]),before)
const basis=JSON.stringify(intakeChain(store.data)),details={cost:'',serial:'',imei:'',note:''}
for(const [i,color,memory] of [[1,'黑色','8G'],[2,'白色','12G']] as const)assert((await store.receiveUsedPhone({brand:'小米',model:'17 Pro Max',color,memory,capacity:'512G'},details,basis,'dynamic-'+i)).ok)
const fields=usedListFields(store.data);assert.deepEqual(fields.map(f=>f.label),['品牌','型号','颜色','内存','容量']);const memory=fields.find(f=>f.key==='memory')!;assert.equal(usedFieldValue(store.data.usedGoods!,store.data.usedGoods!.skus[0]!,memory),'8G');assert.deepEqual(usedSpuFieldValues(store.data.usedGoods!,store.data.usedGoods!.spus[0]!.id,memory),['8G','12G'])
store.$dispose();console.log('PASS 二手机纯key校验和发布、全新仍要求value、非法属性拒绝、无规划物料副作用、SKU字段及SPU多值汇总')
