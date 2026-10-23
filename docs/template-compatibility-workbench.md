# 模板兼容配置与商品兼容关系贯通

RESULT：READY。默认与例外、发布冻结、新 SKU/MAT 自动带入、双向查询、主动同步、人工保护及失败重试的核心闭环已实际通过。本结论限于本轮约定范围，不表示全站无问题。

## 1. 实际基线与成果保护

- 仓库：`D:\单子\商城erp\mock\iyge-v2-mock`；开始分支 `20261022`，HEAD `fd5f6c8d1d899f1709a5ee58c775f8ad89a99c86`。没有回退到任务中的历史参考提交。
- 开始时没有已暂存文件；未暂存 `README.md`；未跟踪 `docs/benefit-package-workbench.md`、`docs/benefit-package-workbench-evidence.json`。这三项属于用户已有成果。本轮只追加 README 的模板兼容说明，不覆盖权益包报告。
- 仓库及适用祖先目录未发现 AGENTS.md。已读取 README、兼容/权益包既有说明、任务所列实际源码，以及真实单建、追加、旧编辑器、MAT、Excel、复制和备份恢复入口。历史报告的 HEAD、未提交描述和通过记录只视为历史现场。
- 开工快照：`work/template-compatibility/baseline/source-start.zip`，由实际 HEAD 归档加上上述三个工作区文件组成，覆盖当时未跟踪文件。大小 1,465,786 bytes，实际 SHA256 保存在 `baseline/manifest.json`。归档源码和 diff 比较明确按 Git 内容／LF 规范化处理，不能等同所有工作树文件原始换行字节。
- `baseline/manifest.json` 保存开始状态、源码内容和既有 work 产物哈希。开始前的源码在 `baseline/source/` 独立运行；未用新实现冒充旧基线。
- 新日志、截图、测试输出、补丁及应用验证全部在忽略目录 `work/template-compatibility/`，没有覆盖历史验证产物。最终 scope audit 校验 3934 个既有 work 文件原始 SHA256，全部一致；受保护旧生成器、V2、布局、草稿预览及权益包源码按规范化正文比较。
- 中途审计误将归档换行当作工作树字节，进行了多余 EOL 调整；已立即停止，并按操作前精确 SHA256 将 77/77 文件全部恢复。`eol-restoration-undo.json` 记录完整撤销，未残留正文或换行改动，未将该过程当作功能修复。
- 未暂存、提交、推送、合并或部署。独立补丁以开工工作区为基准，而非仅相对 HEAD。

## 2. 完成的业务闭环

商品模型维护默认配置和规格例外 → 只读查看每条合法组合的结果 → 保存草稿 → 发布冻结 → 按明确版本新增销售 SKU／MAT → 双向适用查询立即读取正式声明 → 已有商品主动检查模板更新 → 三方比较并确认应用。

继续使用原兼容工作台、双向查询和正式关系数组，没有手机侧反向副本；没有增加兼容设备导致的 SKU 笛卡尔积。权益包、列表工作台、导航、V2 选择器、SKU 生成、规划编号、布局和持久化版本保持原有职责。没有扩展订单、库存、履约、后端或升级依赖。

## 3. 实际调用链与文件职责

原 `NodeCompatibilityRule.hosts` 是节点元数据：`SpecConfigView → nodeCompatibility → 草稿节点配置／发布副本`，没有自动带入正式关系。原正式声明通过兼容命令保存；商品和 MAT 的若干创建路径直接修改活跃状态，再由 deep watch 保存。这种持久化差异是本轮涉及的原有缺陷。

新调用链：

1. `SpecConfigView`／`ModelListView` → `TemplateCompatibilityDialog` → 统一领域上下文预览 → `catalog.saveTemplateCompatibility`。
2. `catalog.publishSpecModel` → 结构检查、有效配置／冲突检查 → `freezeTemplateCompatibility` → 原规划对账 → 单次完整持久化。
3. 实际创建命令 → 在候选数据调用原生成／建档函数 → 只为成功新建 ID 执行 `materializeTemplateCompatibility` → 保存商品、正式声明、来源和回执 → 更新活跃数组。
4. `queryDeviceAccessories`／`queryAccessoryDevices` 继续查询同一 `compatibilities` 数组；新来源只是声明元数据，不维护另一份结果。
5. 当前工作台／抽屉 → `previewTemplateCompatibilitySync` → 用户选择 → `applyTemplateCompatibilitySync` → 原子提交。

