# Spec: 黑匣子域（bz 插件第 19 域）——v4 日记智能分析层

Status: `ready-for-agent`
Type: spec
Feature: blackbox-suite-plugin

> 本版由 grilling 会话（2026-08，含 `/grill-with-docs` 社区调研画像/时间线/复盘/情绪四主题）重写：**黑匣子从「容器」重构为「日记的智能分析层」**。supersedes v3 笔记化架构（ADR-0015）：三类条目（概念/摘抄/想法）与录入弹窗全部删除，黑匣子不再持有任何原始数据——数据由日记本（`我的/日记` + `我的/影视` + `我的/信`）书写，黑匣子只读日记、AI 提炼、产出派生层（blackbox.json v4）。ADR-0013/0015 作废，ADR-0014 方向反转（平行新流 → 日记分析层），新 ADR-0017。

## Problem Statement

用户（叫我包仔）的黑匣子（bz 第 19 域）经 v1（感触录入）→ v2（三类条目）→ v3（笔记化）演进后，暴露出方向性错误：**黑匣子长成了第二个容器**——有自己的录入弹窗、自己的概念/摘抄/想法条目、自己的笔记目录 `我的/黑匣子/`，与日记本「书写」体系平行重复。用户每天真正书写的载体是日记本（`我的/日记/*.md` + 影视影评 + 信），黑匣子却要求用户额外录入，负担重且内容割裂。用户决策：**黑匣子不做容器、不录入、不持有原始数据；数据仍由日记本书写，黑匣子只读日记、AI 提炼、产出派生层**（人物画像/事件时间线/情绪聚合/复盘/对话记忆），日记是唯一事实源。

## Solution

bz 域 `src/blackbox/`（v3 重构为 v4 分析层）：

- **数据流（单向）**：日记流（三目录）→ vault modify/create 监听（防抖 30 分钟）→ 增量提炼（一次 AI 调用批量处理新增条目，输出人物提及/事件候选/情绪推断）→ 落盘 `CONFIG/STORAGE/blackbox.json` v4（profiles/mentions/events/reviews/chat/cursor/settings）→ 呈现（对话 open / 三标签面板 panel / 复盘 review 手动）。
- **删除**：录入弹窗（capture）与 `bz-blackbox-capture` 命令、三类条目（概念/文献/想法）、概念墙/文献架/想法池、`我的/黑匣子/` 笔记目录（已删）、v3 entries 索引与 `persona` 段（并入 profiles/chat）。
- **保留并改造**：对话（三层记忆 = 日记条目 TF-IDF 检索 + 画像概要 + 对话历史）、人物画像（从日记提炼，provenance 分层）、事件时间线（从日记提炼，证据链跳转）、复盘（纯手动，JSON 落盘）、情绪（24 词表，AI 推断）。
- **首次启用**：历史全量提炼（分批 50 条/批串行 + 进度通知）→ 之后增量。
- **复用**：日记读取复用 `src/diary/parser.ts` 纯函数（parseFile/parseMovieFile/parseLetterFile）与 `src/diary/config.ts` 目录常量（DIARY_DIRECTORY/MOVIE_DIRECTORY/LETTER_DIRECTORY），不重造扫描轮子；黑匣子自建轻量目录扫描（三目录枚举 + vault.read）。

### 领域模型

- **日记条目 (Diary Entry)**：事实源单元。`{date, time, timeValue, tags, emoji, content, filename, lineNumber, id}`（diary/types.ts 既有形状）。黑匣子只读不写。
- **人物画像 (Profile)**：从日记正文 AI 提炼的人物。**provenance 分层**（社区 Tri-Color Trust 模型）：`impression`（印象区，用户主权，字段级锁，AI 永不覆盖）+ `aiObservations[]`（AI 观察区，持续更新，可采纳进印象区）。画像 = 派生层，不建笔记。
- **人物提及 (Mention)**：未建画像的人物计数候选 `{name, count, firstSeen, lastSeen}`。出现 ≥2 次（跨不同日期）自动建画像；单次出现只计数，复盘时提示「新人物」可一键确认建画像。
- **事件 (Event)**：从日记条目提炼的独立语义单元（一条日记可提炼多个事件）。`{id, title, date(ISO), datePrecision, people[], emotions[], source:{path,lineNumber,time}, confidence, status(confirmed|speculative), humanEdited}`。
- **复盘 (Review)**：手动触发（`bz-blackbox-review` 命令 + 面板按钮），对一段时期日记做聚合分析，产物 **JSON 落盘 `reviews[]`**（不建笔记），四段结构化（人物画像更新 / 事件汇报 / 情绪聚合 / 反思建议），每条**事实锚定**（引用日期+原文片段），杜绝泛化套话。复盘产物同步显示在对话流。
- **对话 (Chat)**：`{role, content, ts}`。三层记忆：日记条目 TF-IDF 检索（top-k）+ 画像概要（名字+印象一句话+最近事件标题）+ 对话历史（maxHistory）。
- **情绪 (Emotion)**：24 词表（冻结，可编辑），AI 推断输出 1–3 词，推断失败不标注。聚合呈现：时间线标签（事件情绪色点 + 时段分布条）+ 复盘流标签（情绪趋势段）。

