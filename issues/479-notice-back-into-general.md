# 479 · 设置面板「通知」页并回通用

- 状态：**已完成（2026-09-27）**
- 域：settings-panel（`ui.ts` 导航/加载器）+ core（`settings-main-schema.ts`）+ manual（`bz-manual.html` 三处）+ tests + prototypes 重出
- 来源：用户下令「把通知和设置两个面板合并到通用中」→ 实查「设置」页 2026-09-12 已并入通用（外观组），本次实际动「通知」页；grill 三问全按推荐拍板（终态 / 组序 / 落 ADR）。
- 关联：**ADR-0202（本票决策）** / ADR-0080 / ADR-0153 / issue 186（反向先例）

## 问题

2026-09-12 通知组自通用拆出独立成页后，基础组 = 通用 / 通知 / 首页 三页；通知页全部内容只有四行横切偏好（`noticeLevel / noticeDuration / noticePosition / noticeMaxVisible`，全 select）。独占一页导航不值，与「外观组并入通用」的拍板逻辑相逆。

## 决策要点（详见 ADR-0202）

1. 通知组移回 `generalSettingsSchema()`，排「数据存储路径」前；`noticeSettingsSchema()` 删除。
2. `DOMAINS` 退役 `notice` 条目、`NAV_SECS` 基础组 = `[global, home]`、通用 desc 增「通知」。
3. 通用页终序 = 外观 → 通知 → 存储（体检按钮仍锚存储组尾）；四键与行为零变化。
4. `mainSettingsSchema()` 收敛为 ai + general；copy-lint-d 撤独立 notice 目标（文案 lint 由主聚合目标无缝覆盖）。
5. 手册三处同步（通用章 FAQ 反转 / 通知章导览句 / 「这一域」措辞）。

## 落地

- `src/core/settings-main-schema.ts`：通知组并入 `generalSettingsSchema()`（组序：通知 → 存储）；`noticeSettingsSchema` 删除；`mainSettingsSchema` 聚合收敛；沿革注释更新
- `src/settings-panel/ui.ts`：`schemaLoaders.notice` / `DOMAINS` notice 条目删除；`NAV_SECS` 基础组 `[global, home]`；通用 desc 更新；加载器注释同步
- `manual/bz-manual.html`：通用章 FAQ「能否改通知设置」反转；通知章「左栏找到通知这一页」→「通用页 → 通知组」；「这一域没有命令」→「通知没有自己的命令」
- `CONTEXT.md`：设置面板词条补「通用页三组」结构与 _Avoid_（通知页/通知域）
- `tests/settings-panel.test.ts`：导航计数 20 → 19（三处）与徽标轮询阈值、通用分组 2 → 3、分组图标序列 `['palette','bell','folder-open']`、基础组断言 `[通用, 首页]`（两处）、`iconOf('notice')` 断言删除
- `tests/sp-contract-lock.test.ts`：基准表 `global: 7`（原 3 + notice 4）、`notice` 行删除
- `tests/core/settings-copy-lint-d.test.ts`：撤 `noticeSettingsSchema` import 与目标（覆盖并入 main 聚合目标）
- `prototypes/settings-panel/prototype-behavior.js`：`node scripts/build-preview.mjs settings-panel` 重出（行为包内联 schema 闭包随源更新）
- `docs/adr/adr-0202-notice-group-back-into-general.md`（本票 ADR）

## 验收

- 四键存储键名 / 默认值 / 即时生效零变化；搜「通知」仍可命中（行缓存随通用 schema）
- 无 `openSettingsPanel(app, 'notice')` 调用点（深链安全双保险：未知 id 回退通用）
- pnpm test 全绿 + tsc --noEmit 干净 + 原型新鲜度守卫绿
