<template>
  <article class="guide-article" :data-guide-article="article.id">
    <header><div class="guide-meta"><el-tag size="small" :type="article.status==='verified'?'success':'info'">{{statusText[article.status]}}</el-tag><span>{{kindText[article.kind]}} · 修订 {{article.revision}}</span></div><h1>{{article.title}}</h1><p class="guide-summary">{{article.summary}}</p></header>
    <nav v-if="article.sections.length>1" class="guide-toc" aria-label="文章目录"><strong>本篇目录</strong><button v-for="section in article.sections" :key="section.id" @click="locate(section.id)">{{section.title}}</button></nav>
    <section v-for="section in article.sections" :id="`${anchorPrefix}-${section.id}`" :key="section.id" class="guide-section" tabindex="-1">
      <h2>{{section.title}}</h2><p v-for="(text,i) in section.paragraphs" :key="`p${i}`">{{text}}</p><ol v-if="section.steps?.length"><li v-for="(step,i) in section.steps" :key="i">{{step}}</li></ol>
      <div v-if="section.table" class="guide-table-scroll"><table><thead><tr><th v-for="(heading,i) in section.table.headers" :key="i">{{heading}}</th></tr></thead><tbody><tr v-for="(row,i) in section.table.rows" :key="i"><td v-for="(cell,j) in row" :key="j">{{cell}}</td></tr></tbody></table></div>
    </section>
    <details v-if="maintenance" class="guide-evidence"><summary>内容核验依据</summary><p>适用实现：{{article.implementation || '待核对'}}</p><ul><li v-for="(item,i) in article.evidence" :key="i">{{item}}</li></ul></details>
  </article>
</template>
<script setup lang="ts">
import type {GuideArticle} from '../../domain/guide/types'
const props=withDefaults(defineProps<{article:GuideArticle;anchorPrefix?:string;maintenance?:boolean}>(),{anchorPrefix:'guide',maintenance:false})
const statusText={verified:'已核验',review:'待核验','business-pending':'待业务确认',historical:'历史入口说明'}
const kindText={page:'页面手册',action:'操作说明',rule:'业务规则',concept:'业务概念',troubleshooting:'问题排查'}
function locate(id:string){const target=document.getElementById(`${props.anchorPrefix}-${id}`);target?.scrollIntoView({behavior:'smooth',block:'start'});target?.focus({preventScroll:true})}
</script>
<style>
.guide-article{min-width:0;max-width:860px;margin:0 auto;line-height:1.8;overflow-wrap:anywhere}.guide-article h1{font-size:25px;line-height:1.4;margin:12px 0}.guide-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;color:var(--text-secondary);font-size:12px}.guide-summary{color:var(--text-secondary);font-size:15px}.guide-section{scroll-margin-top:24px;margin-top:28px;outline:none}.guide-section:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:4px}.guide-section h2{font-size:18px;line-height:1.5;margin-bottom:10px}.guide-section p{margin:10px 0}.guide-section li{padding-left:3px;margin:6px 0}.guide-toc{border-left:3px solid var(--el-color-primary-light-5);background:var(--el-fill-color-light);padding:12px 16px;margin-top:20px}.guide-toc strong{display:block;font-size:13px}.guide-toc button{display:block;border:0;background:none;color:var(--el-color-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer;padding:3px 0}.guide-table-scroll{max-width:100%;overflow:auto}.guide-table-scroll table{border-collapse:collapse;min-width:360px;width:100%;font-size:13px}.guide-table-scroll th,.guide-table-scroll td{border:1px solid var(--el-border-color);padding:9px 12px;text-align:left;vertical-align:top}.guide-table-scroll th{background:var(--el-fill-color-light)}.guide-evidence{margin-top:28px;color:var(--text-secondary);font-size:12px}.guide-evidence summary{cursor:pointer}.guide-article button:focus-visible{outline:2px solid var(--el-color-primary)}
</style>
