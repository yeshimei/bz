// @vitest-environment node
/**
 * 关系阶段 + 自我披露测试（2026-09-20 ADR-0172）。
 * 钉住三件事：①阶段由数据派生（无任何用户可调项）②门槛同时卡分数与时间/次数（防刷分跳级）
 * ③自我披露同日稳定、由她自己的状态合成（不依赖用户输入）。
 */
import { describe, it, expect } from 'vitest';
import {
  relationshipScore, relationshipStage, stageProgress, daysKnownFrom,
  buildSelfDisclosure, describeStageLine, RELATIONSHIP_STAGES,
} from '../../src/smartcat/relationship';

describe('关系阶段派生（ADR-0172）', () => {
  it('全新相遇（默认 trust/attachment 0.5、零互动零天数）→ 初见', () => {
    const st = relationshipStage({ trust: 0.5, attachment: 0.5, interactions: 0, daysKnown: 0 });
    expect(st.id).toBe('stranger');
    expect(st.name).toBe('初见');
  });

  it('高分但互动/天数不够 → 不跳级（门槛是「且」关系，不能靠刷分秒变熟）', () => {
    // 分数 0.51（已过「朋友」的 0.48），但只互动 5 次、相处 2 天 → 连熟人都算不上
    const st = relationshipStage({ trust: 0.75, attachment: 0.7, interactions: 5, daysKnown: 2 });
    expect(relationshipScore({ trust: 0.75, attachment: 0.7, interactions: 5, daysKnown: 2 })).toBeGreaterThan(0.48);
    expect(st.id).toBe('stranger');
  });

  it('长期高信任 + 高互动 + 长时间 → 老友', () => {
    const st = relationshipStage({ trust: 0.85, attachment: 0.8, interactions: 500, daysKnown: 300 });
    expect(st.id).toBe('old_friend');
    expect(st.initiative).toBe(1);
  });

  it('四档中间态各落到正确阶段', () => {
    expect(relationshipStage({ trust: 0.5, attachment: 0.5, interactions: 20, daysKnown: 5 }).id).toBe('acquaintance');
    expect(relationshipStage({ trust: 0.7, attachment: 0.6, interactions: 100, daysKnown: 30 }).id).toBe('friend');
    expect(relationshipStage({ trust: 0.8, attachment: 0.75, interactions: 250, daysKnown: 80 }).id).toBe('close');
  });

  it('分数只增不减（单调）：各档门槛分数递增', () => {
    for (let i = 1; i < RELATIONSHIP_STAGES.length; i++) {
      expect(RELATIONSHIP_STAGES[i].gate.score).toBeGreaterThan(RELATIONSHIP_STAGES[i - 1].gate.score);
      expect(RELATIONSHIP_STAGES[i].gate.interactions).toBeGreaterThanOrEqual(RELATIONSHIP_STAGES[i - 1].gate.interactions);
      expect(RELATIONSHIP_STAGES[i].gate.daysKnown).toBeGreaterThanOrEqual(RELATIONSHIP_STAGES[i - 1].gate.daysKnown);
    }
  });

  it('阶段进度：分数到位但次数没到 → 被更慢的那一项压住（不许显示 100% 却卡着）', () => {
    const p = stageProgress({ trust: 0.85, attachment: 0.8, interactions: 10, daysKnown: 200 });
    expect(p).toBeLessThan(0.5);
    expect(p).toBeGreaterThanOrEqual(0);
  });

  it('已到顶 → 进度 1', () => {
    expect(stageProgress({ trust: 0.85, attachment: 0.85, interactions: 9999, daysKnown: 9999 })).toBe(1);
  });

  it('relationshipScore 有界 [0,1] 且对非法输入兜底', () => {
    expect(relationshipScore({})).toBeGreaterThanOrEqual(0);
    expect(relationshipScore({ trust: 5, attachment: -3, interactions: -10, daysKnown: NaN })).toBeLessThanOrEqual(1);
    expect(relationshipScore({ trust: 5, attachment: -3, interactions: -10, daysKnown: NaN })).toBeGreaterThanOrEqual(0);
  });

  it('daysKnownFrom 取最早一条记忆距今天数；无记忆 → 0', () => {
    const now = Date.now();
    const list = [
      new Date(now - 10 * 86400000).toISOString(),
      new Date(now - 100 * 86400000).toISOString(),
      undefined,
      'not-a-date',
    ];
    expect(daysKnownFrom(list, now)).toBe(100);
    expect(daysKnownFrom([], now)).toBe(0);
    expect(daysKnownFrom([undefined, 'x'], now)).toBe(0);
  });

  it('describeStageLine 说出阶段与相处方式（不是丢一个名词给模型）', () => {
    const line = describeStageLine({ trust: 0.7, attachment: 0.6, interactions: 100, daysKnown: 30 });
    expect(line).toContain('朋友');
    expect(line.length).toBeGreaterThan(10);
  });
});

describe('自我披露（她自己的事，不依赖用户输入）', () => {
  const at = new Date('2026-09-20T15:00:00Z').getTime();

  it('无任何状态 → 空串（调用方自行省略）', () => {
    expect(buildSelfDisclosure({})).toBe('');
  });

  it('同日同输入 → 完全一致（稳定散列，不用随机）', () => {
    const a = buildSelfDisclosure({ pad: { pleasure: 80, arousal: 60, dominance: 55 }, now: at });
    const b = buildSelfDisclosure({ pad: { pleasure: 80, arousal: 60, dominance: 55 }, now: at });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('心情档决定此刻状态文案（低落不说成高兴）', () => {
    const low = buildSelfDisclosure({ pad: { pleasure: 20, arousal: 30, dominance: 30 }, now: at });
    const high = buildSelfDisclosure({ pad: { pleasure: 90, arousal: 70, dominance: 60 }, now: at });
    expect(low).toContain('此刻的状态');
    expect(low).not.toBe(high);
  });

  it('缺席她也在过日子（≥2 天出现「你不在的这几天」）', () => {
    const s = buildSelfDisclosure({ pad: { pleasure: 50, arousal: 50, dominance: 50 }, absenceDays: 3, now: at });
    expect(s).toContain('你不在的这几天');
  });

  it('有待回访的线 → 她惦记着（但不催）', () => {
    const s = buildSelfDisclosure({ pad: { pleasure: 50, arousal: 50, dominance: 50 }, pendingThreads: 2, now: at });
    expect(s).toContain('她惦记着');
  });

  it('天性来自特质（concern 高 → 有她自己的「小心思」行）', () => {
    const s = buildSelfDisclosure({ traits: { concern: 0.5 }, now: at });
    expect(s).toContain('她的心思');
  });

  it('每个时段都有对应活动文案（0-23 全覆盖不落空）', () => {
    for (let h = 0; h < 24; h++) {
      const s = buildSelfDisclosure({ pad: { pleasure: 50, arousal: 50, dominance: 50 }, hour: h, now: at });
      expect(s).toContain('她这边');
    }
  });
});
