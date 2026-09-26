# 0004 — 命令 id 统一 bz- 前缀；插件内部不绑定默认快捷键

日记本迁移确立的约定（ADR-0001：裸 id 保留用户热键）曾延续到 bz：迁移命令沿用原脚本命令 id 裸注册。**2025 修订**：用户决策「把所有的 memo 改成 bz，插件目录也改成 bz」——所有命令 id 统一加 `bz-` 前缀（如 `bz-memo-open-panel`、`bz-open-library`），插件目录/插件 id 从 `memo-suite` 改为 `bz`。**不设置默认 hotkeys**——用户明确要求「插件内部不绑定任何快捷键」，需要热键的用户自行在 Obsidian 设置中绑定。

## Context

- 脚本间互调依赖固定 id：影视.js 通过 `app.commands.executeCommandById('movie-analysis-open')` 调用影视数据分析——id 必须与 QuickAdd 时代一致，否则互调断裂
- 用户 Alt+A 等热键在 QuickAdd 宏命令上绑定；迁移后命令 id 相同，用户重绑成本最低
- 用户决策：插件不主动注册快捷键（避免与用户既有热键冲突）
- **2025 修订背景**：用户统一品牌「bz」（包仔首字母缩写）；主页.js（Dataview 脚本）点击动作全部改为执行 bz 命令；QuickAdd 插件已删除，不再保留降级链

## Decision

- 全部命令 id 统一 `bz-` 前缀；`executeCommandById` 互调同步改前缀
- `addCommand` 不传 `hotkeys`，不声明默认快捷键
- 卸载时 `removeCommand` 清理全部裸注册命令
- **不保留 QuickAdd 降级链**（QuickAdd 已删除）；主页.js 点击直接 `executeCommandById`，失败即无响应

## Considered Options

- 标准 `plugin.addCommand`（自动加前缀）→ 与统一 bz- 前缀决策等价，但插件前缀即 bz，无额外收益
- 维持裸 id → 用户否决：品牌不统一
- 仅目录改名不动 id → 用户否决（Q8 选 C：目录 + 全部命令 id 都改）

## Consequences

- **所有已绑定的热键丢失**（Obsidian 热键记录在命令 id 上；改 id 即失绑）——用户已知悉并接受，需重新绑定
- Obsidian 视为新插件（插件 id 由目录名决定）：需在设置中禁用旧插件 `memo-suite`、启用新插件 `bz`
- 原 QuickAdd 热键不自动迁移（命令 id 已变，热键记录不通用）——已知成本
- `bz-` 前缀全局唯一，与第三方插件冲突风险由前缀隔离
