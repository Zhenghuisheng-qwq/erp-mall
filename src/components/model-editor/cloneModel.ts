import type { CatalogTemplate, ProductSpecNode, SpecCanvasConfig, TemplateParam } from '../../domain/types'

/** 复制节点树、父子关系和属性/值引用。不包含发布记录、商品和 SKU。 */
export function cloneProductModel(input: {
  sourceId: string
  name: string
  productTypeId: string
  nextId: (prefix: string) => string
  templates: CatalogTemplate[]
  nodes: ProductSpecNode[]
  templateParams: TemplateParam[]
  now?: string
}) {
  const source = input.templates.find((item) => item.id === input.sourceId)
  if (!source || !input.productTypeId) return null
  const sourceNodes = input.nodes.filter((item) => item.templateId === input.sourceId)
  const templateId = input.nextId('tpl')
  const template: CatalogTemplate = {
    id: templateId,
    name: input.name,
    parentId: null,
    enabled: true,
    structureOrder: [...source.structureOrder],
  }
  const params = input.templateParams
    .filter((item) => item.templateId === input.sourceId)
    .map((item) => ({ ...item, templateId }))
  const map = new Map(sourceNodes.map((item) => [item.id, input.nextId('sn')]))
  const nodes = sourceNodes.map((item) => ({
    ...item,
    id: map.get(item.id) || input.nextId('sn'),
    templateId,
    parentId: item.parentId ? map.get(item.parentId) || null : null,
  }))
  const canvas: SpecCanvasConfig = {
    templateId,
    productTypeId: input.productTypeId,
    name: input.name,
    zoom: 1,
    panX: 0,
    panY: 0,
    status: 'draft',
    version: 1,
    versionName: 'V1',
    direction: 'logic',
    updatedAt: input.now || new Date().toISOString(),
  }
  return { templateId, template, params, nodes, canvas, idMap: map }
}
