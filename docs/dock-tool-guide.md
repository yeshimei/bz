# 工具坞外部脚本接入指南（dock 契约 v1）

给谁看：**要写一个能被 bz「工具坞」登记、运行、观测的外部脚本**的人或 agent。

一句话：**你写一个普通命令行程序，旁边放一份 `dock.json` 声明自己是谁、有哪些参数、该怎么跑；运行时按四行协议往 stdout 说话，再自己往约定路径写一份运行记录。做完这三件事就能无缝接入 —— 你不 import 任何 bz 代码，bz 也不关心你的脚本里是什么。**

## 先把分工划清（最容易搞错的一条）

| 东西 | 住哪 | 谁写 |
|---|---|---|
| 声明 `dock.json` | 你的工具目录 | **你**（手写） |
| 运行记录 `dock.runs.json` | 你的工具目录 | **你**（脚本运行时写） |
| 参数值 `dock.settings.json` | 你的工具目录 | **bz** |
| 登记项（id / 路径 / 信任 / 调度状态） | bz 的 `data.json` | **bz** |
| **自动化：开不开、多久跑一次** | bz 这一侧 | **用户**（在面板上定） |

- 你写的 `schedule` **只是给一个默认节奏**，不是「宣布我被怎么调度」。用户在面板上可以改成别的节奏，也可以整个关掉 —— **bz 不会回写你的 `dock.json`**（§5）。
- 你唯一会感知到的「自动化的存在」，是环境变量 `BZ_DOCK_TRIGGER=auto`（§4.1）。你不参与调度，也不需要知道用户把它设成了什么。

本文的真理源是 `src/dock/schema.ts`（契约校验）、`src/dock/declaration.ts`（声明文件与参数值）、`src/core/external-tool.ts`（四行协议）、`src/dock/runner.ts`（怎么拉起你）。**本文与代码冲突时以代码为准**，并顺手改这里。

---

## 0. 谁跟谁说话

```
      bz 工具坞                                        你的工具目录
        │  ① 读声明：读 <工具目录>/dock.json   ───────────►  文件（你手写，bz 只读、不执行）
        │  ② 跑起来：<run.cmd> <run.args…> --<参数>=<值> … ►  stdout 逐行吐 [bz-*] 四行协议
        │  ③ 事后读：只读 <工具目录>/dock.runs.json  ◄─────  你自己原子写这份运行记录
        ▼
   面板（列表 / 详情 / 历史 / KPI）
```

- ① **不执行任何东西** —— 就是读一个文件。所以「看清它会跑什么」发生在你被信任**之前**：用户先看到命令、工作目录、参数表，再决定信不信。
- ② ③ 是**实时 / 事后**的（bz 是你的父进程，能读你的 stdout；记录则永远由你自己落盘，bz **只读**）。
- **自动化**由 bz 按面板上的节奏替你拉起（Obsidian 开着的时候，§5）；只有「Obsidian 关着也要跑」那类才需要你自己配系统计划任务 —— 那种情况没有 ②，只剩 ③。**所以离场运行的结构化产出（`info` / `result`）只能靠记录带回来，否则就丢了。**

---

## 1. 身份：一个 id，两处必须逐字一致

先决定一个 id，形如 `iamtxt-signin`：

- **规则**：`^[a-z0-9][a-z0-9-]*$`，长度 ≤ 64，不能以连字符开头（它要能安全拼文件名，防 `..` 与盘符）。
- **必须逐字一致的两处**：

| # | 位置 | 谁写 |
|---|---|---|
| 1 | `dock.json` 的 `id` | 你 |
| 2 | 运行记录文件的 `tool` 字段 | 你 |

（登记表里那个 id 是 bz 导入声明时**从声明抄下来的**，用户不用填，所以不存在第三处 —— 这正是把「三处一致」压成「两处」的地方。）

**为什么较真**：记录文件读的时候会断言 `tool === 登记id`，不符整份被拒。而声明里的 id 改了、登记那边没跟着变，面板会**明说**「声明里的 id 是 X，与登记的 Y 不一致」，不再静默。

---

## 2. 契约 A：声明文件（`dock.json`）

放在**工具目录**里（与你脚本同级的 `dock.json`），bz 直接读这个文件。

### 2.1 它在哪、怎么被读

- **文件名固定** `dock.json`，位置固定 = 你脚本所在的那个目录。整个目录搬到哪都不用改配置。
- bz **不缓存**它 —— 每次打开面板 / 点「重新读声明」都现读。所以「改了声明但面板还是旧的」这种事不会发生。手边改了想立刻生效点一下「重新读声明」即可。
- 读取**永不抛**：文件不存在 / 不是合法 JSON / 必填缺 → 面板显示一条人话原因（「声明文件读不到：<路径>」），不会连累别的工具。
- 容忍 UTF-8 BOM（用 PowerShell 写文件很常见）。

### 2.2 字段

必填三项，缺任一项整份拒绝：

| 字段 | 类型 | 规则 |
|---|---|---|
| `v` | number | **必须是 `1`**。不认识的版本一律拒绝（不猜） |
| `id` | string | 见 §1 的形态与长度 |
| `name` | string | 非空（空白不算） |

