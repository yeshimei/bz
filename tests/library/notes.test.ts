/**
 * 书库 notes 测试（ticket 12）：parseBookNotes / updateComment / deleteHighlight。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { parseBookNotes, updateComment, deleteHighlight } from '../../src/library/notes';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return { vault, metadataCache: {}, workspace: {} } as any;
}

const NOTE_MD = `# 第一章

这是第一句 <span data-id="h1" data-comment="批注一" data-date="2025-06-01" class="__comment cm-highlight">原文一</span> 的尾巴。

## 小节

<span data-id="h2" class="__comment cm-highlight">原文二</span>

# 第二章

<span data-id="h3" data-comment="批注三" class="__comment cm-highlight">原文三</span>
`;

describe('parseBookNotes', () => {
  it('headings + highlights 建树（h2 挂在 h1 下）', () => {
    const parsed = parseBookNotes(NOTE_MD, '活着');
    expect(parsed.bookTitle).toBe('活着');
    expect(parsed.root.children.length).toBe(2);
    const ch1 = parsed.root.children[0];
    expect(ch1.heading).toBe('第一章');
    expect(ch1.highlights.length).toBe(1);
    expect(ch1.highlights[0].id).toBe('h1');
    expect(ch1.highlights[0].comment).toBe('批注一');
    expect(ch1.highlights[0].date).toBe('2025-06-01');
    expect(ch1.children.length).toBe(1);
    expect(ch1.children[0].heading).toBe('小节');
    expect(ch1.children[0].highlights.length).toBe(1);
    expect(ch1.children[0].highlights[0].id).toBe('h2');
    expect(ch1.hasHighlight).toBe(true);
  });

  it('无高亮 → 空 root', () => {
    const parsed = parseBookNotes('# 只有标题\n\n没有高亮', '书');
    expect(parsed.root.children.length).toBe(0);
    expect(parsed.root.highlights.length).toBe(0);
  });

  it('无 id 的 span 跳过', () => {
    const md = '<span class="__comment cm-highlight">无 id</span>';
    const parsed = parseBookNotes(md, '书');
    expect(parsed.root.children.length).toBe(0);
  });

  it('无 children 但有 highlight 挂在 root 下（无标题场景）', () => {
    const md = '<span data-id="x1" class="__comment cm-highlight">裸高亮</span>';
    const parsed = parseBookNotes(md, '书');
    expect(parsed.root.highlights.length).toBe(1);
    expect(parsed.root.highlights[0].id).toBe('x1');
  });
});

describe('updateComment / deleteHighlight', () => {
  let vault: MockVault;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    vault.files.set('书库/活着.md', NOTE_MD);
    setApp(makeApp(vault));
  });

  it('updateComment：更新 data-comment 值', async () => {
    let done = false;
    updateComment(makeApp(vault), '书库/活着.md', 'h1', '原文一', '新批注', () => { done = true; });
    await new Promise((r) => setTimeout(r, 20));
    const out = vault.files.get('书库/活着.md')!;
    expect(out).toContain('data-comment="新批注"');
    expect(hasNotice('批注已更新')).toBe(true);
    expect(done).toBe(true);
  });

  it('updateComment：清空 → 删属性 + 「批注已清空」', async () => {
    updateComment(makeApp(vault), '书库/活着.md', 'h1', '原文一', '');
    await new Promise((r) => setTimeout(r, 20));
    const out = vault.files.get('书库/活着.md')!;
    expect(out).not.toContain('data-comment="批注一"');
    expect(hasNotice('批注已清空')).toBe(true);
  });

  it('updateComment：无 data-comment → 插入属性', async () => {
    updateComment(makeApp(vault), '书库/活着.md', 'h2', '原文二', '新增批注');
    await new Promise((r) => setTimeout(r, 20));
    const out = vault.files.get('书库/活着.md')!;
    expect(out).toContain('<span data-comment="新增批注" data-id="h2"');
  });

  it('updateComment：原文不匹配 → 「未找到对应高亮（原文不匹配），编辑失败」', async () => {
    updateComment(makeApp(vault), '书库/活着.md', 'h1', '不存在的原文', 'x');
    await new Promise((r) => setTimeout(r, 20));
    expect(hasNotice('未找到对应高亮（原文不匹配），编辑失败')).toBe(true);
    expect(vault.modifiedPaths).toHaveLength(0);
  });

  it('deleteHighlight：confirm 取消 → 不删', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    deleteHighlight(makeApp(vault), '书库/活着.md', 'h1', '原文一');
    await new Promise((r) => setTimeout(r, 20));
    expect(vault.modifiedPaths).toHaveLength(0);
    spy.mockRestore();
  });

  it('deleteHighlight：确认 → 删除 span + 「已删除」', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteHighlight(makeApp(vault), '书库/活着.md', 'h1', '原文一', () => {});
    await new Promise((r) => setTimeout(r, 20));
    const out = vault.files.get('书库/活着.md')!;
    expect(out).not.toContain('data-id="h1"');
    expect(out).toContain('data-id="h2"'); // 其他保留
    expect(hasNotice('已删除')).toBe(true);
    spy.mockRestore();
  });

  it('deleteHighlight：不匹配 → 「未找到对应高亮（原文不匹配），删除失败」', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteHighlight(makeApp(vault), '书库/活着.md', 'h1', '错原文');
    await new Promise((r) => setTimeout(r, 20));
    expect(hasNotice('未找到对应高亮（原文不匹配），删除失败')).toBe(true);
    spy.mockRestore();
  });

  it('updateComment（P1-18）：含 $&、$`、双引号的批注往返无损——转义 &quot; 且 $ 序列不被当替换模式', async () => {
    const tricky = '说"$&"与"$`"完';
    const escaped = '说&quot;$&&quot;与&quot;$`&quot;完'; // 四个双引号全转义；$ 序列原样
    let done = false;
    updateComment(makeApp(vault), '书库/活着.md', 'h1', '原文一', tricky, () => { done = true; });
    await new Promise((r) => setTimeout(r, 20));
    expect(done).toBe(true);
    const out = vault.files.get('书库/活着.md')!;
    // 双引号已转义；$&/$` 原样落盘（字符串替换模式注入已杜绝）；同 span 的 data-date 完好
    expect(out).toContain(`data-comment="${escaped}" data-date="2025-06-01"`);
    // reparse 一致：读回值 = 写入的转义形态
    const reparsed = parseBookNotes(out, '活着');
    expect(reparsed.root.children[0].highlights[0].comment).toBe(escaped);
    // 以读回值再存一次（幂等）：不二次转义、内容稳定
    clearNotices();
    updateComment(makeApp(vault), '书库/活着.md', 'h1', '原文一', escaped);
    await new Promise((r) => setTimeout(r, 20));
    expect(vault.files.get('书库/活着.md')).toBe(out);
    expect(hasNotice('批注已更新')).toBe(true);
  });

  it('updateComment（P1-18）：插入路径同样转义且不受 $ 模式影响', async () => {
    updateComment(makeApp(vault), '书库/活着.md', 'h2', '原文二', '"$&新增');
    await new Promise((r) => setTimeout(r, 20));
    const out = vault.files.get('书库/活着.md')!;
    expect(out).toContain('<span data-comment="&quot;$&新增" data-id="h2"');
  });

  it('updateComment（P1-18）：同值保存不再误报失败', async () => {
    let done = false;
    updateComment(makeApp(vault), '书库/活着.md', 'h1', '原文一', '批注一', () => { done = true; });
    await new Promise((r) => setTimeout(r, 20));
    expect(done).toBe(true);
    expect(hasNotice('批注已更新')).toBe(true);
    expect(hasNotice('未找到对应高亮（原文不匹配），编辑失败')).toBe(false);
  });
});
