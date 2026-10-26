import type {useCatalogStore} from '../../stores/catalog'
type CatalogStore = ReturnType<typeof useCatalogStore>
// Navigation identity only. Draft content still belongs to the existing Store and save coordinator.
const lastSchemes = new WeakMap<CatalogStore,Map<string,string>>()
const ownerKey=(store:CatalogStore)=>JSON.stringify([store.activeUserId,store.previewUserId])
export function rememberSalesScheme(store:CatalogStore,id:string|undefined){let owners=lastSchemes.get(store);if(!owners){owners=new Map();lastSchemes.set(store,owners)}if(id)owners.set(ownerKey(store),id);else owners.delete(ownerKey(store))}
export function salesShoppingEntryQuery(store:CatalogStore,skuId=''):Record<string,string>{
  const query:Record<string,string>={}
  const id=lastSchemes.get(store)?.get(ownerKey(store))
  const record=store.can('product:benefit:read')?store.data.benefitPackages?.find(item=>item.id===id):undefined
  if(record?.status==='draft'&&record.compositionVersion===2&&(!record.sales||record.sales.schemaVersion===1)&&(!record.framework||['type-v1','type-v2'].includes(record.framework.kind)))query.scheme=record.id
  if(skuId)query.sku=skuId
  return query
}
