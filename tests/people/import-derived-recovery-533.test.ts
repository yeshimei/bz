/**
 * issue 533 事故回归：导入一次增量后，全库图片描述 / 语音转写变成「待转 / 待描述」。
 *
 * 三个成因各自上锁（隐私口径：全部构造数据，不含真实聊天内容）：
 *   1) chat.json 的 `img` **不带扩展名**（`2026-09/<md5>`），image_desc / image_map 的 `file`
 *      **带扩展名**（`2026-09/<md5>.jpg`）——精确比对恒落空 → 840 张图一张都没恢复出描述；
 *   2) chat.json 的语音条只有 `sid`、**没有 wav**（导出工具不写 wav）——按 wav 查 voice.json
 *      恒落空 → 68 条转写全丢；
 *   3) 导入把整份 chat.json 重算一遍再**同键整体覆盖**——归一这一轮没恢复出的空文本，把仓里
 *      已经画好的描述 / 转写抹成了空（这才是「变回待转」的致命一步）。
 *
 * 1 / 2 修在匹配层（词干容错、sid 兜底），3 修在 mergeStore 的非破坏性合并。
 * 另含 prep 侧两张表（image_desc / media_fail）的同款词干容错，与 readContactBundle 分月表补缺。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeChatJson,
  mergeStore,
  applyImageDescToMsgs,
  applyMediaFailToMsgs,
  applySensitiveSkipsToMsgs,
  readContactBundle,
  pendingMediaCounts,
  keyStem,
  type ImageDescItem,
  type MediaFailItem,
  type NormalizeOptions,
  type RawChatMsg,
  type StoreContact,
  type StoreMsg,
  type VoiceItem,
} from '../../src/people/datasource';

const BASE = 1700000000; // 秒级 ct（构造值）
const MONTH = '2026-03';

const opts = (over: Partial<NormalizeOptions> = {}): NormalizeOptions => ({
  previewVoice: true,
  imageDescMode: 'file',
  previewVideo: true,
  keepSystem: true,
  ...over,
});

const raw = (over: Partial<RawChatMsg> & { ct: number }): RawChatMsg => ({
  type: 1,
  who: '对方',
  msg: '构造消息',
  ...over,
});

/** 构造一条图片消息（刻意**不带扩展名**的 img——现实 chat.json 的形态） */
const imgMsg = (ct: number, stem: string, sid: number): RawChatMsg =>
  raw({ ct, type: 3, msg: '[图片]', sid, img: `${MONTH}/${stem}` });

// ---------------- 1) 图片：img 缺扩展名 ↔ image_desc.file 带扩展名 ----------------

describe('归一·图片描述词干容错（issue 533 成因 1）', () => {
  it('keyStem：剥尾段扩展名，保留「月/」前缀；点开头名不作扩展名', () => {
    expect(keyStem('2026-09/abc123.jpg')).toBe('2026-09/abc123');
    expect(keyStem('2026-09/abc123')).toBe('2026-09/abc123');
    expect(keyStem('2026-09\\abc123.PNG')).toBe('2026-09/abc123');
    expect(keyStem('2026-09/.hidden')).toBe('2026-09/.hidden');
  });

  it('img 无扩展名 + desc 带扩展名 → 描述照样恢复（修复前：0/840）', () => {
    const descs: ImageDescItem[] = [{ file: `${MONTH}/aaa.jpg`, ct: BASE, desc: '构造描述甲' }];
    const r = normalizeChatJson([imgMsg(BASE, 'aaa', 11)], opts(), { imageDesc: descs });
    expect(r.msgs[0].text).toBe('[图片] 构造描述甲');
    expect(pendingMediaCounts(r.msgs).images).toBe(0); // 不再算「待描述」
  });

  it('img 带扩展名（与 desc.file 完全一致）→ 精确路径照常命中（不回归）', () => {
    const descs: ImageDescItem[] = [{ file: `${MONTH}/bbb.png`, ct: BASE, desc: '构造描述乙' }];
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 3, msg: '[图片]', sid: 12, img: `${MONTH}/bbb.png` })],
      opts(),
      { imageDesc: descs }
    );
    expect(r.msgs[0].text).toBe('[图片] 构造描述乙');
  });

  it('同词干撞上两条不同描述 → 拒配（宁缺不错，不猜）', () => {
    const descs: ImageDescItem[] = [
      { file: `${MONTH}/ccc.jpg`, ct: BASE, desc: '描述一' },
      { file: `${MONTH}/ccc.png`, ct: BASE + 1, desc: '描述二' },
    ];
    const r = normalizeChatJson([imgMsg(BASE, 'ccc', 13)], opts(), { imageDesc: descs });
    expect(r.msgs[0].text).toBe(''); // 歧义词干拒配，回退空标签
  });

  it('desc 表里没有这个 img 的文件键 → 仍旧空（不借同月邻居；img 在场不走近邻兜底）', () => {
    const descs: ImageDescItem[] = [{ file: `${MONTH}/zzz.jpg`, ct: BASE, desc: '别人的描述' }];
    const r = normalizeChatJson([imgMsg(BASE, 'qqq', 14)], opts(), { imageDesc: descs });
    expect(r.msgs[0].text).toBe('');
    expect(pendingMediaCounts(r.msgs).images).toBe(1);
  });

  it('批量（构造 40 张无扩展名 img）全部恢复——事故面不再复现', () => {
    const raws: RawChatMsg[] = [];
    const descs: ImageDescItem[] = [];
    for (let i = 0; i < 40; i++) {
      const stem = `m${String(i).padStart(3, '0')}`;
      raws.push(imgMsg(BASE + i, stem, 100 + i));
      descs.push({ file: `${MONTH}/${stem}.jpg`, ct: BASE + i, desc: `第 ${i} 张` });
    }
    const r = normalizeChatJson(raws, opts(), { imageDesc: descs });
    expect(r.msgs.every((m) => m.text.startsWith('[图片] 第 '))).toBe(true);
    expect(pendingMediaCounts(r.msgs).images).toBe(0);
  });
});

