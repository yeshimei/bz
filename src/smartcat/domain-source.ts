/**
 * 域 JSON 感知（2026-08-23 用户拍板扩展）：CONFIG/STORAGE 下各域数据文件的新增条目 → 观察文本。
 * 独立模块供 index 调用 + 单测覆盖；extract 纯函数：prev 记录已见状态（首次快照不产出）。
 * ticket 075：memo 项移除——备忘录改走方法监听（notifyMemoAction），防 JSON 事件通道双记录。
 */

export interface DomainExtractor {
  file: string;
  extract: (raw: any, prev: Map<string, string>) => string | null;
}

export const DOMAIN_FILES: Record<string, DomainExtractor> = {
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
  news: {
    file: 'CONFIG/STORAGE/news-stats.json',
    extract: (raw) => {
      const byDate = raw?.byDate;
      if (!byDate) return null;
      const today = new Date().toISOString().slice(0, 10);
      const n = byDate[today];
      return n ? '你浏览了今天的资讯（' + n + ' 条）' : null;
    },
  },
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