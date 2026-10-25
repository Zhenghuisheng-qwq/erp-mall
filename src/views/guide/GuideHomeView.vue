<template>
  <div class="guide-page">
    <PageHead title="业务指南" desc="查询真实页面、业务规则与操作流程。阅读和练习记录分别由你确认。"><router-link v-if="catalog.can('system:guide:update')" to="/guide/manage"><el-button>内容维护</el-button></router-link></PageHead>
    <el-alert v-if="guide.contentError" :title="guide.contentError" type="warning" :closable="false"/>
    <section class="panel guide-home-search"><el-input v-model="search" clearable placeholder="搜索页面、操作、术语或失败现象" aria-label="搜索业务指南"/><span class="guide-muted">本地确定性搜索，不上传业务数据</span></section>
    <el-tabs v-model="tab" @tab-change="changeTab"><el-tab-pane name="home" label="学习首页"/><el-tab-pane name="learn" label="新人学习"/><el-tab-pane name="page" label="页面手册"/><el-tab-pane name="rule" label="业务规则"/><el-tab-pane name="troubleshooting" label="问题排查"/><el-tab-pane name="personal" label="我的记录"/></el-tabs>
    <section v-if="search" class="panel"><h2>搜索结果 · {{results.length}}</h2><div class="guide-item-list"><router-link v-for="item in results" :key="item.id" :to="articleLink(item.id)"><span class="guide-kind">{{kindText[item.kind]}}</span><strong>{{item.title}}</strong><p>{{item.summary}}</p></router-link></div><el-empty v-if="!results.length" description="没有找到相关说明"><p>试试「分类移动」「物料」「保存失败」等页面名或现象。</p><el-button @click="requestGuideFeedback()">反馈缺少说明</el-button></el-empty></section>
    <template v-else-if="tab==='home'">
      <section class="panel"><h2>先认识业务对象</h2><p class="guide-muted">分类、类型、模型、PLN、MAT、SPU、SKU各有身份与边界，不必强行串成单一路径。</p><div class="guide-item-list guide-concepts"><router-link v-for="item in concepts" :key="item.id" :to="articleLink(item.id)"><strong>{{item.title}}</strong><p>{{item.summary}}</p></router-link></div></section>
      <section v-if="recent.length" class="panel"><h2>继续阅读</h2><div class="guide-item-list"><router-link v-for="item in recent.slice(0,4)" :key="item.id" :to="articleLink(item.id)">{{item.title}}<small v-if="isUpdated(item.id)"> · 内容有更新</small></router-link></div></section>
      <section class="panel"><h2>推荐学习顺序</h2><div class="guide-flow-grid"><router-link v-for="(flow,index) in guideFlows" :key="flow.id" :to="flowLink(flow.id)"><span class="guide-flow-number">{{String(index+1).padStart(2,'0')}}</span><div><strong>{{flow.title}}</strong><p>{{flow.goal}}</p><small>{{flow.steps.length}} 步 · 已读 {{flowRead(flow)}} 步</small></div></router-link></div></section>
      <section class="panel"><h2>常见问题</h2><div class="guide-item-list"><router-link v-for="item in troubleshooting.slice(0,6)" :key="item.id" :to="articleLink(item.id)">{{item.title}}</router-link></div></section>
    </template>
    <section v-else-if="tab==='learn'" class="panel"><h2>新人学习路线</h2><p class="guide-muted">练习入口只导航，不会自动新增、发布、导入或重置数据。</p><div class="guide-flow-grid"><router-link v-for="flow in guideFlows" :key="flow.id" :to="flowLink(flow.id)"><div><strong>{{flow.title}}</strong><p>{{flow.goal}}</p><small>已读 {{flowRead(flow)}} / {{flow.steps.length}} · 已练习 {{flowPracticed(flow)}} / {{flow.steps.length}}</small></div></router-link></div></section>
    <section v-else-if="tab==='personal'" class="panel"><h2>我的记录</h2><p class="guide-muted">{{catalog.rbacEnforced?'当前模拟用户':'统一管理员演示身份'}} · {{guide.owner}}。收藏、阅读与练习记录独立保存。</p><el-alert v-if="personalError||guide.progressError" :title="personalError||guide.progressError" type="warning" :closable="false"/><div class="guide-toolbar"><el-button @click="download(JSON.stringify(guide.progress,null,2),'guide-progress.json')">导出个人记录</el-button><el-button @click="progressOpen=true">恢复个人记录</el-button><el-button @click="guide.refreshProgress()">读取最新记录</el-button><el-button v-if="guide.rawProgress" @click="download(guide.rawProgress,'guide-progress-original.txt')">导出原始内容</el-button></div><h3>收藏 · {{favorites.length}}</h3><div class="guide-item-list"><router-link v-for="item in favorites" :key="item.id" :to="articleLink(item.id)">{{item.title}}</router-link></div><el-empty v-if="!favorites.length" description="还没有收藏文章"/><h3>最近阅读</h3><div class="guide-item-list"><router-link v-for="item in recent" :key="item.id" :to="articleLink(item.id)">{{item.title}}<small v-if="isUpdated(item.id)"> · 内容有更新，可复习</small></router-link></div></section>
    <section v-else class="panel"><div class="guide-toolbar"><h2>{{tab==='page'?'页面手册':tab==='rule'?'业务规则':'问题排查'}}</h2><el-select v-if="tab==='rule'" v-model="pageFilter" clearable placeholder="按页面筛选" aria-label="按页面筛选规则"><el-option v-for="page in guidePages" :key="page.id" :value="page.id" :label="page.title"/></el-select></div><div class="guide-item-list"><router-link v-for="item in categoryItems" :key="item.id" :to="articleLink(item.id)"><strong>{{item.title}}</strong><el-tag v-if="item.status!=='verified'" size="small" type="info">{{item.status==='business-pending'?'待业务确认':item.status==='historical'?'历史入口':'待核验'}}</el-tag><p>{{item.summary}}</p></router-link></div><el-empty v-if="!categoryItems.length" description="当前分类没有说明"/></section>
    <el-dialog v-model="progressOpen" title="恢复个人记录" width="min(660px,95vw)" :close-on-click-modal="false"><p class="guide-muted">只接受同一身份的指南个人记录，不导入商品或授权数据。</p><el-input v-model="progressText" type="textarea" :rows="10" aria-label="个人记录JSON"/><el-alert v-if="personalError" :title="personalError" type="error" :closable="false"/><template #footer><el-button @click="progressOpen=false">取消</el-button><el-button type="primary" :loading="busy" @click="restoreProgress">确认恢复</el-button></template></el-dialog>
  </div>
