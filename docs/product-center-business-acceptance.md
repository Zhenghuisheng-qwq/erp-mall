# 商品中心 V3 集中业务验收与收口

RESULT：通过本轮已确认的前端 Mock 验收范围；已具备进入用户亲自操作验收的条件。无未修复的已确认阻断问题。本结果不等于老板原始需求全部满足，也不包含订单、支付、库存或真实后端。

## 重复请求复核记录

本次再次收到相同验收任务后，实际 HEAD 为 `6abaec1a868f59557c09e21b4321ef9b32271399`，分支仍为 `20261022`，复核开始时工作区干净，未发现新增适用 AGENTS.md。该提交相对指定基线仅纳入本报告、验收脚本和下述 PC-01 修复；src 中没有其他业务变更。原始验收起点仍是下节记录的 `84e26bb4...`。

已重新检查最终索引中的 19 个浏览器结果及全部所列截图文件存在，183 个检查点计数一致，11 组回归均 exit 0，生产构建日志完整。没有新增代码风险，因此按“已有测试通过且没有新风险时不无意义重复执行”的要求沿用上一轮实际结果；本次没有重新运行浏览器或构建，也没有新增产品代码修改。停止标准和文末需求源待核结论不变。

## 基线、环境及证据口径

- 验收日期：2026-10-25，Asia/Singapore。
- 工程：`D:\单子\商城erp\mock\iyge-v2-mock`；分支 `20261022`；实际 HEAD 与审查基线均为 `84e26bb4fa94eb6e60fdc4d3277946140773f1b7`。
- 开始时工作区干净。检查工程祖先目录及 src/scripts/docs 子目录，未发现适用 AGENTS.md。未回退用户修改，未提交、推送或部署。
- 独立 Chrome 156.0.8078.47、临时本机 Vite、独立 BrowserContext 和测试夹具。没有连接用户日常浏览器或读取其原有 localStorage。
- 复杂模型、历史快照和异常备份允许夹具准备；下面的关键编辑、保存、发布、建档、关联、筛选、预览、生成和导入导出均实际经过页面。Store/领域结果单列，不替代页面验收。
- 19 个浏览器脚本完成 183 个检查点；该数字是脚本检查点数量，不是需求完成率。另有 11 个领域/Store 回归脚本及 R03 真实 Store 夹具检查通过。
- [最终证据索引][INDEX]列出全部脚本检查点、截图和回归结果。首次批次有一条旧导航假设失败，已调整测试并复验；以最终索引和各脚本的 result/evidence 为准，不能只读取首次 browser-results.json。

证据简写：E1 分类；E2 类型/模型；E3 三视图与手工排序；E4 编辑保护；E5 R01；E6 补充范围/命名/恢复；E7 SPU/SKU；E8 独立创建/COMMON/列表；E9 R02；E10 模板适配；E11 适配查询；E12 R02 人工保护；E13 SKU 工作台；E14 原权益包；E15 权益包细化；E16 R03；E17 R03 补修；E18 词典/导入保护；E19 命名冲突。文末可点击对应证据。

## 1. 分类、类型、模型和规划编辑

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 分类结构维护 | 商品分类工作台，双面板拖动前后/内部、键盘指定目标、重命名、复制；取消和配额失败后重试 | 保留完整子树；禁止移入自身后代；取消不写入；失败可重试 | 子树与分类身份保留，非法目标拒绝，失败时内存/磁盘不变，刷新一致 | [E1]；dual-dark.png、dual-light-narrow.png | 通过 |
| 类型→模型 | 产品类型选择手机分类→新增类型→模型页选择此类型新建模型→编辑模型 | 类型不是分类节点；模型明确属于所选类型；旧发布历史不变 | 新类型属于 c-phone，分类数组未变；新模型绑定新类型，编辑入口对应正确 ID | [E2]；type-created.png、model-created-under-type.png | 通过 |
| 三视图、原位编辑、连续新增和键盘 | 结构/大纲/幕布切换；Enter/Tab、批量新增属性值、重绑、拖动、撤销、输入法合成及跨模型切换 | 沿同一正式词典维护；兄弟及另一模型不误改；输入快捷键与结构快捷键隔离 | 页面断言通过；只读投影不能变更结构；跨模型旧撤销/延迟确认不能修改另一模型 | [E3]、[E4]；node-panel.png、node-panel-narrow.png | 通过 |
| 不同型号允许不同属性顺序 | A 使用品牌→颜色；B 夹具为颜色→品牌；页面查看大纲/幕布并发布 B | 不强制全局顺序；属性 ID 保留；发布不改 A | B 可显示/发布；去除纯布局坐标后业务节点与词典逐项不变 | [E6]；reverse-attribute-order.png | 通过 |
| 真实规划编辑 | 已发布手机模型→选择 COMMON 型号 iPhone 17→保存具名规划 | 仅枚举真实下级路径，绑定具体发布版本 | 保存后得到 3 条候选；后续创建和反查通过，见第 4 组 | [E8]；common-plan-saved.png | 通过 |

