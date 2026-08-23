# ADR-0035：smartcat 卡片盒/现代诗/信 观察（per-file 10 分钟结算 + 段落级 diff 摘要 + 真实日期首落），反省彻底移除

Status: accepted（2026-08-24，ticket 083，用户多轮拍板 v1 → v2 → v3 → v4 定稿）

## Context

flash（卡片盒）/poem（现代诗）/letter（信）/reflection（反省）四域此前共用旧「内容快照」通道（`onVaultActivity` → `observationText`：vault create/modify 时读全文截 300 字 → 直接 `addObservation`，10 分钟去弹跳 + 机械去簇）。问题与日记旧通道一致：路径级粗粒度（整文件快照）、正文截断 300 字、删除无感知。用户 2026-08-24 拍板定稿：

- **v1**：flash/poem/letter 改走日记模型（每篇 md 文件 = 一条内容，per-file 10 分钟结算）；reflection（反省）彻底移除；文案「去闪念描述」（卡片盒体）。
- **v2**（差异观察）：信往往很长（实测《阿尼玛》类四五千字），修改带新正文全量太重——更新观察改为**段落级 diff 摘要**（任何正文内容变化即产，不再用累计 >50 阈值；10 分钟静置负责合并窗口内连续编辑）；存量文件有基线即可 diff，无日期时代不需要补首落。
- **v3**（真实日期）：存量信 15/15 全部有 frontmatter `date:`（可靠）——首落/补发带真实日期；现代诗日期三层回退；信无 frontmatter date → 不跟踪；存量信/诗（从未出过首落）首次修改 → **先补带日期全文首落，再产修改 diff**。
- **v4**（readonly 准入）：信 frontmatter `readonly: true`（实测仅第 0 封信）→ 不观察（不跟踪、首落/修改/删除均不产）。

## Options

- A（采纳）**per-file 独立 10 分钟计时表**（对齐日记 ADR-0030，per-entry → per-file 简化版）：事件通道（vault create/modify/delete 监听三目录，classifyPath ∈ {flash,poem,letter}）→ 正文 diff → 重置该篇独立计时；计时到期读文件结算。`noteTracked` 快照兼做 delete 感知。
- B 保留 observationText 快照增强：无法区分单篇静置/删除、正文仍截断、长信更新太重——不满足用户「对齐日记模型 + 全文/差异」。
- C 方法监听（仿 movie/memo/news）：三域写入面多（手改 md/同步导入/闪念窗口外写），无法穷举 UI 挂点；卡片盒/诗/信正文即数据本体，事件通道是唯一可靠感知面——未采纳。
- D（v2 半程方案 累计 >50 才更新）**用户拍板推翻**：信长文补写常超阈值、短修改又不够——改「有变化就发」，静置窗口合并连续编辑。

## Decisions

