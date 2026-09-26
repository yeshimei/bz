# 0050 剪藏 frontmatter 主字段 link 更名 url

用户直接拍板（2026-08-25，本 ADR 即「兼容性冻结」的用户豁免记录）：剪藏域 frontmatter 的原文链接主字段 `link` 整体更名为 `url`——剪藏本（clipping）、聚合讯存剪（news saveToClip 写入端）、剪藏归档 URL 精确匹配（memo clip-archive）、smartcat 待补全登记/反查锚点全部换用 `url`。**不做新旧双读兼容**：读取只认 `url`。

## Considered Options

- **存量数据处理**：代码双读兼容不动数据 / **批量迁移 + 不兼容（选定）**——vault `归档/网页剪藏/` 全量 .md frontmatter `link:` 键一次性改写为 `url:`（值原样），迁移后无历史包袱。
- **兼容回退**：读 `url ?? link`（提出过）/**仅 url（选定）**——避免两套字段名长期共存；外部生产端同步改名兜底见 Consequences。
- **写入端**：聚合讯 saveToClip 模板 `link: "…"` → `url: "…"`；auto-summary 不感知具体键名（frontmatter 原样合并保留），零改动自然跟随。

## Consequences

- **Obsidian Web Clipper 浏览器扩展模板必须手动同步**：属性名 `link` → `url`。扩展配置在浏览器侧、插件无法代改；未改前新剪落的文件只有 `link` 字段，剪藏本将不收录（解析要求 url+created）。
- smartcat rename 反查主锚点语义不变：仍是「URL 唯一标识原文」，只是锚点键名由 link 改为 url（ticket 084b 链路不受影响）。
- 存量迁移是一次性脚本操作（vault 侧），插件不内置迁移命令；其他设备经 Syncthing 同步收敛后一致。
- CONTEXT.md「剪藏归档」词条措辞已同步；ADR-0048 中「frontmatter link」为历史记录不改写。
