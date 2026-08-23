# 通宵流水线状态锚（崩溃恢复用——任何一轮新会话先读我）

Goal: goal-121e62ac-7760-40b2-909e-b9e359b6441b（armed, maxRounds=30）
基线 master: 6419c06（含 087 H4 / 088 H5）
门禁协议: npm test --maxWorkers=4 全绿 + npx tsc --noEmit 0（默认并发下 library-source/memo-action 时序用例已知抖动，单文件重跑绿即非回归）

## 波次计划与状态

- [运行中] W1-091 方向六 特质归因 → worktree `trait-attribution`，代理 315238c1
- [运行中] W1-092 方向二 洞察版本化 → worktree `insight-versioning`，代理 747d5e30
- [票备] W2-093 方向三+七 缺席状态机 → issues/093（已适配：不碰 trust 降温，090 PARKED）
- [票备] W2-094 方向八 关系史 → issues/094（已适配：正性事件从记忆流白名单派生，089 已砍）
- [票备] W3-095 方向四 心情门控 → issues/095
- [票备] W4-096 方向一 多路召回含 H3 前置 → issues/096（必须最后实现）
- 全部票据在 .scratch/memo-suite-plugin/issues/091~096

## 派发规则（后续轮次照此）

- 每波 ≤2 并行；W2 两票都动 index.ts，若 W1 合并未完成则 W2 串行派发
- worktree 名 = 分支名，从当时 master HEAD 建；manifest.json 同步登记；npm install 后台跑
- 子代理提示词模板见本轮历史：必读=票据+AGENTS.md；工程事实=exFAT pwsh 写盘/
  git -c safe.directory 双参/H4 继承/flake 协议/兼容冻结；汇报 ≤15 行

## 已拍板排除项（勿复活）

- 089 里程碑 REJECTED / 090 动力学 PARKED / 方向五 搁浅

## 每票完成后的固定动作（主线执行）

1. git merge <branch> --no-edit（冲突按「两边拼接」+ 验括号）
2. 门禁（maxWorkers=4）→ 构建产物验证特征串（显式 UTF8 读 main.js）
3. 删该 worktree（git worktree remove --force + prune + manifest.json 同步）
4. 勾掉本文件对应项、写一行结果

## 恢复协议（模型请求失败/上下文压缩后）

- 本文件 + 票据文件是唯一事实源；worktree 里未合并的提交照常可合并
- 子代理若失联：list_agents 查状态 → 无产出则重开 worktree 重派（票还在）
- 开放设计点一律取 v4 默认值并在票据标注「晨起可调」，不阻塞

## 晨起待办（给用户）

1. 审各票 diff；开放默认值可调
2. vault 里 smartcat.json.bak-smoke 冒烟备份确认后可删
3. AGENTS.md worktree 段改写 + 主仓 3 个脏文件（AGENTS/.gitignore/package.json 改名 bz）仍未提交——待用户拍板