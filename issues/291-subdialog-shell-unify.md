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
- [x] 合并回主仓库（FF 至 7c4e66f1）→ 主仓库 `pnpm run build` 部署（vault `main.js` + `styles.css` 已更新）→ 部署产物提交 11ea5caa → 清 worktree
- [x] 文档：ADR-0125、设计手册 §9/§10、CONTEXT.md 词条、ui-kit-manual 弹窗行

## §6 门禁记录

- `node scripts/build-preview.mjs` → prototype-behavior / prototype-render 产物重出（**必须在主仓库重出一次**，见下「发现」②）。
- `pnpm test` → **292 文件 / 4499 测试全绿**（worktree 缓存预热后复跑）；`pnpm exec tsc --noEmit` → 0 错误。
- 主仓库部署后复跑同样全绿（分开跑三条可疑文件 49 passed 也全绿）。

## §7 过程中发现的两个既有问题（不在本轮改，记录备查）

① **两例定时型抖动测试**：`tests/home/ui-river.test.ts:58` 与 `tests/password-vault/review-fix-lock.test.ts` 用固定 `setTimeout(20ms)`/`flush()` 等异步装配，在系统高负载（部署后 Obsidian 重新索引整库）下会读到未渲染完成的 DOM 而红（`[data-home-weekday]` 期望 7 实得 0）。单独跑、以及负载正常时的全量跑均绿；与本次改动无关。建议后续把固定 sleep 换成 `vi.waitFor`。

② **`pnpm run build` 不重出「行为预览包」**：`esbuild.config.mjs` 只 `await buildPreview()`（= 各域 `prototype-render.js`），而 `prototype-behavior.js` 由 `build-preview.mjs` 的 CLI 入口调 `buildBehavior()` 产出。于是「改了 src → 只跑 pnpm run build」会让已提交的 behavior 产物滞后 → `tests/preview-freshness.test.ts` 红（14 条里 4 条：home/memo/pomodoro/settings-panel）。修法二选一：`esbuild.config.mjs` 里补 `for (const d of BEHAVIOR_DOMAINS) await buildBehavior(d)`，或把这条约束写进构建脚本注释。另注：`.gitattributes` 只把 `prototypes/**` 钉成 LF，`src/**` 未钉 —— `src/pomodoro/render.ts`/`stats.ts` 在主仓是 LF、在 worktree 检出为 CRLF（autocrlf=true），源指纹按磁盘字节算，故同一份代码在两个检出位置算出的指纹不同（跨位置重出会刷一遍指纹行）。

## §8 独立评审与补修（2026-09-12，用户追问「走 review 了吗」后发现漏做）

首轮把 review 省成了自审就直接合并部署。补审按提交区间 `0788a6ec...0326c8de`（54 文件 / +2331 −265）做**两轴独立评审**（Standards 轴 = 仓库文档化规范 + Fowler 气味基线；Spec 轴 = 用户原话 + issue + ADR + 手册 §9），再由主线程逐条复核。

### 8.1 复核证伪的两条（不成立，记录以免后人重复踩）

- **「24px 内边距被 `.bz-overlay-popup{padding:16px}` 压成 16px」**：不成立。新壳规则 `#__shared_confirm_popup__.bz-flow-dialog` 特异性 (1,1,0) 高于 `.bz-overlay-popup` (0,1,0)，与 CSS 聚合顺序无关；`--bz-space-xl` = 24px。
- **「`createOverlay` 不同壳，三基座同壳未兑现」**：不成立。`src/core/dom.ts:186` 本就 `popup.className = 'bz-overlay-popup'`，三基座同壳成立。

### 8.2 复核成立并已补修

