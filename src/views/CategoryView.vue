<template>
  <div data-category-workspace>
    <PageHead title="商品分类中心" desc="左侧选择分类并点击移动，在右侧暂存子树，再选择目标父级确认。">
      <el-button v-if="panels.length === 1" data-open-category-panel @click="openPanel">打开待移动区</el-button>
    </PageHead>
    <div class="workspace-toolbar">
      <el-radio-group v-model="treeMode" aria-label="分类操作模式">
        <el-radio-button value="view">查看模式</el-radio-button>
        <el-radio-button value="edit">编辑模式</el-radio-button>
      </el-radio-group>
      <span class="muted">{{ editing ? '拖到上缘或下缘调整顺序，拖到中间移入。也可点击移动后选择目标。' : '只浏览分类；需要修改时打开编辑模式。' }}</span>
      <el-button v-if="editing" :disabled="(saving || !!saveError) || !(store.can('product:category:create'))" @click="openCreate(null)">新增根分类</el-button>
      <el-button v-if="panels.length === 2" link @click="detailsOpen = !detailsOpen">{{ detailsOpen ? '收起详情' : '查看详情' }}</el-button>
    </div>
    <div v-if="staged" class="source-strip" data-category-source>
      <div><strong>待移动：{{ sourcePath }}</strong><span>包含 {{ sourceDescendants }} 个子分类</span></div>
      <div class="source-actions"><el-button link @click="locateSource">定位来源</el-button><el-button v-if="editing" :disabled="saving" :type="moveTarget === null ? 'primary' : 'default'" data-category-root-target @click="chooseMoveTarget(null)">选择顶级分类</el-button><el-button link :disabled="saving" @click="cancelMove()">取消移动</el-button></div>
    </div>
    <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" data-category-save-error>
      <el-button :loading="saving" @click="retrySave">重试保存当前结果</el-button>
    </el-alert>
    <div class="operation-status">
    <p v-if="interactionMessage" class="interaction-message" role="status">{{ interactionMessage }}</p>
    <p v-if="dropState" class="drop-hint" :class="{blocked: !!dropState.message}" role="status">{{ dropState.message || `放置方式：${dropLabels[dropState.position]}` }}</p>
    </div>
    <div class="cat-layout" :class="{ 'is-dual': panels.length === 2 }">
      <div v-for="panel in panels" :key="panel.id" class="category-pane" :class="{'is-move-source':staged && panel.id !== panels[0]?.id}">
      <CategoryBrowsePanel :ref="el => bindPanel(panel.id,el)"
        :panel-id="panel.id" :title="staged ? panel.id === panels[0]?.id ? '选择目标父级' : '待移动分类' : panel.title" :categories="panelCategories(panel.id)" :initial-id="panel.initialId"
        :root-id="staged && panel.id !== panels[0]?.id ? staged.id : undefined" :hide-move-footer="!!staged" :empty-description="!staged && panel.id !== panels[0]?.id ? '从左侧分类行选择移动' : undefined"
        :editing="editing && !(staged && panel.id !== panels[0]?.id)" :busy="saving || !!saveError" :closable="panels.length > 1 && (!staged || panel.id !== panels[0]?.id)" :badges="productBadges"
        :source-id="staged?.id || ''" :dragging="!!drag" :drop="dropState" :block-target="targetBlock"
        @close="closePanel(panel.id)" @select="id => selectInPanel(panel.id,id)"
        @stage="id => stageSource(panel.id,id)" @move="targetId => staged && chooseMoveTarget(targetId)"
        @action="(id,action) => panelAction(panel.id,id,action)" @rename="renameCategory"
        @dragstart="(id,event) => startDrag(panel.id,id,event)" @dragover="(id,position,event) => dragOver(panel.id,id,position,event)"
        @drop="(id,position,event) => drop(panel.id,id,position,event)" @dragend="cancelDrag()" />
      <section v-if="staged && panel.id !== panels[0]?.id" class="panel move-confirm-panel" data-category-move-confirm>
        <strong>移动到：{{ moveTargetPath }}</strong>
        <p v-if="moveTargetProblem" class="issue-error">{{ moveTargetProblem }}</p>
        <el-alert v-if="moveError" :title="moveError" type="error" :closable="false" data-category-move-error />
        <div class="row-actions"><el-button :disabled="saving" @click="cancelMove()">取消移动</el-button><el-button type="primary" :loading="saving" :disabled="!editing || moveTarget === undefined || !!moveTargetProblem" data-category-confirm-move @click="confirmStagedMove">{{ moveError ? '重试移动' : '确认移动' }}</el-button></div>
      </section>
      </div>
      <section v-if="current && (panels.length === 1 || detailsOpen)" class="panel cat-detail">
        <h2>{{ current.name }}</h2>
        <div class="info-card">
          <h3>基础信息</h3>
          <p><span>名称</span>{{ current.name }}</p>
          <p><span>父级</span>{{ parentName }}</p>
          <p><span>状态</span>{{ current.enabled === false ? '停用' : '启用' }}</p>
        </div>
        <div class="info-card">
          <h3>商品统计</h3>
          <p><span>商品</span>{{ productCount }}</p>
          <p><span>SKU</span>{{ skuCount }}</p>
          <p v-for="item in ownedFamilies" :key="item.id" class="owned-product">
            <button type="button" class="linkish" @click="openProduct(item.id)">{{ item.name }}</button>
            <span v-if="shelfOf(item) === 'online'">已发布</span>
          </p>
          <button v-if="ownedFamilies.length" type="button" class="linkish" @click="openProducts">在商品列表中查看</button>
        </div>
        <div class="info-card">
          <h3>属性方案</h3>
          <p><span>方案</span>{{ schemeName || '未配置' }}</p>
          <p><span>来源</span>{{ currentMapping ? '本级绑定' : '未绑定' }}</p>
          <div v-if="currentMapping" class="card-links">
            <button type="button" class="linkish" @click="refsOpen = true">该方案被 {{ schemeUsers.length }} 个分类使用</button>
            <button v-if="store.can('product:template:update')" type="button" class="linkish" @click="openScheme">跳转属性方案</button>
          </div>
        </div>
        <div v-if="editing" class="row-actions">
          <el-button @click="openCreate(current.id)" :disabled="!(store.can('product:category:create'))">新增子分类</el-button>
          <el-button @click="openEdit(current.id)" :disabled="!(store.can('product:category:update'))">编辑</el-button>
          <el-button :disabled="!store.can('product:category:update')" @click="openMove(current.id)">移动</el-button>
          <el-button type="danger" @click="remove(current.id)" :disabled="!(store.can('product:category:delete'))">删除</el-button>
        </div>
      </section>
      <section v-else-if="panels.length === 1 || detailsOpen" class="panel cat-detail">
        <el-empty description="选择左侧分类后查看" />
      </section>
    </div>

    <el-dialog v-model="refsOpen" title="引用分类" width="420px">
      <p v-for="item in schemeUsers" :key="item">{{ item }}</p>
    </el-dialog>
    <el-dialog v-model="createOpen" :title="parentForCreate ? '新增子分类' : '新增根分类'" width="420px">
      <p class="muted" style="margin-bottom: 8px">{{ parentForCreate ? `上级：${createParentLabel}` : '将创建为根分类' }}</p>
      <el-input v-model="createName" placeholder="分类名称" @keyup.enter="create" />
      <template #footer>
        <el-button @click="createOpen = false">取消</el-button>
        <el-button type="primary" @click="create" :disabled="!(store.can('product:category:create'))">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="editOpen" title="编辑分类" width="460px">
      <el-form label-width="88px">
        <el-form-item label="名称">
          <el-input v-model="draft.name" @keyup.enter="saveEdit" />
        </el-form-item>
        <p class="muted">调整上级请用「移动」，在旁边的分类树里选择。</p>
        <el-form-item label="状态">
          <el-switch v-model="draft.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item v-if="store.can('product:template:update')" label="属性方案">
          <el-select v-model="draft.templateId" clearable placeholder="不绑定" style="width: 100%">
            <el-option v-for="item in bindableSchemes" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <p v-if="!store.can('product:template:update')" class="muted">属性方案绑定由管理员操作。</p>
      <template #footer>
        <el-button @click="editOpen = false">取消</el-button>
        <el-button type="primary" @click="saveEdit" :disabled="!(store.can('product:category:update'))">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import PageHead from '../components/PageHead.vue'
