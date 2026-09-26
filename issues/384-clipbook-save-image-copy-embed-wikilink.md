# 384 剪藏本：保存图片后自动复制嵌入 wikilink 到剪贴板

- 状态：已实现（待主构建部署）
- 提出：2026-09-19 用户（备忘录 item-1789790237962-3884qs，scene=代码）
- 相关：memo-code-fix 工作流；同域先例 anchor.ts `![[local]]` 换链

## 用户原话

> 保存图片后把图片的wikilink（![[路径]]）放到剪切板

## 落地形态

- `src/clipbook/ui.ts` `actSaveImage()` 成功路径（落盘结果 `res.local` 存在时）新增
  `copyImageEmbedLink(res.local)`：把 `` `![[${res.local}]]` `` 写入系统剪贴板。
- **不另发成功通知**——复用 image-save 既有「图片已保存…」单弹，避免 `copyText` 的
  成功通知造成双弹；写入被拒（权限/焦点）走 `notifyActionError(e, '复制图片链接')`
  带原因反馈；clipboard API 整体缺席（原型 fake 环境/非安全上下文）静默跳过不报错。

## 测试

- `tests/clipbook/image-save-clipboard.test.ts` 3 例（jsdom 真实面板动线：开面板 →
  正文 img 单击 → 图片工具框 → 「保存图片」）：
  1. 成功路径：`writeText` 收到 `![[归档/网页剪藏/assets/pic.png]]`、二进制真落盘、
     通知恰好一条（钉死无双弹）；
  2. 写入被拒：不出未捕获异常、错误反馈带「复制图片链接」前缀、保存照常成功；
  3. 无 clipboard API（原型 fake 同款）：保存成功且无误报错误。

## 门禁

tsc 0 错 + worktree 全量（6127/6127）+ 自审 + diff 审查 + 主仓合并终态全量 + 构建部署。
原型行为包随源指纹重出（clipbook 直接受影响；gameshelf/home/memo/review/settings-panel
五个跨域行为包输入清单含 clipbook/ui.ts 一并重出）。
