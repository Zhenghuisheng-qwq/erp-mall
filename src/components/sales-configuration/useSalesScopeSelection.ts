import { computed, ref, watch, type ComputedRef } from 'vue'
import { selectorForCombination, selectorForNode, templateSelectorCoverage, type TemplateCompatibilityContext } from '../../domain/templateCompatibility'
import { salesSignature } from '../../domain/salesConfiguration'
import type { TemplateSpecSelector, TemplateSpecTerm } from '../../domain/templateCompatibilityTypes'

type Method = 'values' | 'specs'
type Proposal = { selector: TemplateSpecSelector; valueIds: string[]; added: string[]; removed: string[] }
const copy = <T>(value:T):T => JSON.parse(JSON.stringify(value))
const sameCoverage = (a:Set<string>,b:Set<string>) => a.size===b.size && [...a].every(id=>b.has(id))

/** This state is used by the actual picker. The accepted selector and unfinished input
 * remain separate: failed edits and method previews never publish a replacement scope. */
export function useSalesScopeSelection(input:{
  context:ComputedRef<TemplateCompatibilityContext>
  modelValue:()=>TemplateSpecSelector|undefined
  sourceKey:()=>string
  initialNodeId:()=>string|undefined
},update:(selector:TemplateSpecSelector|undefined)=>void,validity:(valid:boolean)=>void){
  const method=ref<Method>('values'),valueIds=ref<string[]>([]),identities=ref<string[]>([]),message=ref('')
  const proposal=ref<Proposal>(),accepted=ref<TemplateSpecSelector>(),invalidInput=ref(false)
  const valid=computed(()=>!invalidInput.value&&!proposal.value)
  // A Store update may rebuild the context object without changing this source.
  // Only identities/coverage/validation changes may reset or recheck scope input.
  const contextStamp=computed(()=>{const context=input.context.value;return salesSignature([
    context.modelId,context.versionId,
    [...context.byNode.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(node=>[node.id,node.nodeType,node.parentId,node.attributeId,node.valueId]),
    [...context.terms.values()].sort((a,b)=>a.valueNodeId.localeCompare(b.valueNodeId)),[...context.combinations].sort((a,b)=>a.identityKey.localeCompare(b.identityKey)).map(combo=>[combo.identityKey,combo.steps.map(step=>[step.attributeNodeId,step.attributeId,step.valueNodeId,step.valueId,step.parentValueNodeId])]),
    context.issues.map(issue=>issue.message).sort(),
  ])})
  let echo:string|undefined,initialized=false

  function valuesSelector(ids:string[]):{selector?:TemplateSpecSelector;message:string}{
    const grouped=new Map<string,TemplateSpecTerm[]>()
    for(const id of ids){
      const term=input.context.value.terms.get(id)
      if(!term)return {message:'所选属性值不属于当前模型版本，请重新核对；原范围已保留。'}
      grouped.set(term.attributeNodeId,[...(grouped.get(term.attributeNodeId)||[]),term])
    }
    let groups:TemplateSpecTerm[][]=[[]]
    for(const choices of grouped.values()){
      if(groups.length*choices.length>500)return {message:'条件组合超过 500 项。未应用本次输入，原范围已保留；请减少属性值。'}
      groups=groups.flatMap(group=>choices.map(term=>[...group,term]))
    }
    return {selector:grouped.size?{anyOf:copy(groups)}:undefined,message:''}
  }
  function coverage(selector:TemplateSpecSelector|undefined){
    return selector?templateSelectorCoverage(input.context.value,selector):{identities:new Set<string>(),message:''}
  }
  function valueRepresentation(selector:TemplateSpecSelector|undefined){
    const ids=selector?[...new Set(selector.anyOf.flatMap(group=>group.map(term=>term.valueNodeId)))]:[]
    const built=valuesSelector(ids),original=coverage(selector),proposed=coverage(built.selector)
    return {ids,...built,original,proposed,lossless:!built.message&&!original.message&&!proposed.message&&sameCoverage(original.identities,proposed.identities)}
  }
  function restore(selector:TemplateSpecSelector|undefined){
    accepted.value=selector?copy(selector):undefined;proposal.value=undefined;invalidInput.value=false;message.value=''
    const represented=valueRepresentation(selector)
    identities.value=[...represented.original.identities]
    valueIds.value=represented.ids
    method.value=represented.lossless?'values':'specs'
    if(represented.original.message){message.value=`${represented.original.message} 原范围保留，请核对后明确重新选择。`;invalidInput.value=true}
  }
  function publish(selector:TemplateSpecSelector|undefined){
    accepted.value=selector?copy(selector):undefined
    echo=salesSignature(selector);update(selector?copy(selector):undefined)
  }
  function setValues(ids=valueIds.value){
    valueIds.value=[...ids];proposal.value=undefined
    const built=valuesSelector(ids)
    message.value=built.message;invalidInput.value=!!built.message
    if(built.message)return
    const range=coverage(built.selector)
    if(range.message){message.value=`${range.message} 未应用本次输入，原范围已保留。`;invalidInput.value=true;return}
    identities.value=[...range.identities];publish(built.selector)
  }
  function setSpecs(ids=identities.value){
    identities.value=[...ids];proposal.value=undefined
    if(ids.length>500){message.value='完整规格超过 500 项。未应用本次输入，原范围已保留；请减少选择。';invalidInput.value=true;return}
    const combos=ids.map(id=>input.context.value.byIdentity.get(id))
    if(combos.some(combo=>!combo)){message.value='所选规格不属于当前模型版本。未应用本次输入，原范围已保留。';invalidInput.value=true;return}
    message.value='';invalidInput.value=false
    publish(combos.length?{anyOf:combos.flatMap(combo=>selectorForCombination(combo!).anyOf)}:undefined)
  }
  function requestMethod(next:Method){
    if(next===method.value){proposal.value=undefined;return}
    if(invalidInput.value){message.value+=' 请先处理未应用的输入，再切换选择方式。';return}
    proposal.value=undefined;message.value=''
    if(next==='specs'){
      identities.value=[...coverage(accepted.value).identities];method.value=next;return
    }
    const represented=valueRepresentation(accepted.value)
    if(represented.lossless){valueIds.value=represented.ids;method.value=next;return}
    if(represented.message||!represented.selector){message.value=represented.message||'当前范围无法转换，请保留完整规格方式编辑。';return}
    proposal.value={selector:represented.selector,valueIds:represented.ids,
      added:[...represented.proposed.identities].filter(id=>!represented.original.identities.has(id)),
      removed:[...represented.original.identities].filter(id=>!represented.proposed.identities.has(id))}
  }
  function cancelMethod(){proposal.value=undefined;message.value=''}
  function confirmMethod(){
    const next=proposal.value;if(!next)return
    valueIds.value=[...next.valueIds];identities.value=[...coverage(next.selector).identities]
    method.value='values';proposal.value=undefined;message.value='';invalidInput.value=false;publish(next.selector)
  }
  watch(valid,value=>validity(value),{immediate:true,flush:'sync'})
  watch(()=>[input.sourceKey(),contextStamp.value,salesSignature(input.modelValue())] as const,([key,stamp,signature],previous)=>{
    const sourceChanged=!previous||key!==previous[0],contextChanged=sourceChanged||stamp!==previous?.[1]
    if(previous&&!contextChanged&&signature===previous[2])return
    if(!contextChanged&&signature===echo){echo=undefined;return}
    echo=undefined
    if(!sourceChanged&&contextChanged&&signature===previous?.[2]&&(invalidInput.value||proposal.value)){
      proposal.value=undefined;invalidInput.value=true;message.value='来源规格已变化。未应用的输入及原范围已保留，请核对后调整选择。';return
    }
    const first=!initialized;initialized=true
    const selector=input.modelValue(),context=input.context.value
    if(selector){restore(selector);return}
    if((first||key!==previous?.[0])&&input.initialNodeId()&&context.byNode.get(input.initialNodeId()!)?.nodeType==='VALUE'){
      const result=selectorForNode(context,input.initialNodeId()!);restore(result.selector)
      if(result.message){message.value=result.message;invalidInput.value=true}else publish(result.selector)
    }else restore(undefined)
  },{immediate:true,flush:'sync'})
  return {method,valueIds,identities,message,proposal,valid,accepted,setValues,setSpecs,requestMethod,cancelMethod,confirmMethod}
}
