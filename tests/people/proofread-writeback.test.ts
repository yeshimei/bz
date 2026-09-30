// @vitest-environment node
/**
 * 转写 LLM 校对写回测试（ADR-0222 / issue 518）：插件把校对结果写回工具侧产物的两条通道——
 *   1. prep 语音旁路表 voice.json（pendingVoiceProofread 选条 + writeVoiceSidecarRaw 写回，
 *      `proofread` 标记随条目落盘、空文本条目永不入列）；
 *   2. 录音账本 .turns.json（writeRecordingTurnsProofread 在**原始 JSON** 上就地替换轮次 text +
 *      顶层标记：snake_case 字段零触碰、条数对不上不写、写后 sidecar 缓存失效）。
 * fs 全部内存假件注入，不碰真实数据根。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  pendingVoiceProofread,
  readPrepSidecars,
  setPrepFsForTests,
  writeVoiceSidecarRaw,
} from '../../src/people/prep';
import type { VoiceItem } from '../../src/people/datasource';
import {
  readRecordingSidecar,
  recordingSidecarPath,
  resetRecordingSidecarCacheForTests,
  setRecordingFsForTests,
  writeRecordingTurnsProofread,
} from '../../src/people/recording';

describe('voice.json 校对写回（ADR-0222）', () => {
  const files = new Map<string, string>();
  const norm = (p: string) => p.replace(/\\/g, '/');
  const fs = {
    readText: (p: string) => files.get(norm(p)) ?? null,
    writeText: (p: string, c: string) => void files.set(norm(p), c),
    unlink: (p: string) => void files.delete(norm(p)),
  };

  beforeEach(() => {
    files.clear();
    setPrepFsForTests(fs as any);
  });

  afterEach(() => setPrepFsForTests(null));

  it('待校条目 = 有文本且无标记；空文本条目不入列', () => {
    files.set('D:/root/某人/voice.json', JSON.stringify([
      { wav: 'a.wav', sid: 1, dur: 2, text: '江军也摔过' },
      { wav: 'b.wav', sid: 2, dur: 3, text: '' },
      { wav: 'c.wav', sid: 3, dur: 4, text: '已校', proofread: true },
    ]));
    const items = readPrepSidecars('D:/root', '某人')!.voice;
    expect(pendingVoiceProofread(items).map((v) => v.wav)).toEqual(['a.wav']);
  });

  it('写回往返：文本替换 + proofread 标记落盘，重读不再待校', () => {
    files.set('D:/root/某人/voice.json', JSON.stringify([
      { wav: 'a.wav', sid: 1, dur: 2, text: '江军也摔过', emotion: '平静' },
    ]));
    const items = readPrepSidecars('D:/root', '某人')!.voice;
    items[0].text = '佳能也摔过';
    items[0].proofread = true;
    expect(writeVoiceSidecarRaw('D:/root', '某人', items)).toBe(true);

    const reread = readPrepSidecars('D:/root', '某人')!.voice;
    expect(reread[0]).toMatchObject({ wav: 'a.wav', text: '佳能也摔过', proofread: true, emotion: '平静' });
    expect(pendingVoiceProofread(reread)).toEqual([]);
  });

  it('旁路表缺失 → 读 null、写 false（不抛）', () => {
    expect(readPrepSidecars('D:/root', '无表')).toBeNull();
    expect(writeVoiceSidecarRaw('D:/root', '无表', [])).toBe(false);
  });
});

describe('.turns.json 校对写回（ADR-0222）', () => {
  const files = new Map<string, string>();
  const fs2 = {
    readFileSync: (p: string) => {
      const v = files.get(p);
      if (v === undefined) throw new Error('ENOENT');
      return v;
    },
    writeFileSync: (p: string, c: string) => void files.set(p, c),
    statSync: (p: string) => ({ mtimeMs: 1, ctimeMs: 1, size: (files.get(p) ?? '').length }),
  };

  beforeEach(() => {
    files.clear();
    setRecordingFsForTests(fs2 as any);
    resetRecordingSidecarCacheForTests();
  });

  afterEach(() => {
    setRecordingFsForTests(null);
    resetRecordingSidecarCacheForTests();
  });

  it('就地替换有文本轮次 + 顶层标记；snake_case 字段零触碰；缓存失效重读可见', () => {
    const p = recordingSidecarPath('D:/root', '某人', 'rec.m4a');
    files.set(p, JSON.stringify({
      phase: 'done',
      duration_sec: 4950.5,
      mode: 'dual',
      turns: [
        { start: 0, end: 3, speaker: '我', text: '江军也摔过', emotion: '伤心', mean_abs_llr: 0.21 },
        { start: 3, end: 5, speaker: '某人', text: '' },
        { start: 5, end: 9, speaker: '某人', text: '小电律速度太快', emotion: '平静' },
      ],
    }));
    expect(writeRecordingTurnsProofread('D:/root', '某人', 'rec.m4a', ['佳能也摔过', '小电驴速度太快'])).toBe(true);

    const raw = JSON.parse(files.get(p)!);
    expect(raw.proofread).toBe(true); // 顶层标记
    expect(raw.duration_sec).toBe(4950.5); // snake_case 保真（工具续跑还要读）
    expect(raw.turns[0]).toMatchObject({ text: '佳能也摔过', mean_abs_llr: 0.21 });
    expect(raw.turns[1].text).toBe(''); // 空文本轮次不动
    expect(raw.turns[2].text).toBe('小电驴速度太快');

    const side = readRecordingSidecar('D:/root', '某人', 'rec.m4a')!; // 写后缓存已失效 → 读到新值
    expect(side.proofread).toBe(true);
    expect(side.turns![0].text).toBe('佳能也摔过');
  });

  it('条数对不上（账本被工具重写）→ 不写返回 false；账本缺失同样 false', () => {
    const p = recordingSidecarPath('D:/root', '某人', 'rec2.m4a');
    files.set(p, JSON.stringify({ phase: 'done', turns: [{ start: 0, end: 1, speaker: '我', text: '只有一条' }] }));
    expect(writeRecordingTurnsProofread('D:/root', '某人', 'rec2.m4a', ['a', 'b'])).toBe(false);
    expect(JSON.parse(files.get(p)!).proofread).toBeUndefined(); // 原样未动
    expect(writeRecordingTurnsProofread('D:/root', '某人', '缺账本.m4a', ['a'])).toBe(false);
  });
});

describe('校对写回原子性（bug 批修回归：tmp + rename，与脚本 os.replace 同口径）', () => {
  it('voice.json：fs 带 rename → 走 tmp 中转落盘，正式路径内容完整、tmp 清掉', () => {
    const files = new Map<string, string>();
    const renames: Array<[string, string]> = [];
    const norm = (x: string): string => x.split('\\').join('/');
    const fs = {
      readText: (p: string) => files.get(norm(p)) ?? null,
      writeText: (p: string, c: string) => void files.set(norm(p), c),
      exists: (p: string) => files.has(norm(p)),
      unlink: (p: string) => void files.delete(norm(p)),
      rename: (a: string, b: string) => {
        renames.push([norm(a), norm(b)]);
        files.set(norm(b), files.get(norm(a))!);
        files.delete(norm(a));
      },
    };
    setPrepFsForTests(fs as any);
    try {
      const items: VoiceItem[] = [{ wav: 'a.wav', sid: 1, dur: 2, text: '校对稿', emotion: '平静', proofread: true }];
      expect(writeVoiceSidecarRaw('D:/root', '某人', items)).toBe(true);
      const target = 'D:/root/某人/voice.json';
      expect(files.has(target)).toBe(true);
      expect(JSON.parse(files.get(target)!)[0].text).toBe('校对稿');
      expect(renames.length).toBe(1);
      expect(renames[0][0]).toBe(`${target}.proofread.tmp`); // 先写中转
      expect(renames[0][1]).toBe(target); // 再原子换名
      expect(files.has(`${target}.proofread.tmp`)).toBe(false); // 中转不残留
    } finally {
      setPrepFsForTests(null);
    }
  });

  it('.turns.json：fs 带 renameSync → 走 tmp 中转；rename 失败返回 false 且正式路径不被半截覆盖', () => {
    const files = new Map<string, string>();
    const sidecar = recordingSidecarPath('D:/root', '某人', 'rec.m4a');
    files.set(sidecar, JSON.stringify({ phase: 'done', turns: [{ start: 0, end: 1, speaker: '我', text: '原话' }] }));
    const fs2 = {
      readFileSync: (p: string) => {
        const v = files.get(p);
        if (v === undefined) throw new Error('ENOENT');
        return v;
      },
      writeFileSync: (p: string, c: string) => {
        if (String(p).endsWith('.tmp')) throw new Error('ENOSPC: 模拟盘满');
        void files.set(p, c);
      },
      renameSync: () => {},
      statSync: (p: string) => ({ mtimeMs: 1, ctimeMs: 1, size: (files.get(p) ?? '').length }),
      unlinkSync: (p: string) => void files.delete(p),
    };
    setRecordingFsForTests(fs2 as any);
    resetRecordingSidecarCacheForTests();
    try {
      // tmp 都写不进去 → 整体失败返回 false，正式 sidecar 原文还在（不半截覆盖）
      expect(writeRecordingTurnsProofread('D:/root', '某人', 'rec.m4a', ['新话'])).toBe(false);
      expect(JSON.parse(files.get(sidecar)!).turns[0].text).toBe('原话');
    } finally {
      setRecordingFsForTests(null);
      resetRecordingSidecarCacheForTests();
    }
  });
});
