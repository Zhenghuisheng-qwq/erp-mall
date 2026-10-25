import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
const out=resolve(process.env.R02_BROWSER_OUTPUT||'work/r02-20261025/browser');mkdirSync(out,{recursive:true})
const server=await createServer({cacheDir:resolve(out,'cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null,open:false}})
let browser,page;const checks=[],errors=[]
try{
  const {r02Fixture}=await server.ssrLoadModule('/scripts/r02-fixture.ts');const f=r02Fixture(false)
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1600,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
  await context.addInitScript(data=>{if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}));const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='iyge-v2-mock-db'&&window.__failR02)throw new DOMException('R02 quota','QuotaExceededError');return set.call(this,k,v)}},f.data)
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)))
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
  const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const btn=(name,scope=page)=>scope.getByRole('button',{name,exact:true})
  const mark=name=>{checks.push(name);console.log('PASS R02 browser '+name)}
  const pick=async(label,text,scope=page)=>{await scope.locator('.el-select').filter({has:page.getByRole('combobox',{name:label,exact:true})}).click();await page.getByRole('option',{name:text,exact:true}).click();await page.keyboard.press('Escape')}
  const node=async id=>{await page.locator(`.vue-flow__node[data-id="${id}"] .model-value`).click();await page.waitForTimeout(120)}
  const noOverlap=async()=>{const boxes=await page.locator('.vue-flow__node').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {id:n.dataset.id,x:b.x,y:b.y,w:b.width,h:b.height}}));for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++){const a=boxes[i],b=boxes[j];assert(a.x+a.w<=b.x+1||b.x+b.w<=a.x+1||a.y+a.h<=b.y+1||b.y+b.h<=a.y+1,`node overlap: ${a.id} / ${b.id}`)}}
  const business=()=>page.getByRole('dialog',{name:'节点业务配置',exact:true})
  const dialog=()=>page.getByRole('dialog',{name:'物料建档与关联',exact:true})
  const preview=async()=>{await btn('预览范围与兼容',dialog()).click();await dialog().locator('[data-material-scope-preview]').waitFor()}
  const confirm=async()=>{await dialog().locator('.el-checkbox').click();await btn('确认执行',dialog()).click();await dialog().waitFor({state:'hidden'})}
  await page.goto(`${base}/specs?template=${f.modelId}`,{waitUntil:'networkidle'})
  for(const id of [f.anchor,f.other]){
    await node(id);await page.locator('[data-open-business]').click();await btn('添加业务配置',business()).click();await pick('配置功能','物料策略',business());await pick('作用范围','当前值及其下级',business());await pick('配置值','共用物料（需明确选择目标）',business());await page.locator('[data-save-business]').click();await page.locator('[data-business-form]').waitFor({state:'hidden'});await btn('关闭',business()).click()
  }
  await btn('保存模型').click();await btn('发布模型').click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.specModelVersions.some(v=>v.templateId===id),f.modelId)
  const published=await read(),version=published.specModelVersions.filter(v=>v.templateId===f.modelId).at(-1),snapshot=JSON.stringify(version),planCount=published.planningRecords.length
  mark('real UI configures shared policies and publishes model with capacity/color children')
  await node(f.anchor);await btn('节点范围建档／关联').click();await dialog().getByText('当前节点及真实下级（subtree）',{exact:true}).click();await dialog().getByRole('textbox',{name:'范围物料名称'}).fill('R02浏览器共用物料');await preview();assert.match(await dialog().innerText(),/覆盖 3 条完整规划/)
  await page.screenshot({path:resolve(out,'scope-preview.png')})
  await dialog().locator('.el-checkbox').click();const beforeFail=await raw();await page.evaluate(()=>window.__failR02=true);await btn('确认执行',dialog()).click();await dialog().getByRole('alert').filter({hasText:/quota|无法保存/}).waitFor();assert.equal(await raw(),beforeFail);assert(await dialog().isVisible());await page.evaluate(()=>window.__failR02=false);await btn('确认执行',dialog()).click();await dialog().waitFor({state:'hidden'})
  const created=await read(),mat=created.skus.find(s=>s.skuName==='R02浏览器共用物料');assert(mat);assert(!mat.planningId);assert.equal(created.planningRecords.length,planCount)
  await page.getByText('显示关联物料',{exact:true}).click();await page.locator(`[data-node-materials="${f.anchor}"]`).waitFor();await page.screenshot({path:resolve(out,'node-summary-desktop.png')})
  await noOverlap();await page.locator(`.vue-flow__node[data-id="${f.anchor}"] .fold`).click();await page.waitForTimeout(180);await noOverlap();await page.locator(`.vue-flow__node[data-id="${f.anchor}"] .fold`).click();await page.waitForTimeout(180);await noOverlap()
  mark('node range creates one real MAT with prefix only; quota failure preserves input/data and retry succeeds')
  // Use the existing complete-planning list and its actual new association action.
  await page.getByRole('button',{name:/管理合法组合/}).click()
  const combos=page.locator('.combo-manage-dialog'),row=combos.locator('.el-table__row').filter({hasText:'其他品牌'})
  await btn('关联已有物料',row).click();await dialog().waitFor()
  assert(await dialog().getByRole('combobox',{name:'关联目标物料'}).isVisible())
  assert(await btn('预览范围与兼容',dialog()).isDisabled())
  await dialog().getByRole('combobox',{name:'关联目标物料'}).click();await page.getByRole('option').filter({hasText:mat.materialCode}).click();await preview();await confirm()
  await btn('关闭',combos).click()
  const linked=await read();assert.equal(linked.skus.filter(s=>s.id===mat.id).length,1);assert.equal(linked.materialRelations.filter(r=>r.materialId===mat.id&&r.lifecycle==='active').length,2)
  mark('another complete path explicitly selects same MAT; no automatic first target or duplicate archive')
  await page.locator(`[data-node-materials="${f.anchor}"] button`).click();await page.getByRole('button',{name:`${mat.materialCode} · ${mat.skuName}`,exact:true}).click();await page.locator('[data-material-sources]').waitFor();assert.match(await page.locator('[data-material-sources]').innerText(),/有效来源 2 处/)
  await page.screenshot({path:resolve(out,'archive-reverse.png')});await page.reload({waitUntil:'networkidle'});assert.match(await page.locator('[data-material-sources]').innerText(),/有效来源 2 处/)
  await btn('解除本条关联',page.locator('[data-material-sources]')).click();await page.getByRole('button',{name:'确定',exact:true}).click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.materialRelations.filter(r=>r.materialId===id&&r.lifecycle==='active').length===1,mat.id)
  assert.equal(JSON.stringify((await read()).specModelVersions.find(v=>v.id===version.id)),snapshot);assert((await read()).skus.some(s=>s.id===mat.id))
  mark('near-node card opens original archive; reverse sources survive reload; unlink leaves original MAT and V1 intact')
  await btn('定位来源',page.locator('[data-material-sources]')).click();await page.getByText('显示关联物料',{exact:true}).click();await page.locator(`[data-node-materials="${f.anchor}"]`).waitFor()
  await page.setViewportSize({width:980,height:720})
  for(const mode of ['大纲视图','幕布模式']){await page.locator('.view-switch').getByText(mode,{exact:true}).click();const summary=page.locator(`[data-node-materials="${f.anchor}"]`);await summary.waitFor();await summary.scrollIntoViewIfNeeded();const box=await summary.boundingBox();assert(box&&box.x+box.width<=980);await page.screenshot({path:resolve(out,mode==='大纲视图'?'outline-narrow.png':'document-narrow.png')})}
  mark('narrow-window outline and document views show actual near-node MAT summaries')
  await page.locator('[data-line="r01-model-apple"]').click();await page.keyboard.press('Escape');await page.keyboard.press('Escape');await btn('节点范围建档／关联').click();await preview();await page.screenshot({path:resolve(out,'range-dialog-narrow.png')});const box=await btn('关闭',dialog()).boundingBox();assert(box&&box.x>=0&&box.y+box.height<=720);await btn('关闭',dialog()).click()
  // Concurrent pages use independent previews; second must refuse after first commits.
  await page.setViewportSize({width:1600,height:1000});await page.locator('.view-switch').getByText('结构视图',{exact:true}).click();await node(f.anchor);await btn('节点范围建档／关联').click();await preview()
  const second=await context.newPage();second.setDefaultTimeout(15000);second.on('pageerror',e=>errors.push(String(e)));await second.goto(`${base}/specs?template=${f.modelId}`,{waitUntil:'networkidle'});await second.locator(`.vue-flow__node[data-id="${f.anchor}"] .model-value`).click();await btn('节点范围建档／关联',second).click();const d2=second.getByRole('dialog',{name:'物料建档与关联',exact:true});await d2.getByRole('textbox',{name:'范围物料名称'}).fill('并发较新范围物料');await btn('预览范围与兼容',d2).click();await d2.locator('.el-checkbox').click();await btn('确认执行',d2).click();await d2.waitFor({state:'hidden'});await page.waitForTimeout(200)
  const newest=await raw();await dialog().locator('.el-checkbox').click();await btn('确认执行',dialog()).click();await dialog().getByRole('alert').filter({hasText:/变化|更新/}).waitFor();assert.equal(await raw(),newest);assert(await dialog().isVisible());await second.close();await btn('关闭',dialog()).click()
  mark('two real pages reject stale preview without overwriting newer archive or relation; narrow controls reachable')
  assert.deepEqual(errors,[]);writeFileSync(resolve(out,'evidence.json'),JSON.stringify({browser:await browser.version(),checks,errors},null,2))
}catch(e){if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(e),checks,errors},null,2));throw e}
finally{await browser?.close();await server.close()}
