# issue 212：章节栏小图缓存——根治开墙原图解码冻结

## 病根（issue 211 后用户实测仍冻结）
20px 胶卷格挂的是**原图 URL**：`loading=lazy` 只挡屏幕外，可见月份的几十张原图
（每张数 MB）在开墙瞬间整张解码，视频还要逐个读首帧 → 主线程/UI 冻结。

## 方案（用户拍板：小图缓存）
新模块 `src/diary-wall/thumb-cache.ts`：
- IndexedDB 库 `bz-diary-wall-thumbs`/表 `thumbs`，键 = `日期|媒体名`，值 = 48px WebP dataURL；
- 压缩 = fetch blob → createImageBitmap（离主线程解码）→ canvas cover 裁剪；
  视频走 blob URL 中转读首帧（避免 canvas 污染），8s 超时放弃；
- 一切异常静默降级返回 null，调用方回退直挂原图（旧行为）。

`ui.ts`：
- `thumbEl` 渲染零加载：图片挂 `data-thumb-src`、视频挂 `data-src`（播放角标占位）；
- `setupRailLazy` IO 同时观察 img/video；进视口 `hydrateRailThumb`：
  查缓存 → 命中贴 48px 小图（零原图解码）；未命中后台压图回存后贴小图；
  压缩失败回退原 src/旧读首帧；无 IO 环境（jsdom）跳过管线直挂原 src（E4 语义不变）。

## 效果
首次开墙每张图只解码一次（用于压图），之后开墙零原图解码、零视频读取，直接贴缓存小图。

## 门禁
全量 4178 绿（含 thumb-cache 6 例）+ tsc 干净。
