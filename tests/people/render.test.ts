/**
 * 脸谱 render 纯层测试（issue 505 相册簿口径）：照片格与照片角上的印（六态）、
 * 分页与翻摊（叠纸 / 热区 / 页眉账目 / 一行两人批注）、详情页（对面翻开的那一页：
 * 动作小签 / 三折签 / 印文案 / 一眼账）、上锁封面与空册与冷读、册页弹窗外壳
 * （数据源 / 找一找 / 统计 / 档案 / 删一档）、折正文（其人 / 相交 / 纪事）、
 * 进度便签（四段百分比 / 阶段标签 / 状态按钮态）、同步进度行。
 * markup 单源的锚测试——类名与 data 钩子即 ui 委托契约。
 * 隐私口径：fixture 全构造数据。
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  AL_PER_PAGE,
  albumBlankPage,
  albumEmpty,
  albumLoad,
  albumPage,
  albumPhoto,
  albumRow,
  albumSealNode,
  albumSealOf,
  albumSpread,
  clipList,
  delPage,
  deleteTierOf,
  detailPage,
  dsPage,
  dsRow,
  dsSyncLineNode,
  dsWaterOf,
  el,
  foldBondBody,
  foldEventsBody,
  foldPersonBody,
  formatCount,
  jobsMainLine,
  jobsNote,
  jobsPercent,
  jobsStageLabel,
  jobsStagesDone,
  lastCur,
  lockCover,
  miniMarkdown,
  pageTotal,
  panelShell,
  profilePopBody,
  replyLatencySec,
  statsPopBody,
  statsText,
  subPage,
  text,
  turnLoad,
  vtName,
  type AlbumPhoto,
  type DsRowState,
  type DsSyncLine,
  type FoldCardJob,
  type JobsBlockState,
  type JobsUiStatus,
} from '../../src/people/render';
import { bondOf, personOf } from '../../src/people/types';
import type { FaceDigest, ImportRecord, PersonEntry } from '../../src/people/types';

function person(over: Partial<PersonEntry> = {}): PersonEntry {
  return {
    id: 'wxid_a', name: '陈默', createdAt: '2026-03-01T00:00:00.000Z', imports: [],
    ...over,
  };
}

const rec = (over: Partial<ImportRecord> = {}): ImportRecord => ({
  file: '数据源:陈默', importedAt: '2026-09-01T00:00:00.000Z', messageCount: 100, skippedCount: 0,
  timeFrom: '2026-01-01T00:00:00.000Z', timeTo: '2026-09-01T00:00:00.000Z', ...over,
});

const digest = (over: Partial<FaceDigest> = {}): FaceDigest => ({ events: [], generatedAt: '2026-03-12T00:00:00.000Z', ...over });

const job = (over: Partial<FoldCardJob> = {}): FoldCardJob => ({
  status: 'running', batchesDone: 3, batchesTotal: 10, stagesDone: 0, resumable: true, ...over,
});

/** 一张照片的入参（默认：待画、无新料、无提醒、无任务） */
function photo(over: Partial<AlbumPhoto> = {}): AlbumPhoto {
  return { p: person(), avatar: '', index: 0, fresh: 0, due: null, job: null, ...over };
}

const dsRowBase: DsRowState = {
  name: '林晚', displayName: '林晚', rawCount: 1204, isGroup: false, media: '语音 98 条 · 图片 156 张',
  previewCount: 1159, newCount: 45, processedTs: new Date('2026-03-01T00:00:00').getTime(), imported: true,
};

describe('竖排姓名截断（vtName）', () => {
  it('≤7 字原样，更长取前 6 字加省略号（真实数据最长 37 字）', () => {
    expect(vtName('陈默')).toBe('陈默');
    expect(vtName('周远山')).toBe('周远山');
    expect(vtName('A8号公寓连锁酒店18295475558')).toBe('A8号公寓连…');
  });
});

describe('照片格（albumPhoto）', () => {
  it('待画：不盖印——照片上压一条「还没洗出来」，底下写消息数', () => {
    const cell = albumPhoto(photo({ p: person({ imports: [rec({ messageCount: 20773 })] }) }));
    expect(cell.classList.contains('bz-people-todo')).toBe(true);
    expect(cell.querySelector('.bz-people-blank')!.textContent).toBe('还没洗出来');
    expect(cell.querySelector('.bz-people-seal')).toBeNull(); // 还没洗出来就不盖印
    expect(cell.querySelector('.bz-people-meta')!.textContent).toBe('2.1 万 条');
  });

  it('格子的钩子即委托契约：pocket 用 id（改名不漂）、键盘可达、标签带条数', () => {
    const cell = albumPhoto(photo({ p: person({ imports: [rec({ messageCount: 12 })] }), index: 4 }));
    expect(cell.dataset.peoplePocket).toBe('wxid_a');
    expect(cell.getAttribute('tabindex')).toBe('0');
    expect(cell.getAttribute('role')).toBe('button');
    expect(cell.getAttribute('style')).toContain('--i:4'); // 显影 / 飞进来的先后
    expect(cell.getAttribute('aria-label')).toBe('陈默 · 12 条消息');
  });

  it('新素材贴纸与提醒贴纸：都贴在照片那一层（膜下）', () => {
    const cell = albumPhoto(photo({ fresh: 45, due: { what: '生日', date: '10-02', days: 5 } }));
    expect(cell.querySelector('.bz-people-fresh')!.textContent).toBe('新 45');
    const due = cell.querySelector('.bz-people-due')!;
    expect(due.textContent).toBe('生日 5 天');
    expect(due.getAttribute('title')).toBe('生日 · 10-02');
    expect(cell.querySelector('.bz-people-print')!.contains(cell.querySelector('.bz-people-photo'))).toBe(true);
  });

  it('画谱中的格子：印是按钮、底下写「画谱中 N%」；排队 / 中断 / 失败各有词', () => {
    const running = albumPhoto(photo({ job: job({ batchesDone: 3, batchesTotal: 10 }) }));
    expect(running.querySelector<HTMLButtonElement>('.bz-people-seal-run')!.dataset.peopleSealAct).toBe('pause');
    expect(running.querySelector('.bz-people-meta')!.textContent).toBe('画谱中 23%');

    const queued = albumPhoto(photo({ job: job({ queued: true }) }));
    expect(queued.classList.contains('bz-people-wait')).toBe(true);
    expect(queued.querySelector('.bz-people-meta')!.textContent).toBe('排队中');

    const halted = albumPhoto(photo({ job: job({ status: 'paused' }) }));
    expect(halted.querySelector('.bz-people-seal-halted')!.textContent).toBe('歇');
    expect(halted.querySelector('.bz-people-meta')!.textContent).toBe('已暂停');

    const failed = albumPhoto(photo({ job: job({ status: 'error', resumable: false }) }));
    expect(failed.querySelector('.bz-people-seal-halted')!.textContent).toBe('停');
    expect(failed.querySelector('.bz-people-meta')!.textContent).toBe('失败待续');
  });

  it('任务已完成（done）：印与底下都回落到脸谱水位与消息数', () => {
    const drawn = albumPhoto(photo({ p: person({ digest: digest({ person: '## 速写' }), imports: [rec({ messageCount: 8 })] }), job: job({ status: 'done' }) }));
    expect(drawn.querySelector('.bz-people-seal-drawn')!.textContent).toBe('绘');
    expect(drawn.querySelector('.bz-people-meta')!.textContent).toBe('8 条');
  });

  it('无头像走首字印（印色按名字取色，一页里不至于一片红）', () => {
    const cell = albumPhoto(photo({ p: person({ name: '林晚' }) }));
    const ava = cell.querySelector<HTMLElement>('.bz-people-ava-txt')!;
    expect(ava.textContent).toBe('林');
    expect(ava.getAttribute('style')).toContain('hsl(');
  });
});

