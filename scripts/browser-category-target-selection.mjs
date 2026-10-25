import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('category-target-selection'),servers=[],errors=[]
let browser,groups=0
const mark=name=>{groups++;console.log('PASS '+name)}
const button=(scope,name)=>scope.getByRole('button',{name,exact:true})
try{
 browser=await chromium.launch({channel:'chrome',headless:true})
 for(const strict of [false,true]){
  const label=strict?'strict':'default',server=await createServer({cacheDir:`${runtime}/${label}`,logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});servers.push(server)
  const {categoryWorkspaceFixture}=await server.ssrLoadModule('/scripts/category-workspace-fixture.ts'),{normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const data=normalizeStored({version:DATA_VERSION,data:categoryWorkspaceFixture()})
  for(const [id,name,sort]of [['race-a','竞态目标 A',300],['race-b','竞态目标 B',301],['race-c','竞态目标 C',302]])data.categories.push({id,name,parentId:null,sort,enabled:true})
  for(let i=0;i<8;i++){data.categories.push({id:`race-source-${i}`,name:`竞态来源 ${i}`,parentId:null,sort:310+i,enabled:true},{id:`race-child-${i}`,name:`竞态子级 ${i}`,parentId:`race-source-${i}`,sort:1,enabled:true})}
  data.rbac.roles.push({id:'race-editor',code:'race-editor',name:'目标选择编辑',description:'isolated test',enabled:true,permissionCodes:['product:category:read','product:category:update','system:guide:read']});data.users.push({id:'race-user',username:'race-user',displayName:'目标选择编辑',role:'operator',roleIds:['race-editor'],enabled:true})
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`,ctx=await browser.newContext({viewport:{width:1600,height:1050},locale:'zh-CN',reducedMotion:'reduce'})
  await ctx.addInitScript(({data,version})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user','race-user');const original=Storage.prototype.setItem;window.__targetWrites=0;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db')window.__targetWrites++;return original.call(this,key,value)}},{data,version:DATA_VERSION})
  const page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(`${label}: ${String(error)}`));await page.goto(base+'/categories',{waitUntil:'networkidle'});await page.evaluate(async()=>await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence());assert.equal(await page.evaluate(async()=>(await import('/src/stores/catalog.ts')).useCatalogStore().rbacEnforced),strict)
  const left=()=>page.locator('[data-category-panel="panel-1"]'),right=()=>page.locator('[data-category-panel]').nth(1),row=(panel,id)=>panel.locator(`.cat-row[data-id="${id}"]`),name=id=>row(left(),id).locator('.cat-name'),confirm=()=>page.locator('[data-category-confirm-move]'),target=()=>page.locator('[data-category-move-confirm]>strong').innerText()
  const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data))),disk=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db')),parent=async id=>(await read()).categories.find(item=>item.id===id).parentId
  const stage=async i=>button(row(left(),`race-source-${i}`),'加入待移动').click(),keyboard=async id=>{await row(left(),id).focus();await row(left(),id).press('Enter')},choose=async id=>name(id).click()
  const assertSelected=async(id,text)=>{assert(await row(left(),id).evaluate(element=>element.classList.contains('is-active')),'visible row must highlight current target');assert.match(await target(),new RegExp(text));assert(await confirm().isEnabled(),'selected legal target is immediately submittable')}
  const submit=async(i,id)=>{await confirm().click();await page.locator('[data-category-source]').waitFor({state:'hidden'});assert.equal(await parent(`race-source-${i}`),id);assert.equal(await parent(`race-child-${i}`),`race-source-${i}`)}
  await page.getByText('编辑模式',{exact:true}).click();await button(left(),'展开全部').click();const baseline=await read()
  await stage(0);await keyboard('race-a');await choose('race-b');const observed={highlight:await row(left(),'race-b').evaluate(element=>element.classList.contains('is-active')),confirmation:await target()};await submit(0,'race-b');assert(observed.highlight);assert.match(observed.confirmation,/竞态目标 B/)
  mark(`${label}: A→B name click then immediate confirm persists B; highlight, confirmation and submitted target agree without sleeps`)
  await stage(1);assert(await confirm().isDisabled());await choose('race-b');await assertSelected('race-b','竞态目标 B');await submit(1,'race-b')
  mark(`${label}: first name selection is immediately enabled, visible and committed to its exact target`)
  await stage(2);await choose('race-a');await choose('race-b');await choose('race-c');await assertSelected('race-c','竞态目标 C');await submit(2,'race-c');await stage(3);await choose('race-c');await choose('race-a');await choose('race-b');await assertSelected('race-b','竞态目标 B');await submit(3,'race-b')
  mark(`${label}: consecutive rapid A/B/C selections and repeated batches always commit the last effective selection`)
  await stage(4);await keyboard('race-a');const unchanged=await read(),raw=await disk(),url=page.url();await name('race-b').dblclick();const input=left().getByRole('textbox',{name:'分类新名称',exact:true});await input.waitFor();await assertSelected('race-a','竞态目标 A');assert.equal(await input.evaluate(element=>document.activeElement===element&&element.selectionStart===0&&element.selectionEnd===element.value.length),true);await input.fill('目标改名未保存');await button(page,'页面功能').click();const help=page.getByRole('dialog',{name:'页面功能',exact:true});await button(help,'关闭说明').click();await help.waitFor({state:'hidden'});assert.equal(await input.inputValue(),'目标改名未保存');assert.equal(page.url(),url);await assertSelected('race-a','竞态目标 A');assert.deepEqual(await read(),unchanged);assert.equal(await disk(),raw);await input.press('Escape');await submit(4,'race-a')
  mark(`${label}: real double-click restores original target/highlight, opens selected rename input, and help/Escape retain unsaved context without business writes`)
  await stage(5);await name('race-b').dblclick();await input.waitFor();assert.match(await target(),/请在左侧选择目标父级/);assert(await confirm().isDisabled());assert.equal(await left().locator('.cat-row.is-active').count(),0);await input.press('Escape');await choose('race-b');await assertSelected('race-b','竞态目标 B');await submit(5,'race-b')
  mark(`${label}: initial double-click keeps an undefined target undefined; later ordinary selection still commits immediately`)
  await stage(6);await keyboard('race-a');await choose('race-b');await row(left(),'race-source-6').locator('.el-checkbox').click();await keyboard('race-c');await name('race-b').dblclick();await input.waitFor();await assertSelected('race-c','竞态目标 C');await input.press('Escape');await choose('race-b');await button(page,'页面功能').click();await button(page.getByRole('dialog',{name:'页面功能',exact:true}),'关闭说明').click();await assertSelected('race-b','竞态目标 B');await submit(6,'race-b')
  mark(`${label}: explicit checkbox/keyboard/outside help actions settle selection intent; old clicks cannot roll back a later target or cancel B before confirmation`)
  await stage(7);await keyboard('race-a');await choose('r4-typed');assert.match(await target(),/关联类型的分类/);assert(await confirm().isDisabled());assert(await row(left(),'r4-typed').evaluate(element=>element.classList.contains('is-active')));await choose('race-c');await row(right(),'race-source-7').locator('.cat-name').dblclick();const pendingInput=right().getByRole('textbox',{name:'分类新名称',exact:true});await pendingInput.waitFor();await assertSelected('race-c','竞态目标 C');await pendingInput.press('Escape');await submit(7,'race-c')
  const final=await read();for(const key of Object.keys(baseline).filter(key=>key!=='categories'))assert.deepEqual(final[key],baseline[key],key);await ctx.close()
  mark(`${label}: invalid last target is blocked instead of falling back, right-side rename preserves left target, and all non-category data stays unchanged`)
 }
 assert.deepEqual(errors,[]);console.log(`PASS category target selection: ${groups} groups; Chrome ${browser.version()}; no sleeps or artifacts`)
}finally{await browser?.close();for(const server of servers)await server.close();removeTestRuntime(runtime)}
