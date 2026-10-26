import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { createTestRuntime, removeTestRuntime } from './test-runtime.mjs'

// Actual Vue components, actual Pinia Store and installed Chrome. Runtime files
// are disposable; this check produces no screenshots or report artifacts.
const runtime=createTestRuntime('compatibility-results')
const server=await createServer({cacheDir:resolve(runtime,'vite'),plugins:[{
  name:'compatibility-component-check',
  configureServer(server){server.middlewares.use('/__compatibility-component',(_request,response)=>{response.setHeader('Content-Type','text/html');response.end('<div id="app"></div><script type="module" src="/@id/virtual:compatibility-component-check"></script>')})},
  resolveId(id){return id==='virtual:compatibility-component-check'?id:undefined},
  load(id){if(id!=='virtual:compatibility-component-check')return;return `
    import {createApp,h,reactive} from 'vue';
    import {createPinia} from 'pinia';
    import {createRouter,createWebHistory,RouterView} from 'vue-router';
    import ElementPlus from 'element-plus';
    import '/node_modules/element-plus/dist/index.css';
    import Dialog from '/src/components/template-compatibility/TemplateCompatibilityDialog.vue';
    import {useCatalogStore} from '/src/stores/catalog.ts';
    const props=reactive({modelValue:true,modelId:'template-accessory-test',initialNodeId:'compat-style-0',embedded:true});window.__testProps=props;
    const Host={setup(){useCatalogStore();return()=>h(Dialog,{...props,'onUpdate:modelValue':value=>props.modelValue=value})}};
    const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:Host}]});
    const app=createApp({render:()=>h(RouterView)});app.use(createPinia()).use(router).use(ElementPlus);router.isReady().then(()=>app.mount('#app'));
  `},
}],server:{host:'127.0.0.1',port:0,hmr:false,watch:null}})
let browser
const failures=[]
let passed=0
function mark(name){passed++;console.log(`PASS compatibility results ${name}`)}
try{
  const {createTemplateCompatibilityFixture}=await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  const {ensureProductListPages}=await server.ssrLoadModule('/src/domain/productListPages.ts')
  const fixture=createTemplateCompatibilityFixture({styles:2,colors:2,packs:1}),{data}=fixture
  ensureProductListPages(data)
  // A known unmet actual device attribute must stay unavailable, not confirmable.
  data.compatibilities.find(item=>item.id==='decl-film-a').conditions=[{kind:'attribute',attributeId:'attr-port',operator:'eq',value:'Lightning'}]
  data.compatibilities.push({...structuredClone(data.compatibilities[0]),id:'invalid-ref-check',targetId:'missing-accessory',accessorySkuId:'missing-accessory'})
  await server.listen()
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
  async function open(path,viewport={width:1366,height:900},theme='light',initial=data){
    const context=await browser.newContext({viewport,locale:'zh-CN',reducedMotion:'reduce'})
    await context.addInitScript(({data,theme})=>{localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}));localStorage.setItem('iyge-v2-theme',theme);window.__writes=0;window.__failNext=false;const native=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__failNext){window.__failNext=false;throw new DOMException('test quota failure','QuotaExceededError')}window.__writes++}return native.call(this,key,value)}},{data:initial,theme})
    const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',cause=>failures.push(String(cause)));await page.goto(base+path,{waitUntil:'networkidle'});return{page,context}
  }
  const settle=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))))
  const read=page=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const writes=page=>page.evaluate(()=>window.__writes)
  async function choose(page,field,text,multiple=false){await field.locator('.el-select__wrapper').click();await page.locator('.el-select-dropdown:visible [role="option"]').filter({hasText:text}).first().click();if(multiple)await page.keyboard.press('Escape');await settle(page)}
  const node=await open('/__compatibility-component');let page=node.page
  const editor=()=>page.locator('[data-template-compatibility-dialog]')
  await editor().locator('[data-template-result-group]').waitFor()
  const initial=await read(page),initialWrites=await writes(page)
  assert.equal(await editor().locator('[data-template-result-group]').count(),1)
  assert.match(await editor().innerText(),/沿用模板默认/)
  assert.equal(await editor().locator('[data-template-save]').isDisabled(),true)
  await page.evaluate(()=>window.__testProps.modelValue=false);await settle(page)
  assert.equal(await page.getByRole('dialog',{name:'未保存配置'}).count(),0)
  assert.deepEqual(await read(page),initial);assert.equal(await writes(page),initialWrites)
  mark('view-close-value-node-zero-dirty-zero-writes')
  await page.evaluate(()=>window.__testProps.modelValue=true);await settle(page)
  await editor().locator('[data-template-set-range]').click()
  assert.equal(await editor().locator('[data-template-claim]:visible').count(),1)
  assert.match(await editor().locator('[data-template-exception-editor]').innerText(),/Orion A/)
  assert.deepEqual(await read(page),initial)
  await editor().locator('[data-template-save]').click();await settle(page)
  assert.equal((await read(page)).templateCompatibilityConfigs[0].exceptions.length,2)
  assert.equal(await writes(page),initialWrites+1)
  mark('explicit-range-clones-effective-result-and-only-save-writes')
  await page.evaluate(()=>window.__testProps.initialNodeId='');await settle(page)
  assert.equal(await editor().locator('[data-template-result-group]').count(),2) // Two distinct complete outcomes remain separate
  assert.match(await editor().innerText(),/存在多种结果/)
  mark('mixed-effective-results-remain-grouped-with-counts')
  await page.evaluate(()=>window.__testProps.initialNodeId='compat-style');await settle(page)
  assert.equal(await editor().locator('[data-template-result-group]').count(),0)
  assert.equal(await editor().locator('[data-template-set-range]').isDisabled(),true)
  mark('attribute-node-requires-explicit-real-range')
  await page.evaluate(()=>{window.__testProps.initialNodeId='compat-style-0';window.__testProps.versionId='compat-version-1'});await settle(page)
  assert.equal(await editor().locator('[data-template-set-range]').count(),0)
  assert.equal(await editor().locator('[data-template-save]').count(),0)
  assert.match(await editor().innerText(),/沿用模板默认/)
  mark('published-context-readonly-original-snapshot')
  await node.context.close()

  const results=await open('/compatibility?device=phone-a');page=results.page
  const panel=page.locator('[data-compatibility-results]');await panel.waitFor()
  assert.equal(await page.locator('[data-declaration-editor]:visible').count(),0)
  assert.equal(await panel.locator('[data-result-accessory-id="case-sku"]').count(),1)
  assert.equal(await panel.locator('[data-result-accessory-id="film-sku"]').count(),0)
  await panel.locator('.el-radio-button').filter({hasText:'需核对'}).click()
  assert.equal(await panel.locator('[data-result-accessory-id="pending-sku"]').count(),1)
  await panel.locator('.el-radio-button').filter({hasText:'不可选'}).click()
  assert.equal(await panel.locator('[data-result-accessory-id="film-sku"]').count(),1)
  assert.match(await panel.innerText(),/引用失效或规则冲突/)
  assert.equal(await panel.getByRole('button',{name:/确认适用|忽略条件/}).count(),0)
  mark('phone-results-review-blocked-invalid-and-known-unmet-are-not-confirmable')
  await panel.locator('.el-radio-button').filter({hasText:'看配件'}).click()
  await choose(page,panel.locator('[data-result-accessory]'),'CASE-SKU')
  assert.equal(await panel.locator('[data-result-host]').count(),2)
  mark('accessory-perspective-reuses-real-reverse-model-facts')
  await page.getByRole('tab',{name:'声明与型号维护',exact:true}).click()
  await page.getByRole('button',{name:'新增声明',exact:true}).click()
  const form=page.locator('[data-declaration-editor]:visible')
  await choose(page,form.locator('[data-declaration-targets]'),'COPY-SKU',true)
  await choose(page,form.locator('[data-declaration-hosts]'),'Orion A',true)
  await choose(page,form.locator('[data-declaration-hosts]'),'Orion B',true)
  await form.getByPlaceholder('填写实际依据；资料缺失请说明待核验，不虚构测试结果').fill('真实浏览器测试共同待核验资料')
  await settle(page)
  assert.equal(await form.locator('[data-preview-compatibility]').count(),0)
  assert.match(await form.locator('[data-compatibility-preview]').innerText(),/新增 2 条/)
  assert.equal(await form.locator('[data-confirm-compatibility]').isEnabled(),true)
  const beforeSave=await read(page)
  await page.evaluate(()=>window.__failNext=true);await form.locator('[data-confirm-compatibility]').click();await form.locator('[data-declaration-error]').waitFor()
  assert.deepEqual(await read(page),beforeSave)
  assert.equal(await form.getByPlaceholder('填写实际依据；资料缺失请说明待核验，不虚构测试结果').inputValue(),'真实浏览器测试共同待核验资料')
  await form.locator('[data-confirm-compatibility]').click();await form.waitFor({state:'hidden'})
  const saved=(await read(page)).compatibilities.filter(item=>item.targetId==='copy-sku')
  assert.equal(saved.length,2);assert(saved.every(item=>item.verification==='pending'))
  mark('multi-model-auto-preview-honest-pending-atomic-failure-retains-input-and-retry')
  await page.locator('[data-declaration-id="decl-case-a"]').getByRole('button',{name:'编辑声明',exact:true}).click()
  const edit=page.locator('[data-declaration-editor]:visible')
  await edit.getByPlaceholder('填写实际依据；资料缺失请说明待核验，不虚构测试结果').fill('本地旧基准尚未应用的修改')
  await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();const {declarationDraft}=await import('/src/domain/accessoryCompatibilityCommands.ts');const original=store.data.compatibilities.find(item=>item.id==='decl-case-a');const result=await store.commitCompatibilityChanges([{kind:'edit',id:original.id,draft:{...declarationDraft(original),source:'外部已保存的新依据'}}]);if(!result.ok)throw new Error(result.message)})
  await settle(page);await edit.locator('[data-confirm-compatibility]').click();await edit.locator('[data-declaration-error]').waitFor()
  assert.equal((await read(page)).compatibilities.find(item=>item.id==='decl-case-a').source,'外部已保存的新依据')
  assert.equal(await edit.getByPlaceholder('填写实际依据；资料缺失请说明待核验，不虚构测试结果').inputValue(),'本地旧基准尚未应用的修改')
  mark('external-edit-rejects-old-editor-and-keeps-local-input')
  await edit.getByRole('button',{name:'取消',exact:true}).click()
  await page.getByRole('tab',{name:'查看结果',exact:true}).click()
  assert.equal(await panel.locator('[data-result-host]').count(),2,'returning from maintenance retains the selected accessory')
  await results.context.close()
  for(const viewport of [{width:920,height:800},{width:390,height:844}]){
    const narrow=await open('/compatibility?device=phone-a',viewport,'dark')
    await narrow.page.locator('[data-compatibility-results]').waitFor()
    assert(await narrow.page.locator('[data-compatibility-results]').evaluate(element=>element.scrollWidth<=element.clientWidth+1))
    await narrow.page.locator('.el-radio-button').filter({hasText:'需核对'}).click()
    assert.equal(await narrow.page.locator('[data-result-accessory-id="pending-sku"]').count(),1)
    await narrow.context.close()
  }
  mark('desktop-narrow-and-dark-results-normal-clicks-no-overflow')
  assert.deepEqual(failures,[])
  console.log(`PASS ${passed} compatibility result browser groups; strict=${process.env.VITE_RBAC_ENFORCEMENT==='true'}`)
}finally{await browser?.close();await server.close();removeTestRuntime(runtime)}
