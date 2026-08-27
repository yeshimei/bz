/**
 * 心情门控测试（ticket 095，086 v4 方向四「限范围修：输出维度换」，ADR-0042）：
 * 窗口多数采样判定（含边界样本数/最小间隔去重）+ 趋势漂移驱动 quietMode 状态机
 * （进入/退出/静默超时兜底）+ 温和话术子集映射（任意臂都落在子集）+
 * 每日温和问候豁免（不计计数不领 reward，端到端）+ loadMoodState 接线
 * （新鲜读取 / 24h 陈旧归中性 / 无数据缺省）+ ensure 装配钩子冒烟。
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import {
  QuietGateSystem,
  evalQuietEnter,
  evalQuietExit,
  evalQuietTransition,
  readQuietMode,
  pushGateSample,
  gentlePhraseFor,
  gentleStyleFor,
  gentleGreeting,
  gentleGreetingAvailable,
  localDayKey,
  proactiveMinGapMs,
  GENTLE_ARMS,
  GENTLE_TEMPLATES_BY_ARM,
  GENTLE_STYLE_BY_ARM,
  GENTLE_GREETINGS,
  GENTLE_STYLE_FALLBACK,
  QUIET_VALENCE_THRESHOLD,
  QUIET_WINDOW_SAMPLES,
  QUIET_MIN_SAMPLES,
  QUIET_EXIT_WINDOW_SAMPLES,
} from '../../src/smartcat/quiet-gate';
import { defaultSmartCatData, DAY_MS } from '../../src/smartcat/data';
import { MoodSystem } from '../../src/smartcat/mood';
import { ensureSmartCat, unloadSmartCat, maybeProactiveCare, __getSmartcatInternals } from '../../src/smartcat/index';
import { eventSystem } from '../../src/smartcat/state';
import { EVENTS } from '../../src/smartcat/types';
import { isoWeekKey } from '../../src/smartcat/rhythm';
import type { SmartCatData } from '../../src/smartcat/types';
import type { GateSample } from '../../src/smartcat/quiet-gate';

/** 固定「现在」（整倍数天数便于边界计算） */
const NOW = 1_000_000 * DAY_MS;
const GAP = 11 * 60 * 1000; // 超过采样最小间隔（10min）的推进步长

const s = (t: number, v: number): GateSample => ({ t, v });

// ---------------- 持久化读容忍 ----------------

describe('readQuietMode 容忍（零迁移）', () => {
  it('editingData null / 缺 quietMode / 非法字段 → off', () => {
    expect(readQuietMode(null)).toEqual({ on: false, since: 0 });
    expect(readQuietMode({})).toEqual({ on: false, since: 0 });
    expect(readQuietMode({ quietMode: { on: 'yes', since: 'x' } })).toEqual({ on: false, since: 0 });
  });

  it('合法状态原样读出', () => {
    expect(readQuietMode({ quietMode: { on: true, since: 123 } })).toEqual({ on: true, since: 123 });
  });
});

// ---------------- 窗口采样（设计 3：最小间隔去重 + 保尾截断） ----------------

describe('pushGateSample 窗口采样', () => {
  it('最小间隔内丢弃（60s tick 克隆去重），恰好间隔即追加', () => {
    let win = pushGateSample([], -0.5, NOW);
    win = pushGateSample(win, -0.5, NOW + 10 * 60 * 1000 - 1);
    expect(win.length).toBe(1); // 差 1ms 不足间隔 → 丢弃
    win = pushGateSample(win, -0.4, NOW + 10 * 60 * 1000);
    expect(win.length).toBe(2);
    expect(win[1]).toEqual({ t: NOW + 10 * 60 * 1000, v: -0.4 });
  });

  it(`保尾截断 ≤ ${QUIET_WINDOW_SAMPLES} 条`, () => {
    let win: GateSample[] = [];
    for (let i = 0; i < QUIET_WINDOW_SAMPLES + 3; i++) win = pushGateSample(win, -0.5, NOW + i * GAP);
    expect(win.length).toBe(QUIET_WINDOW_SAMPLES);
    expect(win[0].t).toBe(NOW + 3 * GAP); // 前 3 条被挤出
  });

  it('容忍非法存量：非数组/坏条目过滤后照常追加（旧数据零迁移）', () => {
    expect(pushGateSample('junk' as any, -0.5, NOW)).toEqual([{ t: NOW, v: -0.5 }]);
    const dirty = [{ t: 1, v: 0 }, null, 'x', { t: 'bad' }, { v: 2 }] as any;
    const out = pushGateSample(dirty, -0.5, NOW + GAP);
    expect(out).toEqual([{ t: 1, v: 0 }, { t: NOW + GAP, v: -0.5 }]);
  });
});

