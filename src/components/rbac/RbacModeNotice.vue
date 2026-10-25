<template>
  <el-alert v-if="!store.rbacEnforced" title="当前为统一超级管理员模式，RBAC 权限校验尚未启用；角色与授权配置会保留。" type="info" :closable="false" show-icon class="rbac-mode-notice" data-rbac-mode-notice />
</template>
<script setup lang="ts">
import { useCatalogStore } from '../../stores/catalog'
const store = useCatalogStore()
</script>
<style scoped>
.rbac-mode-notice { margin-bottom: 14px; }
</style>
