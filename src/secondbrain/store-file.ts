/**
 * 第二大脑共享数据文件层（ticket 120 数据整合）
 * - 单文件 secondbrain.json 承载三段 JSON：meta（索引元数据）/ panel（AI 概括缓存）/ link（双链队列+基准哈希）；
 *   向量二进制独立 secondbrain.vec（原 secondbrain_vectors.vec 改名，ticket 120）。
 * - loadStore：读整文件 → parse → 段结构校验；损坏 → 留档 .corrupt- 重建空结构（jsonStore 同款容错）；
 *   首次调用触发一次性迁移（四旧 JSON + 旧 vec → 组装/改名 → 删旧；幂等：新文件存在即跳过）；
 *   新文件不存在且无旧文件 → 返回空结构**不落盘**（保持原「空库不产生文件」语义，refresh 才首建）。
 * - 串行写链：所有读写（含迁移）经模块级 promise 链排队，杜绝并发交错覆盖——
 *   loadStore/mutateStore 对外，内部共用 readStoreRaw（迁移也在此保护内），写经 saveStoreRaw 直接落盘。
 * - 纯数据层（无 DOM / 无 notice 依赖），node 环境可测；依赖 getApp()（同 data.ts/jsonStore 模式）。
 */
import { getApp } from '../core/app';
import { tryGetSettings } from '../core/settings-provider';

/** 单文件结构版本（ticket 120 首版） */
export const STORE_VERSION = 1;

/** link 段：双链队列 + 正文基准哈希（原 secondbrain_link_queue.json / secondbrain_link_state.json） */
export interface LinkStoreSection {
  queue: Array<{ path: string; hash?: string; queuedAt?: string }>;
  state: Record<string, { hash: string; linkedAt: string }>;
}

/** 单文件整体结构（v1） */
export interface SecondBrainStore {
  version: number;
  meta: Record<string, unknown> | null;
  panel: { summary: string; generatedAt: number } | null;
  link: LinkStoreSection;
}

/** storagePath 唯一目录口径（ADR-0009 延续；同 config.ts） */
function storeDir(): string {
  const s = tryGetSettings() as any;
  return (
    String(s.storagePath ?? '')
      .trim()
      .replace(/\/+$/, '') || 'CONFIG/STORAGE'
  );
}

/** 单文件 JSON 路径（ticket 120：全部 JSON 数据一个文件） */
export function getSecondBrainStorePath(): string {
  return storeDir() + '/secondbrain.json';
}

/** 向量二进制路径（ticket 120：原 secondbrain_vectors.vec 改名） */
export function getSecondBrainVecPath(): string {
  return storeDir() + '/secondbrain.vec';
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
  return { version: STORE_VERSION, meta: null, panel: null, link: { queue: [], state: {} } };
}

/** 段结构校验：容忍旧写错 / 缺段（queue 非数组→[]；state 非对象→{}；panel/meta 缺省 null/{}） */
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

/** 读整文件（迁移在此保护内，不经链的直接读）。存在 → parse + 校验；损坏 → 留档重建空；不存在/无旧文件 → 空结构不落盘 */
async function readStoreRaw(app?: any): Promise<SecondBrainStore> {
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

/** 写回整文件（仅经串行链调用；外部不许直接落盘以免交错） */
async function saveStoreRaw(data: SecondBrainStore, app?: any): Promise<void> {
  const a = resolveApp(app) as any;
  const adapter = a?.vault?.adapter;
  if (!adapter) return;
  await adapter.write(getSecondBrainStorePath(), JSON.stringify(data));
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