// ---------------- 多数表决（含边界样本数，防抖动） ----------------

describe('evalQuietEnter / evalQuietExit 多数表决', () => {
  it(`样本不足 ${QUIET_MIN_SAMPLES} 条一律不判（0/1/2 条即使全低也不进）`, () => {
    expect(evalQuietEnter([])).toBe(false);
    expect(evalQuietEnter([s(1, -0.9)])).toBe(false);
    expect(evalQuietEnter([s(1, -0.9), s(2, -0.9)])).toBe(false);
    expect(evalQuietExit([s(1, 0.8), s(2, 0.8)])).toBe(false);
  });

  it('enter：最近窗口低采样严格多数才进（2/3 低 → 进；1/3 低 → 不进）', () => {
    expect(evalQuietEnter([s(1, -0.5), s(2, -0.6), s(3, 0.8)])).toBe(true);
    expect(evalQuietEnter([s(1, 0.8), s(2, -0.6), s(3, 0.7)])).toBe(false);
  });

  it('enter：5 条窗口 3 低 2 高 → 进；2 低 3 高 → 不进', () => {
    expect(evalQuietEnter([s(1, -0.5), s(2, 0.8), s(3, -0.6), s(4, 0.9), s(5, -0.4)])).toBe(true);
    expect(evalQuietEnter([s(1, -0.5), s(2, 0.8), s(3, 0.7), s(4, 0.9), s(5, -0.4)])).toBe(false);
  });

  it(`阈值边界：valence == ${QUIET_VALENCE_THRESHOLD} 不算低（严格小于）`, () => {
    // 2 低 + 1 个恰在阈值 → 只有 2/3 低 → 进；若阈值算低则 3/3——用不进断言严格性
    expect(evalQuietEnter([s(1, -0.5), s(2, QUIET_VALENCE_THRESHOLD), s(3, -0.4)])).toBe(true);
    expect(evalQuietEnter([s(1, QUIET_VALENCE_THRESHOLD), s(2, QUIET_VALENCE_THRESHOLD), s(3, 0.9)])).toBe(false);
  });

  it(`exit：最近 ${QUIET_EXIT_WINDOW_SAMPLES} 条非低严格多数（≥2/3）才出`, () => {
    expect(evalQuietExit([s(1, 0.8), s(2, 0.7), s(3, -0.9)])).toBe(true);
    expect(evalQuietExit([s(1, 0.8), s(2, -0.7), s(3, -0.9)])).toBe(false);
  });

  it('exit 只看最近 3 条：更早的低采样不影响转好判定', () => {
    expect(evalQuietExit([s(1, -0.9), s(2, -0.9), s(3, 0.8), s(4, 0.7), s(5, 0.9)])).toBe(true);
  });
});

// ---------------- 状态机迁移表（趋势驱动 + 静默超时兜底，设计 5+6） ----------------

