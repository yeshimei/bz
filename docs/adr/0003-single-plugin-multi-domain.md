# 0003 — 单插件多域架构（bz）

将剩余 15 个 QuickAdd 脚本（备忘录、归物本、剪藏本、聚合讯、密码本、收藏本、书库、阅读数据分析报告、影视、影视数据分析、自动摘要、AI Agent、复习计划、做题家、闪念）合并为**一个插件** `bz`（显示名「备忘录」）。B站下载排除在外，后续独立插件。

## Context

用户决策（grilling 2026-xx）：Q3「写成一个插件」。15 个脚本共享同一个底座 `window.__utils`（Q3.js，21 个导出），若拆成 15 个插件，共享层要么复制 15 份要么做成 npm 包；且脚本间存在命令互调（影视.js → `movie-analysis-open`）与全局状态共享（`window.__MOVIE_FOLDER_PATH`）。

## Decision

- 一个插件 `bz` 包含全部域；`src/core/` 完整移植 Q3/__utils（21 个工具 + jsonStore + AIService + changelog + 样式注入），**内部模块，不再挂 `window`**
- 域间共享状态改为显式 import（如影视数据分析需要 `movieFolderPath` 时从影视域模块导入，不依赖 `window.__MOVIE_FOLDER_PATH`）
- 脚本间的 `executeCommandById` 互调保留（命令 id 裸注册，见 ADR-0004）
- 主 ribbon 一个入口（打开「备忘录」待办面板）；其余域通过命令 + 设置开关进入
- 外部进程能力可用：Obsidian 桌面端为 Electron，`require('child_process')`/`fs` 在插件上下文可用（与 QuickAdd 脚本环境相同，B站下载已实测）；移动端不可用，相关域（如需）做能力检测

## Considered Options

- 每域独立插件 → 共享层复制 15 份或维护 npm 包，升级同步成本高；用户明确不要
- 全部迁移为一个巨型插件 → 用户已选；代价是单插件体积与 onload 开销，靠懒加载（按域按需初始化）缓解

## Consequences

- 启动开销：15 域不能全部在 onload 全量初始化——事件常驻域（自动摘要/AIAgent/闪念）按设置开关注册；UI 域懒加载（首次打开初始化，沿用日记本 init 幂等模式）
- core 是未来任何新脚本迁移（含 B站下载独立插件）的共享基础
- 命令全局 id 冲突风险集中在单插件内，便于管理
