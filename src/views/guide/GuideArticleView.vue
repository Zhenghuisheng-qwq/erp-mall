<template><GuideWorkspace :article-id="String(route.params.articleId||'')"/></template>
<script setup lang="ts">
import {useRoute} from 'vue-router'
import GuideWorkspace from '../../components/guide/GuideWorkspace.vue'
const route=useRoute()
</script>
