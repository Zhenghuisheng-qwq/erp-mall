import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const artifacts=process.argv.includes('--artifacts'),runtime=createTestRuntime('scheme-browser')

const out=resolve(process.env.TEMPLATE_SCHEME_OUTPUT || 'work/template-scheme-repair/browser')
if(artifacts)mkdirSync(out,{recursive:true})
const checks=[],errors=[],servers=[]
let browser,page
const mark=name=>{checks.push(name);if(artifacts)console.log('PASS '+name)}
try {
  const server=await createServer({logLevel:artifacts?'info':'silent',cacheDir:resolve(runtime,'strict-cache'),define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('true')},server:{host:'127.0.0.1',port:0,watch:null,hmr:false}});servers.push(server)
  const {createSeed}=await server.ssrLoadModule('/src/domain/seed.ts'),{ensureRbac}=await server.ssrLoadModule('/src/domain/rbac.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const data=createSeed();data.activeRole='admin';ensureRbac(data)
  const params=data.params.slice(0,3),sourceId='scheme-copy-source',parentId='scheme-copy-parent',modelId='scheme-real-model'
  assert.equal(params.length,3)
  data.templates.push({id:parentId,name:'父级普通方案',enabled:true,parentId:null,structureOrder:[]},{id:sourceId,name:'待复制普通方案',enabled:false,parentId,structureOrder:[params[2].id,params[0].id,params[1].id]},{id:modelId,name:'真实商品模型记录',enabled:true,parentId:null,structureOrder:[]})
  const sourceBinds=[{paramId:params[2].id,role:'variant',required:false},{paramId:params[0].id,role:'common',required:true},{paramId:params[1].id,role:'variant',required:true}]
  data.templateParams.push(...sourceBinds.map(b=>({templateId:sourceId,...b})))
  const productType=data.productTypes[0];assert(productType)
  data.specCanvases.push({templateId:modelId,productTypeId:productType.id,name:'真实商品模型记录',status:'draft',version:1,versionName:'V1',direction:'logic',zoom:1,panX:0,panY:0,updatedAt:'2026-10-26T00:00:00.000Z'})
  for(const [key,codes] of [['create',['product:template:read','product:template:create']],['update',['product:template:read','product:template:update']]]) {
    data.rbac.roles.push({id:`scheme-role-${key}`,code:`scheme-${key}`,name:`方案${key}验收`,description:'隔离测试',enabled:true,permissionCodes:codes})
    data.users.push({id:`scheme-user-${key}`,username:`scheme-${key}`,displayName:`方案${key}验收`,role:'operator',roleIds:[`scheme-role-${key}`],enabled:true})
  }
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true})
  const context=async (actor,url=base)=>{
    const ctx=await browser.newContext({viewport:{width:1366,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
    await ctx.addInitScript(({data,version,actor})=>{
      if(location.protocol!=='http:')return
      if(!localStorage.getItem('iyge-v2-mock-db')){localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));localStorage.setItem('iyge-v2-theme','light');sessionStorage.setItem('iyge-rbac-simulated-user',actor)}
      const set=Storage.prototype.setItem
      Storage.prototype.setItem=function(k,v){if(k==='iyge-v2-mock-db'&&window.__failSchemeWrite)throw Error('方案写盘失败测试');return set.call(this,k,v)}
    },{data,version:DATA_VERSION,actor})
    page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)))
    await page.goto(url+'/templates',{waitUntil:'networkidle'})
    assert.equal(new URL(page.url()).pathname,'/templates')
    await page.evaluate(async()=> (await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence())
    return ctx
  }
  const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const btn=(name,scope=page)=>scope.getByRole('button',{name,exact:true})
  const row=id=>page.locator('.el-table__row').filter({has:page.locator(`[data-template-id="${id}"]`)})
  const shot=async name=>{if(artifacts)await page.screenshot({path:resolve(out,name+'.png'),fullPage:true})}
  const bindsOf=(d,id)=>d.templateParams.filter(p=>p.templateId===id).map(({paramId,role,required})=>({paramId,role,required}))
  const originalBindings=JSON.parse(JSON.stringify(sourceBinds))
  let ctx=await context('scheme-user-create')
  assert.equal(await page.evaluate(async()=> (await import('/src/stores/catalog.ts')).useCatalogStore().rbacEnforced),true)
  assert(await btn('新建方案').isEnabled());assert(await btn('配置',row(sourceId)).isDisabled());assert.equal(await row(modelId).count(),0)
  let initial=await read(),disk=await raw()
  await btn('新建方案').click();let drawer=page.getByRole('dialog',{name:'新建方案',exact:true})
  await drawer.getByRole('textbox',{name:'方案名称',exact:true}).fill('取消的新方案不能落盘')
  assert.deepEqual(await read(),initial);assert.equal(await raw(),disk)
  await btn('取消',drawer).click();await drawer.waitFor({state:'hidden'});assert.deepEqual(await read(),initial);assert.equal(await raw(),disk)
  mark('strict create-only: new drawer is editable and cancel leaves all memory/disk data unchanged; existing edit remains disabled')
  await page.goto(base+'/templates?scheme='+sourceId,{waitUntil:'networkidle'});drawer=page.getByRole('dialog',{name:'配置方案',exact:true});await drawer.waitFor();assert(await drawer.getByRole('textbox',{name:'方案名称',exact:true}).isDisabled());assert(await btn('保存',drawer).isDisabled());await btn('取消',drawer).click();await drawer.waitFor({state:'hidden'});assert.deepEqual(await read(),initial);assert.equal(await raw(),disk)

  await btn('新建方案').click();drawer=page.getByRole('dialog',{name:'新建方案',exact:true})
  await drawer.getByRole('textbox',{name:'方案名称',exact:true}).fill('仅创建权限保存的新方案')
  await drawer.locator('.el-select').filter({has:page.getByRole('combobox',{name:'加入参数',exact:true})}).click();await page.getByRole('option',{name:params[0].name,exact:true}).click();await btn('加入',drawer).click()
  await drawer.locator('.rule-card .el-select').click();await page.getByRole('option',{name:'公共属性',exact:true}).click();await drawer.locator('.rule-card .el-checkbox').click()
  await page.evaluate(()=>window.__failSchemeWrite=true);await btn('保存',drawer).click();await drawer.locator('[data-template-save-error]').waitFor()
  assert.deepEqual(await read(),initial);assert.equal(await raw(),disk);assert.equal(await drawer.getByRole('textbox',{name:'方案名称',exact:true}).inputValue(),'仅创建权限保存的新方案');assert(await btn('保存',drawer).isEnabled());assert.equal(await drawer.locator('.rule-card').count(),1)
  await shot('strict-create-failure-draft')
  await page.evaluate(()=>window.__failSchemeWrite=false);await btn('保存',drawer).click();await drawer.waitFor({state:'hidden'})
  let current=await read();const created=current.templates.find(t=>t.name==='仅创建权限保存的新方案');assert(created)
  assert.deepEqual(bindsOf(current,created.id),[{paramId:params[0].id,role:'common',required:true}]);assert.equal(current.templates.length,initial.templates.length+1);assert.deepEqual(current.skus,initial.skus);assert.deepEqual(current.specModelVersions,initial.specModelVersions)
  mark('strict template:create without update saves name/order/role/required in one commit; failed write preserves input and atomically retries')

  initial=await read();disk=await raw();await btn('复制',row(sourceId)).click();drawer=page.getByRole('dialog',{name:'复制方案',exact:true})
  assert.equal(await drawer.getByRole('textbox',{name:'方案名称',exact:true}).inputValue(),'待复制普通方案 副本');assert.equal(await drawer.locator('.rule-card').count(),3)
  assert.deepEqual(await read(),initial);assert.equal(await raw(),disk);await btn('取消',drawer).click();await drawer.waitFor({state:'hidden'});assert.deepEqual(await read(),initial);assert.equal(await raw(),disk)
  mark('ordinary copy opens a complete local draft; cancel does not create even a partial scheme or binding')
  await btn('复制',row(sourceId)).click();drawer=page.getByRole('dialog',{name:'复制方案',exact:true});await drawer.getByRole('textbox',{name:'方案名称',exact:true}).fill('完整参数绑定副本')
  await page.evaluate(()=>window.__failSchemeWrite=true);await btn('保存',drawer).click();await drawer.locator('[data-template-save-error]').waitFor();assert.deepEqual(await read(),initial);assert.equal(await raw(),disk);assert.equal(await drawer.locator('.rule-card').count(),3);assert(await btn('保存',drawer).isEnabled());await shot('strict-copy-failure-preserves-all-bindings')
  await page.evaluate(()=>window.__failSchemeWrite=false);await btn('保存',drawer).click();await drawer.waitFor({state:'hidden'});current=await read();const copy=current.templates.find(t=>t.name==='完整参数绑定副本');assert(copy)
  assert.equal(copy.parentId,parentId);assert.equal(copy.enabled,false);assert.deepEqual(copy.structureOrder,initial.templates.find(t=>t.id===sourceId).structureOrder);assert.deepEqual(bindsOf(current,copy.id),originalBindings);assert.deepEqual(bindsOf(current,sourceId),originalBindings)
  assert.equal(current.templates.length,initial.templates.length+1);assert.deepEqual(current.specCanvases,initial.specCanvases);assert.deepEqual(current.specModelVersions,initial.specModelVersions)
  await page.reload({waitUntil:'networkidle'});current=await read();assert.deepEqual(bindsOf(current,copy.id),originalBindings);assert.equal(current.templates.find(t=>t.id===copy.id).enabled,false);await shot('strict-copy-complete-after-refresh')
  mark('copy transaction preserves complete order/bindings/enabled/parent and source; no half-copy on failure, retry and refresh retain all fields')
  const rejected=await page.evaluate(async({modelId,params})=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();const before=JSON.stringify(s.data),disk=localStorage.getItem('iyge-v2-mock-db');let denied=false;try{const r=await s.saveTemplateScheme({id:'',name:'伪装的模型副本',sourceId:modelId,structureOrder:[],binds:[]});denied=!r.ok}catch{denied=true}return denied&&before===JSON.stringify(s.data)&&disk===localStorage.getItem('iyge-v2-mock-db')},{modelId,params});assert(rejected)
  await ctx.close()
  mark('a real model cannot be copied through the ordinary scheme endpoint or exposed to template-only identity')

  ctx=await context('scheme-user-update');assert(await btn('新建方案').isDisabled());assert(await btn('复制',row(sourceId)).isDisabled());await btn('配置',row(sourceId)).click();drawer=page.getByRole('dialog',{name:'配置方案',exact:true});await drawer.getByRole('textbox',{name:'方案名称',exact:true}).fill('只有编辑权限的原方案')
  await btn('保存',drawer).click();await page.getByRole('dialog',{name:'修改：只有编辑权限的原方案',exact:true}).getByRole('button',{name:'确认保存',exact:true}).click();await drawer.waitFor({state:'hidden'});current=await read();assert.equal(current.templates.find(t=>t.id===sourceId).name,'只有编辑权限的原方案');assert.deepEqual(bindsOf(current,sourceId),originalBindings);await ctx.close()
  mark('strict update-only edits the existing scheme while creation/copy remain denied')

  const unrestricted=await createServer({logLevel:artifacts?'info':'silent',cacheDir:resolve(runtime,'unrestricted-cache'),define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify('false')},server:{host:'127.0.0.1',port:0,watch:null,hmr:false}});servers.push(unrestricted);await unrestricted.listen();const unrestrictedBase=`http://127.0.0.1:${unrestricted.httpServer.address().port}`
  ctx=await context('scheme-user-create',unrestrictedBase);assert.equal(await page.evaluate(async()=> (await import('/src/stores/catalog.ts')).useCatalogStore().rbacEnforced),false)
  assert(await btn('配置',row(sourceId)).isEnabled());assert.equal(await row(modelId).count(),1)
  await btn('新建方案').click();drawer=page.getByRole('dialog',{name:'新建方案',exact:true});await drawer.getByRole('textbox',{name:'方案名称',exact:true}).fill('默认统一模式方案');await btn('保存',drawer).click();await drawer.waitFor({state:'hidden'});current=await read();assert(current.templates.some(t=>t.name==='默认统一模式方案'))
  const unifiedModelRejected=await page.evaluate(async modelId=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore(),before=JSON.stringify(s.data),disk=localStorage.getItem('iyge-v2-mock-db');const r=await s.saveTemplateScheme({id:'',name:'统一模式仍不能将模型伪装为方案',sourceId:modelId,structureOrder:[],binds:[]});return !r.ok&&before===JSON.stringify(s.data)&&disk===localStorage.getItem('iyge-v2-mock-db')},modelId);assert(unifiedModelRejected)
  const modelCount=current.specCanvases.length;await btn('复制',row(modelId)).click();await page.waitForFunction(async({modelCount})=> (await import('/src/stores/catalog.ts')).useCatalogStore().data.specCanvases.length===modelCount+1,{modelCount});current=await read();const copiedModel=current.templates.find(t=>t.name==='真实商品模型记录 副本');assert(copiedModel);assert(current.specCanvases.some(c=>c.templateId===copiedModel.id&&c.productTypeId===productType.id));assert.equal(await page.getByRole('dialog',{name:'复制方案',exact:true}).count(),0);await shot('unrestricted-scheme-and-real-model-path');await ctx.close()
  mark('explicit default unrestricted mode retains full editing, creates ordinary schemes and keeps real model copy on the original model transaction')
  assert.deepEqual(errors,[]);console.log(`PASS template scheme browser (${checks.length} groups)`)
  if(artifacts)writeFileSync(resolve(out,'result.json'),JSON.stringify({result:'PASS',browser:browser.version(),checks,errors},null,2))
} catch(e) { if(page&&!page.isClosed())if(artifacts)await page.screenshot({path:resolve(out,'failure.png'),fullPage:true}).catch(()=>{});if(artifacts)writeFileSync(resolve(out,'result.json'),JSON.stringify({result:'FAIL',error:String(e),checks,errors},null,2));throw e }
finally { await browser?.close(); for(const s of servers)await s.close();removeTestRuntime(runtime) }
