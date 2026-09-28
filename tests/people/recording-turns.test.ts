/**
 * 录音轮次并仓测试（issue 509 / ADR-0212、0213）：applyRecordingTurnsToMsgs 的轮次合成
 * （type=9001、key 前缀、ts 偏移、归属、空轮跳过）、同录音重跑幂等、多录音互不干扰、
 * buildRecordingText 标签形态、storeStatsOf 录音聚合。纯数据层，无 DOM。
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  applyRecordingTurnsToMsgs,
  buildRecordingText,
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

describe('applyRecordingTurnsToMsgs 并仓', () => {
  it('每轮一条 type=9001：key / ts 偏移 / 归属 / 文本标签', () => {
    const base = [msg({})];
    const { msgs, added } = applyRecordingTurnsToMsgs(base, {
      file: '周二.aac',
      ts: 1700000000000,
      turns: [
        turn({ start: 2.01, end: 4.18, speaker: '我', emotion: '平静', text: '哎开场白' }),
        turn({ start: 13.95, end: 19.03, speaker: '大琳', text: '回应一句' }),
      ],
    });
    expect(added).toBe(2);
    expect(msgs).toHaveLength(3);
    const t1 = msgs.find((m) => m.key === 'rec:周二.aac:0')!;
    expect(t1.type).toBe(9001);
    expect(t1.isSender).toBe(true);
    expect(t1.ts).toBe(1700000000000 + 2010);
    expect(t1.dur).toBe(2);
    expect(t1.text).toBe('[录音 2秒·平静] 哎开场白');
    const t2 = msgs.find((m) => m.key === 'rec:周二.aac:1')!;
    expect(t2.isSender).toBe(false);
    expect(t2.ts).toBe(1700000000000 + 13950);
    expect(t2.text).toBe('[录音 5秒] 回应一句');
  });

  it('ts 升序重排：轮次插进时间线对应位置', () => {
    const base = [msg({ key: 's9:900', ts: 1700000000000 + 60000 })];
    const { msgs } = applyRecordingTurnsToMsgs(base, {
      file: 'r.m4a',
      ts: 1700000000000,
      turns: [turn({ start: 120, end: 125, speaker: '我', text: '后置轮' })],
    });
    expect(msgs.map((m) => m.key)).toEqual(['s9:900', 'rec:r.m4a:0']);
  });

  it('空转写轮跳过（静音 / 转写失败不进时间线）', () => {
    const { msgs, added } = applyRecordingTurnsToMsgs([], {
      file: 'r.m4a',
      ts: 1700000000000,
      turns: [turn({ text: '' }), turn({ text: '   ' }), turn({ start: 5, end: 9, text: '有声轮' })],
    });
    expect(added).toBe(1);
    expect(msgs.map((m) => m.key)).toEqual(['rec:r.m4a:2']);
  });

  it('同录音重跑幂等：清旧追加（轮次划分变了也不残留），removed 供 kindCounts 净增量', () => {
    const first = applyRecordingTurnsToMsgs([], {
      file: 'r.m4a',
      ts: 1700000000000,
      turns: [turn({ text: '旧划分一' }), turn({ start: 10, end: 20, text: '旧划分二' })],
    });
    expect(first.added).toBe(2);
    expect(first.removed).toBe(0);
    const second = applyRecordingTurnsToMsgs(first.msgs, {
      file: 'r.m4a',
      ts: 1700000000000,
      turns: [turn({ start: 0, end: 25, speaker: '大琳', text: '新划分合并轮' })],
    });
    expect(second.added).toBe(1);
    expect(second.removed).toBe(2); // 净增量 1 - 2 = -1：重并不翻倍
    expect(second.msgs.map((m) => m.key)).toEqual(['rec:r.m4a:0']);
    expect(second.msgs[0].text).toBe('[录音 25秒] 新划分合并轮');
    expect(second.msgs[0].isSender).toBe(false);
  });

  it('不同录音互不干扰：file 是隔离键', () => {
    const a = applyRecordingTurnsToMsgs([], { file: 'a.m4a', ts: 1000, turns: [turn({ text: '甲录音' })] });
    const b = applyRecordingTurnsToMsgs(a.msgs, { file: 'b.m4a', ts: 2000, turns: [turn({ text: '乙录音' })] });
    expect(b.msgs.map((m) => m.key)).toEqual(['rec:a.m4a:0', 'rec:b.m4a:0']);
    // 重跑 a 不动 b
    const a2 = applyRecordingTurnsToMsgs(b.msgs, { file: 'a.m4a', ts: 1000, turns: [turn({ text: '甲重跑' })] });
    expect(a2.msgs.map((m) => m.key)).toEqual(['rec:a.m4a:0', 'rec:b.m4a:0']);
  });

  it('降级归属：? / 说话人0 都按对方侧', () => {
    const { msgs } = applyRecordingTurnsToMsgs([], {
      file: 'r.m4a',
      ts: 1000,
      turns: [turn({ speaker: '?', text: '不确定轮' }), turn({ speaker: '说话人0', text: '无名轮' })],
    });
    expect(msgs.every((m) => !m.isSender)).toBe(true);
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

  it('storeStatsOf：录音轮次计入 recordingCount / recordingTotalSec', () => {
    const { msgs } = applyRecordingTurnsToMsgs(
      [msg({})],
      {
        file: 'r.m4a',
        ts: 1000,
        turns: [turn({ start: 0, end: 182, emotion: '平静', text: '轮一' }), turn({ start: 200, end: 230, text: '轮二' })],
      },
    );
    const stats = storeStatsOf(msgs);
    expect(stats.recordingCount).toBe(2);
    expect(stats.recordingTotalSec).toBe(212);
    expect(stats.msgCount).toBe(3);
  });
});
