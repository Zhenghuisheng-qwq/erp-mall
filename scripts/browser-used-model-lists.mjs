import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {mkdirSync} from 'node:fs'
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null,ws:false}});let browser
try{
 const {createSeed}=await server.ssrLoadModule('/src/domain/seed.ts'),{intakeChain,receiveUsedPhone}=await server.ssrLoadModule('/src/domain/usedGoods/intake.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts');const data=createSeed(),basis=JSON.stringify(intakeChain(data));for(const [i,color,memory] of [[1,'黑色','8G'],[2,'白色','12G']]){const r=receiveUsedPhone(data,{brand:'小米',model:'17 Pro Max',color,memory,capacity:'512G'},{cost:'',serial:'',imei:'',note:''},basis,'browser-'+i);assert(r.ok);data.usedGoods=r.data}
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1700,height:1050}});await context.addInitScript(({data,version})=>{if(location.protocol==='http:'&&!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}))},{data,version:DATA_VERSION});const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));const base='http://127.0.0.1:'+server.httpServer.address().port
 await page.goto(base+'/skus?goods=used');await page.getByRole('columnheader',{name:'内存',exact:true}).waitFor();assert.equal(await page.locator('[data-used-skus] .el-table__body tbody tr').count(),2)
 await page.locator('.el-select').filter({has:page.getByRole('combobox',{name:'二手内存筛选',exact:true})}).click();await page.getByRole('option',{name:'12G',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[data-used-skus] .el-table__body tbody tr').length===1);assert((await page.locator('[data-used-skus] .el-table__body').innerText()).includes('白色'))
 await page.goto(base+'/spus?goods=used');await page.getByRole('columnheader',{name:'内存',exact:true}).waitFor();assert((await page.locator('[data-used-spus] .el-table__body').innerText()).includes('8G、12G'))
 await page.goto(base+'/spus?goods=used&usedAttr_memory=12G&usedAttr_color='+encodeURIComponent('黑色'));await page.getByText('没有符合当前筛选的二手商品',{exact:true}).waitFor()
 await page.goto(base+'/specs?template=used-phone-intake-model');await page.getByRole('button',{name:'查看资料字段',exact:true}).click();const dialog=page.getByRole('dialog',{name:'二手机资料字段'});await dialog.waitFor();assert(!(await dialog.innerText()).includes('下面没有取值'));assert.equal(await dialog.locator('li').count(),5)
 mkdirSync('work/used-model-lists',{recursive:true});await page.screenshot({path:'work/used-model-lists/model-fields.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS browser SKU动态字段与内存筛选、SPU多值展示、同台设备联合筛选、纯key字段窗口无缺value报错')
}finally{await browser?.close();await server.close()}
