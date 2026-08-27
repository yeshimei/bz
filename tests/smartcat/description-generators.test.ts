// @vitest-environment node
/**
 * 描述生成器注册表测试（P2a 创作/情感域 StructuredMeta 适配，ticket 123）
 * 覆盖：各 entityType 生成器措辞 + snapshot 优先 + fallback + 结构化路由集成。
 */
import { describe, it, expect } from 'vitest';
import { generateDescription, generateFallbackDescription } from '../../src/smartcat/description-generators';
import type { StructuredMeta } from '../../src/smartcat/types';

describe('generateDescription（主入口）', () => {
  it('movie:want → 你把《X》加入想看', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'want', name: '美丽人生' };
    expect(generateDescription(s)).toBe('你把《美丽人生》加入想看');
  });

  it('movie:watching → 你开始看《X》', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'watching', name: '美丽人生' };
    expect(generateDescription(s)).toBe('你开始看《美丽人生》');
  });

  it('movie:watched → 你看完了《X》+ rating', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'watched', name: '美丽人生', rating: 5 };
    expect(generateDescription(s)).toBe('你看完了《美丽人生》，给了 5 分');
  });

  it('movie:watched 无评分 → 只有看完', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'watched', name: '美丽人生' };
    expect(generateDescription(s)).toBe('你看完了《美丽人生》');
  });

  it('movie:rated → 评分（首次）', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'rated', name: '美丽人生', rating: 4.5 };
    expect(generateDescription(s)).toBe('你给《美丽人生》评了 4.5 分');
  });

  it('movie:rated → 评分（改分）', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'rated', name: '美丽人生', rating: 4.5, extras: { fromRating: 3.5 } };
    expect(generateDescription(s)).toBe('你把《美丽人生》的评分从 3.5 改为 4.5');
  });

  it('movie:reviewed → 影评（写新）', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'reviewed', name: '美丽人生', extras: { review: '经典' } };
    expect(generateDescription(s)).toBe('你写了《美丽人生》的影评：经典');
  });

  it('movie:reviewed → 影评（删掉）', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'reviewed', name: '美丽人生', extras: { fromReview: '经典', review: null } };
    expect(generateDescription(s)).toBe('你删掉了《美丽人生》的影评');
  });

  it('movie:deleted → 删除', () => {
    const s: StructuredMeta = { entityType: 'movie', action: 'deleted', name: '美丽人生' };
    expect(generateDescription(s)).toBe('你删除了《美丽人生》的影视记录');
  });

  it('book:started → 你开始读《X》', () => {
    const s: StructuredMeta = { entityType: 'book', action: 'started', name: '深度学习' };
    expect(generateDescription(s)).toBe('你开始读《深度学习》');
  });

  it('book:completed → 你读完了《X》', () => {
    const s: StructuredMeta = { entityType: 'book', action: 'completed', name: '深度学习' };
    expect(generateDescription(s)).toBe('你读完了《深度学习》');
  });

  it('book:progressed → 你读了《X》约 N 分钟', () => {
    const s: StructuredMeta = { entityType: 'book', action: 'progressed', name: '深度学习', duration: 30, progress: 45 };
    expect(generateDescription(s)).toBe('你读了《深度学习》约 30 分钟（读到 45%）');
  });

  it('book:highlight → 划重点', () => {
    const s: StructuredMeta = { entityType: 'book', action: 'highlight', name: '深度学习', extras: { texts: ['重点1'] } };
    expect(generateDescription(s)).toBe('你在《深度学习》划了条重点：「重点1」');
  });

  it('book:highlight 多条 → 划了 N 条重点', () => {
    const s: StructuredMeta = { entityType: 'book', action: 'highlight', name: '深度学习', extras: { texts: ['重点1', '重点2'] } };
    expect(generateDescription(s)).toBe('你在《深度学习》划了 2 条重点：「重点1」、「重点2」');
  });

  it('book:thought → 写想法', () => {
    const s: StructuredMeta = { entityType: 'book', action: 'thought', name: '深度学习', extras: { texts: ['想法1'] } };
    expect(generateDescription(s)).toBe('你在《深度学习》写了条想法：「想法1」');
  });

  it('book:added → 加入书架', () => {
    const s: StructuredMeta = { entityType: 'book', action: 'added', name: '深度学习' };
    expect(generateDescription(s)).toBe('你把《深度学习》加入了书架');
  });

  it('book:removed → 移出书架', () => {
    const s: StructuredMeta = { entityType: 'book', action: 'removed', name: '深度学习' };
    expect(generateDescription(s)).toBe('你把《深度学习》移出了书架');
  });

  it('diary_entry:created → 写了一篇日记 + body', () => {
    const s: StructuredMeta = {
      entityType: 'diary_entry', action: 'created',
      name: '2026-08-24 23:05', tags: ['日记', '猫'],
      extras: { body: '今天陪猫玩' },
    };
    expect(generateDescription(s)).toBe('你在 2026-08-24 23:05 写了一篇日记（分类：日记、猫）：今天陪猫玩');
  });

  it('diary_entry:updated → 更新了日记（含分类）', () => {
    const s: StructuredMeta = {
      entityType: 'diary_entry', action: 'updated',
      name: '2026-08-24 23:05', tags: ['日记'],
      extras: { body: '新正文' },
    };
    expect(generateDescription(s)).toBe('你更新了日记（2026-08-24 23:05，分类：日记）：新正文');
  });

  it('diary_entry:created 无 tags → 不带分类括号', () => {
    const s: StructuredMeta = {
      entityType: 'diary_entry', action: 'created',
      name: '2026-08-24 23:05',
      extras: { body: '正文' },
    };
    expect(generateDescription(s)).toBe('你在 2026-08-24 23:05 写了一篇日记：正文');
  });

  it('diary_entry 有 snapshot.summary → 优先使用', () => {
    const s: StructuredMeta = {
      entityType: 'diary_entry', action: 'created',
      name: '2026-08-24 23:05',
      snapshot: { summary: '自定义摘要', tags: [], length: 10 },
    };
    expect(generateDescription(s)).toBe('自定义摘要');
  });

  it('letter:created → 写了一封信', () => {
    const s: StructuredMeta = {
      entityType: 'letter', action: 'created',
      name: '第2封信', extras: { date: '2026-06-17 23:44', body: '见字如面' },
    };
    expect(generateDescription(s)).toBe('你在 2026-06-17 23:44 写了一封信「第2封信」：见字如面');
  });

  it('poem:created → 写了一首现代诗', () => {
    const s: StructuredMeta = {
      entityType: 'poem', action: 'created',
      name: '0115', extras: { date: '2026-03-01 09:30', body: '黑夜给了我黑色的眼睛' },
    };
    expect(generateDescription(s)).toBe('你在 2026-03-01 09:30 写了一首现代诗「0115」：黑夜给了我黑色的眼睛');
  });

  it('chat_message:said → 你说：...', () => {
    const s: StructuredMeta = {
      entityType: 'chat_message', action: 'said',
      extras: { content: '今天天气真好' },
    };
    expect(generateDescription(s)).toBe('你说：今天天气真好');
  });

  it('chat_message:said 超长 → 截断 200 字', () => {
    const longText = '长'.repeat(300);
    const s: StructuredMeta = {
      entityType: 'chat_message', action: 'said',
      extras: { content: longText },
    };
    const result = generateDescription(s);
    expect(result).toBe('你说：' + '长'.repeat(200) + '…');
  });

  it('insight:generated → 产生了洞察', () => {
    const s: StructuredMeta = {
      entityType: 'insight', action: 'generated',
      name: '用户偏好分析',
    };
    expect(generateDescription(s)).toBe('产生了洞察：用户偏好分析');
  });

  it('flash:created → 卡片盒记下了', () => {
    const s: StructuredMeta = {
      entityType: 'flash', action: 'created',
      name: 'TDD', extras: { body: '今天实践 TDD\n第二行' },
    };
    expect(generateDescription(s)).toBe('你在卡片盒记下了「TDD」：「今天实践 TDD\n第二行」');
  });
});

