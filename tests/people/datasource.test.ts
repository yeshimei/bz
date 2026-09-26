/**
 * 脸谱聊天仓测试（issue 446/449；聊天仓 v2 = issue 466 / ADR-0197）：替代键（sid / ct+msg 哈希）、
 * chat.json 归一化矩阵（**全量入仓** + 派生 text 空串语义 / 语音转写回退 / 图片描述命中与缺失 /
 * 视频与系统消息开关 / 群聊判定 / 原始字段保留）、聊天仓合并（首导 / 部分新增 / **同键 upsert 覆盖** /
 * 完全重复 / stats 重算）、MessageStore 落盘结构与 v1 判废（MockVault）。
 * 隐私口径：全部构造数据，不含真实聊天内容。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MessageStore,
  emptyMessageStore,
  isGroupChat,
  mergeStore,
  msgKey,
  normalizeChatJson,
  storeStatsOf,
  storeToUnified,
  type ImageDescItem,
  type NormalizeOptions,
  type RawChatMsg,
  type StoreContact,
  type VoiceItem,
} from '../../src/people/datasource';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const BASE = 1700000000; // 秒级 ct（构造值）

const opts = (over: Partial<NormalizeOptions> = {}): NormalizeOptions => ({
  previewVoice: true,
  imageDescMode: 'file',
  previewVideo: true,
  keepSystem: true,
  ...over,
});

/** 构造一条原始消息（类型/who/msg/sid/dur/wav 可调） */
const raw = (over: Partial<RawChatMsg> & { ct: number }): RawChatMsg => ({
  type: 1,
  who: '对方',
  msg: '构造消息',
  ...over,
});

describe('msgKey 替代键', () => {
  it('有效 sid：s<sid>:<ct> 形态（type=34 等 server_id 消息）', () => {
    expect(msgKey({ ct: 100, type: 34, sid: 1234567890123 })).toBe('s1234567890123:100');
  });
  it('sid=0 / 缺失：ct+msg 哈希替代键', () => {
    const k1 = msgKey({ ct: 100, type: 1, msg: '甲', sid: 0 });
    const k2 = msgKey({ ct: 100, type: 1, msg: '甲' });
    expect(k1).toBe(k2); // 同 ct 同 msg → 同键（重复判定生效）
    expect(k1.startsWith('h')).toBe(true);
    expect(msgKey({ ct: 100, type: 1, msg: '乙', sid: 0 })).not.toBe(k1); // 不同 msg 不同键
    expect(msgKey({ ct: 200, type: 1, msg: '甲', sid: 0 })).not.toBe(k1); // 不同 ct 不同键
  });
  it('同一消息两次求键幂等（增量判重的前提）', () => {
    const m: RawChatMsg = { ct: BASE, type: 34, sid: 9876543210987, msg: '[语音 12秒] 测试' };
    expect(msgKey(m)).toBe(msgKey({ ...m }));
  });
});

