/**
 * 做题家 UI（ticket 17 修正版：对齐源码 QuizMasterUI 逐字）
 * 模块单例 quizUI（复习域联动）。
 */
import type { App } from 'obsidian';
import { notice, notify } from '../core/notice';
import { openFlowDialog } from '../core/flow-dialog';
import { escManager } from '../core/esc-manager';
import { allocZ } from '../core/z-order';
import { getApp } from '../core/app';
import { QuizManager, loadActiveItems } from './manager';
import { QuestionGenerator } from './generator';
import { escapeHtml } from '../core/utils';
import type { QuizQuestion } from './manager';
import type { AIService } from '../core/ai';

/** 复习联动结果：一轮做题会话完成后的统计（复习域经 onComplete 接收） */
export interface QuizReviewResults {
  correct: number;
  wrong: number;
  total: number;
  accuracy: number;
}

/** 清理选项文本，去除可能的前缀如 "A." "A、" "A)" "(A)" 等（renderModal 拆分） */
function cleanOptionText(text: string): string {
  if (!text) return '';
  // 匹配开头可能的字母（A-D）+ 标点，或带括号的
  const match = text.match(/^([A-D])\s*[.、:：)）]\s*/);
  if (match) {
    return text.substring(match[0].length).trim();
  }
  // 匹配 (A) 形式
  const matchParen = text.match(/^\(([A-D])\)\s*/);
  if (matchParen) {
    return text.substring(matchParen[0].length).trim();
  }
  return text.trim();
}

export class QuizMasterUI {
  static ai: AIService | null = null;
  static settings: any = {};
  /**
   * 实例镜像：复习域经 quizUI.ai 读取。静态属性不挂在实例上（JS 中 quizUI.ai 恒为
   * undefined），故 ensureQuiz 时同步设置本字段，复习域判断才生效。
   */
  ai: AIService | null = null;

  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  currentQuestions: QuizQuestion[] = [];
  currentIndex = 0;

  // 复习联动（仅经 startReviewSession/endReviewSession 契约访问，复习域不得直接改写）
  // ticket 141：普通做题模式删除（独立入口 ticket 098 退役后已是死代码）——做题家只是
  // 复习流程中的一环，会话只能经 startReviewSession 开启，不再存在「无 onComplete 的裸会话」
  _sessionActive = false;
  onComplete: ((results: QuizReviewResults) => void) | null = null;
  correctCount = 0;
  wrongCount = 0;
  totalQuestions = 0;

  generator = new QuestionGenerator();
  /** ticket 098:多选提交按钮暂存（renderModal 选项后补挂，保证位于选项下方） */
  _pendingSubmitBtn: HTMLElement | null = null;
  /** ticket 141：头部对错计数元素（renderModal 重建时更新引用） */
  private _statsEl: HTMLElement | null = null;
  /** ticket 141：做题键盘快捷键句柄（1-4/A-D 选择、Enter 提交/下一题；ESC 走 escManager） */
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;

  shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** 更新题库（基于活跃笔记，空题目则生成；失败 Notice 逐字） */
  async updateQuiz(): Promise<void> {
    const app = getApp();
    try {
      const activeItems = await loadActiveItems(app);
      if (!activeItems.length) {
        await this.manager.saveQuiz(getApp(), { notes: {} });
        return;
      }

      const quiz = await this.manager.loadQuiz(app);
      const activePaths = new Set(activeItems.map((i: any) => i.filePath));

      // 1. 删除已不在活跃列表中的笔记条目
      for (const notePath of Object.keys(quiz.notes)) {
        if (!activePaths.has(notePath)) {
          delete quiz.notes[notePath];
        }
      }
      await this.manager.saveQuiz(app, quiz);

      // 2. 为缺少题目的笔记批量生成
      const notePaths = activeItems.map((i: any) => i.filePath);
      await this.ensureQuestions(notePaths);
    } catch (e: any) {
      notice('更新题库失败：' + e.message, 'error');
      console.error(e);
    }
  }

  /** 确保指定笔记都有题目（源码 L346-398 逐字） */
  async ensureQuestions(notePaths: string[]): Promise<void> {
    const app = getApp();
    const quiz = await this.manager.loadQuiz(app);
    const settings = QuizMasterUI.settings || {};
    const enableMultipleChoice = settings.enableMultipleChoice !== false;
    const questionsPerNote = parseInt(settings.questionsPerNote) || 0;
    const difficulty = settings.difficulty || 'random';

    // 找出缺少题目的笔记
    const missing: { id: string; content: string }[] = [];
    for (const path of notePaths) {
      const existing = quiz.notes[path];
      if (!existing || existing.length === 0) {
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) continue;
        const content = await app.vault.read(file as any);
        if (content.trim()) missing.push({ id: path, content });
      }
    }

