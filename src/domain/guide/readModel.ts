import type { MenuNode } from '../menuConfig'
import { guideArticles, guidePages } from './registry'
import { guidePageFor } from './routeMap'
import { guideManualContents } from './content/manuals'
import type { GuideArticle, GuideFeatureRow, GuideOperationDetail, GuidePage, GuideRestrictionRow, GuideSection } from './types'

export interface GuideLocation { path: string; query?: Record<string, string> }
export type GuideRelationKind = 'upstream' | 'downstream' | 'related'
export interface GuideRelatedPage { pageId: string; page: GuidePage; kind: GuideRelationKind; reason: string; to: GuideLocation; entryLabel: string }
export interface GuidePageManual {
  page: GuidePage; article: GuideArticle; features: GuideSection[]; actions: GuideArticle[]
  restrictions: GuideSection[]; rules: GuideArticle[]; relatedPages: GuideRelatedPage[]
  purpose: string; featureRows: GuideFeatureRow[]; restrictionRows: GuideRestrictionRow[]; details: GuideOperationDetail[]
}
export interface GuideDirectoryItem { page: GuidePage; title: string; menuId?: string }
export interface GuideDirectoryGroup { id: string; title: string; items: GuideDirectoryItem[] }
export interface GuideDirectoryCenter extends GuideDirectoryGroup { groups: GuideDirectoryGroup[] }

// Only registered, object-independent destinations. Detail pages fall back to their real
// list/workspace entrance; an explanation never invents an object ID or selects a record.
const targets: Record<string, GuideLocation> = {
 'page-compatibility':{path:'/compatibility'},'page-type-bundles':{path:'/benefits/manage'},'page-bundle-sale':{path:'/benefits/shopping'},
  'page-catalog':{path:'/catalog'},
  'page-home':{path:'/'}, 'page-categories':{path:'/categories',query:{mode:'organize'}}, 'page-product-types':{path:'/catalog',query:{view:'types'}},
  'page-params':{path:'/params'}, 'page-templates':{path:'/templates'}, 'page-models':{path:'/catalog',query:{view:'models'}},
  'page-specs':{path:'/specs'}, 'page-plans':{path:'/plans'}, 'page-tree':{path:'/tree'},
  'page-spus':{path:'/spus'}, 'page-spu-create':{path:'/spus/new'}, 'page-spu-edit':{path:'/spus'},
  'page-skus':{path:'/skus'}, 'page-sku-create':{path:'/skus'}, 'page-sku-edit':{path:'/skus'},
  'page-material-create':{path:'/materials/new'}, 'page-material-edit':{path:'/spus'},
  'page-brands':{path:'/brands'}, 'page-groups':{path:'/groups'},
  'page-rules':{path:'/rules'}, 'page-mappings':{path:'/mappings'}, 'page-overview':{path:'/overview'},
  'page-check':{path:'/check'}, 'page-import':{path:'/import'},
  'page-columns-spu':{path:'/spus',query:{panel:'columns'}}, 'page-columns-sku':{path:'/skus',query:{panel:'columns'}},
  'page-menus':{path:'/menus'}, 'page-roles':{path:'/roles'}, 'page-permissions':{path:'/permissions'},
  'page-users':{path:'/users'}, 'page-account':{path:'/account'}, 'page-feedback':{path:'/feedback'},
  'page-forbidden':{path:'/forbidden'}, 'page-guide':{path:'/guide'}, 'page-guide-article':{path:'/guide'},
}
export function guidePageTarget(pageId: string): GuideLocation | undefined {
  const target=guidePages.some(page=>page.id===pageId)?targets[pageId]:undefined
  return target?{path:target.path,...(target.query?{query:{...target.query}}:{})}:undefined
}

const selectionLabels: Record<string,string> = {
  'page-spu-edit':'前往列表选择 SPU', 'page-sku-create':'前往 SKU 管理选择主体',
  'page-sku-edit':'前往列表选择 SKU', 'page-material-edit':'前往 SPU 管理查找物料',
  'page-guide-article':'前往说明目录选择页面',
}
export function guidePageEntryLabel(pageId:string) {
  return selectionLabels[pageId] || `前往${guidePages.find(page=>page.id===pageId)?.title || '页面'}`
}

