# 231：归物本数据 emoji→图标全转 + 预设分类退役（AI 归类）

**拍板**（2026-09-07）：① 数据 emoji 全转 lucide（三态实验页对比后拍板「全转」）；② 1226 条预设分类干掉，联想改历史分类 + AI 补新；③ 图标走独立 `icon` 字段 + 载入迁移；④ AI 一步到位（表单 ✨ 钮手动触发，未配置/失败内联降级）。详见 ADR-0102。

**落地清单**：
- `src/belongings/emoji-icon-map.ts`：445 预设 emoji → lucide 名映射（Obsidian asar 1881 键逐一验证 + lucide-static 双源取数）；`splitEmojiCategory` 拆分纯函数（含 VS16 变体符剥离）
- `src/belongings/data.ts`：载入内存迁移（幂等不写盘）+ 历史分类/图标派生（频次降序→最近更新）；`default-categories.gen.ts` 删除
- `src/belongings/ui.ts`：`item.icon` 渲染优先 + 遗留 emoji 兜底链（网格/详情/移动抽屉/联想四处）；表单 ✨ AI 归类钮 + 图标 chip + 历史联想（点选自动带馆内图标）；保存写入 `item.icon`；详情分类行剥 emoji 前缀
- `src/belongings/ai.ts`：菜单约束 prompt（118 个已验证图标）+ JSON 解析校验；`createAI().json()` 真实调用
- `src/core/ui/suggest.ts` + `types.ts`：`iconOf` 契约扩展 `string | HTMLElement`（向后兼容）
- `src/belongings/styles.css`：表单分类行（chip+输入+AI 钮）+ 图标宿主块级锚定（svg 百分比尺寸需块级宿主，inline 宿主会膨胀到容器宽）
- `prototype.html` + `prototype-icons.js`：同构回灌（迁移/历史联想/AI 演示钮/chip），生成器注入 228 图标 + BLG_EMOJI_MAP；selftest 29/29
- 测试：迁移幂等/未映射兜底/历史派生（data.test）、AI 成功/失败/历史图标联动（ui.test，requestUrl mock 惯例）、映射纯函数（emoji-icon-map.test）；全量 4183 绿 + tsc 干净

**坑**：asar 图标键两种形态（`lucide-` 前缀仅 231 个 UI 图标；全表 1881 键是裸键 packed 格式 `name:[[tag,attr]…]`，无连字符键不带引号）；unpkg HEAD 探测假阴性须 GET；lucide-static 0.544 缺 helicopter 须新版回退取数；CRLF 仓库补丁先归一 LF；补丁脚本模板串里字面 `\p`/`${}` 的转义；`.bz-ic` 无 display 声明，非 flex 宿主里 svg 百分比尺寸失效。
