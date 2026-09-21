// @vitest-environment node
/**
 * 影院动效台账门禁（issue 400）· 契约测试
 *
 * 走查（2026-09-21）时本域散着十个自由时长（.14/.16/.18/.2/.22/.28/.32/.36/.44/.74）与三条曲线，
 * 而 core 提供的 `--bz-dur-*` / `--bz-ease-*` 一个没用；更有两层相反的 reduce 政策。
 * 口径定成四档时长 + 两条曲线（`src/cinema/motion.ts` 与 styles.css 段首台账各存一份，
 * 理由见该文件头），本测试即把两侧钉死，并挡住「再手写一个差不多时长」的漂移：
 *
 *  1. CSS token 取值 === TS 常量；
 *  2. 影院样式里所有 `transition` / `animation` 的时间值，要么走 `var(--cn-m-*)`，
 *     要么落在功能性循环白名单（转圈 / 骨架 / 脉冲 / 扫描，属加载指示，不入台账）；
 *  3. 曲线同样只许出现在台账定义处（别处再写一条 cubic-bezier 就是新曲线）；
 *  4. 本域不含 `prefers-reduced-motion` 块——「不做分支」是拍板口径，不是疏漏
 *     （用户机器恒报 reduce：Windows 关窗口动画时 Chromium 固定上报，媒体查询表达不了意图）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOTION, EASE, STAGGER } from '../../src/cinema/motion';

const CSS = readFileSync(join(process.cwd(), 'src/cinema/styles.css'), 'utf8');

/** 功能性循环时长（加载指示；改这些值时随手补进白名单即可，改交互时长则不行）。
 *  issue 405 追影片氛围循环：.9s 灯牌闪烁 / 9s·11s 探照灯 / 14s 放映机表盘（1.1s 跑马灯已在） */
const FUNCTIONAL_LOOPS = ['1.1s', '1.3s', '1.4s', '.7s', '.8s', '.9s', '9s', '11s', '14s'];

/** 台账块范围（.bz-cinema--midnight,.cn-skin{…}）——曲线只许出现在块内 */
function ledgerBlock(): string {
  const start = CSS.indexOf('影院动效台账');
  expect(start, '找不到台账段（注释被删或挪位？）').toBeGreaterThan(-1);
  const open = CSS.indexOf('{', CSS.indexOf('.cn-skin', start));
  const close = CSS.indexOf('}', open);
  expect(open, '找不到台账块').toBeGreaterThan(-1);
  return CSS.slice(open, close + 1);
}

const token = (name: string): string => {
  const m = ledgerBlock().match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  expect(m, `台账缺 token ${name}`).toBeTruthy();
  return (m as RegExpMatchArray)[1].trim();
};

/** 秒值原文 → 毫秒整数（`.16s` / `0.16s` 两种写法都吃） */
const ms = (v: string): number => Math.round(parseFloat(v) * 1000);

describe('影院动效台账（issue 400）', () => {
  it('CSS token 取值与 motion.ts 常量一一对应', () => {
    expect(ms(token('--cn-m-fast'))).toBe(MOTION.fast);
    expect(ms(token('--cn-m-move'))).toBe(MOTION.move);
    expect(ms(token('--cn-m-base'))).toBe(MOTION.base);
    expect(ms(token('--cn-m-impulse'))).toBe(MOTION.impulse);
    expect(token('--cn-e-out')).toBe(EASE.out);
    expect(token('--cn-e-move')).toBe(EASE.move);
  });

  it('每条 transition / animation 的时间值都走台账 token（或属功能性循环白名单）', () => {
    const offenders: string[] = [];
    // 只管「时长」：delay 是接力轴（步进由下一条断言的阶梯契约看），不属台账
    const decl = /(?:transition|animation)(?:-duration)?\s*:\s*([^;}]*)/g;
    for (const m of CSS.matchAll(decl)) {
      const value = m[1];
      for (const t of value.matchAll(/(?:^|[\s,(])([\d.]+m?s)(?=[\s,)]|$)/g)) {
        if (FUNCTIONAL_LOOPS.includes(t[1])) continue;
        offenders.push(`${t[1]} ← ${value.trim().slice(0, 60)}`);
      }
    }
    expect(offenders, `有未走台账的时间值：\n${offenders.join('\n')}`).toEqual([]);
  });

  it('曲线只在台账定义处出现', () => {
    const block = ledgerBlock();
    for (const m of CSS.matchAll(/cubic-bezier\([^)]*\)/g)) {
      expect(block.includes(m[0]), `台账块外出现曲线 ${m[0]}（${CSS.slice(Math.max(0, (m.index ?? 0) - 60), m.index)}）`).toBe(true);
    }
  });

  it('内容接力阶梯的步进 = STAGGER', () => {
    const d2 = CSS.match(/\*:nth-child\(2\)\{animation-delay:([\d.]+)s\}/);
    const d3 = CSS.match(/\*:nth-child\(3\)\{animation-delay:([\d.]+)s\}/);
    expect(d2 && d3, '找不到内容接力阶梯').toBeTruthy();
    expect(ms((d3 as RegExpMatchArray)[1]) - ms((d2 as RegExpMatchArray)[1])).toBe(STAGGER);
  });

  it('本域不做 prefers-reduced-motion 分支（拍板口径，不是疏漏）', () => {
    // 注释里会提到这个词（解释口径），所以查的是真正的媒体查询
    expect(/@media\s*\(\s*prefers-reduced-motion/.test(CSS)).toBe(false);
  });
});
