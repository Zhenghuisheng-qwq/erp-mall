import assert from 'node:assert/strict'
import {computed,effectScope,ref,shallowRef} from 'vue'
import {createTemplateCompatibilityFixture} from './template-compatibility-fixtures'
import {salesBindingContext,salesSignature} from '../src/domain/salesConfiguration'
import {selectorForCombination,selectorForNode,templateSelectorCoverage,type TemplateCompatibilityContext} from '../src/domain/templateCompatibility'
import type {TemplateSpecSelector} from '../src/domain/templateCompatibilityTypes'
import {useSalesScopeSelection} from '../src/components/sales-configuration/useSalesScopeSelection'

let groups=0
const mark=(name:string)=>{groups++;console.log(`PASS scope component: ${name}`)}
const f=createTemplateCompatibilityFixture(),context=salesBindingContext(f.data,f.modelId,f.versionId)
const find=(...values:string[])=>context.combinations.find(combo=>values.every(id=>combo.steps.some(step=>step.valueNodeId===id)))!
const first=find('compat-style-0','compat-color-0-0','compat-pack-0'),second=find('compat-style-0','compat-color-0-1','compat-pack-1')
const diagonal={anyOf:[...selectorForCombination(first).anyOf,...selectorForCombination(second).anyOf]}
const coverage=(value:TemplateSpecSelector|undefined,c=context)=>value?[...templateSelectorCoverage(c,value).identities].sort():[]
function mount(value?:TemplateSpecSelector,c=context,node?:string){
  const scope=effectScope(),model=ref(value),source=ref('frozen-v1'),prepared=shallowRef(c),updates:(TemplateSpecSelector|undefined)[]=[],validities:boolean[]=[]
  const state=scope.run(()=>useSalesScopeSelection({context:computed(()=>prepared.value),modelValue:()=>model.value,sourceKey:()=>source.value,initialNodeId:()=>node},next=>{updates.push(next);model.value=next},valid=>validities.push(valid)))!
  return {scope,model,source,prepared,updates,validities,state}
}
{
 const m=mount(diagonal);assert.equal(m.state.method.value,'specs');assert.deepEqual(m.state.identities.value.sort(),[first.identityKey,second.identityKey].sort());assert.equal(m.updates.length,0)
 assert.equal(salesSignature(m.model.value),salesSignature(diagonal));m.scope.stop()
 const reopened=mount(diagonal);assert.deepEqual(coverage(reopened.model.value),coverage(diagonal));assert.equal(reopened.updates.length,0);reopened.scope.stop()
 mark('correlated OR save/reopen is exact and initialization never rewrites the selector')
}
{
 const m=mount(diagonal);m.state.setSpecs([second.identityKey]);assert.deepEqual(coverage(m.model.value),[second.identityKey]);assert.equal(m.state.method.value,'specs');assert.equal(m.updates.length,1)
 m.state.setSpecs([first.identityKey]);assert.deepEqual(coverage(m.model.value),[first.identityKey]);m.scope.stop()
 mark('removing one full spec cannot introduce another Cartesian combination; parent echo retains editing method')
}
{
 const m=mount(diagonal);m.state.requestMethod('values');assert.equal(m.state.method.value,'specs');assert.equal(m.state.valid.value,false);assert.equal(m.state.proposal.value?.added.length,2);assert.equal(m.state.proposal.value?.removed.length,0);assert.equal(m.updates.length,0)
 m.state.cancelMethod();assert.equal(m.state.valid.value,true);assert.deepEqual(coverage(m.model.value),coverage(diagonal))
 m.state.requestMethod('values');m.state.confirmMethod();assert.equal(m.state.method.value,'values');assert.equal(m.state.valid.value,true);assert.equal(coverage(m.model.value).length,4);assert.equal(m.updates.length,1);m.scope.stop()
 mark('lossy method switch previews additions/removals, cancellation preserves range, explicit redefinition applies exactly once')
}
{
 const node=selectorForNode(context,'compat-style-0').selector!,m=mount(node);assert.equal(m.state.method.value,'values');assert.deepEqual(m.state.valueIds.value,['compat-style-0']);assert.equal(coverage(m.model.value).length,4)
 m.state.requestMethod('specs');assert.equal(m.state.identities.value.length,4);assert.equal(m.updates.length,0)
 m.state.requestMethod('values');assert.deepEqual(m.state.valueIds.value,['compat-style-0']);assert.equal(salesSignature(m.model.value),salesSignature(node));m.scope.stop()
 mark('lossless attribute range and sibling multiplication retain their original selector across method switches')
}
{
 const branchA=find('compat-style-0','compat-color-0-0','compat-pack-0'),branchB=find('compat-style-1','compat-color-1-1','compat-pack-1')
 const branches={anyOf:[...selectorForCombination(branchA).anyOf,...selectorForCombination(branchB).anyOf]},m=mount(branches)
 assert.equal(m.state.method.value,'specs');assert.deepEqual(coverage(m.model.value),[branchA.identityKey,branchB.identityKey].sort());m.state.setSpecs([branchB.identityKey]);assert.deepEqual(coverage(m.model.value),[branchB.identityKey]);m.scope.stop()
 mark('conditional branches use real attribute/value node identities instead of name-based regrouping')
}
{
 const m=mount(diagonal);m.state.requestMethod('values');assert(m.state.proposal.value)
 m.model.value=selectorForNode(context,'compat-pack-0').selector;assert.equal(m.state.proposal.value,undefined);assert.equal(m.state.method.value,'values');assert.deepEqual(m.state.valueIds.value,['compat-pack-0'])
 m.model.value=diagonal;assert.equal(m.state.method.value,'specs');assert.deepEqual(m.state.identities.value.sort(),[first.identityKey,second.identityKey].sort())
 m.model.value=undefined;assert.deepEqual(m.state.valueIds.value,[]);assert.deepEqual(m.state.identities.value,[]);assert.equal(m.updates.length,0);m.scope.stop()
 const initial=mount(undefined,context,'compat-style-0');assert.equal(initial.updates.length,1);assert.equal(coverage(initial.model.value).length,4);initial.model.value=undefined;assert.equal(initial.updates.length,1);assert.equal(initial.model.value,undefined);initial.scope.stop()
 mark('parent replacement and explicit clear restore state; initial node selection is applied only on source initialization')
}
{
 const large=createTemplateCompatibilityFixture({styles:1,colors:23,packs:23}),c=salesBindingContext(large.data,large.modelId,large.versionId),original=selectorForNode(c,'compat-pack-0').selector!
 const m=mount(original,c),ids=[...c.terms.keys()].filter(id=>id.startsWith('compat-color-0-')||id.startsWith('compat-pack-'))
 m.state.setValues(ids);assert.equal(m.state.valid.value,false);assert.equal(m.updates.length,0);assert.deepEqual(m.state.valueIds.value,ids);assert.equal(salesSignature(m.model.value),salesSignature(original));assert.match(m.state.message.value,/500.*原范围已保留/)
 m.prepared.value={...c,byNode:new Map([...c.byNode].reverse()),terms:new Map([...c.terms].reverse()),combinations:[...c.combinations].reverse(),stats:{...c.stats}};assert.equal(m.state.valid.value,false);assert.deepEqual(m.state.valueIds.value,ids);assert.equal(m.updates.length,0);assert.match(m.state.message.value,/500/)
 m.state.requestMethod('specs');assert.deepEqual(m.state.valueIds.value,ids);assert.equal(m.state.method.value,'values')
 const reduced=ids.filter(id=>!['compat-pack-21','compat-pack-22'].includes(id));m.state.setValues(reduced);assert.equal(m.state.valid.value,true);assert.equal(coverage(m.model.value,c).length,483)
 m.state.requestMethod('specs');m.state.setSpecs(c.combinations.map(combo=>combo.identityKey));assert.equal(m.state.valid.value,false);assert.equal(coverage(m.model.value,c).length,483);assert.equal(m.state.identities.value.length,529);m.scope.stop()
 mark('over-limit edits retain valid scope and unfinished input across unrelated context rebuilds, then recover on correction')
}
{
 const m=mount(diagonal),broken={...context,byNode:new Map(context.byNode),terms:new Map(context.terms),combinations:context.combinations,byIdentity:new Map(context.byIdentity)} as TemplateCompatibilityContext
 broken.byNode.delete('compat-color-0-0');broken.terms.delete('compat-color-0-0');m.prepared.value=broken
 assert.equal(m.updates.length,0);assert.equal(salesSignature(m.model.value),salesSignature(diagonal));assert.equal(m.state.valid.value,false);m.scope.stop()
 mark('changed version context never silently translates an invalid historical node range')
}
console.log(`PASS sales scope component ${groups} groups`)
