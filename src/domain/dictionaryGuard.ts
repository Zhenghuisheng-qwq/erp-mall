import type { AppData, ProductSpecNode } from './types'

function matchesNode(node: ProductSpecNode, paramId: string, value?: string) {
  if (node.attributeId !== paramId) return false
  if (value === undefined) return true
  return node.nodeType === 'VALUE' && node.valueId === value
}

/** 按属性 id 和取值身份检查引用。同一个文字出现在别的属性里，不算引用。 */
export function dictionaryRemovalBlock(data: AppData, paramId: string, value?: string) {
  const param = data.params.find((item) => item.id === paramId)
  if (!param) return '参数不存在'
  const sources: string[] = []
  if (data.specModelVersions.some((version) => version.nodesSnapshot.some((node) => matchesNode(node, paramId, value)))) sources.push('商品模型的已发布版本')
  if (data.productSpecNodes.some((node) => matchesNode(node, paramId, value))) sources.push('正在编辑的商品模型')
  if ((data.planningRecords || []).some((record) => record.steps.some((step) => step.attributeId === paramId && (value === undefined || step.valueId === value)))) sources.push('规划编号')
  const materialHit = data.skus.some((sku) => sku.manualAttrs?.some((item) => item.attributeId === paramId && (value === undefined || item.value === value)))
  if (materialHit) sources.push('物料')
  const productHit = value === undefined
    ? data.families.some((family) => Boolean(family.commonAttrs[param.name])) || data.skus.some((sku) => Boolean(sku.variantAttrs[param.name] || sku.projectedAttrs?.[param.name]))
    : data.families.some((family) => family.commonAttrs[param.name] === value) || data.skus.some((sku) => sku.variantAttrs[param.name] === value || sku.projectedAttrs?.[param.name] === value)
  if (productHit) sources.push('商品')
  if (value === undefined && data.templateParams.some((item) => item.paramId === paramId)) sources.push('属性方案')
  const ruleHit = data.rules.some((rule) => {
    if (rule.legacy) return false
    if (value === undefined) return rule.targetParamId === paramId || rule.sourceParamIds.includes(paramId)
    if (rule.targetParamId === paramId && rule.options.includes(value)) return true
    return rule.sourceParamIds.includes(paramId) && rule.conditions[paramId] === value
  })
  if (ruleHit) sources.push('规格规则')
  if (!sources.length) return ''
  const subject = value === undefined ? '该属性' : '该属性值'
  return `${subject}正在被${sources.join('、')}使用，不能删除。`
}
