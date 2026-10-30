import type {BenefitSale,SaleScope} from '../../domain/benefitSales/types'
import type {LocationQuery} from 'vue-router'
export interface WorkingSale {record:BenefitSale;prices:Record<string,string>;saved:string;query?:LocationQuery}
export const workingSales=new Map<string,WorkingSale>()
export const emptyScope=():SaleScope=>({mode:'free',categoryId:'',productTypeIds:[],device:null})
export const emptySale=():WorkingSale=>({record:{id:'',scope:emptyScope(),lines:[],status:'draft',revision:0,createdAt:'',updatedAt:''},prices:{},saved:''})
