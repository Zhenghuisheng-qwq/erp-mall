import type { AppData, ProductSpecNode } from './types'
import { createDictionaryParam, createDictionaryValue } from './dictionaryGuard'
import { rebindSpecNode } from './outlineEdit'
import { allowedBusinessValues, businessStructureProblem } from './nodeBusiness'
import { arrangeSpecPositions, specNodeSize, specTreeAdvance, SPEC_LINK_GAP, SPEC_TREE_GAP, SPEC_TREE_ORIGIN_Y } from './logic'
import { captureEditor, type EditorHistoryEntry } from './editorHistory'

export type ModelDictionaryAttribute = { source: 'existing'; attributeId: string } | { source: 'new'; name: string; draftKey: string }
export interface ModelDictionaryBatchInput {
  modelId: string
  session: number
  expected: string
  mode: 'add-attributes' | 'rebind-attribute' | 'add-values' | 'rebind-value'
  parentId?: string | null
  nodeId?: string
  ownerAttributeId?: string
  attributes?: ModelDictionaryAttribute[]
  values?: { value: string; source: 'existing' | 'new' }[]
}
export interface ModelDictionaryPreviewItem {
  key: string
  label: string
  attributeId?: string
  value?: string
  dictionary: 'existing' | 'new'
  status: 'ready' | 'skipped' | 'blocked'
  message?: string
}
export interface ModelDictionaryBatchResult {
  ok: boolean
  message: string
  changed: boolean
  nodeIds: string[]
  skipped: string[]
  items: ModelDictionaryPreviewItem[]
  requiredPermissions: string[]
  historyEntry?: EditorHistoryEntry
}
/** Only line breaks delimit values. Punctuation, spaces, units and decimals remain identities. */
export function parseDictionaryValueLines(text: string): string[] {
  return [...new Set(text.split(/\r\n|\n|\r/).map(value => value.trim()).filter(Boolean))]
}
/** Layout and folding can change while a composer is open without changing its business context. */
export function modelDictionaryBasis(data: AppData, modelId: string): string {
  const snapshot = captureEditor(data, modelId)
  return JSON.stringify({
    exists: data.templates.some(item => item.id === modelId),
    nodes: snapshot.nodes.map(({ positionX, positionY, expanded, ...node }) => node),
    bindings: snapshot.bindings, order: snapshot.order,
  })
}

/** These are the permissions for actual dictionary changes, never for merely selecting a dictionary. */
export function modelDictionaryPermissions(data: AppData, input: ModelDictionaryBatchInput): string[] {
  const codes = new Set(['product:model:update'])
  if (input && ['add-attributes', 'rebind-attribute'].includes(input.mode) && Array.isArray(input.attributes)) for (const item of input.attributes) {
    if (item?.source === 'new' && typeof item.name === 'string' && item.name.trim() && !data.params.some(param => param.name === item.name.trim())) codes.add('product:dictionary:create')
  }
  if (input && ['add-values', 'rebind-value'].includes(input.mode) && Array.isArray(input.values)) {
    const owner = data.params.find(param => param.id === input.ownerAttributeId)
    if (owner && input.values.some(item => item?.source === 'new' && typeof item.value === 'string' && item.value.trim() && !owner.values.includes(item.value.trim()))) codes.add('product:dictionary:update')
  }
  return [...codes]
}

