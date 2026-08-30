# 第二大脑自动双链管线（link agent）设计 spec

状态：已评审定稿（2026-08，六轮设计交流 + 用户逐项拍板）；v1.1 增量（ticket 115：启动存量补链 + 批量补链命令）+ v1.2 语义修订（ticket 116：范围只管目标侧 / 候选来源 = 白名单索引库 / 两目录字段默认空、空=什么也不录）+ v1.4 增量（ticket 119：正文大改自动重跑——基准哈希 + 修改监听）+ v1.5 数据整合（ticket 120：queue/state 并入 secondbrain.json link 段、vec 改名 secondbrain.vec、store-file 串行写链 + 一次性迁移）+ v1.6 冲突自愈（ticket 152：Syncthing 冲突文件段级 union + .vec 行级重排，见「冲突文件自愈」节）+ v1.7 增量（ticket 167：已有 related 不再自动建链——尊重开关 + 三条自动路径统一跳过）含内
归属域：secondbrain
前置依赖：ticket 110（切块剥离 frontmatter——向量候选质量的前提）

## 背景与目标

知识库采用「文献盒 / 卡片盒」双盒制后，文献盒笔记由流水线批量产生，人工维护关联不可扩展。本设计让第二大脑在**新文献笔记落盘时自动为其建立与其他笔记的双链**：本地向量近邻出候选、在线 AI 裁判、单侧写入 `related` 属性，Obsidian 图谱天然双向呈现。全库索引更新与双链处理可在任一设备发起，算力门槛统一为「embedding 服务可达性」。

v1.1（ticket 115）：**存量笔记同样纳入建链**——每次启动软件自动对关联范围内缺 `related` 的存量笔记批量补链，并新增手动批量补链命令兜底；解决"库里已有大量笔记但从未建立连接"的冷启动问题。

v1.2（ticket 116，用户澄清语义）：**关联范围只管"哪些笔记会被关联"（目标/触发侧）**；**候选来源 = 白名单索引库（secondBrainAllowPaths）中的全部笔记**——弗洛伊德等任一已索引笔记都应是任何相关笔记的候选来源，不再按范围过滤候选。**「白名单目录」与「关联范围」两字段默认均空；空 = 什么也不录（不索引 / 不自动关联），不是"全库"**；不再有「文献盒」缺省回退。

v1.4（ticket 119，用户拍板）：**正文大改自动重跑**——记录每篇被处理笔记向量化/建链时的内容**基准哈希**（新状态文件 `secondbrain_link_state.json`，不动 frontmatter 格式）；监听 `vault:md-modified`（范围过滤），**内容哈希与基准不同才重跑该篇建链**：避免 Obsidian 高频保存（内容未变）空转裁判、避免自写 `related` 触发死循环；基准随每次成功建链/重跑刷新。

v1.7（ticket 167，用户拍板）：**已有 related 不再自动建链**——新增尊重开关 `linkAgentRespectRelated`（默认开）；开启时**创建 / 修改 / 队列消费**三条自动路径对 **`related` 非空**（至少 1 个有效条目；空数组/空值/缺失 = 未接管，继续建链）的笔记一律跳过（`skipped-related`，队列条目顺带移除不滞留）；存量补链天然只收缺 `related` 者不受影响；**手动命令 `bz-secondbrain-rebuild-links` 豁免**（传 `respectRelated:false` 强制重跑，显式意图）。关闭开关 = 恢复旧行为（正文大改仍自动重跑）。

## 范围

### 本期做