// ---------------- 2) 语音：chat.json 只有 sid、没有 wav ----------------

describe('归一·语音转写 sid 兜底（issue 533 成因 2）', () => {
  const SID = 3059018396884367000;

  it('只有 sid 没有 wav（现实 chat.json 形态）→ 按 sid 命中 voice.json 恢复转写', () => {
    const voice: VoiceItem[] = [{ sid: SID, dur: 1.6, text: '构造转写内容', emotion: 'NEUTRAL' }];
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 34, msg: '[语音 2秒]', sid: SID, dur: 1.6 })],
      opts(),
      { voice }
    );
    expect(r.msgs[0].text).toBe('[语音 2秒·平静] 构造转写内容');
    expect(pendingMediaCounts(r.msgs).voices).toBe(0);
  });

  it('voice.json 条目没有 sid 字段 → 用 wav 文件名尾段内嵌的 server_id 兜底（issue 515 同款）', () => {
    const voice: VoiceItem[] = [{ wav: '对方/voice/20231123_193052_3059018396884367000.wav', text: '构造转写内容', emotion: 'HAPPY' }];
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 34, msg: '[语音 5秒]', sid: SID, dur: 5 })],
      opts(),
      { voice }
    );
    expect(r.msgs[0].text).toBe('[语音 5秒·开心] 构造转写内容');
  });

  it('转写失败条目（emotion=ERR）不入索引——不把失败占位当正文并进时间线', () => {
    const voice: VoiceItem[] = [{ sid: SID, text: '<转写失败:模型不可用>', emotion: 'ERR' }];
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 34, msg: '[语音 2秒]', sid: SID, dur: 2 })],
      opts(),
      { voice }
    );
    expect(r.msgs[0].text).toBe('');
  });

  it('两条不同转写撞同一量化 sid → 拒配（宁缺不错）', () => {
    const voice: VoiceItem[] = [
      { sid: SID, text: '第一条', emotion: 'NEUTRAL' },
      { sid: SID, text: '第二条', emotion: 'NEUTRAL' },
    ];
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 34, msg: '[语音 2秒]', sid: SID, dur: 2 })],
      opts(),
      { voice }
    );
    expect(r.msgs[0].text).toBe('');
  });

  it('msg 已回填转写（带正文）→ 原样保留，不看 voice.json', () => {
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 34, msg: '[语音 4秒·平静] 源已回填', sid: SID, dur: 4 })],
      opts(),
      { voice: [{ sid: SID, text: '表里的另一份', emotion: 'ANGRY' }] }
    );
    expect(r.msgs[0].text).toBe('[语音 4秒·平静] 源已回填');
  });

  it('previewVoice 关 → 不恢复转写（开关语义不因兜底而失效）', () => {
    const voice: VoiceItem[] = [{ sid: SID, text: '构造转写内容', emotion: 'NEUTRAL' }];
    const r = normalizeChatJson(
      [raw({ ct: BASE, type: 34, msg: '[语音 2秒]', sid: SID, dur: 2 })],
      opts({ previewVoice: false }),
      { voice }
    );
    expect(r.msgs[0].text).toBe('');
  });
});

// ---------------- 3) mergeStore：重导不得抹掉仓里已有的派生文本 ----------------

