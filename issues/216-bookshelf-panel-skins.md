# 216 书架墙面板皮肤（十选一，对齐待办皮肤范式）

日期：2026-09-06　域：bookshelf　来源：bookshelf-10 原型拍板（P4 书脊墙 9 风格 + 原版暗木）

## 需求

把书脊墙原型的 10 套皮肤写进书库设置面板：切换与呈现方式参考待办（todo issue 210 choiceCards 预览卡范式），默认雪松白（nordic）。

## 实现

- 设置键 `bookshelfSkin: string`（默认 `'nordic'`），schema 显示组顶部 choiceCards 行，10 选项带 `bz-skinprev-bs-*` 预览卡；onChange 热切换已开面板（`applyBookshelfSkin`），未开仅落盘下次打开生效。
- 皮肤类 `bz-bs-skin-{id}` 同时挂面板根与域内 uiModal 弹窗根（详情/删除确认/读书笔记/编辑批注），与面板共用同套皮肤。
- CSS 两层（todo 拍板范式）：token 层单类就近覆盖 `--bz-surface-*/--bz-text-*/--bz-brand*/--bz-border*` 全面板通吃；结构层只做氛围点缀（暗木纹理/蓝图网格/丝绒条纹/包豪斯粗框/霓虹辉光）。
- 非法值回落 nordic（`normalizeSkin`）；`bsSkinClass()` 供弹窗统一取类。

## 十皮肤

nordic 雪松白（默认）/ dark 暗木书房 / noir 黑金夜曲 / wabi 侘寂素麻 / bauhaus 包豪斯 / blueprint 工程蓝图 / neon 霓虹夜馆 / kraft 牛皮手帐 / velvet 丝绒剧院 / mono 极简黑白。取值源：`.zcode/ui-prototypes/bookshelf-10/p4-style-*`。

## 测试

- default-view.test.ts：schema 契约更新（显示组 4 行、choiceCards 十选项、默认 nordic）。
- ui.test.ts：新增皮肤组 3 例（默认挂载/配置挂载、热切换+非法回落+旧类不残留、bsSkinClass 弹窗口径）。
- walkthrough-fix-c.test.ts：面板根类断言放宽为允许尾随 `${bsSkinClass()}`（issue 216 契约变化）。

门禁：pnpm test 4191 全绿 + tsc 干净（合流 master 后关键域复跑绿）。
