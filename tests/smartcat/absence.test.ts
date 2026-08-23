/**
 * 单一缺席状态机测试（ticket 093，086 v4 方向三+七 合并，ADR-0040）：
 * 迁移表全覆盖（normal→missing→reunion 回 normal；24h/N 天边界）+
 * PAD 幅度域 [1.0,1.8] 与 0.5× 共振帽 + 同日不抵消窗口 +
 * selfEvents 环形截断 + lazyAttachment 纯函数（now 注入/缺省容忍）+
 * AbsenceSystem 集成（心跳迁移/在场重逢/落盘）+ MemorySystem 在场钩子 +
 * dashboard 缺席状态卡与读侧依恋视图（UI 测试）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import {
  AbsenceSystem,
  evalAbsenceTick,
  evalAbsencePresence,
  readAbsenceState,
  absencePadDelta,
  resonanceAmplitudeOf,
  pushSelfEvent,
  lazyAttachment,
  daysSincePresence,
  formatSelfEventTime,
  buildAbsenceCard,
  ACTIVE_ABSENCE_PROFILE,
  ABSENCE_PROFILES,
  ABSENCE_RESONANCE_CAP_RATIO,
  ABSENCE_REUNION_WINDOW_MS,
  SELF_EVENTS_CAP,
  ABSENCE_PAD_MIN,
  ABSENCE_PAD_MAX,
} from '../../src/smartcat/absence';
import { defaultSmartCatData, DAY_MS, getSmartcatFilePath } from '../../src/smartcat/data';
import { MoodSystem, emotionResonanceDelta } from '../../src/smartcat/mood';
import { MemorySystem } from '../../src/smartcat/memory';
import { computeDashboardStats, openSmartcatDashboard, closeSmartcatDashboard } from '../../src/smartcat/dashboard';
import type { SmartCatData } from '../../src/smartcat/types';

/** 固定「现在」：整倍数天数便于边界计算 */
const NOW = 1_000_000 * DAY_MS;
/** 出厂 safe 画像的牵挂门槛（3 天） */
const N = ACTIVE_ABSENCE_PROFILE.missingDays;

describe('状态机迁移表（调度心跳 evalAbsenceTick）', () => {
  it('normal：刚在场（不足 N 天）→ 不迁移无事件', () => {
    const r = evalAbsenceTick('normal', NOW - DAY_MS, ACTIVE_ABSENCE_PROFILE, NOW);
    expect(r).toEqual({ next: 'normal', changed: false, event: null });
  });

  it('normal：恰好 N 天（floor 边界）且过 24h 窗口 → missing + miss 事件', () => {
    const r = evalAbsenceTick('normal', NOW - N * DAY_MS, ACTIVE_ABSENCE_PROFILE, NOW);
    expect(r.next).toBe('missing');
    expect(r.changed).toBe(true);
    expect(r.event).toBe('miss');
  });

  it('normal：N 天差 1ms（days=N-1）→ 不迁移（下边界）', () => {
    const r = evalAbsenceTick('normal', NOW - (N * DAY_MS - 1), ACTIVE_ABSENCE_PROFILE, NOW);
    expect(r.changed).toBe(false);
    expect(r.next).toBe('normal');
  });

  it('normal：lastPresenceAt 缺失/非法 → 按 0 天处理不迁移（旧数据缺省容忍）', () => {
    expect(evalAbsenceTick('normal', undefined, ACTIVE_ABSENCE_PROFILE, NOW).changed).toBe(false);
    expect(evalAbsenceTick('normal', 'bad', ACTIVE_ABSENCE_PROFILE, NOW).changed).toBe(false);
  });

  it('normal：时钟回拨（lastPresenceAt 在未来）→ days=0 不迁移', () => {
    const r = evalAbsenceTick('normal', NOW + DAY_MS, ACTIVE_ABSENCE_PROFILE, NOW);
    expect(r.changed).toBe(false);
  });

  it('missing：仍在缺席（≥N 天）→ 保持且不重复发事件（since 不重置）', () => {
    const r = evalAbsenceTick('missing', NOW - (N + 4) * DAY_MS, ACTIVE_ABSENCE_PROFILE, NOW);
    expect(r.next).toBe('missing');
    expect(r.changed).toBe(false);
    expect(r.event).toBeNull();
  });

  it('missing：缺席回落到 N 天内（主动关心等刷新在场）→ 静默自愈回 normal 不补事件（同日不抵消窗口）', () => {
    const r = evalAbsenceTick('missing', NOW - 2 * 60 * 60 * 1000, ACTIVE_ABSENCE_PROFILE, NOW); // 距上次在场 2h <24h
    expect(r.next).toBe('normal');
    expect(r.changed).toBe(true);
    expect(r.event).toBeNull(); // 关键：<24h 窗口绝不补发牵挂（不与随后的重逢喜悦同日抵消）
  });

  it('reunion：距上次在场 <24h → 重逢保持窗口内不评估缺席', () => {
    const r = evalAbsenceTick('reunion', NOW - 2 * 60 * 60 * 1000, ACTIVE_ABSENCE_PROFILE, NOW);
    expect(r.next).toBe('reunion');
    expect(r.changed).toBe(false);
  });

  it('reunion：恰好 24h（上边界）→ 窗口关闭；未再缺席则回 normal', () => {
    const r = evalAbsenceTick('reunion', NOW - ABSENCE_REUNION_WINDOW_MS, ACTIVE_ABSENCE_PROFILE, NOW);
    expect(r.next).toBe('normal');
    expect(r.changed).toBe(true);
    expect(r.event).toBeNull();
  });

  it('reunion：24h 后又缺席 ≥N 天 → 直接迁移 missing 并补发牵挂', () => {
    const r = evalAbsenceTick('reunion', NOW - (N + 1) * DAY_MS, ACTIVE_ABSENCE_PROFILE, NOW);
    expect(r.next).toBe('missing');
    expect(r.event).toBe('miss');
  });
});

