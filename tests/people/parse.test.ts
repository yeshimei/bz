/**
 * 脸谱域解析层测试（issue 435 / 436）：留痕系 CSV / JSON 嗅探解析、类型过滤、时间归一、
 * 引号转义、**按联系人分组**（CSV 多 talker / JSON 数组 / keyed 对象）、坏输入报错。
 * （纯数据层，无 DOM）
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { detectWechatFormat, parseTimestamp, parseWechatExport } from '../../src/people/parse';

const CSV_HEAD = 'localId,TalkerId,Type,SubType,IsSender,CreateTime,StrContent';

/** 单组便捷取（单人导出 = 一组） */
function only(fileName: string, text: string) {
  const out = parseWechatExport(fileName, text);
  expect(out.contacts).toHaveLength(1);
  return out.contacts[0];
}

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

describe('parseWechatExport CSV（单人一组）', () => {
  it('留痕样表：文本留下、图片过滤、秒级时间转毫秒、按时间升序', () => {
    const csv = [
      CSV_HEAD,
      '1,2,1,0,1,1700000060,晚点聊',
      '2,2,1,0,0,1700000000,你好呀',
      '3,2,3,0,0,1700000100,[图片]',
    ].join('\n');
    const g = only('老王.csv', csv);
    expect(g.skippedCount).toBe(1);
    expect(g.messages).toHaveLength(2);
    expect(g.messages[0]).toEqual({ ts: 1700000000000, isSender: false, text: '你好呀' });
    expect(g.messages[1]).toEqual({ ts: 1700000060000, isSender: true, text: '晚点聊' });
  });

  it('引号内逗号 / 换行 / 双引号转义、CRLF 行分隔', () => {
    const csv = [
      CSV_HEAD,
      '1,2,1,0,0,1700000000,"他说""明天见"",然后走了"',
      '2,2,1,0,1,1700000060,"第一行',
      '第二行"',
    ].join('\r\n');
    const g = only('x.csv', csv);
    expect(g.messages[0].text).toBe('他说"明天见",然后走了');
    expect(g.messages[1].text).toBe('第一行\n第二行');
    expect(g.messages).toHaveLength(2);
  });

  it('talker 列提取对方标识；缺失回落文件名去扩展名', () => {
    expect(only('导出.csv', `${CSV_HEAD}\n1,wxid_abc,1,0,0,1700000000,嗨`).talker).toBe('wxid_abc');
    expect(only('老王.csv', 'IsSender,CreateTime,StrContent\n0,1700000000,嗨').talker).toBe('老王');
  });

  it('type_name 优先于数字 Type（文本留下、语音过滤）', () => {
    const g = only('x.csv', 'type_name,IsSender,CreateTime,msg\n文本,0,1700000000,在吗\n语音,0,1700000060,[语音]');
    expect(g.messages).toHaveLength(1);
    expect(g.messages[0].text).toBe('在吗');
  });

  it('空文本 / 无效时间行计入 skipped；缺内容或时间列抛错', () => {
    const g = only('x.csv', `${CSV_HEAD}\n1,2,1,0,0,,\n2,2,1,0,0,abc,无时间`);
    expect(g.messages).toHaveLength(0);
    expect(g.skippedCount).toBe(2);
    expect(() => parseWechatExport('x.csv', 'IsSender,Whatever\n0,1')).toThrow();
  });
});

describe('parseWechatExport CSV（多人备份分组）', () => {
  it('按 talker 列分组，消息数降序；各组内时间升序、skipped 归组', () => {
    const csv = [
      CSV_HEAD,
      '1,wxid_a,1,0,0,1700000060,老王第二条',
      '2,wxid_b,1,0,1,1700000010,小李第一条',
      '3,wxid_a,3,0,0,1700000059,[图片]',
      '4,wxid_a,1,0,0,1700000000,老王第一条',
      '5,wxid_b,1,0,1,1700000030,小李第二条',
      '6,wxid_b,1,0,1,1700000040,小李第三条',
    ].join('\n');
    const out = parseWechatExport('backup.csv', csv);
    expect(out.contacts.map((c) => c.talker)).toEqual(['wxid_b', 'wxid_a']); // 3 条 > 2 条
    const b = out.contacts[0];
    expect(b.messages).toHaveLength(3);
    expect(b.skippedCount).toBe(0);
    expect(b.messages.map((m) => m.text)).toEqual(['小李第一条', '小李第二条', '小李第三条']);
    const a = out.contacts[1];
    expect(a.messages.map((m) => m.text)).toEqual(['老王第一条', '老王第二条']);
    expect(a.skippedCount).toBe(1); // 图片归 a 组
  });
});

describe('parseWechatExport JSON', () => {
  it('数组元素带 talker 字段 → 分组；缺字段回落文件名', () => {
    const json = JSON.stringify([
      { talker: 'wxid_a', is_sender: 0, CreateTime: 1700000000, msg: '吃了吗', type: 1 },
      { talker: 'wxid_b', is_sender: 1, CreateTime: 1700000060, msg: '刚吃', type: 1 },
      { is_sender: 0, CreateTime: 1700000100, msg: '你好', type: 1 },
    ]);
    const out = parseWechatExport('backup.json', json);
    expect(out.contacts.map((c) => c.talker).sort()).toEqual(['backup', 'wxid_a', 'wxid_b']);
  });

  it('对象包 messages 数组 + 根 talker（老单聊形态）', () => {
    const json = JSON.stringify({
      talker: 'wxid_k',
      messages: [
        { type_name: '文本', is_sender: '1', CreateTime: '2024-01-02 12:00', msg: '早' },
        { type_name: '动画表情', is_sender: '0', CreateTime: 1700000060, msg: '[表情]' },
      ],
    });
    const g = only('x.json', json);
    expect(g.talker).toBe('wxid_k');
    expect(g.messages).toHaveLength(1);
    expect(g.messages[0].text).toBe('早');
  });

  it('keyed 对象 { wxid: [...] } → 每 key 一位联系人', () => {
    const json = JSON.stringify({
      wxid_a: [{ is_sender: 0, CreateTime: 1700000000, msg: 'A1', type: 1 }],
      wxid_b: [
        { is_sender: 0, CreateTime: 1700000010, msg: 'B1', type: 1 },
        { is_sender: 1, CreateTime: 1700000020, msg: 'B2', type: 1 },
      ],
    });
    const out = parseWechatExport('backup.json', json);
    expect(out.contacts[0].talker).toBe('wxid_b'); // 2 条在前
    expect(out.contacts[0].messages).toHaveLength(2);
    expect(out.contacts[1].talker).toBe('wxid_a');
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
