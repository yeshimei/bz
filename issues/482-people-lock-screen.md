# 480 — 脸谱专属解锁屏（与脸谱面板同风格）

## Parent

`issues/460-people-face-restructure-spec.md`（spec）。门禁与工作流按 `AGENTS.md`。

## What to build

脸谱面板的解锁门现在借用保险库的解锁屏（'vault' 文案与样式，467 遗留）。给脸谱做**独属解锁屏**：视觉与脸谱面板一致（朱砂 / 折子风格），文案说脸谱的事（「联系人的卡片与聊天记录均已加密」），统计口径换脸谱档（联系人数 / 随记录附件）。

## Acceptance criteria

- [ ] `LockScreenKind` 增加 `people` 档：encrypt/ui 的 `LOCK_KIND_META` 有对应图标 / 标题 / 副文案 / 动作（「脸谱已上锁——解锁前，联系人卡片与聊天记录均以密文保存」）
- [ ] 脸谱面板的解锁门禁（467 的 `ensureSafeUnlocked`）传 `people` 档，不再走 'vault' 文案
- [ ] 解锁屏统计快照含脸谱档（解锁屏上显示的数字来自脸谱口径；锁定态回落上次快照）
- [ ] 样式与脸谱面板一致（复用 people/styles.css 主题变量；不破坏既有 vault / diary / password-vault 三档）
- [ ] 未解锁体检（checkup）跳过脸谱域的行为不变

## Blocked by

- #467（解锁门禁与保库记录）
