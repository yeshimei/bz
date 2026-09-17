// @vitest-environment node
/**
 * 做题练习独立面板 · 数据层测试（issue 362）：
 * 范围解析（整库/文件夹/单篇，环境目录剪枝）+ 交错选题截断 + 范围题库读取。
 * 纯层（pickRoundQuestions）与 vault 注入层（listVaultNotes/notesInFolders）同文件覆盖。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { QuizManager, QUIZ_FILE_PATH } from '../../src/review/quiz-core/manager';
import {
  listVaultNotes,
  notesInFolders,
  resolveScopeNotes,
  collectQuestionsForNotes,
  pickRoundQuestions,
} from '../../src/review/quiz-panel-data';
import type { QuizQuestion } from '../../src/review/quiz-core/manager';

function q(name: string, notePath?: string): QuizQuestion {
  return {
    question: `${name}?`,
    options: ['a', 'b', 'c', 'd'],
    correctIndices: [0],
    ...(notePath ? { notePath } : {}),
  };
}

describe('范围解析（issue 362）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('listVaultNotes：整库 md 升序；环境目录子树（node_modules/.trash 等）剪枝', () => {
    const vault = new MockVault();
    vault.files.set('B.md', 'x');
    vault.files.set('sub/A.md', 'x');
    vault.files.set('a.md', 'x');
    vault.files.set('node_modules/pkg/readme.md', 'x');
    vault.files.set('.trash/旧稿.md', 'x');
    const app = mockAppWithVault(vault);
    expect(listVaultNotes(app)).toEqual(['B.md', 'a.md', 'sub/A.md']);
  });

  it('notesInFolders：目录递归展开；空目录清单 = 空；库根 = 全部', () => {
    const vault = new MockVault();
    vault.files.set('A.md', 'x');
    vault.files.set('sub/B.md', 'x');
    vault.files.set('sub/deep/C.md', 'x');
    vault.files.set('other/D.md', 'x');
    const app = mockAppWithVault(vault);
    expect(notesInFolders(app, ['sub'])).toEqual(['sub/B.md', 'sub/deep/C.md']);
    expect(notesInFolders(app, ['sub', 'other'])).toEqual(['other/D.md', 'sub/B.md', 'sub/deep/C.md']);
    expect(notesInFolders(app, [''])).toEqual(['A.md', 'other/D.md', 'sub/B.md', 'sub/deep/C.md']);
    expect(notesInFolders(app, [])).toEqual([]);
  });

  it('resolveScopeNotes：note 范围空路径 = 空清单；有路径 = 单篇；不存在的路径过滤为空（审查修复）', () => {
    const vault = new MockVault();
    vault.files.set('A.md', 'x');
    vault.files.set('sub/B.md', 'x');
    const app = mockAppWithVault(vault);
    expect(resolveScopeNotes(app, 'note', [], '')).toEqual([]);
    expect(resolveScopeNotes(app, 'note', [], 'sub/B.md')).toEqual(['sub/B.md']);
    // 手输路径不存在（被移动/改名/拼错）→ 过滤为空清单，由面板给人话提示
    expect(resolveScopeNotes(app, 'note', [], 'GHOST.md')).toEqual([]);
    expect(resolveScopeNotes(app, 'all', [], '')).toEqual(['A.md', 'sub/B.md']);
  });
});

describe('交错选题（pickRoundQuestions）', () => {
  it('按笔记 round-robin 轮流抽取，batch 截断', () => {
    const all = [
      { ...q('A1'), notePath: 'A.md' },
      { ...q('A2'), notePath: 'A.md' },
      { ...q('A3'), notePath: 'A.md' },
      { ...q('B1'), notePath: 'B.md' },
      { ...q('B2'), notePath: 'B.md' },
    ];
    const picked = pickRoundQuestions(all, 4);
    expect(picked.map((x) => x.question)).toEqual(['A1?', 'B1?', 'A2?', 'B2?']);
  });

  it('batch ≤ 0 = 不限（全量保序）；batch 大于总量 = 全量；空清单 = 空', () => {
    const all = [
      { ...q('A1'), notePath: 'A.md' },
      { ...q('B1'), notePath: 'B.md' },
    ];
    expect(pickRoundQuestions(all, 0)).toHaveLength(2);
    expect(pickRoundQuestions(all, 99)).toHaveLength(2);
    expect(pickRoundQuestions([], 10)).toEqual([]);
  });

  it('无 notePath 的题归入同一池（不崩、可截断）', () => {
    const all = [q('X1'), q('X2'), q('X3')];
    expect(pickRoundQuestions(all, 2).map((x) => x.question)).toEqual(['X1?', 'X2?']);
  });
});

describe('范围题库读取（collectQuestionsForNotes）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    setApp(null as any);
    setSettingsProvider(() => ({} as any));
  });

  it('只读范围内笔记的题，带 notePath 供会话出库定位（题库整本入参——循环外一次读盘）', async () => {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    const qm = new QuizManager();
    await qm.saveQuestionsForNote(app, 'A.md', [q('A1'), q('A2')]);
    await qm.saveQuestionsForNote(app, 'B.md', [q('B1')]);
    expect(vault.files.get(QUIZ_FILE_PATH)).toBeTruthy();

    // 审查修复：调用方 loadQuiz 一次传入整本题库，函数内零 IO
    const bank = await qm.loadQuiz(app);
    const out = await collectQuestionsForNotes(bank, ['A.md']);
    expect(out.map((x) => x.question)).toEqual(['A1?', 'A2?']);
    expect(out.every((x) => x.notePath === 'A.md')).toBe(true);

    const none = await collectQuestionsForNotes(bank, ['C.md']);
    expect(none).toEqual([]);
  });
});
