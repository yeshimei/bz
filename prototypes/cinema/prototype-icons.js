// 影院评审壳图标表（mountIcons 壳基座用；对齐 core/ui icons.ts 的 data-lucide 物化）。
// 键 = 纯层 iconSpan(name) 的 lucide 占位名；值 = 图标内芯 markup（与原型旧 SVG 表一比一）。
// 加载顺序：本文件先于 prototype-data.js。
window.CN_ICONS = {
  "bot": "<path d=\"M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z\"/><path d=\"M19 15l.9 2.4L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.6L19 15z\"/>",
  "bar-chart-3": "<path d=\"M3 3v18h18\"/><path d=\"M7 16v-5M12 16V8M17 16v-3\"/>",
  "x": "<path d=\"M18 6 6 18M6 6l12 12\"/>",
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>",
  "plus": "<path d=\"M5 12h14M12 5v14\"/>",
  "pencil": "<path d=\"M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z\"/>",
  "trash-2": "<path d=\"M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>",
  "alert-circle": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4M12 17h.01\"/>",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\"/>",
  "layout-grid": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/>",
  "eye": "<path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  "play": "<polygon points=\"6 3 20 12 6 21 6 3\"/>",
  "check": "<path d=\"M20 6 9 17l-5-5\"/>",
  "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/>",
  "clapperboard": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 4v16M17 4v16M3 8.5h4M3 15.5h4M17 8.5h4M17 15.5h4M7 12h10\"/>",
  "sliders-horizontal": "<path d=\"M21 4h-8m-5 0H3M21 12h-3m-6 0H3M21 20h-11m-4 0H3\"/><circle cx=\"11\" cy=\"4\" r=\"1.6\"/><circle cx=\"16\" cy=\"12\" r=\"1.6\"/><circle cx=\"8\" cy=\"20\" r=\"1.6\"/>"
};
