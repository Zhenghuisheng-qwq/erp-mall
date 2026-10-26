import type { AppData, ProductFamily, Sku } from './types'

/** Resolve actual values by identity. Display names are legacy aliases only when unique. */
export function actualSkuAttributes(data: AppData, family: ProductFamily, sku: Sku, names = data.params.map(param => ({ attributeId: param.id, name: param.name }))) {
  const attributes: Record<string, string> = {}, conflicts: string[] = []
  const ids = new Set([...data.params.map(param => param.id), ...names.map(item => item.attributeId)])
  for (const id of ids) {
    const name = names.find(item => item.attributeId === id)?.name
    const alias = name && names.filter(item => item.name === name).length === 1 ? name : undefined
    const common = family.commonAttrs[id] ?? (alias ? family.commonAttrs[alias] : undefined)
    const variant = sku.variantAttrs[id] ?? (alias ? sku.variantAttrs[alias] : undefined)
    const manual = (sku.manualAttrs || []).filter(item => item.attributeId === id)
    // Match skuFieldValue's existing manual > variant > common precedence. An
    // explicit manual value is the actual value, not an extra speculative source.
    const values = (manual.length ? manual.map(item => item.value) : [variant, common]).filter((value): value is string => typeof value === 'string' && !!value)
    // A contradictory source is not missing information and cannot be manually confirmed.
    if (new Set(values).size > 1) { conflicts.push(id); continue }
    const value = values[0]
    if (value !== undefined) attributes[id] = value
  }
  return { attributes, conflicts }
}
