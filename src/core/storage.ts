/**
 * 统一 JSON 数据读写层（统一数据读写重构）
 *
 * 语义统一为 jsonStore 现状（P1-31 并发首建竞态 / P1-32 损坏留档，语义保留、留档位置升级为 D1 契约）：
 *  - read：不存在 → 建目录建初始值文件（默认 []）；解析失败 → 原文件原样留档 CONFIG/.CORRUPT/<名>.<yyyymmdd-hhmmss>.bak 后重建初始值；
 *    索引看不见但盘上在（启动扫描滞后窗口）→ adapter 直读，绝不拿默认值顶替
 *  - write：存在 modify / 不存在 create（目录索引看不见但盘上在就不建）；并发首建竞态（create 撞「已存在」）降级为重读/modify，
 *    索引滞后时降级为 adapter 直写，数据不丢；写失败先把盘上原内容留档再照抛原错误
 *
 * D1 可靠写契约（三原语，全部域数据层统一走；D2/D3 迁移依据，词条见 CONTEXT.md「可靠写契约」）：
 *  1. enqueueFileTask(path, task)——同文件「读→改→写」任务 FIFO 串行（消灭并发互相覆盖）、异文件并行；
 *     任务抛错只上抛该调用方，不堵后续队列。队列不可重入：enqueueFileTask 任务内勿对同路径再调原语 2（死锁）。
 *  2. updateFileSections(path, writer) / mergeWriteSections(path, set)——段级合并写（news
 *     writeNewsDataMerged 先例上沉）：串行队列内读磁盘现值，writer 只产出「本次声明的改动段」，未声明段
 *     保留磁盘现值合并写回，双写者（插件与守护进程/其他写方）各写各段互不覆盖；对象形态 JSON 专用
 *     （数组/标量/null 抛错，域须先归一形态，如 news 的 wrapArrayToNewsData）；updateFileSections 返回
 *     合并后完整对象，mergeWriteSections 为声明式糖。
 *  3. 冲突留档——解析失败或写失败先把原文件原样留档到 CONFIG/.CORRUPT/<名>.<yyyymmdd-hhmmss>.bak
 *     （目录不存在则建，同秒撞名加 -N 序号），再走降级初始化/照抛原错误，永不静默丢数据；留档成功发
 *     人话化 warning 通知（同文件 30s 去重；域传 onCorrupt 自管损坏文案时不重复弹——铁律 1 冻结文案）；
 *     留档失败不阻塞原流程。onCorrupt 返回 false 的「不清盘」语义不变（不留档、不重建，read 返回 null）。
 *
 * 扩展（相对 jsonStore）：
 *  - defaultValue：缺失/损坏时落盘的初始值（默认 []；允许对象，如 quiz 的 {notes:{}}）。传函数则每次读取求值
 *  - writeIfChanged：写前读盘比对，字节级相同跳过写（Syncthing 冲突止血——smartcat/secondbrain 既有能力下沉，默认关）
 *  - onCorrupt：损坏留档重建后回调（域可保留既有 notice 文案——铁律 1 冻结文案）
 *
 * 路径 helper（storageDir/storageFile）收敛全仓 storagePath 解析的多种写法：
 *  - storageFile(name, base) 的 base 供目录类工具函数使用，清理逻辑集中此处。
 *  - 误配 .json 尾段剥除（旧设置可能存了完整文件路径）由 normalizeStorageDir 单源提供
 *    （深审 ARCH-2 双轨收敛：原 favorites/config getStorageDir 私有防御上沉，favorites 两口
 *    自此为 @deprecated 兼容转发，全库单一解析口径）。
 */
import { getApp } from './app';
import { tryGetSettings } from './settings-provider';
import { notify } from './notice';
import { pluginRelDirOf } from './plugin-path';
import { DEFAULT_STORAGE_DIR, initialStorageDir, normalizeStorageDir } from './storage-path';

