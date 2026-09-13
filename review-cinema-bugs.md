# 影院（cinema）域 bug 线审查报告

- 日期：2026-09-13
- 范围：issue 303 新代码（f0ac0bf4 抓取迁入 + 8df7aa58 字段扩展）+ 其余影院域（src/cinema/ 共 3358 行）+ 昨日旧条目复核。
- 门禁佐证：tsc --noEmit 无错；vitest 300 文件 4619 测试全过（现有测试未覆盖下列边界）。
- 处置记录：见文末。

## 一、issue 303 新代码（douban-fetcher.ts / douban-queue.ts / 设置）

| 编号 | file:line | 严重级 | 描述（现象+影响） | 修法 |
|---|---|---|---|---|
| C1 | `src/cinema/douban-fetcher.ts:149,326`；`docs/adr/0129` 修订段；`src/cinema/analysis.ts:148-153` | P1【待验证】 | **季集←episodes 语义疑似错位（集数当季数写）**。ADR-0129 Context 自述 ApiZero 返回的是「集数」，代码把 `episodes` 原样写入 `季集`（仅 is_tv 且缺失才写）；而 `季集` 的唯一消费端 analysis.ts「追剧深度」按第一个数字当**季数**统计（`seasonMatch` → `${s.seasons} 季`、平均 X 季；state.ts:44 注释口径「如『2季』」）。若 episodes 确为总集数，一部 24 集剧会写成 `季集: 24` → 追剧深度显示「24 季」，且修订记录写明「全库回填由会话一次性执行」，会把约 190 条缺失笔记批量污染成错误语义并落盘 | 验证：拿一部已知多季剧（如权力游戏）调 ApiZero 看 episodes 值是总集数还是季数。若为集数：写回前换算/标注（如 `季集: 第2季共24集` 或仅写季数），或改分析页解析口径 |
| C2 | `src/cinema/douban-fetcher.ts:318-320`（写入）；`src/cinema/analysis.ts:80`；`src/cinema/recommend.ts:39` | P2 | **ApiZero 主演/类型逗号分隔 vs 消费端按 `/` 切分，统计与画像失真**。测试夹具（取自实测）`actor: '吴京, 刘德华'` 原样写入 `主演: "吴京, 刘德华"`；而分析页 `splitAdd` 与口味画像 `topBy` 都按 `split('/')` 拆分 → ApiZero 来源的笔记主演全部糊成一枚 token（「主演 TOP10」每个条目变整串演员表，导演/类型多值同理），AI 荐片的主演/导演偏好信号同样失真。对比 rexxar 兜底链是 `join(' / ')` 与消费端正交 | 写入前归一化：`az.actor/az.genre/az.director` 把 `,`（含逗号+空格）替换为 ` / `；或在 analysis/recommend 双分隔符切分 |
| C3 | `src/cinema/douban-fetcher.ts:231-237,327` | P2 | **formatYamlValue 不处理换行，热门短评含 `\n` 会写破 frontmatter**。特殊字符类 `/[:"-#[\]{}|>'?]/` 与空格检测都不含 `\n`（node 实测：`"好片\n值得二刷"` 两条件均 false → 裸写）。落盘后 FM 内出现顶格裸行 → YAML 解析失败 → Obsidian frontmatter 整体失效 → parseMovieFile（data.ts:12）返回 null → **该影片从影院面板消失、属性面板清空**，且 rebuildItems 不再收录、sweep 也不再补抓（M.items 里没有它），黏性损坏。短评是本次新增的唯一自由文本字段，风险恰落在新增处（`| > : #` 均已覆盖，唯独漏换行） | formatYamlValue 增加换行处理：含 `\n`/`\r` 时剥换行（替换为空格）或强制双引号包裹（引号内换行 YAML 合法）；顺手覆盖 commentAuthor 一并处理 |
| C4 | `src/cinema/douban-fetcher.ts:240-247`（insertPosterEmbed） | P2 | **frontmatter 闭合 `---` 恰为文件末行（无尾换行）时，embed 被插到 frontmatter 之前**。正则 `/^(---\r?\n[\s\S]*?\r?\n---)\r?\n/` 要求闭合 `---` 后必须跟换行（node 实测：无尾换行 → NULL）→ 走 `embedLink + '\n' + content` 分支，`![[…]]` 落在文件首行、FM 退居其后 → Obsidian 不再解析 frontmatter → 影片从面板消失。且**自愈失效**：fieldValue 是行级多行匹配，仍能读到 `海报:`/`豆瓣链接:` → 下次抓取判「已齐全 skipped」，永不修复。主链测试夹具恰好就是无尾换行形态（douban-fetcher.test.ts:188），但断言只 `toContain`，故没拦住。触发面：手工建的最简笔记（正文空、结尾无换行）——修订记录里的全库回填会话会扫到这类存量笔记 | 写 embed 前若内容不以 `\n` 结尾先补 `\n`；或 insertPosterEmbed 匹配失败（无 FM/无尾换行）时区分处理。补一例断言首字符是 `---` 的回归测试（现夹具即可复现） |
| C5 | `src/cinema/douban-queue.ts:37,121-122,198,202` | P3 | **失败通知文案「重开面板会自动重试」不实**。会话去重集 `attempted` 仅在 `shutdownDoubanQueue`（插件卸载）清空；`closeOverlay`/重开面板只再跑 sweep → `enqueueDoubanFetch` 被 `attempted.has` 拦下返回 false，不会重试。旧文案「重启 Obsidian 后会自动重试」是准的，本次重写改文案却没改语义，属于把 G8 当年修过的「文案不实」类问题又引了回来 | 文案改回「重启 Obsidian（重载插件）后会自动重试」，或在 closeOverlay/sweep 时对失败条目清 `attempted` 让重开面板真的重试 |
| C6 | `src/cinema/douban-queue.ts:55-62`；`src/cinema/douban-fetcher.ts:72-77,285` | P3 | **网络错误/离线被误报为「豆瓣风控拦截」**。httpGet 对异常与非 2xx 统一返回 null → `searchLooksBlocked(null)` 恒 true → 整轮聚合成「豆瓣风控拦截…重开面板会自动重试」。断网时用户被引导去怀疑风控+重开面板（而 C5 决定了重开也没用），双重误导 | httpGet 区分「请求异常」与「非 2xx」（如抛出/返回错误标记），fetcher 将网络异常映射 `reason: 'network'` 而非 blocked |
| C7 | `src/cinema/douban-queue.ts:19,114,123` | P3 | **长队尾条目 loading 提前过期**。`pending` 在入队时刻打点（:123），`isFetching` 时限 = 单条超时 3min + 30s 余量；条目间隔 15s，第 15 条之后的排队条目还没开抓 spinner 就消失（卡片呈现「未在抓」），完成后才突然上卡。批量导入 15+ 部时可见（旧 spawn 版同样口径，属重写时保留的既有边界） | pending 打点移到条目真正开抓时（pump 内 runOne 前），或时限改为「入队时刻 + 队列长度×间隔 + 超时」 |
| C8 | `src/cinema/douban-fetcher.ts:267,325-327,342-346` | P3 | **守卫读的是抓取开始时的内容快照，写回用 vault.process 的新内容**。`上映日期/季集/热门短评` 的「缺失才填」判断、`hasPoster`/`posterRelative` 都取自 267 行读的旧 `content`；而搜索+海报下载+ApiZero+rexxar 全链最长可达 30~90s，期间用户手改（补填上映日期、贴海报路径、改导演）会在 :342 的 process 回调里被按旧快照决策出的 `fields` 原地覆盖 | 把「缺失才填」类守卫挪进 process 回调用 fresh `c` 复核（`updateFrontmatterFields` 支持传入守卫函数，或回调内二次 fieldValue） |
| C9 | `src/cinema/douban-fetcher.ts:317-322`（对照 325-327） | P3 | **六个 ApiZero 字段无条件覆盖已有值，与同次新增三字段的「缺失才填」口径自相矛盾**。`豆瓣评分/导演/主演/类型/制片国家/地区/片长` 只要 ApiZero 有值就覆写（沿袭 CLI pipeline 口径），而同文件新增的 `上映日期/季集/热门短评` 却是「不改已有值」。后果：海报文件被移动/清理的完整笔记（sweep 口径命中「缺海报」）重抓时，用户手工修正过的主演/导演会被 ApiZero 原值冲掉 | 六字段同样加 `!fieldValue(content, key)` 守卫（若「ApiZero 为准」是有意契约，至少在 ADR 明示并接受该覆盖） |
| C10 | `src/cinema/douban-queue.ts:37,121-126`；`src/cinema/ui.ts:439-450` | P3 | **删除影片后同会话内同名重建，永远不补抓**。删除走 `dequeueDoubanFetch`（出队+cancelled），但 `attempted` 保留该 path；同会话重新添加同名影片（同路径）时 `enqueueDoubanFetch` 被 `attempted.has` 拦截返回 false——新笔记无 loading、无抓取，豆瓣链接/海报整场缺失直到重载插件 | dequeue 时同步 `attempted.delete(path)`（cancelled 集已足够覆盖「在抓被删」的失败聚合豁免） |

