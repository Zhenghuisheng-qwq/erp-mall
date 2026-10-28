const resources: Record<string,string> = {
  workbench:'商品工作台',spu:'SPU 管理',sku:'SKU 管理',material:'物料管理',model:'商品模型',template:'属性方案',dictionary:'属性词典',type:'产品类型',category:'商品分类',rule:'规格约束',brand:'品牌',group:'运营分组',compatibility:'适用关系与设备型号',view:'列表视图与列配置',import:'商品导入',export:'商品导出',planning:'商品规划',tree:'商品结构视图',overview:'商品总览',check:'商品质量检查',menu:'菜单管理',role:'角色管理',permission:'权限管理',user:'用户管理',feedback:'反馈管理',account:'账号设置',system:'系统恢复',mapping:'属性方案绑定',reset:'数据重置',profile:'个人资料',business:'业务配置',io:'导入导出'
}
const actions: Record<string,string>={read:'查看',create:'新增',update:'编辑',delete:'删除',publish:'发布',grant:'配置授权',bind:'绑定角色',execute:'执行',export:'导出',import:'导入',reset:'重置'}
export const resourceLabel=(key:string)=>resources[key]||key
export const actionLabel=(key:string)=>actions[key]||key
