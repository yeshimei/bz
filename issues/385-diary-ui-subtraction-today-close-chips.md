# 385 日记本：头行与弹窗 UI 减法——今天/关闭钮、筛选窗关闭钮、写弹窗此刻/昨天 chips 与筛选类型框移除

- 状态：已实现（待主构建部署）
- 提出：2026-09-19 用户（备忘录 item-1789787088977-ua9g8n，scene=代码）
- 相关：2026-09-10 头行精简（设置/按年月跳转钮退役）；2026-09-11 移动端评审（关闭钮补回——本次再度移除，覆盖该决定）

## 用户原话

> 去掉回到今天和关闭按钮
> 去掉按日期筛选窗口的关闭按钮
> 写日记弹窗去掉此刻，昨天按钮和筛选类型输入框

## 落地形态（三处纯减法）

1. **面板头行**（render.ts + ui.ts）：`data-act="today"`（回到今天/清筛选）与
   `data-act="close"`（关闭，2026-09-11 仅移动端显示）两钮删除；`backToToday()` 及
   close 绑定、ACT_ICON `today`/`close` 词条、`.bz-diary-head-close` 桌面隐藏规则连带清理。
   替代路径：清筛选走 chips 行「✕ 清除」胶囊与筛选弹窗「全部」；关闭维持 ESC/点遮罩。
2. **按日期筛选弹窗**（ui.ts mkDateFilter + styles.css）：右上 ✕ 关闭钮删除；
   关闭走点遮罩与 ESC（esc-manager diary 层），原显式关闭路径本就非唯一。
3. **写日记弹窗**（dialogs.ts + datetime-picker.ts + styles.css）：日期行常驻快捷
   chip「此刻 / 昨天」（dt-quick-row）删除；「筛选类型」输入框（写弹窗侧 createTagFilter
   挂载）删除——chips 直选即可；标签选择器浮层的过滤框与滚轮弹层内「此刻」钮
   （二级选择器功能钮，非弹窗常驻件）均不受影响。

## 口径说明

- 移动端关闭钮本次一并移除（用户明确指令覆盖 2026-09-11 评审补回决定；移动端关闭
  回归「面板可关」的根本问题由全局遮罩/返回手势承接，不再域内特判）。
- 滚轮弹层底部「此刻」保留：备忘录指写日记弹窗内直接可见的常驻 chips；滚轮内是
  点击日期后弹出的二级选择器功能钮。

## 测试同步

- `tests/diary/ui.test.ts`：头行按钮组断言收敛为 `['add','search']`；「关闭复位优先」
  测试退役；E6 筛选窗关闭改走遮罩点击。
- `tests/diary/wall-fix-c.test.ts`：「头行今天钮」测试退役（describe 收敛）。
- `tests/diary/datetime-picker-fix.test.ts`：常驻 chips 2 例退役（滚轮内「此刻」保留
  由 datetime-picker-cov.test.ts 继续覆盖）。
- `tests/diary/dialogs-fix-a.test.ts`：写弹窗过滤框改为「已移除」回归钉 + 选择器浮层
  过滤仍工作；「过滤框回车不提交」随载体退役。
- 原型 `prototypes/diary/` 由 build-preview 重出（不手改产物）。

## 门禁

tsc 0 错 + worktree 全量（6118/6118）+ 自审 + diff 审查 + 主仓合并终态全量 + 构建部署。
