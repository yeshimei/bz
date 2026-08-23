# 083：卡片盒/现代诗/信 改 per-file 10 分钟结算（对齐日记模型），反省彻底去掉

- **Status**: done
- **Date**: 2026-08-24 用户拍板
- **Related**: 077 日记（模型先例，ADR-0030）、082（盲通道清空）
- **ADR**: 0035-smartcat-note-observation.md（本票新建）

## 背景

flash（卡片盒）/poem（现代诗）/letter（信）/reflection（反省）四域目前共用旧「内容快照」通道（onVaultActivity → observationText：vault create/modify 时读全文截 300 字 → 直接 addObservation，10 分钟去弹跳 + 机械去簇）。用户拍板：

1. **flash/poem/letter 改走日记模型**（per-file 10 分钟结算）：每篇 md 文件 = 一条内容，新建有字 → 静置 10 分钟生成观察；修改累计 >50 字 → 更新观察；删除 → 追加删除观察。正文**全文不截断**。
2. **reflection（反省）彻底去掉**：不再产任何反省观察。
3. 文案「去闪念描述」：卡片盒体（文案中不出现「闪念」二字）。

## 目录与文件事实（实测）

- 卡片盒/：1506 个 md（顶层层平铺，文件名如 `TDD.md`、`Apple u.md`、`1型糖尿病.md`）
- 我的/现代诗/：153 个 md，**二级年份子文件夹**（2014…2026、随机），文件名如 `161230 忧郁啊.md`（日期+标题）
- 我的/信/：15 个 md，文件名如 `第0封信.md`、`第2封信：在大理的风.md`
- 我的/反省/：5 个 md（domain 已确认），本票彻底不观察
- classifyPath 用 `p.startsWith('卡片盒')` / `'我的/现代诗'` / `'我的/信'` / `'我的/反省'` 前缀匹配，二级子目录天然命中 ✓

## 拍板规则（用户 2026-08-24 确认）

### A. 三域文案（卡片盒体；文件名去 .md 后缀保留原名；「…」= 正文全文不截断；空内容记已见不生成，补字后走首落）

| 动作 | 卡片盒 (flash) | 现代诗 (poem) | 信 (letter) |
|------|----------------|---------------|-------------|
| 首落 | `你在卡片盒记下了「TDD」：「…」` | `你写了现代诗「忧郁啊」：「…」` | `你写了一封信「第2封信：在大理的风」：「…」` |
| 更新（累计>50） | `你更新了卡片盒「TDD」：「…」` | `你更新了现代诗「忧郁啊」：「…」` | `你更新了信「第2封信：在大理的风」：「…」` |
| 删除 | `你删除了卡片盒「TDD」` | `你删除了现代诗「忧郁啊」` | `你删除了信「第2封信：在大理的风」` |

- 文件名：去 `.md` 后缀，保留原名（含日期前缀、标点）
- 更新观察文本带**新正文全文**（对齐日记「你更新了日记…：<新正文>」——改后全文）
- 更新判定：累计字数 = 每次结算累加（当前长度 − 上次生成基线，中文按字符数），**>50 才生成更新观察**并重置基线/累计；≤50 不生成但计入累计
- 删除观察仅追加（原观察保留）；文件删除时**从未跟踪过该文件** → 不产删除观察（无法知道内容），仅跳过
- source：`'flash'` / `'poem'` / `'letter'`（memory stream 现有 source 名）

### B. reflection 彻底去掉

- `classifyPath`：删除 `if (p.startsWith('我的/反省')) return 'reflection';` 行（返回 null，不再分类）
- `observationText`：删除 `case 'reflection'` 分支（及对应文件读取逻辑）
- `ActivityKind` union：移除 `'reflection'` 成员（检查无其他引用后移除；若 tsc 报错保留成员但不再产生，以 tsc 0 错误为准——优先移除，onsVaultActivity 无 reflection 引用则删）
- 已有 5 个反省文件不迁移不观察（用户拍板）

### C. 方法（对齐日记模型，per-file 结算，纯 smartcat 侧）

仿 `src/smartcat/index.ts` 日记链路（ticket 077，L1073-1240）做通用 per-file 结算：

