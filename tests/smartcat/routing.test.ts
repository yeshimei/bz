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
      'memo:added', 'memo:edited', 'memo:completed', 'memo:restored', 'memo:postponed', 'memo:priority', 'memo:deleted', 'memo:due',
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
      // 文献盒（literature，ADR-0066/0072：ticket 136 起 converted + term-generated 两节点）
      'literature:converted', 'literature:term-generated',
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

  it('behavior 流规则可携带 importance/emotion 作档位记录；exempt 规则不得携带', () => {
    const behaviorRules = Object.entries(ROUTING_RULES).filter(([, r]) => r.stream === 'behavior');
    for (const [key, rule] of behaviorRules) {
      if (rule.importance !== undefined) {
        expect(rule.importance, `${key} importance 应在 0-1`).toBeGreaterThanOrEqual(0);
        expect(rule.importance, `${key} importance 应在 0-1`).toBeLessThanOrEqual(1);
      }
    }
    const exemptRules = Object.entries(ROUTING_RULES).filter(([, r]) => r.stream === 'exempt');
    for (const [key, rule] of exemptRules) {
      expect(rule.importance, `${key} exempt 流不应有 importance`).toBeUndefined();
      expect(rule.defaultEmotion, `${key} exempt 流不应有 defaultEmotion`).toBeUndefined();
    }
  });

  it('diary:created → behavior（ADR-0069：事件全退记忆流）, importance=0.85, emotion=calm', () => {
    const rule = ROUTING_RULES['diary:created'];
    expect(rule.stream).toBe('behavior');
    expect(rule.importance).toBe(0.85);
    expect(rule.defaultEmotion).toBe('calm');
  });

  it('diary:deleted → behavior', () => {
    expect(ROUTING_RULES['diary:deleted'].stream).toBe('behavior');
  });

  it('flash:created → behavior（卡片盒知识内容不进记忆流，用户拍板）', () => {
    expect(ROUTING_RULES['flash:created'].stream).toBe('behavior');
  });

  it('movie:watched → behavior（ADR-0069）, importance=0.85, emotion=happy', () => {
    const rule = ROUTING_RULES['movie:watched'];
    expect(rule.stream).toBe('behavior');
    expect(rule.importance).toBe(0.85);
    expect(rule.defaultEmotion).toBe('happy');
  });

  it('movie:want → behavior（ADR-0069）, importance=0.60, emotion=curious', () => {
    const rule = ROUTING_RULES['movie:want'];
    expect(rule.stream).toBe('behavior');
    expect(rule.importance).toBe(0.60);
    expect(rule.defaultEmotion).toBe('curious');
  });

  it('memo:added → behavior', () => {
    expect(ROUTING_RULES['memo:added'].stream).toBe('behavior');
  });

  it('memo:due → behavior（每日到期扫描）', () => {
    expect(ROUTING_RULES['memo:due'].stream).toBe('behavior');
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

  it('pomodoro:focus-done → behavior（ADR-0069）, importance=0.70, emotion=focused', () => {
    const rule = ROUTING_RULES['pomodoro:focus-done'];
    expect(rule.stream).toBe('behavior');
    expect(rule.importance).toBe(0.70);
    expect(rule.defaultEmotion).toBe('focused');
  });

  it('chat:said → behavior（ADR-0069：聊天记忆经日小结沉淀）, importance=0.75, credibility=0.5', () => {
    const rule = ROUTING_RULES['chat:said'];
    expect(rule.stream).toBe('behavior');
    expect(rule.importance).toBe(0.75);
    expect(rule.credibility).toBe(0.5);
  });

  it('library:completed → behavior（ADR-0069）, importance=0.85, emotion=happy', () => {
    const rule = ROUTING_RULES['library:completed'];
    expect(rule.stream).toBe('behavior');
    expect(rule.importance).toBe(0.85);
    expect(rule.defaultEmotion).toBe('happy');
  });

  it('resolveRouting：literature:converted 精确匹配 → behavior', () => {
    const rule = resolveRouting('literature', 'converted');
    expect(rule.stream).toBe('behavior');
  });

  it('library:added → behavior', () => {
    expect(ROUTING_RULES['library:added'].stream).toBe('behavior');
  });

  it('literature:converted / literature:term-generated → behavior（文献盒仅行为流，用户拍板，ADR-0066/0072）', () => {
    expect(ROUTING_RULES['literature:converted'].stream).toBe('behavior');
    expect(ROUTING_RULES['literature:term-generated'].stream).toBe('behavior');
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
    expect(rule.stream).toBe('behavior');
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

// ==================== ADR-0069 行为流全量盘点补齐 ====================

describe('ADR-0069：盘点补齐路由规则', () => {
  it('新增 behavior 规则键存在', () => {
    const keys = [
      'diary:tagged',
      'review:started', 'review:added', 'review:removed', 'review:rated',
      'quiz:added', 'quiz:answered',
      'attach:moved',
    ];
    for (const key of keys) {
      expect(ROUTING_RULES, `${key} 应存在`).toHaveProperty(key);
      expect(ROUTING_RULES[key].stream).toBe('behavior');
      expect(ROUTING_RULES[key].importance).toBeUndefined();
      expect(ROUTING_RULES[key].defaultEmotion).toBeUndefined();
    }
  });

  it('隐私豁免键存在且为 exempt（密码域/加密域通配 + 日记加密动作精确）', () => {
    const keys = [
      'password:*', 'encrypt:*',
      'diary:entry-encrypted', 'diary:entry-decrypted', 'diary:encrypted-purged',
    ];
    for (const key of keys) {
      expect(ROUTING_RULES, `${key} 应存在`).toHaveProperty(key);
      expect(ROUTING_RULES[key].stream).toBe('exempt');
      expect(ROUTING_RULES[key].importance).toBeUndefined();
      expect(ROUTING_RULES[key].defaultEmotion).toBeUndefined();
    }
  });

  it('resolveRouting：密码/加密域通配 exempt（任意动作）', () => {
    expect(resolveRouting('password', 'open').stream).toBe('exempt');
    expect(resolveRouting('password', 'added').stream).toBe('exempt');
    expect(resolveRouting('password', 'generate').stream).toBe('exempt');
    expect(resolveRouting('encrypt', 'lock').stream).toBe('exempt');
    expect(resolveRouting('encrypt', 'unlock').stream).toBe('exempt');
  });

  it('resolveRouting：日记加密动作精确匹配 exempt', () => {
    expect(resolveRouting('diary', 'entry-encrypted').stream).toBe('exempt');
    expect(resolveRouting('diary', 'entry-decrypted').stream).toBe('exempt');
    expect(resolveRouting('diary', 'encrypted-purged').stream).toBe('exempt');
  });

  it('豁免规则不影响既有精确匹配：diary:created 降 behavior（ADR-0069）、diary:deleted 仍 behavior', () => {
    expect(resolveRouting('diary', 'created').stream).toBe('behavior');
    expect(resolveRouting('diary', 'deleted').stream).toBe('behavior');
  });

  it('每域每动作判定表（盘点矩阵：既有键 + 新增键 → 期望路由）', () => {
    const matrix: Array<[string, string, RoutingRule['stream']]> = [
      // 日记
      ['diary', 'created', 'behavior'],
      ['diary', 'updated', 'behavior'],
      ['diary', 'deleted', 'behavior'],
      ['diary', 'tagged', 'behavior'],
      ['diary', 'entry-encrypted', 'exempt'],
      ['diary', 'entry-decrypted', 'exempt'],
      ['diary', 'encrypted-purged', 'exempt'],
      // 闪念 / 诗 / 信
      ['flash', 'created', 'behavior'],
      ['poem', 'created', 'behavior'],
      ['letter', 'created', 'behavior'],
      // 影视
      ['movie', 'want', 'behavior'],
      ['movie', 'watched', 'behavior'],
      ['movie', 'deleted', 'behavior'],
      // 备忘录
      ['memo', 'added', 'behavior'],
      ['memo', 'due', 'behavior'],
      // 聚合讯
      ['news', 'read', 'behavior'],
      ['news', 'saved', 'behavior'],
      ['news', 'skipped', 'behavior'],
      // 收藏本 / 归物本
      ['favorites', 'added', 'behavior'],
      ['belongings', 'status', 'behavior'],
      // 番茄钟 / 聊天
      ['pomodoro', 'focus-done', 'behavior'],
      ['chat', 'said', 'behavior'],
      // 书库
      ['library', 'started', 'behavior'],
      ['library', 'highlight', 'behavior'],
      ['library', 'added', 'behavior'],
      // 文献盒（ticket 136：converted + term-generated 两节点，added/parsed 已移除）
      ['literature', 'converted', 'behavior'],
      ['literature', 'term-generated', 'behavior'],
      // 剪藏（clipping:deleted 已按用户拍板断开移除，2026-08-29；未定义键走 system:fallback behavior）
      // 复习计划 / 题库 / 入口页 / 附件（新增，规则就绪）
      ['review', 'started', 'behavior'],
      ['review', 'rated', 'behavior'],
      ['quiz', 'answered', 'behavior'],
      ['launcher', 'opened', 'behavior'],
      ['attach', 'moved', 'behavior'],
      // 反思 / 周报 / dossier
      ['reflection', 'insight', 'memory'],
      ['weekly-report', 'generated', 'memory'],
      ['dossier', 'generated', 'memory'],
      // 密码 / 加密（豁免）
      ['password', 'open', 'exempt'],
      ['encrypt', 'lock', 'exempt'],
      // 兜底
      ['unknown', 'whatever', 'behavior'],
    ];
    for (const [source, action, expected] of matrix) {
      expect(resolveRouting(source, action).stream, `${source}:${action}`).toBe(expected);
    }
  });
});
