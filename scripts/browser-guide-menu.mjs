import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

const runtime=createTestRuntime('guide-menu'),servers=[],contexts=[],errors=[];let browser,page,groups=0
try{
 browser=await chromium.launch({channel:'chrome',headless:true})
 for(const strict of [false,true]){
  const server=await createServer({cacheDir:`${runtime}/${strict?'strict':'default'}`,logLevel:'silent',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}});servers.push(server)
  const {createSeed}=await server.ssrLoadModule('/src/domain/seed.ts'),{ensureRbac}=await server.ssrLoadModule('/src/domain/rbac.ts'),{defaultMenuNodes}=await server.ssrLoadModule('/src/domain/menuConfig.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const data=createSeed();ensureRbac(data)
  for(const [id,codes]of [['guide-reader',['system:guide:read']],['guide-legacy-reader',['system:guide:read','system:guide:update']],['no-guide',['product:category:read']]]){data.rbac.roles.push({id,code:id,name:id,description:'independent menu browser fixture',enabled:true,permissionCodes:codes});data.users.push({id,username:id,displayName:id,role:'operator',enabled:true,roleIds:[id]})}
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  const context=async(user='u-admin',legacy=false,custom='',hidden=false)=>{
   const nodes=defaultMenuNodes().filter(n=>n.id!=='guide').map(n=>n.route==='/guide'?{...n,parentId:'product',title:custom||'业务指南',hidden,permissionCode:'system:guide:read'}:n)
   if(legacy){nodes.find(n=>n.route==='/skus').title='保留的规格管理';nodes.find(n=>n.route==='/brands').hidden=true}
   const ctx=await browser.newContext({viewport:{width:1366,height:950},locale:'zh-CN',reducedMotion:'reduce'});contexts.push(ctx)
   await ctx.addInitScript(({data,version,user,nodes,legacy})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db')){localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));localStorage.setItem('iyge-v2-theme','light');if(legacy)localStorage.setItem('iyge-menu-config',JSON.stringify({version:1,nodes}))}sessionStorage.setItem('iyge-rbac-simulated-user',user)},{data,version:DATA_VERSION,user,nodes,legacy})
   page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));await page.goto(base+(strict&&user.includes('reader')?'/guide':'/categories'),{waitUntil:'networkidle'});await page.evaluate(async()=>(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence());return ctx
  }
  const go=async path=>{await page.goto(base+path,{waitUntil:'networkidle'})},guide=()=>page.locator('.rail-scroll [data-group="guide"]'),fly=()=>page.locator('#nav-flyout')
  const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const layout=async name=>{await page.getByRole('button',{name:'切换导航布局',exact:true}).click();await page.getByRole('menuitemradio',{name,exact:true}).click()}
  let ctx=await context();const baseline=await raw();assert.equal(await guide().getAttribute('href'),'/guide');assert.equal(await guide().getAttribute('aria-label'),'系统说明');await guide().hover();assert.equal(await fly().count(),0);await guide().click();await page.waitForURL('**/guide');assert.equal(await fly().count(),0);assert.equal(await guide().getAttribute('aria-current'),'page');assert.equal(await raw(),baseline);groups++
  await go('/categories');await page.locator('[data-group="product"]').hover();assert.equal(await fly().locator('a[href="/guide"]').count(),0);await page.locator('[data-nav-pin]').click();const pref=await page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-nav-layout')));assert(pref.pinned);await guide().click();await page.waitForURL('**/guide');assert.equal(await fly().count(),0);assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-nav-layout')))).pinned);await page.locator('[data-nav-fold]').click();assert.equal(await guide().getAttribute('href'),'/guide');await page.locator('[data-nav-fold]').click();await page.locator('[data-group="product"]').hover();assert(await fly().isVisible());await guide().click();await page.waitForURL('**/guide');assert.equal(await fly().count(),0);groups++
  await layout('单栏');const single=page.locator('.sider a[href="/guide"]');await single.waitFor();assert.equal(await single.locator('xpath=ancestor::li[contains(@class,"el-sub-menu")]').count(),0);await go('/categories');await page.locator('.sider a[href="/guide"]').click();await page.waitForURL('**/guide');await page.locator('[data-nav-fold]').click();const compact=page.locator('.compact-single a[data-group="guide"]');assert.equal(await compact.getAttribute('href'),'/guide');await compact.focus();await page.keyboard.press('Enter');await page.waitForURL('**/guide');await layout('双栏');await go('/categories');await guide().focus();await page.keyboard.press('ArrowRight');assert.match(page.url(),/\/categories$/);await page.keyboard.press('Enter');await page.waitForURL('**/guide');assert.equal(await raw(),baseline);groups++;await ctx.close()
  ctx=await context('u-admin',true);const migrated=await page.evaluate(()=>localStorage.getItem('iyge-menu-config'));const saved=JSON.parse(migrated);assert.equal(saved.nodes.find(n=>n.route==='/guide').parentId,'guide');assert.equal(saved.nodes.find(n=>n.route==='/guide').permissionCode,'system:guide:read');assert.equal(saved.nodes.find(n=>n.route==='/skus').title,'保留的规格管理');assert(saved.nodes.find(n=>n.route==='/brands').hidden);await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>localStorage.getItem('iyge-menu-config')),migrated);assert.equal(await guide().count(),1);groups++;await ctx.close()
  ctx=await context('u-admin',true,'培训操作说明');assert.equal(await guide().getAttribute('aria-label'),'培训操作说明');await ctx.close();ctx=await context('u-admin',true,'保留隐藏的说明',true);assert.equal(await guide().count(),0);await ctx.close();groups++
  for(const user of ['guide-reader','guide-legacy-reader']){ctx=await context(user,true);assert.equal(await guide().count(),1);assert.equal(new URL(page.url()).pathname,strict?'/guide':'/categories');await guide().click();await page.waitForURL('**/guide');assert.equal(await fly().count(),0);if(strict){assert.equal(await page.locator('.rail-scroll [data-group]').count(),1);const powers=await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();return[s.can('product:category:update'),s.canRoute({path:'/categories'}),s.can('product:spu:update')]});assert.deepEqual(powers,[false,false,false]);await go('/categories');await page.waitForURL('**/forbidden?**')}await ctx.close();groups++}
  ctx=await context('no-guide');if(strict){assert.equal(await guide().count(),0);await go('/guide');await page.waitForURL('**/forbidden?**')}else assert.equal(await guide().count(),1);await ctx.close();groups++
  ctx=await context();const articleData=await raw()
  for(const state of [{layout:'dual',pinned:false,collapsed:false},{layout:'dual',pinned:false,collapsed:true},{layout:'dual',pinned:true,collapsed:false},{layout:'dual',pinned:true,collapsed:true},{layout:'single',pinned:false,collapsed:false},{layout:'single',pinned:false,collapsed:true}]){
   await page.evaluate(state=>localStorage.setItem('iyge-nav-layout',JSON.stringify({...state,openeds:['product']})),state)
   await go('/guide')
   const activeGuide=()=>page.locator(state.layout==='single'&&!state.collapsed?'.sider a[href="/guide"]':state.layout==='single'?'.compact-single a[data-group="guide"]':'.rail-scroll [data-group="guide"]')
   const assertPlace=async()=>{assert.equal(await activeGuide().getAttribute('aria-current'),'page');assert.equal(await fly().count(),0);assert.equal(await page.locator('.rail-scroll [data-group="product"].is-current').count(),0);const pref=await page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-nav-layout')));assert.equal(pref.pinned,state.pinned);assert.equal(pref.layout,state.layout);assert.equal(pref.collapsed,state.collapsed);assert.equal(await raw(),articleData)}
   await assertPlace()
   await page.locator('[data-guide-page="page-categories"]').click();await page.waitForURL('**/guide/articles/manual-categories');await assertPlace()
   await page.locator('[data-guide-page="page-product-types"]').click();await page.waitForURL('**/guide/articles/manual-product-types');await assertPlace()
   await page.reload({waitUntil:'networkidle'});await assertPlace()
   await page.goBack({waitUntil:'networkidle'});await page.waitForURL('**/guide/articles/manual-categories');await assertPlace()
   await page.goForward({waitUntil:'networkidle'});await page.waitForURL('**/guide/articles/manual-product-types');await assertPlace();groups++
  }
  await ctx.close()
 }
 assert.deepEqual(errors,[]);console.log(`PASS standalone system explanation Chrome (${groups} default/strict groups)`)
}finally{for(const ctx of contexts)await ctx.close().catch(()=>{});await browser?.close();for(const server of servers)await server.close();removeTestRuntime(runtime)}
