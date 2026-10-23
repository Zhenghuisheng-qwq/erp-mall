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
  custom?: boolean
}

type StoredMenu = { version: 1; nodes: MenuNode[] }

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
    page('/', '商品工作台', 'product', 1, BOTH),
    group('manage', '商品管理', 'product', 2, BOTH),
    group('model', '商品模型配置', 'product', 3, ADMIN),
    group('operate', '商品运营', 'product', 4, BOTH),
    group('analysis', '商品分析', 'product', 5, BOTH),
    page('/spus', 'SPU 管理', 'manage', 1, BOTH),
    page('/skus', 'SKU 管理', 'manage', 1.5, BOTH),
    page('/benefit-packages', '权益包', 'manage', 1.8, BOTH),
    page('/compatibility', '适用关系', 'manage', 2, BOTH),
    page('/categories', '商品分类中心', 'manage', 3, BOTH),
    page('/product-types', '产品类型', 'manage', 4, BOTH),
    page('/templates', '属性方案', 'model', 1, ADMIN),
    page('/models', '商品模型', 'model', 2, ADMIN),
    page('/specs', '商品模型设计', 'model', 3, ADMIN),
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
    page('/menus', '菜单配置', 'system', 4, ADMIN),
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
  // Inherit customized placement and access from the old product page, once per missing page.
  const legacy = nodes.find(item => item.id === 'page:/products')
  if (legacy) nodes = [...nodes, ...(['/spus', '/skus'] as const).filter(route => !nodes.some(item => item.id === `page:${route}`)).map((route, index) => ({ ...legacy, id: `page:${route}`, route, title: route === '/spus' ? 'SPU 管理' : 'SKU 管理', sort: legacy.sort + index * 0.5, roles: [...legacy.roles] }))]
  const defaults = new Map(defaultMenuNodes().map((item) => [item.id, item]))
  const incoming = clone(nodes).filter((item) => defaults.has(item.id) || (item.custom && item.kind === 'group'))
  const byId = new Map<string, MenuNode>()
  for (const item of defaults.values()) byId.set(item.id, { ...item, roles: [...item.roles] })
  for (const item of incoming) {
    const base = defaults.get(item.id)
    if (base) {
      byId.set(item.id, {
        ...base,
        title: String(item.title || base.title).trim() || base.title,
        parentId: item.parentId,
        sort: Number.isFinite(item.sort) ? item.sort : base.sort,
        hidden: Boolean(item.hidden),
        roles: rolesOf(item.roles, base.roles),
      })
    } else if (item.custom && item.kind === 'group') {
      const title = String(item.title || '').trim()
      if (!title) continue
      byId.set(item.id, { id: item.id, kind: 'group', title, parentId: item.parentId, sort: item.sort || 1, route: '', hidden: Boolean(item.hidden), roles: rolesOf(item.roles, BOTH), custom: true })
    }
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
  return list
}

export function loadMenu(): MenuNode[] {
  const stored = readStored()
  if (!stored) return defaultMenuNodes()
  return sanitizeMenu(stored.nodes)
}

export function saveMenu(nodes: MenuNode[]) {
  const clean = sanitizeMenu(nodes)
  localStorage.setItem(MENU_KEY, JSON.stringify({ version: 1, nodes: clean } satisfies StoredMenu))
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
  const id = `group-${Date.now().toString(36)}`
  const sort = childrenOf(nodes, parentId).reduce((max, item) => Math.max(max, item.sort), 0) + 1
  return { ok: true, message: '', nodes: sanitizeMenu([...nodes, { id, kind: 'group', title: name, parentId, sort, route: '', hidden: false, roles: ['admin', 'operator'], custom: true }]) }
}

export function removeGroup(nodes: MenuNode[], id: string) {
  const current = nodes.find((item) => item.id === id)
  if (!current || current.kind !== 'group') return { ok: false, message: '只能删除分组', nodes }
  if (childrenOf(nodes, id).length) return { ok: false, message: '分组里还有菜单，不能删除', nodes }
  return { ok: true, message: '', nodes: nodes.filter((item) => item.id !== id) }
}

function allowed(node: MenuNode, role: UserRole) {
  return !node.hidden && node.roles.includes(role)
}

export function railModel(role: UserRole) {
  const nodes = loadMenu()
  return childrenOf(nodes, null)
    .filter((center) => center.kind === 'center' && allowed(center, role))
    .map((center) => {
      const pages = childrenOf(nodes, center.id).filter((item) => item.kind === 'page' && allowed(item, role) && item.roles.includes(role))
      const sections = childrenOf(nodes, center.id)
        .filter((item) => item.kind === 'group' && allowed(item, role))
        .map((group) => ({
          key: group.id,
          title: group.title,
          items: childrenOf(nodes, group.id)
            .filter((item) => item.kind === 'page' && allowed(item, role))
            .map((item) => ({ index: item.route, title: item.title })),
        }))
        .filter((section) => section.items.length > 0)
      return {
        key: center.id,
        title: center.title,
        items: pages.map((item) => ({ index: item.route, title: item.title })),
        sections,
      }
    })
    .filter((group) => group.items.length > 0 || group.sections.length > 0)
}

export function accessRoute(role: UserRole, path: string) {
  const nodes = loadMenu()
  const page = nodes.find((item) => item.kind === 'page' && item.route === path)
  if (!page) return true
  return page.roles.includes(role)
}

export function canAccessLocation(role: UserRole, path: string, query: { panel?: unknown } = {}) {
  if ((path === '/products' || path === '/spus' || path === '/skus') && query.panel === 'columns') return accessRoute(role, '/products?panel=columns') && accessRoute(role, path === '/skus' ? '/skus' : '/spus')
  if (path === '/products' || path.startsWith('/products/') || path.startsWith('/spus/') || path.startsWith('/materials/')) return accessRoute(role, '/spus')
  if (path.startsWith('/skus/')) return accessRoute(role, '/skus')
  if (path.startsWith('/benefit-packages/')) return accessRoute(role, '/benefit-packages')
  return accessRoute(role, path === '' ? '/' : path)
}

export function previewLines(nodes: MenuNode[], role: UserRole) {
  const lines: { depth: number; title: string }[] = []
  function walk(parentId: string | null, depth: number) {
    for (const item of childrenOf(nodes, parentId)) {
      if (!allowed(item, role)) continue
      if (item.kind === 'page' || item.kind === 'center' || childrenOf(nodes, item.id).some((child) => allowed(child, role))) {
        lines.push({ depth, title: item.title })
        walk(item.id, depth + 1)
      }
    }
  }
  walk(null, 0)
  return lines
}
