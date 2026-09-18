/**
 * 备忘录（memo）域数据层：memo.json 读写（与旧 memo 域共用同一数据文件）
 * 自 memo/data.ts 迁移（对象单例 DataManager 语义逐字保留）：jsonStore 读写、
 * 字段归一补齐、条目 CRUD、场景解析、公开课笔记检索。
 * 纯数据层（无 DOM）；UI 层经 state/refresh 回调刷新。
 */
import moment from 'moment';
import { jsonStore } from '../core/json-store';
import { getApp } from '../core/app';
import { generateId, extractUrlAndDisplay } from '../core/utils';
import { localNow } from '../core/ui/str';
import { backupOriginal, enqueueFileTask, storageFile } from '../core/storage';
import { notify } from '../core/notice';
import type { MemoItem, MemoRecur, MemoCheckItem } from './types';

export interface MemoSettingsLike {
  /** ADR-0009 共享数据路径 */
  storagePath?: string;
  /** 场景列表（逗号分隔，空则内置默认；与旧 memo 共用 memoScenarios 键） */
  memoScenarios?: string;
  /** 公开课笔记目录（与 memo 共用 cinemaFolderPath） */
  cinemaFolderPath?: string;
}

/** 默认场景（与旧 memo 完全一致，保证同数据文件语义不漂移） */
export const DEFAULT_SCENARIOS = ['剪藏', '工作', '学习', '生活', '代码', '公开课'];

/** 场景列表解析：逗号分隔 → 去空/去重，空结果回退内置默认 */
export function parseScenarios(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [...DEFAULT_SCENARIOS];
  const list = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length ? [...new Set(list)] : [...DEFAULT_SCENARIOS];
}

/** 文件缓存中是否含「公开课」标签（正文标签或 frontmatter tags） */
function hasCourseTag(cache: any): boolean {
  if (cache.tags && (cache.tags as any[]).some((t) => t.tag === '#公开课' || t.tag === '公开课')) return true;
  const tags = cache.frontmatter?.tags;
  return !!tags && tags.includes('公开课'); // 数组与字符串均有 includes
}

/** recur 字段归一（issue 353，零迁移）：合法 kind 保留（days 补 interval 缺省 1；
 *  monthly/yearly 保留合法 anchorDay 月/年锚定日，1-31 整数）；
 *  缺省/形态不对/未知 kind 一律 null（旧数据与手改脏数据都安全回落「不重复」） */
export function normalizeRecur(v: unknown): MemoRecur | null {
  if (!v || typeof v !== 'object') return null;
  const kind = (v as MemoRecur).kind;
  if (kind === 'weekly' || kind === 'monthly' || kind === 'yearly') {
    const out: MemoRecur = { kind };
    const ad = (v as MemoRecur).anchorDay;
    if (typeof ad === 'number' && Number.isInteger(ad) && ad >= 1 && ad <= 31) out.anchorDay = ad;
    return out;
  }
  if (kind === 'days') {
    const n = Number((v as MemoRecur).interval);
    return { kind: 'days', interval: Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1 };
  }
  return null;
}

/** checklist 字段归一（issue 354，零迁移）：逐项 {text,done} 清洗（text 转字符串、done 归布尔、
 *  空 text 行剔除）；非数组/清洗后为空一律 null（旧数据与手改脏数据都安全回落「无清单」） */
export function normalizeChecklist(v: unknown): MemoCheckItem[] | null {
  if (!Array.isArray(v)) return null;
  const items = v
    .map((c: any) => ({ text: String(c?.text ?? '').trim(), done: !!c?.done }))
    .filter((c) => c.text.length > 0);
  return items.length ? items : null;
}

/**
 * composer 约定语法解析（issue 354）：「筹备旅行 /订机票 /订酒店」——
 * 空白分隔的 `/词条` token 逐个收进清单（词条本身不含空白与 `/`；含第二个 `/` 的
 * 形如 /etc/nginx.conf 的 Unix 路径 token 不收，归回标题，审查 P2 修复批）；
 * 其余文本为标题。全部是词条（无标题）时首词条升格为标题；无词条时 checklist = null（普通条目）。
 * 纯函数；URL 不受影响（https:// 开头不以 / 起始，路径型 token 如 24/7 也不带前导斜杠）。
 */
