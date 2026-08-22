/**
 * 笔记库接入（ticket 025，ADR-0024 决策）：路径分类 + 隐私分级观察文本
 */
import { describe, it, expect } from 'vitest';
import { classifyPath, observationText } from '../../src/smartcat/context-source';

describe('classifyPath（笔记库接入分类）', () => {
  it('按目录识别 diary/flash/clipping/movie/reading', () => {
    expect(classifyPath('我的/日记/2026-08-23.md')).toBe('diary');
    expect(classifyPath('卡片盒/TDD.md')).toBe('flash');
    expect(classifyPath('归档/网页剪藏/xxx.md')).toBe('clipping');
    expect(classifyPath('我的/影视/《楚门的世界》观后感.md')).toBe('movie');
    expect(classifyPath('书库/1984.md')).toBe('reading');
  });

  it('非 md 与边界目录不识别（我的/日记本 不误判）', () => {
    expect(classifyPath('CONFIG/STORAGE/memo.json')).toBeNull();
    expect(classifyPath('我的/日记本/a.md')).toBeNull();
    expect(classifyPath(null)).toBeNull();
  });
});

describe('observationText（隐私分级观察：不读私人正文/不引正文句子）', () => {
  const appOf = (text: string) => ({ vault: { read: async () => text } }) as any;

  it('flash：取首行标题（闪念内容本身就是要记的）', async () => {
    const t = await observationText(appOf('TDD 的实践总结\n正文……'), { basename: 'TDD' } as any, 'flash');
    expect(t).toContain('TDD 的实践总结');
  });

  it('diary：只取条目标题计数，正文句子不进观察', async () => {
    const t = await observationText(appOf('# 🐈 20:57\n第一条正文秘密\n# 📖 23:02\n第二条正文秘密'), {} as any, 'diary');
    expect(t).toContain('2 条日记');
    expect(t).not.toContain('第一条正文秘密');
  });

  it('clipping：取 frontmatter 的 AI summary（auto-summary 产物，非私人正文）', async () => {
    const t = await observationText(appOf('---\nsite: 微信公众号\nsummary: 这是自动生成的中文摘要内容\n---\n正文……'), {} as any, 'clipping');
    expect(t).toContain('这是自动生成的中文摘要内容');
  });

  it('movie：片名（去《》）+ 评分（元数据）', async () => {
    const t = await observationText(appOf('---\n评分: 9\n---\n影评……'), { basename: '《楚门的世界》观后感' } as any, 'movie');
    expect(t).toContain('楚门的世界');
    expect(t).toContain('9');
  });
});