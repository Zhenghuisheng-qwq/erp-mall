# 属性方案草稿UI与浏览器补修

修改范围仅 TemplateView.vue 与新增浏览器脚本；未编辑 catalog.ts/rbac.ts 或其他业务界面。

- 新建普通方案在本地建立 id='' 草稿，名称、结构轴及全部绑定首次确认后通过 saveTemplateScheme 原子提交。
- 普通方案复制也先打开本地完整草稿；sourceId保持复制来源，保留名称副本、enabled、parentId及完整绑定，不提前 push 原数组。
- 已有记录按真实 template/model 归属检查 update；普通新建仅 template:create。query入口保留具 read 权限的只读查看，不能绕过 update。
- 真模型复制仍走 copyProductModel，没有把模型转换为普通方案。
- 保存失败显示内联错误，try/finally恢复saving，保留名称、参数顺序、角色和必填状态以便重试。
- 开关状态也使用受控方案保存；未扩展删除、编号或生成算法。

实际执行：

1. `node scripts/browser-template-scheme-repair.mjs`：显式启用RBAC与显式默认统一模式两个独立Vite/Chrome上下文，7组检查全部通过，Chrome 156.0.8078.47，pageerror=[]。
2. `npm run typecheck`：退出0，日志 `work/template-scheme-typecheck.log`。

浏览器检查包含：

- strict create-only 新建输入和首存可用，无需update；既有编辑禁用。
- 新建与普通复制取消，完整Store和持久化原文都不变。
- 新建/复制存储故障不产生方案半副本，也不改变源绑定；表单完整保留并可重试。
- 复制的全部结构轴、common/variant角色、required、enabled、parentId保持，刷新后完整。
- strict update-only更新旧记录，不能新增或复制。
- strict模板用户不暴露真模型；统一模式全权限也不能用普通方案endpoint伪装模型副本。
- 默认统一模式可新建方案，真模型复制继续生成真实canvas归属。
- SKU及历史版本未变化。

证据目录：`work/template-scheme-repair/browser/`。
主要截图：strict-create-failure-draft.png、strict-copy-failure-preserves-all-bindings.png、strict-copy-complete-after-refresh.png、unrestricted-scheme-and-real-model-path.png。
本文件不评价主代理负责的完整Store/权限矩阵与生产构建。