export function parseComposerChecklist(raw: string): { title: string; checklist: MemoCheckItem[] | null } {
  const text = raw.trim();
  if (!text) return { title: '', checklist: null };
  const items: MemoCheckItem[] = [];
  const titleParts: string[] = [];
  for (const tok of text.split(/\s+/)) {
    // `/词条`：以 / 起始、长度 >1、词条内无第二个 /（Unix 绝对路径不收）
    if (tok.length > 1 && tok.startsWith('/') && !tok.slice(1).includes('/')) items.push({ text: tok.slice(1), done: false });
    else titleParts.push(tok);
  }
  let title = titleParts.join(' ').trim();
  if (!title && items.length) title = items.shift()!.text; // 全是词条：首词条升格为标题
  return { title, checklist: items.length ? items : null };
}

/**
 * 周期条目的下一期到期时间（issue 353）：锚定 base（条目 due；无则取完成时刻）不动，
 * 取「锚点 + n 个周期」中第一个严格晚于完成时刻的值——锚点不随加法漂移。
 * 月/年周期带 anchorDay（completeItem 链式记录的原始锚定日）时按「目标月取 min(anchorDay,
 * 当月天数)」取日：钳制后的 due 不回写锚，「每月 31 号」逐代恒 31 号/月末钳制，不退化成 28 号
 * （审查 P1 修复批）。补完逾期老条目逐周期前跳，上限 366 跳防极端数据死循环；
 * guard 耗尽仍不晚于完成时刻（小间隔 + 严重落后的 due）→ 以完成时刻为锚兜底一期。
 * 纯函数（moment 仅做日期算术），nowStr 由调用方注入便于测试。
 */
export function nextRecurDue(recur: MemoRecur, base: string | null, nowStr?: string): string {
  const fmt = 'YYYY-MM-DD HH:mm:ss';
  const norm = (s: string) => s.replace('T', ' ');
  let anchor = moment(norm(base || nowStr || moment().format(fmt)), fmt);
  if (!anchor.isValid()) anchor = moment();
  const now = nowStr ? moment(norm(nowStr), fmt) : moment();
  const unit = recur.kind === 'weekly' ? 'weeks' : recur.kind === 'monthly' ? 'months' : recur.kind === 'yearly' ? 'years' : 'days';
  const amount = unit === 'days' ? (recur.interval && recur.interval >= 1 ? Math.floor(recur.interval) : 1) : 1;
  // 月/年锚定日：加法只推进年月，日成分恒取 min(anchorDay, 目标月天数)（月末钳制不回写锚）
  const anchorDay = recur.anchorDay;
  const useAnchorDay =
    (recur.kind === 'monthly' || recur.kind === 'yearly') && typeof anchorDay === 'number' && Number.isInteger(anchorDay) && anchorDay >= 1 && anchorDay <= 31;
  const shift = (steps: number): moment.Moment => {
    const m = anchor.clone().add(steps * amount, unit as moment.DurationInputArg2);
    if (useAnchorDay) m.date(Math.min(anchorDay as number, m.daysInMonth()));
    return m;
  };
  let n = 1;
  let cur = shift(n);
  if (now.diff(anchor, 'days') > 366) {
    // 严重落后（锚落后超一年）：旧锚已失去调度意义，以完成时刻为锚重排一期，
    // 不再逐周期追赶（避免小间隔 + 多年落后时产出「过去到期」或长期滞留旧锚）
    const m = moment(now).add(amount, unit as moment.DurationInputArg2);
    if (useAnchorDay) m.date(Math.min(anchorDay as number, m.daysInMonth()));
    cur = m;
  } else {
    let guard = 0;
    while (cur.valueOf() <= now.valueOf() && guard++ < 366) {
      n++;
      cur = shift(n);
    }
    if (cur.valueOf() <= now.valueOf()) {
      // guard 耗尽仍不晚于完成时刻：以完成时刻为锚兜底一期（不再产出「过去到期」的下一期）
      cur = moment(now).add(amount, unit as moment.DurationInputArg2);
    }
  }
  return cur.format(fmt);
}

