/**
 * 补充素材页渲染测试（issue 509 / ADR-0212）：suppPage 三页签骨架与各页签视图、
 * 录音行五态（徽章 / 进度条 / 动作按钮 / 降级标注）、recNote 进度块只列在跑与中断。
 * render 纯层（零数据访问），fixture 全构造数据。
 */
import { describe, it, expect } from 'vitest';
import { suppPage, recNote, type SuppImageViewState, type SuppRecViewState, type SuppRecRowState } from '../../src/people/render';
import type { PersonEntry } from '../../src/people/types';

const p: PersonEntry = { id: 'wxid_a', name: '老王', createdAt: '2026-09-25T00:00:00.000Z', imports: [] };

const emptyImage: SuppImageViewState = { queue: [], imported: 0, undescribed: 0, describeBusy: false, modelLabel: '智谱/glm' };
const emptyRec: SuppRecViewState = { rows: [], ref: 'missing' };

describe('suppPage 三页签骨架', () => {
  it('页签三枚（文本/图片/录音），当前页签挂 on', () => {
    const page = suppPage(p, 'text', emptyImage, emptyRec, '2026-09-28');
    const tabs = [...page.querySelectorAll<HTMLElement>('[data-people-supp-tab]')];
    expect(tabs.map((t) => t.getAttribute('data-people-supp-tab'))).toEqual(['text', 'image', 'rec']);
    expect(tabs.find((t) => t.classList.contains('on'))?.getAttribute('data-people-supp-tab')).toBe('text');
    // 文本页签 = 原「记一笔」原样收编：录入行 + 保存按钮都在
    expect(page.querySelector('[data-people-note-date]')).not.toBeNull();
    expect(page.querySelector('[data-people-note-save]')).not.toBeNull();
    expect(page.textContent).toContain('随手记与本机脸谱存在一起');
  });

  it('图片页签：选图 / 队列行（时间与归属可改）/ 落盘按钮 / 统计与生成描述', () => {
    const image: SuppImageViewState = {
      queue: [
        { path: 'E:/图/a.jpg', name: 'a.jpg', ts: new Date(2026, 8, 23, 14, 30).getTime(), peer: true },
        { path: 'E:/图/b.png', name: 'b.png', ts: new Date(2026, 8, 23, 15, 0).getTime(), peer: false },
      ],
      imported: 5,
      undescribed: 2,
      describeBusy: false,
      modelLabel: '智谱/glm',
    };
    const page = suppPage(p, 'image', image, emptyRec, '2026-09-28');
    const rows = [...page.querySelectorAll('.bz-people-supp-qrow')];
    expect(rows).toHaveLength(2);
    expect(page.querySelector<HTMLInputElement>('[data-people-supp-img-ts="0"]')?.value).toBe('2026-09-23T14:30');
    expect(page.querySelector<HTMLElement>('[data-people-supp-img-peer="1"]')?.textContent).toContain('我发的');
    expect(page.querySelector<HTMLElement>('[data-people-supp-img-peer="0"]')?.textContent).toContain('对方发的');
    expect(page.querySelector<HTMLElement>('[data-people-supp-img-import]')?.textContent).toContain('落盘并导入 2 张');
    expect(page.textContent).toContain('已入库图片 5 张 · 未描述 2 张');
    expect(page.querySelector('[data-people-supp-img-desc]')).not.toBeNull();
  });

  it('图片页签：无队列无历史时出空态；全有描述不出生成按钮', () => {
    const page = suppPage(p, 'image', { ...emptyImage, imported: 3, undescribed: 0 }, emptyRec, '2026-09-28');
    expect(page.textContent).toContain('已入库图片 3 张 · 全部有描述');
    expect(page.querySelector('[data-people-supp-img-desc]')).toBeNull();
    const fresh = suppPage(p, 'image', emptyImage, emptyRec, '2026-09-28');
    expect(fresh.textContent).toContain('还没补过图片');
  });

  it('录音页签：质心行（未建提示降级）/ 添加按钮 / 空态', () => {
    const page = suppPage(p, 'rec', emptyImage, emptyRec, '2026-09-28');
    expect(page.textContent).toContain('声纹参考');
    expect(page.textContent).toContain('未建');
    expect(page.querySelector('[data-people-supp-rec-add]')).not.toBeNull();
    expect(page.querySelector('[data-people-supp-rec-ref]')).not.toBeNull();
    expect(page.textContent).toContain('还没有录音');
  });
});