## 2. 值节点业务配置

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 公共目录、独立实例 | Apple 与另一品牌使用同一销售定位目录，分别保存不同实例 | 共享定义不共享实例；不新增规格轴 | 实例 ID 不同；节点数、词典及另一模型不变 | [E6] | 通过 |
| 仅当前值/包含下级 | Apple 仅当前值设畅销；另一品牌包含下级设不畅销；打开各自叶节点 | 当前值配置不继承；下级配置显示正确来源 | Apple 下级未配置；另一品牌下级显示不畅销及来源 | [E6]；independent-subtree-source.png | 通过 |
| 路径限选 | Apple 限 5 色；在其下新增/重绑，再打开另一品牌新增候选 | A 不可选第 6 色，B 仍可选第 10 色；全局词典不变 | 三视图使用同一限制，原节点身份保留；允许值实际引用也受词典保护 | [E5]、[E18]；desktop-config.png、dictionary-reference-block.png | 通过 |
| 建档策略、命名入口 | 值节点配置独立/共用物料策略，从节点打开原命名编辑器；执行 MAT 预览/选择 | 策略不自行指定 MAT；命名仍使用已有规则 | 共用要求明确选择目标及范围；原命名来源可见；没有第二套命名实例 | [E5]、[E9]、[E6] | 通过 |
| 冲突/未知规则 | 上下级保存矛盾销售定位，尝试发布并定位；删除冲突后再发布 | 显示冲突，不猜覆盖或求交规则 | 冲突可留草稿，但发布拒绝；定位后修正可发布 V2 | [E5]；conflict.png | 通过 |
| 原始覆盖规则的最终业务意图 | 对照已确认行为，保留尚无原文的覆盖优先级问题 | 不把当前拒绝策略宣称为老板已确认的最终覆盖规则 | 本轮不增设隐式优先级；列入需求源待核 | 需求源清单 S3 | 需求源待核 |

## 3. 命名与版本

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 命名结果及来源 | 命名编辑器按品牌、固定“ / ”、颜色保存；在下级打开 | 预览按规则顺序，固定空格保留，来源清楚 | 预览显示 Apple / 颜色1，下级说明最近祖先规则 | [E6]；naming-preview-source.png | 通过 |
| 平级命名冲突 | 准备两个相乘分支的不同规则→页面发布→合法组合→单条创建物料 | 不任选一条自动命名，指出各来源，要求手工处理 | 建档弹窗明确“同级属性相乘”“不能任选一条规则”；取消不生成 MAT、不改快照 | [E19]；conflict-requires-manual-name.png | 通过 |
| 新版与旧版 | 发布 V1→修改命名/业务配置→发布 V2→查看 V1 | 旧树、原始身份和历史关联不变 | V1 原文深比较一致，V1 配置为只读；历史 MAT 和兼容来源仍保留 | [E5]、[E6]、[E9]、[E10] | 通过 |
| 展示不改业务 | 三视图切换、节点显示开关、分组排序、缩放及窄屏 | 允许布局坐标变化，不改业务节点/PLN/MAT/商品关系 | 业务字段与关联集合比较不变；显示开关三视图一致 | [E3]、[E9]、[E8] | 通过 |

## 4. SPU/SKU 两条创建路径

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 商品侧独立创建 | 新建空 SPU→保存→分别添加蓝/白两条 SKU→刷新 | 两条归属同一 SPU；不伪造规划或版本 | 页面 2 条，原空 SPU 保留；无 planningId/modelVersionId | [E8]；independent-spu-two-sku.png | 通过 |
| 批量新增/兄弟保护 | SPU 入口生成规格，重复预览/双击确认，单条编辑、批量状态维护 | 去重按已有算法，编辑不改兄弟，最后一条 SKU 删除不删 SPU | 原有 V2 生成/去重逻辑通过，原 MAT 与销售 SKU 分离 | [E7]；template-batch-preview.png、material-with-real-skus.png | 通过 |
| 规划及 COMMON 来源 | 页面保存 COMMON 型号规划→明确选已有 SPU→预览并创建 3 条→SKU 编辑页和规划页核对 | 完整实际组合、具体版本、正反向来源一致 | 每条保留 sourceNodeIds、creationSource、modelVersionId；节点组合可匹配完整 PLN；SKU 页面显示规划名与 V1，规划卡显示 3 个 SKU | [E8]；common-plan-created-sku.png | 通过 |
| 无规划来源 | 独立手工 SKU 与来源 SKU 同集查看 | 如实说明手工/未记录来源，不按名称补关联 | 独立 SKU 不新增 PLN/MAT 来源；来源页按自身保存记录显示 | [E7]、[E8] | 通过 |

