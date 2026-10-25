import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import {installCatalogTestLocks} from './catalog-storage-test-env'
import {createSeed} from '../src/domain/seed'
import {ensureRbac,routePermissions} from '../src/domain/rbac'
import {DATA_VERSION,STORAGE_KEY,type AppData} from '../src/domain/types'
import {normalizeStored,useCatalogStore} from '../src/stores/catalog'
import {useGuideStore,GUIDE_CONTENT_KEY,GUIDE_PROGRESS_PREFIX} from '../src/stores/guide'
import {guideArticles,guidePages,guideFlows} from '../src/domain/guide/registry'
import {guideReferenceProblems} from '../src/domain/guide/validation'
import {guidePageFor,safeGuideReturn} from '../src/domain/guide/routeMap'
import {searchGuide} from '../src/domain/guide/search'
import {RBAC_ENFORCEMENT_ENABLED as strict} from '../src/domain/accessMode'
import {getFailure} from '../src/domain/guide/failure'
const out=`work/business-guide/checks/${strict?'strict':'default'}`;mkdirSync(out,{recursive:true})
const disk=new Map<string,string>(),session=new Map<string,string>(),checks:string[]=[],clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v)),restore=installCatalogTestLocks()
let quotaKey='',catalog:ReturnType<typeof useCatalogStore>,guide:ReturnType<typeof useGuideStore>
const stores:{c:ReturnType<typeof useCatalogStore>;g:ReturnType<typeof useGuideStore>}[]=[]
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)??null,setItem:(k:string,v:string)=>{if(k===quotaKey)throw new DOMException('guide quota','QuotaExceededError');disk.set(k,v)},removeItem:(k:string)=>disk.delete(k)}})
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:(k:string)=>session.get(k)??null,setItem:(k:string,v:string)=>session.set(k,v),removeItem:(k:string)=>session.delete(k)}})
function data(){const d=normalizeStored({version:DATA_VERSION,data:createSeed()})!;ensureRbac(d);for(const [id,permissions]of Object.entries({reader:['system:guide:read'],writer:['system:guide:read','system:guide:update'],sales:['product:spu:read','product:spu:update']})){d.rbac!.roles.push({id:`guide-${id}`,code:`guide-${id}`,name:id,description:'guide isolation',enabled:true,permissionCodes:permissions});d.users.push({id:`guide-${id}`,username:`guide-${id}`,displayName:id,enabled:true,role:'operator',roleIds:[`guide-${id}`]})}return d}
async function open(user='u-admin',reset=false){if(reset){for(const s of stores){s.g.$dispose();s.c.$dispose()}stores.length=0;disk.clear();session.clear();disk.set(STORAGE_KEY,JSON.stringify({version:DATA_VERSION,data:data()}))}session.set('iyge-rbac-simulated-user',user);setActivePinia(createPinia());catalog=useCatalogStore();await catalog.waitForPersistence();guide=useGuideStore();stores.push({c:catalog,g:guide});return {c:catalog,g:guide}}
const mark=(name:string)=>{checks.push(name);console.log(`PASS guide ${strict?'strict':'default'} ${name}`)}
const raw=()=>disk.get(STORAGE_KEY),edit=(id=guideArticles.find(a=>a.kind==='page')!.id)=>guide.editable(id)!
async function denied(fn:()=>unknown){let result;try{result=await fn()}catch(error){result={ok:false,message:String(error)}}assert.equal((result as {ok:boolean}).ok,false);return result}
try{
  assert.deepEqual(guideReferenceProblems(),[])
  assert(guideFlows.length>=8)
  const routeSource=readFileSync('src/router/index.ts','utf8'),routes=routeSource.split('\n').filter(line=>line.includes('component: () => import')).map(line=>'/'+(/path:\s*'([^']*)'/.exec(line)?.[1]||''))
  for(const path of routes){assert(guidePageFor(path.replace(/:[a-zA-Z]+/g,'example')),`route lacks manual ${path}`)}
  for(const p of guidePages.filter(p=>p.formal)){const manual=guideArticles.find(a=>a.id===p.articleId)!;assert(manual.sections.length>=10,`${p.id} missing manual fields`);assert(manual.sections.every(s=>(s.paragraphs?.length||s.steps?.length||s.table?.rows.length)),`${p.id} empty placeholder`);assert(p.actionIds.length,`${p.id} lacks actual query/action`)}
  assert.equal(guidePageFor('/skus',{panel:'columns'})?.patterns.includes('/skus?panel=columns'),true)
  assert.equal(guidePageFor('/columns')?.id,guidePageFor('/spus',{panel:'columns'})?.id)
  assert.equal(guidePageFor('/products/new')?.id,guidePageFor('/spus/new')?.id)
  assert.equal(guidePageFor('/materials/real-family',{sku:'record-id'})?.id,guidePageFor('/materials/example')?.id)
  for(const value of ['https://evil.test','//evil.test','/\\evil','/spus/%5cfoo','/spus/%0afoo','/guide?returnTo=/guide','/unknown','/spus?returnTo=//evil'])assert.equal(safeGuideReturn(value,()=>true),'/')
  assert.equal(safeGuideReturn('/spus?panel=columns',()=>true),'/spus?panel=columns');assert.equal(safeGuideReturn('/spus',l=>l.path==='/guide'),'/guide')
  mark('complete route inventory, dynamic/query/legacy mapping, references, ten-part manuals, eight learning paths and safe return URLs')

  const legacy=data(),beforeBusiness=clone(legacy);delete legacy.rbac!.guideAccessVersion
  legacy.rbac!.permissions=legacy.rbac!.permissions.filter(p=>p.resource!=='guide');legacy.rbac!.roles.forEach(r=>r.permissionCodes=r.permissionCodes.filter(code=>!code.startsWith('system:guide:')))
  const custom=clone(legacy.rbac!.roles.find(r=>r.id==='guide-sales')!);ensureRbac(legacy);const migrated=JSON.stringify(legacy);ensureRbac(legacy);assert.equal(JSON.stringify(legacy),migrated);assert.deepEqual(legacy.rbac!.roles.find(r=>r.id===custom.id),custom)
  assert(legacy.rbac!.roles.find(r=>r.id==='role:operator')!.permissionCodes.includes('system:guide:read'));assert(legacy.rbac!.roles.find(r=>r.id==='role:super-admin')!.permissionCodes.includes('system:guide:update'))
  const businessAfter=clone(legacy);delete businessAfter.rbac;delete beforeBusiness.rbac;assert.deepEqual(businessAfter,beforeBusiness)
  const corrupt=clone(legacy);corrupt.rbac!.permissions=corrupt.rbac!.permissions.filter(p=>p.resource!=='guide');if(strict)assert.throws(()=>ensureRbac(corrupt));
  mark('versioned guide capability migration is idempotent and limited to built-in roles; custom roles and business stay intact')

  await open('u-admin',true);let original=raw()!,draft=edit();const id=draft.articleId,title=guide.article(id)!.title
  draft.title='核验指南隔离标题';assert((await guide.saveDraft(draft,guide.state.revision)).ok);assert.equal(guide.state.drafts[id]!.status,'review');assert.equal(guide.article(id)!.title,title);assert.equal(searchGuide(guide.articles,'核验指南隔离标题').length,0)
  assert((await guide.publish(id,guide.state.revision,true)).ok);assert.equal(guide.article(id)!.title,draft.title);assert(searchGuide(guide.articles,'核验指南隔离标题').some(a=>a.id===id));assert.equal(raw(),original)
  mark('draft remains private; explicit reviewed publish updates shared readers/search once and never writes business payload')

  const before=JSON.stringify(guide.state),stored=disk.get(GUIDE_CONTENT_KEY);draft=edit(id);draft.summary+=' 失败草稿原文';const copy=clone(draft);quotaKey=GUIDE_CONTENT_KEY;const quota=await guide.saveDraft(draft,guide.state.revision);assert.equal(quota.ok,false);assert.equal(getFailure(quota)?.ruleId,'rule-guide-storage');assert.equal(getFailure(quota)?.savedState,'unchanged');assert.equal(JSON.stringify(guide.state),before);assert.equal(disk.get(GUIDE_CONTENT_KEY),stored);assert.deepEqual(draft,copy);quotaKey='';assert((await guide.saveDraft(draft,guide.state.revision)).ok)
  quotaKey=GUIDE_CONTENT_KEY;assert.equal((await guide.publish(id,guide.state.revision)).ok,false);assert.equal(guide.article(id)!.summary,guideArticles.find(a=>a.id===id)!.summary);quotaKey='';assert((await guide.publish(id,guide.state.revision)).ok)
  assert((await guide.restorePrevious(id,guide.state.revision)).ok);assert.equal(guide.article(id)!.summary,guideArticles.find(a=>a.id===id)!.summary);assert.equal(raw(),original)
  mark('quota failures retain original publication/state/raw and editable input; retry and explicit previous-publication recovery are atomic')

  const first=guide,second=(await open()).g,secondDraft=second.editable(id)!,secondInput=clone(secondDraft),secondRevision=second.state.revision
  draft=first.editable(id)!;draft.summary+=' 第一个窗口';assert((await first.saveDraft(draft,first.state.revision)).ok)
  const rejected=await second.saveDraft(secondDraft,secondRevision);assert(!rejected.ok&&rejected.conflict);assert.equal(getFailure(rejected)?.ruleId,'rule-guide-conflict');assert.deepEqual(secondDraft,secondInput);second.refresh();assert((await second.saveDraft(secondDraft,second.state.revision)).ok);guide=second
  mark('two independent Store windows reject stale revisions without replacing input; explicit reload and review can continue')

  const backup=guide.exportBackup(),badCases=[JSON.stringify({schema:1,kind:'erp-business-guide',articles:[edit(id),edit(id)],drafts:[]}),JSON.stringify({schema:1,kind:'erp-business-guide',articles:[{...edit(id),title:'<script>alert(1)</script>'}],drafts:[]}),JSON.stringify({schema:1,kind:'erp-business-guide',articles:[{...edit(id),ruleIds:['forged']}],drafts:[]}),JSON.stringify({schema:2,kind:'erp-business-guide',articles:[],drafts:[]}),JSON.stringify({schema:1,kind:'erp-business-guide',data:data(),articles:[],drafts:[]})]
  const saved=disk.get(GUIDE_CONTENT_KEY);for(const bad of badCases){assert(!guide.previewImport(bad).ok);await denied(()=>guide.importBackup(bad,guide.state.revision));assert.equal(disk.get(GUIDE_CONTENT_KEY),saved)}
  assert(guide.previewImport(backup).ok);assert((await guide.importBackup(backup,guide.state.revision)).ok);assert.equal(raw(),original)
  const rule=guide.articles.find(a=>a.kind==='rule'&&a.status!=='business-pending')!,altered=edit(rule.id);altered.sections.find(s=>s.id==='conditions')!.title+=' 篡改';assert(!guide.previewImport(JSON.stringify({schema:1,kind:'erp-business-guide',articles:[altered],drafts:[]})).ok)
  const pending=guide.articles.find(a=>a.status==='business-pending')!;assert(pending);const pendingDraft={...edit(pending.id),status:'verified' as const};assert(!guide.previewImport(JSON.stringify({schema:1,kind:'erp-business-guide',articles:[pendingDraft],drafts:[]})).ok)
  mark('guide-only import preview rejects duplicate IDs, dangerous text, forged bindings, schema and business payload; valid restore stays independent')

  await open('guide-reader');const readOnly=guide,readerRaw=disk.get(GUIDE_CONTENT_KEY)
  if(strict){await denied(()=>readOnly.saveDraft(edit(),readOnly.state.revision));assert.equal(disk.get(GUIDE_CONTENT_KEY),readerRaw);assert(!catalog.can('product:spu:update'))}else assert((await readOnly.saveDraft(edit(),readOnly.state.revision)).ok)
  await open('guide-writer');if(strict){assert(!catalog.can('product:spu:update'));assert(!catalog.can('system:user:update'));assert(!catalog.canRoute({path:'/spus'}))}assert(catalog.canRoute({path:'/guide/manage'}));assert.deepEqual(routePermissions('/guide/articles/stable-id'),['system:guide:read'])
  mark('strict guide reader/writer and product permissions stay separate; default mode remains uniform administrator')

  await open('u-admin');const who=guide.owner,progressKey=GUIDE_PROGRESS_PREFIX+encodeURIComponent(who),pubRev=guide.article(id)!.revision;assert((await guide.favorite(id)).ok);assert((await guide.mark(id,'read')).ok);assert((await guide.mark(id,'practiced')).ok);assert((await guide.remember(id)).ok);assert.equal(guide.progress.read[id],pubRev)
  const progressBefore=disk.get(progressKey);quotaKey=progressKey;assert(!(await guide.favorite(id)).ok);assert.equal(disk.get(progressKey),progressBefore);quotaKey=''
  const preview=catalog.startPermissionPreview('guide-reader');assert(preview.ok);assert(!(await guide.mark(id,'read')).ok);assert.equal(disk.get(progressKey),progressBefore);catalog.stopPermissionPreview()
  draft=edit(id);draft.summary+=' 新修订';assert((await guide.saveDraft(draft,guide.state.revision)).ok);assert((await guide.publish(id,guide.state.revision,true)).ok);assert.equal(guide.progress.read[id],pubRev);assert(guide.article(id)!.revision>pubRev)
  assert.equal(raw(),original);if(strict){await open('guide-reader');assert.equal(guide.progress.favorites.length,0);assert.equal(guide.owner,'guide-reader')}
  mark('owner-isolated favorites/read/practice/recent; preview never writes another identity; revision changes preserve old progress and expose review need')

  await open('u-admin');const queued=guide.saveDraft(edit(),guide.state.revision);assert(catalog.simulateUser('guide-reader').ok);assert(!(await queued).ok)
  mark('queued writes recheck captured identity inside lock; switching user cannot persist under a different author')

  await open('u-admin',true);original=raw()!;disk.set(GUIDE_CONTENT_KEY,'{damaged-json');guide.refresh();assert(guide.contentError);assert.equal(guide.rawContent,'{damaged-json');assert(guide.articles.length);assert(!(await guide.saveDraft(edit(),0)).ok);assert.equal(disk.get(GUIDE_CONTENT_KEY),'{damaged-json')
  assert((await guide.importBackup(JSON.stringify({schema:1,kind:'erp-business-guide',articles:[],drafts:[]}),0)).ok);assert(!guide.contentError)
  const key=GUIDE_PROGRESS_PREFIX+encodeURIComponent(guide.owner);disk.set(key,'broken-personal-json');guide.refreshProgress();assert(guide.progressError);assert(!(await guide.favorite(id)).ok);assert.equal(disk.get(key),'broken-personal-json');assert((await guide.restoreProgress(JSON.stringify({schema:1,owner:guide.owner,favorites:[],read:{},practiced:{},recent:[]}))).ok);assert.equal(raw(),original)
  mark('damaged JSON is retained and exportable, built-in reading survives; explicit valid content/personal recovery never alters business data')
  writeFileSync(`${out}/result.json`,JSON.stringify({status:'PASS',strict,checks,pages:guidePages.length,formalPages:guidePages.filter(p=>p.formal).length,articles:guideArticles.length,flows:guideFlows.length},null,2))
}finally{for(const s of stores){s.g.$dispose();s.c.$dispose()};restore()}