describe('normalizeChatJson 归一化矩阵（466 全量入仓）', () => {
  it('文本消息：原样进仓，ts 秒转毫秒，who=「我」判 isSender，原始码随条落盘', () => {
    const r = normalizeChatJson(
      [raw({ ct: BASE, msg: '你好' }), raw({ ct: BASE + 1, who: '我', msg: '在的' })],
      opts()
    );
    expect(r.msgs).toHaveLength(2);
    expect(r.msgs[0]).toMatchObject({ ts: BASE * 1000, isSender: false, text: '你好', type: 1, who: '对方' });
    expect(r.msgs[1]).toMatchObject({ ts: (BASE + 1) * 1000, isSender: true, text: '在的' });
    expect(r.skippedCount).toBe(0);
  });

  it('语音已回填转写：msg 原样保留（445 导出契约形态），dur / wav 原始字段随条落盘', () => {
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 34, msg: '[语音 14秒·平静] 构造转写内容', sid: 11, dur: 14, wav: 't/voice/a.wav' })],
      opts()
    );
    expect(r.msgs[0].text).toBe('[语音 14秒·平静] 构造转写内容');
    expect(r.msgs[0]).toMatchObject({ type: 34, sid: 11, dur: 14, wav: 't/voice/a.wav' });
  });

  it('语音无转写：msg 无正文时查 voice.json（wav 关联）回填；英文情感标签转中文', () => {
    const voice: VoiceItem[] = [
      { wav: 'talker/voice/20240101_120000_77.wav', dur: 5, text: '构造语音文本', emotion: 'HAPPY' },
      { wav: 'talker/voice/20240101_130000_88.wav', dur: 3, text: '构造第二条', emotion: 'NEUTRAL' },
    ];
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 34, msg: '[语音 12秒]', sid: 21, wav: '20240101_110000_66.wav', dur: 12 }), // 表里没有 → text 空只计数
        raw({ ct: BASE + 1, type: 34, msg: '[语音 8秒]', sid: 22, wav: '20240101_120000_77.wav', dur: 8 }), // 消息裸文件名 → 表全路径（尾段键兜底）
        raw({ ct: BASE + 2, type: 34, msg: '[语音 3秒]', sid: 23, wav: 'talker/voice/20240101_130000_88.wav', dur: 3 }), // 全路径直配
      ],
      opts(),
      { voice }
    );
    expect(r.msgs.map((m) => m.text)).toEqual(['', '[语音 8秒·开心] 构造语音文本', '[语音 3秒·平静] 构造第二条']);
    expect(r.kindCounts['语音']).toBe(3);
    expect(r.skippedCount).toBe(0); // 全量入仓：不再算「跳过」
    expect(r.insights.voiceEmotion).toEqual({ 开心: 1, 平静: 1 }); // 只数进时间线的
  });

  it('语音无转写且无兜底：条目仍全量入仓（text 空 = 不进时间线），不进素材统计（466 取代 449「丢出消息流」）', () => {
    const r = normalizeChatJson([raw({ ct: BASE, type: 34, msg: '[语音 12秒]', sid: 25, dur: 12 })], opts());
    expect(r.msgs).toHaveLength(1);
    expect(r.msgs[0]).toMatchObject({ type: 34, sid: 25, dur: 12, text: '' });
    expect(r.kindCounts['语音']).toBe(1);
    expect(r.skippedCount).toBe(0);
    expect(r.stats.msgCount).toBe(0); // 统计口径 = 时间线（text 非空），与改前一致
  });

  it('previewVoice=false：语音条目入仓但 text 空，只计数', () => {
    const r = normalizeChatJson([raw({ ct: BASE, type: 34, msg: '[语音 14秒] 构造', sid: 31 })], opts({ previewVoice: false }));
    expect(r.msgs).toHaveLength(1);
    expect(r.msgs[0].text).toBe('');
    expect(r.kindCounts['语音']).toBe(1);
    expect(r.stats.msgCount).toBe(0);
  });

  it('图片描述：img 字段有值按 file 精确命中（预处理线权威路径），img 字段随条落盘', () => {
    const descs: ImageDescItem[] = [
      { file: `${MONTH}/a.jpg`, ct: ctOf('2026-03-04'), desc: '构造描述甲' },
      { file: `${MONTH}/b.jpg`, ct: ctOf('2026-03-20'), desc: '构造描述乙' },
    ];
    const r = normalizeChatJson(
      [
        raw({ ct: ctOf('2026-03-20'), type: 3, msg: '[图片]', sid: 41, img: `${MONTH}/b.jpg` }),
        raw({ ct: ctOf('2026-03-05'), type: 3, msg: '[图片]', sid: 42, img: `${MONTH}/a.jpg` }),
      ],
      opts(),
      { imageDesc: descs }
    );
    // ts 升序后：05 日消息配 a、20 日消息配 b（精确匹配不靠顺序）
    expect(r.msgs.map((m) => m.text)).toEqual(['[图片] 构造描述甲', '[图片] 构造描述乙']);
    expect(r.msgs.map((m) => m.img)).toEqual([`${MONTH}/a.jpg`, `${MONTH}/b.jpg`]);
  });

  it('图片描述：img 缺失走同月 ct 最近邻（±12h 内命中；一张描述只配一条消息）', () => {
    const descs: ImageDescItem[] = [{ file: `${MONTH}/a.jpg`, ct: ctOf('2026-03-05T10:30:00'), desc: '构造描述' }];
    const r = normalizeChatJson(
      [
        raw({ ct: ctOf('2026-03-05T10:00:00'), type: 3, msg: '[图片]', sid: 51 }), // 距 30 分钟 → 命中
        raw({ ct: ctOf('2026-03-05T10:10:00'), type: 3, msg: '[图片]', sid: 52 }), // 更近但描述已被消费 → text 空
      ],
      opts(),
      { imageDesc: descs }
    );
    expect(r.msgs.map((m) => m.text)).toEqual(['[图片] 构造描述', '']);
    expect(r.kindCounts['图片']).toBe(2);
    expect(r.skippedCount).toBe(0);
  });

  it('图片描述缺失回退：无表 / 超 12h / 跨月 / img 对不上表 → 条目入仓 text 空（449 删空标签 → 466 入仓不进时间线）', () => {
    const descs: ImageDescItem[] = [{ file: `${MONTH}/a.jpg`, ct: ctOf('2026-03-05T08:00:00'), desc: '构造描述' }];
    const r = normalizeChatJson(
      [
        raw({ ct: ctOf('2026-04-01T08:00:00'), type: 3, msg: '[图片]', sid: 61 }), // 跨月：月桶不命中（最近邻不做跨月）
        raw({ ct: ctOf('2026-03-06T20:00:00'), type: 3, msg: '[图片]', sid: 62 }), // 距 36h > 12h → 不命中
        raw({ ct: ctOf('2026-03-05T09:00:00'), type: 3, msg: '[图片]', sid: 63, img: `${MONTH}/missing.jpg` }), // img 有值但表里没有：权威 miss 即 miss，不落最近邻
      ],
      opts(),
      { imageDesc: descs }
    );
    expect(r.msgs).toHaveLength(3);
    expect(r.msgs.every((m) => m.text === '')).toBe(true);
    expect(r.kindCounts['图片']).toBe(3);
    expect(r.stats.imageCount).toBe(0);
  });

  it('imageDescMode=off：无描述图片条目入仓 text 空（449 摘除 ai 假开关）', () => {
    const raws = [raw({ ct: BASE, type: 3, msg: '[图片]', sid: 61 })];
    const descs: ImageDescItem[] = [{ file: `${MONTH}/a.jpg`, ct: BASE, desc: '构造描述' }];
    const r = normalizeChatJson(raws, opts({ imageDescMode: 'off' }), { imageDesc: descs });
    expect(r.msgs).toHaveLength(1);
    expect(r.msgs[0].text).toBe('');
    expect(r.kindCounts['图片']).toBe(1);
  });

  it('previewVideo=false：视频入仓 text 空；开则 [视频 N秒] 标签进时间线；无时长 text 空', () => {
    const v = raw({ ct: BASE, type: 43, msg: '', sid: 71, dur: 61 });
    expect(normalizeChatJson([v], opts({ previewVideo: false })).msgs[0].text).toBe('');
    const r = normalizeChatJson([v], opts());
    expect(r.msgs[0].text).toBe('[视频 61秒]');
    expect(normalizeChatJson([{ ...v, dur: undefined }], opts()).msgs[0].text).toBe(''); // 空标签无信息
  });

  it('keepSystem 开关：type=10000 系统消息条目恒入仓，开关只决定 text 是否进时间线，形态计数恒记', () => {
    const sys = raw({ ct: BASE, type: 10000, msg: '"对方" 撤回了一条消息', sid: 81 });
    const on = normalizeChatJson([sys], opts());
    expect(on.msgs).toHaveLength(1);
    expect(on.msgs[0].text).toBe('"对方" 撤回了一条消息');
    expect(on.kindCounts['系统']).toBe(1);
    const off = normalizeChatJson([sys], opts({ keepSystem: false }));
    expect(off.msgs).toHaveLength(1);
    expect(off.msgs[0].text).toBe('');
    expect(off.kindCounts['系统']).toBe(1);
  });

  it('type=47 表情：条目恒入仓；纯 [表情] text 空只计数；[表情·名] 进时间线并计命名数', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 47, msg: '[表情]', sid: 91 }),
        raw({ ct: BASE + 1, type: 47, msg: '[表情·笑哭]', sid: 92 }),
      ],
      opts()
    );
    expect(r.msgs.map((m) => m.text)).toEqual(['', '[表情·笑哭]']);
    expect(r.kindCounts['表情']).toBe(2); // 全量形态计数不受分流影响
    expect(r.insights.emojiCount).toBe(2);
    expect(r.insights.emojiNamedCount).toBe(1);
  });

  it('type=49 分享 / 小程序：进时间线并截断至 ≤80 字，计 shareCount', () => {
    const longTitle = `[分享] ${'构'.repeat(90)}`;
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 49, msg: longTitle, sid: 93 }),
        raw({ ct: BASE + 1, type: 49, msg: '[小程序] 构造小程序', sid: 94 }),
      ],
      opts()
    );
    expect(r.msgs[0].text).toBe(`[分享] ${'构'.repeat(74)}…`); // 截断补 …，总长 80
    expect(r.msgs[0].text.length).toBe(80);
    expect(r.msgs[1].text).toBe('[小程序] 构造小程序');
    expect(r.insights.shareCount).toBe(2);
  });

  it('type=49 文件：原样进时间线；引用：短引用原样保留', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 49, msg: '[文件] 构造报告.pdf', sid: 95 }),
        raw({ ct: BASE + 1, type: 49, msg: '[引用「早」] 晚了', sid: 96 }),
      ],
      opts()
    );
    expect(r.msgs.map((m) => m.text)).toEqual(['[文件] 构造报告.pdf', '[引用「早」] 晚了']);
    expect(r.insights.shareCount).toBe(0); // 文件 / 引用不计分享
  });

  it('type=49 引用头超 60 字：截断补 …」；回复部分原样保留', () => {
    const quote = '长'.repeat(70);
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 49, msg: `[引用「${quote}」] 构造回复`, sid: 97 })],
      opts()
    );
    expect(r.msgs[0].text).toBe(`[引用「${'长'.repeat(60)}…」] 构造回复`);
  });

  it('type=50 通话：时长换轻标签（时 / 分 / 秒三档），中断同款换算，callTotalSec 累计', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 50, msg: '[通话时长 01:02:03]', sid: 98 }),
        raw({ ct: BASE + 1, type: 50, msg: '[通话时长 05:20]', sid: 99 }),
        raw({ ct: BASE + 2, type: 50, msg: '[通话中断 00:00:59]', sid: 100 }),
      ],
      opts()
    );
    expect(r.msgs.map((m) => m.text)).toEqual(['[通话 1时2分]', '[通话 5分20秒]', '[通话中断 59秒]']);
    expect(r.insights.callCount).toBe(3);
    expect(r.insights.callTotalSec).toBe(3723 + 320 + 59);
    expect(r.insights.callMissedCount).toBe(0);
  });

  it('type=50 未接通：换 [未接通·原因原文]，计 callMissedCount；callCount 含未接通', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 50, msg: '[对方已拒绝]', sid: 101 }),
        raw({ ct: BASE + 1, type: 50, msg: '[对方忙线中]', sid: 102 }),
        raw({ ct: BASE + 2, type: 50, msg: '[已取消]', sid: 103 }),
      ],
      opts()
    );
    expect(r.msgs.map((m) => m.text)).toEqual(['[未接通·对方已拒绝]', '[未接通·对方忙线中]', '[未接通·已取消]']);
    expect(r.insights.callCount).toBe(3);
    expect(r.insights.callMissedCount).toBe(3);
    expect(r.insights.callTotalSec).toBe(0);
  });

  it('type=50 在其它设备接听：已接通（别处），不算未接通，原样进时间线', () => {
    const r = normalizeChatJson([raw({ ct: BASE, type: 50, msg: '[已在其它设备接听]', sid: 107 })], opts());
    expect(r.msgs.map((m) => m.text)).toEqual(['[已在其它设备接听]']);
    expect(r.insights.callCount).toBe(1);
    expect(r.insights.callMissedCount).toBe(0);
    expect(r.insights.callTotalSec).toBe(0);
  });

  it('type=1 且 msg 以媒体标签开头：按 445 parseMediaTag 走媒体素材（stats 计数）', () => {
    const r = normalizeChatJson(
      [raw({ ct: BASE, msg: '[语音 12s·平静] 构造转写' }), raw({ ct: BASE + 1, msg: '[图片] 构造描述' })],
      opts()
    );
    expect(r.stats).toMatchObject({ msgCount: 2, voiceCount: 1, voiceTotalSec: 12, imageCount: 1 });
  });

  it('stats 重算口径（时间线 = text 非空）：合成标签的语音带时长计入 voiceTotalSec；无转写语音与无描述图片不进', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 34, msg: '[语音 8秒·开心] 构造', sid: 101 }),
        raw({ ct: BASE + 1, type: 34, msg: '[语音 5秒]', sid: 102 }), // 无转写：text 空，不进素材数
        raw({ ct: BASE + 2, type: 3, msg: '[图片]', sid: 103 }), // 无描述：text 空
      ],
      opts()
    );
    expect(r.msgs).toHaveLength(3); // 全量入仓
    expect(r.stats).toMatchObject({ msgCount: 1, voiceCount: 1, voiceTotalSec: 8, imageCount: 0 });
    expect(r.insights.voiceEmotion).toEqual({ 开心: 1 });
  });

  it('type=10000 撤回归属：按 who 计 recantByMe / recantByOther（不受 keepSystem 影响）', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 10000, who: '我', msg: '你撤回了一条消息', sid: 105 }),
        raw({ ct: BASE + 1, type: 10000, who: '对方', msg: '"对方" 撤回了一条消息', sid: 106 }),
      ],
      opts({ keepSystem: false })
    );
    expect(r.msgs).toHaveLength(2); // 恒入仓
    expect(r.msgs.every((m) => m.text === '')).toBe(true); // keepSystem 关：不进时间线
    expect(r.insights.recantByMe).toBe(1);
    expect(r.insights.recantByOther).toBe(1);
  });

  it('群聊前缀：非我消息 text 前加 [成员名] ；我方不加；单聊不变；text 空不加前缀', () => {
    const groupRaws = [
      raw({ ct: BASE, who: '甲', msg: '构造甲说', sid: 111 }),
      raw({ ct: BASE + 1, who: '我', msg: '构造我说', sid: 112 }),
      raw({ ct: BASE + 2, who: '乙', type: 47, msg: '[表情· OK]', sid: 113 }),
      raw({ ct: BASE + 3, who: '乙', type: 10000, msg: '"乙" 撤回了一条消息', sid: 116 }), // 系统消息自带归属
      raw({ ct: BASE + 4, who: '乙', type: 47, msg: '[表情]', sid: 117 }), // 未命名：text 空
    ];
    const g = normalizeChatJson(groupRaws, opts());
    expect(g.msgs.map((m) => m.text)).toEqual([
      '[甲] 构造甲说',
      '构造我说',
      '[乙] [表情· OK]',
      '"乙" 撤回了一条消息', // 系统消息不加成员前缀（免双重归属）
      '', // text 空不加前缀
    ]);
    const single = normalizeChatJson(
      [raw({ ct: BASE, who: '对方', msg: '构造单聊', sid: 114 }), raw({ ct: BASE + 1, who: '我', msg: '好', sid: 115 })],
      opts()
    );
    expect(single.msgs.map((m) => m.text)).toEqual(['构造单聊', '好']);
  });

  it('insights 汇总：会话切分 / 回复中位数 / 深夜占比 / 沉默段随导入现算', () => {
    const d = (day: number, hour: number, min = 0): number =>
      Math.round(new Date(2026, 2, day, hour, min, 0).getTime() / 1000); // 本地时间构造（秒级 ct）
    const r = normalizeChatJson(
      [
        raw({ ct: d(1, 1, 0), who: '我', msg: '深夜开场', sid: 121 }), // 会话1 我开；深夜
        raw({ ct: d(1, 1, 1), who: '对方', msg: '回', sid: 122 }), // 对方 60 秒样本
        raw({ ct: d(1, 1, 2), who: '我', msg: '嗯', sid: 123 }), // 我 60 秒样本
        raw({ ct: d(1, 12, 0), who: '对方', msg: '中午新会话', sid: 124 }), // ≥30 分钟 → 对方开新会话
        raw({ ct: d(20, 14, 0), who: '对方', msg: '19 天后', sid: 125 }), // 沉默段 19 天 + 新会话
      ],
      opts()
    );
    const i = r.insights;
    expect(i.sessionStartedByMe).toBe(1);
    expect(i.sessionStartedByOther).toBe(2);
    expect(i.myReplyMedianSec).toBe(60);
    expect(i.otherReplyMedianSec).toBe(60);
    expect(i.nightSharePct).toBe(60); // 深夜 3 条（1:00 / 1:01 / 1:02）/ 全部 5 条
    expect(i.silenceGaps).toEqual([
      { from: '2026-03-01', to: '2026-03-20', days: 19 },
    ]);
  });

  it('全量入仓：未命名表情 / 位置 / 名片 / 未知码 / 空文本都进仓（原始条数 = chat.json 条数，466 验收）', () => {
    const raws = [
      raw({ ct: BASE, type: 47, msg: '[表情]', sid: 131 }), // 未命名表情
      raw({ ct: BASE + 1, type: 49, msg: '[位置] 构造路 1 号', sid: 132 }), // 位置
      raw({ ct: BASE + 2, type: 49, msg: '[名片] 构造名片', sid: 133 }), // 名片
      raw({ ct: BASE + 3, type: 48, msg: '构造未知码', sid: 134 }), // 未知原始码
      raw({ ct: BASE + 4, type: 1, msg: '', sid: 135 }), // 空文本
      raw({ ct: BASE + 5, msg: '构造正文', sid: 136 }), // 普通文本
    ];
    const r = normalizeChatJson(raws, opts());
    expect(r.msgs).toHaveLength(raws.length); // 一条不少
    // 位置 / 名片是 49 形态、原样进时间线；不进时间线的是未命名表情 / 未知码 / 空文本
    expect(storeToUnified(r.msgs).map((m) => m.text)).toEqual([
      '[位置] 构造路 1 号',
      '[名片] 构造名片',
      '构造正文',
    ]);
    expect(r.kindCounts['表情']).toBe(1);
    expect(r.skippedCount).toBe(0);
  });

  it('原始字段保留：type / who / sid / dur / wav / img 有则存（466 验收六字段）', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 34, who: '我', msg: '[语音]', sid: 141, dur: 9, wav: 't/voice/x.wav' }),
        raw({ ct: BASE + 1, type: 3, msg: '[图片]', sid: 142, img: `${MONTH}/c.jpg` }),
      ],
      opts()
    );
    expect(r.msgs[0]).toMatchObject({ type: 34, who: '我', sid: 141, dur: 9, wav: 't/voice/x.wav' });
    expect(r.msgs[1]).toMatchObject({ type: 3, sid: 142, img: `${MONTH}/c.jpg` });
  });

  it('非对象 / 无效时间戳：无法入仓只计数（skippedCount 口径，466 收窄）', () => {
    const r = normalizeChatJson(
      [null, { ct: Number.NaN, type: 1, who: '我', msg: '构造' }, raw({ ct: BASE, msg: '好', sid: 151 })],
      opts()
    );
    expect(r.msgs).toHaveLength(1);
    expect(r.skippedCount).toBe(2);
    expect(r.kindCounts['文本']).toBe(2); // 形态计数在入仓判定之前——无效时间的那条也记文本
  });
});

