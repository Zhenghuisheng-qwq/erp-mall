import type {GuideArticle,GuidePage,GuideManualContent} from '../types'
const features=[
 {id:'bundle-create',title:'创建产品类型集合',description:'权益包保存名称、归属分类、明确选择的产品类型、启用状态和排序。',operation:'选择归属分类，新建权益包，勾选需要的类型并保存。',result:'暂时没有 SKU 的合法类型也能配置。',primary:true},
 {id:'bundle-category',title:'只选归属分类下的类型',description:'权益包的参与类型限定在同一归属分类。',operation:'先选择手机分类，再勾选手机、手机壳、手机膜、充电器；试选具体手机预览可用商品。',result:'切换分类保留已选内容并提示移除越界项；设备仅用于预览，不成为永久绑定。'},
 {id:'bundle-maintain',title:'编辑、时间记录与删除',description:'列表展示创建时间和更新时间，编辑保存后更新维护时间。',operation:'点击编辑维护配置；有删除权限时点击删除并确认。窄屏条目与桌面表格提供相同操作。',result:'删除仅移除权益包配置，不连带删除商品、草稿或历史确认清单；删除失败保留原记录，可重试。'},
 {id:'bundle-sale',title:'选设备后选配与报价',description:'普通候选提前过滤不可售、待核验、不适用和冲突商品；独立销售商品走正常销售准入。',operation:'选择实际手机规格，采用权益包或调整自由组合类型，点商品右侧 ＋，填写数量和单价，再保存草稿或确认清单。',result:'设备不会自动购买；需要购买时明确点“加入手机”。添加及确认均复核当前适用数据。',primary:true},
 {id:'bundle-return',title:'维护适用资料后返回',description:'商品适用资料独立保存在兼容性工作台。',operation:'从商品适用详情点“适用资料”，在工作台保存后点“返回选购 / 来源”。',result:'候选刷新，当前未保存数量与报价保留；无效项目明确提示，不能确认失效商品。'},
 {id:'bundle-history',title:'确认快照与再次选购',description:'确认清单显示当时保存的商品、规格、数量、报价和依据。',operation:'通过已保存清单查看。需要再次选购时复制为新草稿，按当前资料核对。',result:'后续改名、停售及修改适用关系不改写确认快照；新草稿中失效项目需要明确处理。'},
 {id:'bundle-demo',title:'完整演示数据',description:'手机分类下只有手机壳、手机膜、充电器和手机四种类型。四个模型均已发布，包含 10 个在售 SKU、10 条 MAT 及两个权益包。',operation:'新环境直接选择手机；已有环境首次刷新会按本轮要求整理旧商品数据；也可在顶部“演示数据”中重建手机四类型数据。',result:'重复执行不重复建档；冲突整批拒绝并保留用户记录。演示依据不代表真实供应商承诺。'}
]
export const bundlePages:GuidePage[]=[{id:'page-type-bundles',title:'权益包管理',patterns:['/benefits/manage'],articleId:'manual-type-bundles',actionIds:[],formal:true},{id:'page-bundle-sale',title:'权益包选购',patterns:['/benefits/shopping'],articleId:'manual-bundle-sale',actionIds:[],formal:true}]
export const bundleManuals:Record<string,GuideManualContent>=Object.fromEntries(bundlePages.map(p=>[p.id,{purpose:'配置产品类型组合，按正式适用结果选购、报价并保存历史快照。',features,restrictions:[]}]))
export const bundleArticles:GuideArticle[]=bundlePages.map(p=>({id:p.articleId,title:p.title,kind:'page',summary:'类型集合配置、按设备选购、数量报价与历史快照。',aliases:[...p.patterns,'自由组合'],pageIds:[p.id],actionIds:[],ruleIds:[],related:[],sections:features.map(f=>({id:f.id,title:f.title,paragraphs:[f.description,f.operation,f.result]}))}))
