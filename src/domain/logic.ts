import { expandFilteredPaths } from './planning'
import type {
  AppData,
  ConstraintResult,
  FieldIssue,
  MatrixModel,
  ParamDef,
  ParamRole,
  ProductFamily,
  ProductPlan,
  ProductSpecNode,
  Sku,
  TemplateParam,
  TreeNode,
} from './types'

export interface BoundParam extends TemplateParam {
  param: ParamDef
}

export function paramById(data: AppData, id: string) {
  return data.params.find((item) => item.id === id)
}

export function paramByName(data: AppData, name: string) {
  return data.params.find((item) => item.name === name)
}

export function templateById(data: AppData, id: string) {
  return data.templates.find((item) => item.id === id)
}

export function categoryById(data: AppData, id: string) {
  return data.categories.find((item) => item.id === id)
}

export function childrenOf<T extends { parentId: string | null; sort?: number }>(items: T[], parentId: string | null) {
  return items
    .filter((item) => item.parentId === parentId)
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
}

export function descendantIds(items: { id: string; parentId: string | null }[], id: string): string[] {
  const kids = items.filter((item) => item.parentId === id)
  return kids.flatMap((kid) => [kid.id, ...descendantIds(items, kid.id)])
}

export function categoryPath(data: AppData, id: string): string {
  const names: string[] = []
  let current = categoryById(data, id)
  const guard = new Set<string>()
  while (current && !guard.has(current.id)) {
    guard.add(current.id)
    names.unshift(current.name)
    current = current.parentId ? categoryById(data, current.parentId) : undefined
  }
  return names.join(' / ')
}

export function boundParams(data: AppData, templateId: string, role?: ParamRole): BoundParam[] {
  const order = templateById(data, templateId)?.structureOrder ?? []
  return data.templateParams
    .filter((item) => item.templateId === templateId && (!role || item.role === role))
    .map((item) => {
      const param = paramById(data, item.paramId)
      return param ? { ...item, param } : null
    })
    .filter((item): item is BoundParam => Boolean(item))
    .sort((a, b) => orderIndex(order, a.paramId) - orderIndex(order, b.paramId))
}

function orderIndex(order: string[], id: string) {
  const index = order.indexOf(id)
  return index < 0 ? 999 : index
}

export function structureParams(data: AppData, templateId: string): ParamDef[] {
  const order = templateById(data, templateId)?.structureOrder ?? []
  return order
    .map((id) => paramById(data, id))
    .filter((item): item is ParamDef => Boolean(item && item.participateInStructure))
}

export function projectAttrs(family: ProductFamily, sku: Sku): Record<string, string> {
  const attrs: Record<string, string> = {}
  Object.entries(family.commonAttrs).forEach(([key, value]) => {
    if (value) attrs[key] = value
  })
  Object.entries(sku.variantAttrs).forEach(([key, value]) => {
    if (value) attrs[key] = value
  })
  return attrs
}

export function skuTitle(sku: Sku, variants: BoundParam[]) {
  const parts = variants.map((item) => sku.variantAttrs[item.param.name]).filter(Boolean)
  return parts.join(' / ') || '未填规格'
}

export function selectedById(data: AppData, attrs: Record<string, string>) {
  const selected: Record<string, string> = {}
  data.params.forEach((param) => {
    const value = attrs[param.name]
    if (value) selected[param.id] = value
  })
  return selected
}

export function constraintOf(
  data: AppData,
  templateId: string,
  targetParamId: string,
  selected: Record<string, string>,
): ConstraintResult {
  const dict = paramById(data, targetParamId)?.values ?? []
  const related = data.rules.filter(
    (rule) => rule.enabled && !rule.legacy && rule.templateId === templateId && rule.targetParamId === targetParamId,
  )
  if (related.length === 0) {
    return { status: 'none', values: dict, message: '没有配置限制，可从词典中选择。' }
  }
  const ready = related.filter((rule) => rule.sourceParamIds.every((id) => selected[id]))
  if (ready.length === 0) {
    return { status: 'none', values: dict, message: '填完条件后会检查是否有限制。' }
  }
  const hit = ready.find((rule) => rule.sourceParamIds.every((id) => selected[id] === rule.conditions[id]))
  if (!hit) {
    return { status: 'uncovered', values: dict, message: '当前组合尚未配置限制，允许选择词典值。' }
  }
  if (hit.options.length === 0) {
    return { status: 'empty', values: [], message: '当前条件下没有合法选项。' }
  }
  return { status: 'hit', values: hit.options, message: `只能选择：${hit.options.join('、')}` }
}

export function inspectFamily(data: AppData, family: ProductFamily, skus: Sku[], variantNames?: string[]): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!family.name.trim()) {
    issues.push({ level: 'error', kind: 'required', message: '商品名称未填写', paramName: '商品名称' })
  }
  if (!family.categoryId) {
    issues.push({ level: 'error', kind: 'required', message: '商品分类未选择', paramName: '商品分类' })
  }
  const commons = variantNames ? [] : boundParams(data, family.templateId, 'common')
  const variants = variantNames ? variantNames.map((name) => boundVariant(data, family.templateId, name)) : boundParams(data, family.templateId, 'variant')
  commons.forEach((item) => {
    const value = family.commonAttrs[item.param.name] || ''
    if (item.required && !value) {
      issues.push({
        level: 'error',
        kind: 'required',
        message: `${item.param.name}未填写`,
        paramId: item.paramId,
        paramName: item.param.name,
        value: '',
      })
    }
    pushConstraintIssue(issues, data, family.templateId, item, value, selectedById(data, family.commonAttrs))
  })
  if (skus.length === 0) {
    issues.push({ level: 'error', kind: 'required', message: '至少添加一条规格' })
  }
  const seen = new Map<string, number>()
  skus.forEach((sku, index) => {
    const attrs = { ...family.commonAttrs, ...sku.variantAttrs }
    const selected = selectedById(data, attrs)
    variants.forEach((item) => {
      const value = sku.variantAttrs[item.param.name] || ''
      if (item.required && !value) {
        issues.push({
          level: 'error',
          kind: 'required',
          message: `第 ${index + 1} 条规格：${item.param.name}未填写`,
          skuId: sku.id,
          paramId: item.paramId,
          paramName: item.param.name,
          value: '',
        })
      }
      pushConstraintIssue(issues, data, family.templateId, item, value, selected, sku.id, index)
    })
    if (family.line === 'v3') return
    const key = variants.map((item) => sku.variantAttrs[item.param.name] || '').join('|')
    const previous = seen.get(key)
    if (previous) {
      issues.push({
        level: 'error',
        kind: 'duplicate',
        message: `第 ${index + 1} 条规格与第 ${previous} 条规格重复`,
        skuId: sku.id,
      })
    } else {
      seen.set(key, index + 1)
    }
  })
  return issues
}

