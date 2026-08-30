/**
 * 第二大脑共享数据文件层（ticket 120 数据整合；ticket 141 chatHistory 段加法扩展；
 * ticket 152 Syncthing 冲突自愈）
 * - 单文件 secondbrain.json 承载 JSON 段：meta（索引元数据）/ panel（AI 概括缓存，ticket 141 起
 *   仅存量保留不再消费）/ link（双链队列+基准哈希）/ chatHistory（AI 对话历史，ticket 141 加法扩展）；
 *   向量二进制独立 secondbrain.vec（原 secondbrain_vectors.vec 改名，ticket 120）。
 * - loadStore：读整文件 → parse → 段结构校验；损坏 → 留档 .corrupt- 重建空结构（jsonStore 同款容错）；
 *   首次调用触发一次性迁移（四旧 JSON + 旧 vec → 组装/改名 → 删旧；幂等：新文件存在即跳过）；
 *   新文件不存在且无旧文件 → 返回空结构**不落盘**（保持原「空库不产生文件」语义，refresh 才首建）。
 * - 串行写链：所有读写（含迁移）经模块级 promise 链排队，杜绝并发交错覆盖——
 *   loadStore/mutateStore 对外，内部共用 readStoreRaw（迁移也在此保护内），写经 saveStoreRaw 直接落盘。
 * - Syncthing 冲突自愈（ticket 152）：多设备各自 refresh 索引不同新笔记 → 同一文件两端真实分叉，
 *   Syncthing 保留 *.sync-conflict-* 副本（写前比对止血后仍发生，见 issues/152 诊断）。
 *   每次读取时扫描目录，JSON 段级 union 合并回主文件、.vec 按合并后 meta 键序行级重排；随后删除冲突文件。
 *   无冲突文件 → 零行为（一次 adapter.list）。全程在串行写链内，与写入互斥。
 * - 纯数据层（无 DOM / 无 notice 依赖），node 环境可测；依赖 getApp()（同 data.ts/jsonStore 模式）。
 */
import { getApp } from '../core/app';
import { storageDir, storageFile } from '../core/storage';
import { bytesEqual } from '../core/utils';

/** 单文件结构版本（ticket 120 首版） */
export const STORE_VERSION = 1;

/** link 段：双链队列 + 正文基准哈希（原 secondbrain_link_queue.json / secondbrain_link_state.json） */
export interface LinkStoreSection {
  queue: Array<{ path: string; hash?: string; queuedAt?: string }>;
  state: Record<string, { hash: string; linkedAt: string }>;
}

/**
 * chatHistory 段条目（ticket 141 加法扩展）：一轮问答各一条（user 提问 / assistant 回复）。
 * 旧数据无此段视为空，零迁移可读；写入时超出 CHAT_HISTORY_LIMIT 截断最旧。
 */
export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

/** 对话历史上限（ticket 141）：超出截断最旧 */
export const CHAT_HISTORY_LIMIT = 100;

/** 单文件整体结构（v1；chatHistory 为 ticket 141 加法扩展段） */
export interface SecondBrainStore {
  version: number;
  meta: Record<string, unknown> | null;
  panel: { summary: string; generatedAt: number } | null;
  link: LinkStoreSection;
  /** AI 对话历史（ticket 141 加法扩展：旧文件缺失 → []，normalizeStore 兜底，零迁移） */
  chatHistory: ChatHistoryEntry[];
}

/** storagePath 唯一目录口径（ADR-0009 延续；同 config.ts） */
function storeDir(): string {
  return storageDir();
}

/** 单文件 JSON 路径（ticket 120：全部 JSON 数据一个文件） */
export function getSecondBrainStorePath(): string {
  return storageFile('secondbrain.json');
}

/** 向量二进制路径（ticket 120：原 secondbrain_vectors.vec 改名） */
export function getSecondBrainVecPath(): string {
  return storageFile('secondbrain.vec');
}

/** 旧文件名清单（一次性迁移源；迁移成功即删除） */
const LEGACY_FILES = [
  'secondbrain_meta.json',
  'secondbrain_panel.json',
  'secondbrain_link_queue.json',
  'secondbrain_link_state.json',
] as const;

