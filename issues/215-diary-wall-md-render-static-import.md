# issue 215 终版：markdown 渲染真凶 = 动态 import('obsidian')

## 定位（用户控制台日志实锤）
`TypeError: Failed to resolve module specifier 'obsidian'` @ renderText——
`await import('obsidian')` 动态导入在打包后的插件环境解析不了裸模块名，导入即抛错，
渲染从未开始，永远走纯文本回退。前两轮（去 3s 竞速/离屏改直挂）修的都是回退逻辑，
不是病根。

## 修复
- ui.ts 顶部静态 `import { Component, MarkdownRenderer } from 'obsidian'`（全仓唯一动态导入点）；
- renderText 终版：直挂已挂载容器、无超时、失败回退纯文本 + console.warn（保留 215b 成果）。

## 门禁
全量 4188 绿 + tsc 干净。
