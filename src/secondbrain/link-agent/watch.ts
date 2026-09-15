/**
 * 自动关联监听器（ticket 111；ADR-0141 正名与三盒范围；ADR-0003 事件随开关注册，模式对齐 src/review/watch.ts）：
 * - vault md 创建事件（域事件总线通用兜底通道）过滤**三个盒子**（core/knowledge-boxes 单源）
 *   → 防抖聚合约 60 秒一批跑管线；
 * - v1.4（ticket 119）：vault md **修改**事件同样过滤三盒 → 防抖聚合 → 冲刷时先经
 *   基准哈希过滤（filterChangedForRelink：内容未实质变化 / 自写 related 不重跑），
 *   只对真正改动的存量笔记重跑建链（正文大改自动重跑）；
 * - 删除事件订阅 → 防抖合并触发死链清理（低频巡检 30 分钟兜底）；删除同时移除该篇基准哈希；
 * - 文献笔记建链改走**显式通道**（issue 309）：createLinkBridge 给知识盒录入面板 preview / apply / now
 *   三段能力（AI 出内容即起跑预演，面板内 loading → 完成后就地显示）。原「订阅 'knowledge:tasks'
 *   生成即跑」的被动路径已删除——它不向调用方回报进度，且与调用方写入结果无法对齐；
 * - ADR-0141 §3：「请去补白名单」类引导提示（maybeGuideAllowPaths / guideIndexCoverage）退役——
 *   三个盒子恒含索引，再没有「目录不在白名单」的场景。
 * 依赖方向：本层经 index.ts 接线；refresh 类副作用全部收敛在 LinkAgent。
 */
import type { App } from 'obsidian';
import { onDomainEvent } from '../../core/domain-bus';
import type { LinkBridge } from '../../core/link-now';
import { tryGetSettings } from '../../core/settings-provider';
import { inLinkScope } from './data';
import { LINK_BATCH_DELAY_MS, LinkAgent } from './pipeline';

/** 死链清理防抖窗口（删除事件合并；测试可注入短值） */
export let LINK_CLEAN_DEBOUNCE_MS = 5000;
export function __setLinkCleanDebounceMsForTests(ms: number): void {
  LINK_CLEAN_DEBOUNCE_MS = ms;
}

/** 低频巡检间隔（spec「核心流程⑤」：启动后低频巡检兜底） */
export const LINK_SWEEP_INTERVAL_MS = 30 * 60 * 1000;

/**
 * 自动关联通道（issue 309；ADR-0141 起归知识盒消费）：知识盒录入面板的三段能力 + 批量补链，
 * 全部**等待**结果回填面板。
 * - preview：AI 出内容后立刻跑（草稿未落盘，只算不写）→ 面板就地显示「分析中… → 关联名」；
 * - apply：确认写入落盘后，把预演结果写进该篇 related；
 * - now：无预演结果时的兜底（完整跑一遍单篇管线；force 供手动命令强制重跑用）；
 * - backfill：批量补链（三盒内缺 related 的笔记），知识盒「为未关联笔记批量补链」命令用。
 * 四者都先等索引装载完成（避免 in-flight refresh 与 load 并发读到半装载索引）；
 * 通知一律静默——进度与结果由面板自己呈现，不再叠加 toast。
 * 范围由实现侧把关（ADR-0141 §2：盒外路径返回 out-of-scope，本层不重复判定）。
 */
