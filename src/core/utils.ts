/**
 * 通用工具函数（Q3.js window.__utils 移植 + 原脚本内联工具）
 * 行为与 Q3.js 逐字一致（spec「Q3 core 层逐行提取」）。
 */
import moment from 'moment';
import { getApp } from './app';
import { httpGetText, requestUrlAsFetch } from './http';
import { pad2, relTime as baseRelTime, stripMdExt } from './ui/str';

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

/** pad2(n)：两位数补零（月/日/时/分/秒）；实现单源 core/ui/str（零依赖区，render 纯层
 *  白名单仅 str），此处转发保持既有 import 路径兼容（pomodoro/reading-report 等消费） */
export { pad2 };


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
 * 未来时间→YYYY-MM-DD [HH:mm]；今天内基础档收编 core/ui/str relTime 单源
 * （刚刚/N 分钟前/N 小时前，带空格——2026-09 跨域说法拍板）；
 * 昨天/前天/周几/MM-DD/YYYY-MM-DD 为 moment 增强档保留（行为不回退）。
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

  // 今天内（N 分钟前 / N 小时前）：转发 core/ui/str relTime 基础档（跨域单源说法）；
  // 传 now 时刻保证测试/回放注入的时钟不旁路
  if (target.isSame(nowMoment.startOf('day'), 'day')) {
    return baseRelTime(target.format('YYYY-MM-DD HH:mm:ss'), now.getTime());
  }

  const diffMinutes = Math.floor(diffSeconds / 60);

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
  if (target.isSameOrAfter(weekStart, 'day') && target.isBefore(nowMoment.startOf('day'))) {
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

/** fetchPageTitle(url)：抓取页面 <title>（非 2xx/超时/网络错归 null）。
 *  新-2：改走 core/http 单源带 8s 超时——原先 requestUrl 裸发无超时，远端建连后不回包
 *  则 Promise 永不 settle（消费方是 fire-and-forget，标题永不回填且无降级提示）。 */
export async function fetchPageTitle(url: string): Promise<string | null> {
  const text = await httpGetText(url, {
    timeoutMs: 8000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    fetchImpl: requestUrlAsFetch(),
  });
  if (!text) return null;
  const m = text.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m && m[1] ? m[1].trim() : null;
}

/** 字节级比对（Syncthing 冲突止血「写前比对」共用：长度或任一字节不同即不等） */
export function bytesEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ==================== 通用化收编（全域扫描 2026-09：各域重复实现上收） ====================

/** localDayKey(ts)：本地时区日期键 YYYY-MM-DD（日记文件名/统计落盘键共用口径；蓝本 clipbook/constants localDayKey） */
export function localDayKey(ts: number | Date = Date.now()): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** stripMdExt(name)：剥离结尾 .md 扩展名（大小写不敏感；各域 30+ 处内联正则收口）：
 *  实现单源 core/ui/str（零依赖区，render 纯层白名单仅 str——memo/secondbrain 的
 *  render.ts 由此消费），此处转发保持既有 import 路径兼容（pad2 同款范式） */
export { stripMdExt };

/** stripTitleMarks(s)：剥离首尾书名号《》（各域条目名清洗收口） */
export function stripTitleMarks(s: string): string {
  return String(s || '').replace(/^《|》$/g, '');
}

/** cmpZh(a, b)：中文拼音序比较器（localeCompare 'zh'；条目排序收口） */
export function cmpZh(a: string, b: string): number {
  return String(a || '').localeCompare(String(b || ''), 'zh');
}

/** isUnderFolder(folder, path)：目录边界判定——path 恰为 folder 或位于其下（递归语义；蓝本 review/watch.ts） */
export function isUnderFolder(folder: string, path: string): boolean {
  const f = (folder || '').trim().replace(/\/+$/, '');
  if (!f) return false;
  return path === f || path.startsWith(f + '/');
}

/** hash31(str)：h*31 稳定字符串散列（>>>0；站标派色/派样式共用口径，charCodeAt 逐单元版） */
export function hash31(str: string): number {
  let h = 0;
  const t = String(str || '');
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** debounce(fn, ms)：尾触防抖，返回带 cancel() 的防抖函数（新收敛能力；既有手写定时器形态各异，暂不批量替换） */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T & { cancel(): void } {
  let t: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: Parameters<T>) => {
    if (t !== undefined) clearTimeout(t);
    t = setTimeout(() => {
      t = undefined;
      fn(...args);
    }, ms);
  };
  (wrapped as T & { cancel(): void }).cancel = () => {
    if (t !== undefined) {
      clearTimeout(t);
      t = undefined;
    }
  };
  return wrapped as T & { cancel(): void };
}

/** yieldToMainThread(timeoutMs)：让出主线程（requestIdleCallback 优先 + 超时兜底，退化 setTimeout(0)；蓝本 checkup/run.ts） */
export function yieldToMainThread(timeoutMs = 200): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') ric(() => resolve(), { timeout: timeoutMs });
    else window.setTimeout(resolve, 0);
  });
}

