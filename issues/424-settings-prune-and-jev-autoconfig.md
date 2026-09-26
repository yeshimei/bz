# 424 设置项瘦身（第二大脑四行 + IP/远程地址两行）与 JEV 常开自动配置

- 状态：已实现（2026-09-24）
- 关联：ADR-0184（决策）、ADR-0182/issue 422（Embedding 模型迁 AI 面板）、
  ADR-0183/issue 423（两行 Ollama 地址迁 AI 面板 + 启动自动补全）、ticket 122（本机局域网 IP 自查行）

## 用户原话（五张截图逐条）

1. 图一（第二大脑 · 检索）：删除「段落最小长度」「上下文限制」两项设置，**不做限制**。
2. 图二（第二大脑 · 检索）：删除「防抖延迟毫秒」「光标轮询毫秒」两项设置，**作为固定值**。
3. 图三（第二大脑 · 服务）：删除「本机局域网 IP」设置行。
4. 图四（AI 面板 · Embedding）：删除「移动端远程地址」设置行。
5. 图五（AI 面板 · JEV）：删除「启用 Jev 判定」（**默认启动，无需设置**）；
   「Jev 端点」改为 **LLM 同款的 AI 服务商**（目前仅支持 Typesafe）；去掉「Jev 超时」；
   「JEV 模型在线获取吗？如果不行，默认就是最新的」。

## 逐项结论

| 项 | 原状 | 处置 |
|---|---|---|
| 段落最小长度 | number 行（`secondBrainChunkMinLength`） | 行删、键退役；分块全留（`minChunk = 1` 缺省） |
| 上下文限制 | number 行（`secondBrainContextLimit`） | 行删、键退役；不再截断上下文 |
| 防抖延迟毫秒 | number 行（`secondBrainDebounceDelay`） | 行删、键退役；固化 `SEARCH_DEBOUNCE_DELAY = 300` |
| 光标轮询毫秒 | number 行（`secondBrainCursorPollInterval`） | 行删、键退役；固化 `CURSOR_POLL_INTERVAL_MS = 500` |
| 本机局域网 IP | info 行 + 「填入远程 URL」按钮（ticket 122） | 行删（含移动端引导行）；探测与写入全自动 |
| 移动端远程地址 | AI 面板 text 行（issue 423 迁入） | 行删；写入改由启动自动跟随（仍读同一键） |
| 启用 Jev 判定 | toggle 行（`jevEnabled`） | 行删、键退役；判定常开（有密钥即用，无密钥回落 LLM） |
| Jev 端点 | text 行（`jevEndpoint`） | 改为 select「Jev 服务商」+ 注册表（现仅 Typesafe） |
| Jev 超时 | number 行（`jevTimeoutMs`） | 行删、键退役；固化 `JEV_DEFAULT_TIMEOUT_MS = 10000` |
| Jev 模型 | text 行（`jevModel` 默认 `jev-1.13.0`） | 行保留 + 行内「获取模型」选择器；默认改 `jev-latest` |

## 方案

### 一、第二大脑（issue 424 主体）

- `src/secondbrain/config.ts`：新增 `SEARCH_DEBOUNCE_DELAY = 300`、`CURSOR_POLL_INTERVAL_MS = 500`；
  `SecondBrainConfig` 去掉 `chunkMinLength`/`contextLimit` 两项。
- `src/secondbrain/chunk.ts`：`embedChunks(content, title, minChunk = 1)`、`smartChunk(text, minChunk = 1)`
  ——不传即全留；`vector-store.ts` 不再读设置取 `minChunk`。
- `src/secondbrain/panel.ts`：检索组只留「参考结果数 TopK」「对话参考结果数」；
  服务组只留「额外检索目录」。
- 迁移 `migrateRetiredSecondBrainKeys`：删四键，无旧键返回 false（C16 幂等，不重复落盘）。

### 二、远程地址自动跟随（承接 issue 423，用户拍板「自动跟随本机 IP」）

