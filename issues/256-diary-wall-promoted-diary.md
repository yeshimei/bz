# 256 · 回忆墙升格日记本（旧 diary 编辑域退役 + 设置收编 + 单源原型化）

- **状态**：拍板待落地（ADR-0115，2026-09-09 grill 两轮六问定形）
- **背景**：旧 `src/diary` 域冻结多年，ADR-0081 v2 已为删域铺路（回忆墙 parser/config/types 自包含）。
  用户拍板三件事一批做：删旧域、回忆墙正名「日记本」、旧设置按消费面收编 + 回忆墙单源原型化。
- **拍板**：
  1. 删 `src/diary`；`src/diary-wall`→`src/diary`；命令接手 `bz-diary-open`（notebook-pen）、
     `bz-diary-write` 保留进 COMMANDS 表直挂、`bz-diary-wall-open` 退役；CSS 前缀与皮肤键
     `diaryWall*`→`diary*`（占位键值零迁移）。
  2. 写链路迁入（写弹窗+时间/标签选择器+store 写层+守卫+修复引擎+加密编排）；旧编辑面板
     （条目列表/编辑/筛选/标签栏）退役；墙既有交互原样保留，仅右键「在日记本中查看」退役。
  3. 设置 12 键收编为 3 键（diaryDirectory/letterDirectory/useFileDateTime）+ 2 跨域读
     （影视→`cinemaFolderPath`、书库→bookshelf `resolveFolderPath()`，用户拍板「影视部分走影院的」）；
     外观组 issue 246 范式保留；维护组解析检测按钮落设置页。
  4. 单源原型化 bookshelf 范式全套（render.ts/fake-sim/fake-obsidian/双 iframe 壳/真实数据种子/
     PROTOTYPE.md），登记 preview 三清单（域 id `diary`），selftest 含 CSS 生效断言。
  5. 外围归一：home 双磁贴并一、settings-panel 域条目与行为包、domain-icons、smoke.test、
     tests/diary + tests/diary-wall 并归、recap/smartcat import 改指新域。
- **实现触点清单**（合并主仓后逐项核对）：
  - 删 `src/diary/**`（18 文件）；`git mv src/diary-wall src/diary`；迁入写链路（dialogs.ts/
    datetime-picker.ts/store 写层/repair.ts/repair-modal.ts/encrypt.ts + entries.ts 仅墙用 helper：
    jumpToEntry/copyLink/showConfirm）
  - `src/main.ts`：import 改指新域、COMMANDS 表 bz-diary-open/bz-diary-write、unload 清理
  - `src/settings.ts`：退役 9 键 + 旧皮肤键，接口注释与默认值同步
  - `src/diary/settings.ts`：schema 重写（外观/目录 2 键/显示 useFileDateTime/维护）
  - 跨域读：`cinema` 目录解析函数、`bookshelf/data` resolveFolderPath；翻转
    `settings.ts:92` 与 `cinema/settings.ts:40` 两处「互不联动」注释
  - `src/home/shared.ts`（磁贴合一/ICON_KEY/文案）、`recap/aggregate.ts`+`summarize.ts`+`ui.ts`、
    `smartcat`（context-source/index/diary-source/dashboard/note-memory）、`settings-panel/ui.ts`
    （id/名/loader/NAV_SECS）、`core/domain-icons.ts`、`core/item-actions.ts` 注释
  - `scripts/build-css.mjs` SOURCES、`build-preview.mjs` 两清单、`preview-live.mjs` META
  - 单源化新件：render.ts 摘取、fake-sim.ts、fake/fake-obsidian.ts、prototype.html、
    prototype-view.html、prototype-data.js（真实快照抓取脚本，先例 fetch-home-data.js）、
    prototype-icons.js、PROTOTYPE.md；settings-panel 行为包重出（schema 变更连带）
  - 测试：tests/diary-wall→tests/diary 并归；旧面板 UI 用例退役，写/守卫/parser/修复/加密用例
    适配新路径；smoke.test 命令全集/settings-panel 断言更新；render-purity 自动跟随
  - 文档：spec.md、AGENTS.md 领域清单（删 diary 旧行、diary-wall→日记本）、PROGRESS.md、
    CONTEXT.md「日记本」词条、本 issue 回填
- **门禁**：worktree（`../.dsh-worktrees/`，从最新 master 分叉 + merge master）→ pnpm test +
  tsc --noEmit + 自审 + diff 审查全绿 → 合并主仓 → 主仓 `pnpm run build` 部署（严禁 worktree 内
  构建）→ headless selftest 复现。
