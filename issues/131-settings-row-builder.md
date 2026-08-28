# Ticket 131（定稿·待实施）：声明式设置页 + 通用设置组 + 流程框声明（ADR-0064）

- 状态：定稿（2026-08-27 grill-with-docs 拍板 Q1–Q18；原「提案」的想法 A/B 口径经本轮升格与扩展）
- 域：core/settings（跨域）
- 来源：想法 A（行构建助手）/ 想法 B（通用设置组分发）经 grilling 升格为「全页声明式 schema + 流程框声明」
- 关联：`src/core/settings-modal.ts`（外壳/分组卡片/焦点/ESC，收编为渲染器基座）、`src/core/path-picker.ts`（path 行复用，ADR-0061）、`src/main.ts`（textSetting/toggleSetting 退役）、`src/core/confirm.ts`（退役并入）、13 个域设置弹窗 build

## 拍板清单（Q1–Q18）

| # | 决策 |
|---|---|
| Q1/Q12 | **全页声明式 schema**，对象字面量书写（builder 链式否决）；域只声明「有什么设置」，core 渲染器统一构建 |
| Q13 | `openSettingsModal` **只收 schema，build 回调入口退役**；custom 插槽行是唯一非常规内容出口 |
| Q2/Q9/Q15 | 覆盖 **13 域设置弹窗 + 主设置页 + UP 名单管理弹窗**；UP 弹窗 = schema 内容经 `renderSettingsInto` 渲染进**自建 overlay**（z 序与叠加行为零变化；不换 openSettingsModal 承载——单例 toggle 语义会顶掉底层剪藏设置弹窗） |
| Q16/Q18 | **流程框声明**：新增 `{ title, message, actions }` 声明式流程弹窗；**core/confirm 退役**，全部 23 处调用点（15 文件：encrypt×4、diary×5、review×3、secondbrain×2、library×2、attach/clipping/favorites/movie/quiz/password/memo 各 1）全量改写；`__shared_confirm_*` id/类名与双按钮 DOM 契约保持（铁律 3） |
| Q17 | encrypt 仅迁 ⚙️ 设置弹窗（本就在 13 域内）；主密码/体检清理/预览窗为流程展示型（零持久化设置项）不动 |
| Q4 | **键直绑 + 回调逃生口**：`{ key }`（keyof BzSettings 收窄）自动读值落盘（text 防抖 800ms/失焦/回车、toggle 即时——现 textSetting 语义收口 core）；外部数据（news.json 等）用 `{ get, set, save }` 三函数；特殊逻辑 `onChange/onCommit` 回调 |
| Q5 | 行类型十类：toggle / text / path / select / slider（基准五类）+ **custom 插槽 / button（actionRow 豁免组徽标）/ info / number / textarea** |
| Q6 | **visibleWhen 声明式联动**：行/组声明条件，任意行变更后 core 统一重求值，`.bz-setting-hidden` 显隐 + `refreshSettingsGroupCounts` 徽标刷新一并收口 |
| Q7/Q10 | 通用设置组首批：**「移动端默认全屏」11 键收敛**、**批次数数字行**（diary/article/movie）、**排序/默认筛选下拉**；**warnReload 一次性提示收敛为 text 行 onCommit 内置语义**（movie/password/encrypt/secondbrain 四处手写退役） |
| Q11 | favorites/belongings **统一为分组卡片**（现平铺 + 默认宽 400 → 组头 + 向 520 看齐；视觉变化已拍板接受） |
| Q3 | 迁移 = **一次性全量单提交**（实施时域逐个替换自验，最终单 commit 落地） |
| Q8 | ticket 100 文案规范（标题 4-8 字零符号、描述 20 字上下）= **测试期 lint**（对全量 schema 断言，违反即测试红；不改运行时行为） |
| Q14 | 清理：main.ts 私有 helper 退役、diary/pomodoro/library 等域内闭包工厂退役、styles.css 旧分页 `.bz-tab-*` 死类 grep 确认零引用后删 |

## 落地面

- 新增 `src/core/settings-schema.ts`（渲染器 + 类型）、`src/core/settings-common.ts`（通用组预设）；`settings-modal.ts` 外壳/分组卡片/焦点管理/ESC 逻辑原样收编为基座。
- 渲染器统一职责：分组卡片 + 项数徽标回填、防抖落盘、visibleWhen 重求值、路径行复用 path-picker（ADR-0061）、移动端两行式标注、空态。
- 主设置页「AI」「数据存储路径」两区块同套 schema；数据键格式零变化（铁律 1）、DOM 契约不破（铁律 3）、行为与文案零变化。

## 验收标准

- a) 渲染器数据层 + UI 层测试 + smoke 同步；文案 lint 测试落地；
- b) 13 域弹窗全量 schema 化，`openSettingsModal` 无 build 调用方残留；
- c) 主设置页两区块 schema 化，main.ts 旧 helper 删除；
- d) 通用组首批迁入完成，「移动端默认全屏」11 键行为文案零变化；
- e) UP 名单弹窗 schema 内容 + 自建外壳，z 序不变；
- f) confirm 退役，23 处调用点全走流程框声明，`__shared_confirm_*` 契约保持；
- g) favorites/belongings 分组卡片统一；`.bz-tab-*` 死类清理；
- h) 全量测试绿 + tsc + 构建通过；单提交落地。
