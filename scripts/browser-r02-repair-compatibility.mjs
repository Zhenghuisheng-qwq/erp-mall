import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
const out=resolve(process.env.R02_COMPAT_BROWSER_OUTPUT||'work/r02-repair-20261025/browser-compatibility');mkdirSync(out,{recursive:true})
const server=await createServer({cacheDir:resolve(out,'cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null,open:false}})
let browser,page;const checks=[],errors=[]
try{
 const {createTemplateCompatibilityFixture}=await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts');const f=createTemplateCompatibilityFixture(),data=f.data
 data.activeRole='admin';data.specModelVersions=[]
 for(const id of ['compat-style-0','compat-style-1'])data.productSpecNodes.find(n=>n.id===id).businessConfigs=[{id:`policy-${id}`,definitionId:'business:material',modelId:f.modelId,nodeId:id,scope:'subtree',enabled:true,parameters:{value:'shared'}}]
 const a=f.config.defaultRule.claims[0];a.conclusion='conditional';a.conditions=[{kind:'manual',text:'条件A'},{kind:'attribute',attributeId:'attr-color',operator:'in',value:['色彩 1','色彩 2']}]
 f.config.exceptions[0].claims=[{...structuredClone(a),id:'equivalent-other-path',conditions:[{kind:'attribute',attributeId:'attr-color',operator:'in',value:['色彩 2','色彩 1','色彩 2']},{kind:'manual',text:'条件A'}]}]
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1600,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
 await ctx.addInitScript(data=>{if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}))},data)
 page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)))
 const btn=(name,scope=page)=>scope.getByRole('button',{name,exact:true}),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
 const dialog=()=>page.getByRole('dialog',{name:'物料建档与关联',exact:true})
 async function navigate(path){await page.goto(base+path,{waitUntil:'networkidle'})}
 async function openRange(id){await page.locator(`.vue-flow__node[data-id="${id}"] .model-value`).click();await btn('节点范围建档／关联').click();await dialog().getByText('当前节点及真实下级（subtree）',{exact:true}).click()}
 async function preview(){await btn('预览范围与兼容',dialog()).click();await dialog().locator('[data-material-scope-preview]').waitFor()}
 async function confirm(){await dialog().locator('.el-checkbox').click();await btn('确认执行',dialog()).click();await dialog().waitFor({state:'hidden'})}
 await navigate(`/specs?template=${f.modelId}`);await btn('发布模型').click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.specModelVersions.some(v=>v.templateId===id),f.modelId)
 await openRange('compat-style-0');await dialog().getByRole('textbox',{name:'范围物料名称'}).fill('补修浏览器共用配件');await preview();await confirm()
 const created=await read(),mat=created.skus.find(s=>s.skuName==='补修浏览器共用配件');assert(mat)
 await openRange('compat-style-1');await dialog().getByText('关联已有物料',{exact:true}).click();await dialog().getByRole('combobox',{name:'关联目标物料'}).click();await page.getByRole('option').filter({hasText:mat.materialCode}).click();await preview();assert.equal(await dialog().getByRole('alert').count(),0);await confirm()
 const shared=await read();assert.equal(shared.compatibilities.filter(l=>l.targetId===mat.id).length,1);const contribution=shared.materialContributions.find(c=>c.materialId===mat.id);assert.equal(contribution.owners.length,8);assert.equal(contribution.lineage.length,2)
 checks.push('real UI reversed conditions and reversed/duplicate in values share one MAT and one declaration with both real source pairs');await page.screenshot({path:resolve(out,'equivalent-linked.png')})
 await navigate('/compatibility');const declaration=shared.compatibilities.find(l=>l.targetId===mat.id)
 await page.locator(`[data-declaration-id="${declaration.id}"]`).getByRole('button',{name:'取消声明',exact:true}).click();await page.locator('[data-confirm-compatibility]').click();await page.locator('[data-declaration-editor]').waitFor({state:'hidden'})
 const cancelled=await read();assert.equal(cancelled.compatibilities.some(l=>l.id===declaration.id),false);assert.equal(cancelled.materialContributions.find(c=>c.id===contribution.id).state,'deleted')
 await navigate(`/specs?template=${f.modelId}`);await page.locator('[data-open-template-compatibility]').click();const config=page.locator('[data-template-compatibility-dialog]:visible');const row=config.locator('[data-template-claim]:visible').first();await row.locator('[data-template-expand]').click();await row.locator('textarea').last().fill('V2 只改备注，不能恢复取消的声明')
 await config.locator('[data-template-save]').click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.templateCompatibilityConfigs.find(c=>c.modelId===id).defaultRule.claims[0].note.includes('V2'),f.modelId)
 await btn('取消',config).click();await config.waitFor({state:'hidden'});await btn('发布模型').click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.specModelVersions.filter(v=>v.templateId===id).length===2,f.modelId)
 await openRange('compat-style-0');await dialog().getByText('关联已有物料',{exact:true}).click();await dialog().getByRole('combobox',{name:'关联目标物料'}).click();await page.getByRole('option').filter({hasText:mat.materialCode}).click();await preview()
 assert.match(await dialog().innerText(),/人工修改或取消/);assert(await btn('确认执行',dialog()).isDisabled());const final=await read();assert.equal(final.compatibilities.some(l=>l.targetId===mat.id),false);assert.deepEqual(final.materialContributions,cancelled.materialContributions)
 await page.screenshot({path:resolve(out,'cancelled-v2-protected.png')});checks.push('real UI cancellation → template note-only save → V2 publish → original MAT preview remains protected; confirm disabled and tombstone unchanged')
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'evidence.json'),JSON.stringify({browser:await browser.version(),checks,errors},null,2))
}catch(e){if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(e),checks,errors},null,2));throw e}
finally{await browser?.close();await server.close()}
