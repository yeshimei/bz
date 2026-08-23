# 082：去掉 quiz/review 盲通道计数观察

- **Status**: done
- **Date**: 2026-08-24 用户拍板
- **Related**: 075/076/078/079/080（方法监听接管）、081（书库数据文件监听待注入）

## 决策

用户直接拍板：把 `DOMAIN_FILES` 里最后两个盲通道计数 extract 去掉：

1. `quiz`：「你做了几道题，检验了一下理解」（quiz.json 完成数增长）
2. `review`：「你完成了一轮复习，复习计划在推进」（review.json 复习数增长）

不改造方法监听，直接移除（无观察价值）。

## 改动

- `src/smartcat/domain-source.ts`：移除 quiz/review 条目 → `DOMAIN_FILES` 全清空；头部注释补 ticket 082 + 081 注入预告；`snapshotDomains`/`DomainExtractor` 机制保留
- `tests/smartcat/domain-source.test.ts`：重写——断言 7 域（memo/news/favorites/belongings/pomodoro/quiz/review）全 undefined + `Object.keys(DOMAIN_FILES)` 长度 0 + 空表 snapshot 返回空数组
- `CONTEXT.md`：记忆流词条追加「域 JSON 盲通道清空（ticket 082）」
- `.scratch/memo-suite-plugin/spec.md`：事件监听清单行追加
- `.scratch/memo-suite-plugin/PROGRESS.md`：追加 2026-08-24 条目

## 门禁

- npm test 1538/1538 全绿（112 文件）+ tsc --noEmit 0 错误 + build 部署