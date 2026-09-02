// @vitest-environment jsdom
// 临时缺陷验证（不提交）：答错末题死局确认
import { describe, it, expect } from 'vitest';
import { SprintSession } from '../../src/review/sprint';

function mkItem(name: string, filePath: string) {
  return {
    id: name, filePath, name, reviewStart: new Date().toISOString(),
    stage: 5, phase: 'fsrs' as const, stability: 10, difficulty: 0.5,
    reviewHistory: [], totalReviews: 1, averageConfidence: 0,
    nextReviewDate: new Date(Date.now() - 1).toISOString(), lastReviewed: new Date().toISOString(),
    lastDifficulty: null, completed: false,
  } as any;
}
function mkQ(q: string, correct: number[]) {
  return { question: q, options: ['a', 'b', 'c', 'd'], correctIndices: correct };
}

async function newSession(opts: any): Promise<{ host: HTMLElement; done: Promise<string> }> {
  const host = document.createElement('div');
  let exit = false;
  const session = new SprintSession({
    host, queue: opts.queue, mode: 'round', quiz: null,
    fetchQuestions: async (item: any) => opts.questionsOf(item),
    onPassed: async () => {}, onFailed: async () => {},
    onExit: () => { exit = true; },
  } as any);
  const done = session.start().then((r) => `${r}|exit=${exit}`);
  await new Promise((r) => setTimeout(r, 30));
  return { host, done };
}

const settled = (p: Promise<string>, ms = 400) =>
  Promise.race([p, new Promise<string>((res) => setTimeout(() => res('UNSETTLED'), ms))]);

describe('缺陷验证', () => {
  it('答错末题：无任何可推进按钮，会话挂死（缺陷）', async () => {
    const { host, done } = await newSession({
      queue: [mkItem('单篇', 'n.md')],
      questionsOf: async () => [mkQ('Q1?', [0])],
    });
    const wrong = host.querySelector('.bz-sprint-opt[data-i="1"]') as HTMLElement;
    wrong.click();
    await new Promise((r) => setTimeout(r, 50));
    const html = host.innerHTML;
    const hasNext = html.includes('data-action="next"');
    const hasDone = html.includes('data-action="done"');
    const hasOpt = host.querySelectorAll('.bz-sprint-opt:not([disabled])').length;
    const st = await settled(done);
    expect({ hasNext, hasDone, hasOpt, st }).toEqual({ hasNext: false, hasDone: false, hasOpt: 0, st: 'UNSETTLED' });
  });

  it('答对末题 → 正常结算（对照）', async () => {
    const { host, done } = await newSession({
      queue: [mkItem('对', 'y.md')],
      questionsOf: async () => [mkQ('Q1?', [0])],
    });
    const ok = host.querySelector('.bz-sprint-opt[data-i="0"]') as HTMLElement;
    ok.click();
    await new Promise((r) => setTimeout(r, 900)); // 0.8s 自动跳
    const html = host.innerHTML;
    const hasNext = html.includes('data-action="next"');
    const hasDone = html.includes('data-action="done"');
    const st = await settled(done);
    expect({ hasNext, hasDone, st }).toEqual({ hasNext: true, hasDone: false, st: 'UNSETTLED' });
    // 结果卡通过 → 点 next（无下一篇）→ runNext → 无 pending → showSummary → done
    (host.querySelector('[data-action="next"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
    (host.querySelector('[data-action="done"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
    const st2 = await settled(done);
    expect(st2.startsWith('done')).toBe(true);
  });
});