- **事件驱动新链路**：`onVaultActivity` 对 `kind === 'flash' | 'poem' | 'letter'` 短路走新链路（替换 observationText 分支——flash/poem/letter 的 observationText 分支保留代码但**不再被触发**）；原三域 10 分钟去弹跳、机械去簇、信任成长 `developBasedOnInteraction` 不再执行（flash 死分支随 tsc 收敛删除，PAD 通用分支 flash→note_edit 收敛为 note_read）；PAD 正向轻推（红队 C 接线）在新链路早退分支内保留：`moodSystem.handleInteraction('note_create', 0.5)`（对齐日记分支写法）。
- **reflection 彻底移除（用户拍板）**：`classifyPath` 删 `我的/反省` 行（返回 null 不再分类）；`observationText` 删 `case 'reflection'`；`ActivityKind` union 移除 `'reflection'` 成员（仓内 grep 确认无其它引用后移除；`onVaultActivity` 的 reflection 防御性短路未加——union 已无该成员，加会触发 TS2367，以 tsc 0 为准取舍）；已有反省文件不迁移不观察。记忆流/反思调度（`memory.reflection`、洞察 source 'reflection'）是另一机制，不受影响。
- **per-file 计时表**（模块级 Map，内存态不落盘，smartcat.json 零改动）：key = filePath；value = `{ timer, kind, generated, baseline, observed }`——`generated`（是否已进入已生成分支；重启基线有字视为已见）、`baseline`（上次结算正文全文，diff 基准）、`observed`（首落是否已处理：产出或确定不产；基线预置 = false → 存量信/诗首次修改先补首落，v3）。**v2 起无 accum 累计字段**。该篇任何正文变化（快照 diff）→ 清旧定时器重装 10 分钟；静置到期（默认 10 分钟，测试可注入缩短）→ 读文件 → 正文 = 去 frontmatter 后全量 trim → 该篇结算。
- **正文语义**：正文 = 去 frontmatter 块后全量 trim（对齐 observationText 既有 poem/letter 分支 `replace(/^---...---/)` 先例）；**仅改 frontmatter 属性不产观察**（date/readonly 只用于准入与首落日期）。
- **准入（v3/v4）**：信 = frontmatter 存在 `date:` 且无 `readonly: true` 才跟踪（当前 15 封全覆盖）；无 date/readonly 的信在 build/handle 层早退，不产首落/修改/删除观察。现代诗/卡片盒无字段约束。
- **日期解析（v3，`parseNoteDate`）**：flash 恒 null；letter = frontmatter date（ISO/空格式两式兼容 → `YYYY-MM-DD HH:mm`，仅日期 08:00 占位）；poem 三层回退——① frontmatter `date:`（带时间保留）→ ② 文件名 `YYMMDD` 前缀（08:00 占位）→ ③ 父目录名=年份 + 文件名 `MMDD` 前缀（08:00 占位）→ 全部无 → null。
- **首落文案（v3 三句式）**：flash `你在卡片盒记下了「X」：「<全文>」`（无日期概念）；poem `你在 <date> 写了一首现代诗「X」：<全文>`；letter `你在 <date> 写了一封信「X」：<全文>`（正文全文不截断，长信也全文——用户拍板）。
- **修改观察（v2 段落级 diff 摘要，`noteDiffSummary`）**：`你修改了<卡片盒|现代诗|信>「X」：<摘要>`——正文任何变化即产（小改动也产）；段落切分（空行分段、trim 非空）→ 段落级 LCS（段全文相等配对）→ 未配对旧段=删除（旧文档段号）、未配对新段=新增（新文档段号）；相邻删增块按位置配对，字符重叠率 ≥0.5 = 修改段（报旧段号），否则按删除/新增分别报；每类最多列 3 段、超出 → 「等 N 处<类名>」；片段截断：删/增段前 50 字、修改段旧前 30 字 → 新前 30 字（超长加…）；同类「、」异类「；」，类序固定 删除 → 新增 → 修改；无变化（含纯空白/换行变化）→ null（不产但基线推进，吸收空白差异）。
- **存量补首落（v3）**：ensure 基线预置 `generated=true, baseline=全文, observed=false`（不产出）；存量信/诗首次被修改（结算时 `generated && !observed && 有 date && 有正文`）→ **先补首落观察（带日期 + 当前全文）再产 diff 观察**（两条，均 fire-and-forget）；flash 无日期概念不补（存量直接 diff，v2 规则）；诗无任何日期来源也不补（差异观察不依赖日期）。
- **删除观察（v1 不变）**：`你删除了卡片盒「X」` / `你删除了现代诗「X」` / `你删除了信「X」`（仅追加，原观察保留）；vault delete 监听扩展为分派（diary 保留 + 三域）——有跟踪快照才产，未跟踪（含无 date/readonly 信）跳过。
- **重启基线**：ensure 时对三目录全部 md 建快照（`app.vault.getFiles()` 过滤 `.md` + classifyPath 三域命中 + 信准入）——有字记「已见」（generated=true），无字待首落，**不产出观察、不装计时器**（事件才起动）；基线先于监听挂载。量级：卡片盒 1506 + 现代诗 153 + 信 15 ≈ 1670 个，一次 ensure 串行读，一次性成本可取（对齐 077 取舍）。
- **观察写入 fire-and-forget**：结算/删除/补首落观察一律 `void memorySystem.addObservation(text, { source: kind })`，不 await——`addObservation` 尾部 `appendVector`（探测 Ollama）在无向量环境可能不 resolve，若 await 会阻塞事件链并拖住结算状态提交（对齐日记 077 踩坑）。**流内顺序非契约**（并发 void 各自内部 await）。
- **兼容冻结**：`卡片盒/*.md`、`我的/现代诗/*.md`、`我的/信/*.md`、smartcat.json 零改动；不改 flash/poem/letter 域代码（context-source 的 observationText 分支删除/保留属 smartcat 侧收敛）。

## Consequences

- 观察粒度从整文件粗快照精确到**每篇 + 差异**：新建静置 10 分钟落首落（全文）；修改合并窗口内连续编辑为一次 diff（段落级删/增/改摘要，不再带新全文，长信友好）；删除可感知且原观察保留；首落带真实日期（信 frontmatter / 诗三层回退）。
- 行为变更：flash/poem/letter 不再走原 10 分钟去弹跳/机械去簇/信任成长/observationText；批量导入不再被机械去簇折叠（各篇独立结算 + 重启基线是替代的批量防护）；**reflection 反省不再产任何观察**（旧「你写下了反省：…」记忆不迁移）。
- context-source 收敛：ActionKind 移除 'reflection'；classifyPath 8 类源；observationText 删 reflection 分支，flash/poem/letter 分支保留但仅剩理论可达（index 已短路）。
- note-source 为纯函数层（文案/日期/正文提取/段落 diff/结算判定），无新域间依赖（frontmatter 正则轻量解析，对齐 smartcat 既有前端口吻，不引入 YAML 全子集）。
- 已知边界/取舍（实现者在 ADR 说明）：
  1. 同名文件（不同子目录）以 filePath 为 key，天然区分；rename 不在本票感知面（Obsidian rename 触发 create+delete，产生「删除+首落」两条——现行为）。
  2. 重启基线把存量文件视为「已见」（generated=true）防首次误产；observed=false 保留「补首落」机会（v3：信/诗有日期时首次修改先补首落再 diff；flash/无日期诗直接 diff）。
  3. 结算时文件已消失（删除事件未及 diff 的竞态）→ 兜底删除观察（对齐日记 settle 兜底）；随后删除事件到达时 tracked 已清，不重复。
  4. 未跟踪文件删除跳过、无兜底文案（无日期/名称语义可兜）；信无 date / readonly 整文件不观察（含删除）。
  5. 纯空白/换行变化不产观察（避免无意义观察），但基线推进吸收空白。
  6. 首落「全文」= 结算现场当前正文（存量补首落场景记当前改后全文，旧全文在 diff 中可见）。
  7. 存量补首落 + diff 两条观察均 fire-and-forget，记忆流内顺序不保证（非契约）。
  8. 三域 trust growth 取消是用户拍板（对齐日记）；PAD note_create 轻推保留。