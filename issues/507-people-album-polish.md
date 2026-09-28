# issue 507：册子收尾批——八处交互与动效（展开 / 回顶 / 占位页 / 动效接回 / 不可勾 / 导入收尾 / 单队列可见 / 滚轮翻页）

- 关联：issue 505（脸谱主界面改册子，本轮的母任务）、issue 483 / 485 / 486 / 492 / 497 / 500 / 501 / 502 / 506、
  ADR-0194（脸谱与保险库共锁同库）、ADR-0196 决策 10（同步期动作置灰那条老规矩）、ADR-0104（markup 单源）
- 域：people（脸谱）／另动 core 一处**加法**（`src/core/gesture.ts` 新增滚轮翻页手势）
- 反馈来源：用户看完 505 / 506 上岸后的真机反馈（原话编号 1 / 2 / 3 / 5 / 6 / 7 / 8 / 9，未提 4）

> 原话：1 另有 n条的几处，点击可以展开 / 2 详情页，往下翻，会把其人，相交和纪事贴在上面，点击切换回从头开始读 /
> 3 如果联系人不足一页，右边的页面也会显示占位 / 5 大部分动效都不生效了，请审查并修复 /
> 6 数据源页，如果是已导入并且无新素材，不可选中 / 7 点击导入所选后，关闭数据源页面，再次打开把已导入无素材的放到页面下面，
> 并取消选中状态 / 8 如果有画谱的进度中，点击其他联系人详情页的画谱，不会打开页面没反应（逻辑就是同时只能一个联系人画谱吗？）
> 同时发现删掉一个联系人时也如此 / 9 桌面端支持鼠标滚轮翻页

## 一、动效审计（item 5）：505 之后死了四支，两支活得好好的

四支全是同一类病因——**标志还在、渲染层没人挂类**（CSS 一条没丢，白候两轮）：

| 动效 | CSS | 病灶 |
|---|---|---|
| 折页切换 fold | `.bz-people-fsheet-body.bz-people-in` | `animFold` 置了位，`detailPage` 建正文时从不挂 `bz-people-in` |
| 导入完飞回 drop | `.bz-people-cell.bz-people-drop` | `animDrop` 置了位，`albumPhoto` 的 cell 类名里没有它 |
| 刚画完显影 develop | `.bz-people-cell.bz-people-dev` | `animDev` **从头到尾没人置真**，类名也没人挂 |
| 便签落下 note | `.bz-people-jobs.bz-people-note-in` | `animNote` **没人置真**（`renderNote` 里那个 `if` 恒为假） |

**改法**：标志的置位收在 ui.ts（唯一入口口径），挂类收在 render.ts（markup 单源），中间靠渲染入参传：

- `DetailOpts.foldIn?: boolean` → `.bz-people-fsheet-body` 追加 ` bz-people-in`。
- `AlbumCellOpts { drop?: string[]; dev?: string }`（`albumPage` 第五个可选参 → `albumRow` → `albumPhoto`）。
  **`drop` 是 id 名单而不是「带新角标的那几张」**：导入成功那一刻 `newCount` 已清零（水位要从「增量」落到
  「无新素材」），再认 `fresh > 0` 会一个格子都挂不上。名单用 `dsLastImported`（本趟导入并进来的那几位）。
- `animDev = talker` 写在 `persistJobDone` 里（落库成功、重画之前那一行）。
- `animNote` 在 `applySnapshot` 里按「队列从空到有」置位；且 `renderNote` **用掉即清**——
  便签每帧都重建，不清就会变成一秒落一次。
- `animDetail` 是死标志（详情页 `.bz-people-sit-l/r` 那支动效本来就不设闸、每次都放），本轮**不动**，
  留着待后续票一并处置。

## 二、八条逐条

### 1. 「另有 N 条」点一下摊开

六处列表原来只有三处写了灰字尾注（不可点：性格特质 / 留下的片刻 / 同月纪事），另三处**静默截断**
（代表原话 8 条、最近在聊什么 10 条、未竟之事 8 条）——用户根本不知道后面还有数据，而数据全在 `p.digest` 里。
新增 `render.clipList(cls, items, first, moreText)`：**先全画**，超出的挂 `.bz-people-more-hide`，
末尾一枚 `[data-people-more]` 小签；ui 侧点一下把 hide 摘掉、按钮自己退场。
可见条数与文案与原来逐字一致（12 / 8 / 10 / 6 / 8 / 14），变的是「后面还有的都点得开」。
退役 `.bz-people-trait-more` / `.bz-people-mut` 两枚死样式。

### 2. 换折回到第一行

折签贴在上沿，往下读远了当然要找它回来。原来「切折保留滚动位置」是有意的，导致换折后直接落进正文中间。
新增 `foldScrollTop` 一次性标志：换折 → 这次重画不还原 `[data-people-scroll="detail"]` 的滚动位置（置 0）；
**同一折再点一下 = 回到这一折的开头**（不再早退，直接 `scrollTop = 0`）。

