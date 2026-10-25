import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createPinia,setActivePinia } from 'pinia'
import { installCatalogTestLocks } from './catalog-storage-test-env'
import { r01Fixture } from './r01-fixture'
import { allowedBusinessValues,businessDefinitions,businessIssues,businessStructureProblem,configProblem,resolveNodeBusiness,type NodeBusinessConfig } from '../src/domain/nodeBusiness'
import { useCatalogStore,normalizeStored } from '../src/stores/catalog'
import { DATA_VERSION,STORAGE_KEY } from '../src/domain/types'
import { legalPlanningCombinations } from '../src/domain/planning'
import { rebindSpecNode,outlineChoices } from '../src/domain/outlineEdit'
import { captureEditor,editorEntry,prepareEditorUndo } from '../src/domain/editorHistory'
import { specPublishProblems } from '../src/domain/logic'
import { previewDraftCombinations } from '../src/domain/draftComboPreview'
import { nearestNamingRule } from '../src/domain/naming'
installCatalogTestLocks()
const artifacts=process.argv.includes('--artifacts'),output=process.env.R01_DOMAIN_OUTPUT || 'work/r01-20261025/domain';if(artifacts)mkdirSync(output,{recursive:true})
const checks:string[]=[];const pass=(s:string)=>{checks.push(s);console.log('PASS R01 '+s)}
const disk=new Map<string,string>();let fail=false
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(fail){fail=false;throw Error('quota')};disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
const {data,modelId}=r01Fixture();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data}));setActivePinia(createPinia());let store=useCatalogStore();await store.waitForPersistence()
const tree=()=>store.data.productSpecNodes.filter(n=>n.templateId===modelId),node=(id:string)=>store.data.productSpecNodes.find(n=>n.id===id)!,apple=`${modelId}-apple`,child=`${modelId}-apple-c1`,other=`${modelId}-other`,attr=`${modelId}-apple-color`
let serial=0
const config=(nodeId:string,definitionId:string,value:unknown,scope='subtree'):NodeBusinessConfig=>({id:`r01-config-${++serial}`,nodeId,modelId:node(nodeId).templateId,definitionId,enabled:true,scope,parameters:{value}})
const save=async(id:string,records:NodeBusinessConfig[])=>store.saveNodeBusiness(node(id).templateId,id,records,JSON.stringify(node(id)))
const originalCombos=legalPlanningCombinations(store.data,modelId,tree()).map(c=>c.identityKey)
const sales=config(apple,'business:sales','hot')
assert((await save(apple,[sales])).ok)
assert.equal(resolveNodeBusiness(store.data,tree(),child,'sales-position').parameters?.value,'hot')
assert.equal(resolveNodeBusiness(store.data,tree(),other,'sales-position').state,'none')
assert((await save('r01-other-apple',[config('r01-other-apple','business:sales','not-hot')])).ok)
pass('公共定义跨分类/类型使用；subtree 继承及兄弟隔离')
assert(!(await save(apple,[{...sales,scope:''}])).ok)
assert(!(await save(apple,[sales,{...sales,id:'duplicate'}])).ok)
assert((await save(apple,[{...sales,scope:'current'}])).ok)
assert.equal(resolveNodeBusiness(store.data,tree(),child,'sales-position').state,'none')
assert.equal(resolveNodeBusiness(store.data,tree(),apple,'sales-position').parameters?.value,'hot')
assert((await save(apple,[sales])).ok)
const material=config(apple,'business:material','shared')
const oldMaterials=JSON.stringify([store.data.families,store.data.skus,store.data.materialReceipts])
assert((await save(apple,[sales,material])).ok)
assert.deepEqual(legalPlanningCombinations(store.data,modelId,tree()).map(c=>c.identityKey),originalCombos)
assert.equal(JSON.stringify([store.data.families,store.data.skus,store.data.materialReceipts]),oldMaterials)
pass('明确 scope、拒绝重复；销售/物料策略不改变组合身份、不执行共用 MAT')
const restriction={...config(apple,'business:allowed',null),parameters:{attributeId:'r01-color',values:['颜色1','颜色2','颜色3','颜色4','颜色5']}}
assert((await save(apple,[sales,material,restriction])).ok)
assert.equal(allowedBusinessValues(store.data,tree(),attr).values.length,5)
assert.equal(allowedBusinessValues(store.data,tree(),`${modelId}-other-color`).values.length,10)
assert.equal(outlineChoices(store.data,child).length,5)
assert.equal(rebindSpecNode(store.data,child,{valueId:'颜色6'}).ok,false)
assert.equal(rebindSpecNode(store.data,child,{valueId:'颜色2'}).ok,true)
const added={...node(child),id:'later',valueId:'颜色3'};store.data.productSpecNodes.push(added)
assert.equal(resolveNodeBusiness(store.data,tree(),added.id,'sales-position').parameters?.value,'hot')
const invalid={...added,id:'invalid-later',valueId:'颜色6'}
assert(businessStructureProblem(store.data,tree(),[...tree(),invalid]))
store.data.productSpecNodes.push(invalid)
assert(businessIssues(store.data,tree()).some(i=>i.nodeId===invalid.id))
assert(specPublishProblems(store.data,tree()).some(p=>p.includes('invalid-later')))
assert(previewDraftCombinations(store.data,modelId,tree()).problems.length)
assert((await store.saveModelDraft(modelId)).ok)
assert.equal((await store.publishSpecModel(modelId)).ok,false)
assert.equal(node(invalid.id).valueId,'颜色6')
assert(rebindSpecNode(store.data,invalid.id,{valueId:'颜色4'}).ok)
pass('Apple 5 色/其他品牌 10 色；重绑命令、后加下级、越界导入草稿、预览及发布校验一致，修正不删节点')
{
  const branch=JSON.parse(JSON.stringify(tree())) as ReturnType<typeof tree>
  branch.push({...node(attr),id:'nested-color',parentId:child},{...node(child),id:'nested-value',parentId:'nested-color',valueId:'颜色1'})
  const owner=branch.find(n=>n.id===child)!
  owner.businessConfigs=[{...restriction,id:'nested-limit',nodeId:child,parameters:{attributeId:'r01-color',values:['颜色1','颜色2']}}]
  assert.equal(resolveNodeBusiness(store.data,branch,'nested-color','allowed-values','r01-color').state,'conflict')
  assert.equal(allowedBusinessValues(store.data,branch,'nested-color').values.length,0)
  assert(businessIssues(store.data,branch).some(i=>i.code==='restriction'))
  owner.businessConfigs[0]!.parameters.values=['颜色5','颜色4','颜色3','颜色2','颜色1']
  assert.equal(resolveNodeBusiness(store.data,branch,'nested-color','allowed-values','r01-color').state,'effective')
  assert.equal(resolveNodeBusiness(store.data,branch,'nested-color','allowed-values','r01-color').sources.length,2)
  assert.equal(allowedBusinessValues(store.data,branch,'nested-color').values.length,5)
}
pass('多重允许值限制不求交集；不一致冲突、等价集合汇总来源')
assert(configProblem(store.data,tree(),node(apple),{...restriction,scope:'current'}))
assert(configProblem(store.data,tree(),node(apple),{...restriction,parameters:{attributeId:'missing',values:['颜色1']}}))
assert(configProblem(store.data,tree(),node(apple),{...restriction,parameters:{attributeId:'r01-color',values:['missing']}}))
const conflict=config(child,'business:sales','not-hot')
assert((await save(child,[conflict])).ok)
assert.equal(resolveNodeBusiness(store.data,tree(),child,'sales-position').state,'conflict')
assert.equal(resolveNodeBusiness(store.data,tree(),child,'sales-position').sources.length,2)
assert(!(await store.publishSpecModel(modelId)).ok)
assert((await store.publishSpecModel('r01-other')).ok)
assert((await save(child,[{...conflict,parameters:{value:'hot'}}])).ok)
assert.equal(resolveNodeBusiness(store.data,tree(),child,'sales-position').sources.length,2)
assert.equal(resolveNodeBusiness(store.data,tree(),child,'sales-position').state,'effective')
assert((await save(child,[])).ok)
pass('冲突保留草稿/显示来源/阻止受影响发布，不阻止其他模型；等价配置汇总')
node(apple).namingRule=[{kind:'text',text:'R01-'},{kind:'field',key:'r01-color'}]
assert.equal(nearestNamingRule(tree(),child)?.nodeId,apple)
await store.waitForPersistence();assert((await store.publishSpecModel(modelId)).ok)
const v1=store.data.specModelVersions.filter(v=>v.templateId===modelId).at(-1)!,frozen=JSON.stringify(v1),plans=store.data.planningRecords.filter(r=>r.productModelId===modelId).map(r=>r.planningId)
const dictionaryChanged=JSON.parse(JSON.stringify(store.data)) as typeof data
dictionaryChanged.params.find(p=>p.id==='r01-color')!.values=['颜色1']
assert.equal(allowedBusinessValues(dictionaryChanged,v1.nodesSnapshot,attr).values.length,5)
assert.equal(businessIssues(dictionaryChanged,v1.nodesSnapshot).length,0)
assert(businessIssues(dictionaryChanged,tree()).some(i=>i.code==='config'))
const record=store.data.planningRecords.find(r=>r.productModelId===modelId)!
const made=await store.createMaterial({productModelId:modelId,modelVersionId:v1.id,planningId:record.planningId,requestId:'r01-mat',categoryId:'c-phone',productTypeId:'r01-type'})
assert(made.ok, made.message)
const matBefore=JSON.stringify([store.data.families,store.data.skus,store.data.materialReceipts])
const before=captureEditor(store.data,modelId)
assert((await save(apple,[{...sales,parameters:{value:'not-hot'}},material,restriction])).ok)
assert.equal(previewDraftCombinations(store.data,modelId,tree()).sameAsPublished,false)
const entry=editorEntry(modelId,1,before,captureEditor(store.data,modelId))!
assert(entry);assert(prepareEditorUndo(store.data,entry,modelId,1).ok)
assert((await store.publishSpecModel(modelId)).ok)
assert.equal(JSON.stringify(store.data.specModelVersions.find(v=>v.id===v1.id)),frozen)
assert.equal(resolveNodeBusiness(store.data,v1.nodesSnapshot,child,'sales-position').parameters?.value,'hot')
assert.deepEqual(store.data.planningRecords.filter(r=>r.productModelId===modelId).map(r=>r.planningId),plans)
assert.equal(JSON.stringify([store.data.families,store.data.skus,store.data.materialReceipts]),matBefore)
pass('配置进入编辑历史和发布比较；V2 发布沿用 PLN；V1/旧 MAT/命名来源不变')
const definition=businessDefinitions(store.data).find(d=>d.id==='business:sales')!
assert((await store.saveBusinessDefinition({...definition,name:'新目录名称',enabled:false})).ok)
assert(!(await store.saveBusinessDefinition(definition,true)).ok)
assert.equal(resolveNodeBusiness(store.data,v1.nodesSnapshot,child,'sales-position').hits[0]?.definition.name,'销售定位')
assert.equal(resolveNodeBusiness(store.data,tree(),child,'sales-position').parameters?.value,'not-hot')
const copied=await store.copyProductModel(modelId,{name:'R01副本',productTypeId:'r01-other-type'});assert(copied.ok)
const copyId=(copied as {templateId:string}).templateId
const copiedNodes=store.data.productSpecNodes.filter(n=>n.templateId===copyId)
assert(copiedNodes.some(n=>n.businessConfigs?.length))
for(const n of copiedNodes)for(const c of n.businessConfigs||[]){assert.equal(c.nodeId,n.id);assert.equal(c.modelId,copyId);assert(!tree().some(o=>o.businessConfigs?.some(x=>x.id===c.id)))}
const exported=JSON.parse(JSON.stringify({version:DATA_VERSION,data:store.data}))
assert.deepEqual(normalizeStored(exported)?.productSpecNodes.filter(n=>n.templateId===copyId),copiedNodes.map(n=>JSON.parse(JSON.stringify(n))))
pass('目录停用及引用删除保护；发布冻结定义；跨类型复制重映射；JSON 导出/恢复保留')
const stateBefore=JSON.stringify(store.data),diskBefore=disk.get(STORAGE_KEY),draft=[{...material,parameters:{value:'independent'}}]
fail=true;assert(!(await save(apple,draft)).ok);assert.equal(JSON.stringify(store.data),stateBefore);assert.equal(disk.get(STORAGE_KEY),diskBefore);assert.equal(draft[0]!.parameters.value,'independent')
assert((await save(apple,draft)).ok)
assert((await save(apple,[{...draft[0]!,enabled:false}])).ok)
assert.equal(resolveNodeBusiness(store.data,tree(),child,'material-policy').state,'none')
assert((await save(apple,[])).ok)
const unknown={...sales,id:'unknown',definitionId:'future:unsupported',parameters:{arbitrary:{original:true}}}
node(apple).businessConfigs=[unknown];await store.waitForPersistence()
assert((await store.saveModelDraft(modelId)).ok);assert(!(await store.publishSpecModel(modelId)).ok)
store.$dispose();setActivePinia(createPinia());store=useCatalogStore();await store.waitForPersistence()
assert.deepEqual(JSON.parse(JSON.stringify(node(apple).businessConfigs)),[unknown])
assert((await save(apple,[])).ok)
const raw=disk.get(STORAGE_KEY)!,external=JSON.parse(raw);external.data.templates[0].name='外部编辑';disk.set(STORAGE_KEY,JSON.stringify(external))
assert(!(await save(apple,draft)).ok);assert.equal(draft[0]!.parameters.value,'independent')
pass('增改停删与刷新；配额失败原子性；未知配置保留并阻止发布；外部更新拒绝且输入保留')
store.$dispose();if(artifacts)writeFileSync(`${output}/result.json`,JSON.stringify({passed:true,checks},null,2))
