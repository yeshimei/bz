/**
 * 记忆目录同步（ADR-0069 §3/§6-R3/R4/R6/R7）：配置目录内的笔记 → 记忆流「笔记记忆库」。
 *
 * 数据层纯逻辑，可测：
 *  - vault 操作经注入 adapter（listFiles/readFile/fileMtime/now/diaryDirectory），不碰真实 vault；
 *  - 记忆入库经注入 backend（memory.ts 契约 API：upsertNoteMemory / removeMemoryByRef /
 *    setRefResolver；listRefPaths 为本流打桩假设——合并时由 memory.ts 补齐，可选）；
 *  - 首启全量扫描：遍历配置目录（一条笔记只归一个目录，按配置顺序首个匹配；跳过 .obsidian/
 *    模板/.safe.enc 等杂物，只认 .md）；
 *  - 日记特殊处理：DIARY_DIRECTORY 下按 diary parser `# <emoji> HH:MM` 拆条——一个时间段 =
 *    一条记忆，refPath =「路径#HH:MM」，created = 文件名日期 + 段落时间（R7：decay 按真实日期）；
 *    其余笔记一篇一条，created 取 mtime（不可得用当天）；
 *  - 增量：modify 按 mtime 节流（R4：距上次 ≥10min 才重入库，期间变更合并 pending；「今天」的
 *    日记段即时）；delete → removeMemoryByRef；rename → 删旧 ref + 读新文件重新 upsert（R6）；
 *    目录从设置移除 → 清其名下全部条目；
 *  - 引用失效自愈：resolver/getFile 返回 null 的条目登记（onStaleRef）并清理。
 */
import { parseFile } from '../diary/parser';

/** 记忆入库种子（memory.ts 契约 API 入参，签名冻结） */
export interface NoteMemorySeed {
  refPath: string;
  locator?: string;
  fullText: string;
  created?: string;
  source?: string;
}

/** memory.ts 记忆系统契约面（本流打桩对接；合并时由 memory.ts 实现同签名方法） */
export interface NoteMemoryBackend {
  upsertNoteMemory(seed: NoteMemorySeed): Promise<void>;
  removeMemoryByRef(refPath: string): Promise<void>;
  setRefResolver(fn: (ref: string) => Promise<string | null>): void;
  /** 打桩假设（可选，合并时由 memory.ts 提供）：枚举现有笔记记忆引用——目录移除清理/失效自愈用 */
  listRefPaths?(): Promise<string[]>;
}

/** vault 最小面（测试注入；生产由 index 用 app.vault 装配） */
export interface NoteMemoryAdapter {
  /** vault 全部文件路径 */
  listFiles(): string[];
  /** 读文件正文；不存在/失败 → null（瞬态读失败与真删除的 B1 分离语义） */
  readFile(path: string): Promise<string | null>;
  /** 文件 mtime（ms）；不可得 → null */
  fileMtime(path: string): number | null;
  /** 当前时间（ms，测试可注入） */
  now(): number;
  /** 日记目录（diary/config 动态目录） */
  diaryDirectory(): string;
}

export interface NoteMemoryDeps {
  adapter: NoteMemoryAdapter;
  backend: NoteMemoryBackend;
  /** 当前记忆目录配置（normalizeMemoryDirectories 清洗后） */
  getDirectories(): string[];
  /** 引用失效登记回调（自愈观察钩子，可选） */
  onStaleRef?(ref: string): void;
}

/** 增量重入库节流间隔（R4：距上次处理 ≥10min 才重打分重入库；测试可注入缩短） */
export const NOTE_MEMORY_THROTTLE_MS = 10 * 60 * 1000;

/** 环境目录名（任意层级命中即跳过整文件；对齐 path-picker EXCLUDED_DIR_NAMES + 模板目录） */
const SKIP_DIR_NAMES = new Set(['.obsidian', '.trash', '.git', 'node_modules', '模板', 'templates']);

/** 路径归一（反斜杠 → 斜杠；目录用） */
function normPath(p: string): string {
  return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
}

/** 杂物过滤（ADR-0069 §3）：只认 .md；环境目录/模板目录/.enc 加密杂物一律跳过 */
export function isSkippablePath(path: string): boolean {
  const p = normPath(path);
  if (!p.toLowerCase().endsWith('.md')) return true;
  if (p.toLowerCase().endsWith('.enc')) return true; // 加密 .safe.enc 等杂物防御性兜底
  for (const seg of p.split('/')) {
    if (SKIP_DIR_NAMES.has(seg)) return true;
  }
  return false;
}

