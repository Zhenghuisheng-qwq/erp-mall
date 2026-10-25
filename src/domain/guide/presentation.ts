import { reactive, nextTick } from 'vue'
import type { GuideFailure } from './types'

export interface GuideFeedbackSource { articleId?:string; ruleId?:string; pageId?:string; actionId?:string; contentRevision?:number }
const state=reactive({open:false,articleId:'',pageId:'',failure:undefined as GuideFailure|undefined,feedbackRequest:undefined as (GuideFeedbackSource&{sequence:number})|undefined})
let trigger:HTMLElement|null=null,recover:((action:string)=>void)|undefined,sequence=0
export const guideUI=state
/** Presentation state only: no route changes, business writes or persistent hover state. */
export function openGuide(options:{articleId?:string;pageId?:string;failure?:GuideFailure;onRecover?:(action:string)=>void}={}) {
  if(!state.open)trigger=document.activeElement instanceof HTMLElement?document.activeElement:null
  state.articleId=options.articleId||'';state.pageId=options.pageId||'';state.failure=options.failure?{...options.failure,recovery:options.onRecover?options.failure.recovery:options.failure.recovery?.filter(action=>action==='feedback')}:undefined;recover=options.onRecover;state.open=true
}
export function closeGuide(){state.open=false;state.failure=undefined;recover=undefined;nextTick(()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true});trigger=null})}
export function recoverFromGuide(action:string){const handler=recover;closeGuide();nextTick(()=>handler?.(action))}
export function requestGuideFeedback(source:GuideFeedbackSource={}){state.feedbackRequest={...source,sequence:++sequence}}
