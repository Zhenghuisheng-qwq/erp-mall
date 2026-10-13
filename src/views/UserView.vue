<template>
  <div>
    <PageHead title="用户管理" desc="只演示角色和菜单可见性，没有真实登录。">
      <el-button type="primary" @click="open()">新增用户</el-button>
    </PageHead>
    <div class="panel">
      <el-table :data="store.data.users">
        <el-table-column prop="displayName" label="姓名" />
        <el-table-column prop="username" label="账号" />
        <el-table-column label="角色" width="120">
          <template #default="{ row }">{{ row.role === 'admin' ? '管理员' : '运营' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="primary" @click="open(row.id)">编辑</el-button>
            <el-button link @click="store.setRole(row.role)">用这个身份看看菜单</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="visible" title="用户" width="420px">
      <el-form label-width="80px">
        <el-form-item label="姓名"><el-input v-model="form.displayName" /></el-form-item>
        <el-form-item label="账号"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="运营" value="operator" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import type { UserRole } from '../domain/types'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const visible = ref(false)
const editing = ref('')
const form = reactive({ displayName: '', username: '', role: 'operator' as UserRole })
function open(id = '') {
  editing.value = id
  const user = store.data.users.find((item) => item.id === id)
  form.displayName = user?.displayName || ''
  form.username = user?.username || ''
  form.role = user?.role || 'operator'
  visible.value = true
}
function save() {
  if (!form.displayName.trim() || !form.username.trim()) return
  if (editing.value) {
    const user = store.data.users.find((item) => item.id === editing.value)
    if (user) Object.assign(user, form)
  } else {
    store.data.users.push({ id: uid('user'), ...form, enabled: true })
  }
  visible.value = false
}
</script>
