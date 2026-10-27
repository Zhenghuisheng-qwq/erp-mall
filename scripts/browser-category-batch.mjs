import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

const runtime=createTestRuntime('category-batch'),servers=[],errors=[]
let browser,groups=0
const mark=name=>{groups++;console.log('PASS '+name)}
const button=(scope,name)=>scope.getByRole('button',{name,exact:true})
try{
 browser=await chromium.launch({channel:'chrome',headless:true})
 for(const strict of [false,true]){
  const label=strict?'strict':'default',server=await createServer({cacheDir:`${runtime}/${label}`,logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,hmr:false,watch:null,ws:false}});servers.push(server)
  const {categoryWorkspaceFixture}=await server.ssrLoadModule('/scripts/category-workspace-fixture.ts'),{normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const data=normalizeStored({version:DATA_VERSION,data:categoryWorkspaceFixture()})
  const add=(id,name,parentId,sort)=>data.categories.push({id,name,parentId,sort,enabled:true})
  add('batch-deep','来源三级','r4-leaf',1);add('batch-c','另一棵来源',null,90);add('batch-c-child','另一来源子类','batch-c',1)
  add('batch-destination-root','目标上层',null,91);add('batch-destination-middle','目标中层','batch-destination-root',1)
  data.categories.find(item=>item.id==='r4-b').parentId='batch-destination-middle'
  for(let i=0;i<432;i++)add(`batch-wide-${i}`,`宽分支样例 ${String(i).padStart(3,'0')}`,i%8===0?null:`batch-wide-${i-i%8}`,i+100)
  data.rbac.roles.push({id:'batch-browser-reader',code:'batch-browser-reader',name:'分类只读',description:'isolated browser fixture',enabled:true,permissionCodes:['product:category:read','system:guide:read']})
  data.users.push({id:'batch-browser-reader',username:'batch-browser-reader',displayName:'分类只读',role:'operator',roleIds:['batch-browser-reader'],enabled:true})
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  const context=async(user='u-admin')=>{
   const ctx=await browser.newContext({viewport:{width:1600,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
   await ctx.addInitScript(({data,version,user})=>{if(location.protocol!=='http:')return;const native=Storage.prototype.setItem;if(!localStorage.getItem('iyge-v2-mock-db'))native.call(localStorage,'iyge-v2-mock-db',JSON.stringify({version,data}));native.call(sessionStorage,'iyge-rbac-simulated-user',user);window.__batchWrites=0;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__batchFailWrite)throw new DOMException('整批分类配额失败','QuotaExceededError');window.__batchWrites++}return native.call(this,key,value)}},{data,version:DATA_VERSION,user})
   const page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(`${label}: ${String(error)}`));await page.goto(base+'/categories?mode=maintain',{waitUntil:'networkidle'});await page.evaluate(async()=>await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence());return {ctx,page}
  }
  let {ctx,page}=await context()
  const left=()=>page.locator('[data-category-panel="panel-1"]'),right=()=>page.locator('[data-category-panel]').nth(1),row=(panel,id)=>panel.locator(`.cat-row[data-id="${id}"]`),search=async value=>left().getByPlaceholder('搜索并定位分类').fill(value)
  const stage=async id=>button(row(left(),id),'加入待移动').click(),check=async id=>row(left(),id).locator('.el-checkbox').click(),choose=async id=>{await row(left(),id).focus();await row(left(),id).press('Enter')}
  const roots=()=>right().locator('.cat-row.is-source').evaluateAll(rows=>rows.map(row=>row.dataset.id)),pending=()=>right().locator('.cat-row').evaluateAll(rows=>rows.map(row=>row.dataset.id)),target=()=>page.locator('[data-category-move-confirm]>strong').innerText(),confirm=()=>page.locator('[data-category-confirm-move]')
  const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data))),disk=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db')),writes=()=>page.evaluate(()=>window.__batchWrites)
  const state=async()=>({url:page.url(),roots:await roots(),pending:await pending(),target:await target(),search:await left().getByPlaceholder('搜索并定位分类').inputValue(),checked:await left().locator('.el-checkbox input').evaluateAll(inputs=>inputs.filter(input=>input.checked).map(input=>input.closest('.cat-row').dataset.id))})
  await page.getByText('编辑模式',{exact:true}).click();await button(left(),'展开全部').click()
  const baseline=await read(),baselineDisk=await disk(),baselineWrites=await writes()
  await search('移动子树');await stage('r4-source');assert.deepEqual(await roots(),['r4-source']);assert.deepEqual(await pending(),['r4-source','r4-leaf','batch-deep']);assert.match(await target(),/请在左侧选择/)
  await search('来源同级');await stage('r4-peer');await search('另一棵来源');await check('batch-c');await page.locator('[data-category-add-checked]').click();assert.deepEqual(await roots(),['r4-source','r4-peer','batch-c'])
  await search('移动子树');await stage('r4-source');assert.deepEqual(await roots(),['r4-source','r4-peer','batch-c']);await button(row(right(),'r4-peer'),'移除待移动来源同级').click();assert.deepEqual(await roots(),['r4-source','batch-c'])
  await search('子树末级');await stage('r4-leaf');assert.deepEqual(await roots(),['r4-source','batch-c']);assert.match(await page.locator('[data-category-merged]').innerText(),/子树末级.*移动子树/);assert.match(await page.locator('[data-category-source]').innerText(),/待移动 2 项.*包含 3 个子分类/s)
  await search('');await button(left(),'展开全部').click();await choose('r4-b');const validTarget=await target();assert.match(validTarget,/目标上层 \/ 目标中层 \/ 整理目标/);assert(await confirm().isEnabled())
  await stage('r4-b');assert.equal(await target(),validTarget);assert(await confirm().isDisabled());assert.deepEqual(await roots(),['r4-source','batch-c','r4-b']);await button(row(right(),'r4-b'),'移除待移动整理目标').click();assert.equal(await target(),validTarget);assert(await confirm().isEnabled());assert.deepEqual(await roots(),['r4-source','batch-c'])
  await check('r4-peer');await button(row(left(),'r4-a'),'收起整理来源').click();assert.equal(await target(),validTarget);assert.deepEqual(await roots(),['r4-source','batch-c']);await button(row(left(),'r4-a'),'展开整理来源').click()
  await search('宽分支样例 20');assert((await left().locator('.cat-row').count())>0);assert.equal(await target(),validTarget);assert.deepEqual(await roots(),['r4-source','batch-c']);await search('');assert.deepEqual(await read(),baseline);assert.equal(await disk(),baselineDisk);assert.equal(await writes(),baselineWrites)
  mark(`${label}: ${data.categories.length} categories; search/expand/check/append/remove/deduplicate keep separate roles, ancestor merge preserves full forest and all staging is write-free`)

  await search('整理目标');const beforeHelp=await state();await button(page,'页面功能').click();const help=page.getByRole('dialog',{name:'页面功能',exact:true});await help.locator('[data-guide-block="functions"]').waitFor();await help.locator('.guide-related-actions button').first().click();await button(help,'关闭说明').click();await help.waitFor({state:'hidden'});assert.deepEqual(await state(),beforeHelp);assert.deepEqual(await read(),baseline);assert.equal(await disk(),baselineDisk)
  await search('');await button(left(),'展开全部').click();for(const id of ['r4-source','batch-deep','r4-typed']){await choose(id);assert(await confirm().isDisabled());assert.equal(await writes(),baselineWrites);assert.deepEqual(await read(),baseline)}
  await choose('r4-b');await search('整理目标');const beforeFailure=await state();await page.evaluate(()=>window.__batchFailWrite=true);await confirm().click();await page.getByText('重试移动',{exact:true}).waitFor();assert(await confirm().isEnabled());assert.deepEqual(await state(),beforeFailure);assert.deepEqual(await read(),baseline);assert.equal(await disk(),baselineDisk);assert.equal(await writes(),baselineWrites)
  await page.evaluate(()=>window.__batchFailWrite=false);await confirm().evaluate(element=>{element.click();element.click()});await page.locator('[data-category-source]').waitFor({state:'hidden'});assert.equal(await writes(),baselineWrites+1)
  const first=await read(),firstRoots=['r4-source','batch-c'];for(const id of firstRoots)assert.equal(first.categories.find(item=>item.id===id).parentId,'r4-b')
  for(const id of ['r4-leaf','batch-deep','batch-c-child'])assert.deepEqual(first.categories.find(item=>item.id===id),baseline.categories.find(item=>item.id===id))
  for(const key of Object.keys(baseline).filter(key=>key!=='categories'))assert.deepEqual(first[key],baseline[key],key)
  const siblings=d=>d.categories.filter(item=>item.parentId==='r4-b').sort((a,b)=>a.sort-b.sort).map(item=>item.id),oldSiblings=siblings(baseline)
  assert.deepEqual(siblings(first),[...oldSiblings,...firstRoots]);assert(await row(left(),'r4-source').isVisible());assert(await row(left(),'r4-source').evaluate(element=>element.classList.contains('is-active')));assert.equal(await left().getByPlaceholder('搜索并定位分类').inputValue(),'')
  mark(`${label}: page-help switching preserves every pending context; self/descendant/typed targets reject; quota failure keeps memory/disk/sources/target/search, retry commits entire forest once and locates saved result`)

  await stage('r4-before');await stage('r4-peer');await choose('r4-b');await confirm().click();await page.locator('[data-category-source]').waitFor({state:'hidden'});const second=await read();assert.deepEqual(siblings(second),[...oldSiblings,...firstRoots,'r4-peer']);assert.equal(await writes(),baselineWrites+2)
  await stage('r4-source');await choose('r4-b');assert(await confirm().isDisabled());assert.match(await confirm().getAttribute('title'),/无需变化/);await page.locator('[data-category-clear-pending]').click();assert.equal(await writes(),baselineWrites+2)
  await stage('r4-peer');await choose('r4-a');const beforeCancel=await read(),cancelDisk=await disk();await button(page.locator('[data-category-move-confirm]'),'取消移动').click();assert.deepEqual(await read(),beforeCancel);assert.equal(await disk(),cancelDisk)
  await stage('r4-peer');await page.locator('[data-category-root-target]').click();assert.match(await target(),/顶级分类/);await confirm().click();await page.locator('[data-category-source]').waitFor({state:'hidden'});assert.equal((await read()).categories.find(item=>item.id==='r4-peer').parentId,null);assert.equal(await writes(),baselineWrites+3)
  await stage('batch-c');await button(right(),'关闭待移动分类').click();assert.equal(await page.locator('[data-category-panel]').count(),1);assert.equal(await writes(),baselineWrites+3);await stage('batch-c');assert.deepEqual(await roots(),['batch-c']);await page.locator('[data-category-clear-pending]').click()
  const saved=await read();await page.reload({waitUntil:'networkidle'});assert.deepEqual(await read(),saved);await ctx.close()
  mark(`${label}: consecutive batches, mixed unchanged/new sources, stable sibling order, no-op zero write, cancel/clear/remove/re-add, root destination and refresh all preserve identities and persisted results`)

  if(strict){({ctx,page}=await context('batch-browser-reader'));assert.equal(await button(page,'加入已选').count(),0);assert.equal(await button(page,'加入待移动').count(),0);const denied=await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore(),memory=JSON.stringify(s.data),raw=localStorage.getItem('iyge-v2-mock-db');let blocked=false;try{blocked=!(await s.commitCategoryMoves(['r4-source','batch-c'],'r4-b')).ok}catch{blocked=true}await s.waitForPersistence();return blocked&&memory===JSON.stringify(s.data)&&raw===localStorage.getItem('iyge-v2-mock-db')});assert(denied);await ctx.close();mark('strict: read-only UI and actual batch Store entry both deny mutation without partial writes')}
 }
 assert.deepEqual(errors,[]);console.log(`PASS category batch browser: ${groups} groups; Chrome ${browser.version()}; page errors 0`)
}finally{await browser?.close();for(const server of servers)await server.close();removeTestRuntime(runtime)}
