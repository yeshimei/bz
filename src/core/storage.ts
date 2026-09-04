/**
 * 统一 JSON 数据读写层（统一数据读写重构）
 *
 * 语义统一为 jsonStore 现状（P1-31 并发首建竞态 / P1-32 损坏留档，语义保留、留档位置升级为 D1 契约）：
 *  - read：不存在 → 建目录建初始值文件（默认 []）；解析失败 → 原文件原样留档 CONFIG/.CORRUPT/<名>.<yyyymmdd-hhmmss>.bak 后重建初始值
 *  - write：存在 modify / 不存在 create（建目录）；并发首建竞态（create 撞「已存在」）降级为重读/modify，数据不丢；写失败先把盘上原内容留档再照抛原错误
 *
 * 扩展（相对 jsonStore）：
 *  - defaultValue：缺失/损坏时落盘的初始值（默认 []；允许对象，如 quiz 的 {notes:{}}）。传函数则每次读取求值
 *  - writeIfChanged：写前读盘比对，字节级相同跳过写（Syncthing 冲突止血——smartcat/secondbrain 既有能力下沉，默认关）
 *  - onCorrupt：损坏留档重建后回调（域可保留既有 notice 文案——铁律 1 冻结文案）
 *
 * 路径 helper（storageDir/storageFile）收敛全仓 storagePath 解析的多种写法：
 *  - storageFile(name, base) 的 base 供「旧字段兜底」域使用（如 storagePath||reviewStoragePath），清理逻辑集中此处。
 */
import { getApp } from './app';
import { tryGetSettings } from './settings-provider';
import { notify } from './notice';

export interface JsonFileStoreOptions<T> {
  /** 缺失/损坏时落盘的初始值（默认 []）。传函数则每次读取时求值（防共享引用被外部 mutate） */
  defaultValue?: T | (() => T);
  /** 写前读盘比对，字节级相同跳过写（Syncthing 止血；默认关，行为保持现状） */
  writeIfChanged?: boolean;
  /** 损坏留档重建后回调（err 为解析异常）。返回 false → 跳过留档与重建，不清盘（保持原文件原样），read 返回 null */
  onCorrupt?: (filePath: string, err: unknown) => boolean | void;
  /** 注入 vault/app（域以参数传 app 时用；缺省回退 getApp() 模块级引用） */
  app?: any;
}

export interface JsonFileStore<T> {
  read(): Promise<T>;
  write(data: T): Promise<void>;
}

/** 共享数据目录（storagePath，trim 去尾斜杠，空回退 CONFIG/STORAGE） */
export function storageDir(): string {
  const s = tryGetSettings() as any;
  return ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
}

/** 共享数据文件路径（base 可覆盖 storagePath——旧字段兜底域用 storagePath||xxxPath） */
export function storageFile(name: string, base?: string): string {
  const dir = (base || storageDir()).trim().replace(/\/+$/, '');
  return `${dir}/${name}`;
}

/**
 * 同路径读改写事务串行队列（模块级）。
 * jsonFileStore 本身无锁：同一文件被多个 store 实例（如 memo UI 的 DataManager 与 todo UI 的
 * TodoData，同写 memo.json）并发「读→改→写」时，后写者会用陈旧基线覆盖先写者（丢写）。
 * 把每个「读→改→写」整体作为 task 入队（键 = 文件路径），同类事务即互斥串行；
 * 前序任务失败不阻塞后续；队尾空闲时清理条目防 Map 无限增长。
 */
const fileTaskQueues = new Map<string, Promise<unknown>>();

export function enqueueFileTask<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const prev = fileTaskQueues.get(filePath) ?? Promise.resolve();
  const run = prev.then(task, task); // 前序成败都不阻塞本任务
  const tail = run.then(
    () => undefined,
    () => undefined
  );
  fileTaskQueues.set(filePath, tail);
  void tail.then(() => {
    if (fileTaskQueues.get(filePath) === tail) fileTaskQueues.delete(filePath);
  });
  return run;
}