describe('状态机迁移表（在场信号 evalAbsencePresence）', () => {
  it('missing + 在场 → reunion 记重逢事件（先补牵挂后重逢的时序分离）', () => {
    expect(evalAbsencePresence('missing')).toEqual({ next: 'reunion', changed: true, event: 'reunion' });
  });

  it('normal/reunion + 在场 → 无操作（重复在场信号不重复计）', () => {
    expect(evalAbsencePresence('normal').changed).toBe(false);
    expect(evalAbsencePresence('reunion').changed).toBe(false);
    expect(evalAbsencePresence('reunion').event).toBeNull();
  });
});

describe('readAbsenceState 容忍（零迁移）', () => {
  it('editingData null / 缺 absenceState / 非法 phase → normal', () => {
    expect(readAbsenceState(null)).toEqual({ phase: 'normal', since: 0 });
    expect(readAbsenceState({})).toEqual({ phase: 'normal', since: 0 });
    expect(readAbsenceState({ absenceState: { phase: 'bogus', since: 'x' } })).toEqual({ phase: 'normal', since: 0 });
  });

  it('合法 missing/reunion 与 since 数值原样读出', () => {
    expect(readAbsenceState({ absenceState: { phase: 'missing', since: 123 } })).toEqual({ phase: 'missing', since: 123 });
    expect(readAbsenceState({ absenceState: { phase: 'reunion', since: 456 } }).phase).toBe('reunion');
  });
});

