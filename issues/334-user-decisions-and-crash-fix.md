# 334 · 用户拍板批次：B站去保存、已存置灰、保留清侧写、单源化 + 锚定链接崩溃修复

- 状态：已实现（2026-09-16，用户逐项拍板；ADR-0147）
- 关联：ADR-0147 / issue 329（评审跟进）/ issue 333（评审批）/ review-329-final.md（8 项记档的拍板结果）

## 用户拍板

- **4（B站动线不一致）→ 去掉保存**：视频相关文章直接去掉「保存至剪藏」按钮和功能（不是对齐前进动线）
- **3（读盘失败负缓存）→ 不采纳**
- **1/2/5/6 → 按建议修**；7/8 → 维持现状

## 已修

| 项 | 修复 |
|---|---|
| 崩溃（用户实测） | 锚定双链点击拦截改**捕获阶段 + stopPropagation**——此前只 preventDefault 挡不住 Obsidian 自己的 internal-link 监听，预览与原生导航同时发生，移动端相争崩溃。桌面右栏/移动详情两处容器监听均改 capture |
| 1 已存置灰 | 移动保存钮对已存条目加 disabled（opacity+pointer-events none）+ 点击守卫——重复保存不再冲掉划词标记/重复下载图片；桌面菜单本就无该项 |
| 2 保留策略清侧写 | 装载器清理超期条目时同步 `clearArticleTracking`（侧写三段不残留） |
| 4 B站去保存 | 菜单不下发动作、移动钮隐藏、flowSave 静默守卫；知识盒影像入口不受影响 |
| 5 通知文案 | 「已本地化 N 张图片（复用 M 张）」——复用张数单列 |
| 6 单源化 | clipbook `knowledgeDir()` 改走 `core/knowledge-boxes`（ADR-0141 单源），删手写归一 |

## 测试面

- `adr0147-bili-no-save.test.ts`（4 例）：B站菜单无保存动作、移动钮隐藏、已存置灰点击无效、捕获拦截掐断 document 级委托导航
- `retention-sidecar.test.ts`：超期清理 → 侧写 marks/pendingSource 随之清除
- flow.test 两例改写（B站无操作 / F3 升级改果壳种子）；review-fix-clip2-ui2 C11 种子同改
- 主仓库全量 329 文件 5212 用例全绿；tsc 零错误
