/** V3 兼容关系。主商品类型对应配件类型，再落到具体物料。 */

export type CompatibilityStatus = 'ACTIVE' | 'DISABLED'

export interface Compatibility {
  id: string
  mainProductId: string
  mainProductName: string
  accessoryType: string
  compatibleSkuIds: string[]
  description: string
  status: CompatibilityStatus
}

export const COMPAT_STATUS_LABEL: Record<CompatibilityStatus, string> = {
  ACTIVE: '启用',
  DISABLED: '停用',
}

export function normalizeCompatStatus(status: string): CompatibilityStatus {
  if (status === 'DISABLED' || status === '停用') return 'DISABLED'
  return 'ACTIVE'
}

export function createCompatibilitySeed(): Compatibility[] {
  return [
    {
      id: 'cmp-film',
      mainProductId: 'ppn-ip17',
      mainProductName: 'iPhone17',
      accessoryType: '保护膜',
      compatibleSkuIds: ['mat-film-a', 'mat-film-b'],
      description: 'iPhone17 可配的钢化膜。',
      status: 'ACTIVE',
    },
    {
      id: 'cmp-case',
      mainProductId: 'ppn-ip17',
      mainProductName: 'iPhone17',
      accessoryType: '手机壳',
      compatibleSkuIds: ['mat-case'],
      description: 'iPhone17 可配的手机壳。',
      status: 'ACTIVE',
    },
    {
      id: 'cmp-charge',
      mainProductId: 'ppn-ip17',
      mainProductName: 'iPhone17',
      accessoryType: '充电器',
      compatibleSkuIds: ['mat-charge'],
      description: 'iPhone17 可配的充电器。',
      status: 'ACTIVE',
    },
  ]
}
