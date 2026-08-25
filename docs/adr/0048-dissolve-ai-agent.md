# ADR-0048：解散 AI Agent 域——职责归位 + 同步链路总线化

Status: accepted（2026-08-26，ticket 102）

## Context

ai-agent（ticket 19）是全库最薄的域：仅 index.ts / sync.ts / dialog.ts 三个文件，没有自己的面板、命令与用户入口，且唯一被 main.ts 装配、没有任何域消费它。它实质是三类跨域自动化，而非独立业务域：

1. **memo.json 引用同步**——笔记 rename/delete 时更新备忘录条目的 linkedNote/标题；
2. **favorites.json 引用同步**——rename/delete 同步引用路径/标题/notePath，create/file-open 同名未关联条目自动关联；
3. **剪藏 AI 匹配归档**——新剪藏落盘后 URL 精确匹配备忘录剪藏待办，未命中走 AI 匹配 + 弹窗批准归档。

其裸订阅（vault create/delete/rename + workspace file-open）与 aiAgentWatchedFolders 目录匹配正是 ADR-0047 点名的债务源之一。一期事件总线（ADR-0047）落地后，vault 四事件由 obsidian-adapter 统一转译为 `'vault:md-*'` 通用兜底 + `<域>:file-*` 语义双通道，消费方 onDomainEvent 即可感知 vault 变化——三类自动化全可走事件分发，「独立域」外壳失去存在必要。

## Options

- **A 维持独立域瘦身**：src/ai-agent 保留，仅把裸订阅换成总线通道。优点是改动最小；缺点是「无数据、无 UI、无命令」的空壳域继续占一个编制，结构错位不解决。
- **B 拆回属主域（采纳）**：引用同步按数据归属拆到 memo/favorites（各持本地纯函数副本），剪藏匹配归档因写路径在 memo.json 也归 memo；装配收敛为一对入口。优点是数据知识回到属主、依赖方向干净、域数减一；缺点是 sync 纯函数出现两处副本（以「勿跨域 import、语义逐行等价」纪律约束）。
- **C 全并入 core**：三类自动化下沉共享层。缺点：core 出现具体业务写路径（备忘录条目/收藏条目），违背 core 无业务语义的分层惯例，且属主域的数据知识外泄到共享层。

## Decisions

1. **引用同步拆回数据属主**：memo.json → `src/memo/file-sync.ts`、favorites.json → `src/favorites/file-sync.ts`。sync 纯函数（syncRename/syncDelete/syncAutoLink）、JSON 读写、串行队列与 DEBOUNCE_DELAY 合并去抖均为各域本地私有副本（语义逐行等价，注释标明出处，勿跨域 import）；订阅走事件总线 `'vault:md-*'` 通用兜底通道（obsidian-adapter 恒发、仅 md），生效范围仍按 `aiAgentWatchedFolders` 过滤。
2. **剪藏 AI 匹配归档归 memo**：`src/memo/clip-archive.ts` + `clip-archive-dialog.ts`（批准弹窗逐字移植），订 `'clipping:file-created'` 语义通道；frontmatter link 与 memo.json 剪藏场景待办 URL 精确匹配优先，命中即归档（写入 linkedNote 并置完成）；未命中且 enableAIClipMatch 开启才发起 AI 匹配并弹窗征求批准，确认后才写入。
3. **装配点收敛**：main.ts 改调 `ensureMemoFileSync` / `ensureFavoritesFileSync` 一对入口，仍由 `aiAgentEnabled` 单一门控——ADR-0003「事件常驻域按设置开关注册」例外延续，宿主从 ai-agent 换成 memo/favorites；onunload 对应 `unloadMemoFileSync` / `unloadFavoritesFileSync` 双收口。
4. **行为冻结清单**：aiAgentWatchedFolders 监听文件夹门、DEBOUNCE_DELAY 合并去抖（窗口内同型事件收集成批静默回放，保 rename 链顺序）、串行队列（防并发读写同一 JSON）、URL 精确优先/AI 弹窗批准权限模型（非 AI 操作静默直改、仅 AI 匹配弹窗批准）、enableAIClipMatch 开关语义——全部零变化。
5. **唯一文案例外（显式声明）**：favorites 同步失败通知随域改「收藏本同步失败，数据可能不一致」，dedupeKey 由 'ai-agent-sync' 改 'favorites-file-sync'（避免与 memo 侧失败通知互相去重串扰）；memo 侧失败文案不动。
6. **顺带收编最后两处 md 裸监听**（ADR-0047 决策 6 的尾巴）：movie 索引改订 `'movie:file-*'`、剪藏视图前言同步改订 `'clipping:file-modified'`；同源双订自带防双记录纪律（ADR-0047 决策 5）照守。
7. **文件引用同步家族口径**：家族共三员——memo.json、favorites.json（本轮归位）与 review.json（review/watch.ts onVaultRename 更新计划内笔记路径，事件总线一期已订同一通用通道，无需改动）。
8. **设置四键冻结保留不暴露**：aiAgentEnabled / enableAIClipMatch / aiAgentWatchedFolders / aiAgentModel 继续运行时读字段（默认值兜底、尊重旧 data.json 值），UI 不暴露（ADR-0009 决策 7 延续）。

## Consequences

**域数 21→20**：src/ai-agent 退役删除，README / AGENTS.md / manifest.json 同步去名；领域清单不再有「无自己数据属主」的编制。

**依赖方向净变化**：继 ADR-0047 六域 ui → core 改道之后，memo/favorites 新增两条「域 → core/domain-bus」订阅边（事件载荷 type-only 导入，零运行时反向边，符合 ADR-0002）；全库不再存在指向 src/ai-agent 的边，main.ts 对该域的装配 import 清零。

**可回滚性**：拆分本质是「移动 + 私有副本」，数据格式、通知契约（除声明的文案例外）、命令表零变化，整票单 commit 可整体回滚。

**遗留边界**：

- belongings.json / weave-data.json 等 **json 数据文件监听一期不覆盖**（obsidian-adapter md-only）——belongings 数据文件自动刷新维持原生 vault 订阅，json 通道凭后续首个消费方票再议；
- workspace **file-open 未收编**（总线一期只管 app.vault 四事件）——favorites 同名自动关联仍原生订阅该事件，workspace 事件入总线时再迁。
