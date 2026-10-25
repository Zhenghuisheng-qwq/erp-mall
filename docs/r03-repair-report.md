# R03 补修报告

RESULT: READY（仅本次三项补修，等待审查；不代表整个 ERP 或集中业务验收完成）。

## 基线与范围

- 工程：`D:\单子\商城erp\mock\iyge-v2-mock`。
- 分支 `20261022`，实际 HEAD 为 `aee52b4153084fee91daa948f8e043fc96dbd5b8`，与审查基线一致。
- 开始时工作区干净；工程及祖先目录、src/scripts 子目录未发现适用 AGENTS.md。
- 未提交、推送或部署。冻结 V2、编号算法、历史清单和价格来源语义保持。

## 修改文件与修复证据

1. `src/stores/catalog.ts`、`src/domain/benefitFrameworks.ts`：商品模块重置在写入前比较框架实例成员和 SKU 主机引用，若重置会移除引用或改变所属主体/类型，则返回包名、成员名称及 SKU ID，内存与原始存储均不变。全量重置和旧自由包重置沿原流程。
   - 导入/启动只对缺失 SKU 或商品主体放行引用恢复；原成员条目、名称快照、数量、参考价及框架修订不变。真实存在的组外 SKU 和 MAT 身份仍拒绝；框架容器及冻结修订校验没有跳过。
   - `src/domain/accessoryCompatibilityCommands.ts` 同步区分“缺少商品主体”与“SKU/MAT 身份冲突”，否则缺主体备份仍会被既有声明校验拦截。显式物料证据仍优先，未修改任何声明内容。
   - Store 回归覆盖缺 SKU、缺主体两种备份恢复和真实 Store 重开；页面显示引用失效，可移除失效成员并保存草稿。可用包保存及新交付拒绝，历史清单及工作簿内容逐字比较不变。
2. `src/components/benefit-package/useBenefitPackageEditor.ts`：具体成员标识优先于组标识，打开包内清单并展开成员；数量问题聚焦数量输入。组级问题仍定位框架/规则。原条件确认、报价、设备及名称定位逻辑保留。
   - 独立 Chrome 900px 窄屏：冻结规则要求 2 件，输入改成 1，切回选商品并收起，点击件数问题后数量输入可见且获得焦点，值仍为 1。
3. `useBenefitPackageEditor.ts`、`benefitFrameworks.ts`、`src/views/BenefitPackageEditView.vue`：复用领域解析已有正式基本适用 ID 集合；推荐页签取其与框架允许候选的交集，其他商品保留框架范围。框架模式状态标签按 basic 能力显示，快充单独说明，避免将仅快充声明显示为正常基本适用。
   - 回归覆盖适用、待确认、不适用、无 SKU 声明、仅快充证据、范围外商品；推荐/其他页签结果不同。搜索、类型筛选有效，新兼容 SKU 动态进入候选。显式主机包含和最终保存/清单校验未改。

新增 `scripts/r03-repair-check.ts`（真实 Store 断言）及 `scripts/browser-r03-repair.mjs`（真实页面断言）。

## 实际验证

- 新增 Store 检查：5 组通过，含重置拒绝原子性、两类失效引用恢复重开、组外 SKU/MAT 拒绝、推荐范围、动态兼容 SKU、历史导出、自由包与全量重置。
- 复跑 10 个脚本全部退出 0：r03-framework、benefit-package-domain、benefit-package-state、benefit-package-export、benefit-package-refinement、compatibility-benefit-storage、accessory-compatibility-query、accessory-compatibility-state、catalog-async-save、r02-repair。最终身份保护补强后再次通过 R03 框架检查。
- `npm run build` 通过（包含 vue-tsc 类型检查及生产构建），最终日志 `work/r03-repair-20261025/build-final.log`。
- 独立隔离 Chrome `156.0.8078.47` 四组真实页面验证通过，页面异常 0：模块重置拒绝及存储原文不变；窄屏成员数量定位；候选页签/搜索/类型筛选；失效引用可修正且草稿实际落盘、新交付被禁用。
- `git diff --check` 通过。

证据目录：`work/r03-repair-20261025/`。`domain/checks.json` 为新增断言，`regression/results.json` 为复跑结果，`browser/evidence.json` 为最终浏览器结果，四张 PNG 记录实际页面。domain 内备份均为测试夹具，不是用户数据。浏览器目录的 failure.json/png 留存首次沙箱 localhost 网络阻断记录；批准隔离本机浏览器执行后，两次完整验证通过，以 evidence.json 为最终结果。

## 剩余限制

- 已失效的引用不会自动替换或删除；用户须修正后才能保存为可用包或生成新清单。真正损坏的框架容器/冻结依据仍走既有恢复流程。
- 生产构建仍提示部分 chunk 超过 500 kB；本轮未扩大到构建拆包优化。
- 本轮止于补修，未执行集中业务验收，未进入后续功能轮次。
