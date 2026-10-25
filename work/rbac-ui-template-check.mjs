import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parse, compileTemplate } from '@vue/compiler-sfc'
const files=execFileSync('git',['-c','safe.directory=D:/单子/商城erp/mock/iyge-v2-mock','diff','--name-only'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(f=>f.endsWith('.vue'))
let bad=0
for(const f of files){const {descriptor,errors}=parse(readFileSync(f,'utf8'),{filename:f});if(errors.length){console.log(f,errors);bad++}if(descriptor.template){const r=compileTemplate({source:descriptor.template.content,filename:f,id:'rbac'});if(r.errors.length){console.log(f,r.errors);bad++}}}
console.log('templates checked',files.length,'errors',bad);if(bad)process.exit(1)
