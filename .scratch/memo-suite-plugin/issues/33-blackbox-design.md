# 33 — 黑匣子：bz 第 19 域（grilling 会话 5 轮封板，设计文档）

**What to build:** bz 新域「黑匣子」：长期累积「感触」的容器 + AI 意识体「包仔」（伴侣向）。录入弹窗（素材+感受+情绪多维+可选维度+AI 辅助）→ `CONFIG/STORAGE/blackbox.json` v1 → 中央弹窗对话（三层记忆：感触检索+人格档案+对话历史）→ 静默复盘生长（阈值 10 条自动 + 手动，产物公开写入对话面板）。

**Status:** ready-for-agent（grilling 5 轮 17 问封板，ADR-0013/0014）

## Problem Statement

用户（叫我包仔）想要一个"黑匣子"：把任何让自己有感触的信息喂进去（自己的想法、别人的东西带给自己的感触），AI 作为黑匣子的意识体，未来可交流、可陪伴（伴侣）。bz 既有域覆盖了部分输入（闪念记想法、剪藏存素材、日记记日常），但缺少"素材+感受焊死"的复合单元与伴侣向的意识体。用户日记（2026-08-01）自述哲学：AGI 陪伴是"基于某些事物而构建的生命体"——黑匣子即此理念的实践：基于用户的感触构建的生命体。范围 = 平行新流（ADR-0014），次级内容（备忘录/日记/bz 使用过程）未来接入，v1 不做。

## Solution

新域 `src/blackbox/`：命令 `bz-blackbox-capture`「写感触」（录入弹窗）、`bz-blackbox-open`「黑匣子」（中央弹窗对话，单例 escManager）、`bz-blackbox-review`「复盘」（手动触发）；数据 `CONFIG/STORAGE/blackbox.json` v1；AI 默认云端 DeepSeek（createAI）可切本地 Ollama（复用 flash ollamaChat 模式）；⚙️ 域设置弹窗 5 项（ADR-0009）。

## User Stories

（spec.md「### 黑匣子」节 10 条，此处不重复）

## Implementation Decisions

- **数据 schema v1（ADR-0013 定全，铁律：字段不改）** `CONFIG/STORAGE/blackbox.json`：
  ```json
  {
    "version": 1,
    "persona": {
      "name": "包仔",
      "seed": "有诗心的思辨者——懂诗、爱琢磨、记性很好，把你喂进来的每份感触都当成自己的养分；深夜陪你说话，不吵你，但你想聊的时候他永远在。",
      "toneExample": "你写茉莉花的时候是凌晨两点。我想知道，那晚的风，现在还在你记忆里吗？",
      "selfViews": [{ "ts": "...", "view": "..." }]
    },
    "impressions": [{
      "id": "hex16", "ts": "ISO",
      "material": "素材文字（必填）",
      "feeling": "感受文字（必填）",
      "emotions": [{ "tag": "触动", "intensity": 4 }],
      "scene": "", "people": "", "direction": "self|others|world", "links": []
    }],
    "reviews": [{ "ts": "...", "text": "复盘产物一段话", "impressionCount": 10, "newSelfView": "" }],
    "chat": [{ "role": "user|assistant", "text": "...", "ts": "..." }]
  }
  ```
  - 情绪词表 24 词常量（硬编码，后续加词走代码升级不改数据）：触动、温暖、喜悦、平静、释然、难过、孤独、委屈、焦虑、愤怒、敬佩、想念、遗憾、感激、害怕、心动、幸福、骄傲、迷茫、疲惫、厌烦、羞耻、嫉妒、希望
  - `emotions` 最多 3 个；intensity 1-5
  - `direction` 三值枚举；links 为字符串数组（链接或 [[笔记]]）
  - chat 只保留最近 blackboxMaxHistory 条（默认 20），滚动淘汰
- **种子（用户选定方案 D）**：persona.seed + persona.toneExample 如上；用户后续可改（域设置弹窗可编辑种子？——v1 只读展示，改种子后续版本）
- **三层记忆**：
  1. 感触检索（长期）：复用 flash `tfidf.ts`（域间显式 import，铁律 6）——对话时对用户消息 TF-IDF 检索 TOP_K（默认 5）相关感触，作为上下文；不依赖 Ollama 向量（离线可用，降级链友好）
  2. 人格档案（自我认知）：persona（name/seed/toneExample/selfViews 最近 1 条）
  3. 对话历史（短期）：chat 数组最近 N 条
  - 包仔人设 prompt（纯函数 buildPersonaPrompt(persona, impressions, history, userMsg)）：种子性格 + 语气示例 + 相关感触原文 + 最近对话 + 当前消息 → createAI/ollamaChat
