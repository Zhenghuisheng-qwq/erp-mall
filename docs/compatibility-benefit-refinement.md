# 兼容关系与权益包：可靠性修复与使用体验优化

RESULT：READY。关键业务与当前验收范围见机器证据；历史测试产物保全例外单独披露。

本报告只覆盖此次兼容关系、权益包和必要共享持久化改动。没有增加订单、支付、库存、发货、激活或后端能力。当前成果保留在本地，未提交、推送、合并或部署。

## 1. 实际基线与成果保护

- 仓库：`D:\单子\商城erp\mock\iyge-v2-mock`；分支 `20261022`；开工及最终 HEAD 均为 `6ca82dfda3d7ac5e8fb2ba1e9313a1458c1a7844`。
- 开工时暂存、未暂存、未跟踪文件均为空。没有用户未提交源码需要搬移，也没有回退到早期分支。
- 已核查适用祖先目录及项目内 AGENTS.md，未找到适用文件；读取 README、既有兼容/权益包报告和真实领域、界面、持久化、创建、导入调用链。旧报告仅作背景。
- 开工原始源码 302 个文件存于 `work/compatibility-benefit-refinement/baseline/source-start.zip` 及展开目录 `baseline/source/`。这是实际工作树原始字节；另外保存了 HEAD 归档 `baseline/head.zip`。
- 源码快照 1,596,389 bytes，SHA256 `d539e71d54ade65603a81f048648e93204a5bfe75ca940c0e48e42fc55c2ae10`。`baseline/manifest.json` 记录原始状态和文件哈希。
- 初始七项旧领域/状态/导出检查在该独立源码目录运行，全部退出 0。没有用优化后的代码冒充原实现。
- 核心算法保护清单 32 个文件、历史 docs 20 个文件按原始 FS SHA256 比较。最终机器证据重新核验，未用换行归一化冒充字节一致。共享页面的改动限于持久化等待、失败反馈及必要入口。
- **历史测试产物保全例外**见第 14 节：四份旧 ignored 产物被误覆盖。源码和历史文档未因此丢失；不声称所有旧产物均完整保留。

## 2. 三类缺陷：先复现，再修复

| 缺陷 | 原实现实际反例 | 根因 | 最终结果 |
| --- | --- | --- | --- |
| 模板来源合并/拆分 | 初始 4/4 严格反例失败：合并冲突同时默认移除两个旧来源；拆分重复认领同一声明/预览 ID，回执两次更新实际只剩一条 | 按新结果逐条贪心认领旧来源，未整体预留相关来源 | 来源连通组计划；19/19 严格检查通过，实际 UI 合并/拆分回执与正式声明一致 |
| 停用规则保存后不能重载 | 初始 58 项中 57 FAIL、1 PASS；关闭整套或单组后，非法数量仍能保存而导入拒绝 | 保存跳过停用规则，导入仍严格检查全部保留结构 | 共用基础结构校验；最终 60 项通过，隐藏错误定位、修正及刷新通过 |
| 多页旧快照覆盖新数据 | 同一 BrowserContext 两个 Page；A 成功新增权益包，B 旧页保存模型草稿返回成功，磁盘权益包数 1→0 | 各标签只校验内存 revision；整份 payload 写入和 watcher 无跨页事务 | 全部当前业务写入进入原生 Web Lock，锁内核验接受的原始存储依据；13 组真实双页验证通过 |

证据：`sync-before.json`、`benefit-structure-before.json`、`storage-baseline/evidence.json`。修复前 FAIL 是预期反例证据，未改期望使旧实现通过。

## 3. 来源合并、拆分与历史语义

`templateCompatibilitySync.ts` 先对某个实际 SKU/MAT 的旧活跃来源和新期望来源构图，再按连通组建立确定计划。索引在本次调用内创建。

- 一对一继续沿用原正式声明身份；安全更新按原顺序处理。
- 多对一、一对多、多对多各以唯一的 `TemplateSyncItem.id` 表示一个不可拆开的组，内部操作、来源和目标身份唯一。
- 默认保留整组原结果；冲突参与来源不会再落入默认删除。
- 无保护的组可明确选择“采用这组模板结果”。界面先显示旧/新结果及实际移除、新增数；执行时按同一计划移除旧 managed 声明、新建完整结果，旧来源转 obsolete 并保留旧基线、声明 ID 和 lineage。
- 人工修改、人工删除、明确保留、规格过期、相反人工结论或重复独立声明使该组不可直接采用。安全全选不会绕过保护，界面提供“维护此商品声明”入口。
- obsolete 退出活跃来源竞争，deleted 的取消保护继续保留。精确 `(ruleId, claimId)` 对参与新来源身份；旧无 lineage 数据继续兼容原回退，不按名称推断。
- 提交前重算并核验 basis 和完整计划；陈旧或被篡改的预览拒绝，零正式编号分配、零半成品。
- 已验证分开→合并→拆分→再合并→再拆分、多对多、修改/删除/kept/stale/deny 保护、重复预览/应用、独立安全项及历史快照不变。

