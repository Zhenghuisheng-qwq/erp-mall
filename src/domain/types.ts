import type { BenefitFramework } from './benefitPackageTypes'
import type { SkuViewConfig, SkuWorkbenchState } from './skuWorkbenchTypes'
import type { AccessoryTargetKind, CompatibilityCapability, CompatibilityConclusion, CompatibilityCondition, CompatibilityProvenance, CompatibilityVerification, DeviceBinding, DeviceModel } from './accessoryCompatibilityTypes'
import type { BenefitDeliverySnapshot, BenefitPackage } from './benefitPackageTypes'
import type { TemplateCompatibilityConfig, TemplateCompatibilitySnapshot } from './templateCompatibilityTypes'
import type { TemplateCompatibilityOrigin } from './templateCompatibilitySync'

export const DATA_VERSION = 16
export const STORAGE_KEY = 'iyge-v2-mock-db'

export type SaleStatus = 'on_sale' | 'off_sale' | 'draft'
export type ParamRole = 'common' | 'variant'
export type ConstraintStatus = 'none' | 'hit' | 'uncovered' | 'empty'
export type AppMode = 'daily' | 'advanced'
export type UserRole = 'operator' | 'admin'
export type IssueLevel = 'error' | 'warn'
export type IssueKind = 'required' | 'duplicate' | 'illegal' | 'uncovered'
export type FeedbackStatus = 'open' | 'doing' | 'done'
export type FeedbackKind = 'bug' | 'experience' | 'feature'
export type Origin = 'sample' | 'created'
export type ShelfStatus = 'draft' | 'online' | 'offline'
/** 后续商品编辑按这条线分流。缺省视为 v2，本轮不回填旧商品。 */
export type ProductLine = 'v2' | 'v3'
/** 商品列表的查看方式。只存在页面偏好里，不参与商品身份。 */
export type ProductListMode = 'spu' | 'sku'
export type PlanningStatus = 'active' | 'retired'
/** 正式规划的业务档次。缺省表示还没标记，不是第四种商品。 */
export type ProductGrade = 'core' | 'general'
/** 规划从已发布模型来，还是临时建档来。缺省按正式模型规划理解。 */
export type PlanningOrigin = 'model' | 'temporary'
export type AttrValueSource = 'dictionary' | 'manual'
export type PlanningRoleSource = 'node' | 'scheme'

export interface Category {
  id: string
  name: string
  parentId: string | null
  sort: number
  /** 停用后仍留在分类树，但不能被选为新商品的分类 */
  enabled: boolean
  /** 可选展示图标。旧数据没有该字段时，界面使用默认文件夹图标。 */
  icon?: string
  /** 可选缓存，从 1 开始。界面按父链计算，不要求历史数据携带。 */
  level?: number
  /** 可选缓存，从根到本级的分类 id。界面按父链计算，不要求历史数据携带。 */
  path?: string[]
}

/** 挂在分类下的产品类型。不是分类节点，后续商品模型从这里进入。 */
export interface ProductType {
  id: string
  name: string
  categoryId: string
  status: 'enabled' | 'disabled'
  sort: number
  description: string
  /** 主机或配件。缺省时仍按分类名称推断，旧数据不用补。 */
  catalogRole?: 'host' | 'accessory' | 'other'
}

export interface CatalogTemplate {
  id: string
  name: string
  parentId: string | null
  enabled: boolean
  /** 旧全树、旧矩阵使用的结构轴顺序 */
  structureOrder: string[]
}

export interface ParamDef {
  id: string
  name: string
  values: string[]
  valueGroups: { id: string; name: string; values: string[] }[]
  participateInStructure: boolean
  /** 主机型号身份。看属性 id，不看中文名。缺省表示不是型号身份。 */
  identityRole?: 'host-model'
}

export interface TemplateParam {
  templateId: string
  paramId: string
  role: ParamRole
  required: boolean
}

export interface CategoryMapping {
  templateId: string
  categoryId: string
}

export type SpecNodeType = 'ATTRIBUTE' | 'VALUE'
export type SpecNodeRole = 'COMMON' | 'VARIANT'
export type SpecModelStatus = 'draft' | 'published' | 'offline'

