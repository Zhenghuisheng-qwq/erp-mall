import { ref } from 'vue'
import type { UserRole } from './types'

export const MENU_KEY = 'iyge-menu-config'
export const menuRevision = ref(0)

export type MenuKind = 'center' | 'group' | 'page'

export interface MenuNode {
  id: string
  kind: MenuKind
  title: string
  parentId: string | null
  sort: number
  route: string
  hidden: boolean
  roles: UserRole[]
  permissionCode?: string
  custom?: boolean
}

type StoredMenu = { version: 1; guideCenterVersion?: 1; catalogWorkspaceVersion?: 1; nodes: MenuNode[] }
const catalogTaskRoutes = new Set(['/categories', '/product-types', '/models', '/specs'])

const BOTH: UserRole[] = ['admin', 'operator']
const ADMIN: UserRole[] = ['admin']

export function defaultMenuNodes(): MenuNode[] {
  const center = (id: string, title: string, sort: number, roles: UserRole[]): MenuNode => ({ id, kind: 'center', title, parentId: null, sort, route: '', hidden: false, roles })
  const group = (id: string, title: string, parentId: string, sort: number, roles: UserRole[]): MenuNode => ({ id, kind: 'group', title, parentId, sort, route: '', hidden: false, roles })
  const page = (route: string, title: string, parentId: string, sort: number, roles: UserRole[]): MenuNode => ({ id: `page:${route}`, kind: 'page', title, parentId, sort, route, hidden: false, roles })
  return [
    center('product', '商品中心', 1, BOTH),
    center('tools', '开发工具', 2, ADMIN),
    center('system', '系统管理', 3, ADMIN),
    center('guide', '系统说明', 4, BOTH),
    page('/', '商品工作台', 'product', 1, BOTH),
    page('/sales-shopping', '销售选购', 'product', 1.5, BOTH),
    group('manage', '商品管理', 'product', 2, BOTH),
    group('model', '商品模型配置', 'product', 3, ADMIN),
    group('operate', '商品运营', 'product', 4, BOTH),
    group('analysis', '商品分析', 'product', 5, BOTH),
    group('sales-config', '销售配置', 'product', 4.5, BOTH),
    page('/sales-configurations', '选配方案', 'sales-config', 1, ADMIN),
    page('/spus', 'SPU 管理', 'manage', 1, BOTH),
    page('/skus', 'SKU 管理', 'manage', 1.5, BOTH),
    page('/benefit-packages', '常用组合', 'sales-config', 3, BOTH),
    page('/compatibility', '商品关联与适用关系', 'sales-config', 2, BOTH),
    page('/catalog', '商品资料管理', 'manage', 3, BOTH),
    {...page('/categories', '整理分类（旧入口）', 'manage', 3, BOTH), hidden: true},
    {...page('/product-types', '产品类型（旧入口）', 'manage', 4, BOTH), hidden: true},
    page('/templates', '属性方案', 'model', 1, ADMIN),
    {...page('/models', '商品模型（旧入口）', 'model', 2, ADMIN), hidden: true},
    {...page('/specs', '商品模型设计', 'model', 3, ADMIN), hidden: true},
    page('/params', '属性词典', 'model', 4, ADMIN),
    page('/rules', '规格约束', 'model', 5, ADMIN),
    page('/brands', '品牌中心', 'operate', 1, BOTH),
    page('/groups', '运营分组', 'operate', 2, BOTH),
    page('/overview', '商品总览', 'analysis', 1, BOTH),
    page('/check', '商品质量检查', 'analysis', 2, BOTH),
    page('/tree', '商品结构视图', 'tools', 1, ADMIN),
    page('/plans', '商品规划（旧）', 'tools', 2, ADMIN),
    page('/import', '商品导入导出', 'tools', 3, ADMIN),
    page('/products?panel=columns', '列配置与视图', 'tools', 4, ADMIN),
    page('/users', '用户管理', 'system', 1, ADMIN),
    page('/feedback', '反馈管理', 'system', 2, ADMIN),
    page('/account', '账号设置', 'system', 3, ADMIN),
    page('/menus', '菜单管理', 'system', 4, ADMIN),
    page('/roles', '角色管理', 'system', 5, ADMIN),
    page('/permissions', '权限管理', 'system', 6, ADMIN),
    page('/guide', '系统说明', 'guide', 1, BOTH),
  ]
}

