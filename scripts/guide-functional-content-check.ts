import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {guideArticles,guidePages} from '../src/domain/guide/registry'
import {guideManualContents} from '../src/domain/guide/content/manuals'
import {guidePageEntryLabel,guidePageTarget,pageManual} from '../src/domain/guide/readModel'
import {routePermissions} from '../src/domain/rbac'

const articles=new Map(guideArticles.map(article=>[article.id,article])),identities=new Set<string>()
let rows=0,restrictions=0
assert.deepEqual(Object.keys(guideManualContents).sort(),guidePages.map(page=>page.id).sort(),'every registered page has an authored manual, with no orphan manuals')
for(const page of guidePages){
 const content=guideManualContents[page.id]!,manual=pageManual(page.id)!
 assert(content.purpose.trim(),`${page.id}: purpose`);assert(content.features.length,`${page.id}: real functions`)
 assert.equal(manual.purpose,content.purpose);assert.deepEqual(manual.featureRows,content.features);assert.deepEqual(manual.restrictionRows,content.restrictions)
 for(const [kind,list,fields]of [['feature',content.features,['title','description','operation','result']],['restriction',content.restrictions,['condition','effect','resolution']],['detail',content.details||[],['title']]] as const){
  for(const row of list){
   assert(row.id&&/^[a-z][a-z0-9-]*$/.test(row.id),`${page.id}: stable ${kind} identity`)
   const identity=`${page.id}:${kind}:${row.id}`;assert(!identities.has(identity),`duplicate ${identity}`);identities.add(identity)
   for(const field of fields){const text=(row as unknown as Record<string,string>)[field];assert(typeof text==='string'&&text.trim(),`${identity}:${field}`);assert(!/按现有约定|按原流程处理|具体步骤如下|实际以校验为准|不追溯重写已有快照或凭说明新增限制/.test(text),`${identity}:empty template prose`);assert(!/https?:\/\/localhost|127\.0\.0\.1/.test(text),`${identity}:hardcoded host`)}
   if('actionIds'in row)for(const id of row.actionIds||[])assert.equal(articles.get(id)?.kind,'action',`${identity}:missing action ${id}`)
   if('ruleIds'in row)for(const id of row.ruleIds||[])assert.equal(articles.get(id)?.kind,'rule',`${identity}:missing rule ${id}`)
   if('sections'in row){assert(row.sections.length,`${identity}: empty disclosure`);assert(row.sections.every(section=>section.paragraphs?.length||section.steps?.length||section.table?.rows.length),`${identity}: empty detail section`)}
  }
 }
 assert.deepEqual(manual.features[0]?.table?.rows,content.features.map(row=>[row.title,row.description,row.operation,row.result]))
 for(const related of manual.relatedPages){assert.equal(routePermissions(related.to.path,related.to.query)===null,false);assert.deepEqual(related.to,guidePageTarget(related.pageId));assert(related.reason.trim());assert.equal(related.entryLabel,guidePageEntryLabel(related.pageId));assert(!related.to.path.includes(':'))}
 rows+=content.features.length;restrictions+=content.restrictions.length
}
assert.equal(guidePageEntryLabel('page-spu-edit'),'前往列表选择 SPU')
assert.equal(guidePageEntryLabel('page-sku-edit'),'前往列表选择 SKU')
assert.equal(guidePageTarget('page-benefit-delivery')?.path,'/benefit-packages')
const reader=readFileSync('src/components/guide/GuideArticleReader.vue','utf8')
assert(reader.includes('GuideFeatureTable'));assert(reader.includes('manual.featureRows'));assert(reader.includes('manual.restrictionRows'))
assert(!/v-for="action in actions"|v-for="rule in rules"|watch\(|remember\(/.test(reader),'normal reading does not expand every old template or write reading records')
const model=readFileSync('src/domain/guide/readModel.ts','utf8');assert(!model.includes('distinctSections'),'curated content replaces string-based semantic deduplication')
console.log(`PASS authored guide content: ${guidePages.length} pages, ${rows} stable function rows, ${restrictions} specific restrictions; references and safe destinations intact`)
