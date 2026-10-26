import { RBAC_ENFORCEMENT_ENABLED } from './accessMode'
import type { AppData, Sku } from './types'
import { modelDictionaryPermissions, type ModelDictionaryBatchInput } from './modelDictionaryCommands'
import { isMaterialArchive } from './catalogIdentity'
import { adminPage, defaultMenuNodes, type MenuNode } from './menuConfig'

export interface RbacPermission {
  code: string
  name: string
  module: string
  resource: string
  action: string
  kind: 'page' | 'operation'
  route?: string
  description: string
  enabled: boolean
  builtIn: true
  dependsOn?: string[]
}
export interface RbacRole {
  id: string
  code: string
  name: string
  description: string
  enabled: boolean
  builtIn?: boolean
  superAdmin?: boolean
  permissionCodes: string[]
}
export interface RbacState { version: 1; guideAccessVersion?: 1; salesAccessVersion?: 1; roles: RbacRole[]; permissions: RbacPermission[] }
type AuthorizationData = AppData & { rbac?: RbacState }
export const SUPER_ROLE_ID = 'role:super-admin'
export const OPERATOR_ROLE_ID = 'role:operator'
export const RECOVERY_PERMISSIONS = ['system:menu:read', 'system:menu:update', 'system:role:read', 'system:role:grant', 'system:user:read', 'system:user:bind', 'system:permission:read', 'system:permission:update']

const resources: { module: string; resource: string; label: string; route: string; actions: string[] }[] = [
  { module: '系统管理', resource: 'guide', label: '系统功能说明', route: '/guide', actions: ['update'] },
  { module: '商品中心', resource: 'workbench', label: '商品工作台', route: '/', actions: [] },
  { module: '商品中心', resource: 'spu', label: 'SPU', route: '/spus', actions: ['create','update','delete','publish'] },
  { module: '商品中心', resource: 'sku', label: '销售 SKU', route: '/skus', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'material', label: '物料档案', route: '/materials', actions: ['create','update','delete','import'] },
  { module: '商品中心', resource: 'model', label: '商品模型', route: '/models', actions: ['create','update','delete','publish'] },
  { module: '商品中心', resource: 'model-designer', label: '商品模型设计', route: '/specs', actions: [] },
  { module: '商品中心', resource: 'template', label: '属性方案', route: '/templates', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'dictionary', label: '属性词典', route: '/params', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'type', label: '产品类型', route: '/product-types', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'category', label: '商品分类', route: '/categories', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'rule', label: '规格约束', route: '/rules', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'brand', label: '品牌', route: '/brands', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'group', label: '运营分组', route: '/groups', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'compatibility', label: '适用关系与设备型号', route: '/compatibility', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'benefit', label: '权益包', route: '/benefit-packages', actions: ['create','update'] },
  { module: '商品中心', resource: 'sales', label: '销售选购', route: '/sales-shopping', actions: [] },
  { module: '商品中心', resource: 'sales-config', label: '销售选配配置', route: '/sales-configurations', actions: ['create','update','publish'] },
  { module: '商品中心', resource: 'framework', label: '权益包框架', route: '/benefit-packages', actions: ['create','update','delete'] },
  { module: '商品中心', resource: 'delivery', label: '交付清单', route: '/benefit-packages', actions: ['create','export'] },
  { module: '商品中心', resource: 'view', label: '列表视图与列配置', route: '/products?panel=columns', actions: ['update'] },
  { module: '开发工具', resource: 'import', label: '商品导入', route: '/import', actions: ['execute'] },
  { module: '开发工具', resource: 'export', label: '商品导出', route: '/import', actions: ['execute'] },
  { module: '开发工具', resource: 'planning', label: '商品规划', route: '/plans', actions: ['create','update','delete'] },
  { module: '开发工具', resource: 'tree', label: '商品结构视图', route: '/tree', actions: [] },
  { module: '商品分析', resource: 'overview', label: '商品总览', route: '/overview', actions: [] },
  { module: '商品分析', resource: 'check', label: '商品质量检查', route: '/check', actions: [] },
  { module: '系统管理', resource: 'menu', label: '菜单', route: '/menus', actions: ['update'] },
  { module: '系统管理', resource: 'role', label: '角色', route: '/roles', actions: ['create','update','delete','grant'] },
  { module: '系统管理', resource: 'permission', label: '权限目录', route: '/permissions', actions: ['update'] },
  { module: '系统管理', resource: 'user', label: '用户', route: '/users', actions: ['create','update','delete','bind'] },
  { module: '系统管理', resource: 'feedback', label: '反馈', route: '/feedback', actions: ['create','update','delete','import','export'] },
  { module: '系统管理', resource: 'account', label: '账号资料', route: '/account', actions: ['update'] },
  { module: '系统管理', resource: 'data', label: '演示数据重置', route: '', actions: ['reset'] },
]
const actionLabels: Record<string,string> = { read:'查看',create:'新增',update:'编辑',delete:'删除',publish:'发布／上下架',import:'导入',export:'导出',execute:'执行',grant:'配置授权',bind:'绑定角色',reset:'重置' }
export function permissionRegistry(): RbacPermission[] {
  return resources.flatMap(item => {
    const prefix = item.module === '系统管理' ? 'system' : 'product'
    const actions = item.route && !['framework','export'].includes(item.resource) ? ['read', ...item.actions] : item.actions
    const readResource = item.resource === 'framework' ? 'benefit' : item.resource === 'export' ? 'import' : item.resource
    return actions.map(action => ({ code:`${prefix}:${item.resource}:${action}`, name:`${actionLabels[action] || action}${item.label}`, module:item.module, resource:item.resource, action,
      kind: action === 'read' ? 'page' as const : 'operation' as const,
      ...(item.route ? { route:item.route } : {}), enabled:true, builtIn:true as const,
      description: item.resource==='guide'&&action==='update' ? '旧指南维护权限编码兼容保留；系统功能说明现为只读，无内容写入入口。' : action === 'read' ? `访问${item.label}的已登记页面；隐藏菜单不撤销此权限。` : `${actionLabels[action] || action}${item.label}。不会隐式授予依赖权限；保存前须单独选择查看权限。`,
      ...(action !== 'read' && item.route ? { dependsOn:[`${prefix}:${readResource}:read`] } : {}),
    }))
  })
}

