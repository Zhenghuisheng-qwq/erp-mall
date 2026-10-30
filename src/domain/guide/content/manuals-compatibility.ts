import type {GuideArticle,GuideManualContent,GuidePage} from '../types'
export const compatibilityPages:GuidePage[]=[{id:'page-compatibility',title:'兼容性管理',patterns:['/compatibility'],articleId:'manual-compatibility',actionIds:[],formal:true}]
const features=[
 {id:'list',title:'查看适用关系',description:'商品中心的兼容性分组进入兼容性管理。',operation:'按产品类型或商品、规格、型号关键词筛选，直接查看商品对应的适用型号。',result:'一条销售SKU可以关联多个型号；没有设置型号的商品也能找到。'},
 {id:'edit',title:'选择商品，勾选型号，保存',description:'常规维护只选择具体商品和适用型号。',operation:'点击新增适用关系，选择产品类型，勾选需要维护的SKU，再搜索和勾选型号，点保存关联。单条关系可直接点编辑。',result:'不要求填写资料说明或配置技术条件；维护人应按实际产品资料确认，系统不从品牌和商品名称推断适用。'},
 {id:'batch',title:'批量新增与替换',description:'批量编辑默认新增适用型号，保护各商品原有差异。',operation:'在列表多选商品后点批量编辑。新增适用型号保留原有其他型号；明确选择替换适用型号时，用本次选择替换普通型号关联，取消内容保存前确认。',result:'只修改明确选中的商品。特殊声明、明确限制及其他已保存资料不被普通编辑器覆盖。'},
 {id:'unlink',title:'取消关联',description:'取消关联回到没有该型号确认依据，不等于明确不适用。',operation:'在编辑窗口取消勾选并采用替换方式保存，或在列表点击取消关联并确认。',result:'不删除商品或设备，不修改其他商品及冻结清单。已存在明确不适用记录时，普通新增不会覆盖。'},
 {id:'sale',title:'在权益包选购中使用',description:'商城沿用已有设备选择与商品清单。',operation:'进入权益包选购，选择设备后自由组合或采用已有权益包，点商品＋加入，再填写数量和报价。',result:'适用关系集中维护一次；公共池共享商品仍按正式适用结果核验。维护返回保留输入，确认历史保持冻结。'}
]
export const compatibilityManuals:Record<string,GuideManualContent>={'page-compatibility':{purpose:'集中维护商品与设备型号的直接关联，操作只需选择和保存。',features,restrictions:[]}}
export const compatibilityArticles:GuideArticle[]=[{id:'manual-compatibility',title:'兼容性管理',kind:'page',summary:'关系查询、商品与型号多选、批量新增/替换和取消关联。',aliases:['/compatibility','适用设备'],pageIds:['page-compatibility'],actionIds:[],ruleIds:[],related:[],sections:features.map(f=>({id:f.id,title:f.title,paragraphs:[f.description,f.operation,f.result]}))}]
