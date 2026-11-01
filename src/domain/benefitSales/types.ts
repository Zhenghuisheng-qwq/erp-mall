export interface BenefitGroup { accessoryCategoryIds?:string[]; id:string; name:string; categoryId:string; productTypeIds:string[]; commonSpuIds?:string[]; enabled:boolean; sort:number; revision:number; createdAt:string; updatedAt:string }
export type GroupInput=Omit<BenefitGroup,'revision'|'createdAt'|'updatedAt'>
/** Historical selection context only; new sales must use null. */
export type SaleDevice={kind:'sku';skuId:string}|{kind:'model';key:string}|null
export interface SaleScope { purchaseMode?:'host_only'|'with_accessories'; mode:'free'|'group'; categoryId:string; productTypeIds:string[]; groupId?:string; commonSpuIds?:string[]; device:SaleDevice }
export interface ExtraBundle {parentGroupId?:string;parentDeviceKey?:string;id:string;hostSkuId:string;withAccessories:boolean;kind:'sale'|'gift'}
export interface SaleLine {bundle?:ExtraBundle; kind?:'sale'|'gift'; skuId:string; quantity:number; unitPriceCents:number|null }
export interface SaleSnapshot { device:unknown; scope:SaleScope; groupName?:string; commonSpus?:{spuId:string;name:string}[]; lines:(SaleLine & {name:string;spec:string;code:string;[key:string]:unknown;sources?:{kind:'type'|'public';id:string;name:string}[]})[]; totalCents:number; confirmedAt:string }
/** Confirmed records keep frozen snapshots; drafts use controlled sale commands. */
export interface BenefitSale { id:string; scope:SaleScope; lines:SaleLine[]; status:'draft'|'confirmed'; revision:number; createdAt:string; updatedAt:string; snapshot?:SaleSnapshot }
export type WriteResult<T>={ok:true;record:T}|{ok:false;message:string}

export interface SaleInput {id:string;scope:SaleScope;lines:SaleLine[];status:'draft'|'confirmed'}
