import { createAccessoryCompatibilityFixture, ACCESSORY_TEST_TIME } from './accessory-compatibility-fixtures'
import { createEmptyTemplateCompatibilityConfig, createTemplateCompatibilityContext, freezeTemplateCompatibility, selectorForNode } from '../src/domain/templateCompatibility'
import type { TemplateCompatibilityClaim, TemplateCompatibilityConfig } from '../src/domain/templateCompatibilityTypes'
import type { ProductSpecNode, SpecModelVersion } from '../src/domain/types'

export const TEMPLATE_COMPATIBILITY_TIME = ACCESSORY_TEST_TIME
export function createTemplateCompatibilityFixture(input: { styles?: number; colors?: number; packs?: number } = {}) {
  const fixture = createAccessoryCompatibilityFixture(), { data, hosts } = fixture
  const modelId = 'template-accessory-test', versionId = 'compat-version-1'
  const styles = input.styles || 2, colors = input.colors || 2, packs = input.packs || 2
  data.params.push({ id: 'attr-style', name: '款式', values: Array.from({ length: styles }, (_, index) => `款式 ${index + 1}`), valueGroups: [], participateInStructure: true }, { id: 'attr-pack', name: '包装', values: Array.from({ length: packs }, (_, index) => `包装 ${index + 1}`), valueGroups: [], participateInStructure: true })
  data.params.find(param => param.id === 'attr-color')!.values = Array.from({ length: colors }, (_, index) => `色彩 ${index + 1}`)
  data.templateParams.push({ templateId: modelId, paramId: 'attr-style', role: 'variant', required: false }, { templateId: modelId, paramId: 'attr-pack', role: 'common', required: false })
  data.specCanvases.push({ templateId: modelId, productTypeId: 'type-case', name: '【独立测试】兼容配置模型', zoom: 1, panX: 0, panY: 0, status: 'draft', version: 0, versionName: '', updatedAt: TEMPLATE_COMPATIBILITY_TIME })
  const node = (id: string, parentId: string | null, nodeType: ProductSpecNode['nodeType'], attributeId: string, valueId = '', sort = 1): ProductSpecNode => ({ id, templateId: modelId, parentId, nodeType, attributeId, valueId, sort })
  data.productSpecNodes.push(node('compat-style', null, 'ATTRIBUTE', 'attr-style'), node('compat-pack', null, 'ATTRIBUTE', 'attr-pack', '', 2))
  for (let style = 0; style < styles; style++) {
    const valueId = `compat-style-${style}`, attributeId = `compat-color-${style}`
    data.productSpecNodes.push(node(valueId, 'compat-style', 'VALUE', 'attr-style', `款式 ${style + 1}`, style + 1), node(attributeId, valueId, 'ATTRIBUTE', 'attr-color'))
    for (let color = 0; color < colors; color++) data.productSpecNodes.push(node(`compat-color-${style}-${color}`, attributeId, 'VALUE', 'attr-color', `色彩 ${color + 1}`, color + 1))
  }
  for (let pack = 0; pack < packs; pack++) data.productSpecNodes.push(node(`compat-pack-${pack}`, 'compat-pack', 'VALUE', 'attr-pack', `包装 ${pack + 1}`, pack + 1))
  data.templateCompatibilityConfigs = []
  data.templateCompatibilityOrigins = []
  const claim = (id = 'compat-claim-default', host = hosts.a): TemplateCompatibilityClaim => ({ id, host: structuredClone(host), conclusion: 'compatible', verification: 'confirmed', capability: 'basic', conditions: [], source: '【独立测试】规格适配验证资料，不代表真实设备结论', note: '默认配置' })
  const config: TemplateCompatibilityConfig = createEmptyTemplateCompatibilityConfig(modelId)
  config.defaultRule.configured = true; config.defaultRule.claims = [claim()]; config.revision = 1; config.updatedAt = TEMPLATE_COMPATIBILITY_TIME
  data.templateCompatibilityConfigs.push(config)
  const context = createTemplateCompatibilityContext(data, { modelId })
  config.exceptions.push({ id: 'compat-rule-pro', name: '款式 2 单独配置', selector: selectorForNode(context, 'compat-style-1').selector!, claims: [{ ...claim('compat-claim-pro', hosts.b), note: '款式 2 专属配置' }] })
  const version: SpecModelVersion = { id: versionId, templateId: modelId, version: 1, versionName: '独立兼容测试 V1', status: 'published', nodesSnapshot: structuredClone(data.productSpecNodes), createdTime: TEMPLATE_COMPATIBILITY_TIME, publishTime: TEMPLATE_COMPATIBILITY_TIME, templateCompatibilitySnapshot: freezeTemplateCompatibility(data, modelId) }
  data.specModelVersions.push(version)
  return { ...fixture, modelId, versionId, config, version, claim, styles, colors, packs }
}
