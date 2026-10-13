<template>
  <div>
    <PageHead title="反馈管理" desc="演示提交和处理状态，不发送到任何服务器。">
      <el-button type="primary" @click="open = true">提交反馈</el-button>
    </PageHead>
    <div class="panel">
      <el-table :data="store.data.feedbacks">
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="page" label="所在页面" width="120" />
        <el-table-column label="状态" width="140">
          <template #default="{ row }">
            <el-select v-model="row.status" size="small">
              <el-option label="待处理" value="open" />
              <el-option label="处理中" value="doing" />
              <el-option label="已完成" value="done" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button link type="danger" @click="store.data.feedbacks = store.data.feedbacks.filter((item) => item.id !== row.id)">删除</el-button></template>
        </el-table-column>
      </el-table>
    </div>
    <el-dialog v-model="open" title="提交反馈" width="480px">
      <el-input v-model="title" placeholder="标题" style="margin-bottom: 8px" />
      <el-input v-model="content" type="textarea" placeholder="具体哪里不顺手" />
      <template #footer>
        <el-button @click="open = false">取消</el-button>
        <el-button type="primary" @click="submit">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import PageHead from '../components/PageHead.vue'
import { uid, useCatalogStore } from '../stores/catalog'

const store = useCatalogStore()
const open = ref(false)
const title = ref('')
const content = ref('')
function submit() {
  if (!title.value.trim() || !content.value.trim()) return
  store.data.feedbacks.unshift({ id: uid('fb'), title: title.value.trim(), content: content.value.trim(), status: 'open', page: '反馈', createdAt: new Date().toISOString() })
  title.value = ''
  content.value = ''
  open.value = false
  ElMessage.success('已记在本机演示数据里')
}
</script>
