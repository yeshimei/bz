# ADR-0289：数据文件的存在性/读取一律问盘（adapter），不问 vault 索引

- 状态：已采纳
- 日期：2026-11-06
- 相关：ADR-0270（数据目录缺省搬到插件目录下的 `storage`）、ADR-0069（小橘 sidecar）、ADR-0121（RSS 订阅源）

## 背景

ADR-0270 把缺省数据目录改成 `<插件目录>/storage`，也就是 `.obsidian/plugins/<插件>/storage`。
这个路径**含点前缀段**。Obsidian 的 vault 索引不含点前缀目录——`vault.getAbstractFileByPath()`
对它恒返回 `null`，`vault.read(tfile)` 也就拿不到文件对象。

数据本身的读写没受影响：`core/storage.jsonFileStore` 早就做了「索引查不到 → adapter 直读/直写」
的降级，所以 `news.json` / `memo.json` / sidecar 一直能正常写进去。

出事的是**判断「文件在不在」的那一层**。多个域各写了一份 `getAbstractFileByPath(...) ? ... : ...`，
结论恒为「不存在」：

- 剪藏本：`readNewsData()` 返回 `missing: true` → 设置页「暂未跟踪任何 UP 主」、主面板首用引导，
  而抓取照常写盘（2026-11-06 用户报障）；
- 小橘：`writeJsonSidecar` 先判目录存在（恒 false）再 `createFolder` → 撞「Folder already exists」
  → 迁移抛错 → 小橘不启动；`vault.on('modify')` 对点前缀文件不触发 → 域观察链整条失效；
- 首页：`recap` / `river` / `behavior-timeline` 的「探测再读」全部判缺失 → 各域计数静默归零；
- 体检：`readJsonIfPresent` 判缺失 → 一键修复对每个文件都静默跳过；`CONFIG/.CORRUPT`
  （自身含点段）列不出历史留档；`backupOriginal` 连坏文件都不留档了。

老库因为 `data.json` 里存着 `CONFIG/STORAGE`（可索引）才没事——这也是它从 v1.34.1 活到
v1.39.4 才被发现的原因。测试也没拦住：夹具 `getAbstractFileByPath` 对点前缀一视同仁，
`storagePath` 又都写死 `CONFIG/STORAGE`，盲区对盲区。

## 决策

**数据文件（含留档目录、sidecar、点前缀下的任何插件私有文件）的存在性、读取、stat，
一律走 `core/storage` 的 adapter 助手，不走 vault 索引。**

```ts
diskPathExists(app, p)             // 存在性（adapter.exists）
diskReadText(app, p)               // 只读直读（adapter.read；缺失/失败 → null）
diskPathStat(app, p)               // mtime/size（adapter.stat；取不到 → null）
```

`vault.getAbstractFileByPath()` 只保留给**用户可见路径**（笔记、封面、附件、剪藏 md）——
它们在索引里，行为不变。

配套三条：

1. `jsonFileStore.write` 在索引查不到但盘上有文件时**直接 adapter 直写**，不再先走
   `vault.create`（对已存在路径必抛 already exists，点前缀路径每次写都白撞一次）。
2. 变更感知：点前缀文件收不到 `vault.on('modify')`。小橘域观察与备忘录面板改用
   `adapter.stat` 的 mtime 轮询兜底（面板/心跳生命周期内，关掉即停），modify 事件仍在，
   两条路径用**内容级去重**（比对原文，不比对 mtime——同秒两次写会撞同一 mtime）。
3. `backupOriginal` 的留档写入改 `adapter.write`（`CONFIG/.CORRUPT` 含点段，`vault.create`
   同样不可靠），撞名序号判重也改问盘。

## 测试基建

`tests/mock-vault.ts` 新增 `DotHiddenVault`：**只对点前缀路径**让 `getAbstractFileByPath` 返
`null`，其余路径正常（区别于 `IndexLagVault` 的全瞎）；并模拟真机 `createFolder/create`
按磁盘判重。守卫用例见 `tests/core/dot-path-storage.test.ts`（剪藏 missing 判定、recap 采集、
sidecar 写盘、体检留档列举）。

## 后果

- 新装库（缺省点前缀目录）不再出现「加了 UP 主却显示暂未跟踪」「小橘不启动」「首页计数全零」。
- 老库行为不变：`CONFIG/STORAGE` 可索引，索引路径与 adapter 路径结论一致。
- 数据文件读取多一次 `adapter.exists`（`readJsonIfExists` 先判存在再读），换来缺失文件不产生
  一次注定失败的 IO；这是有意的取舍。
- 不引入「点前缀路径要特殊处理」的用户可见概念——修好了就不该有这回事，只在 ADR 与代码注释里记。
