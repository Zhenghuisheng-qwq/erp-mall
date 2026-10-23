<template>
  <main class="recovery" data-storage-recovery>
    <section class="panel">
      <h1>本机数据需要处理</h1>
      <el-alert :title="message" type="error" :closable="false" show-icon />
      <p>原存储没有被清空或替换，也没有加载预设商品。请先下载原数据备份，再选择有效备份或已修复的 JSON 文件。</p>
      <el-button :disabled="!original" @click="downloadOriginal">下载原始数据备份</el-button>
      <label class="file-choice">选择备份或已修复的 JSON<input type="file" accept=".json,application/json" data-recovery-file @change="prepare" /></label>
      <p v-if="candidate" role="status">已校验：{{ candidate.families.length }} 款 SPU、{{ candidate.skus.length }} 条 SKU / MAT、{{ candidate.compatibilities.length }} 条适用声明。确认后替换本机数据并重新打开。</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" data-recovery-error />
      <el-button type="primary" :disabled="!candidate" @click="restore">确认导入并重新打开</el-button>
    </section>
  </main>
</template>
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { DATA_VERSION, STORAGE_KEY } from '../domain/types'
import type { AppData } from '../domain/types'
import { compatibilityImportProblems } from '../domain/accessoryCompatibilityCommands'
import { benefitPackageImportProblems } from '../domain/benefitPackages'
import { templateCompatibilityImportProblems } from '../domain/templateCompatibility'
import { templateCompatibilityOriginProblems } from '../domain/templateCompatibilitySync'
import { normalizeStored } from '../stores/catalog'

defineProps<{ message: string }>()
let original = ''
try { original = localStorage.getItem(STORAGE_KEY) || '' } catch { /* The startup message explains inaccessible storage. */ }
const candidate = shallowRef<AppData>(), error = ref('')
let generation = 0
function downloadOriginal() {
  const url = URL.createObjectURL(new Blob([original], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = 'iyge-original-storage.txt'; anchor.click()
  URL.revokeObjectURL(url)
}
async function prepare(event: Event) {
  const current = ++generation
  candidate.value = undefined; error.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    if (current !== generation) return
    const parsed = JSON.parse(text) as { version?: number; data?: AppData }
    const data = parsed.data
    if (!data || ![data.families, data.skus, data.categories, data.templates, data.mappings, data.templateParams, data.params].every(Array.isArray)) throw new Error('文件缺少有效商品数据，请检查备份。')
    const problems = [...compatibilityImportProblems(data), ...benefitPackageImportProblems(data), ...templateCompatibilityImportProblems(data), ...templateCompatibilityOriginProblems(data)]
    if (problems.length) throw new Error(problems.join(' '))
    const normalized = normalizeStored(parsed, { persist: false })
    if (!normalized) throw new Error('数据版本或结构无法读取，原存储保持。')
    candidate.value = normalized
  } catch (cause) { if (current === generation) error.value = `未能校验文件：${cause instanceof Error ? cause.message : String(cause)}。原存储保持。` }
}
function restore() {
  if (!candidate.value) return
  try {
    const encoded = JSON.stringify({ version: DATA_VERSION, data: candidate.value })
    localStorage.setItem(STORAGE_KEY, encoded)
    window.location.reload()
  } catch (cause) { error.value = `无法保存到本机：${cause instanceof Error ? cause.message : String(cause)}。原存储和已选文件保留，可以重试。` }
}
</script>
<style scoped>
.recovery { max-width:760px; margin:48px auto; padding:0 20px; }.recovery h1 { font-size:24px; }.recovery p { line-height:1.8; }.file-choice { display:block; margin:24px 0; }.file-choice input { display:block; margin-top:10px; }.recovery .el-alert { margin:16px 0; }
@media(max-width:600px) { .recovery { margin-top:20px; } }
</style>