说明：销售 SKU 的完整路径通过 sourceNodeIds 和冻结版本追溯。`Sku.planningId` 的既有主要用途是物料建档；本轮没有为满足测试而批量补写它，也没有按名称合并任何身份。

## 5. 公共 MAT 与提前建档

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 同一 PLN 多 MAT | 合法组合页同一 PLN 两次明确单条建档 | 两个独立 MAT，各保留原编号与来源 | 两条真实物料及各自兼容贡献存在，无自动合并 | [E10]；two-mat-one-planning.png | 通过 |
| 不同路径共用已有 MAT | 节点范围建 MAT→另一完整路径显式选原 MAT→预览确认 | 不自动选首条目标，不产生第二条 MAT | 范围/来源预览正确，仍为原 MAT | [E9]；scope-preview.png、node-summary-desktop.png | 通过 |
| 提前建档/完整枚举 | 较早值节点直接建档，不填容量颜色；查看范围和完整规划 | 提前锚点仅记录已知前缀，不截断真实完整路径 | 初始覆盖 3 条完整 PLN；显式加第 4 条后 4；解绑后 3；全程 1 MAT | [E9]；digest-3.png、digest-4.png | 通过 |
| 反查/刷新/解绑 | 节点卡片打开原档案→查看所有来源→刷新→解绑新增关系 | 原始来源、V1、MAT 仍在；摘要同步 | 反查持久化，解绑仅解除新增关系；三视图显示开关不写关系 | [E9]；archive-reverse.png、outline-narrow.png、document-narrow.png | 通过 |
| 重复请求和失败 | 已有关系的重复请求→解绑→旧请求重试；双页旧预览与存储失败 | 成功回执阻止旧请求恢复解绑关系；失败无半写 | R02 Store 保护回归通过；页面配额失败/旧页预览拒绝，输入保留 | [R] r02-repair；[E9] | 通过 |

## 6. 适配维护和双向查询

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 多主机/双向查询 | 维护配件声明→从主机找配件→从配件反查主机 | 同一正式声明双向一致，型号来源明确 | 适用主机、来源版本、条件可查，修改/刷新立即反映 | [E11]、[E10]；forward-template-matches.png、reverse-template-source.png | 通过 |
| 分支和未来继承 | 模板默认/例外配置→查看冲突→发布→实际生成 SKU/MAT | 仅匹配分支继承冻结声明；预览不发号 | 4 条新 SKU 的正式声明按规格生效，范围冲突不自动定优先级 | [E10]；exception-conflict-preview.png | 通过 |
| 基本/条件/待确认/不适用/快充 | 查看配件状态、能力详情，权益包确认条件；无 SKU 声明的 MAT 对照 | 基本与快充分开，待确认/不适用不冒充推荐，MAT 不自动成为 SKU 声明 | 查询、候选状态和条件确认一致；复制 MAT 声明需显式预览确认 | [E11]、[E14]、[E17] | 通过 |
| 人工取消跨版本保护 | 页面取消声明→模板只改备注→发布 V2→原 MAT 关联预览；同步保护 | 不静默恢复人工取消或修改 | 受影响声明显示人工保护，确认不可用；旧 deleted 状态不变 | [E12]、[E10]；cancelled-v2-protected.png、sync-three-way-protected.png | 通过 |
| 等价条件 | 两路径条件倒序及 in 集合倒序/重复项→关联同 MAT | 等价去重且保留真实来源；真实冲突拒绝 | 页面共用一 MAT/一声明、两组真实来源；真实矛盾原子拒绝由 R02 Store 回归补充 | [E12]；equivalent-linked.png；[R] | 通过 |

