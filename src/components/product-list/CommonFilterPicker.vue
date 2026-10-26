<template>
  <el-popover v-model:visible="open" trigger="click" placement="bottom-start" :width="300">
    <template #reference><el-button link type="primary" :disabled="busy" data-add-common-filter>＋常用筛选</el-button></template>
    <el-input v-model="search" clearable placeholder="搜索字段" aria-label="搜索常用筛选字段" />
    <div class="picker-options" role="group" aria-label="可固定筛选字段">
      <section v-for="group in groups" :key="group.name"><small>{{group.name}}</small><button v-for="item in group.items" :key="item.id" type="button" :data-pin-field="item.id" :disabled="busy || item.pinned" @click="emit('add',item.id)"><span>{{item.label}}</span><span>{{item.pinned?'✓ 已固定':'＋ 固定'}}</span></button></section>
      <p v-if="!groups.length">没有匹配字段</p>
    </div>
  </el-popover>
</template>
<script setup lang="ts">
import {computed,ref} from 'vue'
const props=defineProps<{items:{id:string;label:string;group:string;pinned:boolean}[];busy?:boolean}>()
const emit=defineEmits<{add:[id:string]}>()
const open=ref(false),search=ref('')
const groups=computed(()=>{const found=props.items.filter(item=>`${item.label} ${item.group}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));return [...new Set(found.map(item=>item.group))].map(name=>({name,items:found.filter(item=>item.group===name)}))})
</script>
<style scoped>
.picker-options{max-height:320px;overflow:auto;margin-top:10px}.picker-options small{display:block;color:var(--el-text-color-secondary);margin:10px 0 4px}.picker-options button{display:flex;justify-content:space-between;gap:8px;text-align:left;width:100%;padding:8px;border:0;background:none;color:var(--el-text-color-primary);cursor:pointer}.picker-options button:hover{background:var(--el-fill-color-light)}.picker-options button:disabled{color:var(--el-text-color-secondary);cursor:default}.picker-options button span:first-child{overflow-wrap:anywhere}.picker-options button span:last-child{white-space:nowrap;color:var(--el-color-primary)}
</style>