export function createLinkBridge(
  agent: LinkAgent,
  initialLoad?: Promise<void> | null
): LinkBridge {
  const ready = async (): Promise<void> => {
    try {
      await initialLoad;
    } catch {
      /* 装载失败不阻断（管线内部各自兜底） */
    }
  };
  return {
    now: async (path: string, opts?: { force?: boolean }) => {
      const p = String(path || '').trim();
      if (!p) return { status: 'done' as const, created: 0 };
      await ready();
      return agent.processNoteNow(p, { silent: true, force: opts?.force === true });
    },
    preview: async (content: string, title?: string, opts?: { signal?: AbortSignal }) => {
      await ready();
      return agent.previewLinks(content, title, opts);
    },
    apply: async (path: string, targetPaths: string[]) => {
      const p = String(path || '').trim();
      if (!p) return { status: 'done' as const, created: 0 };
      await ready();
      return agent.applyLinks(p, targetPaths);
    },
    backfill: async () => {
      await ready();
      const result = await agent.backfillMissingLinks();
      if (result.status === 'done') {
        return { status: 'done' as const, processed: result.summary.processed, created: result.summary.created };
      }
      return { status: result.status };
    },
  };
}

export class LinkAgentWatcher {
  app: App;
  agent: LinkAgent;
  /**
   * 索引装载完成的等待句柄（可空）：生成即跑链路先等它——避免 in-flight refresh
   * 与 load 并发读到半装载的索引（同 startQueueConsumption 的等待语义）。
   */
  initialLoad: Promise<void> | null;

  /** 防抖批次缓冲（创建事件聚合） */
  private pendingCreates = new Set<string>();
  /** 防抖批次缓冲（修改事件聚合，v1.4/ticket 119） */
  private pendingModifies = new Set<string>();
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  /** 死链清理防抖定时器 */
  private cleanTimer: ReturnType<typeof setTimeout> | null = null;
  /** 低频巡检定时器 */
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  /** 总线退订函数账本 */
  private unsubs: (() => void)[] = [];
  /** 批次重入保护（上一批未完成时丢弃新触发的 flush） */
  private running = false;

  constructor(app: App, agent: LinkAgent, initialLoad?: Promise<void> | null) {
    this.app = app;
    this.agent = agent;
    this.initialLoad = initialLoad ?? null;
  }

  get enabled(): boolean {
    return (tryGetSettings() as any).linkAgentEnabled !== false;
  }

  /** 注册事件订阅与巡检（linkAgentEnabled=false 时整体不注册——无任何监听与写入） */
  start(): void {
    if (!this.enabled) return;
    this.unsubs.push(
      onDomainEvent<{ path: string }>('vault:md-created', (evt) => this.onCreated(evt.path)),
      onDomainEvent<{ path: string }>('vault:md-modified', (evt) => this.onModified(evt.path)),
      onDomainEvent<{ path: string }>('vault:md-deleted', (evt) => this.onDeleted(evt.path))
    );
    this.sweepTimer = setInterval(() => {
      void this.runDeadLinkSweep();
    }, LINK_SWEEP_INTERVAL_MS);
  }

