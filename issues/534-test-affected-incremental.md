# 534 · 增量跑测试：不用 vitest 原生 `--changed`/`related`，自建选择器 + 结果缓存

## 起因

评估「只跑受影响测试」的可行性（2026-10-01）。要求三条：只跑受影响；未变更且依赖未变的
测试复用上次成功结果；全量作为兜底。

**结论：原生方式在本仓是一条假绿通道，不能用；自建选择器 + 结果缓存落地。**

## 一、实测：原生 `--changed` / `related` 的问题

本机（16 逻辑核、fsModuleCache 热、2026-10-01 HEAD f14541fc，全量 **29.2s**）：

| 变更对象 | `related` 命中 | 墙钟 | 实际必须跑的守卫 |
|---|---|---|---|
| **无任何变更**（`run --changed master`） | **0 文件** | 0.56s | —（**退出码 0**） |
| `src/memo/styles.css` | **0 文件** | 5.7s | `tests/memo/skin-dark.test.ts`、`verdict-styles-structure`、`mobile-ui-3fix` |
| `src/core/ui/components.css`（界面级单源） | **0 文件** | 5.8s | `tests/core/ui-scrollbar.test.ts`（ADR-0122） |
| `pnpm-lock.yaml` | **0 文件** | 5.4s | 全体（依赖变更） |
| `src/memo/data.ts` | 59 文件 | 18.2s | 域内 |
| `src/core/settings-schema.ts` | 189 文件 | 23.9s | 逼近全量 |
| `tests/setup.ts` / `tests/mock-obsidian-entry.ts` / `tests/mock-vault.ts` | 588 / 423 / 285 | — | ✅ 这类没问题 |

四条硬伤：

1. **纯样式变更 0 命中且退出码 0。** 样式只被测试以文本方式读取（`readFileSync`），模块图里
   没有这条边。而仓库的样式单源守卫（铁律 3/9、ADR-0122、ADR-0199）**正是靠读源码文本断言的**
   —— 改样式 = 假绿，护栏被拆还亮绿灯。
2. **固定开销 5.4–5.8s。** 读实现：`filterTestsBySource → getAffectedModules` 会对**全部 spec**
   逐个 `transformRequest` 建反向边表。它不是 git 侧的轻量计算，而是「全量 transform」的成本。
3. **命中面大时反超全量。** 189 文件 23.9s、285 文件 27.1s，全量 29.2s —— 增量白干。
4. **`--changedSince` 已移除**（vitest 1.0 起并入 `--changed [since]`）。
   另：`forceRerunTriggers` 默认值 `["**/package.json","**/{vitest,vite}.config.*"]` 在 Windows 下
   **失效** —— 匹配对象是 `path.resolve()` 的反斜杠路径，picomatch 实测
   `'D:\...\package.json' → false`、`'D:/.../package.json' → true`。`pnpm-lock.yaml` 两条通道都没兜底。

> 另注：现有 `pnpm test:changed`（= `vitest run --changed master`）在本机还因 pnpm shim 路径错乱
> 直接 `MODULE_NOT_FOUND`（解析成 `D:\d\Obsidian\bz\node_modules\vitest\vitest.mjs`）。
> 一个「跑了 0 个用例还报成功」且**根本起不来**的命令，留着比没有更危险。
> 同一个 shim 问题在 **Git Bash 里连 `pnpm test` / `pnpm exec tsc` 都起不来**（路径被解析成
> `D:\d\Obsidian\...`），PowerShell 下正常 —— 新脚本一律用 `process.execPath` 直调，绕开 shim。

## 二、根因：模块图看不见「读文本」的依赖

| 依赖建立方式 | 测试文件数 |
|---|---|
| 静态/字面量动态 `import` | 535 |
| **完全没有 src import 边（纯文本断言）** | **45**（其中 37 个直接读源码） |
| 两者都有 | 53 |

那 37 个零 import 边的正是**跨域不变量守卫**：`render-purity`、`home/deps-direction`（ADR-0002
依赖方向）、`core/css-aggregation-manifest`、`core/skin-pack-split-guard`、`core/d3-write-gate`、
`core/ui-scrollbar`、`preview-freshness`、`scripts/test-*`、各域 `skin*`/`style-fix*` 守卫。
它们只在**自身**被改时才被选中 —— 而它们守的恰恰是「别人改的东西」。

