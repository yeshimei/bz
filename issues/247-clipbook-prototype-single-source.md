# 247：剪藏本原型落域（markup 单源 + 行为单源）

日期：2026-09-08 ｜ 分支：wt/clipbook-proto ｜ worktree：clipbook-proto

## 背景

剪藏本 UI 已在 issue 214 对齐拍板定稿原型 `clipbook-tri-5/p1-final.html`（编辑部印刷风 + V1
点线索引），但原型本体留在 `.zcode/ui-prototypes/`（内联样式、不入 git、与域代码无关联），
域目录没有 `prototype.html` 评审壳——「原型先行」流程对剪藏本缺位。用户发话：把剪藏本的原型
落到域中，走原型流程。ADR-0104（markup 单源）/ ADR-0106（行为单源）范式已铺开六域
（belongings/bookshelf/cinema/favorites/home/settings-panel），本批把剪藏本并入同范式。

## 改动

- **render.ts（新）**：渲染纯层——面板骨架（桌面三栏 + 移动双屏 + 移动详情）/ rail 点线索引行
  / rail 脚注 / 目录序号制条目 / 阅读面（meta·摘要·正文·「打开笔记」文字脚）/ 移动源胶囊·列表·
  详情正文，全部自 ui.ts 平移；ICO 表 / siteShort / siteTint / stateFlag / stateLabel / dotHtml
  收编；时间展示串由调用方注入（core/utils formatRelativeTime 依赖 moment，纯层不引用）；
  段落化复用 md.ts（零依赖）+ ImgResolver 钩子注入（vault 资源路径解析留行为层）。
  纯度：import 白名单 = `../core/ui/str` + `./types` + `./md`，render-purity.test.ts 自动纳管。
- **ui.ts**：改消费 render.ts——buildDom/railItemHtml/dotHtml/siteShort/siteTint/目录与阅读与
  移动端 innerHTML 模板全删（1345 → ~1210 行），生命周期/事件委托/数据流零变化。
- **fake/fake-obsidian.ts（新）**：localStorage 假 vault（cinema 版适配 + **目录键子树合成**——
  `getAbstractFileByPath('归档/网页剪藏')` 返回合成目录节点，scanClipDirectory 直接可跑）+
  cachedRead + metadataCache.getFileCache 现场 frontmatter 解析 + TFile/Setting/MarkdownView 桩
  （后两者仅依赖链导入，运行期不构造）+ workspace.openLinkText / openUrl no-op。
- **fake-sim.ts（新）**：行为产物入口——种子（window.CLIP_DATA → news.json / clipbook.json /
  `归档/网页剪藏/*.md`，SEED_MARK 守卫；stats.byDate 以「当天」动态构造）+ 设置注入 +
  attachObsidianAdapter 事件桥（跨 iframe storage → clipping:file-* 域事件 → 300ms 防抖自动刷新，
  与插件同链）+ boot/openPanel/closePanel/unload 导出。
- **prototype.html / prototype-view.html（新）**：双 iframe 评审壳（桌面 1210×800 / 移动 396×780）
  + `?selftest=1` 28 断言（**含 CSS 生效断言**：frame 纸白底 rgb(250,248,243)、移动媒体查询、
  右键菜单皮肤变量；标为已读真落盘 + 撤销通知；移动详情屏2 往返）。
  数据/图标脚本必须放壳 head——放 body 尾会让 iframe boot 时读到 undefined（时序坑）。
- **prototype-icons.js / prototype-data.js（新，生成物入库）**：CLIP_ICONS 19 枚
  （favorites/cinema 表并集 + lucide-static@0.544.0 补 8 枚）；CLIP_DATA = 真实库快照
  （63 未读 + 10 已处理骨架 + 8 篇剪藏笔记；正文截断、cookie/守护配置不入种子；
  生成脚本 `.scratch/gen-clip-demo.py`）。
- **scripts/build-preview.mjs**：PREVIEW_DOMAINS + BEHAVIOR_DOMAINS 登记剪藏本；
  仓库根 index.html 导航加卡。
- **tests/clipbook/render.test.ts（新）**：骨架锚 / rail JSON 转义（G 回归）/ 序号制与未读类 /
  段落化引文图片拒载 / 状态章映射 / 站点短名徽标色。

## 契约

命令 / 设置键 / smartcat 事件 / news.json·clipbook.json 数据面零改动；数据零迁移。

## 验收

pnpm test 4159 绿（域 104 → 113）+ tsc 干净 + build-preview 双产物重出 + selftest 28/28
（headless Edge CDP）。

## 坑

- 评审壳数据脚本必须放 head：iframe 随 body 解析即 boot，数据脚本在 body 尾时
  `window.CLIP_DATA` 还没赋值，种子静默空跑。
- selftest 判脏不能以「数据在库」为准（种子是 iframe boot 异步写的，壳脚本先执行），
  否则首载永远判脏 → 重置 → 重载死循环，iframe 永远停在 about:blank（资源表为空 +
  BZW undefined 是该循环的诊断指纹）。用「本轮运行标记」判脏。
- Git Bash `/tmp` 与 Node 的路径解析不一致（Node 视 `/tmp` 为 `D:\tmp`），跨工具传路径
  用 `cygpath -w` 落实。
