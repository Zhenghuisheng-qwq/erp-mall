import {guideArticles} from './guide/registry'
import {guidePageFor} from './guide/routeMap'
export type FeatureStatus = 'done' | 'partial' | 'missing'

export interface PageFeature {
  id: string
  name: string
  summary: string
  group: string
  status: FeatureStatus
}

export interface PageFeatureSheet {
  title: string
  features: PageFeature[]
}

type LegacyFeatureSheet = {title:string;features:Omit<PageFeature,'summary'>[]}

// Feedback identity compatibility only; all active explanatory prose is code-maintained in guide content.
function sheet(title: string, rows: Array<[string, string, string, FeatureStatus?]>): LegacyFeatureSheet {
  return {
    title,
    features: rows.map(([id, name, group, status]) => ({ id, name, group, status: status || 'done' })),
  }
}

const sheets: Record<string, LegacyFeatureSheet> = {
  '/spus': sheet('SPU 管理', [
    ['spu.list.query', '筛选与列表设置', '查看'],
    ['spu.list.append', '管理与追加 SKU', '维护'],
  ]),
  '/spus/new': sheet('新建 SPU', [
    ['spu.create.save', '保存 SPU', '创建'],
    ['spu.create.sku', '保存并新增 SKU', '创建'],
  ]),
  '/spus/edit': sheet('SPU 详情', [
    ['spu.edit.save', '维护主体资料', '维护'],
    ['spu.edit.children', '查看子记录', '查看'],
  ]),
  '/skus': sheet('SKU 管理', [
    ['sku.workbench.filters', '高级筛选与常用筛选', '视图'],
    ['sku.workbench.views', '保存与恢复视图', '视图'],
  ]),
  '/skus/new': sheet('新增 SKU', [
    ['sku.create.source', '选择 SPU 与生成来源', '创建'],
    ['sku.create.confirm', '确认追加规格', '创建'],
  ]),
  '/skus/edit': sheet('编辑 SKU', [
    ['sku.edit.save', '维护单条 SKU', '维护'],
  ]),
  '/materials/new': sheet('物料建档', [
    ['material.create.archive', '按组合建档', '物料'],
    ['material.create.temporary', '临时物料', '物料'],
  ]),
  '/materials/edit': sheet('物料档案', [
    ['material.archive.open', '查看与维护物料', '物料'],
  ]),
  '/categories': sheet('商品分类', [
    ['browse', '查看分类', '查看'],
    ['mode', '查看和编辑模式', '查看'],
    ['expand', '展开和收起', '查看'],
    ['search', '搜索定位', '查看'],
    ['create', '新建分类', '编辑'],
    ['rename', '双击改名', '编辑'],
    ['edit', '编辑分类', '编辑'],
    ['move', '移动分类', '编辑'],
    ['drag', '拖拽排序', '编辑'],
    ['copy', '复制分类', '编辑'],
    ['remove', '删除分类', '编辑'],
  ]),
  '/': sheet('商品工作台', [
    ['search', '搜索商品', '日常'],
    ['create', '新增商品', '日常'],
    ['issues', '待处理问题', '日常'],
    ['shortcut', '按分类新增', '日常'],
  ]),
  '/products': sheet('商品列表', [
    ['dual', 'SPU 和 SKU 视图', '查找'],
    ['views', '多视图', '查找'],
    ['columns', '列设置', '查找'],
    ['filter', '筛选和分组排序', '查找'],
    ['create', '新增商品', '维护'],
    ['edit', '编辑和物料', '维护'],
    ['shelf', '发布和下架', '维护'],
    ['copy', '复制商品', '维护'],
    ['remove', '删除', '维护'],
    ['import', '去导入导出', '维护'],
  ]),
  '/products/edit': sheet('编辑商品', [
    ['draft', '保存草稿和发布', '保存'],
    ['sku', '维护规格', '规格'],
    ['name', '生成名称', '规格'],
    ['temp', '创建临时物料', '物料'],
  ]),
  '/product-types': sheet('产品类型', [
    ['scope', '按分类范围查看', '查找'],
    ['create', '新增产品类型', '维护'],
    ['edit', '编辑类型', '维护'],
    ['remove', '删除类型', '维护'],
    ['models', '查看商品模型', '模型'],
  ]),
  '/models': sheet('商品模型', [
    ['create', '新建模型', '模型'],
    ['open', '查看和编辑', '模型'],
    ['copy', '复制模型', '模型'],
    ['publish', '发布和下线', '模型'],
  ]),
  '/specs': sheet('商品模型设计', [
    ['overview', '全局总览', '查看'],
    ['dict', '原位词典', '词典'],
    ['naming', '命名规则', '规则'],
    ['save', '保存和发布', '模型'],
    ['node', '维护属性和值', '结构'],
    ['layout', '查看结构', '结构'],
    ['combo', '管理合法组合', '物料'],
    ['grade', '标记商品档次', '物料'],
    ['temp', '创建临时物料', '物料'],
    ['spec.naming.node', '命名规则入口', '规则'],
    ['spec.materials.inline', '完整结构关联物料', '物料'],
  ]),
  '/params': sheet('属性词典', [
    ['create', '新建参数', '词典'],
    ['edit', '编辑和取值', '词典'],
    ['group', '取值分组', '词典'],
    ['brand', '去维护品牌', '词典'],
  ]),
  '/templates': sheet('属性方案', [
    ['create', '新建方案', '方案'],
    ['bind', '配置属性', '方案'],
    ['copy', '复制方案', '方案'],
    ['preview', '预览录入', '方案'],
    ['remove', '删除方案', '方案'],
  ]),
  '/rules': sheet('规格约束', [
    ['create', '新增规则', '规则'],
    ['edit', '编辑规则', '规则'],
    ['copy', '复制规则', '规则'],
    ['remove', '删除规则', '规则'],
  ]),
  '/brands': sheet('品牌中心', [
    ['create', '新增品牌', '品牌'],
    ['edit', '编辑品牌', '品牌'],
  ]),
  '/groups': sheet('运营分组', [
    ['create', '新建分组', '分组'],
    ['link', '保存关联', '分组'],
    ['remove', '删除分组', '分组'],
  ]),
  '/overview': sheet('商品总览', [
    ['family', '按整款查看', '查看'],
    ['matrix', '规格矩阵', '查看'],
  ]),
  '/check': sheet('商品质量检查', [
    ['list', '查看问题', '检查'],
    ['fix', '去修改', '检查'],
  ]),
  '/compatibility': sheet('兼容性管理', [['ledger','商品适用台账','维护'],['models','维护适用设备','维护'],['device','按设备查询','查询']]),
  '/import': sheet('导入导出', [
    ['template', '下载模板', '表格'],
    ['export', '导出商品', '表格'],
    ['preview', '预览导入', '导入'],
    ['confirm', '确认导入', '导入'],
  ]),
  '/plans': sheet('商品规划', [
    ['edit', '编辑规划', '规划'],
    ['save', '保存规划', '规划'],
    ['generate', '生成商品', '规划'],
    ['remove', '删除规划', '规划'],
  ]),
  '/tree': sheet('商品结构视图', [
    ['view', '查看结构', '查看'],
    ['open', '查看商品', '查看'],
  ]),
  '/users': sheet('用户管理', [
    ['create', '新增用户', '用户'],
    ['edit', '编辑用户', '用户'],
    ['role', '切换查看身份', '用户'],
  ]),
  '/account': sheet('账号设置', [
    ['profile', '保存资料', '账号'],
    ['password', '检查密码', '账号'],
  ]),
  '/menus': sheet('菜单配置', [
    ['name', '修改名称和顺序', '菜单'],
    ['group', '维护分组', '菜单'],
    ['role', '设置运营可访问', '权限'],
    ['save', '保存和恢复', '菜单'],
  ]),
  '/feedback': sheet('反馈管理', [
    ['list', '查看本机反馈', '反馈'],
    ['detail', '查看详情和附件', '反馈'],
    ['edit', '编辑未导出的反馈', '反馈'],
    ['remove', '删除反馈', '反馈'],
    ['export', '导出反馈包', '反馈'],
  ]),
  '/products?panel=columns': sheet('列配置与视图', [
    ['columns', '调整列', '列表'],
    ['reset', '恢复默认列', '列表'],
    ['view', '切换视图', '列表'],
  ]),
}

