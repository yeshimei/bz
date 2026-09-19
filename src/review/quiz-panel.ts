/**
 * 做题练习独立面板（issue 362）：AI 出题做题引擎（quiz-core）的直接消费壳。
 *
 * - 入口 = main.ts 命令 `bz-review-quiz-open`「做题练习」（域内不 addCommand，经 review/index
 *   openQuizPractice 转发）；不进复习流程、不写排期——刷题即出口。
 * - 面板壳 = 组件库 .bz-panel-overlay / .bz-panel-frame / .bz-panel-mtop（ADR-0094）：
 *   ESC 层 escManager、topifyZ 层级发号、≤768px 真全屏（域内 styles.css 只留 id 几何）；
 *   markup 单源 render.ts（quizPracticeSetupHtml / quizPracticeSummaryHtml）。
 * - 答题会话走做题会话契约 quizUI.startReviewSession / endReviewSession（引擎零改动）：
 *   1-4 / A-D 键盘化、答错移出本轮、答对出库落盘均由引擎负责；本壳只在会话收口时渲染
 *   成绩小结（对/错/跳过、正确率、可再来一轮）。
 * - 行为流：会话开始 emitDomainEvent('review', { kind: 'started' })（小橘订阅端未装时静默）。
 * - AI 未配置：人话提示 + 「去设置」直达设置面板——不出题不崩。
 * - 深审批 C（2026-09-19）：E5 切「本轮题量」档位只切选中态不重建视图、题库计数按范围键
 *   缓存、视图重建后焦点还原；C15 构造期 zIndex 静态档位删（ADR-0067 显示时发号）。
 */
import type { App } from 'obsidian';
import { getApp } from '../core/app';
import { notice, notify } from '../core/notice';
import { escManager } from '../core/esc-manager';
import { topifyZ } from '../core/z-order';
import { emitDomainEvent } from '../core/domain-bus';
import { openFlowDialog } from '../core/flow-dialog';
import { openPathPicker } from '../core/path-picker';
import { mountIcons, uiSuggest } from '../core/ui';
import { ensureQuiz, quizUI } from './quiz-core';
import type { QuizReviewResults } from './quiz-core/session';
import { quizPracticeSetupHtml, quizPracticeSummaryHtml } from './render';
import {
  collectQuestionsForNotes,
  listVaultNotes,
  pickRoundQuestions,
  resolveScopeNotes,
} from './quiz-panel-data';

type QuizScope = 'all' | 'folder' | 'note';

const MASK_ID = 'bz-quiz-practice-mask';
const POPUP_ID = 'bz-quiz-practice-popup';
const ESC_ID = 'review-quiz-practice';
/** 默认本轮题量（20 题≈15 分钟一组，考试周刷一小时可连开三轮） */
const DEFAULT_BATCH = 20;
/** 「全部/文件夹」范围按批出题（审查修复）：每批笔记数上限——引擎 ensureQuestions 一次
 *  AI 调用拼全部 missing 笔记全文，整库单次必超 token/超时后降级数百次串行；面板侧按批
 *  循环驱动，批间汇报进度。 */
const ENSURE_BATCH = 10;

/** AI 就绪检查：getAIProvider 是「已配置」的唯一权威（缺密钥即抛人话错误）。
 *  未就绪 → 流程框引导去设置面板（不出题不崩），返回 false。 */
async function aiReadyOrGuide(): Promise<boolean> {
  const { getAIProvider } = await import('../core/ai');
  try {
    await getAIProvider();
    return true;
  } catch (e: any) {
    void openFlowDialog({
      title: 'AI 还没配置',
      message: `${e?.message || '还没配置 AI 服务'}。做题练习靠 AI 出题，配好后回来就能开刷。`,
      actions: [
        { label: '去设置', value: 'settings', cta: true },
        { label: '稍后再说', value: 'cancel' },
      ],
    }).then((v) => {
      if (v !== 'settings') return;
      void import('../settings-panel').then((m) => m.openSettingsPanel(getApp(), 'review'));
    });
    return false;
  }
}

