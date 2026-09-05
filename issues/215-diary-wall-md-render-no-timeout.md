# issue 215：正文 markdown 渲染被 3s 超时竞速误杀——移除竞速改离屏渲染

## 病根（用户截图：正文 `[[ ]]` 原样外露 = 纯文本回退痕迹）
renderText 用 `Promise.race([render, 3s 定时器])`：开墙几十张卡同时渲染、主线程忙时
定时器先到 → 「还没渲染完」的卡整卡替换成纯文本。markdown 全程没渲染成功过（或渲染
完成但被回退覆盖），且慢只是被误杀而非失败。

## 修复（`ui.ts renderText` 重写）
- 先垫纯文本（不空白、防注入）；渲染进离屏 div，成功才清空容器搬入节点；
  失败/异常保持纯文本；**不再设超时**——渲染慢只延迟变好看，不会误杀。
- 渲染完卸载 Component；替换前查 container.isConnected（renderWall 重建竞态，沿旧守卫）。
- dataset.renderFallback 机制随竞速一起删除（全仓无其他引用）。

## 门禁
全量 4188 绿 + tsc 干净。
