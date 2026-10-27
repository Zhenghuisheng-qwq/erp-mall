import assert from 'node:assert/strict'
import {defaultMenuNodes,loadMenu,MENU_KEY,menuRouteForLocation,railModel,sanitizeMenu,type MenuNode} from '../src/domain/menuConfig'
import {compatibilityReturnLocation,compatibilityPageTitle} from '../src/domain/compatibilityNavigation'
const defaults=defaultMenuNodes(),sections=railModel('admin',defaults).find(center=>center.key==='product')!.sections
assert.deepEqual(sections.slice(-2).map(section=>section.title),['权益包','兼容性'])
assert.deepEqual(sections.at(-2)!.items.map(item=>item.index),['/sales-shopping','/sales-configurations','/benefit-packages'])
assert.deepEqual(sections.at(-1)!.items.map(item=>item.index),['/compatibility?tab=results','/compatibility?tab=workbench'])
const old=defaults.filter(node=>node.id!=='compatibility-group'&&!node.route.startsWith('/compatibility?tab=')).map(node=>({...node,roles:[...node.roles]}))
old.find(node=>node.id==='sales-config')!.title='销售配置';old.find(node=>node.id==='sales-config')!.sort=4.5
old.find(node=>node.id==='page:/sales-shopping')!.parentId='product'
old.push({id:'page:/compatibility',kind:'page',title:'商品关联与适用关系',parentId:'sales-config',sort:2,route:'/compatibility',hidden:false,roles:['admin','operator']})
const migrated=sanitizeMenu(old)
assert.deepEqual(sanitizeMenu(migrated),migrated)
assert.equal(migrated.find(node=>node.id==='page:/compatibility')!.parentId,'compatibility-group')
assert.equal(migrated.find(node=>node.id==='page:/compatibility')!.route,'/compatibility?tab=results')
assert.equal(migrated.find(node=>node.id==='page:/sales-shopping')!.parentId,'sales-config')
const customized=old.map(node=>({...node,roles:[...node.roles]}))
customized.push({id:'custom-navigation',kind:'group',title:'我的配置',parentId:'product',sort:42,route:'',roles:['admin'],hidden:false,custom:true})
Object.assign(customized.find(node=>node.id==='page:/compatibility')!,{parentId:'custom-navigation',sort:19,hidden:true,roles:['admin'],permissionCode:'product:compatibility:read',title:'我的兼容资料'})
Object.assign(customized.find(node=>node.id==='page:/sales-configurations')!,{sort:37,hidden:true,title:'我的配置草稿'})
const custom=sanitizeMenu(customized)
const source=custom.find(node=>node.id==='page:/compatibility')!,maintenance=custom.find(node=>node.id==='page:/compatibility?tab=workbench')!
for(const key of ['parentId','hidden','permissionCode','roles'] as const)assert.deepEqual(maintenance[key],source[key])
assert.equal(source.sort,19);assert.equal(source.title,'我的兼容资料')
assert.equal(custom.find(node=>node.id==='page:/sales-configurations')!.sort,37)
assert.deepEqual(sanitizeMenu(custom),custom)
const disk=new Map<string,string>();let writes=0
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>disk.get(key)||null,setItem:(key:string,value:string)=>{writes++;disk.set(key,value)}}})
disk.set(MENU_KEY,JSON.stringify({version:1,nodes:old}));loadMenu();const first=disk.get(MENU_KEY);loadMenu();assert.equal(writes,1);assert.equal(disk.get(MENU_KEY),first)
assert.equal(menuRouteForLocation('/compatibility',{tab:'results'}),'/compatibility?tab=results')
assert.equal(menuRouteForLocation('/compatibility',{tab:'workbench'}),'/compatibility?tab=workbench')
assert.equal(menuRouteForLocation('/compatibility',{tab:'legacy'}),'/compatibility?tab=workbench')
assert.equal(menuRouteForLocation('/compatibility',{manage:'sku-id'}),'/compatibility?tab=workbench')
assert.equal(compatibilityPageTitle('workbench'),'兼容性维护')
const back='/sales-configurations?plan=p1&work=private-key&version=v1&node=n1'
assert.equal(compatibilityReturnLocation(back),back)
assert.equal(compatibilityReturnLocation('https://example.com/sales-configurations'),undefined)
assert.equal(compatibilityReturnLocation('/sales-configurations%5c..'),undefined)
assert.equal(compatibilityReturnLocation('/menus'),undefined)
console.log('PASS benefit navigation: two columns, distinct queries, idempotent migration, custom placement/access, exact return and legacy highlighting')