/** 目录归属（R6 嵌套去重）：按配置顺序首个匹配（'' = 库根匹配一切）；未命中 → null */
export function resolveOwnerDir(path: string, dirs: string[]): string | null {
  const p = normPath(path);
  for (const dir of dirs) {
    const d = normPath(dir);
    if (d === '' || p === d || p.startsWith(d + '/')) return dir;
  }
  return null;
}

/** 日记文件名日期（`YYYY-MM-DD.md` → 'YYYY-MM-DD'；非日期命名 → null） */
export function noteMemoryDiaryDate(path: string): string | null {
  const base = normPath(path).split('/').pop() || '';
  const m = base.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  return m ? m[1] : null;
}

/** 归属分类：日记（按段拆条）| 普通笔记 | 非我方（未配置/杂物/非日记日期命名的日记目录文件） */
export type NoteMemoryClass =
  | { kind: 'diary'; date: string }
  | { kind: 'note' }
  | null;

/** 归属判定（日记目录特殊处理优先于普通目录归属） */
export function classifyForMemory(path: string, dirs: string[], diaryDir: string): NoteMemoryClass {
  if (isSkippablePath(path)) return null;
  const p = normPath(path);
  const d = normPath(diaryDir);
  if (d && (p === d || p.startsWith(d + '/'))) {
    const date = noteMemoryDiaryDate(p);
    return date ? { kind: 'diary', date } : null; // 日记目录下非日期命名文件不跟踪（对齐观察链路）
  }
  return resolveOwnerDir(p, dirs) !== null ? { kind: 'note' } : null;
}

/** 本地日期（YYYY-MM-DD；now 注入供测试） */
export function noteMemoryToday(now: number): string {
  const dt = new Date(now);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
}

/** 日记文件拆条（复用 diary parser）：有正文的每个时间段 = 一条种子 */
export function diarySeeds(path: string, content: string, date: string): NoteMemorySeed[] {
  let entries: ReturnType<typeof parseFile>;
  try {
    entries = parseFile(content, date);
  } catch {
    return []; // 解析异常按无条目（不阻塞扫描）
  }
  const seeds: NoteMemorySeed[] = [];
  for (const e of entries) {
    const text = String(e.content || '').trim();
    if (!text) continue;
    seeds.push({
      refPath: `${path}#${e.time}`,
      locator: e.time,
      fullText: text,
      created: `${date}T${e.time}:00`, // 文件名日期 + 段落时间（R7：decay 按真实日记日期）
      source: 'diary',
    });
  }
  return seeds;
}

/** 单文件 → 入库种子列表（未命中/杂物/空正文 → []） */
export function buildSeedsForFile(
  path: string,
  content: string,
  mtimeMs: number | null,
  dirs: string[],
  diaryDir: string,
  today: string
): NoteMemorySeed[] {
  const cls = classifyForMemory(path, dirs, diaryDir);
  if (!cls) return [];
  const p = normPath(path);
  if (cls.kind === 'diary') return diarySeeds(p, content, cls.date);
  const text = String(content || '').trim();
  if (!text) return [];
  const created = mtimeMs != null ? new Date(mtimeMs).toISOString() : `${today}T00:00:00`;
  return [{ refPath: p, fullText: text, created, source: 'note' }];
}

/**
 * 记忆目录同步器（有状态增量部分；扫描/拆段/节流判定均为可测纯逻辑或注入时间） */
export class NoteMemorySync {
  private readonly deps: NoteMemoryDeps;
  private readonly throttleMs: number;
  /** path → 上次入库时间（ms）（R4 节流基准） */
  private lastAt = new Map<string, number>();
  /** path → 已入库 refPath 列表（delete/rename/目录清理按此回删） */
  private refs = new Map<string, string[]>();
  /** 节流期内变更合并待重入库（R4） */
  private pending = new Set<string>();
  /** path → 上次入库时正文（审查 P1：今日日记即时路径的内容去重——内容没变不重打分/重向量化） */
  private lastContent = new Map<string, string>();

  constructor(deps: NoteMemoryDeps, throttleMs: number = NOTE_MEMORY_THROTTLE_MS) {
    this.deps = deps;
    this.throttleMs = throttleMs;
  }

  /** 首启全量扫描建库（ADR-0069 §3）+ refResolver 注入 + 引用失效自愈 */
  async init(): Promise<void> {
    this.injectRefResolver();
    await this.scanAndUpsert(this.deps.getDirectories());
    await this.verifyStaleRefs();
  }

