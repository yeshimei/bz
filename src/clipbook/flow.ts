/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：动作编排（保存/已读/在读/删除）。
 *
 * 语义对齐旧 news/reader.ts（saveToClip + markAsRead + recordStat + 域事件）：
 * - 保存（save）：B站视频 → 文献盒（ADR-0068，openKnowledgeAddTask 不标已读）；
 *   普通文章 → 写剪藏笔记（save.ts），成功后标 news 已处理（read+saved、stats +1、
 *   发 news:read/saved 域事件——smartcat 行为流三跳 + auto-summary 补全依赖）。
 * - 已读（skip）：标 news 已处理（read+skipped、stats +1、发 news:read；C32 起仅在本轮
 *   真的写盘时发——重复标读（盘面已达成目标态）不重复喂 smartcat 行为流）。
 * - 正文保留（issue 274）：已处理不再删 body——会话目录已读/已收条目点开仍可阅全文；
 *   超龄条目由保留策略整条清理（news-data applyRetention）。
 * - 阅读时长：右栏/详情停留会话累计（对齐 ticket 076 openedAt/accumMs 语义，整分钟 ≥1）；
 *   issue 358 起满 1 分钟的会话段封存入账 clipbook.json 侧写 readLog（flushReadingSession：
 *   切篇 / 处理动作落定 / 关面板、卸载），报告页由此派生，news.json 不加段。
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
import { updateClipbookData, type ClipReadLogEntry } from './data';
import { enqueueNewsWrite } from './write-queue';

// ---------- 阅读会话计时（对齐 ticket 076：当前显示条目 + 累计可视毫秒） ----------
let curKey = '';
/** 当前会话条目元信息（issue 358：封存入账 readLog 时的 title/src 取自此；切换前保存旧篇） */
let curMeta: { title: string; src: string } | null = null;
let openedAt = 0;
let accumMs = 0;

/** 切换阅读目标（UI 选中变化/关闭时调用；同篇不重置累计）
 *  C7：同 key 重渲染（renderReader 反复触发）不再重置 openedAt——此前每次都重开计时，
 *  上一段可视时长被丢弃致行为流 durationMin 偏小；仅切换目标时归零重开。
 *  issue 358：切换时旧篇先封存入账侧写 readLog（flushReadingSession），meta 传当前篇。 */
