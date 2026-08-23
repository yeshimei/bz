/**
 * 域 JSON 感知（2026-08-23 用户拍板扩展）：CONFIG/STORAGE 下各域数据文件的新增条目 → 观察文本。
 * 独立模块供 index 调用 + 单测覆盖；extract 纯函数：prev 记录已见状态（首次快照不产出）。
 * ticket 075：memo 项移除——备忘录改走方法监听（notifyMemoAction），防 JSON 事件通道双记录。
 * ticket 081：library 项接入——weave-data.json 数据文件监听（书库 UI 零写操作，阅读数据由外部
 * Weave EPUB Reader 落盘；extract 返回结构化 diff（LibraryWeaveDiff）：书架/时长事件即时入流，
 * 划线/想法事件由 index 层 5 分钟防抖合并，见 library-source.ts 与 index.ts）。
 */
import { libraryWeaveExtract, type LibraryWeaveDiff } from './library-source';

export interface DomainExtractor {
  file: string;
  /** 返回 null = 无变化；string/string[] = 观察文本（原各域）；LibraryWeaveDiff = library 结构化 diff（index 层区分即时/防抖） */
  extract: (raw: any, prev: Map<string, string>) => string | string[] | LibraryWeaveDiff | null;
}

export const DOMAIN_FILES: Record<string, DomainExtractor> = {
  library: {
    // ticket 081：weave-data.json 数据文件监听先例——外部插件写库，bz 侧盲通道 diff（library-source.ts；v2 结构化 diff）
    file: 'CONFIG/STORAGE/weave-data.json',
    extract: libraryWeaveExtract,
  },
  pomodoro: {
    file: 'CONFIG/STORAGE/pomodoro.json',
    extract: (raw, prev) => {
      const h = raw?.history;
      if (!Array.isArray(h)) return null;
      const fresh = h.filter((x) => typeof x?.ts === 'number').map((x) => String(x.ts));
      const newOnes = fresh.filter((t) => !prev.has('pomo:' + t));
      newOnes.forEach((t) => prev.set('pomo:' + t, '1'));
      return newOnes.length ? '你用番茄钟完成了一段专注（+ ' + newOnes.length + ' 次）' : null;
    },
  },
  // news 已移除（ticket 076）：聚合讯观察改为逐篇三态方法监听（news-source/notifyNewsRead），
  // 「你浏览了今天的资讯（N 条）」计数观察不再产。
  quiz: {
    file: 'CONFIG/STORAGE/quiz.json',
    extract: (raw, prev) => {
      if (!Array.isArray(raw)) return null;
      const done = raw.filter((it) => it?.lastCorrect || it?.correctCount).length;
      if (done > (Number(prev.get('quizDone') || 0))) {
        prev.set('quizDone', String(done));
        return '你做了几道题，检验了一下理解';
      }
      return null;
    },
  },
  review: {
    file: 'CONFIG/STORAGE/review.json',
    extract: (raw, prev) => {
      if (!Array.isArray(raw)) return null;
      const reviewed = raw.filter((it) => it?.nextReview || it?.lastReviewed).length;
      if (reviewed > (Number(prev.get('reviewN') || 0))) {
        prev.set('reviewN', String(reviewed));
        return '你完成了一轮复习，复习计划在推进';
      }
      return null;
    },
  },
  favorites: {
    file: 'CONFIG/STORAGE/favorites.json',
    extract: (raw, prev) => {
      if (!Array.isArray(raw)) return null;
      const fresh = raw.length;
      if (fresh > (Number(prev.get('favN') || 0))) {
        prev.set('favN', String(fresh));
        return '你收藏了一条新资源';
      }
      return null;
    },
  },
  belongings: {
    file: 'CONFIG/STORAGE/belongings.json',
    extract: (raw, prev) => {
      const items = raw?.items || raw;
      if (!items || typeof items !== 'object') return null;
      const n = Object.keys(items).length;
      if (n > (Number(prev.get('belN') || 0))) {
        prev.set('belN', String(n));
        return '你登记了一件新物品';
      }
      return null;
    },
  },
};

/** 遍历所有域：首次快照（记录当前状态，不产出观察）；返回已存在数据文件的域列表 */
export async function snapshotDomains(readJson: (path: string) => Promise<any>, prev: Map<string, string>): Promise<string[]> {
  const found: string[] = [];
  for (const key of Object.keys(DOMAIN_FILES)) {
    const raw = await readJson(DOMAIN_FILES[key].file).catch(() => null);
    if (raw == null) continue;
    found.push(key);
    DOMAIN_FILES[key].extract(raw, prev); // 首次不产出
  }
  return found;
}