# ADR-0268 外部工具只认本地包；断网时工具行不消失；引导判据按库分键

- 状态：采纳（推翻 ADR-0263 §2 的 PATH 回落）
- 日期：2026-10-28
- 相关：ADR-0263（外部工具分发）、ADR-0264（首次引导）、ADR-0265（分发硬化）、ADR-0267（自检屏返工）

## 背景

用**新仓库**（新 vault）打开插件时，用户撞上三件事：

1. **引导没弹**。那个库里 Node、工具包、文档一概没有，却直接进了主界面。
2. **工具状态说「用系统里已装的命令」**。这是 PATH 回落的口径——开发机上全局装过
   `bili-dl` / `bz-face`，于是插件显示「已就位」，而它自己一份包都没下过。
3. **断网时「外部工具」整组是空的**。三行全靠下载清单（`downloads/manifest.json`）驱动，
   清单拿不到 → 行集合为空 → 看起来像插件坏了，而不是「没网」。

三条根因互相独立：

- 引导判据的 localStorage 兜底用了**一把全局键**（`bz-setup-done`）。localStorage 是
  Obsidian 整个应用共用的（所有库同一 origin），于是「A 库走完引导」= 「B 库也算走完」。
- 运行时解析有两条路（本地包 / PATH），探测与启动都继承了这个二义性。
- 面板行集合是**纯清单驱动**：清单缺席 = 没有行。

## 决策

### 1. 外部工具只认插件目录里的包

`core/tool-runtime.ts` 删掉 PATH 回落，`via` 从 `'bundle' | 'path'` 收成 `'bundle' | 'none'`：

| 条件 | 结果 |
|---|---|
| 包在 + 有 Node | 绝对路径 + 参数数组（`shell:false`） |
| 没包 / 没 Node | `via:'none'`，**cmd 为空串** |

- `toolReadyState` 与 `resolveToolBase` 共用同一判据（探测面与启动面不再可能分歧）。
- `TOOL_ENTRIES.command`（`bili-dl` / `bz-face` / `bz-dock-watch` 三个裸命令名）删除。
- `core/external-tool.runExternalTool` 在 spawn 前拦空命令，报「去在线资源下载」。
  必须拦：Windows 下 `shell:true` 配空命令会起一个空 cmd、退出码 0 —— 看起来「跑完了」。
- `knowledge/processor` 同样在 spawn 前拦（它不走 external-tool），失败原因直接是安装指引。
- `people/prep.ts` 与 `people/recording.ts` 里两处写死的 `'bz-face'` 收回 `safeToolBase`。

**为什么不留「全局装了也能用」这条后路**：同一台机器上可能有开发期的旧版或自建版，插件
以为自己带着工具、实际跑的是别处那个；状态面也只能说「用系统里已装的命令」，用户看不出
插件到底下没下过。宁可统一成「没下就是没下，去下一份」（26–177KB，引导里一键）。

### 2. 清单拿不到时，外部工具行按磁盘事实照样出

`settings-panel/online-resources.computeRowStates` 在 `cachedManifest()` 为 null 时不再返回
空行集，而是按 `TOOL_IDS` 出三行本地兜底行（id 仍是 `tool-<id>`，归「外部工具」组）：

- 状态取 `toolReadyState`（只看磁盘），描述说「已下载，暂时无法检查更新」/「联网后可下载」；
- 按钮**恒禁用**——没有清单就没有下载地址与 sha256，可点等于骗人；
- 「检查更新」行照旧出现（`retryVisible = !hasManifest`），用户能自己重试。

工具是本机已经装好的东西，它的可见性不该取决于能不能连外网。

### 3. 引导判据按库分键

`setupDoneStorageKey(vault)` = `bz-setup-done:<vaultKeyOf(vault)>`（FNV-1a 8 位，与值守目录键同源）。
`setupAlreadyDone(settings, vault)` 与 `markDone(app)` 都走它。

- `data.json` 里的 `setupDone` 本来就是按库的，localStorage 兜底此前是唯一的跨库泄漏点；
- 旧全局键**不再读取**：老用户的库靠 `setupDone`，只有「data.json 写不进去的只读库」会
  重弹一次——那种库本来就该重弹。

