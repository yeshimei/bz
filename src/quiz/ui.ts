/**
 * 做题家 UI（ticket 17，源码 L216-736 逐字移植）
 * QuizMasterUI 模块单例：startQuiz/renderModal/ensureQuestions/updateQuiz。
 */
import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { escManager } from '../core/esc-manager';
import { getSettings } from '../core/settings-provider';
import { QuizManager } from './manager';
import { QuestionGenerator } from './generator';
import type { QuizQuestion } from './manager';
import type { AIService } from '../core/ai';

export class QuizMasterUI {
  static ai: AIService | null = null;
  static settings: any = {};

  mask: HTMLElement | null = null;
  popup: HTMLElement | null = null;
  loadingMask: HTMLElement | null = null;
  loadingPopup: HTMLElement | null = null;
  currentQuestions: QuizQuestion[] = [];
  currentIndex = 0;
  _generating = false;

  // 复习联动
  _reviewMode = false;
  onComplete: ((results: any) => void) | null = null;
  correctCount = 0;
  wrongCount = 0;
  totalQuestions = 0;

  app: App;
  manager: QuizManager;
  generator: QuestionGenerator;

  constructor(app: App) {
    this.app = app;
    this.manager = new QuizManager();
    this.generator = new QuestionGenerator(QuizMasterUI.ai);
    this.injectStyles();
  }

