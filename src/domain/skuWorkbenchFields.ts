import { categoryPath, shelfOf, shelfText } from './logic'
import { familyBrandValues, linkedModelName, savedSkuCode, savedSkuName, savedSkuSpec } from './productList'
import type { AppData, ProductFamily, Sku } from './types'
import type { SkuField, SkuFieldType, SkuFieldValue, SkuOperator } from './skuWorkbenchTypes'

const labels: Record<SkuOperator, string> = {
  contains: '包含', notContains: '不包含', eq: '等于', neq: '不等于', startsWith: '开头是',
  in: '属于任意一个', notIn: '不属于', hasAny: '包含任意一个', hasAll: '包含全部',
  empty: '为空', notEmpty: '不为空', gt: '大于', gte: '大于等于', lt: '小于', lte: '小于等于',
  between: '介于', before: '早于', after: '晚于', relative: '相对日期', descendants: '包含下级分类',
}
const operators: Record<SkuFieldType, SkuOperator[]> = {
  text: ['contains', 'notContains', 'eq', 'neq', 'startsWith', 'empty', 'notEmpty'],
  enum: ['eq', 'neq', 'in', 'notIn', 'empty', 'notEmpty'],
  multi: ['hasAny', 'hasAll', 'notIn', 'empty', 'notEmpty'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'notEmpty'],
  date: ['eq', 'before', 'after', 'between', 'relative', 'empty', 'notEmpty'],
  boolean: ['eq', 'empty', 'notEmpty'],
  spu: ['eq', 'neq', 'in', 'notIn', 'empty', 'notEmpty'],
  category: ['eq', 'neq', 'in', 'notIn', 'descendants', 'empty', 'notEmpty'],
}

export function skuOperators(type: SkuFieldType) {
  return operators[type].map(value => ({ value, label: labels[value] }))
}

/** IDs identify fields; labels and the saved business attribute names do not. */
export function skuFields(data: AppData): SkuField[] {
  const field = (id: string, label: string, source: string, type: SkuFieldType = 'text', options: SkuField['options'] = [], groupable = true): SkuField => ({ id, label, source, type, options, sortable: type !== 'multi', groupable })
  return [
    field('code', 'SKU 编号', 'SKU'), field('name', 'SKU 名称', 'SKU'), field('spec', '完整规格', 'SKU', 'text', [], false),
    field('familyId', '所属 SPU', 'SPU', 'spu', data.families.map(item => ({ value: item.id, label: `${item.name} · ${item.oaProductId || item.id}` }))),
    field('category', '商品分类', 'SPU', 'category', data.categories.map(item => ({ value: item.id, label: categoryPath(data, item.id) }))),
    field('status', 'SKU 状态', 'SKU', 'enum', [{ value: 'on_sale', label: '在售' }, { value: 'off_sale', label: '停售' }, { value: 'draft', label: '草稿' }]),
    field('oaSkuId', 'OA_SKUID', 'SKU'), field('typeName', '产品类型', 'SPU'), field('modelName', '商品模型', 'SPU'),
    field('createdAt', 'SKU 创建日期', 'SKU', 'date'), field('updatedAt', '最近维护', 'SKU', 'date'),
    field('legacy.created', 'SPU 创建日期（历史含义）', 'SPU', 'date'),
    field('sourceKind', 'SKU 来源方式', 'SKU', 'enum', [{ value: 'manual', label: '手工创建' }, { value: 'template', label: '属性方案' }, { value: 'model', label: '模型' }, { value: 'plan', label: '规划' }]),
    field('spuGroups', '所属 SPU 分组', 'SPU', 'multi', data.productGroups.map(item => ({ value: item.id, label: item.name }))),
    // Retain original query identities instead of silently reinterpreting saved rules.
    field('familyName', 'SPU 名称（历史字段）', '历史 SPU'), field('oaProductId', 'OA_ProductID（历史字段）', '历史 SPU'),
    field('brand', '品牌（历史字段）', '历史 SPU'), field('productType', '产品类型（历史字段）', '历史 SPU'),
    field('template', '属性方案（历史字段）', '历史 SPU'), field('shelf', '商品状态（历史字段）', '历史 SPU'),
    field('group', 'SPU 分组（历史字段）', '历史 SPU'),
    ...data.params.map(param => ({...field(`attr:${param.id}`, param.name, `动态属性 · ${param.id}`, param.values.length ? 'enum' : 'text', param.values.map(value => ({ value, label: value }))),allowCustom:true})),
  ]
}

/** Optional aliases were observed for this stable attribute ID in view metadata. */
export function skuFieldValue(data: AppData, sku: Sku, family: ProductFamily, fieldId: string, aliases: Record<string, string[]> = {}): SkuFieldValue {
  const value = (entry: SkuFieldValue['value']): SkuFieldValue => ({ applicable: true, value: entry })
  if (fieldId.startsWith('attr:')) {
    const id = fieldId.slice(5)
    const param = data.params.find(item => item.id === id)
    if (!param) return { applicable: false, value: null }
    const bound = data.templateParams.some(item => item.templateId === family.templateId && item.paramId === id)
    const manual = sku.manualAttrs?.find(item => item.attributeId === id)
    const planning = data.planningRecords.find(item => item.planningId === sku.planningId)?.steps.find(item => item.attributeId === id)
    if (!bound && !manual && !planning) return { applicable: false, value: null }
    if (manual) return value(manual.value)
    const names = [...new Set([param.name, ...(aliases[id] || []), ...(planning ? [planning.attributeName] : [])])]
    // SKU variant values retain their precedence over shared SPU values.
    for (const attrs of [sku.variantAttrs, family.commonAttrs]) {
      for (const name of names) if (Object.hasOwn(attrs, name)) return value(attrs[name] ?? null)
    }
    return value(null)
  }
  switch (fieldId) {
    case 'code': return value(savedSkuCode(sku))
    case 'name': return value(savedSkuName(sku))
    case 'spec': return value(savedSkuSpec(family, sku))
    case 'familyId': return value(family.id)
    case 'category': return value(family.categoryId || null)
    case 'status': return value(sku.status)
    case 'oaSkuId': return value(sku.oaSkuId || null)
    case 'typeName': return value(family.productTypeId ? data.productTypes.find(item => item.id === family.productTypeId)?.name || null : null)
    case 'modelName': { const name = linkedModelName(data, family); return value(name === '未关联' ? null : name) }
    case 'createdAt': return value(sku.createdAt || null)
    case 'updatedAt': return value(sku.updatedAt || null)
    case 'legacy.created': return value(family.createdAt || family.updatedAt || null)
    case 'sourceKind': return value(sku.creationSource?.kind || null)
    case 'spuGroups': return value([...family.productGroupIds])
    case 'familyName': return value(family.name)
    case 'oaProductId': return value(family.oaProductId || null)
    case 'brand': return value(familyBrandValues(data, family).join('、') || null)
    case 'productType': return value(family.productTypeId ? data.productTypes.find(item => item.id === family.productTypeId)?.name || null : null)
    case 'template': return value(data.templates.find(item => item.id === family.templateId)?.name || null)
    case 'shelf': return value(shelfText(shelfOf(family)))
    case 'group': return value(family.productGroupIds.map(id => data.productGroups.find(item => item.id === id)?.name || '').filter(Boolean).join('、') || null)
    default: return { applicable: false, value: null }
  }
}