export function modelDictionaryInputProblem(input: unknown): string {
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
  if (!object(input) || !text(input.modelId) || !Number.isInteger(input.session) || Number(input.session) < 0 || !text(input.expected)) return '模型编辑上下文不完整，请重新打开操作面板。'
  if (!['add-attributes', 'rebind-attribute', 'add-values', 'rebind-value'].includes(String(input.mode))) return '不支持的词典节点操作。'
  if (input.parentId !== undefined && input.parentId !== null && !text(input.parentId)) return '父节点标识无效，请重新选择父节点。'
  if (input.nodeId !== undefined && !text(input.nodeId)) return '节点标识无效，请重新选择节点。'
  if (input.ownerAttributeId !== undefined && !text(input.ownerAttributeId)) return '所属属性标识无效，请按属性 ID 重新选择。'
  if (String(input.mode).startsWith('rebind-') && !text(input.nodeId)) return '请选择需要更换引用的具体节点。'
  if (input.mode === 'add-values' && !text(input.parentId)) return '属性值必须添加到一个明确的属性节点。'
  if (input.mode === 'add-values' || input.mode === 'rebind-value') {
    if (!text(input.ownerAttributeId)) return '请选择取值所属的属性 ID。'
    if (!Array.isArray(input.values) || !input.values.length || input.values.some(item => !object(item) || !['existing', 'new'].includes(String(item.source)) || !text(item.value))) return '取值选择结构无效，请重新选择或输入。'
  } else if (!Array.isArray(input.attributes) || !input.attributes.length || input.attributes.some(item => !object(item) || (item.source === 'existing' ? !text(item.attributeId) : item.source === 'new' ? !text(item.name) || !text(item.draftKey) : true))) return '属性选择结构无效，请重新选择或输入。'
  return ''
}

