# 298 — 文献笔记生成即跑：知识盒生成落盘后立即建链，不等批次防抖

- 日期：2026-09-12
- 用户拍板：**「整体迁移到知识盒」本轮不做**（候选索引归属未定，见 §1）；本轮只实现「生成即跑」
- 关联：ticket 111 / 115 / 116 / 119 / 167（自动双链管线）、ADR-0112（knowledge:tasks 契约）
- 状态：已完成

## §1 背景与决策

原始诉求（用户）：「自动双链迁移到知识盒中，设置也迁移过去，每当生成文献笔记立马跑自动双链，不用等」。

两轮澄清后收敛：

1. 候选近邻依赖第二大脑向量索引（`secondBrainAllowPaths` 白名单索引库 + embedding 服务 + `secondbrain.vec`），**知识盒自身没有任何索引能力**；
2. 跨域迁移的代价取决于候选索引归属：知识盒自建索引要把切块 / 嵌入 / 向量检索内核上提到共享层（约 2000 行级），借用第二大脑索引则会在第二大脑停用或白名单未含文献目录时静默失效；
3. 用户结论：「还不能迁移到知识盒，算了，只每当生成文献笔记立马跑自动双链，不用等」。

→ **迁移整体搁置**（设置组、两条命令、`linkAgentScopes` 归属一律不动），本轮只做触发侧的「生成即跑」。

## §2 设计

### 触发源：复用知识盒既有域事件，不新开通道

| 路径 | 事件 | 说明 |
|---|---|---|
| 视频转文献 | `knowledge:tasks` `kind:'converted'` | `processor.ts::_finish` 本就带 `notePath` |
| 术语生成 | `knowledge:tasks` `kind:'term-generated'` | 本轮补 `notePath` 字段（`ui.ts::onTermConfirm`） |

消费方 `LinkAgentWatcher` 新增订阅 → `onNoteGenerated(evt)`：`kind` 属两类之一 + `notePath` 非空 + 文件存在，三者齐备才触发。`failed`（其 `notePath` 可能是失败任务的旧值）、缺路径、文件不存在一律忽略。

### 行为差异（相对旧路径）

| 维度 | 旧：`vault:md-created` 范围监听 | 新：生成即跑 |
|---|---|---|
| 等待 | 约 60 秒防抖聚合批次 | **立即**（单篇直接跑） |
| 范围 | 须命中 `linkAgentScopes`（默认空 = 什么都不录） | **不受范围限制**（生成即显式目标，语义同手动重跑） |
| 并发 | 批次级串行锁 | 同一串行锁（与批次 / 存量补链互斥，不并发 refresh） |
| 反馈 | 批次级「处理中 X/N」合并 toast | 单篇同键 toast：N>0 报条数 / 不可达报入队 / 失败 warning / **N=0 静默** |

- **启动竞态**：先 `await store.initialLoad` 再跑（避免 in-flight refresh 与 load 并发读到半装载索引）；装载失败不阻断（管线内部各自兜底）。
- **防循环**：写入 `related` 触发的 `vault:md-modified` 由 `link.state` 基准哈希挡掉（v1.4 机制沿用）；同篇若已进范围防抖缓冲，冲刷时被尊重门判 `skipped-related`，不重复花裁判算力。
- **总开关**：`linkAgentEnabled=false` 时不订阅、不探测、不写盘。

### 索引覆盖引导（一次性；只提示，不代改配置）

文献笔记所在目录不在 `secondBrainAllowPaths` 内（含白名单为空的缺省态）→ 提示「该目录不会被向量化、候选检索不会命中」，指引去第二大脑设置补白名单。**否则默认配置下生成文献笔记会「零关联且毫无提示」——静默失效。**

## §3 改动面

