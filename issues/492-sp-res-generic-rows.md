# 492 · 在线资源组回归通用声明行 + 跨入口状态同步

- 状态：已完成（2026-09-27 部署 1.25.0）
- 域：settings-panel（online-resources 重写 / renderer / styles）+ core（settings-schema ButtonRow / remote-asset 落盘事件）+ ui.ts loader
- 来源：用户看图指出「在线资源」组视觉偏离通用行（左边多 16px 幽灵缩进、字号偏大），要求对齐、
  不许再用自绘；追加两条需求：主题行描述带上已下载套数；导航入口更新文档后组内按钮要翻「已下载」
- 关联：ADR-0205（本票决策）· ADR-0203 / issue 480（在线资源组成立，自绘 custom 行）· issue 434（行按钮三态助手 `setRowBtnState`）· ADR-0047（域事件总线）

## 起因（用户讨论，先议后做）

issue 480 把三项在线下载收进设置面板通用域时，组内用 `type: 'custom'` 单行自绘
（`.bz-sp-res-*` 骨架）。用户看实测截图发现：① 左侧内容比其余设置项多一段空白
（自绘行的空 `.bz-sp-set-info` 与插槽之间吃 16px `gap`，内容起点 34px vs 通用行 18px）；
② 字号 14px vs 通用行 13px，看起来「加粗了」。结论：**整组回归通用声明行**，
自绘骨架删除——行视觉、行距、控件基线一律由面板通用行渲染器保证，域侧不再有漂移面。

顺带两条用户追加需求一并落地：

1. **主题行描述带套数**：与归物分类表的「（26 组 515 条）」同性质——就绪态描述明示
   已下载套数（`全部主题已是最新（已下载 N 套）`）；
2. **跨入口状态同步**：更新日志/使用手册有可用更新时，若用户没点组内按钮、而是从
   导航入口打开并触发了后台更新，组内按钮要跟着翻「已下载」——组态永远对齐磁盘事实，
   不因「谁触发的下载」而落后。

## 落地

### core

- `core/settings-schema.ts`：`ButtonRow` 增可选 `disabled`（状态未到禁用，如「已下载」/
  「状态未知」）；core 原生渲染器落 `b.setDisabled(row.disabled === true)`，面板渲染器落
  `disabled` 属性——两渲染器同调，禁用是行能力不是单侧补丁。
- `core/remote-asset.ts`：新增 `DOWNLOADS_CHANGED_EVENT = 'downloads:asset-changed'`，
  **派发收口在 `writeAssetText`**——所有下载资产（文档/皮肤/分类表 + 清单缓存自身）的唯一
  落盘口；`ensureAssetWithHash` 等上层通道自然带上，无需逐个动作埋点。
  派发方不感知订阅方（总线 fire-and-forget，ADR-0047 口径）。

### settings-panel

- **`online-resources.ts` 重写**：`onlineResourcesGroup()` 改 async（构建期现算本地状态，
  与剪藏本数据源组同范式），返回**纯声明行**：
  - 全部行 = `type: 'button'`（五条：检查更新 + 更新日志 / 使用手册 / 主题 / 归物分类表）；
  - 「检查更新」行恒在 `rows[0]`，`visibleWhen: () => meta.retryVisible` 门控显隐
    （有清单且核对成功即隐藏；无清单或核对失败 → 置顶呈现失败文案 + 「重试」），
    取代原自绘失败横条；
  - 行按钮禁用态走 `ButtonRow.disabled`（已下载 = 禁用），动作中转圈复用
    `setRowBtnState(btn, 'busy', …)`（issue 434 三态助手）；
  - 行对象可变：`syncGroupRows()` 重算后**就地改写**行对象（面板 schema 会话内缓存，
    下次重渲即新值）**+ `patchRenderedGroup()` DOM 补丁**（打开中即所见即所得）；
    `syncSeq` 序号防并发同步旧结果后到覆盖新态；
  - 后台核对 60s 节流（开面板顺手核对一次，失败也记窗防补丁链雪球）；核对失败
    `console.warn` 留档（UI 面走失败行，不重复弹通知）；
  - **跨入口同步**：`subscribeOnce()` 订阅 `DOWNLOADS_CHANGED_EVENT` → `syncGroupRows()`；
    导航入口更新文档、分类表自动拉取、皮肤落盘都会触发——组内按钮随之翻「已下载」。
- `ui.ts` general loader：`schema.groups.push(await onlineResourcesGroup())`（组名/位置不变）。
- `settings-panel/styles.css`：`.bz-sp-res-*` 整段退役（约 80 行）；仅补通用按钮禁用态
  `.bz-sp-btn:disabled`（压暗 + 不吃 hover 底，置于 hover 规则之后同特异度覆盖）。
- `renderer.ts`：button 分支补 `row.disabled` 落属性。

## 保持不动

- 状态机语义、下载动作、半自动铁则（只对比不下载；下载仅本组按钮与导航入口两处）、
  行序（分类表第四行）、行名（「主题」）、失败文案「检查更新失败」均照 ADR-0203 原样。

## 已知变化（知情项）

- 组卡「N 项」徽标不再显示：项数口径不计 `button` 操作行（面板组卡与 ⚙️ 弹窗同口径，
  非本票新增），而本组五行全为操作行 → 计数恒 0 → 按既有口径隐藏徽标；
- 打开面板顺手核对从「每次进入该组」变为「按面板会话 + 60s 节流」（schema 会话缓存所致）。

## 测试

- `tests/settings-panel/online-resources.test.ts` 重写（11 例）：真渲染器 `renderPanelSchema`
  验组形状（5 button 行）/ 状态机各态 / 失败态与重试恢复 / 动作后翻转 / 主题行套数描述 /
  跨入口同步（`writeAssetText` 落盘 → 行按钮翻「已下载」）。
- `tests/sp-contract-lock.test.ts`：通用域可见项数 8 → 7（button 行不计）。
- `tests/smoke.test.ts`：在线资源组冒烟改 button 行口径（5 行；清单拉取失败 → 四资源行禁用
  + 检查更新行失败文案）。

## 门禁

worktree 内 `pnpm test` + `tsc --noEmit` 全绿后合并；主仓库 `pnpm run build` 部署；
提交后立刻 `pnpm changelog`。
