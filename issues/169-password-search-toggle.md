# Ticket 169 — 密码本搜索框点两次才打开

## 背景

密码本搜索容器由 CSS 隐藏（`src/password/styles.css` `.pw-search-container { display:none }`），但 header 搜索按钮 toggle 只读内联 `this.searchContainer.style.display`（初始 `''`）——第一次点击 `'' !== 'none'` 被判定「可见」，于是把内联 display 设为 `'none'` 并清空关键词（视觉无变化，CSS 本来就隐藏）；第二次点击才设 `'block'` 显示。**点两次才打开**。

## 实现

- `src/password/ui.ts` `ensureElements`：创建 `searchContainer` 时即设内联 `display = 'none'`（与 CSS 隐藏一致，单一事实源），toggle 逻辑自洽——首点判定隐藏 → 展开并聚焦。
- 测试 `tests/password/ui-cov.test.ts`：改为断言首次打开即内联 none（修复前测试与 bug 自洽——jsdom 不加载 styles.css，内联 `''` 视为可见，测不出 bug）；首点即展开断言。

## 门禁

tsc 0 错；全量 222 文件 3581 用例绿；构建部署通过。
