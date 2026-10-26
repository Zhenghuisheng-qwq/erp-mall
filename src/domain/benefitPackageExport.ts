import { deliveryConfirmationPosition, unsupportedDeliveryMessage } from './benefitDeliveryPresentation'
import * as XLSX from 'xlsx'
import type { BenefitCompatibilityStatus, BenefitDeliverySnapshot } from './benefitPackageTypes'

const compatibilityText: Record<BenefitCompatibilityStatus, string> = { compatible: '适用', conditional: '有条件适用', incompatible: '不适用', pending: '待确认', 'not-required': '无需设备适配', unchecked: '未做设备适配校验' }
const capabilityText = { basic: '基本使用', 'fast-charge': '快充能力', other: '指定能力' }
type Cell = string | number
function money(cents: number | null) { return cents === null ? '未报价' : `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}` }

/** All sheets are produced from the saved snapshot, never from current catalogue records. */
export function buildBenefitDeliveryWorkbook(snapshot: BenefitDeliverySnapshot): XLSX.WorkBook {
  if (![1, 2].includes(snapshot.snapshotVersion)) throw new Error(unsupportedDeliveryMessage)
  const positioned = snapshot.snapshotVersion === 2
  const overview: Cell[][] = [
    ['权益包交付清单', snapshot.code], ['包名称', snapshot.packageName], ['来源包编号', snapshot.packageCode], ['来源包修订', snapshot.sourceRevision], ['清单生成时间', snapshot.generatedAt], ['本次包数', snapshot.packageCount], ['适配对象', snapshot.deviceLabel || '未指定设备，未做设备适配校验'], ['包含手机', snapshot.hostSkuIds.length ? `是：${snapshot.hostSkuIds.join('、')}，见商品明细` : '否'], ['币种', snapshot.quote.currency], ['每包报价（元）', money(snapshot.quote.amountCents)], ['本次总报价（元）', money(snapshot.quote.totalCents)], ['交付说明', '本清单记录配置与交付约定，不代表已支付、已出库、已发货或服务已激活。'],
  ]
  const refMoney=(n:number|null|undefined)=>n===null||n===undefined?'未记录':`${n<0?'-':''}${money(Math.abs(n))}`
  if(snapshot.framework)overview.push(['框架依据',`${snapshot.framework.name} / ${snapshot.framework.frameworkId} / 修订 ${snapshot.framework.revision}`],['冻结规则',JSON.stringify(snapshot.framework.groups)])
  if (positioned) {
    overview.push(['组成口径', '商品明细逐位置记录；SKU 数量汇总仅供核对，参考价格按位置计算。'])
    if (snapshot.framework) overview.push(['框架类型', snapshot.framework.kind], ['冻结组间规则', JSON.stringify(snapshot.framework.rules ?? [])])
  }
  const totals=snapshot.referenceTotals
  if(totals)overview.push(['参考价完整性',totals.complete?'完整':`未完整，缺价 ${totals.missingCount} 项`],['每包已知参考合计',refMoney(totals.perPackageKnownCents)],['按次服务本次参考金额',refMoney(totals.perDeliveryKnownCents)],['本次全部已知参考合计',refMoney(totals.totalKnownCents)],['人工参考合计减整包报价差额',refMoney(totals.differenceCents)])
  else overview.push(['参考价格','历史记录未记录参考价格'])
  const goods: Cell[][] = [['SKU ID', 'SKU 编码', '所属 SPU', '商品名称', '完整规格', '产品类型', '每包数量', '本次总数量', '基本使用', '快充能力', '匹配理由', '人工参考单价（元）','每包行金额（元）','本次参考行金额（元）','参考价来源','输入时间']]
  if (positioned) goods[0]!.push('来源位置 ID', '选配组 ID', '选配组名称', '位置角色')
  for (const row of snapshot.goods) {
    const cells: Cell[] = [row.skuId, row.code, row.familyName, row.name, row.spec, row.typeName, row.perPackageQuantity, row.totalQuantity, compatibilityText[row.compatibility.basicStatus], compatibilityText[row.compatibility.fastChargeStatus], row.compatibility.reasons.join('；'),refMoney(row.referencePrice?.amountCents),refMoney(row.referenceLineCents),refMoney(row.referenceTotalCents),row.referencePrice?'本次人工输入':'未记录',row.referencePrice?.enteredAt||'']
    if (positioned) cells.push(row.lineId, row.groupId ?? '', row.groupName || (row.groupId ? '组名未记录' : '未分组'), row.role === 'host' ? '主机实物' : '商品')
    goods.push(cells)
  }
  const aggregate: Cell[][] = [['SKU ID', 'SKU 编码', '商品名称', '每包汇总数量', '本次汇总数量', '来源位置 ID', '价格说明']]
  if (positioned) for (const row of snapshot.goodsSummary ?? []) {
    aggregate.push([row.skuId, row.code, row.name, row.perPackageQuantity, row.totalQuantity, row.positionIds.join('、'), '参考单价及金额见各组成位置，不合并不同位置价格'])
  }
  const services: Cell[][] = [['服务条目 ID', '服务名称', '计量方式', '每包/每次约定数量', '本次总数量', '单位', '有效期说明', '服务说明','人工参考单价（元）','每包／每次行金额（元）','本次参考行金额（元）','参考价来源','输入时间']]
  for (const row of snapshot.services) services.push([row.id, row.name, row.measurement === 'per-delivery' ? '本次交付计量' : '每包计量', row.perPackageQuantity, row.totalQuantity, row.unit, row.validity, row.description,refMoney(row.referencePrice?.amountCents),refMoney(row.referenceLineCents),refMoney(row.referenceTotalCents),row.referencePrice?'本次人工输入':'未记录',row.referencePrice?.enteredAt||''])
  const conditions: Cell[][] = [['类型', '涉及 SKU', '能力', '状态', '条件/说明', '声明引用', '来源/确认依据', '确认时间']]
  if(positioned) conditions[0]!.push('来源位置 ID','选配组 ID','选配组名称','商品名称','SKU ID','位置角色')
  const identity=(row: BenefitDeliverySnapshot['goods'][number] | undefined, positionId='') : Cell[] => positioned ? [positionId || row?.lineId || '',row?.groupId || '',row?.groupName || (row?.groupId ? '组名未记录' : '未分组／未记录'),row?.name || '',row?.skuId || '',row?.role==='host'?'主机实物':'商品'] : []
  for (const row of snapshot.goods) for (const capability of row.compatibility.capabilities) {
    const prefix = [row.code, capabilityText[capability.capability], compatibilityText[capability.status]]
    if (!capability.conditions.length) conditions.push(['兼容依据', ...prefix, '未附加条件', capability.declarationIds.join('、'), capability.sources.join('；'), '', ...identity(row)])
    for (const condition of capability.conditions) conditions.push(['使用条件', row.code, capabilityText[capability.capability], { met: '已满足', unmet: '未满足', unknown: '需确认' }[condition.state], condition.label, capability.declarationIds.join('、'), capability.sources.join('；'), '', ...identity(row)])
  }
  for (const row of snapshot.confirmations) conditions.push(['本包人工确认', row.skuId, capabilityText[row.capability], '按前提交付，仍为有条件适用', [...row.conditionLabels, row.note].join('；'), row.declarationIds.join('、'), row.basis, row.confirmedAt, ...identity(deliveryConfirmationPosition(snapshot,row),row.positionId)])
  for (const issue of snapshot.issues) conditions.push(['清单说明', issue.skuId || '', '', issue.severity, issue.message, '', '', ''])
  const book = XLSX.utils.book_new()
  const sheets: [string, Cell[][], number[]][] = [
    ['清单概览', overview, [28, 90]], ['商品明细', goods, positioned ? [25, 24, 30, 34, 70, 22, 14, 16, 20, 20, 85, 20, 20, 20, 20, 25, 32, 28, 28, 18] : [25, 24, 30, 34, 70, 22, 14, 16, 20, 20, 85]],
    ...(positioned ? [['SKU 数量汇总', aggregate, [25, 24, 34, 18, 18, 55, 70]] as [string, Cell[][], number[]]] : []),
    ['服务权益', services, [24, 32, 24, 22, 18, 14, 44, 70]], ['条件及确认说明', conditions, [22, 25, 20, 34, 85, 45, 90, 30, 36, 28, 28, 34, 25, 18]],
  ]
  for (const [name, rows, widths] of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    for (const [address, cell] of Object.entries(sheet)) if (!address.startsWith('!') && typeof cell.v === 'string') { cell.t = 's'; delete cell.f }
    sheet['!cols'] = widths.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(book, sheet, name)
  }
  return book
}
function filenamePart(value: string) { return value.replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_').replace(/[ .]+$/g, '').slice(0, 80) || '未编号' }
export function benefitDeliveryFilename(snapshot: BenefitDeliverySnapshot) { return `权益包_${filenamePart(snapshot.packageCode)}_${filenamePart(snapshot.code)}.xlsx` }
export function downloadBenefitDelivery(snapshot: BenefitDeliverySnapshot) { XLSX.writeFile(buildBenefitDeliveryWorkbook(snapshot), benefitDeliveryFilename(snapshot), { bookType: 'xlsx', compression: true }) }
