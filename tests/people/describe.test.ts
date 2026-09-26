// @vitest-environment node
/**
 * 图片描述段纯函数测试（issue 470 / ADR-0196 决策 8；spec Testing Decisions 第 2、5 条）：
 * 批切分与上下文窗、回执解析、合并幂等（applyImageDescToMsgs）、断点账本形态、派生档路径。
 * 测试数据全构造，不含真实聊天内容。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  applyImageDescToMsgs,
  type ImageDescItem,
  type StoreMsg,
} from '../../src/people/datasource';
import {
  buildDescribePrompt,
  clampBatchSize,
  contextWindowOf,
  describeBatches,
  describeOf,
  describeOverallPct,
  describeStageLine,
  descImagePath,
  batchSizeFromSettings,
  imageRefsOf,
  newDescribeProgress,
  parseDescribeReply,
  DESCRIBE_CONTEXT_DEFAULTS,
  DESCRIBE_DEFAULT_BATCH_SIZE,
} from '../../src/people/describe';
import { setSettingsProvider } from '../../src/core/settings-provider';

const T0 = Date.UTC(2024, 4, 1, 12, 0, 0);

/** 构造一条仓消息 */
function m(n: number, over: Partial<StoreMsg> = {}): StoreMsg {
  return { key: `k${n}`, ts: T0 + n * 60000, isSender: n % 2 === 1, type: 1, text: `构造消息${n}`, ...over };
}

beforeEach(() => {
  setSettingsProvider(() => ({}) as never);
});

afterEach(() => {
  setSettingsProvider(() => ({}) as never);
});

describe('imageRefsOf 图片集（聊天仓口径）', () => {
  it('只收 type=3 且 img 非空的条目；text 是否非空不影响收集；按 ts 升序', () => {
    const msgs = [
      m(3),
      m(1, { key: 'p2', type: 3, ts: T0 + 1000, img: '2026-05/b.jpg', text: '[图片] 已描述' }),
      m(2, { key: 'p1', type: 3, ts: T0 + 500, img: '2026-05/a.jpg', text: '' }),
      { key: 'x', ts: T0, isSender: true, type: 3, text: '' }, // 无 img：不收
      m(4, { type: 34, dur: 10, text: '' }), // 语音：不收
    ] as StoreMsg[];
    const refs = imageRefsOf(msgs);
    expect(refs.map((r) => r.img)).toEqual(['2026-05/a.jpg', '2026-05/b.jpg']);
    expect(refs.map((r) => r.key)).toEqual(['p1', 'p2']);
  });
});

describe('describeBatches 批切分', () => {
  const refs = Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, ts: T0 + i, img: `m/${i}.jpg` }));

  it('每批 size 张、末批可少；批序即图片序', () => {
    const batches = describeBatches(refs, 2);
    expect(batches.map((b) => b.length)).toEqual([2, 2, 1]);
    expect(batches[0][0].img).toBe('m/0.jpg');
    expect(batches[2][0].img).toBe('m/4.jpg');
  });

  it('非法批大小钳到缺省 20；1 张一批全单开', () => {
    expect(describeBatches(refs, 0).length).toBe(1); // 5 条按钳后的 20 切 = 1 批
    expect(describeBatches(refs, 1).length).toBe(5);
    expect(clampBatchSize(-3)).toBe(20);
    expect(clampBatchSize('35')).toBe(35);
    expect(clampBatchSize(999)).toBe(200);
  });
});

