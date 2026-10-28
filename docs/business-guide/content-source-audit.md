# 内容源码核对记录

核对日期：2026-10-25。此记录是静态说明核对，不替代真实页面或失败分支浏览器验收。

已读 router、menuConfig、pageFeatures，并逐页核对模板入口、处理函数和涉及的领域校验。页面分母包括隐藏、动态详情、新建、编辑及列配置 query；别名单列不重复。

<a id="page-home"></a>
## 商品工作台

- 页面：`src/views/WorkbenchView.vue`。
- 实际处理函数：goSearch。
- Store 调用：can、skusOf。
- 本页关键说明：从业务统计、关键词和分类快捷入口找到商品任务；本页本身不创建订单。
- 核对的状态差异：分类统计与 SKU 数不是同一口径；演示数据仅是本机样例。

<a id="page-categories"></a>
## 商品分类中心

- 页面：`src/views/CategoryView.vue`。
- 实际处理函数：recoverMove、panelCategories、chooseMoveTarget、cancelMove、confirmStagedMove、bindPanel、openPanel、closePanel、selectInPanel、pick、reveal、stageSource、openMove、locateSource、targetBlock、panelAction、cancelDrag、startDrag、validDrag、dragOver、drop、flushChanges、performMove、retrySave、renameCategory、escape、openCreate、create、openEdit、saveEdit、copyNode、openProduct、openProducts、remove、openScheme。
- Store 调用：addCategory、can、categoryRemovalBlock、commitCategoryMove、copyCategory、flushPersistence、moveCategory、relocateCategory、removeCategory、setCategoryMapping、updateCategory。
- 本页关键说明：查看目录与商品引用，并在编辑模式维护分类及移动子树。
- 核对的状态差异：目标绑定类型后不能继续接收子分类；来源绑定类型本身不等于禁止来源移动。

<a id="page-product-types"></a>
## 产品类型

- 页面：`src/views/ProductTypeView.vue`。
- 实际处理函数：walk、categoryLinks、modelsOf、typeMoveBlock、onTargetCategory、onPick、onExpand、reveal、onViewModels、openModel、nextSort、openCreate、openEdit、save、onStatus、onRemove。
- Store 调用：can、canRoute、flushPersistence、productTypesOf、removeProductType、saveProductType、setProductTypeStatus。
- 本页关键说明：给末级分类显式建立类型，并查看类型关联的模型。
- 核对的状态差异：已有关联模型/商品的类型不能任意迁移或删除；目标末级分类约束按实际检查执行。

<a id="page-params"></a>
## 属性词典

- 页面：`src/views/ParamView.vue`。
- 实际处理函数：usedTemplates、edit、saveName、openBrand、openCreate、flushChanges、addValue、removeValue、remove。
- Store 调用：can、flushPersistence、removeParam、removeParamValue。
- 本页关键说明：维护全局属性、实际取值和取值分组；全局维护会影响后续候选。
- 核对的状态差异：允许值配置本身就是引用，尚未创建对应节点也受保护；同名值不能跨属性混判。

<a id="page-templates"></a>
## 属性方案

- 页面：`src/views/TemplateView.vue`。
- 实际处理函数：canTemplate、names、paramName、refCount、productCount、categoryNames、impactText、bindOf、roleOf、requiredOf、onRoleChange、onRequiredChange、dropBind、edit、move、addParam、save、onEnabled、schemeBinds、create、flushChanges、copy、preview、remove。
- Store 调用：can、copyProductModel、flushPersistence、removeTemplate、saveTemplateScheme。
- 本页关键说明：建立可被分类复用的公共/规格属性录入方案；普通方案与模型分开维护。
- 核对的状态差异：引用中的方案删除受保护；方案状态变化不重写历史商品；模型条目按模型权限处理。

<a id="page-models"></a>
## 商品模型列表

- 页面：`src/views/ModelListView.vue`。
- 实际处理函数：statusText、ensure、open、openCreate、onCategoryValue、onCategory、create、setStatus、copy。
- Store 调用：can、copyProductModel、createProductModel、flushPersistence、productTypesOf、publishSpecModel。
- 本页关键说明：按分类和显式产品类型管理模型的草稿、发布和下线入口。
- 核对的状态差异：不能凭模型同名合并身份；未保存草稿不自动成为发布依据。

<a id="page-specs"></a>
## 商品模型设计

- 页面：`src/views/SpecConfigView.vue`。
- 实际处理函数：storedFold、setTreeFold、setRailFold、toggleCategory、clearOpenModel、belongsToLeaf、selectCategory、focusType、openModel、createModelFor、editContext、sameContext、validContext、captureAddAnchor、dictSelects、selectExpanded、closeDictDropdown、onDictEsc、locateBusiness、saveBusiness、openTemplateCompatibility、validDialog、invalidateEditorDialogs、layoutOriginX、freshNodes、placeFreshNodes、manualHold、ensureTreeLayout、reflowTree、ensureCanvas、attributeSourceLabel、attributeValueText、attributeHint、outlineOptions、applyOutlineCreate、rememberAttrQuery、rememberValueQuery、beginCreateAttribute、beginCreateValue、resetValueComposer、applyOutlineChoice、openHostConfig、ruleMark、nodeTitle、valueOptions、attributeOptions、childCount、matchesView、nodeOpen、isShown、visibleAnchor、viewChildCount、pathIds、toggleMap、paint、measuredBox、treeBusPath、closeFloating、revealAncestors、onNodeClick、canvasSize、contentBounds、frameCanvas、fitAll、zoomReset、onZoomCommand、toggleAllBranches、revealNode、onNodesReady、onNodeDoubleClick、beginEdit、cueOutline、outlineIds、orderSiblings、finishUndo、pushUndo、cancelUndo、undoOutline、attachParam、ensureParam、linkAttribute、renameOutline、addOutline、removeOutline、promoteOutline、shiftOutline、openNodeDraft、confirmNodeDraft、moveOutline、commitInline、openNodeMenu、onNodeMenu、runMenu、illegalStructure、onNodeDragStart、onNodeDragStop、hitNode、reparent、reparentUnchecked、onViewportMove、onMoveEnd、tidy、useManualLayout、setExpanded、toggleExpand、queryText、sessionValue、carriedOverview、setOverviewView、setOverviewRoot、restoreOverviewMemory、setSurface、openFromOverview、backToOverview、enterEdit、saveModel、recoverPublish、publish、markWorkingDraft、openAttributeAt、resetAttrComposer、openGlobalRename、saveGlobalName、openValuePicker、openBindAttribute、nextSort、insertAttributeNodes、createDictionaryAttribute、createDictionaryValueForNode、rebindPickedValue、addAttribute、addValues、descendantIds、remove、openCopyCurrent、openCopyPicker、confirmCopy、pickNode、focusBoard、openMaterialDetail、visibleSelectableIds、selectAllCombos、invertComboSelection、openComboMaterial、batchCreateMaterials、markGrade、openTemporary、visibleOverlay、shortcutBlocked、isTypingTarget、onKey。
- Store 调用：can、copyProductModel、createMaterial、createProductModel、flushPersistence、markPlanningGrades、publishSpecModel、removeSpecNode、saveModelDraft、saveNodeBusiness。
- 本页关键说明：在结构、大纲、幕布中维护同一模型树，配置节点命名、业务与合法组合。
- 核对的状态差异：属性直接子级不能混挂属性和值；分支顺序按真实树保留；显示关联物料只控制展示。

