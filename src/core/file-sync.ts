/**
 * 文件同步公共壳（issue 365 全域复用上收）：域 json 数据对库内 md 路径变更的后台同步。
 *
 * 三域（memo/clipbook/knowledge）原先各持一份逐行等价的私有骨架，本壳收编：
 *   - 生命周期：幂等 ensure / unload（unload 置位 _cancelled → 积压任务首行短路、
 *     去抖窗口内事件直接丢弃，退订全部监听后重置状态）；
 *   - 任务队列：串行 enqueue（防并发读写同一 JSON；失败 console.error + notify 去重防刷屏）；
 *   - 去抖：DEBOUNCE_DELAY（设置字符串毫秒，缺省 300）同类事件合并成批，静默期后
 *     作为单个队列任务按序回放——既削队列峰值，又保留 rename 链（A→B→C）等顺序语义；
 *   - 事件接线：rename 经域事件总线 'vault:md-renamed' 走去抖批量，delete 走
 *     'vault:md-deleted' 即时通道（obsidian-adapter 恒发、仅 md，载荷见
 *     src/core/obsidian-adapter.ts）；
 *   - 监听范围：watched folders 匹配（路径等于目录本身或位于其下），范围外放行看域
 *     引用（E22：被域数据实际引用的路径照常同步，改名移出/移入监听范围都算被引用）。
 * 域侧经 FileSyncConfig 注入：监听文件夹、读改写事务（commit）、范围外放行
 * （referencedBy）、rename/delete 纯函数与载荷构造、删除后置消费者（可选）。
 * 壳不 import 任何域；写盘策略（changed 才写 / 无条件写）留在域 commit 内；
 * 去抖时长、事件名、写盘顺序、错误处理语义与上收前各域私有副本逐字一致。
 */
import type { App } from 'obsidian';
import { stripMdExt } from './utils';
import { notify } from './notice';
import { tryGetSettings } from './settings-provider';
import { onDomainEvent } from './domain-bus';

/** rename 总线载荷（'vault:md-renamed' 通道形状） */
export interface FileSyncRenameEvent {
  oldPath: string;
  newPath: string;
}

/**
 * 域注入配置。泛型 D = 域数据形态；R = rename 同步事件形态
 * （memo 附加标题联动字段，其余域即 FileSyncRenameEvent 本形）。
 */
export interface FileSyncConfig<D, R extends FileSyncRenameEvent = FileSyncRenameEvent> {
  /** 队列任务失败的 console.error 前缀（域标签，如 '[memo-file-sync]'） */
  logTag: string;
  /** 同步失败通知文案与去重键（notify 去重防刷屏） */
  failNotice: string;
  failDedupeKey: string;
  /** 监听文件夹列表（每次事件时现取，保留域内动态设置语义） */
  watchedFolders: () => string[];
  /** 读改写事务：对域数据施加 apply；写盘策略（changed 才写 / 无条件写）由域自持 */
  commit: (apply: (data: D) => boolean) => Promise<unknown>;
  /** 范围外放行（E22）：路径是否被域数据实际引用（读失败按未引用处理） */
  referencedBy: (path: string) => Promise<boolean>;
  /** rename 总线载荷 → 域同步事件；缺省原样透传（newBasename = 新路径 basename） */
  buildRenameEvent?: (evt: FileSyncRenameEvent, newBasename: string) => R;
  /** rename 纯函数：原地改写域数据引用，返回是否有变化 */
  applyRename: (data: D, ev: R) => boolean;
  /** delete 纯函数：原地清理域数据引用，返回是否有变化 */
  applyDelete: (data: D, path: string) => boolean;
  /** 删除后置消费者（knowledge 的 source 断链摘除）：守卫命中与否都执行，域内自行预筛 */
  onMdDeleted?: (app: App, path: string) => Promise<unknown>;
}

/** 壳句柄：ensure 幂等初始化 / unload 卸载清理（域导出签名直通） */
export interface FileSyncHandle {
  ensure(app: App): void;
  unload(): void;
}

