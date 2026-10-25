<template><div><PageHead title="无访问权限" :desc="store.rbacEnforced?'当前模拟用户未获此页面授权，或用户、角色、权限已停用。':'当前为统一管理员模式；未知地址仍不能作为正式页面打开。'"/><div class="panel"><p>请从侧栏选择有权访问的入口，或联系有授权管理权限的用户处理。</p><RuleExplanation v-if="guideRouteFailure" :failure="guideRouteFailure"/><el-button v-if="store.previewUserId || store.simulationReturnId" @click="store.stopPermissionPreview()">退出权限预览／模拟</el-button></div></div></template>
<script setup lang="ts">
import RuleExplanation from '../components/guide/RuleExplanation.vue'
import {guideRouteFailure} from '../domain/guide/routeFailure'
import PageHead from '../components/PageHead.vue'
import {useCatalogStore} from '../stores/catalog'
const store=useCatalogStore()
</script>
