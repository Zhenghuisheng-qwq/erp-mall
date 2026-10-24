import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
if(!process.env.CATEGORY_WORKSPACE_OUTPUT)throw Error('CATEGORY_WORKSPACE_OUTPUT required')
const output=resolve(process.env.CATEGORY_WORKSPACE_OUTPUT);mkdirSync(output,{recursive:true})
const server=await createServer({cacheDir:resolve(output,'cache'),server:{host:'127.0.0.1',port:0,hmr:false,watch:null}})
let browser
try{
 const {categoryWorkspaceFixture}=await server.ssrLoadModule('/scripts/category-workspace-fixture.ts');const data=categoryWorkspaceFixture()
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true})
 const ctx=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'})
 await ctx.addInitScript(data=>localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data})),data)
 const page=await ctx.newPage();await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/categories`,{waitUntil:'networkidle'})
 await page.getByText('编辑模式',{exact:true}).click();await page.getByPlaceholder('搜索并定位分类').fill('移动子树')
 const row=page.locator('.cat-tree-panel [data-id="r4-source"]');await row.hover();await row.getByRole('button',{name:'移动',exact:true}).click()
 assert.equal(await page.locator('.cat-move-panel').count(),1);assert.equal(await page.locator('.cat-move-panel [draggable="true"]').count(),0);assert.equal(await page.locator('.cat-move-panel input').count(),0)
 await page.screenshot({path:resolve(output,'baseline.png')})
 writeFileSync(resolve(output,'result.json'),JSON.stringify({browser:browser.version(),existing:['single tree search/expand/rename','parent picker with independent expansion','domain before/after/inner commands'],missing:['two searchable peer panels','cross-panel reverse drag','close-left preserving right state','staged source with failure retry']},null,2))
}finally{await browser?.close();await server.close()}
