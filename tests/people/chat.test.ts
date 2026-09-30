// @vitest-environment node
/**
 * 会话流展示层测试（issue 529）：聊天仓消息 → 展示行的转换规则单源。
 *
 * 覆盖：标签剥离（只认已知词表；普通文本里以 `[` 开头的句子不吃）、标签 → 图标、
 * 聊天仓 → 展示行（只取时间线条目 / 归属 / 空 text 过滤）与时间分隔条口径
 * （今天 / 昨天 / 今年 / 更早 + 5 分钟间隔门限）、群聊判定（单聊不写名）。
 * 纯逻辑，无 DOM；数据全构造。
 */
import { describe, it, expect } from 'vitest';
import { chatLinesOf, chatSepOf, chatTagIcon, isGroupChatLines, splitChatTag } from '../../src/people/chat';
import type { StoreMsg } from '../../src/people/datasource';

const msg = (over: Partial<StoreMsg>): StoreMsg => ({
  key: 's1:100',
  ts: 1700000000000,
  isSender: false,
  type: 1,
  text: '普通消息',
  ...over,
});

describe('splitChatTag 标签剥离', () => {
  it('媒体标签剥出来，后面的是正文', () => {
    expect(splitChatTag('[图片] 一只趴在窗台上的猫')).toEqual({ tag: '[图片]', body: '一只趴在窗台上的猫' });
    expect(splitChatTag('[语音 12秒·平静] 你到了吗')).toEqual({ tag: '[语音 12秒·平静]', body: '你到了吗' });
    expect(splitChatTag('[表情·微笑]')).toEqual({ tag: '[表情·微笑]', body: '' });
    expect(splitChatTag('[录音 3分02秒·平静] 今天开会')).toEqual({ tag: '[录音 3分02秒·平静]', body: '今天开会' });
  });

  it('词表外的方括号不当标签（普通文本照旧整条进气泡）', () => {
    expect(splitChatTag('[他说的] 那句我没接上')).toEqual({ tag: '', body: '[他说的] 那句我没接上' });
    expect(splitChatTag('[2026-03-07] 记一笔')).toEqual({ tag: '', body: '[2026-03-07] 记一笔' });
    expect(splitChatTag('没有方括号')).toEqual({ tag: '', body: '没有方括号' });
  });

  it('超长方括号内容不当标签（那是正文不是标签）', () => {
    const long = `[图片${'很长的描述'.repeat(20)}] 后面还有`;
    expect(splitChatTag(long).tag).toBe('');
  });

  it('词表内但带后缀的也算同类标签（引用 / 分享 / 文件）', () => {
    expect(splitChatTag('[引用「在吗」] 在的').tag).toBe('[引用「在吗」]');
    expect(splitChatTag('[文件 report.pdf] 给你').tag).toBe('[文件 report.pdf]');
  });
});

describe('chatTagIcon 标签 → 图标', () => {
  it('已知词给对应 lucide 名，未知给空串', () => {
    expect(chatTagIcon('[图片]')).toBe('image');
    expect(chatTagIcon('[语音 12秒]')).toBe('mic');
    expect(chatTagIcon('[录音 3分]')).toBe('mic');
    expect(chatTagIcon('[视频 30秒]')).toBe('video');
    expect(chatTagIcon('[表情·微笑]')).toBe('smile');
    expect(chatTagIcon('[未知标签]')).toBe('');
    expect(chatTagIcon('')).toBe('');
  });
});

describe('chatLinesOf 聊天仓 → 展示行', () => {
  it('只取时间线条目（text 为空的待办媒体 / 终态跳过图不进），顺序照仓里 ts 升序', () => {
    const lines = chatLinesOf([
      msg({ key: 'a', ts: 1, text: '早' }),
      msg({ key: 'b', ts: 2, text: '', type: 3 }), // 未描述的图：不在时间线上
      msg({ key: 'c', ts: 3, text: '[图片] 一只猫', type: 3 }),
    ]);
    expect(lines.map((l) => l.key)).toEqual(['a', 'c']);
    expect(lines[1]).toMatchObject({ tag: '[图片]', text: '一只猫' });
  });

  it('归属取 isSender；who 缺省时我方补「我」', () => {
    const [a, b] = chatLinesOf([
      msg({ key: 'a', isSender: true, who: undefined, text: '我说的' }),
      msg({ key: 'b', isSender: false, who: '大琳', text: '她说的' }),
    ]);
    expect(a).toMatchObject({ me: true, who: '我' });
    expect(b).toMatchObject({ me: false, who: '大琳' });
  });

  it('空仓 / 坏时间戳不炸', () => {
    expect(chatLinesOf(undefined)).toEqual([]);
    expect(chatLinesOf([])).toEqual([]);
    expect(chatLinesOf([msg({ ts: Number.NaN })])).toEqual([]);
  });
});

describe('chatSepOf 时间分隔条', () => {
  const now = new Date(2026, 8, 30, 20, 30).getTime(); // 2026-09-30 20:30 本地
  const at = (y: number, mo: number, d: number, h: number, mi: number): number => new Date(y, mo - 1, d, h, mi).getTime();

  it('第一条必出；间隔不到 5 分钟不出', () => {
    expect(chatSepOf(at(2026, 9, 30, 20, 0), null, now)).toBe('20:00');
    expect(chatSepOf(at(2026, 9, 30, 20, 4), at(2026, 9, 30, 20, 0), now)).toBe('');
    expect(chatSepOf(at(2026, 9, 30, 20, 5), at(2026, 9, 30, 20, 0), now)).toBe('20:05');
  });

  it('今天 / 昨天 / 今年 / 更早四种形态', () => {
    expect(chatSepOf(at(2026, 9, 30, 9, 5), at(2026, 9, 30, 8, 0), now)).toBe('09:05');
    expect(chatSepOf(at(2026, 9, 29, 22, 10), at(2026, 9, 29, 20, 0), now)).toBe('昨天 22:10');
    expect(chatSepOf(at(2026, 3, 7, 0, 15), at(2026, 3, 7, 0, 0), now)).toBe('3月7日 00:15');
    expect(chatSepOf(at(2025, 12, 31, 23, 59), at(2025, 12, 31, 23, 0), now)).toBe('2025年12月31日 23:59');
  });

  it('坏时间戳不出条', () => {
    expect(chatSepOf(Number.NaN, null, now)).toBe('');
  });
});

describe('isGroupChatLines 群聊判定', () => {
  const line = (who: string, me = false) => ({ key: who, ts: 0, me, who, tag: '', text: 'x' });

  it('除我之外两位以上发送者 = 群聊；单聊不写名', () => {
    expect(isGroupChatLines([line('我', true), line('大琳')])).toBe(false);
    expect(isGroupChatLines([line('我', true), line('大琳'), line('莫莫')])).toBe(true);
    expect(isGroupChatLines([line('我', true)])).toBe(false);
    expect(isGroupChatLines([])).toBe(false);
  });
});