### 已核验无问题（issue 303 新代码）

- **防重入/并发**：pump 串行（pumping 位）、enqueue 同会话幂等、G8 出队 splice+cancelled 两态（排队中 splice / 在抓 cancelled）均有测试覆盖（douban-queue.test.ts 两例删除场景）。
- **超时与中止**：内层 httpGet 15s / downloadBinary 30s Promise.race、外层单条 3min 硬超时、isFetching 时限兜底，三层齐备且有 fake-timers 测试；requestUrl `throw:false` 用法正确。
- **非法 JSON/错误态**：ApiZero code≠0/非 JSON/网络失败→null→rexxar 兜底；rexxar 非 JSON→下一类型；均有测试。风控页检测阈值（<8000B/无结构）与 9000B 空态页放行有测试。
- **frontmatter 写回**：已有字段原地更新、新字段插 tags 列表后、退役四字段不清、上映日期/季集已有值不覆盖（均有测试）；键匹配 `^key:` 带冒号锚定，无前缀误伤；`制片国家/地区` 等含 `/` 键经 RegExp 构造器无转义问题。
- **海报链**：已有海报不重下不重复 embed（有测试）、embed 去重按完整路径、文件名非法字符清洗+时间戳防撞；`adapter.mkdir` 递归语义有 encrypt 域先例背书（src/encrypt/data.ts:467）。
- **设置接入**：DEFAULT_SETTINGS 默认空串 + main.ts:212 `Object.assign({}, DEFAULT_SETTINGS, loaded)` 完成缺键迁移；`fetchDepsFromSettings` 每次抓取实时读设置（改 key 即刻生效）；text 行渲染/绑定/持久化走共享 renderer（settings-panel/renderer.ts:342，commit 落盘）。请求头合并顺序正确（Authorization/Cookie 覆盖 UA 底座）。
- **生命周期**：完成刷新双通道（立即+1.5s 延迟）均带 `M.currentOverlay` 守卫；`shutdownDoubanQueue` 卸载清全部队列态；write-gate 白名单同步登记两文件（tests/core/d3-write-gate.test.ts）。
- commentAuthor 已映射但未写回/未消费（ADR 未列该字段），属预留不报。