## 影响

- `runtimeDiagnostics` 的值只剩「已下载 / 未安装」两种（自检屏与工具坞同一口径）。
- 本机全局装过工具的用户：升级后会看到「未安装」，去「外部工具」下一份即可（一次性）。
- 单测新增注入缝 `setToolBaseProbe`（纯函数 builder 在测试里没有 app，需要一条假命令）；
  生产不调用它。
- people / knowledge 的测试夹具统一注入「shell 口径的假工具」，因为参数引号口径仍要覆盖
  （`buildSyncSpec` 的 `opts.command` 是公开入口，仍可传 shell 口径）。

## 补记（2026-10-28）：探测本身也有两个 bug

同一次报障的另一半——用户说「网页能开 GitHub，引导却显示两条通道都不可达」。查下来网络
没问题（实测：走系统代理五条全 200；直连时 raw 被墙、jsDelivr 三个边缘域名 200），
问题在 `core/env-check.ts` 的 `timedFetch`：

1. **`await import('obsidian')` 在 Obsidian 里永远失败**。插件以 CJS 加载、渲染进程没有
   importmap，裸模块名的动态 import 解析不了（社区结论一致：Obsidian 的 Electron 环境
   无法把 `import('obsidian')` 扩展成可用形式）。那行 `await` 每次都进 catch，于是**无论
   网络多好，两条通道一律判成不可达**。全仓只有这一处这么写，其余（`remote-asset` /
   `self-update` / `douban-queue`）都是静态 import —— 改成静态 import 即可。
2. **`throw: true` 把 404 也算成断网**。探的是「通道通不通」，不是「`version.json` 在不在」。
   改 `throw: false` + 看状态码：有 HTTP 响应就是通。

顺带把「不可达」三个字拆开：`NetworkProbe` 增 `githubError` / `jsdelivrError`，
`explainNetError` 把原文折成「域名解析失败 / 超时 / 连接被重置（常见于被墙）/ 证书校验失败
（代理做了解密？）/ 代理要求认证 / 本机没有网络」，界面值列与底部说明都带原因。
只说「不可达」时，能开 GitHub 的人根本无从判断是墙、是代理还是 DNS ——
而 `github.com` 与 `raw.githubusercontent.com` 本来就是两回事。

测试钉住五条：主通道通、主被墙备通、只有慢入口通、全不通、404 也算通，外加一条读源码
断言「不许再出现动态 import 裸模块」。

## 补记二（2026-10-28）：清单拉不到 —— 串行卡死 + 备用通道事实上已死

修完探测后，引导页变成了「这台机器什么都不缺」+「资源清单没拉到」两句并存。两件事：

1. **`fetchAssetText` 是串行 `await requestUrl`，没有单通道超时**。raw 一旦卡住（被墙的
   典型形态是 TCP 连上但不回），要等 Chromium 自己的十几秒，而调用方
   `fetchManifestWithTimeout` 只等 12 s —— 一条通道卡住，后面几条根本没被试到。
   改法：单通道 8 s 封顶；清单这类 KB 级文件**并发**试（谁先通过校验用谁）；
   成功过的通道在会话内记下来排到队首（`preferredBase`）。
2. **jsDelivr 对本仓库已经停发**。实测 403 正文：
   `Package size exceeded the configured limit of 50 MB` —— 仓库 `.git` pack 284 MB，
   超了它的 50 MB 上限。**只有早年被它缓存过的文件还能出**（`version.json`、
   `belongings-categories.json` 仍 200），没缓存的一律 403。这就是「探测说备用通道可达、
   拉清单却失败」的来源：探测撞的是缓存，拉的是没缓存的。
   现在 403 正文会被识别成「通道拒绝分发（仓库超过 50 MB）」而不是「网络不通」；
   探测判据也从 `status > 0` 收成「拿到 2xx/3xx」——403 有状态码，但通道用不了。

**未解决**：`downloads/` 与插件自更新的真正备份通道。jsDelivr 已不可依赖，剩下的
`raw.githubusercontent.com` 在国内无代理时不通。根治要么瘦仓库（重写历史，tag 全废），
要么把 `downloads/` 拆到独立小仓库再让 jsDelivr 服务它 —— 都需要拍板，尚未动手。

