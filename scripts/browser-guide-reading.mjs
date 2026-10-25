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
    const server=await createServer({cacheDir:`${runtime}/${strict?'strict':'default'}`,logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}});servers.push(server)
    const {createBenefitPackageFixture}=await server.ssrLoadModule('/scripts/benefit-package-fixtures.ts'),{normalizeStored}=await server.ssrLoadModule('/src/stores/catalog.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
    const fixture=createBenefitPackageFixture(),data=normalizeStored({version:DATA_VERSION,data:fixture.data})
    data.categories.push({id:'guide-move-source',name:'说明测试来源',parentId:null,sort:200,enabled:true},{id:'guide-move-child',name:'来源子类',parentId:'guide-move-source',sort:1,enabled:true},{id:'guide-move-target',name:'说明测试目标',parentId:null,sort:201,enabled:true})
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
    const moduleText=await page.locator('[data-manual-page="page-spus"]').innerText()
    assertEqual(await page.locator('[data-guide-block]>h2').allTextContents(),['功能说明','规则限制','关联页面'],'three core blocks')
    assert.equal(await page.getByText('内容维护',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'收藏',exact:true}).count(),0)
    assert(await page.locator('.guide-directory [data-guide-page="page-skus"]').isVisible())
    await page.getByRole('textbox',{name:'搜索系统功能说明'}).fill('SKU');assert(await page.locator('.guide-directory [data-guide-page="page-skus"]').isVisible());await page.getByRole('textbox',{name:'搜索系统功能说明'}).clear()
    await page.close();await openPage('/spus');let before=await snapshot();await openHelp()
    assert.equal(await drawer().locator('[data-manual-page="page-spus"]').innerText(),moduleText,'top help and full module share exact renderer/content')
    await drawer().locator('.guide-related-actions button').first().click();await page.waitForFunction(()=>document.querySelector('.page-guide-drawer [data-manual-page]')?.getAttribute('data-manual-page')!=='page-spus')
    await closeHelp();assertEqual(await snapshot(),before,'reading/switching/closing never changes URL or data');await page.close()
    mark(`${strict?'strict':'default'}: one menu directory/renderer, three blocks and same top-help content; no legacy guide IO`)

    for(const [path,selector,value]of [['/spus/new','input[data-spu-name], [data-spu-name] input','说明前SPU输入'],[`/skus/${fixture.ids.phoneA}`,'input[data-sku-name], [data-sku-name] input','说明前SKU输入'],['/benefit-packages/new','input[data-benefit-name], [data-benefit-name] input','说明前权益包输入']]){
      await openPage(path);const input=page.locator(selector);await input.fill(value);before=await snapshot();await openHelp();await drawer().locator('.guide-related-actions button').first().click();await closeHelp()
      assert.equal(await input.inputValue(),value);assertEqual(await snapshot(),before,path+' draft/URL/storage');assertEqual(await page.evaluate(()=>window.__guideIO),{reads:0,writes:0},'legacy keys untouched');await page.close()
    }
    mark(`${strict?'strict':'default'}: SPU, SKU and benefit unsaved drafts/URLs survive page-help switching`)

    await openPage('/skus');const filter=page.getByRole('textbox',{name:'在当前视图中搜索',exact:true}),keyword=data.skus.find(s=>s.id===fixture.ids.phoneA)?.code||'phone'
    await filter.fill(keyword);await page.waitForTimeout(180);const firstRow=page.locator('.sku-table .el-table__body-wrapper tbody tr').first();await firstRow.locator('.el-checkbox').first().click()
    const checked=await page.locator('.sku-table .el-table__body-wrapper input[type="checkbox"]:checked').count();assert(checked>0)
    await page.evaluate(async()=>await(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence());before=await snapshot();await openHelp();await drawer().locator('.guide-related-actions button').first().click();await closeHelp()
    assert.equal(await filter.inputValue(),keyword);assert.equal(await page.locator('.sku-table .el-table__body-wrapper input[type="checkbox"]:checked').count(),checked);assertEqual(await snapshot(),before,'list query, selection, saved views and URL remain unchanged');await page.close()
    mark(`${strict?'strict':'default'}: SKU query and selected rows survive explanation browsing`)

    await openPage('/categories');await page.getByText('编辑模式',{exact:true}).click()
    const left=page.locator('[data-category-panel]').first();await left.locator('[data-id="guide-move-source"]').getByRole('button',{name:'移动',exact:true}).click();await left.locator('[data-id="guide-move-target"]').click()
    const pending=await page.locator('[data-category-source]').innerText(),target=await page.locator('[data-category-move-confirm]').innerText();before=await snapshot();await openHelp();await drawer().locator('.guide-related-actions button').first().click();await closeHelp()
    assert.equal(await page.locator('[data-category-source]').innerText(),pending);assert.equal(await page.locator('[data-category-move-confirm]').innerText(),target);assertEqual(await snapshot(),before,'category staged source and target retained')
    await page.locator('.topbar').getByRole('button',{name:'反馈问题',exact:true}).click();const feedback=page.getByRole('dialog',{name:'反馈问题',exact:true});await feedback.waitFor();assert(await feedback.getByRole('textbox',{name:'反馈标题'}).isVisible());await feedback.getByRole('button',{name:'取消',exact:true}).click();assertEqual(await snapshot(),before,'feedback cancellation preserves staged context');await page.close()
    mark(`${strict?'strict':'default'}: category staged subtree and target plus original feedback entry remain intact`)

    await openPage('/guide/articles/manual-specs');before=await snapshot()
    for(const width of [1280,1366,1440,1920,2560,900]){await page.setViewportSize({width,height:950});await page.waitForTimeout(70);const geometry=await page.locator('.guide-manual').evaluate(el=>({width:el.getBoundingClientRect().width,parent:el.parentElement.getBoundingClientRect().width,scroll:document.documentElement.scrollWidth,viewport:innerWidth}));assert(geometry.width<=geometry.parent+1&&geometry.scroll<=geometry.viewport+1,'desktop explanation remains inside content')}
    await page.locator('.theme-switch').click();await page.setViewportSize({width:1366,height:950});assert(await page.locator('[data-guide-block="rules"]').isVisible());await page.locator('.theme-switch').click()
    await page.locator('[data-group="product"]').hover();await page.locator('[data-nav-pin]').click();await page.mouse.move(1200,500);assert(await page.locator('[data-manual-page]').isVisible());await page.locator('[data-nav-pin]').click();assertEqual(await snapshot(),before,'layout/theme changes preserve all business and old guide data')
    if(artifacts){mkdirSync('work/guide-reading',{recursive:true});await page.screenshot({path:`work/guide-reading/${strict?'strict':'default'}.png`})}await page.close()
    for(const retired of ['/guide/manage','/guide/learn/old-flow']){await openPage(retired);assert.equal(new URL(page.url()).pathname,'/guide');assert(await page.getByRole('heading',{name:'系统功能说明',exact:true}).isVisible());await page.close()}
    mark(`${strict?'strict':'default'}: desktop/dark/pin responsiveness and safe retired-route redirects`)

    if(strict){const reader=await makeContext('guide-reader');page=await reader.newPage();await page.goto(base+'/guide',{waitUntil:'networkidle'});await page.locator('[data-manual-page]').waitFor();assertEqual(await page.evaluate(async()=>{const c=(await import('/src/stores/catalog.ts')).useCatalogStore(),g=(await import('/src/stores/guide.ts')).useGuideStore();return {canGuide:c.can('system:guide:read'),canProduct:c.can('product:spu:update'),hasCms:'saveDraft'in g,hasProgress:'remember'in g,io:window.__guideIO}}),{canGuide:true,canProduct:false,hasCms:false,hasProgress:false,io:{reads:0,writes:0}},'read-only identity is independent from business permissions');await page.close();mark('strict: reading grants no product editing or removed CMS/progress APIs')}
    await ctx.close()
  }
  assertEqual(errors,[],'no browser page exceptions')
  if(artifacts){mkdirSync('work/guide-reading',{recursive:true});writeFileSync('work/guide-reading/browser.json',JSON.stringify({result:'PASS',checks},null,2))}
  console.log(`PASS page explanation browser: ${checks.length} checks (default + strict)`)
}catch(error){console.error(`FAIL page explanation browser: ${error instanceof Error?error.message.split('Call log:')[0].trim():String(error)}`);process.exitCode=1}
finally{for(const ctx of contexts)await ctx.close().catch(()=>{});await browser?.close();for(const server of servers)await server.close();removeTestRuntime(runtime)}
