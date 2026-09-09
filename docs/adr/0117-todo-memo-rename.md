# 待办域正名「备忘录」+ 旧 memo 遗产清算

背景：ADR-0092 退役旧 memo 域、待办（todo）全面接管 memo.json 时，保留了成片 memo 命名遗产（6 个 `memo*` 设置键、`'memo'` 事件通道、checkup「备忘录 / 待办」双域文案、home `memoIdOf` 映射），并在第 19 行明记「反向正名（todo 改名备忘录）评估过并暂缓……名号继承另行立项」。本 ADR 兑现该伏笔。用户经 grill-with-docs 多轮拷问（中途两次方向修正）最终拍板：**待办域正名为备忘录（memo），旧备忘录的一切废弃，功能与文案全部以现待办域实现为准统一，随后接入原型单源**。

## 拍板要点

1. **代码级全链路正名，纯名义**：`src/todo/`→`src/memo/`、`TodoItem`→`MemoItem`、`TodoData`→`MemoData`、`openTodoPanel`→`openMemoPanel` 等导出随迁；命令 `bz-todo-open/add`→`bz-memo-open/add`（下线无别名，旧 ID 热键失效重绑一次）；CSS 类 `bz-todo-*`→`bz-memo-*`；`tests/todo/`→`tests/memo/`；`RecapDomain 'todo'`→`'memo'`、`todoDone/todoCreated/todos/todoWeekStats`→`memo*`、`DOMAIN_ICONS.todo`、settings-panel 导航 id 同步。memo.json 结构、条目 14 字段、行为、六场景（剪藏/工作/学习/生活/代码/公开课）零变化。
2. **旧 memo 遗产清算**：home `memoIdOf`（todo 展示归 memo 特判）删除——recap 键改 `'memo'` 后映射成恒等；checkup「备忘录 / 待办」双域文案归一「备忘录」（memoView/todoView 双视角同源体检机制保留，仅命名与文案随正名归一）；`todoSkin` 设置键改名 `memoSkin` 并 onLoad 值迁移（读旧键→写新键→删旧键）。
3. **6 个 `memo*` 设置键保留原名与值**（`memoScenarios/memoSortMode/memoShowArchivedByDefault/memoDefaultPriority/memoDefaultScene/memoDueFormat`）：正名后域名即 memo，键名恰归位，改键反造二次迁移；ADR-0092 存储契约延续。
4. **命名巧合红利，零改动保留**：`'memo'` 事件通道（todo/ui.ts 9 处 `emitDomainEvent('memo',…)`）、manifest 描述、smartcat「备忘录」观察文案在正名后由「历史遗留」转为「正名正确」；behavior-wording `memo:*`/`task:*` 双键命中维持（历史行为流事件可读）。
5. **文案口径＝全称系机械替换**：一切用户可见文案只换名词——命令「备忘录」「加备忘录」、recap「备忘录完成」「新增备忘录」、river「新增备忘录」、checkup「备忘录」；不引入缩短形。
6. **随后接入单源（ADR-0104/0106 范式）**：`render.ts` 纯层自 ui.ts 抽出（8 处 innerHTML 模板 + markup 帮手；编辑弹窗 36 处 createElement 保持命令式）；`PREVIEW_DOMAINS` + `BEHAVIOR_DOMAINS` 双清单登记；`prototypes/memo/` 双 iframe 评审壳（主流程+编辑弹窗 / 引用同步演示 / 被动捕获演示 / 皮肤切换 四行为面）；render-purity 守卫自动纳管。
7. **memo.json 红线**：文件名、路径、结构零变化，数据零迁移。

## Considered Options

- 反向方案（域名保持待办、清算 memo 字样为待办）：用户两轮反复后拍板正名备忘录——manifest/checkup/smartcat 已自然形成「备忘录」叫法，正名是顺水推舟，反向清算反而与生态文案为敌
- 6 个 `memo*` 设置键改 `todo*` 再随正名改回：两次迁移纯 churn——否
- `todoSkin` 等设置键只改代码不改存储名：正名的目的就是名实一致，留 `todoSkin` 死键即留下一颗「旧待办」残渣——否，改存储名 + 值迁移
- 旧命令 ID 留隐藏别名一版：多一套尾巴要跟踪清理——否，ADR-0092 下线 memo 命令即无别名先例
- 设置键改名不做值迁移（重置默认）：用户偏好（皮肤）无损搬运仅 ~30 行——否

## Consequences

- `bz-todo-open/add` 热键失效一次，需在 Obsidian 热键设置重绑到 `bz-memo-open/add`
- recap/home 内部统计键改名（已核实均为运行时键、无落盘，零数据迁移）
- `todoSkin`→`memoSkin` 在 data.json 发生一次性设置迁移（旧键删除）
- AGENTS.md 领域清单、CONTEXT.md 词条同步翻转（「待办」入 Avoid）
- 备忘录成为 ADR-0104/0106 单源范式域，render-purity 纳管，prototypes/memo/ 入库
- 实现与验收细节见 `issues/260-todo-memo-rename-single-source.md`