describe('generateFallbackDescription（兜底）', () => {
  it('未知 entityType → [entityType] action name', () => {
    const s: StructuredMeta = { entityType: 'unknown', action: 'test', name: 'foo' };
    expect(generateFallbackDescription(s)).toBe('[unknown] test foo');
  });

  it('无 name → [entityType] action', () => {
    const s: StructuredMeta = { entityType: 'unknown', action: 'test' };
    expect(generateFallbackDescription(s)).toBe('[unknown] test');
  });
});

describe('未知 entityType 回退', () => {
  it('generateDescription 对未知 entityType 走 fallback', () => {
    const s: StructuredMeta = { entityType: 'custom_thing', action: 'did', name: 'something' };
    expect(generateDescription(s)).toBe('[custom_thing] did something');
  });
});

describe('结构化路由集成（P2a）', () => {
  it('diary:created → memory 流，importance 0.85', async () => {
    const { ROUTING_RULES } = await import('../../src/smartcat/routing');
    const rule = ROUTING_RULES['diary:created'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.85);
  });

  it('diary:deleted → behavior 流', async () => {
    const { ROUTING_RULES } = await import('../../src/smartcat/routing');
    expect(ROUTING_RULES['diary:deleted'].stream).toBe('behavior');
  });

  it('movie:watched → memory 流', async () => {
    const { ROUTING_RULES } = await import('../../src/smartcat/routing');
    const rule = ROUTING_RULES['movie:watched'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.85);
  });

  it('movie:deleted → behavior 流', async () => {
    const { ROUTING_RULES } = await import('../../src/smartcat/routing');
    expect(ROUTING_RULES['movie:deleted'].stream).toBe('behavior');
  });

  it('library:completed → memory 流', async () => {
    const { ROUTING_RULES } = await import('../../src/smartcat/routing');
    const rule = ROUTING_RULES['library:completed'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.85);
  });

  it('library:added → behavior 流', async () => {
    const { ROUTING_RULES } = await import('../../src/smartcat/routing');
    expect(ROUTING_RULES['library:added'].stream).toBe('behavior');
  });

  it('chat:said → memory 流', async () => {
    const { ROUTING_RULES } = await import('../../src/smartcat/routing');
    const rule = ROUTING_RULES['chat:said'];
    expect(rule.stream).toBe('memory');
    expect(rule.importance).toBe(0.75);
  });
});
