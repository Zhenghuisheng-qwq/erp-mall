# 权益包工作台实施与验收

RESULT：READY。本轮的组包、复用、规则与适配校验、人工报价、不可变交付清单、查看打印导出、失败保留及重试已经形成实际可用的闭环。READY 限于约定范围，不表示全站没有既有问题。

## 1. 实际基线与工作方式

- 项目：`D:\单子\商城erp\mock\iyge-v2-mock`，分支 `20261022`。
- 开始与交付 HEAD：`b452980fca570cf8c18838ab1597999accf4e24c`，与本次参考提交一致。开始时 `git status --short` 为空；没有用户未提交源码或未跟踪文件需要覆盖、回滚或隔离。
- 仓库及适用祖先目录未发现 AGENTS.md。已读取 README、SPU/SKU、SKU 工作台、兼容工作台报告，相关领域模型、真实身份、型号解析、兼容规则、store、路由、菜单、未保存提示与已有检查。历史报告的旧 HEAD/通过记录仅作为历史说明。
- 开工源码由真实 HEAD 归档到 `work/benefit-package/baseline.zip`，展开的 `baseline/` 用于原实现检查；`baseline-head.txt`、`baseline-status.txt` 保存基线说明。没有用修改后源码冒充旧版本。
- 所有本轮原始日志、截图、输出与独立补丁均在 `work/benefit-package/`；新增报告及机器证据各一份，未覆盖历史报告。
- 普通命令通道因 Codex 沙箱启动器已不存在而无法启动；备用 Node REPL 因运行时最低版本要求拒绝启动。通过受审查的命令通道继续执行项目工作，未升级 Node、应用依赖或修改宿主环境。
- 全部改动保留本地，未暂存、提交、推送、合并或部署。

## 2. 本轮能力与边界

增加独立权益包菜单、列表、同屏编辑器、交付清单详情，以及 SKU 行和兼容抽屉的组包入口。用户不需要先创建模板、规则或审批流程：选设备 → 添加内容 → 保存权益包即可。也可不选设备，自由组合真实销售 SKU 与独立服务。

支持商品加入/合并数量/替换/移除、独立服务、常用包、复制、可选选配组、兼容与条件确认、未报价/零元/人工整包报价、草稿/可用/停用、按本次包数生成清单、冻结历史、打印和 Excel 下载。数据写入与预览仍在当前前端 Mock 内完成。

没有增加支付、订单、仓库、库存扣减、物流、税票或服务核销；清单不是已支付、已出库、已发货或已激活的履约记录。权益包不创建普通 SKU，不借组合生成新的 SPU、PLN 或 MAT，不复用运营分组存业务配置。

## 3. 数据结构与状态归属

数据版本仍为 `15`，存储键仍为 `iyge-v2-mock-db`。`AppData` 只增两个可选集合：

| 集合/结构 | 内容 |
| --- | --- |
| `benefitPackages` | 包 ID/独立 BPK 编号、修订、名称、状态、常用、适配上下文、实物行、服务行、规则、人工报价、条件确认、创建请求及时间 |
| `benefitDeliveries` | 独立 BDL 编号、生成请求、来源包与修订、包数、设备摘要、完整商品/服务、数量、报价、适配依据、确认及生成时间 |
| `BenefitGoodsLine` | 稳定行 ID、真实销售 SKU ID、每包数量及可读商品摘要；身份不依赖名称 |
| `BenefitServiceLine` | 包内稳定条目 ID、名称、数量、单位、计量、期限说明和服务约定；不存进 SKU/MAT |
| `BenefitSelectionGroup` | 独立组 ID、明确候选、启用/必选、商品种数范围、每种默认件数和可调整范围 |
| `BenefitConditionConfirmation` | 设备上下文、条目、能力、声明引用、条件说明、确认说明/时间及当前配置依据 |

store 持有正式配置和清单；编辑 composable 持有深拷贝草稿、未保存状态、请求、预览及轻量弹窗状态。服务弹窗只编辑自己的局部副本。查询和 computed 不回写正式状态；引用变化仅计算“需处理”，不会在纯查看时改掉包的业务状态。

## 4. 适配设备与实际交付手机

`device` 为 `null`、具体销售设备 SKU，或明确型号身份。它仅用于匹配配件。选设备或从手机进入不会自动加入手机，不计入实物数量或报价。