- **新文件 `src/smartcat/note-source.ts`**：纯函数层（对齐 diary-source）：
  - `noteFirstText(kind, name, body)` / `noteUpdateText(kind, name, body)` / `noteDeleteText(kind, name)`（kind 枚举 flash/poem/letter，一张文案表）
  - `decideNoteSettle(kind, name, body, state)`：首落有字判定 + 累计增量 >50 更新判定（对齐 decideDiarySettle 语义；不需要 diary 的 tag 维度）
  - `buildNoteBaseline(...)` 辅助（可选）
  - 输出后缀：正文全文不截断
- **index.ts 新链路**（对齐日记）：
  - `noteTimers: Map<filePath, {timer, generated, baseline, accum}>`（per-file key = filePath；DIARY_KEY_SEP 或复用分隔符）
  - `noteTracked: Map<filePath, string>`（上次快照 body，用于 modify diff + delete 感知）
  - `resetNoteTimer(filePath, kind)`：修改 → 重置 10 分钟计时
  - `settleNoteFile(filePath, kind)`：静置到期 → 读文件 → 判首落/更新 → 产出观察（fire-and-forget，对齐日记 appendVector 坑）→ 推进状态
  - `onNoteVaultDelete(file)`：vault delete → classifyPath 命中三域 → 跟踪过的产删除观察 + 清计时；未跟踪跳过
  - `buildNoteBaseline()`：ensure 时扫三目录全部 md（vault.getFiles 过滤前缀 + .md）→ 有字记已见（generated=true）、无字待首落，不装计时器（事件才起动）
  - 挂载：`onVaultActivity` 里 `kind === 'flash' | 'poem' | 'letter'` → 走新链路（替换 observationText 分支；原三域的 10 分钟去弹跳/机械去簇/信任成长不再执行，对齐日记 077 的处理）；`kind === 'reflection'` → 直接 return（短路；classifyPath 已不产该值，防御性保留或删除视 tsc）
  - PAD：flash/poem/letter 原 vault 正向轻推是否保留？**对齐日记拍板：日记保留 note_create 轻推，flash/poem/letter 同保留**（`moodSystem.handleInteraction('note_create', 0.5)` 在早退分支内，对齐日记链路写法）
  - vault delete 监听：077 已挂（onVaultDelete）——检查现有实现是否只处理 diary，扩展到三域（一个监听函数分派）
  - unload：noteTimers 全清 + noteTracked 清（对齐日记清理）
  - 测试钩子：`__setNoteSettleMsForTests` / `__getNoteTimersForTests`

### D. 测试

- `tests/smartcat/note-source.test.ts`：文案表（3 域 × 3 动作）、文件名去后缀、首落有字判定、累计 >50/≤50、更新全文、空文件记已见
- `tests/smartcat/note-action.test.ts`：per-file 计时链路（60ms 注入）——新建有字 → 到期首落；修改重置；累计 >50 → 更新；删除（vault delete 事件）→ 删除观察；空文件不产
- `tests/smartcat/context-source.test.ts`（如存在）或既有测试：reflection 不再分类、observationText 无 reflection 分支
- domain-source：无涉（082 已清空）

### E. 文档

- `docs/adr/0035-smartcat-note-observation.md`
- `CONTEXT.md` 追加卡片盒/现代诗/信观察词条（含反省移除）
- `.scratch/memo-suite-plugin/spec.md` / `PROGRESS.md` 追加

## 注意（先例坑）

- **addObservation fire-and-forget**：appendVector 探测 Ollama 在无向量环境不 resolve，`void mem.addObservation(...)` 后立即推进结算状态（日记 077 踩过）
- **重启基线**：首次 ensure 建快照不产出（防重启后旧文件当首次），基线先于监听挂载
- **CRLF/LF**：新建文件一律 pwsh WriteAllText UTF-8 无 BOM（write 工具 exFAT EISDIR）
- **git safe.directory**：两段式参数 `-c` `safe.directory=E:/Obsidian/bz/.dsh-worktrees/worktree/note-observation`
- **并行 worktree 注意**：081 library 子代理正在改 domain-source.ts/index.ts/context-source.ts（不同 worktree，不冲突）；本票 worktree 在 master HEAD 932604b 基础上
- **.scratch 文件**：git add -f 强制加入

## 门禁

