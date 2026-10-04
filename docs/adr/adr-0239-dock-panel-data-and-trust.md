# ADR-0239 · 工具坞：面板数据搬出插件设置（数据目录 `dock.json`），授权留在本机

日期：2026-10-04 · 状态：已采纳 · 关联：ADR-0235 §3（本条修正）、ADR-0236（调度台账）、
ADR-0237（文件名惯例）、ADR-0238（规则表）、规格 `.scratch/dock/spec.md`

## 背景

ADR-0235 §3 把登记表收缩到「bz 相关的数据」，但那四把数据仍然住在**插件设置**（`data.json`）：

| 键 | 内容 |
|---|---|
| `dockTools` | 工具登记表（本轮之前还夹着 `trustedAt` / `trustedRun`） |
| `dockRunState` | bz 侧调度台账（最近尝试 / 连续失败 / 是否熔断） |
| `dockAutoRun` | 自动运行总闸 |
| `dockNotifyMissed` | 漏跑提醒 |

用户点破的落点很直接：

> 工具坞设置面板的存 data.json，其他单独一个 json 放到 `E:\Obsidian\叫我包仔\CONFIG\STORAGE`。

拆开看是三件事：

1. **破了本仓的通例**。除 dock 外，每个域的数据都住 `storagePath`（默认 `CONFIG/STORAGE/`）。
   dock 是唯一的例外 —— 换数据存储路径（挪到另一个盘、另一个目录）时，别人都跟着走、它不跟；
   备份 / 迁移数据目录时会**静默漏掉**面板数据。这不是风格问题，是「备份以为备全了」的那类缺口。
2. **面板数据被当成「设置」**。它其实是**账本**（登记了哪些工具、跑成什么样、开关状态），
   与「设置」同住会让「哪些是用户偏好、哪些是 bz 的运行事实」这条线糊掉。
3. **登记表里夹着授权**。ADR-0235 为修 D5 把信任钉在命令签名上（`trustedRun`），
   但那个字段跟着登记项住 `data.json` —— 一处**会随 vault 走**的地方。

第 3 点在本轮被单独拎出来问了一句：「登记表里的信任字段跟不跟着搬？」用户的选择是
**不搬**，并且要能在设置面板里自己管（「选择 1 并且用户可以在设置面板来调整」）。
下面 §2 就是这一条的理由。

## 决策

### 1. 面板数据搬进 `<数据存储路径>/dock.json`

| 旧（插件设置 `data.json`） | 新（数据目录 `dock.json`） |
|---|---|
| `dockTools` | `tools` |
| `dockRunState` | `runState` |
| `dockAutoRun` | `autoRun` |
| `dockNotifyMissed` | `notifyMissed` |

- 文件名 `dock.json`，路径由 `core/storage.ts` 的 `storageFile('dock.json')` 推出，
  跟随 `storagePath` 设置（未设/空时回退 `CONFIG/STORAGE`）—— 与其他域同一条口径。
- 写者仍是**只有 bz**，一个文件一个写者这条不变量不变。版本 `v: 1`，不认识的版本一律当没写过
  （与本仓「不认识的版本拒绝、不猜」同口径）。**不做段级合并写** —— 那是给双写者文件准备的
  （见 `news.json` / ADR-0128 的教训），这里没有第二个写者。
- 两个开关缺省都是**开**（键缺失 / 形态不对即开），与旧口径（`!== false` 即开）一致。
- 写侧带 `writeIfChanged`：反复点面板开关、台账无变化时不刷 mtime（Syncthing 止血）。

**读侧走内存快照**：这些数据要被**同步**读 —— 设置行的 `get`、启动时按登记表注册直达运行命令、
调度器每轮判据。vault 读写是异步的，所以 `loadDockStore()` 读一次进模块级快照，
读侧一律走 `dockStoreSnapshot()`；刷新点是 **onload / 每次打开面板 / 每轮调度 tick**
（`ui.ts::refresh`、`scheduler.ts::tick`、`main.ts::onload`）。

### 2. 授权**不搬** —— 留在插件设置的 `dockTrust`

这是本轮唯一的**安全决策**，值得写清理由。

`dock.json` 住在 **vault 里**。vault 会同步（Syncthing / iCloud / 坚果云）、会进 git、
会被整个打包分享。若授权也随它走，那么**别人给你一份 vault，就同时带来了「这条命令已授权」**
—— 对上一个 `manifest.json` 里签名相同的命令，调度器到点就替他跑起来。
这正是 ADR-0235 要挡的那件事（原话：「打开别人的 vault = 在他机器上执行任意命令」）。

所以：