describe('照片角上的印（albumSealOf 六态）', () => {
  it('还没洗出来：不出印、没有动作（印不上屏，动作在详情页）', () => {
    const s = albumSealOf(person(), null);
    expect(s.state).toBe('none');
    expect(s.text).toBe('');
    expect(s.action).toBeNull();
    expect(albumSealNode(person(), null)).toBeNull();
  });

  it('画谱中：金印带进度环（pct 与进度便签同口径），点印 = 本批做完后暂停', () => {
    const s = albumSealOf(person(), job({ batchesDone: 3, batchesTotal: 10 }));
    expect(s.state).toBe('running');
    expect(s.text).toBe('画');
    expect(s.pct).toBe(23); // (3+0)/(10+3)
    expect(s.action).toBe('pause');
    expect(s.title).toContain('本批做完后暂停');
    const node = albumSealNode(person(), job({ batchesDone: 3, batchesTotal: 10 }))!;
    expect(node.tagName).toBe('BUTTON');
    expect((node as HTMLButtonElement).type).toBe('button');
    expect(node.getAttribute('aria-label')).toBe('暂停生成：陈默');
    const arc = node.querySelector('.bz-people-seal-arc')!;
    expect(arc.getAttribute('style')).toBe('stroke-dasharray:23 100');
  });

  it('工具段 / 描述段进度优先于批口径（469 / 470）：给的是段内总进度', () => {
    expect(albumSealOf(person(), job({ prepPct: 41 })).pct).toBe(41);
    expect(albumSealOf(person(), job({ prepPct: 41, describePct: 77 })).pct).toBe(77);
  });

  it('排队中：不迭进度，只写「等」（一人一任务顺序跑）', () => {
    const s = albumSealOf(person(), job({ queued: true, batchesDone: 0 }));
    expect(s.state).toBe('queued');
    expect(s.text).toBe('等');
    expect(s.pct).toBeUndefined();
    expect(s.action).toBeNull();
  });

  it('画谱中断：可续显「歇 / 停」并说清不重画；漂移判废（接不上）改指去详情页重新生成', () => {
    const paused = albumSealOf(person(), job({ status: 'paused', batchesDone: 12, batchesTotal: 60 }));
    expect(paused.state).toBe('halted');
    expect(paused.text).toBe('歇');
    expect(paused.title).toContain('12/60 批');
    expect(paused.title).toContain('已画完的批次不重画');

    const err = albumSealOf(person(), job({ status: 'error' }));
    expect(err.text).toBe('停');
    const dead = albumSealOf(person(), job({ status: 'error', resumable: false }));
    expect(dead.state).toBe('halted');
    expect(dead.title).toContain('接不上');
    expect(dead.title).toContain('重新生成');
  });

  it('已画谱：有锚点显「画」（补画用），无锚点显「绘」；旧单卷显「旧」', () => {
    const anchored = albumSealOf(person({ digest: digest({ person: '## 一' }), lastProcessedTs: Date.now() }), null);
    expect(anchored.state).toBe('drawn');
    expect(anchored.text).toBe('画');
    expect(albumSealOf(person({ digest: digest({ person: '## 一' }) }), null).text).toBe('绘');
    const legacy = albumSealOf(person({ digest: digest({ portrait: '旧单卷' }) }), null);
    expect(legacy.state).toBe('legacy');
    expect(legacy.text).toBe('旧');
    expect(legacy.title).toContain('重画');
  });

  it('任务态压过脸谱水位：已有脸谱又在中途补画 → 显「画谱中」而非「已画」', () => {
    const s = albumSealOf(person({ digest: digest({ person: '## 一' }), lastProcessedTs: Date.now() }), job({ batchesDone: 5 }));
    expect(s.state).toBe('running');
    expect(s.pct).toBe(38); // (5+0)/(10+3)
  });

  it('非 running 的印只是标记块（不带暂停钩子）：原位换印换的是同一个节点形态', () => {
    const halted = albumSealNode(person(), job({ status: 'interrupted', batchesDone: 2 }))!;
    expect(halted.tagName).toBe('DIV');
    expect(halted.classList.contains('bz-people-seal-halted')).toBe(true);
    expect(halted.dataset.peopleSealAct).toBeUndefined();
    expect(halted.textContent).toBe('歇');
  });
});

describe('面板壳与统计行', () => {
  it('壳含册页摊 / 两个册签 / 进度便签槽 / 横幅槽（data 钩子即委托契约）', () => {
    const shell = panelShell();
    expect(shell.classList.contains('bz-people-panel')).toBe(true);
    expect(shell.querySelector('[data-people-spread]')).toBeTruthy();
    expect(shell.querySelector('[data-people-dialog="find"]')!.textContent).toBe('找一找');
    expect(shell.querySelector('[data-people-dialog="ds"]')!.textContent).toBe('数据源');
    expect(shell.querySelector('[data-people-jobs-slot]')).toBeTruthy();
    expect(shell.querySelector('[data-people-banner-slot]')).toBeTruthy();
  });

  it('统计行：万格式化（实测量级 max 20,773）与空库文案', () => {
    const p = person({ imports: [rec({ messageCount: 20773 })] });
    expect(statsText([p])).toContain('2.1 万');
    expect(statsText([])).toBe('还没有人物');
  });

  it('formatCount：万以上一位小数（余数 ≥100 才带），其余千分位', () => {
    expect(formatCount(20773)).toBe('2.1 万');
    expect(formatCount(12847)).toBe('1.3 万');
    expect(formatCount(20100)).toBe('2 万');
    expect(formatCount(1284)).toBe('1,284');
  });
});

describe('分页与翻摊（pageTotal / lastCur / turnLoad）', () => {
  it('一页贴 6 张、一摊两页：页数与最后一摊的左页序号都是偶数', () => {
    expect(AL_PER_PAGE).toBe(6);
    expect(pageTotal(0)).toBe(1);
    expect(pageTotal(6)).toBe(1);
    expect(pageTotal(7)).toBe(2);
    expect(pageTotal(13)).toBe(3);
    expect(lastCur(1)).toBe(0);
    expect(lastCur(2)).toBe(0);
    expect(lastCur(3)).toBe(2);
    expect(lastCur(5)).toBe(4);
  });

  it('两侧余量折算成还能翻几次（每摊两页）', () => {
    expect(turnLoad(0, 4)).toEqual({ left: { pages: 0, flips: 0 }, right: { pages: 2, flips: 1 } });
    expect(turnLoad(2, 8)).toEqual({ left: { pages: 2, flips: 1 }, right: { pages: 4, flips: 2 } });
    expect(turnLoad(2, 4)).toEqual({ left: { pages: 2, flips: 1 }, right: { pages: 0, flips: 0 } });
  });

  it('翻页热区：有页才出，读屏标签报还有几页；叠纸按次数露边、最多 4 层', () => {
    const spread = albumSpread([el('div', 'half')], turnLoad(2, 8));
    expect(spread.classList.contains('bz-people-page-wrap')).toBe(true);
    const root = spread.querySelector('[data-people-spread]')!;
    expect(root.querySelector('[data-people-turn="prev"]')!.getAttribute('aria-label')).toBe('往前翻一摊（前面还有 2 页）');
    expect(root.querySelector('[data-people-turn="next"]')!.getAttribute('aria-label')).toBe('往后翻一摊（后面还有 4 页）');
    expect(root.querySelectorAll('.bz-people-stack-l i')).toHaveLength(1);
    expect(root.querySelectorAll('.bz-people-stack-r i')).toHaveLength(2);

    const single = albumSpread([el('div', 'half')], { left: { pages: 0, flips: 0 }, right: { pages: 0, flips: 0 } });
    expect(single.querySelectorAll('[data-people-turn]')).toHaveLength(0);

    const far = albumSpread([], { left: { pages: 0, flips: 0 }, right: { pages: 20, flips: 10 } });
    expect(far.querySelectorAll('.bz-people-stack-r i')).toHaveLength(4); // 再多也只露 4 层
  });

  it('一摊带翻摊动效类；弹窗单页那摊铺满整册', () => {
    const t = albumSpread([], turnLoad(0, 4), { turn: 'next' });
    expect(t.querySelector('[data-people-spread]')!.classList.contains('bz-people-turn-next')).toBe(true);
    const one = albumSpread([], { left: { pages: 0, flips: 0 }, right: { pages: 0, flips: 0 } }, { mod: 'bz-people-spread-one' });
    expect(one.querySelector('[data-people-spread]')!.classList.contains('bz-people-spread-one')).toBe(true);
  });
});

