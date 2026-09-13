// @vitest-environment node
/**
 * 日记格式体检引擎（ADR-0130 重定义）纯函数测试：
 * legacy 旧格式残留 / unparsable 不可解析 / name-mismatch 属性与文件名不一致 / 健康文件零项。
 */
import { describe, expect, it } from 'vitest';
import { lintEntryFile, lintDiaryFiles } from '../../src/diary/repair';
import { serializeDiaryEntryFile } from '../../src/core/diary-format';

const entry = (date: string, time: string, tags: string[], body: string) =>
  serializeDiaryEntryFile({ date, time }, tags, body);

describe('lintEntryFile 规则', () => {
  it('旧格式日期文件（YYYY-MM-DD.md）→ legacy（未迁移残留）', () => {
    expect(lintEntryFile('我的/日记/2026-08-23.md', '# 📖 08:00\n正文\n')).toBe('legacy');
    expect(lintEntryFile('我的/日记/2026-08-23.md', '随便什么内容')).toBe('legacy');
  });

  it('健康条目文件 → null', () => {
    expect(lintEntryFile('我的/日记/2026-08-23 08-00.md', entry('2026-08-23', '08:00', ['日记'], '正文'))).toBeNull();
    // 同刻序号名
    expect(lintEntryFile('我的/日记/2026-08-23 08-00-2.md', entry('2026-08-23', '08:00', ['日记'], '第二条'))).toBeNull();
  });

  it('文件名非条目形状且无属性 → unparsable', () => {
    expect(lintEntryFile('我的/日记/随手记.md', '没有 frontmatter 的普通笔记')).toBe('unparsable');
  });

  it('属性日期损坏且文件名非法日期 → unparsable', () => {
    expect(lintEntryFile('我的/日记/2026-13-45 08-00.md', entry('2026-13-45', '08:00', ['日记'], 'x'))).toBe('unparsable');
  });

  it('属性损坏但文件名合法 → unparsable（运行时已按文件名降级，体检从严上报）', () => {
    const corrupt = '---\n日期: 2026-13-45 99:99\n类型:\n  - 日记\n---\n\n正文';
    expect(lintEntryFile('我的/日记/2026-08-23 08-00.md', corrupt)).toBe('unparsable');
  });

  it('属性合法但文件名非条目形状 → name-mismatch', () => {
    expect(lintEntryFile('我的/日记/2026-08-23 备份.md', entry('2026-08-23', '08:00', ['日记'], '正文'))).toBe('name-mismatch');
  });

  it('属性与文件名日期都能解析但不一致 → name-mismatch', () => {
    expect(lintEntryFile('我的/日记/2026-08-23 08-00.md', entry('2026-08-24', '08:00', ['日记'], '正文'))).toBe('name-mismatch');
  });

  it('CRLF 文件照常体检（归一容错）', () => {
    const crlf = entry('2026-08-23', '08:00', ['日记'], '正文').replace(/\n/g, '\r\n');
    expect(lintEntryFile('我的/日记/2026-08-23 08-00.md', crlf)).toBeNull();
  });
});

describe('lintDiaryFiles 批量', () => {
  it('逐文件产出体检项，健康文件不进清单；顺序保持', () => {
    const items = lintDiaryFiles([
      { path: '我的/日记/2026-08-23 08-00.md', content: entry('2026-08-23', '08:00', ['日记'], '健康') },
      { path: '我的/日记/2026-08-22.md', content: '# 📖 08:00\n旧格式\n' },
      { path: '我的/日记/2026-08-21 08-00.md', content: entry('2026-08-20', '08:00', ['日记'], '错位') },
    ]);
    expect(items.map((i) => [i.path.split('/').pop(), i.reason])).toEqual([
      ['2026-08-22.md', 'legacy'],
      ['2026-08-21 08-00.md', 'name-mismatch'],
    ]);
    expect(items[0].detail).toContain('旧格式');
    expect(items[1].detail).toContain('不一致');
  });

  it('空输入返回空清单', () => {
    expect(lintDiaryFiles([])).toEqual([]);
  });
});
