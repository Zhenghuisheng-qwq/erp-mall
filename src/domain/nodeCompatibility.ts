import { hostLabel, linksOfSku, listHostModels } from './compatibility'
import type { AppData, CompatibilityHost, NodeCompatibilityRule, Sku } from './types'

export interface NodeHostWriteResult {
  added: CompatibilityHost[]
  skipped: number
  failed: { message: string }[]
}

function rulesOf(data: AppData) {
  if (!Array.isArray(data.nodeCompatibilityRules)) data.nodeCompatibilityRules = []
  return data.nodeCompatibilityRules
}

function cloneHost(host: CompatibilityHost): CompatibilityHost {
  return { ...host, steps: host.steps.map((step) => ({ ...step })), planningId: host.planningId }
}

function sameHost(left: CompatibilityHost, right: CompatibilityHost) {
  return left.scope === right.scope && left.productModelId === right.productModelId && left.identityKey === right.identityKey && (left.planningId || '') === (right.planningId || '')
}

function hostSignature(host: CompatibilityHost) {
  return `${host.productModelId}|${host.scope}|${host.identityKey}|${host.planningId || ''}`
}

export function nodeHostSignature(rules: NodeCompatibilityRule[]) {
  return rules
    .map((rule) => `${rule.nodeId}:${rule.hosts.map(hostSignature).sort().join(',')}`)
    .sort()
    .join('\n')
}

export function draftNodeRules(data: AppData, templateId: string) {
  return rulesOf(data).filter((item) => item.templateId === templateId && item.modelVersionId === '')
}

export function versionNodeRules(data: AppData, modelVersionId: string) {
  return rulesOf(data).filter((item) => item.modelVersionId === modelVersionId)
}

export function draftHostRulesDiffer(data: AppData, templateId: string, modelVersionId: string) {
  return nodeHostSignature(draftNodeRules(data, templateId)) !== nodeHostSignature(versionNodeRules(data, modelVersionId))
}

export function readDraftNodeHosts(data: AppData, templateId: string, nodeId: string) {
  return draftNodeRules(data, templateId).find((item) => item.nodeId === nodeId)?.hosts.map(cloneHost) || []
}

/** 只读这个版本上冻结的配置。不把草稿或别的版本混进来。 */
export function readVersionNodeHosts(data: AppData, modelVersionId: string, nodeId: string) {
  return versionNodeRules(data, modelVersionId).find((item) => item.nodeId === nodeId)?.hosts.map(cloneHost) || []
}

export function addDraftNodeHosts(data: AppData, input: { templateId: string; nodeId: string; hosts: CompatibilityHost[]; now?: string; nextId: (prefix: string) => string }): NodeHostWriteResult {
  const failed: { message: string }[] = []
  const added: CompatibilityHost[] = []
  let skipped = 0
  const node = data.productSpecNodes.find((item) => item.id === input.nodeId && item.templateId === input.templateId)
  if (!node) return { added, skipped, failed: [{ message: '当前草稿里没有这个节点，没有写入适用主机。' }] }
  const known = listHostModels(data)
  const accepted: CompatibilityHost[] = []
  input.hosts.forEach((host) => {
    const found = known.find((item) => item.host.productModelId === host.productModelId && item.host.identityKey === host.identityKey && item.host.scope === host.scope && (item.host.planningId || '') === (host.planningId || ''))
    if (!found) {
      failed.push({ message: '找不到这款已建档的主机型号，没有按名称新建。' })
      return
    }
    accepted.push(cloneHost(found.host))
  })
  if (!accepted.length && failed.length) return { added, skipped, failed }
  const now = input.now || new Date().toISOString()
  let rule = rulesOf(data).find((item) => item.templateId === input.templateId && item.nodeId === input.nodeId && item.modelVersionId === '')
  if (!rule && accepted.length) {
    rule = { id: input.nextId('ncompat'), templateId: input.templateId, nodeId: input.nodeId, modelVersionId: '', hosts: [], updatedAt: now }
    rulesOf(data).push(rule)
  }
  accepted.forEach((host) => {
    if (!rule) return
    if (rule.hosts.some((item) => sameHost(item, host))) {
      skipped += 1
      return
    }
    rule.hosts.push(host)
    rule.updatedAt = now
    added.push(host)
  })
  return { added, skipped, failed }
}

