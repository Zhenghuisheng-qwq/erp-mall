import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
const out=resolve(process.env.R01_PROTECTION_BROWSER_OUTPUT||'work/r01-protection-20261025/browser');mkdirSync(out,{recursive:true})
const server=await createServer({cacheDir:resolve(out,'cache'),server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}})
const checks=[],errors=[];let browser,page
try {
  const {r01ProtectionFixture}=await server.ssrLoadModule('/scripts/r01-protection-fixture.ts')
  const {DATA_VERSION,STORAGE_KEY}=await server.ssrLoadModule('/src/domain/types.ts')
  const {defaultBusinessDefinitions}=await server.ssrLoadModule('/src/domain/nodeBusiness.ts')
  const f=r01ProtectionFixture();await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true})
  const context=await browser.newContext({viewport:{width:1600,height:1000},locale:'zh-CN'})
  await context.addInitScript(({data,version,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version,data}))},{data:f.data,version:DATA_VERSION,key:STORAGE_KEY})
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e)))
  const raw=()=>page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)
  const read=async()=>JSON.parse(await raw()).data
  const mark=name=>{checks.push(name);console.log('PASS browser '+name)}
  const btn=(name,scope=page)=>scope.getByRole('button',{name,exact:true})
  const menu=async name=>{await btn('演示数据').hover();await page.getByRole('menuitem',{name,exact:true}).click()}
  const upload=async data=>{const chooser=page.waitForEvent('filechooser');await menu('导入演示数据');await (await chooser).setFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:DATA_VERSION,data}))})}
  await page.goto(`${base}/params`,{waitUntil:'networkidle'})
  await page.getByPlaceholder('搜索参数或取值').fill('R01颜色');await btn('编辑').click()
  const drawer=page.getByRole('dialog',{name:'R01颜色'})
  const before=await raw()
  await drawer.locator('.row-actions').filter({has:page.getByText('颜色2',{exact:true})}).getByRole('button',{name:'删除',exact:true}).click()
  await page.getByText(/该属性值正在被草稿模型.*允许值配置/).waitFor()
  assert.equal(await raw(),before);await page.screenshot({path:resolve(out,'dictionary-reference-block.png')})
  await drawer.locator('.row-actions').filter({has:page.getByText('颜色10',{exact:true})}).getByRole('button',{name:'删除',exact:true}).click()
  await page.waitForFunction(key=>!JSON.parse(localStorage.getItem(key)).data.params.find(p=>p.id==='r01-color').values.includes('颜色10'),STORAGE_KEY)
  assert((await read()).specModelVersions.find(v=>v.id==='protection-v1').nodesSnapshot.find(n=>n.id===f.nodeId).businessConfigs[0].dictionarySnapshot.values.includes('颜色10'))
  mark('dictionary UI refuses configured color2; permits frozen-only color10; historical snapshot unchanged')
  await page.goto(`${base}/products`,{waitUntil:'networkidle'})
  // Use a route shared by both roles so switching does not race a full navigation.
  await page.locator('.topbar .el-select').click();await page.getByRole('option',{name:'身份：运营',exact:true}).click()
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).data.activeRole==='operator',STORAGE_KEY)
  await page.waitForLoadState('networkidle')
  const download=page.waitForEvent('download');await menu('导出演示数据');const stream=await (await download).createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk)
  const exported=JSON.parse(Buffer.concat(chunks).toString())
  for(const field of ['directory','draft','snapshot']){
    const next=structuredClone(exported.data)
    if(field==='directory'){next.businessDefinitions=defaultBusinessDefinitions();next.businessDefinitions[0].name='运营修改'}
    else (field==='draft'?next.productSpecNodes:next.specModelVersions.find(v=>v.id==='protection-v1').nodesSnapshot).find(n=>n.id===f.nodeId).businessConfigs[0].enabled=false
    const old=await raw();await upload(next)
    await page.locator('.el-message--error').filter({hasText:'当前角色仅可查看节点业务配置'}).waitFor()
    assert.equal(await raw(),old)
    const downloaded=page.waitForEvent('download');await menu('导出演示数据');const output=await (await downloaded).createReadStream();const bytes=[];for await(const part of output)bytes.push(part)
    assert.deepEqual(JSON.parse(Buffer.concat(bytes).toString()),exported)
    await page.screenshot({path:resolve(out,`operator-${field}-rejected.png`)})
    mark(`operator ${field} actual file import rejected; disk and exported live data unchanged`)
    await page.locator('.el-message--error').waitFor({state:'hidden'})
  }
  await page.locator('.topbar .el-select').click();await page.getByRole('option',{name:'身份：管理员',exact:true}).click()
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).data.activeRole==='admin',STORAGE_KEY)
  const backup=await read();await upload(backup);await page.getByText('已导入演示数据',{exact:true}).waitFor();assert.deepEqual(await read(),backup)
  mark('admin legal restore through same import UI preserves configs and frozen information')
  const broken=structuredClone(backup);broken.productSpecNodes.find(n=>n.id===f.nodeId).businessConfigs={id:'object-not-array'}
  const old=await raw();await upload(broken);await page.locator('.el-message--error').filter({hasText:'businessConfigs 必须是数组'}).waitFor();assert.equal(await raw(),old)
  mark('malformed config import visibly rejected without persistence change')
  const damaged=await browser.newContext();await damaged.addInitScript(({data,version,key})=>localStorage.setItem(key,JSON.stringify({version,data})),{data:broken,version:DATA_VERSION,key:STORAGE_KEY})
  const recovery=await damaged.newPage();await recovery.goto(base,{waitUntil:'networkidle'});assert.match(await recovery.locator('body').innerText(),/原始|恢复/)
  assert.equal(await recovery.evaluate(key=>localStorage.getItem(key),STORAGE_KEY),JSON.stringify({version:DATA_VERSION,data:broken}))
  await recovery.screenshot({path:resolve(out,'damaged-storage-recovery.png')});await damaged.close()
  mark('damaged stored data enters recovery with original raw bytes retained')
  assert.deepEqual(errors,[])
  writeFileSync(resolve(out,'evidence.json'),JSON.stringify({browser:await browser.version(),checks,errors},null,2))
} catch(error){if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(error),checks,errors},null,2));throw error}
finally{await browser?.close();await server.close()}