function boundVariant(data: AppData, templateId: string, name: string): BoundParam {
  const found = boundParams(data, templateId, 'variant').find((item) => item.param.name === name)
  if (found) return { ...found, required: false }
  const param = data.params.find((item) => item.name === name)
  return {
    templateId,
    paramId: param?.id || name,
    role: 'variant',
    required: false,
    param: param || { id: name, name, values: [], valueGroups: [], participateInStructure: false },
  }
}

function pushConstraintIssue(
  issues: FieldIssue[],
  data: AppData,
  templateId: string,
  item: BoundParam,
  value: string,
  selected: Record<string, string>,
  skuId?: string,
  index?: number,
) {
  const result = constraintOf(data, templateId, item.paramId, selected)
  const prefix = index === undefined ? '' : `第 ${index + 1} 条规格：`
  if (value && result.status === 'hit' && !result.values.includes(value)) {
    issues.push({
      level: 'error',
      kind: 'illegal',
      message: `${prefix}${item.param.name}不在允许范围内`,
      skuId,
      paramId: item.paramId,
      paramName: item.param.name,
      value,
      detail: result.message,
    })
  }
  if (value && result.status === 'empty') {
    issues.push({
      level: 'error',
      kind: 'illegal',
      message: `${prefix}${item.param.name}没有合法选项`,
      skuId,
      paramId: item.paramId,
      paramName: item.param.name,
      value,
      detail: result.message,
    })
  }
  if (result.status === 'uncovered') {
    issues.push({
      level: 'warn',
      kind: 'uncovered',
      message: `${prefix}${item.param.name}当前组合尚未配置限制，允许选择词典值`,
      skuId,
      paramId: item.paramId,
      paramName: item.param.name,
      value,
      detail: result.message,
    })
  }
}

export function familySkus(data: AppData, familyId: string) {
  return data.skus.filter((sku) => sku.familyId === familyId)
}

export function mappingForCategory(data: AppData, categoryId: string) {
  return data.mappings.find((item) => item.categoryId === categoryId)
}

export function mappingsForTemplate(data: AppData, templateId: string) {
  return data.mappings.filter((item) => item.templateId === templateId)
}

export interface SpecStep {
  attributeId: string
  attributeName: string
  value: string
}

export interface SpecCombination {
  templateId: string
  steps: SpecStep[]
}

function childrenByParent(nodes: ProductSpecNode[], parentId: string | null) {
  return nodes.filter((item) => item.parentId === parentId).sort((a, b) => a.sort - b.sort)
}

/** 把一棵规格树走成从根到叶子的取值路径。调用方传入编辑树或发布快照。 */
export function specCombinationsFrom(data: AppData, templateId: string, nodes: ProductSpecNode[]): SpecCombination[] {
  const paths: SpecStep[][] = []
  const enter = (attribute: ProductSpecNode, steps: SpecStep[]) => {
    const name = paramById(data, attribute.attributeId)?.name || attribute.attributeId
    const values = childrenByParent(nodes, attribute.id).filter((item) => item.nodeType === 'VALUE')
    const nested = childrenByParent(nodes, attribute.id).filter((item) => item.nodeType === 'ATTRIBUTE')
    if (values.length === 0) {
      nested.forEach((child) => enter(child, steps))
      return
    }
    values.forEach((value) => {
      const next = [...steps, { attributeId: attribute.attributeId, attributeName: name, value: value.valueId }]
      const under = childrenByParent(nodes, value.id).filter((item) => item.nodeType === 'ATTRIBUTE')
      if (under.length === 0) paths.push(next)
      else under.forEach((child) => enter(child, next))
    })
    nested.forEach((child) => enter(child, steps))
  }
  childrenByParent(nodes, null)
    .filter((item) => item.nodeType === 'ATTRIBUTE')
    .forEach((attribute) => enter(attribute, []))
  return paths.map((steps) => ({ templateId, steps }))
}

/** 把规格树走成从根到叶子的取值路径。属性下面可以继续挂属性，没有取值时跳过这一层。 */
export function specCombinations(data: AppData, templateId: string): SpecCombination[] {
  return specCombinationsFrom(
    data,
    templateId,
    data.productSpecNodes.filter((item) => item.templateId === templateId),
  )
}

export function sameSpecSnapshot(left: ProductSpecNode[], right: ProductSpecNode[]) {
  const namingKey = (node: ProductSpecNode) => (node.namingRule || []).map((part) => [part.kind, part.key || '', part.text || ''].join(':')).join(',')
  const keyOf = (node: ProductSpecNode) => [node.id, node.parentId || '', node.nodeType, node.attributeId, node.valueId, node.role || '', node.sort, namingKey(node)].join('|')
  const a = left.map(keyOf).sort()
  const b = right.map(keyOf).sort()
  return a.length === b.length && a.every((item, index) => item === b[index])
}

function specNodeLabel(data: AppData, node: ProductSpecNode) {
  if (node.nodeType === 'VALUE') return node.valueId || '未命名取值'
  return paramById(data, node.attributeId)?.name || '未命名属性'
}

/** 属性值下面再挂属性值。发布、拖拽和保存都用这一句。 */
export const SPEC_VALUE_TO_VALUE = '属性值不能直接关联属性值，请调整商品模型结构'

