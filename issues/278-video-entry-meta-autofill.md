# issue 278：视频录入 URL 净化 + 标题/UP主 自动回填

日期：2026-09-11 ｜ 用户拍板（一句话需求）：当在视频录入界面输入 url 自动抓取标题 up主等信息回填，并且处理 url 格式 去掉后面的一大堆参数 ｜ 关联：ADR-0122、ADR-0116（术语来源 URL 净化先例）、issue 257

## §1 现状与目标

「视频录入」弹窗（知识盒域，`src/knowledge/ui.ts:1174-1243` 的 `createAddDialog`）现有 7 个输入控件，其中 `#lit-add-url`（视频链接 / BV 号）、`#lit-add-vtitle`（标题，可选）、`#lit-add-uploader`（UP主，可选）三栏全靠手填：URL 上无 input/paste 监听、无解析按钮，输入框统一无 placeholder（`ui.ts:1184` 注释「简洁版：去 placeholder」，本次沿此既有拍板**不加回 placeholder**）。落库 URL 只做 `trim`（`src/knowledge/data.ts:65` 的 `normalizeUrl`），B 站分享链接的 `?spm_id_from=…&vd_source=…` 会被原样写进 `knowledge.json`，并经 `note-gen.ts:158` 写入文献笔记 frontmatter `url` 键。

可复用零件已存在，只是没接上视频链路：

| 能力 | 位置 | 现状 |
|---|---|---|
| URL 净化（B站留 p/t、剥 spm_id_from/vd_source/utm_*/b23 query；幂等；字符串手术不重编码） | `src/knowledge/source.ts:52-69` `normalizeSourceUrl` | 术语来源链路在用（`serializeTermSource`），测试齐备（`tests/knowledge/source.test.ts:91-110`） |
| 页面标题抓取（Obsidian `requestUrl`，取 `<title>`，失败静默） | `src/core/utils.ts:168-181` `fetchPageTitle` | 术语来源兜底在用 |
| 标题清洗（剥「_哔哩哔哩_bilibili」等尾巴 + 实体解码） | `src/knowledge/source.ts:87-93` `cleanSourceTitle` | 术语来源在用 |
| B 站 view API（`x/web-interface/view?bvid=`，含 title/owner.name） | `src/clipbook/news-data.ts:300-321` | 只取过 `owner.mid`（uid），未取标题/UP主 |
| 防抖 | `src/core/utils.ts:229-243` `debounce`（全仓零调用）；术语来源手写 450ms 档 `ui.ts:1503-1506` | 两套先例 |
| 超时 + 竞态丢弃范式 | `src/clipbook/news-sources-group.ts:330-343`（`Promise.race` 10s）；`ui.ts:1599-1608`（`termSource !== src` 丢弃） | 照抄 |

## §2 修法契约

**新增域内模块 `src/knowledge/video-meta.ts`（纯函数 + 网络两段）**

1. `parseBvid(input): string | null` —— 规范正则 `BV[0-9A-Za-z]{10}`；接受完整链接（`bilibili.com/video/BV…`）与裸 BV 号。**统一口径**：现仓存在 `{8,12}`（`ui.ts:106` 展示用）、`+`（`news-data.ts:292`）、`{10}`（CLI `tools/bili-downloader/core.js:181-184`）三套写法，本模块取 10 位为唯一判据；展示函数 `shortUrlText` 本次不动。
2. `fetchVideoMeta(url): Promise<{ title?: string; uploader?: string } | null>`：
   - **B 站 video 链接 / 裸 BV 号** → `requestUrl('https://api.bilibili.com/x/web-interface/view?bvid=<BV>')`（10s 超时，`Promise.race` 范式）→ `code === 0` 时取 `data.title` / `data.owner.name`；非 2xx / `code !== 0` / 异常 → 落到 3。
   - **其他 http(s) URL（含 b23.tv 短链、space 主页）** → 只走标题兜底：`fetchPageTitle(url)` + `cleanSourceTitle`，`uploader` 留空。
   - **非 URL 文本** → 直接 `null`，零网络请求。
   - 全程静默：不 notice、不 alert；调用方拿不到就什么都不回填。
   - 已知限制（写下以备忘）：`b23.tv` 短链无法解析出 bvid（Obsidian `requestUrl` 响应无 `url` 字段、看不到重定向目标），故短链只抓标题、UP主 留空；下载阶段 CLI 的 `[bz-info]` 会按「只补空」补齐 UP主（见 §2.4）。

**UI：输入防抖自动解析（`createAddDialog`）**

