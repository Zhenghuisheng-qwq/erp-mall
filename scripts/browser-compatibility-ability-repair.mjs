import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('compatibility-ability-repair'),errors=[]
let server,browser,page,count=0
const mark=name=>{count++;console.log(`PASS ${name}`)}
try{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 for(const strict of [false,true]){
  server=await createServer({cacheDir:resolve(runtime,String(strict)),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,hmr:false,watch:null}})
  const {createCompatibilityAbilityFixture}=await server.ssrLoadModule('/scripts/compatibility-ability-fixtures.ts'),{createTemplateCompatibilityFixture}=await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const fixture=createCompatibilityAbilityFixture(),{data,modelId}=fixture
  data.rbac.roles.push({id:'role:compatibility-reader',code:'compatibility-reader',name:'兼容只读检查',description:'隔离测试',enabled:true,permissionCodes:data.rbac.permissions.filter(item=>item.code.endsWith(':read')).map(item=>item.code)});data.users.push({...structuredClone(data.users.find(item=>item.enabled)),id:'compatibility-reader',username:'compatibility-reader',displayName:'兼容只读检查',role:'operator',roleIds:['role:compatibility-reader']})
  data.rbac.roles.push({id:'role:model-only',code:'model-only',name:'仅模型查看',description:'隔离测试',enabled:true,permissionCodes:data.rbac.permissions.filter(item=>item.code.endsWith(':read')&&!item.code.startsWith('product:compatibility:')&&!item.code.startsWith('product:sales-config:')).map(item=>item.code)});data.users.push({...structuredClone(data.users.find(item=>item.enabled)),id:'model-only',username:'model-only',displayName:'仅模型查看',role:'operator',roleIds:['role:model-only']})
  const accessory=createTemplateCompatibilityFixture({styles:1,colors:1,packs:1})
  // A distinct real accessory model makes both directions reachable in the same catalogue.
  const accessoryId='matrix-accessory-model'
  data.templates.push({...structuredClone(accessory.data.templates.find(item=>item.id===accessory.modelId)),id:accessoryId,name:'配件方向测试'})
  data.specCanvases.push({...structuredClone(accessory.data.specCanvases.find(item=>item.templateId===accessory.modelId)),templateId:accessoryId,name:'配件方向测试'})
  data.productSpecNodes.push(...accessory.data.productSpecNodes.filter(item=>item.templateId===accessory.modelId).map(item=>({...structuredClone(item),id:`accessory:${item.id}`,templateId:accessoryId,parentId:item.parentId?`accessory:${item.parentId}`:null})))
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  async function context(initial=data){const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',reducedMotion:'reduce'});await ctx.addInitScript(({data,version})=>{if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));window.__writes=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__quota){window.__quota=false;throw new DOMException('ability check failure','QuotaExceededError')}window.__writes++}return original.call(this,key,value)}},{data:initial,version:DATA_VERSION});page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(String(error)));return ctx}
  const ctx=await context()
  const settle=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))))
  const read=()=>page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();await store.waitForPersistence();return JSON.parse(JSON.stringify(store.data))})
  async function choose(field,label,multiple=false){await field.locator('.el-select__wrapper').click();await page.locator('.el-select-dropdown:visible [role="option"]').filter({hasText:label}).first().click();if(multiple)await page.keyboard.press('Escape');await settle()}
  const result=()=>page.locator('[data-compatibility-results]:visible')
  const bucket=name=>result().locator('.el-radio-button').filter({hasText:name}).click()
  const fast=()=>result().locator('[data-require-fast-charge]').click()
  await page.goto(`${base}/compatibility?device=phone-a`,{waitUntil:'networkidle'})
  assert.match(await result().locator('[data-result-accessory-id="charger-sku"]').innerText(),/基本使用适用，快充存在冲突/)
  assert.match(await result().locator('[data-result-accessory-id="case-sku"]').innerText(),/基本使用适用，快充不适用/)
  assert.match(await result().innerText(),/可用 4/)
  await bucket('不可选');assert.match(await result().locator('[data-result-accessory-id="film-sku"]').innerText(),/基本使用规则冲突/)
  const off=result().locator('[data-result-accessory-id="off-sale-sku"]');assert.match(await off.innerText(),/已确认适用/);assert.match(await off.innerText(),/当前非在售/)
  await bucket('需核对');assert.match(await result().locator('[data-result-accessory-id="pending-sku"]').innerText(),/依据待确认/)
  await fast();assert.equal(await result().locator('[data-result-accessory-id="charger-sku"]').count(),0);await bucket('不可选');assert.match(await result().locator('[data-result-accessory-id="charger-sku"]').innerText(),/快充规则冲突/)
  await result().locator('[data-result-accessory-id="charger-sku"] summary').click();assert.match(await result().locator('[data-result-accessory-id="charger-sku"]').innerText(),/快充能力.*明确不适用/)
  mark(`ability/${strict}: forward buckets counts labels detail and separate sale state follow requested ability`)
  await result().locator('.el-radio-button').filter({hasText:'看配件'}).click();await fast();await choose(result().locator('[data-result-accessory]'),'CHARGER-SKU')
  assert.match(await result().locator('[data-result-host]').innerText(),/基本使用适用，快充存在冲突/)
  await fast();await bucket('不可选');assert.match(await result().locator('[data-result-host]').innerText(),/快充规则冲突/)
  await fast();await choose(result().locator('[data-result-accessory]'),'CABLE-SKU');await bucket('需核对')
  const matrix=result().locator('[data-result-host]').filter({hasText:'当前要求的能力包含规格例外'});assert.equal(await matrix.count(),1);await matrix.locator('summary').click()
  assert.match(await matrix.innerText(),/能力测试手机 0.*已确认适用/);assert.match(await matrix.innerText(),/能力测试手机 1.*基本使用规则冲突/)
  mark(`ability/${strict}: reverse fast-only conflict does not block basic; actual PLN differences remain separate`)

  await page.getByRole('tab',{name:'声明与型号维护',exact:true}).click();await page.getByRole('button',{name:'新增声明',exact:true}).click()
  const form=()=>page.locator('[data-declaration-editor]:visible'),source=()=>form().getByPlaceholder('填写实际依据；资料缺失请说明待核验，不虚构测试结果')
  await choose(form().locator('[data-declaration-targets]'),'COPY-SKU',true);await choose(form().locator('[data-declaration-hosts]'),'独立型号',true)
  await source().fill('未保存字段与批量选择必须保留');const preview=await form().locator('[data-compatibility-preview]').innerText()
  await form().locator('[data-preserve-compatibility-input]').click();await result().waitFor();assert.equal(await form().count(),0)
  await page.getByRole('tab',{name:'原物料适用关系',exact:true}).click();await page.getByRole('tab',{name:'声明与型号维护',exact:true}).click();await form().waitFor()
  assert.equal(await source().inputValue(),'未保存字段与批量选择必须保留');assert.equal(await form().locator('[data-compatibility-preview]').innerText(),preview)
  await form().locator('[data-preserve-compatibility-input]').click();await page.locator('[data-compatibility-return]').click();await page.getByRole('dialog',{name:'未保存兼容声明',exact:true}).waitFor();assert.equal(await page.getByRole('dialog',{name:'未保存兼容声明',exact:true}).count(),1)
  await page.getByRole('button',{name:'继续编辑',exact:true}).click();assert(page.url().includes('/compatibility'))
  await page.getByRole('tab',{name:'声明与型号维护',exact:true}).click();assert.equal(await source().inputValue(),'未保存字段与批量选择必须保留')
  const previous=(await read()).compatibilities;await page.evaluate(()=>window.__quota=true);await form().locator('[data-confirm-compatibility]').click();await form().locator('[data-declaration-error]').waitFor();assert.deepEqual((await read()).compatibilities,previous)
  await form().locator('[data-preserve-compatibility-input]').click();await page.getByRole('tab',{name:'声明与型号维护',exact:true}).click();assert.equal(await source().inputValue(),'未保存字段与批量选择必须保留');await form().locator('[data-confirm-compatibility]').click();await form().waitFor({state:'hidden'})
  assert.equal((await read()).compatibilities.filter(item=>item.targetId==='copy-sku').length,1)
  mark(`input/${strict}: results legacy tabs route cancel retain fields picks preview; failed write survives navigation and retry`)
  // Context change is a separate intent. Refusing it must retain the old edit owner.
  await page.getByRole('button',{name:'新增声明',exact:true}).click();await source().fill('原上下文输入');await form().locator('[data-preserve-compatibility-input]').click();await result().locator('.el-radio-button').filter({hasText:'看手机'}).click();await bucket('可用');await result().locator('[data-result-accessory-id="case-sku"]').getByRole('button',{name:'查看与维护',exact:true}).click();await page.getByRole('button',{name:'继续编辑',exact:true}).click();await page.getByRole('tab',{name:'声明与型号维护',exact:true}).click();assert.equal(await source().inputValue(),'原上下文输入')
  await form().getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'放弃输入',exact:true}).click();await form().waitFor({state:'hidden'})
  mark(`input/${strict}: refusing context switch preserves original edit, explicit discard clears only after one confirmation`)
  if(strict){
   await page.getByRole('button',{name:'新增声明',exact:true}).click();await source().fill('管理员私有未保存输入');await form().locator('[data-preserve-compatibility-input]').click()
   await choose(page.locator('.topbar .el-select'),'模拟用户：兼容只读检查');await page.getByRole('tab',{name:'声明与型号维护',exact:true}).click();assert.equal(await form().count(),0)
   await page.getByRole('button',{name:'退出权限预览／模拟',exact:true}).click();await page.getByRole('button',{name:'新增声明',exact:true}).click();assert.equal(await source().inputValue(),'');await form().getByRole('button',{name:'取消',exact:true}).click()
   mark('input/strict: actual identity switch never restores the previous user’s unsaved fields')
  }
  await page.getByRole('button',{name:'新增声明',exact:true}).click();await source().fill('明确放弃后离开');await form().locator('[data-preserve-compatibility-input]').click();await page.locator('[data-compatibility-return]').click();await page.getByRole('button',{name:'放弃输入',exact:true}).click();await page.waitForURL('**/skus')
  await page.goto(`${base}/specs?template=${modelId}`,{waitUntil:'networkidle'});await page.locator('[data-open-sales-options]').click();await page.getByRole('tab',{name:'适用关系',exact:true}).click()
  await page.locator('[data-host-template-compatibility]').waitFor();assert.equal(await page.locator('[data-template-save]').count(),0)
  await choose(page.locator('.workspace-context .el-select'),'独立兼容测试 V1')
  const host=page.locator('[data-host-template-compatibility]');assert.match(await host.innerText(),/2 款明确机型/)
  await choose(host.locator('[data-host-template-device]'),'SALE-PHONE-0');assert.match(await host.locator('[data-result-accessory-id="charger-sku"]').innerText(),/基本使用适用，快充存在冲突/);assert(await host.locator('[data-undeclared-accessories]').isVisible())
  const beforeCatalog=JSON.stringify(await read());await page.locator('.workspace-footer').getByRole('button',{name:'关闭',exact:true}).click();assert.equal(JSON.stringify(await read()),beforeCatalog)
  if(strict){await choose(page.locator('.topbar .el-select'),'模拟用户：仅模型查看');await page.locator('[data-open-sales-options]').click();await page.locator('[data-host-template-compatibility]').waitFor();assert.match(await page.locator('[data-host-template-compatibility]').innerText(),/尚无适用关系查看权限/);assert.equal(await page.locator('[data-host-template-compatibility] [data-compatibility-results]').count(),0);await page.locator('.workspace-footer').getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'退出权限预览／模拟',exact:true}).click();mark('direction/strict: model-read alone does not expose actual compatibility facts')}
  await page.goto(`${base}/specs?template=${accessoryId}`,{waitUntil:'networkidle'});await page.locator('[data-open-sales-options]').click();await page.getByRole('tab',{name:'适用关系',exact:true}).click();await page.locator('[data-template-compatibility-dialog]').waitFor();assert.equal(await page.locator('[data-host-template-compatibility]').count(),0);assert.match(await page.locator('[data-template-compatibility-dialog]').innerText(),/设置模板默认/)
  mark(`direction/${strict}: real phone template shows pinned-version reverse facts; accessory template keeps applicable-device configuration; viewing writes nothing`)
  await ctx.close()
  const unknown=structuredClone(data);delete unknown.productTypes.find(item=>item.id==='type-device').catalogRole;unknown.categories.find(item=>item.id==='cat-device-test').name='主机'
  const unknownContext=await context(unknown);await page.goto(`${base}/specs?template=${modelId}`,{waitUntil:'networkidle'});await page.locator('[data-open-sales-options]').click();await page.getByRole('tab',{name:'适用关系',exact:true}).click();await page.locator('[data-template-role-unknown]').waitFor();assert.equal(await page.locator('[data-host-template-compatibility]').count(),0);assert.equal(await page.locator('[data-template-save]').count(),0);await unknownContext.close()
  mark(`direction/${strict}: absent explicit catalog role stays unresolved despite host-like category names`)
  await server.close();server=undefined
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${count} compatibility ability/input/direction browser groups; no screenshots or reports`)
}catch(cause){console.error(cause);if(page&&!page.isClosed())console.error((await page.locator('body').innerText()).slice(-6500));process.exitCode=1}
finally{await browser?.close();await server?.close();removeTestRuntime(runtime)}
