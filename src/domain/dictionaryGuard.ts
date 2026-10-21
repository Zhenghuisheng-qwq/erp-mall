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

export interface DictionaryWriteResult {
  ok: boolean
  created: boolean
  message: string
  id: string
  value: string
}

/** 写入全局属性。同名只有一条时改为引用；多条同名时不合并。 */
export function createDictionaryParam(data: AppData, name: string, nextId: () => string): DictionaryWriteResult {
  const text = name.trim()
  if (!text) return { ok: false, created: false, message: '请填写属性名称。', id: '', value: '' }
  const matches = data.params.filter((item) => item.name === text)
  if (matches.length > 1) return { ok: false, created: false, message: `已有 ${matches.length} 个同名属性「${text}」。请从列表按词典选择，不会按名称合并。`, id: '', value: '' }
  if (matches.length === 1) return { ok: true, created: false, message: `属性词典已有「${text}」，已改为引用，没有重复创建。`, id: matches[0].id, value: '' }
  const id = nextId()
  data.params.push({ id, name: text, values: [], valueGroups: [], participateInStructure: true })
  return { ok: true, created: true, message: `已把「${text}」写入全局属性词典。`, id, value: '' }
}

/** 写入某个属性自己的取值。相同文字可以出现在别的属性下，不会合并。 */
export function createDictionaryValue(data: AppData, paramId: string, value: string): DictionaryWriteResult {
  const text = value.trim()
  const param = data.params.find((item) => item.id === paramId)
  if (!param) return { ok: false, created: false, message: '请先确定这个值属于哪个属性。', id: '', value: '' }
  if (!text) return { ok: false, created: false, message: '请填写属性值。', id: param.id, value: '' }
  if (param.values.includes(text)) return { ok: true, created: false, message: `「${param.name}」已有取值「${text}」，已改为引用，没有重复创建。`, id: param.id, value: text }
  param.values.push(text)
  return { ok: true, created: true, message: `已把「${text}」写入「${param.name}」的属性值词典。`, id: param.id, value: text }
}

function publishedUsesAttribute(data: AppData, paramId: string) {
  return data.specModelVersions.some((version) => version.nodesSnapshot.some((node) => node.attributeId === paramId))
}

function publishedUsesValue(data: AppData, paramId: string, value: string) {
  return data.specModelVersions.some((version) => version.nodesSnapshot.some((node) => node.attributeId === paramId && node.nodeType === 'VALUE' && node.valueId === value))
}

/** 属性名称改的是全局词典。已发布快照只存属性 ID，界面仍读词典名称，所以被快照引用时不能改名。 */
export function attributeRenameDecision(data: AppData, paramId: string, nextName: string) {
  const param = data.params.find((item) => item.id === paramId)
  const text = nextName.trim()
  if (!param) return { ok: false, needsConfirm: false, message: '属性不存在。' }
  if (!text) return { ok: false, needsConfirm: false, message: '请填写属性名称。' }
  if (param.name === text) return { ok: true, needsConfirm: false, message: '' }
  if (data.params.some((item) => item.id !== paramId && item.name === text)) return { ok: false, needsConfirm: false, message: `已有同名属性「${text}」。请更换当前节点的引用，不会合并两个词典。` }
  if (publishedUsesAttribute(data, paramId)) return { ok: false, needsConfirm: false, message: `不能修改全局属性「${param.name}」。已发布快照只记录了属性 ID，打开模型时仍读取现在的名称。请新增一个属性，再把当前草稿节点改成引用新属性。` }
  const drafts = data.productSpecNodes.filter((node) => node.nodeType === 'ATTRIBUTE' && node.attributeId === paramId)
  const models = new Set(drafts.map((node) => node.templateId))
  const scope = drafts.length ? `${models.size} 个草稿模型里的 ${drafts.length} 个属性节点会改显示名称，节点 ID 不变。` : '当前没有模型节点引用它。'
  return { ok: true, needsConfirm: true, message: `这是修改全局词典「${param.name}」，不是更换某一个节点的引用。${scope}` }
}

/** 取值文字本身就是引用身份。只要草稿、快照或规划还用着它，就不能改字。 */
export function valueRenameDecision(data: AppData, paramId: string, value: string, nextValue: string) {
  const param = data.params.find((item) => item.id === paramId)
  const text = nextValue.trim()
  if (!param || !param.values.includes(value)) return { ok: false, needsConfirm: false, message: '这个属性下没有该取值。' }
  if (!text) return { ok: false, needsConfirm: false, message: '请填写属性值。' }
  if (text === value) return { ok: true, needsConfirm: false, message: '' }
  if (param.values.includes(text)) return { ok: false, needsConfirm: false, message: `「${param.name}」已有取值「${text}」。请让当前节点改引用它，不会改掉「${value}」。` }
  const draft = data.productSpecNodes.some((node) => node.attributeId === paramId && node.nodeType === 'VALUE' && node.valueId === value)
  const published = publishedUsesValue(data, paramId, value)
  const planning = (data.planningRecords || []).some((record) => record.steps.some((step) => step.attributeId === paramId && step.valueId === value))
  if (draft || published || planning) return { ok: false, needsConfirm: false, message: `不能修改全局取值「${value}」。它的文字就是节点和快照里的引用。请新增「${text}」，再把当前草稿节点改成引用新值。` }
  return { ok: true, needsConfirm: true, message: `将把「${param.name}」下未被引用的取值「${value}」改成「${text}」。` }
}
