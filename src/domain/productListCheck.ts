import { normalizeStored } from '../stores/catalog'
import { familyMaterialDigest } from './material'
import { listFamilies, listRealSkuRows, materialArchivesOf, realSkusOf, savedSkuSpec, slicePage, skuCountText } from './productList'
import { createSeed, emptyQuery } from './seed'
import type { AppData, ProductFamily, Sku } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function check(id: string, ok: boolean, detail: string): CheckResult {
  return { id, ok, detail }
}

function snapshot(data: AppData) {
  return JSON.stringify({
    families: data.families,
    skus: data.skus,
    plans: data.planningRecords,
    receipts: data.materialReceipts,
    versions: data.specModelVersions,
    compatibilities: data.compatibilities,
  })
}

function family(partial: Partial<ProductFamily> & Pick<ProductFamily, 'id' | 'name'>): ProductFamily {
  return {
    templateId: 't-phone',
    categoryId: 'c-phone',
    oaProductId: '',
    commonAttrs: {},
    productGroupIds: [],
    lifecycle: 'draft',
    shelfStatus: 'draft',
    origin: 'created',
    updatedAt: '2026-10-20T00:00:00.000Z',
    ...partial,
  }
}

function sku(partial: Partial<Sku> & Pick<Sku, 'id' | 'familyId'>): Sku {
  return {
    code: '',
    oaSkuId: '',
    status: 'draft',
    variantAttrs: {},
    projectedAttrs: {},
    ...partial,
  }
}

