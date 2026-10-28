import {reactive} from 'vue'
import type {BenefitSelectionInput,BenefitSelection} from '../../domain/benefits/types'
export const benefitShoppingState=reactive({owner:'',prices:{} as Record<string,string>,draft:undefined as BenefitSelectionInput|undefined,revision:0,confirmed:undefined as BenefitSelection|undefined,groupId:'',search:'',initial:'',routeToken:''})
export function clearBenefitShopping(owner:string){Object.assign(benefitShoppingState,{owner,prices:{},draft:undefined,revision:0,confirmed:undefined,groupId:'',search:'',initial:'',routeToken:''})}
