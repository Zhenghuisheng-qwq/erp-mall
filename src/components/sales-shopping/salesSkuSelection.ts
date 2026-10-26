export interface SalesSkuSelectionState {
  familyId: string
  selectedSkuId: string
  matchingSkuIds: string[]
  reason: 'filter' | 'clear' | 'select' | 'external' | 'catalog'
}