  /** 三盒内新笔记落盘 → 入缓冲并重置防抖计时（约 60 秒聚合一批）；盒子目录改动即时生效（实时读设置） */
  onCreated(path: string): void {
    if (!this.enabled) return;
    if (!inLinkScope(path)) return;
    this.pendingCreates.add(path);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      void this.flushBatch();
    }, LINK_BATCH_DELAY_MS);
  }

  /**
   * 修改事件（v1.4/ticket 119 正文大改自动重跑）：三盒内已有笔记被修改 → 入缓冲防抖聚合；
   * 冲刷时经 agent.filterChangedForRelink 基准哈希过滤，只重跑真正变化的笔记
   * （Obsidian 高频保存 / 自写 related 触发的 modify 被哈希挡掉，不空转裁判）。
   */
  onModified(path: string): void {
    if (!this.enabled) return;
    if (!inLinkScope(path)) return;
    this.pendingModifies.add(path);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      void this.flushBatch();
    }, LINK_BATCH_DELAY_MS);
  }

  /** 删除事件：缓冲内顺带剔除；死链清理防抖合并触发；该篇基准哈希一并移除 */
  onDeleted(path: string): void {
    this.pendingCreates.delete(path);
    this.pendingModifies.delete(path);
    if (!this.enabled) return;
    if (this.cleanTimer) clearTimeout(this.cleanTimer);
    this.cleanTimer = setTimeout(() => {
      this.cleanTimer = null;
      void this.runDeadLinkSweep();
    }, LINK_CLEAN_DEBOUNCE_MS);
    void this.agent.dropLinkBaseline(path);
  }

  /** 冲刷防抖批次：只处理仍存在的文件；上一批未完成时本次跳过（下一事件重新聚合） */
  async flushBatch(): Promise<void> {
    const batch = [...this.pendingCreates].filter((p) => !!this.app.vault.getAbstractFileByPath(p));
    this.pendingCreates.clear();
    // v1.4：修改事件经基准哈希过滤（只留真正变化者）后并入批次；过滤失败按全部保留兜底
    if (this.pendingModifies.size > 0) {
      const mods = [...this.pendingModifies].filter((p) => !!this.app.vault.getAbstractFileByPath(p));
      this.pendingModifies.clear();
      try {
        const changed = await this.agent.filterChangedForRelink(mods);
        for (const p of changed) if (!batch.includes(p)) batch.push(p);
      } catch (e) {
        console.warn('[link-agent] 修改过滤失败，按全部修改保留', e);
        for (const p of mods) if (!batch.includes(p)) batch.push(p);
      }
    }
    if (!batch.length || this.running) return;
    this.running = true;
    try {
      await this.agent.processBatch(batch);
    } catch (e) {
      console.warn('[link-agent] 批次处理失败', e);
    } finally {
      this.running = false;
    }
  }

  /** 死链清理入口（删除防抖 + 低频巡检共用）；顺带清理队列中已删文件条目 */
  async runDeadLinkSweep(): Promise<number> {
    if (!this.enabled) return 0;
    try {
      return await this.agent.cleanDeadLinks();
    } catch (e) {
      console.warn('[link-agent] 死链清理失败', e);
      return 0;
    }
  }

  /** 卸载清理（定时器/退订/缓冲） */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.cleanTimer) {
      clearTimeout(this.cleanTimer);
      this.cleanTimer = null;
    }
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    for (const off of this.unsubs) {
      try {
        off();
      } catch {
        /* 幂等退订 */
      }
    }
    this.unsubs = [];
    this.pendingCreates.clear();
    this.pendingModifies.clear();
  }
}

/** 队列消费启动（域初始化调用）：等待索引装载完成后自动消费，无需询问；启动路径批次 toast 静默（ticket 6） */
export async function startQueueConsumption(
  agent: LinkAgent,
  initialLoad?: Promise<void> | null,
  opts?: { silent?: boolean }
): Promise<void> {
  try {
    await initialLoad;
  } catch {
    /* 装载失败不阻断队列尝试（消费内部有各自兜底） */
  }
  try {
    await agent.consumeQueue(opts);
  } catch (e) {
    console.warn('[link-agent] 队列消费失败', e);
  }
}

/**
 * 启动存量补链（ticket 115：域初始化在队列消费之后调用）：
 * 等待索引装载完成后对关联范围内缺 related 的存量笔记批量建链；
 * embedding 不可达 / 无目标时静默；批次进度与完成 toast 亦全程静默（ticket 6：
 * 手动命令 bz-knowledge-link-all 才按批次通知），串行锁保证与监听批次互斥。
 */
export async function startStartupBackfill(
  agent: LinkAgent,
  initialLoad?: Promise<void> | null,
  opts?: { silent?: boolean }
): Promise<void> {
  try {
    await initialLoad;
  } catch {
    /* 装载失败不阻断补链尝试（内部有探测兜底） */
  }
  try {
    const result = await agent.backfillMissingLinks(opts);
    if (result.status === 'done' || result.status === 'unreachable' || result.status === 'no-targets') return;
    console.warn('[link-agent] 启动补链跳过（自动关联已关闭）');
  } catch (e) {
    console.warn('[link-agent] 启动补链失败', e);
  }
}
