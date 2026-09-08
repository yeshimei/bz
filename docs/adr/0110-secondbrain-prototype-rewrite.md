# ADR-0110：第二大脑定稿原型三界面落域（UI 抛弃式重写 + markup 单源）

- 状态：已采纳
- 日期：2026-09-09
- 关联：ADR-0104（markup 单源）、ADR-0106（行为单源假宿主）、ADR-0103（影院落域先例：原型不出适配项文档记录）、issue 103（secondbrain 建域）、issue 251
- 票：`issues/251-secondbrain-prototype-rewrite.md`
- 原型：`.zcode/ui-prototypes/secondbrain-final/`（评审定稿：P1 布局 × P2 主题）

## 背景

secondbrain 域 UI 建于 ticket 103~141，功能面完整（主面板统计/onboard 三形态、对话流式 RAG、参考窄窗长按拖出状态机）但视觉为早期自绘风格。用户对五套探索原型拍板「P1 布局 × P2 主题」组合并要求落域：**原型是真理，完全抛弃域内既有 UI 与样式设计**。

## 决策

### 1. 重写边界：视觉与 markup 全换，行为与契约全留

- **抛弃**：三界面的 DOM 结构、类名语义、样式设计（styles.css 除移动抽屉段外全量重写）。
- **保留（逐行）**：形态分派与 onboard 三形态、进度回调解析、自动增量刷新、树展开会话记忆；对话流式渲染/请求取消/组合键防抖/历史持久化与裁剪；参考面板密度切换、悬停预览、双击跳转 chunk、长按 250ms 拖出浮卡、双击归位、幽灵卡竞态防护全套（QA 修复成果）。
- 数据层（vector-store/store-file/link-agent）、AI 层、命令注册、设置 schema、smartcat 事件零改动，数据零迁移。

### 2. markup 单源（ADR-0104）

新 `render.ts` 纯层承载三界面全部 markup 构建器与统计纯函数（computeStats/buildSourceTree/fmtCompact 自 panel.ts 收编）；三个行为文件（panel/chat-panel/reference-panel）只留生命周期、事件绑定、core 服务接线。`secondBrainSettingsSchema` 仍经 panel.ts re-export（settings-panel 动态 import 兼容）。

### 3. 视觉：固定米白红棕，不跟随暗色

面板底 `#fbfaf7`、强调 `#a33d2a`、来源四色（卡片盒 #0f766e / 归档 #6366f1 / 主题盒 #d97706 / 文献盒 #db2777）。面板为自成一体的浅色弹层，不随 `.theme-dark` 反色——与收藏本 C5（issue 227，#fffcf6 固定底）同款拍板先例。

### 4. 落域适配（原型不出，文档记录）

- 主面板底部状态行并入真身运维维度：上次索引 / 索引一致性（向量行数 vs 块数，偏差 warning）/ 存储占用（meta+vec 字节）——原型无此三者，属真实健康功能不弃。
- AI 库摘要卡数据源 = secondbrain.json `panel.summary` 段（旧数据仍在生成入口已随 ticket 141 移除）：有值渲染、无值整卡隐藏；生成入口不重建。
- 对话检索命中以引用卡展示，仅会话内存在不落盘（chatHistory 段 `{role, content}` 结构零改动，历史读回无引用卡）。
- 对话推荐问法为静态引导集（原型常驻 chips）；主面板头行 ⚙️ 直达设置（真身行为，原型以按钮示意）。
- 移动端底部抽屉（`bz-sb-mb-*`）本批不动：无原型依据，样式段原样保留，待后续移动原型另行落域。

### 5. 行为单源评审壳（ADR-0106）

fake-sim + fake/fake-obsidian（FakeVectorStore 真实快照同构+策划检索映射 / Fake AI 流式 / FakeVault storage 桥 seed secondbrain.json）→ prototype.html 三界面切换壳；build-preview.mjs 双清单登记 secondbrain，产物入库。
