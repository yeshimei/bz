# 257 · 术语录入可选「来源」+ 主窗移动端全屏 + 弹层纸墨皮背景修复

ADR-0116。知识盒术语录入（文字录入·术语）增加一个可选输入框「来源」，来源有两个方向：**内部笔记**（Obsidian 原生双链）或**外部链接**（b 站视频、知乎日报等网页）。用户拍板要点：

- 一篇术语文献记**一个可选来源**（frontmatter 统一键 `source`；外部抓到的页面标题落 `sourceTitle`）
- **`related` 不是来源，是关联**——Obsidian 原生双向链接的载体（卡片↔源文献互链）；术语出处一律走 `source`，不搭 related 便车、不冒充视频文献专属的 `url` 键
- 单框智能分流：整串无空白的 URL/域名字样（宽松判定，含 b23.tv 等单标签+TLD）→ 外部链接 chip（异步抓标题、失败静默降级纯链接）；其余输入联想 vault 笔记 → 内部笔记 chip
- 仅记录+展示：不喂 AI、不回写任何笔记（提炼成卡的 related 互链语义不动）
- 展示：术语预览属性卡第 4 行「来源」（内部点击开笔记 / 外部开浏览器）；部壹笔记预览外部来源可点；列表行/首页/recap 等派生视图不加
- 预填：仅命令入口（选中词场景）自动带当前活动笔记为来源、可一键清除；主窗「文字录入」按钮入口不带上下文
- 附带：主窗移动端真全屏（`bz-panel-mtop`，此前样式规则已备未挂载）+ 头栏移动端 ✕ 关闭出口；术语/添加弹层补挂 `.kb`（纸墨皮变量作用域缺失 → `var(--panel)` 失效背景透明，issue 257 现场报）

## 改动

- `src/knowledge/source.ts`（新）：`TermSource` 类型 + `isUrlLikeSourceText`（宽松域名判定）/ `cleanUrlText`（URL 净化）/ `noteSourceName` / `serializeTermSource`（落键唯一入口）
- `note-gen.ts`：`generateTermNote` 增可选 `source`；落盘追加 `source/sourceTitle` 键（五键原样、键序不变）
- `ui.ts`：术语弹层来源行（小标签+输入框+chip+✕）；`showTermEntry(term, src?)`；预览 meta 第 4 行（可点）；确认写入带来源；部壹预览外部来源可点（`data-lit-src-url` → openUrl）；主窗 `isMobileEnv` 挂 `bz-panel-mtop` + 头栏 ✕（`kb-close`）；术语/添加弹层 `className` 补 `kb`
- `index.ts`：`openTermNote` 命令入口（无显式 term 时）带当前激活 md 笔记为来源预填
- `styles.css`：来源行/chip/可点链接样式；`.bz-kb-mclose`；`.bz-kb-window.bz-panel-mtop` 几何规则去顶部 env（顶部避让统一交 components.css 44px 档，防双份顶距）
- 测试：`tests/knowledge/source.test.ts`（新，纯函数）；`note-gen.test.ts` +5 用例（落键/净化/null）；`ui.test.ts` +5 用例（kb 作用域、URL chip、笔记联想 chip+✕、命令预填、部壹预览可点、移动端全屏 ✕）

## 验收

- 术语弹层出现「来源」独立行；粘贴 URL（含尾随标点）→ 外部 chip + 自动抓标题；搜笔记点选 → 内部 chip；✕ 清除
- 确认写入后文献目录术语笔记 frontmatter 出现 `source`（URL 原文或 `[[路径|名]]`）与可选 `sourceTitle`；无来源时不出现（五键原样）
- 命令「术语生成文献笔记」带选中词打开 → 来源预填当前笔记；主窗按钮打开 → 空
- 预览属性卡第 4 行、部壹预览可点开外部来源；列表行/首页不变
- 移动端：主窗真全屏（避让 Obsidian 头部安全区）、头栏 ✕ 关闭；术语/添加弹层有纸墨底色（背景不再透明）
- 桌面端：无 ✕、无全屏变化；全量门禁绿

评审原型：无新原型（域 UI 唯一真理 = 实现源码）；设计经 grill-with-docs 三轮拍板（工件：ADR-0116 + 本文档）。

## 补记（同日快速原型批）：来源链接与标题净化

- `normalizeSourceUrl`：落库前剥追踪参数——B 站视频页只留 `p`/`t` 内容性参数（`spm_id_from`/`vd_source` 等全剥）；b23.tv 短链 query 整段剥；其余站点剥 `utm_*`/`spm_*` 前缀与黑名单键（share_*/seid/unique_k/refer/scene 等）；hash 保留；幂等
- `cleanSourceTitle`：实体解码 + 空白折叠 + 剥站点尾巴（`标题 _哔哩哔哩_bilibili`、`- 知乎/知乎专栏/知乎日报`）
- chip/属性卡/落库（source/sourceTitle 键）全部走净化入口，落盘的 frontmatter 即干净可读
