/**
 * smartcat prompt 生成覆盖率补测：字数乘数（traits 推导/互动权重/消息长度/PAD 因子）、
 * PAD 心情因子四阈值、性格描述全分支合成、心情详情/亮点/emoji 分档、
 * 主 prompt 组装各段拼装与防御性 catch（异常 traits 回落 180）。
 * 基础 prompt 冒烟见 companion-context.test.ts。
 */
import { describe, it, expect } from 'vitest';
import {
  calculateMaxWordLimit, calculateMoodFactor, getCharacterDescription,
  generatePrompt, formatMoodDetails, getMoodHighlights, getMoodEmoji,
  getResponseRequirements,
} from '../../src/smartcat/prompts';
import { defaultPersonalityGrowth } from '../../src/smartcat/data';
import type { CharacterTraits } from '../../src/smartcat/types';

/** 抛错 traits Proxy：任何属性访问都炸（验证 calculateMaxWordLimit 的防御性 catch） */
const evilTraits = new Proxy({}, { get() { throw new Error('boom'); } });

const pad = (p: number, a: number, d: number) => ({ pleasure: p, arousal: a, dominance: d });

describe('calculateMoodFactor（PAD 四阈值）', () => {
  it('全部中性 → 1.0', () => {
    expect(calculateMoodFactor(pad(55, 50, 50))).toBeCloseTo(1.0);
  });

  it('愉悦 >70 ×1.1；愉悦 <30 ×0.9', () => {
    expect(calculateMoodFactor(pad(80, 50, 50))).toBeCloseTo(1.1);
    expect(calculateMoodFactor(pad(20, 50, 50))).toBeCloseTo(0.9);
    expect(calculateMoodFactor(pad(70, 50, 50))).toBeCloseTo(1.0); // 边界不触发
  });

  it('唤醒 <30 ×0.9；支配 >70 ×1.05；组合连乘', () => {
    expect(calculateMoodFactor(pad(55, 20, 50))).toBeCloseTo(0.9);
    expect(calculateMoodFactor(pad(55, 50, 80))).toBeCloseTo(1.05);
    expect(calculateMoodFactor(pad(80, 20, 80))).toBeCloseTo(1.1 * 0.9 * 1.05);
  });
});

describe('calculateMaxWordLimit（字数推导）', () => {
  it('无 traits 无 pad：book_review 权重最高、未知互动类型权重 1.0', () => {
    const base = calculateMaxWordLimit('casual_chat');
    const unknown = calculateMaxWordLimit('unknown_type');
    expect(unknown).toBe(base); // 未知类型与 casual_chat 同权重
    expect(calculateMaxWordLimit('book_review')).toBeGreaterThan(base);
    expect(calculateMaxWordLimit('pet')).toBeLessThan(base);
  });

  it('traits 外向（多巴胺高焦虑低）话多；内向焦虑话少', () => {
    const extravert = { dopamine: 0.9, anxiety: 0.1 } as CharacterTraits;
    const introvert = { dopamine: 0.1, anxiety: 0.9 } as CharacterTraits;
    expect(calculateMaxWordLimit('casual_chat', 0, null, extravert))
      .toBeGreaterThan(calculateMaxWordLimit('casual_chat', 0, null, introvert));
  });

  it('用户消息越长系数越高，1.2 封顶', () => {
    const short = calculateMaxWordLimit('casual_chat', 0);
    const long = calculateMaxWordLimit('casual_chat', 100000);
    expect(long).toBeGreaterThan(short);
    expect(long / short).toBeCloseTo(1.2, 1);
  });

  it('传入 pad 时叠加心情因子', () => {
    const withHappyPad = calculateMaxWordLimit('casual_chat', 0, pad(90, 50, 50));
    expect(withHappyPad).toBeGreaterThan(calculateMaxWordLimit('casual_chat', 0));
  });

  it('绝对上限 265 截断（权重×性格×长度全拉满仍 ≤265）', () => {
    const max = calculateMaxWordLimit('book_review', 100000, pad(90, 50, 80), { dopamine: 0.9, anxiety: 0.1 } as CharacterTraits);
    expect(max).toBeLessThanOrEqual(265);
    expect(max).toBe(265);
  });

  it('traits 访问抛错 → 防御性 catch 回落 180（原样返回基础值）', () => {
    expect(calculateMaxWordLimit('talk', 0, null, evilTraits as unknown as CharacterTraits)).toBe(180);
  });
});

