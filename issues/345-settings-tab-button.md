# 345 · 原生设置页退役平铺：只留「打开设置面板」按钮

> 2026-09-16。用户指令：「去掉 bz 插件设置中的选项，只留下一个按钮，点击打开 bz 自身的设置面板」。
> 分支 `feat/issue-345-settings-tab-button`（worktree `D:/.dsh-worktrees/bz-issue-345`）。

## 背景

Obsidian 原生插件设置页（`BzSettingTab.display()`）此前平铺渲染 `mainSettingsSchema()`
三区块（服务商/模型配置/数据源凭据 + 数据存储路径 + 通知），与 settings-panel 面板
（ADR-0080 全域设置聚合入口）内容重复。issue 331 拆组后原生页行数进一步膨胀，两处维护同一批
设置入口的必要性下降。

## 拍板

原生设置页不再渲染任何 schema 设置组，只留一行一个 CTA 按钮「打开设置面板」，
点击调 `openSettingsPanel(app)`（bz 设置面板，与命令 bz-settings-panel-open 同一入口）。

## 实现

| # | 改动 | 要点 |
|---|---|---|
| 1 | `main.ts` BzSettingTab | display() 改为单个原生 `Setting` 行 + 按钮；删除 `renderSettingsInto` / `mainSettingsSchema` import |
| 2 | `core/settings-main-schema.ts` | `mainSettingsSchema()` 保留为聚合视图（不再有 UI 消费方），供测试与文案 lint 全量断言；三组 schema 仍由 settings-panel 面板分页消费 |
| 3 | `tests/settings-tab.test.ts` | 重写：断言无设置组、仅一行一按钮（cta）、点击触发 `openSettingsPanel(plugin.app)`、重复 display 不残留；原平铺行为断言由 settings-schema.test.ts（纯数据）与 settings-panel.test.ts（面板渲染）承接 |

## 未做 / 说明

- 设置读写链路（settings-provider、schema、绑定）零变化——只是原生页不再展示。
- `mainSettingsSchema` 不删：settings-copy-lint / settings-schema.test 仍以它为全量断言入口。
- 同步：ADR-0153（原生设置页退役平铺）、spec.md 设置归属模型/设置项总表注记、
  CONTEXT.md 设置模型词条与 Rules 行。
- 留给后续（review 发现）：`preview-freshness` 指纹按磁盘字节算，主仓 LF 直出文件在
  worktree 被 autocrlf smudge 成 CRLF 会误报「产物滞后」（本批 worktree 12 例假红、
  主仓同提交全绿实证）。建议 stamp 归一化（按 clean 后内容算摘要），另立 issue。
