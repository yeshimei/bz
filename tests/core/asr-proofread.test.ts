// @vitest-environment node
/**
 * 转写 LLM 校对模块测试（ADR-0222 / issue 518，src/core/asr-proofread.ts）：
 * 批切分（字数预算/条数上限/空条目透传）、严格 JSON 回解析（围栏/前缀/平衡/坏型拒收）、
 * 编排（编号喂入、批失败重试 1 次、终败全档回退原文、contextNote/onProgress）。
 * chat 打桩走 setProofreadChatCallerForTests，不触网。纯数据层：node 直跑。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  proofreadBatches,
  parseProofreadJson,
  proofreadPieces,
  setProofreadChatCallerForTests,
} from '../../src/core/asr-proofread';

describe('proofreadBatches（批切分：连续条目、字数预算、条数上限、空条目不成批）', () => {
  it('小条目并一批；空条目跳过不打断编号', () => {
    expect(proofreadBatches(['a', 'b', ''])).toEqual([[0, 1]]);
    expect(proofreadBatches(['', 'x'])).toEqual([[1]]);
    expect(proofreadBatches(['', '   '])).toEqual([]); // 全空 → 无批
  });

  it('超字数预算切批；单条超预算自成一批', () => {
    const pieces = ['a'.repeat(3000), 'b'.repeat(1000), 'c'];
    expect(proofreadBatches(pieces)).toEqual([[0], [1, 2]]);
    expect(proofreadBatches(['z'.repeat(9000)])).toEqual([[0]]);
  });

  it('条数上限 16：第 17 条另起一批', () => {
    const pieces = Array.from({ length: 17 }, (_, i) => String(i));
    expect(proofreadBatches(pieces)).toEqual([[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [16]]);
  });
});

describe('parseProofreadJson（严格回解析：剥围栏、取平衡对象、坏型拒收）', () => {
  it('围栏 / 前后缀文本不影响提取', () => {
    expect(parseProofreadJson('```json\n{"items":[{"n":1,"text":"甲"}]}\n```')).toEqual([{ n: 1, text: '甲' }]);
    expect(parseProofreadJson('结果：{"items":[{"n":2,"text":"乙"}]} 完')).toEqual([{ n: 2, text: '乙' }]);
  });

  it('text 内含 } 与引号不破平衡扫描', () => {
    expect(parseProofreadJson('{"items":[{"n":1,"text":"他说}引\\"号"}]}')).toEqual([{ n: 1, text: '他说}引"号' }]);
  });

  it('缺 items / 非整数条号 / 缺 text / 非 JSON → null（批判失败走重试）', () => {
    expect(parseProofreadJson('{"items":[]}')).toEqual([]);
    expect(parseProofreadJson('{"items":[{"n":0,"text":"x"}]}')).toBeNull(); // 条号 1 起
    expect(parseProofreadJson('{"items":[{"n":1}]}')).toBeNull();
    expect(parseProofreadJson('{"items":[{"n":"1","text":"x"}]}')).toBeNull();
    expect(parseProofreadJson('不是JSON')).toBeNull();
  });
});

describe('proofreadPieces（编排：编号喂入、批级重试、原子回退）', () => {
  const chat = vi.fn<(prompt: string) => Promise<string>>();

  beforeEach(() => {
    chat.mockReset();
    setProofreadChatCallerForTests(chat);
  });

  afterEach(() => {
    setProofreadChatCallerForTests(null);
  });

  it('编号提示词 + 逐条回填；空条目透传不进批（批内条号连续，回填按位置映射）', async () => {
    chat.mockResolvedValue('{"items":[{"n":1,"text":"佳能也摔过"},{"n":2,"text":"小电驴"},{"n":3,"text":"原样"}]}');
    const r = await proofreadPieces(['江军也摔过', '小电律', '', '原样']);
    expect(r.failed).toBe(false);
    expect(r.texts).toEqual(['佳能也摔过', '小电驴', '', '原样']);
    const prompt = String(chat.mock.calls[0][0]);
    expect(prompt).toContain('#1|江军也摔过');
    expect(prompt).toContain('#2|小电律');
    expect(prompt).toContain('只修错');
    expect(prompt).toContain('不得改变原意');
  });

  it('回文缺条目 = 批失败；批失败自动重试 1 次，终败全档回退原文（failed=true）', async () => {
    chat.mockResolvedValue('{"items":[{"n":1,"text":"只有一条"}]}'); // 覆盖不全 → 不采纳
    const r1 = await proofreadPieces(['a', 'b']);
    expect(r1.failed).toBe(true);
    expect(r1.texts).toEqual(['a', 'b']); // 原子性：不写半成品
    expect(chat).toHaveBeenCalledTimes(2); // 初试 + 重试 1 次

    chat.mockClear();
    chat.mockRejectedValue(new Error('网络断了'));
    const r2 = await proofreadPieces(['c']);
    expect(r2.failed).toBe(true);
    expect(r2.texts).toEqual(['c']);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('首败重试成：只烧两调用且采纳第二批结果', async () => {
    chat.mockRejectedValueOnce(new Error('闪断')).mockResolvedValueOnce('{"items":[{"n":1,"text":"修好"}]}');
    const r = await proofreadPieces(['错字']);
    expect(r).toEqual({ texts: ['修好'], failed: false });
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('contextNote 进入提示词；onProgress 逐批上报（17 条 = 16 上限切两批）', async () => {
    const pieces = Array.from({ length: 17 }, (_, i) => `条${i + 1}`);
    const batch1 = JSON.stringify(Array.from({ length: 16 }, (_, i) => ({ n: i + 1, text: `校${i + 1}` })));
    chat.mockResolvedValueOnce(`{"items":${batch1}}`);
    chat.mockResolvedValueOnce('{"items":[{"n":1,"text":"校17"}]}'); // 第 2 批只有 1 条，批内条号 1 起
    const seen: Array<[number, number]> = [];
    const r = await proofreadPieces(pieces, {
      contextNote: '双人闲聊',
      onProgress: (done, total) => seen.push([done, total]),
    });
    expect(String(chat.mock.calls[0][0])).toContain('双人闲聊');
    expect(r.failed).toBe(false);
    expect(r.texts[0]).toBe('校1');
    expect(r.texts[16]).toBe('校17');
    expect(seen).toEqual([[1, 2], [2, 2]]);
  });

  it('空回文不吞原文（trim 后为空保留原条）', async () => {
    chat.mockResolvedValue('{"items":[{"n":1,"text":"   "}]}');
    const r = await proofreadPieces(['原话']);
    expect(r).toEqual({ texts: ['原话'], failed: false });
    expect(chat).toHaveBeenCalledTimes(1);
  });
});
