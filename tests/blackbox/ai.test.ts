/**
 * 黑匣子 AI 纯函数测试（ticket 36/37）：人设 prompt 组装/复盘 prompt/JSON 容错解析/感触检索。
 */
import { describe, it, expect } from 'vitest';
import {
  buildPersonaPrompt,
  buildReviewPrompt,
  buildAssistPrompt,
  parseReviewJson,
  searchImpressions,
  fallbackAsk,
  FALLBACK_ASK_PROMPTS,
} from '../../src/blackbox/ai';
import { DEFAULT_PERSONA } from '../../src/blackbox/types';
import type { Impression } from '../../src/blackbox/types';

const imp = (id: string, material: string, feeling: string): Impression => ({
  id,
  ts: '2026-07-21T02:06:00.000Z',
  material,
  feeling,
  emotions: [{ tag: '触动', intensity: 4 }],
  scene: '',
  people: '',
  direction: '',
  links: [],
});

describe('buildPersonaPrompt 三层记忆组装', () => {
  const ctx = {
    persona: DEFAULT_PERSONA,
    related: [imp('i1', '茉莉花的香气', '夏夜凉风')],
    impressionCount: 5,
    history: [{ role: 'user' as const, text: '你还记得茉莉花吗', ts: 't1' }],
  };

  it('包含种子/语气/计数/相关感触/历史/当前消息', () => {
    const p = buildPersonaPrompt(ctx, '我今晚又闻到了');
    expect(p).toContain('包仔');
    expect(p).toContain(DEFAULT_PERSONA.seed);
    expect(p).toContain(DEFAULT_PERSONA.toneExample);
    expect(p).toContain('5 条感触');
    expect(p).toContain('茉莉花的香气');
    expect(p).toContain('你还记得茉莉花吗');
    expect(p).toContain('我今晚又闻到了');
    expect(p).toContain('主人现在说');
  });

  it('无相关感触/无历史时省略对应区块', () => {
    const p = buildPersonaPrompt(
      { persona: DEFAULT_PERSONA, related: [], impressionCount: 0, history: [] },
      '你好'
    );
    expect(p).not.toContain('此刻你想起的相关感触');
    expect(p).not.toContain('最近的对话');
    expect(p).toContain('0 条感触');
  });

  it('自我认知（生长）写入 prompt', () => {
    const persona = { ...DEFAULT_PERSONA, selfViews: [{ ts: 't', view: '我越来越懂主人了' }] };
    const p = buildPersonaPrompt({ persona, related: [], impressionCount: 1, history: [] }, '嗨');
    expect(p).toContain('我越来越懂主人了');
  });
});

describe('buildReviewPrompt 复盘 prompt', () => {
  it('列出最近感触并要求 JSON 输出', () => {
    const p = buildReviewPrompt(DEFAULT_PERSONA, [imp('i1', 'A', 'B'), imp('i2', 'C', 'D')], 12);
    expect(p).toContain('12 条感触');
    expect(p).toContain('最近 2 条');
    expect(p).toContain('"text"');
    expect(p).toContain('"newSelfView"');
  });
});

describe('buildAssistPrompt 录入辅助', () => {
  it('查概念：口语化解释', () => {
    const p = buildAssistPrompt('concept', '熵增');
    expect(p).toContain('熵增');
    expect(p).toContain('2-3 句话');
  });

  it('联想：带相关旧感触', () => {
    const p = buildAssistPrompt('recall', '新感触', [imp('i1', '旧素材', '旧感受')]);
    expect(p).toContain('这让我想起');
    expect(p).toContain('旧素材');
  });

  it('追问：不超过 40 字', () => {
    const p = buildAssistPrompt('ask', '一句话');
    expect(p).toContain('一句话');
    expect(p).toContain('40 字');
  });
});

describe('parseReviewJson 容错解析', () => {
  it('纯 JSON 解析', () => {
    const r = parseReviewJson('{"text": "一段话", "newSelfView": "认知"}');
    expect(r).toEqual({ text: '一段话', newSelfView: '认知' });
  });

  it('带前缀后缀噪音时提取 {} 块', () => {
    const r = parseReviewJson('好的\n```json\n{"text": "话", "newSelfView": ""}\n```');
    expect(r).toEqual({ text: '话', newSelfView: '' });
  });

  it('非 JSON/坏 JSON 回退 null', () => {
    expect(parseReviewJson('我只是想说话')).toBeNull();
    expect(parseReviewJson('{"text": }')).toBeNull();
    expect(parseReviewJson('')).toBeNull();
  });
});

describe('searchImpressions 感触检索（TF-IDF）', () => {
  const impressions = [
    imp('i1', '茉莉花在夏夜的风里', '暗香浮动'),
    imp('i2', '量子隧穿宏观尺度', '科学转折'),
    imp('i3', '给妹妹买吉他', '她一生的精神力量'),
  ];

  it('命中相关素材并排序（相关度高的在前）', () => {
    const hits = searchImpressions(impressions, '夏夜茉莉', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe('i1');
  });

  it('空查询/空库返回空', () => {
    expect(searchImpressions(impressions, '')).toEqual([]);
    expect(searchImpressions([], '茉莉')).toEqual([]);
  });
});

describe('fallbackAsk 本地追问文案', () => {
  it('在预设文案间轮换', () => {
    expect(FALLBACK_ASK_PROMPTS.length).toBeGreaterThan(0);
    expect(fallbackAsk(0)).toBe(FALLBACK_ASK_PROMPTS[0]);
    expect(fallbackAsk(3)).toBe(FALLBACK_ASK_PROMPTS[0]); // 3 % 3 = 0
  });
});
