export const NAV_KEY = 'iyge-nav-layout'
export type NavigationLayout = 'single' | 'dual'
export interface NavigationPreferences {
  layout: NavigationLayout
  collapsed: boolean
  openeds: string[]
}

/** Only navigation preferences migrate. Temporary menus and the old pin are never restored. */
export function readNavigation(raw: string | null, allowed: Iterable<string>, current: string[]): NavigationPreferences {
  const valid = new Set(allowed)
  const clean = (keys: unknown[]) => [...new Set(keys.filter((key): key is string => typeof key === 'string' && valid.has(key)))]
  const fallback: NavigationPreferences = { layout: 'dual', collapsed: false, openeds: clean(current) }
  try {
    const value: unknown = JSON.parse(raw || 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
    const saved = value as Record<string, unknown>
    let layout: NavigationLayout
    let collapsed: boolean
    if (saved.layout === 'single' || saved.layout === 'dual') {
      layout = saved.layout
      collapsed = saved.collapsed === true
    } else if (saved.mode === 'single' || saved.mode === 'dual' || saved.mode === 'icons') {
      layout = saved.mode === 'icons' ? (saved.expandedMode === 'single' ? 'single' : 'dual') : saved.mode
      collapsed = saved.mode === 'icons' || (saved.mode === 'dual' && saved.menuOpen === false)
    } else return fallback
    return { layout, collapsed, openeds: Array.isArray(saved.openeds) ? clean(saved.openeds) : clean(current) }
  } catch { return fallback }
}