### 命令 id 全清单

| id | 动作 | 说明 |
|---|---|---|
| `bz-blackbox-open` | 打开对话面板（中央弹窗，意识体交流） | 外部约定，保留 |
| `bz-blackbox-panel` | 打开三标签派生面板（人物墙/事件时间线/复盘流） | 外部约定，保留（语义变化：流式条目 → 派生层） |
| `bz-blackbox-review` | 手动触发复盘 | 外部约定，保留（语义变化：阈值自动 → 纯手动聚合） |
| ~~`bz-blackbox-capture`~~ | ~~打开录入弹窗~~ | **删除**（v4 无录入） |
| ~~`bz-blackbox-capture-concept/-literature/-thought`~~ | ~~直达三类录入~~ | **删除** |
| ~~`bz-blackbox-import-cardbox`~~ | ~~导入卡片盒~~ | **删除**（v4 无条目导入） |

命令图标：`brain`。域内不重复 addCommand，仅在 main.ts COMMANDS 表注册一次（ADR-0004）。

### 设置项总表（域设置弹窗 ⚙️，6 项）

| 项 | 默认 | 说明 |
|---|---|---|
| AI 服务商 | deepseek | deepseek / ollama 两档（跟随全局 AI 配置时优先全局） |
| Ollama URL | http://localhost:11434 | 本地 Ollama 地址 |
| Ollama 模型 | qwen2.5:14b-instruct | 本地模型名 |
| 对话历史保留条数 (maxHistory) | 20 | 对话记忆短期层上限 |
| 推测事件显示 (showSpeculativeEvents) | 开 | 时间线是否显示推测事件 |
| 情绪词表 (words) | 24 词内置 | 可增删（存 blackbox.json settings 段） |

**已删除设置**：`blackboxReviewThreshold`（自动复盘阈值——复盘改手动后无意义）、`blackboxDefaultTypeFilter`（默认类型筛选——三类条目删除后无意义）。

### 情绪词表（24 词预置，冻结）

触动、温暖、喜悦、平静、释然、难过、孤独、委屈、焦虑、愤怒、敬佩、想念、遗憾、感激、害怕、心动、幸福、骄傲、迷茫、疲惫、厌烦、羞耻、嫉妒、希望

### 数据格式（冻结）

#### blackbox.json v4

> v3 数据已由用户决策一次性删除（2026-08，本会话执行：`我的/黑匣子/` 1492 文件 + blackbox.json 已清除）。v4 load 时 version===3 直接初始化空派生层（旧数据不再读取；若检测到残留 v3 文件，jsonStore 坏 JSON 备份语义保留）。