const LEGACY_VEC = 'secondbrain_vectors.vec';

function emptyStore(): SecondBrainStore {
  return { version: STORE_VERSION, meta: null, panel: null, link: { queue: [], state: {} }, chatHistory: [] };
}

/** chatHistory 段校验（ticket 141 加法扩展）：非数组 → []；条目 role/content 不合法的剔除，超限截断最旧 */
function normalizeChatHistory(raw: unknown): ChatHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter(
    (e): e is ChatHistoryEntry =>
      !!e &&
      typeof e === 'object' &&
      ((e as any).role === 'user' || (e as any).role === 'assistant') &&
      typeof (e as any).content === 'string'
  );
  return valid.slice(-CHAT_HISTORY_LIMIT);
}

/** 段结构校验：容忍旧写错 / 缺段（queue 非数组→[]；state 非对象→{}；panel/meta 缺省 null/{}；
 *  chatHistory 缺失→[]——ticket 141 加法扩展，旧数据零迁移可读） */
function normalizeStore(raw: unknown): SecondBrainStore {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const linkRaw = d.link && typeof d.link === 'object' ? (d.link as Record<string, unknown>) : {};
  const panel = d.panel && typeof d.panel === 'object' ? (d.panel as SecondBrainStore['panel']) : null;
  return {
    version: d.version === STORE_VERSION ? STORE_VERSION : (undefined as unknown as number),
    meta: d.meta && typeof d.meta === 'object' ? (d.meta as SecondBrainStore['meta']) : {},
    panel,
    link: {
      queue: Array.isArray(linkRaw.queue) ? (linkRaw.queue as LinkStoreSection['queue']) : [],
      state:
        linkRaw.state && typeof linkRaw.state === 'object' && !Array.isArray(linkRaw.state)
          ? (linkRaw.state as LinkStoreSection['state'])
          : {},
    },
    chatHistory: normalizeChatHistory(d.chatHistory),
  };
}

/** adapter 能力防御（迁移删除/改名：适配器缺方法时静默降级——部分测试用轻量 adapter mock） */
function hasFn(adapter: any, name: string): boolean {
  return typeof adapter?.[name] === 'function';
}

async function readJsonIfExists(app: any, path: string): Promise<unknown | null> {
  const adapter = app.vault.adapter;
  try {
    if (hasFn(adapter, 'exists') && !(await adapter.exists(path))) return null;
    if (!hasFn(adapter, 'read')) return null;
    const text = await adapter.read(path);
    if (typeof text !== 'string') return null;
    try {
      return JSON.parse(text);
    } catch {
      return null; // 单文件损坏就地忽略（整文件损坏走 loadStore 留档路径）
    }
  } catch {
    return null;
  }
}

/**
 * 一次性迁移（幂等）：新文件已存在 → 跳过；存在任一旧 JSON → 组装写新 → 删除旧 JSON；
 * 旧 vec 存在 → 改名 secondbrain.vec（rename 不可用 → 读改写删兜底）。
 * 无旧文件 → 返回 false（不落盘，保持空库不产生文件语义）。
 * 只允许在串行链内调用（migrateLegacy 写新删旧与并发读必须互斥）。
 */
