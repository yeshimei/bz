// @vitest-environment node
/**
 * 互动统计测试（issue 440）：computeStats 纯函数（月度聚合 / 会话切分 / 回复时延 / 小时分布 /
 * kindCounts 透传）+ parse 层形态归一（中文 typeName / 数字 typeNum / 文本标签三来源）+ 展示格式化。
 * （纯数据层，无 DOM）
 */
import { describe, it, expect } from 'vitest';
import { computeStats, formatCount, formatReplySec } from '../../src/people/stats';
import { normalizeKind, parseWechatExport } from '../../src/people/parse';
import type { UnifiedMessage } from '../../src/people/types';

const MIN = 60 * 1000;
/** 本地时间造点：2026-01-05 13:00 起步（月键 / 小时不受 CI 时区影响） */
const T0 = new Date(2026, 0, 5, 13, 0, 0).getTime();
const msg = (ts: number, isSender: boolean, text = '嗨'): UnifiedMessage => ({ ts, isSender, text });

describe('computeStats 基础边界', () => {
  it('空数组：全零 / 空月度 / 空小时分布', () => {
    const s = computeStats([], {});
    expect(s.monthly).toEqual([]);
    expect(s.initiatedByMe).toBe(0);
    expect(s.initiatedByOther).toBe(0);
    expect(s.myAvgReplySec).toBe(0);
    expect(s.otherAvgReplySec).toBe(0);
    expect(s.myHourly).toEqual(new Array(24).fill(0));
    expect(s.otherHourly).toEqual(new Array(24).fill(0));
  });

  it('单条消息（我发）：一个会话、一个月度、对应小时', () => {
    const s = computeStats([msg(T0, true)], { 文本: 1 });
    expect(s.monthly).toEqual([['2026-01', 1]]);
    expect(s.initiatedByMe).toBe(1);
    expect(s.initiatedByOther).toBe(0);
    expect(s.myAvgReplySec).toBe(0);
    expect(s.otherAvgReplySec).toBe(0);
    expect(s.myHourly[13]).toBe(1);
    expect(s.otherHourly.every((n) => n === 0)).toBe(true);
  });

  it('全我发：只算我发起一个会话，无回复样本', () => {
    const s = computeStats([msg(T0, true), msg(T0 + 3 * MIN, true), msg(T0 + 5 * MIN, true)], {});
    expect(s.initiatedByMe).toBe(1);
    expect(s.initiatedByOther).toBe(0);
    expect(s.myAvgReplySec).toBe(0);
    expect(s.otherAvgReplySec).toBe(0);
    expect(s.monthly).toEqual([['2026-01', 3]]);
  });

  it('全对方发：只算对方发起', () => {
    const s = computeStats([msg(T0, false), msg(T0 + MIN, false)], {});
    expect(s.initiatedByMe).toBe(0);
    expect(s.initiatedByOther).toBe(1);
    expect(s.myHourly.every((n) => n === 0)).toBe(true);
    expect(s.otherHourly[13]).toBe(2);
  });

  it('乱序输入按时间序处理（升序输出与切分不受传入顺序影响）', () => {
    const s = computeStats([msg(T0 + 2 * MIN, false), msg(T0, true)], {});
    expect(s.initiatedByMe).toBe(1);
    expect(s.initiatedByOther).toBe(0);
  });
});

describe('computeStats 月度聚合与会话切分', () => {
  it('跨月（含跨年）聚合：键 YYYY-MM 升序', () => {
    const dec = new Date(2025, 11, 31, 23, 59).getTime();
    const jan = new Date(2026, 0, 1, 0, 0).getTime();
    const mar = new Date(2026, 2, 15, 8, 0).getTime();
    const s = computeStats(
      [msg(mar, true), msg(jan, false), msg(dec, true), msg(jan + MIN, true)],
      {}
    );
    expect(s.monthly).toEqual([['2025-12', 1], ['2026-01', 2], ['2026-03', 1]]);
  });

  it('会话切分：29 分钟同一会话，31 分钟新会话，恰好 30 分钟算新会话', () => {
    // 29 分钟：同一会话
    const a = computeStats([msg(T0, true), msg(T0 + 29 * MIN, false)], {});
    expect(a.initiatedByMe).toBe(1);
    expect(a.initiatedByOther).toBe(0);
    // 31 分钟：对方开新会话
    const b = computeStats([msg(T0, true), msg(T0 + 31 * MIN, false)], {});
    expect(b.initiatedByMe).toBe(1);
    expect(b.initiatedByOther).toBe(1);
    // 恰好 30 分钟：≥ 阈值 → 新会话
    const c = computeStats([msg(T0, true), msg(T0 + 30 * MIN, true)], {});
    expect(c.initiatedByMe).toBe(2);
  });

  it('长对话多次切分分别归侧', () => {
    // 我开 → 40 分钟后对方开 → 10 分钟内我再回
    const s = computeStats(
      [msg(T0, true), msg(T0 + 40 * MIN, false), msg(T0 + 45 * MIN, true)],
      {}
    );
    expect(s.initiatedByMe).toBe(1);
    expect(s.initiatedByOther).toBe(1);
  });
});