export function allowedRoutes() {
  return defaultMenuNodes().filter((item) => item.kind === 'page').map((item) => item.route)
}

function clone(nodes: MenuNode[]) {
  return nodes.map((item) => ({ ...item, roles: [...item.roles] }))
}

function readStored(): StoredMenu | null {
  try {
    const raw = localStorage.getItem(MENU_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredMenu
    if (parsed.version !== 1 || !Array.isArray(parsed.nodes)) return null
    return parsed
  } catch {
    return null
  }
}

function rolesOf(value: unknown, fallback: UserRole[]): UserRole[] {
  const list = Array.isArray(value) ? value.filter((item): item is UserRole => item === 'admin' || item === 'operator') : fallback
  const roles = new Set<UserRole>(list)
  roles.add('admin')
  return Array.from(roles)
}

export function sanitizeMenu(nodes: MenuNode[]): MenuNode[] {
  // Carry the existing entrance's placement into the new daily entrance once. Keep the
  // original nodes (including hidden/sort/custom-container preferences) for compatibility.
  if (!nodes.some(item => item?.id === 'page:/catalog')) {
    const old = ['/categories', '/product-types', '/models'].map(route => nodes.find(item => item?.id === `page:${route}`)).filter((item): item is MenuNode => Boolean(item))
    const source = old.find(item => !item.hidden) || old[0]
    if (source) nodes = [...nodes, {...source, id: 'page:/catalog', route: '/catalog', title: '商品资料管理', hidden: old.every(item => item.hidden), roles: [...BOTH], permissionCode: undefined}]
  }
  // Inherit customized placement and access from the old product page, once per missing page.
  const legacy = nodes.find(item => item.id === 'page:/products')
  if (legacy) nodes = [...nodes, ...(['/spus', '/skus'] as const).filter(route => !nodes.some(item => item.id === `page:${route}`)).map((route, index) => ({ ...legacy, id: `page:${route}`, route, title: route === '/spus' ? 'SPU 管理' : 'SKU 管理', sort: legacy.sort + index * 0.5, roles: [...legacy.roles] }))]
  const defaults = new Map(defaultMenuNodes().map((item) => [item.id, item]))
  const incoming = clone(nodes.filter(item => item && typeof item.id === 'string').map(item => ({...item,roles:rolesOf(item.roles,BOTH)}))).filter((item) => defaults.has(item.id) || (item.custom && (item.kind === 'group' || item.kind === 'center')))
  const byId = new Map<string, MenuNode>()
  for (const item of defaults.values()) byId.set(item.id, { ...item, roles: [...item.roles] })
  const accepted = new Set<string>()
  for (const item of incoming) {
    if (accepted.has(item.id)) continue
    accepted.add(item.id)
    const base = defaults.get(item.id)
    if (base) {
      byId.set(item.id, {
        ...base,
        title: String(item.title || base.title).trim() || base.title,
        parentId: item.parentId,
        sort: Number.isFinite(item.sort) ? item.sort : base.sort,
        hidden: Boolean(item.hidden),
        roles: rolesOf(item.roles, base.roles),
        ...(item.permissionCode ? { permissionCode: item.permissionCode } : {}),
      })
    } else if (item.custom && (item.kind === 'group' || item.kind === 'center')) {
      const title = String(item.title || '').trim()
      if (!title) continue
      byId.set(item.id, { id: item.id, kind: item.kind, title, parentId: item.kind === 'center' ? null : item.parentId, sort: item.sort || 1, route: '', hidden: Boolean(item.hidden), roles: rolesOf(item.roles, BOTH), custom: true })
    }
  }
  // Only the explanation entrance changes ownership; all other saved menu nodes keep their configuration.
  const guidePage = byId.get('page:/guide')!
  guidePage.parentId = 'guide'
  if (['业务指南', '系统功能说明'].includes(guidePage.title)) guidePage.title = '系统说明'
  if (!accepted.has('guide')) {
    const systemSort = byId.get('system')!.sort
    const nextSort = Math.min(...[...byId.values()].filter(node => node.kind === 'center' && node.id !== 'guide' && node.sort > systemSort).map(node => node.sort))
    byId.get('guide')!.sort = Number.isFinite(nextSort) ? (systemSort + nextSort) / 2 : systemSort + 1
  }
  const list = [...byId.values()]
  const known = new Set(list.map((item) => item.id))
  for (const item of list) {
    const fallback = defaults.get(item.id)
    if (item.kind === 'center') item.parentId = null
    else if (!item.parentId || !known.has(item.parentId)) item.parentId = fallback?.parentId || null
    if (item.kind === 'group') {
      const parent = list.find((row) => row.id === item.parentId)
      if (!parent || parent.kind !== 'center') item.parentId = fallback?.parentId && known.has(fallback.parentId) ? fallback.parentId : 'product'
    }
    if (item.kind === 'page') {
      const parent = list.find((row) => row.id === item.parentId)
      if (!parent || parent.kind === 'page') item.parentId = fallback?.parentId || item.parentId
    }
  }
  const visiting = new Set<string>()
  const stacked = new Set<string>()
  function cyc(id: string): boolean {
    if (stacked.has(id)) return true
    if (visiting.has(id)) return false
    visiting.add(id)
    stacked.add(id)
    const parent = list.find((item) => item.id === id)?.parentId
    const loop = parent ? cyc(parent) : false
    stacked.delete(id)
    return loop
  }
  for (const item of list) {
    if (item.parentId && cyc(item.id)) item.parentId = defaults.get(item.id)?.parentId || null
  }
  for (const item of list) if (adminPage(item.route)) item.roles = ['admin']
  return list
}

export function loadMenu(): MenuNode[] {
  const stored = readStored()
  if (!stored) return defaultMenuNodes()
  const clean = sanitizeMenu(stored.nodes)
  const previous = stored.nodes.find(node => node.id === 'page:/guide')
  const next = clean.find(node => node.id === 'page:/guide')!
  if (stored.catalogWorkspaceVersion !== 1 || stored.guideCenterVersion !== 1 || previous?.parentId !== 'guide' || previous.title !== next.title || !stored.nodes.some(node => node.id === 'guide' && node.kind === 'center')) {
    try { localStorage.setItem(MENU_KEY, JSON.stringify({ version: 1, guideCenterVersion: 1, catalogWorkspaceVersion: 1, nodes: clean } satisfies StoredMenu)) }
    catch { /* Read the migrated navigation safely; retain the old stored payload if writing is unavailable. */ }
  }
  return clean
}

export function saveMenu(nodes: MenuNode[]) {
  const message = validateMenu(nodes)
  if (message) throw new Error(message)
  const clean = sanitizeMenu(nodes)
  localStorage.setItem(MENU_KEY, JSON.stringify({ version: 1, guideCenterVersion: 1, catalogWorkspaceVersion: 1, nodes: clean } satisfies StoredMenu))
  menuRevision.value += 1
  return clean
}

export function resetMenu() {
  localStorage.removeItem(MENU_KEY)
  menuRevision.value += 1
  return defaultMenuNodes()
}

export function childrenOf(nodes: MenuNode[], parentId: string | null) {
  return nodes.filter((item) => item.parentId === parentId).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
}

export function moveSibling(nodes: MenuNode[], id: string, direction: -1 | 1) {
  const next = clone(nodes)
  const current = next.find((item) => item.id === id)
  if (!current) return next
  const ordered = childrenOf(next, current.parentId)
  const index = ordered.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ordered.length) return next
  const [moved] = ordered.splice(index, 1)
  ordered.splice(target, 0, moved)
  ordered.forEach((item, row) => {
    const node = next.find((rowNode) => rowNode.id === item.id)
    if (node) node.sort = row + 1
  })
  return next
}

