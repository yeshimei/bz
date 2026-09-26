// @vitest-environment node
/**
 * 皮肤包**唯一注入点**静态守卫（ADR-0199 决策 4 / AGENTS.md 铁律 4 的例外条款）。
 *
 * 铁律 4 的价值是「样式静态、单源、可审查」——ADR-0020 曾明确否决运行时注入 `<style>`，
 * ADR-0199 只为一件事开例外：**远端皮肤包**。例外一旦有第二处使用就废了，所以这里把它
 * 焊死：全仓除 `src/core/skin-pack.ts` 外，任何 `.ts` 都不许构造/注入 `<style>`。
 *
 * 同时跑两支迁移/出版脚本的 `--check`：切分器残留（源里还留着该搬走的皮肤规则）与
 * 出版产物落后（改了皮没重出版）都是**静默失效**，必须在这里拦下。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** 唯一被允许注入的模块（ADR-0199 决策 4） */
const INJECTION_OWNER = 'src/core/skin-pack.ts';

/** 列出 src 下所有 .ts */
function allSources(dir = path.join(ROOT, 'src'), out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) allSources(abs, out);
    else if (e.name.endsWith('.ts')) out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
  }
  return out;
}

/** 列出 src 下所有 .css（样式侧也是注入面：`@import` 能绕过 `<style>` 守卫拉远端样式） */
function allStyles(dir = path.join(ROOT, 'src'), out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) allStyles(abs, out);
    else if (e.name.endsWith('.css')) out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
  }
  return out;
}

/** 「构造/挂载 style 节点」的写法（注释里的字面量不算——先剥注释） */
const STYLE_INJECTION = [
  /createElement\(\s*['"`]style['"`]\s*\)/,
  /<style[\s>]/i,
  /insertAdjacentHTML\([^)]*<style/i,
];

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('唯一注入点守卫（铁律 4 / ADR-0199）', () => {
  it(`${INJECTION_OWNER} 之外，src 下没有任何 <style> 注入`, () => {
    const offenders: string[] = [];
    for (const rel of allSources()) {
      if (rel === INJECTION_OWNER) continue;
      const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      for (const re of STYLE_INJECTION) {
        if (re.test(code)) {
          offenders.push(`${rel}（命中 ${re}）`);
          break;
        }
      }
    }
    expect(offenders, `运行时注入 <style> 只允许在 ${INJECTION_OWNER}（要第二处请另开 ADR）`).toEqual([]);
  });

  it('唯一注入点确实存在且真的在注入（防守卫把「功能被删」当干净）', () => {
    const code = fs.readFileSync(path.join(ROOT, INJECTION_OWNER), 'utf8');
    expect(code).toMatch(/createElement\(\s*'style'\s*\)/);
    expect(code).toContain("'bz-skin-pack-style'");
  });

  it('其余域不得自行注入皮肤样式（错挂到别的 id / 别的挂载点）', () => {
    const offenders = allSources().filter(
      (rel) => rel !== INJECTION_OWNER && fs.readFileSync(path.join(ROOT, rel), 'utf8').includes('bz-skin-pack-style'),
    );
    expect(offenders).toEqual([]);
  });

  it('样式侧也没有第二通道（src/**/*.css 不得 @import 或 url() 引远端）', () => {
    // `@import url(https://…)` 能绕过上面那条「不得注入 <style>」——样式照样是运行时拉的，
    // 且**没有 sha256 校验**，比注入更坏。皮肤包必须走 skin-pack 的单一通道。
    const offenders: string[] = [];
    for (const rel of allStyles()) {
      const css = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      if (/@import\b[^;]*(\/\/|https?:)/i.test(css) || /url\(\s*['"]?https?:\/\//i.test(css)) {
        offenders.push(rel);
      }
    }
    expect(offenders, '远端样式只允许经 src/core/skin-pack.ts 注入（要第二通道请另开 ADR）').toEqual([]);
  });
});

describe('迁移/出版脚本自检', () => {
  const run = (script: string) =>
    execFileSync(process.execPath, [path.join(ROOT, script), '--check'], { cwd: ROOT, encoding: 'utf8' });

  it('皮肤源里没有残留「该搬走的」远端皮肤规则（split-domain-skins --check）', () => {
    expect(() => run('scripts/split-domain-skins.mjs')).not.toThrow();
  });

  it('manual/skins/ 与皮肤源同步（build-skin-pack --check）', () => {
    expect(() => run('scripts/build-skin-pack.mjs')).not.toThrow();
  });
});
