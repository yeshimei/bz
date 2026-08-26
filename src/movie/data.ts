/**
 * 影视数据层（ticket 14：rebuildItems/sortItemList/getDisplayItems/refreshDataAndView）
 */
import type { App, TFile } from 'obsidian';
import { ALL_TAGS, getGroupForTag, STATUS_WANT, STATUS_WATCHING, STATUS_WATCHED } from './constants';
import type { MovieItem } from './state';
import { M } from './state';

/** 重建条目列表（扫描 M.folderPath 下全部 md） */
export function rebuildItems(app: App): MovieItem[] {
  const newItems: MovieItem[] = [];
  const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(M.folderPath + '/'));

  for (const file of files) {
    try {
      const cache = app.metadataCache.getFileCache(file);
      if (!cache || !cache.frontmatter) continue;
      const fm = cache.frontmatter;

      const basename = file.basename;
      const name = basename.match(/《(.+)》/)?.[1] ?? basename;

      // tags → typeTag（源码：遍历 ALL_TAGS，ALL_TAGS 顺序优先）
      let rawTags = fm.tags;
      if (typeof rawTags === 'string') rawTags = [rawTags];
      const tags: string[] = Array.isArray(rawTags) ? rawTags.map((t: any) => String(t)) : [];
      let typeTag: string | null = null;
      for (const t of ALL_TAGS) {
        if (tags.includes(t)) {
          typeTag = t;
          break;
        }
      }
      // x4：不在固定清单的自定义 tag 不再静默消失——取首个 tag 归入「其他」组展示；
      // 完全无 tag 的笔记（无自定义 tag 可言）维持跳过
      if (!typeTag) {
        if (tags.length === 0) continue;
        typeTag = tags[0];
      }
      let group = getGroupForTag(typeTag);
      if (!group) group = '其他';

      const watchDate = fm['观影日期']?.toString() ?? null;
      // null/空串 = 未打分（显式归已看），避免 Number('')=0 误判在看；undefined 缺省行为不变
      const rawRating = fm['评分'];
      const rating =
        rawRating === undefined || rawRating === null || rawRating === ''
          ? null
          : Number(rawRating);

      // 状态由评分推断（无独立状态字段）：-1=想看 / 0=在看 / 其余（>0 或无评分）=已看
      let status: number;
      if (rating === -1) status = STATUS_WANT;
      else if (rating === 0) status = STATUS_WATCHING;
      else status = STATUS_WATCHED;

      newItems.push({
        file,
        name,
        typeTag,
        group,
        watchDate,
        rating,
        status,
        poster: fm['海报']?.toString() ?? null,
        review: fm['影评']?.toString() ?? null,
        genre: fm['类型']?.toString() ?? null,
        director: fm['导演']?.toString() ?? null,
        actors: fm['主演']?.toString() ?? null,
        region: fm['制片国家/地区']?.toString() ?? null,
      });
    } catch (error) {
      console.warn('处理影视文件失败:', file.path, error);
    }
  }

  M.items.length = 0;
  M.items.push(...newItems);
  return newItems;
}

/** 排序三键：date（有日期按时间，无日期恒排后）/ rating（有评分按数值）/ name（localeCompare zh） */
export function sortItemList(list: MovieItem[], key: string, order: 'asc' | 'desc'): MovieItem[] {
  const sorted = [...list];
  const dir = order === 'desc' ? -1 : 1;

  if (key === 'date') {
    const withDate = sorted.filter((i) => i.watchDate && !isNaN(new Date(i.watchDate).getTime()));
    const withoutDate = sorted.filter((i) => !i.watchDate || isNaN(new Date(i.watchDate).getTime()));
    withDate.sort((a, b) => (new Date(a.watchDate as string).getTime() - new Date(b.watchDate as string).getTime()) * dir);
    return [...withDate, ...withoutDate];
  }

  if (key === 'rating') {
    const rated = sorted.filter((i) => i.rating !== null);
    const unrated = sorted.filter((i) => i.rating === null);
    rated.sort((a, b) => ((a.rating as number) - (b.rating as number)) * dir);
    return [...rated, ...unrated];
  }

  if (key === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh') * dir);
    return sorted;
  }

  return sorted;
}

/** 类型/状态/搜索过滤 + 排序 */
export function getDisplayItems(): MovieItem[] {
  let list = [...M.items];

  if (M.typeFilter !== '全部') {
    list = list.filter((item) => item.typeTag === M.typeFilter);
  }
  if (M.statusFilter !== '全部') {
    list = list.filter((i) => i.status === (M.statusFilter === '想看' ? STATUS_WANT : M.statusFilter === '在看' ? STATUS_WATCHING : STATUS_WATCHED));
  }
  if (M.searchKeyword) {
    const lowerKeyword = M.searchKeyword.toLowerCase();
    list = list.filter((item) => {
      return (
        (item.name && item.name.toLowerCase().includes(lowerKeyword)) ||
        (item.typeTag && item.typeTag.toLowerCase().includes(lowerKeyword)) ||
        (item.review && item.review.toLowerCase().includes(lowerKeyword))
      );
    });
  }

  return sortItemList(list, M.sortState.key, M.sortState.order);
}

/** 重建数据 + 重置分页 + 重渲染 */
export function refreshDataAndView(app: App): void {
  rebuildItems(app);
  M.loadedCount = 0;
  M.renderListFn?.();
}
