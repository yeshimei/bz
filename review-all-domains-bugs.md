# 全域 bug 审查报告（除 smartcat / secondbrain / literature）

> 审查日期：2026-09-04。范围：src 下 20 个功能域约 4.7 万行（attach / auto-summary / belongings / bookshelf / cinema / clipbook / diary / diary-wall / encrypt / favorites / home / launcher / library / memo / movie-report / password / pomodoro / reading-report / review / todo），core/settings-panel 仅在 questioned 时顺带核对。
> 方法：12 个只读审查子代理（6 组 × bug/体验两线，4 波串行降并发避限速），逐文件核对功能逻辑与 UI 交互，基准为 AGENTS.md 铁律 + 两份 UI 手册 + CONTEXT.md 词条。未改动任何文件。
> 基线：master（审查期间合入了 bookshelf B1-B11（d061df1）与 todo T1-T6（4a9f17b）修复，相关组结论以合并后代码为准）。cinema/movie-report/home 已有旧报告 `review-cinema-moviereport-home.md`，本报告不重复其条目，仅标注复核状态。

## 修复状态（2026-09-04）

用户拍板后已派 6 个后台修复子代理，各自在独立 worktree 开发（主线程串行合并回 master）：

| 分支 | worktree | 范围 |
|---|---|---|
| fix/audit-cinema | .dsh-worktrees/audit-cinema | ✅ **已完成**（7 commit，tsc PASS，3726 用例全绿，含「海报外链」验证证不实） |
| fix/audit-diary | .dsh-worktrees/audit-diary | ✅ **已完成**（12 commit，3742 用例全绿；wall「已滚过月份 no-op」验证属实已修；emoji 变体验证属实但因需产品拍板跳过） |
| fix/audit-vault-clip | .dsh-worktrees/audit-vault-clip | ✅ **已完成**（6 commit，3714 用例全绿，红测试已修；news.json 写队列+段级合并落地；另修审查未列出的 UP 筛选恒空相邻 bug；部分项发现 master 已修只补测试） |
| fix/audit-books | .dsh-worktrees/audit-books | ✅ **已完成**（16 commit，3720 用例全绿；「待验证」两项 rebuildItems 并发/activeLeaf 均验证为真并已修；跳过 3 项产品拍板转体验线） |
| fix/audit-store | .dsh-worktrees/audit-store | ✅ **已完成**（11 commit，3725 用例全绿；memo 写竞态走 core/storage enqueueFileTask 事务级互斥；favorites 余额回写验证后免修） |
| fix/audit-review | .dsh-worktrees/audit-review | ✅ **已完成**（12 commit，3836 用例全绿；stage9 满血 FSRS 验证属实、按用户拍板转增强线实现） |

**跳过未修（涉及产品拍板，已全部转体验线补问并拍板）**：review stage9 满血 FSRS（拍板：进入满血 FSRS）、todo「今日」已完成口径（拍板：只看今天）、reading-report 统计范围（拍板：只算书库）、密码 favicon（拍板：保持外取但修清晰度）。

## 收尾（2026-09-04）

6 分支全部合并回 master（merge a41288e / 749662a / 82f2b3c / f375a3e / 1a17577 / 8a487ce），合并后门禁 **tsc 通过、243 文件 / 3863 用例全绿**（较审查基线净增 170 回归用例），`pnpm run build` 已构建部署到插件目录。审查报告内可修 bug 全部闭环；转增强线的拍板项随体验增强批次实现（记录于 `review-all-domains-ux.md`）。

### 旧域退役追加（同日）

- ✅ **password 已退役**（commit bfff5c6 / merge 5182c71）：共享加密服务迁入 `src/core/crypto.ts`，域代码与测试删除（13 文件 -2589 行），门禁 3804 用例全绿，已构建部署。遗留观察项：`passwordMobileDefaultFullscreen` 存量键被 mobile 测试「11 键」断言锁定，随退役票统一处理。
- 📋 **library 先迁移再删**（读书笔记/划线迁入书架详情 + 首页快照/读书报告/设置键等 6 处接线，列入实现批次）；**memo 接管已立项**（后台文件同步/剪藏归档迁入 todo 后退役）。

## 门禁佐证（主线程实测）

- `pnpm exec tsc --noEmit` 通过，无类型错误。
- `pnpm test`：3692/3693 绿，1 例失败：`tests/encrypt/vault-ui.test.ts`「密码添加弹窗：保存后落盘 + 列表出现新平台」。**已定位为测试时序缺陷，非产品 bug**：保存回调要等完整加密落盘链（≥2 次 PBKDF2-100k 派生）走完才 `renderAll()`，测试固定只等 40ms；且断言 `pwData[0].platform` 只证明内存 unshift，不构成落盘证据。修复方向（测试侧）：改用同文件已有的 `waitFor(() => listcol.textContent.includes('豆瓣'))`（超时 ≥3s）或 mock `CryptoService`。

## 结果总览

| 域 | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| diary | 2 | 1 | 3 | 6 |
| diary-wall | – | 4（1 待验证） | 4（1 待验证） | 3 |
| cinema | – | 1 | 5 | 5 |
| movie-report | – | – | 1 | 2 |
| home | – | – | 3 | 3 |
| auto-summary | – | – | 3 | 3 |
| encrypt | – | 1 | 2 | 8 |
| password（死代码） | – | – | – | 3 |
| clipbook | – | 2 | – | 6 |
| bookshelf | – | 2 | 1 | 6 |
| library | – | 1 | – | 4 |
| reading-report | – | – | 3 | 5 |
| favorites | – | – | – | 4 |
| belongings | – | 1 | 2 | 4 |
| memo | – | 2 | 1 | 1 |
| todo | – | 1 | 3 | 3 |
| review | – | 3 | 4 | 6 |
| pomodoro | – | – | – | 3 |
| launcher | – | – | – | 3 |
| **合计** | **2** | **19** | **36** | **82** |

