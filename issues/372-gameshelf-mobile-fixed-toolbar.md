# issue 372 — 游戏库移动端：去掉海报头 + 搜索行改「固定」（不用 sticky 吸附）

> 2026-09-17 用户两条点名（承接 issue 370/371 的 V1 落域）：
> 「移动端去掉海报头，搜索栏变成固定的，不是用吸附」

## 一、移动端去掉海报头（门面 hero）

`≤768px` 下 `.bz-gs-hero { display: none }`：窄屏不给整块封面 banner 留高度，进面板就是
搜索行 + 网格。桌面（门面 207px 高、门面之下工具行吸顶）**原样不动** —— 这版式的门面只
在宽屏成立。

## 二、搜索行「固定」而不是「吸顶」

原来的做法是 `.bz-gs-tools { position: sticky; top: 0 }`（桌面至今仍是）。用户明确不要吸附，
窄屏改成**结构上的固定**：把滚动权交给网格自己，工具行与头行同层、根本不在滚动流里。

```
panel(100dvh, flex column)
├── .bz-main-head            固定
├── .bz-gs-status            固定
└── #bz-gs-body[data-view=shelf]   不滚动（overflow: visible; flex column）
    └── .bz-gs-wall                  flex column, flex: 1, min-height: 0
        ├── #bz-gs-hero              display: none（移动端）
        ├── .bz-gs-tools             flex: none、position: static ← 滚动时纹丝不动
        └── #bz-gs-gridhost          flex: 1、min-height: 0、overflow-y: auto ← 唯一滚动容器
```

- **只作用于游戏墙**：`#bz-gs-body` 打 `data-view="shelf"` 才套这套（渲染时设置、切页/引导态
  移除）——统计页仍是整页滚动，不然统计页会被顶死滚不动。
- **两层「网格」别搞混**：`#bz-gs-grid`（`.bz-gs-gridhost`）是宿主，`shelfHtml` 渲染的
  `.bz-gs-grid` 才是卡片网格。宿主默认是普通块（`min-height: auto`），**不给它 flex 约束就
  永远长到内容高、滚不动**——本次第一版就栽在这（写成了 `.bz-gs-grid` → 页面根本不滚）。
- 移动端工具行上内边距仍为 0（沿用上一次「贴死头行」的要求）；横向与底部内边距移到宿主的
  `padding` 上，最后一行不贴屏幕底。

## 门禁

- `tsc --noEmit` 零错误；全量 5707 例全绿（新增断言在既有用例内，用例数不变）。
- 原型壳自检 **55/55**，新增 4 条：移动端无门面（display:none）/ 移动端搜索行非 sticky 且滚
  网格 320px 后位置不动 / 移动端滚动权在网格（body 不再滚动）/ 桌面工具行仍吸顶。
- 实测几何（412×915）：面板 0~915 整屏 · 头行 44~88 · 工具行 112~153（static）· 网格宿主
  153~915（clientHeight 762 / scrollHeight 10772，底边正好贴视口下沿）；桌面：门面 85~292、
  工具行 292~350（sticky）、宿主 350 起。
