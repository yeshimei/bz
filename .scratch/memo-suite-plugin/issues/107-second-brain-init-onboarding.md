# 107 — 第二大脑：首用引导（首次向量化须用户触发）+ 隐形 bug 清剿

**What to build:** ① 本地还没有向量数据时，主面板/参考侧边栏/AI 对话三条命令统一打开主面板，面板显示初始化引导（简短说明 + 「开始向量化」按钮）；首次向量化必须由用户点击按钮触发——启动路径空库不再自动全量嵌入、vault modify 防抖在索引就绪前不生效；点击后显示进度条，整体向量化完成后自动切换正常面板统计，失败给出原因并可重试。② 全面排查 secondbrain 域隐形 bug 并修复。

**Blocked by:** 103

**Status:** done（2026-08-25）

## 验收清单

- [x] `VectorStore.isIndexReady()`：meta 有条目且向量已装载才为 true；空库 / meta 残留但 .vec 缺失（损坏态）→ false
- [x] 三命令统一入口：`bz-secondbrain-open` / `bz-secondbrain-chat` 在未就绪时转开 `openSecondBrainPanel`；主面板引导期 📚💬 功能钮收起
- [x] 首次向量化须用户操作：`ensureSecondBrain` 启动仅在已有索引时增量 refresh；空库只打日志等待引导按钮；vault:md-modified 5s 防抖加 isIndexReady 门
- [x] 引导态 UI：说明文案（白名单分块→Ollama 本地向量化→数据不出本机）+ 开始按钮 + 进度条（解析 QA「向量化: x/y chunks」实时百分比）+ 状态行
- [x] 完成切换：refresh 结束后 isIndexReady → 切内容态并立即渲染统计卡片；失败分支三态（白名单无文件 ⚠️ / 全部嵌入失败〔QA 文案仍报完成〕/ 无可索引内容）给出原因、按钮变「重试初始化」
- [x] 启动竞态防护：store.initialLoad 完成信号，主面板 open 先等 load 再定形态
- [x] **样式补齐（103 验收项补完成）**：`src/secondbrain/styles.css` 全套 bz-sb-* 样式（主面板/窄窗/参考卡与悬停预览/AI 对话/移动端抽屉/引导态）+ 接入 build-css.mjs SOURCES——此前该文件从未创建，全部 UI 裸 DOM 发布
- [x] refresh 并发去重：进行中调用复用同一 promise（非 async 包装，p1===p2）
- [x] 损坏态自愈：meta 有条目但向量为空 → refresh 全量重建（原 mtime 全匹配永远「已最新」不可自愈）
- [x] 移动端嵌入走远程 Ollama URL：getEmbeddingsBatch/getEmbedding 传 baseUrl（IS_MOBILE → OLLAMA_REMOTE_URL 兜底 OLLAMA_URL）
- [x] getEmbeddingsBatch 空 embeddings 抛「向量为空」（QA L125 同语义，畸形 2xx 走逐条回退）
- [x] renderMarkdown 异步失败回退 textContent（.catch 补死路径）；makeDraggable 视口钳制（QA L906-908）；jumpToChunk .catch；后台防抖 refresh .catch
- [x] DeepSeek 模型设置生效：ai.ts 改调 prompt()（chat() 硬编码 'deepseek-v4-flash' 致 secondBrainDeepseekModel 失效）
- [x] main.ts onunload 补调 unloadSecondBrain()（原先导出零调用：残留窗体 ESC 失效、防抖定时器卸载后仍触发整轮嵌入）
- [x] reference-panel 在途检索 post-await isClosed 守卫；内容态打开改为 refresh 完成后重渲统计（修旧数据展示）
- [x] 测试：tests/secondbrain/init-ready.test.ts（isIndexReady 真值表/自愈重建/并发去重/全败 resolve）+ onboarding-ui.test.ts（空库三命令转向/成功路径进度→统计/失败原因可重试/就绪库直进内容态）+ ollama-cov 更新（抛错语义/baseUrl）+ vector-store.test 健康库夹具修正
- [x] 文档：spec 用户故事 53-54 + Further Notes、ADR-0051 补记、CONTEXT.md 引导态词条、PROGRESS.md

## 决策记录

- QA 行为冻结不破：「全部嵌入失败仍报 ✅ 完成」「嵌入失败删除该文件旧条目」均为 QA 同源语义，保留；面板以 isIndexReady 判定成败而非改 refresh 文案。
- 移动端 refresh 嵌入端点改远程属 bz 改进（QA 移动端从不本地 refresh），仅按钮触发的初始化受益，自动路径仍不抢跑。
