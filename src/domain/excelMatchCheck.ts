import { installAcceptanceCatalog } from './acceptanceCatalog'
import { countBlocks, observedMaterials, previewSheet, suggestMapping, suggestValueAliases, applyExcelImport, type SheetProfile } from './excelImport'
import { legalPlanningCombinations, reconcilePlanningRecords } from './planning'
import { createSeed } from './seed'
import type { CheckResult } from './excelImportCheck'

export function runMatchChecks(profiles: SheetProfile[]): CheckResult[] {
  const results: CheckResult[] = []
  const check = (id: string, ok: boolean, detail: string) => results.push({ id, ok, detail })
  const material = profiles.find((item) => item.kind === 'material')
  if (!material) {
    check('match-file', false, '没有物料表')
    return results
  }
  const mapping = suggestMapping(material.headers, material.sample)
  const seed = createSeed()
  const phoneNodes = JSON.stringify(seed.specModelVersions.find((item) => item.id === 'phone-model-v1'))
  const phoneCombos = legalPlanningCombinations(seed, 't-phone', seed.productSpecNodes.filter((item) => item.templateId === 't-phone')).length
  const oldSkus = JSON.stringify(seed.skus.map((item) => [item.id, item.materialCode || '', item.planningId || '']))
  const preview = previewSheet(seed, material, mapping, 'match')
  const counts = countBlocks(preview)
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  check('census', total === material.rows.length && counts.formal === 0 && counts.temporary === 0, `${total} 行 ${JSON.stringify(counts)}`)
  const aliases = suggestValueAliases(seed, material, mapping)
  check('alias', aliases.some((item) => item.from === '128GB' && item.to === '128G') && aliases.every((item) => item.attributeName === '容量' && !item.from.includes('iPhone') && !item.to.includes('iPhone')), aliases.map((item) => `${item.from}->${item.to}`).join(','))
  const numbered = createSeed()
  const phoneVersion = numbered.specModelVersions.find((item) => item.id === 'phone-model-v1')
  if (phoneVersion) numbered.planningRecords = reconcilePlanningRecords({ records: numbered.planningRecords, data: numbered, productModelId: 't-phone', modelVersionId: phoneVersion.id, nodes: phoneVersion.nodesSnapshot, now: '2026-10-15T00:00:00.000Z' }).records
  const aliased = previewSheet(numbered, material, mapping, 'match', { aliases })
  const black = aliased.find((item) => item.supplierCode === 'MYEV3CH/A')
  check('no-merge', Boolean(black && black.block === 'spec' && black.message.includes('系列「iPhone 16」') && black.message.includes('不会把系列和型号当成同一个值') && !black.message.includes('容量「128GB」')), black?.message || '')
  const pad = preview.find((item) => item.productTypeName === '平板电脑')
  const shell = preview.find((item) => item.productTypeName === '保护壳')
  check('gaps', Boolean(pad && pad.block === 'category' && pad.message.includes('平板电脑') && shell && shell.block === 'product-type' && shell.categoryName.includes('保护及保护设备')), `${pad?.block}:${pad?.message} | ${shell?.block}`)
  const installed = installAcceptanceCatalog(seed, observedMaterials(material, mapping))
  check('install', installed.created === 3 && JSON.stringify(seed.specModelVersions.find((item) => item.id === 'phone-model-v1')) === phoneNodes && legalPlanningCombinations(seed, 't-phone', seed.productSpecNodes.filter((item) => item.templateId === 't-phone')).length === phoneCombos, `新建 ${installed.created}，原手机组合仍是 ${phoneCombos}`)
  const phoneType = seed.productTypes.find((item) => item.id === 'pt-phone')
  const matched = previewSheet(seed, material, mapping, 'match', { modelChoice: { [phoneType?.id || '']: 't-excel-phone' } })
  const matchedCounts = countBlocks(matched)
  const matchedTotal = Object.values(matchedCounts).reduce((sum, count) => sum + count, 0)
  const formal = matched.filter((item) => item.block === 'formal')
  const phones = formal.filter((item) => item.productTypeName === '手机')
  const tablets = formal.filter((item) => item.productTypeName === '平板电脑')
  const cases = formal.filter((item) => item.productTypeName === '保护壳')
  check('formal-count', matchedTotal === material.rows.length && phones.length === 116 && tablets.length === 179 && cases.length === 288 && formal.every((item) => item.planningId.startsWith('PLN-') && item.productModelId !== 't-phone'), `手机 ${phones.length} 平板 ${tablets.length} 保护壳 ${cases.length} 合计 ${JSON.stringify(matchedCounts)}`)
  const md = matched.filter((item) => item.supplierCode === 'MD7W4CH/A')
  check('md7', md.length === 2 && md.every((item) => item.block === 'formal' && item.productModelId === 't-excel-tablet') && md[0].planningId !== md[1].planningId, md.map((item) => item.planningId).join(','))
  const shared = planningGroups(formal).find((item) => item.length > 1) || []
  check('same-spec', shared.length >= 2 && new Set(shared.map((item) => item.planningId)).size === 1 && new Set(shared.map((item) => item.requestId)).size === shared.length, `同规划 ${shared.length} 行 ${shared[0]?.planningId || ''}`)
  check('case-apart', cases.every((item) => item.productModelId === 't-excel-case' && item.categoryName.includes('保护及保护设备')) && phones.every((item) => item.productModelId === 't-excel-phone'), '保护壳没有进手机模型')
  let seq = 0
  const writing = formal.filter((item) => item.productTypeName === '手机' || item.productTypeName === '平板电脑' || item.productTypeName === '保护壳')
  const applied = applyExcelImport(seed, writing, (prefix) => `${prefix}-${++seq}`)
  const again = applyExcelImport(seed, writing, (prefix) => `${prefix}-${++seq}`)
  const created = applied.filter((item) => item.ok && item.created)
  const replayed = matched && previewSheet(seed, material, mapping, 'match', { modelChoice: { [phoneType?.id || '']: 't-excel-phone' } })
  const imported = replayed.filter((item) => item.block === 'imported')
  check('write-formal', created.length === writing.length && again.filter((item) => item.ok && !item.created).length === writing.length && imported.length === writing.length && seed.skus.filter((item) => item.supplierCode === 'MD7W4CH/A').length === 2 && seed.skus.filter((item) => item.planningId?.startsWith('TMP-')).length === 0 && JSON.stringify(seed.skus.filter((item) => !String(item.id).startsWith('fam') && !item.materialCode?.startsWith('MAT-')).map((item) => [item.id, item.materialCode || '', item.planningId || ''])) === oldSkus, `写入 ${created.length}，重复预览已导入 ${imported.length}`)
  const sample = seed.skus.find((item) => item.supplierCode === 'MYEV3CH/A')
  check('trace', Boolean(sample && sample.materialCode?.startsWith('MAT-') && sample.planningId?.startsWith('PLN-') && sample.guanjiapoCode && sample.skuName?.includes('128GB') && sample.modelVersionId === 't-excel-phone-v1' && sample.materialDescription), `${sample?.materialCode} ${sample?.planningId} ${sample?.guanjiapoCode}`)
  return results
}

function planningGroups(rows: { planningId: string; requestId: string }[]) {
  const groups = new Map<string, { planningId: string; requestId: string }[]>()
  rows.forEach((item) => {
    const list = groups.get(item.planningId) || []
    list.push(item)
    groups.set(item.planningId, list)
  })
  return [...groups.values()]
}
