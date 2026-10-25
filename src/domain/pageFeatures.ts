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

function sheet(title: string, rows: Array<[string, string, string, string, FeatureStatus?]>): PageFeatureSheet {
  return {
    title,
    features: rows.map(([id, name, summary, group, status]) => ({ id, name, summary, group, status: status || 'done' })),
  }
}

const sheets: Record<string, PageFeatureSheet> = {
  '/spus': sheet('SPU 管理', [
    ['spu.list.query', '筛选与列表设置', '按分类、属性筛选 SPU，配置列、排序和分组；SPU 与真实 SKU 分开管理。', '查看'],
    ['spu.list.append', '管理与追加 SKU', '打开 SPU 详情或进入指定 SPU 的 SKU 列表、追加规格。MAT 保留独立物料入口。', '维护'],
  ]),
  '/spus/new': sheet('新建 SPU', [
    ['spu.create.save', '保存 SPU', '保存主体及公共信息，可先建立没有 SKU 的 SPU。', '创建'],
    ['spu.create.sku', '保存并新增 SKU', '保存主体后进入规格创建流程。', '创建'],
  ]),
  '/spus/edit': sheet('SPU 详情', [
    ['spu.edit.save', '维护主体资料', '维护名称、OA 编号等；已有子记录时，身份字段按现有规则锁定。', '维护'],
    ['spu.edit.children', '查看子记录', '查看真实 SKU 与物料，并通过独立入口管理；删除 SKU 不自动删除 SPU。', '查看'],
  ]),
  '/skus': sheet('SKU 管理', [
    ['sku.workbench.filters', '高级筛选与常用筛选', '条件在原 AND/OR 组中执行；常用筛选引用原条件，顶部改值后应用，保存视图才覆盖正式配置。', '视图'],
    ['sku.workbench.views', '保存与恢复视图', '配置列、多级排序、分组、收藏、另存及恢复。系统视图需另存，SPU 路由范围默认不写入视图。', '视图'],
    ['sku.workbench.compatibility', '适用关系与组权益包', '按真实 SKU 进入适用主机或配件查询；设备 SKU 可进入组权益包。MAT 不作为销售 SKU。', '业务'],
  ]),
  '/skus/new': sheet('新增 SKU', [
    ['sku.create.source', '选择 SPU 与生成来源', '先选择 SPU，再手工或从属性方案、发布模型及规划预览追加 SKU。', '创建'],
    ['sku.create.confirm', '确认追加规格', '按现有身份规则检查重复和无效组合，追加真实销售 SKU，不覆盖已有子记录。', '创建'],
  ]),
  '/skus/edit': sheet('编辑 SKU', [
    ['sku.edit.save', '维护单条 SKU', '编辑指定销售 SKU，保留所属 SPU、来源及版本；受来源约束的规格身份不能随意更换。', '维护'],
  ]),
  '/materials/new': sheet('物料建档', [
    ['material.create.archive', '按组合建档', '通过现有物料流程建立 MAT 档案；PLN 是规划身份，同一 PLN 可以关联多条 MAT。', '物料'],
    ['material.create.temporary', '临时物料', '对不上正式规划时使用临时物料流程，不冒充正式 PLN 组合。', '物料'],
  ]),
  '/materials/edit': sheet('物料档案', [
    ['material.archive.open', '查看与维护物料', '查看已保存名称、MAT 编号及来源，保留指定物料上下文；物料不是销售 SKU。', '物料'],
  ]),
  '/benefit-packages': sheet('权益包', [
    ['benefit.list.manage', '查找与管理权益包', '在本机查找、收藏、维护权益包并查看交付历史。', '权益包'],
  ]),
  '/benefit-packages/new': sheet('新建权益包', [
    ['benefit.create.contents', '组合商品与服务', '加入真实 SKU 和独立服务；设备选择仅提供适配上下文，交付手机需要明确加入。', '组包'],
    ['benefit.create.quote', '保存并预览交付', '填写每包报价或留空，保存成功后预览，生成清单仍须独立确认。', '交付'],
  ]),
  '/benefit-packages/edit': sheet('权益包详情', [
    ['benefit.edit.contents', '维护包内内容', '修改商品、服务、报价和选配规则，条件确认仅属于当前包与当前依据。', '组包'],
    ['benefit.edit.delivery', '确认交付清单', '按本次包数预览并确认生成本机清单，不进行支付、库存扣减、出库或服务激活。', '交付'],
  ]),
  '/benefit-packages/deliveries/detail': sheet('交付清单', [
    ['benefit.delivery.snapshot', '查看交付快照', '查看生成时保存的商品、服务、数量和报价，不以当前包改写历史。', '清单'],
    ['benefit.delivery.export', '打印与导出 Excel', '打印或导出本机交付清单，不代表付款、出库或服务已激活。', '清单'],
  ]),
  '/categories': sheet('商品分类', [
    ['browse', '查看分类', '查看模式下单击节点，查看信息和展开收起。', '查看'],
    ['mode', '查看和编辑模式', '查看时不能改分类。编辑时才能新增、改名、移动和拖拽。', '查看'],
    ['expand', '展开和收起', '展开全部、收起全部，或点单个节点。', '查看'],
    ['search', '搜索定位', '按名称找到分类。', '查看'],
    ['create', '新建分类', '编辑模式下新增根分类或子分类。', '编辑'],
    ['rename', '双击改名', '编辑模式下双击名称，回车保存，取消不改名。', '编辑'],
    ['edit', '编辑分类', '修改名称、启用状态和属性方案。调整上级用移动。', '编辑'],
    ['move', '移动分类', '在旁边的目标树里选择新的上级。', '编辑'],
    ['drag', '拖拽排序', '编辑模式下同级排序，或拖进另一个分类。', '编辑'],
    ['copy', '复制分类', '复制分类及子分类，不复制商品。', '编辑'],
    ['remove', '删除分类', '有商品或引用时不能删除。', '编辑'],
  ]),
  '/': sheet('商品工作台', [
    ['search', '搜索商品', '按关键字进入商品列表。', '日常'],
    ['create', '新增商品', '从工作台进入新增商品。', '日常'],
    ['issues', '待处理问题', '打开商品质量检查。', '日常'],
    ['shortcut', '按分类新增', '用分类快捷入口新建商品。', '日常'],
  ]),
  '/products': sheet('商品列表', [
    ['dual', 'SPU 和 SKU 视图', '按商品主体查看，或逐条查看真实 SKU。物料和规划组合不会显示成 SKU。', '查找'],
    ['views', '多视图', '新建、切换、重命名、复制和删除展示视图。每个视图记住自己的模式和列。', '查找'],
    ['columns', '列设置', '显示、隐藏当前视图的列，并拖动调整顺序。', '查找'],
    ['filter', '筛选和分组排序', '每个视图保存自己的筛选、外露字段、分组和排序。', '查找'],
    ['create', '新增商品', '进入新增商品页。', '维护'],
    ['edit', '编辑和物料', '打开整款商品或物料档案。', '维护'],
    ['shelf', '发布和下架', '单条或批量改上下架。', '维护'],
    ['copy', '复制商品', '复制一整款或一条规格。', '维护'],
    ['remove', '删除', '删除商品或规格。', '维护'],
    ['import', '去导入导出', '从列表进入导入导出。', '维护'],
  ]),
  '/products/edit': sheet('编辑商品', [
    ['draft', '保存草稿和发布', '保存草稿，或发布、下架商品。', '保存'],
    ['sku', '维护规格', '新增、批量添加、复制和删除规格。', '规格'],
    ['name', '生成名称', '按公共信息生成名称。', '规格'],
    ['temp', '创建临时物料', '为对不上正式规划的情况建临时物料。', '物料'],
  ]),
  '/product-types': sheet('产品类型', [
    ['scope', '按分类范围查看', '只看当前分类，或连同全部下级分类一起看。切换范围不用重选分类。', '查找'],
    ['create', '新增产品类型', '在当前选中的分类下新增类型。', '维护'],
    ['edit', '编辑类型', '修改已有产品类型。', '维护'],
    ['remove', '删除类型', '删除不需要的产品类型。', '维护'],
    ['models', '查看商品模型', '查看这个类型已经关联的商品模型，并可打开现有模型页面。', '模型'],
  ]),
  '/models': sheet('商品模型', [
    ['create', '新建模型', '先选分类和产品类型，再创建模型。', '模型'],
    ['open', '查看和编辑', '打开模型查看，或进入编辑。', '模型'],
    ['copy', '复制模型', '复制一套已有模型。', '模型'],
    ['publish', '发布和下线', '发布会留下版本，也可以下线。', '模型'],
  ]),
  '/specs': sheet('商品模型设计', [
    ['overview', '全局总览', '按分类、产品类型和模型查看结构。总览只读，进入模型后才能编辑。', '查看'],
    ['dict', '原位词典', '在模型里搜索、引用或新增全局属性和属性值。查看模式不能改词典。', '词典'],
    ['naming', '命名规则', '给节点配置命名片段，子节点规则覆盖最近祖先。预览不创建物料。', '规则'],
    ['save', '保存和发布', '保存当前模型，或发布一版。', '模型'],
    ['node', '维护属性和值', '添加属性、属性值、同级节点，或删除节点。', '结构'],
    ['layout', '查看结构', '缩放、适应全部、展开收起。', '结构'],
    ['combo', '管理合法组合', '查看组合，已建物料整行高亮，并可创建物料。', '物料'],
    ['grade', '标记商品档次', '把组合标成核心或一般。', '物料'],
    ['temp', '创建临时物料', '为对不上正式规划的组合建临时物料。', '物料'],
    ['spec.naming.node', '命名规则入口', '在节点上打开命名规则。', '规则'],
    ['host', '节点适用配置', '节点入口维护同一套模板默认及规格例外；发布后新 SKU/MAT 带入各自声明。', '规则'],
    ['spec.compatibility.template', '配置适用设备', '维护整体默认与规格例外，冲突需要处理；旧商品检查模板更新后预览确认，保护人工修改和取消记录。', '规则'],
    ['spec.materials.inline', '完整结构关联物料', '在结构工作区查看完整组合、PLN 和全部关联 MAT，区分当前发布版、历史物料和草稿，点击档案查看真实名称。', '物料'],
  ]),
  '/params': sheet('属性词典', [
    ['create', '新建参数', '增加词典里的属性。', '词典'],
    ['edit', '编辑和取值', '修改参数，添加或删除取值。', '词典'],
    ['group', '取值分组', '给取值增加分组。', '词典'],
    ['brand', '去维护品牌', '从词典跳到品牌中心。', '词典'],
  ]),
  '/templates': sheet('属性方案', [
    ['create', '新建方案', '新建一套可被分类使用的方案。', '方案'],
    ['bind', '配置属性', '加入属性，调整顺序，或移出。', '方案'],
    ['copy', '复制方案', '复制已有方案。', '方案'],
    ['preview', '预览录入', '预览这套方案怎么录入。', '方案'],
    ['remove', '删除方案', '删除不再使用的方案。', '方案'],
  ]),
  '/rules': sheet('规格约束', [
    ['create', '新增规则', '为属性方案增加约束。', '规则'],
    ['edit', '编辑规则', '修改条件并保存。', '规则'],
    ['copy', '复制规则', '复制一条规则。', '规则'],
    ['remove', '删除规则', '删除不需要的规则。', '规则'],
  ]),
  '/brands': sheet('品牌中心', [
    ['create', '新增品牌', '增加可选品牌。', '品牌'],
    ['edit', '编辑品牌', '修改已有品牌。', '品牌'],
  ]),
  '/groups': sheet('运营分组', [
    ['create', '新建分组', '新建分组或子组。分组不改变商品分类。', '分组'],
    ['link', '保存关联', '把商品关联到分组。', '分组'],
    ['remove', '删除分组', '删除运营分组。', '分组'],
  ]),
  '/overview': sheet('商品总览', [
    ['family', '按整款查看', '看一整款商品的规格数量。', '查看'],
    ['matrix', '规格矩阵', '用矩阵对照规格。', '查看'],
  ]),
  '/check': sheet('商品质量检查', [
    ['list', '查看问题', '只列出必填、重复和取值不合法。', '检查'],
    ['fix', '去修改', '从问题进入对应商品。', '检查'],
  ]),
  '/compatibility': sheet('适用关系', [
    ['link', '关联主机', '给配件指定适用的主机型号。', '关系'],
    ['add', '添加配件', '把配件物料加入关联。', '关系'],
    ['remove', '取消关联', '取消一条或一批关联。', '关系'],
  ]),
  '/import': sheet('导入导出', [
    ['template', '下载模板', '下载导入表格模板。', '表格'],
    ['export', '导出商品', '导出商品和规格。', '表格'],
    ['preview', '预览导入', '先匹配字段，预览不直接改物料。', '导入'],
    ['confirm', '确认导入', '预览通过后写入。', '导入'],
  ]),
  '/plans': sheet('商品规划', [
    ['edit', '编辑规划', '从已发布模型继续编辑规划。', '规划'],
    ['save', '保存规划', '保存当前规划。', '规划'],
    ['generate', '生成商品', '按规划路径生成商品。', '规划'],
    ['remove', '删除规划', '删除一条规划。', '规划'],
  ]),
  '/tree': sheet('商品结构视图', [
    ['view', '查看结构', '查看已经有的商品结构。', '查看'],
    ['open', '查看商品', '从节点打开对应商品。', '查看'],
  ]),
  '/users': sheet('用户管理', [
    ['create', '新增用户', '增加演示用户。', '用户'],
    ['edit', '编辑用户', '修改用户资料。', '用户'],
    ['role', '切换查看身份', '用该用户的身份看看菜单。', '用户'],
  ]),
  '/account': sheet('账号设置', [
    ['profile', '保存资料', '资料只留在本机。', '账号'],
    ['password', '检查密码', '只做校验演示，不保存密码。', '账号'],
  ]),
  '/menus': sheet('菜单配置', [
    ['name', '修改名称和顺序', '改显示名，上移或下移。', '菜单'],
    ['group', '维护分组', '新增分组。分组里还有菜单时不能删除。', '菜单'],
    ['role', '设置运营可访问', '按页面决定运营能不能进入。', '权限'],
    ['save', '保存和恢复', '保存到本机，或恢复默认菜单。不清理商品数据。', '菜单'],
  ]),
  '/feedback': sheet('反馈管理', [
    ['list', '查看本机反馈', '按页面和类型查看已经记在本机的反馈。', '反馈'],
    ['detail', '查看详情和附件', '打开说明、图片和短视频。', '反馈'],
    ['edit', '编辑未导出的反馈', '还没导出反馈包的记录可以改。', '反馈'],
    ['remove', '删除反馈', '删除记录，并清掉对应附件。', '反馈'],
    ['export', '导出反馈包', '打成压缩包后自行发给开发人员。不会自动送到服务器。', '反馈'],
  ]),
  '/products?panel=columns': sheet('列配置与视图', [
    ['columns', '调整列', '显示、隐藏当前视图的列，并拖动调整顺序。', '列表'],
    ['reset', '恢复默认列', '把当前模式的列恢复成默认。', '列表'],
    ['view', '切换视图', '每个视图保留自己的模式和列。', '列表'],
  ]),
}

export function featurePageKey(path: string, query: { panel?: unknown } = {}) {
  path = path.split('?')[0] || '/'
  if (path === '/columns' || (['/spus','/skus'].includes(path) && query.panel === 'columns')) return '/products?panel=columns'
  if (/^\/benefit-packages\/deliveries\/[^/]+$/.test(path)) return '/benefit-packages/deliveries/detail'
  for (const base of ['spus', 'skus', 'materials', 'benefit-packages']) {
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