选填：

| 字段 | 类型 | 说明 |
|---|---|---|
| `description` | string | 可换行；面板卡面与详情都显示 ✅ |
| `icon` | string | **lucide 图标名**，卡片与详情用；未知名回落域图标 ✅ |
| `run` | object | **怎么跑**，见 §2.3。缺省 = 这份声明只能看、不能跑（面板上标「只能看」） ✅ |
| `params` | array | 参数表，见 §2.4。缺省 = 空数组 ✅ |
| `schedule` | object | **默认节奏**，见 §2.5。缺省 = 手动（面板归到「手动」分区，不判漏跑；用户仍可给它排上自动化） ✅ |
| `author` / `toolVersion` | string | ⚠️ 只解析，**当前不渲染** |
| `group` | string | ⚠️ 只解析，**当前不渲染**（面板分区只有自动化 / 手动两区，由生效节奏决定，见 §2.5） |
| `docs` | string | ⚠️ 只解析，**当前不渲染** |
| `produces` | string[] | ⚠️ 只解析，**当前不消费**（声明会不会吐 `[bz-info]` / `[bz-result]`，但 UI 不看它） |
| `runtime` | object | ⚠️ `{ "estimatedSec": 20 }` **当前未被消费**（「卡住了」的判定还没做）。须 > 0，否则该字段被丢 |
| `desktopOnly` | boolean | ⚠️ **当前不生效**：移动端对**所有**工具一律只读（`canRun()` 只判 `!Platform.isMobile`），与此字段无关。写不写都一样 —— 别指望它 |

**未知字段一律原样保留**（前向兼容）：高版本写的字段被低版本 bz 读到不会丢，也不会报错。你可以放心加自己的扩展字段。

> 上表的 ✅ / ⚠️ 是照着当前实现标的：✅ = 面板真的会用到；⚠️ = 校验器收下了、但**还没有任何消费方**。
> 写 ⚠️ 字段不报错、也不算错 —— 它们多半是给将来留的位置。但**别把关键行为押在它们身上**（比如靠 `desktopOnly` 拦移动端，现在拦不住）。
> 这类字段一旦被真正消费，本文会跟着改。

### 2.3 `run`：连怎么跑都在声明里

```jsonc
{ "run": { "cmd": "node", "args": ["signin.mjs"] } }
```

- `cmd`（必填）：可执行文件路径，或 PATH 上的名字。**空则整段丢弃**（该工具退化为「只能看」）。
- `args`（选填）：固定参数表，按原样传给进程；参数表单里的值会**另拼在后面**（见 §2.4）。
- `cwd`（选填）：**缺省 = 声明文件所在目录**。所以 `args` 里直接写相对文件名就行（`signin.mjs`），整个工具目录搬到哪都不用改。
- `shell`（选填）：经 shell 启动。**缺省按 `cmd` 扩展名自动判** —— `.cmd` / `.bat` 结尾自动开（Windows 上不经 shell 起不来），其余自动关。想强制就显式写。

> **为什么把「怎么跑」也放进声明**：这样登记动作就只剩「选一个文件」。从前靠 `<cmd> --manifest` 子命令自描述，要读清单就得**先执行**那条命令 —— 于是用户只能在「还不知道它会跑什么」的前提下点信任。改成文件之后，读它不执行任何东西，顺序天然反过来了。那个子命令通道已取消，别再往 stdout 吐声明（§3）。

### 2.4 `params`：你声明参数，面板长出控件，值经 argv 回来

每一项：

```jsonc
{ "key": "mode", "label": "模式", "type": "choice",
  "default": "fast",
  "options": [{"value":"fast","label":"快"},{"value":"full","label":"全"}],
  "help": "……", "placeholder": "……", "required": false }
```

- `key` / `label` / `type` **三者缺一或 `type` 不认识 → 整项丢弃**（不连累别的参数）。
- 同 `key` 重复 → 只留第一个。
- 校验**永不抛异常**：bad 参数丢掉，工具不会因此消失。一个写错的参数不该让整个工具不见。

八种 `type` → 控件 → argv：

| type | 控件 | 专属字段 | 传给你的 argv |
|---|---|---|---|
| `text` | 单行输入 | `placeholder` | `--key=值` |
| `multiline` | 多行文本域 | `rows` | `--key=值`（含换行） |
| `number` | 数字框 | `min` / `max` / `step` | `--key=值` |
| `bool` | 开关 | — | `true` → `--key`（**无值**）；`false` → **不发** |
| `choice` | 单选下拉 | `options` | `--key=值` |
| `multichoice` | 多选胶囊 | `options` | `--key=值1 --key=值2`（**重复发同一 key**） |
| `path` | 文件/目录选择器 | `mode`: `file`（缺省）/ `dir` | `--key=路径` |
| `secret` | 密码框 | — | `--key=值` |