1. **危险中性只落地一半（P0 语义缺口）**：首轮只在 belongings/favorites/knowledge/memo 标了 `danger: true`，破坏性确认大面积漏标、主按钮仍品牌色满高亮。**首轮补修 8 处**（bookshelf 删除划线 ×2、clipbook 删除 ×2、diary 删除日记、encrypt 永久删除、secondbrain 清空对话、password-vault 仍要重设）；**第二轮评审（§8.4）又挖出 9 处**（encrypt「仍要重设」、checkup「清除」、review「移出复习计划」命令入口 + 面板抽屉、review 总线「移除」复习记录、encrypt `askConfirm` 通道的删除/销毁 4 处），合计 **17 处**。口径与豁免见 ADR-0125 决策 5。
2. **危险态形制残留**：core 危险规则原先只重置 `background/color`，memo 纸感的 ok 形制（`src/memo/styles.css` 2px 墨框 + 11px 圆角 + `3px 3px 0` 硬偏移阴影）在 danger 态残留 → 「中性底 + 红字 + 凸起墨章」。已把 core 危险规则改成**整套**中性次级形制（+ 描边/圆角/阴影复位），并给 clipbook 编辑部皮补 `--danger` 限定覆写（亮/暗两套）以保住它的方角形制。
3. **Speculative Generality 一条经复核不成立**：`--bz-surface-hover`（password-vault）、`--bz-brand/--bz-on-brand`（knowledge）并非死 token —— 分别被 core 的取消钮 hover 与 `.bz-btn--primary` 消费；只是 knowledge 当前三处全 danger，属备用通路，保留。
4. **域皮几何违反手册 §4.2/§5.1/§5.2**：成立但**性质是既有域级偏离被本次忠实继承**（`belongings` 2px 墨框/方角 = `.bz-bel-form` 既有形制；`favorites` 14px + 单层硬阴影 = `.bz-fav-form` 既有形制）。已在 ADR-0125 后果段写成**显式豁免**，并记「域皮形制归一」为另批工作，不在 ADR-0125 范围。
5. **测试固化缺陷**：`tests/password-vault/ui.test.ts` 原注释「cta 主动作 → 金色主钮」把「危险确认不高亮」的反面写成了预期；经裁决区分——「设置主密码」是风险告知门（保留金色主钮），「仍要重设」是破坏性重设（补 `danger`），两处均改为显式用例 + 注释说明口径。
6. **潜在洞（当前无调用点，未改代码）**：三动作以上分支里 `danger + cta` 的动作仍会被品牌色高亮 —— core 危险复位规则只打 `#__shared_confirm_ok__`（该 id 仅标准双动作分支使用），而 `button.bz-flow-dialog-action.bz-flow-dialog-danger` 那条规则显式 `:not(.bz-flow-dialog-cta)`。将来新增三动作危险确认时须一并补规则。

### 8.3 补修新增/扩展测试

- 新增 `tests/core/flow-dialog-danger-neutral.test.ts`（7 例）：危险规则五项中性值齐全 / 选择器提级 (2,2,0) / hover 不回品牌色 / clipbook 亮暗两套 `--danger` 覆写及其特异性确实高于被保护规则 / **跨域不变量**（域 CSS 里 ≥(2,2,0) 的 OK 钮规则必须状态限定或被更高特异性的危险态覆写保护）。
- 运行时 popup `classList` 断言补齐：`tests/bookshelf/notes-ui.test.ts`（md + EPUB 两处）、`tests/clipbook/enhance.test.ts`（新增「删除条目」用例 + 删除剪藏）、`tests/diary/delete-confirm.test.ts`（新增危险修饰用例）、`tests/encrypt/ui-cov.test.ts`（永久删除）、`tests/encrypt/ui.test.ts`（清单损坏重设）、`tests/encrypt/vault-ui.test.ts`（删除密码条目 + 新增 `askConfirm(danger)` 两态定点用例）、`tests/secondbrain/chat-ux.test.ts`（清空对话）、`tests/password-vault/ui.test.ts`（新增「仍要重设」用例，含锁屏异步装配的 `vi.waitFor` 口径）、`tests/checkup/ui.test.ts`（确认框替身改为透传参数，断言「清除」带 `danger`）、`tests/review/index.test.ts`（总线移除记录）。

### 8.4 第二轮评审（对补修 diff 再跑两轴）新增发现

补修提交后按同一基准再做一次两轴独立评审，结果如下（均已修完）：

