<template>
  <section class="panel category-panel" :data-category-panel="panelId">
    <header>
      <strong>{{ title }}</strong>
      <div class="panel-actions">
        <el-button link @click="expandAll">展开全部</el-button>
        <el-button link @click="collapseAll">收起全部</el-button>
        <el-button v-if="closable" link :aria-label="`关闭${title}`" @click="$emit('close')">关闭</el-button>
      </div>
    </header>
    <el-input v-model="keyword" :disabled="!!rootId" placeholder="搜索并定位分类" :aria-label="`${title}搜索分类`" clearable />
    <div ref="scrollBox" class="category-scroll" @dragover.capture="edgeScroll" @dragleave="leaveScroll">
      <div v-for="row in rows" :key="row.id" class="cat-row" :data-id="row.id"
        :class="rowClasses(row.id)" :style="{ paddingLeft: `${8 + row.depth * 16}px` }"
        :draggable="editing && !busy && renameId !== row.id" tabindex="0"
        @click="pick(row.id, true)" @keydown.enter.self.prevent="pick(row.id, true, true)"
        @dragstart="startDrag(row.id, $event)" @dragend="endDrag"
        @dragover.prevent.stop="$emit('dragover', row.id, position($event), $event)"
        @drop.prevent.stop="$emit('drop', row.id, position($event), $event)">
        <button class="cat-expand" :aria-label="`${row.expanded ? '收起' : '展开'}${row.name}`" :aria-expanded="row.hasChildren ? row.expanded : undefined" @click.stop="toggle(row.id)">{{ row.hasChildren ? row.expanded ? '▼' : '▸' : '·' }}</button>
        <input v-if="renameId === row.id" ref="renameInput" v-model="renameValue" class="cat-rename" aria-label="分类新名称"
          @click.stop @dragstart.stop.prevent @keydown.enter.prevent="commitRename" @keydown.esc.stop.prevent="cancelRename" @blur="commitRename" />
        <span v-else class="cat-name" :title="row.name" @dblclick.stop="startRename(row.id)"><template v-for="(part,index) in highlightParts(row.name,keyword)" :key="index"><mark v-if="part.hit">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>
        <span v-if="!row.enabled" class="muted">停用</span>
        <span v-if="badges.get(row.id)" class="muted count">{{ badges.get(row.id) }}</span>
        <div class="cat-ops" @click.stop @dragstart.stop.prevent>
          <el-button v-if="editing" link :disabled="busy" @click="$emit('stage',row.id)">移动</el-button>
          <el-dropdown trigger="click" @command="(action: string) => command(row.id, action)">
            <el-button link :aria-label="`${row.name}更多操作`">更多</el-button>
            <template #dropdown><el-dropdown-menu>
              <el-dropdown-item command="detail">查看详情</el-dropdown-item>
              <template v-if="editing">
                <el-dropdown-item command="rename" :disabled="busy">改名</el-dropdown-item>
                <el-dropdown-item command="create" :disabled="busy">新增子分类</el-dropdown-item>
                <el-dropdown-item command="edit" :disabled="busy">编辑与属性方案</el-dropdown-item>
                <el-dropdown-item command="copy" :disabled="busy">复制子树</el-dropdown-item>
                <el-dropdown-item command="remove" :disabled="busy" divided>删除分类</el-dropdown-item>
              </template>
            </el-dropdown-menu></template>
          </el-dropdown>
        </div>
      </div>
      <el-empty v-if="!rows.length" :description="keyword ? '没有匹配的分类' : emptyDescription || '还没有分类'" :image-size="55" />
    </div>
    <footer v-if="sourceId && editing && !hideMoveFooter" class="move-target">
      <span>移动「{{ sourceName }}」 · 目标父级：{{ selectedPath || '请在本栏选择分类' }}</span>
      <el-button type="primary" :disabled="busy || !selected || !!targetMessage" @click="$emit('move',selected)">确认移入</el-button>
      <small v-if="targetMessage">{{ targetMessage }}</small>
    </footer>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { branchIds, categoryChain, categoryPathLabel, highlightParts, visibleCategoryRows, type DropPosition } from '../../domain/categoryTree'
import type { Category } from '../../domain/types'

