# ADR-0219 · 录音账本原子写在 Windows 上的抢占失败（根因 + 修法）

日期：2026-09-29 · 状态：已采纳 · 关联：ADR-0213（sidecar 账本）、ADR-0214（工作收编）、issue 516 第 4 轮

## 背景

现场报错（用户截图，录音处理**最后一个阶段**）：

```
PermissionError: [WinError 5] 拒绝访问。:
  '…\recordings\大琳 周一 10点40分✔️.turns.json.tmp'
  -> '…\recordings\大琳 周一 10点40分✔️.turns.json'
```

读源码 + 实测后，根因是**确定性的句柄冲突**，不是竞态运气、也不是杀毒软件：

- 脚本 `save()`（`tools/obsidian-face/python/bz_rec.py:114`）= 写 `<sidecar>.tmp` → `os.replace`，原子落账
  防半截 sidecar；转写**逐轮落账**（`bz_rec.py:324-348` 每轮一次 `save`）→ 76 分钟录音数百次 replace。
- 插件每秒轮询读同一个 sidecar：`tickRecRows`（每行一次）、`renderNote → recNoteRows`（每秒再一遍）、
  `suppRecState`（每次册页重画把每行都读一遍）。
- **实测**（`.scratch/rec-tmp-lock/`，Node 持一个读 fd + Python 反复 `os.replace` 同一目标）：
  **21 次尝试，21 次全 `WinError 5`**——Node 只要持有读句柄，replace 在整个持有时长内**全被拒**。
  根因：libuv（Node `fs`）在 Windows 开文件**不带 `FILE_SHARE_DELETE`**，而 Windows 的 replace 要覆盖
  目标就必须能删它。
- 影响面：`save()` 无任何保护，**任何一次碰撞都让整个脚本崩** → 录音标「失败」。
  但**转写成果不丢**（逐轮落账），丢的只有收尾的 `phase: "done"` 标记与统计段。

## 决策

1. **脚本侧加重试**：`save()` 的 `os.replace` 包协作式重试（多次 × 短退避：几十次、50–200ms 抖动），
   覆盖插件的毫秒级句柄窗口；tmp 名带 pid 与序号（`<sidecar>.<pid>.<n>.tmp`），杜绝多进程撞同一 tmp。
2. **终失败给人话**：重试耗尽后抛中文原因（"账本被插件占用，重试 N 次仍无法替换"），经
   `[bz-result]{ok:false,error}` 落到行上（issue 516 Q16h 的可读诊断），不再抛裸 traceback。
3. **插件侧降读压（治本的另一半）**：轮询改「先 `stat`（mtimeMs / size）判变化，变了才读内容」。
   `stat` 不占读句柄、不阻塞 replace；open 次数从"每秒每条"降到"每次变化一次"，窗口缩到微秒。
   这是把"必然碰撞"降成"概率≈0"的关键一步——只靠重试也能过，但会白等。
4. **完成度兜底**：sidecar 停在 `transcribe` 但**全部轮次都有 text** → 视为转写完成，可**直接并仓**
   （不为一枚收尾标记白重跑一遍脚本），行上说明"账本收尾标记缺失，已按全部轮次并仓"。
5. **不做**：放弃原子写改就地覆盖。就地写有被读到半截的窗口，解析失败的表现是"这条录音白跑了"，
   比多等几百毫秒严重得多。

## 后果

- 长录音不再因账本替换被拒而整条失败；即使撞上也能自愈（脚本重试）或降级并仓（决策 4）。
- 插件轮询的 CPU / IO 随之下降（`stat` 比 `open+read+parse` 便宜）。
- 测试面：`save()` 注入"前 N 次 replace 抛 PermissionError"的假 fs 断重试路径；插件侧断言轮询在
  mtime / size 未变时**不触发**内容读。
