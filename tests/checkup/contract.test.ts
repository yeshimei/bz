// @vitest-environment node
/**
 * 数据体检 × 域写侧形状单源契约锁（深审 G1 / arch S-1 定案：单点集中式）。
 *
 * checkup 是契约的消费者——SEGMENT_FIELDS 段白名单、条目字段集与各域**真实写盘形状**
 * 在这里逐域恒等锁定，任何一侧漂移即红。根治「白名单手抄快照追尾巴」模式：
 * func P2-1（clipbook 漏 4 段）/ P2-2（news 漏 2 键）/ P2-4（belongings 多列 2 派生段）
 * 正是从「全绿 fixture 按白名单手写而非域真实写盘形状」的盲区漏进来的。
 *
 * 新增域数据文件的三个接入动作同址完成：
 *   1. src/checkup/files.ts jsonScanTargets 补行；
 *   2. src/checkup/checks-drift.ts SEGMENT_FIELDS 补行；
 *   3. 本文件补契约锁行。
 * 可选键口径（func P3-6 拍板解耦）：契约断言 required ⊆ keys ⊆ required ∪ optional，
 * SEGMENT_FIELDS 保持 string[] 不改生产类型。
 */
import { describe, it, expect } from 'vitest';
import { SEGMENT_FIELDS, MEMO_ITEM_FIELDS, FAVORITES_ITEM_FIELDS } from '../../src/checkup/checks-drift';
import { jsonScanTargets } from '../../src/checkup/files';
import { emptySidecar } from '../../src/clipbook/data';
import { emptyData } from '../../src/clipbook/news-data';
import { emptyHomeOrder, HOME_ORDER_VERSION } from '../../src/home/order';
import { belongingsSaveShape } from '../../src/belongings/data';
import { emptyQuiz } from '../../src/review/quiz-core/manager';
import { defaultPomodoroData } from '../../src/pomodoro/data';
import { normalizeItem } from '../../src/memo/data';
import { normalizeItems } from '../../src/favorites/data';

const sorted = (a: string[]): string[] => [...a].sort();

/** 段白名单 × 域写侧形状单源恒等（required 键集逐域锁定） */
describe('段级契约：SEGMENT_FIELDS × 域写侧形状', () => {
  it('clipbook.json = emptySidecar() 7 段（func P2-1：marks/savedImages/pendingSource/readLog 不得再漏）', () => {
    expect(sorted(SEGMENT_FIELDS['clipbook.json'])).toEqual(sorted(Object.keys(emptySidecar())));
    expect(SEGMENT_FIELDS['clipbook.json']).toHaveLength(7);
  });

  it('news.json = emptyData() 10 键（func P2-2：lastFetchAt/fetchIntervalMin 不得再漏）', () => {
    expect(sorted(SEGMENT_FIELDS['news.json'])).toEqual(sorted(Object.keys(emptyData())));
  });

  it('home.json = emptyHomeOrder() v3 五键（home 批 1d26c797 交接）', () => {
    expect(sorted(SEGMENT_FIELDS['home.json'])).toEqual(sorted(Object.keys(emptyHomeOrder())));
    expect(HOME_ORDER_VERSION).toBe(3);
  });

  it('belongings.json = belongingsSaveShape 落盘 3 键（func P2-4/A1：categories/categoryIcons 为内存派生段，不落盘不入白名单）', () => {
    const shape = belongingsSaveShape({ version: '1.0', items: {} });
    expect(sorted(SEGMENT_FIELDS['belongings.json'])).toEqual(sorted(Object.keys(shape)));
    expect(SEGMENT_FIELDS['belongings.json']).toHaveLength(3);
  });

  it('quiz.json = emptyQuiz() 键集', () => {
    expect(sorted(SEGMENT_FIELDS['quiz.json'])).toEqual(sorted(Object.keys(emptyQuiz())));
  });

  it('pomodoro.json：required ⊆ keys ⊆ required ∪ optional（archived 为 issue 357 可选段，PA-1 契约）', () => {
    const whitelist = SEGMENT_FIELDS['pomodoro.json'];
    const required = Object.keys(defaultPomodoroData()); // 落盘最小形状（无归档省 archived 键）
    for (const k of required) expect(whitelist).toContain(k);
    // 可选段：白名单多出的键必须确属「写侧条件展开」的可选键，不得是手抄幻觉
    const optional = whitelist.filter((k) => !required.includes(k));
    expect(optional).toEqual(['archived']);
    expect(required.length + optional.length).toBe(whitelist.length);
  });

  it('白名单只登记落盘文件：无手抄幻觉文件名', () => {
    const targets = jsonScanTargets({ vault: { getAbstractFileByPath: () => null } } as never);
    const targetNames = targets.map((t) => t.file.split('/').pop() || t.file);
    for (const name of Object.keys(SEGMENT_FIELDS)) {
      expect(targetNames).toContain(name);
    }
  });

  it('脸谱域豁免（issue 467 / ADR-0194）：明文三件退役、保库记录不进明文巡检——未解锁跳过脸谱不报错', () => {
    const targets = jsonScanTargets({ vault: { getAbstractFileByPath: () => null } } as never);
    const targetNames = targets.map((t) => t.file.split('/').pop() || t.file);
    // 明文时代的脸谱数据文件不再巡检（已迁移删除；残留检查归迁移侧，不归体检）
    for (const name of ['people.json', 'people-preview.json', 'people-jobs.json']) {
      expect(targetNames).not.toContain(name);
    }
    // 密文域整体豁免（与 .safe.enc 同边界）：保库记录条目在 .safe.enc 清单里，未解锁本就读不到
    for (const t of targets) {
      expect(t.file).not.toContain('.ENCRYPT');
    }
  });
});