### 最优先修复（Top 10）

1. **diary P0×2（静默数据丢失）**：writeFile 全量重写丢未解析行；同刻同标签两条日记解密还原吞一块（`encrypt/data.ts:1298` mergeDiaryBlock 以标题行为判重）。
2. **clipbook P1**：剪藏保存失败仍标已处理+清正文，文章内容丢失（`flow.ts:126` / `save.ts:50`）。
3. **diary-wall P1 三连**：id 断层导致复制双链静默失败、加密不删原块（内容双份）、删除失败或最坏误删同刻日记——统一改 filename+lineNumber 反查。
4. **cinema P1**：编辑弹窗改名称/改类型是假保存，落盘触发 rebuild 后当场弹回旧值（`ui.ts:516` persistItem 只写评分/日期/影评三键）。
5. **review P1×3**：个人拟合链路从数据源头断裂（history 从不写 difficulty）；R 阈值「提前逾期」条目被 markReview 未到期守卫拒绝，做不了题也挂不上待重做；时间线 R 值被二次 ×100 显示成 8500%。
6. **memo P1**：编辑保存把条目 url 抹成 null（对照 todo 已防）；同源双面板同步是单向的（memo 侧无 modify 监听）。
7. **encrypt P1**：移动端详情页「更多操作」按钮全部失效（`tmp.click()` 触发不了 contextmenu/长按手势）。
8. **todo P1**：移动端面板被内联尺寸压成 ~92%×580px 小卡（内联样式压过媒体查询，默认配置即触发）。
9. **bookshelf P1×2**：「近 12 月读完」柱月份映射整体反转（高亮的「本月」其实是 11 个月前）；面板重开残留搜索关键字但输入框为空。
10. **belongings P1**：openPanel 无重入保护，快速双触发产生关不掉的僵尸遮罩。

---

# 一、影视与首页组（cinema / movie-report / home / auto-summary）

## 1. 影院（cinema）

**小结**：数据契约（frontmatter 解析/状态推断/排序筛选/事件补发/poster 轮询链）总体扎实，但**编辑表单的“改名/改类型”是假保存**（P1），另有一批 P2：删除失败假成功、AI 荐片无重入防护、overlay 无 z-index 与 home 层叠打架、“每批加载数量”是死配置、“按创建”实为按修改时间。

### P1 功能错误

- **`src/cinema/ui.ts:516-518` + `src/cinema/ui.ts:444-450` · 编辑弹窗改名称/改类型不落盘，保存后约 300ms 自动回退**
  保存处理把 `item.name / item.typeTag / item.group` 写进内存对象，但 `persistItem` 的编辑分支只写 frontmatter 的 `评分/观影日期/影评` 三个键——既不 `vault.rename` 文件（名称源自文件名 `《X》`，见 `data.ts:16`），也不写 `tags`。而 `processFrontMatter` 落盘必然触发 `vault:md-modified` → `index.ts:37-41` 防抖 300ms 后 `rebuildItems` 用磁盘旧值重建 → 用户看到“已保存”提示后名称/类型当场弹回旧值，重启也不会生效。名称与类型两个输入框在编辑态是纯陷阱。
  修复方向：编辑分支补 `fileManager.renameFile`（改名）+ 写 `fm.tags`（改类型），或编辑态禁用名称/类型输入。

### P2 明显错误

- **`src/cinema/ui.ts:564-579` · 删除失败仍提示“影视已删除”并从列表移除**
  `vault.delete` 抛错（Windows 文件被占用很常见）只 `console.error`，随后无条件 `splice` + success 通知；条目在下次 rebuild 时“复活”。修复方向：catch 里 return 并报错，不摘条目。
- **`src/cinema/recommend.ts:150-157` + `src/cinema/ui.ts:754-760` · runAIRecommend 无重入/并发防护**
  AI 运行中每次点击都新起一轮 `ai.json`：双倍 token 消耗，两个并发请求各自在完成时写 `M.aiResult`，慢者覆盖快者。修复方向：入口判 `M.aiRunning` 直接 return（或 abort 上一轮，ai.ts 已支持 signal）。
- **`src/cinema/styles.css:9-13`（`.bz-cinema-overlay` 无 z-index）× `src/home/styles.css:14`（home 静态 400）· 面板层叠错位**
  cinema overlay 全域无 `allocZ/topifyZ/zIndex`，z-index:auto；home 是静态 400。home 开着时用命令面板/快捷键开影院 → 影院被压在 home 全屏遮罩之下不可见；ESC 则先关看不见的影院。修复方向：cinema overlay 显示时 `topifyZ` 发号（ADR-0067 惯例），home 同步改动态发号。
- **`src/cinema/settings.ts:15` + `src/settings.ts:187,564` · “每批加载数量”（cinemaPageSize）是死配置**
  全仓无任何消费点，列表一次全量渲染，改了完全不生效。修复方向：实现滚动加载或删该行。
- **`src/cinema/data.ts:98-105` · “按创建”排序实为按修改时间（mtime）**
  `sortByCreatedDesc` 用 `file.stat.mtime`，任何编辑都会把条目顶到“按创建”榜首。修复方向：改用 `stat.ctime`。

### P3 小瑕疵（择要）

