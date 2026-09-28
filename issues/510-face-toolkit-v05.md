# 510 · bz-face v0.5：收编缺陷修复 + 录音线对齐 prep + 体检命令

来源：v0.4 收编（ADR-0214）后的全包 review（2026-09-29，用户拍板「全都做」）。
无新架构决策，不开 ADR；本票 = 执行层修复 + 对齐 + 增强。

## 拍板摘要（15 项全做）

**必修（P0 × 2 + 根因）**
- `bz-face rec` 必崩：收编时 `REFS` 从模块级常量变成 `main()` 局部变量，`load_refs()` 读全局 NameError。
- `bz-face refs` 必崩：`labeled_wavs` 单参改双参后 holdout 段调用点没跟上，npz 落盘前 TypeError。
- 根因兜底：Python 层零测试 → 加冒烟门（py_compile 全部脚本 + 临时目录真调 `load_refs` / `labeled_wavs`；python 或 numpy 缺席则跳过）。

**优化（6 项）**
- rec 认 `--ffmpeg`（对齐 prep；插件下发 `ffmpegPath` 设置键）。
- rec 协作式暂停 / 停止（control 文件；按任务派生 `<数据根>/.bz-face/rec-control/<联系人>/<文件名>.control.json`，与 prep 的 control.json 及并发录音互不串台）；插件「停止」先协作后兜底杀。
- blind 降级模式声纹段照常落账进度（中断重头保持，但进度可见）。
- refs 同一联系人只读一遍 chat.json / 列一遍 voice 目录（原三遍）。
- 质心 npz 原子写（.tmp.npz → os.replace）；rec 续跑时 sidecar 的 mode 与本次算出的不一致 → 重置声纹段重算（防两种口径混一锅）。
- vendor 库日志静音（wxManager.log 顶层 FileHandler/StreamHandler 收掉 + 残留 logs/ 拆除；错误走协议行与 stderr）。

**增强（6 项）**
- doctor 补录音环境检查：声纹参考目录与 npz、各联系人 recordings 体量、本地模型权重缓存（缺 = warn 不 fail，首次自动下载）。
- refs 增量构建：全局输入指纹（全部联系人 chat.json 哈希 + voice 目录清单）存进 npz meta，没变直接跳过（「我」池跨人采样，任一变化全体重建）。
- `bz-face status <联系人> --data-root <路径>`：产物体检命令（chat/stats/voice/image/desc/map/recordings/质心各一行，人读纯文本，纯 Node 不起 Python）。
- export `--contacts-file <文件>`：一行一个联系人（# 注释、空行忽略），绕 Windows 8191 字符命令行上限。
- `bz-face capabilities`：一行 `[bz-result]` 报包版本与子命令支持面，供插件探测（旧版 bz-face 到点按钮才失败 → 改成提前人话提示）。
- 插件侧：rec spawn 带 `--ffmpeg`；停止改协作式（写任务专属 rec-control 文件，90s 未退兜底杀）；起跑前 capabilities 版本门（< 0.5 或缺 rec 子命令给人话引导，指引 npm link——本包不发 registry）。

## 任务切分

- [x] T1 包 Python：bz_rec.py（REFS 参数化 + --ffmpeg + rec-control 协作 + blind 落账 + mode 重置）+ bz_refs.py（调用修复 + 单次读取 + npz 原子 + 指纹跳过）+ bz_export.py vendor 日志静音
- [x] T2 包 Node：rec-core --ffmpeg 解析 + export-core --contacts-file + status-core（新）+ doctor 录音环境三项探测 + bin 路由与 USAGE + package/README/ARCHIVE v0.5.0
- [x] T3 包测试：Python 冒烟门（新文件）+ rec/export/doctor 既有测试适配 + status-core 新测试
- [x] T4 插件：recording.ts（spec --ffmpeg + rec-control 停止 + capabilities 探测与版本门）+ ui.ts / render.ts 接线 + 测试（顺带修存量缺陷：停止按钮把文件名当注册表键，原为 no-op）
- [x] T5 门禁全绿 + 合并部署 + changelog + 子代理 review

## 依赖与注

- 插件侧「我池跨人」语义：refs 指纹是全局的——任一联系人输入变了，所有人的 me 质心输入都变，故整体重建；只有全没变才跳。
- rec 控制文件按任务派生的动机（评审 P1 后改定）：prep 的 control.json 是共享通道（464 契约），且数据根级单文件在并发录音下「停 A 连停 B / B 起跑清理吞掉 A 的 stop」——按 <联系人>/<文件名> 派生后各任务各通道。
- capabilities 探测缓存会话级；探测失败（bz-face 缺失/太旧无此命令）返回 null = 放行，让真实 spawn 自己报错，不双重报错。
