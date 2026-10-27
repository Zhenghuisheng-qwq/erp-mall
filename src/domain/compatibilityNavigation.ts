export type CompatibilityTab = 'results' | 'workbench' | 'legacy'
export function isCompatibilityTab(value:unknown): value is CompatibilityTab {
  return value==='results'||value==='workbench'||value==='legacy'
}
export function compatibilityPageTitle(tab:unknown){return tab==='workbench'?'兼容性维护':tab==='legacy'?'原物料兼容性（高级）':'兼容性查询'}
/** Internal navigation only. Preserve the source configuration's version, range and private work key. */
export function compatibilityReturnLocation(value:unknown): string | undefined {
  if(typeof value!=='string'||value.length>5000||/[\\\u0000-\u001f\u007f]/.test(value))return undefined
  try{
    const url=new URL(value,'https://erp.invalid')
    if(url.origin!=='https://erp.invalid'||/[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(value)))return undefined
    if(!['/sales-configurations','/sales-shopping','/benefit-packages','/specs','/catalog','/skus','/spus'].includes(url.pathname)&&!/^\/(benefit-packages|materials|skus|spus)\//.test(url.pathname))return undefined
    return url.pathname+url.search+url.hash
  }catch{return undefined}
}