describe('contextWindowOf 上下文窗（1 小时窗 + 6000 字两端裁）', () => {
  const HOUR = 3600_000;
  const imgA = T0 + HOUR; // 首图 13:00
  const imgB = T0 + 2 * HOUR; // 末图 14:00

  it('窗口取首图前 1 小时 ~ 末图后 1 小时；窗外消息不进；行格式 `HH:MM 名：文本`', () => {
    const msgs = [
      m(1, { ts: imgA - HOUR - 1, text: '窗外更早' }), // 差 1ms 出窗
      m(2, { ts: imgA - HOUR + 1, isSender: false, who: '老王', text: '窗内最早' }),
      m(3, { ts: imgA, isSender: true, text: '发图前一句' }),
      m(4, { ts: imgB + HOUR + 1, text: '窗外更晚' }),
    ];
    const out = contextWindowOf(msgs, imgA, imgB);
    expect(out).toContain('窗内最早');
    expect(out).toContain('发图前一句');
    expect(out).not.toContain('窗外更早');
    expect(out).not.toContain('窗外更晚');
    expect(out).toMatch(/^\d{2}:\d{2} 老王：窗内最早/);
    expect(out).toMatch(/\d{2}:\d{2} 我：发图前一句/);
  });

  it('超上限按距图片远近裁两端：最旧的先没、图片跨度内的行最后才动；不超限原样保留', () => {
    // 30 行，每行 ~10 字 → 总长超 6000 不够，改用小上限单测裁剪逻辑
    const msgs = Array.from({ length: 30 }, (_, i) =>
      m(i + 1, { ts: imgA - (30 - i) * 1000, isSender: i % 2 === 0, who: '老王', text: `行${i}0123456789` })
    );
    const full = contextWindowOf(msgs, imgA, imgB);
    expect(full).toContain('行0'); // 不超限（默认 6000 字装得下 30 短行）全保留
    // 收紧上限：最旧的行（距图片最远）先被裁
    const trimmed = contextWindowOf(msgs, imgA, imgB, { maxChars: 200 });
    expect(trimmed).not.toContain('行0');
    expect(trimmed).not.toContain('行1');
    expect(trimmed).toContain(`行${29}`); // 距图片最近（时间上最贴近首图）的行保留
  });

  it('后端裁剪：末图之后的行比前段更远时先裁后端；空窗返回空串', () => {
    const msgs = [
      m(1, { ts: imgA, isSender: true, text: '紧贴首图' }),
      m(2, { ts: imgB + 5 * 60_000, isSender: false, who: '老王', text: '末图后不远' }),
      m(3, { ts: imgB + 59 * 60_000, isSender: false, who: '老王', text: '末图后很远' }),
    ];
    const trimmed = contextWindowOf(msgs, imgA, imgB, { maxChars: 30 });
    expect(trimmed).toContain('紧贴首图');
    expect(trimmed).not.toContain('末图后很远');
    expect(contextWindowOf([], imgA, imgB)).toBe('');
    expect(contextWindowOf([m(1, { text: '' })], imgA, imgB)).toBe(''); // 空文本（未进时间线）不成行
  });

  it('缺省参数 = 1 小时窗 + 6000 字', () => {
    expect(DESCRIBE_CONTEXT_DEFAULTS.windowMs).toBe(3600_000);
    expect(DESCRIBE_CONTEXT_DEFAULTS.maxChars).toBe(6000);
  });
});

describe('parseDescribeReply 回执解析', () => {
  it('标准回执与带围栏 / 前后杂讯的回执都能解析', () => {
    expect(parseDescribeReply('{"descs":["甲","乙"]}', 2)).toEqual(['甲', '乙']);
    expect(parseDescribeReply('好的：```json\n{"descs":["甲"]}\n```', 1)).toEqual(['甲']);
  });

  it('契约不符抛可重试错误：缺 descs / 数量不符', () => {
    expect(() => parseDescribeReply('{"text":"没按契约"}', 1)).toThrow(/descs/);
    expect(() => parseDescribeReply('{"descs":["甲"]}', 2)).toThrow(/数量不符/);
    expect(() => parseDescribeReply('不是 JSON', 1)).toThrow();
  });

  it('空描述保留占位（合并侧跳过），不在这里判死整批', () => {
    expect(parseDescribeReply('{"descs":["甲",""]}', 2)).toEqual(['甲', '']);
  });
});

describe('buildDescribePrompt', () => {
  it('带图片张数硬约束；有上下文时附上下文节，无则不附', () => {
    const p = buildDescribePrompt(3, '12:00 老王：看图');
    expect(p).toContain('等于图片张数 3');
    expect(p).toContain('【对话上下文】');
    expect(p).toContain('12:00 老王：看图');
    expect(buildDescribePrompt(2, '')).not.toContain('【对话上下文】');
  });
});

