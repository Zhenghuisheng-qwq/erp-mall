import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('catalog-ledgers'),errors=[]
let server,browser,page,groups=0
const mark=name=>{groups++;console.log(`PASS ${name}`)}
try{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 for(const strict of [false,true]){
  server=await createServer({cacheDir:resolve(runtime,String(strict)),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
  const {createHostModelFixture}=await server.ssrLoadModule('/scripts/catalog-published-fixture.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const f=createHostModelFixture(),data=f.data
  data.categories.push({id:'ledger-parent',name:'台账维护父类',parentId:null,sort:999,enabled:true},{id:'ledger-leaf',name:'台账维护末级',parentId:'ledger-parent',sort:1,enabled:true})
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
  await context.addInitScript(({data,version})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user','u-admin');const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'&&window.__quota)throw new DOMException('isolated ledger quota','QuotaExceededError');return original.call(this,key,value)}},{data,version:DATA_VERSION})
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(String(error)))
  const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db')),read=async()=>JSON.parse(await raw()).data
  const settle=()=>page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
  const chooseLeaf=async drawer=>{await drawer.locator('[data-category-tree-select] .trigger').click();await page.locator('[data-category-tree-select-panel] input').fill('台账维护末级');await page.locator('[data-category-tree-select-panel] [data-category-id="ledger-leaf"] .node').click()}
  const moreType=async(id,action)=>{const row=page.locator('[data-catalog-type-table] .el-table__row').filter({has:page.locator(`[data-catalog-type="${id}"]`)});await row.getByRole('button',{name:/更多操作/}).click();await page.getByRole('menuitem',{name:action,exact:true}).click()}
  const confirm=async title=>page.getByRole('dialog',{name:title,exact:true}).getByRole('button',{name:'确定',exact:true}).click()
  await page.goto(`${base}/catalog?view=types&categoryId=ledger-parent`,{waitUntil:'networkidle'});await settle();const start=await raw()
  await page.locator('[data-catalog-create-type]').click();let form=page.getByRole('dialog',{name:'新增产品类型',exact:true});await form.getByRole('textbox',{name:'产品类型名称',exact:true}).fill('台账新类型');await form.getByRole('button',{name:'保存',exact:true}).click();assert.match(await form.innerText(),/末级分类/);assert.equal(await raw(),start)
  await chooseLeaf(form);await form.getByRole('textbox',{name:'产品类型说明',exact:true}).fill('需要保留的输入');await form.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('dialog',{name:'未保存产品类型',exact:true}).getByRole('button',{name:'继续编辑',exact:true}).click();assert.equal(await form.getByRole('textbox',{name:'产品类型说明',exact:true}).inputValue(),'需要保留的输入')
  await page.evaluate(()=>window.__quota=true);await form.getByRole('button',{name:'重试保存',exact:true}).click();await form.locator('.el-alert').waitFor();assert.equal(await raw(),start);assert.equal((await read()).productTypes.some(row=>row.name==='台账新类型'),false)
  await form.getByRole('textbox',{name:'产品类型名称',exact:true}).fill('台账最新类型');await page.evaluate(()=>window.__quota=false);await form.getByRole('button',{name:'重试保存',exact:true}).click();await form.waitFor({state:'hidden'});await settle();let saved=(await read()).productTypes.find(row=>row.name==='台账最新类型');assert(saved);assert.equal(saved.categoryId,'ledger-leaf');assert.equal(saved.description,'需要保留的输入')
  mark(`ledger/${strict}: parent cannot own a type; explicit leaf choice, cancelled close, atomic quota failure and latest-input retry succeed`)

  await moreType(saved.id,'编辑');form=page.getByRole('dialog',{name:'编辑产品类型',exact:true});await form.getByRole('textbox',{name:'产品类型说明',exact:true}).fill('明确编辑后的说明');await form.getByRole('button',{name:'保存',exact:true}).click();await form.waitFor({state:'hidden'});await settle();saved=(await read()).productTypes.find(row=>row.id===saved.id);assert.equal(saved.description,'明确编辑后的说明')
  await page.evaluate(()=>window.__quota=true);await moreType(saved.id,'停用');await confirm('调整类型状态');await page.locator('[data-catalog-types] .el-alert').waitFor();assert.equal((await read()).productTypes.find(row=>row.id===saved.id).status,'enabled');await page.evaluate(()=>window.__quota=false);await page.locator('[data-catalog-types]').getByRole('button',{name:'重试保存',exact:true}).click();await settle();assert.equal((await read()).productTypes.find(row=>row.id===saved.id).status,'disabled');await moreType(saved.id,'启用');await confirm('调整类型状态');await settle()
  mark(`ledger/${strict}: edit and status actions use protected writes; failed status change leaves original record and retries explicitly`)

  await page.locator('[data-catalog-view="models"]').click();await page.locator('[data-catalog-create-model]').click();form=page.getByRole('dialog',{name:'新建模型',exact:true});await chooseLeaf(form);await form.locator('.el-select__wrapper').click();await page.getByRole('option',{name:`${saved.name} · ${saved.id}`,exact:true}).click();await form.getByRole('textbox',{name:'模型名称',exact:true}).fill('台账创建模型')
  const beforeModel=await raw();await page.evaluate(()=>window.__quota=true);await form.getByRole('button',{name:'创建模型',exact:true}).click();await form.locator('.el-alert').waitFor();assert.equal(await raw(),beforeModel);await page.evaluate(()=>window.__quota=false);await form.getByRole('button',{name:'重试创建',exact:true}).click();await form.waitFor({state:'hidden'});await page.locator('[data-catalog-model-detail]').waitFor();await settle();const created=(await read()).specCanvases.find(row=>row.name==='台账创建模型');assert(created);assert.equal(created.productTypeId,saved.id);assert.match(await page.locator('[data-catalog-model-detail]').innerText(),/尚无发布版本|尚未发布/);assert.equal((await read()).specModelVersions.filter(row=>row.templateId===created.templateId).length,0)
  await page.locator('[data-catalog-model-detail]').getByRole('button',{name:'返回资料管理',exact:true}).click();await page.locator('[data-catalog-model-detail]').waitFor({state:'hidden'})
  const modelRow=()=>page.locator('[data-catalog-model-table] .el-table__row').filter({has:page.locator(`[data-catalog-model="${created.templateId}"]`)})
  const modelAction=async action=>{await modelRow().getByRole('button',{name:/更多操作/}).click();await page.getByRole('menuitem',{name:action,exact:true}).click()}
  await modelAction('发布当前草稿');await confirm('发布当前草稿');await page.locator('[data-catalog-models] .el-alert').waitFor();assert.equal((await read()).specModelVersions.filter(row=>row.templateId===created.templateId).length,0)
  await modelAction('复制模型');await confirm('复制模型');await settle();const copy=(await read()).specCanvases.find(row=>row.name==='台账创建模型 副本');assert(copy);assert.notEqual(copy.templateId,created.templateId)
  const protectedSnapshot=JSON.stringify([(await read()).specModelVersions,(await read()).families,(await read()).skus]);await modelAction('下线模型');await confirm('下线模型');await settle();assert.equal((await read()).specCanvases.find(row=>row.templateId===created.templateId).status,'offline');assert.equal(JSON.stringify([(await read()).specModelVersions,(await read()).families,(await read()).skus]),protectedSnapshot)
  mark(`ledger/${strict}: model create quota retry, real identity, invalid publish protection, independent copy and atomic offline preserve historical records`)

  await page.locator('[data-catalog-view="types"]').click();await moreType(saved.id,'删除');await confirm('删除产品类型');await page.locator('[data-catalog-types] .el-alert').waitFor();assert((await read()).productTypes.some(row=>row.id===saved.id));assert.match(await page.locator('[data-catalog-types] .el-alert').innerText(),/引用|不能删除/)
  mark(`ledger/${strict}: referenced type deletion stays blocked; model details preserve publication history`)
  await context.close();await server.close();server=undefined
 }
 assert.deepEqual(errors,[]);console.log(`PASS catalog ledger browser ${groups} groups`)
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(0,6500));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