/** 一个属性方案只有一棵规格树。属性下面可以挂属性或属性值，属性值下面只能再挂属性。 */
export interface ProductSpecNode {
  /** R01 optional extension; attached metadata, never a specification axis. */
  businessConfigs?: import('./nodeBusiness').NodeBusinessConfig[]
  id: string
  templateId: string
  parentId: string | null
  nodeType: SpecNodeType
  attributeId: string
  valueId: string
  sort: number
  /** 属性节点决定生成时写入公共属性还是 SKU 规格。缺省时仍回退到属性方案上的角色。 */
  role?: SpecNodeRole
  positionX?: number
  positionY?: number
  /** 缺省为展开。收起后子节点仍保留父子关系，只是画布上不铺开。 */
  expanded?: boolean
  /** 这条节点上的命名规则。随发布快照冻结，不改已发布版本。 */
  namingRule?: NamingPart[]
}

export interface NamingPart {
  kind: 'field' | 'text'
  /** 属性词典 id，或固定记号 productType。 */
  key?: string
  text?: string
}

/** 一次发布冻结的模型节点。历史商品按 id 读取，不跟随后来的编辑树。 */
export interface SpecModelVersion {
  templateCompatibilitySnapshot?: TemplateCompatibilitySnapshot
  id: string
  templateId: string
  version: number
  versionName: string
  status: 'published' | 'offline'
  nodesSnapshot: ProductSpecNode[]
  createdTime: string
  publishTime: string
}

/**
 * 一条完整规格组合的规划档。
 * 编号不写在 VALUE 节点上，也不借用单链 ProductPlan。
 * planningId 在规划档里唯一；以后多条物料可以引用同一个编号。
 */
export interface PlanningStep {
  valueNodeId: string
  attributeNodeId: string
  /** 属性词典 id。展示名不参与身份。 */
  attributeId: string
  /** 发布当时的属性名称，只用于展示。 */
  attributeName: string
  /** 词典值。改掉它就是改了业务含义。 */
  valueId: string
  /** 条件路径上的父级属性值。根上的取值没有。 */
  parentValueNodeId: string | null
  role: ParamRole
  /** 角色来自节点自身，还是缺省时回退的属性方案。 */
  roleSource: PlanningRoleSource
}

export interface PlanningRecord {
  planningId: string
  productModelId: string
  /** 第一次分配这个编号时的已发布版本。 */
  originModelVersionId: string
  /** 最近一次仍然对上这条组合的已发布版本。 */
  modelVersionId: string
  /** 这条组合出现过的已发布版本。旧版本不删。 */
  modelVersionIds: string[]
  steps: PlanningStep[]
  /** 排序和展示名不参与。删除后新建会得到新的节点 id，因此不会撞上旧键。 */
  identityKey: string
  status: PlanningStatus
  createdTime: string
  retiredTime?: string
  /** 核心或一般。旧规划没有这个字段时保持未标记。 */
  grade?: ProductGrade
  /** 缺省是正式模型规划。临时建档不占用 PLN 编号。 */
  origin?: PlanningOrigin
}

export interface ManualAttr {
  attributeId: string
  attributeName: string
  value: string
  source: AttrValueSource
}

/** 从已发布商品模型中选出的一条准备经营的产品。不是正式商品，也不生成 SKU。 */
export interface ProductPlan {
  id: string
  /** 商品模型。当前模型主键仍是模板 id。 */
  productModelId: string
  productTypeId: string
  /** 规划当时采用的已发布版本。 */
  modelVersionId?: string
  name: string
  status: 'saved'
  selectedNodes: string[]
  createdTime: string
}

/** 画布视口和正在编辑的版本状态。已发布快照在 specModelVersions，不写回这棵编辑树。 */
export interface SpecCanvasConfig {
  templateId: string
  /** 这个模型属于哪个产品类型。旧数据没有时，打开后会补到默认产品类型。 */
  productTypeId?: string
  /** 模型名称。旧数据没有时，用属性方案名称补上，不覆盖方案本身。 */
  name?: string
  zoom: number
  panX: number
  panY: number
  status: SpecModelStatus
  version: number
  versionName: string
  /** 横向结构图。logic 是横平竖直的紧凑布局。 */
  direction?: 'ltr' | 'tree' | 'logic' | 'custom'
  /** 只有明确点过「手工摆放」才锁定坐标。以前拖动节点写成的 custom 不能挡住自动排版。 */
  layoutLocked?: boolean
  updatedAt?: string
}

export interface SpecRule {
  id: string
  templateId: string
  targetParamId: string
  sourceParamIds: string[]
  conditions: Record<string, string>
  options: string[]
  enabled: boolean
  note: string
  legacy: boolean
}