import CategoryBrowsePanel from '../components/category/CategoryBrowsePanel.vue'
import { categoryChain, subtreeCounts, type DropPosition } from '../domain/categoryTree'
import { categoryStructureStamp, previewCategoryMove, type CategoryMoveRequest } from '../domain/categoryMovement'
import { descendantIds, shelfOf, templateById } from '../domain/logic'
import { applyPresetToActiveView } from '../domain/productListViews'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore(), router = useRouter()
const treeMode = ref<'view' | 'edit'>('view'), editing = computed(() => treeMode.value === 'edit' && store.can('product:category:update'))
const initialId = store.data.categories.some(item => item.id === 'c-phone') ? 'c-phone' : store.data.categories[0]?.id || ''
const selected = ref(initialId), activePanel = ref('panel-1'), detailsOpen = ref(false)
const panels = ref([{id:'panel-1',title:'分类栏 A',initialId}])
const panelRefs = new Map<string, InstanceType<typeof CategoryBrowsePanel>>()
let panelSequence = 1, interactionSequence = 0, contextEpoch = 0, alive = true
const saving = ref(false), saveError = ref(''), interactionMessage = ref('')
const canMutate = () => alive && editing.value && !saving.value && !saveError.value
const staged = ref<{id:string; panelId:string} | null>(null)
const moveTarget = ref<string | null | undefined>(), moveError = ref('')
let beforeMove: { panels: {id:string;title:string;initialId:string}[]; selected:string; activePanel:string } | null = null
const moveTargetPath = computed(() => moveTarget.value === undefined ? '请在左侧选择分类' : moveTarget.value === null ? '顶级分类' : categoryChain(store.data.categories,moveTarget.value).map(item=>item.name).join(' / '))
const moveTargetProblem = computed(() => {
  if (!staged.value || moveTarget.value === undefined) return ''
  const check = previewCategoryMove(store.data.categories,{id:staged.value.id,targetId:moveTarget.value},typedIds.value)
  return check.message || (!check.changed ? '位置没有变化，请选择其他目标父级。' : '')
})
function panelCategories(panelId:string) {
  if(panelId !== panels.value[0]?.id){if(!staged.value)return [];const included=new Set([staged.value.id,...descendantIds(store.data.categories,staged.value.id)]);return store.data.categories.filter(item=>included.has(item.id))}
  if (!staged.value) return store.data.categories
  const excluded = new Set([staged.value.id,...descendantIds(store.data.categories,staged.value.id)])
  return store.data.categories.filter(item=>!excluded.has(item.id))
}
function chooseMoveTarget(id:string|null) { if (saving.value || !staged.value) return; moveTarget.value=id; moveError.value='' }
function cancelMove(closeRight=false) {
  if (saving.value) return
  const previous=beforeMove
  staged.value=null;moveTarget.value=undefined;moveError.value='';beforeMove=null;cancelDrag()
  if(previous){panels.value=closeRight?previous.panels.slice(0,1):previous.panels;selected.value=previous.selected;activePanel.value=previous.activePanel;void nextTick(()=>panelRefs.get(panels.value[0]!.id)?.reveal(previous.selected,true))}
}
async function confirmStagedMove() {
  if (!staged.value || saving.value || !editing.value || moveTarget.value === undefined || moveTargetProblem.value) return
  const source=staged.value.id,target=moveTarget.value,previous=beforeMove
  saving.value=true;moveError.value=''
  try {
    const result=await store.commitCategoryMove(source,target)
    if(!result.ok){moveError.value=result.message||'移动未保存，来源和目标选择已保留。';return}
    staged.value=null;moveTarget.value=undefined;beforeMove=null;panels.value=previous?.panels||panels.value.slice(0,1);selected.value=source;activePanel.value=panels.value[0]!.id
    await nextTick();panelRefs.get(activePanel.value)?.reveal(source,true);ElMessage.success('分类已移动并保存')
  } catch(cause) { moveError.value=cause instanceof Error?cause.message:'移动未保存，来源和目标选择已保留。' }
  finally {saving.value=false}
}