describe('computeStats 回复时延', () => {
  it('对方→我（45 秒），我连发不计，我→对方（20 秒）', () => {
    const s = computeStats(
      [
        msg(T0, false),            // 对方问
        msg(T0 + 45_000, true),    // 我 45 秒后回（计我）
        msg(T0 + 50_000, true),    // 我连发第二条（不计）
        msg(T0 + 70_000, false),   // 对方回：距我上一条 20 秒（计对方）
      ],
      {}
    );
    expect(s.myAvgReplySec).toBe(45);
    expect(s.otherAvgReplySec).toBe(20);
  });

  it('多条样本取平均', () => {
    const s = computeStats(
      [
        msg(T0, false),
        msg(T0 + 30_000, true),        // 我 30 秒
        msg(T0 + 60_000, false),       // 对方 30 秒
        msg(T0 + 150_000, true),       // 我 90 秒
      ],
      {}
    );
    expect(s.myAvgReplySec).toBe(60); // (30 + 90) / 2
    expect(s.otherAvgReplySec).toBe(30);
  });
});

describe('computeStats 回复时延新口径（issue 449）', () => {
  it('会话首条不计：新会话首条即使是异侧切换也不当回复样本；中位数字段同步产出', () => {
    const s = computeStats(
      [
        msg(T0, false),            // 对方开首个会话
        msg(T0 + 45_000, true),    // 我 45 秒后回（计我）
        msg(T0 + 31 * MIN, false), // 31 分钟后对方开新会话：异侧切换但为首条，不计
      ],
      {}
    );
    expect(s.myAvgReplySec).toBe(45);
    expect(s.otherAvgReplySec).toBe(0);
    expect(s.myMedianReplySec).toBe(45);
    expect(s.otherMedianReplySec).toBe(0);
    expect(s.initiatedByMe).toBe(0);
    expect(s.initiatedByOther).toBe(2); // 首条 + 31 分钟后新会话均对方开
  });

  it('间隔超 3600 秒的异侧切换不计（30 分钟会话切分先行截断，封顶为双保险）；无样本中位数记 0', () => {
    const s = computeStats([msg(T0, false), msg(T0 + 31 * MIN, true)], {});
    expect(s.myAvgReplySec).toBe(0);
    expect(s.myMedianReplySec).toBe(0);
    expect(s.otherMedianReplySec).toBe(0);
    expect(s.initiatedByMe).toBe(1);
  });

  it('中位数：奇数样本取中位、偶数取中间两数均值；与均值并存（中位数抗离群）', () => {
    const s = computeStats(
      [
        msg(T0, false),
        msg(T0 + 10_000, true),    // 我 10
        msg(T0 + 30_000, false),   // 对方 20
        msg(T0 + 50_000, true),    // 我 20
        msg(T0 + 140_000, false),  // 对方 90
        msg(T0 + 160_000, true),   // 我 20
      ],
      {}
    );
    expect(s.myAvgReplySec).toBeCloseTo(50 / 3, 6); // (10+20+20)/3 被离群值拉偏前先看中位 20
    expect(s.myMedianReplySec).toBe(20);
    expect(s.otherAvgReplySec).toBe(55); // (20+90)/2
    expect(s.otherMedianReplySec).toBe(55);
  });
});

describe('computeStats kindCounts 透传', () => {
  it('原样透出且与源对象脱钩', () => {
    const src = { 文本: 2, 图片: 1 };
    const s = computeStats([], src);
    expect(s.kindCounts).toEqual({ 文本: 2, 图片: 1 });
    s.kindCounts['文本'] = 99;
    s.kindCounts['其他'] = 1;
    expect(src).toEqual({ 文本: 2, 图片: 1 });
  });
});

describe('computeStats 媒体素材计数（issue 445）', () => {
  it('语音条数 / 总时长 / 图片张数由消息文本算出；旧空标签与纯文本不计', () => {
    const s = computeStats(
      [
        msg(T0, false, '[语音 12s·平静] 一'),
        msg(T0 + MIN, true, '[语音 30s] 二'),
        msg(T0 + 2 * MIN, false, '[语音] 三'), // 裸标签带转写：计条数、时长不计
        msg(T0 + 3 * MIN, true, '[图片] 描述一'),
        msg(T0 + 4 * MIN, false, '[图片]'), // 旧空标签：不计
        msg(T0 + 5 * MIN, false, '普通文本'),
      ],
      { 文本: 2, 语音: 1, 图片: 2 }
    );
    expect(s.voiceCount).toBe(3);
    expect(s.voiceTotalSec).toBe(42);
    expect(s.imageCount).toBe(1);
  });

  it('无媒体消息：字段为 0（字段存在，供徽章判断）', () => {
    const s = computeStats([msg(T0, false)], {});
    expect(s.voiceCount).toBe(0);
    expect(s.voiceTotalSec).toBe(0);
    expect(s.imageCount).toBe(0);
  });
});

