import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { guideArticles, guidePages, guideFlows } from '../src/domain/guide/registry'
import { guideReferenceProblems } from '../src/domain/guide/validation'
const articles=new Map(guideArticles.map(a=>[a.id,a]))
assert.equal(guideReferenceProblems().length,0,guideReferenceProblems().join('\n'))
const required=['purpose','objects','prerequisites','actions','steps','results','rules','failures','examples','verification']
for(const p of guidePages){const a=articles.get(p.articleId)!;assert(a);for(const id of required)assert(a.sections.some(s=>s.id===id),p.id+':'+id);for(const file of p.source)assert(existsSync(file),file)}
for(const a of guideArticles){assert(a.sections.every(s=>(s.paragraphs?.length||s.steps?.length||s.table?.rows.length)),a.id);if(a.status==='verified')assert(a.evidence.length&&a.implementation,a.id);if(a.kind==='rule')assert(a.sections.find(s=>s.id==='conditions')?.table?.rows.length,a.id);for(const p of a.pageIds)assert(guidePages.some(v=>v.id===p),a.id+':'+p)}
assert(guideFlows.length>=8)
const router=readFileSync('src/router/index.ts','utf8')
const componentRoutes=[...router.matchAll(/\{ path: '([^']*)'.*component: \(\) => import\('\.\.\/views\/([^']+)'\)/g)].map(m=>'/'+m[1])
for(const path of componentRoutes)assert(guidePages.some(p=>p.patterns.includes(path)),path)
mkdirSync('work/business-guide',{recursive:true})
const result={result:'PASS',componentRoutes:componentRoutes.length,pageFamilies:guidePages.length,formal:guidePages.filter(p=>p.formal).length,actions:guideArticles.filter(a=>a.kind==='action').length,rules:guideArticles.filter(a=>a.kind==='rule').length,flows:guideFlows.length,referenceProblems:guideReferenceProblems(),statusCounts:guideArticles.reduce((v,a)=>({...v,[a.status]:(v[a.status]||0)+1}),{} as Record<string,number>)}
writeFileSync('work/business-guide/content-check.json',JSON.stringify(result,null,2))
console.log(result)
