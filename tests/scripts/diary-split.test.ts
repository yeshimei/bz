// @vitest-environment node
/**
 * 日记一目一文件迁移脚本（scripts/diary-split.mjs / issue 304 / ADR-0130）回归测试。
 *
 * 真实 vault 上跑过一次后发现：记忆引用重写用正则扫 JSON 文本，`ref.path` 那处后面不跟
 * `#locator`（locator 是独立字段）而命中「该日期最早条目」兜底分支——`#15:12` 的引用被写
 * 成当天 09:00 条目文件，插件启动即按 refSegmentAlive 判失效、删除并按正确路径重建
 * （白烧 731 次 AI 打分与向量化）。此处固化「ref.path 与 description 都按 ref.locator 重指」
 * 的语义，并守住拆分/归档/不拆（未解析行）三条数据安全线。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = path.join(ROOT, 'scripts/diary-split.mjs');

const DAY_FILE = '我的/日记/2025-06-11.md';
const MEMORY_FILE = 'CONFIG/STORAGE/smartcat-memory.json';
/** 两个同刻条目：基名 + -2（迁移后 15-12 的引用应落在基名条目） */
const DAY_CONTENT = '# 📖 09:00\n早上写的\n# 📖 15:12\n下午写的\n# 📖 15:12\n下午又写\n';
/** m1 带 locator（= 非最早时刻 → 旧实现写错的那类）；m2 无 locator（兜底最早条目） */
const MEMORY_CONTENT = JSON.stringify(
  {
    version: 1,
    lastUpdated: '2026-01-01T00:00:00.000Z',
    entries: [
      {
        id: 'm1',
        description: `${DAY_FILE}#15:12`,
        ref: { path: DAY_FILE, locator: '15:12' },
        contentHash: 'aaa',
      },
      { id: 'm2', description: DAY_FILE, ref: { path: DAY_FILE }, contentHash: 'bbb' },
      { id: 'm3', description: '我的/其他/随笔.md', ref: { path: '我的/其他/随笔.md' }, contentHash: 'ccc' },
    ],
  },
  null,
  2
);

let vault = '';
function makeVault(dayContent = DAY_CONTENT): string {
  vault = fs.mkdtempSync(path.join(os.tmpdir(), 'bz-diary-split-'));
  write(DAY_FILE, dayContent);
  write(MEMORY_FILE, MEMORY_CONTENT);
  return vault;
}
function write(rel: string, content: string): void {
  const abs = path.join(vault, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}
function read(rel: string): string {
  return fs.readFileSync(path.join(vault, rel), 'utf8');
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(vault, rel));
}
/** 跑脚本（--skip-obsidian-check：测试机可能正开着 Obsidian，进程检测与本测试无关） */
function run(...args: string[]): string {
  return execFileSync(process.execPath, [SCRIPT, '--vault', vault, '--skip-obsidian-check', ...args], {
    encoding: 'utf8',
  });
}
function memoryEntries(): { id: string; description?: string; ref: { path: string; locator?: string } }[] {
  return JSON.parse(read(MEMORY_FILE)).entries;
}

afterEach(() => {
  if (vault) fs.rmSync(vault, { recursive: true, force: true });
  vault = '';
});

