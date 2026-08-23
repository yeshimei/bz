/**
 * 卡片盒/现代诗/信 观察纯函数层（ticket 083，ADR-0035；v1 + v2 段落 diff + v3 真实日期 + v4 readonly）：
 * 文案（首落三句式带日期/删除）、文件名去 .md、正文去 frontmatter、日期解析（信 frontmatter / 诗三层回退）、
 * 段落 diff 摘要（删/增/改段、段号旧新档、50/30 字截断、等 N 处、无变化 null、小改动触发）、
 * 结算判定（首落有字门/空文件/无日期跳过/正文变化即产/纯空白推进基线）。
 * 集成链路见 note-action.test.ts。
 */
import { describe, it, expect } from 'vitest';
import {
  noteFirstText, noteDeleteText, noteFileName, noteBodyText, frontmatterOf, letterReadonly,
  parseNoteDate, formatNoteDate, noteDiffSummary, decideNoteSettle,
  type NoteSettleState,
} from '../../src/smartcat/note-source';

describe('观察文案（用户拍板措辞）', () => {
  it('首落三句式：flash 无日期、poem/letter 带日期（v3）', () => {
    expect(noteFirstText('flash', 'TDD', '今天实践 TDD', null)).toBe('你在卡片盒记下了「TDD」：「今天实践 TDD」');
    expect(noteFirstText('poem', '忧郁啊', '黑夜给了我黑色的眼睛', '2016-12-30 08:00')).toBe('你在 2016-12-30 08:00 写了一首现代诗「忧郁啊」：黑夜给了我黑色的眼睛');
    expect(noteFirstText('letter', '第2封信：在大理的风', '见字如面', '2026-06-17 23:44')).toBe('你在 2026-06-17 23:44 写了一封信「第2封信：在大理的风」：见字如面');
  });

  it('poem/letter 无日期 → 首落返回 null（不产）', () => {
    expect(noteFirstText('poem', '无名', '内容', null)).toBeNull();
    expect(noteFirstText('letter', '第0封', '内容', null)).toBeNull();
  });

  it('删除三句式（v1 不变）', () => {
    expect(noteDeleteText('flash', 'TDD')).toBe('你删除了卡片盒「TDD」');
    expect(noteDeleteText('poem', '忧郁啊')).toBe('你删除了现代诗「忧郁啊」');
    expect(noteDeleteText('letter', '第2封信')).toBe('你删除了信「第2封信」');
  });

  it('首落正文全量不截断（多行 trim 后全量进文案）', () => {
    const body = '第一行\n\n第二行\n第三行';
    expect(noteFirstText('flash', 'TDD', body, null)).toContain(body);
    expect(noteFirstText('letter', '第0封', body, '2026-01-01 08:00')).toContain(body);
  });
});

describe('noteFileName / noteBodyText / frontmatter', () => {
  it('文件名去 .md 保留原名（含日期前缀/标点/空格）', () => {
    expect(noteFileName('卡片盒/TDD.md')).toBe('TDD');
    expect(noteFileName('卡片盒/Apple u.md')).toBe('Apple u');
    expect(noteFileName('我的/现代诗/2016/161230 忧郁啊.md')).toBe('161230 忧郁啊');
    expect(noteFileName('我的/信/第2封信：在大理的风.md')).toBe('第2封信：在大理的风');
    expect(noteFileName('卡片盒\\Apple u.md')).toBe('Apple u');
  });

  it('正文 = 去 frontmatter 块后全量 trim（仅改 frontmatter 不产观察的语义基础）', () => {
    expect(noteBodyText('---\ndate: 2026-06-17 23:44\nreadonly: true\n---\n正文第一行\n第二行')).toBe('正文第一行\n第二行');
    expect(noteBodyText('  \n\n无 frontmatter 正文  ')).toBe('无 frontmatter 正文');
    expect(noteBodyText('')).toBe('');
  });

  it('frontmatterOf / letterReadonly（v4）', () => {
    expect(frontmatterOf('---\ndate: 2026-06-17 23:44\nreadonly: true\n---\nx').readonly).toBe('true');
    expect(frontmatterOf('---\ndate: 2026-06-17\n---\nx').readonly).toBeUndefined();
    expect(letterReadonly('---\nreadonly: true\n---\nx')).toBe(true);
    expect(letterReadonly('---\ndate: 2026-06-17 23:44\n---\nx')).toBe(false);
    expect(letterReadonly('无 frontmatter')).toBe(false);
  });
});