/** 发布前检查编辑树。属性可以接属性或属性值，属性值只能再接属性。 */
export function specPublishProblems(data: AppData, nodes: ProductSpecNode[]) {
  const problems: string[] = []
  if (!nodes.some((item) => item.nodeType === 'ATTRIBUTE')) problems.push('还没有属性节点，不能发布。')
  const ids = new Set(nodes.map((item) => item.id))
  const reachable = new Set<string>()
  const walk = (parentId: string | null) => {
    childrenByParent(nodes, parentId).forEach((node) => {
      reachable.add(node.id)
      walk(node.id)
    })
  }
  walk(null)
  nodes.forEach((node) => {
    const label = specNodeLabel(data, node)
    if (node.parentId && !ids.has(node.parentId)) {
      problems.push(`「${label}」找不到父节点，属于孤立节点。`)
      return
    }
    if (!reachable.has(node.id)) problems.push(`「${label}」没有连到模型根上，属于孤立节点。`)
    const parent = node.parentId ? nodes.find((item) => item.id === node.parentId) : undefined
    if (!parent && node.nodeType !== 'ATTRIBUTE') problems.push(`「${label}」不能作为根节点，根上只能放属性。`)
    if (parent?.nodeType === 'VALUE' && node.nodeType !== 'ATTRIBUTE' && !problems.includes(SPEC_VALUE_TO_VALUE)) problems.push(SPEC_VALUE_TO_VALUE)
  })
  nodes
    .filter((item) => item.nodeType === 'ATTRIBUTE')
    .forEach((attribute) => {
      const children = nodes.filter((item) => item.parentId === attribute.id)
      const values = children.filter((item) => item.nodeType === 'VALUE')
      const nested = children.filter((item) => item.nodeType === 'ATTRIBUTE')
      const locate = (attribute: ProductSpecNode) => {
        const names: string[] = []
        const byId = new Map(nodes.map((item) => [item.id, item]))
        let id: string | null = attribute.id
        const guard = new Set<string>()
        while (id && !guard.has(id)) {
          guard.add(id)
          const node = byId.get(id)
          if (!node) break
          if (node.nodeType === 'ATTRIBUTE') names.unshift(specNodeLabel(data, node))
          id = node.parentId
        }
        return names.filter(Boolean).join(' / ') || specNodeLabel(data, attribute)
      }
      if (values.length > 0 && nested.length > 0) {
        problems.push(`属性「${locate(attribute)}」同时挂了属性值和子属性。请把子属性放到属性值下面，或只保留其中一种，否则规格路径不明确，不能发布。`)
      }
      if (values.length === 0 && nested.length === 0) problems.push(`属性「${locate(attribute)}」下面没有取值。`)
    })
  if (problems.length === 0 && specCombinationsFrom(data, nodes[0]?.templateId || '', nodes).length === 0) {
    problems.push('当前结构生成不出完整规格路径，不能发布。')
  }
  return problems
}

/** 一条规划只保留从根到当前取值的属性值，不展开同级组合。 */
export function ancestorValueIds(nodes: ProductSpecNode[], id: string) {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const chain: string[] = []
  let cursor = byId.get(id)
  const guard = new Set<string>()
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id)
    if (cursor.nodeType === 'VALUE') chain.unshift(cursor.id)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  return chain
}

export function togglePlanValue(nodes: ProductSpecNode[], selected: string[], id: string) {
  const node = nodes.find((item) => item.id === id)
  if (!node || node.nodeType !== 'VALUE') return selected
  const path = ancestorValueIds(nodes, id)
  const picked = new Set(selected)
  const descendants = new Set<string>()
  const walk = (parentId: string) => {
    nodes.filter((item) => item.parentId === parentId).forEach((child) => {
      descendants.add(child.id)
      walk(child.id)
    })
  }
  walk(id)
  const hasDeeper = [...picked].some((item) => item !== id && descendants.has(item))
  if (picked.has(id) && !hasDeeper) return path.filter((item) => item !== id)
  return path
}

export function orderedPlanNodes(nodes: ProductSpecNode[], selected: string[]) {
  const picked = new Set(selected)
  const ordered: ProductSpecNode[] = []
  const walk = (parentId: string | null) => {
    nodes
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .forEach((node) => {
        if (node.nodeType === 'VALUE' && picked.has(node.id)) ordered.push(node)
        walk(node.id)
      })
  }
  walk(null)
  return ordered
}

export function planTitle(nodes: ProductSpecNode[], selected: string[]) {
  return orderedPlanNodes(nodes, selected).map((item) => item.valueId).filter(Boolean).join(' ')
}

export function documentIndent(prefix: string) {
  const spaces = prefix.replace(/\t/g, '    ')
  if (!spaces) return 0
  return Math.max(1, Math.round(spaces.length / 4))
}

/** 文档模式：第一行是模型名，之后按缩进挂属性或属性值。空行、空名称和跳级缩进会被收掉。 */
export function parseModelDocument(text: string) {
  const rows: { depth: number; name: string }[] = []
  let lastDepth = 0
  text.split(/\r?\n/).forEach((line) => {
    const prefix = line.match(/^[\t ]*/)?.[0] || ''
    const name = line.slice(prefix.length).trim()
    if (!name) return
    let depth = documentIndent(prefix)
    if (!rows.length) depth = 0
    else if (depth > lastDepth + 1) depth = lastDepth + 1
    rows.push({ depth, name })
    lastDepth = depth
  })
  if (!rows.length) return { rootName: '', lines: [] as { depth: number; name: string }[] }
  const rooted = rows[0].depth === 0
  return {
    rootName: rooted ? rows[0].name : '',
    lines: (rooted ? rows.slice(1) : rows).map((row) => ({ depth: rooted ? Math.max(1, row.depth) : row.depth + 1, name: row.name })),
  }
}

/** 把一条规划路径拆成公共属性和一条 SKU 的规格，不做组合展开。 */
export function planProductParts(data: AppData, plan: ProductPlan) {
  const version = (plan.modelVersionId ? modelVersionById(data, plan.modelVersionId) : undefined) || latestPublishedVersion(data, plan.productModelId)
  if (!version || version.status !== 'published') return null
  const nodes = version.nodesSnapshot
  const chosen = orderedPlanNodes(nodes, plan.selectedNodes)
  if (!chosen.length) return null
  const commonAttrs: Record<string, string> = {}
  const variantAttrs: Record<string, string> = {}
  chosen.forEach((valueNode) => {
    const parent = nodes.find((item) => item.id === valueNode.parentId && item.nodeType === 'ATTRIBUTE')
    const attributeId = parent?.attributeId || valueNode.attributeId
    const name = paramById(data, attributeId)?.name
    if (!name || !valueNode.valueId) return
    if (specAttributeRole(data, plan.productModelId, attributeId, nodes) === 'common') commonAttrs[name] = valueNode.valueId
    else variantAttrs[name] = valueNode.valueId
  })
  return { commonAttrs, variantAttrs, modelVersionId: version.id, name: chosen.map((item) => item.valueId).filter(Boolean).join(' ') }
}

export interface PlanSkuLine {
  name: string
  variantAttrs: Record<string, string>
  sourceNodeIds: string[]
}

