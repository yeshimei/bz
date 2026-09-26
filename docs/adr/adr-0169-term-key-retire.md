# ADR-0169：术语文献退役 `term` 冗余键（五键 → 四键）

- 日期：2026-09-19
- 状态：已采纳
- 相关：issue 380；ADR-0073（type/domain 契约与补全启发式）、ADR-0116（术语来源两键）

## 背景

用户核对术语文献属性面板时的原话：

> term 是什么，为什么和 title 完全一样

核查结论：术语文献 frontmatter 五键（title/type/domain/term/date）中，`term` 与 `title` 落盘取同一个值
（`generateTermNote` 同一变量写两行），录入面板也没有独立改标题的入口——两者**恒等、永不分叉**。
`term` 键剩余用途只有一处：`backfillNotes` 对**缺 type 的存量笔记**做启发式判型（`fm.term ? 'term'`，ADR-0073）。
对已带 `type` 的笔记，它没有任何读取方，是纯死数据。用户随后拍板：代码与笔记属性中都删掉。

## 决策

1. **写入侧退役**：`generateTermNote` 不再写 `term:` 行，术语文献 frontmatter 定型为**四键**
   （title/type/domain/date + 可选 source/sourceTitle）。文件名与命令参数仍是术语词，`title` 保持同值。
2. **存量清理挂 backfillNotes**：新增纯字符串函数 `dropTermKeyIfTyped(content)`（行级、幂等、CRLF 保真、
   只扫 frontmatter，与 `migrateVideoSourceKeys` 同款手术边界），挂进旧笔记补全流程，**排在「已补全即跳过」之前**——
   否则带 type+domain 的存量笔记永远轮不到清理。打开知识盒面板时自动跑（每目录至多一次，既有机制）。
3. **判型窗口保护**：`dropTermKeyIfTyped` 仅当 `type` 值确为 `term`（含引号包裹）才删；**缺 type 的存量不动**——
   它还要靠 `term` 判型（ADR-0073），由 backfill 补上 `type:"term"` 落盘时**同趟清**。不存在「清完无法判型」的中间态。
4. **展示与契约零变化**：无任何 UI 读该键（属性面板是 Obsidian 原生渲染），命令与域事件契约不变。

## 后果

- 新术语笔记属性面板只剩 title/type/domain/date（+ 可选来源两键），不再出现与 title 重复的 term 行。
- `type` 启发式判型对「缺 type 且 term 已被手删」的存量失效——该类笔记无法识别类型（与既有 passage/image
  缺 type 的处置一致：不注入 type、domain 照补）。
- 原型样张（fake-sim 8 条术语文献）同步落四键形态，原型内 backfill 演示与插件一致。

## 被否决的方案

- **保留 term 键当判型标记**：`type` 键本身已是判据（backfill 判型只服务缺 type 的老数据），保留等于永久背一个死键；
  判型在 type 补全完成后自然失去输入，无保留价值。
- **只在写入侧退役、存量不动**：用户明确要求「笔记属性中也删掉」；行级清理幂等零风险，无理由留残。
