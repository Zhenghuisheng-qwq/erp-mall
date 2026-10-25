<template>
  <div>
    <PageHead title="品牌中心" desc="新商品的品牌从这里选。已经保存的商品仍读取公共属性里的「品牌」，不会丢。">
      <el-button type="primary" @click="openCreate" :disabled="!(store.can('product:brand:create'))">新增品牌</el-button>
    </PageHead>
    <div class="panel">
      <el-table :data="store.data.brands">
        <el-table-column prop="name" label="品牌" />
        <el-table-column prop="logo" label="标识" />
        <el-table-column prop="description" label="说明" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-switch :model-value="row.status === 'enabled'" @change="row.status = $event ? 'enabled' : 'disabled'" :disabled="(!(store.can('product:brand:update'))) || !(store.can('product:brand:update'))" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="edit(row.id)" :disabled="!(store.can('product:brand:update'))">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="open" :title="editing.id ? '编辑品牌' : '新增品牌'" width="460px">
      <el-form label-width="72px">
        <el-form-item label="名称"><el-input v-model="editing.name"  :disabled="!(store.can('product:brand:update'))" /></el-form-item>
        <el-form-item label="标识"><el-input v-model="editing.logo" placeholder="图片地址，可空"  :disabled="!(store.can('product:brand:update'))" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="editing.description" type="textarea"  :disabled="!(store.can('product:brand:update'))" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="save" :disabled="!(store.can(editing.id ? 'product:brand:update' : 'product:brand:create'))">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const open = ref(false)
const editing = reactive({ id: '', name: '', logo: '', description: '' })

function openCreate() {
  if (!(store.can('product:brand:create'))) return
  Object.assign(editing, { id: '', name: '', logo: '', description: '' })
  open.value = true
}
function edit(id: string) {
  const row = store.data.brands.find((item) => item.id === id)
  if (!row) return
  Object.assign(editing, row)
  open.value = true
}
async function save() {
  if (!(store.can(editing.id ? 'product:brand:update' : 'product:brand:create'))) return
  const name = editing.name.trim()
  if (!name) return
  if (editing.id) {
    const row = store.data.brands.find((item) => item.id === editing.id)
    if (row) Object.assign(row, { name, logo: editing.logo.trim(), description: editing.description.trim() })
  } else {
    editing.id = uid('brand')
    store.data.brands.push({ id: editing.id, name, logo: editing.logo.trim(), description: editing.description.trim(), status: 'enabled' })
  }
  const param = store.data.params.find((item) => item.name === '品牌')
  if (param && !param.values.includes(name)) param.values.push(name)
  const saved = await store.flushPersistence()
  if (!saved.ok) { ElMessage.error(store.persistenceState.message || '品牌尚未保存，当前输入已保留。'); return }
  open.value = false
  ElMessage.success('品牌已保存。历史商品里的品牌文字不会被改写。')
}
</script>