1. **memo 危险态 hover 残留（P0，Standards 轴与主线程自审各自独立发现）**：memo 纸感的 OK 钮 `:hover` 规则特异性 (2,2,0)，与 core 危险规则**同级**、而域文件在 CSS 聚合序中后到 → 危险钮一悬停就把 `4px 4px 0` 硬墨影找回来，稳掉了「中性化」。修法：纸感两条规则都加 `:not(.bz-flow-dialog--danger)` 守卫（与 password-vault / secondbrain 的 OK 钮守卫同范式），并新增跨域不变量测试锁住这一整类问题。
2. **clipbook 覆写的特异性注释写错且实现脆弱**：亮色危险覆写实际是 (2,2,0)（注释误写 2,3,0），只靠源序取胜、无测试锁序。修法：补 `.bz-overlay-popup` 提级到 (2,3,0)（暗色 2,4,0），注释改写为事实描述，并测试断言其特异性确实高于被保护的两条。
3. **bookshelf 危险态与同框「取消」形制不一致**：本域两钮共用 `radius-xs + var(--bsw-line)` 纸卡形制，被 core 复位成套后变「一圆一方」。修法：补 `--danger` 限定覆写保纸卡方角与描边档，底/字色回到次级中性态。
4. **encrypt 的破坏性确认漏标 5 处**：`encrypt/ui.ts` 的「仍要重设」（与 password-vault 文案逐字同）、`askConfirm` 通道下的「删除密码条目」×2 /「删除整个平台」/「彻底销毁日记」。`askConfirm` 走 core 流程框（不同于 password-vault 的域内自绘确认），danger 必须显式传参 —— 已改为 `askConfirm(title, message, okLabel, danger, onYes)` 并在 4 处删除/销毁调用点传 `true`，两处「还原」传 `false`。
5. **checkup / review 漏标 3 处**：「清除失效引用」、review「移出复习计划」（命令入口 + 面板抽屉两条实现）、review 总线「移除复习记录」。均已补 `danger`。
6. **豁免须写明理由**：新增 4 处刻意不标 danger 的注释（secondbrain「重新索引」= 可重建派生数据、encrypt「加密到保险库」= 搬入而非销毁、review「放弃本次做题」×2 = 本轮临时态，与 `confirmDiscard` 同口径），并把豁免类别写进 ADR-0125 决策 5（原文档只写了「须自己写覆写」，漏写「≥(2,2,0) 域规则必须状态限定」这条通则，也已补）。
7. **注释说谎**：`src/password-vault/styles.css` 原注「本域两处确认框主动作均为 cta 非 danger」被本批改动证伪（重设已标 danger），已改写为「风险告知门保留金色主钮 / 破坏性重设落 core 中性档」的分工说明。
8. **潜在洞（未改代码，记为后续约束）**：三动作以上分支里 `danger + cta` 的主动作仍会被品牌色高亮 —— core 危险复位规则只打 `#__shared_confirm_ok__`（该 id 仅标准双动作分支使用），而 `button.bz-flow-dialog-action.bz-flow-dialog-danger` 那条显式 `:not(.bz-flow-dialog-cta)`。当前无调用点，将来新增三动作危险确认时须一并补规则。

### 8.5 第三轮评审（对最终 diff `ba8c8865..HEAD`）结论：**通过**，下列 4 条记为已知未修项

第三轮两轴独立评审对补修 diff 复核。Spec 轴**独立逐点扫全仓 `openFlowDialog` 与包装函数后确认：破坏性主动作漏标清单为空**（「17 处」计数属实，全仓现共 25 处危险确认框），§8.4 各项自述与代码逐条一致，三类豁免未被滥用。Standards 轴见其报告。以下 4 条经用户裁决**不再修**，留档备查：

