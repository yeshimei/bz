# Ticket 132（提案·待排期）：通用子弹窗骨架——「按钮 → 独立窗口」模式抽离

- 状态：提案（2026-08-27 用户提出；ticket 128 合并后评估，与 131 同批或紧随）
- 域：core（跨域 UI 骨架）
- 来源：用户——「比如 UP 主管理，点击按钮再打开一个弹窗，不同的行为逻辑可以单独抽离出来；也许未来其他地方也会有相同的一个按钮，点击再打开一个独立窗口」
- 关联：`src/core/settings-modal.ts`（同族骨架）、`src/core/path-picker.ts`（ticket 128，骨架第一个实例）、`src/clipping/news-sources-group.ts`（UP 主管理弹窗）、`src/core/dom.ts`（createOverlay）、`src/core/esc-manager.ts`

## 模式

设置面板（及任意主窗口）中的「动作入口 → 独立子弹窗」交互：入口处只有一个按钮（或含 name/desc 的动作行），点击后打开一个独立弹窗承载真正的行为（管理/选择/批量/进度），业务逻辑完全独立于入口。

## 现状（6+ 个手工实例，骨架各写一遍）

UP 主管理（10100 层）、白名单选择器（11200 层）、FolderSelectModal（200000 层）、重新索引 confirm、日记解析检测视图、smartcat 数据面板入口——每个都手写「遮罩 + popup + 标题头 + 可滚动内容 + 底部动作区 + ESC/遮罩关闭」，z-index 各自为政。

## 决定（排期后细化）

core 抽通用子弹窗骨架（如 `src/core/sub-modal.ts`），业务只注入差异：

```ts
openSubModal({
  title: 'UP 主管理',
  width?: number,                    // 缺省对齐卡片弹窗 440；移动端近全屏
  build: (contentEl, ctx) => { ... },// 业务内容（列表/表单/进度条），ctx 提供关闭/刷新
  actions?: [                        // 底部动作区（可省）
    { text: '确定', primary: true, onClick: (ctx) => boolean | void },
  ],
  onClose?: () => void,
});
```

- 骨架统一：createOverlay + escManager + 标题头（无关闭按钮，遮罩/ESC，遵主窗口规范）+ 可滚动内容 + 底部动作区；移动端近全屏 + 键盘适配。
- z-index 统一对表 settings-modal.ts 家族注释（设置面板之上的 companion 档一档收口，消灭 10100/11200/200000 三档散布——附件搬移 200000 的「压一切」诉求需在统一档内解决）。
- 迁移路径：W1 的 path-picker 即首个实例（其卡片骨架应直接基于本组件实现或合并后重构对齐）；UP 主管理、重新索引、日记解析检测等逐个迁入；**业务逻辑（名单增删、目录选择算法、修复规则）不进骨架**，骨架只管「窗」。

## 验收标准（排期后细化）

- a) openSubModal 落地，path-picker 重构为其使用方（或实现时直接基于它）；
- b) UP 主管理弹窗迁入，入口行为与业务逻辑零变化；
- c) z-index 家族表更新（子弹窗档收敛）；
- d) 全量测试绿 + tsc + 构建。
