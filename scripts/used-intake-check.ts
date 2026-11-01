import assert from 'node:assert/strict'
import {createPinia,setActivePinia} from 'pinia'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {useCatalogStore} from '../src/stores/catalog'
import {intakeChain} from '../src/domain/usedGoods/intake'
import {STORAGE_KEY,DATA_VERSION} from '../src/domain/types'
installCatalogTestLocks();const data=createSeed(),disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
let chain=intakeChain(store.data);assert(!chain.fields.some(f=>'value'in f));assert(chain.modelId);assert(store.data.productSpecNodes.filter(n=>n.templateId===chain.modelId).every(n=>n.nodeType==='ATTRIBUTE'&&!n.valueId));chain=intakeChain(store.data)
const basis=JSON.stringify(chain),answers={brand:'小米',model:'xiaomi17promax',color:'黑色',memory:'8G',capacity:'512G'},details={cost:'1200',serial:'',imei:'imei-1',note:''},protectedData=JSON.stringify([store.data.families,store.data.skus,store.data.benefitSalesLists])
assert(!(await store.receiveUsedPhone({...answers,brand:''},details,basis,'missing')).ok)
const before=store.exportJson();fail=true;assert(!(await store.receiveUsedPhone(answers,details,basis,'request-1')).ok);assert.equal(store.exportJson(),before)
const first=await store.receiveUsedPhone(answers,details,basis,'request-1');assert(first.ok);assert((await store.receiveUsedPhone(answers,details,basis,'request-1')).ok);assert.equal(store.data.usedGoods!.skus.length,1)
assert(!(await store.receiveUsedPhone(answers,details,basis,'duplicate-imei')).ok)
assert((await store.receiveUsedPhone(answers,{...details,imei:'imei-2'},basis,'request-2')).ok);assert.equal(store.data.usedGoods!.spus.length,1);assert.equal(store.data.usedGoods!.skus.length,2)
const row=store.data.usedGoods!.skus[0]!;assert.equal(row.status,'pending');assert.equal(row.spec,'512G + 8G');assert.equal(row.costCents,120000);assert(row.intake?.fields.some(f=>f.key==='model'&&f.value==='xiaomi17promax'))
store.data.params.find(p=>p.intakeKey==='color')!.name='机身颜色';assert(!(await store.receiveUsedPhone(answers,details,basis,'outdated')).ok)
assert.equal(JSON.stringify([store.data.families,store.data.skus,store.data.benefitSalesLists]),protectedData)
const currentBasis=JSON.stringify(intakeChain(store.data)),unknown={brand:'无',model:'无',color:'无',memory:'无',capacity:'无'};for(const i of [1,2])assert((await store.receiveUsedPhone(unknown,{...details,imei:'unknown-'+i},currentBasis,'unknown-'+i)).ok);assert.equal(store.data.usedGoods!.spus.filter(p=>p.brand==='无'&&p.model==='无').length,2);
store.$dispose();console.log('PASS 纯属性链路、完整填写、回收建档、失败保留、请求幂等、IMEI防重、独立实物与同款归属、链路过期和原数据保护')