“包含这台手机”是显式操作：只允许具体真实销售主机 SKU；若已在清单中则关联现有行，不重复加一件。移除会提示具体商品。纯型号、独立型号、PLN、SPU 或 MAT 都不能冒充可交付手机。

设备切换时保留现有配件和服务并重算适配；若包内有旧手机，一次对话框提供仅换适配对象、同时替换包内手机、取消三个选项。不会静默删除配件或把旧手机换成新机。

`includedPhoneSkuId` 表示该显式开关指定的主机行；快照另冻结 `hostSkuIds`，表示实际实物行中的全部主机。自由包从“其他商品”直接添加手机时，也会正确显示/导出包含主机，不因开关标记为空误写不含手机。历史显示只读冻结字段，不再依赖当前商品角色。

## 5. 商品、数量与服务计量

实物使用现有 `catalogIdentity.isRealSku`，名称/规格/所属 SPU/销售状态使用已有真实字段及 `savedSkuSpec`。同 SKU 再次加入合并数量，不同 ID 即使同名同规格也不合并。替换保留原数量，若目标已有则合并并重新校验。当前停售、下架或引用失效的旧条目保留可读摘要并标记，不能生成未处理的正式清单。

每包数量、本次包数、规则件数均使用安全整数校验。负数、小数、NaN、无穷和溢出被拒绝；输入组件保留用户无效原文，不截断、不四舍五入。保存草稿允许缺项、失效引用或待处理配置，但非法数量/金额不能伪装为合法持久化数据，原局部输入保留可修正。

实物总数 = 每包数量 × 本次包数，计算检查安全范围。服务明确区分：

- 每包计量：1 次/包 × 3 包 = 3 次。
- 本次交付计量：本次约定 1 次，生成 3 包仍为 1 次。

期限是每份权益的说明，不参与乘法。3 份“3 个月会员”不会被改成一个账号的 9 个月。相同服务名称不合并，以条目 ID 编辑。没有伪造激活、核销或实际到期时间。界面按实物件数与服务约定条目汇总，清单和导出分别列出约定量、计量方式、本次总量与单位。

## 6. 兼容与人工条件确认

复用 `deviceResolution`、`queryDeviceAccessories`、`queryModelAccessories`，没有另写型号/PLN/排除算法。型号级、精确 PLN、明确排除、待确认、基本使用与快充均保留原语义。

普通组合包明确“未做设备适配校验”，不承诺全机型兼容。设备包默认核对配件基本使用；仅明确要求快充时校验已维护的相应能力，并继续显示其未知或有条件前提。商品名称、接口文字、标称功率或包里恰好有一根线都不会推导快充已满足。

明确不适用、型号未确认、失效来源、必要声明待确认会阻止正式交付；可先保存草稿。可配置有条件适用的包，正式交付前逐项记录按所列前提交付的说明。人工确认不会改全局声明，不把“有条件”变成无条件已核验。

确认依据包含设备及精确范围、实际组成和数量、服务/规则、当前商品摘要与相关兼容依据。换设备、替换/增减商品、数量或相关条件变化后，旧确认不能继续生效；复制清空旧确认。生成时重新读取正式包和当前数据，比较修订及预览依据，拒绝过期预览。

## 7. 报价、常用包和选配规则

整包报价为 `CNY` 整数分，`amountCents: null` 是未报价，`0` 是有效零元报价。界面最多两位小数，拒绝负数、非数字、多余小数位和溢出。总报价用整数分乘包数并检查范围；没有单品原价、虚构优惠、毛利、库存成本或税费计算。

组成/数量/服务变化后，旧报价保留为待复核参考并集中提示。正式清单预览展示完整组成、数量、条件及报价（包括未报价），要求明确勾选确认。清单保留人工报价及来源复核状态，不宣称由系统计算出了准确单品价格。

保存包可标记常用，列表及新建“常用包”优先展示。复制只产生新的局部草稿，带入商品、服务、规则、设备和参考报价，清除原 ID/编号/修订归属、创建请求、历史清单和旧确认；数组/对象深拷贝。保存才分配新身份，重新校验当前销售状态与关系。

选配规则默认关闭，关闭也可自由组包。启用后明确区分选几种 SKU、每种几件；候选不自动加入实物清单。必选组满足最少种数，可选组可不选，选择后遵守范围。每种件数按固定或允许调整的范围校验。同一 SKU 不能同时归属多个启用组，失效候选需处理。不支持嵌套权益包或任意表达式。

## 8. 清单快照、编号与幂等