/** Canonical access requirements for actual routes, independent of navigation visibility. */
export function routePermissions(path: string, query: Record<string,unknown> = {}): string[] | null {
  const clean = path.split('?')[0] || '/'
  // Retired maintenance routes redirect to the read-only module; keep stored permission codes compatible.
  if(clean==='/guide/manage'||clean==='/guide/learn')return ['system:guide:read']
  if(clean==='/guide'||/^\/guide\/(articles|learn)\/[^/]+$/.test(clean))return ['system:guide:read']
  if (clean === '/forbidden') return []
  if (clean === '/sales-shopping') return ['product:sales:read']
  if (clean === '/sales-configurations') return ['product:sales-config:read']
  if (clean === '/columns' || (['/products','/spus','/skus'].includes(clean) && query.panel === 'columns')) return ['product:view:read', clean === '/skus' ? 'product:sku:read' : 'product:spu:read']
  if (clean === '/products/new') return ['product:spu:read','product:spu:create']
  if (/^\/products\/[^/]+$/.test(clean)) {
    if (query.sku) return ['product:sku:read'] // The legacy redirect resolves MAT/SKU identity before final destination guard.
    if (query.add || query.copySku) return ['product:sku:read','product:sku:create']
    return ['product:spu:read']
  }
  const exact: Record<string,string> = { '/':'product:workbench:read','/products':'product:spu:read','/spus':'product:spu:read','/skus':'product:sku:read','/materials':'product:material:read','/models':'product:model:read','/specs':'product:model-designer:read','/templates':'product:template:read','/params':'product:dictionary:read','/product-types':'product:type:read','/categories':'product:category:read','/rules':'product:rule:read','/mappings':'product:template:read','/brands':'product:brand:read','/groups':'product:group:read','/compatibility':'product:compatibility:read','/benefit-packages':'product:benefit:read','/import':'product:import:read','/plans':'product:planning:read','/tree':'product:tree:read','/overview':'product:overview:read','/check':'product:check:read','/menus':'system:menu:read','/roles':'system:role:read','/permissions':'system:permission:read','/users':'system:user:read','/feedback':'system:feedback:read','/account':'system:account:read' }
  if (exact[clean]) return [exact[clean]]
  for (const [base, resource] of [['spus','spu'],['skus','sku'],['materials','material'],['benefit-packages','benefit']] as const) {
    if (clean === `/${base}/new`) return [`product:${resource}:read`,`product:${resource}:create`]
    if (new RegExp(`^/${base}/[^/]+$`).test(clean)) return [`product:${resource}:read`]
  }
  if (/^\/benefit-packages\/deliveries\/[^/]+$/.test(clean)) return ['product:delivery:read']
  return null
}

