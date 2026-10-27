import type { GuideFeatureRow, GuideManualContent, GuideRestrictionRow } from '../types'
import {benefitWorkflowDetails} from './manuals-sales-options'

// These rows are authored against the sales views and their actual save commands.
const f = (id:string,title:string,description:string,operation:string,result:string,flags:Pick<GuideFeatureRow,'primary'|'risk'|'actionIds'>={}):GuideFeatureRow => ({id,title,description,operation,result,...flags})
const r = (id:string,condition:string,effect:string,resolution:string,flags:Pick<GuideRestrictionRow,'ruleIds'|'warning'>={}):GuideRestrictionRow => ({id,condition,effect,resolution,...flags})

function packageFeatures(prefix:string):GuideFeatureRow[] { return [
  f(`${prefix}-device`,'选择适配设备','用具体主机 SKU 或已确认型号判断配件适用性，也可不指定设备。','在“适配设备”选择对象；包内已有手机时，明确选择“仅更换适配对象”或“同时替换包内手机”。','选择型号不加入实物；只有“包含这台手机”等明确操作才加入手机商品。',{primary:true}),
  f(`${prefix}-framework`,'应用选配框架','使用独立框架的类型范围、必选、种类数与件数规则。','在“选配框架”选择可用修订，点击“预览并应用框架变更”核对影响。','当前包保存所用框架修订；改用新框架不会静默替换已有成员。'),
  f(`${prefix}-candidates`,'搜索并选配商品','按实际在售销售 SKU 选配，候选随商品和正式适用关系变化。','先选具体设备 SKU 或明确型号，在“适用销售配件／其他商品”查看状态，选目标组后加入；用搜索和分页定位商品。','推荐必须有正式基本适用；仅快充资料不能替代。附条件和待核验项目可作为待处理草稿，明确排除、停售或失效不允许新加入。',{primary:true,actionIds:['action-benefit-select']}),
  f(`${prefix}-members`,'调整、替换和折叠成员','维护每包数量、移除成员或替换具体 SKU。','在“包内清单”调整数量，选择“替换”后明确确认；用“收起全部成员／展开全部成员”切换。','旧组合仍按原 SKU 明细读取；新位置组合只在同组重复加入时增量，不同组的同 SKU 分别保留数量、价格和位置 ID。'),
  f(`${prefix}-group-relations`,'处理组间依赖和互斥','在冻结的新位置框架中按组 ID 校验规则。','点击“已选 A，需要补选 B”等问题定位目标组；互斥时明确移除或替换其中一组商品。','不自动加件或删件。缺依赖可先保留草稿，可用配置与正式交付必须通过有效规则。'),
  f(`${prefix}-position-counts`,'核对位置与 SKU 汇总','同 SKU 不同位置分别记录实际件数及参考单价。','在包内清单按组改数量、价格或替换具体位置；预览核对位置明细与 SKU 汇总。','汇总数量是所有位置相加，服务单独计量；未填参考价与 0 元不同，不取第一条位置价格统一计价。'),
  f(`${prefix}-conditions`,'确认附带条件','为当前设备和具体商品记录已核对的使用前提。','在成员的条件确认区域填写说明并确认；有问题时点击问题项定位输入。','只确认当前包的条件，不改写全局声明；待确认或不适用不能冒充正常适用。'),
  f(`${prefix}-services`,'添加服务约定','填写服务名称、数量、单位、有效期和说明。','打开添加服务弹窗，选择“每包”或“本次一次性”计量并确认加入。','每包服务随包数相乘；本次一次性服务整次只计一次，填写弹窗不等于已加入包。'),
  f(`${prefix}-reference`,'记录人工参考价','分别记录实物或服务的参考单价及行金额。','在对应成员或服务的“本次人工参考单价”填写金额。','空白是未记录，0 元是免费；参考合计不改全局售价，也不自动成为整包报价。'),
  f(`${prefix}-quote`,'填写并复核整包报价','保留独立的每包人工报价，并与参考合计对照。','在报价区输入金额；成员、数量或参考价变化后重新核对并确认报价。','差额按参考合计减报价计算，允许报价高于参考合计而出现负差额；非法金额会拒绝，依据变化后需再复核。',{actionIds:['action-benefit-quote']}),
  f(`${prefix}-draft`,'保存草稿','保留尚待补齐的配置供继续编辑。','点击底部“保存草稿”；服务弹窗有未确认输入时先确认加入或明确放弃。','真实包配置写入本机；缺成员等业务问题可保留，但损坏结构、非法数量或金额仍会拒绝。',{primary:true,actionIds:['action-benefit-save']}),
  f(`${prefix}-save`,'保存为可用并预览交付','把当前完整配置保存为可用权益包。','点击“保存权益包”；需要紧接交付时选择“保存并预览交付”。','先校验范围、成员、数量和适配，再保存修订；保存并预览仍不等于已生成清单。',{primary:true,actionIds:['action-benefit-save']}),
] }
function packageRestrictions(prefix:string):GuideRestrictionRow[] { return [
  r(`${prefix}-identity`,'选择 SPU、PLN、MAT，或已失效／非在售的 SKU。','包内实物必须是实际销售 SKU；失效原条目保留，但不能将受影响配置保存为可用或生成新清单。','选择有效销售 SKU，修正缺失引用；不要把物料声明自动当作 SKU 声明。',{ruleIds:['rule-benefit-validation','rule-identity-separation'],warning:true}),
  r(`${prefix}-range`,'成员在框架组外，必选、种类数或每种件数不满足。','不满足范围时不能保存为可用或交付。旧框架仍唯一归组；新位置框架必须明确目标组，一件商品不重复抵扣两个组。','点击问题定位到对应成员或框架组，调整真实商品与数量，再保存。',{ruleIds:['rule-framework-members','rule-benefit-validation']}),
  r(`${prefix}-compatibility`,'基本适用证据不足，或商品只有快充等单项能力声明。','不能作为普通基本适用推荐；附条件、待确认与不适用分别显示。','补齐正式基本声明；附条件按当前依据确认，不能用包内确认覆盖明确不适用。',{ruleIds:['rule-compatibility-binding','rule-benefit-validation']}),
  r(`${prefix}-price`,'参考价、成员、数量、设备或适配依据改变。','旧报价复核和交付预览可能失效；输入的报价仍保留为待复核参考。','先保存当前配置并明确复核报价，再重新预览本次交付。',{ruleIds:['rule-benefit-quote','rule-benefit-preview']}),
  r(`${prefix}-flat-scope`,'需要多台独立主机的配件分配、组合递归或生产执行。','本轮只有一个主适配对象和平面选配，不执行生产、支付、库存或服务激活。','把当前结果作为前端 Mock 的组成与交付约定，不当作完整生产 BOM。'),
  r(`${prefix}-save-failure`,'本机写入失败，或当前包已有更新的修订。','不能显示保存成功，也不能按旧修订继续生成；当前输入和请求保留。','写入恢复后重试当前请求；修订变化时先保留草稿，再明确读取并核对最新配置。',{ruleIds:['rule-persistence','rule-conflict']}),
] }

