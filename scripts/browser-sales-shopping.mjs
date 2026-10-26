import assert from 'node:assert/strict'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from 'playwright-core'
import {createTestRuntime,removeTestRuntime} from './test-runtime.mjs'
const runtime=createTestRuntime('sales-shopping'),errors=[]
let server,browser,page,groups=0
const mark=name=>{groups++;console.log(`PASS ${name}`)}
try {
 browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true})
 for(const strict of [false,true]) {
  server=await createServer({cacheDir:resolve(runtime,String(strict)),logLevel:'error',define:{'import.meta.env.VITE_RBAC_ENFORCEMENT':JSON.stringify(String(strict))},server:{host:'127.0.0.1',port:0,watch:null,hmr:false,ws:false}})
  const {createSalesConfigurationFixture}=await server.ssrLoadModule('/scripts/sales-configuration-fixtures.ts'),{DATA_VERSION}=await server.ssrLoadModule('/src/domain/types.ts')
  const {data}=createSalesConfigurationFixture()
  data.rbac.roles.push({id:'sales-local-role',code:'sales-local-role',name:'只选购',enabled:true,description:'isolated browser test',permissionCodes:['product:sales:read']})
  data.users.push({id:'sales-local-user',username:'sales-local-user',displayName:'只选购',enabled:true,role:'operator',roleIds:['sales-local-role']})
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`
  async function openContext(actor='u-admin',seed=data) {
   const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'zh-CN',reducedMotion:'reduce'})
   await context.addInitScript(({data,version,actor})=>{if(location.protocol!=='http:')return;if(!localStorage.getItem('iyge-v2-mock-db'))localStorage.setItem('iyge-v2-mock-db',JSON.stringify({version,data}));sessionStorage.setItem('iyge-rbac-simulated-user',actor);const original=Storage.prototype.setItem;window.__writes=[];Storage.prototype.setItem=function(key,value){if(key==='iyge-v2-mock-db'){if(window.__quota)throw new DOMException('sales test quota','QuotaExceededError');window.__writes.push(value)}return original.call(this,key,value)}},{data:seed,version:DATA_VERSION,actor})
   page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(String(error)));await page.goto(`${base}/sales-shopping`,{waitUntil:'networkidle'})
   await page.evaluate(async()=>{window.__store=(await import('/src/stores/catalog.ts')).useCatalogStore();await window.__store.waitForPersistence()});return context
  }
  const categoryData=structuredClone(data)
  categoryData.categories=[{id:'sales-root',name:'分类父级',parentId:null},{id:'sales-leaf',name:'叶子分类',parentId:'sales-root'},{id:'sales-mid',name:'中间分类',parentId:'sales-root'},{id:'sales-grand',name:'孙分类',parentId:'sales-mid'},{id:'sales-other',name:'其他分类',parentId:null}].map((item,sort)=>({...item,sort,enabled:true}))
  const categoryMapping={'family-device':['sales-root','父类直归商品','DeviceLab'],'family-case':['sales-leaf','叶子专属商品','CaseWorks'],'family-film':['sales-mid','中间商品','CaseWorks'],'family-charger':['sales-grand','孙类商品','CaseWorks'],'family-cable':['sales-other','其他商品','OtherBrand'],'family-unbound':['sales-other','另一商品','OtherBrand']}
  for(const family of categoryData.families){const [categoryId,name,brand]=categoryMapping[family.id];Object.assign(family,{categoryId,name,commonAttrs:{品牌:brand}})}
  const categoriesContext=await openContext('u-admin',categoryData),categoryBusiness=JSON.stringify(categoryData.families)
  const categoryTree=()=>page.locator('[data-category-tree]:visible'),familyIds=()=>page.locator('[data-sales-family]').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-sales-family')).sort())
  async function openCategories(){if(!await categoryTree().count())await page.locator('[data-sales-category-trigger]').click()}
  async function selectCategory(id){await openCategories();const parent=categoryTree().locator('[data-expand-id="sales-root"]');if(await parent.getAttribute('aria-expanded')==='false')await parent.click();if(id==='sales-grand'){const mid=categoryTree().locator('[data-expand-id="sales-mid"]');if(await mid.getAttribute('aria-expanded')==='false')await mid.click()}await categoryTree().locator(`[data-category-id="${id}"]`).click()}
  await selectCategory('sales-leaf');assert.deepEqual(await familyIds(),['family-case'],'leaf category includes itself and does not return every family')
  await selectCategory('sales-root');assert.deepEqual(await familyIds(),['family-case','family-charger','family-device','family-film'])
  await selectCategory('sales-mid');assert.deepEqual(await familyIds(),['family-charger','family-film'])
  await selectCategory('sales-leaf');await categoryTree().getByRole('button',{name:'多选',exact:true}).click();await selectCategory('sales-other');assert.deepEqual(await familyIds(),['family-cable','family-case','family-unbound'])
  await page.locator('[data-sales-category-trigger]').click();await page.locator('[data-sales-brand]').click();await page.getByRole('option',{name:'CaseWorks',exact:true}).click();await page.getByRole('textbox',{name:'搜索销售商品',exact:true}).fill('叶子专属');assert.deepEqual(await familyIds(),['family-case'])
  await openCategories();await categoryTree().getByRole('button',{name:'清除分类',exact:true}).click();assert.deepEqual(await familyIds(),['family-case'],'clear category keeps keyword and brand intersection');await page.locator('[data-sales-category-trigger]').click();await page.getByRole('textbox',{name:'搜索销售商品',exact:true}).fill('');assert.deepEqual(await familyIds(),['family-case','family-charger','family-film'])
  await page.getByRole('button',{name:'清除筛选',exact:true}).click();assert.equal((await familyIds()).length,6)
  mark(`shopping/${strict}: leaf, parent-own, descendants and explicit multi-category union intersect brand/search; clearing categories preserves other filters`)
  await openCategories();if(await categoryTree().getByRole('button',{name:'完成多选',exact:true}).count())await categoryTree().getByRole('button',{name:'完成多选',exact:true}).click();await selectCategory('sales-leaf');await page.locator('[data-sales-category-trigger]').click()
  await page.evaluate(async()=>{window.__store.data.categories=window.__store.data.categories.filter(item=>item.id!=='sales-leaf');await window.__store.waitForPersistence()})
  assert.deepEqual(await familyIds(),[],'deleted selected category fails closed instead of expanding to all products');await page.locator('[data-sales-category-invalid]').waitFor();assert.match(await page.locator('[data-sales-category-invalid]').innerText(),/失效/)
  await openCategories();await categoryTree().getByRole('button',{name:'多选',exact:true}).click();await selectCategory('sales-other');await page.locator('[data-sales-category-trigger]').click();assert.deepEqual(await familyIds(),[],'mixed invalid/valid selection remains invalid')
  await page.locator('[data-sales-category-invalid]').getByRole('button',{name:'清除分类',exact:true}).click();assert.equal((await familyIds()).length,6);assert.equal(await page.locator('[data-sales-category-invalid]').count(),0)
  assert.equal(JSON.stringify((await page.evaluate(()=>JSON.parse(JSON.stringify(window.__store.data)))).families),categoryBusiness)
  mark(`shopping/${strict}: deleted or partially invalid category selection has an explicit clearable error and cannot broaden results; family category ownership unchanged`)
  await categoriesContext.close()
  const context=await openContext()
  const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__store.data))),raw=()=>page.evaluate(()=>localStorage.getItem('iyge-v2-mock-db'))
  const business=d=>JSON.stringify([d.families,d.skus,d.specModelVersions,d.planningRecords,d.materialReceipts,d.compatibilities]),before=business(await read())
  const basket=()=>page.locator('[data-sales-basket]'),positions=()=>basket().locator('[data-sales-position]'),candidate=id=>page.locator(`[data-sales-candidate-sku="${id}"]`),addCandidate=id=>candidate(id).getByRole('button',{name:'加入',exact:true}).click()
  async function settle(){await page.waitForTimeout(250);await page.evaluate(async()=>{await window.__store.waitForPersistence();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})}
  async function hold(){await settle();await page.evaluate(async()=>{const {CATALOG_LOCK}=await import('/src/stores/catalogPersistence.ts');window.__held=false;window.__hold=navigator.locks.request(CATALOG_LOCK,()=>new Promise(resolve=>{window.__held=true;window.__release=resolve}))});await page.waitForFunction(()=>window.__held)}
  async function waiting(){for(let attempt=0;attempt<120;attempt++){if(await page.evaluate(async()=>(await navigator.locks.query()).pending.length>0))return;await page.waitForTimeout(25)}throw Error('No actual Store request reached the held Web Lock')}
  async function release(){await page.evaluate(()=>window.__release());await settle()}
  async function openPhone(){await page.locator('[data-sales-family="family-device"]').click();await page.locator('[data-sales-sku="phone-a"]').click()}
  await openPhone();assert.equal(await positions().count(),0);assert.equal((await read()).benefitPackages.length,0);await candidate('case-sku').waitFor();assert.match(await candidate('case-sku').innerText(),/已确认适用/)
  mark(`shopping/${strict}: find phone and real specification; related case appears without creating a purchase`)

  await hold();const beforeBurst=await raw();await page.locator('[data-sales-add-current="phone-a"]').click();await waiting();assert.equal(await positions().count(),1)
  await page.locator('[data-sales-candidate]').filter({has:page.getByText('延保服务',{exact:true})}).getByRole('button',{name:'加入',exact:true}).click()
  await addCandidate('case-sku');assert.match(await page.locator('[data-sales-current-source]').innerText(),/case-sku/);await candidate('film-sku').waitFor();assert.match(await page.locator('[data-sales-device]').innerText(),/隔离测试手机/)
  await addCandidate('film-sku');assert.equal(await positions().count(),3)
  await positions().last().getByRole('button',{name:/^移除 /}).click();assert.equal(await positions().count(),2);await addCandidate('film-sku');assert.equal(await positions().count(),3)
  assert.equal(await raw(),beforeBurst);await release();let state=await read(),scheme=state.benefitPackages[0]
  assert.equal(state.benefitPackages.length,1);assert.equal(scheme.goods.length,3);assert.equal(scheme.services.length,1);assert.equal(scheme.device.skuId,'phone-a')
  const casing=scheme.goods.find(line=>line.skuId==='case-sku'),film=scheme.goods.find(line=>line.skuId==='film-sku')
  assert.equal(scheme.sales.origins.find(origin=>origin.positionId===film.id).sourcePositionId,casing.id)
  mark(`shopping/${strict}: real held save accepts phone → service → case → film → remove/add; one ledger, original device and exact source position retained`)

  await page.locator(`[data-sales-position="${casing.id}"]`).getByRole('button',{name:/^移除 /}).click();await settle();assert.equal(await positions().count(),2);assert.match(await page.locator(`[data-sales-position="${film.id}"]`).innerText(),/来源商品已移除|依赖/)
  const pendingScheme=(await read()).benefitPackages.find(item=>item.id===scheme.id)
  assert(!pendingScheme.goods.some(line=>line.id===casing.id),'source removal autosaves instead of leaving the old source on disk');assert(pendingScheme.goods.some(line=>line.id===film.id));assert(pendingScheme.sales.contexts.some(item=>item.sourcePositionId===casing.id),'downstream frozen context survives normal source removal')
  assert(!JSON.parse(await raw()).data.benefitPackages.find(item=>item.id===scheme.id).goods.some(line=>line.id===casing.id))
  await page.goto(`${base}/sales-shopping?scheme=${scheme.id}`,{waitUntil:'networkidle'});await page.evaluate(async()=>{window.__store=(await import('/src/stores/catalog.ts')).useCatalogStore();await window.__store.waitForPersistence()})
  assert.equal(await positions().count(),2);assert.match(await page.locator(`[data-sales-position="${film.id}"]`).innerText(),/来源商品已移除|依赖/)
  await page.locator('[data-sales-checkout]').click();assert.match(await basket().innerText(),/来源商品已移除|依赖/);assert.equal(await page.getByRole('dialog',{name:'核对交付清单',exact:true}).count(),0)
  await page.locator(`[data-sales-position="${film.id}"]`).getByRole('button',{name:/^移除 /}).click();await positions().first().locator('.product-link').click();await addCandidate('case-sku');await addCandidate('film-sku');await settle();assert.equal(await positions().count(),3)
  mark(`shopping/${strict}: source removal autosaves a pending draft, refresh keeps downstream goods and frozen source, delivery blocks, explicit reselection repairs purpose`)

  const beforeFailure=await raw();await page.evaluate(()=>window.__quota=true);await positions().last().getByRole('spinbutton').fill('2');await positions().last().getByRole('spinbutton').press('Enter');await positions().last().getByRole('spinbutton').blur();await settle()
  assert.equal(await raw(),beforeFailure);await page.getByRole('button',{name:'重试保存',exact:true}).waitFor();await positions().last().getByRole('spinbutton').fill('3');await positions().last().getByRole('spinbutton').press('Enter');await positions().last().getByRole('spinbutton').blur();await page.evaluate(()=>window.__quota=false);await page.getByRole('button',{name:'重试保存',exact:true}).click();await settle()
  assert.equal((await read()).benefitPackages[0].goods.find(line=>line.skuId==='film-sku').quantity,3)
  mark(`shopping/${strict}: atomic save failure keeps editable quantity; retry persists later input`)

  await page.getByRole('button',{name:'填写报价',exact:true}).click();const quote=page.getByRole('textbox',{name:'本次方案报价',exact:true})
  await hold();const quoteBefore=(await read()).benefitPackages[0].quote.amountCents
  await quote.dispatchEvent('compositionstart');await quote.fill('1299');await quote.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229});await page.waitForTimeout(100);assert.equal((await read()).benefitPackages[0].quote.amountCents,quoteBefore)
  await quote.dispatchEvent('compositionend');await quote.press('Enter');await waiting();await quote.blur();await release();assert.equal((await read()).benefitPackages[0].quote.amountCents,129900)
  await page.getByRole('button',{name:'核对报价',exact:true}).click();await settle();await page.locator('[data-sales-checkout]').click();await page.getByRole('dialog',{name:'核对交付清单',exact:true}).waitFor()
  await page.getByRole('dialog',{name:'核对交付清单',exact:true}).locator('label.el-checkbox').click();assert(await page.getByRole('checkbox',{name:'已核对商品、数量、适用条件与报价',exact:true}).isChecked());await page.locator('[data-sales-generate]').click();await page.waitForURL(/\/benefit-packages\/deliveries\//)
  state=await read();const snapshot=state.benefitDeliveries[0];assert.equal(snapshot.goods.length,3);assert.equal(snapshot.services.length,1);assert.equal(snapshot.quote.amountCents,129900);assert(snapshot.sales.origins.length>=3);assert(snapshot.sales.contexts.some(item=>item.plan.planId==='sales-plan-phone'));assert.equal(business(state),before)
  mark(`shopping/${strict}: IME/Enter/blur quote input, review, existing delivery confirmation and frozen sales origins succeed`)

  await page.goto(`${base}/sales-shopping?scheme=${state.benefitPackages[0].id}`,{waitUntil:'networkidle'});await page.evaluate(async()=>window.__store=(await import('/src/stores/catalog.ts')).useCatalogStore())
  await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.setViewportSize({width:620,height:900});await basket().scrollIntoViewIfNeeded();assert(await basket().isVisible());assert((await page.locator('.sales-grid').boundingBox()).width<=620);assert(await page.locator('[data-sales-checkout]').isEnabled())
  assert.equal(JSON.stringify((await read()).benefitDeliveries[0]),JSON.stringify(snapshot));mark(`shopping/${strict}: saved shopping scheme opens on narrow dark layout without modifying frozen delivery`)
  await context.close()
  if(strict){const reader=await openContext('sales-local-user',state);await openPhone();const beforeLocal=await raw();await page.locator('[data-sales-add-current="phone-a"]').click();await page.waitForTimeout(400);assert.equal(await positions().count(),1);assert.equal(await raw(),beforeLocal);assert(await page.locator('[data-sales-save]').isDisabled());assert.match(await page.locator('[data-sales-save-state]').innerText(),/临时选购/);mark('shopping/strict: sales-only role can browse and choose locally; save and delivery remain protected with zero writes');await page.goto(`${base}/sales-shopping?scheme=${state.benefitPackages[0].id}`,{waitUntil:'networkidle'});assert.equal(await basket().count(),0);assert.match(await page.locator('body').innerText(),/销售方案不存在或当前身份不可访问/);assert.equal(await raw(),beforeLocal);mark('shopping/strict: saved-scheme direct URL is denied without benefit read permission and cannot expose its contents');await reader.close()}
  const conditionalData=structuredClone(data)
  conditionalData.salesOptionBindings=conditionalData.salesOptionBindings.filter(binding=>binding.planId!=='sales-plan-case')
  conditionalData.salesProductRelations=[{schemaVersion:1,id:'browser-conditional',revision:1,enabled:true,sourceSkuId:'case-sku',targetSkuId:'film-sku',kind:'applicability',conclusion:'conditional',verification:'confirmed',conditions:[{kind:'manual',text:'检查边缘贴合'}],source:'实际核验记录',note:'',updatedAt:new Date().toISOString()}]
  // A product name mentioning fast charge must not change a basic-fit confirmation into a charging confirmation.
  conditionalData.skus.find(sku=>sku.id==='film-sku').skuName='快充配套保护膜'
  const conditionalContext=await openContext('u-admin',conditionalData)
  await openPhone();await page.locator('[data-sales-add-current="phone-a"]').click();await addCandidate('case-sku');assert.match(await candidate('film-sku').innerText(),/需核对条件/);await addCandidate('film-sku')
  const conditionRow=positions().last();await conditionRow.locator('summary').click();assert.match(await conditionRow.innerText(),/检查边缘贴合/)
  await conditionRow.getByRole('textbox',{name:'本次条件确认说明',exact:true}).fill('已逐项检查边缘贴合');await conditionRow.getByRole('button',{name:'确认本次条件',exact:true}).click();await settle()
  assert.equal(await conditionRow.getByRole('button',{name:'确认本次条件',exact:true}).count(),0)
  const confirmedScheme=(await read()).benefitPackages[0],confirmation=confirmedScheme.confirmations[0]
  assert.equal(confirmation.capability,'basic');assert.equal(confirmation.positionId,confirmedScheme.goods.find(line=>line.skuId==='film-sku').id);assert(confirmation.conditionLabels.some(label=>label.includes('检查边缘贴合')))
  mark(`shopping/${strict}: actual conditional evidence is visible; confirmation uses exact purpose and capability rather than product wording`)
  await conditionalContext.close()
  await server.close();server=undefined
 }
 assert.deepEqual(errors,[]);console.log(`PASS sales shopping browser ${groups} groups; no screenshots or persistent artifacts`)
}catch(error){console.error(error);if(page)console.error((await page.locator('body').innerText()).slice(0,6500));process.exitCode=1}
finally{if(browser)await browser.close();if(server)await server.close();removeTestRuntime(runtime)}