export interface ProductFamily {
  id: string
  name: string
  templateId: string
  /** 创建时使用的商品模型版本。没有发布模型的旧录入方式留空。 */
  modelVersionId?: string
  /** 商品模型。与 templateId 相同，方便从规划侧读取。旧商品可以没有。 */
  productModelId?: string
  /** 生成时的产品类型。旧商品可以没有。 */
  productTypeId?: string
  /** 由哪条商品规划生成。手工录入的商品没有。 */
  productPlanId?: string
  /** 商品线。缺省按 v2 理解。v3 建档写入 v3，不回填旧商品。 */
  line?: ProductLine
  /** v3 商品的公共规格身份。按属性词典 id 和值，不按商品名称。 */
  commonSignature?: string
  categoryId: string
  oaProductId: string
  commonAttrs: Record<string, string>
  productGroupIds: string[]
  lifecycle: 'draft' | 'ready'
  /** 商品上下架。缺省时由 lifecycle 推导，不改变原有 SKU 状态。 */
  shelfStatus?: ShelfStatus
  createdAt?: string
  origin: Origin
  updatedAt: string
}

export interface Sku {
  /** 新记录明确区分真实 SKU 与物料；旧记录保留原值，由统一判定函数回退。 */
  recordKind?: 'sku' | 'material'
  /** 每条新增 SKU 自己保留生成来源，不覆盖 SPU 的历史单规划关联。 */
  creationSource?: {
    kind: 'manual' | 'template' | 'model' | 'plan'
    templateId: string
    modelVersionId: string
    productPlanId?: string
    planName?: string
    createdAt: string
  }
  id: string
  familyId: string
  code: string
  oaSkuId: string
  status: SaleStatus
  variantAttrs: Record<string, string>
  projectedAttrs: Record<string, string>
  /** 物料名称。旧 SKU 用它存规格名称。 */
  skuName?: string
  /** 这条规格用到的模型取值节点。旧 SKU 没有。 */
  sourceNodeIds?: string[]
  /** 规划编号。同一编号可以对应多条物料，不参与 V2 规格去重。 */
  planningId?: string
  /** 建档时的已发布模型版本。旧物料不随后来的发布改写。 */
  modelVersionId?: string
  /** 系统物料编码。不是 Sku.code，也不用供应商、管家婆或 OA 编号代替。 */
  materialCode?: string
  /** 供应商编码。允许重复，不能当作系统身份。 */
  supplierCode?: string
  /** 管家婆编号。允许重复。 */
  guanjiapoCode?: string
  /** 物料描述。 */
  materialDescription?: string
  /**
   * rule：建档时按指定已发布版本的命名规则生成。
   * default：该版本没有可用规则，按默认顺序生成。
   * manual：人改过，不能被规则悄悄覆盖。
   * auto：更早的记录，当时没有分开规则和默认，不能事后改写成其中一种。
   */
  nameSource?: 'rule' | 'default' | 'manual' | 'auto'
  /** 建档时命中的命名规则节点。旧物料没有。同级规则冲突时不写。 */
  namingNodeId?: string
  /** 建档时算出的自动建议名称。旧物料没有。不能自动命名时不写。 */
  suggestedName?: string
  createdAt?: string
  updatedAt?: string
  /** 临时物料的实际属性值。不代表模型里的取值节点。 */
  manualAttrs?: ManualAttr[]
}

/** 配件物料指向主机型号。不是规格属性，也不反向生成主机到配件的关系。 */
export interface CompatibilityHost {
  scope: 'model' | 'planning'
  productTypeId: string
  productModelId: string
  /** 品牌到型号的属性 id 和取值。不含节点 id，也不含容量、颜色。 */
  identityKey: string
  steps: { attributeId: string; attributeName: string; valueId: string }[]
  /** 只在指定某一条规格时才有。缺省表示整款型号。 */
  planningId?: string
}

export interface CompatibilityLink {
  id: string
  /** Legacy links omit the target fields and continue to identify a MAT. */
  accessorySkuId: string
  targetKind?: AccessoryTargetKind
  targetId?: string
  conclusion?: CompatibilityConclusion
  verification?: CompatibilityVerification
  capability?: CompatibilityCapability
  conditions?: CompatibilityCondition[]
  source?: string
  provenance?: CompatibilityProvenance
  host: CompatibilityHost
  note: string
  createdAt: string
  updatedAt: string
}

/**
 * 规划节点上的适用主机。只描述这个节点自己的配置。
 * modelVersionId 为空是当前草稿；发布时复制到版本上，不改旧版本。
 * 父子合并、覆盖、排除和历史物料回填还没有确认，不能从这里自动写到物料上。
 */
