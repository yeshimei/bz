# 432 · 观影分析桌面端首页错位——boxLogicalPoint 非旋转分支漏减层框原点

## 症状

观影分析（yearbook）开卷幕在桌面端整体错位：粒子聚合出的片名「观影分析」跑到画面
右下方（偏移量 = 层框左上角的视口坐标），盒壁/地面同样偏——栗子坠落直接掉出画面。
移动端此前已修好（9092b792 软横屏单源），桌面端反被同一笔改坏。

## 根因（改 A 坏 B 的精确链条）

`9092b792` 把开卷画布从「满窗口铺」（画布原点 = 窗口左上角）挪进层框 `.bz-yb-box`
内满铺（画布原点 = **层框左上角**），字靶/盒壁/地面同时改走 `core/landscape` 的
`boxLogicalRect` 换算。但 `boxLogicalPoint` 的**非旋转分支原样返回视口坐标**，没减
层框左上角：

- 移动端：面板满屏，层框 ≈ 窗口，(box.left, box.top) ≈ (0,0) → 恰好对上（修好了）。
- 桌面端：层框贴面板不贴窗口 → 字靶整体偏移 (box.left, box.top)（改坏了）。

旋转分支的返回值本来就是层框相对——两态语义不一致正是漏点。

## 修法

`boxLogicalPoint` 非旋转分支同样减去层框左上角，两种态统一为「视口 → 层框逻辑」。

影响面核对：

- cinema 开卷幕两处消费（build 字靶 / update 盒壁地面）——本修目标，桌面归位、
  移动端旋转态走原分支不变。
- `hostLocalPx`（review 灯谱 / clipbook 雨滴）：非旋转时 `closest('.is-rot90')`
  为 null 根本不进 box 分支；旋转态走旋转分支——行为零变化。
- 开卷幕其余画布幕（years/reel/net/flow/eras/matrix）只用画布内部坐标，无 DOM 量测，
  不受影响。

## 回归测试

`tests/core/landscape.test.ts`（新增）：

- 非旋转态减层框原点（issue 432 回归）；
- 旋转态换轴反向（真机口径锁）；
- `boxLogicalRect` 两态、`hostLocalPx` 两态、`fitRotatedBox` 桌面/移动竖/横/无几何。
