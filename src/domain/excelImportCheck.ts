import { previewSheet, readSheet, suggestMapping, applyExcelImport, type SheetProfile } from './excelImport'
import { reconcilePlanningRecords } from './planning'
import { createSeed } from './seed'

export interface CheckResult { id: string; ok: boolean; detail: string }

export function runExcelChecks(profiles: SheetProfile[] = []): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const material = profiles.find((item) => item.kind === 'material')
  const others = profiles.filter((item) => item.kind !== 'material')
  check('file', Boolean(material && material.rows.length > 1000 && others.map((item) => item.kind).sort().join() === 'dictionary,notes,service,special'), profiles.map((item) => `${item.name}:${item.kind}:${item.rows.length}`).join(' | ') || '没有传入真实工作簿')
  if (material) {
    const mapping = suggestMapping(material.headers, material.sample)
    check('map', mapping.some((item) => item.header === '供应商编码' && item.target === 'supplier') && mapping.some((item) => item.header === '9.0管家婆' && item.target === 'guanjiapo') && mapping.some((item) => item.header === '物料描述（可追溯）' && item.target === 'skuName'), mapping.filter((item) => item.target !== 'ignore' && item.target !== 'attrName' && item.target !== 'attrValue').map((item) => `${item.header}->${item.target}`).join(', '))
    const data = createSeed()
    const version = data.specModelVersions.find((item) => item.id === 'phone-model-v1')
    if (version) data.planningRecords = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: 't-phone', modelVersionId: version.id, nodes: version.nodesSnapshot, now: '2026-10-15T00:00:00.000Z' }).records
    const preview = previewSheet(data, material, mapping, '1.1:test')
    const md = preview.filter((item) => item.supplierCode === 'MD7W4CH/A')
    check('dup-supplier', md.length === 2 && md[0].requestId !== md[1].requestId && md[1].message.includes('分成两条') && md.every((item) => item.block !== 'formal'), `MD7 行 ${md.map((item) => `${item.rowNumber}:${item.block}`).join(',')}`)
    const black = preview.find((item) => item.supplierCode === 'MYEV3CH/A')
    const white = preview.find((item) => item.supplierCode === 'MYEW3CH/A')
    check('black-white', Boolean(black && white && black.block === 'spec' && black.skuName.includes('黑色') && white.skuName.includes('白色') && black.message.includes('iPhone 16') && black.message.includes('不会自动改成临时物料')), `${black?.skuName || '无黑'} / ${white?.skuName || '无白'}`)
    const untouched = others.every((item) => previewSheet(data, item, suggestMapping(item.headers, item.sample), '1.1:test').length === 0)
    check('skip-other', untouched, others.map((item) => item.kind).join(','))
    const readyBefore = preview.filter((item) => item.status === 'ready').length
    const temporary = previewSheet(data, material, mapping, '1.1:test', { temporaryGroups: [black?.groupKey || ''] })
    const sample = temporary.filter((item) => item.supplierCode === 'MYEV3CH/A' || item.supplierCode === 'MYEW3CH/A')
    const dictBefore = JSON.stringify(data.params.map((item) => [item.name, ...item.values]))
    const nodesBefore = data.productSpecNodes.length
    let seq = 0
    const applied = applyExcelImport(data, sample, (prefix) => `${prefix}-${++seq}`)
    const again = applyExcelImport(data, sample, (prefix) => `${prefix}-${++seq}`)
    const created = applied.filter((item) => item.ok && item.created).length
    const replayed = again.filter((item) => item.ok && !item.created).length
    const codes = data.skus.filter((item) => item.supplierCode === 'MYEV3CH/A' || item.supplierCode === 'MYEW3CH/A')
    check('real-write', sample.length === 2 && sample.every((item) => item.action === 'temporary') && created === 2 && replayed === 2 && codes.length === 2 && codes.every((item) => item.planningId?.startsWith('TMP-')) && JSON.stringify(data.params.map((item) => [item.name, ...item.values])) === dictBefore && data.productSpecNodes.length === nodesBefore && readyBefore === 0, `可导入样本 ${sample.length}，首次 ${created}，重复 ${replayed}，默认放行 ${readyBefore}`)
    const replayRow = previewSheet(data, material, mapping, '1.1:test').find((item) => item.supplierCode === 'MYEV3CH/A')
    check('source-kept', Boolean(replayRow && replayRow.block === 'imported' && replayRow.message.includes('临时物料') && replayRow.message.includes('不会把临时物料改成正式规划')), replayRow?.message || '')
  }
  check('formal', formalRoundTrip(), '合成的一行能挂上已发布规划，再导入不会多一条')
  check('rows', blankRowAndRollback(), '空行不改原表行号，失败时整批不落库')
  return results
}