**序列化规则（`buildArgs`）**：
- 一律 `--<key>=<value>`；`bool` 例外（见上）。
- 值等于 `undefined` / `null` → 跳过；空字符串 → **跳过，除非该项 `required: true`**。
- `secret` 照发（你需要它），但 **bz 不会把它写进运行记录** —— 见 §4。
- 值里的引号/反斜杠 **不会**被转义：是否经 shell 启动由 `run.shell` 决定。**如果你的参数可能含引号或空格，建议打开 `run.shell` 并在脚本侧按 `--key=` 原样收**（参考知识盒的 `b64:` 口径）。

> 参数**只在启动时**下发。bz 不开 stdin 管道、不做运行中注入（这是刻意的：零真实场景，开了会把协议复杂度抬高一整档）。

**参数值住在哪**：用户填完存在 `<工具目录>/dock.settings.json`（bz 写、bz 读，形状见 §4.5）。位置在**你这边**，不进 vault、不随 vault 同步、不进 git。你**不需要**读它 —— 每次运行时值都会经 argv 发给你。想让用户在别处也改就自己读，随你。

#### 参数表里该放什么（**最容易做错的一节**）

参数表的唯一用途是**向用户索取只有他才知道的东西**。反过来，凡是你能查清、能写死的，一律写死在脚本里。

| 该放 | 为什么 | 例子 |
|---|---|---|
| **凭据** | 只有用户有 | Cookie / token / 账号密码（用 `secret`） |
| 用户自己的偏好 | 只有他知道 | 下载目录（`path`）、是否推送通知（`bool`） |
| 会变的环境值 | 因机器而异 | 代理地址 |

| **不该放** | 为什么 |
|---|---|
| **接口地址、路径、URL** | 用户不可能知道 —— 这是**你**该查清并写死的。做成参数等于把活推给用户，还会让工具默认状态下跑不通 |
| 请求体、字段名、协议细节 | 同上，属于实现内部 |
| 实现里能算出来的东西 | 可以从别的输入推导 |
| 调优旋钮（超时、并发、重试） | 选一个合理值写死。真出问题再说，别一上来就摊给用户 |

> **判据一句话**：这个文本框，用户看到之后能凭自己填对吗？填不对的，就不是参数。
>
> 反面教材：`{ key: "signinUrl", label: "签到接口" }` —— 用户看到只会想「接口是啥？我怎么会知道？」。
> 正确做法：脚本里写 `const SIGNIN_URL = 'https://…/e/extend/signin.php'`，参数表里**只留 Cookie**。

### 2.5 `schedule`：给一个**默认节奏**

```jsonc
{ "schedule": { "kind": "daily", "hour": 12, "note": "09:00 起随机 0~2 小时" } }
```

- `kind` ∈ `daily` / `weekly` / `interval` / `on-demand` / `unknown`。**不认识 → 整条节奏作废，视同未声明。**
- `note`：人话，仅展示。
- `daily` 专用 `hour`（0–23，本地时区）：期望当天何时之前跑完。缺省 = 一过零点就算欠。
- `weekly` 专用 `weekday`（0=周日 … 6=周六）。缺省 = 只要求「最近 7 天内有」。
- `interval` 专用 `everyHours`（> 0）。缺省 = 不判。

**越界字段逐个丢弃，不连累整条节奏**（`hour: 30` 只是丢掉 `hour`，节奏还在，判得粗一点）。判定所需时刻全部按**本地时区**。

**它决定的是「默认」**。写在这里的节奏会被当成这个工具的**初始节奏**：
- 默认归到面板的「自动化」分区，并按它自动跑；
- 用户在详情页能看到一行「**脚本默认**」正是你写的那条，另有一行「当前生效」；
- 用户想要别的节奏（或者干脆关掉自动运行）就在面板上改 —— 改的是 bz 那一侧的一份设置，**你的 `dock.json` 一个字节都不会被动**。以后你改了这条默认节奏，面板会提示用户「脚本改过默认节奏了」，但**不会**擅自把用户设的那份推翻。

**面板上「自动化 / 手动」两区由生效节奏派生**（`triggerOf`）：`daily` / `weekly` / `interval` → 自动化；`on-demand` / `unknown` / 没写 → 手动。**没有第二个地方能改这个分类** —— 分类是派生的，不是另存一个字段。用户给一个手动工具排上节奏，它就进了自动化区；这不需要你配合。

> **bz 会真的替你触发。** `daily` / `weekly` / `interval` 生效时，Obsidian 开着 bz 就按节奏把你拉起来：到点跑、漏跑补、失败重试（失败 15 分钟冷却、连续 3 次熔断暂停）。所以：
>
> - **不必**再去系统任务计划程序里给自己配一份 —— 那是老做法（只在「关着 Obsidian 也要跑」时才需要，见 §4.1）。
> - bz 拉起你时会注入 `BZ_DOCK_TRIGGER=auto`，你据此给记录的 `trigger` 字段标 `auto`（§4.1）。
> - 用户在「设置 → 工具坞 → 自动运行」可以一键关掉全部自动运行；也能在单个工具的详情页关掉它自己。
>
> 细节（开关、熔断、用户能改什么）都在 §5。

---

## 3. 契约 B：四行协议（stdout）

运行时 bz 逐行解析你的 stdout。四个前缀，**每行一个**：

