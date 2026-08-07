# 评审：f000d23..HEAD（store + ui + main + 装配）

已核对 README.md / CONTEXT.md / ADR-0001 / ADR-0002、spec.md 与 issues/01-10，通读全部 diff 文件，并实际运行 tsc、vitest、esbuild 及隔离测试。

## Standards 轴

**硬违规（引用文档规则）**
- **无循环依赖**（README.md:49「无循环依赖」，ADR-0002:3）：ui 内部存在函数级循环。`panel.ts:12` ← `filter-shared.ts:7`（import getShowTagCountSetting from './panel'）、`panel.ts:11` ↔ `entries.ts:12`、`panel.ts:13` ↔ `dialogs.ts:10`。且 `filter-shared.ts:2` 头部自称「避免 entries↔panel 循环依赖」，实际只是把环移到 panel↔filter-shared，自述目标未达成。tsc/esbuild 可容忍，但文档明言无循环。
- **命令 id**（ADR-0001）：裸注册方式合规，但 `diary-open-add-dialog` 双注册——`main.ts:30` 与 `quote.ts:19`（init 时经 registerOpenDialogCommand）。后者覆盖前者，main.ts:33-40 的「未初始化先 init」防护成为死代码（判断项）。

**Fowler 坏味道（判断项）**
- **Duplicated Code**：标签按钮构造+内联 CSS 在 `panel.ts:268`、`filter-shared.ts:86`、`dialogs.ts:302/451/508` 重复；主标签含二级计数逻辑 `panel.ts:239-252` 与 `filter-shared.ts:154-165` 重复；日期降序比较器 `store.ts:68-73`、`dialogs.ts:379-382/610-613` 重复；emoji 序列 `tags.map(getTagEmoji).join('')` 在 `store.ts:217/263`、`dialogs.ts:343`、`entries.ts:209` 重复（兼 Shotgun Surgery）。
- **Mysterious Name**：`filter-shared.ts` 职能模糊；`dialogs.ts:394 createConfirmDialog()` 为空壳（panel.ts:401 仍调用）。
- **Middle Man**：`main.ts:104 openAddDialogSafe` 纯转发；`store.ts:62 getIsProcessingRemainingFiles` 恒 false 死代码（有注释、文档让位）。
- **Divergent Change**：`entries.ts` 557 行混筛选/渲染/跳转/长按/编辑/滚动/移动端。
- 其他：`main.ts:7` 未使用 import `resetTagsConfig`；设置页 11 个 Setting 块模板复制（main.ts:124-268）；`dialogs.ts:431` 初始填充与 `openAddDialog`（:492）用不同排序函数，初始 DOM 必然被覆盖重建。

已跳过：tsc / vitest / esbuild 门禁（均通过）。

## Spec 轴

**(a) 缺失/不完整**
1. spec.md:57「插件加载即打开面板」+ issues/09:11「启动面板」：`panel.ts:405-410` 的 `isPopupShown` 判断倒置，首次加载面板保持 hidden。证据：单独跑 `vitest run -t "ESC 关闭主面板"` 失败（期望 visible 实得 hidden）；全量 69 测试通过仅因 `state.ui.isPopupShown` 跨用例泄漏（panel.test.ts:20-36 beforeEach 未重置）——测试顺序依赖。**高**。
2. issues/08:9「摘抄完整流程…保存写回并新增条目」：无测试（panel.test.ts:223-228 占位 `expect(true).toBe(true)`）；且 quote 保存（quote.ts:270-276）仅关弹窗+跳转，未像 `saveNewEntry`（dialogs.ts:601-615）insertCard，新条目面板不显示直至下次全量刷新。**中**。

**(b) 越界**
- 无显著越界；空态文案为 README 记录的有意差异。`store.ts` loadAll 进度分母在 totalDiaryFiles↔totalFiles 间切换（:108/:161），进度条跳变（微）。

**(c) 实现有误**
1. issues/05「文件变更监听」：`onFileChange`（store.ts:402-404）目录前缀无边界匹配，`我的/日记.md`、`我的/日记本/…` 被误判；测试（store.test.ts:267）仅覆盖完全无关路径。**中低**。
2. spec.md:31 双链复制：`copyLink`（entries.ts:376）对影视/信条目生成 `[[路径.md#emoji 时间]]`，而影视文件无 `# emoji 时间` 标题，链接失效。**低**。
3. `insertCard` 时间序比较（entries.ts:449-457）：从 data-entry-id 取 `MM-DD-HH-mm` 与 `entry.time`（`HH:mm`）字符串比较恒真，新卡恒插分组首位。**低**（刷新后恢复）。
4. `updateTags` 保活判断（dialogs.ts:368-369）用简化 `tags.some(selected)`，未复刻 applyFilter 的「主标签含二级」规则（entries.ts:44-64），主标签筛选下改二级标签可能误移卡片。**低**。

## Acceptance