import type {ProductType,AppData} from './types'
export const productTypePurposes = [
  {value:'', label:'未指定'},
  {value:'host', label:'主机／设备'},
  {value:'accessory', label:'配件'},
  {value:'other', label:'其他'},
] as const
export const productTypePurposeLabel = (value: ProductType['catalogRole']) => productTypePurposes.find(item => item.value === (value || ''))?.label || '未指定'
export const validProductTypePurpose = (value: unknown): value is ProductType['catalogRole'] => value === undefined || ['host','accessory','other'].includes(String(value)) && typeof value === 'string'

export function categoryAvailabilityProblem(data:AppData,id:string){const seen=new Set<string>();let current:string|null=id;while(current){const rows=data.categories.filter(c=>c.id===current);if(rows.length!==1||seen.has(current))return '分类不存在或层级引用无效';seen.add(current);current=rows[0]!.parentId}return seen.size?'':'请选择归属分类'}
export function productTypeAvailabilityProblem(data:AppData,id:string){const rows=data.productTypes.filter(t=>t.id===id);if(rows.length!==1)return '产品类型不存在或身份冲突';return rows[0]!.status!=='enabled'?'产品类型已停用':categoryAvailabilityProblem(data,rows[0]!.categoryId)}
