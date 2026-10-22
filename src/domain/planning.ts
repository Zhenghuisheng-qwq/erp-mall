import type { AppData, ParamRole, PlanningRecord, PlanningRoleSource, PlanningStep, ProductSpecNode } from './types'

export interface FilteredPathStep {
  name: string
  value: string
  nodeId: string
}

/**
 * 同级属性相乘，父子只走当前分支。
 * expandVariantPaths 与合法规格计算共用这一层，差别只在接受哪些属性。
 */
export function expandFilteredPaths(
  nodes: ProductSpecNode[],
  parentId: string | null,
  accepts: (attribute: ProductSpecNode) => boolean,
  labelOf: (attribute: ProductSpecNode) => string,
): FilteredPathStep[][] {
  // 只在本次展开内索引；保留源数组顺序，让同 sort 的节点和 accepts 调用顺序不变。
  const children = new Map<string | null, ProductSpecNode[]>()
  nodes.forEach((node) => {
    const siblings = children.get(node.parentId)
    if (siblings) siblings.push(node)
    else children.set(node.parentId, [node])
  })
  function expand(parentId: string | null): FilteredPathStep[][] {
    const attributes = (children.get(parentId) || [])
      .filter((item) => item.nodeType === 'ATTRIBUTE' && accepts(item))
      .sort((a, b) => a.sort - b.sort)
    let combos: FilteredPathStep[][] = [[]]
    let grew = false
    attributes.forEach((attribute) => {
      const options = filteredOptions(attribute)
      if (!options.length) return
      grew = true
      combos = combos.flatMap((prefix) => options.map((option) => [...prefix, ...option]))
    })
    return grew ? combos : [[]]
  }
  function filteredOptions(attribute: ProductSpecNode) {
    const name = labelOf(attribute)
    const values = (children.get(attribute.id) || []).filter((item) => item.nodeType === 'VALUE').sort((a, b) => a.sort - b.sort)
    if (!values.length) return expand(attribute.id).filter((path) => path.length)
    return values.flatMap((value) => {
      const step = { name, value: value.valueId, nodeId: value.id }
      return expand(value.id).map((path) => [step, ...path])
    })
  }
  return expand(parentId)
}

/** 节点自己的角色优先。没有角色时才读取属性方案，不改方案数据。 */
export function planningAttributeRole(data: AppData, productModelId: string, attribute: ProductSpecNode): { role: ParamRole; source: PlanningRoleSource } {
  if (attribute.role === 'COMMON') return { role: 'common', source: 'node' }
  if (attribute.role === 'VARIANT') return { role: 'variant', source: 'node' }
  const bound = data.templateParams.find((item) => item.templateId === productModelId && item.paramId === attribute.attributeId)
  return attributeRole(attribute, bound?.role)
}

function attributeRole(attribute: ProductSpecNode, schemeRole?: ParamRole): { role: ParamRole; source: PlanningRoleSource } {
  if (attribute.role === 'COMMON') return { role: 'common', source: 'node' }
  if (attribute.role === 'VARIANT') return { role: 'variant', source: 'node' }
  return { role: schemeRole === 'common' ? 'common' : 'variant', source: 'scheme' }
}

/** 仍要靠属性方案才能知道角色的属性节点。只报告，不拦截计算。 */
export function planningRoleGaps(data: AppData, productModelId: string, nodes: ProductSpecNode[]) {
  return nodes
    .filter((item) => item.nodeType === 'ATTRIBUTE' && (!item.templateId || item.templateId === productModelId))
    .flatMap((item) => {
      const role = planningAttributeRole(data, productModelId, item)
      if (role.source !== 'scheme') return []
      return [{ attributeNodeId: item.id, attributeId: item.attributeId, role: role.role }]
    })
}

export interface LegalCombination {
  steps: PlanningStep[]
  identityKey: string
  label: string
}

function parentValueNodeId(byId: Map<string, ProductSpecNode>, valueNodeId: string) {
  let cursor = byId.get(valueNodeId)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    const parent = cursor.parentId ? byId.get(cursor.parentId) : undefined
    if (!parent) return null
    if (parent.nodeType === 'VALUE') return parent.id
    cursor = parent
  }
  return null
}