1. 关联范围由 `linkAgentScopes` 配置（**v1.2 起默认空**）：**只决定"哪些笔记会被自动关联"（目标/触发侧：落盘监听目录 + 存量补链目标 + 死链扫描）**；候选来源不受此范围限制（见 ②）；用户把目录加入即自然扩展目标范围，管线不变；
2. 新笔记落盘触发的自动建链 + 手动重建命令兜底；
3. 设备间任务队列（embedding 不可达时入队，桌面端发现队列**自动消费**，完成后通知）;
4. `related` 死链自动清理（完成后通知）；
5. **存量补链（v1.1/ticket 115）**：每次启动自动扫描关联范围内缺 `related` 的存量笔记批量建链（`related` 即进度检查点，中断续跑天然增量）；手动命令 `bz-secondbrain-link-all` 同路径显式兜底。
6. **正文大改自动重跑（v1.4/ticket 119）**：范围内笔记被修改且内容哈希较上次建链基准有变化 → 自动重跑该篇建链（原「新笔记落盘」触发只覆盖新建，大改的已连接笔记旧链不更新是 v1 边界，ticket 119 消除）。
7. **已有 related 不再自动建链（v1.7/ticket 167）**：尊重开关（默认开）下，创建 / 修改 / 队列消费对 `related` 非空笔记跳过（队列条目顺带移除）；手动重跑命令豁免。

### 明确不做（用户拍板）

- ❌ 晋升流程（两次触碰 → 收进卡片盒）：整体延后，不在本期；
- ❌ 负缓存（裁决记录表）：不要；幂等以 `related` 现状判定，重复裁判成本可接受；
- ❌ 多级候选器（标签重合 / TF-IDF）：候选只用向量；标签受控化伏笔随之取消；
- ❌ 复习计划联动（晋升卡入队 FSRS）：不做，复习域保持现状。

## 架构位置与复用

- 全部实现收敛于 `src/secondbrain/`，无新域；命令 id 走三段式 `bz-secondbrain-*`；
- 复用：vector-store（近邻检索）、chunker（ticket 110 修复版）、ollama 客户端（远程 URL 即 `secondBrainRemoteOllamaUrl`）、core AI（ADR-0052 统一通道，负责裁判）、notice 自绘 toast（同键合并动态更新）；
- 事件常驻模式遵循 ADR-0003：vault 监听随 `linkAgentEnabled` 开关注册/注销；
- 设置入口：secondbrain 域 ⚙️ 弹窗加开关行，不进主设置页。

## 数据设计

### related 属性（写入目标）

新笔记 frontmatter 追加：

```yaml
related:
  - "[[文献盒/另一篇]]"
```

- 单侧写入：只写新笔记侧，旧笔记零字节改动（保护 mtime / Syncthing 流量 / 向量缓存）；
- 数量默认**不设上限**，由 AI 裁判自行决定；配置了 `linkAgentMaxLinks`（>0）时才按其截断；
- 幂等基准 = 已存在于 `related` 的链不重复添加；
- 不做笔记底部静态显示区（图谱 + 反链面板承担可见性）。

### 待处理队列与正文基准哈希（ticket 120 起并入 secondbrain.json 的 link 段）

统一进入第二大脑单文件 `CONFIG/STORAGE/secondbrain.json`（store-file 共享数据层，串行写链）：

```json
{
  "version": 1,
  "meta":  { ...第二大脑索引元数据（原 secondbrain_meta.json）... },
  "panel": { ...AI 概括缓存（原 secondbrain_panel.json）... },
  "link": {
    "queue": [ { "path": "文献盒/xxx.md", "hash": "<内容哈希>", "queuedAt": "2026-08-26T10:00:00Z" } ],
    "state": { "文献盒/xxx.md": { "hash": "<内容哈希>", "linkedAt": "2026-08-26T10:00:00Z" } }
  }
}
```