## 7. 商品列表

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 同数据 SPU/SKU | 同一隔离数据集切换 SPU/SKU，按 SPU 范围进入及返回 | 数量按相应身份计算，MAT 不冒充销售 SKU | 归属和计数正确，独立视图设置不串；刷新恢复 | [E7]、[E13] | 通过 |
| 父分类含下级/组合筛选 | SKU 筛选选择商品分类“包含下级分类”主机；再应用 OR 组及临时搜索、清除 | 明确运算符包含后代；条件交集/清除按原约定 | 返回的 SKU 均属于主机及下级，独立膜 SKU 被排除；组合及清除断言通过 | [E8]、[E13]；parent-category-descendants.png、filter-groups.png | 通过 |
| 字段/列序 | 增加颜色列、设宽度/冻结，原生拖拽顺序、搜索字段、取消/应用、另存为 | 只改展示；重开恢复已保存配置 | 列配置保存；取消不生效；完整数组重排不丢列；商品不变 | [E3]、[E13]；fields.png、sku-workbench.png | 通过 |
| 分组/排序/保存视图 | SPU 按分类分组，名称升降序；SKU 按分类分组、编号降序，另存视图后刷新 | 真实分组、顺序改变且能恢复 | 分组可见，升降序不同；刷新顺序与保存配置一致，业务数据完全相同 | [E8]；spu-grouped.png、spu-sort-restored.png、sku-group-sort-restored.png | 通过 |
| 跨页手工排序 | 选中加入暂存区→跨页插入；搜索、切视图取消、外部删除和配额失败重试 | 保护原暂存意图，不能丢项/改商品身份 | 真实页面跨页、失败重试、无效暂存处理通过 | [E3] | 通过 |

## 8. 权益包框架与实际选配

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 零 SKU 独立框架 | 框架页仅保存类型组，应用到新包；新增兼容 SKU 后看候选 | 不保存 SKU 白名单；动态选配 | 框架 groups 的 candidateSkuIds 均为空；新销售 SKU 自动出现，框架原文不变 | [E16] | 通过 |
| 推荐/其他页签 | compatibleOnly=false 框架下切换页签、搜索/类型过滤 | 推荐=框架范围∩正式基本适配；其他=允许范围且真实状态 | 待确认、不适用、无声明、仅快充不进基本推荐；其他页仍可见相应状态 | [E17]；recommendations.png | 通过 |
| 必选/种数/数量/错误定位 | 按组默认数添加、删除必选成员、违反数量；窄屏切到选商品并折叠后点击问题 | 非法配置不能可用；具体成员优先定位，不改输入 | 件数 2→1 后自动切清单、展开并聚焦，1 保留；规则校验/替换/条件确认链路通过 | [E17]、[E14]、[E15]；quantity-focused.png、selection-rules.png；[R] R03 | 通过 |
| 主机与包内商品分离 | 选择适配主机、显式包含/移除、更换主机，复制常用包 | 适配主机不自动成为成员；旧自由包继续可用 | 主机包含单独操作，切换保留已有成员待核；复制产生新身份且源包/历史不变 | [E14]、[E15] | 通过 |
| 框架冻结修订 | 框架修改/停用后打开原包与历史交付 | 原包仍绑定旧修订，不跟随改写 | 旧修订可读，历史清单不变；新绑定按新规则校验 | [E16]；[R] r03-framework | 通过 |

## 9. 权益包价格、清单和导出

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 未填/0 元/小计 | 留空价格、录入 0、再填人工参考价和成员数量 | 未填不等于免费；使用安全分值；小计正确 | 页面空/0 区分；非法小数保留输入并拒绝；参考价来源仍为人工 | [E16]；[R] r03-framework | 通过 |
| 每包/一次性服务与差额 | 配置两种计量服务→3 包预览→整包人工报价 | 每包乘包数，一次性只算一次；报价不被参考合计覆盖 | 实测总参考 40.50 元、整包总报价 60 元，差额 -19.50 元；一次性服务总数量 1 | [E16]；delivery-full.png、delivery.xlsx；[R] | 通过 |
| 变更后复核/预览失效 | 修改商品/数量/参考价，复核报价；另一页更新后确认旧预览 | 旧依据不能静默交付 | 复核提示及旧预览拒绝，较新数据未覆盖；失败保留输入与预览可重试 | [E14]、[E15]、[E16] | 通过 |
| 折叠/窄屏/生成/Excel | 折叠成员→窄屏定位→预览→显式确认生成→下载 Excel | 折叠只影响显示；预览不创建编号；明确生成才落盘 | 真实生成、重复请求及配额重试通过；实际下载 XLSX 并解析关键单元信息 | [E14]、[E16]、[E17] | 通过 |
| 历史冻结 | 生成后改商品、价格、框架及当前包；缺主机/主体备份中查看历史并导出 | 历史仅读冻结快照，不查当前价格/框架替换历史 | 历史内容和工作簿断言不变；失效引用场景仍实际下载冻结 Excel | [E14]、[E16]、[E6]；family-frozen.xlsx、host-frozen.xlsx、sku-frozen.xlsx | 通过 |

