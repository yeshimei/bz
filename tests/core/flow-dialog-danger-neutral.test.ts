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
import { readFileSync } from 'node:fs';
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
  const SEL = '#__shared_confirm_popup__.bz-clip-dialog-editorial.bz-flow-dialog--danger ' + OK;

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