function state(data: AppData) { return (data as AuthorizationData).rbac }
function roleIds(user: AppData['users'][number]): string[] { return (user as typeof user & {roleIds?:string[]}).roleIds || [] }
export function effectivePermissions(data: AppData, userId: string): Set<string> {
  if (!RBAC_ENFORCEMENT_ENABLED) return new Set(permissionRegistry().map(permission => permission.code))
  const user = data.users.find(item => item.id === userId && item.enabled)
  const rbac = state(data)
  if (!user || !rbac) return new Set()
  const active = new Set(rbac.permissions.filter(permission => permission.enabled).map(permission => permission.code))
  const granted = new Set(rbac.roles.filter(role => role.enabled && roleIds(user).includes(role.id)).flatMap(role => role.permissionCodes).filter(code => active.has(code)))
  let changed = true
  while (changed) { changed = false; for (const permission of rbac.permissions) if (granted.has(permission.code) && permission.dependsOn?.some(code => !granted.has(code))) { granted.delete(permission.code); changed = true } }
  return granted
}
export function canPermission(data: AppData, userId: string, code: string): boolean { return effectivePermissions(data,userId).has(code) }
export function isSuperAdmin(data: AppData, userId: string): boolean {
  if (!RBAC_ENFORCEMENT_ENABLED) return true
  const user = data.users.find(item => item.id === userId && item.enabled)
  return Boolean(user && state(data)?.roles.some(role => role.id === SUPER_ROLE_ID && role.code === 'super-admin' && role.builtIn === true && role.superAdmin === true && role.enabled && roleIds(user).includes(role.id)))
}

function legacyAllowed(nodes: MenuNode[], route: string) {
  if (adminPage(route)) return false
  let node = nodes.find(item => item.kind === 'page' && item.route === route)
  if (!node) return false
  const seen = new Set<string>()
  while (node) {
    if (seen.has(node.id) || !node.roles.includes('operator')) return false
    seen.add(node.id)
    if (!node.parentId) return node.kind === 'center'
    node = nodes.find(item => item.id === node!.parentId)
    if (!node) return false
  }
  return false
}

