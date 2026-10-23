<template>
  <el-button size="small" @click="featureOpen = true">页面功能</el-button>
  <el-button size="small" @click="openFeedback()">反馈问题</el-button>
  <el-drawer v-model="featureOpen" title="页面功能" size="420px" :modal="false" modal-class="assist-mask">
    <p class="assist-page">{{ sheet?.title || '当前页面' }}</p>
    <p v-if="!sheet" class="assist-note">功能清单待完善。这里不编造没有核对过的功能。</p>
    <template v-else>
      <section v-for="group in groups" :key="group" class="assist-group">
        <h3>{{ group }}</h3>
        <article v-for="item in featuresIn(group)" :key="item.id" class="assist-item">
          <div>
            <strong>{{ item.name }}</strong>
            <em>{{ featureStatusText(item.status) }}</em>
            <p>{{ item.summary }}</p>
          </div>
          <el-button size="small" @click="openFeedback(item)">反馈</el-button>
        </article>
      </section>
    </template>
  </el-drawer>
  <el-dialog v-model="formOpen" class="feedback-dialog" title="反馈问题" width="480px" align-center append-to-body :close-on-click-modal="false">
    <p class="assist-note">保存后只留在本机。导出反馈包后，可发送给开发人员。不会送到服务器。</p>
    <el-form label-position="top">
      <el-form-item label="反馈类型" required>
        <el-radio-group v-model="form.kind">
          <el-radio value="bug">Bug</el-radio>
          <el-radio value="experience">体验问题</el-radio>
          <el-radio value="feature">功能需求</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="来源页面">
        <el-input :model-value="`${sourceTitle}（${sourceKey}）`" disabled />
      </el-form-item>
      <el-form-item label="对应功能">
        <el-input :model-value="form.featureName || '整个页面'" disabled />
      </el-form-item>
      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="80" />
      </el-form-item>
      <el-form-item label="详细说明" required>
        <el-input v-model="form.content" type="textarea" :rows="5" placeholder="可以直接输入，也可以 Ctrl+V 粘贴文字或图片" @paste="onPaste" />
      </el-form-item>
      <el-form-item label="附件">
        <input ref="fileRef" type="file" accept="image/*,video/*" multiple hidden @change="onPick" />
        <el-button @click="fileRef?.click()">选择图片或短视频</el-button>
        <ul class="assist-files">
          <li v-for="file in pending" :key="file.id">
            <img v-if="file.type.startsWith('image/')" :src="file.url" alt="" />
            <span>{{ file.name }} · {{ fileSize(file.size) }}</span>
            <el-button link type="danger" @click="dropPending(file.id)">移除</el-button>
          </li>
        </ul>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="formOpen = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存到本机</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { checkAttachment, fileSize, saveAttachment } from '../domain/feedbackFiles'
import { featureSheet, featureStatusText, type PageFeature } from '../domain/pageFeatures'
import type { FeedbackItem, FeedbackKind } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

const props = defineProps<{ path: string; queryPanel?: unknown }>()
const store = useCatalogStore()
const featureOpen = ref(false)
const formOpen = ref(false)
const saving = ref(false)
const fileRef = ref<HTMLInputElement>()
const sheet = computed(() => featureSheet(props.path, { panel: props.queryPanel }))
const pageTitle = computed(() => sheet.value?.title || '当前页面')
const pageKey = computed(() => (props.path === '/products' && props.queryPanel === 'columns' ? '/products?panel=columns' : props.path || '/'))
const groups = computed(() => [...new Set((sheet.value?.features || []).map((item) => item.group))])
const sourceTitle = ref('')
const sourceKey = ref('')
const form = reactive({ kind: 'bug' as FeedbackKind, title: '', content: '', featureId: '', featureName: '' })
const pending = ref<Array<{ id: string; name: string; type: string; size: number; file: File; url: string }>>([])
let pendingFeedbackId = ''

