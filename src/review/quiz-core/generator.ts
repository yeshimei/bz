/**
 * 做题家题目生成器（ticket 17 修正版：对齐源码 QuestionGenerator 逐字）
 */
import type { AIService } from '../../core/ai';
import type { QuizQuestion } from './manager';

export class QuestionGenerator {
  /** 构建提示词（源码 L92-128 逐字；item 3 增 explain 字段：一句话解析+原文依据） */
  buildPrompt(content: string, enableMultipleChoice: boolean, questionsPerNote: number, difficulty: string): string {
    const truncated = content.slice(0, 3000);
    let typeHint = '单选题（四选一）';
    let structure = `{ "question": "题目文本", "options": ["A选项","B选项","C选项","D选项"], "correctIndices": [0], "explain": "一句话解析+原文依据" }`;
    if (enableMultipleChoice) {
      typeHint = '可以是单选题或多选题（正确选项数量不限）';
      structure = `{ "question": "题目文本", "options": ["A选项","B选项","C选项","D选项"], "correctIndices": [0, 2], "explain": "一句话解析+原文依据" }（数组内为正确选项的索引）`;
    }
    let countHint = '';
    if (questionsPerNote > 0) {
      countHint = `请生成恰好 ${questionsPerNote} 道题目。`;
    } else {
      countHint = '生成若干道题目（数量适中，建议 3~6 道）。';
    }

    let difficultyHint = '';
    if (difficulty === 'easy') {
      difficultyHint = '请生成基础概念题，选项区分度明显，避免陷阱，难度较低。';
    } else if (difficulty === 'medium') {
      difficultyHint = '生成中等难度题目，可包含细节辨析，选项有一定迷惑性。';
    } else if (difficulty === 'hard') {
      difficultyHint = '生成高难度题目，可涉及推理、多知识点交叉，选项具有较强迷惑性。';
    }
    // random 或不合法：不添加难度提示，让 AI 自由决定

    return `根据以下笔记内容，生成若干道四选一的选择题（每题一个正确答案），数量适中，以便复习。请仅返回一个合法的 JSON 对象，结构如下：
{
  "questions": [
    ${structure}
  ]
}
注意：题目类型为 ${typeHint}，${countHint}
${difficultyHint}
每题必须带 explain 字段：用一句话解析正确答案，并附原文依据（简短引用或出处）。
笔记内容：
${truncated}`;
  }

  /** 提取 JSON（源码 L129-138 逐字） */
  extractJSON(text: string): any {
    const code = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (code) {
      try {
        return JSON.parse(code[1].trim());
      } catch {
        /* 继续尝试 */
      }
    }
    try {
      return JSON.parse(text.trim());
    } catch {
      /* 继续尝试 */
    }
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(text.substring(first, last + 1));
      } catch {
        /* 继续尝试 */
      }
    }
    throw new Error('无法从 AI 响应中提取有效的 JSON');
  }

  /** 生成题目（单篇，源码 L139-159 逐字） */
  async generate(noteContent: string, aiService: AIService, enableMultipleChoice: boolean, questionsPerNote: number, difficulty: string): Promise<QuizQuestion[]> {
    const prompt = this.buildPrompt(noteContent, enableMultipleChoice, questionsPerNote, difficulty);
    const result = await aiService.json(prompt);
    console.log('AI 原始响应:', result);
    const parsed = this.extractJSON(result);
    if (!parsed.questions?.length) throw new Error('AI 未返回有效题目数组。');
    for (const q of parsed.questions) {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
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
    }
    return parsed.questions;
  }

  /** 批量提示词（源码 L162-191 逐字；item 3 增 explain 规则） */
  buildBatchPrompt(notes: { id: string; content: string }[], enableMultipleChoice: boolean, questionsPerNote: number, difficulty: string): string {
    let typeHint = '单选题（四选一）';
    let structure = `{ "question": "题目文本", "options": ["A选项","B选项","C选项","D选项"], "correctIndices": [0], "explain": "一句话解析+原文依据" }`;
    if (enableMultipleChoice) {
      typeHint = '可以是单选题或多选题';
      structure = `{ "question": "题目文本", "options": ["A选项","B选项","C选项","D选项"], "correctIndices": [0, 2], "explain": "一句话解析+原文依据" }`;
    }
    const countHint = questionsPerNote > 0 ? `每篇生成恰好 ${questionsPerNote} 道。` : '每篇生成 3~6 道。';
    let difficultyHint = '';
    if (difficulty === 'easy') difficultyHint = '生成基础概念题，难度较低。';
    else if (difficulty === 'medium') difficultyHint = '生成中等难度题目。';
    else if (difficulty === 'hard') difficultyHint = '生成高难度题目，涉及推理和多知识点交叉。';

    let notesBlock = '';
    for (const n of notes) {
      notesBlock += `\n===== 笔记ID:${n.id} =====\n${n.content.slice(0, 2000)}\n`;
    }

    return `根据以下多篇笔记内容，为每篇笔记生成选择题。请仅返回一个合法的 JSON 对象：
{
  "noteId1": [ { "question": "...", "options": ["A","B","C","D"], "correctIndices": [0], "explain": "..." }, ... ],
  "noteId2": [ ... ]
}
规则：
- 类型：${typeHint}，${countHint}
- ${difficultyHint}
- 每题必须带 explain 字段：一句话解析正确答案并附原文依据
- 键名为笔记ID（即 "笔记ID:xxx" 中的 xxx），值为该笔记的题目数组
- 每题4个选项，correctIndices 为正确选项索引数组
笔记内容：${notesBlock}`;
  }

  /** 批量生成（源码 L193-212 逐字） */
  async generateBatch(notes: { id: string; content: string }[], aiService: AIService, enableMultipleChoice: boolean, questionsPerNote: number, difficulty: string): Promise<Record<string, QuizQuestion[]>> {
    const prompt = this.buildBatchPrompt(notes, enableMultipleChoice, questionsPerNote, difficulty);
    const result = await aiService.json(prompt);
    console.log('AI 批量响应:', result);
    const parsed = this.extractJSON(result);
    // 返回 { noteId: questions[] } 的映射
    const out: Record<string, QuizQuestion[]> = {};
    for (const [noteId, qs] of Object.entries(parsed)) {
      if (!Array.isArray(qs)) continue;
      const valid: QuizQuestion[] = [];
      for (const q of qs as any[]) {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || !Array.isArray(q.correctIndices)) {
          continue;
        }
        // P2：与单篇 generate 对齐——correctIndices 越界项剔除（须为 0~3 的数字），
        // 剔除后无有效索引则丢弃该题
        const indices = q.correctIndices.filter((i: any) => typeof i === 'number' && i >= 0 && i <= 3);
        if (!indices.length) continue;
        valid.push({ ...q, correctIndices: indices });
      }
      if (valid.length) out[noteId] = valid;
    }
    return out;
  }
}