/** 从规划落点往下按模型树展开规格。同级规格相乘，父子只走真实分支。 */
export function planSkuLines(data: AppData, plan: ProductPlan) {
  const version = (plan.modelVersionId ? modelVersionById(data, plan.modelVersionId) : undefined) || latestPublishedVersion(data, plan.productModelId)
  if (!version || version.status !== 'published') return null
  const nodes = version.nodesSnapshot
  const chosen = orderedPlanNodes(nodes, plan.selectedNodes)
  if (!chosen.length) return null
  const anchor = chosen[chosen.length - 1]
  const onPath = new Set(ancestorValueIds(nodes, anchor.id))
  const commonValues: string[] = []
  const fixed: { name: string; value: string; nodeId: string }[] = []
  const commonAttrs: Record<string, string> = {}
  chosen.forEach((valueNode) => {
    if (!onPath.has(valueNode.id)) return
    const parent = nodes.find((item) => item.id === valueNode.parentId && item.nodeType === 'ATTRIBUTE')
    const attributeId = parent?.attributeId || valueNode.attributeId
    const name = paramById(data, attributeId)?.name
    if (!name || !valueNode.valueId) return
    if (specAttributeRole(data, plan.productModelId, attributeId, nodes) === 'common') {
      commonAttrs[name] = valueNode.valueId
      commonValues.push(valueNode.valueId)
      return
    }
    fixed.push({ name, value: valueNode.valueId, nodeId: valueNode.id })
  })
  const tails = expandVariantPaths(data, plan.productModelId, nodes, anchor.id)
  const skus = (tails.length ? tails : [[]]).map((tail) => {
    const steps = [...fixed, ...tail]
    const variantAttrs: Record<string, string> = {}
    steps.forEach((step) => {
      variantAttrs[step.name] = step.value
    })
    return {
      name: steps.map((step) => step.value).filter(Boolean).join(' ') || commonValues.join(' '),
      variantAttrs,
      sourceNodeIds: steps.map((step) => step.nodeId),
    }
  })
  return {
    productName: [...commonValues, ...fixed.map((step) => step.value)].filter(Boolean).join(' ') || plan.name,
    commonAttrs,
    modelVersionId: version.id,
    skus,
  }
}

function expandVariantPaths(data: AppData, templateId: string, nodes: ProductSpecNode[], parentId: string | null) {
  return expandFilteredPaths(
    nodes,
    parentId,
    (attribute) => specAttributeRole(data, templateId, attribute.attributeId, nodes) === 'variant',
    (attribute) => paramById(data, attribute.attributeId)?.name || attribute.attributeId,
  )
}

export function specCanvasOf(data: AppData, templateId: string) {
  return data.specCanvases?.find((item) => item.templateId === templateId)
}

export function modelVersionsOf(data: AppData, templateId: string) {
  return (data.specModelVersions || [])
    .filter((item) => item.templateId === templateId)
    .slice()
    .sort((a, b) => a.version - b.version)
}

export function modelVersionById(data: AppData, id: string) {
  if (!id) return undefined
  return data.specModelVersions?.find((item) => item.id === id)
}

/** 新建商品只读取最近一次已发布快照。画布下线后不再提供给新商品。编辑中的草稿树不参与。 */
export function latestPublishedVersion(data: AppData, templateId: string) {
  const canvas = specCanvasOf(data, templateId)
  if (canvas?.status === 'offline') return undefined
  const versions = modelVersionsOf(data, templateId).filter((item) => item.status === 'published')
  return versions[versions.length - 1]
}

/** 商品创建只消费已发布快照，不读正在编辑的 productSpecNodes。 */
export function publishedSpecNodes(data: AppData, templateId: string) {
  return latestPublishedVersion(data, templateId)?.nodesSnapshot.map((item) => ({ ...item })) || []
}

export function specAttributeRole(data: AppData, templateId: string, attributeId: string, nodes?: ProductSpecNode[]): ParamRole {
  const source = nodes || publishedSpecNodes(data, templateId)
  const node = source.find((item) => item.nodeType === 'ATTRIBUTE' && item.attributeId === attributeId && item.role)
  if (node?.role === 'COMMON') return 'common'
  if (node?.role === 'VARIANT') return 'variant'
  return data.templateParams.find((item) => item.templateId === templateId && item.paramId === attributeId)?.role || 'variant'
}

function snapshotGate(nodes: ProductSpecNode[]): 'none' | 'invalid' | 'ready' {
  const attributes = nodes.filter((item) => item.nodeType === 'ATTRIBUTE')
  if (attributes.length === 0) return 'none'
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const linkedValues = nodes.some((node) => node.nodeType === 'VALUE' && Boolean(node.parentId && byId.get(node.parentId)?.nodeType === 'VALUE'))
  if (linkedValues) return 'invalid'
  const broken = attributes.some((attribute) => !nodes.some((item) => item.parentId === attribute.id))
  return broken ? 'invalid' : 'ready'
}

/** 新增商品怎么用模型：没有已发布快照就看是未发布还是普通录入。 */
export function productModelGate(data: AppData, templateId: string): 'none' | 'unpublished' | 'invalid' | 'ready' {
  if (!templateId) return 'none'
  const canvas = specCanvasOf(data, templateId)
  if (canvas?.status === 'offline') return 'unpublished'
  const version = latestPublishedVersion(data, templateId)
  if (!version) {
    const working = data.productSpecNodes.some((item) => item.templateId === templateId && item.nodeType === 'ATTRIBUTE')
    return working ? 'unpublished' : 'none'
  }
  return snapshotGate(version.nodesSnapshot)
}

export function specTreeState(data: AppData, templateId: string): 'empty' | 'incomplete' | 'ready' | 'draft' | 'offline' {
  const canvas = specCanvasOf(data, templateId)
  if (canvas?.status === 'offline') return 'offline'
  const version = latestPublishedVersion(data, templateId)
  if (!version) return canvas?.status === 'draft' || data.productSpecNodes.some((item) => item.templateId === templateId) ? 'draft' : 'empty'
  return snapshotGate(version.nodesSnapshot) === 'ready' ? 'ready' : 'incomplete'
}

export interface ModelSpecColumn {
  paramId: string
  name: string
  required: boolean
  values: string[]
  role: ParamRole
}

