# ADR-0047：全域事件总线——统一 Obsidian 事件收编与跨域动作分发

Status: accepted（2026-08-26，ticket 101）

## Context

vault 文件事件的订阅与「路径 → 域」的归类知识长期分散在七个消费点，各自裸订阅 `app.vault.on` 再各自过滤：

- **smartcat**（index.ts 的 delete/rename 观察链路 + dashboard.ts 的 modify 静默刷新）
- **ai-agent**（create/delete/rename 同步备忘录/收藏本）
- **review**（index.ts create/delete/rename 收编监听；watch.ts 自带 isUnderFolder 目录边界判定）
- **diary 面板**（ui/panel.ts modify 刷新）
- **belongings**（ui.ts modify 数据文件监听自动刷新）
- **movie 索引**（index.ts create/delete/modify 防抖重建索引）
- **clipping 视图**（view.ts modify 前言同步）

由此产生两类重复债：

1. **路径分类知识三处副本**——smartcat/context-source 的 classifyPath 目录硬编码、review watch 的 isUnderFolder 边界判定、ai-agent 的监听文件夹匹配，各写一套「目录前缀边界」语义，改一处漏两处；
2. **方法监听六域样板与文件事件通道并存但无统一设施**——ADR-0027~0033 让 movie/memo/news/diary/favorites/belongings/pomodoro 走「UI 确认回调直呼 notifyXxxAction」的方法监听，跨域动作分发靠六份手写样板；文件类观察（diary/卡片盒/现代诗/信）仍各自挂 vault 监听。新域要感知 vault 变化或向小橘上报动作，都得重新造轮子。

## Options

- **A 共享分类器不建总线**：只把 classifyPath 抽到 core 消灭三处副本，订阅仍各域自理。优点是最小改动；缺点是七处裸订阅依旧，事件无统一转译层，「谁在听什么」不可审计。
- **B main.ts 单点装配**：四事件订阅与分发逻辑直接写进 main.ts。优点是零新模块；缺点是 main.ts 已是命令/设置/懒加载三合一巨石（38 命令），再塞事件路由违背 ADR-0003 分域原则。
- **C 事件总线 + obsidian-adapter（采纳）**：core/domain-bus 进程内 pub-sub + core/obsidian-adapter 全插件唯一 vault 订阅点 + core/path-classify 动态分类器，三件套分层。优点：订阅点唯一可审计、分类知识单源且动态跟随设置、跨域动作有统一通道；缺点是多两个 core 模块，通道字符串成为隐式契约、需纪律约束。
- **D 维持现状**：不动。缺点即 Context 所列债务继续滚。

## Decisions

1. **core/domain-bus 进程内 pub-sub**：通道命名 `<域名>:<事件>`（如 `vault:md-created`、`diary:file-renamed`）；fire-and-forget 同步扇出、无返回值；单个 handler 抛错隔离捕获不影响同通道其他 handler 与派发方；总线不做去重/节流/防抖。
2. **core/obsidian-adapter 为全插件唯一的 vault 四事件订阅点**（create/modify/delete/rename）：main.ts onLoad 时 `attachObsidianAdapter` 挂载并以 registerEvent 托管引用，onunload 时 `detachObsidianAdapter` + `clearDomainEvents` 双收口。
3. **双通道派发**：通用兜底通道 `'vault:md-*'`（created/modified/deleted/renamed）恒发——未命中任何域目录的 md 由消费方在此兜底接住（任意文件夹监听需求，如 review 用户自配监听目录）；classifyFilePath 命中域 d 时另发一条语义事件 `<d>:file-*`。rename 只发 renamed 一条（不补发 created/deleted），语义载荷带 movedOut 跨域移动标记；仅 diary 附带 date。
4. **分类器 core/path-classify 按 settings 目录实时动态构建**：每次调用读 tryGetSettings，用户运行时改目录即时跟随；判定顺序沿用 context-source 既有优先级 diary → flash → clipping → movie → poem → letter；边界语义对齐 review isUnderFolder（`path === dir || path.startsWith(dir + '/')`）。core 层不得反向 import 域模块取常量，默认值为本地副本并注明出处。三处硬编码副本自此以它为单源消灭。
5. **两条订阅端纪律入律**：
   - **回环抑制只能在订阅端做**（总线禁全局去环）——smartcat 日记结算依赖「该条任何修改都重置其 10 分钟计时」，包括自写回声；若总线全局去环，自写回声被吞、结算计时语义即坏。
   - **同源双订必须自带防双记录**（对齐 movie 先例 ADR-0027 的事件短路）：同一动作经方法与事件两路可达时，消费方自行短路其一。
6. **事件跟消费者走**：本轮只落已有消费者的通道（见 ticket 101 范围清单）；🆕 事件（password/quiz/launcher/attach/encrypt 明细等）出现首个消费方时凭 ticket 埋，不预铺无人订阅的通道。
7. **B 站下载器为外部进程明确排除**：不进总线（ADR-0006/0011 外部 npm 通道不变）。
8. **类型随源**：跨域事件负载类型一律 type-only 导入（`import type`），零运行时边，不破坏 ADR-0002 依赖方向。

## Consequences

**依赖方向变化**：六域 UI（movie/memo/news/favorites/belongings/pomodoro）的动作上报改为向总线 emit 通道后 import core/domain-bus（ui → core），不再直接 import src/smartcat 的 notifyXxxAction；smartcat 降级为普通订阅方 onDomainEvent 收事件。方向符合 ADR-0002（core ← 域模块），消灭 ui → smartcat 直连边。文件类消费者（review/ai-agent/diary 面板/belongings/movie/clipping）迁到 `'vault:md-*'` 或 `<域>:file-*` 通道，随各域 ticket 推进。

**行为冻结声明**：观察文案、防抖窗口、10 分钟结算、守卫条件零变化——本轮只换「事件怎么流动」，不改「事件触发什么」；smartcat 各 source 纯函数与回声重置语义原样保留。

**已知边界**：

- workspace 事件未收编（file-open 等 workspace.on 仍在各域自理，adapter 只管 app.vault 四事件）；
- C 层交互事件仅 diary 部分落地（diary 动作与核心交互通道先行，其余域的交互明细按决策 6 凭首个消费方 ticket 埋）；
- 通道字符串即契约（派发方与消费方共用同一字面量，不设独立常量表），改名属破坏性变更，需两侧同步。
