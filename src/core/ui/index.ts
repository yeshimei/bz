/* ============================================================
 * bz 组件库（src/core/ui/）· 转发桶
 * 每个组件一个文件（icon/button/chip/field/empty/segmented/choice/lightbox），
 * 本文件只 re-export，统一入口：import { uiBtn } from 'core/ui'。
 *
 * 在样式库（tokens.css + components.css）之上提供"带功能"工厂：
 * 选项对象 + 命名导出纯函数 + 句柄/回调（对齐 core 既有
 * notice/flow-dialog/item-actions 风格）。
 * 命名带 ui 前缀，避免与既有 createIconBtn（dom.ts 文本式旧工厂）冲突。
 * ============================================================ */

// 类型
export type {
  BzTone, BzSize, BzIconName,
  BzButtonOpts, BzIconBtnOpts, BzChipOpts,
  BzInputOpts, BzFieldOpts, BzEmptyOpts, BzSegOpts, BzRangeOpts, BzChoiceOpts,
} from './types';

// 组件工厂（每组件一文件）
export { uiIcon } from './icon';
export { uiBtn, uiIconBtn, uiBtnRow, uiDialogActions } from './button';
export { uiChip } from './chip';
export { uiInput, uiField } from './field';
export { uiRange } from './slider';
export { uiEmpty } from './empty';
export { uiSegmented } from './segmented';
export { uiChoice } from './choice';
export { openLightbox, closeLightbox } from './lightbox';
export type { BzLightboxOpts } from './lightbox';
export { uiModal } from './modal';
export type { BzModalOpts } from './modal';