- `src/secondbrain/local-ip.ts`：`ensureRemoteOllamaUrl()` 由「只补空值」升级为归属判定 + 跟随：
  - 空值 → 写探测值；
  - 当前值 == 上次自动写入的记录（新键 `secondBrainRemoteOllamaAuto`）→ 跟随新 IP；
  - 无记录但形态是本插件写出的 `http://<IPv4>:11434`（存量用户迁移）→ 先认领再跟随；
  - 其余（手改地址，如 `http://192.168.1.99:8080`）→ 一律不动。
- 该函数在 `main.ts` onload 调用一次（桌面端探测；手机端探测不到即不写，静默无提示）。

### 三、JEV 组（常开 + 服务商注册表 + 模型在线获取）

- `src/core/jev.ts`：
  - `JEV_PROVIDER_REGISTRY`（现一项 `typesafe`，含判定端点与模型列表 URL）+ `getJevProviderDescriptor`；
  - `resolveJevConfig` 改为「设置取服务商 → 端点由其注册表决定」，超时固定 10s；
  - `isJevConfigured()` 只看端点与密钥（常开，无总开关）；
  - 新增 `fetchJevModels()`（`requestUrl` 直连 `https://api.typesafe.ai/v1/models`，Bearer 密钥；
    非 2xx / 非法 JSON / 空列表均抛错）+ `parseJevModels`（`models[].name` → id，`description`/`release_date` → detail）。
- `src/core/settings-main-schema.ts`：JEV 组三行 = 服务商 select / 密钥 secret / 模型 text（行内「获取模型」
  走 `openModelPicker`，与 LLM/Embedding 同款；动作 `await` 到弹窗关闭防「点两次才回显」）。
- 迁移 `migrateRetiredJevKeys`：删 `jevEnabled`/`jevEndpoint`/`jevTimeoutMs`；
  存量 `jevModel === 'jev-1.13.0'`（旧默认，线上已下架）改写为 `jev-latest`。

## 落地

- [x] `secondbrain/config.ts` 常量固化；`chunk.ts`/`vector-store.ts` 去设置依赖
- [x] `secondbrain/panel.ts` 四行删除；`local-ip.ts` 自动跟随；`main.ts` 调用点注释更新
- [x] `core/jev.ts` 注册表 / 常开 / 超时固定 / 模型列表拉取
- [x] `core/settings-main-schema.ts` Embedding 两行 + JEV 三行（含获取模型）
- [x] `settings.ts` 三处迁移 + 新键 `secondBrainRemoteOllamaAuto`；`main.ts` onload 接线
- [x] `CONTEXT.md` 三处条目改写；原型 fake-sim 同步

## 测试

- `tests/secondbrain/local-ip.test.ts`：跟随语义 8 例（补全+记录 / 漂移跟随 / 幂等 / 存量认领 /
  手改不动 / 清空重接管 / 无网卡 / 空白值）
- `tests/core/retired-secondbrain-jev-keys-migration.test.ts`（新）：两迁移共 7 例（含幂等）
- `tests/core/jev.test.ts`：配置解析重写 + 模型列表 5 例（解析形态 / 成功路径含 URL 与 Bearer 断言 /
  缺密钥 / 401·坏 JSON·空列表 / 注入 requestUrlFn）
- `tests/core/settings-model-picker-ui.test.ts`：JEV 模型行 2 例（一键回显 / 缺密钥提示且不发请求）
- `tests/core/settings-schema.test.ts`、`settings-input-modes.test.ts`：Embedding 两行、JEV 三行、
  四数值键退场锚点
- `tests/secondbrain/panel-settings-rows.test.ts`（原 `panel-settings-ip.test.ts` 改名）：四行不在场 +
  开设置不探测（桌面/移动同断言）
- `tests/sp-contract-lock.test.ts`：`ai: 12`、`secondbrain: 6`
- 存量 fixture 清理：四键 / `jevEnabled` 相关（`jev-fallback`、`cinema/type-decide`、
  `link-agent-judge-jev`、`embedding-model-switch` 等）

## 门禁

- `vitest run` 全绿（7240 例）
- `tsc --noEmit` exit 0
- `node scripts/build-preview.mjs` → preview-freshness 28/28
