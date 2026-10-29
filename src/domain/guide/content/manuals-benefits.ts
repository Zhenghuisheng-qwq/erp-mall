import type {GuideArticle,GuidePage,GuideManualContent} from '../types'
const shopping:GuideManualContent={purpose:'选择使用设备，直接选购已确认可用的商品；权益包配置不是选购前置条件。',features:[
{id:'benefits-device',title:'选手机，直接选配件',description:'不创建权益包也能查询正式适用配件。',operation:'搜索并选择实际手机；在“全部可选商品”点击添加，按需明确“加入手机”。',result:'只展示在售的真实销售 SKU，不自动购买使用设备。',primary:true},
{id:'benefits-own-device',title:'客户自有手机',description:'使用设备与购买手机分开。',operation:'选择已经停售的实际手机，或客户自有设备型号。',result:'停售手机仍可查询配件；型号级查询不代替具体规格条件核验。'},
{id:'benefits-missing',title:'配件为什么没出现',description:'基本使用必须有已确认可用依据。',operation:'先检查当前分组；有管理权限时打开“查看原因”，到兼容性页面核对。',result:'待确认、条件待核验、冲突、停售和 MAT 不进入普通候选。快充状态单独说明。'},
{id:'benefits-save',title:'报价、保存与确认',description:'每行填写本次单件报价；留空是待报价，明确输入 0 才是零元。',operation:'调整数量和报价，保存草稿；补齐报价后确认清单。通过“已保存清单”再次打开。',result:'已确认清单只读，冻结商品与适用依据；复制后按当前数据复核。不代表付款、扣库存或发货。',primary:true},
{id:'benefits-change',title:'更换设备',description:'先查看可保留及需移除商品，包含本次购买的原手机。',operation:'选择另一设备，核对影响后确认或取消。',result:'取消不改变原输入；确认一次应用，保留仍可用商品的数量与报价。'}],restrictions:[{id:'benefits-stale',condition:'商品或适用声明已变化',effect:'保存前再次复核，原清单和报价保留。',resolution:'处理标出的商品后重试；已确认记录继续按历史快照查看。'}]}
const management:GuideManualContent={
 purpose:'选归属分类与配件类型 → 明确主机范围 → 选择设备预览 → 保存；暂时无商品也可配置。',
 features:[
  {id:'benefits-group',title:'分类内组包',description:'归属分类限定配件目录；主机可以来自其他分类。Apple 主机范围不限制配件品牌。',operation:'在左侧分类＋产品类型目录选择位置，新建并命名；勾选分类内启用的配件类型，明确主机范围，按需预览后保存。',result:'先配置手机壳与钢化膜类型；钢化膜可以稍后建档。销售选定具体手机后，只出现当前真实可售且已确认适用的 SKU；新增产品类型须另行勾选。',primary:true},
  {id:'benefits-source',title:'从模型查看同一份配置',description:'模型入口默认按明确型号或发布范围的交集查找相关包，包含通用包、已停用包和暂无商品的包。',operation:'草稿入口先选择当前模型的已发布版本；节点不能对应时明确重选分支。可切换全部权益包，或按左侧分类编辑，再返回当前范围相关。',result:'两个入口编辑同一条记录；不自动使用最新版本，不因主机分类不同隐藏配件包。'},
  {id:'benefits-range',title:'全部型号与固定分支',description:'多个主机范围按并集匹配。',operation:'选择主机类型的全部型号，或明确发布快照中的模型／品牌／型号分支。',result:'类型范围包含未来合法型号；发布分支固定在该快照的型号集合，同一稳定型号跨版本可命中，新型号须重新选范围。'},
  {id:'benefits-toggle',title:'补齐与维护配置',description:'旧轻量包保留原内容并显示待补充配置，不影响全部可选商品。',operation:'编辑旧包，明确归属分类并核对主机范围；有失效引用时清理或停用。',result:'型号适用与商品在售分别核对。零候选仅作当前情况提示，不阻止合法配置保存；确认清单仍按原快照读取。'}
 ],restrictions:[{id:'benefits-scope',condition:'无有效发布快照或节点无法解析型号',effect:'不回退最新版本，不根据名称、颜色或容量猜范围。',resolution:'在来源位置选择已发布版本和有效分支；没有发布版本时返回来源维护。'}]
}
export const benefitPages:GuidePage[]=[{id:'page-benefit-shopping',title:'权益包选购',patterns:['/benefits/shopping'],articleId:'manual-benefit-shopping',actionIds:[],formal:true},{id:'page-benefit-management',title:'权益包管理',patterns:['/benefits/manage'],articleId:'manual-benefit-management',actionIds:[],formal:true}]
export const benefitManuals:Record<string,GuideManualContent>={'page-benefit-shopping':shopping,'page-benefit-management':management}
export const benefitArticles:GuideArticle[]=benefitPages.map(p=>({id:p.articleId,title:p.title,kind:'page',summary:benefitManuals[p.id]!.purpose,aliases:[...p.patterns],pageIds:[p.id],actionIds:[],ruleIds:[],related:[],sections:benefitManuals[p.id]!.features.map(f=>({id:f.id,title:f.title,paragraphs:[f.description,f.operation,f.result]}))}))
