import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const output=resolve(process.env.COMPATIBILITY_REFINEMENT_OUTPUT || 'work/compatibility-refinement/compatibility-browser')
const baseline=resolve(process.env.REFINEMENT_BASELINE || 'work/compatibility-refinement/baseline/source')
if(!existsSync(resolve(baseline,'src/components/template-compatibility/TemplateClaimSetEditor.vue')))throw new Error(`缺少开工前完整源码：${baseline}。请设置 REFINEMENT_BASELINE；不能用最终代码冒充基线。`)
mkdirSync(output,{recursive:true})
const servers=[],checks=[],captures=[],diagnostics=[]
let browser
const copy=value=>JSON.parse(JSON.stringify(value))
try{
  const final=await createServer({cacheDir:resolve(output,'final-cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});servers.push(final);await final.listen()
  const before=await createServer({root:baseline,cacheDir:resolve(output,'before-cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});servers.push(before);await before.listen()
  const {createTemplateCompatibilityFixture}=await final.ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  const {createRefinementSyncFixture}=await final.ssrLoadModule('/scripts/compatibility-refinement-sync-fixtures.ts')
  const {ensureProductListPages}=await final.ssrLoadModule('/src/domain/productListPages.ts')
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true})
  async function open(server,data,path,theme='light',viewport={width:1366,height:768}){
    const ctx=await browser.newContext({viewport,locale:'zh-CN',timezoneId:'Asia/Singapore',reducedMotion:'reduce'})
    await ctx.addInitScript(({data,theme})=>{if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}));localStorage.setItem('iyge-v2-theme',theme);window.__failSave=false;const native=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'&&window.__failSave){window.__failSave=false;throw new DOMException('refinement quota failure','QuotaExceededError')}return native.call(this,key,value)}},{data:copy(data),theme})
    const page=await ctx.newPage();page.setDefaultTimeout(15000)
    const source=server===before?'before':'after'
    page.on('pageerror',error=>diagnostics.push({source,viewport,theme,type:'error',message:String(error)}));page.on('console',message=>{if(['warning','error'].includes(message.type()))diagnostics.push({source,viewport,theme,type:message.type(),message:message.text()})})
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}${path}`,{waitUntil:'networkidle'})
    return {ctx,page}
  }
  const dialog=page=>page.locator('[data-template-compatibility-dialog]:visible')
  async function settle(page){await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))))}
  async function capture(page,name,phase='after'){await settle(page);await page.evaluate(()=>document.fonts.ready);const file=`${phase}-${name}.png`;await page.screenshot({path:resolve(output,file),animations:'disabled'});captures.push({phase,name,file,viewport:page.viewportSize()})}
  async function option(page,field,text,multiple=false){await page.waitForFunction(()=>!document.getAnimations().some(animation=>(animation.playState==='running'||animation.pending)&&Number.isFinite(animation.effect?.getComputedTiming().iterations)));await field.locator('.el-select__wrapper').click();await page.locator('.el-select-dropdown:visible [role="option"]').filter({hasText:text}).first().click();if(multiple)await field.locator('input').first().press('Escape');await page.locator('.el-select-dropdown:visible').waitFor({state:'hidden'});await settle(page)}
  async function disk(page){await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();await store.waitForPersistence?.()});return page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)}
  function mark(name,details={}){checks.push({name,result:'PASS',...details});console.log(`PASS compatibility refinement ${name}`)}
  async function tab(page,name){await dialog(page).getByRole('tab',{name,exact:true}).click();await settle(page)}
  const visual=createTemplateCompatibilityFixture({styles:2,colors:2,packs:1});visual.config.defaultRule.claims=Array.from({length:6},(_,index)=>({...visual.claim(`visual-${index}`,index%2?visual.hosts.b:visual.hosts.a),note:`第${index+1}条独立声明 · 长规格备注与可靠性验收`,capability:index%3===1?'fast-charge':'basic'}));ensureProductListPages(visual.data)
  const sizes=[{name:'1366-light',width:1366,height:768,theme:'light'},{name:'1920-light',width:1920,height:1080,theme:'light'},{name:'narrow-desktop',width:920,height:768,theme:'light'},{name:'375-light',width:375,height:812,theme:'light'},{name:'375-dark',width:375,height:812,theme:'dark'},{name:'125-equivalent-dark',width:1093,height:614,theme:'dark'}]
  for(const [phase,server] of [['before',before],['after',final]])for(const size of sizes){
    const {ctx,page}=await open(server,visual.data,`/specs?template=${visual.modelId}`,size.theme,{width:size.width,height:size.height})
    await page.locator('[data-open-template-compatibility]').click();await dialog(page).waitFor();await capture(page,`default-${size.name}`,phase)
    if(phase==='after'){
      assert.equal(await dialog(page).locator('[data-template-claim]:visible').count(),6)
      assert.equal(await dialog(page).locator('.claim-details').count(),0,'default rows stay compact')
      const bounds=await dialog(page).locator('[data-template-save]').boundingBox();assert(bounds&&bounds.y>=0&&bounds.y+bounds.height<=size.height,'primary action stays inside viewport')
      assert(await dialog(page).evaluate(element=>element.scrollWidth<=element.clientWidth+1),'dialog has no horizontal overflow')
      await dialog(page).locator('[data-template-expand]').first().click();assert.equal(await dialog(page).locator('.claim-details').count(),1);await capture(page,`expanded-${size.name}`,phase)
      await tab(page,'规格例外 1');await capture(page,`exception-${size.name}`,phase)
      await tab(page,'生效预览');assert.equal(await dialog(page).locator('[data-template-preview-row]').count(),4);await capture(page,`preview-${size.name}`,phase)
    }
    await ctx.close()
  }
  mark('before-after-visual-and-fixed-dialog',{sizes,notes:'125% uses 1366/1.25 × 768/1.25 CSS viewport, not a claim about native browser zoom; light/dark, long rows, expanded details, exceptions and result preview captured.'})

  const form=createTemplateCompatibilityFixture({styles:2,colors:2,packs:1});form.config.defaultRule.configured=true;form.config.defaultRule.claims=[];form.config.exceptions=[];ensureProductListPages(form.data)
  const editing=await open(final,form.data,`/specs?template=${form.modelId}`),page=editing.page
  await page.locator('[data-open-template-compatibility]').click();await dialog(page).waitFor();const untouched=await disk(page)
  for(const label of ['Orion A','Orion B'])await option(page,dialog(page).locator('[data-template-hosts]'),label,true)
  assert.match(await dialog(page).locator('[data-template-batch]').innerText(),/本批 2 款/)
  const unload=await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();const check=()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented};const dirty=check();store.persistenceState.discardConfirmed=true;const confirmed=check();store.persistenceState.discardConfirmed=false;return {dirty,confirmed}});assert.deepEqual(unload,{dirty:true,confirmed:false},'explicit read-latest confirmation must not trigger another unload confirmation')
  await dialog(page).locator('[data-template-save]').click();assert.match(await dialog(page).locator('[data-template-config-error]').innerText(),/尚未应用/);assert.deepEqual(await disk(page),untouched)
  await dialog(page).getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('dialog',{name:'未保存配置',exact:true}).waitFor();await page.getByRole('button',{name:'继续编辑',exact:true}).click();assert.match(await dialog(page).locator('[data-template-batch]').innerText(),/本批 2 款/)
  await dialog(page).getByRole('textbox',{name:'本批来源或依据',exact:true}).fill('独立测试批量核验资料')
  await dialog(page).locator('[data-template-add-hosts]').click();assert.equal(await dialog(page).locator('[data-template-claim]').count(),2);assert.equal(await dialog(page).locator('.claim-details').count(),0)
  assert.equal(await dialog(page).getByText('待确认',{exact:true}).count()>=2,true)
  assert.deepEqual(await disk(page),untouched,'batch and preview do not mutate persisted business data')
  const first=dialog(page).locator('[data-template-claim]').first();await first.locator('[data-template-expand]').click();await first.getByPlaceholder('填写真实依据；缺少核验时保留待确认').fill('');await first.locator('[data-template-expand]').click()
  await dialog(page).locator('[data-template-issue-summary]').click();assert.equal(await first.locator('.claim-details').count(),1)
  assert.equal(await first.getByPlaceholder('填写真实依据；缺少核验时保留待确认').evaluate(element=>element===document.activeElement),true)
  await capture(page,'source-error-focus');await first.getByPlaceholder('填写真实依据；缺少核验时保留待确认').fill('已修正的独立资料')
  await option(page,first.locator('.claim-grid').first().locator('.el-select').nth(1),'有条件适用');assert.equal(await first.locator('details.conditions').getAttribute('open')!==null,true)
  await first.getByRole('button',{name:'添加条件',exact:true}).click();await first.getByPlaceholder('填写真实使用条件').fill('独立测试：需搭配指定连接器')
  assert.match(await dialog(page).locator('[data-template-issue-summary]').innerText(),/0/)
  await dialog(page).locator('[data-template-save]').click();await settle(page);const saved=await disk(page);assert.equal(saved.templateCompatibilityConfigs[0].defaultRule.claims.length,2);assert.equal(saved.templateCompatibilityConfigs[0].defaultRule.claims[0].verification,'pending')
  await first.getByPlaceholder('填写真实依据；缺少核验时保留待确认').fill('失败时保留草稿');await page.evaluate(()=>{window.__failSave=true});await dialog(page).locator('[data-template-save]').click();await dialog(page).locator('[data-template-config-error]').waitFor();assert.equal(await first.getByPlaceholder('填写真实依据；缺少核验时保留待确认').inputValue(),'失败时保留草稿');assert.deepEqual(await disk(page),saved);await capture(page,'quota-error-keeps-input')
  await dialog(page).locator('[data-template-save]').click();await settle(page);assert.equal((await disk(page)).templateCompatibilityConfigs[0].defaultRule.claims[0].source,'失败时保留草稿')
  async function holdCommit(current){await current.evaluate(()=>{window.__refinementLocked=false;void navigator.locks.request('iyge-v2-mock-db:commit',async()=>{window.__refinementLocked=true;await new Promise(done=>{window.__releaseRefinementLock=done})})});await current.waitForFunction(()=>window.__refinementLocked)}
  await first.getByPlaceholder('填写真实依据；缺少核验时保留待确认').fill('受控互斥等待期间的草稿');await holdCommit(page);await dialog(page).locator('[data-template-save]').click()
  assert.equal(await first.getByPlaceholder('填写真实依据；缺少核验时保留待确认').isDisabled(),true);assert.equal(await dialog(page).locator('[data-template-default-state] input').isDisabled(),true)
  await tab(page,'规格例外 0');assert.equal(await dialog(page).locator('[data-template-add-exception]').isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await dialog(page).isVisible(),true)
  await page.evaluate(async()=>{await(await import('/src/router/index.ts')).default.push('/models')});assert.match(page.url(),/\/specs\?/)
  await page.evaluate(()=>window.__releaseRefinementLock());await page.waitForFunction(()=>!document.querySelector('[data-template-save]')?.classList.contains('is-loading'));assert.equal((await disk(page)).templateCompatibilityConfigs[0].defaultRule.claims[0].source,'受控互斥等待期间的草稿')
  await tab(page,'规格例外 0');await dialog(page).locator('[data-template-add-exception]').click();await option(page,dialog(page).locator('[data-template-exception-combinations]'),'款式 1',true);await dialog(page).getByRole('button',{name:'使用所选范围',exact:true}).click();await dialog(page).getByRole('button',{name:'复制默认配置',exact:true}).click();assert.equal(await dialog(page).locator('[data-template-claim]:visible').count(),2)
  async function exceptionCommand(label){await dialog(page).getByRole('button',{name:'更多操作',exact:false}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();await page.getByRole('button',{name:'确认修改草稿',exact:true}).click()}
  await exceptionCommand('这些规格不产生适用声明');await tab(page,'生效预览');assert.equal(await dialog(page).locator('[data-template-preview-state="empty"]').count(),1);await capture(page,'explicit-empty-override')
  await tab(page,'规格例外 1');await exceptionCommand('删除例外并恢复默认');await tab(page,'生效预览');assert.equal(await dialog(page).locator('[data-template-preview-state="configured"]').count(),4)
  await tab(page,'规格例外 0');await dialog(page).locator('[data-template-add-exception]').click();await option(page,dialog(page).locator('[data-template-hosts]:visible'),'Orion A',true);await dialog(page).locator('[data-template-add-exception]').click();await page.getByRole('dialog',{name:'尚未应用的批量输入',exact:true}).waitFor();await page.getByRole('button',{name:'继续填写',exact:true}).click();assert.match(await dialog(page).locator('[data-template-batch]:visible').innerText(),/本批 1 款/)
  mark('batch-unapplied-guard-structured-errors-conditional-focus-quota-retry-held-lock-and-empty-inheritance')
  await editing.ctx.close()

  for(const name of ['merge','split','protected']){
    const f=createRefinementSyncFixture(name==='merge'?['甲','乙']:['相同','相同']),version=f.publish(name==='merge'?['合并','合并']:['甲','乙'])
    if(name==='protected'){f.links()[0].note='人工修改保留';f.origins()[0].state='modified'}
    ensureProductListPages(f.data)
    const session=await open(final,f.data,'/compatibility'),current=session.page;await current.locator('[data-check-template-updates]').click();const sync=current.locator('[data-template-sync-dialog]:visible');await sync.waitFor()
    await option(current,sync.locator('[data-template-sync-targets]'),'REFINEMENT-SYNC-SKU',true);const prior=await disk(current)
    await sync.locator('[data-template-sync-preview]').click();assert.equal(await sync.locator('[data-template-sync-state="conflict"]').count(),1);assert.equal(await sync.locator('[data-template-sync-apply]').isDisabled(),true)
    await sync.getByRole('button',{name:'采用全部安全变更',exact:true}).click();assert.equal(await sync.locator('[data-template-sync-apply]').isDisabled(),true,'safe all never adopts a protected/group result')
    assert.deepEqual(await disk(current),prior,'preview is read only')
    await capture(current,`sync-${name}`)
    if(name==='protected'){
      assert.equal(await sync.getByText('采用这组模板结果',{exact:true}).count(),0);await sync.getByRole('button',{name:'维护此商品声明',exact:true}).click();await sync.waitFor({state:'hidden'});assert.match(current.url(),/manage=refinement-sync-sku/)
      await current.locator(`[data-declaration-id="${f.links()[0].id}"]`).getByRole('button',{name:'编辑声明',exact:true}).click();const editor=current.locator('[data-declaration-editor]:visible');await editor.locator('[data-declaration-note]').fill('锁等待期间保留并准确保存的人工内容');await editor.locator('[data-preview-compatibility]').click();await holdCommit(current);await editor.locator('[data-confirm-compatibility]').click();assert.equal(await editor.locator('[data-declaration-note]').isDisabled(),true);assert.equal(await editor.getByRole('button',{name:'取消',exact:true}).isDisabled(),true);await current.keyboard.press('Escape');assert.equal(await editor.isVisible(),true);await current.evaluate(()=>window.__releaseRefinementLock());await editor.waitFor({state:'hidden'});assert.equal((await disk(current)).compatibilities.find(link=>link.id===f.links()[0].id).note,'锁等待期间保留并准确保存的人工内容')
    }
    else{
      await sync.getByText('采用这组模板结果',{exact:true}).click();await holdCommit(current);await sync.locator('[data-template-sync-apply]').click();assert.equal(await sync.locator('[data-template-sync-model] input').isDisabled(),true);await current.keyboard.press('Escape');assert.equal(await sync.isVisible(),true);await current.evaluate(()=>window.__releaseRefinementLock());await sync.locator('[data-template-sync-receipt]').waitFor();const result=await disk(current),links=result.compatibilities.filter(link=>link.targetId===f.sku.id)
      assert.deepEqual(links.map(link=>link.note),name==='merge'?['合并']:['甲','乙']);assert.match(await sync.locator('[data-template-sync-receipt]').innerText(),name==='merge'?/新增 1 条.*移除 2 条/:/新增 2 条.*移除 1 条/)
      await option(current,sync.locator('[data-template-sync-filter]'),'保持不变');assert.equal(await sync.locator('[data-template-sync-state="unchanged"]').count(),name==='merge'?1:2)
      assert.equal(result.specModelVersions.find(item=>item.id===f.versionId).templateCompatibilitySnapshot.config.defaultRule.claims[0].note,name==='merge'?'甲':'相同','historical snapshot remains unchanged')
      assert.equal(result.specModelVersions.some(item=>item.id===version),true)
    }
    await session.ctx.close()
  }
  mark('real-ui-merge-split-group-adoption-counts-protection-filter-and-history')
  const allowed='[Vue Flow]: The options parameter is deprecated and will be removed in the next major version. Please use the id parameter instead'
  const existingSizeWarning='[Vue Flow]: The Vue Flow parent container needs a width and a height to render the graph'
  assert(diagnostics.every(item=>item.type==='warning'&&(item.message===allowed||item.message===existingSizeWarning&&(item.source==='before'||diagnostics.some(prior=>prior.source==='before'&&prior.message===item.message&&prior.viewport.width===item.viewport.width&&prior.viewport.height===item.viewport.height&&prior.theme===item.theme)))),JSON.stringify(diagnostics))
  writeFileSync(resolve(output,'result.json'),JSON.stringify({result:'PASS',browser:browser.version(),baseline,checks,captures,diagnostics},null,2))
}catch(error){writeFileSync(resolve(output,'failure.json'),JSON.stringify({result:'FAIL',error:String(error),stack:error.stack,checks,captures,diagnostics},null,2));throw error}
finally{await browser?.close();for(const server of servers)await server.close()}
