import type {ProductType} from './types'
export const productTypePurposes = [
  {value:'', label:'未指定'},
  {value:'host', label:'主机／设备'},
  {value:'accessory', label:'配件'},
  {value:'other', label:'其他'},
] as const
export const productTypePurposeLabel = (value: ProductType['catalogRole']) => productTypePurposes.find(item => item.value === (value || ''))?.label || '未指定'
export const validProductTypePurpose = (value: unknown): value is ProductType['catalogRole'] => value === undefined || ['host','accessory','other'].includes(String(value)) && typeof value === 'string'