/** Mutates only the caller's isolated candidate. A rejected candidate must never be exposed. */
export function applyModelDictionaryBatch(data: AppData, input: ModelDictionaryBatchInput, nextId: (prefix: string) => string): ModelDictionaryBatchResult {
  const items: ModelDictionaryPreviewItem[] = [], nodeIds: string[] = [], skipped: string[] = []
  const requiredPermissions = modelDictionaryPermissions(data, input)
  const fail = (message: string, item?: ModelDictionaryPreviewItem): ModelDictionaryBatchResult => {
    if (item) { item.status = 'blocked'; item.message = message }
    return { ok: false, message, changed: false, nodeIds: [], skipped, items, requiredPermissions }
  }
  const inputProblem = modelDictionaryInputProblem(input)
  if (inputProblem) return fail(inputProblem)
  const model = data.templates.find(item => item.id === input.modelId)
  if (!model) return fail('模型已不存在，本次没有创建词典或节点。')
  if (!input.expected || input.expected !== modelDictionaryBasis(data, input.modelId)) return fail('模型结构已变化，请核对当前节点后重新打开操作面板；原输入保留。')
  const before = data.productSpecNodes.filter(item => item.templateId === input.modelId).map(item => JSON.parse(JSON.stringify(item)) as ProductSpecNode)
  const nodes = () => data.productSpecNodes.filter(item => item.templateId === input.modelId)
  const target = input.nodeId ? nodes().find(item => item.id === input.nodeId) : undefined
  const addingAttributes = input.mode === 'add-attributes', rebindingAttribute = input.mode === 'rebind-attribute'
  const addingValues = input.mode === 'add-values', rebindingValue = input.mode === 'rebind-value'
  if (!addingAttributes && !rebindingAttribute && !addingValues && !rebindingValue) return fail('不支持的词典节点操作。')
  if ((rebindingAttribute && target?.nodeType !== 'ATTRIBUTE') || (rebindingValue && target?.nodeType !== 'VALUE')) return fail('当前重绑节点已不存在或类型已变化，请重新选择节点。')
  const parentId = addingAttributes ? input.parentId ?? null : addingValues ? input.parentId : target?.parentId
  const parent = parentId ? nodes().find(item => item.id === parentId) : undefined
  if (parentId && !parent) return fail('父节点已不存在或不属于当前模型。')
  if ((addingValues || rebindingValue) && (!parent || parent.nodeType !== 'ATTRIBUTE' || !input.ownerAttributeId || parent.attributeId !== input.ownerAttributeId || (target && target.attributeId !== input.ownerAttributeId))) return fail('取值所属属性已变化，请重新打开该属性的操作面板。')
  if ((addingValues || rebindingValue) && !data.params.some(param => param.id === input.ownerAttributeId)) return fail('取值所属的属性词典已不存在。')
  const freshId = (prefix: string) => {
    let id: string
    do { id = nextId(prefix) } while (data.params.some(param => param.id === id) || data.productSpecNodes.some(node => node.id === id))
    return id
  }
  const bind = (attributeId: string) => {
    let binding = data.templateParams.find(item => item.templateId === model.id && item.paramId === attributeId)
    if (!binding) {
      binding = { templateId: model.id, paramId: attributeId, role: 'variant', required: false }
      data.templateParams.push(binding)
      if (!model.structureOrder.includes(attributeId)) model.structureOrder.push(attributeId)
    }
    return binding
  }
  const append = (nodeType: ProductSpecNode['nodeType'], attributeId: string, valueId = '') => {
    const siblings = nodes().filter(item => item.parentId === (parentId ?? null))
    const binding = nodeType === 'ATTRIBUTE' ? bind(attributeId) : undefined
    const id = freshId('sn')
    data.productSpecNodes.push({ id, templateId: model.id, parentId: parentId ?? null, nodeType, attributeId, valueId,
      sort: Math.max(0, ...siblings.map(item => item.sort)) + 1,
      ...(binding ? { role: binding.role === 'common' ? 'COMMON' as const : 'VARIANT' as const } : {}), positionX: 0, positionY: 0 })
    nodeIds.push(id)
  }
  if (addingAttributes || rebindingAttribute) {
    if (!Array.isArray(input.attributes) || !input.attributes.length || (rebindingAttribute && input.attributes.length !== 1)) return fail(rebindingAttribute ? '更换属性只能选择一个词典项。' : '请至少选择或新建一个属性。')
    const seen = new Set<string>()
    for (const selection of input.attributes) {
      if (!selection || !['existing', 'new'].includes(selection.source)) return fail('属性选择结构无效，请重新选择。')
      let attributeId = '', dictionary: 'existing' | 'new' = 'existing'
      if (selection.source === 'existing') {
        if (typeof selection.attributeId !== 'string' || !data.params.some(param => param.id === selection.attributeId)) return fail('所选属性词典项已不存在，请按属性 ID 重新选择。')
        attributeId = selection.attributeId
      } else {
        if (typeof selection.name !== 'string' || typeof selection.draftKey !== 'string' || !selection.draftKey) return fail('新属性草稿不完整，请填写名称。')
        const written = createDictionaryParam(data, selection.name, () => freshId('p'))
        if (!written.ok) return fail(written.message)
        attributeId = written.id; dictionary = written.created ? 'new' : 'existing'
      }
      const param = data.params.find(item => item.id === attributeId)!
      const item: ModelDictionaryPreviewItem = { key: selection.source === 'new' ? selection.draftKey : attributeId, label: param.name, attributeId, dictionary, status: 'ready' }
      items.push(item)
      const duplicate = seen.has(attributeId) || (addingAttributes && nodes().some(node => node.parentId === (parentId ?? null) && node.nodeType === 'ATTRIBUTE' && node.attributeId === attributeId))
      seen.add(attributeId)
      if (duplicate) { item.status = 'skipped'; item.message = '当前父节点下已有此属性，已跳过。'; skipped.push(param.name); continue }
      if (rebindingAttribute) {
        const result = rebindSpecNode(data, target!.id, { attributeId })
        if (!result.ok) return fail(result.message, item)
        if (!result.changed) { item.status = 'skipped'; skipped.push(param.name) }
        else { const binding = bind(attributeId); target!.role = binding.role === 'common' ? 'COMMON' : 'VARIANT'; nodeIds.push(target!.id) }
      } else append('ATTRIBUTE', attributeId)
    }
  } else {
    if (!Array.isArray(input.values) || !input.values.length || (rebindingValue && input.values.length !== 1)) return fail(rebindingValue ? '更换取值只能选择一项。' : '请至少选择或输入一个属性值。')
    const owner = data.params.find(item => item.id === input.ownerAttributeId)!, seen = new Set<string>()
    for (const selection of input.values) {
      if (!selection || !['existing', 'new'].includes(selection.source) || typeof selection.value !== 'string' || !selection.value.trim()) return fail('取值选择结构无效，请重新选择或输入。')
      const value = selection.value.trim(), existed = owner.values.includes(value)
      const item: ModelDictionaryPreviewItem = { key: value, label: value, value, attributeId: owner.id, dictionary: existed ? 'existing' : 'new', status: 'ready' }
      items.push(item)
      if (selection.source === 'existing' && !existed) return fail(`「${owner.name}」下的原取值「${value}」已不存在，请重新核对；不会自动重建。`, item)
      if (!existed) {
        const written = createDictionaryValue(data, owner.id, value)
        if (!written.ok) return fail(written.message, item)
      }
      const allowed = allowedBusinessValues(data, nodes(), parent!.id)
      if (allowed.message || !allowed.values.includes(value)) return fail(allowed.message || `「${value}」超出当前路径允许值范围；没有修改全局词典或当前模型。`, item)
      if (seen.has(value) || (addingValues && nodes().some(node => node.parentId === parent!.id && node.nodeType === 'VALUE' && node.valueId === value))) {
        item.status = 'skipped'; item.message = '当前属性节点下已有此取值，已跳过。'; skipped.push(value); continue
      }
      seen.add(value)
      if (rebindingValue) {
        const result = rebindSpecNode(data, target!.id, { valueId: value })
        if (!result.ok) return fail(result.message, item)
        if (!result.changed) { item.status = 'skipped'; skipped.push(value) } else nodeIds.push(target!.id)
      } else append('VALUE', owner.id, value)
    }
  }
  const problem = businessStructureProblem(data, before, nodes())
  if (problem) return fail(problem)
  const changed = nodeIds.length > 0
  if (changed) {
    if (parent) parent.expanded = true
    const canvas = data.specCanvases.find(item => item.templateId === model.id)
    const title = canvas?.name?.trim() || model.name.trim() || '商品模型'
    const origin = 16 + Math.max(148, specNodeSize('ATTRIBUTE', title).width) + SPEC_LINK_GAP
    const label = (node: ProductSpecNode) => node.nodeType === 'VALUE' ? node.valueId || '未命名取值' : data.params.find(param => param.id === node.attributeId)?.name || '未绑定属性'
    if (!(canvas?.direction === 'custom' && canvas.layoutLocked === true)) {
      arrangeSpecPositions(nodes(), label, origin)
      if (canvas) { canvas.direction = 'logic'; canvas.layoutLocked = false }
    }
    else for (const node of nodes().filter(item => nodeIds.includes(item.id) && !before.some(old => old.id === item.id)).sort((a, b) => a.sort - b.sort)) {
      // Same placement as the designer's placeFreshNodes, limited to this batch.
      const owner = node.parentId ? nodes().find(item => item.id === node.parentId) : undefined
      const left = owner ? (owner.positionX ?? origin) + specTreeAdvance(owner.nodeType, label(owner)) : origin
      node.positionX = left
      const size = specNodeSize(node.nodeType, label(node))
      let y = owner?.positionY ?? SPEC_TREE_ORIGIN_Y
      const placed = () => nodes().filter(item => item.id !== node.id && !(item.positionX === 0 && item.positionY === 0))
      const hits = (top: number) => placed().some(item => {
        const box = specNodeSize(item.nodeType, label(item)), itemLeft = item.positionX ?? 0, itemTop = item.positionY ?? 0
        return !(left + size.width <= itemLeft || itemLeft + box.width <= left || top + size.height <= itemTop || itemTop + box.height <= top)
      })
      let guard = 0
      while (hits(y) && guard < 64) {
        const bottoms = placed().map(item => (item.positionY ?? 0) + specNodeSize(item.nodeType, label(item)).height)
        y = Math.max(y + size.height, ...bottoms) + SPEC_TREE_GAP
        guard++
      }
      node.positionY = y
    }
  }
  return { ok: true, message: changed ? `已保存 ${nodeIds.length} 项节点操作${skipped.length ? `，跳过 ${skipped.length} 项已有引用` : ''}；模型未发布。` : '当前父节点下已有所选引用，没有重复创建。', changed, nodeIds, skipped, items, requiredPermissions }
}

export function previewModelDictionaryBatch(data: AppData, input: ModelDictionaryBatchInput, requiredPermissions?: readonly string[]): ModelDictionaryBatchResult {
  const next = JSON.parse(JSON.stringify(data)) as AppData
  let serial = 0
  const preview = applyModelDictionaryBatch(next, input, prefix => `preview:${prefix}:${++serial}`)
  return requiredPermissions ? { ...preview, requiredPermissions: [...requiredPermissions] } : preview
}