| 文件 | 内容 |
|---|---|
| `src/knowledge/ui.ts` | `term-generated` 载荷补 `notePath`（术语路径） |
| `src/smartcat/knowledge-source.ts` | `KnowledgeActionEvent` 的 `term-generated` 变体补 `notePath?`（契约同步） |
| `src/secondbrain/link-agent/pipeline.ts` | 新增 `processNoteNow`（串行锁 + 即时反馈通知）与 `LINK_NOTE_NOW_NOTICE_KEY` |
| `src/secondbrain/link-agent/watch.ts` | 订阅 `knowledge:tasks` → `onNoteGenerated`；构造器新增 `initialLoad` 参数；`guideIndexCoverage` 一次性白名单引导；`__resetLinkAgentGuideForTests` 复位两个标志 |
| `src/secondbrain/index.ts` | `LinkAgentWatcher` 接线传入 `s.initialLoad`；头注释补 issue 298 |
| `tests/secondbrain/link-agent-ui.test.ts` | 新增两 describe 共 15 用例（触发/守卫/装载等待/白名单引导/即时通知） |
| `prototypes/{secondbrain,knowledge,clipbook}/prototype-behavior.js` | 预览产物重出 |

## §4 测试

- **触发**：`converted` 立即跑（5ms 内，远小于 30ms 注入窗口）且走即时入口不走批次；`term-generated` 带 `notePath` 触发、旧载荷忽略。
- **守卫**：`failed` / 文件不存在 / 非两类 kind / `linkAgentEnabled=false` 均零动作。
- **装载等待**：gate 未放行时不动；放行后跑；`initialLoad` reject 仍跑。
- **白名单引导**：未覆盖提示一次且含目录名，二次事件不再提示；已覆盖零提示；白名单为空同样提示且不阻断管线。
- **即时通知**：N>0 报条数；N=0 静默；不可达报入队且不写 `related`；裁判失败 warning + 条目留队列；`linkAgentNotify=false` 全程静默；总开关关闭直接 `skipped` 不调裁判。

## §5 门禁记录

- `vitest run`（worktree）：`tests/secondbrain/` 25 文件 / 323 用例全绿；全量 294 文件 / 4565 用例中仅 `tests/preview-freshness.test.ts` 8 例红。
- **该 8 例已定位为环境噪声**：worktree 检出按 `core.autocrlf=true` 写 CRLF，而主仓工作区为 LF（`git status` 干净），源指纹 sha1 因此不等。用 `git stash` 对照实测：基线（不带本次改动）同样 5 例红（home / memo / pomodoro×2 / settings-panel），本次改动新增 3 例（secondbrain / knowledge / clipbook）为**真实滞后**，产物在主仓重出后归零。
- `tsc --noEmit`：干净（worktree 与主仓两次均过）。
- 主仓全量 `vitest run`（产物重出后）：**293/294 文件通过**；余 2 例 `preview-freshness`（memo / settings-panel）为**并行会话在途改动**（ADR-0127：`src/settings-panel/ui.ts` 等在主仓尚未提交）造成，非本改动引入。
- 产物重出与部署：`node scripts/build-preview.mjs`（全量）+ `pnpm run build` → `main.js` / `styles.css` 已部署至 Obsidian 插件目录（`E:/Obsidian/叫我包仔/.obsidian/plugins/bz`）。**严禁在 worktree 内构建**（`build-css.mjs` 会写用户插件目录）。
- ⚠️ 收尾时工作区另有一并行会话（ADR-0127 picker 单源 + 面板皮肤）在途写入 `src/core/path-picker.ts` / `src/settings-panel/*`：
  - 本改动**必须重出的产物**共 5 个域（由其输入清单含本次改动的源文件反查得出）：clipbook / knowledge / memo / secondbrain / settings-panel；
  - 其中 4 个（clipbook / memo / secondbrain / settings-panel）与并行会话的改动**同域耦合**——他们的重出范围（clipbook / diary / memo / password-vault / secondbrain / settings-panel）已覆盖这 4 个，收尾后重出即同时吸收两侧改动；
  - knowledge 是唯一只受本改动影响的域，其产物已单独重出并入库。

## §6 遗留（下一步）

- **整体迁移到知识盒**：待候选索引归属定案后启动。可选路线两条——① 知识盒自建索引（需把切块 / 嵌入 / 向量检索 / .vec 读写上提共享层，工作量 2000 行级，可顺带让第二大脑复用）；② 借用第二大脑索引 + 候选过滤到知识盒目录（零重复嵌入，但存在隐式依赖）。届时设置组、两条命令、`linkAgentScopes` 语义一并迁移。
- 卡片（`knowledgeCardboxDirectory`）生成目前不触发建链；若后续要纳入，同通道补一处 `emitDomainEvent` 即可。
