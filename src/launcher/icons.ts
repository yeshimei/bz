/**
 * 入口页磁贴图标库（ticket 23）：内置 lucide 图标名清单 + 模糊过滤。
 * Obsidian 无公开图标选择器 API，用内置清单 + setIcon 渲染。
 */
/** 常用 lucide 图标名（kebab-case，Obsidian setIcon 支持） */
export const LUCIDE_ICONS: string[] = [
  'home', 'settings', 'command', 'layout-grid', 'grid-2x2', 'notebook-pen', 'notebook',
  'sticky-note', 'check-square', 'square-check', 'circle-check', 'list-checks', 'list',
  'calendar', 'calendar-days', 'clock', 'star', 'heart', 'book-open', 'book-marked',
  'library', 'film', 'clapperboard', 'tv', 'music', 'mic', 'headphones', 'volume-2',
  'message-square', 'messages-square', 'mail', 'inbox', 'send', 'paperclip', 'link',
  'key', 'key-square', 'lock', 'unlock', 'shield', 'shield-check', 'fingerprint',
  'eye', 'eye-off', 'camera', 'image', 'file-text', 'file-plus', 'folder', 'folder-open',
  'folder-plus', 'search', 'plus', 'minus', 'x', 'check', 'pencil', 'edit', 'trash-2',
  'trash', 'copy', 'clipboard', 'archive', 'bookmark', 'pin', 'tag', 'tags', 'filter',
  'sliders-horizontal', 'palette', 'brush', 'pen-tool', 'scissors', 'zap', 'flame',
  'bell', 'bell-ring', 'alert-circle', 'info', 'help-circle', 'question-mark',
  'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'chevron-right', 'chevron-left',
  'refresh-ccw', 'rotate-ccw', 'rotate-cw', 'download', 'upload', 'external-link',
  'globe', 'map-pin', 'compass', 'target', 'trophy', 'award', 'medal', 'gift',
  'database', 'hard-drive', 'terminal', 'code', 'play', 'pause', 'stop', 'fast-forward',
  'repeat', 'shuffle', 'monitor', 'smartphone', 'tablet', 'watch', 'battery-full',
  'wifi', 'bluetooth', 'printer', 'usb', 'cloud', 'cloud-download', 'cloud-upload',
  'sun', 'moon', 'cloud-rain', 'snowflake', 'umbrella', 'coffee', 'cake', 'leaf',
  'plane', 'train', 'car', 'bike', 'gamepad-2', 'puzzle', 'wallet', 'credit-card',
  'banknote', 'shopping-cart', 'package', 'truck', 'graduation-cap', 'brain', 'dumbbell',
  'footprints', 'utensils', 'bed', 'bath', 'pet', 'cat', 'dog', 'bug', 'sparkles',
  'wand-2', 'rocket', 'flag', 'star-half', 'heart-pulse', 'activity', 'trending-up',
  'bar-chart-3', 'pie-chart', 'line-chart', 'calculator', 'percent', 'dollar-sign',
  'rss', 'twitter', 'github', 'youtube', 'instagram', 'facebook',
];

/** 模糊过滤（大小写不敏感子串匹配；空查询返回全部） */
export function filterIcons(query: string, limit = 200): string[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return LUCIDE_ICONS.slice(0, limit);
  return LUCIDE_ICONS.filter((n) => n.includes(q)).slice(0, limit);
}
