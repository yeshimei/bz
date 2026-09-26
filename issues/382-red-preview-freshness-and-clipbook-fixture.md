# 382 修复既存红×2：原型新鲜度守卫行尾敏感 + clipbook 冻结序时间敏感 fixture

- 状态：已实现（待主构建部署）
- 提出：2026-09-19 用户（「2 红均既存……已在 clean master 复核同样红 修复一下」）
- 相关：ADR-0104（原型单源/新鲜度守卫）、ADR-0108（会话冻结序）；issue 224（保留策略天数）

## 用户原话

> 2 红均既存（clipbook 会话冻结序 4 例他会话在修；原型新鲜度 6 项主仓存量陈旧），已在 clean master 复核同样红 修复一下

## 红因一：clipbook「会话冻结序」4 例——fixture 卡在保留线上（时间敏感）

- **现象**：`tests/clipbook/ui.test.ts` 冻结序 describe 4 例全红，`openFrozen()` 里
  `M.articles.length` 收 3、期望 4。
- **根因**：`seedFrozen()` 的「已读骨架」写死 `date: 2026-08-20 08:00:00` + `read: true, state: 'skipped'`；
  `applyRetention` 对 read 条目按 `now - date > 30 天` 清理，2026-09-19 恰满 30 天 → 装载时被清出。
  用例只在特定日期前绿，属测试 fixture 时间敏感（生产保留策略本身正确，不动）。
- **修法**：骨架日期动态化——`readSkeletonDate()` 恒取 5 天前（本地 `YYYY-MM-DD HH:mm:ss` 格式，
  与解析口径同）；未读条目不受保留清理，固定日期保持原样。

## 红因二：原型新鲜度守卫 16 条行为包——指纹按原始字节 + 工作区行尾随环境而变

- **现象**：主仓 `tests/preview-freshness.test.ts` 16 条行为包（全部）红、12 条渲染包绿；
  worktree 红的面不同（6 条）——红面随构建位置漂移。
- **根因**：`sourceStamp` 对源文件**原始字节** sha1。工作区行尾随 autocrlf（本机 `core.autocrlf=true`）
  与工具写盘而变：主仓 CRLF、各 worktree 混合（含被工具写过 LF 的文件）；产物在哪个环境重出，
  指纹就绑哪个环境 → 「源没改也判产物过期」，跨构建位置恒红。
  实测旁证：diary 行为包存量指纹与「原始/全LF/全CRLF」三种口径**都不匹配** → 上次构建时输入行尾即混合。
- **修法**：双侧行尾归一（CRLF→LF）后再入指纹——`scripts/build-preview.mjs` 导出
  `normalizeEndings`，测试端 `tests/preview-freshness.test.ts` import 复用（口径单源），
  然后全量重出 28 个产物。守卫语义不变：真陈旧照抓（见下）。

## 顺手补齐：6 条行为包真陈旧

- 重出时 diff 显示 6 条行为包（clipbook / gameshelf / home / memo / review / settings-panel）
  正文也有变化 = 上次构建后源改过没人重出（如 clipbook 行为包还带着已退役的行内 ✓✓ 钮代码、
  缺后来加的 topifyZ）。守卫按设计正确抓到，随本次重出一并补齐；其余 22 条仅有头部指纹行差异。

## 口径与边界

| 项 | 口径 |
|---|---|
| 归一函数 | 只做 `CRLF→LF`（`\r\n`→`\n`），不 trim、不改其他字节；MISSING（读不到）口径不变 |
| 单源 | 测试端 import 构建端 `normalizeEndings`，两侧同口径；不复制实现 |
| 不改的 | 保留策略生产逻辑、守卫的判定语义与报错文案、产物正文（除 6 条真陈旧补齐） |

## 改动文件

- `scripts/build-preview.mjs`（导出 `normalizeEndings` + `sourceStamp` 接入）
- `tests/preview-freshness.test.ts`（复用归一函数重算指纹）
- `tests/clipbook/ui.test.ts`（骨架日期动态化）
- `prototypes/**`（28 个产物重出：22 个仅指纹行 + 6 个补正文）
