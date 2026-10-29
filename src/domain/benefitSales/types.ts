import type {CompatibilityEvidence} from '../generalCompatibility'
import type {CapabilityEvaluation} from '../accessoryCompatibilityTypes'
import type { CompatibilityLink } from '../types'
import type { DeviceResolution } from '../accessoryCompatibilityTypes'
export interface BenefitGroup { id:string; name:string; categoryId:string; productTypeIds:string[]; enabled:boolean; sort:number; revision:number; createdAt:string; updatedAt:string }
export type GroupInput=Omit<BenefitGroup,'revision'|'createdAt'|'updatedAt'>
export type SaleDevice={kind:'sku';skuId:string}|{kind:'model';key:string}|null
export interface SaleScope { mode:'free'|'group'; categoryId:string; productTypeIds:string[]; groupId?:string; device:SaleDevice }
export interface SaleLine { skuId:string; quantity:number; unitPriceCents:number|null }
export interface SaleSnapshot { device:DeviceResolution|null; scope:SaleScope; groupName?:string; lines:(SaleLine & {name:string;spec:string;code:string;declarations:CompatibilityLink[];evidence?:CompatibilityEvidence[];capabilities?:CapabilityEvaluation[]})[]; totalCents:number; confirmedAt:string }
export interface SaleInput { id:string; scope:SaleScope; lines:SaleLine[]; status:'draft'|'confirmed' }
export interface BenefitSale extends SaleInput { revision:number; createdAt:string; updatedAt:string; snapshot?:SaleSnapshot }
export type WriteResult<T>={ok:true;record:T}|{ok:false;message:string}
