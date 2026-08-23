# ADR-0026：smartcat 影视动作感知观察（movie observation diff）

Status: accepted（2026-08-23，ticket 074）

## Context

smartcat 影视观察原走 `context-source.observationText` movie 分支：vault create/modify → 固定句式「你看了《X》（评分 N），影评：…」。三处缺陷（用户反馈）：

1. **动作不可分**：新增想看/在看/已看、状态流转（含手改回退）、评分/改分、写/改/删影评、删除全部落到同一句式，「你看了」语义与想看/在看错位。
2. **UI 影评丢失**：影评写入 frontmatter `影评` 字段，observationText 只取去 frontmatter 后的正文本体——抽屉写的影评 100% 观察不到；而正文本体常见的首行海报双链（`![[CONFIG/MOVIE POSTER/…]]`）反被当「影评内容」记入（线上已出现两条此类记忆）。
3. **事件缺口**：onVaultActivity 只挂 create/modify 且统一 10 分钟去弹跳——用户 20 分钟连续操作只留第一条；删除影视（vault delete）完全不观察；外部海报脚本补写 frontmatter 在窗口外还会产生重复「你看了」。

## Options

- **A（采纳）movie-source 快照 diff**：新纯函数模块 `src/smartcat/movie-source.ts`，prev 存每条影视快照 `{rating, review, watchDate, body}`，create/modify/delete 时 diff 产出动作文案；数据仍读同一 md，**状态仍由 frontmatter `评分` 推断（-1/0/>0）**——数据格式零改动，历史数据直接可读。
- B 保留 observationText 并只修正则/补 delete：修复不了动作语义，且 UI 影评字段仍读不到（observationText 的 body 定义即「去 frontmatter 后正文」）。
- C 在 movie 域 UI 动作处显式调用观察：侵入 movie 域、绕过事件统一入口，与 ADR-0003 的事件驱动架构相悖。

## Decisions

- 观察链路：onVaultActivity 遇 `classifyPath==='movie'` 交 `observeMovieFile`（快照 diff），**豁免 10 分钟去弹跳**（连续操作逐条观察）；**正文观察单独 10 分钟节流**（防编辑器自动保存连发）；补挂 `vault.on('delete')`。
- 动作文案优先级：**状态 > 评分 > 影评 > 正文**，一次事件最多一条；create 已看合并「状态+评分+影评」。
- 影评观察读 frontmatter `影评`（修复 UI 影评丢失）；正文观察 = 剥「纯双链嵌入行」（首行海报位典型形态）后的内容，语义「笔记里写了内容」。
- 仅海报/豆瓣字段变化的 modify（外部海报脚本补写）：prev 只存相关字段 → 无 diff → 天然不观察。
- 首快照：smartcat ensure 时扫描 `我的/影视/*.md` 建 prev（不产出观察），先快照后挂监听防 create 漏判。
- delete 观察仅限「会话内有快照」的文件（防旧文件删除噪音）；快照与节流均为会话内存（不落盘，unload 清理）。
- `observationText` 的 movie 分支**保留不动**（兼容冻结 + context-source 既有测试不破坏），仅接线改走新链路。
- 评分解析 `parseFloat`（支持小数，修复旧 `(\d+)` 丢 3.5→3）。

## Consequences

- 观察文本从「快照描述」变为「动作描述」，检索/周报/反思拿到的信息粒度显著提高（如「你把《X》从想看改为在看」可支撑作息与兴趣画像）。
- movie 路径不再触发 PAD note_read 微动（观察自带的情绪共振保留）——行为注解；信任成长本就只有 diary/flash。
- 既有「你看了《X》（评分 N），影评：…」旧记忆不迁移（兼容冻结）。
- 边界：影视文件 rename 未处理（文件名即片名，rename 会丢快照索引，回退为 create）；可配影视目录 `movieFolderPath` 与 classifyPath 的硬编码前缀不一致问题延续现状（本次不改）。