export function descendantIds(nodes: MenuNode[], id: string): string[] {
  return childrenOf(nodes, id).flatMap((item) => [item.id, ...descendantIds(nodes, item.id)])
}

export function changeParent(nodes: MenuNode[], id: string, parentId: string | null) {
  const next = clone(nodes)
  const current = next.find((item) => item.id === id)
  const parent = parentId ? next.find((item) => item.id === parentId) : null
  if (!current) return { ok: false, message: '菜单不存在', nodes: next }
  if (current.kind === 'center') return { ok: false, message: '业务中心不能改父级', nodes: next }
  if (!parent) return { ok: false, message: '请选择父级', nodes: next }
  if (current.kind === 'group' && parent.kind !== 'center') return { ok: false, message: '分组只能放在业务中心下', nodes: next }
  if (current.kind === 'page' && parent.kind === 'page') return { ok: false, message: '页面不能挂在页面下面', nodes: next }
  if (id === parentId || descendantIds(next, id).includes(parentId || '')) return { ok: false, message: '不能把菜单放进自己的下级', nodes: next }
  current.parentId = parentId
  current.sort = childrenOf(next, parentId).reduce((max, item) => Math.max(max, item.sort), 0) + 1
  return { ok: true, message: '', nodes: sanitizeMenu(next) }
}

