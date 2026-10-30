# bz —— 干活约定

Obsidian 插件。域 = `src/<域>/`，`core` 是共享层。中文输出。

## 跑什么
改一个域：`node scripts/test-domain.mjs <域>`（~10s）。跨域、说不清、或要下「通过」结论：`node scripts/test-affected.mjs`（~12s）——只跑受影响的测试 + 扫树守卫，**它的结论就是结论**；没变过的文件复用上次成功结果，通常几秒。

改到 core、依赖清单、测试配置、全局夹具时，选择器自己升格为全量，不用你判断。合回主干前跑 `node scripts/test-affected.mjs --since master`（覆盖整条分支）。手动强制全量才用 `--full`。

别用 `vitest --changed` / `related`：一批守卫靠读源码文本断言，模块图里没有这条边，改样式会「命中 0 个、退出码 0」——假绿，不是慢。

测试一律 `node` 直调，别走 `pnpm run`（package.json 同名脚本已同口径）：pnpm 11 跑脚本前的依赖自检默认会自动 `pnpm install`，本仓必判「过期」——主仓里 `tools/*` 子包被算成工作区项目，worktree 里还经 junction 读到主仓的状态文件。

## 硬约束（看见就是错）
- 样式源只有 `src/<域>/styles.css`（根 `styles.css` 是聚合产物）。域内禁 `scrollbar-width: thin/auto`、禁自绘 thumb、禁运行时注入 `<style>`、禁内联视觉样式。例外只有两处，都要先有 ADR：① 远端皮肤包，只在 `src/core/skin-pack.ts` 单一注入点（ADR-0199）；② 展示板**沙箱框文档内部**的滚动条样式，只在 `src/dock/ui.ts` 的 `FRAME_SCROLLBAR_CSS`（ADR-0243 补记，作用域仅 iframe 文档、守卫掐死范围）。
- 域 UI 的唯一真理源是与评审壳共用的实现源码；两侧不一致 = 缺陷，改源码，别改壳、别改产物。未定稿的探索稿只写 `.scratch/<名>/`。
- 不手改生成物：根 `main.js` / `styles.css`、`changelog-data.ts`、`prototypes/**/prototype-*.js`、`downloads/manifest.json`、`downloads/skins/`、`tools/dock-watch/dock-core.cjs`（+ 同目录 `core-version.json`）。
- 命令 ID `bz-<域>-<动作>`；通知正文不带 emoji（新语义查 `src/core/notice.ts` 的 ICONS）。
- **新增弹窗必须穿本域的皮。** `uiModal` / `openFlowDialog` 只给中性壳（400px 窄卡、居中正文、灰底胶囊按钮），直接裸用就是「另一个插件弹出来的框」——2026-10-31 引导页的关闭确认就这么翻车过。做法：`uiModal` 传 `className`、`openFlowDialog` 传 `className`，皮肤规则写进该域的 `styles.css`（`#__shared_confirm_popup__.<皮肤类> …` 起手，因为壳的居中/宽度挂在 id 上，两个类压不住）；本域已有弹窗体就复用，不要另起一套。
- **遮罩之上不许再压一层可点的铺满层。** 点遮罩关闭的判据是「click 的 target 是遮罩本体」，再叠一层 `position: fixed; inset: 0` 的可点容器，target 就永远落在那层上，遮罩点了没反应（2026-10-31 日记兜底纸：没设文件夹时整张桌被 `.bz-diary-fallback` 盖住，只剩右上角 X 能关）。两种正确做法：那层 `pointer-events: none`，或把它的节点一起写进遮罩的命中判据（日记取的是后者，见 ADR-0230 补记）。全屏面板（本身就铺满、没有遮罩空白）不受这条约束。
- 改动走 worktree（仓库外，从最新 master 分叉）；**worktree 内不构建**——产物直出本机 vault（`esbuild.config.mjs` 硬编码）与仓库根。

## 「走快速原型」= 不许验证
不测试、不截图、不比对：禁 vitest 任何跑法（含「只跑当前域」）、禁 CDP / 无头探针、禁壳 `?selftest=1`、禁读计算样式自证。

改完源码 → 起或复用预览服务 → 把网址交给他，让他判。门禁等他喊「同步」一次补齐（改到类型边界可顺手 `tsc --noEmit`，但那不算验证、不许拿它拖交付）。

