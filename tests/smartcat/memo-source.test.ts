/**
 * 备忘录动作观察文案层（ticket 075）：文案构造纯函数全覆盖——
 * 添加键值式（有才加，键序 场景→脚本→课程→优先级→截止→笔记）/ 编辑 α 合并（标题变主句/改题为/更新了+变更列表）
 * 完成/恢复/延后/优先级/删除/每日到期扫描合并一条（≤5 截断、日期语义、N=0 不产出）。
 */
import { describe, it, expect } from 'vitest';
import {
  memoAddedText, memoEditedText, memoCompletedText, memoRestoredText, memoPostponedText,
  memoPriorityText, memoDeletedText, memoDueObservation, buildMemoActionText,
  type MemoEditSnapshot,
} from '../../src/smartcat/memo-source';

describe('memoAddedText（添加，键值式有才加）', () => {
  it('全部键：场景→脚本→课程→优先级→截止→笔记（笔记取路径尾名）', () => {
    expect(memoAddedText('写周报', '工作', 'important', '2026-08-25 18:00', '书库/1984.md', 'main.py', '算法'))
      .toBe('你添加了待办「写周报」（场景：工作，脚本：main.py，课程：算法，优先级：重要，截止：08-25 18:00，笔记：1984.md）');
  });
  it('有才加：无脚本/课程/截止/笔记时仅 场景+优先级；T 格式截止归一', () => {
    expect(memoAddedText('买菜', '生活', 'minor', '2026-08-25T20:30', null, null, null))
      .toBe('你添加了待办「买菜」（场景：生活，优先级：次要，截止：08-25 20:30）');
    expect(memoAddedText('纯文本', '剪藏', 'minor', null, null, null, null))
      .toBe('你添加了待办「纯文本」（场景：剪藏，优先级：次要）');
  });
});

describe('memoEditedText（编辑 α 合并）', () => {
  const snap = (p: Partial<MemoEditSnapshot>): MemoEditSnapshot => ({
    title: '写周报', scene: '工作', priority: 'minor', due: null, notePath: null, scriptName: null, courseName: null,
    ...p,
  });
  it('标题变 + 其他变更 → 主句「你编辑了待办」+（变更列表，示例逐字）', () => {
    const old = snap({ title: '草稿', scene: '生活', courseName: '旧课' });
    const next = snap({ title: '写周报', scene: '工作', courseName: '算法', notePath: '书库/1984.md' });
    expect(memoEditedText(old, next))
      .toBe('你编辑了待办「写周报」（课程改为「算法」，场景改为「工作」，关联笔记 书库/1984.md）');
  });
  it('仅标题变 → 以「改题为」为主句', () => {
    expect(memoEditedText(snap({ title: '旧标题' }), snap({ title: '新标题' }))).toBe('你改题为「新标题」');
  });
  it('标题没变 + 变更 → 「你更新了待办」+：+ 变更列表（示例逐字）', () => {
    const old = snap({ courseName: '旧课', scriptName: '主页', due: '2026-08-31 12:00' });
    const next = snap({ courseName: '算法', scriptName: null, due: '2026-09-01 12:00' });
    expect(memoEditedText(old, next))
      .toBe('你更新了待办「写周报」：课程改为「算法」、删除脚本「主页」、截止延到 09-01 12:00');
  });
  it('无变化 → null（不产出）', () => {
    const s = snap({});
    expect(memoEditedText(s, { ...s })).toBeNull();
  });
  it('课程/脚本 增改删、定位 关联/改/删、截止 设/延/清除、优先级改', () => {
    expect(memoEditedText(snap({ courseName: null }), snap({ courseName: '算法' }))).toBe('你更新了待办「写周报」：添加课程「算法」');
    expect(memoEditedText(snap({ courseName: '算法' }), snap({ courseName: null }))).toBe('你更新了待办「写周报」：删除课程');
    expect(memoEditedText(snap({ scriptName: null }), snap({ scriptName: 'main.py' }))).toBe('你更新了待办「写周报」：添加脚本「main.py」');
    expect(memoEditedText(snap({ scriptName: 'main.py' }), snap({ scriptName: 'app.py' }))).toBe('你更新了待办「写周报」：脚本改为「app.py」');
    expect(memoEditedText(snap({ notePath: null }), snap({ notePath: '书库/1984.md' }))).toBe('你更新了待办「写周报」：关联笔记 书库/1984.md');
    expect(memoEditedText(snap({ notePath: '书库/1984.md' }), snap({ notePath: '书库/1985.md' }))).toBe('你更新了待办「写周报」：笔记改为 书库/1985.md');
    expect(memoEditedText(snap({ notePath: '书库/1984.md' }), snap({ notePath: null }))).toBe('你更新了待办「写周报」：删除笔记关联');
    expect(memoEditedText(snap({ due: null }), snap({ due: '2026-08-25 18:00' }))).toBe('你更新了待办「写周报」：设截止 08-25 18:00');
    expect(memoEditedText(snap({ due: '2026-08-25 18:00' }), snap({ due: null }))).toBe('你更新了待办「写周报」：清除截止日期');
    expect(memoEditedText(snap({ priority: 'minor' }), snap({ priority: 'important' }))).toBe('你更新了待办「写周报」：优先级改为重要');
  });
});

