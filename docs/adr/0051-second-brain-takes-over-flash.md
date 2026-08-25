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
