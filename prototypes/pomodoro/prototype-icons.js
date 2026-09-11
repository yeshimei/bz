// 番茄钟评审壳图标表（手写白名单，范式随 home/settings-panel）。
// 行为单源：真 setIcon（fake-obsidian 版）的查找键 = lucide 图标名，
// 值 = lucide-static 真值（v0.544.0）；缺名 = 图标位空白、不报错——新增先查表。
window.BZ_POMODORO_ICONS = {
  "__comment": "番茄钟壳用到的 lucide 名 → 内联 svg 片段；setIcon 真查找键。",
  // 弹窗本体（src/pomodoro/ui.ts setIcon 调用点：idle 相位图标）
  "timer": "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" /> <line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" /> <circle cx=\"12\" cy=\"14\" r=\"8\" />"
};
