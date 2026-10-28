import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import ts from 'typescript'
import {guideFailureBranches,guideFailureGaps} from '../src/domain/guide/failureRegistry'
import {guideArticles} from '../src/domain/guide/registry'
import {guideFailureCheckEvidence} from './guide-failure-store-check'
import {RBAC_ENFORCEMENT_ENABLED} from '../src/domain/accessMode'
const artifacts=process.argv.includes('--artifacts')

const scoped:Record<string,string[]>={
 'src/domain/categoryTree.ts':['moveCategoryNode'],
 'src/domain/logic.ts':['specPublishProblems'],
 'src/domain/material.ts':['resolveV3MaterialSpec','verifySteps','createV3Material','createTemporaryMaterial','deletedReceiptResult'],
 'src/domain/spuSku.ts':['saveSpu','previewSkuAppend','appendSkuBatch','editSku','skuConfigurationProblem'],
 'src/domain/materialRelationCommands.ts':['previewMaterialScope','executeMaterialRelation','revokeMaterialRelation'],
 'src/domain/templateCompatibilitySync.ts':['applyTemplateCompatibilitySync'],
 'src/stores/catalog.ts':['command','commitCandidate','commitCreated','commitDeviceBinding','importJson','publishSpecModel','commitCategoryMove'],
 'src/stores/catalogPersistence.ts':['run','write'],
}
const sites:{source:string;function:string;line:number;syntax:string;binding:'explicit'|'legacy-unknown'|'callback'|'pass-through';branchId?:string}[]=[]
for(const [file,names]of Object.entries(scoped)){
 const text=readFileSync(file,'utf8'),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true)
 function visit(node:ts.Node,scope=''){
   if(ts.isFunctionDeclaration(node)&&node.name)scope=node.name.text
   if(names.includes(scope)){
     const code=node.getText(source),line=source.getLineAndCharacterOfPosition(node.getStart(source)).line+1
     let include=false,binding:'explicit'|'legacy-unknown'|'callback'|'pass-through'='legacy-unknown',branchId:string|undefined
     if(ts.isReturnStatement(node)&&node.expression){const e=node.expression;include=ts.isObjectLiteralExpression(e)&&e.properties.some(p=>ts.isPropertyAssignment(p)&&p.name.getText(source)==='ok'&&p.initializer.kind===ts.SyntaxKind.FalseKeyword)||ts.isStringLiteral(e)&&e.text.length>0||ts.isCallExpression(e)&&['rejectGuide','fail'].includes(e.expression.getText(source));if(ts.isCallExpression(e)&&e.expression.getText(source)==='rejectGuide'){binding='explicit';const arg=e.arguments[0];if(arg&&ts.isStringLiteral(arg))branchId=arg.text}}
     if(ts.isThrowStatement(node)){include=true;binding=code.includes('failureError(')?'explicit':'legacy-unknown'}
     if(ts.isCallExpression(node)&&['throwImportValidation','throwImportPermission'].includes(node.expression.getText(source))){include=true;binding='explicit';branchId=node.expression.getText(source)==='throwImportValidation'?'import.json.validation':'command.permission'}
     if(ts.isCallExpression(node)&&scope==='specPublishProblems'&&node.expression.getText(source)==='problems.push'){include=true;binding='callback'}
     if(ts.isCallExpression(node)&&scope==='previewMaterialScope'&&node.expression.getText(source)==='reject'){include=true;binding='explicit';const arg=node.arguments[0];if(arg&&ts.isStringLiteral(arg))branchId=arg.text}
     if(include&&scope==='moveCategoryNode'&&node.parent.getText(source).includes('rejected?.'))binding='callback'
     if(include)sites.push({source:file,function:scope,line,syntax:code.slice(0,240),binding,...(branchId?{branchId}:{})})
   }
   ts.forEachChild(node,child=>visit(child,scope))
 }
 visit(source)
}
assert.equal(new Set(guideFailureBranches.map(b=>b.id)).size,guideFailureBranches.length)
const ids=new Set(guideArticles.map(a=>a.id));for(const b of guideFailureBranches){assert(ids.has(b.actionId),`missing action ${b.id}`);assert(!b.ruleId||ids.has(b.ruleId),`missing rule ${b.id}`);assert(existsSync(b.source.split(':')[0]!),`source missing ${b.source}`)}
const evidenceByBranch:Record<string,string[]>={}
const mode=RBAC_ENFORCEMENT_ENABLED?'strict':'default'
for(const check of guideFailureCheckEvidence)if(check.branchId)(evidenceByBranch[check.branchId]||=[]).push(`${mode}:${check.name}`)
const branches=guideFailureBranches.map(b=>({...b,validation:evidenceByBranch[b.id]?.length?evidenceByBranch[b.id]!.join('; '):'Source binding present; this specific branch has no dedicated Store assertion yet.'}))
const report={scope:'G4 first-batch refusal source sites; independent of guide article counts',denominator:{registeredBindings:branches.length,registeredBindingsWithDedicatedStoreEvidence:Object.keys(evidenceByBranch).length,scopedSyntacticRefusalSites:sites.length,explicitSites:sites.filter(s=>s.binding==='explicit').length,callbackSites:sites.filter(s=>s.binding==='callback').length,legacyUnknownSites:sites.filter(s=>s.binding==='legacy-unknown').length},notes:['The source-site denominator counts refusal statements in the named first-batch functions, not articles, route totals, or every boolean subexpression. Pass-through validators and their deeper internals are explicit gaps; this does not claim every ERP business branch is precisely bound.','Some refusal sites invoke one shared rule binding; registered binding count and syntactic source-site count are deliberately separate.','Dedicated Store evidence does not imply browser verification. Browser evidence is reported separately.','Legacy text-return helpers retain the original message. Unknown failures are never reclassified from message text.'],branches,gaps:guideFailureGaps,sites}
if(artifacts){mkdirSync('work/business-guide',{recursive:true});writeFileSync('work/business-guide/failure-branch-inventory.json',JSON.stringify(report))}
console.log(`PASS failure inventory ${mode} (${branches.length} bindings; ${Object.keys(evidenceByBranch).length} executed branches)`)
