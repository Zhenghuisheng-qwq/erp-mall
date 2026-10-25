<template>
  <article v-if="article" class="guide-manual" :data-guide-article="article.id" :data-manual-page="manual?.page.id">
    <header class="guide-manual-heading"><h1>{{manual&&article.kind==='page'?manual.page.title:article.title}}</h1><p>{{article.summary}}</p><p v-if="article.status==='business-pending'" class="guide-caution">此项仍待业务确认，说明不构成新增业务限制。</p><p v-else-if="article.status==='historical'" class="guide-caution">这是保留的历史入口说明。</p></header>
    <section class="guide-manual-block" data-guide-block="functions"><h2>功能说明</h2><ArticleRenderer :sections="features" :anchor-prefix="`${anchorPrefix}-functions`"/><details v-for="action in actions" :key="action.id" class="guide-action"><summary>{{action.title}}</summary><p>{{action.summary}}</p><ArticleRenderer :sections="visibleSections(action.sections)" :anchor-prefix="`${anchorPrefix}-${action.id}`" heading-level="h4"/></details><p v-if="!features.length&&!actions.length" class="guide-muted">此页暂无额外操作说明。</p></section>
    <section class="guide-manual-block" data-guide-block="rules"><h2>使用规则</h2><ArticleRenderer :sections="manual?.restrictions||[]" :anchor-prefix="`${anchorPrefix}-restrictions`"/><details v-for="rule in rules" :key="rule.id" class="guide-rule" :open="article.kind==='rule'&&article.id===rule.id" :data-rule-id="rule.id"><summary>{{rule.title}}<span v-if="rule.status==='business-pending'" class="guide-caution"> · 待业务确认</span></summary><p>{{rule.summary}}</p><ArticleRenderer :sections="visibleSections(rule.sections)" :anchor-prefix="`${anchorPrefix}-${rule.id}`" heading-level="h4"/></details><p v-if="!manual?.restrictions.length&&!rules.length" class="guide-muted">本页暂无单独登记的使用规则；实际操作仍按现有校验执行。</p></section>
    <section class="guide-manual-block" data-guide-block="related"><h2>关联页面</h2><ul v-if="manual?.relatedPages.length" class="guide-related-pages"><li v-for="item in manual.relatedPages" :key="`${item.kind}-${item.pageId}`"><div><strong>{{item.page.title}}</strong><p>{{item.reason}}</p></div><div class="guide-related-actions"><button type="button" @click="$emit('open',item.page.articleId)">查看说明</button><router-link v-if="catalog.canRoute(item.to)" :to="item.to">前往页面</router-link><span v-else class="guide-muted">当前无页面访问权限</span></div></li></ul><p v-else class="guide-muted">暂未登记关联页面。</p></section>
  </article>
  <el-empty v-else description="未找到这份页面说明"><el-button @click="$emit('home')">查看说明目录</el-button></el-empty>
</template>
<script setup lang="ts">
import './guide.css'
import {computed} from 'vue'
import ArticleRenderer from './ArticleRenderer.vue'
import {useGuideStore} from '../../stores/guide'
import {useCatalogStore} from '../../stores/catalog'
import {pageManual} from '../../domain/guide/readModel'
import type {GuideSection} from '../../domain/guide/types'
const props=withDefaults(defineProps<{articleId?:string;pageId?:string;anchorPrefix?:string}>(),{articleId:'',pageId:'',anchorPrefix:'manual'})
defineEmits<{open:[id:string];home:[]}>()
const guide=useGuideStore(),catalog=useCatalogStore(),requested=computed(()=>props.articleId?guide.article(props.articleId):undefined)
const manual=computed(()=>pageManual(props.pageId||requested.value?.pageIds.find(id=>!!pageManual(id))||''))
const article=computed(()=>props.articleId?requested.value:manual.value?.article)
const visibleSections=(sections:readonly GuideSection[])=>sections.filter(section=>section.id!=='verification')
const features=computed(()=>article.value&&article.value.kind==='concept'?visibleSections(article.value.sections):manual.value?.features||(!manual.value&&article.value?.kind!=='rule'?visibleSections(article.value?.sections||[]):[]))
const actions=computed(()=>article.value?.kind==='action'?[article.value]:manual.value?.actions||[])
const rules=computed(()=>article.value?.kind==='rule'?[article.value]:manual.value?.rules||[])
</script>
<style>
.guide-manual{max-width:900px;margin:0 auto;min-width:0;overflow-wrap:anywhere}.guide-manual-heading h1{font-size:23px;line-height:1.45;margin:0 0 10px}.guide-manual-heading>p{color:var(--text-secondary);font-size:14px;line-height:1.7;margin:6px 0}.guide-manual-block{margin-top:26px;padding-top:20px;border-top:1px solid var(--el-border-color)}.guide-manual-block>h2{font-size:17px;margin:0 0 12px}.guide-action,.guide-rule{padding:12px 0;border-bottom:1px solid var(--el-border-color-lighter)}.guide-action>summary,.guide-rule>summary{cursor:pointer;line-height:1.6;font-weight:550}.guide-action>p,.guide-rule>p{font-size:13px;color:var(--text-secondary);line-height:1.7}.guide-caution{color:var(--el-color-warning)!important;font-size:12px}.guide-related-pages{list-style:none;padding:0;margin:0}.guide-related-pages li{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--el-border-color-lighter)}.guide-related-pages strong{font-weight:550}.guide-related-pages p{margin:5px 0;color:var(--text-secondary);font-size:13px;line-height:1.65}.guide-related-actions{display:flex;flex-wrap:wrap;align-content:center;align-items:center;gap:8px 14px;flex-shrink:0}.guide-related-actions button{padding:0;border:0;background:none;color:var(--el-color-primary);font:inherit;cursor:pointer;font-size:13px}.guide-related-actions a{font-size:13px;color:var(--el-color-primary)}@media(max-width:650px){.guide-related-pages li{display:block}.guide-related-actions{margin-top:8px}}
</style>
