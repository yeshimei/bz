/**
 * 通用工具函数（Q3.js window.__utils 移植 + 原脚本内联工具）
 * 行为与 Q3.js 逐字一致（spec「Q3 core 层逐行提取」）。
 */
import moment from 'moment';
import { requestUrl } from 'obsidian';
import { getApp } from './app';

/** HTML 转义 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return '&#39;';
  });
}

/** pad2(n)：两位数补零（月/日/时/分/秒） */
export function pad2(n: number | string): string {
  return String(n).padStart(2, '0');
}


/** 睡眠 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== Q3 工具（window.__utils 逐字移植） ====================

/** generateId(prefix)：prefix-时间戳-随机6位 */
export function generateId(prefix?: string): string {
  prefix = prefix || 'item';
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

/** extractUrlAndDisplay(c)：解析 markdown 链接 / 裸 URL，返回 {url, display} */
export function extractUrlAndDisplay(c: string): { url: string | null; display: string } {
  const m1 = c.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (m1) return { url: m1[2], display: m1[1] };
  const m2 = c.match(/(https?:\/\/\S+)/i);
  if (m2) {
    const u = m2[1], d = c.replace(u, '').trim();
    return { url: u, display: d || u };
  }
  return { url: null, display: c };
}

/** formatFileSize(bytes)：K/M 缩写，0/空返回 null */
export function formatFileSize(bytes: number | null | undefined): string | null {
  if (!bytes) return null;
  const kb = bytes / 1024;
  return kb < 1024 ? kb.toFixed(0) + 'K' : (kb / 1024).toFixed(2) + 'M';
}

/**
 * formatRelativeTime(date, now)：相对时间格式化（moment）
 * 未来时间→YYYY-MM-DD [HH:mm]；刚刚/N分钟前/N小时前/昨天/前天/周几/MM-DD/YYYY-MM-DD
 */
export function formatRelativeTime(date: Date | string | number, now: Date = new Date()): string {
  const target = moment(date as any);
  if (!target.isValid()) return '无效日期';

  // 判断原始输入是否包含时间部分（仅当传入字符串时）
  let hasExplicitTime = true; // 默认有时间
  if (typeof date === 'string') {
    hasExplicitTime = !/^\d{4}-\d{2}-\d{2}$/.test(date.trim());
  }

  const nowMoment = moment(now);
  const diffSeconds = nowMoment.diff(target, 'seconds');

  function shouldShowTime(): boolean {
    const timeStr = target.format('HH:mm');
    if (timeStr !== '00:00') return true;
    return hasExplicitTime;
  }

  // 未来时间
  if (diffSeconds < 0) {
    return target.format(shouldShowTime() ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD');
  }

  // 1分钟内
  if (diffSeconds < 60) return '刚刚';

  const diffMinutes = Math.floor(diffSeconds / 60);
  // 1小时内
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;

  // 今天内
  const todayStart = moment(now).startOf('day');
  if (target.isSame(todayStart, 'day') && diffMinutes >= 60) {
    const hours = Math.floor(diffMinutes / 60);
    return `${hours}小时前`;
  }

  // 昨天 / 前天
  const yesterdayStart = moment(now).subtract(1, 'days').startOf('day');
  const beforeYesterdayStart = moment(now).subtract(2, 'days').startOf('day');
  if (target.isSame(yesterdayStart, 'day')) {
    return shouldShowTime() ? `昨天 ${target.format('HH:mm')}` : '昨天';
  }
  if (target.isSame(beforeYesterdayStart, 'day')) {
    return shouldShowTime() ? `前天 ${target.format('HH:mm')}` : '前天';
  }

  // 本周内
  const weekStart = moment(now).startOf('week');
  if (target.isSameOrAfter(weekStart, 'day') && target.isBefore(todayStart)) {
    return shouldShowTime() ? `${target.format('ddd')} ${target.format('HH:mm')}` : target.format('ddd');
  }

  // 当年内
  const isThisYear = target.year() === nowMoment.year();
  if (isThisYear) {
    return shouldShowTime() ? target.format('MM-DD HH:mm') : target.format('MM-DD');
  }

  // 跨年
  return shouldShowTime() ? target.format('YYYY-MM-DD HH:mm') : target.format('YYYY-MM-DD');
}

/** DEFAULT_PLATFORM_MAP：默认平台映射（7 项） */
export const DEFAULT_PLATFORM_MAP: { host: string; name: string }[] = [
  { host: 'daily.zhihu.com', name: '知乎日报' },
  { host: 'zhuanlan.zhihu.com', name: '知乎专栏' },
  { host: 'zhihu.com', name: '知乎' },
  { host: 'guokrapp.guokr.com', name: '果壳' },
  { host: 'xiaoheihe.cn', name: '小黑盒' },
  { host: 'douban.com', name: '豆瓣' },
  { host: 'mp.weixin.qq.com', name: '微信公众号' },
];

/** getPlatformName(url, customMap)：按 host 匹配平台名，支持 host 后缀与 keyword */
export function getPlatformName(
  url: string | null | undefined,
  customMap?: { host?: string; keyword?: string; name: string }[]
): string | null {
  if (!url) return null;
  const map = (customMap || DEFAULT_PLATFORM_MAP) as any;
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (let i = 0; i < map.length; i++) {
      if (map[i].host && (host === map[i].host || host.endsWith('.' + map[i].host))) return map[i].name;
      if (map[i].keyword && host.includes(map[i].keyword)) return map[i].name;
    }
  } catch (e) { /* 无效 URL 返回 null */ }
  return null;
}

/** getCurrentNoteInfo()：当前打开笔记 {path, name} 或 null */
export function getCurrentNoteInfo(): { path: string; name: string } | null {
  const f = getApp().workspace.getActiveFile();
  return f ? { path: f.path, name: f.basename } : null;
}

/** getCurrentCursorPosition()：当前光标位置 {line, ch} 或 null */
export function getCurrentCursorPosition(): { line: number; ch: number } | null {
  const ws = getApp().workspace as any;
  const ed = ws.activeEditor && ws.activeEditor.editor;
  return ed ? { line: ed.getCursor().line, ch: ed.getCursor().ch } : null;
}

/** fetchPageTitle(url)：requestUrl 抓取页面 <title>（失败返回 null） */
export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const r: any = await requestUrl({
      url,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (r.status === 200) {
      const m = (r.text as string).match(/<title[^>]*>([^<]*)<\/title>/i);
      if (m && m[1]) return m[1].trim();
    }
  } catch (e) { /* 静默 */ }
  return null;
}

/** 字节级比对（Syncthing 冲突止血「写前比对」共用：长度或任一字节不同即不等） */
export function bytesEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
