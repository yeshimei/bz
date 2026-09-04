/**
 * 域图标单一事实源（enh-sweep-a 收敛）：域 id → lucide 图标名。
 *
 * 消费方（一处定义、多处引用，禁止各写各的）：
 * - src/main.ts COMMANDS 命令表：域入口命令的 icon 从本表取；
 * - src/settings-panel/ui.ts DOMAINS：设置面板导航域图标从本表取；
 * - src/home/domains.ts：内容首页磁贴 icon 从本表取（终局 review 批 B 迁移）；
 * - src/diary/ui/quote.ts：bz-diary-write 命令 icon 引 DOMAIN_ICONS.diary（同批）。
 *
 * 取值基准 = 当前实际注册（enh-sweep-a 全仓核对；批 B 补缺两项）：
 * - 与内容首页磁贴/ribbon 对齐：diary=notebook-pen（ribbon「日记本」同款）、
 *   cinema=clapperboard（磁贴同款，命令旧 film 漂移由此收敛）、review=repeat-2（磁贴同款）；
 * - recap=calendar-heart（今日回顾，方向一 R2 新域；lucide 日历语义，未与其他命令重复）；
 * - diary-wall=images（回忆墙媒体语义，命令/磁贴同款，批 B 入表）；
 * - settings-panel=settings-2（设置面板命令/磁贴同款，批 B 入表）；
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
  home: 'layout-grid',
  recap: 'calendar-heart',
  memo: 'sticky-note',
  todo: 'check-square',
  belongings: 'package',
  clipping: 'scissors',
  favorites: 'star',
  diary: 'notebook-pen',
  'diary-wall': 'images',
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
  // 命令专属域
  'settings-panel': 'settings-2',
};
