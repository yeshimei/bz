/**
 * 黑匣子诊断日志（用户反馈「重启无反应/无数据」排查）：
 * 追加写 <storagePath>/blackbox-debug.log，自动提炼/增量/全量的每一步与任何异常落盘。
 * 即使 UI 通知没看到，也能从文件确认实际发生了什么（不再靠猜）。
 * mock 环境无 adapter.append → 读改写兜底；全程静默失败（不干扰主流程）。
 */
import { getBlackBoxFilePath } from './data';

/** 追加一行诊断日志（带本地时间戳；任何失败都静默） */
export async function bbLog(app: any, msg: string): Promise<void> {
  try {
    const adapter = app && app.vault && app.vault.adapter;
    if (!adapter) return;
    const logPath = getBlackBoxFilePath().replace(/\.json$/, '-debug.log');
    const line = `[${new Date().toLocaleString('zh-CN', { hour12: false })}] ${msg}\n`;
    if (typeof adapter.append === 'function') {
      await adapter.append(logPath, line);
      return;
    }
    // mock / 老环境无 append：读改写
    let existing = '';
    try {
      existing = await adapter.read(logPath);
    } catch {
      /* 首次创建 */
    }
    await adapter.write(logPath, existing + line);
  } catch {
    /* 诊断日志失败不影响主流程 */
  }
}