| 行 | 体 | 效果 |
|---|---|---|
| `[bz-step] 检查登录态` | 纯文案 | 步骤行（文案透传；空文案**忽略**） |
| `[bz-p] {"phase":"签到","pct":35}` | JSON 对象 | 阶段进度。`pct` 约定 0–100；**`null` = 该阶段不可估** |
| `[bz-info] {"mode":"fast"}` | JSON 对象 | 解析信息体（结构化数据出口） |
| `[bz-result] {"balance":52}` | JSON 对象 | 交付结果体（一次运行里取**最后一次**） |

容错（都是刻意的，不是宽容，是「外部输出不可信」）：

- **非协议行原样透传**为原始日志（不会打断你）。
- 空行忽略；坏协议行（JSON 坏、`[bz-step]` 空文案、体不是对象而是数组/原始值）**静默忽略**，永不抛。
- CRLF 会剥 `\r`，Windows 下直接 `print` / `console.log` 就行。
- **单行上限 1 MiB**，超长行截断透传（不要往一行里塞大对象）。

> 四行协议**只在运行时**有意义。你不需要支持任何子命令（原先的 `--manifest` 已随声明文件化取消）—— 别再把声明从 stdout 吐出来，那个通道已经没有了。

**`pct` 的纪律**：拿不到真实进度就写 `null`，别编一个。bz 会把 `null` 渲染成不确定态（注意 bz **不钳制**数值，超出 0–100 会原样渲染 —— 这是约定，不是校验）。

### 退出码语义

| 情况 | bz 的判定 |
|---|---|
| 退出码 0，未被停止 | **成功**（`ok`） |
| 调用方点了「停止」 | **中止**（`stopped`，即使你恰好退出码 0） |
| 其他退出码 / 起不来 | **失败**（`failed`）；stderr **尾部 2KB** 会被留下并展示 |

所以你只要：**干成了 `exit 0`，没干成 `exit 1` 并往 stderr 说清原因**。stderr 请把**最有用的话写在最后**（只留尾部 2KB）。

---

## 4. 契约 C：运行记录（你写、bz 只读）

### 4.1 写到哪儿

**就写在你自己的目录里**：`dock.runs.json`，与 `dock.json` 同级。文件名是契约的一部分（`declaration.ts` 的 `RUNS_FILENAME`），**你不要自己另外声明路径** —— 也不需要知道 vault 在哪。

- **在场运行**（bz 启动你，含它按节奏自动触发）：环境变量里给好了绝对路径，用 `BZ_DOCK_RUNS_FILE`。它由你的 `dock.json` 位置推出来，所以永远是绝对值，不会被你的 `cwd` 解析歪。
- **离场运行**（你自己配的系统计划任务在 Obsidian 关着时启动你）：拿不到那个变量，但答案很简单 —— **还是写你自己目录里的 `dock.runs.json`**（脚本里由 `__dirname` / `import.meta.url` 定位即可）。

bz 注入的环境变量（`dockEnvOf`）：

| 变量 | 值 |
|---|---|
| `BZ_DOCK_CONTRACT` | `1` |
| `BZ_DOCK_TOOL` | 你的 id |
| `BZ_DOCK_RUNS_FILE` | **记录文件的绝对路径**（= 你目录下的 `dock.runs.json`） |
| `BZ_DOCK_VAULT` | vault 根目录绝对路径（通常用不上，留给你偶尔要读写 vault 时） |
| `BZ_DOCK_TRIGGER` | `auto`（bz 按节奏自动触发）/ `manual`（用户在面板里点）。**给记录的 `trigger` 字段用**：bz 是父进程，它最清楚这次是谁拉起的，你不用猜。缺省按 `manual` 处理 |

> ⚠️ **bz 只注入这五个变量，不继承宿主环境**（子进程的 env 被整体替换）。**不要依赖 `PATH` 或其他环境变量去找可执行文件** —— 需要什么就在脚本里写绝对路径，或自己读系统配置。这是当前实现的硬约束。

### 4.2 文件形状

```jsonc
{
  "v": 1,
  "tool": "iamtxt-signin",        // 必须 === 你的 id（不符整份被拒）
  "updatedAt": "2026-10-04T10:34:41+08:00",
  "runs": [ /* 新的在前 */ ]
}
```

**每次运行一条**：

| 字段 | 必填 | 规则 |
|---|---|---|
| `status` | ✅ | `ok` / `failed` / `stopped` / `running` / `timeout`。不认识 → **整条丢弃** |
| `startedAt` | ✅ | 非空字符串，ISO 8601 带时区最稳 |
| `runId` | | 缺省回落到 `startedAt`；建议 `${startedAt}-${pid}` 保证唯一 |
| `trigger` | | `auto`（bz 按节奏自动触发）/ `manual`（用户手动点）；**缺省 `manual`**。直接读 `BZ_DOCK_TRIGGER` 即可（§4.1），别自己猜 |
| `finishedAt` / `durationMs` | | `running` 时可缺 |
| `exitCode` | | number 或 `null`（`null` = 没起来） |
| `message` | | **给人类看的一句话**，面板主文案。写「签到成功，+2 分」这种，别写「done」 |
| `params` | | 本次实际参数。**`secret` 类型必须已被你剔除**（见下） |
| `steps` | `[{text, at?, status?}]` | `text` 非空的项才留。历史进度的来源 |
| `progress` | `{phase: string\|null, pct: number\|null}` | 同上「绝不假报」纪律 |
| `info` | **数组** | ⚠️ 记录里它是**数组**（与协议里每行一个对象不同）。习惯写法 `[{at, data}]`。不是数组 → 整个字段被丢 |
| `result` | 任意 | 最后一次 `[bz-result]` 的内容 |
| `metrics` | `{k: number}` | 值非数字的项被丢；全丢则该字段消失 |
| `artifacts` | `[{path, label?}]` | `path` 非空才留 |
| `error` | `{kind, detail?, stderr?}` | `kind` 不认识 → 归 `unknown`。见 §4.4 |

