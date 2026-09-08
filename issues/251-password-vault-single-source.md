# 251：密码本接入原型 × 插件三层单源（行为单源第八域）

- 日期：2026-09-09
- ADR：`docs/adr/0110-password-vault-single-source.md`
- worktree：`password-vault-single-source-251`

## 目标

用户拍板密码域改成和其他域一样的单源架构（样式/渲染/行为与原型共用一份源码）。参照 clipbook 范式（issue 247）执行，域 UI 视觉/行为保持 v1 成型版零变化。

## 改动清单

- `src/password-vault/render.ts` 新增：ui.ts 全部 markup 平移（骨架/锁屏/弹层/行卡/空态族），纯度契约（esc 白名单 + data type-only）；ui.ts 零模板串，公共面 relTime/colorOf 再导出
- `src/password-vault/fake/fake-obsidian.ts`：FakeVault + adapter 完整消费面（read/write/exists/remove/mkdir/rename/list——三段式写与体检清理）+ 各类桩
- `src/password-vault/fake-sim.ts`：boot/openPanel/unload；演示库主密码 demo（securityMode=false）
- `src/password-vault/prototype-icons.js` / `prototype-data.js`（node 真 SafeManager 加密链离线生成，gen 脚本在 .scratch 不入库）
- `src/password-vault/prototype-view.html` / `prototype.html`：双 iframe 评审壳 + selftest 26 断言
- `scripts/build-preview.mjs`：PREVIEW/BEHAVIOR 双清单登记 password-vault（第 8 域）；产物入 git
- 文档：prototype-first.md 六域口径勘正为八域（补 clipbook 漏记）+ AGENTS.md 铁律 5 同步

## 门禁

- 域测试 21/21 零改动通过（DOM 产物逐字一致）；全量 4177 绿 + tsc 干净
- CDP headless 评审壳自检 `SELFTEST OK 26/26`（CSS 生效断言/两端流程/删除确认链/搜索展平）