```jsonc
{
  "version": 4,
  "settings": {
    "words": ["触动", "温暖", "喜悦", "平静", "释然", "难过", "孤独", "委屈", "焦虑", "愤怒", "敬佩", "想念", "遗憾", "感激", "害怕", "心动", "幸福", "骄傲", "迷茫", "疲惫", "厌烦", "羞耻", "嫉妒", "希望"],
    "showSpeculativeEvents": true
  },
  "profiles": [
    {
      "id": "pf_<ts>_<rand>",
      "name": "妈妈",
      "aliases": ["妈", "母亲"],
      "impression": "用户区：用户编辑的固定印象（字段级锁，AI 不覆盖）",
      "aiObservations": [{ "ts": "ISO8601", "text": "AI 观察：本周日记多次提到妈妈支持…", "source": { "path": "我的/日记/2026-08-14.md", "lineNumber": 3, "time": "08:30" } }],
      "emotions": [{ "tag": "温暖", "count": 3 }],
      "mentionCount": 12,
      "firstSeen": "2026-08-01",
      "lastSeen": "2026-08-14",
      "humanEdited": false
    }
  ],
  "mentions": [
    { "name": "老张", "count": 1, "firstSeen": "2026-08-14", "lastSeen": "2026-08-14" }
  ],
  "events": [
    {
      "id": "ev_<ts>_<rand>",
      "title": "搬家完成",
      "date": "2026-08-10T18:00:00",
      "datePrecision": "time",
      "people": ["pf_<ts>_<rand>"],
      "emotions": ["疲惫", "释然"],
      "source": { "path": "我的/日记/2026-08-10.md", "lineNumber": 5, "time": "18:00" },
      "confidence": 0.85,
      "status": "confirmed",
      "humanEdited": false
    }
  ],
  "reviews": [
    {
      "id": "rv_<ts>_<rand>",
      "createdAt": "ISO8601",
      "period": { "from": "2026-08-01", "to": "2026-08-14" },
      "report": {
        "profileUpdates": ["妈妈（提及 12 次）：印象更新为…（引用 2026-08-10 日记）"],
        "eventSummary": ["搬家完成（8/10）", "新人物提示：老张（提及 1 次）"],
        "emotionTrend": "本周情绪以疲惫为主，周末转释然…",
        "reflections": ["搬家后作息调整…"]
      },
      "newPeople": ["老张"]
    }
  ],
  "chat": [
    { "role": "user", "content": "…", "ts": "ISO8601" },
    { "role": "assistant", "content": "…", "ts": "ISO8601" }
  ],
  "cursor": { "file": "我的/日记/2026-08-14.md", "entryIndex": 3 }
}
```

- `cursor` 增量游标：`{file, entryIndex}`——已处理到的文件路径 + 该文件已处理的条目序号（parseFile 产出顺序即序号）。重命名/删除日记文件时 cursor 失效回退重扫该文件。
- `persona` 段删除：人设（名字/种子/语气示例/selfViews）移入代码常量（包仔人设保留），对话自我认知由 profiles + reviews 承载。
- id 前缀：`pf_`（画像）/ `ev_`（事件）/ `rv_`（复盘），格式 `<前缀>_<ts>_<rand>`（沿用 v2 惯例）。

### 增量提炼链路

- **监听**：`vault.on('modify'/'create')` 覆盖三目录（前缀边界判断，沿用 diary/store.ts onFileChange 同款 inDir 语义）；**防抖 30 分钟**（用户决策，Q5）；内部更新防回环（黑匣子不写日记，天然无回环，但监听仍须跳过非三目录文件）。
- **触发条件**：防抖到期 或 用户打开黑匣子（open/panel/review 任一命令）时若有待处理条目 → **先即时提炼再渲染**（Q8）。
- **提炼调用**：一次 AI 调用批量处理新增条目，JSON 返回 `{people:[{name, aliases[]}], events:[{title, confidence, emotion, people[]}], emotions:[{entry, tags[]}]}`；失败跳过重试（下次增量再试），永不拒收。
- **首次全量**：cursor 为空且日记存在 → 扫描三目录全量条目 → 分批（50 条/批）串行提炼 + 进度通知（「正在提炼历史日记… N/M」）。
- **增量后处理**：mentions 计数累加（≥2 次跨不同日期 → 自动建画像，AI 观察区给初始印象）；事件按置信度分级入库（≥0.7 入线 confirmed / 0.5–0.7 推测 speculative / <0.5 不入库）+ 标题+证据双重去重；emotions 推断写入对应事件/聚合计数。

### 事件证据链跳转

- 证据链 `source: {path, lineNumber, time}` 落盘；跳转 = 打开日记文件 + 定位条目（复用日记本定位能力/滚动到 lineNumber），不存 `[[日期#HH:mm]]` 双链（重名标题不可靠，行号定位更稳，Q7）。

### 画像与事件防幻觉（社区调研落地）

- **画像门槛**：提及 ≥2 次（跨不同日期）自动建画像；单次只入 mentions；复盘「新人物提示」一键确认建画像（Q12/Q13）。
- **事件分级**：AI 自评 confidence ≥0.7 直接入线；0.5–0.7 推测（虚线+❓ 可确认/删除）；<0.5 不入库（Q3）。
- **humanEdited 锁**：用户编辑画像/事件后标记 `humanEdited: true`，AI 重提炼跳过该对象（改过不再碰）。
- **事件去重**：标题 + 证据（source 路径+行号）双重去重。

### 复盘（纯手动）