- 原 `secondbrain_link_queue.json` → `link.queue`、`secondbrain_link_state.json` → `link.state`，首次加载由 store-file **一次性迁移**（读旧合并写新删旧），无误导旧文件；
- queue：存**事件**不存半成品；同 path 重入队合并并刷新 hash；消费成功即移除；失败保留待下次；对应文件已删除的条目清理时顺带移除；
- state：键 = vault 内笔记路径，值 = 该篇**最近一次成功建链时**的内容哈希（全文 `computeHash`）+ 时间戳；**只记成功**；用途 = 修改事件判定（哈希相同 → 跳过，不同/无基准 → 重跑并重建基准）；
- 单文件位于 STORAGE 目录（不在 `.stignore` 排除范围），随 Syncthing 自然跨设备流动；向量二进制独立 `secondbrain.vec`（原 secondbrain_vectors.vec 改名）；meta/panel/link 四段写方共用一条串行写链（store-file `mutateStore`），杜绝并发交错覆盖。

### 冲突文件自愈（v1.6/ticket 152）

Syncthing 对「同步窗口内两端都修改的同一文件」必然保留 `secondbrain.sync-conflict-<时间戳>-<设备ID>.json/.vec` 副本（写前比对止血后仍发生——两端各自 refresh 索引不同新笔记，内容真实分叉，见 issues/152 诊断）。store-file **每次读取时**扫描 storageDir 并自动收敛：

- **JSON 段级 union**（`mergeStoreWithConflict` 纯函数）：meta.notes 键并集/同 key 取 mtime 大者、panel 取 generatedAt 大者、link.queue 按 path 去重并集（主序在前）、link.state 键并集取 linkedAt 大者、chatHistory 按 role+content 去重并集（超 `CHAT_HISTORY_LIMIT` 截断最旧）；
- **.vec 行级重排**（`mergeVecByMeta`）：行序不变式 = `meta.notes 键序 × 各篇 chunks 数`；合并后 meta 为权威，逐 path 从「mtime 大者侧」的 vec 拷贝行段；meta.notes 未变（冲突仅 link/panel/chatHistory）→ 主 .vec 直接复用；
- **兜底**：无同批冲突 meta / 维度不符 / 行不足 → 删向量文件，下次 refresh 走既有 `indexIncomplete` 全量重建（ticket 107；元数据仍在，数据不丢）；
- 合并后写回主文件并删除冲突文件；损坏冲突 JSON 保留待人工处置（不删不合并，console 留痕）；无冲突文件 → 仅一次 `adapter.list` 零行为；
- 全程在串行写链内（`readStoreRaw` 出口统一收敛，返回合并后结构），与写入互斥；`adapter.list` 不可用 → 静默跳过。

## 核心流程

### ① 触发与可达性门

- 监听 `linkAgentScopes` 各目录下 `.md` 的**创建与修改**；空范围 = 不触发任何监听（什么也不录）
- 创建事件防抖聚合约 1 分钟内的批次；修改事件同样防抖聚合，冲刷时先按基准哈希过滤（**内容无实质变化 / 自写 related 触发的 modify 一律跳过**，只留真正改动的笔记）；
- 探测 embedding 服务（短超时 ~1.5s）：**可达 → 就地完整管线；不可达 → 入队**，手机桌面同一规则。

### ①b 存量补链（v1.1/ticket 115）

- 触发点：插件每次启动（第二大脑域初始化），**队列消费之后**串行执行；显式兜底 = 手动命令 `bz-secondbrain-link-all`；
- 目标清单：`linkAgentScopes` 范围内全部 `.md` 存量笔记（**空范围 = 无目标**），剔除 ①已含 `related`（进度检查点，下次启动自动跳过）②encrypt 锁定文件 ③队列内待重试条目（避免重复算力）；
- 可达性门：先探测 embedding，不可达 → 启动路径静默跳过（下次启动重试），手动命令明确通知；
- 执行：批内逐篇走 ②③④（入口已探测，批内 `assumeReachable` 不再逐篇探测）；批次进度与汇总 toast 复用既有「自动双链：处理中 X/N 篇 / 本批新建关联 N 条」语义；
- 串行纪律：与监听批次共用同一串行锁排队，绝不并发跑 refresh/AI 裁判；
- `related` 已有者靠 `bz-secondbrain-rebuild-links` 逐篇重跑。

