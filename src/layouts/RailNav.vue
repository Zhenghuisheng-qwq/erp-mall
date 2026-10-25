<template>
  <div ref="wrapRef" class="rail-wrap" :style="navigationStyle" :data-mode="mode" :data-layout="layout" :data-pinned="pinned" @mouseenter="cancelClose" @mouseleave="scheduleClose" @focusout="onFocusOut" @focusin="cancelClose" @keydown.capture="onNavigationKeydown" @pointerdown.capture="onNavigationPointer">
    <div class="nav-column" :class="{'is-single':layout==='single'&&!effectiveCollapsed,'is-icons':effectiveCollapsed}">
      <div class="nav-brand" title="商品配置"><span class="brand-mark">商</span><strong v-if="layout==='single'&&!effectiveCollapsed">商品配置</strong></div>
      <button type="button" class="nav-fold" data-nav-fold :aria-label="compactLabel" :title="compactLabel" :aria-expanded="!effectiveCollapsed" @click="toggleFold"><el-icon :size="18"><Expand v-if="effectiveCollapsed"/><Fold v-else/></el-icon></button>
      <aside v-if="layout==='single'&&!effectiveCollapsed" class="sider" aria-label="主导航">
      <div class="sider-scroll">
        <el-menu
          :key="menuStamp"
          ref="menuRef"
          :default-active="active"
          :default-openeds="openeds"
          :collapse-transition="false"
          @open="onMenuOpen"
          @close="onMenuClose"
          @select="onMenuSelect"
        >
          <template v-for="group in groups" :key="group.key">
          <el-menu-item v-if="group.directIndex" :index="group.directIndex"><a :href="hrefOf(group.directIndex)" :aria-current="active===group.directIndex?'page':undefined" @click.stop="goDirect($event,group.directIndex)"><el-icon :size="18"><component :is="group.icon"/></el-icon><span>{{group.title}}</span></a></el-menu-item>
          <el-sub-menu v-else :index="group.key">
            <template #title>
              <el-icon :size="18"><component :is="group.icon" /></el-icon>
              <span>{{ group.title }}</span>
            </template>
            <el-menu-item v-for="item in group.items" :key="item.index" :index="item.index"><a :href="hrefOf(item.index)" :aria-current="active === item.index ? 'page' : undefined" @click.stop="go($event, item.index)">{{ item.title }}</a></el-menu-item>
            <el-sub-menu v-for="section in group.sections" :key="section.key" :index="section.key">
              <template #title>{{ section.title }}</template>
              <el-menu-item v-for="leaf in section.items" :key="leaf.index" :index="leaf.index"><a :href="hrefOf(leaf.index)" :aria-current="active === leaf.index ? 'page' : undefined" @click.stop="go($event, leaf.index)">{{ leaf.title }}</a></el-menu-item>
            </el-sub-menu>
          </el-sub-menu>
          </template>
        </el-menu>
      </div>
      </aside>
      <nav v-else-if="layout==='single'" class="compact-single" aria-label="主导航">
        <template v-for="group in groups" :key="group.key">
          <a v-if="group.directIndex" class="rail-btn" :data-group="group.key" :title="group.title" :aria-label="group.title" :href="hrefOf(group.directIndex)" :aria-current="active===group.directIndex?'page':undefined" :class="{'is-current':currentGroup===group.key}" @click="goDirect($event,group.directIndex)"><el-icon :size="20"><component :is="group.icon"/></el-icon></a>
          <button v-else class="rail-btn" :data-group="group.key" :title="group.title" :aria-label="group.title" :aria-expanded="openeds.includes(group.key)" :class="{'is-current':currentGroup===group.key}" @click="toggleSingle(group.key)"><el-icon :size="20"><component :is="group.icon"/></el-icon></button>
          <template v-if="!group.directIndex&&openeds.includes(group.key)">
            <a v-for="item in group.items" :key="item.index" class="compact-entry" :class="{'is-current':active===item.index}" :title="item.title" :aria-label="item.title" :aria-current="active===item.index?'page':undefined" :href="hrefOf(item.index)" @click="go($event,item.index)"><el-icon><Document/></el-icon></a>
            <section v-for="section in group.sections" :key="section.key" class="compact-section" :aria-label="section.title">
              <a v-for="item in section.items" :key="item.index" class="compact-entry" :class="{'is-current':active===item.index}" :title="section.title+' · '+item.title" :aria-label="item.title" :aria-current="active===item.index?'page':undefined" :href="hrefOf(item.index)" @click="go($event,item.index)"><el-icon><Document/></el-icon></a>
            </section>
          </template>
        </template>
      </nav>
      <aside v-else ref="railRef" class="rail" :class="{'is-icons':effectiveCollapsed}" aria-label="主导航">
        <div class="rail-scroll"><component :is="group.directIndex?'a':'button'" v-for="(group,index) in groups" :key="group.key" :type="group.directIndex?undefined:'button'" :href="group.directIndex?hrefOf(group.directIndex):undefined" class="rail-btn" :class="{'is-current':currentGroup===group.key,'is-open':shownKey===group.key}" :data-group="group.key" :title="group.title" :aria-label="group.title" :aria-expanded="group.directIndex?undefined:shownKey===group.key" :aria-current="group.directIndex&&active===group.directIndex?'page':undefined" :aria-controls="!group.directIndex&&shownKey===group.key?'nav-flyout':undefined" @mouseenter="onGroupHover(group)" @focus="onGroupFocus(group.key)" @click="group.directIndex?goDirect($event,group.directIndex):showGroup(group.key)" @keydown="onRailKeydown($event,index)"><el-icon :size="20"><component :is="group.icon"/></el-icon><span>{{group.title}}</span></component></div>
      </aside>
      <a v-if="canManageMenus" class="menu-recovery" :href="hrefOf('/menus')" @click="go($event,'/menus')" title="菜单配置" aria-label="菜单配置恢复入口"><el-icon><Setting/></el-icon></a>
      <nav class="nav-dock" aria-label="布局选择" @mouseenter="openLayout(false)" @mouseleave="scheduleLayoutClose">
        <button ref="layoutBtnRef" type="button" class="nav-tool" aria-haspopup="menu" :aria-expanded="layoutOpen" aria-label="切换导航布局" title="切换导航布局" @click="openLayout(true)" @keydown.down.prevent="openLayout(true)" @keydown.up.prevent="openLayout(true)"><el-icon :size="20"><Grid/></el-icon><span v-if="!effectiveCollapsed">布局</span></button>
      </nav>
    </div>
    <Teleport to="body"><div v-if="layoutOpen" ref="layoutPopRef" class="layout-pop" role="menu" aria-label="导航布局" :style="layoutStyle" @mouseenter="cancelLayoutClose" @mouseleave="scheduleLayoutClose" @keydown="onLayoutKeydown" @focusout="onLayoutFocusOut"><button v-for="item in layoutChoices" :key="item.id" type="button" class="layout-option" role="menuitemradio" :aria-checked="layout===item.id" :class="{'is-current':layout===item.id}" @click="chooseLayout(item.id)">{{item.label}}<span class="tick" aria-hidden="true">{{layout===item.id?'✓':''}}</span></button></div></Teleport>
    <nav v-if="layout==='dual'&&shownGroup" id="nav-flyout" ref="flyoutRef" class="flyout" :class="{'is-pop':!docked,'is-dock':docked,'is-one-column':detailColumns===1,'is-tight':tightSpacing}" :style="!docked?popStyle:undefined" :aria-label="shownGroup.title" @mouseenter="cancelClose" @keydown="onFlyoutKeydown">
      <header class="flyout-head"><strong :title="shownGroup.title">{{shownGroup.title}}</strong><button class="nav-pin" data-nav-pin :aria-pressed="pinned" :aria-label="pinned?'取消固定菜单':'固定菜单'" :title="pinned?'取消固定菜单':'固定菜单'" @click="togglePin"><el-icon :size="18"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l-1 7 3 3v2H6v-2l3-3ZM12 15v7"/></svg></el-icon></button></header>
      <div class="flyout-body">
        <div v-if="shownGroup.items.length" class="flyout-direct"><a v-for="item in shownGroup.items" :key="item.index" class="flyout-link" :class="{'is-current':active===item.index}" :href="hrefOf(item.index)" :aria-current="active===item.index?'page':undefined" :data-index="item.index" :title="item.title" @click="go($event,item.index)"><el-icon aria-hidden="true"><component :is="menuRouteIcon(item.index)"/></el-icon><span class="menu-label">{{item.title}}</span></a></div>
        <div class="flyout-sections"><section v-for="(section,sectionIndex) in shownGroup.sections" :key="section.key" :data-section-key="section.key" class="flyout-section" :class="{'is-paired-left':sectionIndex % 2 === 0 && sectionIndex + 1 < shownGroup.sections.length,'is-next-row':sectionIndex >= 2,'is-unpaired':sectionIndex === shownGroup.sections.length - 1 && shownGroup.sections.length % 2 === 1}"><h3 :class="{'is-current':section.items.some(item=>item.index===active)}"><el-icon aria-hidden="true"><FolderOpened/></el-icon><span class="menu-label">{{section.title}}</span></h3><a v-for="item in section.items" :key="item.index" class="flyout-link" :class="{'is-current':active===item.index}" :href="hrefOf(item.index)" :aria-current="active===item.index?'page':undefined" :data-index="item.index" :title="item.title" @click="go($event,item.index)"><el-icon aria-hidden="true"><component :is="menuRouteIcon(item.index)"/></el-icon><span class="menu-label">{{item.title}}</span></a></section></div>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import {Expand,Fold,Grid,Setting,Document,FolderOpened} from '@element-plus/icons-vue'
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import type {Component} from 'vue'
import {useRouter} from 'vue-router'
import {useCatalogStore} from '../stores/catalog'
import {menuRouteIcon} from './navigationIcons'
import {NAV_KEY,readNavigation,type NavigationLayout} from './navigationPreferences'
type Leaf={index:string;title:string}
type Section={key:string;title:string;items:Leaf[]}
export type RailGroup={key:string;title:string;icon:Component;items:Leaf[];sections:Section[];directIndex?:string}
const props=defineProps<{groups:RailGroup[];active:string;currentGroup:string;temporaryCompact?:boolean}>()
const router=useRouter(),catalog=useCatalogStore(),canManageMenus=computed(()=>catalog.can('system:menu:read'))
const wrapRef=ref<HTMLElement>(),railRef=ref<HTMLElement>(),flyoutRef=ref<HTMLElement>(),layoutBtnRef=ref<HTMLButtonElement>(),layoutPopRef=ref<HTMLElement>(),menuRef=ref<{open:(index:string)=>void;updateActiveIndex:(index:string)=>void}>()
const visibleKeys=()=>props.groups.flatMap(g=>g.directIndex?[]:[g.key,...g.sections.map(s=>s.key)])
const placeKeys=()=>props.groups.flatMap(g=>g.directIndex?[]:[...(g.key===props.currentGroup?[g.key]:[]),...g.sections.filter(s=>s.items.some(i=>i.index===props.active)).map(s=>s.key)])
function storedPreferences(){try{return localStorage.getItem(NAV_KEY)}catch{return null}}
const saved=readNavigation(storedPreferences(),visibleKeys(),placeKeys())
const layout=ref(saved.layout),collapsed=ref(saved.collapsed),pinned=ref(saved.pinned),openeds=ref(saved.openeds),openGroup=ref(''),layoutOpen=ref(false),viewport=ref(window.innerWidth),overlayDismissed=ref(false),navigationSpace=ref(window.innerWidth),fontFamily=ref('sans-serif')
const NAV_WIDTH={primary:96,single:228,icons:58} as const
const layoutChoices:{id:NavigationLayout;label:string}[]=[{id:'single',label:'单栏'},{id:'dual',label:'双栏'}]
const effectiveCollapsed=computed(()=>collapsed.value||props.temporaryCompact||viewport.value<700)
const candidateKey=computed(()=>openGroup.value||props.currentGroup||props.groups[0]?.key||'')
const candidateGroup=computed(()=>props.groups.find(group=>group.key===candidateKey.value&&!group.directIndex))
const primaryWidth=computed(()=>effectiveCollapsed.value?NAV_WIDTH.icons:layout.value==='single'?NAV_WIDTH.single:NAV_WIDTH.primary)
const minimumMainWidth=computed(()=>Math.max(640,Math.min(960,navigationSpace.value*.6)))
const canDock=computed(()=>!props.temporaryCompact&&navigationSpace.value-primaryWidth.value-detailWidth.value>=minimumMainWidth.value)
const docked=computed(()=>layout.value==='dual'&&pinned.value&&canDock.value&&!overlayDismissed.value&&Boolean(candidateGroup.value))
const mode=computed(()=>effectiveCollapsed.value?'icons':layout.value)
const shownKey=computed(()=>layout.value==='dual'?(openGroup.value||(docked.value?candidateKey.value:'')):'')
const shownGroup=computed(()=>props.groups.find(g=>g.key===shownKey.value&&!g.directIndex))
const compactLabel=computed(()=>props.temporaryCompact||viewport.value<700?'打开导航菜单':effectiveCollapsed.value?'展开导航文字':'收起导航文字')
const menuStamp=computed(()=>props.groups.map(group=>[group.key,group.directIndex||'',...group.sections.map(section=>section.key)].join('|')).join('|'))
// Natural width follows actual labels; wide screens do not inflate an otherwise compact menu.
const detailColumns=computed(()=>navigationSpace.value<600||((candidateGroup.value?.sections.length||0)<2)?1:2)
let textContext:CanvasRenderingContext2D|null|undefined
function textWidth(text:string,size:number){if(textContext===undefined)textContext=document.createElement('canvas').getContext('2d');if(!textContext)return text.length*size;textContext.font=`${size}px ${fontFamily.value}`;return textContext.measureText(text).width}
const naturalDetailWidth=computed(()=>{
  const group=candidateGroup.value
  const widths=(group?.sections||[]).map(section=>Math.max(160,Math.min(textWidth(section.title,12),12*11)+38,...section.items.map(item=>Math.min(textWidth(item.title,14),14*8)+64)))
  const columnsWidth=Math.max(0,...widths)*detailColumns.value
  const direct=Math.max(0,...(group?.items||[]).map(item=>Math.min(textWidth(item.title,14),14*12)+40))
  return Math.ceil(Math.max(200,columnsWidth+16,direct))
})
const detailWidth=computed(()=>Math.max(0,Math.min(naturalDetailWidth.value,navigationSpace.value-primaryWidth.value-8)))
const tightSpacing=computed(()=>navigationSpace.value<1200||detailWidth.value<naturalDetailWidth.value)
const navigationStyle=computed(()=>({'--nav-column-width':`${primaryWidth.value}px`,'--nav-detail-width':`${detailWidth.value}px`}))
const layoutStyle=ref({left:'8px',bottom:'8px'}),popLeft=ref<number>(NAV_WIDTH.primary)
const popStyle=computed(()=>({left:`${popLeft.value}px`,top:'0px',height:'100dvh',maxHeight:'100dvh',maxWidth:`calc(100vw - ${popLeft.value+8}px)`}))
let navigationInput:'pointer'|'keyboard'='pointer',restoringFocus=false
let closeTimer:ReturnType<typeof setTimeout>|undefined,layoutTimer:ReturnType<typeof setTimeout>|undefined,ignoreMenuEvents=false
function cancelClose(){clearTimeout(closeTimer);closeTimer=undefined}
function keyboardFocusInNavigation(){return navigationInput==='keyboard'&&Boolean(wrapRef.value?.contains(document.activeElement))}
function clearTransientFlyout(){if(pinned.value&&!docked.value)overlayDismissed.value=true;openGroup.value=''}
function scheduleClose(){cancelClose();if(!docked.value)closeTimer=setTimeout(()=>{if(!keyboardFocusInNavigation())clearTransientFlyout()},180)}
function onNavigationKeydown(e:KeyboardEvent){if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '].includes(e.key)){navigationInput='keyboard';cancelClose()}}
function onNavigationPointer(){navigationInput='pointer'}
function onGroupHover(group:RailGroup){if(group.directIndex){if(!docked.value)scheduleClose()}else showGroup(group.key)}
function onGroupFocus(key:string){if(restoringFocus)return;if(props.groups.find(group=>group.key===key)?.directIndex){if(!docked.value){cancelClose();openGroup.value=''}}else showGroup(key)}
function closeFlyoutFromKeyboard(){
  const trigger=groupButton(shownKey.value),restore=Boolean(flyoutRef.value?.contains(document.activeElement))
  cancelClose();clearTransientFlyout();navigationInput='pointer'
  if(restore&&trigger){restoringFocus=true;trigger.focus();restoringFocus=false}
}
function cancelLayoutClose(){clearTimeout(layoutTimer);layoutTimer=undefined}
function scheduleLayoutClose(){cancelLayoutClose();layoutTimer=setTimeout(()=>{if(!layoutPopRef.value?.contains(document.activeElement))layoutOpen.value=false},220)}
function onFocusOut(e:FocusEvent){if(!wrapRef.value?.contains(e.relatedTarget as Node))scheduleClose()}
function onLayoutFocusOut(e:FocusEvent){if(!layoutPopRef.value?.contains(e.relatedTarget as Node)&&e.relatedTarget!==layoutBtnRef.value)scheduleLayoutClose()}
function showGroup(key:string){if(props.groups.find(group=>group.key===key)?.directIndex)return;cancelClose();overlayDismissed.value=false;openGroup.value=key;layoutOpen.value=false;nextTick(placePop)}
function togglePin(){cancelClose();overlayDismissed.value=false;pinned.value=!pinned.value;if(!pinned.value)openGroup.value=''}
function toggleSingle(key:string){openeds.value=openeds.value.includes(key)?openeds.value.filter(k=>k!==key):[...openeds.value,key]}
function persist(){try{localStorage.setItem(NAV_KEY,JSON.stringify({layout:layout.value,collapsed:collapsed.value,pinned:pinned.value,openeds:openeds.value}))}catch{/* Keep navigation usable when preferences cannot be written. */}}
function revealCurrent(){const valid=new Set(visibleKeys());openeds.value=[...new Set([...openeds.value,...placeKeys()])].filter(k=>valid.has(k));nextTick(()=>{if(mode.value==='single')for(const key of placeKeys())menuRef.value?.open(key)})}
function toggleFold(){if(props.temporaryCompact||viewport.value<700){if(layout.value==='dual')showGroup(props.currentGroup||props.groups[0]?.key||'');else toggleSingle(props.currentGroup);return}cancelClose();collapsed.value=!collapsed.value;layoutOpen.value=false;if(!pinned.value)openGroup.value='';nextTick(placePop)}
function chooseLayout(next:NavigationLayout){cancelClose();cancelLayoutClose();ignoreMenuEvents=true;layout.value=next;collapsed.value=false;pinned.value=false;overlayDismissed.value=false;openGroup.value='';layoutOpen.value=false;revealCurrent();nextTick(()=>{ignoreMenuEvents=false;layoutBtnRef.value?.focus()})}
function placeLayout(){const rect=layoutBtnRef.value?.getBoundingClientRect();if(rect)layoutStyle.value={left:`${Math.max(8,Math.min(rect.right+4,window.innerWidth-148))}px`,bottom:`${Math.max(8,Math.min(window.innerHeight-rect.bottom,window.innerHeight-104))}px`}}
function openLayout(focus:boolean){cancelLayoutClose();layoutOpen.value=true;nextTick(()=>{placeLayout();if(focus)layoutPopRef.value?.querySelector<HTMLButtonElement>('[aria-checked=true]')?.focus()})}
function onLayoutKeydown(e:KeyboardEvent){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...layoutPopRef.value!.querySelectorAll<HTMLButtonElement>('button')],i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}else if(e.key==='Escape'){e.preventDefault();layoutOpen.value=false;layoutBtnRef.value?.focus()}}
function onMenuOpen(key:string){if(!ignoreMenuEvents&&!openeds.value.includes(key))openeds.value=[...openeds.value,key]}
function onMenuClose(key:string){if(!ignoreMenuEvents)openeds.value=openeds.value.filter(k=>k!==key)}
async function onMenuSelect(index:string){if(index.startsWith('/')&&router.resolve(index).fullPath!==router.currentRoute.value.fullPath){await router.push(index);menuRef.value?.updateActiveIndex(props.active)}}
function hrefOf(index:string){return router.resolve(index).href}
function goDirect(e:MouseEvent,index:string){if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){cancelClose();openGroup.value='';layoutOpen.value=false}go(e,index)}
function go(e:MouseEvent,index:string){if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onMenuSelect(index)}
function groupButton(key:string){return [...(railRef.value?.querySelectorAll<HTMLElement>('[data-group]')||[])].find(b=>b.dataset.group===key)}
function placePop(){popLeft.value=Math.round(wrapRef.value?.querySelector('.nav-column')?.getBoundingClientRect().right||primaryWidth.value)}
function onRailKeydown(e:KeyboardEvent,index:number){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=railRef.value?.querySelectorAll<HTMLElement>('[data-group]');if(buttons?.length)buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}else if(e.key==='ArrowRight'){e.preventDefault();if(props.groups[index]!.directIndex)return;showGroup(props.groups[index]!.key);nextTick(()=>flyoutRef.value?.querySelector<HTMLAnchorElement>('a')?.focus())}}
function onFlyoutKeydown(e:KeyboardEvent){if(e.key==='ArrowLeft'){e.preventDefault();groupButton(shownKey.value)?.focus()}}
function onDocPointerDown(e:PointerEvent){const target=e.target as Node;if(!layoutPopRef.value?.contains(target)&&!layoutBtnRef.value?.contains(target))layoutOpen.value=false;if(!wrapRef.value?.contains(target)&&!docked.value)clearTransientFlyout()}
function onDocKeydown(e:KeyboardEvent){if(e.key!=='Escape'||e.defaultPrevented)return;const target=e.target instanceof HTMLElement?e.target:null;if(target?.matches('input,textarea,select,[contenteditable=true]')||target?.closest('.el-dialog,.el-message-box,.el-popper,.context-menu'))return;if([...document.querySelectorAll<HTMLElement>('.el-overlay,.el-popper')].some(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'))return;if(layoutOpen.value){layoutOpen.value=false;layoutBtnRef.value?.focus()}else if(!docked.value){closeFlyoutFromKeyboard()}}
function onResize(){const wasDock=docked.value,view=candidateKey.value;viewport.value=window.innerWidth;navigationSpace.value=Math.min(window.innerWidth,wrapRef.value?.parentElement?.clientWidth||window.innerWidth);if(wasDock&&!canDock.value)openGroup.value=view;if(pinned.value&&canDock.value)overlayDismissed.value=false;nextTick(()=>{placePop();if(layoutOpen.value)placeLayout()})}
watch([layout,collapsed,pinned,openeds],persist)
watch(()=>props.temporaryCompact,()=>{openGroup.value='';layoutOpen.value=false;nextTick(placePop)})
watch(()=>router.currentRoute.value.fullPath,()=>{cancelClose();if(!pinned.value)openGroup.value='';layoutOpen.value=false;revealCurrent()})
watch(menuStamp,()=>{if(!props.groups.some(g=>g.key===openGroup.value))openGroup.value='';revealCurrent()})
let spaceObserver:ResizeObserver|undefined
onMounted(()=>{fontFamily.value=getComputedStyle(wrapRef.value!).fontFamily;onResize();if(typeof ResizeObserver!=='undefined'&&wrapRef.value?.parentElement){spaceObserver=new ResizeObserver(onResize);spaceObserver.observe(wrapRef.value.parentElement)}revealCurrent();persist();placePop();document.addEventListener('pointerdown',onDocPointerDown);window.addEventListener('keydown',onDocKeydown);window.addEventListener('resize',onResize)})
onBeforeUnmount(()=>{spaceObserver?.disconnect();cancelClose();cancelLayoutClose();document.removeEventListener('pointerdown',onDocPointerDown);window.removeEventListener('keydown',onDocKeydown);window.removeEventListener('resize',onResize)})
</script>
<style scoped>

.menu-recovery {color:var(--nav-text);text-align:center;text-decoration:none;padding:5px}
.rail-wrap { display: flex; flex: none; height: 100%; min-height: 0; position: relative; z-index: 20; }
.nav-column { width: var(--nav-column-width); flex: none; height: 100%; min-height: 0; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; }
.rail, .sider { width: 100%; flex: 1; min-height: 0; background: var(--nav-bg); color: var(--nav-text); display: flex; flex-direction: column; }
.rail.is-icons .rail-btn { min-height: 48px; gap: 0; padding: 8px 0; }
.rail.is-icons .rail-btn span { display: none; }
.nav-column.is-icons .nav-tool-label { display: none; }
.nav-column.is-icons .nav-tool-mark { display: inline; }
.nav-tool-mark { display: none; font-size: 16px; line-height: 1; }
.nav-fold { width: 40px; height: 40px; min-width: 32px; min-height: 32px; border: 0; border-radius: 4px; background: transparent; color: var(--text-primary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex: none; }
.nav-fold:hover { background: var(--hover-bg); }
.nav-fold:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 1px; }
.nav-dock { flex: none; display: flex; flex-direction: column; gap: 4px; padding: 6px; }
.nav-tool { border: 0; background: transparent; color: var(--nav-text); cursor: pointer; font-size: 12px; line-height: 1.2; }
.nav-tool { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 32px; padding: 6px 4px; border-radius: 6px; }
.nav-tool:hover { background: var(--nav-hover); color: var(--text-primary); }
.nav-tool:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -2px; }
.layout-pop { position: fixed; z-index: 80; min-width: 120px; padding: 4px; border-radius: 8px; background: var(--flyout-bg); color: var(--flyout-text); border: 1px solid var(--flyout-border); box-shadow: var(--shadow-pop); }
.layout-option { display: block; width: 100%; text-align: left; border: 0; background: transparent; color: inherit; border-radius: 6px; padding: 8px 10px; cursor: pointer; font-size: 13px; }
.layout-option:hover { background: var(--flyout-hover); }
.layout-option.is-current { background: var(--flyout-current-bg); color: var(--flyout-current-text); }
.layout-option:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -2px; }
.sider-brand { height: 56px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: var(--nav-bg-deep); overflow: hidden; }
.sider-brand strong { font-size: 15px; font-weight: 650; color: var(--text-primary); white-space: nowrap; }
.sider :deep(.el-menu-item a) { color: inherit; display: block; width: 100%; text-decoration: none; }
.sider-scroll { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; }
.sider-scroll::-webkit-scrollbar { width: 6px; }
.sider-scroll::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 3px; }
.sider :deep(.el-menu) { --el-menu-bg-color: var(--nav-bg); --el-menu-text-color: var(--nav-text); --el-menu-hover-bg-color: var(--nav-hover); --el-menu-hover-text-color: var(--text-primary); --el-menu-active-color: var(--nav-current-text); --el-menu-item-height: 42px; --el-menu-sub-item-height: 42px; --el-menu-item-font-size: 14px; border-right: 0; width: 100%; background: var(--nav-bg); }
.sider :deep(.el-menu-item),
.sider :deep(.el-sub-menu__title) { color: var(--nav-text); }
.sider :deep(.el-menu--inline) { background: var(--nav-bg-deep); }
.sider :deep(.el-sub-menu.is-active > .el-sub-menu__title) { color: var(--app-accent); }
.sider :deep(.el-menu-item.is-active),
.sider :deep(.el-menu-item.is-active:hover) { background: var(--nav-current-bg) !important; color: var(--nav-current-text) !important; }
.rail-brand { height: 56px; flex: none; display: flex; align-items: center; justify-content: center; background: var(--nav-bg-deep); }
.rail-scroll { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 6px 0 12px; }
.rail-scroll::-webkit-scrollbar { width: 0; }
.rail-btn {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--nav-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 64px;
  padding: 10px 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.25;
}
.rail-btn[href] { text-decoration: none; }
.rail-btn span { white-space: nowrap; }
.rail-btn:hover, .rail-btn.is-open { background: var(--nav-hover); color: var(--text-primary); }
.rail-btn.is-current, .rail-btn.is-current:hover { background: var(--nav-current-bg); color: var(--nav-current-text); }
.rail-btn:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -3px; }
.flyout { width: var(--nav-detail-width); max-width: 100vw; background: var(--flyout-bg); color: var(--flyout-text); display: flex; flex-direction: column; min-height: 0; }
.flyout.is-pop {
  position: fixed;
  z-index: 30;
  border: 1px solid var(--flyout-border);
  border-left: 0;
  border-radius: 0 10px 10px 0;
  box-shadow: var(--shadow-pop);
}
.flyout.is-dock { position: relative; height: 100%; flex: none; border-right: 1px solid var(--flyout-border); }
.flyout-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 14px 12px 8px; }
.flyout-head strong { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; color: var(--text-primary); }
.flyout-link:focus-visible, .flyout-shortcut:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 1px; }
.flyout-body { flex: 1; min-height: 0; overflow: auto; padding: 0 8px 14px; }
.flyout-body::-webkit-scrollbar { width: 8px; }
.flyout-body::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 4px; }
.flyout-shortcut {
  display: block;
  margin: 0 4px 10px;
  padding: 8px 10px;
  border-radius: 6px;
  border-bottom: 1px solid var(--flyout-border);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.4;
}
.flyout-shortcut:hover { background: var(--flyout-hover); }
.flyout-shortcut.is-current { background: var(--flyout-current-bg); color: var(--flyout-current-text); }
.flyout-direct { width: 100%; padding-bottom: 8px; }
.flyout-sections { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); grid-auto-flow: row; }
.flyout-section { min-width: 0; margin: 0; padding: 12px 4px; }
.flyout-section.is-paired-left { border-right: 1px solid var(--flyout-border); }
.flyout-section.is-next-row { border-top: 1px solid var(--flyout-border); }
.flyout-section.is-unpaired { grid-column: 1 / -1; }
.flyout-section h3 { display: grid; grid-template-columns: 16px minmax(0,1fr); align-items: start; gap: 6px; margin: 0 8px 4px; font-size: 12px; line-height: 20px; font-weight: 500; color: var(--text-secondary); }
.flyout-section h3 .el-icon { font-size: 14px; height: 20px; }
.flyout-section h3.is-current { font-weight: 600; }
.flyout-section h3.is-current .el-icon { color: var(--app-accent); opacity: .75; }
.flyout-link {
  display: grid;
  grid-template-columns: 16px minmax(0,1fr);
  align-items: start;
  gap: 6px;
  margin: 0;
  padding: 7px 8px;
  border-radius: 6px;
  color: var(--flyout-text);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: normal;
  text-decoration: none;
}
.flyout-link .el-icon { font-size: 16px; height: 20px; }
.flyout-section .flyout-link { padding-left: 28px; }
.menu-label { min-width: 0; overflow-wrap: anywhere; }
.flyout-link:hover { background: var(--flyout-hover); }
.flyout-link.is-current { background: var(--flyout-current-bg); color: var(--flyout-current-text); font-weight: 650; }

