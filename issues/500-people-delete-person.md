# issue 500：脸谱详情头删除钮（三档门禁：未画 / 未完成 / 已画）

- 关联：issue 448（详情头图标工具条）、issue 451（印章四态）、issue 455（双卷拆折）、ADR-0194（保库记录）
- 域：people（脸谱）

## 背景

详情头工具条（画脸谱 / 记一笔 / 互动统计 / 补充背景 / 返回列表）里**没有删除**：
`ui.ts` 的 `[data-people-del]` 委托与 `handleDelete`、`styles.css` 的 `.bz-people-del` /
`.bz-people-del-arm` 都在，但 issue 448 图标化改版时把渲染那行摘掉了——按钮成了死代码，
用户没有任何入口删掉一位联系人（合并入口同样只剩委托）。

同时「删除」的代价并不均等：没画过 / 只画了一半的脸谱删了不可惜，画完的脸谱是不可逆产物。

## 改动

1. **详情头删除钮**（`render.ts`）：`trash-2` 图标插进工具条、返回钮左侧（返回钮是定位锚点，
   DOM 序惯例「其他入口居其左」，本轮不动它）。`data-people-del="<id>"` 沿用既有委托。
2. **门禁三档**（`render.ts` 新增纯函数 `deleteTierOf`）：
   - `drawn`（已画谱）= 卷一 / 卷二 / 纪事任一有正文 → 删前**重输主密码**；
   - `unfinished`（画谱未完成）= 无正文但有未完成任务（`job.status !== 'done'`）→ 二次确认即可；
   - `undrawn`（未画谱）= 都没 → 二次确认即可。
   「有正文」判据用 `personOf / bondOf / chronicle`（`personOf` 兼容读旧单卷 `portrait`）；
   空 `digest`（字段全空）不算已画——不给用户上无谓的密码门。
3. **密码门**（`ui.ts` 新增 `confirmDeleteWithPassword`）：复用 core `uiLockScreen`
   （`kind: 'people'`，与面板解锁屏同皮同语汇：`bz-lockscreen--people` 由 issue 482 已备），
   重输主密码走 `getSafeManager().verifyPassword` **只读校验**（不改解锁态、不进解锁冷却节流，
   同 encrypt 域密文销毁口径）。错误 / 空密码给屏内错误行，点遮罩 = 取消。
4. **二次确认**（未画 / 未完成档）：沿用既有武装态——首点红灯 + 「再点确认删除」文案 +
   warning 通知说清代价，3 秒回落。
5. **删除口径**（`ui.ts` 新增 `deletePerson`）：**先 `jobs().removeJob(id)` 再 `store.remove(id)`**——
   引擎是保库记录的唯一写方，任务留在队列里会把 job 段（乃至 done 产物）写回来，删了等于白删。
   删整条保库记录（人物卡 + 聊天仓 + 脸谱 + 随手记 + 头像附件）；
   **数据源目录与聊天原文不动**，可重新导入。删完详情回封面墙。

## 守住的三条边界

- **不删数据源**：数据根（`chat.json` / 媒体 / `stats.json`）属原始素材，删了要重新 sync，本轮不碰。
- **不动返回钮位置**：448 起的「返回钮在工具条最右」是定位锚点，删除钮插其左。
- **密码门只读**：`verifyPassword` 不写 `unlocked / password / manifest`，只做防误触确认。

## 验证

- `tests/people/render.test.ts`：工具条次序（含删除）、`deleteTierOf` 三档与兼容读（`bond` / `chronicle` / 旧 `portrait`）、
  空 digest 不上门、各档 hover 文案、武装态红灯类与文案。
- `tests/people/delete-person.test.ts`（新增，MockVault + 真 `SafeManager`）：
  未画谱二次点击才删 + 3 秒回落；已画谱弹 `bz-lockscreen--people` 密码门（标题 / 副题带生成日期 /
  错误密码不删 / 正确密码删 / 遮罩取消不删 / 空密码拦下）；`removeJob → removeContact` 调用序。
- `tsc --noEmit` + 全量测试 + 原型产物重出（`node scripts/build-preview.mjs`）。

## 遗留

- 未画 / 未完成档的确认用的是图标武装态（红灯 + 通知），若嫌不够醒目可换详情内确认条。
- 数据源目录里的旧命名遗留目录（重名消歧加 `(wxid)` 后缀后留下的裸名目录）已在数据侧归档移出，
  工具侧尚未有「改名时迁移旧目录」的逻辑——面板仍会列出没有 `stats.json` 的存量目录。
