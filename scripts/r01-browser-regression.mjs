import { spawnSync } from 'node:child_process'
import { mkdirSync,writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const root=resolve(process.env.R01_REGRESSION_OUTPUT || 'work/r01-20261025/browser-regression');mkdirSync(root,{recursive:true})
const checks=['spu-sku','editor-safety','template-compatibility','template-compatibility-import'];const results=[]
for(const check of checks){
  const dir=resolve(root,check);mkdirSync(dir,{recursive:true})
  const run=spawnSync(process.execPath,[`scripts/browser-${check}.mjs`],{encoding:'utf8',env:{...process.env,BROWSER_CHANNEL:'chrome',SPU_SKU_OUTPUT_DIR:dir,EDITOR_SAFETY_OUTPUT_DIR:dir,TEMPLATE_BROWSER_OUTPUT:dir,TEMPLATE_IMPORT_BROWSER_OUTPUT:dir}})
  writeFileSync(resolve(dir,'output.txt'),(run.stdout||'')+(run.stderr||''));results.push({check,exitCode:run.status,error:run.error?.message});console.log(`${run.status===0?'PASS':'FAIL'} browser ${check}`)
}
writeFileSync(resolve(root,'results.json'),JSON.stringify(results,null,2));if(results.some(r=>r.exitCode!==0))process.exitCode=1
