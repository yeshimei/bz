# ADR-0079：密码本数据新增 fav 收藏字段

日期：2026-09-04 ～ 状态：Accepted ～ 关联：ADR-0078、grilling 会话 2026-09-04

## Context

原型 v1「保险库」带「已收藏」视图 + 条目 ★ 收藏 + 平台行 ★ 徽标。仓库数据格式铁律 1：条目 7 字段（id/platform/url/account/password/note/createdAt），无 fav。用户拍板（Q5）：**新增 fav 字段，收藏功能落地**，且新域与旧密码本共享同一数据源（保险箱 password-vault SafeNote）。

## Decision

- 条目新增 `fav: boolean`（收藏标记），旧 7 字段数据缺失时 load 归一化默认 `false`（兼容性冻结不破坏：旧数据直接可读，行为不变）；
- fav 随整表 JSON 落盘（保险箱 SafeNote 内），与密码同加密；
- 收藏语义：平台聚合视图的「已收藏」= 含任一 fav 账号的平台；★ 徽标/按钮 = 该平台/该账号收藏态。

## Options

- **O1 收藏存 localStorage（不入加密数据）**——❌ 收藏与数据分离，导出/迁移丢失，且与「数据即加密」语义矛盾
- **O2 不加字段、去掉收藏功能**——❌ 原型核心交互（收藏视图/★）丢失
- **O3 新域独立数据存 fav**——❌ ADR-0078 已定共享数据源，fav 必须随共享整表

## Consequences

- 旧数据（无 fav）load 后自动补 false，无需迁移脚本；
- 旧密码本域代码不感知 fav（其增删改走 updateNotePayload 整表覆盖，fav 字段被保留——不会丢）；
- 保险箱面板/旧密码本不显示收藏，但数据完整。
