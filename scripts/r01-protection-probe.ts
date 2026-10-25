import { mkdirSync, writeFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { r01ProtectionFixture } from './r01-protection-fixture'
import { dictionaryRemovalBlock, valueRenameDecision } from '../src/domain/dictionaryGuard'
import { businessIssues, resolveNodeBusiness, defaultBusinessDefinitions } from '../src/domain/nodeBusiness'
import { normalizeStored, useCatalogStore } from '../src/stores/catalog'
import { DATA_VERSION, STORAGE_KEY } from '../src/domain/types'
installCatalogTestLocks()
const disk = new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>disk.set(k,v)}})
const f = r01ProtectionFixture(), results: Record<string,unknown> = {}
results.dictionary={removeBlock:dictionaryRemovalBlock(f.data,f.attributeId,'颜色2'),rename:valueRenameDecision(f.data,f.attributeId,'颜色2','新颜色2')}
for(const field of ['directory','draft','snapshot']) {
  disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:{...f.data,activeRole:'operator'}}));setActivePinia(createPinia());const store=useCatalogStore();await store.waitForPersistence()
  const next=JSON.parse(store.exportJson())
  if(field==='directory') {next.data.businessDefinitions=defaultBusinessDefinitions();next.data.businessDefinitions[0].name='运营改目录'}
  else (field==='draft'?next.data.productSpecNodes:next.data.specModelVersions.find((v:{id:string})=>v.id==='protection-v1').nodesSnapshot).find((n:{id:string})=>n.id===f.nodeId).businessConfigs[0].enabled=false
  try{await store.importJson(JSON.stringify(next));results[field]='accepted'}catch(e){results[field]=String(e)}store.$dispose()
}
const broken=structuredClone(f.data);Object.assign(broken.productSpecNodes.find(n=>n.id===f.nodeId)!,{businessConfigs:{id:'object-not-array'}})
for(const [name,run] of Object.entries({normalize:()=>Boolean(normalizeStored({version:DATA_VERSION,data:structuredClone(broken)})),issues:()=>businessIssues(broken,broken.productSpecNodes),resolve:()=>resolveNodeBusiness(broken,broken.productSpecNodes,f.nodeId,'sales-position')})){
  try{results[name]=run()}catch(e){results[name]=String(e)}
}
const out=process.env.R01_PROTECTION_OUTPUT!;if(!out)throw Error('R01_PROTECTION_OUTPUT required');mkdirSync(out,{recursive:true});writeFileSync(`${out}/probe.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2))
