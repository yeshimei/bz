# 150 — Python 路径填写体验：支持填 `python` 命令名 + 引导文案 + 通用默认

**状态**：✅ 已完成

## 用户诉求

> python 不可以填写一个 python 就能生效吗，不然其他用户如何填写呢，怎么找呢，很麻烦

## 现状问题

1. 技术上本就支持填 `python`（core.js `spawn(py,...)` 走 PATH），但**没人告诉用户**：desc 只写「faster-whisper 依赖」、错误提示只说「检查设置」。
2. 工具 `config.js` DEFAULTS.pythonPath 硬编码开发机专属绝对路径（`C:/Users/PC/.../Python312/python.exe`）——**其他用户装上也没有这个路径**，「留空跟随工具配置」等于跟随一个不存在的路径。
3. 错误细分缺失：python 根本找不到（ENOENT）时被通用包装误导成「faster-whisper 未安装」。

## 修复

- **config.js**：`DEFAULTS.pythonPath` → `'python'`（通用命令名，spawn 走系统 PATH）；注释教 Windows 用户 `where python` 查绝对路径。rc 有值时仍覆盖。
- **core.js**：
  - 777（未配置 pythonPath）文案 → 教「填 python（走系统 PATH）或绝对路径（where python 可查）」（保留「未配置 pythonPath」子串供 UI 匹配）。
  - 转写失败 catch：`/无法启动 Python|ENOENT/` → 专报「找不到 Python…where python 可查」，不再误入 faster-whisper 包装。
- **ui.ts**：`humanizeError` 结构调整——「找不到 Python / 未配置 pythonPath / pip install faster-whisper / 通用 whisper」四分支**独立匹配**（ENOENT 消息不含 whisper 词，不能挂 whisper 主块下）；设置 desc 更新「装了 Python 一般填 python 即可（走系统 PATH）；或填绝对路径（where python 可查）；留空跟随工具配置」。
- **README.md**：示例 `pythonPath` 改 `'python'`；表格说明同上。
- **测试**：tools 新增 2 用例（ENOENT 引导 / pythonPath 未配置引导）；ui.test.ts humanizeError 新增「找不到 Python」断言；既有断言兼容。

## 实测（本机）

- Python312（rc 默认指向）：faster-whisper **1.2.1 已装** ✓ → 设置留空即可用
- PATH `python`（miniconda）：faster-whisper **未装** → 若填 `python` 会报「faster-whisper 未安装」，应在对应 Python 执行 `pip install faster-whisper`

## 验收

tools `node --test` 52 全绿；bz 侧 ui/processor 测试绿 + tsc 0；全量测试 + 构建不回归。