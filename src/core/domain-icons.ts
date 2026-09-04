/**
 * 域图标单一事实源（enh-sweep-a 收敛）：域 id → lucide 图标名。
 *
 * 消费方（一处定义、两处引用，禁止各写各的）：
 * - src/main.ts COMMANDS 命令表：域入口命令的 icon 从本表取；
 * - src/settings-panel/ui.ts DOMAINS：设置面板导航域图标从本表取。
 * 内容首页磁贴（src/home/domains.ts）取值原则即「与命令图标一致」，后续迁移时同样改为引用本表。
 *
 * 取值基准 = 当前实际注册（enh-sweep-a 全仓核对）：
 * - 与内容首页磁贴/ribbon 对齐：diary=notebook-pen（ribbon「日记本」同款）、
 *   cinema=clapperboard（磁贴同款，命令旧 film 漂移由此收敛）、review=repeat-2（磁贴同款）；
 * - 历史重复图标错开：diary 不再与 bookshelf 同用 book-open（bookshelf 独占）；
 *   复习报告命令 bz-review-report 弃 bar-chart-3（阅读分析报告独占）改 calendar-check；
 *   影视分析 bz-cinema-analysis 保持 pie-chart（三份报告 bar-chart-3/calendar-check/pie-chart 各异）。
 */
export const DOMAIN_ICONS: Readonly<Record<string, string>> = {
  // 面板专属域（无对应命令）
  global: 'settings',
  ai: 'sparkles',
  'bili-downloader': 'download',
  // 域入口命令与面板导航共用
  launcher: 'home',
  home: 'layout-grid',
  memo: 'sticky-note',
  todo: 'check-square',
  belongings: 'package',
  clipping: 'scissors',
  favorites: 'star',
  diary: 'notebook-pen',
  'reading-report': 'bar-chart-3',
  cinema: 'clapperboard',
  bookshelf: 'book-open',
  review: 'repeat-2',
  secondbrain: 'brain',
  'auto-summary': 'sparkles',
  pomodoro: 'timer',
  attach: 'folder-down',
  encrypt: 'lock',
  smartcat: 'cat',
  literature: 'list-video',
};
