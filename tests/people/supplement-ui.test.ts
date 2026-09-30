/**
 * 补充素材页渲染测试（issue 509 / ADR-0212）：suppPage 三页签骨架与各页签视图、
 * 录音行五态（徽章 / 进度条 / 动作按钮 / 降级标注）、recNote 进度块只列在跑与中断。
 * render 纯层（零数据访问），fixture 全构造数据。
 */
import { describe, it, expect } from 'vitest';
import { suppPage, recNote, appendSuppImageGridPage, type SuppImageViewState, type SuppRecQueueItem, type SuppRecViewState, type SuppRecRowState } from '../../src/people/render';
import type { PersonEntry } from '../../src/people/types';

const p: PersonEntry = { id: 'wxid_a', name: '老王', createdAt: '2026-09-25T00:00:00.000Z', imports: [] };

const emptyImage: SuppImageViewState = { queue: [], imported: 0, undescribed: 0, broken: 0, missing: 0, describeBusy: false, modelLabel: '智谱/glm', items: [], hidden: 0 };
const emptyRec: SuppRecViewState = { rows: [], ref: 'missing', queue: [] };

describe('suppPage 三页签骨架', () => {
  it('页签三枚（记一笔/留影/原声），当前页签挂 on', () => {
    const page = suppPage(p, 'text', emptyImage, emptyRec, '2026-09-28');
    const tabs = [...page.querySelectorAll<HTMLElement>('[data-people-supp-tab]')];
    expect(tabs.map((t) => t.getAttribute('data-people-supp-tab'))).toEqual(['text', 'image', 'rec']);
    expect(tabs.map((t) => t.textContent)).toEqual(['记一笔', '留影', '原声']);
    expect(tabs.find((t) => t.classList.contains('on'))?.getAttribute('data-people-supp-tab')).toBe('text');
    // 记一笔页签 = 录入行 + 保存按钮都在；还没记过时列位出空态提示
    expect(page.querySelector('[data-people-note-date]')).not.toBeNull();
    expect(page.querySelector('[data-people-note-save]')).not.toBeNull();
    expect(page.textContent).toContain('还没记过');
  });

  it('图片页签：选图 / 队列行（时间与归属可改）/ 落盘按钮 / 统计与生成描述', () => {
    const image: SuppImageViewState = {
      queue: [
        { path: 'E:/图/a.jpg', name: 'a.jpg', ts: new Date(2026, 8, 23, 14, 30).getTime(), peer: true },
        { path: 'E:/图/b.png', name: 'b.png', ts: new Date(2026, 8, 23, 15, 0).getTime(), peer: false },
      ],
      imported: 5,
      undescribed: 2,
      broken: 0,
      missing: 0,
      describeBusy: false,
      modelLabel: '智谱/glm',
      items: [],
      hidden: 0,
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

describe('记一笔（复评：已记的列在下面，就地撕）', () => {
  const withNotes: PersonEntry = {
    ...p,
    manualEvents: [
      { id: 'm1', ts: '2026-09-20', summary: '一起吃了火锅', createdAt: '2026-09-20T12:00:00.000Z' },
      { id: 'm2', ts: '2026-09-26', summary: '说起想换工作', createdAt: '2026-09-26T12:00:00.000Z' },
    ],
  };

  it('已有几笔：统计 + 新的在上 + 每条带「撕掉」', () => {
    const page = suppPage(withNotes, 'text', emptyImage, emptyRec, '2026-09-28');
    expect(page.textContent).toContain('已记 2 笔');
    const rows = [...page.querySelectorAll('.bz-people-note-row')];
    expect(rows.map((r) => r.querySelector('.bz-people-note-ts')?.textContent)).toEqual(['2026-09-26', '2026-09-20']);
    expect(rows[0].querySelector('.bz-people-note-sum')?.textContent).toBe('说起想换工作');
    expect(page.querySelector('[data-people-note-del="m2"]')).not.toBeNull();
  });
});

describe('留影网格（复评：缩略图 / 描述在下 / 点开看大图 / 删要问一声）', () => {
  const items = [
    { img: '2026-09/IMG_1.jpg', text: '[图片] 窗台上那只橘猫', url: '/__real-media/x/IMG_1.jpg' },
    { img: '2026-09/IMG_2.jpg', text: '', url: '/__real-media/x/IMG_2.jpg' },
  ];
  const withItems: SuppImageViewState = { ...emptyImage, imported: 2, undescribed: 1, items };

  it('缩略图懒加载 + 描述压在下面 + 未描述有占位', () => {
    const page = suppPage(p, 'image', withItems, emptyRec, '2026-09-28');
    const thumbs = [...page.querySelectorAll<HTMLImageElement>('.bz-people-supp-imgthumb')];
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute('loading')).toBe('lazy');
    expect(thumbs[0].getAttribute('data-people-supp-img-view')).toBe('2026-09/IMG_1.jpg');
    const caps = [...page.querySelectorAll('.bz-people-supp-imgcap')];
    expect(caps[0].textContent).toBe('窗台上那只橘猫');
    expect(caps[1].textContent).toBe('未描述');
    expect(caps[1].classList.contains('bz-people-supp-imgcap-none')).toBe(true);
  });

  it('点叉先落确认层（删掉/取消），不直接删', () => {
    const page = suppPage(p, 'image', { ...withItems, imgDel: '2026-09/IMG_2.jpg' }, emptyRec, '2026-09-28');
    expect(page.querySelectorAll('.bz-people-supp-imgask')).toHaveLength(1);
    expect(page.querySelector('.bz-people-supp-imgask')?.textContent).toContain('删掉这张？');
    expect(page.querySelector('[data-people-supp-img-del-ok="2026-09/IMG_2.jpg"]')).not.toBeNull();
    expect(page.querySelector('[data-people-supp-img-del-cancel]')).not.toBeNull();
  });
});

describe('留影网格分片（issue 519：千张不全量铺，哨兵兜底追加）', () => {
  const item = (n: number) => ({ img: `2026-09/IMG_${n}.jpg`, text: `[图片] 第 ${n} 张`, url: `u${n}` });
  const page = (count: number, hidden: number): HTMLElement => {
    const items = Array.from({ length: count }, (_, i) => item(i + 1));
    return suppPage(p, 'image', { ...emptyImage, imported: count + hidden, items, hidden }, emptyRec, '2026-09-28');
  };

  it('只渲染已展开分片；hidden > 0 出「还有 N 张」哨兵，铺完不哨兵', () => {
    const first = page(120, 1496);
    expect(first.querySelectorAll('.bz-people-supp-imgthumb')).toHaveLength(120);
    const more = first.querySelector<HTMLButtonElement>('[data-people-supp-img-more]');
    expect(more?.textContent).toBe('还有 1496 张 · 继续看');
    const all = page(2, 0);
    expect(all.querySelectorAll('.bz-people-supp-imgthumb')).toHaveLength(2);
    expect(all.querySelector('[data-people-supp-img-more]')).toBeNull();
  });

  it('增量追加一片：只 append 不重建既有格；哨兵原位换新文案，hidden 归 0 即移除', () => {
    const grid = page(3, 4).querySelector<HTMLElement>('.bz-people-supp-imggrid')!;
    const firstThumbs = [...grid.querySelectorAll('.bz-people-supp-imgthumb')];
    const nextPage = [item(4), item(5), item(6)];
    const more = appendSuppImageGridPage(grid, nextPage, 1);
    expect(grid.querySelectorAll('.bz-people-supp-imgthumb')).toHaveLength(6);
    expect([...grid.querySelectorAll('.bz-people-supp-imgthumb')].slice(0, 3)).toEqual(firstThumbs); // 旧格没重建
    expect(more?.textContent).toBe('还有 1 张 · 继续看');
    expect(grid.contains(more!)).toBe(true);
    const last = appendSuppImageGridPage(grid, [item(7)], 0);
    expect(grid.querySelectorAll('.bz-people-supp-imgthumb')).toHaveLength(7);
    expect(last).toBeNull();
    expect(grid.querySelector('[data-people-supp-img-more]')).toBeNull();
  });

  it('追加页的格子与全量渲染同构（描述在下、点开看大图；同源铁律）', () => {
    const grid = page(1, 1).querySelector<HTMLElement>('.bz-people-supp-imggrid')!;
    appendSuppImageGridPage(grid, [{ img: '2026-09/IMG_9.jpg', text: '', url: 'u9' }], 0);
    const added = grid.querySelectorAll('.bz-people-supp-imgcell')[1];
    expect(added.querySelector('img')?.getAttribute('data-people-supp-img-view')).toBe('2026-09/IMG_9.jpg');
    expect(added.querySelector('.bz-people-supp-imgcap')?.textContent).toBe('未描述');
    expect(added.querySelector('.bz-people-supp-imgcap')?.classList.contains('bz-people-supp-imgcap-none')).toBe(true);
  });
});


describe('质心重建（复评：只在已建时问「会覆盖」）', () => {
  it('已建 + 待确认 → 出确认块（按钮另起一行），不再出「重建质心」', () => {
    const page = suppPage(p, 'rec', emptyImage, { rows: [], ref: 'ready', queue: [], refConfirm: true }, '2026-09-28');
    const firm = page.querySelector('.bz-people-supp-reffirm')!;
    expect(firm.textContent).toContain('重建会覆盖');
    expect(firm.querySelector('.bz-people-supp-reffirm-acts [data-people-supp-rec-ref-ok]')).not.toBeNull();
    expect(firm.querySelector('[data-people-supp-rec-ref-cancel]')).not.toBeNull();
    expect(page.querySelector('[data-people-supp-rec-ref]')).toBeNull();
  });

  it('没建过就没有「覆盖」可问：refConfirm 置位也不出确认块，按钮写「建质心」', () => {
    const page = suppPage(p, 'rec', emptyImage, { rows: [], ref: 'missing', queue: [], refConfirm: true }, '2026-09-28');
    expect(page.querySelector('.bz-people-supp-reffirm')).toBeNull();
    const again = suppPage(p, 'rec', emptyImage, { rows: [], ref: 'missing', queue: [] }, '2026-09-28');
    expect(again.querySelector('[data-people-supp-rec-ref]')?.textContent).toContain('建质心');
  });
});

describe('录音行五态', () => {
  const base: SuppRecViewState = { rows: [], ref: 'ready', queue: [] };
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

  it('排队中：进度块出「N 条等待」+ 排队行的位次；有等待才出「清空队列」', () => {
    const rows: SuppRecRowState[] = [
      { file: 'a.aac', status: 'running', phaseText: '逐轮转写', pct: 40 },
      { file: 'b.aac', status: 'queued', phaseText: '', pct: null, queuePos: 1 },
      { file: 'c.aac', status: 'queued', phaseText: '', pct: null, queuePos: 2 },
    ];
    const note = recNote(rows);
    expect(note.textContent).toContain('录音处理 · 1 条在跑 · 2 条等待');
    expect(note.textContent).toContain('排队中 · 第 1 位');
    expect(note.textContent).toContain('排队中 · 第 2 位');
    expect(note.querySelector('[data-people-rec-clear-queue]')).not.toBeNull();
    const only = recNote([rows[0]]);
    expect(only.querySelector('[data-people-rec-clear-queue]')).toBeNull();
  });
});

describe('录音导入队列（ADR-0217：起点是一等数据）', () => {
  const pick = (over: Partial<SuppRecQueueItem>): SuppRecQueueItem => ({
    path: 'E:/下载/r.aac', name: 'r.aac', sha256: 'ab', startMs: null, candidates: [], ...over,
  });

  it('起点待填：整行标红、时间框空、提示写明必填；导入按钮仍在（点下去被 ui 拦）', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, queue: [pick({})] }, '2026-09-28');
    const row = page.querySelector<HTMLElement>('.bz-people-supp-qrow')!;
    expect(row.classList.contains('need-ts')).toBe(true);
    expect(page.querySelector<HTMLInputElement>('[data-people-supp-rec-ts="0"]')?.value).toBe('');
    expect(page.textContent).toContain('有 1 条还没确认起点');
    expect(page.querySelector('[data-people-supp-rec-import]')?.textContent).toContain('落盘并导入 1 条');
  });

  it('解析出的起点直接预填；多候选出下拉且选中项 = startMs', () => {
    const c = [new Date(2026, 8, 19, 10, 14).getTime(), new Date(2026, 8, 12, 10, 14).getTime(), new Date(2026, 8, 5, 10, 14).getTime()];
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, queue: [pick({ name: '大琳 周六 10点14分.aac', startMs: c[0], candidates: c })] }, '2026-09-28');
    expect(page.querySelector<HTMLInputElement>('[data-people-supp-rec-ts="0"]')?.value).toBe('2026-09-19T10:14');
    const sel = page.querySelector<HTMLSelectElement>('[data-people-supp-rec-cand="0"]')!;
    expect(sel.options).toHaveLength(3);
    expect(sel.value).toBe(String(c[0]));
    expect(sel.options[1].textContent).toBe('2026-09-12 10:14');
    expect(page.querySelector('.bz-people-supp-qrow')?.classList.contains('need-ts')).toBe(false);
  });

  it('库里有同内容 → 打「重复」标；唯一候选不出下拉', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, queue: [pick({ startMs: 1, candidates: [1], dupOf: 'r (2).aac' })] }, '2026-09-28');
    expect(page.querySelector('.bz-people-supp-qwarn')?.textContent).toContain('重复');
    expect(page.querySelector('[data-people-supp-rec-cand="0"]')).toBeNull();
    expect(page.querySelector('[data-people-supp-rec-drop="0"]')).not.toBeNull();
  });

  it('抽检存疑（Q15）：标红 + 「仍然导入」；未允许的从导入条数里扣掉', () => {
    const page = suppPage(p, 'rec', emptyImage, {
      ...emptyRec,
      queue: [pick({ startMs: 1, candidates: [1] }), pick({ name: 'b.aac', startMs: 2, candidates: [2], suspect: true })],
    }, '2026-09-28');
    expect(page.querySelector('.bz-people-supp-qwarn-hard')?.textContent).toContain('听着不像你们俩');
    expect(page.querySelectorAll('.bz-people-supp-qrow')[1].classList.contains('suspect')).toBe(true);
    expect(page.querySelector('[data-people-supp-rec-keep="1"]')?.textContent).toContain('仍然导入');
    expect(page.querySelector('[data-people-supp-rec-import]')?.textContent).toContain('落盘并导入 1 条');
    expect(page.textContent).toContain('默认不导入');
    // 允许后计数回来，且标注转「已允许」
    const kept = suppPage(p, 'rec', emptyImage, {
      ...emptyRec,
      queue: [pick({ startMs: 1, candidates: [1] }), pick({ name: 'b.aac', startMs: 2, candidates: [2], suspect: true, keep: true })],
    }, '2026-09-28');
    expect(kept.querySelector('[data-people-supp-rec-import]')?.textContent).toContain('落盘并导入 2 条');
    expect(kept.querySelector('.bz-people-supp-qwarn-hard')?.textContent).toContain('已允许');
    expect(kept.querySelector('.bz-people-supp-qrow.suspect')).toBeNull(); // 允许后不再标红
  });

  it('抽检进行中：行上写「抽检中…」', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, queue: [pick({ startMs: 1, candidates: [1], checking: true })] }, '2026-09-28');
    expect(page.textContent).toContain('抽检中…');
  });
});

