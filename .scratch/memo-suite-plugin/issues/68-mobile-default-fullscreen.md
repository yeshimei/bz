# 68 — 移动端主窗口默认全屏：13 域开关 + ≤768 两态统一（保险箱更名同批）

**What to build:** 13 个有主窗口的域（日记本/备忘录/归物本/剪藏本/聚合讯/密码本/收藏本/书库/阅读报告/影视/复习计划/番茄钟/保险箱）各加一项「移动端默认全屏」开关（仅移动端显示/生效）：
1. settings.ts +13 键 `<域前缀>MobileDefaultFullscreen` + DEFAULT_SETTINGS 逐域默认值（11 开 2 关，行为保持）。
2. core 移动端窗口 helper：`isMobileEnv()` + `applyMobileWindowFullscreen(popup, enabled)`（挂/摘 `.bz-win-mfs`）。
3. styles.css：≤768 统一两态——`.bz-win-mfs` 真全屏覆写 + 13 域常规卡基规则；解除 8 处 JS 内联强制全屏 + 4 处 CSS 强制规则（原 480/640/768 断点废止）。
4. 13 域打开路径接入 helper；各域 ⚙️ 设置弹窗加一行（聚合讯/阅读报告补建 ⚙️ 入口；归物本/收藏本空弹窗变 1 项）。
5. 保险箱更名（用户可见文案 + 文档术语，命令 id/存储/历史 ADR 不动）。
6. 文档：spec.md 设置项总表、CONTEXT.md 新术语 + 更名、ADR-0019、AGENTS.md 域清单补保险箱行、PROGRESS.md。

**Status:** done

## 变更面

- `src/settings.ts`（+13 键与默认值）
- `src/core/mobile.ts`（新：isMobileEnv / applyMobileWindowFullscreen）
- `src/<13 域>/*`（打开路径 + ⚙️ 设置行；聚合讯/阅读报告补 ⚙️ 按钮）
- `styles.css`（≤768 两态 + 旧强制规则改写）
- `src/main.ts`（保险箱命令显示名）、`src/encrypt/ui.ts`（标题/⚙️/解锁文案）
- 文档：spec.md、CONTEXT.md、ADR-0019、AGENTS.md、PROGRESS.md、本 issue
- `tests/`（core/mobile + 各域 UI 用例）

## 决策要点

- 每域单开关（Q1-A）；默认值行为保持（Q2-A：原全屏→开 11、原卡片→关 2）；「默认」= 每次打开初始形态（Q3-A）；仅移动端显示/生效、桌面端不动（Q4-A）；无窗口内手动切换按钮；多窗口域一并控制；做题家/入口页排除；保险箱更名仅文案与文档。
- 统一 ≤768：开=真全屏（`.bz-win-mfs` 类），关=95%/90vh 常规卡；原 480/640/768 乱断点废止。

## 测试

- 新 `tests/core/mobile.test.ts`（5）：桌面恒不挂类 / 移动端开=挂 bz-win-mfs、关=摘、幂等 / 开关关不挂 / 空元素安全 / DEFAULT_SETTINGS 13 键默认值映射（11 开 2 关）。
- `tests/memo/ui.test.ts` +4：移动端+开挂类、移动端+关不挂、桌面不挂、设置弹窗仅移动端显示行（dataset.name 口径）。
- `tests/review/ui.test.ts` +2：showMain 挂类三态 + 设置弹窗行移动端专属。
- `tests/library/ui.test.ts` +3：主面板 --full 挂类（复用打开重挂）、读书笔记 --full-lg 挂类、设置弹窗行移动端专属。
- `tests/news/reader.test.ts` +1：⚙️ 按钮存在 + 设置弹窗行移动端专属。
- 全量 1052/1052 全绿（+15），tsc 0 错误；并行代理 471c0e1（encrypt 预览提速）先于本 ticket 提交，未混入。