# Issue 340 — 锚定双链点击桌面无反应/移动端 OB 重启（死 API 根因修复）

**状态：已修复**（2026-09-15/16）

## 现象（用户实测）

剪藏阅读器里点击划词下划线文字：桌面端**毫无反应**；移动端**直接 OB 重启**。
上一轮（issue 334 批次）的捕获阶段 + stopPropagation 修复未生效。

## 根因（本机 asar 实证）

`resolveInternalTarget` 裸 basename 分支调用的 `metadataCache.getFirstLinkfileDest` **在本机
Obsidian 1.12.7 / 1.13.4 实装中不存在**（两个版本 asar 0 命中；`node_modules/obsidian/obsidian.d.ts`
也只声明 `getFirstLinkpathDest(linkpath, sourcePath): TFile | null`）。上一轮把它记错了 API 名，
且经 `(app as any)` 强转绕过了 tsc，`typeof` 守卫又把「API 不存在」变成**静默空转**——
解析恒 null → 拦截恒不生效 → `preventDefault` 未执行 → 原生导航继续：

- 桌面：Obsidian 把笔记开在全屏剪藏面板**后面**（视觉上「没反应」）；
- 移动端：webview 直接导航相对 URL → 应用重载（「OB 重启」）。

上轮回归测试未拦住：测试注入的锚点用了**全路径** `data-href="文献盒/量子纠缠笔记.md"`，
恰好绕开坏的 basename 分支，全路径直查一直有效；真实渲染形态是裸 basename
（`[[量子纠缠笔记|量子纠缠]]` → `data-href="量子纠缠笔记"`）。

## 修复

`src/clipbook/ui.ts resolveInternalTarget` 三级解析重排：

1. 全路径直查（含补 `.md`，原样保留）；
2. 裸 basename **先按「知识盒内同名笔记」直查** `knowledgeDir()/p + '.md'`——锚定别名双链必指
   盒内笔记，vault 存在性判定即可解析，**不依赖 metadataCache 的版本差异**（主路径）；
3. 兜底 `metadataCache.getFirstLinkpathDest(p, '')`（d.ts 正牌 API，返回 TFile，取 `.path`；
   覆盖盒内子目录等非根布局）。

解析仍失败 → 不拦，维持原生行为（未解析链接点击原生即无操作，无崩溃面）。

## 回归测试（tests/clipbook/adr0147-bili-no-save.test.ts）

- 既有捕获测试锚点改**裸 basename**（复刻真实渲染形态）；
- 新增：盒内同名直查（mock 无任何链接解析 API ≈ 真实 Obsidian 缺 API 环境）仍拦截直达预览；
- 新增：盒内子目录笔记经 `getFirstLinkpathDest` 兜底解析后拦截；
- 新增：解析失败不拦、不触发预览。

## 门禁

worktree/5-crash-fix：目标文件 7/7 绿；全量 5210 绿 + 6 失败均为 preview-freshness
worktree CRLF 已知伪失败（pomodoro/home/memo 等未触碰域同挂）；tsc 0 错。
主仓库合并后全量重跑 + `pnpm run build`（原型指纹由 build-preview 重出）。