<a id="page-plans"></a>
## 商品规划（保留入口）

- 页面：`src/views/ProductPlanView.vue`。
- 实际处理函数：attrName、skuCount、modelName、productOf、generateProduct、enter、choose、openPlan、save、removePlan。
- Store 调用：can。
- 本页关键说明：基于发布模型保存选定上层取值范围，再选择 SPU 追加真实 SKU。
- 核对的状态差异：不枚举树上不存在的跨分支组合；选最末值只覆盖其实际完整路径。

<a id="page-tree"></a>
## 商品结构视图

- 页面：`src/views/TreePage.vue`。
- 实际处理函数：filterTree。
- Store 调用：本页读取/复用组件处理；没有在说明中捏造写入按钮。
- 本页关键说明：用已保存业务对象的结构帮助查询和定位商品，本页无写入操作。
- 核对的状态差异：只读树不替代实际规格组合和来源判断。

<a id="page-spus"></a>
## SPU 管理

- 页面：`src/views/ProductListView.vue`。
- 实际处理函数：openCompatibilityFamily、onSkuSelect、removeSkuMany、applyPreset、removePreset、realSkus、realCount、brandText、saleCount、materialSummary、planSource、warn、switchDisplayView、onKeyword、quickState、chosen、setExposedValue、quickText、setQuickText、toggleCategory、clearCategory、removeSummary、clearFilters、kindOf、fieldOptions、operatorsFor、liveQuery、touchFilters、addCondition、changeFilterField、changeFilterOperator、categoryConditionId、categoryConditionIds、textValue、setConditionValue、removeCondition、dateRange、setDate、toggleGroup、onSortMode、stageLabel、toggleColumn、moveColumn、manageView、resetColumns、openCreate、confirmCreate、openSettings、confirmRename、confirmCopy、confirmDelete、saveFilter、familyRole、compatTitle、compatTarget、copyFamily、removeFamily、onFamilySelect、flushListChanges、setShelfMany、removeMany、removeSku、copySku、onSelect、batchStatus。
- Store 调用：can、defaultColumns、flushPersistence、patchSku、removeFamily、removeSku、setSkuStatus。
- 本页关键说明：以商品主体为单位查询、分组和维护，并分批追加其下 SKU。
- 核对的状态差异：显式手动列宽/冻结和旧视图保留；品牌汇总与规格品牌是不同字段；发布商品不能直接删除。

<a id="page-spu-create"></a>
## 新建 SPU

- 页面：`src/views/SpuEditView.vue`。
- 实际处理函数：saved。
- Store 调用：can。
- 本页关键说明：独立保存商品主体，可先没有 SKU，再分批追加。
- 核对的状态差异：名称必填；分类/类型/模型来源一致；状态发布需独立发布能力。

<a id="page-spu-edit"></a>
## SPU 详情

- 页面：`src/views/SpuEditView.vue`。
- 实际处理函数：saved。
- Store 调用：can。
- 本页关键说明：维护已存在主体资料，查看真实 SKU、物料和绑定版本。
- 核对的状态差异：来源身份不能随意更换；动态 id 不会生成另一套手册。

<a id="page-skus"></a>
## SKU 管理

- 页面：`src/views/SkuWorkbenchView.vue`。
- Store 调用：can、patchSku、removeSku、setSkuStatus。
- 本页关键说明：按真实销售 SKU 查询，维护工作配置与正式保存视图。
- 核对的状态差异：SPU 路由临时范围与视图相交，默认不保存到全部 SKU；手工排序与字段排序/分组冲突时暂停拖排。

<a id="page-sku-create"></a>
## 新增 SKU

- 页面：`src/views/SkuCreateView.vue`。
- 实际处理函数：selectFamily、setFamily、preview、toggle、toggleAll、submit、openSpu、spuSaved、back、recoverGuide。
- Store 调用：appendSkus、can。
- 本页关键说明：选择已存在 SPU 后手工、模板、发布模型或规划方式预览追加规格。
- 核对的状态差异：预览不写盘；已有身份不重复创建；切换 SPU 要确认丢弃当前候选。

<a id="page-sku-edit"></a>
## 编辑 SKU

- 页面：`src/views/SkuEditView.vue`。
- 实际处理函数：save、back、recoverGuide。
- Store 调用：can、editSku。
- 本页关键说明：维护单条销售 SKU 的允许字段，保持所属主体和来源。
- 核对的状态差异：不能用 MAT ID 冒充 SKU；有来源的身份字段按真实约束锁定。

<a id="page-material-create"></a>
## 物料建档

- 页面：`src/views/MaterialCreateView.vue`。
- 实际处理函数：openMaterial。
- Store 调用：can、productTypesOf。
- 本页关键说明：从已发布规划或临时流程建立 MAT 档案。
- 核对的状态差异：正式与临时来源分开；版本和组合不能凭名称拼接；预览不创建记录。

<a id="page-material-edit"></a>
## 物料档案

- 页面：`src/views/ProductEditView.vue`。
- 实际处理函数：colorOf、blankFamily、cloneSku、categoryBlock、onCategoryValue、onCategory、savedVariantColumns、fillName、onCommonChange、fieldChoices、choices、decorateHint、commonHint、skuHint、errorText、issueKey、issueValue、issueReason、issueAdvice、toggleIssue、onSelection、resetSelection、truncateSelection、rowTitle、specEntries、columnChoices、variantKey、modelDraft、openTemporary、syncFromModel、addSku、copySku、openValue、confirmValue、applyBatch、locate、setShelf、save、cancel、loadRoutedFamily。
- Store 调用：blankSku、can、saveBundle、skusOf。
- 本页关键说明：在物料所属主体内查看指定档案、来源、范围关联和允许维护字段。
- 核对的状态差异：指定记录必须匹配主体；范围覆盖按完整 PLN 去重，不按展示文字合并。

<a id="page-compatibility"></a>
## 适用关系

- 页面：`src/views/CompatibilityView.vue`。
- 实际处理函数：由复用组件和 computed 读取处理；见 source 文件。
- Store 调用：can。
- 本页关键说明：按设备型号与真实对象维护双向适用声明，并保留原物料维护入口。
- 核对的状态差异：基本适用不等于快充；MAT 声明不能自动冒充 SKU 声明；人工取消/修改跨版本受保护。

<a id="page-brands"></a>
## 品牌中心

- 页面：`src/views/BrandView.vue`。
- 实际处理函数：openCreate、edit、save、setStatus。
- Store 调用：can、saveBrand。
- 本页关键说明：维护后续选用的品牌目录名称、标识、说明和启停。
- 核对的状态差异：改目录名称不会自动改全部商品；页面没有删除品牌入口。

<a id="page-groups"></a>
## 运营分组

- 页面：`src/views/GroupView.vue`。
- 实际处理函数：walk、onPick、create、link。
- Store 调用：can、removeGroup。
- 本页关键说明：维护活动/推荐用分组树，并显式选择关联商品。
- 核对的状态差异：取消某分组关联不删除商品；不是分类移动工具。

<a id="page-rules"></a>
## 规格约束