describe('isGroupChat 群聊判定', () => {
  it('非「我」发送者多于一人 = 群聊；单聊（对方 + 我）不算', () => {
    expect(isGroupChat([raw({ ct: BASE, who: '甲' }), raw({ ct: BASE + 1, who: '乙' })])).toBe(true);
    expect(isGroupChat([raw({ ct: BASE, who: '对方' }), raw({ ct: BASE + 1, who: '我' })])).toBe(false);
    expect(isGroupChat([])).toBe(false);
    expect(isGroupChat([raw({ ct: BASE, who: '我' })])).toBe(false);
  });
});

describe('mergeStore 聊天仓合并（466 upsert）', () => {
  const normOf = (raws: RawChatMsg[]): ReturnType<typeof normalizeChatJson> => normalizeChatJson(raws, opts());

  it('首导：全量进仓（added = 条数），结构含 watermarkSid / stats / kindCounts', () => {
    const first = normOf([
      raw({ ct: BASE, msg: '一', sid: 111 }),
      raw({ ct: BASE + 60, type: 34, msg: '[语音 9秒·平静] 构造', sid: 112, dur: 9 }),
    ]);
    const { contact, added, updated } = mergeStore(undefined, first, '2026-09-25T00:00:00.000Z');
    expect(added).toBe(2);
    expect(updated).toBe(0);
    expect(contact.msgs).toHaveLength(2);
    expect(contact.watermarkSid).toBe(112);
    expect(contact.stats).toMatchObject({ msgCount: 2, voiceCount: 1, voiceTotalSec: 9 });
    expect(contact.kindCounts).toMatchObject({ 文本: 1, 语音: 1 });
    expect(contact.updatedAt).toBe('2026-09-25T00:00:00.000Z');
  });

  it('重导部分新增：只补新键，不产生重复条目，ts 升序', () => {
    const old3 = [raw({ ct: BASE, msg: '一', sid: 121 }), raw({ ct: BASE + 1, msg: '二', sid: 122 }), raw({ ct: BASE + 2, msg: '三', sid: 123 })];
    const { contact } = mergeStore(undefined, normOf(old3), '2026-09-25T00:00:00.000Z');
    const again = normOf([...old3, raw({ ct: BASE + 3, msg: '四', sid: 124 }), raw({ ct: BASE + 4, msg: '五', sid: 125 })]);
    const { contact: merged, added } = mergeStore(contact, again, '2026-09-26T00:00:00.000Z');
    expect(added).toBe(2);
    expect(merged.msgs).toHaveLength(5);
    expect(merged.msgs.map((m) => m.text)).toEqual(['一', '二', '三', '四', '五']);
    expect(merged.watermarkSid).toBe(125);
  });

  it('同键 upsert：文本再次导入升级为新文本（现网「源 28 条带名 / 仓 52 条」事故的修复验收）', () => {
    // 首导：表情未命名（text 空，入仓不进时间线）
    const first = normOf([raw({ ct: BASE, type: 47, msg: '[表情]', sid: 131 })]);
    const { contact } = mergeStore(undefined, first, '2026-09-25T00:00:00.000Z');
    expect(contact.msgs[0].text).toBe('');
    // 重导：同一条消息的表情已被命名（同 sid 同 ct 同键），文本必须升级
    const again = normOf([raw({ ct: BASE, type: 47, msg: '[表情·笑哭]', sid: 131 })]);
    const { contact: merged, added, updated } = mergeStore(contact, again, '2026-09-26T00:00:00.000Z');
    expect(added).toBe(0);
    expect(updated).toBe(1);
    expect(merged.msgs).toHaveLength(1); // 不堆重复条目
    expect(merged.msgs[0].text).toBe('[表情·笑哭]'); // 旧文本被覆盖
    expect(merged.stats.msgCount).toBe(1); // 统计随新时间线重算
  });

  it('同键 upsert：原始字段按新值更新（图片关联 img 后补）', () => {
    const first = normOf([raw({ ct: BASE, type: 3, msg: '[图片]', sid: 141 })]); // img 缺失，无描述 → text 空
    const { contact } = mergeStore(undefined, first, '2026-09-25T00:00:00.000Z');
    expect(contact.msgs[0].img).toBeUndefined();
    const descs: ImageDescItem[] = [{ file: `${MONTH}/n.jpg`, ct: BASE, desc: '构造新描述' }];
    const again = normalizeChatJson(
      [raw({ ct: BASE, type: 3, msg: '[图片]', sid: 141, img: `${MONTH}/n.jpg` })],
      opts(),
      { imageDesc: descs }
    );
    const { contact: merged, updated } = mergeStore(contact, again, '2026-09-26T00:00:00.000Z');
    expect(updated).toBe(1);
    expect(merged.msgs[0]).toMatchObject({ img: `${MONTH}/n.jpg`, text: '[图片] 构造新描述' });
  });

  it('完全重复导入：added = 0，条目内容不变', () => {
    const raws = [raw({ ct: BASE, msg: '一', sid: 131 }), raw({ ct: BASE + 1, msg: '二', sid: 132 })];
    const { contact } = mergeStore(undefined, normOf(raws), '2026-09-25T00:00:00.000Z');
    const again = mergeStore(contact, normOf(raws), '2026-09-26T00:00:00.000Z');
    expect(again.added).toBe(0);
    expect(again.updated).toBe(2); // 同键覆盖（内容同值）
    expect(again.contact.msgs).toEqual(contact.msgs);
    expect(again.contact.stats).toEqual(contact.stats);
  });

  it('仓里已有而本次没出现的条目保留（部分导出不互删）', () => {
    const full = [raw({ ct: BASE, msg: '一', sid: 151 }), raw({ ct: BASE + 1, msg: '二', sid: 152 })];
    const { contact } = mergeStore(undefined, normOf(full), '2026-09-25T00:00:00.000Z');
    const partial = normOf([raw({ ct: BASE + 1, msg: '二', sid: 152 })]);
    const { contact: merged } = mergeStore(contact, partial, '2026-09-26T00:00:00.000Z');
    expect(merged.msgs).toHaveLength(2);
    expect(merged.msgs.map((m) => m.text)).toEqual(['一', '二']);
  });

  it('无 sid 消息（哈希键）同样判重；watermarkSid 不被无 sid 消息回退', () => {
    const raws = [raw({ ct: BASE, msg: '无sid', sid: 0 }), raw({ ct: BASE + 1, msg: '有sid', sid: 141 })];
    const { contact } = mergeStore(undefined, normOf(raws), '2026-09-25T00:00:00.000Z');
    expect(contact.watermarkSid).toBe(141);
    const again = mergeStore(contact, normOf(raws), '2026-09-26T00:00:00.000Z');
    expect(again.added).toBe(0);
  });

  it('仓消息直转 UnifiedMessage 只含时间线（text 非空；第二段管线入参）', () => {
    const first = normOf([
      raw({ ct: BASE, who: '我', msg: '构造', sid: 161 }),
      raw({ ct: BASE + 1, type: 47, msg: '[表情]', sid: 162 }), // text 空
    ]);
    const { contact } = mergeStore(undefined, first, '2026-09-25T00:00:00.000Z');
    expect(storeToUnified(contact.msgs)).toEqual([{ ts: BASE * 1000, isSender: true, text: '构造' }]);
  });
});