describe('evalQuietTransition 状态机', () => {
  it('off + 窗口低多数 → enter（since=now）', () => {
    const r = evalQuietTransition({ on: false, since: 0 }, [s(1, -0.5), s(2, -0.6), s(3, -0.4)], NOW);
    expect(r).toEqual({ next: { on: true, since: NOW }, changed: true, reason: 'enter' });
  });

  it('off + 样本不足 → 不变幂等（无数据缺省不动）', () => {
    const st = { on: false, since: 0 };
    expect(evalQuietTransition(st, [s(1, -0.5)], NOW)).toEqual({ next: st, changed: false, reason: null });
  });

  it('on + 窗口高多数 → exit（趋势转好退出）', () => {
    const r = evalQuietTransition({ on: true, since: NOW - DAY_MS }, [s(1, 0.8), s(2, 0.7), s(3, 0.9)], NOW);
    expect(r.changed).toBe(true);
    expect(r.reason).toBe('exit');
    expect(r.next.on).toBe(false);
  });

  it('on + 仍低多数 → 保持（幂等不落盘）；since 不重置', () => {
    const st = { on: true, since: NOW - DAY_MS };
    expect(evalQuietTransition(st, [s(1, -0.5), s(2, -0.6), s(3, -0.4)], NOW)).toEqual({ next: st, changed: false, reason: null });
  });

  it('静默超时兜底：quietMode 持续恰 48h → 强制退出；差 1ms 且无高多数 → 保持', () => {
    const at48h = evalQuietTransition({ on: true, since: NOW - 48 * 60 * 60 * 1000 }, [s(1, -0.5), s(2, -0.6), s(3, -0.4)], NOW);
    expect(at48h.changed).toBe(true);
    expect(at48h.reason).toBe('timeout');
    const before = evalQuietTransition({ on: true, since: NOW - 48 * 60 * 60 * 1000 + 1 }, [s(1, -0.5), s(2, -0.6), s(3, -0.4)], NOW);
    expect(before.changed).toBe(false);
  });

  it('高多数与超时同时满足 → reason=exit（趋势驱动优先于兜底）', () => {
    const r = evalQuietTransition({ on: true, since: NOW - 72 * 60 * 60 * 1000 }, [s(1, 0.8), s(2, 0.7), s(3, 0.9)], NOW);
    expect(r.reason).toBe('exit');
  });
});

// ---------------- 间隔口径与打扰总量守恒的间距基础（设计 1+7） ----------------

describe('proactiveMinGapMs 间隔口径', () => {
  it('非平静维持既有 2 天；平静期 3~4 天（默认 3.5）', () => {
    expect(proactiveMinGapMs(false)).toBe(2 * DAY_MS);
    const quiet = proactiveMinGapMs(true);
    expect(quiet).toBeGreaterThanOrEqual(3 * DAY_MS);
    expect(quiet).toBeLessThanOrEqual(4 * DAY_MS);
  });
});

// ---------------- 温和话术子集映射（设计 1：任意臂都落在子集） ----------------

describe('温和话术子集映射', () => {
  it('平静期选中任意臂都落在该臂温和子集内', () => {
    for (const arm of GENTLE_ARMS) {
      for (const rng of [() => 0, () => 0.999]) {
        const phrase = gentlePhraseFor(arm, rng);
        expect(GENTLE_TEMPLATES_BY_ARM[arm]).toContain(phrase);
      }
    }
  });

  it('未知臂回退兜底且恒有产出（正常流不会走到）', () => {
    expect(gentlePhraseFor('unknown-arm')).toBe(GENTLE_GREETINGS[0]);
  });

  it('臂 → 温和风格指令映射；未知臂回通用温和', () => {
    for (const arm of GENTLE_ARMS) expect(gentleStyleFor(arm)).toBe(GENTLE_STYLE_BY_ARM[arm]);
    expect(gentleStyleFor('nope')).toBe(GENTLE_STYLE_FALLBACK);
  });

  it('每日温和问候语料抽取恒落在池内（rng 注入可测）', () => {
    expect(GENTLE_GREETINGS.some((g) => g.includes('今天还好吗'))).toBe(true); // 提案点名话术
    for (const rng of [() => 0, () => 0.5, () => 0.999]) {
      expect(GENTLE_GREETINGS).toContain(gentleGreeting(rng));
    }
  });
});

// ---------------- 每日 1 次日键（本地日历日） ----------------