- 触发：`bz-blackbox-review` 命令 + 面板按钮；**无定时自动复盘**（Q9，重 AI 调用 + 刚去容器化宜收敛）。
- 输入：period（默认自上次复盘以来 / 可选全量）+ 该时期日记条目（先本地凝缩：去重、抽关键片段、按人物/事件/情绪分组，再一次性调 AI——社区成本控制共识）。
- 产物：JSON 落盘 `reviews[]` 四段（人物画像更新/事件汇报/情绪聚合/反思建议），每条**事实锚定**（引用日期+原文片段，杜绝泛化套话）；同步显示在对话流（用户可见、可追问）。
- 副作用：复盘时聚合画像印象（AI 观察区追加，上限 5 条裁旧，不覆盖用户印象区）+ 新人物提示（mentions 高频未建画像人名）。
- 失败降级：提炼失败不阻断复盘，部分成功照常落盘。

### 对话（三层记忆）

- 检索层：日记条目 TF-IDF（沿用 v1 TF-IDF 机制，索引对象从感触条目 → 日记条目；load 时构建 + 缓存，复用 v2 水合缓存模式）。
- 画像概要：名字 + 印象一句话 + 最近 3 个事件标题（预算截断）。
- 对话历史：maxHistory 条。
- 人设：包仔「种子（有诗心的思辨者）+ 语气示例」保留（代码常量）。

### 三标签面板（panel）

- **header**：左标题「黑匣子」；右动作区 👤人物 / 🕐时间线 / ⚙️设置 / ❌关闭（⚙️ 弹窗 = 6 项设置）。
- **标签一 · 人物墙**：画像卡（名字/印象一句话/AI 观察区摘要/情绪聚合/事件数），点击展开详情（印象编辑采纳、AI 观察采纳/移除、事件投影、情绪聚合）。
- **标签二 · 事件时间线**：沿用 v2 形态——事件卡（日期+标题+人物+情绪色点+证据链展开），推测虚线+❓ [✓确认][✕删除]，人物/年份筛选，showSpeculativeEvents 开关；新增时段情绪分布条。
- **标签三 · 复盘流**：reviews 列表（时间倒序，卡片显示周期+摘要，点击展开四段报告）。
- 移动端：沿用日记本双断点（768px 圆角顶 95% + 标签横滚 / 480px 全屏）。
- DOM 约定：`#bz-blackbox-panel` 保留。

### 降级链

1. **AI 不可用**：增量提炼跳过（下次重试）、复盘失败提示、对话降级为关键词/最近日记文本检索（沿用 v2 检索兜底）；浏览（面板/时间线/画像/复盘流）始终可用。
2. **AI 部分失败**：DeepSeek 失败回退 Ollama（沿用闪念模式）；单条失败不影响已落盘内容。
3. **日记文件缺失/损坏**：parse 失败条目跳过；cursor 指向不存在的文件 → 回退重扫；blackbox.json 解析失败 → 空库初始化并备份坏文件（jsonStore 语义）。
4. **情绪推断失败**：不标注（不瞎标）。

### 边界与后续（不在本版）

- 定时周报（Q9 决策：纯手动，未来若要加开关即可）
- 遗忘权：画像删除/断链、事件忽略持久化清单（v2 后置项仍后置）
- 事件实际发生时间推断的校准（初版用记录日期）
- 次级内容接入（ADR-0014 演化路径——v4 已接入日记，备忘录/剪藏等仍未来）
- 4218 处 `[[我的/黑匣子/…]]` 断链：不管（Q11，仅显示断链不影响功能）

## Implementation Decisions

- **日记即事实源**（ADR-0017）：黑匣子零录入零持有；日记（三目录）是唯一事实源，blackbox.json v4 只存派生层（profiles/mentions/events/reviews/chat/cursor/settings）。ADR-0013（三类条目 schema）、ADR-0015（笔记化）作废；ADR-0014 方向反转（平行新流 → 日记分析层）。
- **复用 diary 解析层**：黑匣子读日记复用 `src/diary/parser.ts` 纯函数 + `src/diary/config.ts` 目录常量（显式 import，铁律 6 域间共享），不重造扫描轮子；自建轻量三目录扫描（枚举 + vault.read）。
- **provenance 分层**（画像）：印象区（用户主权，字段级锁）+ AI 观察区（持续更新可采纳）；`humanEdited` 标记后 AI 跳过。
- **事件置信度两级**：≥0.7 入线 / 0.5–0.7 推测 / <0.5 不入库（Q3，三级降两级：日记时间锚可靠，不确定在校验"是事件 vs 流水账"）。
- **复盘产物 JSON 化**：不建笔记（黑匣子去容器化原则），四段结构化落盘 `reviews[]` + 对话流可见（Q1）。
- **增量防抖 30 分钟** + 打开时即时提炼双触发（Q5/Q8）。
- **一次 AI 调用批量提炼**（Q5）：新条目合并一次调用，JSON `{people, events, emotions}`。
- **v4 schema 冻结**（Q14）：字段落盘即不可改（铁律 1）。
- **证据链**：`{path, lineNumber, time}` 行号定位跳转（Q7），不依赖标题双链。
- **设置 6 项**（Q10）：删 typeFilter/reviewThreshold。
- **命令**：删 capture ×4 + import-cardbox；保留 open/panel/review（Q15）。
- **三标签面板**：人物墙/事件时间线/复盘流（Q16）。

