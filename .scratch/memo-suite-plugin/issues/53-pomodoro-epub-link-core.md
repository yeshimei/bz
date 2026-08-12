# 53 — 读书联动核心（epub 检测 + 决策 + 自动开始/暂停 + 预设切换）

**What to build:** 读书联动的完整主链路：检测到 EPUB 阅读器（fork-weave-epub-reader，视图 `weave-epub-reader-standalone`，形状探测只读 filePath/bookTitle，复用黑匣子 host.ts 先例，不注册阅读器 API）打开书 → 番茄钟自动进入读书专注（target 自动挂书，path=epub 路径）；idle 时直接自动开始（后台形态，免确认）；读书专注中换书（含同视图内切书，tick 轮询比对兜底）→ 暂停旧书不计 history → 直接开始新书；关闭书 → 自动暂停（remaining/target 保留），豁免强制专注模式；重开同一本书 → 重新开始新专注（不恢复剩余）；读书模式期间自动切「阅读沉浸」预设、退出恢复读书前所选；总开关关闭 → 不注册监听全部静默；main 懒加载注册 + onunload 清理。确认弹窗场景（休息中/他处专注中/弹窗形态）留 ticket 54。

**Blocked by:** 52 — 读书预设 + 读书番茄统计 + 删书库 tab

**Status:** ready-for-agent

- [ ] 决策纯函数 `decideReadingAction`（事件×状态×设置 → 动作）：idle 打开→直接开始；换书→切新书；关书→自动暂停；重开→新专注；非读书场景关书→不动；forceFocus 组合（开书自动开始正常、关书自动暂停豁免）；confirm 场景输出占位动作留 54
- [ ] 打开 epub 书（视图激活；含 Obsidian 启动时书已打开视为打开事件）且 idle → 自动开始专注：target={type:'book', path: epub 文件路径, label: 书名}，后台形态（仅状态栏，不弹窗）
- [ ] 读书专注中换书（active-leaf-change 或轮询发现 filePath 变化）→ 暂停旧书（不计 history）→ 直接开始新书新专注，无确认
- [ ] 关闭书（视图关闭/active leaf 离开）→ 读书专注自动暂停：remaining 保留、target 保留、预设恢复读书前所选；强制专注模式开启时自动暂停仍生效（豁免），手动暂停/跳过仍禁用；非读书专注/休息/idle 关闭书 → 不动
- [ ] 重开同一本书 → 重新开始新专注（不恢复剩余时间）
- [ ] 读书模式 override：durations() 读书模式返回「阅读沉浸 45/10/20」（N 仍全局）；退出恢复读书前所选（含自定义）；读书期间手动改预设被 override 覆盖；Obsidian 重启无残留
- [ ] 总开关（pomodoroEpubAuto）关闭 → 不注册监听/无动作/不切预设；开启（默认）→ onLayoutReady 懒加载注册（ADR-0003）
- [ ] unload 清理：workspace 监听、轮询、无残留；阅读器未安装 → 静默降级（无视图可探测，无动作）
- [ ] 测试：决策表驱动全场景、检测接线 mock（workspace emit active-leaf-change + 假 reader view）、轮询兜底、override 恢复、forcePause、总开关
