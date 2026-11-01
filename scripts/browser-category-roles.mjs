import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null,ws:false}})
let browser
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)))
 await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/category-roles');await page.getByText('分类用途配置',{exact:true}).last().waitFor()
 await page.getByRole('button',{name:'配置用途',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'配置分类用途'});await dialog.getByText('配件（含增值业务）',{exact:true}).click();await dialog.getByRole('button',{name:'保存',exact:true}).click();await dialog.waitFor({state:'hidden'})
 assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.categories.some(c=>c.catalogRole==='accessory')))
 await page.getByRole('button',{name:'新增分类',exact:true}).click();await page.getByRole('button',{name:'新增根分类',exact:true}).click();const create=page.getByRole('dialog',{name:'新增根分类'});await create.getByText('配件分类（含增值业务）',{exact:true}).click();await create.getByPlaceholder('分类名称').fill('跨分类增值业务验收');await create.getByRole('button',{name:'保存',exact:true}).click();await create.waitFor({state:'hidden'})
 assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data.categories.some(c=>c.name==='跨分类增值业务验收'&&c.catalogRole==='accessory')));assert.deepEqual(errors,[]);console.log('PASS 浏览器分类用途保存、新增分类用途持久化、无页面错误（独立浏览器数据）')
}finally{await browser?.close();await server.close()}
