# issue 213：正文按原文段序渲染 + 删 sparse-2 挤压 hack

## 病根（用户截图 2026-08-19 实测）
1. **文字重复**：数据层把条目压平成 `media[] + text 合并全文`，UI 又在**每个**媒体块下
   重复挂整条 `e.text`——原文「一段文字、一张图、一段文字、一张图」显示成图1下全文一遍、图2下再来一遍。
2. **挤压在左**：issue 211 回滚把 issue 209 实锤为挤压病根的 sparse-2 半宽 hack
   （`width:calc(50% - 5px) + inline-block`，多列容器内百分比按列宽解析）带了回来，
   当天条目 ≤2 时全部压成细条堆在左半边。

## 修复
- `data.ts`：新增 `extractSegments(content)` → `WallSegment[]`（文字段/媒体段按原文序交错保留；
  非媒体内链原样留文字段）；`WallEntry.segments` 派生字段（toWallEntry + ui.ts 解密条目构造）。
- `ui.ts`：媒体条目改**段序渲染**——text 段 = 独立文字卡（`textItem` 助手，与纯文字条目共用），
  media 段 = 媒体块（不再嵌正文）；文字全篇只出现一次、位置忠实原文。
- sparse-2 半宽类删除（ui.ts 挂类 + CSS 规则）；sparse-1 跨列保留。

## 门禁
全量 4184 绿（新增 extractSegments 3 例 + 段序渲染回归 1 例）+ tsc 干净。
