# 203 — 剪藏本六项修复：搜索进 rail + 统计联动 / 平台动态分组 + 新文在前 / favicon 高清 / 去分析入口 / 正文图片 / 滚动重置

用户实测（2026-09-05 截图反馈）剪藏本面板六项：

## 1. 搜索框移位 + 统计联动
- 搜索框从头行右侧移到**左栏列表上方**（「全部未读」之上）。
- 搜索时左栏各源行后的数字（未读数/总数）联动变化 = 该源命中数。

## 2. 左栏按平台列出 + 新文章在前
- 平台行不再硬编码三平台：从数据动态聚合（platformOf 归一），新平台自动出现。
- 聚合讯新文章按时间倒序排在对应列表最前（此前按磁盘顺序旧在前）。

## 3. favicon 高清化（右栏阅读区站点图标）
- 不再首字母+背景色兜底优先：先取高清 favicon（多源回退：yandex v2 64px → Google s2 64 → 站点根 /favicon.ico），全失败才回落首字母 chip。
- domain 解析增强：无协议 URL 补 https 再解析；仍失败按平台兜底根域（知乎→zhihu.com 等）。
- 成功源 localStorage 缓存，二次打开零等待。

## 4. 去掉左栏底部「阅读分析报告」入口（用户确认无此需求）。

## 5. 右栏正文图片渲染
- 根因：`md.toParagraphs` 直接删除 markdown 图片 token + 渲染层纯文本转义。
- 改造：图片 token（`![alt](url)` / `![[path]]`）提取为独立 img 段；渲染层解析
  外链 http(s) 与 vault 内嵌（getResourcePath），onerror 隐藏。

## 6. 切换文章滚动重置
- 根因：`renderReader` 只重绘 readerEl，滚动容器 `.bz-clip-read-scroll` 保留上一篇位置。
- 改：selectArticle 文章 id 变化时滚动归零；移动端进详情同样归零。

## 落点
- `src/clipbook/ui.ts`：头行/rail 结构、搜索联动、平台动态聚合、favicon 链、滚动重置、删分析入口。
- `src/clipbook/store.ts`：platformOf 导出、siteDomain 增强、queryBySource timeTs 降序。
- `src/clipbook/md.ts` + `types.ts`：img 段。
- `src/clipbook/styles.css`：rail 搜索框 / 正文图片样式。
- 测试：md 图片段、queryBySource 排序、ui 搜索联动/滚动重置/无分析按钮/图标占位。