## 补记三（2026-10-28 晚）：清单「没拉到」的真因是写不进磁盘

用户换新库后仍报「资源清单没拉到」。前两轮查网络（探测自证不可达、串行卡死、jsDelivr 停发）
都是真问题，但都不是这一现象的原因。真正的原因在本地：

```
writeAssetText(app, 'manifest.json', text)
  → ensureDir(app, 'manifest.json')      // 没有斜杠
  → const slash = relPath.lastIndexOf('/'); if (slash <= 0) return;   // 直接 return
  → adapter.write('<plugin>/downloads/manifest.json')                 // ENOENT，父目录不存在
  → refreshManifest 抛错 → 引导页 .catch(() => null) → 「清单没拉到」
```

`ensureDir` 的循环只在「路径含子目录」时进得去，而「父目录」对单文件资产来说就是
`downloads/` 本身 —— 之前没有任何一处创建它。老库里 `downloads/` 是早先版本留下的，
所以一直是绿的；**全新库第一次运行，永远拿不到清单**。同一处缺陷还会连带皮肤包
（`skins/<域>/<id>.css`：建 `downloads/skins` 时父目录不存在，逐级 try/catch 全吞掉）。

修法：`ensureDir` 第一件事先建 `downloads/` 根（幂等，已存在抛错也无所谓），再逐级建子目录。

两处配套：

- **测试换真文件系统**。`MockVault.adapter.write` 往 Map 里塞、从不校验父目录，所以既有
  测试对这一类缺陷是盲的。新增 `tests/core/downloads-dir.test.ts`：临时目录 + 非递归
  `mkdir` + `fs.writeFile`，复刻 Obsidian 的 FileSystemAdapter 语义。验证过它确实抓得住
  原缺陷（去掉修复后三条用例齐齐 ENOENT）。
- **别再把原因吞掉**。`fetchManifestWithTimeout` 从「失败返 null」改成「返 null + 原因」，
  引导页把原因附在提示句后（`（原因：…）`）。这条链上原来每个 catch 都是 `() => null`，
  三次隔着屏幕猜网络，代价就是这一轮。真出问题时，原文能立刻分清是墙、是代理、还是磁盘。

## 补记四（2026-10-28 夜）：手改 setupDone=false 不生效 + 引导弹窗的宽度与切边

**一、复位手段被自己的兜底盖住了。** 用户手改 `"setupDone": false` 重载，引导仍不弹。
判据是「设置 false → 再问 localStorage 兜底」，而他之前关过引导，`markDone` 早把兜底键
写成 `1` 了 —— 兜底本来只该服务「设置写不进去的只读库」，却反过来否决了唯一的人工复位手段。

现在把 `data.json 里到底有没有这个键` 作为第三个参数（`main.ts` 从 `loadData()` 的原始对象
判断）：有键 = 设置能写 = 设置是唯一事实源（`false` 就是没走过）；没键 = 只读库/首次，
才轮到兜底键。老库不受影响（它们的 data.json 早就有 `setupDone: true`）。

**二、弹窗宽度从来没到过 760。** `uiModal` 的 `maxWidth: 760` 只是**上限**，弹窗宽度由内容
撑 —— 实测 514px，所以用户上次说的「太窄」根本没被解决，只是上限变了。现在 `.bz-setup-modal`
给死 `width: min(760px, calc(100vw - 32px))`。

**三、九行清单在 82vh 处被齐切一行**（截图里「主题皮肤」的说明整行没了一半），而且 Windows 的
悬浮滚动条不滚就不出现 —— 看起来就是「坏了」。高度预算提到 `calc(100vh - 32px)`（遮罩内距
就是 32），行内距 9→8、分组标题收紧，常见窗口下整份装得下；真装不下时只滚内容区、底栏常驻。

对应的选择器作用域全在 `.bz-setup-modal` 下，别的弹窗一个字不动。

## 补记五（2026-10-29）：删掉 data.json 后第一次启动不弹引导

