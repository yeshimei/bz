# 0011 B站下载独立为 NodeJS Web 工具

QuickAdd 脚本《B站下载.js》不并入 bz 插件，独立为 `tools/bili-downloader/`（npm 包 `@jwbz/bili-downloader`，bin `bili-dl`）：启动本地服务（127.0.0.1、随机端口、SSE 进度推送、vanilla 前端，零依赖）后，浏览器内完成解析/下载/裁切/压缩/转文字/交付。

## Considered Options

- **独立 Obsidian 插件**（原计划）：双链/剪贴板集成自然，但脚本核心（CORE）已零 DOM 依赖，插件外壳只是薄 UI；且依赖外部二进制（ffmpeg、Python faster-whisper），受 Obsidian 环境约束，迭代慢。
- **CLI 工具**：无 UI，裁切预览（拖动滑块实时看画面）、下载进度等交互体验差。
- **NodeJS Web 工具**（选定）：CORE 原样抽取，UI 迁移成本低（原弹窗 HTML 即前端素材）；浏览器页面交互能力强于 Obsidian 弹窗；可独立发布 npm 包。

## Consequences

- 与 ADR-0007/0008 的守护进程模式（PM2 托管、无常驻）不同：这是**交互式工具**，无 PM2、无常驻进程，`bili-dl` 启动 → 完成即退出。
- 配置走 rc 惯例：`~/.bilibili-dl.json`（与 `~/.douban-posterrc`、`~/.news-watcherrc` 一致）；Cookie 存 `~/.bilibili-cookies.json`，服务器端持有、不进浏览器。
- 砍掉 AI 润色/总结（原依赖 bz 插件 createAI）与「替换为双链」按钮；转文字保留，转录完成自动复制文本，交付时剪贴板 = wikilink 或 wikilink + 空行 + 转录全文。
- 剪贴板交付对浏览器剪贴板权限的依赖（127.0.0.1 属 secure context，可满足）。
- 交付目录默认仍指向 vault 的 `CONFIG/APPENDIX`，保持「下载→入库→引用」闭环；设置图标可改。
