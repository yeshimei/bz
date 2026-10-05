# 工具坞外部脚本接入指南（dock 契约 v1）

**读者：要写一个能被 bz「工具坞」登记、运行、观测的外部脚本的 agent 或人。**

你写三件事：**一份 `manifest.json` 声明自己是谁、有哪些参数、该怎么跑；运行时按四行协议往 stdout 说话；再自己往目录里写一份运行记录。** 不 import 任何 bz 代码，bz 也不关心你脚本里是什么。

真理源：`src/dock/schema.ts`（校验）、`src/dock/declaration.ts`（文件与路径）、`src/core/external-tool.ts`（协议）、`src/dock/runner.ts`（拉起与环境变量）、`src/dock/rules.ts` + `src/dock/scheduler.ts`（规则表与自动触发）。**本文与代码冲突以代码为准**，并顺手改这里。

## 0. 四份文件，四个写者

| 文件 | 位置 | 谁写 | 内容 |
|---|---|---|---|
| `manifest.json` | 工具目录 | **你**（手写） | id / 名字 / 参数表 / 怎么跑 / 种子节奏 |
| `runs.json` | 工具目录 | **你**（运行时写） | 每次运行一条记录 |
| `data.json` | 工具目录 | **bz** | 用户填的参数值（凭据的家，不在 vault 里） |
| 登记项（含规则表、信任） | bz 数据目录的 `dock.json` | **bz** | 跟你无关 |

- **读声明不执行任何东西**，所以用户先看到命令与参数表，再决定信不信。
- 旧名 `dock.json` / `dock.settings.json` / `dock.runs.json` 读侧仍回落认，新工具一律用新名。

## 1. id

`^[a-z0-9][a-z0-9-]*$`，长度 ≤ 64。**两处必须逐字一致**：`manifest.json` 的 `id` 与 `runs.json` 的 `tool`。不符 → 记录整份被拒。

## 2. `manifest.json`

必填：`v`（**必须是 1**）、`id`、`name`（非空）。缺任一项整份拒绝。

选填（**未知字段一律保留**，前向兼容）：

| 字段 | 说明 |
|---|---|
| `description` | 展示在卡片与详情 ✅ |
| `icon` | lucide 图标名 ✅ |
| `run` | 怎么跑，见 2.1。**缺省**：目录里有 `main.mjs` 就当 `node main.mjs`；都没有 → 只能看、不能跑 ✅ |
| `params` | 参数表，见 2.2 ✅ |
| `schedule` | 种子节奏，见 2.3 ✅ |
| `weekly` 之外的 `author` / `toolVersion` / `group` / `docs` / `produces` / `runtime` / `desktopOnly` | ⚠️ 只解析，**当前无消费方** —— 别把行为押在它们身上 |

> ✅ = 面板真的用；⚠️ = 收下了但没人消费。

### 2.1 `run`

```jsonc
{ "run": { "cmd": "node", "args": ["main.mjs"] } }
```

- `cmd` 必填（空则整段丢弃）；`args` 原样传给进程，参数值**另拼在后面**。
- `cwd` 缺省 = 声明文件所在目录 → 目录搬到哪都不用改。
- `shell` 缺省按扩展名判（`.cmd` / `.bat` 自动开），可不写明。
- 约定入口只认 `main.mjs`（`.mjs` 无条件按 ESM 解析）。**python 等其它运行时必须写 `run`，bz 不猜。**

> ⚠️ **信任绑的是命令签名**（`cmd + args`），不是工具身份。改了 `run.cmd` / `run.args`，或依赖的 `main.mjs` 增删 → 旧信任作废，自动运行被拦（手动也要先在详情页重新确认）。

### 2.2 `params`

```jsonc
{ "key": "mode", "label": "模式", "type": "choice",
  "default": "fast", "options": [{"value":"fast","label":"快"}],
  "help": "…", "placeholder": "…", "required": false }
```

`key` / `label` / `type` 缺一或 type 不认识 → 该条丢弃（不连累别的参数）。同 key 只留第一个。八种类型：

