import type { GuideFeatureRow, GuideManualContent, GuideRestrictionRow } from '../types'

// These rows are authored against the named page controls; IDs do not depend on labels.
const feature = (id:string,title:string,description:string,operation:string,result:string,extra:Partial<Pick<GuideFeatureRow,'primary'|'risk'|'actionIds'>> = {}):GuideFeatureRow => ({id,title,description,operation,result,...extra})
const restriction = (id:string,condition:string,effect:string,resolution:string,ruleIds:string[] = [],warning = false):GuideRestrictionRow => ({id,condition,effect,resolution,...(ruleIds.length?{ruleIds}:{}),...(warning?{warning}: {})})

export const foundationManuals: Record<string, GuideManualContent> = {
  'page-home': {
    purpose:'从商品工作台搜索已有商品、进入新建流程或查看当前质量问题。',
    features:[
      feature('home-search','搜索商品','按商品、品牌或规格关键词进入商品列表。','填写搜索框后按 Enter 或点“搜索”。','把关键词带入商品列表，不创建商品。',{primary:true,actionIds:['action-workbench-search']}),
      feature('home-create','新增商品','创建新的商品主体。','点“新增商品”，或点“常用分类”中的分类按钮。','进入 SPU 新建页；分类快捷入口带入对应分类，需有新建权限。'),
      feature('home-recent','打开最近维护','查看最近更新的六个商品主体。','点“最近维护”中的名称。','打开对应商品详情，不以名称合并记录。'),
      feature('home-issues','处理商品问题','查看当前数据的必填、重复或非法取值错误。','点“待处理”具体问题进入商品，或点“待处理问题”打开质量检查。','工作台最多显示六项错误；完整结果在质量检查页。',{actionIds:['action-workbench-issues']})
    ],
    restrictions:[restriction('home-count-scope','工作台未列出某项问题','这里只展示有限条错误，非完整发布验收结果。','到质量检查切换“必须处理／规则未覆盖／全部”核对。'),restriction('home-create-access','新建按钮不可用或目标页无权访问','搜索和查看说明不会授予商品新建或详情权限。','使用当前可访问入口，必要时请有授权权限的用户调整角色。',['rule-permission'])]
  },
  'page-categories': {
    purpose:'维护真实分类树，并把多个完整分类子树一次移动到明确的父级。',
    features:[
      feature('categories-browse','查看分类和引用','浏览层级、搜索名称、查看所选分类及挂载商品。','在左侧搜索、展开或点分类；用“查看详情”显示详情区。','详情显示父级、启停、商品/SKU统计和本级方案；搜索不清空移动批次。'),
      feature('categories-add','新增根分类或子分类','在根目录或选中分类下增加分类。','切“编辑模式”，点“新增根分类”，或详情/更多中的“新增子分类”，填名保存。','创建独立分类 ID；有产品类型的末级分类不能再接收子分类。',{actionIds:['action-category-create']}),
      feature('categories-stage','追加待移动来源','左侧勾选和右侧移动批次分别管理。','勾选后点“加入已选”，或逐行“加入待移动”；可继续搜索后追加。','重复来源去重；祖先与后代归并为祖先子树，右侧显示有效来源数及子分类数。',{primary:true,actionIds:['action-category-move']}),
      feature('categories-pending','检查和调整批次','在右侧检查多个来源子树。','展开待移动树；用“移除此项”、移除按钮或“清空待移动”；“定位来源”帮助查找。','移除只撤销暂存，不删除分类；其他来源保留。'),
      feature('categories-confirm','选择目标并整批移动','把待移动来源放入同一目标。','在左侧点目标行并核对确认区完整路径，或点“选择顶级分类”，再点“确认移动”。','全部通过后一次提交；同父无变化项跳过不重排，成功定位结果并清理完成批次。',{primary:true,actionIds:['action-category-move']}),
      feature('categories-rename','原位改名','只改变同一分类的显示名称。','双击名称或“更多→改名”；Enter/保存确认，Esc/取消放弃。','失焦不保存，输入法组字 Enter 不提交；移动来源、目标和搜索不清空。',{primary:true,actionIds:['action-category-rename']}),
      feature('categories-edit','编辑状态和方案','维护名称、启停及本级属性方案。','详情“编辑”打开表单；有方案修改权限时可选或清除属性方案，点“保存”。','不在编辑表单改父级；方案使用分类可从详情引用链接查看。'),
      feature('categories-drag','手柄调整位置','对单个分类子树调整位置。','无待移动批次时，用行首拖动手柄拖到目标之前、之后或内部，核对放置提示。','按同一树结构/类型保护处理；批量移动无需拖动。'),
      feature('categories-copy-delete','复制或删除分类','复制分类子树，或删除符合条件的分类。','行“更多”选复制并确认；或用详情/更多“删除”。','复制不复制商品；有子分类、商品或产品类型引用时不能直接删除。',{risk:true,actionIds:['action-category-copy','action-category-delete']})
    ],
    restrictions:[
      restriction('categories-target','目标是来源本身、任一来源后代，或有实际移入且目标绑定产品类型','整批拒绝，不先移动其中合法的项。','保留批次并另选普通目录或顶级，核对完整目标路径。',['rule-category-cycle','rule-category-typed-target'],true),
      restriction('categories-stale','任一原始来源或目标失效、权限变化或写盘失败','本次移动不提交；来源、目标和搜索保留。','根据具体对象提示修正后重试；不要把未保存提示当作成功。',['rule-category-stale','rule-persistence']),
      restriction('categories-name','名称为空、分类失效或改名写盘失败','原位输入保留，分类名称未保存。','直接修正后保存，或 Esc/取消放弃；双击改名不改原移动目标。',['rule-category-input']),
      restriction('categories-reference','删除对象仍有子分类、商品或产品类型','删除被引用保护阻止。','先在详情核对下游并处理引用；不要将移动误作删除。',['rule-category-reference'])
    ]
  },
  'page-product-types': {
    purpose:'在末级分类下维护产品类型，并查找归属该类型的商品模型。',
    features:[
      feature('types-scope','按分类查类型','区分当前分类与下级分类的类型。','选左侧分类，切“仅当前分类／包含下级分类”。','只切换读取范围，不移动分类或类型。'),
      feature('types-create','新增产品类型','为当前分类创建类型。','选分类后点“新增产品类型”，填写名称、说明、排序并保存。','类型作为独立记录挂在分类下，不是分类子节点。',{primary:true,actionIds:['action-type-save']}),
      feature('types-edit','编辑类型及归属','修改名称、说明、排序或目标分类。','行“编辑”，在分类选择器中选有效末级分类，核对迁移提示后保存。','被引用类型的归属迁移受保护，不把模型或历史商品偷偷换分类。',{primary:true,actionIds:['action-type-save']}),
      feature('types-status','启停类型','调整该类型的启用状态。','使用对应行“状态”开关。','更新类型状态，不删除模型和历史来源。'),
      feature('types-models','查找商品模型','查看关联分类路径和模型清单。','展开行；点“查看模型”，唯一模型且有权限时直接打开，多模型时展开清单。','模型以查看模式打开；无模型页权限时仍可在本页读清单。',{actionIds:['action-type-models']}),
      feature('types-delete','删除未引用类型','移除不再需要的空类型。','行“删除”，确认名称。','模型、版本、规划、商品、设备或权益框架等引用会阻止删除。',{risk:true,actionIds:['action-type-delete']})
    ],
    restrictions:[restriction('types-leaf','目标不存在、停用、非末级或同分类已有同名类型','新增或编辑被拒绝。','选启用的末级分类并填写不重复名称。',['rule-type-category']),restriction('types-reference','类型被模型或其他受保护数据引用','不能直接删除，部分归属迁移也会被阻止。','根据迁移/删除提示核对具体下游，保留原类型身份。',['rule-type-reference']),restriction('types-save','保存表单后本机写盘失败','表单保留，不能视为持久化成功。','处理存储提示后在原表单重试保存。',['rule-persistence'])]
  },
  'page-params': {
    purpose:'维护全局属性词典、取值和取值分组，为方案与模型提供稳定引用。',
    features:[
      feature('params-search','按名称、ID和取值查词典','辨认同名属性，并查看真实属性身份和使用方案。','搜索属性名称、ID或取值；在“属性 ID”列或编辑区复制完整 ID，查看“用在”列。','ID只读，不是行号；筛选和复制不改词典，使用方案摘要不等于全部历史引用。'),
      feature('params-create','新建参数','创建空的全局属性。','点“新建参数”打开抽屉，填写名称后“保存名称”。','建立参数记录，模型后续按属性 ID 引用。',{primary:true,actionIds:['action-dictionary-save']}),
      feature('params-name','修改全局名称','修改词典属性名称。','行“编辑”，在抽屉改名，读引用提示后点“保存名称”，必要时确认。','不是给单个节点起别名；引用保护通过后才写入，不改发布快照。',{primary:true,actionIds:['action-dictionary-save']}),
      feature('params-values','批量添加或移除取值','维护当前属性自己的候选值，不创建模型节点。','在编辑区每行输入一个取值，核对待添加预览，可移除或取消，再“确认添加”；删除仍点具体取值的“删除”。','去空行并保序去重，已有值跳过；批量写入失败保留全部输入且原词典不变。标点、单位和有效空格不拆分；删除继续检查引用。',{actionIds:['action-dictionary-value-remove']}),
      feature('params-groups','维护取值分组','把已有候选值分成便于复用的小组。','抽屉“新增分组”，修改组名并多选当前属性取值。','分组和“参与旧结构”开关直接修改本机词典，由数据持久化队列保存。'),
      feature('params-brand','打开品牌属性词典','快捷查看品牌这一公共属性。','点“维护品牌”。','打开品牌属性的词典抽屉；品牌中心目录与旧商品品牌文字仍需分别理解。'),
      feature('params-delete','删除空闲参数','移除未被保护引用的属性。','对应行“删除”。','删除检查引用；不会自动改写在用模型、商品或历史版本。',{risk:true})
    ],
    restrictions:[restriction('params-reference','属性/取值被草稿节点、已发布快照、商品或允许值配置实际引用','删除或受保护改名被拒绝，即使允许值尚未建成属性值节点也算引用。','按提示定位来源模型/节点，维护其他未引用值或明确调整草稿；不改历史快照。',['rule-dictionary-reference'],true),restriction('params-snapshot','冻结词典副本含全部候选','全量候选不等于每个值都被允许值配置引用。','按属性 ID 与允许值配置实际选择的值核对引用，不按名称猜测。',['rule-dictionary-reference']),restriction('params-disk','名称或新增值提示未保存','当前修改/输入仍可能在内存中，不能保证刷新后保留。','处理本机存储错误并重试，必要时先导出备份。',['rule-persistence'])]
  },
  'page-templates': {
    purpose:'配置公共属性、规格属性、必填和结构轴顺序，供分类选择并用于后续录入。',
    features:[
      feature('templates-new','新建属性方案','组合已有词典参数形成独立方案。','点“新建方案”，填名称、加入参数，设置角色/必填和顺序，点“保存”。','保存前只在抽屉草稿中，不提前新增方案或参数绑定。',{primary:true,actionIds:['action-template-create']}),
      feature('templates-config','配置参数及顺序','维护公共/规格属性角色与必填要求。','行“配置”；用角色选择、必填、上移/下移、移出/加入调整，点保存并确认影响。','方案与全部参数绑定一次提交；录入先公共后规格，结构轴仍遵循此处顺序。',{primary:true,actionIds:['action-template-save']}),
      feature('templates-users','查看分类引用','确认哪些分类共用该方案。','查看引用数，并在配置抽屉“适用分类”查看名称。','此处只读分类绑定；更换绑定到商品分类中心。'),
      feature('templates-enabled','启停方案','调整未来可用方案。','行启用开关，阅读影响提示并确认。','不因启停改写已有商品与历史来源。'),
      feature('templates-copy','复制为独立方案','以现有结构和绑定作为副本初稿。','行“复制”，核对名称与参数，点保存。','普通方案副本独立；若记录实际是模型，转用模型复制，不冒充普通方案。',{actionIds:['action-template-copy']}),
      feature('templates-preview','预览与创建 SKU','查看录入角色，或进入销售规格创建。','行“预览录入”查看公共/规格属性；有权限时点“创建 SKU”。','预览不建商品；创建 SKU 进入单独流程并继续校验来源。'),
      feature('templates-delete','删除无保护引用方案','清理不再使用的方案。','行“删除”并确认。','方案下有商品、发布历史或其他受保护来源时拒绝。',{risk:true,actionIds:['action-template-delete']})
    ],
    restrictions:[restriction('templates-bindings','参数不存在、重复绑定、顺序/角色字段无效或名称为空','整份方案及参数绑定均不提交。','保留抽屉，改用有效词典属性并修正重复/空项。',['rule-template-bindings']),restriction('templates-access','当前记录是商品模型或没有对应操作权限','按记录真实身份检查 model/template 权限，不按页面名称绕过。','到商品模型维护模型；普通方案使用方案权限。',['rule-permission']),restriction('templates-save','保存失败或取消影响确认','抽屉草稿保留，原方案与绑定不变。','修正提示后重试；不把关闭抽屉当作确认保存。',['rule-persistence'])]
  },
  'page-models': {
    purpose:'按分类与产品类型管理模型草稿、发布版本、适用设备配置和使用数量。',
    features:[
      feature('models-create','新建模型','在明确产品类型下建立新模型草稿。','点“新建模型”，依次选分类/产品类型并填模型名，点“创建”。','成功进入设计器，不复制其他模型商品。',{primary:true,actionIds:['action-model-create']}),
      feature('models-open','查看或编辑模型','进入同一模型设计器的不同模式。','行“查看模型”只读打开；有修改权限时点“编辑模型”。','查看模式不改结构；进入编辑继续维护当前草稿。',{primary:true,actionIds:['action-model-edit']}),
      feature('models-publish','发布模型','验证草稿并保存新的冻结版本。','行“发布模型”，阅读成功/失败提示与规则卡。','通过词典、结构、业务配置和适用规则检查后创建发布快照。',{primary:true,actionIds:['action-model-publish']}),
      feature('models-compatibility','维护适用设备配置','设置模型默认声明及分支例外。','行“适用设备配置”打开配置对话框；无修改权限时只读。','草稿配置需发布才成为新版本依据，不能直接当销售 SKU 声明。'),
      feature('models-copy','复制模型','复制当前草稿结构和适用配置。','行“复制模型”。','新模型从草稿开始，不复制商品或历史发布记录。',{actionIds:['action-model-copy']}),
      feature('models-offline','下线模型','停止新商品继续使用该模型。','行“下线模型”。','历史商品继续读取创建时版本；下线不删除冻结快照。',{actionIds:['action-model-offline']}),
      feature('models-sku','创建销售 SKU','从选定模型进入规格创建。','行“创建 SKU”。','只带模型上下文，仍需选择合法发布路径和所属 SPU。')
    ],
    restrictions:[restriction('models-publish-invalid','词典引用、结构、命名/配置或适用配置有问题','发布被拒绝，不能把未通过的草稿当正式版本。','按规则卡定位设计器节点或配置，修正后发布。',['rule-model-dictionary','rule-model-structure','rule-node-config'],true),restriction('models-history','修改、复制或下线模型','已有版本和由它创建的商品保留原来源，不自动回填新规则。','新变更发布为新版本；查看老来源时读取对应快照。',['rule-model-history']),restriction('models-write','创建/复制/发布或状态落盘失败','成功提示未出现前不能当作完成，状态修改可能仍在内存。','依据保存提示处理；保留当前页并重试对应动作。',['rule-persistence'])]
  },
  'page-specs': {
    purpose:'用画布、清单或幕布编辑真实模型分支，并发布可追溯的合法组合与建档依据。',
    features:[
      feature('specs-context','定位分类、类型和模型','从全局总览或单模型设计打开明确模型。','左侧选分类/产品类型/模型，或切“全局总览／单模型设计”；查看模式可点“进入编辑”。','进入编辑需模型修改权限，不按名称自动合并模型。'),
      feature('specs-structure','区分添加节点与更换引用','在明确位置新增节点，或只更换当前节点引用。','用“添加属性／添加属性值”增加节点；点击已有节点进入“更换属性引用／更换属性值引用”，核对后确认。','添加可多选，更换保持单选；不把替换做成新建同级节点，也不以更换引用改全局名称。',{primary:true,actionIds:['action-model-edit']}),
      feature('specs-attribute-batch','混选已有属性与新属性','已有多选和本次新属性一起暂存，按真实 ID 区分同名项。','按名称或 ID 搜索已有属性；输入新名称“加入待添加”，可连续追加并移除，最后“确认添加”。','确认前不写词典或插节点；同名歧义须明确选择 ID。更换属性仍检查已有子节点和业务配置，编辑全局名称是独立操作。',{primary:true,actionIds:['action-model-edit']}),
      feature('specs-value-batch','一次添加多个属性值','在明确的所属属性下混选已有值，并输入多个新值。','核对属性名、ID和路径；多选已有值，每行补充一个新值，检查预览并移除不需要的项，再“确认添加”。','末尾有效输入也纳入本次；当前父节点已有值明确跳过。整批合法并保存成功才关闭，一次确认对应一次撤销；取消不落盘。',{primary:true,actionIds:['action-model-edit']}),
      feature('specs-views','三视图与快捷键','在同一结构上使用画布、清单或幕布。','顶部视图切换；先聚焦结构区再用“全部快捷键”列出的操作。','视图共享节点；输入框、下拉和弹窗中的按键不会被结构快捷键抢用。'),
      feature('specs-layout','布局、缩放和展开','整理位置并查看大树。','用“自动布局／手工摆放／适应全部”、缩放菜单、小地图及“全部展开/收起”。','调整位置不改父子关系；自动布局才重新对齐手工位置。'),
      feature('specs-business','配置值节点业务','设置销售定位、物料策略和路径允许值。','选属性值节点点“业务配置”；选功能、范围、参数，点“保存节点配置”。','配置是值节点附属实例，不新增规格轴；目录复用不代表实例共用。',{primary:true,actionIds:['action-node-business-save']}),
      feature('specs-naming','设置命名规则','按字段与固定文字顺序生成物料命名预览。','节点“命名规则”；点击/拖入字段、插入文字并调整顺序，预览合法组合后保存。','只写当前草稿节点；自有规则整段覆盖继承规则，预览不建物料。',{actionIds:['action-node-naming-save']}),
      feature('specs-hosts','适用设备默认与例外','配置模型层和分支层的适用设备。','模型头部“配置适用设备”或节点“节点适用配置”。','保存草稿后还需发布；多来源冲突需明确处理，不改人工取消决定。'),
        feature('specs-sales','绑定销售选配方案','从模型或真实节点范围复用已发布选配方案。','点击“搭配与适用”，明确发布版本与值节点范围，核对合法规格数和销售 SKU 数，再应用到已发布范围。','与独立选配方案页共用同一绑定；属性节点必须明确选值，不增加规格轴，也不改变适用声明。',{actionIds:['action-business-save']}),
      feature('specs-save-publish','保存与发布模型','区分保存草稿和生成正式版本。','点“保存模型”保存编辑；点“发布模型”验证并创建版本；“发布记录”查历史。','保存草稿不替换最近发布版本；发布保留树、词典、业务配置和来源快照。',{primary:true,actionIds:['action-model-edit','action-model-publish']}),
      feature('specs-combos','管理合法组合','按发布版本核对完整路径、PLN、物料与历史记录。','点“管理合法组合”；切版本、搜索、筛未建档，勾选后标核心/一般或批量创建物料。','草稿预览无正式规划编号；单条可查看、新建或关联已有 MAT，多个 MAT 可指向同一组合。'),
      feature('specs-node-materials','节点附近建档和反查','从较早值节点建立/关联 MAT 并查看覆盖范围。','选值节点点“节点范围建档／关联”；用“显示关联物料”控制三视图物料展示。','明确预览并确认当前/下级范围；显示开关不改物料关系，也不截断完整销售组合。',{actionIds:['action-material-relation']}),
      feature('specs-temporary','临时物料与模型复制','处理未能对上正式路径的建档，或从已有模型起稿。','合法组合管理中“创建临时物料”；空模型或模型栏“复制已有模型”。','临时物料用 TMP 来源，不冒充正式 PLN；模型复制不带原商品/发布记录。')
    ],
    restrictions:[
      restriction('specs-path','词典未绑定、属性值不属于所引属性、路径重复/不完整或结构非法','正式发布和建档被阻止。','用“结构检查”及规则卡定位；修正当前分支，不全局补出不存在的组合。',['rule-model-dictionary','rule-model-structure'],true),
      restriction('specs-config','允许值失效、未知配置或多条不一致配置','显示不支持/冲突并阻止受影响发布，不自动覆盖或取交集。','保留原文，定位节点并明确调整；尚未确认的覆盖规则仍待业务确认。',['rule-node-config']),
        restriction('specs-dictionary-batch','本批任一取值超出当前路径允许范围，或创建词典项的权限不足','整批不提交，不能将路径禁用误作词典缺值，也不能静默放宽上级配置。','保留选择和输入，移除非法项或明确维护允许范围后重试。只引用已有词典项无需词典修改权限；新属性需创建权限，新值需词典修改权限。',['rule-node-config','rule-dictionary-reference','rule-permission']),
      restriction('specs-frozen','查看模式、历史版本或历史来源','只读冻结依据，布局和新草稿不重写原快照、编号及 MAT/SKU 身份。','要调整未来行为请进入草稿编辑并发布新版本。',['rule-model-history','rule-identity-separation']),
      restriction('specs-material-source','未发布、规划停用、来源依据变化或人工兼容保护命中','不能凭草稿预览或确认版本范围绕过建档/人工保护。','核对具体版本、节点范围和预览；新操作使用新请求，保留旧来源。',['rule-material-source','rule-material-request','rule-compatibility-manual-protection']),
      restriction('specs-unsaved','保存失败或准备离开尚未保存的编辑','保留编辑和错误提示；离开需明确确认，不把发布失败写成已发布。','先保存成功或明确放弃；打开页面说明不会触发业务离开。',['rule-persistence'])
    ],
    details:[{id:'specs-business-scope-detail',title:'路径允许值如何生效',actionIds:['action-node-business-save'],sections:[{id:'specs-business-scope-steps',title:'只限制目标路径',steps:['在 A 路径的值节点添加“允许值”配置，选择真实下级属性及该属性的允许词典值。','允许值使用“当前值及其下级”，核对生效来源；只约束 A 路径，不改全局候选或 B 路径。','即使某允许值尚未建立属性值节点，这条配置仍引用它；删除全局取值前会检查该引用。']}] }]
  },
  'page-plans': {
    purpose:'从已发布模型的真实分支保存规划范围，再选择 SPU 追加销售 SKU。',
    features:[
      feature('plans-enter','选择发布模型','以明确版本进入规划。','点“已发布模型”卡片；用“返回模型列表”返回。','新规划使用进入时的发布版本，不读取未发布草稿。'),
      feature('plans-select','选择规划范围','选择上层型号或末级取值，预览其下合法规格。','在左树勾选值节点，查看右侧“规划结果”和预计 SKU 明细，按需要改产品名称。','只展开真实存在路径，不对缺失分支做笛卡尔积补全。',{primary:true}),
      feature('plans-save','保存或继续编辑规划','保存名称、选中节点和具体版本。','点“保存规划”；列表“继续编辑”载入该规划原版本。','新建/编辑分别检查规划权限；规划保存不等于创建 SKU。',{primary:true,actionIds:['action-planning-save']}),
      feature('plans-create-sku','从规划创建 SKU','把保存范围带到 SKU 创建流程。','已保存规划点“创建 SKU”，选择已有或新 SPU 后预览并保存。','追加的 SKU 保留完整路径与规划/版本来源，不要求创建第二个 SPU。',{primary:true,actionIds:['action-planning-create-sku']}),
      feature('plans-result','查看已建 SPU','反查已有创建结果。','已保存规划出现“查看 SPU”时点击。','关联按真实来源读取；没有来源记录不会伪造关联。'),
      feature('plans-delete','删除未使用规划','移除没有 SPU/SKU 来源关联的规划。','列表“删除”。','已有创建结果会拒绝删除，不移除历史商品。',{risk:true,actionIds:['action-planning-delete']})
    ],
    restrictions:[restriction('plans-required','未选值、名称为空或模型未归属产品类型','不能保存有效规划。','选择节点并核对名称、产品类型。',['rule-material-planning']),restriction('plans-version','规划对应版本不存在或不再是可读发布版本','不能继续按失效依据编辑。','核对原模型版本；不要自动换到最新版本后宣称来源相同。',['rule-model-history']),restriction('plans-live-write','“保存规划”修改本机规划数据','页面写入由本机数据持久化队列落盘，不会自动生成销售 SKU。','若出现未保存/冲突提示先处理，再进入 SKU 创建确认。',['rule-persistence'])]
  },
  'page-tree': {
    purpose:'按方案结构轴查看已存在商品，使用精简层级和搜索定位商品详情。',
    features:[feature('tree-template','切换结构方案','查看对应方案下的已有商品树。','顶部选择方案。','只读生成展示树，不创建模型节点或商品。',{primary:true,actionIds:['action-tree-query']}),feature('tree-compact','切换旧层级和精简','控制空层级的呈现。','顶部“精简／旧层级”开关。','精简只隐藏展示层级，不删真实节点和规格。'),feature('tree-search','搜索结构节点','按节点名称、层级名过滤并保留匹配路径。','输入“搜索节点或规格”。','仅改变当前展示；清空恢复完整树。'),feature('tree-open','打开已有商品','查看树项对应商品。','有“查看商品”按钮的节点点击该按钮。','进入该真实商品详情，普通结构节点不虚构商品 ID。')],
    restrictions:[restriction('tree-existing','树中没有某理论组合','本页只展示已有商品，不是所有合法规划或可用 SKU 清单。','理论组合到模型设计的合法组合管理查看，实际销售记录到 SKU 管理。',['rule-identity-separation'])]
  },
  'page-brands': {
    purpose:'维护新商品可选择的品牌目录，同时保留历史商品的品牌文字。',
    features:[feature('brands-create','新增品牌','创建名称、标识地址和说明。','点“新增品牌”，填写非空名称并保存。','保存成功后新增品牌记录；若品牌词典尚无该名称，会一并补入，空标识/说明允许。',{primary:true,actionIds:['action-brand-save']}),feature('brands-edit','编辑品牌','修改目录记录的显示信息。','行“编辑”，修改后点“保存”。','新名称会在品牌词典中补入；旧名称不自动删除，旧商品品牌文字不批量改写。',{primary:true,actionIds:['action-brand-save']}),feature('brands-status','启用或停用品牌','控制目录品牌是否可用。','使用行“状态”开关。','停用不删除历史商品或合并同名记录；本页无删除按钮。')],
    restrictions:[restriction('brands-history','改品牌名或停用品牌','修改的是品牌目录，旧商品已保存的品牌值仍保留。','需要修改具体商品时进入该商品；品牌词典属性另在属性词典维护。',['rule-catalog-names']),restriction('brands-sync','品牌名称需要补入品牌词典，但没有词典修改权限','品牌和词典均不改变。','请有品牌及词典修改权限的身份保存，不把目录成功和词典失败拆开处理。',['rule-permission']),restriction('brands-save','名称为空、权限不足或保存失败','编辑框不关闭并保留输入；状态写盘失败会在页内提示。','补名称或处理保存错误后重试，不重复创建品牌。',['rule-persistence'])]
  },
  'page-groups': {
    purpose:'用独立的运营分组组织活动商品，不改变商品分类与规格。',
    features:[feature('groups-create','新建根组或子组','创建运营分组层级。','点顶部“新建分组”，或选组后点“新增子组”。','立即创建名为“新分组”的本机记录并选中，可在名称输入中改名。',{primary:true,actionIds:['action-group-create']}),feature('groups-name','修改分组名称','直接维护当前分组名称。','点左树选组，在右侧名称框输入。','名称直接绑定本机数据并进入持久化队列，不需按“保存关联”。'),feature('groups-link','保存商品关联','让所选商品加入当前组，未选商品移出当前组。','右侧“关联商品”多选后点“保存关联”。','只更新各商品与当前组的关联，其他组不变。',{primary:true,actionIds:['action-group-link']}),feature('groups-delete','删除分组子树','清理当前组及下级组。','选中组后点“删除”。','同时移除商品对这些组的关联，不删商品、不改商品分类。',{risk:true})],
    restrictions:[restriction('groups-separate','希望用运营分组替代产品分类或规格','分组不会改变商品类型、规格组合或规划身份。','分类归属到分类/SPU页面处理，运营分组仅用于活动组织。',['rule-identity-separation']),restriction('groups-save','名称或关联修改后出现本机未保存提示','当前修改可能仅在内存中。','先处理保存/冲突提示，确认落盘后再刷新。',['rule-persistence'])]
  },
  'page-rules': {
    purpose:'维护基于属性条件的允许值规则，并直接测试覆盖、空结果及冲突。',
    features:[feature('rules-create','新增或编辑允许值规则','指定方案、前置等值条件、目标属性和允许集合。','点“新增规则”或行“编辑”，增加条件、选允许值、填说明后保存。','规则保存为独立记录；抽屉输入未保存前不替换现有规则。',{primary:true,actionIds:['action-constraint-save']}),feature('rules-status','启停、复制或删除规则','管理当前非旧版规则。','列表开关启停；“复制”打开新草稿；“删除”移除该规则。','复制需再保存才生成新规则；删除直接修改本机规则集合。',{risk:true}),feature('rules-views','切换四种规则展示','按列表、链式、树形或总览阅读相同规则。','顶部选择展示方式。','不产生多份规则或改变条件语义。'),feature('rules-test','测试当前选择','核对选定方案和属性值下的规则结果。','下方“规则测试”选方案，逐项选属性值。','实时显示未覆盖、允许/受限或空结果；测试不改商品。',{primary:true,actionIds:['action-constraint-test']}),feature('rules-legacy','阅读旧规则原文','查看无法无损转换的历史条件。','下方“旧规则参考”。','只保留原文，不参与当前商品校验。')],
    restrictions:[restriction('rules-conflicts','多条规则条件冲突或允许结果为空','页面显示冲突/空结果，不能把空集合解释成不受限制。','在规则测试复现条件，明确调整相关规则。',['rule-constraint-definition'],true),restriction('rules-fields','条件未选齐或属性/词典已发生变化','规则可能无法命中预期条件；保存成功不等于覆盖范围已核对。','用有效方案、属性与取值完成规则测试，区分未覆盖和空结果。',['rule-constraint-definition']),restriction('rules-save','保存失败','规则抽屉和当前输入保留，原规则不被失败候选覆盖。','处理错误后重试原草稿。',['rule-persistence'])]
  },
  'page-mappings': {
    purpose:'保留历史方案绑定入口，读取并维护与商品分类中心相同的分类方案绑定。',
    features:[feature('mappings-list','查看本级方案绑定','逐分类查看其显式属性方案。','查看“商品分类／属性方案”表。','未配置显示为空，不推导为继承或新增产品类型。'),feature('mappings-change','更换或清除方案','维护当前分类本级绑定。','在对应行选择有结构轴的方案，或清空选择。','直接写入同一份分类方案绑定并进入持久化队列，没有单独保存按钮。',{primary:true,actionIds:['action-mapping-save']})],
    restrictions:[restriction('mappings-historical','这是菜单已关闭的旧入口','不产生另一份分类绑定数据。','日常从商品分类中心“编辑→属性方案”维护；已有历史地址仍可读取。'),restriction('mappings-permission','缺少属性方案修改权限','下拉只读，不能通过旧地址绕过权限。','使用有授权的身份维护，不把说明阅读当作修改授权。',['rule-permission'])]
  },
  'page-overview': {
    purpose:'按属性方案汇总已有商品状态，并以规格矩阵查找现有规格与问题。',
    features:[feature('overview-scope','选择方案','限定当前总览的数据范围。','顶部选有结构轴的属性方案。','共用方案会提示关联分类数，读取该方案下商品。'),feature('overview-products','查看商品汇总','比较每款规格总数、在售、草稿及必填完整数。','切“商品视图”，查看问题摘要，点商品名称进入详情。','汇总来自现有商品/SKU检查，不会自动发布或补全规格。',{primary:true,actionIds:['action-overview-query']}),feature('overview-matrix','查看规格矩阵','按一个属性作列，其余结构属性作行交叉对照。','切“规格矩阵”，选“列维度”，点击有商品来源的单元格。','显示正常、缺失、空轴或异常；只有有对应商品的格子能进入现有商品。',{primary:true})],
    restrictions:[restriction('overview-empty','矩阵格缺失或结构轴为空','展示当前缺失状态，不自动创建理论组合。','到商品或模型页核对真实数据，不把矩阵空格当成可建档授权。',['rule-identity-separation']),restriction('overview-readonly','切换方案、矩阵维度或视图','只调整当前读取，不改变商品、PLN、MAT 和发布快照。','要修改具体记录，打开该商品详情并明确保存。')]
  },
  'page-check': {
    purpose:'集中查看商品的必填、重复、非法取值及规则未覆盖问题并进入商品修正。',
    features:[feature('check-severity','切换问题等级','区分必须处理错误和规则未覆盖提示。','顶部切“必须处理／规则未覆盖／全部”。','重新读取商品质量检查结果；非必填空值不因此算错误。',{primary:true}),feature('check-locate','去修改问题商品','从具体问题到对应商品详情。','核对商品、问题和类型后点“去修改”。','只跳转，不自动改字段或删除重复项。',{primary:true,actionIds:['action-check-locate']})],
    restrictions:[restriction('check-warning','问题类型是“未限制／规则未覆盖”','它与必填、重复或非法取值错误不同，不表示系统已确认禁止该值。','核对规则覆盖范围后决定是否补规则。',['rule-constraint-definition']),restriction('check-count','列表没有显示某模型发布或权益包错误','本页检查现有商品，不替代模型、物料或权益包各自的完整提交校验。','在相应业务页面查看具体失败说明。')]
  },
  'page-import': {
    purpose:'先识别 Excel 工作表、核对字段和预览，再确认导入物料；JSON 完整恢复另在顶部演示数据入口。',
    features:[
      feature('import-template','下载模板与导出表格','下载示例 Excel 或现有商品/物料工作表。','右上“下载导入模板”或“导出商品和规格”。','导出 Excel 用于查看和表格交换，不等于包含全部冻结信息的 JSON 备份。'),
      feature('import-select','选择工作表与字段','识别可导入工作表并调整列含义。','上传 .xlsx/.xls，选一张物料表，在“字段对应”选择每列目标。','上传和映射本身不建物料；库存、管理方式等标注“不保存”的列不写库存业务。',{primary:true}),
      feature('import-preview','预览匹配结果','区分正式、临时、已导入和阻塞行。','点“预览导入”，核对分类/类型/模型/值等分组；需要时选明确模型后“重新匹配”。','预览表展示前80行，确认处理全部可导入行；同供应商编码不自动合并。',{primary:true,actionIds:['action-table-import']}),
      feature('import-alias','确认别名和临时导入','人工决定建议映射或允许临时建档的分组。','勾选建议别名；仅在支持的分组点“这组按临时物料导入”，需要时取消。','变更后重算预览，不把不确定规格强装成正式 PLN。'),
      feature('import-bootstrap','补充已核对模型','按当前表格观察结果补手机、平板、保护壳结构。','字段对应区点“补上已核对的手机、平板、保护壳模型”。','此操作会修改分类/类型/模型；保留原手机模型，不生成未确认的屏幕膜/笔记本结构。'),
      feature('import-confirm','确认导入物料','把可导入行作为候选一次提交。','核对就绪数量后点“确认导入 N 行”。','重新校验当前依据后写盘；已受理行重试不重复建档，失败保留预览与选择。',{primary:true,actionIds:['action-table-import']}),
      feature('import-json','导出或恢复完整演示备份','备份并恢复业务数据及冻结信息。','顶部“演示数据→导出演示数据／导入演示数据”选择 JSON。','导入时校验结构、身份冲突与导入前当前权限；拒绝时不替换现有数据。',{actionIds:['action-backup-export','action-json-import']})
    ],
    restrictions:[restriction('import-ready','分类、产品类型、模型、规格值或源字段不足','相关行保留阻塞原因，不静默猜测来源或按名称合并。','按“去配置”和明确模型选择处理后重新匹配。',['rule-material-source','rule-material-planning']),restriction('import-json-shape','JSON 容器损坏、真实组外权益包成员、MAT身份冲突或权限越界','完整导入被拒绝，内存及原持久化内容保持。','用合法备份修正结构；缺SKU等可修复引用保留原成员，由业务页处理。',['rule-json-import'],true),restriction('import-atomic','预览后数据已变、双页冲突或保存失败','不能按旧依据部分写入或把失败当成功。','保留预览，解决存储/冲突并重新核对后重试。',['rule-conflict','rule-persistence'])]
  },
  'page-menus': {
    purpose:'配置真实导航中心、分组和正式页面的位置、名称、顺序及可见性。',
    features:[
      feature('menus-search','筛选和展开菜单树','按名称/路由、类型、显示状态查节点。','使用上方筛选和“展开全部／收起全部”，点行查看父级路径。','保留匹配项祖先结构，不改变菜单排序。'),
      feature('menus-create','新增中心、分组或正式页面入口','组织导航结构。','点“新增菜单”或容器行“添加下级”；选类型、名称、父级、顺序，页面需选正式路由和登记权限，点“保存菜单”。','每正式页面只有一个入口；添加已有页面会恢复显示并移动已有入口。',{primary:true,actionIds:['action-menu-save']}),
      feature('menus-edit','改名、改挂和隐藏','调整现有菜单展示。','行“编辑”，改名称、父级、顺序或导航显示后保存。','不修改正式路由身份；隐藏不会撤销直接访问授权。',{primary:true,actionIds:['action-menu-save']}),
      feature('menus-order','同级排序与空容器删除','调整相邻顺序或清理自定义空容器。','行“更多→同级上移/下移”；自定义容器可“删除空容器”并确认。','非空容器先改挂子入口；正式页面不能随意删掉注册身份。',{risk:true}),
      feature('menus-preview','按用户预览导航','查看所选用户有效权限下的可见入口。','点“预览菜单”，在抽屉选预览用户。','只读取有效授权，不切换模拟身份或修改角色。'),
      feature('menus-restore','恢复默认结构','撤销菜单结构自定义。','点“恢复默认结构”并确认。','只恢复菜单；用户、角色授权、主题和长期导航偏好保持。',{risk:true,actionIds:['action-menu-restore']})
    ],
    restrictions:[restriction('menus-structure','试图绑定任意网址、重复页面、循环父级或非法层级','保存被拒绝；只支持中心→分组/页面→页面的登记结构。','选正式页面和合法父级，先移走子入口再删空容器。',['rule-menu-structure']),restriction('menus-guide','系统说明独立一级入口','直达原 /guide，文章地址也归属系统说明；不会多开一份内容或自动取消固定。','仍可按菜单配置改名/隐藏；不需要重置全菜单来修入口。',['rule-menu-structure']),restriction('menus-save','菜单保存失败或关闭未保存抽屉','保留草稿；离开需确认放弃。','处理页内错误再“保存菜单”，预览不等于保存。',['rule-persistence'])]
  },
  'page-roles': {
    purpose:'维护角色及显式权限，并核对授权变化会影响哪些用户。',
    features:[
      feature('roles-search','查询和查看关联用户','按名称/编码与状态找到角色。','顶部筛选；点关联用户数或“更多→查看关联用户”。','只读展示绑定用户与启停状态。'),
      feature('roles-create','新增或编辑角色','维护名称、稳定编码、说明与启停。','点“新增角色”或行“编辑”，填写后“保存角色”。','新增角色默认无权限；已保存编码不可改，内置超级管理员不能普通编辑。',{primary:true,actionIds:['action-role-save']}),
      feature('roles-grants','显式配置权限','分别授权页面访问与操作权限。','行“配置权限”，搜索/展开权限树、勾选、核对新增/撤销/影响人数后“保存授权”。','分组勾选只包括当前已有权限；缺依赖须明确补选，不自动扩权。',{primary:true,actionIds:['action-rbac-authorize']}),
      feature('roles-copy','复制为独立角色','复制当前角色的显式权限。','“更多→复制角色”，填写新编码与名称再保存。','复制不会携带超级管理员身份；后续权限独立。',{actionIds:['action-role-save']}),
      feature('roles-toggle-delete','启停或删除角色','管理普通角色生命周期。','“更多→停用/启用”或“删除角色”并确认。','停用角色不参与权限并集；仍绑定用户或内置角色不能直接删。',{risk:true,actionIds:['action-role-delete']}),
      feature('roles-recover','恢复内置超级管理员权限','修复当前内置权限目录的缺项。','有效超级管理员在受保护角色“更多→恢复内置权限”确认。','不更换用户身份或绑定，不改业务数据；恢复路径受保护。',{actionIds:['action-rbac-recover']})
    ],
    restrictions:[restriction('roles-protected','操作内置超级管理员或最后有效恢复路径','不能撤销其保护授权、停用/删除造成无法恢复的管理身份。','使用明确“恢复内置权限”，普通角色按实际授权维护。',['rule-role-protection'],true),restriction('roles-delegate','授权缺依赖，或非超级管理员试图授予自己无权委派的权限','提交被拒绝，不因勾选父组或复制角色自动扩权。','逐项明确所需权限和依赖，交给具备委派权限的管理员。',['rule-permission']),restriction('roles-save','角色资料/授权抽屉保存失败','当前草稿及权限差异保留，未成功写盘不视为授权完成。','处理错误并重试；关闭或离开需确认放弃。',['rule-persistence'])]
  },
  'page-permissions': {
    purpose:'查看已经接入执行的权限目录，维护显示说明及允许调整的启停状态。',
    features:[feature('permissions-find','查询正式权限目录','按名称、权限码、资源、模块、类型和状态筛选。','使用顶部搜索与三个下拉，翻页查看。','仅登记已接入权限；不在此新增任意权限码。',{primary:true}),feature('permissions-edit','编辑名称、说明和状态','维护内置权限的展示及启停。','行“编辑”，改允许字段后“保存权限信息”。','权限码、模块、资源、动作、路由和执行绑定只读。',{primary:true,actionIds:['action-permission-save']}),feature('permissions-copy','复制权限码','准确传递稳定授权标识。','编辑抽屉“复制权限码”；剪贴板不可用可选中只读输入框复制。','只复制文字，不授予权限。'),feature('permissions-references','查看引用角色','检查哪些角色持有该权限。','点“引用角色”数量或行“引用”。','只读角色列表，授权变更到角色管理。',{actionIds:['action-permission-reference']})],
    restrictions:[restriction('permissions-disable','权限被业务角色引用或属于恢复路径','不能直接停用；超级管理员目录的非恢复权限可按保护规则调整。','先在角色管理明确撤销普通业务角色引用，再维护可停用项。',['rule-role-protection']),restriction('permissions-identity','希望改权限码或执行绑定','名称编辑不能创造新的能力，也不能把一个权限换绑到别的操作。','新增/变更执行绑定需代码实现，当前页面只维护已登记说明。',['rule-permission']),restriction('permissions-save','保存失败或关闭未保存编辑','草稿保留，未确认退出不会静默丢弃。','修正错误后重新保存。',['rule-persistence'])]
  },
  'page-users': {
    purpose:'维护前端模拟用户、角色绑定及有效授权，便于核对不同身份的实际可用入口。',
    features:[feature('users-search','查用户和绑定角色','按姓名/账号与状态筛选。','顶部搜索、状态筛选；查看角色标签和有效权限数。','停用角色仍显示但不贡献有效权限。'),feature('users-save','新增或编辑用户','维护姓名、账号和启停。','点“新增用户”或行“编辑”，填写后“保存用户”。','账号需唯一；这是本机模拟记录，不创建真实登录账号。',{primary:true,actionIds:['action-user-save']}),feature('users-bind','绑定多个角色','明确选择该用户的角色集合。','用户编辑抽屉“绑定角色”多选，再保存用户。','需独立绑定权限；停用或超出委派范围的角色不可新增授权。',{primary:true,actionIds:['action-user-bind']}),feature('users-effective','查看有效权限','读取启用角色中启用权限的并集。','点权限数量或“更多→查看有效权限”，抽屉可搜索。','查看不修改绑定或切换身份。'),feature('users-simulate','模拟并退出用户','检查所选用户实际权限下的系统。','行“模拟用户”；在顶部或无权限页用“退出权限预览／模拟”返回。','仅有资格且目标启用时可切换，模拟不更改持久角色绑定。',{actionIds:['action-user-preview']}),feature('users-life','启停或删除用户','维护不再使用的模拟用户。','“更多→停用/启用用户”或“删除用户”确认。','当前/受保护管理用户及恢复路径受保护，不能任意删除。',{risk:true})],
    restrictions:[restriction('users-delegate','尝试绑定停用角色、超级管理员身份或操作者无权委派的角色','保存/绑定被拒绝，不通过编辑用户绕过角色授权。','选可委派的有效角色，或由有权限的管理员处理。',['rule-permission','rule-role-protection']),restriction('users-mode','当前为统一管理员模式','权限配置记录仍保留，但并未启用严格运行限制。','看清页面模式提示；严格模式下再核对实际菜单、页面访问和业务操作的拒绝情况。',['rule-permission']),restriction('users-persistence','保存失败或角色绑定未提交','抽屉输入保留，权限不会以未落盘草稿作为成功依据。','解决提示后重新保存用户。',['rule-persistence'])]
  },
  'page-account': {
    purpose:'维护本机显示资料，并演示密码输入校验，不连接真实身份服务。',
    features:[feature('account-profile','保存本机资料','修改资料中的显示名和账号。','填写资料框并点“保存资料”。','输入直接修改本机账号资料；保存按钮等待持久化完成并反馈。',{primary:true,actionIds:['action-account-save']}),feature('account-password','检查密码输入','验证至少6位且两次输入一致。','填“新密码／再输入一次”，点“检查”。','通过后清空输入并提示未保存；不会设置、存储或发送真实口令。',{actionIds:['action-account-password']}),feature('account-limit','了解演示边界','查看未接入的系统能力。','阅读页下“这套演示没有接上的能力”。','此工程没有真实登录、后端事务、采购、库存、订单或财务服务。')],
    restrictions:[restriction('account-rbac','修改账号资料中的显示名/账号','仅改本机资料，不等于修改用户管理中的账号或角色授权。','模拟用户与权限到用户/角色管理维护。'),restriction('account-save','资料保存失败','当前字段仍可能只在内存中，不能保证刷新后恢复。','处理本机存储提示后重试“保存资料”。',['rule-persistence'])]
  },
  'page-feedback': {
    purpose:'在本机查看、标记和交换反馈及附件包，不自动上传服务器或进入开发队列。',
    features:[feature('feedback-find','查询和阅读反馈','按页面和类型找到 Bug、体验、需求或历史反馈。','顶部筛选；行“详情”查看正文与可用附件预览。','读取已有本机记录，不自动创建工单。'),feature('feedback-edit','编辑未导出反馈','修改本机标题和正文。','未导出行点“编辑”，填写两项后“保存到本机”。','已导出反馈不能再改原内容；保存失败保留输入。',{primary:true,actionIds:['action-feedback-save']}),feature('feedback-status','更新本地标记','将反馈标为待看、先记下或本机已看。','行“本地标记”选择状态。','直接进入本机保存队列；不代表开发已接单或修复。'),feature('feedback-open','打开来源页面','返回有权限的反馈来源。','行存在合法且可访问的来源地址 时点“打开页面”。','目标仍检查当前权限和未保存离开确认，不拼造对象。'),feature('feedback-export','导出反馈包','打包全部本机反馈和附件。','点“导出反馈包”。','先完成导出标记持久化再下载 ZIP；需要用户自行发送。',{primary:true,actionIds:['action-feedback-export']}),feature('feedback-import','导入反馈包','读取有效 ZIP 并追加新记录。','点“导入反馈包”选择文件。','按已有反馈 ID 去重，不改商品数据。',{actionIds:['action-feedback-import']}),feature('feedback-delete','删除反馈及附件','清除本机不再需要的反馈。','行“删除”，确认名称和附件清理提示。','反馈成功落盘删除后再清对应附件；无服务器删除操作。',{risk:true})],
    restrictions:[restriction('feedback-exported','反馈已有导出标记','原内容编辑入口禁用，以免改动已发出的原始说明。','需要补充时从业务页创建新反馈，保留原记录。',['rule-feedback-local']),restriction('feedback-local','页面显示“本机已看”或完成导出','只说明本地状态，不代表对方收到、进入开发队列或已解决。','自行发送反馈包并与接收人核对。',['rule-feedback-local']),restriction('feedback-save','保存、导入或导出标记落盘失败','保留错误与当前输入；不能把失败导出当作已交接。','处理存储问题再重试，核对附件可读性。',['rule-persistence'])]
  },
  'page-forbidden': {
    purpose:'解释当前地址无法访问的原因，并保留安全的权限查看与模拟退出入口。',
    features:[feature('forbidden-reason','查看拒绝原因','区分严格权限拒绝和未登记地址。','阅读标题说明及失败规则卡。','不进入被拒绝页面，也不保存该页面业务变更。',{primary:true,actionIds:['action-access-explain']}),feature('forbidden-guide','阅读权限规则','理解需要的权限和可采取的处理。','在规则卡打开对应说明或反馈入口。','阅读帮助不授予访问权，不代替管理员授权。'),feature('forbidden-exit','退出预览或模拟','返回原模拟上下文。','仅处于预览/模拟时点“退出权限预览／模拟”。','不修改角色绑定；退出后仍按返回身份重新判断入口。')],
    restrictions:[restriction('forbidden-authorization','用户/角色/权限停用、缺少页面授权，或地址未登记','不能通过隐藏菜单、修改 URL 或说明链接绕过。','从可见有权入口继续，或请有授权管理权限的用户处理。',['rule-permission'])]
  },
  'page-guide': {
    purpose:'在独立系统说明工作台按页面查功能、规则和相关入口。',
    features:[feature('guide-enter','打开系统说明','从独立一级入口进入同一只读内容源。','点主导航“系统说明”。','直接进入 /guide；不打开空壳菜单，不取消用户固定偏好。',{primary:true}),feature('guide-directory','按页面选择说明','沿真实菜单中心和分组找页面。','左目录点页面；详情族使用已登记说明入口。','右侧展示对应页面，不创建业务记录；文章地址保留系统说明导航归属。',{primary:true,actionIds:['action-guide-read']}),feature('guide-search','搜索页面或功能','缩小目录范围。','输入“搜索页面或功能”，清空恢复目录。','查询说明内容，不修改业务列表筛选或保存视图。',{actionIds:['action-guide-search']}),feature('guide-read','阅读功能、规则与关联页','先看具体功能，再按需查看复杂步骤和限制。','使用“功能说明／规则限制／关联页面”；关联项可查看说明，有业务页权限时可前往。','无具体对象的详情族安全返回真实列表，不编造对象 ID。'),feature('guide-page-help','在业务页就地阅读','查看当前页面同一份说明。','业务页顶部“页面功能”打开抽屉，切换内容后关闭继续编辑。','不改业务 URL、草稿、分类批次或列表勾选；不写进度、收藏或最近阅读。')],
    restrictions:[restriction('guide-read-permission','严格模式没有系统说明阅读权限','独立入口不显示，直接文章地址也被拒绝。','通过有权身份阅读；说明权限不扩大其他页面/动作权限。',['rule-permission']),restriction('guide-readonly','阅读、搜索、打开/关闭说明','说明只供阅读，没有课程、内容维护或阅读记录功能。','若文字与操作不符，用本机反馈描述实际入口和触发步骤。',['rule-guide-isolation']),restriction('guide-pending','原幕布完整列表/字段、手机三类完整物料及覆盖、自动归组、历史回填尚缺确认原文','不能凭说明猜测规则，也不能据此宣称全部老板需求已完成。','按已实现规则操作，待明确需求原文后再确认这些边界。')]
  },
  'page-guide-article': {
    purpose:'用稳定说明地址阅读具体页面、动作或规则，并安全返回原业务上下文。',
    features:[feature('article-content','阅读具体说明','打开页面文章或被失败卡引用的动作/规则。','从目录、关联说明、失败卡或已有说明链接进入。','原页面、动作和规则说明地址继续有效；具体动作或规则也能单独阅读。',{primary:true,actionIds:['action-guide-read']}),feature('article-section','查功能与限制','按需要定位说明内容。','页面文章看功能表，展开必要详情；规则文章核对真实条件和下一步。','不连续重复铺开已在功能表说明的同一动作摘要/步骤/结果。'),feature('article-related','前往关联说明或业务页','按一句具体关系决定后续入口。','关联项“查看说明”阅读；有权时点击注明目标的业务按钮。','只是相关不代表必经前置；对象未知时到列表选择，不拼造详情。'),feature('article-return','返回业务与历史导航','继续原业务，或用浏览器前进后退切换文章。','从业务页进入且显示返回入口时点“返回业务”；否则用目录继续，浏览器前进/后退均可。','文章/首页均高亮系统说明，保持布局、折叠和固定选择；主动离开业务仍有原守卫。')],
    restrictions:[restriction('article-missing','文章 ID 未登记或业务对象未知','显示找不到说明或提供安全目录/列表入口，不编造文章和对象。','点说明目录重新选择；具体对象到对应业务列表查找。'),restriction('article-readonly','打开文章与阅读规则','不写业务数据或旧指南记录，也不把文案当新的提交规则。','实际提交仍按对应业务规则校验，失败时核对具体原因。',['rule-guide-isolation']),restriction('article-pending','文章标注历史入口或待业务确认','历史说明不代表新入口，待核内容不等于已支持或禁止。','读清标记和边界，未确认规则不自行补写。')]
  }
}
