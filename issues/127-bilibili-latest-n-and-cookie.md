# Ticket 127：B 站不走 24h 窗口——每 UP 最近 N 条（页面可设）+ Cookie 配置引导（用户反馈）

- 状态：worktree/ticket127 实施完成，待合并
- 域：news（聚合讯数据层）+ clipping（剪藏本设置「数据源」组/UP 名单管理弹窗）+ tools/news-watcher（v1.1.2）
- 来源：用户反馈「不走24h，走最近10条（用户可以在页面设置）」「如果需要 cookie 在 up主名单中让引导用户配置」——即添加的 UP 长期没在 24h 内发视频时永远抓不到内容；API 412 风控时需要用户提供 Cookie
- 关联：`tools/news-watcher/watcher.js`、`src/news/data.ts`、`src/news/source-settings.ts`、`src/clipping/news-sources-group.ts`、`CONTEXT.md`

## 改动

### 1. B 站抓取：24h 窗口 → 每 UP 最近 N 条（默认 10，页面可设）

- 新增 news.json 可选段 **`bilibiliMaxItems`**（默认 10，夹取 1..50，非法回退 10）；
- watcher v1.1.2：`fetchBilibiliUp` 不再按 `cutoff`（24h）过滤，新增纯函数 `collectBilibiliBatch(items, existingUrls, limit, out)`——按最近优先收满 `limit` 条未抓过的动态即停（跨页翻页上限 50 保留）；已抓过的 URL 照旧跳过；UP 资料回填逻辑不变（只随有新增的轮次写回）；
- 插件「数据源」组：B 站名单段内新增「B站抓取条数」行（数字输入，onChange 写 `bilibiliMaxItems`），随 B 站开关整段联动隐藏（与 UP 名单同段）。

### 2. B 站 Cookie 配置引导（在 UP 主名单管理弹窗内）

- 新增 news.json 可选段 **`bilibiliCookie`**（明文字符串去空白，空=未配置）；
- watcher：`fetchBilibili` 优先用配置的 `bilibiliCookie`，未配置回退自动引导（GET 主页收集 buvid3）；两者都无 → 跳过 B 站并打印引导文案「请在剪藏本设置 ⚙️ → UP 主名单管理 → 粘贴 B 站 Cookie」；
- 插件 UP 主名单管理弹窗底部新增「B 站 Cookie（可选）」区：引导文案（412 风控时用；浏览器 F12 → Cookie 复制 buvid3/SESSDATA）+ 输入 + 保存/清除按钮，状态（已配置/未配置，走自动引导）实时联动；保存/清除落盘并刷新组内概要。

### 数据与兼容

- 两个新段均为可选新增：旧四/五段文件（含纯数组）读取无感（缺省 10 / 空串），全员写回 `...data` 保留；
- Cookie 明文本地存于 news.json（随 vault 同步），插件只写、watcher 只读。

## 测试

- watcher node:test +4（collectBilibiliBatch：无窗口收老动态/收满即停/去重；parseBilibiliMaxItems 默认与夹取；parseBilibiliCookie）；
- 数据层：data.test.ts +1（两段解析与回退）、source-settings.test.ts +3（状态透出、writeBilibiliMaxItems 夹取与骨架、writeBilibiliCookie 保存/清除/骨架）；
- UI 层：news-sources-group.test.ts +2（抓取条数行展示/落盘/随开关隐藏；弹窗 Cookie 保存/清除/状态文案）；
- 全量 + tsc + 构建复核见提交记录。