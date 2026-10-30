<template>
 <div class="public-pool-page" :aria-busy="busy">
  <PageHead title="公共商品池" desc="从商品库选择 SPU，作为各权益包可引用的公共商品。"/>
  <PublicSpuPoolManager @busy="busy=$event" @close="router.push(returnTo)"/>
 </div>
</template>
<script setup lang="ts">
import {ref,onBeforeUnmount} from 'vue'
import {useRoute,useRouter,onBeforeRouteLeave} from 'vue-router'
import PageHead from '../components/PageHead.vue'
import PublicSpuPoolManager from '../components/benefit-sales/PublicSpuPoolManager.vue'
import {internalReturnLocation} from '../domain/internalNavigation'
const router=useRouter(),route=useRoute(),busy=ref(false),returnTo=internalReturnLocation(route.query.returnTo)||'/benefits/manage'
onBeforeRouteLeave(()=>!busy.value)
function beforeUnload(event:BeforeUnloadEvent){if(busy.value){event.preventDefault();event.returnValue=''}}
window.addEventListener('beforeunload',beforeUnload)
onBeforeUnmount(()=>window.removeEventListener('beforeunload',beforeUnload))
</script>
<style scoped>.public-pool-page{max-width:1600px;margin:0 auto}</style>
