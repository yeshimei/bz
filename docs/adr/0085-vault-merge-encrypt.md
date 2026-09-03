# ADR-0085：保险箱（encrypt）与保险库（password-vault）合并为统一保险库

- 状态：已采纳
- 日期：2026-09-03
- 关联：ADR-0004（命令裸注册三段式）、ADR-0015（保险箱数据合并：kind=password-vault SafeNote）、ADR-0016（平铺点前缀密文布局）、ADR-0017（加密日记=kind=diary-entry SafeNote）、ADR-0019（移动端全屏）、ADR-0064/0080（设置 schema / 设置面板收纳）、ADR-0078（密码本 UI 切换保险库域）、ADR-0079（fav 字段）、铁律 6（UI 分层）
- 票：`issues/183-vault-merge.md`

## 背景

加密数据自 ADR-0015/0017 起已是**单一清单（`.safe.enc` manifest）承载三类资产**：普通加密笔记（kind 缺省）、加密日记（`diary-entry`）、密码条目（`password-vault`，整表 JSON 镜像）。但**对外仍是两套 UI 域并存**：

- `encrypt`（保险箱）：数据权属域，SafeManager 单例；主面板只展示普通加密笔记（按 kind 过滤掉 diary-entry/password-vault），承担加锁当前笔记/预览/体检/状态栏/密码弹窗（日记域复用）。
- `password-vault`（保险库，ADR-0078）：密码 UI 新域，金色三栏工作台；自建 `PasswordVaultDataManager` 包 SafeManager 读同一 password-vault 条目，域事件 `password-vault:changed` 与 encrypt 的 `encrypt:changed` 互相订阅重载；入口命令 `bz-password-vault-open`。
- `password`（密码本旧 UI 域）：命令/入口已断开（ADR-0078），仅 `crypto.ts`（CryptoService 被 encrypt/data.ts 依赖）仍被引用。

用户决策（2026-09 多轮拍板）：「保险库只有笔记加密，把新域保险库合并进保险箱，都放到一起，**改名保险库**」。五套原型（`.scratch/vault-ui-merge/`，不入 git）评审后选中 P1「资产档案库」方向；编码归属拍板并入 encrypt 域。

## 决策

### 1. 统一对外：一个命令、一个面板、一套术语

- **命令合并为单命令**：保留 `bz-encrypt-open`，删除 `bz-password-vault-open`（及其 main.ts 裸注册 / onunload 卸载 / home 域磁贴 / smoke 命令白名单）。
- `bz-encrypt-open` 名称改为「保险库」（icon 仍 lock）；`bz-encrypt-lock`「加密当前笔记」保留。
- 状态栏、设置面板、首页磁贴、面板标题、提示文案统一术语「**保险库**」；弃用对外称「保险箱 / 加密保险箱 / 密码本」（旧词仅保留在代码注释/历史 ADR）。
- 数据零迁移：仍同一 manifest、同一主密码、同一解锁态；`password-vault` SafeNote 不动。

### 2. 主面板：统一「保险库」三栏工作台（P1 资产档案库视觉）

encrypt 的 `UIManager` 主面板升级为三栏工作台，**一个面板承载三资产**：

- **左栏资产导航**：品牌印章 + 概览（hero 计数）+ 资产档案（密码/加密笔记/加密日记，分类色：密码=金 `#b98d3e`、加密笔记=松石 `#2e7d68`、加密日记=靛蓝 `#5a63a8`，各带计数）+ 底部体检状态卡 + 立即上锁。
- **中栏列表 / 右栏详情**：按当前资产视图渲染；密码视图沿用 password-vault 平台聚合三栏实现（平台行/账号卡/复制/收藏/编辑），加密笔记视图=原保险箱卡片流+详情（双击预览/还原/删除），加密日记视图=diary-entry 列表+详情（正文预览/还原回日记/复制正文/彻底销毁）。
- **概览视图**：3 类资产计数 hero + 三资产统计卡 + 最近加密 + 体检摘要（按 P1 原型）。
- 解锁/首设锁屏沿用 password-vault 金色印章锁屏（复用其「安全机制」文案与流程）。
- 移动端：恒真全屏 + 底部资产 tab + 分段切换（沿 P1 移动帧；密码移动详情沿用 password-vault mob 实现）。
- 密码的增删改查/收藏/复制（60s 自动清剪贴板）能力完整保留；健康扫描已覆盖全部 kind（scanHealth 无 kind 过滤，自动含密码整表镜像），体检报告/清理保留。