- **登记表可以随 vault 走**（「我登记过哪些工具」不是授权）；
- **授权必须留在本机**（插件设置 `dockTrust`）—— 与「凭据不进 vault」（ADR-0235 决策 2）同一精神。

两条硬约束：

1. **文件里的信任字段一律剥掉/忽略**。`dock.json` 的条目是唯一真理源之外的一份数据，
   谁都能往里塞 `trustedAt` / `trustedRun`；照收即等于「别人的 vault 替我授权」。
   `data.ts` 的 `entriesFromFile` 读完就剥，`entriesToFile` 写前也剥。
2. **撤销信任 = 从 `dockTrust` 删一条，不动 `dock.json`**。「取消授权」与「这个工具登记在册」
   是两件事，前者不该改后者的文件。

### 3. 设置面板新增「信任」组（逐工具一行）

用户要求「可以在设置面板里调整」，且管到**逐工具一行**。该组只做两件事：

- **「已信任的命令」** —— 每行一个已授权的工具（主文案 = 声明里的名字，副文案 = 那条命令），
  动作钮「撤销信任」。
- **「还没确认的命令」** —— 每行一个未授权的工具，动作钮「信任这条命令」。

约束：**授权对象永远是声明文件里现读出来的那条命令**（`runSignature`）——
设置页**不提供「手写一条命令」的入口**。一旦能在这里凭空造一条信任，ADR-0235 决策 §3
（不允许从别处直接改要执行的命令）就白写了。若某工具的声明读不到 `run`，点授权会跳过它并
提示「去工具坞面板里确认」，而不是替它编一条。

这与面板里的 `trustStale` 是**同一把尺子**：声明里的命令一改，签名对不上，信任即自动作废，
回到「待确认」。

### 4. 迁移：一次性，读旧写新删旧

`migrateLegacyDockSettings(loaded)`（`store.ts`）沿用 main.ts 既有的迁移范式：

- 四把旧键**读出**：老登记项里的 `trustedAt` / `trustedRun` **摘出来归 `dockTrust`**，
  其余部分（剥掉信任字段）当 `dock.json` 的**种子**；
- 四把旧键从设置对象里**删掉**（`loaded`），由 main.ts 既有的「有迁移即 saveSettings」分支统一落盘
  （本函数不抢那把笔）；
- **种子只在 `dock.json` 此前不存在时落盘** —— 文件已存在说明搬过家（或用户已经用过面板），
  任何情况下都不用旧设置覆盖它。搬家因此**只发生一次**，重复启动不会把面板里改过的值冲掉。
- 与其余迁移函数同口径：`loadData()` 在全新 vault（还没有 `data.json`）上返回 `null`，
  先挡一道（`!raw || typeof raw !== 'object'` → 不迁移）。

## 明确不做

- **不把授权做成「按 vault」的**。将来若要「一个 vault 一组授权」，那是另一个话题，
  但不会走「随 vault 同步」这条路（同一条理由）。
- **不做段级合并写**（`dock.json` 只有 bz 一个写者）。
- **不动工具侧那三份**（`manifest.json` / `data.json` / `runs.json`，仍住工具目录，ADR-0237 不变）
  —— 注意两个 `data.json` 同名不同处，别混。
- **不升工具契约版本**（`v` 维持 1）：工具侧一个字段都没变。

## 后果

- **域数据全部收敛到 `storagePath`**：换存储路径 dock 面板数据跟着走；备份数据目录不再漏它。
- **vault 的泄露面收窄**：`dock.json` 里只剩「登记了哪些工具、跑成什么样」，
  不含任何「已授权执行」的记录 —— 分享 vault 不再顺带分发执行权。
- `BzSettings` 去掉 `dockTools` / `dockRunState` / `dockAutoRun` / `dockNotifyMissed`，
  新增 `dockTrust`；新文件 `src/dock/store.ts` 承载装载 / 迁移 / 写入口；
  `index.ts` 转出 `loadDockStore` / `migrateLegacyDockSettings` / `dockStorePath`。
- 评审壳（`prototypes/dock/fake-sim.ts`）的种子随之改：面板数据摆进 `dockStorePath()`（`dock.json`），
  设置里只留 `dockTrust`（壳不演授权 —— 那要走真的确认对话框）。
- **要认的代价**：换 vault / 换机器后，每个工具**重新授权一次**。这是这条安全边界的定义本身，
  不是副作用；文档（guide §8、CONTEXT「工具信任」）明说。
- 参考实现随前几批已搬到 `E:\Obsidian\叫我包仔\CONFIG\SCRIPTS\DockTools\iamtxt-signin\`；
  `docs/dock-tool-guide.md` §8 的旧路径（`E:\Obsidian\dock-tools\daily-signin\`）本轮一并改口。
