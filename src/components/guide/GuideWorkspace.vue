<template>
  <div class="guide-page">
    <PageHead title="系统功能说明" desc="按页面查看功能、使用规则与关联页面。"><router-link v-if="route.query.returnTo" :to="returnTo"><el-button>返回业务</el-button></router-link></PageHead>
    <div class="guide-workspace">
      <aside class="panel guide-directory" aria-label="说明目录"><el-input v-model="search" clearable placeholder="搜索页面或功能" aria-label="搜索系统功能说明"/><nav><section v-for="center in directory" :key="center.id" class="guide-directory-center"><h2>{{center.title}}</h2><router-link v-for="item in center.items" :key="item.page.id" :to="articleLink(item.page.articleId)" :aria-current="activePageId===item.page.id?'page':undefined" :data-guide-page="item.page.id">{{item.title}}</router-link><section v-for="group in center.groups" :key="group.id" class="guide-directory-group"><h3>{{group.title}}</h3><router-link v-for="item in group.items" :key="item.page.id" :to="articleLink(item.page.articleId)" :aria-current="activePageId===item.page.id?'page':undefined" :data-guide-page="item.page.id">{{item.title}}</router-link></section></section><el-empty v-if="!directory.length" description="没有匹配的页面说明" :image-size="50"/></nav></aside>
      <section class="panel guide-reading-pane" aria-label="页面说明"><GuideArticleReader :article-id="selectedId" anchor-prefix="guide-full" @open="open" @home="router.push('/guide')"/></section>
    </div>
  </div>
</template>
<script setup lang="ts">
import './guide.css'
import {computed,ref} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import PageHead from '../PageHead.vue'
import GuideArticleReader from './GuideArticleReader.vue'
import {useGuideStore} from '../../stores/guide'
import {useCatalogStore} from '../../stores/catalog'
import {loadMenu,menuRevision} from '../../domain/menuConfig'
import {guideDirectory} from '../../domain/guide/readModel'
import {safeGuideReturn} from '../../domain/guide/routeMap'
const props=withDefaults(defineProps<{articleId?:string}>(),{articleId:''})
const guide=useGuideStore(),catalog=useCatalogStore(),route=useRoute(),router=useRouter(),search=ref('')
const allDirectory=computed(()=>{void menuRevision.value;return guideDirectory(loadMenu())})
const selectedId=computed(()=>props.articleId||allDirectory.value.flatMap(center=>[...center.items,...center.groups.flatMap(group=>group.items)])[0]?.page.articleId||'')
const activePageId=computed(()=>guide.article(selectedId.value)?.pageIds[0]||'')
const directory=computed(()=>{const term=search.value.trim().toLocaleLowerCase();if(!term)return allDirectory.value;return allDirectory.value.map(center=>({...center,items:center.items.filter(item=>matches(item,term)),groups:center.groups.map(group=>({...group,items:group.items.filter(item=>matches(item,term))})).filter(group=>group.items.length)})).filter(center=>center.items.length||center.groups.length)})
function matches(item:{title:string;page:{title:string;articleId:string}},term:string){const article=guide.article(item.page.articleId);return [item.title,item.page.title,article?.summary,...article?.aliases||[],...(article?.actionIds||[]).map(id=>guide.article(id)?.title)].join(' ').toLocaleLowerCase().includes(term)}
const returnTo=computed(()=>safeGuideReturn(route.query.returnTo,catalog.canRoute))
const articleLink=(id:string)=>({path:`/guide/articles/${encodeURIComponent(id)}`,query:route.query.returnTo?{returnTo:returnTo.value}:{}})
function open(id:string){void router.push(articleLink(id))}
</script>