describe('localDayKey 与温和问候可用性', () => {
  it('日键为本地时区 YYYY-MM-DD', () => {
    const d = new Date(2026, 7, 24, 9, 30);
    expect(localDayKey(d.getTime())).toBe('2026-08-24');
  });

  it('当日已问候不可再问；昨日登记今日可问；无登记可问', () => {
    const now = new Date(2026, 7, 24, 15, 0).getTime();
    expect(gentleGreetingAvailable(undefined, now)).toBe(true);
    expect(gentleGreetingAvailable({}, now)).toBe(true);
    expect(gentleGreetingAvailable({ gentleGreeting: { day: '2026-08-24' } }, now)).toBe(false);
    expect(gentleGreetingAvailable({ gentleGreeting: { day: '2026-08-23' } }, now)).toBe(true);
  });
});

// ---------------- loadMoodState 接线（设计 4：新鲜读取 / 陈旧归中性 / 无数据缺省） ----------------

describe('loadMoodState 接线（ticket 095 设计 4）', () => {
  let data: SmartCatData;
  function make() {
    data = defaultSmartCatData();
    const saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
    return new MoodSystem({} as any, () => data, saver);
  }

  it('新鲜读取：lastUpdate 在 24h 内合并持久化 PAD', () => {
    const m = make();
    data.mood.pad = { pleasure: 42, arousal: 40, dominance: 45 };
    data.mood.lastUpdate = Date.now() - 2 * 60 * 60 * 1000;
    m.loadMoodState();
    expect(m.pad.pleasure).toBe(42);
  });

  it('恰好 24h 边界（<24h 才合并）→ 归中性', () => {
    const m = make();
    data.mood.pad = { pleasure: 42, arousal: 40, dominance: 45 };
    data.mood.lastUpdate = Date.now() - 24 * 60 * 60 * 1000;
    m.loadMoodState();
    expect(m.pad).toEqual(MoodSystem.NEUTRAL_PAD);
  });

  it('24h 陈旧归中性基线（防重启假情绪）', () => {
    const m = make();
    data.mood.pad = { pleasure: 10, arousal: 90, dominance: 30 };
    data.mood.lastUpdate = Date.now() - 25 * 60 * 60 * 1000;
    m.loadMoodState();
    expect(m.pad).toEqual({ pleasure: 50, arousal: 50, dominance: 50 });
  });

  it('无数据缺省：lastUpdate 缺失/非法（旧数据零字段）→ 中性', () => {
    const m1 = make();
    data.mood.lastUpdate = 0;
    m1.loadMoodState();
    expect(m1.pad).toEqual(MoodSystem.NEUTRAL_PAD);
    const m2 = make();
    (data.mood as any).lastUpdate = 'bad';
    m2.loadMoodState();
    expect(m2.pad).toEqual(MoodSystem.NEUTRAL_PAD);
  });
});

// ---------------- QuietGateSystem 集成（心跳采样/迁移落盘/幂等/缓存趋势） ----------------