## 4. 基础结构与启用业务约束

`benefitRuleStructureIssues` 被保存校验与导入/启动检查共用。所有保留组都验证 ID、基础字段和安全整数；是否启用只影响选配业务约束。

`minKinds` 可为 0；`maxKinds`、默认、最少和最多件数为安全正整数。空、非数字、NaN、Infinity、小数、负数和溢出不被取整或默认值掩盖。`BenefitIntegerInput` 保留非法原文并报告错误，停用不会让错误消失。

问题携带 `groupId/field/serviceId` 等内部定位数据，普通界面显示组名与字段说明。点击问题会打开高级规则及对应停用组，聚焦出错输入；允许明确修正或删除。关闭规则仍可保留业务上未完善的内容，但不能保存无法重读的结构。

异常原始存储进入恢复页，原文不清空，不加载种子覆盖。用户可下载实际原文，校验所选 JSON 后明确恢复。没有自动猜测修复、隐式数据迁移或声称存在未创建的备份。

## 5. 共享写入口与提交协议

`src/stores/catalogPersistence.ts` 是业务存储键的唯一 `setItem` 出口。以下入口共用同一 origin 的 `iyge-v2-mock-db:commit` Web Lock：

| 入口 | 保护方式 |
| --- | --- |
| 权益包保存、状态、收藏、交付生成 | 锁内核验数据依据，再做 revision、请求回执、编号和候选计算 |
| 模板兼容配置、模型草稿、发布、同步、模型创建/复制 | 同一锁内执行命令和持久化，成功后回填当前内存 |
| SPU/SKU/MAT 创建、修改、物料导入 | 同一锁内计算/保存实际新增、正式声明及回执 |
| 兼容声明、设备绑定、独立型号、旧物料关系 | 显式命令 await；旧直接 mutation 由受保护 watcher/flush 保存后再反馈成功 |
| SKU 工作台视图 | 全局存储依据之外，锁内再次核验调用时的 SKU 页面依据；拒绝同页排队的旧候选，保留无关 SPU 设置 |
| JSON 导入、恢复、全量/模块重置 | 同锁和捕获依据；成功后切换内存，使用新数据集身份 |
| 深度 watcher、初始种子、迁移自动保存 | 同锁核验；`normalizeStored` 只转换内存，不另行写盘 |
| 品牌、分类、账户、属性、反馈等旧直接写入 | 原业务动作保留，明确保存反馈 await `flushPersistence`；失败保留输入，不假报成功 |

锁内重新读取真实 LocalStorage，与本页已接受的原始 payload 做精确比较。成功写入根 envelope `commit:{datasetId, revision, commitId}`；业务 AppData、`DATA_VERSION=15` 和原 LocalStorage 键不变。正常提交保留 datasetId；导入、恢复、重置使用新 datasetId，避免 revision 重复造成误认。

本页 Promise 队列只负责本页顺序；跨页互斥由 Web Locks 提供。`storage` 事件只作提示，不充当 CAS。失败不推进接受的依据，不回填候选，不消耗正式编号；重试沿用请求身份。

旧页采用保守拒绝策略，不自动合并任意编辑。外部更新提示持续可见，本页输入保留。“读取最新”先说明将放弃未保存内容，可取消继续编辑；确认后刷新，避免再触发第二次权益包/模板卸载确认。普通保存不增加确认步骤。

## 6. 异步边界的回归修正

公共显式命令现在返回 Promise。已更新真实调用方及相关旧检查的 await、loading、错误处理和 watcher settle。

独立审查另外确认了保存等待期间的回归：用户可继续修改，旧提交成功后回填会吞掉后续输入。模板、同步、兼容维护、设备绑定、权益包、模型创建/复制、设计器保存/复制、SPU/SKU/MAT 表单、导入/重置等实际入口已加局部 pending 保护。等待时禁改会被回填的输入、重复提交、关闭和相应导航；失败仍保留输入并允许重试。设备绑定还校验 await 前后的上下文代次。

