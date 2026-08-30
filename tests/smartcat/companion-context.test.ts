// @vitest-environment node
/**
 * 懂你上下文块测试（ADR-0025：作息/趋势/关系/记忆组装 + generatePrompt 注入）
 */
import { describe, it, expect } from 'vitest';
import { buildCompanionContext } from '../../src/smartcat/companion-context';
import { generatePrompt } from '../../src/smartcat/prompts';
import type { MemoryStreamEntry } from '../../src/smartcat/types';

function entry(created: string, emotion?: string, importance = 0.5): MemoryStreamEntry {
  return { id: 'm1', created, lastAccessed: created, description: '记忆', importance, type: 'observation', emotion };
}

describe('buildCompanionContext（懂你上下文块）', () => {
  it('无任何信号 → 空串（调用方自行省略）', () => {
    expect(buildCompanionContext({ memoryStream: [] })).toBe('');
  });

  it('作息（≥3 条活跃）→ 作息行 + 当前时段；ticket 163：行内「你」替换为称呼（默认包仔）', () => {
    const now = new Date('2026-08-20T12:00:00').getTime();
    const stream: MemoryStreamEntry[] = [];
    for (let h = 20; h < 24; h++) {
      const d = new Date(now - 86400000); // 昨天，避免与 now 交叉
      d.setHours(h, 30, 0, 0);
      stream.push(entry(d.toISOString()));
    }
    const c = buildCompanionContext({ memoryStream: stream, hour: 22, now });
    expect(c).toContain('包仔通常在');
    expect(c).not.toContain('你通常在');
    expect(c).toContain('现在是晚上');
  });

  it('情绪趋势 → 趋势行（count≥1）', () => {
    const now = Date.now();
    const stream = [
      entry(new Date(now - 3600e3).toISOString(), 'sad'),
      entry(new Date(now - 7200e3).toISOString(), 'sad'),
    ];
    const c = buildCompanionContext({ memoryStream: stream, now });
    expect(c).toContain('难过');
  });

  it('关系 → 信任/依恋行；记忆文本原样透传', () => {
    const c = buildCompanionContext({
      memoryStream: [],
      relationship: { trust: 0.72, attachment: 0.64 },
      now: Date.now(),
    });
    expect(c).toContain('信任 0.72');
    expect(c).toContain('依恋 0.64');
    const withMem = buildCompanionContext({
      memoryStream: [],
      relationship: { trust: 0.5 },
      memoriesText: '1. [observation（聊天·2 小时前）] 记得买牛奶',
      now: Date.now(),
    });
    expect(withMem).toContain('相关记忆');
    expect(withMem).toContain('记得买牛奶');
  });

  it('作息数据不足（<3 条）→ 不产生作息行', () => {
    const now = Date.now();
    const c = buildCompanionContext({ memoryStream: [entry(new Date(now - 1000).toISOString())], now });
    expect(c).not.toContain('最活跃');
  });
});

describe('generatePrompt 注入（companionContext）', () => {
  it('携带 companionContext → 系统提示含「你了解的用户」节；不带 → 无该节', () => {
    const withCtx = generatePrompt('talk', 'hi', { companionContext: '- 你通常在晚上最活跃' });
    expect(withCtx).toContain('## 你了解的用户');
    expect(withCtx).toContain('你通常在晚上最活跃');
    const noCtx = generatePrompt('talk', 'hi', {});
    expect(noCtx).not.toContain('你了解的用户');
  });
});