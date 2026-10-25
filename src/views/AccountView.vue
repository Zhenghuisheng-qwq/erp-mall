<template>
  <div>
    <PageHead title="账号设置" desc="资料会留在本机。密码只做校验演示，不会保存。" />
    <div class="panel" style="max-width: 560px">
      <el-form label-width="100px">
        <el-form-item label="显示名"><el-input :disabled="!store.can('system:account:update')" v-model="store.data.profile.displayName" /></el-form-item>
        <el-form-item label="账号"><el-input :disabled="!store.can('system:account:update')" v-model="store.data.profile.username" /></el-form-item>
        <el-button type="primary" :disabled="!store.can('system:account:update')" @click="saveProfile">保存资料</el-button>
      </el-form>
    </div>
    <div class="panel" style="max-width: 560px">
      <h2>修改密码</h2>
      <el-form label-width="100px">
        <el-form-item label="新密码"><el-input v-model="password" type="password" show-password /></el-form-item>
        <el-form-item label="再输入一次"><el-input v-model="confirm" type="password" show-password /></el-form-item>
        <el-button @click="checkPassword">检查</el-button>
      </el-form>
      <p class="muted">演示环境不保存密码，也不会出现真实口令。</p>
    </div>
    <div class="panel">
      <h2>这套演示没有接上的能力</h2>
      <p class="muted">没有真实登录、生产数据库和后端事务接口。属性方案、必填、商品族都在浏览器里。规格限制由本地规则计算，不是线上 available-values。采购、库存、订单、财务没有做，也不放空菜单。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import { useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const password = ref('')
const confirm = ref('')
async function saveProfile() {
  const result = await store.flushPersistence()
  if (!result.ok) { ElMessage.error(store.persistenceState.message || '资料尚未保存，当前输入已保留。'); return }
  ElMessage.success('资料已保存在本机')
}
function checkPassword() {
  if (password.value.length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  if (password.value !== confirm.value) {
    ElMessage.warning('两次输入不一致')
    return
  }
  password.value = ''
  confirm.value = ''
  ElMessage.success('校验通过。密码没有保存。')
}
</script>
