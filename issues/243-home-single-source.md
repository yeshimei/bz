# issue 243：home 域 markup 单源 + 布局分层（ADR-0104/0105 落地）

## 背景

bookshelf（issue 238/239）、belongings（issue 240）已落「render.ts 渲染纯层 + layouts/ 差异层」范式；home 是 ADR-0104 里已勘测的待迁域（4 构建器 + 面板骨架）。home 特殊点：活动河数据层 river.ts 已含规则纯函数（buildNotes/buildPreviews/buildDots/riverCountText），需并入纯层体系且保持 `./river` 旧引用路径兼容。

## 改动

- **`src/home/shared.ts`（新，311 行）**：跨布局共享层 = 域清单（DOMAINS/DOMAIN_MAP/DOMAIN_DOT/ALL_DOMAIN_IDS，自 domains.ts 收编；icon 仍经 core/domain-icons 单一事实源）+ 活动河类型与口径（RiverData 族 + EMPTY_*）+ 规则纯函数（buildNotes/buildPreviews/buildDots/dotOf/riverCountText/memoIdOf）+ 日期文案（dateStrOf/headDateText）。import 白名单内：core/ui/str、core/domain-icons（均零依赖）；recap 类型仅 type-only。
- **`src/home/layouts/river/render.ts`（新，125 行）**：river 布局差异层 = 面板骨架 panelFrameHtml + 骨架占位 + 周历 weekHtml + 入口行/河卡/预告卡/瓦片。只 import shared，视图与数据显式入参（无模块级状态）。
- **`src/home/render.ts`（新，14 行）**：域入口聚合，`export * from './shared'` + 布局 re-export；ui.ts 与原型壳只认这里。
- **`src/home/river.ts`**：退役纯类型与规则纯函数（收编 shared），只留采集（collectRiver + 各源计数）；对 `./river` 的旧引用（tests/home 等）经 re-export 零改。415 → 221 行。
- **`src/home/domains.ts`**：70 → 7 行兼容壳（re-export shared）。
- **`src/home/ui.ts`**：289 → 180 行纯行为层（生命周期/绑定/ESC/命令直达），markup 全切 `./render`。
- **`src/home/prototype.html`**：壳消费 `window.BZR_home`；演示数据改为 RiverData 真实形状快照，口径（点评/彩点/计数文案）全部现算自单源；桌面 + 手机框改 `?mob=1` iframe 双面板（bookshelf 范式，替换旧双 host 复制渲染）；自检 ?selftest=1 双模式。
- **`scripts/build-preview.mjs`**：PREVIEW_DOMAINS 加 "home"（esbuild dev watch 自动覆盖 layouts 内 render.ts）。
- **守卫改指新文件**：`tests/core/render-purity.test.ts` ALLOWED_EXTERNAL 加 `../core/domain-icons`；`tests/core/enh-sweep-c.test.ts` 面板挂载点扫描改指 `layouts/river/render.ts`；`tests/review-fix-b.test.ts` icon 迁移扫描改指 `shared.ts`。

## 验证

- tsc --noEmit 干净；pnpm test 4146/4146 全绿。
- selftest（headless Edge）：桌面 `SELFTEST OK 19/19`、`?mob=1` `SELFTEST OK 20/20`。
- 预览包 `src/home/prototype-render.js`（339 行，BZR_home）同 commit 入库。

## 坑

- buildNotes 的「比昨天早晚」点评比较的是跨天原始 ts（含 24h 差），演示数据昨天 10:15 vs 今天 07:42 会得「晚了 1287 分钟」——单源后原型口径随插件（此前原型手写文案掩盖了这点）。
- home 移动端是 `@container (max-width:768)`，容器是面板自身（width=min(880px,94vw)）：headless 默认 800px 视口下面板 752px 就命中移动布局，桌面 selftest 必须 `--window-size=1400,900` 跑。
