import { createSeed } from '../src/domain/seed'
import { buildMatrix, buildProductTree, constraintOf, inspectFamily, selectedById } from '../src/domain/logic'

const data = createSeed()
const iphone = data.families.find((item) => item.id === 'f-iphone')
if (!iphone) throw new Error('missing iphone')
const skus = data.skus.filter((item) => item.familyId === 'f-iphone')
const issues = inspectFamily(data, iphone, skus)
const errors = issues.filter((item) => item.level === 'error')
if (errors.length) throw new Error('iphone should pass required: ' + errors.map((item) => item.message).join(';'))
if (!issues.some((item) => item.kind === 'uncovered' && item.paramName === '颜色')) throw new Error('256G color should be uncovered')

const selected = selectedById(data, { 品牌: 'Apple', 系列: 'iPhone 17', 型号: 'iPhone 17', 容量: '256G' })
const color = constraintOf(data, 't-phone', 'p-color', selected)
if (color.status !== 'uncovered') throw new Error('color status ' + color.status)
const cap = constraintOf(data, 't-phone', 'p-cap', selected)
if (cap.status !== 'hit' || cap.values.includes('512G')) throw new Error('capacity rule failed')

const matrix = buildMatrix(data, 't-phone')
const blue = matrix.rows.find((row) => row.path.includes('蓝色'))
const blueCell = blue?.cells.find((cell) => cell.familyId === 'f-iphone')
if (!blueCell || blueCell.state === 'missing') throw new Error('blue phone should exist in matrix')
const tree = buildProductTree(data, 't-phone', false)
const text = JSON.stringify(tree)
if (!text.includes('蓝色') || !text.includes('（空）')) throw new Error('tree missing blue or empty node')
const watch = buildProductTree(data, 't-watch', false)
if (!JSON.stringify(watch).includes('42MM')) throw new Error('watch template missing')

const copy = skus.map((item) => ({ ...item, variantAttrs: { ...item.variantAttrs } }))
copy.push({ ...copy[0], id: 'dup', variantAttrs: { ...copy[0].variantAttrs } })
if (!inspectFamily(data, iphone, copy).some((item) => item.kind === 'duplicate')) throw new Error('duplicate not detected')

const illegalFamily = { ...iphone, commonAttrs: { ...iphone.commonAttrs, 系列: 'iPhone 15' } }
if (!inspectFamily(data, illegalFamily, skus).some((item) => item.kind === 'illegal' && item.paramName === '系列')) {
  throw new Error('illegal common series not detected')
}

console.log('verify ok', { errors: errors.length, uncovered: issues.filter((item) => item.kind === 'uncovered').length, matrixRows: matrix.rows.length })