describe('applyImageDescToMsgs 合并（幂等 / 只补缺 / 最近邻兜底）', () => {
  it('img 精确匹配只升级 text 为空的图片条目；幂等重放零重复；非图片 / 已有条目不动', () => {
    const msgs: StoreMsg[] = [
      m(1),
      m(2, { key: 'p1', type: 3, img: '2026-05/a.jpg', text: '' }),
      m(3, { key: 'p2', type: 3, img: '2026-05/b.jpg', text: '[图片] 旧描述' }),
      m(4, { key: 'p3', type: 3, img: '2026-05/c.jpg', text: '' }),
    ];
    const descs: ImageDescItem[] = [
      { file: '2026-05/a.jpg', ct: Math.round(T0 / 1000), desc: '构造描述甲' },
      { file: '2026-05/b.jpg', ct: Math.round(T0 / 1000), desc: '不应覆盖旧描述' },
    ];
    expect(applyImageDescToMsgs(msgs, descs)).toBe(1);
    expect(msgs[1].text).toBe('[图片] 构造描述甲');
    expect(msgs[2].text).toBe('[图片] 旧描述');
    expect(msgs[3].text).toBe('');
    expect(applyImageDescToMsgs(msgs, descs)).toBe(0); // 幂等
  });

  it('img 没对上的描述走同月 ct 最近邻兜底（±12h、只补缺、一张描述只配一条）；空描述跳过', () => {
    const base = Date.UTC(2024, 4, 1, 0, 0, 0);
    const msgs: StoreMsg[] = [
      { key: 'p1', ts: base, isSender: true, type: 3, text: '' }, // 无 img
      { key: 'p2', ts: base + 60_000, isSender: false, type: 3, text: '' }, // 无 img
    ];
    const descs: ImageDescItem[] = [
      { file: '', ct: Math.round((base + 30_000) / 1000), desc: '最近邻描述' },
      { file: '2026-05/z.jpg', ct: Math.round((base + 3600_000) / 1000), desc: '' }, // 空描述：不进索引
    ];
    expect(applyImageDescToMsgs(msgs, descs)).toBe(1);
    expect(msgs[0].text).toBe('[图片] 最近邻描述');
    expect(msgs[1].text).toBe('');
  });

  it('跳过语义的回归口径：text 保持空串的条目不进时间线，描述来了才升级', () => {
    const msgs: StoreMsg[] = [{ key: 'p1', ts: T0, isSender: true, type: 3, img: '2026-05/a.jpg', text: '' }];
    expect(applyImageDescToMsgs(msgs, [])).toBe(0);
    expect(msgs[0].text).toBe('');
  });
});

describe('断点账本与文案', () => {
  it('newDescribeProgress：totalBatches = ceil(imgCount / batchSize)', () => {
    expect(newDescribeProgress(41, 20)).toEqual({ imgCount: 41, batchSize: 20, totalBatches: 3, doneBatches: 0 });
  });

  it('describeOf 防御归一：坏字段修掉不炸', () => {
    expect(describeOf({})).toBeNull();
    const led = describeOf({ describe: { imgCount: -1, batchSize: 0, totalBatches: NaN, doneBatches: undefined as never } })!;
    expect(led.batchSize).toBe(20);
    expect(led.imgCount).toBe(0);
    expect(led.totalBatches).toBe(0);
    expect(led.doneBatches).toBe(0);
  });

  it('阶段行与段内进度：`图片描述 3/82 批`；total=0 不假报', () => {
    expect(describeStageLine(3, 82)).toBe('图片描述 3/82 批');
    expect(describeOverallPct(41, 82)).toBe(50);
    expect(describeOverallPct(5, 0)).toBe(0);
    expect(describeOverallPct(90, 82)).toBe(100);
  });

  it('batchSizeFromSettings：设置缺省回落 20；非法值回落不炸', () => {
    setSettingsProvider(() => ({ peopleDescBatchSize: 40 }) as never);
    expect(batchSizeFromSettings()).toBe(40);
    setSettingsProvider(() => ({ peopleDescBatchSize: 'abc' }) as never);
    expect(batchSizeFromSettings()).toBe(20);
    setSettingsProvider(() => ({}) as never);
    expect(batchSizeFromSettings()).toBe(20);
  });
});

describe('派生档路径', () => {
  it('descImagePath：`<数据根>/<联系人>/desc/<月>/<名>.jpg`，反斜杠归一', () => {
    expect(descImagePath('D:\\根', 'wxid_a', '2026-05\\p1.jpg')).toBe('D:/根/wxid_a/desc/2026-05/p1.jpg');
  });
});
