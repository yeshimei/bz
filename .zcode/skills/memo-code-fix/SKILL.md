---
name: memo-code-fix
description: 包仔（bz）项目里「把备忘录中代码相关的 todo 逐个修复并闭环」的工作流。读 memo.json 筛 scene='代码' → 按域/共享文件归类决定可并行集合 → 在多个 worktree 里用 cavecrew 子代理并行开发 → 主仓库串行合并 + 全量门禁 → 每项独立提交 → 写完成态回 memo.json + 仿写小橘行为流条目。用在用户提到「修备忘录」「memo 闭环」「完成一个备忘」之类语境。
---

# 备忘录代码条目修复闭环

## 项目背景

- `D:\Obsidian\bz` 主仓库；vault 数据在 `E:\Obsidian\叫我包仔\`
- 命令：`pnpm test` / `pnpm exec tsc --noEmit` / `pnpm run build`（同步 E 盘 + 仓库根）
- 并发 worktree 跑测试设 `BZ_TEST_MAX_WORKERS=8` 限流
- 架构铁律（AGENTS.md）：依赖 core ← state ← parser ← store ← ui ← main；命令 `bz-<域>-<动作>`；类名 `bz-` 前缀；样式源头 `src/<域>/styles.css`
- 兼容冻结：数据格式（`CONFIG/STORAGE/*.json`、`我的/*`、frontmatter）/ 文案 / 公式 / 已知缺陷一律不改
- worktree 目录 `../.dsh-worktrees/work-<n>`；分支 `worktree/<n>`
- 子代理分工（cavecrew）：`investigator` 调研 / `builder` 改 ≤2 文件 / `reviewer` 审 diff；跨 3+ 文件主代理自己写

## 流程

```
0. 主仓库对齐基线（git pull --ff-only + 干净工作区）
1. 读 memo.json 筛 scene='代码' 且未完成 → 待修复
2. 一次性调研 + 归类（cavecrew-investigator 多个并行）
3. 按归类结果建 worktree（每个并行集合一个）
4. 每个 worktree 跑 调研→改→审→tsc→test→commit
5. 主仓库串行合并（合并一次跑一次 test+build）
6. 主仓库补 spec/issues/PROGRESS/ADR/CONTEXT 文档
7. 清理 worktree（worktree remove + branch -d；勿 -D）
8. 闭环：memo.json 写 completed + smartcat-behavior.json 仿写 beh_ 条目
9. 报告
```

## 归类判定（Step 2 关键）

| 情形 | 处理 |
|---|---|
| 跨域 + 无共享文件 | **并行**（首选） |
| 同域 + 无共享文件 | 并行 |
| 同域 + 共享文件 ≥ 1 | **串行**（同 worktree 多 commit） |
| 跨域 + 共享文件（`main.ts` / `settings.ts` 等） | 共享文件先做，其余等合并后并行 |
| 涉 vault 数据格式 / 新增 ADR | 必串行 |

返回「并行组」列表。worktree **不要**改 `spec.md` / `issues/` / `PROGRESS.md` / ADR（多 worktree 抢同文件必冲突）——这些留给主代理最后统一写。

## worktree 流程

```bash
# 建
mkdir -p ../.dsh-worktrees
for n in <并行组编号>; do
  git worktree add ../.dsh-worktrees/work-$n -b worktree/$n master
  (cd ../.dsh-worktrees/work-$n && pnpm install)
done

# 各 worktree 内：tsc + BZ_TEST_MAX_WORKERS=8 pnpm test + commit
# **不跑 build**（最后主仓库跑一次）

# 主仓库合并（串行，每合一个跑一次 test+build）
git merge --no-ff worktree/$n
pnpm exec tsc --noEmit && BZ_TEST_MAX_WORKERS=8 pnpm test
pnpm run build

# 清理
git worktree remove ../.dsh-worktrees/work-$n
git branch -d worktree/$n   # 未合自动拒绝；勿 -D
```

## 闭环安全模式（Step 8 关键）

⚠️ **写 vault 数据前**确认 Obsidian 没运行（`tasklist //FI "IMAGENAME eq Obsidian.exe"`）。在跑时插件的内存态会在 30s tick 落盘覆盖磁盘改动——154–159 收尾时丢过数据。让用户先重载插件（禁用再启用 bz）再做闭环。

每条 ticket 合并后：

```python
# memo.json
memo[i]['completed'] = 'YYYY-MM-DD HH:mm:ss'
```

```json
// smartcat-behavior.json
{
  "id": "beh_<ms>_<rand9>",
  "timestamp": "<ISO-UTC-Z>",
  "type": "completed",
  "source": "memo",
  "description": "memo:completed <标题>",
  "metadata": { "entityType": "task", "action": "completed", "name": "<标题>" }
}
```

行为流 `description` 走 `smartcat/behavior-wording.ts` 的「task → memo alias」模板出**人话**（「你完成了备忘录『X』」），**不写机读 `memo:completed X`**。`smartcat.json` 的 `lastUpdated` 同步；累计计数**别动**（插件自己算）。

## 决策树

```
N 条代码备忘
  ↓ Step 2 归类
  ├─ 全独立 / 跨域无共享 → 1 worktree 串行
  ├─ 跨域无共享 = K 组 → K worktree 并行
  └─ 涉共享 → 共享先 1 worktree，其余等合并
  ↓
worktree 内 cavecrew 调研/改/审 + 门禁（无 build）
  ↓
主仓库串行合并 + 文档统一收尾 + 重测重构建
  ↓
清理 + 闭环
```

## 易错

- worktree 内写 spec/issues/PROGRESS → 合并必冲突
- 同域共享文件拆多 worktree → bz 域内交叉多，合并不了
- 每 worktree 跑 build → 浪费 4min×N
- 并发跑测试不设 `BZ_TEST_MAX_WORKERS=8` → CPU 互拖
- `-D` 强删未合 worktree 分支 → 丢 commit
- Obsidian 在跑时写 vault → 内存态覆盖磁盘
- 行为流写机读 `memo:completed X` → 失去 wording 模板的人话渲染
- commit 不带 ticket 编号 → 追溯断

## 关联 skill

`implement` · `tdd` · `resolving-merge-conflicts` · `caveman-commit` · `cavecrew` · `wayfinder`
