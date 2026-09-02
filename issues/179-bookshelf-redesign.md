# Ticket 177 — 收藏本 / 归物本 新 UI 落码（对照拍板原型，重写两域）

> 状态：🔄 源码完成 / 测试重写中（worktree/books-redesign；ADR-0083 已落 docs/adr/，CONTEXT 词条已更新）
> 原型：`.zcode/ui-prototypes/`（不入 git）——收藏本 P1「标签工作台」、归物本 P6「状态边栏×时间轴」均已在浏览器走查拍板并做成完整交互版
> 数据：favorites.json / belongings.json 零迁移（旧数据直接可用，无新字段）
> 策略：**就地重写** src/favorites + src/belongings（非新目录）——命令 id / 设置键 / smartcat 事件契约 / 设置面板 schemaLoader 全部不动；「旧域删除」即本次重写覆盖。收藏本 file-sync 后台逻辑保留不动。

## 一、收藏本（src/favorites）→ P1 标签工作台

### 视觉规格（对照原型）
- 主面板 720×560 常驻弹窗：头行「收藏本」仅标题（**去右上 ✏️/🔍/🔀/⚙️/❌ 五钮**，设置收敛设置面板）；左栏 168px 标签列表（全部 🗂 + 9 类 emoji 标签 + 计数，选中=品牌实底 `bz-favorites-nav-active`，点已选=取消）→ 右内容区。
- 右内容：主头行「当前标签 / N 条收藏 / 右侧主按钮 添加收藏」→ 工具栏（搜索框 常驻 占满 + 排序钮 ⇅ 循环：最新收藏 ↔ 标题排序）→ 卡片流。
- 卡片：白底描边圆角 10、hover 微亮；置顶 = 左侧 3px 品牌橙竖条（inset shadow，去 📌 文字）；标题单行省略 hover 变品牌橙（有链接）；简介 2 行截断；meta 行 = 标签徽章（蓝紫 family tint）+ 关联笔记徽章 + 时间；右侧余额读数（仅大模型类：金额 ￥x.xx + 档位色 橙/绿/红）。
- 移动端 ≤768：真全屏；头行右上图标组（按序）＋添加 → ⇅排序 → 🔍搜索 → ✕关闭；标签 chips 横滑（含全部）；搜索默认隐藏、点 🔍 展开（`.show`）；卡片同桌面但去 hover；点卡弹底部详情抽屉；**无悬浮 FAB**（添加已收头行）。
- 图标全 lucide；标签 emoji 属数据保留（🐙💻🌐🧠⌨️🤖⚡🍺🐋）。

### 交互规格
- **桌面点卡片行 = 弹操作菜单**（原型交互；core 无单击菜单，用 openItemMenu 锚点行右下 / openItemSheet 做移动抽屉，或自绘轻量 ctx——沿用 core：桌面 openItemMenu 锚点卡片、移动 openItemSheet）；**右键 = 同菜单**。
- 菜单动作序：打开（有 url）/ 置顶·取消置顶 / 跳转笔记（有 linkedNote）/ 刷新余额（大模型类）/ 编辑 / 归档 / 删除。全部行为契约同旧 ui.ts（置顶 keepOpen + 写盘 + rebuild；刷新余额 keepOpen + 查询态小字；编辑 keepOpen + companion 弹窗；归档/删除先收浮层再 flow-dialog 确认 + 撤销 toast）。
- 归档冷存不可见（ADR-0074 保留）；删除带撤销（restoreItem 幂等）。
- 搜索防抖 180ms；排序键读写 `favoritesSortKey`（created/title/domain 三键设置项在设置面板，排序弹窗取消——收敛）。
- 添加/编辑弹窗：标题/链接/简介/标签多选 chip（9 类）/置顶开关/关联笔记；大模型标签 → 展开 LLM 配置区（API Keys + 余额 URL + hint）→ 保存时校验 + 可选立即查余额；AI 整理按钮（复用 FavoritesAIService.fetchGitHubInfo + createAI）保留（含全校验/回填/降级逐字文案，见旧契约 B10）。
- 移动抽屉顶部 = 条目 emoji + 标题 + meta；含操作动作 + 底部删除。
- smartcat 域事件（add/edit/delete/archive + changes）与余额自动查询（打开面板 fetchAllBalances 缓存写回）保留。

## 二、归物本（src/belongings）→ P6 状态边栏 × 时间轴