- **`ui.ts:104-111` × `poster-watch.ts:47`（待验证）**：`posterUrl` 只认 vault 内图片 TFile；若外部 watcher 写 http 链接，通知报“获取完成”但海报位永远空白。验证路径：看 `@jwbz/obsidian-douban-poster` 实际写入值形态。
- **`ui.ts:522-524`**：添加失败留幽灵卡（`M.items.unshift` 先于 `persistItem`，create 抛错后无 file 的条目残留列表）。
- **`poster-watch.ts:70`**：轮询 interval 卸载不摘（单次最长 5 分钟，卸载后仍读文件并 setMessage）。
- **`ui.ts:834-841` + `index.ts:77`**：`.bz-cinema-mask` 死分支（uiModal 遮罩类是 `.bz-overlay-mask`，该类名全仓无创建点）。
- **`ui.ts:819-826`**：关面板不复位 `M.view`，重开直接落在上次视图（AI 页/分析页/筛选跨开合残留）。

### 旧报告复核状态（review-cinema-moviereport-home.md）

- `data-cinema-idx` 可变索引隐患——**仍成立**，且「按创建=mtime」会让 rebuild 重排更频繁放大该风险。
- 海报 onerror 抹空占位、`getStarString` 死代码、chip 彩底对比度、目录设置重启生效——**均仍成立**。

### 已核验无问题

- frontmatter 契约与状态推断（-1/0/>0；`rawRating` 空值归已看防 `Number('')=0` 误判）；`getDisplayItems` 筛选→排序正确。
- poster 轮询链完整（占位 → 2s×150 轮询 → 超时收尾 error 不永久挂起）；`vault:md-*` 事件订阅路径有效。
- `movie:*` 事件与 smartcat/movie-source 契约逐字段对齐；ESC 分层正确；AI 页失败路径闭环；`ai.json` 走 response_format+多键兼容解析。

## 2. 影视分析报告（movie-report）

**小结**：统计口径与只读契约无新硬伤，但发现一个旧报告漏掉的**层叠硬伤：allocZ 发号被 cssText 整体覆盖而失效**（P2）。

### P2 明显错误

- **`src/movie-report/analysis.ts:514-519` · `overlay.style.zIndex = allocZ()` 随即被 `overlay.style.cssText` 覆盖，动态发号完全失效**
  CSSOM 中对 `cssText` 赋值会整体替换内联样式，刚设置的 zIndex 一并被清掉，分析窗最终 z-index:auto。后果：任何持 allocZ/topifyZ 遮罩的面板先开、再开影视分析报告 → 报告窗被压在遮罩之下不可见。修复方向：把 z-index 写进 cssText 之后（或用 `topifyZ`）。一行修复。

### P3 小瑕疵

- **`analysis.ts:415/429/457` 等**：全文无 HTML 转义（Windows 文件名禁 `<>` 使实际风险窄，但与 cinema 域全量 `esc()` 标准不一致）。
- **`analysis.ts:567`**：每开一次重复注册 ESC 层——已复核：register 对同名不可见层去重，无泄漏（旧报告已提，无害）。

### 已核验无问题

- `buildAnalysisData` 只读不写盘；片长/季集正则对空值安全；年份趋势不除零；命令/ESC/移动全屏契约不变。

## 3. 内容首页（home）

**小结**：快照层“先探测再读、失败静默回落”契约执行得好，命令映射全数有效；两个旧报告 P2 复核仍成立，另发现清空钉选不持久等边界。

### P2（旧报告已报，均复核仍成立）

- **`ui.ts:97-98,133-134` · 首帧空态闪烁**：先同步 `renderAll()` 再异步补数据，闪“还没有钉选域”。修复方向：先 `await ensurePinned()` 再首帧。
- **`ui.ts:207-224` · 编辑态下迷你 chips/侧栏行/关闭钮仍按常态执行**：`H.editing` 只拦域卡，mini/side 点击仍 `openDomain` 丢失编辑态。
- **层叠冲突（与 cinema 联动）**：`styles.css:14` 静态 `z-index:400`（详见 cinema 节，两域应一起改动态发号）。

### P3 小瑕疵

- **`data.ts:34-37` × `ui.ts:92,257-263` · 清空全部钉选不持久**：`normalizeData` 读到空数组回退默认——读写不对称。修复方向：空数组合法化或保存时禁止删最后一张。
- **`ui.ts:229-234`**：`execPal` 缺 `pal.hidden` 守卫（`movePal` 有），Enter 可执行已隐藏搜索面板的残留结果。
- **`ui.ts:295` × `styles.css:168`**：pick 定位假设宽 240 实际 232，右侧锚点必被裁 8px 以上。

### 已核验无问题

- 域卡/迷你 chips/侧栏命令 id 与 main.ts 逐一比对全部有效；快照只读契约（先 `fileExists` 防建文件）；`docClickHandler` 单例防重复监听；home.json 损坏回退默认不抛错。

## 4. 自动摘要（auto-summary）

**小结**：去重与失败路径做得细，但存在一个**数据丢失级的解析缺陷**（frontmatter 重建丢弃未识别行，对外来剪藏笔记是真实威胁）和「摘要时机设置改完不生效」的 P2。

### P2 明显错误

- **`src/auto-summary/parser.ts:16-37` × `processor.ts:194-202` · frontmatter 重建会静默丢弃未识别行（数据丢失面）**
  `parseFrontmatter` 只认 `^\w+:` 键和恰好两空格的列表项；`processFile` 写回时用 `buildFrontmatter` 整体重建。后果：本域管辖 `归档/网页剪藏` 里**任意来源**的 md，中文键、带连字符键、块标量、注释行命中一次补全即被永久删除。修复方向：保留未识别原文行原样拼回；或改用 `fileManager.processFrontMatter` 字段级合并。
- **同根因 · 无缩进列表风格的 tags 被判缺失并被 AI 覆盖**：`tags:\n- a` 解析为空 → AI 重新生成并整体覆盖用户已有标签。
- **`index.ts:52-67` × `clipbook/ui.ts:785-788` · 「摘要时机」改完不生效**：timing 下拉没有 onChange 重注册（同组自动摘要开关有）。lazy→immediate 后新剪藏不会自动摘要，直到重启。修复方向：timing 变更回调里 `stopAutoSummary()+ensureAutoSummary()`。