export function setReadingSession(key: string, meta?: { title: string; src: string } | null): void {
  if (key !== curKey) {
    // 切换目标：旧篇累计封存入账 → 换篇重开（封存落盘 fire-and-forget，切篇不等写盘）
    void flushReadingSession();
    curKey = key;
    curMeta = meta || null;
    accumMs = 0;
    openedAt = Date.now();
  } else if (!openedAt) {
    // 同篇且已暂停：恢复计时起点
    openedAt = Date.now();
    if (meta && !curMeta) curMeta = meta;
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

/** 会话封存入账（issue 358）：把当前累计折成整分钟追加进侧写 readLog，然后清零累计。
 *  只记满 1 分钟的段（快速略过不入账，对齐 durationMin 整分钟口径；不足整分钟丢弃）。
 *  调用点：切篇（setReadingSession）/ 处理动作落定后（flowSave/flowMarkRead——行为流
 *  emit 之后，不影响 durationMin）/ 关面板、卸载、开报告前（pause 之后补封存）。
 *  返回落盘 promise（审查修复批 P3⑤）：openClipbookReport await 后再读侧写，
 *  刚读段本次可见；其余调用点 void/fire-and-forget。写失败已 catch（⑧暂存补写，见下），
 *  promise 恒 resolve 不 reject。 */
export function flushReadingSession(): Promise<void> {
  if (!curKey) return Promise.resolve();
  const now = Date.now();
  const total = (openedAt ? now - openedAt : 0) + accumMs;
  openedAt = 0;
  accumMs = 0;
  if (total < 60000) return Promise.resolve();
  const entry: ClipReadLogEntry = {
    key: curKey,
    title: curMeta?.title || '',
    src: curMeta?.src || '',
    minutes: Math.max(1, Math.round(total / 60000)),
    ts: now,
  };
  return appendReadLog(entry).catch((e) => console.error('[剪藏本] 阅读时长入账失败', e));
}

/** 写盘失败暂存（审查修复批 P3⑧）：flush 落盘失败时段留内存，下次 appendReadLog
 *  一并补写入账（原实现静默丢段）。上限防写盘长期失败时无限攒。 */
const PENDING_READ_LOG_MAX = 500;
const pendingReadLog: ClipReadLogEntry[] = [];

/** readLog 追加 + 裁剪（读改写事务，与侧写其他写方同队列串行） */
async function appendReadLog(entry: ClipReadLogEntry): Promise<void> {
  // 批次 = 之前失败暂存的段 + 本次段，一次事务合并入账；成功才清暂存
  const batch = [...pendingReadLog, entry];
  try {
    await updateClipbookData((cur) => {
      return { ...cur, readLog: trimReadLog([...(cur.readLog || []), ...batch], entry.ts) };
    });
    pendingReadLog.length = 0;
  } catch (e) {
    pendingReadLog.push(entry);
    if (pendingReadLog.length > PENDING_READ_LOG_MAX) {
      pendingReadLog.splice(0, pendingReadLog.length - PENDING_READ_LOG_MAX);
    }
    throw e;
  }
}

/** readLog 裁剪口径（issue 358）：保留最近 180 天 + 上限 5000 条（超出裁最旧）。
 *  报告只看本周/本月，180 天窗口绰绰有余；防长年使用把 clipbook.json 无限撑大。 */
const READ_LOG_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const READ_LOG_MAX_ENTRIES = 5000;

export function trimReadLog(list: ClipReadLogEntry[], now: number): ClipReadLogEntry[] {
  const floor = now - READ_LOG_RETENTION_MS;
  const kept = list.filter((e) => e && typeof e.ts === 'number' && isFinite(e.ts) && e.ts >= floor);
  return kept.length > READ_LOG_MAX_ENTRIES ? kept.slice(kept.length - READ_LOG_MAX_ENTRIES) : kept;
}

/** 测试钩子：读当前会话状态（C7 回归保护：同 key 重入不丢累计） */
export function __readingSessionStateForTests(): { curKey: string; accumMs: number; opened: boolean } {
  return { curKey, accumMs, opened: openedAt > 0 };
}

// ---------- news.json 统计/落盘串行队列 ----------
// 队列本体在 write-queue.ts（loader / news-source-settings / store 写回共用同一条链，
// 防「插件多写方互相覆盖 + 对守护进程无合并」——P1 审查项）；此处只封装本域动作。

/** 单篇已处理落盘结果（C17/C32）：
 *  - changed = 本轮真的写了状态（false = 盘面已是目标态，F3 守卫拦截、未写盘）；
 *  - upgraded = skipped→saved 升级路径（C11：不重复计已读/分布）；
 *  - stats = 本轮声明的 stats 快照（未写盘 null）——UI 内存镜像（M.stats）据此与磁盘对齐。 */
export interface HandledBump {
  changed: boolean;
  upgraded: boolean;
  stats: any | null;
}

const NO_BUMP: HandledBump = { changed: false, upgraded: false, stats: null };

/** 统计桶增量（markHandledAndBump 落盘口径）：C11——upgraded（已读未收补收）只推进已收桶，
 *  已读计数与平台/日期分布不重复计（常见动线「打开未读（分布 +1）→ 保存到剪藏本（升级）」
 *  原实现 byPlatform/byDate 再 +1，rail 脚注「今日已读」一篇计两次）。 */
function bumpStats(s: any, action: 'saved' | 'skipped', platform: string, today: string, upgraded: boolean): void {
  if (!upgraded) {
    s.totalRead = (Number(s.totalRead) || 0) + 1;
    if (!s.byPlatform) s.byPlatform = {};
    if (!s.byDate) s.byDate = {};
    s.byPlatform[platform] = (Number(s.byPlatform[platform]) || 0) + 1;
    s.byDate[today] = (Number(s.byDate[today]) || 0) + 1;
  }
  if (action === 'saved') s.totalSaved = (Number(s.totalSaved) || 0) + 1;
  else s.totalSkipped = (Number(s.totalSkipped) || 0) + 1;
}

/** 写单篇已处理 + 统计 +1（合并为一次读改写，旧实现拆两次放大与 daemon 的竞态窗口）：
 *  read + state（issue 274：正文保留不清——已读/已收条目在会话目录点开仍可阅全文）；
 *  统计段与 articles 段在同一队列步内声明改动，写盘经
 *  writeNewsDataMerged 与磁盘做段级合并（daemon 新增文章不丢）。
 *  返回队列 Promise（enh 包：调用方 await 后再刷新内存面，防读到旧态——原 void 语义下
 *  UI「标记已读 → 重读」存在写盘未完成的竞态窗口） */
function markHandledAndBump(raw: any, action: 'saved' | 'skipped'): Promise<HandledBump> {
  const key = articleKeyOf(raw);
  const platform = raw.platform || '未知';
  const today = localDayKey();
  return enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return NO_BUMP;
    let touched = false; // F5：条目已被清理/删除（未命中）不加统计、不空写
    let changed = false; // F3：目标态已达成不改写不计数——重复「标已读」不重复计统计，saved 态不被覆盖成 skipped
    let upgraded = false; // review：已读未收（skipped）补收进剪藏本 → 只推进状态桶，不重复计已读
    const list = (res.data.articles || []).map((a: any) => {
      if (articleKeyOf(a) !== key) return a;
      touched = true;
      if (a.read === true && !(action === 'saved' && a.state !== 'saved')) return a;
      changed = true;
      if (a.read === true) {
        upgraded = true;
        return { ...a, state: 'saved' };
      }
      return { ...a, read: true, state: action };
    });
    if (!touched || !changed) return NO_BUMP;
    const s = res.data.stats || { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
    bumpStats(s, action, platform, today, upgraded);
    await writeNewsDataMerged({ set: { articles: list, stats: s } });
    return { changed: true, upgraded, stats: s };
  });
}

/** 删单篇（news.json 移除该文章；removeArticleKeys 防磁盘并集复活）；返回队列 Promise（同上） */
function removeArticle(raw: any): Promise<void> {
  const key = articleKeyOf(raw);
  return enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    const list = (res.data.articles || []).filter((a: any) => articleKeyOf(a) !== key);
    await writeNewsDataMerged({ set: { articles: list }, removeArticleKeys: [key] });
  });
}

