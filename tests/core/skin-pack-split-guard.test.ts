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
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** 唯一被允许注入的模块（ADR-0199 决策 4） */
const INJECTION_OWNER = 'src/core/skin-pack.ts';
/**
 * 第二处例外（2026-10-20，ADR-0243 补记）：展示板沙箱框**内部文档**的滚动条样式。
 *
 * 它和 ADR-0199 不是一回事：那份管的是**插件自己的 UI**（静态、单源、可审查），
 * 而这里写的是别人递进来的 iframe 文档 —— 框里的原生滚动条只有 `<style>` 改得动，
 * `style` 属性写不了伪元素，core 的界面级规则（ADR-0122）又跨不过文档边界。
 *
 * 所以例外开了，但**掐死范围**：这个文件里只准出现一个 `<style>`，内容只准是滚动条声明，
 * 选择器只准落在 html / body 及其 `::-webkit-scrollbar` 上。想拿它顺手改框里别的样式，
 * 下面那条断言会红。
 */
const FRAME_DOC_OWNER = 'src/dock/ui.ts';
const FRAME_CSS_CONST = 'FRAME_SCROLLBAR_CSS';
/** 框文档样式里允许出现的属性（全是滚动条相关，别的一项不准有） */
const FRAME_CSS_ALLOWED_PROPS = new Set(['scrollbar-width', '-ms-overflow-style', 'display', 'width', 'height']);
/** 属性 display/width/height 只准写在伪元素选择器上 */
const PSEUDO_ONLY_PROPS = new Set(['display', 'width', 'height']);

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
  it(`${INJECTION_OWNER} 之外，src 下没有任何 <style> 注入（${FRAME_DOC_OWNER} 见下一条）`, () => {
    const offenders: string[] = [];
    for (const rel of allSources()) {
      if (rel === INJECTION_OWNER || rel === FRAME_DOC_OWNER) continue;
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

  it(`第二处例外只准碰滚动条：${FRAME_DOC_OWNER} 里的 ${FRAME_CSS_CONST}`, () => {
    const code = stripComments(fs.readFileSync(path.join(ROOT, FRAME_DOC_OWNER), 'utf8'));

    // ① 整个文件只准有一个 <style>
    expect(code.match(/<style[\s>]/gi)?.length, '一个文件里不许有第二个 <style>').toBe(1);

    // ② 它必须是那条常量的值，不是随手拼在别处的
    const at = code.indexOf(`const ${FRAME_CSS_CONST}`);
    expect(at, `找不到 ${FRAME_CSS_CONST}`).toBeGreaterThan(0);
    const styleAt = code.indexOf('<style>', at);
    const styleEnd = code.indexOf('</style>', styleAt);
    expect(styleAt, `${FRAME_CSS_CONST} 里没有 <style>`).toBeGreaterThan(at);
    expect(styleEnd).toBeGreaterThan(styleAt);

    // ③ 里面只准有滚动条声明，且 display/width/height 只准挂在伪元素上
    //    常量是多段字符串拼的（读源码文本会读到 `' +` 这种记号），先把字面量拼回真值再解析
    const raw = code.slice(at, styleEnd + '</style>'.length);
    const css = [...raw.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
    const inner = css.replace(/^<style>/, '').replace(/<\/style>$/, '');
    const rules = [...inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    expect(rules.length, '解析不出规则，写法可能变了').toBeGreaterThan(0);
    for (const [, selector, body] of rules) {
      const sels = selector.split(',').map((s) => s.trim()).filter(Boolean);
      for (const sel of sels) {
        expect(sel, `选择器越界：${sel}`).toMatch(/^(html|body)(::-webkit-scrollbar)?$/);
      }
      for (const decl of body.split(';').map((d) => d.trim()).filter(Boolean)) {
        const [prop, ...rest] = decl.split(':').map((s) => s.trim());
        expect(FRAME_CSS_ALLOWED_PROPS.has(prop), `属性越界：${prop}`).toBe(true);
        expect(rest.join(':'), `声明写坏了：${decl}`).not.toBe('');
        if (PSEUDO_ONLY_PROPS.has(prop)) {
          expect(sels.every((s) => s.includes('::-webkit-scrollbar')), `${prop} 只准写在伪元素上`).toBe(true);
        }
      }
    }

    // ④ 真的注进了框文档（写在常量里却没被用 = 等于没写）
    expect(code).toMatch(/srcdoc\s*=[\s\S]{0,200}\$\{FRAME_SCROLLBAR_CSS\}/);
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
  /**
   * 反向守卫要在 `downloads/` 顶层放一个探测文件，正常路径在 `finally` 里删掉；但一轮跑被
   * 打断（Ctrl+C、超时、管道截断）就删不掉，下一轮「清单与产物同步」会被这个残留判成
   * 「未登记文件」而红——症状是同一份代码第一次跑红、后面几次全绿，最难查的那种。
   * 所以：文件名带 pid（并发跑不互撞），每组测试前先扫掉残留。
   */
  const ROGUE_PREFIX = 'guard-probe-';
  const sweepStaleProbes = () => {
    const dir = path.join(ROOT, 'downloads');
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(ROGUE_PREFIX) && name.endsWith('.tmp')) fs.rmSync(path.join(dir, name), { force: true });
    }
  };
  beforeEach(sweepStaleProbes);
  afterAll(sweepStaleProbes);

  const run = (script: string) => {
    try {
      return execFileSync(process.execPath, [path.join(ROOT, script), '--check'], { cwd: ROOT, encoding: 'utf8' });
    } catch (e: any) {
      // 脚本的报错都在 stderr，直接抛「Error」看不出是哪里不同步——带上原文
      throw new Error(`${script} --check 失败：\n${e.stderr || ''}${e.stdout || ''}`);
    }
  };

  it('皮肤源里没有残留「该搬走的」远端皮肤规则（split-domain-skins --check）', () => {
    expect(() => run('scripts/split-domain-skins.mjs')).not.toThrow();
  });

  it('downloads/skins/ 与皮肤源同步（build-skin-pack --check）', () => {
    expect(() => run('scripts/build-skin-pack.mjs')).not.toThrow();
  });

  it('统一清单与产物同步（build-manifest --check，issue 480 / ADR-0203）', () => {
    expect(() => run('scripts/build-manifest.mjs')).not.toThrow();
  });

  it('downloads/ 顶层不允许清单外文件——未登记文件让 build-manifest 报错（issue 490 反向守卫）', () => {
    const name = `${ROGUE_PREFIX}${process.pid}.tmp`;
    const rogue = path.join(ROOT, 'downloads', name);
    fs.writeFileSync(rogue, 'probe', 'utf8');
    try {
      let err = '';
      try {
        run('scripts/build-manifest.mjs');
      } catch (e: any) {
        err = String(e.stderr || e.message || e);
      }
      expect(err).toContain('未登记进清单');
      expect(err).toContain(name);
    } finally {
      fs.rmSync(rogue, { force: true });
    }
  });
});