</template>
<script setup lang="ts">
import '../../components/guide/guide.css'
import {computed,ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import PageHead from '../../components/PageHead.vue'
import {useGuideStore} from '../../stores/guide'
import {useCatalogStore} from '../../stores/catalog'
import {guidePages,guideFlows} from '../../domain/guide/registry'
import {searchGuide} from '../../domain/guide/search'
import {requestGuideFeedback} from '../../domain/guide/presentation'
import type {GuideFlow} from '../../domain/guide/types'
const guide=useGuideStore(),catalog=useCatalogStore(),route=useRoute(),router=useRouter(),search=ref(''),pageFilter=ref('')
const tabs=['home','learn','page','rule','troubleshooting','personal'],tab=ref(tabs.includes(String(route.query.tab))?String(route.query.tab):'home')
const kindText={page:'页面',action:'操作',rule:'规则',concept:'概念',troubleshooting:'排查'}
const results=computed(()=>searchGuide(guide.articles,search.value)),concepts=computed(()=>guide.articles.filter(a=>a.kind==='concept')),troubleshooting=computed(()=>guide.articles.filter(a=>a.kind==='troubleshooting'))
const categoryItems=computed(()=>guide.articles.filter(a=>a.kind===tab.value&&(!pageFilter.value||a.pageIds.includes(pageFilter.value))))
const favorites=computed(()=>guide.progress.favorites.map(id=>guide.article(id)).filter((v):v is NonNullable<typeof v>=>!!v)),recent=computed(()=>guide.progress.recent.map(row=>guide.article(row.id)).filter((v):v is NonNullable<typeof v>=>!!v))
const progressOpen=ref(false),progressText=ref(''),personalError=ref(''),busy=ref(false)
const articleLink=(id:string)=>({path:`/guide/articles/${id}`,query:route.query.returnTo?{returnTo:String(route.query.returnTo)}:{}}),flowLink=(id:string)=>({path:`/guide/learn/${id}`,query:route.query.returnTo?{returnTo:String(route.query.returnTo)}:{}})
const isUpdated=(id:string)=>{const current=guide.article(id)?.revision||0;return (guide.progress.read[id]||guide.progress.recent.find(r=>r.id===id)?.revision||current)<current}
const flowRead=(flow:GuideFlow)=>flow.steps.filter(s=>guide.progress.read[s.articleId]).length,flowPracticed=(flow:GuideFlow)=>flow.steps.filter(s=>guide.progress.practiced[s.articleId]).length
function changeTab(){void router.replace({path:'/guide',query:{...route.query,tab:tab.value}})}
watch(()=>route.query.tab,value=>{tab.value=tabs.includes(String(value))?String(value):'home'})
function download(text:string,name:string){const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function restoreProgress(){busy.value=true;personalError.value='';try{const result=await guide.restoreProgress(progressText.value);if(!result.ok){personalError.value=result.message||'恢复失败';return}progressOpen.value=false}catch(e){personalError.value=String(e)}finally{busy.value=false}}
</script>
