/** Presentation-only defaults: explicit column.width always wins; never persist computed widths. */
export function fixedListWidth(key: string): number | undefined {
  if (['status', 'shelf'].includes(key)) return 96
  if (['updatedAt', 'createdAt', 'created'].includes(key)) return 130
  if (key === 'code') return 110
  if (['skuCount', 'sale'].includes(key)) return 90
  return undefined
}
export function contentListWidth(key: string) {
  if (key === 'name') return 180
  if (key === 'spec') return 230
  if (['family', 'familyId'].includes(key)) return 160
  return 120
}