/** Pure candidate migration: callers validate and persist the candidate before switching live memory. */
export function ensureRbac(data: AppData, legacyMenus: MenuNode[] = defaultMenuNodes()): void {
  if (Object.prototype.hasOwnProperty.call(data,'rbac')) {
    // One-time additive capability migration. Existing/custom grants remain authoritative.
    const saved=state(data), additions=permissionRegistry().filter(permission=>permission.resource==='guide')
    if(saved&&saved.guideAccessVersion===undefined&&Array.isArray(saved.permissions)&&Array.isArray(saved.roles)&&additions.every(permission=>!saved.permissions.some(old=>old?.code===permission.code))){
      saved.permissions.push(...additions)
      for(const role of saved.roles){
        if(!role||!Array.isArray(role.permissionCodes)||!role.builtIn)continue
        const codes=role.id===SUPER_ROLE_ID&&role.code==='super-admin'&&role.superAdmin?additions.map(p=>p.code):role.id===OPERATOR_ROLE_ID&&role.code==='operator'?['system:guide:read']:[]
        role.permissionCodes=[...new Set([...role.permissionCodes,...codes])]
      }
    }
    if(saved&&saved.guideAccessVersion===undefined)saved.guideAccessVersion=1
    const sales=permissionRegistry().filter(permission=>['sales','sales-config'].includes(permission.resource))
    if(saved&&saved.salesAccessVersion===undefined&&Array.isArray(saved.permissions)&&Array.isArray(saved.roles)&&sales.every(permission=>!saved.permissions.some(old=>old?.code===permission.code))){
      saved.permissions.push(...sales)
      // Custom/operator grants remain explicit. Only the protected administrator
      // receives the newly registered maintenance capabilities during migration.
      const admin=saved.roles.find(role=>role.id===SUPER_ROLE_ID&&role.code==='super-admin'&&role.builtIn&&role.superAdmin)
      if(admin&&Array.isArray(admin.permissionCodes))admin.permissionCodes=[...new Set([...admin.permissionCodes,...sales.map(p=>p.code)])]
    }
    if(saved&&saved.salesAccessVersion===undefined)saved.salesAccessVersion=1
    const problems = rbacProblems(data)
    if (problems.length) throw new Error(`授权数据校验失败：${problems.join(' ')}`)
    return
  }
  if (!Array.isArray(data.users)) throw new Error('授权迁移失败：用户数组损坏，原始内容应保留。')
  const permissions = permissionRegistry()
  const operatorCodes = permissions.filter(permission => permission.action === 'read' && permission.route && legacyAllowed(legacyMenus,permission.resource === 'material' ? '/spus' : permission.route)).map(permission => permission.code)
  ;(data as AuthorizationData).rbac = { version:1, guideAccessVersion:1, salesAccessVersion:1, permissions, roles:[
    { id:SUPER_ROLE_ID,code:'super-admin',name:'超级管理员',description:'受保护的内置恢复身份。',enabled:true,builtIn:true,superAdmin:true,permissionCodes:permissions.map(permission => permission.code) },
    { id:OPERATOR_ROLE_ID,code:'operator',name:'只读运营',description:'由旧运营菜单访问范围迁移，只读；新增功能不会自动授权。',enabled:true,builtIn:true,superAdmin:false,permissionCodes:operatorCodes },
  ] }
  data.users = data.users.map(user => ({ ...user, roleIds:[user.role === 'admin' ? SUPER_ROLE_ID : OPERATOR_ROLE_ID] }))
  const problems = rbacProblems(data)
  if (problems.length) throw new Error(`授权迁移失败：${problems.join(' ')}`)
}

