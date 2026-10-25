<template>
  <el-button size="small" :disabled="!store.can('system:guide:read')" @click="openPageGuide">页面功能</el-button>
  <el-button size="small" :disabled="!store.can('system:feedback:create')" :title="store.can('system:feedback:create') ? '' : '需要反馈新增权限'" @click="openFeedback()">反馈问题</el-button>
  <PageGuideDrawer />
  <el-dialog v-model="formOpen" class="feedback-dialog" title="反馈问题" width="480px" align-center append-to-body :close-on-click-modal="false">
    <el-alert v-if="!store.can('system:feedback:create')" title="当前身份没有反馈新增权限。指南阅读或维护不会授予反馈权限，当前输入保留。" type="warning" :closable="false"/><p class="assist-note">保存后只留在本机。导出反馈包后，可发送给开发人员。不会送到服务器。</p>
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
        <el-select v-model="form.featureId" clearable placeholder="整个页面" aria-label="对应历史功能" @change="syncFeatureName"><el-option v-for="feature in sheet?.features || []" :key="feature.id" :value="feature.id" :label="feature.name"/></el-select>
      </el-form-item>
      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="80" aria-label="反馈标题" />
      </el-form-item>
      <el-form-item label="详细说明" required>
        <el-input v-model="form.content" aria-label="反馈详细说明" type="textarea" :rows="5" placeholder="可以直接输入，也可以 Ctrl+V 粘贴文字或图片" @paste="onPaste" />
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
import { computed, reactive, ref, watch, onUnmounted } from 'vue'
import { checkAttachment, fileSize, saveAttachment } from '../domain/feedbackFiles'
import { featureSheet, type PageFeature } from '../domain/pageFeatures'
import type { FeedbackItem, FeedbackKind } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'
import {useGuideStore} from '../stores/guide'
import {guidePageFor} from '../domain/guide/routeMap'
import {guideUI,openGuide,closeGuide,type GuideFeedbackSource} from '../domain/guide/presentation'
import PageGuideDrawer from './guide/PageGuideDrawer.vue'

const props = defineProps<{ path: string; queryPanel?: unknown; fullPath?: string; title?: string }>()
const store = useCatalogStore()
const guide = useGuideStore()
const guideSource = ref<GuideFeedbackSource>({})
const formOpen = ref(false)
const saving = ref(false)
const fileRef = ref<HTMLInputElement>()
const sheet = computed(() => featureSheet(props.path, { panel: props.queryPanel }))
const pageTitle = computed(() => sheet.value?.title || props.title || props.path)
const pageKey = computed(() => props.fullPath || (props.path === '/products' && props.queryPanel === 'columns' ? '/products?panel=columns' : props.path || '/'))

const sourceTitle = ref('')
const sourceKey = ref('')
const form = reactive({ kind: 'bug' as FeedbackKind, title: '', content: '', featureId: '', featureName: '' })
const pending = ref<Array<{ id: string; name: string; type: string; size: number; file: File; url: string }>>([])
let pendingFeedbackId = ''

function openPageGuide() { openGuide({ pageId: guidePageFor(props.path, {panel:props.queryPanel}, store.data)?.id }) }
function syncFeatureName() { form.featureName=sheet.value?.features.find(item=>item.id===form.featureId)?.name || '' }
function resetForm() {
  pendingFeedbackId = ''
  form.kind = 'bug'
  form.title = ''
  form.content = ''
  form.featureId = ''
  form.featureName = ''
  guideSource.value = {}
  pending.value.forEach((item) => URL.revokeObjectURL(item.url))
  pending.value = []
}
function openFeedback(feature?: PageFeature, source:GuideFeedbackSource={}) {
  resetForm()
  sourceTitle.value = pageTitle.value
  sourceKey.value = pageKey.value
  form.featureId = feature?.id || ''
  form.featureName = feature?.name || ''
  guideSource.value = {...source}
  if (source.articleId) form.title = `说明反馈：${guide.article(source.articleId)?.title || source.articleId}`
  closeGuide()
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
  const required=store.data.feedbacks.some(item=>item.id===pendingFeedbackId)?'system:feedback:update':'system:feedback:create'
  if (!store.can(required)) { ElMessage.error(`当前身份没有 ${required} 权限，反馈输入和附件保留。`); return }
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
      ...guideSource.value,
    }
    pendingFeedbackId = record.id
    if (existing) Object.assign(existing, record)
    else store.data.feedbacks.unshift(record)
    const saved = await store.flushPersistence()
    if (!saved.ok) { ElMessage.error(store.persistenceState.message || '反馈尚未保存，当前输入和附件已保留。'); return }
    formOpen.value = false
    ElMessage.success('已保存到本机。导出反馈包后，可发送给开发人员')
  } catch (cause) {
    ElMessage.error(`反馈未完成：${cause instanceof Error ? cause.message : String(cause)}。当前输入和附件保留，请核对本机保存状态。`)
  } finally {
    saving.value = false
  }
}
watch(() => guideUI.feedbackRequest, (request) => { if (request) { const {sequence:_,...source}=request; openFeedback(undefined,source) } })
onUnmounted(() => pending.value.forEach(item=>URL.revokeObjectURL(item.url)))
defineExpose({ openFeedback })
</script>

<style scoped>
.assist-note { color: var(--text-secondary); font-size: 13px; line-height: 1.5; }
.assist-files { margin: 8px 0 0; padding: 0; list-style: none; }
.assist-files li { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.assist-files img { width: 42px; height: 42px; object-fit: cover; border-radius: 4px; }
</style>
