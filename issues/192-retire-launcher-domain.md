# issue 192：退役旧 launcher 域（入口页），home 为唯一入口（ADR-0093）

## 目标
删除 `src/launcher/` 整域（文件夹级抹除），执行 issue 178 预挂的「launcher 另票删除」连带清单。

## 决策记录（2026-09-05 grilling 拍板）
- 本轮完整退役 launcher；手势功能随域退役（不迁 home），四键 launcherShowText*/launcherGesture* 删除。
- home 维持「内容首页」名号，不继承「入口页」。
- launcher.json 数据文件留 vault 不动（用户数据，残留自然忽略）。

## 任务清单
- [x] 删 `src/launcher/`、`tests/launcher/`
- [x] main.ts：bz-home 命令、launcher import/setter 接线、手势迁移块、syncGestures、unregisterGestures 全拆
- [x] settings.ts：launcherShowText/launcherShowTextMobile/launcherGesture/launcherGestureMobile 接口+默认删除
- [x] attach：ensureAttachSeed 播种功能删除（含 tests/attach 用例）
- [x] checkup：launcher.json 巡检行 + 段级漂移条目删除
- [x] smartcat：launcher:opened 路由/behavior-wording 实体/buildLauncherOpenedStructured 删除（含测试）
- [x] settings-panel：入口页行删除；core/domain-icons：launcher 条目删除
- [x] scripts/build-css.mjs：launcher/styles.css 行删除
- [x] 文档：ADR-0093、本票、CONTEXT.md（入口页/磁贴/档位/编辑模式/推挤/幽灵磁贴词条删除、内容首页词条更新）、AGENTS.md

## 验收
- pnpm test 全绿 + tsc --noEmit 干净（与 issue 191 同批验收）。
- 全库 grep 无 `src/launcher|bz-home'|launcherGesture|launcherShowText` 残留（home/ui.ts escManager 命名空间字符串 'bz-home' 为同名巧合，非命令引用，保留）。
