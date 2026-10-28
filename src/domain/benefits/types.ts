import type { CompatibilityHost, CompatibilityLink } from '../types'
export type BenefitDevice = {kind:'sku';skuId:string}|{kind:'model';hostKey:string}
export type BenefitScope = {modelId:string;hostKey?:string}
export interface BenefitGroup {id:string;name:string;scope:BenefitScope;productTypeIds:string[];enabled:boolean;sort:number;revision:number;createdAt:string;updatedAt:string}
export interface BenefitLine {skuId:string;quantity:number;unitPriceCents:number|null}
export interface BenefitGoodsSnapshot extends BenefitLine {name:string;code:string;spec:string;role:'device'|'accessory';declarations:CompatibilityLink[]}
export interface BenefitSnapshot {device:{label:string;spec:string;host:CompatibilityHost;skuId?:string;planningId?:string;attributes:Record<string,string>;source:string};lines:BenefitGoodsSnapshot[];totalCents:number;confirmedAt:string}
export interface BenefitSelection {id:string;device:BenefitDevice;lines:BenefitLine[];status:'draft'|'confirmed';revision:number;createdAt:string;updatedAt:string;snapshot?:BenefitSnapshot}
export type BenefitGroupInput=Omit<BenefitGroup,'revision'|'createdAt'|'updatedAt'>
export type BenefitSelectionInput=Pick<BenefitSelection,'id'|'device'|'lines'|'status'>
export interface BenefitWrite<T> {ok:boolean;message?:string;record?:T}
