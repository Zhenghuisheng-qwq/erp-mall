import type { GuideArticle, GuideManualContent, GuidePage } from '../types'

export const salesOptionPages: GuidePage[] = [
  { id:'page-sales-shopping', title:'销售选购', patterns:['/sales-shopping'], articleId:'manual-sales-shopping', actionIds:['action-benefit-select','action-benefit-save','action-benefit-quote','action-benefit-deliver'], formal:true },
  { id:'page-sales-configurations', title:'选配方案', patterns:['/sales-configurations'], articleId:'manual-sales-configurations', actionIds:['action-business-save'], formal:true },
]
export const salesOptionManuals: Record<string, GuideManualContent> = {
  'page-sales-shopping': {
    purpose:'查找实际销售商品，按当前设备与推荐来源逐步选配，核对清单并保存销售方案或生成现有交付清单。',
    features:[
      {id:'sales-browse',title:'找商品并选规格',description:'按分类和关键词浏览商品，选择真实 SKU。',operation:'打开商品，核对规格后明确加入清单。',result:'查看商品或关联不会自动加购，也不会替换已有成员。',primary:true},
      {id:'sales-context',title:'为已有设备选购',description:'使用现有设备型号或实际手机作为适用判断对象。',operation:'选择使用设备；只购买配件时不加入手机实物。',result:'设备、当前查看商品和整份已选清单分别保存其含义。',primary:true},
      {id:'sales-next',title:'继续查看相关商品',description:'当前商品按已发布选配方案或直接商品关系展示下一批候选。',operation:'加入只改变清单；点击“查看相关”才切换到壳等来源，再按返回路径回到手机。',result:'保留原手机上下文；不递归自动展开或加购，循环关系不会生成无限清单。',primary:true},
      {id:'sales-members',title:'核对商品与服务',description:'实际商品仍使用现有组合的位置、数量与服务账本。',operation:'在位置上调整数量、更换或移除；来源被移除时，可明确重新选择有效来源。',result:'不静默删除其他商品；同 SKU 的不同用途位置保持独立。'},
      {id:'sales-save',title:'保存与重试',description:'有效清单修改立即显示，后台串行保存草稿。',operation:'直接编辑方案名称；Enter确认、Esc取消；“立即保存”提交最新输入或重试，不再重复命名。',result:'旧响应不覆盖新输入；正式保存、报价和交付仍有权限及修订检查。',actionIds:['action-benefit-save']},
      {id:'sales-common',title:'存为常用组合',description:'把本次实际清单保存为独立的收藏副本。',operation:'在当前工作区填写组合名称，再点击存为常用组合；失败后重试同一次请求。',result:'原方案与历史交付不变；使用常用组合创建新方案，URL随当前方案同步。'},
      {id:'sales-deliver',title:'核对报价并生成交付',description:'未知价格显示待报价，已有交付能力重新校验最新状态。',operation:'填写实际报价，核对条件和当前清单后生成交付；在交付页按权限导出。',result:'生成冻结清单，后续方案、绑定或商品变化不修改该历史清单。',actionIds:['action-benefit-quote','action-benefit-deliver']},
    ],
    restrictions:[
      {id:'sales-evidence',condition:'只有搭配推荐、适用依据缺失、条件未知或明确不适用。',effect:'这些状态分别显示，推荐不等于确认兼容；明确冲突不能正式交付。',resolution:'核对对应商品和实际用途，补充合法声明或满足具体条件。',warning:true},
      {id:'sales-framework',condition:'使用带旧选配框架的组合，或打开未知版本。',effect:'旧框架继续按其冻结规则调整现有清单，不叠加新的选配方案；未知版本只读。',resolution:'增补或更换旧框架成员使用高级详情；保留原版本，不强制转换。'},
      {id:'sales-origin',condition:'来源版本、绑定或选配方案失效，或者命中多个不同替换。',effect:'停止正式使用该配置，不以最新草稿或创建顺序猜测来源。',resolution:'由配置人员核对发布版本、范围与冲突；旧商品可明确绑定真实商品范围。'},
      {id:'sales-scope-limit',condition:'需要真实订单、付款、库存扣减或服务激活。',effect:'本入口仅为当前前端 Mock 的选购、组合与交付约定，不执行这些业务。',resolution:'使用实际业务系统处理订单、支付、库存与履约。'},
      {id:'sales-conflict',condition:'其他入口修改了当前方案，或操作者、权限已变化。',effect:'受控保存拒绝陈旧或越权提交，保留本地输入供核对。',resolution:'核对最新已保存内容和当前身份后重试，不自动覆盖其他操作。'},
    ],
  },
  'page-sales-configurations': {
    purpose:'维护可复用选配项目和冻结版本，把方案明确绑定到模型发布范围或真实商品范围。',
    features:[
      {id:'options-plan',title:'维护选配方案',description:'配置名称、选配项目及真实产品类型、SPU、SKU 或服务范围。',operation:'创建或复制方案，按需展开数量、必选、依赖、互斥等高级设置。',result:'保存选择范围和规则，不枚举所有 SKU 配对，不生成商品或固定套餐。',primary:true},
      {id:'options-publish',title:'发布并管理版本',description:'草稿编辑与已发布方案分别保留。',operation:'发布新版本；查看引用范围，再明确预览、更新所选绑定。',result:'旧绑定仍指向原版本；停用后不能成为新的正式选购依据。',primary:true},
      {id:'options-bind',title:'绑定模型与节点范围',description:'独立页和模型的“搭配与适用”共用同一方案与绑定记录。',operation:'选择方案及版本，核对合法规格数、当前真实 SKU 数、样本与未解析来源；确认应用到已发布范围。',result:'工作草稿按操作者与基础修订独立保存，只有明确应用才改变正式绑定；保存草稿不会停用现有配置。',primary:true},
      {id:'options-rules',title:'设置替换或不使用',description:'模型默认方案、明确范围完整替换、不使用三种结果独立于旧适用声明。',operation:'为属性值或明确条件范围选方案；属性节点必须进一步明确范围。',result:'同方案同版本重复可去重；不同结果冲突阻止正式应用，不按深度或顺序取胜。'},
      {id:'options-relations',title:'维护商品推荐与直接适用',description:'真实 SKU 之间的推荐关系与直接适用证据分开维护。',operation:'选择来源和目标商品，填写来源及条件，按权限保存。',result:'推荐只带出下一批候选；直接适用仍需已确认的依据和满足的条件。'},
    ],
    restrictions:[
      {id:'options-draft',condition:'来源是模型草稿或无法准确解析的旧商品。',effect:'草稿配置只供预览，不能成为正式适用依据；不按名字补关联。',resolution:'选择明确发布版本，或为旧商品明确选择真实 SPU/SKU 范围。',warning:true},
      {id:'options-cross',condition:'模型包含同级相乘的属性。',effect:'范围按完整合法组合计算，画面可见子树数量不能代替实际覆盖范围。',resolution:'核对独立显示的合法规格数和销售 SKU 数，并查看覆盖样本。'},
      {id:'options-compat',condition:'绑定方案或设置“不使用”。',effect:'只改变选配展示，不新增兼容结论，也不会取消现有兼容限制。',resolution:'具体适用依据在商品关联与适用关系中按真实对象维护。'},
      {id:'options-frozen',condition:'方案新版本或候选目录增加商品。',effect:'新选购按有效绑定动态查询；旧销售方案和交付清单不会自动增加商品。',resolution:'明确预览版本更新影响；需要采用时更新相应绑定。'},
    ],
  },
}
export const salesOptionArticles: GuideArticle[] = salesOptionPages.map(page => {
  const manual=salesOptionManuals[page.id]!
  return {id:page.articleId,title:page.title,kind:'page',summary:manual.purpose,aliases:[page.title,...page.patterns],pageIds:[page.id],actionIds:page.actionIds,ruleIds:[],related:['manual-benefits','manual-specs'],sections:[
    {id:'steps',title:'操作流程',steps:manual.features.map(feature=>feature.operation)},
    {id:'results',title:'结果',paragraphs:manual.features.map(feature=>feature.result)},
    {id:'rules',title:'限制',paragraphs:manual.restrictions.map(rule=>`${rule.condition}${rule.effect}${rule.resolution}`)},
  ]}
})
