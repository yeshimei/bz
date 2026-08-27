# Ticket 125：剪藏本两个小问题——先弹窗后加载提示 + 自动摘要详设去左边距平级（用户反馈）

- 状态：master 直接实现完成，待提交
- 域：clipping（剪藏本）
- 来源：用户反馈「点击剪藏本等加载完才会弹出窗口，先弹窗窗口，显示正在加载这样的消息」「设置面板，自动摘要的下级选择不要给左边距，平级显示」
- 关联：`src/clipping/view.ts`、`src/clipping/styles.css`、`tests/clipping/view.test.ts`

## 问题一：先弹窗并显示加载提示，再加载数据

**根因（真机机制）**：`loadAllArticles` 的整批解析里，`parseArticleFile` 是 async 但函数体无内部 await——`Promise.all(map(...))` 的 map 回调全部**同步执行**。解析整批抢在浏览器绘制首帧之前跑完，加载提示「📚 正在加载文章...」在同一个同步任务里被追加又被打包替换（`renderEntries(true)` 清空重挂）。点击剪藏本后主线程整批解析期间无任何视觉反馈，窗口与内容**同帧出现**，观感即「等加载完才会弹出窗口」。

**修复（先窗口后加载）**：
1. 提取 `showLoadingHint()` 助手（清空内容区 + 挂加载提示）；
2. `loadAllArticles` 在 `isLoadingData = true` 之后**让出一个宏任务**（`await new Promise(r => setTimeout(r, 0))`）再解析——浏览器先绘制「窗口+加载提示」首帧，数据就绪后整体替换；
3. **重开（面板已存在）路径同样先 `showLoadingHint()`** 再 `loadAllArticles()`：重载期间不残留旧列表，与首次打开行为一致（保留 B1「重开即重载」语义）。

行为变化：首开与重开均为「点击 → 窗口 + 正在加载 → 数据渲染替换」；无数据格式/命令 id/DOM 契约变化。

## 问题二：自动摘要下级选择去掉左边距，与父级平级

`src/clipping/styles.css` `.auto-summary-detail` 的 `padding: 4px 12px 12px 44px` 中 44px 左边距造成缩进 → 改为 `4px 12px 12px 0`：摘要长度/生成标签/标签数量/摘要时机四行与「自动摘要」开关行文本左缘对齐（`.setting-item` 的 `margin: 0 -10px` 负边距使 hover 整行伸展与父级一致），保留行间分隔线与联动显隐。

## 测试

- 新增 UI 用例「打开先弹窗并显示加载提示，数据让出事件循环后渲染替换（首开与重开一致，先窗口后加载）」：断言首开/重开时窗口先行可见 + 内容区为加载提示 + 卡数为 0，宏任务让出后渲染替换为卡片；
- 既有 61 例 clipping/entries 用例全绿（全部经 `flush()`/`advanceTimersByTimeAsync` 吸收让出延迟）；全量 + tsc 复核见提交记录。