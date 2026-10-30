import type { AppData, Sku } from '../domain/types'
import { isMaterialArchive } from '../domain/catalogIdentity'
import { templateAccessResource } from '../domain/rbac'

/** Guard legacy in-place editors as well as commands. Every collection mutation is checked before applying it. */
export function catalogPublicData(data: AppData, can: (code:string)=>boolean): AppData {
  const rootToken = {}, caches = new Map<string,WeakMap<object,WeakMap<object,any>>>(), originals = new WeakMap<object,object>()
  const resource: Record<string,string> = {benefitTypeGroups:'product:type-bundle',benefitSalesLists:'product:bundle-sale',families:'product:spu',skus:'product:sku',categories:'product:category',productTypes:'product:type',templates:'product:template',templateParams:'product:template',mappings:'product:template',productSpecNodes:'product:model',specCanvases:'product:model',specModelVersions:'product:model',params:'product:dictionary',rules:'product:rule',brands:'product:brand',productGroups:'product:group',productPlans:'product:planning',planningRecords:'product:planning',materialReceipts:'product:material',materialRelations:'product:material',users:'system:user',feedbacks:'system:feedback',profile:'system:account'}
  const uiKeys = new Set(['productListPages','productListViews','activeProductListViewId','columns','listViews','activeViewId','listQuery','productListMode','mode'])
  function commandOnly(root:string) {
    if(['publicSpuPool','compatibilities','generalCompatibilityClaims','deviceModels','deviceBindings','nodeCompatibilityRules','templateCompatibilityConfigs','benefitTypeGroups','benefitSalesLists','specModelVersions','materialReceipts','materialContributions','templateCompatibilityOrigins'].includes(root))throw Error('历史快照和来源记录只允许受控命令维护。')
    if(root==='rbac'||root==='users'||root==='activeRole')throw Error('授权和用户只能通过受控保存命令修改；旧身份字段不再控制权限。')
  }
  function prefix(root:string,row?:any) {
    if(root==='skus'&&row&&isMaterialArchive(data,row as Sku))return 'product:material'
    if(['templates','templateParams','mappings'].includes(root)&&row)return `product:${templateAccessResource(data,root==='templates'?row:String(row.templateId || ''))}`
    return resource[root]
  }
  function check(root:string, action='update', row?:any) {
    commandOnly(root)
    if(uiKeys.has(root)){if(can('product:spu:read')||can('product:sku:read'))return;throw Error('没有列表查看权限。')}
    const code=prefix(root,row),operation=['templateParams','mappings'].includes(root)?'update':action
    if(!code||!can(`${code}:${operation}`))throw Error(`未授权操作：${code||root}:${operation}`)
  }
  function publication(root:string,old:any,next:any) {
    if(root==='families'&&old&&(old.shelfStatus!==next?.shelfStatus||old.lifecycle!==next?.lifecycle)&&!can('product:spu:publish'))throw Error('没有商品发布／上下架权限。')
  }
  const same=(a:any,b:any)=>a===b||JSON.stringify(a)===JSON.stringify(b)
  const unwrap=(value:any):any=>value&&typeof value==='object'?(originals.get(value)||value):value
  /** Top-level rows have their own create/delete identities; nested arrays edit their existing owning record. */
  function transition(root:string,old:any[],next:any[],owner?:any,top=false) {
    commandOnly(root)
    if(!top){check(root,'update',owner);return}
    const countIds=(rows:any[])=>{const counts=new Map<string,number>();for(const row of rows)if(row&&typeof row.id==='string')counts.set(row.id,(counts.get(row.id)||0)+1);return counts}
    const oldCounts=countIds(old),nextCounts=countIds(next)
    for(const [id,count] of nextCounts)if(count>1&&count>(oldCounts.get(id)||0))throw Error('不能新增重复 ID 的集合记录，请通过受控保存命令核对身份。')
    const byId=new Map(old.filter(row=>row&&typeof row.id==='string').map(row=>[row.id,row]))
    const nextIds=new Set(next.filter(row=>row&&typeof row.id==='string').map(row=>row.id))
    let changed=false
    for(const row of next){
      const before=row&&typeof row.id==='string'?byId.get(row.id):old.find(value=>value===row)
      if(before===undefined){check(root,'create',row);changed=true}
      else if(!same(before,row)){publication(root,before,row);check(root,'update',before);check(root,'update',row);changed=true}
    }
    for(const row of old){if(row&&typeof row.id==='string'?!nextIds.has(row.id):!next.includes(row)){check(root,'delete',row);changed=true}}
    // A reorder changes collection order, not MAT/SKU identities or saved record contents.
    if(!changed&&!same(old,next))check(root,'update',owner)
  }
  function applyArray(target:any[],next:any[]) {
    for(let i=0;i<next.length;i++)Reflect.set(target,String(i),next[i])
    Reflect.set(target,'length',next.length)
  }
  function integer(value:any) {const number=Number(value);return Number.isNaN(number)||number===0?0:Math.trunc(number)}
  function spliceRange(length:number,args:any[]) {
    const n=integer(args[0]),start=n===-Infinity?0:n<0?Math.max(length+n,0):Math.min(n,length)
    const count=args.length===0?0:args.length===1?length-start:Math.min(Math.max(integer(args[1]),0),length-start)
    return {start,count}
  }
  function copyForCompare(value:any,seen=new WeakMap<object,any>()):any {
    if(!value||typeof value!=='object')return value
    if(seen.has(value))return seen.get(value)
    const copy:any=Array.isArray(value)?[]:{};seen.set(value,copy)
    for(const key of Object.keys(value))copy[key]=copyForCompare(value[key],seen)
    return copy
  }
  function readOnly(value:any,seen=new WeakMap<object,any>()):any {
    if(!value||typeof value!=='object')return value
    if(seen.has(value))return seen.get(value)
    const fail=()=>{throw Error('排序比较函数只允许读取记录。')}
    const proxy=new Proxy(value,{get:(target,key)=>readOnly(Reflect.get(target,key),seen),set:fail,deleteProperty:fail,defineProperty:fail})
    seen.set(value,proxy);return proxy
  }
  const indexOf=(key:PropertyKey)=>typeof key==='string'&&/^(0|[1-9]\d*)$/.test(key)&&Number(key)<4294967295?Number(key):null
  function wrap(value:any,root:string,owner?:any,top=false):any {
    if(!value||typeof value!=='object')return value
    const map=caches.get(root)||new WeakMap<object,WeakMap<object,any>>();caches.set(root,map)
    const owned=map.get(value)||new WeakMap<object,any>();map.set(value,owned)
    const token=owner&&typeof owner==='object'?owner:rootToken
    if(owned.has(token))return owned.get(token)
    const proxy=new Proxy(value,{
      get(target,key){
        if(Array.isArray(target)&&key!=='constructor'&&typeof (Array.prototype as any)[key]==='function')return (...args:any[])=>{
          const method=String(key),old=Array.prototype.slice.call(target) as any[]
          if(['push','unshift','pop','shift','splice','sort','reverse','fill','copyWithin'].includes(method)){
            commandOnly(root)
            if(method==='fill'||method==='copyWithin')throw Error('集合批量替换只能通过受控保存命令。')
            const next=old.slice();let result:any
            if(method==='push'||method==='unshift')result=(Array.prototype as any)[key].apply(next,args.map(unwrap))
            else if(method==='pop'||method==='shift')result=(Array.prototype as any)[key].apply(next,args)
            else if(method==='splice'){const {start,count}=spliceRange(old.length,args);result=next.splice(start,count,...args.slice(2).map(unwrap))}
            else if(method==='reverse')next.reverse()
            else {
              check(root,'update',owner)
              if(args[0]!==undefined&&typeof args[0]!=='function')throw TypeError('排序比较函数必须是函数。')
              const compare=args[0],copies=new WeakMap<object,any>(),readonly=new WeakMap<object,any>()
              next.sort(compare?(a,b)=>compare(readOnly(copyForCompare(a,copies),readonly),readOnly(copyForCompare(b,copies),readonly)):undefined)
            }
            transition(root,old,next,owner,top)
            applyArray(target,next)
            if(method==='sort'||method==='reverse')return proxy
            if(method==='push'||method==='unshift')return result
            return wrap(result,root,top?(Array.isArray(result)?undefined:result):owner,top&&Array.isArray(result))
          }
          // Native readers run against the receiver proxy, including callback values and iterators.
          return (Array.prototype as any)[key].apply(proxy,args)
        }
        const result=Reflect.get(target,key)
        if(typeof key==='symbol'||String(key).startsWith('__v_'))return result
        return wrap(result,root,top&&Array.isArray(target)&&result&&typeof result==='object'?unwrap(result):owner,false)
      },
      set(target,key,input){
        commandOnly(root)
        const nextValue=unwrap(input)
        if(Array.isArray(target)){
          const old=Array.prototype.slice.call(target) as any[],next=old.slice(),index=indexOf(key)
          if(key==='length'){
            Reflect.set(next,'length',nextValue) // validates native array length before touching the live collection.
            if(next.length>old.length)throw Error('不能使用 length 创建空记录。')
          }else if(index!==null){if(index>old.length)throw Error('不能跳过索引创建空记录。');next[index]=nextValue}
          else {check(root,'update',owner);return Reflect.set(target,key,nextValue)}
          transition(root,old,next,owner,top);applyArray(target,next);return true
        }
        if(root==='families'&&(key==='shelfStatus'||key==='lifecycle')&&!can('product:spu:publish'))throw Error('没有商品发布／上下架权限。')
        check(root,'update',owner)
        if(owner===target&&typeof key==='string')check(root,'update',{...owner,[key]:nextValue})
        return Reflect.set(target,key,nextValue)
      },
      deleteProperty(target,key){
        commandOnly(root)
        const candidate=Array.isArray(target)?Array.prototype.slice.call(target):{...target}
        Reflect.deleteProperty(candidate,key)
        if(Array.isArray(target)){const index=indexOf(key);if(index!==null)check(root,top?'delete':'update',top?target[index]:owner);else check(root,'update',owner)}
        else {
          const nextOwner=owner===target?candidate:owner
          publication(root,owner,nextOwner)
          check(root,'update',owner)
          check(root,'update',nextOwner)
        }
        return Reflect.deleteProperty(target,key)
      },
    })
    owned.set(token,proxy);originals.set(proxy,value);return proxy
  }
  return new Proxy(data,{
    get(target,key){if(key==='publicSpuPool'&&!can('product:type-bundle:read')&&!can('product:bundle-sale:read'))return undefined;if(key==='benefitTypeGroups'&&!can('product:type-bundle:read')||key==='benefitSalesLists'&&!can('product:bundle-sale:read'))return undefined;const value=Reflect.get(target,key);return typeof key==='string'&&!key.startsWith('__v_')?wrap(value,key,undefined,Array.isArray(value)):value},
    set(target,key,input){
      const unwrapped=unwrap(input),value=Array.isArray(unwrapped)?unwrapped.map(unwrap):unwrapped
      if(typeof key==='string'){
        commandOnly(key)
        const old=(target as any)[key]
        if(Array.isArray(old)){if(!Array.isArray(value))throw Error('集合必须保留数组结构。');transition(key,old,value.map(unwrap),undefined,true)}
        else if(Array.isArray(value))transition(key,[],value.map(unwrap),undefined,true)
        else check(key)
      }
      return Reflect.set(target,key,value)
    },
    deleteProperty(target,key){commandOnly(String(key));const value=(target as any)[key];if(Array.isArray(value))transition(String(key),value,[],undefined,true);else check(String(key),'delete');return Reflect.deleteProperty(target,key)},
  })
}