用户报「首次打开没有引导页，第二次打开才有」。根因还是兜底键，只是换了个方向：

旧版 `markDone` **无条件**往 localStorage 写裸 `'1'`，注释写着「只读库靠它」，实现却是全量写。
于是用户删掉 `data.json`（想在测试库里把引导重走一遍）之后：

1. 第一次启动：`data.json` 不存在 → 判据落到兜底键 → 那把从没清过的 `'1'` 说「走过」→ 跳过；
2. 而这一次启动本身会把 `data.json` 写出来（`bootstrapStorageDir` 落 storagePath 时 `saveSettings`）；
3. 第二次启动：文件存在 → 走「设置是唯一事实源」分支 → `setupDone: false` → 弹。

两处一起改：

- `markDone` 只在 `saveSettings()` **抛错**时才写兜底键，且写成 `{"at":<时间戳>}`；
- `setupAlreadyDone` 只认新格式，读到裸 `'1'` 当作没记过并 `removeItem` 清掉；
- 第三个参数（`main.ts` 的 `setupDoneSaved`）从「data.json 里有没有 `setupDone` 键」改成
  「**data.json 存不存在**」：文件存在 = 设置能写，里面写没写那个键都一样只信设置。

代价：只读库（`data.json` 始终写不出）在升级后的第一次启动会多弹一次引导。它本来就写不了
插件目录，这个弹窗也走不到终点——一次性的，可接受。

## 补记六（2026-10-29）：引导要当第一屏，且不能被点遮罩关掉

用户提的三件事，其实是同一条：引导没走完之前，这个库还没有任何界面是「它的」。

**一、先引导，别先开别的页面。** 原先引导在布局就绪后**延迟 3 秒**弹（怕启动瞬间抢焦点），
这 3 秒里启动流程里的其他自动动作照跑——备忘录的「启动自动弹出」就是其中一个，于是用户先
看到备忘录面板、再被引导盖住，顺序反了。现在：

- 判据搬到 `core/setup-state.ts`（`setupAlreadyDone` / `setupDoneStorageKey`），main.ts 可以
  **同步**问出「这次要不要弹」。留在 `setup-wizard.ts` 里的话只能 `await import()` 才知道答案，
  那一等，后面的 `ensure*` 全被推后一拍，「先弹引导」也就不成立；
- 引导改为布局就绪即弹，不再等 3 秒；
- 要弹引导的这一拍，`ensureMemoReminders(app, { skipStartPopup: true })`：只跳过「启动自动弹出」，
  「打开笔记提醒」的事件监听照挂——引导背后不该先蹦出一个面板。

**二、点遮罩关不掉。** `uiModal` 加 `closable?: boolean`（缺省 true）。`closable: false` 时遮罩点击
与 ESC 都不挂，只能由代码 `close()`。只有首次引导传 false：它是这次启动唯一的界面，点空白就
关掉等于静默中断，用户看到的是「插件打不开」。要走开只能用按钮——「稍后再说」/「以后再说」/
「收起来，后台继续」。环境自检（同一视图的 `checkOnly` 模式）照旧可关。

**三、结束后开首页。** `openSetupWizard` 收 `onFinish`，在用户真正结束引导的三条路径上触发
（「开始使用」「以后再说」「稍后再说」），main.ts 里就是 `openHome`。「收起来，后台继续」不触发
——那是把弹窗收走让下载在后台跑，不是结束。

顺带把 `closeModal` 从「直接 remove 遮罩」改成走 `uiModal` 返回的 `close()`：此前每次引导都会在
存活登记表里留一个永不注销的 close 句柄，ESC 层的注销也一起漏了。

## 补记七（2026-10-31）：遮罩改成「先确认再关」，完成屏给一条教程入口

**一、补记六的「点遮罩关不掉」作废。** 那条的本意是「别让人误关」，做法却是「整段不挂」——
点空白毫无反应，用户以为插件卡住了；想关的人也只能靠找按钮。现在改成**拦一道**：

- `uiModal` 的 `closable` 不再传 `false`，改走 `requestClose`（issue 365 第 5 项早就有的口子）：
  首次引导点遮罩 / 按 ESC 先弹一次确认，确认才关；环境自检（`checkOnly` 模式）照旧直接关；
