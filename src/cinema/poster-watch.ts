/**
 * 影视海报抓取状态监听（2025-08 用户需求；ADR-0087 自旧 src/movie/poster-watch.ts 迁入）：
 * 创建影视笔记后，外部 @jwbz/obsidian-douban-poster watcher 会扫描缺海报笔记，
 * 抓取海报与豆瓣信息写入 frontmatter「海报」字段。
 * 本模块轮询笔记「海报」字段：非空即视为获取完成 → 原地更新 progress 通知为「已完成」
 * （不弹第二条通知）；轮询超时（POSTER_POLL_MAX）→ 原地更新为明确失败，
 * 不再永久挂「获取中」（通知体不带 emoji 前缀）。
 */
import type { App, TFile } from 'obsidian';
import type { NoticeHandle } from '../core/notice';

/** 轮询间隔 ms */
export const POSTER_POLL_MS = 2000;
/** 最大轮询次数（2s × 150 = 5 分钟）；超时停止轮询并把通知收尾为失败 */
export const POSTER_POLL_MAX = 150;

/** 活跃轮询的停止函数登记表（插件卸载时统一 clearInterval，防卸载后仍读文件/写通知） */
const activeStops = new Set<() => void>();

/** 停止全部海报轮询（cinema 域 unload 时调用；幂等） */
export function stopAllPosterWatch(): void {
  for (const stop of [...activeStops]) stop();
  activeStops.clear();
}

/**
 * 监听影视笔记海报字段：轮询检测 frontmatter「海报」非空 → 通知原地更新为「海报和豆瓣信息获取完成」；
 * 轮询到上限 → 原地更新为「海报获取超时：请确认海报守护进程已运行」（error，不再永久挂「获取中」）。
 * @param handle 创建时返回的 progress 通知句柄（progress 类型默认常驻，不自动消失）
 */
export function watchPosterFetch(app: App, file: TFile, handle: NoticeHandle): void {
  let stopped = false;
  let polls = 0;
  let timer = 0;

  const stop = (): void => {
    stopped = true;
    window.clearInterval(timer);
    activeStops.delete(stop);
  };
  activeStops.add(stop);

  /** 获取完成：收尾句柄为 success */
  const finish = (): void => {
    handle.setMessage('海报和豆瓣信息获取完成');
    handle.setType('success');
  };

  /** 轮询超时：收尾句柄为 error（明确失败，不再永久挂「获取中」） */
  const fail = (): void => {
    handle.setMessage('海报获取超时：请确认海报守护进程已运行');
    handle.setType('error');
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
    if (polls >= POSTER_POLL_MAX) {
      stop();
      fail(); // 收尾句柄：明确失败而非永久「获取中」
    }
  };

  void tick(); // 立即检查一次（创建时已带海报则直接完成）
  timer = window.setInterval(() => void tick(), POSTER_POLL_MS);
}
