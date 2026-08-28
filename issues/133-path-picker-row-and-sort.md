# Ticket 133：路径设置行空态/已选态翻转 + 选择器列表排序（grill-with-docs 拍板）

- 状态：已完成（master 95a3792 + 修订 bb7f7cd；全量 209 文件/3298 用例绿 + tsc 0 + 构建部署）
- 修订（bb7f7cd，用户验收反馈）：① 路径行移动端单行兜底——空态行控件区为「按钮+chips」两子元素会被两行式误标，`markSettingSplitRows` 对 `.bz-path-picker-setting-row` 直接跳过 + 守卫类 CSS 恒单行；② 移动端选择器外边距（`min(calc(100vw - 32px), 440px)` 左右各 16px）；③ 空态/已选态按钮显隐回归测试锁定
- 域：core/path-picker（跨域设置面板路径行统一组件）
- 来源：grill-with-docs 拍板（三轮 Q&A 收敛）
- 关联：`src/core/path-picker.ts`、`styles.css`、`tests/core/path-picker-ui.test.ts`、`tests/settings-tab.test.ts`

## 拍板

1. **范围**：全部 path 行统一生效（主设置页「数据存储路径」+ 各域 ⚙️ 弹窗，单选/多选同套）。
2. **空态**：只显示一个紧凑次级「选择…/添加…」按钮（去 setCta accent、缩小内边距/字号，
   样式 `.bz-path-picker-btn--slim`）；去掉「未选择」灰字（`renderPathChips` emptyText 传 ''）。
3. **已选态（single 与 multi 相同）**：按钮移出 DOM（`syncBtn`——控件区恒 1 子元素 →
   `markSettingSplitRows` 不挂 `.bz-setting-split` → 移动端名称/描述与控件区同行）；
   chip 文本点击重开选择器（`onChipClick`，✕ 事件不冒泡）；✕ 保留清除，清除后回空态（按钮恢复）。
4. **选择器列表排序**：已选置顶（`pinnedAtOpen` 快照——仅打开时定序一次，点击勾选不重排）→
   库根第二梯队 → 其余目录整体反转（原 sort() 码点升序逆排：中文在前、英文在后；
   英文组内小写在前、大写在后）。搜索时置顶仅对命中项生效（未命中项被过滤自然不出现在顶部）。
5. **兼容**：数据格式、命令 id、DOM 契约零变化；数据层 `foldersFromFiles`/`collectVaultFolders`
   排序不动，反转只发生在 UI 渲染层（orderedList）。

## 验收标准

- a) 主设置页 + 各域 ⚙️ 弹窗路径行：空态仅紧凑小按钮；已选态无按钮、chip 可点重开、✕ 清除；
- b) 移动端 ≤768px：路径行名称/描述与控件区同行（不拆两行）；多选 chips 自上而下折行（flex-wrap 现状）；
- c) 选择器列表：已选置顶 → 库根 → 其余反转（中文在前）；点击勾选不重排；搜索命中项置顶生效；
- d) 全量测试绿 + tsc + 构建；`tests/core/path-picker-ui.test.ts` 排序/行态断言更新、新增用例。