| 文件 | 职责 |
| --- | --- |
| `src/domain/templateCompatibilityTypes.ts` | 默认、完整替代例外、结构选择条件、快照、明确生效状态 |
| `src/domain/templateCompatibility.ts` | 配置结构校验、调用内索引、选择条件匹配、生效结果、发布冻结、旧节点转换、跨版本结构映射 |
| `src/domain/compatibilityValidation.ts` | 原条件校验函数的共用纯实现，避免领域模块循环引用 |
| `src/domain/templateCompatibilitySync.ts` | 正式声明生成、逐声明基线、人工保护与删除记录、规格过期、三方预览／应用、创建摘要事实 |
| `src/stores/catalog.ts` | 权限、修订／预览依据复核、候选状态、真实存储先行及各实际创建入口接入 |
| `src/domain/catalogIdentity.ts` | 新增仅本次批处理使用的身份索引，与原 SKU/MAT 判断共用相同实现 |
| `src/domain/planning.ts` | 只新增可选已计算组合输入；原默认调用、顺序、匹配及编号算法不变 |
| `src/components/template-compatibility/` | 模型草稿、声明编辑、只读分页预览、商品来源、主动同步及纯展示摘要 |
| `SpecConfigView.vue`、`ModelListView.vue` | 模型摘要与入口；节点快捷入口编辑同一套新例外；复制统一走 store |
| `SkuCreateView.vue`、`V3MaterialActions.vue`、`TemporaryMaterialDialog.vue` | 复用同一计算结果展示创建来源和问题；页面不拼装正式声明 |
| `ProductIoView.vue`、`StoredDataRecovery.vue` | Excel 候选建档原子提交；备份恢复校验新增配置和保护信息 |
| `CompatibilityManager.vue`、`AccessoryCompatibilityDrawer.vue` | 保留个别维护与双向查询，增加来源、人工取消记录和检查更新入口 |

修改默认／规格范围看领域配置及配置弹窗；修改人工保护／同步看 Sync 领域与同步弹窗；修改创建入口看 catalog 与对应页面。核心画布、焦点、撤销、V2 生成器和原列表逻辑继续保留原实现。

## 4. 确定的生效规则

| 配置情况 | 结果 |
| --- | --- |
| 从未配置 | `unconfigured`，正常创建，不生成关系，不解释为不兼容 |
| 没有命中例外 | 使用模型默认配置 |
| 命中一个例外 | 使用该例外完整结果，替代默认配置 |
| 命中多个且完整结果相同 | 内容去重，保留精确规则／声明来源对 |
| 命中多个且结果不同 | `conflict`，定位规则与规格；不取并集、交集或隐藏优先级 |
| 明确保存空默认／空例外 | `empty`；空例外不回退默认，不等于不兼容 |
| 引用或选择条件无效 | `invalid`，不按空结果清理旧关系 |
| 显式不兼容 | 保留该业务结论和核验状态，由既有查询规则判断 |

完整内容比较包含真实主机身份和范围、PLN、结论、核验、能力、条件、依据、备注；忽略只用于显示的主机名称，条件集合规范化，不按设备 ID 单独比较。基本使用和快充分开。待确认保持待确认；条件只带入，不伪造条件已经满足。

配件规格选择条件与目标主机范围是不同类型。选择条件使用实际 `attributeId`、字典值字符串、属性节点／值节点及父值节点；同名不同 ID、不同条件分支不合并。历史版本读取自己的节点、角色和名称快照；没有快照时保持旧的未配置语义。跨版本仅接受可证明的相同结构身份；删除或重新创建节点造成无法对应时明确待处理，不按名称模糊匹配。

