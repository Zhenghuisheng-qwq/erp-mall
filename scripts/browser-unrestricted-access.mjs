import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
const output=resolve(process.env.UNRESTRICTED_BROWSER_OUTPUT_DIR || 'work/unrestricted-access/browser');mkdirSync(output,{recursive:true})
const server=await createServer({cacheDir:resolve(output,'cache'),server:{host:'127.0.0.1',port:0,watch:null,hmr:false}})
let browser,page;const checks=[],errors=[]
try{
 const {createSeed}=await server.ssrLoadModule('/src/domain/seed.ts')
 const {normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts')
 const {DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
 const data=normalizeStored({version:DATA_VERSION,data:createSeed()})
 const stale={...data.rbac.permissions.find(p=>p.code==='product:sku:update'),code:'product:benefit:delete',action:'delete',name:'删除权益包（历史配置）'}
 data.rbac.permissions.push(stale);data.rbac.roles.find(r=>r.superAdmin).permissionCodes.push(stale.code)
 data.rbac.roles.find(r=>r.code==='operator').enabled=false
 const preserved=JSON.stringify(data.rbac),business=JSON.stringify({families:data.families,skus:data.skus,versions:data.specModelVersions,planning:data.planningRecords})
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1366,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
 await ctx.addInitScript(({data,version})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user','removed-old-user');localStorage.setItem('iyge-v2-theme','light')},{data,version:DATA_VERSION})
 page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)))
 const mark=name=>{checks.push(name);console.log('PASS '+name)}
 await page.goto(base+'/spus',{waitUntil:'networkidle'})
 assert.equal(await page.locator('[data-storage-recovery]').count(),0)
 assert.equal(await page.getByRole('combobox',{name:'模拟用户'}).count(),0)
 assert(await page.locator('.topbar .el-tag').filter({hasText:'超级管理员'}).isVisible())
 const status=await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();return{enforced:s.rbacEnforced,admin:s.isAdmin,system:s.can('system:role:grant'),model:s.can('product:model:publish'),spu:s.can('product:spu:update'),raw:JSON.stringify(s.data.rbac),business:JSON.stringify({families:s.data.families,skus:s.data.skus,versions:s.data.specModelVersions,planning:s.data.planningRecords})}})
 assert.equal(status.enforced,false);assert(status.admin&&status.system&&status.model&&status.spu);assert.equal(status.raw,preserved);assert.equal(status.business,business)
 await page.screenshot({path:resolve(output,'recovered-super-admin.png'),fullPage:true});mark('obsolete permission and removed old identity open normally with uniform administrator; original grants/business preserved')
 for(const path of ['/models','/roles','/permissions','/users','/skus','/spus']){await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,path);assert.equal(await page.locator('[data-storage-recovery]').count(),0);if(['/roles','/permissions','/users'].includes(path)){assert(await page.locator('[data-rbac-mode-notice]').isVisible());await page.screenshot({path:resolve(output,path.slice(1)+'-default-mode-notice.png'),fullPage:true})}}
 assert(await page.getByRole('button',{name:'新建 SPU',exact:true}).isEnabled());await page.reload({waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,'/spus')
 mark('registered business/system pages and create buttons available after refresh without RBAC denial')
 const familyId=data.families[0].id
 const result=await page.evaluate(async id=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();const f=JSON.parse(JSON.stringify(s.data.families.find(f=>f.id===id)));f.name+='（统一管理员验证）';const saved=await s.saveSpu(f);return{saved,name:s.data.families.find(f=>f.id===id).name,rbac:JSON.stringify(s.data.rbac)}},familyId)
 assert(result.saved.ok);assert(result.name.endsWith('（统一管理员验证）'));assert.equal(result.rbac,preserved)
 await page.reload({waitUntil:'networkidle'});assert(await page.getByText(result.name,{exact:true}).isVisible());mark('real Store saves and persists SPU with a removed legacy identity, retaining dormant authorization verbatim')
 await page.locator('[data-group="product"]').hover();await page.keyboard.press('Tab');await page.locator('[data-group="product"]').focus();await page.keyboard.press('ArrowRight');await page.mouse.move(1100,400);await page.waitForTimeout(280);assert(await page.locator('#nav-flyout').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('#nav-flyout').count(),0);mark('existing navigation keyboard focus protection retained')
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'result.json'),JSON.stringify({browser:browser.version(),checks,errors},null,2))
}catch(error){if(page)await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});throw error}finally{await browser?.close();await server.close()}