vitest 的图只看 `transformed.deps ∪ transformed.dynamicDeps`，**永远看不见 `readFileSync`**。

## 三、方案：`scripts/test-affected.mjs`

不建 module graph（省掉 5.5s），改用**静态扫描自建依赖索引**（冷建 ~0.4s，含 node 启动的整条
`--list` 流程 0.76s），建三类边：

| 边 | 来源 | 例子 |
|---|---|---|
| import 边 | `from` / `import()` / `require` 的相对路径 | `tests/memo/ui.test.ts → src/memo/ui.ts` |
| **文本边** | 字符串字面量里**真实存在**的仓库路径（**含藏在变量/helper 里的形态**） | `repo('src/core/ui/components.css')` |
| **目录/整树边** | 扫树守卫的目录实参（`readdirSync(...)` 上下文） | `listDomainStyles('src')` → 整棵 src |

实测建边结果：**111 个测试有文本边**（281 条文件级 + 58 条目录级），**其中 43 个含整树级**，
其余精确绑定到本域 —— 这比「一律常跑 96 个守卫」精确得多。

**目录边在指纹里的分母 = git 可见全集（tracked ∪ 未跟踪未忽略），不是 `src/`**（自审抓到的 P0）：
初版展开成 `for (const f of srcFiles)`，于是索引根之外的目录边（`downloads/`、`manual/`、
`prototypes/`、`tools/`）会**选中守卫却一个文件都没进指纹**，`applyCache` 拿旧 pass 一复用 ——
**选中 ≠ 会跑**，是确定性漏测而不是理论风险。改成与变更集同口径后，新增 / 删除 / 修改都会改指纹
（被删的 tracked 文件留在集合里、内容按 `missing` 计），`node_modules` 等被忽略目录不进来
（它们永不出现在变更集里），非 git 目录（测试夹具）退回磁盘扫描。

**文本边的判定依据是「路径在仓库里真实存在」，不是「根目录 ∈ {src,tests,scripts}」**
（初版用了白名单，被自己的自审打回）：`downloads/manifest.json`、`tools/obsidian-face/lib/*.js`、
`prototypes/**`、`manual/**` 这些**索引根之外**的路径一样有守卫在读，白名单把它们全挡在门外，
只能靠升格兜底 —— 而「一律全量」在那几格既不必要又不快（改 `downloads/manifest.json` 实际只
影响 5 个测试，全量要跑 589 个）。现在按存在性判定，这三类目录都走精确选择。
代价是要挡住「不是路径的字符串」：廉价形状过滤（含 `/` / 带文件后缀 / 是仓库根的一级目录名）
把 statSync 从 1.66 万次压到 2.8 千次 —— 不压这层，冷建索引要 1.57s。

### 三条硬升格（宁可全量，不许漏测）

1. 依赖/清单（`package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml`）、测试与构建配置
   （`vitest.config.ts`/`tsconfig.json`/`esbuild.config.mjs`）、测试基建（`scripts/**`）、
   **`tests/` 下的一切非测试文件**（共享夹具是开放集合）→ 全量
2. `src/core/**` 的 `.ts` → 全量（实测 500/588 个测试依赖 core，增量跑 500 个 ≈ 全量）
3. `src/**` 文件**新增/删除/改名** → 全量；改动文件**无测试可达** → 全量（可能是注册型入口）；
   `.css` 若**没有任何守卫引用它** → 全量（改了没人查不能默默过）
4. **依赖图外、且没有任何文本边/目录边盖住它**（典型：根 `main.js` 构建产物、`.gitignore`、
   新加的顶层目录）→ 全量。`.md` 例外：仓库里没有任何测试把文档当输入。
   「有没有边」这一条是 3 的补充：`src/tests/scripts` 之外的文件不是天然该全量，
   有守卫读它就精确跑，**真·无主**才全量。

### 结果缓存（第二条要求）

