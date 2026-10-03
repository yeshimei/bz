/**
 * 漏跑判定与运行统计测试。
 *
 * 判定口径三条（spec D11）：只对声明了节奏的工具判；没有基线就不喊狼；还没到点不算欠。
 * 这三条正是「汇报完成情况」不变成「每天一片红、没人再看」的全部理由，所以逐条钉住。
 */
import { describe, it, expect } from 'vitest';
import {
  decideDue,
  durationText,
  effectiveSchedule,
  isDueToRun,
  judgeDue,
  lastRun,
  missingRequiredParams,
  nextDueAt,
  overviewOf,
  recentRuns,
  recentStrip,
  scheduleFromDraft,
  scheduleSignature,
  successRate,
  terminalRuns,
  timeOf,
  triggerOf,
  type DockSchedInput,
} from '../../src/dock/schedule';
import type { DockRunRecord, DockSchedule } from '../../src/dock/schema';
import { parseSchedule } from '../../src/dock/schema';

/** 造一条终结运行（默认本地时间语义用无时区串，便于按本地日判定） */
function run(p: Partial<DockRunRecord> & { startedAt: string }): DockRunRecord {
  return { runId: p.startedAt, trigger: 'auto', status: 'ok', ...p } as DockRunRecord;
}

/** 本地时刻 */
function local(y: number, mo: number, d: number, h = 0, mi = 0): number {
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

describe('未声明节奏 = 不判', () => {
  it('没有 schedule / on-demand / unknown 一律 none（不猜）', () => {
    expect(judgeDue(undefined, [])).toMatchObject({ state: 'none' });
    expect(judgeDue({ kind: 'on-demand' }, [])).toMatchObject({ state: 'none' });
    expect(judgeDue({ kind: 'unknown' }, [])).toMatchObject({ state: 'none' });
  });

  it('interval 没声明 everyHours → 也算未声明', () => {
    expect(judgeDue({ kind: 'interval' }, [])).toMatchObject({ state: 'none' });
  });
});

describe('daily', () => {
  const now = local(2026, 10, 4, 14, 0); // 10-04 14:00 本地

  it('当天有记录 → ok', () => {
    const runs = [run({ startedAt: '2026-10-04T09:12:00' })];
    expect(judgeDue({ kind: 'daily' }, runs, now)).toMatchObject({ state: 'ok' });
  });

  it('只有昨天的记录 → due', () => {
    const runs = [run({ startedAt: '2026-10-03T09:12:00' })];
    expect(judgeDue({ kind: 'daily' }, runs, now).state).toBe('due');
  });

  it('一条记录都没有 → due（当天该有却一条都没）', () => {
    expect(judgeDue({ kind: 'daily' }, [], now).state).toBe('due');
  });

  it('声明了 hour 且还没到点 → pending（不是欠跑）', () => {
    const early = local(2026, 10, 4, 7, 0);
    const v = judgeDue({ kind: 'daily', hour: 9 }, [], early);
    expect(v.state).toBe('pending');
    expect(v.detail).toContain('09:00');
  });

  it('过了声明时刻仍未跑 → due', () => {
    expect(judgeDue({ kind: 'daily', hour: 9 }, [], local(2026, 10, 4, 10, 0)).state).toBe('due');
  });

  it('running 不算「今天跑过」（它还没结束）', () => {
    const runs = [run({ startedAt: '2026-10-04T09:00:00', status: 'running' })];
    expect(judgeDue({ kind: 'daily' }, runs, now).state).toBe('due');
  });
});

describe('weekly', () => {
  it('声明 weekday：最近一个该星期几之后有记录 → ok', () => {
    const now = local(2026, 10, 4, 12, 0); // 2026-10-04 是周日（getDay=0）
    const runs = [run({ startedAt: '2026-10-04T09:00:00' })];
    expect(judgeDue({ kind: 'weekly', weekday: 0 }, runs, now).state).toBe('ok');
  });

  it('声明 weekday：过了那个点还没跑 → due', () => {
    const now = local(2026, 10, 6, 12, 0); // 周二
    const runs = [run({ startedAt: '2026-09-27T09:00:00' })]; // 上上周日
    expect(judgeDue({ kind: 'weekly', weekday: 0 }, runs, now).state).toBe('due');
  });

  it('未声明 weekday：看最近 7 天窗口', () => {
    const now = local(2026, 10, 4, 12, 0);
    expect(judgeDue({ kind: 'weekly' }, [run({ startedAt: '2026-10-01T09:00:00' })], now).state).toBe('ok');
    expect(judgeDue({ kind: 'weekly' }, [run({ startedAt: '2026-09-20T09:00:00' })], now).state).toBe('due');
  });
});

describe('interval', () => {
  const now = local(2026, 10, 4, 12, 0);

  it('一条记录都没有 → unknown（没有基线就别喊狼）', () => {
    const v = judgeDue({ kind: 'interval', everyHours: 6 }, [], now);
    expect(v.state).toBe('unknown');
  });

  it('间隔内 → ok，超了 → due', () => {
    expect(judgeDue({ kind: 'interval', everyHours: 6 }, [run({ startedAt: '2026-10-04T09:00:00' })], now).state).toBe('ok');
    expect(judgeDue({ kind: 'interval', everyHours: 6 }, [run({ startedAt: '2026-10-04T02:00:00' })], now).state).toBe('due');
  });
});

describe('运行统计', () => {
  const runs: DockRunRecord[] = [
    run({ startedAt: '2026-10-04T10:00:00', status: 'ok' }),
    run({ startedAt: '2026-10-04T09:00:00', status: 'failed' }),
    run({ startedAt: '2026-10-04T08:00:00', status: 'running' }),
    run({ startedAt: '2026-10-04T07:00:00', status: 'ok' }),
    run({ startedAt: '2026-10-04T06:00:00', status: 'stopped' }),
  ];

  it('terminalRuns 排除 running 且按时间倒序', () => {
    const t = terminalRuns(runs);
    expect(t.map((r) => r.status)).toEqual(['ok', 'failed', 'ok', 'stopped']);
    expect(lastRun(runs)!.status).toBe('ok');
  });

  it('recentStrip 新的在右、缺位补 null', () => {
    const strip = recentStrip([run({ startedAt: '2026-10-04T10:00:00', status: 'ok' })], 3);
    expect(strip).toEqual([null, null, 'ok']);
  });

  it('recentRuns 给回整条记录（卡面单格 tooltip 要「哪一次、说了什么」）', () => {
    const cell = recentRuns(
      [run({ startedAt: '2026-10-04T10:00:00', status: 'failed', message: '令牌过期' })],
      3,
    );
    expect(cell.map((r) => (r ? r.status : null))).toEqual([null, null, 'failed']);
    expect(cell[2]!.message).toBe('令牌过期');
    // running 不算「跑过一次」：时间轴上它不该占格（在场运行另有实时区）
    expect(recentRuns([run({ startedAt: '2026-10-04T10:00:00', status: 'running' })], 1)).toEqual([null]);
  });

  it('recentRuns / recentStrip 恒为 n 格（空格本身就是信息）', () => {
    expect(recentRuns([], 7)).toHaveLength(7);
    expect(recentStrip([], 7)).toHaveLength(7);
    const many = Array.from({ length: 12 }, (_, i) => run({ startedAt: `2026-10-0${(i % 9) + 1}T10:00:00` }));
    expect(recentRuns(many, 7)).toHaveLength(7);
  });

  it('successRate 无记录 → null（不假报 0%）', () => {
    expect(successRate([])).toBeNull();
    expect(successRate([run({ startedAt: '2026-10-04T10:00:00', status: 'ok' })])).toBe(1);
    expect(successRate([run({ startedAt: '2026-10-04T10:00:00', status: 'failed' })])).toBe(0);
  });

  it('durationText：durationMs 优先，缺失时按起止现算', () => {
    expect(durationText(run({ startedAt: 'x', durationMs: 500 }))).toBe('500 毫秒');
    expect(durationText(run({ startedAt: '2026-10-04T10:00:00', finishedAt: '2026-10-04T10:00:02' }))).toBe('2.0 秒');
    expect(durationText(run({ startedAt: '2026-10-04T10:00:00' }))).toBe('');
  });

  it('timeOf 认 localNow 的空格格式与 ISO', () => {
    expect(timeOf('2026-10-04 10:00:00')).toBe(local(2026, 10, 4, 10, 0));
    expect(timeOf('2026-10-04T10:00:00')).toBe(local(2026, 10, 4, 10, 0));
    expect(timeOf('garbage')).toBeUndefined();
    expect(timeOf(undefined)).toBeUndefined();
  });
});

describe('nextDueAt：算不出来就 null，绝不编一个到期时间', () => {
  const now = local(2026, 10, 4, 14, 0); // 10-04（周日）14:00

  it('未声明 / on-demand / unknown → null', () => {
    expect(nextDueAt(undefined, [], now)).toBeNull();
    expect(nextDueAt({ kind: 'on-demand' }, [], now)).toBeNull();
    expect(nextDueAt({ kind: 'unknown' }, [], now)).toBeNull();
  });

  it('daily：今天还没到点 → 今天；已过点 → 明天', () => {
    expect(nextDueAt({ kind: 'daily', hour: 20 }, [], now)).toBe(local(2026, 10, 4, 20, 0));
    expect(nextDueAt({ kind: 'daily', hour: 9 }, [], now)).toBe(local(2026, 10, 5, 9, 0));
  });

  it('daily 未声明 hour → 视同零点（与 judgeDue「一过零点就算欠」同一口径）', () => {
    expect(nextDueAt({ kind: 'daily' }, [], now)).toBe(local(2026, 10, 5, 0, 0));
  });

  it('weekly：未声明 weekday → null（没有确定时点可给）', () => {
    expect(nextDueAt({ kind: 'weekly' }, [], now)).toBeNull();
  });

  it('weekly：本周那天的零点已过 → 顺延一周', () => {
    expect(nextDueAt({ kind: 'weekly', weekday: 3 }, [], now)).toBe(local(2026, 10, 7, 0, 0));
    expect(nextDueAt({ kind: 'weekly', weekday: 0 }, [], now)).toBe(local(2026, 10, 11, 0, 0));
  });

  it('interval：缺基线返回 null（不猜）；有基线 = 上次 + 间隔', () => {
    expect(nextDueAt({ kind: 'interval', everyHours: 6 }, [], now)).toBeNull();
    const runs = [run({ startedAt: '2026-10-04T08:00:00' })];
    expect(nextDueAt({ kind: 'interval', everyHours: 6 }, runs, now)).toBe(local(2026, 10, 4, 14, 0));
  });

  it('interval 未声明 everyHours → null', () => {
    const runs = [run({ startedAt: '2026-10-04T08:00:00' })];
    expect(nextDueAt({ kind: 'interval' }, runs, now)).toBeNull();
  });
});

describe('overviewOf：KPI 四格口径', () => {
  const now = local(2026, 10, 4, 14, 0);
  const at = (iso: string, status: DockRunRecord['status'] = 'ok'): DockRunRecord =>
    run({ startedAt: iso, status });

  it('空输入：分母 0、成功率 null（不假报 0%）、无比值可给', () => {
    expect(overviewOf([], now)).toEqual({
      autoDoneToday: 0,
      autoTotal: 0,
      runs7d: 0,
      ok7d: 0,
      rate7d: null,
      alarms: 0,
      alarmHint: null,
      nextDue: null,
    });
  });

  it('今日达标：只算自动化、只算**今天成功**的', () => {
    const o = overviewOf(
      [
        { trigger: 'auto', name: 'a', schedule: undefined, runs: [at('2026-10-04T09:00:00')], overdue: false },
        { trigger: 'auto', name: 'b', schedule: undefined, runs: [at('2026-10-03T09:00:00')], overdue: false },
        { trigger: 'manual', name: 'c', schedule: undefined, runs: [at('2026-10-04T09:00:00')], overdue: false },
      ],
      now,
    );
    expect(o.autoTotal).toBe(2);
    expect(o.autoDoneToday).toBe(1); // b 是昨天的、c 是手动的 —— 都不算
  });

  it('近 7 天成功率：只算终结态，窗口外的记录不计入', () => {
    const o = overviewOf(
      [
        {
          trigger: 'manual',
          name: 'a',
          schedule: undefined,
          overdue: false,
          runs: [at('2026-10-04T09:00:00'), at('2026-10-03T09:00:00', 'failed'), at('2026-09-01T09:00:00', 'failed')],
        },
      ],
      now,
    );
    expect(o.runs7d).toBe(2);
    expect(o.ok7d).toBe(1);
    expect(o.rate7d).toBe(0.5);
  });

  it('待处理 = 欠跑 或 最近一次失败；hint 取第一条', () => {
    const o = overviewOf(
      [
        { trigger: 'auto', name: '相册备份', schedule: undefined, overdue: true, runs: [] },
        {
          trigger: 'auto',
          name: '网络工具',
          schedule: undefined,
          overdue: false,
          runs: [run({ startedAt: '2026-10-04T09:00:00', status: 'failed', error: { kind: 'network' } })],
        },
        { trigger: 'manual', name: '好的', schedule: undefined, overdue: false, runs: [] },
      ],
      now,
    );
    expect(o.alarms).toBe(2);
    expect(o.alarmHint).toEqual({ name: '相册备份', reason: '该跑没跑' });
  });

  it('待处理里「最近一次失败」的原因取可操作的那一类（不是干巴巴的「失败」）', () => {
    const o = overviewOf(
      [
        {
          trigger: 'manual',
          name: '网盘备份',
          schedule: undefined,
          overdue: false,
          runs: [run({ startedAt: '2026-10-04T09:00:00', status: 'failed', error: { kind: 'auth' } })],
        },
      ],
      now,
    );
    expect(o.alarmHint).toEqual({ name: '网盘备份', reason: '认证失效' });
  });

  it('距下次到期：只收还没到的时点，取最近的那个（已逾期的不重复喊）', () => {
    const o = overviewOf(
      [
        { trigger: 'auto', name: '晚的', schedule: { kind: 'daily', hour: 20 }, runs: [], overdue: false },
        { trigger: 'auto', name: '早的', schedule: { kind: 'daily', hour: 18 }, runs: [], overdue: false },
        {
          trigger: 'auto',
          name: '已逾期',
          schedule: { kind: 'interval', everyHours: 1 },
          runs: [run({ startedAt: '2026-10-04T08:00:00' })],
          overdue: true,
        },
      ],
      now,
    );
    expect(o.nextDue).toEqual({ at: local(2026, 10, 4, 18, 0), name: '早的' });
  });
});

/**
 * 「自动化还是手动」的唯一判据。
 * 这一条曾经不是唯一判据 —— 登记表里另有个 trigger 字段，于是卡片标签读登记、详情页读声明，
 * 同一个工具两处说两样。现在只此一处，所以这里把边界钉死。
 */
describe('triggerOf', () => {
  it('声明了要按节奏跑 = 自动化', () => {
    for (const kind of ['daily', 'weekly', 'interval'] as const) {
      expect(triggerOf({ kind })).toBe('auto');
    }
  });

  it('on-demand 是工具明说「你点我才跑」→ 手动；未声明 / unknown 同理', () => {
    expect(triggerOf({ kind: 'on-demand' })).toBe('manual');
    expect(triggerOf({ kind: 'unknown' })).toBe('manual');
    expect(triggerOf(undefined)).toBe('manual');
  });

  it('只声明了 kind 没有细化字段，也算自动化（声明得粗只是判得粗，不是不算）', () => {
    expect(triggerOf({ kind: 'daily' })).toBe('auto'); // 没给 hour
    expect(triggerOf({ kind: 'interval' })).toBe('auto'); // 没给 everyHours
  });
});

// ==================== D1 修订：生效节奏 / 调度判据 / 决策（ADR-0236） ====================

describe('effectiveSchedule —— 覆盖优先，整体替换', () => {
  const declared: DockSchedule = { kind: 'daily', hour: 12 };
  it('没有覆盖 → 用声明那份', () => {
    expect(effectiveSchedule(declared, undefined)).toBe(declared);
  });
  it('有覆盖 → 用覆盖那份（哪怕声明还在）', () => {
    const ov: DockSchedule = { kind: 'interval', everyHours: 6 };
    expect(effectiveSchedule(declared, ov)).toBe(ov);
  });
  it('声明没有、覆盖有 → 用覆盖（手动工具也能被排上节奏）', () => {
    const ov: DockSchedule = { kind: 'weekly', weekday: 1 };
    expect(effectiveSchedule(undefined, ov)).toBe(ov);
  });
  it('两边都没有 → undefined（未声明节奏）', () => {
    expect(effectiveSchedule(undefined, undefined)).toBeUndefined();
  });
});

describe('scheduleSignature —— 只取参与判定的字段，不含 note', () => {
  it('同 kind 同参数 → 同签名（note 不同不影响）', () => {
    expect(scheduleSignature({ kind: 'daily', hour: 12, note: '甲' })).toBe(
      scheduleSignature({ kind: 'daily', hour: 12, note: '乙' }),
    );
  });
  it('参数变了 → 签名变', () => {
    expect(scheduleSignature({ kind: 'daily', hour: 12 })).not.toBe(
      scheduleSignature({ kind: 'daily', hour: 9 }),
    );
  });
  it('未声明 → 空串', () => {
    expect(scheduleSignature(undefined)).toBe('');
  });
});

describe('scheduleFromDraft —— 编辑器草稿 → 覆盖节奏（每个 kind 都要有去处）', () => {
  const p = { hour: 9, weekday: 3, everyHours: 6 };

  it('每个 kind 都映射到同名节奏；参数带过去', () => {
    expect(scheduleFromDraft('daily', p)).toEqual({ kind: 'daily', hour: 9 });
    expect(scheduleFromDraft('weekly', p)).toEqual({ kind: 'weekly', weekday: 3 });
    expect(scheduleFromDraft('interval', p)).toEqual({ kind: 'interval', everyHours: 6 });
  });

  it('inherit → undefined（= 清除覆盖，回落声明默认）', () => {
    expect(scheduleFromDraft('inherit', p)).toBeUndefined();
  });

  // 这条是回归钉：从前漏了 on-demand 分支，它会掉进兜底的 daily ——
  // 于是用户在面板上选「只手动（不自动）」，保存后反而把工具排成了每天自动跑，方向刚好相反。
  it('on-demand → 仍是 on-demand（绝不掉进 daily 兜底）', () => {
    expect(scheduleFromDraft('on-demand', p)).toEqual({ kind: 'on-demand' });
    expect(triggerOf(scheduleFromDraft('on-demand', p))).toBe('manual');
  });

  it('产出能被 parseSchedule 原样接受（编辑器不会造出声明校验不过的节奏）', () => {
    for (const kind of ['daily', 'weekly', 'interval', 'on-demand'] as const) {
      expect(parseSchedule(scheduleFromDraft(kind, p))).toEqual(scheduleFromDraft(kind, p));
    }
  });
});

describe('isDueToRun —— 与告警口径分开：interval 首次要跑', () => {
  const now = local(2026, 10, 4, 15, 0);
  it('未声明 / on-demand / unknown → 永不自动跑', () => {
    expect(isDueToRun(undefined, [], now)).toBe(false);
    expect(isDueToRun({ kind: 'on-demand' }, [], now)).toBe(false);
    expect(isDueToRun({ kind: 'unknown' }, [], now)).toBe(false);
  });
  it('daily 当天还没有记录 → 跑；已有 → 不跑', () => {
    const s: DockSchedule = { kind: 'daily', hour: 12 };
    expect(isDueToRun(s, [], now)).toBe(true);
    expect(isDueToRun(s, [run({ startedAt: '2026-10-04T13:00:00' })], now)).toBe(false);
  });
  it('daily 还没到点（hour 未到）→ 不跑（pending 不是 due）', () => {
    const s: DockSchedule = { kind: 'daily', hour: 20 };
    expect(isDueToRun(s, [], now)).toBe(false);
  });
  it('interval 一条记录都没有 → 跑一次（首次；告警那边是 unknown，这里刻意相反）', () => {
    const s: DockSchedule = { kind: 'interval', everyHours: 6 };
    expect(judgeDue(s, [], now).state).toBe('unknown'); // 告警不喊狼
    expect(isDueToRun(s, [], now)).toBe(true); // 但调度该开工
  });
  it('interval 距上次未超间隔 → 不跑；超了 → 跑', () => {
    const s: DockSchedule = { kind: 'interval', everyHours: 6 };
    expect(isDueToRun(s, [run({ startedAt: '2026-10-04T12:00:00' })], now)).toBe(false); // 3h
    expect(isDueToRun(s, [run({ startedAt: '2026-10-04T06:00:00' })], now)).toBe(true); // 9h
  });
});

describe('missingRequiredParams', () => {
  const params = [
    { key: 'cookie', label: 'Cookie', required: true },
    { key: 'tag', label: '标签', required: false },
    { key: 'deep', label: '深度', required: true },
  ];
  it('必填缺失 / 空串 / 空数组都算缺（返回 label）', () => {
    expect(missingRequiredParams(params, {})).toEqual(['Cookie', '深度']);
    expect(missingRequiredParams(params, { cookie: '', deep: [] })).toEqual(['Cookie', '深度']);
  });
  it('选填缺失不算缺；填齐了不算缺', () => {
    expect(missingRequiredParams(params, { cookie: 'x', deep: 1 })).toEqual([]);
  });
  it('没有 params → 空', () => {
    expect(missingRequiredParams(undefined, {})).toEqual([]);
  });
});

describe('decideDue —— 该跑的按登记顺序，其余给原因', () => {
  const base: DockSchedInput = {
    id: 'a',
    name: 'A',
    enabled: true,
    trusted: true,
    trustStale: false,
    hasRun: true,
    autoKind: true,
    autoOn: true,
    due: true,
    paramsReady: true,
    paused: false,
    cooldown: false,
    running: false,
  };
  const mk = (p: Partial<DockSchedInput>): DockSchedInput => ({ ...base, ...p });

  it('全绿 → 全进 ready，保持输入顺序', () => {
    const d = decideDue([mk({ id: 'a' }), mk({ id: 'b' })]);
    expect(d.ready.map((i) => i.id)).toEqual(['a', 'b']);
    expect(d.skipped).toEqual([]);
  });

  it('硬门槛优先于「到点」：未信任的工具报 untrusted，而不是 not-due', () => {
    const d = decideDue([mk({ id: 'x', trusted: false, due: false })]);
    expect(d.skipped[0].reason).toBe('untrusted');
  });

  it('各原因都能报出来（顺序即优先级）', () => {
    const cases: Array<[Partial<DockSchedInput>, string]> = [
      [{ enabled: false }, 'disabled'],
      [{ trusted: false }, 'untrusted'],
      [{ trustStale: true }, 'trust-stale'],
      [{ hasRun: false }, 'no-run'],
      [{ autoKind: false }, 'not-auto'],
      [{ autoOn: false }, 'auto-off'],
      [{ paramsReady: false }, 'params'],
      [{ paused: true }, 'paused'],
      [{ running: true }, 'running'],
      [{ cooldown: true }, 'cooldown'],
      [{ due: false }, 'not-due'],
    ];
    for (const [patch, reason] of cases) {
      expect(decideDue([mk(patch)]).skipped[0]?.reason).toBe(reason);
    }
  });

  it('混合输入：该跑的在 ready，不跑的带原因', () => {
    const d = decideDue([mk({ id: 'a' }), mk({ id: 'b', due: false }), mk({ id: 'c', paused: true })]);
    expect(d.ready.map((i) => i.id)).toEqual(['a']);
    expect(d.skipped.map((s) => `${s.input.id}:${s.reason}`)).toEqual(['b:not-due', 'c:paused']);
  });

  it('空输入 → 都不跑', () => {
    expect(decideDue([])).toEqual({ ready: [], skipped: [] });
  });
});
