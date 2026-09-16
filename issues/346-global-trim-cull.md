# 346 · 全域裁剪批：死代码 / review 评级四命令 / recap 退役 / encrypt 密码视图摘除

> 2026-09-16。起因：用户问「全域有哪些功能未被使用可裁剪、哪些代码可复用提通用」。
> 三路只读扫描（死代码 2627 导出全量核对 / 跨域重复 / 功能重叠与退役史）+ vault 实际
> 数据核对（日记 1246 / 影视 677 / 书库 240 / 剪藏 150 全活跃，裁剪不涉内容域）。
> 用户裁决：**26 个外观占位键不动（ADR-0156），其余全部采纳，一起修复**。
> 分支 `chore/global-trim-batch`（worktree `../.dsh-worktrees/global-trim`）。

## 一、用户裁决

**保留不裁**：26 个外观占位设置键（issue 246 有意设计，皮肤扩展预留，ADR-0156）。

**采纳裁剪**：死代码全档、review 评级四命令、recap 面板（ADR-0154）、encrypt 密码
资产视图 + 快速取密统一（ADR-0155）、vault 数据残留归档。

## 二、实现清单

| # | 改动 | 要点 |
|---|---|---|
| 1 | 删 `core/selection.ts` / `core/list-patch.ts` 整文件 | src 零引用仅测试引用；list-patch 注释自称的接入方（literature/clipping）域均已不存在；连测试一起删 |
| 2 | 删七处零调用导出 | memo/ui `openMemo`、clipbook/anchor `trackingKeyOf`、knowledge/mount-suggest `suggestKindOf`、core/settings-common `batchSizeRow`、core/viewport `isViewportBound`、core/chart-palette `CHART_TYPE_COLORS`+`CHART_RANK_BADGES`、home/shared `TIMELINE_KIND_LABEL` |
| 3 | 删三份 src 侧 `prototype-render.js` | favorites/home/review 域目录下的历史构建产物，现行产物出 `prototypes/<域>/`，壳与 freshness 守卫均不认这三份 |
| 4 | `favoritesSortKey` 死键退役 | 注释自认退役却留在 DEFAULT_SETTINGS；走 migrateRetiredAIKeys 同口径：读旧删旧 + 调度落盘 |
| 5 | review 评级四命令裁剪 | 删 `bz-review-again/hard/good/easy` 四条命令（QuickAdd 热键时代遗产，无默认快捷键后不可达；不在 home DOMAIN_MENU 耦合清单）；`bz-review-rate`（难度弹窗）为面板外唯一评级入口；面板内悬浮评级条链路不动 |
| 6 | recap 面板退役 | 删 `bz-recap-today` 命令与面板 UI；「生成今日总结」并入 home 今日摘要卡；`collectRecap` 等纯函数库保留供 home 消费（ADR-0154） |
| 7 | encrypt 密码视图摘除 | `vault-pw-view.ts`/`vault-data.ts` 退役，encrypt 面板收敛两资产；共享锁与 SafeManager 不动（ADR-0155） |
| 8 | 快速取密统一 | `bz-encrypt-copy-password` 退役；`bz-password-vault-gen` 升级「fuzzy 列现有 + 顶部生成新」一条流 |
| 9 | vault 数据残留归档 | launcher.json（ADR-0093 残留）、literature.json（ADR-0112 改名残留）、news.sync-conflict（同步冲突副本）移入归档目录，不直接删 |

## 三、测试

（实现后回填；#7/#8 ADR-0155 批次已随实现回填如下）

- 删 `tests/encrypt/vault-ui.test.ts` 密码视图用例（文件重写为收敛版：骨架/导航/摘除断言/日记抽屉/销毁确认等非密码用例保留，新增「直通 pw 资产不渲染密码元素」「密码镜像 SafeNote 不进面板」断言）；
- 删 `tests/encrypt/enh-data.test.ts`（密码强度随弹窗退役；fuzzy 段移入 password-vault）；
- `tests/encrypt/vault-data.test.ts` → `tests/password-vault/data-manager.test.ts`（数据层测试随实现属主迁移，import 改 `src/password-vault/data`）；
- `tests/password-vault/quick-pick.test.ts` 新增：fuzzy 数据侧 3 例 + 统一流 UI 3 例（顶部固定「生成新」不受过滤影响 / 选现有 Enter 复制且通知不含明文 / 空库只剩生成新可生成 / 60s 自动清空定时器 fake clock 命中 / 未解锁先弹共享解锁屏、面板未打开）；
- `tests/smoke.test.ts` 删 `bz-encrypt-copy-password`；`tests/core/overlay-glass.test.ts` 清退 `.bz-vault-dlg-mask` 遮罩断言；`tests/review-fix-b.test.ts` 清退 vault-pw-view 触控档断言。

## 四、门禁

（实现后回填；#7/#8 批次：`tsc --noEmit` 0 错；`vitest run tests/encrypt tests/password-vault tests/smoke.test.ts` 30 文件 426 用例全绿；全量回归仅 `preview-freshness` 25 例失败（原型产物待回主仓重出，worktree 不构建）。）
