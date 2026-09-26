# 311 AI 通道支持图像输入（多模态）

- 状态：完成（2026-09-14 原型评审迭代，待合并主仓）
- 关联：issues/312（图版入口，本能力的第一消费方）/ ADR-0112（知识盒）/ `src/core/ai.ts`

## 背景

用户 2026-09-14 在讨论「图片作为第四类文献录入」时确认：**DeepSeek 最新的 V4.1 已支持图片**，
要求核对事实并更新 AI 接口层，让 bz 能真把图发给模型。

## 调研结论（2026-09-14，多源一致）

- **DeepSeek V4.1-Flash 于 2026-09-10 发布，原生支持「文 + 图」输入**；官方托管视觉模型 ID = `deepseek-flash`。
  旧的 `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` **保留为指向 V4.1-Flash 的别名** →
  插件现有默认模型名无需改动即可带图。`deepseek-v4-pro`（Pro-0813）仍为纯文本。
- 是**图片理解**，不是图片生成；PDF/文档类不在 Files API 支持范围内（只收图片）。
- 报文 = **标准 OpenAI 多模态 content 数组**：
  `content: [{type:'image_url', image_url:{url}}, {type:'text', text}]`；
  `url` 可为**公网 https 直链**（≤8192 字符）或 **base64 data URL**（本地图唯一可行路径）。
- 格式 **JPEG / PNG / GIF / WebP**；单图 ≤32 MiB（base64 或外链）、单请求最多 600 张、
  长边 ≤8192px（≥15 张时降 4096）、每张处理后最多约 1024 input token。

## 交付

- [x] `AIInput = string | { text: string; images?: string[] }`：`prompt` 与 `chat / reason / search /
  json / reasonAndSearch` 全部拓宽为可带图（**纯文本调用报文与旧版逐字节一致**，`messages[0].content`
  仍是字符串——零回归）。`json` 一并拓宽，因为知识盒等域走的就是 `ai.json()`。
- [x] 带图时 content 变多模态数组：文本在前、`image_url` 在后（DeepSeek 文档示例把图放前，顺序对结果无影响）；
  空串/非串图片项丢弃，**全被丢弃则退回纯文本**（不发空图片组）。
- [x] `imageDataUrl(bytes, mime)`：本地图片字节 → data URL（分块 `fromCharCode` 防大图爆栈）；
  空图与超 32 MiB 直接抛错（由调用方决定压缩或换图）。**不引 `arrayBufferToBase64`**——
  走纯实现，插件与评审壳共用，不必再给两套 mock 补 API。
- [x] `imageMimeOfPath(path)`：只认 DeepSeek 接受的四种格式，其余（svg/avif/bmp…）返回 null，
  调用方据此提示或转码。`AI_IMAGE_MAX_BYTES` 导出供调用方预检。
- [x] **带图请求的空闲超时放宽到 180s**（`AI_IMAGE_IDLE_TIMEOUT_MS`）：图片以 base64 进请求体（可达数 MB），
  上行慢时 60s 阈值会把正常上传误判成 TimeoutError → 还会再走一次 requestUrl 把图白传两遍。
  阈值由 `idleTimeoutOf(body)` 就地判定（body 里有 `image_url` 部件即放宽），不改函数签名。

## 不做 / 待定

- **不改供应商注册表的模型名**：`deepseek-v4-flash` 在官方直连下已是 V4.1-Flash 别名；
  而默认 provider 是第三方代理（opencode-go），其模型命名自成一系，改名有把用户默认跑挂的风险。
  真正的判据是运行时：带图请求若被拒（模型不透传），由消费方（图版入口）降级处理。
- 未加 `vision: boolean` 之类的注册表能力位——无法逐个核实各家的视觉支持，宁缺勿造。
- 未做客户端压缩/缩放（大图先缩再发更省 token）；由图版入口按需补，不塞进传输层。

## 验收

- `pnpm exec tsc --noEmit` 0 错；`tests/core` 659 例全绿（新增 6 例：多模态数组组装、空图退回纯文本、
  `json` 同时带 `response_format` 与图片、`imageDataUrl` 编码/空图/超限、`imageMimeOfPath` 白名单）。
- 既有纯文本路径无回归：原「fetch 流式请求参数」用例仍断言 `messages == [{role,content:'请回答'}]`。
