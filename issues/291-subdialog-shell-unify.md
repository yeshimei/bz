# 291 — 全域子弹窗风格统一（一套浮层壳 + 域皮贯通）

- 日期：2026-09-12
- 用户拍板（一句话需求）：备忘录的删除确认面板风格不统一，然后看一下全域的，不限于删除确认面板，所有所属域的子弹窗面板都要风格统一化
- 关联：ADR-0125（决策记录）、ADR-0095（皮肤机制）、ADR-0064（流程框内核）、ADR-0103（影院锚类）、设计手册 §9/§10（确认框规格与「慎重决策按钮中性」）
- 状态：进行中

## §1 缺陷形态（全域清点结论）

1. **确认框与表单弹窗不是一套壳**：`#__shared_confirm_popup__`（Obsidian 主题底 + 无描边 + 单层硬阴影 + 24px 内边距 + 无高度限）vs `.bz-overlay-popup`（token 底 + 1px 描边 + 三层柔和阴影 + 16px 内边距 + 82vh 限高）。同域同屏即穿帮。
2. **皮肤类漏传**（子弹窗挂 body，脱离面板根）：`openFlowDialog` 的 `className` 通道全仓只有剪藏本在用；memo 两个删除确认框、favorites 三个、belongings 两个、bookshelf 两个、secondbrain 两个、knowledge 三个、password-vault 两个**全部裸奔** → 「编辑弹窗有皮、确认框没皮」。
3. **按钮语言两套**：确认框按钮走 Obsidian `--background-secondary`/`--interactive-accent`（6px 圆角，8×24 padding），组件库按钮走 `--bz-surface-2`/`--bz-brand`（32px 高，8px 圆角）。
4. **`bz-flow-dialog-action` 零 CSS**：单动作/三动作分支（如 review「配置监听文件夹说明框」）的按钮没有任何样式规则。
5. **危险确认框默认高亮危险项**：手册 §9/§10 要求「慎重决策场景按钮保持中性」，代码相反。

## §2 实施

### core（壳与通道）
- `src/core/flow-dialog.ts`：popup 挂 `bz-overlay-popup bz-flow-dialog`（+ 危险主动作时 `bz-flow-dialog--danger`）；`buildFlowDialogParts` 产物新增 `dangerPrimary`；`confirmDiscard` 增第三参 `className`。id/结构/按钮契约不动（`tests/core/flow-dialog.test.ts:50` 的「双动作按钮无类」断言继续绿）。
- **顺带修掉一个潜伏 P0**：原 `popup.classList.add(opts.className)` 对**含空格的类串**抛 `InvalidCharacterError`（DOMTokenList 规范）→ 「域弹窗类 + 私有 token 作用域类」这种多类串写法（bookshelf/favorites/knowledge）会让确认框**根本建不出来**（popup 为 null、Promise 悬空）。此前只有 clipbook 传单类、memo 传空串，故未暴露。改为逐 token add；`tests/core/flow-dialog.test.ts` 补多类串回归用例。
- `src/core/styles.css`：`#__shared_confirm_popup__` 段**撤出全部壳层声明**（底色/圆角/阴影/内边距/宽度），只留流程框版式与冻结按钮 id 样式；新增 `.bz-flow-dialog` 版式、`.bz-flow-dialog--danger` 中性化、`bz-flow-dialog-action` 分支样式；按钮几何对齐 `.bz-btn`、颜色走 `--bz-*`。
- 关键约束：id 段不得声明壳层属性，否则 id 特异性永久压死域皮的 `.bz-overlay-popup.bz-<域>-skin-*` 复合选择器。
- 层叠核对（`scripts/build-css.mjs` SOURCES 顺序：core/styles.css → tokens.css → components.css → 各域）：共享壳的底色/描边/圆角/阴影/限高来自 components.css（后加载胜出），core/styles.css 的旧 `.bz-overlay-popup` 段只剩 `position: fixed + top/left 50% + translate(-50%,-50%)` 自居中——这与 `uiModal` 弹窗**逐条同款**（两边同一套定位），属「同壳」的应有状态，未改。

### 域皮贯通
| 域 | 皮肤载体 | 确认框入口数 | 传的类 |
|---|---|---|---|
| memo | `bz-memo-skin-paper\|editorial` | 2 | `skinClass()` |
| clipbook | `bz-clip-dialog-editorial` | 4 | 已有（本轮不动） |
| bookshelf | `bz-bs-skin-*` + `bz-bs-mode-*` | 2 | `bz-bs-flow-dialog` + `bsSkinClass()` |
| favorites | `bz-fav-scope` | 3（含 confirmDiscard） | `bz-fav-flow-dialog bz-fav-scope` |
| belongings | `--bz-bel-*` 自携 | 2（含 confirmDiscard） | `bz-bel-flow-dialog` |
| secondbrain | `--sb-*` 自携 | 2 | `bz-sb-flow-dialog` |
| knowledge | `.kb` | 3 | `kb bz-kb-flow-dialog` |
| password-vault | `--pwv-*` | 2 | `bz-pwv-flow-dialog` |

