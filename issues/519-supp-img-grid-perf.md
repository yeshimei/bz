# 519 · 留影网格分片渲染 + desc 档缩略图管线

来源：用户实测（2026-09-30）——1616 张留影（微信预处理批量导入）在补充素材页一次性展示，面板卡死。病根两笔：①`suppImageState()` 全量 `localImgOf`，开页即 1616 次同步 `readFileSync` + 主线程 base64，全尺寸原图当 104px 格子用，内存几百 MB data URL 字符串；②每次 `renderAlbum()` 全量重建 1616 个大 src 的 `<img>`。用户拍板 A+B：A 网格分片渲染、B 落盘缩略图。

## 改动

**A · 网格分片（ui / render）**
- 模块态 `suppImgShown`（初始 120）；`SuppImageViewState.items` 只装前 shown 张（带 url），新增 `hidden`（未渲染张数）。
- 网格尾部 `hidden > 0` 时出哨兵「还有 N 张 · 点开」（`data-people-supp-img-more`）；IntersectionObserver + 点击兜底双通道追加，**增量 append 不走 renderAlbum 全量重建**。
- 格子构建在 render.ts 收成单一内部函数，全量渲染与增量追加共用（单源）；追加后哨兵原位更新文案 / 到量移除。
- 开面板重置 shown；删图重画不重置（保已展开量），滚动位置由既有 scrollSnapshot 保留。

**B · 缩略图管线（people/thumbs.ts 新文件）**
- `descThumbPath(root, talker, img)`：`desc/thumbs/<月>/<名>.webp`（镜像 desc 子结构，扩展名归一 webp）。
- `compressThumb(bytes, mime)`：createImageBitmap + canvas 长边 240 等比 + webp 0.72（与 diary/thumb-cache 同思路；库外文件走 fs 字节 → Blob，无跨源污染）。整段单点可注入，测试不碰真解码。
- `ensureThumbFile(fs, src, dst)`：已存在跳过；生成失败 false 不写盘（读取侧永远回退原图，无死路）。
- 后台补齐队列：串行 + 逐张让出主线程；去重（待处理 Map + 已办结 Set，面板重开清 Set 给坏档重试机会）；可取消（关面板停）。导入落盘后即入队（issue 514 之前 python 预处理线直落的 1616 张老图，靠网格渲染发现缺档自动补齐，不用用户操作）。
- 网格取图 `suppGridImgOf`：thumb 命中读 thumb；缺档 → 入队 + 本次回退原图 data URL（分片后单页量小，可控）；灯箱走 core 灯箱新 `srcOf` 惰性原图——翻到哪张读哪张，不再一次性把全组拉进内存。

**core 灯箱（core/ui/lightbox.ts）**
- `BzLightboxItem` 增可选 `srcOf?: () => string`（翻页重建 mediaNode 时才取）；不传行为不变，旧调用方零改动。

## 验收

1. 大琳（1616 张）开补充素材页：首屏只渲染 120 张缩略图档，无全量冻结；滚动到哨兵自动追加，到底后哨兵消失。
2. 点开任一张进灯箱：显示原图清晰版，←→ 翻页逐张惰性取图，无全量读盘卡顿。
3. 新导入的图落盘即出缩略图；删图重画不重置已展开分片。
4. 门禁全绿（pnpm test + tsc --noEmit + 自审 + diff 审查）。
