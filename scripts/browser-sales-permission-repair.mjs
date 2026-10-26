import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

const runtime=createTestRuntime('sales-permission-repair'),errors=[]
let browser,server,page,groups=0
const mark=name=>{groups++;console.log(`PASS ${name}`)}
try {
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 for(const strict of [false,true]){
  server=await createServer({cacheDir:resolve(runtime,String(strict)),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
  const {createSalesConfigurationFixture}=await server.ssrLoadModule('/scripts/sales-configuration-fixtures.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const {data,phoneBinding}=createSalesConfigurationFixture()
  const draftBinding={...structuredClone(phoneBinding),id:'permission-draft',name:'仅草稿绑定',enabled:false}
  data.salesOptionBindings.push(draftBinding)
  for(const [id,publish] of [['binding-editor',false],['binding-publisher',true]]){
   data.rbac.roles.push({id,code:id,name:id,enabled:true,description:'isolated test',permissionCodes:['product:sales-config:read','product:sales-config:update',...(publish?['product:sales-config:publish']:[])]})
   data.users.push({id,username:id,displayName:id,enabled:true,role:'operator',roleIds:[id]})
  }
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  async function open(actor){
   const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
   await context.addInitScript(({data,version,actor})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user',actor)},{data,version:DATA_VERSION,actor})
   page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(String(error)));await page.goto(`${base}/sales-configurations`,{waitUntil:'networkidle'})
   await page.evaluate(async()=>{window.__store=(await import('/src/stores/catalog.ts')).useCatalogStore();await window.__store.waitForPersistence()});await page.getByRole('tab',{name:'范围绑定',exact:true}).click();return context
  }
  const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__store.data)))
  const dialog=()=>page.locator('[data-sales-binding-dialog]')
  async function openBinding(name){await page.getByRole('button',{name,exact:true}).click();await dialog().waitFor()}
  let context=await open('binding-editor');const before=await raw()
  if(strict)assert(await page.locator('[data-sales-binding-table] .el-table__body tr').filter({has:page.getByRole('button',{name:phoneBinding.name,exact:true})}).getByRole('button',{name:'停用',exact:true}).isDisabled())
  await openBinding(phoneBinding.name)
  let inactive=page.locator('[data-sales-save-binding-draft]')
  if(strict){
   assert(await inactive.isDisabled());assert.equal(await page.locator('[data-sales-apply-binding]').count(),0)
   const refusal=await page.evaluate(async()=>{const s=window.__store,draft=JSON.parse(JSON.stringify(s.data.salesOptionBindings.find(item=>item.id==='sales-binding-phone')));draft.enabled=false;const {previewSalesBinding}=await import('/src/domain/salesConfiguration.ts');try{return await s.saveSalesOptionBinding({draft,expectedRevision:draft.revision,expectedBasis:previewSalesBinding(s.data,draft).stamp,requestId:'browser-editor-stop'})}catch(error){return {ok:false,message:String(error)}}})
   assert.equal(refusal.ok,false);assert.match(refusal.message,/publish|发布/);assert.equal(await raw(),before)
   await dialog().getByRole('button',{name:'关闭',exact:true}).click()
   mark('permissions/strict: editor cannot stop a live binding in UI or direct Store; whole catalog stays unchanged')
  }else{
   assert(await inactive.isEnabled());await inactive.click();await dialog().waitFor({state:'hidden'});assert.equal((await read()).salesOptionBindings.find(item=>item.id===phoneBinding.id).enabled,false)
   mark('permissions/default: ordinary administrator mode still stops a live binding through the real dialog')
  }
  await openBinding(draftBinding.name);await page.getByRole('textbox',{name:'绑定名称',exact:true}).fill('仅草稿合法编辑');assert(await inactive.isEnabled());await inactive.click();await dialog().waitFor({state:'hidden'})
  const edited=(await read()).salesOptionBindings.find(item=>item.id===draftBinding.id);assert.equal(edited.name,'仅草稿合法编辑');assert.equal(edited.enabled,false)
  mark(`permissions/${strict}: inactive binding remains editable under the existing update permission`);await context.close()
  context=await open('binding-publisher');inactive=page.locator('[data-sales-save-binding-draft]');await openBinding(phoneBinding.name);await inactive.click();await dialog().waitFor({state:'hidden'});assert.equal((await read()).salesOptionBindings.find(item=>item.id===phoneBinding.id).enabled,false)
  await openBinding(phoneBinding.name);await page.locator('[data-sales-apply-binding]').click();await page.getByRole('button',{name:'启用此绑定',exact:true}).click();await dialog().waitFor({state:'hidden'});assert.equal((await read()).salesOptionBindings.find(item=>item.id===phoneBinding.id).enabled,true)
  mark(`permissions/${strict}: publisher can explicitly stop and reapply the same published binding after range confirmation`)
  await context.close();await server.close();server=undefined
 }
 assert.deepEqual(errors,[]);console.log(`PASS sales permission browser ${groups} groups; no screenshots or persistent artifacts`)
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText().catch(()=>'' )).slice(0,4500));process.exitCode=1}
finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
