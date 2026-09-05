# issue 197：待办面板头行钮组 + 场景栏图标化 + 主头行基线对齐

> 用户对照唱片收藏原型提出的四项 UI 修正（2026-09-05 当面拍板）。

## 需求与拍板

1. **头行钮组**：标题「待办」前加品牌图标块（`.bz-panel-brand`，lucide `list-checks`）；
   右对齐加「设置」「关闭」两个图标钮（`.bz-panel-head-btns` + `.bz-icon-btn`）。
   设置钮点击 = 关面板 → `openSettingsPanel(app, 'todo')` 直达设置面板待办域
   （复用场景菜单「在设置中编辑」同款动态 import，改名 `openTodoInSettings` 共用）。
   **注意**：不用 `bz-icon-btn--close` 类——core/styles.css 有「非真全屏隐藏关闭钮」旧拍板
   规则，会藏掉桌面钮；本次用户明确要桌面头行关闭钮，走普通 `.bz-icon-btn` 绕开。
2. **场景栏前导元素**：全部/今日/重要三个伪场景换 lucide 图标（全部=`layers`、今日=`sun`、
   重要=`star` 保留 `.bz-ic--warning` 警示色）；**重要前原有的警示色圆点删除**（图标即前导
   元素）；用户场景**保留彩色圆点**（SCENE_DOTS 原样）。移动横滑条（.bz-mobstrip）同口径，
   组件库补 `.bz-mobstrip-chip .bz-ic` 尺寸规则（此前 chip 无图标槽样式）。
3. **计数去药丸底**：场景计数从 `.bz-rail-count--pill`（收藏式白底胶囊）改素数档
   `.bz-rail-count`（灰字裸数，对齐唱片收藏原型）；`--pill` 类保留给 favorites。
4. **「添加场景」移位**：从 `.bz-rail-foot` 底栏（带分隔线钉在栏底）移入 `.bz-rail-scroll`
   尾部，紧贴最后一个场景之下、随列表滚动；外距由 `.bz-todo-side-add` 自管
   （`sm xs md`），todo 面板不再渲染 `.bz-rail-foot`。
5. **主头行基线对齐**（共享修复，issue 197）：`.bz-main-head` 由 `align-items:center`
   改 `baseline`，标题(16px)与计数(12px)同线排印（CDP 实测：基线差 1.5px → **0px**，
   盒中心差 −0.5px 但基线错位即用户感知的「不在同一水平线」）；按钮 `align-self:center`
   独立居中、spacer `align-self:stretch` 不入基线组。四域共用类（todo/cinema/favorites/
   belongings）同步受益，结构均为「文本标题+文本计数+spacer+按钮」，无副作用。

## 改动

- `src/todo/ui.ts`：头行模板/点击委托/ICON +3（brand/sceneAll/sceneToday）/
  SCENE_PSEUDO_ICONS 表 / sceneLeadHtml 重写 / 计数类 / 添加场景钮移位 /
  openSceneInSettings → openTodoInSettings（头行+场景菜单共用）
- `src/todo/styles.css`：`.bz-todo-side-add` 脱离 foot 自管外距（width:100% → auto+margin）
- `src/core/ui/components.css`：`.bz-main-head` 基线对齐（含 .bz-btn align-self、
  spacer stretch）；`.bz-mobstrip-chip .bz-ic` 尺寸两行
- `tests/todo/ui.test.ts`：「重要」用例改断言（无色点）；+3 用例（场景栏前导元素口径、
  头行钮组直达/关闭、添加场景挂列表尾部）；vi.mock settings-panel 断言直达参数

## 验证

- pnpm test 253 文件 4118 用例全绿；tsc --noEmit 干净
- Edge headless CDP 实测（.scratch/todo-head-check/）：基线差 0px、头行钮右贴边 16px、
  品牌块 24×24、添加场景钮在末场景下方 8px、6 色点 + 3 伪场景图标 + 0 药丸
