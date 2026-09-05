# Issue 204: 书架墙统计行与封面五处布局修复

日期：2026-09-05　状态：已交付
前置：无（用户截图走查直接反馈）

## 需求（书架墙面板截图走查清单，逐项定位根因后修复）

1. 月柱图最高柱的数值「13」与卡片标题「每月读完」重叠；
2. 纪念日卡标签「1 年前的今天」折行成「1 年前的今 / 天」单字孤行；
3. 纪念日卡双重截断：提示「你读完了这本书 · 读完于 …」被省略号吃掉日期（这张卡的核心信息），书名被代码 slice + CSS ellipsis 截到只剩两三字；
4. 左栏分类「未分类 131」（最大桶）按拼音序混在列表中部；
5. 统计三卡内容顶置、底部大片空白（行高被图表卡撑起）；
6. 零值月份（8月/本月）只余 3px 底线且无数值，读作丢数据；
7. 无封面占位卡只有居中小图标，大片留白像加载失败。

另核对两项不改码：封面 `object-fit` 已是 `cover`（白底观感是素材本身）；
《查拉图斯特拉如是说》封面斜线属图源待核实，非布局问题。

## 修复

### 一、月柱数值撞标题（src/bookshelf/styles.css）

`.bz-bs-bars` 高 70px 装不下「柱 56 + 数值标签 15px 头部净空 + 柱列标签行」
（最高柱标签需 71px+，标题下仅 14px+10px margin）→ 高度提到 78px。

### 二、纪念日卡标签折行（src/core/ui/components.css + styles.css）

- 共享 `.bz-stat-label` 加 `white-space: nowrap; overflow: hidden`（标签是短元数据，
  窄卡下宁可省略不可折出单字孤行）；`.bz-ic` 加 `flex-shrink: 0`；
- `.bz-bs-dash .bz-stat--text` 加 `flex: 1.35`，纪念日卡标签/书名长，多分一档宽。

### 三、纪念日卡信息保真（ui.ts + components.css）

- hint 文案「你读完了这本书 · 读完于 X」→「X 读完」：日期前置，窄卡截断也保得住日期；
- `.bz-stat--text .bz-stat-num` 单行 ellipsis → 2 行钳制（`-webkit-line-clamp: 2`），
  书名可读到约 14 字（该变体全仓仅书架纪念日卡使用）。

### 四、未分类恒置底（src/bookshelf/data.ts categoryList）

zh 序中「未分类」(w) 落在天文学(t) 与心理学(x) 之间——排序加置底分支，
其余分类保持 `localeCompare('zh')`。

### 五、统计卡内容垂直居中 + 零值月明示（styles.css + ui.ts）

- `.bz-bs-dash .bz-stat` 加 `justify-content: center`；
- `.bz-bs-bar.zero` 由「与普通柱同色」改为 `opacity: 0.45` 弱化；
- 零值柱数值渲染 `${b.count || ''}` → `${b.count}`，明示「空」而非丢数据。

### 六、无封面占位出书名（ui.ts + styles.css）

占位从纯 34px 图标改为「22px 半透明 library 图标 + 4 行钳制书名」居中
（新增 `coverPhHTML` / `.bz-bs-cover-ph-name`）；坏图回退（bindCoverFallback）
经 `.bz-bs-cover` 上的 `data-bs-ph-title` 同样取到书名。

## 测试（tests/bookshelf/data.test.ts + ui.test.ts）

- 数据层 +1：categoryList「未分类」恒置底（构造 zh 序前后夹击用例）；
- UI 层 +3：无封面占位含书名 / 坏图回退占位带书名（合成 error 事件）/ 零值柱显示 0；
- 纪念日卡用例补 hint 日期前置断言（`${yearsAgoDate(3)} 读完`）。
