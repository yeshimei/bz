/**
 * 域 JSON 感知（2026-08-23 用户拍板扩展）：CONFIG/STORAGE 下各域数据文件的新增条目 → 观察文本。
 * 独立模块供 index 调用 + 单测覆盖；extract 纯函数：prev 记录已见状态（首次快照不产出）。
 * ticket 075：memo 项移除——备忘录改走方法监听（notifyMemoAction），防 JSON 事件通道双记录。
 * ticket 079：belongings 项移除——归物本改走方法监听（notifyBelongingsAction），防双记录。
 * ticket 080：pomodoro 项移除——番茄钟改走方法监听（notifyPomodoroAction），防 JSON 事件通道双记录。
 * ticket 082：quiz/review 项移除——用户拍板去掉这两个盲通道计数观察（「你做了几道题」/「完成复习」不再产）。
 * ticket 081：library 唯一条目——weave-data.json 数据文件监听（书库 UI 零写操作，阅读数据由外部
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
  // 其余盲通道全部移除（见头部注释）：memo/news/favorites/belongings/pomodoro/quiz/review 不再产计数观察。
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