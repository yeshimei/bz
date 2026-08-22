/**
 * smartcat 语音系统测试：触发词匹配、指令提取、相似度/编辑距离、模糊匹配、注册表指令。
 */
import { describe, it, expect } from 'vitest';
import { VoiceCommandSystem, TRIGGER_WORDS } from '../../src/smartcat/voice';

function make() {
  const calls: string[] = [];
  const v = new VoiceCommandSystem({
    openSettings: () => calls.push('openSettings'),
    openChat: () => calls.push('openChat'),
    closePanels: () => calls.push('closePanels'),
    startReview: () => calls.push('startReview'),
    casualChat: async (m) => { calls.push('chat:' + m); },
  });
  return { v, calls };
}

describe('TRIGGER_WORDS', () => {
  it('9 个触发词（原清单逐字）', () => {
    expect(TRIGGER_WORDS).toEqual(['小猫', '猫猫', '小橘', '猫咪', '喵喵', '猫', '橘猫', '猫猫猫', '猫猫猫猫']);
  });
});

describe('isCommandTriggered', () => {
  it('开头触发词命中', () => {
    const { v } = make();
    expect(v.isCommandTriggered('小猫 打开设置')).toBe(true);
    expect(v.isCommandTriggered('小橘，陪我聊聊天')).toBe(true);
  });

  it('非触发词 → false', () => {
    const { v } = make();
    expect(v.isCommandTriggered('今天天气不错')).toBe(false);
  });
});

describe('extractCommandContent', () => {
  it('去触发词 + 去标点', () => {
    const { v } = make();
    expect(v.extractCommandContent('小猫 打开设置')).toBe('打开设置');
    expect(v.extractCommandContent('小橘，打开聊天')).toBe('打开聊天');
  });
});

describe('editDistance / calculateSimilarity', () => {
  it('编辑距离', () => {
    const { v } = make();
    expect(v.editDistance('abc', 'abc')).toBe(0);
    expect(v.editDistance('kitten', 'sitting')).toBe(3);
  });

  it('相似度：相同 1、完全不同低', () => {
    const { v } = make();
    expect(v.calculateSimilarity('打开设置', '打开设置')).toBe(1);
    expect(v.calculateSimilarity('打开设置', 'xyz')).toBeLessThan(0.7);
  });
});

describe('handleVoiceCommand', () => {
  it('触发词精确指令 → 执行对应 handler', async () => {
    const { v, calls } = make();
    await v.handleVoiceCommand('小猫 打开设置');
    expect(calls).toContain('openSettings');
  });

  it('触发词模糊（相似 >0.7）→ 执行', async () => {
    const { v, calls } = make();
    // '打开设置面板' vs '打开设置' 相似度恰好 0.7（原版 >0.7 严格判定不命中）；
    // 用编辑距离 1 的 '打开设置页'（0.8）验证模糊分支
    await v.handleVoiceCommand('小猫 打开设置页');
    expect(calls).toContain('openSettings');
  });

  it('非触发词 → 普通聊天', async () => {
    const { v, calls } = make();
    await v.handleVoiceCommand('今天心情不错');
    expect(calls.some((c) => c.startsWith('chat:'))).toBe(true);
  });

  it('触发词但空内容 → 提示', async () => {
    const { v } = make();
    let bubble = '';
    v.onShowBubble = (m) => { bubble = m; };
    await v.handleVoiceCommand('小猫');
    expect(bubble).toContain('我在听呢');
  });
});