## 5. 旧节点配置与模型复制

旧 `hosts` 及已发布副本原样保留，默认不参与新继承。配置弹窗提供“旧节点配置”：展示节点、目标、建议范围及受影响组合，只有范围可证明的项能显式转换到本次草稿。未知范围继续待处理，不能转为全模型默认。旧数据缺少核验资料，转换声明为待确认。

转换只返回草稿；保存成功才落盘。规则和声明来源稳定，转换回执阻止重复转换；不回填旧商品，不改历史发布版本。模型复制重新分配模型、节点、规则和声明身份，同时重映射选择条件及转换回执，防止复制后再次转换同一旧配置。新模型是独立草稿，不复制商品或发布历史。ModelList 原 `ltr` 与设计器原 `logic` 新画布默认分别保持。

## 6. 发布与来源身份

`SpecModelVersion.templateCompatibilitySnapshot` 冻结完整默认、例外、声明、稳定规则／声明 ID、选择条件、角色来源、属性名称与结构版本。与草稿深度分离；仅兼容配置变化也能发布新版本，未变化不新增版本。新配置没有字段的旧版本不会被当前草稿补齐。

发布配置校验与规划对账复用已经展开的合法组合。节点顺序、identityKey、COMMON/VARIANT 回退、PLN 沿用／新增／停用和版本关联继续由既有算法处理。兼容变更不重新编号，不自动改历史 SKU/MAT。

`AppData.templateCompatibilityOrigins` 按目标类别与 ID、模型、稳定规则／声明来源保存单条基线、实际规格、来源版本及人工状态。身份不由版本号单独组成；相同例外合并的来源增减能够归并回同一条声明。正式关系保存对应来源引用，历史 manual、legacy、material-copy 继续保留原语义；没有真实操作者审计时不编造账号。

数据版本仍为 `15`，存储键仍为 `iyge-v2-mock-db`。新增字段可选；旧数据没有这些字段正常读取，不生成业务记录。新结构损坏时保留原存储并提示恢复，不以空数组或演示数据覆盖；未知字段随 JSON 恢复保留。

## 7. 真实创建入口覆盖

| 实际入口 | 本轮接入与保留行为 |
| --- | --- |
| `/skus/new`：手工、属性模板、发布模型、产品规划 | `catalog.appendSkus` 调用原 `appendSkuBatch`，批量完成后只处理新 ID。按 SPU 确认版本和实际完整规格生成；数量、顺序、身份、sourceNodeIds、创建来源不变 |
| 既有 SPU 下批量追加／单条维护 | 与新增 SKU 共用上述入口；既存／重复规格只跳过，不回填关系 |
| 旧 `ProductEditView` 单建／批量编辑 | `catalog.saveBundle` 继续原校验，候选状态一次提交，只为新增子项带入；不把未提交子项当删除指令 |
| 发布规划创建 MAT：设计器、独立物料建档入口 | `catalog.createMaterial → createV3Material → materialize`；每个 MAT 有自己的声明。同 PLN 多 MAT 独立；MAT 以自身明确版本为准，允许同一旧 SPU 下另建新版本 MAT，保留旧 MAT 和 SPU 绑定 |
| 临时 MAT | `catalog.createTemporary` 保留原属性与编号；只有明确发布版本、真实属性 ID／取值唯一对上合法组合时带入，否则正常建档并提示未带入 |
| Excel `ProductIoView` | 原 `applyExcelImport` 在独立候选运行，再由 `commitMaterialImport` 为本批新 ID 统一生成／提交。源摘要、回执、正式或临时判定保持；失败保留预览。此实际 Excel 入口创建 MAT，没有虚构销售 SKU Excel 创建入口 |
| 复制 SKU | 复制规格草稿，按目标 SPU 绑定发布版本重新计算兼容；不复制原商品人工关系，界面明确说明这一策略 |
| 复制模型 | 两个实际入口均用原子 store，复制配置并重映射来源和选择条件；不复制商品／版本 |
| JSON 备份恢复 | 还原已存正式关系、配置、来源和取消保护；不调用创建继承，不重新套模板 |

