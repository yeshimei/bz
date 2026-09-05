# issue 199：浮岛 segmented 组件化 + 待办弹窗修复 + meta 行基线对齐

> 承 issue 197 评审（.zcode/ui-prototypes/todo-dialogs/，DECISION.md 记档）。
> 2026-09-05 拍板：平铺选择（场景/优先级/排序三档）统一浮岛 segmented 形态；「定位到笔记」= F 图标圆底。

## 背景（原型评审结论）

- chip 形态九档对照（灰底/可见灰/ghost/安静选中/浮岛/短线/滑块/彩点/墨块），拍板**浮岛**
  ——且明确去发丝描边；轨道 `#fbfbfb`、`width:max-content`、白卡滑动 200ms。
- 排序三档（紧急优先/仅按到期/按创建）与场景选择是同一控件，一并换浮岛。
- 「定位到笔记」六款对照，拍板 **F 图标圆底**（pin 装 22px 小圆底 + 文字素排）。

## 改动

### 组件库/样式库（先扩共享，禁域内自造）
- `tokens.css`：+`--bz-surface-track`（明 `#fbfbfb` / 暗 `rgba(0,0,0,0.2)`）
- `types.ts`：`BzChoiceOpts` +`float?: boolean`
- `choice.ts`：float 模式——`.bz-choice--float` 类 + `.bz-choice-seg` 滑动指示器
  （syncSeg 量位 transform/width、未挂载限次 rAF 重试、setValue 时 animate 滑动、
  resize 重量 + `detach()` 摘监听）；返回值 +`detach`（既有调用方解构不受影响）
- `components.css`：`.bz-choice--float` 轨道/指示器/未选透底灰字/选中加重全套规则

### 待办域
- `ui.ts`：排序三档 uiSegmented → uiChoice(float)（`data-todo-sort`，onChange 持久化
  memoSortMode 语义不变；面板关闭 detach）；编辑器场景/优先级 choice 加 float；
  定位钮 uiBtn → 自绘 F 款（`.bz-todo-pos-btn` + `.bz-pos-chip`，绑定态整钮转品牌色）
- `styles.css`：
  - meta 行基线对齐——`.bz-todo-time` 补 `line-height:18px`（此前默认 ~13px 行高盒，
    与 18px 标签盒 flex 居中后文字基线错位 ~2.5px，即「彩色按钮文字与图标文字没对齐」）
  - `.bz-todo-extra .bz-input` 满宽（.bz-input 默认 240px 定宽，不在 .bz-field 的框吃默认值）
  - `.bz-todo-addscene` 容器/提示行补规则（此前零规则裸排）：flex 纵排 + 间距 +
    提示降 caption 灰字
  - `.bz-todo-pos-btn` F 款全套（chip 圆底/hover 品牌/active 品牌字）

### 测试
- 修 master 既有时刻敏感 flake：「设置播种 created」用例的种子含 `今天 09:00` 截止，
  过点即变逾期、dueRank 分组压过 created 排序（09:00 后单跑必挂）——用例内清空种子截止
- +2 用例：排序浮岛（三档/is-on/切换写回设置/指示器节点）、编辑器浮岛+F 款（两组
  float + seg、pos chip + pin + 文字）；addscene 用例补结构断言

## 手册
- `docs/ui-kit-manual.md`：§3.1 token 表 +`--bz-surface-track`；§3.2 `.bz-choice`
  行补 `.bz-choice--float`；§4 `uiChoice` 签名 +float/detach

## 验证
- todo 域 88 用例绿；tsc 干净；全量门禁见合并提交
