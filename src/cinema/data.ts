/**
 * 影院（cinema）域数据层：扫描笔记 → 条目；排序（观影日期倒序）；筛选
 */
import type { App, TFile } from 'obsidian';
import { ALL_TAGS, getGroupSafe, STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED } from './constants';
import { extractMovieName } from './douban-fetcher';
import type { CinemaItem } from './state';
import { M } from './state';

/** frontmatter `tags` → string[]（兼容数组 / 单个字符串 / 缺失）。
 *  影院域 tag 归一化单源：UI 写盘（ui.ts 改名替换）、判定命令（type-decide.ts）、
 *  解析（parseMovieFile）共用，避免同域第二份漂移（issue 393 审查收口）。 */
export function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t));
  if (typeof raw === 'string' && raw) return [raw];
  return [];
}

/** 解析单条笔记（frontmatter → CinemaItem）；无 frontmatter 返回 null */
export function parseMovieFile(file: TFile, app: App): CinemaItem | null {
  const cache = app.metadataCache.getFileCache(file);
  if (!cache || !cache.frontmatter) return null;
  const fm = cache.frontmatter;

  // 《名称》提取域内单源（审查批 C 收敛）：basename 无扩展名，与 fetcher 版（先剥 .md）语义一致
  const name = extractMovieName(file.basename);

  // tags → typeTag（ALL_TAGS 顺序优先；无固定 tag 取首个；完全无 tag 跳过）
  // 归一化走单源 normalizeTags（兼容数组/单字符串/缺失，与 UI/判定命令同口径）
  const tags = normalizeTags(fm.tags);
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
    releaseDate: fm['上映日期'] ? String(fm['上映日期']) : null,
    doubanRating: fm['豆瓣评分'] !== undefined && fm['豆瓣评分'] !== '' ? String(fm['豆瓣评分']) : null,
    doubanUrl: /^https?:\/\//.test(String(fm['豆瓣链接'] ?? '')) ? String(fm['豆瓣链接']) : null,
    synopsis: fm['简介']?.toString() ?? null,
    // 片长/季集：原独立观影报告的两项统计源字段（ADR-0090 并入内嵌分析页）
    duration: fm['片长']?.toString() ?? null,
    seasonText: fm['季集']?.toString() ?? null,
    hotComment: fm['热门短评']?.toString() ?? null,
  };
}

/**
 * 海报路径 rename 联动目标扫描（issue 337 审计#11）：`海报` 是纯路径非双链，
 * Obsidian 改名海报文件不联动 frontmatter。扫影院目录全部 md 的 metadataCache frontmatter，
 * 返回 海报==oldPath 的笔记（不依赖面板是否开过，M.items 未填充也能命中）。
 * 读法与 parseMovieFile 同口径（toString 剥引号——metadataCache 已解析 YAML）。
 */
export function findPosterRenameTargets(app: App, oldPath: string): TFile[] {
  if (!oldPath) return [];
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(M.folderPath + '/'));
  const hits: TFile[] = [];
  for (const file of files) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (fm && fm['海报'] != null && String(fm['海报']) === oldPath) hits.push(file);
  }
  return hits;
}

/** 重建条目列表（扫描 M.folderPath 下全部 md） */
export function rebuildItems(app: App): CinemaItem[] {
  const newItems: CinemaItem[] = [];
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(M.folderPath + '/'));
  for (const file of files) {
    try {
      const item = parseMovieFile(file, app);
      if (item) {
        newItems.push(item);
        continue;
      }
      // 文件在但 metadataCache 尚未索引（新建后立即重建）→ 保留内存既有条目，
      // 防刚添加的影片闪现后被整体替换掉（缓存就绪的下次重建会正常解析接管）
      if (!app.metadataCache.getFileCache(file)) {
        const kept = M.items.find((p) => p.file?.path === file.path);
        if (kept) newItems.push(kept);
      }
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

/** 按创建时间（笔记文件 ctime）倒序；编辑（mtime）不改变排序，文件无 ctime 时按名称兜底保持稳定 */
export function sortByCreatedDesc(list: CinemaItem[]): CinemaItem[] {
  return [...list].sort((a, b) => {
    const ta = a.file ? a.file.stat.ctime : 0;
    const tb = b.file ? b.file.stat.ctime : 0;
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

/** 当前筛选（类型/状态/搜索）+ 当前排序模式（先筛选后排序，保证列表正确） */
export function getDisplayItems(): CinemaItem[] {
  let list = [...M.items];
  if (M.typeFilter) list = list.filter((it) => it.group === M.typeFilter);
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