const drag = shallowRef<{id:string; panelId:string; stamp:string; epoch:number; token:string} | null>(null)
const dropState = ref<{panelId:string; id:string; position:DropPosition; message:string} | null>(null)
const dropLabels = {before:'目标之前',after:'目标之后',inner:'作为目标的子分类'}
const structureStamp = computed(() => categoryStructureStamp(store.data.categories))
const typedIds = computed(() => new Set(store.data.productTypes.map(item => item.categoryId)))
const sourcePath = computed(() => staged.value ? categoryChain(store.data.categories,staged.value.id).map(item => item.name).join(' / ') : '')
const sourceDescendants = computed(() => staged.value ? descendantIds(store.data.categories,staged.value.id).length : 0)
const createOpen = ref(false), editOpen = ref(false), refsOpen = ref(false), createName = ref('')
const parentForCreate = ref<string | null>(null), editId = ref('')
let pendingCreateId = ''
const draft = reactive({name:'',enabled:true,templateId:''})
const current = computed(() => store.data.categories.find((item) => item.id === selected.value))
const productBadges = computed(() => subtreeCounts(store.data.categories, store.data.families))
const parentName = computed(() => {
  if (!current.value?.parentId) return '根分类'
  return store.data.categories.find((item) => item.id === current.value?.parentId)?.name || '根分类'
})
const currentMapping = computed(() => (current.value ? store.data.mappings.find((item) => item.categoryId === current.value!.id) : undefined))
const schemeName = computed(() => (currentMapping.value ? templateById(store.data, currentMapping.value.templateId)?.name || '' : ''))
const schemeUsers = computed(() => {
  const templateId = currentMapping.value?.templateId
  if (!templateId) return []
  return store.data.mappings
    .filter((item) => item.templateId === templateId)
    .map((item) => store.data.categories.find((category) => category.id === item.categoryId)?.name || '')
    .filter(Boolean)
})
const bindableSchemes = computed(() => store.data.templates.filter((item) => item.structureOrder.length > 0))
const createParentLabel = computed(() => (parentForCreate.value ? categoryChain(store.data.categories, parentForCreate.value).map((item) => item.name).join(' / ') : ''))
const ownedFamilies = computed(() => store.data.families.filter((item) => item.categoryId === current.value?.id))
const productCount = computed(() => ownedFamilies.value.length)
const skuCount = computed(() => {
  const ids = new Set(ownedFamilies.value.map((item) => item.id))
  return store.data.skus.filter((item) => ids.has(item.familyId)).length
})


