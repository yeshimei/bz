/**
 * 做题家题目生成器（ticket 17，源码 L91-213 逐字移植）
 */
import type { AIService } from '../core/ai';
import type { QuizQuestion } from './manager';

export class QuestionGenerator {
  ai: AIService | null = null;

  constructor(ai: AIService | null = null) {
    this.ai = ai;
  }

  /** 构建提示词（三难度逐字） */
  buildPrompt(notePath: string, content: string, difficulty: string, count: number | null): string {
    const isSingle = count !== null && count > 0;
    const typeHint = isSingle ? '单选题（四选一）' : '可以是单选题或多选题（正确选项数量不限）';
    const countHint = isSingle ? `请生成恰好 ${count} 道题目。` : '生成若干道题目（数量适中，建议 3~6 道）。';
    const structure = isSingle
      ? '{"question":"问题","options":["A","B","C","D"],"correctIndices":[0]}'
      : '{"question":"问题","options":["A","B","C","D"],"correctIndices":[0,2]}';

    let difficultyHint = '';
    if (difficulty === 'easy') {
      difficultyHint = '请生成基础概念题，选项区分度明显，避免陷阱，难度较低。';
    } else if (difficulty === 'medium') {
      difficultyHint = '生成中等难度题目，可包含细节辨析，选项有一定迷惑性。';
    } else if (difficulty === 'hard') {
      difficultyHint = '生成高难度题目，可涉及推理、多知识点交叉，选项具有较强迷惑性。';
    }

    return `根据以下笔记内容生成题目：
笔记：${notePath}
内容（截取前3000字）：
${content.slice(0, 3000)}

题目要求：${typeHint}
${difficultyHint}
${countHint}

严格输出 JSON 数组，每道题结构：${structure}`;
  }

  /** 从 AI 响应提取 JSON */
  extractJSON(text: string): any {
    let cleaned = text.trim();
    const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) cleaned = codeBlock[1].trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('无法从 AI 响应中提取有效的 JSON');
    }
    cleaned = cleaned.slice(start, end + 1);
    return JSON.parse(cleaned);
  }

  /** 生成题目（单篇） */
  async generate(notePath: string, content: string, difficulty: string, count: number | null): Promise<QuizQuestion[]> {
    if (!this.ai) throw new Error('AI 服务未初始化');
    const prompt = this.buildPrompt(notePath, content, difficulty, count);
    const raw = await this.ai.json(prompt, {});
    const data = this.extractJSON(raw);
    const list = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(list)) {
      throw new Error('AI 未返回有效题目数组。');
    }
    return list.map((q: any) => this.validate(q));
  }

  validate(q: any): QuizQuestion {
    if (!q || typeof q.question !== 'string' || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error('题目格式不正确：缺少 question 或 options 不是长度为4的数组');
    }
    if (!Array.isArray(q.correctIndices) || q.correctIndices.length === 0) {
      throw new Error('题目格式不正确：correctIndices 必须是非空数组');
    }
    for (const idx of q.correctIndices) {
      if (typeof idx !== 'number' || idx < 0 || idx > 3) {
        throw new Error('correctIndices 元素必须在 0~3 之间');
      }
    }
    return { question: q.question, options: q.options, correctIndices: q.correctIndices };
  }

  /** 批量提示词 */
  buildBatchPrompt(notes: { id: string; content: string }[]): string {
    const sections = notes
      .map((n) => `===== 笔记ID:${n.id} =====\n${n.content.slice(0, 2000)}`)
      .join('\n\n');
    return `根据以下笔记生成题目，键名为笔记ID：

${sections}

严格输出 JSON 对象：{"笔记ID":[{"question":"...","options":["A","B","C","D"],"correctIndices":[0]}]}`;
  }

  /** 批量生成（过滤非法题） */
  async generateBatch(prompts: { id: string; content: string }[]): Promise<Record<string, QuizQuestion[]>> {
    if (!this.ai) throw new Error('AI 服务未初始化');
    const raw = await this.ai.json(this.buildBatchPrompt(prompts), {});
    const data = JSON.parse(raw);
    const result: Record<string, QuizQuestion[]> = {};
    for (const [id, questions] of Object.entries(data)) {
      if (!Array.isArray(questions)) continue;
      const valid: QuizQuestion[] = [];
      for (const q of questions as any[]) {
        try {
          valid.push(this.validate(q));
        } catch {
          /* 过滤非法题 */
        }
      }
      if (valid.length) result[id] = valid;
    }
    return result;
  }
}