- npm test 全绿（现 1538 tests）+ `npx tsc --noEmit` 0 错误
- 兼容冻结：不改卡片盒/诗/信 md 内容结构、不改 flash/poem/letter 域代码（context-source 的 observationText 部分分支删除属 smartcat 侧收敛）
- 提交：`feat(smartcat): 卡片盒/现代诗/信改 per-file 日记模型观察，反省移除（ticket 083）`（建议）
---

# 083 修订 v2（用户 2026-08-24 追加拍板，以本段取代/补充上文对应条目）

## 背景（用户提问引发的修订）

1. 信往往非常长（实测《阿尼玛》类四五千字），**修改时带新正文全量入观察太重**——应落实**差异**（改了什么、删了哪部分）。
2. 存量信（域观察上线前已写、从未有首落观察）被修改时应可直接产修改观察（有基线即可 diff，不需要补首落）。

## 差异观察规则（三域统一：卡片盒/现代诗/信）

1. **首落（新建）不变**：有字 → 带**全文**观察（长信也带全文——用户拍板「首落带全文」）。
2. **更新（修改）改为段落级 diff 摘要（不再带新全文）**：
   - 触发：**任何正文内容变化**（不再用累计 >50 字阈值——用户拍板「有变化就发」；10 分钟静置结算仍负责把窗口内连续编辑合并为一次 diff 观察）
   - 纯函数 `noteDiffSummary(kind, name, baseline, current)`：
     - 段落切分（空行分段 `/\n{2,}/` 之类，trim 后非空段）
     - **段落级 LCS 匹配**（段全文相等配对）：未配对的旧段 → 删除（**旧文档段号**）；未配对的新段 → 新增（**新文档段号**）；相邻删除块/新增块 → 用相似度判定「修改段」（逐段字符重叠率 ≥0.5 = 修改，报旧段号；否则按删除/新增分别报）
     - 每类（删除/新增/修改）最多列 **3 段**，超出 → 「等 N 处」
     - 片段截断：删除/新增段展示**前 50 字**（超长加「…」）；修改段展示**旧前 30 字 → 新前 30 字**
   - 文案（三域统一句式，动词「修改」）：
     - `你修改了卡片盒「TDD」：删除了第 3 段「原文前50字…」、新增了第 5 段「新文前50字…」`
     - `你修改了现代诗「忧郁啊」：修改了第 1 段「旧前30字…」→「新前30字…」`
     - `你修改了信「阿尼玛」：删除了第 2 段「…」；等 1 处新增`
     - 分隔符：同类多项「、」，异类「；」；无变化（空 diff）→ 结算不产观察但推进状态
3. **存量文件基线**（重启基线语义不变）：首次 ensure 扫描全部现存 md → 有字条目记已见（generated=true, baseline=当前全文）——修改时与基线 diff 自然产出「你修改了…」观察（用户拍板：直接 diff，不补首落）。
4. **删除观察不变**：`你删除了卡片盒「TDD」`（三域同句式，仅删除不列段）。

## 实现调整（在 v1 要点基础上）

- `note-source.ts` 新增/改造：
  - `noteDiffSummary(kind, name, baseline, current): string | null`（纯函数；无变化 null）
  - `decideNoteSettle` 调整：首落分支不变（全文）；已生成分支由「累计 >50 更新」改为「当前正文 !== 基线 → 产 noteDiffSummary；否则不产」；next.baseline 始终 = 当前正文（diff 后基线推进到新全文）；**不再需要 accum 字段**（或保留为 0，以 tsc 干净为准——倾向直接移除 accum，同步 NoteTimerState 结构）
  - 文案动词确认：首落 `你在卡片盒记下了「X」：「<全文>」`；更新 `你修改了卡片盒「X」：<diff 摘要>`；删除 `你删除了卡片盒「X」`（现代诗/信同构）
- `note-source.test.ts` 新增 diff 用例：删段/增段/改段/多段截断「等 N 处」/段号旧新档语义/无变化 null/长段前 50 字/修改段前 30 字
- `note-action.test.ts`：有变化就发（小改动如改一个字也产 diff）；窗口内连续编辑合并一次；存量基线修改 → 直接修改观察不补首落
---

# 083 修订 v3（用户 2026-08-24 再追加拍板——存量文件首落带真实日期）

