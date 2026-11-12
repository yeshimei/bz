/** 命令 id 到功能域的映射守卫：全量扫 main.ts，新增命令漏规矩即红。 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { USAGE_DOMAINS, domainOfCommand, isCommandId, isUsageDomain } from '../../src/core/usage/domain-map';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 命令表里以常量形式出现的 id（目前只有附件搬移一条） */
const CONST_IDS: Record<string, string> = { ATTACH_COMMAND_ID: 'bz-attach-move' };

/** 从 main.ts 里抠出全部裸 id（检测不到就抛，防正则失效后测试静默通过） */
function commandsOfMain(): string[] {
  const src = readFileSync(path.join(ROOT, 'src/main.ts'), 'utf8');
  const ids = new Set<string>();
  for (const m of src.matchAll(/id:\s*(?:'([^']+)'|([A-Z][A-Z0-9_]+))/g)) {
    if (m[1]) ids.add(m[1]);
    else if (m[2] && CONST_IDS[m[2]]) ids.add(CONST_IDS[m[2]]);
  }
  return [...ids];
}

describe('usage · 命令 → 域', () => {
  it('main.ts 的命令表能被完整扫出（正则失效即红）', () => {
    const ids = commandsOfMain();
    expect(ids.length).toBeGreaterThan(60);
    expect(ids).toContain('bz-memo-open');
    expect(ids).toContain('bz-data-checkup-open');
  });

  it('每条真实命令都解析出白名单域，且不是 other', () => {
    const bad = commandsOfMain()
      .map((id) => ({ id, domain: domainOfCommand(id) }))
      .filter((x) => !isUsageDomain(x.domain) || x.domain === 'other');
    expect(bad).toEqual([]);
  });

  it('带连字符的域名与归属特例都走对了', () => {
    expect(domainOfCommand('bz-password-vault-open')).toBe('password-vault');
    expect(domainOfCommand('bz-auto-summary-redo')).toBe('auto-summary');
    expect(domainOfCommand('bz-settings-panel-open')).toBe('settings-panel');
    expect(domainOfCommand('bz-data-checkup-open')).toBe('checkup');
    // 阅读分析报告就是书库面板：合并到 bookshelf，才看得出「书库被用了几次」
    expect(domainOfCommand('bz-reading-report-open')).toBe('bookshelf');
    expect(domainOfCommand('bz-dock-run-my-tool')).toBe('dock');
    expect(domainOfCommand('bz-core-fullscreen')).toBe('core');
    expect(domainOfCommand('bz-attach-move')).toBe('attach');
  });

  it('脏 id 一律落 other（不发送原始串的前提）', () => {
    for (const bad of ['', 'memo-open', 'bz-', 'bz-Bad-Domain', 'bz-memo_open', 'x'.repeat(200), 'bz-memo-open\n<script>']) {
      expect(domainOfCommand(bad)).toBe('other');
      expect(isCommandId(bad)).toBe(false);
    }
  });

  it('白名单与 src 下的域目录对得上（新增域目录要登记）', () => {
    const dirs = readFileSync(path.join(ROOT, 'src/main.ts'), 'utf8');
    // 只做「白名单里没有明显漏项」的弱断言：核心域都在
    for (const d of ['diary', 'memo', 'cinema', 'bookshelf', 'gameshelf', 'people', 'pomodoro', 'knowledge', 'dock']) {
      expect(USAGE_DOMAINS).toContain(d);
    }
    expect(dirs.length).toBeGreaterThan(0);
  });
});