.nav-brand {height:56px;flex:none;display:flex;align-items:center;justify-content:center;gap:10px;background:var(--nav-bg-deep);overflow:hidden;color:var(--text-primary)}
.nav-brand strong {white-space:nowrap;font-size:15px}
.nav-fold {margin:6px auto;color:var(--nav-text)}
.nav-column.is-single .nav-fold {margin-left:10px}
.flyout-head {justify-content:space-between;min-height:56px;border-bottom:1px solid var(--flyout-border);padding:8px 12px}
.nav-pin {flex:none;align-self:flex-start;width:32px;height:32px;border:0;border-radius:5px;background:transparent;color:var(--flyout-text);cursor:pointer}
.nav-pin[aria-pressed=true] {background:var(--flyout-current-bg);color:var(--app-accent);box-shadow:inset 0 0 0 1px var(--app-accent)}
.layout-option {display:flex;justify-content:space-between;gap:24px;width:100%}
.layout-option .tick {color:var(--app-accent)}
.compact-single {overflow-y:auto;flex:1;min-height:0}
.compact-entry {display:flex;align-items:center;justify-content:center;color:var(--nav-text);height:36px;text-decoration:none;border-radius:4px;margin:2px 6px}
.compact-entry:hover {background:var(--nav-hover)}
.compact-entry.is-current {background:var(--nav-current-bg);color:var(--nav-current-text)}
.compact-section {border-top:1px solid var(--border-default);margin-top:5px}
.menu-recovery:focus-visible,.nav-pin:focus-visible,.compact-entry:focus-visible {outline:2px solid var(--app-accent);outline-offset:-2px}
.flyout.is-tight .flyout-body { padding-left: 6px; padding-right: 6px; }
.flyout.is-tight .flyout-section { padding: 9px 2px; }
.flyout.is-tight .flyout-link { padding-top: 6px; padding-bottom: 6px; }
.flyout.is-one-column .flyout-sections { grid-template-columns: minmax(0,1fr); }
.flyout.is-one-column .flyout-section.is-paired-left { border-right: 0; }
.flyout.is-one-column .flyout-section + .flyout-section { border-top: 1px solid var(--flyout-border); }
.flyout.is-one-column .flyout-section.is-unpaired { grid-column: auto; }
</style>
