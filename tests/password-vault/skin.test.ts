// @vitest-environment node
/**
 * issue 291：全域子弹窗统一 —— password-vault 两处确认框随金色印章皮（样式源文本断言）。
 *
 * 前情（缺陷）：本域把「token（--pwv-*，含金色 --pwv-gold/--pwv-gold-soft）与面板根
 * .bz-password-vault」写在同一条规则里（styles.css 开头），域内自绘弹窗因为在域根内
 * 才天然继承 token。但「首设主密码风险确认 / 清单疑似损坏 → 仍要重设」两个
 * openFlowDialog 确认框挂 document.body —— 脱离域根后 --pwv-* 全部失效（金色主钮会掉回
 * core 默认品牌色）。故两处传 `className: 'bz-pwv-flow-dialog'`，域 CSS 补：
 *  1) token 层 `.bz-pwv-flow-dialog { … }`：域私有 token 整表按同值复制到弹窗根；
 *  2) 壳映射 `#__shared_confirm_popup__.bz-pwv-flow-dialog { … }`：材质取域内自绘确认框
 *     `.bz-password-vault-pop2 .card`，金色主钮取 `.pop2 .ok` / `.bz-password-vault-btn.gold`。
 *
 * 本用例守护：两处都传类、token 层与壳映射都在、金色主钮带 `:not(--danger)` 守卫
 * （危险主动作不得被域规则盖回金色 —— core 既定口径）。
 * 样式断言读源文件文本（jsdom 不解析 css 文件；先例 tests/memo/skin-dark.test.ts）。
 * 运行时断言（popup.classList 真含域类）见 tests/password-vault/ui.test.ts 末例。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const css = () => repo('src/password-vault/styles.css');
const ui = () => repo('src/password-vault/ui.ts');

/** 取某选择器规则体（首个匹配；选择器内正则元字符转义） */
function block(sel: string): string | null {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css().match(new RegExp(`${esc}\\s*\\{[^}]*\\}`));
  return m ? m[0] : null;
}

describe('issue 291：password-vault 确认框随金色印章皮', () => {
  it('两处确认框都传 className: bz-pwv-flow-dialog', () => {
    const hits = ui().match(/className: 'bz-pwv-flow-dialog'/g) || [];
    expect(hits.length, '两处确认框（首设风险 / 清单损坏重设）各一处').toBe(2);
    expect(ui()).toContain('设置主密码');
    expect(ui()).toContain('清单疑似损坏');
  });

  it('token 层：.bz-pwv-flow-dialog 复制域私有 token 整表（挂 body 后 var 否则全失效）', () => {
    const b = block('.bz-pwv-flow-dialog');
    expect(b, '缺 .bz-pwv-flow-dialog token 层规则').not.toBeNull();
    for (const t of [
      '--pwv-bg:', '--pwv-surface:', '--pwv-surface2:', '--pwv-ink:', '--pwv-muted:',
      '--pwv-faint:', '--pwv-line:', '--pwv-gold:', '--pwv-gold-soft:', '--pwv-gold-ink:',
      '--pwv-ok:', '--pwv-bad:', '--pwv-warn:', '--pwv-shadow:', '--pwv-mono:', '--pwv-radius:',
    ]) {
      expect(b!, `token 层缺 ${t}`).toContain(t);
    }
    // 原根规则是「token + 容器布局」混合块 —— 本类不得连布局一起继承（否则确认框被套遮罩布局）
    expect(b!).not.toContain('display:');
    expect(b!).not.toContain('padding:');
    expect(b!).not.toContain('background: var(--background-modifier-cover)');
  });

  it('壳材质映射：底/圆角/投影取 .bz-password-vault-pop2 .card，且不含浮层定位', () => {
    const b = block('#__shared_confirm_popup__.bz-pwv-flow-dialog');
    expect(b, '缺 #__shared_confirm_popup__.bz-pwv-flow-dialog 规则').not.toBeNull();
    expect(b!).toContain('background: var(--pwv-surface)');
    expect(b!).toContain('border-radius: 18px');
    expect(b!).toContain('0 24px 70px');
    expect(b!).toContain('border: none'); // .pop2 .card 无描边（只用投影分界）
    // --bz-* 组件 token 整组映射到本域口径（.card h3 / .msg / .cancel）
    for (const t of [
      '--bz-text-1: var(--pwv-ink)',
      '--bz-text-2: var(--pwv-muted)',
      '--bz-surface-2: var(--pwv-surface2)',
      '--bz-danger: var(--pwv-bad)',
      '--bz-radius-sm: 11px',
    ]) {
      expect(b!, `缺 ${t}`).toContain(t);
    }
    for (const banned of ['position:', 'transform:', 'width:', 'height:']) {
      expect(b!, `壳规则不得含 ${banned}`).not.toContain(banned);
    }
  });

  it('金色主钮：取值同 .pop2 .ok / .bz-password-vault-btn.gold，且带 :not(--danger) 守卫', () => {
    const ok = block(
      '#__shared_confirm_popup__.bz-pwv-flow-dialog:not(.bz-flow-dialog--danger) #__shared_confirm_ok__'
    );
    expect(ok, '缺金色主钮规则').not.toBeNull();
    expect(ok!).toContain('background: var(--pwv-gold-soft)');
    expect(ok!).toContain('color: #fff');
    expect(ok!).toContain('box-shadow');
  });

  it('危险语义守卫：域内所有 OK 钮规则都必须带 :not(.bz-flow-dialog--danger)', () => {
    // core 的 bz-flow-dialog--danger 把主钮降级成中性底 + 红字（设计手册 §9/§10 既定口径）。
    // 域规则特异性（2,2,x）高于 core 的危险档（2,1,0）—— 若无守卫会把危险语义盖回金色。
    const okRules =
      css().match(/#__shared_confirm_popup__\.bz-pwv-flow-dialog[^{]*#__shared_confirm_ok__[^{]*\{/g) || [];
    expect(okRules.length, '应有金色主钮（常态 + hover）规则').toBeGreaterThanOrEqual(2);
    for (const r of okRules) {
      expect(r, `OK 钮规则缺危险守卫：${r}`).toContain(':not(.bz-flow-dialog--danger)');
    }
  });
});