function treeOf(productModelId: string, nodes: ProductSpecNode[]) {
  if (nodes.some((item) => item.templateId === productModelId)) return nodes.filter((item) => item.templateId === productModelId)
  return nodes
}

/** 按真实父子和每个属性节点自己的角色展开。同级相乘，条件分支不相乘到别的父级。 */
export function legalPlanningCombinations(data: AppData, productModelId: string, nodes: ProductSpecNode[]): LegalCombination[] {
  const tree = treeOf(productModelId, nodes)
  const byId = new Map(tree.map((item) => [item.id, item]))
  const names = new Map<string, string>()
  data.params.forEach((param) => {
    if (!names.has(param.id)) names.set(param.id, param.name)
  })
  const schemeRoles = new Map<string, ParamRole>()
  data.templateParams.forEach((binding) => {
    if (binding.templateId === productModelId && !schemeRoles.has(binding.paramId)) schemeRoles.set(binding.paramId, binding.role)
  })
  const labelOf = (attribute: ProductSpecNode) => names.get(attribute.attributeId) || '规格'
  const raw = expandFilteredPaths(tree, null, () => true, labelOf)
  // 一个取值可能出现在很多组合里，只解析一次角色和祖先；输出 step 仍各自复制。
  const stepByValue = new Map<string, { step: PlanningStep; hasAttribute: boolean }>()
  const seen = new Set<string>()
  const rows: LegalCombination[] = []
  raw.filter((path) => path.length).forEach((path) => {
    const steps = path.map((item) => {
      let cached = stepByValue.get(item.nodeId)
      if (!cached) {
        const valueNode = byId.get(item.nodeId)
        const parent = valueNode?.parentId ? byId.get(valueNode.parentId) : undefined
        const attribute = parent?.nodeType === 'ATTRIBUTE' ? parent : undefined
        const role = attribute ? attributeRole(attribute, schemeRoles.get(attribute.attributeId)) : { role: 'variant' as const, source: 'scheme' as const }
        const step: PlanningStep = {
          valueNodeId: item.nodeId,
          attributeNodeId: attribute?.id || '',
          attributeId: attribute?.attributeId || valueNode?.attributeId || '',
          attributeName: attribute ? labelOf(attribute) : '',
          valueId: valueNode?.valueId || '',
          parentValueNodeId: parentValueNodeId(byId, item.nodeId),
          role: role.role,
          roleSource: role.source,
        }
        cached = { step, hasAttribute: Boolean(attribute) }
        stepByValue.set(item.nodeId, cached)
      }
      return {
        ...cached.step,
        attributeName: cached.hasAttribute ? cached.step.attributeName : item.name,
        valueId: cached.step.valueId || item.value,
      }
    })
    const identityKey = planningIdentityKey(steps)
    if (seen.has(identityKey)) return
    seen.add(identityKey)
    rows.push({
      steps,
      identityKey,
      label: steps.map((step) => `${step.attributeName} ${step.valueId}`.trim()).filter(Boolean).join(' · '),
    })
  })
  return rows
}

/** 身份看节点、词典和条件父级。顺序、展示名、角色来源都不参与。 */
export function planningIdentityKey(steps: PlanningStep[]) {
  return steps
    .map((step) => [step.valueNodeId, step.attributeNodeId, step.attributeId, step.valueId, step.parentValueNodeId || '', step.role].join('\u001f'))
    .sort()
    .join('\u001e')
}

function maxPlanningNumber(records: PlanningRecord[]) {
  let max = 0
  records.forEach((item) => {
    const matched = /^PLN-(\d+)$/.exec(item.planningId)
    if (!matched) return
    max = Math.max(max, Number(matched[1]))
  })
  return max
}

function indexPlanningPool(pool: PlanningRecord[]) {
  const index = new Map<string, PlanningRecord[]>()
  pool.forEach((record) => {
    const matches = index.get(record.identityKey)
    if (matches) matches.push(record)
    else index.set(record.identityKey, [record])
  })
  return index
}

function unusedPlanningMatch(index: Map<string, PlanningRecord[]>, identityKey: string, used: Set<string>) {
  // 同身份保留原记录顺序；used 按 PLN 判断，不能用 Map 的最后一条覆盖前面的记录。
  return index.get(identityKey)?.find((item) => !used.has(item.planningId))
}

