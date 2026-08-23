/**
 * 域 JSON 感知（2026-08-23 用户拍板扩展）：CONFIG/STORAGE 下各域数据文件的新增条目 → 观察文本。
 * 独立模块供 index 调用 + 单测覆盖；extract 纯函数：prev 记录已见状态（首次快照不产出）。
 * ticket 075：memo 项移除——备忘录改走方法监听（notifyMemoAction），防 JSON 事件通道双记录。
 * ticket 079：belongings 项移除——归物本改走方法监听（notifyBelongingsAction），防双记录。
 * ticket 080：pomodoro 项移除——番茄钟改走方法监听（notifyPomodoroAction），防 JSON 事件通道双记录。
 */

export interface DomainExtractor {
  file: string;
  extract: (raw: any, prev: Map<string, string>) => string | null;
}

export const DOMAIN_FILES: Record<string, DomainExtractor> = {
  // 番茄钟已移除（ticket 080）：改走方法监听（pomodoro-source/notifyPomodoroAction），
  // 「你用番茄钟完成了一段专注（+ N 次）」计数观察不再产。
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
// favorites 已移除（ticket 078）：收藏本观察改走方法监听（favorites-source/notifyFavoritesAction）——
  // 「你收藏了一条新资源」无标题计数观察不再产（只增不减、删除后计数失真问题随之解除）。
  // belongings 已移除（ticket 079）：归物本改走方法监听（notifyBelongingsAction），
  // 「你登记了一件新物品」计数观察不再产（无名称、只增不减、状态流转/编辑不反映、删除失真）。
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