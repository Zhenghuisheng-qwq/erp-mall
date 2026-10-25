import { spawnSync } from 'node:child_process'
import { mkdirSync,writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const root=resolve(process.env.R01_REGRESSION_OUTPUT || 'work/r01-20261025/regression');mkdirSync(root,{recursive:true})
const checks=['r01-plan','r01-business','spu-sku','material','material-archive','naming','template-compatibility-domain','template-compatibility-state','sku-workbench-query','editor-safety','functional-gaps-round3','functional-gaps-round5','draft-combo','planning']
const results=[]
for(const check of checks){
  const dir=resolve(root,check);mkdirSync(dir,{recursive:true})
  const run=spawnSync(process.execPath,['scripts/run-domain-check.mjs',`scripts/${check}-check.ts`],{encoding:'utf8',env:{...process.env,DOMAIN_CHECK_CACHE_DIR:resolve(dir,'cache'),TEMPLATE_COMPATIBILITY_OUTPUT_DIR:dir,ROUND3_OUTPUT:dir,R01_DOMAIN_OUTPUT:dir}})
  writeFileSync(resolve(dir,'output.txt'),(run.stdout||'')+(run.stderr||''))
  results.push({check,exitCode:run.status,error:run.error?.message});console.log(`${run.status===0?'PASS':'FAIL'} ${check}`)
}
writeFileSync(resolve(root,'results.json'),JSON.stringify(results,null,2))
if(results.some(r=>r.exitCode!==0))process.exitCode=1