function formalRoundTrip() {
  const data = createSeed()
  const version = data.specModelVersions.find((item) => item.id === 'phone-model-v1')
  if (!version) return false
  data.planningRecords = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: 't-phone', modelVersionId: version.id, nodes: version.nodesSnapshot, now: '2026-10-15T00:00:00.000Z' }).records
  const headers = ['9.0管家婆', '物料描述（可追溯）', '供应商编码', '一级', '二级', '产品类型', '属性1', '属1值', '属性2', '属2值', '属性3', '属3值', '属性4', '属4值', '属性5', '属5值']
  const row = ['9001', 'Apple iPhone 128G 黑色', 'SUP-FORMAL', '主机', '手机', '手机', '品牌', 'Apple', '系列', 'iPhone', '颜色', '黑色', '容量', '128G', '型号', 'iPhone 17']
  const other = ['9002', 'Apple iPhone 128G 白色', 'SUP-FORMAL', '主机', '手机', '手机', '品牌', 'Apple', '系列', 'iPhone', '颜色', '白色', '容量', '128G', '型号', 'iPhone 17']
  const sheet = readSheet('合成物料', [headers, row, other])
  const mapping = suggestMapping(sheet.headers, sheet.sample)
  const preview = previewSheet(data, sheet, mapping, 'synthetic')
  if (preview.length !== 2 || preview.some((item) => item.status !== 'ready' || item.action !== 'formal' || !item.planningId.startsWith('PLN-'))) return false
  if (preview[0].planningId === preview[1].planningId) return false
  if (!preview[1].message.includes('分成两条')) return false
  const before = data.skus.length
  let seq = 0
  const first = applyExcelImport(data, preview, (prefix) => `${prefix}-${++seq}`)
  const second = applyExcelImport(data, preview, (prefix) => `${prefix}-${++seq}`)
  const codes = data.skus.filter((item) => item.supplierCode === 'SUP-FORMAL').map((item) => item.materialCode)
  return first.filter((item) => item.ok && item.created).length === 2 && second.filter((item) => item.ok && !item.created).length === 2 && data.skus.length === before + 2 && new Set(codes).size === 2 && codes.every((item) => item?.startsWith('MAT-'))
}

function blankRowAndRollback() {
  const data = createSeed()
  const version = data.specModelVersions.find((item) => item.id === 'phone-model-v1')
  if (!version) return false
  data.planningRecords = reconcilePlanningRecords({ records: data.planningRecords, data, productModelId: 't-phone', modelVersionId: version.id, nodes: version.nodesSnapshot, now: '2026-10-15T00:00:00.000Z' }).records
  const headers = ['9.0管家婆', '物料描述（可追溯）', '供应商编码', '一级', '二级', '产品类型', '属性1', '属1值', '属性2', '属2值', '属性3', '属3值', '属性4', '属4值']
  const row = ['9001', 'Apple iPhone 128G 黑色', 'SUP-ROW', '主机', '手机', '手机', '品牌', 'Apple', '系列', 'iPhone', '颜色', '黑色', '容量', '128G']
  const blank = headers.map(() => '')
  const other = ['9002', 'Apple iPhone 128G 白色', 'SUP-ROW-2', '主机', '手机', '手机', '品牌', 'Apple', '系列', 'iPhone', '颜色', '白色', '容量', '128G']
  const sheet = readSheet('行号', [headers, row, blank, other])
  const preview = previewSheet(data, sheet, suggestMapping(sheet.headers, sheet.sample), 'rows')
  if (preview.map((item) => item.rowNumber).join() !== '2,4') return false
  const before = data.skus.map((item) => item.id).join()
  let seq = 0
  const bad = { ...preview[1], planningId: 'PLN-MISSING', requestId: 'excel:bad-row' }
  const applied = applyExcelImport(data, [preview[0], bad], (prefix) => `${prefix}-row-${++seq}`)
  return applied.every((item) => !item.ok) && data.skus.map((item) => item.id).join() === before
}
