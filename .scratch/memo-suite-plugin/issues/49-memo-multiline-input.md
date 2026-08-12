---
Status: done（实现完成，1052 测试全绿）
Ticket: 49
域: memo
---

# 49 备忘录内容多行输入（textarea auto-grow ≤8 行）+ 面板 pre-wrap 展示

## 背景（用户报告）

创建备忘录弹窗的内容输入框是 `<input type="text">`（单行外观）。用户观察到：
输入框空时看起来像单行输入框，但需要支持多行内容；备忘录面板应能正常展示多行。
grilling 封板结论：方案 B——真正的多行输入，Enter 换行（textarea 默认行为），
保存仍走「保存」按钮（不加快捷键）；textarea 自动增高，空时一行高、最高 8 行，
超出内部滚动；面板纯文本分支 `white-space: pre-wrap` 展示多行。

## 实现要点

- [x] `#add-todo-content`：`<input type="text">` → `<textarea rows="1">`；
      样式沿用现有 inline（宽度/内边距/圆角），另加 `resize:none; min-height:37px(一行);
      max-height:184px(8 行); line-height:1.5; overflow-y:hidden; font-family:inherit;
      background/border 与主题 input 一致`
- [x] autoGrow 函数：`input` 事件 + 弹窗打开/编辑回填时调用；
      高度 = clamp(scrollHeight, 一行, 8 行)；超出 8 行 overflow-y:auto
- [x] Enter 换行靠 textarea 默认行为，零代码；不加快捷键；Esc 关闭不变
- [x] 场景切换清空内容后重置高度（buildScenes 清空处）
- [x] createCard 纯文本分支 contentSpan 加 `white-space: pre-wrap`
      （cssText 统一处；linkedNote/url 链接分支不受影响）
- [x] 剪藏 placeholder 兜底、extractUrlAndDisplay 逻辑不动（多行下已验安全）
- [x] 数据格式不动：title 原样存（含 \n），memo.json 结构不变

## 测试

- [x] 更新旧断言：`#add-todo-content` 类型 HTMLInputElement → HTMLTextAreaElement
- [x] 新增：元素为 TEXTAREA；keydown Enter 不触发保存/关闭；
      多行 value 保存后 title 含 \n；编辑回填多行 + 高度调整；
      autoGrow（stub scrollHeight：<8 行高度自适应、>8 行封顶 184px + overflow auto）；
      卡片纯文本分支 style.whiteSpace === 'pre-wrap'

## 验收

- [x] 创建弹窗：空时一行高；Enter 换行；粘贴/换行后增高；超 8 行滚动
- [x] 编辑弹窗回填多行内容并自动增高
- [x] 面板纯文本条目多行展示；链接/剪藏条目不受影响
- [x] 全量测试 + tsc 通过
