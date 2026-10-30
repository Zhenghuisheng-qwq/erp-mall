<template><UsedGoodsWorkbench v-if="route.query.goods==='used'" :mode="mode"/><ProductListView v-else-if="mode==='spu'" mode="spu"/><SkuWorkbenchView v-else/></template>
<script setup lang="ts">
import {useRoute} from 'vue-router'
import ProductListView from './ProductListView.vue'
import SkuWorkbenchView from './SkuWorkbenchView.vue'
import UsedGoodsWorkbench from '../components/used-goods/UsedGoodsWorkbench.vue'
defineProps<{mode:'spu'|'sku'}>();const route=useRoute()
</script>
