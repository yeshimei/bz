/**
 * 影视海报抓取状态监听（2025-08 用户需求）：
 * 创建影视笔记后，外部 @jwbz/obsidian-douban-poster watcher 会扫描缺海报笔记，
 * 抓取海报与豆瓣信息写入 frontmatter「海报」字段。
 * 本模块轮询笔记「海报」字段：非空即视为获取完成 → 原地更新 progress 通知为「已完成」
 * （不弹第二条通知，通知条常驻直到完成或用户点击关闭）。
 */
import type { App, TFile } from 'obsidian';
import type { NoticeHandle } from '../core/notice';

/** 轮询间隔 ms */
export const POSTER_POLL_MS = 2000;
/** 最大轮询次数（2s × 150 = 5 分钟）；超时停止轮询，通知保持常驻由用户点击关闭 */
export const POSTER_POLL_MAX = 150;

/**
 * 监听影视笔记海报字段：轮询检测 frontmatter「海报」非空 → 通知原地更新为「✅ 海报和豆瓣信息获取完成」。
 * @param handle 创建时返回的 progress 通知句柄（progress 类型默认常驻，不自动消失）
 */
export function watchPosterFetch(app: App, file: TFile, handle: NoticeHandle): void {
  let stopped = false;
  let polls = 0;
  let timer = 0;

  const stop = (): void => {
    stopped = true;
    window.clearInterval(timer);
  };

  const finish = (): void => {
    handle.setMessage('✅ 海报和豆瓣信息获取完成');
    handle.setType('success');
  };

  const check = async (): Promise<boolean> => {
    try {
      const content = await app.vault.read(file);
      // frontmatter「海报: 」为空不匹配（[ \t]* 不吞换行，避免误判下一行）；有值（路径/链接）即完成
      const m = content.match(/^海报:[ \t]*(\S.*)$/m);
      return !!(m && m[1].trim());
    } catch {
      return false;
    }
  };

  const tick = async (): Promise<void> => {
    if (stopped) return;
    polls += 1;
    if (await check()) {
      stop();
      finish();
      return;
    }
    if (polls >= POSTER_POLL_MAX) stop();
  };

  void tick(); // 立即检查一次（创建时已带海报则直接完成）
  timer = window.setInterval(() => void tick(), POSTER_POLL_MS);
}
