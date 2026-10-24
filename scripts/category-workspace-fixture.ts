import { functionalGapsFixture } from './functional-gaps-fixture'
export function categoryWorkspaceFixture() {
  const { data } = functionalGapsFixture()
  const category = (id: string, name: string, parentId: string | null, sort: number) => ({ id, name, parentId, sort, enabled: true })
  data.categories.push(category('r4-a','整理来源',null,80),category('r4-b','整理目标',null,81),category('r4-source','移动子树','r4-a',1),category('r4-leaf','子树末级','r4-source',1),category('r4-peer','来源同级','r4-a',2),category('r4-before','目标第一项','r4-b',1),category('r4-after','目标第二项','r4-b',2),category('r4-typed','关联类型的分类',null,82))
  for(let i=0;i<45;i++)data.categories.push(category(`r4-long-${i}`,`长列表分类 ${String(i+1).padStart(2,'0')}`,'r4-b',i+3))
  data.productTypes.push({id:'r4-type',name:'分类验收类型',categoryId:'r4-typed',status:'enabled',sort:90,description:''})
  data.families.find(item=>item.id==='gaps-spu')!.categoryId='r4-leaf'
  data.mappings.push({categoryId:'r4-source',templateId:'t-phone'})
  return data
}
