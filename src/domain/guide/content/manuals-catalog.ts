import type {GuideArticle, GuideManualContent, GuidePage} from '../types'

export const catalogPages: GuidePage[] = [{id:'page-catalog',title:'商品资料管理',patterns:['/catalog'],articleId:'manual-catalog',actionIds:['action-type-save','action-model-edit','action-category-move'],formal:true}]
export const catalogArticles: GuideArticle[] = [{id:'manual-catalog',title:'商品资料管理操作手册',kind:'page',summary:'在一个工作区查看分类汇总、产品类型和商品模型，再按需进入专项维护。',aliases:['分类汇总','产品类型台账','模型台账','/catalog'],pageIds:['page-catalog'],actionIds:['action-type-save','action-model-edit','action-category-move'],ruleIds:[],related:['manual-categories','manual-product-types','manual-models','manual-specs'],sections:[{id:'catalog-objects',title:'分类、类型与模型各自独立',paragraphs:['目录中的文件夹是分类，标签是独立保存的产品类型。点击分类查看分类范围，点击类型定位该类型及其模型；仅本级／包含下级只适用于分类。从选中类型新建模型会带入真实类型。零模型可继续建模，停用类型可查看但不能新建模型，引用失效请到待处理入口核对。查看目录和统计不会修改业务数据。']}]}]
export const catalogManuals: Record<string,GuideManualContent> = {
  'page-catalog': {
    purpose:'按真实分类、类型和模型查询资料状态与对象明细；明确进入整理或设计后才维护业务结构。',
    features:[
      {id:'catalog-views',title:'切换观察粒度',description:'分类汇总、产品类型和商品模型共用分类范围，各自保留查询与表格配置。分类汇总可在树形结构和列表表格之间切换。',operation:'顶部切视图；分类汇总默认树形，并用“树形结构／列表表格”切换。无该权限时进入第一个可读视图。',result:'切视图、搜索、排序和展开只改变浏览状态，不建立业务对象，也不改分类父子关系。',primary:true},
      {id:'catalog-scope',title:'选择分类或产品类型范围',description:'文件夹是分类，标签是独立的产品类型；点击分类查看分类范围，点击类型定位具体类型及模型。',operation:'仅本级／包含下级适用于分类。目录可搜索分类或类型名称、编号，搜索时可以折叠，清空后恢复浏览展开状态。选中类型后新建模型会默认带入该类型。',result:'零模型类型可继续建模，停用类型只读浏览且不能创建新模型；归属失效或身份冲突到待处理入口核对。查看目录和统计不修改业务数据，切分类汇总清除类型范围。',primary:true},
      {id:'catalog-counts',title:'核对数量和明细',description:'每个数字与明细使用同一组去重对象 ID。树形和列表读同一套汇总。',operation:'点类型、模型、SPU、销售 SKU、MAT 或待处理数量；在明细窗口查询具体记录，再按权限进入完整管理。',result:'SPU 沿用全部 Family 商品主体，含物料承载主体；销售 SKU 与 MAT 使用统一身份判定分别计数。同模型多版本仍计一个模型。',primary:true},
      {id:'catalog-sources',title:'区分结构归属与历史来源',description:'分类商品按实际分类；类型和模型来源按已记录 ID，不能从名称或新路径猜测。',operation:'查看具体对象与待处理明细；无归属、引用失效和来源未记录分别定位。',result:'调整分类或模型归属不批量改写商品创建来源；空类型和未发布模型属于待完善，不自动视为错误。'},
      {id:'catalog-types',title:'维护产品类型',description:'类型台账显示关联分类、模型和实际状态。',operation:'点名称查看详情；新增、编辑或更多操作明确进入维护。父分类不能直接新建类型，需选择合法末级分类。',result:'沿用类型保存、引用和删除保护；同名不同 ID 不合并。',actionIds:['action-type-save']},
      {id:'catalog-models',title:'先看模型详情，再进入设计',description:'详情展示草稿状态、真实发布记录和关联商品，组合信息按需查看。',operation:'点模型名称，选择准确版本；查看设计读取该版本，编辑则明确进入当前草稿。用“返回商品资料管理”恢复来源上下文。',result:'不会伪造 V1 发布记录、自动切到最新版本或自动发布。搭配与适用沿用现有工作区和范围身份。',actionIds:['action-model-edit']},
      {id:'catalog-organize',title:'整理分类',description:'日常汇总与批量分类维护分开。',operation:'点“整理分类”，在专项页面连续加入待移动区、选择目标并确认；结束后返回资料管理。',result:'保留原位改名、原子批量移动、复制及删除保护；商品归属和历史快照不随分类移动重写。',actionIds:['action-category-move']},
      {id:'catalog-legacy',title:'使用旧地址',description:'旧书签继续承接对应任务和对象。',operation:'/categories 普通浏览进入分类汇总；带整理任务继续专项维护。/product-types 与 /models 进入对应台账；/specs 保留原设计入口。',result:'参数和目标 ID 保留，数字下钻不覆盖 SPU/SKU 已保存筛选、列宽、冻结列或手动顺序。'},
    ],
    restrictions:[
      {id:'catalog-read',condition:'缺少某一对象读取权限或直接输入未经授权的 view。',effect:'无权视图拒绝访问，指标显示不可查看；不会用 0 伪装或从其他视图泄漏记录。',resolution:'使用已有可读视图；编辑、设计、发布和商品详情分别鉴权。'},
      {id:'catalog-history',condition:'分类、来源或指定发布版本失效。',effect:'保留失效状态与真实记录，不自动补归属、猜模型或换成最新版本。',resolution:'在明细核对真实 ID，通过有权限的维护入口修复。'},
      {id:'catalog-preferences',condition:'本机界面配置损坏、存储失败或切换身份。',effect:'业务对象不受影响；配置按身份及视图隔离，保存失败明确提示。',resolution:'继续浏览或重试配置保存，不重置商品保存视图。'},
    ],
  },
}