describe('PAD 幅度域 [1.0,1.8] 与 0.5× 共振帽', () => {
  it('任意输入收敛进幅度域（下限兜底 ≥1.0=updatePad 落盘阈值，上限 ≤1.8 对齐 handleInteraction 最小行量级）', () => {
    expect(absencePadDelta('miss', 0.001)).toBeGreaterThanOrEqual(ABSENCE_PAD_MIN);
    expect(absencePadDelta('reunion', 99999)).toBeLessThanOrEqual(ABSENCE_PAD_MAX);
    expect(absencePadDelta('miss', 99999)).toBe(1.8);
    expect(absencePadDelta('reunion', 0.5)).toBe(1.0);
  });

  it('0.5× 共振帽：中段输入取 0.5×幅度（applyEmotionResonance 同期差量为顶）', () => {
    expect(absencePadDelta('miss', 2.7)).toBeCloseTo(1.35, 10); // 0.5×2.7=1.35 落在域内
    expect(absencePadDelta('miss', 3.0)).toBeCloseTo(1.5, 10);
    // 帽约束恒成立：结果 ≤ max(下限, 0.5×幅度) + ε
    for (const amp of [0.1, 1, 2, 2.7, 3, 10]) {
      expect(absencePadDelta('miss', amp)).toBeLessThanOrEqual(Math.max(ABSENCE_PAD_MIN, ABSENCE_RESONANCE_CAP_RATIO * amp) + 1e-9);
    }
  });

  it('出厂锚点情绪的实际差量：牵挂 lonely→1.05、重逢 happy→1.0（帽压到域下限）', () => {
    const ampMiss = resonanceAmplitudeOf(ACTIVE_ABSENCE_PROFILE.missAnchorEmotion);
    const ampRe = resonanceAmplitudeOf(ACTIVE_ABSENCE_PROFILE.reunionAnchorEmotion);
    // 锚点幅度与 emotionResonanceDelta 三轴绝对值最大者一致（复用同一口径）
    const maxAxis = (e: string) => {
      const d = emotionResonanceDelta(e);
      return Math.max(Math.abs(d.pleasure), Math.abs(d.arousal), Math.abs(d.dominance));
    };
    expect(ampMiss).toBe(maxAxis(ACTIVE_ABSENCE_PROFILE.missAnchorEmotion));
    expect(absencePadDelta('miss', ampMiss)).toBeCloseTo(1.05, 10);
    expect(absencePadDelta('reunion', ampRe)).toBe(1.0); // happy 幅度 1.8 → 0.5×=0.9 < 下限 → 兜底 1.0
  });

  it('MoodSystem 集成：施加的每轴分量都 ≥1.0（updatePad 落盘阈值的可验证效果前提）且带 absence: 原因', async () => {
    const data = defaultSmartCatData();
    const saver = vi.fn<(d: SmartCatData) => Promise<void>>(async () => {});
    const mood = new MoodSystem({} as any, () => data, saver);
    const upd = vi.spyOn(mood, 'updatePad');
    const sys = new AbsenceSystem(() => data, saver, mood);
    data.editingData = { lastPresenceAt: NOW - (N + 1) * DAY_MS };
    await sys.onSchedulerTick(NOW);
    const calls = upd.mock.calls.filter((c) => String(c[2]).startsWith('absence:'));
    expect(calls.length).toBe(3); // pleasure/arousal/dominance 三轴
    for (const [, change, reason] of calls) {
      expect(Math.abs(change as number)).toBeGreaterThanOrEqual(ABSENCE_PAD_MIN);
      expect(Math.abs(change as number)).toBeLessThanOrEqual(ABSENCE_PAD_MAX);
      expect(String(reason)).toMatch(/^absence:(miss|reunion)$/);
    }
    mood.dispose();
  });

  it('画像常量候选存在且互异（安全/焦虑/回避为出厂内部常量，涌现不可配置）', () => {
    expect(Object.keys(ABSENCE_PROFILES).sort()).toEqual(['anxious', 'avoidant', 'safe']);
    expect(new Set(Object.values(ABSENCE_PROFILES).map((p) => p.missingDays)).size).toBe(3);
    expect(ACTIVE_ABSENCE_PROFILE.key).toBe('safe');
    expect(ACTIVE_ABSENCE_PROFILE.missingDays).toBe(3); // 方向三口径：≥3 天无观察
  });
});

describe('selfEvents 环形缓冲', () => {
  it('超限截断 ≤20 条：保最新、顺序保持', () => {
    let events: ReturnType<typeof pushSelfEvent> = [];
    for (let i = 0; i < SELF_EVENTS_CAP + 5; i++) {
      events = pushSelfEvent(events, i % 2 === 0 ? 'miss' : 'reunion', 1000 + i);
    }
    expect(events.length).toBe(SELF_EVENTS_CAP);
    expect(events[0]).toEqual({ type: 'reunion', at: 1005 }); // 前 5 条（1000-1004）被挤出
    expect(events.at(-1)).toEqual({ type: 'miss', at: 1024 });
    for (let i = 1; i < events.length; i++) expect(events[i].at!).toBeGreaterThan(events[i - 1].at!);
  });

  it('容忍非法存量：非数组/坏条目过滤后照常追加（旧数据零迁移）', () => {
    expect(pushSelfEvent('junk' as any, 'miss', 1)).toEqual([{ type: 'miss', at: 1 }]);
    const dirty = [{ type: 'miss', at: 1 }, null, 'x', { type: 'reunion' }, { at: 3 }] as any;
    const out = pushSelfEvent(dirty, 'reunion', 9);
    expect(out).toEqual([{ type: 'miss', at: 1 }, { type: 'reunion', at: 9 }]);
  });
});

