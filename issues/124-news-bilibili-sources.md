# Ticket 124：聚合讯 B 站 UP 主聚合 + 剪藏本设置「数据源」组（用户需求 + grill-with-docs 定案）

- 状态：实施中（worktree/news-bilibili）
- 域：news（聚合讯）+ clipping（剪藏本设置面板）+ auto-summary + tools/news-watcher
- 来源：用户需求「聚合讯，聚合我感兴趣的 b 站 up 主」+「剪藏本设置中的自动摘要打开之后，也显示更详细的设置项」「走worktree」；grill-with-docs 两轮盘问 + 两轮补问定案（Q1-Q18）
- 关联：`src/news/reader.ts`、`src/clipping/view.ts`、`src/settings.ts`、`src/auto-summary/*`、`tools/news-watcher/watcher.js`、spec「聚合讯 B 站 UP 主聚合 + 数据源设置（ticket 124）」、ADR-0060、CONTEXT「数据源开关」「UP 主名单」「保留策略」「摘要时机」词条

## 用户拍板（grill 定案）

1. **检测**：bz 以 vault 内 `CONFIG/STORAGE/news.json` 存在为 news-watcher 库存在的信号（不跨进程探测）；
2. **未检测到**：剪藏本设置弹窗显示引导块（如何安装/启动 obsidian-news），设置项隐藏；
3. **数据一体化（自定义拍板）**：news-stats.json 合并进 news.json；历史文章保留 3 天（设置可调）、跳过清空正文的文章保留 7 天（设置可调）；「未读的不处理」；
4. **添加 UP 主**：粘贴主页/视频链接自动解析 UID；
5. **抓取窗口**：沿用 24h 滚动窗口；
6. **展示**：标题 + 简介 + 封面 + 链接；
7. **平台名**：B站；
8. **自动摘要详设**：摘要长度档位 + 标签生成开关与数量 + 摘要时机（默认保存后立刻）；
9. **分组**：新建「数据源」组；
10. **清理执行方**：插件侧（打开阅读器时）；
11. **保留语义**：未读永不处理；已保存骨架 3 天、已跳过骨架 7 天（双档，均可调）；
12. **名单字段**：仅 uid；
13. **源开关**：知乎、果壳、B站都有开关（news.json.sources，默认全开）；
14. **状态行**：显示只读状态（最近抓取时间 / UP 主数量）。

## 设计（实现参考）

### news.json 四段结构（数据格式变更，ADR-0060 豁免）

```json
{
  "articles": [...],                          // 原纯数组内容
  "stats": { totalRead, totalSaved, totalSkipped, byPlatform, byDate },
  "bilibiliUps": ["uid1", "uid2"],
  "sources": { "zhihu": true, "guokr": true, "bilibili": true }
}
```

- 旧纯数组读取 → 自动包裹为 `{ articles: array, stats: 默认, bilibiliUps: [], sources: 全开 }`；
- news-stats.json 存在且 stats 段缺失 → 并入 stats 段；之后不再读写 news-stats.json（旧文件保留不动）；
- reader 的 loadStats/saveStats/recordStat 改读写 news.json.stats；saveArticles 改为整四段读写（读盘 → 合并 articles/stats/bilibiliUps/sources → 写回），保留非本域段；双写者合并按四段。

### 剪藏本设置「数据源」组

- 检测 `CONFIG/STORAGE/news.json`（getAbstractFileByPath）：
  - 存在 → 设置项：三源开关（toggle 写 news.json.sources）、UP 主名单（列表 + 粘贴链接解析 uid 添加 + 删除）、保留天数（newsRetentionSavedDays / newsRetentionSkippedDays 数字输入）、只读状态行（最近抓取时间=articles 最新 fetchedAt，UP 数=bilibiliUps.length）；
  - 不存在 → 引导块：obsidian-news 安装/启动说明 + 复制命令；
- 自动摘要开关（智能组）打开后展开三个详设（长度档位 dropdown / 标签开关+数量 / 时机 dropdown）。

### 插件侧保留策略

- show() → loadArticles 后触发一次 cleanupRetention；
- 规则：read!==true → 保留；state==='saved' → 超 newsRetentionSavedDays 天删；state==='skipped'（或旧数据无 state）→ 超 newsRetentionSkippedDays 天删；起算 = fetchedAt ?? date；
- markAsRead 写 `state` 字段（'saved'|'skipped'）。

### watcher 侧（tools/news-watcher/watcher.js）

- `resolveNewsPath`/`readNews` 兼容四段与纯数组；
- 常量：`BILIBILI_API = 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space'`、`BILIBILI_HOME = 'https://www.bilibili.com/'`；
- `getBilibiliCookie()`：GET 主页 → 收集 Set-Cookie（buvid3 等）→ 内存复用；
- `fetchBilibili(existingUrls, upUids)`：对每个 uid 循环分页（offset 翻页），过滤 DYNAMIC_TYPE_AV + 24h 窗口，构造条目（platform:'B站'/title/url=bvid 链接/author/date/body=desc+封面+链接/fetchedAt），批内去重；
- `checkAndFetch`：读 news.json（sources/bilibiliUps）→ 按开关并行抓 zhihu/guokr/bilibili → 四段写回。

### 自动摘要详设

- settings 新键：autoSummaryLength('simple'|'standard'|'detailed'，默认 'standard')、autoSummaryTagsEnabled(true)、autoSummaryTagCount('3-6')、autoSummaryTiming('immediate'|'lazy'，默认 'immediate')、newsRetentionSavedDays('3')、newsRetentionSkippedDays('7')；
- processor：FIELD_DEFS.summary 按长度档位换字数要求；TAGS_RULE 按标签开关/数量；aiProcess 传参；
- index：timing==='lazy' 时去掉 create 即时监听（仅 file-open 触发），'immediate' 保持双监听。

## 测试

- 数据层（node 环境）：news.json 纯数组→四段迁移、stats 并入、保留策略清理（未读/已保存 3 天/已跳过 7 天/无 state 兜底）、markAsRead state 写入、uid 链接解析纯函数；
- UI 层（jsdom）：剪藏本设置弹窗「数据源」组（news.json 存在/缺失两条路径、三源开关写 sources、UP 名单增删、状态行）、自动摘要开关展开详设；
- watcher：node --check 语法门禁 + B 站条目映射纯函数测试；
- smoke：无新命令（设置入口在剪藏本面板内）。

## 验收标准

a) 剪藏本设置弹窗出现「数据源」组，news.json 存在与否两条路径正确；b) 三源开关切换后 watcher 下轮按 sources 抓取；c) 粘贴 space.bilibili.com/<uid> 或 bilibili.com/video/BVxxx 自动解析出 uid 入名单并可删除；d) 阅读流出现 platform=B站 条目（标题/简介/封面/链接），保存/跳过标记 state 并按 3/7 天档清理；e) 自动摘要开关打开后展开三组详设并生效；f) 旧 news.json 纯数组与 news-stats.json 迁移无感；g) 全量测试绿 + tsc + 构建验证。