describe('mergeStore 非破坏性合并（issue 533 成因 3）', () => {
  const imgRaw = (ct: number, stem: string, sid: number): RawChatMsg =>
    raw({ ct, type: 3, msg: '[图片]', sid, img: `${MONTH}/${stem}` });
  const voiceRaw = (ct: number, sid: number): RawChatMsg =>
    raw({ ct, type: 34, msg: '[语音 2秒]', sid, dur: 2 });

  /** 造一个「仓里已有描述 / 转写」的存量仓（模拟描述段与转写并仓后的状态） */
  const storeWithDerived = (): StoreContact => {
    const withDesc = normalizeChatJson([imgRaw(BASE, 'aaa', 21)], opts(), {
      imageDesc: [{ file: `${MONTH}/aaa.jpg`, ct: BASE, desc: '构造描述甲' }],
    });
    const first = mergeStore(undefined, withDesc, '2026-09-25T00:00:00.000Z').contact;
    first.msgs.push({ key: 's222:' + (BASE + 1), ts: (BASE + 1) * 1000, isSender: false, type: 34, sid: 222, dur: 2, text: '[语音 2秒·平静] 构造转写内容' });
    return first;
  };

  it('重导时归一没恢复出描述（旁路表缺）→ 仓里已有描述保留，不被抹空', () => {
    const existing = storeWithDerived();
    // 这一轮 desc 表为空（工具没跑 / 表丢了）：归一给出空文本
    const norm = normalizeChatJson([imgRaw(BASE, 'aaa', 21)], opts(), { imageDesc: [] });
    expect(norm.msgs[0].text).toBe('');
    const { contact } = mergeStore(existing, norm, '2026-09-26T00:00:00.000Z', { previewVoice: true, imageDescMode: 'file' });
    expect(contact.msgs[0].text).toBe('[图片] 构造描述甲'); // 保住了
    expect(pendingMediaCounts(contact.msgs).images).toBe(0);
  });

  it('重导时归一没恢复出转写（voice.json 缺）→ 仓里已有转写保留', () => {
    const existing = storeWithDerived();
    const norm = normalizeChatJson([voiceRaw(BASE + 1, 222)], opts(), { voice: [] });
    expect(norm.msgs[0].text).toBe('');
    const { contact } = mergeStore(existing, norm, '2026-09-26T00:00:00.000Z', { previewVoice: true, imageDescMode: 'file' });
    const v = contact.msgs.find((m) => m.type === 34)!;
    expect(v.text).toBe('[语音 2秒·平静] 构造转写内容');
  });

  it('开关明确关掉（imageDescMode=off / previewVoice=false）→ 照旧清空（用户意图优先）', () => {
    const existing = storeWithDerived();
    const normImg = normalizeChatJson([imgRaw(BASE, 'aaa', 21)], opts({ imageDescMode: 'off' }), { imageDesc: [] });
    const a = mergeStore(existing, normImg, '2026-09-26T00:00:00.000Z', { previewVoice: true, imageDescMode: 'off' });
    expect(a.contact.msgs.find((m) => m.type === 3)!.text).toBe('');

    const normVoice = normalizeChatJson([voiceRaw(BASE + 1, 222)], opts({ previewVoice: false }), { voice: [] });
    const b = mergeStore(existing, normVoice, '2026-09-26T00:00:00.000Z', { previewVoice: false, imageDescMode: 'file' });
    expect(b.contact.msgs.find((m) => m.type === 34)!.text).toBe('');
  });

  it('派生文本升级（空 → 非空）照旧覆盖仓里的空文本', () => {
    const first = mergeStore(undefined, normalizeChatJson([imgRaw(BASE, 'aaa', 21)], opts(), { imageDesc: [] }), '2026-09-25T00:00:00.000Z').contact;
    expect(first.msgs[0].text).toBe('');
    const norm = normalizeChatJson([imgRaw(BASE, 'aaa', 21)], opts(), {
      imageDesc: [{ file: `${MONTH}/aaa.jpg`, ct: BASE, desc: '后补的描述' }],
    });
    const { contact } = mergeStore(first, norm, '2026-09-26T00:00:00.000Z', { previewVoice: true, imageDescMode: 'file' });
    expect(contact.msgs[0].text).toBe('[图片] 后补的描述');
  });

  it('descSkip 终态标注跨重导保留（normalize 从不产出它）', () => {
    const first = mergeStore(undefined, normalizeChatJson([imgRaw(BASE, 'aaa', 21)], opts(), { imageDesc: [] }), '2026-09-25T00:00:00.000Z').contact;
    applySensitiveSkipsToMsgs(first.msgs, [`${MONTH}/aaa`]); // 标注形态：无扩展名词干
    expect(first.msgs[0].descSkip).toBe('sensitive');
    // 重导（含恢复出描述）也不该抹掉终态标注
    const norm = normalizeChatJson([imgRaw(BASE, 'aaa', 21)], opts(), {
      imageDesc: [{ file: `${MONTH}/aaa.jpg`, ct: BASE, desc: '构造描述甲' }],
    });
    const { contact } = mergeStore(first, norm, '2026-09-26T00:00:00.000Z', { previewVoice: true, imageDescMode: 'file' });
    expect(contact.msgs[0].descSkip).toBe('sensitive');
  });

  it('不传 opts（旧调用形态）→ 保持原「整体覆盖」语义（无空文本保护）', () => {
    const existing = storeWithDerived();
    const norm = normalizeChatJson([imgRaw(BASE, 'aaa', 21)], opts(), { imageDesc: [] });
    const { contact } = mergeStore(existing, norm, '2026-09-26T00:00:00.000Z');
    expect(contact.msgs.find((m) => m.type === 3)!.text).toBe('');
  });
});

