# 194 设置面板：影院/书架设置补充 + 全域设置补齐 + 零设置项域按端隐藏

## 背景

设置面板（ADR-0080）中影院、书架墙两域设置近乎空白（桌面仅一行目录），收藏本、归物本桌面端
只有「移动端默认全屏」组（桌面空态）。用户拍板：

1. 影院/书架等空设置域补充有意义的设置项；
2. 其余各域同样扫一遍，把已有设置键但未暴露的补进 schema；
3. 某端没有可见设置项的域，该端列表不再显示（现行为：显示空态卡片/占位徽标「·」）。

## 方案

### 补设置（默认视图类，排序键落 settings 同 favoritesSortKey/memoSortMode 惯例）

| 域 | 新增行 | 键 | 消费点 |
|---|---|---|---|
| 影院 | 默认排序（最近观看/按创建/按评分） | `cinemaSortMode` | openCinema 每次打开读 |
| 影院 | 默认状态筛选（全部/想看/在看/已看） | `cinemaStatusFilter`（''=全部） | 同上 |
| 书架墙 | 默认筛选（全部/在读/未读/已读） | `bookshelfDefaultSide` | openBookshelf 每次打开读 |
| 书架墙 | 默认排序（最近阅读/书名/作者/进度） | `bookshelfSortMode` | 同上 |
| 收藏本 | 默认排序（最新收藏/标题排序） | `favoritesSortKey`（已存在，补暴露） | 已有 readSortKey |
| 归物本 | 默认状态筛选（全部/使用中/闲置/已转卖/已丢弃） | `belongingsDefaultStatus`（''=全部） | openPanel 每次打开读 |

接线语义同收藏本 openPanel 先例：**每次打开面板读设置**（非会话首次），面板内改选仍是会话内
临时态；设置里改完下次打开生效。

### 按端隐藏（动态，随 schema 加载收敛）

- `settings-panel/ui.ts`：preload 全量 schema 时记录各域当前端可见项数（loadedCounts）；
  列表（桌面导航 + 移动列表）过滤「noSettings 或 已加载且可见项数为 0」的域；
- 加载完成前先展示、解析后剔除（保留搜索词与激活域；激活域被剔走回落通用）；
- 小橘陪伴猫：有完整 schema 与 loader 却误标 `noSettings: true`——转可见；
- 阅读报告/内容首页/附件搬移：确无设置项，维持 noSettings 双端隐藏；
- 自动摘要：其 5 个设置键已在剪藏本设置内暴露，本域无独立设置，维持隐藏。

## 测试

- cinema/index.test：openCinema 接线默认排序/状态筛选（含非法值回落）；
- bookshelf：openBookshelf 接线默认 side/sortMode + 非法回落；schema 新行断言；
- favorites/belongings：schema 新行断言 + belongings 打开接线；
- settings-panel.test：小橘域可见 + 零项域隐藏（桌面/移动两形态）；
- smoke：命令表不动。

## 门禁

pnpm test + tsc --noEmit + 自审 + diff 审查 + 主仓库构建。
