import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync,createWriteStream} from 'node:fs'
import {resolve} from 'node:path'
const out=resolve('work/product-center-acceptance-20261025');mkdirSync(out,{recursive:true})
const suites=[
 ['browser-product-center-type-model','ACCEPTANCE_UNUSED_OUTPUT'],
 ['browser-product-center-list-create','ACCEPTANCE_UNUSED_OUTPUT'],
 ['browser-product-center-naming','ACCEPTANCE_UNUSED_OUTPUT'],
 ['browser-product-center-supplement','ACCEPTANCE_UNUSED_OUTPUT'],
 ['browser-r01-protection','R01_PROTECTION_BROWSER_OUTPUT'],
 ['browser-category-workspace','CATEGORY_WORKSPACE_OUTPUT'],
 ['browser-functional-gaps-round5','ROUND5_OUTPUT',{ROUND5_STAGE:'B'}],
 ['browser-editor-safety','EDITOR_SAFETY_OUTPUT_DIR'],
 ['browser-r01','R01_BROWSER_OUTPUT'],
 ['browser-spu-sku','SPU_SKU_OUTPUT_DIR'],
 ['browser-r02-repair','R02_BROWSER_OUTPUT'],
 ['browser-template-compatibility','TEMPLATE_BROWSER_OUTPUT'],
 ['browser-accessory-compatibility','ACCESSORY_BROWSER_OUTPUT'],
 ['browser-r02-repair-compatibility','R02_COMPAT_BROWSER_OUTPUT'],
 ['browser-sku-workbench','SKU_WORKBENCH_OUTPUT_DIR'],
 ['browser-benefit-packages','BENEFIT_BROWSER_OUTPUT'],
 ['browser-benefit-refinement','BENEFIT_REFINEMENT_BROWSER_OUTPUT'],
 ['browser-r03','R03_BROWSER_OUTPUT'],
 ['browser-r03-repair','R03_REPAIR_BROWSER_OUTPUT',{R03_REPAIR_FIXTURE_DIR:resolve(out,'r03-store')}],
]
const evidenceDirs={'browser-product-center-type-model':'type-model','browser-product-center-list-create':'list-create','browser-product-center-naming':'naming-conflict','browser-product-center-supplement':'supplement'}
const selected=process.env.ACCEPTANCE_SUITES?.split(',');const results=[]
// Rebuild isolated backups from the real Store for each acceptance run.
if(!selected||selected.some(name=>['browser-r03-repair','browser-product-center-supplement'].includes(name))){
 const log=createWriteStream(resolve(out,'r03-store.log'))
 const child=spawn(process.execPath,['scripts/run-domain-check.mjs','scripts/r03-repair-check.ts'],{env:{...process.env,R03_REPAIR_OUTPUT:resolve(out,'r03-store')},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log);child.stderr.pipe(log)
 const code=await new Promise(r=>child.on('close',r));log.end();if(code!==0)throw Error('Acceptance fixture Store checks failed')
}

for(const [name,key,extra] of suites){
 if(selected&&!selected.includes(name))continue
 const started=new Date().toISOString(),log=createWriteStream(resolve(out,name+'.log'));console.log('START '+name)
 const child=spawn(process.execPath,[`scripts/${name}.mjs`],{env:{...process.env,[key]:resolve(out,name),...extra},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log);child.stderr.pipe(log)
 const code=await new Promise(r=>child.on('close',r));log.end();results.push({name,started,finished:new Date().toISOString(),exit:code,evidence:`${evidenceDirs[name]||name}/`,log:`${name}.log`});writeFileSync(resolve(out,selected?'rerun-results.json':'browser-results.json'),JSON.stringify(results,null,2));console.log('END '+name+' exit='+code)
}