### 3. 不足一页也要有后半摊

`albumBody` 的摊开循环原来 `if (!pages[idx]) break`——册上只有一位时右页整页消失，册子只剩半本。
改成缺页补 `albumBlankPage()`（6 个空位 + 一张纸），**关键：这一页不报页码**，
否则 1 页联系人会看到「第 2 / 1 页」这种伪编号。

### 6 / 7. 数据源：不可勾的那一档 + 导入完的收尾

- `dsWaterOf` 早就给「已导入 + 无新素材」返回 `k:'skip'`，但 `dsRow` 只给群聊挂了 `bz-people-ds-off`，
  所以 skip 行看着还能勾——**勾了再导一遍等于白导**。现在 `dsRow` 追加 `bz-people-ds-skip`，
  ui 侧点击守卫扩到 `off || skip` 两档。样式与群聊同一档（`.55` 透明度 + `cursor:default`）。
- **排序挪到渲染前**（`dsRowStates` 里落）：水位依赖 `recordCache`，而「已导入」这件事要到
  导入写库之后才成立；扫描那一刻排的序必然过期。现在 rank = 有新的(0) → 其余(1) → 无新素材(2)，
  同档按 newCount 降序、再按名字。拍板 Q4 的「有更新排最前」原样保留。
- **导入完成即合上这一页**（用户拍板）：这一条正好接回 505 原本设计的 `dsImported → animDrop`
  「新照片飞回册页」那条路（原来只在用户**手动**合页时才触发）。
- 导入成功后把这一趟的人从 `dsSelected` 摘掉（水位已落到「无新素材」）；为不丢「导入完接着批量画谱」这条路，
  页脚那枚「画脸谱」在勾选为空时改按 `dsLastImported`（本趟导进来的几位）走。
  **issue 492 的回归口径照旧成立**：导入后点「画脸谱」引擎拿到的仍是导入后的非空聊天仓，只是中间多一步「重开这一页」。

### 8. 画谱进行中：同时只画一位（是既定行为），但不再「点了没反应」

先回答用户的问句：**是**，同时只画一位——引擎队列是单跑的（`startJobs` 对同一个人天然去重，
新任务以 `paused` 进场排队），ui 层 `jobsBusy()` 拦住第二个入队。这条限制本轮**不改**（要改成「排队多位」
是产品决定，不顺手做）。缺的是**看得见**：原来只弹一条一闪而过的通知，观感就是「点了没反应」。

所以照同步期那条老规矩（ADR-0196 决策 10）办——新增 `applyJobsLockdown()`：画谱进行中，
**别人**那页的「画脸谱」置灰并把理由写在按钮上（`等「陈默」画完`；队列只剩暂停 / 中断时换成
`先接上没画完的那位`）。自己那一位留着可点（继续生成 / 补画 / 重画都走这枚钮）。

**删除**不受任何任务影响（无 `jobsBusy` 守卫），真正的病灶是 `handleDelete` 把「翻删除页」挂在一次
`await store.list()` 后面——读库慢的那几秒观感就是「点了没反应」。改成**先翻页、后读库**：
册上摊着的那位直接从 `listCache` 取（同步路径），取不到才回落异步读。

### 9. 桌面端滚轮翻页

`core/gesture.ts` 新增 `bindWheelTurn(el, go, { gap, lock })`，与既有的触摸手势 `bindSwipeTurn` 同一口径
（累积到位即翻、一次只翻一幕，默认 60px 阈值 / 620ms 冷却），另加两条硬规则：

- 点里有**真能滚的块**（详情正文 / 数据源列表）且它还能朝这个方向滚 → 一律让给原生，滚到边了才轮到翻摊；
- 换向立即归零（来回蹭不误翻）。

绑定挂在 `overlay` 上（册页每次重画都换节点，挂册页会被一起换掉），面板关时解绑。
另外给 `flipSheet` 补了 `prefers-reduced-motion` 早退（与 `runFly` 同一口径：翻摊照翻，只是不掀那张飞纸）。

## 三、测试

- 新增 `tests/people/album-507.test.ts`（10 例）：六处列表可摊开、换折 / 同折回顶、不足一页补占位页、
  正好两页不补、画谱中别人置灰（自己仍可点）、任务在跑也能翻出删除页、便签只落一次、滚轮翻摊（阈值 / 到位）。
- `tests/people/render.test.ts`：补 `AlbumCellOpts` 按 id 挂类（飞回 / 显影 / 不给名单一点不挂）、
  `albumBlankPage` 不报页码、`clipList` 超量与不超量两态。
