import type {GuideArticle,GuidePage,GuideManualContent} from '../types'
const features=[
 {id:'bundle-create',title:'创建一个产品类型组合',description:'权益包只保存名称、管理归属和明确选择的产品类型，不维护型号适用规则。',operation:'在权益包管理选择归属分类，新建并勾选手机、膜、充电器等需要参与的类型，再保存。',result:'没有商品的合法类型也可保存；以后新增同类型合格商品无需重新组包。',primary:true},
 {id:'bundle-cross',title:'跨分类复用公用产品类型',description:'归属分类只决定管理位置。',operation:'切到全目录，搜索分类或类型；可批量勾选分类下类型，再从已选列表单项移除。',result:'隐藏、搜索、切分类不清空已选项。保存的是具体类型；以后新增类型不会自动加入。'},
 {id:'bundle-free',title:'没有权益包也能自由组合',description:'自由组合与按权益包选购共用商品查询、报价和保存。',operation:'在权益包选购选自由组合，选择分类和本次类型；或切到按权益包选购，选择启用的包。',result:'自由组合不会自动创建永久模板；保存清单保留本次类型集合。',primary:true},
 {id:'bundle-device',title:'客户已有手机，只买配件',description:'本次使用设备与本次购买商品分开。',operation:'选择已有设备的实际规格或标准型号，只勾选需要的配件类型。购买手机时须包含手机类型并明确点击加入手机。',result:'选择设备不会自动购买；型号不能凭空生成销售手机。'},
 {id:'bundle-empty',title:'为什么商品没有出现',description:'正常候选必须真实可售，并满足当前设备的正式基本适用依据。',operation:'核对是否暂无建档、无可售规格、无已确认适用依据或条件待核验；搜索无结果时清空关键词。',result:'无声明不等于明确不兼容；未知必要条件不能作为可用证明。快充与基本使用分开。'},
 {id:'bundle-maintain',title:'维护公用商品的适用资料',description:'同一充电器可维护多个标准设备型号，无需复制商品。',operation:'有权限时从管理诊断打开兼容性，核对配件和设备上下文，维护后返回权益包。',result:'返回重新计算候选，当前清单数量与报价保留；供应商依据仍由正式兼容性维护。'},
 {id:'bundle-price',title:'报价、保存与确认',description:'数量须为正整数，价格最多两位小数；空白是未报价，0 是免费。',operation:'添加商品后填写数量、单价，保存草稿；补齐报价后确认。通过已保存清单再次打开。',result:'失败保留输入；草稿刷新可恢复。切换设备或类型有移除影响时先确认，取消保持原内容。',primary:true},
 {id:'bundle-history',title:'确认清单为什么只读',description:'确认冻结设备身份、商品名称规格、报价和当时适用依据。',operation:'历史确认清单只读；需要再次购买时复制为新草稿，按当前资料重新核对。',result:'后来改名、停售、改适用关系或停用模板都不会改变确认快照。'}
]
export const bundlePages:GuidePage[]=[{id:'page-type-bundles',title:'权益包管理',patterns:['/benefits/manage'],articleId:'manual-type-bundles',actionIds:[],formal:true},{id:'page-bundle-sale',title:'权益包选购',patterns:['/benefits/shopping'],articleId:'manual-bundle-sale',actionIds:[],formal:true}]
export const bundleManuals:Record<string,GuideManualContent>=Object.fromEntries(bundlePages.map(p=>[p.id,{purpose:'配置明确的产品类型组合，再按本次设备和正式适用资料选购真实商品。',features,restrictions:[]}]))
export const bundleArticles:GuideArticle[]=bundlePages.map(p=>({id:p.articleId,title:p.title,kind:'page',summary:'跨分类组包或自由组合；设备适用、商品准入与销售清单分别维护。',aliases:[...p.patterns,'自由组合','公用配件'],pageIds:[p.id],actionIds:[],ruleIds:[],related:[],sections:features.map(f=>({id:f.id,title:f.title,paragraphs:[f.description,f.operation,f.result]}))}))

export const generalFeatures=[
 {id:'range-model',title:'维护专属型号',description:'专属膜、壳或供应商列出的明确型号，继续使用标准型号身份。',operation:'从 SKU 的适用设备 / 适用范围，或 SPU 明确勾选实际 SKU，进入兼容性商品适用范围，选择明确型号并使用已有多选维护。',result:'只影响已选择的 SKU，不自动覆盖其他接口规格，新建 SKU 不自动继承。',primary:true},
 {id:'range-general',title:'集中维护公用商品',description:'一件充电器只建档一次，权益包只引用它的产品类型。',operation:'在通用条件中选择目标 SKU、手机/平板/电脑等设备类型，添加供应商确认的必要参数条件，填写来源和核验状态。',result:'设备类型只是候选范围；裸勾电脑不能证明所有电脑适用，缺条件只能保存待核验。',primary:true},
 {id:'range-facts',title:'按明确设备事实试算',description:'当前支持稳定词典参数的等于、属于指定值；不执行供应商原文，不推测单位或数值能力。',operation:'选择真实设备或标准型号试算，查看条件满足、未满足、缺失资料和冲突依据。',result:'型号无法提供实际规格事实时保持未知。通用条件不满足只是不能提供证明，不自动视为整体不兼容。'},
 {id:'range-conflict',title:'分别核对基本使用与快充',description:'不同完整声明可以提供不同成立路径，生效的明确不适用不能被更宽的正向声明覆盖。',operation:'查看双方证据，按真实依据编辑明确记录；不要以最新一条覆盖其他来源。',result:'基本使用已成立而快充未知时仍可选基本使用；基本使用正反冲突阻止正常添加。'},
 {id:'range-return',title:'从销售诊断返回维护',description:'普通候选只显示实际可添加商品，管理诊断保留真实原因。',operation:'有权限时点查看适用资料，带入配件、设备和返回来源，维护后点返回权益包。',result:'候选重新计算，已选商品、数量和报价保留；无维护权限只能查看授权资料。'},
 {id:'range-history',title:'批量保存与历史证据',description:'保存前展示明确影响的 SKU、重复项和已有依据，试算显示设备冲突。',operation:'确认保存本次资料；失败保留输入重试，重复的完整声明跳过。',result:'一次原子保存不留半批。确认清单冻结当时的型号/通用依据、条件判断和能力结论，后续改删声明不改变历史。'}
]