/** 规格列只来自模型快照里的属性角色，不按属性方案做笛卡尔组合。必填仍读取属性方案。 */
export function modelSpecColumns(data: AppData, templateId: string, nodes: ProductSpecNode[], role: ParamRole): ModelSpecColumn[] {
  const seen = new Set<string>()
  const rows: ModelSpecColumn[] = []
  const visit = (parentId: string | null) => {
    childrenByParent(nodes, parentId).forEach((node) => {
      if (node.nodeType === 'ATTRIBUTE' && !seen.has(node.attributeId)) {
        const nodeRole = specAttributeRole(data, templateId, node.attributeId, nodes)
        const values = nodes
          .filter((item) => item.nodeType === 'VALUE' && item.attributeId === node.attributeId && item.valueId)
          .sort((a, b) => a.sort - b.sort)
          .map((item) => item.valueId)
          .filter((value, index, list) => list.indexOf(value) === index)
        if (nodeRole === role && values.length) {
          seen.add(node.attributeId)
          const name = paramById(data, node.attributeId)?.name || node.attributeId
          const required = data.templateParams.find((item) => item.templateId === templateId && item.paramId === node.attributeId)?.required ?? false
          rows.push({ paramId: node.attributeId, name, required, values, role })
        }
      }
      visit(node.id)
    })
  }
  visit(null)
  return rows
}

/** 从左向右的业务导图。横向间距跟着节点宽度走，纵向按子树收拢，父节点落在直接子节点的中部。 */
export const SPEC_TREE_ORIGIN_X = 220
export const SPEC_TREE_ORIGIN_Y = 16
export const SPEC_TREE_COLUMN = 148
export const SPEC_LINK_GAP = 40
export const SPEC_TREE_GAP = 16
export const SPEC_TREE_ROOT_GAP = 24

type SpecTreeItem = { id: string; parentId: string | null; sort: number; nodeType: ProductSpecNode['nodeType']; label?: string }

function labelWidth(label = '') {
  let width = 0
  for (const char of label) width += char.charCodeAt(0) > 255 ? 16 : 9
  return width
}

export function specNodeSize(nodeType: ProductSpecNode['nodeType'], label = '') {
  const text = labelWidth(label)
  if (nodeType === 'VALUE') return { width: Math.min(220, Math.max(76, text + 32)), height: 34 }
  return { width: Math.min(240, Math.max(128, text + 44)), height: 42 }
}

export function specTreeAdvance(nodeType: ProductSpecNode['nodeType'], label = '') {
  return specNodeSize(nodeType, label).width + SPEC_LINK_GAP
}

function siblingGap(parentId: string | null) {
  return parentId ? SPEC_TREE_GAP : SPEC_TREE_ROOT_GAP
}

export function layoutSpecTree(nodes: SpecTreeItem[]) {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const childrenOf = (parentId: string | null) => nodes.filter((item) => item.parentId === parentId).sort((a, b) => a.sort - b.sort)
  const heightOf = (id: string): number => {
    const node = byId.get(id)
    const self = specNodeSize(node?.nodeType || 'ATTRIBUTE', node?.label).height
    const children = childrenOf(id)
    if (!children.length) return self
    const gap = siblingGap(id)
    const inner = children.reduce((sum, child, index) => sum + heightOf(child.id) + (index ? gap : 0), 0)
    return Math.max(self, inner)
  }
  const placed = new Map<string, { x: number; y: number }>()
  const place = (parentId: string | null, left: number, top: number) => {
    let y = top
    const gap = siblingGap(parentId)
    childrenOf(parentId).forEach((node, index) => {
      if (index) y += gap
      const block = heightOf(node.id)
      const self = specNodeSize(node.nodeType, node.label)
      placed.set(node.id, { x: left, y: Math.round(y + block / 2 - self.height / 2) })
      place(node.id, left + self.width + SPEC_LINK_GAP, y)
      y += block
    })
  }
  place(null, SPEC_TREE_ORIGIN_X, SPEC_TREE_ORIGIN_Y)
  return placed
}

export function arrangeSpecPositions(nodes: ProductSpecNode[], labelOf?: (node: ProductSpecNode) => string) {
  const placed = layoutSpecTree(nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    sort: node.sort,
    nodeType: node.nodeType,
    label: labelOf?.(node) || (node.nodeType === 'VALUE' ? node.valueId : ''),
  })))
  nodes.forEach((node) => {
    const pos = placed.get(node.id)
    if (!pos) return
    node.positionX = pos.x
    node.positionY = pos.y
  })
}

/** 同一属性下的取值和并列属性会组合成一条路径。每一步都是属性名和取值。 */
export function selectedSpecPaths(data: AppData, templateId: string, selectedValueIds: string[], nodes = publishedSpecNodes(data, templateId)): { paths: SpecCombination[]; incomplete: boolean } {
  const selected = new Set(selectedValueIds)
  const childrenOf = (parentId: string | null) => nodes.filter((item) => item.parentId === parentId).sort((a, b) => a.sort - b.sort)
  let incomplete = false

  function expand(parentId: string | null): SpecStep[][] {
    const attributes = childrenOf(parentId).filter((item) => item.nodeType === 'ATTRIBUTE')
    if (!attributes.length) return [[]]
    let combos: SpecStep[][] = [[]]
    for (const attribute of attributes) {
      const options = optionsFor(attribute)
      if (!options.length) return []
      combos = combos.flatMap((prefix) => options.map((option) => [...prefix, ...option]))
    }
    return combos
  }

  function optionsFor(attribute: (typeof nodes)[number]): SpecStep[][] {
    const name = paramById(data, attribute.attributeId)?.name || attribute.attributeId
    const valueNodes = childrenOf(attribute.id).filter((item) => item.nodeType === 'VALUE')
    const nestedAttributes = childrenOf(attribute.id).filter((item) => item.nodeType === 'ATTRIBUTE')
    if (!valueNodes.length) {
      if (!nestedAttributes.length) {
        incomplete = true
        return []
      }
      return expand(attribute.id)
    }
    const chosen = valueNodes.filter((item) => selected.has(item.id))
    if (!chosen.length) {
      incomplete = true
      return []
    }
    const parallel = nestedAttributes.length ? expand(attribute.id) : [[]]
    if (!parallel.length) return []
    const options: SpecStep[][] = []
    chosen.forEach((value) => {
      const step: SpecStep = { attributeId: attribute.attributeId, attributeName: name, value: value.valueId }
      const nested = expand(value.id)
      if (!nested.length) return
      nested.forEach((rest) => {
        parallel.forEach((extra) => options.push([step, ...rest, ...extra]))
      })
    })
    return options
  }

  const paths = expand(null).filter((steps) => steps.length)
  return { paths: paths.map((steps) => ({ templateId, steps })), incomplete }
}


