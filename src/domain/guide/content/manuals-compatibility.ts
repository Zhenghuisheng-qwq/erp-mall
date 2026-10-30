import type {GuideArticle,GuideManualContent,GuidePage} from '../types'
const features=[
 {id:'compat-product',title:'给商品添加适用设备',description:'左侧按分类和产品类型查找真实销售 SKU，未维护的商品也能找到。',operation:'在商品适用台账选择配件 SKU，多选明确型号，填写一次共同依据后点“保存适用资料”。SPU 分组可明确选择本组实际 SKU。',result:'同一商品资料被多个权益包复用；取消勾选可选择删除声明或明确不适用，未勾选本身不代表不适用。',primary:true},
 {id:'compat-general',title:'维护通用适用条件',description:'明确型号和通用条件可同时存在。设备类型只限制范围，不能单独证明适用。',operation:'展开“通用适用条件”，添加设备类型、必要参数等于/属于指定值、结论、核验状态与资料依据。',result:'已核验且必要条件能够证实满足才进入正常候选；未知保持待核验，明确不适用及冲突继续阻断。',primary:true},
 {id:'compat-preview',title:'区分未保存预览与已保存结果',description:'选择实际设备提供规格事实；只选择型号时缺少的事实保持未知。',operation:'在下方选择预览设备，切换“未保存预览”或“当前已保存结果”。保存前检查必要条件和销售准入。',result:'两个视角都调用正式查询；预览不写入数据。基本使用与快充分别核验。'},
 {id:'compat-device',title:'从设备查询可用商品',description:'正向维护和反向查询读取同一份关系。',operation:'切换“按设备查询”，选择实际设备；默认按产品类型查看已确认且可售商品，其他原因在次要视角查看。',result:'停售是销售状态，待核验是资料不足，明确不适用是有效排除依据，三者含义不同。',primary:true},
 {id:'compat-sale',title:'在权益包中实际选购',description:'权益包只保存参与的产品类型，不绑定兼容关系。',operation:'在权益包选购选择设备、选包或自由组合，添加可用商品并填写数量和报价。适用详情可到同一工作台维护，再返回选购。',result:'返回刷新候选并保留未保存数量与报价；加入手机需明确点击。保存失败保留输入；确认清单冻结当时资料。'},
 {id:'compat-guard',title:'保存、权限与历史保护',description:'查看候选和维护资料分别授权。',operation:'批量资料核对后统一保存；失败保留输入重试。关闭、离开和刷新会保护未保存修改。',result:'不部分提交，不自动改写已有结论或历史确认清单；切换身份清理工作台编辑。'}
]
export const compatibilityPages:GuidePage[]=[{id:'page-compatibility',title:'兼容性管理',patterns:['/compatibility'],articleId:'manual-compatibility',actionIds:[],formal:true}]
export const compatibilityManuals:Record<string,GuideManualContent>={'page-compatibility':{purpose:'在一个工作台维护商品适用资料、预览结果及按设备反向查询。',features,restrictions:[]}}
export const compatibilityArticles:GuideArticle[]=[{id:'manual-compatibility',title:'兼容性管理',kind:'page',summary:'商品台账、明确型号、通用条件、实际设备查询与权益包选购。',aliases:['适用设备','可用配件','通用条件'],pageIds:['page-compatibility'],actionIds:[],ruleIds:[],related:[],sections:features.map(f=>({id:f.id,title:f.title,paragraphs:[f.description,f.operation,f.result]}))}]