保存为可用包之后，输入本次包数 → 预览 → 勾选完整组成/数量/前提/报价确认 → 生成。预览不写记录、不分配正式 ID/编号。停用包不能生成新清单，启用或生成都重验；已有清单不受停用影响。

快照结构版本为 `1`，独立冻结来源包 ID/编号/修订、名称、包数、设备摘要、实际主机、商品身份/完整规格/销售摘要、每包与本次数量、服务计量与期限、报价、能力/条件/依据、有效人工确认和生成时间。生成函数深拷贝，不持有当前包或预览数组的可变引用。

后续修改 SKU、SPU、包、规则、服务、数量、报价或声明，不回写旧清单。即使当前商品不存在，历史仍从快照显示和导出。没有清单编辑、支付、出库或激活写入入口。

BPK/BDL 使用独立空间，检查已有及导入编号/ID，固定时钟下也避让冲突，不消耗 PLN/MAT 编号。新包保存请求及清单生成请求有幂等回执；同请求重复提交返回原结果。失败保留原请求，重试不增重复记录。打印、导出及其失败不会生成清单；再次生成须明确发起新操作。

## 9. 持久化、导入与引用保护

所有维护命令再次检查现有管理员权限。候选副本上校验和计算，序列化与真实 `localStorage.setItem` 成功后才更新内存权益包数组；与既有 deep watch 协调避免二次写入。保存、收藏、停用/启用、生成均检查修订，修订溢出拒绝。失败保持原内存/磁盘，草稿、预览和同值重试可用。

旧数据缺少两个集合时按空集合查询，不强制灌入字段或新种子，不需要升级版本。整库 JSON 导入/导出覆盖规则、服务、确认与清单。导入校验身份、数量、金额、计量、日期、重复行/请求、快照总量和摘要一致性；允许保留悬空当前配置及其可读信息，历史校验不依赖 live SKU。坏新字段进入既有数据恢复界面，原字节保留，不用 seed 替换。

当前包引用的商品、适配设备、候选 SKU 及必要型号/类型/规划接入删除保护，提示相关包名/编号及“权益包管理”处理路径。仅被历史快照引用的对象不被当作当前配置引用永久锁死，删除后快照内容仍完整。

新权益包路由没有旧演示“当前模块”的对应重置定义，已隐藏该入口，避免其落入默认系统重置分支。其余页面原重置流程保持；新页面仍可使用原整库导入/导出及明确确认的全部演示数据重置。

## 10. 页面路径与状态保持

| 路径/入口 | 操作 |
| --- | --- |
| `/benefit-packages` | 配置与交付清单页签，搜索、状态、常用、复制、启停 |
| `/benefit-packages/new` | 无设备自由组包；同屏候选与清单、服务、报价、可选高级规则 |
| `/benefit-packages/new?device=SKU_ID` | 带入明确设备上下文，初始实物为空 |
| `/benefit-packages/new?copy=PACKAGE_ID` | 深复制到新草稿，不提前落库 |
| `/benefit-packages/:id` | 查看/编辑、保存、启停、按包数预览生成及历史清单 |
| `/benefit-packages/deliveries/:id` | 刷新直达冻结清单，打印/Excel均读该快照 |
| 手机 SKU 行“更多”→“组权益包” | 带入该行设备，不读取 selectedIds 作为设备 |
| 适用配件抽屉→“组权益包” | 带入当前实际查看设备，可与原勾选分离 |

`returnTo` 保留站内返回路径。SKU 页仅为组包跳转记录一个内存返回点：实际视图、临时 SPU 搜索/分页、勾选、折叠及滚动/焦点；返回对应路径消费后释放，下次入口覆盖旧点，不写 localStorage，也不复制商品数据。不使用 KeepAlive，不保留离开页面的计时器或监听。已有全局勾选重置语义未顺带改写。

未保存离开采用原路由提示模式，提供继续编辑、保存草稿并离开、明确放弃；保存失败留在原处。beforeunload 监听随页面卸载清理。路由上下文初始化关闭旧临时弹窗与预览，避免新对象残留旧选择。只读角色仅查看既有包及允许的打印导出，store 不接受其写入。

## 11. 打印与 Excel

清单页 `window.print` 使用 A4 打印 CSS，隐藏后台导航/顶栏/编辑按钮，显示完整商品、服务、期限、适配和条件；表头可重复，行和依据段避免不必要断页，文本允许换行。样式限定清单页，没有改变其它页面打印。