## 用户指出的事实（实地核实过 vault）

1. **信 15/15 全部有 frontmatter `date:`**（如 `2026-06-17 23:44`、个别 ISO `2026-07-06T12:14:00`）——存量信写作日期**可靠**。**用户拍板：信只有存在 date 属性才会观察**（无 date 的信不跟踪不观察——当前 15 封全覆盖，防御性规则）。
2. **现代诗**日期来源三层（实测 vault）：
   - 优先 frontmatter `date:`（2026 新诗有）
   - 无 frontmatter → 文件名 `YYMMDD` 前缀（2014-2024 老诗：`161230 忧郁啊.md` → 2016-12-30，时间缺省 08:00）
   - 无 YYMMDD → **父目录名 = 年份** + 文件名 `MMDD`（2025-2026：`2026/0115.md` → 2026-01-15，时间缺省 08:00）
   - 全部无（理论上不存在）→ 不补首落、只产修改观察
3. **日记**：文件名 `YYYY-MM-DD.md` + 标题 HH:mm（既有，不动）。

## v3 规则（配合 v2 差异观察；只改首落/存量部分）

1. **存量信首次被修改** → **先补首落观察**：`你在 <frontmatter date 格式化 YYYY-MM-DD HH:mm> 写了一封信「<name>」：<全文不截断>`（对齐日记文案时间语义；长信也全文——用户拍板「首落带全文带日期」），**再**产修改 diff 观察 `你修改了信「<name>」：<diff>`（v2 规则）。
2. **首落文案带真实日期**（新建信、存量信补发统一）：
   - 信：`你在 <date> 写了一封信「NAME」：<全文>`（date = frontmatter 解析；ISO/空格两式兼容，格式化 `YYYY-MM-DD HH:mm`）
   - 现代诗：`你在 <date> 写了一首现代诗「NAME」：<全文>`（日期解析按三层回退；frontmatter 带时间的保留时间，文件名只有日期的 08:00 占位）
   - 卡片盒：无日期概念（卡片无 frontmatter/文件名日期）→ **维持无日期文案** `你在卡片盒记下了「NAME」：「<全文>」`（不对齐时间语义，卡片盒本就无 date）
3. **首落触发条件变化**：
   - 信：文件有 frontmatter date 才观察；无 date → 该文件不跟踪（首落/修改/删除均不产）
   - 现代诗：无任何日期来源时不补首落，但修改/删除观察仍可产（差异观察不依赖日期）
4. 首落/补发状态：`generated=true, baseline=当前全文`（与 v2 相同），后续修改走 diff。

## 实现调整

- `note-source.ts`：新增 `parseNoteDate(kind, content, filePath): string | null`（信 frontmatter date / 现代诗三层回退 / flash 恒 null）+ `formatNoteDate(raw)`（YYYY-MM-DD HH:mm）；首落文案 three kinds 三句式（信/诗带日期、卡片盒不带）；基线在 ensure/结算时把解析出的 date 存入 noteTracked 状态（`{kind, body, date}`）
- 判定：信无 date → 不跟踪（reset/settle 早退）；现代诗无 date → 首落不产（待补字？不——无日期现代诗首落跳过但 generated 置 true 防重复，修改照产 diff）
- 测试：信 frontmatter 两格式（空格/ISO）、无 date 信不观察、现代诗三层日期回退（frontmatter/YYMMDD/父目录+MMDD）、存量信修改先补首落（带真实日期+全文）再 diff、卡片盒无日期
---

# 083 修订 v4（用户 2026-08-24 追加——readonly 信件不观察）

## 规则

信 frontmatter 含 `readonly: true`（实测仅第 0 封信）→ **该文件不观察**：不跟踪、首落/修改/删除均不产。与「无 date 不观察」并列的过滤条件：**信的观察条件 = frontmatter 存在 date 且无 readonly:true**（date 必须、readonly 禁；现代诗/卡片盒无此字段约束）。

## 实现

- `note-source.ts`：readonly 判定并入跟踪过滤——信的准入：`parseNoteDate` 非 null 且 frontmatter 无 `readonly: true`；`handleNoteVaultActivity`/`buildNoteBaseline`/删除感知对该文件早退（不跟踪不入表）
- 测试：readonly 信不产任何观察；其余 14 封正常