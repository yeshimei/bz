# 423 · Ollama 地址两行迁入 AI 面板（桌面端启动自动补全）+ 模型选择器「选中两次才变」修复

- 状态：已实现（2026-09-24）
- 用户原话①：「第一个和第二个能够自动获取吗？如果能自动获取的话，就不需要显示这个输入框。如果不行，那就放在AI当中去，第三个就不需要删掉」
  （截图 = 第二大脑设置弹窗「服务」组的「Ollama 本地 URL」「移动端远程地址」「本机局域网 IP」三行）
- 用户原话②：「获取模型需要选中两次，输入框内容才会变化」（截图 = AI 面板「Embedding 模型」行 + 「获取模型」按钮）
- 关联：ADR-0183（本票决策固化）/ issue 422 + ADR-0182（Embedding 行迁入 AI 面板，本票是同一搬迁的收尾）/ ADR-0002（依赖方向：core 不 import 域）/ ticket 122（局域网 IP 行与「填入远程 URL」出处）/ ticket 173（「获取模型名」范式）/ issue 291（「填入便利值」不标 danger 的评审口径）
- 号位说明：422 之后取 423；ADR 取 0183

## 现状（改动前）

第二大脑设置弹窗「服务」组三行：

| 行 | 形态 | 值从哪来 |
|---|---|---|
| ① Ollama 本地 URL | 输入框（键 `secondBrainOllamaUrl`） | 用户手填；默认 `http://127.0.0.1:11434` 走约定 |
| ② 移动端远程地址 | 输入框 + 「填入远程 URL」按钮（键 `secondBrainRemoteOllamaUrl`） | 用户手填；按钮 = 探测本机局域网 IP → 确认覆盖 |
| ③ 本机局域网 IP | 信息行（动态 desc 列出各网卡 IP） | 探测（`window.require('os')`） |

用户提问：①②能否自动获取？能则去输入框，不能则搬进 AI 面板；③保留。

## 逐行结论（先答问题，再定方案）

1. **① 不能自动获取**：它编码的是「Ollama 跑在哪台机器、哪个端口」——本机装、另一台机器装、换端口，都不是约定能推出来的事实（默认值只是「留空时按 11434」的兜底）。**故按用户第二分支处理：搬进 AI 面板**。
2. **② 桌面端能、手机端不能**：桌面端探测 `os.networkInterfaces()` 取局域网 IP + 默认端口即得；手机端 `window.require` 不存在（`getLanIPs` 恒空），手机连的永远是**电脑**的 IP，自身探测无意义。**故：桌面端启动自动补全（只补空值），输入框保留（可手改、可见当前值），手机端只读同步值**。
3. **③ 按用户要求保留**：改为「本机 IP 是多少」的唯一现场自查点，并承接从②迁来的「填入远程 URL」按钮（DHCP 漂移时原位刷新，能力不丢）。

## 方案

**搬迁**（`core/settings-main-schema.ts`）：AI 面板「Embedding」组行序变为 **Ollama 本地 URL → 移动端远程地址 → Embedding 模型**（先知道服务在哪台机器，再拉它的模型列表）。两行是普通 `text` 行（`inputMode: 'url'` + trim 落盘），键 `secondBrainOllamaUrl` / `secondBrainRemoteOllamaUrl` 不变——`secondbrain/config.ts`、`vector-store`、`weekly`、`link-agent` 的消费口径零改动。

**自动补全**（`secondbrain/local-ip.ts` 新增两函数，`main.ts` onload 调一次）：

| 函数 | 语义 |
|---|---|
| `detectRemoteOllamaUrl(lanIPs?)` | 主网卡 IP + 11434 → URL；探测不到 → `null`（纯函数，测试直喂网卡列表） |
| `ensureRemoteOllamaUrl(lanIPs?)` | **仅当设置为空**时写入探测值 + 落盘；已有值/探测不到/手机端 → 不动、不提示 |

只补空值的理由：用户手改过的值（如 Ollama 装在另一台机器）是**真实意图**，自动覆盖会静默改坏连接目标。补全静默无通知（无变化即无打扰）。

**按钮改挂**（`secondbrain/panel.ts`）：「填入远程 URL」从②移到③（探测展示与按钮同处，自查自修不跨页）；确认框文案改指「AI 面板的「移动端远程地址」」（设置项新家）。②在 AI 面板仍是可编辑输入框——字段没锁死，用户随时改回。

**选择器回填修复**（`core/settings-main-schema.ts`，两处：`embeddingModelRow()` 与 `providerModelCustomRow()`）：
两渲染器（`core/settings-schema.ts` / `settings-panel/renderer.ts`）都在**动作 Promise 完成后**才重读绑定回填输入框显示值，而 `openModelPicker` 是「打开即返回」的弹窗——动作瞬间 resolve → 立即回填**旧值** → 用户再点选（写内存）时输入框早已回填完毕，不再刷新，表现为「选中两次才变」。修法：`await new Promise<void>((resolve) => openModelPicker({ …, onClose: () => resolve() }))`，等选择器真正关闭再让动作收口。`onClose` 在「选中关闭」与「取消（遮罩/Esc）」两路都触发一次，故 Promise 必有归宿、不回填悬空。