const object = (value: unknown): value is Record<string,unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value:unknown) => typeof value === 'string' && Boolean(value.trim())
export function rbacProblems(data: AppData): string[] {
  // In the current unrestricted mode stored grants are dormant configuration. Keep
  // obsolete codes/bindings verbatim; only reject structures the retained editor cannot read.
  if (!RBAC_ENFORCEMENT_ENABLED) {
    const saved: unknown = state(data)
    if (!object(saved) || saved.version !== 1 || !Array.isArray(saved.roles) || !Array.isArray(saved.permissions)) return ['授权配置容器损坏，原始内容已保留。']
    if (saved.roles.some(role => !object(role) || !text(role.id) || !text(role.code) || !text(role.name) || !Array.isArray(role.permissionCodes) || !role.permissionCodes.every(code => typeof code === 'string'))) return ['角色配置结构损坏，原始内容已保留。']
    if (saved.permissions.some(permission => !object(permission) || !text(permission.code) || !text(permission.name))) return ['权限配置结构损坏，原始内容已保留。']
    if (!Array.isArray(data.users) || data.users.some(user => !user || !text(user.id) || !text(user.username) || !text(user.displayName))) return ['用户配置结构损坏，原始内容已保留。']
    return []
  }
  const problems: string[] = [], rbac: unknown = state(data)
  if (!object(rbac) || rbac.version !== 1 || !Array.isArray(rbac.roles) || !Array.isArray(rbac.permissions)) return ['授权容器或版本无效。']
  if(rbac.guideAccessVersion!==undefined&&rbac.guideAccessVersion!==1)problems.push('指南授权迁移标记无效。')
  if(rbac.salesAccessVersion!==undefined&&rbac.salesAccessVersion!==1)problems.push('销售配置授权迁移标记无效。')
  const registered = new Map(permissionRegistry().map(permission => [permission.code,permission]))
  const codes = new Set<string>(), roleSet = new Set<string>(), roleCodes = new Set<string>()
  for (const value of rbac.permissions) {
    if (!object(value) || !text(value.code) || !text(value.name) || typeof value.description !== 'string' || typeof value.enabled !== 'boolean') { problems.push('权限记录缺少必要字段。'); continue }
    const code = value.code as string, original = registered.get(code)
    if (!original || codes.has(code)) { problems.push(`权限码未登记或重复：${code}`); continue }
    codes.add(code)
    for (const key of ['module','resource','action','kind','route','builtIn'] as const) if (value[key] !== original[key]) problems.push(`内置权限执行绑定不能修改：${code}`)
    if (JSON.stringify(value.dependsOn) !== JSON.stringify(original.dependsOn)) problems.push(`权限依赖绑定不能修改：${code}`)
  }
  if (codes.size !== registered.size) problems.push('内置权限目录缺项，不能丢弃执行绑定。')
  for (const value of rbac.roles) {
    if (!object(value) || !text(value.id) || !text(value.code) || !text(value.name) || typeof value.description !== 'string' || typeof value.enabled !== 'boolean' || !Array.isArray(value.permissionCodes) || !value.permissionCodes.every(code => typeof code === 'string')) { problems.push('角色记录缺少必要字段。'); continue }
    const id = value.id as string, code = value.code as string
    if (value.builtIn !== undefined && typeof value.builtIn !== 'boolean' || value.superAdmin !== undefined && typeof value.superAdmin !== 'boolean') problems.push(`角色保护标记无效：${code}`)
    if (roleSet.has(id) || roleCodes.has(code) || !/^[a-z][a-z0-9._-]*$/.test(code)) problems.push(`角色 ID/编码重复或编码不合法：${code}`)
    roleSet.add(id); roleCodes.add(code)
    if (value.permissionCodes.some(permission => !codes.has(permission)) || new Set(value.permissionCodes).size !== value.permissionCodes.length) problems.push(`角色引用未知或重复权限：${code}`)
    if (value.superAdmin === true && (id !== SUPER_ROLE_ID || code !== 'super-admin' || value.builtIn !== true)) problems.push('普通角色不能取得超级管理员标记。')
    if (value.builtIn === true && ![SUPER_ROLE_ID,OPERATOR_ROLE_ID].includes(id)) problems.push('普通角色不能伪装为内置角色。')
    if (id !== SUPER_ROLE_ID && value.permissionCodes.includes('system:data:reset')) problems.push('数据重置仅限内置超级管理员。')
    const dependencies = missingPermissionDependencies(value.permissionCodes as string[])
    if (dependencies.length) problems.push(`角色 ${code} 缺少显式依赖：${dependencies.join('、')}`)
    if (id === SUPER_ROLE_ID && (code !== 'super-admin' || value.builtIn !== true || value.superAdmin !== true)) problems.push('内置超级管理员身份不能修改。')
    if (id === OPERATOR_ROLE_ID && (code !== 'operator' || value.builtIn !== true)) problems.push('内置运营角色身份不能修改。')
  }
  const userIds = new Set<string>(), usernames = new Set<string>()
  if (!Array.isArray(data.users)) problems.push('用户容器无效。')
  else for (const user of data.users) {
    if (!object(user) || !text(user.id) || !text(user.username) || !text(user.displayName) || typeof user.enabled !== 'boolean' || !Array.isArray(user.roleIds) || !user.roleIds.every(id => typeof id === 'string' && roleSet.has(id))) { problems.push('用户字段或角色绑定无效。'); continue }
    if (userIds.has(user.id as string) || usernames.has(user.username as string) || new Set(user.roleIds).size !== user.roleIds.length) problems.push('用户 ID、账号或角色绑定重复。')
    userIds.add(user.id as string); usernames.add(user.username as string)
  }
  if (!problems.length) {
    const typed = rbac as unknown as RbacState
    const superRole = typed.roles.find(role => role.id === SUPER_ROLE_ID)
    const permissions = new Set(typed.permissions.filter(permission => permission.enabled).map(permission => permission.code))
    if (!superRole?.enabled || !data.users.some(user => user.enabled && roleIds(user).includes(SUPER_ROLE_ID))) problems.push('必须保留至少一个有效超级管理员。')
    if (!superRole || RECOVERY_PERMISSIONS.some(code => !permissions.has(code) || !superRole.permissionCodes.includes(code))) problems.push('必须保留完整的授权管理恢复路径。')
  }
  return [...new Set(problems)]
}

