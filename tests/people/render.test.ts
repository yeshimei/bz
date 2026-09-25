/**
 * 脸谱 render 纯层测试（issue 447 / 450 / 455）：折子封面（竖排截断 / 印章水位 / 合并态）、
 * 详情折页册（四折结构 / 双卷正文与空态 / 折脊引文）、详情头弹窗入口图标、
 * 统计与档案弹窗（弹窗壳 / 占位口径 / 编辑态）、数据源弹窗（四态行 / 勾选文案 / 图例快捷）、
 * 生成进度块（四阶段百分比口径 / 队列副文案 / 状态按钮态）。
 * markup 单源的锚测试——类名与 data 钩子即 ui 委托契约。
 * 隐私口径：fixture 全构造数据。
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  dsModal,
  dsRow,
  el,
  foldBook,
  foldBondBody,
  foldCard,
  foldDetailHead,
  foldPersonBody,
  foldSeal,
  foldSealNode,
  formatCount,
  jobsFallbackMessage,
  jobsPercent,
  jobsQueueLabel,
  jobsStagesDone,
  miniMarkdown,
  panelShell,
  popShell,
  profilePopBody,
  progressBlock,
  replyLatencySec,
  statsPopBody,
  statsText,
  vtName,
  type DsRowState,
  type FoldCardJob,
  type JobsBlockState,
} from '../../src/people/render';
import { bondOf, personOf } from '../../src/people/types';
import type { ImportRecord, PersonEntry } from '../../src/people/types';

function person(over: Partial<PersonEntry> = {}): PersonEntry {
  return {
    id: 'wxid_a', name: '陈默', createdAt: '2026-03-01T00:00:00.000Z', imports: [],
    ...over,
  };
}

const dsRowBase: DsRowState = {
  name: '林晚', rawCount: 1204, isGroup: false, media: '语音 98 条 · 图片 156 张',
  previewCount: 1159, newCount: 45, processedTs: new Date('2026-03-01T00:00:00').getTime(),
};

describe('折子封面（foldCard）', () => {
  it('竖排姓名截断：>7 字取前 6 字加省略号（真实数据最长 37 字）', () => {
    expect(vtName('陈默')).toBe('陈默');
    expect(vtName('周远山')).toBe('周远山');
    expect(vtName('A8号公寓连锁酒店18295475558')).toBe('A8号公寓连…');
  });

  it('印章水位：有锚点显「画到 日期」，已画未锚显「已画」，未画显虚印「待画」', () => {
    const drawn = foldCard(person({
      digest: { portrait: 'x', events: [], generatedAt: '2026-03-12T00:00:00.000Z' },
      lastProcessedTs: new Date('2026-03-12T00:00:00').getTime(),
    }), { media: null, mergeFrom: false, mergePick: false });
    expect(drawn.querySelector('.bz-people-seal')!.textContent).toContain('画到');
    expect(drawn.querySelector('.bz-people-seal-todo')).toBeNull();

    const undrawn = foldCard(person(), { media: null, mergeFrom: false, mergePick: false });
    expect(undrawn.querySelector('.bz-people-seal-todo')!.textContent).toBe('待画');
  });

  it('合并模式：本册 merge-from 虚化、候选册 merge-pick 描边；零媒体不出徽章文字', () => {
    const from = foldCard(person(), { media: null, mergeFrom: true, mergePick: false });
    expect(from.classList.contains('bz-people-fold-merge-src')).toBe(true);
    const pick = foldCard(person({ id: 'b', name: '林晚' }), { media: null, mergeFrom: false, mergePick: true });
    expect(pick.classList.contains('bz-people-fold-merge-pick')).toBe(true);
    expect(foldCard(person(), { media: null, mergeFrom: false, mergePick: false }).textContent).not.toContain('语音');
  });

  it('无关系无跨度时 who 行兜底「新折」——不再与 meta 行重复同一消息数（P2 回归）', () => {
    const card = foldCard(person({ profile: { tags: [] } } as Partial<PersonEntry>), { media: null, mergeFrom: false, mergePick: false });
    const who = card.querySelector('.bz-people-fold-who')!.textContent;
    expect(who).not.toContain('条');
    const meta = card.querySelector('.bz-people-fold-meta')!.textContent;
    expect(who).not.toBe(meta);
  });
});

describe('折子印章四态（451）', () => {
  const digest = { portrait: 'x', events: [], generatedAt: '2026-03-12T00:00:00.000Z' };
  const job = (over: Partial<FoldCardJob> = {}): FoldCardJob => ({
    status: 'running', batchesDone: 0, batchesTotal: 10, stagesDone: 0, resumable: true, ...over,
  });

  it('未画谱：灰虚印「待画」→ 唯一动作「画脸谱」', () => {
    const s = foldSeal(person(), null);
    expect(s.state).toBe('todo');
    expect(s.text).toBe('待画');
    expect(s.action).toEqual({ kind: 'draw', label: '画脸谱' });
  });

  it('画谱中：金实印带百分比（与进度块同口径）→ 唯一动作「暂停」', () => {
    const s = foldSeal(person(), job({ batchesDone: 3 }));
    expect(s.state).toBe('running');
    expect(s.text).toBe('画谱中\n23%'); // (3+0)/(10+3)，455 三段成文分母 +3
    expect(s.action).toEqual({ kind: 'pause', label: '暂停' });
    expect(s.title).toContain('本批做完后暂停');
  });

  it('画谱中断：朱红破框印带批数 → 「继续生成」（paused / interrupted / error 可续三态同形）', () => {
    for (const status of ['paused', 'interrupted', 'error'] as const) {
      const s = foldSeal(person(), job({ status, batchesDone: 12, batchesTotal: 60 }));
      expect(s.state).toBe('halted');
      expect(s.text).toBe('画谱中断\n12/60');
      expect(s.action).toEqual({ kind: 'resume', label: '继续生成' });
      expect(s.title).toContain('已画完的批次不重画');
    }
  });

  it('画谱中断（漂移类失败不可续）→ 改「重新生成」', () => {
    const s = foldSeal(person(), job({ status: 'error', resumable: false }));
    expect(s.state).toBe('halted');
    expect(s.text).toBe('画谱中断');
    expect(s.action).toEqual({ kind: 'redraw', label: '重新生成' });
  });

  it('已画谱：朱红实印「画到 日期」→ 唯一动作「补画」；无锚点回落「已画」', () => {
    const anchored = foldSeal(person({ digest, lastProcessedTs: new Date('2026-03-12T12:00:00').getTime() }), null);
    expect(anchored.state).toBe('done');
    expect(anchored.text).toBe('画到\n26-03-12'); // formatDay(YYYY-MM-DD) 去世纪前缀（447 沿用的印章口径）
    expect(anchored.action).toEqual({ kind: 'redraw', label: '补画' });
    expect(foldSeal(person({ digest }), null).text).toBe('已画');
  });

  it('任务态压过脸谱水位：已有脸谱又在中途补画 → 显「画谱中」而非「已画谱」', () => {
    const s = foldSeal(person({ digest, lastProcessedTs: Date.now() }), job({ batchesDone: 5 }));
    expect(s.state).toBe('running');
    expect(s.text).toBe('画谱中\n38%'); // (5+0)/(10+3)，455 口径
  });

  it('印章是按钮且钩子 / 文案齐备；每态只出一个动作（互不并列）', () => {
    const card = foldCard(person(), { media: null, mergeFrom: false, mergePick: false, job: job({ batchesDone: 3 }) });
    expect(card.querySelectorAll('[data-people-seal-act]')).toHaveLength(1);
    const seal = card.querySelector<HTMLButtonElement>('.bz-people-seal')!;
    expect(seal.tagName).toBe('BUTTON');
    expect(seal.type).toBe('button');
    expect(seal.classList.contains('bz-people-seal-running')).toBe(true);
    expect(seal.dataset.peopleSealAct).toBe('pause');
    expect(seal.getAttribute('aria-label')).toContain('暂停');
    expect(seal.getAttribute('title')).toContain('陈默');
    // 原位刷新换的是同一个节点形态：foldSealNode 与卡内印章同构
    const swapped = foldSealNode(person(), job({ status: 'interrupted', batchesDone: 2 }));
    expect(swapped.classList.contains('bz-people-seal-halted')).toBe(true);
    expect(swapped.dataset.peopleSealAct).toBe('resume');
  });
});

describe('面板壳与统计行', () => {
  it('壳含数据源入口 / 进度块槽位 / 弹层容器（data 钩子即委托契约）', () => {
    const shell = panelShell();
    expect(shell.querySelector('[data-people-ds-open]')).toBeTruthy();
    expect(shell.querySelector('[data-people-jobs-slot]')).toBeTruthy();
    expect(shell.querySelector('[data-people-ds-layer]')).toBeTruthy();
  });

  it('统计行：万格式化（实测量级 max 20,773）与空库文案', () => {
    const p = person({ imports: [{ file: '数据源:陈默', importedAt: '', messageCount: 20773, skippedCount: 0, timeFrom: '', timeTo: '' }] });
    expect(statsText([p])).toContain('2.1 万');
    expect(statsText([])).toBe('还没有人物');
  });

  it('formatCount：万以上一位小数，其余千分位', () => {
    expect(formatCount(20773)).toBe('2.1 万');
    expect(formatCount(12847)).toBe('1.3 万');
    expect(formatCount(1284)).toBe('1,284');
  });
});

describe('详情折页册（foldBook，issue 455 四折）', () => {
  const bodies = { p: [], b: [], e: [], c: [] } as Record<string, never[]>;
  const spills = { p: '其人引文', b: '我们引文', e: '事件引文', c: '大事记引文' };

  it('四折齐全（其人/我们/事件/时间线）；展开折有正文容器，收起折出竖排引文', () => {
    const book = foldBook(person(), { fold: 'p' }, bodies, spills);
    const leaves = [...book.querySelectorAll('[data-people-leaf]')];
    expect(leaves.map((l) => l.getAttribute('data-people-leaf'))).toEqual(['p', 'b', 'e', 'c']);
    const pLeaf = book.querySelector('[data-people-leaf="p"]')!;
    expect(pLeaf.classList.contains('bz-people-leaf-on')).toBe(true);
    expect(pLeaf.querySelector('.bz-people-leaf-body')).toBeTruthy();
    const eLeaf = book.querySelector('[data-people-leaf="e"]')!;
    expect(eLeaf.querySelector('.bz-people-leaf-spill')!.textContent).toBe('事件引文');
    expect(eLeaf.querySelector('.bz-people-leaf-body')).toBeNull();
  });

  it('卷一《其人》+ 卷二《我们》：折脊 meta 走兼容读——旧单卷 portrait 只进其人折', () => {
    const p = person({ digest: { portrait: '旧画像', events: [], generatedAt: '2026-03-12T00:00:00.000Z' } });
    const book = foldBook(p, { fold: 'b' }, bodies, spills);
    expect([...book.querySelectorAll('.bz-people-leaf-zh')].map((n) => n.textContent)).toEqual(['其人', '我们', '事件', '大事记']);
    const metas = [...book.querySelectorAll('.bz-people-leaf-cnt')].map((n) => n.textContent);
    expect(metas[0]).toBe('修'); // personOf 回落旧 portrait
    expect(metas[1]).toBe('空'); // bondOf：旧数据没有 bond
  });

  it('折页切换钩子挂整片收起折（点竖排引文区也能切）；展开折不带——防吞折内按钮', () => {
    const book = foldBook(person(), { fold: 'p' }, bodies, spills);
    const eLeaf = book.querySelector('[data-people-leaf="e"]')!;
    expect(eLeaf.hasAttribute('data-people-leaf-head')).toBe(true);
    const pLeaf = book.querySelector('[data-people-leaf="p"]')!;
    expect(pLeaf.hasAttribute('data-people-leaf-head')).toBe(false);
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

describe('折正文：其人 / 我们（issue 455）', () => {
  it('其人折：markdown + 代表原话；空态给引导与「打开数据源」动作', () => {
    const p = person({ digest: { events: [], generatedAt: '', quotes: [{ ts: '2026-03-01', who: '我', text: '行' }] } });
    const withBody = foldPersonBody(miniMarkdown('## 速写\n- 简短'), p);
    expect(withBody[0].classList.contains('bz-people-portrait')).toBe(true);
    expect(withBody.map((n) => n.textContent).join('')).toContain('代表原话');
    const empty = foldPersonBody(null, person());
    expect(empty[0].textContent).toContain('还没有其人画像。从数据源导入一次即可生成。');
    expect(empty[0].querySelector('[data-people-ds-open]')).toBeTruthy();
  });

  it('我们折：markdown；空态引导导入（旧单卷 portrait 不进我们折）', () => {
    expect(foldBondBody(miniMarkdown('## 我们\n- 常聊'))[0].querySelectorAll('li')).toHaveLength(1);
    const empty = foldBondBody(null);
    expect(empty[0].textContent).toContain('还没有关系画像。从数据源导入一次即可生成。');
    expect(empty[0].querySelector('[data-people-ds-open]')).toBeTruthy();
  });
});

// ---------------- 详情头弹窗入口与统计 / 档案弹窗（issue 455） ----------------

describe('详情头弹窗入口图标（issue 455）', () => {
  it('互动统计 / 补充背景两图标在返回按钮前（DOM 序居其前）；生成钮仍在最前', () => {
    const withGen = foldDetailHead(person(), null, { canGenerate: true });
    expect([...withGen.querySelector('.bz-people-dt-actions')!.children].map((n) => n.getAttribute('aria-label')))
      .toEqual(['画脸谱', '互动统计', '补充背景', '返回列表']);
    const noGen = foldDetailHead(person(), null, { canGenerate: false });
    const order = [...noGen.querySelector('.bz-people-dt-actions')!.children];
    expect(order.map((n) => n.getAttribute('aria-label'))).toEqual(['互动统计', '补充背景', '返回列表']);
    expect(order[0].getAttribute('data-people-stats-open')).toBe('');
    expect(order[1].getAttribute('data-people-prof-open')).toBe('');
    expect(order[2].getAttribute('data-people-back-btn')).toBe('');
  });
});

describe('统计 / 档案弹窗（issue 455 弹窗化）', () => {
  const rec = (stats?: ImportRecord['stats']): ImportRecord => ({
    file: '数据源:陈默', importedAt: '2026-09-01T00:00:00.000Z', messageCount: 10, skippedCount: 0,
    timeFrom: '2026-01-01T00:00:00.000Z', timeTo: '2026-09-01T00:00:00.000Z', stats,
  });

  it('popShell：遮罩与关闭钮共用 data-people-pop-close，root 钩子标识弹窗身份，面板 role=dialog', () => {
    const pop = popShell('互动统计', 'data-people-stats-pop', [el('div', 'body-x')]);
    expect(pop.hasAttribute('data-people-stats-pop')).toBe(true);
    expect(pop.querySelector('[data-people-pop-close]')!.className).toBe('bz-people-pop-dim'); // 遮罩在前
    const closeBtn = pop.querySelector('[data-people-pop-close][aria-label="关闭"]');
    expect(closeBtn).toBeTruthy();
    const panel = pop.querySelector('[role="dialog"]')!;
    expect(panel.getAttribute('aria-label')).toBe('互动统计');
    expect(panel.querySelector('.bz-people-pop-body')!.querySelector('.body-x')).toBeTruthy();
  });

  it('统计弹窗正文：出卡即卡；占位口径不变（合成记录待画 / 旧版数据 / 无导入）', () => {
    const card = el('div', 'bz-people-insights');
    expect(statsPopBody(card, person())[0]).toBe(card);
    const pool = statsPopBody(null, person({ imports: [rec({ voiceCount: 1 })] })); // 有 stats 无 monthly = 452 合成记录
    expect(pool[0].getAttribute('data-people-data-hint')).toBe('');
    expect(pool[0].textContent).toContain('画完脸谱后这里会有完整的互动统计');
    const legacy = statsPopBody(null, person({ imports: [rec()] })); // 无 stats = 旧版数据
    expect(legacy[0].textContent).toContain('旧版数据');
    expect(statsPopBody(null, person())[0].textContent).toContain('还没有导入记录');
  });

  it('补充背景弹窗正文：有档显卡、编辑态出编辑器、全空给补档入口', () => {
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
});

describe('数据源弹窗（dsModal 四态）', () => {
  const state = (over: Partial<Parameters<typeof dsModal>[0]> = {}): Parameters<typeof dsModal>[0] => ({
    dataDir: 'D:/演示数据/export_full',
    scanning: false,
    importing: false,
    rows: [],
    selectedCount: 0,
    selected: [],
    freshCount: 0,
    hiddenGroups: 0,
    notice: '',
    generateable: false,
    desktopOnly: false,
    scannedAt: '10:32',
    ...over,
  });

  it('四态行：有更新 fresh 徽章 / 未导入 / 群聊禁勾灰置', () => {
    const fresh = dsRow({ ...dsRowBase }, false);
    expect(fresh.classList.contains('bz-people-ds-fresh')).toBe(true);
    expect(fresh.querySelector('.bz-people-ds-new')!.textContent).toBe('新 45 条');
    expect(fresh.querySelector('.bz-people-ds-mark')!.textContent).toBe('已导 1,159 条 · 画到 26-03-01');

    const none = dsRow({ ...dsRowBase, previewCount: 0, newCount: 0, processedTs: null }, false);
    expect(none.querySelector('.bz-people-ds-mark')!.textContent).toBe('未导入');

    const group = dsRow({ ...dsRowBase, name: '老周家', isGroup: true }, false);
    expect(group.classList.contains('bz-people-ds-off')).toBe(true);
    expect((group.querySelector('input') as HTMLInputElement).disabled).toBe(true);
    expect(group.querySelector('.bz-people-ds-name')!.textContent).toContain('（群）');
  });

  it('导入完成出「画脸谱」；未勾选页脚提示；勾选计数含新素材', () => {
    const gen = dsModal(state({ rows: [dsRowBase], generateable: true, selectedCount: 1, freshCount: 45 }));
    expect(gen.querySelector('[data-people-ds-generate]')).toBeTruthy();
    expect(gen.querySelector('[data-people-ds-count]')!.textContent).toBe('已选 1 位 · 新素材 45 条');

    const idle = dsModal(state({ rows: [dsRowBase], selectedCount: 0 }));
    expect(idle.querySelector('[data-people-ds-generate]')).toBeNull();
    expect(idle.querySelector('[data-people-ds-count]')!.textContent).toBe('未勾选联系人');
  });

  it('勾选态回显：重建弹层时 selected 名单里的行复选框保持勾选（P1 回归）', () => {
    const m = dsModal(state({ rows: [{ ...dsRowBase, name: '林晚' }, { ...dsRowBase, name: '陈默' }], selected: ['陈默'], selectedCount: 1 }));
    const boxes = [...m.querySelectorAll('input[data-people-ds-check]')];
    const checked = boxes.filter((b) => (b as HTMLInputElement).checked).map((b) => b.getAttribute('data-people-ds-check'));
    expect(checked).toEqual(['陈默']);
  });

  it('空态三兄弟：未扫描 / 仅桌面端 / 无联系人；图例快捷只在有更新时出现', () => {
    expect(dsModal(state({ rows: null })).textContent).toContain('还没扫描');
    expect(dsModal(state({ desktopOnly: true })).textContent).toContain('仅桌面端');
    expect(dsModal(state({ rows: [], hiddenGroups: 2 })).textContent).toContain('2 个群聊未纳入');
    const noFresh = dsModal(state({ rows: [{ ...dsRowBase, newCount: 0 }] }));
    expect(noFresh.querySelector('[data-people-ds-pickfresh]')).toBeNull();
  });
});

// ---------------- 生成进度块（issue 450：阶段化进度 + 后台化） ----------------

describe('进度块纯函数（455 四阶段口径）', () => {
  it('jobsPercent = (已完成批 + 已完成成文阶段) / (总批数 + 3)，钳 0~100（455 三段成文）', () => {
    expect(jobsPercent(0, 60, 0)).toBe(0);
    expect(jobsPercent(12, 60, 0)).toBe(19); // 12/63
    expect(jobsPercent(60, 60, 2)).toBe(98); // 62/63（编年史进行中 = 其人 / 我们已完成）
    expect(jobsPercent(60, 60, 3)).toBe(100);
    expect(jobsPercent(0, 0, 0)).toBe(0); // 总数未知不除零
    expect(jobsPercent(99, 1, 2)).toBe(100);
  });

  it('jobsStagesDone：四阶段对齐（extracting 逐批 → 画其人 → 写我们 → 编年史）——bond = 1、chronicle = 2、done = 3', () => {
    expect(jobsStagesDone('extracting', 'running')).toBe(0);
    expect(jobsStagesDone('person', 'running')).toBe(0);
    expect(jobsStagesDone('portrait', 'running')).toBe(0); // 旧引擎阶段名兼容（旧落盘）
    expect(jobsStagesDone('bond', 'running')).toBe(1);
    expect(jobsStagesDone('chronicle', 'running')).toBe(2);
    expect(jobsStagesDone(undefined, 'done')).toBe(3);
  });

  it('队列副文案：多人生成「（2/5 人）当前：大琳」；单人省略队列段', () => {
    expect(jobsQueueLabel(2, 5, '大琳')).toBe('（2/5 人）当前：大琳');
    expect(jobsQueueLabel(1, 1, '陈默')).toBe('当前：陈默');
  });

  it('无引擎文案时的状态兜底：各态都讲清下一步', () => {
    expect(jobsFallbackMessage('running', '陈默')).toContain('正在生成');
    expect(jobsFallbackMessage('paused', '陈默')).toContain('继续生成');
    expect(jobsFallbackMessage('interrupted', '陈默')).toContain('中断');
    expect(jobsFallbackMessage('error', '陈默')).toContain('失败');
    expect(jobsFallbackMessage('done', '陈默')).toContain('已生成');
  });
});

describe('progressBlock 状态机（450）', () => {
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

  it('运行中：细条宽度 = 百分比、主文案整句保留、队列副文案、出「暂停」不出「继续」', () => {
    const b = progressBlock(state());
    expect(b.getAttribute('data-people-jobs-talker')).toBe('wxid_a');
    expect(b.querySelector('.bz-people-jobs-fill')!.getAttribute('style')).toBe('width:19%');
    expect(b.querySelector('.bz-people-jobs-pct')!.textContent).toBe('19%');
    expect(b.querySelector('.bz-people-jobs-main')!.textContent).toBe('第 12/60 批 · 2026-05-01 ~ 2026-05-31 · 397 条');
    expect(b.querySelector('.bz-people-jobs-queue')!.textContent).toBe('（2/5 人）当前：陈默');
    expect(b.querySelector('.bz-people-jobs-note')!.textContent).toContain('后台');
    expect(b.querySelector('[data-people-jobs-pause]')).toBeTruthy();
    expect(b.querySelector('[data-people-jobs-resume]')).toBeNull();
  });

  it('主文案不截断：超长抽样说明整句保留在 DOM（换行交给样式）', () => {
    const long = '消息 91234 条 → 300 批超上限，均匀抽样 60 批（覆盖全时段，首尾必保），共 62 次 AI 调用';
    const b = progressBlock(state({ message: long }));
    expect(b.querySelector('.bz-people-jobs-main')!.textContent).toBe(long);
  });

  it('暂停 / 中断 / 可续 error 出「继续生成」；接不上的 error 出「删除任务」+ 错误说明；done 无动作钮', () => {
    const paused = progressBlock(state({ status: 'paused', message: '' }));
    expect(paused.querySelector('[data-people-jobs-resume]')!.textContent).toBe('继续生成');
    expect(paused.querySelector('.bz-people-jobs-main')!.textContent).toContain('已暂停');
    const interrupted = progressBlock(state({ status: 'interrupted', message: '' }));
    expect(interrupted.querySelector('[data-people-jobs-resume]')).toBeTruthy();
    // issue 453：error 也能续跑（451 放宽 resume）——默认出「继续生成」，只有漂移判废（resumable:false）
    // 才出「删除任务」（续跑必然再判废，删了重来才对）
    const err = progressBlock(state({ status: 'error', message: '', errorText: 'AI 调用超时' }));
    expect(err.querySelector('[data-people-jobs-resume]')!.textContent).toBe('继续生成');
    expect(err.querySelector('[data-people-jobs-dismiss]')).toBeNull();
    expect(err.querySelector('.bz-people-jobs-err')!.textContent).toBe('AI 调用超时');
    const dead = progressBlock(state({ status: 'error', message: '', errorText: '消息集已变化', resumable: false }));
    expect(dead.querySelector('[data-people-jobs-dismiss]')!.textContent).toBe('删除任务');
    expect(dead.querySelector('[data-people-jobs-resume]')).toBeNull();
    const done = progressBlock(state({ status: 'done', message: '', stagesDone: 3, batchesDone: 60 }));
    expect(done.querySelector('[data-people-jobs-pause]')).toBeNull();
    expect(done.querySelector('[data-people-jobs-resume]')).toBeNull();
    expect(done.querySelector('[data-people-jobs-dismiss]')).toBeNull();
    expect(done.querySelector('.bz-people-jobs-pct')!.textContent).toBe('100%');
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
