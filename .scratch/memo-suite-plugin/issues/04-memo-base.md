# 04 — 备忘录·基础（面板/CRUD/场景/归档/提醒）

**What to build:** 备忘录 Todo 面板（#todo-popup）完整移植：数据读写、场景分类、增删改、截止时间、归档、到期置顶与提醒——原脚本「备忘录.js」主功能。

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] memo.json 读写（14 字段：id/title/scene/priority/created/completed/due/notePath/notePosition/scriptName/courseName/coursePath/linkedNote/url）零迁移
- [ ] 面板打开/关闭/ESC（escManager）、遮罩、移动端媒体查询适配
- [ ] 场景分类（默认 剪藏/工作/学习/生活/代码/公开课）+ platformMapping 设置
- [ ] 待办新增/编辑/删除（弹窗字段：内容/场景/截止时间/优先级/备注）、完成勾选、归档按钮
- [ ] 截止时间：日期输入（含清除按钮 dueClear）、逾期状态显示（getDueStatus/formatDueText）
- [ ] 到期/过期待办自动置顶（已过期红/今日到期橙）+ 启动时与打开笔记时提醒
- [ ] 命令 `memo-open-panel`、`memo-create-item` 裸注册；changelog 'memo'
- [ ] 测试：数据层（jsonStore 读写/字段保持）+ UI jsdom（渲染/勾选/归档/置顶排序）
