import { blockTypeOnNonLeaf } from './categoryTree'
import { categoryPath } from './logic'
import type { AppData, ProductFamily } from './types'

/** 已确认的手机壳归属修正。只认这一条产品类型和分类路径，不扫描其他类型。 */
export const PHONE_CASE_CATEGORY_FIX = {
  productTypeId: 'pt-mvc6vur1-2',
  categoryNames: ['手机配件', '保护壳'],
} as const

export interface AccessoryCategoryFixInput {
  productTypeId: string
  categoryNames: readonly string[]
}

export interface AccessoryCategoryFixReport {
  ok: boolean
  changed: boolean
  message: string
  productTypeId: string
  fromCategoryId: string
  fromPath: string
  toCategoryId: string
  toPath: string
  modelCount: number
  publishedCount: number
  planningCount: number
  familyIds: string[]
  materialCodes: string[]
}

function emptyReport(productTypeId: string, message: string, ok = false): AccessoryCategoryFixReport {
  return {
    ok,
    changed: false,
    message,
    productTypeId,
    fromCategoryId: '',
    fromPath: '',
    toCategoryId: '',
    toPath: '',
    modelCount: 0,
    publishedCount: 0,
    planningCount: 0,
    familyIds: [],
    materialCodes: [],
  }
}

/** 按从根到叶的名称定位。同一层同名分类超过一个时拒绝，不用裸 id 猜测。 */
export function findCategoryByPath(data: AppData, names: readonly string[]) {
  if (!names.length) return { ok: false as const, message: '没有给出目标分类路径。' }
  let parentId: string | null = null
  let currentId = ''
  for (const name of names) {
    const matches = data.categories.filter((item) => item.parentId === parentId && item.name === name)
    if (matches.length !== 1) {
      return { ok: false as const, message: matches.length ? `分类「${name}」在同一层有多个，不能自动选择。` : `找不到分类路径里的「${name}」。` }
    }
    currentId = matches[0].id
    parentId = currentId
  }
  return { ok: true as const, id: currentId }
}

function familySignature(family: ProductFamily) {
  return [family.productModelId || family.templateId || '', family.productTypeId || '', family.commonSignature || ''].join('\u001e')
}

function collect(data: AppData, productTypeId: string) {
  const modelIds = new Set(data.specCanvases.filter((item) => item.productTypeId === productTypeId).map((item) => item.templateId))
  const families = data.families.filter((item) => item.productTypeId === productTypeId)
  const familyIds = new Set(families.map((item) => item.id))
  const materials = data.skus.filter((item) => familyIds.has(item.familyId))
  return {
    modelIds,
    published: data.specModelVersions.filter((item) => item.status === 'published' && modelIds.has(item.templateId)),
    planning: (data.planningRecords || []).filter((item) => modelIds.has(item.productModelId)),
    families,
    materials,
  }
}

/**
 * 只把指定产品类型标成配件，并把它名下、仍停在原分类的商品款改到目标末级分类。
 * 不改模型、发布快照、规划编号、物料编码和商品名称。有冲突时不改任何字段。
 */
export function applyAccessoryCategoryFix(data: AppData, input: AccessoryCategoryFixInput): AccessoryCategoryFixReport {
  const type = data.productTypes.find((item) => item.id === input.productTypeId)
  if (!type) return emptyReport(input.productTypeId, '没有这条产品类型，不需要修正。', true)
  const located = findCategoryByPath(data, input.categoryNames)
  if (!located.ok) return emptyReport(input.productTypeId, located.message)
  const target = data.categories.find((item) => item.id === located.id)
  if (!target) return emptyReport(input.productTypeId, '目标分类不存在。')
  const toPath = categoryPath(data, target.id)
  const scope = collect(data, type.id)
  const base = {
    productTypeId: type.id,
    fromCategoryId: type.categoryId,
    fromPath: categoryPath(data, type.categoryId),
    toCategoryId: target.id,
    toPath,
    modelCount: scope.modelIds.size,
    publishedCount: scope.published.length,
    planningCount: scope.planning.length,
    familyIds: scope.families.map((item) => item.id),
    materialCodes: scope.materials.map((item) => item.materialCode || '').filter(Boolean),
  }
  const done = type.categoryId === target.id && type.catalogRole === 'accessory' && scope.families.every((item) => item.categoryId === target.id)
  if (done) return { ok: true, changed: false, message: '分类和配件身份已经改过，没有再次修改。', ...base }
  if (target.enabled === false) return { ok: false, changed: false, message: '目标分类已停用，没有修改。', ...base }
  const leaf = blockTypeOnNonLeaf(data.categories, target.id)
  if (leaf) return { ok: false, changed: false, message: leaf, ...base }
  const sameName = data.productTypes.some((item) => item.id !== type.id && item.categoryId === target.id && item.name === type.name)
  if (sameName) return { ok: false, changed: false, message: '目标分类下已有同名产品类型，没有修改。', ...base }
  const elsewhere = scope.families.filter((item) => item.categoryId !== type.categoryId && item.categoryId !== target.id)
  if (elsewhere.length) return { ok: false, changed: false, message: `有 ${elsewhere.length} 款商品不在原分类，也不在目标分类，没有修改。`, ...base }
  const seen = new Set<string>()
  for (const family of scope.families) {
    const key = familySignature(family)
    if (seen.has(key)) return { ok: false, changed: false, message: '改到同一分类后会有两款商品使用相同的规格身份，没有修改。', ...base }
    seen.add(key)
  }
  const fromCategoryId = type.categoryId
  type.categoryId = target.id
  type.catalogRole = 'accessory'
  scope.families.forEach((family) => {
    if (family.categoryId === fromCategoryId) family.categoryId = target.id
  })
  return { ok: true, changed: true, message: `已把产品类型改到「${toPath}」，并标为配件。`, ...base, fromCategoryId, fromPath: categoryPath(data, fromCategoryId) || base.fromPath, toCategoryId: target.id }
}
