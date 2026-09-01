# ADR-0078：密码本 UI 重构为独立保险库域（password-vault）

日期：2026-09-04 ～ 状态：Accepted ～ 关联：grilling 会话 2026-09-04、原型 .scratch/password-ui-redesign/v1-vault.html

## Context

旧密码本域（src/password/，ticket 60 收敛）为单列卡片弹窗、灰阶 Obsidian 变量配色。用户经五版原型（.scratch/password-ui-redesign/）评审后拍板 v1「保险库」（1Password·金色三栏工作台），并明确：

1. **UI 一比一复刻**：三栏布局、金色视觉、自绘右键菜单/抽屉/确认/toast/锁屏全部按原型推翻重做；
2. **单独开一个域**实现，与旧密码本并存、互不影响（Q10）；
3. 配色 **token 化跟随 Obsidian 主题亮暗**（Q2），金色保留为品牌强调色（类似 smartcat 皮肤例外）；
4. 交互组件（菜单/抽屉/确认）在域内按原型自绘（Q3 custom），**设置弹窗不做**（后续单独设计统计面板）；
5. 锁屏换成原型自绘（Q4 custom），但底层验证仍走保险箱 SafeManager（Q12），**完整保留**保险箱安全机制（首设风险确认、失败冷却、损坏重设、自愈提示）（Q13）；
6. 收藏 fav 字段新增（Q5）；生成器只做「生成+暂存」，字符集/长度复用全局设置（Q7）；移动端恒真全屏无开关（Q16）；不做数据管理按钮（Q15）；域总线双向同步（Q9/Q14）。

## Decision

新建独立域 `src/password-vault/`（保险库）：

- **数据**：与旧密码本共享保险箱 `kind=password-vault` 的 SafeNote（同一主密码/解锁态），数据格式铁律不破坏——新增 `fav` 字段（旧数据缺失默认 false，兼容）；
- **命令**：`bz-password-vault-open`（main.ts COMMANDS 注册，ADR-0004），旧 `bz-pw-*` 保留；
- **UI**：原型 v1 一比一（桌面三栏 + 移动端列表/详情/FAB + 自绘菜单/抽屉/确认/toast/锁屏），全部类名 `bz-password-vault-*`，视觉 token 化（`--pwv-*` 映射 Obsidian 变量 + `--interactive-accent` 作金色）；
- **锁屏**：原型视觉壳 + 底层 `SafeManager.unlock/firstTimeSetup`；保留首设两次确认+风险勾选（openFlowDialog）、失败冷却节流（1/2/4/8s）、清单损坏重设确认、自愈提示；
- **同步**：SafeManager 补发 `encrypt:changed` / `encrypt:unlock-changed` 域事件（ADR-0047 总线），新域订阅重载；新域写后广播 `password-vault:changed`（source 标记跳自重载）；
- **生成器**：只做「生成+暂存」（添加弹窗 🎲），字符集/长度复用 `passwordCharset` / `passwordLength`；
- **移动端**：恒真全屏（`.bz-password-vault-mfs`，无开关）；
- **不做**：设置弹窗、数据管理（示例/清空/导出）。

## Options

- **O1 直接改旧密码本域**——❌ 用户拍板独立域，避免与既有 pw-* 契约（DOM id/类名、右键菜单 core 组件）冲突，且新 UI 可独立演进
- **O2 完全自绘配色（固定色板）**——❌ 违反铁律 8（禁重复造轮子）与设计手册 §2（禁硬编码颜色），且与 Obsidian 主题割裂；token 化跟随主题
- **O3 新域独立数据（自建加密）**——❌ 数据分叉风险，用户要记两把主密码；共享保险箱数据 + 域总线同步更优
- **O4 锁屏砍掉安全机制**——❌ 首设风险确认/冷却/损坏重设是保险箱既有拍板的安全底线，原型视觉壳保留全部机制

## Consequences

- 旧密码本域代码不变（兼容性冻结）；新域数据与旧域共享同一 SafeNote，改动互相可见（域总线同步）；
- 新增 fav 字段：旧数据 load 时归一化默认 false；保险箱面板/旧密码本不感知 fav（写回时整表覆盖会保留 fav）；
- SafeManager 补发域事件：需确认不影响既有测试（事件为纯附加、无消费方依赖）；
- 后续「统计面板」设计时（用户计划）再接入设置入口，本 ADR 不涉及。