主机商品沿用现有角色与型号解析，不生成配件侧适用主机声明。缺少明确来源时，不用最新版本或草稿兜底。SKU/MAT 真实身份统一入口保持，同一 PLN 不构成 SKU 与 MAT 的映射。

## 8. 人工维护与主动同步

人工新增关系保留原所有权；完全相同的人工声明不会被重复创建或认领为模板管理。模板单条声明被改备注、条件、核验或能力时，仅保护该条来源；其余未改声明仍可更新。删除模板声明会留下持久化取消保护，后续同步不自动复活。删除与明确不兼容继续分别表达。

普通 SKU 的兼容相关规格变化会把原模板来源标为待重新核对，双向查询不再将旧规格的声明作为有效推荐；可对当前可证明的新合法组合预览并明确恢复。名称等无关字段不会触发重算；保留原模型／规划 SKU 的规格编辑限制。

主动同步逐条比较“上次带入基线／当前正式声明／目标版本期望”：

- 未人工修改的新增、变更、移除可安全选中；空配置可移除未改模板项。
- 人工修改、已取消、保留选择、明确不兼容默认保护；同型号不同能力和 model/planning 交叠按原范围语义判断。
- 人工否定与模板肯定冲突时突出展示真实人工声明；明确采用模板才允许取消对应否定，危险项不默认选中。
- 无法映射或引用失效标记待处理，不解释为空集合。目标版本未配置也不能据此清空旧关系。
- 确认时重新计算并校验预览依据和项目内容。预览后源数据变化必须刷新，不覆盖新修改。
- 重复相同更新不写入、不更新时间。采用模板只更新兼容及来源；不修改 SPU/SKU 版本、PLN/MAT 身份、规格、sourceNodeIds 或创建来源。

## 9. 保存与权限

本轮创建、保存配置、发布、复制、主动同步和 Excel 提交采用：独立候选 → 完整校验／生成 → JSON 序列化和真实 `localStorage.setItem` → 更新拥有的活跃字段。创建对象、正式声明、逐条基线和回执在同次提交中。失败不留下半商品／半声明／半版本，草稿和请求保留可重试；成功后才提示并跳转。

显式成功提交与 deep watch 共享已持久化内容标记，避免重复写入或相同内容回写。只更新本次拥有的字段，候选持久化保留当前其他模块的数据。预览不写业务数据、不消耗 ID／PLN；有专项将 `Date.now` 和随机函数设为抛错证明。

管理员权限在 store 边界及 UI 同时校验。只读角色可查看和预览，不可保存配置、发布、转换落盘、创建兼容声明、复制模型或应用同步。备份导入也不能绕过新增配置及来源保护权限。这里沿用 Mock 的角色能力，不声称实现真实多用户审计或服务端权限。

## 10. 使用步骤

1. 在“商品模型”选模型，点“配置适用设备”；或在设计器标题处进入。启用默认配置，选设备、添加型号，填写真实依据；资料不足保留待确认。保存到模型草稿。
2. 需要例外时进入“规格例外”，选择实际合法组合，单独设置完整结果；也可从节点“节点适用配置”带入可证明范围。复制默认方便调整，明确空配置会覆盖默认。看“生效预览”处理冲突／引用问题后发布。
3. 新建或选择绑定该发布版本的 SPU，在“新增 SKU”预览并确认；或对发布规划“创建物料”。创建摘要显示版本和设备分布，正式声明随对象一起保存。SKU 管理的“适用主机”以及设备的“适用配件”立即可查。
4. 已有商品进入兼容抽屉或“适用关系”的“检查模板更新”，选模型、目标发布版本及真实 SKU/MAT，预览三方差异。保留人工设置是默认；只有明确选择采用模板才改变受保护项。
5. 保存失败时保持当前草稿重试；不会要求逐个 SKU 再维护同样关系。弹窗取消、关闭、模型切换或离页有未保存确认，已选设备不因搜索丢失，预览分页与设备／规格检索共用真实结果。