  injectStyles(): void {
    if (document.querySelector('style[data-quiz-styles]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-quiz-styles', '');
    style.textContent = `
      #quiz-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 10010; display: flex; align-items: center; justify-content: center; }
      #quiz-popup { background: var(--background-primary); border-radius: 12px; max-width: 600px; width: 92%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); z-index: 10011; }
      .quiz-option-btn { display: block; width: 100%; text-align: left; padding: 10px 14px; margin: 6px 0; border-radius: 8px; border: 1px solid var(--background-modifier-border); background: var(--background-secondary); cursor: pointer; font-size: .9rem; }
      .quiz-option-btn:hover { background: var(--background-modifier-hover); }
      .quiz-option-btn.selected { border-color: var(--interactive-accent); background: var(--interactive-accent-hover); }
      .quiz-option-btn.correct { border-color: #52c41a; background: #52c41a22; }
      .quiz-option-btn.wrong { border-color: #ff4757; background: #ff475722; }
      .quiz-option-btn.disabled { pointer-events: none; opacity: .8; }
      .check-mark { margin-left: 6px; }
      .quiz-submit-btn { padding: 8px 24px; border-radius: 8px; border: none; background: var(--interactive-accent); color: var(--text-on-accent); cursor: pointer; font-size: .9rem; }
      .quiz-submit-btn:disabled { opacity: .5; cursor: not-allowed; }
      .quiz-next-btn { padding: 8px 24px; border-radius: 8px; border: none; background: var(--interactive-accent); color: var(--text-on-accent); cursor: pointer; font-size: .9rem; }
      #quiz-loading .spinner { width: 32px; height: 32px; border: 3px solid var(--background-modifier-border); border-top-color: var(--interactive-accent); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  /** 更新题库（删除非活跃笔记题目 + 生成新题） */
  async updateQuiz(app: App): Promise<void> {
    const { ReviewDataManager } = await import('../review/data');
    const rdm = new ReviewDataManager(app);
    await rdm.loadItems();
    const activePaths = new Set(rdm.items.filter((i) => !i.completed).map((i) => i.filePath));
    if (activePaths.size === 0) {
      this.manager.quiz = { notes: {} };
      await this.manager.saveQuiz(app);
      return;
    }
    // 删除非活跃条目
    let changed = false;
    for (const notePath of Object.keys(this.manager.quiz.notes)) {
      if (!activePaths.has(notePath)) {
        delete this.manager.quiz.notes[notePath];
        changed = true;
      }
    }
    if (changed) await this.manager.saveQuiz(app);
    await this.ensureQuestions([...activePaths]);
  }

  /** 确保题目存在（批量 → 降级逐篇） */
  async ensureQuestions(notePaths: string[]): Promise<void> {
    const settings = QuizMasterUI.settings;
    const enableMultipleChoice = settings.enableMultipleChoice !== false;
    const questionsPerNote = parseInt(settings.questionsPerNote) || 0;
    const difficulty = settings.difficulty || 'random';

    const missing: { path: string; content: string }[] = [];
    for (const path of notePaths) {
      if (!this.manager.getQuestionsForNote(path)) {
        try {
          const f = this.app.vault.getAbstractFileByPath(path);
          if (!f) continue;
          const content = await this.app.vault.read(f as any);
          missing.push({ path, content });
        } catch {
          /* 读失败跳过 */
        }
      }
    }
    if (missing.length === 0) return;

    // 批量生成
    try {
      const batchResult = await this.generator.generateBatch(
        missing.map((m) => ({ id: m.path, content: m.content }))
      );
      for (const [id, questions] of Object.entries(batchResult)) {
        await this.manager.saveQuestionsForNote(this.app, id, questions);
      }
      return;
    } catch (e) {
      console.warn('批量出题失败，降级为逐篇:', e);
    }

    // 逐篇
    for (const m of missing) {
      try {
        const questions = await this.generator.generate(m.path, m.content, difficulty, questionsPerNote > 0 ? questionsPerNote : null);
        await this.manager.saveQuestionsForNote(this.app, m.path, questions);
      } catch (e) {
        console.warn(`出题失败 ${m.path}:`, e);
      }
    }
  }

  /** 开始做题 */
  async startQuiz(app: App): Promise<void> {
    if (this._generating) return;
    this._generating = true;

    if (!QuizMasterUI.ai) {
      const notice = new Notice('⚠️ AI 服务未初始化，无法生成题目。请先运行 Q3.js。', 5000);
      this._generating = false;
      return;
    }

    try {
      await this.manager.loadQuiz(app);
      await this.updateQuiz(app);
    } catch (e) {
      console.warn('题库更新失败', e);
    }

    const questions = this.manager.getUncompletedQuestions();
    if (questions.length === 0) {
      this._generating = false;
      return;
    }

    const settings = QuizMasterUI.settings;
    if (settings.shuffleQuestions !== false) {
      this.shuffleArray(questions);
    }

    this.currentQuestions = questions;
    this.currentIndex = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.totalQuestions = questions.length;
    this._generating = false;

    this.showQuestion();
  }

  shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** 渲染题目 */
  showQuestion(): void {
    if (this.currentIndex >= this.currentQuestions.length) {
      this.finishQuiz();
      return;
    }
    const q = this.currentQuestions[this.currentIndex];

    if (this.mask) {
      this.mask.remove();
      this.mask = null;
    }

    const mask = document.createElement('div');
    mask.id = 'quiz-mask';
    const popup = document.createElement('div');
    popup.id = 'quiz-popup';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--background-modifier-border); flex-shrink:0;';
    const noteName = q.notePath?.split('/').pop()?.replace(/\.md$/, '') || '';
    header.innerHTML = `<span style="font-size:1rem; font-weight:600;">📝 ${noteName} (${this.currentIndex + 1}/${this.totalQuestions})</span>`;
    if (!this._reviewMode) {
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '❌';
      closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;box-shadow:none;';
      closeBtn.addEventListener('click', () => this.closeQuiz());
      header.appendChild(closeBtn);
    }
    popup.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = 'padding:16px 20px; overflow-y:auto; flex:1;';

    const qText = document.createElement('div');
    qText.textContent = q.question;
    qText.style.cssText = 'font-size:1rem; font-weight:500; margin-bottom:12px; white-space:pre-wrap;';
    body.appendChild(qText);

    const isSingle = q.correctIndices.length === 1;
    const selected = new Set<number>();

    const cleanOptionText = (t: string) => t.replace(/^\(?[A-D]\)?[.、)\s]*/, '');

    const showResult = (isCorrect: boolean, correctIndices: number[], clickedIndex: number | null = null) => {
      const btns = body.querySelectorAll('.quiz-option-btn');
      btns.forEach((b, i) => {
        b.classList.add('disabled');
        if (correctIndices.includes(i)) {
          b.classList.add('correct');
          const mark = document.createElement('span');
          mark.className = 'check-mark';
          mark.textContent = '✔️';
          b.appendChild(mark);
        } else if (selected.has(i) || i === clickedIndex) {
          b.classList.add('wrong');
        }
      });
      if (!isCorrect) {
        this.addNextButton(body);
      } else {
        setTimeout(() => this.nextQuestion(), 800);
      }
    };

    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.textContent = cleanOptionText(opt);
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled')) return;
        if (isSingle) {
          // 单选即判
          const isCorrect = q.correctIndices.includes(i);
          if (isCorrect) {
            this.correctCount++;
            this.removeCurrentQuestion();
          } else {
            this.wrongCount++;
          }
          showResult(isCorrect, q.correctIndices, i); // 单选错误：点击项标红
        } else {
          // 多选切换
          if (selected.has(i)) {
            selected.delete(i);
            btn.classList.remove('selected');
          } else {
            selected.add(i);
            btn.classList.add('selected');
          }
        }
      });
      body.appendChild(btn);
    });

    if (!isSingle) {
      const submitRow = document.createElement('div');
      submitRow.style.cssText = 'display:flex; justify-content:center; margin-top:14px;';
      const submit = document.createElement('button');
      submit.className = 'quiz-submit-btn';
      submit.textContent = '提交答案';
      submit.addEventListener('click', () => {
        if (selected.size === 0) return;
        const correctSet = new Set(q.correctIndices);
        const isCorrect = selected.size === q.correctIndices.length && [...selected].every((i) => correctSet.has(i));
        if (isCorrect) {
          this.correctCount++;
          this.removeCurrentQuestion();
        } else {
          this.wrongCount++;
        }
        showResult(isCorrect, q.correctIndices);
        submit.disabled = true;
      });
      submitRow.appendChild(submit);
      body.appendChild(submitRow);
    }

    popup.appendChild(body);
    mask.appendChild(popup);
    document.body.appendChild(mask);
    this.mask = mask;
    this.popup = popup;
  }

  removeCurrentQuestion(): void {
    const q = this.currentQuestions[this.currentIndex];
    if (q && q.notePath && q._index !== undefined) {
      this.manager.removeQuestion(this.app, q.notePath, q._index).catch(() => {});
    }
  }

  nextQuestion(): void {
    this.currentIndex++;
    this.showQuestion();
  }

  addNextButton(container: HTMLElement): void {
    if (container.querySelector('.quiz-next-btn')) return;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; justify-content:center; margin-top:14px;';
    const btn = document.createElement('button');
    btn.className = 'quiz-next-btn';
    btn.textContent = '下一题 →';
    btn.addEventListener('click', () => this.nextQuestion());
    row.appendChild(btn);
    container.appendChild(row);
  }

  /** 完成 */
  finishQuiz(): void {
    const correct = this.correctCount;
    const wrong = this.wrongCount;
    const total = this.totalQuestions || correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const results = { correct, wrong, total, accuracy };

    if (this.onComplete) {
      this.onComplete(results);
      this.onComplete = null;
      return;
    }
    this.closeQuiz();
    new Notice(`✅ 答对 ${correct} 题 ❌ 答错 ${wrong} 题，正确率 ${accuracy}%`);
  }

  closeQuiz(): void {
    if (this.mask) {
      this.mask.remove();
      this.mask = null;
    }
    this.currentQuestions = [];
    this.currentIndex = 0;
    this._reviewMode = false;
  }

  showLoadingPopup(text: string): void {
    if (this.loadingMask) this.loadingMask.remove();
    const mask = document.createElement('div');
    mask.id = 'quiz-loading';
    mask.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:10012; display:flex; align-items:center; justify-content:center;';
    const popup = document.createElement('div');
    popup.style.cssText = 'background:var(--background-primary); border-radius:12px; padding:24px 32px; text-align:center;';
    popup.innerHTML = `<div class="spinner"></div><p style="margin:0; color:var(--text-muted); font-size:.9rem;">${text}</p>`;
    mask.appendChild(popup);
    document.body.appendChild(mask);
    this.loadingMask = mask;
    this.loadingPopup = popup;
  }

  hideLoading(): void {
    if (this.loadingMask) {
      this.loadingMask.remove();
      this.loadingMask = null;
      this.loadingPopup = null;
    }
  }
}

/** 模块单例（review 域经此联动） */
export const quizUI = new QuizMasterUI({} as any);