describe('一页（albumPage）与一行两张（albumRow）', () => {
  const cells = (n: number): Array<AlbumPhoto | null> =>
    Array.from({ length: n }, (_, i) => photo({ p: person({ id: `w${i}`, name: `人${i}` }), index: i }));

  it('第一页报总账（几位 · 多少条 · 几张脸谱），空位补足一页', () => {
    const page = albumPage(cells(2), 1, 2, { faces: 1, msgs: 20773 });
    expect(page.querySelector('.bz-people-head-count')!.textContent).toBe('1 / 1');
    expect(page.querySelector('.bz-people-head-label')!.textContent).toBe('最近说过话的');
    const ledger = page.querySelector('.bz-people-head-ledger')!;
    expect(ledger.textContent).toBe('共 2 位 · 2.1 万 条 · 1 张脸谱');
    expect(page.querySelectorAll('.bz-people-row')).toHaveLength(3); // 6 格 = 3 行（空位补满）
    expect(page.querySelectorAll('.bz-people-cell')).toHaveLength(6);
    expect(page.querySelectorAll('.bz-people-vacant')).toHaveLength(4);
  });

  it('往后每页只报这一页的说话跨度（越简越不抢版面）', () => {
    const page = albumPage(cells(6), 2, 7, { faces: 0, msgs: 0 });
    expect(page.querySelector('.bz-people-head-count')!.textContent).toBe('2 / 2');
    expect(page.querySelector('.bz-people-head-label')).toBeNull();
    expect(page.querySelector('.bz-people-head-note')!.textContent).toBe('人5 ~ 人0');
  });

  it('贴相区 = 网格 + 一整张罩在上面的透明膜（膜比网格宽一圈，才像隔层）', () => {
    const page = albumPage(cells(1), 1, 1, { faces: 0, msgs: 0 });
    const sleeve = page.querySelector('.bz-people-boardarea > .bz-people-sleeve')!;
    expect(sleeve.querySelector('.bz-people-board')).toBeTruthy();
    expect(sleeve.querySelector('.bz-people-film')).toBeTruthy(); // 膜在网格之后 = 罩在上面
  });

  it('一行两张底下那条手写批注：共同标签 → 「都算」；同年认识 → 年份；都没有 → 留空线', () => {
    const a = photo({ p: person({ id: 'a', name: '甲', profile: { tags: ['大学同学'] }, imports: [rec({ timeFrom: '2019-03-01T00:00:00.000Z' })] }) });
    const b = photo({ p: person({ id: 'b', name: '乙', profile: { tags: ['大学同学'] }, imports: [rec({ timeFrom: '2021-03-01T00:00:00.000Z' })] }) });
    expect(albumRow(a, b).querySelector('.bz-people-row-note')!.textContent).toBe('都算「大学同学」');

    const c = photo({ p: person({ id: 'c', name: '丙', imports: [rec({ timeFrom: '2019-06-01T00:00:00.000Z' })] }) });
    const d = photo({ p: person({ id: 'd', name: '丁', imports: [rec({ timeFrom: '2019-12-01T00:00:00.000Z' })] }) });
    expect(albumRow(c, d).querySelector('.bz-people-row-note')!.textContent).toBe('2019 年认识的');

    expect(albumRow(c, null).querySelector('.bz-people-row-note')!.textContent).toBe('');
  });

  it('衬纸按这一行的最早年份黄一档（翻页时一眼看出时间段）', () => {
    const old = photo({ p: person({ imports: [rec({ timeFrom: '2018-05-01T00:00:00.000Z' })] }) });
    const recent = photo({ p: person({ imports: [rec({ timeFrom: '2025-05-01T00:00:00.000Z' })] }) });
    expect(albumRow(old, null).dataset.era).toBe('3');
    expect(albumRow(recent, null).dataset.era).toBe('0');
  });

  it('一次性动效按 id 名单挂类（issue 507）：飞回认名单、显影认那一位，别人不受累', () => {
    const a = photo({ p: person({ id: 'wxid_a', name: '陈默' }) });
    const b = photo({ p: person({ id: 'wxid_b', name: '林晚' }) });
    const page = albumPage([a, b], 1, 2, { faces: 0, msgs: 0 }, { drop: ['wxid_b'], dev: 'wxid_a' });
    const cellA = page.querySelector<HTMLElement>('[data-people-pocket="wxid_a"]')!;
    const cellB = page.querySelector<HTMLElement>('[data-people-pocket="wxid_b"]')!;
    expect(cellA.classList.contains('bz-people-dev')).toBe(true); // 刚画完那位显影
    expect(cellA.classList.contains('bz-people-drop')).toBe(false);
    expect(cellB.classList.contains('bz-people-drop')).toBe(true); // 刚导进来那位飞回
    expect(cellB.classList.contains('bz-people-dev')).toBe(false);
    // 不给名单 = 一点类都不挂（同页后续重画不重放）
    const plain = albumPage([a], 1, 1, { faces: 0, msgs: 0 });
    expect(plain.querySelector('[data-people-pocket="wxid_a"]')!.classList.contains('bz-people-dev')).toBe(false);
    expect(plain.querySelector('[data-people-pocket="wxid_a"]')!.classList.contains('bz-people-drop')).toBe(false);
  });

  it('后半摊占位页（issue 507）：6 个空位 + 不报页码（免得出现「第 2 / 1 页」这种伪编号）', () => {
    const blank = albumBlankPage();
    expect(blank.querySelectorAll('.bz-people-vacant')).toHaveLength(AL_PER_PAGE);
    expect(blank.querySelector('.bz-people-head-count-in')).toBeNull(); // 不编号（报页码就成伪编号了）
    expect(blank.querySelector('.bz-people-head-count')!.textContent).toBe('空页');
    expect(blank.querySelector('.bz-people-sleeve')).toBeTruthy(); // 是张「纸」，不是一块空 div
  });
});

describe('「另有 N 条」的收口（clipList，issue 507）', () => {
  const items = (n: number): HTMLElement[] => Array.from({ length: n }, (_, i) => el('div', 'x', text(`第${i + 1}条`)));

  it('超量：可见的照旧站着、多出来的挂着 hide、末尾一枚点得开的小签', () => {
    const box = clipList('bz-people-list', items(5), 2, '…另有 3 条');
    expect(box.className).toBe('bz-people-list');
    expect(box.querySelectorAll('.x')).toHaveLength(5); // 全量都在（数据本来就有）
    expect(box.querySelectorAll('.bz-people-more-hide')).toHaveLength(3);
    const more = box.querySelector<HTMLElement>('[data-people-more]')!;
    expect(more.textContent).toBe('…另有 3 条');
    expect(more.tagName).toBe('BUTTON');
    expect((more as HTMLButtonElement).type).toBe('button'); // 册页里不该当 submit
  });

  it('不超量：一枚小签都不冒出来', () => {
    const box = clipList('bz-people-list', items(2), 2, '…另有 0 条');
    expect(box.querySelector('[data-people-more]')).toBeNull();
    expect(box.querySelectorAll('.bz-people-more-hide')).toHaveLength(0);
  });
});

describe('上锁封面 / 空册 / 冷读（issue 483 / 505）', () => {
  it('上锁：整册合着——封皮 + 搭扣 + 解锁与取消两个动作，一位联系人都看不见', () => {
    const cover = lockCover();
    expect(cover.querySelector('.bz-people-cover-title')!.textContent).toBe('脸谱');
    expect(cover.querySelector('.bz-people-clasp [data-lucide="lock"]')).toBeTruthy();
    expect(cover.querySelector('[data-people-lock="unlock"]')!.textContent).toContain('解锁保险库');
    expect(cover.querySelector('[data-people-lock="cancel"]')!.textContent).toBe('取消');
    expect(cover.querySelector('.bz-people-cell')).toBeNull();
  });

  it('空册：左页全是空位，右页一张说明纸 + 「打开数据源」', () => {
    const empty = albumEmpty();
    expect(empty.querySelectorAll('.bz-people-vacant')).toHaveLength(AL_PER_PAGE);
    expect(empty.textContent).toContain('还没贴一张照片');
    expect(empty.querySelector('[data-people-dialog="ds"]')!.textContent).toBe('打开数据源');
  });

  it('冷读：页眉写「解密中」，左页进度卡（大数字 + 分母 + 进度条原位刷新钩子），两页各说一句（issue 514）', () => {
    const load = albumLoad(1, 2);
    expect(load.querySelectorAll('.bz-people-spread-load')).toHaveLength(1);
    const num = load.querySelector<HTMLElement>('[data-people-load-num]')!;
    expect(num.textContent).toBe('1');
    expect(load.querySelector<HTMLElement>('.bz-people-load-total')!.textContent).toBe('/ 2 位');
    expect(load.querySelector<HTMLElement>('[data-people-load-fill]')!.getAttribute('style')).toContain('50%');
    expect(load.textContent).toContain('正在解密联系人数据');
    expect(load.textContent).toContain('解密完就摊开');
    expect(load.textContent).not.toContain('陈默'); // 解密期间不露任何联系人名
    const noTotal = albumLoad(1, null);
    expect(noTotal.querySelector<HTMLElement>('[data-people-load-num]')!.textContent).toBe('1');
    // 清单未读到：分母位常驻但只显「位」，paintLoadCount 读到后原位补 `/ N 位`
    expect(noTotal.querySelector<HTMLElement>('.bz-people-load-total')!.textContent).toBe('位');
  });
});

// ---------------- 双卷兼容读与折正文（issue 455） ----------------