describe('diary-split 迁移脚本', () => {
  it('拆分：每条目一文件（同刻 -2 让位）、原日期文件归档、条目内容与 head 行一致', () => {
    makeVault();
    run('--apply');

    expect(read('我的/日记/2025-06-11 09-00.md')).toBe(
      '---\n日期: 2025-06-11 09:00\n类型:\n  - 日记\n---\n\n早上写的\n'
    );
    expect(read('我的/日记/2025-06-11 15-12.md')).toContain('下午写的');
    expect(read('我的/日记/2025-06-11 15-12-2.md')).toContain('下午又写');
    // 原文件归档、原位不残留（新解析层不做旧格式兼容）
    expect(exists(DAY_FILE)).toBe(false);
    expect(read('归档/日记/2025-06-11.md')).toBe(DAY_CONTENT);
  });

  it('回归：ref.path 按 ref.locator 指向该时刻条目（旧实现一律写当天最早条目）', () => {
    makeVault();
    run('--apply');

    const [m1, m2, m3] = memoryEntries();
    // 15:12 不是当天最早（09:00 才是）——旧实现这里写成 2025-06-11 09-00.md
    expect(m1.ref.path).toBe('我的/日记/2025-06-11 15-12.md');
    expect(m1.ref.locator).toBe('15:12');
    expect(m1.description).toBe('我的/日记/2025-06-11 15-12.md#15:12');
    // 无 locator → 该日期最早条目；同刻多条 → 基名条目（'-2' 让位）
    expect(m2.ref.path).toBe('我的/日记/2025-06-11 09-00.md');
    expect(m2.description).toBe('我的/日记/2025-06-11 09-00.md');
    // 非日记记忆不动
    expect(m3.ref.path).toBe('我的/其他/随笔.md');
    expect(m3.description).toBe('我的/其他/随笔.md');
    // 同刻多条一律取基名条目（'-2' 文件不抢引用——'-' 的字典序在 '.' 之前，别按 readdir 首见）
    expect(memoryEntries().every((m) => !/ \d{2}-\d{2}-\d+\.md$/.test(m.ref.path))).toBe(true);
  });

  it('emoji 头行按 grapheme 切分：多码点 emoji 不丢标签、不误命中片段', () => {
    makeVault('# ✍️ 10:00\n随笔内容\n# ⚙️ 11:00\n代码内容\n# 📸✈️ 12:00\n旅行照片\n# 🧑‍🎨 13:00\n艺术内容\n');
    run('--apply');

    // 变体选择符（U+FE0F）：按码点迭代会拆碎 → 反查失配回落「日记」
    expect(read('我的/日记/2025-06-11 10-00.md')).toContain('  - 随笔');
    expect(read('我的/日记/2025-06-11 10-00.md')).not.toContain('  - 日记');
    expect(read('我的/日记/2025-06-11 11-00.md')).toContain('  - 代码');
    // 组合头行：📸 命中、✈️ 不丢
    expect(read('我的/日记/2025-06-11 12-00.md')).toContain('  - 摄影');
    expect(read('我的/日记/2025-06-11 12-00.md')).toContain('  - 旅游');
    // ZWJ 序列（U+1F9D1 U+200D U+1F3A8）：按码点会误命中尾段 🎨 → 错标「动漫」
    expect(read('我的/日记/2025-06-11 13-00.md')).toContain('  - 艺术');
    expect(read('我的/日记/2025-06-11 13-00.md')).not.toContain('  - 动漫');
  });

  it('记忆重写留 .bak 快照（内容为改写前原文）', () => {
    makeVault();
    run('--apply');
    expect(read(`${MEMORY_FILE}.bak-diary-split`)).toBe(MEMORY_CONTENT);
  });

  it('--memory-only 幂等：已迁移 vault 复跑零改写、记忆文件逐字节不变', () => {
    makeVault();
    run('--apply');
    const after = read(MEMORY_FILE);
    const out = run('--memory-only', '--apply');
    expect(out).toContain('记忆条目重写: 0');
    expect(read(MEMORY_FILE)).toBe(after);
  });

  it('dry-run 不写盘：条目未拆、原文件在、记忆引用未改', () => {
    makeVault();
    const out = run();
    expect(out).toContain('dry-run');
    expect(exists('我的/日记/2025-06-11 09-00.md')).toBe(false);
    expect(read(DAY_FILE)).toBe(DAY_CONTENT);
    expect(read(MEMORY_FILE)).toBe(MEMORY_CONTENT);
    expect(exists(`${MEMORY_FILE}.bak-diary-split`)).toBe(false);
  });

  it('有未解析行 → 整个文件不拆（防丢行）并列人工清单', () => {
    makeVault('游离正文\n# 📖 09:00\n早上写的\n');
    const out = run('--apply');
    expect(out).toContain('需人工处理: 1');
    expect(exists('我的/日记/2025-06-11 09-00.md')).toBe(false);
    expect(read(DAY_FILE)).toBe('游离正文\n# 📖 09:00\n早上写的\n'); // 原文件不动
    expect(exists('归档/日记/2025-06-11.md')).toBe(false); // 未拆分 → 不归档
  });
});
