<template>
  <div>
    <PageHead title="反馈管理" desc="这些反馈只保存在本机。导出反馈包后，可发送给开发人员。不会同步到服务器，也没有进入开发队列。">
      <el-button @click="pickPack">导入反馈包</el-button>
      <el-button type="primary" :disabled="!store.data.feedbacks.length" @click="exportAll">导出反馈包</el-button>
      <input ref="packRef" type="file" accept=".zip,application/zip" hidden @change="onImport" />
    </PageHead>
    <div class="panel">
      <div class="feedback-filters">
        <el-select v-model="pageFilter" clearable placeholder="全部页面" style="width: 180px">
          <el-option v-for="item in pages" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-model="kindFilter" clearable placeholder="全部类型" style="width: 160px">
          <el-option label="Bug" value="bug" />
          <el-option label="体验问题" value="experience" />
          <el-option label="功能需求" value="feature" />
          <el-option label="历史反馈" value="legacy" />
        </el-select>
      </div>
      <el-table :data="rows">
        <el-table-column prop="title" label="标题" min-width="160" />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ kindText(row.kind) }}</template>
        </el-table-column>
        <el-table-column prop="page" label="页面" width="140" />
        <el-table-column label="功能" width="120">
          <template #default="{ row }">{{ row.featureName || '整个页面' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ row.createdAt.slice(0, 16).replace('T', ' ') }}</template>
        </el-table-column>
        <el-table-column label="本地标记" width="130">
          <template #default="{ row }">
            <el-select v-model="row.status" size="small">
              <el-option label="待看" value="open" />
              <el-option label="先记下" value="doing" />
              <el-option label="本机已看" value="done" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button link :disabled="!!row.exportedAt" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.route && canOpen(row.route)" link @click="router.push(row.route)">打开页面</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-drawer v-model="detailOpen" title="反馈详情" size="440px">
      <template v-if="current">
        <p><strong>{{ current.title }}</strong></p>
        <p class="muted">{{ kindText(current.kind) }} · {{ current.page }} · {{ current.featureName || '整个页面' }}</p>
        <p class="feedback-content">{{ current.content }}</p>
        <ul class="feedback-files">
          <li v-for="file in current.attachmentRefs || []" :key="file.id">
            <img v-if="previews[file.id]" :src="previews[file.id]" alt="" />
            <span>{{ file.name }} · {{ fileSize(file.size) }}</span>
          </li>
        </ul>
      </template>
    </el-drawer>
    <el-dialog v-model="editOpen" title="编辑本机反馈" width="480px">
      <el-input v-model="editTitle" placeholder="标题" style="margin-bottom: 8px" />
      <el-input v-model="editContent" type="textarea" :rows="4" />
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存到本机</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import { deleteAttachments, exportFeedbackPack, fileSize, readAttachment, readFeedbackPack } from '../domain/feedbackFiles'
import { canAccessLocation } from '../domain/menuConfig'
import type { FeedbackItem, FeedbackKind } from '../domain/types'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const router = useRouter()
const pageFilter = ref('')
const kindFilter = ref('')
const detailOpen = ref(false)
const editOpen = ref(false)
const current = ref<FeedbackItem | null>(null)
const editId = ref('')
const editTitle = ref('')
const editContent = ref('')
const previews = ref<Record<string, string>>({})
const packRef = ref<HTMLInputElement>()
const pages = computed(() => [...new Set(store.data.feedbacks.map((item) => item.page || '历史反馈'))])
const rows = computed(() => store.data.feedbacks.filter((item) => {
  if (pageFilter.value && item.page !== pageFilter.value) return false
  if (kindFilter.value === 'legacy') return !item.kind
  if (kindFilter.value && item.kind !== kindFilter.value) return false
  return true
}))

function kindText(kind?: FeedbackKind) {
  if (kind === 'bug') return 'Bug'
  if (kind === 'experience') return '体验问题'
  if (kind === 'feature') return '功能需求'
  return '历史反馈'
}
function canOpen(route: string) {
  const [path, search] = route.split('?')
  const panel = new URLSearchParams(search || '').get('panel')
  return canAccessLocation(store.data.activeRole, path || '/', panel ? { panel } : {})
}
async function openDetail(row: FeedbackItem) {
  current.value = row
  detailOpen.value = true
  for (const file of row.attachmentRefs || []) {
    if (previews.value[file.id] || !file.type.startsWith('image/')) continue
    const stored = await readAttachment(file.id)
    if (stored?.blob) previews.value = { ...previews.value, [file.id]: URL.createObjectURL(stored.blob) }
  }
}
function openEdit(row: FeedbackItem) {
  editId.value = row.id
  editTitle.value = row.title
  editContent.value = row.content
  editOpen.value = true
}
async function flushChanges() {
  const result = await store.flushPersistence()
  if (!result.ok) { ElMessage.error(store.persistenceState.message || '反馈修改尚未保存，当前输入已保留。'); return false }
  return true
}
async function saveEdit() {
  const row = store.data.feedbacks.find((item) => item.id === editId.value)
  if (!row || row.exportedAt) return
  if (!editTitle.value.trim() || !editContent.value.trim()) {
    ElMessage.warning('标题和说明都要填写')
    return
  }
  row.title = editTitle.value.trim()
  row.content = editContent.value.trim()
  if (!await flushChanges()) return
  editOpen.value = false
  ElMessage.success('已保存到本机')
}
async function remove(row: FeedbackItem) {
  try {
    await ElMessageBox.confirm(`删除「${row.title}」？对应附件也会从本机清掉。`, '删除反馈', { type: 'warning' })
  } catch {
    return
  }
  store.data.feedbacks = store.data.feedbacks.filter((item) => item.id !== row.id)
  if (!await flushChanges()) return
  await deleteAttachments((row.attachmentRefs || []).map((item) => item.id))
  ElMessage.success('已从本机删除')
}
async function exportAll() {
  try {
    const blob = await exportFeedbackPack(store.data.feedbacks)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'iyge-feedback-pack.zip'
    link.click()
    URL.revokeObjectURL(url)
    const now = new Date().toISOString()
    store.data.feedbacks.forEach((item) => { item.exportedAt = now })
    if (!await flushChanges()) return
    ElMessage.success('已导出反馈包。可发送给开发人员，不代表对方已经收到')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  }
}
function pickPack() {
  packRef.value?.click()
}
async function onImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    const incoming = await readFeedbackPack(file)
    const known = new Set(store.data.feedbacks.map((item) => item.id))
    const fresh = incoming.filter((item) => !known.has(item.id))
    store.data.feedbacks.unshift(...fresh)
    if (!await flushChanges()) return
    ElMessage.success(`已导入 ${fresh.length} 条本机反馈，没有改商品数据`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  }
}
</script>

<style scoped>
.feedback-filters { display: flex; gap: 8px; margin-bottom: 12px; }
.muted { color: var(--text-secondary); font-size: 13px; }
.feedback-content { white-space: pre-wrap; line-height: 1.6; }
.feedback-files { margin: 12px 0 0; padding: 0; list-style: none; }
.feedback-files li { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.feedback-files img { width: 72px; height: 72px; object-fit: cover; border-radius: 4px; }
</style>