describe('双卷兼容读（personOf / bondOf 单源）', () => {
  it('新数据读 person/bond；旧单卷回落 portrait；空 digest 兜空串', () => {
    expect(personOf({ person: '新其人', portrait: '旧画像', events: [], generatedAt: '' })).toBe('新其人');
    expect(personOf({ portrait: '旧画像', events: [], generatedAt: '' })).toBe('旧画像');
    expect(personOf({ person: '其人', events: [], generatedAt: '' })).toBe('其人');
    expect(personOf(undefined)).toBe('');
    expect(bondOf({ bond: '我们', events: [], generatedAt: '' })).toBe('我们');
    expect(bondOf({ portrait: '旧画像', events: [], generatedAt: '' })).toBe('');
    expect(bondOf(undefined)).toBe('');
  });
});

describe('折正文：其人 / 相交 / 纪事', () => {
  it('其人折：markdown + 特质 + 代表原话 + 最近在聊什么 + 留下的片刻', () => {
    const p = person({
      digest: digest({
        person: '## 速写\n- 话少',
        traits: ['口头禅「行吧」'],
        quotes: [{ ts: '2026-03-01', who: '我', text: '行' }],
        interests: [{ ts: '2026-04-01', topic: '露营' }],
        moments: [{ ts: '2026-05-01', summary: '一起看了日落' }],
      }),
    });
    const body = foldPersonBody(miniMarkdown('## 速写\n- 简短'), p);
    expect(body[0].classList.contains('bz-people-portrait')).toBe(true);
    expect(body.map((n) => n.textContent).join('')).toContain('代表原话');
    expect(body.map((n) => n.textContent).join('')).toContain('最近在聊什么');
    expect(body.map((n) => n.textContent).join('')).toContain('留下的片刻');
    expect(body[1].textContent).toBe('性格特质');
  });

  it('其人折空态：一句话说清「为什么还空着」，动作在详情头的画笔钮上', () => {
    const empty = foldPersonBody(null, person());
    expect(empty).toHaveLength(1);
    expect(empty[0].textContent).toContain('其人画像还没生成——画一次脸谱就会写出来。');
    expect(empty[0].classList.contains('bz-people-empty-hint')).toBe(true);
    expect(empty[0].querySelector('[data-people-dialog="ds"]')).toBeNull();
  });

  it('相交折：markdown + 未竟之事；空态说清成因（旧单卷 portrait 不进相交折）', () => {
    const body = foldBondBody(miniMarkdown('## 相交\n- 常聊'), person({
      digest: digest({ bond: '## 相交', threads: [{ ts: '2026-04-01', text: '说好一起去露营' }] }),
    }));
    expect(body[0].querySelectorAll('.bz-md-it')).toHaveLength(1); // 层次化条目（不再出 ul/li）
    expect(body.map((n) => n.textContent).join('')).toContain('未竟之事');
    const empty = foldBondBody(null, person());
    expect(empty[0].textContent).toContain('关系画像还没生成——画一次脸谱就会写出来。');
    expect(empty[0].querySelector('[data-people-dialog="ds"]')).toBeNull();
  });

  it('纪事折：编年在前、按月事件在后（首月展开、多数条给计数）、随手记收尾可撕', () => {
    const p = person({
      digest: digest({
        chronicle: '## 一\n- 认识',
        events: [
          { ts: '2026-03-05', summary: '认识', kind: 'major' },
          { ts: '2026-03-09', summary: '第一次吃饭' },
          { ts: '2026-04-02', summary: '一起露营' },
        ],
      }),
      manualEvents: [{ id: 'm1', ts: '2026-05-01', summary: '借了书', createdAt: '' }],
    });
    const body = foldEventsBody(p);
    expect(body[0].classList.contains('bz-people-chron')).toBe(true);
    expect(body[1].classList.contains('bz-people-ev-divider')).toBe(true);
    const months = [...body[2].querySelectorAll('.bz-people-mon')];
    expect(months).toHaveLength(2);
    expect(months[0].classList.contains('on')).toBe(true); // 首月默认展开
    expect(months[0].querySelector('.bz-people-mon-cnt')!.textContent).toBe('2 条');
    expect(body[2].querySelectorAll('.bz-people-ev')).toHaveLength(3);
    expect(body[3].textContent).toBe('随手记');
    expect(body[4].querySelector('[data-people-note-del="m1"]')!.textContent).toBe('撕掉');
  });

  it('纪事折全空：只说一句成因（不摆空壳）', () => {
    const body = foldEventsBody(person());
    expect(body).toHaveLength(1);
    expect(body[0].textContent).toContain('交往纪事还没生成——画一次脸谱就会排出来。');
  });
});

// ---------------- 详情页：对面翻开的那一页 ----------------

describe('详情页（detailPage）', () => {
  const drawn = (): PersonEntry => person({
    digest: digest({ person: '## 速写\n- 话少' }),
    lastProcessedTs: new Date('2026-03-12T12:00:00').getTime(),
    imports: [rec({ messageCount: 20773 })],
  });

  const opts = (over: Partial<Parameters<typeof detailPage>[1]> = {}) => ({
    side: 'right' as const, fold: 'p' as const, avatar: '', body: [], job: null, facts: null, ...over,
  });

  it('页眉：标题带人名 + 「合上这页」；页根挂钩子（id 定位）', () => {
    const page = detailPage(drawn(), opts());
    expect(page.dataset.peopleDetail).toBe('wxid_a');
    expect(page.querySelector('.bz-people-head-label')!.textContent).toBe('脸谱 · 陈默');
    const back = page.querySelector('[data-people-act="back"]')!;
    expect(back.textContent).toBe('合上这页');
    expect(page.classList.contains('bz-people-sit-r')).toBe(true); // 翻在右边那页
    expect(detailPage(drawn(), opts({ side: 'left' })).classList.contains('bz-people-sit-l')).toBe(true);
  });

  it('动作小签六枚按序：画谱是主路在最前，删除自带 id 钩子，合上在最后', () => {
    const acts = detailPage(drawn(), opts()).querySelector('.bz-people-acts')!;
    expect([...acts.children].map((n) => n.getAttribute('data-people-act')))
      .toEqual(['generate', 'note', 'stats', 'prof', 'del', 'back']);
    expect(acts.querySelector('[data-people-del]')!.getAttribute('data-people-del')).toBe('wxid_a');
    expect(acts.querySelector('[data-people-act="generate"]')!.textContent).toContain('补画脸谱');
    expect([...acts.children].every((n) => (n as HTMLButtonElement).type === 'button')).toBe(true);
  });

  it('头一个动作跟着任务态与水位走：待画 → 画脸谱；中断 → 继续生成（不从头重烧）', () => {
    const labelOf = (p: PersonEntry, j: FoldCardJob | null) =>
      detailPage(p, opts({ job: j })).querySelector('[data-people-act="generate"]')!.textContent!;
    expect(labelOf(person(), null)).toContain('画脸谱');
    expect(labelOf(person(), null)).toContain('用已导入的消息生成');
    expect(labelOf(person(), job({ status: 'paused' }))).toContain('继续生成');
    expect(labelOf(person(), job({ status: 'paused' }))).toContain('不从头重烧');
  });

  it('头上那枚印的文案：待画 / 旧版 / 画谱中 / 画到 日期', () => {
    const stampOf = (p: PersonEntry, j: FoldCardJob | null) =>
      detailPage(p, opts({ job: j })).querySelector('.bz-people-dt-stamp')!.textContent;
    expect(stampOf(person(), null)).toBe('待画');
    expect(stampOf(person({ digest: digest({ portrait: '旧' }) }), null)).toBe('旧版');
    expect(stampOf(person(), job({ status: 'running' }))).toBe('画谱中');
    expect(stampOf(drawn(), null)).toBe('画到 2026-03-12');
    expect(stampOf(person({ digest: digest({ person: '## 一' }) }), null)).toBe('已画');
  });

  it('三折签（其人 / 相交 / 纪事）：展开那折带 on，折签挂切换钩子；折页标题与正文就位', () => {
    const page = detailPage(drawn(), opts({ fold: 'b', body: [el('div', 'body-x')] }));
    const tabs = [...page.querySelectorAll('[data-people-fold]')];
    expect(tabs.map((t) => t.getAttribute('data-people-fold'))).toEqual(['p', 'b', 'e']);
    expect(tabs.map((t) => t.textContent)).toEqual(['其人', '相交', '纪事']);
    expect(tabs[1].classList.contains('on')).toBe(true);
    expect(tabs[0].classList.contains('on')).toBe(false);
    expect(tabs[0].hasAttribute('data-people-leaf-head')).toBe(true);
    expect(page.querySelector('.bz-people-fsheet-title')!.textContent).toBe('卷二 · 关系画像');
    expect(page.querySelector('.bz-people-fsheet-body .body-x')).toBeTruthy();
  });

  it('一眼账：谁先开口 × 关系标签 × 重要日子（近 30 天）不重不漏', () => {
    const soon = new Date(Date.now() + 5 * 86400000);
    const p = person({
      profile: { tags: ['大学同学'], importantDates: [{ date: `${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`, what: '生日' }] },
      imports: [rec()],
    });
    const page = detailPage(p, opts({ facts: { mePct: 62, month: ['2026-05', 397], images: 12, voices: 3 } }));
    expect(page.querySelector('.bz-people-dt-tags .bz-people-stk')!.textContent).toBe('大学同学');
    expect(page.querySelector('.bz-people-due-line')!.textContent).toContain('生日');
    const facts = [...page.querySelectorAll('.bz-people-fact')].map((n) => n.textContent!);
    expect(facts[0]).toContain('我 62%');
    expect(facts.some((f) => f.includes('最热的一月'))).toBe(true);
    expect(facts.some((f) => f.includes('素材水位'))).toBe(true);
  });

  it('无一眼账数据时那一片不贴（facts 传 null）；账目行仍说清条数与有没有画过', () => {
    const page = detailPage(person({ imports: [rec({ messageCount: 1204 })] }), opts());
    expect(page.querySelector('.bz-people-dt-facts')).toBeNull();
    const meta = page.querySelector('.bz-people-dt-meta')!.textContent!;
    expect(meta).toContain('1,204 条消息');
    expect(meta).toContain('还没画过脸谱');
  });
});

