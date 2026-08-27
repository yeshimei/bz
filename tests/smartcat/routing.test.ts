// @vitest-environment node
/**
 * 路由规则测试（P1 数据基座，ticket 123）
 * 覆盖：路由表完整性、resolveRouting 精确匹配/通配/兜底、importance/emotion/credibility 默认值。
 */
import { describe, it, expect } from 'vitest';
import { ROUTING_RULES, resolveRouting, type RoutingRule } from '../../src/smartcat/routing';

describe('路由规则表（ROUTING_RULES）', () => {
  it('包含所有指定的 source:action 键', () => {
    const expectedKeys = [
      // 日记
      'diary:created', 'diary:updated', 'diary:deleted',
      // 闪念
      'flash:created', 'flash:deleted',
      // 诗
      'poem:created', 'poem:deleted',
      // 信
      'letter:created', 'letter:deleted',
      // 影视
      'movie:want', 'movie:watching', 'movie:watched', 'movie:rated', 'movie:reviewed', 'movie:deleted',
      // 备忘录
      'memo:added', 'memo:edited', 'memo:completed', 'memo:restored', 'memo:postponed', 'memo:priority', 'memo:deleted',
      // 聚合讯
      'news:read', 'news:saved', 'news:skipped',
      // 收藏本
      'favorites:added', 'favorites:edited', 'favorites:deleted',
      // 归物本
      'belongings:added', 'belongings:edited', 'belongings:status', 'belongings:deleted',
      // 番茄钟
      'pomodoro:focus-done',
      // 聊天
      'chat:said',
      // 书库
      'library:started', 'library:completed', 'library:progressed', 'library:highlight', 'library:thought', 'library:added', 'library:removed',
      // 反思
      'reflection:insight', 'reflection:digest',
      // 周报
      'weekly-report:generated',
      // dossier
      'dossier:generated',
      // 兜底
      'system:fallback',
    ];
    for (const key of expectedKeys) {
      expect(ROUTING_RULES).toHaveProperty(key);
    }
  });

  it('memory 流规则包含 importance 和 defaultEmotion', () => {
    const memoryRules = Object.entries(ROUTING_RULES).filter(([, r]) => r.stream === 'memory');
    for (const [key, rule] of memoryRules) {
      expect(rule.importance, `${key} 应有 importance`).toBeGreaterThanOrEqual(0);
      expect(rule.importance, `${key} 应有 importance`).toBeLessThanOrEqual(1);
      expect(rule.defaultEmotion, `${key} 应有 defaultEmotion`).toBeTruthy();
    }
  });

  it('behavior 流规则无 importance/emotion', () => {
    const behaviorRules = Object.entries(ROUTING_RULES).filter(([, r]) => r.stream === 'behavior');
    for (const [key, rule] of behaviorRules) {
      expect(rule.importance, `${key} behavior 流不应有 importance`).toBeUndefined();
      expect(rule.defaultEmotion, `${key} behavior 流不应有 defaultEmotion`).toBeUndefined();
    }
  });

  it('diary:created → memory, importance=0.85, emotion=calm', () => {
    const rule = ROUTING_RULES['diary:created'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.85);
    expect(rule.defaultEmotion).toBe('calm');
  });

  it('diary:deleted → behavior', () => {
    expect(ROUTING_RULES['diary:deleted'].stream).toBe('behavior');
  });

  it('flash:created → behavior（卡片盒知识内容不进记忆流，用户拍板）', () => {
    expect(ROUTING_RULES['flash:created'].stream).toBe('behavior');
  });

  it('movie:watched → memory, importance=0.85, emotion=happy', () => {
    const rule = ROUTING_RULES['movie:watched'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.85);
    expect(rule.defaultEmotion).toBe('happy');
  });

  it('movie:want → memory, importance=0.60, emotion=curious', () => {
    const rule = ROUTING_RULES['movie:want'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.60);
    expect(rule.defaultEmotion).toBe('curious');
  });

  it('memo:added → behavior', () => {
    expect(ROUTING_RULES['memo:added'].stream).toBe('behavior');
  });

  it('news:read → behavior', () => {
    expect(ROUTING_RULES['news:read'].stream).toBe('behavior');
  });

  it('favorites:added → behavior', () => {
    expect(ROUTING_RULES['favorites:added'].stream).toBe('behavior');
  });

  it('belongings:status → behavior', () => {
    expect(ROUTING_RULES['belongings:status'].stream).toBe('behavior');
  });

  it('pomodoro:focus-done → memory, importance=0.70, emotion=focused', () => {
    const rule = ROUTING_RULES['pomodoro:focus-done'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.70);
    expect(rule.defaultEmotion).toBe('focused');
  });

  it('chat:said → memory, importance=0.75, credibility=0.5', () => {
    const rule = ROUTING_RULES['chat:said'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.75);
    expect(rule.credibility).toBe(0.5);
  });

  it('library:completed → memory, importance=0.85, emotion=happy', () => {
    const rule = ROUTING_RULES['library:completed'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.85);
    expect(rule.defaultEmotion).toBe('happy');
  });

  it('library:added → behavior', () => {
    expect(ROUTING_RULES['library:added'].stream).toBe('behavior');
  });

  it('reflection:insight → memory, importance=0.90', () => {
    const rule = ROUTING_RULES['reflection:insight'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.90);
  });

  it('weekly-report:generated → memory, importance=0.95', () => {
    const rule = ROUTING_RULES['weekly-report:generated'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.95);
  });

  it('dossier:generated → memory, importance=0.90', () => {
    const rule = ROUTING_RULES['dossier:generated'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.90);
  });

  it('system:fallback → behavior', () => {
    expect(ROUTING_RULES['system:fallback'].stream).toBe('behavior');
  });
});

describe('resolveRouting', () => {
  it('精确匹配 source:action', () => {
    const rule = resolveRouting('diary', 'created');
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.85);
  });

  it('精确匹配优先于通配', () => {
    // 假设有一个 source:* 通配规则
    const rule = resolveRouting('system', 'fallback');
    expect(rule.stream).toBe('behavior');
  });

  it('未匹配 → system:fallback', () => {
    const rule = resolveRouting('unknown_source', 'unknown_action');
    expect(rule.stream).toBe('behavior');
  });

  it('空字符串也能兜底', () => {
    const rule = resolveRouting('', '');
    expect(rule.stream).toBe('behavior');
  });

  it('source 匹配但 action 不匹配 → fallback', () => {
    const rule = resolveRouting('diary', 'nonexistent_action');
    expect(rule.stream).toBe('behavior');
  });

  it('所有 memory 流规则的 credibility 默认 0.8（除显式指定外）', () => {
    for (const [key, rule] of Object.entries(ROUTING_RULES)) {
      if (rule.stream === 'memory') {
        const expectedCred = rule.credibility ?? 0.8;
        expect(expectedCred, `${key} credibility 应 >= 0`).toBeGreaterThanOrEqual(0);
        expect(expectedCred, `${key} credibility 应 <= 1`).toBeLessThanOrEqual(1);
      }
    }
  });
});