### P3 小瑕疵

- **`index.ts:43-46,90-102`**：停用开关不撤销已排队任务（已入队 setTimeout 仍会触发 AI 调用改写文件）。修复方向：排队改存 timer id，stop 时统一 clearTimeout。
- **`index.ts:70-80`（待验证）**：lazy 模式重复注册条件薄弱（`fileListenerRef` 恒 null，二次 ensure 会再挂一份监听；当前调用面恰好不可达，属防御性缺陷）。
- **`processor.ts:159-173`**：失败通知 5 秒自动消失，「重试」按钮窗口极短。修复方向：失败态显式传 `duration <= 0` 常驻。

### 已核验无问题

- `queueProcess` 双集合去重推演无漏洞；AIService 每次 prompt 现读设置；改名链路（非法字符/80 字截断/重名递增/失败回退）完整；通知契约（progress 常驻、原地合并、真实落盘文案）正确。

---

# 二、日记簇（diary / diary-wall / attach）

## 1. diary-wall（回忆墙）

**小结**：只读视图本体守住了“不改写数据”，但**自包含改造引入了致命的 id 断层**——wall 侧条目大多没有 id，而加密/删除/双链动作全依赖 id 反查 diary state，导致一批动作静默失败甚至误删真实日记。

### P1 功能错误

- **`src/diary-wall/ui.ts:1180` + `src/diary/ui/entries.ts:463` · “复制双链”对普通日记条目永远静默失败**
  wall 的 `parseFile` 不给普通条目分配 id（只有 movie/letter/book 有），`copyLink(entry.id || '')` 传空串，diary 侧 find 落空直接 return，无任何提示。修复方向：wall 侧按 `filename/lineNumber` 定位后本地拼双链，或给 wall 条目补 id。
- **`src/diary-wall/ui.ts:1239-1244` · 回忆墙“加密”动作不删除原块，内容双份**
  普通日记条目 `entry.id` 为 undefined，删除被跳过；原文还在 md、密文又进保险箱，解锁后同一条出现两次。且对 movie/letter/book 条目也开放“加密”，入库语义错位。修复方向：按 filename+lineNumber 定位后再删；特殊条目屏蔽加密入口。
- **`src/diary-wall/ui.ts:1294-1296`（含 P0 风险路径）· “删除”确认后无动作，最坏误删同刻日记条目**
  普通条目 `deleteEntry('')` 抛“未找到日记条目”且 `.then` 无 `.catch` → unhandled rejection，用户确认后什么都没发生；movie/letter 条目走 `deleteEntry` 时 `lineNumber=0` 与 md 全部失配，回退“该时间仅一条”兜底——若当天恰好有一条同 HH:mm 的真实日记，**会把那条日记从 md 里删掉**。修复方向：wall 删除按 filename+lineNumber 反查；特殊条目不给删除项。
- **`src/diary-wall/ui.ts:1069`（待验证）· 滚动高亮比较式混用坐标系，下半程恒指最后月份**
  `relTop = headRect.top - wallRect.top` 是视口相对量，却与 `scrollTop + 8` 比较——滚过一半后所有节头全部命中，章节栏恒高亮最后一个月。修复方向：条件改为 `relTop <= 8`。

### P2 明显错误

- **`ui.ts:1044-1051`（待验证）· 点击“已滚过”的月份跳转 no-op**：吸顶 sticky 节头 rect 全部 ≈ wallRect.top，点前面的月份不跳。修复方向：吸顶头不能用 rect，应回退 flow 位置推算。
- **`ui.ts:975 + 992/1032` · 章节栏胶卷缩略图永不加载**：`setupLazy` 只扫 wall，rail 是兄弟容器，`img[data-lazy]` 永远不被观察。修复方向：懒加载扫描范围包含 rail。
- **`config.ts:19`（配合 `main.ts:159`）· `applyDirectories` 无任何调用点**：改了日记/影视/信件目录后回忆墙仍读硬编码默认值。修复方向：main.ts 应用设置时同步调用。
- **`ui.ts:1561` · 日期选择器点年份即写入筛选但不刷新**：ESC 关闭后筛选已悄悄生效，之后任意 renderAll 才突然按该年过滤。修复方向：年份只记录临时值，点月份/全部才提交。

### P3 小瑕疵

- `ui.ts:1482`：`hide()` 不调 `closeContextMenu()`，ESC 关面板后右键菜单残留 body 可继续点击动作。
- `ui.ts:131`：`lockedVisible` 不随保险箱上锁复位，重开回忆墙显示解锁态样式。
- `ui.ts:1155-1159`：灯箱同时填充 desk+mob 双实例，`<video autoplay>` 两份同时加载播放，且 innerHTML 拷贝丢失 onerror 兜底。

## 2. diary（日记本）

**小结**：数据层主链路常规形态正常，但**两条数据丢失路径**（writeFile 全量重写吞未解析行；同刻同标签条目解密还原吞块）和**写日记弹窗日期脱同步**是实打实可触发的硬伤。

### P0 数据丢失

- **`src/diary/parser.ts:78,86-89` + `src/diary/store.ts:234-277` · writeFile 全量重写永久丢弃“未解析行”，条目内 H1 截断正文**
  解析时文件开头游离行、条目内“空行 + `# xxx`”之后的行都被判为 unparsed 丢弃；`writeFile` 用内存 map 整体重写整份文件无任何守卫——此后对该日期任何一次写日记/删除/改标签都会把那些行从磁盘永久抹掉。修复方向：writeFile 前跑 `scanUnparsed`，存在 freeTexts 时拒写并提示；或解析时把游离行挂到相邻条目保留。
