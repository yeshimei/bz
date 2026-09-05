# issue 214：媒体卡文字置顶版式（时间+类型 → 拼接全文 → 媒体堆叠）

## 用户拍板（替代 issue 213 段序版）
「图片和视频单独提取出来，文字拼接放在一起，文字放到图片和视频上面，
文字上面放时间和类型」——一卡一条目：顶部时间+emoji 行 → 拼接全文（markdown 渲染）
→ 图片/视频竖排堆叠下方。

## 实现
- `ui.ts` renderWall 媒体条目：整卡 `.bz-diary-wall-media-wrap` =
  `.bz-diary-wall-text-row`（时间+emoji）+ `.bz-diary-wall-text-tx.bz-diary-wall-md`
  （renderText 走 MarkdownRenderer，加密未解锁显示占位）+ `e.media.forEach(mediaEl)`；
  无文字条目只有媒体堆叠。纯文字条目仍走 textItem。extractSegments/segments 字段保留
  （数据层能力不动，UI 不再消费段序）。
- `styles.css`：卡内文字区 padding（row 10/10/0、tx 2/10/8）+ 媒体堆叠间距 6px。

## 门禁
全量 4184 绿（issue 213 段序 UI 用例改写为文字置顶断言）+ tsc 干净。
