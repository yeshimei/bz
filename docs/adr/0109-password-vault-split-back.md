# ADR-0109：密码本（password-vault）自统一保险库拆回独立域

- 状态：已采纳
- 日期：2026-09-09
- 关联：ADR-0085（统一保险库合并，本 ADR 部分取代其「单命令/单面板」结论）、ADR-0078（密码本 UI 重构为独立保险库域，恢复基准）、ADR-0079（fav 字段）、ADR-0015/0016/0017（共享加密清单/平铺密文/加密日记）、ADR-0004（命令裸注册三段式）
- 票：`issues/250-password-vault-split.md`

## 背景

ADR-0085 将 password-vault（密码本 v1 金色三栏工作台）并入 encrypt 成为统一保险库三资产面板。使用后用户拍板**重新分开**：密码本与保险库各回各域。本轮为拆分第一步——把密码本从 git 历史恢复为独立域；恢复基准 = ADR-0085 合并前最后一版（提交 `3a32f65e`，ADR-0078 五版原型评审后的 v1「保险库」成型版，桌面三栏 + 移动端列表/详情/FAB + 自绘菜单/抽屉/确认/toast/金色印章锁屏），即「做过原型设计并修改过很多遍最终成型」的那一版。

encrypt 侧合并后已累积大量后续演进（快速取密/防偷看/体检真实化/D2 写路径收编/外观组/组件库接入），整体回退风险大且未拍板细节，**本轮不动 encrypt 面板本体**：统一面板的密码资产视图暂存（两套 UI 同库共存，事件总线双向同步，无数据分叉）；密码资产自 encrypt 面板摘除留待下一步单独拍板。

## 决策

### 1. 域恢复：`3a32f65e` 版原样回植

- `src/password-vault/`（index/data/ui/styles/settings 五件）自 `9c3ba392^` 逐字恢复；仅 data.test.ts 一处 import 随旧密码本域退役（`src/password/crypto` → `src/core/crypto`）修正。
- 数据层零改动零迁移：仍共享保险箱 `kind=password-vault` SafeNote（同一主密码/解锁态，ADR-0078 数据模型原样）；`encrypt/data.ts` 的 `encrypt:changed`/`encrypt:unlock-changed` 广播合并后一直保留，双向同步自动成立。

### 2. 入口接线（对齐现状命名，不与 encrypt 撞名）

- 命令 `bz-password-vault-open` 恢复注册，**显示名定「密码本」**（「保险库」名已归 encrypt 域；面板内 UI 文案保持成型版原样未改）。
- `core/domain-icons.ts` 收敛入表：`password-vault: 'key'`。
- home 磁贴恢复（id 沿用合并前 `vault`，旧 home.json 钉选自动复活；副题「密码与密钥」；彩点金色 `#c9a227` 呼应 v1 品牌色）。
- build-css SOURCES 补 `src/password-vault/styles.css`（域样式聚合）；onunload 卸载链补 `unloadPasswordVault`。

### 3. 设置面板

- 新增「密码本」域条目（工具组：番茄钟/保险库/**密码本**/小橘陪伴猫），schema = 恢复的 `passwordVaultSettingsSchema`（生成：passwordCharset/passwordLength + 安全：securityMode，全为既有全局键，值零迁移）。
- encrypt schema **摘除「生成」组**（避免两域重复行）；「安全」组维持 ADR-0085 统一双键 OR 读/双写不动——共享锁语义下双键本就同值。
- 已知不对称（有意保留，记录在案）：密码本页安全开关只写 securityMode（管密码本自锁）；保险库页统一开关双键齐写（管两端）。

### 4. 兼容

- 命令/磁贴/设置键均为恢复既有 id 与键，无破坏性变更。
- settings-panel/home 相关计数硬索引（17→18、iconOf 13→14、smoke 31/32）逐处同步并留演进注释。

## Options Considered

- **连同 encrypt 密码资产一并摘除（一步到位）**：encrypt ui.ts 合并后改动面大（外演进十数包），无原型拍板下盲拆风险高——否决，拆两步走。
- **恢复更早的旧密码本域 `src/password`（灰阶单列卡）**：那是 ADR-0078 明确推翻的旧 UI，用户要的是成型版——否决。
- **新建域复刻 v1 视觉**：成型版源码就在历史里，逐字恢复即最小 diff——否决重写。

## 后果

- 两套密码 UI 并存（密码本独立面板 + 保险库统一面板密码视图），同库事件互通；用户短期可任选入口，下一步摘除 encrypt 密码资产后收敛为单入口。
- password-vault 域不属「行为单源六域」，本轮按恢复原样交付，不新增单源改造。
- spec.md 密码本段补 story 22；CONTEXT.md 保险库词条与域表同步。