**未知字段一律保留**（前向兼容），可以加自己的字段。

### 4.3 两条硬要求

**① 原子写**。写 `.tmp` 再 `rename` 顶替，tmp 名带 pid 与序号（`<file>.<pid>.<n>.tmp`）。bz 可能在你写一半的时候读 —— 直接覆写会读到半截 JSON。示例见 §7。

**② 裁剪是你的活**。每个工具保留**最近 200 条**（新的在前，`schema.ts` 的 `DOCK_RUNS_PER_TOOL_LIMIT`）。超了 bz 只在界面上提示，**不会替你删** —— bz 一旦写回去就成了第二个写者，那正是这套设计要避免的。所以每次写入顺手 `slice(0, 200)`。

> bz 读侧对畸形输入一律容错：坏 JSON / 版本不符 / 结构不符 → 降级为「该工具记录不可读」并提示，绝不连累整个面板打不开。所以写坏了不会炸别人，但你会失去历史。

### 4.4 `error.kind` 是最值钱的字段

它让 bz 能给出**可操作**的提示，而不是干巴巴一句「失败了」：

| kind | 面板会提示 |
|---|---|
| `auth` | 登录态已失效，去重新导出凭据（cookie / token） |
| `network` | 网络不通，检查代理或稍后重试 |
| `config` | 命令或参数配错了，检查工具的命令路径与工作目录 |
| `timeout` | 执行超时，可能是网络慢或任务量变大 |
| `aborted` | 被手动中止 |
| `unknown` | 查看运行记录里的 stderr 尾部定位 |

失败时**别偷懒省掉 `kind`** —— 这是整个「汇报完成情况」功能一半的价值。（bz 侧在场运行也会自己猜一个分类给你即时提示，但**权威分类以你写的记录为准**：你比 bz 更知道自己死在哪儿。）

### 4.5 参数值文件（bz 写，你可以不看）

`<工具目录>/dock.settings.json`：

```jsonc
{ "v": 1, "tool": "iamtxt-signin", "values": { "cookie": "…" } }
```

- **写者只有 bz**（面板参数表单，停手 500ms 后落盘）。你不需要写它，通常也不需要读它 —— 值每次都会经 argv 发给你。
- 这是凭据的家：它**不在 vault 里**，所以不随 vault 同步、不进 git、不落运行记录。
- 顺带一提：如果你的工具目录在某个 git 仓库里，记得把 `dock.settings.json` 加进 `.gitignore`。

---

## 5. 自动化：bz 侧的事，你只给默认值

这一节讲清「谁定什么」，因为它决定了你**不该**假设什么。

| 东西 | 谁定 | 在哪定 | 你会感知到吗 |
|---|---|---|---|
| 全局总闸（`dockAutoRun`） | 用户 | 设置 → 工具坞 → 自动运行 | ❌ |
| 单个工具开不开（`autoRun`） | 用户 | 该工具详情页的「自动运行」块 | ❌ |
| 跑多久一次（节奏） | 用户（**初值来自你的 `schedule`**） | 同上，节奏编辑器 | ❌ |
| 熔断暂停 / 恢复 | bz 自动 + 用户手动恢复 | 同上 | ❌ |
| 这次是自动还是手动 | bz | —— | ✅ **只有这一个**：`BZ_DOCK_TRIGGER`（§4.1） |

面板上的「自动运行」块有三个部分，**开关与节奏是两个控件各管一件事**：

- **总闸开关**（「自动运行」）：bz 要不要自动触发这个工具。关掉 = 只手动跑。
- **脚本默认 / 当前生效**：两行事实。前者是你 `dock.json` 里写的那条，后者是实际生效的（用户改过就标「你改的」）。
- **节奏编辑器**：每天 / 每周 / 每隔若干小时。**没有「只手动」这一项** —— 「不自动」已经由总闸开关表达，不在第二个地方重复。

所以你作为脚本作者要做的只有三件事：

1. **给一个合理的默认节奏**（或干脆不给 = 默认手动）。把它当成「我猜用户大概想这么跑」，而不是「用户必须这么跑」。
2. **读 `BZ_DOCK_TRIGGER` 标 `trigger`**，别写死。
3. **失败就 `failed` + `error.kind`** —— 自动运行时没人盯着屏幕，记录是唯一的真相来源。