同页 SKU 页面两个锁外构造的候选也可能先后提交而互相覆盖，现按 SKU 页面依据在锁内二次核验。专项 4 项状态检查、6 项原生持锁 UI 检查通过；包含重复点击/Ctrl+S 单次命令、复制单次创建、SKU/SPU 隔离、设备绑定字段/关闭/Escape。

旧领域算法没有改写。旧检查的改动是异步等待、独立 Pinia 生命周期隔离、输出参数和新交互步骤；未降低身份、顺序、历史或数据完整性断言。

## 7. 兼容配置的新界面

- 桌面默认紧凑行展示型号及来源、能力、结论、核验、问题和展开入口；范围、规划、依据、备注、条件按需展开。待确认和错误在折叠时仍可见。
- 选择多款型号后，填写本批能力/结论/核验/依据及必要前提，明确“对所选 N 款应用”到草稿，再逐条调整。默认待确认，基本使用与快充独立。
- 尚未应用的批量输入仍属子组件本地草稿，通过 `batch-change` 纳入父弹窗防丢；保存要求先明确应用或清空选择。关闭、切模型和切例外不会静默吞掉这批输入。
- 摘要可点击查看默认型号、例外、默认/例外组合数和待完善；例外按范围→完整结果→影响组织。复制默认、空覆盖、删除恢复默认有明确区分，高风险动作放入更多菜单并确认。
- 错误携带规则、声明和字段定位；缺依据、缺条件等点击后展开、滚动、聚焦，行内持续显示，修正后消除。
- 标题和 footer 保持在视口内，内容单一滚动。旧节点转换折叠为次级工具，仍可发现且不自动转换。
- `DeviceModelPicker` 在模板、兼容声明与绑定入口复用；名称为主、类型/模型/独立来源为辅，同名身份不合并。权益包保留其“具体销售 SKU / 仅型号”组合选择入口，并将仅型号 key 传给维护页。未改 V2 模型选择器。

同步界面默认仅变化，可筛新增/更新/移除/保护/冲突/无效/不变，按实际 SKU/MAT 归组；普通结果逐字段标识变化，组显示完整前后结果。依据、旧基线和历史来源可展开。重新预览只保留仍有效的选择；回执使用实际执行计数。

## 8. 权益包体验与状态归属

桌面保留左侧选内容、右侧包内清单。摘要持续展示商品种类/每包件数、服务数及计量说明、每包报价/未报价、问题数、保存状态。零元与未报价继续区分。

“保存并预览交付”只在完整保存成功后创建新预览；最终生成仍需独立确认，不复用旧确认。设备仅是兼容检查上下文，加入手机是显式动作，型号上下文不生成虚构 SKU。已加入数量、停售、待确认和不适用状态使用原真实判定。

包内条件确认入口直接可见，依据按需展开。确认属于当前包和当前 basis，不修改全局事实；数量、组成、设备和声明变化后失效，不能升级待确认或明确不兼容。

父 composable 维护权益包草稿、报价原文、条件备注、候选查询、交付预览及唯一离开等待；服务弹窗保留本地未提交草稿，并报告 dirty。取消/X/Escape/路由/beforeunload 走统一防丢；保存并离开先验证并确认有效服务，不漏掉弹窗内容。新导航会取消旧等待，避免悬挂 Promise。

维护关系前只在内存保留整包草稿、报价原文、条件备注、搜索/分类/页签和滚动位置。带实际 SKU 或 `deviceModel` key 定位维护，安全站内 returnTo 返回后恢复。SKU→组包→保存→交付→当前包→原 SKU 链保留范围、原视图、查询、选择与合理焦点；临时状态不写整份 AppData。

## 9. 窄屏、主题与实际视觉验收

Chrome `156.0.8078.47`，Windows；独立 BrowserContext，未清空用户日常浏览器。记录了真实前后截图和业务断言，不以图片存在代表功能通过。