- **`src/encrypt/data.ts:1298`（mergeDiaryBlock，diary 加密链路）· 同日同刻同标签两条日记，解密还原会静默吞掉一块**
  mergeDiaryBlock 以“标题行（emoji+HH:mm）完全相同”为判重。同分钟内保存两条同类型条目即产生相同标题行；加密其中一条再解密还原，`existingLines.some(...)` 命中另一条的标题 → 跳过插入却照常删镜像、删清单条目 → **该条内容永久丢失且无提示**。修复方向：块唯一标识不能只用标题行（还原块携带隐藏锚点/比对正文，冲突时追加插入而非跳过）。

### P1 功能错误

- **`src/diary/ui/datetime-picker.ts:562,586-594` + `dialogs.ts:585-589` · 写日记弹窗日期脱同步，滚轮确认会把日期写回旧时刻**
  闭包 `currentMoment` 只在面板创建时初始化一次；`openAddDialog` 每次只更新显示，不更新内部 moment。隔天写日记显示“今天”，滚轮起点却是创建日，直接点“确定”→ 日记存错日期。修复方向：`openAddDialog` 同步重置控件内部 moment。

### P2 明显错误

- **`dialogs.ts:674-680`（及 461-469）+ `entries.ts:149-151` · 插卡后 currentDisplayCount 未前移，滚动到底重复渲染尾部条目**。
- **`panel.ts:346-353` · 文件监听只订 modified 通道**：外部新建的日记不进面板；外部删除的文件条目仍留在面板，此时删除其中一条会触发 `writeFile` **重建已删除的文件**（内容复活为剩余条目）。修复方向：补订 created/deleted/renamed 三通道。
- **`dialogs.ts:426-435` · updateTags 定位失败时静默写旧数据**：targetEntry 为 undefined 仍 writeFile，UI 显示新标签、磁盘是旧标签。修复方向：未命中时告警并 return。

### P3 小瑕疵（择要）

- `parser.ts:53,110`：emoji 变体（`📽️` 带 VS16）不匹配 → 标签静默丢失 + 重写用户标题。
- `entries.ts:602`：删除确认 `.then` 无 `.catch`，deleteEntry 抛错时无提示。
- `datetime-picker.ts:621-642`：Enter 提交后 blur，`commitManualEdit` 双执行、无效输入双 notice。
- `store.ts:120-127`：日记目录缺失早退分支不清 `diaryDataMap`，后续 addEntry 会在已消失目录下建文件失败。
- `store.ts:451`：refreshTimers 与面板卸载无清理。
- `entries.ts:41`：每次 renderMarkdown `new Component()` 不 unload。

## 3. attach（搬附件）

**小结**：纯函数层与执行层质量较高（ADR-0014 fileManager 方案），主要缺口是 **md 链接 URL 编码未解码**导致一类附件收不进来。

- **`data.ts:84-116`（resolveTarget）· P2**：Obsidian 对含空格文件生成的 md 链接会百分号编码（`[图](My%20Image.png)`），直接拿原始串比对 `allFiles` 解析失败返回 null → 该附件永远不被搬移。修复方向：对 `kind === 'md'` 的 target 先 `decodeURIComponent`（try/catch 包裹）。
- P3：dest 路径已存在同名**文件**时跳过 createFolder → 后续全部 rename 失败但无“目标被文件占用”明确提示；`ensureAttachSeed` 循环中途 throw 会导致 desktop 已改但整体不落盘且静默；代码块里的伪链接也被收集搬移（与 metadataCache 口径不一致）；预览与执行各 collect 一次，两次之间 vault 变化时数字可能不符（影响小）。

---

# 三、保险库×剪藏组（encrypt / password / clipbook）

## 0. 必查项：vault-ui 测试失败根因（已定位，测试侧问题）

保存按钮回调要等完整加密落盘链（≥2 次 PBKDF2-100k 派生 + ~20 步 adapter IO，远超 40ms）走完才 `renderAll()`；测试只等 40ms 就断言，列表仍是保存前的空态渲染。`addItem`（`vault-data.ts:202-209`）第 207 行先同步 `pwData.unshift(item)` 再 `await save()`，所以 `pwData[0].platform` 断言任何时刻都通过——它只证明内存变更，不证明落盘。加密路径 `CryptoService.encrypt` 每次生成新随机 salt，deriveKey 缓存按 (password, salt) 永不命中，每次 encrypt 都跑满 PBKDF2。修复方向：测试改 `waitFor`（≥3s）或 mock CryptoService；可选产品侧优化：`addItem` 内存变更后先 `renderAll()` 再落盘（乐观更新），顺带消除「点保存后弹窗卡住 100-300ms 无反馈」。

## 1. encrypt（统一保险库）

**小结**：加密/落盘链路（原子写、自愈、防互吞）质量高，未发现数据损坏级问题；主要问题集中在 ESC 层级缺口与移动端详情页菜单按钮失效。

