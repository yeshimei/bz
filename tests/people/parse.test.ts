/**
 * 脸谱域解析层测试（issue 435）：留痕系 CSV / JSON 嗅探解析、类型过滤、时间归一、
 * 引号转义、talker 提取、坏输入报错。（纯数据层，无 DOM）
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { detectWechatFormat, parseTimestamp, parseWechatExport } from '../../src/people/parse';

const CSV_HEAD = 'localId,TalkerId,Type,SubType,IsSender,CreateTime,StrContent';

describe('detectWechatFormat', () => {
  it('JSON 数组 / 对象 → json', () => {
    expect(detectWechatFormat('[{},{ }]')).toBe('json');
    expect(detectWechatFormat('{"messages":[]}')).toBe('json');
  });
  it('带 BOM 与前导空白的 CSV → csv', () => {
    expect(detectWechatFormat('\uFEFF\n  localId,IsSender\r\n')).toBe('csv');
  });
  it('空串 / 单列不像导出 → null', () => {
    expect(detectWechatFormat('')).toBeNull();
    expect(detectWechatFormat('随便一句话')).toBeNull();
  });
});

describe('parseWechatExport CSV', () => {
  it('留痕样表：文本留下、图片过滤、秒级时间转毫秒、按时间升序', () => {
    const csv = [
      CSV_HEAD,
      '1,2,1,0,1,1700000060,晚点聊',
      '2,2,1,0,0,1700000000,你好呀',
      '3,2,3,0,0,1700000100,[图片]',
    ].join('\n');
    const out = parseWechatExport('老王.csv', csv);
    expect(out.skippedCount).toBe(1);
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0]).toEqual({ ts: 1700000000000, isSender: false, text: '你好呀' });
    expect(out.messages[1]).toEqual({ ts: 1700000060000, isSender: true, text: '晚点聊' });
  });

  it('引号内逗号 / 换行 / 双引号转义、CRLF 行分隔', () => {
    const csv = [
      CSV_HEAD,
      '1,2,1,0,0,1700000000,"他说""明天见"",然后走了"',
      '2,2,1,0,1,1700000060,"第一行',
      '第二行"',
    ].join('\r\n');
    const out = parseWechatExport('x.csv', csv);
    expect(out.messages[0].text).toBe('他说"明天见",然后走了');
    expect(out.messages[1].text).toBe('第一行\n第二行');
    expect(out.messages).toHaveLength(2);
  });

  it('talker 列提取对方标识；缺失回落文件名去扩展名', () => {
    const withTalker = parseWechatExport('导出.csv', `${CSV_HEAD}\n1,wxid_abc,1,0,0,1700000000,嗨`);
    expect(withTalker.talker).toBe('wxid_abc');
    const noTalkerCol = parseWechatExport('老王.csv', 'IsSender,CreateTime,StrContent\n0,1700000000,嗨');
    expect(noTalkerCol.talker).toBe('老王');
  });

  it('type_name 优先于数字 Type（文本留下、语音过滤）', () => {
    const csv = 'type_name,IsSender,CreateTime,msg\n文本,0,1700000000,在吗\n语音,0,1700000060,[语音]';
    const out = parseWechatExport('x.csv', csv);
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0].text).toBe('在吗');
  });

  it('空文本 / 无效时间行计入 skipped；缺内容或时间列抛错', () => {
    const bad = parseWechatExport('x.csv', `${CSV_HEAD}\n1,2,1,0,0,,\n2,2,1,0,0,abc,无时间`);
    expect(bad.messages).toHaveLength(0);
    expect(bad.skippedCount).toBe(2);
    expect(() => parseWechatExport('x.csv', 'IsSender,Whatever\n0,1')).toThrow();
  });
});

describe('parseWechatExport JSON', () => {
  it('对象数组：is_sender / CreateTime 秒 / type 过滤', () => {
    const json = JSON.stringify([
      { is_sender: 0, CreateTime: 1700000000, msg: '吃了吗', type: 1 },
      { is_sender: 1, CreateTime: 1700000060, msg: '刚吃', type: 1 },
      { is_sender: 0, CreateTime: 1700000100, msg: '', type: 3 },
    ]);
    const out = parseWechatExport('老王.json', json);
    expect(out.talker).toBe('老王');
    expect(out.messages).toHaveLength(2);
    expect(out.messages[1].isSender).toBe(true);
    expect(out.skippedCount).toBe(1);
  });

  it('对象包 messages 数组；type_name 过滤；talker 字段提取', () => {
    const json = JSON.stringify({
      talker: 'wxid_k',
      messages: [
        { type_name: '文本', is_sender: '1', CreateTime: '2024-01-02 12:00', msg: '早' },
        { type_name: '动画表情', is_sender: '0', CreateTime: 1700000060, msg: '[表情]' },
      ],
    });
    const out = parseWechatExport('x.json', json);
    expect(out.talker).toBe('wxid_k');
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0].text).toBe('早');
  });

  it('坏 JSON / 无消息数组抛错', () => {
    expect(() => parseWechatExport('x.json', '{oops')).toThrow();
    expect(() => parseWechatExport('x.json', '{"foo":1}')).toThrow();
  });
});

describe('parseTimestamp', () => {
  it('秒级 / 毫秒级 / 日期字符串 / 无效', () => {
    expect(parseTimestamp(1700000000)).toBe(1700000000000);
    expect(parseTimestamp(1700000000000)).toBe(1700000000000);
    expect(parseTimestamp('1700000000')).toBe(1700000000000);
    expect(parseTimestamp('2024-01-02 12:00')).toBe(Date.parse('2024-01-02T12:00'));
    expect(parseTimestamp('2024-01-02T12:00:00Z')).toBe(Date.parse('2024-01-02T12:00:00Z'));
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp('abc')).toBeNull();
    expect(parseTimestamp(123)).toBeNull(); // 太小不是合法 epoch
  });
});
