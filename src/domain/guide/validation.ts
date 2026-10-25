import {guideArticles,guidePages,guideFlows} from './registry'
import type {GuideContentState,GuideOverride} from './types'
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const string=(v:unknown,max=8000):v is string=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)&&!/<\s*(script|iframe|object|embed)|\bon\w+\s*=|javascript\s*:|data\s*:\s*text\/html/i.test(v)
export function overrideProblems(value:unknown):string[]{
  if(!object(value))return ['说明必须是记录对象。']
  const problems:string[]=[]
  if(!guideArticles.some(a=>a.id===value.articleId))problems.push('说明引用的内置文章不存在。')
  const allowed=new Set(['articleId','title','summary','sections','status','implementation','evidence'])
  if(Object.keys(value).some(k=>!allowed.has(k)))problems.push('说明不能修改内置身份、路由、规则执行绑定或权限。')
  if(!string(value.title,200)||!value.title.trim()||!string(value.summary,2000)||!string(value.implementation,500)||!['verified','review','business-pending','historical'].includes(String(value.status)))problems.push('说明标题、摘要、状态或适用实现无效。')
  if(!Array.isArray(value.evidence)||value.evidence.some(v=>!string(v,1000)))problems.push('核验依据格式无效。')
  if(!Array.isArray(value.sections)||!value.sections.length||value.sections.length>30)problems.push('说明章节容器无效。')
  else {const ids=new Set<string>();for(const s of value.sections){if(!object(s)||typeof s.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(s.id)||ids.has(s.id)||!string(s.title,200)){problems.push('章节标识重复或标题无效。');continue}ids.add(s.id);if(Object.keys(s).some(k=>!['id','title','paragraphs','steps','table'].includes(k)))problems.push('章节包含不支持内容。');for(const k of ['paragraphs','steps'])if(s[k]!==undefined&&(!Array.isArray(s[k])||s[k].length>100||s[k].some((p:unknown)=>!string(p))))problems.push('正文或步骤无效。');if(s.table!==undefined&&(!object(s.table)||!Array.isArray(s.table.headers)||s.table.headers.some(p=>!string(p,300))||!Array.isArray(s.table.rows)||s.table.rows.length>100||s.table.rows.some(row=>!Array.isArray(row)||row.some(p=>!string(p,2000)))))problems.push('表格内容无效。')}}
  if(value.status==='verified'&&(!(value.evidence as unknown[])?.length||!value.implementation))problems.push('已核验说明需要适用实现及核验依据。')
  const builtin=guideArticles.find(a=>a.id===value.articleId)
  if(builtin?.status==='business-pending'&&value.status!=='business-pending')problems.push('待业务确认条目不能通过修改说明转为已确认规则。')
  if(builtin&&Array.isArray(value.sections))for(const section of builtin.sections){
    const edited=value.sections.find(s=>object(s)&&s.id===section.id)
    if(!object(edited)||!((Array.isArray(edited.paragraphs)&&edited.paragraphs.some(p=>typeof p==='string'&&p.trim()))||(Array.isArray(edited.steps)&&edited.steps.some(p=>typeof p==='string'&&p.trim()))||(object(edited.table)&&Array.isArray(edited.table.rows)&&edited.table.rows.length)))problems.push(`章节「${section.title}」缺少内容，不能用空章节覆盖完整说明。`)
  }
  if(builtin?.kind==='rule')for(const section of builtin.sections.filter(s=>s.id==='conditions')){
    if(!Array.isArray(value.sections)||JSON.stringify(value.sections.find(s=>object(s)&&s.id===section.id))!==JSON.stringify(section))problems.push('内置规则的真实允许/禁止条件为只读；可维护解释、例子和补充说明。')
  }
  return [...new Set(problems)]
}
export function contentProblems(value:unknown):string[]{
  if(!object(value)||value.schema!==1||!Number.isInteger(value.revision)||Number(value.revision)<0||!object(value.published)||!object(value.previous)||!object(value.drafts))return ['指南存储结构或 schema 损坏，原始内容保留。']
  const errors:string[]=[]
  if(Object.keys(value).some(k=>!['schema','revision','published','previous','drafts'].includes(k)))errors.push('指南存储包含未登记字段。')
  for(const key of ['published','previous'] as const)for(const [id,pub]of Object.entries(value[key] as Record<string,unknown>)){
    if(!object(pub)||!Number.isInteger(pub.revision)||Number(pub.revision)<1||!string(pub.updatedAt,80)||!string(pub.author,160)||!object(pub.content)||pub.content.articleId!==id)errors.push('发布记录的身份、修订或作者无效。')
    else errors.push(...overrideProblems(pub.content))
  }
  for(const [id,draft]of Object.entries(value.drafts as Record<string,unknown>)){if(!object(draft)||draft.articleId!==id)errors.push('草稿身份不匹配。');else errors.push(...overrideProblems(draft))}
  return [...new Set(errors)]
}
export function guideReferenceProblems(){
  const ids=new Set<string>(),problems:string[]=[]
  for(const a of guideArticles){if(ids.has(a.id))problems.push(`文章ID重复:${a.id}`);ids.add(a.id);problems.push(...overrideProblems({articleId:a.id,title:a.title,summary:a.summary,sections:a.sections,status:a.status,implementation:a.implementation,evidence:a.evidence}).map(p=>`${a.id}:${p}`))}
  for(const a of guideArticles)for(const id of [...a.related,...a.ruleIds,...a.actionIds])if(!ids.has(id))problems.push(`${a.id}:断引用:${id}`)
  for(const p of guidePages){if(!ids.has(p.articleId)||p.actionIds.some(id=>!ids.has(id)))problems.push(`${p.id}:手册/动作缺失`)}
  for(const flow of guideFlows)for(const step of flow.steps)if(!ids.has(step.articleId))problems.push(`${flow.id}:学习引用缺失:${step.articleId}`)
  return problems
}
export const emptyGuideContent=():GuideContentState=>({schema:1,revision:0,published:{},previous:{},drafts:{}})
export function asOverride(value:unknown):GuideOverride{const issues=overrideProblems(value);if(issues.length)throw Error(issues.join(' '));return value as GuideOverride}