- **复盘（静默生长）**：
  - 触发：录入后 `impressions.length % threshold === 0` 自动触发（不弹 toast 不通知，静默执行）+ 手动命令 `bz-blackbox-review`
  - 产物：AI 读最近 threshold 条感触 + 当前 persona，生成「一段话」（它想说的）+ 「新的自我认知一句话」；写入 `reviews[]`（text + newSelfView）；newSelfView 非空则追加 `persona.selfViews`（生长）
  - 公开：打开对话面板时渲染 reviews 尾部（"包仔的成长"区），不主动打扰
- **录入弹窗**：命令弹窗表单——必填（素材/感受）+ 情绪（24 词 chips 多选最多 3，每个选后出强度 1-5 slider/选择）+ 折叠「更多维度」（场景/涉及的人/指向三选/链接） + 保存；AI 辅助按钮（可选，加载中禁用）：🔍 查概念（选中素材选区 → AI 解释 → 追加到素材或感受）、💭 联想（AI 检索旧感触 → 展示"这让我想起…"，可一键把旧感触 id 关联/引用）、❓ 追问（感受 < 20 字时提示"为什么这条触动你？"）；AI 辅助均失败静默降级（不打断录入）
- **对话面板**：中央弹窗（单例 escManager，`bz-blackbox-open` 幂等）；消息列表（角色气泡）+ 输入框 + 发送（Enter，Shift+Enter 换行）；首开无历史时包仔自我介绍（种子内容）；顶部显示「包仔 · 已收录 N 条感触」；底部/侧栏「成长」区展示最近复盘产物 + 手动复盘按钮
- **设置（⚙️ 域设置弹窗，5 项）**：blackboxAIProvider（deepseek/ollama 两档下拉，默认 deepseek）、blackboxOllamaUrl（默认 http://localhost:11434）、blackboxOllamaModel（默认 qwen2.5:14b-instruct）、blackboxReviewThreshold（数字，默认 10）、blackboxMaxHistory（数字，默认 20）；情绪词表只读展示（24 chips 灰态）
- **降级链**：AI 未配置/调用失败 → 对话面板提示「包仔暂时没法说话（AI 未配置）」+ 录入/复盘照常（感触是本地数据，AI 只做增强）；Ollama 不可达 → 提示后回退（deepseek 模式失败提示即可）
- **CSS**：写入 `styles.css`（黑匣子节，bz-blackbox-* 类），沿用 bz 统一风格
- **装配**：main.ts COMMANDS 表加 3 命令；settings.ts DEFAULT_SETTINGS 加 5 项；onunload 清理弹窗单例

## Testing Decisions

- **缝**（三层，沿用项目既有缝模型）：
  1. **纯函数**（最高缝）：buildPersonaPrompt（人设 prompt 组装：种子/语气/检索感触/历史/消息）、复盘阈值判断（shouldAutoReview）、chat 滚动淘汰（trimChat）、检索 TOP_K 排序（tfidf 复用）
  2. **数据层**：blackbox.json 读写（jsonStore）、录入追加/复盘追加/selfViews 生长、种子默认值——先例：pomodoro data 测试
  3. **UI jsdom**：录入弹窗（必填校验/情绪 chips 多选限 3/强度/折叠维度/保存落盘/AI 辅助按钮降级）、对话面板（渲染/发送/历史/成长区/复盘按钮）——先例：pomodoro/diary UI 测试
- mock fetch：AI 辅助/对话/复盘 mock createAI 或 ollama HTTP；fake timers 用 `advanceTimersByTimeAsync`
- smoke.test.ts 命令清单 +3（bz-blackbox-capture/open/review）

## Out of Scope

- 次级内容接入（备忘录/日记/bz 使用过程作为黑匣子输入，ADR-0014 未来机制）
- 元层聚合（黑匣子读遍 vault）
- 素材类型扩展（图片/语音/视频，v1 仅文字，字段结构预留 links 可挂）
- 主动打扰式消息（用户决策：复盘静默，不弹窗不通知）
- 向量检索（v1 用 TF-IDF 关键词检索，不依赖 Ollama 常驻）
- 种子编辑（域设置弹窗只读展示，改种子后续版本）
- 移动端专项适配（项目惯例）

## Further Notes

- 哲学源头：用户日记 2026-08-01「AI 陪伴」思考——"它一定是基于某些事物而构建的生命体……人的情感就建立在这上面，也只能寄托在这上面"。黑匣子 = 基于我的感触构建的生命体。
- 用户日记 2026-07-24「感触是知识的钩子」——黑匣子的砖（素材+感受焊死）与此呼应。
- 种子方案 D 由用户在 3 个性格方案（深夜诗人/思辨陪伴者/温暖老友）中选定：有诗心的思辨者。
- spec.md 同步：User Stories 节、命令 id 全清单（+3）、设置项总表（+5 项）。
- CONTEXT.md 术语：黑匣子/感触/素材/感受/情绪标签/意识体/人格档案/定期回顾/三层记忆/次级内容（已写入）。
- ADR：0013（感触 schema 定全）、0014（平行流不元层）。