| type | 控件 | 专属字段 | argv |
|---|---|---|---|
| `text` | 单行 | `placeholder` | `--key=值` |
| `multiline` | 多行 | `rows` | `--key=值`（可含换行） |
| `number` | 数字 | `min`/`max`/`step` | `--key=值` |
| `bool` | 开关 | — | `true` → `--key`（无值）；`false` → 不发 |
| `choice` | 单选 | `options` | `--key=值` |
| `multichoice` | 多选 | `options` | `--key=值1 --key=值2` |
| `path` | 文件/目录选择器 | `mode`: `file`/`dir` | `--key=路径` |
| `secret` | 密码框 | — | `--key=值`（bz 不写进记录） |

值等于 `undefined`/`null` 跳过；空串跳过（`required: true` 除外）。**参数只在启动时下发**，没有 stdin、没有运行中注入。

> **argv 的名字就是 `key` 本身，逐字**：`key: "user_id"` → `--user_id=…`，**不是** `--user-id`。下划线 key 不会变成连字符，大小写也不会动 —— 脚本里解析参数名必须**从 manifest 的 key 抄过去**，别凭语感换写法。（实例：key 写 `user_id`、脚本解析 `--user-id`，命令行手工传参时又恰好按连字符传 → 自测全绿，面板一点就「配置错误」。）

**该放参数的只有三类**：凭据（`secret`）、用户偏好、因机器而异的环境值（代理等）。**接口 URL、请求体、字段名、超时一律写死在脚本里** —— 判据一句话：用户看到这个框，能凭自己填对吗？

### 2.3 `schedule`（**只是一粒种子**）

```jsonc
{ "schedule": { "kind": "daily", "hour": 12 } }
```

bz 侧的自动化是**规则表**（3.1）：工具还没有任何规则时，bz 按这条 `schedule` 折一条种子规则。

| 你写的 | 结果 |
|---|---|
| `daily`（hour → `"HH:00"`） | 折出 `{ trigger: { kind: 'daily', at }, action: { run } }` ✅ |
| `interval`（everyHours × 60 → `everyMin`） | 折出 `{ trigger: { kind: 'interval', everyMin } }` ✅ |
| **`weekly`** | **折不出**（新模型没有「每周某天」这个触发）→ 落在手动区 ⚠️ |
| `on-demand` / `unknown` / 没写 | 折不出 → 手动区 |

用户一旦自己加了规则，规则表说了算，你日后改 `schedule` 不再影响它；bz 不回写你的 `manifest.json`。

## 3. 自动化：规则表 `触发条件 → 执行`

每个工具一张规则表，调度器一分钟一拍逐条问「现在该不该跑」（纯函数 `ruleDue`）。**有启用中的规则 = 自动化区；没有 = 手动区**（`hasActiveRule`，派生，没有第二个开关）。

| 东西 | 谁定 | 在哪定 |
|---|---|---|
| 全局总闸 `autoRun` | 用户 | 设置 → 工具坞 → 自动运行 →「启动后自动运行」 |
| 规则表 | 用户（初值来自你的种子） | 工具详情页「自动运行」块 → 添加规则 |
| 熔断恢复 | bz 自动 + 用户手动 | 详情页「恢复并重试」 |

### 3.1 触发条件

| kind | 含义 | 参数 |
|---|---|---|
| `daily` | 每天某时刻 | `at`: `"HH:MM"`（本地时区） |
| `interval` | 固定间隔 | `everyMin`: 1–43200 |
| `on-launch` | Obsidian 启动后 N 分钟，本会话一次 | `delayMin`: 0–1440 |
| `panel-open` | 打开工具坞面板时 | — |
| `tool-ok` / `tool-fail` | 指定工具成功 / 失败后 | `toolId` |
| `domain-event` | 域事件总线通道 | `channel` |
| `vault-file` | 某目录 / 某类文件变动 | `target` |
| `data-threshold` | 某 json 数值越阈值 | `path` / `key` / `op`（`>` `<` `=`）/ `value` |

- 每条规则**各自记账**（`lastFiredAt`），不共享欠账。
- `tool-ok` / `tool-fail` **指向自己会被拦**（防无限套娃）；指向别的工具是合法的联动通道。
- `data-threshold` 读不到值 → 不跑（判不出就不跑）。

### 3.2 执行

| action | 含义 |
|---|---|
| `run` | 真的拉起来跑；`notify`: `never` / `fail`（缺省）/ `always` |
| `remind` | 只发一条可跳转的通知，**不拉进程** |

`jitterMin`：到点后随机再等 0~N 分钟（错峰），缺省不抖。