describe('parseNoteDate / formatNoteDate（v3 真实日期）', () => {
  it('formatNoteDate：空格式 / ISO / 仅日期 三式兼容', () => {
    expect(formatNoteDate('2026-06-17 23:44')).toBe('2026-06-17 23:44');
    expect(formatNoteDate('2026-07-06T12:14:00')).toBe('2026-07-06 12:14');
    expect(formatNoteDate('2026-07-06T12:14:00+08:00')).toBe('2026-07-06 12:14');
    expect(formatNoteDate('2026-06-17')).toBe('2026-06-17 08:00');
    expect(formatNoteDate('不是日期')).toBeNull();
  });

  it('信：frontmatter date 为主，两种格式；无 date → null（准入）', () => {
    expect(parseNoteDate('letter', '---\ndate: 2026-06-17 23:44\n---\n正文', '我的/信/第2封信：在大理的风.md')).toBe('2026-06-17 23:44');
    expect(parseNoteDate('letter', '---\ndate: 2026-07-06T12:14:00\n---\n正文', '我的/信/第0封信.md')).toBe('2026-07-06 12:14');
    expect(parseNoteDate('letter', '---\ntitle: 试\n---\n正文', '我的/信/x.md')).toBeNull();
    expect(parseNoteDate('letter', '无 frontmatter', '我的/信/x.md')).toBeNull();
  });

  it('现代诗三层回退：frontmatter → YYMMDD 文件名 → 父目录年份+MMDD', () => {
    // ① frontmatter date 优先（2026 新诗）
    expect(parseNoteDate('poem', '---\ndate: 2026-03-01 09:30\n---\n诗', '我的/现代诗/2026/0115.md')).toBe('2026-03-01 09:30');
    // ② 文件名 YYMMDD 前缀（老诗，08:00 占位）
    expect(parseNoteDate('poem', '诗', '我的/现代诗/161230 忧郁啊.md')).toBe('2016-12-30 08:00');
    // ③ 父目录=年份 + 文件名 MMDD 前缀（新诗，08:00 占位）
    expect(parseNoteDate('poem', '诗', '我的/现代诗/2026/0115.md')).toBe('2026-01-15 08:00');
    // 三者皆无 → null（不补首落，修改照产）
    expect(parseNoteDate('poem', '诗', '我的/现代诗/无名诗.md')).toBeNull();
  });

  it('flash 恒 null（卡片盒无日期概念）', () => {
    expect(parseNoteDate('flash', '---\ndate: 2026-01-01\n---\nx', '卡片盒/TDD.md')).toBeNull();
  });
});

describe('noteDiffSummary（v2 段落级 diff）', () => {
  it('删段：旧文档段号', () => {
    expect(noteDiffSummary('flash', 'TDD', 'A\n\nB\n\nC', 'A\n\nC')).toBe('你修改了卡片盒「TDD」：删除了第 2 段「B」');
  });

  it('增段：新文档段号', () => {
    expect(noteDiffSummary('letter', '阿尼玛', 'A\n\nC', 'A\n\nB\n\nC')).toBe('你修改了信「阿尼玛」：新增了第 2 段「B」');
  });

  it('改段（相邻删增块字符重叠率 ≥0.5，报旧段号）：旧前 30 → 新前 30', () => {
    expect(noteDiffSummary('poem', '忧郁啊', '今天天气很好', '今天天气很好很热')).toBe(
      '你修改了现代诗「忧郁啊」：修改了第 1 段「今天天气很好」→「今天天气很好很热」',
    );
  });

  it('重叠率 <0.5 的相邻删增 → 按删除+新增分别报（异类「；」）', () => {
    expect(noteDiffSummary('flash', 'TDD', 'A\n\nX\n\nC', 'A\n\nY\n\nC')).toBe('你修改了卡片盒「TDD」：删除了第 2 段「X」；新增了第 2 段「Y」');
  });

  it('同类多项「、」连接：删 3 段', () => {
    expect(noteDiffSummary('flash', 'TDD', 'A\n\nB\n\nC\n\nD', 'A')).toBe('你修改了卡片盒「TDD」：删除了第 2 段「B」、删除了第 3 段「C」、删除了第 4 段「D」');
  });

  it('每类最多 3 段，超出 → 「等 N 处<类名>」', () => {
    expect(noteDiffSummary('letter', '阿尼玛', 'A\n\nB\n\nC\n\nD\n\nE', 'A')).toBe(
      '你修改了信「阿尼玛」：删除了第 2 段「B」、删除了第 3 段「C」、删除了第 4 段「D」、等 1 处删除',
    );
  });

  it('删除段前 50 字截断（超长加…）', () => {
    const b = noteDiffSummary('flash', 'TDD', '啊'.repeat(60), '');
    expect(b).toBe('你修改了卡片盒「TDD」：删除了第 1 段「' + '啊'.repeat(50) + '…」');
  });

  it('修改段旧/新各前 30 字截断（重叠 ≥0.5 走修改段）', () => {
    const old = '旧'.repeat(40);
    const neu = '旧'.repeat(45);
    expect(noteDiffSummary('poem', '夜航', old, neu)).toBe(
      '你修改了现代诗「夜航」：修改了第 1 段「' + '旧'.repeat(30) + '…」→「' + '旧'.repeat(30) + '…」',
    );
  });

  it('无变化 → null（纯空白/换行变化亦为 null）', () => {
    expect(noteDiffSummary('flash', 'TDD', 'A\n\nB', 'A\n\nB')).toBeNull();
    expect(noteDiffSummary('flash', 'TDD', 'A\n\nB', 'A\n\n\n\nB')).toBeNull();
    expect(noteDiffSummary('flash', 'TDD', '', '')).toBeNull();
  });

  it('小改动也触发（改一个字 → 修改段）', () => {
    expect(noteDiffSummary('flash', 'TDD', '今天天气很好', '今天天气不好')).toContain('修改了第 1 段');
  });

  it('三域头部各自正确', () => {
    expect(noteDiffSummary('flash', 'TDD', 'A', 'A\n\nB')).toContain('你修改了卡片盒「TDD」');
    expect(noteDiffSummary('poem', '夜航', 'A', 'A\n\nB')).toContain('你修改了现代诗「夜航」');
    expect(noteDiffSummary('letter', '第2封', 'A', 'A\n\nB')).toContain('你修改了信「第2封」');
  });
});

