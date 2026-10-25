<template>
  <article v-if="article" class="guide-manual" :data-guide-article="article.id" :data-manual-page="manual?.page.id">
    <header class="guide-manual-heading">
      <h1>{{isPage?manual?.page.title:article.title}}</h1>
      <p class="guide-purpose">{{isPage?manual?.purpose:article.summary}}</p>
      <p v-if="article.status==='business-pending'" class="guide-caution">此项仍待业务确认，说明不构成新增业务限制。</p>
      <p v-else-if="article.status==='historical'||isPage&&manual?.page.historical" class="guide-caution">这是保留的历史入口说明。</p>
    </header>
    <section v-if="isPage||legacyFunctions.length" class="guide-manual-block" data-guide-block="functions">
      <h2>功能说明</h2>
      <GuideFeatureTable v-if="isPage&&manual" :rows="manual.featureRows"/>
      <ArticleRenderer v-else :sections="legacyFunctions" :anchor-prefix="`${anchorPrefix}-functions`"/>
      <details v-for="detail in isPage?manual?.details||[]:[]" :key="detail.id" class="guide-operation-detail" :data-guide-detail="detail.id">
        <summary>{{detail.title}}</summary><ArticleRenderer :sections="detail.sections" :anchor-prefix="`${anchorPrefix}-${detail.id}`"/>
      </details>
    </section>
    <section v-if="isPage||legacyRestrictions.length" class="guide-manual-block" data-guide-block="rules">
      <h2>规则限制</h2>
      <div v-if="isPage&&manual?.restrictionRows.length" class="guide-table-scroll guide-restriction-table">
        <table aria-label="规则与失败处理"><colgroup><col style="width:25%"/><col style="width:37%"/><col style="width:38%"/></colgroup>
          <thead><tr><th scope="col">什么情况</th><th scope="col">会怎样／为什么</th><th scope="col">应该怎么处理</th></tr></thead>
          <tbody><tr v-for="row in manual.restrictionRows" :key="row.id" :data-guide-restriction="row.id" :class="{'is-warning':row.warning}"><th scope="row" data-label="什么情况">{{row.condition}}</th><td data-label="会怎样／为什么">{{row.effect}}</td><td data-label="应该怎么处理">{{row.resolution}}</td></tr></tbody>
        </table>
      </div>
      <ArticleRenderer v-if="!isPage" :sections="legacyRestrictions" :anchor-prefix="`${anchorPrefix}-rules`"/>
      <p v-for="rule in pendingRules" :key="rule.id" class="guide-caution" :data-rule-id="rule.id">待业务确认：{{rule.summary}}</p>
      <p v-if="isPage&&!manual?.restrictionRows.length&&!pendingRules.length" class="guide-muted">此页仅展示信息，不提交业务变更。</p>
    </section>
    <section class="guide-manual-block" data-guide-block="related"><h2>关联页面</h2>
      <ul v-if="manual?.relatedPages.length" class="guide-related-pages"><li v-for="item in manual.relatedPages" :key="`${item.kind}-${item.pageId}`">
        <div><strong>{{item.page.title}}</strong><span class="guide-relation-kind">{{relationText[item.kind]}}</span><p>{{item.reason}}</p></div>
        <div class="guide-related-actions"><button type="button" @click="$emit('open',item.page.articleId)">查看说明</button><router-link v-if="catalog.canRoute(item.to)" :to="item.to">{{item.entryLabel}}</router-link><span v-else class="guide-muted">当前无页面访问权限</span></div>
      </li></ul><p v-else class="guide-muted">暂未登记关联页面。</p>
    </section>
  </article>
  <el-empty v-else description="未找到这份页面说明"><el-button @click="$emit('home')">查看说明目录</el-button></el-empty>
</template>
<script setup lang="ts">
import './guide.css'
import {computed} from 'vue'
import ArticleRenderer from './ArticleRenderer.vue'
import GuideFeatureTable from './GuideFeatureTable.vue'
import {useGuideStore} from '../../stores/guide'
import {useCatalogStore} from '../../stores/catalog'
import {pageManual} from '../../domain/guide/readModel'
const props=withDefaults(defineProps<{articleId?:string;pageId?:string;anchorPrefix?:string}>(),{articleId:'',pageId:'',anchorPrefix:'manual'})
defineEmits<{open:[id:string];home:[]}>()
const relationText={upstream:'前置依赖',downstream:'后续影响',related:'配套页面'}
const guide=useGuideStore(),catalog=useCatalogStore(),requested=computed(()=>props.articleId?guide.article(props.articleId):undefined)
const manual=computed(()=>pageManual(props.pageId||requested.value?.pageIds.find(id=>!!pageManual(id))||''))
const article=computed(()=>props.articleId?requested.value:manual.value?.article),isPage=computed(()=>article.value?.kind==='page')
// These four existing articles contain additional outcome facts beyond their summary
// (for example, skipped no-op moves and identity preservation). Keep those facts at
// the standalone action URL without re-expanding every action on the page manual.
const actionsWithResultDetails=['action-category-rename','action-category-move','action-guide-search','action-guide-read']
// Standalone action/rule links remain valid. Pages use only their authored tables;
// they never concatenate every summary, step, result and rule into a second body.
const legacyFunctions=computed(()=>{
  if(!article.value||isPage.value||article.value.kind==='rule')return []
  const ids=article.value.kind==='action'?['steps',...(actionsWithResultDetails.includes(article.value.id)?['results']:[])]:undefined
  return article.value.sections.filter(section=>section.id!=='verification'&&(!ids||ids.includes(section.id)))
})
const legacyRestrictions=computed(()=>{
  if(!article.value||isPage.value)return []
  const ids=article.value.kind==='rule'?['conditions','examples','next']:article.value.kind==='action'?['prerequisites','rules','failures']:[]
  return article.value.sections.filter(section=>ids.includes(section.id))
})
const pendingRules=computed(()=>isPage.value?manual.value?.rules.filter(rule=>rule.status==='business-pending'&&!manual.value?.restrictionRows.some(row=>row.ruleIds?.includes(rule.id)))||[]:[])
</script>
