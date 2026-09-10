# prototypes/memo — 备忘录评审壳（issue 260）

行为单源（ADR-0106）+ markup 单源（ADR-0104）评审壳，范式随 favorites 试点。

- `prototype.html`：评审壳主页——双 iframe（桌面 920 视口 / 移动 412×915）跑真 `src/memo/ui.ts` 依赖链；带 `?selftest=1` 自检（真 DOM 断言经 iframe）；徽牌 = 布局钮 / 皮肤钮 / 隐藏移动端 / 重置演示数据。
- `prototype-view.html`：iframe 视图——boot + openPanel，宽度决定桌面/移动形态。
- `fake-sim.ts`：行为包入口（build-preview 以此构建 `prototype-behavior.js` 挂 `BZW_memo`）。种子 + 设置注入 + 域外接线等价重现（adapter / file-sync 常驻 / 提醒后台演示钩子）。
- `fake/fake-obsidian.ts`：公共假 obsidian——Platform / setIcon（表 = `prototype-icons.js`）/ FakeVault（localStorage 文件系统 + rename/delete 演示事件）/ 最小 workspace 桩（file-open 演示）。
- `prototype-data.js`：`window.MEMO.ITEMS` 演示种子——16 条，六场景 + 到期梯度（逾期/今日/未来）+ 代码 scriptName / 公开课 courseName 特例 + 3 条共用笔记（引用同步演示）+ 2 条 40+ 天前完成（「更早 N 条」）。日期相对当下生成，任何天打开梯度都成立。
- `prototype-render.js` / `prototype-behavior.js`：构建产物（勿手改）。

## 演示面（issue 260 §2 四项行为面）

| 面 | 入口 | 真代码路径 |
|---|---|---|
| 主流程 + 编辑弹窗 | 壳内直接操作 | `ui.ts` 全量（composer/勾选/编辑器/场景管理/排序下拉） |
| 引用同步 | `?selftest=1` 自检（`demoRenameNote` / `demoDeleteNote`） | `file-sync.ts` 订阅 `vault:md-*` 改写 memo.json 引用 |
| 被动捕获 | `?selftest=1` 自检（`demoCapture`） | `reminder.ts` autoPopupOnStart + `hasPendingUrgent` 300ms 自动弹面板 |
| 打开笔记提醒 | `?selftest=1` 自检（`demoFileOpen`） | `reminder.ts` file-open 链，搜索框定位笔记路径 |
| 皮肤切换 | 「皮肤」钮 | `applyMemoSkin` 热切换 paper/editorial |
| 布局切换 | 「布局」钮 | 读域设置 schema「面板布局」行（单源；当前仅 `default` 清单） |

壳内 `autoPopupOnStart` 缺省关——被动捕获不随加载自动弹，走自检驱动。

**issue 269**：被动捕获 / 笔记改名 / 笔记删除三枚**手动演示钮**按用户要求从徽牌撤下；
三面的真链路仍在，触发口收敛到 `?selftest=1`（覆盖率不减）。

**布局钮**：可切换的布局清单**不写死在壳里**，而是读 `src/memo/settings.ts` 的
「面板布局」行——`layouts/<x>/` 落地后只需给那行加一张卡，徽牌按钮自动可切。
现状该行只有 `default`「清单」（场景工作台，即唯一实现），故按钮标注「仅一套」、
点按无变化（`memoLayout` 目前尚无消费方）。

## 移动端形态（issue 268/268 定稿）

- 头行钮组：移动端**只留一枚 28px 关闭钮**（纸感墨框贴纸 / 编辑部方角墨框）；设置与新建
  撤出头行（设置走场景项长按菜单「在设置中编辑」）。
- 场景条：`.bz-mobstrip` = 9 个场景 chip + 尾部「添加场景」虚线 chip（动作磁贴，不是场景，
  不带 `data-memo-scene`——自检的 9 场景口径不变）；chip 随皮肤换装（纸感贴纸 / 编辑部方角）。
- 底部录入：点「添加」打开创建弹窗，已输入文字带进内容框、当前场景预选（桌面仍直接快速落盘）；
  剪藏剪贴板预填抓到的标题候选一并交接。草稿在弹窗保存成功后才清空。
- 排序：三档平铺改单枚下拉（`uiSelect`），搜索框吃掉腾出的宽度；下拉菜单按皮肤换装。
- 顶距：44px 避让垫从面板根挪到头行自身——头行的斜纹底一路铺到面板顶边（不再被截断）。
