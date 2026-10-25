<template>
  <el-drawer :model-value="guideUI.open" class="page-guide-drawer" title="本页指南" :size="drawerSize" append-to-body :close-on-click-modal="false" @update:model-value="!$event&&closeGuide()" @closed="closed">
    <template v-if="store.can('system:guide:read')">
      <RuleExplanation v-if="guideUI.failure" :failure="guideUI.failure" :show-rule="false" :supported-recovery="guideUI.failure.recovery" @recover="recoverFromGuide"/>
      <div class="guide-drawer-search"><el-input v-model="search" clearable placeholder="搜索本地指南" aria-label="搜索本页指南"/><el-button v-if="search||guideUI.articleId" @click="home">本页</el-button></div>
      <div v-if="search" class="guide-drawer-results"><button v-for="item in results.slice(0,20)" :key="item.id" @click="read(item.id)"><strong>{{item.title}}</strong><span>{{item.summary}}</span></button><el-empty v-if="!results.length" description="没有找到说明。可试试页面名、业务对象或失败现象。"><el-button @click="requestGuideFeedback({pageId:page?.id})">反馈缺少说明</el-button></el-empty></div>
      <GuideArticleReader v-else-if="currentId" :article-id="currentId" anchor-prefix="drawer" @open="read" @home="home"/>
      <el-empty v-else description="当前页面尚未关联手册"><el-button @click="requestGuideFeedback({pageId:page?.id})">反馈说明缺口</el-button></el-empty>
    </template><el-empty v-else description="当前身份没有业务指南阅读权限"/>
    <template #footer><div class="guide-drawer-footer"><router-link v-if="store.canRoute({path:'/guide'})" :to="{path:currentId?`/guide/articles/${currentId}`:'/guide',query:{returnTo:route.fullPath}}" target="_blank" rel="noopener">在新标签阅读</router-link><el-button @click="closeGuide">关闭指南</el-button></div></template>
  </el-drawer>
</template>
<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {useGuideStore} from '../../stores/guide'
import {useCatalogStore} from '../../stores/catalog'
import {guidePages} from '../../domain/guide/registry'
import {guidePageFor} from '../../domain/guide/routeMap'
import {searchGuide} from '../../domain/guide/search'
import {guideUI,closeGuide,recoverFromGuide,requestGuideFeedback} from '../../domain/guide/presentation'
import GuideArticleReader from './GuideArticleReader.vue'
import RuleExplanation from './RuleExplanation.vue'
const guide=useGuideStore(),store=useCatalogStore(),route=useRoute(),search=ref(''),width=ref(window.innerWidth)
const resize=()=>{width.value=window.innerWidth};onMounted(()=>window.addEventListener('resize',resize));onUnmounted(()=>window.removeEventListener('resize',resize))
const drawerSize=computed(()=>`${Math.min(Math.max(width.value*.44,320),680,width.value-12)}px`)
const page=computed(()=>guidePages.find(p=>p.id===guideUI.pageId)||guidePageFor(route.path,route.query,store.data))
const currentId=computed(()=>guide.article(guideUI.articleId)?.id||page.value?.articleId||'')
const results=computed(()=>searchGuide(guide.articles,search.value,page.value?.id))
function read(id:string){guideUI.articleId=id;search.value='';document.querySelector('.page-guide-drawer .el-drawer__body')?.scrollTo({top:0})}
function home(){guideUI.articleId='';search.value=''}
function closed(){search.value=''}
watch(()=>route.fullPath,()=>{if(guideUI.open)closeGuide()})
watch(()=>store.can('system:guide:read'),allowed=>{if(!allowed&&guideUI.open)closeGuide()})
</script>
<style>
.page-guide-drawer .el-drawer__body{padding:16px 22px;overscroll-behavior:contain}.page-guide-drawer .el-drawer__header{margin-bottom:12px}.page-guide-drawer .guide-article h1{font-size:22px}.guide-drawer-search{display:flex;gap:8px;margin:8px 0 18px}.guide-drawer-results button{display:block;width:100%;border:0;border-bottom:1px solid var(--el-border-color);background:none;text-align:left;padding:14px 0;color:var(--el-text-color-primary);cursor:pointer}.guide-drawer-results span{display:block;font-size:12px;line-height:1.5;color:var(--text-secondary);margin-top:6px}.guide-drawer-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:13px}.guide-drawer-footer a{color:var(--el-color-primary)}@media(max-width:600px){.page-guide-drawer .el-drawer__body{padding:12px 16px}}
</style>