/** 条目字段归一（缺省补默认值，旧数据零迁移）——与旧 memo loadItems 逐字段等价。
 *  M2 字段级守卫：title/scene 关键展示字段 String() 归一（缺失/非串回落 ''，
 *  手改脏数据不再让渲染层 it.title.length TypeError 炸整列表） */
export function normalizeItem(item: any): MemoItem {
  const src = item && typeof item === 'object' ? item : {};
  return {
    id: src.id,
    title: String(src.title ?? ''),
    scene: String(src.scene ?? ''),
    priority: src.priority || 'minor',
    created: src.created,
    completed: src.completed || null,
    due: src.due || null,
    notePath: src.notePath || null,
    notePosition: src.notePosition || null,
    scriptName: src.scriptName || null,
    courseName: src.courseName || null,
    coursePath: src.coursePath || null,
    linkedNote: src.linkedNote || null,
    url: src.url || null,
    recur: normalizeRecur(src.recur),
    checklist: normalizeChecklist(src.checklist),
  };
}

/**
 * 链上是否已有未完成下期（审查 P2 修复批）：完成周期条目会克隆生成下一期（同标题/场景、
 * recur 同 kind、due 更晚、未完成）。已完成的当期再「恢复未完成」时若链上已有下期，
 * 再完成会与首期下期并存重复——restoreItem 据此一并撤链。启发式识别（无 parent id 字段），
 * 标题/场景/周期种类三项对齐生成时全克隆的口径。
 */
export function hasPendingNextItem(items: MemoItem[], it: MemoItem): boolean {
  if (!it.recur || !it.completed) return false;
  return items.some(
    (o) =>
      o.id !== it.id &&
      !o.completed &&
      o.title === it.title &&
      o.scene === it.scene &&
      o.recur?.kind === it.recur!.kind &&
      !!o.due &&
      (!it.due || o.due > it.due)
  );
}