Excel 使用已有 xlsx，四个 sheet：清单概览、商品明细、服务权益、条件及确认说明。全部来自同一已确认快照，包含每包/本次数量、服务单位/计量、未报价/零报价、依据和有效确认。金额用精确分值格式化为字符串，不引入浮点重新计算。用户文本显式写成字符串单元格，不带公式字段；真实文件读回检查包含 `=1+1`、`@SUM` 等内容仍为纯文本。

文件名包含包编号和清单编号，处理 Windows 禁用字符/控制字符及尾部空格点。下载失败在详情页提示并允许只重试导出，清单已经保存，重复导出不新增数据。

## 12. 修改文件与职责

| 文件 | 职责 |
| --- | --- |
| `domain/benefitPackageTypes.ts`、`types.ts` | 配置/条目/规则/报价/确认/快照类型及 AppData 可选字段 |
| `domain/benefitPackages.ts` | 纯候选、真实 SKU 适配、数量/报价/规则校验、复制、条件依据、预览/冻结、导入校验和引用保护 |
| `domain/benefitPackageExport.ts` | 只读快照 → workbook、纯文本防护及安全文件名/下载 |
| `stores/catalog.ts` | 权限、修订、编号/请求幂等、存储先行命令、导入/加载/删除保护 |
| `BenefitPackageListView.vue` | 包/清单列表、常用/复制/状态入口 |
| `BenefitPackageEditView.vue`、`useBenefitPackageEditor.ts` | 同屏组包展示、局部草稿、流程与路由提示协调 |
| `BenefitDeliveryView.vue`、`BenefitDeliverySheet.vue` | 只读历史/预览展示、打印和导出；主机从冻结 hostSkuIds 读取 |
| `BenefitServiceDialog.vue`、`BenefitRuleEditor.vue`、`BenefitIntegerInput.vue` | 局部服务、规则编辑与保留无效原文的整数控件 |
| `benefitPackagePresentation.ts`、`skuReturnState.ts` | 纯文案/整数金额及单次 SKU 返回状态 |
| `SkuWorkbenchView.vue`、`AccessoryCompatibilityDrawer.vue` | 最小入站按钮与明确设备上下文；保留原查询与批量勾选 |
| `router/index.ts`、`menuConfig.ts`、`AdminLayout.vue` | 新菜单/权限映射、刷新路由、编辑实例键、导航高亮和新页面重置保护 |
| `StoredDataRecovery.vue` | 新可选集合结构校验，复用既有恢复流程 |
| `scripts/benefit-package-*.ts`、`browser-benefit-packages.mjs` | 独立夹具、领域/真实状态/Excel/浏览器专项 |
| `package.json`、`README.md`、`.gitignore`、本报告/证据 | 统一入口、使用说明和本轮产物隔离 |

上表 `domain/`、`stores/`、组件和页面均位于 `src/` 对应目录。未把领域判断放进模板，也未重新拆商品表格或核心画布。

## 13. 实际环境、基线与最终命令

Windows，Node `v22.18.0`、npm `10.9.3`，本轮实际 Chrome `156.0.8078.47`（历史报告的 155 不是本轮环境）。使用项目已有依赖、独立 headless 浏览器上下文，固定测试时间与明确“独立测试”商品，未读取或清空用户日常浏览器数据。ID/来源/关联/数组顺序保留参与比较。

原 HEAD 快照实际执行：`node work/benefit-package/baseline-checks.mjs`，原兼容查询/状态、SPU/SKU、SKU 查询/状态、分组/迁移/恢复检查均通过，日志 `before-checks.log`。输出变量在第一次执行前就全部隔离。