  /** refResolver 注入（契约 API setRefResolver）：ref =「路径」或「路径#定位符」→ 正文或 null。
   *  日记段 ref 按定位符拆回该时间段正文（memory.ts prompt 拼装当场取文）。 */
  private injectRefResolver(): void {
    this.deps.backend.setRefResolver(async (ref: string) => {
      const i = ref.indexOf('#');
      const path = i === -1 ? ref : ref.slice(0, i);
      const locator = i === -1 ? undefined : ref.slice(i + 1);
      const content = await this.deps.adapter.readFile(path);
      if (content == null) return null;
      if (!locator) return content;
      const date = noteMemoryDiaryDate(path);
      if (!date) return content;
      try {
        const seg = parseFile(content, date).find((e) => e.time === locator);
        return seg && seg.content.trim() ? seg.content : null;
      } catch {
        return content;
      }
    });
  }

  /** 全量扫描入库（也用于目录新增后的增量补扫；幂等——重复 upsert 交由 memory.ts 去重） */
  async scanAndUpsert(dirs: string[]): Promise<number> {
    const now = this.deps.adapter.now();
    const today = noteMemoryToday(now);
    let count = 0;
    for (const path of this.deps.adapter.listFiles()) {
      const seeds = await this.seedsFor(path, dirs, today);
      if (!seeds.length) continue;
      for (const seed of seeds) await this.deps.backend.upsertNoteMemory(seed);
      this.refs.set(normPath(path), seeds.map((s) => s.refPath));
      this.lastAt.set(normPath(path), now);
      count += seeds.length;
    }
    return count;
  }

  /** 读文件 + 构建种子（当前配置目录） */
  private async seedsFor(path: string, dirs: string[], today: string): Promise<NoteMemorySeed[]> {
    if (isSkippablePath(path)) return [];
    const content = await this.deps.adapter.readFile(path);
    if (content == null) return [];
    return buildSeedsForFile(path, content, this.deps.adapter.fileMtime(path), dirs, this.deps.adapter.diaryDirectory(), today);
  }

  /** vault modify 增量（R4：mtime 节流；「今天」的日记段即时） */
  async onModified(path: string): Promise<void> {
    const p = normPath(path);
    if (!p) return;
    const dirs = this.deps.getDirectories();
    const cls = classifyForMemory(p, dirs, this.deps.adapter.diaryDirectory());
    if (!cls) return;
    const now = this.deps.adapter.now();
    // 「今天」的日记可即时（R4 豁免：当天日记段反复保存要即时可检索）。
    // 审查 P1：即时 ≠ 每次保存都重打分——内容与上次入库一致（Obsidian 自动保存空触发）直接跳过
    const immediate = cls.kind === 'diary' && cls.date === noteMemoryToday(now);
    if (immediate) {
      const content = await this.deps.adapter.readFile(p);
      if (content != null && content === this.lastContent.get(p)) return;
      await this.upsertFile(p, now, dirs);
      if (content != null) this.lastContent.set(p, content);
      return;
    }
    if (now - (this.lastAt.get(p) ?? 0) < this.throttleMs) {
      this.pending.add(p); // 期间变更合并为一次（R4）
      return;
    }
    await this.upsertFile(p, now, dirs);
  }

  /** 读新内容重新入库（rename 即时、flushDue 到期、目录新增补扫共用） */
  async upsertFile(path: string, now: number, dirs: string[]): Promise<void> {
    const p = normPath(path);
    const today = noteMemoryToday(now);
    const seeds = await this.seedsFor(p, dirs, today);
    // 文件仍在配置内但内容读空/解析为空 → 视为清空：回删旧条目（防悬挂引用）
    if (!seeds.length) {
      await this.dropRefs(p);
      return;
    }
    for (const seed of seeds) await this.deps.backend.upsertNoteMemory(seed);
    this.refs.set(p, seeds.map((s) => s.refPath));
    this.lastAt.set(p, now);
    this.pending.delete(p);
  }

  /** R4 合并窗口到期重入库（挂 30s 调度 tick 分派；距上次 <节流间隔的继续等） */
  async flushDue(): Promise<void> {
    if (!this.pending.size) return;
    const now = this.deps.adapter.now();
    const dirs = this.deps.getDirectories();
    for (const p of [...this.pending]) {
      if (now - (this.lastAt.get(p) ?? 0) >= this.throttleMs) {
        await this.upsertFile(p, now, dirs);
      }
    }
  }

