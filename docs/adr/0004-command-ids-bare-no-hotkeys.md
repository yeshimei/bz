# 0004 — 命令 id 裸注册延续；插件内部不绑定默认快捷键

日记本迁移确立的约定（ADR-0001：裸 id 保留用户热键）延续到 memo-suite：所有迁移命令沿用原脚本命令 id，通过 `app.commands.addCommand` 裸注册（卸载时清理）。**不设置默认 hotkeys**——用户明确要求「插件内部不绑定任何快捷键」，需要热键的用户自行在 Obsidian 设置中绑定。

## Context

- 脚本间互调依赖固定 id：影视.js 通过 `app.commands.executeCommandById('movie-analysis-open')` 调用影视数据分析——id 必须与 QuickAdd 时代一致，否则互调断裂
- 用户 Alt+A 等热键在 QuickAdd 宏命令上绑定；迁移后命令 id 相同，用户重绑成本最低
- 用户决策：插件不主动注册快捷键（避免与用户既有热键冲突）

## Decision

- 全部迁移命令裸注册原 id；`executeCommandById` 互调不变
- `addCommand` 不传 `hotkeys`，不声明默认快捷键
- 卸载时 `removeCommand` 清理全部裸注册命令

## Considered Options

- 标准 `plugin.addCommand`（自动加前缀）→ 互调 id 断裂，需全量改写调用链
- 裸 id + 默认快捷键 → 违背用户「不绑定快捷键」要求

## Consequences

- 用户需要在 Obsidian 设置 → 快捷键 中重新绑定（原 QuickAdd 热键不自动迁移——Obsidian 层面热键绑定在命令 id 上，插件命令与 QuickAdd 宏命令是不同命令，热键记录不通用；这是已知成本）
- 裸 id 全局唯一，与第三方插件冲突风险由单插件内 id 命名规范（沿用原脚本 id）控制
