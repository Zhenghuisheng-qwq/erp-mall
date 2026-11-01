import type {AppData} from '../types'
import type {SaleScope} from './types'
import {saleQuery,saleProblem,saleLabel} from './query'
export function giftQuery(data:AppData,scope:SaleScope){const query=saleQuery(data,scope),candidates:ReturnType<typeof saleQuery>['candidates']=[];if(query.error||query.device?.status!=='resolved')return {candidates,error:query.error||'请先选择本次主机'};for(const sku of data.skus)if(!saleProblem(data,sku.id,false))candidates.push({id:sku.id,...saleLabel(data,sku.id),publicSpuIds:[],sources:[],note:'赠品'});return {candidates,error:''}}