- 页面：`src/views/RuleView.vue`。
- 实际处理函数：blank、paramName、templateName、valuesOf、conditionText、edit、create、copy、save、setEnabled。
- Store 调用：can、saveRule。
- 本页关键说明：维护“当条件成立时目标属性允许哪些值”的现行规则并测试。
- 核对的状态差异：无法无损转换的旧规则不参与校验；允许值冲突须回实际条件检查。

<a id="page-mappings"></a>
## 属性方案绑定（历史入口）

- 页面：`src/views/MappingView.vue`。
- 实际处理函数：mapping、onMap。
- Store 调用：can、setCategoryMapping。
- 本页关键说明：保留分类到方案的旧维护入口，新人优先去分类中心绑定。
- 核对的状态差异：清空绑定不删除方案；不把隐藏菜单当撤销路由权限。

<a id="page-overview"></a>
## 商品总览

- 页面：`src/views/OverviewView.vue`。
- 实际处理函数：groupLabel、cellClass、openCell。
- Store 调用：skusOf。
- 本页关键说明：按已有商品主体/规格矩阵查询整体商品结构，本页无写入操作。
- 核对的状态差异：空格不等于合法但尚未生成的所有组合；统计口径以现有销售记录为准。

<a id="page-check"></a>
## 商品质量检查

- 页面：`src/views/CheckView.vue`。
- 实际处理函数：由复用组件和 computed 读取处理；见 source 文件。
- Store 调用：skusOf。
- 本页关键说明：列出当前校验发现的必填、重复和非法取值，定位原对象处理。
- 核对的状态差异：不能把空列表解释成所有业务需求都满足。

<a id="page-import"></a>
## 商品导入导出

- 页面：`src/views/ProductIoView.vue`。
- 实际处理函数：attrText、blockCount、sheetRows、downloadTemplate、exportBooks、onFile、toggleSheet、buildPreview、toggleAlias、toggleTemporary、chooseModel、installModels、confirm。
- Store 调用：can、commitMaterialImport、materialImportBasis、skusOf。
- 本页关键说明：下载模板、导出备份并通过预览/明确确认恢复或导入本机数据。
- 核对的状态差异：禁止跨 MAT/SKU 身份混用，坏结构或真实框架组外成员不能靠导入绕过。

<a id="page-columns-spu"></a>
## SPU 列配置与视图

- 页面：`src/views/ProductListView.vue`。
- 实际处理函数：openCompatibilityFamily、onSkuSelect、removeSkuMany、applyPreset、removePreset、realSkus、realCount、brandText、saleCount、materialSummary、planSource、warn、switchDisplayView、onKeyword、quickState、chosen、setExposedValue、quickText、setQuickText、toggleCategory、clearCategory、removeSummary、clearFilters、kindOf、fieldOptions、operatorsFor、liveQuery、touchFilters、addCondition、changeFilterField、changeFilterOperator、categoryConditionId、categoryConditionIds、textValue、setConditionValue、removeCondition、dateRange、setDate、toggleGroup、onSortMode、stageLabel、toggleColumn、moveColumn、manageView、resetColumns、openCreate、confirmCreate、openSettings、confirmRename、confirmCopy、confirmDelete、saveFilter、familyRole、compatTitle、compatTarget、copyFamily、removeFamily、onFamilySelect、flushListChanges、setShelfMany、removeMany、removeSku、copySku、onSelect、batchStatus。
- Store 调用：can、defaultColumns、flushPersistence、patchSku、removeFamily、removeSku、setSkuStatus。
- 本页关键说明：通过列配置 query 直接打开 SPU 列/分组/排序设置；与 SPU 列表共用配置。
- 核对的状态差异：不擅自覆盖自定义旧视图；展示列不改变 SPU/SKU 身份。

<a id="page-columns-sku"></a>
## SKU 字段与视图设置

- 页面：`src/views/SkuWorkbenchView.vue`。
- Store 调用：can、patchSku、removeSku、setSkuStatus。
- 本页关键说明：识别 SKU 的列配置 query 上下文并解释工作配置/正式视图区别。
- 核对的状态差异：系统视图、SPU 临时范围和普通自定义视图遵循原有隔离。

<a id="page-menus"></a>
## 菜单配置

- 页面：`src/views/MenuConfigView.vue`。
- 实际处理函数：required、permissionFor、parentPath、kindText、setExpanded、open、onRoute、closeDrawer、commit、save、canMove、shift、remove、restore。
- Store 调用：can、resetMenuStructure、saveMenuStructure。
- 本页关键说明：维护真实导航结构、页面放置、改名隐藏和顺序，不直接授予业务权限。
- 核对的状态差异：隐藏不撤销严格模式路由授权；非空容器不能直接删除；菜单不能造任意网址。

<a id="page-roles"></a>
## 角色管理

- 页面：`src/views/RoleView.vue`。
- 实际处理函数：usersOf、openRole、closeEdit、closeGrant、saveRole、toggleRole、removeRole、showUsers、openGrants、checked、filterPermission、expandPermissions、saveGrants、restoreSuperAdmin。
- Store 调用：can、grantRbacRole、removeRbacRole、restoreSuperAdminAccess、saveRbacRole。
- 本页关键说明：维护角色及显式授权，查询关联用户与授权差异。
- 核对的状态差异：内置超级管理员和恢复能力不能随意撤销；角色授权不等于菜单显示设置。

<a id="page-permissions"></a>
## 权限目录

- 页面：`src/views/PermissionView.vue`。
- 实际处理函数：references、showReferences、open、closeEdit、copyCode、save。
- Store 调用：can、saveRbacPermission。
- 本页关键说明：查看内置权限的资源/动作/路由绑定并维护说明、显示名和允许的状态。
- 核对的状态差异：恢复路径受保护；被角色引用的权限停用依当前检查拒绝。

<a id="page-users"></a>
## 用户管理

- 页面：`src/views/UserView.vue`。
- 实际处理函数：delegable、userRoles、open、closeEdit、save、toggle、remove、simulate、showPermissions。
- Store 调用：can、removeRbacUser、saveRbacUser、simulateUser。
- 本页关键说明：维护本机演示用户、角色绑定和受控身份预览。
- 核对的状态差异：不能从旧“管理员/运营”菜单开关推断现行授权；受保护管理员保留恢复路径。

<a id="page-account"></a>
## 账号设置

- 页面：`src/views/AccountView.vue`。
- 实际处理函数：saveProfile、checkPassword。
- Store 调用：can、flushPersistence。
- 本页关键说明：维护当前本机账号资料并演示密码格式校验。
- 核对的状态差异：无真实后端身份认证或密码重置承诺。

<a id="page-feedback"></a>
## 反馈管理

- 页面：`src/views/FeedbackView.vue`。
- 实际处理函数：kindText、canOpen、openDetail、openEdit、flushChanges、saveEdit、remove、exportAll、pickPack、onImport。
- Store 调用：can、canRoute、flushPersistence、importFeedbackPack、markFeedbacksExported。
- 本页关键说明：查询和导出本机反馈及附件，保留来源页面/功能的历史关联。
- 核对的状态差异：已导出的记录不能照原编辑流程改写；指南反馈只带最小来源字段，不打包业务库。

<a id="page-forbidden"></a>
## 无访问权限