| 最终实际命令 | 结果/证据（均为本轮执行） |
| --- | --- |
| `npm run check:benefit-packages` | 30 组领域、12 组真实状态、7 组 Excel、18 个 Chrome 验收点通过；`final-benefit.log`、`domain/result.json`、`state/result.json`、`export/result.json`、`browser-final/result.json` |
| `npm run typecheck` | 最终源码通过，`typecheck.log` |
| `npm run build` | 最终源码通过，`build.log`，保留既有大包提示 |
| 新四份 TS 专项 `tsc --strict --noUnusedLocals` | 通过，完整命令见机器证据，`check-types.log` |
| `node scripts/run-domain-check.mjs scripts/accessory-compatibility-query-check.ts` / `accessory-compatibility-state-check.ts` | 原查询 19、状态 11 组通过；`regression/` 对应日志 |
| 原 `compatibility-check.ts` / `excel-import-check.ts` | 15/20 项通过，真实工作簿正式导入 583、重复识别 583；同目录日志 |
| 原 `sku-workbench-query-check.ts` / `sku-workbench-state-check.ts` | 23/6 组通过；同目录日志 |
| `npm run check:frontend` | 原 11 个入口通过，涵盖规划、草稿、物料、V2/一致性、布局、列表、导航等；`regression/frontend.log` |
| `npm run check:spu-sku` | 19 组领域、12 个 Chrome 检查点通过；`regression/spu-sku-final.log`、`spu-sku-final/result.json` |
| `node scripts/browser-sku-workbench.mjs` | 24 个 Chrome 检查点通过；`regression/sku-workbench/result.json` |
| `npm run check:sku-views:fixes` | 原三项领域修复及 7 个 Chrome 检查点通过；`regression/sku-views-fixes.log`、`sku-fixes/browser/result.json` |
| `node scripts/browser-accessory-compatibility.mjs` | 原兼容 Chrome 16 点通过；`regression/accessory-browser/result.json` |
| `npm run check:integration -- --business-only` | 核心集成 13 点通过，预览、发布/PLN、多 MAT、历史、焦点/快捷键等；`regression/integration/result.json`。未执行列表扩展分支 4a–4e，不将其标为本次通过 |
| `node --check scripts/browser-benefit-packages.mjs`、`git diff --check`、新文件 no-index 空白检查 | 通过；`final-review.json` |
| 历史产物/冻结范围审计及补丁回放 | 通过；`historical-artifacts-final.json`、`scope-audit.json`、`patch-replay.json` |

原回归逐命令 exit code、时间、环境变量与日志 SHA256 保存在 `regression/commands-result.json`、`regression/result.json`，没有依赖旧报告中的通过记录。真实工作簿为 `D:\单子\商城erp\前期包\2.0 数据\1.1 手机 Apple.xlsx`，本轮实际存在并读取。

复现新专项：

```powershell
npm run check:benefit-packages
npm run typecheck
npm run build
git diff --check
```

新脚本无个人绝对路径；可配置 `BENEFIT_DOMAIN_OUTPUT_DIR`、`BENEFIT_STATE_OUTPUT_DIR`、`BENEFIT_EXPORT_OUTPUT`、`BENEFIT_BROWSER_OUTPUT`。浏览器默认安装的 Chrome，`BROWSER_CHANNEL=msedge` 可选择已安装 Edge；缺运行时明确报错，不静默跳过。旧回归所有输出变量设到 `work/benefit-package/regression/`，完整执行器 `run-final-regressions.mjs` 和汇总保留在本轮目录。

## 14. 针对性覆盖与失败验证

`coverage-map.json` 对应用户第十七节 34 项，逐项关联具体领域/状态/导出 case。映射编写时浏览器标为未核实，最终浏览器结果以 `browser-final/result.json` 的真实通过点为准，不把映射当作运行结果。

浏览器实际走通三个入口、设备不自动入包、手机显式加/删/切换、同 SKU 合并、无效数量原文、两种服务、零元与未报价、常用深复制、规则候选与实际选择、跨组冲突、条件确认和失效、快充前提、源 SKU 真编辑、历史保持、只读角色、未保存继续/保存草稿/放弃、第二页勾选及横向滚动/焦点返回。

故障注入拦截真实下一次 `localStorage.setItem` 抛 `QuotaExceededError`，比较原内存和原始存储字节，恢复后按同一值/请求重试并刷新；覆盖保存、收藏/状态、生成、导入。正式确认重算后拒绝过期修订/依据。真实 Excel 下载两次读回检查数量、计量与无公式；导出故障仅重试下载，不再生成记录。

清单冻结用例同时修改源包名称、goods/services/groups/rulesEnabled/quote、商品/公共属性/关系及预览对象，然后比较旧快照完整内容；规则变化也有明确动作，不仅凭深拷贝代码推断。

## 15. 视觉、打印与截图

主验收 Chrome，明亮 1366×768、较宽 1600×1000、深色 1366×768、780×900 窄窗口及等效 125%（1093×614 CSS 视口、DPR 1.25）。实际检查无整页横向溢出、保存按钮可达、弹窗 Esc 和返回焦点。截图实际审阅了宽屏、深色、窄屏、等效缩放及打印样式，沿用现有主题、字体、图标和 Element Plus。

