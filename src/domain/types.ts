export const DATA_VERSION = 6
export const STORAGE_KEY = 'iyge-v2-mock-db'

export type SaleStatus = 'on_sale' | 'off_sale' | 'draft'
export type ParamRole = 'common' | 'variant'
export type ConstraintStatus = 'none' | 'hit' | 'uncovered' | 'empty'
export type AppMode = 'daily' | 'advanced'
export type UserRole = 'operator' | 'admin'
export type IssueLevel = 'error' | 'warn'
export type IssueKind = 'required' | 'duplicate' | 'illegal' | 'uncovered'
export type FeedbackStatus = 'open' | 'doing' | 'done'
export type Origin = 'sample' | 'created'
export type ShelfStatus = 'draft' | 'online' | 'offline'

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
}

/** 一次发布冻结的模型节点。历史商品按 id 读取，不跟随后来的编辑树。 */
export interface SpecModelVersion {
  id: string
  templateId: string
  version: number
  versionName: string
  status: 'published' | 'offline'
  nodesSnapshot: ProductSpecNode[]
  createdTime: string
  publishTime: string
}

/** 画布视口和正在编辑的版本状态。已发布快照在 specModelVersions，不写回这棵编辑树。 */
export interface SpecCanvasConfig {
  templateId: string
  zoom: number
  panX: number
  panY: number
  status: SpecModelStatus
  version: number
  versionName: string
  /** 横向思维导图。旧的上下布局会在打开时转成这一方向。 */
  direction?: 'ltr'
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
  id: string
  familyId: string
  code: string
  oaSkuId: string
  status: SaleStatus
  variantAttrs: Record<string, string>
  projectedAttrs: Record<string, string>
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
  id: string
  username: string
  displayName: string
  role: UserRole
  enabled: boolean
}

export interface FeedbackItem {
  id: string
  title: string
  content: string
  status: FeedbackStatus
  page: string
  createdAt: string
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
}

export interface Profile {
  displayName: string
  username: string
}

export interface AppData {
  mode: AppMode
  activeRole: UserRole
  categories: Category[]
  templates: CatalogTemplate[]
  params: ParamDef[]
  templateParams: TemplateParam[]
  mappings: CategoryMapping[]
  productSpecNodes: ProductSpecNode[]
  specCanvases: SpecCanvasConfig[]
  specModelVersions: SpecModelVersion[]
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
