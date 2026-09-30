// @vitest-environment node
/**
 * 脸谱域 bug 批修回归（2026-10-01 无人值守批：issues 531 互斥配套 + 24 项 bug 清单的数据层部分）：
 * 1. 路径引号：含 % 的路径 win32 拒绝（cmd 双引号内仍做 %VAR% 展开）；--python 命令词不包、
 *    .exe / 带分隔符路径包（防空格路径被 shell 拆碎）；
 * 2. 量化键撞号拒配（sid 经 JSON.parse 尾数有损，双精度大整数量化间距可达千位）：两条语音
 *    撞同一量化 sid → 宁可不配也不配错；wav 精确键与无撞号场景不受影响；
 * 3. 图片关联的 ct 秒级撞键同样拒配；
 * 4. 校对待办排除转写失败占位（失败占位送校对 = 白烧调用 + 盖掉失败标记）。
 * 纯逻辑，无 DOM；数据全构造。
 */
import { describe, it, expect, vi } from 'vitest';
import { quotePathArg, quotePythonArg } from '../../src/people/sync';
import {
  applyVoiceToMsgs,
  applyImageMapToMsgs,
  type StoreMsg,
  type VoiceItem,
  type ImageMapItem,
} from '../../src/people/datasource';
import { pendingVoiceProofread } from '../../src/people/prep';

/** process.platform 嗅探替身（用完 restore） */
function withPlatform(p: NodeJS.Platform, fn: () => void): void {
  const spy = vi.spyOn(process, 'platform', 'get').mockReturnValue(p);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
}

describe('路径引号（sync / export / recording / prep 共源）', () => {
  it('quotePathArg：win32 下含 % 的路径直接拒绝（cmd 双引号内仍展开 %VAR%，路径会被改写）', () => {
    withPlatform('win32', () => {
      expect(() => quotePathArg('D:\\备份%1%2024')).toThrow(/%/);
      expect(quotePathArg('D:\\ plain')).toBe('"D:\\ plain"');
    });
  });

  it('quotePythonArg：命令词形态（py -3）不包引号；带分隔符 / .exe 的路径包引号', () => {
    withPlatform('win32', () => {
      expect(quotePythonArg('py -3')).toBe('py -3');
      expect(quotePythonArg('python3')).toBe('python3');
      expect(quotePythonArg('C:\\Program Files\\python.exe')).toBe('"C:\\Program Files\\python.exe"');
      expect(quotePythonArg('C:\\py\\python.exe')).toBe('"C:\\py\\python.exe"');
    });
  });

  it('quotePythonArg：POSIX 下路径形态走单引号包裹，命令词原样', () => {
    withPlatform('linux', () => {
      expect(quotePythonArg('py -3')).toBe('py -3');
      expect(quotePythonArg('/usr/local/bin/py')).toBe("'/usr/local/bin/py'");
    });
  });

  it('quotePathArg：POSIX 维持单引号 + 内嵌单引号转义（既有口径不回退）', () => {
    withPlatform('linux', () => {
      expect(quotePathArg('/data/微信脸谱 数据')).toBe("'/data/微信脸谱 数据'");
      expect(quotePathArg("/data/O'Brien")).toBe("'/data/O'\\''Brien'");
    });
  });
});

describe('量化键撞号拒配（datasource 靶向升级）', () => {
  // 前置事实：双精度在 2^63 处间距 2048——相距 1023 的两个整数 ID 量化后同值（JSON.parse 有损的根源）
  const SID_A = 2 ** 63;
  const SID_B = SID_A + 1023;
  expect(Number(SID_B)).toBe(SID_A);

  function msg(over: Partial<StoreMsg>): StoreMsg {
    return { key: 'k', ts: 1, isSender: false, type: 34, text: '', ...over } as StoreMsg;
  }

  it('applyVoiceToMsgs：两条语音撞同一量化 sid → 都不配（文本不进错消息），wav 精确键不受影响', () => {
    const voice: VoiceItem[] = [
      { wav: `wxid/voice/a_${SID_A}.wav`, sid: SID_A, dur: 2, text: '甲的转写', emotion: 'neutral' },
      { wav: `wxid/voice/b_${SID_B}.wav`, sid: SID_B, dur: 2, text: '乙的转写', emotion: 'neutral' },
    ];
    const msgs: StoreMsg[] = [msg({ key: 'a', sid: SID_A }), msg({ key: 'b', sid: SID_B })];
    expect(applyVoiceToMsgs(msgs, voice, { previewVoice: true })).toBe(0); // 撞键 = 匹配不可信：拒配
    expect(msgs[0].text).toBe('');
    expect(msgs[1].text).toBe('');

    // wav 键（全路径精确）不受歧义哨兵影响：能精确配上的照常配
    const withWav: StoreMsg[] = [msg({ key: 'a', wav: `wxid/voice/a_${SID_A}.wav` })];
    expect(applyVoiceToMsgs(withWav, voice, { previewVoice: true })).toBe(1);
    expect(withWav[0].text).toContain('甲的转写');
  });

  it('applyVoiceToMsgs：无撞号的正常场景照常配（回归保护：哨兵不误伤）', () => {
    const voice: VoiceItem[] = [
      { wav: 'wxid/voice/a_111.wav', sid: 111, dur: 2, text: '甲', emotion: '' },
      { wav: 'wxid/voice/b_222.wav', sid: 222, dur: 2, text: '乙', emotion: '' },
    ];
    const msgs: StoreMsg[] = [msg({ key: 'a', sid: 111 }), msg({ key: 'b', sid: 222 })];
    expect(applyVoiceToMsgs(msgs, voice, { previewVoice: true })).toBe(2);
    expect(msgs[0].text).toContain('甲');
    expect(msgs[1].text).toContain('乙');
  });

  it('applyImageMapToMsgs：同秒多图（无 sid）撞 ct 键 → 不猜；不同秒照常配', () => {
    const map: ImageMapItem[] = [
      { file: '2024-01/img_a.jpg', ct: 1700000000 },
      { file: '2024-01/img_b.jpg', ct: 1700000000 }, // 同秒：撞键
      { file: '2024-01/img_c.jpg', ct: 1700000060 },
    ];
    const msgs: StoreMsg[] = [
      { key: 'a', ts: 1700000000000, isSender: false, type: 3, text: '[图片]' } as StoreMsg,
      { key: 'b', ts: 1700000060000, isSender: false, type: 3, text: '[图片]' } as StoreMsg,
    ];
    expect(applyImageMapToMsgs(msgs, map)).toBe(1); // 同秒那条不猜，另一条照常
    expect(msgs[0].img).toBeUndefined();
    expect(msgs[1].img).toBe('2024-01/img_c.jpg');
  });
});

describe('校对待办排除失败占位（prep / ADR-0222 口径补漏）', () => {
  it('转写失败占位（<转写失败:…> / emotion=ERR）不进校对待办——白烧调用还会盖掉失败标记', () => {
    const items: VoiceItem[] = [
      { wav: 'a.wav', text: '正常转写', emotion: 'neutral' },
      { wav: 'b.wav', text: '<转写失败:模型炸了>', emotion: 'ERR' },
      { wav: 'c.wav', text: '', emotion: 'ERR' },
      { wav: 'd.wav', text: '已校对过', emotion: 'neutral', proofread: true },
    ];
    expect(pendingVoiceProofread(items).map((v) => v.wav)).toEqual(['a.wav']);
  });
});
