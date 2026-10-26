<template>
  <section v-if="embedded" v-bind="$attrs" class="template-compatibility-embedded">
    <slot />
    <footer class="embedded-footer"><slot name="footer" /></footer>
  </section>
  <el-dialog v-else v-bind="$attrs"><slot /><template #footer><slot name="footer" /></template></el-dialog>
</template>
<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ embedded?: boolean }>()
</script>
<style scoped>
.embedded-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;border-top:1px solid var(--el-border-color-lighter);padding-top:16px;margin-top:16px}.embedded-footer :deep(.el-button){margin-left:0}
</style>