## 提交

日常改动就到这里为止，**不跑发布七步**。

Conventional Commits。**提交信息即更新日志正文**，只有 `feat` / `fix` / `perf` 进日志；标题主句（`——` 之前那段）至少 4 个字，短了会被 `_gen-changelog.mjs` 的 `rewrite()` 静默丢弃（提交照样成功，日志里没这条）。

流程：worktree → `git merge master` → 门禁全绿（`test-affected --since master` + `tsc --noEmit` + 自审 + diff 审查）→ 合回主仓 → 推送。

占 issues / ADR 编号前先查主仓库最新号；拍板结论进 `.scratch/memo-suite-plugin/spec.md`，决策进 `docs/adr/` 并同步 `CONTEXT.md`。

## 发布

只有在**发版**时才走这四步。跟日常提交推送是两回事。

**两道硬闸，缺一不可：**

1. **必须用户明确说「发布」。** 「准备一下」「顺手发个版」「提交完顺便发吧」都不算。没听到这两个字，跑完七步就停。
2. **发布前先把 Release note 正文贴给用户看，等他看完点头。** 在 `gh release create` 之前停住——note 没被看过就发出去，等于替用户对外承诺内容。

提交、推送、打 tag 都是本地/仓库内动作；**对外发布**（Release、分发仓库、市场 PR）必须过这两道闸。

### 1. 主仓跑七步

```
tools-pack → skin-pack → changelog → catalog → manifest → build → assets
```

顺序固定：前四步出产物，`manifest` 对产物现算 sha256，`build` 出插件本体，`assets` 把 `downloads/**` 与 `releases/<tag>/` 镜像到分发仓库。`pnpm assets` 与 `node scripts/push-assets.mjs` 是同一件事，Git Bash 里用后者。

生成日志要带目标版本：`node scripts/_gen-changelog.mjs --next=<版本>`。日志按 **git tag** 切块（不是按天），这一刻 tag 还没打，不传 `--next` 最新一版就不会出现在日志里，`manifest.json` 也不会回写成新版本。

三个「少跑一步」的后果，都静默：

| 少跑 | 症状 |
|---|---|
| `manifest` | 清单停在上一版，页面重出了、sha256 没跟着算；只有门禁里 `skin-pack-split-guard` 会说话 |
| `tools-pack` | 旧 tar.gz 还在，用户端显示「已是最新」但内容没更新 |
| `assets` | 下载通道只认分发仓库，客户端拿到的还是上一版 |

### 2. 打 tag 并校验

`git tag -a v<版本>` 并 push。tag 名 = `manifest.json` 的 `version`，一个字符都不能差。

打完 tag 跑一次 `node scripts/_gen-changelog.mjs --check`：它对账「最新 tag / manifest 版本 / 日志顶部版本」三项，不一致就非零退出。

**先 tag 再发布**：tag 不存在时 `gh` 会自建一个轻量 tag，跟已 push 的标注 tag 对不上。

### 3. GitHub Release

七个资产，缺一不可：

| 资产 | 从哪来 |
|---|---|
| `bz-<版本>.zip` | 根目录 `main.js` / `manifest.json` / `styles.css`，包内必须留一层 `bz/` |
| `bz-offline-<版本>.zip` | `downloads/` 整目录，包内路径 `bz-offline/downloads/<file>` |
| `SHA256SUMS.txt` | `sha256sum *.zip \| sed 's/\*/ /'`（msys 会输出 `hash *file`，那个 `*` 要去掉） |
| `main.js` `manifest.json` `styles.css` | 平铺单挂。**社区市场只认这三个**，zip 里的不算——漏了市场里永远装不上，而 Release 页看起来一切正常 |

正文 = **更新日志 + 固定三节**（`# 安装` / `# 离线资源包` / `# 反馈`），照抄 [docs/release-note-template.md](docs/release-note-template.md)，三节不要改措辞。标题层级按模板：四个一级标题并列，
「新增 / 修复」是 `# 更新日志` 下的二级标题——少写「更新日志」这个一级标题，前两块就会和「安装」「反馈」平级，看不出它们是一组。
离线包按模板写成「解压出的 `downloads/` 整个放进插件目录」，并注明插件本体升级仍要手动覆盖三件套。