无皮肤的域（review/checkup/recap/diary/attach/encrypt/reading-report/home/pomodoro/cinema/smartcat）不传类 —— 共享壳 + `--bz-*` token 已保证与同域面板同源，无需域 CSS。

**口径例外（有意不带皮，已核实）**：
- secondbrain「填入远程 Ollama URL」确认框（`panel.ts:674`）由**插件设置页**的设置行触发，视觉上下文是设置弹窗（core 皮）而非第二大脑七根界面之一 → 不套 `bz-sb-flow-dialog`，否则与所在的设置页两张脸。
- clipbook 的 UP 主名单/RSS 订阅管理弹窗（设置弹窗内触发）、加密域设置弹窗同理归设置上下文。
- cinema 域自绘 `.cn-ovl` 确认框与其余弹窗同基座同皮（域内自洽），本轮不动。
- 顺带修掉同类隐患：memo `skinClass()` 原先 `memoSkin` 未知/缺省时返回**空串**，而面板 `applyMemoSkin` 同条件回落**纸感手账** → 「面板有皮、弹窗没皮」。已改为与 `applyMemoSkin` 逐字同口径（未知/缺省 → `bz-memo-skin-paper`），`tests/memo/ui.test.ts` 对应的旧断言（`default 不挂`）同步改为「default 回落纸感」。

## §3 测试防回归

- `tests/core/flow-dialog.test.ts`：壳类在位 / 危险主动作挂 `--danger` / danger 不在主动作位不挂 / `className` 通道与壳类共存 / 双动作按钮仍无类。
- `tests/core/flow-dialog-data.test.ts`：`dangerPrimary` 三种取值口径。
- `tests/memo/confirm-skin.test.ts`（新，jsdom）：删除备忘录 + 删除场景确认框带皮肤类（paper/editorial/缺省三态），并带共享壳类。
- `tests/memo/skin-dark.test.ts`：样式源文本守卫 —— 两个 `openFlowDialog` 都带 `className: skinClass()`（漏传即回归）、确认框双肤规则存在、core 壳类前提在位。
- 各域 skin 测试：见对应域测试文件（样式源文本 + 运行时 popup classList 断言）。

## §4 未覆盖（另批 issue）

域内**自绘 mask+popup**、不走三基座的子弹窗不在本轮：diary（标签选择器/写日记弹窗/滚轮时间选择器：纯内联样式，连 popup 类名都没有）、review（难度/统计/历史/答题四套自绘浮层）、encrypt（体检弹窗/密码条目弹窗/平台编辑弹窗：全局裸类）、attach（`bz-attach-preview-pop` 是空挂类）、cinema（自绘 `.cn-ovl` 确认框）。这些属于**弹窗基座迁移**（重构 DOM、迁移测试、逐域视觉回归），不是样式收敛；本轮口径是「凡走 `uiModal`/`openFlowDialog`/`createOverlay` 三基座的子弹窗一律同壳，凡带皮肤的域一律带皮」。

## §5 收尾清单

- [x] core 壳统一 + 危险中性 + `confirmDiscard` className 通道 + 多类串 `classList.add` P0 修复
- [x] memo 确认框随皮肤（用户点名项）+ `skinClass()` 回落口径与面板对齐
- [x] bookshelf / favorites / belongings / secondbrain / knowledge / password-vault 确认框随皮肤（clipbook 原有）
- [x] 原型产物重出（`node scripts/build-preview.mjs`，新鲜度守卫转绿）
- [x] 全量门禁：`pnpm test` 292 文件 / 4499 测试全绿 + `tsc --noEmit` 0 错误
- [ ] 合并回主仓库 → 主仓库 `pnpm run build` 部署 → 清 worktree
- [x] 文档：ADR-0125、设计手册 §9/§10、CONTEXT.md 词条、ui-kit-manual 弹窗行

## §6 门禁记录

- `node scripts/build-preview.mjs` → 17 个 prototype-behavior + prototype-render 产物重出。
- `pnpm test` → **292 文件 / 4499 测试全绿**（首次冷缓存满负载跑时 `tests/home/ui-river.test.ts` 与 `tests/password-vault/review-fix-lock.test.ts` 各 1 例超时型抖动，单独跑与缓存预热后复跑均绿；基线主仓库同批全量亦全绿，判定为环境负载抖动，非本次改动）。
- `pnpm exec tsc --noEmit` → 0 错误。
