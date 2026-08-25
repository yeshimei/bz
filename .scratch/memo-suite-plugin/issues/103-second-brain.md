# 103 — 第二大脑（secondbrain）：闪念正名接管 + QuickAdd 完整复刻

**What to build:** 以 QuickAdd 宏脚本 `E:\Obsidian\叫我包仔\CONFIG\SCRIPTS\Quickadd\闪念.js`（2311 行）为完整基准，完成 bz 内该功能的实现并正名「第二大脑」：`src/flash` 整体更名 `src/secondbrain` 并完全接管（旧目录删除），行为/算法对齐 QA 且保留 bz 四项改进，修复 refresh 仅删除不落盘缺陷，设置键全量换代 `secondBrain*` 并迁移，meta v7→v8 整库重嵌 + 数据文件更名，QuickAdd 差距 9/9 复刻，新增主面板统一弹窗与 ⚙️ 域设置弹窗，全部 UI 表面统一 BZ 样式。

**Blocked by:** 01, 02, 03

**Supersedes:** 18（闪念——其 UI 在 bz 中从未接线，本票按新基准完成实现）

**Status:** done（2026-08-25。全量 2595 测试/172 文件绿 + tsc 0 + 构建部署；验收清单全项落地，含三处缺陷修复：refresh 仅删除不落盘、删除后向量段偏移错位、批量回退不回填 fileChunksMap 致合并越界）

## 决策记录（2026-08-25 用户逐项拍板）

- **命名三层拆分**：功能显示名=第二大脑；模块 `src/secondbrain/`、命令 `bz-secondbrain-open|chat|panel`、设置键 `secondBrain*`；笔记类型词汇 `'flash'`（path-classify 卡片盒分类 / smartcat source 标签 / credibility 0.9 档位 / `flash:*` 域事件）**保留不动**。
- **行为基准 QA，保留 bz 四改进**：Ollama 30s 超时、MobileBuffer 写入修复、⚙️ 真·域设置弹窗、jumpToChunk offsetToPos 定位修复。
- **兼容破例三项（记 ADR）**：① 命令 id 换代不留别名（旧 `bz-flash-*` 无真实外部调用者）；② 17 设置键改名 + onload 一次性迁移删旧键（废弃 META_PATH/VEC_PATH 直接清除不搬）；③ meta v7→v8 首载整库重嵌（约 1.97 万块，后台静默+进度通知）且数据文件更名 `secondbrain_meta.json` / `secondbrain_vectors.vec`。

## 验收清单

- [ ] 数据层对齐 QA：分块保段落边界（空段聚合→句界切、块间保留结构）；cos=`1−d²/2`；getCurrentContext 句界集含中文分号/`;`/省略号 `…` 且空行回退上一行尾 300 字；TF-IDF 以 chunk 为文档单位且索引构建后复用（不随查询重建）；文本检索返回命中 chunk 原文 + QA 加权评分（精确串 0.7+长度比×0.3 / 词命中×0.5+词频×0.25+密度×0.25 / <20 字 ×0.7 / 阈值 0.25）；VP 树节点存 mu/minD/maxD 包络剪枝 + 构建结果按 {dim,count,noteCount} 缓存复用；parallelMap 自适应并发（EMA 爬坡上限 60）；refresh 仅删除文件也落盘（saveStore/saveVectors，偏移重算正确）
- [ ] meta v7→v8：版本不符整库重建（QA 同语义）；文件名 `<storagePath>/secondbrain_meta.json` + `secondbrain_vectors.vec`
- [ ] 设置换代：17 键 → `secondBrain*` camelCase，DEFAULT_SETTINGS 默认值平移；onload 迁移（旧键有值且新键缺失→复制→删旧键）；`flashEnabled→secondBrainEnabled`；新增 `secondBrainMobileDefaultFullscreen`（默认 true）
- [ ] 入口接线：`ensureSecondBrain` 幂等启动（加载库→桌面全量增量 refresh + vault modify 后 5s 防抖静默刷新→移动端探活远程否则建 TF-IDF 索引并提示）；三条命令回调真实打开面板
- [ ] FloatWindow 窄窗：右贴边 300px 全高/📚/⟲复位/◀隐藏成边条悬停展开/✕/Esc/标题栏拖拽/8 向缩放/双击最大化；⚙️ 打开域设置弹窗
- [ ] ReferencePanel：结果过滤当前文件、卡片正文 markdown 渲染、悬停预览（路径+匹配度+智能左右定位）、双击跳转 chunk 前 30 字并选中、长按 250ms 浮起→位移>15px 拖出独立浮卡状态机（可拖/缩/双击归位）
- [ ] ChatPanel：DeepSeek 复选框走 core/ai 注入通道（失败回退本地 Ollama）、Enter 发送、markdown 渲染回退纯文本、历史仅 UI 展示+裁剪 MAX_HISTORY×2 不进 prompt（每问独立检索）
- [ ] MobilePanel：底部抽屉 📚参考/🤖AI 双 tab、拖拽调高吸附 45vh/75vh、<18vh 收起 mini 胶囊点击展开、escManager 注册、selectionchange 监听、光标轮询、单击懒渲染展开、长按 500ms 震动跳转并收起
- [ ] 主面板 `bz-secondbrain-panel`：统一弹窗 `.bz-win-head`；头部按钮秩序 功能（📚 侧边栏 · 💬 对话）→ ⚙️ → 关闭（✕ 仅移动端全屏显示，桌面 mask+ESC）；内容 = ①统计卡片（向量块总数/覆盖笔记数/维度/存储占用/上次索引时间）②来源分布横条（白名单目录）③近 12 周向量化趋势自绘迷你图（零图表依赖）④最近向量化 Top10（点击跳原文件）⑤AI 一键概括（按钮触发 Ollama 总结、缓存 `STORAGE/secondbrain_panel.json` 含生成时间可重新生成）；**每次打开自动触发增量刷新**
- [ ] ⚙️ 弹窗：基础/检索/对话三分组 + 「移动端默认全屏」（仅 isMobileEnv 显示）+ 「清除 AI 概括缓存」动作行
- [ ] 样式统一：全部表面（窄窗/参考卡/悬停预览/浮卡/对话面板/移动端抽屉/主面板）换 `bz-secondbrain-*` 类名收敛根 `styles.css`；删除运行时 `<style>` 注入；交互逻辑照 QA
- [ ] `'flash'` 词汇冻结验证：path-classify/smartcat source/credibility/域事件零改动；`src/smartcat/memory.ts` import 更新为 `'../secondbrain/ollama'`（getEmbedding/checkRemoteOllama 函数签名不变）
- [ ] 命令换代：main.ts COMMANDS 表 `bz-secondbrain-open`「第二大脑」/ `bz-secondbrain-chat`「第二大脑对话」/ `bz-secondbrain-panel`「第二大脑面板」；懒加载挂 `secondBrainEnabled`
- [ ] 测试：数据层对齐回归（分块/cos/句界集/tfidf 粒度/文本检索评分/vptree 剪枝/refresh 删除落盘/v8 迁移/文件名）、设置键迁移、UI jsdom（窄窗吸附展开/浮卡状态机/主面板统计渲染/AI 概括 mock）、smoke 断言三条新命令
- [ ] 门禁：pnpm test 全绿 + tsc --noEmit 0 错误 + 构建；文档同步（spec.md 修订、ADR、CONTEXT.md 词条、AGENTS.md 领域清单/铁律1/架构决策6、README）
