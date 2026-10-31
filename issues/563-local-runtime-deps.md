# 563：本地运行时（Python / ffmpeg）自动装 + 「bz 依赖什么」清单弹窗

日期：2026-11-01 ｜ 分支：feat/local-runtime-deps ｜ worktree：bz-wt-deps ｜ ADR-0279

## 背景

知识盒依赖的脚本要跑 ffmpeg，语音转写要 Python；第二大脑要 Ollama 与本地向量模型。
这些东西原先只有一句话：「请确认 Ollama 服务与 Embedding 模型可用」——用户下一步该干什么没人告诉他。

三条需求先后落地：

1. 引导页要检查并预下载 node / Python / ffmpeg，装完自动把绝对路径填进「设置 → AI → 外部工具」，让脚本直接能跑。
2. 检查页三个 bug（同一根因）：检测屏对目录包判的是**归档文件**的 sha256，内容屏判的是**解包标记**——同一项在①屏说「已下载」、③屏又要下；解到一半断掉时入口脚本已在盘上，于是「下载失败后总界面仍显示已下载」。
3. 国内通道：GitHub 直连为主，补一个国内资源站当备用；第二大脑缺本地模型 / Ollama 没启动时给出路。

## 决策（详见 ADR-0279）

- 新增 `src/core/dep-runtime.ts`：Python / ffmpeg 的探测（设置 → 插件内便携 → PATH）与静默安装（缓存 → 离线包 → 网络三源），装完回写设置路径。
- 通道顺序实测定：Python 走**南大镜像 → GitHub → gh-proxy**；ffmpeg（仅 Windows）走 **BtbN GitHub → gyan.dev**。gh-proxy 实测 HEAD 200 但 GET 挂在 0 字节，一律排最后并加 45 秒无进展超时。
- 就绪判据统一：目录包看**解包标记**（`core/bundle-asset` 的 `BUNDLE_MARKER`），不再看归档；`toolReadyState` 同步加这一条，与内容屏对齐。
- 新增 `src/core/deps-guide.ts`「bz 依赖什么」弹窗，三处共用：引导完成屏「还需要装什么？」、设置 → AI → Embedding「装 Ollama 与向量模型」、第二大脑失败态自动弹一次。
- 第二大脑失败文案按探测结论分三种（服务没起 / 在跑但没模型 / 都在却跑不通），前两种自动弹引导，第三种不弹。

## 改动

**`src/core/dep-runtime.ts`（新）** —— `probeDep` / `installDep` / `ensureDepSettings` / `depArchives` / `EXTRA_DEP_GUIDE`。
**`src/core/deps-guide.ts`（新）** —— `openDepsGuide` / `probeOllamaService` / `cloudAiConfigured`；清单里 `{python}` 占位符换成本机真实路径，命令可直接复制。

**`src/core/setup-wizard.ts`** —— `SetupKind` 加 `'dep'`；`buildSetupTasks` 收 `depStates`（探测只做一次，别在 `isReady` 里反复 spawn）；`stageProbe` 按 kind 分派 `bundleStatus` / `docStatus`；完成屏新增「还需要装什么？」。
**`src/core/env-check.ts`** —— 原 `pythonProbe` 换成 `depRow`（复用 `probeDep`），新增 ffmpeg 行；`isRealPythonOutput` 改共用 `PYTHON_VERSION_RE`。
**`src/core/tool-runtime.ts`** —— `toolReadyState` 加解包标记判据。
**`src/core/settings-main-schema.ts`** —— Embedding 组新增「装 Ollama 与向量模型」按钮行。
**`src/secondbrain/panel.ts`** —— 初始化 / 重建失败按 Ollama 探测结论出文案，前两种每次会话自动弹一次引导。
**`src/knowledge/ui.ts`** —— 注释修口（外部工具组现住「设置 → AI」，不是「通用」）。
**`src/core/ui/components.css`** —— 引导清单行 `.bz-setup-deps` / `.bz-setup-how` 样式。

**测试**：新增 `tests/core/dep-runtime.test.ts`（17 条）；`d3-write-gate` 白名单补 `dep-runtime`；`tool-runtime` / `settings-schema` / `online-resources` 断言跟随新判据；`skin-pack-split-guard` 修一处**跨轮污染**——反向守卫的探测文件写成固定名，一轮跑被打断就删不掉，下一轮「清单同步」把它误判成未登记文件（症状是第一次跑红、后面全绿），改成带 pid + 每组测试前先扫残留。