- **`ui.ts:1712-1747` · P1 · 移动端详情页「更多操作」按钮全部失效**：`tmp.click()` 触发 click，而 `attachItemActions` 只监听 contextmenu（桌面）与长按手势（触屏），移动端 contextmenu 分支又被 `isMobileEnv()` 早退；`openPwMobPage` 的 `[data-mob-menu]` 干脆没绑事件。影响：移动端加密笔记/日记/密码平台/账号详情页的 ⋮ 按钮点了没反应（预览/还原/删除/编辑全入口丢失）。修复：移动端直接 `openItemSheet(actions, opts)`。
- **`ui.ts:1439-1498`、`1507-1547` · P2 · 密码添加/编辑/平台编辑弹窗未注册 escManager 层**：ESC 命中主面板层，面板在弹窗底下被关闭；安全模式下 hide() 随即上锁清数据，再点保存 → 「保存失败：未解锁」。修复：弹窗注册独立 esc 层。
- **`ui.ts:1633` · P2（待验证）· `lockNow` 只读 `this.config.securityMode` 单口径**（hide() 是双口径），旧键单独为 true 时点「立即上锁」不上锁。
- P3：cleanup 不清 body 上无 id 的 `.bz-vault-dlg-mask`、不调 `pwDataManager.destroy()`、模块级 `clipboardClearTimer` 不取消；hide() 复位 pwState 但不清 `_diaryPlain`（明文缓存残留内存）；移动端加密日记资产空态复用笔记文案；`addItem` 先 unshift 后 save，save 抛错不回滚（幽灵条目会被下次成功保存固化落盘）；概览 recent 按相对时间字符串排序无时序意义；**密码平台头像把条目 URL 域名发给 `favicon.yandex.net`（隐私建议改纯字母底）**；解锁进行中无防重入。

## 2. password（旧密码本域，死代码）

**小结**：整域已与 main.ts / settings-panel 完全断开（仅 tests 使用），无现存可触发 bug；但有「若复活即数据丢失」的结构性地雷：`DataManager` 与 encrypt 的 `PasswordVaultDataManager` 是同一 SafeNote 的两个独立内存副本，无域事件订阅、save 整表盲覆盖——两面板并存时后写者覆盖前写者。建议文件头加 deprecated 标注或直接删除。另有 clipboard 清空计时器重复实现、load 抛错列表空白无重试入口。

## 3. clipbook（剪藏本）

**小结**：状态派生与 frontmatter 契约扎实（143 篇存量兼容）；两个 P1 都在「写 news.json」链路上。

- **`flow.ts:126-135` + `save.ts:50-100` · P1 · 保存失败仍标已处理、清正文，文章内容丢失**
  `writeClipNote` 内部吞掉全部失败只 notice 不抛；「同名覆盖确认点取消」「标题清洗后为空」也是静默 return。`flowSave` 据此继续 `markHandled(raw,'saved')` + 清 body——结果：剪藏目录没有文件，news.json 里该条 read=true/body 已删，条目从收件流消失，原文只剩 url 骨架。修复：`writeClipNote` 返回 boolean（或抛错），flowSave 仅在写笔记成功后 markHandled。
- **news.json 全部写路径均为「读快照→盲覆盖」，对守护进程无合并 · P1（影响幅度待验证）**
  插件侧串行队列只防内部并发，防不了外部进程；且 `loader.ts:71`、`news-source-settings.ts` 多处、`store.ts:267-281` **全部绕过队列**；`markHandled` 与 `bumpStats` 是两次独立读改写，放大窗口。daemon 在任一次 read→write 窗口内追加的文章/更新的 bilibiliCookie 会被旧快照覆盖丢失。store.ts 头注释宣称的「mergeWithDisk 双写者合并」实际未实现。修复：所有 news.json 写回并入 writeChain 并在写前重读盘按段 merge。
- P3：rail/胶囊计数用 `!a.read` 原始口径而列表过滤了 url 命中剪藏目录的条目 → 徽标数可大于列表可见数（`unreadTotal` 正确口径是死代码）；`data-src='${JSON.stringify(sel)}'` 未转义，UP 主名含单引号时 JSON.parse 抛错该源失效；保留天数只暴露「已跳过」，「已保存」仍默认 3 天即删且无 UI 入口；`runAction`/`writeNewsState`/`savedArchive` 等死代码（savedArchive 段只有清理没有写入，savedCount 恒加 0）；rail 的 B 站 UP 行显示 uid 不回填昵称；切到空源时右栏渲染上一源文章（`M.cur` 未清）。

### 已核验无问题（要点）

- encrypt：IV 每次随机 12 字节无复用；AES-GCM 认证失败统一按密码错误处理；清单三段式 rename 原子写+解锁自愈；镜像覆盖走暂存+rename+回滚；lockNote 提交式序列+挂起标记防互吞+失败回退；restore 阶段一全量校验零落盘；解锁节流；复制密码 60s 自动清空；中栏滚动结构自洽。
- clipbook：frontmatter 解析存量兼容无硬伤（缺失字段容错、非法时间戳回退、域名 try/catch）；写入端文件名清洗/yamlEscape/本地时间串；saved 三通道判定与目录保底语义一致；损坏 news.json 不清盘。

---

# 四、书簇（bookshelf / library / reading-report）

## 1. bookshelf（书架墙）

**小结**：B1-B11 修复后整体质量较好，但「近 12 月读完柱」月份映射整体反转、面板重开残留搜索关键字两个用户可感知问题仍在。

- **`data.ts:341-346` · P1 · 「每月读完」柱状图月份映射反转，「本月」标错柱**：循环 `i=11→0` 使 bars[0] 承载 11 个月前的数据却打上「本月」标签；当前月缩在最右且不突出。测试只 pin 了 label 未 pin 数据↔标签映射，属测试盲区。修复方向：`t = nowM - (11 - i)`，并补映射断言。
- **`ui.ts:570-575` + `state.ts:78` · P1 · 面板反复开关残留搜索关键字**：`M.searchKeyword` 只在插件卸载时清空，重开网格仍按不可见关键字过滤，输入框为空，用户无从排查。修复方向：createOverlay 重挂后回写输入框（或打开时清空）。
- **`library/notes.ts:151-224` × `bookshelf/ui.ts:426-442` · P2 · 双域同书并发写**：library 编辑批注/删除划线走 `vault.read → 全文 replace → vault.modify`，可把 bookshelf 并发落盘的 frontmatter 修改静默回滚。修复方向：library 改写收口到 `processFrontMatter`/`vault.process`。
- P3：`bookshelf:file-*`/`library:file-*` 六个订阅是死通道（FileDomainKind 不含这两域，白挂 8 个监听）；EPUB 日期用 UTC 切片与 reading-report 已修的本地口径不一致（UTC+8 早 8 点前读完归前一天）；`bindCoverFallback` 每次渲染重复挂 error 监听（慢性泄漏）；md 书分类不回落子文件夹与旧 library 口径不一致；`rebuildItems` 并发交错可能旧数据覆盖新数据（待验证）；toggle 语义可留下孤儿详情弹窗。

