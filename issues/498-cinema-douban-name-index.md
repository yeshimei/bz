# 498 — 影院名称索引在线资源：输入联想 + sid 直取解析

- **ADR**：adr-0209-cinema-douban-name-index.md
- **来源**：用户 2026-09-27 拍板「只作为输入框的名字的一个下拉列表……只要名称、年份、评分、类型和豆瓣的 ID；匹配到就跳过搜索页，ApiZero 按 ID 直取；年份/评分/类型显示在候选小字里给用户参考；数据做成在线资源，标题下小字显示各类型数量」
- **前置**：.scratch/douban-dataset 数据集选型与抓取（2026-09-27 交接单）

## 交付物

1. **资源产物** `downloads/cinema-douban-index.json`（`pnpm cinema-index`）：
   `{version, updatedAt, stats{total, kinds[[类别,条数]]降序}, rows[[名称,年份,评分,类别,豆瓣ID]]}`。
   85,288 条 / 4.29MB，明文 JSON 走 ADR-0207 统一清单 doc 通道（全链路文本口径，不支持 gzip）。
2. **清单登记**：build-manifest.mjs DOCS + ROW_ORDER 加 `cinema-douban-index`（「豆瓣影视索引」）。
3. **资产层** `src/core/douban-name-index.ts`：validate / load（内存缓存 + downloads:asset-changed 失效）
   / download（ensureAssetWithHash）/ searchDoubanNameIndex（归一 + 前缀优先 + 评分降序 + limit）/
   indexKindCounts。仿 rss-catalog 四件套范本（ADR-0208）。
4. **表单联想** `src/cinema/ui.ts` openForm：uiSuggest（core 组件库，零新下拉实现）挂名称框；
   选中回填名称并携带 sid；索引未下载 → 静默缺席回落既有手输+三路检索。仅新增态。
5. **sid 直取** `src/cinema/douban-fetcher.ts queryDoubanBySid`（ApiZero 按 ID，海报恒空走队列补抓）；
   `douban-queue.ts queryDoubanForPreview` 加可选 sid——直取失败回落按名全链（调用方无感）。
6. **设置行小字** online-resources.ts DESC_EXTRAS：`85,288 条 · 电影 80,946 / 电视剧 2,537 / …`。
7. **样式**：仅 `.f-field--name{position:relative}`（uiSuggest 浮层定位锚）；浮层本体复用 .bz-popover 族。

## 验收

- [x] 设置面板在线资源组出现「豆瓣影视索引」行；下载后 desc 显示总条数与各类型条数
- [x] 添加影视输入「三体」出候选；小字含年份/评分/类别；选中回填
- [x] 选中候选后解析：preview 查询收到 sid（生产跳过按名搜索）
- [x] 索引未下载：无下拉无报错，行为与现状一致
- [x] 数据层/UI 测试齐；tsc 通过；smoke 无新增命令

## 决策记录

- 同名条目候选**取排名最优一行**做 sid 载体（onPick 只有名称串）；其余同名片走手输检索。
- 季集不进索引（总集数≠季数，C1 撤回口径）；简介/海报/短评等血肉字段**有意不收**（合规边界，ADR-0209）。
- 上游数据集（Kaggle CC BY-NC-SA + 自抓 2026 表）**不入 git**；产物入库，构建脚本可重跑。
