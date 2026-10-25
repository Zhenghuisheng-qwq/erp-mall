import {computed,onScopeDispose,readonly,ref,watch} from 'vue'
import {defineStore} from 'pinia'
import {useCatalogStore} from './catalog'
import {guideArticles} from '../domain/guide/registry'
import {asOverride,contentProblems,emptyGuideContent,overrideProblems} from '../domain/guide/validation'
import {createFailure} from '../domain/guide/failure'
import type {FailureKind,GuideArticle,GuideContentState,GuideFailure,GuideOverride,GuideProgress} from '../domain/guide/types'

export const GUIDE_CONTENT_KEY='iyge-guide-content-v1'
export const GUIDE_PROGRESS_PREFIX='iyge-guide-progress-v1:'
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
type Result={ok:boolean;message?:string;conflict?:boolean;failure?:GuideFailure}
const rejected=(kind:FailureKind,ruleId:string,message:string,actionId='action-guide-maintain',recovery:string[]=[]):Result=>({ok:false,message,...(kind==='conflict'?{conflict:true}:{}),failure:createFailure({kind,ruleId,actionId,message,savedState:'unchanged',recovery})})
const emptyProgress=(owner:string):GuideProgress=>({schema:1,owner,favorites:[],read:{},practiced:{},recent:[]})
function progressProblem(v:unknown,owner:string){
  const p=v as GuideProgress
  return !p||p.schema!==1||p.owner!==owner||!Array.isArray(p.favorites)||p.favorites.some(id=>typeof id!=='string')||!p.read||typeof p.read!=='object'||Array.isArray(p.read)||!p.practiced||typeof p.practiced!=='object'||Array.isArray(p.practiced)||[...Object.values(p.read),...Object.values(p.practiced)].some(rev=>!Number.isInteger(rev)||rev<1)||!Array.isArray(p.recent)||p.recent.some(r=>!r||typeof r.id!=='string'||!Number.isInteger(r.revision)||typeof r.at!=='string')
}
export const useGuideStore=defineStore('guide',()=>{
  const catalog=useCatalogStore(),state=ref<GuideContentState>(emptyGuideContent()),contentError=ref(''),external=ref(false),rawContent=ref<string|null>(null)
  const owner=computed(()=>catalog.rbacEnforced?catalog.activeUserId:'demo-super-admin'),progress=ref<GuideProgress>(emptyProgress(owner.value)),progressError=ref(''),rawProgress=ref<string|null>(null)
  let accepted:string|null=null,progressAccepted:string|null=null,queue:Promise<unknown>=Promise.resolve()
  function load(){
    try{const raw=localStorage.getItem(GUIDE_CONTENT_KEY);rawContent.value=raw;accepted=raw;external.value=false
      const candidate=raw?JSON.parse(raw):emptyGuideContent(),issues=contentProblems(candidate)
      if(issues.length)throw Error(issues.join(' '));state.value=candidate;contentError.value=''
    }catch(error){contentError.value=`指南说明无法读取：${String(error)} 原始内容未清除，当前显示内置说明。`;state.value=emptyGuideContent()}
  }
  function loadProgress(){
    progress.value=emptyProgress(owner.value);progressError.value='';progressAccepted=null
    try{const raw=localStorage.getItem(GUIDE_PROGRESS_PREFIX+encodeURIComponent(owner.value));rawProgress.value=raw;progressAccepted=raw;const value=raw?JSON.parse(raw):emptyProgress(owner.value);if(progressProblem(value,owner.value))throw Error('个人记录结构或身份无效');progress.value=value}
    catch(error){progressError.value=`个人记录无法读取，原始内容已保留：${String(error)}`}
  }
  load();loadProgress();watch(owner,loadProgress)
  const articles=computed<GuideArticle[]>(()=>guideArticles.map(article=>{
    const published=state.value.published[article.id]
    return published?{...article,...clone(published.content),id:article.id,revision:published.revision}:article
  }))
  function article(id:string){return articles.value.find(a=>a.id===id)}
  function editable(id:string):GuideOverride|undefined{
    const saved=state.value.drafts[id];if(saved)return clone(saved)
    const a=article(id);return a?{articleId:a.id,title:a.title,summary:a.summary,sections:clone(a.sections),status:a.status,implementation:a.implementation,evidence:[...a.evidence]}:undefined
  }
  const actor=()=>({id:catalog.activeUserId,preview:catalog.previewUserId})
  const sameActor=(a:ReturnType<typeof actor>)=>a.id===catalog.activeUserId&&a.preview===catalog.previewUserId
  function serial(operation:()=>Promise<Result>){const task=queue.then(operation,operation);queue=task.catch(()=>{});return task}
  async function lock(name:string,operation:()=>Result):Promise<Result>{
    try{if(!navigator.locks)throw Error('浏览器不支持安全的多窗口指南写入；仍可阅读。');return await navigator.locks.request(name,{mode:'exclusive'},operation)}
    catch(error){return rejected('unknown','',`指南未保存：${error instanceof Error?error.message:String(error)}`,'action-guide-maintain',['feedback'])}
  }
  function commit(expected:number,edit:(next:GuideContentState)=>void,recover=false):Promise<Result>{
    const captured=actor(),basis=accepted
    return serial(()=>lock(GUIDE_CONTENT_KEY,()=>{
      if(!sameActor(captured)||!catalog.can('system:guide:update'))return rejected('permission','rule-guide-permission','当前身份或指南维护授权已变化，未保存；编辑输入保留。')
      const raw=localStorage.getItem(GUIDE_CONTENT_KEY)
      if(raw!==basis||expected!==state.value.revision){external.value=true;return rejected('conflict','rule-guide-conflict','其他窗口或本页已更新指南。当前输入保留，请读取最新后核对，勿反复提交旧修订。','action-guide-maintain',['read-latest'])}
      if(contentError.value&&!recover)return {ok:false,message:'原始指南存储损坏，请先导出原始内容，再通过有效指南备份恢复。'}
      const next=clone(state.value);edit(next);next.revision++
      const errors=contentProblems(next);if(errors.length)return {ok:false,message:errors.join(' ')}
      const encoded=JSON.stringify(next)
      try{localStorage.setItem(GUIDE_CONTENT_KEY,encoded)}catch(error){return rejected('persistence','rule-guide-storage',`指南写盘失败，原发布版及当前输入保留：${String(error)}`,'action-guide-maintain',['retry'])}
      accepted=encoded;rawContent.value=encoded;state.value=next;external.value=false;contentError.value='';return {ok:true}
    }))
  }
  function saveDraft(input:GuideOverride,expected:number){const draft=clone(input);return commit(expected,next=>{next.drafts[draft.articleId]={...asOverride(draft),status:guideArticles.find(a=>a.id===draft.articleId)?.status==='business-pending'?'business-pending':'review'}})}
  function publish(id:string,expected:number,reviewed=false){return commit(expected,next=>{
    const draft=next.drafts[id];if(!draft)throw Error('先保存草稿，再预览和发布。')
    const content={...asOverride(draft),status:guideArticles.find(a=>a.id===id)?.status==='business-pending'?'business-pending' as const:reviewed?'verified' as const:'review' as const}
    if(reviewed&&(!content.evidence.length||!content.implementation.trim()))throw Error('请填写核验依据和适用实现。')
    if(next.published[id])next.previous[id]=clone(next.published[id]!)
    next.published[id]={content,revision:(next.published[id]?.revision||guideArticles.find(a=>a.id===id)!.revision)+1,updatedAt:new Date().toISOString(),author:owner.value};delete next.drafts[id]
  })}
  function restorePrevious(id:string,expected:number){return commit(expected,next=>{
    const previous=next.previous[id],current=next.published[id];if(!previous||!current)throw Error('没有可恢复的上一发布版。')
    next.published[id]={...clone(previous),revision:current.revision+1,author:owner.value,updatedAt:new Date().toISOString()};next.previous[id]=clone(current)
  })}
  function exportBackup(){if(!catalog.can('system:guide:update'))throw Error('没有指南维护权限。');return JSON.stringify({schema:1,kind:'erp-business-guide',articles:Object.values(state.value.published).map(p=>clone(p.content)),drafts:Object.values(state.value.drafts).map(clone)},null,2)}
  function previewImport(text:string){
    if(!catalog.can('system:guide:update'))return {ok:false,message:'没有指南维护权限。'}
    try{if(text.length>3_000_000)throw Error('指南备份过大。');const value=JSON.parse(text);if(!value||value.schema!==1||value.kind!=='erp-business-guide'||Object.keys(value).some(k=>!['schema','kind','articles','drafts'].includes(k))||!Array.isArray(value.articles)||!Array.isArray(value.drafts))throw Error('仅支持指南说明备份，不能导入业务数据或授权。')
      for(const list of [value.articles,value.drafts]){const ids=new Set<string>();for(const row of list){const issues=overrideProblems(row);if(issues.length)throw Error(issues.join(' '));if(ids.has(row.articleId))throw Error('指南备份包含重复文章ID。');ids.add(row.articleId)}}
      return {ok:true,revision:state.value.revision,basis:accepted,articles:clone(value.articles) as GuideOverride[],drafts:clone(value.drafts) as GuideOverride[]}
    }catch(error){return {ok:false,message:String(error)}}
  }
  function importBackup(text:string,expected:number){const preview=previewImport(text);if(!preview.ok)return Promise.resolve({ok:false,message:preview.message});return commit(expected,next=>{
    for(const content of preview.articles!){const old=next.published[content.articleId];if(old)next.previous[content.articleId]=clone(old);next.published[content.articleId]={content,revision:(old?.revision||guideArticles.find(a=>a.id===content.articleId)!.revision)+1,updatedAt:new Date().toISOString(),author:owner.value}}
    for(const draft of preview.drafts!)next.drafts[draft.articleId]={...draft,status:guideArticles.find(a=>a.id===draft.articleId)?.status==='business-pending'?'business-pending':'review'}
  },true)}
  function personal(edit:(p:GuideProgress)=>void):Promise<Result>{
    const captured=actor(),id=owner.value,key=GUIDE_PROGRESS_PREFIX+encodeURIComponent(id)
    return serial(()=>lock(key,()=>{
      if(!sameActor(captured)||owner.value!==id||catalog.previewUserId||!catalog.can('system:guide:read'))return rejected('permission','rule-guide-permission','身份已变化或处于权限预览，本次未记录个人进度。','action-guide-progress')
      if(progressError.value)return {ok:false,message:'个人记录损坏，原始内容保留；请先导出并恢复。'}
      const raw=localStorage.getItem(key);if(raw!==progressAccepted)return rejected('conflict','rule-guide-conflict','个人记录已在其他窗口更新，请读取最新后重试。','action-guide-progress',['read-latest'])
      const next=clone(progress.value);edit(next);if(progressProblem(next,id))throw Error('个人记录结构无效。')
      const encoded=JSON.stringify(next);try{localStorage.setItem(key,encoded)}catch(error){return rejected('persistence','rule-guide-storage',`个人记录未保存：${String(error)}`,'action-guide-progress',['retry'])};progressAccepted=encoded;rawProgress.value=encoded;progress.value=next;return {ok:true}
    }))
  }
  function favorite(id:string){if(!article(id))return Promise.resolve({ok:false,message:'文章不存在。'});return personal(p=>{p.favorites=p.favorites.includes(id)?p.favorites.filter(v=>v!==id):[...p.favorites,id]})}
  function mark(id:string,kind:'read'|'practiced',done=true){const a=article(id);if(!a)return Promise.resolve({ok:false,message:'文章不存在。'});return personal(p=>{if(done)p[kind][id]=a.revision;else delete p[kind][id]})}
  function remember(id:string){const a=article(id);if(!a)return Promise.resolve({ok:false,message:'文章不存在。'});return personal(p=>{p.recent=[{id,revision:a.revision,at:new Date().toISOString()},...p.recent.filter(r=>r.id!==id)].slice(0,20)})}
  function restoreProgress(text:string){const captured=actor(),id=owner.value,key=GUIDE_PROGRESS_PREFIX+encodeURIComponent(id);return serial(()=>lock(key,()=>{if(!sameActor(captured)||catalog.previewUserId||!catalog.can('system:guide:read'))return {ok:false,message:'身份变化，未恢复。'};const candidate=JSON.parse(text);if(progressProblem(candidate,id))return {ok:false,message:'个人记录schema或owner不匹配。'};const encoded=JSON.stringify(candidate);localStorage.setItem(key,encoded);progress.value=candidate;progressAccepted=encoded;rawProgress.value=encoded;progressError.value='';return {ok:true}}))}
  const onStorage=(event:StorageEvent)=>{if(event.key===GUIDE_CONTENT_KEY)external.value=true;if(event.key===GUIDE_PROGRESS_PREFIX+encodeURIComponent(owner.value))progressError.value='个人记录已在其他窗口更新，请读取最新。'}
  if(typeof window!=='undefined')window.addEventListener('storage',onStorage);onScopeDispose(()=>{if(typeof window!=='undefined')window.removeEventListener('storage',onStorage)})
  return {state:readonly(state),articles,article,editable,contentError:readonly(contentError),external:readonly(external),rawContent:readonly(rawContent),owner,progress:readonly(progress),progressError:readonly(progressError),rawProgress:readonly(rawProgress),refresh:load,refreshProgress:loadProgress,saveDraft,publish,restorePrevious,exportBackup,previewImport,importBackup,favorite,mark,remember,restoreProgress}
})