| 区域 | 本轮实际覆盖 |
| --- | --- |
| 模板默认/展开/例外/预览 | 1366×768、1920×1080、920×768、375×812 明/暗、1093×614 深色 125% 等效 |
| 模板错误/保存失败/同步组/保护 | 实际错误聚焦、quota 保输入、默认保留、整组采用、人工保护维护入口 |
| 权益包与服务弹窗 | 1366 明/暗、1920 明/暗、980 窄桌面、375 明/暗、125% 等效，共八组 |
| 权益包业务 | 空包新建、有内容、条件确认、报价、保存预览、独立生成、交付快照、维护返回 |
| 原导航和无关列表 | 原导航 9 项专项，十组查询前后对照及原脚本无关区域像素断言通过 |

125% 包含 CSS 缩放或等效 CSS 视口的脚本场景，具体参数留在 JSON；不是系统 DPI/浏览器工具栏原生缩放全覆盖声明。已人工查看紧凑默认、错误聚焦、同步合并、375 内容、深色和服务弹窗截图。

原 375px 常驻侧栏会挤压内容；现在仅权益包/兼容关系路由 ≤700px 使用 `RailNav.temporaryCompact`，沿用原浮层菜单，不改用户 collapsed 偏好；离开或加宽恢复。实测 375 内容宽约 295px。窄屏选商品/包内清单切换，主要操作和摘要保持可达。原实现 125% 服务确认按钮越界已在本轮修复，对照失败截图保留。

样式限模块语义层和上述条件导航布局，沿用主题变量、Windows 系统字体与 reduced-motion。未下载字体、生成商品图或全站换肤。

## 10. 性能证据

环境：Windows x64、Node v22.18.0、npm 10.9.3、AMD Ryzen 9 9950X。固定样本，预热 1 次、测量 5 次，报告中位数；完整原始轮次在 `edit-performance/result.json`。

连续 12 次依据编辑的**领域微基准**：原实现每次重建 context；最终实现建立一次结构索引，每次重新校验草稿。计时包含最终的一次结构准备，完整结果校验在计时外。不是整页输入延迟或 FPS 测量。

| 样本 | 节点/深度 | 合法组合 | 历史规划/声明 | 原实现中位 ms | 最终中位 ms | 展开次数 原→新 |
| --- | --- | --- | --- | --- | --- | --- |
| 小 | 12 / 4 | 8 | 0 / 13 | 0.8907 | 0.5923 | 12→1 |
| 中 | 90 / 4 | 512 | 0 / 13 | 10.7641 | 1.5797 | 12→1 |
| 大 | 306 / 4 | 4096 | 0 / 13 | 80.9526 | 8.3855 | 12→1 |

两实现最终完整结果的 SHA256、身份、顺序一致，输入未修改。编辑器 computed 结构只依赖实际节点、版本、角色及设备目录；依据/备注输入不重新展开。只在查看预览时生成全部逐组合展示结果，摘要用当前索引统计；卸载释放，无全局业务缓存。

原批量创建/同步性能契约也重新执行：8/512/4096 组合、8/32/64 个混合 SKU/MAT 对象，同步预览中位 3.3683/31.9751/174.0828 ms。大小样本历史和每轮数据见 `legacy-sync/batch-performance.json`；每批两个版本上下文/两次展开，历史数组各扫描一次。该表是最终成本记录，不冒称与旧报告耗时构成加速对比。

## 11. 实际命令与结果

以下为本轮真实运行；机器证据索引包含命令、退出码或脚本生成的严格结果、日志 SHA256。最终只在新增改动影响相应路径时补跑。