/** 公共属性单选，规格属性多选。键是属性名，值是属性值，不按属性名写死分支。 */
export interface ModelSelection {
  commonSelections: Record<string, string>
  variantSelections: Record<string, string[]>
}

export interface ModelFormRow {
  id: string
  label: string
  multiple: boolean
  options: { id: string; name: string }[]
  selectedId: string
  selectedIds: string[]
}

export interface ModelSkuDraft {
  variant: Record<string, string>
}

export function emptyModelSelection(): ModelSelection {
  return { commonSelections: {}, variantSelections: {} }
}

/** 只按父节点取直接子节点。 */
export function getChildren(nodes: ProductSpecNode[], currentNodeId: string | null) {
  return nodes.filter((item) => item.parentId === currentNodeId).sort((a, b) => a.sort - b.sort)
}

export function nodeDisplayName(data: AppData, node: ProductSpecNode) {
  if (node.nodeType === 'VALUE') return node.valueId || '未命名取值'
  return paramById(data, node.attributeId)?.name || node.attributeId || '未命名属性'
}

function attributeChildrenOf(nodes: ProductSpecNode[], parentId: string | null) {
  return getChildren(nodes, parentId).filter((item) => item.nodeType === 'ATTRIBUTE')
}

/** 当前属性节点自己的角色优先，没有角色时才回退到属性方案。 */
function nodeAttributeRole(data: AppData, templateId: string, node: ProductSpecNode): ParamRole {
  if (node.role === 'COMMON') return 'common'
  if (node.role === 'VARIANT') return 'variant'
  return data.templateParams.find((item) => item.templateId === templateId && item.paramId === node.attributeId)?.role || 'variant'
}

/** 只认已经选中的值。规格属性没选时不能回退成全选，否则会把取值下面的属性提前展开。 */
function selectedValueIds(selection: ModelSelection, role: ParamRole, name: string) {
  if (role === 'common') {
    const value = selection.commonSelections[name]
    return value ? [value] : []
  }
  return selection.variantSelections[name] || []
}

interface VisibleAttributeGroup {
  attributeId: string
  name: string
  role: ParamRole
  options: { id: string; name: string }[]
  chosen: string[]
  /** 单选时选中的是下级属性节点，而不是属性值。不写入商品公共属性。 */
  branchPick: string
}

/**
 * 只沿当前路径展开。
 * 当前属性的下拉选项是它的直接子节点：属性值显示值，直接挂着的属性显示属性名。
 * 选中属性值后才读取该值的直接子节点；没选中的取值不展开后代。
 * 选中下级属性后才进入那条属性。
 * 同名规格挂在不同取值下时仍合并成一行，供后面的 SKU 组合使用。
 */
function visibleAttributeGroups(data: AppData, templateId: string, nodes: ProductSpecNode[], selection: ModelSelection) {
  const groups: VisibleAttributeGroup[] = []
  const byAttribute = new Map<string, VisibleAttributeGroup>()
  const visited = new Set<string>()

  const open = (attribute: ProductSpecNode): boolean => {
    if (visited.has(attribute.id)) return false
    visited.add(attribute.id)
    const children = getChildren(nodes, attribute.id)
    const values = children.filter((item) => item.nodeType === 'VALUE' && item.valueId)
    const nested = children.filter((item) => item.nodeType === 'ATTRIBUTE')
    if (!values.length && !nested.length) return false

    const name = nodeDisplayName(data, attribute)
    let group = byAttribute.get(attribute.attributeId)
    if (!group) {
      group = { attributeId: attribute.attributeId, name, role: nodeAttributeRole(data, templateId, attribute), options: [], chosen: [], branchPick: '' }
      byAttribute.set(attribute.attributeId, group)
      groups.push(group)
    }
    const bucket = group
    children.forEach((child) => {
      if (child.nodeType === 'VALUE' && child.valueId) {
        if (!bucket.options.some((item) => item.id === child.valueId)) bucket.options.push({ id: child.valueId, name: nodeDisplayName(data, child) })
        return
      }
      if (child.nodeType === 'ATTRIBUTE' && bucket.role === 'common' && !bucket.options.some((item) => item.id === child.id)) {
        bucket.options.push({ id: child.id, name: nodeDisplayName(data, child) })
      }
    })
    const picked = new Set(selectedValueIds(selection, bucket.role, bucket.name))
    if (bucket.role === 'common') {
      const stored = selection.commonSelections[name]
      if (stored) picked.add(stored)
    }
    const chosenHere: ProductSpecNode[] = []
    values.forEach((value) => {
      const valueId = value.valueId
      if (!picked.has(valueId)) return
      if (!bucket.chosen.includes(valueId)) bucket.chosen.push(valueId)
      chosenHere.push(value)
    })
    const entered = bucket.role === 'common' ? nested.filter((item) => picked.has(item.id)) : []
    if (entered[0] && !bucket.branchPick) bucket.branchPick = entered[0].id
    if (!chosenHere.length && !entered.length) return bucket.chosen.length === 0 && !bucket.branchPick

    let waiting = false
    for (const value of chosenHere) {
      if (walk(value.id)) waiting = true
    }
    for (const node of entered) {
      if (open(node)) waiting = true
    }
    return waiting
  }

  const walk = (parentId: string | null): boolean => {
    for (const attribute of attributeChildrenOf(nodes, parentId)) {
      if (open(attribute)) return true
    }
    return false
  }

  walk(null)
  return groups
}

export interface CollectedModelSelection {
  complete: boolean
  spuOnly: boolean
  commonAttrs: Record<string, string>
  /** 选中的是下级属性节点。只用于继续展开路径，不写入商品属性。 */
  branchPicks: Record<string, string>
  variantSelections: Record<string, string[]>
  rows: ModelFormRow[]
  columns: ModelSpecColumn[]
}