describe('QuietGateSystem 集成', () => {
  function rig(editingData: any = null) {
    const data = defaultSmartCatData();
    if (editingData !== null) data.editingData = editingData;
    const saved: SmartCatData[] = [];
    const saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { saved.push(d); });
    const sys = new QuietGateSystem(() => data, saver);
    return { data, saver, sys, saved };
  }

  it('无趋势输入（null）不采样不判定不落盘', async () => {
    const { sys, saver } = rig();
    expect(await sys.onHeartbeat(null, NOW)).toBe(false);
    expect(await sys.onDecayTick(NOW)).toBe(false);
    expect(sys.__samplesForTests().length).toBe(0);
    expect(saver).not.toHaveBeenCalled();
  });

  it('心跳喂低值序列：第 3 条达多数 → enter 写回 editingData.quietMode 并落盘；此后幂等', async () => {
    const { data, saver, sys } = rig();
    expect(await sys.onHeartbeat(-0.5, NOW)).toBe(false);
    expect(await sys.onHeartbeat(-0.6, NOW + GAP)).toBe(false);
    expect(await sys.onHeartbeat(-0.4, NOW + 2 * GAP)).toBe(true); // 3 低 → enter
    expect(data.editingData.quietMode).toEqual({ on: true, since: NOW + 2 * GAP });
    expect(saver).toHaveBeenCalledTimes(1);
    expect(await sys.onHeartbeat(-0.5, NOW + 3 * GAP)).toBe(false); // 仍低 → 保持幂等
    expect(saver).toHaveBeenCalledTimes(1);
  });

  it('趋势漂移转好：进入后连续高值，尾窗非低达多数（2/3）→ exit 落盘回 off', async () => {
    const { data, sys } = rig();
    for (let i = 0; i < 3; i++) await sys.onHeartbeat(-0.5, NOW + i * GAP); // 3 低 → enter
    expect(data.editingData.quietMode?.on).toBe(true);
    // 第 1 条非低：尾窗 [低,低,高] 非低 1/3 → 不退出
    expect(await sys.onHeartbeat(0.8, NOW + 3 * GAP)).toBe(false);
    // 第 2 条非低：尾窗 [低,高,高] 非低 2/3 → exit
    expect(await sys.onHeartbeat(0.7, NOW + 4 * GAP)).toBe(true);
    expect(data.editingData.quietMode?.on).toBe(false);
  });

  it('采样最小间隔跨源生效：心跳后 1 分钟的衰减 tick 采样被丢弃', async () => {
    const { sys } = rig();
    await sys.onHeartbeat(-0.5, NOW);
    await sys.onDecayTick(NOW + 60 * 1000);
    expect(sys.__samplesForTests().length).toBe(1);
    await sys.onDecayTick(NOW + GAP);
    expect(sys.__samplesForTests().length).toBe(2);
  });

  it('onDecayTick 复用缓存趋势值补采样（60s 循环不现算趋势）', async () => {
    const { data, sys } = rig();
    await sys.onHeartbeat(-0.5, NOW);
    await sys.onDecayTick(NOW + GAP);
    expect(sys.__samplesForTests()[1].v).toBe(-0.5);
    // 继续衰减 tick 凑满 3 低 → 迁移照常发生
    await sys.onDecayTick(NOW + 2 * GAP);
    expect(data.editingData.quietMode).toEqual({ on: true, since: NOW + 2 * GAP });
  });

  it('静默超时自动退出兜底：预置 on 超 48h，一条中性采样即 timeout 退出', async () => {
    const { data, saver, sys } = rig({ quietMode: { on: true, since: NOW - 49 * 60 * 60 * 1000 } });
    expect(await sys.onHeartbeat(0.1, NOW)).toBe(true);
    expect(data.editingData.quietMode.on).toBe(false);
    expect(saver).toHaveBeenCalledTimes(1);
  });

  it('isQuiet 读持久化态（装配外安全）', async () => {
    const { data, sys } = rig({ quietMode: { on: true, since: NOW } });
    expect(sys.isQuiet()).toBe(true);
    data.editingData = { ...(data.editingData || {}), quietMode: { on: false, since: NOW } };
    expect(sys.isQuiet()).toBe(false);
  });

  it('预置 on + 高值序列 → exit 而非误判 enter（持久化状态参与判定）', async () => {
    const { data, sys } = rig({ quietMode: { on: true, since: NOW - DAY_MS } });
    expect(await sys.onHeartbeat(0.8, NOW)).toBe(false);
    expect(await sys.onHeartbeat(0.7, NOW + GAP)).toBe(false);
    expect(await sys.onHeartbeat(0.9, NOW + 2 * GAP)).toBe(true);
    expect(data.editingData.quietMode.on).toBe(false);
  });
});

// ---------------- ensure 装配接线 + 豁免分支端到端 ----------------

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true };

function makeApp() {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {});
  return { app, vault };
}

/** 当前小时附近的观察条目（作息画像必命中当前小时活跃，主动闸门放行） */
function mkStream(): any[] {
  return [0, 1, 2, 3, 4].map((i) => ({
    id: `o${i}`,
    created: new Date(Date.now() - i * 60 * 1000).toISOString(),
    lastAccessed: new Date().toISOString(),
    description: `观察${i}`,
    importance: 0.5,
    type: 'observation',
  }));
}

