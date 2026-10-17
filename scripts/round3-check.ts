import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import pkg from 'xlsx'
import { installAcceptanceCatalog, type ObservedMaterial } from '../src/domain/acceptanceCatalog'
import { addCompatibility, listHostModels, previewHostText, unconfiguredHostPlans } from '../src/domain/compatibility'
import { installCompatibilitySamples } from '../src/domain/compatibilitySamples'
import { applyExcelImport, attachExactCompatibility, excelSourceDigest, observedMaterials, previewSheet, readSheet, suggestMapping, suggestValueAliases, type SheetProfile } from '../src/domain/excelImport'
import { createSeed } from '../src/domain/seed'

const XLSX = (pkg as { default?: typeof pkg }).default || pkg
const root = 'D:/单子/商城erp/前期包/2.0 数据'

export interface Round3Evidence {
  id: string
  ok: boolean
  detail: string
}

function loadBook(part: string) {
  const name = readdirSync(root).find((item) => item.includes(part) && item.endsWith('.xlsx') && !item.startsWith('~$'))
  if (!name) return null
  const book = XLSX.readFile(join(root, name))
  return { name, book }
}

function materialSheet(part: string): { file: string; sheet: SheetProfile } | null {
  const loaded = loadBook(part)
  if (!loaded) return null
  const sheetName = loaded.book.SheetNames.find((item) => item === '手机 Apple' || item === 'Sheet1') || loaded.book.SheetNames[0]
  const matrix = XLSX.utils.sheet_to_json(loaded.book.Sheets[sheetName], { header: 1, raw: false, defval: '' }) as unknown[][]
  return { file: loaded.name, sheet: readSheet(sheetName, matrix) }
}

function tally(rows: { productTypeName: string; block: string; compatibilityStatus?: string }[], type: string) {
  const mine = rows.filter((item) => item.productTypeName === type)
  const count = (block: string) => mine.filter((item) => item.block === block).length
  return {
    rows: mine.length,
    formal: count('formal'),
    pending: mine.filter((item) => item.compatibilityStatus === 'ambiguous' || item.compatibilityStatus === 'unresolved').length,
    blocked: mine.filter((item) => item.block !== 'formal' && item.block !== 'empty').length,
  }
}