// ---------- 行为流事件（smartcat 依赖契约，对齐旧 reader） ----------
function buildReadEvt(raw: any, state: 'saved' | 'skipped'): NewsReadEvent {
  return { title: raw.title, platform: raw.platform, state, durationMin: durationMin() };
}

function emitReadEvt(raw: any, state: 'saved' | 'skipped'): NewsReadEvent {
  const evt = buildReadEvt(raw, state);
  emitDomainEvent('news', { kind: 'read', evt });
  return evt;
}

// ---------- 对外动作 ----------

/** 保存到剪藏本（news 条目）：写笔记（或分流文献盒）→ 标已处理 → 事件。返回是否成功 */
export async function flowSave(article: any): Promise<boolean> {
  const raw = article && article.raw;
  if (!raw) return false;
  // B站条目不提供保存至剪藏（ADR-0147 推翻 ADR-0068 分流保存，用户拍板 2026-09-16）；
  // UI 已不下发该动作，此处守卫防程序化误调。B站链接入知识盒走「影像」录入。
  if (raw.platform === 'B站') return false;
  pauseReadingSession();
  try {
    const ok = await writeClipNote(raw); // 内部 notice 成功/失败；false = 空标题/取消覆盖/写盘异常
    if (!ok) return false; // 未写盘 → 不标已处理、不进行为流（防文章被静默消费）
    // 写成功 → 标已处理 + 统计（单次读改写；writeClipNote 用传入 raw，标记同样适用）
    const bump = await markHandledAndBump(raw, 'saved');
    // C32：read 事件仅在本轮真的落盘时发——「已存再存」等守卫拦截轮不重复喂行为流。
    // news:saved 保持恒发：笔记本轮确实写出（覆盖场景同样要登记 auto-summary 补全）。
    const evt = buildReadEvt(raw, 'saved');
    if (bump.changed) emitDomainEvent('news', { kind: 'read', evt });
    // 保存联动 auto-summary：登记待补全（smartcat 订阅该剪藏 modify 补全 / 2 分钟降级）
    emitDomainEvent('news', { kind: 'saved', evt, clipPath: `${dirOf()}/${String(raw.title || '').replace(/[\\/:*?"<>|]/g, '').trim()}.md` });
    // 本篇已处理出收件流 → 会话封存入账 readLog（issue 358；行为流已 emit，不影响 durationMin）
    void flushReadingSession();
    return true;
  } catch (e) {
    console.error('[剪藏本] 保存失败', e);
    return false;
  }
}

/** 标记已读（skip 语义：read+skipped 骨架，行为流 news:skipped）。
 *  C32：emitReadEvt 仅在本轮真的落盘（changed）时发——「打开即已读」落盘窗口内再手动标读，
 *  盘面已是目标态（F3 守卫拦截）不再重复喂 smartcat 同篇 news:read。返回落盘结果供 UI 取快照。
 *  opts.keepSession（审查修复批 P1①）：「打开即已读」（markReadOnOpen）路径传 true——
 *  本篇**仍在阅读**，不暂停也不尾置封存会话；原实现的 pause + 写盘完成后尾置 flush 会在
 *  异步窗口内清零该篇刚开的计时器，此后时长在切篇时以 total=0 丢弃（每篇未读条首次
 *  阅读时长系统性不入账）。封存交给既有封存点：切篇 / 关面板 / 卸载 / 开报告。 */
export async function flowMarkRead(article: any, opts?: { keepSession?: boolean }): Promise<HandledBump> {
  const raw = article && article.raw;
  if (!raw) return NO_BUMP;
  const keepSession = !!opts?.keepSession;
  if (!keepSession) pauseReadingSession();
  const res = await markHandledAndBump(raw, 'skipped');
  if (res.changed) emitReadEvt(raw, 'skipped');
  // 手动标读：本篇已处理 → 会话封存入账 readLog（issue 358；行为流之后）
  if (!keepSession) void flushReadingSession();
  return res;
}