## 11. 实际验证与复现

新增核心入口：

```bash
npm run check:template-compatibility
npm run check:template-compatibility:performance
npm run check:template-compatibility:visual
npm run typecheck
npm run build
git diff --check
```

核心入口依次运行新领域检查、真实 Pinia 状态检查、工作台 Chrome 闭环及合成 Excel 的实际导入界面检查。测试使用独立存储，固定业务时间和可重复 ID 输入；不读取或清空日常浏览器数据。`BROWSER_CHANNEL=msedge` 可选择已安装 Edge，但本轮实测浏览器是 Chrome，不能据此声称 Edge 实测通过。缺少浏览器会失败。

视觉对照要求本轮完整开工源码；默认使用已保存的 `baseline/source/`，也可通过 `TEMPLATE_COMPATIBILITY_BASELINE` 指定准确源码。脚本会检查缺失基线并失败，不使用当前源码代替。状态输出可配 `TEMPLATE_COMPATIBILITY_OUTPUT_DIR`，主浏览器输出可配 `TEMPLATE_BROWSER_OUTPUT`，导入浏览器可配 `TEMPLATE_IMPORT_BROWSER_OUTPUT`；领域与性能报告使用项目相对 `work/template-compatibility/`。新增脚本无个人绝对工具路径。

开工独立快照实际通过：`check-frontend.mjs` 的 11 个入口及其内嵌列表／归档等检查、兼容、物料归档、原兼容 query/state、权益包 domain/state/export；设计器旧业务闭环 13 个检查点通过，包含旧节点配置语义，记录两个既有 Vue Flow options 弃用提示。

本轮最终命令退出码、覆盖数量、日志哈希和浏览器状态记录以 `template-compatibility-workbench-evidence.json` 为准。新增领域及真实 Pinia 状态检查包含 A–G 边界、多例外完整字段、历史快照、SKU/MAT、多条独立声明、人工保护、存储失败和权限，具体组数见最终执行清单。最后补齐“打开配置后模型已删除”的 store 保存守卫，实际反例从错误成功变为拒绝且零写入，草稿保留。已有检查不是复制旧报告的通过记录；本轮重新执行的结果保存在新目录。

旧集成脚本的节点段按本轮明确的新入口更新：取消／重开／一次保存仍严格检查；断言新规格例外、待确认状态及旧节点元数据不变，不再要求写入旧节点 hosts。其余既有业务、数据保护和写次数断言保持。

真实 `1.1 手机 Apple.xlsx` 已执行 20 项导入／匹配检查：1097 行、1234 个公式、无合并单元格，583 行正式匹配建档及重复回执通过。固定合成表只用于新增模板关联的专门边界，单独标注，不冒充真实 Excel。

视觉：独立开始前源码与最终实现的明暗 SPU/SKU 列表、设备摘要及型号解析区域共 8 个比较项像素差为 0。设计器新增适用设备摘要单独保留整图前后对照，新增一行导致可用画布高度变化，未将该部分声称为像素相等。首次视觉脚本像素计数的分支错误已修正后重跑；那次脚本失败未当作生产回归或通过证据。

## 12. 性能证据

环境：Windows x64，Node `v22.18.0`，npm `10.9.3`，AMD Ryzen 9 9950X、32 逻辑 CPU、约 50.5 GB 内存。固定业务时间 `2026-10-23T04:00:00.000Z`。每策略预热 1 次、实际 5 次，报告中位数，完整样本在 `performance.json` 和 `batch-performance.json`。

旧版没有模板继承功能，因此不虚构新功能相对旧版本的提升比例。对照使用同一新增纯解析器：每个所选对象重复建上下文，与同批复用上下文，输出逐字段深度相等，输入不变。所有合法组合都展开，8／32／64 是本批选择对象数，不是截断组合。

| 上下文对照 | 节点／深度 | 合法组合 | 所选对象 | 历史规划 | 重复上下文 ms | 复用上下文 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 小 | 12 / 4 | 8 | 8 | 0 | 0.8204 | 0.1650 |
| 中 | 150 / 4 | 512 | 32 | 1000 | 33.9678 | 1.1162 |
| 大 | 554 / 4 | 4096 | 64 | 10000 | 767.0384 | 13.6399 |

