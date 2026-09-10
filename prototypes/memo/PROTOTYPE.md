# prototypes/memo — 备忘录评审壳（issue 260）

行为单源（ADR-0106）+ markup 单源（ADR-0104）评审壳，范式随 favorites 试点。

- `prototype.html`：评审壳主页——双 iframe（桌面 920 视口 / 移动 396）跑真 `src/memo/ui.ts` 依赖链；带 `?selftest=1` 自检（真 DOM 断言经 iframe）与四个演示钩子（被动捕获 / 打开笔记提醒 / 引用同步·改名 / 引用同步·删除）。
- `prototype-view.html`：iframe 视图——boot + openPanel，宽度决定桌面/移动形态。
- `fake-sim.ts`：行为包入口（build-preview 以此构建 `prototype-behavior.js` 挂 `BZW_memo`）。种子 + 设置注入 + 域外接线等价重现（adapter / file-sync 常驻 / 提醒后台演示钩子）。
- `fake/fake-obsidian.ts`：公共假 obsidian——Platform / setIcon（表 = `prototype-icons.js`）/ FakeVault（localStorage 文件系统 + rename/delete 演示事件）/ 最小 workspace 桩（file-open 演示）。
- `prototype-data.js`：`window.MEMO.ITEMS` 演示种子——16 条，六场景 + 到期梯度（逾期/今日/未来）+ 代码 scriptName / 公开课 courseName 特例 + 3 条共用笔记（引用同步演示）+ 2 条 40+ 天前完成（「更早 N 条」）。日期相对当下生成，任何天打开梯度都成立。
- `prototype-render.js` / `prototype-behavior.js`：构建产物（勿手改）。

## 演示面（issue 260 §2 四项行为面）

| 面 | 入口 | 真代码路径 |
|---|---|---|
| 主流程 + 编辑弹窗 | 壳内直接操作 | `ui.ts` 全量（composer/勾选/编辑器/场景管理/排序浮岛） |
| 引用同步 | 「笔记改名/删除演示」钮 | `file-sync.ts` 订阅 `vault:md-*` 改写 memo.json 引用 |
| 被动捕获 | 「被动捕获演示」钮 | `reminder.ts` autoPopupOnStart + `hasPendingUrgent` 300ms 自动弹面板 |
| 打开笔记提醒 | 自检/`demoFileOpen` | `reminder.ts` file-open 链，搜索框定位笔记路径 |
| 皮肤切换 | 「皮肤」钮 | `applyMemoSkin` 热切换 paper/editorial |

壳内 `autoPopupOnStart` 缺省关——被动捕获不随加载自动弹，走手动演示。
