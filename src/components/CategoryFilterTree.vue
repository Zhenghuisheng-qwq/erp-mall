<template>
  <div class="category-filter-tree" data-category-tree>
    <el-input v-model="keyword" placeholder="搜索分类" aria-label="搜索分类" clearable /><div class="tree-mode"><button type="button" :aria-pressed="multiple" @click="multiple=!multiple">{{ multiple ? '完成多选' : '多选' }}</button><small v-if="multiple">多选 · {{ selectedIds.length }} 项</small></div>
    <button type="button" class="tree-all" :aria-pressed="selectedIds.length === 0" :class="{ 'is-on': selectedIds.length === 0 }" @click="$emit('clear')">全部分类</button>
    <div ref="scroll" class="tree-scroll" data-category-scroll tabindex="0" aria-label="分类树滚动区域"><ul class="tree-list">
      <li v-for="row in rows" :key="row.id" :style="{ paddingLeft: `${8 + row.depth * 16}px` }" :class="{ 'is-on': selectedIds.includes(row.id), 'is-off': !row.enabled }">
        <button v-if="row.hasChildren" type="button" class="twist" :data-expand-id="row.id" :aria-label="`${row.expanded ? '折叠' : '展开'} ${row.name}`" :aria-expanded="row.expanded" @click.stop="toggleExpand(row.id)">{{ row.expanded ? '▼' : '▸' }}</button>
        <span v-else class="twist is-empty"></span>
        <input v-if="multiple" type="checkbox" :checked="selectedIds.includes(row.id)" :aria-label="`选择分类 ${categoryPathLabel(categories,row.id)}`" @change="emit('toggle',row.id,true)" /><button type="button" class="node" :data-category-id="row.id" :title="categoryPathLabel(categories,row.id)" :aria-pressed="selectedIds.includes(row.id)" @click="emit('toggle', row.id, multiple)">
          <template v-for="(part, index) in highlightParts(row.name, keyword)" :key="index">
            <mark v-if="part.hit">{{ part.text }}</mark>
            <template v-else>{{ part.text }}</template>
          </template>
        </button>
        <span v-if="selectedIds.includes(row.id)" class="mark">✓</span>
      </li>
    </ul>
    <p v-if="keyword.trim() && rows.length === 0" class="muted">没有匹配的分类。</p>
    </div>
    <div class="tree-actions">
      <button type="button" @click="$emit('clear')">清除分类</button>
      <button v-if="closable" type="button" @click="$emit('close')">收起分类面板</button>
    </div>
  </div>
</template>

<script lang="ts">
// UI-only state is bounded and scoped by page/view; never stored with categories.
const treeStates = new Map<string,{expanded:string[];closed:string[];top:number;left:number;multiple:boolean;selection:string}>()
</script>
<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { highlightParts, visibleCategoryRows, categoryChain, categoryPathLabel } from '../domain/categoryTree'
import type { Category } from '../domain/types'
const props = defineProps<{ categories: Category[]; selectedIds: string[]; closable?: boolean; stateKey?:string }>()
const emit=defineEmits<{ toggle: [id: string, multiple:boolean]; clear: []; close: [] }>()
const keyword=ref(''),expanded=ref(new Set<string>()),closed=ref(new Set<string>()),multiple=ref(false),scroll=ref<HTMLElement>()
const rows=computed(()=>visibleCategoryRows(props.categories,expanded.value,keyword.value,closed.value))
const selection=()=>JSON.stringify(props.selectedIds)
function remember(key=props.stateKey){if(!key)return;treeStates.set(key,{expanded:[...expanded.value],closed:[...closed.value],top:scroll.value?.scrollTop||0,left:scroll.value?.scrollLeft||0,multiple:multiple.value,selection:selection()});if(treeStates.size>40)treeStates.delete(treeStates.keys().next().value!)}
async function reveal(){for(const id of props.selectedIds)for(const parent of categoryChain(props.categories,id).slice(0,-1)){expanded.value.add(parent.id);closed.value.delete(parent.id)}await nextTick();const node=scroll.value?.querySelector<HTMLElement>(`[data-category-id="${CSS.escape(props.selectedIds[0]||'')}"]`);if(node&&scroll.value){const row=node.closest('li')!;const box=row.getBoundingClientRect(),viewport=scroll.value.getBoundingClientRect();if(box.top<viewport.top||box.bottom>viewport.bottom)scroll.value.scrollTop+=box.top-viewport.top-20}}
async function restore(){const previous=props.stateKey?treeStates.get(props.stateKey):undefined;expanded.value=new Set(previous?.expanded);closed.value=new Set(previous?.closed);multiple.value=props.selectedIds.length>1||!!previous?.multiple;if(previous?.selection===selection()){await nextTick();if(scroll.value){scroll.value.scrollTop=previous.top;scroll.value.scrollLeft=previous.left}}else await reveal()}
onMounted(restore)
watch(()=>props.stateKey,(_,old)=>{remember(old);void restore()})
watch(selection,()=>{if(props.selectedIds.length>1)multiple.value=true;void reveal()})
onBeforeUnmount(()=>remember())
function toggleExpand(id:string){if(closed.value.has(id)){closed.value.delete(id);expanded.value.add(id)}else if(expanded.value.has(id)){expanded.value.delete(id);closed.value.add(id)}else expanded.value.add(id)}
</script>

<style scoped>
.category-filter-tree { display: flex; flex-direction: column; gap: 8px; min-width: 0; width:100%; min-height:0; }
.category-filter-tree > :not(.tree-scroll) { flex-shrink:0; }
.tree-scroll { overflow:auto; min-height:72px; max-height:min(58vh,640px); overscroll-behavior:contain; }
.tree-list { list-style: none; margin: 0; padding: 0; width:max-content; min-width:100%; }
.tree-list li { display: flex; align-items: center; gap: 4px; min-height: 30px; border-radius: 4px; padding-right:8px; box-sizing:border-box; }
.tree-list li.is-on { background: color-mix(in srgb, var(--el-color-primary) 14%, transparent); }
.tree-list li.is-off { opacity: 0.55; }
.twist, .node, .tree-all, .tree-actions button { border: 0; background: transparent; color: inherit; cursor: pointer; }
.twist { width: 18px; padding: 0; flex:none; }
.twist.is-empty { cursor: default; }
.node { flex: 1; white-space: nowrap; text-align: left; padding: 4px 0; }
.mark { flex: none; color: var(--el-color-primary); font-size: 12px; font-weight: 700; }
mark { background: color-mix(in srgb, var(--el-color-primary) 28%, transparent); color: inherit; padding: 0 1px; border-radius: 2px; }
.tree-all.is-on { font-weight: 650; color: var(--el-color-primary); }
.tree-mode {display:flex;align-items:center;justify-content:space-between}.tree-mode button{border:0;background:none;color:var(--el-color-primary);cursor:pointer}.tree-mode small{color:var(--el-text-color-secondary)}
.tree-actions { display: flex; justify-content: space-between; gap: 8px; }
.muted { color: var(--text-secondary, #607089); font-size: 13px; }
</style>
<style>:root { --product-category-width:240px; }</style>
