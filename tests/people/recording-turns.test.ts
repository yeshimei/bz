/**
 * 录音轮次/段落并仓测试（issue 509 / ADR-0212、0213；段落化 ADR-0220）：
 * segmentRecordingTurns 的断段规则（同人连续合并 / 说话人交替 / 空转写轮不断段 / 旁音与 ? 断段 /
 * 情感一致才带）、applyRecordingTurnsToMsgs 的段合成（type=9001、key `rec:<file>:s<段序>`、
 * ts 取段首轮、dur 取段跨度）、同录音重跑幂等、多录音互不干扰、buildRecordingText 标签形态、
 * storeStatsOf 录音聚合（按段计）。纯数据层，无 DOM。
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  applyRecordingTurnsToMsgs,
  buildRecordingText,
  recordingTurnSegments,
  segmentRecordingTurns,
  storeStatsOf,
  type StoreMsg,
  type RecordingTurn,
} from '../../src/people/datasource';

const turn = (over: Partial<RecordingTurn>): RecordingTurn => ({
  start: 0,
  end: 10,
  speaker: '我',
  text: '构造轮次',
  ...over,
});

const msg = (over: Partial<StoreMsg>): StoreMsg => ({
  key: 's1:100',
  ts: 1700000000000,
  isSender: false,
  type: 1,
  text: '普通消息',
  ...over,
});

describe('segmentRecordingTurns 段落切分（ADR-0220）', () => {
  it('同人连续（无时间间隔阈值）合并为一段：text 直连、start 取首轮、end 取末轮', () => {
    const segs = segmentRecordingTurns([
      turn({ start: 0, end: 5, text: '早' }),
      turn({ start: 5, end: 9, text: '吃了没' }),
      turn({ start: 600, end: 605, text: '隔十分钟又一句' }), // 同人隔久也算同段（知情项）
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ start: 0, end: 605, speaker: '我', text: '早吃了没隔十分钟又一句' });
  });

  it('说话人交替 → 各成一段，归属随 speaker', () => {
    const segs = segmentRecordingTurns([
      turn({ start: 0, end: 3, speaker: '我', text: '甲' }),
      turn({ start: 3, end: 6, speaker: '大琳', text: '乙' }),
      turn({ start: 6, end: 9, speaker: '我', text: '丙' }),
    ]);
    expect(segs.map((s) => s.speaker)).toEqual(['我', '大琳', '我']);
    expect(segs.map((s) => s.text)).toEqual(['甲', '乙', '丙']);
  });

  it('空转写轮不输出也不断段（同一说话人只是没转出文本）', () => {
    const segs = segmentRecordingTurns([
      turn({ start: 0, end: 3, text: '前半句' }),
      turn({ start: 3, end: 5, text: '   ' }),
      turn({ start: 5, end: 8, text: '后半句' }),
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe('前半句后半句');
    expect(segs[0].end).toBe(8);
  });

  it('旁音轮不进仓，且断开前后同人的段落', () => {
    const segs = segmentRecordingTurns([
      turn({ start: 0, end: 3, speaker: '我', text: '前' }),
      turn({ start: 3, end: 6, speaker: '其他', text: '电视里的人声' }),
      turn({ start: 6, end: 9, speaker: '我', text: '后' }),
    ]);
    expect(segs.map((s) => s.text)).toEqual(['前', '后']);
    expect(segs.every((s) => s.speaker === '我')).toBe(true);
  });

  it('? 不确定轮口径不动（照旧进仓落对方侧），并天然断段', () => {
    const segs = segmentRecordingTurns([
      turn({ start: 0, end: 3, speaker: '我', text: '前' }),
      turn({ start: 3, end: 6, speaker: '?', text: '分不清的一句' }),
      turn({ start: 6, end: 9, speaker: '我', text: '后' }),
    ]);
    expect(segs.map((s) => s.speaker)).toEqual(['我', '?', '我']);
  });

  it('情感：段内全一致才带，有一轮不同或缺 → 整段省略', () => {
    expect(segmentRecordingTurns([turn({ emotion: '平静', text: '甲' }), turn({ start: 1, end: 2, emotion: '平静', text: '乙' })])[0].emotion).toBe('平静');
    expect(segmentRecordingTurns([turn({ emotion: '平静', text: '甲' }), turn({ start: 1, end: 2, emotion: '开心', text: '乙' })])[0].emotion).toBeUndefined();
    expect(segmentRecordingTurns([turn({ emotion: '平静', text: '甲' }), turn({ start: 1, end: 2, text: '乙' })])[0].emotion).toBeUndefined();
  });

  it('首尾单轮 / 空输入', () => {
    expect(segmentRecordingTurns([])).toEqual([]);
    const one = segmentRecordingTurns([turn({ start: 7, end: 9, text: '独句' })]);
    expect(one).toEqual([{ start: 7, end: 9, speaker: '我', text: '独句' }]);
  });
});

describe('applyRecordingTurnsToMsgs 并仓', () => {
  it('每段一条 type=9001：key s<段序> / ts 取段首轮 / dur 取段跨度 / 文本段内直连', () => {
    const base = [msg({})];
    const { msgs, added } = applyRecordingTurnsToMsgs(base, {
      file: '周二.aac',
      ts: 1700000000000,
      turns: [
        turn({ start: 2.01, end: 4.18, speaker: '我', emotion: '平静', text: '哎开场白' }),
        turn({ start: 5, end: 8, speaker: '我', emotion: '平静', text: '再说一句' }),
        turn({ start: 13.95, end: 19.03, speaker: '大琳', text: '回应一句' }),
      ],
    });
    expect(added).toBe(2);
    expect(msgs).toHaveLength(3);
    const s1 = msgs.find((m) => m.key === 'rec:周二.aac:s0')!;
    expect(s1.type).toBe(9001);
    expect(s1.isSender).toBe(true);
    expect(s1.ts).toBe(1700000000000 + 2010); // 段首轮偏移
    expect(s1.dur).toBe(6); // 段跨度 8 − 2.01 ≈ 6
    expect(s1.text).toBe('[录音 6秒·平静] 哎开场白再说一句');
    const s2 = msgs.find((m) => m.key === 'rec:周二.aac:s1')!;
    expect(s2.isSender).toBe(false);
    expect(s2.ts).toBe(1700000000000 + 13950);
    expect(s2.text).toBe('[录音 5秒] 回应一句');
  });

  it('ts 升序重排：段落插进时间线对应位置', () => {
    const base = [msg({ key: 's9:900', ts: 1700000000000 + 60000 })];
    const { msgs } = applyRecordingTurnsToMsgs(base, {
      file: 'r.m4a',
      ts: 1700000000000,
      turns: [turn({ start: 120, end: 125, speaker: '我', text: '后置段' })],
    });
    expect(msgs.map((m) => m.key)).toEqual(['s9:900', 'rec:r.m4a:s0']);
  });

  it('空转写轮不进仓也不断段：整段只出这一条，段界仍是段首轮', () => {
    const { msgs, added } = applyRecordingTurnsToMsgs([], {
      file: 'r.m4a',
      ts: 1700000000000,
      turns: [turn({ text: '' }), turn({ text: '   ' }), turn({ start: 5, end: 9, text: '有声轮' })],
    });
    expect(added).toBe(1);
    expect(msgs.map((m) => m.key)).toEqual(['rec:r.m4a:s0']);
    expect(msgs[0].ts).toBe(1700000000000 + 5000);
  });

  it('同录音重跑幂等：清旧追加（段划分变了也不残留），removed 供 kindCounts 净增量', () => {
    const first = applyRecordingTurnsToMsgs([], {
      file: 'r.m4a',
      ts: 1700000000000,
      turns: [turn({ text: '旧划分一', speaker: '我' }), turn({ start: 10, end: 20, text: '旧划分二', speaker: '大琳' })],
    });
    expect(first.added).toBe(2);
    expect(first.removed).toBe(0);
    const second = applyRecordingTurnsToMsgs(first.msgs, {
      file: 'r.m4a',
      ts: 1700000000000,
      turns: [turn({ start: 0, end: 25, speaker: '大琳', text: '新划分合并段' })],
    });
    expect(second.added).toBe(1);
    expect(second.removed).toBe(2); // 净增量 1 - 2 = -1：重并不翻倍
    expect(second.msgs.map((m) => m.key)).toEqual(['rec:r.m4a:s0']);
    expect(second.msgs[0].text).toBe('[录音 25秒] 新划分合并段');
    expect(second.msgs[0].isSender).toBe(false);
  });

  it('不同录音互不干扰：file 是隔离键', () => {
    const a = applyRecordingTurnsToMsgs([], { file: 'a.m4a', ts: 1000, turns: [turn({ text: '甲录音' })] });
    const b = applyRecordingTurnsToMsgs(a.msgs, { file: 'b.m4a', ts: 2000, turns: [turn({ text: '乙录音' })] });
    expect(b.msgs.map((m) => m.key)).toEqual(['rec:a.m4a:s0', 'rec:b.m4a:s0']);
    // 重跑 a 不动 b
    const a2 = applyRecordingTurnsToMsgs(b.msgs, { file: 'a.m4a', ts: 1000, turns: [turn({ text: '甲重跑' })] });
    expect(a2.msgs.map((m) => m.key)).toEqual(['rec:a.m4a:s0', 'rec:b.m4a:s0']);
  });

  it('降级归属：? / 说话人0 都按对方侧', () => {
    const { msgs } = applyRecordingTurnsToMsgs([], {
      file: 'r.m4a',
      ts: 1000,
      turns: [turn({ speaker: '?', text: '不确定轮' }), turn({ speaker: '说话人0', text: '无名轮' })],
    });
    expect(msgs.every((m) => !m.isSender)).toBe(true);
  });

  it('旁音轮不进仓（时间线里看不见它，但前后同人段被它断开）', () => {
    const { msgs, added } = applyRecordingTurnsToMsgs([], {
      file: 'r.m4a',
      ts: 1000,
      turns: [
        turn({ start: 0, end: 3, speaker: '我', text: '前' }),
        turn({ start: 3, end: 6, speaker: '其他', text: '电视声' }),
        turn({ start: 6, end: 9, speaker: '我', text: '后' }),
      ],
    });
    expect(added).toBe(2);
    expect(msgs.map((m) => m.key)).toEqual(['rec:r.m4a:s0', 'rec:r.m4a:s1']);
    expect(msgs.some((m) => m.text.includes('电视声'))).toBe(false);
  });

  it('非法入参兜底：空 file / 非法 ts 不产条目不炸', () => {
    expect(applyRecordingTurnsToMsgs([msg({})], { file: '', ts: 1000, turns: [turn({})] }).added).toBe(0);
    const bad = applyRecordingTurnsToMsgs([], { file: 'r.m4a', ts: NaN, turns: [turn({ start: NaN, end: NaN, text: '兜底轮' })] });
    expect(bad.added).toBe(1);
    expect(bad.msgs[0].ts).toBe(0); // NaN → base 0（起点纪元）
    expect(bad.msgs[0].dur).toBe(1); // 时长下限 1 秒
  });
});

describe('buildRecordingText 与统计', () => {
  it('标签形态：带 / 不带情感；空文本只剩头', () => {
    expect(buildRecordingText({ durSec: 182, emotion: '平静', text: '内容' })).toBe('[录音 3分02秒·平静] 内容');
    expect(buildRecordingText({ durSec: 45, text: '内容' })).toBe('[录音 45秒] 内容');
    expect(buildRecordingText({ durSec: 45, emotion: '  ', text: '内容' })).toBe('[录音 45秒] 内容');
  });

  it('storeStatsOf：录音按**段**计（recordingCount = 段数，总时长 = 段跨度之和）', () => {
    const { msgs } = applyRecordingTurnsToMsgs(
      [msg({})],
      {
        file: 'r.m4a',
        ts: 1000,
        turns: [
          turn({ start: 0, end: 182, emotion: '平静', text: '段一前半' }),
          turn({ start: 182, end: 200, emotion: '平静', text: '段一后半' }), // 同人连续 → 并入段一
          turn({ start: 200, end: 230, speaker: '大琳', text: '段二' }),
        ],
      },
    );
    const stats = storeStatsOf(msgs);
    expect(stats.recordingCount).toBe(2); // 两段（不是三轮）
    expect(stats.recordingTotalSec).toBe(230); // 段跨度 200 + 30
    expect(stats.msgCount).toBe(3);
  });
});

describe('recordingTurnSegments 段界单源（ADR-0220 §7；turns.md 与「查看轮次」共用）', () => {
  /**
   * 最强的一条：与 `segmentRecordingTurns` **同构**——段首轮的个数 = 段数，段序 1..N 连续无洞，
   * 且第 n 段的段首轮 start 与 segmentRecordingTurns 第 n 段的 start 一致。
   * 两处判据只要有一处漂移（比如谁忘了「空轮不断段」），这条就会红。
   */
  const mirror = (turns: RecordingTurn[]): void => {
    const marks = recordingTurnSegments(turns);
    const segs = segmentRecordingTurns(turns);
    expect(marks).toHaveLength(turns.length);
    const heads = marks.filter((m) => m.head);
    expect(heads.map((h) => h.seg)).toEqual(segs.map((_, i) => i + 1)); // 1..N 连续
    expect(segs).toHaveLength(heads.length); // 段数 = 段首轮数
    heads.forEach((h, i) => {
      const at = marks.indexOf(h);
      expect(Number(turns[at].start)).toBe(segs[i].start); // 段首轮 = 该段 start
    });
  };

  it('同人连续：只有首轮是段首，其余是段内后续（段序不变）', () => {
    const turns = [
      turn({ start: 0, end: 5, text: '早' }),
      turn({ start: 5, end: 9, text: '吃了没' }),
      turn({ start: 600, end: 605, text: '隔十分钟又一句' }),
    ];
    expect(recordingTurnSegments(turns)).toEqual([
      { seg: 1, head: true },
      { seg: 1, head: false },
      { seg: 1, head: false },
    ]);
    mirror(turns);
  });

  it('说话人交替：各起一段，段序递增', () => {
    const turns = [
      turn({ start: 0, end: 5, text: '我说话' }),
      turn({ start: 5, end: 9, speaker: '大琳', text: '她说话' }),
      turn({ start: 9, end: 12, text: '我又说' }),
    ];
    expect(recordingTurnSegments(turns)).toEqual([
      { seg: 1, head: true },
      { seg: 2, head: true },
      { seg: 3, head: true },
    ]);
    mirror(turns);
  });

  it('空转写轮：自己不成段（seg 0），但**透明**——不断段，前后同人仍属同一段', () => {
    const turns = [
      turn({ start: 0, end: 5, text: '前半句' }),
      turn({ start: 5, end: 7, text: '   ' }), // 静音 / 转写失败
      turn({ start: 7, end: 9, text: '后半句' }),
    ];
    expect(recordingTurnSegments(turns)).toEqual([
      { seg: 1, head: true },
      { seg: 0, head: false },
      { seg: 1, head: false },
    ]);
    mirror(turns);
  });

  it('旁音轮：自己不成段，且**断开**前后同人（后一句另起新段）', () => {
    const turns = [
      turn({ start: 0, end: 5, text: '我先说' }),
      turn({ start: 5, end: 9, speaker: '其他', text: '电视里的人声' }),
      turn({ start: 9, end: 12, text: '我接着说' }),
    ];
    expect(recordingTurnSegments(turns)).toEqual([
      { seg: 1, head: true },
      { seg: 0, head: false },
      { seg: 2, head: true },
    ]);
    mirror(turns);
  });

  it('? 不确定轮：口径不动——照旧进仓（落对方侧），因此**自成一段**', () => {
    const turns = [
      turn({ start: 0, end: 5, text: '我说话' }),
      turn({ start: 5, end: 9, speaker: '?', text: '分不清是谁' }),
      turn({ start: 9, end: 12, text: '我再说' }),
    ];
    expect(recordingTurnSegments(turns)).toEqual([
      { seg: 1, head: true },
      { seg: 2, head: true },
      { seg: 3, head: true },
    ]);
    mirror(turns);
  });

  it('归属缺失（空 speaker）按旁音同口径：不成段、断段', () => {
    const turns = [
      turn({ start: 0, end: 5, text: '我先说' }),
      turn({ start: 5, end: 9, speaker: '  ', text: '无归属' }),
      turn({ start: 9, end: 12, text: '我接着说' }),
    ];
    expect(recordingTurnSegments(turns).map((m) => m.seg)).toEqual([1, 0, 2]);
    mirror(turns);
  });

  it('空输入 / 全空轮：不崩、不出段', () => {
    expect(recordingTurnSegments([])).toEqual([]);
    const blanks = [turn({ text: '' }), turn({ text: '   ' })];
    expect(recordingTurnSegments(blanks).every((m) => m.seg === 0 && !m.head)).toBe(true);
    mirror(blanks);
  });

  it('混合长序列：段界与并仓段严格对齐（含旁音 + 空轮 + ? 交错）', () => {
    const turns = [
      turn({ start: 0, end: 4, text: 'A1' }),
      turn({ start: 4, end: 8, text: 'A2' }),
      turn({ start: 8, end: 10, speaker: '其他', text: '旁音' }),
      turn({ start: 10, end: 12, text: '   ' }), // 空轮：透明
      turn({ start: 12, end: 16, text: 'A3' }), // 与 A1/A2 同人，但被旁音断过 → 新段
      turn({ start: 16, end: 20, speaker: '大琳', text: 'B1' }),
      turn({ start: 20, end: 24, speaker: '大琳', text: 'B2' }),
      turn({ start: 24, end: 28, speaker: '?', text: 'U1' }),
      turn({ start: 28, end: 31, speaker: '大琳', text: 'B3' }), // 被 ? 断 → 新段
    ];
    expect(recordingTurnSegments(turns)).toEqual([
      { seg: 1, head: true },
      { seg: 1, head: false },
      { seg: 0, head: false },
      { seg: 0, head: false },
      { seg: 2, head: true },
      { seg: 3, head: true },
      { seg: 3, head: false },
      { seg: 4, head: true },
      { seg: 5, head: true },
    ]);
    mirror(turns);
  });
});