// ---------- 段级合并写（D1 可靠写契约原语 2） ----------

/**
 * 断言磁盘现值为对象形态（段级合并写的适用前提）。
 * 数组/null/标量 → 抛错不写盘：把数组硬展开成对象会静默改形丢数据，宁可让调用方
 * 显式归一（news 先例：wrapArrayToNewsData 包旧数组后再走段写）；onCorrupt 返回 false
 * 的「不清盘」域读到 null 也在此抛错——不清盘语义下不应盲目段写。
 */
function assertPlainObject(filePath: string, current: unknown): Record<string, unknown> {
  if (current && typeof current === 'object' && !Array.isArray(current)) return current as Record<string, unknown>;
  const got = Array.isArray(current) ? 'array' : current === null ? 'null' : typeof current;
  throw new Error('storage: 段级合并写要求对象形态 JSON（' + filePath + ' 读到 ' + got + '），请先归一文件形态');
}

/**
 * 「读-改-段写」一步式组合（D1 可靠写契约原语 2；news writeNewsDataMerged 先例上沉）：
 * 串行队列内 读磁盘现值 → writer 基于现值产出「本次声明的改动段」→ 未声明段保留磁盘
 * 现值 → 合并写回。插件与守护进程/其他写方双写同一文件时各声明各段，互不覆盖、
 * 不再放大「读-写窗口踩踏」。
 * - 磁盘缺失 → defaultValue 基底（缺省 {}）；损坏 → 走留档 + 降级初始化（原语 3）后以默认值为基底；
 * - 磁盘现值非对象形态（数组/标量/null）→ 抛错不写盘（见 assertPlainObject）；
 * - 返回合并后的完整对象（调用方免二次读盘）。
 * 注意：本体已含同路径串行入队，勿再包一层 enqueueFileTask（队列不可重入，会死锁）。
 */
export function updateFileSections<T extends object>(
  filePath: string,
  writer: (current: T) => Partial<T> | Promise<Partial<T>>,
  opts: JsonFileStoreOptions<T> = {}
): Promise<T> {
  return enqueueFileTask(filePath, async () => {
    const store = jsonFileStore<T>(filePath, { ...opts, defaultValue: opts.defaultValue ?? ({} as T) });
    const current = assertPlainObject(filePath, await store.read());
    const set = (await writer(current as T)) || {};
    const next = { ...current, ...set } as T;
    await store.write(next);
    return next;
  });
}

/** 段级合并写（声明式糖）：mergeWriteSections(path, set) ≡ updateFileSections(path, () => set)。
 *  只声明改动段、未声明段取磁盘现值；要拿合并后完整对象请用 updateFileSections。 */
export function mergeWriteSections<T extends object>(
  filePath: string,
  set: Partial<T>,
  opts: JsonFileStoreOptions<T> = {}
): Promise<void> {
  return updateFileSections(filePath, () => set, opts).then(() => undefined);
}

/** Obsidian vault.create 对已存在路径抛错（消息含 "already exists"）——并发首建竞态判定 */
function isAlreadyExistsError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /already exist/i.test(msg);
}

// ---------- 冲突留档（D1 可靠写契约原语 3） ----------

/** 留档目录（与 CONFIG/.ENCRYPT 同级的插件保留目录）：坏文件/写失败前内容原样留档，永不静默丢数据 */
const CORRUPT_BACKUP_DIR = 'CONFIG/.CORRUPT';
/** 同文件留档通知去重窗口：短时间内重复失败只报一次（同步重试风暴不刷屏；与 notice 30s 窗口对齐） */
const CORRUPT_NOTIFY_DEDUPE_MS = 30000;
/** 文件路径 → 上次留档通知时刻 */
const corruptNotifyAt = new Map<string, number>();

/** 测试钩子：清空留档通知去重状态（跨用例隔离；不清则 30s 窗口内同文件不重复弹） */
export function __resetCorruptNotifyForTests(): void {
  corruptNotifyAt.clear();
}