describe('录音行删除入口与二次确认（issue 516 Q12/Q13/Q14）', () => {
  const base2: SuppRecViewState = { rows: [], ref: 'ready', queue: [] };
  const row = (over: Partial<SuppRecRowState>): SuppRecRowState => ({ file: 'r.aac', status: 'pending', phaseText: '', pct: null, ...over });

  it('可删态（待处理/中断/失败/待并仓/已并入）都有「删除」，处理中与排队中没有', () => {
    const rows = [
      row({}),
      row({ file: 'b.aac', status: 'interrupted' }),
      row({ file: 'c.aac', status: 'failed' }),
      row({ file: 'd.aac', status: 'awaiting-merge', pct: 100 }),
      row({ file: 'e.aac', status: 'merged' }),
      row({ file: 'f.aac', status: 'running' }),
      row({ file: 'g.aac', status: 'queued', queuePos: 1 }),
    ];
    const page = suppPage(p, 'rec', emptyImage, { ...base2, rows }, '2026-09-28');
    const has = (f: string): boolean => page.querySelector(`[data-people-supp-rec-del="${f}"]`) !== null;
    expect([has('r.aac'), has('b.aac'), has('c.aac'), has('d.aac'), has('e.aac')]).toEqual([true, true, true, true, true]);
    expect(has('f.aac')).toBe(false); // 处理中：先「停止」
    expect(has('g.aac')).toBe(false); // 排队中：先「移出队列」
  });

  it('确认面板：清单文案 + 原件勾选默认勾上 + 其它行不给确认', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...base2, rows: [row({ status: 'merged', turns: 579 })], del: { file: 'r.aac', alsoFile: true, drawn: false } }, '2026-09-28');
    expect(page.textContent).toContain('从聊天仓一并清掉');
    expect(page.textContent).toContain('同时删除录音原件');
    expect(page.querySelector<HTMLInputElement>('[data-people-supp-rec-del-file="r.aac"]')?.checked).toBe(true);
    expect(page.querySelector('[data-people-supp-rec-del-ok="r.aac"]')).not.toBeNull();
    expect(page.querySelector('[data-people-supp-rec-del-cancel="r.aac"]')).not.toBeNull();
    // 确认态下本条不再出常规动作（避免误点「并仓」）
    expect(page.querySelector('[data-people-supp-rec-merge="r.aac"]')).toBeNull();
  });

  it('未并仓 / 已画谱的文案各自就位', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...base2, rows: [row({})], del: { file: 'r.aac', alsoFile: false, drawn: true } }, '2026-09-28');
    expect(page.textContent).toContain('还没进聊天仓');
    expect(page.textContent).toContain('脸谱正文不会跟着变');
    expect(page.querySelector<HTMLInputElement>('[data-people-supp-rec-del-file="r.aac"]')?.checked).toBe(false);
    // 已并仓 + 已画谱：多一句「要反映得重新画谱」（花钱那下得说清）
    const both = suppPage(p, 'rec', emptyImage, { ...base2, rows: [row({ status: 'merged', turns: 9 })], del: { file: 'r.aac', alsoFile: true, drawn: true } }, '2026-09-28');
    expect(both.textContent).toContain('重新画谱');
  });
});