function featuresIn(group: string) {
  return (sheet.value?.features || []).filter((item) => item.group === group)
}
function resetForm() {
  pendingFeedbackId = ''
  form.kind = 'bug'
  form.title = ''
  form.content = ''
  form.featureId = ''
  form.featureName = ''
  pending.value.forEach((item) => URL.revokeObjectURL(item.url))
  pending.value = []
}
function openFeedback(feature?: PageFeature) {
  resetForm()
  sourceTitle.value = pageTitle.value
  sourceKey.value = pageKey.value
  form.featureId = feature?.id || ''
  form.featureName = feature?.name || ''
  featureOpen.value = false
  formOpen.value = true
}
function addPending(file: File) {
  const message = checkAttachment(file, pending.value.length)
  if (message) {
    ElMessage.error(message)
    return
  }
  pending.value.push({ id: uid('file'), name: file.name || (file.type.startsWith('video/') ? '短视频' : '图片'), type: file.type, size: file.size, file, url: URL.createObjectURL(file) })
}
function onPick(event: Event) {
  const files = [...((event.target as HTMLInputElement).files || [])]
  files.forEach(addPending)
  ;(event.target as HTMLInputElement).value = ''
}
function onPaste(event: ClipboardEvent) {
  const items = [...(event.clipboardData?.items || [])]
  const images = items.filter((item) => item.type.startsWith('image/'))
  const text = event.clipboardData?.getData('text/plain') || ''
  if (!images.length || text) return
  event.preventDefault()
  images.forEach((item) => {
    const file = item.getAsFile()
    if (file) addPending(file)
  })
}
function dropPending(id: string) {
  const file = pending.value.find((item) => item.id === id)
  if (file) URL.revokeObjectURL(file.url)
  pending.value = pending.value.filter((item) => item.id !== id)
}
async function save() {
  if (saving.value) return
  if (!form.kind || !form.title.trim() || !form.content.trim()) {
    ElMessage.warning('请选择类型，并填写标题和说明')
    return
  }
  saving.value = true
  try {
    const refs = []
    for (const file of pending.value) refs.push(await saveAttachment(file.id, file.file))
    const existing = store.data.feedbacks.find(item => item.id === pendingFeedbackId)
    const record: FeedbackItem = {
      id: existing?.id || uid('fb'),
      title: form.title.trim(),
      content: form.content.trim(),
      status: 'open',
      page: sourceTitle.value,
      createdAt: existing?.createdAt || new Date().toISOString(),
      kind: form.kind,
      route: sourceKey.value,
      featureId: form.featureId,
      featureName: form.featureName,
      attachmentRefs: refs,
    }
    pendingFeedbackId = record.id
    if (existing) Object.assign(existing, record)
    else store.data.feedbacks.unshift(record)
    const saved = await store.flushPersistence()
    if (!saved.ok) { ElMessage.error(store.persistenceState.message || '反馈尚未保存，当前输入和附件已保留。'); return }
    formOpen.value = false
    ElMessage.success('已保存到本机。导出反馈包后，可发送给开发人员')
  } catch {
    ElMessage.error('附件没能保存到本机，这条反馈没有写入')
  } finally {
    saving.value = false
  }
}
watch(() => props.path, () => {
  featureOpen.value = false
})
defineExpose({ openFeedback })
</script>

<style scoped>
.assist-page { margin: 0 0 8px; font-size: 16px; font-weight: 650; }
.assist-note { color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
.assist-group { margin-top: 14px; }
.assist-group h3 { margin: 0 0 8px; font-size: 13px; color: var(--text-secondary); }
.assist-item { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-top: 1px solid var(--border-subtle); }
.assist-item strong { margin-right: 8px; }
.assist-item em { color: var(--text-secondary); font-style: normal; font-size: 12px; }
.assist-item p { margin: 4px 0 0; color: var(--text-secondary); font-size: 13px; }
.assist-files { margin: 8px 0 0; padding: 0; list-style: none; }
.assist-files li { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.assist-files img { width: 42px; height: 42px; object-fit: cover; border-radius: 4px; }
</style>
