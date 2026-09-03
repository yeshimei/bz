# 186 — 设置面板打磨（AI 独立域 / 徽标口径 / 浅灰分组卡 / 行对齐）

## 背景
用户对设置面板（ADR-0080）四点反馈：① AI 设置项埋在「全局」域内部，层级不对；② 左侧列表徽标显示的是分组数不是设置项数，语义不符合直觉；③ 右侧分组卡白底在浅色面板上缺乏区块感；④ 子项（剪藏本「智能分组→自动摘要」等 isChild 行）26px 左缩进与 custom 行（AI「模型名称」等内嵌原生 Setting 行）双重 10px 缩进破坏左缘对齐。

## 用户拍板决策（2026-09-04）
1. **AI 独立成域**，放在「通用」（原「全局」）下面；「全局」改名「通用」。
2. **列表徽标 = 设置项总数**，不是分组总数。
3. **右侧分组卡背景改浅灰色**。
4. **全部行左缘对齐**：isChild 子项不缩进；custom 行（模型名称等）也不缩进；设置面板所有域页面统一。

## 变更
- **core/settings-main-schema.ts**：拆出 `aiSettingsSchema()`（AI 组）与 `generalSettingsSchema()`（数据存储路径组）；`mainSettingsSchema()` 重组为两者拼接——⚙️ 原生设置页（main.ts BzSettingTab）两区块零变化。
- **settings-panel/ui.ts**：
  - DOMAINS：`global` 改名「通用」（desc「存储路径等跨域基础偏好」），其后插入 `ai` 域（sparkles，「AI 服务商与模型配置」）；loader 对应 schemaLoaders.general/.ai。
  - 新增 `visibleItemCount(schema)`：组级/行级 visibleWhen 求值过滤（异常保守视为可见）+ button 操作行不计（与分组卡「N 项」徽标同口径）；preloadAllBadges / renderDomain / openMobileDomain 徽标回填统一改此口径。
- **settings-panel/styles.css**：
  - `.bz-sp-group` 背景 `--bz-surface-2`（亮色白）→ `--bz-surface-0`（亮色 #f2f2f4 浅灰；暗色为更深区块）。
  - 删 `.bz-sp-set-row.child { padding-left: 26px }` 与 custom 行 hover 豁免规则。
  - custom 插槽作用域重绘 `.setting-item` padding `9px 10px` → `9px 0`（外层自绘行已有 10px 内距，归 0 消双重缩进）；hover 改透明统一由外层自绘行上色（hover 矩形恢复满行宽）。
- **renderer.ts**：isChild 行保留 child 语义类，仅显隐联动不缩进（注释同步）。

## 兼容性
- ⚙️ 原生设置页、各域 ⚙️ 弹窗（core 渲染器本就无缩进）零变化；数据键零迁移；AI 域与通用域共用以 aiGroupRows 为单一事实源的行定义。
- 左列表可见域 15 → 16（新增 AI）；activeDomainId 默认仍 'global'（id 不变仅显示名改）。

## 测试
- tests/settings-panel.test.ts：徽标口径断言（通用 1 / AI 4 / 待办 9 / 归物本 ·）、nav 索引与图标移位、默认域=通用（1 组）+ 点 AI 域渲染、AI 域 per-provider 用例先切域、分组卡图标分域断言、桌面/移动列表 16 项、移动端设置项搜索点 AI 域填缓存。
- 门禁：vitest 全量 3693 绿（1 例 encrypt/vault-ui 基线时序 flake，单独重跑两次均绿）+ tsc 0 错 + diff 自审 + 主仓构建部署。
