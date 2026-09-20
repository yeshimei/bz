// @vitest-environment node
/**
 * YAML 标量转义 core 单源契约测试（一致#1 / AS1 / C27 收编批）。
 *
 * 单源：src/core/utils.ts escapeYamlText（裸转义核心）+ yamlEscapeQuoted（恒包裹）
 * + yamlScalarOf（条件包裹）+ unescapeYamlText（反转义）。三域消费点各钉一条防退役：
 * - clipbook save.ts 写侧（模板内嵌引号 → 裸核心）；
 * - auto-summary parser.ts 重建 + unquote 反转义对齐（AS1）；
 * - cinema douban-fetcher.ts 条件包裹（策略保留、原语单源）。
 * round-trip 契约（含反斜杠值——AS1 修复前必红形态）见文件尾。
 */
import { describe, it, expect } from 'vitest';
import {
  escapeYamlText,
  yamlEscapeQuoted,
  yamlScalarOf,
  unescapeYamlText,
} from '../src/core/utils';
import { parseFrontmatter, buildFrontmatter } from '../src/auto-summary/parser';

describe('core yaml 转义单源（escapeYamlText 原语）', () => {
  it('先转义反斜杠再转义引号（C27 顺序铁律）', () => {
    expect(escapeYamlText('a\\b"c')).toBe('a\\\\b\\"c');
  });

  it('换行折空格（含 CRLF 与连续换行）', () => {
    expect(escapeYamlText('第一行\n第二行\r\n第三行')).toBe('第一行 第二行 第三行');
  });

  it('恒包裹出口 yamlEscapeQuoted：值一律双引号标量', () => {
    expect(yamlEscapeQuoted('plain')).toBe('"plain"');
    expect(yamlEscapeQuoted('C:\\Users\\bz')).toBe('"C:\\\\Users\\\\bz"');
    expect(yamlEscapeQuoted(null)).toBe('""');
  });

  it('条件包裹出口 yamlScalarOf：特殊字符/空格才包裹（cinema 契约）', () => {
    expect(yamlScalarOf('普通值')).toBe('普通值');
    expect(yamlScalarOf('含 空格')).toBe('"含 空格"');
    expect(yamlScalarOf('含:冒号')).toBe('"含:冒号"');
    expect(yamlScalarOf('多\n行')).toBe('"多 行"');
    expect(yamlScalarOf('C:\\path')).toBe('"C:\\\\path"');
  });

  it('反转义 unescapeYamlText：写侧两形转义还原，未知转义原样保留', () => {
    expect(unescapeYamlText('a\\\\b\\"c')).toBe('a\\b"c');
    expect(unescapeYamlText('\\n')).toBe('\\n'); // 字面 \n 两字符不吞（写侧不产出该形态）
  });
});

describe('三域消费点防退役', () => {
  // clipbook save 写侧行为（含 DOM 通知链）在 tests/review-fix-clip2-data.test.ts C27
  // 与 tests/auto-summary/deep-review-fix.test.ts（tags 数组项断言）钉住，此处不重复 node 化。

  it('auto-summary parser 重建：标量与数组项走单源（转义引号/反斜杠/换行）', () => {
    const out = buildFrontmatter({ title: '他"说"\\斜杠\n换行', tags: ['a"b\\c'] });
    expect(out).toContain('title: "他\\"说\\"\\\\斜杠 换行"');
    expect(out).toContain('  - "a\\"b\\\\c"');
  });

  it('cinema formatYamlValue 条件包裹（updateFrontmatterFields 产物钉住）', async () => {
    const { updateFrontmatterFields } = await import('../src/cinema/douban-fetcher');
    const out = updateFrontmatterFields('---\ntitle: 测试片\n---\n\n正文', {
      导演: '某人', // 裸值（无特殊字符不包裹）
      原名: 'A: B', // 含冒号 → 包裹
      反斜杠: 'C:\\path',
    });
    expect(out).toContain('导演: 某人');
    expect(out).toContain('原名: "A: B"');
    expect(out).toContain('反斜杠: "C:\\\\path"');
  });
});

describe('AS1 往返契约（修复前必红形态：含反斜杠/字面 \\n 的值幂等不变形）', () => {
  /** round-trip：parse → build → parse 幂等且值不变形 */
  function roundtrip(src: string): Record<string, any> {
    const p1 = parseFrontmatter(src);
    const built = buildFrontmatter(p1.fm!, p1.extraLines) + '\n\n' + p1.body;
    const p2 = parseFrontmatter(built);
    return p2.fm!;
  }

  it('URL 含反斜杠往返不变形', () => {
    const fm = roundtrip('---\ntitle: "C:\\path\\to\\file"\n---\n正文');
    expect(fm.title).toBe('C:\\path\\to\\file');
  });

  it('字面 \\n（两字符）经转义往返不被解读成真换行', () => {
    const fm = roundtrip('---\nsummary: "行字面\\n两字符"\n---\n正文');
    expect(fm.summary).toBe('行字面\\n两字符');
  });

  it('引号与反斜杠混排往返不变形', () => {
    const fm = roundtrip('---\ntitle: "他说\\"好\\"\\\\嗯"\n---\n正文');
    expect(fm.title).toBe('他说"好"\\嗯');
  });

  it('N2：tags 数组项含引号/反斜杠往返不变形', () => {
    const p1 = parseFrontmatter('---\ntags:\n  - "a\\"b"\n  - "c\\\\d"\n---\n正文');
    expect(p1.fm!.tags).toEqual(['a"b', 'c\\d']);
    const fm = roundtrip('---\ntags:\n  - "a\\"b"\n  - "c\\\\d"\n---\n正文');
    expect(fm.tags).toEqual(['a"b', 'c\\d']);
  });

  it('clipbook 写侧形态（双引号转义产物）：url 非管辖键原文行保留零变形（A1 后不再重序列化）', () => {
    const src = '---\nurl: "https://x.com/a\\\\b"\nauthor: "C:\\\\Users\\\\bz"\n---\n正文';
    const p1 = parseFrontmatter(src);
    const out = buildFrontmatter(p1.fm!, p1.extraLines) + '\n\n' + p1.body;
    expect(out).toContain('url: "https://x.com/a\\\\b"'); // 原文行原样拼回
    expect(out).toContain('author: "C:\\\\Users\\\\bz"');
  });
});

