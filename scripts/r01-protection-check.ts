import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { r01ProtectionFixture } from './r01-protection-fixture'
import { dictionaryRemovalBlock, valueRenameDecision } from '../src/domain/dictionaryGuard'
import { allowedBusinessValues, businessIssues, defaultBusinessDefinitions, resolveNodeBusiness } from '../src/domain/nodeBusiness'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'
import { DATA_VERSION, STORAGE_KEY, type AppData } from '../src/domain/types'
installCatalogTestLocks()
const out=process.env.R01_PROTECTION_OUTPUT!;assert(out);mkdirSync(out,{recursive:true})
const checks:string[]=[];const pass=(s:string)=>{checks.push(s);console.log('PASS '+s)}
const disk=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>disk.set(k,v),removeItem:(k:string)=>disk.delete(k)}})
const f=r01ProtectionFixture(), payload=(data:AppData)=>JSON.stringify({version:DATA_VERSION,data})
async function open(data=structuredClone(f.data)){disk.set(STORAGE_KEY,payload(data));setActivePinia(createPinia());const s=useCatalogStore();await s.waitForPersistence();return s}
const node=(d:AppData)=>d.productSpecNodes.find(n=>n.id===f.nodeId)!
for(const source of ['draft','snapshot']) {
  const d=structuredClone(f.data)
  if(source==='draft')d.specModelVersions=[];else delete node(d).businessConfigs
  assert(!d.productSpecNodes.some(n=>n.valueId==='颜色2'))
  assert.match(dictionaryRemovalBlock(d,f.attributeId,'颜色2'),source==='draft'?/草稿.*r01-model.*Apple/:/历史版本 V1.*Apple/)
  assert.equal(valueRenameDecision(d,f.attributeId,'颜色2','新颜色2').ok,false)
  const store=await open(d), before=store.exportJson(), raw=disk.get(STORAGE_KEY)
  assert.match(store.removeParamValue(f.attributeId,'颜色2'),/允许值配置/)
  await store.waitForPersistence();assert.equal(store.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),raw);store.$dispose()
  pass(`${source} only reference blocks domain rename and real Store deletion without changes`)
}
{
  const d=structuredClone(f.data);d.params.push({id:'other-color',name:'另一颜色',values:['颜色2'],valueGroups:[],participateInStructure:true})
  for(const [id,value] of [['other-color','颜色2'],[f.attributeId,'颜色10']]){
    assert.equal(dictionaryRemovalBlock(d,id!,value),'');assert.equal(valueRenameDecision(d,id!,value!,'新值').ok,true)
    const s=await open(d);assert.equal(s.removeParamValue(id!,value!),'');await s.waitForPersistence();assert(!s.data.params.find(p=>p.id===id)!.values.includes(value!));s.$dispose()
  }
  assert(f.data.specModelVersions.find(v=>v.id==='protection-v1')!.nodesSnapshot.find(n=>n.id===f.nodeId)!.businessConfigs![0]!.dictionarySnapshot!.values.includes('颜色10'))
  pass('same text in another attribute and frozen but unselected candidates remain maintainable')
}
for(const field of ['directory','draft','snapshot','frozen']) {
  const d=structuredClone(f.data);d.activeRole='operator';const s=await open(d),before=s.exportJson(),raw=disk.get(STORAGE_KEY),next=JSON.parse(before)
  next.data.activeRole='admin' // incoming role must never authorize this import
  if(field==='directory'){next.data.businessDefinitions=defaultBusinessDefinitions();next.data.businessDefinitions[0].name='运营改目录'}
  else {
    const n=(field==='draft'?next.data.productSpecNodes:next.data.specModelVersions.find((v:{id:string})=>v.id==='protection-v1').nodesSnapshot).find((n:{id:string})=>n.id===f.nodeId)
    if(field==='frozen')n.businessConfigs[0].dictionarySnapshot.name='运营改冻结词典';else n.businessConfigs[0].enabled=false
  }
  await assert.rejects(()=>s.importJson(JSON.stringify(next)),/当前角色仅可查看节点业务配置/)
  await s.waitForPersistence();assert.equal(s.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),raw);assert.equal(s.data.activeRole,'operator');s.$dispose()
  pass(`operator ${field} import rejected atomically using pre-import role`)
}
{
  const s=await open(),backup=s.exportJson();await s.importJson(backup)
  assert.deepEqual(JSON.parse(s.exportJson()),JSON.parse(backup));assert.deepEqual(JSON.parse(disk.get(STORAGE_KEY)!).data,JSON.parse(backup).data);s.$dispose()
  pass('admin export/restore preserves configs and frozen snapshots completely')
}
const mutations:Record<string,(d:AppData)=>void>={
  'definitions object':d=>Object.assign(d,{businessDefinitions:{id:'bad'}}),
  'definitions null record':d=>Object.assign(d,{businessDefinitions:[null]}),
  'definition missing kind':d=>Object.assign(d,{businessDefinitions:[{id:'future',name:'Future',description:'',enabled:true}]}),
  'configs object':d=>Object.assign(node(d),{businessConfigs:{id:'object-not-array'}}),
  'configs null':d=>Object.assign(node(d),{businessConfigs:null}),
  'null record':d=>Object.assign(node(d),{businessConfigs:[null]}),
  'missing parameters':d=>{delete (node(d).businessConfigs![0] as unknown as Record<string,unknown>).parameters},
  'missing values':d=>{node(d).businessConfigs![0]!.parameters={attributeId:f.attributeId}},
  'snapshot null record':d=>Object.assign(d.specModelVersions.find(v=>v.id==='protection-v1')!.nodesSnapshot.find(n=>n.id===f.nodeId)!,{businessConfigs:[null]}),
  'broken frozen definition':d=>Object.assign(d.specModelVersions.find(v=>v.id==='protection-v1')!.nodesSnapshot.find(n=>n.id===f.nodeId)!.businessConfigs![0]!,{definitionSnapshot:null}),
}
for(const [name,mutate] of Object.entries(mutations)) {
  const d=structuredClone(f.data);mutate(d)
  assert.throws(()=>normalizeStored({version:DATA_VERSION,data:structuredClone(d)}),/结构校验失败/)
  const s=await open(),before=s.exportJson(),raw=disk.get(STORAGE_KEY)
  await assert.rejects(()=>s.importJson(payload(d)),/结构校验失败/);await s.waitForPersistence();assert.equal(s.exportJson(),before);assert.equal(disk.get(STORAGE_KEY),raw);s.$dispose()
  const nodes=name.startsWith('snapshot')||name.startsWith('broken frozen')?d.specModelVersions.find(v=>v.id==='protection-v1')!.nodesSnapshot:d.productSpecNodes
  assert(businessIssues(d,nodes).length);assert.equal(resolveNodeBusiness(d,nodes,f.nodeId,'sales-position').state,'invalid')
  assert.equal(allowedBusinessValues(d,nodes,`${f.modelId}-apple-color`).values.length,0)
  disk.set(STORAGE_KEY,payload(d));setActivePinia(createPinia());assert.throws(()=>useCatalogStore(),/原始存储已保留/);assert.equal(disk.get(STORAGE_KEY),payload(d))
  pass(`${name}: import atomic, startup recovery preserves raw, resolver reports invalid safely`)
}
for(const future of ['unknown-definition','unknown-kind']){
  const d=structuredClone(f.data),c=node(d).businessConfigs![0]!
  c.definitionId='future:definition';c.parameters={future:{raw:[1,'原文',null]}};c.scope='future-scope'
  if(future==='unknown-kind')d.businessDefinitions=[...defaultBusinessDefinitions(),{id:c.definitionId,kind:'future-kind',name:'未来类型',description:'保留',enabled:true}]
  const s=await open();await s.importJson(payload(d));assert.deepEqual(node(s.data).businessConfigs,node(d).businessConfigs)
  assert(businessIssues(s.data,s.data.productSpecNodes).some(i=>i.message.includes('不支持')))
  assert.equal((await s.publishSpecModel(f.modelId)).ok,false)
  assert.deepEqual(node(s.data).businessConfigs,node(d).businessConfigs);s.$dispose()
  pass(`${future}: valid raw record retained and affected publication refused`)
}
writeFileSync(`${out}/checks.json`,JSON.stringify({passed:checks.length,checks},null,2))
