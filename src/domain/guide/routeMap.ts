import {guidePages} from './registry'
import {isMaterialArchive} from '../catalogIdentity'
import type {AppData} from '../types'

export function guidePageFor(path:string,query:Record<string,unknown>={},data?:AppData){
  let normalized=path.split('?')[0]||'/'
  if(normalized==='/columns'||((normalized==='/products'||normalized==='/spus'||normalized==='/skus')&&query.panel==='columns')){
    const canonical=normalized==='/skus'?'/skus?panel=columns':'/spus?panel=columns'
    return guidePages.find(page=>page.patterns.includes(canonical))
  }
  if(normalized==='/products')normalized='/spus'
  else if(normalized==='/products/new')normalized='/spus/new'
  else if(/^\/products\/[^/]+$/.test(normalized)){
    const familyId=normalized.split('/')[2]!,sku=data?.skus.find(s=>s.id===query.sku&&s.familyId===familyId)
    normalized=query.add||query.copySku?'/skus/new':sku&&data?isMaterialArchive(data,sku)?`/materials/${familyId}`:`/skus/${sku.id}`:query.sku?'/skus/legacy':`/spus/${familyId}`
  }
  return guidePages.find(page=>page.patterns.some(pattern=>!pattern.includes('?')&&pattern.split('/').length===normalized.split('/').length&&pattern.split('/').every((part,index)=>part.startsWith(':')||part===normalized.split('/')[index])))
}
export function safeGuideReturn(value:unknown,canRoute:(location:{path:string;query?:Record<string,unknown>})=>boolean){
  const fallback=canRoute({path:'/'})?'/':'/guide'
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f\u007f]/.test(value)||value.length>1800)return fallback
  try{
    if(/[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(value)))return fallback
    const url=new URL(value,'https://erp.invalid'),query=Object.fromEntries(url.searchParams)
    if(url.origin!=='https://erp.invalid'||url.pathname.startsWith('/guide')||!guidePageFor(url.pathname,query)||!canRoute({path:url.pathname,query}))return fallback
    const allowed=new Set(['spu','sku','copy','template','model','modelId','productTypeId','categoryId','version','versionId','panel','scope','host','device','add','copySku','id','q','mode','framework','category','deviceModel','family','focus','key','legacy','manage','materialNode','materialVersion','plan','root','scheme','targetId','type','view'])
    if([...url.searchParams.keys()].some(key=>!allowed.has(key)||key==='returnTo'))return fallback
    if(url.hash&&!/^#[a-zA-Z0-9_-]{1,80}$/.test(url.hash))return fallback
    return url.pathname+url.search+url.hash
  }catch{return fallback}
}
