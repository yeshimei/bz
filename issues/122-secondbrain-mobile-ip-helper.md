# Ticket 122：第二大脑「远程 Ollama URL」移动端防呆——本机 IP 提示 + 一键填入（用户拍板）

- 状态：已实现（master 直改；全量 2922 测试绿 + tsc 0 + 构建部署）
- 域：secondbrain
- 来源：用户反馈「之前手机移动端还能连上电脑的向量大模型，现在连不上了」→ 根因排查 + 四轮盘问拍板（Q4/Q8/Q11/Q12）
- 关联：`src/secondbrain/{panel,config}.ts`、`src/settings.ts`、CONTEXT「远程 Ollama URL」词条

## 根因（真机排查，非代码缺陷）

- 设置 `secondBrainRemoteOllamaUrl = http://192.168.1.8:11434`；实测该地址**超时**；
- 本机（Windows）当前局域网 IP = **192.168.1.45**（WLAN）；实测 `http://192.168.1.45:11434/api/tags` → **200**（Ollama 已绑定局域网接口）；
- CORS 已放行：`OLLAMA_ORIGINS=*`（user/machine 级环境变量），带 `Origin: app://obsidian.md` 实测返回 `Access-Control-Allow-Origin: *`；
- 向量索引完好：`secondbrain.vec` 25MB（dim 1024）、bge-m3 模型在列、当日 07:34 有写入；
- 结论：**DHCP 漂移导致旧 IP 失效**，代码无需回退；把远程 URL 改成本机当前 IP 即恢复。移动端链路（`initMobile` 探活 → `searchMode='remote'`；嵌入式 `embedBase` 移动端优先远程）无需改动。

## 用户拍板（防呆设计）

1. **本次恢复**：用户手动在 bz 设置里把远程 URL 改为 `http://192.168.1.45:11434`（Obsidian 运行中，代码不代改 data.json——会被运行实例覆盖）；实现完成后再由「一键填入」接管；
2. **防呆**：第二大脑 ⚙️ 设置弹窗（Ollama URL 两行附近）新增「本机当前局域网 IP」展示行 + 「填入远程 URL」按钮；点击 → confirm「将远程 URL 覆盖为 http://<ip>:11434？」→ 写 `secondBrainRemoteOllamaUrl`；
3. 仅**桌面端显示**（`isMobileEnv()` 不显示——手机上无「本机」概念；移动端该行改显说明文案）。

## 设计草案（实现参考）

### IP 枚举（桌面端）

- `require('os').networkInterfaces()`（Node 内置模块，Obsidian 桌面端 renderer 可用——obsidian42-brat / pdf-plus 均已在用；**需在本仓库 esbuild.config.mjs 的 external 列表加 `os`** 防 bundle，并确认运行时 require 路径）；
- 过滤：`internal`（127.x）/ `169.254.x`（link-local）；多网卡时按列表展示（WLAN/以太网等 interface 名 + IP），供下拉/点击选择；
- 无结果/非桌面端 → 该行隐藏或显示「无法探测」。

### 设置弹窗接入（`src/secondbrain/panel.ts` build 段）

- 「远程 Ollama URL（移动端）」行下方加一行：`本机当前局域网 IP：192.168.1.45 [填入远程 URL]`（每打开弹窗时枚举一次）；
- 填入动作：confirm（文案含目标地址）→ `set('secondBrainRemoteOllamaUrl', 'http://<ip>:11434')`；
- smcat：确认不覆盖用户故意指向其它机器的情况（Q11 拍板：确认后覆盖）。

## 测试

- 数据层：IP 枚举过滤纯函数（mock `os.networkInterfaces` 注入：过滤 internal/link-local、多网卡排序）；
- UI 层：桌面端显示 IP 行、点击填入弹 confirm、确认后写入设置键；移动端不显示；
- smoke：无新增命令。

## 验收标准

- 桌面端第二大脑 ⚙️ 弹窗显示本机当前局域网 IP；点「填入远程 URL」确认后设置键更新；
- 手机端（同一设置经同步）`initMobile` 探活成功 → 「✅ 远程 Ollama 已连接」，检索走向量；
- 全量测试 + tsc 通过；构建部署产物。