// @vitest-environment node
/**
 * 备忘录渲染纯层测试（issue 260 §2 / ADR-0104）。
 * render.ts 是「原型 × 插件」markup 单源——这里冻结各构建器的 markup 口径：
 * 锚点（data-memo-*）、类名（bz-memo-*，皮肤/状态染色依赖）、due/相对时间的参数注入语义。
 */
import { describe, it, expect } from 'vitest';
import {
  MEMO_ICONS, iconSpan, sceneDot, sceneLabel, sceneLeadHtml,
  mainCountHtml, navBtnHtml, mobChipHtml, panelShellHtml,
  metaTagsHtml, cardHtml, sectionLabelHtml, doneBarHtml, doneMoreHtml,
} from '../../src/memo/render';
import type { MemoItem } from '../../src/memo/types';

const item = (extra: Partial<MemoItem> = {}): MemoItem => ({
  id: 't1', title: '写周报', scene: '工作', priority: 'minor', created: '2026-09-10 09:00:00',
  completed: null, due: null, notePath: null, notePosition: null, scriptName: null,
  courseName: null, coursePath: null, linkedNote: null, url: null, ...extra,
});

describe('memo render 纯层（markup 口径冻结）', () => {
  it('iconSpan：lucide 占位 + 附加类', () => {
    expect(iconSpan('star')).toBe('<i data-lucide="star" class="bz-ic"></i>');
    expect(iconSpan('star', 'bz-ic--warning')).toBe('<i data-lucide="star" class="bz-ic bz-ic--warning"></i>');
    expect(MEMO_ICONS.brand).toBe('list-checks');
  });

  it('sceneDot：六场景语义色 + 未知灰兜底', () => {
    expect(sceneDot('代码')).toBe('#4c82c8');
    expect(sceneDot('不存在')).toBe('#8b8f9a');
  });

  it('sceneLabel：剥首 emoji；sceneLeadHtml 三槽（伪场景图标/emoji/彩圆）', () => {
    expect(sceneLabel('🏠 家')).toBe('家');
    expect(sceneLabel('工作')).toBe('工作');
    // 伪场景（全部）→ 图标槽
    expect(sceneLeadHtml({ scene: '全部', dot: '' }, 'bz-rail-dot')).toContain('data-lucide="layers"');
    // emoji 场景 → emoji 槽
    expect(sceneLeadHtml({ scene: '🏠 家', dot: '' }, 'bz-rail-dot')).toContain('bz-rail-emoji');
    // 用户场景 → 彩圆槽（场景色走 --bz-rail-tint）
    expect(sceneLeadHtml({ scene: '工作', dot: '#b25757' }, 'bz-rail-dot')).toContain('--bz-rail-tint:#b25757');
  });

  it('mainCountHtml：双计数包 .bz-memo-cnt-num（皮肤染色钩子）', () => {
    const h = mainCountHtml(12, 3);
    expect(h).toContain('>12</span> 项');
    expect(h).toContain('>3</span> 未完成');
    expect(h.match(/bz-memo-cnt-num/g)).toHaveLength(2);
  });

  it('navBtnHtml / mobChipHtml：锚点、激活态、计数', () => {
    const o = { scene: '工作', dot: '#b25757' };
    const nav = navBtnHtml(o, true, 7);
    expect(nav).toContain('data-memo-scene="工作"');
    expect(nav).toContain('bz-rail-item on');
    expect(nav).toContain('>7</span>');
    const chip = mobChipHtml(o, false);
    expect(chip).toContain('bz-mobstrip-chip"');
    expect(chip).not.toContain('is-on');
    expect(mobChipHtml(o, true)).toContain('is-on');
  });

  it('panelShellHtml：全部行为锚点在场', () => {
    const h = panelShellHtml();
    for (const anchor of [
      'data-memo-head-settings', 'data-memo-head-close', 'data-memo-nav', 'data-memo-addscene',
      'data-memo-main-title', 'data-memo-main-count', 'data-memo-newbtn', 'data-memo-search',
      'data-memo-sort', 'data-memo-mob-scenes', 'data-memo-content',
      'data-memo-composer-input', 'data-memo-composer-add',
    ]) expect(h).toContain(anchor);
    expect(h).toContain('bz-panel-frame bz-memo-panel bz-panel-mtop');
  });

  it('metaTagsHtml：顺序 课程→脚本→链接→位置→场景→截止→时间；due/相对时间参数注入', () => {
    const base = item({
      scene: '公开课', courseName: '《数据分析实战》', url: 'https://example.com/a',
      notePath: '笔记/算法笔记.md', priority: 'important',
    });
    // 公开课课程同名文件不重复显示位置
    const h = metaTagsHtml(base, { status: 'overdue', text: '1天前已过期' }, '3 小时前');
    const order = ['bz-memo-tag-course', 'bz-memo-tag-url', 'bz-memo-tag-pos', 'bz-memo-tag-scene', 'bz-memo-tag-overdue', 'bz-memo-time'];
    let last = -1;
    for (const cls of order) {
      const at = h.indexOf(cls);
      expect(at, cls + ' 应在场').toBeGreaterThan(-1);
      expect(at, cls + ' 应按序').toBeGreaterThan(last);
      last = at;
    }
    expect(h).toContain('数据分析实战'); // 课程名去书名号
    expect(h).toContain('1天前已过期'); // due 文本调用方注入
    expect(h).not.toContain('《'); // 书名号剥除
    // 脚本标签仅代码场景
    const code = metaTagsHtml(item({ scene: '代码', scriptName: 'a.py' }), null, '');
    expect(code).toContain('bz-memo-tag-script');
    // 无 due 包不出截止标签；无 relTime 不出时间
    expect(metaTagsHtml(item({ due: '2026-09-09 10:00:00' }), null, '')).not.toContain('bz-memo-tag-overdue');
  });

  it('cardHtml：完成态类、可点标题锚、勾选锚', () => {
    const done = cardHtml(item({ completed: '2026-09-10 10:00:00' }), null, '');
    expect(done).toContain('bz-memo-done');
    expect(done).toContain('bz-memo-checked');
    const linked = cardHtml(item({ linkedNote: '笔记/a.md' }), null, '');
    expect(linked).toContain('data-memo-openitem="t1"');
    const plain = cardHtml(item(), null, '');
    expect(plain).not.toContain('data-memo-openitem');
    expect(plain).toContain('data-memo-id="t1"');
    expect(plain).toContain('data-memo-check');
  });

  it('分区/折叠条/更早 N 条', () => {
    expect(sectionLabelHtml('到期优先', 2)).toContain('bz-memo-section-label');
    expect(sectionLabelHtml('到期优先', 2)).toContain('>2</span>');
    expect(doneBarHtml(true, 5)).toContain('bz-memo-donebar-open');
    expect(doneBarHtml(false, 5)).toContain('data-memo-donebar');
    expect(doneMoreHtml(4)).toContain('data-memo-donemore');
    expect(doneMoreHtml(4)).toContain('更早 4 条');
  });
});