- 页面：`src/views/ForbiddenView.vue`。
- 实际处理函数：由复用组件和 computed 读取处理；见 source 文件。
- Store 调用：stopPermissionPreview。
- 本页关键说明：解释当前页面不可访问并提供返回和可用入口；本页无写入操作。
- 核对的状态差异：默认统一管理员也只接受登记路由；本页作为辅助状态不重复计入正式业务页面分母。

<a id="page-guide"></a>
## 业务指南首页

- 页面：`src/views/guide/GuideHomeView.vue`。
- 实际处理函数：changeTab、download、restoreProgress。
- Store 调用：can。
- 本页关键说明：按业务概念、页面、动作、规则和问题搜索同一内容源。
- 核对的状态差异：不自动创建示例商品或重置数据库；无结果不编造答案。

<a id="page-guide-article"></a>
## 指南文章

- 页面：`src/views/guide/GuideArticleView.vue`。
- 实际处理函数：open。
- Store 调用：can。
- 本页关键说明：阅读统一页面、动作和规则详情，按目录与相关条目继续查阅。
- 核对的状态差异：说明编辑不改变业务规则；待业务确认不是实际限制。

<a id="page-guide-learn"></a>
## 新人学习路线

- 页面：`src/views/guide/GuideLearnView.vue`。
- 实际处理函数：move、openRelated。
- Store 调用：canRoute。
- 本页关键说明：按真实任务目标循序阅读、练习并核对结果。
- 核对的状态差异：没有考试、排名或自动生成演示数据。

<a id="page-guide-manage"></a>
## 指南内容维护

- 页面：`src/views/guide/GuideManageView.vue`。
- 实际处理函数：load、select、updateSection、addSection、removeSection、candidate、saveDraft、preview、publish、readLatest、restorePrevious、download、exportBackup、readImport、previewImport、confirmImport。
- Store 调用：can。
- 本页关键说明：维护解释/步骤/示例的草稿、预览和发布，查看覆盖与缺口。
- 核对的状态差异：管理员改文案不放宽业务校验；冲突不允许后写静默覆盖。

<a id="action-workbench-search"></a>
### 从工作台查商品

真实步骤：输入关键词 → 进入商品列表并核对筛选范围。结果：展示已有主体结果，不创建商品。失败：无结果清词并核对分类。

<a id="action-workbench-issues"></a>
### 从工作台定位问题

真实步骤：查看问题统计 → 打开商品质量检查。结果：进入真实问题列表。失败：问题对象失效时回商品列表查询。

<a id="action-category-create"></a>
### 新建分类

真实步骤：切换编辑模式 → 选上级或新增根分类，填写名称后保存。结果：分类加入指定层级并持久化。失败：名称为空修正；目标绑定类型改选上级。

<a id="action-category-rename"></a>
### 改分类名

真实步骤：编辑模式双击名称 → 填写名称并回车确认。结果：同一分类 ID 显示新名称。失败：空名称或来源失效先修正；取消不改名，写盘失败按原提示处理。

<a id="action-category-move"></a>
### 移动分类子树

真实步骤：右侧暂存来源 → 左侧选目标或顶级分类 → 核对路径后确认移动。结果：整个真实子树移动并保存。失败：目标类型/循环/失效拒绝；保留待移动内容另选目标。

<a id="action-category-copy"></a>
### 复制分类树

真实步骤：选择来源并点击复制 → 确认复制分类及子分类。结果：产生独立分类，不复制商品。失败：不可用来源先刷新定位；失败不当作完成。

<a id="action-category-delete"></a>
### 删除分类

真实步骤：核对引用和挂载商品 → 确认删除分类。结果：仅合法空分类被删除。失败：有子分类、商品或产品类型先处理真实下游；合法删除会清对应方案绑定，不级联删商品。

<a id="action-type-save"></a>
### 保存产品类型

真实步骤：选分类范围和目标分类 → 填写类型名称并保存。结果：类型显式关联目标分类。失败：末级或引用限制失败先核对分类与模型。

<a id="action-type-models"></a>
### 查看类型模型

真实步骤：选中类型 → 打开查看模型。结果：定位该类型的既有模型。失败：无关联模型可从模型页按权限创建。

<a id="action-type-delete"></a>
### 删除产品类型

真实步骤：查看模型和商品引用 → 确认删除。结果：仅未受引用的类型移除。失败：有引用先维护关联，不自动清历史。

<a id="action-dictionary-save"></a>
### 保存全局属性与取值

真实步骤：打开新建参数或编辑 → 填写正式名称和值并保存。结果：全局候选更新。失败：重名多义先按 ID 选择，不按文字强行合并。

<a id="action-dictionary-value-remove"></a>
### 删除或改名词典取值

真实步骤：确认所属属性 ID 和实际值 → 阅读引用来源后执行允许维护。结果：未引用值可维护，引用值受保护。失败：草稿/历史/允许值配置引用时停止并定位原节点。

<a id="action-template-create"></a>
### 新建属性方案

真实步骤：点击新建方案 → 配置名称和绑定属性 → 确认保存。结果：正式方案落盘，取消无半成品。失败：必填、权限或存储失败保留当前草稿。

<a id="action-template-save"></a>
### 配置方案绑定

真实步骤：加入词典属性 → 选择公共/规格、必填和顺序 → 核对影响后保存。结果：相同方案绑定更新。失败：被引用影响需确认，非法绑定先修复。

<a id="action-template-copy"></a>
### 复制属性方案

真实步骤：选择源方案复制 → 在独立草稿改名称与属性 → 保存副本。结果：新方案有独立身份，原方案不变。失败：取消不留孤立副本；模型源走模型复制保护。

<a id="action-template-delete"></a>
### 删除属性方案

真实步骤：检查引用数量 → 确认删除。结果：未引用方案移除。失败：有分类/商品引用先核对关联。

<a id="action-model-create"></a>
### 新建模型

真实步骤：选择分类和显式产品类型 → 填写模型名并创建。结果：产生空白模型草稿。失败：分类类型不一致重新选择。

<a id="action-model-copy"></a>
### 复制模型

真实步骤：选择已有模型复制 → 核对新草稿名称与结构。结果：复制结构和配置，不复制商品及历史版本。失败：权限或源模型失效时保留原模型并重选。

<a id="action-model-publish"></a>
### 发布模型版本

真实步骤：先保存模型 → 结构检查并定位词典/业务问题 → 确认发布。结果：生成新的不可变发布快照。失败：词典缺失/结构混挂/未知配置修复后重发。

<a id="action-model-offline"></a>
### 下线模型

真实步骤：在模型列表选择下线 → 核对后续使用限制。结果：后续新建不再使用下线模型，历史依旧读原版。失败：没有更新权限不能改变状态。

<a id="action-model-edit"></a>
### 编辑模型节点

真实步骤：进入编辑并选择结构/大纲/幕布 → 引用词典建立真实属性/值 → 保存模型。结果：草稿树更新，发布版不自动改变。失败：混挂子级或无词典引用定位具体节点。

<a id="action-node-business-save"></a>
### 保存值节点业务配置

真实步骤：选择值节点打开业务配置 → 选择公共定义、范围和实例参数 → 检查冲突再保存。结果：配置附着于该值，不增加规格分支。失败：未知类型保留原文并禁止受影响发布。

<a id="action-node-naming-save"></a>
### 设置节点命名

真实步骤：选节点命名规则 → 编辑片段并预览真实组合 → 保存模型后发布。结果：按最近适用祖先规则得到建议名称。失败：冲突看来源，不自动改写旧物料名。