/** 沿节点树把已选项拆成公共属性和规格属性。没选完的一层不会生成 SKU。 */
export function collectModelSelections(data: AppData, templateId: string, nodes: ProductSpecNode[], selection: ModelSelection): CollectedModelSelection {
  const groups = visibleAttributeGroups(data, templateId, nodes, selection)
  const commonAttrs: Record<string, string> = {}
  const branchPicks: Record<string, string> = {}
  const variantSelections: Record<string, string[]> = {}
  const rows: ModelFormRow[] = []
  const columns: ModelSpecColumn[] = []
  let complete = true
  let hasVariant = false
  groups.forEach((group) => {
    const multiple = group.role === 'variant'
    if (!group.chosen.length && !group.branchPick) complete = false
    if (multiple) {
      hasVariant = true
      variantSelections[group.name] = [...group.chosen]
      if (group.chosen.length) columns.push({ paramId: group.attributeId, name: group.name, required: false, values: [...group.chosen], role: 'variant' })
    } else if (group.chosen[0]) {
      commonAttrs[group.name] = group.chosen[0]
    }
    if (group.branchPick) branchPicks[group.name] = group.branchPick
    rows.push({
      id: group.attributeId,
      label: group.name,
      multiple,
      options: group.options,
      selectedId: multiple ? '' : group.branchPick || group.chosen[0] || '',
      selectedIds: multiple ? [...group.chosen] : [],
    })
  })
  return { complete, spuOnly: complete && !hasVariant, commonAttrs, branchPicks, variantSelections, rows, columns }
}

function selectionFromGroups(data: AppData, templateId: string, nodes: ProductSpecNode[], selection: ModelSelection): ModelSelection {
  const collected = collectModelSelections(data, templateId, nodes, selection)
  return { commonSelections: { ...collected.branchPicks, ...collected.commonAttrs }, variantSelections: collected.variantSelections }
}

function cloneSelection(selection: ModelSelection): ModelSelection {
  return {
    commonSelections: { ...selection.commonSelections },
    variantSelections: Object.fromEntries(Object.entries(selection.variantSelections).map(([key, values]) => [key, [...values]])),
  }
}

export function modelFormRows(data: AppData, templateId: string, nodes: ProductSpecNode[], selection: ModelSelection): ModelFormRow[] {
  return collectModelSelections(data, templateId, nodes, selection).rows
}

export function chooseModelNode(data: AppData, templateId: string, nodes: ProductSpecNode[], selection: ModelSelection, attributeId: string, values: string[]): ModelSelection {
  const attribute = nodes.find((item) => item.nodeType === 'ATTRIBUTE' && item.attributeId === attributeId)
  const next = cloneSelection(selection)
  if (!attribute) return selectionFromGroups(data, templateId, nodes, next)
  const name = nodeDisplayName(data, attribute)
  const clean = values.map((item) => String(item)).filter(Boolean)
  if (nodeAttributeRole(data, templateId, attribute) === 'common') {
    if (clean[0]) next.commonSelections[name] = clean[0]
    else delete next.commonSelections[name]
  } else next.variantSelections[name] = clean
  return selectionFromGroups(data, templateId, nodes, next)
}

export function truncateModelPath(data: AppData, templateId: string, nodes: ProductSpecNode[], selection: ModelSelection, nodeId: string): ModelSelection {
  const next = cloneSelection(selection)
  const node = nodes.find((item) => item.id === nodeId)
  if (node?.nodeType === 'ATTRIBUTE') {
    const name = nodeDisplayName(data, node)
    if (nodeAttributeRole(data, templateId, node) === 'common') delete next.commonSelections[name]
    else next.variantSelections[name] = []
    const parent = node.parentId ? nodes.find((item) => item.id === node.parentId && item.nodeType === 'ATTRIBUTE') : undefined
    if (parent) {
      const parentName = nodeDisplayName(data, parent)
      if (next.commonSelections[parentName] === node.id) delete next.commonSelections[parentName]
    }
  } else if (node?.nodeType === 'VALUE' && node.parentId) {
    const parent = nodes.find((item) => item.id === node.parentId && item.nodeType === 'ATTRIBUTE')
    if (parent) {
      const name = nodeDisplayName(data, parent)
      if (nodeAttributeRole(data, templateId, parent) === 'common') {
        if (next.commonSelections[name] === node.valueId) delete next.commonSelections[name]
      } else next.variantSelections[name] = (next.variantSelections[name] || []).filter((item) => item !== node.valueId)
    }
  }
  return selectionFromGroups(data, templateId, nodes, next)
}

export function modelSelectionTrail(data: AppData, templateId: string, nodes: ProductSpecNode[], selection: ModelSelection): { nodeId: string; label: string }[] {
  const trail: { nodeId: string; label: string }[] = []
  collectModelSelections(data, templateId, nodes, selection).rows.forEach((row) => {
    const chosen = row.multiple ? row.selectedIds : row.selectedId ? [row.selectedId] : []
    if (!chosen.length) return
    const attribute = nodes.find((item) => item.nodeType === 'ATTRIBUTE' && item.attributeId === row.id)
    trail.push({ nodeId: attribute?.id || row.id, label: row.label })
    chosen.forEach((valueId) => {
      const branch = nodes.find((item) => item.id === valueId && item.nodeType === 'ATTRIBUTE')
      if (branch) {
        trail.push({ nodeId: branch.id, label: nodeDisplayName(data, branch) })
        return
      }
      const valueNode = nodes.find((item) => item.nodeType === 'VALUE' && item.attributeId === row.id && item.valueId === valueId)
      trail.push({ nodeId: valueNode?.id || valueId, label: valueNode ? nodeDisplayName(data, valueNode) : valueId })
    })
  })
  return trail
}

/** 规格属性做笛卡尔积。嵌套或同级都只看已收集的规格轴，不因为层级不同丢掉某一轴。 */
export function generateSkuFromModel(input: { commonAttrs: Record<string, string>; variantSelections: Record<string, string[]>; modelSnapshot: ProductSpecNode[] }): { commonAttrs: Record<string, string>; skus: ModelSkuDraft[] } {
  const snapshotValues = new Set(input.modelSnapshot.filter((item) => item.nodeType === 'VALUE' && item.valueId).map((item) => item.valueId))
  const checkSnapshot = input.modelSnapshot.length > 0
  const axes = Object.entries(input.variantSelections).map(([key, values]) => ({
    key,
    values: values.filter((value, index, list) => Boolean(value) && list.indexOf(value) === index && (!checkSnapshot || snapshotValues.has(value))),
  }))
  if (!axes.length || axes.some((item) => item.values.length === 0)) return { commonAttrs: { ...input.commonAttrs }, skus: [] }
  const combos = axes.reduce<Record<string, string>[]>((rows, axis) => rows.flatMap((row) => axis.values.map((value) => ({ ...row, [axis.key]: value }))), [{}])
  return { commonAttrs: { ...input.commonAttrs }, skus: combos.map((variant) => ({ variant })) }
}

/** SKU 列只来自当前已选的规格属性。 */
export function pathVariantColumns(data: AppData, templateId: string, nodes: ProductSpecNode[], selection: ModelSelection): ModelSpecColumn[] {
  return collectModelSelections(data, templateId, nodes, selection).columns
}


