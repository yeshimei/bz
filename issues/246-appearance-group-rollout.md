# 246：设置面板「外观」组范式铺开全面板域

日期：2026-09-08 ｜ 分支：feat/appearance-rollout ｜ worktree：appearance-rollout

## 背景

issue 210（待办）/ 235（书库皮肤）/ 244（设置域）/ 245 后续批（小橘、归物本）各自出现外观类配置。
用户拍板统一组织范式（截图待办形态）：域设置页顶部「外观」组 = 上「布局」行 + 下「主题」行，
各一行 choiceCards；布局与主题一一对应，主题行按 `layoutKey` 过滤成当前布局配套的单卡，
点布局卡自动切配套主题（`layoutPairMap` 查表）。

## 范围（原型 16 域盘点）

已有外观组：设置（settingsPanelLayout/Skin）、待办（todoSkin/Theme）、小橘（皮肤单行）、归物本（belSkin/Theme 占位）。
本批铺开 10 域：

| 域 | 形态 | 键 |
|---|---|---|
| 日记本 diary | 占位单卡×2 | diarySkin / diarySkinTheme |
| 剪藏本 clipbook | 占位单卡×2 | clipbookSkin / clipbookSkinTheme |
| 收藏本 favorites | 占位单卡×2 | favoritesSkin / favoritesSkinTheme |
| 影院 cinema | 布局=cinemaStyle 真键单卡（午夜场；gaz/booth 未上岸不暴露）+ 主题占位 | cinemaStyle（已有）/ cinemaSkinTheme（新） |
| 书库 bookshelf | 主题行收编现有 bookshelfSkin 五肤（单行组，小橘先例） | bookshelfSkin（已有） |
| 复习计划 review | 占位 | reviewSkin / reviewSkinTheme |
| 第二大脑 secondbrain | 占位 | secondbrainSkin / secondbrainSkinTheme |
| 文献盒 literature | 占位 | literatureSkin / literatureSkinTheme |
| 番茄钟 pomodoro | 占位 | pomodoroSkin / pomodoroSkinTheme |
| 保险库 encrypt | 占位 | encryptSkin / encryptSkinTheme |

跳过：通用 / AI（基础配置域，无面板视觉语义）。

## 决策

- 占位值：布局 value 统一 `default`（未知值回落渲染=现状），主题 value 域化一名（ivory/newsprint/linen/nightfall/sage/graphite/manila/tomato/steel）。
- 占位键均为 schema 驱动的活交互（可看可选可落盘），域 UI 消费在该域真做皮肤时接入（onChange 届时挂）；
  归物本 belSkin 先例（用户拍板 C）。
- 预览：布局卡统一 `bz-sp-prev-panel`（抽象面板缩略）；主题卡各域一名一色（示意值，真做皮肤时替换）。
- 原型↔域侧双侧同步落地（settings-panel 例外流程：原型真理 → 域侧复刻）。

## 门禁

pnpm test 全绿 + tsc 干净 + 原型 headless 实测 → 合并 master → 主仓 build 部署。
