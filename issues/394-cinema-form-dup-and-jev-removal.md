# 394 · 影院表单重名反馈 + 影院 Jev 接入撤销 + TED 分类移除

> labels: fix ｜ map: — ｜ status: done ｜ assignee: — ｜ blocked-by: —
> 上游：issue 393（已随本票删除）／ADR-0174（已随本票撤销）／ADR-0087（影院域）
> 实现于 `wt/bz-cinema-prefill`

## 背景

三件独立的事同批落地，都是影院域的表单与分类。

**一、影院 Jev 接入是死功能。** issue 393 引入的 `bz-cinema-type-decide` 命令，跳过条件为「已有命中 `ALL_TAGS` 的分类即跳过」。实测真实库 686 篇影视**全部已有受控分类**——即假设中的「未打 tag 的影视」在库里是 **0**，该命令一次都不会触发。判定核心（`buildTypeCriteria` / `judgeTypeChoice` 等）虽可复用，但按用户 2026-09-21 拍板**连带删除**，不留残余。

**二、`TED` 分类从零使用。** 同批实测：686 篇里 `TED`、`公开课`、`日剧` 三类各 **0 篇**。`TED` 被移除；`公开课` 保留（用户仍可手选），但不再是后续自动分类的候选。

**三、重名校验没有实时反馈。** 影院添加/编辑表单原来只在**保存时**用 `notice()` 拦截重名，输入过程中没有任何视觉信号，用户要点一次保存才知道撞名。知识盒域另有一个「输入框下面一行小字」的形态（`knowledge/ui.ts` 的 `#lit-term-dup`，注释明写「仅提醒不阻断」）——本次**刻意不沿用**。

## 决策（2026-09-21 用户拍板）

1. **输入即反馈**：输入框边框转危险色（`input` 事件实时比对，不等保存）。
2. **重名即锁保存**：保存按钮置 `disabled`，文案改成「已存在同名影视」——按钮上写明白为什么点不动，而不是点了才弹提示。
3. **不做文字小字提醒**（不采用知识盒那套输入框下方 hint 行）。
4. **判据单源**：`isDuplicateName(name, selfName)` —— 新增时比对全库、编辑时排除自身原名。输入框红边框、按钮锁定、保存拦截**三处共用同一判据**，各写一份必然漂移。
5. **文案单源**：`DUP_NAME_HINT`（按钮态短句「已存在同名影视」）／`DUP_NAME_HINT_FULL`（拦截 notice 完整句「已存在同名影视，请换个名称」）。
6. **保存拦截保留**：按钮禁用已让点击无效，`notice` 拦截退化为防御路径（防程序化调用绕过 disabled），不删。

## 落地

| 文件 | 改动 |
|---|---|
| `src/cinema/type-decide.ts` | **删除**（含命令入口与判定核心） |
| `tests/cinema/type-decide.test.ts` | **删除**（19 条用例） |
| `issues/393-cinema-type-fill.md` | **删除** |
| `docs/adr/adr-0174-constrained-classification.md` | **删除**（其唯一消费者即被删的该命令） |
| `src/cinema/index.ts` / `src/main.ts` | 摘掉命令注册与 re-export |
| `tests/smoke.test.ts` | `EXPECTED_COMMAND_IDS` 去掉 `bz-cinema-type-decide` |
| `docs/adr/adr-0173-link-judge-jev-channel.md` | 摘掉「类型归类」「影院类型」两处表述（Jev 用途收窄为关联判定） |
| `CONTEXT.md` | 删「受限分类」词条；「Jev 决策通道」词条的接入点数改为单处 |
| `src/cinema/constants.ts` / `src/cinema/shared.ts` | `TYPE_GROUPS` 与 `GROUP_SUBS_OF` 各去掉 `TED` |
| `src/cinema/ui.ts` | 新增 `DUP_NAME_HINT` / `DUP_NAME_HINT_FULL` / `isDuplicateName` / `refreshDupMark` |
| `src/cinema/styles.css` | 新增 `.f-input.is-dup`（危险色边框 + 聚焦同色光晕）、`.dm-btn:disabled`（对齐 core 禁用惯例 `opacity:.5; cursor:not-allowed; pointer-events:none`） |

原型产物随批重出（`prototypes/cinema/prototype-behavior.js` 等）；`styles.css` 被原型 `prototype-view.html` 直接 `<link>`，不打包、自动生效。

## 测试

- `tests/cinema/ui.test.ts`：新增 3 条（新增态红边框、编辑态排除自身原名、改回不冲突即解锁按钮并复位文案）；**改写 2 条既有用例**——行为契约从「点保存后弹 notice」变成「输入即锁按钮」，`clickEl(saveBtn)` 在禁用态不派发事件，断言随之改为按钮 `disabled` + 文案 + 不落盘。
- 全量：472 文件 / 7013 用例通过；`tsc --noEmit` 零错。

## 遗留

- **TED 一旦出现在存量数据**（当前 0 篇）会因不在 `ALL_TAGS` 而经 `getGroupSafe` 归入「其他」组——灰色、无专属配色。属可接受降级，不做兼容分支。
- 按钮禁用态顺带挡住 Enter 提交（`bindFormSubmit` 走 `.j-save.click()`，disabled 元素不派发 click）——顺带收益，非独立设计。