export interface NodeCompatibilityRule {
  id: string
  templateId: string
  nodeId: string
  modelVersionId: string
  hosts: CompatibilityHost[]
  updatedAt: string
}

/** 一次建档请求的回执。相同 requestId 再次提交时返回原来的物料。旧数据可以没有生命周期字段。 */
export interface MaterialCreateReceipt {
  requestId: string
  skuId: string
  planningId: string
  materialCode: string
  createdTime: string
  /** 缺省表示早期回执，仍按物料是否还在来判断。删除后保留回执并标成 deleted。 */
  lifecycle?: 'active' | 'deleted'
  deletedTime?: string
  /** 行内容身份。不含文件名。旧回执没有该字段时仍按 requestId 判重。 */
  sourceDigest?: string
}

export interface Brand {
  id: string
  name: string
  logo: string
  description: string
  status: 'enabled' | 'disabled'
}

export interface ProductGroup {
  id: string
  name: string
  parentId: string | null
}

export interface AppUser {
  roleIds?: string[]
  id: string
  username: string
  displayName: string
  role: UserRole
  enabled: boolean
}

export interface FeedbackAttachmentRef {
  id: string
  name: string
  type: string
  size: number
}

export interface FeedbackItem {
  id: string
  title: string
  content: string
  status: FeedbackStatus
  page: string
  createdAt: string
  /** 缺省表示 1F 之前的历史反馈，不能靠标题猜测类型。 */
  kind?: FeedbackKind
  route?: string
  featureId?: string
  featureName?: string
  /** Optional knowledge source; old feedback identities and attachment storage stay unchanged. */
  articleId?: string
  ruleId?: string
  pageId?: string
  actionId?: string
  contentRevision?: number
  attachmentRefs?: FeedbackAttachmentRef[]
  /** 导出过反馈包的时间。只说明本机导出过，不代表开发人员已收到。 */
  exportedAt?: string
}

export interface ColumnPref {
  key: string
  label: string
  visible: boolean
  fixed?: boolean
}

export interface ListQuery {
  keyword: string
  categoryId: string
  brand: string
  status: '' | SaleStatus
  templateId: string
  productGroupId: string
  attrFilters: Record<string, string>
  createdFrom: string
  createdTo: string
  shelf: '' | ShelfStatus
  page: number
  pageSize: number
  sortProp: string
  sortOrder: 'ascending' | 'descending' | null
}

export interface ListView {
  id: string
  name: string
  query: ListQuery
  columns: ColumnPref[]
  /** 4C 起的筛选快照。旧预设没有时，仍按 query 恢复。 */
  keyword?: string
  viewFilters?: ProductListViewFilter[]
}

/** 商品列表里的一列。身份是 key，顺序看 order。 */
export interface ProductListColumnConfig {
  key: string
  visible: boolean
  order: number
  width?: number
  frozen?: 'left' | 'right' | false
}

export type ProductListFilterOperator = 'contains' | 'notContains' | 'eq' | 'neq' | 'in' | 'before' | 'after' | 'between'

/** 一条视图筛选。多个字段之间是并且，同一条里的多选值是或者。 */
export interface ProductListViewFilter {
  id: string
  field: string
  operator: ProductListFilterOperator
  value: string | string[] | { from?: string; to?: string }
}

export interface ProductListFieldOrder {
  field: string
  direction: 'asc' | 'desc'
}

export type ProductListSortMode = 'default' | 'field' | 'manual'

/** 某个 SPU 或 SKU 模式下的查询配置。 */
export interface ProductListModeQuery {
  keyword: string
  filters: ProductListViewFilter[]
  exposed: string[]
  grouping: ProductListFieldOrder | null
  sorting: ProductListFieldOrder | null
  /** 缺省时：有字段排序按字段，否则按默认顺序。 */
  sortMode?: ProductListSortMode
}

/** 手工展示顺序。只存稳定 id，不复制商品。 */
export interface ProductListManualOrder {
  spuIds: string[]
  skuIds: string[]
}

export type CategoryFilterLayout = 'popover' | 'sidebar' | 'hidden'

/** 商品列表的展示视图。只保存查看方式、列和查询配置，不复制商品。 */
export interface ProductListSavedView {
  id: string
  name: string
  mode: ProductListMode
  spuColumns: ProductListColumnConfig[]
  skuColumns: ProductListColumnConfig[]
  spuQuery?: ProductListModeQuery
  skuQuery?: ProductListModeQuery
  manualOrder?: ProductListManualOrder
  /** 分类树放在顶部、左侧，或先隐藏。旧视图缺省为顶部悬浮。 */
  categoryFilterLayout?: CategoryFilterLayout
  createdAt: string
  updatedAt: string
  skuWorkbench?: SkuViewConfig
}

