import type { CatalogView } from '../../domain/catalogWorkspaceNavigation'

export interface CatalogViewPreferences {
  keyword: string
  status: string
  sort: string
  page: number
  pageSize: number
  columns: string[]
  widths: Record<string, number>
  selectedId: string
  expandedIds: string[]
  /** 分类汇总的展示方式。其它视图保留该字段，但不使用。 */
  categoryLayout: 'tree' | 'list'
  /** 为 false 时分类树使用默认展开，避免把“从未展开”误当成“已全部收起”。 */
  treeExpandReady: boolean
  scrollTop: number
  scrollLeft: number
}
export interface CatalogWorkspacePreferences {
  version: 1
  sidebar: boolean
  views: Record<CatalogView, CatalogViewPreferences>
}
export const catalogColumns: Record<CatalogView, {key: string; label: string; required?: boolean; defaultVisible: boolean}[]> = {
  categories: [
    {key:'name',label:'分类名称',required:true,defaultVisible:true},
    {key:'types',label:'关联产品类型',defaultVisible:true},
    {key:'models',label:'模型数',defaultVisible:true},
    {key:'spus',label:'SPU 数',defaultVisible:true},
    {key:'skus',label:'销售 SKU 数',defaultVisible:true},
    {key:'pending',label:'待处理',defaultVisible:true},
    {key:'materials',label:'MAT 数',defaultVisible:false},
  ],
  types: [
    {key:'name',label:'产品类型名称',required:true,defaultVisible:true},
    {key:'category',label:'明确关联分类',defaultVisible:true},
    {key:'models',label:'模型数',defaultVisible:true},
    {key:'status',label:'状态',defaultVisible:true},
    {key:'description',label:'简短说明',defaultVisible:true},
    ...['spus','skus','materials'].map((key,i)=>({key,label:['SPU 数','销售 SKU 数','MAT 数'][i]!,defaultVisible:false})),
  ],
  models: [
    {key:'name',label:'模型名称',required:true,defaultVisible:true},
    {key:'type',label:'产品类型',defaultVisible:true},
    {key:'category',label:'分类路径',defaultVisible:true},
    {key:'status',label:'当前工作状态',defaultVisible:true},
    {key:'version',label:'最近发布版本',defaultVisible:true},
    {key:'spus',label:'SPU 数',defaultVisible:true},
    {key:'skus',label:'销售 SKU 数',defaultVisible:true},
    {key:'updated',label:'最近维护',defaultVisible:true},
    {key:'materials',label:'MAT 数',defaultVisible:false},
  ],
}
export function defaultCatalogViewPreferences(view: CatalogView): CatalogViewPreferences {
  return {keyword:'',status:'',sort:'name',page:1,pageSize:40,columns:catalogColumns[view].filter(item=>item.defaultVisible).map(item=>item.key),widths:{},selectedId:'',expandedIds:[],categoryLayout:'tree',treeExpandReady:false,scrollTop:0,scrollLeft:0}
}
export function defaultCatalogWorkspacePreferences(): CatalogWorkspacePreferences {
  return {version:1,sidebar:true,views:{categories:defaultCatalogViewPreferences('categories'),types:defaultCatalogViewPreferences('types'),models:defaultCatalogViewPreferences('models')}}
}
const object = (value: unknown): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 500) => typeof value === 'string' ? value.slice(0,max) : ''
export function repairCatalogViewPreferences(view: CatalogView, value: unknown): CatalogViewPreferences {
  const base=defaultCatalogViewPreferences(view)
  if(!object(value))return base
  const fields=catalogColumns[view],known=new Set(fields.map(item=>item.key))
  const columns=Array.isArray(value.columns)?value.columns.filter((key):key is string=>typeof key==='string'&&known.has(key)):base.columns
  for(const field of fields)if(field.required&&!columns.includes(field.key))columns.unshift(field.key)
  const widths:Record<string,number>={}
  if(object(value.widths))for(const [key,width] of Object.entries(value.widths))if(known.has(key)&&typeof width==='number'&&Number.isFinite(width))widths[key]=Math.max(72,Math.min(900,width))
  const positive=(input:unknown,fallback:number,max:number)=>typeof input==='number'&&Number.isFinite(input)?Math.max(1,Math.min(max,Math.floor(input))):fallback
  const offset=(input:unknown)=>typeof input==='number'&&Number.isFinite(input)?Math.max(0,Math.min(10000000,input)):0
  const statuses=view==='models'?['draft','published','published-draft','offline','unrecorded']:['enabled','disabled']
  const sorts=view==='models'?['name','name-desc','updated','status']:['name','name-desc','status']
  return {...base,keyword:text(value.keyword),status:statuses.includes(String(value.status))?String(value.status):'',sort:sorts.includes(String(value.sort))?String(value.sort):base.sort,
    page:positive(value.page,1,100000),pageSize:[20,40,80].includes(Number(value.pageSize))?Number(value.pageSize):40,columns:[...new Set(columns)],widths,
    selectedId:text(value.selectedId),expandedIds:Array.isArray(value.expandedIds)?[...new Set(value.expandedIds.filter((id):id is string=>typeof id==='string'&&id.length<500))].slice(0,10000):[],
    categoryLayout:value.categoryLayout==='list'?'list':'tree',
    treeExpandReady:value.treeExpandReady===true||(value.treeExpandReady==null&&Array.isArray(value.expandedIds)&&value.expandedIds.some(id=>typeof id==='string'&&id.length>0)),
    scrollTop:offset(value.scrollTop),scrollLeft:offset(value.scrollLeft)}
}
export function catalogWorkspacePreferenceKey(actor: string, preview: string) {
  return `iyge-catalog-workspace-v1:${JSON.stringify([actor,preview])}`
}
export function readCatalogWorkspacePreferences(storage: Pick<Storage,'getItem'>, key: string): CatalogWorkspacePreferences {
  const base=defaultCatalogWorkspacePreferences()
  try {
    const raw:unknown=JSON.parse(storage.getItem(key)||'null')
    if(!object(raw)||raw.version!==1||!object(raw.views))return base
    return {version:1,sidebar:raw.sidebar!==false,views:{categories:repairCatalogViewPreferences('categories',raw.views.categories),types:repairCatalogViewPreferences('types',raw.views.types),models:repairCatalogViewPreferences('models',raw.views.models)}}
  } catch {return base}
}
export function saveCatalogWorkspacePreferences(storage: Pick<Storage,'setItem'>, key: string, preferences: CatalogWorkspacePreferences): {ok:boolean;message?:string} {
  try {storage.setItem(key,JSON.stringify(preferences));return {ok:true}}
  catch {return {ok:false,message:'界面偏好未保存，当前输入仍保留。可以重试保存。'}}
}
