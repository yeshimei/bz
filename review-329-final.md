# review-329-final · 剪藏本×知识盒整体评审报告（2026-09-16 无人值守）

- 范围：issue 329 四批（划选工具框/锚定双链/保存图片本地化/图版描述/移动端修复）+ issue 332（自动前进换篇语义）+ issue 330/331 顺带触点
- 方式：双评审代理并行（剪藏本侧 / 知识盒侧+契约一致性），只读扫描 + 逐调用方审计
- 门禁佐证：全量 326 文件 5205 测试全绿、tsc 零错误、已构建部署
- 结论：**无 P0**；P1×1 + P2×4 已修（issue 333），其余记档待拍板

## 已修（issue 333，本批合并部署）

| 严重度 | 位置 | 问题 → 修复 |
|---|---|---|
| P1 | clipbook/ui.ts refreshAfterAction | prevId 为空（撤销唯一条目后 refresh）误 `markReadOnOpen(flat[0])` 破坏撤销恢复承诺 → prevId 空只落引用不标读 |
| P2 | clipbook/ui.ts deleteNewsItem/deleteClipNote | 删除路径不清侧写三段 → 永久残留；同步 `clearArticleTracking` |
| P2 | knowledge/note-gen.ts 图版描述拼接 | 描述含 `]]` 破嵌入语法 → 插空格降级 + 回归测试钉住 |
| P2 | knowledge/ui.ts 确认写入链 | `commitEntryLinks` 抛错吞 `onCreated` → 剪藏本断链 + 重试落 `_2` 副本；改为不回滚已写笔记、warning 区分文案、照常回调 |
| P3 | anchor.ts + 升级链两处拼点 | 内部链别名含 `]]` 破语法 → `linkAliasText` 清洗 |
| P3 | clipbook/ui.ts showImageSelBar | 本地嵌入图误出「保存图片」报网络失败 → 非 http src 不出该项 |
| P3 | knowledge/ui.ts onKeydown | 直达预览独立宿主无 ESC → 补关闭分支（对齐「关闭走 ✕/ESC」契约） |

## 记档未修（设计权衡项，待拍板）

1. **已存条目「已存」按钮不置灰**：重复保存走完整覆盖流，划词 marks 已随首次物化清空、图片按外链重下、`_2` 副本堆积。方向：saved 守卫或覆盖前回读 md 保物化成果。
2. **保留策略裁剪不清侧写**：守护窗口清理的条目其 marks/savedImages 成孤儿（仅膨胀无害）。方向：裁剪路径清侧写或 checkup 兜底。
3. **loadClipBody 失败无负缓存**：失败篇每次重渲重复读盘失败。方向：失败态短 TTL。
4. **B站分流保存后不自动前进**：state='saved' 但 url 不命中剪藏目录，`isClippedNews` 不剔除 → 原位保留，与 issue 332 保存前进动线不一致。方向：统一或文档化豁免（ADR-0068 语境）。
5. **本地化通知 N 含复用张数**：全复用时「已本地化 N 张」与实际下载量不符（文案口径）。
6. **knowledgeDir() 手写归一**：绕开 core/knowledge-boxes 单源（ADR-0141），与 litDirOf 归一漂移风险。方向：改 `getKnowledgeBoxes().lit`。
7. **upgradeSourceLine 混合行尾**：整体统一行尾轻微越出「只动一行」承诺（评审判可接受现状）。
8. **linkAgentMinScore text 绑定**：盘上可能落字符串（issue 330 顺带既有口径，消费端已容错，备查）。

## 评审确认无问题的关键面

渲染层变换与物化同一管线且 src 保字面量、并发写串行队列、冻结序不重排、news.json 插件零写入、unload 对 document 级监听对称解绑、双端同套函数、图版描述索引同步闭环（历史易错点）、openPreviewByPath 三态、onCreated 重名/丢图路径不误触发、契约 API 签名与消费点逐一吻合。
