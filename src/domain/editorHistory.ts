import type { AppData, ParamDef, ProductSpecNode } from './types'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export type EditorSnapshot = ReturnType<typeof captureEditor>
export interface EditorHistoryEntry {
  modelId: string
  session: number
  before: Omit<EditorSnapshot, 'params'>
  after: Omit<EditorSnapshot, 'params'>
  dictionary: { id: string; before?: ParamDef; after?: ParamDef }[]
}
export function captureEditor(data: AppData, modelId: string) {
  return clone({
    nodes: data.productSpecNodes.filter(n => n.templateId === modelId),
    bindings: data.templateParams.filter(n => n.templateId === modelId),
    order: data.templates.find(n => n.id === modelId)?.structureOrder || [],
    nodeRules: (data.nodeCompatibilityRules || []).filter(r => r.templateId === modelId && r.modelVersionId === ''),
    params: data.params,
  })
}
export function editorEntry(modelId: string, session: number, before: EditorSnapshot, after: EditorSnapshot): EditorHistoryEntry | undefined {
  const { params: oldParams, ...oldModel } = before
  const { params: newParams, ...newModel } = after
  const ids = new Set([...oldParams, ...newParams].map(p => p.id))
  const dictionary = [...ids].flatMap(id => {
    const before = oldParams.find(p => p.id === id), after = newParams.find(p => p.id === id)
    return same(before, after) ? [] : [{ id, before, after }]
  })
  if (sameEditorModel(oldModel, newModel) && !dictionary.length) return undefined
  return { modelId, session, before: oldModel, after: newModel, dictionary }
}
// Layout and local expansion do not invalidate a structural undo.
function structural(nodes: ProductSpecNode[]) {
  return nodes.map(({ positionX, positionY, expanded, ...node }) => node)
}
export function sameEditorModel(a: Omit<EditorSnapshot, 'params'>, b: Omit<EditorSnapshot, 'params'>) {
  return same(structural(a.nodes), structural(b.nodes)) && same(a.bindings, b.bindings) && same(a.order, b.order) && same(a.nodeRules, b.nodeRules)
}
function contains(value: unknown, target: string): boolean {
  if (value === target) return true
  if (Array.isArray(value)) return value.some(v => contains(v, target))
  return !!value && typeof value === 'object' && Object.entries(value).some(([key, v]) => key === target || contains(v, target))
}
/** Build the entire candidate before touching live state. Conflicts never consume history. */
export function prepareEditorUndo(data: AppData, entry: EditorHistoryEntry, modelId: string, session: number) {
  const fail = (message: string) => ({ ok: false as const, message })
  if (entry.modelId !== modelId || entry.session !== session || !data.templates.some(t => t.id === modelId)) return fail('编辑上下文已变化，不能应用旧撤销。')
  const current = captureEditor(data, modelId)
  if (!sameEditorModel(current, entry.after)) return fail('模型已有后续修改，未执行撤销。')
  const params = clone(data.params)
  const nodes = [...data.productSpecNodes.filter(n => n.templateId !== modelId), ...clone(entry.before.nodes)]
  const bindings = [...data.templateParams.filter(n => n.templateId !== modelId), ...clone(entry.before.bindings)]
  for (const change of entry.dictionary) {
    const index = params.findIndex(p => p.id === change.id)
    if (!same(params[index], change.after)) return fail('词典已有后续修改，未执行撤销。')
    // Reject shared edits rather than silently altering another model or published snapshot.
    const external = { ...data, params: [], productSpecNodes: nodes.filter(n => n.templateId !== modelId), templateParams: bindings.filter(n => n.templateId !== modelId), templates: data.templates.filter(t => t.id !== modelId) }
    if (contains(external, change.id) || (change.after && contains(external, change.after.name))) return fail('词典已被其他模型或历史数据引用，未执行撤销。')
    if (change.before) {
      if (index < 0) params.push(clone(change.before))
      else params[index] = clone(change.before)
    } else if (index >= 0) params.splice(index, 1)
  }
  if (new Set(nodes.map(n => n.id)).size !== nodes.length) return fail('节点标识冲突，未执行撤销。')
  for (const node of entry.before.nodes) {
    const param = params.find(p => p.id === node.attributeId)
    if (node.attributeId && (!param || (node.nodeType === 'VALUE' && !param.values.includes(node.valueId)))) return fail('属性或取值已变化，恢复会产生无效引用。')
    if (node.parentId && !entry.before.nodes.some(n => n.id === node.parentId)) return fail('父节点已不存在，未执行撤销。')
  }
  if (entry.before.bindings.some(b => !params.some(p => p.id === b.paramId)) || entry.before.order.some(id => !params.some(p => p.id === id))) return fail('模型属性关联已失效，未执行撤销。')
  const nodeRules = [...(data.nodeCompatibilityRules || []).filter(r => r.templateId !== modelId || r.modelVersionId !== ''), ...clone(entry.before.nodeRules)]
  return { ok: true as const, nodes, bindings, params, nodeRules, order: clone(entry.before.order) }
}
