import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { applyAccessoryCategoryFix, PHONE_CASE_CATEGORY_FIX } from '../src/domain/categoryFix'
import { runCategoryFixChecks } from '../src/domain/categoryFixCheck'
import { familyChoicesFor } from '../src/domain/material'
import type { AppData } from '../src/domain/types'

const results = runCategoryFixChecks()
results.forEach((item) => console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.id} ${item.detail}`))

const source = process.env.CATEGORY_FIX_DB || 'C:/Users/Administrator/AppData/Local/Temp/mat-db.json'
if (!existsSync(source)) {
  console.log('SKIP live-db 没有当前数据副本')
} else {
  const backupDir = join(process.cwd(), 'backups')
  mkdirSync(backupDir, { recursive: true })
  const backup = join(backupDir, 'iyge-v2-mock-db.before-accessory-fix.json')
  if (!existsSync(backup)) copyFileSync(source, backup)
  const payload = JSON.parse(readFileSync(source, 'utf8')) as { version: number; data: AppData }
  const before = JSON.parse(JSON.stringify(payload.data)) as AppData
  const versions = JSON.stringify(before.specModelVersions)
  const plans = before.planningRecords.map((item) => item.planningId).join()
  const materials = before.skus.map((item) => `${item.id}|${item.materialCode}|${item.planningId}|${item.familyId}|${item.skuName}`).join('\n')
  const receipts = JSON.stringify(before.materialReceipts)
  const names = before.families.map((item) => `${item.id}|${item.name}`).join('\n')
  const fix = applyAccessoryCategoryFix(payload.data, PHONE_CASE_CATEGORY_FIX)
  const again = applyAccessoryCategoryFix(payload.data, PHONE_CASE_CATEGORY_FIX)
  const family = payload.data.families.find((item) => item.id === 'fam-mvc9fhvg-36')
  const reused = family ? familyChoicesFor(payload.data, { productModelId: family.productModelId || '', productTypeId: family.productTypeId || '', categoryId: family.categoryId, commonSignature: family.commonSignature || '' }) : []
  const phone = payload.data.families.find((item) => item.id === 'f-iphone')
  const shell = payload.data.productTypes.find((item) => item.id === 'pt-case')
  const ok = Boolean(fix.ok && fix.changed && again.ok && !again.changed && fix.toCategoryId === 'c-case' && fix.planningCount === 13 && fix.materialCodes.includes('MAT-000002') && fix.materialCodes.length === 13 && family?.categoryId === 'c-case' && family.name === '手机壳模型' && reused.length === 1 && reused[0].id === family.id && phone?.categoryId === 'c-phone' && shell?.name === '手机保护壳' && shell.categoryId === 'c-case' && JSON.stringify(payload.data.specModelVersions) === versions && payload.data.planningRecords.map((item) => item.planningId).join() === plans && payload.data.skus.map((item) => `${item.id}|${item.materialCode}|${item.planningId}|${item.familyId}|${item.skuName}`).join('\n') === materials && JSON.stringify(payload.data.materialReceipts) === receipts && payload.data.families.map((item) => `${item.id}|${item.name}`).join('\n') === names)
  results.push({ id: 'live-db', ok, detail: `${fix.message} 物料 ${fix.materialCodes.length} 规划 ${fix.planningCount}` })
  console.log(`${ok ? 'PASS' : 'FAIL'} live-db ${fix.message} 物料 ${fix.materialCodes.length} 规划 ${fix.planningCount} 备份 ${backup}`)
}

if (results.some((item) => !item.ok)) process.exit(1)
console.log(`category fix checks ${results.length}`)
