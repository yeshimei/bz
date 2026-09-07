# 245 — 归物本行为层单源：真 ui.ts 打进原型（宿主差异公共假层）

## 目标

markup（ADR-0104）之后，把归物本**行为层也变成单源**：
原型壳不再维护 636 行自绘交互，而是直接运行**插件同款 ui.ts**（行为唯一真理）。
宿主差异全部收敛到「真实现（插件侧）/ 公共假层（原型侧）」两份同接口模块上，
由预览构建用 esbuild `alias` 按侧切换——**ui.ts 零改动**。

用户拍板（2026-09-07）：① 类真 C 服务直打原型；
② 类改造共用；③ 类写接口一致的公共假函数供原型调用，**不是**搭假环境让真 ③ 跑。

## 三类边界落地

| 类 | 模块 | 原型侧处理 |
|---|---|---|
| ① 直打 | core/notice、z-order、esc-manager、flow-dialog、domain-bus、utils、dom、smartcat/belongings-source（纯函数） | 打包进原型产物（真身） |
| ② 改造共用 | obsidian 包 `Platform`/`setIcon`、core/mobile | esbuild alias → 公共假 obsidian（浏览器版） |
| ③ 公共假层 | belongings/data（vault 读写）、belongings/ai（真 AI API）、settings-provider（读插件设置） | 假为 localStorage / 规则联想 / 注入默认值，**接口与真实现一致** |

## 公共假层形态（与 vitest mock 同思路，浏览器版）

预览构建（build-preview.mjs）新增第二产物 `prototype-sim.js`，打包一个「假宿主入口」，
含：

- `fake-obsidian.ts`：`Platform.isMobile`（视口判定）、`setIcon`（DOM 内联 SVG，同
  prototype-icons.js 表）
- `fake-data.ts`：`loadDatabase/saveDatabase`（localStorage，键同现壳
  `bz-bel-p20-shared-v1`）、`getDataFilePath`
- `fake-ai.ts`：`aiSuggestCategory` 规则联想（关键词 → 分类 + 图标，纯本地）
- `fake-settings.ts`：`setSettingsProvider` 注入默认值

esbuild `alias`（0.21 支持）在预览打包时把 ui.ts 依赖链上的 `./data`/`./ai`/
`obsidian`/`settings-provider` 替换为上述假层 → 行为产物 `prototype-behavior.js`
挂 `window.BZW_belongings`。壳只留：假数据初始化、图标表、演示容器（dt/mob）、
mountIcons 兑现、自检。

## 产物

- `src/belongings/fake/`：obsidian.ts、data.ts、ai.ts、settings.ts（公共假层，提交入 git）
- `src/belongings/prototype-sim.js`（假宿主产物）
- `src/belongings/prototype-behavior.js`（行为产物，window.BZW_belongings）
- prototype.html 壳瘦身：删 636 行自绘行为，改调 `BZW.openPanel()`

## 验证

- 新增测试：fake-data 读写 localStorage、fake-ai 规则返回合法建议
- 全量门禁 pnpm test + tsc
- headless 打开原型页：桌面/移动两容器，增删改查 + 状态流转 + 撤销全交互冒烟

## 风险

- esbuild alias 精确性：只替换 preview 打包，不碰插件主构建（alias 只在 preview 的
  build 配置里）
- ui.ts 直接 import 的 `./data`、`./ai` 与壳路径不同——假层需以 `alias` 指向
  而非改 ui.ts
