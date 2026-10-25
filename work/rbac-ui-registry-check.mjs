import {createServer} from 'vite'
import {readdirSync,readFileSync} from 'node:fs'
const server=await createServer({server:{watch:null}})
try{const {permissionRegistry}=await server.ssrLoadModule('/src/domain/rbac.ts');const known=new Set(permissionRegistry().map(p=>p.code));const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]);let missing=[];for(const p of walk('src').filter(p=>/\.(vue|ts)$/.test(p))){for(const m of readFileSync(p,'utf8').matchAll(/(?:store|catalog)\.can\('([^']+)'\)/g))if(!known.has(m[1]))missing.push({p,code:m[1]})}console.log(JSON.stringify(missing,null,2));if(missing.length)process.exitCode=1}finally{await server.close()}
