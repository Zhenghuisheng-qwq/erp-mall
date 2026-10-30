/** Internal navigation only. Preserve the source configuration's version, range and private work key. */
export function internalReturnLocation(value:unknown): string | undefined {
  if(typeof value!=='string'||value.length>5000||/[\\\u0000-\u001f\u007f]/.test(value))return undefined
  try{
    const url=new URL(value,'https://erp.invalid')
    if(url.origin!=='https://erp.invalid'||/[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(value)))return undefined
    if(!['/compatibility','/benefits/manage','/benefits/shopping','/specs','/catalog','/skus','/spus'].includes(url.pathname)&&!/^\/(materials|skus|spus)\//.test(url.pathname))return undefined
    return url.pathname+url.search+url.hash
  }catch{return undefined}
}
