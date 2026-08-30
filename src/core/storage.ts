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
      // 并发降级（P1-31）：read 首建空文件抢先 → 对最新句柄 modify，数据不丢
      const cur = app.vault.getAbstractFileByPath(filePath);
      if (!cur) throw new Error('storage: create 竞态降级失败（' + filePath + '）');
      await app.vault.modify(cur as any, c);
    },
  };
}
