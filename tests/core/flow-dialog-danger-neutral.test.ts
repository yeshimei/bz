// @vitest-environment node
/**
 * 危险中性态守卫（issue 291 评审补，设计手册 §9/§10）。
 *
 * 用户裁决原文：「对齐手册：danger 确认框的主按钮改中性 + 红字」。
 * 2026 评审发现旧实现只把 `background/color` 压回中性，域皮给主动作加的**提级形制**
 * （memo 纸感的 2px 墨框 + 硬偏移阴影）会残留成「中性底 + 红字 + 仍是凸起墨章」的半吊子态。
 * 本文件锁三件事：
 *  1) core 危险规则是**整套**中性次级形制（底色/文字/描边/圆角/阴影五项齐全）；
 *  2) 选择器带 `.bz-flow-dialog` 提一级（2,2,0），才压得住域皮 `#__shared_confirm_popup__.
 *     bz-<域>-flow-dialog #__shared_confirm_ok__`（2,1,0）这类按钮映射；
 *  3) 要保留自有按钮形制的域（clipbook 编辑部方角）必须自带 `.bz-flow-dialog--danger`
 *     限定覆写，且亮/暗两套都在（`.theme-dark` 那条与 core 同特异性且后到，会把手写体墨章压回来）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

/** 取某选择器首个声明块体：要求选择器后直接跟 `{`（跳过 `:hover` 等派生态与后代选择器） */
function block(css: string, selector: string): string {
  const deck = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(deck + '\\s*\\{([^}]*)\\}'));
  if (!m) throw new Error('缺规则块：' + selector);
  return m[1];
}

const OK = '#__shared_confirm_ok__';
const DANGER_SEL = '#__shared_confirm_popup__.bz-flow-dialog.bz-flow-dialog--danger ' + OK;

describe('core 危险中性态：整套次级形制复位（issue 291 评审）', () => {
  const css = () => repo('src/core/styles.css');

  it('危险规则声明底色/文字/描边/圆角/阴影五项中性值（不是只换底色）', () => {
    const b = block(css(), DANGER_SEL);
    expect(b, '缺中性底色').toContain('background: var(--bz-surface-2)');
    expect(b, '缺危险文字色').toContain('color: var(--bz-danger)');
    expect(b, '缺描边复位（域皮 2px 墨框会残留）').toContain('border: 1px solid transparent');
    expect(b, '缺圆角复位（域皮非 12px 圆角会残留）').toContain('border-radius: var(--bz-radius-sm)');
    expect(b, '缺阴影复位（域皮硬偏移阴影会残留成「凸起墨章」）').toContain('box-shadow: none');
  });

  it('选择器含 .bz-flow-dialog 提级（2,2,0 压域皮 2,1,0 按钮映射）', () => {
    expect(css()).toContain(DANGER_SEL);
  });

  it('hover 档同步降级：不留品牌色回弹', () => {
    const b = block(css(), DANGER_SEL + ':hover');
    expect(b).toContain('background: var(--bz-surface-hover)');
    expect(b, '危险态 hover 不得回到品牌主色').not.toContain('--bz-brand');
  });
});

describe('域皮保留自有按钮形制 → 须自带危险态覆写（clipbook 编辑部方角）', () => {
  const css = () => repo('src/clipbook/styles.css');
  const SEL = '#__shared_confirm_popup__.bz-overlay-popup.bz-clip-dialog-editorial.bz-flow-dialog--danger ' + OK;

  it('亮色：清底 + 危险色文字，保留方角与墨线（与同框方角「取消」同形制）', () => {
    const b = block(css(), SEL);
    expect(b).toContain('background: transparent');
    expect(b).toContain('border-radius: 0');
    expect(b).toContain('color: var(--bz-danger)');
  });

  it('暗色：`.theme-dark` 那条同特异性且后到，必须有对应的危险态覆写', () => {
    const b = block(css(), '.theme-dark ' + SEL);
    expect(b).toContain('background: transparent');
    expect(b).toContain('color: var(--bz-danger)');
  });
});

/**
 * 跨域不变量守护（issue 291 两轮评审共同发现的真洞）：
 * 域皮里**特异性 ≥ (2,2,0)** 的 OK 钮规则，只要碰了「强调/形制」属性
 * （底/文字色/描边/圆角/阴影），就必须处于下列之一：
 *   a) 规则**自身状态限定**：挂 `.bz-flow-dialog--danger`（危险态专属）或
 *      `:not(.bz-flow-dialog--danger)`（只作用于非危险态）；或
 *   b) 同文件内存在**同类状态**（同为悬停 / 同为常态）、特异性**更高**的危险态覆写把它盖住。
 *
 * 为什么不能只靠特异性：core 危险规则是 (2,2,0)，而域文件在 CSS 聚合序中**后到**。
 * 于是同特异性的域规则会在危险态把提级形制又压回来 —— memo 纸感的 `:hover` 硬阴影就是这样
 * 漏掉过一次（悬停即找回 `4px 4px 0` 墨影）；clipbook 的亮色覆写一开始也停在 (2,2,0)，只靠
 * 源序取胜（脆弱、无测试锁序），故两条都改成显式提级 / 显式限定。
 * 低于 (2,2,0) 的域规则天然被 core 危险规则压住，只写字体/字距的规则也无害，二者豁免。
 */