describe('getCharacterDescription（traits 全分支合成）', () => {
  it('无 traits → 默认描述', () => {
    expect(getCharacterDescription(null)).toBe('安静友善，偶尔撒娇的陪伴猫咪');
    expect(getCharacterDescription(undefined)).toBe('安静友善，偶尔撒娇的陪伴猫咪');
  });

  it('全中性 traits 无命中短语 → 回默认描述', () => {
    const t = { warmth: 0.5, dopamine: 0.5, anxiety: 0.5, humor: 0.4, self_worth: 0.5 } as CharacterTraits;
    expect(getCharacterDescription(t)).toBe('安静友善，偶尔撒娇的陪伴猫咪');
  });

  it('高暖高多巴胺高焦虑幽默自信 → 各短语依次拼接并以「的猫咪」收尾', () => {
    const t = { warmth: 0.9, dopamine: 0.9, anxiety: 0.9, humor: 0.9, self_worth: 0.9 } as CharacterTraits;
    const desc = getCharacterDescription(t);
    expect(desc).toContain('温暖粘人，喜欢依偎和陪伴');
    expect(desc).toContain('活泼好动，喜欢互动');
    expect(desc).toContain('有点敏感，需要温柔对待');
    expect(desc).toContain('会讲冷笑话，爱卖萌');
    expect(desc).toContain('自信阳光');
    expect(desc.endsWith('的猫咪')).toBe(true);
  });

  it('低暖低多巴胺低焦虑 → 疏离/沉稳/大大咧咧分支', () => {
    const t = { warmth: 0.2, dopamine: 0.2, anxiety: 0.2 } as CharacterTraits;
    const desc = getCharacterDescription(t);
    expect(desc).toContain('有些疏离，保持距离感');
    expect(desc).toContain('安静沉稳，享受独处');
    expect(desc).toContain('大大咧咧，情绪稳定');
  });
});

describe('formatMoodDetails / getMoodHighlights / getMoodEmoji', () => {
  it('pad 为空 → 兜底文案', () => {
    expect(formatMoodDetails(null as any)).toBe('### 心情状态\n暂时无法获取详细心情数据');
  });

  it('已知心情映射文案；未知心情原样透传；缺省「平静」', () => {
    const d = formatMoodDetails(pad(85, 40, 60), 'excellent');
    expect(d).toContain('超开心');
    expect(formatMoodDetails(pad(85, 40, 60), 'mystery')).toContain('mystery');
    expect(formatMoodDetails(pad(85, 40, 60))).toContain('平静');
  });

  it('瞬时情绪有则带出、无则省略该行', () => {
    expect(formatMoodDetails(pad(85, 40, 60), 'good', '开心')).toContain('- 当前情绪：开心');
    expect(formatMoodDetails(pad(85, 40, 60), 'good')).not.toContain('当前情绪');
  });

  it('六档亮点阈值：极高/极低才亮，中间不产', () => {
    expect(getMoodHighlights(pad(85, 85, 85))).toEqual(['当前非常开心', '精力充沛', '掌控感强']);
    expect(getMoodHighlights(pad(20, 20, 20))).toEqual(['心情有些低落', '有些疲惫', '有些无力感']);
    expect(getMoodHighlights(pad(50, 50, 50))).toEqual([]);
  });

  it('emoji 三档分界（≥70 高 / ≥40 中 / 其余低）', () => {
    expect(getMoodEmoji(70, '高', '中', '低')).toBe('高');
    expect(getMoodEmoji(69, '高', '中', '低')).toBe('中');
    expect(getMoodEmoji(40, '高', '中', '低')).toBe('中');
    expect(getMoodEmoji(39, '高', '中', '低')).toBe('低');
  });
});

describe('getResponseRequirements / generatePrompt 组装', () => {
  it('回复要求包含字数上限且逐条编号', () => {
    const req = getResponseRequirements('talk', 200);
    expect(req).toContain('回复长度不超过200字');
    expect(req).toContain('猫咪角色设定');
  });

  it('完整 opts：pad/data/companionContext/userMessage 各段均注入', () => {
    // 状态向量段需要完整 30 特质与关系张量 → 用出生默认人格并拔高暖/多巴胺
    const growth = defaultPersonalityGrowth();
    growth.traits.warmth = 0.9;
    growth.traits.dopamine = 0.9;
    const data = { personalityGrowth: growth } as any;
    const prompt = generatePrompt('talk', '今天好累', {
      pad: pad(80, 45, 55),
      data,
      currentMood: 'good',
      currentEmotion: '开心',
      companionContext: '用户最近常在深夜写代码。',
    });
    expect(prompt).toContain('# 角色设定');
    expect(prompt).toContain('温暖粘人'); // 性格描述由 traits 推导
    expect(prompt).toContain('### 心情状态分析'); // pad 详情段
    expect(prompt).toContain('整体心情：心情好');
    expect(prompt).toContain('当前情绪：开心');
    expect(prompt).toContain('内核状态向量'); // data 段（formatStateVector 注入）
    expect(prompt).toContain('你了解的用户'); // 懂你上下文段
    expect(prompt).toContain('用户最近常在深夜写代码。');
    expect(prompt).toContain('用户说："今天好累"');
    // 字数与 calculateMaxWordLimit 一致
    const words = calculateMaxWordLimit('talk', 4, pad(80, 45, 55), data.personalityGrowth.traits);
    expect(prompt).toContain(`最大字数：${words}字`);
  });

  it('最小 opts：无 pad/data/上下文时对应段省略；无用户消息走互动文案', () => {
    const prompt = generatePrompt('pet');
    expect(prompt).not.toContain('心情状态分析');
    expect(prompt).not.toContain('内核状态向量');
    expect(prompt).not.toContain('你了解的用户');
    expect(prompt).toContain('用户正在与你互动');
  });
});