export function runRound3Checks(): Round3Evidence[] {
  const results: Round3Evidence[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const apple = materialSheet('1.1')
  const retired = materialSheet('15.1')
  const other = materialSheet('15.2')
  const parts = materialSheet('15.3')
  check('files', Boolean(apple && retired && other && parts), [apple?.file, retired?.file, other?.file, parts?.file].filter(Boolean).join(' | '))
  if (!apple || !retired || !parts) return results

  const fresh = createSeed()
  const phoneBefore = JSON.stringify(fresh.specModelVersions.find((item) => item.id === 'phone-model-v1')?.nodesSnapshot)
  const v2Before = fresh.skus.find((item) => item.id === 's-iphone-blue')
  const mapping15 = suggestMapping(retired.sheet.headers, retired.sheet.sample)
  check('header-alias', mapping15.filter((item) => item.target === 'category').map((item) => item.header).join(',') === '一级分类,二级分类,三级分类', mapping15.filter((item) => item.target === 'category').map((item) => item.header).join(','))

  const isolated = createSeed()
  const observed = observedMaterials(apple.sheet, suggestMapping(apple.sheet.headers, apple.sheet.sample)) as ObservedMaterial[]
  installAcceptanceCatalog(isolated, observed)
  const appleMapping = suggestMapping(apple.sheet.headers, apple.sheet.sample)
  const aliases = suggestValueAliases(isolated, apple.sheet, appleMapping)
  const preview = previewSheet(isolated, apple.sheet, appleMapping, '1.1-preview', { aliases, modelChoice: { 'pt-phone': 't-excel-phone' } })
  const phone = tally(preview, '手机')
  const shells = tally(preview, '保护壳')
  const films = tally(preview, '屏幕膜')
  const phoneBlocks = Object.entries(preview.filter((item) => item.productTypeName === '手机').reduce<Record<string, number>>((bag, item) => { bag[item.block] = (bag[item.block] || 0) + 1; return bag }, {})).map(([key, count]) => `${key}:${count}`).join(',')
  const phoneExample = preview.find((item) => item.productTypeName === '手机')
  check('preview-phone', phone.rows === 118 && phone.formal > 0 && phone.blocked + phone.formal === phone.rows, `${JSON.stringify(phone)} ${phoneBlocks} 例 ${phoneExample?.categoryName} ${phoneExample?.message}`)
  check('preview-case', shells.rows === 289, JSON.stringify(shells))
  check('preview-film', films.rows === 84 && films.formal === 0, JSON.stringify(films))
  const filmSample = preview.find((item) => item.productTypeName === '屏幕膜' && item.attrs.some((attr) => attr.name === '适用型号'))
  const phoneSample = preview.find((item) => item.productTypeName === '手机' && item.block === 'formal')
  check('film-not-spec', Boolean(filmSample && filmSample.block !== 'formal' && !isolated.productSpecNodes.some((item) => item.templateId === 't-phone' && item.valueId && item.attributeId === 'p-fit-model')), `${filmSample?.sheet} 行 ${filmSample?.rowNumber} ${filmSample?.block} ${filmSample?.compatibilityStatus || ''} ${filmSample?.message}`)
  check('phone-trace', Boolean(phoneSample && phoneSample.planningId.startsWith('PLN-') && phoneSample.modelVersionId && phoneSample.rowNumber > 1), `${phoneSample?.sheet} 行 ${phoneSample?.rowNumber} 型号 ${phoneSample?.attrs.find((item) => item.name === '型号')?.value || ''} ${phoneSample?.modelVersionId} ${phoneSample?.planningId}`)

  const row = preview.find((item) => item.block === 'formal' && item.productTypeName === '手机')
  let seq = 0
  const nextId = (prefix: string) => `${prefix}-r3-${++seq}`
  const written = row ? applyExcelImport(isolated, [row], nextId) : []
  const againKey = previewSheet(isolated, apple.sheet, suggestMapping(apple.sheet.headers, apple.sheet.sample), 'renamed-copy')
  const same = row ? againKey.find((item) => item.sourceDigest === row.sourceDigest) : undefined
  check('source-stable', Boolean(written[0]?.ok && written[0].created && same?.block === 'imported' && same.requestId !== row?.requestId), `${written[0]?.ok ? written[0].materialCode : '未写入'}；改名后 ${same?.block} ${same?.message || ''}`)
  if (written[0]?.ok) {
    const sku = isolated.skus.find((item) => item.id === written[0].skuId)
    if (sku) isolated.skus = isolated.skus.filter((item) => item.id !== sku.id)
    const receipt = isolated.materialReceipts.find((item) => item.requestId === row?.requestId)
    if (receipt) receipt.lifecycle = 'deleted'
  }
  const afterDelete = row ? previewSheet(isolated, apple.sheet, suggestMapping(apple.sheet.headers, apple.sheet.sample), '1.1-preview').find((item) => item.rowNumber === row.rowNumber && item.productTypeName === '手机') : undefined
  check('deleted-not-rebuilt', Boolean(afterDelete?.message.includes('已经删除') && !isolated.skus.some((item) => item.id === (written[0]?.ok ? written[0].skuId : 'missing'))), afterDelete?.message || '')

  const renamed = createSeed()
  installCompatibilitySamples(renamed, nextId)
  const beforeHosts = listHostModels(renamed).map((item) => item.host.identityKey).sort()
  const modelParam = renamed.params.find((item) => item.id === 'p-model')
  if (modelParam) modelParam.name = '机型'
  const phoneType = renamed.productTypes.find((item) => item.id === 'pt-phone')
  if (phoneType) phoneType.name = '智能手机'
  const hostCategory = renamed.categories.find((item) => item.id === 'c-host')
  if (hostCategory) hostCategory.name = '数码主机'
  const afterHosts = listHostModels(renamed).map((item) => item.host.identityKey).sort()
  check('rename-stable', beforeHosts.length > 0 && beforeHosts.join() === afterHosts.join(), `改名前 ${beforeHosts.length}，改名后 ${afterHosts.length}`)

  const sampleHosts = listHostModels(renamed).filter((item) => item.sample)
  const two = sampleHosts.filter((item) => item.modelName === 'iPhone 17 Pro Max' || item.modelName === 'iPhone 18 Pro Max')
  const filmType = renamed.productTypes.find((item) => item.name === '屏幕膜')
  const caseType = renamed.productTypes.find((item) => item.name === '保护壳' && item.categoryId !== 'c-case')
  const filmSku = renamed.skus.find((item) => renamed.families.some((family) => family.id === item.familyId && family.productTypeId === filmType?.id))
  const caseSku = renamed.skus.find((item) => renamed.families.some((family) => family.id === item.familyId && family.productTypeId === caseType?.id))
  const multi = filmSku && two.length === 2 ? addCompatibility(renamed, { accessorySkuIds: [filmSku.id], hosts: two.map((item) => item.host), nextId }) : { created: [], skipped: 0, failed: [] }
  const again = filmSku && two.length === 2 ? addCompatibility(renamed, { accessorySkuIds: [filmSku.id], hosts: two.map((item) => item.host), nextId }) : { created: [], skipped: 0, failed: [] }
  const caseLink = caseSku && two[0] ? addCompatibility(renamed, { accessorySkuIds: [caseSku.id], hosts: [two[0].host], nextId }) : { created: [], skipped: 0, failed: [] }
  const hostView = listHostModels(renamed).find((item) => item.modelName === 'iPhone 17 Pro Max')
  check('many-to-many', Boolean(multi.created.length === 2 && again.created.length === 0 && again.skipped === 2 && caseLink.created.length === 1 && hostView && hostView.typeCounts.length >= 2), `膜 ${multi.created.length} 重复跳过 ${again.skipped}；主机类型 ${hostView?.typeCounts.map((item) => `${item.name}${item.count}`).join('、')}`)
  const ambiguous = previewHostText(renamed, 'iPhone 17 Pro Max/iPhone 18 Pro Max')
  const exact = previewHostText(renamed, 'iPhone 17 Pro Max')
  check('applicable-text', ambiguous.status === 'ambiguous' && exact.status === 'exact' && exact.hosts.length === 1, `${ambiguous.status} ${ambiguous.reason}；精确 ${exact.hosts.map((item) => item.modelName).join(',')}`)
  const pending = attachExactCompatibility(renamed, [{ ...preview[0], compatibilityStatus: 'ambiguous', compatibilityReason: '待确认', attrs: [{ name: '适用型号', value: '14-16' }] }], nextId)
  check('compat-separate', pending.linked === 0 && pending.pending === 1, pending.notes.join('；'))

  const mate = createSeed()
  mate.planningRecords = [{ planningId: 'PLN-MATE', productModelId: 't-phone', originModelVersionId: 'phone-model-v1', modelVersionId: 'phone-model-v1', modelVersionIds: ['phone-model-v1'], steps: [{ valueNodeId: 'sn-huawei-series-mate', attributeNodeId: 'sn-huawei-series', attributeId: 'p-series', attributeName: '系列', valueId: 'Mate', parentValueNodeId: null, role: 'common', roleSource: 'node' }], identityKey: 'mate', status: 'active', createdTime: '2026-10-16T00:00:00.000Z' }]
  const gap = unconfiguredHostPlans(mate)
  check('huawei-unconfigured', gap.some((item) => item.planningId === 'PLN-MATE') && !listHostModels(mate).some((item) => item.series === 'Mate' && !item.modelName), gap.map((item) => item.reason).join('；') || '未提示')

  const digestA = excelSourceDigest({ sheet: '手机 Apple', guanjiapoCode: '900', supplierCode: 'S', skuName: 'A', productTypeName: '手机', attrs: [{ name: '型号', value: 'iPhone 16' }] })
  const digestB = excelSourceDigest({ sheet: '手机 Apple', guanjiapoCode: '900', supplierCode: 'S', skuName: 'A', productTypeName: '手机', attrs: [{ name: '型号', value: 'iPhone 15' }] })
  check('same-code-different-row', digestA !== digestB, `${digestA} / ${digestB}`)
  const excelHosts = listHostModels(isolated).filter((item) => item.host.productModelId === 't-excel-phone')
  check('history-safe', JSON.stringify(fresh.specModelVersions.find((item) => item.id === 'phone-model-v1')?.nodesSnapshot) === phoneBefore && fresh.skus.find((item) => item.id === 's-iphone-blue')?.materialCode === v2Before?.materialCode && excelHosts.length > 0 && !excelHosts.some((item) => item.modelName === 'Mate'), `隔离副本里的 Apple 手机型号 ${excelHosts.length} 个`)
  return results
}

const results = runRound3Checks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
console.log(`round3 checks ${results.filter((item) => item.ok).length}/${results.length}`)
if (results.some((item) => !item.ok)) process.exit(1)
