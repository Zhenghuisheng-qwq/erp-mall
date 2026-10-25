# RBAC 管理页面实现与实际浏览器记录

实现文件：MenuConfigView.vue、RoleView.vue、PermissionView.vue、UserView.vue，以及 src/components/rbac/admin.css、presentation.ts、useRbacDraftGuard.ts。

三个系统页面独立；菜单使用树表和编辑抽屉，角色使用列表/编辑抽屉与独立授权树，权限目录只维护已接入权限的允许元数据。用户使用多个角色并受控保存。没有直接 v-model 修改原始用户或授权记录。状态、入口及动作按 store.can 及时禁用；模拟其他用户按钮仅超级管理员可用。

授权树支持搜索模块/资源/权限码、展开/收起、半选、仅看已选、显式依赖提示、已选计数、保存前新增/撤销/受影响用户数。分组只是当前叶子批量选择，存储为明确权限码数组。不能委派的权限预先禁用；真实 Store 仍执行最终判断。

所有编辑取消和路由离开均有草稿保护；但当前页面访问权限已失效时，不允许未保存提示阻断全局跳转无权限页。

实际执行：`node scripts/browser-rbac-pages.mjs`，Chrome 156.0.8078.47，最终 10 组通过，pageerror=[]。

1. 真实新增角色，并通过树显式授权 SPU read/update，保存后精确为两项。
2. 授权树资源半选、搜索、仅看已选精确两叶子；取消未保存授权不写入。
3. 用户通过页面创建并绑定 custom + operator 两个角色，roleIds 精确两项。
4. 菜单编辑取消和保存均通过，角色授权保持不变。
5. 权限名称元数据可保存；引用中的权限停用被拒，草稿与磁盘保留。
6. 写盘失败时角色草稿保留、原始磁盘不变，重试成功。
7. 900 暗色三个页面和授权抽屉截图，抽屉矩形完整落在视口内，按钮可见。
8. 角色复制保留原显式权限；启停、未引用角色删除可操作；被用户引用角色删除明确拒绝。
9. 菜单真实新增中心/分组、改挂两个正式页面、同级排序、隐藏及恢复默认结构，角色授权不变；隐藏后直接访问权限仍在。
10. 在真实角色编辑抽屉保留未保存内容，通过受控权限预览变更模拟访问权限失效：实际进入 /forbidden，不被草稿守卫拦住，原始数据和磁盘不变。

截图：menus.png、roles.png、permissions.png、role-grants.png、users.png、permission-referenced-rejected.png；roles-narrow-dark.png、grant-narrow-dark.png、menus-narrow-dark.png、permissions-narrow-dark.png、revoked-access-draft-left.png。

结果 result.json；原开发日志在 work/rbac-pages-browser.log，保留一条 ResizeObserver loop completed with undelivered notifications. 通知，没有屏蔽。未额外执行 Safari/Firefox 或实体触屏验证。

首次脚本点中了 Element Plus 自身隐藏 input，后改为自然可点击容器；没有 force 点击或删权限断言。菜单树视觉核查修复名称 flex 容器与内建树缩进分行的问题。截图等待抽屉动画结束并断言矩形，避免把动画中间帧误报为窄屏布局缺陷。
