import { execFileSync } from 'node:child_process'
import { mkdirSync,writeFileSync } from 'node:fs'
import { createServer } from 'vite'
const out='work/r01-20261025/plan-baseline';mkdirSync(out,{recursive:true})
const baseline=execFileSync('git',['-c','safe.directory=D:/单子/商城erp/mock/iyge-v2-mock','show','5a7a020e3b3f6bddbdbb2ada68ec88baa7f29d7a:src/domain/logic.ts'],{encoding:'utf8'})
const server=await createServer({configFile:false,cacheDir:`${out}/cache`,server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',plugins:[{name:'r01-original-logic',enforce:'pre',transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/domain/logic.ts'))return baseline}}]})
try {
  const {createTemplateCompatibilityFixture}=await server.ssrLoadModule('/scripts/template-compatibility-fixtures.ts')
  const {planSkuLines}=await server.ssrLoadModule('/src/domain/logic.ts')
  const f=createTemplateCompatibilityFixture();f.version.nodesSnapshot.find(n=>n.id==='compat-style').parentId='compat-pack-0'
  const result=planSkuLines(f.data,{productModelId:f.modelId,modelVersionId:f.versionId,selectedNodes:['compat-pack-0','compat-style-0']})
  if(!result?.skus.length || result.skus.some(s=>s.sourceNodeIds.includes('compat-pack-0')))throw Error('Original missing-COMMON reproduction not observed')
  writeFileSync(`${out}/result.json`,JSON.stringify({baseline:'5a7a020',reproduced:true,expectedSourcePrefix:['compat-pack-0','compat-style-0'],actual:result},null,2))
  console.log('REPRODUCED original planSkuLines: commonAttrs has 包装, but every sourceNodeIds omits compat-pack-0')
}finally{await server.close()}
