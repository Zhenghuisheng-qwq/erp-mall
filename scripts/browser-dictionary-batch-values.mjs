import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'

const runtime=createTestRuntime('dictionary-batch-values'),servers=[],contexts=[],errors=[]
const attributeId='param-real-long-id-'+ 'reference-'.repeat(12),otherId='param-independent-values'
let browser,page,groups=0
try {
  browser=await chromium.launch({channel:'chrome',headless:true})
  for(const strict of [false,true]){
    const server=await createServer({cacheDir:`${runtime}/${strict?'strict':'default'}`,logLevel:'silent',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}});servers.push(server)
    const {createSeed}=await server.ssrLoadModule('/src/domain/seed.ts'),{ensureRbac}=await server.ssrLoadModule('/src/domain/rbac.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
    const data=createSeed();ensureRbac(data)
    data.params.push({id:attributeId,name:'隔离属性ID检索',values:['已有值','灰蓝 #A/B'],valueGroups:[],participateInStructure:false},{id:otherId,name:'隔离第二属性',values:['新值二','已有值'],valueGroups:[],participateInStructure:false})
    for(const [id,codes]of [['dictionary-batch-update',['product:dictionary:read','product:dictionary:update']],['dictionary-batch-read',['product:dictionary:read']]]){
      data.rbac.roles.push({id,code:id,name:id,description:'isolated browser fixture',enabled:true,permissionCodes:codes});data.users.push({id,username:id,displayName:id,role:'operator',enabled:true,roleIds:[id]})
    }
    await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
    const context=async(actor='dictionary-batch-update')=>{
      const ctx=await browser.newContext({viewport:{width:1366,height:1000},locale:'zh-CN',reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});contexts.push(ctx)
      await ctx.addInitScript(({data,version,actor})=>{
        if(location.protocol!=='http:')return
        if(!localStorage.getItem('iyge-v2-mock-db')){localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));localStorage.setItem('iyge-v2-theme','light');sessionStorage.setItem('iyge-rbac-simulated-user',actor)}
        window.__dictionaryWrites=0
        const set=Storage.prototype.setItem
        Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){window.__dictionaryWrites++;if(window.__failDictionaryWrite)throw Error('隔离词典写盘失败')}return set.call(this,key,value)}
      },{data,version:DATA_VERSION,actor})
      page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(String(error)))
      await page.goto(base+'/params',{waitUntil:'networkidle'});await page.evaluate(async()=>(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence());return ctx
    }
    const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)))
    const raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
    const row=id=>page.locator('.el-table__row').filter({has:page.locator(`[data-param-id="${id}"]`)})
    const search=()=>page.getByRole('textbox',{name:'搜索属性词典',exact:true})
    const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true})
    const unchanged=async(memory,disk)=>{assert.deepEqual(await read(),memory);assert.equal(await raw(),disk)}
    let ctx=await context(),before=await read(),disk=await raw()
    if(strict){const powers=await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();return [s.can('product:dictionary:update'),s.can('product:model:update')]});assert.deepEqual(powers,[true,false])}
    for(const term of [attributeId,'隔离属性ID检索','灰蓝 #A/B']){await search().fill(term);assert.equal(await page.locator('.el-table__row').count(),1);assert.equal(await row(attributeId).count(),1)}
    const idCode=row(attributeId).locator('.dictionary-id-text');assert.equal(await idCode.textContent(),attributeId);assert.equal(await idCode.getAttribute('title'),attributeId);assert(await idCode.evaluate(el=>el.scrollWidth>el.clientWidth))
    await button(`复制属性 ID ${attributeId}`,row(attributeId)).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),attributeId)
    await button('编辑',row(attributeId)).click();let drawer=page.getByRole('dialog',{name:'隔离属性ID检索',exact:true});await drawer.waitFor()
    assert.equal(await drawer.locator('[data-param-editor-id]').textContent(),attributeId);assert.equal(await drawer.locator('[data-param-editor-id] input').count(),0)
    await button('复制当前属性 ID',drawer).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),attributeId);await unchanged(before,disk);groups++

    const input=()=>drawer.getByRole('textbox',{name:'批量取值',exact:true})
    await drawer.getByPlaceholder('属性名称',{exact:true}).fill('尚未提交的名称')
    await input().fill('  新值一  \n\n已有值\n新值一\n丢弃项\n灰蓝 #A/B\n新值二')
    assert.equal(await drawer.locator('[data-preview-value]').count(),5);assert.match(await drawer.locator('[data-value-preview-summary]').textContent(),/本次新增 3 项 · 已有跳过 2 项.*已去重 1 项/)
    await button('移除待添加取值 丢弃项',drawer).click();assert.equal(await drawer.locator('[data-preview-value="丢弃项"]').count(),0);assert(!(await input().inputValue()).includes('丢弃项'))
    await drawer.getByPlaceholder('搜索取值',{exact:true}).click();await unchanged(before,disk)
    await button('取消本次输入',drawer).click();assert.equal(await input().inputValue(),'');assert.equal(await drawer.locator('[data-preview-value]').count(),0);assert.equal(await drawer.getByPlaceholder('属性名称',{exact:true}).inputValue(),'尚未提交的名称');await unchanged(before,disk);groups++

    await input().fill('已有值\n  新值一\n新值一\n\n新值二')
    const completeDraft=await input().inputValue();assert(await button('确认添加 2 项',drawer).isEnabled())
    await page.evaluate(()=>{window.__failDictionaryWrite=true;window.__dictionaryWrites=0})
    await button('确认添加 2 项',drawer).click();await drawer.locator('[data-dictionary-value-error]').waitFor()
    await unchanged(before,disk);assert.equal(await input().inputValue(),completeDraft);assert.equal(await drawer.getByPlaceholder('属性名称',{exact:true}).inputValue(),'尚未提交的名称');assert(await button('确认添加 2 项',drawer).isEnabled());assert.equal(await page.evaluate(()=>window.__dictionaryWrites),1);groups++
    await page.evaluate(()=>{window.__failDictionaryWrite=false;window.__dictionaryWrites=0})
    await button('确认添加 2 项',drawer).click();await page.waitForFunction(async id=>(await import('/src/stores/catalog.ts')).useCatalogStore().data.params.find(p=>p.id===id).values.includes('新值二'),attributeId)
    const expected=JSON.parse(JSON.stringify(before));expected.params.find(p=>p.id===attributeId).values.push('新值一','新值二')
    assert.deepEqual(await read(),expected);assert.equal(await page.evaluate(()=>window.__dictionaryWrites),1);assert.equal(await input().inputValue(),'');assert.equal(await drawer.getByPlaceholder('属性名称',{exact:true}).inputValue(),'尚未提交的名称');assert.deepEqual(JSON.parse(await raw()).data,expected)
    assert.deepEqual((await read()).params.find(p=>p.id===otherId),before.params.find(p=>p.id===otherId));groups++

    before=await read();disk=await raw()
    await input().fill('未确认草稿不能跨属性');await drawer.locator('.el-drawer__close-btn').click();await drawer.waitFor({state:'hidden'});await unchanged(before,disk)
    await search().fill(otherId);await button('编辑',row(otherId)).click();drawer=page.getByRole('dialog',{name:'隔离第二属性',exact:true});await drawer.waitFor();assert.equal(await input().inputValue(),'');assert.equal(await drawer.locator('[data-param-editor-id]').textContent(),otherId)
    await input().fill('末尾新值无需失焦');await button('确认添加 1 项',drawer).click();await page.waitForFunction(async id=>(await import('/src/stores/catalog.ts')).useCatalogStore().data.params.find(p=>p.id===id).values.includes('末尾新值无需失焦'),otherId)
    assert(!(await read()).params.find(p=>p.id===attributeId).values.includes('末尾新值无需失焦'));groups++
    before=await read();disk=await raw()
    const stale=await page.evaluate(async id=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();return await s.appendDictionaryValues(id,['不应写入的过期所属属性'],()=>false)},attributeId);assert.equal(stale.ok,false);await unchanged(before,disk);groups++
    await page.reload({waitUntil:'networkidle'});await page.evaluate(async()=>(await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence());assert.deepEqual(await read(),before);assert.equal(await raw(),disk);groups++

    // Delay the real Store call until a real browser-back unmount. This proves the
    // component's owner callback, not a separately supplied false callback, is checked.
    await page.goto(base+'/forbidden',{waitUntil:'networkidle'});await page.locator('.rail-scroll [data-group="product"]').hover();await page.locator('#nav-flyout a[href="/params"]').click();await page.waitForURL('**/params')
    await search().fill(attributeId);await button('编辑',row(attributeId)).click();drawer=page.getByRole('dialog',{name:'隔离属性ID检索',exact:true});await drawer.waitFor();await input().fill('离开旧编辑器后不可追加')
    await page.evaluate(async()=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore(),append=s.appendDictionaryValues.bind(s);s.appendDictionaryValues=async(...args)=>{window.__dictionaryPending=true;await new Promise(resolve=>window.__releaseDictionary=resolve);const result=await append(...args);window.__dictionaryDeferredResult=result;return result}})
    await button('确认添加 1 项',drawer).click();await page.waitForFunction(()=>window.__dictionaryPending)
    await page.goBack({waitUntil:'networkidle'});assert.equal(new URL(page.url()).pathname,'/forbidden');await page.evaluate(()=>window.__releaseDictionary());await page.waitForFunction(()=>window.__dictionaryDeferredResult)
    assert.equal(await page.evaluate(()=>window.__dictionaryDeferredResult.ok),false);await unchanged(before,disk);await ctx.close();groups++

    if(strict){ctx=await context('dictionary-batch-read');before=await read();disk=await raw();await search().fill(attributeId);assert(await button('编辑',row(attributeId)).isDisabled());await button(`复制属性 ID ${attributeId}`,row(attributeId)).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),attributeId)
      const denied=await page.evaluate(async id=>{const s=(await import('/src/stores/catalog.ts')).useCatalogStore();try{return await s.appendDictionaryValues(id,['只读身份不能写'])}catch(error){return {ok:false,message:error instanceof Error?error.message:String(error)}}},attributeId);assert.equal(denied.ok,false);assert.match(denied.message,/权限|未授权/);await unchanged(before,disk);await ctx.close();groups++}
  }
  assert.deepEqual(errors,[]);console.log(`PASS dictionary IDs and atomic multiline values Chrome (${groups} default/strict groups)`)
} finally {for(const ctx of contexts)await ctx.close().catch(()=>{});await browser?.close();for(const server of servers)await server.close();removeTestRuntime(runtime)}
