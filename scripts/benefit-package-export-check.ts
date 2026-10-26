import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { createAccessoryCompatibilityFixture } from './accessory-compatibility-fixtures'
import { addBenefitSku, cloneBenefit, confirmBenefitCondition, createBenefitDeliverySnapshot, newBenefitPackageDraft, reviewBenefitQuote, previewBenefitDelivery } from '../src/domain/benefitPackages'
import { benefitDeliveryFilename, buildBenefitDeliveryWorkbook } from '../src/domain/benefitPackageExport'

const artifacts = process.argv.includes('--artifacts')
const output = resolve(process.env.BENEFIT_EXPORT_OUTPUT || 'work/benefit-package/export')
if (artifacts) mkdirSync(output, { recursive: true })
const { data } = createAccessoryCompatibilityFixture()
let draft = addBenefitSku(data, newBenefitPackageDraft({ kind: 'sku', skuId: 'phone-a' }), 'case-sku', 2)
draft = addBenefitSku(data, draft, 'cable-sku', 1)
Object.assign(draft, { id: 'pack-export', code: 'BPK-000001', name: '【独立测试】完整交付', status: 'available', revision: 1 })
draft.services = [
  { id: 'service-a', name: '【独立测试】贴膜', quantity: 1, unit: '次', measurement: 'per-package', validity: '购买后 3 个月内', description: '按约定提供服务，未激活' },
  { id: 'service-b', name: '【独立测试】上门', quantity: 1, unit: '次', measurement: 'per-delivery', validity: '3 个月会员为每份权益的约定，不累计为 9 个月', description: '=HYPERLINK("https://example.invalid","不得作为公式")' },
]
draft.quote.amountCents = 0
draft = confirmBenefitCondition(data, draft, 'cable-sku', '【独立测试】按指定转换器前提交付', '2026-10-23T08:00:00.000Z')
draft = reviewBenefitQuote(draft,data)
const preview = previewBenefitDelivery(data, draft, 3)
assert.equal(preview.canConfirm, true, JSON.stringify(preview.issues))
const snapshot = createBenefitDeliverySnapshot(preview, { id: 'delivery-export', code: 'BDL-000001', requestId: 'export-request', generatedAt: '2026-10-23T08:00:00.000Z' })
const checks: string[] = []
function check(name: string, run: () => void) { run(); checks.push(name); if (artifacts) console.log(`PASS benefit export ${name}`) }
const rows = (book: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name]!, { header: 1, defval: '' })
const original = cloneBenefit(snapshot)
const book = buildBenefitDeliveryWorkbook(snapshot)
check('same frozen snapshot; goods and two distinct service measurement totals', () => {
  assert.equal(snapshot.snapshotVersion, 2)
  assert.deepEqual(book.SheetNames, ['清单概览', '商品明细', 'SKU 数量汇总', '服务权益', '条件及确认说明'])
  const goods = rows(book, '商品明细'), services = rows(book, '服务权益')
  assert.equal(goods[1]?.[6], 2); assert.equal(goods[1]?.[7], 6)
  assert.equal(services[1]?.[2], '每包计量'); assert.equal(services[1]?.[3], 1); assert.equal(services[1]?.[4], 3)
  assert.equal(services[2]?.[2], '本次交付计量'); assert.equal(services[2]?.[4], 1)
  assert.equal(services[1]?.[6], '购买后 3 个月内')
  assert.deepEqual(rows(book, 'SKU 数量汇总').slice(1).map(row => [row[0], row[3], row[4]]), [['case-sku', 2, 6], ['cable-sku', 1, 3]])
  assert.equal(goods[1]?.[16], snapshot.goods[0]?.lineId)
})
check('explicit legacy snapshot keeps four original sheets and frozen values without new position columns', () => {
  const legacyDraft = cloneBenefit(draft); delete legacyDraft.compositionVersion
  for (const line of legacyDraft.goods) { delete line.groupId; delete line.role }
  legacyDraft.confirmations = []
  const confirmedLegacy = confirmBenefitCondition(data, legacyDraft, 'cable-sku', '【独立测试】旧结构按指定转换器前提交付', '2026-10-23T08:00:00.000Z')
  const legacy = createBenefitDeliverySnapshot(previewBenefitDelivery(data, confirmedLegacy, 3), { id: 'legacy-export', code: 'BDL-000003', requestId: 'legacy-export-request', generatedAt: '2026-10-23T08:00:00.000Z' })
  assert.equal(legacy.snapshotVersion, 1); assert.equal(legacy.compositionVersion, undefined); assert.equal(legacy.goodsSummary, undefined)
  const legacyBook = buildBenefitDeliveryWorkbook(legacy)
  assert.deepEqual(legacyBook.SheetNames, ['清单概览', '商品明细', '服务权益', '条件及确认说明'])
  assert.deepEqual(rows(legacyBook, '商品明细').slice(1).map(row => [row[0], row[6], row[7]]), [['case-sku', 2, 6], ['cable-sku', 1, 3]])
  assert.equal(rows(legacyBook, '商品明细')[0]?.includes('来源位置 ID'), false)
})
check('unquoted distinct from zero; exact cents represented without truthiness or float multiplication', () => {
  assert.equal(rows(book, '清单概览').find(row => row[0] === '每包报价（元）')?.[1], '0.00')
  const unquoted = cloneBenefit(snapshot); unquoted.quote.amountCents = null; unquoted.quote.totalCents = null
  assert.equal(rows(buildBenefitDeliveryWorkbook(unquoted), '清单概览').find(row => row[0] === '本次总报价（元）')?.[1], '未报价')
  const exact = cloneBenefit(snapshot); exact.quote.amountCents = 101; exact.quote.totalCents = 303
  assert.equal(rows(buildBenefitDeliveryWorkbook(exact), '清单概览').find(row => row[0] === '本次总报价（元）')?.[1], '3.03')
})
check('conditions, source, manual confirmation and time included', () => {
  const conditions = rows(book, '条件及确认说明')
  assert.ok(conditions.some(row => String(row[4]).includes('指定测试转换器')))
  assert.ok(conditions.some(row => row[0] === '本包人工确认' && String(row[4]).includes('按指定转换器前提交付') && row[7] === '2026-10-23T08:00:00.000Z'))
  assert.ok(conditions.some(row => String(row[6]).includes('独立测试人工确认依据')))
})
check('user strings remain literal cells in the real xlsx file, never formulas', () => {
  const dangerous = cloneBenefit(snapshot); dangerous.packageName = '=1+1'; dangerous.goods[0]!.name = '@SUM(1,2)'
  const guarded = buildBenefitDeliveryWorkbook(dangerous)
  const buffer = XLSX.write(guarded, { type: 'buffer', bookType: 'xlsx' })
  if (artifacts) writeFileSync(resolve(output, 'literal-user-content.xlsx'), buffer)
  const actual = XLSX.read(buffer, { type: 'buffer', cellFormula: true })
  assert.equal(rows(actual, '清单概览')[1]?.[1], '=1+1')
  assert.equal(rows(actual, '商品明细')[1]?.[3], '@SUM(1,2)')
  for (const sheet of Object.values(actual.Sheets)) for (const [address, cell] of Object.entries(sheet)) if (!address.startsWith('!')) assert.equal(cell.f, undefined)
})
check('Windows filename is safe and contains package/delivery identities', () => {
  assert.equal(benefitDeliveryFilename(snapshot), '权益包_BPK-000001_BDL-000001.xlsx')
  const unsafe = cloneBenefit(snapshot); unsafe.packageCode = 'BPK:/?*"<>|\\'; unsafe.code = 'BDL\u0000.'
  assert.equal(/[\\/:*?"<>|\u0000-\u001f]/.test(benefitDeliveryFilename(unsafe)), false)
})
check('freely added phone is exported as actual delivered host without a device inclusion switch', () => {
  const free = addBenefitSku(data, newBenefitPackageDraft(), 'phone-a')
  Object.assign(free, { id: 'free-pack', code: 'BPK-000002', revision: 1, name: '【独立测试】自由手机包', status: 'available' })
  const frozenFree = createBenefitDeliverySnapshot(previewBenefitDelivery(data, free, 2), { id: 'free-delivery', code: 'BDL-000002', requestId: 'free-request', generatedAt: '2026-10-23T09:00:00.000Z' })
  assert.equal(frozenFree.includedPhoneSkuId, '')
  assert.deepEqual(frozenFree.hostSkuIds, ['phone-a'])
  assert.match(String(rows(buildBenefitDeliveryWorkbook(frozenFree), '清单概览').find(row => row[0] === '包含手机')?.[1]), /是：phone-a/)
})
check('export is pure, repeatable and independent of changed or removed live records', () => {
  data.skus = []; data.families = []; data.compatibilities = []; draft.name = 'changed'; draft.services = []
  const again = buildBenefitDeliveryWorkbook(snapshot)
  for (const name of book.SheetNames) assert.deepEqual(rows(again, name), rows(book, name))
  assert.deepEqual(snapshot, original)
})
if (artifacts) writeFileSync(resolve(output, 'result.json'), JSON.stringify({ result: 'PASS', checks, snapshot }, null, 2) + '\n')
console.log(`PASS benefit export: ${checks.length} groups`)