export const MemoData = {
  memoFilePath: '',
  scenarios: [] as string[],
  _store: null as ReturnType<typeof jsonStore> | null,
  cinemaFolderPath: '我的/影视',

  init(settings: MemoSettingsLike) {
    // memo.json 路径（ADR-0009 共享数据路径）
    this.memoFilePath = storageFile('memo.json', settings.storagePath || 'CONFIG/STORAGE');
    this._store = jsonStore(this.memoFilePath);
    // 场景：设置可编辑（逗号分隔），空则内置默认（与旧 memo 共用 memoScenarios 键）
    this.scenarios = parseScenarios(settings.memoScenarios);
    this.cinemaFolderPath = settings.cinemaFolderPath || '我的/影视';
  },

  async read() {
    return this._store!.read();
  },
  async write(data: any) {
    return this._store!.write(data);
  },

  /** 加载条目：读 + 缺 id 生成 + 字段归一（与旧 memo 一致：有缺 id 整写回补）。
   *  id 前缀用 generateId() 默认 'item'——与旧 memo 域同写 memo.json，保证两域对同文件
   *  的 id 形态完全一致（T5）。读改写整体入 per-path 串行队列（写竞态收敛，对照 memo/data.ts） */
  async loadItems(): Promise<MemoItem[]> {
    return enqueueFileTask(this.memoFilePath, async () => {
      const raw = await this.read();
      // E23：合法 JSON 但非数组（对象/标量/null 等损坏形态）——此前 raw.map 抛 TypeError
      // 被上层吞掉，面板静默空白。按 D1 契约原样留档后重建空清单，不再无声丢形态。
      if (!Array.isArray(raw)) {
        const backup = await backupOriginal(getApp(), this.memoFilePath);
        await this.write([]);
        try {
          notify(
            backup
              ? `备忘录数据文件损坏（内容不是列表），原内容已留档到 ${backup}，已重建空清单继续使用`
            : '备忘录数据文件损坏（内容不是列表），已重建空清单继续使用',
            { type: 'warning', dedupeKey: 'memo-loaditems-corrupt' }
          );
        } catch (e) {
          /* 无 DOM 环境（纯数据层 node 测试等）静默 */
        }
        return [];
      }
      let needWrite = false;
      // M2 元素级守卫：null/非对象元素（外部同步工具/手滑编辑可产出）剔除不再让
      // item.id TypeError 炸整条读链（面板永久空白 + unhandled rejection）；
      // 剔除即回写（坏元素不留在盘上），console.warn 一次汇总留痕
      const clean: any[] = [];
      let bad = 0;
      for (const item of raw) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          bad++;
          needWrite = true;
          continue;
        }
        if (!item.id) {
          item.id = generateId();
          needWrite = true;
        }
        clean.push(item);
      }
      if (bad > 0) console.warn(`[bz:memo] memo.json 含 ${bad} 个非法条目（null/非对象），已剔除`);
      const items = clean.map((item: any) =>
        // 统一字段形状（缺省补默认值，旧数据零迁移）
        normalizeItem(item)
      );
      if (needWrite) await this.write(clean);
      return items;
    });
  },

  async addItem(item: MemoItem) {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      data.unshift(item);
      await this.write(data);
    });
  },

  async updateItem(id: string, newData: Partial<MemoItem>) {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      const idx = data.findIndex((d: any) => d.id === id);
      if (idx === -1) throw new Error('条目不存在');
      const old = data[idx];
      // 如果新数据包含 title 但未提供 url，则自动提取
      if (newData.title !== undefined && newData.url === undefined) {
        const { url } = extractUrlAndDisplay(newData.title);
        newData.url = url;
      }
      data[idx] = {
        ...old,
        ...newData,
        id: old.id,
        created: old.created,
      };
      await this.write(data);
    });
  },

  /**
   * 完成条目（issue 353 扩展）：标记 completed；周期条目（recur）自动生成下一期——
   * 全字段克隆（场景/优先级/关联笔记/子任务等保留），新 id/created，completed 清空，
   * due 顺延到下一周期（nextRecurDue，无 due 则锚定完成时刻起算）；
   * 月/年周期把未钳制的锚定日记进下一代 recur.anchorDay（月末钳制不跨代漂移，审查 P1 修复批）。
   * 返回 { next, changed }：非周期条目 next = null；已完成条目幂等短路（changed = false，
   * UI 据此不重复发 completed 域事件，审查 P3 修复批）。
   * 整个「读→改→写（含生成）」在同一个串行队列任务内原子完成——队列不可重入，
   * 任务内不得再走 updateItem/addItem（同路径会死锁）。
   */
  async completeItem(id: string): Promise<{ next: MemoItem | null; changed: boolean }> {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      const item = data.find((d: any) => d.id === id);
      if (!item) throw new Error('条目不存在');
      if (item.completed) return { next: null, changed: false };
      const now = localNow();
      item.completed = now;
      const recur = normalizeRecur(item.recur);
      let next: MemoItem | null = null;
      if (recur) {
        const due = nextRecurDue(recur, item.due || now, now);
        // 月/年锚定日链式：首期（无 anchorDay）从条目 due 记原始日；已带锚的传下去不动——
        // 锚取「原始日」而非钳制后的 due 日，跨代不漂移（1/31 → 2/28 → 3/31 …）
        const nextRecur: MemoRecur = { ...recur };
        if ((recur.kind === 'monthly' || recur.kind === 'yearly') && nextRecur.anchorDay === undefined) {
          const d = moment((item.due || now).replace('T', ' '), 'YYYY-MM-DD HH:mm:ss');
          if (d.isValid()) nextRecur.anchorDay = d.date();
        }
        // 经 normalizeItem 重建干净形态；notePosition 浅拷贝防两期共享引用；
        // checklist 深拷贝且勾选态重置——新的一期从头来过（原条目保留当期勾选史）
        next = normalizeItem({
          ...item,
          recur: nextRecur,
          notePosition: item.notePosition ? { ...item.notePosition } : null,
          checklist: normalizeChecklist(item.checklist)?.map((c) => ({ ...c, done: false })) ?? null,
          id: generateId(),
          created: now,
          completed: null,
          due,
        });
        data.unshift(next);
      }
      await this.write(data);
      return { next, changed: true };
    });
  },

  /** 删除条目；返回被删条目的原索引（未找到返回 -1），供撤销时插回原位 */
  async deleteItem(id: string): Promise<number> {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      const idx = data.findIndex((d: any) => d.id === id);
      if (idx !== -1) {
        data.splice(idx, 1);
        await this.write(data);
      }
      return idx;
    });
  },

  /** 撤销删除：把删除前的条目快照插回原索引（越界/未传则头部插入，对齐 addItem 语义） */
  async restoreItem(item: MemoItem, idx?: number) {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      const at = idx !== undefined && idx >= 0 && idx <= data.length ? idx : 0;
      data.splice(at, 0, item);
      await this.write(data);
    });
  },

  /**
   * 批量清理已完成条目（效率#11）：completed 非空且早于 cutoff（字符串比较，YYYY-MM-DD
   * HH:mm:ss 字典序即时间序）的一次性删除；cutoff 传 null = 不设时间窗（清全部已完成）。
   * onlyIds 提供时只清该集合内的条目（UI 侧按当前视图可见口径收窄，所见即所删）。
   * 整个读改写在同一个串行队列任务内原子完成；返回被删条目快照数组（含各自原索引，
   * 供撤销按原索引升序逐条 restoreItem 插回原位——绝对位置 splice 须先小后大，降序会错位）。
   */
  async deleteCompletedBefore(
    cutoff: string | null,
    onlyIds?: ReadonlySet<string>
  ): Promise<{ item: MemoItem; idx: number }[]> {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      const removed: { item: MemoItem; idx: number }[] = [];
      const kept: any[] = [];
      data.forEach((d: any, idx: number) => {
        const hit =
          d &&
          typeof d === 'object' &&
          d.completed &&
          (cutoff === null || d.completed < cutoff) &&
          (!onlyIds || onlyIds.has(d.id));
        if (hit) removed.push({ item: normalizeItem(d), idx });
        else kept.push(d);
      });
      if (removed.length) await this.write(kept);
      return removed;
    });
  },

  /** 批量迁移条目场景（场景重命名/删除用）：scene === from → to，返回迁移条数。
   *  同源兼容：只改条目 scene 字段，写法与 memo 域读写同文件同形，memo 侧下次 loadItems 即读到 */
  async updateSceneBulk(from: string, to: string): Promise<number> {
    return enqueueFileTask(this.memoFilePath, async () => {
      const data = await this.read();
      let n = 0;
      data.forEach((d: any) => {
        if (d.scene === from) {
          d.scene = to;
          n++;
        }
      });
      if (n > 0) await this.write(data);
      return n;
    });
  },

  /** 公开课笔记（影视目录中含 公开课 标签的文件）。
   *  A6 前缀边界：path === dir || path.startsWith(dir + '/')（对齐 core/file-sync inFolders）——
   *  裸 startsWith 会把同级兄弟目录「我的/影视花絮」误命中进「我的/影视」 */
  async getCourseNotes(): Promise<{ name: string; path: string }[]> {
    const app = getApp();
    const result: { name: string; path: string }[] = [];
    const dir = this.cinemaFolderPath;
    for (const file of app.vault.getFiles()) {
      const inDir = file.path === dir || file.path.startsWith(dir + '/');
      if (!inDir || file.extension !== 'md') continue;
      const cache = app.metadataCache.getFileCache(file);
      if (!cache) continue;
      if (hasCourseTag(cache)) result.push({ name: file.basename, path: file.path });
    }
    return result;
  },

  getScenarios(): string[] {
    return this.scenarios;
  },
};
