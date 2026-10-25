<template>
  <div class="guide-sections">
    <section v-for="section in sections" :key="section.id" :id="`${anchorPrefix}-${section.id}`" class="guide-section">
      <component :is="headingLevel">{{section.title}}</component>
      <p v-for="(text,index) in section.paragraphs" :key="`p${index}`">{{text}}</p>
      <ol v-if="section.steps?.length"><li v-for="(step,index) in section.steps" :key="index">{{step}}</li></ol>
      <div v-if="section.table" class="guide-table-scroll"><table><thead><tr><th v-for="(heading,index) in section.table.headers" :key="index">{{heading}}</th></tr></thead><tbody><tr v-for="(row,index) in section.table.rows" :key="index"><td v-for="(cell,column) in row" :key="column">{{cell}}</td></tr></tbody></table></div>
    </section>
  </div>
</template>
<script setup lang="ts">
import type {GuideSection} from '../../domain/guide/types'
withDefaults(defineProps<{sections:readonly GuideSection[];anchorPrefix?:string;headingLevel?:'h3'|'h4'}>(),{anchorPrefix:'guide',headingLevel:'h3'})
</script>
<style>
.guide-section{margin-top:18px;overflow-wrap:anywhere}.guide-section h3,.guide-section h4{font-size:14px;line-height:1.6;margin:0 0 8px}.guide-section p{margin:8px 0;line-height:1.8}.guide-section ol{padding-left:22px}.guide-section li{margin:6px 0;line-height:1.8}.guide-table-scroll{max-width:100%;overflow:auto}.guide-table-scroll table{border-collapse:collapse;min-width:330px;width:100%;font-size:13px}.guide-table-scroll th,.guide-table-scroll td{border:1px solid var(--el-border-color);padding:8px 10px;text-align:left;vertical-align:top}.guide-table-scroll th{background:var(--el-fill-color-light)}
</style>