// ---------------- 4) prep 侧两张表的同款词干容错 ----------------

describe('prep 侧旁路表词干容错（与归一同一匹配口径）', () => {
  it('applyImageDescToMsgs：img 无扩展名 → 命中带扩展名的 desc.file', () => {
    const msgs: StoreMsg[] = [
      { key: 'k1', ts: BASE * 1000, isSender: false, type: 3, sid: 31, img: `${MONTH}/ddd`, text: '' },
    ];
    const n = applyImageDescToMsgs(msgs, [{ file: `${MONTH}/ddd.jpg`, ct: BASE, desc: '构造描述丁' }]);
    expect(n).toBe(1);
    expect(msgs[0].text).toBe('[图片] 构造描述丁');
  });

  it('applyMediaFailToMsgs：img 无扩展名 → broken 终态标注也认得出', () => {
    const msgs: StoreMsg[] = [
      { key: 'k1', ts: BASE * 1000, isSender: false, type: 3, sid: 32, img: `${MONTH}/eee`, text: '' },
    ];
    const items: MediaFailItem[] = [{ file: `${MONTH}/eee.jpg`, ct: BASE, reason: 'broken' }];
    expect(applyMediaFailToMsgs(msgs, items)).toBe(1);
    expect(msgs[0].descSkip).toBe('broken');
  });
});

// ---------------- 5) readContactBundle：分月描述表补聚合表的缺 ----------------

describe('readContactBundle 分月描述表（聚合表可能落后于分月表）', () => {
  const req = createRequire(import.meta.url);
  let dataRoot = '';
  const TALKER = '构造联系人';

  beforeEach(() => {
    (window as unknown as { require?: unknown }).require = req;
    dataRoot = mkdtempSync(join(tmpdir(), 'bz-ds-brand-'));
    mkdirSync(join(dataRoot, TALKER), { recursive: true });
    writeFileSync(join(dataRoot, TALKER, 'chat.json'), JSON.stringify([imgMsg(BASE, 'fff', 41)]));
  });
  afterEach(() => {
    try { rmSync(dataRoot, { recursive: true, force: true }); } catch { /* 临时目录尽力清 */ }
  });

  it('聚合表缺、分月表有的 file → 一并读出（只补聚合表没有的）', () => {
    writeFileSync(join(dataRoot, TALKER, 'image_desc.json'), JSON.stringify([{ file: `${MONTH}/other.jpg`, ct: BASE, desc: '聚合表里的' }]));
    writeFileSync(
      join(dataRoot, TALKER, `image_desc.${MONTH}.json`),
      JSON.stringify([
        { file: `${MONTH}/other.jpg`, ct: BASE, desc: '分月表里同一条（不覆盖聚合表）' },
        { file: `${MONTH}/fff.jpg`, ct: BASE, desc: '只在分月表里的' },
      ])
    );
    const bundle = readContactBundle(dataRoot, TALKER);
    expect(bundle).not.toBeNull();
    const byFile = new Map(bundle!.imageDesc.map((d) => [d.file, d.desc]));
    expect(byFile.get(`${MONTH}/other.jpg`)).toBe('聚合表里的'); // 聚合表权威，不被分月覆盖
    expect(byFile.get(`${MONTH}/fff.jpg`)).toBe('只在分月表里的'); // 分月表补缺
    // 端到端：分月表补的这一条能恢复出描述
    const r = normalizeChatJson(bundle!.raws, opts(), { imageDesc: bundle!.imageDesc });
    expect(r.msgs[0].text).toBe('[图片] 只在分月表里的');
  });

  it('分月表不存在 / 目录不可列 → 不影响主流程（只用聚合表）', () => {
    writeFileSync(join(dataRoot, TALKER, 'image_desc.json'), JSON.stringify([{ file: `${MONTH}/fff.jpg`, ct: BASE, desc: '聚合表里的' }]));
    const bundle = readContactBundle(dataRoot, TALKER);
    expect(bundle!.imageDesc).toHaveLength(1);
  });
});
