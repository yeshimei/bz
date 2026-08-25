# ADR-0051: 第二大脑取代闪念——正名、接管与三处兼容破例

日期: 2026-08-25
状态: accepted（ticket 103，grilling 全树用户逐项拍板）

## 背景

闪念功能存在两个源头：QuickAdd 宏脚本 `CONFIG/SCRIPTS/Quickadd/闪念.js`（2311 行，完整原型）与 bz 内 `src/flash`（当年移植的半成品——index 占位、四个 UI 模块 WIP 未接线、两命令只弹「迁移中」通知，功能整体不可达；数据/纯函数层可用并被 smartcat 复用）。用户裁定：「flash 的名字并不合适，这个功能更像是第二大脑」，要求以 QuickAdd 完整源码为基准完成实现并正名。

## 决策

1. **正名与三层拆分**：功能显示名「第二大脑」；模块 `src/secondbrain/`、命令 `bz-secondbrain-panel/open/chat`、设置键 `secondBrain*`。笔记类型词汇 `'flash'`（path-classify 卡片盒分类、smartcat source 标签、credibility 0.9 档位、`flash:*` 域事件）**保留不动**——「闪念笔记」（卡片盒文档类型）与「第二大脑」（管理检索它们的功能模块）是两个概念，各归各位。
2. **行为对齐 QA，保留 bz 改进**：分块保段落边界、cos=`1−d²/2`、句界集补中文分号/省略号、TF-IDF chunk 粒度且索引复用、文本检索返回命中段+QA 加权评分、VP 树 mu/minD/maxD 包络剪枝+构建缓存、parallelMap 自适应并发、移动端提示词「【参考】」；保留 bz 四项严格改进（Ollama 30s 超时、MobileBuffer 写入、真 ⚙️ 域设置弹窗、jumpToChunk offsetToPos 修复）。DeepSeek 通道改走 core/ai 注入（QA 的 `window.__utils` 违反铁律 5）。
3. **兼容破例三项**（对铁律 1 兼容性冻结的有意识豁免）：
   - 命令 id 换代不留别名——旧 `bz-flash-*` 从未具备真实功能，全仓引用仅 main.ts 注册处与 smoke 断言，无外部裸调用者；
   - 17 个扁平设置键全量更名 `secondBrain*` 并 onload 一次性迁移（旧有值新缺→复制→删旧键）；废弃 META_PATH/VEC_PATH 直接清除不再搬；
   - meta v7→v8 首载一次性整库重嵌（约 1.97 万块，后台静默+进度通知），数据文件更名 `secondbrain_meta.json` / `secondbrain_vectors.vec`。
4. **缺陷修复随迁**（Q3=B）：refresh 仅删除不落盘（提前 return 跳过 save，QA/bz 同源）改为删除也持久化；旧向量段偏移按删除前键序计算（原实现删除非末尾文件会错位）；QA 分块大段路径不清 buffer 导致的内容重复一并修正。

## 后果

- 正面：功能首次真正可用；命名与心智模型一致；历史包袱（死配置保留但如实标注除外）一次清空；向量库统一到 QA 分块口径，检索质量与原型一致。
- 代价：回滚到旧版插件会因数据文件更名而整库从头重建（可接受）；设置键迁移后旧工具若直读 data.json 旧键将失效（已知无私有消费者）；冻结清单中「flash refresh 不清理已删文件向量条目」条目随之修订为「已于 ticket 103 修复」。
- 中性：`'flash'` 作为笔记类型词汇长期与「第二大脑」并存，新代码不得再将其用作功能模块名。

## 补记（ticket 107，2026-08-25：首用引导 + 隐形 bug 清剿）

1. **首用引导（用户需求）**：本地无向量数据（`isIndexReady()=false`：空库或 meta 残留但 .vec 缺失的损坏态）时，三条命令统一打开主面板引导态——说明文案 + 「开始向量化」按钮；**首次向量化必须由用户触发**：启动路径空库不再自动全量嵌入、vault modify 防抖在索引就绪前不生效；点击按钮显示进度条（解析 QA 进度文案），完成后自动切换正常统计面板；失败（QA 语义下全部嵌入失败仍报「完成」文案，故以 isIndexReady 判定）给出原因并可重试。
2. **样式文件补齐**：ticket 103 的「bz-sb-* 收敛根 styles.css」实际未落盘——`src/secondbrain/styles.css` 从未创建，全部第二大脑 UI 以裸 DOM 发布。本次补齐全套样式并接入 `scripts/build-css.mjs` 聚合清单（置于 smartcat 前）。属 103 验收项的补完成，非新决策。
3. **行为修订两处（超出 QA 基线的 bz 改进）**：① refresh 并发去重——进行中的 refresh 复用同一 promise（启动全量刷新 / vault 防抖 / 面板打开三入口并发会让 srcOffsets 与合并布局错位且不自愈）；② 损坏态自愈——meta 有条目但向量为空时 refresh 视为全量重建（否则 mtime 全匹配永远「已最新」，索引损坏不可恢复）；③ 移动端嵌入端点走「远程 Ollama URL」（原实现移动端 refresh 只会打 localhost 必败，引导初始化在移动端因此可用）。
4. **移植回归修复**（对齐 QA，非冻结缺陷）：getEmbeddingsBatch 空结果恢复抛「向量为空」（畸形 2xx 走逐条回退而非登记空向量致行映射错位）；renderMarkdown 异步失败回退 textContent（原 try/catch 是死路径）；makeDraggable 视口钳制（QA L906-908）；jumpToChunk/后台防抖 refresh 补 .catch 防 unhandled rejection；DeepSeek 模型设置生效（`chat()` 硬编码 'deepseek-v4-flash' 致 secondBrainDeepseekModel 永不传出，改调 `prompt()` 用注入的 defaultModel）；main.ts onunload 补调 `unloadSecondBrain()`（原先导出但从未接线：残留窗体 ESC 失效、防抖定时器卸载后仍触发）。
