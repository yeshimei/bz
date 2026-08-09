/**
 * 闪念通知包装（ticket 18，源码 L17-20 逐字）
 */
import { notice } from '../core/notice';
import type { NoticeType } from '../core/notice';

/** /^(🔄|📊|✅|🔗)/ 前缀静默；⚠️/❌ 保留（映射为显式类型并剥离 emoji） */
export function notify(msg: string, duration = 3000): any {
  if (/^(🔄|📊|✅|🔗)/.test(msg)) {
    return { messageEl: { textContent: '' }, hide() {} };
  }
  const m = msg.match(/^(⚠️|❌)\s*/);
  const type: NoticeType = m ? (m[1] === '⚠️' ? 'warning' : 'error') : 'info';
  return notice(msg.replace(/^(⚠️|❌)\s*/, ''), type, duration);
}
