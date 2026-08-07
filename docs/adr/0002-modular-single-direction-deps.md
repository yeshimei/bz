# 0002 — 模块化单向依赖 + 回调解耦（为脚本批量迁移预留）

原 QuickAdd 脚本是单文件 4146 行，store 与 UI 函数互相内联调用。插件版按"共享层 + 功能域"拆分：`core/`（escManager/confirm/utils，自 Q3 移植）供所有未来迁移的脚本复用；每个脚本一个功能域目录（`diary/` 为首个）。依赖方向固定单向：`core ← config/state ← parser ← store ← ui ← main`。store 层无 DOM 依赖，UI 刷新通过回调注册（`onFullRefresh`/`onLightRefresh`/`onProgress`/`onLoadingChange`）由 ui 层订阅。ui 内部允许函数级引用环（entries ↔ filter-shared 等），约定：环内引用必须全部发生在函数体内（延迟解析），禁止模块顶层求值期互相访问。

## Considered Options

- 保留单文件（一个插件一个 4000 行 JS）→ 无法复用共享层，迁移 20+ 脚本后不可维护
- 每脚本独立插件（互不共享）→ escManager/confirm 等重复实现
- 本方案：共享 core + 功能域 + 单向依赖

## Consequences

后续迁移脚本（收藏本/影视/备忘录等）只需：新增功能域目录 → 复用 core → 在 main.ts 装配 → 命令 id 沿用原脚本。测试 seam 稳定：纯函数层（parser/config）+ UI 层（jsdom）均可独立测试。
