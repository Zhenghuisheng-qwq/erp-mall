/** V3 物料描述规则。只保存字段组合和预览，不执行规则引擎。 */

export type RuleStatus = 'ACTIVE' | 'DISABLED'

export interface MaterialRule {
  id: string
  name: string
  applicableType: string
  fields: string[]
  preview: string
  status: RuleStatus
}

export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  ACTIVE: '启用',
  DISABLED: '停用',
}

export function normalizeRuleStatus(status: string): RuleStatus {
  if (status === 'DISABLED' || status === '停用') return 'DISABLED'
  return 'ACTIVE'
}

export function createMaterialRuleSeed(): MaterialRule[] {
  return [
    {
      id: 'rule-phone',
      name: '手机物料描述规则',
      applicableType: '手机',
      fields: ['品牌', '型号', '容量', '颜色'],
      preview: 'Apple iPhone17 256G 黑色',
      status: 'ACTIVE',
    },
    {
      id: 'rule-pad',
      name: '平板物料描述规则',
      applicableType: '平板',
      fields: ['品牌', '型号', '尺寸', '颜色'],
      preview: 'iPad iPad Pro 11英寸 深空灰',
      status: 'DISABLED',
    },
  ]
}