/** 删除 news 条目（从 news.json 移除；侧写 override 同步清理） */
export async function flowDeleteNews(article: any): Promise<void> {
  const raw = article && article.raw;
  if (!raw) return;
  await removeArticle(raw);
  try {
    await updateClipbookData((sidecar) => {
      const overrides = { ...sidecar.articleOverrides };
      delete overrides[articleKeyOf(raw)];
      return { ...sidecar, articleOverrides: overrides };
    });
  } catch (e) { /* 忽略 */ }
}

// ---------- 批量已读 + 误操作撤销（enh 包 4/5） ----------

/**
 * 批量标记已读（rail 源行「全部标为已读」）：单次读改写——N 篇一次落盘，不逐篇入队
 * （防 N 次读-写窗口放大与 daemon 的竞态）；批量路径不逐篇发行为流事件
 * （news:read 为单篇阅读语义，整源清扫不属于「阅读」）。
 */
export async function flowMarkAllRead(raws: any[]): Promise<void> {
  const keys = new Set(raws.filter(Boolean).map((r) => articleKeyOf(r)));
  if (!keys.size) return;
  pauseReadingSession();
  await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    const today = localDayKey();
    const s = res.data.stats || { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
    let bumped = 0;
    const list = (res.data.articles || []).map((a: any) => {
      if (a.read === true || !keys.has(articleKeyOf(a))) return a;
      bumped++;
      const next: any = { ...a, read: true, state: 'skipped' };
      const platform = a.platform || '未知';
      s.byPlatform[platform] = (Number(s.byPlatform[platform]) || 0) + 1;
      s.byDate[today] = (Number(s.byDate[today]) || 0) + 1;
      return next;
    });
    if (!bumped) return;
    s.totalRead = (Number(s.totalRead) || 0) + bumped;
    s.totalSkipped = (Number(s.totalSkipped) || 0) + bumped;
    await writeNewsDataMerged({ set: { articles: list, stats: s } });
  });
}

/**
 * 撤销「标记已读/保存」（误操作可撤销）：按动作前 raw 快照恢复该条 read/state/body，
 * 统计按磁盘现态逐桶回退（byDate 以撤销当天为口径——动作与撤销通常同日）。
 * 走既有串行写回队列，与 daemon/其他写方不互吞。
 */
export async function flowUndoHandled(rawBefore: any): Promise<void> {
  if (!rawBefore) return;
  const key = articleKeyOf(rawBefore);
  await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    const s = res.data.stats;
    let touched = false;
    const list = (res.data.articles || []).map((a: any) => {
      if (articleKeyOf(a) !== key) return a;
      touched = true;
      if (s && a.read === true) {
        s.totalRead = Math.max(0, (Number(s.totalRead) || 0) - 1);
        if (a.state === 'saved') s.totalSaved = Math.max(0, (Number(s.totalSaved) || 0) - 1);
        else s.totalSkipped = Math.max(0, (Number(s.totalSkipped) || 0) - 1);
        const platform = a.platform || '未知';
        s.byPlatform[platform] = Math.max(0, (Number(s.byPlatform[platform]) || 0) - 1);
        const day = localDayKey();
        s.byDate[day] = Math.max(0, (Number(s.byDate[day]) || 0) - 1);
      }
      const restored: any = { ...a };
      if (rawBefore.read === undefined) delete restored.read; else restored.read = rawBefore.read;
      if (rawBefore.state === undefined) delete restored.state; else restored.state = rawBefore.state;
      if (rawBefore.body === undefined) delete restored.body; else restored.body = rawBefore.body;
      return restored;
    });
    if (!touched) return;
    await writeNewsDataMerged({ set: s ? { articles: list, stats: s } : { articles: list } });
  });
}

/** 撤销删除 news 条目：把动作前 raw 快照插回 news.json（同 key 已在盘上则跳过，防重复） */
export async function flowUndoDeleteNews(rawBefore: any): Promise<void> {
  if (!rawBefore) return;
  await enqueueNewsWrite(async () => {
    const res = await readNewsData();
    if (!res.ok || res.missing) return;
    const list = res.data.articles || [];
    if (list.some((a: any) => articleKeyOf(a) === articleKeyOf(rawBefore))) return;
    await writeNewsDataMerged({ set: { articles: [...list, rawBefore] } });
  });
}

/** 剪藏目录（设置读取） */
function dirOf(): string {
  const s = tryGetSettings() as any;
  return ((s && s.articleDirectory) || '归档/网页剪藏').replace(/\/+$/, '');
}

