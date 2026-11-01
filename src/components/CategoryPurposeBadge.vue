<template><small v-if="categoryPurposeId(category)" class="category-purpose" :data-category-purpose="categoryId">{{categoryPurposeLabel(store.data,category)}}</small></template>
<script setup lang="ts">
import {computed} from 'vue'
import {useCatalogStore} from '../stores/catalog'
import {categoryPurposeId,categoryPurposeLabel} from '../domain/categoryPurposes'
const props=defineProps<{categoryId:string}>(),store=useCatalogStore(),category=computed(()=>store.data.categories.find(c=>c.id===props.categoryId))
</script>
<style scoped>.category-purpose{display:inline-block;flex:none;font-size:12px;font-weight:normal;margin:0 6px;padding:1px 5px;border-radius:4px;background:var(--el-color-primary-light-9);color:var(--el-color-primary);white-space:nowrap}</style>
