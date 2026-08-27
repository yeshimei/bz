# Ticket 126：B 站 UP 名单联动隐藏 + 「管理」按钮独立弹窗 + UP 主名字/头像回填（用户反馈）

- 状态：master 直接实现完成，待提交
- 域：clipping（剪藏本设置「数据源」组）+ news（聚合讯数据层）+ tools/news-watcher（数据源守护 v1.1.1）
- 来源：用户反馈「b 站 up 关闭后，下面的 up 主 名单也要隐藏，up 主名单变成一个按钮吧，点击打开一个单独的弹窗来进行添加删除什么的，添加后如果后台程序抓到消息，把 uid 替换成对应的 up 主名字和头像？如何有的话」
- 关联：`src/clipping/news-sources-group.ts`、`src/news/data.ts`、`src/news/source-settings.ts`、`src/clipping/styles.css`、`tools/news-watcher/watcher.js`、`CONTEXT.md`「剪藏本」「UP 主名单」「UP 主资料」

## 三点改动

### 1. B 站开关关闭 → 整个 UP 主名单段隐藏

改前只隐藏 `[data-up-row]` 名单行，按钮行/输入行残留；改后 UP 名单收敛进 `[data-up-section]` 段，开关联动整段显隐（原 12px 缩进行级隐藏语义废弃）。

### 2. UP 主名单 → 「管理」按钮 + 独立弹窗

- 组内只留一行：名称「UP 主名单」+ desc（已跟踪 N 位 + 名字预览，超 3 位折叠为「A、B、C 等 N 位」）+「管理」按钮；
- 点击打开**独立管理弹窗**（`createOverlay`，层 10100：设置弹窗 10050 之上、共享确认 10250 之下；mask/Esc 关闭，不销毁设置弹窗）——顶部「添加 UP 主」输入行（粘贴主页/视频链接解析 uid，逻辑沿用），下方列表每行 = 头像 + 名字 + uid + 移除；
- 增删后弹窗列表即时重绘 + 重读盘刷新组内概要与徽标。

### 3. UP 主名字/头像替换 uid（后台抓到消息后）

- **数据源守护 v1.1.1**：B 站抓取到条目时，取首个条目的 `module_author` name/face 回填 `news.json` 新增**第五段** `bilibiliUpInfo`（`{ uid: { name?, avatar? } }`，头像统一转 https）；
- **插件侧只读**：`parseBilibiliUpInfo` 容错解析（缺失/损坏段 → 空对象），名单/弹窗展示 `name ?? 'UP <uid>'`、有 avatar 则渲染圆形头像（加载失败移除不占位）；`removeBilibiliUp` 同步清除该 uid 资料条目；
- 数据兼容：第五段为可选新增，旧 news.json（四段/纯数组）无感读取，全员写回 `...data` 保留该段。

## 测试

- 数据层：`data.test.ts` +2（bilibiliUpInfo 段解析容错/转 https、缺失→空）、`source-settings.test.ts` +3（状态透出/损坏容错、增删保留与清理、骨架含空段）；
- UI 层：`news-sources-group.test.ts` 重写 UP 名单相关 3 例 + 新增 1 例（按钮行名字预览/弹窗名字头像展示/遮罩关闭/整段联动/弹窗内删除与添加，含 news.json 写回断言）；
- watcher：`bilibili.test.js` +3（extractUpInfo 提取/容错、parseBilibiliUpInfo 段容错）；
- 既有 news/clipping 用例按新契约同步；全量 + tsc 复核见提交记录。