三条推论：

- **别假设「我一定会被自动调用」。** 用户可以随时关掉总闸、改节奏、或让工具熔断暂停。脚本自身要能在任意时刻被手动点着跑一次、也跑得对。
- **别假设「用户一定会自己配系统计划任务」。** 声明了节奏就归 bz 管；用户再配一份 = 两个触发源，记录翻倍（§8）。
- **别在脚本里做「今天跑过了就跳过」以外的调度判断。** 到点没到点、该不该跑，是 bz 的活（`schedule.ts` 的判据，单源）。你只负责「被拉起来就把活干完、把记录写对」。

> **硬后果**：Obsidian 关着的时候 bz 不会跑你。这是「bz 替你调度」的代价。真要「关着也要跑」，只能自己配系统计划任务（那是离场运行，§6）—— 别指望 bz 帮你注入。

---

## 6. 在场 vs 离场（判据是**谁启动**，不是自动 / 手动）

| | **在场** | **离场** |
|---|---|---|
| 谁启动 | **bz**（用户手动点 / 快捷键 / **bz 按节奏自动触发**） | 你自己配的系统计划任务（Obsidian 关着时） |
| 四行协议 | **实时**回显 | 无（没有 stdout 可读） |
| `info` / `result` | 协议即时进 UI，**同时**照写记录 | **只能**靠记录带回来 |
| 停止 | bz 能中止你 | bz 管不到 |
| 记录 | 你写 | 你写 |

**关键区别**：bz 按节奏自动触发的运行**也是在场的**（bz 是父进程，有实时流、能停止）—— 「自动」不等于「离场」。唯一真「离场」的是「Obsidian 关着、由系统计划任务拉起」那一种。

同一个脚本两种形态都要能跑 —— 这也是为什么**记录必须由你写**：离场时没人替你做这件事。

---

## 7. 最小可跑示例

### `dock.json`（放在你脚本同级目录）

```jsonc
{
  "v": 1,
  "id": "iamtxt-signin",
  "name": "iamtxt 每日签到",
  "description": "在 iamtxt 签到领积分；失败原因写进运行记录",
  "icon": "calendar-check",
  "schedule": { "kind": "daily", "hour": 12, "note": "当天哪天跑都算" },
  "run": { "cmd": "node", "args": ["signin.mjs"] },
  "params": [
    // 只有凭据。用户除了 Cookie 没别的可填 —— 接口、body、超时全在脚本里写死
    { "key": "cookie", "label": "Cookie", "type": "secret",
      "help": "登录后复制整串 Cookie。存在本机工具目录，不写进运行记录" }
  ]
}
```

### Node（零依赖，Node 18+）

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 注意：这里不需要任何 --manifest 分支 —— 声明就是上面那份 dock.json
const ID = 'iamtxt-signin';
const V = 1;
const ARGS = process.argv.slice(2);

// —— 接口写死在脚本里，**不做成参数**（见 §2.4「参数表里该放什么」）——
const SITE = 'https://www.iamtxt.com';
const SIGNIN_URL = `${SITE}/e/extend/signin.php`;
const SIGNIN_BODY = 'userid=0';    // 接口只认这一个字段

// —— 契约 B：四行协议 ——
const say = {
  step: (t) => console.log(`[bz-step] ${t}`),
  p: (phase, pct) => console.log(`[bz-p] ${JSON.stringify({ phase, pct })}`),
  info: (d) => console.log(`[bz-info] ${JSON.stringify(d)}`),
  result: (d) => console.log(`[bz-result] ${JSON.stringify(d)}`),
};

// 收参数：--key=value / --flag（bool 无值）
function params() {
  const out = {};
  for (const a of ARGS) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

// —— 契约 C：运行记录（原子写 + 自裁剪）——
// 记录就写在自己目录里的 dock.runs.json：在场时用 bz 给的绝对路径，离场时由脚本自己定位。
const RUNS_FILE = process.env.BZ_DOCK_RUNS_FILE
  || path.join(path.dirname(fileURLToPath(import.meta.url)), 'dock.runs.json');
// bz 是父进程，它告诉我们这次是自动触发还是手动点 —— 别自己猜（§5）
const TRIGGER = process.env.BZ_DOCK_TRIGGER === 'auto' ? 'auto' : 'manual';

function writeRun(rec) {
  const file = RUNS_FILE;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let prev = { runs: [] };
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 首次或坏了 → 重来 */ }
  const runs = [rec, ...(Array.isArray(prev.runs) ? prev.runs : [])].slice(0, 200);
  const tmp = `${file}.${process.pid}.0.tmp`;          // tmp 名带 pid：多进程不撞
  fs.writeFileSync(tmp, JSON.stringify({ v: V, tool: ID, updatedAt: new Date().toISOString(), runs }, null, 2));
  fs.renameSync(tmp, file);                            // 原子顶替
}