<a id="action-planning-save"></a>
### 保存规划范围

真实步骤：进入发布模型 → 选择上层真实取值并核对名称 → 保存规划。结果：保留所选范围与具体版本。失败：来源失效重新读取发布依据。

<a id="action-planning-create-sku"></a>
### 从规划追加 SKU

真实步骤：在规划点创建 SKU → 选择兼容 SPU → 预览、勾选可新增并确认。结果：每条新增 SKU 留存规划/版本来源。失败：已有身份跳过；不兼容主体重新选择。

<a id="action-planning-delete"></a>
### 删除保存规划

真实步骤：核对已有商品与来源引用 → 点击删除并处理提示。结果：允许删除的规划移除。失败：引用限制保留原记录，先查看下游。

<a id="action-tree-query"></a>
### 在结构视图定位商品

真实步骤：展开结构 → 选择对象并打开商品。结果：进入真实详情，结构本身只读。失败：空树先核对已保存数据和范围。

<a id="action-spu-query"></a>
### 查询 SPU

真实步骤：选视图和分类 → 输入关键词与真实字段条件 → 用标签清除条件。结果：结果按主体统计，SKU/MAT 分别展示。失败：无结果先清条件；保留临时范围。

<a id="action-spu-view"></a>
### 配置 SPU 视图

真实步骤：打开列表设置 → 调整字段顺序、分组排序 → 核对自动保存或另存视图。结果：配置按现有本机约定恢复。失败：不擅自清旧视图；恢复默认列是明确操作。

<a id="action-spu-delete"></a>
### 删除 SPU

真实步骤：核对上下架和子记录 → 更多中删除并确认。结果：只有允许的空主体可删除。失败：已发布先下架；有 SKU/MAT 或引用先处理。

<a id="action-spu-save"></a>
### 保存 SPU 主体

真实步骤：填写主体名和合法分类来源 → 核对公共信息及状态 → 保存或保存并新增 SKU。结果：先写主体，再明确进入 SKU 创建。失败：必填/身份锁定/权限失败修正原输入；写盘失败重试。

<a id="action-spu-history"></a>
### 查看主体历史依据

真实步骤：打开已有 SPU → 点击查看历史快照。结果：读取绑定的具体发布节点快照。失败：无绑定版如实显示未绑定，不补造来源。

<a id="action-sku-query"></a>
### 查询销售 SKU

真实步骤：选择视图及临时搜索 → 在更多筛选编辑 AND/OR 条件 → 核对范围、结果与清除标签。结果：只查询真实销售记录。失败：失效配置暂停查询，修复字段而非扩大范围。

<a id="action-view-save"></a>
### 保存 SKU 列表视图

真实步骤：在字段/筛选/排序面板应用工作配置 → 保存视图或另存为 → 刷新核对。结果：正式配置与本机工作配置按原约定保存。失败：存储失败保留工作配置，修正后重试。

<a id="action-view-restore"></a>
### 恢复 SKU 正式视图

真实步骤：确认不需当前未保存工作配置 → 点击恢复已保存配置。结果：恢复当前正式配置，临时搜索仍按原流程保留。失败：不把恢复视图当重置商品数据。

<a id="action-sku-manual-order"></a>
### 跨页手工排序

真实步骤：清除冲突分组和字段排序 → 勾选行加入排序暂存 → 在目标更多中插到前面/后面并确认。结果：只改变手工展示顺序。失败：对象失效或排序冲突先修正范围，不删除业务记录。

<a id="action-sku-preview"></a>
### 预览新增 SKU

真实步骤：选有效 SPU 和生成方式 → 填写规格并预览 → 区分可新增/已存在/无效。结果：预览不写业务数据。失败：来源不一致补 SPU；变化后重新预览。

<a id="action-sku-save"></a>
### 保存销售 SKU

真实步骤：新增页确认勾选规格，或编辑页改允许字段 → 等待保存成功。结果：创建或更新真实 SKU，保留主体和来源。失败：重复/非法身份拒绝，保留输入并重新核对。

<a id="action-material-create"></a>
### 正式物料建档

真实步骤：选择一致分类类型和发布版 → 选择完整规划并预览 → 确认建档。结果：生成 MAT 并保存原始 PLN/版本依据。失败：来源或规划失效重新选择，不覆盖旧档。

<a id="action-material-temporary"></a>
### 创建临时物料

真实步骤：选择类型并打开临时物料 → 填写实际人工属性和名称 → 明确确认保存。结果：创建无伪造正式 PLN 的临时 MAT。失败：类型/输入不合法修正，不补造发布路径。

<a id="action-material-edit"></a>
### 维护物料档案

真实步骤：按主体路径和 sku query 定位 MAT → 查看编号来源并改允许字段 → 保存。结果：原编号/原来源保持，允许资料更新。失败：指定记录不属主体或是 SKU 时重选正确对象。

<a id="action-material-relation"></a>
### 节点范围建档或关联现有 MAT

真实步骤：选指定发布版和锚点范围 → 预览覆盖及兼容贡献 → 明确新建或选择已有 MAT 并确认。结果：一个 MAT 可关联多真实路径，不扩建第二身份。失败：人工保护/依据变更重新核对；版本范围确认不恢复取消声明。

<a id="action-material-unlink"></a>
### 解除新增物料关联

真实步骤：从档案查看有效来源 → 选允许解除的新增关系 → 确认解除。结果：新增关系撤销，原始建档与历史回执保留。失败：原始建档事实不作为普通新增关系删除。

<a id="action-compatibility-bind"></a>
### 绑定明确设备型号

真实步骤：核对目标身份与型号来源 → 选择合法主机型号并保存绑定。结果：后续声明查询有明确设备上下文。失败：非法或歧义绑定改选正式型号，不按文字自动合并。

<a id="action-compatibility-declare"></a>
### 维护适用声明

真实步骤：选择配件和主机粒度 → 填基本结论、能力、条件及依据 → 保存并双向查询。结果：正式结论带来源；在售状态另行显示。失败：冲突/缺依据处理真实声明，不把 MAT 当 SKU。

<a id="action-compatibility-sync"></a>
### 同步模板适用更新

真实步骤：检查模板更新 → 预览新增/变化/冲突 → 确认允许的贡献范围。结果：管理来源按规则同步，人工决定保持。失败：新依据使旧预览失效；人工保护需保留，不能自动恢复。

<a id="action-compatibility-cancel"></a>
### 人工取消适用声明

真实步骤：查看当前声明和来源 → 明确取消并保存。结果：贡献记录标记人工取消，历史来源保留。失败：后续只改备注/依据/核验状态不解除人工保护。

<a id="action-brand-save"></a>
### 保存品牌目录

真实步骤：新增/编辑名称标识说明 → 点击保存或切换状态并核对。结果：后续候选目录更新，旧商品文字不重写。失败：名称必填；失败保留当前编辑。

<a id="action-group-create"></a>
### 建立运营分组

真实步骤：新建根分组或子组 → 填写名称。结果：得到活动分组，不改分类。失败：维护失败看持久化提示，不重复生成无意义组。

<a id="action-group-link"></a>
### 保存分组商品关联

真实步骤：选择当前分组 → 多选商品后保存关联。结果：只更新该分组的商品集合。失败：无分组先选中；解除关联不删商品。

