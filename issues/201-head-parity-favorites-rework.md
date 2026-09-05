# Issue 201: 七域面板头行对齐待办 + 收藏本工作台精修 + 待办联想下拉化

日期：2026-09-05　状态：进行中
前置：issue 197（待办头行范式）、issue 199/200（浮岛 uiChoice / rail 行头三槽 / chip 档）

## 需求（用户拍板）

把 收藏本 / 影院 / 书架墙 / 复习计划 / 剪藏本 / 回忆墙 / 归物本 的面板头行按待办实现；
收藏本另有一批精修；待办编辑器联想框改下拉。

## 一、七域面板头行对齐待办（头部 = 品牌块 + 域名 + ⚙设置直达 + ✕关闭）

待办头行范式（issue 197 定稿）：`.bz-panel-brand` 品牌块 + 域名标题 + spacer + 右侧钮组
（⚙ 打开本域设置 + ✕ 关闭，**桌面/移动共用**）。七域现状差异与对齐动作：

| 域 | 现状 | 动作 |
|---|---|---|
| 收藏本 | 纯标题，右侧钮全移动专属（桌面无关闭） | +品牌块(star) +⚙ +✕ 桌面可见 |
| 影院 | 纯标题，右侧钮全移动专属（桌面无关闭） | +品牌块(clapperboard) +⚙ +✕ 桌面可见 |
| 书架墙 | 标题 + 报告/排序/搜索/筛选/关闭（桌面有关闭） | +品牌块(book-open) +⚙ |
| 复习计划 | 自有 q-head（标题+日期+关闭） | +品牌块(repeat-2) +⚙ |
| 剪藏本 | 品牌+标题+副题+搜索（桌面无关闭） | +⚙ +✕（搜索保留） |
| 回忆墙 | 自有 win-head（文字品牌+范围+关闭） | +⚙（品牌不动） |
| 归物本 | 纯标题，右侧钮全移动专属（桌面无关闭） | +品牌块(package) +⚙ +✕ 桌面可见 |

- ⚙ = `openSettingsPanel(app, '<域id>')` 动态 import（ADR-0002 延迟解析，同待办 openTodoInSettings）。
- 品牌图标取 `core/DOMAIN_ICONS`（与设置面板/磁贴同源，不新造）。
- 移动专属钮（收藏 add/sort/search、影院 ai/stat、归物 add/search）保持原样。
- **关闭钮桌面常显的坑**：core 旧全局规则 `button.bz-win-close { display:none }`（非真全屏
  一律隐藏，旧壳拍板）——待办/收藏/影院/书架墙/归物本/剪藏本关闭钮不挂该类，桌面可见；
  复习 q-head 与回忆墙头行原挂 `bz-win-close`，本票摘除（尺寸回落域内同级 26px/22×26 档）。
- **回忆墙设置域补入**：`diary-wall` 原不在设置面板 DOMAINS（schema 无人消费），本票补
  DOMAINS + schemaLoaders（diaryWallSettingsSchema 唯一行=移动端默认全屏；桌面零可见项
  按 issue 194 规则自动隐藏，移动端可见 → 列表 15→16）。

## 二、收藏本精修

1. **左栏标签列表按待办实现**：9 分类行头用 emoji（uiRail 新增 emoji 槽，位于 icon 之后
   badge 之前；行名剥 emoji 直显标签名）；全部/已归档保持 lucide 图标前缀；**计数去胶囊档**
   （`.bz-rail-count` 素文本，同待办）。移动横滑 chips 不动。
2. **排序浮岛**：工具行「最新收藏/标题排序」循环钮 → `uiChoice float`（同待办排序）；
   移动头行排序图标钮保留循环语义（setSort 归一：写 favoritesSortKey + 重渲）。
3. **卡片 meta 行精简**：只留 标签 + 关联笔记 + 日期；域名徽章删除、置顶文字前缀删除
   （置顶卡保留左缘品牌条视觉）。日期默认相对时间（core formatRelativeTime）；
   设置「显示」组新增 **日期显示**（相对/绝对，键 `favoritesTimeFormat`，默认 relative）。
4. **修复：桌面点卡片弹操作菜单**（应只右键弹）：桌面点击改为——有链接的收藏打开链接
   （卡片本有 pointer 语义），无链接不动作；菜单只走右键。移动点行=抽屉不变。
5. **表单置顶钮重叠修复 + chip 化**：病因 = `mountIcons` 把 `<i data-lucide>` 替换成
   `<span class="bz-ic">` 后，`syncPin` 的 `querySelector('span')` 命中图标 span，文字写进
   图标位与真标签并排（两份「置顶」）。重做：置顶钮/AI 整理钮均改 `uiBtn chip` 档
   （同待办「定位到笔记」，`.bz-btn--chip` 图标圆底 + 文字素排），置顶态走 `.is-on`，
   标签更新持 label 元素引用（lastElementChild，同待办 posBtn）。

## 三、待办编辑器：第二输入框待选项改下拉浮层

脚本名/课程名联想框（`.bz-todo-sug-box` 在流内撑开）→ 收藏本「关联笔记」同款
`.bz-popover` 下拉浮层（绝对定位锚输入框下、外点/ESC 只收浮层不关弹窗、选中回填）。
域内 `.bz-todo-sug-*` 样式随之退役。

## 变更面

- `src/core/ui/rail.ts` / `types.ts`：BzRailItem +emoji 槽
- `src/core/ui/components.css`：如需补 emoji 槽细则（issue 200 已有 `.bz-rail-emoji`）
- `src/settings.ts`：+`favoritesTimeFormat`
- `src/favorites/ui.ts` / `styles.css`：一、二两项
- `src/cinema/ui.ts` `src/bookshelf/ui.ts` `src/review/ui.ts` `src/clipbook/ui.ts`
  `src/diary-wall/ui.ts` `src/belongings/ui.ts`：头行对齐（各自 styles.css 少量配合）
- `src/todo/ui.ts` / `styles.css`：联想下拉化
- `docs/ui-kit-manual.md`：uiRail emoji 槽行更新

## 测试

- tests/core/ui.test.ts：uiRail emoji 槽（行头 emoji、名字剥 emoji、icon 优先级）
- tests/favorites/ui.test.ts：素计数（无 pill 类）、排序浮岛切档落盘、meta 行只含
  标签/笔记/相对时间（absolute 设置回绝对）、桌面点击不弹菜单（有链打开/无链不动）、
  右键仍弹、置顶钮单标签无重叠（chip 档 + is-on）、设置组含日期显示
- tests/todo/ui.test.ts：联想断言迁 .bz-popover（浮层项点选回填/ESC 只收浮层）
- 各域头行：brand 块 + 设置钮 + 关闭钮存在性断言（七域 ui 测试补 1-2 例）
- smoke.test.ts 同步验证；全量 pnpm test + tsc --noEmit 门禁
