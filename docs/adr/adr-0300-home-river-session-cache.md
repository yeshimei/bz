# ADR-0300 · 首页活动河用会话级缓存，重开不重算、不重排

日期：2026-11-15 · 状态：已采纳 · 关联：ADR-0170（日记墙预热缓存）、ADR-0289（点前缀目录）、
ADR-0047（唯一 vault 订阅点）、issue 290（DOM 常驻秒显）、issue 383（让出首帧）、issue 567

## 背景

issue 290 让首页关闭只隐藏、重开复用同一 DOM，本该「秒显」。但 `showOverlay()` 每次仍同步发起
一轮 `collectRiver()`：7 天回顾 × 每次 2 次全库 `getMarkdownFiles()` + 日记正文 `vault.read`，
12 个域时间线 `cachedRead`，11 个计数再各扫一遍全库，约 20 轮全库遍历；回来后 `renderAll()`
把五个容器全量 `innerHTML` 重建、逐行重挂菜单、重放约 20 个错峰动画。
用户 2026-11-15 报「首页内容每次打开都会卡顿一小会儿」。

home 域此前只有 DOM 常驻与并发代次/存活守卫，**没有任何数据缓存、失效、局部更新或预热**。

## 决策

1. **会话级缓存放在数据层新模块 `src/home/river-cache.ts`**，不塞进 `collectRiver()`：
   `collectRiver` 保持「纯采集、每次调用真的采」的契约，`river.test.ts` 的集成断言不受影响。
2. **按 app 键控 + 在途 promise 去重 + 失败不缓存 + 刷新恒回源**，照 ADR-0170：不做跨会话持久
   缓存、不做 DOM diff、不自挂 `app.vault.on`（ADR-0047 唯一订阅点）。
3. **失效面**：域动作事件（memo / diary / review / favorites / belongings / pomodoro / movie /
   gameshelf / knowledge / news / bookshelf / clipping / secondbrain / home 等）+ `vault:md-*` 五通道；
   **跨天必回源**（头行日期与「今天」这一列会变）；**5 分钟 TTL 兜底**（ADR-0289：点前缀数据目录
   收不到 vault modify，光靠订阅会长期显示旧数）；**首页设置快照入缓存键**（保住
   `readHomeSettings()`「每次现读、刻意不缓存」的口径）；显式 `invalidateRiverCache()` 供
   手动刷新 / keepHome 动作落地 / 重试。
4. **命中缓存返回同一份对象引用**。`ui.refreshRiverAndRender()` 据此判断：引用相同 + 番茄相位未变 +
   入口顺序内容未变 + 上次已渲染过真数据 ⇒ **跳过 `renderAll()`**，不重建五区、不重挂图标菜单、
   不重放编排、不动滚位与焦点。首次打开（`prevRiver` 为 null、骨架待换）不在快路内。
5. **让出首帧**：`createOverlay` / `showOverlay` 都经 `afterPaint()`（rAF → setTimeout(0)）再排刷新。
   否则缓存命中时整条链在微任务里一口气跑到渲染，反而堵住「打开」那一帧（issue 383 同款）。
6. **启动空闲预热**：`main.ts` 的 `onLayoutReady` 调 `prewarmHome()`，只填数据缓存、不建 DOM、
   不实例化面板（ADR-0003 兼容）；传卸载旗标防幽灵任务（C13）。失败静默，真正打开时自行回源。
7. **开发期耗时探针**挂在 `if (__BZ_DEV__)`：只有 `BZ_VAULT_DIR` 非空的一次性构建为 true，
   production 恒 false 并被 DCE；发布版零残留。

## 否决 / 暂缓

- **否决「ttl 之外再加 mtime 轮询」**：十几份数据文件逐个 stat 本身又是一轮 I/O，5 分钟兜底 + 域事件
  已够；真发现数据不够新再按域加。
- **否决「缓存命中时仍整屏重建」**：那是把重算省了、卡顿留了，用户报的正是「跳一下」。
- **暂缓**：7 天回顾共用一份 `mdFiles`（把 20 轮压到 1 轮）、渲染层 diff / 容器级事件委托、
  时间线可视区懒加载、计数改事件增量维护。都在 issue 567 的后续项里，等真机 A/B 数字再定，
  避免一次改太大。

## 代价

- 数据变了但事件漏发时，最多 5 分钟内重开显示旧数；跨天与设置变更不受此限，手动刷新恒回源。
- 缓存命中不重排，意味着「每次开面板现读」的设置类效果改由缓存键触发重排，而非每轮重建；
  对应回归已写进 `river-cache.test.ts`。
- 预热会在启动空闲多跑一次全库采集；这是把「首次打开的那一次」提前，不是新增总量。

## 验收

`river-cache.test.ts` 12 例 / `reopen-cache.test.ts` 4 例；5 条既有回归按新语义同步调整；
`test-affected --since HEAD~1` 695 文件 / 10295 例全绿，`tsc --noEmit` 干净。