<a id="action-constraint-save"></a>
### 保存规格允许值规则

真实步骤：选择方案和条件 → 设置目标属性与允许值 → 保存并核对冲突。结果：现行规则参与原约束求值。失败：旧规则原文仅参考，不强行转成新规则。

<a id="action-constraint-test"></a>
### 测试规则覆盖

真实步骤：选择方案和测试取值 → 读取未覆盖/空候选/允许值说明。结果：只读求值，不保存商品。失败：无覆盖不擅自推断新业务规则。

<a id="action-mapping-save"></a>
### 修改分类方案绑定

真实步骤：在分类中心或旧绑定页选择方案 → 核对分类上的实际绑定。结果：共享 mappings 更新。失败：无结构方案先补属性，清空不删除方案。

<a id="action-overview-query"></a>
### 查看商品矩阵

真实步骤：选择整款/矩阵 → 按分类定位现有商品。结果：只读已有销售记录。失败：矩阵空位不是创建授权。

<a id="action-check-locate"></a>
### 定位质量问题

真实步骤：读取问题对象和字段 → 进入原详情修正 → 保存后重新检查。结果：问题页不自动修正业务。失败：删除对象不再定位时回列表核对。

<a id="action-json-import"></a>
### 恢复 JSON 备份

真实步骤：先导出原备份 → 选择合法 JSON 并核对权限/结构 → 明确恢复并等待保存。结果：合法业务配置和冻结信息完整保留。失败：结构/权限/身份失败拒绝；损坏原文走恢复，不加载种子覆盖。

<a id="action-table-import"></a>
### 确认表格导入

真实步骤：匹配字段并预览 → 处理错误和重复 → 确认写入当前有效候选。结果：仅确认合法候选写入。失败：依据变化重新预览；存储失败按保存状态重试。

<a id="action-backup-export"></a>
### 导出业务备份

真实步骤：选择当前范围/模板或 JSON 导出 → 下载并妥善保存文件。结果：只读导出，不改业务。失败：下载失败重试导出，不清本机数据。

<a id="action-menu-save"></a>
### 保存菜单结构

真实步骤：选择中心/分组/正式路由 → 填写上级、名称、排序、隐藏及权限 → 保存。结果：真实导航更新，权限执行绑定不被文案改写。失败：非空容器/非法路由/缺权限先修正。

<a id="action-menu-restore"></a>
### 恢复默认菜单结构

真实步骤：核对恢复范围 → 确认恢复默认菜单。结果：只恢复菜单，不重置授权和业务。失败：写盘失败保留原菜单并处理本机保存提示。

<a id="action-role-save"></a>
### 保存角色资料

真实步骤：新建或复制角色 → 填写唯一编码和名称 → 保存角色。结果：得到明确角色，不自动增加业务授权。失败：重码/受保护身份按提示修正。

<a id="action-rbac-authorize"></a>
### 显式保存角色授权

真实步骤：选择当前已登记权限 → 核对依赖和影响用户 → 保存授权。结果：只保存明确勾选能力，并集按启用角色计算。失败：缺依赖不自动补权，逐项核对再保存。

<a id="action-role-delete"></a>
### 删除普通角色

真实步骤：查看关联用户 → 先调整绑定 → 确认删除。结果：未引用普通角色可删除。失败：超级管理员/恢复角色受保护，不能绕过。

<a id="action-rbac-recover"></a>
### 恢复内置管理授权

真实步骤：在角色管理查看恢复说明 → 明确确认恢复内置超级管理员。结果：保留可恢复的管理路径。失败：恢复不是给全部自定义角色扩业务权限。

<a id="action-permission-save"></a>
### 维护权限说明和状态

真实步骤：打开内置权限 → 核对只读码和绑定 → 保存允许字段。结果：说明变化不改变资源动作身份。失败：引用/恢复路径保护时先看关联，不造新绑定。

<a id="action-permission-reference"></a>
### 查看权限引用

真实步骤：按权限搜索 → 打开引用角色。结果：只读定位影响范围。失败：无引用不等于任意停用恢复能力。

<a id="action-user-save"></a>
### 保存本机用户

真实步骤：新建/编辑用户资料 → 核对账号状态后保存。结果：本机用户资料更新。失败：重复账号/保护用户按提示修正。

<a id="action-user-bind"></a>
### 绑定用户角色

真实步骤：选择用户 → 显式选择启用角色并保存。结果：严格模式有效能力按角色并集计算。失败：无绑定权限不能代操作；不隐式授权未来能力。

<a id="action-user-preview"></a>
### 模拟并退出身份

真实步骤：在支持的严格模式入口选择用户 → 查看有效权限 → 退出预览回操作者。结果：预览用于验证当前本机授权。失败：默认统一管理员不因预览文案变成真实登录。

<a id="action-account-save"></a>
### 保存账号资料

真实步骤：填写当前资料 → 点击保存资料。结果：只更新本机演示资料。失败：无权限或写盘失败保留输入。

<a id="action-account-password"></a>
### 演示密码校验

真实步骤：输入密码及确认项 → 查看格式校验。结果：只做校验，不保存密码。失败：不一致修正，不宣称外部账号已改密。

<a id="action-feedback-save"></a>
### 保存问题反馈

真实步骤：从页面或指南打开反馈 → 填写现象与必要来源 → 保存到本机。结果：反馈有明确页面/功能关联。失败：附件或保存失败保留输入，避免泄露全量业务库。

<a id="action-feedback-export"></a>
### 导出本机反馈包

真实步骤：筛选/核对记录和附件 → 导出反馈包并自行发送。结果：本机文件，不自动上传。失败：导出失败保留记录重试；已导出记录按原限制处理。

<a id="action-feedback-import"></a>
### 导入反馈包

真实步骤：选择反馈包 → 读取校验后确认本机导入。结果：恢复反馈及附件，不导入商品。失败：坏包保留原记录，不因说明导入授予权限。

<a id="action-access-explain"></a>
### 理解不可访问入口

真实步骤：阅读一般权限说明 → 返回合法工作台/指南。结果：不泄露无权对象。失败：未知或无权路由不无限重试。

<a id="action-guide-search"></a>
### 搜索业务知识

真实步骤：输入页面/术语/操作或失败现象 → 按类型打开结果。结果：仅索引说明，不搜索个人业务库。失败：无结果给建议和反馈，不编造回答。

<a id="action-guide-read"></a>
### 阅读页面与规则

真实步骤：从本页指南打开章节 → 查前提/步骤/失败和相关条目 → 关闭返回触发按钮。结果：不改变原业务 URL 与草稿。失败：未知文章回目录；待确认内容不当实际限制。

<a id="action-guide-learn"></a>
### 按路线学习和练习

真实步骤：选择目标路线 → 阅读并主动去有权页面 → 按核对点手动完成。结果：已读与已练习各自记录。失败：打开文章不自动完成练习，不自动造样例。

<a id="action-guide-progress"></a>
### 保存个人收藏与进度

真实步骤：明确收藏/已读/已练习 → 核对保存反馈。结果：仅写当前明确 owner 的独立个人键。失败：失败不假报成功，身份变化不写到别人名下。

<a id="action-guide-maintain"></a>
### 维护指南说明

