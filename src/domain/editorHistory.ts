import type { AppData, ParamDef, ProductSpecNode } from './types'
import type { SkuViewConfig } from './skuWorkbenchTypes'
import { skuFields } from './skuWorkbenchFields'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export type EditorSnapshot = ReturnType<typeof captureEditor>
export interface EditorHistoryEntry {
  /** In-memory receipt for an accepted atomic dictionary/model command. Never persisted. */
  commandId?: string
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
  return same(structural(a.nodes), structural(b.nodes)) && same(a.bindings, b.bindings) && same(a.order, b.order)
}
function contains(value: unknown, target: string): boolean {
  if (value === target) return true
  if (Array.isArray(value)) return value.some(v => contains(v, target))
  return !!value && typeof value === 'object' && Object.entries(value).some(([key, v]) => key === target || contains(v, target))
}
/** SKU alias dictionaries cache labels for every attribute, including unused ones. */
function withoutSkuAliasMetadata(data: AppData): AppData {
  const config = (value: SkuViewConfig) => { const { attributeNames: _names, ...rest } = value; return rest }
  const view = (value: NonNullable<AppData['productListViews']>[number]) => value.skuWorkbench ? { ...value, skuWorkbench: config(value.skuWorkbench) } : value
  const pages = data.productListPages && { ...data.productListPages }
  if (pages) for (const mode of ['spu', 'sku'] as const) {
    const page = pages[mode]
    if (!page) continue
    pages[mode] = { ...page, views: page.views.map(view), ...(page.skuWorkbench ? { skuWorkbench: { ...page.skuWorkbench, working: Object.fromEntries(Object.entries(page.skuWorkbench.working).map(([id, value]) => [id, config(value)])) } } : {}) }
  }
  return { ...data, ...(data.productListViews ? { productListViews: data.productListViews.map(view) } : {}), ...(pages ? { productListPages: pages } : {}) }
}
/** Build the entire candidate before touching live state. Conflicts never consume history. */
export function prepareEditorUndo(data: AppData, entry: EditorHistoryEntry, modelId: string, session: number) {
  const fail = (message: string) => ({ ok: false as const, message })
  if (entry.modelId !== modelId || entry.session !== session || !data.templates.some(t => t.id === modelId)) return fail('编辑上下文已变化，不能应用旧撤销。')
  const current = captureEditor(data, modelId)
  if (!sameEditorModel(current, entry.after)) return fail('模型已有后续修改，未执行撤销。')
  const params = clone(data.params)
  const restoredNodes = clone(entry.before.nodes).map(node => {
    const current = data.productSpecNodes.find(item => item.id === node.id && item.templateId === modelId)
    const after = entry.after.nodes.find(item => item.id === node.id)
    if (current) for (const key of ['positionX', 'positionY', 'expanded'] as const) {
      // Undo this command's own layout only. Preserve a field changed after it.
      const value = current[key] === after?.[key] ? node[key] : current[key]
      if (value === undefined) delete node[key]
      else Object.assign(node, { [key]: value })
    }
    return node
  })
  const nodes = [...data.productSpecNodes.filter(n => n.templateId !== modelId), ...restoredNodes]
  const bindings = [...data.templateParams.filter(n => n.templateId !== modelId), ...clone(entry.before.bindings)]
  const external = withoutSkuAliasMetadata({ ...data, compatibilities: [], generalCompatibilityClaims: undefined, deviceModels: undefined, deviceBindings: undefined, nodeCompatibilityRules: undefined, templateCompatibilityConfigs: undefined, templateCompatibilityOrigins: undefined, materialContributions: undefined, specModelVersions: data.specModelVersions.map(({templateCompatibilitySnapshot: _raw, ...version})=>version), params: [], productSpecNodes: nodes.filter(n => n.templateId !== modelId), templateParams: bindings.filter(n => n.templateId !== modelId), templates: data.templates.filter(t => t.id !== modelId) })
  const registeredFields = new Set(skuFields(data).map(field => field.id))
  for (const change of entry.dictionary) {
    const index = params.findIndex(p => p.id === change.id)
    if (!same(params[index], change.after)) return fail('词典已有后续修改，未执行撤销。')
    // Reject shared edits rather than silently altering another model or published snapshot.
    // attr:<ID> is the registered SKU/SPU dynamic-field identity, not a name guess.
    const fieldId = `attr:${change.id}`
    if (contains(external, change.id) || (registeredFields.has(fieldId) && contains(external, fieldId)) || (change.after && contains(external, change.after.name))) return fail('词典已被其他模型或历史数据引用，未执行撤销。')
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
  return { ok: true as const, nodes, bindings, params, order: clone(entry.before.order) }
}