export function removeDraftNodeHost(data: AppData, templateId: string, nodeId: string, host: CompatibilityHost) {
  const rule = rulesOf(data).find((item) => item.templateId === templateId && item.nodeId === nodeId && item.modelVersionId === '')
  if (!rule) return false
  const before = rule.hosts.length
  rule.hosts = rule.hosts.filter((item) => !sameHost(item, host))
  if (rule.hosts.length === before) return false
  if (!rule.hosts.length) data.nodeCompatibilityRules = rulesOf(data).filter((item) => item.id !== rule!.id)
  else rule.updatedAt = new Date().toISOString()
  return true
}

/** 发布新版本时复制草稿。不改草稿，也不改更早的版本。 */
export function freezeDraftNodeHosts(data: AppData, templateId: string, modelVersionId: string, now: string, nextId: (prefix: string) => string) {
  draftNodeRules(data, templateId).forEach((rule) => {
    rulesOf(data).push({
      id: nextId('ncompat'),
      templateId,
      nodeId: rule.nodeId,
      modelVersionId,
      hosts: rule.hosts.map(cloneHost),
      updatedAt: now,
    })
  })
}

/** 只清草稿上指向这些节点的配置。已发布版本里的副本留在对应快照上。 */
export function forgetDraftNodeRules(data: AppData, nodeIds: string[]) {
  const ids = new Set(nodeIds)
  const before = rulesOf(data).length
  data.nodeCompatibilityRules = rulesOf(data).filter((item) => item.modelVersionId !== '' || !ids.has(item.nodeId))
  return before - data.nodeCompatibilityRules.length
}

export interface NodeCompatibilityTrace {
  inheritance: 'unconfirmed'
  draftHosts: { identityKey: string; label: string }[]
  versionCopies: { modelVersionId: string; hostCount: number }[]
  planningIds: string[]
  materials: { skuId: string; planningId: string; directLinkCount: number; inherited: false }[]
}

/** 读出节点配置，以及它下面规划上已有物料的直接关系。不把节点配置写进物料。 */
export function traceNodeCompatibility(data: AppData, templateId: string, nodeId: string): NodeCompatibilityTrace {
  const subtree = new Set(collectIds(data.productSpecNodes.filter((item) => item.templateId === templateId), nodeId))
  const plans = (data.planningRecords || []).filter((item) => item.productModelId === templateId && item.origin !== 'temporary' && item.steps.some((step) => subtree.has(step.valueNodeId)))
  const planIds = new Set(plans.map((item) => item.planningId))
  const materials = data.skus.filter((sku) => sku.planningId && planIds.has(sku.planningId) && !isTemporary(data, sku))
  const draft = readDraftNodeHosts(data, templateId, nodeId)
  return {
    inheritance: 'unconfirmed',
    draftHosts: draft.map((host) => ({ identityKey: host.identityKey, label: hostLabel(host) })),
    versionCopies: versionCopies(data, templateId, nodeId),
    planningIds: plans.map((item) => item.planningId),
    materials: materials.map((sku) => ({
      skuId: sku.id,
      planningId: sku.planningId || '',
      directLinkCount: linksOfSku(data, sku.id).length,
      inherited: false,
    })),
  }
}

function versionCopies(data: AppData, templateId: string, nodeId: string) {
  const counts = new Map<string, number>()
  rulesOf(data).forEach((rule) => {
    if (rule.templateId !== templateId || rule.nodeId !== nodeId || !rule.modelVersionId) return
    counts.set(rule.modelVersionId, rule.hosts.length)
  })
  return [...counts.entries()].map(([modelVersionId, hostCount]) => ({ modelVersionId, hostCount }))
}

function isTemporary(data: AppData, sku: Sku) {
  return Boolean(sku.manualAttrs?.length) || (data.planningRecords || []).some((item) => item.planningId === sku.planningId && item.origin === 'temporary')
}

function collectIds(nodes: { id: string; parentId: string | null }[], rootId: string) {
  const ids = [rootId]
  const walk = (parentId: string) => {
    nodes.filter((item) => item.parentId === parentId).forEach((item) => {
      ids.push(item.id)
      walk(item.id)
    })
  }
  walk(rootId)
  return ids
}