实际带入／同步另使用相同节点、深度、完整组合数及目标批量大小，增加正式声明和回执历史：

| 批量样本 | 历史规划 | 原有正式声明 | 历史回执 | 实际批量带入 ms | 跨版本同步预览 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 小 | 0 | 113 | 100 | 0.8113 | 3.3053 |
| 中 | 1000 | 2013 | 1000 | 9.0168 | 32.8377 |
| 大 | 10000 | 10013 | 10000 | 70.3123 | 205.5139 |

重复／共享对照展开次数分别为 8／32／64 → 1。实际带入每批同源版本展开一次，历史声明数组只扫描一遍；跨新旧两个不同版本的同步各展开一次，声明和来源各扫描一遍。计数由实际领域 stats 断言，不是根据代码推测。整批 JSON 克隆放在批量带入计时之外；同步计时包括三方预览及依据生成，不代表完整页面渲染或 localStorage I/O。

仅有调用内索引及组件明确依赖的计算结果，随一次操作／组件释放；编辑后新建上下文，没有长期业务缓存。合法组合、PLN 对账和 V2 生成结果继续由原入口校验，未以限制组合数换性能。

## 13. 既有问题、限制与收口范围

- localStorage 没有跨标签页事务锁；本轮保证单次当前状态提交及预览依据复核，不声称多标签／多用户数据库级隔离。
- 旧 manual／legacy／material-copy 的去重和既有相反结论编辑限制保留；只针对模板来源的独立声明编辑采用完整内容比较，避免误冻结另一条声明。
- `ProductIoView.previewView` 的旧展示问题：同供应商的两条 ready 源行，会被“重复供应商区域＋ready 区域”拼接成三行显示。已用开始前 HEAD 代码与实际浏览器对照，业务候选仍为两条；本轮不改该旧展示逻辑。具体旧代码、截图和断言记录在 `import-browser/evidence.json`。新增模板导入专项用不同供应商的固定两行表测试事务接线，不声称该旧显示问题已经修复。
- 旧 Vue Flow options 弃用提示在独立基线与当前均有，不屏蔽、不混称本轮新增。导航最终对照仅旧基线上出现一次 `ResizeObserver loop completed with undelivered notifications`，当前该对照没有新增提示。已有大包构建提示在未改动的 `work/benefit-package/build.log` 和本轮构建中均有，不为消除提示改加载架构。
- Chrome 实测不等于 Edge、所有设备或实体配件兼容实测；125% 为浏览器等效缩放验证。没有真实硬件测试和后端接入，本轮验证声明、继承、查询及保护逻辑。
- 此前报告记录的 SKU 勾选重置问题，本轮没有另做专项复现或声称修复；当前既有 SKU 工作台及兼容抽屉的勾选保护回归通过。没有新增第五轮列表／画布／持久化全局重构。
- 普通命令通道的 Codex Windows 沙箱启动器缺失，备用 Node REPL 最低版本要求高于本机运行时；通过受审查命令通道完成工作，没有升级 Node 或项目依赖。

最终是否 READY 依据本轮实际核心闭环、必要回归、构建、视觉和性能证据；不表示全站所有问题已经解决。

<!-- GENERATED VERIFICATION -->

## 14. 最终执行清单与交付

以下表格从本轮实际进程退出码、日志和结果 JSON 自动汇总；开工基线的历史执行单独保留，没有冒充当前运行。

