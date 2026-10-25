<template><div><PageHead title="无访问权限" desc="当前模拟用户未获此页面授权，或用户、角色、权限已停用。"/><div class="panel"><p>请求页面：{{ route.query.from || '—' }}</p><p>请从侧栏选择有权访问的入口，或联系有授权管理权限的用户处理。</p><el-button v-if="store.previewUserId || store.simulationReturnId" @click="store.stopPermissionPreview()">退出权限预览／模拟</el-button></div></div></template>
<script setup lang="ts">
import {useRoute} from 'vue-router'
import PageHead from '../components/PageHead.vue'
import {useCatalogStore} from '../stores/catalog'
const route=useRoute(),store=useCatalogStore()
</script>
