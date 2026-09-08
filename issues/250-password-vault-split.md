# 250：密码本自统一保险库拆回独立域（第一步：git 历史恢复）

- 日期：2026-09-09
- ADR：`docs/adr/0109-password-vault-split-back.md`（取代 ADR-0085 的单命令/单面板结论）
- worktree：`password-vault-split-250`

## 目标

用户拍板密码本与保险库重新分开。第一步：把密码本从 git 历史恢复为独立域，基准 = ADR-0085 合并前最后一版（`3a32f65e`，ADR-0078 五版原型评审后的 v1「保险库」成型版）。encrypt 面板本体本轮不动（密码资产视图暂存，同库事件互通）；摘除留下一步。

## 改动清单

- 恢复 `src/password-vault/`（index/data/ui/styles/settings）+ `tests/password-vault/`（data/ui），仅 data.test 一处 import 随 crypto 迁 core 修正
- main.ts：`bz-password-vault-open`「密码本」注册 + onunload 卸载链
- core/domain-icons：`password-vault: 'key'`
- build-css SOURCES：补域 styles
- settings-panel：新增「密码本」域条目（工具组）；encrypt schema 摘「生成」组（防两域重复行）；fake-sim 补三键种子
- home/shared：恢复 `vault` 磁贴（id 沿用合并前，旧钉选复活；彩点金 `#c9a227`）+ ICON_KEY 映射
- 测试硬索引同步：settings-panel 17→18（桌面 nav/列表 + 移动两处）、review-fix-b iconOf 13→14 + 异名映射补 vault、smoke 31/32→33 处口径、命令白名单 + 图标一致性表

## 门禁

- pnpm test 全量 4177/4177 绿；tsc --noEmit 干净；自审 + diff 审查过；主仓构建部署