## 10. 数据保护与异常恢复

| 需求/场景 | 入口与步骤 | 预期 | 实际结果 | 证据 | 状态 |
|---|---|---|---|---|---|
| 导出/导入/权限 | 页面导出，运营分别改业务目录、草稿配置、历史配置再文件导入；管理员恢复合法备份 | 按导入前角色拒绝越权；拒绝不改变数据 | 三类真实文件导入均拒绝，磁盘原文与再次导出一致；管理员正常恢复 | [E18] | 通过 |
| 商品重置保护 | 框架包已引用销售 SKU，商品列表演示数据→重置当前模块 | 明确受影响包/成员，提交前拒绝 | 页面拒绝且磁盘原文不变；真实 Store 回归额外断言内存不变 | [E17]；reset-refused.png；r03-store/checks.json | 通过 |
| 可修复失效引用 | 缺 SKU、商品主体、主机三种备份启动→编辑页不改内容点击保存→交付预览 | 应可读取并保留原条目；拒绝可用保存/新清单；可修正为草稿 | 初次发现 PC-01，已修复；三类页面明确拒绝，原始存储不变；失效成员可移除并实际保存草稿 | [E6]、[E17]；repairable-sku/family/host.png、dangling-repairable.png | 通过（修复后） |
| 真正非法/损坏 | 通过真实文件选择导入组外 SKU、MAT 假扮 SKU、损坏框架；损坏节点配置启动 | 明确拒绝或进入恢复，不覆盖原存储 | 三种框架非法导入原子拒绝；损坏配置保留原文进入恢复 | [E6]、[E18]；import-rejected-outside/material/structure.png、damaged-storage-recovery.png | 通过 |
| 失败/重复/双页 | 框架、物料、权益包保存时注入 quota；重复确认；共享 origin 两页编辑/预览冲突 | 无半写、无重复记录、不覆盖新页，输入留存可重试 | 页面操作及 Store 回执保护断言通过；A/B 请求解绑后不恢复、新 C 才能重建由 R02 回归确认 | [E5]、[E9]、[E10]、[E14]、[E16]；[R] | 通过 |
| 旧自由包/全量重置 | 同条件自由包商品重置与全量重置；实际自由包创建、保存、交付 | 既有语义不扩改 | Store 重置后正常 normalize；自由包真实页面保存交付通过。本项重置细节为真实 Store 补充证据，非冒称逐个点击过重置按钮 | r03-store/checks.json；[E14] | 通过 |

## 本轮问题与修复

### PC-01：失效包无编辑保存被页面快捷分支当作成功

触发：保存可用框架包→准备缺 SKU/主体/主机的可修复备份→打开包编辑页→不编辑直接点击“保存权益包”。页面原 `save()` 在 dirty=false、状态相同且无外部冲突时直接返回 true，未调用 Store 校验。没有发生数据写坏，但没有明确拒绝失效包，不符合本轮要求。

最小修复：`src/components/benefit-package/useBenefitPackageEditor.ts` 的快捷成功条件增加当前 validation.canSaveDraft / canSaveAvailable。失效引用进入原 Store 校验及既有错误定位；合法未编辑包保持原快捷行为。未修改 Store 数据结构、编号、生成、定价或历史语义。

复验：E6 三种失效备份实际点击保存，均出现错误，持久化原文逐字不变，原成员/数量/价格/修订保留，新交付不可确认；历史 Excel 仍可下载。E15 受影响权益包页面链路复跑通过；11 个必要领域/Store 回归和生产构建通过。

本轮没有其他已确认未修复功能缺陷。测试调整不计为产品修复：

- 补充模型测试改为比较业务节点字段，允许布局 positionX/positionY 按视图重排，避免把合法布局变化误报为身份变更。
- 销售 SKU 追溯按其 creationSource/modelVersionId/sourceNodeIds 验证完整 PLN，未要求 MAT 专用关联字段必填。
- 旧权益包视觉测试写死“返回单栏导航”，当前已支持保存 center 布局；改为验证恢复原 navPreference.layout，保留样式。
- 新增脚本调试修正了 Element Plus 输入/对话框定位、异步等待及截图动画时机，未为通过测试改动产品界面。

