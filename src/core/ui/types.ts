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
  selected?: boolean;      // --on
  removable?: boolean;     // 带删除钮
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
}
