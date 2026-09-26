# 312 知识盒图版录入（第四类文献：图片 → 读图成文）

- 状态：完成（2026-09-14 原型评审迭代，待合并主仓）
- 关联：issues/309（三名词 + 关联行）/ issues/311（AI 多模态通道）/ issues/310（影像两界面）/
  ADR-0112（知识盒）/ ADR-0116（来源行）/ ADR-0133（影像录入解析式）/
  `src/knowledge/note-gen.ts` / `src/knowledge/ui.ts` / `prototypes/knowledge/`

## 背景

用户 2026-09-14：「现在讨论另外一种文献的入口，图片」。讨论中确定形态为**甲 · 读图成文**，
命名用**图版**（「影像」已指视频，不再改名），并要求 **入口放到影像之后**。

前置事实：issues/311 已把 `core/ai` 打通多模态（DeepSeek V4.1-Flash 原生读图），
故本 issue 不再需要「读图模型」这类设置项——直接走当前模型。

## 交付

### 入口与面板

- [x] 部壹入口四枚名词按钮，**图版排在影像之后**：`名词 / 段落 / 影像 / 图版`（单字词标签，仍无说明小字）。
  四枚按钮改居中排布（原先左对齐，是给带说明小字的两行按钮定的，单字标签下四枚左对齐会偏）。
- [x] 图版面板 = 与名词 / 段落**同壳第三态**（`data-lit-entry="image"`）：标题栏「图版」→ 图片行（拖入区）→
  来源行（与另两态同构，ADR-0116）→ 生成 → 属性卡（**标题可改** / 领域 / 日期 / 来源 / 关联）→ 正文卡 →
  总结 / 确认写入；确认写入后关窗。属性首行类名由 `.bz-lit-passage-only` 改为 `.bz-lit-titled-only`
  （段落与图版共用「可改标题」态），标题输入 id 由 `#lit-passage-meta-title` 改 `#lit-entry-meta-title`。
- [x] 三条收图路径共用同一处理器：**拖入**（dragover/drop，高亮虚线框）、**点选文件**（点拖入区开系统选择器，
  `accept` 限定四种格式）、**Ctrl+V 粘贴截图**（document 级 paste 监听，仅图版态接管，销毁时卸载）。
- [x] 换图 = 作废旧草稿：预览收起、关联行归位（与「改动输入」同口径）；生成进行中拒收新图（避免图文错配）。

### 数据与落盘

- [x] 图片**只在内存**（`bytes` + 预览用 data URL），确认写入才落盘 → 取消不留孤儿文件。
- [x] `generateImageDraft(imageUrl)`：图片 data URL → 自动标题 + 领域 + 读图解读（提示词硬约束「只能写图中看得到的」）；
  走 `ai.json({text, images})` 多模态通道。
- [x] `generateImageNote({title, summary, domain, imageBytes, imageExt, source})`：
  先 `writeUniqueBinary` 把图片本体写进 **`<文献目录>/assets/`**（文件名取最终标题，永不覆盖），
  再写笔记 → frontmatter `title / type: image / domain / date`（+ 可选 `source`/`sourceTitle`），
  正文 = **`![[<vault 相对全路径>]]` 嵌入 + 读图解读**。嵌入用全路径：库里同名图常见，裸名会指错。
- [x] `imageExtOfMime(mime)`（`core/ai`）：MIME → 落盘扩展名（`imageMimeOfPath` 的逆函数，jpeg 归一 jpg）。
- [x] 列表类型标签「图 版」、预览头「图版预览」；事件 `image-generated` 进小橘行为流与首页时间线。

## 不做 / 待定

- **不加「读图模型」设置行**：默认模型已是 V4.1-Flash 别名，能直接读图（issues/311 结论）。
- **不给命令面板加条目**：名词 / 影像有命令，段落当初没加；图版与段落保持一致（只有面板入口）。
- 未做「从文库已有图片里挑」（用户当初选的是拖入 + 粘贴截图；`core/path-picker` 只选文件夹，
  要选文件得扩选择器）。也因此「本来就在库里的图原地引用不搬」这条暂无落点——拖进来的一律是新字节。
- 未做客户端压缩/缩放（大图进 base64 后体积可观）；超 32 MiB 直接提示拒收。
- 未做 HEIC → JPEG 转码（手机相册直传可能带 HEIC）；`accept` 只列四种受支持格式。

## 验收

- `pnpm exec tsc --noEmit` 0 错。
- `tests/knowledge` 185 例（新增：同壳三态切换与收图、非白名单格式拒收、换图作废草稿、
  粘贴只在图版态接管、`generateImageDraft` 多模态入参、`generateImageNote` 图片本体 + 嵌入正文 +
  重名序号 + 来源键 + 空值拒写 / 兜底命名）；`tests/core/ai` 21 例（新增 `imageExtOfMime`）；
  `tests/smartcat|home` 1257 例（新增 image-generated 行为流 / 文案 / 时间线）。
- 原型自检 `prototype.html?selftest=1` **SELFTEST OK 39/39**（新增 10 条：入口四枚顺序、
  同壳第三态、拖入区与来源行、无图拒生成、示例图经**真实 drop 事件**进面板、
  回包证明图确实发到 AI 层、关联行完成、写入后进列表、笔记正文渲染出真 `<img>`）。