## 修改文件及实际检查

唯一产品代码变更：`src/components/benefit-package/useBenefitPackageEditor.ts`。

新增验收脚本：`scripts/product-center-acceptance.mjs`、`browser-product-center-supplement.mjs`、`browser-product-center-list-create.mjs`、`browser-product-center-type-model.mjs`、`browser-product-center-naming.mjs`。旧脚本 `browser-r01-protection.mjs` 和 `browser-r03-repair.mjs` 增加独立输出/夹具路径支持；`browser-benefit-refinement.mjs` 修正保存导航偏好的测试假设。

- [浏览器最终索引][INDEX]：19 个脚本，183 个检查点。包含窄屏 375/780/900/980、桌面、深浅色及已有缩放场景；范围以具体检查点为准。
- [回归结果][R]：r01-plan、r01-business、r01-protection、r02-relations、r02-compatibility、r02-repair、r03-framework、benefit-package-state、benefit-package-refinement、benefit-package-export、compatibility-benefit-storage，全部 exit 0。
- [生产构建][BUILD]：`npm run build`（含 vue-tsc）exit 0。仅保留既有超过 500 kB chunk 提示，不在本轮扩展拆包优化。
- `git diff --check` 通过。冻结 V2 选择器、PLN/MAT 编号与生成算法文件无修改。
- 浏览器脚本可用 `node scripts/product-center-acceptance.mjs` 重跑；`ACCEPTANCE_SUITES` 可用逗号列出所需脚本，避免无意义全量重复。脚本会先用真实 Store 生成隔离恢复夹具。
- 本轮所有夹具、日志、实际 XLSX 和关键截图位于 `work/product-center-acceptance-20261025/`。历史 failure.json/png 保留作失败过程记录；对应最终 result/evidence 及 acceptance-evidence.json 明确最终状态。

## 未验证及需求源待核

| 编号 | 项目 | 状态 | 本轮处理 |
|---|---|---|---|
| U1 | 原生 Microsoft Excel 应用打开文件、系统打印对话框/纸张设备 | 未验证 | 已验证实际下载 XLSX 并解析内容、打印 CSS；未宣称验证原生 Office 或打印机。这不属于本轮 Mock 核心阻断条件。 |
| S1 | 原幕布完整列表功能/字段 | 需求源待核 | 缺少完整原文，不能用现有字段清单替代老板要求；本轮只验已有明确列表行为。 |
| S2 | 手机业务三类完整物料规则 | 需求源待核 | 不据名称猜测三类规则，不宣称 R02 范围/共用能力已经覆盖全部手机业务规则。 |
| S3 | 尚未确认的配置覆盖规则 | 需求源待核 | 冲突继续显式展示/拒绝执行，不自选覆盖优先级。 |
| S4 | 公共物料自动归组及历史回填规则 | 需求源待核 | 本轮仅显式关联/解绑；不按名称自动合并、不全局补关联、不重写历史。 |

缺少原文不等于缺功能；上述待核项也不能据此判定全部满足老板需求。除 U1 外，本轮列出的关键浏览器场景没有因浏览器不可用而留下未验证项目。

结论：已具备用户亲自操作验收条件，建议使用独立测试数据从分类/模型一路操作至权益包交付，重点确认业务用语与真实经营规则是否符合预期。本轮到此停止，等待用户操作验收与需求源确认，不自动进入新功能轮次。

## 证据链接

[INDEX]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/acceptance-evidence.json
[R]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/regression/results.json
[BUILD]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/build.log
[E1]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-category-workspace/result.json
[E2]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/type-model/evidence.json
[E3]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-functional-gaps-round5/result.json
[E4]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-editor-safety/result.json
[E5]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-r01/result.json
[E6]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/supplement/evidence.json
[E7]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-spu-sku/result.json
[E8]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/list-create/evidence.json
[E9]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-r02-repair/evidence.json
[E10]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-template-compatibility/result.json
[E11]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-accessory-compatibility/result.json
[E12]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-r02-repair-compatibility/evidence.json
[E13]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-sku-workbench/result.json
[E14]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-benefit-packages/result.json
[E15]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-benefit-refinement/result.json
[E16]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-r03/evidence.json
[E17]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/browser-r03-repair/evidence.json
[E18]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/r01-protection/evidence.json
[E19]: D:/单子/商城erp/mock/iyge-v2-mock/work/product-center-acceptance-20261025/naming-conflict/evidence.json
