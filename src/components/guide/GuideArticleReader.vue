<template>
  <el-alert v-if="guide.contentError" :title="guide.contentError" type="warning" :closable="false"/>
  <template v-if="article">
    <div class="guide-reader-actions"><el-button size="small" :aria-pressed="favorite" @click="act(()=>guide.favorite(article!.id))">{{favorite?'已收藏':'收藏'}}</el-button><el-button size="small" :aria-pressed="!!readRevision" @click="act(()=>guide.mark(article!.id,'read',!readRevision))">{{readRevision?'已阅读':'标记已阅读'}}</el-button><el-button size="small" :aria-pressed="!!practiceRevision" @click="act(()=>guide.mark(article!.id,'practiced',!practiceRevision))">{{practiceRevision?'已练习':'标记已练习'}}</el-button><el-button size="small" :disabled="!store.can('system:feedback:create')" :title="store.can('system:feedback:create') ? '' : '需要反馈新增权限'" @click="feedback">反馈本篇</el-button></div>
    <p v-if="readRevision&&readRevision<article.revision || practiceRevision&&practiceRevision<article.revision" class="guide-update">内容已有更新，保留原学习记录；可复习后重新标记。<el-button link @click="act(()=>guide.mark(article!.id,'read'))">更新阅读记录</el-button></p>
    <el-alert v-if="error || guide.progressError" :title="error||guide.progressError" type="warning" :closable="false"/>
    <ArticleRenderer :article="article" :anchor-prefix="anchorPrefix" :maintenance="store.can('system:guide:update')"/>
    <nav class="guide-related" aria-label="相关内容"><strong>相关内容</strong><button v-for="item in related" :key="item.id" @click="$emit('open',item.id)">{{item.title}}</button><p v-if="!related.length">本篇暂无关联条目。</p></nav>
    <div class="guide-prev-next"><el-button v-if="previous" @click="$emit('open',previous.id)">上一条：{{previous.title}}</el-button><el-button v-if="next" @click="$emit('open',next.id)">下一条：{{next.title}}</el-button></div>
  </template><el-empty v-else description="这篇文章不存在或已不可用"><el-button @click="$emit('home')">返回指南首页</el-button></el-empty>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import ArticleRenderer from './ArticleRenderer.vue'
import {useGuideStore} from '../../stores/guide'
import {useCatalogStore} from '../../stores/catalog'
import {requestGuideFeedback} from '../../domain/guide/presentation'
const props=withDefaults(defineProps<{articleId:string;anchorPrefix?:string}>(),{anchorPrefix:'reader'})
defineEmits<{open:[id:string];home:[]}>()
const guide=useGuideStore(),store=useCatalogStore(),error=ref('')
const article=computed(()=>guide.article(props.articleId)),favorite=computed(()=>guide.progress.favorites.includes(props.articleId)),readRevision=computed(()=>guide.progress.read[props.articleId]),practiceRevision=computed(()=>guide.progress.practiced[props.articleId])
const related=computed(()=>[...new Set([...(article.value?.related||[]),...(article.value?.actionIds||[]),...(article.value?.ruleIds||[])])].map(id=>guide.article(id)).filter((a):a is NonNullable<typeof a>=>!!a&&a.id!==props.articleId))
const index=computed(()=>guide.articles.findIndex(a=>a.id===props.articleId)),previous=computed(()=>index.value>0?guide.articles[index.value-1]:undefined),next=computed(()=>index.value>=0?guide.articles[index.value+1]:undefined)
async function act(action:()=>Promise<{ok:boolean;message?:string}>){try{const r=await action();error.value=r.ok?'':r.message||'个人记录未保存。'}catch(e){error.value=String(e)}}
function feedback(){if(article.value)requestGuideFeedback({articleId:article.value.id,pageId:article.value.pageIds[0],ruleId:article.value.kind==='rule'?article.value.id:undefined,actionId:article.value.kind==='action'?article.value.id:undefined,contentRevision:article.value.revision})}
watch(()=>props.articleId,()=>{error.value='';if(article.value)void act(()=>guide.remember(props.articleId))},{immediate:true})
</script>
<style>
.guide-reader-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}.guide-reader-actions .el-button+.el-button{margin-left:0}.guide-update{font-size:13px;color:var(--el-color-warning)}.guide-related{margin-top:30px;padding-top:18px;border-top:1px solid var(--el-border-color)}.guide-related strong{display:block}.guide-related button{display:block;max-width:100%;background:none;border:0;color:var(--el-color-primary);text-align:left;cursor:pointer;padding:6px 0;overflow-wrap:anywhere}.guide-prev-next{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:18px}.guide-prev-next .el-button{white-space:normal;height:auto;min-height:32px;max-width:100%;margin:0}
</style>