// ---------------- 删除门禁档（issue 500 / 502 续） ----------------

describe('删除门禁档（deleteTierOf）', () => {
  const jobOf = (status: JobsUiStatus): FoldCardJob => ({ status, batchesDone: 1, batchesTotal: 3, stagesDone: 0, resumable: true });

  it('手上还有没跑完的任务 = 画谱未完成（未画谱也要拦一下）；任务跑完 / 没有任务才看脸谱水位', () => {
    expect(deleteTierOf(person(), null)).toBe('undrawn');
    expect(deleteTierOf(person(), jobOf('running'))).toBe('unfinished');
    expect(deleteTierOf(person(), jobOf('paused'))).toBe('unfinished');
    expect(deleteTierOf(person(), jobOf('interrupted'))).toBe('unfinished');
    expect(deleteTierOf(person(), jobOf('done'))).toBe('undrawn');
  });

  it('有脸谱（任一卷 / 旧单卷 portrait）都算已画谱——删除要重输主密码', () => {
    expect(deleteTierOf(person({ digest: digest({ person: '## 速写' }) }), null)).toBe('drawn');
    expect(deleteTierOf(person({ digest: digest({ bond: '## 相交' }) }), null)).toBe('drawn');
    expect(deleteTierOf(person({ digest: digest({ chronicle: '## 一' }) }), null)).toBe('drawn');
    expect(deleteTierOf(person({ digest: digest({ portrait: '旧单卷正文' }) }), null)).toBe('drawn');
  });

  it('空壳 digest / 只留了锚点都不算已画谱——不给用户上无谓的密码门', () => {
    // 旧单卷空串那类：digest 对象在、正文全空（本轮修「空折正文被顶掉」时撞见的正是这种数据）
    expect(deleteTierOf(person({ digest: digest({ portrait: '' }) }), null)).toBe('undrawn');
    expect(deleteTierOf(person({ digest: { events: [], generatedAt: '' } }), null)).toBe('undrawn');
    expect(deleteTierOf(person({ lastProcessedTs: Date.now() }), null)).toBe('undrawn');
  });

  it('已画谱压过未完成任务：补画中删除仍要重输主密码（那份画像删了不可逆）', () => {
    expect(deleteTierOf(person({ digest: digest({ person: '## 一' }) }), jobOf('running'))).toBe('drawn');
    expect(deleteTierOf(person({ digest: digest({ person: '## 一' }) }), jobOf('paused'))).toBe('drawn');
    expect(deleteTierOf(person({ digest: digest({ person: '## 一' }) }), jobOf('done'))).toBe('drawn');
  });
});

describe('删除联系人册页（delPage）：按档说清代价与门禁', () => {
  const page = (tier: 'drawn' | 'unfinished' | 'undrawn') => delPage(person(), tier);
  const lineOf = (tier: 'drawn' | 'unfinished' | 'undrawn') => page(tier).querySelector('.bz-people-del-line')!.textContent!;
  const noteOf = (tier: 'drawn' | 'unfinished' | 'undrawn') => page(tier).querySelector('.bz-people-del-note')!.textContent!;

  it('页根挂钩子、报人名、两个动作钮，取消与删除各自可点', () => {
    const p = page('undrawn');
    expect(p.getAttribute('data-people-sub')).toBe('del');
    expect(p.querySelector('.bz-people-head-label')!.textContent).toBe('删除联系人');
    expect(p.querySelector('.bz-people-del-who')!.textContent).toBe('「陈默」');
    expect(p.querySelector('[data-people-del-cancel]')!.textContent).toBe('取消');
    expect(p.querySelector('[data-people-del-ok]')!.textContent).toBe('删除');
  });

  it('已画谱：说清连同脸谱正文一起销毁不可恢复 + 要重输主密码（不写「可重新导入」）', () => {
    expect(lineOf('drawn')).toContain('已经有画成的脸谱');
    expect(lineOf('drawn')).toContain('不可恢复');
    expect(noteOf('drawn')).toBe('要删除，请重输主密码确认。');
  });

  it('主密码框只在已画谱档出现（506：框与错误行都归本页，不再另弹一屏）', () => {
    const pwOf = (tier: 'drawn' | 'unfinished' | 'undrawn') =>
      page(tier).querySelector<HTMLInputElement>('input[data-people-del-pw]');
    expect(pwOf('drawn')).not.toBeNull();
    expect(pwOf('drawn')!.type).toBe('password');
    expect(pwOf('drawn')!.placeholder).toBe('主密码');
    expect(page('drawn').querySelector('[data-people-del-err]')!.textContent).toBe(''); // 错误行常驻、空串收起
    expect(pwOf('unfinished')).toBeNull();
    expect(pwOf('undrawn')).toBeNull();
  });

  it('画谱未完成 / 未画谱：说清后果，并交代数据源与聊天原文不动', () => {
    expect(lineOf('unfinished')).toContain('脸谱还没画完');
    expect(noteOf('unfinished')).toBe('数据源目录与聊天原文不动，之后可以重新导入。');
    expect(lineOf('undrawn')).toContain('还没画过脸谱');
    expect(noteOf('undrawn')).toBe('数据源目录与聊天原文不动，之后可以重新导入。');
  });
});

describe('统计 / 档案册页正文', () => {
  it('统计页正文：出卡即卡；占位口径（合成记录待画 / 旧版数据 / 无导入）', () => {
    const card = el('div', 'bz-people-ins');
    expect(statsPopBody(card, person())[0]).toBe(card);
    const pool = statsPopBody(null, person({ imports: [rec({ stats: { voiceCount: 1 } })] })); // 有 stats 无 monthly = 合成记录
    expect(pool[0].getAttribute('data-people-data-hint')).toBe('');
    expect(pool[0].textContent).toContain('画完脸谱后这里会有完整的互动统计');
    const legacy = statsPopBody(null, person({ imports: [rec()] })); // 无 stats = 旧版数据
    expect(legacy[0].textContent).toContain('旧版数据');
    expect(statsPopBody(null, person())[0].textContent).toContain('还没有导入记录');
  });

  it('补充背景正文：有档显卡、编辑态出编辑器、全空给补档入口', () => {
    const filled = profilePopBody(person({ profile: { tags: ['同学'] } }), false);
    expect(filled[0].classList.contains('bz-people-prof')).toBe(true);
    expect(filled[0].textContent).toContain('同学');
    expect(filled[0].querySelector('[data-people-prof-edit]')).toBeTruthy();
    const editing = profilePopBody(person(), true);
    expect(editing[0].classList.contains('bz-people-prof-edit')).toBe(true);
    expect(editing[0].querySelector('[data-people-prof-save]')).toBeTruthy();
    const blank = profilePopBody(person(), false);
    expect(blank[0].textContent).toContain('聊天之外的也可以记');
    expect(blank[0].querySelector('[data-people-prof-new]')!.textContent).toBe('补人物档案');
  });

  it('档案编辑卡：标签片读文本、加行钩子成组（社交 / 身边人 / 重要日子）', () => {
    const ed = profilePopBody(person({ profile: { tags: ['同学'], socials: [{ platform: '微信', handle: 'chenmo' }], relationships: [{ who: '老妈', relation: '母亲' }], importantDates: [{ date: '05-20', what: '生日' }] } }), true)[0];
    expect(ed.querySelector('[data-people-prof-tag-list] .bz-people-prof-tag-text')!.textContent).toBe('同学');
    expect(ed.querySelectorAll('[data-people-prof-social-list] .bz-people-prof-subrow')).toHaveLength(1);
    expect(ed.querySelectorAll('[data-people-prof-rel-list] .bz-people-prof-subrow')).toHaveLength(1);
    expect(ed.querySelectorAll('[data-people-prof-date-list] .bz-people-prof-subrow')).toHaveLength(1);
    expect(ed.querySelector('[data-people-prof-tag-input]')!.classList.contains('bz-people-tag-input')).toBe(true);
    expect(ed.querySelector('[data-people-prof-add-social]')!.textContent).toBe('+ 社交账号');
  });
});

