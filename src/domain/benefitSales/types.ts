export interface BenefitGroup { id:string; name:string; categoryId:string; productTypeIds:string[]; commonSpuIds?:string[]; enabled:boolean; sort:number; revision:number; createdAt:string; updatedAt:string }
export type GroupInput=Omit<BenefitGroup,'revision'|'createdAt'|'updatedAt'>
export type SaleDevice={kind:'sku';skuId:string}|{kind:'model';key:string}|null
export interface SaleScope { mode:'free'|'group'; categoryId:string; productTypeIds:string[]; groupId?:string; commonSpuIds?:string[]; device:SaleDevice }
export interface SaleLine { skuId:string; quantity:number; unitPriceCents:number|null }
export interface SaleSnapshot { device:unknown; scope:SaleScope; groupName?:string; commonSpus?:{spuId:string;name:string}[]; lines:(SaleLine & {name:string;spec:string;code:string;declarations?:unknown;evidence?:unknown;capabilities?:unknown;sources?:{kind:'type'|'public';id:string;name:string}[]})[]; totalCents:number; confirmedAt:string }
/** Confirmed records keep frozen snapshots; drafts use controlled sale commands. */
export interface BenefitSale { id:string; scope:SaleScope; lines:SaleLine[]; status:'draft'|'confirmed'; revision:number; createdAt:string; updatedAt:string; snapshot?:SaleSnapshot }
export type WriteResult<T>={ok:true;record:T}|{ok:false;message:string}

export interface SaleInput {id:string;scope:SaleScope;lines:SaleLine[];status:'draft'|'confirmed'}