describe('跨域不变量：域皮 OK 钮规则在危险态不得残留强调形制', () => {
  /** 强调/形制属性（命中其一即须状态限定）；字体/字距等纯排版属性不在此列 */
  const EMPHASIS = /(^|[;\s])(background|background-color|color|border|border-color|border-width|border-style|border-radius|box-shadow)\s*:/;
  const DANGER = '.bz-flow-dialog--danger';

  /** 简易特异性：id 数 / (类 + 伪类) 数；`:not(x)` 按 CSS 规范只算参数的特异性 */
  function specificity(sel: string): [number, number] {
    const norm = sel.replace(/:not\(/g, '(');
    const ids = (norm.match(/#/g) || []).length;
    const classes = (norm.match(/\./g) || []).length + (norm.match(/:(?!:)/g) || []).length;
    return [ids, classes];
  }
  const greater = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1];
  const isHover = (sel: string) => sel.includes(':hover');

  const domainCss = (): string[] =>
    readdirSync(resolve(process.cwd(), 'src'), { recursive: true })
      .map((p) => String(p).replace(/\\/g, '/'))
      .filter((p) => p.endsWith('styles.css') && !p.startsWith('core'))
      .map((p) => 'src/' + p);

  it('每个域 CSS 里，≥(2,2,0) 的 OK 钮规则都状态限定或被更高特异性的危险态覆写保护', () => {
    const offenders: string[] = [];
    type Rule = { sel: string; spec: [number, number]; hover: boolean; scoped: boolean };
    for (const file of domainCss()) {
      const css = repo(file);
      // 两趟：先收齐本文件全部 OK 钮规则（覆写规则可能在被保护规则之后），再做判定
      const rules: Rule[] = [];
      const emphasisRules: { sel: string; body: string }[] = [];
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const rawSel = m[1].trim();
        const body = m[2];
        if (rawSel.startsWith('@') || !rawSel.includes('#__shared_confirm_ok__')) continue;
        for (const sel of rawSel.split(',').map((s) => s.trim())) {
          if (!sel.includes('#__shared_confirm_ok__')) continue;
          rules.push({
            sel,
            spec: specificity(sel),
            hover: isHover(sel),
            scoped: sel.includes(DANGER),
          });
        }
        if (EMPHASIS.test(body)) emphasisRules.push({ sel: rawSel, body });
      }
      for (const { sel: rawSel } of emphasisRules) {
        for (const sel of rawSel.split(',').map((s) => s.trim())) {
          if (!sel.includes('#__shared_confirm_ok__')) continue;
          const spec = specificity(sel);
          if (spec[0] < 2 || spec[1] < 2) continue; // 低于 core 危险规则 → 天然被压住
          if (sel.includes(`:not(${DANGER})`) || sel.includes(DANGER)) continue; // a) 自身限定
          // b) 同文件、同悬停态、特异性更高的危险态覆写
          const protectedBy = rules.some(
            (r) => r.scoped && r.hover === isHover(sel) && greater(r.spec, spec) > 0
          );
          if (!protectedBy) offenders.push(`${file} → ${sel}`);
        }
      }
    }
    expect(
      offenders,
      '下列域皮 OK 钮规则特异性 ≥ (2,2,0)、既未状态限定也无更高特异性的危险态覆写：危险确认框会残留强调形制'
    ).toEqual([]);
  });

  it('clipbook 编辑部危险覆写的特异性确实高于同文件里被它保护的两条（不是靠源序取胜）', () => {
    const sel = '#__shared_confirm_popup__.bz-overlay-popup.bz-clip-dialog-editorial.bz-flow-dialog--danger #__shared_confirm_ok__';
    const css = repo('src/clipbook/styles.css');
    expect(css, '缺亮色危险覆写').toContain(sel + ' {');
    expect(css, '缺暗色危险覆写').toContain('.theme-dark ' + sel + ' {');
    // 被保护的两条（常态亮色危险覆写的目标 + 暗色常态钮）
    expect(specificity(sel)).toEqual([2, 3]);
    expect(specificity('.theme-dark ' + sel)).toEqual([2, 4]);
    expect(greater(specificity(sel), specificity('#__shared_confirm_popup__.bz-clip-dialog-editorial #__shared_confirm_ok__:hover'))).toBeGreaterThan(0);
    expect(greater(specificity('.theme-dark ' + sel), specificity('.theme-dark #__shared_confirm_popup__.bz-clip-dialog-editorial #__shared_confirm_ok__'))).toBeGreaterThan(0);
  });
});


