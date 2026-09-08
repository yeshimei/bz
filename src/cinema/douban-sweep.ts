/**
 * 豆瓣盲区补全触碰（ADR-0111 / issue 252）：
 * 打开面板时对「有海报、缺豆瓣链接、豆瓣检查≠今日」的笔记写日期粒度检查标记，
 * 经文件变化被外部 douban-poster 守护进程捞起补抓（有海报走补全分支，只补信息不动海报）。
 * 同日一次（日期粒度天然节流）；完全静默，无任何通知。
 */
import type { App } from 'obsidian';
import { localNow } from '../core/ui/str';
import type { CinemaItem } from './state';
import { M } from './state';

/** 今日日期串（YYYY-MM-DD，本地时区）——「同日一次」节流的比较基准 */
export function todayStr(): string {
  return localNow().slice(0, 10);
}

/** 纯判定：该条目是否需要触碰（有海报 ∧ 缺豆瓣链接 ∧ 检查标记非今日） */
export function needsDoubanTouch(it: CinemaItem, today: string): boolean {
  return !!(it.poster && !it.doubanUrl && it.doubanCheck !== today);
}

/** 打开面板触碰扫描：对缺口笔记写 豆瓣检查 触发外部补抓；返回触碰条数 */
export async function sweepDoubanBacklog(app: App): Promise<number> {
  const today = todayStr();
  let touched = 0;
  for (const it of M.items) {
    if (!it.file || !needsDoubanTouch(it, today)) continue;
    try {
      await app.fileManager.processFrontMatter(it.file, (fm: Record<string, unknown>) => {
        fm['豆瓣检查'] = today;
      });
      touched++;
    } catch (error) {
      console.warn('豆瓣检查触碰失败:', it.file.path, error);
    }
  }
  return touched;
}
