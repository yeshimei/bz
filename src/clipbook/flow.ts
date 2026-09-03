/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：动作编排（保存/已读/在读/删除）。
 *
 * 语义对齐旧 news/reader.ts（saveToClip + markAsRead + recordStat + 域事件）：
 * - 保存（save）：B站视频 → 文献盒（ADR-0068，openLiteratureAddTask 不标已读）；
 *   普通文章 → 写剪藏笔记（save.ts），成功后标 news 已处理（read+saved、删 body、
 *   stats +1、发 news:read/saved 域事件——smartcat 行为流三跳 + auto-summary 补全依赖）。
 * - 已读（skip）：标 news 已处理（read+skipped、删 body、stats +1、发 news:read）。
 * - 在读（reading）：仅落 clipbook.json 侧写（news.json 无在读位）。
 * - 阅读时长：右栏/详情停留会话累计（对齐 ticket 076 openedAt/accumMs 语义，整分钟 ≥1）。
 *
 * 本层负责编排 + 落盘串行队列；store.ts 提供原语。
 */
import { getApp } from '../core/app';
import { notice } from '../core/notice';
import { emitDomainEvent } from '../core/domain-bus';
import { tryGetSettings } from '../core/settings-provider';
import { readNewsData, writeNewsDataMerged } from './news-data';
import { localDayKey } from './constants';
import type { NewsReadEvent } from '../smartcat/news-source';
import { writeClipNote } from './save';
import { articleKeyOf } from './constants';
import { readClipbookData, writeClipbookData } from './data';
import { readNewsAndSidecar } from './loader';
import { enqueueNewsWrite } from './write-queue';

// ---------- 阅读会话计时（对齐 ticket 076：当前显示条目 + 累计可视毫秒） ----------
let curKey = '';
let openedAt = 0;
let accumMs = 0;

/** 切换阅读目标（UI 选中变化/关闭时调用；同篇不重置累计）
 *  C7：同 key 重渲染（renderReader 反复触发）不再重置 openedAt——此前每次都重开计时，
 *  上一段可视时长被丢弃致行为流 durationMin 偏小；仅切换目标时归零重开。 */
export function setReadingSession(key: string): void {
  if (key !== curKey) {
    // 切换目标：旧篇累计封存逻辑（本实现不跨条目恢复，故归零）
    curKey = key;
    accumMs = 0;
    openedAt = Date.now();
  } else if (!openedAt) {
    // 同篇且已暂停：恢复计时起点
    openedAt = Date.now();
  }
}

/** 暂停会话（面板隐藏/动作执行前调用；并入累计） */
export function pauseReadingSession(): void {
  if (openedAt) {
    accumMs += Date.now() - openedAt;
    openedAt = 0;
  }
}

/** 取当前会话时长（整分钟 ≥1，对齐旧 markAsRead durationMin 语义） */
function durationMin(): number {
  const now = Date.now();
  const total = (openedAt ? now - openedAt : 0) + accumMs;
  return Math.max(1, Math.round(total / 60000));
}

/** 测试钩子：读当前会话状态（C7 回归保护：同 key 重入不丢累计） */
export function __readingSessionStateForTests(): { curKey: string; accumMs: number; opened: boolean } {
  return { curKey, accumMs, opened: openedAt > 0 };
}

// ---------- news.json 统计/落盘串行队列 ----------
// 队列本体在 write-queue.ts（loader / news-source-settings / store 写回共用同一条链，
// 防「插件多写方互相覆盖 + 对守护进程无合并」——P1 审查项）；此处只封装本域动作。

/** 写单篇已处理 + 统计 +1（合并为一次读改写，旧实现拆两次放大与 daemon 的竞态窗口）：
 *  read + state + 删 body；统计段与 articles 段在同一队列步内声明改动，写盘经
 *  writeNewsDataMerged 与磁盘做段级合并（daemon 新增文章不丢） */
function markHandledAndBump(raw: any, action: 'saved' | 'skipped'): void {
  const key = articleKeyOf(raw);
  const platform = raw.platform || '未知';
  const today = localDayKey();
  void enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    const list = (res.data.articles || []).map((a: any) => {
      if (articleKeyOf(a) !== key) return a;
      const next: any = { ...a, read: true, state: action };
      delete next.body; // 已处理 → 清正文（防 news.json 膨胀；保留策略骨架语义）
      return next;
    });
    const s = res.data.stats || { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
    s.totalRead = (Number(s.totalRead) || 0) + 1;
    if (action === 'saved') s.totalSaved = (Number(s.totalSaved) || 0) + 1;
    else s.totalSkipped = (Number(s.totalSkipped) || 0) + 1;
    s.byPlatform[platform] = (s.byPlatform[platform] || 0) + 1;
    s.byDate[today] = (s.byDate[today] || 0) + 1;
    await writeNewsDataMerged({ set: { articles: list, stats: s } });
  });
}

