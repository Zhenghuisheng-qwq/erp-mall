import { r01Fixture } from './r01-fixture'
import { freezeBusinessNodes, type NodeBusinessConfig } from '../src/domain/nodeBusiness'
export function r01ProtectionFixture() {
  const { data, modelId } = r01Fixture()
  const nodeId = `${modelId}-apple`, attributeId = 'r01-color'
  const config: NodeBusinessConfig = { id: 'protection-allowed', definitionId: 'business:allowed', modelId, nodeId, enabled: true, scope: 'subtree', parameters: { attributeId, values: ['颜色1', '颜色2'] } }
  data.productSpecNodes.find(n => n.id === nodeId)!.businessConfigs = [config]
  data.specModelVersions.push({ id: 'protection-v1', templateId: modelId, version: 1, versionName: 'V1', status: 'published', nodesSnapshot: freezeBusinessNodes(data, data.productSpecNodes.filter(n => n.templateId === modelId)), createdTime: '2026-10-25', publishTime: '2026-10-25' })
  const canvas = data.specCanvases.find(c => c.templateId === modelId)!
  canvas.status = 'published'
  return { data, modelId, nodeId, attributeId, config }
}
