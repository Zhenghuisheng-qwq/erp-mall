import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import{existsSync,mkdirSync,writeFileSync}from'node:fs'
import{resolve}from'node:path'
import{cpus}from'node:os'
import{createServer}from'vite'
const baseline=resolve(process.env.REFINEMENT_BASELINE||'work/compatibility-refinement/baseline/source'),output=resolve(process.env.COMPATIBILITY_EDIT_PERFORMANCE_OUTPUT||'work/compatibility-refinement/edit-performance')
if(!existsSync(resolve(baseline,'src/domain/templateCompatibility.ts')))throw new Error(`Missing start-of-task baseline: ${baseline}. Set REFINEMENT_BASELINE to the recorded complete source.`)
mkdirSync(output,{recursive:true});const servers=[],samples=[];const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex'),median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
try{
  const modules=[]
  for(const root of[baseline,resolve('.')]){const server=await createServer({root,configFile:false,cacheDir:resolve(output,modules.length?'after-cache':'before-cache'),server:{middlewareMode:true,hmr:false},appType:'custom'});servers.push(server);modules.push(await server.ssrLoadModule('/src/domain/templateCompatibility.ts'))}
  const{createTemplateCompatibilityFixture}=await servers[0].ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  for(const[name,width]of[['small',2],['medium',8],['large',16]]){
    const f=createTemplateCompatibilityFixture({styles:width,colors:width,packs:width}),original=hash(f.data),edits=12,timings={before:[],after:[]},counts={},outputs={}
    for(const[phase,api]of[['before',modules[0]],['after',modules[1]]])for(let run=-1;run<5;run++){
      const draft=structuredClone(f.config);let context,expansions=0;const start=performance.now()
      const structure=phase==='after'?api.createTemplateCompatibilityContext(f.data,{modelId:f.modelId,config:api.createEmptyTemplateCompatibilityConfig(f.modelId)}):undefined
      if(structure)expansions+=structure.stats.combinationExpansions
      for(let edit=0;edit<edits;edit++){draft.defaultRule.claims[0].source+='验';context=phase==='before'?api.createTemplateCompatibilityContext(f.data,{modelId:f.modelId,config:draft}):api.prepareTemplateCompatibilityConfig(f.data,structure,draft);expansions+=context.stats.combinationExpansions}
      const elapsed=performance.now()-start;if(run>=0)timings[phase].push(elapsed);counts[phase]=expansions;outputs[phase]=hash(context.combinations.map(combo=>api.resolveTemplateCompatibility(context,combo)))
    }
    assert.equal(outputs.before,outputs.after,'full final results, identities and order must match baseline');assert.equal(hash(f.data),original,'inputs remain unchanged');assert.equal(counts.before,edits);assert.equal(counts.after,1)
    samples.push({name,nodes:f.data.productSpecNodes.filter(node=>node.templateId===f.modelId).length,depth:4,combinations:width**3,historyPlanning:f.data.planningRecords.length,historyDeclarations:f.data.compatibilities.length,edits,rounds:5,warmup:1,beforeMs:timings.before,afterMs:timings.after,beforeMedianMs:median(timings.before),afterMedianMs:median(timings.after),combinationExpansions:counts,finalResultSha256:outputs.after,inputUnchanged:true})
  }
  const result={result:'PASS',baseline,environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model},method:'Domain microbenchmark of 12 successive evidence edits: original createContext vs one structural context plus fresh prepare per edit. Includes one after structural build; one warmup plus five measured rounds; final full effective results compared by SHA256 outside timed edit loop. This is not end-to-end typing latency or a UI FPS claim.',samples};writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
}finally{for(const server of servers)await server.close()}