/** 本地时间戳 yyyymmdd-hhmmss（留档文件名用；本地时区便于用户按失败时间翻找留档） */
function corruptStamp(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function baseNameOf(p: string): string {
  return p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p;
}

/**
 * 原样留档到 CONFIG/.CORRUPT/<原文件名>.<yyyymmdd-hhmmss>.bak（目录不存在则创建；
 * 同秒多条留档追加 -2/-3 序号防撞名）。raw 缺省时读盘取当前内容。
 * 返回留档路径；任何一步失败返回 null（留档失败不阻塞原流程——降级初始化照常走）。
 */
async function backupOriginal(app: any, filePath: string, raw?: string): Promise<string | null> {
  try {
    const f = app.vault.getAbstractFileByPath(filePath);
    if (!f) return null;
    const content = raw !== undefined ? raw : await app.vault.read(f);
    if (!app.vault.getAbstractFileByPath(CORRUPT_BACKUP_DIR)) {
      try {
        await app.vault.createFolder(CORRUPT_BACKUP_DIR);
      } catch { /* 并发建目录竞态：已建则继续；真建不了由下方 create 报错走 null */ }
    }
    const base = baseNameOf(filePath);
    const stamp = corruptStamp();
    let backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}.bak`;
    for (let i = 2; app.vault.getAbstractFileByPath(backupPath); i++) {
      backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}-${i}.bak`;
    }
    await app.vault.create(backupPath, content);
    return backupPath;
  } catch (e) {
    console.warn('[storage] ' + filePath + ' 留档失败（' + CORRUPT_BACKUP_DIR + '），继续原流程', e);
    return null;
  }
}

/**
 * 留档人话化通知（warning）：说明原内容已留档在哪、数据不会丢。
 * 同文件 CORRUPT_NOTIFY_DEDUPE_MS 内重复失败只报一次；通知失败（无 DOM 的纯数据层环境等）静默，不影响存储流程。
 * 留档与通知解耦：去重只抑制弹窗，留档文件照常逐次生成（每次失败的现场都留档）。
 */
function notifyBackup(filePath: string, backupPath: string, cause: '解析失败' | '写入失败'): void {
  const now = Date.now();
  if (now - (corruptNotifyAt.get(filePath) ?? 0) < CORRUPT_NOTIFY_DEDUPE_MS) return;
  corruptNotifyAt.set(filePath, now);
  try {
    const name = baseNameOf(filePath);
    const msg = cause === '解析失败'
      ? `数据文件 ${name} 解析失败，原内容已留档到 ${backupPath}，数据不会丢，已重建默认文件继续使用`
      : `数据文件 ${name} 写入失败，原内容已留档到 ${backupPath}，数据不会丢，请稍后重试`;
    notify(msg, { type: 'warning' });
  } catch { /* 无 DOM 环境（纯数据层 node 测试等）静默 */ }
}

