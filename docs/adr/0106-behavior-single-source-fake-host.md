# ADR-0106：域行为层单源——真 ui.ts 打进原型（宿主差异公共假层）

日期：2026-09-07 ｜ 状态：采纳（belongings 试点落地，issue 245）

## 背景

ADR-0104 让 markup/CSS 单源后，行为层仍是双份：插件 `ui.ts`（862 行，真服务）
与原型壳内联脚本（636 行自绘交互）同构却各自维护。用户追问「能否让原型直接
包含 BZ 域的行为」，并拍板三类边界的处理：

- ① 类（不依赖 obsidian 的真 core 服务：notice/z-order/flow-dialog/esc-manager/
  domain-bus/utils…）→ **真身打进原型**；
- ② 类（只 1 行 obsidian 触点的 core 模块：icons 的 setIcon、mobile 的 Platform）
  → **公共假 obsidian 覆盖**，真模块零改动共用；
- ③ 类（真宿主服务：数据层 vault 读写、AI API、设置存储）→ **写接口一致的公共
  假函数**供原型调用，**不是**搭假环境让真 ③ 跑——原型永远用假数据。

## 决策

预览构建（`build-preview.mjs`）新增**行为产物**：以域 `fake-sim.ts` 为入口，
esbuild `alias` 把依赖链上的 `obsidian` 包替换为 `fake/fake-obsidian.ts`，
产出 `prototype-behavior.js`（挂 `window.BZW_<域>`）——**插件 ui.ts / data.ts /
ai.ts / core 服务一行不改**，真行为代码直接打进原型。

```
src/<域>/
  fake/fake-obsidian.ts   ← 公共假 obsidian（浏览器版）：
                             Platform（视口 ≤768）、setIcon（BLG_ICONS SVG 表）、
                             FakeApp/FakeVault（localStorage 文件系统 +
                             storage 事件桥——跨 iframe 模拟「文件 modify 自动刷新」）
  fake-sim.ts             ← 启动器：种子数据（BLG.ITEMS）+ 注入 FakeApp +
                             setSettingsProvider + 导出 openPanel 等
  prototype-behavior.js   ← 行为产物（构建生成，提交入 git）
  prototype-view.html     ← iframe 视图：boot + openPanel（真行为全屏跑在 iframe）
  prototype.html          ← 评审壳瘦身为双 iframe（桌面宽视口 / 移动 396px，
                            宽度经 styles.css @container 决定布局）
```

- **app 注入不裂**：假层不私设 setApp/getApp——`fake-sim` import `core/app` 的
  真 setApp 注入 FakeApp（core/storage 的 jsonFileStore 经 getApp 取到同一实例）。
- **数据真伪边界**：core/storage 的 jsonFileStore、data.ts 的迁移/派生/写队列
  **全真**（跑在 fake vault 上）；只把「文件系统」换成 localStorage。
- **自检可重复**：`?selftest=1` 先查数据基线，脏则重置重载；断言全经 iframe
  真 DOM（含完整鼠标事件序列 mousedown/mouseup/click——右键菜单/capture 层
  需真实坐标；移动抽屉用合成 touch 下拉，因真行为只支持拖拽关闭）。

## 后果

- 原型交互 == 插件交互：改 `ui.ts` 一处，插件与原型壳同时变——行为单源闭环。
- 壳内不再有自绘 toast/确认框/右键菜单/移动抽屉（各 100+ 行）——删 636 行，
  评审壳 ~150 行只留外景容器 + 自检。
- 双 iframe 天然验证桌面/移动两态 + storage 桥验证跨实例自动刷新（更接近插件
  真实「文件 modify 自动刷新」语义）。
- 试点仅 belongings；其余域接入 = fake-sim + view.html + 构建登记（ui.ts 若用
  fake obsidian 未覆盖出口则补 fake 层）。
- 未覆盖 obsidian 出口（requestUrl 抛错）：原型 AI 归类走内联降级——符合「原型
  不碰真 AI」边界。

## 关联

- ADR-0104（markup 单源）/ ADR-0105（controller 行为单源设计）——本条是 0105
  controller 的落地形态：宿主差异收敛为「真实现 / 公共假层」双份同接口。
- issue 245（本决策）；tests：vitest 的 mock-obsidian-entry.ts 同思路（测试侧
  替身 vs 浏览器侧公共假层）。