describe('完成/恢复/延后/优先级/删除（仅标题）', () => {
  it('五种动作文案', () => {
    expect(memoCompletedText('写周报')).toBe('你完成了待办「写周报」');
    expect(memoRestoredText('写周报')).toBe('你把待办「写周报」恢复为未完成');
    expect(memoPostponedText('写周报', '2026-08-28 18:00')).toBe('你把待办「写周报」延后到了 08-28 18:00');
    expect(memoPriorityText('写周报', 'important')).toBe('你把待办「写周报」转为重要');
    expect(memoPriorityText('写周报', 'minor')).toBe('你把待办「写周报」转为次要');
    expect(memoDeletedText('写周报')).toBe('你删除了待办「写周报」');
  });
});

describe('memoDueObservation（每日到期扫描合并一条）', () => {
  const now = new Date(2026, 7, 25, 9, 0); // 2026-08-25 09:00 本地
  it('无到期/空/已完成/跨天 → null', () => {
    expect(memoDueObservation([], now)).toBeNull();
    expect(memoDueObservation([{ title: 'a', due: null, completed: null }], now)).toBeNull();
    expect(memoDueObservation([{ title: 'a', due: '2026-08-24 18:00', completed: null }], now)).toBeNull(); // 昨天
    expect(memoDueObservation([{ title: 'a', due: '2026-08-26 18:00', completed: null }], now)).toBeNull(); // 明天
    expect(memoDueObservation([{ title: 'a', due: '2026-08-25 18:00', completed: '2026-08-25 08:00' }], now)).toBeNull(); // 已完成
    expect(memoDueObservation([{ title: 'a', due: '2026-08-25 08:00', completed: null }], now)).toBeNull(); // 今天但已过时刻（overdue）
  });
  it('今天到期且未完成 → 合并一条（HH:mm）', () => {
    const items = [
      { title: '写周报', due: '2026-08-25 18:00', completed: null },
      { title: '买菜', due: '2026-08-25T20:30', completed: null },
      { title: '已完成项', due: '2026-08-25 12:00', completed: '2026-08-25 08:00' },
    ];
    expect(memoDueObservation(items, now))
      .toBe('你有 2 个待办今天到期：写周报（18:00）、买菜（20:30）');
  });
  it('超过 5 条 → 截断展示前 5，追加「等 N 个」', () => {
    const mk = (i: number) => ({ title: `待办${i}`, due: `2026-08-25 1${i}:00`, completed: null });
    const items = Array.from({ length: 7 }, (_, i) => mk(i));
    const text = memoDueObservation(items, now)!;
    expect(text).toContain('你有 7 个待办今天到期：');
    expect(text).toContain('待办0（10:00）、待办1（11:00）、待办2（12:00）、待办3（13:00）、待办4（14:00）');
    expect(text).toContain('等 7 个');
    expect(text).not.toContain('待办5');
  });
  it('恰好 5 条 → 不截断（无「等 N 个」后缀）', () => {
    const mk = (i: number) => ({ title: `待办${i}`, due: `2026-08-25 1${i}:00`, completed: null });
    expect(memoDueObservation(Array.from({ length: 5 }, (_, i) => mk(i)), now))
      .toBe('你有 5 个待办今天到期：待办0（10:00）、待办1（11:00）、待办2（12:00）、待办3（13:00）、待办4（14:00）');
  });
});

describe('buildMemoActionText（事件 → 观察文本）', () => {
  it('全动作映射', () => {
    expect(buildMemoActionText({ kind: 'added', title: '写周报', scene: '工作', priority: 'important', due: '2026-08-25 18:00', notePath: '书库/1984.md', scriptName: null, courseName: '算法' }))
      .toBe('你添加了待办「写周报」（场景：工作，课程：算法，优先级：重要，截止：08-25 18:00，笔记：1984.md）');
    expect(buildMemoActionText({ kind: 'completed', title: '写周报' })).toBe('你完成了待办「写周报」');
    expect(buildMemoActionText({ kind: 'restored', title: '写周报' })).toBe('你把待办「写周报」恢复为未完成');
    expect(buildMemoActionText({ kind: 'postponed', title: '写周报', due: '2026-08-28 18:00' })).toBe('你把待办「写周报」延后到了 08-28 18:00');
    expect(buildMemoActionText({ kind: 'priority', title: '写周报', to: 'minor' })).toBe('你把待办「写周报」转为次要');
    expect(buildMemoActionText({ kind: 'deleted', title: '写周报' })).toBe('你删除了待办「写周报」');
  });
  it('编辑无变化 → null', () => {
    const s: MemoEditSnapshot = { title: '写周报', scene: '工作', priority: 'minor', due: null, notePath: null, scriptName: null, courseName: null };
    expect(buildMemoActionText({ kind: 'edited', old: s, next: { ...s } })).toBeNull();
  });
});