### 3. 数据层与依赖去向：并入 encrypt 域

- `src/password-vault/data.ts`（PasswordVaultDataManager/Entry/PlatformGroup + 事件接线）迁入 `src/encrypt/vault-data.ts`（类型前缀 `PasswordVault*` 保留以兼容既有引用，构造注入 SafeManager）；encrypt 的 Controller 持有 SafeManager 单例 + PasswordVaultDataManager。
- `src/password-vault/ui.ts` 的密码三栏 UI 逻辑并入 encrypt UIManager（密码资产视图子渲染器）；`src/password-vault/styles.css` 视觉并入 encrypt styles.css（P1 令牌层 + 三栏/锁屏/资产分类色；保留 `.bz-password-vault` 类名兜底，样式前缀 `bz-vault`/`bz-pwv` 并存收敛到 encrypt 文件）。
- encrypt 的 `index.ts`：装配 Controller（SafeManager + PwDataManager）；懒加载/状态栏/卸载接线统一。
- **删除 `src/password-vault/` 目录**；`src/home` vault 磁贴删除。
- 事件接线：PasswordVaultDataManager 写 password-vault 条目后仍广播 `password-vault:changed`（保险库统一面板订阅重载）；encrypt 写操作广播 `encrypt:changed` 订阅保留——同域内收敛为单一 reload 路径。

### 4. 设置收纳

- 删除 settings-panel「密码本」域条目（旧 `password/ui` schema 引用）；保留「保险库」单一条目 = encrypt schema + 生成/安全两组（passwordCharset/passwordLength/securityMode 沿用）。
- 移动端全屏：统一走 `encryptMobileDefaultFullscreen`（密码移动视图沿用此键）。
- 旧 `src/password/` 目录保留：`crypto.ts` 仍被 encrypt/data.ts 依赖；ui/data 成死代码但命令/测试夹具/文档仍引用旧命令 id，不做物理删除（保守，单列 ticket）。

### 5. 兼容与迁移

- 旧命令 `bz-password-vault-open` 删除属**破坏性变更**：用户已保存的命令快捷键与首页/入口页磁贴将失效——旧 launcher 磁贴存 commandId，不可用磁贴走幽灵兜底（现状）；home 域磁贴按域 id 存取，删除 vault 域后需从 pinned 中剔除（home.json 数据零迁移，代码剔除兜底）。
- 数据格式、设置键（encryptRoot/encryptPreview*/encryptSecurityMode/securityMode 等）、manifest 版本**全部不动**。

## Options Considered

- **双面板并存 + 互跳链接**：轻合并，但违背用户「都放到一起」的拍板，密码/笔记两面板仍割裂——否决。
- **新建 vault 域并弃置 encrypt/password-vault**：干净但重写面最大；encrypt 被 diary 等多处 import，需新建中转层——否决。
- **并入 password-vault 壳**：encrypt 同时承载数据层与日记依赖，翻壳成本高——否决。
- **密码视图保持独立三栏 / 并入后仅展示不操作**：用户已拍板单面板全资产操作——否决。

## 后续

- 加密日记「还原回日记」在统一面板内复用 `restoreDiaryEntry`（diary 域改分类逻辑原样接入）。
- 旧 `src/password` 目录待命令/文档清理后整体退役（单独 ticket）。
