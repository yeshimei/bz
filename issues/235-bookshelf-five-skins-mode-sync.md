# 235 · 书库五肤×亮暗双模式 + 移动端头行/借书卡迭代（原型带路同步批）

## 背景

书库原型落域（issue 233/234）后的评审迭代批，随「同步」一次性回灌域代码：

1. **皮肤收敛为五肤并各配亮暗双模式**（用户拍板）：保留雪松白/黑金夜曲/牛皮手帐/丝绒剧院/
   极简黑白；暗木书房/侘寂素麻/包豪斯/工程蓝图/霓虹夜馆退役。Obsidian 主题切模式
   （`bz-bs-mode-light/dark`），选肤只定风格，默认雪松白+亮。
2. **移动端头行**：分类签一行横滑但尺寸回归本脸（不缩档）；滚动条隐藏。
3. **借书卡**：移动端不再全屏、改留边浮卡（`min(430px, 100vw-32px)`，流程口径）；
   ✕ 关闭钮恢复并落左上角净位（右上让给「已抽出」红签），✕/遮罩/Esc 三路可关。
4. **关闭出口**：独立关闭钮方案两版（sticky/滑轨兄弟）评审后均否，改拍板——移动端
   **点「书库」匾收面板**（桌面不响应）；墙纸连纹理满铺到面板顶边，44px 安全区避让域内接管。

## 改动

1. **src/bookshelf/ui.ts**：`SKIN_IDS` 收敛五肤；`bsSkinClass/applyBookshelfSkin` 挂
   `bz-bs-skin-{id} bz-bs-mode-{light|dark}`（`bsModeClass()` 读 `body.theme-dark`）；
   匾额挂 `data-bs-plaque`，委托内移动端（`isMobileEnv()`）点匾 `closeOverlay()`，桌面不响应。
2. **src/bookshelf/settings.ts**：皮肤 choiceCards 收敛五张卡；存量退役肤值
   （dark/wabi/bauhaus/blueprint/neon）零感知迁移——`normalizeSkin` 读取回落雪松白。
3. **src/bookshelf/styles.css**：退役五肤 token/结构层/设置预览卡清零；新增「亮暗模式变体」
   节（五肤 × mode 补对侧 token+结构位）；移动端块——头行单行横滑（labels/cats
   `display:contents` 升入）、分类签尺寸回归、借书卡留边浮卡 + ✕ 左上角、面板根墙色 +
   头行等值 margin 避让（core `.bz-panel-mtop` 顶距域内接管，墙纸连纹理满铺顶边）。
4. **src/bookshelf/PROTOTYPE.md**：五肤×亮暗、移动端专项、坑清单（core 首子 padding
   `!important` 陷阱等）全面更新。
5. **tests**：default-view 皮肤选项集改五肤；ui.test 皮肤/mode/退役回落断言重写 +
   新增「移动端点匾关面板/桌面不响应」用例。108/108 绿。
6. 原型自检：桌面 38/38、`?mob=1` 38/38（CDP 实跑；含 mode 切换、避让 ≥44px、匾额关闭闭环）。

## 门禁

tsc 干净；bookshelf 108/108、smoke 13/13 绿；全量仅 enh-sweep-c 红为 cinema 域在途 WIP
字号（非本批，随该批收口）。产物同批重建入库（先 build 后 commit）。