describe('录音孤儿行（issue 528：原件没了，仓里转写轮次还在）', () => {
  const base3: SuppRecViewState = { rows: [], ref: 'ready', queue: [] };
  const orphan: SuppRecRowState = { file: '大琳 周一 10点40分✔️.aac', status: 'merged', phaseText: '', pct: null, orphan: true, turns: 410 };

  it('徽章「源已失」+ 如实报仓内轮数；只留「删除」，不给改起点 / 查看轮次', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...base3, rows: [orphan] }, '2026-09-28');
    const row = page.querySelector<HTMLElement>(`.bz-people-supp-row[data-people-supp-row="${orphan.file}"]`)!;
    expect(row.querySelector('.bz-people-supp-badge')?.textContent).toBe('源已失');
    expect(row.classList.contains('orphan')).toBe(true);
    expect(row.textContent).toContain('原件已不在磁盘 · 仓内 410 条转写轮次仍在统计与素材');
    expect(row.querySelector(`[data-people-supp-rec-del="${orphan.file}"]`)).not.toBeNull();
    expect(row.querySelector(`[data-people-supp-rec-start-edit="${orphan.file}"]`)).toBeNull();
    expect(row.querySelector(`[data-people-supp-rec-turns="${orphan.file}"]`)).toBeNull();
  });

  it('页头提示块：报几条、说清去哪清；没有孤儿就不出块', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...base3, rows: [orphan] }, '2026-09-28');
    const box = page.querySelector('.bz-people-supp-orphans');
    expect(box).not.toBeNull();
    expect(box!.textContent).toContain('有 1 条录音的原件已不在磁盘');
    expect(box!.textContent).toContain('点「删除」即可清掉');
    // 正常行一个都不带 orphan 时不出块（别把没有孤儿的人页头也挂一条警告）
    const clean = suppPage(p, 'rec', emptyImage, { ...base3, rows: [{ file: 'a.aac', status: 'merged', phaseText: '', pct: null }] }, '2026-09-28');
    expect(clean.querySelector('.bz-people-supp-orphans')).toBeNull();
  });

  it('孤儿确认面板：说清清仓里几条，且不给「同时删除录音原件」勾选（原件早就不在了）', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...base3, rows: [orphan], del: { file: orphan.file, alsoFile: true, drawn: false } }, '2026-09-28');
    expect(page.textContent).toContain('原件已不在磁盘');
    expect(page.textContent).toContain('那 410 条转写轮次');
    expect(page.querySelector(`[data-people-supp-rec-del-file="${orphan.file}"]`)).toBeNull();
    expect(page.querySelector(`[data-people-supp-rec-del-ok="${orphan.file}"]`)).not.toBeNull();
  });
});

