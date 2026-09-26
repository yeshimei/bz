# ADR-0153 · 原生设置页退役平铺：只留「打开设置面板」按钮

日期：2026-09-16 · 关联：issue 345、ADR-0009（设置归属模型）、ADR-0080（settings-panel 面板）、ADR-0064（声明式设置渲染器）

## 背景

ADR-0009 约定全局项平铺在 Obsidian 原生设置页，此后经 issue 186/331 多轮拆组，
原生页膨胀为「服务商/模型配置/数据源凭据 + 数据存储路径 + 通知」多卡，与
ADR-0080 的 settings-panel 面板（全域设置聚合入口）内容完全重复——同一批设置
两处入口、两套渲染口径（原生 Setting vs 面板自绘组件），维护成本纯增。

## 决策

1. **原生设置页退役平铺**：`BzSettingTab.display()` 不再渲染任何 schema 设置组，
   只留一行一个 CTA 按钮「打开设置面板」，点击调 `openSettingsPanel(app)`
   （与命令 `bz-settings-panel-open` 同一入口）。设置读写链路
   （settings-provider、schema、绑定）零变化。
2. **单一入口归 settings-panel**：全域设置（AI/存储路径/通知/各域）的唯一
   浏览与编辑入口是 settings-panel 面板；原生设置页降级为纯跳转页。
3. **mainSettingsSchema 聚合器保留**：不再有 UI 消费方，留作测试与文案 lint
   的全量断言入口；面板分页各用 aiSettingsSchema / generalSettingsSchema /
   noticeSettingsSchema。

## 后果

+ 全域设置单一入口，schema 改动不再需要同步两处渲染口径。
+ 原生设置页恒定一行，不再随设置项增长膨胀。
− 习惯在 Obsidian 设置里直接改的用户多一次跳转（ADR-0080 面板已覆盖全部设置项，
  无功能损失）。
− ADR-0009「全局项留 Obsidian 设置页平铺」条款随之修订：全局项仍归全局，
  但展示入口改为 settings-panel 面板。
