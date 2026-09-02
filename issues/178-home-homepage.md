# Ticket 178 — 内容首页（home 域）：入口页的「新标签页」升级，落成独立新域

> 状态：进行中（worktree/home-homepage）；注意：并发会话占用 177（clipbook），本票顺延为 178
> 原型：`.zcode/ui-prototypes/launcher-prototypes/launcher-p3-newtab.html`（03 新标签页 · 已选中 · 可玩完整版）
> 关联：ADR-0002（依赖方向）、ADR-0003（懒加载）、ADR-0004（命令裸注册）、ADR-0019（移动端默认全屏）、ADR-0078/0080/0081（原型一比一独立新域先例）、ADR-0083（若立项）

## 背景
入口页（launcher）自 2025 起是「命令磁贴网格」入口。2026-09 用户从 5 款「大刀阔斧」新原型中选中 **03 新标签页**（内容首页）：一屏看到各域真实统计 + 直接点卡办事 + 命令搜索。本票将其落成**独立新域 `src/home`**，与 launcher 并存不互改（cinema/movie 同款先例）；稳定后 launcher 由用户另行删除（连带项见「未来删除 launcher」）。

## 决策
### 1. 新域 src/home（内容首页），与旧 launcher 并存
- 新命令 `bz-home-open`（名称「内容首页」），与 `bz-home`（入口页）并存；不修改任何 launcher 代码。
- home.json 存「钉选清单」：`{ version: 1, pinned: string[] }`，缺省钉选 diary/memo/cinema/review（先例 4 域）。
- 不再迁移磁贴级 launcher.json；手势仍指向 bz-home（旧入口页，不改）。

### 2. 数据：跨域只读统计快照（真实数据）
每张域卡右下角徽标 = 该域真实统计（容错，读失败回落默认）。域清单与统计口径：
| id | 名称 | 统计（真实数据层） |
|---|---|---|
| diary 日记 | 文件存在=今日已写 | 日记数（目录 children md） |
| memo 备忘录 | 未完成待办数 | 到期(今天)数 |
| cinema 影院 | 想看 / 在看 计数 | — |
| review 复习计划 | 到期队列数 | 今日队列数 |
| pomodoro 番茄钟 | 今日完成轮数（运行中显示倒计时） | — |
| favorites 收藏本 | 收藏数 | — |
| clipping 剪藏本 | 剪藏 md 数 | — |
| library 书库 | 在读本数 | — |
| news 聚合讯 | 已读文章数 | — |
| quiz 做题家 | 题目总数 | — |
| belongings 归物本 | 物品总数 | — |
| attach 移附件 | 无统计 | — |
| smartcat 小橘 | 无统计 | — |
| encrypt 保险箱 | 无统计 | — |
| settings 设置 | 无统计 | — |

统计卡（dashboard 摘要卡：复习到期/最近剪藏/番茄钟/影院想看）与移动端统计条本次不做（v1 只做「域卡真实徽标」）。

### 3. UI：新体系（设计手册→样式库→组件库→域），原型 1:1 迁移，lucide 图标（emoji 全换）
- overlay 域模式复刻 cinema：整宽内容面板 + hero/卡片网格/迷你 chips/搜索面板；域内布局样式 `bz-home-*` 前缀；基线（按钮/图标钮/输入/chip/徽标/弹窗）全走 `src/core/ui` 组件库与 `--bz-*` token（不新增组件；徽标色点用语义/品牌色，域内直给）。
- 命令执行真实接线：卡片点按 → 对应 `bz-*` 命令；命令搜索走 `app.commands.listCommands()` 真实过滤 + 执行；域行内操作（日记写/备忘勾/番茄/复习）v1 不做，卡片只开域（防伪功能蔓延）。
- 移动端：`@media (max-width: 768px)` 真全屏形态；hero/统计条/两列卡/dock 固定/全页抽屉；`applyMobileWindowFullscreen` 类挂载不动，移动端恒真全屏（域内 CSS）。
- 关闭：桌面无关闭钮点遮罩/ESC 关闭；移动端右上角 x（对齐 cinema/diary-wall 收编语义）。

### 4. 依赖读取守则
- 只 import 各域 data/stats 纯函数层与常量；凡带 DOM/轮询/通知副作用的 ensure/open 一律不调用。
- 读取前容错：目录不存在 → null；文件缺失 → 默认值；settings 注入缺失 → tryGetSettings 兜底。
- 数据后刷新：home 为打开时快照（懒加载一次 + 开关面板重取），不常驻监听。

## 文件清单（实现顺序）
- src/home/data.ts（域清单 + home.json 读写 + 归一）
- src/home/snapshot.ts（跨域统计读取，注入 app）
- src/home/state.ts + index.ts（幂等入口/开关/卸载）
- src/home/ui.ts（overlay + 桌面/移动渲染 + 搜索 + 编辑钉选）
- src/home/styles.css（域布局，token 化）
- scripts/build-css.mjs（SOURCES + home 行）、src/main.ts（+命令/import/unload 3-4 处）、src/settings-panel/ui.ts（DOMAINS + home 项）、src/settings.ts（无新增——域设置后续票）
- tests/home/{data,snapshot,ui}.test.ts + tests/smoke.test.ts 登记

## 未来删除 launcher（本票不执行，另票）
- main.ts:58/59/78/211-221/237(ensureAttachSeed)/300/399-415 手势接线；attach/index.ts:7 播种 import；
- settings.ts launcher* 字段与手势键；settings-panel DOMAINS launcher 行；tests/launcher/；build-css SOURCES 行。