// —— 干活 ——
async function main() {
  const started = new Date();
  const p = params();
  const steps = [];
  const info = [];
  const finish = (rec) => {
    const done = new Date();
    writeRun({ runId: `${started.toISOString()}-${process.pid}`, trigger: TRIGGER,
      params: {},                                      // 参数只有 secret → 一律不落记录
      steps, startedAt: started.toISOString(), finishedAt: done.toISOString(),
      durationMs: done - started, ...rec });
  };

  try {
    const cookie = String(p.cookie || process.env.IAMTXT_COOKIE || '').trim();
    if (!cookie) {
      finish({ status: 'failed', exitCode: 1, message: '没给 Cookie，签不了',
        progress: { phase: '读取配置', pct: 100 },
        error: { kind: 'config', detail: '在参数表单里填 Cookie，或设环境变量 IAMTXT_COOKIE' } });
      process.stderr.write('Cookie 缺失\n');
      process.exitCode = 1;
      return;                                          // 缺配置 = 用户问题，不是异常
    }

    say.step('签到');
    steps.push({ text: '签到', at: new Date().toISOString(), status: 'ok' });
    say.p('签到', null);                               // 不可估就写 null，别编

    const res = await fetch(SIGNIN_URL, {              // 接口写死，用户不参与
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: SITE, Referer: `${SITE}/`, Cookie: cookie,
      },
      body: SIGNIN_BODY,
    });
    const text = (await res.text()).trim();             // 实测：成功「阅读愉快…」/ 已签「今天已…」

    if (text.startsWith('阅读愉快') || text.startsWith('今天已')) {
      say.p('签到', 100);
      say.result({ ok: true, raw: text.slice(0, 80) });
      info.push({ at: new Date().toISOString(), data: { result: text.slice(0, 80) } });
      finish({ status: 'ok', exitCode: 0, message: text.startsWith('阅读愉快') ? '签到成功' : '今天已签过',
        progress: { phase: '签到', pct: 100 }, info, result: { ok: true }, metrics: { signedIn: 1 } });
      return;
    }

    // 认不出来就说认不出来 —— 不猜成功
    finish({ status: 'failed', exitCode: 1, message: `签到响应认不出来：${text.slice(0, 60)}`,
      progress: { phase: '签到', pct: 100 },
      error: { kind: /nologin|登录/.test(text) ? 'auth' : 'unknown',
        detail: text.slice(0, 200), stderr: `接口原文：${text.slice(0, 2048)}` } });
    process.stderr.write(text + '\n');                  // 尾部 2KB 会被 bz 留下
    process.exitCode = 1;
  } catch (e) {
    const msg = String(e?.stack ?? e);
    finish({ status: 'failed', exitCode: 1, message: '连不上 iamtxt',
      progress: { phase: '签到', pct: null },
      error: { kind: 'network', detail: '网络不通', stderr: msg.slice(-2048) } });
    process.stderr.write(msg + '\n');
    process.exitCode = 1;
  }
}

// 用 exitCode 而不是 process.exit()：stdout 走管道时是异步的，立刻 exit 会把输出截断
main().catch((e) => { process.stderr.write(String(e?.stack ?? e) + '\n'); process.exitCode = 1; });
```

### Python（同样三件事；`dock.json` 同上一份）

```python
#!/usr/bin/env python3
import json, os, sys, time
from datetime import datetime, timezone

ID, V = "iamtxt-signin", 1
ARGS = sys.argv[1:]

def iso(): return datetime.now(timezone.utc).astimezone().isoformat()

# 记录写在自己目录的 dock.runs.json：在场用 bz 给的路径，离场自己定位；trigger 读 bz 注入的
RUNS_FILE = os.environ.get("BZ_DOCK_RUNS_FILE") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "dock.runs.json")
TRIGGER = "auto" if os.environ.get("BZ_DOCK_TRIGGER") == "auto" else "manual"

def say(prefix, body):                                     # 契约 B
    print(f"[bz-{prefix}] {json.dumps(body, ensure_ascii=False) if not isinstance(body, str) else body}", flush=True)

def write_run(rec):                                        # 契约 C
    f = RUNS_FILE
    os.makedirs(os.path.dirname(f), exist_ok=True)
    try: prev = json.load(open(f, encoding="utf-8"))
    except Exception: prev = {"runs": []}
    data = {"v": V, "tool": ID, "updatedAt": iso(),
            "runs": [rec] + [r for r in prev.get("runs", []) if isinstance(r, dict)][:199]}
    tmp = f"{f}.{os.getpid()}.0.tmp"
    with open(tmp, "w", encoding="utf-8") as fh: json.dump(data, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, f)                                     # 原子顶替

started = iso(); t0 = time.time(); steps = []
try:
    say("step", "检查登录态"); steps.append({"text": "检查登录态", "at": iso(), "status": "ok"})
    say("p", {"phase": "签到", "pct": None})                # 不可估 → null
    say("result", {"balance": 52})
    write_run({"runId": f"{started}-{os.getpid()}", "trigger": TRIGGER, "status": "ok",
               "startedAt": started, "finishedAt": iso(), "durationMs": int((time.time() - t0) * 1000),
               "exitCode": 0, "message": "签到成功，+2 分", "steps": steps,
               "progress": {"phase": "签到", "pct": 100}, "result": {"balance": 52}})
    sys.exit(0)
