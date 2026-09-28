# issue 505：脸谱主界面改「相册簿」——探稿上岸（摊页翻页 / 照片膜 / 详情跨页 / 弹窗当册页）

- 关联：`docs/prototype-first.md`（单源口径）、ADR-0106（行为单源预览包）、issue 451（印章四态）、
  issue 455（双卷 → 其人 / 相交 / 纪事）、issue 497 · 502（进度块与进度便签）、issue 501（删除确认）
- 域：people（脸谱）
- 探索稿：`.scratch/people-album/`（本轮多轮评审定稿；上岸后原地留本地备查，不入 git；**以 src 为准**）

## 反馈（用户多轮评审收敛出的方向）

1. **主界面从「折子封面墙」换成一本自粘式相册簿**：皮革册壳 + 米色台纸页 + 中缝，一次摊开左右两页，
   每页三行、一行两人贴在同一张衬纸上（行底一行手写批注），整块罩一张透明塑料膜（膜比照片宽一圈、
   内缘是封边、外角翘一个尖），照片隔着膜看过去微微发白。
2. **没有外壳**：打开面板就是这册相册——没有标题栏、没有「脸谱」品牌行；总账挪到第一页页眉的小签里，
   生成进度做成册子左下沿的一张便签，冷读进度写在页眉里，空态就是右页的内容。
3. **翻摊是掀一张纸**：整册往那侧让一下，一张空白台纸以中缝为轴转 180° 掀过去（正面压旧页、背面盖新页），
   两侧露出一层层纸边（还能翻几次）；鼠标停在两侧空白只亮一下，**不再飘「还能翻 N 次」的字**。
4. **点照片 = 从膜下抽出来**：抬起 + 微转 + 放大，照片绕过中缝飞进对面那页的相框，对面绕中缝转进来；
   再点一下（或「合上这页」）合上。抽走时同一行的另一张与行底批注一起退半步。
5. **详情页 = 对面翻开的那一页**：头顶两栏（左边宝丽来那张 + 右边标签 / 账目 / 一张小签），
   下面动作与小签（画脸谱 / 记一笔 / 互动统计 / 补充背景 / 删除 / 合上）、三折签（其人 / 相交 / 纪事）+ 纸页。
6. **弹窗不再浮层**：互动统计 / 补充背景 / 记一笔 / 删除确认 / 画脸谱确认 / 数据源 / 找一找，
   全部是册子里翻出来的一页（页眉 + 能滚的正文 + 页脚）；靠人的页翻到原来那一侧，不靠人的页单页摊满整册。
7. **上锁时整册合着**：封皮 + 书脊带 + 搭扣 + 「解锁保险库」；取消照真实现发一条通知。
8. 进度便签：报队列（一人一任务顺序跑）、按状态给动作（重试失败项 / 删除任务）、画完自己撕下来。
9. 合并横幅：导入完「已并入 N 条素材」贴册子上沿（9 秒自己收），空手而归时弹素纸那档。
10. 数据源每行写清导入水位（全新 / 增量 / 补旧 / 已导出待入库 / 无新素材），页脚按勾选算总账。

## 改动

### 1. markup 单源 `src/people/render.ts`（纯层，`render-purity` 白名单内不新增 import）

新增（全部返回 HTMLElement，类名前缀 `bz-people-`）：
- 册子：`albumSpread(inner, left, right)`、`albumPage(no, total, rows, opts)`、`albumGutter()`、
  `albumRow(cells, note, era)`、`albumPhoto(p, i, opts)`（印章 / 新贴纸 / 到期签 / 标注 / 空位）、
  `headChip(text)`、`turnStrips(left, right)`、`slivers(n)`
- 封面：`lockCover()`；加载与空态：`albumLoadPage()`、`albumEmptyPage()`
- 便签与横幅：`jobsNote(...)`、`mergeBanner(text, calm)`
- 册页弹窗：`dsPage/dsRow`（改造现有）、`genPage`、`statsPage`、`profPage`、`notePage`、`delPage`、`findPage`
  —— 正文体沿用现有 `statsPopBody / profileView / profileEditor / miniMarkdown / foldPersonBody /
  foldBondBody / foldEventsBody`，只换外框与页眉页脚
- 保留并复用：`foldSeal*`（印章四态，改到照片角上）、`progressBlock`（改文案为便签口径）、
  `formatCount / avatarUri / localResourceUri / formatDay / formatReplySec / mediaLabel / spillOf`
- 删除：折子封面墙那套（`foldCard / foldWall / wallEmpty / foldBook / foldDetailHead / foldHint` 等）——
  确认无调用点后一次删除，不留死代码

### 2. 行为单源 `src/people/ui.ts`

- 新增册子状态：`cur`（当前摊）、`stage`（册页 / 详情）、`pulled`（抽出的那张）、`fold`、动画标志位
  （`animTurn/animBoot/animDev/animDrop/animFold`，一次性消费）