- `tests/people/sync-button.test.ts`：492 回归口径改为「导入 → 自动合页 → 重开 → 画脸谱」；
  新增「导入完合页 + 勾选摘掉 + skip 沉底 + 不可再勾 + 别人仍可勾」；485 两例的落账断言改成重开后再看；
  补一条「合页那一下刚导进来的几位挂上 `bz-people-drop`」。
- 全量：36 文件 / 592 例（people 域）；全量门禁见下。

## 四、门禁与收尾

- [x] `npx tsc --noEmit` exit=0
- [x] `npx vitest run` 全量绿（555 文件 / 8370 例）。
  首轮全量红一处：`tests/core/bd-paradigm-hover-isolation.test.ts` 揪出新增的 `.bz-people-more:hover`
  没包 `@media (hover: hover)`（呈报#9 F4 触屏粘滞范式）——改回包住，与同文件另 20 余条同一写法。
- [x] `node scripts/build-preview.mjs` 重出原型产物（`src/people/render.ts` / `ui.ts` / `styles.css` + `src/core/gesture.ts`，
  12 份 `prototype-behavior.js` + people 的 `prototype-render.js` 跟着重算）
- [x] 独立子代理 review（只读）：**八条全落实，无阻断项**
- [x] 提交 → merge 回主仓 → `_gen-changelog.mjs` + `build-manifest.mjs` → 主仓 `pnpm run build` 部署 → 清 worktree

**满载下的门禁**：机器当时明显吃紧（同一条全量跑 100s 变 431s），复跑出现过 4 例红，逐条查过都不是本次引入：
3 例是 `tests/pomodoro` 的计时用例 20s 超时（隔离重跑 13 文件 / 239 例全绿，同 506 那次的先例）；
1 例是 `tests/people/generate-ui.test.ts` 的假红——「补充背景」保存后那条断言把 `waitFor` 架在**落盘**上（第 768 行），
紧接着就断言**界面**已回查看态，而保存后的那次重画是异步的，满载下必然抢跑。已把该断言也放进 `waitFor`
（**不是放宽**：真回不到查看态照样会等超时红）。随后用 `--testTimeout=60000` 复跑全量取最终结论。

## 五、review 跟进（独立审查提了三条，两条动手、一条留待拍板）

**① `scrollHostOf` 的 svg 落点（真 bug，已修）**：起跳写死了 `node instanceof HTMLElement ? node : null`，
而滚轮常压在 `<svg>` 上（lucide 图标 / 印环 / 图标化的字）——SVGElement 不是 HTMLElement，判定当场落空，
本该让给原生滚动的块（详情正文 / 数据源列表）被误判成「点里没有可滚块」而把摊翻过去。
改成：碰到非 HTMLElement **只跳过它、继续往上走**（svg 的 `parentElement` 就是那个块）。
新增 `tests/core/gesture-wheel.test.ts`（4 例）钉死：压在 svg 上还能滚 → 不拦默认不翻摊；块到底 → 让出来翻；
起点是普通元素时口径一致；点里根本没有可滚块 → 照旧翻。

**② 「六处列表」测试只实测了三处（已补）**：性格特质 / 代表原话 / 留下的片刻有断言，
最近在聊什么 / 未竟之事 / 同月纪事只是共用 `clipList`、没实测。现补成一测走全六处
（12 / 8 / 10 / 6 / 8 / 14 的可见条数逐处钉死，点完逐处验「收着的清零 + 签退场」），
另加两例反向断言：没超量不画签、数据不够格一点不挂。
顺带给「未竟之事」那处列表补上专有类名 `bz-people-thr`，与另两处同形列表（`bz-people-ints` / `bz-people-moms`）一致
——原先是裸 `bz-people-md`，和 markdown 根节点撞名、锚不定（**样式零变化**）。

**③ 导入者落在当前摊之外时「飞回」不播（留待拍板，未动）**：`animDrop` 在 `renderAlbum` 里一次性消费，
而册子只渲染当前摊两页；导入的人若排在别的摊（新导入按「最近互动」排最前，所以是「你当时不在册首」那种情形），
这一趟的飞回就看不见。三种改法各有取向 —— ①导入后自动跳回含新人的那摊（一定看得见，但会挪走用户当前的位置）；
②名单留到真挂上那摊才清（不挪位置，但翻到那摊时照片才飞，有人会觉得是「迟到的乱飞」）；③维持现状。
reviewer 明说这取决于产品对动效覆盖范围的要求，故**不擅自决定**。

## 备注：本轮刻意没动的

- `animDetail` 死标志（详情页翻开动效 `.bz-people-sit-l/r` 不设闸，本来就每次都放）。
- 505 遗留的另几处：同步期便签「继续生成」未置灰、`sealAction('redraw')` 死码、
  `syncPhotoSeals` 原位换印不刷 meta、空册 + `startGeneration` 的确认页不可达。
- 单队列改「排队多位」：引擎支持（`startJobs` 是加法），但那是产品决定，等用户拍板。