async function migrateLegacy(app: any): Promise<boolean> {
  const adapter = app.vault.adapter;
  const storePath = getSecondBrainStorePath();
  try {
    if (hasFn(adapter, 'exists') && (await adapter.exists(storePath))) return false; // 新文件已存在，幂等
  } catch {
    return false;
  }

  let anyLegacy = false;
  const store = emptyStore();
  for (const name of LEGACY_FILES) {
    const legacyPath = storeDir() + '/' + name;
    const raw = await readJsonIfExists(app, legacyPath).catch(() => null);
    if (raw === null) continue;
    anyLegacy = true;
    if (name === 'secondbrain_meta.json' && raw && typeof raw === 'object') store.meta = raw as Record<string, unknown>;
    else if (name === 'secondbrain_panel.json' && raw && typeof raw === 'object') store.panel = raw as SecondBrainStore['panel'];
    else if (name === 'secondbrain_link_queue.json') {
      if (Array.isArray(raw)) store.link.queue = raw as LinkStoreSection['queue'];
    } else if (name === 'secondbrain_link_state.json') {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) store.link.state = raw as LinkStoreSection['state'];
    }
  }
  if (!anyLegacy) return false;

  // 组装写新（先写后可删旧：新文件就位后旧文件才允许清）
  await adapter.write(storePath, JSON.stringify(store));
  for (const name of LEGACY_FILES) {
    const legacyPath = storeDir() + '/' + name;
    try {
      if (hasFn(adapter, 'remove')) await adapter.remove(legacyPath);
    } catch {
      /* 删除失败不阻断（残留旧文件下次不再迁移——新文件已在） */
    }
  }

  // vec 改名（rename 不可用/失败 → 读改写删兜底）
  const legacyVec = storeDir() + '/' + LEGACY_VEC;
  try {
    const vecExists = hasFn(adapter, 'exists') ? await adapter.exists(legacyVec) : false;
    if (vecExists) {
      const newVec = getSecondBrainVecPath();
      let renamed = false;
      try {
        if (hasFn(adapter, 'rename')) {
          await adapter.rename(legacyVec, newVec);
          renamed = true;
        }
      } catch {
        renamed = false;
      }
      if (!renamed && hasFn(adapter, 'readBinary') && hasFn(adapter, 'writeBinary')) {
        const buf = await adapter.readBinary(legacyVec);
        await adapter.writeBinary(newVec, buf);
        try {
          if (hasFn(adapter, 'remove')) await adapter.remove(legacyVec);
        } catch {
          /* 残留旧 vec 不影响新文件 */
        }
      }
    }
  } catch {
    /* vec 迁移失败不影响 JSON 迁移（下次 load 幂等重试） */
  }
  return true;
}

// ---------------- 串行写链（读改写原子化，防并发交错覆盖） ----------------

let chain: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** 读取 app：优先显式传入（vector-store 构造持有），否则全局（data.ts/jsonStore 模式） */
function resolveApp(app?: any): any {
  return app ?? getApp();
}

// ---------------- Syncthing 冲突自愈（ticket 152） ----------------

/** 冲突 JSON 文件名判断（syncthing 命名：secondbrain.sync-conflict-<时间戳>-<设备ID>.json） */
function isConflictJsonName(name: string): boolean {
  return /^secondbrain\.sync-conflict-.*\.json$/.test(name);
}

/** 冲突 vec 文件名判断（同命名规则，扩展名 .vec） */
function isConflictVecName(name: string): boolean {
  return /^secondbrain\.sync-conflict-.*\.vec$/.test(name);
}

/** JSON 段级 merge：冲突 store 并入主 store（union 语义，各段规则见 issues/152）。
 *  纯函数：不改入参，返回合并后的新 store。 */
export function mergeStoreWithConflict(primary: SecondBrainStore, conflict: SecondBrainStore): SecondBrainStore {
  // meta：顶层 version/_dim 取主；notes 键并集，同 key 取 mtime 大者（相等取主）
  const priMeta = primary.meta && typeof primary.meta === 'object' ? (primary.meta as Record<string, any>) : {};
  const confMeta = conflict.meta && typeof conflict.meta === 'object' ? (conflict.meta as Record<string, any>) : {};
  const notes = { ...(priMeta.notes || {}) };
  for (const [path, confNote] of Object.entries((confMeta.notes as Record<string, any>) || {})) {
    const priNote = (priMeta.notes as Record<string, any>)?.[path];
    if (!priNote || ((confNote as any).mtime ?? 0) > ((priNote as any).mtime ?? 0)) {
      notes[path] = confNote;
    }
  }
  const meta = { ...priMeta, notes };

  // panel：取 generatedAt 大者（null 视为旧）
  let panel = primary.panel;
  if (conflict.panel && (!panel || conflict.panel.generatedAt > panel.generatedAt)) panel = conflict.panel;

  // link.queue：按 path 去重并集（主序在前，冲突新增尾插）
  const queue = [...primary.link.queue];
  const seen = new Set(queue.map((q) => q.path));
  for (const q of conflict.link.queue) {
    if (!seen.has(q.path)) {
      seen.add(q.path);
      queue.push(q);
    }
  }
  // link.state：键并集；同 path 取 linkedAt 大者（无则保主）
  const state = { ...primary.link.state };
  for (const [path, s] of Object.entries(conflict.link.state)) {
    const cur = state[path];
    if (!cur || (s.linkedAt && (!cur.linkedAt || s.linkedAt > cur.linkedAt))) state[path] = s;
  }

  // chatHistory：按 role+content 去重并集（主序在前），超上限截断最旧
  const histSeen = new Set(primary.chatHistory.map((e) => e.role + '\u0000' + e.content));
  const chatHistory = [...primary.chatHistory];
  for (const e of conflict.chatHistory) {
    const key = e.role + '\u0000' + e.content;
    if (!histSeen.has(key)) {
      histSeen.add(key);
      chatHistory.push(e);
    }
  }
  const chatTrimmed = chatHistory.slice(-CHAT_HISTORY_LIMIT);

  return { version: primary.version, meta, panel, link: { queue, state }, chatHistory: chatTrimmed };
}

