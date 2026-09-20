// @vitest-environment node
/**
 * 数据体检拍板修复批·检查二豁免机制回归（bd-fix-bd-checkup-attach，纯数据层）：
 * - CK1（呈报#50）：可选段/可选字段豁免清单——「功能未用到就不写」的段与字段不再计缺，
 *   报告只报真问题（狼来了降噪）；
 * - 豁免面收窄验证：extra（约定外）与非豁免缺段/缺字段仍照报；
 * - 豁免清单契约：登记键必须确属白名单/约定字段集成员（防手抄幻觉键进豁免单）。
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeItemDrift,
  analyzeSegmentDrift,
  SEGMENT_FIELDS,
  MEMO_ITEM_FIELDS,
  FAVORITES_ITEM_FIELDS,
  POMODORO_HISTORY_FIELDS,
  OPTIONAL_SEGMENTS,
  OPTIONAL_ITEM_FIELDS,
  checkFieldDrift,
} from '../../src/checkup/checks-drift';
import type { App } from 'obsidian';

const DIR = 'CONFIG/STORAGE';

function makeApp(files: Record<string, string>): App {
  return { vault: { files } } as never;
}

describe('CK1 可选段/可选字段豁免（呈报#50）', () => {
  it('pomodoro 缺 archived 可选段 → 不再出「缺少数据段」info；非可选缺段照报', () => {
    // 缺可选段 archived
    const s1 = analyzeSegmentDrift({ version: 1, state: {}, history: [] }, SEGMENT_FIELDS['pomodoro.json'], OPTIONAL_SEGMENTS['pomodoro.json']);
    expect(s1.missing).toEqual([]);
    // 缺非可选段 state 仍计缺（豁免只对登记键）
    const s2 = analyzeSegmentDrift({ version: 1, history: [] }, SEGMENT_FIELDS['pomodoro.json'], OPTIONAL_SEGMENTS['pomodoro.json']);
    expect(s2.missing).toEqual(['state']);
    // extra 判定不受豁免影响
    const s3 = analyzeSegmentDrift({ version: 1, state: {}, history: [], ghost: 1 }, SEGMENT_FIELDS['pomodoro.json'], OPTIONAL_SEGMENTS['pomodoro.json']);
    expect(s3.extra).toEqual(['ghost']);
  });

  it('pomodoro history 缺 task 可选字段 → 不计缺；缺 ts/duration 仍计缺', () => {
    const optional = OPTIONAL_ITEM_FIELDS['pomodoro.json'];
    const s = analyzeItemDrift([{ ts: 1, duration: 25 }], POMODORO_HISTORY_FIELDS, optional);
    expect(s.missing).toEqual({});
    const s2 = analyzeItemDrift([{ duration: 25 }], POMODORO_HISTORY_FIELDS, optional);
    expect(Object.keys(s2.missing)).toEqual(['ts']);
  });

  it('favorites 缺 archived/archivedAt（ADR-0074 未归档条目）→ 不计缺；缺 title 仍计缺', () => {
    const optional = OPTIONAL_ITEM_FIELDS['favorites.json'];
    const item = { id: 'f1', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '', llmConfig: null };
    const s = analyzeItemDrift([item], FAVORITES_ITEM_FIELDS, optional);
    expect(s.missing).toEqual({});
    const s2 = analyzeItemDrift([(() => { const { title: _omit, ...rest } = item as any; return rest; })()], FAVORITES_ITEM_FIELDS, optional);
    expect(Object.keys(s2.missing)).toEqual(['title']);
  });

  it('端到端：旧番茄钟文件（无 archived、history 缺 task）+ 老收藏条目（缺归档字段）→ 检查二零 info 噪音', async () => {
    const files: Record<string, string> = {
      [`${DIR}/pomodoro.json`]: JSON.stringify({
        version: 1,
        state: { phase: 'idle', endTime: null, remaining: 0, paused: false },
        history: [{ ts: 1, duration: 25 }],
      }),
      [`${DIR}/favorites.json`]: JSON.stringify([
        { id: 'f1', tags: [], title: 'T', description: '', pinned: false, url: '', balance: null, balanceCacheTime: null, balanceError: null, linkedNote: null, created: '', type: '', llmConfig: null },
      ]),
    };
    const sec = await checkFieldDrift(makeApp(files));
    const infos = sec!.issues.filter((i) => i.severity === 'info');
    expect(infos).toEqual([]); // 修复前：两条「缺少数据段/缺少常见字段」info 常态化（狼来了）
  });

  it('豁免清单契约：登记键必须是白名单段/约定字段集成员，不得手抄幻觉键', () => {
    for (const [file, opts] of Object.entries(OPTIONAL_SEGMENTS)) {
      for (const k of opts) expect(SEGMENT_FIELDS[file]).toContain(k);
    }
    for (const [file, fields] of Object.entries(OPTIONAL_ITEM_FIELDS)) {
      const known = file === 'favorites.json' ? FAVORITES_ITEM_FIELDS : file === 'pomodoro.json' ? POMODORO_HISTORY_FIELDS : MEMO_ITEM_FIELDS;
      for (const k of fields) expect(known).toContain(k);
    }
  });
});