function serialize(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

export function jsonFileStore<T>(filePath: string, opts: JsonFileStoreOptions<T> = {}): JsonFileStore<T> {
  /** app 解析：注入优先，回退模块级 getApp()（域传 app 参数时显式注入） */
  const resolveApp = () => opts.app || getApp();
  const resolveDefault = (): T => {
    const d = opts.defaultValue;
    return typeof d === 'function' ? (d as () => T)() : d === undefined ? ([] as unknown as T) : d;
  };

  /** 首建前确保父目录存在（目录不存在才创建，保持原行为） */
  async function ensureDir(app: any): Promise<void> {
    const d = filePath.substring(0, filePath.lastIndexOf('/'));
    if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
  }

  /**
   * 容错首建：create 成功返回 true；撞「已存在」且文件确已出现（并发首建竞态，P1-31）
   * 返回 false 由调用方降级为重读/modify；其余错误照抛。
   */
  async function createIfMissing(app: any, content: string): Promise<boolean> {
    await ensureDir(app);
    try {
      await app.vault.create(filePath, content);
      return true;
    } catch (e) {
      if (isAlreadyExistsError(e) && app.vault.getAbstractFileByPath(filePath)) return false;
      throw e;
    }
  }

  /**
   * 损坏处理（P1-32 语义 + D1 原语 3 留档位置）：onCorrupt 返回 false → 不留档不清盘
   * （原文件原样保留，read 返回 null）；否则原样留档 CONFIG/.CORRUPT → 人话通知（域传了
   * onCorrupt 则跳过——该域自管损坏文案，避免双弹）→ 原路径重建初始值（copy-then-rebuild，
   * 原路径全程不经历「消失」窗口，并发读者任一时刻都能读到完整内容）。
   */
  async function handleCorrupt(app: any, err: unknown, raw?: string): Promise<T | null> {
    if (opts.onCorrupt?.(filePath, err) === false) {
      return null; // 调用方选择不清盘：不留档、不重建，原文件原样保留
    }
    const backupPath = await backupOriginal(app, filePath, raw);
    if (backupPath && !opts.onCorrupt) notifyBackup(filePath, backupPath, '解析失败');
    const f = app.vault.getAbstractFileByPath(filePath);
    if (f) {
      await app.vault.modify(f as any, serialize(resolveDefault()));
    } else {
      await createIfMissing(app, serialize(resolveDefault()));
    }
    return resolveDefault();
  }

  /**
   * 写盘（D1 原语 3 写失败兜底）：modify 抛错前先把盘上现内容原样留档（可能已被半截写入
   * 污染），随后照抛原错误——调用方既有 P2-3 提示语义不变（不静默吞），盘上数据留档保底不丢。
   */
  async function modifyWithBackup(app: any, f: any, c: string): Promise<void> {
    try {
      await app.vault.modify(f, c);
    } catch (e) {
      const backupPath = await backupOriginal(app, filePath);
      if (backupPath) notifyBackup(filePath, backupPath, '写入失败');
      throw e;
    }
  }

  return {
    async read() {
      const app = resolveApp();
      let f = app.vault.getAbstractFileByPath(filePath);
      if (!f) {
        const created = await createIfMissing(app, serialize(resolveDefault()));
        if (created) return resolveDefault();
        // 并发降级（P1-31）：抢先写入方已建好文件 → 读取其真实内容，不用空库覆盖
        f = app.vault.getAbstractFileByPath(filePath);
        if (!f) return resolveDefault();
      }
      const raw = await app.vault.read(f as any);
      try {
        return JSON.parse(raw) as T;
      } catch (e) {
        return (await handleCorrupt(app, e, raw)) as T;
      }
    },
    async write(data) {
      const app = resolveApp();
      const c = serialize(data);
      let f = app.vault.getAbstractFileByPath(filePath);
      if (f) {
        // 写前比对（Syncthing 止血）：读盘内容与将写内容一致 → 跳过写，避免无谓的 mtime 刷新
        if (opts.writeIfChanged) {
          try {
            const cur = await app.vault.read(f as any);
            if (cur === c) return;
          } catch (e) { /* 读盘失败照常写 */ }
        }
        await modifyWithBackup(app, f, c);
        return;
      }
      const created = await createIfMissing(app, c);
      if (created) return;
      // 并发降级（P1-31）：read 首建空文件抢先 → 对最新句柄 modify，数据不丢。
      // 极低概率下文件仍不存在（目录权限/瞬时消失）→ 重试 create 一次；仍失败抛出，
      // 由调用方捕获提示（避免静默丢写入——P2-3）
      let cur = app.vault.getAbstractFileByPath(filePath);
      if (!cur) {
        const retried = await createIfMissing(app, c);
        if (retried) return;
        cur = app.vault.getAbstractFileByPath(filePath);
        if (!cur) throw new Error('storage: create 竞态降级失败（' + filePath + '）');
      }
      await modifyWithBackup(app, cur, c);
    },
  };
}
