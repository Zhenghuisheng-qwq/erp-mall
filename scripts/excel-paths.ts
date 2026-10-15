import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import pkg from 'xlsx'
import { readSheet, suggestMapping } from '../src/domain/excelImport'

const XLSX = (pkg as { default?: typeof pkg }).default || pkg
const root = 'D:/单子/商城erp/前期包/2.0 数据'
const file = join(root, readdirSync(root).find((item) => item.includes('1.1') && item.endsWith('.xlsx')) || '')
const book = XLSX.readFile(file)
const matrix = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: '' }) as unknown[][]
const sheet = readSheet(book.SheetNames[0], matrix)
const mapping = suggestMapping(sheet.headers, sheet.sample)
function rowAttrs(row: string[]) {
  const bag = new Map<string, string>()
  mapping.filter((item) => item.target === 'attrName').forEach((item) => {
    const valueColumn = mapping.find((column) => column.target === 'attrValue' && column.header.replace('值', '') === item.header.replace('属性', '属'))
    const name = row[item.index] || ''
    const value = valueColumn ? row[valueColumn.index] || '' : ''
    if (name && value) bag.set(name, value)
  })
  return bag
}
function typeOf(row: string[]) {
  return row[mapping.find((item) => item.target === 'productType')!.index] || ''
}
const phones = sheet.rows.filter((row) => typeOf(row) === '手机').map(rowAttrs)
const need = ['品牌', '系列', '型号', '容量', '颜色']
const missing = phones.filter((bag) => need.some((name) => !bag.get(name)))
console.log('phone', phones.length, 'missing core', missing.length)
missing.forEach((bag) => console.log(' phone gap', [...bag.entries()].map(([k, v]) => k + '=' + v).join(' | ')))
const sig = new Map<string, number>()
phones.forEach((bag) => {
  const key = need.map((name) => bag.get(name) || '').join('\u001f')
  sig.set(key, (sig.get(key) || 0) + 1)
})
console.log('phone unique', sig.size, 'dup specs', [...sig.values()].filter((count) => count > 1).length)

const pads = sheet.rows.filter((row) => typeOf(row) === '平板电脑').map(rowAttrs)
const padNeed = ['品牌', '系列', '型号', '连接', '容量', '颜色']
console.log('pad', pads.length, 'missing core', pads.filter((bag) => padNeed.some((name) => !bag.get(name))).length)
const noteByModel = new Map<string, Set<string>>()
pads.forEach((bag) => {
  const key = `${bag.get('型号')}|${bag.get('型号备注') || '∅'}|${bag.get('显示屏玻璃') || '∅'}`
  const set = noteByModel.get(bag.get('型号') || '') || new Set()
  set.add(`${bag.get('型号备注') || '∅'} / ${bag.get('显示屏玻璃') || '∅'}`)
  noteByModel.set(bag.get('型号') || '', set)
})
;[...noteByModel.entries()].forEach(([model, set]) => console.log(' pad model', model, [...set].join(' ;; ')))

const cases = sheet.rows.filter((row) => typeOf(row) === '保护壳').map(rowAttrs)
const caseNeed = ['品牌', '系列', '适用品类', '适用品牌', '适用型号', '颜色']
console.log('case', cases.length, 'missing', cases.filter((bag) => caseNeed.some((name) => !bag.get(name))).length)
const caseSig = new Map<string, number>()
cases.forEach((bag) => {
  const key = caseNeed.map((name) => bag.get(name) || '').join('\u001f')
  caseSig.set(key, (caseSig.get(key) || 0) + 1)
})
console.log('case unique', caseSig.size, 'dup', [...caseSig.values()].filter((count) => count > 1).length)
const suppliers = new Map<string, number>()
sheet.rows.forEach((row) => {
  const code = row[mapping.find((item) => item.target === 'supplier')!.index] || ''
  if (!code) return
  suppliers.set(code, (suppliers.get(code) || 0) + 1)
})
console.log('dup supplier groups', [...suppliers.values()].filter((count) => count > 1).length)
