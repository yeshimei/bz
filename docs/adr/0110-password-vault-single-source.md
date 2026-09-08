# ADR-0110：密码本接入原型 × 插件三层单源（行为单源第八域）

- 状态：已采纳
- 日期：2026-09-09
- 关联：ADR-0104（render 单源试点）、ADR-0106（行为单源假层范式）、ADR-0109（密码本拆回独立域）、ADR-0078（v1 成型版 UI）
- 票：`issues/251-password-vault-single-source.md`

## 背景

ADR-0109 将密码本自统一保险库拆回独立域（v1 成型版逐字回植），ui.ts 仍是 markup 内联的旧形态（22 处 innerHTML），不符合铁律 5「域 UI 唯一真理源是与原型共用的实现源码」。用户拍板：密码域改造成和其他域一样的单源架构。参照 clipbook 接入范式（issue 247）执行。

## 决策

### 1. render.ts 纯层抽取（markup 单源，ADR-0104 契约）

- ui.ts 全部 markup 平移至 `src/password-vault/render.ts`：面板骨架（桌面三栏 + 移动单列）/ 锁屏 / 添加弹窗 / 平台编辑弹窗 / 确认框 / 平台行 / 账号卡 / 移动详情页 + 空态族；ui.ts 仅存行为（事件绑定/数据流/锁屏安全机制/生成器），**零模板串**。
- 纯度契约：import 白名单 `../core/ui/str`（esc）+ `./data` 仅 type-only（编译期擦除，render 产物不拖 SafeManager 依赖链）；禁模块级可变状态；relTime/colorOf/dots 等展示工具迁入 render.ts，ui.ts 再导出保公共面。
- 图标策略：域 markup 用 v1 自绘内联 SVG（`render.ts ICONS`，金印/星/眼专绘）原样平移，不换 lucide 占位——两侧零差异；core 组件（item-actions 菜单/抽屉）的 lucide 动作图标由 `prototype-icons.js` 表喂假 setIcon。
- DOM 产物与改造前逐字一致（类名/钩子/文案未动），ui.test 21 用例零改动通过。

### 2. 行为单源（ADR-0106 假层范式）

- `src/password-vault/fake/fake-obsidian.ts`：FakeVault（localStorage 文件系统 + storage 桥）+ adapter 直读面（read/write/exists/remove/**mkdir/rename/list**——SafeManager D2 三段式写与体检清理面的完整 adapter 消费面）+ FakeApp（metadataCache.trigger no-op）+ Platform/setIcon/requestUrl/Setting/MarkdownRenderer/Component 桩。
- `src/password-vault/fake-sim.ts`：boot（种子 + setApp + setSettingsProvider）+ openPanel；securityMode=false（演示期关窗不上锁）。
- **演示库离线生成**：`.scratch/gen-pwv-entry.ts`（不入 git）以真 SafeManager + MockVault 在 node 跑真加密链（主密码 `demo`），产出 `prototype-data.js`（`window.PWV_DATA`：`.safe.enc` 清单 + contentRef 密文镜像）。**密文直写幂等 → 双 iframe 同时种子无竞态**（优于运行时种衣），锁屏以「输入主密码」态打开，解锁安全机制（冷却/首设确认）真码运行。演示数据 9 平台 15 账号全合成（demo@bz.dev 等），不含真实凭据。

### 3. 评审壳与登记

- `prototype.html` 双 iframe（1200px 桌面 / 396px 移动）+ `?selftest=1` 自检 26 断言（CSS 链生效/锁屏/解锁/平台聚合/详情/眼睛/添加弹窗生成器预填/右键菜单删除确认链/搜索展平/移动端全流程）。
- 假层经验证需补齐 Obsidian DataAdapter 的 `mkdir`/`rename`/`list`——**adapter 消费面以 SafeManager 全文枚举为准**，逐个运行期报错补齐的教训记入本 ADR。
- build-preview.mjs 双清单登记 `password-vault`（PREVIEW + BEHAVIOR，第 8 域）；行为包 ~520KB。

## Options Considered

- **域 markup 换 lucide iconSpan**：视觉 1:1 是 v1 拍板底线，自绘 SVG 原样平移零风险——否决。
- **运行时种子（unlock+addItem 在壳内现跑）**：双 iframe 并发种子有密文交错风险，且依赖异步时序——否决，离线预生成密文直写幂等。
- **只做 render 单源、行为包缓办**：与「和其他域一样」的拍板不符——否决。

## 后果

- 行为单源八域：belongings/bookshelf/cinema/clipbook/favorites/home/**password-vault**/settings-panel（prototype-first.md 六域口径同步勘正，补 clipbook 漏记）。
- 迭代改 `render.ts`/`ui.ts`/`styles.css` 任一，重出对应产物 F5 即见；`settings-panel` 行为包闭包含各域 schema 的口径不变。
- 假层三坑入库：file:// 父页访问 iframe 须 `--allow-file-access-from-files`；菜单动作后 `swallowNextClick` 布防——自检后续点击须完整鼠标序列（mousedown 先行撤防）；adapter 面 `mkdir/rename/list` 缺一即写路径断。