- 确认文案必须回答「关掉之后去哪」——「设置 → 关于 → 环境自检」。引导结束会 `markDone`，
  这次启动不再自动弹，不说去处等于把人关在门外；
- 「关掉」标 `danger`，焦点落「继续准备」：ESC / Enter 不该替他做这个决定。

**二、完成屏加「看使用教程 →」。** 东西装齐了，下一步是「怎么用」，把入口摆在这一屏，
不必先摸到设置面板再找回来。地址复用 `core/about-group` 的 `VIDEO_URL`（关于组「使用教程」
同一常量，改地址只改一处），点了开浏览器、引导不关。

**三、发布侧补一次 CDN 清缓存。** 本轮报障的另一半是「工具改名了，引导页还显示旧名字、
下载全红」：源码与清单都已是新名字，客户端拿到的是 jsDelivr `@master` 的旧副本——清单里的
sha256 与已发布的产物不是同一版，每一项下载都校验失败。`scripts/push-assets.mjs` 推送后
按本次变更逐个 `purge.jsdelivr.net`，再核对一次边缘清单是否已与本地一致。

## 补记八（2026-10-31）：下载屏不再给「收起来」，教程跳到具体 P，弹窗穿引导页的皮

**一、⑤ 安装屏删掉「收起来，后台继续」。** 它把弹窗收走、下载留后台跑，用户既看不到进度
也等不到 ⑥ 完成屏——回来只发现东西装上了，首次引导等于半途而废。现在下载屏只有一个出口：
跑完自动进 ⑥；没装齐的项在完成屏列出来，去「在线资源」重试。中途仍可点遮罩/ESC，走补记七
那道确认（说清关掉去哪重开），只是不再有一个「看起来像安全选项」的主按钮。

**二、完成屏的教程链接落到第 3 P。** `VIDEO_URL` 改成 `…/BV1vNsZ6pE7i/?p=3`——这是多 P 视频，
少了 `?p=3` 点进去停在目录页第 1 集，用户还得自己找。分享链接里的 `vd_source` /
`spm_id_from` 是追踪参数，不进常量。点链接先弹一次确认（同一套 `bz-setup-flow` 皮），
确认才开浏览器：这是离开插件去外部，不该点一下就跳。

**三、弹窗皮肤类 `bz-setup-flow`。** 补记七那道关闭确认裸用 `openFlowDialog`，结果是
400px 窄卡 + 居中正文 + 灰底胶囊按钮——摆在 720px 宽的引导页里像另一个插件弹出来的
（用户截图指出）。现在 `openFlowDialog` 传 `className: 'bz-setup-flow'`，皮肤规则写在
`src/core/ui/components.css`：卡宽 460、正文左对齐、按钮按文字定宽并排居右，左键是
`.bz-setup-btn` 的透明描边形制，右键在 danger 态只染红字、正常态保持品牌实底。
选择器必须带 `#__shared_confirm_popup__` 前缀——壳的 `align-items/text-align:center` 挂在 id 上，
两个类压不住。这条同时升格为 `AGENTS.md` 的硬约束：**新增弹窗必须穿本域的皮**。

## 补记九（2026-10-31）：清单请求带一次性破缓存参数

补记七第三条（发布后 purge）只解决了一半：**jsDelivr 的 `@master` 缓存是逐 POP 的**，
`purge` 清掉的是回源时打到的那台边缘，用户机器可能落在另一台仍拿旧副本的边缘上。症状是
「工具改名好几天了，引导页还是旧名字、每一项下载都校验失败」，而且**再启动几次也不会自愈**：
每次刷新命中同一个旧边缘，还把旧清单写回本地缓存。

`FetchAssetOpts.bust` 给 URL 追加 `?t=<时间戳>`（同一轮多条通道共用一个值），换个缓存键强制回源。
只给清单开（9 KB，回源代价可忽略）；正文体积大、本来也难命中。测试里的 URL 桩改成
「先精确匹配、再去掉 query 兜底」，用例表仍写干净 URL。
