# issue-183：保险箱 × 保险库合并为统一「保险库」

- ADR：`docs/adr/0085-vault-merge-encrypt.md`
- 分支：feat/vault-merge
- 关联：ADR-0015 / 0017 / 0078 / 0080

## 范围

把 encrypt（保险箱：加密笔记/日记容器）+ password-vault（保险库：密码工作台）合并为一个统一「保险库」：

1. 主面板升级为三资产三栏工作台（P1 资产档案库视觉：密码=金/加密笔记=松石/加密日记=靛蓝 + 概览 hero + 印章锁屏）。
2. 单命令 `bz-encrypt-open`（名「保险库」）；删 `bz-password-vault-open`。
3. password-vault 代码并入 encrypt 域（数据层 vault-data.ts + UI 密码视图 + 样式），删除 src/password-vault/。
4. 设置面板删「密码本」条目，保险库条目收纳生成/安全/存储/预览/移动端组。
5. 状态栏/首页磁贴/文案统一「保险库」。

## 验收

- [ ] `bz-password-vault-open` 不再注册；`bz-encrypt-open` 名称「保险库」。
- [ ] 打开保险库：锁屏 → 三栏工作台，三资产各自可查/可操作（密码增删改查/复制/收藏、笔记预览/还原、日记预览/还原/销毁）。
- [ ] 概览视图三资产计数正确；体检覆盖三类资产。
- [ ] 加锁当前笔记 / 状态栏解锁态 / 设置面板保险库条目正常。
- [ ] 全量门禁绿（pnpm test + tsc --noEmit）；构建产物更新。