class QuizPracticePanel {
  private app: App;
  private mask: HTMLElement;
  private popup: HTMLElement;
  private content: HTMLElement;
  private escHandle: { unregister: () => void } | null = null;
  private state: { scope: QuizScope; batch: number; folders: string[]; notePath: string } = {
    scope: 'all',
    batch: DEFAULT_BATCH,
    folders: [],
    notePath: '',
  };
  /** 本轮备题数（小结「跳过」= 备题数 − 已答数） */
  private roundSize = 0;
  /** 会话启动 in-flight 防抖（双击只放行一次，防双跑批量出题） */
  private starting = false;
  /** 取消标志（审查修复）：关面板/卸载置位，startSession 每个 await 后检查即中止——
   *  in-flight 出题完成后不再把题面强弹到已关闭的面板上 */
  private cancelled = false;

  constructor(app: App) {
    this.app = app;
    this.mask = document.createElement('div');
    this.mask.id = MASK_ID;
    this.mask.classList.add('bz-panel-overlay');
    this.mask.style.display = 'none';
    // C15（ADR-0067）：不置静态档位——present 时 topifyZ 显示即发号
    this.mask.onclick = () => this.hide();

    this.popup = document.createElement('div');
    this.popup.id = POPUP_ID;
    this.popup.classList.add('bz-panel-frame');
    // ≤768px 满宽真全屏（顶距避让移动端头，components.css 统一档）
    this.popup.classList.add('bz-panel-mtop');
    this.popup.style.display = 'none';
    this.content = document.createElement('div');
    this.content.className = 'bz-quiz-practice-container';
    this.popup.appendChild(this.content);

    document.body.appendChild(this.mask);
    document.body.appendChild(this.popup);
  }

  // ==================== 显隐 / 生命周期 ====================

  show(): void {
    this.cancelled = false; // 重开复位（取消只针对关面板/卸载时在途的备题流程）
    this.bankCacheKey = ''; // E5：重开面板题库可能已变（上轮答对出库/补出题），计数重算一次
    this.present();
    void this.renderSetup();
  }

  /** 仅置顶显示（设置视图渲染由 show 驱动；小结视图自带内容复用） */
  private present(): void {
    topifyZ(this.mask, this.popup);
    this.mask.style.display = 'block';
    this.popup.style.display = 'flex';
    if (!this.escHandle) {
      this.escHandle = escManager.register(ESC_ID, {
        isVisible: () => this.mask.style.display === 'block',
        close: () => this.hide(),
      });
    }
  }

  hide(): void {
    this.cancelled = true; // 关面板即取消在途备题（startSession await 后检查）
    this.mask.style.display = 'none';
    this.popup.style.display = 'none';
  }

  /** 卸载清理（unloadQuizPanel）：会话在途先走契约强制收口（防御性结算 + 拆题面弹窗），
   *  不留孤儿题面/键盘监听/ESC 层；DOM 与 ESC 层随手摘除（模块单例复位后下次重建）。 */
  destroy(): void {
    this.cancelled = true; // 卸载同取消：在途 startSession 各 await 后即 return
    if (quizUI._sessionActive) quizUI.close();
    this.escHandle?.unregister();
    this.escHandle = null;
    this.mask.remove();
    this.popup.remove();
  }

  // ==================== 设置视图 ====================

  /** E5：题库计数缓存键（scope+folders+notePath）——切「本轮题量」等纯本地档位不再重读整库 */
  private bankCacheKey = '';
  private bankCacheCount: number | null = null;

  private async renderSetup(): Promise<void> {
    // E5：重建前记录面板内焦点控件（innerHTML 重建会丢焦点），渲染后还原到同位控件
    const focusKey = this.captureFocusKey();
    const count = await this.probeBankCount();
    this.content.innerHTML = quizPracticeSetupHtml({
      scope: this.state.scope,
      batch: this.state.batch,
      folders: this.state.folders,
      notePath: this.state.notePath,
      bankCount: count,
    });
    mountIcons(this.content);
    this.bindSetup();
    if (focusKey) this.restoreFocus(focusKey);
  }

