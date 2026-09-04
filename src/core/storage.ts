/**
 * 统一 JSON 数据读写层（统一数据读写重构）
 *
 * 语义统一为 jsonStore 现状（P1-31 并发首建竞态 / P1-32 损坏留档，逐字保留）：
 *  - read：不存在 → 建目录建初始值文件（默认 []）；解析失败 → 原文件改名 .corrupt-<时间戳> 留档后重建初始值
 *  - write：存在 modify / 不存在 create（建目录）；并发首建竞态（create 撞「已存在」）降级为重读/modify，数据不丢
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

  /** 损坏处理：onCorrupt 返回 false → 不清盘（保持原文件原样，read 返回 null）；否则改名留档重建初始值（P1-32 语义） */
  async function handleCorrupt(app: any, err: unknown): Promise<T | null> {
    if (opts.onCorrupt?.(filePath, err) === false) {
      return null; // 调用方选择不清盘：不 rename、不重建，原文件原样保留
    }
    let f = app.vault.getAbstractFileByPath(filePath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = filePath + '.corrupt-' + stamp;
    try {
      await app.vault.rename(f as any, backupPath);
      console.warn('[storage] ' + filePath + ' 解析失败，原内容留档至 ' + backupPath + '，已重建初始值');
    } catch (renameErr) {
      console.warn('[storage] ' + filePath + ' 留档失败（' + backupPath + '），原地重建初始值', renameErr);
    }
    const fresh = app.vault.getAbstractFileByPath(filePath);
    if (fresh) {
      await app.vault.modify(fresh as any, serialize(resolveDefault()));
    } else {
      await createIfMissing(app, serialize(resolveDefault()));
    }
    return resolveDefault();
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
      try {
        return JSON.parse(await app.vault.read(f as any)) as T;
      } catch (e) {
        return (await handleCorrupt(app, e)) as T;
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
        await app.vault.modify(f as any, c);
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
      await app.vault.modify(cur as any, c);
    },
  };
}
