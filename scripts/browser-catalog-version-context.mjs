import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('catalog-version-context'),errors=[]
let server,browser,page,groups=0
const mark=name=>{groups++;console.log(`PASS ${name}`)}
try{
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 for(const strict of [false,true]){
  server=await createServer({cacheDir:resolve(runtime,String(strict)),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
  const {r01Fixture}=await server.ssrLoadModule('/scripts/r01-fixture.ts'),{freezeTemplateCompatibility}=await server.ssrLoadModule('/src/domain/templateCompatibility.ts'),{freezeBusinessNodes}=await server.ssrLoadModule('/src/domain/nodeBusiness.ts'),{ensureRbac}=await server.ssrLoadModule('/src/domain/rbac.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const {data,modelId}=r01Fixture(),nodeId=`${modelId}-apple`,namingId=`${modelId}-brand`,now='2026-10-27T00:00:00.000Z'
  const currentName=data.productSpecNodes.find(node=>node.id===namingId),currentValue=data.productSpecNodes.find(node=>node.id===nodeId)
  currentName.namingRule=[{kind:'text',text:'旧版规则-V1'},{kind:'field',key:'r01-brand'}]
  currentValue.businessConfigs=[{id:'history-business',definitionId:'business:sales',modelId,nodeId,enabled:true,scope:'subtree',parameters:{value:'hot'}}]
  data.params.find(item=>item.id==='r01-brand').name='发布时品牌名称'
  const first={id:'catalog-history-v1',templateId:modelId,version:1,versionName:'历史 V1',status:'published',nodesSnapshot:freezeBusinessNodes(data,data.productSpecNodes.filter(node=>node.templateId===modelId)),createdTime:now,publishTime:now,templateCompatibilitySnapshot:freezeTemplateCompatibility(data,modelId)}
  currentName.namingRule=[{kind:'text',text:'新版规则-V2'},{kind:'field',key:'r01-brand'}];currentValue.businessConfigs[0].parameters.value='not-hot'
  const second={...structuredClone(first),id:'catalog-history-v2',version:2,versionName:'历史 V2',nodesSnapshot:freezeBusinessNodes(data,data.productSpecNodes.filter(node=>node.templateId===modelId)),templateCompatibilitySnapshot:freezeTemplateCompatibility(data,modelId)}
  data.specModelVersions.push(first,second)
  currentName.namingRule=[{kind:'text',text:'当前草稿规则-DRAFT'},{kind:'field',key:'r01-brand'}]
  currentValue.businessConfigs=[];data.params.find(item=>item.id==='r01-brand').name='现在的品牌名称'
  data.specCanvases.find(row=>row.templateId===modelId).status='draft'
  ensureRbac(data)
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  const context=await browser.newContext({viewport:{width:1500,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
  await context.addInitScript(({data,version})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user','u-admin')},{data,version:DATA_VERSION})
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(String(error)))
  const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const settle=()=>page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
  const naming=()=>page.getByRole('dialog',{name:'物料命名规则',exact:true}),business=()=>page.getByRole('dialog',{name:'节点业务配置',exact:true})
  const selectNode=async id=>{await page.locator(`.vue-flow__node[data-id="${id}"]`).click();await page.waitForTimeout(80)}
  const selectBusiness=async label=>{await business().locator('.el-select').filter({has:page.getByRole('combobox',{name:'业务配置版本',exact:true})}).locator('.el-select__wrapper').click();await page.getByRole('option',{name:label,exact:true}).click()}
  await page.goto(`${base}/specs?template=${modelId}&version=${first.id}&mode=view`,{waitUntil:'networkidle'});await settle();const before=await raw();assert.doesNotMatch(await page.locator('body').innerText(),/草稿预览.*尚未发布/)
  await selectNode(nodeId);await page.getByRole('button',{name:'查看命名规则',exact:true}).click();await naming().waitFor()
  assert.match(await naming().innerText(),/历史 V1/);assert.match(await naming().locator('[data-naming-preview]').innerText(),/旧版规则-V1\s*Apple/);assert.doesNotMatch(await naming().innerText(),/新版规则-V2|当前草稿规则-DRAFT|现在的品牌名称/);assert.match(await naming().innerText(),/发布时品牌名称/);assert.equal(await naming().getByRole('button',{name:'保存规则',exact:true}).count(),0);assert.equal(await naming().locator('.palette').count(),0)
  await naming().getByRole('button',{name:'关闭',exact:true}).click();await settle();assert.equal(await raw(),before)
  mark(`version/${strict}: historical V1 naming reads frozen rules and labels, never latest V2/current draft; read-only inspection writes nothing`)

  await page.locator('[data-open-business]').click();await business().waitFor();assert.match(await business().locator('.el-select').filter({has:page.getByRole('combobox',{name:'业务配置版本',exact:true})}).innerText(),/历史 V1（只读快照）/)
  assert.match(await business().innerText(),/历史 V1 \/ 只读快照/);assert.match(await business().innerText(),/销售定位：\s*畅销/);assert.match(await business().innerText(),/旧版规则-V1/);assert.equal(await business().locator('[data-new-business]').count(),0)
  await selectBusiness('历史 V2（只读快照）');assert.match(await business().innerText(),/销售定位：\s*不畅销/);assert.match(await business().innerText(),/新版规则-V2/)
  await selectBusiness('当前草稿');assert.match(await business().innerText(),/当前草稿 \/ 只读/);assert.match(await business().innerText(),/当前草稿规则-DRAFT/);assert.doesNotMatch(await business().innerText(),/旧版规则-V1|新版规则-V2/);assert.equal(await business().getByRole('button',{name:'查看原命名规则',exact:true}).count(),0);assert.equal(await business().locator('[data-new-business]').count(),0)
  await business().getByRole('button',{name:'关闭',exact:true}).click();await settle();assert.equal(await raw(),before)
  mark(`version/${strict}: node business starts at requested V1, explicit V2/current switches show corresponding actual records and stay read-only`)

  await page.goto(`${base}/specs?template=${modelId}&version=${second.id}&mode=view`,{waitUntil:'networkidle'});await selectNode(nodeId);await page.getByRole('button',{name:'查看命名规则',exact:true}).click();assert.match(await naming().locator('[data-naming-preview]').innerText(),/新版规则-V2\s*Apple/);assert.doesNotMatch(await naming().innerText(),/旧版规则-V1|当前草稿规则-DRAFT/);await naming().getByRole('button',{name:'关闭',exact:true}).click()
  await page.goto(`${base}/specs?template=${modelId}&mode=view`,{waitUntil:'networkidle'});await selectNode(nodeId);await page.getByRole('button',{name:'查看命名规则',exact:true}).click();assert.match(await naming().locator('[data-naming-preview]').innerText(),/草稿预览：当前草稿规则-DRAFT\s*Apple/);await naming().getByRole('button',{name:'关闭',exact:true}).click();await settle();assert.equal(await raw(),before)
  mark(`version/${strict}: independent V2 and legacy draft-view naming keep their own contracts with unchanged business storage`)

  await page.goto(`${base}/specs?template=missing-catalog-model`,{waitUntil:'networkidle'});await page.locator('[data-model-invalid-template]').waitFor();await settle();assert.equal(await raw(),before);assert.equal(JSON.parse(await raw()).data.specCanvases.some(row=>row.templateId==='missing-catalog-model'),false)
  await page.goto(`${base}/specs?template=${modelId}&version=missing-version&mode=view`,{waitUntil:'networkidle'});await page.locator('[data-model-invalid-version]').waitFor();assert.equal(await page.locator(`.vue-flow__node[data-id="${nodeId}"]`).count(),0);await settle();assert.equal(await raw(),before)
  mark(`version/${strict}: missing model and invalid version fail closed; no canvas, ownership or snapshot is invented`)
  await context.close();await server.close();server=undefined
 }
 assert.deepEqual(errors,[]);console.log(`PASS catalog version browser ${groups} groups`)
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(0,7000));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
