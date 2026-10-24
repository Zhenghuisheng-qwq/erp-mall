import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
if(!process.env.ROUND5_OUTPUT)throw Error('ROUND5_OUTPUT required')
const output=resolve(process.env.ROUND5_OUTPUT);mkdirSync(output,{recursive:true})
const server=await createServer({cacheDir:resolve(output,'cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null}})
let browser,page;const checks=[],errors=[];const mark=s=>{checks.push(s);console.log('PASS '+s)}
try{
 const {functionalGapsFixture}=await server.ssrLoadModule('/scripts/functional-gaps-fixture.ts');const {data}=functionalGapsFixture()
 data.params.push({id:'round5-extra',name:'收尾属性',values:['取值一','取值二'],valueGroups:[],participateInStructure:true})
 data.params.find(p=>p.id==='gaps-cap').values.push('3GB','4GB')
 const config=data.productListPages.sku.skuWorkbench.working['system-all-sku'] || Object.values(data.productListPages.sku.skuWorkbench.working)[0]
 config.conditions.children=[];config.quickFilters=[];config.sortMode='manual';config.sorts=[];config.groups=[]
 for(let i=0;i<35;i++)data.skus.push({...structuredClone(data.skus.find(s=>s.id==='gaps-a')),id:`r5-sku-${i}`,code:`R5-${i}`,skuName:`收尾手机 ${i}`})
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 const context=await browser.newContext({viewport:{width:1700,height:1100},locale:'zh-CN'})
 await context.addInitScript(data=>{if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}));localStorage.setItem('iyge-spec-rail-fold','0');window.__failSave=false;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__failSave&&['iyge-v2-mock-db','iyge-menu-config'].includes(k))throw new DOMException('round5 quota','QuotaExceededError');return set.call(this,k,v)}},data)
 page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)))
 const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
 const node=id=>page.locator(`.vue-flow__node[data-id="${id}"]`),panel=()=>page.locator('.node-add-panel')
 const semantic=d=>JSON.stringify(d.productSpecNodes.map(({positionX,positionY,expanded,...n})=>n).sort((a,b)=>a.id.localeCompare(b.id)))
 const press=async key=>{await page.keyboard.press(key);await page.waitForTimeout(150)}
 const select=async id=>{await node(id).click();await page.waitForTimeout(100)}
 const pick=async label=>{await panel().locator('.el-select').click();await page.getByRole('option',{name:label,exact:true}).click();await press('Escape')}
 await page.goto(base+'/specs?template=gaps-model',{waitUntil:'networkidle'});await select('g-cap');const initial=await read()
 await press('Enter');await panel().waitFor();let rect=await panel().boundingBox();assert(rect.x>=0&&rect.x+rect.width<=1700)
 await pick('收尾属性');await panel().getByRole('button',{name:'确定',exact:true}).click();await panel().waitFor({state:'hidden'});await page.waitForTimeout(150)
 assert((await read()).productSpecNodes.some(n=>n.attributeId==='round5-extra'));await select('g-cap');await press('Control+z');assert.equal(semantic(await read()),semantic(initial))
 await select('g-cap');await press('v');await pick('3GB');await pick('4GB');await panel().getByRole('button',{name:'确定',exact:true}).click();await page.waitForTimeout(150)
 assert.equal((await read()).productSpecNodes.filter(n=>n.parentId==='g-cap').length,4)
 await select('g-cap');await press('Control+z');assert.equal(semantic(await read()),semantic(initial));mark('A canvas adjacent attribute and batch values; each operation one undo')
 await select('g-cap-0');await press('Tab');assert.equal(await panel().getAttribute('aria-label'),'添加条件属性');await pick('收尾属性');await panel().getByRole('button',{name:'确定',exact:true}).click();await page.waitForTimeout(150)
 assert((await read()).productSpecNodes.some(n=>n.attributeId==='round5-extra'&&n.parentId==='g-cap-0'));await select('g-cap');await press('Control+z')
 for(const mode of ['大纲视图','幕布模式']){await page.locator('.view-switch').getByText(mode,{exact:true}).click();await page.locator('[data-line="g-cap"]').press('Tab');await panel().waitFor();await panel().getByRole('button',{name:'取消',exact:true}).click();assert.equal(semantic(await read()),semantic(initial))}
 mark('A value conditional attribute; outline/document Tab and cancellation are pure')
 await page.locator('.view-switch').getByText('结构视图',{exact:true}).click();await select('g-cap');await press('Enter');await page.screenshot({path:resolve(output,'node-panel.png')});await press('Escape');if(await panel().count())await press('Escape')
 await select('g-cap');await press('v');await page.evaluate(async()=>{(await import('/src/stores/catalog.ts')).useCatalogStore().editorGeneration++});await panel().waitFor({state:'hidden'})
 await select('g-white');await press('Tab');await panel().waitFor();await page.evaluate(async()=>{const store=(await import('/src/stores/catalog.ts')).useCatalogStore();store.data.productSpecNodes=store.data.productSpecNodes.filter(n=>n.id!=='g-white')});await panel().waitFor({state:'hidden'})
 await page.evaluate(async item=>{(await import('/src/stores/catalog.ts')).useCatalogStore().data.productSpecNodes.push(item)},initial.productSpecNodes.find(n=>n.id==='g-white'))
 await page.locator('.view-switch').getByText('大纲视图',{exact:true}).click();await page.setViewportSize({width:700,height:900});await page.locator('[data-line="g-cap"]').press('Tab');await panel().waitFor();rect=await panel().boundingBox();assert(rect.x>=0&&rect.x+rect.width<=700);await page.screenshot({path:resolve(output,'node-panel-narrow.png')});await panel().getByRole('button',{name:'取消',exact:true}).click();await page.setViewportSize({width:1700,height:1100})
 mark('A external session invalidation, deleted target closure, narrow-window fallback')
 const after=await read();for(const key of ['specModelVersions','planningRecords','skus','families'])assert.deepEqual(after[key],initial[key])
 mark('A published snapshots PLN MAT and product identities unchanged')
 await page.locator('.view-switch').getByText('结构视图',{exact:true}).click();await page.locator('.canvas-tools').getByText('值',{exact:true}).click();await select('g-cap-0');const readonly=semantic(await read());await press('Tab');await press('Delete');assert.equal(semantic(await read()),readonly);assert.equal(await panel().count(),0);await page.locator('.canvas-tools').getByText('完整结构',{exact:true}).click();mark('A integrated readonly value projection rejects add/delete')
 if(process.env.ROUND5_STAGE==='A') {
 await select('g-cap');await press('v');await panel().locator('.el-select input').fill('5GB');await panel().getByRole('button',{name:'新增属性值：5GB',exact:true}).click();await panel().getByRole('button',{name:'保存到词典并引用',exact:true}).click();await panel().waitFor({state:'hidden'});await page.waitForTimeout(200)
 assert((await read()).params.find(p=>p.id==='gaps-cap').values.includes('5GB'));const createdValue=semantic(await read());await select('g-cap');await press('Control+z');assert.equal(semantic(await read()),createdValue);assert(await page.getByText('词典已被其他模型或历史数据引用，未执行撤销。',{exact:true}).isVisible())
 for(const mode of ['大纲视图','幕布模式']) {
  await page.locator('.view-switch').getByText(mode,{exact:true}).click();await page.locator('[data-line="g-cap"]').press('Tab');await pick('收尾属性');await panel().getByRole('button',{name:'确定',exact:true}).click();await panel().waitFor({state:'hidden'});await page.waitForTimeout(150);assert((await read()).productSpecNodes.some(n=>n.parentId==='g-cap'&&n.attributeId==='round5-extra'))
  await page.locator('.view-switch').getByText('结构视图',{exact:true}).click();await select('g-cap');await press('Control+z')
 }
 await select('g-cap');await press('Enter');await panel().waitFor();await page.locator('[data-zoom-label]').click();await page.getByRole('menuitem',{name:'回到 100%',exact:true}).click();await page.waitForTimeout(500)
 assert.equal((await page.locator('[data-zoom-label]').innerText()).trim(),'100%');const bounds=await panel().boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=1700&&bounds.y>=0&&bounds.y+bounds.height<=1100)
 const beforePan=await panel().boundingBox();const board=await page.locator('.vue-flow').boundingBox();await page.mouse.move(board.x+20,board.y+100);await page.mouse.down();await page.mouse.move(board.x+80,board.y+130,{steps:10});await page.mouse.up();await page.waitForTimeout(300)
 if(await panel().count()){const afterPan=await panel().boundingBox();assert(afterPan.x!==beforePan.x||afterPan.y!==beforePan.y);await panel().getByRole('button',{name:'取消',exact:true}).click()}
 await select('g-cap');await press('Enter');await page.mouse.move(1660,400);await page.mouse.wheel(0,300);await page.waitForTimeout(300);if(await panel().count()){const p=await panel().boundingBox();assert(p.y>=0&&p.y+p.height<=1100);await panel().getByRole('button',{name:'取消',exact:true}).click()}
 mark('A dictionary value create and shared-history undo rejection; outline/document real add; 100% zoom, native pan and page scroll positioning')
 await select('g-cap');await press('Enter');await pick('收尾属性');const late=await panel().getByRole('button',{name:'确定',exact:true}).elementHandle();await page.getByText('手机模型 V1',{exact:true}).click();await panel().waitFor({state:'hidden'});const switched=await read();await late.evaluate(el=>el.click());assert.deepEqual((await read()).productSpecNodes,switched.productSpecNodes);mark('A real model switch closes panel; explicit delayed detached-DOM confirm cannot mutate new context')
 }
 if(process.env.ROUND5_STAGE!=='A') {
 await page.getByRole('button',{name:'保存模型',exact:true}).click();await page.locator('a[data-index="/skus"]').click();await page.locator('[data-sku-workbench]').waitFor()
 const productBefore=await read(),col=key=>page.locator(`[data-sku-column="${key}"]`),dialog=()=>page.locator('[data-sku-display-dialog]')
 const columns=()=>dialog().locator('[data-sku-column]').evaluateAll(els=>els.map(e=>e.getAttribute('data-sku-column')))
 await page.locator('[data-fields-button]').click();const originalColumns=await columns()
 assert.equal(await dialog().locator('[draggable=true]').count(),originalColumns.length)
 const handle=await col('name').locator('.column-grip').boundingBox(),target=await col('code').boundingBox()
 await page.mouse.move(handle.x+5,handle.y+5);await page.mouse.down();await page.mouse.move(target.x+100,target.y+4,{steps:15});await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await columns(),originalColumns)
 await col('name').locator('.column-grip').dragTo(col('name'));assert.deepEqual(await columns(),originalColumns)
 await col('name').locator('.column-grip').dragTo(col('code'),{targetPosition:{x:100,y:2}})
 assert.equal((await columns())[0],'name');await dialog().getByRole('button',{name:'取消',exact:true}).click()
 await page.locator('[data-fields-button]').click();assert.deepEqual(await columns(),originalColumns)
 await dialog().getByPlaceholder('搜索字段名称或来源').fill('SKU')
 await col('name').locator('.column-grip').dragTo(col('code'),{targetPosition:{x:100,y:2}})
 await dialog().getByPlaceholder('搜索字段名称或来源').fill('');assert.equal((await columns()).length,originalColumns.length);assert.equal((await columns())[0],'name')
 await page.locator('[data-apply-sku-display]').click();await dialog().waitFor({state:'hidden'})
 await page.getByRole('button',{name:'另存为',exact:true}).click();await page.getByPlaceholder('视图名称').fill('收尾字段视图');await page.getByRole('dialog',{name:'另存为',exact:true}).getByRole('button',{name:'创建',exact:true}).click()
 await page.getByRole('dialog',{name:'另存为',exact:true}).waitFor({state:'hidden'});mark('B native handle reorder and filtered full-array mapping; cancel/apply/save-as')
 await page.locator('[data-fields-button]').click();await col('code').locator('.column-grip').dragTo(col('name'),{targetPosition:{x:100,y:2}});await page.locator('[data-apply-sku-display]').click();await page.getByRole('button',{name:'恢复已保存配置',exact:true}).click();await page.locator('[data-fields-button]').click();assert.equal((await columns())[0],'name');await dialog().getByRole('button',{name:'取消',exact:true}).click()
 const active=await page.locator('.view-bar').getAttribute('data-view-id')
 const pickbox=page.locator('[data-pick-id]').first(),stagedId=await pickbox.getAttribute('data-pick-id')
 await pickbox.click();await page.getByRole('button',{name:'加入排序暂存区',exact:true}).click()
 await page.locator('.el-pagination .btn-next').click();await page.getByRole('button',{name:'展开暂存 1',exact:true}).click()
 const tray=page.getByRole('dialog',{name:'排序暂存区',exact:true});assert.match(await tray.innerText(),new RegExp(productBefore.skus.find(s=>s.id===stagedId).code));await tray.locator('.el-drawer__close-btn').click()
 await page.locator('[data-view-tab]').first().click();await page.getByRole('dialog',{name:'清空暂存',exact:true}).getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.locator('.view-bar').getAttribute('data-view-id'),active)
 await page.locator('[data-list-spu] .el-select__wrapper').click();await page.getByRole('option',{name:/筛选验收 SPU/}).click();await page.getByRole('dialog',{name:'清空暂存',exact:true}).getByRole('button',{name:'取消',exact:true}).click();assert.equal(new URL(page.url()).searchParams.get('spu'),null)
 await page.getByRole('textbox',{name:'在当前视图中搜索'}).fill('不存在的商品');await page.getByRole('dialog',{name:'清空暂存',exact:true}).waitFor({state:'hidden'});await page.getByRole('button',{name:'展开暂存 1',exact:true}).waitFor();await page.getByRole('textbox',{name:'在当前视图中搜索'}).fill('');await page.locator('.el-pagination .btn-next').click()
 await page.evaluate(()=>window.__failSave=true)
 await page.getByRole('button',{name:'插到前面',exact:true}).first().click();await page.getByRole('dialog',{name:'确认插入',exact:true}).getByRole('button',{name:'确定',exact:true}).click();await page.locator('[data-save-error]').waitFor();assert(await page.getByRole('button',{name:'展开暂存 1',exact:true}).isVisible())
 await page.evaluate(()=>window.__failSave=false)
 await page.getByRole('button',{name:'插到前面',exact:true}).first().click();await page.getByRole('dialog',{name:'确认插入',exact:true}).getByRole('button',{name:'确定',exact:true}).click();await page.getByRole('button',{name:'展开暂存 0',exact:true}).waitFor()
 await page.getByRole('button',{name:'保存视图',exact:true}).click();await page.screenshot({path:resolve(output,'sku-workbench.png')})
 const afterSku=await read();for(const key of ['skus','families','planningRecords','specModelVersions'])assert.deepEqual(afterSku[key],productBefore[key]);mark('B cross-page business labels; cancel view/scope switch; search preserves stage; failed insert retains stage; retry; products unchanged')
 const staleBox=page.locator('[data-pick-id]').first(),staleId=await staleBox.getAttribute('data-pick-id');await staleBox.click();await page.getByRole('button',{name:'加入排序暂存区',exact:true}).click()
 const removed=await page.evaluate(async id=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore(),index=s.data.skus.findIndex(x=>x.id===id),item=JSON.parse(JSON.stringify(s.data.skus[index]));s.data.skus.splice(index,1);return {index,item}},staleId)
 await page.getByRole('button',{name:'展开暂存 1',exact:true}).click();assert(await tray.getByText('记录已删除或不再是销售 SKU',{exact:true}).isVisible());await tray.getByRole('button',{name:'移除',exact:true}).click();await tray.locator('.el-drawer__close-btn').click()
 await page.evaluate(async ({index,item})=>{(await import('/src/stores/catalog.ts')).useCatalogStore().data.skus.splice(index,0,item)},removed)
 mark('B explicit external deletion shows invalid staged item and allows safe removal')
 }
 if(process.env.ROUND5_STAGE==='C' || process.env.ROUND5_STAGE==='ALL') {
 await page.locator('[aria-label="菜单配置恢复入口"]').click();await page.getByPlaceholder('新中心名称').fill('收尾中心');await page.getByRole('button',{name:'新增中心',exact:true}).click()
 await page.getByRole('combobox',{name:'新分组所属中心'}).locator('xpath=ancestor::div[contains(@class,"el-select__wrapper")]').click();await page.getByRole('option',{name:'收尾中心',exact:true}).click();await page.getByPlaceholder('新分组名称').fill('收尾分组');await page.getByRole('button',{name:'新增分组',exact:true}).click()
 await page.getByRole('combobox',{name:'选择正式页面'}).locator('xpath=ancestor::div[contains(@class,"el-select__wrapper")]').click();await page.getByRole('option',{name:'SKU 管理',exact:true}).click()
 await page.getByRole('combobox',{name:'页面目标父级'}).locator('xpath=ancestor::div[contains(@class,"el-select__wrapper")]').click();await page.getByRole('option',{name:'收尾分组',exact:true}).click();await page.getByRole('button',{name:'恢复或移动页面入口',exact:true}).click();await page.getByRole('button',{name:'恢复或移动页面入口',exact:true}).click()
 assert.equal(await page.locator('[data-menu-id="page:/skus"]').count(),1)
 await page.evaluate(()=>window.__failSave=true);await page.getByRole('button',{name:'保存',exact:true}).click();await page.locator('[data-menu-save-error]').waitFor();assert(await page.locator('[data-menu-id="custom-center-1"]').count())
 await page.evaluate(()=>window.__failSave=false);await page.getByRole('button',{name:'保存',exact:true}).click();await page.locator('[data-menu-save-error]').waitFor({state:'hidden'})
 await page.getByRole('button',{name:'导航设置',exact:true}).click();await page.getByRole('menuitemradio',{name:'仅当前中心菜单',exact:true}).click()
 assert.equal(await page.locator('aside.rail').count(),0)
 await page.getByRole('combobox',{name:'切换业务中心'}).selectOption({label:'收尾中心'});await page.locator('[data-sku-workbench]').waitFor();assert.equal(await page.getByRole('combobox',{name:'切换业务中心'}).inputValue(),'custom-center-1')
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('combobox',{name:'切换业务中心'}).inputValue(),'custom-center-1');assert.equal(await page.locator('aside.rail').count(),0)
 await page.locator('[data-nav-fold]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-nav-layout')).layout),'center');await page.locator('[data-nav-fold]').click()
 await page.locator('[data-more-views]').click();await page.locator('[data-saved-view]').filter({hasText:'收尾字段视图'}).click()
 await page.locator('[data-fields-button]').click();assert.equal(await page.locator('[data-sku-column]').first().getAttribute('data-sku-column'),'name');await page.locator('[data-sku-display-dialog]').getByRole('button',{name:'取消',exact:true}).click()
 await page.screenshot({path:resolve(output,'current-center.png')});mark('C center/group and unique page relocation; quota retry; current-center switch, refresh and fold preference')
 const savedMenu=await page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-menu-config')).nodes);assert.equal(savedMenu.filter(n=>n.route==='/skus').length,1)
 await page.locator('.theme-switch').click();await page.setViewportSize({width:800,height:950});await page.locator('[data-nav-fold]').click();await page.getByRole('button',{name:'打开当前中心菜单',exact:true}).click();await page.getByRole('combobox',{name:'切换业务中心'}).waitFor();await page.screenshot({path:resolve(output,'navigation-light-narrow.png')});await page.keyboard.press('Escape');await page.setViewportSize({width:1700,height:1100})
 await page.locator('.topbar .el-select').click();await page.getByRole('option',{name:'身份：运营',exact:true}).click();await page.waitForTimeout(250)
 assert.equal(await page.locator('[aria-label="菜单配置恢复入口"]').count(),0)
 await page.goto(base+'/menus',{waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,'/');await page.goto(base+'/templates',{waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,'/');mark('C operator cannot directly enter admin menu configuration or admin template route')
 await page.locator('.topbar .el-select').click();await page.getByRole('option',{name:'身份：管理员',exact:true}).click();await page.locator('[aria-label="菜单配置恢复入口"]').click()
 await page.locator('[data-menu-id="custom-center-1"]').getByRole('button',{name:'删除',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'删除菜单容器',exact:true}).count(),0)
 await page.getByPlaceholder('新中心名称').fill('待删除空中心');await page.getByRole('button',{name:'新增中心',exact:true}).click();await page.locator('[data-menu-id="custom-center-2"]').getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('dialog',{name:'删除菜单容器',exact:true}).getByRole('button',{name:'确定',exact:true}).click();assert.equal(await page.locator('[data-menu-id="custom-center-2"]').count(),0)
 const beforeReset=await read();await page.getByRole('button',{name:'恢复默认',exact:true}).click();await page.getByRole('dialog',{name:'恢复默认菜单',exact:true}).getByRole('button',{name:'确定',exact:true}).click();assert.equal(await page.locator('[data-menu-id="custom-center-1"]').count(),0);assert.deepEqual(await read(),beforeReset);mark('C nonempty container deletion protected; empty custom center deletion and menu-only reset')
 }
 assert.deepEqual(errors,[]);writeFileSync(resolve(output,'result.json'),JSON.stringify({result:'PASS',browser:browser.version(),checks,errors},null,2))
}catch(e){await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});writeFileSync(resolve(output,'result.json'),JSON.stringify({result:'FAIL',error:String(e),checks,errors},null,2));throw e}finally{await browser?.close();await server.close()}