describe('录音行五态', () => {
  const base: SuppRecViewState = { rows: [], ref: 'ready' };
  const row = (over: Partial<SuppRecRowState>): SuppRecRowState => ({ file: 'r.aac', status: 'pending', phaseText: '', pct: null, ...over });

  it('pending / merged：徽章文案对，pending 出「处理」，merged 无动作', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...base, rows: [row({}), row({ file: 'b.m4a', status: 'merged', turns: 12, mode: 'dual' })] }, '2026-09-28');
    expect(page.querySelector('[data-people-supp-rec-run="r.aac"]')?.textContent).toContain('处理');
    expect(page.querySelector('[data-people-supp-rec-run="b.m4a"]')).toBeNull();
    expect(page.textContent).toContain('已并入');
    expect(page.textContent).toContain('12 轮');
  });

  it('running：进度条 + 停止按钮；interrupted：进度 + 续跑 + 降级标注', () => {
    const page = suppPage(p, 'rec', emptyImage, {
      ...base,
      rows: [
        row({ status: 'running', phaseText: '声纹窗 3000/10984', pct: 27 }),
        row({ file: 'c.m4a', status: 'interrupted', phaseText: '转写 12/579', pct: 40, mode: 'me-only' }),
      ],
    }, '2026-09-28');
    expect(page.querySelector('[data-people-supp-rec-stop="r.aac"]')).not.toBeNull();
    expect(page.querySelector('[data-people-supp-rec-run="c.m4a"]')?.textContent).toContain('续跑');
    expect(page.querySelector<HTMLElement>('.bz-people-jobs-fill[style*="27%"]')).not.toBeNull();
    expect(page.textContent).toContain('27%');
    expect(page.textContent).toContain('非我即对方');
  });

  it('awaiting-merge：待并仓徽章 + 并仓按钮（sidecar done 但没并上，如上锁竞态）', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...base, rows: [row({ status: 'awaiting-merge', phaseText: '转写完成 · 579 轮', pct: 100, turns: 579 })] }, '2026-09-28');
    expect(page.textContent).toContain('待并仓');
    expect(page.querySelector('[data-people-supp-rec-merge="r.aac"]')?.textContent).toContain('并仓');
    expect(page.querySelector('[data-people-supp-rec-run="r.aac"]')).toBeNull();
  });

  it('failed：错误行 + 重试按钮', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...base, rows: [row({ status: 'failed', errText: 'RuntimeError: boom' })] }, '2026-09-28');
    expect(page.querySelector('[data-people-supp-rec-run="r.aac"]')?.textContent).toContain('重试');
    expect(page.textContent).toContain('RuntimeError: boom');
  });
});

describe('recNote 进度块（挂画谱进度块同位置）', () => {
  it('只列在跑与中断的录音；running 计数入标题', () => {
    const rows: SuppRecRowState[] = [
      { file: 'a.aac', status: 'running', phaseText: '声纹窗 500/1000', pct: 50 },
      { file: 'b.aac', status: 'merged', phaseText: '', pct: null },
      { file: 'c.aac', status: 'interrupted', phaseText: '转写 3/9', pct: 33 },
      { file: 'd.aac', status: 'pending', phaseText: '', pct: null },
    ];
    const note = recNote(rows);
    expect(note.getAttribute('data-people-rec-note')).toBe('');
    expect(note.textContent).toContain('录音处理 · 1 条在跑');
    expect(note.textContent).toContain('a.aac');
    expect(note.textContent).toContain('c.aac');
    expect(note.textContent).not.toContain('b.aac');
    expect(note.textContent).not.toContain('d.aac');
  });
});
