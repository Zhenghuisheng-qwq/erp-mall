export const catalogViewPermissions = {
  categories: 'product:category:read',
  types: 'product:type:read',
  models: 'product:model:read',
} as const
export type CatalogView = keyof typeof catalogViewPermissions
export function isCatalogView(value: unknown): value is CatalogView {
  return typeof value === 'string' && Object.hasOwn(catalogViewPermissions, value)
}
export function firstReadableCatalogView(can: (code: string) => boolean): CatalogView | undefined {
  return (Object.keys(catalogViewPermissions) as CatalogView[]).find(view => can(catalogViewPermissions[view]))
}
/** Only ordinary legacy browsing is redirected. Explicit category maintenance keeps its task. */
export function legacyCatalogLocation(path: string, query: Record<string, unknown>) {
  const view = path === '/categories' ? 'categories' : path === '/product-types' ? 'types' : path === '/models' ? 'models' : undefined
  if (!view) return undefined
  if (path === '/categories' && (['organize', 'edit', 'maintain'].includes(String(query.mode || '')) || query.manage || query.action || query.move || query.edit || query.create)) return undefined
  const categoryId = path === '/categories' && !query.categoryId && !query.category && typeof query.id === 'string' ? query.id : undefined
  return {path: '/catalog', query: {...query, ...(categoryId ? {categoryId} : {}), view}}
}
/** Internal return links carry only a workspace URL, never an external URL or executable scheme. */
export function catalogReturnLocation(value: unknown) {
  if (typeof value !== 'string' || value.length > 5000 || /[\\\u0000-\u001f\u007f]/.test(value)) return undefined
  try {
    const url = new URL(value, 'https://erp.invalid')
    if (url.origin !== 'https://erp.invalid' || url.pathname !== '/catalog') return undefined
    if (/[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(value))) return undefined
    return url.pathname + url.search + url.hash
  } catch { return undefined }
}
