/**
 * 脸谱 render 纯层测试（issue 447）：折子封面（竖排截断 / 印章水位 / 合并态）、
 * 详情折页册（五折结构 / 折脊引文）、数据源弹窗（四态行 / 勾选文案 / 图例快捷）。
 * markup 单源的锚测试——类名与 data 钩子即 ui 委托契约。
 * 隐私口径：fixture 全构造数据。
 */
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  dsModal,
  dsRow,
  foldBook,
  foldCard,
  formatCount,
  panelShell,
  statsText,
  vtName,
  type DsRowState,
} from '../../src/people/render';
import type { PersonEntry } from '../../src/people/types';

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
});

describe('面板壳与统计行', () => {
  it('壳含数据源入口 / 进度行 / 弹层容器（data 钩子即委托契约）', () => {
    const shell = panelShell();
    expect(shell.querySelector('[data-people-ds-open]')).toBeTruthy();
    expect(shell.querySelector('[data-people-runline]')).toBeTruthy();
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

describe('详情折页册（foldBook）', () => {
  const bodies = { p: [], e: [], c: [], d: [], f: [] } as Record<string, never[]>;
  const spills = { p: '画像引文', e: '事件引文', c: '大事记引文', d: '数据引文', f: '档案引文' };

  it('五折齐全；展开折有正文容器，收起折出竖排引文', () => {
    const book = foldBook(person(), { fold: 'p', media: null, profEdit: false, noteAdd: false }, bodies, spills);
    const leaves = book.querySelectorAll('[data-people-leaf]');
    expect(leaves.length).toBe(5);
    const pLeaf = book.querySelector('[data-people-leaf="p"]')!;
    expect(pLeaf.classList.contains('bz-people-leaf-on')).toBe(true);
    expect(pLeaf.querySelector('.bz-people-leaf-body')).toBeTruthy();
    const eLeaf = book.querySelector('[data-people-leaf="e"]')!;
    expect(eLeaf.querySelector('.bz-people-leaf-spill')!.textContent).toBe('事件引文');
    expect(eLeaf.querySelector('.bz-people-leaf-body')).toBeNull();
  });
});

describe('数据源弹窗（dsModal 四态）', () => {
  const state = (over: Partial<Parameters<typeof dsModal>[0]> = {}): Parameters<typeof dsModal>[0] => ({
    dataDir: 'D:/演示数据/export_full',
    scanning: false,
    importing: false,
    rows: [],
    selectedCount: 0,
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

  it('空态三兄弟：未扫描 / 仅桌面端 / 无联系人；图例快捷只在有更新时出现', () => {
    expect(dsModal(state({ rows: null })).textContent).toContain('还没扫描');
    expect(dsModal(state({ desktopOnly: true })).textContent).toContain('仅桌面端');
    expect(dsModal(state({ rows: [], hiddenGroups: 2 })).textContent).toContain('2 个群聊未纳入');
    const noFresh = dsModal(state({ rows: [{ ...dsRowBase, newCount: 0 }] }));
    expect(noFresh.querySelector('[data-people-ds-pickfresh]')).toBeNull();
  });
});
