import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const output = resolve(process.env.TEMPLATE_BROWSER_OUTPUT || 'work/template-compatibility/browser')
mkdirSync(output, {recursive:true})
const server = await createServer({cacheDir:resolve(output,'vite-cache'),server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}})
const checkpoints=[],diagnostics=[],screenshots=[]
let browser,page
const copy=value=>JSON.parse(JSON.stringify(value))
try {
  const {createTemplateCompatibilityFixture}=await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  const {ensureProductListPages}=await server.ssrLoadModule('/src/domain/productListPages.ts')
  const fixture=createTemplateCompatibilityFixture({styles:2,colors:2,packs:1}),{data,modelId,hosts}=fixture
  data.templateCompatibilityConfigs=[];data.templateCompatibilityOrigins=[];data.specModelVersions=[]
  data.nodeCompatibilityRules=[{id:'browser-legacy-style',templateId:modelId,nodeId:'compat-style-0',modelVersionId:'',hosts:[copy(hosts.a)],updatedAt:'2026-10-23T04:00:00.000Z'}]
  ensureProductListPages(data)
  data.productListPages.sku.activeId='sku-system-all';data.productListPages.sku.skuWorkbench.activeId='sku-system-all';data.productListPages.sku.skuWorkbench.defaultId='sku-system-all';data.productListPages.sku.query.pageSize=50
  await server.listen()
  const base=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true}).catch(cause=>{throw new Error('Template browser checks need installed Chrome or BROWSER_CHANNEL. Missing browser is a failure, not a skipped pass.',{cause})})
  async function context(name,path=`/specs?template=${modelId}`,initial=data,options={}) {
    const ctx=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN',timezoneId:'Asia/Singapore',reducedMotion:'reduce',...options})
    await ctx.addInitScript(data=>{
      const RealDate=Date,epoch=RealDate.parse('2026-10-23T09:00:00.000Z')
      window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[epoch]))}static now(){return epoch}}
      if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}))
      if(!localStorage.getItem('iyge-v2-theme'))localStorage.setItem('iyge-v2-theme','light')
      window.__tcWrites=[];window.__tcFailNext=false
      const set=Storage.prototype.setItem
      Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__tcFailNext){window.__tcFailNext=false;throw new DOMException('独立模板兼容存储失败注入','QuotaExceededError')}window.__tcWrites.push(value)}return set.call(this,key,value)}
    },copy(initial))
    const current=await ctx.newPage();current.setDefaultTimeout(15000)
    current.on('pageerror',error=>diagnostics.push({context:name,type:'pageerror',message:String(error)}))
    current.on('console',message=>{if(['error','warning'].includes(message.type()))diagnostics.push({context:name,type:message.type(),message:message.text()})})
    await current.goto(base+path,{waitUntil:'networkidle'});return{ctx,page:current}
  }
  const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const disk=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const writes=()=>page.evaluate(()=>window.__tcWrites.length)
  const flush=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const dialog=()=>page.locator('[data-template-compatibility-dialog]:visible')
  const sourceInput=()=>dialog().locator('input[placeholder="填写真实依据；缺少核验时保留待确认"]:visible')
  const manager=()=>page.locator('[data-compatibility-manager]:visible')
  const sync=()=>page.locator('[data-template-sync-dialog]:visible')
  const check=async(name,detail={})=>{checkpoints.push({name,...detail});console.log(`PASS template browser ${name}`)}
  const capture=async name=>{await flush();await page.screenshot({path:resolve(output,`${name}.png`),animations:'disabled'});screenshots.push(`${name}.png`)}
  async function navigate(path){await page.evaluate(async path=>(await import('/src/router/index.ts')).default.push(path),path);await page.waitForURL(base+path);await flush()}
  async function settled(){await page.waitForFunction(()=>!document.getAnimations().some(animation=>(animation.playState==='running'||animation.pending)&&Number.isFinite(animation.effect?.getComputedTiming().iterations)))}
  async function option(field,text,multiple=false){await settled();await field.locator('.el-select__suffix').click();await page.locator('.el-select-dropdown:visible [role="option"]').filter({hasText:text}).first().click();if(multiple)await field.locator('input').first().press('Escape');await page.locator('.el-select-dropdown:visible').waitFor({state:'hidden'});await settled();await flush()}
  async function openConfig(){await page.locator('[data-open-template-compatibility]').click();await dialog().waitFor();const row=dialog().locator('[data-template-claim]:visible').first();if(await row.count()&&!(await row.locator('input[placeholder="填写真实依据；缺少核验时保留待确认"]').count()))await row.locator('[data-template-expand]').click()}
  async function exceptionAction(label){await dialog().getByRole('button',{name:'更多操作',exact:false}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();await page.getByRole('button',{name:'确认修改草稿',exact:true}).click()}
  async function tab(name){await dialog().getByRole('tab',{name,exact:true}).click();await flush()}
  async function addHost(name,source){await option(dialog().locator('[data-template-hosts]:visible'),name,true);await dialog().locator('[data-template-add-hosts]:visible').click();const row=dialog().locator('[data-template-claim]:visible').last();await option(row.locator('.claim-grid').first().locator('.el-select').nth(2),'已确认');await row.getByPlaceholder('填写真实依据；缺少核验时保留待确认').fill(source);return row}
  async function closeConfig(){await dialog().getByRole('button',{name:'取消',exact:true}).click();if(await page.getByRole('dialog',{name:'未保存配置',exact:true}).isVisible())await page.getByRole('button',{name:'放弃修改',exact:true}).click();await dialog().waitFor({state:'hidden'})}
  async function saveConfig(expectedWrites=1){const n=await writes();await dialog().locator('[data-template-save]').click();await flush();assert.equal(await dialog().locator('[data-template-config-error]').count(),0);assert.equal(await writes(),n+expectedWrites,'changed config writes once; explicit unchanged config does not write');assert.deepEqual(JSON.parse(await disk()).data,await read());return(await read()).templateCompatibilityConfigs.find(item=>item.modelId===modelId)}

  const main=await context('main');page=main.page
  await page.locator('[data-open-template-compatibility]').waitFor()
  await openConfig();await option(dialog().locator('[data-template-default-state]'),'已明确配置')
  await addHost('Orion A','【独立浏览器测试】默认壳适用设备A的核验资料')
  await capture('default-draft-light')
  const beforeSave=await read(),beforeDisk=await disk(),beforeWrites=await writes()
  await page.evaluate(()=>{window.__tcFailNext=true});await dialog().locator('[data-template-save]').click();await flush()
  assert.match(await dialog().locator('[data-template-config-error]').innerText(),/保存|本机|存储/)
  assert.deepEqual(await read(),beforeSave);assert.equal(await disk(),beforeDisk);assert.equal(await writes(),beforeWrites)
  assert.equal(await sourceInput().inputValue(),'【独立浏览器测试】默认壳适用设备A的核验资料')
  const defaultConfig=await saveConfig();assert.equal(defaultConfig.defaultRule.claims[0].verification,'confirmed')
  assert.deepEqual((await read()).nodeCompatibilityRules,beforeSave.nodeCompatibilityRules)
  await closeConfig();await page.reload({waitUntil:'networkidle'});await openConfig()
  assert.equal(await sourceInput().inputValue(),'【独立浏览器测试】默认壳适用设备A的核验资料')
  await check('default-ui-save-quota-no-half-write-retry-one-write-refresh')

  const beforePreview=await read(),previewDisk=await disk(),previewWrites=await writes()
  await tab('生效预览');assert.equal(await dialog().locator('[data-template-preview-state="configured"]').count(),4)
  await dialog().getByPlaceholder('搜索组合规格或适用设备型号').fill('Orion A');assert.equal(await dialog().locator('[data-template-preview-row]').count(),4)
  await capture('effective-preview-default')
  assert.deepEqual(await read(),beforePreview);assert.equal(await disk(),previewDisk);assert.equal(await writes(),previewWrites);assert.equal((await read()).planningRecords.length,0)
  await tab('旧节点工具 1');await dialog().locator('.legacy-summary').click();await dialog().locator('[data-template-legacy-rule] .el-checkbox').click();await dialog().locator('[data-template-convert-legacy]').click()
  assert.match(await dialog().innerText(),/尚未保存|已转换/);await tab('规格例外 1');assert.match(await dialog().innerText(),/待确认/)
  assert.deepEqual(await read(),beforePreview);await closeConfig();assert.deepEqual(await read(),beforePreview)
  await check('readonly-preview-search-no-number-no-record-writes-and-legacy-pending-conversion-cancel')

  await page.locator('.vue-flow__node[data-id="compat-style-0"]').click();await page.getByRole('button',{name:'节点适用配置',exact:true}).click();await dialog().waitFor()
  assert.match(await dialog().locator('[data-template-exception-scope]').innerText(),/2 个合法组合/)
  await addHost('Orion B','【独立浏览器测试】款式1改用设备B，完整替换默认')
  const configured=await saveConfig();assert.equal(configured.exceptions.length,1);assert.equal(configured.exceptions[0].claims[0].host.productModelId,'device:model-b')
  await tab('生效预览');assert.equal(await dialog().locator('[data-template-preview-state="configured"]').count(),4)
  const rows=await dialog().locator('[data-template-preview-row]').allTextContents();assert.equal(rows.filter(text=>text.includes('Orion B')).length,2);assert.equal(rows.filter(text=>text.includes('Orion A')).length,2)
  await tab('规格例外 1');await dialog().locator('[data-template-add-exception]').click()
  await option(dialog().locator('[data-template-exception-combinations]'),'款式 1 · 颜色 色彩 1',true).catch(async()=>{await page.keyboard.press('Escape');await option(dialog().locator('[data-template-exception-combinations]'),'色彩 1',true)})
  await dialog().getByRole('button',{name:'使用所选范围',exact:true}).click();await addHost('Orion A','【独立浏览器测试】仅用于冲突预览，不保存')
  await tab('生效预览');assert.equal(await dialog().locator('[data-template-preview-state="conflict"]').count(),1)
  await capture('exception-conflict-preview')
  await tab('规格例外 2');await exceptionAction('删除例外并恢复默认');await saveConfig(0)
  const beforeEmpty=await read();await exceptionAction('这些规格不产生适用声明');await tab('生效预览');assert.equal(await dialog().locator('[data-template-preview-state="empty"]').count(),2);assert.deepEqual(await read(),beforeEmpty);await closeConfig()
  assert.equal((await read()).nodeCompatibilityRules.length,1)
  await check('node-shortcut-shared-editor-structural-range-full-replacement-conflict-no-priority-resolution')

  const beforePublish=await read(),publishWrites=await writes();await page.getByRole('button',{name:'发布模型',exact:true}).click();await flush()
  let current=await read(),versions=current.specModelVersions.filter(item=>item.templateId===modelId);assert.equal(versions.length,1);assert.equal(current.planningRecords.length,4);assert.equal(await writes(),publishWrites+1)
  const version1=copy(versions[0]);assert.ok(version1.templateCompatibilitySnapshot);assert.deepEqual(current.productSpecNodes,beforePublish.productSpecNodes)
  const setup=await page.evaluate(async({modelId,versionId})=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();return store.saveSpu({id:'',name:'【独立浏览器测试】兼容工作台SPU',templateId:modelId,productModelId:modelId,modelVersionId:versionId,productTypeId:'type-case',categoryId:'cat-accessory-test',oaProductId:'',commonAttrs:{包装:'包装 1'},productGroupIds:[],lifecycle:'ready',shelfStatus:'online',line:'v2',origin:'created',createdAt:'2026-10-23T09:00:00.000Z',updatedAt:'2026-10-23T09:00:00.000Z'})},{modelId,versionId:version1.id})
  assert.equal(setup.ok,true,JSON.stringify(setup));const familyId=(await read()).families.find(item=>item.name==='【独立浏览器测试】兼容工作台SPU').id
  await navigate(`/skus/new?spu=${familyId}&template=${modelId}`);await page.getByRole('button',{name:'预览规格',exact:true}).click();await page.locator('[data-sku-template-summary]').waitFor();assert.match(await page.locator('[data-candidate-count]').innerText(),/可新增 4 条/)
  const beforeCreate=await read(),createDisk=await disk(),createWrites=await writes();await page.evaluate(()=>{window.__tcFailNext=true});await page.getByRole('button',{name:'确认新增 4 条 SKU',exact:true}).click();await flush();assert.deepEqual(await read(),beforeCreate);assert.equal(await disk(),createDisk);assert.equal(await writes(),createWrites)
  await page.getByRole('button',{name:'确认新增 4 条 SKU',exact:true}).click();await page.locator('[data-sku-workbench]').waitFor();await flush();current=await read()
  const created=current.skus.filter(item=>item.familyId===familyId);assert.equal(created.length,4);const createdIds=created.map(item=>item.id),createdLinks=current.compatibilities.filter(item=>createdIds.includes(item.targetId));assert.equal(createdLinks.length,4);writeFileSync(resolve(output,'create-transactions.json'),JSON.stringify(await page.evaluate(index=>window.__tcWrites.slice(index).map(value=>JSON.parse(value)),createWrites),null,2));assert.equal(await writes(),createWrites+1)
  for(const sku of created){const link=createdLinks.find(item=>item.targetId===sku.id);assert.equal(link.provenance.kind,'template');assert.equal(link.provenance.template.sourceVersionId,version1.id);assert.equal(link.host.productModelId,sku.variantAttrs.款式==='款式 1'?'device:model-b':'device:model-a')}
  assert.deepEqual(current.specModelVersions[0],version1);await page.reload({waitUntil:'networkidle'});assert.equal((await read()).skus.filter(item=>item.familyId===familyId).length,4)
  await check('publish-frozen-config-one-write-real-ui-create-four-sku-quota-retry-and-per-spec-formal-relations',{setup:'Only SPU identity/common attributes prepared through store.saveSpu after UI publish; SKU generation and save performed through UI.'})

  const accessoryId=created[0].id;await page.locator(`[data-open-compatibility="${accessoryId}"]`).click();await page.locator('[data-accessory-drawer]').waitFor();assert.match(await page.locator('[data-reverse-count]').innerText(),/1 个型号/);assert.equal(await page.locator('[data-template-source]:visible').count(),1)
  await capture('reverse-template-source');await page.getByRole('button',{name:'Close this dialog',exact:true}).last().click().catch(async()=>{await page.keyboard.press('Escape')});await page.locator('[data-accessory-drawer]').waitFor({state:'hidden'})
  await navigate('/skus');await page.getByRole('textbox',{name:'在当前视图中搜索'}).fill('phone');await page.locator('[data-open-compatibility="phone-a"]').click();await page.locator('[data-accessory-drawer]').waitFor()
  await page.getByRole('tab',{name:/非在售/}).click();const expectedA=created.filter(item=>item.variantAttrs.款式==='款式 2').map(item=>item.id)
  for(const id of expectedA)assert.equal(await page.locator(`[data-accessory-match="${id}"]`).count(),1)
  for(const id of created.filter(item=>item.variantAttrs.款式==='款式 1').map(item=>item.id))assert.equal(await page.locator(`[data-accessory-match="${id}"]`).count(),0)
  await capture('forward-template-matches');await page.keyboard.press('Escape');await page.locator('[data-accessory-drawer]').waitFor({state:'hidden'})
  await check('same-formal-relations-forward-device-and-reverse-accessory-with-source-version')

  await navigate(`/specs?template=${modelId}`);await page.getByRole('button',{name:'管理合法组合',exact:true}).click();const combos=page.getByRole('dialog',{name:'合法组合管理',exact:true});await combos.waitFor()
  for(let index=0;index<2;index++){await combos.locator('.combo-table .el-table__row').first().getByRole('button',{name:'单条创建',exact:true}).click();const material=page.getByRole('dialog',{name:'创建物料',exact:true});await material.waitFor();await material.locator('input').first().fill(`【独立浏览器测试】同规划物料 ${index+1}`);assert.match(await material.locator('[data-material-template-summary]').innerText(),/V1.*MAT.*Orion B/);await material.getByRole('button',{name:'确认创建',exact:true}).click();await material.waitFor({state:'hidden'})}
  current=await read();const materials=current.skus.filter(item=>item.recordKind==='material'&&item.skuName?.startsWith('【独立浏览器测试】同规划物料'));assert.equal(materials.length,2);assert.equal(materials[0].planningId,materials[1].planningId);assert.notEqual(materials[0].id,materials[1].id);for(const item of materials)assert.equal(current.compatibilities.filter(link=>link.targetKind==='material'&&link.targetId===item.id).length,1)
  await capture('two-mat-one-planning');await combos.getByRole('button',{name:'关闭',exact:true}).click();await check('real-ui-two-independent-materials-same-planning-each-own-template-declaration')

  await navigate('/compatibility');await manager().waitFor();await page.getByRole('textbox',{name:'搜索兼容声明'}).fill('兼容工作台SPU')
  // Search by generated identifier instead of relying on the SKU display name.
  await page.getByRole('textbox',{name:'搜索兼容声明'}).fill(created[0].code)
  const firstLink=(await read()).compatibilities.find(item=>item.targetId===created[0].id);await manager().locator(`[data-declaration-id="${firstLink.id}"]`).getByRole('button',{name:'编辑声明',exact:true}).click();const editor=page.locator('[data-declaration-editor]:visible');await editor.locator('[data-declaration-note]').fill('【独立浏览器测试】人工备注保护');await editor.locator('[data-preview-compatibility]').click();await editor.locator('[data-confirm-compatibility]').click();await editor.waitFor({state:'hidden'})
  await page.getByRole('textbox',{name:'搜索兼容声明'}).fill(created[1].code);const secondLink=(await read()).compatibilities.find(item=>item.targetId===created[1].id);await manager().locator(`[data-declaration-id="${secondLink.id}"]`).getByRole('button',{name:'取消声明',exact:true}).click();await page.locator('[data-confirm-compatibility]').click();await page.locator('[data-declaration-editor]').waitFor({state:'hidden'})
  current=await read();assert.equal(current.compatibilities.find(item=>item.id===firstLink.id).note,'【独立浏览器测试】人工备注保护');assert.equal(current.compatibilities.some(item=>item.id===secondLink.id),false);assert.equal(current.templateCompatibilityOrigins.find(item=>item.declarationId===secondLink.id).state,'deleted')
  await check('existing-manager-manual-edit-and-delete-create-per-claim-protection')

  await navigate(`/specs?template=${modelId}`);await openConfig();await sourceInput().fill('【独立浏览器测试】V2 新核验资料');await saveConfig();await closeConfig();const beforeV2=await read();await page.getByRole('button',{name:'发布模型',exact:true}).click();await flush();current=await read();versions=current.specModelVersions.filter(item=>item.templateId===modelId);assert.equal(versions.length,2);const version2=versions.find(item=>item.id!==version1.id);assert.deepEqual(current.specModelVersions.find(item=>item.id===version1.id),version1);assert.deepEqual(current.skus,beforeV2.skus);assert.deepEqual(current.compatibilities,beforeV2.compatibilities)
  await navigate('/compatibility');await manager().locator('[data-check-template-updates]').click();await sync().waitFor();await option(sync().locator('[data-template-sync-model]'),'兼容配置模型');for(const sku of created)await option(sync().locator('[data-template-sync-targets]'),sku.skuName,true);await sync().locator('[data-template-sync-preview]').click()
  assert.ok(await sync().locator('[data-template-sync-state="protected"]').count()>=2);await capture('sync-three-way-protected')
  const beforeSync=await read(),syncDisk=await disk(),syncWrites=await writes();await page.evaluate(()=>{window.__tcFailNext=true});await sync().locator('[data-template-sync-apply]').click();await flush();assert.deepEqual(await read(),beforeSync);assert.equal(await disk(),syncDisk);assert.equal(await writes(),syncWrites);assert.match(await sync().locator('[data-template-sync-error]').innerText(),/保存|本机|存储/)
  await sync().locator('[data-template-sync-apply]').click();await flush();current=await read();assert.equal(await writes(),syncWrites+1);assert.equal(current.compatibilities.find(item=>item.id===firstLink.id).note,'【独立浏览器测试】人工备注保护');assert.equal(current.compatibilities.some(item=>item.id===secondLink.id),false);assert.equal(current.skus.find(item=>item.id===created[0].id).modelVersionId,version1.id)
  const managed=current.templateCompatibilityOrigins.filter(item=>createdIds.includes(item.target.id)&&item.state==='managed');assert.ok(managed.length>=2);assert.equal(managed.every(item=>item.sourceVersionId===version2.id),true);assert.deepEqual(current.specModelVersions.find(item=>item.id===version1.id),version1)
  await page.reload({waitUntil:'networkidle'});current=await read();assert.equal(current.compatibilities.some(item=>item.id===secondLink.id),false);assert.equal(current.compatibilities.find(item=>item.id===firstLink.id).note,'【独立浏览器测试】人工备注保护')
  await check('compatibility-only-new-version-explicit-three-way-sync-quota-retry-protects-manual-and-deleted-history-refresh')

  await navigate(`/specs?template=${modelId}`);await openConfig();await sourceInput().fill('【独立浏览器测试】取消未保存输入');await page.keyboard.press('Escape');const dirtyDialog=page.getByRole('dialog',{name:'未保存配置',exact:true});await dirtyDialog.waitFor();await dirtyDialog.getByRole('button',{name:'继续编辑',exact:true}).click();assert.equal(await sourceInput().inputValue(),'【独立浏览器测试】取消未保存输入');await closeConfig();assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-open-template-compatibility')),true)
  await openConfig();await closeConfig();await navigate('/models');await navigate(`/specs?template=${modelId}`);assert.equal(await page.locator('.vue-flow').count(),1);await page.locator('.vue-flow__node[data-id="compat-style-0"]').click();const nodeBefore=(await read()).productSpecNodes.length;await openConfig();await sourceInput().press('Tab');assert.equal((await read()).productSpecNodes.length,nodeBefore);await closeConfig();await check('escape-unsaved-continue-cancel-focus-route-return-single-canvas-keyboard-isolation')

  await navigate('/models');const beforeCopy=await read();await page.getByRole('button',{name:'复制模型',exact:true}).first().click();await flush();const copied=(await read()).specCanvases.find(item=>!beforeCopy.specCanvases.some(old=>old.templateId===item.templateId));assert.ok(copied);const copiedConfig=(await read()).templateCompatibilityConfigs.find(item=>item.modelId===copied.templateId);assert.ok(copiedConfig);assert.notEqual(copiedConfig.defaultRule.id,(await read()).templateCompatibilityConfigs.find(item=>item.modelId===modelId).defaultRule.id)
  await navigate(`/specs?template=${modelId}`);await openConfig();await sourceInput().fill('【独立浏览器测试】切换前未保存草稿');await page.evaluate(async template=>{void(await import('/src/router/index.ts')).default.push(`/specs?template=${template}`)},copied.templateId);const switchGuard=page.getByRole('dialog',{name:'未保存配置',exact:true});await switchGuard.waitFor();await switchGuard.getByRole('button',{name:'继续编辑',exact:true}).click();assert.equal(await sourceInput().inputValue(),'【独立浏览器测试】切换前未保存草稿');assert.match(await dialog().innerText(),/仍属于该模型/);await closeConfig();await openConfig();assert.match(await dialog().innerText(),/副本/);await closeConfig();await check('model-copy-deep-independent-config-and-switch-unsaved-context-guard')
  await navigate(`/specs?template=${modelId}`);const stable=await read()
  const denialData=copy(stable),deniedSku=created[2];denialData.compatibilities.push({id:'browser-explicit-manual-denial',accessorySkuId:deniedSku.id,targetKind:'sku',targetId:deniedSku.id,host:copy(hosts.a),conclusion:'incompatible',verification:'confirmed',capability:'basic',conditions:[],source:'【独立浏览器测试】人工明确拒绝依据',note:'采用模板之前必须逐条显示并明确确认',provenance:{kind:'manual',detail:'独立测试人工拒绝'},createdAt:'2026-10-23T09:00:00.000Z',updatedAt:'2026-10-23T09:00:00.000Z'});const denial=await context('explicit-manual-denial','/compatibility',denialData);page=denial.page;await manager().locator('[data-check-template-updates]').click();await sync().waitFor();await option(sync().locator('[data-template-sync-model]'),'兼容配置模型');await option(sync().locator('[data-template-sync-targets]'),deniedSku.skuName,true);await sync().locator('[data-template-sync-preview]').click();const denialRow=sync().locator('[data-template-sync-state="protected"]').first();assert.match(await denialRow.locator('[data-template-sync-manual-denial]').innerText(),/将取消以下人工不兼容声明.*|人工明确拒绝依据/s);assert.equal(await denialRow.getByRole('radio',{name:'采用目标模板结果',exact:true}).count(),0);assert.equal((await read()).compatibilities.some(item=>item.id==='browser-explicit-manual-denial'),true);await capture('manual-denial-explicit-preview');assert.equal((await read()).compatibilities.find(item=>item.id===firstLink.id).note,'【独立浏览器测试】人工备注保护');await denial.ctx.close();await check('manual-denial-protected-no-template-override')
  const large=createTemplateCompatibilityFixture({styles:3,colors:5,packs:1}).data;ensureProductListPages(large);const paged=await context('paged-preview',`/specs?template=${modelId}`,large);page=paged.page;await openConfig();const pagedBefore=await read(),pagedDisk=await disk();await tab('生效预览');const firstPage=await dialog().locator('[data-template-preview-row]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-template-preview-row')));assert.equal(firstPage.length,12);await dialog().locator('.el-pagination .btn-next').click();const secondPage=await dialog().locator('[data-template-preview-row]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-template-preview-row')));assert.equal(secondPage.length,3);assert.equal(new Set([...firstPage,...secondPage]).size,15);await dialog().getByPlaceholder('搜索组合规格或适用设备型号').fill('Orion B');assert.equal(await dialog().locator('[data-template-preview-row]').count(),5);assert.deepEqual(await read(),pagedBefore);assert.equal(await disk(),pagedDisk);await capture('paged-preview-device-search');await closeConfig();await paged.ctx.close();await check('fifteen-combinations-paginated-without-truncation-and-device-model-search-pure')
  for(const scenario of[{name:'light',viewport:{width:1366,height:768}},{name:'dark',viewport:{width:1366,height:768},dark:true},{name:'narrow-780',viewport:{width:780,height:900}},{name:'equivalent-125-percent',viewport:{width:1093,height:614},deviceScaleFactor:1.25}]){
    const visual=await context(scenario.name,`/specs?template=${modelId}`,stable,{viewport:scenario.viewport,deviceScaleFactor:scenario.deviceScaleFactor||1});page=visual.page
    if(scenario.dark){await page.evaluate(()=>localStorage.setItem('iyge-v2-theme','dark'));await page.reload({waitUntil:'networkidle'})}
    await openConfig();await capture(`config-${scenario.name}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await dialog().locator('[data-template-save]').scrollIntoViewIfNeeded();assert.equal(await dialog().locator('[data-template-save]').isVisible(),true);await closeConfig();await visual.ctx.close()
  }
  await check('visual-light-dark-780-equivalent-125-footer-reachable-no-page-overflow')
  const viewing=await context('viewing',`/specs?template=${modelId}&mode=view`,stable);page=viewing.page;await openConfig();assert.equal(await dialog().locator('[data-template-save]').count(),0);assert.equal(await sourceInput().isDisabled(),true);await tab('生效预览');assert.equal(await dialog().locator('[data-template-preview-row]').count(),4);await capture('view-mode-readonly-config');await viewing.ctx.close()
  const readonly=copy(stable);readonly.activeRole='operator';const operator=await context('operator',`/specs?template=${modelId}`,readonly);page=operator.page;assert.equal(new URL(page.url()).pathname,'/','existing operator designer route gate preserved');await navigate('/compatibility');await manager().waitFor();assert.equal(await manager().getByRole('button',{name:'新增声明',exact:true}).count(),0);assert.equal(await manager().getByRole('button',{name:'编辑声明',exact:true}).count(),0);await manager().locator('[data-check-template-updates]').click();await sync().waitFor();assert.equal(await sync().locator('[data-template-sync-apply]').isDisabled(),true);const operatorBefore=await read(),operatorDisk=await disk();const denied=await page.evaluate(async modelId=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();return store.saveTemplateCompatibility(JSON.parse(JSON.stringify(store.data.templateCompatibilityConfigs.find(item=>item.modelId===modelId))))},modelId);assert.equal(denied.ok,false);assert.deepEqual(await read(),operatorBefore);assert.equal(await disk(),operatorDisk);await operator.ctx.close();await check('view-config-readonly-operator-route-gate-manager-readonly-direct-command-denied-no-writes')
  await main.ctx.close()
  const knownWarning='[Vue Flow]: The options parameter is deprecated and will be removed in the next major version. Please use the id parameter instead'
  const blockers=diagnostics.filter(item=>item.type!=='warning'||item.message!==knownWarning)
  assert.deepEqual(blockers,[],'Only the exact independently observed baseline warning is allowed')
  const objectIds=new Set([...createdIds,...materials.map(item=>item.id)])
  const business={versions:stable.specModelVersions.filter(item=>item.templateId===modelId),planningRecords:stable.planningRecords.filter(item=>item.productModelId===modelId),skus:stable.skus.filter(item=>objectIds.has(item.id)),compatibilities:stable.compatibilities.filter(item=>objectIds.has(item.targetId)),origins:(stable.templateCompatibilityOrigins||[]).filter(item=>objectIds.has(item.target.id))}
  writeFileSync(resolve(output,'business-final.json'),JSON.stringify(business,null,2)+'\n')
  writeFileSync(resolve(output,'result.json'),JSON.stringify({result:'PASS',completedAt:new Date().toISOString(),browser:browser.version(),fixture:{modelId,nodes:data.productSpecNodes.length,depth:4,combinations:4,realDeviceModels:2},business:{skuIds:createdIds,materialIds:materials.map(item=>item.id),planningIds:business.planningRecords.map(item=>item.planningId),versionIds:business.versions.map(item=>item.id),formalDeclarations:business.compatibilities.length,originStates:business.origins.map(item=>({target:item.target,state:item.state,sourceVersionId:item.sourceVersionId})),detail:'business-final.json'},checkpoints,diagnostics,screenshots,environment:{node:process.version,viewport:'1366x768',time:'2026-10-23T09:00:00.000Z'},scope:'Independent contexts; no everyday browser storage touched; native OS printing and real Excel not part of this feature.'},null,2)+'\n')
  console.log(`PASS ${checkpoints.length} template compatibility browser checkpoints`)
}catch(error){if(page&&!page.isClosed()){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});writeFileSync(resolve(output,'failure.html'),await page.content())}writeFileSync(resolve(output,'failure.json'),JSON.stringify({result:'FAIL',error:String(error),checkpoints,diagnostics,screenshots},null,2)+'\n');throw error}
finally{await browser?.close();await server.close()}