| 命令/入口 | 结果 |
| --- | --- |
| `node scripts/run-domain-check.mjs scripts/template-compatibility-domain-check.ts` | 21 PASS，原断言保留并新增结构复用/错误修复/Vue 依赖失效断言 |
| `node scripts/run-domain-check.mjs scripts/template-compatibility-state-check.ts` | 14 PASS，最终新目录重跑 |
| `node scripts/run-domain-check.mjs scripts/benefit-package-domain-check.ts` | 30 PASS |
| `node scripts/run-domain-check.mjs scripts/benefit-package-state-check.ts` | 12 PASS |
| `node scripts/run-domain-check.mjs scripts/benefit-package-export-check.ts` | 7 PASS |
| `node scripts/run-domain-check.mjs scripts/accessory-compatibility-query-check.ts` | 原查询检查 PASS；亦由本轮兼容/业务回归覆盖 |
| `node scripts/run-domain-check.mjs scripts/accessory-compatibility-state-check.ts` | 11 PASS |
| `npm run check:compatibility-refinement:domain` | exit 0：同步 19、结构/存储 60、共享存储 8、同页异步 4 |
| `node scripts/browser-compatibility-benefit-concurrency.mjs` | exit 0，13 组真实双页及实际环境能力检查 |
| `node scripts/browser-catalog-async-save-check.mjs` | exit 0，6 组原生 Web Lock 持锁 UI |
| `node scripts/browser-compatibility-refinement.mjs` | exit 0，3 个组合功能组、36 张关键前后/展开/错误/同步截图；含模板/同步/维护真实持锁及未应用批量防丢 |
| `node scripts/browser-benefit-refinement.mjs` | exit 0，15 组功能/视觉 |
| `node scripts/browser-template-compatibility.mjs` | exit 0，最终 14 项旧业务浏览器闭环 |
| `node scripts/browser-benefit-packages.mjs` | exit 0，最终 18 项旧权益包浏览器回归 |
| `node scripts/browser-accessory-compatibility.mjs` | exit 0，16 项 |
| `node scripts/browser-template-compatibility-import.mjs` | exit 0，5 项真实合成 Excel 上传/重试/刷新 |
| `npm run check:frontend` | exit 0，完整 11 脚本，含列表、分类、规划、草稿组合、物料、一致性、布局、SPU/SKU、导航 |
| `node scripts/browser-navigation-filter.mjs` | exit 0，9 项，使用其真实旧基线 |
| `node scripts/browser-frontend-final.mjs --business-only` | exit 0，13 项，发布/复用/新建 MAT/列表/刷新/历史/重挂载 |
| 原 SKU state、migration-fix、restore-fix 检查 | 新异步边界后重跑均 exit 0 |
| `ERP_MATERIAL_XLSX=... node scripts/run-domain-check.mjs scripts/excel-import-check.ts` | exit 0，20 项；实际 Apple 工作簿 1097 物料行、1234 公式、0 合并；583 创建及重复 583 幂等识别 |
| `npm run check:compatibility-refinement:performance` | exit 0，真实原源码前后微基准与结果哈希断言 |
| `npm run typecheck` / `npm run build` / `git diff --check` | 最终 exit 0；生产构建的大包提示保留 |

原完整 `check:frontend` 的首次执行因旧 round1 多 Pinia 测试共用假 LocalStorage、异步 watcher 尚未结束而失败。修复独立实例 dispose/settle 后原断言 24/24 通过，最终完整 11 脚本通过；没有把该测试隔离故障隐去或放宽业务断言。

## 12. 真实双页与环境能力

每个并发场景在**同一个新 BrowserContext 中创建两个 Page**，共享同源真实 LocalStorage。以原生持锁屏障及锁查询控制竞争窗口，不靠随机等待。

实际覆盖：A 包/B 旧模板、A 清单/B 旧包名、A 模板/B 旧同步、同时新建和回执重试、同记录冲突、无关记录/历史保留、延后的旧 watcher、输入保留/读取最新取消及继续、quota 失败重试/重复请求、导入恢复重置的新 dataset，以及品牌/账户真实旧 UI 不假报成功。

localhost 和 127.0.0.1 实际为安全上下文并成功保存；普通 HTTP `catalog-test.invalid` 实际不安全且拒绝写入；模拟缺少 Locks 也明确拒绝。真实 HTTPS 使用临时自签 PFX 和 TLS 服务器，在独立浏览器上下文忽略证书信任错误，未伪造安全上下文/Locks 能力，保存成功。没有安装系统证书。

重跑 HTTPS：`powershell -File scripts/create-storage-test-certificate.ps1`，按脚本输出设置 `REFINEMENT_TLS_PFX`、`REFINEMENT_TLS_PASSPHRASE` 后运行并发脚本。缺少 PFX 时只如实记录 HTTPS 未验证，不冒充通过；无保护写入始终禁止。

## 13. 维护边界及检查入口