- 分页：`pagination()`（按「最近说过话」排完，每页 6 位、每摊 2 页）、`pageTotal()`、`lastCur()`、`slivers()`
- 翻摊：`turnTo(dir)`——量下当前页位置 → 挂一张 `position: fixed` 的台纸克隆（双面）→ 播 180° 掀纸动画 → 收掉
- 抽照片：`openPerson`（先 `.bz-people-shot-out` 过渡，再让照片绕过中缝飞进对面相框）+ `closePerson`
- 反光 / 微转：指针在册内移动时写 `--fx/--fy/--tnx`（**不动 DOM、不重画**）
- 键盘：← → 翻摊（有弹窗先合上）、Esc 合上脸谱 / 弹窗、照片上回车 = 抽出来；焦点走一圈不丢位置
- 事件委托：现有 34 个 `data-people-*` 钩子**原样保留语义**（改的是 markup 不是契约），
  新增 `data-people-turn`、`data-people-banner-close`、`data-people-lock-*`
- 保留：数据源状态机与同步、任务引擎接线、合并、删除三档、档案 / 随手记、互动数据、锁门、设置、移动端

### 3. 样式 `src/people/styles.css`

- 新增册子分节（台纸 / 皮壳 / 膜 / 照片 / 印章 / 批注 / 便签 / 横幅 / 封面 / 册页弹窗）；
  字号四档、圆角三档、角度三档沿用域内既有 token；hover 一律包 `@media (hover: hover)`；
  窄屏走 `@container`（沿用 `.bz-people-panel` 的匿名容器），**禁写滚动条规则**
- 删除封面墙 / 折页册那两节（约 400 行），不留死规则
- 暗色（`.theme-dark .bz-people-scope`）随新族补齐

### 4. 原型壳 `prototypes/people/`

- `prototype-icons.js` 补 `lock / unlock / gift / layers / search` 等新增 `data-lucide` 图标
- `fake-sim.ts`：种子与演示钩子跟上（分页数据、上锁态、进度便签各态）
- **补 `?selftest=1` 钩子**（people 是全域唯一缺的域）：挂载后写 `document.title` 自检结果
- 重出产物：`node scripts/build-preview.mjs people`

### 5. 测试 `tests/people/`

按新 markup 改锚（**保留行为语义，不删断言**）：
`render.test.ts`（印章四态 / 折签 / 认领 / 数据源行 / 页脚账）、`wall-pool.test.ts` → 册页口径、
`generate-ui.test.ts`、`describe-ui.test.ts`、`delete-person.test.ts`、`sync-button.test.ts`、
`load-progress.test.ts`、`profile-dims-ui.test.ts`；新增册页分页 / 翻摊 / 抽照片的 UI 测试。

## 验收

- 桌面 960×700 与移动 412×915 两端都走一遍：翻摊、抽照片、三折、弹窗当册页、空态、冷读、上锁封面、
  进度便签（跑 / 暂停 / 失败 / 中断 / 完成）、数据源勾选与导入（含「已导出 · 待入库」中间态）、合并横幅
- 门禁：`tsc --noEmit` + 全量 `pnpm test`（worktree 内按 docs/prototype-first.md 跳过 freshness，
  重出产物后在主仓库取权威结论）+ 壳自检
- 收尾：merge master → 提交 → 合并回主仓库 → 主仓库 `pnpm run build` 部署 → 清 worktree

## 进度（跨轮次记录，完成即勾）

- [x] 侦察 + 基线（tsc 绿；全量测试跑一遍取基线）
- [x] render.ts 相册 markup 新增（增量，不动现有调用）
- [x] styles.css 相册分节新增（增量）
- [x] ui.ts 切主界面（摊页 / 照片 / 翻摊 / 抽照片）
- [x] ui.ts 切详情跨页
- [x] 弹窗改册页（ds / gen / stats / prof / note / del / find）
- [x] 便签 / 横幅 / 封面 / 空态 / 加载
- [x] 原型壳图标 + selftest + 重出产物
- [x] 测试改锚 + 新测试
- [x] 门禁 → merge master → 提交 → 主仓库构建部署 → 清 worktree

### 上岸收尾（2026-09-28）

- 门禁：`tsc --noEmit` exit=0；`tests/people` 35 文件 / 575 例绿；全量 554 文件 / 8349 例绿（含 `preview-freshness`）
- 顺手清掉 4 处 src 真 bug（均在 `ui.ts`，详见 `.scratch/people-album/HANDOFF.md` 第四节）：
  印的暂停点不可达 / 空折正文被顶掉 / 空册时弹窗画不出 / 同步期置灰选择器失配
- 9 个测试文件按新契约改锚，新增册页分页 / 翻摊 / 抽照片覆盖，未削弱既有断言
- **评审裁决：`deleteTierOf` 恢复 issue 500 口径**。探稿上岸时把它写简了（`p.digest || p.lastProcessedTs` 判真值 + 未完成任务压过已画谱），
  与 issue 500 第 24 行「空 digest 不算已画——不给用户上无谓的密码门」冲突，且让「已有完整脸谱 + 正在补画」这一态的删除
  从「重输主密码」降成「二次确认」——那份画像删了不可逆。已还原为「卷一卷二纪事任一有正文才算已画谱，已画谱压过未完成任务」，
  并把被吞掉的空壳 digest 断言、drawn×running 断言补回；删除钮的 hover 提示按新册页形态改锚成 `delPage` 的
  `.bz-people-del-line` / `.bz-people-del-note` 档位文案断言（新增 4 例）。
- 另清掉 2 处编辑残留（`ui.ts` 重复的 `/**` 与重复的「事件委托」分节线），修掉 1 处与断言打架的测试标题
