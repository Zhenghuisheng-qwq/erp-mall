<template><el-radio-group :model-value="route.query.goods==='used'?'used':'new'" aria-label="商品数据模式" @change="change"><el-radio-button value="new" :disabled="!store.canRoute({path:route.path})">全新商品</el-radio-button><el-radio-button value="used" :disabled="!store.can('product:used-goods:read')">二手商品</el-radio-button></el-radio-group></template>
<script setup lang="ts">
import {useRoute,useRouter,type LocationQueryRaw} from 'vue-router'
import {useCatalogStore} from '../../stores/catalog'
const route=useRoute(),router=useRouter(),store=useCatalogStore()
function change(value:string|number|boolean|undefined){const query:LocationQueryRaw={...route.query,goods:value==='used'?'used':undefined};for(const key of Object.keys(query))if(key.startsWith('used'))delete query[key];void router.push({path:route.path,query})}
</script>
