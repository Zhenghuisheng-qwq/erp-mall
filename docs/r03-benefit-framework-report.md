# R03：权益包类型框架、动态选配、成员折叠与参考价格

RESULT：READY（仅针对 R03）

日期：2026-10-25。分支 `20261022`，开工 HEAD 为已审查基线 `f49a720c56cf9df52b5648f87c0bf68693b99601`。工作区开工时干净，未发现适用的祖先或相关目录 AGENTS.md。没有提交、推送、部署或进入下一轮。

## 实现与真实调用链

### 框架、实例、交付快照分别保存

新增可选集合 `AppData.benefitFrameworks`。框架保存稳定 ID、名称、状态、修订号、时间、原创建请求和修订历史。规则以真实产品类型 ID 定义范围，包含兼容过滤、必选／可选、种数、默认件数及可调整范围；不要求选择 SKU，不保存商品或服务成员，不受当前候选数量限制。

权益包模块新增“选配框架”页签，可新建、复制、修改、停用和删除未引用框架。框架编辑有未保存离开保护、失败保留输入及修订冲突提示。已引用框架不能删除；未引用框架逻辑删除后保留创建回执，旧请求不能重新建回它。当前框架及实例／历史快照引用的产品类型有删除保护。

实际包的 `framework` 保存框架 ID、revision、名称和规则快照，`goods/services` 保存本次实际成员。使用框架只应用规则，保留当前主机、已选成员和人工价格，不复制其他包；切换、升级或解除前展示影响，清除旧条件确认并要求重新校验。停用框架不能给新实例使用，已引用包继续使用冻结规则。原常用包复制仍为复制具体组成，入口与框架不同。

框架路径为 `BenefitFrameworkManager → store.saveBenefitFramework → frameworkCommand → commitBenefitState → catalogPersistence`。没有额外 LocalStorage 业务键；复用 Store command、队列／锁及原 revision 机制。JSON 导入、normalizeStored、replaceAll、模块重置、运营命令和导入只读检查均包含新集合及扩展字段。

### 动态范围与兼容

`resolveBenefitRange` 为统一解析入口，供候选展示、加入、替换、默认数量和 `frameworkSelectionIssues` 使用。`validateBenefitPackage → previewBenefitDelivery → store.generateBenefitDelivery` 再次执行相同校验。

候选由真实类型、在售销售 SKU 和本次主机正式兼容结果动态取得。复用 `benefitSkuSummary/isRealSku` 及既有 `queryDeviceAccessories/queryModelAccessories`，不把 MAT 的声明自动映射给销售 SKU。待确认、不适用、停售、失效引用不能冒充正常候选；精确规划及有条件适用沿原查询／确认机制。候选为空时区分缺主机、无在售销售 SKU、无正式适用结论，并提供维护入口。

类型组重叠明确报错，不默认选择第一组；同 SKU 不重复归组。框架包的“其他商品”、替换、直接 Store 可用包保存和已知范围的 JSON 可用包导入不能绕过组范围。显式包含的主机独立于配件组校验。普通无框架包和旧白名单不增加全包类型限制。

本轮没有生成主机容量／颜色与配件的组合 SPU、SKU、PLN 或 MAT；测试中的新增 SKU 是隔离测试主动维护的商品，用于验证动态查询。

### 人工参考价格

商品、服务增加可选 `referencePrice`，保存整数分／null、`source: manual`、输入时间及输入原文。参考价格属于本包，不写全局售价，不从整包报价倒推，也不再加收进整包报价。

`benefitPricing.ts` 计算每包商品和按包服务已知合计、按次服务本次金额、本次已知参考合计、缺价项数、完整性和人工参考差额。null／缺字段为未记录，0 为明确免费；缺价不虚构零元或优惠。完整时差额＝人工参考合计－本次整包报价，可以为负数。per-delivery 服务按本次数量计算一次，不乘包数。

十进制价格解析使用精确整数分并检查安全范围；数量、乘法、累加、报价总额均检查安全整数。非法输入保留在编辑器并提示，Store 不保存 NaN、负数、超精度或溢出金额。替换 SKU 不沿用原商品参考价格。成员、参考单价、数量、服务计量或框架变化会使报价复核和旧预览失效，原整包报价保留。

### 折叠、快照和导出

编辑页和交付页均有包标题附近的整体成员开关。收起后仍保留包名、主机及包含状态、数量／服务摘要、整包报价、参考合计完整性、适配问题与复核提示。使用界面状态及 `v-show`，不销毁输入；定位成员错误会展开并滚动定位。

新清单冻结框架规则、参考单价及来源、行金额和合计；展示与 Excel 只读取保存的快照。旧清单没有这些字段时显示未记录，不回查当前框架或价格，不补造 0。打印样式强制展开全部成员，Excel 与折叠状态无关，继续使用原文本单元格保护和安全文件名。

合法未知范围保留原文，受影响的新执行阻止；损坏数组、记录、价格、引用快照和冻结金额在导入提交前拒绝。框架历史和实例规则按规范化对象字段比较，避免 JSON 对象键顺序误判。原始存储损坏仍由现有恢复机制处理。

## 修改文件

新增：