// ==================== 敏感操作防护（encrypt×password-vault 双域收口，全域扫描 2026-09 批次 G） ====================

/** 安全随机密码（crypto.getRandomValues 拒绝采样，与旧密码本同款） */
export function secureRandomPassword(length: number, charset: string): string {
  const n = charset.length;
  if (!(length > 0) || n === 0) return '';
  const LIMIT = Math.floor(0x100000000 / n) * n;
  let pwd = '';
  while (pwd.length < length) {
    const buf = new Uint32Array(length - pwd.length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && pwd.length < length; i++) {
      if (buf[i] >= LIMIT) continue;
      pwd += charset.charAt(buf[i] % n);
    }
  }
  return pwd;
}

/** 复制敏感内容 + 60s 自动清空剪贴板（模块级单定时器：双域并存共用一支，后复制重置前清空） */
const CLIPBOARD_CLEAR_DELAY_MS = 60_000;
let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

/** 取消未触发的自动清空（卸载清理用，防插件禁用后定时器仍写剪贴板） */
export function cancelClipboardClear(): void {
  if (clipboardClearTimer !== null) {
    clearTimeout(clipboardClearTimer);
    clipboardClearTimer = null;
  }
}

/** 对已写入敏感内容的剪贴板布防 60s 自动清空 */
export function armClipboardClear(): void {
  if (clipboardClearTimer !== null) clearTimeout(clipboardClearTimer);
  clipboardClearTimer = setTimeout(() => {
    clipboardClearTimer = null;
    try {
      void navigator.clipboard.writeText('').catch(() => {});
    } catch (e) {
      /* 尽力而为 */
    }
  }, CLIPBOARD_CLEAR_DELAY_MS);
}

/** 复制敏感内容并布防自动清空 */
export function copySensitiveText(text: string): Promise<void> {
  try {
    return navigator.clipboard.writeText(text).then(() => armClipboardClear());
  } catch (e) {
    return Promise.reject(e);
  }
}

/**
 * 复制敏感内容（含降级兜底）+ 自动清空（issue 365 收口单源）。
 * encrypt/ui（日记正文复制）与 password-vault（面板复制 + quick-pick 快速取密）
 * 原各持一份逐字雷同的「copySensitiveText 失败 → textarea+execCommand 选中法」兜底，
 * 收编为本函数；两域一律走这里，域内不再自留副本。
 * 行为口径（三份旧实现逐字等价）：
 * - navigator.clipboard.writeText 成功 → true（60s 清空随 copySensitiveText 布防）；
 * - 失败（权限拒绝/非安全上下文/clipboard 缺失）→ textarea 选中法兜底，
 *   execCommand('copy') 成功同样布防 60s 自动清空，返回其布尔结果；
 * - 兜底亦抛错 → false（不布防清空）。
 */
export async function copySensitiveWithFallback(text: string): Promise<boolean> {
  try {
    await copySensitiveText(text);
    return true;
  } catch (e) {
    // 降级：textarea 选中法
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (ok) armClipboardClear();
      return ok;
    } catch (e2) {
      return false;
    }
  }
}
