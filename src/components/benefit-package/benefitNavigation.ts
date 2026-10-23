import type { Router } from 'vue-router'

/** Only recognized local application routes can become a return point. */
export function safeBenefitReturn(router: Router, value: unknown, fallback = '/benefit-packages'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return fallback
  // Check this application's static / :id routes before resolve, which emits a
  // Vue Router warning for an unknown location even when a fallback is returned.
  const path = (value.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/'
  const segments = path.split('/')
  const known = router.getRoutes().some(record => {
    const routeSegments = (record.path.replace(/\/+$/, '') || '/').split('/')
    return routeSegments.length === segments.length && routeSegments.every((segment, index) => segment.startsWith(':') ? Boolean(segments[index]) : segment === segments[index])
  })
  if (!known) return fallback
  try { const target = router.resolve(value); return target.matched.length ? target.fullPath : fallback } catch { return fallback }
}