    if (!missing.length) return;

    // 批量生成（一次 AI 调用）：常驻单框动态更新
    if (QuizMasterUI.ai) {
      try {
        const h = notify(`正在为 ${missing.length} 篇笔记批量生成题目…`, { type: 'progress', dedupeKey: 'quiz-generate' });
        const batchResult = await this.generator.generateBatch(missing, QuizMasterUI.ai, enableMultipleChoice, questionsPerNote, difficulty);
        let batchOk = 0;
        for (const [path, qs] of Object.entries(batchResult)) {
          if (qs.length) {
            quiz.notes[path] = qs;
            batchOk++;
          }
        }
        await this.manager.saveQuiz(app, quiz);
        h.setType('success');
        h.setMessage(`已为 ${batchOk} 篇笔记生成题目`);
        return;
      } catch (e: any) {
        console.warn('批量出题失败，降级为逐篇:', e.message);
        notify('批量出题失败，已改为逐篇生成', { type: 'warning', dedupeKey: 'quiz-generate' });
      }
    }

    // fallback：逐篇生成
    let okCount = 0;
    let failCount = 0;
    let firstError = '';
    for (const note of missing) {
      try {
        if (!QuizMasterUI.ai) throw new Error('AI 未初始化');
        const qs = await this.generator.generate(note.content, QuizMasterUI.ai, enableMultipleChoice, questionsPerNote, difficulty);
        if (qs.length) {
          quiz.notes[note.id] = qs;
          okCount++;
          await this.manager.saveQuiz(app, quiz);
        } else {
          failCount++;
        }
      } catch (e: any) {
        console.warn(`出题失败 ${note.id}:`, e.message);
        if (!firstError) firstError = e.message || '未知错误';
        failCount++;
      }
    }
    if (okCount > 0) notify(`已为 ${okCount} 篇笔记生成题目`, { type: 'success' });
    if (failCount > 0) notify(`${failCount} 篇笔记出题失败${firstError ? `（${firstError}）` : ''}`, { type: 'warning', dedupeKey: 'quiz-generate' });
  }

  /** ticket 141：普通做题模式（startQuiz/showLoadingPopup）删除——独立入口 ticket 098 退役后
   *  已无调用方，做题家只作为复习流程一环经 startReviewSession 进入。 */

  /**
   * 复习联动契约：开始一轮做题会话（复习计划经此进入做题模式）——ticket 141 起唯一入口。
   * 会话状态（_sessionActive/currentQuestions/计数/onComplete）只允许在本方法内设置，
   * 复习域禁止直接改写——契约化后复习域只需调用本方法与 endReviewSession。
   * 「打乱出题顺序」设置在会话入口生效（原普通模式行为迁移，设置项保留语义不变）。
   */
  startReviewSession(opts: { questions: QuizQuestion[]; onComplete: ((results: QuizReviewResults) => void) | null }): void {
    this._sessionActive = true;
    const shuffle = QuizMasterUI.settings?.shuffleQuestions !== false;
    this.currentQuestions = shuffle ? this.shuffleArray([...opts.questions]) : [...opts.questions];
    this.currentIndex = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.totalQuestions = this.currentQuestions.length;
    this.onComplete = opts.onComplete;
    this.showQuestion();
  }

  /** 复习联动契约：结束做题会话（结算回调已消费后由复习域调用，收尾弹窗；防御性结算防悬挂） */
  endReviewSession(): void {
    const cb = this.onComplete;
    this.onComplete = null;
    this._sessionActive = false;
    if (cb) cb(this._buildResults());
    this._teardownModal();
  }

  /** 渲染单题（源码 L514-676 逐字） */
  renderModal(q: QuizQuestion): void {
    this._teardownModal(); // 换题过渡：只拆 DOM，不触发 close 的复习结算语义
    this._pendingSubmitBtn = null;

    const mask = document.createElement('div');
    mask.id = 'quiz-mask';
    this.mask = mask;
    mask.style.zIndex = String(allocZ()); // ADR-0067：换题重建 DOM，创建即显示即发号（popup 为 mask 子节点随动）
    const popup = document.createElement('div');
    popup.id = 'quiz-popup';
    this.popup = popup;

    const header = document.createElement('div');
    header.className = 'bz-quiz-head';
    const title = document.createElement('span');
    title.className = 'bz-quiz-title';
    // 使用固定的总题数 this.totalQuestions；题号 = 已消费题数 + 1：
    // ticket 141：答对/答错均 splice 出当前题（答错仅移出本轮会话，不落盘删除），
    // 已消费数 = totalQuestions - 剩余长度——不依赖 correct/wrong 计数（多选计数为已知缺陷）
    // ticket 099：notePath 判空降级（待重做队列曾缺 notePath → q.notePath!.split 崩溃）
    const noteName = q.notePath ? q.notePath.split('/').pop()!.replace('.md', '') : '';
    const doneCount = this.totalQuestions - this.currentQuestions.length;
    title.textContent = noteName ? `📝 ${noteName} (${doneCount + 1}/${this.totalQuestions})` : `📝 (${doneCount + 1}/${this.totalQuestions})`;
    header.appendChild(title);
    // ticket 141：头部实时对错计数（做题中即可见，不再只存不用）
    const stats = document.createElement('span');
    stats.className = 'bz-quiz-stats';
    this._statsEl = stats;
    this._syncHeaderStats();
    header.appendChild(stats);
    popup.appendChild(header);

    // 题目
    const questionDiv = document.createElement('div');
    questionDiv.className = 'bz-quiz-question';
    questionDiv.textContent = q.question;
    popup.appendChild(questionDiv);

    // 选项容器
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'bz-quiz-options';
    const selectedIndices = new Set<number>();
    const answeredRef = { value: false };

    const optionElements = this._buildOptionButtons(q, answeredRef, selectedIndices, optionsContainer);
    optionElements.forEach((el) => optionsContainer.appendChild(el));
    // ticket 098：提交按钮位于选项下方（暂存按钮在选项之后补挂，原 append 顺序在选项上方）
    if (this._pendingSubmitBtn) {
      optionsContainer.appendChild(this._pendingSubmitBtn);
      this._pendingSubmitBtn = null;
    }
    popup.appendChild(optionsContainer);

    mask.appendChild(popup);
    document.body.appendChild(mask);
    escManager.register('quiz', {
      isVisible: () => !!(this.mask && this.mask.isConnected),
      close: () => this.finishQuiz(),
    });
    this._bindKeyboard();
    mask.addEventListener('click', (e) => {
      if (e.target === mask) this.finishQuiz();
    });
  }

  /**
   * ticket 141：做题键盘快捷键（1-4/A-D 选择、Enter 提交/下一题）。
   * 焦点在按钮/输入框上时原生行为优先（防 Enter 双触发）；ESC 不在此处理（escManager 层级）。
   */
  private _bindKeyboard(): void {
    this._unbindKeyboard();
    this._keyHandler = (e: KeyboardEvent) => {
      if (!this.mask || !this.mask.isConnected) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) return;
      const keys = ['1', '2', '3', '4'];
      const letters = ['a', 'b', 'c', 'd'];
      const key = e.key.toLowerCase();
      const idx = keys.includes(key) ? keys.indexOf(key) : letters.indexOf(key);
      if (idx >= 0 && idx <= 3) {
        const btn = this.popup?.querySelector<HTMLElement>(`.quiz-option-btn[data-index="${idx}"]`);
        if (btn && !btn.classList.contains('disabled')) btn.click();
        return;
      }
      if (e.key === 'Enter') {
        const submit = this.popup?.querySelector<HTMLButtonElement>('.quiz-submit-btn');
        if (submit && !submit.disabled) {
          submit.click();
          return;
        }
        const next = this.popup?.querySelector<HTMLButtonElement>('.quiz-next-btn');
        if (next && !next.disabled) next.click();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  private _unbindKeyboard(): void {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }

  /** ticket 141：头部对错计数同步（答对/答错即时刷新，无则静默跳过） */
  private _syncHeaderStats(): void {
    if (this._statsEl) this._statsEl.textContent = `✅ ${this.correctCount} · ❌ ${this.wrongCount}`;
  }

  /** 选项按钮组构建与答题逻辑（renderModal 拆分）：单选即点即判 / 多选切换 + 提交 */
  _buildOptionButtons(q: QuizQuestion, answeredRef: { value: boolean }, selectedIndices: Set<number>, optionsContainer: HTMLElement): HTMLElement[] {
    const optionLabels = ['A', 'B', 'C', 'D'];
    const isSingle = q.correctIndices.length === 1;
    const app = getApp();

    const optionElements = q.options.map((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      // 清理选项文本，避免重复前缀
      const cleanText = cleanOptionText(opt);
      btn.innerHTML = `<span>${optionLabels[idx]}.</span><span class="bz-quiz-option-text">${escapeHtml(cleanText)}</span><span class="check-mark">✔️</span>`;
      btn.dataset.index = String(idx);

      btn.onclick = () => {
        if (answeredRef.value) return;

        if (isSingle) {
          answeredRef.value = true;
          optionElements.forEach((b) => b.classList.add('disabled'));
          const isCorrect = idx === q.correctIndices[0];

          if (isCorrect) {
            // 答对（ticket 141）：即时亮出正确选项 + 挂待解锁「下一题」，持久化成功才解锁——节奏由用户掌控
            optionElements.forEach((b, i) => {
              if (i === q.correctIndices[0]) b.classList.add('correct');
            });
            this.addNextButton(optionsContainer, true);
            this._answerCorrect(q, app, () => {
              answeredRef.value = false;
              optionElements.forEach((b) => b.classList.remove('disabled'));
              this._removeNextButton();
            });
          } else {
            // 答错：显示正确答案，仅移出本轮会话（不落盘删除，留给重做队列），「下一题」按钮继续
            this.wrongCount++;
            this._syncHeaderStats();
            this.currentQuestions.splice(this.currentIndex, 1);
            optionElements.forEach((b, i) => {
              if (i === q.correctIndices[0]) b.classList.add('correct');
              if (i === idx) b.classList.add('wrong');
            });
            this.addNextButton(optionsContainer);
          }
        } else {
          // 多选：切换选中
          if (selectedIndices.has(idx)) {
            selectedIndices.delete(idx);
            btn.classList.remove('selected');
          } else {
            selectedIndices.add(idx);
            btn.classList.add('selected');
          }
        }
      };
      return btn;
    });
    // 多选时添加提交按钮
    if (!isSingle) {
      const submitBtn = document.createElement('button');
      submitBtn.className = 'quiz-submit-btn';
      submitBtn.textContent = '提交答案';
      submitBtn.onclick = () => {
        if (answeredRef.value) return;
        if (selectedIndices.size === 0) {
          notice('请至少选择一项', 'warning'); // ticket 15：多选零选择提示
          return;
        }
        answeredRef.value = true;
        submitBtn.disabled = true;
        const selected = Array.from(selectedIndices).sort();
        const correct = q.correctIndices.slice().sort();
        const isCorrect = selected.length === correct.length && selected.every((v, i) => v === correct[i]);

        optionElements.forEach((b, i) => {
          b.classList.add('disabled');
          if (correct.includes(i)) b.classList.add('correct'); // ✅ 正确选项变绿
          else if (selectedIndices.has(i) && !isCorrect) b.classList.add('wrong'); // ❌ 错误选中变红
        });

        if (isCorrect) {
          // ticket 098（ADR-0044）：多选计数 bug 解冻——答对也递增 correctCount（唯一破铁律 1 项；
          // 递增时机在 _answerCorrect 持久化成功后，失败恢复作答态不重复计）
          // ticket 141：同单选——「下一题」按钮由用户点按，持久化成功后解锁
          this.addNextButton(optionsContainer, true);
          this._answerCorrect(q, app, () => {
            answeredRef.value = false;
            submitBtn.disabled = false;
            optionElements.forEach((b) => b.classList.remove('disabled'));
            this._removeNextButton();
          });
        } else {
          // 答错：同单选——仅移出本轮会话（不落盘删除），「下一题」按钮继续
          this.wrongCount++;
          this._syncHeaderStats();
          this.currentQuestions.splice(this.currentIndex, 1);
          this.addNextButton(optionsContainer);
        }
      };
      this._pendingSubmitBtn = submitBtn; // 由 renderModal 在选项之后补挂（ticket 098）
    }

    return optionElements;
  }

  /** 答对公共链路（ticket 141 重构）：稳定定位删题 → 计数 → splice 出当前题 → 头部计数同步 →
   *  解锁「下一题」。删除按题目内容在存储数组定位（P0-2），不再依赖会话期 _index 快照；
   *  持久化成功后才计数并解锁跳题（P2：失败恢复作答态时不重复计数），失败通知并恢复作答状态。 */
  private _answerCorrect(q: QuizQuestion, app: App, onFailRestore: () => void): void {
    this.manager
      .removeQuestion(app, q.notePath!, { question: q.question, options: q.options, correctIndices: q.correctIndices })
      .then(() => {
        this.correctCount++;
        this.currentQuestions.splice(this.currentIndex, 1);
        this._syncHeaderStats();
        this._enableNextButton();
      })
      .catch((e) => {
        notice('删除题目失败：' + e.message, 'error');
        onFailRestore();
      });
  }

  /** 汇总本轮做题统计（showQuestion 完题 / finishQuiz 共用） */
  private _buildResults(): QuizReviewResults {
    const total = this.correctCount + this.wrongCount;
    return {
      correct: this.correctCount,
      wrong: this.wrongCount,
      total,
      accuracy: total > 0 ? Math.round((this.correctCount / total) * 100) : 0,
    };
  }

  /** 渲染单题（源码 L679-697 逐字） */
  showQuestion(): void {
    if (this.currentIndex >= this.currentQuestions.length) {
      // 做完了：只回调，不关闭弹窗（由调用方决定何时关闭）
      if (this.onComplete) {
        const cb = this.onComplete;
        this.onComplete = null;
        cb(this._buildResults());
      }
      return;
    }
    this.renderModal(this.currentQuestions[this.currentIndex]);
  }

  /**
   * 辅助：添加「下一题」按钮（ticket 141 节奏改造：答对/答错统一由用户点按进入下一题，
   * 去掉答对 800ms 强制自动跳题）。disabled=true 先挂占位，持久化成功后经 _enableNextButton 解锁。
   */
  addNextButton(popup: HTMLElement, disabled = false): void {
    const oldBtn = popup.querySelector('.quiz-next-btn');
    if (oldBtn) oldBtn.remove();
    const nextBtn = document.createElement('button');
    nextBtn.className = 'quiz-next-btn';
    nextBtn.textContent = '下一题 →';
    if (disabled) {
      (nextBtn as HTMLButtonElement).disabled = true;
      nextBtn.classList.add('quiz-next-btn--pending');
    }
    nextBtn.onclick = () => {
      this.showQuestion();
    };
    popup.appendChild(nextBtn);
  }

  /** 持久化成功后解锁「下一题」（防持久化期间抢跑重复跳题） */
  private _enableNextButton(): void {
    const btn = this.popup?.querySelector<HTMLButtonElement>('.quiz-next-btn');
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('quiz-next-btn--pending');
  }

  /** 持久化失败时移除挂起的「下一题」（作答态恢复后可重试） */
  private _removeNextButton(): void {
    this.popup?.querySelector('.quiz-next-btn')?.remove();
  }

  /** 仅拆除弹窗 DOM（换题/结果卡等内部过渡用，不走结算语义；连带注销键盘监听） */
  private _teardownModal(): void {
    this._unbindKeyboard();
    if (this.mask && this.mask.parentNode) this.mask.remove();
    this.mask = null;
    this.popup = null;
    this._statsEl = null;
  }

  /**
   * 点遮罩 / ESC（ticket 141：纯复习会话语义，原「普通模式直接关窗」分支随模式删除）。
   * 答题中途（回调未消费）→ 先确认「放弃本次做题？」，确认才按既有语义结算；
   * 结果卡阶段（回调已消费，复习域驱动下一步）→ 忽略，防止中途拆 DOM 令复习循环 Promise 悬挂。
   */
  finishQuiz(): void {
    if (!this._sessionActive || !this.onComplete) return;
    void openFlowDialog({
      title: '放弃本次做题？',
      message: '未完成的题目将丢弃，本次复习将按已答题目结算评级',
      actions: [
        { label: '继续做题', value: 'cancel' },
        { label: '放弃', value: 'ok', cta: true },
      ],
    }).then((v) => {
      if (v !== 'ok') return;
      const cb = this.onComplete;
      this.onComplete = null;
      this._sessionActive = false;
      if (cb) cb(this._buildResults()); // total=0 按 ADR-0044 评 again 属既定语义
      this._teardownModal();
    });
  }

  /** 强制关闭（复习域契约调用，如结果卡「复习此笔记」）：回调防御性结算，避免外层 Promise 悬挂 */
  close(): void {
    const cb = this.onComplete;
    this.onComplete = null;
    this._sessionActive = false;
    if (cb) cb(this._buildResults());
    this._teardownModal();
  }

  get manager(): QuizManager {
    if (!this._manager) this._manager = new QuizManager();
    return this._manager;
  }
  private _manager: QuizManager | null = null;
}

/** 模块单例（复习域经此联动，对齐源码 window.__quiz） */
export const quizUI = new QuizMasterUI();
