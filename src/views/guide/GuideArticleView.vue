<template><div class="guide-page guide-detail-page"><nav class="guide-detail-toolbar"><router-link to="/guide">业务指南</router-link><router-link :to="returnTo">返回业务</router-link><router-link v-if="catalog.can('system:guide:update')&&article" :to="{path:'/guide/manage',query:{article:article.id}}">维护本篇</router-link></nav><section class="panel"><GuideArticleReader :article-id="articleId" anchor-prefix="full-guide" @open="open" @home="router.push('/guide')"/></section></div></template>
<script setup lang="ts">
import '../../components/guide/guide.css'
import {computed} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useGuideStore} from '../../stores/guide'
import {useCatalogStore} from '../../stores/catalog'
import {safeGuideReturn} from '../../domain/guide/routeMap'
import GuideArticleReader from '../../components/guide/GuideArticleReader.vue'
const route=useRoute(),router=useRouter(),guide=useGuideStore(),catalog=useCatalogStore(),articleId=computed(()=>String(route.params.articleId||'')),article=computed(()=>guide.article(articleId.value)),returnTo=computed(()=>safeGuideReturn(route.query.returnTo,catalog.canRoute))
function open(id:string){void router.push({path:`/guide/articles/${id}`,query:route.query.returnTo?{returnTo:String(route.query.returnTo)}:{}})}
</script>
<style>.guide-detail-page{max-width:1100px}.guide-detail-toolbar{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;font-size:13px}.guide-detail-toolbar a{color:var(--el-color-primary)}.guide-detail-page>.panel{padding:28px 36px}@media(max-width:700px){.guide-detail-page>.panel{padding:18px}}</style>