/** 对已去重的合法组合只读统计。沿用包括停用档的恢复，不分配编号或复制规划档。 */
export function summarizePlanningCombinations(records: PlanningRecord[], productModelId: string, combinations: LegalCombination[]) {
  const pool = records.filter((item) => item.productModelId === productModelId && item.origin !== 'temporary')
  const index = indexPlanningPool(pool)
  const used = new Set<string>()
  let reused = 0
  combinations.forEach((combo) => {
    const found = unusedPlanningMatch(index, combo.identityKey, used)
    if (found) {
      used.add(found.planningId)
      reused += 1
    }
  })
  return { created: combinations.length - reused, reused }
}

export interface PlanningReconcileResult {
  records: PlanningRecord[]
  created: number
  reused: number
  retired: number
}

/**
 * 用一份已发布快照对齐规划档。
 * 不修改快照。对不上的旧编号改为停用并保留，不把编号发给另一条组合。
 */
export function reconcilePlanningRecords(input: {
  records: PlanningRecord[]
  data: AppData
  productModelId: string
  modelVersionId: string
  nodes: ProductSpecNode[]
  now: string
}): PlanningReconcileResult {
  const combinations = legalPlanningCombinations(input.data, input.productModelId, input.nodes)
  const records = input.records.map((item) => ({
    ...item,
    modelVersionIds: [...item.modelVersionIds],
    steps: item.steps.map((step) => ({ ...step })),
  }))
  const pool = records.filter((item) => item.productModelId === input.productModelId && item.origin !== 'temporary')
  const index = indexPlanningPool(pool)
  const used = new Set<string>()
  let nextNumber: number | undefined
  let created = 0
  let reused = 0
  let retired = 0
  combinations.forEach((combo) => {
    const found = unusedPlanningMatch(index, combo.identityKey, used)
    if (found) {
      used.add(found.planningId)
      found.steps = combo.steps.map((step) => ({ ...step }))
      found.identityKey = combo.identityKey
      found.modelVersionId = input.modelVersionId
      if (!found.modelVersionIds.includes(input.modelVersionId)) found.modelVersionIds.push(input.modelVersionId)
      found.status = 'active'
      delete found.retiredTime
      reused += 1
      return
    }
    // 合法组合已经按 identityKey 去重，新增档不会再被后面的组合匹配。
    nextNumber ??= maxPlanningNumber(records)
    nextNumber += 1
    const planningId = `PLN-${String(nextNumber).padStart(6, '0')}`
    const record: PlanningRecord = {
      planningId,
      productModelId: input.productModelId,
      originModelVersionId: input.modelVersionId,
      modelVersionId: input.modelVersionId,
      modelVersionIds: [input.modelVersionId],
      steps: combo.steps.map((step) => ({ ...step })),
      identityKey: combo.identityKey,
      status: 'active',
      createdTime: input.now,
    }
    records.push(record)
    pool.push(record)
    used.add(planningId)
    created += 1
  })
  pool.forEach((item) => {
    if (item.status === 'active' && !used.has(item.planningId)) {
      item.status = 'retired'
      item.retiredTime = input.now
      retired += 1
    }
  })
  return { records, created, reused, retired }
}

/** 用规划编号和模型版本回到那一版快照里的取值。快照本身不被改写。 */
export function tracePlanning(data: AppData, planningId: string, modelVersionId: string) {
  const record = data.planningRecords.find((item) => item.planningId === planningId)
  if (!record) return null
  const version = data.specModelVersions.find((item) => item.id === modelVersionId)
  const linked = record.modelVersionIds.includes(modelVersionId)
  if (!version) return { record, version: undefined, linked, steps: [] as { step: PlanningStep; valueId: string; parentValueNodeId: string | null }[] }
  const byId = new Map(version.nodesSnapshot.map((item) => [item.id, item]))
  const steps = record.steps.map((step) => {
    const node = byId.get(step.valueNodeId)
    return {
      step,
      valueId: node?.nodeType === 'VALUE' ? node.valueId : '',
      parentValueNodeId: node ? parentValueNodeId(byId, node.id) : null,
    }
  })
  return { record, version, linked, steps }
}