/** meta.notes 键序 → 行偏移表（{offset, count}；布局不变式：行序 = 键序 × 各篇 chunks 数） */
function buildRowOffsets(meta: Record<string, any> | null | undefined): Map<string, { offset: number; count: number }> {
  const map = new Map<string, { offset: number; count: number }>();
  const notes = (meta?.notes || {}) as Record<string, any>;
  let offset = 0;
  for (const [path, entry] of Object.entries(notes)) {
    const count = Array.isArray(entry?.chunks) ? entry.chunks.length : 0;
    map.set(path, { offset, count });
    offset += count;
  }
  return map;
}

/** 合并后 meta 需要的向量行数（断言行序对齐用） */
function requiredRows(meta: Record<string, any> | null | undefined): number {
  const notes = (meta?.notes || {}) as Record<string, any>;
  let n = 0;
  for (const entry of Object.values(notes)) n += Array.isArray(entry?.chunks) ? entry.chunks.length : 0;
  return n;
}

/** 读 .vec：Uint8Array 全量（dim 头 + payload）；不可读 → null */
async function readVecBytes(adapter: any, path: string): Promise<Uint8Array | null> {
  try {
    if (typeof adapter?.readBinary !== 'function') return null;
    const buf = await adapter.readBinary(path);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * 按合并后 meta 键序行级重排 .vec：每 path 取「mtime 大者侧」的向量行段拷贝进输出。
 * primaryPair/conflictPair 各为 {meta, vecBytes}——conflict 侧 meta 必须来自同批冲突
 * （Syncthing 对 secondbrain.json/.vec 同刻生成的冲突副本，行序 = 各自 meta 键序）。
 * @returns {data, complete} complete=false = 存在任意 path 两侧都取不到行（需兜底重建）
 */
function mergeVecByMeta(
  primaryMeta: Record<string, any> | null,
  primaryVec: Uint8Array | null,
  conflictMeta: Record<string, any> | null,
  conflictVec: Uint8Array | null,
  mergedMeta: Record<string, any> | null
): { data: Uint8Array; complete: boolean } | null {
  const parseVec = (v: Uint8Array | null): { dim: number; payload: Uint8Array } | null => {
    if (!v || v.length < 4) return null;
    const dim = new DataView(v.buffer, v.byteOffset, 4).getUint32(0, true);
    if (!dim || dim > 100000) return null;
    return { dim, payload: v.slice(4) };
  };
  const pv = parseVec(primaryVec);
  const cv = parseVec(conflictVec);
  const dim = pv?.dim || cv?.dim;
  if (!dim) return null;
  if (pv && cv && pv.dim !== cv.dim) return null; // 维度不一致 → 无法合并（走兜底重建）

  const priOff = buildRowOffsets(primaryMeta);
  const confOff = buildRowOffsets(conflictMeta);
  const need = requiredRows(mergedMeta);
  const out = new Float32Array(need * dim);
  let outIdx = 0;
  let complete = true;

  // 该 path 从指定侧拷贝 count 行的辅助；成功 true
  const copyFrom = (src: Uint8Array | null | undefined, offset: number | undefined, count: number, outIdx: number): boolean => {
    if (!src || offset === undefined) return false;
    const srcStart = offset * dim * 4;
    const srcLen = count * dim * 4;
    if (srcStart + srcLen > src.length) return false;
    const row = new Float32Array(src.buffer, src.byteOffset + srcStart, count * dim);
    out.set(row, outIdx);
    return true;
  };

  for (const [path, entry] of Object.entries(((mergedMeta?.notes || {}) as Record<string, any>))) {
    const count = Array.isArray(entry?.chunks) ? entry.chunks.length : 0;
    const outStart = outIdx;
    if (count > 0) {
      const priEntry = ((primaryMeta?.notes || {}) as Record<string, any>)[path];
      const confEntry = ((conflictMeta?.notes || {}) as Record<string, any>)[path];
      // 权威侧：mtime 大者；仅一测有则用该侧
      if (!confEntry || (priEntry && ((priEntry as any).mtime ?? 0) >= ((confEntry as any).mtime ?? 0))) {
        if (!copyFrom(pv?.payload, priOff.get(path)?.offset, count, outStart)) complete = false;
      } else {
        if (!copyFrom(cv?.payload, confOff.get(path)?.offset, count, outStart)) complete = false;
      }
    }
    outIdx += count * dim;
  }

  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, dim, true);
  const payload = new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  const data = new Uint8Array(4 + payload.byteLength);
  data.set(header, 0);
  data.set(payload, 4);
  return { data, complete };
}

/** 冲突 .vec 兜底：删除全部相关向量文件，下次 refresh 触发 indexIncomplete 全量重建（ticket 107 元数据仍在，数据不丢） */
async function nukeVectorsForRebuild(a: any, conflictVecNames: string[]): Promise<void> {
  const adapter = a?.vault?.adapter;
  if (!adapter) return;
  const vecPath = getSecondBrainVecPath();
  try {
    await adapter.remove(vecPath);
  } catch {
    /* 忽略 */
  }
  for (const n of conflictVecNames) {
    try {
      await adapter.remove(n);
    } catch {
      /* 忽略 */
    }
  }
}

/**
 * 冲突 .vec 处理（meta 合并后执行；merged.meta.notes 为权威）：
 * - meta.notes 未变（冲突仅 link/panel/chatHistory）→ 主 .vec 权威，仅删冲突 .vec；
 * - meta 变了 → 逐个与同批冲突 meta 行级重排合并；无同批 meta/重排不完整/维度不符
 *   → 兜底删向量触发全量重建（ticket 107 indexIncomplete 自愈）。
 */
async function reconcileVecConflicts(
  a: any,
  primaryMeta: Record<string, any> | null,
  merged: SecondBrainStore,
  conflictVecNames: string[],
  conflictMetas: (Record<string, any> | null)[]
): Promise<void> {
  const adapter = a?.vault?.adapter;
  if (!adapter || !conflictVecNames.length) return;
  const vecPath = getSecondBrainVecPath();
  const notesUnchanged =
    JSON.stringify(primaryMeta?.notes ?? null) === JSON.stringify(merged.meta?.notes ?? null);
  if (notesUnchanged) {
    for (const name of conflictVecNames) {
      try {
        await adapter.remove(name);
      } catch {
        /* 删除失败不阻断 */
      }
    }
    return;
  }

  const primaryVec = await readVecBytes(adapter, vecPath);
  // 逐个冲突 .vec 与主合并（每次输出作为下一次主）
  let curVec = primaryVec;
  for (let i = 0; i < conflictVecNames.length; i++) {
    const name = conflictVecNames[i];
    const conflictVec = await readVecBytes(adapter, name);
    if (!conflictVec) continue;
    const confMeta = conflictMetas[i] ?? null;
    const result = mergeVecByMeta(primaryMeta, curVec, confMeta, conflictVec, merged.meta as Record<string, any>);
    if (!result || !result.complete) {
      // 无法合并（无同批 meta / 维度不符 / 行不足）→ 兜底重建（元数据仍在，数据不丢）
      await nukeVectorsForRebuild(a, conflictVecNames);
      console.warn('[secondbrain] 冲突 .vec 无法安全合并，已清空向量文件——下次 refresh 全量重建（ticket 107 自愈）');
      return;
    }
    curVec = result.data;
  }
  // 重排完成且完整：写回主 .vec（写前比对，沿用止血语义）
  const pri = await readVecBytes(adapter, vecPath);
  if (!bytesEqual(pri ?? new Uint8Array(0), curVec!)) {
    try {
      await adapter.writeBinary(vecPath, curVec!.buffer as ArrayBuffer);
    } catch {
      /* 写失败保留原文件 */
    }
  }
  for (const name of conflictVecNames) {
    try {
      await adapter.remove(name);
    } catch {
      /* 删除失败不阻断 */
    }
  }
}

/**
 * Syncthing 冲突自愈（ticket 152）：扫描 storageDir 下冲突文件 → JSON 段级 union 合并回主文件 →
 * .vec 行级重排合并 → 删除冲突文件。无冲突文件 → 零行为（一次 adapter.list）。
 * 返回合并后的 store（可能被 JSON 冲突修改；mutateStore 必须基于合并后结构继续，避免旧结构覆盖）。
 */
async function reconcileConflicts(a: any, store: SecondBrainStore): Promise<SecondBrainStore> {
  const adapter = a?.vault?.adapter;
  if (!adapter || typeof adapter.list !== 'function') return store;
  let listed: string[] = [];
  try {
    const r = await adapter.list(storeDir());
    listed = Array.isArray(r?.files) ? r.files : [];
  } catch {
    return store;
  }
  const conflictJson = listed.filter((f) => isConflictJsonName(f.split('/').pop() || f));
  const conflictVec = listed.filter((f) => isConflictVecName(f.split('/').pop() || f));
  if (!conflictJson.length && !conflictVec.length) return store;

  const primaryMeta = store.meta as Record<string, any> | null;
  // 同批冲突 meta 收集：与冲突 .vec 按列表顺序配对（Syncthing 同刻生成 json+vec 冲突副本）
  const conflictMetas: (Record<string, any> | null)[] = [];
  let merged = store;
  let jsonMerged = false;
  for (const name of conflictJson) {
    try {
      const text = await adapter.read(name);
      const conflict = normalizeStore(JSON.parse(text));
      conflictMetas.push((conflict.meta as Record<string, any>) || null);
      merged = mergeStoreWithConflict(merged, conflict);
      jsonMerged = true;
    } catch {
      // 损坏冲突 JSON：不可合并；保留文件待人工处置（不删），console 留痕
      console.warn('[secondbrain] 冲突 JSON 解析失败，保留待人工处理: ' + name);
      conflictMetas.push(null);
    }
  }
  if (jsonMerged) {
    await saveStoreRaw(merged, a); // 合并后写回主文件（内容必然变化，照写）
    for (const name of conflictJson) {
      try {
        await adapter.remove(name);
      } catch {
        /* 删除失败不阻断 */
      }
    }
  }
  if (conflictVec.length) await reconcileVecConflicts(a, primaryMeta, merged, conflictVec, conflictMetas);
  return merged;
}

/** 读整文件（迁移在此保护内，不经链的直接读）。存在 → parse + 校验；损坏 → 留档重建空；不存在/无旧文件 → 空结构不落盘 */
async function readStoreRawInner(app?: any): Promise<SecondBrainStore> {
  const a = resolveApp(app) as any;
  const adapter = a?.vault?.adapter;
  if (!adapter) return emptyStore();
  const storePath = getSecondBrainStorePath();
  let text: string | null = null;
  let exists = false;
  try {
    if (hasFn(adapter, 'exists')) exists = await adapter.exists(storePath);
    else exists = true; // 无 exists 能力：直接尝试读
  } catch {
    exists = false;
  }
  if (!exists) {
    const migrated = await migrateLegacy(a);
    // 迁移后重读；仍未生成（无旧数据）→ 空结构不落盘
    if (migrated) {
      try {
        text = await adapter.read(storePath);
      } catch {
        text = null;
      }
    }
    if (typeof text !== 'string') return emptyStore();
    try {
      return normalizeStore(JSON.parse(text)); // 迁移后读回同样要走 parse
    } catch {
      return emptyStore(); // 迁移产物损坏（极端）：按空库兜底
    }
  }
  try {
    text = await adapter.read(storePath);
  } catch {
    return emptyStore();
  }
  if (typeof text !== 'string') return emptyStore();
  try {
    return normalizeStore(JSON.parse(text));
  } catch {
    // 损坏：改名留档后重建空结构（jsonStore 同款容错）
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    try {
      if (hasFn(adapter, 'rename')) await adapter.rename(storePath, storePath + '.corrupt-' + stamp);
    } catch {
      /* 留档失败按空库处理 */
    }
    return emptyStore();
  }
}

/** 读整文件 + 冲突自愈（ticket 152）：内部读取完成后扫描冲突文件并合并，返回合并后的稳定结构 */
async function readStoreRaw(app?: any): Promise<SecondBrainStore> {
  const a = resolveApp(app) as any;
  const store = await readStoreRawInner(a);
  return reconcileConflicts(a, store);
}

/** 写回整文件（仅经串行链调用；外部不许直接落盘以免交错）。
 *  Syncthing 冲突止血（用户拍板 2026-08-29）：写前比对盘上现读内容，没变就跳过——
 *  mutateStore 的 no-op 变更（重复入队等）不再刷 mtime 制造多设备冲突窗口。 */
async function saveStoreRaw(data: SecondBrainStore, app?: any): Promise<void> {
  const a = resolveApp(app) as any;
  const adapter = a?.vault?.adapter;
  if (!adapter) return;
  const next = JSON.stringify(data);
  try {
    if (typeof adapter.read === 'function' && (await adapter.read(getSecondBrainStorePath())) === next) return;
  } catch {
    /* 文件不存在/读失败 → 照写 */
  }
  await adapter.write(getSecondBrainStorePath(), next);
}

/** 对外读：经串行链排队（与写互斥，读到稳定态）。app 可显式传入（vector-store 构造持有） */
export async function loadStore(app?: any): Promise<SecondBrainStore> {
  return enqueue(() => readStoreRaw(app));
}

/**
 * 对外写：串行链上 读 → fn(store) → 全量写回。
 * 所有写方（meta/panel/queue/state）共用同一入口，杜绝并发交错覆盖。
 * app 可显式传入（vector-store 构造持有；queue/state 走全局 getApp）。
 */
export async function mutateStore(fn: (store: SecondBrainStore) => void, app?: any): Promise<void> {
  await enqueue(async () => {
    const store = await readStoreRaw(app);
    fn(store);
    await saveStoreRaw(store, app);
  });
}

// ---------------- chatHistory 段读写（ticket 141 加法扩展） ----------------

/** 读 AI 对话历史（ticket 141）：经串行链；旧数据无段 / 空库 → [] */
export async function loadChatHistory(app?: any): Promise<ChatHistoryEntry[]> {
  return (await loadStore(app)).chatHistory;
}

/**
 * 追加对话条目并写盘（ticket 141）：每轮问答（含 AI 回复完成/中止后）由 ChatPanel 调用；
 * 超出 CHAT_HISTORY_LIMIT 截断最旧；返回截断后的全量历史。
 */
export async function appendChatHistory(
  entries: ChatHistoryEntry | ChatHistoryEntry[],
  app?: any
): Promise<ChatHistoryEntry[]> {
  const list = Array.isArray(entries) ? entries : [entries];
  let result: ChatHistoryEntry[] = [];
  await mutateStore((s) => {
    s.chatHistory = [...s.chatHistory, ...list].slice(-CHAT_HISTORY_LIMIT);
    result = s.chatHistory;
  }, app);
  return result;
}

/** 清空 AI 对话历史并写盘（ticket 141，「清空对话」入口确认后调用） */
export async function clearChatHistory(app?: any): Promise<void> {
  await mutateStore((s) => {
    s.chatHistory = [];
  }, app);
}