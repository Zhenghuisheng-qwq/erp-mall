/** 按规划树预览规格组合。同级属性相乘，挂在取值下的属性只走该路径。不调用 generateSkuFromModel。 */

import { buildPlanTree, findPlanNode, nodeChain, planDisplayPath, type ProductPlanNode } from './productPlan'

export interface PlanSkuPreviewRow {
  code: string
  path: string
  trail: string
  capacity: string
  color: string
  specs: string[]
  combination: '同级相乘' | '路径组合'
  status: '预览'
  leafId: string
  leafName: string
}

interface SpecPart {
  name: string
  value: string
  valueId: string
}

interface Combo {
  specs: SpecPart[]
  trail: ProductPlanNode[]
  leaf: ProductPlanNode
  multiplied: boolean
}

function cartesian<T>(axes: T[][]): T[][] {
  return axes.reduce<T[][]>((rows, axis) => rows.flatMap((row) => axis.map((item) => [...row, item])), [[]])
}

function collectFrom(node: ProductPlanNode): Combo[] {
  const attrs = (node.children || []).filter((item) => item.nodeType === 'ATTRIBUTE')
  const others = (node.children || []).filter((item) => item.nodeType !== 'ATTRIBUTE')
  const combos: Combo[] = []
  const axes = attrs.map((attr) => expandAttribute(attr)).filter((axis) => axis.length)
  if (axes.length) {
    for (const picked of cartesian(axes)) {
      const last = picked[picked.length - 1]
      combos.push({
        specs: picked.flatMap((item) => item.specs),
        trail: picked.flatMap((item) => item.trail),
        leaf: last?.leaf || node,
        multiplied: axes.length > 1 || picked.some((item) => item.multiplied),
      })
    }
  }
  for (const child of others) {
    for (const item of collectFrom(child)) {
      combos.push({ ...item, trail: [child, ...item.trail] })
    }
  }
  if (!combos.length && (node.nodeType === 'VALUE' || node.nodeType === 'MATERIAL')) {
    combos.push({ specs: [], trail: [], leaf: node, multiplied: false })
  }
  return combos
}

function expandAttribute(attr: ProductPlanNode): Combo[] {
  const values = (attr.children || []).filter((item) => item.nodeType === 'VALUE')
  const extras = (attr.children || []).filter((item) => item.nodeType !== 'VALUE')
  const combos: Combo[] = []
  for (const value of values) {
    const nested = collectFrom(value)
    const spec = { name: attr.name, value: value.name, valueId: value.id }
    if (nested.length) {
      for (const item of nested) {
        combos.push({
          specs: [spec, ...item.specs],
          trail: [value, ...item.trail],
          leaf: item.leaf,
          multiplied: item.multiplied,
        })
      }
    } else {
      combos.push({ specs: [spec], trail: [value], leaf: value, multiplied: false })
    }
  }
  for (const extra of extras) {
    const nested = extra.nodeType === 'ATTRIBUTE' ? expandAttribute(extra) : collectFrom(extra)
    combos.push(...nested)
  }
  return combos
}

function chainSpecs(chain: ProductPlanNode[]): SpecPart[] {
  const specs: SpecPart[] = []
  for (let index = 0; index < chain.length; index += 1) {
    const node = chain[index]
    const next = chain[index + 1]
    if (node?.nodeType === 'ATTRIBUTE' && next?.nodeType === 'VALUE' && next.parentId === node.id) {
      specs.push({ name: node.name, value: next.name, valueId: next.id })
    }
  }
  return specs
}

function mergeSpecs(base: SpecPart[], extra: SpecPart[]) {
  const seen = new Set(base.map((item) => item.valueId))
  return [...base, ...extra.filter((item) => !seen.has(item.valueId))]
}

function specValue(specs: string[], name: string) {
  const found = specs.find((item) => item.startsWith(`${name}:`))
  return found ? found.slice(name.length + 1) : ''
}

export function generatePlanSkuPreview(nodes: ProductPlanNode[], rootId: string, scopeId: string): PlanSkuPreviewRow[] {
  const root = buildPlanTree(nodes, rootId)
  if (!root) return []
  const scope = findPlanNode(root, scopeId)
  if (!scope) return []
  const prefix = nodeChain(root, scope.id)
  const inherited = chainSpecs(prefix)
  const combos = scope.nodeType === 'ATTRIBUTE' ? expandAttribute(scope) : collectFrom(scope)
  return combos.map((combo, index) => {
    const specs = mergeSpecs(inherited, combo.specs)
    const specText = specs.map((item) => `${item.name}:${item.value}`)
    const path = planDisplayPath([...prefix, ...combo.trail])
    const leafId = combo.multiplied ? specs.map((item) => item.valueId).join('+') : combo.leaf.id
    return {
      code: `SKU${String(index + 1).padStart(3, '0')}`,
      path,
      trail: path.replaceAll(' / ', ' > '),
      capacity: specValue(specText, '容量'),
      color: specValue(specText, '颜色'),
      specs: specText,
      combination: combo.multiplied ? '同级相乘' : '路径组合',
      status: '预览',
      leafId,
      leafName: combo.leaf.name,
    }
  })
}