describe('lazyAttachment 读侧惰性视图（纯函数）', () => {
  it('lastPresenceAt 缺失/非法 → 原样返回存储基线（缺省容忍，H5 字段出现前视图=存储）', () => {
    expect(lazyAttachment(0.61, undefined, NOW)).toBe(0.61);
    expect(lazyAttachment(0.61, 'bad', NOW)).toBe(0.61);
  });

  it('now 注入可测：半衰期处≈基线一半；两倍半衰期≈四分之一', () => {
    const last = NOW - 14 * DAY_MS;
    expect(lazyAttachment(0.8, last, NOW)).toBeCloseTo(0.4, 3);
    expect(lazyAttachment(0.8, NOW - 28 * DAY_MS, NOW)).toBeCloseTo(0.2, 3);
  });

  it('长别钳地板 0.05；基线低于地板时不抬高（min(base,…))', () => {
    expect(lazyAttachment(0.8, NOW - 365 * DAY_MS, NOW)).toBe(0.05);
    expect(lazyAttachment(0.03, NOW - 365 * DAY_MS, NOW)).toBe(0.03);
  });

  it('时钟回拨（未来 lastPresenceAt）按 0 天返回基线；缺席越久视图单调不增', () => {
    expect(lazyAttachment(0.6, NOW + DAY_MS, NOW)).toBe(0.6);
    let prev = lazyAttachment(0.6, NOW, NOW);
    for (const d of [1, 7, 30, 90].map((x) => x * DAY_MS)) {
      const v = lazyAttachment(0.6, NOW - d, NOW);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });

  it('daysSincePresence 复用 getAbsenceDays 口径（floor 天数）', () => {
    expect(daysSincePresence(NOW - 3 * DAY_MS, NOW)).toBe(3);
    expect(daysSincePresence(undefined, NOW)).toBe(0);
  });
});

describe('formatSelfEventTime 相对时间', () => {
  it('刚刚/分钟/小时/天 分档', () => {
    expect(formatSelfEventTime(NOW - 30 * 1000, NOW)).toBe('刚刚');
    expect(formatSelfEventTime(NOW - 5 * 60 * 1000, NOW)).toBe('5 分钟前');
    expect(formatSelfEventTime(NOW - 3 * 60 * 60 * 1000, NOW)).toBe('3 小时前');
    expect(formatSelfEventTime(NOW - 2 * DAY_MS, NOW)).toBe('2 天前');
  });
});

describe('AbsenceSystem 集成（心跳/在场信号/落盘）', () => {
  function rig(editingData: any = null) {
    const data = defaultSmartCatData();
    if (editingData !== null) data.editingData = editingData;
    const saved: SmartCatData[] = [];
    const saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { saved.push(d); });
    const pad = { updatePad: vi.fn(), }; // 结构化 PadWriter 桩
    const sys = new AbsenceSystem(() => data, saver, pad as any);
    return { data, saver, pad, sys, saved };
  }

  it('心跳：normal→missing 写回 absenceState+selfEvents 并落盘；再次心跳幂等不再写', async () => {
    const { data, saver, pad, sys } = rig({ lastPresenceAt: NOW - (N + 2) * DAY_MS });
    expect(await sys.onSchedulerTick(NOW)).toBe(true);
    expect(data.editingData.absenceState.phase).toBe('missing');
    expect(data.editingData.selfEvents).toEqual([{ type: 'miss', at: NOW }]);
    expect(pad.updatePad).toHaveBeenCalledTimes(3);
    expect(saver).toHaveBeenCalledTimes(1);
    // 幂等：仍缺席 → 无迁移无写盘
    expect(await sys.onSchedulerTick(NOW + 30 * 1000)).toBe(false);
    expect(saver).toHaveBeenCalledTimes(1);
    expect(data.editingData.selfEvents.length).toBe(1);
  });

  it('在场信号：missing→reunion 记重逢事件，愉悦正向差量并落盘；重复信号幂等', async () => {
    const { data, saver, pad, sys } = rig({
      lastPresenceAt: NOW - (N + 1) * DAY_MS,
      absenceState: { phase: 'missing', since: NOW - DAY_MS },
      selfEvents: [{ type: 'miss', at: NOW - DAY_MS }],
    });
    expect(await sys.onPresenceSignal(NOW)).toBe(true);
    expect(data.editingData.absenceState).toEqual({ phase: 'reunion', since: NOW });
    expect(data.editingData.selfEvents.map((e: any) => e.type)).toEqual(['miss', 'reunion']);
    const pleas = pad.updatePad.mock.calls.filter((c) => c[0] === 'pleasure');
    expect(pleas.length).toBe(1);
    expect(pleas[0][1]).toBeGreaterThan(0); // 重逢喜悦为正差量
    expect(saver).toHaveBeenCalledTimes(1);
    // 再次在场（同一重逢窗口内连发消息）→ 幂等不重复计
    expect(await sys.onPresenceSignal(NOW + 5000)).toBe(false);
    expect(data.editingData.selfEvents.length).toBe(2);
    expect(saver).toHaveBeenCalledTimes(1);
    expect(pleas[0][2]).toBe('absence:reunion');
  });

  it('同日不抵消端到端：缺席跨阈值当天即重逢 → 先牵挂后喜悦两账分离，24h 重逢窗口内心跳不再补牵挂', async () => {
    const t0 = NOW; // 上次在场
    const { data, pad, sys, saver } = rig({ lastPresenceAt: t0 });
    // ① 心跳发现缺席 ≥3 天 → 牵挂落账 + 负向差量
    const tCross = t0 + N * DAY_MS;
    expect(await sys.onSchedulerTick(tCross)).toBe(true);
    expect(data.editingData.absenceState.phase).toBe('missing');
    // ② 同一天稍晚用户回来 → 在场信号触发重逢喜悦（正向差量），不与牵挂抵消——各自成账
    //（先模拟生产顺序：sendChatMessage/addObservation 先 touchPresence 刷新在场再发信号）
    const tReturn = tCross + 2 * 60 * 60 * 1000;
    data.editingData.lastPresenceAt = tReturn;
    expect(await sys.onPresenceSignal(tReturn)).toBe(true);
    expect(data.editingData.selfEvents.map((e: any) => e.type)).toEqual(['miss', 'reunion']);
    const signs = pad.updatePad.mock.calls.map((c) => Math.sign(c[1] as number));
    expect(signs).toEqual([-1, 1, -1, 1, 1, 1]); // miss: p-/a+/d-；reunion: 三轴齐升（各自成账不抵消）
    expect(saver).toHaveBeenCalledTimes(2);
    // ③ 重逢窗口内（距在场 <24h）心跳保持 reunion：即使按 t0 起算缺席仍 ≥3 天也不补牵挂
    expect(await sys.onSchedulerTick(tReturn + 60 * 60 * 1000)).toBe(false);
    expect(data.editingData.selfEvents.length).toBe(2);
    expect(pad.updatePad).toHaveBeenCalledTimes(6); // 无新增差量
    // ④ 窗口关闭（≥24h）且未再缺席 → 回 normal（迁移表闭环）
    expect(await sys.onSchedulerTick(t0 + (N + 2) * DAY_MS)).toBe(true);
    expect(data.editingData.absenceState.phase).toBe('normal');
  });

  it('旧数据 editingData=null：心跳不迁移不写盘（缺省初始化即当前时间）', async () => {
    const { data, saver, sys } = rig(null);
    expect(await sys.onSchedulerTick(NOW)).toBe(false);
    expect(data.editingData?.absenceState).toBeUndefined();
    expect(saver).not.toHaveBeenCalled();
  });

  it('无 PadWriter（结构化可选）：迁移照常完成只写数据面', async () => {
    const data = defaultSmartCatData();
    data.editingData = { lastPresenceAt: NOW - (N + 1) * DAY_MS };
    const saver = vi.fn<(d: SmartCatData) => Promise<void>>(async () => {});
    const sys = new AbsenceSystem(() => data, saver, null);
    await sys.onSchedulerTick(NOW);
    expect(data.editingData.absenceState.phase).toBe('missing');
    expect(data.editingData.selfEvents.length).toBe(1);
  });
});

