import type {AppData} from './types'
export function familyProductTypeId(data:AppData,familyId:string){const family=data.families.find(f=>f.id===familyId);return family?.productTypeId||data.specCanvases.find(c=>c.templateId===(family?.productModelId||family?.templateId))?.productTypeId||''}
