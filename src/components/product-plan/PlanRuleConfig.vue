<template>
  <section class="rule-config">
    <el-form-item label="命名规则">
      <el-input v-model="naming" :disabled="readonly" maxlength="80" placeholder="品牌 + 型号 + 容量 + 颜色" />
    </el-form-item>
    <el-form-item label="编码规则">
      <el-input v-model="coding" :disabled="readonly" maxlength="80" placeholder="自动编码" />
    </el-form-item>
    <p class="rule-note">只保存规则文案，不会自动拼名称或编码。</p>
  </section>
</template>

<script setup lang="ts">
const naming = defineModel<string>('descriptionRule', { required: true })
const coding = defineModel<string>('codeRule', { required: true })

defineProps<{ readonly: boolean }>()
</script>

<style scoped>
.rule-note { margin: -4px 0 8px 88px; color: #98a2b3; font-size: 12px; line-height: 1.5; }
</style>
