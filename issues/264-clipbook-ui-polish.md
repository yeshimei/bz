# 264 — 剪藏本 UI 精修（简报精简 / 刊名呼吸光标 / 暗色皮）

- status: done（已合并 master `c0408ee9`，构建部署完成）
- type: §2 polish（UI 改版 + 主题补全，无新增数据段）
- 分支: 直接落 master（**用户明说豁免**：走快速原型模式）
- 依据: ADR-0082（剪藏本融合域）/ ADR-0119（每日简报）/ ADR-0104（渲染单源）/ ADR-0106（行为单源）；home / cinema 暗色先例

## 背景

用户 2026-09-10 在快速原型模式下提出 5 项界面调整，随后追加刊名字体与移动端同款诉求，最后要求「同步」走收尾流程。全部改动落在剪藏本单源（`src/clipbook/{render.ts,styles.css,ui.ts}`），改源码一处、原型与插件两侧生效。

## §1 界面精简（5 项）

### 1.1 去掉简报「完整转录稿」可展开段

`briefReaderHtml` 删除 `<details class="bz-clip-brief-tr">` 段与 `opts.transcript` 参数；`ui.ts` 去掉传参；`.bz-clip-brief-tr` 系列样式删除；`brief-ui.test.ts` 断言同步反转。

**`readBriefTranscript()` 与 `briefTrCache` 保留**——`retryBrief()` 仍依赖它判断「转录稿是否还在缓存」来决定走「就地重跑 AI」还是「删条目重抓」，不是死代码。

### 1.2 去掉目录条目的「字幕 / 转写」小标

`briefListHtml` 删除 `.bz-clip-item-tag` 那行（含失败态 `✗`）。失败条目现在**只靠 `bz-clip-item--err` 类**表达。`.bz-clip-item-tag` 样式删除，保留 `.bz-clip-item--err .bz-clip-item-t`。

> 注：`src.raw.src`（`subtitle` / `transcript`）字段仍留在数据层，仅不再上屏。

### 1.3 目录标题不再截断

`.bz-clip-item-t`（桌面）与 `.bz-clip-mob-ttl`（移动）移除 `-webkit-line-clamp: 2`。**三件套必须一起删**（`display: -webkit-box` / `-webkit-box-orient: vertical` / `overflow: hidden`），漏一个仍会截断；补 `word-break: break-word` 防长串溢出。

### 1.4 rail 选中态「未读/总数」的总数不可见

**根因在共享层**：`components.css` 的 `.bz-rail-item.on { color: var(--bz-on-brand) }`（白字）被 `.bz-rail-item.on .bz-rail-count { color: inherit; opacity: .72 }` 继承。其它域选中行有品牌色**底色**所以白字可见，而剪藏本编辑部皮肤下 `.on` 是**无底色**的（仅橘名 + 橘方块）→ 白字落在纸白底上不可见。

**修复落在域内**：`.bz-clip-rail .bz-rail-item.on .bz-rail-count { color: var(--clip-muted); opacity: 1 }`。**不动共享层**（6 个域共用，改了会影响别处）。

### 1.5 暗色皮

新增 `.theme-dark .bz-clip-frame, .theme-dark .bz-item-menu.bz-clip-menu-editorial` 覆写整组 `--clip-*` token（范式同 `home` / `cinema`：浅色为基准，暗色覆写同组变量，域内引用自动跟随）。

**4 处硬编码色值域内拿不到 token 链，需单项覆写**：

| 位置 | 原因 |
|---|---|
| `.bz-clip-lead` 点线 `#c9c0b0` | 直接写死，未走变量 |
| 右键菜单 `box-shadow` | rgba 墨色阴影 |
| 菜单 `--danger` 色 | 危险色需提亮保证暗底对比 |
| 失败态 `.bz-clip-brief-err` / `--err .bz-clip-item-t` | 浅底橘红在暗底不可读 |

删除确认弹窗（`#__shared_confirm_popup__.bz-clip-dialog-editorial`）挂 `body`、**无 `--clip` 链**（值本就写死），暗色另起一组覆写。

## §2 刊名字体（桌面 + 移动同款）

