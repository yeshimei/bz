# 0001 — 命令 id 不加插件前缀以保留用户热键绑定

QuickAdd 时代，用户通过 `app.commands.addCommand` 注册了 `diary-open-add-dialog`（绑定 `Alt+A`）与 `diary-create-quote`。Obsidian 的 `plugin.addCommand` 会自动给 id 加 `插件id:` 前缀，导致热键失效；因此插件版继续用 `app.commands.addCommand` 裸注册这两个命令（卸载时 `removeCommand` 清理），新增命令（`diary-notebook:open-panel`）则走标准 `plugin.addCommand`。

## Considered Options

- `plugin.addCommand` 全部标准注册 → 热键失效，需用户重新绑定
- 全部裸注册 → 未来与其他插件 id 冲突风险

## Consequences

`diary-open-add-dialog`、`diary-create-quote` 是全局 id；后续迁移其他脚本时沿用同一约定（保留原脚本命令 id），保证用户既有热键全部继续生效。
