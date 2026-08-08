# 0010 — 自研通知系统（bz 通知）替代 Obsidian 原生 Notice

## Status

Accepted（grilling 会话 + 样式演示敲定，ticket 25 实施）。

## Context

全插件 146 处通知调用（124 处 `new Notice(...)` + 22 处 `core/dom.ts` 的 `notice()` 工具，后者还带 Q3 遗留的 smartCat 气泡优先分支）散落 23 个文件。原生 Notice 的局限：纯文本、无动画、无类型语义、不可原地更新消息、无进度条、无操作按钮；smartCat 分支让 22 处通知的展示依赖外部插件，且通道分裂（favorites/library 走气泡、其余走原生）。

## Decision

**自绘通知系统取代原生 Notice 与 smartCat 通道**，实现于 `src/core/notice.ts`（自包含样式注入，不依赖 core/dom，避免循环引用；dom.ts 的 `notice()` 变更为 re-export 兼容入口）：

1. **统一通道**：全仓 `new Notice(...)` 一律改 `notice(msg, dur?)`；`notice()` 与 `notify()` 同源，smartCat 分支删除（不再让路外部气泡）。
2. **自动语义归类**：`classifyNoticeType` 按消息内容归类（`✅`/`🎉` → success、`⚠️` → warning、`❌`/「失败」「错误」 → error、其余 info），保证 146 处调用点零心智负担获得一致类型。
3. **动效自动映射**：不传 variant 时按类型选（success → pop 缩放 + 打勾描绘、warning/error → shake 抖动、info → drop 下滑）；可选变体 drop/pop/slide-left/slide-right/bounce/shake；退出动画与进入变体成对；`prefers-reduced-motion` 降级淡入淡出。
4. **布局与行为**：顶部居中，z-index 100000（最顶，盖过 Obsidian 全部 UI 层）；堆叠上限 5 条（超出挤掉最旧）；点击即关闭；时长默认 info/success/warning 3s、error 5s、显式 duration 优先；progress 类型默认不自动消失。移动端适配：`top: calc(16px + env(safe-area-inset-top))` + `max-width: min(420px, calc(100vw - 24px))`。
5. **动态能力**：`setMessage` 原地更新、`setProgress`（0-100 完成变绿 / -1 不确定跑马灯）、`setType`（progress 完成转 success 并接管自动消失计时）、富文本 title + action 操作按钮。auto-summary 与复习批量出题已改造为「进行中 → 原地更新为结果」的动态链路。
6. **去重节流（dedupeKey）**：`notify` 支持 `dedupeKey`——同键 30s 窗口内重复触发时合并更新消息（不新弹、不刷屏），供后台自动事件使用（ai-agent 同步失败/剪藏匹配失败、quiz 出题失败、favorites 余额查询失败、review 做题家降级等）。
7. **通知补白（ticket 25 增量）**：P0 数据完整性——ai-agent 同步队列失败 ❌、AI 匹配失败 ⚠️、quiz 逐篇出题失败聚合 ⚠️、review 做题家未初始化降级 ⚠️（diary 文件重建失败经核实已有上层 catch 通知，不重复）；P1 体验——quiz 生成完成 ✅（N 篇）、ai-agent 归档完成 ✅/失败 ❌、favorites 余额查询失败 ⚠️。
6. **文案规范**（一致性/通俗/简约）：成功 `✅ `、失败 `❌ `、警告 `⚠️ ` 前缀统一；删除遗留技术引用（Q3.js/QuickAdd 配置/「请检查控制台」）；冒号统一中文全角；成功消息不带感叹号；带「已」字完成态动词；「错误：」冗余前缀删除。

## Considered Options

- **保留原生 Notice + 少量美化**：不可行——无法获得动画/进度/按钮/消息更新，且 smartCat 通道分裂继续存在。
- **monkey-patch Notice 类**：侵入 Obsidian 类、与插件生命周期耦合、升级易碎，拒绝。
- **引入第三方 toast 库**：与现有主题变量/风格体系集成成本高，且本需求面窄，拒绝。
- **strict 队列（一条消失下一条进）**：密集操作时排队造成虚假卡顿，拒绝；保留堆叠 + 上限 5。

## Consequences

- 测试断言从 `MockNotice.instances` 迁移为通知 DOM 断言（`getNoticeMessages`/`hasNotice`/`clearNotices` 辅助进 `tests/mock-obsidian-entry.ts`），更接近真实渲染。
- 原生 `Notice` 不再被 src 引用（flash/notify.ts 前缀静默包装保留，内部走新通道）。
- 新代码不得再直接 `new Notice(...)`——一律走 `core/notice` 的 `notice`/`notify`。
- 演示命令 `bz-notification-demo` 保留作为样式自查入口。
