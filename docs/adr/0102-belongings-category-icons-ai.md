# ADR-0102：归物本分类图标化 + 内置预设分类退役（AI 归类）

issue 231 用户拍板「数据 emoji 全转 lucide 图标 + 干掉 1226 条内置预设分类，改 AI 生成分类与图标」。三段落地：

1. **数据 schema（加法扩展，向后兼容）**：`BelongingsItem` 新增可选 `icon` 字段（lucide 图标名）；`category` 升格为纯文字名。`loadDatabase` 载入时内存迁移：emoji 前缀分类经 `splitEmojiCategory`（`emoji-icon-map.ts`，445 条预设 emoji → lucide 名映射——本表由渲染映射转岗为迁移转换器 + 遗留渲染兜底）剥离前缀并补 icon，幂等、不写盘（随下次自然保存落盘）；含变体选择符（🖥️）一并剥净。旧数据/外部同步进来的 emoji 分类在渲染层走同一映射兜底，未入表 emoji 原样显示。
2. **预设退役**：`default-categories.gen.ts`（1226 条）删除；表单分类联想 = 历史分类派生（`db.categories` 频次降序→最近更新降序，`db.categoryIcons` 分类→馆内首个 icon，运行时派生不落盘）；点选历史分类自动带上馆内图标。core `uiSuggest.iconOf` 契约扩展为 `string | HTMLElement`（向后兼容，纯文本路径零变化）。
3. **AI 归类**：表单分类行新增 ✨ 钮（`src/belongings/ai.ts`：`createAI().json()` + 118 个已验证 lucide 图标「菜单内选择」约束 prompt + JSON 解析校验——图标不在菜单/分类剥前缀超长即拒）。未配置/失败内联报错降级，不阻塞手填；手动新分类无 icon 走首字/📦→package 兜底。

铁律 5 原型先行：`prototype.html` 与 ui.ts 同步迁移/图标化（`prototype-icons.js` 生成器注入 `BLG_ICONS` 228 图标 + `BLG_EMOJI_MAP` 同源映射），selftest 29/29。测试：迁移幂等/未映射兜底/历史派生（data.test）+ AI 成功/失败/历史图标联动（ui.test，requestUrl mock 惯例）+ 映射表纯函数（emoji-icon-map.test）。已知取舍：动物/衣物等 lucide 无对应语义的 emoji 用文档化近义兜底（paw-print/shirt/footprints 等，分类名文字并列展示不产生歧义）；`💺座椅→armchair`、`🧊保鲜盒→refrigerator` 等按类目语义映射而非 emoji 字面。