`browser-final/` 保存编辑器/列表各视口、存储失败、生成失败、规则、正式清单和打印样式截图。文件名与 SHA256 见机器证据。没有使用旧轮截图冒充本轮执行。

打印验证范围：记录真实按钮对 `window.print` 的调用，模拟其返回/取消；以 print media 实际检查后台导航/顶栏隐藏且清单仍可见，截图为 `delivery-print-style.png`。没有自动操作原生 Windows 打印对话框，也未实际发送纸张到打印机，不将模拟返回描述为已人工点击系统取消。

## 16. 本轮发现并修正的具体问题

- 自由包直接加入手机时，原显式开关标记不能表示所有实际主机：增加冻结 `hostSkuIds`，页面/Excel同步修正，领域/导出/浏览器均新增反例验证。
- 原 SPU/SKU 浏览器检查复现新行“更多”与旧全局“更多”的可访问名冲突：只给新增行菜单独立 aria-label，旧断言保留并通过重跑。初始失败与最终通过证据分开在 `regression/spu-sku-before-accessible-label.log`、`spu-sku-final.log`。
- 新路由落入演示当前模块的系统默认分支：新页面不提供该错误重置入口，Chrome新增检查，未改变原页面重置语义。
- 收紧导入的重复行/请求、商品摘要身份矛盾、主机子集、日期/确认结构；增加修订溢出、失效类型及历史独立保护。
- 路由初始化清理局部弹窗、预览和检索，返回滚动的 animation frame 在卸载时取消。

开发期还修正了测试辅助对原生隐藏 switch 的点击、选择器转发、以及在下拉收起时发 Esc 误关闭新业务弹窗的问题。保留开发期失败日志；未通过 force 点击、删除业务断言或修改旧期望来迁就实现。最终源码稳定后统一入口、类型与构建已实际重新执行。

## 17. 冻结区域与历史保护

`scope-audit.json` 对所有非授权修改的已跟踪源码/脚本及旧 docs 比较 Git 内容，具体数量与哈希保存在该证据。重点包括 ProductModelSelector、generateSkuFromModel、planning/draftComboPreview/material/spuSku/catalogIdentity、节点配置、旧兼容解析/判定/命令、画布布局与焦点/撤销、SKU 查询/状态及前三项修复。未修改 package-lock 或任何依赖版本。

历史忽略目录测试产物在运行新/旧检查前记录哈希，最终 **495 份全部保持原始字节**。本轮没有覆盖此前忽略目录的旧测试结果。源码 Git 内容比较按仓库换行规则进行，合法 Windows CRLF 不被误称为内容回归；新文件空白检查同样识别 CRLF，仍检查真正的行尾空格/尾部空行。

完整补丁包含新文件；在真实基线快照的独立目录实际应用，并与当前改动文件逐一比较规范化换行后的内容，结果保存在 `patch-replay.json`。没有暂存用户工作区来生成补丁。

## 18. 未验证项、既有问题及限制

- 未执行真实 Edge、WebKit、macOS Safari、实体触控板或全设备矩阵；可配置通道不代表已实际运行。
- 未修改真实 Windows 系统缩放，使用上述等效视口/DPR；原生打印对话框/物理打印机未自动操作。
- 没有在用户日常 localStorage 上恢复数据，使用隔离上下文验证迁移、坏数据、失败与重试。真实导入/整库恢复仍遵循当前 Mock 原有语义。
- 不验证真实配件电气/快充性能，未知协议、线缆及仅文本前提仍需人工明确确认。
- 核心集成出现原 Vue Flow options 弃用提示两次；本轮新专项及其它浏览器 diagnostics 为空。原生产大于 500 kB chunk 提示保留，不为消提示改加载或依赖。
- 旧 SKU 页视图/结果切换会重置勾选的问题仍按原边界保留；本轮只恢复组包往返的单次上下文。既有 ResizeObserver 提示未在本轮新专项复现，未屏蔽。
- 没有跨标签页实时协作和后端并发版本锁；本轮检查同一 store 的修订/预览过期及真实本机持久化边界。

当前没有已知阻断本轮闭环的遗留问题。以后接订单、库存或履约时，应引用已确认清单及稳定 SKU 身份，单独设计扣减、服务履约和事务；本轮清单不提前声称完成这些动作。达到收口标准后停止扩展，交由用户审查。