正文条目**不照搬 changelog**：照模板写成 `- **标签** ：说明`，标签说人话（赞赏 / 关于组 / 剪藏本），
不写脚本域名（`core` / `global` / `other`）——后者会出现三个「其他」。条目可删可合并，
同一处功能一版内改了又改的，正文里说最终态；插件内更新日志页面仍是脚本口径，不必逐条对齐。
Release 正文里**自定义 CSS 无效**（GitHub 会剥掉 `style` / `class` / `<style>`），
要颜色只能用分组标题上的 emoji（✨ 🐛 ⚡）。

```bash
gh release create v<版本> -R yeshimei/bz --title "bz v<版本>" --notes-file note.md \
  bz-<版本>.zip bz-offline-<版本>.zip SHA256SUMS.txt main.js manifest.json styles.css
```

打包用 PowerShell `Compress-Archive`（Windows 没有 `zip`/`7z`；别用 `Add-Type`，安全策略直接拦）。

### 4. 收尾
子代理 review → 清 worktree。

### 一条例外
- **分发仓库**：下载走 `yeshimei/bz-assets`（ADR-0269）——主仓 `.git` 超 jsDelivr 的 50 MB 上限，未缓存文件一律 403，国内 raw 又不通。`push-assets` 只留最近 3 份发布，`.git` 超 25 MB 自动压平历史。主仓仍是唯一产出地，分发仓库随时可删可重建；基址只改 `src/core/remote-base.ts`，别在两处各写一份 slug。

## 坑
- Git Bash 里 pnpm 起不来（shim 把路径解析成 `D:\d\...`）→ 用 PowerShell，或 `node node_modules/<包>/…` 直调。
- `git worktree remove` 后常残留 `node_modules`，要另删。**删前必须先 `cmd /c rmdir` 掉 worktree 里的 `node_modules` junction**——junction 指向主仓 node_modules 时，remove 会穿透删除主仓 `.pnpm` 里的包（表层包还在、深处依赖悬空，测试报 Cannot find module）；穿透后 `pnpm install` 修不回（workspace 状态文件误判 up to date），要 `rm -rf node_modules && pnpm install` 整体重建（store 硬链接，很快）。
- 改了工具坞的**判据**（`src/dock/rules.ts` / `schema.ts` / `registry.ts` / `declaration.ts` 的读侧）要重跑 `node scripts/build-dock-watch.mjs` —— 值守进程用的 `dock-core.cjs` 是这么打出来的，不重打它就还在按旧判据决定「该不该跑」（`pnpm run build` 已含这一步）。

## 去哪儿查
| 要什么 | 去哪 |
|---|---|
| 某域数据落在哪 | 该域 `data.ts` 的路径 / 键常量（缺省数据根 `<插件目录>/storage/`，ADR-0270；`CONFIG/STORAGE/` 是老库的落位，不是缺省） |
| 域职责、术语、口径 | `CONTEXT.md` |
| 单源域名单 | `build-preview.mjs` 的 `PREVIEW_DOMAINS` / `BEHAVIOR_DOMAINS` |
| 皮肤清单 | `scripts/skins.catalog.json` |
| 离线值守（Obsidian 关着也跑） | `tools/dock-watch/README.md`（装法/排障）· 租约与状态接口 `src/dock/watchdog.ts` · ADR-0242 |
| 值守跑之前等网络 | `tools/dock-watch/net.js` 文件头 · ADR-0242 补记（等不到不记账，留给下一拍） |
| 写一个接入工具坞的外部脚本 | `docs/dock-tool-guide.md`（声明文件 / 参数值文件 / 四行协议 / 运行记录 / 展示板 `panel.html`） |
| 发布页正文怎么写、条目什么格式、离线包什么结构 | `docs/release-note-template.md`（条目格式段：标签说人话 + 全角冒号 + 标题 emoji）· `src/core/offline-source.ts` 文件头的目录图 |
| 分发仓库怎么重建 | `scripts/push-assets.mjs`（保留份数 / 压平阈值 / slug 读哪里）· ADR-0269 |
| 资源地址、通道顺序 | `src/core/remote-base.ts`（唯一事实源；别在别处再写一份 slug 或域名）· ADR-0269 |

本文与代码冲突时以代码为准，并顺手改这里。历史注释里的「铁律 N」是旧编号，按内容找，别按号找。