const props = defineProps<{
  panelId: string; title: string; categories: Category[]; initialId: string; editing: boolean; busy: boolean
  closable: boolean; badges: Map<string, number>; sourceId: string; dragging: boolean
  drop?: { panelId: string; id: string; position: DropPosition; message: string } | null
  blockTarget: (id: string) => string
  rootId?: string; hideMoveFooter?: boolean; emptyDescription?: string
}>()
const emit = defineEmits<{
  close: []; select: [id: string]; stage: [id: string]; move: [id: string]
  action: [id: string, action: string]
  rename: [id: string, name: string, done: (ok: boolean) => void]
  dragstart: [id: string, event: DragEvent]; dragover: [id: string, position: DropPosition, event: DragEvent]
  drop: [id: string, position: DropPosition, event: DragEvent]; dragend: []
}>()
const keyword = ref(''), selected = ref(props.initialId), located = ref('')
const expanded = ref(new Set(categoryChain(props.categories, props.initialId).slice(0,-1).map(item => item.id)))
const closed = ref(new Set<string>()), scrollBox = ref<HTMLElement>()
const renameId = ref(''), renameValue = ref(''), renameInput = ref<HTMLInputElement[]>([])
let renaming = false, alive = true, suppressClickUntil = 0, scrollFrame = 0, scrollSpeed = 0
const browseCategories = computed(() => {
  if(!props.rootId)return props.categories
  const ids=new Set<string>([props.rootId]);let changed=true
  while(changed){changed=false;for(const row of props.categories)if(row.parentId&&ids.has(row.parentId)&&!ids.has(row.id)){ids.add(row.id);changed=true}}
  return props.categories.filter(row=>ids.has(row.id)).map(row=>row.id===props.rootId?{...row,parentId:null}:row)
})
const rows = computed(() => visibleCategoryRows(browseCategories.value, expanded.value, props.rootId?'':keyword.value, closed.value))
watch(()=>props.rootId,id=>{if(id){keyword.value='';selected.value=id;expanded.value=new Set(branchIds(browseCategories.value));closed.value=new Set()}},{immediate:true})
function clearSearch(){keyword.value='';located.value=''}
const sourceName = computed(() => props.categories.find(item => item.id === props.sourceId)?.name || '来源已不存在')
const selectedPath = computed(() => categoryPathLabel(props.categories, selected.value))
const targetMessage = computed(() => selected.value ? props.blockTarget(selected.value) : '')
watch(keyword, () => {
  closed.value = new Set()
  const match = props.categories.find(item => keyword.value.trim() && item.name.toLowerCase().includes(keyword.value.trim().toLowerCase()))
  located.value = match?.id || ''
  if (match) { selected.value = match.id; emit('select',match.id); void focusRow(match.id) }
})
watch(() => props.editing, value => { if (!value) cancelRename() })
watch(() => props.dragging, (value, previous) => { if (!value) { stopScroll(); if (previous) suppressClickUntil = Date.now() + 250 } })
function rowClasses(id: string) {
  const drop = props.drop?.panelId === props.panelId && props.drop.id === id ? props.drop : undefined
  return { 'is-active': selected.value === id, 'is-located': located.value === id, 'is-source': props.sourceId === id,
    'is-drop-before': drop?.position === 'before' && !drop.message, 'is-drop-after': drop?.position === 'after' && !drop.message,
    'is-drop-inner': drop?.position === 'inner' && !drop.message, 'is-drop-ban': !!drop?.message }
}
function toggle(id: string) {
  const row = rows.value.find(item => item.id === id)
  if (!row?.hasChildren) return
  if (row.expanded) { expanded.value.delete(id); closed.value.add(id) }
  else { expanded.value.add(id); closed.value.delete(id) }
}
function expandAll() { expanded.value = new Set(branchIds(browseCategories.value)); closed.value = new Set() }
function collapseAll() { expanded.value = new Set(); closed.value = new Set(branchIds(browseCategories.value)) }
function pick(id: string, toggleInView = false, keyboard = false) {
  if ((!keyboard && Date.now() < suppressClickUntil) || props.dragging) return
  selected.value = id; emit('select',id)
  if (toggleInView && !props.editing) toggle(id)
}
async function focusRow(id: string) {
  await nextTick()
  const box = scrollBox.value, row = box?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)
  if (!box || !row) return
  const delta = row.getBoundingClientRect().top - box.getBoundingClientRect().top
  if (delta < 0) box.scrollTop += delta - 8
  else if (delta + row.offsetHeight > box.clientHeight) box.scrollTop += delta + row.offsetHeight - box.clientHeight + 8
  row.focus({ preventScroll: true })
}
function reveal(id: string, focus = false) {
  if (focus) keyword.value = ''
  for (const parent of categoryChain(props.categories,id).slice(0,-1)) { expanded.value.add(parent.id); closed.value.delete(parent.id) }
  if (focus) { selected.value = id; located.value = id; emit('select',id); void focusRow(id) }
}
function startRename(id: string) {
  if (!props.editing || props.busy || props.dragging || Date.now() < suppressClickUntil) return
  renameId.value = id; renameValue.value = props.categories.find(item => item.id === id)?.name || ''; selected.value = id
  void nextTick(() => { renameInput.value[0]?.focus(); renameInput.value[0]?.select() })
}
function cancelRename() { renameId.value = ''; renameValue.value = '' }
function commitRename() {
  if (!props.editing || props.busy || !renameId.value || renaming) return
  renaming = true
  const id = renameId.value
  emit('rename', id, renameValue.value, ok => { renaming = false; if (alive && renameId.value === id && ok) cancelRename() })
}
function command(id: string, action: string) {
  if (action === 'rename') startRename(id)
  else { pick(id); emit('action',id,action) }
}
function position(event: DragEvent): DropPosition {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (event.clientY - rect.top) / Math.max(1,rect.height)
  return ratio < .28 ? 'before' : ratio > .72 ? 'after' : 'inner'
}
function startDrag(id: string, event: DragEvent) {
  if (!props.editing || props.busy || (event.target as HTMLElement)?.closest('button,input')) { event.preventDefault(); return }
  suppressClickUntil = Date.now() + 500
  emit('dragstart', id, event)
}
function endDrag() { suppressClickUntil = Date.now() + 250; stopScroll(); emit('dragend') }
function stopScroll() { cancelAnimationFrame(scrollFrame); scrollFrame = 0; scrollSpeed = 0 }
function leaveScroll(event: DragEvent) { if (!scrollBox.value?.contains(event.relatedTarget as Node | null)) stopScroll() }
function edgeScroll(event: DragEvent) {
  if (!props.dragging || !scrollBox.value) return
  event.preventDefault()
  const rect = scrollBox.value.getBoundingClientRect()
  scrollSpeed = event.clientY < rect.top + 42 ? -8 : event.clientY > rect.bottom - 42 ? 8 : 0
  if (!scrollFrame && scrollSpeed) {
    const step = () => { if (!props.dragging || !scrollBox.value || !scrollSpeed) { stopScroll(); return }; scrollBox.value.scrollTop += scrollSpeed; scrollFrame = requestAnimationFrame(step) }
    scrollFrame = requestAnimationFrame(step)
  }
}
onBeforeUnmount(() => { alive = false; stopScroll() })
defineExpose({ reveal, selectedId: selected, clearSearch })
</script>
<style scoped>
.category-panel{min-width:0;padding:16px;display:flex;flex-direction:column;gap:12px}.category-panel header,.panel-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.panel-actions{flex-wrap:wrap}.category-scroll{height:clamp(300px,62vh,720px);overflow:auto;overscroll-behavior:contain;position:relative;border:1px solid var(--el-border-color-lighter);border-radius:6px}.cat-row{display:flex;align-items:center;gap:6px;min-height:40px;padding-right:8px;border-bottom:1px solid var(--el-border-color-extra-light);position:relative;color:var(--el-text-color-primary)}.cat-row[draggable=true]{cursor:grab}.cat-row:hover,.cat-row:focus-within{background:var(--el-fill-color-light)}.cat-row.is-active{background:var(--el-color-primary-light-9)}.cat-row.is-located{border-left:3px solid var(--el-color-primary)}.cat-row.is-source .cat-name{font-weight:650}.cat-expand{border:0;background:none;color:var(--el-text-color-secondary);width:24px;flex:none;cursor:pointer}.cat-name{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:14px}.cat-ops{display:flex;gap:6px}.cat-ops .el-button{margin:0}.muted{color:var(--el-text-color-secondary);font-size:12px}.cat-rename{width:100%;min-width:0;background:var(--el-bg-color);color:var(--el-text-color-primary);border:1px solid var(--el-color-primary);padding:4px}.is-drop-before::before,.is-drop-after::after{content:'';position:absolute;left:0;right:0;height:3px;background:var(--el-color-primary);z-index:2}.is-drop-before::before{top:0}.is-drop-after::after{bottom:0}.is-drop-inner{outline:2px dashed var(--el-color-primary);outline-offset:-2px;background:var(--el-color-primary-light-8)}.is-drop-ban{outline:2px dashed var(--el-color-danger);outline-offset:-2px;background:var(--el-color-danger-light-9)}.move-target{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;font-size:13px}.move-target span{overflow-wrap:anywhere}.move-target small{width:100%;color:var(--el-color-warning-dark-2)}mark{background:var(--el-color-warning-light-7);color:inherit}.cat-row:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:-2px}
@media(max-width:700px){.category-panel{padding:12px}.category-scroll{height:360px}.panel-actions{gap:4px}.count{display:none}}
</style>
