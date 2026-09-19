// @vitest-environment node
/**
 * encrypt 域深审批 D（样式与文档）回归测试。
 * 覆盖：
 *  1) 移动端 @media (max-width: 768px) 全套恢复（issue 346 回归：bbf5bcf9 清退 .bz-pwv-* 时误删整段，
 *     ≤768px 移动壳恒隐、桌面三栏硬塞上手机）——断言「.bz-vault-desk 隐藏 / .bz-vault-mob 显示」开关对
 *     及 mbar/msearch/mseg/mbody/mob-overview/mobpage 全套，防再删；
 *  2) 死样式整批删除（主密码旧弹窗族 / .bz-encrypt-dialog-ack 含非法 -var() / #bz-encrypt-list /
 *     预览头旧按钮 / lc-head 标题·计数·新增·badge.gold / star / 附件 chips / bbtn.gold），全批 TS 零引用；
 *  3) 保留面：.bz-encrypt-dialog-btn(--primary)（体检窗底栏在用）与 .bz-vault-item.k-diary.on
 *     （日记导航入口由并行批恢复，该族转活不删）；
 *  4) .bbtn.indigo 落类（消费 --bz-vault-indigo；vault-assets-view 内联 style 的摘除归并行批 C）；
 *  5) home 保险库入口副题两资产口径（ADR-0158 残留清理）。
 * 样式断言读源 styles.css 文本（jsdom 不解析 css 文件），模式同 tests/core/enh-sweep-c。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = () => readFileSync(resolve(process.cwd(), 'src/encrypt/styles.css'), 'utf8');
const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

/** 取含指定片段的 @media (max-width: 768px) 块（文件内多个断点块，定位移动端大块） */
function mediaBlock(fragment: string): string {
  const blocks = css().match(/@media \(max-width: 768px\) \{[\s\S]*?\n\}/g) ?? [];
  const hit = blocks.find((b) => b.includes(fragment));
  expect(hit, `应存在含 ${fragment} 的移动端断点块`).toBeDefined();
  return hit!;
}

describe('encrypt 批 D：移动端 @media 恢复（issue 346 回归）', () => {
  it('默认态开关对：mob 恒隐基线 + 断点内 desk 隐藏 / mob 显示', () => {
    const s = css();
    expect(s).toContain('#bz-encrypt-popup .bz-vault-mob { display: none; }');
    const block = mediaBlock('.bz-vault-mob { display: flex');
    expect(block).toContain('#bz-encrypt-popup .bz-vault-desk { display: none; }');
    expect(block).toContain('#bz-encrypt-popup { width: 100vw; height: 100vh; max-width: none; max-height: none; border-radius: 0; }');
  });

  it('移动壳全套类名与 ui.ts DOM 一一对应（mbar/msearch/mseg/mbody/mob-overview/mobpage）', () => {
    const block = mediaBlock('.bz-vault-mbar');
    for (const fragment of [
      '.bz-vault-mbar {',
      '.bz-vault-mbar .seal {',
      '.bz-vault-mbar .t {',
      '.bz-vault-mbar .st {',
      '.bz-vault-mbar .bz-vault-mobclose {',
      '.bz-vault-msearch {',
      '.bz-vault-mseg {',
      '.bz-vault-mseg .sg {',
      '.bz-vault-mseg .sg.on {',
      '.bz-vault-mbody {',
      '.bz-vault-mob-overview .bz-vault-cards {',
      '.bz-vault-mob-overview .bz-vault-two {',
      '.bz-vault-mob-overview .bz-vault-hero {',
      '.bz-vault-mobpage {',
      '.bz-vault-mobpage .head {',
      '.bz-vault-mobpage .head .back {',
      '.bz-vault-mobpage .head .ic {',
      '.bz-vault-mobpage .head .t {',
      '.bz-vault-mobpage .body {',
      '.bz-vault-mobpage .bz-vault-dhead {',
      '.bz-vault-mobpage .bz-vault-dcontent {',
    ]) {
      expect(block, `移动端断点块应含 ${fragment}`).toContain(fragment);
    }
  });

  it('密码本残留零回潮：全文件无 .bz-pwv-* 段', () => {
    expect(css()).not.toContain('bz-pwv');
  });
});

describe('encrypt 批 D：死样式整批删除（TS 零引用）', () => {
  it('旧主密码弹窗族清退（主密码弹窗走 core uiLockScreen 单源）', () => {
    const s = css();
    for (const dead of [
      '.bz-encrypt-dialog-box',
      '.bz-encrypt-dialog-title',
      '.bz-encrypt-dialog-msg',
      '.bz-encrypt-dialog-input',
      '.bz-encrypt-dialog-warning',
      '.bz-encrypt-dialog-btns',
      '.bz-encrypt-dialog-ack',
    ]) {
      expect(s, `${dead} 应已删除`).not.toContain(dead);
    }
    // 非法 CSS 语法随 -ack 一并清退（负 var() 须 calc(-1 * var())）
    expect(s).not.toContain('-var(');
  });

  it('保留面：体检窗按钮与 k-diary 激活态仍在', () => {
    const s = css();
    expect(s).toContain('.bz-encrypt-dialog-btn {');
    expect(s).toContain('.bz-encrypt-dialog-btn--primary {');
    expect(s).toContain('.bz-vault-item.k-diary.on');
  });

  it('视图退役残留清退：#bz-encrypt-list / 预览头旧按钮 / lc-head 标题计数新增 / star / chips / bbtn.gold', () => {
    const s = css();
    expect(s).not.toContain('#bz-encrypt-list');
    expect(s).not.toContain('.bz-encrypt-btn');
    expect(s).not.toMatch(/\.bz-vault-lc-head \.t \{/);
    expect(s).not.toContain('lc-count');
    expect(s).not.toContain('lc-add');
    expect(s).not.toContain('badge.gold');
    expect(s).not.toMatch(/\.bz-vault-row \.star/);
    expect(s).not.toContain('.chip');
    expect(s).not.toContain('.bbtn.gold');
  });
});

describe('encrypt 批 D：.bbtn.indigo 与 home 副题', () => {
  it('.bbtn.indigo 落类消费 --bz-vault-indigo（待批 C 摘 vault-assets-view 内联 style）', () => {
    expect(css()).toMatch(/#bz-encrypt-popup \.bbtn\.indigo \{ background: var\(--bz-vault-indigo\); color: var\(--bz-on-brand\); \}/);
  });

  it('home 保险库入口副题为两资产口径（ADR-0158）', () => {
    const shared = src('src/home/shared.ts');
    expect(shared).toContain("sub: '加密笔记·加密日记'");
    expect(shared).not.toContain('密码·加密笔记');
  });
});
