import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
if (!process.env.EDITOR_SAFETY_OUTPUT_DIR) throw Error('Explicit unique output directory required')
const output=resolve(process.env.EDITOR_SAFETY_OUTPUT_DIR), checks=[]
mkdirSync(output,{recursive:true})
const server=await createServer({cacheDir:resolve(output,'vite-cache'),server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}})
let browser, page
const errors=[]
try {
  const {functionalGapsFixture}=await server.ssrLoadModule('/scripts/functional-gaps-fixture.ts')
  const {data}=functionalGapsFixture()
  data.templates.push({...structuredClone(data.templates.find(x=>x.id==='gaps-model')),id:'safety-b',name:'安全模型 B'})
  data.specCanvases.push({...structuredClone(data.specCanvases.find(x=>x.templateId==='gaps-model')),templateId:'safety-b',name:'安全模型 B',status:'draft'})
  data.productSpecNodes.push(...structuredClone(data.productSpecNodes.filter(x=>x.templateId==='gaps-model')).map(x=>({...x,id:'b-'+x.id,parentId:x.parentId?'b-'+x.parentId:null,templateId:'safety-b'})))
  await server.listen()
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
  const context=await browser.newContext({viewport:{width:1600,height:1000},locale:'zh-CN'})
  await context.addInitScript(data=>{
    localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}))
    localStorage.setItem('iyge-spec-rail-fold','0')
    const set=Storage.prototype.setItem
    window.__failSave=false
    Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'&&window.__failSave)throw new DOMException('test quota','QuotaExceededError');return set.call(this,key,value)}
  },data)
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(String(error)))
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/specs?template=gaps-model`,{waitUntil:'networkidle'})
  const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
  const node=id=>page.locator(`.vue-flow__node[data-id="${id}"]`)
  await node('g-cap').click();await page.waitForTimeout(150);await page.keyboard.press('ArrowDown');await page.waitForTimeout(350)
  assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,2)
  // Router navigation preserves the real component; only the navigation is programmatic.
  await page.evaluate(async()=>{const app=document.querySelector('#app').__vue_app__;await app.config.globalProperties.$router.push('/specs?template=safety-b')})
  await node('b-g-cap').click();await page.waitForTimeout(150);const before=await read();await page.keyboard.press('Control+z');await page.waitForTimeout(350);const after=await read()
  const changed=JSON.stringify(before.productSpecNodes)!==JSON.stringify(after.productSpecNodes)
  assert.equal(changed,process.env.BASELINE==='1')
  checks.push({name:'A ArrowDown → same-component query B → real Ctrl+Z',corruptionReproduced:changed,bNodesAfter:after.productSpecNodes.filter(x=>x.templateId==='safety-b').length})
  await page.screenshot({path:resolve(output,'cross-model.png')})
  if(process.env.BASELINE!=='1') {
    const mark=name=>{checks.push({name,ok:true});console.log('PASS '+name)}
    const go=async query=>{await page.evaluate(async query=>{await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/specs?'+query)},query);await page.waitForTimeout(200)}
    const select=async id=>{await node(id).click();await page.waitForTimeout(100)}
    const press=async key=>{await page.keyboard.press(key);await page.waitForTimeout(180)}
    const business=d=>JSON.stringify({nodes:d.productSpecNodes,params:d.params,bindings:d.templateParams,templates:d.templates,versions:d.specModelVersions})
    const semantic=d=>JSON.stringify(d.productSpecNodes.map(({positionX,positionY,expanded,...n})=>n).sort((a,b)=>a.id.localeCompare(b.id)))
    const reset=async()=>{await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/specs?template=gaps-model`,{waitUntil:'networkidle'});await page.waitForTimeout(350)}
    await go('template=gaps-model');await select('g-cap');await press('Control+z');assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,2)
    await press('ArrowUp');assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,1);await press('Control+z');assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,2)
    mark('A→B→A clears old history; same-model undo remains valid')
    await select('g-cap');await press('ArrowUp');await page.getByText('安全模型 B',{exact:true}).click();await select('b-g-cap');const left=semantic(await read());await press('Control+z');assert.equal(semantic(await read()),left)
    await go('template=gaps-model');await select('g-cap');await press('ArrowDown');await page.getByText('全局总览',{exact:true}).click();await page.getByText('清单',{exact:true}).click();await page.locator('.overview-row.is-model').filter({hasText:'需求补齐模型'}).getByRole('button',{name:'查看',exact:true}).click();await page.getByRole('button',{name:'进入编辑',exact:true}).click();await select('g-cap');const overview=semantic(await read());await press('Control+z');assert.equal(semantic(await read()),overview)
    mark('left model selection and overview invalidate history')
    await reset()
    for(const [mode,id,target] of [['属性','g-cap','g-color'],['值','g-cap-0','g-black']]) {
      await page.locator('.canvas-tools').getByText(mode,{exact:true}).click();await page.waitForTimeout(300)
      const before=business(await read())
      await select(id);await press('Delete');await press('Tab');await press('Enter');await press('v');await press('Control+z')
      await node(id).dblclick();await node(id).click({button:'right'});assert.equal(await page.locator('.context-menu:visible').count(),0)
      const a=await node(id).boundingBox(),b=await node(target).boundingBox();await page.mouse.move(a.x+20,a.y+15);await page.mouse.down();await page.mouse.move(b.x+20,b.y+15,{steps:15});await page.mouse.up();await page.waitForTimeout(250)
      assert.equal(business(await read()),before);assert.equal(await page.locator('.el-dialog:visible').count(),0)
      await page.locator('[data-expand-toggle]').click();await page.locator('[data-expand-toggle]').click();assert.equal(business(await read()),before)
      mark(mode+' projection: real keys, double-click, menu, drag and expansion are readonly')
    }
    await page.screenshot({path:resolve(output,'projection.png')})
    await page.locator('.view-switch').getByText('大纲视图',{exact:true}).click();await page.locator('[data-line="g-cap"]').press('ArrowDown');await page.waitForTimeout(200)
    assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,2)
    await page.locator('.view-switch').getByText('幕布模式',{exact:true}).click();await page.locator('[data-line="g-cap"]').press('ArrowUp');await page.waitForTimeout(200)
    assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,1)
    mark('outline and document edit despite hidden value projection')
    await reset();const original=await read()
    const drag=async(from,to)=>{const a=await node(from).boundingBox(),b=await node(to).boundingBox();await page.mouse.move(a.x+25,a.y+16);await page.mouse.down();await page.mouse.move(b.x+25,b.y+16,{steps:20});await page.mouse.up();await page.waitForTimeout(300)}
    await drag('g-color','g-cap-0');assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-color').parentId,'g-cap-0')
    await select('g-color');await press('Control+z');assert.equal(semantic(await read()),semantic(original));const restored=business(await read());await press('Control+z');assert.equal(business(await read()),restored)
    await drag('g-cap','g-cap-0');await select('g-cap');await press('Control+z');assert.equal(semantic(await read()),semantic(original))
    await drag('g-black','g-cap-0');assert.equal(semantic(await read()),semantic(original))
    await node('g-cap').click();await press('Control+z');assert.equal(semantic(await read()),semantic(original))
    mark('real structural drag is one undo; descendant/value-invalid targets and click/no-op add no history')
    const a=await node('g-color').boundingBox(), b=await node('g-cap-0').boundingBox()
    await page.mouse.move(a.x+25,a.y+16);await page.mouse.down();await page.mouse.move(b.x+25,b.y+16,{steps:15});await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(250);assert.equal(semantic(await read()),semantic(original))
    await page.mouse.move(a.x+25,a.y+16);await page.mouse.down();await page.mouse.move(a.x+45,a.y+25,{steps:5});await go('template=safety-b');const switched=semantic(await read());await page.mouse.up();await page.waitForTimeout(200);assert.equal(semantic(await read()),switched)
    await go('template=gaps-model&mode=view');await select('g-cap');const readonly=business(await read());await press('Control+z');await drag('g-color','g-cap-0');assert.equal(business(await read()),readonly)
    mark('Escape cancels real drag; route change during gesture cannot affect B; viewing blocks drag and undo')
    await go('template=gaps-model');await select('g-cap');await press('ArrowDown');await page.locator('.canvas-tools').getByText('值',{exact:true}).click();await page.getByText('显示关联物料',{exact:true}).click()
    const materialBefore=business(await read());await page.locator('[data-material-combo]').first().locator('.combo-label').click();assert.equal(await page.locator('[data-material-highlight]').count(),2);assert.equal(business(await read()),materialBefore)
    await page.locator('.canvas-tools').getByText('属性',{exact:true}).click();await page.waitForTimeout(200);assert.equal(await page.locator('.model-attr[data-material-highlight]').count(),2);assert.equal(business(await read()),materialBefore)
    await page.getByText('显示关联物料',{exact:true}).click();await page.locator('.canvas-tools').getByText('完整结构',{exact:true}).click();await select('g-cap');await press('Control+z');assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,1)
    mark('projection material highlight is readonly and adds no undo entry')
    await page.screenshot({path:resolve(output,'drag-restored.png')})
    // A late confirmation is resolved by clicking its real button after the route changed.
    await select('g-cap');await press('Delete');await page.locator('.el-message-box').waitFor();await go('template=safety-b');const late=business(await read());await page.locator('.el-message-box').getByRole('button',{name:'确定',exact:true}).click();await page.waitForTimeout(250);assert.equal(business(await read()),late)
    mark('late delete confirmation cannot modify model B')
    await reset();await select('model-root');await page.locator('.node-ops').getByRole('button',{name:'添加属性',exact:true}).click()
    let dialog=page.getByRole('dialog',{name:/^(选择属性|添加属性)$/})
    await dialog.getByRole('button',{name:'新增属性',exact:true}).click()
    const text=dialog.getByPlaceholder('新属性名称');await text.click();await page.keyboard.type('native undo');await page.keyboard.press('Control+z');assert.notEqual(await text.inputValue(),'native undo')
    await text.fill('共享测试新属性');await dialog.getByRole('button',{name:'保存到词典并引用',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.waitForTimeout(250)
    const newParam=(await read()).params.find(p=>p.name==='共享测试新属性');assert(newParam)
    // Simulate a later independent model edit; do not invoke designer handlers.
    await page.evaluate(async id=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();s.data.templateParams.push({templateId:'safety-b',paramId:id,role:'variant',required:false});s.data.params.push({id:'late-dict',name:'独立后续词典',values:[],valueGroups:[],participateInStructure:true})},newParam.id)
    await select('g-cap');const conflict=business(await read());await press('Control+z');assert.equal(business(await read()),conflict);await press('Control+z');assert.equal(business(await read()),conflict)
    assert.match(await page.locator('body').innerText(),/词典已被/)
    await page.evaluate(async id=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();s.data.templateParams=s.data.templateParams.filter(p=>!(p.templateId==='safety-b'&&p.paramId===id))},newParam.id)
    await press('Control+z');assert(!(await read()).params.some(p=>p.id===newParam.id));assert((await read()).params.some(p=>p.id==='late-dict'))
    mark('real dictionary create/undo; shared-reference conflict retains history; unrelated later dictionary preserved; input native undo')
    await reset();await select('model-root');await page.locator('.node-ops').getByRole('button',{name:'添加属性',exact:true}).click();dialog=page.getByRole('dialog',{name:/^(选择属性|添加属性)$/});await dialog.getByRole('button',{name:'新增属性',exact:true}).click()
    const ime=dialog.getByPlaceholder('新属性名称');const imeBefore=business(await read());await ime.fill('中文输入验收')
    // CompositionEvent is a synthetic IME contract check, not a claim of OS input-method automation.
    await ime.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文输入验收'}))});assert.equal(business(await read()),imeBefore)
    await dialog.getByRole('button',{name:'取消',exact:true}).click();mark('Chinese input and synthetic composing Enter do not trigger structural command')
    await reset();await select('g-cap');await press('ArrowDown')
    await page.evaluate(()=>window.__failSave=true);await press('Control+z');assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,1)
    await page.getByRole('button',{name:'保存模型',exact:true}).click();await page.waitForTimeout(250);assert(await page.evaluate(async()=>(await import('/src/stores/catalog.ts')).useCatalogStore().persistenceState.message))
    await page.evaluate(()=>window.__failSave=false);await page.getByRole('button',{name:'保存模型',exact:true}).click();await page.waitForTimeout(300);await select('g-cap');const retried=semantic(await read());await press('Control+z');assert.equal(semantic(await read()),retried)
    await press('ArrowDown');await page.getByRole('button',{name:'保存模型',exact:true}).click();await select('g-cap');await press('Control+z');assert.equal((await read()).productSpecNodes.find(x=>x.id==='g-cap').sort,1)
    mark('quota failure keeps applied undo; retry never replays; ordinary save preserves valid undo')
    await reset();await select('g-cap');await press('ArrowDown')
    // These are explicitly store-level dataset operations, followed by real keyboard validation.
    await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();await s.importJson(s.exportJson())});await select('g-cap');const imported=semantic(await read());await press('Control+z');assert.equal(semantic(await read()),imported)
    await go('template=safety-b');await select('b-g-cap');await press('ArrowDown');await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();const message=s.removeTemplate('safety-b');if(message)throw Error(message)});await press('Control+z');assert(!(await read()).templates.some(t=>t.id==='safety-b'))
    await reset();await select('g-cap');await press('ArrowDown');await page.evaluate(async()=>{await (await import('/src/stores/catalog.ts')).useCatalogStore().resetAll()});const fresh=semantic(await read());await press('Control+z');assert.equal(semantic(await read()),fresh)
    mark('import, deletion and reset invalidate old history (store operations + real keyboard)')
  }
  assert.deepEqual(errors,[])
  writeFileSync(resolve(output,'result.json'),JSON.stringify({browser:await browser.version(),baseline:process.env.BASELINE==='1',checks},null,2))
  console.log(JSON.stringify(checks))
} catch(error) {await page?.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});writeFileSync(resolve(output,'failure.json'),JSON.stringify({checks,errors,error:String(error).slice(0,1400)},null,2));throw error} finally {await browser?.close();await server.close()}