- key = `TOOL ‖ LOCK ‖ CONFIG ‖ HARNESS ‖ ENV ‖ 依赖闭包内容 hash`
  （harness 分片含 node/pnpm/vitest 版本、锁文件、`vitest.config.ts`、`tsconfig.json`、
  `scripts/test-workers.mjs`、`tests/setup.ts`、两个 mock、`BZ_TEST_MAX_WORKERS`、**本地日期**、
  **工具自身的 sha256（`tool:`）**）。`tool:` 不能省：少了它，改选择口径（如目录边从只展开 src
  改成展开全目录）后旧 rows 的 key 算法已变却仍「对得上」，**修复会被旧缓存原样继承**；
  字段形状另有 `CACHE_VERSION` 闸（version 不符整包丢）。内容按**字节**哈希（不按 utf8），
  否则 `downloads/`、`prototypes/` 下的图片/HTML 会被 U+FFFD 归一化，不同文件撞同一个指纹
- **只复用 `status = pass`**；fail 一律重跑。**靠 retry 救回的 flaky 认不出来**：vitest 的 json
  报告里没有 `retryCount`（实测 `assertionResults` 只有 status/duration），要区分得自挂 reporter
  读 `diagnostic().retryCount`，代价大于收益；与本仓 `retry: 2`「flaky 抖动自动吸收」同一口径
  —— 该用例本轮确实通过，不是漏测
- **只要本轮退出码 0 就写回**（增量跑也写）。缓存是**按文件**的：某文件本轮 pass 且其依赖
  闭包指纹一致，这个 pass 就成立，与「本轮一共跑了几个文件」无关；没跑到的文件保持原条目不动，
  不会被增量结论伪造成通过。原子写（并发 worktree）
- 落 `.bz-test-cache/results.json`（gitignored）

> **不要用 vitest 自带的 `results.json`**：它的键是测试路径、变化判定只看**文件 size**
> （`FilesStatsCache = Pick<Stats,'size'>`），没有内容/依赖指纹，只能做 watch 重跑提示。

## 四、实测收益

| 变更 | 选择器判定 | 墙钟 | 对照 |
|---|---|---|---|
| `src/memo/styles.css` | 增量 23 文件 | **11.5s** | 原生 0 文件假绿 / 全量 29.2s |
| `src/core/ui/components.css` | 增量 28 文件 | **11.4s** | 原生 0 文件假绿 / 全量 29.2s |
| `src/memo/data.ts` | 增量 75 文件 | **14.7s** | 原生 59 文件 18.2s / 全量 29.2s |
| `downloads/manifest.json`（索引根之外） | 增量 **5** 文件 | — | 白名单版会全量 589 |
| 根 `main.js`（构建产物，无守卫读它） | 全量 589 文件 | — | 没边 → 兜底 |
| `docs/changelog.md` | 增量 0 文件（**出提示，不静默**） | 0.8s | — |
| `pnpm-lock.yaml` | 全量 589 文件 | 29.2s | 原生 0 文件假绿 |
| 磁盘无变化（缓存全命中） | 0 文件待跑 | **0.82s** | — |

原生命令（`related`）在**覆盖率更低**的同时还**更慢** —— 固定开销 5.5s 是白付的。

## 五、验收

`tests/scripts/test-affected.test.mjs`（36 项，node 环境）：

- 三类边都真的建得起来（含「路径藏在 helper 里」这种原生抓不到的形态；含目录实参带尾斜杠
  `'src/big/'` 的写法）；
- 文本边**不限索引根**（`downloads/`、`tools/` 下的真实路径也建边），且**不认不存在的路径**
  （URL / `D:/` 绝对路径 / `.obsidian/...` vault 路径 / 含空格的句子 / 夹具假路径一律丢）；
- 硬升格该全量时全量、不该全量时**别**全量；「依赖图外」按**有无边**分流；
- CLI 参数：`--since master` 与 `--since=master` 等价、`--since` 空值按没传处理、
  `--` 之后一律透传、`--full`/`--list`/`--no-cache`/自带 reporter 都认得出；
