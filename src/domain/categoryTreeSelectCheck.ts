import { categoryDisplayParents, categoryPathLabel, categoryScopeIds, visibleCategoryRows } from './categoryTree'
import type { Category } from './types'

export interface CheckResult { id: string; ok: boolean; detail: string }

function check(id: string, ok: boolean, detail: string): CheckResult {
  return { id, ok, detail }
}

function cat(partial: Partial<Category> & Pick<Category, 'id' | 'name' | 'parentId'>): Category {
  return { sort: 1, enabled: true, ...partial }
}

export function runCategoryTreeSelectChecks(): CheckResult[] {
  const categories = [
    cat({ id: 'c-host', name: '主机', parentId: null, sort: 1 }),
    cat({ id: 'c-phone', name: '手机', parentId: 'c-host', sort: 1 }),
    cat({ id: 'c-pad', name: '平板', parentId: 'c-host', sort: 2 }),
    cat({ id: 'c-acc', name: '配件', parentId: null, sort: 2 }),
    cat({ id: 'c-protect', name: '保护及保护设备', parentId: 'c-acc', sort: 1 }),
    cat({ id: 'c-film', name: '保护膜', parentId: 'c-protect', sort: 1 }),
    cat({ id: 'c-other', name: '其他', parentId: null, sort: 7 }),
    cat({ id: 'c-film-2', name: '保护膜', parentId: 'c-other', sort: 1 }),
    cat({ id: 'c-orphan', name: '失效上级', parentId: 'missing-parent', sort: 3 }),
    cat({ id: 'c-loop-a', name: '环A', parentId: 'c-loop-b', sort: 4 }),
    cat({ id: 'c-loop-b', name: '环B', parentId: 'c-loop-a', sort: 5 }),
    cat({ id: 'c-off', name: '停用', parentId: null, sort: 6, enabled: false }),
  ]
  const before = categories.map((item) => `${item.id}|${item.name}|${item.parentId}|${item.sort}|${item.enabled}`).join('\n')
  const results: CheckResult[] = []
  const roots = visibleCategoryRows(categories, new Set(), '')
  const rootIds = roots.map((item) => item.id)
  results.push(check('roots', rootIds.includes('c-host') && rootIds.includes('c-acc') && rootIds.includes('c-other') && !rootIds.includes('c-phone') && rootIds.includes('c-orphan') && rootIds.includes('c-off'), rootIds.join(',')))

  const opened = visibleCategoryRows(categories, new Set(['c-host']), '')
  const phone = opened.find((item) => item.id === 'c-phone')
  results.push(check('child', Boolean(phone && phone.depth === 1 && phone.parentId === 'c-host' && !phone.hasChildren), phone ? `${phone.depth}/${phone.parentId}` : 'missing'))

  const host = opened.find((item) => item.id === 'c-host')
  results.push(check('expand-flag', Boolean(host?.expanded && host.hasChildren), host ? `${host.expanded}` : 'missing'))

  const found = visibleCategoryRows(categories, new Set(), '保护膜', new Set(['c-acc', 'c-protect', 'c-other']))
  const foundIds = found.map((item) => item.id)
  const film = found.find((item) => item.id === 'c-film')
  const filmAgain = found.find((item) => item.id === 'c-film-2')
  results.push(check('search-path', foundIds.includes('c-acc') && foundIds.includes('c-protect') && foundIds.includes('c-film') && foundIds.includes('c-other') && foundIds.includes('c-film-2') && Boolean(film && film.depth === 2 && filmAgain && filmAgain.depth === 1), foundIds.join(',')))
  results.push(check('same-name', categoryPathLabel(categories, 'c-film') === '配件 / 保护及保护设备 / 保护膜' && categoryPathLabel(categories, 'c-film-2') === '其他 / 保护膜' && categoryPathLabel(categories, 'c-film') !== categoryPathLabel(categories, 'c-film-2'), `${categoryPathLabel(categories, 'c-film')} | ${categoryPathLabel(categories, 'c-film-2')}`))

  const renamed = categories.map((item) => (item.id === 'c-phone' ? { ...item, name: '智能手机' } : item))
  results.push(check('rename-id', renamed.find((item) => item.id === 'c-phone')?.id === 'c-phone' && categoryPathLabel(renamed, 'c-phone') === '主机 / 智能手机' && categoryPathLabel(categories, 'c-phone') === '主机 / 手机', categoryPathLabel(renamed, 'c-phone')))

  const removed = categories.filter((item) => item.id !== 'c-phone')
  results.push(check('missing', categoryPathLabel(removed, 'c-phone') === '' && visibleCategoryRows(removed, new Set(['c-host']), '').every((item) => item.id !== 'c-phone'), 'removed'))

  const all = visibleCategoryRows(categories, new Set(categories.map((item) => item.id)), '')
  results.push(check('cycle-safe', all.length === categories.length && new Set(all.map((item) => item.id)).size === categories.length, `${all.length}/${categories.length}`))
  const parents = categoryDisplayParents(categories)
  results.push(check('orphan-root', parents.get('c-orphan') === null && (parents.get('c-loop-a') === null || parents.get('c-loop-b') === null), `${parents.get('c-orphan')}/${parents.get('c-loop-a')}/${parents.get('c-loop-b')}`))

  const after = categories.map((item) => `${item.id}|${item.name}|${item.parentId}|${item.sort}|${item.enabled}`).join('\n')
  results.push(check('readonly', before === after, before === after ? 'unchanged' : 'mutated'))

  const current = categoryScopeIds(categories, 'c-host', 'current')
  const withChildren = categoryScopeIds(categories, 'c-host', 'with-children')
  results.push(check('type-scope', current.join() === 'c-host' && withChildren.includes('c-host') && withChildren.includes('c-phone') && withChildren.includes('c-pad') && !withChildren.includes('c-film-2') && !current.includes('c-phone'), `${current.join()} | ${withChildren.join()}`))
  return results
}