export const salesManuals:Record<string,GuideManualContent> = {
  'page-spus': {
    purpose:'以商品主体管理 SPU，查看其真实销售 SKU，并分别维护主体状态、展示视图与物料入口。',
    features:[
      f('spus-create','新建 SPU','先建立商品主体，可以暂时没有 SKU。','点击右上角“新建 SPU”，在新增页填写名称、分类等资料并保存。','只创建主体；需要销售规格时再新增 SKU。',{primary:true,actionIds:['action-spu-save']}),
      f('spus-edit','查看和编辑 SPU','查看主体资料并维护当前允许修改的信息。','点击商品名称或行内“编辑”，进入 SPU 详情表单。','在详情页明确保存，不是在列表单元格直接输入商品资料。',{primary:true,actionIds:['action-spu-save']}),
      f('spus-append-sku','向指定 SPU 追加 SKU','给现有主体分批增加真实销售规格。','在对应行点击“新增 SKU”；进入创建页预览并确认本次新增范围。','新 SKU 归属该 SPU，保留已有 SKU 与物料。',{primary:true,actionIds:['action-sku-preview','action-sku-save']}),
      f('spus-expand-skus','展开查看真实销售 SKU','查看该主体下全部真实销售 SKU 的名称、编码、完整规格、状态和 OA 编号。','点击行首展开箭头，在下属 SKU 表格中核对。','展开表只列销售 SKU；MAT 物料不计入 SKU 数量，空主体显示暂无真实 SKU。',{primary:true}),
      f('spus-sku-range','按 SKU 数量进入主体范围','在独立 SKU 管理中查看这个主体的规格。','点击“SKU 数量”列中的数字。','进入带当前 SPU 范围的 SKU 管理；该临时范围不会覆盖全部 SKU 的视图配置。'),
      f('spus-query','关键词、分类和更多筛选','按名称、分类、属性、SKU 或 OA 编号等组合查找主体。','输入关键词；在分类树选择分类；打开“更多筛选”添加真实字段条件。','主体总数按筛选结果计算；父分类范围含下级，复杂条件在更多筛选中管理。',{actionIds:['action-spu-query']}),
      f('spus-category-layout','展开与收起分类树','按真实分类 ID 查询本级和全部后代。','顶部“商品分类”展开左树，树头“收起”释放宽度；窄屏通过面板查看。','展开收起只改布局，条件标签仍保留。旧精确分类保持仅该分类，明确重选或转换后才包含后代。'),
      f('spus-quick-values','清值与取消外露','外露控件和生效条件分别维护。','常用筛选可展开全部；清除外露值保留控件，取消外露只隐藏控件，清空全部筛选按原规则执行。','不修改词典或商品。未外露高级条件、独立搜索和临时范围不受清除外露值影响。'),
      f('spus-brand-sources','区分两种品牌筛选','“商品品牌汇总”与“规格属性 · 品牌”读取不同字段。','在快捷条件或“更多筛选”中按带来源的字段名称选择。','商品品牌优先读主体公共品牌，缺失的 V3 可从已发布物料来源汇总；规格属性品牌读取公共属性及真实 SKU 属性，不因名称相同合并。'),
      f('spus-clear-filters','清除单项或全部筛选','移除当前不需要的条件。','点击已生效条件标签的关闭按钮；点击“清空筛选”清除关键词和字段条件。','只改变当前视图的查询配置，不删除商品；分组和排序分别在列表设置中调整。'),
      f('spus-switch-view','切换已保存视图','使用各自保存的列、筛选、分组和排序。','点击顶部视图标签；更多视图可搜索和切换全部已保存视图。','切换展示配置，不复制商品；有未提交排序暂存时需先确认是否清空暂存。',{actionIds:['action-spu-view']}),
      f('spus-layout','配置列、分组和排序','控制列显示与顺序、分组方向和默认／字段／手工顺序。','点击“列表设置”，勾选列、拖动字段顺序，选择分组与排序。','当前 SPU 视图配置自动保存在本机；恢复默认列只重置当前模式的列。',{actionIds:['action-spu-view']}),
      f('spus-view-management','另存及管理视图','保存独立展示方案，或维护已有视图名称和筛选预设。','用视图管理菜单新建、改名、复制或删除视图；已存筛选仍是独立的筛选预设。','另存当前实现直接复制成独立视图；视图设置可改名、复制、删除允许删除的视图，商品不会随视图删除。',{actionIds:['action-spu-view']}),
      f('spus-manual-order','手工排序与跨页暂存','把多个主体按指定顺序插到另一行前后。','切到手工排序；拖动行首手柄到目标上半区／下半区可插到前／后，行“更多”可本组或当前结果置顶／置底。跨页用排序专用勾选加入暂存，再到目标行插入。','有分组时仅在当前完整匹配结果的同一最末级组内调整；跨组整批拒绝并保留暂存。SPU 顺序自动保存，写盘成功后才显示已保存。'),
      f('spus-batch-shelf','批量发布或下架主体','调整勾选 SPU 的商品状态。','勾选普通选择列，在批量区点击“批量发布”或“批量下架”。','改变所选主体状态；不会同时把下属 SKU 改成在售，严格模式还需相应发布授权。'),
      f('spus-batch-delete','批量删除空主体','删除确认允许的多个空 SPU。','勾选后点击“批量删除”，核对提示再确认。','任一所选主体已发布或还有 SKU／MAT 时先拒绝；不会级联清理子记录。',{risk:true,actionIds:['action-spu-delete']}),
      f('spus-delete','删除单个 SPU','移除符合条件的空主体。','行内“更多→删除”，确认空主体删除。','已发布先下架；无子记录和受保护关系的空草稿或已下架主体可删除，空草稿无需先经历下架。',{risk:true,actionIds:['action-spu-delete']}),
      f('spus-copy','复制允许的 SPU','将普通主体资料带入新建草稿。','非 V3 主体选择“更多→复制 SPU”，核对新建表单并另行保存。','产生新主体身份且不自动复制其 SKU；V3 行会提示到对应规格继续创建物料，不支持整款复制。'),
      f('spus-materials','物料建档与管理物料','分别进入正式／临时建档及已有 V3 物料档案。','顶部“物料建档”；V3 行“更多→管理物料”。','MAT 与销售 SKU 分开维护；“物料 N · 关联规划 M”仅为去重汇总，不证明每条 MAT 的具体 PLN 对应。',{actionIds:['action-material-create','action-material-edit']}),
      f('spus-compatibility','查看适用配件或主机','按主体身份进入相应查询或物料适用维护。','有真实 SKU 的主机行“更多→适用配件”；其他 V3 行按身份显示适用主机或适用配件入口。','入口随主机／配件、V3 和真实 SKU 条件显示；销售 SKU 与 MAT 的正式声明分别保留。'),
      f('spus-child-edit','编辑、改状态或删除下属 SKU','在展开表中维护具体规格商品。','点击 SKU 的“编辑”；状态下拉改单条，勾选后改所选在售／停售；删除需确认。','SKU 删除保留 SPU，并检查适用关系、设备绑定、物料关系及当前权益包引用。',{actionIds:['action-sku-save']}),
      f('spus-child-copy','复制下属规格草稿','使用非 V3 主体中现有 SKU 的规格作为新增起点。','展开非 V3 主体，点击 SKU 行“复制”。','进入新增 SKU 预览；不会原地复制出新记录，重复规格仍受去重检查，V3 展开表不显示该按钮。'),
    ],
    restrictions:[
      r('spus-delete-state','本页尝试删除已发布 SPU。','单删和批量删除都会拒绝；草稿与已下架不是同一状态，但空草稿不必先下架。','已发布主体先下架，再核对是否为空；只对允许的记录明确确认删除。',{ruleIds:['rule-spu-reference'],warning:true}),
      r('spus-delete-children','主体下仍有任何真实 SKU 或 MAT。','主体删除不级联，必须先处理实际子记录；有关联的 SKU／MAT 还会受到其引用保护。','到 SKU 管理或物料、适用关系及权益包维护相应引用，再回本页删除空主体。',{ruleIds:['rule-spu-reference']}),
      r('spus-v3-copy','对 V3 主体点击复制 SPU。','当前入口明确不做整款复制，避免复制原物料和历史来源。','回模型或完整规划创建所需物料；独立销售规格通过新增 SKU 流程追加。',{ruleIds:['rule-identity-separation']}),
      r('spus-counts','看到“物料 2 · 关联规划 1”等数量。','两个数字分别按 MAT ID、实际完整 PLN ID 去重；不能仅凭汇总推断两个 MAT 都来自同一 PLN。','展开物料来源查看逐条关系；完整编号和原始来源以档案及发布版本为准。',{ruleIds:['rule-identity-separation']}),
      r('spus-save-scope','调整列表配置或进入新建／编辑表单。','SPU 视图的查询、列、分组、排序自动保存到当前本机视图；业务表单须点击保存，两种保存互不替代。','先确认正在改展示还是业务记录；写盘失败按页面提示重试，不能把未落盘修改当成功。',{ruleIds:['rule-view-isolation','rule-persistence']}),
    ],
  },
  'page-spu-create':{
    purpose:'独立创建商品主体，保存后可继续向同一 SPU 追加销售 SKU。',
    features:[
      f('spu-create-basics','填写主体资料','维护 SPU 名称、分类、可选 OA 编号和产品类型。','填写表单，选择分类；所选产品类型必须属于该分类。','名称与分类有效即可先保存空主体，OA 编号可空。',{primary:true,actionIds:['action-spu-save']}),
      f('spu-create-scheme','选择模型、方案与公共属性','明确后续 SKU 录入的属性依据。','选择“模型／方案”；有发布版本时选择版本，再填对应公共属性。','模型归属产品类型，绑定版本只接受该模型已发布版本；保存空 SPU 不会生成规格。'),
      f('spu-create-state','设置商品状态','选择草稿、已发布或已下架。','在“商品状态”选择后随主体保存。','这是主体状态，不代替 SKU 的草稿／在售／停售；严格模式发布另受发布权限保护。'),
      f('spu-create-save','保存或保存并新增 SKU','明确提交本次主体草稿。','点击“保存”进入主体详情；点击“保存并新增 SKU”先保存主体，再进入追加页。','只有保存成功才分配并保留主体身份；已有商品不因同名合并。',{primary:true,actionIds:['action-spu-save']}),
      f('spu-create-cancel','取消与未保存离开','放弃或继续当前本地表单输入。','点击取消或其他业务入口时，处理未保存确认。','未确认保存的表单不会自动成为 SPU；查看页面功能不丢失输入。'),
    ],
    restrictions:[
      r('spu-create-input','名称为空、分类失效，或类型与分类不一致。','保存被拒绝，原输入保留。','补齐名称并重选有效分类、类型；同名不作为自动合并依据。',{ruleIds:['rule-spu-input']}),
      r('spu-create-version','模型、方案或发布版本已不存在，或模型不属于所选类型。','不能把不一致的来源写入新主体。','选择真实方案及其已发布版本；追加 SKU 前补齐方案与公共信息。',{ruleIds:['rule-spu-identity']}),
      r('spu-create-failure','本机写入失败。','主体候选没有提交，表单保持可编辑。','保留输入，恢复本机保存后重试；不要把打开新增页当成创建成功。',{ruleIds:['rule-persistence']}),
    ],
  },
  'page-spu-edit':{
    purpose:'查看主体的实际归属、销售 SKU 和绑定历史，维护允许修改的主体资料。',
    features:[
      f('spu-edit-save','编辑主体并保存','维护名称、OA 编号和主体状态。','修改详情表单，点击“保存”；“保存并新增 SKU”先保存再进入追加。','只提交当前主体，不整体替换下属 SKU 或物料。',{primary:true,actionIds:['action-spu-save']}),
      f('spu-edit-identity','核对或设置身份信息','核对分类、类型、模型／方案、版本和公共属性。','在表单中查看；只有尚未被子记录或来源锁定时可修改这些字段。','已有 SKU、物料或历史关联时保留身份，不通过改名或换方案重生成旧记录。'),
      f('spu-edit-children','查看和追加销售 SKU','查看当前 SPU 的真实销售规格及其归属。','使用“管理 SKU”进入范围列表、“新增 SKU”追加，或点击下属 SKU 名称编辑。','MAT 不计入销售 SKU；暂无 SKU 的主体仍可保留。',{primary:true,actionIds:['action-sku-save']}),
      f('spu-edit-materials','管理已有物料','单独查看 V3 主体的物料档案。','V3 主体使用“管理物料”入口。','进入真实 MAT 档案，物料与销售 SKU 的维护页面分开。'),
      f('spu-edit-history','查看绑定的历史快照','核对创建依据的模型版本和节点。','有绑定版本时点击“查看历史快照”。','显示该主体绑定版本，不自动切到最新发布版本。',{actionIds:['action-spu-history']}),
      f('spu-edit-compatible','查看主机适用配件','以主体下真实主机 SKU 查询正式适用结论。','主体身份为主机且有销售 SKU 时点击“适用配件”。','适用关系与在售状态分开；MAT 结果不自动充当销售配件。'),
      f('spu-edit-benefits','按具体规格查看关联权益包','区分可使用配置、列为可选项目和已经包含该 SKU 的权益包。','在“关联权益包”查看下属 SKU 概览并切换具体规格，按权限查看配置、开始选购或使用可用组合。','只对当前明确 SKU 解释关系；部分规格有关联不表示整个 SPU 全部适用，查看和切换不会创建或修改权益包。',{primary:true}),
    ],
    details:benefitWorkflowDetails('product'),
    restrictions:[
      r('spu-edit-lock','主体已有 SKU、物料、规划来源、公共身份签名或相关适用关系。','分类、类型、模型版本和公共属性被锁定；名称、编号及状态仍可维护。','其他身份需要新建 SPU；不要改写历史记录来容纳新规格。',{ruleIds:['rule-spu-identity']}),
      r('spu-edit-stale','原主体已删除或保存失败。','不会用编辑草稿重新创建已删除主体；写入失败不替换已保存记录。','保留输入并回列表核对对象，恢复存储后再明确保存。',{ruleIds:['rule-spu-input','rule-persistence']}),
    ],
  },
  'page-skus':{
    purpose:'独立查询和维护真实销售 SKU，使用各自保存的视图配置与临时 SPU 范围。',
    features:[
      f('skus-create','新增与编辑 SKU','为明确主体追加规格，或维护已有规格商品。','右上“新增 SKU”；对应行“编辑”。','新增先选择 SPU 并预览确认；编辑只针对这一条真实 SKU。',{primary:true,actionIds:['action-sku-save']}),
      f('skus-filter','搜索与组合筛选','按关键词、分类、SPU 和真实字段查询。','使用搜索框、分类树、快捷条件或“筛选”；从摘要标签编辑或清除条件。','搜索词不保存到视图；高级 AND／OR 与父分类包含下级的含义保留。',{primary:true,actionIds:['action-sku-query']}),
      f('skus-category-layout','展开与收起分类树','父分类范围按当前分类树动态包含全部后代。','顶部“商品分类”展开左树，树头“收起”恢复入口；窄屏打开覆盖面板。','旧 eq/in 仍精确匹配；高级 AND/OR 不压平成树选择。布局先写工作配置，保存视图后才更新正式配置。'),
      f('skus-quick-values','外露筛选的清值与隐藏','以同一条件 ID 维护常用控件。','清除外露值保留控件并暂停该约束；重新填写后生效。取消外露只隐藏，原条件继续查询。','停用条件和没有有效子条件的组不参与 AND/OR；未外露条件、搜索及临时 SPU 范围保留。'),
      f('skus-summary','查看并复制完整规格','以两行摘要扫读长名称与规格。','点击规格摘要的完整查看入口，在弹层逐项查看并复制。','只复制显示内容，不截断保存数据，也不从摘要推导 SKU 身份。'),
      f('skus-spu','查看所属 SPU 与临时范围','在主体范围与全部 SKU 之间切换。','点击所属 SPU 名称，或使用“筛选所属 SPU”和“查看全部 SKU”。','临时范围使用独立工作配置；另存时可明确把范围保存成条件。'),
      f('skus-views','保存、另存和恢复视图','将当前工作配置保存为可复用规则。','当前视图入口切换；用“保存视图／另存为／恢复已保存配置”。','工作配置可保存在本机并显示“未保存”；保存视图才更新已命名视图配置，系统“全部 SKU”需另存。',{primary:true,actionIds:['action-view-save','action-view-restore']}),
      f('skus-view-management','管理常用和默认视图','维护新建、改名、复制、删除、收藏及默认入口。','点击顶部标签，或在“更多视图”搜索；用视图管理菜单维护默认、收藏及常用顺序。','只管理 SKU 页面视图，不复制或删除商品；系统视图不能删除或改名。'),
      f('skus-display','字段、分组、排序与密度','管理列宽／自动、冻结、字段顺序、多层分组和多项排序。','打开“列表设置”，在字段、分组、排序、显示分区调整，再应用配置。','最多两列冻结、两层分组和三项字段排序；窄屏可能临时不冻结，保存设置仍在。'),
      f('skus-selection','勾选与批量状态','跨页保留所选销售 SKU，并批量改在售或停售。','用普通选择框或“全选本页”，在批量区操作；可“取消选择”。','选择数与当前页结果数分开；查询配置失效时暂停批量操作。'),
      f('skus-delete','删除单条或所选 SKU','明确删除允许移除的销售规格。','行“更多→删除”或勾选后“批量删除”，确认提示。','保留所属 SPU；有关联、绑定或权益包引用时需先处理保护。',{risk:true}),
      f('skus-compatible','适用关系与组权益包','按主机／配件身份双向查询，并由主机开始组包。','行“更多”中的“适用配件／适用主机”；真实主机且有创建权限时显示“组权益包”。','查询和维护不会把同名、同 SPU 或同 PLN 的 MAT 自动转为 SKU 声明。'),
      f('skus-manual','手工排序与跨页插入','维护真实 SKU 的展示顺序。','切到手工排序，可保留分组及暂不生效的字段排序规则。拖动行首手柄按上下半区插到前后；更多菜单可本组／当前结果置顶置底；暂存支持跨页插入。','仅操作完整筛选结果的同一最末级组，两层分组按完整路径区分；跨组或来源变化整批拒绝且保留暂存。成功后更新工作配置，保存视图才更新命名配置。',{actionIds:['action-sku-manual-order']}),
    ],
    restrictions:[
      r('skus-real-records','只有 SPU、PLN 或 MAT，没有真实销售 SKU。','列表不会把这些对象当 SKU 展示，数量口径也不混算。','先在明确的 SPU 中按实际来源新增 SKU。',{ruleIds:['rule-sku-identity']}),
      r('skus-invalid-view','保存的字段或高级条件引用失效。','显示具体错误并暂停查询、批量操作；不静默丢弃旧条件。','在筛选中修复、恢复已保存配置，或明确重建工作配置。',{ruleIds:['rule-view-conditions']}),
      r('skus-delete-ref','SKU 仍被当前权益包、适用关系、设备绑定或物料关系引用。','删除被拒绝；删除最后一条允许的 SKU 也不会连带删除 SPU。','先在相应页面维护引用，再回列表确认删除；历史交付仍读取冻结内容。',{ruleIds:['rule-sku-identity']}),
      r('skus-view-save','工作配置已应用但显示“未保存”，或保存事务失败。','当前可使用工作配置，但命名视图规则尚未更新；失败时旧保存配置保持。','点击保存或另存，失败保留工作配置重试；不要把搜索词当成视图保存条件。',{ruleIds:['rule-view-isolation','rule-persistence']}),
    ],
  },
  'page-sku-create':{
    purpose:'先确定所属 SPU，再用手工、方案、模型或规划来源预览并追加销售规格。',
    features:[
      f('sku-create-spu','选择或新建 SPU','确定每条新增规格的主体归属。','在“选择 SPU”挑选已有主体；需要时“新建 SPU”并保存后继续。','保留主体公共属性和版本；切换主体会提示清除未保存的规格草稿与候选。',{primary:true}),
      f('sku-create-generation','单个录入或批量生成','填写一个规格，或用方案取值范围／模型合法组合生成候选。','选择“单个规格”“模板批量生成”或“模型批量生成”，再点“预览规格”。','模型按绑定版本和真实分支展开；规划入口沿具体规划来源生成，不按名称补来源。',{primary:true,actionIds:['action-sku-preview']}),
      f('sku-create-review','区分新增、已有和无效候选','核对本次可写入的完整规格。','在预览表查看结果和说明，勾选可新增行；已有行可“查看已有 SKU”。','已有或无效行不可重复新增；预览不会分配正式 SKU 或写业务数据。'),
      f('sku-create-confirm','确认新增所选 SKU','把本次明确选择的规格追加到主体。','点击“确认新增 N 条 SKU”。','提交时重验整批候选，保留原记录及逐条模型／规划版本来源。',{primary:true,actionIds:['action-sku-save']}),
      f('sku-create-copy','使用已有 SKU 草稿','沿复制入口带入规格作为录入起点。','从允许的复制入口进入后检查规格，再预览确认。','复制的是草稿；目标发布版本重新计算适配，原商品人工声明留在原对象。'),
    ],
    restrictions:[
      r('sku-create-base','SPU 未选有效属性方案，公共属性不全或绑定版本失效。','不能生成可靠候选。','按页面“补全 SPU 配置”进入主体处理后重新预览。',{ruleIds:['rule-sku-input','rule-material-source']}),
      r('sku-create-repeat','同一 SPU 已有相同规格，或提交前候选发生变化。','已有规格跳过；包含无效或过期所选项时整批拒绝，不部分追加。','使用已有 SKU，或修正范围并重新预览；名称不同不代表规格身份不同。',{ruleIds:['rule-sku-identity','rule-conflict']}),
      r('sku-create-save','确认保存写盘失败。','新 SKU 未提交，输入与候选保留。','恢复本机存储后重试；预览和取消都不是实际创建。',{ruleIds:['rule-persistence']}),
    ],
  },
  'page-sku-edit':{
    purpose:'维护当前真实销售 SKU 的资料，保留所属 SPU 与已有规格来源。',
    features:[
      f('sku-edit-fields','编辑当前 SKU','修改编码、名称、OA_SKUID、状态和允许修改的规格属性。','在字段表单修改后点击“保存 SKU”。','只保存当前 SKU，不替换同级 SKU；空编码／名称不会被自动编造。',{primary:true,actionIds:['action-sku-save']}),
      f('sku-edit-source','查看主体与绑定版本','核对来源种类、版本和主体归属。','查看“来源／绑定版本”，点击所属 SPU 返回详情。','手工、方案、模型和规划来源如实分别显示；未记录来源不伪造关联。'),
      f('sku-edit-compatible','查看适用配件或主机','使用真实主机或配件 SKU 查询相应关系。','符合主机／配件身份时点击对应适用关系按钮。','基本适用、快充能力、待确认和不适用分别显示。'),
      f('sku-edit-benefits','查看三类关联权益包','按当前真实 SKU 查询可使用配置、候选项目与已经包含该商品的权益包。','打开“关联权益包”，按权限查看指定配置、开始权益包选购或使用已保存组合；结束后返回商品。','列为候选不等于已确认兼容或已经加入权益包；未知、停用和失效内容明确说明，缺少读取权限不显示成“暂无关联”。',{primary:true}),
      f('sku-edit-cancel','取消与返回范围','继续原列表范围或处理未保存输入。','点击取消或“返回 SKU 管理”，在未保存确认中明确选择。','来自 SPU 范围时保留其返回范围；页面功能阅读不执行保存。'),
    ],
    details:benefitWorkflowDetails('product'),
    restrictions:[
      r('sku-edit-identity','当前 SKU 保留模型节点、规划或来源身份。','规格属性锁定，不能直接改成另一组合。','其他规格应使用新增 SKU；已有绑定版本不自动升级到最新版本。',{ruleIds:['rule-sku-identity']}),
      r('sku-edit-duplicate','可编辑规格与同 SPU 另一 SKU 相同，或状态无效。','保存被拒绝，不能借改名建立重复规格。','使用已有 SKU，或填写合法且不同的规格与状态。',{ruleIds:['rule-sku-input','rule-sku-identity']}),
      r('sku-edit-save','原记录不存在或本机写入失败。','不会把 MAT 当销售 SKU 编辑；保存候选失败时保留原记录。','回对应列表核对真实对象；恢复存储后重新保存当前输入。',{ruleIds:['rule-persistence']}),
    ],
  },
  'page-material-create':{
    purpose:'从真实发布规划创建或复用 MAT；没有完整正式规格时，可明确创建临时物料。',
    features:[
      f('material-create-plan','选择发布模型和完整规划','按分类、类型和发布版本核对正式规格。','选商品分类；有多个类型或模型时明确选择，再选完整规格行。','显示 PLN、版本与建档数量；停用或未发布规格不能继续正式建档。',{primary:true}),
      f('material-create-confirm','创建正式物料','为明确的完整规划建立新的 MAT。','点“创建物料”，核对归属、名称、描述及供应商编码，选择“确认创建”或“创建并继续下一条”。','系统在确认时分配 MAT 编号；同一 PLN 可有多个 MAT，不按商品名称自动合并。',{primary:true,actionIds:['action-material-create']}),
      f('material-create-existing','查看或关联已有物料','在既有 MAT 与新的明确规划来源之间建立关系。','点“查看已有物料”或“关联已有物料”，选择真实 MAT 并预览范围与兼容后确认。','原编号和原始建档来源保留；共用需要已发布的明确策略，不能跨分类／类型按名称复用。'),
      f('material-create-temporary','创建临时物料','允许使用已有属性值或只属于本条物料的手工值。','点“创建临时物料”，至少填写一项属性，并手工指定全局唯一系统编码后保存。','临时建档不生成正式 PLN，不把手工值写入词典或模型；保存后系统编码只读。',{actionIds:['action-material-temporary']}),
      f('material-create-node','较早节点范围建档','需要在型号等较早节点建档时使用已发布节点范围。','从对应商品模型的值节点附近进入范围建档或关联，明确 current／subtree 并预览。','不强填尚未确定的容量颜色；节点范围与完整销售 SKU 枚举分别保留。'),
    ],
    restrictions:[
      r('material-create-source','分类、产品类型、模型、版本或 PLN 不匹配，或规划已停用。','正式建档被拒绝；临时记录不能伪装成正式规划。','回到具体来源版本重新选择；需要临时录入时明确使用临时建档。',{ruleIds:['rule-material-source','rule-material-planning']}),
      r('material-create-request','重试已完成或已删除物料的原创建请求。','已完成请求返回原物料；对应物料删除后旧请求不能重新创建。','只有明确发起新的建档操作才使用新请求；不要通过重试恢复已删除物料。',{ruleIds:['rule-material-identity','rule-material-request']}),
      r('material-create-protection','共用来源命中人工取消／修改的兼容贡献。','确认新版本范围不等于明确恢复声明，不能静默重新生成。','查看来源和人工决定，维护声明后重新预览；无明确恢复操作时保留人工保护。',{ruleIds:['rule-compatibility-manual-protection']}),
    ],
  },
  'page-material-edit':{
    purpose:'查看 V3 主体下真实 MAT 的固定编号、建档依据与新增关联，并保存物料资料。',
    features:[
      f('material-edit-choose','搜索和选择物料','查看当前主体的物料档案。','在左侧搜索编码、名称或描述，点击明确的 MAT。','展示物料规格、版本和编号；不会切成同名销售 SKU。',{primary:true}),
      f('material-edit-save','保存物料资料','维护物料名称、描述和供应商编码。','修改当前物料表单，点击“保存物料”。','只修改允许的资料；系统 MAT 编号、原来源及规格身份保留。',{primary:true,actionIds:['action-material-edit']}),
      f('material-edit-product-name','保存商品名称','单独维护这款 V3 主体的名称。','在商品基本信息处填写后点击“保存商品名称”。','名称不重建物料，不重新生成 PLN 或历史编号。'),
      f('material-edit-code','复制固定编号','查看并复制实际系统物料编号。','只读编号旁点击“复制”，失败时选中编号手工复制。','只复制已有编号，不支持改号或重新分配。'),
      f('material-edit-naming','预览重新生成的名称','使用可追溯建档版本的命名依据生成建议。','点击“按当前规则生成名称”，核对提示后另点“保存物料”。','按钮只改名称草稿；实际使用建档发布版本，没有可靠来源时会拒绝自动生成。'),
      f('material-edit-sources','反查完整来源与范围','查看原始建档、新增关联及兼容贡献。','在来源列表查看模型、版本、范围和规划；点击“定位来源”。','能按逐条来源核对真实关系，不能由数量汇总猜测每条 MAT 的 PLN。',{actionIds:['action-material-relation']}),
      f('material-edit-unlink','解除新增关联','移除明确的一条有效新增关系。','非原始关系出现“解除本条关联”时点击并确认。','仅解除该关系；保留 MAT、其他关系、人工声明及原始建档来源。',{risk:true,actionIds:['action-material-unlink']}),
      f('material-edit-compatible','维护适用主机或配件','查看 MAT 的适用声明和主机来源摘要。','配件物料点“添加适用主机”；主机有实际来源项时点“管理适用配件”。','进入相应适用维护；不会把 MAT 关系自动冒充销售 SKU 关系。'),
    ],
    restrictions:[
      r('material-edit-fixed','尝试修改已保存 MAT 编号、原始来源或冻结版本。','这些身份不能在物料资料表中重写，也不能通过解除新增关系删除原始建档。','需要其他物料时明确新建；新增关系从模型／规划的关联入口建立。',{ruleIds:['rule-material-identity','rule-model-history']}),
      r('material-edit-unlink-request','关系依据已变化，或重试已经解除关系的已受理请求。','旧预览不能提交；原请求不能借刷新预览重新恢复关系。','重新核对有效来源；确需重新关联时明确发起新的操作。',{ruleIds:['rule-material-request']}),
      r('material-edit-local-save','资料已改但本机写盘失败。','本页会提示当前修改尚未保存，不能把失败当成保存成功。','保留页面和输入，恢复存储后按提示重试；不要重新创建同名物料。',{ruleIds:['rule-persistence']}),
    ],
  },
  'page-compatibility':{
    purpose:'按明确设备型号维护销售配件与 MAT 的适用声明，并双向核对适配事实与来源。',
    features:[
      f('compatibility-query','按对象、设备和状态查看声明','查看当前对象或全部正式声明及其使用条件。','先用“看手机”或“看配件”选择真实对象；按可用、需核对、不可选查看结果，在详情中核对依据。','普通使用按基本适用判断；只有明确要求快充才叠加快充条件。快充冲突单独标注，型号与具体规格差异、在售状态分别保留。',{primary:true}),
      f('compatibility-declare','新增或编辑声明','维护目标、主机型号、范围、结论、核验、依据、备注及使用条件。','从维护入口新增或编辑声明，填写真实配件、设备型号和依据；变更预览自动更新，核对后确认保存。','预览不写数据，确认才提交；切换结果与维护保留未保存输入，离开或换对象需明确处理。身份变化不恢复其他用户的输入。',{primary:true,actionIds:['action-compatibility-declare']}),
      f('compatibility-binding','配置设备型号','为真实主机销售 SKU 选择明确设备身份，也可先建独立型号。','点击“配置设备型号”或“新建独立型号”；重新绑定时明确确认原型号及影响。','不能将 MAT 或配件绑定成主机 SKU；型号绑定不创建商品或全局适用声明。',{actionIds:['action-compatibility-bind']}),
      f('compatibility-copy','明确复制物料适用关系','把选定 MAT 声明的快照作为销售声明来源。','选择“从物料适用关系复制”，核对目标 SKU、原声明和条件，再预览确认。','这是显式复制；不因同 SPU、同 PLN 或同名就自动获得销售 SKU 适用关系。'),
      f('compatibility-batch','批量标记或取消声明','对所选声明标记待确认、声明不兼容或取消。','勾选后用批量操作，或行内“取消声明”，在预览中核对再确认。','保留人工决定与来源记录；取消并不是删除商品或物料。',{risk:true,actionIds:['action-compatibility-cancel']}),
      f('compatibility-sync','检查模板更新','对照目标发布版本预览新增、更新、移除与受保护项。','点击“检查模板更新”，逐项保留或明确采用允许的结果后“确认更新与保留”。','人工修改／取消不会因模板备注、依据或核验变化而静默恢复；整组冲突不能拆成部分覆盖。',{actionIds:['action-compatibility-sync']}),
      f('compatibility-legacy','查看原物料兼容性（高级）','保留旧 MAT 适用入口及真实型号范围。','在兼容性页面切换“原物料兼容性（高级）”；从 MAT 旧链接进入时继续承接原对象。','旧物料关系与销售 SKU 工作台分别维护，不自动转换记录身份。'),
    ],
    restrictions:[
      r('compatibility-target','目标不是有效 SKU／MAT，设备型号类型不匹配或来源无法确认。','声明或绑定会拒绝；不能把身份不明的结果当适用。','选择真实对象和明确主机型号，缺型号先完成设备绑定。',{ruleIds:['rule-compatibility-binding']}),
      r('compatibility-basis','预览后商品、条件、声明或发布版本发生变化。','原预览依据失效，整次提交拒绝。','保留选择并重新预览，确认新的完整影响后再保存。',{ruleIds:['rule-compatibility-basis']}),
      r('compatibility-manual','命中人工取消、修改或相反结论的保护来源。','模板同步和新版本范围确认不能替代恢复声明的明确决定。','先维护对应声明，保留人工结果；只对允许且明确选择的恢复或采用操作确认。',{ruleIds:['rule-compatibility-manual-protection'],warning:true}),
    ],
  },
  'page-benefits':{
    purpose:'从常用权益包创建独立销售方案；高级详情、旧框架和冻结交付继续保留。',
    features:[
      f('benefits-start','从手机开始选购','日常入口使用权益包选购。','点击“开始选购”，或“从手机开始”选择实际手机，进入后再明确选规格和加入。','仅浏览不创建空记录，不自动加入手机；已有方案按保存与离开保护继续保留。',{primary:true}),
      f('benefits-create','使用此组合','从已保存组合开始独立的新销售方案。','点击“使用此组合”，进入权益包选购后调整商品和服务。','原组合、冻结规则及历史交付不变；新方案需重新复核报价和适用依据。',{primary:true}),
      f('benefits-framework','新建或修改类型框架','先保存不含具体商品的类型范围和选配规则。','切换“高级框架”，点击“新建选配框架”或“查看／修改”，填写分组后“保存框架”。','保存类型范围与数量规则，不预选 SKU。新位置框架允许多组使用同一类型，并维护依赖／互斥；旧框架不自动升级。',{primary:true,actionIds:['action-framework-save']}),
      f('benefits-framework-copy','复制或删除框架','维护独立框架副本或移除允许删除的框架。','框架行“复制框架”后保存；“删除”需确认。','复制有独立身份；被引用框架受删除保护，已有包冻结修订不被新版覆盖。',{risk:true}),
      f('benefits-query','搜索和筛选包配置','按名称、编号、状态和常用标记查找已保存包。','在“常用权益包”搜索，选草稿／可用／停用／需处理，或勾选“只看已收藏”。','常用包优先展示；“需处理”来自当前有效性校验，不是独立保存状态。',{actionIds:['action-benefit-query']}),
      f('benefits-edit-copy','打开或复制组包','继续编辑配置，或将其作为独立新包草稿。','点击名称或“高级详情”查看原配置；“高级复制”保留原深链接流程。','复制不继承旧请求、确认与交付身份；仍需重新核对当前成员、条件及报价。',{primary:true,actionIds:['action-benefit-copy']}),
      f('benefits-favorite-status','常用、停用和启用','保存当前包的常用标记和可用状态。','组合卡片“收藏／取消收藏”“停用／启用”。','停用阻止新交付但保留旧清单；重新启用须通过当前成员校验，失败不会替换原配置。'),
      f('benefits-deliveries','搜索并打开历史清单','查看已生成清单的包数、来源修订及本次总报价。','切换“交付清单”，按清单或包名称／编号搜索，再点“查看清单”。','读取冻结快照，不随当前商品价格、框架或包配置变化。'),
    ],
    restrictions:[
      r('benefits-framework-ref','已有包引用某框架，或框架修订已变更。','不能删除被引用框架，也不会把包内冻结修订自动替换。','保留旧修订；确需改用新规则，在包配置中明确预览并应用。',{ruleIds:['rule-framework-members']}),
      r('benefits-missing','当前 SKU、主体或适配设备引用失效。','原包及名称、数量、价格快照保留并显示需处理；受影响包不能新交付。','打开包修正引用，不清空整包，也不根据同名替换商品。',{ruleIds:['rule-benefit-validation']}),
    ],
  },
  'page-benefit-create':{
    purpose:'在现有权益包入口完成自由组合，明确主适配对象、选配位置及服务；人工参考价与整包报价分别核对。',
    features:packageFeatures('benefit-create'),restrictions:packageRestrictions('benefit-create'),
    details:[{id:'benefit-create-price-example',title:'参考价与报价怎样分别计算',sections:[{id:'example',title:'一个具体对照',paragraphs:['同一商品每包 2 件、人工参考单价 10 元，参考小计为 20 元；另填整包报价 25 元时，报价仍为 25 元，参考合计减报价显示 -5 元差额。','一次性上门服务按本次交付只计一次，不随包数重复；未填参考价会提示不完整，0 元则明确计为免费。']}]}],
  },
  'page-benefit-edit':{
    purpose:'维护当前权益包修订，确认完整组成及报价后按本次包数生成冻结交付清单。',
    features:[...packageFeatures('benefit-edit'),
      f('benefit-edit-deliver','预览并生成本次交付','以已保存可用包为依据冻结本次实际内容。','填写“本次包数”，点击“预览本次交付”，核对并勾选完整组成确认，再点“确认生成清单”。','预览不分配正式清单号；确认保存后形成独立快照，不执行支付、出库或服务激活。',{primary:true,actionIds:['action-benefit-deliver']}),
      f('benefit-edit-history','查看已保存清单','核对该包不同修订和包数的历史交付。','在“已保存清单”点击明确编号。','读取当次生成内容；后续改名、价格、框架与包配置不回写旧清单。'),
      f('benefit-edit-revision','停用、启用与读取最新配置','处理已保存包的状态及并发修订。','未编辑时可停用／重新启用；有新修订时“读取最新配置”并明确确认放弃或保留当前输入。','停用只阻止新清单；修订冲突不会静默覆盖另一页面内容。'),
    ],restrictions:[...packageRestrictions('benefit-edit'),r('benefit-edit-preview','包尚未保存、已停用、有未保存修改或预览依据改变。','不能继续沿旧预览生成；修改包数也会使原预览与确认失效。','先保存为可用并重新预览；明确核对本次内容后再次确认。',{ruleIds:['rule-benefit-preview']})],
  },
  'page-benefit-delivery':{
    purpose:'只读查看、打印和导出已确认的商品、服务、适配条件与报价快照。',
    features:[
      f('delivery-read','查看完整交付明细','核对清单编号、包数、来源修订、商品与服务数量、参考金额和总报价。','打开已保存清单，按商品与服务明细查看。','内容以生成时冻结快照为准；不依赖当前商品或框架仍然存在。',{primary:true}),
      f('delivery-print','打印清单','按打印布局输出当前冻结内容。','点击“打印清单”，在浏览器打印窗口选择设备或保存方式。','打印失败不删除已保存清单，可再次打印。'),
      f('delivery-export','导出 Excel','导出当前清单的真实明细与报价。','有导出权限时点击“导出 Excel”。','导出冻结快照；失败保留清单并可直接重试，不需要重新生成交付。',{primary:true,actionIds:['action-delivery-export']}),
      f('delivery-source','查看当前包配置或返回来源','对照现在的配置与历史清单。','当前包仍存在时“查看当前包配置”；也可“返回权益包”或有效的“返回原页面”。','跳转不会把当前配置写回历史；源包已不存在时仍能读旧清单。'),
    ],restrictions:[
      r('delivery-readonly','希望修改已经生成的成员、数量或报价。','历史交付只读，不能用后来商品、价格或框架覆盖原内容。','需要新约定时回包配置修订并明确生成新清单，保留旧清单。',{ruleIds:['rule-delivery-snapshot'],warning:true}),
      r('delivery-not-found','清单编号不存在，或打印／导出失败。','不存在时显示空状态；输出失败不代表已保存快照丢失。','回权益包列表选择真实清单，输出失败只重试输出动作。',{ruleIds:['rule-benefit-preview']}),
    ],
  },
  'page-columns-spu':{
    purpose:'配置 SPU 当前视图的列显示、顺序、分组和排序；这些展示变化自动保存到本机视图。',
    features:[
      f('columns-spu-visible','显示和搜索字段','选择当前 SPU 列表需要的列。','在“列表设置”搜索字段并勾选；必需列不能关闭。','只改变展示列，不增删商品主数据。',{primary:true,actionIds:['action-spu-view']}),
      f('columns-spu-order','调整列顺序','按使用顺序排列显示字段。','清空字段搜索后拖动字段行。','顺序自动保存在当前 SPU 视图；有搜索时不接受拖序，防止误排隐藏字段。'),
      f('columns-spu-group-sort','分组和排序','选择单层分组、方向及默认／字段／手工顺序。','在列表设置选择分组与排序；需要时分别清除。','有分组时先清除才可启用手工顺序；保存的其他视图不被一起改动。'),
      f('columns-spu-reset','恢复默认列','还原当前模式的系统默认字段展示。','点击“恢复当前模式的默认列”或工具栏“恢复默认列”。','只处理当前视图当前模式的列，不删除保存视图、筛选或商品。'),
      f('columns-spu-views','管理独立视图与筛选预设','新建、另存、改名、删除允许的视图或保存当前筛选。','使用“新建视图／视图设置／保存当前筛选”及工具栏“另存视图”。','配置自动写入本机；删除视图只删该展示方案，系统默认视图受保护。'),
      f('columns-spu-category','分类栏按需或常驻','调整分类筛选的展示位置。','勾选“常驻分类栏”，必要时收起或展开分类栏。','窄屏可临时改为按需显示，不改变分类数据和长期视图选择。'),
    ],restrictions:[
      r('columns-spu-specific','把 SKU 页“宽度／自动／冻结”编辑项误当成本页按钮。','当前 SPU 列表设置提供显示与顺序等上述控件，并沿用已有列宽／冻结记录；两页配置入口并不相同。','需要 SKU 的列宽、冻结、多层分组等设置时进入 SKU 字段与视图配置；不要删除旧视图来套用默认列。',{ruleIds:['rule-view-isolation']}),
    ],
  },
  'page-columns-sku':{
    purpose:'编辑 SKU 当前工作配置中的字段、宽度、冻结、多项排序与分组，再明确保存视图规则。',
    features:[
      f('columns-sku-fields','显示或添加真实字段','按字段名称和来源选择列。','“字段”页搜索，勾选已有列或从“可添加字段”添加。','至少保留 SKU 编号或名称；字段来自实际登记，不创建业务属性。',{primary:true}),
      f('columns-sku-width','自动或手动列宽','把空间分配给当前需要的内容列。','填写列宽，或点该列“自动”；表头拖动也更新当前工作配置。','手工宽度与自动宽度分别保留，导航和窗口变化不会把自动计算写成手工值。'),
      f('columns-sku-frozen-order','冻结及重排列','固定关键列并调整所有列的展示顺序。','选择左侧／右侧冻结；用上下按钮或拖动字段手柄重排。','最多冻结两列；窄窗口可能临时不冻结，但保存的配置仍保留。'),
      f('columns-sku-sort','配置多项排序','按明确优先级比较最多三项字段。','在“排序”添加字段、方向并上下移动优先级。','新排序空值置后；历史排序原语义保留，只有明确切换才使用新多级规则。'),
      f('columns-sku-group','分组、密度与分类面板','设置最多两层分组、舒适／紧凑密度及分类栏。','打开“更多”设置分组、显示密度和分类面板，再“应用配置”。','组数按全部匹配结果计算，组内先排序再分页；手工与字段模式分别生效，切换不清空另一模式的配置。'),
      f('columns-sku-save','应用工作配置与保存视图','区分正在使用的配置与命名视图规则。','在弹窗点“应用配置”；回工具栏用“保存视图／另存为／恢复已保存配置”。','应用不修改商品；工作配置在本机保留，保存视图才更新已命名视图配置，系统全部 SKU 需另存。',{primary:true,actionIds:['action-view-save','action-view-restore']}),
    ],restrictions:[
      r('columns-sku-errors','字段失效、条件结构不合法，或宽度／冻结／分组／排序超过范围。','应用被拒绝并显示具体问题，不静默丢弃旧配置。','在弹窗修正错误；保存失败保留当前工作配置重试。',{ruleIds:['rule-view-conditions','rule-persistence']}),
      r('columns-sku-scope','当前带有临时 SPU 范围。','不会把临时范围自动写成全部 SKU 的保存条件。','另存时如确需限制范围，明确勾选“将当前 SPU 范围保存为条件”。',{ruleIds:['rule-view-isolation']}),
    ],
  },
}
