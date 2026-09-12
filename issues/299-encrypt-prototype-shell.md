# issue-299：保险库接入行为单源评审壳 + 面板评审改动

- 分支：proto/encrypt ｜ worktree：proto-encrypt ｜ 日期：2026-09-12
- 关联：ADR-0085（三资产合并）/ ADR-0104（渲染单源）/ ADR-0106（行为单源）

## 背景

保险库（encrypt）在原型侧**缺席**：`prototypes/` 下只有 password-vault 壳与 `encrypt-lab/`
静态设计稿，没有 encrypt 的评审壳——改 `src/encrypt/**` 走不了快速原型（热重载对清单外域
静默失效），任何 UI 迭代都看不见。本轮先补基础设施，随后对着壳落两轮评审。

## 范围

1. **接入行为单源**：新建 `prototypes/encrypt/`（prototype.html 双真行为 iframe + view +
   图标表 `window.VLT_ICONS` + fake 层 + fake-sim.ts）；`BEHAVIOR_DOMAINS` 登记 `encrypt`
   （无 render.ts，不进 PREVIEW_DOMAINS）；preview-live 导航补卡片。种子走**真加密链现场
   建库**（unlock 首设 → 逐篇 lockNote → lock 回锁屏；3 篇笔记 + 2 篇日记，主密码 demo），
   不引离线密文——密文格式改版时壳自动同行；双 iframe 并行种子用 `SEED_LOCK` 串行化。
2. **preview-live 热重载修复**：清单外域源码不再直接丢弃——`.ts` 能按产物 `#preview-inputs`
   反查到依赖域即重出（src/encrypt/** → 保险库行为包此前静默不更新）。
3. **共享假层 `rename` 修复**：源不存在时静默 no-op（判据 = tests/mock-vault.ts），修复
   `SafeManager.saveManifest` 三段式写在**首设**（正本尚不存在）时的抛错——现象为「输了新
   主密码仍停在设置主密码」。password-vault 壳行为包连带重出。
4. **面板评审两轮**（桌面端）：
   - 删除：顶栏副标题、详情卡三点「更多操作」、顶栏三按钮（存入/体检/关闭）、列表头
     「全部加密笔记 · N 项」；
   - 结构：搜索框下移到列表栏（`keepHead`：资产未变复用列表头，防搜索输入掉焦点）；概览
     横跨中+右（`.bz-vault-pane.is-overview`）；「立即上锁」图标与文字 flex 居中（svg 基线
     对齐根因）；
   - 文案：资产名统一「加密笔记」→「笔记」（动作短语「加密当前笔记」保留——"加密"是动词）。
   - 入口不丢：关闭=Esc/点遮罩、体检=左栏健康卡（唯一入口）、存入笔记=命令
     `bz-encrypt-lock-current-note`（`lockCurrentNote` 同落点）、行级操作=行右键菜单。

## 验收

- [x] 壳自检 `?selftest=1` 全绿（21 项，含评审改动负向断言：顶栏无按钮/无搜索框、列表头无
      标题计数、左栏文案=笔记、详情无三点、概览跨栏）
- [x] `pnpm exec tsc --noEmit` 干净
- [x] `tests/encrypt` 227/227
- [ ] 全量门禁（worktree 内 preview-freshness 假红按 stash 基线差集判据处理）
- [ ] 合并 master → 主仓 `pnpm run build` 部署