/** Exact permission dependency checks, surfaced by the UI instead of silently widening grants. */
export function missingPermissionDependencies(codes: string[], permissions = permissionRegistry()): string[] {
  const selected = new Set(codes)
  return [...new Set(permissions.filter(permission => selected.has(permission.code)).flatMap(permission => permission.dependsOn || []).filter(code => !selected.has(code)))]
}

/** Shared backing records are classified by stable model ownership, never by their name. */
export function templateAccessResource(data: AppData, template: string | {id?: string}): 'model' | 'template' {
  const id = typeof template === 'string' ? template : template.id
  return data.specCanvases.some(canvas => canvas.templateId === id && Boolean(canvas.productTypeId)) ? 'model' : 'template'
}

/** Either end can carry an already effective binding; disabling it is a publication change too. */
export function salesBindingNeedsPublish(previous: { enabled?: boolean } | undefined, next: { enabled?: boolean } | undefined): boolean {
  return previous?.enabled === true || next?.enabled === true
}

/** Store command bindings. An unknown command fails closed. These are execution points, not labels. */
export function commandPermissions(name: string, args: unknown[] = [], data?: AppData): string[] {
  if (name === 'commitModelDictionaryBatch') {
    const input = args[0] as ModelDictionaryBatchInput | undefined
    const codes = data ? modelDictionaryPermissions(data, input as ModelDictionaryBatchInput) : ['product:model:update']
    if (data && typeof input?.modelId === 'string' && templateAccessResource(data, input.modelId) === 'template') codes.push('product:template:update')
    return [...new Set(codes)]
  }
  if (name === 'undoModelDictionaryBatch') {
    const entry = args[0] as { modelId?: string; dictionary?: { before?: unknown }[] } | undefined
    return [...new Set(['product:model:update', ...(data && typeof entry?.modelId === 'string' && templateAccessResource(data, entry.modelId) === 'template' ? ['product:template:update'] : []), ...(Array.isArray(entry?.dictionary) ? entry.dictionary.map(change => change.before ? 'product:dictionary:update' : 'product:dictionary:create') : [])])]
  }
  const first = args[0] as Record<string,unknown> | undefined
  const save = (resource:string, exists:boolean) => [`product:${resource}:${exists ? 'update' : 'create'}`]
  if(name==='saveSalesOptionPlan')return save('sales-config',Boolean((first?.draft as {id?:string})?.id))
  if(name==='publishSalesOptionPlan'||name==='setSalesOptionPlanStatus')return ['product:sales-config:publish']
  if(name==='saveSalesOptionBinding'||name==='saveSalesOptionBindings'){
    const drafts=name==='saveSalesOptionBinding'?[first?.draft]:first?.drafts
    const formal=Array.isArray(drafts)&&drafts.some(value=>{const draft=value as {id?:string;enabled?:boolean}|undefined;return salesBindingNeedsPublish(data?.salesOptionBindings?.find(row=>row.id===draft?.id),draft)})
    return ['product:sales-config:update',...(formal?['product:sales-config:publish']:[])]
  }
  if(name==='saveSalesProductRelation')return save('compatibility',Boolean((first?.draft as {id?:string})?.id))
  if (name === 'saveRbacRole') return [`system:role:${(data ? state(data) : undefined)?.roles.some(role => role.id === first?.id) ? 'update' : 'create'}`]
  if (name === 'saveRbacUser') return [`system:user:${data?.users.some(user => user.id === first?.id) ? 'update' : 'create'}`]
  if (name === 'saveSpu') {
    const existing = data?.families.find(family => family.id === first?.id)
    const previousStatus=existing?.shelfStatus || (existing?.lifecycle==='ready' ? 'online' : 'draft')
    const nextStatus=first?.shelfStatus || (first?.lifecycle==='ready' ? 'online' : 'draft')
    return [...save('spu',Boolean(existing)), ...((existing ? previousStatus !== nextStatus : nextStatus==='online') ? ['product:spu:publish'] : [])]
  }
  if (name === 'saveBundle') return [...commandPermissions('saveSpu',args,data), ...((args[1] as {id:string}[] || []).flatMap(sku => save('sku',Boolean(data?.skus.some(item => item.id === sku.id)))))]
  if (name === 'saveBrand') {
    const codes = save('brand',Boolean(data?.brands.some(brand => brand.id === first?.id)))
    const name = String(first?.name || '').trim()
    const dictionary = data?.params.find(param => param.name === '品牌')
    if (dictionary && name && !dictionary.values.includes(name)) codes.push('product:dictionary:update')
    return codes
  }
  if (name === 'saveRule') return save('rule',Boolean(data?.rules.some(rule => rule.id === first?.id)))
  if (name === 'saveTemplateScheme') {
    const id=typeof first?.id==='string'?first.id:''
    const resource=id&&data?templateAccessResource(data,id):'template'
    return [`product:${resource}:${id?'update':'create'}`,...(first?.sourceId?[`product:${data?templateAccessResource(data,String(first.sourceId)):'template'}:read`]:[])]
  }
  if (name === 'restoreSuperAdminAccess') return ['system:role:grant']
  if (['removeSku','patchSku','editSku'].includes(name)) {
    const sku = data?.skus.find(item => item.id === args[0])
    const resource = sku && data && isMaterialArchive(data,sku as Sku) ? 'material' : 'sku'
    return [`product:${resource}:${name === 'removeSku' ? 'delete' : 'update'}`]
  }
  if (name === 'setCategoryMapping') {
    const ids=[data?.mappings.find(item=>item.categoryId===args[0])?.templateId,String(args[1]||'')].filter(Boolean) as string[]
    return [...new Set((ids.length?ids:['']).map(id=>`product:${data?templateAccessResource(data,id):'template'}:update`))]
  }
  if (name === 'saveProductType') return save('type',Boolean(data?.productTypes.some(item => item.id === first?.id)))
  if (name === 'saveDeviceModel') return save('compatibility',Boolean(data?.deviceModels?.some(item => item.id === first?.id)))
  if (name === 'saveBenefitPackage') return save('benefit',Boolean((first?.draft as {id?:string})?.id && data?.benefitPackages?.some(item => item.id === (first?.draft as {id?:string}).id)))
  if (name === 'saveBenefitFramework') return save('framework',Boolean((first?.draft as {id?:string})?.id && data?.benefitFrameworks?.some(item => item.id === (first?.draft as {id?:string}).id)))
  if (name === 'commitCompatibilityChanges') return [...new Set((args[0] as {kind:string}[] || []).map(change => `product:compatibility:${change.kind === 'remove' ? 'delete' : change.kind === 'add' ? 'create' : 'update'}`))]
  if (name === 'removeTemplate') return [`product:${data ? templateAccessResource(data,String(args[0])) : 'template'}:delete`]
  const bindings: Record<string,string[]> = {
    saveTemplateCompatibility:['product:model:update'],applyTemplateCompatibilitySync:['product:compatibility:update'],saveModelDraft:['product:model:update'],saveNodeBusiness:['product:model:update'],saveBusinessDefinition:['product:model:update'],copyProductModel:['product:model:create'],createProductModel:['product:model:create'],publishSpecModel:['product:model:publish'],removeSpecNode:['product:model:update'],shiftSpecNode:['product:model:update'],
    commitMaterialImport:['product:material:import'],createMaterial:['product:material:create'],createTemporary:['product:material:create'],saveMaterialRelation:['product:material:create'],unlinkMaterialRelation:['product:material:delete'],updateMaterial:['product:material:update'],renameProduct:['product:material:update'],markPlanningGrades:['product:planning:update'],
    appendSkus:['product:sku:create'],editSku:['product:sku:update'],patchSku:['product:sku:update'],setSkuStatus:['product:sku:update'],removeSku:['product:sku:delete'],removeFamily:['product:spu:delete'],
    removeBenefitFramework:['product:framework:delete'],setBenefitPackageStatus:['product:benefit:update'],setBenefitPackageFavorite:['product:benefit:update'],generateBenefitDelivery:['product:delivery:create'],
    commitDeviceBinding:['product:compatibility:update'],clearDeviceBinding:['product:compatibility:update'],removeDeviceModel:['product:compatibility:delete'],
    addParamValue:['product:dictionary:update'],appendDictionaryValues:['product:dictionary:update'],removeParam:['product:dictionary:delete'],removeParamValue:['product:dictionary:update'],removeProductType:['product:type:delete'],setProductTypeStatus:['product:type:update'],
    commitCategoryMove:['product:category:update'],commitCategoryMoves:['product:category:update'],renameCategoryName:['product:category:update'],
    addCategory:['product:category:create'],copyCategory:['product:category:create'],moveCategory:['product:category:update'],shiftCategory:['product:category:update'],relocateCategory:['product:category:update'],updateCategory:['product:category:update'],removeCategory:['product:category:delete'],setCategoryMapping:['product:template:update'],removeGroup:['product:group:delete'],
    commitSpuPage:['product:view:update'],commitSkuPage:['product:sku:read'],saveView:['product:view:update'],applyView:['product:spu:read'],removeView:['product:view:update'],
    exportJson:['product:export:execute'],importJson:['product:import:execute'],resetAll:['system:data:reset'],resetModule:['system:data:reset'],
    importFeedbackPack:['system:feedback:import'],markFeedbacksExported:['system:feedback:export'],
    removeRbacRole:['system:role:delete'],grantRbacRole:['system:role:grant'],saveRbacPermission:['system:permission:update'],removeRbacUser:['system:user:delete'],saveMenuStructure:['system:menu:update'],resetMenuStructure:['system:menu:update'],
    saveMenuConfiguration:['system:menu:update'],resetMenuConfiguration:['system:menu:update'],saveRole:['system:role:update'],deleteRole:['system:role:delete'],grantRolePermissions:['system:role:grant'],savePermission:['system:permission:update'],saveUser:['system:user:update'],deleteUser:['system:user:delete'],bindUserRoles:['system:user:bind'],
    previewTemplateCompatibilitySync:['product:model:read'],materialImportBasis:['product:material:read'],skusOf:['product:sku:read'],categoryRemovalBlock:['product:category:read'],productTypesOf:['product:type:read'],blankSku:['product:sku:read'],defaultColumns:[],emptyQuery:[],
  }
  return bindings[name] || ['!unregistered-command']
}
