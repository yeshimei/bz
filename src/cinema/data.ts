/**
 * 影院（cinema）域数据层：扫描笔记 → 条目；排序（观影日期倒序）；筛选
 */
import type { App, TFile } from 'obsidian';
import { ALL_TAGS, getGroupSafe, REWATCH_SHELF, avgRating, type Rewatch } from './constants';
import { extractMovieName } from './douban-fetcher';
import { statusNum } from './shared';
import type { CinemaItem } from './state';
import { M } from './state';

/** frontmatter `tags` → string[]（兼容数组 / 单个字符串 / 缺失）。
 *  影院域 tag 归一化单源：UI 写盘（ui.ts 改名替换）与解析（parseMovieFile）共用，
 *  避免同域第二份漂移（审查收口）。 */
export function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t));
  if (typeof raw === 'string' && raw) return [raw];
  return [];
}

/** frontmatter `重看` → Rewatch[]（ADR-0240：一刷一条，带时刻与当刷评分）。
 *  兼容三种落盘形态（磁盘零迁移，读取层一次性归一）：
 *   - 对象数组 `{ at, rating }`（新档，2026-10-05 起）
 *   - 字符串数组（旧档，只有时刻）——评分补 null，该刷不进平均分母
 *   - 单字符串 / 缺失 / 畸形项——单串收一条，其余跳过
 *  不能走 normalizeTags：它 String() 化每项，会把对象整条吞成 "[object Object]"。
 *  建档/编辑不写此键——只有「重温 +1」落盘。 */
export function normalizeRewatches(raw: unknown): Rewatch[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' && raw ? [raw] : [];
  const out: Rewatch[] = [];
  for (const v of list) {
    if (typeof v === 'string') {
      if (v) out.push({ at: v, rating: null });
      continue;
    }
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const at = typeof o.at === 'string' ? o.at : String(o.at ?? '');
    if (!at) continue; // 无时刻的条目无从定位，跳过而不是塞一条空 at
    const n = Number(o.rating);
    const rating =
      o.rating === undefined || o.rating === null || o.rating === '' || Number.isNaN(n) ? null : n;
    out.push({ at, rating });
  }
  return out;
}

/** frontmatter `片单` → string[]（自建片单；兼容数组 / 单字符串 / 缺失，口径同 normalizeTags）。
 *  归入/移出弹层落盘，建档/编辑不写此键 */
export function normalizeLists(raw: unknown): string[] {
  return normalizeTags(raw).filter(Boolean);
}

/** 片单枚举（侧栏 / 归入弹层消费）：内置「重映厅」恒首位，其余按成员数降序、同数按名称。
 *  纯函数显式入参（原型侧/纯层同源可用）；空片单不出现（没有成员就没有枚举） */
export function allLists(items: CinemaItem[]): string[] {
  const count = new Map<string, number>();
  for (const it of items) for (const name of it.lists) count.set(name, (count.get(name) ?? 0) + 1);
  const rest = [...count.entries()]
    .filter(([name]) => name !== REWATCH_SHELF)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  return count.has(REWATCH_SHELF) ? [REWATCH_SHELF, ...rest] : rest;
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
  const ratingNum =
    rawRating === undefined || rawRating === null || rawRating === ''
      ? null
      : Number(rawRating);

  // 状态单源键「状态」：评分只当分值，不承担状态语义。评分编码 -1/0 于 2026-09-30 退役，
  // 兼容期结束（2026-10-03 拍板）：旧档评分推断与 -1/0 清洗移除——库已全量迁移且零残留
  // （扫描核过：0 篇缺「状态」键、0 处 -1/0）。缺键/非法值经 statusNum 一律落已看
  // （想看/在看建档必带此键，无键即旧档视为已看）。
  const status = statusNum(typeof fm['状态'] === 'string' ? (fm['状态'] as string).trim() : '');
  const rating = ratingNum;

  return {
    file,
    name,
    typeTag,
    group: getGroupSafe(typeTag),
    watchDate,
    rating,
    status,
    // 状态日期（想看日期/在看日期）：旧笔记无键 = null，不参与显示
    wantDate: fm['想看日期']?.toString() ?? null,
    watchingDate: fm['在看日期']?.toString() ?? null,
    // 已看日期（issue 536）只读新键；观影日期回落已随兼容层移除（2026-10-03，库核验 665 篇已看笔记均已带此键，零回填）。
    // 非已看态无键自然为 null——一条没看过的条目不许凭空出「已看」日（幽灵节点教训保留）
    watchedDate: fm['已看日期']?.toString() ?? null,
    rewatches: normalizeRewatches(fm['重看']),
    lists: normalizeLists(fm['片单']),
    shelvedOnly: fm['片单收纳'] === true,
    mergeInto: fm['合集']?.toString().trim() || null,
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

/** 观影日期时间戳（无日期 → 0，排最后）。
 *  date-only 旧档（`"2026-03-08"`）先补 `T00:00:00` 再解析——否则它被当成 **UTC 午夜**，
 *  与带时刻的新档（本地时刻）混排时会平白偏出整个时区差（ADR-0240 决策 6）。
 *  已带时刻的值原样解析，行为不变。 */
export function dateVal(it: CinemaItem): number {
  if (!it.watchDate) return 0;
  const raw = it.watchDate.trim();
  const t = new Date(/\d{1,2}:\d{2}/.test(raw) ? raw : `${raw}T00:00:00`).getTime();
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

/** 排序：按评分降序（ADR-0240 决策 3：评分排序走平均评分口径，与界面显示一致——
 *  否则「卡片显示 7.5、按评分排序却按首评分 9.0 排」自打脸）；未评分（平均为 null）排最后 */
export function sortByRatingDesc(list: CinemaItem[]): CinemaItem[] {
  return [...list].sort((a, b) => {
    const ar = avgRating(a) ?? -1;
    const br = avgRating(b) ?? -1;
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

/** 当前筛选（类型/状态/片单/搜索）+ 当前排序模式（先筛选后排序，保证列表正确）。
 *
 *  搜索是**全局**的（2026-10-05 拍板）：有搜索词时直接在全库（M.items）里匹配——不叠加
 *  类型/状态/片单筛选、也不排片单收纳。即「一键导入的片单条目浏览时不混入正常视图，
 *  但主动搜它要能搜到」。调用侧（onSearchInput）进搜索时已清筛选态，此处再短路一次兜底。 */
export function getDisplayItems(): CinemaItem[] {
  let list = [...M.items];
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
    return applySortMode(list, M.sortMode);
  }
  if (M.typeFilter) list = list.filter((it) => it.group === M.typeFilter);
  const sf = M.statusFilter;
  if (sf) list = list.filter((it) => it.status === statusNum(sf));
  if (M.listFilter) list = list.filter((it) => it.lists.includes(M.listFilter as string));
  // 片单收纳条目只在片单视图出现（2026-09-30 拍板：一键导入不混入正常影视视图）——
  // 仅浏览态（全部/类型/状态）整体排除；搜索已在上方短路，不受此限
  else list = list.filter((it) => !it.shelvedOnly);
  return applySortMode(list, M.sortMode);
}

/** 重建数据 + 重渲染 */
export function refreshDataAndView(app: App): void {
  rebuildItems(app);
  M.renderFn?.();
}
