import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
if(!process.env.ROUND3_OUTPUT)throw Error('ROUND3_OUTPUT required')
const output=resolve(process.env.ROUND3_OUTPUT),checks=[];mkdirSync(output,{recursive:true})
const server=await createServer({cacheDir:resolve(output,'cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null}})
let browser,page
const diagnostics=[]
const mark=name=>{checks.push(name);console.log('PASS',name)}
try{
 const {functionalGapsFixture}=await server.ssrLoadModule('/scripts/functional-gaps-fixture.ts')
 const {defaultSkuConfig,SYSTEM_SKU_VIEW_ID}=await server.ssrLoadModule('/src/domain/skuWorkbenchState.ts')
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 async function open(data,path){const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN',reducedMotion:'reduce'});await context.addInitScript(data=>{if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}))},data);page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>diagnostics.push(String(error)));page.on('console',message=>{if(['warning','error'].includes(message.type())&&!message.text().includes('[Vue Flow]: The options parameter is deprecated'))diagnostics.push(message.text())});await page.goto(base+path,{waitUntil:'networkidle'});return context}
 const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
 const settle=()=>page.evaluate(async()=>{await (await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence()})
 const {data}=functionalGapsFixture();const config=defaultSkuConfig();config.categoryLayout='sidebar';data.productListPages.sku.skuWorkbench.working[SYSTEM_SKU_VIEW_ID]=config
 const fam=data.families.find(x=>x.id==='gaps-spu'),sku=data.skus.find(x=>x.id==='gaps-a')
 data.categories.push({id:'r3-tablet',name:'验收平板',parentId:'c-host',enabled:true,sort:20},{id:'r3-accessory',name:'验收配件',parentId:null,enabled:true,sort:21})
 data.families.push({...fam,id:'r3-tablet-spu',categoryId:'r3-tablet'},{...fam,id:'r3-case-spu',categoryId:'r3-accessory'})
 data.skus.push({...sku,id:'r3-tablet-sku',familyId:'r3-tablet-spu'},{...sku,id:'r3-case-sku',familyId:'r3-case-spu'})
 const categoryCtx=await open(data,'/skus')
 const ids=()=>page.locator('.sku-table [data-sku-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.skuId))
 const tree=()=>page.locator('[data-category-tree]:visible')
 await tree().locator('[data-category-id="c-host"]').click();await settle()
 assert((await ids()).includes('gaps-a'));assert((await ids()).includes('r3-tablet-sku'));assert(!(await ids()).includes('r3-case-sku'))
 await tree().locator('[data-category-id="r3-accessory"]').click();await settle();assert((await ids()).includes('r3-case-sku'))
 await tree().locator('[data-category-id="r3-accessory"]').click();await settle();assert(!(await ids()).includes('r3-case-sku'))
 await page.getByRole('button',{name:'另存为',exact:true}).click();let d=page.getByRole('dialog',{name:'另存为',exact:true});await d.getByPlaceholder('视图名称').fill('父分类验收');await d.getByRole('button',{name:'创建',exact:true}).click();await d.waitFor({state:'hidden'});await settle()
 const selected=await ids();await tree().getByRole('button',{name:'清除分类',exact:true}).click();await settle();assert((await ids()).includes('r3-case-sku'))
 await page.getByRole('button',{name:'恢复已保存配置',exact:true}).click();await settle();assert.deepEqual(await ids(),selected)
 await page.reload({waitUntil:'networkidle'});await settle();assert.deepEqual(await ids(),selected);assert(await tree().locator('li.is-on [data-category-id="c-host"]').count())
 await page.screenshot({path:resolve(output,'category-sidebar-dark.png')})
 mark('A sidebar parent/multi/unselect/clear/save-as/restore/reload')
 await page.setViewportSize({width:850,height:900});await page.locator('[data-category-trigger]').click()
 assert(await tree().locator('li.is-on [data-category-id="c-host"]').count())
 await tree().getByRole('button',{name:'清除分类',exact:true}).click();await settle()
 await tree().locator('[data-category-id="c-host"]').click();await settle();assert.deepEqual(await ids(),selected)
 await tree().locator('[data-category-id="r3-accessory"]').click();await settle();assert((await ids()).includes('r3-case-sku'))
 await tree().getByRole('button',{name:'收起分类面板',exact:true}).click()
 await page.getByRole('button',{name:'保存视图',exact:true}).click();await settle()
 await page.locator('.theme-switch').click()
 await page.reload({waitUntil:'networkidle'});await settle();assert((await ids()).includes('r3-case-sku'))
 await page.locator('[data-category-trigger]').click();await tree().waitFor();await page.screenshot({path:resolve(output,'category-popover-light-narrow.png'),animations:'disabled'});await tree().getByRole('button',{name:'收起分类面板',exact:true}).click();await tree().waitFor({state:'hidden'})
 await page.setViewportSize({width:1440,height:1000})
 await page.locator('[data-filter-count]').click()
 const filter=page.getByRole('dialog',{name:'筛选 SKU',exact:true})
 await filter.locator('[data-rule-id="category-quick"]').getByText('显示在常用筛选',{exact:true}).click()
 await filter.locator('[data-apply-sku-filter]').click();await filter.waitFor({state:'hidden'});await settle()
 const quick=page.locator('[data-quick-key="condition:category-quick"]')
 await quick.locator('.el-select__wrapper').click();await page.getByRole('option',{name:'验收配件',exact:true}).click();await quick.locator('input').first().press('Escape');await settle()
 assert.deepEqual(await ids(),selected)
 await page.getByRole('button',{name:'保存视图',exact:true}).click();await settle();await page.reload({waitUntil:'networkidle'});await settle()
 assert.equal(await quick.count(),1);assert.deepEqual(await ids(),selected)
 await quick.getByRole('button',{name:'隐藏',exact:true}).click();await settle();assert(await tree().locator('li.is-on [data-category-id="c-host"]').count())
 mark('A descendants quick filter expose/edit/save/reload/hide preserves category rule identity and result')
 const after=await read();for(const key of ['families','skus','specModelVersions','planningRecords'])assert.deepEqual(after[key],data[key],key)
 mark('A popup shares state, multi-root/save/reload, no business writes');await categoryCtx.close()
 assert.deepEqual(diagnostics,[])
 writeFileSync(resolve(output,'result.json'),JSON.stringify({browser:browser.version(),headless:true,checks},null,2))
}catch(error){await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});throw error}finally{await browser?.close();await server.close()}
