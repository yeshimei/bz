# ADR-0064：设置页声明式 schema + 通用设置组 + 流程框声明

- 状态：采纳（2026-08-27 grill-with-docs 拍板 Q1–Q18，ticket 131 定稿；原提案「行助手 + 组分发」升格）
- 关联：ADR-0009（设置所有权：全局设置页 + 域设置弹窗）、ADR-0061（路径选择器 + 移动端两行式）、ADR-0019（移动端默认全屏）、ticket 100（设置项文案规范）

## 背景

调查基线（2026-08-27）：13 个域设置弹窗全部手写 Obsidian `Setting` 链；行级工厂存在四套互不共享的本地复制（`main.ts` 私有 textSetting/toggleSetting、`pomodoro/ui` 闭包 numSetting/toggleSetting、`library/ui` field 名驱动工厂、`diary/ui/panel` 模块级三件套）；「移动端默认全屏」toggle 块 13 处几乎逐字复制；warnReload 一次性提示在 movie/password/encrypt/secondbrain 各自重复实现；`s.xxx = v; await saveSettings()` 写回样板上百次。另 `core/confirm`（79 行手搓 DOM）有 23 处调用点（15 文件）。语义模式完全一致、代码零共享——新增/调整一个设置项要在多处抄样板，样式与行为统一靠人肉纪律。

## 决策

1. **全页声明式 schema（唯一渲染路径）**：域设置界面 = 对象字面量声明（分组 + 行数组 + 联动条件），core 渲染器统一构建（`src/core/settings-schema.ts`；`settings-modal.ts` 外壳/分组卡片/焦点/ESC 收编为基座）；`openSettingsModal` 只收 schema，**build 回调入口退役**；`renderSettingsInto(容器, schema)` 支持渲染进任意容器（主设置页、UP 名单管理弹窗的自建 overlay）。
2. **绑定 = 键直绑 + 逃生口**：行声明 `key`（keyof BzSettings 收窄）自动读值与落盘（text 防抖 800ms/失焦/回车、toggle 即时——现 textSetting 语义收口 core）；外部数据（news.json 等）用 `{ get, set, save }` 三函数绑定；特殊逻辑走 `onChange/onCommit` 回调。
3. **行类型十类**：toggle/text/path/select/slider（path 复用 ADR-0061 选择器）+ custom 插槽（render 回调，非常规内容唯一出口）/button（actionRow 豁免组徽标）/info/number/textarea。
4. **visibleWhen 声明式联动**：行/组声明条件函数；任意行变更后 core 统一重求值，显隐 + `refreshSettingsGroupCounts` 一并收口。
5. **通用设置组**：跨域同构项 core 定义一次、域一行挂载（`src/core/settings-common.ts`）——首批「移动端默认全屏」（11 键收敛）、「批次数数字行」、「排序/默认筛选下拉」；warnReload 收敛为 text 行 onCommit 内置语义。
6. **流程框声明**：`{ title, message, actions }` 声明式流程弹窗；**core/confirm 退役**，23 处调用点全量改写；`__shared_confirm_*` id/类名与双按钮结构 DOM 契约保持（铁律 3）。
7. **视觉与文案统一**：favorites/belongings 从平铺 + 宽 400 统一为分组卡片（视觉变化用户拍板接受）；ticket 100 文案规范以测试期 lint 对全量 schema 断言。
8. **迁移**：一次性全量单提交（实施时域逐个替换自验缓冲）；设置键格式零变化（铁律 1）。

## 备选

- **行级助手 + 通用组分发**（ticket 131 原想法 A/B）：改造小但域仍手写组装流程，「快速构建」收益有限——升格为全页 schema。
- **builder 链式 API**：表达力相同但本质仍是代码，lint/测试需遍历产物——对象字面量胜出。
- **保留 build 回调逃生门**：两入口并存永留第二套写法——custom 插槽已覆盖非常规内容，退役。
- **UP 名单弹窗换 openSettingsModal 承载**：单例 toggle 语义会顶掉底层剪藏设置弹窗（现 z 10101 叠于 10050 之上）——保留自建外壳，仅内容 schema 化。
- **流程框维持 core/confirm 现状**：confirm 已是传参式声明，但外壳与设置体系两套——用户拍板全量改写并入统一渲染原语。

## 后果

- 新增/调整设置项 = 在域 schema 里写一行声明；全站设置与流程 UI 的行为（防抖/落盘/联动/焦点/ESC/移动端布局）只存在 core 一处口径。
- 渲染器成为全站设置 UI 单点：回归风险集中，以数据层 + UI 层测试与文案 lint 对冲。
- confirm 退役 23 处改写属机械改造；DOM 契约保持使外部依赖（铁律 3）不破。
- favorites/belongings 视觉有可感知变化（获得分组卡片与更宽弹窗），已拍板接受。
- encrypt 流程型弹窗（主密码/体检清理/预览窗）明确不在声明体系内，保持现状。