/**
 * 路径口径的实现在 core/storage-path.ts（零依赖，值守进程共用）—— 这里只做转发，
 * 免得全仓两处各写一遍「缺省目录是什么、误配成 .json 要剥尾段」。
 */
export { DEFAULT_STORAGE_DIR, initialStorageDir, normalizeStorageDir };

/** 共享数据目录（settings.storagePath 经 normalizeStorageDir 归一，全域单一口径） */
export function storageDir(): string {
  const s = tryGetSettings() as any;
  return normalizeStorageDir(s && s.storagePath);
}

/**
 * 数据目录初值（2026-10-29：缺省 = <插件目录>/storage，小写）。
 *
 * **只在 data.json 里还没有值时写一次**，此后它就是普通设置项 —— 用户改过就听用户的。
 * 已经有值的库一律不碰：哪怕值是插件早期自己写进去的老 CONFIG/STORAGE，那也是库里数据
 * 的实际位置，改它等于搬家（老用户升级过来不受这个缺省值影响）。
 *
 * 判据：
 *  1. 已有 storagePath → 什么都不做（哪怕值正好是老的 CONFIG/STORAGE）；
 *  2. 盘上已有 <插件目录>/storage → 认它（清过一次 data.json 的库照旧接回原处）；
 *  3. 都没有 → 新库，写 <插件目录>/storage（目录本身等首次落盘／引导探针时再建）。
 *
 * 不再「盘上有老 CONFIG/STORAGE 就认领」：那会让 CONFIG 目录在界面上继续出现，
 * 而用户要的是它彻底退场。没有 storagePath 就是没设过，一律落到新缺省。
 *
 * 为什么不把「缺省」做成现算：归一函数要在没有 app 的地方被调用（值守进程、纯函数单测），
 * 兜底必须是常量；而「数据住哪」这件事必须落成一个看得见、改得动、值守也读得到的值。
 *
 * @returns 是否写了新值（调用方据此调度落盘）
 */
export async function bootstrapStorageDir(app: any, settings: { storagePath?: string } | null | undefined): Promise<boolean> {
  if (!settings) return false;
  if (String(settings.storagePath || '').trim()) return false;
  settings.storagePath = initialStorageDir(pluginRelDirOf(app));
  return true;
}

/** 共享数据文件路径（base 可覆盖 storagePath——旧字段兜底域用 storagePath||xxxPath） */
export function storageFile(name: string, base?: string): string {
  const dir = (base || storageDir()).trim().replace(/\/+$/, '');
  return `${dir}/${name}`;
}


/**
 * 加密密文根目录（保险库 encrypt 与密码本 password-vault 共用的同一个库）：
 * 固定 = `<数据存储路径>/.ENCRYPT` —— 2026-09-26 拍板「统一放进数据存储路径，不给用户单独配」，
 * 原 `encryptRoot` 设置键与面板行一并退役（点前缀目录 Obsidian 侧栏不可见，防误删；
 * 与数据目录同盘，也就不用再解释「密文为什么不跟着数据目录走」）。全域唯一解析口径，勿在域内自算。
 */
export function encryptDir(): string {
  return `${storageDir()}/.ENCRYPT`;
}

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

/**
 * 同路径读改写事务串行队列（模块级）。
 * jsonFileStore 本身无锁：同一文件被多个 store 实例（如 memo UI 的 DataManager 与 memo UI 的
 * MemoData，同写 memo.json）并发「读→改→写」时，后写者会用陈旧基线覆盖先写者（丢写）。
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

/**
 * 盘上存在性（绕过索引）。Obsidian 的 create/createFolder 判重问的是 adapter.exists（磁盘）而非
 * 索引；桌面端启动时 adapter.watch 先挂监视、listAll() 异步排队全量扫描，插件 onload 跑在扫描
 * 完成之前 —— 此窗口内盘上已有的文件/目录在索引里查不到，判「存在」必须盘上也算数
 * （2026-10-04「Folder already exists.」炸 onload 的根因；dock loadDockStore 的种子判定同用）。
 */