真实步骤：选择文章编辑草稿 → 预览并核对实现 → 发布或显式恢复说明。结果：指南独立修订，不改业务规则。失败：权限/冲突/配额失败保留草稿与旧发布版。

<a id="action-guide-draft"></a>
### 保存说明草稿

真实步骤：编辑解释步骤与示例 → 保存草稿并预览。结果：普通读者仍见原发布版。失败：损坏/危险内容拒绝，当前输入保留。

<a id="action-guide-publish"></a>
### 发布核验说明

真实步骤：核对状态、适用实现和依据 → 明确发布。结果：同载荷提交正文、修订和上一版。失败：版本冲突读取最新核对，不能静默覆盖。

<a id="action-guide-import"></a>
### 导入指南内容备份

真实步骤：选择仅含指南的文件 → 校验预览 ID/引用/内容 → 明确确认导入。结果：只改指南说明，不带商品或授权。失败：坏 schema/重复 ID/危险内容拒绝且保留原文。

<a id="action-business-save"></a>
### 处理本机保存结果

真实步骤：阅读当前动作保存状态 → 等待原受控事务完成或明确重试。结果：只有真实持久化成功才称已保存。失败：内存未落盘、原数据未变和结果未确认分别处理。

<a id="rule-category-typed-target"></a>
### 绑定类型的目标不接收子分类

- 实现依据：`src/domain/categoryTree.ts`。
- 允许：目标未绑定类型，且满足其他层级条件。
- 拒绝：把分类移入已经显式关联产品类型的目标。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-category-cycle"></a>
### 分类移动不得形成循环

- 实现依据：`src/domain/categoryTree.ts`。
- 允许：目标不是来源本身，也不是其后代。
- 拒绝：移入自身或来源子孙。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-category-stale"></a>
### 分类来源与目标须仍有效

- 实现依据：`src/domain/categoryMovement.ts`。
- 允许：确认时来源存在且所选目标存在或明确顶级。
- 拒绝：来源已删除、目标已失效或结构依据不再匹配。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-model-dictionary"></a>
### 模型发布须保有真实词典引用

- 实现依据：`src/domain/dictionaryGuard.ts`。
- 允许：属性 ID 存在，实际值属于该属性词典，配置引用合法。
- 拒绝：缺失属性、值不属于引用属性、引用值被删除或改名。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-model-structure"></a>
### 发布树必须满足真实结构

- 实现依据：`src/domain/logic.ts`。
- 允许：节点层级和真实路径通过现有结构检查。
- 拒绝：属性直接子级混挂属性/值、循环或缺失结构关系。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-model-history"></a>
### 发布依据与历史快照保持

- 实现依据：`src/stores/catalog.ts`。
- 允许：保存草稿后显式发布新版本，历史对象继续引用原版本。
- 拒绝：用当前草稿替换旧发布树、自动改写旧 MAT/PLN 来源。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-node-config"></a>
### 值业务配置是附属实例

- 实现依据：`src/domain/nodeBusiness.ts`。
- 允许：记录结构有效、定义可支持、范围和参数明确。
- 拒绝：容器损坏、无法执行的未知类型或实际冲突仍发布。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-material-source"></a>
### 正式物料来源必须一致

- 实现依据：`src/domain/material.ts`。
- 允许：分类、类型、模型和指定发布快照属于同一合法来源。
- 拒绝：跨分类/类型模型、无效发布版或主体来源不匹配。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-material-planning"></a>
### 正式规划必须可用且完整

- 实现依据：`src/domain/material.ts`。
- 允许：指定发布版仍含实际完整组合或合法节点覆盖。
- 拒绝：规划不存在、版本内不含该组合、来源失效。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-material-identity"></a>
### MAT 与销售 SKU 身份分离

- 实现依据：`src/domain/catalogIdentity.ts`。
- 允许：按统一身份函数判断记录，并用正确主体与记录上下文访问。
- 拒绝：用 MAT 当销售 SKU、跨主体 sku query 或导入身份冲突。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-material-request"></a>
### 物料关联请求回执与原始来源保留

- 实现依据：`src/domain/materialRelationCommands.ts`。
- 允许：新 requestId 明确执行新意图；相同请求仅返回稳定原执行结果。
- 拒绝：已受理请求更换来源/目标，或解绑后用旧请求重新建关联。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-spu-input"></a>
### SPU 输入与有效引用

- 实现依据：`src/domain/spuSku.ts`。
- 允许：名称非空、分类存在、方案/类型/发布版引用有效。
- 拒绝：空名称、分类失效、类型与分类或版本与模型不一致。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-spu-identity"></a>
### 有下游的 SPU 身份锁定

- 实现依据：`src/domain/spuSku.ts`。
- 允许：在允许字段维护名称/编号/状态，来源相容时新增子记录。
- 拒绝：已有 SKU、MAT 或历史关联后直接改分类/类型/版本/公共属性身份。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-spu-reference"></a>
### SPU 删除不级联清子记录

- 实现依据：`src/domain/spuSku.ts`。
- 允许：已下架且无实际 SKU/MAT/受保护引用，按确认删除。
- 拒绝：已发布直接删、有子记录或历史引用仍删除。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-sku-input"></a>
### SKU 规格必须属于主体方案

- 实现依据：`src/domain/spuSku.ts`。
- 允许：字段、必填和取值通过当前方案/约束，规格不覆盖主体公共值。
- 拒绝：未绑定属性、非法取值、规格覆盖公共属性或无可生成规格。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-sku-identity"></a>
### SKU 追加去重和来源锁定

- 实现依据：`src/domain/spuSku.ts`。
- 允许：只确认有效新候选；已有 ID/规格不重复，来源身份保持。
- 拒绝：修改有规划/节点来源 SKU 的规格身份、过期候选或跨 SPU 误写。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-view-isolation"></a>
### 视图、临时范围与业务数据分离

- 实现依据：`src/components/product-list/useSkuWorkbench.ts`。
- 允许：视图条件与路由 SPU 范围相交，默认仅保存正式配置。
- 拒绝：清筛选扩大到其他 SPU、将临时范围自动覆盖全部视图。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-view-conditions"></a>
### 筛选逻辑与手工顺序保持

- 实现依据：`src/domain/skuWorkbenchQuery.ts`。
- 允许：条件在原 AND/OR 组内执行，父分类包含下级用明确操作；手排无冲突。
- 拒绝：失效字段扩大查询、在分组/字段排序冲突时继续拖排。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-compatibility-binding"></a>
### 适用绑定须有明确对象与主机

- 实现依据：`src/domain/deviceResolution.ts`。
- 允许：主机型号合法且目标是实际受支持的 SKU/MAT 粒度。
- 拒绝：型号歧义、目标不存在、错误身份或非法绑定。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-compatibility-basis"></a>
### 适用声明按有效依据维护

- 实现依据：`src/domain/accessoryCompatibilityCommands.ts`。
- 允许：结论、能力、条件和来源通过真实校验，预览依据仍有效。
- 拒绝：真实矛盾结论/条件、过期 basis 或错误目标。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-compatibility-manual-protection"></a>
### 人工修改与取消跨版本保留

- 实现依据：`src/domain/materialRelationCommands.ts`。
- 允许：稳定规则/声明真实谱系相同则继承人工决定；无关新来源按原规则执行。
- 拒绝：只改 note/source/核验状态后重新生成已取消或改过声明。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-json-import"></a>
### 导入校验与当前角色保护

