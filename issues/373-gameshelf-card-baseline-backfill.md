# 373 · 游戏库真机卡片基线 + 后台全量回填（2026-09-18）

## 现象（用户截图：图1 = OB 真机，图2 = 评审壳）

真机卡片三连症状：标题过长溢出、标题居中（应左对齐）、**底部时长条不见了**；
同一份代码在评审壳里一切正常。

## 根因：宿主裸 `<button>` 基线没被整组覆盖

真机 Obsidian 的裸 button 基线（host-base.css 逐条搬自 asar）：
`inline-flex + align-items:center + justify-content:center + height:var(--input-height)(30px) + padding:4px 12px`。

`.bz-gs-card` 覆盖了 display/padding/border/background/text-align，**漏了
align-items / justify-content / height / width** → 整卡被钉在 30px 高、内容居中、
进度条被挤出可视区。壳里看着正常是因为域样式与 host-base 的层叠顺序恰好占优——
**别指望壳替你兜住 UA/宿主基线，每条都显式写**。

## 修法

- `.bz-gs-card` 补 `align-items:stretch; justify-content:flex-start; width:100%; height:auto; min-width:0`；
- 网格轨道 `minmax(200px,1fr)` → `minmax(min(200px,100%),1fr)`（桌面）/ `min(148px,…)`（移动），
  长名不再撑大轨道横向溢出；
- 壳自检 +3 条：样式自足（左上对齐）/ 卡高 >100px / 时长条在卡底可见。

## 后台全量回填（用户拍板：数据全在笔记属性，不要 gameshelf.json）

- 新增 `backfill.ts`（names.ts 同范式串行队列）：对**缺 `详情时间`** 的笔记逐款
  `loadStore`（storeToFm 全字段，自带详情时间标记）→ 有成就页再 `loadAchievements`
  （成就三键）。900ms 间隔、连错 3 停、面板关闭即停（下次打开幂等续跑）。
- 触发点：面板打开（afterOpen）与「立即同步」成功后。
- 成就逐条明细与截图 URL 仍走会话内存（体积不可控，写属性会撑爆笔记头——这是
  「数据在属性」口径下唯一的一块例外，已向用户说明）。
- 壳：种子除首位外预置「详情时间」（模拟已回填完的库，防壳里 147 款跑 2 分钟），
  首位留缺 → 自检验证回填链（真实罐头 → 真解析 → 真写盘）+1 条。
- 单测 `backfill.test.ts` 4 例：全键落盘 / 幂等 / 无成就页不碰成就接口 / 连败即停。

## 门禁

tsc 零错误；全量 5707 例全绿；壳自检 62/62（58 → +4）。
