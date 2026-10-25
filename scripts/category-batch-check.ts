import assert from 'node:assert/strict'
import {categoryMovesCandidate,normalizeCategoryMoveSources,previewCategoryMoves,previewCategoryMove} from '../src/domain/categoryMovement'
import {childrenOfParent,moveCategoryNode,relocateCategoryNodes} from '../src/domain/categoryTree'
import type {Category} from '../src/domain/types'
const make=(id:string,parentId:string|null,sort:number):Category=>({id,name:id,parentId,sort,enabled:true})
const initial=()=>[make('root',null,1),make('a','root',1),make('a-child','a',1),make('a-leaf','a-child',1),make('b','root',2),make('c','root',3),make('target',null,2),make('existing-1','target',1),make('existing-2','target',2),make('typed',null,3)]
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));let groups=0
{
 const categories=initial(),before=clone(categories),result=normalizeCategoryMoveSources(categories,['a-child','b','a','b','a-leaf'])
 assert.deepEqual(result,{requestedIds:['a-child','b','a','a-leaf'],sourceIds:['a','b'],merged:[{id:'a-child',ancestorId:'a'},{id:'a-leaf',ancestorId:'a'}]});assert.deepEqual(categories,before)
 const plan=categoryMovesCandidate(categories,{sourceIds:result.requestedIds,targetId:'target'},new Set())
 assert(plan.preview.ok);assert.deepEqual(plan.preview.movedIds,['a','b']);assert.deepEqual(childrenOfParent(plan.categories,'target').map(n=>n.id),['existing-1','existing-2','a','b']);assert.deepEqual(plan.categories.filter(n=>['a-child','a-leaf'].includes(n.id)),before.filter(n=>['a-child','a-leaf'].includes(n.id)));assert.deepEqual(categories,before);groups++
}
{
 const categories=initial(),noOp=previewCategoryMoves(categories,{sourceIds:['a','b'],targetId:'root'},new Set());assert(noOp.ok&&!noOp.changed);assert.deepEqual(noOp.skippedIds,['a','b'])
 const mixed=categoryMovesCandidate(categories,{sourceIds:['existing-2','b','a','existing-1'],targetId:'target'},new Set());assert(mixed.preview.ok);assert.deepEqual(mixed.preview.skippedIds,['existing-2','existing-1']);assert.deepEqual(mixed.preview.movedIds,['b','a']);assert.deepEqual(childrenOfParent(mixed.categories,'target').map(n=>n.id),['existing-1','existing-2','b','a']);groups++
}
{
 for(const request of [{sourceIds:['b','missing'],targetId:'target'},{sourceIds:['a','b'],targetId:'a'},{sourceIds:['b','a'],targetId:'a-leaf'},{sourceIds:['a','b'],targetId:'missing'},{sourceIds:['a','b'],targetId:'typed'}]){const categories=initial(),before=clone(categories),r=previewCategoryMoves(categories,request,new Set(['typed']));assert(!r.ok&&!r.changed);assert(r.failure?.context);assert.equal(r.failure?.savedState,'unchanged');assert.deepEqual(categories,before)}
 for(const sourceIds of [[],[''],[null] as any])assert(!previewCategoryMoves(initial(),{sourceIds,targetId:'target'},new Set()).ok)
 const cycle=initial();cycle.find(n=>n.id==='a')!.parentId='a-child';assert(!previewCategoryMoves(cycle,{sourceIds:['a'],targetId:'target'},new Set()).ok);groups++
}
{
 const typedSource=initial();typedSource.find(n=>n.id==='typed')!.enabled=false;const first=categoryMovesCandidate(typedSource,{sourceIds:['typed','a'],targetId:'target'},new Set(['typed']));assert(first.preview.ok)
 const second=categoryMovesCandidate(first.categories,{sourceIds:['typed','a'],targetId:null},new Set(['typed']));assert(second.preview.ok);assert.equal(second.categories.find(n=>n.id==='a')!.parentId,null);assert.equal(second.categories.find(n=>n.id==='a-child')!.parentId,'a');assert.deepEqual(second.preview.sourceIds,['typed','a']);groups++
}
{
 const categories=initial(),singlePreview=previewCategoryMove(categories,{id:'b',targetId:'target'},new Set());assert(singlePreview.changed);assert.equal(moveCategoryNode(categories,'b','target'),'');assert.equal(relocateCategoryNodes(categories,'b','existing-1','before'),'');assert.deepEqual(childrenOfParent(categories,'target').map(n=>n.id),['b','existing-1','existing-2']);groups++
}
console.log(`PASS category batch domain ${groups} groups`)
