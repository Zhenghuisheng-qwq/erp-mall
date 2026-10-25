<template>
  <el-drawer :model-value="guideUI.open" class="page-guide-drawer" title="页面功能" :size="drawerSize" append-to-body :close-on-click-modal="false" @update:model-value="!$event&&closeGuide()">
    <template v-if="catalog.can('system:guide:read')">
      <RuleExplanation v-if="guideUI.failure" :failure="guideUI.failure" :show-rule="false" :supported-recovery="guideUI.failure.recovery" @recover="recoverFromGuide"/>
      <el-button v-if="guideUI.articleId&&currentId!==currentPage?.articleId" size="small" class="guide-return-page" @click="home">返回当前页面说明</el-button>
      <GuideArticleReader v-if="currentId" :article-id="currentId" :page-id="page?.id" anchor-prefix="guide-drawer" @open="read" @home="home"/>
      <el-empty v-else description="当前页面尚未关联说明"/>
    </template><el-empty v-else description="当前身份没有页面说明阅读权限"/>
    <template #footer><div class="guide-drawer-footer"><router-link v-if="catalog.canRoute({path:'/guide'})" :to="{path:currentId?`/guide/articles/${encodeURIComponent(currentId)}`:'/guide',query:{returnTo:route.fullPath}}" target="_blank" rel="noopener">在新标签查看说明</router-link><el-button @click="closeGuide">关闭说明</el-button></div></template>
  </el-drawer>
</template>
<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {useGuideStore} from '../../stores/guide'
import {useCatalogStore} from '../../stores/catalog'
import {guidePages} from '../../domain/guide/registry'
import {guidePageFor} from '../../domain/guide/routeMap'
import {guideUI,closeGuide,recoverFromGuide} from '../../domain/guide/presentation'
import GuideArticleReader from './GuideArticleReader.vue'
import RuleExplanation from './RuleExplanation.vue'
const guide=useGuideStore(),catalog=useCatalogStore(),route=useRoute(),width=ref(window.innerWidth)
const resize=()=>{width.value=window.innerWidth}
onMounted(()=>window.addEventListener('resize',resize))
onUnmounted(()=>{window.removeEventListener('resize',resize);if(guideUI.open)closeGuide()})
const drawerSize=computed(()=>`${Math.min(Math.max(width.value*.44,320),680,width.value-12)}px`)
const currentPage=computed(()=>guidePageFor(route.path,route.query,catalog.data))
const page=computed(()=>guidePages.find(item=>item.id===guideUI.pageId)||currentPage.value)
const currentId=computed(()=>guide.article(guideUI.articleId)?.id||page.value?.articleId||'')
function read(id:string){guideUI.articleId=id;guideUI.pageId=guide.article(id)?.pageIds.find(pageId=>guidePages.some(page=>page.id===pageId))||'';document.querySelector('.page-guide-drawer .el-drawer__body')?.scrollTo({top:0})}
function home(){guideUI.articleId='';guideUI.pageId=currentPage.value?.id||''}
watch(()=>route.fullPath,()=>{if(guideUI.open)closeGuide()})
watch(()=>catalog.can('system:guide:read'),allowed=>{if(!allowed&&guideUI.open)closeGuide()})
</script>
<style>
.page-guide-drawer .el-drawer__body{padding:16px 22px;overscroll-behavior:contain}.page-guide-drawer .el-drawer__header{margin-bottom:12px}.page-guide-drawer .guide-manual-heading h1{font-size:21px}.guide-return-page{margin-bottom:16px}.guide-drawer-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:13px}.guide-drawer-footer a{color:var(--el-color-primary)}@media(max-width:600px){.page-guide-drawer .el-drawer__body{padding:12px 16px}}
</style>