### 视觉规格
- 主面板 820×600 弹窗：头行「归物本」仅标题；左栏 168px 状态列表（全部 🗂 + 使用中/闲置/已转卖/已丢弃 四态，图标 lucide check/box/credit-card/trash + 语义色点 + 计数，选中品牌实底）→ 右内容。
- 右内容：主头行「购入时间轴 / N 件 · 总投入 ￥M」+ 右侧主按钮「记一笔」→ 工具栏（搜索 + 年份下拉全部年份/年）→ 统计条三卡（总资产强调卡 / 日均成本 / 在册件数；label 带 lucide 图标、无括号副标，简洁）→ 时间轴。
- 时间轴：年节头（年份 + N 件 · 投入 ￥ + chevron 展开/折叠，默认展开）→ 月节点（M 月）→ 物件行。
- 物件行：分类图块（emoji，数据本体保留）→ 名称 + sub 行（状态徽章 svg+文字 + 分类名 · 购买日期）→ 已用天数（右）→ 价格区（价格 + 副行：使用中/闲置=「日均 ￥x.x/天」、已转卖/已丢弃=「陪伴 N 天」）；转卖/丢弃行整体弱化沉底。
- 移动端：真全屏；头行右上 ＋记一笔 → 🔍搜索 → ✕；状态 chips 横滑；搜索默认隐藏可切换；统计两卡（总资产 + 日均，简洁值）；时间轴同构；点行弹底部详情抽屉（含 KV 详情 + 状态流转 + 编辑 + 删除）；**无悬浮 FAB**。
- 统计口径：总资产 = 在用+闲置原价合计；日均成本 = 总购入原价 / 累计持有天数（统一到今天）；在册件数 = 全部件数；已用天数统一到今天（复用 data.calculateDaysUsed）。**数据 8 字段零迁移（无售价字段）：转卖/回本/净支出语义不落码，待后续加字段再做**。
- 状态流转：标记使用中/闲置/已转卖/已丢弃即时（原型「转卖填回本价」因无售价字段不落码——零迁移铁律；语义已注记）。
- 分类选择：1226 条内置默认分类搜索选择下拉（输入过滤 + 箭头键/Enter/Esc 分层语义），新建允许输入新分类（存自定义）；编辑回填当前分类。

## 三、迁移边界（保契约）
- 数据层 files 原样保留（types/data/config/default-categories.gen/ai/file-sync）：**不动**。
- settings.ts 两域设置键（favoritesSortKey/favoritesMobileDefaultFullscreen/storagePath/favoritesStoragePath / belongingsDataFolder/belongingsMobileDefaultFullscreen/storagePath）与 DEFAULT 值：**不动**。
- settings-panel schemaLoaders（favorites/belongings 各一行惰性 import `xxxSettingsSchema`）：函数导出名保持（favoritesSettingsSchema/belongingSettingsSchema——重写后从新 ui.ts 导出）。
- main.ts COMMANDS/import/unload 不动；`ensureFavoritesFileSync` 不动。
- smartcat：favorites-source/belongings-source 纯函数与总线订阅不动（仅保留对域事件载荷的形状契约）。
- 设置面板内嵌渲染两域 schema：重写后须在设置面板真机路径仍显示（迁移测试覆盖 settings-panel 引用不破）。
- 抽屉/右键统一组件 core/item-actions 继续使用（行为契约在）。

## 四、测试策略
- 数据层测试：**原样通过**（不动 data 层）。
- ui 测试：两域 tests 全量重写对齐新 UI（describe 重构）——旧断言大多绑定旧 DOM/文案，能留的语义断言（删除撤销/归档冷存/事件载荷/余额刷新/移动全屏/设置空态/smartcat）平移保留，DOM 结构断言重写；test 规模参考 cinema（每域 ~600-800 行）。
- smoke/entries-extra/settings-modal/settings-panel 中涉及两域契约的断言保持绿（命令 id、ensure 次数、schema 空态文案等）。
- 门禁：pnpm test（全量）+ tsc --noEmit + 自审 + diff 审查（子代理）+ build（合回后主仓执行）。

## 五、完成定义（DoD）
1. 两域新 UI 与拍板原型逐屏一致（桌面+移动、明暗主题、hover/选中态）。
2. 全部交互可点可用，写盘路径与旧域等价（新增/编辑/置顶/归档/删除/撤销/状态流转/自动刷新/余额）。
3. smartcat/设置面板/主命令三处接线全绿。
4. 门禁全绿；合并 master + 主仓 build 部署；worktree 清理。
