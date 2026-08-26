/**
 * 关面板统一路径（UX-25）——无环共享模块：
 * panel（关闭按钮/遮罩/ESC）与 entries（jumpToEntry）两侧引用，
 * 避免 entries↔panel 顶层 import 环（ADR-0002：禁止模块顶层互访；
 * 本模块只引用叶子依赖，天然无环）。
 */
import { state } from '../state';
import { isUnlocked, lockSafe } from '../encrypt';
import { clearEncryptedEntries } from '../store';

/** 隐藏主面板并锁定保险箱：上锁后加密条目完全不可见（Q21-a）；UX-25 起为唯一关闭路径 */
export function closePanel() {
  if (state.ui.maskLayer) state.ui.maskLayer.style.visibility = 'hidden';
  if (state.ui.tagFilterPopup) state.ui.tagFilterPopup.style.visibility = 'hidden';
  // isUnlocked 自带降级链（未注入设置视为未解锁），不会抛错
  if (isUnlocked()) {
    lockSafe();
    clearEncryptedEntries();
  }
}