## 二、其余影院域

本轮未发现新缺陷（昨日报告已覆盖大部分面）。以下为复核确认的关键路径，均通读无恙。

### 已核验无问题（其余影院域）

- **数据层**（data.ts）：缺 frontmatter/无 tag/脏值容忍（评分 NaN 不炸、豆瓣链接非 http 置 null、新建后 metadataCache 未就绪保留内存条目防闪现）；analysis 周几桶 `(i+1)%7` 与 `weekdays[0]=周日` 的映射正确，treasure/disappoint 的 `{douban}` 形状与 cmpRow 消费一致（G9 相邻口径未再错）。
- **UI 层**（ui.ts/shared.ts/layouts）：卡片取数用 `data-cinema-key` 稳定键（file.path）非可变索引；`data-rec-add` 的索引只映射渲染后不变的 `M.aiResult`；重渲染写 `.j-view/.j-mview` 等挂点内层，弹窗宿主 ovHost 在 sec 直下不受影响；长按手势每次渲染重挂新节点、无监听堆积；ESC 走 escManager 层级 + stopImmediatePropagation 单关；refreshDeskList 部分刷新在空态/跨视图时正确回落 renderAll；closeOverlay 清 debounce/浮层/复位视图。
- **AI 荐片**：重入守卫 `if (M.aiRunning) return` 且 refine 期间保持 running（recommend.ts:224,246-251）；quickAddWant 建条→事件→入队→整刷顺序正确，建条失败走 notifySaveError 不入队。

