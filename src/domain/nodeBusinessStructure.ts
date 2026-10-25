import type { AppData, ProductSpecNode } from './types'
import type { BusinessDefinition, NodeBusinessConfig } from './nodeBusiness'

const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown) => typeof v === 'string' && Boolean(v.trim())
export function definitionStructureProblem(v: unknown): string {
  if (!record(v)) return '定义记录必须是对象。'
  if (!['id', 'kind', 'name'].every(k => text(v[k])) || typeof v.description !== 'string' || typeof v.enabled !== 'boolean') return '定义缺少有效的 id、kind、name、description 或 enabled。'
  return ''
}
export function configStructureProblem(v: unknown, definitions: BusinessDefinition[] = []): string {
  if (!record(v)) return '配置记录必须是对象，不能为 null。'
  if (!['id', 'definitionId', 'modelId', 'nodeId', 'scope'].every(k => text(v[k])) || typeof v.enabled !== 'boolean') return '配置缺少有效的身份、作用范围或启用状态。'
  if (!record(v.parameters)) return '配置 parameters 必须是参数对象。'
  if (v.definitionSnapshot !== undefined && definitionStructureProblem(v.definitionSnapshot)) return '冻结定义结构损坏。'
  if (v.dictionarySnapshot !== undefined) {
    const d = v.dictionarySnapshot
    if (!record(d) || !text(d.id) || typeof d.name !== 'string' || !Array.isArray(d.values) || d.values.some(x => typeof x !== 'string')) return '冻结词典结构损坏。'
  }
  const kind = (v.definitionSnapshot as BusinessDefinition | undefined)?.kind || definitions.find(d => d.id === v.definitionId)?.kind
  if (kind === 'allowed-values' && (!text(v.parameters.attributeId) || !Array.isArray(v.parameters.values) || v.parameters.values.some(x => typeof x !== 'string'))) return '允许值参数必须包含 attributeId 和字符串数组 values。'
  if (['sales-position', 'material-policy'].includes(kind || '') && typeof v.parameters.value !== 'string') return '配置参数缺少字符串 value。'
  return ''
}
export function safeBusinessConfigs(value: unknown): NodeBusinessConfig[] {
  return Array.isArray(value) ? value.filter(v => !configStructureProblem(v)) as NodeBusinessConfig[] : []
}
export function businessRecordProblems(data: AppData, nodes: ProductSpecNode[], definitions: BusinessDefinition[]): string[] {
  const problems: string[] = []
  if (data.businessDefinitions !== undefined) {
    if (!Array.isArray(data.businessDefinitions)) problems.push('businessDefinitions 必须是数组。')
    else data.businessDefinitions.forEach((d, i) => { const p = definitionStructureProblem(d); if (p) problems.push(`businessDefinitions[${i}]：${p}`) })
  }
  for (const node of nodes) {
    const value = node.businessConfigs
    const source = `模型 ${node.templateId} / 节点 ${node.valueId || node.id} (${node.id})`
    if (value === undefined) continue
    if (!Array.isArray(value)) { problems.push(`${source}：businessConfigs 必须是数组。`); continue }
    value.forEach((c, i) => { const p = configStructureProblem(c, definitions); if (p) problems.push(`${source} / 配置[${i}]：${p}`) })
  }
  return problems
}
/** Includes identities and frozen fields; role is checked by the caller before replacing data. */
export function businessImportSignature(data: AppData) {
  const nodes = (items: ProductSpecNode[] = []) => items.filter(n => n.businessConfigs !== undefined).map(n => [n.templateId, n.id, n.businessConfigs])
  return JSON.stringify([data.businessDefinitions, nodes(data.productSpecNodes), (data.specModelVersions || []).filter(v => v.nodesSnapshot?.some(n => n.businessConfigs !== undefined)).map(v => [v.templateId, v.id, v.version, nodes(v.nodesSnapshot)])])
}