3. `#lit-add-url` 挂 `input` 监听，**450ms 防抖**（沿术语来源输入框既有档位 `ui.ts:1503-1506`）：
   - 触发即先做 **URL 净化写回**：`normalizeSourceUrl` 结果与当前值不同就写回 `#lit-add-url`（用户可见，光标位置不强制保持）；
   - 再调 `fetchVideoMeta`，**序列号 + 输入值双重校验**丢弃过期响应（照 `termSrcFetchTitle` 竞态范式）；
   - 回填策略 **只补空**：`#lit-add-vtitle` / `#lit-add-uploader` 当前值为空（trim 后）才写入；已有值（手填或上次抓取）不覆盖；
   - 编辑态（`editingId` 非空，从列表点开改 URL）同款生效；
   - 关弹窗/开新弹窗时清理定时器与在途序列，避免回填到已卸载的 DOM。
4. `_handleAddSave`（`ui.ts:1302` 取 url 处）保存前再过一遍 `normalizeSourceUrl` 兜底（防粘贴后立即回车、防抖未及触发）。
5. 数据层收口：`src/knowledge/data.ts:65` `normalizeUrl` 改调 `cleanUrlText` + `normalizeSourceUrl`（裸 BV 号、非 http 文本原样返回——行为与现「仅 trim」一致，带参链接才变化）。存量任务 URL **不迁移**。
6. `[bz-info]` 合并口径对齐（Q15 拍板）：`src/knowledge/processor.ts:273-280` 改为**标题只在空时回填**（与既有 UP主 逻辑 `task.uploader || task.uploader` 同款），下载阶段不再覆盖手填标题。

**不做**：不加 placeholder；不加「解析」按钮；不改 `shortUrlText` 展示；不改 CLI 侧；不迁移存量数据。

## §3 测试

- 新增 `tests/knowledge/video-meta.test.ts`（node 环境可，mock `requestUrl` 走 `tests/mock-obsidian-entry.ts:388-391` 范式）：
  - view API 成功 → `{title, uploader}`；
  - `code !== 0` / 412 / 网络异常 → 回退页面标题（剔 B 站尾巴）、`uploader` 空；
  - 两条路都失败 → `null`；
  - 非 B 站 URL → 只标题兜底；非 URL 文本 → `null` 且 `requestUrl` 零调用；
  - `parseBvid`：完整链接 / 裸号 / 非 10 位 / 无匹配。
- `tests/knowledge/ui.test.ts`（`vi.useFakeTimers`）：输入带 `spm_id_from`+`vd_source` 的 B 站链接 → 450ms 后输入框值已被净化、标题/UP主 回填；标题已有值不被覆盖；改输入后旧响应被丢弃；粘贴后立即保存仍写入净化 URL。
- `tests/knowledge/data.test.ts:62-69`：`normalizeUrl` 断言随新契约更新（原用例仍然通过，补带参用例与注释）。
- `tests/knowledge/processor.test.ts`：新增「task.title 已有值 → `[bz-info]` 不覆盖、UP主 照补」用例。
- 原型：`prototypes/knowledge/fake-sim.ts` 的假 `requestUrl` 需为 view API 提供罐头响应（否则评审壳里回填路径不可见），并使术语来源既有罐头不回归。

## 改动清单

- **实现**：新增 `src/knowledge/video-meta.ts`；`src/knowledge/ui.ts`（`createAddDialog` 挂输入解析、`_handleAddSave` 净化兜底、字段清理）；`src/knowledge/data.ts`（`normalizeUrl`）；`src/knowledge/processor.ts`（`[bz-info]` 只补空）。
- **测试**：新增 `tests/knowledge/video-meta.test.ts`；扩 `tests/knowledge/ui.test.ts` / `data.test.ts` / `processor.test.ts`。
- **原型**：`prototypes/knowledge/fake-sim.ts` 假 requestUrl 罐头 + 行为产物重出。
- **文档**：CONTEXT.md 新增「录入元信息」词条；ADR-0122 记录回填与净化口径。

## 验收

- [ ] 粘贴 B 站分享链接（带 `spm_id_from`/`vd_source`）→ 输入框自动变干净、标题与 UP主 回填，全程无 toast
- [ ] 手填标题后再改 URL：手填值不被覆盖；清空标题后改 URL：被回填
- [ ] 非 B 站链接只净化不联网抓取；抓取失败完全静默；弹窗关闭后无迟到回填
- [ ] 落库 `knowledge.json` 与新生成文献笔记 frontmatter `url` 均为净化值
- [ ] 批处理跑完，「只补空」不覆盖手填标题、UP主 仍能补齐
- [ ] 全量门禁：`pnpm test` + `pnpm exec tsc --noEmit` + 自审 + diff 审查 + 主仓 `pnpm run build` 部署