export function addGroup(nodes: MenuNode[], parentId: string, title: string) {
  const name = title.trim()
  if (!name) return { ok: false, message: '请填写分组名称', nodes }
  const parent = nodes.find((item) => item.id === parentId && item.kind === 'center')
  if (!parent) return { ok: false, message: '分组要放在业务中心下', nodes }
  const id = uniqueMenuId(nodes, 'group')
  const sort = childrenOf(nodes, parentId).reduce((max, item) => Math.max(max, item.sort), 0) + 1
  return { ok: true, message: '', nodes: sanitizeMenu([...nodes, { id, kind: 'group', title: name, parentId, sort, route: '', hidden: false, roles: ['admin', 'operator'], custom: true }]) }
}

export function removeGroup(nodes: MenuNode[], id: string) {
  const current = nodes.find((item) => item.id === id)
  if (!current?.custom || !['group','center'].includes(current.kind)) return { ok: false, message: '只能删除自定义中心或分组', nodes }
  if (childrenOf(nodes, id).length) return { ok: false, message: '容器内还有菜单，请先改挂子入口，再删除空容器', nodes }
  return { ok: true, message: '', nodes: nodes.filter((item) => item.id !== id) }
}

function allowed(node: MenuNode, role: UserRole) {
  return !node.hidden && node.roles.includes(role) && (role === 'admin' || !adminPage(node.route))
}

export function railModel(role: UserRole | ((location: {path:string;query?:Record<string,string>})=>boolean), nodes = loadMenu()) {
  const visible = (node: MenuNode) => {
    if (node.hidden) return false
    if (catalogTaskRoutes.has(node.route) && nodes.some(item => item.id === 'page:/catalog')) return false
    if (typeof role !== 'function') return allowed(node, role)
    if (node.kind !== 'page') return true
    const [path, search] = node.route.split('?')
    return role({path:path || '/', query:Object.fromEntries(new URLSearchParams(search || ''))})
  }
  return childrenOf(nodes, null).filter(center => center.kind === 'center' && visible(center)).map(center => {
    const pages = childrenOf(nodes, center.id).filter(node => node.kind === 'page' && visible(node))
    const sections = childrenOf(nodes, center.id).filter(node => node.kind === 'group' && visible(node)).map(group => ({
      key:group.id, title:group.title,
      items:childrenOf(nodes, group.id).filter(node => node.kind === 'page' && visible(node)).map(node => ({index:node.route, title:node.title})),
    })).filter(group => group.items.length)
    // A single-page center is a real link. If later customized to contain other entries,
    // the regular center model keeps those entries reachable instead of hiding them.
    const direct = center.id === 'guide' && pages.length === 1 && pages[0]!.route === '/guide' && !sections.length ? pages[0] : undefined
    return {key:center.id, title:direct && center.title === '系统说明' ? direct.title : center.title, items:pages.map(node => ({index:node.route,title:node.title})), sections, ...(direct ? {directIndex:direct.route} : {})}
  }).filter(group => group.items.length || group.sections.length)
}