- 实现依据：`src/stores/catalog.ts`。
- 允许：结构合法、身份/冻结依据有效且当前导入前操作者获准。
- 拒绝：非数组/空记录/缺参数、非法组外成员或用文件角色绕过只读。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-persistence"></a>
### 真实写盘状态与失败恢复

- 实现依据：`src/stores/catalogPersistence.ts`。
- 允许：受控事务真实 setItem 成功后报告保存完成。
- 拒绝：把内存已改但写盘失败称已保存，或删除原数据腾空间。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-conflict"></a>
### 外部修订或预览依据变化需重新核对

- 实现依据：`src/stores/catalog.ts`。
- 允许：锁内依据/修订与当前数据一致，重复请求意图稳定。
- 拒绝：旧窗口覆盖新数据，更新 basis 复活已完成旧请求。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-permission"></a>
### 默认模式与严格授权分开

- 实现依据：`src/domain/rbac.ts`。
- 允许：默认统一管理员访问已登记能力；显式严格模式按启用角色并集检查。
- 拒绝：把隐藏菜单当撤权、把阅读指南当编辑权限，或访问未知路由。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-identity-separation"></a>
### 业务对象与来源各有身份

- 实现依据：`src/domain/catalogIdentity.ts`。
- 允许：分类/类型/模型/SPU/SKU/PLN/MAT按实际 ID 和合法关联维护。
- 拒绝：同名自动合并、将 PLN 当 SKU、把 MAT 当销售记录。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-catalog-names"></a>
### 目录名称维护不重写历史商品

- 实现依据：`src/views/BrandView.vue`。
- 允许：合法目录名称/说明独立保存，历史商品保留原文字。
- 拒绝：改品牌目录时自动替换所有旧商品文字。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-constraint-definition"></a>
### 现行允许值规则与旧参考分开

- 实现依据：`src/views/RuleView.vue`。
- 允许：实际方案/条件/目标/取值齐全的现行规则参与求值。
- 拒绝：把不能无损转换的旧规则当已执行限制。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-menu-structure"></a>
### 菜单结构不改变执行授权

- 实现依据：`src/domain/menuConfig.ts`。
- 允许：正式路由可合法放入中心/分组，排序/改名/隐藏保留。
- 拒绝：非法路由、循环父子、删非空容器或把菜单名当权限身份。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-role-protection"></a>
### 角色依赖与恢复能力受保护

- 实现依据：`src/domain/rbac.ts`。
- 允许：角色编码唯一、依赖显式勾选、无引用普通角色可删。
- 拒绝：隐式补权、删除有用户角色、撤销受保护恢复路径。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-feedback-local"></a>
### 反馈只在本机保存和导出

- 实现依据：`src/domain/feedbackFiles.ts`。
- 允许：反馈正文及必要来源/附件按原流程本机保存，人工导出交付。
- 拒绝：宣称自动上传服务器、打包整个业务库或编辑已受限制导出记录。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-guide-isolation"></a>
### 指南与业务存储及草稿隔离

- 实现依据：`src/domain/guide/types.ts`。
- 允许：抽屉状态独立，个人进度明确 owner，内容独立 namespace/schema。
- 拒绝：改业务 URL 导致重挂、写业务 AppData 或切身份覆盖他人进度。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。本轮新增指南规则仍待集成检查后升为已核验。

<a id="rule-guide-publication"></a>
### 说明发布不修改内置业务条件

- 实现依据：`src/domain/guide/validation.ts`。
- 允许：只维护解释/步骤/示例，内置 ID/路由/执行条件保持。
- 拒绝：说明导入改绑定/权限、危险内容、重复身份或坏引用。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。本轮新增指南规则仍待集成检查后升为已核验。

<a id="rule-guide-storage"></a>
### 指南独立存储必须合法原子

- 实现依据：`src/domain/guide/validation.ts`。
- 允许：独立 schema 校验通过，同载荷原子提交正文修订与上一版。
- 拒绝：坏 JSON/schema 或配额失败后覆盖原发布数据。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。本轮新增指南规则仍待集成检查后升为已核验。

<a id="rule-guide-conflict"></a>
### 指南修订冲突不可静默覆盖

- 实现依据：`src/domain/guide/types.ts`。
- 允许：锁内修订一致且提交操作者仍有维护权限。
- 拒绝：旧窗口或排队旧身份覆盖新发布版。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。本轮新增指南规则仍待集成检查后升为已核验。

<a id="rule-guide-permission"></a>
### 阅读与说明维护能力独立

- 实现依据：`src/domain/rbac.ts`。
- 允许：指南阅读和更新分别授权，提交时重查有效身份。
- 拒绝：只读者发布说明，维护指南顺带得到商品/用户写权限。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。本轮新增指南规则仍待集成检查后升为已核验。

<a id="rule-type-category"></a>
### 产品类型只关联有效末级分类

- 实现依据：`src/stores/catalog.ts`。
- 允许：分类存在、启用且无子分类，同类名称不重复。
- 拒绝：目标失效/停用/非末级或同分类同名类型。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-type-reference"></a>
### 类型迁移与删除须保留引用

- 实现依据：`src/stores/catalog.ts`。
- 允许：类型未受实际模型、商品、框架或历史引用保护。
- 拒绝：在有受保护引用时迁移或删除类型。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-template-bindings"></a>
### 方案绑定必须是真实词典属性

- 实现依据：`src/views/TemplateView.vue`。
- 允许：方案身份有效、绑定属性真实、角色与顺序明确。
- 拒绝：使用失效属性、重复绑定或把空占位当正式绑定。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-dictionary-reference"></a>
### 引用中的词典不能任意删除改名

- 实现依据：`src/domain/dictionaryGuard.ts`。
- 允许：未被使用的实际属性值可按原流程维护。
- 拒绝：草稿节点、历史快照、允许值配置、商品或规则实际引用。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-category-input"></a>
### 分类名称与记录必须有效

- 实现依据：`src/domain/categoryTree.ts`。
- 允许：分类记录存在且名称去空后非空。
- 拒绝：来源已失效或名称为空。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="rule-category-reference"></a>
### 分类删除保留真实下游

- 实现依据：`src/stores/catalog.ts`。
- 允许：无子分类、挂载商品与关联类型，按确认删除。
- 拒绝：仍有子分类/商品/产品类型，或已发布商品需先按原流程处理。
- 静态核对：对应当前条件/保护分支，未修改规则来配合说明。

<a id="concepts"></a>
## 概念核对

依据 types/catalogIdentity/productList/materialRelations，保持 PLN/MAT/SKU/SPU 分离；演示名称不构成身份。

<a id="troubleshooting"></a>
## 排查核对

依据 failure 类型和实际保存事务，区分 business/input/permission/persistence/conflict/unknown。未知现象不猜测命中规则。

## 明确差距与待确认

旧 pageFeatures 中分类方向、运营权限、用户切换身份和 products 旧入口文案需由主代理收敛映射；历史 featureId 不重写。
原幕布完整列表字段、手机完整物料规则、覆盖/继承/排除、公共物料自动归组和历史回填仍 business-pending，不作新增规则。
此内容盘点列出已命名关键动作与规则族；真实拒绝分支的精确接入分母以 G4 failureRegistry 独立枚举，不把有规则文章等同已接入。