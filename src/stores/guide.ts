import {readonly} from 'vue'
import {defineStore} from 'pinia'
import {guideArticles} from '../domain/guide/registry'
import type {GuideArticle} from '../domain/guide/types'

/** Code-maintained explanations only. Reading never opens or migrates saved guide records. */
export const useGuideStore=defineStore('guide',()=>{
  const articles=readonly(guideArticles) as unknown as GuideArticle[]
  const article=(id:string)=>articles.find(item=>item.id===id)
  return {articles,article}
})