except Exception as e:
    write_run({"runId": f"{started}-{os.getpid()}", "trigger": TRIGGER, "status": "failed",
               "startedAt": started, "finishedAt": iso(), "exitCode": 1, "message": "签到失败",
               "error": {"kind": "unknown", "detail": str(e), "stderr": str(e)[-2048:]}})
    print(str(e), file=sys.stderr, flush=True)
    sys.exit(1)
```

---

## 8. 不要做

- **不要在声明里编数字**：`runtime.estimatedSec` 写不准就别写（反正现在也没人消费）。
- **不要把声明从 stdout 吐出来**：`--manifest` 通道已经取消，bz 不读你的 stdout 找声明。
- **不要让 `id` 与记录文件里的 `tool` 不一致**（§1）。
- **不要把 `secret` 写进运行记录的 `params`**（记录会落盘、会随工具目录一起被备份/寄出）。
- **不要在声明里把节奏写成「用户必须这么跑」** —— 它只是默认值（§2.5）；也别在脚本里替用户做调度判断（§5）。
- **不要给声明了 `daily`/`weekly`/`interval` 的工具再配一份系统计划任务** —— bz 已经按同一个节奏替你触发。两处都配 = 同一件事两个触发源，记录会翻倍。
- **别在记录里给 `trigger` 写死** —— 读 `BZ_DOCK_TRIGGER`（bz 是父进程，它最清楚）。写死 `auto` 会让「用户手动点的那次」在面板上被当成自动运行。
- **不要在记录里编数字**：拿不到的进度写 `null`，没跑的步别写。面板会把它当事实展示。
- **不要直接覆写记录文件**（半截 JSON → bz 判「不可读」）；也不要指望 bz 替你裁剪。
- **不要直接把「实现细节」做成参数**（§2.4）—— 最典型的就是把接口 URL 丢给用户填。用户不知道，也不该知道。
- **不要依赖 `PATH` / 宿主环境变量**（§4.1 的警告）。
- **不要往一行 stdout 里塞大对象**（1 MiB 截断）。
- **不要 try/catch 吞掉异常后 `exit 0`** —— bz 会认为成功，用户看到「成功」而其实什么都没干。失败就 `exit 1` + stderr + 一条 `failed` 记录。

---

## 9. 提交前自检

1. `dock.json` 能被 `JSON.parse`，且 `v===1`、`id` 合法、`name` 非空。
2. 声明里的 `id` 与运行记录里的 `tool` 逐字一致。
3. `run.cmd` 能独立跑起来（顺手确认 `cwd` 缺省那个目录对不对 —— 它默认是你的工具目录）。
4. 在面板里「导入声明」：核对框里显示的名字、命令、参数个数都对得上。
5. 跑一次正常路径：能出 `[bz-step]` / `[bz-p]`（`pct` 拿不到就是 `null`）。
6. 跑完**你目录下的 `dock.runs.json`** 里多了一条，`tool === id`，`status` 在枚举内，`secret` 已剔除，`trigger` 取自 `BZ_DOCK_TRIGGER`（不是写死的）。
7. 记录是 tmp + rename 写出来的（在写入瞬间被读不会出半截 JSON）。
8. `runs` 数组已裁剪到 ≤ 200 条。
9. 造一个失败（如断网）：`exit 1` + stderr 最后一行是原因 + 记录里 `error.kind` 是最贴切的分类。
10. 如果声明了 `schedule`：`kind` 在枚举内，`hour` / `weekday` / `everyHours` 在范围内，且它**符合你希望用户默认看到的节奏**。面板详情页「自动运行」块里应看到「脚本默认」一行正是它 —— 旁边那行「当前生效」才是真正在跑的（用户改过就会有「你改的」标记）。**改用户那份不是你的活，bz 不会回写你的 `dock.json`。**
11. 把工具的自动化**关掉再跑一次**（详情页总闸开关）—— 手动路径也该跑通，因为用户随时可能这么用（§5）。
12. **参数表逐项自问**：用户看到这个框，能凭自己填对吗？填不对的（接口、路径、字段名、超时）回脚本里写死。

---

## 10. 相关

- **参考实现（真跑得起来的样板）**：`E:\Obsidian\dock-tools\daily-signin\` —— iamtxt 每日签到，目录里就是 `dock.json` + `signin.mjs`，接口写死、参数只留 Cookie
- 契约校验（真理源）：`src/dock/schema.ts`、`src/dock/registry.ts`
- 声明文件 / 参数值 / 运行记录路径：`src/dock/declaration.ts`
- 四行协议与进程生命周期：`src/core/external-tool.ts`
- 拉起与回显（含注入的环境变量）：`src/dock/runner.ts`
- 自动运行（bz 按节奏替你触发）：`src/dock/scheduler.ts` + 判据 `src/dock/schedule.ts`
- 设计决策（D1–D15、四份文件、明确不做的清单）：`.scratch/dock/spec.md`（§14 调度、§15 措辞与下拉）
- 决策记录：ADR-0235（声明文件自描述）、**ADR-0236（bz 调度 + 运行记录归工具目录，含 §补记「主动权在 bz 这一侧」）**
