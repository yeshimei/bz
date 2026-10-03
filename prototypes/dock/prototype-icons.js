// 工具坞评审壳图标表（core/ui/icons.mountIcons / uiIcon → obsidian setIcon 的兑现表）。
// 键 = ui.ts 里传给 uiIcon / uiBtn / uiIconBtn 的 lucide 名；值 = 图标内芯 markup（lucide 原型）。
// ⚠️ 无工具校验的手写 JS 对象：往表尾插新键时上一行必须补逗号——一个语法错整表崩掉，
//    所有图标静默空白（症状出现在别的断言上）。改完先 `node --check prototype-icons.js`。
// 本域图标清单（改 ui.ts 加了新图标就要同步补表）：
//   square-terminal(面板品牌/清单兜底图标) container(域图标，DOMAIN_ICONS.dock)
//   search(搜索) refresh-cw(重读记录/重拉清单) plus(添加工具) x(关闭/清除)
//   chevron-left(返回) chevron-right(详情) chevron-down / check(下拉箭头与选中勾)
//   more-horizontal(卡片更多操作) play(运行) square(停止) copy(复制路径)
//   pencil(编辑) trash-2(移除) x-circle(移除登记) alert-triangle(待关注)
//   layout-grid(全部) clock(自动化) hand(手动) history(历史空态)
//   download(拉取清单) file-code(选可执行文件) folder-open(选目录) search-x(无匹配)
window.DOCK_ICONS = {
  "square-terminal": "<path d=\"m7 11 2-2-2-2\" /> <path d=\"M11 13h4\" /> <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />",
  "container": "<path d=\"M22 7.7a2.5 2.5 0 0 0-1.2-2.1l-7.4-4.3a2.5 2.5 0 0 0-2.8 0L3.2 5.6A2.5 2.5 0 0 0 2 7.7v8.6a2.5 2.5 0 0 0 1.2 2.1l7.4 4.3a2.5 2.5 0 0 0 2.8 0l7.4-4.3a2.5 2.5 0 0 0 1.2-2.1Z\" /> <path d=\"M2.3 7.5 12 13l9.7-5.5\" /> <path d=\"M12 22V13\" />",
  "search": "<path d=\"m21 21-4.34-4.34\" /> <circle cx=\"11\" cy=\"11\" r=\"8\" />",
  "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" /> <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /> <path d=\"M8 16H3v5\" />",
  "plus": "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />",
  "x": "<path d=\"M18 6 6 18\" /> <path d=\"m6 6 12 12\" />",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\" />",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
  "chevron-down": "<path d=\"m6 9 6 6 6-6\" />",
  "check": "<path d=\"M20 6 9 17l-5-5\" />",
  "more-horizontal": "<circle cx=\"12\" cy=\"12\" r=\"1\" /> <circle cx=\"19\" cy=\"12\" r=\"1\" /> <circle cx=\"5\" cy=\"12\" r=\"1\" />",
  "play": "<polygon points=\"6 3 20 12 6 21 6 3\" />",
  "square": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />",
  "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /> <path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />",
  "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /> <path d=\"m15 5 4 4\" />",
  "trash-2": "<path d=\"M3 6h18\" /> <path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" /> <path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" /> <line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" /> <line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />",
  "x-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"m15 9-6 6\" /> <path d=\"m9 9 6 6\" />",
  "alert-triangle": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /> <path d=\"M12 9v4\" /> <path d=\"M12 17h.01\" />",
  "layout-grid": "<rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\" /> <rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\" /> <rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\" /> <rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\" />",
  "clock": "<path d=\"M12 6v6l4 2\" /> <circle cx=\"12\" cy=\"12\" r=\"10\" />",
  "hand": "<path d=\"M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2\" /> <path d=\"M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2\" /> <path d=\"M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8\" /> <path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\" />",
  "history": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" /> <path d=\"M3 3v5h5\" /> <path d=\"M12 7v5l4 2\" />",
  "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /> <polyline points=\"7 10 12 15 17 10\" /> <line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
  "file-code": "<path d=\"M10 12.5 8 15l2 2.5\" /> <path d=\"m14 12.5 2 2.5-2 2.5\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z\" />",
  "folder-open": "<path d=\"m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2\" />",
  "search-x": "<path d=\"m13.5 8.5-5 5\" /> <path d=\"m8.5 8.5 5 5\" /> <circle cx=\"11\" cy=\"11\" r=\"8\" /> <path d=\"m21 21-4.3-4.3\" />",
  /* 种子清单声明的图标（displayIcon 取 manifest.icon → uiIcon；缺表即静默空白）：
     calendar-check(签到) rss(订阅抓取) hard-drive-upload(网盘备份)
     file-down(剪藏导出) file-spreadsheet(本地报表) */
  "calendar-check": "<path d=\"M8 2v4\" /> <path d=\"M16 2v4\" /> <rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" /> <path d=\"M3 10h18\" /> <path d=\"m9 16 2 2 4-4\" />",
  "rss": "<path d=\"M4 11a9 9 0 0 1 9 9\" /> <path d=\"M4 4a16 16 0 0 1 16 16\" /> <circle cx=\"5\" cy=\"19\" r=\"1\" />",
  "hard-drive-upload": "<path d=\"M12 2v8\" /> <path d=\"m16 6-4-4-4 4\" /> <rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" /> <path d=\"M6 18h.01\" /> <path d=\"M10 18h.01\" />",
  "file-down": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M12 18v-6\" /> <path d=\"m9 15 3 3 3-3\" />",
  "file-spreadsheet": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M8 13h2\" /> <path d=\"M14 13h2\" /> <path d=\"M8 17h2\" /> <path d=\"M14 17h2\" />"
};