describe('ensure 装配接线（钩子 + 单 json 持久化）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true };
    unloadSmartCat();
  });
  afterEach(() => { unloadSmartCat(); });

  it('装配后 quietGate 就位、60s 衰减钩子已挂；心跳迁移直接写进 internals.data', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const internals = __getSmartcatInternals();
    expect(internals.quietGateSystem).toBeTruthy();
    expect(typeof internals.moodSystem.onDecayTick).toBe('function');
    const gate = internals.quietGateSystem as QuietGateSystem;
    expect(await gate.onHeartbeat(-0.5, Date.now())).toBe(false);
    expect(await gate.onHeartbeat(-0.6, Date.now() + GAP)).toBe(false);
    expect(await gate.onHeartbeat(-0.4, Date.now() + 2 * GAP)).toBe(true);
    expect((internals.data.editingData || {}).quietMode.on).toBe(true);
    unloadSmartCat();
    expect(__getSmartcatInternals().quietGateSystem).toBeNull();
  });
});

describe('每日温和问候豁免端到端（不计计数、不领 reward、总量守恒）', () => {
  const bubbles: string[] = [];
  // 只挂 BUBBLE_QUEUED（showBubble 每次调用恰发一次；BUBBLE_SHOWN 会与打字机重复计数）
  beforeAll(() => {
    eventSystem.on(EVENTS.BUBBLE_QUEUED, (d: any) => bubbles.push(d?.message ?? ''));
  });
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true };
    unloadSmartCat();
    bubbles.length = 0;
  });
  afterEach(() => { unloadSmartCat(); });

  async function setupCalm(overrides: { count?: number; daysAgo?: number; quiet?: boolean } = {}) {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d: any = __getSmartcatInternals().data;
    d.memory.memoryStream = mkStream();
    d.editingData = {
      ...(d.editingData || {}),
      quietMode: { on: overrides.quiet !== false, since: Date.now() - 3600 * 1000 },
      proactiveCare: {
        week: isoWeekKey(),
        count: overrides.count ?? 2,
        lastAt: Date.now() - (overrides.daysAgo ?? 4) * DAY_MS,
      },
    };
    return d;
  }

  it('安静期 + 周上限已满：仍发每日温和问候，count 不动、pendingArm 不标、登记当日日键', async () => {
    const d = await setupCalm({ count: 2, daysAgo: 4 });
    await maybeProactiveCare();
    expect(bubbles.length).toBe(1);
    expect(GENTLE_GREETINGS).toContain(bubbles[0]); // 温和问候语料（豁免分支）
    expect(d.editingData.proactiveCare.count).toBe(2); // 豁免不计 proactive 计数（周上限已满仍可发）
    expect(d.editingData.ceBandit?.pendingArm).toBeUndefined(); // 不标 pendingArm → 不领 reward
    expect(d.editingData.gentleGreeting.day).toBe(localDayKey(Date.now()));
    expect(d.editingData.proactiveCare.lastAt).toBeGreaterThan(Date.now() - 60 * 1000); // 占槽顺延下次 Bandit 主动
    // 同日第二次调度 → 不再问（每日 1 次），周上限也已满 → 全静默
    bubbles.length = 0;
    await maybeProactiveCare();
    expect(bubbles.length).toBe(0);
  });

  it('安静期间隔未到（3 天 < 3~4 天新口径）：Bandit 主动与温和问候都不发', async () => {
    const d = await setupCalm({ count: 0, daysAgo: 3 });
    await maybeProactiveCare();
    expect(bubbles.length).toBe(0); // 旧 2 天口径会发，新 3.5 天口径不发
    expect(d.editingData.proactiveCare.count).toBe(0);
    expect(d.editingData.gentleGreeting).toBeUndefined();
  });

  it('非安静期同状态（3 天 > 2 天旧口径）：走正常 Bandit 计数路径并标记 pendingArm', async () => {
    const d = await setupCalm({ count: 0, daysAgo: 3, quiet: false });
    await maybeProactiveCare();
    expect(bubbles.length).toBe(1); // 正常主动关心发出（AI 未配置 → 模板兜底池）
    expect(GENTLE_GREETINGS).not.toContain(bubbles[0]); // 非温和问候豁免语料
    expect(d.editingData.proactiveCare.count).toBe(1); // 正常计数 +1
    expect(typeof d.editingData.ceBandit?.pendingArm).toBe('string'); // reward 回填管线挂起
  });
});