## 2. library（旧书库）

**小结**：功能面完整、竞态意识多处可见，但 EPUB 条目合并存在重复条目竞态。

- **`ui.ts:45-56,121-129` · P1 · 快速重开书库时 EPUB 条目重复累加**：复用打开路径先同步 md 再异步拼 EPUB，上一次合并未 resolve 时再次打开，两个在途合并先后落袋 → EPUB 卡片成对重复。修复方向：引入合并序号或以「md 基准 + Promise 汇合」重建。
- P3：双击跳转后 200ms 定时器引用不判旧新，可误关新开的笔记窗；批注编辑链路无 catch（失败/文件缺失时弹窗卡死且无反馈）；`Number(fm.readingProgress)` 可为 NaN；`jumpToHighlight` 用已废弃的 `activeLeaf`（待验证）。

## 3. reading-report（读书报告）

**小结**：分片渲染、中止校验、toast 收尾都细；主要问题是统计口径与 ESC 立约。

- **`index.ts:152-155` · P2 · 私挂 document keydown ESC 监听，违反 esc-manager 立约且关窗层级颠倒**：报告开着时按 ESC，若其下任何 escManager 层可见会先关「下层」并 `stopImmediatePropagation`，报告反而不关。修复方向：改 `escManager.register`。
- **`stats.ts:457-464` + `report.ts:398` · P2 · 「本月阅读」在当月无开读时显示旧月份数据**：monthlyStats 只为有数据的月份建桶，取升序末位当「本月」。修复方向：按当前年月键直查，缺桶显示 0。
- **`stats.ts:207-213` · P2 · 状态口径与 bookshelf/library 不一致**：报告有 completionDate 即「已读」，两面板要求双日期——只补了完成日期的书两边算不同状态。修复方向：三处统一判定函数。
- P3：月/年桶 `booksCompleted` 双计数（当前模板未露出，一旦启用即错）；统计范围不筛书库目录（全 vault book 标签都入报告，口径差异）；热力图单元格内联 style 里的 `@media`/`&:hover` 全部无效；月度速度趋势是 `Math.random()` 模拟数据（建议改真实派生或删除）；metadataCache 未就绪无守卫（待验证）。

---

# 五、收藏归物备忘待办组（favorites / belongings / memo / todo）

**契约核对（任务特别项）**：四域命令 ID、设置键、smartcat 事件载荷、数据文件格式核对**均未破坏**；T1-T6 修复后 todo 的跨域同步与尺寸防抖已成立。

## 1. todo（待办）

- **`ui.ts:287-290` + `styles.css:192-196` · P1 · 移动端面板被内联尺寸压成小卡（默认配置即触发）**：`openTodoPanel` 无条件写内联宽高（钳到视口 92%），优先级高于媒体查询的满屏规则；`todoMobileDefaultFullscreen` 默认 false 不挂带 `!important` 的类。修复方向：仅桌面写内联宽高。
- P2：「默认排序方式」设置对 todo 面板不生效（`M.sortMode` 不从 `memoSortMode` 播种，恒「紧急优先」）；「默认显示已完成」设置是死项（`M.showDone` 从不初始化）；公开课条目 coursePath 断链/残留（新建恒写 null、建议回填不记 path、改课程名后指向旧文件——todo 建的条目到 memo 面板课程标签不可点）。
- P3：「今日」视图会把历史上所有已完成条目纳入折叠区（语义待验证）；resize 缘热区与内容点击冲突（mousedown 未 stopPropagation）；搜索无防抖每键全量重渲（注释却称 250ms）。

## 2. memo（备忘录）

- **`ui.ts:494-501` + `:548` · P1 · 编辑保存把条目 url 抹成 null**：回填显示文本不含 URL，保存时 `extractUrlAndDisplay` 提取不到就无条件写 `url: null`——剪藏/链接条目的原网址一次普通编辑即丢（`clip-archive.ts:119` 后台路径特意防过，UI 路径没防；todo 已是 `url ?? old.url`，两域语义分叉）。
- **`ui.ts` 全文无 `vault.on('modify')` · P1 · 同源双面板同步是单向的**：T1 只给 todo 装了监听；memo 面板开着时 todo 的改动不刷新 memo 列表。修复方向：memo 侧加装同款防抖重读（或抽共享订阅）。
- P2：memo.json 读-改-写竞态窗口（memo UI、todo UI、memo 后台队列三写方无共享队列，后写者用陈旧基线覆盖先写者；概率低但真实丢写）。修复方向：收敛到模块级串行队列或 compare-and-swap。
- P3：勾选完成的定时回调无 try/catch，写盘失败成为未处理 rejection 无提示。

## 3. favorites（收藏本）

**小结**：P1 重写质量最好的一域——置顶恒前、再点回全部、动作序、smartcat 四载荷均与拍板一致；仅剩并发窗口与脏检查盲区级小问题。

- P3：表单脏检查不含标签与置顶（改了多选标签/置顶后 ESC 直接丢弃）；新建 id = `Date.now().toString()` 无去重（待验证）；loadItems 失败静默清空显示「暂无收藏」；批量余额回写有窄竞态窗口（回写整表可覆盖并发编辑）。

## 4. belongings（归物本）