export function runProductListChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const data = createSeed()
  const before = snapshot(data)
  const iphone = listFamilies(data, emptyQuery()).find((item) => item.id === 'f-iphone')
  const iphoneSkus = iphone ? realSkusOf(data, iphone.id) : []
  const expanded = iphoneSkus.map((item) => item.id).sort()
  results.push(check('A', Boolean(iphone && iphoneSkus.length === 2 && expanded.join() === 's-iphone-blue,s-iphone-white'), expanded.join() || '缺少 iPhone'))

  const skuRows = listRealSkuRows(data, emptyQuery())
  const iphoneRows = skuRows.filter((item) => item.familyId === 'f-iphone')
  const oneEach = iphoneRows.length === 2 && new Set(iphoneRows.map((item) => item.id)).size === 2
  results.push(check('B', oneEach && iphoneRows.every((item) => item.spec.includes('容量 256G')), iphoneRows.map((item) => `${item.id}:${item.spec}`).join(' | ')))

  data.families.push(family({ id: 'fam-empty', name: '还没有规格的商品' }))
  const emptyVisible = listFamilies(data, emptyQuery()).some((item) => item.id === 'fam-empty')
  const emptyCount = realSkusOf(data, 'fam-empty').length
  const emptyInSku = listRealSkuRows(data, emptyQuery()).some((item) => item.familyId === 'fam-empty')
  results.push(check('C', emptyVisible && emptyCount === 0 && skuCountText(emptyCount) === '未建立' && !emptyInSku, `主体 ${emptyVisible} 数量 ${emptyCount}`))

  data.planningRecords.push({
    planningId: 'PLN-4A',
    productModelId: 't-phone',
    originModelVersionId: 'phone-model-v1',
    modelVersionId: 'phone-model-v1',
    modelVersionIds: ['phone-model-v1', 'phone-model-v2'],
    steps: [],
    identityKey: '4a',
    status: 'active',
    createdTime: '2026-10-20T00:00:00.000Z',
  })
  data.families.unshift(family({
    id: 'fam-v3',
    name: '只有物料的商品',
    line: 'v3',
    productModelId: 't-phone',
    modelVersionId: 'phone-model-v1',
    productTypeId: 'pt-phone',
    commonSignature: 'sig',
  }))
  data.skus.push(
    sku({ id: 'mat-1', familyId: 'fam-v3', skuName: '物料甲', planningId: 'PLN-4A', modelVersionId: 'phone-model-v1', materialCode: 'MAT-4A-1', variantAttrs: { 颜色: '黑色' } }),
    sku({ id: 'mat-2', familyId: 'fam-v3', skuName: '物料乙', planningId: 'PLN-4A', modelVersionId: 'phone-model-v2', materialCode: 'MAT-4A-2', variantAttrs: { 颜色: '白色' } }),
  )
  const v3Listed = listFamilies(data, emptyQuery()).some((item) => item.id === 'fam-v3')
  const v3SkuCount = realSkusOf(data, 'fam-v3').length
  const fake = listRealSkuRows(data, emptyQuery()).filter((item) => item.id === 'mat-1' || item.id === 'mat-2' || item.spec.includes('PLN-4A'))
  results.push(check('D', v3Listed && v3SkuCount === 0 && fake.length === 0, `主体 ${v3Listed} SKU ${v3SkuCount} 假行 ${fake.length}`))

  const materials = materialArchivesOf(data, 'fam-v3')
  const digest = familyMaterialDigest(materials)
  const plans = new Set(materials.map((item) => item.planningId))
  results.push(check('E', materials.length === 2 && plans.size === 1 && v3SkuCount === 0 && digest.includes('已建物料 2 条') && digest.includes('已关联规划 1 条'), digest))

  const blue = skuRows.find((item) => item.id === 's-iphone-blue')
  const white = listRealSkuRows(data, emptyQuery()).find((item) => item.id === 's-iphone-white')
  const historical = Boolean(blue && white && blue.code === 's-iphone-blue' && blue.spec.includes('颜色 蓝色') && white.spec.includes('颜色 白色') && white.spec.includes('网络版本 A1533（电信）') && !blue.name.includes('Apple iPhone 17'))
  results.push(check('F', historical, `${blue?.name || ''} / ${blue?.spec || ''} / ${white?.spec || ''}`))

  const watchIds = listRealSkuRows(data, emptyQuery()).filter((item) => item.familyId === 'f-watch').map((item) => item.id).sort()
  const leaked = realSkusOf(data, 'f-iphone').some((item) => item.familyId !== 'f-iphone')
  results.push(check('G', watchIds.join() === 's-watch-1,s-watch-2' && !leaked && !realSkusOf(data, 'f-iphone').some((item) => watchIds.includes(item.id)), watchIds.join()))

  const afterRead = snapshot(data)
  const page = slicePage(listRealSkuRows(data, emptyQuery()), 2, 4)
  results.push(check('H', before !== afterRead && page.rows.length > 0 && snapshot(data) === afterRead, `读取后仍是同一份数据，第 2 页 ${page.rows.length} 条`))

  const query = emptyQuery()
  query.keyword = '蓝色'
  query.page = 8
  query.pageSize = 1
  const blueFamilies = listFamilies(data, query).map((item) => item.id)
  const blueSkus = listRealSkuRows(data, query)
  const bluePage = slicePage(blueSkus, query.page, query.pageSize)
  const none = emptyQuery()
  none.keyword = '不存在的规格词'
  results.push(check('I', blueFamilies.includes('f-iphone') && blueSkus.length > 1 && blueSkus.every((item) => item.spec.includes('颜色 蓝色')) && !blueSkus.some((item) => item.id === 's-iphone-white') && bluePage.page === blueSkus.length && bluePage.rows.length === 1 && listFamilies(data, none).length === 0 && listRealSkuRows(data, none).length === 0, `商品 ${blueFamilies.join()} SKU ${blueSkus.map((item) => item.id).join()} 页 ${bluePage.page}`))

  const detailReady = Boolean(blue && blue.familyId === 'f-iphone' && materials.length === 2 && !listRealSkuRows(data, emptyQuery()).some((item) => item.materialCount > 0 && item.familyId === 'f-iphone'))
  results.push(check('J', detailReady && listRealSkuRows(data, emptyQuery()).find((item) => item.familyId === 'fam-v3') === undefined, `iPhone 物料数 ${materialArchivesOf(data, 'f-iphone').length}`))

  const named = data.skus.find((item) => item.id === 'mat-1')
  const codeBefore = named?.materialCode
  const nameBefore = named?.skuName
  listFamilies(data, emptyQuery())
  listRealSkuRows(data, emptyQuery())
  results.push(check('K', named?.materialCode === codeBefore && named?.skuName === nameBefore && named?.planningId === 'PLN-4A', `${named?.materialCode || ''} ${named?.skuName || ''}`))

  const versionCount = data.planningRecords.find((item) => item.planningId === 'PLN-4A')?.modelVersionIds.length || 0
  const notMultiplied = realSkusOf(data, 'fam-v3').length === 0 && materialArchivesOf(data, 'fam-v3').length === 2 && versionCount === 2
  results.push(check('L', notMultiplied && listRealSkuRows(data, emptyQuery()).length === data.skus.filter((item) => realSkusOf(data, item.familyId).some((sku) => sku.id === item.id)).length, `版本 ${versionCount} 物料 ${materialArchivesOf(data, 'fam-v3').length}`))

  const bare = data.skus.find((item) => item.id === 's-iphone-blue')
  if (bare) data.skus.push({ ...bare, id: 's-legacy-phone', variantAttrs: { ...bare.variantAttrs }, projectedAttrs: { ...bare.projectedAttrs }, planningId: 'PLN-LEGACY', modelVersionId: 'phone-model-v1' })
  const legacy = listRealSkuRows(data, emptyQuery()).find((item) => item.id === 's-legacy-phone')
  const legacySpec = bare ? savedSkuSpec(data.families.find((item) => item.id === 'f-iphone')!, { ...bare, id: 's-legacy-phone', planningId: 'PLN-LEGACY' }) : ''
  results.push(check('F2', Boolean(legacy && legacy.spec === legacySpec && legacy.spec.includes('颜色 蓝色') && !legacy.spec.includes('PLN-LEGACY')), legacy?.spec || ''))

  data.families.push(family({ id: 'fam-named', name: '神秘商品名称含512G', commonAttrs: { 容量: '128G' } }))
  data.skus.push(sku({ id: 's-named', familyId: 'fam-named', variantAttrs: { 颜色: '黑色' }, projectedAttrs: { 容量: '128G', 颜色: '黑色' } }))
  const namedRow = listRealSkuRows(data, emptyQuery()).find((item) => item.id === 's-named')
  results.push(check('F3', Boolean(namedRow && namedRow.spec === '容量 128G · 颜色 黑色' && !namedRow.spec.includes('512G') && namedRow.name === '黑色'), namedRow?.spec || ''))

  const stored = JSON.parse(JSON.stringify(createSeed())) as AppData
  delete stored.productListMode
  const familyIds = stored.families.map((item) => item.id).join()
  const skuIds = stored.skus.map((item) => item.id).join()
  const loaded = normalizeStored({ version: 13, data: stored })
  results.push(check('N', Boolean(loaded && loaded.productListMode === 'spu' && loaded.families.map((item) => item.id).join() === familyIds && loaded.skus.map((item) => item.id).join() === skuIds && loaded.skus.every((item) => !item.materialCode)), `模式 ${loaded?.productListMode || ''} SKU ${loaded?.skus.length || 0}`))

  return results
}
