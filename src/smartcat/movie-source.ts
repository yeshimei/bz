/**
 * 影视动作感知观察（ticket 074，ADR-0026）：
 * 用户拍板扩展——smartcat 对 `我的/影视` 做快照 diff，把每一次影视操作
 * （加入想看/开始看/看完了/状态回退/评分改分/写改删影评/正文记内容/删除）
 * 识别为动作语义的观察文本；仅海报/豆瓣字段变化的 modify（外部海报脚本补写）不观察。
 * 数据语义零改动：状态仍由 frontmatter `评分` 推断（-1=想看 / 0=在看 / >0=已看，对齐 movie/data.ts）。
 * 纯函数模块（不触 DOM、不 import 域外），单测直测。
 */
import { classifyPath } from './context-source';

/** 影视状态三值（对齐 movie 域 constants STATUS_WANT/WATCHING/WATCHED 语义） */
export type MovieStatus = 'want' | 'watching' | 'watched';

/** 影视快照：观察关心的字段（frontmatter 三字段 + 剥海报双链后的正文） */
export interface MovieSnapshot {
  path: string;
  name: string;
  rating: number | null;
  review: string;
  watchDate: string | null;
  body: string;
}

/** 观察产出（body=true 表示正文类观察，调用方按节流决定是否落库） */
export interface MovieObservation {
  text: string;
  body?: boolean;
}

/** 影视目录前缀（与 context-source.classifyPath 的 movie 判定一致） */
export const MOVIE_DIR_PREFIX = '我的/影视';

/** 海报展示双链行正则（正文中仅含一个 ![[…]] 嵌入的行，典型形态为首行海报位） */
const POSTER_LINK_LINE = /^\s*!\[\[[^\]]+\]\]\s*$/;

/** frontmatter 块正则 */
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/** 单行字段正则（评分/影评/观影日期；兼容全角冒号） */
const FM_FIELD_RE = {
  rating: /^评分\s*[:：]\s*(.+)$/,
  review: /^影评\s*[:：]\s*(.*)$/,
  watchDate: /^观影日期\s*[:：]\s*(.+)$/,
} as const;

/** 剥海报展示双链：移除正文中「仅含一个 ![[…]] 嵌入」的行（首行海报位典型形态；多行海报同规则） */
export function stripPosterLink(body: string): string {
  return body
    .split(/\r?\n/)
    .filter((line) => !POSTER_LINK_LINE.test(line))
    .join('\n')
    .trim();
}

/** 解析影视文件内容 → 观察字段（frontmatter 评分/影评/观影日期 + 剥海报双链后的正文） */
export function parseMovieFileContent(content: string): Pick<MovieSnapshot, 'rating' | 'review' | 'watchDate' | 'body'> {
  let rating: number | null = null;
  let review = '';
  let watchDate: string | null = null;
  const fm = content.match(FM_RE);
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const rm = line.match(FM_FIELD_RE.rating);
      if (rm) {
        const v = parseFloat(rm[1].trim());
        if (Number.isFinite(v)) rating = v;
        continue;
      }
      const vm = line.match(FM_FIELD_RE.review);
      if (vm) {
        review = vm[1].trim();
        continue;
      }
      const dm = line.match(FM_FIELD_RE.watchDate);
      if (dm) {
        watchDate = dm[1].trim();
        continue;
      }
    }
  }
  const body = stripPosterLink(content.replace(/^---[\s\S]*?---\s*/, '').trim());
  return { rating, review, watchDate, body };
}

/** 影视状态推断（对齐 movie/data.ts：-1 想看 / 0 在看 / >0 或缺失 = 已看） */
export function movieStatusOf(rating: number | null): MovieStatus {
  if (rating === -1) return 'want';
  if (rating === 0) return 'watching';
  return 'watched';
}

/** 影视名：basename 去《》（对齐 observationText movie 分支的 name 提取） */
export function movieNameOf(basename: string): string {
  const name = String(basename || '').replace(/^《(.+?)》.*$/, '$1');
  return name || String(basename || '');
}

const STATUS_LABEL: Record<MovieStatus, string> = { want: '想看', watching: '在看', watched: '已看' };

/** 状态变化文案：顺向完成（想/在 → 已）用「你看完了」，回退显式描述 */
function statusChangeText(name: string, from: MovieStatus, to: MovieStatus): string {
  if (to === 'watched' && from !== 'watched') return `你看完了《${name}》`;
  if (to === 'want' && from === 'watched') return `你把《${name}》改回想看`;
  return `你把《${name}》从${STATUS_LABEL[from]}改为${STATUS_LABEL[to]}`;
}

/** create：按状态产出新增观察（已看合并评分与影评，一次一条） */
export function movieCreatedObservation(snap: MovieSnapshot): string | null {
  const n = snap.name;
  switch (movieStatusOf(snap.rating)) {
    case 'want':
      return `你把《${n}》加入想看`;
    case 'watching':
      return `你开始看《${n}》`;
    case 'watched': {
      const done = `你看完了《${n}》`;
      const rated = snap.rating !== null && snap.rating > 0 ? `，给了 ${snap.rating} 分` : '';
      const reviewed = snap.review ? `，写了影评：${snap.review.slice(0, 80)}` : '';
      return done + rated + reviewed;
    }
  }
}

/** modify：快照 diff → 动作观察（一次事件最多一条；优先级 状态 > 评分 > 影评 > 正文） */
export function movieChangedObservation(prev: MovieSnapshot, snap: MovieSnapshot): MovieObservation | null {
  const prevStatus = movieStatusOf(prev.rating);
  const curStatus = movieStatusOf(snap.rating);
  if (prevStatus !== curStatus) {
    return { text: statusChangeText(snap.name, prevStatus, curStatus) };
  }
  // 同状态：>0 内的首次评分 / 改分（想/在 的 -1/0 变化已被状态分支接走）
  if (prev.rating !== snap.rating) {
    const prevScored = prev.rating !== null && prev.rating > 0;
    const curScored = snap.rating !== null && snap.rating > 0;
    if (!prevScored && curScored) return { text: `你给《${snap.name}》评了 ${snap.rating} 分` };
    if (prevScored && curScored) return { text: `你把《${snap.name}》的评分从 ${prev.rating} 改为 ${snap.rating}` };
  }
  // frontmatter 影评字段（写/改/删）
  if (prev.review !== snap.review) {
    if (!prev.review && snap.review) return { text: `你写了《${snap.name}》的影评：${snap.review.slice(0, 80)}` };
    if (prev.review && snap.review) return { text: `你改了《${snap.name}》的影评：${snap.review.slice(0, 80)}` };
    if (prev.review && !snap.review) return { text: `你删掉了《${snap.name}》的影评` };
  }
  // 正文（剥海报双链后非空且变化；调用方按 body 节流）
  if (prev.body !== snap.body && snap.body) {
    return { text: `你在《${snap.name}》的笔记里写了：${snap.body.slice(0, 300)}`, body: true };
  }
  return null;
}

/** delete：删除影视观察（调用方保证 prev 有快照才调用） */
export function movieDeletedObservation(snap: MovieSnapshot): string {
  return `你删除了《${snap.name}》的影视记录`;
}

/** 路径是否影视笔记（复用 context-source 分类；供快照/删除监听使用） */
export function isMoviePath(path: string | null | undefined): boolean {
  return classifyPath(path) === 'movie';
}