describe('册页弹窗外壳（subPage）', () => {
  it('页眉（标题 + 元信息 + 合上这页）+ 可滚正文 + 页根钩子；页脚可选', () => {
    const page = subPage({ title: '互动统计', meta: '陈默', hook: 'stats' }, [el('div', 'body-x')]);
    expect(page.dataset.peopleSub).toBe('stats');
    expect(page.querySelector('.bz-people-head-label')!.textContent).toBe('互动统计');
    expect(page.querySelector('.bz-people-head-note')!.textContent).toBe('陈默');
    expect(page.querySelector('[data-people-close]')!.textContent).toBe('合上这页');
    expect(page.querySelector('[data-people-scroll="pop"] .body-x')).toBeTruthy();
    expect(page.classList.contains('bz-people-sub')).toBe(true);
    expect(page.querySelector('.bz-people-pop-foot')).toBeNull();
  });

  it('靠人的页翻到详情那一侧；单页（数据源 / 找一找）不带侧', () => {
    expect(subPage({ title: 't', hook: 'prof', side: 'left' }, []).classList.contains('bz-people-sit-l')).toBe(true);
    expect(subPage({ title: 't', hook: 'prof', side: 'right' }, []).classList.contains('bz-people-sit-r')).toBe(true);
    expect(subPage({ title: 't', hook: 'ds' }, []).className).not.toContain('bz-people-sit-');
  });
});

describe('数据源册页（dsPage）', () => {
  const state = (over: Partial<Parameters<typeof dsPage>[0]> = {}): Parameters<typeof dsPage>[0] => ({
    dataDir: 'D:/演示数据/export_full',
    scanning: false,
    importing: false,
    rows: [],
    selected: [],
    hiddenGroups: 0,
    notice: '',
    generateable: false,
    desktopOnly: false,
    scannedAt: '10:32',
    syncing: false,
    sync: null,
    ...over,
  });

  it('路径行带扫描时刻；空态分两种：还没扫描 / 仅桌面端', () => {
    const page = dsPage(state({ rows: null }));
    expect(page.dataset.peopleSub).toBe('ds');
    expect(page.querySelector('.bz-people-ds-path')!.textContent).toBe('D:/演示数据/export_full · 扫描于 10:32');
    expect(page.textContent).toContain('还没扫描');
    expect(dsPage(state({ rows: null, desktopOnly: true })).textContent).toContain('仅桌面端支持');
  });

  it('行列表在 [data-people-ds-list] 里；图例带三色点，有更新才出「勾有更新的」', () => {
    const page = dsPage(state({ rows: [dsRowBase], hiddenGroups: 2 }));
    expect(page.querySelector('[data-people-ds-list]')!.children).toHaveLength(1);
    expect(page.querySelector('.bz-people-ds-legend')!.textContent).toContain('有更新');
    expect(page.querySelector('[data-people-ds-pickfresh]')).toBeTruthy();
    expect(page.querySelector('.bz-people-head-note')!.textContent).toBe('1 位联系人 · 2 个群聊未纳入');
    expect(dsPage(state({ rows: [{ ...dsRowBase, newCount: 0 }] })).querySelector('[data-people-ds-pickfresh]')).toBeNull();
  });

  it('通知行挂钩子供原位刷新；同步条只在有同步动态时出现', () => {
    const page = dsPage(state({ notice: '正在导入聊天仓…' }));
    expect(page.querySelector('[data-people-ds-notice]')!.textContent).toBe('正在导入聊天仓…');
    expect(page.querySelector('[data-people-ds-sync-line]')).toBeNull();
    const syncing = dsPage(state({ sync: { status: 'running', text: '导出联系人', sub: '', contact: '', pct: 20, hint: '', failures: [] } }));
    expect(syncing.querySelector('[data-people-ds-sync-line]')).toBeTruthy();
  });

  it('页脚：勾选总账 + 导入所选；导入完成才出「画脸谱」；同步 / 导入中导入钮置灰', () => {
    const idle = dsPage(state({ rows: [dsRowBase] }));
    expect(idle.querySelector('[data-people-ds-import]')!.textContent).toBe('导入所选');
    expect(idle.querySelector('[data-people-ds-generate]')).toBeNull();
    expect(idle.querySelector('[data-people-ds-import]')!.hasAttribute('disabled')).toBe(false);

    const gen = dsPage(state({ rows: [dsRowBase], selected: ['林晚'], generateable: true }));
    expect(gen.querySelector('[data-people-ds-generate]')!.textContent).toBe('画脸谱');

    expect(dsPage(state({ rows: [dsRowBase], importing: true })).querySelector('[data-people-ds-import]')!.hasAttribute('disabled')).toBe(true);
    expect(dsPage(state({ rows: [dsRowBase], syncing: true })).querySelector('[data-people-ds-import]')!.hasAttribute('disabled')).toBe(true);
  });

  it('右上角动作位：同步与停止绝不并列（运行中只出停止）', () => {
    const idle = dsPage(state({ rows: [dsRowBase] }));
    expect(idle.querySelector('[data-people-ds-sync]')).toBeTruthy();
    expect(idle.querySelector('[data-people-ds-sync-stop]')).toBeNull();
    const running = dsPage(state({ rows: [dsRowBase], syncing: true }));
    expect(running.querySelector('[data-people-ds-sync-stop]')).toBeTruthy();
    expect(running.querySelector('[data-people-ds-sync]')).toBeNull();
    expect(running.querySelector('.bz-people-head-note')!.textContent).toBe('正在同步…');
    expect(dsPage(state({ scanning: true })).querySelector('.bz-people-head-note')!.textContent).toBe('正在扫描…');
  });
});

