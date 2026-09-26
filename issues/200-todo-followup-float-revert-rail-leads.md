# Issue 200: 待办跟进批——浮岛回退 segmented 视觉 / 行头三槽 / F 钮入库 / 默认场景保护

日期：2026-09-05　状态：已交付
前置：issue 197（头部行头）、issue 199（浮岛 segmented 组件化 + 弹窗修复）

## 背景与拍板

issue 199 交付后用户复核，五项决定：

1. **浮岛视觉回退**：`.bz-choice--float` 不再自造视觉（#fbfbfb 轨道 + 胶囊圆角），改取
   `.bz-segmented` 同款值（surface-1 轨道 / radius-sm / 按钮 26px·radius 6px·meta 字号 /
   is-on 白卡 weight 600），**只保留滑动白卡指示器动效**。
   动机：白底弹窗里 #fbfbfb 轨道与 #fff 白卡双双隐形——默认选中态「看不出有白色按钮」。
   轨道 token `--bz-surface-track` 随之删除（两主题 + 手册行）。
2. **rail 行头三槽统一（对齐根治）**：左栏/横滑条行头支持 图标 / emoji / 彩圆 三种前缀，
   统一占 14px 槽（图标 14px 本体；emoji 槽 `.bz-rail-emoji` 复档；彩圆本体 **8px 不变**、
   两侧 3px 撑槽居中；mobstrip 点 7px + 3px 对齐 13px 图标）。行名起始 x 一致，混排不再错位。
   emoji 行头规则：场景名带首 emoji（`\p{Extended_Pictographic}` ZWJ/VS16 序列）时 emoji 作行头、
   名字剥掉显示（rail / mobstrip / 主头行标题同口径 `sceneLabel()`）；编辑器场景 chips 保留全名。
   恢复此前按「界面一律 lucide」移除的 emoji 槽（拍板推翻）。
3. **定位钮 F 款入库**：`.bz-pos-chip` / `.bz-todo-pos-btn*` 从域 CSS 迁入组件库 →
   `.bz-btn--chip` + `.bz-btn-chip`（22px 圆底、hover 品牌软底、`.is-on` 整钮品牌色），
   `uiBtn` 增 `chip?` / `on?` 选项。域内只留 `.bz-todo-pos-row` 布局行 + 提示小字。
4. **默认场景禁重命名/删除**：`DEFAULT_SCENARIOS`（剪藏/工作/学习/生活/代码/公开课）右键菜单
   只剩「在设置中编辑」；`openRenameSceneDialog` / `deleteSceneConfirm` 入口兜底拒绝。
   设置页直编辑 memoScenarios 串不拦（用户手编数据面）。
5. **零散修**：
   - 头行设置钮图标 `settings-2`（滑杆）→ `settings`（齿轮）；
   - 编辑器脚本/课程联想框 `bindSug` 去「绑定即渲染」，**获得焦点才展开**，失焦 150ms 收起
     （让建议项 click 先落地）；输入过滤行为不变。
6. **跟进修（部署后用户实测）**：浮岛指示器**先建后挂不自愈**——`syncSeg` 在 `!el.isConnected`
   时直接 return 不排队，而编辑器表单先构建、`uiModal` 才挂进 DOM，默认选中项（剪藏/次要）的
   白卡要等首次点击才出现。修复：未挂载与未布局同样走限次 rAF 重试，挂载后自动量位；
   回归测试 mock `getBoundingClientRect` 断言「建（未挂载）→挂→自动定位」。

## 变更面

- `src/core/ui/components.css`：float 块回退取值、`.bz-btn--chip` 家族新增、rail emoji 槽 +
  dot 边距、mobstrip dot 边距；`tokens.css` 删 `--bz-surface-track`
- `src/core/ui/button.ts` / `types.ts`：uiBtn chip/on
- `src/todo/ui.ts`：ICON.settings、三槽 sceneLeadHtml + sceneLabel、buildSceneActions 分流、
  重命名/删除入口守卫、bindSug 焦点门控、posBtn 走 uiBtn chip
- `src/todo/styles.css`：pos 按钮域内规则删除（入库）
- `docs/ui-kit-manual.md`：token 行删、按钮/choice/rail/uiBtn 四行更新

## 测试

- tests/core/ui.test.ts：uiBtn chip 档（圆底包图标 + is-on + 非 chip 不产生圆底）
- tests/todo/ui.test.ts：pos 断言迁共享类；重命名/删除用例改自定义场景「副业」；新增
  默认场景菜单仅剩设置直达、emoji 行头三槽 + 剥名 + 主头行同口径、联想框初始收起/聚焦展开/失焦收起
- 全量 4124/4124 绿 + tsc 干净
- 已知坑：jsdom（nwsapi）对「emoji+空格」属性选择器失灵（浏览器正常）——emoji 行用例改遍历 dataset 匹配
