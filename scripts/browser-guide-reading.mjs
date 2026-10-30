import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

const artifacts=process.argv.includes('--artifacts'),runtime=createTestRuntime('guide-reading'),checks=[],errors=[],contexts=[],servers=[]
let browser,page
const assertEqual=(a,b,label)=>assert.equal(JSON.stringify(a),JSON.stringify(b),label)
const mark=name=>checks.push(name)
try{
  browser=await chromium.launch({channel:'chrome',headless:true})
  for(const strict of [false,true]){
    const server=await createServer({cacheDir:`${runtime}/${strict?'strict':'default'}`,logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false}});servers.push(server)
    const {createCatalogProductFixture}=await server.ssrLoadModule('/scripts/catalog-product-fixture.ts'),{normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
    const {guidePages}=await server.ssrLoadModule('/src/domain/guide/registry.ts'),{guideManualContents}=await server.ssrLoadModule('/src/domain/guide/content/manuals.ts')
    const fixture=createCatalogProductFixture(),data=normalizeStored({version:DATA_VERSION,data:fixture.data})
    data.categories.push({id:'guide-move-source',name:'说明测试来源',parentId:null,sort:200,enabled:true},{id:'guide-move-child',name:'说明测试来源子类',parentId:'guide-move-source',sort:1,enabled:true},{id:'guide-move-source-b',name:'说明测试来源二',parentId:null,sort:201,enabled:true},{id:'guide-move-child-b',name:'说明测试来源二子类',parentId:'guide-move-source-b',sort:1,enabled:true},{id:'guide-move-target',name:'说明测试目标',parentId:null,sort:202,enabled:true})
    data.rbac.roles.push({id:'guide-reading-only',code:'guide-reading-only',name:'说明只读',description:'isolated browser fixture',enabled:true,permissionCodes:['system:guide:read']})
    data.users.push({id:'guide-reader',username:'guide-reader',displayName:'说明只读',enabled:true,role:'operator',roleIds:['guide-reading-only']})
    await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
    const makeContext=async(user='u-admin')=>{
      const ctx=await browser.newContext({viewport:{width:1366,height:950},locale:'zh-CN',reducedMotion:'reduce'});contexts.push(ctx)
      await ctx.addInitScript(({data,version,user})=>{
        const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem
        if(location.protocol!=='http:')return
        if(!nativeGet.call(localStorage,'iyge-v2-mock-db')){
          nativeSet.call(localStorage,'iyge-v2-mock-db',JSON.stringify({version,data}));nativeSet.call(localStorage,'iyge-v2-theme','light')
          nativeSet.call(localStorage,'iyge-guide-content-v1','{legacy-unpublished-do-not-read');nativeSet.call(localStorage,'iyge-guide-progress-v1:demo-super-admin','{legacy-progress-do-not-read')
        }
        nativeSet.call(sessionStorage,'iyge-rbac-simulated-user',user)
        window.__guideIO={reads:0,writes:0}
        Storage.prototype.getItem=function(k){if(k.startsWith('iyge-guide-'))window.__guideIO.reads++;return nativeGet.call(this,k)}
        Storage.prototype.setItem=function(k,v){if(k.startsWith('iyge-guide-'))window.__guideIO.writes++;return nativeSet.call(this,k,v)}
        Storage.prototype.removeItem=function(k){if(k.startsWith('iyge-guide-'))window.__guideIO.writes++;return nativeRemove.call(this,k)}
        window.__explanationSnapshot=()=>({business:nativeGet.call(localStorage,'iyge-v2-mock-db'),content:nativeGet.call(localStorage,'iyge-guide-content-v1'),progress:nativeGet.call(localStorage,'iyge-guide-progress-v1:demo-super-admin')})
      },{data,version:DATA_VERSION,user})
      return ctx
    }
    const ctx=await makeContext()
    const openPage=async path=>{page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(12000);await page.goto(base+path,{waitUntil:'networkidle'});await page.evaluate(async()=>{await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence()});return page}
    const snapshot=()=>page.evaluate(async()=>({url:location.href,memory:JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data),disk:window.__explanationSnapshot()}))
    const drawer=()=>page.getByRole('dialog',{name:'页面功能',exact:true})
    const openHelp=async()=>{await page.locator('.topbar').getByRole('button',{name:'页面功能',exact:true}).click();await drawer().waitFor({state:'visible'})}
    const closeHelp=async()=>{await drawer().getByRole('button',{name:'关闭说明',exact:true}).click();await drawer().waitFor({state:'hidden'})}

    await openPage('/guide/articles/manual-spus')
    await page.locator('[data-manual-page="page-spus"]').waitFor()
    const readingText=element=>element.textContent.replace(/\s+/g,' ').trim()
    const readingStyle=element=>{
      const cell=element.querySelector('.guide-feature-table td'),channel=text=>{const values=text.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];return [...values.slice(0,3),values[3]??1]},blend=(foreground,background)=>foreground.slice(0,3).map((value,index)=>value*foreground[3]+background[index]*(1-foreground[3]))
      const chain=[];let current=cell;while(current){chain.unshift(channel(getComputedStyle(current).backgroundColor));current=current.parentElement}
      let background=[255,255,255];for(const color of chain)background=blend(color,background)
      const foreground=blend(channel(getComputedStyle(cell).color),background),luminance=color=>color.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0)
      const f=luminance(foreground),b=luminance(background)
      return {dark:document.documentElement.classList.contains('dark'),contrast:(Math.max(f,b)+.05)/(Math.min(f,b)+.05),font:parseFloat(getComputedStyle(cell).fontSize),overflow:document.documentElement.scrollWidth-innerWidth,rows:element.querySelectorAll('[data-guide-feature]').length}
    }
    const moduleText=await page.locator('[data-manual-page="page-spus"]').evaluate(readingText)
    assertEqual(await page.locator('[data-guide-block]>h2').allTextContents(),['功能说明','规则限制','关联页面'],'three core blocks')
    assert.equal(await page.getByText('内容维护',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'收藏',exact:true}).count(),0)
    assert(await page.locator('.guide-directory [data-guide-page="page-skus"]').isVisible())
    await page.getByRole('textbox',{name:'搜索系统功能说明'}).fill('SKU');assert(await page.locator('.guide-directory [data-guide-page="page-skus"]').isVisible());await page.getByRole('textbox',{name:'搜索系统功能说明'}).clear()
    const manualBefore=await snapshot()
    for(const registered of guidePages){
      await page.locator(`.guide-directory [data-guide-page="${registered.id}"]`).click()
      const manual=page.locator(`[data-manual-page="${registered.id}"]`);await manual.waitFor()
      assertEqual(await manual.locator('[data-guide-block]>h2').allTextContents(),['功能说明','规则限制','关联页面'],registered.id+' core blocks')
      assertEqual(await manual.locator('[data-guide-feature]').evaluateAll(rows=>rows.map(row=>({id:row.dataset.guideFeature,cells:[...row.children].map(cell=>cell.textContent)}))),guideManualContents[registered.id].features.map(row=>({id:row.id,cells:[row.title,row.description,row.operation,row.result]})),registered.id+' authored functions')
      assert.equal(await manual.locator('.guide-action,.guide-rule').count(),0,'legacy templates are not expanded behind the function table')
      assert.equal(await manual.locator('details[open]').count(),0,'complex details are opt-in')
    }
    const manualAfter=await snapshot();assertEqual(manualAfter.memory,manualBefore.memory,'all manuals read without business mutation');assertEqual(manualAfter.disk,manualBefore.disk,'all manuals leave business and legacy guide storage untouched')
    await page.locator('.guide-directory [data-guide-page="page-spus"]').click();await page.locator('[data-manual-page="page-spus"]').waitFor()
    await page.getByRole('textbox',{name:'搜索系统功能说明'}).fill('批量下架');assert(await page.locator('.guide-directory [data-guide-page="page-spus"]').isVisible());await page.getByRole('textbox',{name:'搜索系统功能说明'}).clear()
    assert.equal(await page.locator('.guide-related-actions').getByRole('link',{name:'前往列表选择 SPU',exact:true}).getAttribute('href'),'/spus')
    for(const articleId of ['action-spu-delete','rule-spu-reference']){await page.goto(base+'/guide/articles/'+articleId,{waitUntil:'networkidle'});assert.equal(await page.locator('[data-guide-article="'+articleId+'"]').count(),1);assert.equal(await page.getByText('未找到这份页面说明',{exact:true}).count(),0);assert.equal(await page.locator('[data-guide-article] .guide-section').count()>0,true)}
    mark(`${strict?'strict':'default'}: all ${guidePages.length} page tables match their authored rows, details stay folded, function search and safe list links work; old action/rule URLs remain readable`)
    await page.close();await openPage('/spus');let before=await snapshot();await openHelp()
    assert.equal(await drawer().locator('[data-manual-page="page-spus"]').evaluate(readingText),moduleText,'top help and full module share exact renderer/content')
    for(const width of [1920,1366,900,375]){await page.setViewportSize({width,height:950});const geometry=await drawer().locator('[data-manual-page="page-spus"]').evaluate(element=>{const table=element.querySelector('.guide-feature-table'),cell=table.querySelector('td'),heading=element.querySelector('h1');return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,overflow:table.scrollWidth-table.clientWidth,font:parseFloat(getComputedStyle(cell).fontSize),title:parseFloat(getComputedStyle(heading).fontSize),clipped:[...table.querySelectorAll('td,tbody th')].some(cell=>cell.scrollWidth>cell.clientWidth+1),rowLayout:getComputedStyle(table.querySelector('tbody tr')).display}});assert(geometry.scroll<=geometry.viewport+1&&geometry.overflow<=1&&!geometry.clipped);assert(geometry.font>=14&&geometry.title>=24);assert.equal(geometry.rowLayout,'block','drawer uses a readable labelled layout')}
    await page.setViewportSize({width:1366,height:950})
    const lightStyle=await drawer().locator('[data-manual-page="page-spus"]').evaluate(readingStyle);assert.equal(lightStyle.dark,false);assert(lightStyle.contrast>=4.5&&lightStyle.font>=14&&lightStyle.overflow<=1)
    await closeHelp();await page.locator('.theme-switch').click();await openHelp();const darkStyle=await drawer().locator('[data-manual-page="page-spus"]').evaluate(readingStyle);assert.equal(darkStyle.dark,true);assert(darkStyle.contrast>=4.5&&darkStyle.font>=14&&darkStyle.overflow<=1);assert.equal(darkStyle.rows,lightStyle.rows);assert.equal(await drawer().locator('[data-manual-page="page-spus"]').evaluate(readingText),moduleText)
    await closeHelp();await page.locator('.theme-switch').click();await openHelp()
    await drawer().locator('.guide-related-actions button').first().click();await page.waitForFunction(()=>document.querySelector('.page-guide-drawer [data-manual-page]')?.getAttribute('data-manual-page')!=='page-spus')
    await closeHelp();assertEqual(await snapshot(),before,'reading/switching/closing never changes URL or data');await page.close()
    mark(`${strict?'strict':'default'}: one menu directory/renderer, three blocks and same top-help content; no legacy guide IO`)

    for(const [path,selector,value]of [['/spus/new','input[data-spu-name], [data-spu-name] input','说明前SPU输入'],[`/skus/${fixture.ids.phoneA}`,'input[data-sku-name], [data-sku-name] input','说明前SKU输入']]){
      await openPage(path);const input=page.locator(selector);await input.fill(value);before=await snapshot();await openHelp();await drawer().locator('.guide-related-actions button').first().click();await closeHelp()
      assert.equal(await input.inputValue(),value);assertEqual(await snapshot(),before,path+' draft/URL/storage');assertEqual(await page.evaluate(()=>window.__guideIO),{reads:0,writes:0},'legacy keys untouched');await page.close()
    }
    mark(`${strict?'strict':'default'}: SPU and SKU unsaved drafts/URLs survive page-help switching`)

    await openPage('/skus');const filter=page.getByRole('textbox',{name:'在当前视图中搜索',exact:true}),keyword=data.skus.find(s=>s.id===fixture.ids.phoneA)?.code||'phone'
    await filter.fill(keyword);await page.waitForTimeout(180);const firstRow=page.locator('.sku-table .el-table__body-wrapper tbody tr').first();await firstRow.locator('.el-checkbox').first().click()
    const checked=await page.locator('.sku-table .el-table__body-wrapper input[type="checkbox"]:checked').count();assert(checked>0)
    await page.evaluate(async()=>await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence());before=await snapshot();await openHelp();await drawer().locator('.guide-related-actions button').first().click();await closeHelp()
    assert.equal(await filter.inputValue(),keyword);assert.equal(await page.locator('.sku-table .el-table__body-wrapper input[type="checkbox"]:checked').count(),checked);assertEqual(await snapshot(),before,'list query, selection, saved views and URL remain unchanged');await page.close()
    mark(`${strict?'strict':'default'}: SKU query and selected rows survive explanation browsing`)

    await openPage('/categories');await page.getByText('编辑模式',{exact:true}).click()
    const categoryBefore=await snapshot(),left=page.locator('[data-category-panel]').first(),row=id=>left.locator(`.cat-row[data-id="${id}"]`)
    await left.getByRole('button',{name:'展开全部',exact:true}).click()
    await row('guide-move-source').getByRole('button',{name:'加入待移动',exact:true}).click()
    await row('guide-move-source-b').locator('.el-checkbox').click()
    await page.getByRole('button',{name:'加入已选',exact:true}).click()
    assert.match(await page.locator('[data-category-source]').innerText(),/待移动 2 项/)
    assert.match(await page.locator('[data-category-move-confirm] strong').innerText(),/请在左侧选择目标父级/,'adding sources does not choose a target')
    const right=page.locator('[data-category-panel]').nth(1)
    assertEqual(await right.locator('.cat-row').evaluateAll(rows=>rows.map(item=>item.dataset.id)),['guide-move-source','guide-move-child','guide-move-source-b','guide-move-child-b'],'two independent staged subtrees retain both descendants')
    await row('guide-move-target').focus();await row('guide-move-target').press('Enter')
    assert.equal(await page.locator('[data-category-move-confirm] strong').innerText(),'移动到：说明测试目标')
    await row('guide-move-child').locator('.el-checkbox').click()
    const categorySearch=left.getByRole('textbox',{name:'分类目录与目标搜索分类',exact:true})
    await categorySearch.fill('说明测试')
    assert.equal(await page.locator('[data-category-move-confirm] strong').innerText(),'移动到：说明测试目标','checking and searching preserve the explicit target')
    assert(await page.getByRole('button',{name:'确认移动',exact:true}).isEnabled())
    assertEqual(await snapshot(),categoryBefore,'staging/checking/searching/target selection never writes business data')
    const categoryContext=()=>page.evaluate(()=>{const [left,right]=document.querySelectorAll('[data-category-panel]');return {search:left.querySelector('input').value,checked:[...left.querySelectorAll('.el-checkbox input:checked')].map(input=>input.closest('.cat-row').dataset.id),pending:[...right.querySelectorAll('.cat-row')].map(item=>({id:item.dataset.id,expanded:item.querySelector('.cat-expand').getAttribute('aria-expanded')})),pendingText:document.querySelector('[data-category-source]').innerText,target:document.querySelector('[data-category-move-confirm]').innerText,selected:[...left.querySelectorAll('.cat-row.is-active')].map(item=>item.dataset.id),scroll:[left.querySelector('.category-scroll').scrollTop,right.querySelector('.category-scroll').scrollTop]}})
    const pending=await categoryContext();assertEqual(pending.checked,['guide-move-child','guide-move-source-b'],'source checkboxes remain independent from the staged roots')
    before=await snapshot();await openHelp();await drawer().locator('.guide-related-actions button').first().click();await closeHelp()
    assertEqual(await categoryContext(),pending,'multi-source roots, descendants, checks, search, target and panel context survive page-help switching');assertEqual(await snapshot(),before,'category staged sources and target retained without data or URL changes')
    await page.locator('.topbar').getByRole('button',{name:'反馈问题',exact:true}).click();const feedback=page.getByRole('dialog',{name:'反馈问题',exact:true});await feedback.waitFor();assert(await feedback.getByRole('textbox',{name:'反馈标题'}).isVisible());await feedback.getByRole('button',{name:'取消',exact:true}).click();assertEqual(await categoryContext(),pending,'feedback cancellation preserves multi-source context');assertEqual(await snapshot(),before,'feedback cancellation preserves staged context');await page.close()
    mark(`${strict?'strict':'default'}: multiple staged subtrees, independent checks, explicit target/search and feedback cancellation preserve context without writes`)

    await openPage('/guide/articles/manual-specs');before=await snapshot()
    for(const width of [1280,1366,1440,1920,2560,900,375]){await page.setViewportSize({width,height:950});const geometry=await page.locator('.guide-manual').evaluate(el=>({width:el.getBoundingClientRect().width,parent:el.parentElement.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth,viewport:innerWidth,clipped:[...el.querySelectorAll('.guide-feature-table td,.guide-feature-table tbody th')].some(cell=>cell.scrollWidth>cell.clientWidth+1),font:parseFloat(getComputedStyle(el.querySelector('.guide-feature-table td')).fontSize)}));assert(geometry.width<=geometry.parent+1&&geometry.scroll<=geometry.viewport+1&&!geometry.clipped&&geometry.font>=14,'explanation tables remain readable inside content')}
    await page.locator('.theme-switch').click();await page.setViewportSize({width:1366,height:950});assert(await page.locator('[data-guide-block="rules"]').isVisible());const fullDarkStyle=await page.locator('.guide-manual').evaluate(readingStyle);assert(fullDarkStyle.dark&&fullDarkStyle.contrast>=4.5&&fullDarkStyle.font>=14&&fullDarkStyle.overflow<=1);await page.locator('.theme-switch').click()
    await page.locator('[data-group="product"]').hover();await page.locator('[data-nav-pin]').click();await page.mouse.move(1200,500);assert(await page.locator('[data-manual-page]').isVisible());await page.locator('[data-nav-pin]').click();assertEqual(await snapshot(),before,'layout/theme changes preserve all business and old guide data')
    if(artifacts){mkdirSync('work/guide-reading',{recursive:true});await page.screenshot({path:`work/guide-reading/${strict?'strict':'default'}.png`})}await page.close()
    for(const retired of ['/guide/manage','/guide/learn','/guide/learn/old-flow']){await openPage(retired);assert.equal(new URL(page.url()).pathname,'/guide');assert(await page.getByRole('heading',{name:'系统功能说明',exact:true}).isVisible());await page.close()}
    mark(`${strict?'strict':'default'}: desktop/dark/pin responsiveness and safe retired-route redirects`)

    if(strict){const reader=await makeContext('guide-reader');page=await reader.newPage();await page.goto(base+'/guide',{waitUntil:'networkidle'});await page.locator('[data-manual-page]').waitFor();assertEqual(await page.evaluate(async()=>{const c=(await import('/src/stores/catalog.ts')).useCatalogStore(),g=(await import('/src/stores/guide.ts')).useGuideStore();return {canGuide:c.can('system:guide:read'),canProduct:c.can('product:spu:update'),hasCms:'saveDraft'in g,hasProgress:'remember'in g,io:window.__guideIO}}),{canGuide:true,canProduct:false,hasCms:false,hasProgress:false,io:{reads:0,writes:0}},'read-only identity is independent from business permissions');await page.close();mark('strict: reading grants no product editing or removed CMS/progress APIs')}
    await ctx.close()
  }
  assertEqual(errors,[],'no browser page exceptions')
  if(artifacts){mkdirSync('work/guide-reading',{recursive:true});writeFileSync('work/guide-reading/browser.json',JSON.stringify({result:'PASS',checks},null,2))}
  console.log(`PASS page explanation browser: ${checks.length} checks (default + strict)`)
}catch(error){console.error(`FAIL page explanation browser: ${error instanceof Error?error.message.split('Call log:')[0].trim():String(error)}`);process.exitCode=1}
finally{for(const ctx of contexts)await ctx.close().catch(()=>{});await browser?.close();for(const server of servers)await server.close();removeTestRuntime(runtime)}
