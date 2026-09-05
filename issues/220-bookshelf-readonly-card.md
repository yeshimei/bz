# 220 — 书架借书卡只读化：展示界面，不允许编辑/删除

用户拍板（书架墙 P4 原型只读详情卡）：点击书打开的借书卡改为**纯展示界面**。

## 移除
- 状态切换（uiChoice 三选）、进度滑杆（uiRange）、读完日期输入、书评输入框
- 删除按钮 + 二次确认弹窗、取消/保存按钮（persistBook/rollbackBook 保存链随之移除）
- 打开笔记/继续读入口按钮（原型形态中无此控件）

## 保留/改造（对齐拍板原型 p4-book-view.html）
- pull-note 红签、× 关闭、封面、标题、作者·分类·EPUB、书评展示（无书评 dim 占位）
- 台账：状态（圆点+文字）、累计时长、阅读进度（静态条纹进度条）、起读·读完、
  划线/想法、页数、字数（额外信息行）
- 批注密度条、「讫/阅/藏」印章

## 清理
- persistBook/rollbackBook/openBookDirect/todayStr 死代码、confirmModalClose、
  uiChoice/uiRange import、styles.css 死样式（review/actions/cdate/滑杆/readonly 提示）
- 测试同步：编辑类用例改为只读断言（无编辑控件、无删除），EPUB 只读用例合并
