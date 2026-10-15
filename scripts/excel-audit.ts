import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pkg from 'xlsx'
import { readSheet } from '../src/domain/excelImport'

const XLSX = (pkg as { default?: typeof pkg }).default || pkg
const root = 'D:/单子/商城erp/前期包/2.0 数据'
const name = readdirSync(root).find((item) => item.includes('1.1') && item.endsWith('.xlsx'))
if (!name || !existsSync(root)) throw new Error('missing file')
const book = XLSX.readFile(join(root, name), { cellFormula: true })
const sheetName = book.SheetNames[0]
const matrix = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, raw: false, defval: '' }) as unknown[][]
const sheet = readSheet(sheetName, matrix)
const headers = sheet.headers
const idx = (title: string) => headers.indexOf(title)
const cat = [idx('一级'), idx('二级'), idx('三级')]
const typeCol = idx('产品类型')
function attrs(row: string[]) {
  const pairs: { name: string; value: string }[] = []
  headers.forEach((header, index) => {
    const matched = /^属性(\d+)$/.exec(header)
    if (!matched) return
    const valueIndex = headers.indexOf(`属${matched[1]}值`)
    const attrName = row[index] || ''
    const value = valueIndex >= 0 ? row[valueIndex] || '' : ''
    if (attrName && value) pairs.push({ name: attrName, value })
  })
  return pairs
}
const paths = new Map<string, number>()
const types = new Map<string, number>()
const typeAttrs = new Map<string, Map<string, Map<string, number>>>()
sheet.rows.forEach((row) => {
  const path = cat.map((index) => row[index] || '（空）').join(' / ')
  const typeName = row[typeCol] || '（空）'
  paths.set(path, (paths.get(path) || 0) + 1)
  types.set(`${path} :: ${typeName}`, (types.get(`${path} :: ${typeName}`) || 0) + 1)
  const bag = typeAttrs.get(typeName) || new Map()
  typeAttrs.set(typeName, bag)
  attrs(row).forEach((item) => {
    const values = bag.get(item.name) || new Map()
    bag.set(item.name, values)
    values.set(item.value, (values.get(item.value) || 0) + 1)
  })
})
console.log('rows', sheet.rows.length)
console.log('\nPATHS')
;[...paths.entries()].sort((a, b) => b[1] - a[1]).forEach(([key, count]) => console.log(count, key))
console.log('\nTYPES')
;[...types.entries()].sort((a, b) => b[1] - a[1]).forEach(([key, count]) => console.log(count, key))
const focus = ['手机', '平板电脑', '保护壳', '屏幕膜', '笔记本']
focus.forEach((typeName) => {
  const bag = typeAttrs.get(typeName)
  console.log(`\nATTR ${typeName}`)
  if (!bag) return
  ;[...bag.entries()].forEach(([attr, values]) => {
    const top = [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([value, count]) => `${value}(${count})`).join(', ')
    const total = [...values.values()].reduce((sum, count) => sum + count, 0)
    console.log(`  ${attr} ${total} distinct ${values.size}: ${top}`)
  })
})