export interface Profile {
  displayName: string
  username: string
}

export interface AppData {
  rbac?: import('./rbac').RbacState
  materialRelations?: import('./materialRelations').MaterialRelation[]
  materialContributions?: import('./materialRelations').MaterialContribution[]
  businessDefinitions?: import('./nodeBusiness').BusinessDefinition[]
  /** Optional V15 extension. No historical SKU/MAT or declaration is backfilled on load. */
  templateCompatibilityConfigs?: TemplateCompatibilityConfig[]
  templateCompatibilityOrigins?: TemplateCompatibilityOrigin[]
  /** V14：两个管理页各自持有视图、筛选预设和分页；旧字段保留用于历史兼容。 */
  productListPages?: Record<ProductListMode, ProductListPageState>
  mode: AppMode
  activeRole: UserRole
  categories: Category[]
  productTypes: ProductType[]
  templates: CatalogTemplate[]
  params: ParamDef[]
  templateParams: TemplateParam[]
  mappings: CategoryMapping[]
  productSpecNodes: ProductSpecNode[]
  specCanvases: SpecCanvasConfig[]
  specModelVersions: SpecModelVersion[]
  productPlans: ProductPlan[]
  /** 完整规格组合的规划档。旧数据没有时保持空数组，不在读取时补编号。 */
  planningRecords: PlanningRecord[]
  /** 建档请求回执。旧数据没有时保持空数组。 */
  materialReceipts: MaterialCreateReceipt[]
  /** 配件适用哪些主机。旧数据没有时保持空数组，不改已有物料。 */
  compatibilities: CompatibilityLink[]
  /** Optional preference-independent compatibility catalogue; no business record is synthesized. */
  deviceModels?: DeviceModel[]
  deviceBindings?: DeviceBinding[]
  /** Independent package configurations and immutable confirmed delivery snapshots. */
  benefitFrameworks?: BenefitFramework[]
  benefitPackages?: BenefitPackage[]
  benefitDeliveries?: BenefitDeliverySnapshot[]
  /** 规划节点上的适用主机。旧数据没有时保持空数组，不回填历史物料。 */
  nodeCompatibilityRules: NodeCompatibilityRule[]
  rules: SpecRule[]
  families: ProductFamily[]
  skus: Sku[]
  productGroups: ProductGroup[]
  brands: Brand[]
  users: AppUser[]
  feedbacks: FeedbackItem[]
  profile: Profile
  columns: ColumnPref[]
  listViews: ListView[]
  activeViewId: string
  listQuery: ListQuery
  /**
   * 旧版列表模式。迁移后只镜像当前视图的 mode，不再单独决定展示。
   * 旧数据没有视图时，用它生成默认视图。
   */
  productListMode?: ProductListMode
  /** 商品列表展示视图。旧数据没有时只补一个默认视图。 */
  productListViews?: ProductListSavedView[]
  /** 当前展示视图。已有选择时，打开页面不会改掉。 */
  activeProductListViewId?: string
}

export interface ProductListPageState {
  views: ProductListSavedView[]
  activeId: string
  query: ListQuery
  presets: ListView[]
  activePresetId: string
  skuWorkbench?: SkuWorkbenchState
}

export interface FieldIssue {
  level: IssueLevel
  kind: IssueKind
  message: string
  skuId?: string
  paramId?: string
  paramName?: string
  /** 当前取值，展开详情时使用 */
  value?: string
  /** 规则原文，例如允许的取值 */
  detail?: string
}

export interface ConstraintResult {
  status: ConstraintStatus
  values: string[]
  message: string
}

export interface MatrixCell {
  state: 'missing' | 'ok' | 'incomplete' | 'illegal' | 'empty-axis'
  skuId?: string
  familyId?: string
  label: string
}

export interface MatrixRow {
  key: string
  path: string[]
  cells: MatrixCell[]
}

export interface MatrixModel {
  rowParams: string[]
  colParam: string
  colValues: string[]
  rows: MatrixRow[]
  v2: boolean
}

export interface TreeNode {
  key: string
  label: string
  empty: boolean
  levelName: string
  skuId?: string
  familyId?: string
  children: TreeNode[]
}