- 缓存：内容变 / 依赖变 / harness 变（含**工具自身**）→ key 变；只复用 pass；
  `updateFromReport` 只回写本轮跑过的；**目录整树边展开到索引根之外**（改 / 增 / 删
  `downloads/**` 都要改指纹，且选中后不得被旧 pass 复用）；
- **真实仓库回归（防回到假绿）**：改 `src/memo/styles.css` 必须命中
  `tests/memo/skin-dark.test.ts`；改 `components.css` 必须命中 `tests/core/ui-scrollbar.test.ts`；
  改锁文件必须全量；改域内源码必须命中三个整树守卫（依赖方向 / 渲染纯度 / 聚合清单）；
  改 `downloads/manifest.json` 必须命中 `skin-pack-catalog`（**且不是全量**）；
  改根 `main.js` 必须全量；**整树边的 deps 里必须真的有 `downloads/skins/**`、且不混进
  `node_modules`**；**本测试文件自身的字面量边必须恰好是 `package.json` / `tests/setup.ts` /
  `scripts/test-affected.mjs` 三条**（多一条就是自指边回归）。

> 测试文件里**不许出现指向真实仓库的路径字面量**（夹具用假名，真实路径从
> `tests/scripts/affected-repo-paths.ts` 取）：否则这些字面量会被选择器当成文本边读走，
> 轻则自指噪声，重则把「改构建产物 → 全量」这类兜底压掉 —— 测试自己变成假绿源。
> 这条纪律已由上面最后那条断言**强制**：实测踩坑来源就是夹具里为测「不像路径的字符串」
> 写下的裸 `'tools'` / `'downloads'`，它们在真实仓库里正好是根一级目录名。
>
> 另一处实测坑：**`fileKey` 不是索引的纯函数**（目录边现读磁盘展开）。测试里必须在变更发生的
> 那一刻把指纹钉进变量；事后再拿同一个 `index` 重算，算出来已是变更后的口径，两边「一致地错」，
> 断言永远为绿（本轮就是这样假绿了一次）。

## 六、命令

```bash
pnpm test:affected                     # 相对 HEAD 的未提交改动（开发循环）
pnpm test:affected --since master      # 分支上相对主线的全部改动（--since=master 同义）
pnpm test:affected --list              # 只看选择结果与理由，不跑
pnpm test:affected --full              # 强制全量并刷新结果缓存
pnpm test:affected --no-cache          # 忽略缓存
pnpm test:affected -- src/memo/data.ts # 显式指定变更文件（诊断/回归用）
pnpm test:affected -- --reporter=dot   # -- 之后透传给 vitest（自带 reporter 时本轮不写缓存）
pnpm test:changed                      # = test:affected --since master
                                       # （旧的原生版本改名 test:changed:vitest 留作诊断）
```

**门的纪律不变：合并前仍跑全量 `pnpm test`。** 增量只是开发循环的加速器，
其结论不是门禁结论。

## 七、明确不做（连同本次测掉的负结果）

- **Turborepo / Nx / Bazel**：单包、无包图，它们要解决的问题在本仓不存在。
- **远程缓存**：17 个 worktree 同机、各自 `node_modules`，一个共享缓存目录就够；
  且现在**没有任何 CI 配置**，跨机复用无落点。
- **测试提速（本轮测了但没做，负结果留档）**：
  - `tests/setup.ts` 的 `afterAll` 排空窗口 60ms → 5ms：**墙钟没有变快**（33.8s → 34.4s），
    却立刻冒出 4 个 Unhandled Rejection。这段不是杠杆，别动。
  - `tests/encrypt/ui.test.ts` 的 27 处等待是**真实 PBKDF2 计算**（文件内已注明「CPU 时间省不掉」），
    假钟化对它无效。
  - 最慢文件的耗时普查：显式 sleep 只占其自身耗时的 1.5%–26%，其余是 DOM 构造 / 力导向布局 /
    moment 日期运算 —— 剩余提速 ROÏ ≈ 1–2s 墙钟，不值得为此动 588 个测试文件。
  - 真正的杠杆在**少跑文件**，也就是本 issue 的选择器（29.2s → 11–15s）。