export function featurePageKey(path: string, query: { panel?: unknown } = {}) {
  path = path.split('?')[0] || '/'
  if (path === '/columns' || (['/spus','/skus'].includes(path) && query.panel === 'columns')) return '/products?panel=columns'
  for (const base of ['spus', 'skus', 'materials']) {
    if (path === `/${base}/new`) return path
    if (new RegExp(`^/${base}/[^/]+$`).test(path)) return `/${base}/edit`
  }
  if (path === '/products/new') return '/spus/new'
  if (path === '/products' && query.panel === 'columns') return '/products?panel=columns'
  if (path.startsWith('/products/') && path !== '/products') return '/products/edit'
  return path || '/'
}

export function featureSheet(path: string, query: { panel?: unknown } = {}) {
  const key = featurePageKey(path, query), found = sheets[key]
  const page=guidePageFor(path,query),manual=guideArticles.find(a=>a.id===page?.articleId)
  if(!found&&!manual)return null
  // Existing feedback keeps its saved feature ID/name. New feedback uses a
  // page-scoped stable identity for the older short IDs (create/edit/etc.).
  const aliases:Record<string,string>={'/menus:role':'action-rbac-authorize','/users:role':'action-user-preview','/categories:move':'action-category-move'}
  const features=(found?.features||[]).map(feature=>{
    const id=feature.id.includes('.')?feature.id:`${key}:${feature.id}`,action=guideArticles.find(a=>a.id===aliases[id])
    // Legacy IDs/status are feedback compatibility only. Active prose comes from the guide.
    return {...feature,id,name:action?.title||feature.name,summary:action?.summary||manual?.summary||'此历史入口请查看当前页面手册。'}
  })
  for(const id of page?.actionIds||[]){const action=guideArticles.find(a=>a.id===id);if(action&&!features.some(f=>f.id===id||aliases[f.id]===id))features.push({id,name:action.title,summary:action.summary,group:'当前操作',status:'done'})}
  return {title:page?.title||found!.title,features}
}

export function featureStatusText(status: FeatureStatus) {
  if (status === 'done') return '已实现'
  if (status === 'partial') return '部分实现'
  return '暂未实现'
}