- **字号** 21 → 17px，**字重** 700 → 400（细骨衬线，贴编辑部印刷气质）。
- **追加橘色呼吸光标**（用户从四组语义方案中选 H「翻页光晕」）：`1.2s ease-in-out infinite`，`opacity 1→.35` + `scaleY 1→.7`。纯 CSS `::after` 实现，**不改 markup**，`render.ts` 标题仍是裸文本节点，渲染单源不受影响。
- 桌面 `vertical-align: -3px`（条底探出基线，像排版光标停驻行末）；移动端按尺寸放大到 3×22px、`-5px`。
- 移动端 `.bz-clip-mob-title` 同步去粗 + 挂同款光标。**字号 28.5px 保持不动**——那是既有的「移动端文字全量 ×1.5」口径基数，桌面 17px 是本次独立裁量值，两者非等比、不互相推导。

### 2.1 踩坑一：`flex-shrink` 导致标题折行

`.bz-panel-title` 是 `.bz-panel-head`（flex 容器）子项，**默认 `flex-shrink: 1`**。字号收小后未加约束，8px 字距 + 中文全角宽度撑破可用宽 → 「剪藏本」被折断成两行（用户截图实证）。

修：`flex: none; white-space: nowrap`。**头行左元素作为 flex 子项必须显式锁住，未设约束的都会在窄宽下折行。**

### 2.2 踩坑二：`letter-spacing` 被伪元素继承

`::after` 会继承父级 `letter-spacing`（CSS 字距加在字符之后），导致竖条右侧凭空多出一个字距的空隙、与左侧不对称。

修：`margin-right: -<字距值>` 抵消。**凡往 `letter-spacing` 元素挂伪元素，都要检查这一继承。**

### 2.3 踩坑三：无障碍降级把自己的动画杀了

初版写了 `@media (prefers-reduced-motion: reduce) { ... animation: none }` 一刀切。但**本机 Windows「窗口动画」是关闭的**（`HKCU\Control Panel\Desktop\WindowMetrics\MinAnimate = 0`），Chromium 此刻**恒报 `prefers-reduced-motion: reduce`** → 降级规则无条件命中，动画一次没播，表现为「代码写了却没动」。

项目早有同款记录（`src/core/styles.css:387` 注释：进度圈若在 reduce 下禁用会静态误导用户）。

修：降级改为**「放缓 + 减幅」而非禁用**——顶层新增独立 `@keyframes bz-clip-caret-soft`（周期 2.4s、`scaleY .85`、透明度最低 `.6`），媒体查询内只换 `animation-name` / `animation-duration`。

> 不用「`@media` 内嵌套 `@keyframes`」写法：支持面窄且反直觉，改为顶层独立名字更稳。

## §3 原型与评审壳

| 项 | 说明 |
|---|---|
| 简报种子 | `gen-clip-demo.py` 原本**完全不导 `briefs`** → 补上（含 body 要点 + `briefUps`）；`fake-sim.ts` 种子写入同步补 `briefs` / `briefUps`，`SeedData` 加 `SeedBrief` 类型 |
| 种子条目不带 `transcriptPath` | 故意为之：带上的话 `pendingBriefs()` 会把它们当待出稿，原型内触发 AI（fake 层无网络必抛错）。不带则空 body 条目稳定显示「正在生成本期要点…」占位 |
| `SEED_MARK` v1 → v2 | 种子只在首启跑。改种子数据结构**必须同步升版本号**，否则已种子过的浏览器永远看不到变化 |
| 明暗切换 | 评审壳加 `#themeToggle`，壳 `body` + 双 iframe `body` 同步换 `theme-dark`/`theme-light`；iframe `load` 后补一次，防重置掉回浅色 |
| 新增自检 3 条 | 简报 rail 行 / rail 选中计数非白字 / 目录标题无 line-clamp |

## 验证

- `pnpm exec vitest run`：**254 文件 / 4102 测试全绿**
- `pnpm exec tsc --noEmit`：干净
- `pnpm run build`：通过，产物落地 `E:/Obsidian/叫我包仔/.obsidian/plugins/bz` + 仓库根 `main.js` / `styles.css`
- diff 审查：还原 6 个他域 `prototype-behavior.js` 的行尾符噪声；确认 `--clip-ink-3` 引用随样式一并清除；确认剪藏本段 `line-clamp` / `brief-tr` / `item-tag` 选择器均为 0

## 遗留

- `pnpm test` 直接调用报 `Cannot find module 'D:\d\Obsidian\bz\node_modules\vitest\vitest.mjs'`（路径拼接异常），用 `pnpm exec vitest run` 正常。疑与本机 pnpm/vitest 解析有关，非本次改动引入。
- 简报 3 条待出稿条目（`body` 空）在真实库中尚未跑 AI；不在本次范围。
