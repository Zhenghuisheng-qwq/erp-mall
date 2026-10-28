import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
const before=process.argv.includes('--before'),out=resolve(process.env.LIST_NAV_OUTPUT || 'work/ui-finish/list-review/current');mkdirSync(out,{recursive:true})
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:null,hmr:false}});let browser;const results=[]
try{const {createAccessoryCompatibilityFixture}=await server.ssrLoadModule('/scripts/accessory-compatibility-fixtures.ts');const {data}=createAccessoryCompatibilityFixture();data.activeRole='admin';const sku=data.skus.find(s=>s.id==='phone-a');sku.skuName='长名称验收：正式销售商品完整名称保持原文'.repeat(8);sku.variantAttrs={...sku.variantAttrs,...Object.fromEntries(Array.from({length:12},(_,i)=>['规格属性'+i,'完整取值'+i+'长内容用于检验两行摘要']))};await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1366,height:1000},permissions:['clipboard-read','clipboard-write']});await ctx.addInitScript(data=>{if(location.protocol==='http:'&&!localStorage.getItem('iyge-v2-mock-db')){localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}));localStorage.setItem('iyge-v2-theme','light')}},data);const page=await ctx.newPage();const errors=[];const navigation=[];page.on('pageerror',e=>errors.push(String(e)));const read=()=>page.evaluate(async()=>JSON.parse(JSON.stringify((await import('/src/stores/catalog.ts')).useCatalogStore().data)));for(const route of ['spus','skus']){await page.goto(base+'/'+route,{waitUntil:'networkidle'});const original=await read();for(const width of [1366,1920,900]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);await page.screenshot({path:resolve(out,`${route}-${width}.png`),fullPage:true});const bounds=await page.locator('.'+(route==='skus'?'sku':'spu')+'-table').first().boundingBox(),mainBounds=await page.locator('.main').boundingBox();assert(bounds.x>=mainBounds.x-1&&bounds.x+bounds.width<=Math.min(mainBounds.x+mainBounds.width,width)+1,`${route} at ${width}: table remains inside main and viewport`);const measure=await page.locator('.'+(route==='skus'?'sku':'spu')+'-table').first().evaluate(e=>({outer:e.getBoundingClientRect().width,inner:e.querySelector('.el-table__body')?.getBoundingClientRect().width,rows:[...e.querySelectorAll('tbody tr')].slice(0,5).map(r=>r.getBoundingClientRect().height)}));results.push({route,width,...measure});if(!before&&route==='skus'){assert(measure.rows.every(h=>h<=90));if(width>=1366)assert(Math.abs(measure.outer-measure.inner)<4,'auto columns fill the container');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}}
if(!before){
  await page.setViewportSize({width:1366,height:1000});
  const table=page.locator('.'+(route==='skus'?'sku':'spu')+'-table').first();
  await page.evaluate(async()=>await (await import('/src/stores/catalog.ts')).useCatalogStore().waitForPersistence());
  const diskBefore=await page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'));
  const pagesBefore=JSON.stringify((await read()).productListPages);
  const record=async state=>{
    await page.waitForTimeout(280);
    const main=await page.locator('.main').boundingBox(),rect=await table.boundingBox();
    assert(rect.x>=main.x-1,`${route} ${state}: table left remains inside main`);
    assert(rect.x+rect.width<=Math.min(main.x+main.width,1366)+1,`${route} ${state}: table right remains inside main/viewport`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} ${state}: page does not overflow`);
    navigation.push({route,state,main,table:rect});
    await page.screenshot({path:resolve(out,`${route}-nav-${state}-1366.png`),fullPage:true});
  };
  await record('unpinned');
  await page.locator('[data-group="product"]').hover();
  await page.locator('[data-nav-pin]').click();
  assert.equal(await page.locator('[data-nav-pin]').getAttribute('aria-pressed'),'true');
  await record('pinned');
  await page.locator('[data-nav-fold]').click();await record('icons-pinned');
  await page.locator('[data-nav-fold]').click();await record('expanded-pinned');
  await page.locator('[data-nav-pin]').click();await record('unpin-restored');
  await page.locator('[data-nav-fold]').click();await record('icons-unpinned');
  await page.locator('[data-nav-fold]').click();await record('expanded-unpinned');
  assert.equal(JSON.stringify((await read()).productListPages),pagesBefore,'automatic layout does not save manual column widths');
  assert.deepEqual(await read(),original,'navigation-only operations preserve all business data, saved views and historical snapshots');
  assert.equal(await page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db')),diskBefore,'navigation layout never writes automatic column widths or business data to persistence');
}
if(!before&&route==='skus'){await page.setViewportSize({width:1366,height:1000});assert((await page.locator('[data-spec-open="phone-a"] .summary-text').boundingBox()).height<=40);assert((await page.locator('[data-spec-open="phone-a"]').locator('xpath=ancestor::tr').boundingBox()).height<=81);await page.locator('[data-spec-open="phone-a"]').click();const dialog=page.getByRole('dialog',{name:'完整规格',exact:true});await dialog.waitFor();assert((await dialog.innerText()).includes('规格属性11'));await dialog.getByRole('button',{name:'复制完整内容'}).click();assert((await page.evaluate(()=>navigator.clipboard.readText())).includes(sku.skuName));await page.screenshot({path:resolve(out,'complete-spec.png')});await dialog.getByRole('button',{name:'关闭完整规格'}).click();await page.locator('[data-row-more="phone-a"]').click();await page.getByRole('menuitem',{name:'查看 SPU',exact:true}).waitFor();await page.getByRole('menuitem',{name:'删除',exact:true}).click();const confirmation=page.getByRole('dialog',{name:'删除规格'});await confirmation.waitFor();await confirmation.getByRole('button',{name:'取消',exact:true}).click();const unchanged=await read();assert.deepEqual(unchanged,original);assert.deepEqual(unchanged.specModelVersions,original.specModelVersions);await page.locator('[data-group="product"]').hover();await page.locator('[data-nav-pin]').click();await page.waitForTimeout(250);await page.screenshot({path:resolve(out,'skus-pinned.png')});await page.locator('[data-nav-pin]').click();assert.deepEqual((await read()).productListPages,original.productListPages)}if(!before&&route==='spus'){await page.locator('[data-spu-more]').first().click();await page.getByRole('menuitem',{name:'复制 SPU',exact:true}).waitFor();await page.getByRole('menuitem',{name:'删除',exact:true}).click();await page.getByText('已发布的商品不能直接删除，请先下架。',{exact:true}).waitFor();assert.deepEqual((await read()).families,original.families)}await page.locator('.theme-switch').click();await page.screenshot({path:resolve(out,route+'-dark.png'),fullPage:true});await page.locator('.theme-switch').click()}assert.deepEqual(errors,[]);writeFileSync(resolve(out,'result.json'),JSON.stringify({results,navigation,errors},null,2))}finally{await browser?.close();await server.close()}