/** 创建域文件同步代理（每域一份实例：队列/去抖/订阅状态互不共享） */
export function createFileSync<D, R extends FileSyncRenameEvent = FileSyncRenameEvent>(
  config: FileSyncConfig<D, R>,
): FileSyncHandle {
  let initialized = false;
  /** 已注册订阅的退订函数集合（unload 统一调用：总线退订幂等无双清） */
  let _refs: (() => void)[] = [];
  /** 卸载标志：置位后积压任务首行短路、去抖窗口内事件直接丢弃 */
  let _cancelled = false;
  /** 待清理的去抖器（unload 时清定时器） */
  let _flushers: { cancel(): void }[] = [];

  /** 任务队列：串行执行（防并发读写同一 JSON）；失败通知（去重防刷屏）。
   *  任务执行前检查 _cancelled，卸载后积压任务首行短路。 */
  let queue: Promise<any> = Promise.resolve();
  function enqueue(task: () => Promise<any> | void) {
    queue = queue
      .then(() => {
        if (_cancelled) return;
        return task();
      })
      .catch((e) => {
        console.error(config.logTag, e);
        notify(config.failNotice, { type: 'error', dedupeKey: config.failDedupeKey });
      });
  }

  /** 去抖延迟：复用既有 DEBOUNCE_DELAY 设置（字符串毫秒，缺省 300） */
  function debounceDelay(): number {
    const s: any = tryGetSettings();
    return Number(s && s.DEBOUNCE_DELAY) || 300;
  }

  /** 同类事件合并去抖：DEBOUNCE_DELAY 窗口内同型事件收集成批，静默期后作为单个
   *  队列任务按序回放——既削队列峰值，又保留 rename 链（A→B→C）等顺序语义。 */
  function createBatchFlusher<T>(run: (batch: T[]) => Promise<void>): ((ev: T) => void) & { cancel(): void } {
    let pending: T[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      if (_cancelled) {
        pending = [];
        return;
      }
      const batch = pending;
      pending = [];
      enqueue(() => run(batch));
    };
    const push = (ev: T): void => {
      if (_cancelled) return;
      pending.push(ev);
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, debounceDelay());
    };
    return Object.assign(push, {
      cancel(): void {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        pending = [];
      },
    });
  }

  /** 监听目录范围检查：路径等于目录本身或位于其下 */
  function inFolders(path: string, folders: string[]): boolean {
    return folders.some((f) => path.startsWith(f + '/') || path === f);
  }

  function createAgent(app: App): void {
    const isMd = (file: any) => file && file.extension === 'md' && inFolders(file.path, config.watchedFolders());

    /** 总线载荷 → 现有闭包期望的伪 TFile 形状（{path, basename, extension:'md'}） */
    const pseudoFile = (path: string): any => ({
      path,
      basename: stripMdExt(path.split('/').pop() || ''),
      extension: 'md',
    });

    const buildRenameEvent = config.buildRenameEvent ?? ((evt: FileSyncRenameEvent): R => evt as R);

    const flushRenames = createBatchFlusher<R>(async (batch) => {
      // E22 判定随批走（架#3）：referencedBy 是域全量 JSON 读+解析，批量改名（整目录
      // 重命名连发 N 条事件）若逐事件判定 = 最多 2N 次全量读盘且结果全弃。收进 flush
      // 后对本批出现过的路径做「路径→判定 Promise」去重缓存（随批新建即随批清空），
      // 同一路径（如 rename 链 A→B→C 的中转名）整批只判一次。
      const refCache = new Map<string, Promise<boolean>>();
      const referencedOnce = (path: string): Promise<boolean> => {
        let p = refCache.get(path);
        if (p === undefined) {
          p = config.referencedBy(path);
          refCache.set(path, p);
        }
        return p;
      };
      for (const ev of batch) {
        // E22：范围外放行看新旧两条路径（改名移出/移入监听范围都算被引用）
        const inScope = inFolders(ev.newPath, config.watchedFolders());
        if (!(inScope || (await referencedOnce(ev.oldPath)) || (await referencedOnce(ev.newPath)))) continue;
        await config.commit((data) => config.applyRename(data, ev));
      }
    });
    _flushers.push(flushRenames);
    _refs.push(onDomainEvent<FileSyncRenameEvent>('vault:md-renamed', (evt) => {
      const file = pseudoFile(evt.newPath);
      // 候选事件直接进批（判定挪到 flush 内随批去重，架构#3）——载荷构造纯内存无 IO
      flushRenames(buildRenameEvent(evt, file.basename));
    }));

    _refs.push(onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => {
      const file = pseudoFile(evt.path);
      void (async () => {
        // E22：范围外但被域数据引用的笔记删除同样要同步
        if (isMd(file) || (await config.referencedBy(evt.path))) {
          enqueue(() => config.commit((data) => config.applyDelete(data, evt.path)));
        }
        if (config.onMdDeleted) await config.onMdDeleted(app, evt.path);
      })();
    }));
  }

  return {
    /** 幂等初始化（main.ts onLayoutReady 调用；ADR-0003 同款幂等） */
    ensure(app: App): void {
      if (initialized) return;
      initialized = true;
      _cancelled = false; // 重新启用后恢复任务受理
      createAgent(app);
    },
    /** 卸载清理：置位 _cancelled 使积压任务首行短路并丢弃去抖窗口内未回放的事件，
     *  退订全部监听（总线退订幂等，重复卸载无双清风险）后重置模块状态。 */
    unload(): void {
      _cancelled = true;
      for (const f of _flushers) {
        try {
          f.cancel();
        } catch (e) { /* 忽略 */ }
      }
      _flushers = [];
      for (const off of _refs) {
        try {
          off();
        } catch (e) { /* 忽略 */ }
      }
      _refs = [];
      initialized = false;
      queue = Promise.resolve();
    },
  };
}
