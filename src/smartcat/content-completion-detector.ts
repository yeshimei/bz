/**
 * 创作完成检测器（P2c，ticket 123）
 *
 * ADR-0059 分层策略：「引用追踪位置，语义快照留住灵魂」——
 * 检测器只负责「何时算一次完整的创作周期」，快照生成在 snapshot-generator。
 *
 * 判定逻辑：
 *   内容 ≥ minLength 且（稳定窗口内无修改 → 'stable' | 会话超时 → 'timeout' | 显式 forceComplete → 'manual'）
 *   → 产出一次 CompletionResult，随后重置该路径状态
 *
 * 纯逻辑类，可注入时钟（测试用）；无 DOM / 无 window / 无网络。
 */
import type { CompletionResult, CompletionReason } from './snapshot-types';

/** 检测器配置（构造函数参数） */
export interface CompletionDetectorConfig {
  /** 内容最小长度（字符数），默认 20 */
  minLength?: number;
  /** 稳定窗口（ms），窗口内无修改即完成，默认 30000 */
  stableMs?: number;
  /** 会话超时（ms），从首次 refresh 起算，默认 300000 */
  sessionTimeoutMs?: number;
  /** 可注入时钟（测试用），默认 Date.now */
  now?: () => number;
}

/** 单路径跟踪状态（内部） */
interface PathState {
  content: string;
  /** 首次 refresh 时间 */
  firstAt: number;
  /** 最近一次 refresh 时间 */
  lastAt: number;
  /** 是否已发送过完成信号 */
  completed: boolean;
}

const DEFAULTS: Required<Omit<CompletionDetectorConfig, 'now'>> = {
  minLength: 20,
  stableMs: 30_000,
  sessionTimeoutMs: 300_000,
};

export class ContentCompletionDetector {
  private readonly minLength: number;
  private readonly stableMs: number;
  private readonly sessionTimeoutMs: number;
  private readonly now: () => number;

  /** 路径 → 状态 */
  private state = new Map<string, PathState>();

  constructor(config?: CompletionDetectorConfig) {
    this.minLength = config?.minLength ?? DEFAULTS.minLength;
    this.stableMs = config?.stableMs ?? DEFAULTS.stableMs;
    this.sessionTimeoutMs = config?.sessionTimeoutMs ?? DEFAULTS.sessionTimeoutMs;
    this.now = config?.now ?? (() => Date.now());
  }

  /**
   * 刷新指定路径的内容，返回完成信号或 null。
   * 内容变化时重置稳定窗口（lastAt 更新 + completed 重置）；
   * 内容未变时不重置——稳定窗口持续计时。
   */
  refresh(path: string, content: string): CompletionResult | null {
    const t = this.now();
    let s = this.state.get(path);

    if (!s) {
      s = { content, firstAt: t, lastAt: t, completed: false };
      this.state.set(path, s);
    } else {
      const changed = s.content !== content;
      s.content = content;
      if (changed) {
        s.lastAt = t;       // 内容变化：重置稳定窗口
        s.completed = false; // 内容变化：重置完成标记
      }
      // 内容未变：lastAt / completed 不动——稳定窗口持续计时
    }

    // 内容不足 → 不判定（但 session timeout 仍检查——超时即兜底）
    if (content.length < this.minLength) {
      return this.trySessionTimeout(path, s);
    }

    return this.trySettle(path, s);
  }

  /**
   * 显式强制完成（手动触发）。
   * 不检查 minLength——调用方负责判断是否满足内容门槛。
   * 幂等：同一路径 forceComplete 连续调用只发一次。
   * 完成后状态保留（completed=true），若后续内容变化会重置并开启新会话。
   */
  forceComplete(path: string): CompletionResult | null {
    const s = this.state.get(path);
    if (!s) return null;

    return this.emit(path, s, 'manual');
  }

  /** 查询路径是否有待处理状态（未完成或已过期） */
  getPending(path: string): boolean {
    const s = this.state.get(path);
    if (!s) return false;
    if (s.completed) return false;
    return true;
  }

  /** 复位全部状态 */
  clear(): void {
    this.state.clear();
  }

  /** 获取指定路径当前内容（无状态返回 undefined，测试辅助） */
  getContent(path: string): string | undefined {
    return this.state.get(path)?.content;
  }

  // -------- 内部逻辑 --------

  /**
   * 仅检查会话超时（内容不足 minLength 时也走此路径兜底）。
   * 超时后删除路径状态——下次 refresh 从零开始新会话，避免 timeout 重复上报。
   */
  private trySessionTimeout(path: string, s: PathState): CompletionResult | null {
    const t = this.now();
    if (t - s.firstAt >= this.sessionTimeoutMs) {
      const result = this.emit(path, s, 'timeout');
      if (result) this.state.delete(path);
      return result;
    }
    return null;
  }

  /**
   * 尝试判定完成：先检查会话超时（始终生效），再检查稳定窗口（仅在内容未变时由 refresh 调用）。
   * 超时后删除路径状态——下次 refresh 从零开始新会话。
   */
  private trySettle(path: string, s: PathState): CompletionResult | null {
    const t = this.now();

    // 会话超时：首次 refresh 到现在 ≥ sessionTimeoutMs
    if (t - s.firstAt >= this.sessionTimeoutMs) {
      const result = this.emit(path, s, 'timeout');
      if (result) this.state.delete(path);
      return result;
    }

    // 稳定窗口：最近内容修改到现在 ≥ stableMs
    if (t - s.lastAt >= this.stableMs) {
      return this.emit(path, s, 'stable');
    }

    return null;
  }

  /** 发出完成信号并重置状态 */
  private emit(path: string, s: PathState, reason: CompletionReason): CompletionResult | null {
    if (s.completed) return null; // 幂等：同一路径连续完成只发一次

    const result: CompletionResult = {
      path,
      content: s.content,
      settledMs: this.now() - s.firstAt,
      reason,
    };

    s.completed = true;
    return result;
  }
}
