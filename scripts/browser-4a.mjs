import { chromium } from 'playwright-core'

const base = process.env.SMOKE_URL || 'http://127.0.0.1:5190'
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))

await page.addInitScript(() => {
  window.__pack = (data) => JSON.stringify({
    families: data.families.map((item) => ({
      id: item.id,
      name: item.name,
      line: item.line || '',
      categoryId: item.categoryId,
      templateId: item.templateId,
      productTypeId: item.productTypeId || '',
      modelVersionId: item.modelVersionId || '',
      productModelId: item.productModelId || '',
      commonSignature: item.commonSignature || '',
    })),
    skus: data.skus.map((item) => ({
      id: item.id,
      familyId: item.familyId,
      code: item.code || '',
      skuName: item.skuName || '',
      materialCode: item.materialCode || '',
      planningId: item.planningId || '',
      modelVersionId: item.modelVersionId || '',
      status: item.status,
      variantAttrs: item.variantAttrs,
    })),
    plans: (data.planningRecords || []).map((item) => ({
      id: item.planningId,
      versions: [...(item.modelVersionIds || [])],
      status: item.status,
      origin: item.origin || '',
    })),
    receipts: (data.materialReceipts || []).map((item) => ({
      requestId: item.requestId,
      skuId: item.skuId,
      materialCode: item.materialCode,
      planningId: item.planningId,
      lifecycle: item.lifecycle || '',
    })),
  })
})

async function packStored() {
  return page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    return window.__pack(raw.data)
  })
}

