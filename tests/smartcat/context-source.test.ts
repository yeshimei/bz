// @vitest-environment node
/**
 * 笔记库接入（ticket 025 → 2026-08-23 用户拍板扩展 → ticket 083 收敛）：8 类源路径分类 + 全内容观察文本
 * （LLM 云端打分 + 词法情绪）；reflection（反省）观察 ticket 083 彻底移除。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { classifyPath, observationText, extractKeywords } from '../../src/smartcat/context-source';
import { setSettingsProvider } from '../../src/core/settings-provider';

describe('classifyPath（笔记库接入分类，2026-08-23 扩展 8 类源）', () => {
  afterEach(() => {
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any)); // 还原默认
  });

  it('pomodoro.json 短路路径跟随 storagePath（P2 硬编码路径修复）', () => {
    setSettingsProvider(() => ({ storagePath: 'X/Y' } as any));
    expect(classifyPath('X/Y/pomodoro.json')).toBe('pomodoro');
    expect(classifyPath('CONFIG/STORAGE/pomodoro.json')).toBeNull(); // 旧默认路径不再命中自定义设置
  });
  it('按目录识别 8 类源（diary/flash/clipping/movie/reading/poem/letter，reflection 已移除）', () => {
    expect(classifyPath('我的/日记/2026-08-23.md')).toBe('diary');
    expect(classifyPath('卡片盒/TDD.md')).toBe('flash');
    expect(classifyPath('归档/网页剪藏/xxx.md')).toBe('clipping');
    expect(classifyPath('我的/影视/《楚门的世界》观后感.md')).toBe('movie');
    expect(classifyPath('书库/1984.md')).toBe('reading');
    expect(classifyPath('我的/现代诗/夜航.md')).toBe('poem');
    expect(classifyPath('我的/信/给未来的自己.md')).toBe('letter');
    // ticket 083：反省彻底移除——不再分类（返回 null，不产任何反省观察）
    expect(classifyPath('我的/反省/2026-03.md')).toBeNull();
  });

  it('非 md 与边界目录不识别（我的/日记本 不误判）', () => {
    expect(classifyPath('CONFIG/STORAGE/memo.json')).toBeNull();
    expect(classifyPath('我的/日记本/a.md')).toBeNull();
    expect(classifyPath(null)).toBeNull();
  });
});

describe('observationText（2026-08-23 用户拍板：全内容读取）', () => {
  const appOf = (text: string) => ({ vault: { read: async () => text } }) as any;

  it('flash：取完整内容（原只首行 ≤40）', async () => {
    const t = await observationText(appOf('TDD 的实践总结\n第二行细节\n第三行'), { basename: 'TDD' } as any, 'flash');
    expect(t).toContain('TDD 的实践总结');
    expect(t).toContain('第二行细节'); // 全内容
  });

  it('diary：标记关键词（ADR-0069 R3 收缩：正文不再实时进观察文本）', async () => {
    const body = '今天读完东野圭吾的新书，情节层层推进令人着迷。'.repeat(8); // 长正文（旧实现摘录 300 字进观察）
    const t = await observationText(appOf('# 🐈 20:57\n' + body), {} as any, 'diary');
    expect(t).toContain('你写了日记');
    expect(t).toContain('关键词'); // 关键词标记保留（词法情绪/信任成长钩子不受影响）
    // R3：正文摘录不再拼进观察（记忆目录拆条入库、正文进 prompt 改由记忆检索承担）——
    // 观察文本只剩「你写了日记（关键词：…）」，远短于正文
    expect(t!.length).toBeLessThan(150);
  });

  it('diary：无正文返回 null（空文件跳过）', async () => {
    const t = await observationText(appOf('   \n\n'), {} as any, 'diary');
    expect(t).toBeNull();
  });

  it('clipping：记住完整 AI 摘要（原 ≤60 字截断）', async () => {
    const t = await observationText(appOf('---\nsite: 微信公众号\nsummary: 这是自动生成的中文摘要内容，比较长的一段。\n---\n正文……'), {} as any, 'clipping');
    expect(t).toContain('这是自动生成的中文摘要内容');
  });

  it('movie：读影评完整正文（原只片名+评分）', async () => {
    const t = await observationText(appOf('---\n评分: 9\n---\n这是一段完整的影评正文，表达了对电影的思考。'), { basename: '《楚门的世界》观后感' } as any, 'movie');
    expect(t).toContain('楚门的世界');
    expect(t).toContain('9');
    expect(t).toContain('完整的影评正文');
  });

  it('reading：提取划线（cm-highlight）与想法（==dialogue==）与书评', async () => {
    const body = '---\ntitle: 1984\nbookReview: 值得一读的政治寓言\n---\n==dialogue==\n我的想法：极权下的自我\n<span class="__comment cm-highlight" data-id="x">这是划线的句子。</span>';
    const t = await observationText(appOf(body), { basename: '1984' } as any, 'reading');
    expect(t).toContain('划线');
    expect(t).toContain('这是划线的句子');
    expect(t).toContain('想法');
    expect(t).toContain('我的想法');
    expect(t).toContain('书评');
    expect(t).toContain('值得一读');
  });

  it('poem/letter：完整内容（reflection 分支已删——旧「你写下了反省」不再产，fallthrough 返回 null）', async () => {
    const poem = await observationText(appOf('---\n---\n黑夜给了我黑色的眼睛'), {} as any, 'poem');
    expect(poem).toContain('黑夜给了我黑色的眼睛');
    const letter = await observationText(appOf('亲爱的你，见字如面'), {} as any, 'letter');
    expect(letter).toContain('见字如面');
    // ActivityKind 已移除 'reflection'：按任意旧 kind 调用不产出（switch 无该分支 → null）
    expect(await observationText(appOf('今天反思：不该急躁'), {} as any, null)).toBeNull();
  });

  it('domain：返回 null（由 index onDomainActivity 构造观察）', async () => {
    expect(await observationText(appOf('x'), {} as any, 'domain')).toBeNull();
  });
});

describe('extractKeywords（日记关键词标记）', () => {
  it('提取高频内容词', () => {
    const kws = extractKeywords('东野圭吾的新书读完，东野圭吾总是让人上瘾。', 3);
    expect(kws.length).toBeGreaterThan(0);
    expect(kws.join('')).toContain('东野');
  });

  it('过滤虚词', () => {
    const kws = extractKeywords('今天没有特别的事情，就是普通的一天。', 5);
    expect(kws.some((k) => ['没有', '什么', '就是'].includes(k))).toBe(false);
  });
});