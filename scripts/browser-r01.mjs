import assert from 'node:assert/strict'
import { mkdirSync,writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
const out=resolve(process.env.R01_BROWSER_OUTPUT||'work/r01-20261025/browser-1');mkdirSync(out,{recursive:true})
const server=await createServer({cacheDir:resolve(out,'cache'),server:{host:'127.0.0.1',port:0,open:false,hmr:false,watch:null}})
const checks=[],errors=[];let browser,page
try{
  const {r01Fixture}=await server.ssrLoadModule('/scripts/r01-fixture.ts');const {data}=r01Fixture()
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  browser=await chromium.launch({channel:'chrome',headless:true})
  const context=await browser.newContext({viewport:{width:1600,height:1000},locale:'zh-CN',reducedMotion:'reduce'})
  await context.addInitScript(data=>{
    if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version:15,data}))
    localStorage.setItem('iyge-v2-theme','light')
    const original=Storage.prototype.setItem
    Storage.prototype.setItem=function(k,v){if(k==='iyge-v2-mock-db'&&window.__r01Fail)throw new DOMException('R01 quota','QuotaExceededError');return original.call(this,k,v)}
  },data)
  page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)))
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('iyge-v2-mock-db')).data)
  const mark=async name=>{checks.push({name,passed:true});console.log('PASS browser R01 '+name)}
  const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true})
  const panel=()=>page.getByRole('dialog',{name:'节点业务配置',exact:true})
  const pick=async(label,text,scope=panel())=>{await scope.locator('.el-select').filter({has:page.getByRole('combobox',{name:label,exact:true})}).click();await page.getByRole('option',{name:text,exact:true}).click();await page.keyboard.press('Escape') }
  const selectNode=async id=>{await page.locator(`.vue-flow__node[data-id="${id}"]`).click();await page.waitForTimeout(120)}
  const open=async id=>{await selectNode(id);await page.locator('[data-open-business]').click();await panel().waitFor()}
  const close=async()=>{await button('关闭',panel()).click();await panel().waitFor({state:'hidden'})}
  const record=name=>panel().locator('.business-record').filter({has:page.locator('strong').getByText(name,{exact:true})})
  const save=async()=>{await page.locator('[data-save-business]').click();await page.locator('[data-business-form]').waitFor({state:'hidden'});await page.waitForTimeout(150)}
  await page.goto(`${base}/specs?template=r01-model`,{waitUntil:'networkidle'})
  await open('r01-model-apple');await button('添加业务配置',panel()).click();await pick('配置功能','销售定位');await pick('作用范围','当前值及其下级');await pick('配置值','畅销');await save()
  assert.match(await panel().innerText(),/来源：Apple/)
  await button('添加业务配置',panel()).click();await pick('配置功能','物料策略');await pick('配置值','共用物料（需明确选择目标）');await save()
  await button('添加业务配置',panel()).click();await pick('配置功能','允许值限制');await pick('下级目标属性','R01颜色')
  for(let i=1;i<=5;i++)await pick('允许词典值',`颜色${i}`)
  await save();await page.screenshot({path:resolve(out,'desktop-config.png')});await close()
  await mark('从 Apple 值节点配置销售定位、共用物料策略和 5 色限制，显示来源')
  await selectNode('r01-model-apple-color');await button('添加属性值',page.locator('.node-ops')).click()
  const activeDialog=page.getByRole('dialog',{name:'添加属性值',exact:true})
  await activeDialog.locator('.el-select').click()
  assert.equal(await page.getByRole('option',{name:'颜色6',exact:true}).count(),0)
  await page.getByRole('option',{name:'颜色2',exact:true}).click();await page.keyboard.press('Escape')
  await button('确定',activeDialog).click();await page.waitForTimeout(250)
  await selectNode('r01-model-other-color');await button('添加属性值',page.locator('.node-ops')).click()
  await activeDialog.locator('.el-select').click()
  assert(await page.getByRole('option',{name:'颜色10',exact:true}).count())
  await page.keyboard.press('Escape');await button('取消',activeDialog).click()
  await mark('真实新增值选择：Apple 无第 6 色，其他品牌可选第 10 色')
  for(const [mode,color] of [['大纲视图','颜色3'],['幕布模式','颜色1']]) {
    await page.locator('.view-switch').getByText(mode,{exact:true}).click()
    await page.locator('[data-line="r01-model-apple-c1"]').click()
    await page.getByRole('option',{name:color,exact:true}).waitFor()
    assert.equal(await page.getByRole('option',{name:'颜色6',exact:true}).count(),0)
    await page.getByRole('option',{name:color,exact:true}).click();await page.keyboard.press('Escape')
    await page.waitForTimeout(180);assert.equal((await read()).productSpecNodes.find(n=>n.id==='r01-model-apple-c1').valueId,color)
  }
  await page.locator('.view-switch').getByText('结构视图',{exact:true}).click()
  await mark('大纲/幕布真实重绑采用相同 5 色限制，原节点身份保留')
  await button('保存模型').click();await page.waitForTimeout(300);await page.reload({waitUntil:'networkidle'})
  let current=await read();assert.equal(current.productSpecNodes.find(n=>n.id==='r01-model-apple').businessConfigs.length,3)
  assert(current.productSpecNodes.some(n=>n.templateId==='r01-model'&&n.parentId==='r01-model-apple-color'&&n.valueId==='颜色2'))
  await button('发布模型').click();await page.waitForTimeout(350)
  current=await read();const v1=current.specModelVersions.find(v=>v.templateId==='r01-model');assert(v1);const frozen=JSON.stringify(v1)
  await open('r01-model-apple');await button('编辑配置',record('销售定位')).click();await pick('配置值','不畅销');await save()
  await pick('业务配置版本','V1（只读快照）');assert.match(await panel().innerText(),/销售定位：\s*畅销/);assert.equal(await button('添加业务配置',panel()).count(),0)
  await panel().locator('strong').first().click();await page.waitForTimeout(150);await page.screenshot({path:resolve(out,'v1-readonly.png')});await close()
  assert.equal(JSON.stringify((await read()).specModelVersions.find(v=>v.id===v1.id)),frozen)
  await mark('保存刷新、发布 V1、修改草稿、只读查看 V1 原配置')
  await open('r01-model-apple-c1');await button('添加业务配置',panel()).click();await pick('配置功能','销售定位');await pick('配置值','畅销');await save()
  assert.match(await panel().innerText(),/配置冲突/);await page.screenshot({path:resolve(out,'conflict.png')});await close()
  await button('保存模型').click();await page.waitForTimeout(150);await button('发布模型').click();await page.waitForTimeout(250)
  assert.equal((await read()).specModelVersions.filter(v=>v.templateId==='r01-model').length,1)
  await page.getByRole('button',{name:/业务配置问题 .*定位/}).click();assert.match(await panel().innerText(),/冲突/)
  await button('删除配置',record('销售定位')).click();await page.waitForTimeout(150);await close()
  await button('发布模型').click();await page.waitForTimeout(250);assert.equal((await read()).specModelVersions.filter(v=>v.templateId==='r01-model').length,2)
  await mark('冲突草稿保存、发布拒绝、定位节点、删除冲突并成功发布 V2')
  await page.setViewportSize({width:980,height:720});await page.locator('.view-switch').getByText('大纲视图',{exact:true}).click();await page.locator('[data-line="r01-model-apple"]').click();await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('[data-open-business]').click()
  await button('编辑配置',record('物料策略')).click();await pick('配置值','独立物料')
  await page.evaluate(()=>window.__r01Fail=true);await page.locator('[data-save-business]').click();await page.waitForTimeout(250)
  assert(await page.locator('[data-business-form]').isVisible());assert.match(await panel().innerText(),/无法保存|quota|配额/)
  await page.screenshot({path:resolve(out,'narrow-save-failure.png')})
  await page.evaluate(()=>window.__r01Fail=false);await save()
  await panel().locator('.el-dialog__body').evaluate(el=>el.scrollTop=el.scrollHeight)
  const box=await button('关闭',panel()).boundingBox();assert(box&&box.x>=0&&box.y+box.height<=720)
  await page.screenshot({path:resolve(out,'narrow-config.png')});await close()
  await mark('980px 窄窗口可滚动、按钮可达；配额失败保留输入并重试成功')
  await page.locator('.board').press('Control+z');await page.waitForTimeout(250)
  assert.equal((await read()).productSpecNodes.find(n=>n.id==='r01-model-apple').businessConfigs.find(c=>c.definitionId==='business:material').parameters.value,'shared')
  await mark('真实 Ctrl+Z 撤销业务配置修改，沿用当前模型编辑历史')
  // Two pages share an isolated origin, while their forms keep independent drafts.
  const first=page,second=await context.newPage();second.setDefaultTimeout(12000);second.on('pageerror',e=>errors.push(String(e)))
  page=second;await page.goto(`${base}/specs?template=r01-model`,{waitUntil:'networkidle'});await open('r01-model-apple')
  await button('编辑配置',record('物料策略')).click();await pick('配置值','共用物料（需明确选择目标）')
  page=first;await page.locator('[data-line="r01-model-apple"]').click();await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('[data-open-business]').click();await button('编辑配置',record('物料策略')).click();await pick('配置值','独立物料');await save()
  const newest=JSON.stringify(await read())
  page=second;await page.locator('[data-save-business]').click();await page.waitForTimeout(250)
  assert(await page.locator('[data-business-form]').isVisible());assert.match(await panel().innerText(),/其他|外部|更新|变化/);assert.equal(JSON.stringify(await read()),newest)
  await page.screenshot({path:resolve(out,'concurrent-input-preserved.png')});await mark('两个真实 Page：旧页保存拒绝，表单输入保留且不覆盖新配置')
  await second.close();page=first
  await panel().getByRole('tab',{name:'公共配置目录'}).click()
  await button('维护目录项',record('销售定位')).click();await button('删除目录项',panel()).click();await page.waitForTimeout(150)
  assert.match(await panel().innerText(),/被草稿或历史发布版本引用/)
  await panel().getByRole('textbox',{name:'目录名称',exact:true}).fill('销售定位（目录维护验收）')
  await panel().locator('label.el-checkbox').filter({hasText:'允许新增实例'}).click();await button('保存目录项',panel()).click();await page.waitForTimeout(200)
  assert((await read()).businessDefinitions.some(d=>d.id==='business:sales'&&!d.enabled))
  assert.equal(JSON.stringify((await read()).specModelVersions.find(v=>v.id===v1.id)),frozen)
  await mark('公共目录真实维护/停用及引用删除保护，旧发布 V1 保持不变')
  assert.deepEqual(errors,[])
  writeFileSync(resolve(out,'result.json'),JSON.stringify({passed:true,checks,errors},null,2))
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(error),checks,errors},null,2));if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error}
finally{await browser?.close();await server.close()}
