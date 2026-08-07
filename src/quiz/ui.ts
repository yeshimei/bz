/**
 * 做题家 UI（ticket 17 修正版：对齐源码 QuizMasterUI 逐字）
 * 模块单例 quizUI（复习域联动）。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { getApp } from '../core/app';
import { QuizManager, loadActiveItems } from './manager';
import { QuestionGenerator } from './generator';
import type { QuizQuestion } from './manager';
import type { AIService } from '../core/ai';

export class QuizMasterUI {
  static ai: AIService | null = null;
  static settings: any = {};

  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  currentQuestions: QuizQuestion[] = [];
  currentIndex = 0;
  loadingMask: HTMLElement | null = null;
  loadingPopup: HTMLElement | null = null;
  _generating = false;

  // 复习联动
  _reviewMode = false;
  onComplete: ((results: any) => void) | null = null;
  correctCount = 0;
  wrongCount = 0;
  totalQuestions = 0;

  generator = new QuestionGenerator();

  constructor() {
    this.injectStyles();
  }

  shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  injectStyles(): void {
    if (document.querySelector('style[data-quiz-styles]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-quiz-styles', '');
    style.textContent = `
      #quiz-mask {
        backdrop-filter: blur(2px);
      }
      #quiz-popup {
        background: var(--background-primary);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        position: relative;
        transition: none;
      }
      .quiz-option-btn {
        padding:10px 14px;
        border:1px solid var(--background-modifier-border);
        border-radius:6px;
        background:var(--background-secondary);
        text-align:left;
        cursor:pointer;
        font-size:15px;
        transition:background 0.2s;
        margin:4px 0;
        display:flex;
        align-items:center;
        gap:8px;
        box-shadow: none !important;
      }
      .quiz-option-btn:hover:not(.disabled) { background:var(--background-modifier-hover); }
      .quiz-option-btn.correct { border-color:#52c41a !important; background:rgba(82,196,26,0.15); }
      .quiz-option-btn.wrong { border-color:#ff4757 !important; background:rgba(255,71,87,0.15); }
      .quiz-option-btn.selected { border-color:var(--interactive-accent); background:var(--background-modifier-hover); }
      .quiz-option-btn .check-mark { opacity:0; transition:opacity 0.2s; }
      .quiz-option-btn.selected .check-mark { opacity:1; }
      .quiz-submit-btn {
        margin-top:16px;
        padding:8px 20px;
        border:none;
        border-radius:6px;
        background:var(--interactive-accent);
        color:var(--text-on-accent);
        font-size:15px;
        cursor:pointer;
        align-self:center;
        box-shadow: none !important;
      }
      .quiz-submit-btn:hover { opacity:0.9; }
      .quiz-submit-btn:disabled { opacity:0.5; cursor:not-allowed; }
      .quiz-next-btn {
        margin-top:16px;
        padding:8px 20px;
        border:1px solid var(--background-modifier-border);
        border-radius:6px;
        background:var(--background-secondary);
        color:var(--text-normal);
        font-size:15px;
        cursor:pointer;
        align-self:center;
        box-shadow: none !important;
      }
      .quiz-next-btn:hover { background:var(--background-modifier-hover); }
      /* Loading 样式 */
      #quiz-loading .spinner {
        display: inline-block;
        width: 40px;
        height: 40px;
        border: 4px solid var(--background-modifier-border);
        border-top-color: var(--interactive-accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  /** 更新题库（基于活跃笔记，空题目则生成；失败 Notice 逐字） */
  async updateQuiz(): Promise<void> {
    const app = getApp();
    try {
      const activeItems = await loadActiveItems(app);
      if (!activeItems.length) {
        await this.managerSaveQuiz({ notes: {} });
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
      new Notice('❌ 更新题库失败: ' + e.message);
      console.error(e);
    }
  }

  private async managerSaveQuiz(quiz: any): Promise<void> {
    await this.manager.saveQuiz(getApp(), quiz);
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

    // 批量生成（一次 AI 调用）
    if (QuizMasterUI.ai) {
      try {
        const batchResult = await this.generator.generateBatch(missing, QuizMasterUI.ai, enableMultipleChoice, questionsPerNote, difficulty);
        for (const [path, qs] of Object.entries(batchResult)) {
          if (qs.length) quiz.notes[path] = qs;
        }
        await this.manager.saveQuiz(app, quiz);
        return;
      } catch (e: any) {
        console.warn('批量出题失败，降级为逐篇:', e.message);
      }
    }

    // fallback：逐篇生成
    for (const note of missing) {
      try {
        if (!QuizMasterUI.ai) throw new Error('AI 未初始化');
        const qs = await this.generator.generate(note.content, QuizMasterUI.ai, enableMultipleChoice, questionsPerNote, difficulty);
        if (qs.length) {
          quiz.notes[note.id] = qs;
          await this.manager.saveQuiz(app, quiz);
        }
      } catch (e: any) {
        console.warn(`出题失败 ${note.id}:`, e.message);
      }
    }
  }

  /** 加载提示（源码 L401-418 逐字） */
  showLoadingPopup(message: string): void {
    this.close(); // 关闭可能存在的弹窗
    const mask = document.createElement('div');
    mask.id = 'quiz-mask';
    mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10010;display:flex;align-items:center;justify-content:center;';
    const popup = document.createElement('div');
    popup.id = 'quiz-loading';
    popup.style.cssText = 'background:var(--background-primary);border-radius:12px;padding:30px;max-width:400px;text-align:center;';
    popup.innerHTML = `
      <div style="font-size:18px;margin-bottom:12px;">⏳ ${message}</div>
      <div class="spinner"></div>
    `;
    mask.appendChild(popup);
    document.body.appendChild(mask);
    escManager.register('quiz-loading', {
      isVisible: () => !!(this.loadingMask && this.loadingMask.isConnected),
      close: () => this.closeLoading(),
    });
    this.loadingMask = mask;
    this.loadingPopup = popup;
  }

  closeLoading(): void {
    if (this.loadingMask && this.loadingMask.parentNode) this.loadingMask.remove();
    this.loadingMask = null;
    this.loadingPopup = null;
  }

  /** 开始做题（源码 L428-511 逐字） */
  async startQuiz(): Promise<void> {
    if (this._generating) return;

    if (!QuizMasterUI.ai) {
      new Notice('⚠️ AI 服务未初始化，无法生成题目。请先运行 Q3.js。', 5000);
      return;
    }

    this._generating = true;
    const app = getApp();
    try {
      // 先尝试获取已有题目
      let uncompleted = await this.manager.getUncompletedQuestions(app);

      // 如果没有任何题目，则自动生成第一个活跃笔记的题目
      if (uncompleted.length === 0) {
        this.showLoadingPopup('正在获取题库，请稍候...');
        try {
          const activeItems = await loadActiveItems(app);
          if (!activeItems.length) {
            this.closeLoading();
            return;
          }

          const firstItem = activeItems[0];
          const notePath = firstItem.filePath;
          const file = app.vault.getAbstractFileByPath(notePath);
          if (!file) {
            this.closeLoading();
            new Notice('笔记文件不存在: ' + notePath, 5000);
            return;
          }

          const content = await app.vault.read(file as any);
          if (!content.trim()) {
            this.closeLoading();
            new Notice('笔记内容为空，无法生成题目。', 5000);
            return;
          }

          const settings = QuizMasterUI.settings || {};
          const enableMultipleChoice = settings.enableMultipleChoice !== false;
          const questionsPerNote = parseInt(settings.questionsPerNote) || 0;
          const difficulty = settings.difficulty || 'random';

          const newQuestions = await this.generator.generate(content, QuizMasterUI.ai, enableMultipleChoice, questionsPerNote, difficulty);

          await this.manager.saveQuestionsForNote(app, notePath, newQuestions);

          // 重新获取题目列表
          uncompleted = await this.manager.getUncompletedQuestions(app);
          if (uncompleted.length === 0) {
            this.closeLoading();
            new Notice('生成题目失败，请重试。', 5000);
            return;
          }

          this.closeLoading();
        } catch (e: any) {
          this.closeLoading();
          new Notice('❌ 生成题目失败: ' + e.message, 5000);
          console.error(e);
          return;
        }
      }

      // 打乱题目（根据设置）
      const shuffle = QuizMasterUI.settings?.shuffleQuestions !== false;
      this.currentQuestions = shuffle ? this.shuffleArray(uncompleted) : uncompleted;
      this.currentIndex = 0;
      this.correctCount = 0;
      this.wrongCount = 0;
      // 固定总题数（在本次会话中不变）
      this.totalQuestions = this.currentQuestions.length;
      this.showQuestion();
    } finally {
      this._generating = false;
    }
  }

  /** 渲染单题（源码 L514-676 逐字） */
  renderModal(q: QuizQuestion): void {
    this.close();

    // 清理选项文本，去除可能的前缀如 "A." "A、" "A)" "(A)" 等
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

    const mask = document.createElement('div');
    mask.id = 'quiz-mask';
    mask.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10010;display:flex;align-items:center;justify-content:center;';
    this.mask = mask;

    const popup = document.createElement('div');
    popup.id = 'quiz-popup';
    popup.style.cssText = 'background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;display:flex;flex-direction:column;position:relative;';
    this.popup = popup;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
    const title = document.createElement('span');
    title.style.cssText = 'font-size:15px;font-weight:600;';
    // 使用固定的总题数 this.totalQuestions
    const noteName = q.notePath!.split('/').pop()!.replace('.md', '');
    title.textContent = `📝 ${noteName} (${this.currentIndex + 1}/${this.totalQuestions})`;
    header.appendChild(title);
    popup.appendChild(header);

    // 题目
    const questionDiv = document.createElement('div');
    questionDiv.style.cssText = 'font-size:17px;font-weight:500;margin-bottom:20px;color:var(--text-normal);';
    questionDiv.textContent = q.question;
    popup.appendChild(questionDiv);

    // 选项容器
    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    const optionLabels = ['A', 'B', 'C', 'D'];
    const selectedIndices = new Set<number>();
    let answered = false;

    const isSingle = q.correctIndices.length === 1;
    const app = getApp();

    const optionElements = q.options.map((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      // 清理选项文本，避免重复前缀
      const cleanText = cleanOptionText(opt);
      btn.innerHTML = `<span>${optionLabels[idx]}.</span><span style="flex:1">${cleanText}</span><span class="check-mark">✔️</span>`;
      btn.dataset.index = String(idx);

      btn.onclick = () => {
        if (answered) return;

        if (isSingle) {
          answered = true;
          optionElements.forEach((b) => b.classList.add('disabled'));
          const isCorrect = idx === q.correctIndices[0];

          if (isCorrect) {
            // 答对：删除该题
            this.correctCount++;
            this.manager
              .removeQuestion(app, q.notePath!, q._index!)
              .then(() => {
                this.currentQuestions.splice(this.currentIndex, 1);
                optionElements.forEach((b, i) => {
                  if (i === q.correctIndices[0]) b.classList.add('correct');
                });
                setTimeout(() => {
                  this.showQuestion();
                }, 800);
              })
              .catch((e) => {
                new Notice('删除题目失败: ' + e.message);
                answered = false;
                optionElements.forEach((b) => b.classList.remove('disabled'));
              });
          } else {
            // 答错：显示正确答案，不删除，添加"下一题"按钮
            this.wrongCount++;
            optionElements.forEach((b, i) => {
              if (i === q.correctIndices[0]) b.classList.add('correct');
              if (i === idx) b.classList.add('wrong');
            });
            this.addNextButton(popup);
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
    optionElements.forEach((el) => optionsContainer.appendChild(el));
    popup.appendChild(optionsContainer);

    // 多选时添加提交按钮
    if (!isSingle) {
      const submitBtn = document.createElement('button');
      submitBtn.className = 'quiz-submit-btn';
      submitBtn.textContent = '提交答案';
      submitBtn.onclick = () => {
        if (answered) return;
        if (selectedIndices.size === 0) {
          return;
        }
        answered = true;
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
          // 源码缺陷：多选正确不递增 correctCount（逐字保留）
          this.manager
            .removeQuestion(app, q.notePath!, q._index!)
            .then(() => {
              this.currentQuestions.splice(this.currentIndex, 1);
              setTimeout(() => {
                this.showQuestion();
              }, 800);
            })
            .catch((e) => {
              new Notice('删除题目失败: ' + e.message);
              answered = false;
              submitBtn.disabled = false;
              optionElements.forEach((b) => b.classList.remove('disabled'));
            });
        } else {
          this.addNextButton(popup);
        }
      };
      popup.appendChild(submitBtn);
    }

    mask.appendChild(popup);
    document.body.appendChild(mask);
    escManager.register('quiz', {
      isVisible: () => !!(this.mask && this.mask.isConnected),
      close: () => this.close(),
    });
    mask.addEventListener('click', (e) => {
      if (e.target === mask) this.finishQuiz();
    });
  }

  /** 渲染单题（源码 L679-697 逐字） */
  showQuestion(): void {
    if (this.currentIndex >= this.currentQuestions.length) {
      // 做完了：只回调，不关闭弹窗（由调用方决定何时关闭）
      if (this.onComplete) {
        const total = this.correctCount + this.wrongCount;
        const results = {
          correct: this.correctCount,
          wrong: this.wrongCount,
          total,
          accuracy: total > 0 ? Math.round((this.correctCount / total) * 100) : 0,
        };
        const cb = this.onComplete;
        this.onComplete = null;
        cb(results);
      }
      return;
    }
    this.renderModal(this.currentQuestions[this.currentIndex]);
  }

  /** 辅助：添加"下一题"按钮（用于错题后，源码 L702-713） */
  addNextButton(popup: HTMLElement): void {
    const oldBtn = popup.querySelector('.quiz-next-btn');
    if (oldBtn) oldBtn.remove();
    const nextBtn = document.createElement('button');
    nextBtn.className = 'quiz-next-btn';
    nextBtn.textContent = '下一题 →';
    nextBtn.onclick = () => {
      this.currentIndex++;
      this.showQuestion();
    };
    popup.appendChild(nextBtn);
  }

  close(): void {
    if (this.mask && this.mask.parentNode) this.mask.remove();
    this.mask = null;
    this.popup = null;
  }

  /** 做题结束（源码 L723-735：回调优先，否则关闭） */
  finishQuiz(): void {
    const total = this.correctCount + this.wrongCount;
    const results = {
      correct: this.correctCount,
      wrong: this.wrongCount,
      total,
      accuracy: total > 0 ? Math.round((this.correctCount / total) * 100) : 0,
    };
    const cb = this.onComplete;
    this.onComplete = null;
    if (cb) cb(results);
    else this.close(); // 没有回调时才直接关闭
  }

  get manager(): QuizManager {
    if (!this._manager) this._manager = new QuizManager();
    return this._manager;
  }
  private _manager: QuizManager | null = null;
}

/** 模块单例（复习域经此联动，对齐源码 window.__quiz） */
export const quizUI = new QuizMasterUI();
