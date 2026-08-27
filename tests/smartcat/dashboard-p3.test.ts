/**
 * P3 用户体验层：Dashboard 行为页签测试（ticket 123）
 * - 行为页签渲染（开关控制显隐）
 * - promote 按钮存在
 *
 * 设置弹窗新分组测试见 settings.test.ts（已更新断言）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock settings-provider
const mockSettings: Record<string, any> = {
  showBehaviorLog: true,
  behaviorMaxDays: 30,
  behaviorMaxCount: 1000,
  enableAutoLinking: true,
  linkWindowDays: 7,
  smartcatMobileDefaultFullscreen: false,
};
vi.mock('../../src/core/settings-provider', () => ({
  tryGetSettings: () => mockSettings,
}));

// mock data module (preserve actual exports, only mock loadSmartCatData)
const mocks = vi.hoisted(() => ({
  saveSmartCatData: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/smartcat/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/smartcat/data')>();
  return {
    ...actual,
    loadSmartCatData: vi.fn().mockResolvedValue({
      config: { appearance: 'orange', customColors: { primary: '#fff', secondary: '#000' }, speakInterval: 10, speakProbability: 0.5, responseSensitivity: 'medium', contextLength: 500, contextSplitRatio: 0.5, conversationHistory: [], shortTermMemory: 100, noteSource: true, proactiveCare: true, proactiveWeeklyCap: 2, cloudScoring: 'smart' },
      mood: { pad: { pleasure: 50, arousal: 50, dominance: 50 }, lastUpdate: Date.now(), lastMood: 'neutral', currentEmotion: null },
      personalityGrowth: { ocean: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5 }, traits: { anxiety: 0.5, avoidance: 0.5, separation_tol: 0.5, self_worth: 0.5, world_safety: 0.5, others_trust: 0.5, reflectiveness: 0.5, analytical: 0.5, creativity: 0.5, humor: 0.5, intellectual: 0.5, def_avoidance: 0.5, support: 0.5, locus_control: 0.5, self_esteem: 0.5, self_efficacy: 0.5, enhancement: 0.5, transcendence: 0.5, change: 0.5, conservation: 0.5, warmth: 0.5, directness: 0.5, beh_depth: 0.5, conflict: 0.5, optimism: 0.5, serotonin: 0.5, dopamine: 0.5, oxytocin: 0.5, cortisol: 0.5, exist_depth: 0, familiarity: 0, concern: 0 }, relationship: { trust: 0.5, attachment: 0.5 }, behaviorStats: { interactionCount: 0, emotionalTone: 0, preferredHour: 12, sessionCount: 0 }, growthHistory: [], lastSave: Date.now(), version: '1.0' },
      editingData: {},
      memory: {
        version: 2,
        lastUpdated: new Date().toISOString(),
        memoryStream: [],
        behaviorStream: [
          { id: 'beh_001', timestamp: new Date().toISOString(), type: 'created', source: 'memo', description: 'memo:created 写备忘' },
          { id: 'beh_002', timestamp: new Date(Date.now() - 3600000).toISOString(), type: 'read', source: 'diary', description: 'diary:read 读日记' },
        ],
        reflection: { lastReflectAt: 0, count: 0 },
      },
    }),
    saveSmartCatData: mocks.saveSmartCatData,
  };
});

// mock mobile module
vi.mock('../../src/core/mobile', () => ({
  applyMobileWindowFullscreen: vi.fn(),
  isMobileEnv: () => false,
}));

// mock esc-manager
vi.mock('../../src/core/esc-manager', () => ({
  escManager: { register: () => ({ unregister: vi.fn() }) },
}));

// mock notice
vi.mock('../../src/core/notice', () => ({
  notice: vi.fn(),
}));

import { openSmartcatDashboard, closeSmartcatDashboard } from '../../src/smartcat/dashboard';

describe('Dashboard 行为页签（P3 ticket 123）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    mockSettings.showBehaviorLog = true;
  });

  afterEach(() => {
    closeSmartcatDashboard();
    document.body.innerHTML = '';
  });

  const mockApp = {
    vault: {
      adapter: { read: vi.fn().mockResolvedValue('{}'), readBinary: vi.fn().mockRejectedValue(new Error('no file')) },
      on: vi.fn(),
      offref: vi.fn(),
      getAbstractFileByPath: vi.fn(),
    },
    workspace: { on: vi.fn() },
    metadataCache: { on: vi.fn() },
  };

  it('showBehaviorLog=true 时渲染行为页签', async () => {
    await openSmartcatDashboard(mockApp as any);

    const tabs = document.querySelectorAll('.bz-sc-dash-tab');
    const tabTexts = Array.from(tabs).map((t) => t.textContent);
    expect(tabTexts).toContain('行为');
  });

  it('showBehaviorLog=false 时隐藏行为页签', async () => {
    mockSettings.showBehaviorLog = false;
    await openSmartcatDashboard(mockApp as any);

    const tabs = document.querySelectorAll('.bz-sc-dash-tab');
    const tabTexts = Array.from(tabs).map((t) => t.textContent);
    expect(tabTexts).not.toContain('行为');
  });

  it('行为页签显示行为条目', async () => {
    await openSmartcatDashboard(mockApp as any);

    // 切换到行为页签
    const tabs = document.querySelectorAll('.bz-sc-dash-tab');
    const behaviorTab = Array.from(tabs).find((t) => t.textContent === '行为');
    expect(behaviorTab).toBeDefined();
    (behaviorTab as HTMLElement).click();

    // 检查行为条目渲染
    const behaviorItems = document.querySelectorAll('.bz-sc-dash-behavior-item');
    expect(behaviorItems.length).toBeGreaterThan(0);
  });

  it('行为页签有提升为记忆按钮', async () => {
    await openSmartcatDashboard(mockApp as any);

    // 切换到行为页签
    const tabs = document.querySelectorAll('.bz-sc-dash-tab');
    const behaviorTab = Array.from(tabs).find((t) => t.textContent === '行为');
    (behaviorTab as HTMLElement).click();

    const promoteButtons = document.querySelectorAll('.bz-sc-dash-promote-btn');
    expect(promoteButtons.length).toBeGreaterThan(0);
  });

  it('promote 按钮点击后调用 saveSmartCatData 落盘', async () => {
    await openSmartcatDashboard(mockApp as any);

    // 切换到行为页签
    const tabs = document.querySelectorAll('.bz-sc-dash-tab');
    const behaviorTab = Array.from(tabs).find((t) => t.textContent === '行为');
    (behaviorTab as HTMLElement).click();

    // 点击第一个 promote 按钮
    const promoteBtn = document.querySelector('.bz-sc-dash-promote-btn') as HTMLElement;
    expect(promoteBtn).not.toBeNull();
    await promoteBtn.click();

    // 验证 saveSmartCatData 被调用（P1-1 fix）
    expect(mocks.saveSmartCatData).toHaveBeenCalled();
  });
});
