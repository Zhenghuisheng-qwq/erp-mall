import { createCatalogProductFixture, CATALOG_TEST_TIME } from './catalog-product-fixture'
import type { ProductSpecNode, SpecModelVersion } from '../src/domain/types'

export const MODEL_TEST_TIME = CATALOG_TEST_TIME
export function createCatalogModelFixture(input: { styles?: number; colors?: number; packs?: number } = {}) {
  const fixture = createCatalogProductFixture(), { data } = fixture
  const modelId = 'template-accessory-test', versionId = 'sample-version-1'
  const styles = input.styles || 2, colors = input.colors || 2, packs = input.packs || 2
  data.params.push({ id: 'attr-style', name: '款式', values: Array.from({ length: styles }, (_, index) => `款式 ${index + 1}`), valueGroups: [], participateInStructure: true }, { id: 'attr-pack', name: '包装', values: Array.from({ length: packs }, (_, index) => `包装 ${index + 1}`), valueGroups: [], participateInStructure: true })
  data.params.find(param => param.id === 'attr-color')!.values = Array.from({ length: colors }, (_, index) => `色彩 ${index + 1}`)
  data.templateParams.push({ templateId: modelId, paramId: 'attr-style', role: 'variant', required: false }, { templateId: modelId, paramId: 'attr-pack', role: 'common', required: false })
  data.specCanvases.push({ templateId: modelId, productTypeId: 'type-case', name: '【独立测试】商品规格模型', zoom: 1, panX: 0, panY: 0, status: 'draft', version: 0, versionName: '', updatedAt: MODEL_TEST_TIME })
  const node = (id: string, parentId: string | null, nodeType: ProductSpecNode['nodeType'], attributeId: string, valueId = '', sort = 1): ProductSpecNode => ({ id, templateId: modelId, parentId, nodeType, attributeId, valueId, sort })
  data.productSpecNodes.push(node('sample-style', null, 'ATTRIBUTE', 'attr-style'), node('sample-pack', null, 'ATTRIBUTE', 'attr-pack', '', 2))
  for (let style = 0; style < styles; style++) {
    const valueId = `sample-style-${style}`, attributeId = `sample-color-${style}`
    data.productSpecNodes.push(node(valueId, 'sample-style', 'VALUE', 'attr-style', `款式 ${style + 1}`, style + 1), node(attributeId, valueId, 'ATTRIBUTE', 'attr-color'))
    for (let color = 0; color < colors; color++) data.productSpecNodes.push(node(`sample-color-${style}-${color}`, attributeId, 'VALUE', 'attr-color', `色彩 ${color + 1}`, color + 1))
  }
  for (let pack = 0; pack < packs; pack++) data.productSpecNodes.push(node(`sample-pack-${pack}`, 'sample-pack', 'VALUE', 'attr-pack', `包装 ${pack + 1}`, pack + 1))
  const version: SpecModelVersion = { id: versionId, templateId: modelId, version: 1, versionName: '独立模型测试 V1', status: 'published', nodesSnapshot: structuredClone(data.productSpecNodes), createdTime: MODEL_TEST_TIME, publishTime: MODEL_TEST_TIME }
  data.specModelVersions.push(version)
  return { ...fixture, modelId, versionId, version, styles, colors, packs }
}
