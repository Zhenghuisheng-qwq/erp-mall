import assert from 'node:assert/strict'
import { reorderSkuColumn } from '../src/domain/skuColumnOrder'
import { defaultSkuConfig } from '../src/domain/skuWorkbenchState'
const config=defaultSkuConfig(), before=JSON.stringify(config)
config.columns[0]!.width=240;config.columns[0]!.frozen='left'
config.columns.push({key:'attr:stable-test',visible:true,width:180,frozen:'right'})
const keys=config.columns.map(c=>c.key), first=keys[0]!, last=keys.at(-1)!
const moved=reorderSkuColumn(config.columns,last,first,'before')
assert.equal(moved[0]!.key,last);assert.deepEqual(moved.slice(1).map(c=>c.key),keys.slice(0,-1))
assert.equal(moved[1],config.columns[0]);assert.equal(moved[1]!.width,240);assert.equal(moved[1]!.frozen,'left')
assert.equal(reorderSkuColumn(config.columns,first,first,'after'),config.columns)
assert.equal(reorderSkuColumn(config.columns,'missing',first,'before'),config.columns)
const returned=reorderSkuColumn(moved,last,keys.at(-2)!,'after');assert.deepEqual(returned,config.columns)
assert.equal(new Set(moved.map(c=>c.key)).size,keys.length)
console.log('PASS B stable-key full-array ordering, before/after, no-op, widths/frozen and untouched field identity')

import {addCenter,addGroup,placePage,sanitizeMenu,defaultMenuNodes,validateMenu,accessRoute,railModel,removeGroup,menuRouteForLocation,saveMenu,loadMenu} from '../src/domain/menuConfig'
import {readNavigation} from '../src/layouts/navigationPreferences'
const disk=new Map<string,string>()
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>disk.get(k)||null,setItem:(k:string,v:string)=>disk.set(k,v)}})
let menus=defaultMenuNodes();menus.find(n=>n.route==='/skus')!.title='旧定制 SKU';menus.find(n=>n.route==='/brands')!.hidden=true
menus=addCenter(menus,'新中心').nodes;const center=menus.find(n=>n.custom&&n.kind==='center')!
menus=addGroup(menus,center.id,'新分组').nodes;const group=menus.find(n=>n.custom&&n.kind==='group')!
menus=placePage(menus,'/skus',group.id).nodes;menus=placePage(menus,'/skus',center.id).nodes
assert.equal(menus.filter(n=>n.route==='/skus').length,1);assert.equal(menus.find(n=>n.route==='/skus')!.title,'旧定制 SKU')
assert.equal(validateMenu(menus),'');saveMenu(menus);assert.deepEqual(loadMenu(),menus)
assert(!placePage(menus,'javascript:alert(1)',center.id).ok);assert(!placePage(menus,'/skus', 'page:/spus').ok)
assert(validateMenu([...menus,menus[0]!]))
assert(!removeGroup(menus,center.id).ok);assert(removeGroup(menus,group.id).ok)
const bad=structuredClone(menus);bad.find(n=>n.id===center.id)!.parentId=group.id;assert(validateMenu(bad))
const custom=structuredClone(menus);custom.find(n=>n.id===center.id)!.roles=['admin'];assert(!accessRoute('operator','/skus',custom));assert(!railModel('operator',custom).some(g=>g.key===center.id))
custom.find(n=>n.route==='/users')!.roles=['admin','operator'];assert(!accessRoute('operator','/users',custom));assert(!railModel('operator',custom).flatMap(g=>g.items).some(p=>p.index==='/users'))
assert(accessRoute('admin','/menus',custom));assert(sanitizeMenu(custom).find(n=>n.route==='/brands')!.hidden)
assert.equal(menuRouteForLocation('/skus/new'),'/skus');assert.equal(menuRouteForLocation('/materials/archive'),'/spus');assert.equal(menuRouteForLocation('/skus',{panel:'columns'}),'/products?panel=columns')
assert.equal(readNavigation(JSON.stringify({layout:'center',collapsed:true}),[],[]).layout,'center')
assert.equal(readNavigation(JSON.stringify({mode:'icons',expandedMode:'single'}),[],[]).layout,'single')
console.log('PASS C custom center/group persistence, canonical page, invalid routes/parents, legacy titles, inherited roles/admin ceiling, recovery and layout migration')
