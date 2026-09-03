# Ticket 181 — 影院（cinema）添加影视表单精简 + AI 页图标尺寸

> 状态：🔄 开发中（worktree/cinema-add-form-polish）
> 门禁：worktree 全量测试 + tsc 0 错 → 合流 master → 构建部署 → 清理 worktree

## 用户需求（添加影视界面）

1. **不显示观影日期**：表单移除「观影日期」输入框；新增保存时观影日期以当前日期为准（编辑保留原日期，不破坏已有数据）。
2. **想看/在看不显示评分与影评**：表单状态选「想看」「在看」时隐藏评分行与影评行（仅「已看」显示）；保存时非已看状态不写影评。
3. **类型/状态选项前不加彩色圆**：移除类型按钮与状态按钮前的彩色圆点（choiceGroupHtml 不再传 dots）。
4. **AI 荐片机器人图标铺满页面**：`.bz-cinema-ai-guide-ic` 为行内 span，width/height 36px 对内联元素不生效导致 svg 失控放大——改为 inline-flex 容器使尺寸生效。

## 改动范围

- `src/cinema/ui.ts`：openEditForm 表单（去日期行 / 状态联动显隐评分影评 / 去 dots）+ 保存逻辑。
- `src/cinema/styles.css`：`.bz-cinema-ai-guide-ic` 尺寸修复。
- `tests/cinema/ui.test.ts`：同步表单断言（字段数 6→5、无彩点、状态联动隐藏、日期默认当前）。

## 语义拍板

- 保存影评：`status === '已看'` 才写（读 textarea）；想看/在看 → 影评置空不写。
- 保存日期：新增 → 当前日期；编辑 → 保留原 watchDate（persistItem 已 `|| localNow()` 兜底）。
- 类型/状态常量（TYPE_COLORS / STATUS_COLORS）不动：导航栏彩点等其他用途保留。