describe('storeStatsOf（时间线口径重算，466 验收：与改前一致）', () => {
  it('空流 → 全零', () => {
    expect(storeStatsOf([])).toEqual({ msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 });
  });
  it('text 空的条目不进统计；带标签文本照 445 口径计数', () => {
    const msgs = normalizeChatJson(
      [
        raw({ ct: BASE, type: 34, msg: '[语音 8秒·开心] 构造', sid: 171, dur: 8 }),
        raw({ ct: BASE + 1, type: 34, msg: '[语音 5秒]', sid: 172 }), // text 空
        raw({ ct: BASE + 2, msg: '[图片] 构造描述', sid: 173 }),
      ],
      opts()
    ).msgs;
    expect(storeStatsOf(msgs)).toMatchObject({ msgCount: 2, voiceCount: 1, voiceTotalSec: 8, imageCount: 1 });
  });
});

describe('MessageStore（people-preview.json 落盘；聊天仓 v2）', () => {
  let vault: MockVault;
  let store: MessageStore;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    resetObsidianMocks();
    store = new MessageStore({ vault });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const contactOf = (name: string, n: number): StoreContact => {
    const norm = normalizeChatJson(
      Array.from({ length: n }, (_, i) => raw({ ct: BASE + i, msg: `构造 ${i}`, sid: 1000 + i })),
      opts()
    );
    return mergeStore(undefined, norm, '2026-09-25T00:00:00.000Z').contact;
  };

  it('空仓读出默认结构（version 2）；upsertContact 落盘后可读回', async () => {
    expect(await store.read()).toEqual(emptyMessageStore());
    await store.upsertContact('构造者甲', contactOf('甲', 3));
    const data = await store.read();
    expect(Object.keys(data.contacts)).toEqual(['构造者甲']);
    expect(data.version).toBe(2);
    expect(data.contacts['构造者甲'].msgs).toHaveLength(3);
    expect(data.contacts['构造者甲'].stats.msgCount).toBe(3);
    expect(vault.files.has('CONFIG/STORAGE/people-preview.json')).toBe(true);
  });

  it('同一人重导覆盖同槽位（不堆重复联系人键）', async () => {
    await store.upsertContact('甲', contactOf('甲', 2));
    await store.upsertContact('甲', contactOf('甲', 5));
    const data = await store.read();
    expect(Object.keys(data.contacts)).toHaveLength(1);
    expect(data.contacts['甲'].msgs).toHaveLength(5);
  });

  it('结构版本门禁（466 / ADR-0197 决策 6）：盘上 v1 旧桶判废返回空仓，从数据根重导', async () => {
    vault.files.set(
      'CONFIG/STORAGE/people-preview.json',
      JSON.stringify({
        version: 1,
        contacts: { 甲: { msgs: [{ key: 'k', ts: 1, isSender: true, text: '旧结构' }], watermarkSid: 0, stats: { msgCount: 1, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: '' } },
      })
    );
    const data = await store.read();
    expect(data).toEqual(emptyMessageStore()); // 旧结构就地判废（无升级路径）
    expect(Object.keys(data.contacts)).toHaveLength(0);
  });

  it('clear 清空整仓并保留文件框架（不动其他域文件）', async () => {
    await store.upsertContact('甲', contactOf('甲', 2));
    await store.upsertContact('乙', contactOf('乙', 2));
    await store.clear();
    const data = await store.read();
    expect(data).toEqual(emptyMessageStore());
    expect(vault.files.has('CONFIG/STORAGE/people-preview.json')).toBe(true);
    expect(vault.files.has('CONFIG/STORAGE/people.json')).toBe(false); // PersonEntry 不受影响
  });
});

/** 月份常量（image_desc 用例共用）：2026-03 */
const MONTH = '2026-03';
/** 本地时区日期(时间可选) → 秒级 ct（构造图片描述用例，避免时区断言脆断） */
function ctOf(date: string): number {
  const iso = date.includes('T') ? date : `${date}T12:00:00`;
  return Math.floor(new Date(iso).getTime() / 1000);
}
