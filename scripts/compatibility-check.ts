import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pkg from 'xlsx'
import { readSheet } from '../src/domain/excelImport'
import { runCompatibilityChecks } from '../src/domain/compatibilityCheck'

const XLSX = (pkg as { default?: typeof pkg }).default || pkg
const root = 'D:/单子/商城erp/前期包/2.0 数据'
const name = existsSync(root) ? readdirSync(root).find((item) => item.includes('1.1') && item.endsWith('.xlsx')) : ''
const file = name ? join(root, name) : ''
const book = file ? XLSX.readFile(file) : null
const material = book ? readSheet('手机 Apple', XLSX.utils.sheet_to_json(book.Sheets['手机 Apple'], { header: 1, raw: false, defval: '' }) as unknown[][]) : undefined
const results = runCompatibilityChecks(material)
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`compatibility checks ${results.length}`)
