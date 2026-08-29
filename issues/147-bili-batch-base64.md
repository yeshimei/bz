# 147 — 修复：--batch 参数经 shell 启动 JSON 被对消（改 base64 传输）

**状态**：✅ 已完成（commit 待填）

## 现象（用户实测报错）

视频录入点击批量处理 → 整批立即失败，失败原因：

```
--batch 参数不是合法 JSON：Expected property name or '}' in JSON at position 1 (line 1 column 2)
```

## 根因

插件 `src/literature/processor.ts` `resolveBatchSpawn` 返回 `{ cmd: 'bili-dl', args: ['--batch', <taskJson>], shell: true }`——`.cmd` shim 必须 shell:true，而 taskJson 是含**双引号 + 空格**的 JSON 字符串。Windows 下经 cmd.exe 启动时 cmd 的引号对消/拆分规则破坏 argv：JSON 的 `"` 丢失或变形（实测变成 `{\“…` 形态），第二个字符即非法 → JSON.parse position 1 报错。

（非 Windows 的 POSIX shell 同样会吃引号，属同类隐患。）

## 方案（P2-5）

JSON base64 化传输——base64 只含 `[A-Za-z0-9+/=]`，**无引号无空格**，任何 shell 都不破坏。

- `tools/bili-downloader/core.js`：新增 `decodeBatchArg(raw)`——`b64:` 前缀 → base64 解码后 JSON.parse；无前缀 → 直接 JSON.parse（手动命令行形态兼容）。导出。
- `tools/bili-downloader/cli.js`：`JSON.parse(rawJson)` → `core.decodeBatchArg(rawJson)`（报错文案不变，`b64:` 坏 JSON 同样走「不是合法 JSON」）。
- `src/literature/processor.ts`：`resolveBatchSpawn` 将 taskJson `Buffer.from(json,'utf8').toString('base64')` 后以 `b64:` 前缀下发。
- 文档：CONTEXT.md「B站下载」「文献盒」词条、cli.js 头注释补 b64 说明；README 手动命令行示例不动（JSON 直传仍支持）。

## 验收

- tools `node --test` 全绿（新增 decodeBatchArg 单测：b64: 前缀解码 / 直传解析 / 双形态坏 JSON 抛 SyntaxError）。
- bz 侧 tsc + 全量测试 + 构建不回归（processor.test.ts 两处 spawn 参数断言改 b64 解码）。
- 全局安装副本 `@jwbz/bili-downloader` 同步 core.js/cli.js（hash 校验一致）。