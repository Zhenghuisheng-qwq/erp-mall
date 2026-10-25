import type { AppData } from '../domain/types'

/** Guard legacy in-place editors as well as commands. Authorization records are command-only. */
export function catalogPublicData(data: AppData, can: (code:string)=>boolean): AppData {
  const caches = new Map<string,WeakMap<object,any>>()
  const resource: Record<string,string> = {families:'product:spu',skus:'product:sku',categories:'product:category',productTypes:'product:type',templates:'product:model',templateParams:'product:template',mappings:'product:template',productSpecNodes:'product:model',specCanvases:'product:model',specModelVersions:'product:model',nodeCompatibilityRules:'product:model',templateCompatibilityConfigs:'product:model',templateCompatibilityOrigins:'product:compatibility',params:'product:dictionary',rules:'product:rule',brands:'product:brand',productGroups:'product:group',productPlans:'product:planning',planningRecords:'product:planning',materialReceipts:'product:material',materialRelations:'product:material',materialContributions:'product:material',compatibilities:'product:compatibility',deviceModels:'product:compatibility',deviceBindings:'product:compatibility',benefitPackages:'product:benefit',benefitDeliveries:'product:delivery',benefitFrameworks:'product:framework',users:'system:user',feedbacks:'system:feedback',profile:'system:account'}
  const uiKeys = new Set(['productListPages','productListViews','activeProductListViewId','columns','listViews','activeViewId','listQuery','productListMode','mode'])
  function check(root:string, action='update', row?:any) {
    if(['specModelVersions','benefitDeliveries','materialReceipts','materialContributions','templateCompatibilityOrigins'].includes(root))throw Error('历史快照和来源记录只允许受控命令维护。')
    if(root==='rbac'||root==='users'||root==='activeRole')throw Error('授权和用户只能通过受控保存命令修改；旧身份字段不再控制权限。')
    if(uiKeys.has(root)){if(can('product:spu:read')||can('product:sku:read'))return;throw Error('没有列表查看权限。')}
    const prefix=root==='skus'&&row&&(row.recordKind==='material'||row.materialCode)?'product:material':resource[root]
    if(!prefix||!can(`${prefix}:${action}`))throw Error(`未授权操作：${prefix||root}:${action}`)
  }
  function wrap(value:any, root:string, row?:any):any {
    if(!value||typeof value!=='object')return value
    const cache=caches.get(root)||new WeakMap();caches.set(root,cache)
    if(cache.has(value))return cache.get(value)
    const proxy=new Proxy(value,{
      get(target,key){
        if(Array.isArray(target)&&key!=='constructor'&&typeof (Array.prototype as any)[key]==='function'){
          return (...args:any[])=>{
            if(['push','unshift'].includes(String(key))){args.forEach(v=>check(root,'create',v));return (Array.prototype as any)[key].apply(target,args)}
            if(key==='pop'||key==='shift'){check(root,'delete',key==='pop'?target.at(-1):target[0]);return (Array.prototype as any)[key].apply(target,args)}
            if(key==='splice'){target.slice(args[0],args[0]+(args[1]??target.length)).forEach(v=>check(root,'delete',v));args.slice(2).forEach(v=>check(root,'create',v));return Array.prototype.splice.apply(target,args as [number,number,...any[]])}
            if(key==='fill'||key==='copyWithin')throw Error('集合批量替换只能通过受控保存命令。')
            if(key==='sort'||key==='reverse'){check(root);const compare=args[0];const wrapped=typeof compare==='function'?[(a:any,b:any)=>compare(wrap(a,root,a),wrap(b,root,b))]:args;(Array.prototype as any)[key].apply(target,wrapped);return proxy}
            return (Array.prototype as any)[key].apply(proxy,args)
          }
        }
        const v=Reflect.get(target,key);if(typeof key==='symbol'||String(key).startsWith('__v_'))return v;return wrap(v,root,row||(Array.isArray(target)&&v&&typeof v==='object'&&'id'in v?v:undefined))},
      set(target,key,v){if(root==='families'&&(key==='shelfStatus'||key==='lifecycle')&&!can('product:spu:publish'))throw Error('没有商品发布／上下架权限。');if(Array.isArray(target)&&key==='length'&&target.length===v)return true;const exists=Object.prototype.hasOwnProperty.call(target,key);check(root,Array.isArray(target)&&key!=='length'&&!exists?'create':'update',row||v);return Reflect.set(target,key,v)},
      deleteProperty(target,key){check(root,Array.isArray(target)?'delete':'update',row||target[key]);return Reflect.deleteProperty(target,key)},
    });cache.set(value,proxy);return proxy
  }
  return new Proxy(data,{
    get(target,key){const value=Reflect.get(target,key);return typeof key==='string'&&!key.startsWith('__v_')?wrap(value,key):value},
    set(target,key,value){
      if(typeof key==='string'){
        const old=(target as any)[key]
        if(Array.isArray(value)&&Array.isArray(old)){
          if(['rbac','users','activeRole'].includes(key))check(key)
          for(const item of value){const previous=old.find(o=>o?.id===item?.id);if(key==='families'&&previous&&(previous.shelfStatus!==item.shelfStatus||previous.lifecycle!==item.lifecycle)&&!can('product:spu:publish'))throw Error('没有商品发布／上下架权限。');if(!previous)check(key,'create',item);else if(JSON.stringify(previous)!==JSON.stringify(item))check(key,'update',item)}
          for(const item of old)if(!value.some(v=>v?.id===item?.id))check(key,'delete',item)
        }else check(key)
      }
      return Reflect.set(target,key,value)
    },
    deleteProperty(target,key){check(String(key),'delete');return Reflect.deleteProperty(target,key)},
  })
}
