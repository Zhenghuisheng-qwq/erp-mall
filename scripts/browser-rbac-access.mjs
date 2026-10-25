import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
const out=resolve('work/rbac/access');mkdirSync(out,{recursive:true})
const server=await createServer({cacheDir:resolve(out,'cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null}})
let browser,page;const checks=[],errors=[]
try{
 const {createSeed}=await server.ssrLoadModule('/src/domain/seed.ts');const data=createSeed();data.activeRole='admin'
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1366,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
 await ctx.addInitScript(data=>{if(location.protocol==='http:'&&!localStorage.getItem('iyge-v2-mock-db')){localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}));localStorage.setItem('iyge-v2-theme','light')}},data)
 page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(base+'/roles',{waitUntil:'networkidle'})
 const ids=await page.evaluate(async()=>{
   const s=(await import('/src/stores/catalog.ts')).useCatalogStore();const {permissionRegistry}=await import('/src/domain/rbac.ts')
   const spu={id:'access-spu',code:'spu-editor',name:'仅SPU查看编辑',description:'隔离验收',enabled:true,permissionCodes:[]}
   const model={id:'access-model',code:'model-editor',name:'仅模型',description:'隔离验收',enabled:true,permissionCodes:[]}
   for(const r of [spu,model]){const result=await s.saveRbacRole(r);if(!result.ok)throw Error(result.message)}
   for(const [id,codes]of [[spu.id,['product:spu:read','product:spu:update']],[model.id,permissionRegistry().filter(p=>['model','model-designer'].includes(p.resource)).map(p=>p.code)]]){const result=await s.grantRbacRole(id,codes);if(!result.ok)throw Error(result.message)}
   for(const u of [{id:'access-u-spu',username:'spu-only',displayName:'SPU编辑验收',roleIds:[spu.id]},{id:'access-u-model',username:'model-only',displayName:'模型验收',roleIds:[model.id]},{id:'access-u-multi',username:'multi',displayName:'多角色验收',roleIds:[spu.id,model.id]}]){const result=await s.saveRbacUser({...u,role:'operator',enabled:true});if(!result.ok)throw Error(result.message)}
   return {admin:s.activeUserId,operator:s.data.users.find(u=>u.role==='operator').id,family:s.data.families[0].id}
 })
 const push=async path=>{await page.evaluate(async path=>(await import('/src/router/index.ts')).default.push(path),path);await page.waitForTimeout(160)}
 const choose=async id=>{await page.locator('.topbar .el-select').click();const name=await page.evaluate(async id=>(await import('/src/stores/catalog.ts')).useCatalogStore().data.users.find(u=>u.id===id).displayName,id);await page.getByRole('option',{name:`模拟用户：${name}`,exact:true}).click();await page.waitForTimeout(180)}
 const exit=async()=>{await page.getByRole('button',{name:'退出权限预览／模拟',exact:true}).first().click();await page.waitForTimeout(160)}
 const mark=name=>{checks.push(name);console.log('PASS '+name)}
 for(const [user,path,allowed] of [[ids.operator,'/spus',true],['access-u-spu','/spus',true],['access-u-model','/models',true],['access-u-multi','/models',true]]){
   await choose(user);await push(path);assert.equal(new URL(page.url()).pathname,path)
   const can=await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();return{admin:s.isAdmin,spu:s.can('product:spu:update'),model:s.can('product:model:update'),system:s.can('system:role:grant'),material:s.can('product:material:create')}})
   assert.equal(can.admin,false);assert.equal(can.system,false);assert.equal(can.material,false)
   if(user==='access-u-spu'){const isolatedTab=await ctx.newPage();await isolatedTab.goto(base+'/spus',{waitUntil:'networkidle'});assert.deepEqual(await isolatedTab.evaluate(async()=>{const t=(await import('/src/stores/catalog.ts')).useCatalogStore();return [t.activeUserId,t.isAdmin]}),['access-u-spu',false]);await isolatedTab.close();assert(can.spu&&!can.model);assert(await page.getByRole('button',{name:'新建 SPU',exact:true}).isDisabled());await push('/spus/'+ids.family);assert.equal(new URL(page.url()).pathname,'/spus/'+ids.family);assert(await page.getByRole('button',{name:'保存',exact:true}).isEnabled());await push('/spus/new');assert.equal(new URL(page.url()).pathname,'/forbidden');await push('/products/'+ids.family+'?add=1');assert.equal(new URL(page.url()).pathname,'/forbidden')}
   if(user===ids.operator){assert(!can.spu&&!can.model);assert(await page.getByRole('button',{name:'新建 SPU',exact:true}).isDisabled())}
   if(user==='access-u-model')assert(!can.spu&&can.model)
   if(user==='access-u-multi')assert(can.spu&&can.model)
   await push('/roles');assert.equal(new URL(page.url()).pathname,'/forbidden')
   await page.screenshot({path:resolve(out,user+'-denied.png')});await exit()
 }
 mark('five identities: union, route/new/legacy-query denial, save/create buttons and super flag agree')
 await push('/spus');await choose('access-u-spu')
 const blocked=await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();const before=JSON.stringify(s.data),raw=localStorage.getItem('iyge-v2-mock-db');const failures=[];for(const fn of [()=>s.createProductModel('forbidden',''),()=>s.saveRbacRole({id:'bad',code:'bad',name:'bad',enabled:true,description:'',permissionCodes:[]}),()=>s.data.users[0].roleIds.push('fake'),()=>s.data.rbac.roles[0].permissionCodes.push('fake')]){try{await fn();failures.push(false)}catch{failures.push(true)}}return{failures,same:before===JSON.stringify(s.data)&&raw===localStorage.getItem('iyge-v2-mock-db')}})
 assert(blocked.failures.every(Boolean)&&blocked.same);await exit();mark('bypassed buttons and direct authorization mutations rejected with live/disk data unchanged')
 await push('/spus');await choose('access-u-multi')
 await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();s.stopPermissionPreview();const r=JSON.parse(JSON.stringify(s.data.rbac.roles.find(r=>r.id==='access-spu')));r.enabled=false;const saved=await s.saveRbacRole(r);if(!saved.ok)throw Error(saved.message);s.simulateUser('access-u-multi')})
 await push('/spus');assert.equal(new URL(page.url()).pathname,'/forbidden');await push('/models');assert.equal(new URL(page.url()).pathname,'/models');await exit();mark('disabled role immediately removed from multi-role union without deleting other role grants')
 const second=await ctx.newPage();await second.goto(base+'/roles',{waitUntil:'networkidle'})
 await choose('access-u-multi');await push('/models')
 await second.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();const r=JSON.parse(JSON.stringify(s.data.rbac.roles.find(r=>r.id==='access-model')));r.enabled=false;const saved=await s.saveRbacRole(r);if(!saved.ok)throw Error(saved.message)})
 await page.waitForURL('**/forbidden?**');assert.equal(await page.evaluate(async()=>(await import('/src/stores/catalog.ts')).useCatalogStore().activeUserId),'access-u-multi');await second.close();mark('authorization changed in another tab fails closed and redirects without restoring administrator identity')
 assert.deepEqual(errors,[])
 writeFileSync(resolve(out,'result.json'),JSON.stringify({browser:browser.version(),checks,errors},null,2))
}catch(e){if(page)await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});throw e}finally{await browser?.close();await server.close()}
