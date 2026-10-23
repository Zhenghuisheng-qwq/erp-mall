/** One in-memory return point for a package entry, consumed on returning to its SKU route.
 * No product/page preference is persisted here. A later entry replaces the previous point.
 */
export interface BenefitSkuReturnState {
  path: string
  activeId: string
  scopeSearch: string
  scopePage: number
  selectedIds: string[]
  collapsed: Record<string, boolean>
  focusSkuId: string
  scroll: { selector: string; index: number; top: number; left: number }[]
  windowX: number
  windowY: number
}
let pending: BenefitSkuReturnState | undefined
export function rememberBenefitSkuReturn(state: Omit<BenefitSkuReturnState, 'scroll' | 'windowX' | 'windowY'>) {
  pending = {
    ...state, selectedIds: [...state.selectedIds], collapsed: { ...state.collapsed },
    windowX: window.scrollX, windowY: window.scrollY,
    scroll: ['.main', '.content', '.sku-table .el-scrollbar__wrap'].flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)].map((element, index) => ({ selector, index, top: element.scrollTop, left: element.scrollLeft }))),
  }
}
export function takeBenefitSkuReturn(path: string) {
  const state = pending
  pending = undefined
  return state?.path === path ? state : undefined
}
export function restoreBenefitSkuScroll(state: BenefitSkuReturnState) {
  const button = [...document.querySelectorAll<HTMLElement>('[data-benefit-more]')].find(element => element.dataset.benefitMore === state.focusSkuId)
  button?.focus({ preventScroll: true })
  for (const item of state.scroll) {
    const element = document.querySelectorAll<HTMLElement>(item.selector)[item.index]
    if (element) { element.scrollTop = item.top; element.scrollLeft = item.left }
  }
  window.scrollTo(state.windowX, state.windowY)
}
