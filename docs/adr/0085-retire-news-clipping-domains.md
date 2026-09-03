# ADR-0085：退役旧 news / clipping 域，并入 clipbook

- 状态：已接受（2026-09-03）
- 关联：ADR-0082（clipbook 融合域）、issue 183

## 背景
clipbook（剪藏本融合域）自 ADR-0082 起已是「剪藏本 + 聚合讯」唯一入口：news.json 读写、剪藏笔记、聚合讯阅读流、设置「数据源」组全部由其承载。旧 `src/news/`（聚合讯）与 `src/clipping/`（旧剪藏本面板）的入口命令早已从 main.ts 断开，只残留内部实现、专用测试，以及 home 首页指向死命令 `bz-clipping-open` / `bz-news-open` 的磁贴。

## 决策
1. 删除 `src/news/` 与 `src/clipping/` 两个旧域目录（含 styles.css 与 tests/news、tests/clipping）。
2. 仍被 clipbook 消费的资产**迁入 clipbook 域内**（不升 core，保持「域内聚合讯实现归剪藏本域」的边界）：
   - news.json 数据层 → `src/clipbook/news-data.ts`
   - 数据源状态操作 → `src/clipbook/news-source-settings.ts`
   - 设置「数据源」组 UI + upManager schema → `src/clipbook/news-sources-group.ts`
   - 日期工具 localDayKey / localDatetime / toDatetime → `src/clipbook/constants.ts`
3. home 首页磁贴收敛：clipping 磁贴命令改指 `bz-clipbook-open`，news 磁贴删除（聚合讯数据随 clipbook 卡展示）；首页快照去掉独立的 news「已读」徽标（聚合讯已读语义属剪藏本阅读流，非首页高频统计）。
4. 构建产物聚合清单（scripts/build-css.mjs）同步移除两个旧 styles.css。

## 理由
- 消除死代码与「磁贴点了没反应」的失效入口（executeCommandById 对未注册 id 静默失败，catch 不触发）。
- 单一入口单一数据流：聚合讯维护只动 clipbook，不再跨域 import。
- 数据契约不变：news.json 四段结构、剪藏笔记 frontmatter、域事件通道（news:read/saved/skipped → smartcat）全部保持。

## 后果
- settings-panel 无改动（clipping tab 早已指向 clipbookSettingsSchema）。
- 与旧域相关的测试（约 11 文件）删除，迁移后的纯数据函数由 clipbook 域测试覆盖。
- movie / library / password 旧域退役另行处理（待 encrypt 保险箱原型定稿后统一，见 issue 183「后续」）。