describe('库里疑似重复巡检（issue 516 Q3：只报不清）', () => {
  it('有重复组 → 出巡检块，列出每组文件名与组数；不给任何「一键清理」按钮', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, dupGroups: [['a.aac', 'a (2).aac'], ['b.m4a', 'c.m4a']] }, '2026-09-28');
    const box = page.querySelector('.bz-people-supp-dups');
    expect(box).not.toBeNull();
    expect(box!.textContent).toContain('2 组疑似重复');
    expect(box!.textContent).toContain('没有自动删');
    expect(box!.textContent).toContain('a.aac');
    expect(box!.textContent).toContain('a (2).aac');
    expect(box!.textContent).toContain('b.m4a');
    // 只报不清：块内不该有任何按钮（删除入口在行上，且要二次确认）
    expect(box!.querySelectorAll('button')).toHaveLength(0);
  });

  it('没有重复组 → 不出巡检块（空态页不啰嗦）', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, dupGroups: [] }, '2026-09-28');
    expect(page.querySelector('.bz-people-supp-dups')).toBeNull();
    const none = suppPage(p, 'rec', emptyImage, emptyRec, '2026-09-28');
    expect(none.querySelector('.bz-people-supp-dups')).toBeNull();
  });
});

describe('查看轮次预览的段界（ADR-0220 §7：同一人连续的那几轮并成一条）', () => {
  const row = (over: Partial<SuppRecRowState>): SuppRecRowState => ({ file: 'r.aac', status: 'pending', phaseText: '', pct: null, ...over });
  const lines = (): SuppRecViewState['turnsView'] => ({
    file: 'r.aac',
    meAvatar: '',
    otherAvatar: '',
    lines: [
      { idx: 1, at: '10:14:03', range: '00:03-00:07', speaker: '我', emotion: '平静', text: '喂，在吗', side: false, segHead: 1 },
      { idx: 2, at: '10:14:08', range: '00:08-00:12', speaker: '我', text: '听的到吗', side: false, segCont: true },
      { idx: 3, at: '10:14:13', range: '00:13-00:15', speaker: '其他', text: '电视里的人声', side: true },
      { idx: 4, at: '10:14:18', range: '00:18-00:22', speaker: '大琳', text: '在的', side: false, segHead: 2 },
    ],
  });

  it('录音头报「几轮 · 并成几段 · 旁音几条」——段数就是进聊天仓的条数', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, rows: [row({ status: 'awaiting-merge', turns: 4 })], turnsView: lines() }, '2026-09-28');
    const head = page.querySelector('.bz-people-chat-head');
    expect(head?.textContent).toContain('4 轮');
    expect(head?.textContent).toContain('并成 2 段');
    expect(head?.textContent).toContain('旁音 1');
  });

  it('微信式聊天流（issue 529 起与详情页「查看聊天」共用 chatStream）：两侧各带头像；无段签 / 无分割线；旁音轮收灰留档', () => {
    const v = lines()!;
    v.meAvatar = 'data:image/png;base64,xx';
    v.otherAvatar = '';
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, rows: [row({ status: 'awaiting-merge', turns: 4 })], turnsView: v }, '2026-09-28');
    const rows2 = [...page.querySelectorAll('.bz-people-chat-row')];
    expect(rows2.map((r) => r.className)).toEqual([
      'bz-people-chat-row me',
      'bz-people-chat-row me',
      'bz-people-chat-row side named',
      'bz-people-chat-row',
    ]);
    // 段签与分割线整体撤了（复评：仿微信），但旁音轮保留原文（复核没误杀）
    expect(page.querySelector('.bz-people-supp-turnseg')).toBeNull();
    expect(rows2[2].querySelector('.bz-people-chat-bub')?.textContent).toBe('电视里的人声');
    // 旁音轮不是联系人本人的声音：气泡上面写清是谁（不然一条灰气泡说不清来路）
    expect(rows2[2].querySelector('.bz-people-chat-who')?.textContent).toBe('其他');
    expect(rows2[3].querySelector('.bz-people-chat-who')).toBeNull();
    // 每轮一枚头像位：「我」用设置里的头像；对方没头像时落首字印
    expect(rows2.every((r) => r.querySelector('.bz-people-chat-ava'))).toBe(true);
    expect(rows2[0].querySelector<HTMLImageElement>('.bz-people-chat-ava img')?.getAttribute('src')).toBe('data:image/png;base64,xx');
    expect(rows2[3].querySelector('.bz-people-chat-ava .bz-people-ava-txt')?.textContent).toBe('大');
  });

  it('轮次空态：账本里还没轮次时给一句说明（不出空列表）', () => {
    const page = suppPage(p, 'rec', emptyImage, { ...emptyRec, rows: [row({ status: 'pending' })], turnsView: { file: 'r.aac', meAvatar: '', otherAvatar: '', lines: [] } }, '2026-09-28');
    expect(page.querySelector('.bz-people-chat-list')?.textContent).toContain('账本里还没有轮次');
  });
});
