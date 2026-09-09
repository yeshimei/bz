# issue 256：影院直调队列上线三连败修复（spawn 执行器/路径/缓存时序）

日期：2026-09-09 ｜ 关联：ADR-0113 修订 ｜ 上游：issue 255

## 症状（用户实测，issue 255 上线后）

1. 添加影视后列表闪现一下就消失，重开面板才出现；
2. 后台爬数据时列表没有 loading；关闭面板后 loading 消失；
3. 无论是添加影视还是面板扫描队列，**无一例外**全部弹「爬取失败」。

## 根因（三个独立缺陷叠加）

1. **spawn 执行器失效（症状 3 主因）**：issue 255 用 `process.execPath`（Obsidian 的 Electron）+ `ELECTRON_RUN_AS_NODE=1` 跑 CLI。实测本机 Obsidian 的 **runAsNode fuse 被禁**——环境变量被静默忽略，spawn 出来的是 Obsidian 主程序（把 cli.js 当插件命令，报 "Command not found" 后秒退）→ 字段验证必败 → 全部「爬取失败」。
2. **vault 相对路径双拼（症状 3 次因）**：CLI 的 `fetch` 对非绝对路径按 `path.join(影片目录, input)` 兜底，插件传 vault 相对路径 → 拼成「影片目录/我的/影视/…」双重路径，文件不存在。
3. **metadataCache 未就绪丢条目（症状 1/2）**：新建落盘 → `vault:md-created` 300ms 防抖重建 → 此时 metadataCache 尚未索引新文件 → `parseMovieFile` 返回 null → 全量替换把刚 unshift 的条目冲掉（闪现消失）；加上 sweep 入队后无渲染触发、抓取完成后只渲染不重建（poster/doubanUrl 停留旧值），loading 与海报上卡全链路缺位。

## 修复

- `douban-queue.ts`：
  - 执行器改**系统 Node**——`node -p process.execPath` 探测（shell 搜 PATH，缓存一次）；缺 Node 提示一次、入队静默跳过（不冒充抓取失败）。
  - `runOne` 传 `adapter.getFullPath()` 宿主绝对路径（无 adapter 回退相对路径）。
  - 抓取完成 → `refreshAfterFetch`：立即 rebuild+render（loading 退场）+ 延迟 rebuild+render（等 metadataCache 消化磁盘变化，海报/链接上卡）。
  - `sweepDoubanFetch` 有新增入队即渲染一次（loading 首帧可见）；`enqueueDoubanFetch` 返回是否真入队。
  - 关面板不清队列（`shutdownDoubanQueue` 仅插件卸载调用）——重开面板 pending 条目继续显示 loading（症状 2 的「关面板消失」实为全秒败连带假象，修复 1 后队列真实存活）。
- `data.ts` `rebuildItems`：cache 为 null（未索引）的文件保留内存既有条目，防新建闪失；已索引但无效（无 tags）照旧丢弃。
- 工具侧：全局包更新到 2.3.0（本地目录安装 symlink）——补全分支 + frontmatter 引号剥离到位；真数据端到端冒烟通过（`[补全] 已有海报，只补豆瓣信息`，海报字段不动）。

## 测试

- spawn 收宿主绝对路径断言（mock adapter `getFullPath`）；渲染联动（sweep 1 次 + 完成后 2 次）；node 不可用静默；rebuildItems 缓存未就绪保留/已索引无效不救回；全量 4200/4200 绿 + tsc 干净。