1. **memo 编辑部皮（editorial）危险态残留字重**：`src/memo/styles.css` 的 `#__shared_confirm_popup__.bz-memo-skin-editorial #__shared_confirm_ok__`（`(2,1,0)`）只声明 `font-weight: 600` / `letter-spacing: 0.1em`，未加 `:not(.bz-flow-dialog--danger)` 守卫；core 危险规则是「整套**形制**复位」（底/文字/描边/圆角/阴影），不含字重/字距，故危险态下编辑器皮删除钮保留 600 字重（纸张皮那条已加守卫 → 变成 medium）。判定：属**字体身份**而非「高亮/提级形制」，且各域取消钮常与主钮共享字距（belongings/clipbook），强行复位字距反而会造成同框两钮字距不一，故按「形制复位、字体留域」口径接受现状。
2. **守门测试的口径边界**：`tests/core/flow-dialog-danger-neutral.test.ts` 的跨域不变量只覆盖「强调/形制」属性且只审 ≥(2,2,0) 的规则，故第 1 条这类**低特异性字体残留**不在其射程内（结构上不可达，非遗漏）。字体残留若将来要管，应另立一条「危险态字体基线」断言。
3. **`vi.waitFor(() => expect(x).toBe(0))` 对「期望 0」无等待力**：`tests/password-vault/review-fix-lock.test.ts` E2 中两处等「锁屏数量为 0」会在 DOM 尚未渲染时即刻通过（等价于空断言），正确写法是先等一个**正信号**（如列表行出现 'GitHub'）再断言 0。本批为消除全量跑必现的抖动而引入，属测试加固的已知弱点，不影响产品行为。
4. **范围说明**：`654af22f`（抖动测试改 `vi.waitFor`）与 `9f7a91d2` 同批提交，但 §7① 原本记为「不在本轮改」——它只是「门禁全绿」的必要前置（隔离跑必绿、全量跑必红），且**只动测试、无产品行为变更**（已核对 diff）。ADR 决策 5 的「豁免处一律写明理由」只约束「看起来像破坏性却刻意不标」的场景（现有 6 处：风险告知门 ×1、填便利值 ×1、可重建派生数据 ×2、临时态 ×2）；本身非破坏性的动作（批量已读、批量加入复习、修复标题格式、加密笔记销毁走的是重输主密码的 `uiLockScreen` 而非流程框）不需豁免注释。

### 8.6 第三轮 Standards 轴补充发现（同样按裁决不再修，留档）

第三轮 Standards 轴的报告晚于上述裁决到达，其结论**部分与 §8.5 重叠**，另有 4 条新发现。**未改代码**，原样留档：

1. **`tests/core/flow-dialog-danger-neutral.test.ts` 的跨域不变量存在假阴性，该用例实际恒不通过失败**（本批自查漏掉的真缺陷，评审抓出）：`specificity()` 与 `sel.includes('.bz-flow-dialog--danger')` 都跑在「块前注释被并进选择器」的文本上（正则是 `/([^{}]+)\{([^{}]*)\}/g`，注释里没有 `{`/`}`，故被吃进 `rawSel`）。后果：① 注释里的 `.`/`#`/`:not(` 字样把特异性算虚高；② 注释只要提到过 `.bz-flow-dialog--danger`（本批注释恰好都提到），`scoped` 就恒为真 → 规则被「① 自身状态限定」分支直接放行 → `expect(offenders).toEqual([])` 恒成立。**修法（待办）**：算 `rawSel` 前先剥掉 `/* … */`，并只在**去注释后的选择器**上判 `scoped`/算特异性；修完请用一个「故意去掉 `:not()` 守卫」的临时反例确认它真的会红。
2. **`src/bookshelf/styles.css` 危险覆写注释与实际不符**：注称「本域两钮共用同一纸卡形制（radius-xs + `--bsw-line` 描边）」，实况是 `(2,1,0)` 那条的 radius-xs/描边只作用于「取消」钮，OK 钮另有一条 `border-color: var(--bsw-ink)` 覆盖。覆写行为本身正确（危险态回到与取消同档的 `--bsw-line` + 纸卡圆角），只是注释把两钮说成同一条规则，易误导后续维护。
3. **文档算术口径**：严格按「新增 `danger: true` 字面量」算 = 首轮 8 + 本批 5（checkup 清除 / encrypt 仍要重设 / review 移出 ×2 / review 总线移除）= **13**；「17」是把 encrypt `askConfirm` 通道下 4 处**经参数化获得 danger 语义**的确认点一并计入的**确认点**口径。两种数都对，但 ADR 决策 5 与 §8.2/§8.4 应写明是哪种口径（建议改成「13 处字面量 + 4 处经 `askConfirm` 参数化 = 17 个确认点」）。
4. **`src/core/styles.css` 危险规则注释半保留旧措辞**：「域皮那条 (2,1,0) 压不回高亮」这句不准确——(2,1,0) 的域规则**压得过** core OK 钮基线 (1,0,0)/(1,1,0) 的 `background`/`color`；「删除不高亮」真正成立，是因为各域映射规则**没有声明** `background`/`color`（只声明字距/字体等），注释没写出这一半。数字本身（2,2,0 压 2,1,0）正确。
