# Ticket 164：通知操作按钮高度与文字对齐（button → span）

## 需求

通知（toast）里的操作按钮（如「撤销」「重试」）被 Obsidian 核心样式撑成 32px 高，比正文文字行高（21px）高出一截，把整个通知框撑大，不好看。希望按钮高度与文字高度一致。

## 根因

Obsidian 核心 `app.css` 对裸 `button` 有 `height: var(--input-height)`（默认 32px）。`.bz-notice-action` 只覆盖了 `padding`，没覆盖 `height`，导致按钮被硬撑高。

## 改动

- `src/core/notice.ts`：操作按钮 `createElement('button')` → `createElement('span')` + `role="button"`（保留语义，样式类不变，点击行为不变）
- `src/auto-summary/processor.ts`：失败通知「重试」按钮同样改 span（同 `bz-notice-action` 类，同一根因）
- `src/core/styles.css`：`.bz-notice-action` 补 `line-height: 1`（避免继承 1.5 行高使按钮仍比正文高半行）

## 测试

- 既有测试只查 `.bz-notice-action` 文本与点击，不查标签类型，无需改断言
- `pnpm exec tsc --noEmit` 0 错；全量 221 文件 3563 用例绿；构建通过，产物已同步仓库根目录与 E 盘

## 状态

- [x] 实现（core/notice + auto-summary/processor + styles.css）
- [x] tsc + 全量测试 + 构建验证
- [x] 部署产物同步