| 修改内容 | 首要文件/职责 |
| --- | --- |
| 模板配置与定位 | `TemplateCompatibilityDialog.vue` 维护整个本地草稿、防丢/保存；`TemplateClaimSetEditor.vue` 维护行展示及未应用批次；`templateCompatibility.ts` 统一校验/结构索引/真实结果 |
| 来源同步 | `templateCompatibilitySync.ts` 统一计划、保护和实际操作；`TemplateCompatibilitySyncDialog.vue` 只展示计划、收集组级决定及回执 |
| 设备选择与维护返回 | `DeviceModelPicker.vue` 显示身份来源；`CompatibilityView.vue` 解析实际对象和型号 key；领域 `deviceResolution.ts` 继续唯一事实入口 |
| 权益包 | `useBenefitPackageEditor.ts` 拥有包/预览/离开状态；规则、服务子组件只维护各自输入与定位；`benefitPackages.ts` 负责结构与业务规则；`benefitNavigation.ts` 校验站内返回地址 |
| 持久化 | `catalogPersistence.ts` 锁/依据/commit 身份；`catalog.ts` 权限与命令、候选和受保护 watcher；`CatalogStorageNotice.vue` 外部更新提示 |
| 旧页面 | 保留其业务、查询和结构，仅 await 新提交/flush，局部 busy 与失败反馈。不要另开无锁写入口 |
| 窄屏导航 | `RailNav.vue` 的临时展示收起不写偏好；`AdminLayout.vue` 仅对相关路由启用 |

稳定入口：`npm run check:compatibility-refinement:domain`、`:browser`、`:performance`。依赖来自项目，Chrome 可配置 `BROWSER_CHANNEL`；缺浏览器会失败。需要前后对照的脚本明确核查快照目录，`REFINEMENT_BASELINE`（权益包原视觉为 `REFINEMENT_BASELINE_ROOT`）应指向真正开工源码。

完整文件列表、最终原始哈希、各结果 JSON 和命令日志在同名 evidence JSON。无新增运行时依赖，没有升级依赖或重构查询、组合/编号算法、全局 store 数据结构、画布、V2 生成器。

## 14. 原有问题、本轮例外与剩余限制

**原有问题/明确未扩展项：**

- Vue Flow 的 options 参数弃用警告仍存在；375px 原设计器背景的父容器尺寸警告在开工源码和最终源码均可观察，未屏蔽。模板新脚本按实际基线对照记录。
- 原导航专项的 ResizeObserver：旧基线 1、最终 0，见 `final/navigation-browser/window-diagnostics.json`。不能把旧基线日志误称本轮新增错误。
- 大于 500kB 的构建 chunk 警告保留，没有临时改加载/打包方式。
- 合成物料导入的既有供应商重复预览展示问题仍单列在原脚本 `knownExistingIssue`，未改业务导入断言来掩盖。

**本轮执行例外：**

早期几个旧脚本未指定正确输出目录/变量，误覆盖四个 ignored 产物：

1. `work/template-compatibility/state/evidence.json`
2. `work/accessory-compatibility/state/failure.json`
3. `work/sku-workbench-fixes/restore-after.json`
4. `work/sku-workbench-fixes/migration/after-result.json`

原清单 5283 项中 5279 项原始 SHA 一致；四项原 SHA 和当前 SHA 均在 `historical-artifact-write-audit.json`。快照只保存了旧产物哈希，没有其正文备份，无法恢复原字节，未伪造恢复。此为本轮执行失误，独立范围审计的 overall 标记保留 false；生产保护项与最终功能验收分别记录，不混称“全部产物保全通过”。后续输出全部隔离到本轮目录。

**实际限制：**

- 未单独跑 Edge、所有设备、操作系统 DPI 或原生打印对话框；实际 Chrome、打印调用和导出内容已验证。beforeunload 事件保护已测，不冒称操作系统真实关窗的人工体验全覆盖。
- 非安全 HTTP 或没有 Web Locks 的浏览器不能保存，保留输入并给明确提示。当前合作写入口以外的旧版本页面、开发者工具或外部程序不遵守锁，本地存储协议无法使其写入也原子化。
- 旧页拒绝保存后需保留必要输入再读取最新；没有任意冲突自动合并。维护返回的临时整包草稿是内存态，不承诺刷新或重启后恢复未保存输入。
- 前后性能仅说明领域上下文复用成本与次数，不能外推为整站响应提升或所有场景相同比例。

## 15. 交付与停止范围

三类关键数据缺陷已修复，有反例、真实并发、必要旧回归、实际界面/视觉及构建证据。未发现本轮引入的已知业务阻断；历史测试产物保全例外及环境限制已单独列出。收口判断由 `compatibility-benefit-refinement-evidence.json` 的实际结果汇总生成。

所有生产及检查修改保留在当前工作区。开工干净，因此当前未提交源码变更均属本轮；此前已提交成果没有回退。完整本地补丁（含新增文件）和最终源文件清单在 `work/compatibility-benefit-refinement/final/`。未执行 git add、commit、push、merge 或部署；达到本轮验收后停止，不自动开展下一轮。
