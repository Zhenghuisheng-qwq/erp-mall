import {categoryDisplayParents,categoryPathLabel} from './categoryTree'
import type {Category} from './types'
import type {CatalogTypeRow} from './catalogWorkspaceQuery'
export interface CatalogScopeNode {
  key:string;kind:'category'|'product-type';id:string;categoryId:string
  parentKey:string|null;name:string;path:string;disabled:boolean
}
/** Read-only UI projection. Invalid/conflicting types stay in the issue ledger. */
export function catalogScopeNodes(categories:Category[],types:CatalogTypeRow[]):CatalogScopeNode[]{
  const parents=categoryDisplayParents(categories),ids=new Set(categories.map(row=>row.id))
  return [
    ...categories.slice().sort((a,b)=>a.sort-b.sort||a.id.localeCompare(b.id)).map(row=>({key:`category:${row.id}`,kind:'category' as const,id:row.id,categoryId:row.id,parentKey:parents.get(row.id)?`category:${parents.get(row.id)}`:null,name:row.name,path:categoryPathLabel(categories,row.id),disabled:row.enabled===false})),
    ...types.filter(row=>row.scopeEligible&&row.categoryIds.length===1&&ids.has(row.categoryIds[0]!)).map(row=>({key:`type:${row.id}`,kind:'product-type' as const,id:row.id,categoryId:row.categoryIds[0]!,parentKey:`category:${row.categoryIds[0]}`,name:row.name,path:`${row.categoryPaths[0]} / ${row.name}`,disabled:row.status==='disabled'})),
  ]
}
export function filterCatalogScopeNodes(nodes:CatalogScopeNode[],keyword:string){
  const needle=keyword.trim().toLocaleLowerCase()
  if(!needle)return nodes
  const byKey=new Map(nodes.map(row=>[row.key,row])),children=new Map<string,CatalogScopeNode[]>()
  for(const node of nodes)if(node.parentKey){const list=children.get(node.parentKey)||[];list.push(node);children.set(node.parentKey,list)}
  const keep=new Set<string>()
  function descendants(node:CatalogScopeNode){if(keep.has(node.key))return;keep.add(node.key);for(const child of children.get(node.key)||[])descendants(child)}
  for(const node of nodes)if(`${node.name} ${node.id}`.toLocaleLowerCase().includes(needle))descendants(node)
  for(const key of [...keep]){let node=byKey.get(key);while(node?.parentKey){keep.add(node.parentKey);node=byKey.get(node.parentKey)}}
  return nodes.filter(node=>keep.has(node.key))
}