| 阶段 | 实际命令 | 退出码 |
| --- | --- | ---: |
| 最终既有领域 | `node scripts/check-frontend.mjs` | 0 |
| 最终既有领域 | `node scripts/run-domain-check.mjs scripts/compatibility-check.ts` | 0 |
| 最终既有领域 | `node scripts/run-domain-check.mjs scripts/material-archive-check.ts` | 0 |
| 最终既有领域 | `node scripts/run-domain-check.mjs scripts/accessory-compatibility-query-check.ts` | 0 |
| 最终既有领域 | `node scripts/run-domain-check.mjs scripts/accessory-compatibility-state-check.ts` | 0 |
| 最终既有领域 | `node scripts/run-domain-check.mjs scripts/benefit-package-domain-check.ts` | 0 |
| 最终既有领域 | `node scripts/run-domain-check.mjs scripts/benefit-package-state-check.ts` | 0 |
| 最终既有领域 | `node scripts/run-domain-check.mjs scripts/benefit-package-export-check.ts` | 0 |
| 最终既有集成 | `node scripts/run-domain-check.mjs scripts/sku-workbench-query-check.ts` | 0 |
| 最终既有集成 | `node scripts/run-domain-check.mjs scripts/sku-workbench-state-check.ts` | 0 |
| 最终既有集成 | `node scripts/run-domain-check.mjs scripts/sku-workbench-grouping-fix-check.ts` | 0 |
| 最终既有集成 | `node scripts/run-domain-check.mjs scripts/sku-workbench-migration-fix-check.ts` | 0 |
| 最终既有集成 | `node scripts/run-domain-check.mjs scripts/sku-workbench-restore-fix-check.ts` | 0 |
| 最终既有集成 | `node scripts/run-domain-check.mjs scripts/excel-import-check.ts` | 0 |
| 最终既有集成 | `node scripts/browser-spu-sku.mjs` | 0 |
| 最终既有集成 | `node scripts/browser-sku-workbench.mjs` | 0 |
| 最终既有集成 | `node scripts/browser-sku-workbench-fixes.mjs` | 0 |
| 最终既有集成 | `node scripts/browser-accessory-compatibility.mjs` | 0 |
| 最终既有集成 | `node scripts/browser-benefit-packages.mjs` | 0 |
| 最终既有集成 | `node scripts/browser-navigation-filter.mjs` | 0 |
| 最终既有集成 | `node scripts/browser-frontend-final.mjs --business-only` | 0 |
| 最终构建 | `node scripts/run-domain-check.mjs scripts/template-compatibility-domain-check.ts` | 0 |
| 最终构建 | `node scripts/run-domain-check.mjs scripts/template-compatibility-state-check.ts` | 0 |
| 最终构建 | `npm run typecheck` | 0 |
| 最终构建 | `npm run build` | 0 |
| 最终构建 | `git diff --check` | 0 |
| 最终新工作台 | `npm run check:template-compatibility` | 0 |
| 最终新工作台 | `npm run check:template-compatibility:visual` | 0 |
| 最终新工作台 | `node scripts/template-compatibility-scope-audit.mjs` | 0 |

新增纯领域 18 组、真实 Pinia 状态 14 组、工作台浏览器 14 个检查点通过；合成 Excel UI 入口 5 个检查点通过。原始数据摘要见 `browser/business-final.json`、`import-browser/03-committed-business.json` 和 `import-browser/evidence.json`，保留关键对象身份、版本、关联和数组顺序。

新增检查使用项目依赖，核心不需要旧源码基线；只有前后视觉／保护审计需要准确开工快照。既有导航对照继续使用已存在且未改变的原导航基线；其结果写入本轮新目录。所有本轮旧回归输出均通过环境变量隔离。

独立交付补丁：`work/template-compatibility/template-compatibility.patch`。补丁由完整开工快照生成，另外在快照副本执行 `git apply --check`、真实应用并逐文件对照最终内容；应用退出码、文件清单和补丁 SHA256 保存于 `independent-patch-evidence.json`。不改真实 Git index 或分支。

交付分支和 HEAD 仍为 `20261022 / fd5f6c8d1d899f1709a5ee58c775f8ad89a99c86`。工作区保留本轮未提交改动和用户开始前成果；没有暂存、提交、推送、合并或部署。完整源码文件哈希、最终工作区状态、日志哈希、覆盖边界及调试历史说明见同名 evidence JSON。核心验收通过后收口，不自动扩展其他业务。