### ② 候选生成（仅向量；v1.2 起来源 = 白名单索引库全部笔记）

- 先把批内新笔记纳入增量索引（否则近邻查不到它自己）；
- 取新笔记向量**在整个索引库**做近邻检索（索引库 = `secondBrainAllowPaths` 白名单收录的笔记），Top-K = `linkAgentTopK`（默认 8）；剔除自身、已删除文件与 encrypt 锁定文件；
- **不按 `linkAgentScopes` 过滤候选**（v1.2/ticket 116）：任一已索引笔记（如文献盒那篇弗洛伊德）都应是任何相关笔记的候选来源；
- **查询端 = 全文嵌入**（v1.3/ticket 118）：正文全文（剥 frontmatter、去空白）生成查询向量，超长按 8000 字安全截尾（bge-m3 上下文约 8192 token）；长笔记中后段语义参与召回，避免漏召回真相关候选。检索只负责"召回候选"，**建链条数由 ③ 裁判择优**（"只链实质关联，存疑不链"）决定——召回多 ≠ 链多；用户侧提升链数的两个手段：调大「单篇候选数量 TopK」、重跑当前笔记关联。

### ③ 裁判（在线 AI）

- 输入：新笔记档案 + 各候选的标题/summary/首块截断（档案卡紧凑格式）；
- 输出：严格 JSON `[{"id":1,"reason":"一句话"}]`，空数组 = 无关联；
- 走 core AI 默认模型（ADR-0052），指令前缀固定以便命中供应商前缀缓存。

### ④ 写入

- 通过裁判的对子写入新笔记 `related`；默认不限量，由裁判把关（prompt 强调「只链实质关联，存疑不链」）；`linkAgentMaxLinks > 0` 时裁判提示附「最多 N 条」且写入侧截断；
- 写入前后不改任何其他文件；
- 批次结束发通知：同键合并的单条 toast 动态更新「本批新建关联 N 条」（N=0 时静默，降噪默认）。

### ⑤ 死链清理（自动）

- 订阅 metadataCache 删除事件 + 启动后低频巡检：解析关联范围（`linkAgentScopes`，空 = 不扫描）各笔记 `related`，移除指向不存在文件且非本管线写入意图保留的失效条目；重命名由 Obsidian 自动改写，无需处理；
- 有实际移除才通知（「已清理 N 条失效关联」），零变化静默。

### ⑥ 队列消费（桌面为主，规则通用）

- 任一设备初始化 secondbrain 域时发现队列非空且 embedding 可达 → **自动消费，无需询问**；
- 消费 = 逐条执行 ②③④，成功移除条目；
- 全部完成后通知「待处理关联已处理完毕，共 N 篇 / 新建 M 条」。

## 设置项

| 键 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `linkAgentEnabled` | boolean | true | 自动双链总开关 |
| `linkAgentTopK` | number | 8 | 单篇候选数量（向量近邻 Top-K） |
| `linkAgentMaxLinks` | number | 0 | 每篇 `related` 写入上限；0 = 不限，由 AI 自行决定（沿用复习域「0=不限制」惯例） |
| `linkAgentNotify` | boolean | true | 处理完成后通知提醒（关闭则全程静默） |
| `linkAgentAutoClean` | boolean | true | 失效关联自动清理 |
| `linkAgentRespectRelated` | boolean | true | 已有关联不再自动建链（v1.7/ticket 167）：自动路径（创建/修改/队列消费）对 `related` 非空笔记跳过；手动重跑豁免 |
| `linkAgentScopes` | string | ''（空） | 关联范围：**只决定哪些笔记会被自动关联**（目标/触发侧：落盘监听目录 + 存量补链目标 + 死链扫描）；**候选来源不受此限制**（见 ②，ticket 116）；英文逗号分隔；**空 = 什么也不录，不是全库**（ticket 116，无「文献盒」回退） |

### 设置面板联动行为（用户拍板补充）