describe('AS2 无尾换行 frontmatter（修复前必红：fm=null → 旧 frontmatter 复制进正文区）', () => {
  it('文件以 frontmatter 结尾且无尾换行 → fm 正常解析、body 为空', () => {
    const r = parseFrontmatter('---\ntitle: "T"\nurl: "https://x.com/a"\n---');
    expect(r.fm).not.toBeNull();
    expect(r.fm!.title).toBe('T');
    expect(r.body).toBe('');
  });

  it('无尾换行 + 缺字段重建：旧 frontmatter 不再被复制进正文区', () => {
    const src = '---\ntitle: "T"\nurl: "https://x.com/a"\n---';
    const p1 = parseFrontmatter(src);
    expect(p1.fm).not.toBeNull();
    const out = buildFrontmatter({ ...p1.fm!, summary: '新摘要' }, p1.extraLines) + '\n\n' + p1.body;
    // frontmatter 只出现一次（修复前：闭合正则不命中 → 全文当正文 → 重建后旧 FM 文本进正文区）
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).not.toContain('url: "https://x.com/a"\nurl:');
    const fmCount = out.split('---').length - 1;
    expect(fmCount).toBe(2); // 开/闭各一
  });

  it('标准带尾换行形态行为不变', () => {
    const r = parseFrontmatter('---\ntitle: "T"\n---\n正文');
    expect(r.fm!.title).toBe('T');
    expect(r.body).toBe('正文');
  });
});

describe('A1 管辖键白名单：非管辖数值/布尔键类型零漂移（修复前必红）', () => {
  it('数值/布尔/小数键 round-trip 保留裸形态', () => {
    const src = '---\ntitle: "T"\ncount: 3\nok: true\nscore: 4.5\n---\n正文';
    const p1 = parseFrontmatter(src);
    const out = buildFrontmatter(p1.fm!, p1.extraLines) + '\n\n' + p1.body;
    expect(out).toContain('count: 3'); // 不是 "3"
    expect(out).toContain('ok: true'); // 不是 "true"
    expect(out).toContain('score: 4.5'); // 不是 "4.5"
    expect(out).not.toContain('"3"');
    expect(out).not.toContain('"true"');
  });

  it('非管辖键在 fm 不可见但原文行保留（属性面板类型不再冲突）', () => {
    const r = parseFrontmatter('---\ntitle: "T"\n评分: 5\nurl: "https://x.com/a"\n---\n正文');
    expect(r.fm!.title).toBe('T');
    expect(r.fm!['评分']).toBeUndefined();
    expect(r.extraLines).toContain('评分: 5');
    expect(r.extraLines).toContain('url: "https://x.com/a"');
  });

  it('管辖键块标量/列表行为不变；非管辖键附属行（列表项/缩进块）整段原文保留', () => {
    const src = '---\ntitle: "T"\ncreated: 2026-09-19 12:34:56\nextra:\n  - "a"\n  - b\n---\n正文';
    const r = parseFrontmatter(src);
    expect(r.fm!.title).toBe('T');
    expect(r.extraLines).toContain('created: 2026-09-19 12:34:56');
    expect(r.extraLines).toContain('extra:');
    expect(r.extraLines).toContain('  - "a"');
    expect(r.extraLines).toContain('  - b');
  });
});

describe('N3 流式数组解析降级为字符串（消费侧宁缺勿覆）', () => {
  it("单引号流式数组 tags: ['a', 'b'] → 降级为字符串不抛错", () => {
    const r = parseFrontmatter("---\ntitle: \"T\"\ntags: ['a', 'b']\n---\n正文");
    expect(r.fm!.tags).toBe("['a', 'b']");
  });

  it('无引号流式数组 tags: [a, b] → 同样降级为字符串', () => {
    const r = parseFrontmatter('---\ntitle: "T"\ntags: [a, b]\n---\n正文');
    expect(r.fm!.tags).toBe('[a, b]');
  });

  it('JSON 严格数组仍解析为数组（不回归）', () => {
    const r = parseFrontmatter('---\ntags: ["a", "b"]\n---\n正文');
    expect(r.fm!.tags).toEqual(['a', 'b']);
  });
});