try {
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.locator('.list-switch').waitFor()
  await page.getByPlaceholder('名称、分类、属性、SKU、OA 编号').fill('4a')
  await page.waitForFunction(() => Boolean(localStorage.getItem('iyge-v2-mock-db')))
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    const data = raw.data
    data.families.unshift(
      {
        id: 'fam-4a-empty',
        name: '4A空款',
        templateId: 't-phone',
        productModelId: 't-phone',
        modelVersionId: 'phone-model-v1',
        categoryId: 'c-phone',
        oaProductId: '',
        commonAttrs: { 品牌: 'Apple' },
        productGroupIds: [],
        lifecycle: 'draft',
        shelfStatus: 'draft',
        createdAt: '2026-10-20T02:00:00.000Z',
        origin: 'created',
        updatedAt: '2026-10-20T02:00:00.000Z',
      },
      {
        id: 'fam-4a',
        name: '4A物料款',
        templateId: 't-phone',
        productModelId: 't-phone',
        modelVersionId: 'phone-model-v1',
        productTypeId: 'pt-phone',
        line: 'v3',
        commonSignature: '4a',
        categoryId: 'c-phone',
        oaProductId: '',
        commonAttrs: { 品牌: 'Apple' },
        productGroupIds: [],
        lifecycle: 'draft',
        shelfStatus: 'draft',
        createdAt: '2026-10-20T01:00:00.000Z',
        origin: 'created',
        updatedAt: '2026-10-20T01:00:00.000Z',
      },
    )
    data.skus.push(
      { id: 'mat-4a-1', familyId: 'fam-4a', code: '', oaSkuId: '', status: 'draft', variantAttrs: { 颜色: '黑色' }, projectedAttrs: { 颜色: '黑色' }, skuName: '物料甲', planningId: 'PLN-4A', modelVersionId: 'phone-model-v1', materialCode: 'MAT-4A-1' },
      { id: 'mat-4a-2', familyId: 'fam-4a', code: '', oaSkuId: '', status: 'draft', variantAttrs: { 颜色: '白色' }, projectedAttrs: { 颜色: '白色' }, skuName: '物料乙', planningId: 'PLN-4A', modelVersionId: 'phone-model-v2', materialCode: 'MAT-4A-2' },
    )
    data.planningRecords.push({
      planningId: 'PLN-4A',
      productModelId: 't-phone',
      originModelVersionId: 'phone-model-v1',
      modelVersionId: 'phone-model-v1',
      modelVersionIds: ['phone-model-v1', 'phone-model-v2'],
      steps: [],
      identityKey: '4a',
      status: 'active',
      createdTime: '2026-10-20T01:00:00.000Z',
    })
    data.materialReceipts.push(
      { requestId: '4a-1', skuId: 'mat-4a-1', planningId: 'PLN-4A', materialCode: 'MAT-4A-1', createdTime: '2026-10-20T01:00:00.000Z', lifecycle: 'active' },
      { requestId: '4a-2', skuId: 'mat-4a-2', planningId: 'PLN-4A', materialCode: 'MAT-4A-2', createdTime: '2026-10-20T01:00:00.000Z', lifecycle: 'active' },
    )
    const active = (data.productListViews || []).find((item) => item.id === data.activeProductListViewId) || data.productListViews?.[0]
    if (active) {
      active.mode = 'spu'
      if (active.spuQuery) {
        active.spuQuery.keyword = ''
        active.spuQuery.filters = []
      }
    }
    data.productListMode = 'spu'
    data.listQuery.keyword = ''
    data.listQuery.page = 1
    data.listQuery.pageSize = 10
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.spu-table .linkish', { hasText: 'Apple iPhone 17' }).first().waitFor()
  const before = await packStored()

  if ((await page.locator('.list-switch').getAttribute('data-mode')) !== 'spu') throw new Error('默认不是 SPU 视图')
  const spuCount = await page.locator('[data-result-count]').innerText()
  if (!spuCount.includes('商品 8 款')) throw new Error('SPU 总数不对：' + spuCount)
  const emptyCount = await page.locator('[data-family-id="fam-4a-empty"]').locator('xpath=ancestor::tr[1]').locator('[data-sku-count]').innerText()
  const materialSkuCount = await page.locator('[data-family-id="fam-4a"]').locator('xpath=ancestor::tr[1]').locator('[data-sku-count]').innerText()
  if (emptyCount !== '未建立' || materialSkuCount !== '未建立') throw new Error(`空款 ${emptyCount} 物料款 ${materialSkuCount}`)
  const materialRow = page.locator('.spu-table tr.el-table__row', { hasText: '4A物料款' }).first()
  if (!(await materialRow.innerText()).includes('已建物料 2 条')) throw new Error('物料摘要没有单独显示')
  if (!(await materialRow.innerText()).includes('手机')) throw new Error('产品类型没有显示')
  await materialRow.locator('.el-table__expand-icon').click()
  const materialExpand = page.locator('.sku-expand[data-family-id="fam-4a"]')
  await materialExpand.waitFor()
  const materialExpandText = await materialExpand.innerText()
  if (!materialExpandText.includes('还没有真实 SKU') || materialExpandText.includes('物料甲') || materialExpandText.includes('MAT-4A')) {
    throw new Error('物料被展开成 SKU：' + materialExpandText)
  }
  const phoneRow = page.locator('.spu-table tr.el-table__row', { hasText: 'Apple iPhone 17' }).first()
  await phoneRow.locator('.el-table__expand-icon').click()
  const phoneExpand = page.locator('.sku-expand[data-family-id="f-iphone"]')
  await phoneExpand.waitFor()
  const phoneText = await phoneExpand.innerText()
  if (!phoneText.includes('s-iphone-blue') || !phoneText.includes('s-iphone-white') || !phoneText.includes('颜色 蓝色') || !phoneText.includes('颜色 白色') || !phoneText.includes('网络版本 A1533（电信）')) {
    throw new Error('iPhone 展开规格不对：' + phoneText)
  }
  if (phoneText.includes('s-watch')) throw new Error('手表 SKU 串到了 iPhone')

  await page.locator('.list-switch .el-radio-button', { hasText: '规格' }).click()
  await page.locator('.list-switch[data-mode="sku"]').waitFor()
  const skuCount = await page.locator('[data-result-count]').innerText()
  if (skuCount !== 'SKU 10 条') throw new Error('SKU 总数不对：' + skuCount)
  const skuIds = await page.locator('.sku-table [data-sku-id]').allInnerTexts()
  const skuSpecs = await page.locator('.sku-table [data-sku-spec]').allInnerTexts()
  if (skuIds.includes('mat-4a-1') || skuIds.includes('mat-4a-2')) throw new Error('SKU 视图混入了物料：' + skuIds.join())
  if (skuSpecs.some((item) => item.includes('PLN-') || item.includes('MAT-') || item.includes('512G') || item.includes('物料甲'))) {
    throw new Error('规格被猜测或混入物料：' + skuSpecs.join(' | '))
  }
  const blue = skuSpecs.find((item, index) => skuIds[index] === 's-iphone-blue')
  const white = skuSpecs.find((item, index) => skuIds[index] === 's-iphone-white')
  if (!blue?.includes('容量 256G') || !blue.includes('颜色 蓝色') || !white?.includes('颜色 白色') || !white.includes('网络版本 A1533（电信）')) {
    throw new Error(`蓝 ${blue || ''} 白 ${white || ''}`)
  }
  if (new Set(skuIds).size !== skuIds.length || skuIds.length !== 10) throw new Error('SKU 没有逐条展开：' + skuIds.join())

  const keyword = page.getByPlaceholder('名称、分类、属性、SKU、OA 编号')
  await keyword.fill('蓝色')
  await keyword.press('Enter')
  await page.locator('.sku-table [data-sku-id="s-iphone-blue"]').waitFor()
  const searched = await page.locator('.sku-table [data-sku-id]').allInnerTexts()
  if (searched.includes('s-iphone-white') || searched.includes('mat-4a-1') || !searched.includes('s-iphone-blue') || !searched.includes('s-pad-1')) {
    throw new Error('搜索结果不对：' + searched.join())
  }
  await keyword.fill('没有这件商品')
  await keyword.press('Enter')
  await page.locator('[data-empty="sku"]').waitFor()
  const emptySku = await page.locator('[data-empty="sku"]').innerText()
  if (!emptySku.includes('没有符合条件的真实 SKU')) throw new Error('空状态不对：' + emptySku)
  await keyword.fill('')
  await keyword.press('Enter')
  await page.locator('.sku-table [data-sku-id]').first().waitFor()

  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('iyge-v2-mock-db') || '{}')
    raw.data.listQuery.pageSize = 2
    raw.data.listQuery.page = 99
    raw.data.listQuery.keyword = ''
    raw.data.productListMode = 'sku'
    localStorage.setItem('iyge-v2-mock-db', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.el-pagination .is-active', { hasText: '5' }).waitFor()
  const visibleAfterClamp = await page.locator('.sku-table [data-sku-id]').count()
  if (visibleAfterClamp === 0) throw new Error('越界页被夹住后仍然没有行')
  await page.locator('.el-pagination .btn-prev').click()
  await page.locator('.el-pagination .is-active', { hasText: '4' }).waitFor()
  if ((await page.locator('.sku-table [data-sku-id]').count()) === 0) throw new Error('翻页后没有 SKU')
  await page.locator('.list-switch .el-radio-button', { hasText: '商品' }).click()
  await page.locator('.list-switch[data-mode="spu"]').waitFor()
  await page.locator('.el-pagination .is-active', { hasText: '1' }).waitFor()
  if ((await page.locator('.spu-table [data-family-id]').count()) === 0) throw new Error('切回 SPU 后是空白页')

  await page.locator('.list-switch .el-radio-button', { hasText: '规格' }).click()
  await keyword.fill('s-iphone-blue')
  await keyword.press('Enter')
  await page.locator('.sku-table tr', { hasText: 's-iphone-blue' }).getByRole('button', { name: '商品详情' }).click()
  await page.waitForURL('**/products/f-iphone?sku=s-iphone-blue')
  await page.getByRole('heading', { name: '基本信息' }).waitFor()
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.locator('.list-switch[data-mode="sku"]').waitFor()
  await keyword.fill('')
  await keyword.press('Enter')
  await page.locator('.list-switch .el-radio-button', { hasText: '商品' }).click()
  await page.locator('.spu-table tr.el-table__row', { hasText: '4A物料款' }).getByRole('button', { name: '管理物料' }).click()
  await page.getByText('物料 MAT-4A-1 · 规划 PLN-4A').waitFor()
  await page.getByText('MAT-4A-2').first().waitFor()
  await page.getByText('物料乙').first().waitFor()
  await page.goto(`${base}/products`, { waitUntil: 'networkidle' })
  await page.locator('.list-switch .el-radio-button', { hasText: '规格' }).click()
  await page.locator('.list-switch[data-mode="sku"]').waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  if ((await page.locator('.list-switch').getAttribute('data-mode')) !== 'sku') throw new Error('刷新后没有按已保存视图恢复规格模式')
  const refreshedSku = await page.locator('.sku-table [data-sku-id]').allInnerTexts()
  if (!refreshedSku.length || refreshedSku.some((item) => item.includes('MAT-') || item.includes('PLN-'))) {
    throw new Error('刷新后的规格表不正确：' + refreshedSku.join())
  }
  await page.locator('.list-switch .el-radio-button', { hasText: '商品' }).click()
  await page.locator('.list-switch[data-mode="spu"]').waitFor()
  if ((await page.locator('[data-result-count]').innerText()) !== '商品 8 款') throw new Error('切回商品模式后数量不对')
  await keyword.fill('iPhone')
  await keyword.press('Enter')
  await page.locator('.spu-table .linkish', { hasText: 'Apple iPhone 17' }).first().waitFor()
  await keyword.fill('')
  await keyword.press('Enter')

  const after = await packStored()
  if (before !== after) throw new Error('浏览之后业务数据变了')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({ ok: true, spu: spuCount, sku: skuCount, skuRows: skuIds.length, searched, clampedPage: '5' }))
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