## 三、旧条目复核（昨日 review-all-bugs.md）

| 编号 | file:line | 结论 | 证据 |
|---|---|---|---|
| G6 | src/cinema/index.ts:32 | **已修** | `M.folderPath = resolveCinemaFolderPath()` 移到 `initialized` 早退之前，每次 ensureCinema 重同步 |
| G7 | src/cinema/ui.ts:79,96-101 | **已修** | markStatus/saveEdit 均先存 `prev` 快照，落盘失败 `Object.assign(item, prev)` 回滚 + renderAll |
| G8 | src/cinema/ui.ts:448-450；douban-queue.ts:131-137,182-185 | **已修** | 删除成功即 dequeue（未开始 splice、在抓 cancelled），失败聚合豁免有测试；但相邻新边界见 C10 |
| G9 | src/cinema/analysis.ts:297 | **已修** | 想看清单现读 `it.doubanRating`，字段名正确 |
| AI 荐片重入（P2） | recommend.ts:224,250 | **已修** | 见上 |
| 随机抽一部（P3） | index.ts:105；ui.ts:311-313 | **已修** | 命令先回落 list 视图，面板已开先整刷再叠详情 |

## 处置记录

- 2026-09-13：首轮审查产出 C1-C10，待拍板。
- 2026-09-13：拍板「全部修复」，十项同批修毕（worktree/cinema-bugfix，单提交 a01996f0，合并 fd40cf25）：
  - **C1 证实后撤回**：ApiZero 官方接口描述「集数（剧集）」+ ADR Context 调研记录 + 豆瓣公开 API 语义三路一致，episodes 为总集数非季数；季集←episodes 扩展作废（ADR-0129 修订更正段），上映日期←year 与热门短评←short_comment 保留。注：未能实测 API（vault data.json 尚未配置 key），证据以三路文本一致定案。
  - C2 normalizeListValue 逗号归一 ` / `；C3 formatYamlValue 换行单行化；C4 insertPosterEmbed 兼容 FM 无尾换行（补 `\n` 后 embed 居 FM 后）；C5 文案改「重启 Obsidian（重载插件）后会自动重试」；C6 网络异常上抛、海报下载失败归 network/写盘归 write；C7 waitAhead 入队快照放宽未开抓条目时限、开抓刷新打点；C8 FmFieldSpec ifMissing 机制（缺失判断在 vault.process 回调基于 fresh 内容复核）；C9 六字段+编剧一律缺失才填（有意行为变更：已有值不再覆盖，评分更新需手工或删字段重抓）；C10 dequeue 清 attempted。
  - 门禁：tsc 通过；vitest 4619 → 4630 全过（新增 11 条回归）；cinema 原型行为包同步重出（freshness 27/27）。
  - 遗留提示：全库回填会话（ADR-0129 修订段）尚未执行且 vault 未配 key——回填时将按修复后口径（缺失才填、无季集字段）执行。
