/**
 * 闪念通知包装（ticket 18，源码 L17-20 逐字）
 */
import { notice } from '../core/notice';

/** /^(🔄|📊|✅|🔗)/ 前缀静默；⚠️/❌ 保留 */
export function notify(msg: string, duration = 3000): any {
  if (/^(🔄|📊|✅|🔗)/.test(msg)) {
    return { messageEl: { textContent: '' }, hide() {} };
  }
  return notice(msg, duration);
}