describe('数据源行（dsRow 四态 + 水位）', () => {
  it('有更新：fresh 徽章 + 「有更新」水位签；已导账写条数与画到哪天', () => {
    const row = dsRow({ ...dsRowBase }, false);
    expect(row.classList.contains('bz-people-ds-fresh')).toBe(true);
    expect(row.querySelector('.bz-people-ds-water')!.textContent).toBe('增量 · 45 条');
    expect(row.querySelector('.bz-people-ds-water')!.classList.contains('bz-people-ds-w-newer')).toBe(true);
    expect(row.querySelector('.bz-people-ds-mark')!.textContent).toBe('已导 1,204 条 · 画到 03-01');
  });

  it('未导入 / 无新素材 / 已导出待入库：三种水位签各自认门', () => {
    const fresh = dsRow({ ...dsRowBase, imported: false, processedTs: null }, false);
    expect(fresh.querySelector('.bz-people-ds-water')!.textContent).toBe('全新 · 1,204 条');
    expect(fresh.querySelector('.bz-people-ds-mark')!.textContent).toBe('未导入');
    expect(fresh.classList.contains('bz-people-ds-fresh')).toBe(false); // 没导入过不算「有更新」

    const skip = dsRow({ ...dsRowBase, newCount: 0, processedTs: null }, false);
    expect(skip.querySelector('.bz-people-ds-water')!.textContent).toBe('无新素材');
    expect(skip.querySelector('.bz-people-ds-mark')!.textContent).toBe('已导 1,204 条 · 未画脸谱');
    expect(dsRow({ ...dsRowBase, newCount: 0 }, false).querySelector('.bz-people-ds-mark')!.textContent).toBe('已导 1,204 条 · 画到 03-01');

    const pending = dsRow({ ...dsRowBase, imported: false, exported: true }, false);
    expect(pending.querySelector('.bz-people-ds-water')!.textContent).toBe('已导出 · 待入库');
  });

  it('485 哨兵：stats 路径只有「有没有新」时写「有新消息」，不编条数', () => {
    expect(dsWaterOf({ ...dsRowBase, newApprox: true })!.label).toBe('增量 · 有新消息');
    expect(dsWaterOf({ ...dsRowBase, newApprox: false })!.label).toBe('增量 · 45 条');
  });

  it('群聊：灰置禁操作、不进勾选、行尾写「未纳入」', () => {
    const group = dsRow({ ...dsRowBase, name: '老周家', displayName: '老周家', isGroup: true }, false);
    expect(group.classList.contains('bz-people-ds-off')).toBe(true);
    expect(group.querySelector('.bz-people-ds-name')!.textContent).toBe('老周家（群）');
    expect(group.querySelector('.bz-people-ds-mark')!.textContent).toBe('未纳入');
    expect(group.querySelector('.bz-people-ds-water')).toBeNull();
    expect(group.querySelector('.bz-people-ds-ava')).toBeNull();
  });

  it('显示名与目录键分离（issue 501）：行上只显示纯名，勾选钩子仍是目录键', () => {
    const row = dsRow({ ...dsRowBase, name: '点点 (wxid_7470574705922)', displayName: '点点' }, false);
    expect(row.querySelector('.bz-people-ds-name')!.textContent).toBe('点点');
    const box = row.querySelector<HTMLElement>('[data-people-ds-check]')!;
    expect(box.dataset.peopleDsCheck).toBe('点点 (wxid_7470574705922)');
    expect(box.getAttribute('role')).toBe('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('false');
  });

  it('勾选态回显（448 评审 P1）：重建册页时 selected 名单里的行仍是勾上的样子', () => {
    const on = dsRow(dsRowBase, true);
    expect(on.classList.contains('bz-people-ds-on')).toBe(true);
    const box = on.querySelector<HTMLElement>('[data-people-ds-check]')!;
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(box.querySelector('[data-lucide="check"]')).toBeTruthy();
    expect(dsRow(dsRowBase, false).querySelector('[data-lucide="check"]')).toBeNull();
  });
});

describe('页脚账与导入水位（dsPage 页脚 / dsWaterOf）', () => {
  const state = (over: Partial<Parameters<typeof dsPage>[0]> = {}): Parameters<typeof dsPage>[0] => ({
    dataDir: 'D:/数据', scanning: false, importing: false, rows: [dsRowBase], selected: [],
    hiddenGroups: 0, notice: '', generateable: false, desktopOnly: false, scannedAt: '', syncing: false, sync: null, ...over,
  });
  const countOf = (over: Partial<Parameters<typeof dsPage>[0]>): string =>
    dsPage(state(over)).querySelector('[data-people-ds-count]')!.textContent!;

  it('未勾选时不报数；勾上的逐类报（全新 / 增量 / 待入库 / 跳过）', () => {
    expect(countOf({ selected: [] })).toBe('未勾选联系人');
    expect(countOf({ selected: ['林晚'] })).toBe('已选 1 位 · 将并入 45 条（增量 1 位）');
    const freshRow: DsRowState = { ...dsRowBase, imported: false, exported: false, processedTs: null };
    expect(countOf({ rows: [freshRow], selected: ['林晚'] })).toBe('已选 1 位 · 将并入 1,204 条（全新 1 位）');
    const pending: DsRowState = { ...dsRowBase, imported: false, exported: true };
    expect(countOf({ rows: [pending], selected: ['林晚'] })).toBe('已选 1 位 · 将并入 1,204 条（待入库 1 位）');
  });

  it('全选已导无更新的：直说会被跳过（别让人以为点了没用）', () => {
    const skip: DsRowState = { ...dsRowBase, newCount: 0 };
    expect(countOf({ rows: [skip], selected: ['林晚'] })).toBe('所选暂无新素材（已导过的会被跳过）');
  });
});

// ---------------- 同步进度行（issue 484：阶段主文案 + 已耗时 + 当前联系人副行 + 不定态条） ----------------

describe('dsSyncLineNode（issue 484）', () => {
  const line = (over: Partial<DsSyncLine> = {}): DsSyncLine => ({
    status: 'running',
    text: '统计联系人 12/57 · 已 4 分 21 秒',
    sub: '统计联系人：逐人聚合消息 / 语音 / 图片',
    contact: '',
    pct: null,
    hint: '',
    failures: [],
    ...over,
  });

  it('不可估阶段：不定态脉冲条替代宽度条，主行不加假百分比；联系人副行在', () => {
    const node = dsSyncLineNode(line({ contact: '大琳 · 20,773 条' }));
    expect(node.querySelector('[data-people-ds-sync-text]')!.textContent).not.toContain('%');
    expect(node.querySelector('.bz-people-sync-indet')).toBeTruthy();
    expect(node.querySelector('.bz-people-sync-bar')).toBeNull();
    expect(node.querySelector('[data-people-ds-sync-contact]')!.textContent).toBe('大琳 · 20,773 条');
  });

  it('确定态：宽度条带百分比；联系人 / 副行空串时藏起来（节点都在，供原位更新）', () => {
    const node = dsSyncLineNode(line({ pct: 35, contact: '', sub: '' }));
    expect(node.querySelector('[data-people-ds-sync-text]')!.textContent).toContain('35%');
    expect(node.querySelector<HTMLElement>('.bz-people-sync-bar')!.getAttribute('style')).toBe('width:35%');
    expect(node.querySelector('.bz-people-sync-indet')).toBeNull();
    expect(node.querySelector<HTMLElement>('[data-people-ds-sync-contact]')!.hidden).toBe(true);
    expect(node.querySelector<HTMLElement>('[data-people-ds-sync-sub]')!.hidden).toBe(true);
  });

  it('终态不出进度条；失败明细逐行列出；错误面竖红边', () => {
    const done = dsSyncLineNode(line({ status: 'ok', text: '同步完成', sub: '同步完成：更新 2 位', pct: 100 }));
    expect(done.querySelector('.bz-people-sync-track')).toBeNull();
    const bad = dsSyncLineNode(line({ status: 'error', text: '同步失败', failures: ['大琳：目录不存在'], hint: '先跑 bz-face doctor' }));
    expect(bad.classList.contains('bz-people-syncline-err')).toBe(true);
    expect(bad.querySelector('[data-people-ds-sync-fail]')!.textContent).toBe('大琳：目录不存在');
    expect(bad.textContent).toContain('先跑 bz-face doctor');
  });
});

// ---------------- 生成进度便签（issue 450 / 469 / 470 / 497 / 505） ----------------

describe('进度便签纯函数（455 四阶段口径）', () => {
  it('jobsPercent = (已完成批 + 已完成成文阶段) / (总批数 + 3)，钳 0~100（455 三段成文）', () => {
    expect(jobsPercent(0, 60, 0)).toBe(0);
    expect(jobsPercent(12, 60, 0)).toBe(19); // 12/63
    expect(jobsPercent(60, 60, 2)).toBe(98); // 62/63（纪事进行中 = 其人 / 相交已完成）
    expect(jobsPercent(60, 60, 3)).toBe(100);
    expect(jobsPercent(0, 0, 0)).toBe(0); // 总数未知不除零
    expect(jobsPercent(99, 1, 2)).toBe(100);
  });

  it('jobsStagesDone：四阶段对齐（extracting 逐批 → 画其人 → 写相交 → 纪事）——相交 = 1、纪事 = 2、done = 3', () => {
    expect(jobsStagesDone('extracting', 'running')).toBe(0);
    expect(jobsStagesDone('person', 'running')).toBe(0);
    expect(jobsStagesDone('portrait', 'running')).toBe(0); // 旧引擎阶段名兼容（旧落盘）
    expect(jobsStagesDone('bond', 'running')).toBe(1);
    expect(jobsStagesDone('chronicle', 'running')).toBe(2);
    expect(jobsStagesDone(undefined, 'done')).toBe(3);
  });

  it('后段阶段标签（497）：三个成文段各有名有姓，旧引擎词不上屏', () => {
    expect(jobsStageLabel('chunked')).toBe('正在切批组装素材…');
    expect(jobsStageLabel('person')).toBe('正在生成《其人》…');
    expect(jobsStageLabel('bond')).toBe('正在生成《相交》…');
    expect(jobsStageLabel('chronicle')).toBe('正在生成《纪事》…');
    expect(jobsStageLabel('extracting')).toBeNull();
  });

  it('主行合并口径（jobsMainLine）：状态词 · 锚点 · 细节；同义时只留详尽的一条，各说一层则两段都留', () => {
    const base = { talker: 'a', name: '陈默', status: 'running' as const, batchesDone: 12, batchesTotal: 60, stagesDone: 0, queueIndex: 1, queueTotal: 1 };
    // 批位锚点 + 明细（同义）→ 只留明细
    expect(jobsMainLine({ ...base, message: '第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条' }))
      .toEqual({ head: '第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条', detail: '' });
    // 阶段标签《相交》+ 推进句（同义）→ 只留推进句，不并排念两遍
    expect(jobsMainLine({ ...base, stage: 'bond', message: '《其人》完成，正在生成《相交》…' }))
      .toEqual({ head: '《其人》完成，正在生成《相交》…', detail: '' });
    // 切批锚点 + 切批说明（各说一层）→ 两段都留
    expect(jobsMainLine({ ...base, stage: 'chunked', message: '消息 20773 条 → 35 批 · 共 38 次 AI 调用' }))
      .toEqual({ head: '正在切批组装素材…', detail: '消息 20773 条 → 35 批 · 共 38 次 AI 调用' });
    // 状态词在前：暂停面主行动词交代清楚
    expect(jobsMainLine({ ...base, status: 'paused', stage: 'person', message: '' }).head).toBe('已暂停 · 正在生成《其人》…');
    // error 面不挂细节（原因由底部错误行承担）
    expect(jobsMainLine({ ...base, status: 'error', message: '消息 91234 条 → …' }))
      .toEqual({ head: '生成失败 · 已完成 12/60 批', detail: '' });
  });
});

describe('进度便签（jobsNote 状态机）', () => {
  const state = (over: Partial<JobsBlockState> = {}): JobsBlockState => ({
    talker: 'wxid_a',
    name: '陈默',
    status: 'running',
    message: '第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条',
    batchesDone: 12,
    batchesTotal: 60,
    stagesDone: 0,
    queueIndex: 2,
    queueTotal: 5,
    ...over,
  });
  const mainOf = (n: HTMLElement): string => n.querySelector('.bz-people-jobs-main')!.textContent!;

  it('便签有队列行（不止一位才写第几位）、细条 = 百分比、主行一行到底', () => {
    const b = jobsNote(state());
    expect(b.dataset.peopleJobsTalker).toBe('wxid_a');
    expect(b.getAttribute('role')).toBe('status');
    expect(b.querySelector('.bz-people-jobs-who')!.textContent).toBe('第 2/5 位 · 陈默');
    expect(b.querySelector('.bz-people-jobs-fill')!.getAttribute('style')).toBe('width:19%');
    expect(b.querySelector('.bz-people-jobs-pct')!.textContent).toBe('19%');
    expect(mainOf(b)).toBe('第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条');
    // 只有一位在跑时不写队列行（一人一任务，报「第 1/1 位」是废话）
    expect(jobsNote(state({ queueTotal: 1, queueIndex: 1 })).querySelector('.bz-people-jobs-who')).toBeNull();
  });

  it('运行中不摆暂停 / 继续 / 删除钮（画谱是一段想看完的连续过程，中断留在印章与关面板两条路上）', () => {
    const b = jobsNote(state());
    expect(b.querySelector('[data-people-jobs-pause]')).toBeNull();
    expect(b.querySelector('[data-people-jobs-resume]')).toBeNull();
    expect(b.querySelector('[data-people-jobs-dismiss]')).toBeNull();
  });

  it('主行与错误行分工：主行短状态，具体错误只在错误行出现一次', () => {
    const long = '消息 91234 条 → 300 批超上限，均匀抽样 60 批（覆盖全时段，首尾必保），共 62 次 AI 调用';
    const b = jobsNote(state({ status: 'error', message: long, errorText: 'AI 调用超时' }));
    expect(mainOf(b)).toBe('生成失败 · 已完成 12/60 批'); // 不回显长文案
    expect(b.querySelector('.bz-people-jobs-err')!.textContent).toBe('AI 调用超时');
  });

  it('暂停 / 中断 / 可续 error 出「继续生成」；接不上的 error 出「删除任务」；done 无动作钮', () => {
    const paused = jobsNote(state({ status: 'paused', message: '' }));
    expect(paused.querySelector('[data-people-jobs-resume]')!.textContent).toBe('继续生成');
    expect(mainOf(paused)).toContain('已暂停');
    expect(jobsNote(state({ status: 'interrupted', message: '' })).querySelector('[data-people-jobs-resume]')).toBeTruthy();
    // issue 453：error 也能续跑（451 放宽 resume）——默认出「继续生成」，只有漂移判废（resumable:false）
    // 才出「删除任务」（续跑必然再判废，删了重来才对）
    const err = jobsNote(state({ status: 'error', message: '', errorText: 'AI 调用超时' }));
    expect(err.querySelector('[data-people-jobs-resume]')!.textContent).toBe('继续生成');
    expect(err.querySelector('[data-people-jobs-dismiss]')).toBeNull();
    const dead = jobsNote(state({ status: 'error', message: '', errorText: '消息集已变化', resumable: false }));
    expect(dead.querySelector('[data-people-jobs-dismiss]')!.textContent).toBe('删除任务');
    expect(dead.querySelector('[data-people-jobs-resume]')).toBeNull();
    const done = jobsNote(state({ status: 'done', message: '', stagesDone: 3, batchesDone: 60 }));
    expect(done.querySelector('[data-people-jobs-resume]')).toBeNull();
    expect(done.querySelector('.bz-people-jobs-pct')!.textContent).toBe('100%');
    expect(mainOf(done)).toBe('脸谱已生成');
  });

  it('工具段（469）：阶段行上主行、进度条走工具段折算总进度；暂停面写「已暂停 · 阶段行」', () => {
    const b = jobsNote(state({ prep: { stageText: '媒体导出 312/1631', overall: 16, failed: 0 }, message: '' }));
    expect(mainOf(b)).toBe('媒体导出 312/1631');
    expect(b.querySelector('.bz-people-jobs-fill')!.getAttribute('style')).toBe('width:16%');
    const paused = jobsNote(state({ status: 'paused', prep: { stageText: '语音转写 45/1289', overall: 34, failed: 0 }, message: '' }));
    expect(mainOf(paused)).toBe('已暂停 · 语音转写 45/1289');
  });

  it('工具段失败计账且不在跑时出「重试失败项」（幂等只补失败项）；跑着 / 已完成不出', () => {
    const paused = jobsNote(state({ status: 'paused', prep: { stageText: null, overall: 100, failed: 2 }, message: '' }));
    expect(paused.querySelector('[data-people-jobs-prep-retry]')!.textContent).toBe('重试失败项');
    expect(jobsNote(state({ prep: { stageText: null, overall: 10, failed: 2 }, message: '' })).querySelector('[data-people-jobs-prep-retry]')).toBeNull();
    expect(jobsNote(state({ status: 'done', prep: { stageText: null, overall: 100, failed: 2 }, message: '' })).querySelector('[data-people-jobs-prep-retry]')).toBeNull();
  });

  it('图片描述段（470）：主行 = `图片描述 3/82 批 · 本批 20 张`，进度条走段内批进度', () => {
    const b = jobsNote(state({ describe: { stageText: '图片描述 3/82 批', overall: 4 }, message: '本批 20 张' }));
    expect(mainOf(b)).toBe('图片描述 3/82 批 · 本批 20 张');
    expect(b.querySelector('.bz-people-jobs-fill')!.getAttribute('style')).toBe('width:4%');
    // 引擎细节与阶段行同文时不再念一遍
    expect(jobsNote(state({ describe: { stageText: '图片描述 3/82 批', overall: 4 }, message: '图片描述 3/82 批' })).querySelector('.bz-people-jobs-detail')).toBeNull();
  });
});

// ---------------- 回复时延取值（issue 449） ----------------

describe('replyLatencySec 中位数回退', () => {
  it('新数据优先中位数；旧数据无中位数字段回落平均值；0（无样本）不被回退覆盖', () => {
    expect(replyLatencySec(45, 120)).toBe(45);
    expect(replyLatencySec(undefined, 120)).toBe(120);
    expect(replyLatencySec(0, 120)).toBe(0);
  });
});

describe('进度块「取消」按钮（issue 517）', () => {
  const base = {
    talker: '大琳',
    name: '大琳',
    message: '',
    batchesDone: 0,
    batchesTotal: 0,
    stagesDone: 0,
    queueIndex: 1,
    queueTotal: 1,
    pct: null as number | null,
  };

  it('中断 / 暂停 / 可续报错：继续生成后追加取消；running / done 不出取消', () => {
    for (const status of ['interrupted', 'paused', 'error'] as const) {
      const block = jobsNote({ ...base, status, resumable: true });
      const labels = [...block.querySelectorAll('button')].map((b) => b.textContent ?? '');
      expect(labels).toContain('继续生成');
      expect(labels).toContain('取消');
    }
    for (const status of ['running', 'done'] as const) {
      const block = jobsNote({ ...base, status });
      const labels = [...block.querySelectorAll('button')].map((b) => b.textContent ?? '');
      expect(labels).not.toContain('取消');
    }
  });

  it('漂移判废的 error 维持单枚「删除任务」，不出取消', () => {
    const block = jobsNote({ ...base, status: 'error', resumable: false });
    const labels = [...block.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(labels).toContain('删除任务');
    expect(labels).not.toContain('取消');
  });
});
