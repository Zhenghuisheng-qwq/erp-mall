/** V3 物料档案。只存在本模块，不写入商品配置。 */

import type { ProductPlanNode } from './productPlan'

export type MaterialStatus = 'CREATED' | 'CONFIRMED'

export interface Material {
  id: string
  materialCode: string
  name: string
  sourceNodeId: string
  sourcePath: string
  planId: string
  planName: string
  status: MaterialStatus
  description: string
  createTime: string
}

export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  CREATED: '已创建',
  CONFIRMED: '已确认',
}

export function normalizeMaterialStatus(status: string): MaterialStatus {
  if (status === 'CONFIRMED' || status === '已确认') return 'CONFIRMED'
  return 'CREATED'
}

export const MATERIAL_STORAGE_KEY = 'iyge-v3-material'
export const MATERIAL_DATA_VERSION = 1
export const RULE_FIELDS = ['品牌', '型号', '容量', '颜色', '尺寸'] as const

function valueOf(chain: ProductPlanNode[], attributeName: string) {
  for (let index = 0; index < chain.length; index += 1) {
    const node = chain[index]
    const next = chain[index + 1]
    if (node.nodeType === 'ATTRIBUTE' && node.name === attributeName && next?.nodeType === 'VALUE' && next.parentId === node.id) {
      return next.name
    }
  }
  return ''
}

/** 按规则字段从规划路径里取词并拼起来。只认演示里这几个字段名。 */
export function composeMaterialName(chain: ProductPlanNode[], fields: string[]) {
  const parts = fields.map((field) => {
    if (field === '品牌') {
      const typeName = chain.find((node) => node.nodeType === 'PRODUCT_TYPE')?.name || ''
      if (typeName.startsWith('Apple')) return 'Apple'
      return typeName
    }
    return valueOf(chain, field)
  })
  return parts.filter(Boolean).join(' ')
}

export function createMaterialSeed(): Material[] {
  return [
    {
      id: 'mat-black',
      materialCode: 'MYF13CH/A',
      name: 'Apple iPhone17 256G 黑色',
      sourceNodeId: 'ppn-black',
      sourcePath: '手机 / Apple手机 / iPhone17 / 256G / 黑色',
      planId: 'plan-phone',
      planName: '手机商品规划',
      status: 'CONFIRMED',
      description: '由手机物料描述规则拼出的演示物料。',
      createTime: '2026-10-13T08:40:00.000Z',
    },
    {
      id: 'mat-white-256',
      materialCode: 'MYF13WH/A',
      name: 'Apple iPhone17 256G 白色',
      sourceNodeId: 'ppn-white-256',
      sourcePath: '手机 / Apple手机 / iPhone17 / 256G / 白色',
      planId: 'plan-phone',
      planName: '手机商品规划',
      status: 'CREATED',
      description: '256G 白色演示物料。',
      createTime: '2026-10-13T08:45:00.000Z',
    },
    {
      id: 'mat-white-512',
      materialCode: 'MYF13WH/B',
      name: 'Apple iPhone17 512G 白色',
      sourceNodeId: 'ppn-white-512',
      sourcePath: '手机 / Apple手机 / iPhone17 / 512G / 白色',
      planId: 'plan-phone',
      planName: '手机商品规划',
      status: 'CREATED',
      description: '512G 白色演示物料。',
      createTime: '2026-10-13T08:50:00.000Z',
    },
    {
      id: 'mat-film-a',
      materialCode: 'FILM-A',
      name: '保护膜A',
      sourceNodeId: '',
      sourcePath: '配件 / 保护膜 / 保护膜A',
      planId: '',
      planName: '配件',
      status: 'CREATED',
      description: 'iPhone17 可配钢化膜。',
      createTime: '2026-10-12T02:00:00.000Z',
    },
    {
      id: 'mat-film-b',
      materialCode: 'FILM-B',
      name: '保护膜B',
      sourceNodeId: '',
      sourcePath: '配件 / 保护膜 / 保护膜B',
      planId: '',
      planName: '配件',
      status: 'CREATED',
      description: 'iPhone17 可配钢化膜。',
      createTime: '2026-10-12T02:10:00.000Z',
    },
    {
      id: 'mat-case',
      materialCode: 'CASE-A',
      name: '透明手机壳',
      sourceNodeId: '',
      sourcePath: '配件 / 手机壳 / 透明手机壳',
      planId: '',
      planName: '配件',
      status: 'CREATED',
      description: 'iPhone17 可配手机壳。',
      createTime: '2026-10-12T02:20:00.000Z',
    },
    {
      id: 'mat-charge',
      materialCode: 'CHG-20',
      name: '20W充电器',
      sourceNodeId: '',
      sourcePath: '配件 / 充电器 / 20W充电器',
      planId: '',
      planName: '配件',
      status: 'CREATED',
      description: 'iPhone17 可配充电器。',
      createTime: '2026-10-12T02:30:00.000Z',
    },
  ]
}
