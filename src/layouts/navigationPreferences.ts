export const NAV_KEY = 'iyge-nav-layout'
export type NavigationLayout = 'single' | 'dual'
export interface NavigationPreferences {
  layout: NavigationLayout
  pinned: boolean
  collapsed: boolean
  openeds: string[]
}

/** Only navigation preferences migrate. Transient menus are never restored; pinning is an independent explicit preference. */
export function readNavigation(raw: string | null, allowed: Iterable<string>, current: string[]): NavigationPreferences {
  const valid = new Set(allowed)
  const clean = (keys: unknown[]) => [...new Set(keys.filter((key): key is string => typeof key === 'string' && valid.has(key)))]
  const fallback: NavigationPreferences = { layout: 'dual', collapsed: false, pinned: false, openeds: clean(current) }
  try {
    const value: unknown = JSON.parse(raw || 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
    const saved = value as Record<string, unknown>
    let layout: NavigationLayout
    let collapsed: boolean
    if (saved.layout === 'single' || saved.layout === 'dual' || saved.layout === 'center') {
      layout = saved.layout === 'center' ? 'single' : saved.layout
      collapsed = saved.collapsed === true
    } else if (saved.mode === 'single' || saved.mode === 'dual' || saved.mode === 'icons') {
      layout = saved.mode === 'icons' ? (saved.expandedMode === 'single' ? 'single' : 'dual') : saved.mode
      collapsed = saved.mode === 'icons' || (saved.mode === 'dual' && saved.menuOpen === false)
    } else return fallback
    return { layout, collapsed, pinned: saved.pinned === true, openeds: Array.isArray(saved.openeds) ? clean(saved.openeds) : clean(current) }
  } catch { return fallback }
}
