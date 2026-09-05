# Issue 202: 归物本三修——状态计数去背景 / 桌面点行不开菜单 / 记一笔分类默认空

日期：2026-09-05　状态：已交付（master 8e5e550；跟进 a422fc5）
前置：issue 201（收藏本同款先例：计数去胶囊档、桌面点击弹菜单 bug 修——菜单只走右键）

## 需求（用户反馈三连）

1. 归物本左栏状态列表后面的数字不需要背景色；
2. 右侧内容列表**左键点击**会弹出操作菜单（右键菜单）——是 bug；
3. 记一笔表单的分类默认填入「📱 智能手机」，应该是空的。

## 修复

### 一、状态计数去背景（src/belongings/ui.ts renderStatus）

uiRail 计数有两档：素数（默认，无背景）与胶囊（`.bz-rail-count--pill`，背景色）。
归物本传了 `pill: true`（全仓唯一使用点）——去掉即回落素数档。组件库两档保留不动。

### 二、桌面点击不开菜单（同收藏本 issue 201 拍板）

内容区点击委托原桌面分支调 `openRowMenu`（跟手菜单）——删去；桌面点击不再有任何动作
（行本就 `cursor: default`，无可点暗示），操作唯一入口 = 右键菜单（contextmenu 委托保留）；
移动端点行仍弹底部详情抽屉。`openRowMenu` 函数随之成死代码，删除。

### 三、记一笔分类默认空

`openForm` 原回填 `DEFAULT_CATEGORIES[0]`（📱 智能手机）——改为新记不回填（`it?.category ?? ''`），
placeholder「输入或选择分类」引导；保存校验「请选择或输入分类」原样保留（原默认回填使其不可达，
现成为真实守门）。分类联想弹层（categoryPicker）仍用 DEFAULT_CATEGORIES 作候选源，import 不动。

## 测试（tests/belongings/ui.test.ts）

- 新记表单分类默认空断言（原断言「📱 智能手机」翻转）；
- 桌面单击行不出菜单 + 右键仍出（原「单击同样出菜单」翻转）；
- 左栏 rail 无 `.bz-rail-count--pill`；
- 自写 modify 用例保存前补填分类（新守门下必填）。

全量 4131/4131 绿 + tsc --noEmit 干净。

## 跟进（a422fc5）：分类下拉惰性弹出

用户反馈：打开「记一笔」表单时分类下拉默认就开着。病因 = categoryPicker 挂载即 append + draw
（表单一开弹层就在）。改为惰性弹出：`focus`/`input` 才开，keydown 收起态不拦（Esc 落回表单层）；
外点关闭与 Esc 分层语义不变。测试 +1（收起/弹出两态 Esc 派发区分冒泡——esc-manager 挂 document，
冒泡 Esc 会真关表单，不冒泡只验输入框层）。