### 3.3 跑之前的门槛（任一不满足就不跑）

`disabled`（停用）· `untrusted`（没信任）· **`trust-stale`（命令变了，见 2.1）** · `no-run` · `paused`（熔断）· `running` · `cooldown`（失败后 15 分钟）· `params`（`required` 参数没填，bz 会提醒一次）。

**失败处理**：15 分钟冷却 → 连续 **3 次**熔断暂停 → **一次成功**即恢复；单次超时 **10 分钟**强杀。并发恒为 1，失败不连坐。

## 4. 运行中的契约

### 4.1 环境变量（bz 注入；**不继承宿主环境**，别依赖 `PATH`）

| 变量 | 值 |
|---|---|
| `BZ_DOCK_CONTRACT` | `1` |
| `BZ_DOCK_TOOL` | 你的 id |
| `BZ_DOCK_RUNS_FILE` | 记录文件**绝对路径**（= 你目录下的 `runs.json`） |
| `BZ_DOCK_VAULT` | vault 根绝对路径 |
| `BZ_DOCK_TRIGGER` | `auto` / `manual` —— 直接抄给记录里的 `trigger`，别自己猜 |

### 4.2 四行协议（stdout，每行一个）

| 行 | 体 | 效果 |
|---|---|---|
| `[bz-step] 检查登录态` | 纯文案 | 步骤（空文案忽略） |
| `[bz-p] {"phase":"签到","pct":35}` | JSON 对象 | 阶段进度；**拿不到进度写 `null`，别编** |
| `[bz-info] {"mode":"fast"}` | JSON 对象 | 结构化信息体 |
| `[bz-result] {"balance":52}` | JSON 对象 | 结果体（一次运行取最后一次） |

- 非协议行原样透传为日志；坏行静默忽略（永不抛）；CRLF 会剥 `\r`；单行上限 1 MiB。
- 退出码 0 且未被停止 = `ok`；被停止 = `stopped`；其它 = `failed`，**stderr 尾部 2KB** 会被留下展示 —— 把最有用的话写在最后。
- 不需要支持任何子命令；声明不从 stdout 吐。

### 4.3 `runs.json`（你写、bz 只读）

```jsonc
{ "v": 1, "tool": "<你的 id>", "updatedAt": "2026-10-04T10:34:41+08:00", "runs": [/* 新的在前 */] }
```

每条必备：`status`（`ok`/`failed`/`stopped`/`running`/`timeout`，不认识则整条丢弃）、`startedAt`。常用：`runId`（建议 `${startedAt}-${pid}`）、`trigger`（读环境变量）、`finishedAt` / `durationMs`、`exitCode`、`message`（给人看的一句话，写「签到成功，+2 分」别写「done」）、`steps`、`progress`、`result`、`info`（**记录里是数组** `[{at,data}]`）、`metrics`、`artifacts`、`error`。未知字段保留。

**两条硬要求**：① **原子写**（写 `<file>.<pid>.<n>.tmp` 再 rename）；② **自己裁剪到 200 条**（`slice(0,200)`），超了 bz 只提示不代删。

**`error.kind` 是最值钱的字段** —— 失败时别省：

| kind | 面板提示 |
|---|---|
| `auth` | 登录态失效，重新导出凭据 |
| `network` | 网络不通，检查代理或稍后重试 |
| `config` | 命令或参数配错了 |
| `timeout` | 执行超时 |
| `aborted` | 被手动中止 |
| `unknown` | 看记录里的 stderr 尾部定位 |

### 4.4 在场 vs 离场

判据是**谁启动**：bz 拉起的都是在场（含自动触发，实时回显、能停止）；你自己配的系统计划任务在 Obsidian 关着时拉起 = 离场（只有记录，没有 stdout）。**所以 `info` / `result` 一定要写进记录**，否则离场那次就丢了。

## 5. 示例：照着抄

**完整可跑的样板**（四行协议 + 原子写记录 + exitCode 收尾，三件事都在里面）：

