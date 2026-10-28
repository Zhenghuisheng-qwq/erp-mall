import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('catalog-closure'),errors=[],only=process.env.CLOSURE_CASE
let server,browser,page,groups=0
const mark=name=>{groups++;console.log(`PASS closure browser: ${name}`)}
const baseline=process.env.CLOSURE_BASELINE==='1'
const originals=new Map(baseline?['src/views/SpecConfigView.vue','src/views/CatalogWorkspaceView.vue','src/components/catalog-workspace/ProductTypeLedger.vue'].map(path=>[resolve(path).replaceAll('\\','/'),execFileSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'show',`HEAD:${path}`],{encoding:'utf8'})]):[])
try{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 for(const strict of [false,true]){
  server=await createServer({cacheDir:resolve(runtime,String(strict)),logLevel:'error',plugins:baseline?[{name:'closure-original-source',enforce:'pre',transform(code,id){if(!id.includes('?')&&originals.has(id))return originals.get(id)}}]:[],define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
  const {catalogClosureFixture}=await server.ssrLoadModule('/scripts/catalog-closure-fixture.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const fixture=catalogClosureFixture(),{data,a,b,c,v1,v2,bv}=fixture
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  async function open(path,actor='u-admin'){
   const context=await browser.newContext({viewport:{width:1550,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
   await context.addInitScript(({data,version,actor})=>{
    if(location.protocol!=='http:')return
    if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}))
    sessionStorage.setItem('iyge-rbac-simulated-user',actor)
    localStorage.setItem('iyge-spec-rail-fold','0');localStorage.setItem('iyge-spec-cat-fold','0')
    const set=Storage.prototype.setItem;window.__writes=0
    Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__quota)throw new DOMException('closure quota','QuotaExceededError');window.__writes++}return set.call(this,key,value)}
    window.__state=(selector,name)=>{let instance=document.querySelector(selector)?.__vueParentComponent;while(instance&&instance.type.__name!==name)instance=instance.parent;if(!instance)throw Error(`component ${name} missing`);return instance.setupState}
   },{data,version:DATA_VERSION,actor})
   page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(String(error)))
   await page.goto(base+path,{waitUntil:'networkidle'});await settle();return context
  }
  async function settle(){await page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})}
  const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const route=()=>page.evaluate(()=>window.__state('.content','AdminLayout').router.currentRoute.value.fullPath)
  const navigate=path=>page.evaluate(async path=>{const app=document.querySelector('#app').__vue_app__;await app.config.globalProperties.$router.push(path)},path)
  async function select(label,option,container=page){const field=container.locator('.el-select').filter({has:page.getByRole('combobox',{name:label,exact:true})});await field.locator('.el-select__wrapper').click();await page.getByRole('option',{name:option,exact:true}).click()}
  const workspace=()=>page.getByRole('dialog',{name:'模型适用关系',exact:true})
  const closeWorkspace=async()=>{await workspace().getByRole('button',{name:'关闭',exact:true}).last().click();await workspace().waitFor({state:'hidden'})}
  const state=()=>page.evaluate(()=>{const s=window.__state('.designer','SpecConfigView');return {model:s.templateId,requested:s.requestedVersionId,combo:s.comboVersionId,status:JSON.parse(JSON.stringify(s.comboStatus)),nodes:s.nodes.map(n=>({id:n.id,model:n.templateId}))}})
  async function showMaterials(){if(!await page.getByRole('checkbox',{name:'显示关联物料',exact:true}).isChecked())await page.locator('.structure-material-toggle .el-checkbox').click();await page.locator('[data-structure-materials]').waitFor()}
  async function assertContext(model,version){await settle();const s=await state();assert.equal(s.model,model);assert.equal(s.combo,version);assert(s.nodes.every(n=>n.model===model));if(version){assert.equal(s.status.versionId,version);assert(s.status.rows.length>0);assert(s.status.rows.every(row=>row.modelVersionId===version));assert(s.status.rows.every(row=>row.valueNodeIds.every(id=>id.startsWith(model))))}else{assert.equal(s.status.rows.length,0);assert.match(s.status.message,/发布模型/)}return s}

  if(!only||only==='versions'){
   let context=await open(`/specs?template=${a}&version=${v1.id}&mode=view`),before=await raw()
   await assertContext(a,v1.id)
   await page.locator('.model-line').filter({hasText:b}).click();const changed=await assertContext(b,bv.id)
   assert(changed.status.rows.some(row=>row.materials.some(card=>card.skuId==='closure-material'&&card.modelVersionId===bv.id)))
   assert.equal(new URL(page.url()).searchParams.has('version'),false);await showMaterials();assert.match(await page.locator('[data-structure-materials]').innerText(),/MAT-CLOSURE-B/)
   await page.locator(`.vue-flow__node[data-id="${b}-brand"]`).click();await page.getByRole('button',{name:'查看命名规则',exact:true}).click();assert.match(await page.getByRole('dialog',{name:'物料命名规则',exact:true}).innerText(),new RegExp(`${b}-V1`));await page.getByRole('dialog',{name:'物料命名规则',exact:true}).getByRole('button',{name:'关闭',exact:true}).click()
   await page.locator('[data-open-template-compatibility]').click();await workspace().waitFor();assert.equal(await workspace().count(),1);await closeWorkspace()
   assert.equal(await raw(),before);mark(`versions/${strict}: historical A V1 → left rail B uses owned combinations, actual MAT, B naming and B workspace without writes`)
   await navigate(`/specs?template=${a}&version=${v1.id}&mode=view`);await page.locator('.model-line').filter({hasText:c}).click();await assertContext(c,'');await showMaterials();assert.match(await page.locator('[data-structure-materials]').innerText(),/未发布|发布模型/);assert.doesNotMatch(await page.locator('[data-structure-materials]').innerText(),/MAT-CLOSURE-B/);mark(`versions/${strict}: A historical → unpublished C has no stale combo, material or version context`)
   await navigate(`/specs?template=${a}&version=${v1.id}&mode=view`);await showMaterials();await select('物料发布版本',v2.versionName);await assertContext(a,v2.id)
   await page.getByRole('button',{name:'进入当前草稿',exact:true}).click();await assertContext(a,v2.id);assert.equal(new URL(page.url()).searchParams.has('version'),false);assert.equal((await state()).requested,'')
   await showMaterials();await select('物料发布版本',v1.versionName);await assertContext(a,v1.id);await navigate(`/specs?template=${a}&unrelated=kept`);await assertContext(a,v1.id)
   mark(`versions/${strict}: A V1 → V2 → current draft; same-model manual selection survives unrelated query changes`)
   await navigate(`/specs?template=${a}&versionId=${v1.id}&mode=view&history=return`);await navigate(`/specs?template=${a}&versionId=${v1.id}&mode=view`);await assertContext(a,v1.id);await page.locator('.model-line').filter({hasText:b}).click();await assertContext(b,bv.id);assert.equal(new URL(page.url()).searchParams.has('versionId'),false)
   await page.goBack();await assertContext(a,v1.id);await page.reload({waitUntil:'networkidle'});await assertContext(a,v1.id)
   await page.getByRole('button',{name:'进入当前草稿',exact:true}).click();await assertContext(a,v2.id);assert.equal(new URL(page.url()).searchParams.has('versionId'),false)
   for(const invalid of ['missing-version',bv.id]){await navigate(`/specs?template=${a}&version=${invalid}&mode=view`);await page.locator('[data-model-invalid-version]').waitFor();const s=await state();assert.equal(s.combo,invalid);assert.equal(s.nodes.length,0);assert.equal(s.status.rows.length,0);assert.match(s.status.message,/找不到/)}
   assert.equal(await raw(),before);mark(`versions/${strict}: legacy versionId switch/back/refresh/draft and explicit missing/foreign versions preserve correct records and fail closed`)
   await context.close()
  }

  if(!only||only==='search'){
   const context=await open('/catalog?view=models'),before=await raw()
   const input=()=>page.locator('.query-toolbar .el-input input').first()
   const count=()=>page.locator('[data-catalog-category-count],.ledger-footer').first().innerText()
   for(const view of ['categories','types','models'])for(const alias of ['q','keyword','search']){
    const matching=view==='categories'?'手机':view==='types'?'r01-type':b
    const query=new URLSearchParams({view,[alias]:matching,scope:'current',sort:'name-desc',...(view==='categories'?{}:{categoryId:'c-phone'})})
    await navigate('/catalog?'+query);await input().waitFor();assert.equal(await input().inputValue(),matching)
    const filtered=await page.evaluate(()=>{const s=window.__state('[data-catalog-workspace]','CatalogWorkspaceView');return {q:s.prefs.keyword,scope:s.scopeMode,sort:s.prefs.sort,view:s.view}});assert.equal(filtered.q,matching)
    // Close an open detail only after checking that search sync preserves it.
    await input().fill('closure-no-matching-record',{force:true});await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='closure-no-matching-record')
    assert.equal(new URL(page.url()).searchParams.has('keyword'),false);assert.equal(new URL(page.url()).searchParams.has('search'),false)
    await input().fill('',{force:true});await page.waitForFunction(()=>new URL(location.href).searchParams.has('q')&&new URL(location.href).searchParams.get('q')==='')
    let current=new URL(page.url());assert.equal(current.searchParams.get('scope'),'current');assert.equal(current.searchParams.get('sort'),'name-desc');assert.equal(current.searchParams.get('view'),view);if(view!=='categories')assert.equal(current.searchParams.get('categoryId'),'c-phone')
    const expected=await page.evaluate(()=>window.__state('[data-catalog-workspace]','CatalogWorkspaceView').summary.metrics)
    if(view==='types'||view==='models'){
      // Details can cover the search box; the query-toolbar remains in the same workspace.
      const ledger=await page.evaluate(view=>{const sel=view==='types'?'[data-catalog-types]':'[data-catalog-models]',name=view==='types'?'ProductTypeLedger':'ModelLedger';return window.__state(sel,name).filtered.map(row=>row.id)},view)
      assert.equal(ledger.length,expected[view].ids.length)
    }
    await page.reload({waitUntil:'networkidle'});assert.equal(await input().inputValue(),'');assert.equal(await page.evaluate(()=>window.__state('[data-catalog-workspace]','CatalogWorkspaceView').prefs.keyword),'')
    await navigate('/catalog?'+query);assert.equal(await input().inputValue(),matching);await page.goBack();assert.equal(await input().inputValue(),'');await page.goForward();assert.equal(await input().inputValue(),matching)
    await input().fill('',{force:true});await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='');await page.waitForTimeout(230)
    const stable=page.url();await page.waitForTimeout(150);assert.equal(page.url(),stable)
    mark(`search/${strict}: ${view}/${alias} open/edit/clear/reload/back/forward, real list and query preferences`)
   }
   for(const alias of ['keyword','search']){await navigate(`/catalog?view=models&${alias}=foo&q=bar`);assert.equal(await input().inputValue(),'bar');await input().fill('',{force:true});await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='');await page.reload({waitUntil:'networkidle'});assert.equal(await input().inputValue(),'');assert.equal(new URL(page.url()).searchParams.has(alias),false)}
   await navigate(`/catalog?view=models&keyword=foo&q=bar&modelId=${b}&version=${bv.id}&categoryId=c-phone&scope=current&sort=name-desc`)
   // Dispatch the real input event behind the existing modal, solely to verify context preservation.
   await input().evaluate(element=>{element.value='';element.dispatchEvent(new Event('input',{bubbles:true}))})
   await page.waitForFunction(()=>new URL(location.href).searchParams.get('q')==='')
   assert.equal(new URL(page.url()).searchParams.get('modelId'),b);assert.equal(new URL(page.url()).searchParams.get('version'),bv.id)
   await page.locator('[data-catalog-model-detail]').getByRole('button',{name:'返回资料管理',exact:true}).click()
   // Three independent preferences and an isolated preview identity; no SKU saved views touched.
   for(const [view,word] of [['categories','分类独立'],['types','类型独立'],['models','模型独立']]){await page.locator(`[data-catalog-view="${view}"]`).click();await input().fill(word);await page.waitForFunction(word=>new URL(location.href).searchParams.get('q')===word,word)}
   for(const [view,word] of [['categories','分类独立'],['types','类型独立'],['models','模型独立']]){await page.locator(`[data-catalog-view="${view}"]`).click();assert.equal(await input().inputValue(),word)}
   await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();s.startPermissionPreview('closure-read')});await page.waitForTimeout(250);assert.equal(await input().inputValue(),'')
   await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();s.stopPermissionPreview()});await page.waitForTimeout(250);assert.equal(await input().inputValue(),'分类独立')
   assert.equal(await raw(),before);mark(`search/${strict}: mixed alias clear, independent view/identity preferences, no business or SPU/SKU view writes`)
   await context.close()
  }

  if(!only||only==='purpose'){
   let context=await open('/catalog?view=types&categoryId=c-phone'),before=JSON.parse(await raw()).data
   const typeForm=()=>page.locator('[data-catalog-type-form]'),modelForm=()=>page.locator('[data-catalog-model-form]')
   const created={}
   for(const [role,label] of [['host','主机／设备'],['accessory','配件'],['unknown','未指定'],['other','其他']]){
    await navigate('/catalog?view=types&categoryId=c-phone');await page.locator('[data-catalog-create-type]').click();await typeForm().getByRole('textbox',{name:'产品类型名称',exact:true}).fill(`全新用途-${role}`);await select('产品类型业务用途',label,typeForm())
    await typeForm().getByRole('button',{name:'保存',exact:true}).click();await typeForm().waitFor({state:'hidden'});await settle()
    const saved=JSON.parse(await raw()).data.productTypes.find(item=>item.name===`全新用途-${role}`);assert(saved);assert.equal(saved.catalogRole,role==='unknown'?undefined:role);created[role]={type:saved.id}
    await page.reload({waitUntil:'networkidle'});await page.locator(`[data-catalog-type="${saved.id}"]`).click();assert.match(await page.locator('[data-type-purpose]').innerText(),new RegExp(label));await page.locator('[data-catalog-type-detail] .el-dialog__headerbtn').click()
    await page.locator('[data-catalog-view="models"]').click();await page.locator('[data-catalog-create-model]').click();await select('模型产品类型',`${saved.name} · ${saved.id}`,modelForm());await modelForm().getByRole('textbox',{name:'模型名称',exact:true}).fill(`全新模型-${role}`);await modelForm().getByRole('button',{name:'创建模型',exact:true}).click();await page.locator('[data-catalog-edit-design]').click();await page.locator('.designer').waitFor()
    const modelId=new URL(page.url()).searchParams.get('template');assert(modelId);created[role].model=modelId
    // Actual designer commands: existing explicit host-model attribute → value → save/publish.
    await page.locator('.vue-flow__node').first().click();await page.locator('.node-ops').getByRole('button',{name:'添加属性',exact:true}).click()
    await select('选择已有属性',/^R01颜色/);await page.keyboard.press('Escape');await page.getByRole('button',{name:'确认添加（1项）',exact:true}).click()
    const attr=await page.evaluate(async id=>(await import('/src/stores/catalog.ts')).useCatalogStore().data.productSpecNodes.find(n=>n.templateId===id&&n.nodeType==='ATTRIBUTE').id,modelId)
    await page.locator(`.vue-flow__node[data-id="${attr}"]`).click();await page.locator('.node-ops').getByRole('button',{name:'添加属性值',exact:true}).click();await select('选择已有属性值','颜色1');await page.getByRole('button',{name:'确认添加（1项）',exact:true}).click()
    await page.getByRole('button',{name:'保存模型',exact:true}).click();await settle();await page.getByRole('button',{name:'发布模型',exact:true}).click();await settle()
    const versions=JSON.parse(await raw()).data.specModelVersions.filter(v=>v.templateId===modelId);assert.equal(versions.length,1);created[role].version=versions[0].id
    await page.reload({waitUntil:'networkidle'})
    await page.locator('[data-open-template-compatibility]').click()
    const compatibilityDialog=page.getByRole('dialog',{name:'模型适用关系',exact:true});await compatibilityDialog.waitFor()
    if(role==='host')await page.locator('[data-host-template-device]').waitFor()
    if(role==='accessory')assert.match(await compatibilityDialog.innerText(),/模板默认|适用设备|适用机型/)
    if(role==='unknown'||role==='other')assert.match(await compatibilityDialog.innerText(),/产品类型用途未指定或为其他/)
    await compatibilityDialog.getByRole('button',{name:'关闭',exact:true}).click();mark(`purpose/${strict}: new ${role} type → published model → independent compatibility direction`)
   }
   const now=JSON.parse(await raw()).data;for(const key of ['families','skus','compatibilities'])assert.deepEqual(now[key],before[key])
   // Existing dependent type rejects purpose changes in the real form, preserving all input and disk.
   await navigate('/catalog?view=types&categoryId=c-phone');await page.locator('[data-catalog-type="r01-type"]').click();await page.getByRole('button',{name:'编辑产品类型',exact:true}).click();await select('产品类型业务用途','配件',typeForm());const protectedRaw=await raw();await typeForm().getByRole('button',{name:'保存',exact:true}).click();await typeForm().getByRole('button',{name:'重试保存',exact:true}).waitFor();assert.equal(await raw(),protectedRaw);assert.match(await typeForm().innerText(),/已有 SKU|PLN|主机引用|配件/);await typeForm().getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'放弃输入',exact:true}).click()
   mark(`purpose/${strict}: protected role change refuses atomically in UI`)
   await context.close()
  }
  await server.close();server=undefined
 }
 assert.deepEqual(errors,[]);console.log(`Catalog closure browser: ${groups} groups`)
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(0,7500));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