## Testing Decisions

延续既有测试栈（vitest + jsdom + MockVault + mock-obsidian-entry + mock fetch），测试缝已与用户确认（2026-08）：

- **数据层缝**（重写 `tests/blackbox/data.test.ts`）：blackbox.json v4 读写、cursor 推进与失效回退、mentions 门槛（≥2 次跨日期建画像）、humanEdited 锁、事件去重、置信度分级入库。复用 MockVault 内存文件树。
- **提炼缝**（重写 `tests/blackbox/ai.test.ts`）：mock fetch（AIService）断言批量条目 → prompt 构造 → JSON 响应解析（{people, events, emotions}）→ 置信度分级 → 失败跳过重试。**新核心缝**。
- **日记读取缝**（新增，可并入 data.test.ts）：复用 diary/parser 读三目录 → 条目流 → 加密条目/空内容过滤 → cursor 比对增量。
- **UI 缝**（重写 `tests/blackbox/panel.test.ts`/`chat.test.ts`/`review.test.ts`）：三标签面板 jsdom 交互（人物墙展开、时间线确认/删除、复盘流展开）、对话三层记忆（mock fetch）、复盘四段渲染与事实锚定。
- **监听缝**（重写 `tests/blackbox/sync.test.ts`）：vault modify/create 监听 + 30 分钟防抖 + 打开时即时提炼。沿用 auto-summary/mock-vault 事件触发先例。
- **删除的旧缝**：capture.test.ts / capture-epub.test.ts / notes.test.ts / import-cardbox.test.ts / panel-source-jump.test.ts / source-jump.test.ts / inject.test.ts / host-register.test.ts / v3-seed.ts（对应删除的录入/笔记化/导入/书内选区功能）。
- **smoke.test.ts**：命令清单黑匣子 4 → 3（删 capture，保留 open/panel/review）。
- **测试原则**：只测外部行为（渲染结果、数据落盘、事件副作用），不测实现细节；每批交付对照设计逐项验收。

## Out of Scope

- **定时复盘周报**：纯手动（Q9），后续加开关即可
- **遗忘权**：画像删除/断链、事件忽略持久化清单（后置）
- **事件实际发生时间推断校准**（初版用记录日期）
- **次级内容接入**（备忘录/剪藏等，ADR-0014 演化路径）
- **断链清理**：4218 处 `[[我的/黑匣子/…]]`（Q11 不管）
- **对话人设扩展**：包仔人设保留现状，不做新人格开发
- **移动端专项适配**：沿用日记本双断点，不做更多

## Further Notes

- 本次 grilling 决策全记录：Q1 复盘=JSON 落盘 / Q2 画像分层 / Q3 事件两级置信度 / Q4 24 词表+情绪入时间线复盘 / Q5 一次调用+防抖 30 分钟+全量分批 50 / Q6 存量已删 / Q7 证据链行号 / Q8 打开即时提炼 / Q9 纯手动复盘 / Q10 删 2 留 6 设置 / Q11 断链不管 / Q12 画像 ≥2 次门槛 / Q13 mentions 落盘 / Q14 v4 schema 冻结 / Q15 对话记忆+命令+人设确认 / Q16 三标签面板确认。
- 社区调研报告落盘：`.scratch/timeline-research-blackbox.md`（事件时间线）、`.scratch/blackbox/emotion-design-research.md`（情绪）；画像/复盘调研全文在 grilling 会话记录（Semantica/Tri-Color Trust / Rosebud 周报 / SANE / simple-graph-builder 等）。
- 存量清理已执行：`我的/黑匣子/`（1492 文件）+ `CONFIG/STORAGE/blackbox.json` 已删除（2026-08 本会话，不可回滚）。