/** 条目级契约：字段集 × 域归一函数恒等（升格原「仅长度断言」为逐键） */
describe('条目级契约：字段集 × 域归一产物', () => {
  it('MEMO_ITEM_FIELDS = normalizeItem 产物键集（14 字段逐键；CONTEXT「14→16 已同步」失真随回滚后以此为真值锚）', () => {
    const normalized = normalizeItem({ id: 'x' }) as unknown as Record<string, unknown>;
    expect(sorted(Object.keys(normalized))).toEqual(sorted(MEMO_ITEM_FIELDS));
    expect(MEMO_ITEM_FIELDS).toHaveLength(14);
  });

  it('FAVORITES_ITEM_FIELDS ⊇ normalizeItems 产物键集（透传语义：样本全字段时不允许多键少键）', () => {
    const full = {
      id: 'f1', tags: ['a'], title: 'T', description: '', pinned: false, url: '', balance: null,
      balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '',
      llmConfig: null, archived: false, archivedAt: null,
    };
    const out = normalizeItems([full])[0] as unknown as Record<string, unknown>;
    expect(sorted(Object.keys(out))).toEqual(sorted(FAVORITES_ITEM_FIELDS));
    expect(FAVORITES_ITEM_FIELDS).toHaveLength(15);
  });
});

/** 扫描清单完备性契约（func P3-3 + arch 补维-2）：宣称「全部域数据 json」的面不得再漏 */
describe('扫描清单契约：jsonScanTargets', () => {
  it('含 lock-stats.json / smartcat-memory.json / smartcat-behavior.json（ADR-0124 / ADR-0069 sidecar）', () => {
    const targets = jsonScanTargets({ vault: { getAbstractFileByPath: () => null } } as never);
    const names = targets.map((t) => t.file.split('/').pop() || t.file);
    expect(names).toContain('lock-stats.json');
    expect(names).toContain('smartcat-memory.json');
    expect(names).toContain('smartcat-behavior.json');
  });

  it('豁免边界在案：encrypt 密文 manifest 与 secondbrain.vec 不入清单（头注释登记）', () => {
    const targets = jsonScanTargets({ vault: { getAbstractFileByPath: () => null } } as never);
    const names = targets.map((t) => t.file.split('/').pop() || t.file);
    expect(names).not.toContain('secondbrain.vec');
    expect(targets.every((t) => !t.file.includes('.ENCRYPT'))).toBe(true);
  });
});
