/**
 * 影院（cinema）域数据层：扫描笔记 → 条目；排序（观影日期倒序）；筛选
 */
import type { App, TFile } from 'obsidian';
import { ALL_TAGS, getGroupSafe, STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED } from './constants';
import type { CinemaItem } from './state';
import { M } from './state';

/** 解析单条笔记（frontmatter → CinemaItem）；无 frontmatter 返回 null */
export function parseMovieFile(file: TFile, app: App): CinemaItem | null {
  const cache = app.metadataCache.getFileCache(file);
  if (!cache || !cache.frontmatter) return null;
  const fm = cache.frontmatter;

  const basename = file.basename;
  const name = basename.match(/《(.+)》/)?.[1] ?? basename;

  // tags → typeTag（ALL_TAGS 顺序优先；无固定 tag 取首个；完全无 tag 跳过）
  let rawTags = fm.tags;
  if (typeof rawTags === 'string') rawTags = [rawTags];
  const tags: string[] = Array.isArray(rawTags) ? rawTags.map((t: unknown) => String(t)) : [];
  let typeTag: string | null = null;
  for (const t of ALL_TAGS) {
    if (tags.includes(t)) {
      typeTag = t;
      break;
    }
  }
  if (!typeTag) {
    if (tags.length === 0) return null;
    typeTag = tags[0];
  }

  const watchDate = fm['观影日期']?.toString() ?? null;
  const rawRating = fm['评分'];
  const rating =
    rawRating === undefined || rawRating === null || rawRating === ''
      ? null
      : Number(rawRating);

  // 状态由评分推断：-1=想看 / 0=在看 / 其余（>0 或无评分）=已看
  let status: number;
  if (rating === -1) status = STATUS_WANT;
  else if (rating === 0) status = STATUS_WATCHING;
  else status = STATUS_WATCHED;

  return {
    file,
    name,
    typeTag,
    group: getGroupSafe(typeTag),
    watchDate,
    rating,
    status,
    poster: fm['海报']?.toString() ?? null,
    review: fm['影评']?.toString() ?? null,
    genre: fm['类型']?.toString() ?? null,
    director: fm['导演']?.toString() ?? null,
    actors: fm['主演']?.toString() ?? null,
    region: fm['制片国家/地区']?.toString() ?? null,
    year: fm['上映日期'] ? String(fm['上映日期']).slice(0, 4) : null,
    doubanRating: fm['豆瓣评分'] !== undefined && fm['豆瓣评分'] !== '' ? String(fm['豆瓣评分']) : null,
    doubanUrl: /^https?:\/\//.test(String(fm['豆瓣链接'] ?? '')) ? String(fm['豆瓣链接']) : null,
    synopsis: fm['简介']?.toString() ?? null,
  };
}

/** 重建条目列表（扫描 M.folderPath 下全部 md） */
export function rebuildItems(app: App): CinemaItem[] {
  const newItems: CinemaItem[] = [];
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(M.folderPath + '/'));
  for (const file of files) {
    try {
      const item = parseMovieFile(file, app);
      if (item) newItems.push(item);
    } catch (error) {
      console.warn('处理影视文件失败:', file.path, error);
    }
  }
  M.items.length = 0;
  M.items.push(...newItems);
  return newItems;
}

/** 观影日期时间戳（无日期 → 0，排最后） */
export function dateVal(it: CinemaItem): number {
  if (!it.watchDate) return 0;
  const t = new Date(it.watchDate).getTime();
  return isNaN(t) ? 0 : t;
}

/** 排序：按观影日期倒序（新→旧）；无日期排最后 */
export function sortByDateDesc(list: CinemaItem[]): CinemaItem[] {
  return [...list].sort((a, b) => dateVal(b) - dateVal(a));
}

/** 按创建时间（笔记文件 mtime）倒序；文件无 mtime 时按名称兜底保持稳定 */
export function sortByCreatedDesc(list: CinemaItem[]): CinemaItem[] {
  return [...list].sort((a, b) => {
    const ta = a.file ? a.file.stat.mtime : 0;
    const tb = b.file ? b.file.stat.mtime : 0;
    if (ta !== tb) return tb - ta;
    return (b.name || '').localeCompare(a.name || '');
  });
}

/** 按评分倒序：已看（评分>0）降序；未看（-1/0/无评分）排最后（其内部按日期倒序） */
export function sortByRatingDesc(list: CinemaItem[]): CinemaItem[] {
  return [...list].sort((a, b) => {
    const ar = a.rating && a.rating > 0 ? a.rating : -1;
    const br = b.rating && b.rating > 0 ? b.rating : -1;
    if (ar !== br) return br - ar;
    return dateVal(b) - dateVal(a);
  });
}

/** 按当前排序模式排序（date/created/rating）；未识别模式回退观影日期倒序 */
export function applySortMode(list: CinemaItem[], mode: string): CinemaItem[] {
  if (mode === 'created') return sortByCreatedDesc(list);
  if (mode === 'rating') return sortByRatingDesc(list);
  return sortByDateDesc(list);
}

/** 当前筛选（类型/二级/状态/搜索）+ 当前排序模式（先筛选后排序，保证列表正确） */
export function getDisplayItems(): CinemaItem[] {
  let list = [...M.items];
  if (M.typeFilter) list = list.filter((it) => it.group === M.typeFilter);
  if (M.subFilter) list = list.filter((it) => it.typeTag === M.subFilter);
  if (M.statusFilter) list = list.filter((it) => it.status === (M.statusFilter === '想看' ? STATUS_WANT : M.statusFilter === '在看' ? STATUS_WATCHING : STATUS_WATCHED));
  if (M.searchKeyword) {
    const kw = M.searchKeyword.toLowerCase();
    list = list.filter((it) => {
      return (
        (it.name && it.name.toLowerCase().includes(kw)) ||
        (it.typeTag && it.typeTag.toLowerCase().includes(kw)) ||
        (it.review && it.review.toLowerCase().includes(kw)) ||
        (it.director && it.director.toLowerCase().includes(kw)) ||
        (it.actors && it.actors.toLowerCase().includes(kw))
      );
    });
  }
  return applySortMode(list, M.sortMode);
}

/** 重建数据 + 重渲染 */
export function refreshDataAndView(app: App): void {
  rebuildItems(app);
  M.renderFn?.();
}