describe('parse 层形态计数（normalizeKind 三来源）', () => {
  it('CSV 中文 typeName：非文本被过滤但计入形态', () => {
    const csv = [
      'type_name,IsSender,CreateTime,msg',
      '文本,0,1700000000,在吗',
      '图片,0,1700000060,[图片]',
      '语音,1,1700000120,[语音 12秒]',
      '动画表情,0,1700000180,[表情]',
      '视频通话,1,1700000240,[通话时长 01:02]',
      '系统消息,0,1700000300,你撤回了一条消息',
      '引用消息,0,1700000360,[引用「早」] 晚了',
    ].join('\n');
    const g = parseWechatExport('x.csv', csv).contacts[0];
    expect(g.messages).toHaveLength(1); // 只有文本进提炼
    expect(g.skippedCount).toBe(6);
    expect(g.kindCounts).toEqual({ 文本: 1, 图片: 1, 语音: 1, 表情: 1, 通话: 1, 系统: 1, 引用: 1 });
  });

  it('JSON 数字 typeNum：1/3/34/43/47/50/10000 各归其位', () => {
    const json = JSON.stringify([
      { is_sender: 0, CreateTime: 1700000000, msg: '早', type: 1 },
      { is_sender: 0, CreateTime: 1700000010, msg: '[图片]', type: 3 },
      { is_sender: 0, CreateTime: 1700000020, msg: '[语音]', type: 34 },
      { is_sender: 0, CreateTime: 1700000030, msg: '[视频]', type: 43 },
      { is_sender: 0, CreateTime: 1700000040, msg: '[表情]', type: 47 },
      { is_sender: 0, CreateTime: 1700000050, msg: '[通话时长 00:31]', type: 50 },
      { is_sender: 0, CreateTime: 1700000060, msg: '对方撤回了一条消息', type: 10000 },
    ]);
    const g = parseWechatExport('x.json', json).contacts[0];
    expect(g.messages).toHaveLength(1);
    expect(g.kindCounts).toEqual({ 文本: 1, 图片: 1, 语音: 1, 视频: 1, 表情: 1, 通话: 1, 系统: 1 });
  });

  it('typeNum 49 按文本标签细分：引用 / 文件 / 分享', () => {
    expect(normalizeKind(undefined, '49', '[引用「好」] 收')).toBe('引用');
    expect(normalizeKind(undefined, '49', '[文件] 报告.pdf')).toBe('文件');
    expect(normalizeKind(undefined, '49', '[分享] 一篇文章')).toBe('分享');
  });

  it('无类型列时按导出文本标签嗅探（全部作为文本收集，形态照记）', () => {
    const csv = [
      'IsSender,CreateTime,StrContent',
      '0,1700000000,普通打字的话',
      '0,1700000060,[图片]',
      '1,1700000120,[语音 12秒]',
      '0,1700000180,[通话时长 03:00]',
      '0,1700000240,[文件] 合同.docx',
      '0,1700000300,[分享] 链接',
      '0,1700000360,[撤回了一条消息]',
    ].join('\n');
    const g = parseWechatExport('x.csv', csv).contacts[0];
    expect(g.messages).toHaveLength(7); // 无类型列 → 全按文本收集
    expect(g.kindCounts).toEqual({
      文本: 1, 图片: 1, 语音: 1, 通话: 1, 文件: 1, 分享: 1, 系统: 1,
    });
  });

  it('未知形态归「其他」；多人导出各归各组', () => {
    expect(normalizeKind('名片', undefined, '[名片] 张三')).toBe('其他');
    const csv = [
      'Type,TypeName,TalkerId,IsSender,CreateTime,StrContent',
      '1,文本,wxid_a,0,1700000000,A1',
      '3,图片,wxid_b,0,1700000010,[图片]',
    ].join('\n');
    const out = parseWechatExport('b.csv', csv);
    expect(out.contacts[0].kindCounts).toEqual({ 文本: 1 });
    expect(out.contacts[1].kindCounts).toEqual({ 图片: 1 });
  });
});

describe('展示格式化', () => {
  it('formatReplySec：秒 / 分 / 小时自适应，无样本显示「无样本」', () => {
    expect(formatReplySec(45)).toBe('45 秒');
    expect(formatReplySec(59)).toBe('59 秒');
    expect(formatReplySec(60)).toBe('1 分钟');
    expect(formatReplySec(720)).toBe('12 分钟');
    expect(formatReplySec(3600)).toBe('1 小时');
    expect(formatReplySec(10800)).toBe('3 小时');
    expect(formatReplySec(0)).toBe('无样本');
    expect(formatReplySec(-3)).toBe('无样本');
  });

  it('formatCount：千位 k 缩写', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1000)).toBe('1k');
    expect(formatCount(1234)).toBe('1.2k');
    expect(formatCount(12345)).toBe('12.3k');
    expect(formatCount(123456)).toBe('123k');
  });
});