type PageLink = [from:string,to:string,kind:GuideRelationKind,reason:string,reverseReason?:string]
// Relationships are authored against real page identities. Kind and explanation are not
// inferred from a title, menu position, object name, or similar-looking route.
const links: PageLink[] = [
  ['page-home','page-spus','related','工作台的商品搜索和快捷入口进入 SPU 管理。','商品工作台提供商品搜索和统计入口。'],
  ['page-home','page-check','related','工作台问题统计可进入商品质量检查。','商品工作台提供待处理问题入口。'],
  ['page-product-types','page-categories','upstream','产品类型显式关联分类，分类需要先存在。','分类下的产品类型在产品类型页面维护。'],
  ['page-templates','page-params','upstream','属性方案绑定正式词典属性，并设置公共或规格角色及必填项。','词典属性可被属性方案引用；方案绑定不会另建词典属性。'],
  ['page-specs','page-params','upstream','模型节点引用正式属性及取值；维护词典时需保留草稿和历史引用。','模型设计使用词典属性及取值，路径限制不会修改全局词典。'],
  ['page-models','page-product-types','upstream','商品模型归属明确的产品类型。','在类型下建立模型，再设计与发布规格路径。'],
  ['page-models','page-specs','related','模型列表进入设计页维护节点、业务配置并发布版本。','模型列表用于选择、创建和管理当前要设计的模型。'],
  ['page-specs','page-material-create','downstream','发布模型后，可以按完整规划或明确节点范围创建或关联物料。','物料来源依赖真实模型和已发布版本；未发布草稿不会代替历史版本。'],
  ['page-specs','page-sku-create','downstream','追加 SKU 时可使用已发布模型的完整组合；物料范围不能截断销售组合。','模型生成的 SKU 使用发布版本与真实组合，不根据展示名称推导身份。'],
  ['page-specs','page-tree','related','商品结构视图按结构轴查看已存在商品；实际模型节点在设计页维护。'],
  ['page-plans','page-specs','related','旧规划入口继续保留；当前模型设计管理实际节点与发布版本，两者来源不自动合并。'],
  ['page-plans','page-sku-create','downstream','使用旧规划来源追加 SKU 时，应保留每条 SKU 的具体规划来源。','规划来源与手工、方案和模型来源分别保留，不补造关联。'],
  ['page-spus','page-spu-create','related','独立创建商品主体后，可向同一 SPU 分批追加 SKU。','创建完成后返回 SPU 管理查看主体及其 SKU 归属。'],
  ['page-spus','page-spu-edit','related','从列表选择主体，编辑公共信息并查看已有 SKU 或物料。','SPU 管理是返回主体列表的入口。'],
  ['page-spu-create','page-categories','upstream','新 SPU 需要选择有效分类；产品类型必须与所选分类一致。','分类维护后可在新建 SPU 时选择，分类本身不会创建商品。'],
  ['page-spu-create','page-templates','upstream','选择属性方案后，按公共与规格角色填写商品信息。','方案用于商品录入约束，不代表已经存在 SPU 或 SKU。'],
  ['page-spu-edit','page-sku-create','downstream','在当前主体中追加规格商品，保留同级 SKU 与物料。','追加前需要选择真实 SPU，并沿用其公共信息和身份依据。'],
  ['page-spus','page-skus','related','SPU 统计商品主体，SKU 统计实际销售规格；可按同一主体核对归属。'],
  ['page-sku-create','page-skus','downstream','预览区分新增、已有和无效规格；确认后在 SKU 列表查看。','SKU 管理提供新增入口，追加到明确的 SPU。'],
  ['page-sku-edit','page-spu-edit','upstream','SKU 归属真实 SPU；规格来源锁定时不能直接改写其身份。','主体详情可查看其真实销售 SKU，物料不混入 SKU 数量。'],
  ['page-skus','page-sku-edit','related','从 SKU 列表编辑当前规格商品，修改不影响同级记录。','编辑完成后返回 SKU 管理核对当前规格与状态。'],
  ['page-material-create','page-product-types','upstream','正式和临时物料都需核对分类与产品类型，不能按名称跨类型复用。','物料建档选择真实产品类型及对应来源。'],
  ['page-material-create','page-material-edit','downstream','建档后可查看物料编号、来源、范围和新增关联；没有具体对象时先回 SPU 列表的物料入口。','物料档案保留原建档来源；新建与新增关联分别处理。'],
  ['page-material-edit','page-spu-edit','related','物料档案与商品主体按真实 ID 关联；查看主体及物料时不能把 MAT 当销售 SKU。'],
  ['page-spus','page-columns-spu','related','SPU 列、筛选、分组和保存视图属于 SPU 页面配置。'],
  ['page-skus','page-columns-sku','related','SKU 列和保存视图单独维护，与 SPU 临时范围隔离。'],
  ['page-brands','page-params','related','品牌维护可能同步品牌词典；主数据品牌与规划属性品牌保持各自真实字段。'],
  ['page-groups','page-spus','related','运营分组整理已有商品主体，不改变 SPU、SKU、PLN 或 MAT 身份。','商品主体可加入运营分组，分组不是规格来源。'],
  ['page-rules','page-templates','upstream','规格约束使用真实属性方案及参数绑定，条件不会凭名称自动合并。','方案配置与规格约束分开维护。'],
  ['page-mappings','page-templates','upstream','历史分类方案绑定引用已有方案；实际商品和模型来源仍按各自记录保留。','历史绑定入口保留原义，不自动改写商品来源。'],
  ['page-overview','page-spus','related','商品总览汇总现有主体与状态；具体维护回到 SPU 管理。'],
  ['page-check','page-sku-edit','related','质量检查帮助发现缺失或异常信息；修改需进入对应真实商品记录。'],
  ['page-import','page-spus','related','导入导出使用真实数据与既有校验；导入成功后核对商品主体和来源。'],
  ['page-import','page-skus','related','批量数据需保持销售 SKU 与 MAT 身份，并保护历史版本和冻结清单。'],
  ['page-roles','page-permissions','upstream','角色只能配置已经登记的权限点；目录名称不等于新增可执行能力。','权限目录可查看被哪些角色引用，角色授权另页完成。'],
  ['page-users','page-roles','upstream','用户绑定多个角色，启用角色的有效权限按并集合并。','角色页可查看关联用户，不能删除后留下悬空绑定。'],
  ['page-menus','page-permissions','related','菜单维护结构与页面访问绑定；隐藏菜单不会撤销角色授权。'],
  ['page-menus','page-roles','related','菜单按角色预览只读取授权；角色权限集中在角色管理维护。'],
  ['page-account','page-users','related','账号设置维护个人信息；用户启停和角色绑定在用户管理完成。'],
  ['page-feedback','page-guide','related','先查看对应页面的功能和限制，再按原反馈入口保留必要错误与操作上下文。'],
  ['page-forbidden','page-roles','related','严格权限模式下请有授权能力的管理员核对角色及依赖；显示说明不代表取得授权。'],
  ['page-guide','page-guide-article','related','从目录或搜索打开对应页面说明，按功能、规则与关联页面阅读。','返回系统功能说明目录查找其他页面。'],
]
function pageRelations(pageId:string):GuideRelatedPage[]{
  const result:GuideRelatedPage[]=[]
  for(const [from,to,kind,reason,reverse]of links){
    const forward=from===pageId,backward=to===pageId&&(kind==='related'||!!reverse)
    if(!forward&&!backward)continue
    const id=forward?to:from,page=guidePages.find(item=>item.id===id),target=guidePageTarget(id)
    if(!page||!target)continue
    result.push({pageId:id,page,to:target,entryLabel:guidePageEntryLabel(id),kind:forward||kind==='related'?kind:kind==='upstream'?'downstream':'upstream',reason:forward?reason:reverse||reason})
  }
  return result
}
export function pageManual(pageId:string):GuidePageManual|undefined{
  const page=guidePages.find(item=>item.id===pageId),article=guideArticles.find(item=>item.id===page?.articleId)
  if(!page||!article)return undefined
  const content=guideManualContents[pageId]
  if(!content)return undefined
  const actions=page.actionIds.map(id=>guideArticles.find(item=>item.id===id&&item.kind==='action')).filter((item):item is GuideArticle=>!!item)
  const ruleIds=new Set([...article.ruleIds,...actions.flatMap(action=>action.ruleIds)])
  const rules=guideArticles.filter(item=>item.kind==='rule'&&(ruleIds.has(item.id)||item.pageIds.includes(pageId)))
  // The visible page manual is explicitly authored. Legacy action/rule articles remain
  // addressable for failure links; they are never concatenated into the page body.
  const features:GuideSection[]=[{id:'functions',title:'功能',table:{headers:['功能','能做什么','入口与操作','结果和关键限制'],rows:content.features.map(row=>[row.title,row.description,row.operation,row.result])}}]
  const restrictions:GuideSection[]=content.restrictions.length?[{id:'restrictions',title:'规则与处理',table:{headers:['什么情况','会怎样／为什么','应该怎么处理'],rows:content.restrictions.map(row=>[row.condition,row.effect,row.resolution])}}]:[]
  return {page,article,purpose:content.purpose,featureRows:content.features,restrictionRows:content.restrictions,details:content.details||[],features,actions,restrictions,rules,relatedPages:pageRelations(pageId)}
}