export async function diskPathExists(app: any, p: string): Promise<boolean> {
  try {
    return !!(await app.vault?.adapter?.exists?.(p));
  } catch {
    return false; // adapter 不支持/查询失败：退回只信索引（调用方按「不存在」走原路）
  }
}

/**
 * 盘上只读直读（绕过索引）。点前缀目录（缺省数据目录 `.obsidian/plugins/<插件>/storage`、
 * `CONFIG/.CORRUPT`、`.ENCRYPT`）**不在 vault 索引里**，`getAbstractFileByPath` 恒 null；
 * 判断数据文件「在不在、是什么」一律问 adapter，不要问索引。
 * 缺失/读失败 → null（调用方按「没有」走原路）。
 */
export async function diskReadText(app: any, p: string): Promise<string | null> {
  try {
    return await app.vault.adapter.read(p);
  } catch {
    return null;
  }
}

/**
 * 盘上 stat（绕过索引）。mtime/size 取不到（文件不存在/适配器不支持）→ null。
 * 用途：缓存指纹、轮询变更探测、体积统计——这些数据文件同样落在点前缀目录里。
 */
export async function diskPathStat(app: any, p: string): Promise<{ mtime?: number; size?: number } | null> {
  try {
    return (await app.vault?.adapter?.stat?.(p)) ?? null;
  } catch {
    return null;
  }
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
 * 导出（D3）：供自带串行链的域（secondbrain store-file 等）复用同一留档契约，
 * 损坏/写失败现场统一落 CONFIG/.CORRUPT，不再各域自造留档格式。
 */
export async function backupOriginal(app: any, filePath: string, raw?: string): Promise<string | null> {
  try {
    // 原文一律问盘：点前缀数据目录（缺省 `<插件目录>/storage`）不在 vault 索引里，
    // getAbstractFileByPath 取不到文件对象 → 留档会被静默跳过（坏文件现场就丢了）
    const content = raw !== undefined ? raw : await diskReadText(app, filePath);
    if (content === undefined || content === null) return null;
    // 留档目录 CONFIG/.CORRUPT 含点段，同样不在索引里 —— 判存在只能问盘
    if (!(await diskPathExists(app, CORRUPT_BACKUP_DIR))) {
      try {
        await app.vault.createFolder(CORRUPT_BACKUP_DIR);
      } catch { /* 并发建目录竞态：已建则继续；真建不了由下方写盘报错走 null */ }
    }
    const base = baseNameOf(filePath);
    const stamp = corruptStamp();
    let backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}.bak`;
    for (let i = 2; await diskPathExists(app, backupPath); i++) {
      backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}-${i}.bak`;
    }
    await app.vault.adapter.write(backupPath, content);
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

/** 盘上直读（索引滞后时 fileMap 查不到 TFile 只能走 adapter；对齐 vault.read 剥 BOM） */
async function readFromDisk(app: any, filePath: string): Promise<string> {
  const raw = (await app.vault.adapter.read(filePath)) as string;
  return raw.charCodeAt(0) === 65279 ? raw.substring(1) : raw;
}

export function jsonFileStore<T>(filePath: string, opts: JsonFileStoreOptions<T> = {}): JsonFileStore<T> {
  /** app 解析：注入优先，回退模块级 getApp()（域传 app 参数时显式注入） */
  const resolveApp = () => opts.app || getApp();
  const resolveDefault = (): T => {
    const d = opts.defaultValue;
    return typeof d === 'function' ? (d as () => T)() : d === undefined ? ([] as unknown as T) : d;
  };

  /**
   * 首建前确保父目录存在。判据 = 索引**或盘上**任一在就不建：Obsidian 的 createFolder 判重问的
   * 是 adapter.exists（磁盘），启动扫描未完成的窗口内索引查不到盘上已有的目录，只问索引必撞
   * 「Folder already exists.」炸整条读链（2026-10-04 onload 事故）。
   */
  async function ensureDir(app: any): Promise<void> {
    const d = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!d || app.vault.getAbstractFileByPath(d)) return;
    if (await diskPathExists(app, d)) return;
    try {
      await app.vault.createFolder(d);
    } catch (e) {
      if (await diskPathExists(app, d)) return; // 并发建目录竞态：已建则继续，真建不了才上抛
      throw e;
    }
  }

  /**
   * 容错首建：create 成功返回 true；撞「已存在」且文件确已出现（并发首建竞态，P1-31）返回
   * false 由调用方降级为重读/modify；「已出现」索引**或盘上**任一算数（判据与 Obsidian create
   * 的磁盘判重同口径）；其余错误照抛。
   */
  async function createIfMissing(app: any, content: string): Promise<boolean> {
    await ensureDir(app);
    try {
      await app.vault.create(filePath, content);
      return true;
    } catch (e) {
      if (isAlreadyExistsError(e) && (app.vault.getAbstractFileByPath(filePath) || (await diskPathExists(app, filePath))))
        return false;
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
    } else if (await diskPathExists(app, filePath)) {
      // 索引滞后窗口：坏文件拿不到句柄 → adapter 直写重建（留档已完成）；
      // 不重建的话滞后期内每读一次就留一次档
      await app.vault.adapter.write(filePath, serialize(resolveDefault()));
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

  /** 原文 → 解析（损坏走留档重建），read 的索引/盘上两种读法共用 */
  async function parseRaw(app: any, raw: string): Promise<T> {
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      return (await handleCorrupt(app, e, raw)) as T;
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
        if (!f && (await diskPathExists(app, filePath))) {
          // 索引滞后（启动扫描未完成）：盘上有真数据 → adapter 直读，绝不拿默认值顶替
          return parseRaw(app, await readFromDisk(app, filePath));
        }
        if (!f) return resolveDefault();
      }
      return parseRaw(app, await app.vault.read(f as any));
    },
    async write(data) {
      const app = resolveApp();
      const c = serialize(data);
      let f = app.vault.getAbstractFileByPath(filePath);
      if (!f && (await diskPathExists(app, filePath))) {
        // 索引看不见但盘上有（点前缀数据目录 / 启动扫描窗口）→ 直接按 modify 语义 adapter 直写。
        // 不能交给 createIfMissing：vault.create 对已存在路径抛 already exists，白跑一次失败调用
        // （索引永远看不见点前缀路径，每次写都撞）。
        if (opts.writeIfChanged) {
          try {
            if ((await readFromDisk(app, filePath)) === c) return;
          } catch { /* 读盘失败照常写 */ }
        }
        try {
          await app.vault.adapter.write(filePath, c);
          return;
        } catch (e) {
          const backupPath = await backupOriginal(app, filePath);
          if (backupPath) notifyBackup(filePath, backupPath, '写入失败');
          throw e;
        }
      }
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
      if (!cur && (await diskPathExists(app, filePath))) {
        // 索引滞后（启动扫描未完成）：句柄拿不到但盘上有文件 → adapter 直写（等价 modify），
        // 否则会掉进下面「重试 create → 竞态降级失败」的假错误。写失败先留档再照抛
        // （与 modifyWithBackup 同款兜底——P2-3 不静默吞）
        try {
          if (opts.writeIfChanged) {
            try {
              if ((await readFromDisk(app, filePath)) === c) return;
            } catch { /* 读盘失败照常写 */ }
          }
          await app.vault.adapter.write(filePath, c);
          return;
        } catch (e) {
          const backupPath = await backupOriginal(app, filePath);
          if (backupPath) notifyBackup(filePath, backupPath, '写入失败');
          throw e;
        }
      }
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