  /** vault delete（delete 事件；按已跟踪 ref 逐条回删，未跟踪普通笔记按路径兜底） */
  async onDeleted(path: string): Promise<void> {
    const p = normPath(path);
    if (!p) return;
    await this.dropRefs(p);
  }

  /** vault rename（R6：不拆 delete+create——删旧 ref + 读新文件重新 upsert，即时不走节流） */
  async onRenamed(oldPath: string, newPath: string): Promise<void> {
    const from = normPath(oldPath);
    const to = normPath(newPath);
    if (!from || !to || from === to) return;
    await this.dropRefs(from);
    const dirs = this.deps.getDirectories();
    if (classifyForMemory(to, dirs, this.deps.adapter.diaryDirectory())) {
      await this.upsertFile(to, this.deps.adapter.now(), dirs);
    } else {
      this.lastAt.delete(from);
      this.pending.delete(from);
    }
  }

  /** 目录配置变更（R6）：移除目录 → 清其名下全部条目；新增目录 → 补扫入库 */
  async syncDirectories(dirs: string[]): Promise<void> {
    // 回删：已跟踪 ref 的归属目录不再在配置内 → 清条目
    for (const p of [...this.refs.keys()]) {
      if (!classifyForMemory(p, dirs, this.deps.adapter.diaryDirectory())) {
        await this.dropRefs(p);
      }
    }
    // 补扫：新目录内未跟踪文件入库（已跟踪幂等跳过由 upsert 去重语义兜底）
    await this.scanAndUpsert(dirs);
    await this.verifyStaleRefs();
  }

  /** 引用失效自愈（ADR-0069 R3）：枚举条目引用，resolver 读不到正文 → 登记 + 清理 */
  async verifyStaleRefs(): Promise<void> {
    let candidates: string[];
    try {
      const listed = await this.deps.backend.listRefPaths?.();
      candidates = listed && listed.length ? [...listed] : [...new Set([...this.refs.values()].flat())];
    } catch {
      candidates = [...new Set([...this.refs.values()].flat())];
    }
    for (const ref of candidates) {
      const i = ref.indexOf('#');
      const content = await this.deps.adapter.readFile(i === -1 ? ref : ref.slice(0, i));
      const stale = content == null || (i !== -1 && !(await this.refSegmentAlive(ref)));
      if (stale) {
        try { this.deps.onStaleRef?.(ref); } catch { /* 观察钩子失败不影响清理 */ }
        await this.deps.backend.removeMemoryByRef(ref);
      }
    }
  }

  /** 日记段 ref 存活判定：定位符时段落正文仍存在 */
  private async refSegmentAlive(ref: string): Promise<boolean> {
    const i = ref.indexOf('#');
    if (i === -1) return true;
    const content = await this.deps.adapter.readFile(ref.slice(0, i));
    if (content == null) return false;
    const date = noteMemoryDiaryDate(ref.slice(0, i));
    if (!date) return true;
    try {
      return parseFile(content, date).some((e) => e.time === ref.slice(i + 1) && e.content.trim());
    } catch {
      return true; // 解析异常按存活（不误删）
    }
  }

  /** 回删某文件名下全部已入库 ref（并清节流/合并状态） */
  private async dropRefs(path: string): Promise<void> {
    const p = normPath(path);
    const known = this.refs.get(p);
    if (known?.length) {
      for (const ref of known) await this.deps.backend.removeMemoryByRef(ref);
    } else if (classifyForMemory(p, this.deps.getDirectories(), this.deps.adapter.diaryDirectory())?.kind === 'note') {
      // 未跟踪过的普通笔记（重启前入库）：按路径兜底回删（日记段无时间信息，交 memory.ts 对账）
      await this.deps.backend.removeMemoryByRef(p);
    }
    this.refs.delete(p);
    this.lastAt.delete(p);
    this.pending.delete(p);
    this.lastContent.delete(p);
  }

  /** 测试辅助：读取已跟踪 ref 表 */
  getTrackedRefs(): ReadonlyMap<string, readonly string[]> {
    return this.refs;
  }

  /** 测试辅助：读取合并待重入库集合 */
  getPending(): ReadonlySet<string> {
    return this.pending;
  }

  /** 卸载清理（无定时器；仅清内存表） */
  dispose(): void {
    this.lastAt.clear();
    this.refs.clear();
    this.pending.clear();
    this.lastContent.clear();
  }
}
