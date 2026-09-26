// @vitest-environment jsdom
/**
 * 皮肤包目录一致性守卫（issue 475 / ADR-0199）。
 *
 * 皮肤这件事现在有**四处**必须对齐，任何一处漏改都是静默失效（选择卡空格 / 皮不生效）：
 *   1. `scripts/skins.catalog.json`   —— 远端皮肤清单（id / 中文名 / 预览类）
 *   2. `src/<域>/skins/<id>.css`      —— 皮肤源（不进构建聚合）
 *   3. `manual/skins/index.json`      —— 出版产物（插件实际读的清单，含 sha256）
 *   4. 域内的「已知取值全集」          —— 取值校验用（缺了会把用户的选择判成非法）
 *
 * 本文件把 1↔2↔3↔4 的正反向关系全钉住；切分器残留由独立脚本守卫
 * （tests/core/skin-pack-split-guard.test.ts 跑 `split-domain-skins.mjs --check`）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KNOWN_SKIN_IDS, BUILTIN_SKIN } from '../../src/bookshelf/ui';
import { KNOWN_MEMO_SKINS, BUILTIN_MEMO_SKIN } from '../../src/memo/ui';
import { POMODORO_SKIN_THEMES, DEFAULT_POMODORO_SKIN_THEME } from '../../src/pomodoro/render';
import { ALL_APPEARANCES } from '../../src/smartcat/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/skins.catalog.json'), 'utf8'));
const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'manual/skins/index.json'), 'utf8'));

const normalizeEol = (s: string) => s.replace(/\r\n?/g, '\n');
const textSha256 = (s: string) => createHash('sha256').update(Buffer.from(normalizeEol(s), 'utf8')).digest('hex');

/** 域 → 该域的「已知取值全集」（含首套） */
const KNOWN: Record<string, readonly string[]> = {
  bookshelf: KNOWN_SKIN_IDS,
  memo: KNOWN_MEMO_SKINS,
  pomodoro: POMODORO_SKIN_THEMES.map((t) => t.value),
  smartcat: ALL_APPEARANCES,
};
const BUILTIN: Record<string, string> = {
  bookshelf: BUILTIN_SKIN,
  memo: BUILTIN_MEMO_SKIN,
  pomodoro: DEFAULT_POMODORO_SKIN_THEME,
  smartcat: 'orange',
};

describe('皮肤目录：catalog ↔ 源文件', () => {
  for (const [domain, cfg] of Object.entries<any>(CATALOG.domains)) {
    it(`${domain}：清单声明的每套皮都有源文件，且源文件都被清单登记`, () => {
      const dir = path.join(ROOT, `src/${domain}/skins`);
      const present = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => f.replace(/\.css$/, ''));
      const declared = cfg.skins.map((s: any) => s.id);
      expect([...declared].sort()).toEqual([...present].sort());
      expect(present.length).toBeGreaterThan(0);
    });

    it(`${domain}：首套不在远端清单里（内置兜底，恒不离线）`, () => {
      expect(cfg.skins.map((s: any) => s.id)).not.toContain(cfg.keep.id);
    });

    it(`${domain}：每套皮的 previewClass 真在它自己的 CSS 里定义过`, () => {
      for (const s of cfg.skins as any[]) {
        const css = fs.readFileSync(path.join(ROOT, `src/${domain}/skins/${s.id}.css`), 'utf8');
        expect(css, `${domain}/${s.id} 缺 .${s.previewClass}`).toContain(`.${s.previewClass}`);
      }
    });

    it(`${domain}：皮肤源不进构建聚合（build-css.mjs 的 SOURCES 不许登记）`, () => {
      const buildCss = fs.readFileSync(path.join(ROOT, 'scripts/build-css.mjs'), 'utf8');
      expect(buildCss).not.toContain(`src/${domain}/skins/`);
    });
  }
});

describe('皮肤目录：catalog ↔ 域内已知取值全集', () => {
  for (const [domain, cfg] of Object.entries<any>(CATALOG.domains)) {
    it(`${domain}：远端皮肤 id 都在已知全集内（否则用户的选择会被判非法）`, () => {
      for (const s of cfg.skins as any[]) {
        expect(KNOWN[domain], `${domain} 缺 ${s.id}`).toContain(s.id);
      }
    });
    it(`${domain}：首套在已知全集内、且不在远端清单内`, () => {
      expect(KNOWN[domain]).toContain(cfg.keep.id);
      expect(BUILTIN[domain]).toBe(cfg.keep.id);
    });
  }
});

describe('皮肤目录：catalog ↔ 出版产物 index.json', () => {
  const flat = (cfg: any, domain: string) =>
    (cfg.skins as any[]).map((s) => ({ domain, id: s.id, name: s.name, previewClass: s.previewClass }));

  it('条目集合与顺序一致（顺序即选择卡展示顺序）', () => {
    const want = Object.entries<any>(CATALOG.domains).flatMap(([d, cfg]) => flat(cfg, d));
    expect(INDEX.skins.map((s: any) => `${s.domain}/${s.id}`)).toEqual(want.map((w) => `${w.domain}/${w.id}`));
    expect(INDEX.skins.map((s: any) => s.name)).toEqual(want.map((w) => w.name));
    expect(INDEX.skins.map((s: any) => s.previewClass)).toEqual(want.map((w) => w.previewClass));
  });

  it('每条 sha256 与源文件逐字匹配（产物没落后于源）', () => {
    for (const s of INDEX.skins as any[]) {
      const text = fs.readFileSync(path.join(ROOT, `src/${s.domain}/skins/${s.id}.css`), 'utf8');
      expect(textSha256(text), `${s.domain}/${s.id} 的 sha256 与 manual/skins/index.json 不一致`).toBe(s.sha256);
    }
  });

  it('file 路径形状 = skins/<域>/<id>.css（插件的落盘路径由它决定）', () => {
    for (const s of INDEX.skins as any[]) {
      expect(s.file).toBe(`skins/${s.domain}/${s.id}.css`);
    }
  });

  it('manual/skins/ 里没有多余文件（下架的皮不许留在远端）', () => {
    const onDisk: string[] = [];
    for (const d of fs.readdirSync(path.join(ROOT, 'manual/skins'), { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      for (const f of fs.readdirSync(path.join(ROOT, 'manual/skins', d.name))) onDisk.push(`skins/${d.name}/${f}`);
    }
    expect(onDisk.sort()).toEqual((INDEX.skins as any[]).map((s) => s.file).sort());
  });

  it('出版产物与源逐字相同（换行已归一为 LF）', () => {
    for (const s of INDEX.skins as any[]) {
      const src = fs.readFileSync(path.join(ROOT, `src/${s.domain}/skins/${s.id}.css`), 'utf8');
      const out = fs.readFileSync(path.join(ROOT, 'manual', s.file), 'utf8');
      expect(out).toBe(normalizeEol(src));
      expect(out.includes('\r')).toBe(false);
    }
  });
});