- `E:\Obsidian\叫我包仔\CONFIG\SCRIPTS\DockTools\iamtxt-signin\` —— `manifest.json` + `main.mjs`（Node 18+，零依赖）。接口写死、参数只留 Cookie、`secret` 不入记录、`[bz-p]` 拿不到进度就发 `null`。

脚本骨架只有四步，与语言无关（Python 用 `json.dump` + `os.replace` 换掉 `writeFileSync` + `renameSync` 即可，契约表格 4.1–4.3 就是全部）：

1. 路径：`RUNS_FILE = env.BZ_DOCK_RUNS_FILE ?? <脚本同目录>/runs.json`；`TRIGGER = env.BZ_DOCK_TRIGGER`（只有值等于 `auto` 才算 `auto`）。
2. 干活时用 stdout 发 `[bz-step]` / `[bz-p]` / `[bz-info]` / `[bz-result]`（各一行，JSON 体）。
3. 收尾**一定**写一条记录（含 `status` / `startedAt` / `message`，失败补 `error.kind`）：tmp + rename，`runs` 截到 200 条。
4. 用 `process.exitCode = 1` / `sys.exit(1)` 收尾 —— **不要 `process.exit()`**，stdout 走管道是异步的，立刻退出会截断输出。

## 6. 不要做

- 不要让 id 与 `runs.json` 的 `tool` 不一致。
- 不要把 `secret` 写进记录的 `params`。
- 不要把声明从 stdout 吐出来（`--manifest` 通道已取消）。
- 不要直接覆写记录文件（半截 JSON）；别指望 bz 替你裁剪。
- 不要依赖 `PATH` / 宿主环境变量，需要什么就在脚本里写绝对路径。
- 不要把接口 URL、请求体、字段名、超时做成参数 —— 写死在脚本里。
- 不要解析与 `key` 拼写不一致的参数名：argv 就是 `--<key>` 逐字，`user_id` 不会变成 `--user-id`（见 2.2）。
- `schedule` 不要用 `weekly`（折不出种子）；依赖 PATH 之外也一样。
- 有启用中规则的工具别再配一份系统计划任务（两个触发源，记录翻倍）。
- 记录里别写死 `trigger`；别编进度（拿不到写 `null`）。
- 别 try/catch 吞掉异常后 `exit 0`（bz 会判成功）。
- 别在脚本里做「今天跑过了就跳过」以外的调度判断 —— 该不该跑是 bz 的活。
- 改了 `run` 段记得去详情页重新确认信任，否则表现为「突然不跑了」。

## 7. 提交前自检

1. `manifest.json` 能 `JSON.parse`，`v===1`、id 合法、`name` 非空。
2. id 与记录里的 `tool` 逐字一致。
3. `run.cmd` 能独立跑起来（cwd 缺省是工具目录）。
4. 面板「导入声明」核对框里的名字、命令、参数个数对得上；详情页看到一条种子规则。
5. 跑一次：出 `[bz-step]` / `[bz-p]`，拿不到的 pct 是 `null`。
6. `runs.json` 多一条，`tool === id`，`status` 在枚举内，secret 已剔除，`trigger` 取自环境变量。
7. 记录是 tmp + rename 写的，`runs` ≤ 200 条。
8. 造一个失败：`exit 1` + stderr 末行是原因 + `error.kind` 贴切。
9. 关掉全局总闸再手动跑一次 —— 手动路径也得通。
10. 参数表逐项自问：用户看到能凭自己填对吗？填不对的回脚本里写死。
11. **从面板点一次「运行」验证传参链**，别只靠命令行自测 —— 手工传参容易顺手用了和 `key` 不同拼写的名字（连字符 vs 下划线），把不一致正好盖住（实例见 2.2）。

## 8. 相关

- **参考实现**：`E:\Obsidian\叫我包仔\CONFIG\SCRIPTS\DockTools\iamtxt-signin\`（`manifest.json` + `main.mjs`，接口写死、参数只留 Cookie）。工具放 vault 内只是这位用户的习惯 —— 放 vault 外一样能登记。
- 源码：契约 `src/dock/schema.ts` · 文件路径 `src/dock/declaration.ts` · 协议 `src/core/external-tool.ts` · 拉起与环境变量 `src/dock/runner.ts` · 规则表 `src/dock/rules.ts` · 调度与熔断 `src/dock/scheduler.ts`
- 面板数据住**数据目录** `dock.json`（ADR-0239）；**信任住本机插件设置** —— 换 vault / 换机器要重新确认。
- ADR：0235（声明文件自描述）、0236（bz 调度 + 记录归工具目录）、0237（文件名对齐插件惯例 + `main.mjs`）、0239（面板数据搬出插件设置、信任留本机）
