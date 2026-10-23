<template>
  <div class="integer-input" :class="{ invalid: !valid }">
    <el-button v-if="controls" :disabled="disabled || !valid || modelValue <= minimum" :aria-label="`减少${label}`" @click="emit('update:modelValue', modelValue - 1)">−</el-button>
    <el-input :model-value="text" :disabled="disabled" inputmode="numeric" :aria-label="label" :aria-invalid="!valid" @update:model-value="input" />
    <el-button v-if="controls" :disabled="disabled || !valid || modelValue >= Number.MAX_SAFE_INTEGER" :aria-label="`增加${label}`" @click="emit('update:modelValue', modelValue + 1)">＋</el-button>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props = withDefaults(defineProps<{ modelValue: number; label: string; disabled?: boolean; zeroAllowed?: boolean; controls?: boolean }>(), { controls: false })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const text = ref(Number.isNaN(props.modelValue) ? '' : String(props.modelValue))
const minimum = computed(() => props.zeroAllowed ? 0 : 1)
const valid = computed(() => Number.isSafeInteger(props.modelValue) && props.modelValue >= minimum.value)
watch(() => props.modelValue, value => { if (!Object.is(text.value.trim() ? Number(text.value) : NaN, value)) text.value = Number.isNaN(value) ? '' : String(value) })
function input(value: string | number) { text.value = String(value); emit('update:modelValue', text.value.trim() ? Number(text.value) : NaN) }
</script>
<style scoped>
.integer-input { display:flex; gap:0; align-items:center; min-width:96px; }.integer-input>.el-button { margin:0; border-radius:0; padding:8px; min-width:30px; }.integer-input>.el-button:first-child { border-radius:5px 0 0 5px; }.integer-input>.el-button:last-child { border-radius:0 5px 5px 0; }.integer-input:deep(input) { text-align:center; min-width:36px; }.invalid:deep(.el-input__wrapper) { box-shadow:0 0 0 1px var(--el-color-danger) inset; }
</style>
