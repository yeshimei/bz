# 260 — 待办正名「备忘录」+ 旧 memo 遗产清算 + 单源接入

- status: doing
- type: §1 refactor（正名+清算，行为保持） / §2 feature（单源接入）
- 分支: §1 `memo-rename-260`（worktree `memo-rename-260`）；§2 `memo-single-source-260`（worktree）
- 依据: ADR-0117（兑现 ADR-0092 第 19 行「名号继承另行立项」伏笔）

## §1 正名 + 清算（行为保持）

- `src/todo/` → `src/memo/`（10 文件）；`tests/todo/` → `tests/memo/`（6 文件）
- 标识符：`TodoItem→MemoItem`、`TodoData→MemoData`、`openTodoPanel→openMemoPanel`、`addTodoItem→addMemoItem`、`ensureTodoReminders→ensureMemoReminders`、`unloadTodo→unloadMemo`、`ensureTodo→ensureMemo`
- 命令：`bz-todo-open→bz-memo-open`（「备忘录」）、`bz-todo-add→bz-memo-add`（「加备忘录」）；ribbon；main.ts import 路径；smoke 断言
- CSS：`bz-todo-*`→`bz-memo-*`（memo/styles.css + core/styles.css 残留段核对归位）
- 内部键：`RecapDomain 'todo'→'memo'`、`todoDone/todoCreated/todos→memo*`、`todoWeekStats→memoWeekStats`、`DOMAIN_ICONS.todo`、settings-panel 导航 id/kind、home `memoIdOf` 删除
- 设置：`todoSkin→memoSkin`（onLoad 值迁移，读旧写新删旧）；6 个 `memo*` 键保留原名与值
- 文案：待办→备忘录 机械替换（recap 标签/统计语、river、settings 段注释、checkup「备忘录 / 待办」单边化、smartcat 残留待办字样）
- checkup：`../todo/data`→`../memo/data`，memoView/todoView 双视角机制保留、命名归一
- smartcat：`'memo'` 通道与「备忘录」文案零改动（正名后即为正确）
- docs：AGENTS.md 领域清单、CONTEXT.md 词条翻转（备忘录转正、待办入 Avoid）
- memo.json 红线：零变化

## §2 单源接入（ADR-0104/0106 范式）

- `src/memo/render.ts` 纯层自 ui.ts 抽出：面板壳/计数/导航/移动场景条/列表/meta + iconSpan/sceneDot/metaTags/buildSheetHead/buildCardActions；编辑弹窗（36 处 createElement）保持命令式
- `prototypes/memo/`：PROTOTYPE.md + fake/fake-obsidian.ts + fake-sim.ts + prototype-data/icons.js + prototype.html + prototype-view.html（双 iframe 桌面+移动 396）
- 行为面四项：主流程+编辑弹窗 / 引用同步演示（壳内开关模拟笔记改名删除）/ 被动捕获演示（手动触发不自动弹）/ 皮肤切换（todoSkin→memoSkin 桩）
- build-preview.mjs `PREVIEW_DOMAINS` + `BEHAVIOR_DOMAINS` 登记 `memo`；`tests/memo/render.test.ts`
- 种子：六场景 + 到期梯度（逾期/今日/未来）+ 代码（scriptName）/公开课（coursePath）特例

## 门禁

§1：全量 pnpm test + `tsc --noEmit` + 自审 + diff 审查 → 合并回主仓库 → 主仓库构建部署（原型产物随部署重出）
§2：快速原型模式（preview-live 热重载、迭代期三不），用户口令「同步」后收尾全流程