- `src/domain/benefitFrameworks.ts`、`benefitPricing.ts`。
- `src/components/benefit-package/BenefitFrameworkManager.vue`、`BenefitReferenceInput.vue`、`BenefitReferenceSummary.vue`。
- `scripts/r03-framework-check.ts`、`scripts/browser-r03.mjs`。

调整：

- `src/domain/benefitPackageTypes.ts`、`benefitPackages.ts`、`benefitPackageExport.ts`、`types.ts`。
- `src/stores/catalog.ts`、`src/layouts/AdminLayout.vue`。
- `src/components/benefit-package/useBenefitPackageEditor.ts`、`BenefitRuleEditor.vue`、`BenefitServiceDialog.vue`、`BenefitDeliverySheet.vue`。
- `src/views/BenefitPackageEditView.vue`、`BenefitPackageListView.vue`。
- `scripts/catalog-async-save-check.ts` 仅增加可选输出目录环境变量，便于独立保留本轮证据。

## 实际验收

证据目录：[work/r03-20261025](../work/r03-20261025/)。

| 检查 | 结果／证据 |
| --- | --- |
| R03 领域与真实 Store | 9 组断言通过：[checks.json](../work/r03-20261025/domain/checks.json)、[domain-final.log](../work/r03-20261025/domain-final.log) |
| 独立隔离 Chrome | 5 组完整场景通过，page errors 为空：[evidence.json](../work/r03-20261025/browser-accepted/evidence.json) |
| 真实 Excel 下载 | [delivery.xlsx](../work/r03-20261025/browser-accepted/delivery.xlsx)，脚本读取工作簿断言框架及参考价格列 |
| 类型检查与生产构建 | `npm run build` 包含类型检查并通过：[build-final.log](../work/r03-20261025/build-final.log) |
| 冻结代码 | V2 选择器、SKU 算法、planning、catalogPersistence 与基线相同：[protected-code.json](../work/r03-20261025/protected-code.json) |

九项受影响既有回归通过：`benefit-package-domain-check`、`benefit-package-state-check`、`benefit-package-export-check`、`benefit-package-refinement-check`、`compatibility-benefit-storage-check`、`accessory-compatibility-state-check`、`accessory-compatibility-query-check`、`catalog-async-save-check`、`r02-repair-check`。日志位于 [regression](../work/r03-20261025/regression/)，有 `-final` 后缀时以该次结果为准。R02 补修 13 组真实 Store 保护断言仍通过。

用户验收项对应：

1–2：零成员、无当前商品的真实类型框架保存；maxKinds 不依赖当前候选数。

3–5：同型号不同容量／颜色主机、增加兼容在售 SKU 自动入选；停售、pending、excluded、MAT 和只有 MAT 声明的销售 SKU 分别拒绝。

6–7：统一加入／替换／默认数量／可用包及清单校验；重叠组、组外直接命令与 JSON 拒绝。

8–9：自由包、旧白名单、常用包复制旧回归通过；适配主机与显式包含实物分开，主机不误归配件组选配。

10–13：null／0、行金额、负参考差额、多包按次服务、替换清价、报价复核、超精度／NaN／负值／溢出及失败原子性。

14：真实页面折叠不丢价格输入，非法价格问题定位自动展开；窄窗口按钮边界断言；收起时打印媒体仍显示完整明细，导出含所有行。

15–16：框架修改／停用、当前包改价后，旧清单对象和工作簿不变；合法恢复保留框架、价格、来源及历史；旧记录保持未记录价格；未知合法范围原文保留。

17：运营框架／包／清单直接命令、框架及价格／历史导入拒绝；配额失败内存和磁盘不变；框架队列并发只接受一个修订；双页旧清单预览拒绝；创建／生成请求幂等，已删除框架旧请求不复活。

18：框架保存及使用不生成商品组合实体；冻结文件 Git blob 验证相同。

Chrome 版本 156.0.8078.47，独立 Context，桌面 1600×1000、窄窗口 900×760。真实页面闭环：创建框架 → 选择具体主机使用框架 → 动态选品 → 人工参考价和整包报价 → 折叠／展开 → 保存并生成 3 包清单 → 导出 → 修改框架和当前包 → 回看历史不变。新增兼容 SKU 的维护准备通过隔离页面中的真实 Store JSON 导入完成，随后不修改框架即验证候选出现；没有把这一步称为完整 SKU 新建页面验收。

初次浏览器受沙箱 localhost 网络限制，随后以获准的隔离 Chrome 执行完成。早期下拉列表动画定位失败记录保留，最终验收以 `browser-accepted` 为准。生产构建仍有大于 500 kB 的分包警告，没有宣称零警告。

复现：`node scripts/run-domain-check.mjs scripts/r03-framework-check.ts`；`node scripts/browser-r03.mjs`。输出可由 `R03_OUTPUT`、`R03_BROWSER_OUTPUT` 指定独立目录。

## 边界及停止点

本轮仅提供产品类型组及明确兼容过滤，没有脚本规则／复杂 DSL。类型重叠要求人工修正，不支持自动优先级选组。未知范围可恢复查看，不能按已支持规则执行。

价格仅为本次人工参考来源；不提供全局销售价、自动优惠定价或价格同步。完整订单、支付、库存扣减、出库、物流、权益核销及后端事务均未实施。浏览器验收限于上述 Chrome 场景，不代表跨浏览器或整个 ERP 已完成。

R03 到此停止，等待代码审查后再进入集中业务验收。
