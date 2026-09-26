# 319 挂载树·入口与壳：全屏白板、命令与进度

- 状态：已交付（已合入 master：卡片列表行与预览弹层「看挂载树」入口 + 全屏白板壳（`.bz-kb-mask`/`.bz-kb-window`，不注册 ItemView）+ `src/main.ts` 命令 `bz-knowledge-mount-tree`／`bz-knowledge-mount-refresh`；`tests/knowledge/mount-canvas.test.ts` 等覆盖）
- 关联：spec §界面 ／ `src/knowledge/ui.ts`（`openPreview:667` ／ `openSheet:899` ／ `createMainUI:490` ／ `topifyZ`）／ `src/main.ts:161`
- 依赖：316、317、318

## 交付

- [ ] 卡片列表行 + 卡片预览弹层各加一粒「看挂载树」→ 打开白板（**自绘全屏遮罩**，沿用 `.bz-kb-mask` + `.bz-kb-window` 先例，**不注册 ItemView**）；
      关闭回到知识盒主窗（主窗保留在下层）。
- [ ] 命令注册进 `src/main.ts`：`bz-knowledge-mount-tree`（主卡 = 当前打开的笔记）／ `bz-knowledge-mount-refresh`。
- [ ] **等建议齐再开**：缓存命中 → 秒开；未命中 → 带进度生成后打开；**缺索引不等待**（直接开 + 提示）。
- [ ] 白板顶栏：面包屑 + 方向 + 「重新生成」+ 建议状态（生成中 ／ 已缓存 ／ 不可用）。
- [ ] 移动端真全屏（`.bz-panel-mtop`）；关闭手势与既有面板一致。
- [ ] UI 测试：从预览弹层打开/关闭、命令触发、无索引路径、移动端类名。

## 验收

三步可达：列表点卡片 → 预览 → 看挂载树；命令面板同样一次直达。
