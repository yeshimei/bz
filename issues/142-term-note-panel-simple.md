# Ticket 142 — 术语生成文献笔记面板简洁版（用户逐条拍板）

> 术语面板简洁化改版（原型 `.scratch/term-note-panel/index.html` 定稿方案 A 属性表，.scratch 不入库）。
> spec 见 `.scratch/memo-suite-plugin/spec.md`「术语生成面板简洁版」节。不改数据格式（frontmatter 五键
> title/type/domain/term/date 不变）、不改命令（bz-literature-note-term 不变）、不改域事件契约
> （term-generated 载荷不变）。

## 1. 删（用户逐条点名）

- [x] 删除弹窗标题：`bz-win-head` + `bz-lit-title`「术语生成文献笔记」整行移除
- [x] 删除「术语」label
- [x] 删除输入框 placeholder（原「如 黑洞 / 贝叶斯定理」）
- [x] 删除输入框下方的红色提示小字：生成中状态行 `#lit-term-status` 一并删除，生成中态并入
      「生成」按钮文案「生成中…」——输入行下方无任何提示文字
- [x] 「类型」属性行不展示（type 固定 term）

## 2. 预览只读（不给输入框、不可编辑）

- [x] 领域 input（`#lit-term-domain`）/ 简介 textarea（`#lit-term-body`）删除，「可改/可编辑」文案删除
- [x] 布局：上面文档属性（属性卡：术语/领域/日期），下面内容（内容卡：AI 简介段落）；
      区标题「属性/内容」不展示 —— 两张卡片直接承内容

## 3. 交互变化

- [x] 「重新生成」手改守卫删除：预览只读无手改值（ticket 139 引入的 flow-dialog 确认一并移除），
      直接覆盖上一轮预览
- [x] 保留：输入行 + 生成 / 重新生成 / 确认写入（传面板 term + 预览值，所见即所得不重跑 AI）/
      Enter 生成 / ESC·遮罩关闭 / 命令预填编辑器选中词 / 行为流 term-generated / 未确认不落盘
      （ticket 138 §2.1）

## 4. 门禁

- tsc --noEmit + 全量测试（literature UI 术语用例改写：无标题/label/placeholder/状态行断言、
  预览只读 input/textarea 为空断言、重新生成直接覆盖无守卫用例）+ 构建部署