describe('MemorySystem 在场钩子（观察路径 → 缺席状态机触发源）', () => {
  it('addObservation 成功写入后触发 onPresence 钩子一次', async () => {
    let data = defaultSmartCatData();
    const saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
    const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, saver);
    (m as any).ollamaAvailable = false;
    const onPresence = vi.fn();
    m.onPresence = onPresence;
    await m.addObservation('用户说：回来啦', { importance: 0.6, source: 'chat' });
    expect(onPresence).toHaveBeenCalledTimes(1);
  });
});

describe('dashboard 缺席状态卡 + 读侧依恋视图', () => {
  let settings: any;
  function makeApp(fixture: SmartCatData) {
    const vault = new MockVault();
    vault.create(getSmartcatFilePath(), JSON.stringify(fixture));
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => settings);
    return app;
  }

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  });

  afterEach(() => {
    closeSmartcatDashboard();
  });

  it('buildAbsenceCard：牵挂阶段显示天数与自我事件列表（表达先于数值），空态给提示', () => {
    const d = defaultSmartCatData();
    const now = Date.now();
    d.editingData = {
      lastPresenceAt: now - 5 * DAY_MS,
      absenceState: { phase: 'missing', since: now - 2 * DAY_MS },
      selfEvents: [
        { type: 'reunion', at: now - 9 * DAY_MS },
        { type: 'miss', at: now - 2 * DAY_MS },
      ],
    };
    const card = buildAbsenceCard(d, now);
    const text = card.textContent || '';
    expect(text).toContain('缺席状态');
    expect(text).toContain('牵挂中');
    expect(text).toContain('距上次在场 5 天');
    expect(text).toContain('开始牵挂你 · 2 天前'); // 事件直接呈现（表达先于数值）
    expect(text.indexOf('你回来了')).toBeGreaterThan(-1);

    const empty = buildAbsenceCard(defaultSmartCatData(), now);
    expect(empty.textContent || '').toContain('最近没有分离与重逢');
  });

  it('openSmartcatDashboard 总览页渲染缺席状态卡（UI）', async () => {
    const d = defaultSmartCatData();
    const now = Date.now();
    d.editingData = {
      lastPresenceAt: now - 5 * DAY_MS,
      absenceState: { phase: 'missing', since: now - 2 * DAY_MS },
      selfEvents: [{ type: 'miss', at: now - 2 * DAY_MS }],
    };
    const vaultFile = getSmartcatFilePath();
    const app = makeApp(d);
    await openSmartcatDashboard(app);
    const body = document.body.textContent || '';
    expect(body).toContain('缺席状态');
    expect(body).toContain('牵挂中 · 距上次在场 5 天');
    expect(body).toContain('开始牵挂你 · 2 天前');
  }, 20000);

  it('computeDashboardStats 依恋走惰性视图：分离 28 天（两个半衰期）0.61→≈0.15，只影响读取不改存储', () => {
    const d = defaultSmartCatData();
    const now = Date.now();
    d.personalityGrowth.relationship.attachment = 0.61;
    d.editingData = { lastPresenceAt: now - 28 * DAY_MS };
    const st = computeDashboardStats(d);
    expect(st.attachment).toBeCloseTo(0.1525, 3);
    expect(d.personalityGrowth.relationship.attachment).toBe(0.61); // 存储基线不漂移
    // 旧数据（无 lastPresenceAt）视图=存储
    const legacy = defaultSmartCatData();
    legacy.personalityGrowth.relationship.attachment = 0.61;
    expect(computeDashboardStats(legacy).attachment).toBeCloseTo(0.61, 6);
  });
});