import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as xlsxModule from 'xlsx'
import { readSheet } from '../src/domain/excelImport'
import { runCompatibilityChecks } from '../src/domain/compatibilityCheck'

const xlsx = xlsxModule as typeof xlsxModule & { default?: typeof xlsxModule }
const XLSX = typeof xlsx.readFile === 'function' ? xlsx : xlsx.default
if (!XLSX?.readFile) throw new Error('xlsx 没有读文件能力')
const root = 'D:/单子/商城erp/前期包/2.0 数据'
const name = existsSync(root) ? readdirSync(root).find((item) => item.startsWith('1.1') && item.endsWith('.xlsx')) : ''
const file = process.env.ERP_MATERIAL_XLSX || (name ? join(root, name) : '')
if (!file || !existsSync(file)) throw new Error('真实物料表不存在。请设置 ERP_MATERIAL_XLSX 为 1.1 手机 Apple.xlsx 的路径；该检查包含真实文件断言，不能跳过。')
const book = file ? XLSX.read(readFileSync(file), { type: 'buffer' }) : null
const material = book ? readSheet('手机 Apple', XLSX.utils.sheet_to_json(book.Sheets['手机 Apple'], { header: 1, raw: false, defval: '' }) as unknown[][]) : undefined
const results = runCompatibilityChecks(material)
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))
if (results.some((item) => !item.ok)) process.exit(1)
console.log(`compatibility checks ${results.length}`)
