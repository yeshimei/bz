# 56 — 黑匣子打开提速 + 录入后台化（用户需求）

**What to build:** ① 打开「概念录入/摘抄录入/面板」秒开：录入弹窗/面板立即渲染，首次打开（水合缓存未就绪）顶部显示「正在扫描黑匣子…」提示条，数据就绪后自动移除；② 全量水合扫描只做一次：`BlackBoxDataManager.load` 内存缓存（save 同步更新，vault create/modify/rename/delete 事件失效后下次 load 才重扫）；③ 概念/摘抄/想法确认录入后先关闭面板，AI 补全后台执行（AI 标题生成 → `renameEntryNote` 重命名笔记 → 原位注入 → 双向关联回填 → 自动分类），完成仅弹通知（「已生成标题「xxx」」info）；文献/想法无分析标题先落盘正文前 20 字降级名，永不拒收。

**Blocked by:** —（用户直提）

**Status:** ready-for-agent

- [ ] capture.ts：打开立即渲染（ensureDataLoaded 后台加载 + 扫描提示条）；saveConcept 快照捕获在 close 前（selectionSnap 副本）；finalizeConceptSave/finalizeEntrySave 后台补全链；finalizeEntrySave 降级名判断（水合回退文件名 ≠ 真实标题 → 仍调 AI）
- [ ] data.ts：水合缓存（load 命中 / save 末尾同步 / invalidateBlackBoxCache / resetBlackBoxCache / isBlackBoxCacheReady）；renameEntryNote（先比 base===oldPath 再 uniquePath，防同名现路径误判 -1）
- [ ] sync.ts：vault modify/create/rename/delete → 缓存失效（同步事件 + save 后置赋值自愈）；refresh() 先失效再 load（编辑后强制全扫一次）
- [ ] panel.ts：打开立即渲染骨架 + 扫描提示条，数据就绪后 renderAll + 挂 sync notify
- [ ] styles.css：`.bz-blackbox-scanning` 提示条样式
- [ ] 测试：缓存（命中/invalidate/失效重扫/save 同步）+ renameEntryNote 4 例 + 扫描提示条（capture/panel）+ AI 标题后台重命名 waitFor + 注入目标 = AI 标题 + 概念注入后台
- [ ] spec.md US 23-26、PROGRESS.md 更新；tsc 零新增；全量测试绿（并发抖动项与基线持平）；一次提交（`bz: ticket 56 黑匣子打开提速 + 录入后台化——…，N 测试`）
