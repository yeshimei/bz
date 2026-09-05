# ADR-0095 — 待办面板皮肤体系 + choiceCards 视觉卡片设置行

日期：2026-09-06 ｜ issue 210 ｜ 状态：已接受

## 背景

5 套待办风格化静态原型（`.zcode/ui-prototypes/todo-styles/`）评审，用户拍板收 2 套
（纸感手账 paper、编辑部 editorial）+ 现行默认，做成**待办设置页最顶部的视觉卡片选择**
（index 原型方式：迷你预览 + 名称，无编号无描述）。

## 决策

1. **皮肤 = 设置键 + 面板根作用域类**。新键 `todoSkin`（string，`default`，未知值按默认渲染）；
   面板根挂 `.bz-todo-skin-{paper|editorial}`。皮肤样式 = 作用域内就近覆盖 `--bz-*`
   色彩/圆角 token（组件库类自动取皮肤值，零对抗 `!important`）+ 少量结构覆盖
   （墨边硬阴影/衬线/方角/底线输入）。皮肤是固定明度的风格化视觉，不随 Obsidian 明暗切换；
   色值为皮肤专属（共享 token 无对应档），域内直给。二级弹窗（挂 body 的 uiModal）不跟随。
2. **schema 新增 `choiceCards` 行类型**（判别联合第十一类）：预览卡 + 名称的单选行；
   组件库新工厂 `uiCardChoice`（`.bz-cardpick`，radiogroup + 方向键），core ⚙️ 渲染器与
   设置面板自绘渲染器同源支持；面板形态 = 纵向行头（仅 name）+ 全宽卡片组。
   预览变体视觉（`prevClass`）由使用方域样式提供——组件库只管基座与交互态。
3. **热应用**：`todo/ui.ts` 导出 `applyTodoSkin(skin)`，设置行 onChange 即时切换已开面板；
   打开路径同函数统一挂载；面板未开时仅落盘，下次打开生效。

## 后果

- 其他域未来要皮肤/布局视觉选择时：复用 `choiceCards` 行 + `uiCardChoice`，只写自己的
  预览变体与皮肤作用域 CSS，不动架构。
- 默认皮肤零变化（回归由全量测试守护）；`--bz-*` 就近覆盖意味着皮肤内所有组件库控件
  自动成套换肤，新增控件无需逐个适配。