## 落地

- [x] `core/settings-main-schema.ts`：`ollamaAddressRows()` 新增（两行 + trim 落盘）；`embeddingGroupRows()` = 地址两行 + 模型行；两处选择器调用改 `await onClose` 收口；模块头 issue 423 注脚。
- [x] `secondbrain/local-ip.ts`：`detectRemoteOllamaUrl` / `ensureRemoteOllamaUrl`（新增）+ 头注。
- [x] `secondbrain/panel.ts`：「服务」组只留③（挂「填入远程 URL」）与移动端提示行、额外检索目录；`fillRemoteOllamaUrl()` 抽函数；`lanIpDesc()` 两分支文案改指 AI 面板。
- [x] `secondbrain/index.ts` + `main.ts`：导出并在 onload 调 `ensureRemoteOllamaUrl()`。
- [x] 原型行为包重建（6 域：gameshelf / home / memo / review / secondbrain / settings-panel）。

## 测试

- `tests/secondbrain/local-ip.test.ts`：`detectRemoteOllamaUrl`（探测到/空列表）+ `ensureRemoteOllamaUrl` 四路（空值补 + 落盘 / 有值不动不落盘 / 无网卡不写 / 空白值视为空）。
- `tests/secondbrain/panel-settings-ip.test.ts`：③行 desc + 按钮在**本行**（确认覆盖 + 落盘）；迁移无残留（DOM 无「Ollama 本地 URL」「移动端远程地址」行）；移动端提示行无按钮、不触发 `window.require`；无 IP 时通知「未探测到本机局域网 IP，请在 AI 面板手动填写」且不落盘。
- `tests/core/settings-model-picker-ui.test.ts`：**回填时机回归**——Embedding 行与 LLM 模型行各「一次点击即刷新显示值」（旧实现此值恒为旧值，`waitFor` 超时）+ 取消（遮罩）不改值、弹窗关闭。
- 结构断言同步：`tests/core/settings-schema.test.ts`（Embedding 组三行：名称/键序/desc/无「填入远程 URL」）、`tests/core/settings-input-modes.test.ts`（第二大脑不再有该两键 + AI 组两 URL 行 inputMode）、`tests/sp-contract-lock.test.ts`（ai 9 → 11、secondbrain 13 → 11）、`tests/sp-fix-batch.test.ts`（F-2 焦点 flush 的锚点行随迁移改指 AI 面板）。

## 门禁

`pnpm test`（7222 passed / 0 failed）+ `tsc --noEmit` + 原型 freshness 28/28。

## 子代理 review 结论（2026-09-24）与处置

无阻断项。onClose 四路（选中/遮罩/Esc/重开）均恰好触发一次、await 不会永挂，已逐行核过。

| 建议 | 处置 |
|---|---|
| LLM「模型名称」用例在旧实现下也绿（该行有 refreshKey，onPick 内 refreshVisibility 即回填），非真回归锚 | 已改注释如实标注；真锚 = Embedding 行（core）+ 新增的面板渲染器用例 |
| 「取消」用例未断言动作 Promise 确有归宿 | 已补：取消后再选一次，断言输入框仍一次点击刷新（onClose 漏触发则回填链断，此断言即观察点） |
| `local-ip.ts` 把遗留默认串 `http://192.168.1.8:11434` 当手改值跳过 → 老机自动补全失效 | **不改**（保留 ADR-0183 决策 3「只补空值、不覆盖非空值」）。理由：该串是插件自身历史默认（settings.ts 已改默认空），把它当「可覆盖」会引入「静默改坏他机部署」风险；本 vault 实值 `…:11434` 为 192.168.1.45，无影响。记为已知局限 |
| `panel.ts` 移动端提示仍写旧行名「远程 Ollama URL」 | 已改「（移动端需在 AI 面板配置「移动端远程地址」）」 |
| `CONTEXT.md` 远程 Ollama URL 词条仍写旧默认值 | 已改「默认空——enh-sweep-a 起不再写死内网 IP」 |
| 面板渲染器回填时机无测试锚（仅 core 有） | 已在 `tests/settings-panel.test.ts` 补真实路径用例（用户所见就是面板渲染器） |

**锚点有效性实证**：临时把两处 `await new Promise(...onClose)` 注入「立即 resolve」（等价旧行为）后跑锚点——Embedding（core）、面板渲染器、取消后再选三条**全红**，LLM 那条按预期仍绿；还原后 46/46 恢复。即锚点确能抓住「选中两次才变」。