function bindPanel(id: string, element: unknown) {
  if (element) panelRefs.set(id,element as InstanceType<typeof CategoryBrowsePanel>)
  else panelRefs.delete(id)
}
function openPanel() {
  if (panels.value.length > 1) return
  panelSequence++
  panels.value.push({id:`panel-${panelSequence}`,title:'待移动分类',initialId:staged.value?.id || selected.value})
}
function closePanel(id: string) {
  if(staged.value && id !== panels.value[0]?.id){cancelMove(true);return}
  if (panels.value.length < 2) return
  if (drag.value?.panelId === id || dropState.value?.panelId === id) cancelDrag('面板已关闭，本次拖动已取消。')
  panels.value = panels.value.filter(panel => panel.id !== id)
  if (activePanel.value === id) { activePanel.value = panels.value[0]!.id; selected.value = panelRefs.get(activePanel.value)?.selectedId || '' }
  detailsOpen.value = false
}
function selectInPanel(panelId: string, id: string) { activePanel.value = panelId; selected.value = id; if(staged.value && panelId === panels.value[0]?.id)chooseMoveTarget(id) }
function pick(id: string) { selected.value = id; panelRefs.get(activePanel.value)?.reveal(id,true) }
function reveal(id: string) { panelRefs.get(activePanel.value)?.reveal(id) }
function stageSource(panelId: string, id: string) {
  if (!canMutate() || !store.data.categories.some(item => item.id === id)) return
  cancelDrag();if(!staged.value)beforeMove={panels:panels.value.map(item=>({...item})),selected:selected.value,activePanel:activePanel.value};staged.value = {id,panelId};moveTarget.value=undefined;moveError.value='';interactionMessage.value='';openPanel();void nextTick(()=>panelRefs.get(panels.value[0]!.id)?.clearSearch())
}
function openMove(id: string) { stageSource(activePanel.value,id) }
function locateSource() {
  if (!staged.value) return
  const id = panels.value[1]?.id || panels.value[0]!.id
  panelRefs.get(id)?.reveal(staged.value.id,true)
}
function targetBlock(targetId: string) {
  return staged.value ? previewCategoryMove(store.data.categories,{id:staged.value.id,targetId},typedIds.value).message : ''
}
function panelAction(panelId: string, id: string, action: string) {
  selectInPanel(panelId,id)
  if (action === 'detail') { detailsOpen.value = true; return }
  if (!canMutate()) return
  if (action === 'create') openCreate(id)
  if (action === 'edit') openEdit(id)
  if (action === 'copy') void copyNode(id)
  if (action === 'remove') void remove(id)
}
function cancelDrag(message = '') {
  drag.value = null; dropState.value = null
  if (message) interactionMessage.value = message
}
function startDrag(panelId: string, id: string, event: DragEvent) {
  if (!canMutate()) { event.preventDefault(); return }
  const token = `category-${++interactionSequence}`
  drag.value = {id,panelId,stamp:structureStamp.value,epoch:contextEpoch,token}
  interactionMessage.value = ''
  event.dataTransfer?.setData('application/x-erp-category',token)
  event.dataTransfer?.setData('text/plain',categoryChain(store.data.categories,id).map(item=>item.name).join(' / '))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function validDrag() {
  return canMutate() && drag.value && drag.value.epoch === contextEpoch && drag.value.stamp === structureStamp.value
    && panels.value.some(panel => panel.id === drag.value?.panelId)
}
function dragOver(panelId: string, id: string, position: DropPosition, event: DragEvent) {
  if (!validDrag() || !drag.value) return
  const result = previewCategoryMove(store.data.categories,{id:drag.value.id,targetId:id,position},typedIds.value)
  dropState.value = {panelId,id,position,message:result.message}
  if (event.dataTransfer) event.dataTransfer.dropEffect = result.message ? 'none' : 'move'
}
async function drop(panelId: string, id: string, position: DropPosition, event: DragEvent) {
  if (!validDrag() || !drag.value || event.dataTransfer?.getData('application/x-erp-category') !== drag.value.token
    || dropState.value?.panelId !== panelId || dropState.value.id !== id) { cancelDrag(); return }
  const sourceId = drag.value.id
  cancelDrag()
  await performMove({id:sourceId,targetId:id,position},panelId)
}
async function flushChanges() {
  if (saving.value) return false
  saving.value = true
  try {
    const result = await store.flushPersistence()
    saveError.value = result.ok ? '' : `${store.persistenceState.message || '保存失败'} 当前分类编辑已保留在本页，尚未保存；重试只保存当前结果。`
    return result.ok
  } catch (cause) {
    saveError.value = `${cause instanceof Error ? cause.message : '保存失败'}。当前分类编辑尚未保存，已保留在本页。`
    return false
  } finally { saving.value = false }
}
async function performMove(request: CategoryMoveRequest, targetPanel: string) {
  if (!canMutate()) return
  const check = previewCategoryMove(store.data.categories,request,typedIds.value)
  if (check.message) { interactionMessage.value = check.message; return }
  if (!check.changed) { interactionMessage.value = '位置没有变化。'; return }
  const epoch = contextEpoch
  const message = request.position ? store.relocateCategory(request.id,request.targetId || '',request.position) : store.moveCategory(request.id,request.targetId)
  if (message) { interactionMessage.value = message; return }
  interactionMessage.value = ''
  if (!await flushChanges()) return
  if (!alive) return
  if (epoch === contextEpoch) {
    if (staged.value?.id === request.id) staged.value = null
    panelRefs.get(targetPanel)?.reveal(request.id)
  }
  ElMessage.success(request.position && request.position !== 'inner' ? '分类位置已保存' : '已移动分类')
}
async function retrySave() {
  if (saving.value || !saveError.value) return
  if (await flushChanges()) { staged.value = null; ElMessage.success('当前分类修改已保存') }
}
async function renameCategory(id: string, name: string, done: (ok:boolean) => void) {
  if (!canMutate()) { done(false); return }
  const item = store.data.categories.find(category => category.id === id)
  if (!item) { done(false); return }
  if (name.trim() === item.name) { done(true); return }
  const message = store.updateCategory(id,{...item,name,enabled:item.enabled !== false})
  if (message) { ElMessage.warning(message); done(false); return }
  const ok = await flushChanges(); done(ok)
  if (ok) ElMessage.success('已保存')
}
watch(structureStamp, () => {
  if (drag.value) cancelDrag('分类结构已变化，本次拖动已取消，请重新拖动。')
  if (staged.value && !store.data.categories.some(item=>item.id===staged.value?.id)) { staged.value = null; interactionMessage.value = '来源分类已不存在，已取消待移动来源。' }
}, {flush:'sync'})
watch(() => [treeMode.value, store.editorGeneration, store.activeUserId, store.can('product:category:update')], () => {
  contextEpoch++
  if (drag.value) cancelDrag('操作上下文已变化，尚未提交的拖动已取消。')
  else interactionMessage.value = ''
  if (!editing.value) { createOpen.value = false; editOpen.value = false; if(staged.value&&!saving.value)cancelMove() }
}, {flush:'sync'})
watch(() => store.editorGeneration, () => { staged.value = null })
function escape(event: KeyboardEvent) { if (event.key === 'Escape' && drag.value) { event.preventDefault(); cancelDrag('已取消拖动。') } }
onMounted(() => window.addEventListener('keydown',escape,true))
onBeforeRouteLeave(() => { contextEpoch++; cancelDrag() })
onBeforeUnmount(() => { alive = false; contextEpoch++; cancelDrag(); window.removeEventListener('keydown',escape,true) })
function openCreate(parentId: string | null) {
  if (!canMutate()) return
  parentForCreate.value = parentId
  pendingCreateId = ''
  createName.value = ''
  createOpen.value = true
}
async function create() {
  if (!canMutate()) return
  const name = createName.value.trim()
  if (!name) {
    ElMessage.warning('请填写分类名称')
    return
  }
  const parentId = parentForCreate.value
  const pending = store.data.categories.find(row => row.id === pendingCreateId)
  const created = pending ? { id: pending.id, message: store.updateCategory(pending.id, { ...pending, name, parentId }) } : store.addCategory(name, parentId)
  if (created.message) {
    ElMessage.warning(created.message)
    return
  }
  pendingCreateId = created.id
  if (!await flushChanges()) return
  const id = created.id
  if (parentId) reveal(id)
  selected.value = id
  createOpen.value = false
  ElMessage.success('已新增分类')
}
function openEdit(id: string) {
  if (!canMutate()) return
  const item = store.data.categories.find((row) => row.id === id)
  if (!item) return
  pick(id)
  editId.value = id
  draft.name = item.name
  draft.enabled = item.enabled !== false
  draft.templateId = store.data.mappings.find((row) => row.categoryId === id)?.templateId || ''
  editOpen.value = true
}
async function saveEdit() {
  if (!canMutate()) return
  const item = store.data.categories.find((row) => row.id === editId.value)
  if (!item) return
  const message = store.updateCategory(item.id, {
    name: draft.name,
    enabled: draft.enabled,
    sort: item.sort,
    parentId: item.parentId,
    icon: item.icon,
  })
  if (message) {
    ElMessage.warning(message)
    return
  }
  if (store.can('product:template:update')) {
    const currentTemplate = store.data.mappings.find((row) => row.categoryId === item.id)?.templateId || ''
    if (currentTemplate !== draft.templateId) store.setCategoryMapping(item.id, draft.templateId)
  }
  if (!await flushChanges()) return
  reveal(item.id)
  editOpen.value = false
  ElMessage.success('已保存')
}
async function copyNode(id: string) {
  if (!canMutate()) return
  const item = store.data.categories.find((row) => row.id === id)
  if (!item) return
  const epoch = contextEpoch
  try {
    await ElMessageBox.confirm(`将复制「${item.name}」及其子分类。商品不会被复制。`, '复制分类', { confirmButtonText: '复制', cancelButtonText: '取消' })
  } catch {
    return
  }
  if (!canMutate() || epoch !== contextEpoch) return
  const nextId = store.copyCategory(id)
  if (!nextId || !store.data.categories.some((row) => row.id === nextId)) {
    ElMessage.warning(nextId || '分类不存在')
    return
  }
  if (!await flushChanges()) return
  reveal(nextId)
  selected.value = nextId
  ElMessage.success('已复制分类')
}
function openProduct(id: string) {
  router.push(`/products/${id}`)
}
function openProducts() {
  if (!current.value) return
  applyPresetToActiveView(store.data, {
    query: { ...store.data.listQuery, keyword: '', categoryId: current.value.id, brand: '', status: '', templateId: '', productGroupId: '', attrFilters: {}, createdFrom: '', createdTo: '', shelf: '', page: 1 },
  })
  router.push('/products')
}
async function remove(id: string) {
  if (!canMutate()) return
  const block = store.categoryRemovalBlock(id)
  if (block) {
    const owned = store.data.families.filter((item) => item.categoryId === id)
    if (!owned.length) {
      ElMessage.warning(block)
      return
    }
    const names = owned.slice(0, 3).map((item) => item.name).join('、')
    const extra = owned.length > 3 ? `等 ${owned.length} 款` : ''
    const published = owned.some((item) => shelfOf(item) === 'online')
    ElMessage.warning(published ? `不能删除。还挂着已发布商品「${names}」${extra}。请先下架，再在商品列表删除。` : `不能删除。还挂着「${names}」${extra}。请先到商品列表删除。`)
    return
  }
  const item = store.data.categories.find((row) => row.id === id)
  if (!item) return
  const epoch = contextEpoch
  try {
    await ElMessageBox.confirm(`确定删除分类「${item.name}」？`, '删除分类', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
  } catch {
    return
  }
  if (!canMutate() || epoch !== contextEpoch) return
  const parentId = item.parentId || ''
  const message = store.removeCategory(id)
  if (message) ElMessage.warning(message)
  else {
    if (!await flushChanges()) return
    if (selected.value === id) selected.value = parentId
    ElMessage.success('已删除')
  }
}
function openScheme() {
  if (!currentMapping.value || !store.can('product:template:update')) return
  router.push({ path: '/templates', query: { scheme: currentMapping.value.templateId } })
}
</script>
<style scoped>
.category-pane{min-width:0}.is-move-source :deep(.category-scroll){height:clamp(180px,34vh,420px)}.move-confirm-panel{margin-top:12px;padding:16px;overflow-wrap:anywhere}.move-confirm-panel>strong{font-size:14px}.move-confirm-panel .el-alert{margin-top:10px}

.cat-layout{display:grid;grid-template-columns:minmax(350px,1.2fr) minmax(280px,1fr);gap:16px;align-items:start}.cat-layout > :deep(.panel){margin:0}.cat-layout.is-dual{grid-template-columns:repeat(2,minmax(0,1fr))}.is-dual>.cat-detail{grid-column:1/-1}.workspace-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px}.muted{color:var(--el-text-color-secondary);font-size:13px}.source-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;margin-bottom:14px;border:1px solid var(--el-color-primary-light-7);background:var(--el-color-primary-light-9);border-radius:8px}.source-strip>div:first-child{display:flex;flex-direction:column;gap:5px;min-width:0;overflow-wrap:anywhere}.source-strip span{font-size:13px;color:var(--el-text-color-secondary)}.source-actions{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}.operation-status{height:48px;overflow:auto}.interaction-message,.drop-hint{font-size:14px;line-height:1.6;color:var(--el-text-color-secondary);margin:10px 0}.drop-hint{color:var(--el-color-primary)}.drop-hint.blocked{color:var(--el-color-danger)}.cat-detail{padding:20px;min-width:0}.cat-detail h2{font-size:20px}.info-card{padding:12px 0;border-bottom:1px solid var(--el-border-color-lighter)}.info-card h3{font-size:13px;color:var(--el-text-color-secondary);margin:0 0 8px}.info-card p{display:flex;gap:12px;font-size:14px;line-height:26px;margin:0;overflow-wrap:anywhere}.info-card p>span:first-child{flex:none;color:var(--el-text-color-secondary)}.card-links,.row-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
@media(max-width:1100px){.cat-layout,.cat-layout.is-dual{grid-template-columns:1fr}.source-strip{align-items:flex-start;flex-direction:column}.workspace-toolbar .muted{width:100%}}
</style>