- ⚙️ 弹窗内 `linkAgentEnabled` 为**明细设置的显隐开关**：开启时下方展开明细行（候选数量 / 关联上限 / 完成通知 / 自动清理 / **关联范围**）；关闭时明细整体隐藏；
- 显隐即时生效（toggle onChange 重渲染该区块），各键独立持久化，重开弹窗按当前状态还原；
- 显隐属功能性显隐，样式走既有 settings group 组件，无新 CSS。

另为实施前提（用户配置变更，非代码）：`linkAgentScopes` 中出现 `secondBrainAllowPaths` 未包含的目录时，给一次性引导提示（提示这些目录未进索引、不会被检索为候选来源；把目录加入第二大脑索引范围后即生效），不代改用户配置。白名单/关联范围双字段默认均空 = 什么也不录（v1.2/ticket 116）。

## 错误处理与边界

- 裁判请求失败：该笔记保留队列/下次重试，连续多次失败经合并通知提示一次；
- encrypt 域锁定文件一律跳过；
- 移动端后台被杀 = 自然回退到队列机制，无需特殊处理；
- 单写者纪律：索引类长任务（含 ticket 110 触发的全量重建）同时只允许一端执行，增量小任务不受限。

## 手动命令

- `bz-secondbrain-rebuild-links`：对当前笔记重跑一次关联（大改后的兜底入口）。不受 `linkAgentScopes` 限制（手动触发即显式意图）；候选来源为白名单索引库全部笔记（v1.2）。
- `bz-secondbrain-link-all`（v1.1/ticket 115）：对关联范围内所有缺 `related` 的存量笔记批量补链——启动自动补链的显式兜底。与启动路径同实现（`backfillMissingLinks`），仅增加结果通知：完成（含新建条数）/ 无待补链（含空范围）/ embedding 不可达 / 开关已关闭。

## 验收标准

- [ ] 新建范围笔记（可达环境）自动产出 `related`，单侧、幂等（重跑不加重复链）；默认不限量，设上限时截断生效；
- [ ] 不可达环境下笔记进入队列文件，桌面启动后自动消费并移除条目，完成通知出现；
- [ ] 删除被链笔记后，死链清理移除对应条目并通知；零变化时不通知；
- [ ] **v1.2：候选来源 = 白名单索引库全部笔记（范围外/其他目录照常入选，自身/缺失/encrypt 剔除）；`linkAgentScopes` 只影响目标/触发侧，多目录与空范围（=什么也不录）行为正确**；
- [ ] `linkAgentEnabled=false` 时无任何监听与写入；
- [ ] **v1.1：启动后自动对存量缺 `related` 笔记补链（进度 toast + 汇总；全部已连接则静默）；手动 `bz-secondbrain-link-all` 各分支明确通知；批次与监听批次串行互斥（并发不重叠）**；
- [ ] **v1.4：修改事件按基准哈希过滤——内容未实质变化（含自写 related 触发的 modify）不重跑；哈希不同 / 无基准才重跑；重跑成功后基准刷新；修改监听随 `linkAgentScopes` 与总开关生效**；
- [ ] **v1.7：尊重开关默认开——创建/修改/队列消费对 `related` 非空笔记 `skipped-related`（不探测不裁判不写入，队列条目顺带移除）；`related: []`/缺失视为未接管照常建链；`respectRelated:false`（手动重跑）豁免强制重跑；开关关闭恢复旧行为**；
- [ ] 数据层 + UI/通知层 Vitest 覆盖（队列 CRUD、幂等、清理逻辑、开关行为、补链目标清单与串行锁、空值语义），smoke 同步；
- [ ] `pnpm exec tsc --noEmit` 与构建通过。

## 后续阶段（均不在本期）

跨盒互链（纳入卡片盒）｜晋升流程｜复习计划联动｜书库/词语纳入向量库｜质量反馈闭环：审计日志 + 否决记忆 + 互惠加权（已立项 ticket 112，排在 111 合并后实施）。