export function menuRouteForLocation(path: string, query: { panel?: unknown } = {}) {
  if(path==='/catalog'||catalogTaskRoutes.has(path))return '/catalog'
  if (/^\/guide\/articles\/[^/]+\/?$/.test(path)) return '/guide'
  if (['/products','/spus','/skus'].includes(path) && query.panel === 'columns') return '/products?panel=columns'
  if (/^\/(products|spus|materials)(\/|$)/.test(path)) return '/spus'
  if (/^\/skus(\/|$)/.test(path)) return '/skus'
  if (/^\/benefit-packages(\/|$)/.test(path)) return '/benefit-packages'
  return path || '/'
}
export function accessRoute(role: UserRole, path: string, nodes = loadMenu()) {
  if (path === '/menus') return role === 'admin' // Recovery path cannot be locked by menu customization.
  if (adminPage(path) && role !== 'admin') return false
  let node = nodes.find(item => item.kind === 'page' && item.route === path)
  const seen = new Set<string>()
  while (node) {
    if (seen.has(node.id) || !node.roles.includes(role)) return false
    seen.add(node.id)
    node = node.parentId ? nodes.find(item => item.id === node!.parentId) : undefined
  }
  return true // Hidden controls navigation visibility, not direct-link permission.
}
export function canAccessLocation(role: UserRole, path: string, query: { panel?: unknown } = {}) {
  const route = menuRouteForLocation(path,query)
  return accessRoute(role,route) && (route !== '/products?panel=columns' || accessRoute(role,path === '/skus' ? '/skus' : '/spus'))
}

export function previewLines(nodes: MenuNode[], role: UserRole) {
  return railModel(role, sanitizeMenu(nodes)).flatMap(center => [
    {depth:0,title:center.title}, ...center.items.map(page=>({depth:1,title:page.title})),
    ...center.sections.flatMap(group=>[{depth:1,title:group.title},...group.items.map(page=>({depth:2,title:page.title}))]),
  ])
}

/** Eligible parameter-free formal page entrances; never accept arbitrary URLs. */
export function menuPageRegistry() { return defaultMenuNodes().filter(n => n.kind === 'page') }
export function adminPage(route: string) { return ['/templates','/rules','/users','/menus','/roles','/permissions','/mappings'].includes(route) }
function uniqueMenuId(nodes: MenuNode[], kind: string) {
  let index = 1
  while (nodes.some(n => n.id === `custom-${kind}-${index}`)) index++
  return `custom-${kind}-${index}`
}
export function addCenter(nodes: MenuNode[], title: string) {
  if (!title.trim()) return {ok:false,message:'请填写中心名称',nodes}
  return {ok:true,message:'',nodes:sanitizeMenu([...nodes,{id:uniqueMenuId(nodes,'center'),kind:'center',title:title.trim(),parentId:null,sort:childrenOf(nodes,null).length+1,route:'',hidden:false,roles:[...BOTH],custom:true}])}
}
export function placePage(nodes: MenuNode[], route: string, parentId: string) {
  const registered = menuPageRegistry().find(n => n.route === route)
  if (!registered) return {ok:false,message:'请选择已注册的正式页面',nodes}
  const result = changeParent(sanitizeMenu(nodes), registered.id, parentId)
  if (result.ok) result.nodes.find(n => n.id === registered.id)!.hidden = false
  return result
}
export function validateMenu(nodes: MenuNode[]): string {
  const ids = new Set<string>(), routes = new Set<string>(), registry = menuPageRegistry()
  for (const node of nodes) {
    if (!node.id || ids.has(node.id)) return '菜单 ID 重复或为空'
    ids.add(node.id)
    if (!node.title.trim() || !Number.isFinite(node.sort)) return '请填写菜单名称和有效顺序'
    const parent = nodes.find(n => n.id === node.parentId)
    if (node.kind === 'center' ? node.parentId !== null : !parent || (node.kind === 'group' ? parent.kind !== 'center' : !['center','group'].includes(parent.kind))) return '菜单父级无效；仅支持中心、分组和页面'
    if (node.kind === 'page') {
      if (!registry.some(n=>n.id === node.id && n.route === node.route) || routes.has(node.route)) return '页面必须使用唯一的已注册入口'
      routes.add(node.route)
    } else if (!['center','group'].includes(node.kind)) return '菜单类型无效'
  }
  return ''
}
