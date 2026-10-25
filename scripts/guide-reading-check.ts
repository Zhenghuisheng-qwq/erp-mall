import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {createPinia,setActivePinia} from 'pinia'
import {guideArticles,guidePages} from '../src/domain/guide/registry'
import {guideDirectory,guidePageTarget,pageManual} from '../src/domain/guide/readModel'
import {guidePageFor,safeGuideReturn} from '../src/domain/guide/routeMap'
import {useGuideStore} from '../src/stores/guide'
import {defaultMenuNodes,sanitizeMenu} from '../src/domain/menuConfig'
import {ensureRbac,rbacProblems,routePermissions} from '../src/domain/rbac'
import {createSeed} from '../src/domain/seed'
import {featureSheet} from '../src/domain/pageFeatures'

let groups=0
const oldKeys=new Map([['iyge-guide-content-v1','{old-unpublished-draft'],['iyge-guide-progress-v1:demo-super-admin','{old-personal-record']])
let guideReads=0,storageWrites=0
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>{if(key.startsWith('iyge-guide-'))guideReads++;return oldKeys.get(key)||null},setItem:()=>{storageWrites++;throw Error('Reading must never write storage')},removeItem:()=>{storageWrites++;throw Error('Reading must never remove storage')}}})
const check=(name:string,run:()=>void)=>{run();groups++}
try{
  const articles=new Map(guideArticles.map(a=>[a.id,a])),pages=new Map(guidePages.map(p=>[p.id,p]))
  check('content references',()=>{
    assert.equal(articles.size,guideArticles.length);assert.equal(pages.size,guidePages.length)
    for(const a of guideArticles){for(const id of [...a.actionIds,...a.ruleIds,...a.related])assert(articles.has(id),`${a.id}:missing ${id}`);for(const id of a.pageIds)assert(pages.has(id),`${a.id}:missing page ${id}`);assert(a.sections.every(s=>s.id!=='verification'),`${a.id}:retired verification prose`)}
    for(const p of guidePages){const manual=pageManual(p.id);assert(manual,`${p.id}:missing manual`);assert(manual.features.length,`${p.id}:no functions`);assert(p.actionIds.every(id=>articles.has(id)));for(const related of manual.relatedPages){assert(pages.has(related.pageId));assert(related.reason.trim());assert(['upstream','downstream','related'].includes(related.kind));assert.deepEqual(related.to,guidePageTarget(related.pageId))}}
    assert(!guidePages.some(p=>p.patterns.some(path=>path.includes('/guide/learn')||path==='/guide/manage')))
    assert(!guideArticles.some(a=>/^action-guide-(learn|progress|maintain|draft|publish|import)$/.test(a.id)))
  })
  check('canonical page and relationship destinations',()=>{
    const source=readFileSync('src/router/index.ts','utf8'),routes=source.split('\n').filter(line=>line.includes('component: () => import')).map(line=>'/'+(/path:\s*'([^']*)'/.exec(line)?.[1]||'')),staticRoutes=new Set(routes.filter(path=>!path.includes(':')))
    for(const route of routes)assert(guidePageFor(route.replace(/:[a-zA-Z]+/g,'actual-id')),`unmapped ${route}`)
    for(const p of guidePages){const target=guidePageTarget(p.id);assert(target&&staticRoutes.has(target.path),`${p.id}:not an object-independent registered route`);assert(routePermissions(target.path,target.query)!==null)}
    assert.equal(guidePageTarget('page-material-edit')?.path,'/spus');assert.equal(guidePageTarget('page-benefit-delivery')?.path,'/benefit-packages')
    assert.equal(guidePageFor('/spus',{panel:'columns'})?.id,'page-columns-spu');assert.equal(guidePageFor('/skus',{panel:'columns'})?.id,'page-columns-sku')
    assert.equal(guidePageFor('/columns')?.id,'page-columns-spu');assert.equal(guidePageFor('/products/new')?.id,'page-spu-create')
    const relation=pageManual('page-templates')!.relatedPages.find(p=>p.pageId==='page-params');assert.equal(relation?.kind,'upstream')
    assert(pageManual('page-benefit-edit')!.relatedPages.some(p=>p.pageId==='page-benefit-delivery'&&p.kind==='downstream'))
    for(const bad of ['//evil.test','/spus/%5cfoo','/guide/manage','/spus?returnTo=/guide','https://evil.test','/missing'])assert.equal(safeGuideReturn(bad,()=>true),'/')
  })
  check('real menu ordering, rename, grouping, hiding',()=>{
    const nodes=defaultMenuNodes(),sku=nodes.find(n=>n.route==='/skus')!,spu=nodes.find(n=>n.route==='/spus')!;sku.title='自定义销售规格名称';sku.sort=-20;spu.hidden=true
    nodes.push({id:'guide-test-group',title:'自定义目录组',kind:'group',parentId:'product',sort:0,route:'',hidden:false,roles:['admin','operator'],custom:true});sku.parentId='guide-test-group'
    const directory=guideDirectory(sanitizeMenu(nodes)),items=directory.flatMap(c=>[...c.items,...c.groups.flatMap(g=>g.items)])
    assert(items.some(item=>item.page.id==='page-skus'&&item.title===sku.title));assert(directory.some(c=>c.groups.some(g=>g.title==='自定义目录组'&&g.items[0]?.page.id==='page-skus')))
    assert(!items.some(item=>item.menuId===spu.id),'hidden menu must not reappear as a menu entry')
    assert(items.some(item=>item.page.id==='page-spu-edit'),'hidden/dynamic manuals remain findable independently')
  })
  check('legacy feedback and permission compatibility',()=>{
    const feedback=featureSheet('/menus');assert(feedback?.features.some(f=>f.id==='/menus:role'))
    assert(!feedback?.features.some(f=>f.summary.includes('设置运营可访问')))
    const d=createSeed();ensureRbac(d);assert.deepEqual(rbacProblems(d),[]);assert(d.rbac!.permissions.some(p=>p.code==='system:guide:update'));assert.deepEqual(routePermissions('/guide/manage'),['system:guide:read']);assert.deepEqual(routePermissions('/guide/articles/manual-categories'),['system:guide:read'])
  })
  check('read-only Store has no storage side effects or retired APIs',()=>{
    setActivePinia(createPinia());const guide=useGuideStore(),old=[...oldKeys]
    for(const p of guidePages){assert(guide.article(p.articleId));pageManual(p.id)}
    for(const key of ['remember','favorite','mark','progress','saveDraft','publish','importBackup','exportBackup','refresh'])assert.equal((guide as unknown as Record<string,unknown>)[key],undefined,key)
    assert.equal(guideReads,0);assert.equal(storageWrites,0);assert.deepEqual([...oldKeys],old)
    const source=readFileSync('src/stores/guide.ts','utf8');assert(!/\b(?:localStorage|sessionStorage|watch)\s*[.(]/.test(source));guide.$dispose()
  })
  if(process.argv.includes('--artifacts')){mkdirSync('work/guide-reading',{recursive:true});writeFileSync('work/guide-reading/check.json',JSON.stringify({result:'PASS',groups,pages:guidePages.length},null,2))}
  console.log(`PASS read-only page explanations: ${groups} groups, ${guidePages.length} pages`)
}catch(error){console.error(`FAIL page explanations: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1}