describe('decideNoteSettle（v2 简化 + v3 日期）', () => {
  const base: NoteSettleState = { generated: false, baseline: '' };

  it('首落：flash 有字 → 新增观察（全文），next 记已见基线=全文', () => {
    const r = decideNoteSettle('flash', 'TDD', '今天实践 TDD', base, null);
    expect(r.kind).toBe('first');
    if (r.kind !== 'first') return;
    expect(r.text).toBe('你在卡片盒记下了「TDD」：「今天实践 TDD」');
    expect(r.next).toEqual({ generated: true, baseline: '今天实践 TDD' });
  });

  it('首落：poem 带日期 → 新增观察；无日期 → 不产但记已见防重复', () => {
    const p = decideNoteSettle('poem', '夜航', '一行诗', base, '2026-01-15 08:00');
    expect(p.kind).toBe('first');
    if (p.kind !== 'first') return;
    expect(p.text).toBe('你在 2026-01-15 08:00 写了一首现代诗「夜航」：一行诗');
    const p2 = decideNoteSettle('poem', '无名', '一行诗', base, null);
    expect(p2).toEqual({ kind: 'none', text: null, next: { generated: true, baseline: '一行诗' } });
    const l2 = decideNoteSettle('letter', '第0封', '内容', base, null);
    expect(l2).toEqual({ kind: 'none', text: null, next: { generated: true, baseline: '内容' } });
  });

  it('首落空文件 → 不生成（next 不变，补字后走首落）', () => {
    const r = decideNoteSettle('flash', '夜航', '   \n\n', base, null);
    expect(r).toEqual({ kind: 'none', text: null, next: base });
    const r2 = decideNoteSettle('flash', '夜航', '写了一行诗', base, null);
    expect(r2.kind).toBe('first');
  });

  it('已生成：正文无变化 → 不产（状态不变）', () => {
    const state: NoteSettleState = { generated: true, baseline: 'A\n\nB' };
    const r = decideNoteSettle('flash', 'TDD', 'A\n\nB', state, null);
    expect(r).toEqual({ kind: 'none', text: null, next: state });
  });

  it('已生成：正文任何变化 → 产 diff 摘要（小改动也产）+ next.baseline 推进到新全文', () => {
    const state: NoteSettleState = { generated: true, baseline: '今天天气很好' };
    const r = decideNoteSettle('letter', '阿尼玛', '今天天气很好很热', state, '2026-06-17 23:44');
    expect(r.kind).toBe('update');
    if (r.kind !== 'update') return;
    expect(r.text).toBe('你修改了信「阿尼玛」：修改了第 1 段「今天天气很好」→「今天天气很好很热」');
    expect(r.next).toEqual({ generated: true, baseline: '今天天气很好很热' });
  });

  it('已生成：纯空白/换行变化 → 不产但 next.baseline 推进（吸收空白差异）', () => {
    const state: NoteSettleState = { generated: true, baseline: 'A\n\nB' };
    const r = decideNoteSettle('flash', 'TDD', 'A\n\n\n\nB', state, null);
    expect(r.kind).toBe('none');
    if (r.kind !== 'none') return;
    expect(r.next).toEqual({ generated: true, baseline: 'A\n\n\n\nB' });
  });
});