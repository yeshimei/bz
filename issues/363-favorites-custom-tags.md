# 363 · 收藏本标签自定义

> labels: wayfinder:task ｜ map: 346 ｜ 来源: next-ideas #32（用户已采纳）｜ status: closed ｜ assignee: dev ｜ blocked-by: —

## What

收藏本 9 类标签（GitHub/桌面软件/网站/大模型/pi/Claude/skills/酒馆/DeepSeek Harness）现在是硬编码；放开为用户可增删改（emoji + 名称），存量条目标签平滑映射（旧标签名保留为有效标签直到改完）。

## Scene

想加「装修灵感」「育儿」这类自己的分类，不用挤进现有 9 类。

## Acceptance

- 标签管理入口（设置面板 favorites schema 组或面板内管理弹窗）
- 存量兼容：旧数据载入零迁移可用；改标签名时存量条目跟随（参照备忘录场景迁移 updateSceneBulk 范式）
- 数据层 + UI 层测试 + smoke 同步；门禁全绿

## Notes

- 相关：src/favorites（config.ts 标签单源、data.ts 迁移）
- 标签定义从代码搬进 favorites.json 时考虑 ADR（数据契约变更）。

## Resolution

✅ 已交付：commit `6d949e90`（2026-09-17，全量门禁绿，随 2b2fdbbc 部署）。

### 修订（2026-09-16 用户拍板：不要伴生文件）

标签定义改存插件 data.json 设置键 `favoriteTags`（同 favoritesOpenFilter 等域键范式），伴生文件
`favorites.tags.json` 退役：载入时一次性迁移（旧件存在且非空 → 迁入设置键 → 旧件进系统回收站；
缺失/空/坏跳过或仅退役，幂等可重入；favorites.json 顶层纯数组拍板继续有效）。
