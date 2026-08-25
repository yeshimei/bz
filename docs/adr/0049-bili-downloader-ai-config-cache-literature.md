# 0049 bili-dl 配置直读 bz + 视频缓存与文献笔记快速流程

grilling 五轮共识（Q1–Q25，2026-08-25）：B站下载工具在保留 ADR-0011 独立化边界（外部 npm 包、零 npm 依赖、rc 惯例）的前提下，恢复被 ADR-0011 裁撤的「AI 后处理」并新增两项能力：**文献笔记快速流程**（AI 生成标题/标签/一句话简介 + 轻润色正文，落 vault「文献盒」笔记）与**视频缓存**（下载原件跨任务 7 天缓存，重复下载命中跳过下载阶段）。AI 配置不注入、不迁移：由工具按 rc `vaultPath` **直读** `.obsidian/plugins/bz/data.json`。

## Considered Options

- **配置传递方式**：环境变量注入 / 临时 JSON 参数 / **直读 bz data.json（选定）**——零注入面、不经 Obsidian 独立启动同样全功能；代价是工具依赖 rc vaultPath 指向 bz 所在 vault，且 provider→baseUrl/model 映射在两侧各持一份（bz 增 provider 需同步工具侧副本）。
- **quickadd 回退**：复制 bz 的兜底逻辑 / **不复制（选定）**——一次职责归 bz，缺 key 即报错引导至 bz 设置。
- **缓存范围**：全部中间产物 / **仅下载原件（选定）**——剪辑/压缩为 ffmpeg 秒级可重建，无缓存价值；键 = BV + 分P(cid) + 清晰度。
- **rc 处置**：删除 vaultPath/outputDir/软件路径键（提出过）/**六键原样保留、仅增可选键（用户拍板）**——`cacheDir`、`cacheRetentionDays`、`literatureFolder`。
- **文献笔记触发时点**：转文字后自动一条龙 / **「完成」交付后按钮触发（选定）**——embed 必须引用真实交付文件名（重名加序号在交付时才确定）。
- **正文润色**：单次调用截断 / **按段落分块多次调用、逐块拼接（选定）**——文献笔记全量保真优先。

## Consequences

- 工具与 bz 恢复**单向只读耦合**：AI 密钥沿用 bz data.json 的 AI 配置字段，工具不新增密钥存储；旧 rc / 旧 data.json 零迁移。
- rc 既有六键与网页设置结构原样；新增三键不影响旧配置。
- 零 npm 依赖保持（AI 调用走 node 原生 https）；交付/剪贴板/历史既有行为不变；历史条目仅追加可选 `note` 字段。
- ADR-0011 的独立化判定不变：工具仍可脱离 bz 独立安装运行（无 AI 配置时文献笔记功能报错引导，其余功能照常）。