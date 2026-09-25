/**
 * 脸谱数据源层测试（issue 446）：替代键（sid / ct+msg 哈希）、chat.json 归一化矩阵
 * （语音转写回退 / 图片描述命中与缺失 / 视频与系统消息开关 / 群聊判定 / 非文本形态丢弃）、
 * 预览桶增量合并（首导 / 部分新增 / 完全重复 / stats 重算）、
 * PreviewStore 落盘结构与清空（MockVault）。（447：shouldGenerate 随自动链路退役，触发改弹窗手动。）
 * 隐私口径：全部构造数据，不含真实聊天内容。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PreviewStore,
  emptyPreviewData,
  isGroupChat,
  mergePreview,
  msgKey,
  normalizeChatJson,
  previewStatsOf,
  previewToUnified,
  type ImageDescItem,
  type NormalizeOptions,
  type PreviewContact,
  type RawChatMsg,
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

describe('normalizeChatJson 归一化矩阵', () => {
  it('文本消息：原样进预览，ts 秒转毫秒，who=「我」判 isSender', () => {
    const r = normalizeChatJson(
      [raw({ ct: BASE, msg: '你好' }), raw({ ct: BASE + 1, who: '我', msg: '在的' })],
      opts()
    );
    expect(r.msgs).toHaveLength(2);
    expect(r.msgs[0]).toMatchObject({ ts: BASE * 1000, isSender: false, text: '你好' });
    expect(r.msgs[1]).toMatchObject({ ts: (BASE + 1) * 1000, isSender: true });
    expect(r.skippedCount).toBe(0);
  });

  it('语音已回填转写：msg 原样保留（445 导出契约形态）', () => {
    const r = normalizeChatJson([raw({ ct: BASE, type: 34, msg: '[语音 14秒·平静] 构造转写内容', sid: 11 })], opts());
    expect(r.msgs[0].text).toBe('[语音 14秒·平静] 构造转写内容');
  });

  it('语音无转写：msg 无正文时查 voice.json（wav 关联）回填；英文情感标签转中文', () => {
    const voice: VoiceItem[] = [
      { wav: 'talker/voice/20240101_120000_77.wav', dur: 5, text: '构造语音文本', emotion: 'HAPPY' },
      { wav: 'talker/voice/20240101_130000_88.wav', dur: 3, text: '构造第二条', emotion: 'NEUTRAL' },
    ];
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 34, msg: '[语音 12秒]', sid: 21, wav: '20240101_110000_66.wav', dur: 12 }), // 表里没有
        raw({ ct: BASE + 1, type: 34, msg: '[语音 8秒]', sid: 22, wav: '20240101_120000_77.wav', dur: 8 }), // 消息裸文件名 → 表全路径（尾段键兜底）
        raw({ ct: BASE + 2, type: 34, msg: '[语音 3秒]', sid: 23, wav: 'talker/voice/20240101_130000_88.wav', dur: 3 }), // 全路径直配
      ],
      opts(),
      { voice }
    );
    expect(r.msgs[0].text).toBe('[语音 12秒]'); // 无转写保持标签（不解析成素材）
    expect(r.msgs[1].text).toBe('[语音 8秒·开心] 构造语音文本');
    expect(r.msgs[2].text).toBe('[语音 3秒·平静] 构造第二条');
  });

  it('previewVoice=false：语音丢弃只计数', () => {
    const r = normalizeChatJson([raw({ ct: BASE, type: 34, msg: '[语音 14秒] 构造', sid: 31 })], opts({ previewVoice: false }));
    expect(r.msgs).toHaveLength(0);
    expect(r.kindCounts['语音']).toBe(1);
    expect(r.skippedCount).toBe(1);
  });

  it('图片描述：img 字段有值按 file 精确命中（预处理线权威路径）', () => {
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
  });

  it('图片描述：img 缺失走同月 ct 最近邻（±12h 内命中；一张描述只配一条消息）', () => {
    const descs: ImageDescItem[] = [{ file: `${MONTH}/a.jpg`, ct: ctOf('2026-03-05T10:30:00'), desc: '构造描述' }];
    const r = normalizeChatJson(
      [
        raw({ ct: ctOf('2026-03-05T10:00:00'), type: 3, msg: '[图片]', sid: 51 }), // 距 30 分钟 → 命中
        raw({ ct: ctOf('2026-03-05T10:10:00'), type: 3, msg: '[图片]', sid: 52 }), // 更近但描述已被消费 → 回退
      ],
      opts(),
      { imageDesc: descs }
    );
    expect(r.msgs.map((m) => m.text)).toEqual(['[图片] 构造描述', '[图片]']);
  });

  it('图片描述缺失回退：无表 / 超 12h / 跨月 / img 对不上表 → 空标签 [图片]（不解析成素材）', () => {
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
    expect(r.msgs.map((m) => m.text)).toEqual(['[图片]', '[图片]', '[图片]']);
    expect(r.stats.imageCount).toBe(0);
  });

  it('imageDescMode=ai / off：只留 [图片] 标签（ai 本期占位同 off）', () => {
    const raws = [raw({ ct: BASE, type: 3, msg: '[图片]', sid: 61 })];
    const descs: ImageDescItem[] = [{ file: `${MONTH}/a.jpg`, ct: BASE, desc: '构造描述' }];
    for (const mode of ['ai', 'off'] as const) {
      const r = normalizeChatJson(raws, opts({ imageDescMode: mode }), { imageDesc: descs });
      expect(r.msgs[0].text).toBe('[图片]');
    }
  });

  it('previewVideo=false：视频丢弃只计数；开则 [视频 N秒] 标签进预览', () => {
    const v = raw({ ct: BASE, type: 43, msg: '', sid: 71, dur: 61 });
    expect(normalizeChatJson([v], opts({ previewVideo: false })).msgs).toHaveLength(0);
    const r = normalizeChatJson([v], opts());
    expect(r.msgs[0].text).toBe('[视频 61秒]');
    expect(normalizeChatJson([{ ...v, dur: undefined }], opts()).msgs[0].text).toBe('[视频]');
  });

  it('keepSystem 开关：type=10000 系统消息保留 / 丢弃，形态计数恒记', () => {
    const sys = raw({ ct: BASE, type: 10000, msg: '"对方" 撤回了一条消息', sid: 81 });
    const on = normalizeChatJson([sys], opts());
    expect(on.msgs[0].text).toBe('"对方" 撤回了一条消息');
    expect(on.kindCounts['系统']).toBe(1);
    const off = normalizeChatJson([sys], opts({ keepSystem: false }));
    expect(off.msgs).toHaveLength(0);
    expect(off.kindCounts['系统']).toBe(1);
  });

  it('表情 / appmsg / 通话：一律丢弃只计数', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 47, msg: '[表情]', sid: 91 }),
        raw({ ct: BASE + 1, type: 49, msg: '[分享] 构造', sid: 92 }),
        raw({ ct: BASE + 2, type: 50, msg: '[通话时长 1分]', sid: 93 }),
      ],
      opts()
    );
    expect(r.msgs).toHaveLength(0);
    expect(r.kindCounts).toMatchObject({ 表情: 1, 分享: 1, 通话: 1 });
    expect(r.skippedCount).toBe(3);
  });

  it('type=1 且 msg 以媒体标签开头：按 445 parseMediaTag 走媒体素材（stats 计数）', () => {
    const r = normalizeChatJson(
      [raw({ ct: BASE, msg: '[语音 12s·平静] 构造转写' }), raw({ ct: BASE + 1, msg: '[图片] 构造描述' })],
      opts()
    );
    expect(r.stats).toMatchObject({ msgCount: 2, voiceCount: 1, voiceTotalSec: 12, imageCount: 1 });
  });

  it('stats 重算口径：合成标签的语音带时长计入 voiceTotalSec，空标签不计素材', () => {
    const r = normalizeChatJson(
      [
        raw({ ct: BASE, type: 34, msg: '[语音 8秒·开心] 构造', sid: 101 }),
        raw({ ct: BASE + 1, type: 34, msg: '[语音 5秒]', sid: 102 }), // 无转写：不进素材数
        raw({ ct: BASE + 2, type: 3, msg: '[图片]', sid: 103 }),
      ],
      opts()
    );
    expect(r.stats).toMatchObject({ msgCount: 3, voiceCount: 1, voiceTotalSec: 8, imageCount: 0 });
  });

  it('无效时间戳：只计数不进预览', () => {
    const r = normalizeChatJson([{ ct: Number.NaN, type: 1, who: '我', msg: '构造' }], opts());
    expect(r.msgs).toHaveLength(0);
    expect(r.kindCounts['文本']).toBe(1);
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

describe('mergePreview 预览桶增量', () => {
  const normOf = (raws: RawChatMsg[]): ReturnType<typeof normalizeChatJson> => normalizeChatJson(raws, opts());

  it('首导：全量进桶（added = 条数），结构含 watermarkSid / stats / kindCounts', () => {
    const first = normOf([
      raw({ ct: BASE, msg: '一', sid: 111 }),
      raw({ ct: BASE + 60, type: 34, msg: '[语音 9秒·平静] 构造', sid: 112, dur: 9 }),
    ]);
    const { contact, added } = mergePreview(undefined, first, '2026-09-25T00:00:00.000Z');
    expect(added).toBe(2);
    expect(contact.msgs).toHaveLength(2);
    expect(contact.watermarkSid).toBe(112);
    expect(contact.stats).toMatchObject({ msgCount: 2, voiceCount: 1, voiceTotalSec: 9 });
    expect(contact.kindCounts).toMatchObject({ 文本: 1, 语音: 1 });
    expect(contact.updatedAt).toBe('2026-09-25T00:00:00.000Z');
  });

  it('重导部分新增：只补新消息，不产生重复条目，ts 升序', () => {
    const old3 = [raw({ ct: BASE, msg: '一', sid: 121 }), raw({ ct: BASE + 1, msg: '二', sid: 122 }), raw({ ct: BASE + 2, msg: '三', sid: 123 })];
    const { contact } = mergePreview(undefined, normOf(old3), '2026-09-25T00:00:00.000Z');
    const again = normOf([...old3, raw({ ct: BASE + 3, msg: '四', sid: 124 }), raw({ ct: BASE + 4, msg: '五', sid: 125 })]);
    const { contact: merged, added } = mergePreview(contact, again, '2026-09-26T00:00:00.000Z');
    expect(added).toBe(2);
    expect(merged.msgs).toHaveLength(5);
    expect(merged.msgs.map((m) => m.text)).toEqual(['一', '二', '三', '四', '五']);
    expect(merged.watermarkSid).toBe(125);
  });

  it('完全重复导入：added = 0，条目与 stats 不变', () => {
    const raws = [raw({ ct: BASE, msg: '一', sid: 131 }), raw({ ct: BASE + 1, msg: '二', sid: 132 })];
    const { contact } = mergePreview(undefined, normOf(raws), '2026-09-25T00:00:00.000Z');
    const again = mergePreview(contact, normOf(raws), '2026-09-26T00:00:00.000Z');
    expect(again.added).toBe(0);
    expect(again.contact.msgs).toEqual(contact.msgs);
    expect(again.contact.stats).toEqual(contact.stats);
  });

  it('无 sid 消息（哈希键）同样判重；watermarkSid 不被无 sid 消息回退', () => {
    const raws = [raw({ ct: BASE, msg: '无sid', sid: 0 }), raw({ ct: BASE + 1, msg: '有sid', sid: 141 })];
    const { contact } = mergePreview(undefined, normOf(raws), '2026-09-25T00:00:00.000Z');
    expect(contact.watermarkSid).toBe(141);
    const again = mergePreview(contact, normOf(raws), '2026-09-26T00:00:00.000Z');
    expect(again.added).toBe(0);
  });

  it('预览全量消息可直转 UnifiedMessage（第二段管线入参）', () => {
    const { contact } = mergePreview(undefined, normOf([raw({ ct: BASE, who: '我', msg: '构造' , sid: 151 })]), '2026-09-25T00:00:00.000Z');
    expect(previewToUnified(contact.msgs)).toEqual([{ ts: BASE * 1000, isSender: true, text: '构造' }]);
  });
});

describe('previewStatsOf', () => {
  it('空流 → 全零', () => {
    expect(previewStatsOf([])).toEqual({ msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 });
  });
});

describe('PreviewStore（people-preview.json 落盘）', () => {
  let vault: MockVault;
  let store: PreviewStore;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    resetObsidianMocks();
    store = new PreviewStore({ vault });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const contactOf = (name: string, n: number): PreviewContact => {
    const norm = normalizeChatJson(
      Array.from({ length: n }, (_, i) => raw({ ct: BASE + i, msg: `构造 ${i}`, sid: 1000 + i })),
      opts()
    );
    return mergePreview(undefined, norm, '2026-09-25T00:00:00.000Z').contact;
  };

  it('空桶读出默认结构；upsertContact 落盘后可读回', async () => {
    expect(await store.read()).toEqual(emptyPreviewData());
    await store.upsertContact('构造者甲', contactOf('甲', 3));
    const data = await store.read();
    expect(Object.keys(data.contacts)).toEqual(['构造者甲']);
    expect(data.version).toBe(1);
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

  it('clear 清空全部预览并保留文件框架（不动其他域文件）', async () => {
    await store.upsertContact('甲', contactOf('甲', 2));
    await store.upsertContact('乙', contactOf('乙', 2));
    await store.clear();
    const data = await store.read();
    expect(data).toEqual(emptyPreviewData());
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