export function guideDirectory(nodes:readonly MenuNode[]):GuideDirectoryCenter[]{
  const ordered=(parentId:string|null)=>nodes.filter(node=>node.parentId===parentId&&!node.hidden).sort((a,b)=>a.sort-b.sort)
  const placed=new Set<string>()
  function item(node:MenuNode):GuideDirectoryItem|undefined{
    if(node.kind!=='page')return undefined
    const [path,query='']=node.route.split('?'),page=guidePageFor(path||'/',Object.fromEntries(new URLSearchParams(query)))
    if(!page||placed.has(page.id))return undefined
    placed.add(page.id);return {page,title:node.title,menuId:node.id}
  }
  const centers=ordered(null).filter(node=>node.kind==='center').map(center=>{
    const entries=ordered(center.id),items=entries.map(item).filter((entry):entry is GuideDirectoryItem=>!!entry)
    const groups=entries.filter(node=>node.kind==='group').map(group=>({id:group.id,title:group.title,items:ordered(group.id).map(item).filter((entry):entry is GuideDirectoryItem=>!!entry)})).filter(group=>group.items.length)
    return {id:center.id,title:center.title,items,groups}
  }).filter(center=>center.items.length||center.groups.length)
  const other=guidePages.filter(page=>!placed.has(page.id)).map(page=>({page,title:page.title}))
  return other.length?[...centers,{id:'guide-other-pages',title:'其他页面',items:other,groups:[]}]:centers
}