/** 删单篇（news.json 移除该文章；removeArticleKeys 防磁盘并集复活） */
function removeArticle(raw: any): void {
  const key = articleKeyOf(raw);
  void enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    const list = (res.data.articles || []).filter((a: any) => articleKeyOf(a) !== key);
    await writeNewsDataMerged({ set: { articles: list }, removeArticleKeys: [key] });
  });
}

// ---------- 行为流事件（smartcat 依赖契约，对齐旧 reader） ----------
function emitReadEvt(raw: any, state: 'saved' | 'skipped'): NewsReadEvent {
  const evt: NewsReadEvent = { title: raw.title, platform: raw.platform, state, durationMin: durationMin() };
  emitDomainEvent('news', { kind: 'read', evt });
  return evt;
}

// ---------- 对外动作 ----------

/** 保存到剪藏本（news 条目）：写笔记（或分流文献盒）→ 标已处理 → 事件。返回是否成功 */
export async function flowSave(article: any): Promise<boolean> {
  const raw = article && article.raw;
  if (!raw) return false;
  const isBili = raw.platform === 'B站' && !!String(raw.url || '').trim();
  if (isBili) {
    // ADR-0068：B站视频保存改道文献盒（不写剪藏、不标已读、不进行为流）
    const { openLiteratureAddTask } = await import('../literature');
    openLiteratureAddTask(getApp(), { url: raw.url, title: raw.title || null, uploader: raw.author || null });
    return true;
  }
  pauseReadingSession();
  try {
    const ok = await writeClipNote(raw); // 内部 notice 成功/失败；false = 空标题/取消覆盖/写盘异常
    if (!ok) return false; // 未写盘 → 不标已处理、不进行为流（防文章被静默消费）
    // 写成功 → 标已处理 + 统计（单次读改写；writeClipNote 用传入 raw，标记同样适用）
    markHandledAndBump(raw, 'saved');
    const evt = emitReadEvt(raw, 'saved');
    // 保存联动 auto-summary：登记待补全（smartcat 订阅该剪藏 modify 补全 / 2 分钟降级）
    emitDomainEvent('news', { kind: 'saved', evt, clipPath: `${dirOf()}/${String(raw.title || '').replace(/[\\/:*?"<>|]/g, '').trim()}.md` });
    return true;
  } catch (e) {
    console.error('[剪藏本] 保存失败', e);
    return false;
  }
}

/** 标记已读（skip 语义：read+skipped 骨架，行为流 news:skipped） */
export async function flowMarkRead(article: any): Promise<void> {
  const raw = article && article.raw;
  if (!raw) return;
  pauseReadingSession();
  markHandledAndBump(raw, 'skipped');
  emitReadEvt(raw, 'skipped');
}

/** 在读切换（仅侧写；返回新状态 'reading' | 'unread'） */
export async function flowToggleReading(article: any): Promise<'reading' | 'unread'> {
  const raw = article && article.raw;
  if (!raw) return 'unread';
  const key = articleKeyOf(raw);
  const sidecar = await readClipbookData();
  const cur = sidecar.articleOverrides[key];
  const next: Record<string, { reading?: boolean }> = { ...sidecar.articleOverrides };
  let st: 'reading' | 'unread' = 'reading';
  if (cur && cur.reading === true) {
    delete next[key];
    st = 'unread';
  } else {
    next[key] = { reading: true };
  }
  await writeClipbookData({ ...sidecar, articleOverrides: next });
  return st;
}

/** 删除 news 条目（从 news.json 移除；侧写 override 同步清理） */
export async function flowDeleteNews(article: any): Promise<void> {
  const raw = article && article.raw;
  if (!raw) return;
  removeArticle(raw);
  try {
    const sidecar = await readClipbookData();
    const overrides = { ...sidecar.articleOverrides };
    delete overrides[articleKeyOf(raw)];
    await writeClipbookData({ ...sidecar, articleOverrides: overrides });
  } catch (e) { /* 忽略 */ }
}

/** 剪藏目录（设置读取） */
function dirOf(): string {
  const s = tryGetSettings() as any;
  return ((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
}

/** 保留策略清理 + 全量装载（面板打开时执行一次；返回是否需重渲染） */
export async function loadPanelData(): Promise<void> {
  await readNewsAndSidecar();
}
