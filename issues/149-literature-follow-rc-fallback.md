# 149 — 修复：文献盒「留空跟随工具配置」被空串覆盖，转写环节必失败

**状态**：✅ 已完成

## 现象（用户实测）

视频录入批量处理跑到**语音转写**环节整批失败，提示：

```
语音转写失败：检查设置里的「Python 路径」与「Whisper 模型」
```

用户到文献盒设置界面查看——两项都是**留空的**（desc 明写「留空跟随工具配置」），形成怪圈：留空 → 报错让去设置填；设置又承诺留空跟随工具配置。

## 根因（代码 bug）

`src/literature/processor.ts` options 组装对「留空=跟随工具配置」的键下发**空字符串** `/''/`：

- `pythonPath: (s && s.literaturePythonPath ? … : '')`

工具侧 `core.js` 合并为 `{ ...deps.conf(rc/DEFAULTS), ...options }`——空串**覆盖** rc 里的可用默认
（本机 rc：`pythonPath: C:/Users/PC/.../Python312/python.exe` 存在、`whisperModel: small`）→
`py = ''`（falsy）→ `core.js:777` 抛「rc 未配置 pythonPath（faster-whisper 所在 Python 路径）…」
→ UI `humanizeError` 匹配 `/faster.whisper/` → 显示「检查设置里的 Python 路径与 Whisper 模型」。

同类隐患：`outputDir`（rc 有交付目录）、`ffmpegPath/ffprobePath`（rc/‘ffmpeg’ 兜底）、`whisperModel`（core `||'small'`）、`cacheDir`。

## 修复

- **processor.ts**：上述六键留空时改**不下发**（`nonEmpty()` 返回 `undefined` → JSON.stringify 自动省略）
  → `core.js` 合并保留 rc/DEFAULTS 兜底；用户显式填写仍正常下发覆盖。`vaultPath`（插件能力）、
  quality/keepVideo/compress/crf/cacheRetentionDays 不受影响。
- **ui.ts `humanizeError`** whisper 分支细分两种，提示更准：
  - 「未配置 pythonPath」（rc 也无兜底）→ `语音转写未配置：请在文献盒设置填写「Python 路径」（留空将跟随工具默认配置）`
  - 「pip install faster-whisper」→ `语音转写失败：faster-whisper 未安装，请在目标 Python 中运行 pip install faster-whisper`
  - 其它 whisper 类 → 原「检查设置里的『Python 路径』与『Whisper 模型』」

## 验收

- processor.test.ts「空设置 options 默认值」用例：断言留空键**不在**下发 JSON 中（toEqual 忽略 undefined），
  其余缺省（quality/keepVideo/compress/crf/vaultPath/cacheRetentionDays）不变；有值用例不变。
- ui.test.ts humanizeError 新增三断言（未配置 / 环境缺失 / 通用 whisper）。
- tsc + 全量测试 + 构建全绿。