  /** E5：面板内焦点控件 → data-* 特征键，null = 面板外/无可记忆焦点 */
  private captureFocusKey(): string | null {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !this.content.contains(el)) return null;
    for (const attr of ['data-scope', 'data-batch', 'data-rm-folder', 'data-act', 'data-role']) {
      const v = el.getAttribute(attr);
      if (v != null) return `${attr}=${v}`;
    }
    return null;
  }

  private restoreFocus(key: string): void {
    const eq = key.indexOf('=');
    const el = this.content.querySelector<HTMLElement>(
      `[${key.slice(0, eq)}="${CSS.escape(key.slice(eq + 1))}"]`
    );
    el?.focus();
  }

  /** 范围内现有题数（一次读题库文件内存账，null = 读取失败不挡开面板）。
   *  E5：按 scope+folders+notePath 键缓存，仅范围变化重算——题库读盘不再跟随每次档位点击。 */
  private async probeBankCount(): Promise<number | null> {
    const key = `${this.state.scope}|${this.state.folders.join('\n')}|${this.state.notePath}`;
    if (key === this.bankCacheKey) return this.bankCacheCount;
    try {
      const paths = resolveScopeNotes(this.app, this.state.scope, this.state.folders, this.state.notePath);
      if (!paths.length) {
        this.bankCacheKey = key;
        this.bankCacheCount = 0;
        return 0;
      }
      const bank = await quizUI.manager.loadQuiz(this.app);
      let count = 0;
      for (const p of paths) count += bank.notes[p]?.length || 0;
      this.bankCacheKey = key;
      this.bankCacheCount = count;
      return count;
    } catch {
      return null; // 读取失败不缓存（下次重算重试）
    }
  }

  private bindSetup(): void {
    this.content.querySelector('[data-act="close"]')?.addEventListener('click', () => this.hide());
    this.content.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.scope as QuizScope;
        if (v && v !== this.state.scope) {
          this.state.scope = v;
          void this.renderSetup();
        }
      });
    });
    this.content.querySelectorAll<HTMLButtonElement>('[data-batch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = Number(btn.dataset.batch);
        if (Number.isNaN(v) || v === this.state.batch) return;
        this.state.batch = v;
        // E5：纯本地档位只切 is-on 选中态 + 记 state，不整表重渲染、不重读题库
        this.content.querySelectorAll<HTMLButtonElement>('[data-batch]').forEach((b) => {
          const on = Number(b.dataset.batch) === v;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-checked', String(on));
        });
      });
    });
    this.content.querySelectorAll<HTMLButtonElement>('[data-rm-folder]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.state.folders = this.state.folders.filter((f) => f !== btn.dataset.rmFolder);
        void this.renderSetup();
      });
    });
    this.content.querySelector('[data-act="pick-folders"]')?.addEventListener('click', () => {
      openPathPicker({
        title: '选择出题文件夹',
        mode: 'multi',
        selected: this.state.folders,
        onConfirm: (list) => {
          this.state.folders = list;
          void this.renderSetup();
        },
      });
    });
    const input = this.content.querySelector<HTMLInputElement>('[data-role="note-input"]');
    if (input) {
      // 单篇选择：库内联想范式（core uiSuggest——聚焦/输入惰性弹出、点选回填）
      uiSuggest({
        anchor: input,
        max: 12,
        source: () => listVaultNotes(getApp()),
        onPick: (p) => {
          this.state.notePath = p;
          void this.renderSetup();
        },
      });
      input.addEventListener('input', () => {
        this.state.notePath = input.value.trim();
      });
      input.addEventListener('change', () => {
        void this.renderSetup();
      });
    }
    this.content.querySelector('[data-act="start"]')?.addEventListener('click', () => {
      void this.startSession();
    });
  }

  // ==================== 开始会话（契约驱动） ====================

  private async startSession(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    const startBtn = this.content.querySelector<HTMLButtonElement>('[data-act="start"]');
    startBtn?.setAttribute('disabled', '');
    try {
      const app = this.app;
      const paths = resolveScopeNotes(app, this.state.scope, this.state.folders, this.state.notePath);
      if (!paths.length) {
        // 单篇空 = 路径不存在（resolveScopeNotes 已过滤幽灵路径）——给人话，不再笼统「没有笔记」
        notice(
          this.state.scope === 'note' ? '找不到这篇笔记，可能已被移动或重命名，重新选一篇吧' : '当前范围没有可出题的笔记',
          'warning'
        );
        return;
      }
      if (!(await aiReadyOrGuide())) return;
      if (this.cancelled) return; // 关面板/卸载后不再继续备题
      // 引擎既有批量出题（进度/失败通知内建；已有题的笔记跳过不重出）。
      // 审查修复：按批循环驱动（每批 ≤10 篇一次 AI 调用），「全部」范围不再整库单次调用
      // 拼全部全文（必超 token/超时降级数百次串行）；批间更新进度框，关面板即中止。
      const progress = notify(`正在备题（0/${paths.length} 篇）…`, { type: 'progress', dedupeKey: 'quiz-prepare' });
      try {
        for (let i = 0; i < paths.length; i += ENSURE_BATCH) {
          if (this.cancelled) return;
          await quizUI.ensureQuestions(paths.slice(i, i + ENSURE_BATCH));
          progress.setMessage(`正在备题（${Math.min(i + ENSURE_BATCH, paths.length)}/${paths.length} 篇）…`);
        }
      } finally {
        progress.hide();
      }
      if (this.cancelled) return;
      const bank = await quizUI.manager.loadQuiz(app); // 循环外一次读题库（审查修复：不再逐篇 O(N) 读盘）
      const collected = await collectQuestionsForNotes(bank, paths);
      const picked = pickRoundQuestions(collected, this.state.batch);
      if (!picked.length) {
        notice('这个范围还没出成题目：AI 出题失败或笔记内容为空，稍后再试', 'warning');
        return;
      }
      if (this.cancelled) return;
      this.hide();
      // 行为流（issue 261 范式）：开始刷题入小橘行为流（review:started；未装小橘订阅端静默）
      emitDomainEvent('review', { kind: 'started' });
      this.roundSize = picked.length;
      quizUI.startReviewSession({
        questions: picked,
        onComplete: (results) => {
          // 契约收口：完题路径回调已被引擎消费（endReviewSession 此处只拆题面弹窗）；
          // 中途放弃路径引擎已自拆——幂等，双调无害
          quizUI.endReviewSession();
          this.showSummary(results);
        },
      });
    } finally {
      this.starting = false;
      startBtn?.removeAttribute('disabled');
    }
  }

  // ==================== 成绩小结 ====================

  private showSummary(results: QuizReviewResults): void {
    this.bankCacheKey = ''; // E5：本轮答题已改题库（答对出库），「再来一轮」回设置视图须重算计数
    const skipped = Math.max(0, this.roundSize - results.total);
    this.content.innerHTML = quizPracticeSummaryHtml({
      correct: results.correct,
      wrong: results.wrong,
      skipped,
      accuracy: results.accuracy,
    });
    mountIcons(this.content);
    this.content.querySelector('[data-act="again"]')?.addEventListener('click', () => {
      void this.renderSetup();
    });
    this.content.querySelector('[data-act="finish"]')?.addEventListener('click', () => this.hide());
    this.present();
  }
}

/** 模块单例（面板壳常驻，show/hide 复用；unload 时销毁复位） */
let panel: QuizPracticePanel | null = null;

/** 打开做题练习面板（review/index.openQuizPractice 转发；幂等建壳） */
export async function openQuizPanel(app: App): Promise<void> {
  // 会话在途：题面弹窗拥有前台（ESC 层在其下），不重开设置视图垫底；
  // 审查修复：不再静默 no-op，给人话反馈
  if (quizUI._sessionActive) {
    notice('做题进行中，先完成或放弃当前这轮再开', 'info');
    return;
  }
  ensureQuiz(app);
  if (!panel) panel = new QuizPracticePanel(app);
  panel.show();
}

/** 卸载清理（unloadReview 调用；未开过面板时为幂等空清理） */
export function unloadQuizPanel(): void {
  panel?.destroy();
  panel = null;
}