export function shelfOf(family: ProductFamily): 'draft' | 'online' | 'offline' {
  if (family.shelfStatus) return family.shelfStatus
  return family.lifecycle === 'ready' ? 'online' : 'draft'
}

export function shelfText(status: string) {
  if (status === 'online') return '已发布'
  if (status === 'offline') return '已下架'
  return '草稿'
}

export function modelPathText(data: AppData, family: ProductFamily) {
  const scheme = templateById(data, family.templateId)?.name || '未记录方案'
  const version = family.modelVersionId ? modelVersionById(data, family.modelVersionId) : undefined
  const nodes = version?.nodesSnapshot || data.productSpecNodes.filter((item) => item.templateId === family.templateId)
  const steps: string[] = []
  const visit = (parentId: string | null) => {
    nodes
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => a.sort - b.sort)
      .forEach((node) => {
        if (node.nodeType === 'ATTRIBUTE') {
          const name = paramById(data, node.attributeId)?.name || ''
          const value = name ? family.commonAttrs[name] : ''
          if (name && value) steps.push(`${name} ${value}`)
        }
        visit(node.id)
      })
  }
  visit(null)
  Object.entries(family.commonAttrs).forEach(([name, value]) => {
    if (value && !steps.some((item) => item.startsWith(`${name} `))) steps.push(`${name} ${value}`)
  })
  return [scheme, ...steps].join(' → ')
}

export function statusText(status: string) {
  if (status === 'on_sale') return '在售'
  if (status === 'off_sale') return '停售'
  if (status === 'draft') return '草稿'
  return status
}

export function buildMatrix(data: AppData, templateId: string, columnParamId?: string): MatrixModel {
  const axis = structureParams(data, templateId)
  const fallback = axis[axis.length - 1]
  const column = (columnParamId ? paramById(data, columnParamId) : undefined) ?? fallback
  const v2 = Boolean(columnParamId && column && fallback && column.id !== fallback.id)
  const rowAxis = axis.filter((item) => item.id !== column?.id)
  const families = data.families.filter((item) => item.templateId === templateId)
  const colSet = new Set<string>()
  const grouped = new Map<string, { path: string[]; sku: Sku; family: ProductFamily; col: string }[]>()
  families.forEach((family) => {
    familySkus(data, family.id).forEach((sku) => {
      const attrs = projectAttrs(family, sku)
      const path = rowAxis.map((item) => attrs[item.name] || '')
      const col = column ? attrs[column.name] || '' : ''
      colSet.add(col || '（未填写）')
      const key = path.join('\u0001')
      const bucket = grouped.get(key) ?? []
      bucket.push({ path, sku, family, col: col || '（未填写）' })
      grouped.set(key, bucket)
    })
  })
  const colValues = Array.from(colSet)
  const rows = Array.from(grouped.entries()).map(([key, items]) => ({
    key,
    path: items[0]?.path ?? [],
    cells: colValues.map((col) => {
      const found = items.find((item) => item.col === col)
      if (!found || !column) {
        return { state: 'missing' as const, label: '组合不存在' }
      }
      const issues = inspectFamily(data, found.family, [found.sku]).filter((issue) => !issue.skuId || issue.skuId === found.sku.id)
      const illegal = issues.some((issue) => issue.kind === 'illegal')
      const incomplete = issues.some((issue) => issue.kind === 'required')
      if (!found.sku.variantAttrs[column.name] && !found.family.commonAttrs[column.name]) {
        return {
          state: 'empty-axis' as const,
          skuId: found.sku.id,
          familyId: found.family.id,
          label: illegal ? '规则不合法' : incomplete ? '必填缺失' : '商品存在，此规格未填',
        }
      }
      return {
        state: illegal ? ('illegal' as const) : incomplete ? ('incomplete' as const) : ('ok' as const),
        skuId: found.sku.id,
        familyId: found.family.id,
        label: illegal ? '规则不合法' : incomplete ? '必填缺失' : '已符合配置',
      }
    }),
  }))
  return {
    rowParams: rowAxis.map((item) => item.name),
    colParam: column?.name || '规格',
    colValues,
    rows,
    v2,
  }
}

export function buildProductTree(data: AppData, templateId: string, compact: boolean): TreeNode[] {
  const axis = structureParams(data, templateId)
  const roots: TreeNode[] = []
  data.families
    .filter((family) => family.templateId === templateId)
    .forEach((family) => {
      familySkus(data, family.id).forEach((sku) => {
        const attrs = projectAttrs(family, sku)
        const steps = axis
          .map((param) => ({ param, value: attrs[param.name] || '' }))
          .filter((step) => (compact ? Boolean(step.value) : true))
        let cursor = roots
        let path = templateId
        steps.forEach((step, index) => {
          path += `/${step.param.id}:${step.value}`
          let node = cursor.find((item) => item.key === path)
          const last = index === steps.length - 1
          if (!node) {
            node = {
              key: path,
              label: step.value || '（空）',
              empty: !step.value,
              levelName: step.param.name,
              children: [],
              skuId: last ? sku.id : undefined,
              familyId: last ? family.id : undefined,
            }
            cursor.push(node)
          }
          if (last) {
            node.skuId = sku.id
            node.familyId = family.id
          }
          cursor = node.children
        })
      })
    })
  return roots
}

export function ruleConflicts(data: AppData) {
  const messages: string[] = []
  const active = data.rules.filter((rule) => rule.enabled && !rule.legacy)
  active.forEach((rule, index) => {
    active.slice(index + 1).forEach((other) => {
      if (rule.templateId !== other.templateId || rule.targetParamId !== other.targetParamId) return
      const same =
        rule.sourceParamIds.join(',') === other.sourceParamIds.join(',') &&
        rule.sourceParamIds.every((id) => rule.conditions[id] === other.conditions[id])
      if (!same) return
      const optionsDiffer = rule.options.slice().sort().join('|') !== other.options.slice().sort().join('|')
      if (optionsDiffer) {
        const target = paramById(data, rule.targetParamId)?.name || rule.targetParamId
        messages.push(`「${target}」有两条条件相同但允许值不同的规则。`)
      }
    })
  })
  return Array.from(new Set(messages))
}

export function blankVariantAttrs(variants: BoundParam[]) {
  const attrs: Record<string, string> = {}
  variants.forEach((item) => {
    attrs[item.param.name] = ''
  })
  return attrs
}
