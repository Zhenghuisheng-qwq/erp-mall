import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {mkdirSync} from 'node:fs'
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null,ws:false}})
let browser
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1500,height:1000}});const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(String(e)))
 const base='http://127.0.0.1:'+server.httpServer.address().port,read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
 await page.goto(base+'/category-roles');await page.getByRole('button',{name:'新增用途',exact:true}).click()
 let dialog=page.getByRole('dialog',{name:'新增用途'});await dialog.getByRole('textbox',{name:'名称',exact:true}).fill('维修');await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'})
 let row=page.getByRole('row').filter({has:page.getByText('维修',{exact:true})});await row.getByRole('button',{name:'添加分类',exact:true}).click();dialog=page.getByRole('dialog',{name:'新增分类'});await dialog.getByRole('textbox',{name:'名称',exact:true}).fill('手机维修');await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});assert(await row.getByRole('button',{name:'删除',exact:true}).isDisabled())
 await row.getByRole('button',{name:'编辑',exact:true}).click();dialog=page.getByRole('dialog',{name:'编辑用途'});await dialog.getByRole('textbox',{name:'名称',exact:true}).fill('维修服务');await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'})
 const saved=(await read()).categories.find(c=>c.name==='手机维修');assert(saved?.purposeId)
 await page.goto(base+'/categories?mode=edit&categoryId='+saved.id);await page.locator(`[data-category-purpose="${saved.id}"]`).first().waitFor();assert.equal(await page.locator(`[data-category-purpose="${saved.id}"]`).first().innerText(),'维修服务')
 await page.locator('.cat-detail').getByRole('button',{name:'编辑',exact:true}).click();dialog=page.getByRole('dialog',{name:'编辑分类',exact:true});await dialog.locator('.el-select').filter({has:page.getByRole('combobox',{name:'分类用途',exact:true})}).click();await page.getByRole('option',{name:'主机',exact:true}).click();await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal((await read()).categories.find(c=>c.id===saved.id).purposeId,'host')
 await page.goto(base+'/category-roles');row=page.getByRole('row').filter({has:page.getByText('维修服务',{exact:true})});await row.getByRole('button',{name:'删除',exact:true}).click();await page.locator('.el-message-box').getByRole('button',{name:'确定',exact:true}).click();await row.waitFor({state:'hidden'});assert(!(await read()).categoryPurposes.some(p=>p.name==='维修服务'))
 await page.getByRole('button',{name:'新增用途',exact:true}).click();dialog=page.getByRole('dialog',{name:'新增用途'});await dialog.getByRole('textbox',{name:'名称',exact:true}).fill('维修');await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'})
 mkdirSync('work/category-purposes',{recursive:true});await page.screenshot({path:'work/category-purposes/list.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS 浏览器用途新增/改名/删除、引用禁删、用途侧新增分类、分类树同步显示、分类侧重绑及刷新持久化')
}finally{await browser?.close();await server.close()}
