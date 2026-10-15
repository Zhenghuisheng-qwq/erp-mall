<template>
  <div class="guide">
    <p class="kicker">当前分类</p>
    <strong>{{ categoryPath || '未选择分类' }}</strong>
    <p v-if="typeName" class="type-line">产品类型：{{ typeName }}</p>
    <h2>该产品类型还没有商品模型</h2>
    <p class="quick">快速开始</p>
    <div class="actions">
      <el-button type="primary" :disabled="viewing" @click="emit('create')">创建空白模型</el-button>
      <el-button :disabled="viewing" @click="emit('copy')">复制已有模型</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  categoryPath: string
  typeName: string
  viewing: boolean
}>()

const emit = defineEmits<{
  create: []
  copy: []
}>()
</script>

<style scoped>
.guide { max-width: 420px; margin: 48px auto 0; padding: 8px 12px; }
.kicker, .quick { margin: 0; color: #8aa0b8; font-size: 12px; }
.type-line { margin: 8px 0 0; color: #66788a; font-size: 13px; }
.guide strong { display: block; margin-top: 4px; font-size: 16px; color: #1f2a37; }
.guide h2 { margin: 22px 0 0; font-size: 18px; font-weight: 650; color: #1f3b66; }
.quick { margin-top: 18px; }
.actions { display: flex; gap: 10px; margin-top: 10px; }
</style>
