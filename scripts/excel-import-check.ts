import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pkg from 'xlsx'
import { readSheet } from '../src/domain/excelImport'
import { runExcelChecks } from '../src/domain/excelImportCheck'
import { runMatchChecks } from '../src/domain/excelMatchCheck'
const XLSX = (pkg as { default?: typeof pkg }).default || pkg
const root = 'D:/单子/商城erp/前期包/2.0 数据'
const name = existsSync(root) ? readdirSync(root).find((item) => item.includes('1.1') && item.endsWith('.xlsx')) : ''
const file = name ? join(root, name) : ''
if (!file) {
  console.log('FAIL file 没有找到 1.1 手机 Apple.xlsx')
  process.exit(1)
}
const book = XLSX.readFile(file, { cellFormula: true })
const profiles = book.SheetNames.map((sheetName) => {
  const sheet = book.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][]
  return readSheet(sheetName, matrix)
})
const materialName = profiles.find((item) => item.kind === 'material')?.name || ''
const materialSheet = book.Sheets[materialName]
const formulas = materialSheet ? Object.keys(materialSheet).filter((key) => materialSheet[key] && typeof materialSheet[key] === 'object' && 'f' in materialSheet[key]).length : 0
const merges = materialSheet?.['!merges']?.length || 0
console.log(`file ${file}`)
console.log(`formulas ${formulas} merges ${merges}`)
profiles.forEach((item) => console.log(`sheet ${item.name} ${item.kind} ${item.rows.length}`))
if (!formulas || merges !== 0) {
  console.log('FAIL workbook 物料表应有公式缓存且没有合并单元格')
  process.exit(1)
}
const results = [...runExcelChecks(profiles), ...runMatchChecks(profiles)]
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`excel checks ${results.length}`)
