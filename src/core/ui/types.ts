/* ============================================================
 * bz 组件库 · 共享类型（src/core/ui/types.ts）
 * ============================================================ */

export type BzTone = 'default' | 'primary' | 'danger' | 'ghost';
export type BzSize = 'sm' | 'md' | 'lg';
export type BzIconName = string; // lucide 图标名

export interface BzButtonOpts {
  label?: string;          // 文字
  icon?: BzIconName;       // lucide 图标名
  tone?: BzTone;
  size?: BzSize;
  title?: string;          // tooltip
  disabled?: boolean;
  danger?: boolean;        // 图标红（icon-btn 用）
  chip?: boolean;          // 图标圆底档（.bz-btn--chip，issue 200 F 款入库）
  on?: boolean;            // 激活态（chip 档 .is-on：整钮品牌色）
  className?: string;      // 附加类
  onClick?: () => void;
}

export interface BzIconBtnOpts {
  icon: BzIconName;
  title?: string;
  on?: boolean;            // 激活态 --on
  lg?: boolean;            // 触控档
  xs?: boolean;            // 行内小钮
  close?: boolean;         // 关闭钮档
  danger?: boolean;        // 危险红
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export interface BzChipOpts {
  label: string;
  icon?: BzIconName;
  count?: number;          // 徽标计数
  selected?: boolean;      // 选中实底 --on
  selectedSoft?: boolean;  // 选中软底 --sel（品牌软底，区别于实底）
  removable?: boolean;     // 带删除钮（不暗示选中态；选中与否由 selected/selectedSoft 显式声明）
  locked?: boolean;        // 锁定虚线
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export interface BzInputOpts {
  type?: 'text' | 'password' | 'number' | 'date';
  placeholder?: string;
  value?: string;
  error?: boolean;
  disabled?: boolean;
  onInput?: (value: string) => void;
}

/** 滑条（.bz-range）：评分/数值调节，自绘轨道+滑块（抗 Obsidian 默认 range 外观） */
export interface BzRangeOpts {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  disabled?: boolean;
  className?: string;      // 附加类（如 bz-range--lg）
  onInput?: (value: number) => void;
  onChange?: (value: number) => void;
}

export interface BzFieldOpts {
  label?: string;
  desc?: string;           // 说明
  error?: string;          // 错误文字
  control: HTMLElement;    // 已建控件（input/select…）
}

export interface BzEmptyOpts {
  icon?: BzIconName;
  title: string;
  desc?: string;
  actions?: HTMLElement;   // 按钮行容器（.bz-btn-row）
}

export interface BzSegOpts<T extends string = string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  label?: string;          // radiogroup aria-label（可访问性）
}

/** 平铺单选组（.bz-choice）：选项胶囊可换行，单选带 is-on 态；
 *  float = 浮岛 segmented（轨道收内容宽 + 白卡滑动指示器，issue 199 拍板） */
export interface BzChoiceOpts<T extends string = string> {
  options: { value: T; label: string; dot?: string }[]; // dot = 前置色点（数据语义色）
  value: T;
  onChange: (value: T) => void;
  className?: string;
  label?: string;          // radiogroup aria-label（可访问性）
  float?: boolean;         // 浮岛形态：轨道 + 滑动指示器
}

/** 开关（.bz-sw）：40×22 滑块，开 = 品牌实底 */
export interface BzSwitchOpts {
  checked?: boolean;
  disabled?: boolean;      // 禁用（置灰 + 不响应交互）
  onChange?: (checked: boolean) => void;
}

/** 下拉选择（.bz-select）：选项多/文案长/行内放不下时的单行单选；
 *  短选项组请用 .bz-choice 平铺胶囊替代 */
export interface BzSelectOpts<T extends string = string> {
  options: { value: T; label: string }[];
  value: T;
  placeholder?: string;              // 空值（无匹配选项）时显示
  className?: string;                // 附加类（行内宽度等域布局用）
  onOpenChange?: (open: boolean) => void; // 弹层开合回调（上层上下文处理：z 提层等）
  onChange: (value: T) => void;
}

/** 搜索框（.bz-search：前缀搜索图标 + 输入） */
export interface BzSearchOpts {
  placeholder?: string;
  value?: string;
  onInput?: (v: string) => void;
}

/** 主头行（.bz-main-head：分组标题 + 计数 + spacer + 主按钮） */
export interface BzMainHeadOpts {
  title: string;
  count?: string;          // 计数文案（无则隐藏计数位）
  action?: { label: string; icon?: BzIconName; onClick?: () => void }; // 右侧主按钮（30px 中档）
}

/** 状态侧栏（.bz-rail）行项：前缀槽五选一（icon / boxedIcon / emoji / badge / dot） */
export interface BzRailItem {
  id: string;
  name: string;
  icon?: BzIconName;       // 前缀 lucide 图标（.bz-ic）
  boxedIcon?: BzIconName;  // 前缀图标底座（.bz-rail-ic 20px 小方块）
  emoji?: string;          // 前缀 emoji 行头（.bz-rail-emoji 14px 槽；issue 201，同 memo 场景行头）
  badge?: { t: string; label: string; tint?: string }; // 字母/字徽标（t=文本，label=aria 名，tint=底色注入 --bz-rail-tint）
  dot?: string;            // 状态色点（色值 → --bz-rail-tint）
  count?: string | number; // 计数
  pill?: boolean;          // 计数胶囊档（.bz-rail-count--pill）
  unread?: string | number; // 未读气泡（真值渲染，文本入 .bz-rail-unread）
  children?: BzRailItem[]; // 二级子列表（父项点击 = 展开收起，不触发 onSelect）
}

/** 状态侧栏（.bz-rail）：左栏分组导航 */
export interface BzRailOpts {
  groups: Array<{ label?: string; items: BzRailItem[] }>;
  activeId: string;                  // 初始选中行
  onSelect?: (id: string) => void;   // 叶子项点击（组内单选后回调）
  foot?: HTMLElement;                // 底部固定区内容
}

/** 移动筛选横滑条（.bz-mobstrip，≤768px 替代 rail） */
export interface BzMobStripOpts {
  items: Array<{ id: string; label: string; dot?: string }>; // dot = 前置色点（色值 → --bz-rail-tint）
  value: string;
  onChange?: (id: string) => void;
}

/** 统计卡（.bz-stat：数字 + 标签） */
export interface BzStatOpts {
  label: string;
  num: string | number;
  icon?: BzIconName;       // 标签前缀图标
  hint?: string;           // 补充说明
  tone?: 'main' | 'ok' | 'warn' | 'danger' | 'text';
  click?: boolean;         // 可点筛选（--click 指针暗示；onClick 存在即绑事件）
  onClick?: () => void;
}

/** 进度条（.bz-progress：track + i 填充） */
export interface BzProgressOpts {
  value?: number;          // 0-100（钳制）
  tone?: 'ok' | 'warn' | 'danger';
  thin?: boolean;          // 3px 媒体封面档
}

/** 候选浮层（.bz-popover：input 锚定的候选列表） */
export interface BzPopoverOpts {
  anchor: HTMLElement;     // 锚点（须位于 position:relative 容器内；浮层挂其父元素）
  options: Array<{ id: string; label: string; icon?: BzIconName }>;
  value?: string;          // 当前选中
  emptyText?: string;      // 空态文案
  onPick?: (id: string) => void;
}

/** 输入联想（.bz-popover：聚焦/输入惰性弹出的候选下拉，uiSuggest） */
export interface BzSuggestOpts {
  anchor: HTMLInputElement;          // 联想锚点输入框（浮层挂其父元素）
  source: () => string[];            // 候选源（每次开/输时求值，可动态）
  max?: number;                      // 候选上限（默认 30）
  excludeCurrent?: boolean;          // 排除与现值完全相同的候选（点选回焦不复弹自身）
  iconOf?: (value: string) => string | HTMLElement;  // 候选前缀符（emoji 文本或图标元素；缺省无）
  labelOf?: (value: string) => string; // 候选主文本（缺省原串）
  onPick?: (value: string) => void;  // 点选/回车选定回调（回填后触发）
}


/** 卡片视觉单选组（.bz-cardpick，issue 210）：预览卡 + 名称，设置面板「看脸选」类设置项 */
export interface BzCardPickOpts<T extends string = string> {
  options: { value: T; label: string; prevClass?: string }[]; // prevClass = 预览区附加类（视觉由使用方域样式提供）
  value: T;                // 当前选中（未匹配任何选项时无选中态，回落由调用方负责）
  onChange: (value: T) => void;
  className?: string;
  label?: string;          // radiogroup aria-label
}
