# 255：影院豆瓣抓取插件直调（守护退役 + 卡片 loading）

日期：2026-09-09 ｜ 分支：feat/cinema-direct-fetch-255 ｜ worktree：cinema-direct-fetch-255

## 背景

守护进程 9/5 起静默僵死 4 天（唐顿庄园两季受害，探针实证），ADR-0111 触碰协议上线当天即失去信号消费方。用户拍板架构转向（ADR-0113）：不走守护，插件内存队列直接调脚本；新增卡片 loading。

## 决策（ADR-0113）

- 插件内存队列 → 串行 spawn `douban-poster fetch <绝对路径>`（15s 间隔，3 分钟硬超时）；桌面端专属，移动端禁用。
- 完成信号 = spawn 退出 + 字段验证；失败聚合一条错误通知（含片名）；进度零通知。
- 队列口径 = 缺海报或缺豆瓣链接；入队时机 = 面板打开扫描 + 新建落盘；同会话内存去重。
- `豆瓣检查` 字段退役不写（存量休眠无害）；poster-watch 通知轮询整体退役。
- 卡片 loading = 海报遮罩 spinner，pending 内存待定清单。
- 守护退役：pm2 delete + save（部署后执行）；全局包保留；设置页指引更新。

## 改动

**插件 `src/cinema`**
- 新 `douban-queue.ts`：入队/串行泵/spawn/字段验证/超时/失败聚合/会话去重；`stopAll` 挂 unload。
- `douban-sweep.ts` → 面板打开扫描改直录入队；`豆瓣检查` 写入与 `data.ts`/`state.ts` 的 `doubanCheck` 解析退役；`index.ts` 两打开入口挂队列。
- `poster-watch.ts` 通知轮询退役（`saveNew`/`quickAddWant` 改入队）；unload 清理同步换。
- `render.ts` `pcardHtml` 海报区 loading 遮罩（pending 标记驱动）；域 styles.css 遮罩+spinner 样式（桌面/移动两壳）。
- CLI 定位：`npm root -g` 解析全局 cli.js；失败 → 队列禁用 + 一次性提示；设置页指引文案更新。

**测试**
- 队列数据层：入队去重/串行间隔/完成清 pending/失败聚合/超时杀进程（fake spawn）/CLI 缺失禁用。
- UI 层：打开面板触发入队；新建入队；卡片 loading 渲染与清除。
- smoke：契约零改动豁免销项；`poster-watch.test.ts` 随通知退役重写为队列用例。

**运维（部署后）**：pm2 delete douban-poster + pm2 save；自启 bat 核验。

## 验收

- 新建《XX》→ 卡片即现 loading → 数十秒转完 → 海报+豆瓣字段落卡；失败时聚合错误通知含片名。
- 面板打开自动补抓未齐条目（首批含盲区 17 条），同会话不重复；重启 Obsidian 后再补一轮。
- 移动端无 loading、不报错；PC 打开面板可补抓移动端同步来的新片。
- pm2 列表无 douban-poster；`douban-poster fetch` 手动 CLI 仍可用。
- 门禁全绿：pnpm test + tsc --noEmit + 自审 + diff 审查 + 构建验证；工具侧 node --test 全绿。