- **`ui.ts:271-281` · P1 · openPanel 无重入保护，双触发产生关不掉的僵尸遮罩**：`await loadDatabase()` 前后两次都通过 `if (M.overlay)` 检查，创建 A、B 两个遮罩，closePanel 只移除 B，A 留在 DOM 整屏盖死只能重载。修复方向：进入函数先置同步互斥标志。
- P2：表单不在 ESC 层内（ESC 关掉的是身后的主面板，表单仍悬浮，对照 favorites 的 `isVisible = overlay || form`）；外部 modify 自动刷新把 `M.db` 整体换新对象后，已打开的抽屉/表单捕获旧引用，保存静默丢失（弹「已标记」但数据没写）。修复方向：动作回调内按 id 从当前 `M.db.items` 重取；表单保存前按 id 重取。
- P3：「已用天数」按 UTC 零点起算（UTC+8 早 8 点才跳一天）；年份筛选值可悬空（外部数据变化后列表空但 UI 显示「全部年份」）；头注释与拍板口径矛盾（统一到今天）；合法空对象 `{}` 被当损坏每次打开都弹警告。

### 已核验无问题（要点）

- uiResizable（ADR-0084）：钳制逐帧取值、hitRegion 排除左上缘、detach 清全部 5 处监听、移动端双保险，实现与 ADR 相符。
- favorites：置顶稳定拼接、归档冷存、删除撤销幂等、AI 整理不覆盖手填；belongings：四态兜底、年降序分组、自写短路防 modify 双渲、主题 observer 关闭时 disconnect、转卖不落码符合拍板。
- memo/todo：todo 数据层与 memo 逐字段等价；T1/T2 修复到位；smartcat 事件照发。

---

# 六、复习番茄启动器组（review / pomodoro / launcher）

## 1. review（复习计划）

**小结**：冲刺会话答题时序经测试钉定无回归；真正的漏网在「个人拟合链路从数据源头就断了」「R 阈值提前逾期与 markReview 未到期守卫互相矛盾」「统计时间线 R 值放大 100 倍」三个调度/展示硬伤，以及冲刺会话生命周期无互斥。

- **`app.ts:202` + `fit.ts:109` · P1 · 个人拟合（ADR-0077）整条链路永不生效（静默）**：markReview 写 history 从不写 `difficulty`，buildFitSamples 要求上一条有 difficulty 否则 continue → 样本恒 0 → 拟合恒 null，「参数自动拟合」开关永远不会出现。测试用手写带 difficulty 的数据才通过，掩盖了生产链路断裂。修复方向：history push 增加 difficulty；或缺失时回退条目级值。
- **`app.ts:134-140` 与 `372-386` · P1 · R 阈值「提前逾期」条目做完题无法写排期，答错也不挂待重做**：dueItems 按 R 阈值把未到期条目纳入「开始本轮」，但 markReview 开头 `if (now < nextReview) return` 把这些条目的评级整体拒掉——通过不刷新排期、答错不置 pendingRedo，冲刺中途还弹「还未到复习时间」提示。修复方向：markReview 增加与 dueItems 同口径的放行条件。
- **`stats-ui.ts:322` · P1 · 复习历史时间线 R 值被放大 100 倍**：app.ts 已把 R 按 0-100 落盘，渲染又 ×100 → 显示「R=8500%」。
- P2：三区队列「今天到期」列是死区（isPlayable 与 isOverdue 只差毫秒级相等，中列恒空，三区设计名存实亡；待验证 rp1x 口径）；SprintSession 无互斥无接管（startSprint 直接覆盖旧会话不 destroy，可产生孤儿会话：僵尸 ESC 层 + 旧题面覆盖队列视图 + 双击并发两个会话双倍 AI 调用）；新数据「满血 FSRS」分支不可达（stage 9 条目永远按阶梯表 120 天循环并反复重置 S/D，待验证是否拍板语义）；拟合重算在评级路径上同步跑，大历史时卡 UI（待验证量级）。
- P3：redo 通过的结果卡排期回退快照旧值；ensureReview 的 2s setTimeout 未在卸载时取消；reviewLoop 的 1s 轮询不受卸载管理（插件禁用后最长 5 分钟内继续读盘翻篇弹通知）；底部「累计复习 N 次」实为去重同日天数；难度弹窗 document handler 不注销 + unregister 无配对 register；运行时字段随每次保存落盘（数据卫生）。

## 2. pomodoro（番茄钟）

**小结**：状态机纯函数、endTime 制天然抗休眠漂移，暂停/冻结/恢复与卸载清理完备，无 P0-P2。

- P3：ensurePomodoro 与 openPomodoro 并发双跑 initData（幂等但浪费）；卸载时 in-flight 未完成 → buildDOM 在 unload 后执行（残留遮罩 DOM）；每次窗口恢复可见都无条件 save()（无变化也写盘）。

## 3. launcher（启动器）

**小结**：点击映射、推挤算法、双平台隔离、拖拽手势链路验证扎实，无 P0-P2。

- P3：异步 open() 与 close() 竞态可产生孤儿弹窗（仅插件禁用窗口期可触发）；拖拽放置行坐标无上界，可把磁贴丢到极远处挖出大空洞；拖拽中窗口 resize 会打断拖拽并错位。

### 已核验无问题（要点）

- review：q.cur 固化全路径覆盖无回归；onPassed 返回写盘后真实排期；懒批量取题无并发竞态；选项/卡片 div 化 + keydown；ESC 层级冲刺期拦截正确；挂起记录语义符合词条。
- pomodoro：endTime 戳制不漂移；interval 精确启停无多重计时器；recover「不补算」与 autopause 放行「继续」均落实；坏 JSON 改名留档重建。
- launcher：点击→ghost 提示→close→executeCommandById 带 try/catch；overlaps/pushMove/reflow 算法正确；长按→拖拽连续手势（ticket 157）完整。
