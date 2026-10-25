<template>
  <Teleport to="body">
    <section v-if="modelValue" ref="panel" class="node-add-panel" role="dialog" :aria-label="title" :aria-busy="busy" :style="position" @pointerdown.stop @mousedown.stop @click.stop @wheel.stop @keydown.stop>
      <header><strong>{{title}}</strong><el-button text aria-label="关闭新增面板" :disabled="busy" @click="close">×</el-button></header>
      <p v-if="detached" class="node-add-position-note" role="status">节点位置已变化，待添加内容已保留。</p>
      <div class="node-add-content"><slot/></div><footer><slot name="footer"/></footer>
    </section>
  </Teleport>
</template>
<script setup lang="ts">
import {nextTick,onBeforeUnmount,ref,watch} from 'vue'
const props=withDefaults(defineProps<{modelValue:boolean;title:string;anchor:HTMLElement|null;busy?:boolean}>(),{busy:false})
const emit=defineEmits<{'update:modelValue':[value:boolean];closed:[]}>()
const panel=ref<HTMLElement>(),position=ref<Record<string,string>>({visibility:'hidden'}),detached=ref(false)
let frame=0,lastPoint:{x:number;y:number}|undefined
function close(){if(!props.busy)emit('update:modelValue',false)}
function place(){
 if(!props.modelValue)return
 const width=Math.min(460,window.innerWidth-24),height=Math.min(panel.value?.offsetHeight||440,innerHeight-24),anchor=props.anchor
 const rect=anchor?.isConnected?anchor.getBoundingClientRect():undefined,board=anchor?.closest('.vue-flow, .outline')?.getBoundingClientRect()
 const usable=!!rect&&rect.width>0&&rect.height>0&&rect.bottom>=0&&rect.top<=innerHeight&&rect.right>=0&&rect.left<=innerWidth&&(!board||rect.bottom>=board.top&&rect.top<=board.bottom&&rect.right>=board.left&&rect.left<=board.right)
 detached.value=!usable
 if(usable&&rect){lastPoint={x:innerWidth<760?(innerWidth-width)/2:rect.right+width+12<innerWidth?rect.right+8:rect.left-width-8,y:innerWidth<760?(innerHeight-height)/2:rect.top}}
 const point=lastPoint||{x:innerWidth-width-16,y:Math.min(100,Math.max(12,innerHeight-height-12))}
 position.value={left:`${Math.max(12,Math.min(point.x,innerWidth-width-12))}px`,top:`${Math.max(12,Math.min(point.y,innerHeight-height-12))}px`,width:`${width}px`}
 frame=requestAnimationFrame(place)
}
watch(()=>props.modelValue,async open=>{cancelAnimationFrame(frame);if(open){lastPoint=undefined;position.value={visibility:'hidden'};await nextTick();place();panel.value?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true})}else{emit('closed');if(props.anchor?.isConnected)props.anchor.focus({preventScroll:true})}})
onBeforeUnmount(()=>cancelAnimationFrame(frame))
</script>
<style scoped>
.node-add-panel{position:fixed;z-index:2000;box-sizing:border-box;max-height:calc(100vh - 24px);display:flex;flex-direction:column;border:1px solid var(--el-border-color);border-radius:10px;background:var(--el-bg-color-overlay);color:var(--el-text-color-primary);box-shadow:var(--el-box-shadow);padding:14px}header,footer{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none}header{margin-bottom:12px}footer{justify-content:flex-end;padding-top:12px}.node-add-content{overflow:auto;min-height:0;padding:2px}.node-add-position-note{font-size:12px;line-height:1.5;color:var(--el-text-color-secondary);margin:0 0 10px}
</style>
