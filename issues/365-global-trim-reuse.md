# 365 · 全域复用上收批：core/http · file-sync 壳 · uiModal · password-vault 收编 · 机械项

> 2026-09-16。同 issue 364 评审的复用侧。用户裁决「其余全部采纳，一起修复」。
> 分支 `chore/global-trim-batch`（worktree `../.dsh-worktrees/global-trim`）。
> 前提：项目已有一轮收敛底座（core/ui 组件库 2539 行、notice 全域单源、AI 全走
> createAI、data 层 jsonFileStore 单源），本批收的是**剩余**重复，不重复 ADR-0104/0105
> 已拍板的域 markup 单源（四域列表渲染不强合并、域皮肤 CSS 不合并）。

## 一、实现清单

| # | 改动 | 要点 |
|---|---|---|
| 1 | 新建 `core/http.ts` | `withTimeout(p, ms)` + `httpGetText(url, {timeout, headers})`；收敛七处手写带超时请求（语义三套：cinema douban-queue ≈ clipbook news-fetcher 的 race→null、favorites/ai 与 knowledge video-meta/note-gen、encrypt/preview 的 race→reject、secondbrain/ollama 的 AbortController） |
| 2 | `core/file-sync.ts` 公共壳 | 三份 file-sync（memo 254 / clipbook 240 / knowledge 221 行，骨架逐行等价：_refs/_cancelled/queue/enqueue/去抖/batch flusher/folder 匹配/init/unload）抽壳，域各留 ~40 行纯函数（watchedFolders/syncRename/syncDelete） |
| 3 | password-vault 收编 | 自绘 `askConfirm`/`toast`（ui.ts:990-1032，E1 注释自述曾因监听器叠加删错条目）迁 `openFlowDialog`/`notice`；encrypt/vault-pw-view 同款调用点随 issue 364 #7 一并消失 |
| 4 | 剪贴板复制降级兜底收 core | encrypt/ui:1987 与 password-vault/ui:1034 逐字雷同的 copySensitiveText→textarea+execCommand 兜底，收 core 单源 |
| 5 | 八处手写 mask+popup 弹窗壳迁 uiModal | favorites/ui:578、belongings/ui:502+791、encrypt/ui:1765+1906（随密码视图摘除部分自动消失）、knowledge/ui:614+1278、secondbrain/panel:305；只换壳保留各自脏检测/事件绑定 |
| 6 | 机械项清扫 | core debounce 换五域搜索防抖（belongings/clipbook/memo/diary/encrypt）；空态字符串工厂 `emptyHtmlStr()` 收 core/ui/empty 补 ×6 消费方；relTime 手写 ×5（favorites/smartcat×2/password-vault）统一走 core 口径；secondbrain 手写长按 ×2 换 core/dom longPress；pad2 ×12、localDayKey ×3 收编；13 处遮罩 CSS 样板（position:fixed+--bz-overlay+backdrop-filter）改用 .bz-overlay-mask 单源 |

## 二、不收编（负清单，防止后续重提）

- 四域（favorites/belongings/cinema/bookshelf）列表渲染/详情抽屉不强合并——ADR-0104/0105
  拍板稿，视觉差异是原型机制的一部分。
- 域 styles.css 不大合并（皮肤真实不同），只清遮罩样板。
- 域数据迁移逻辑（knowledge migrateLegacy、belongings emoji 迁移）是域语义，不收。
- secondbrain/ollama.ts、douban/news 抓取器本体不收（协议/防风控域内合法），只收超时壳。
- diary/ui/datetime-picker.ts（702 行）暂不上收——单一消费方，第二处需要时再收。

## 三、测试（要点）

- 新增：tests/core/file-sync.test.ts（壳 11 用例：匹配/去抖/E22 放行/unload 短路/队列断链不断）、
  tests/core/http.test.ts（四态 + withTimeout + 适配器 12 用例）、tests/core/clipboard-fallback.test.ts
  （4 用例）、tests/core/str-utils.test.ts（pad2/emptyHtmlStr 5 用例）、tests/password-vault/quick-pick.test.ts
  与 data-manager.test.ts（随 ADR-0158）、tests/home/summary-action.test.ts（随 ADR-0157）。
- 迁移：pv 确认流测试改 flow-dialog 交互断言；favorites/belongings 弹窗断言迁 uiModal 实际 DOM 口径；
  overlay-glass/enh-sweep-c/walkthrough-fix-c 旧遮罩样板守卫迁 core 单源新口径。
- 回归：F15 表单单例（批 8 壳重类双计）修复并固守卫；三域 file-sync 既有断言零改动全绿。

## 四、门禁

tsc --noEmit 0 错；全量 5522 通过 / 唯一失败 = preview-freshness 25 例（原型产物回主仓重出即绿）。
不收编留档：encrypt 主体/体检窗、knowledge 主窗/影像队列、secondbrain 面板（常驻工作台换壳必改行为）；
cinema douban-queue 与 secondbrain ollama 超时语义独特不收编；relTime 手写 4 处与 secondbrain
长按 2 处口径刻意不同保留（详见提交记录判定表）。
