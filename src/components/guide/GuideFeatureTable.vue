<template>
  <div class="guide-table-scroll guide-feature-table">
    <table aria-label="页面功能清单">
      <colgroup><col class="guide-feature-name"/><col class="guide-feature-description"/><col class="guide-feature-operation"/><col class="guide-feature-result"/></colgroup>
      <thead><tr><th scope="col">功能</th><th scope="col">能做什么</th><th scope="col">入口与操作</th><th scope="col">结果和关键限制</th></tr></thead>
      <tbody><tr v-for="row in rows" :key="row.id" :data-guide-feature="row.id" :class="{'is-primary':row.primary,'is-risk':row.risk}">
        <th scope="row" data-label="功能"><span>{{row.title}}</span></th>
        <td data-label="能做什么">{{row.description}}</td><td data-label="入口与操作">{{row.operation}}</td><td data-label="结果和关键限制">{{row.result}}</td>
      </tr></tbody>
    </table>
  </div>
</template>
<script setup lang="ts">
import type {GuideFeatureRow} from '../../domain/guide/types'
defineProps<{rows:readonly GuideFeatureRow[]}>()
</script>
