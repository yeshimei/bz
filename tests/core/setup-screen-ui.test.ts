/**
 * uiSetupScreen 首设面板（三域共用）：
 * - 结构槽位（dataset.su）与「一把密码管三处」的默认副题；
 * - 两遍输入明文（type=text）且上下排列；
 * - 实时一致性：第二遍一致 → 一致；不一致 → 红框 + 不一致（不等提交才说）；
 * - 通用校验：空 / 不一致 / 未勾选都拦在 onSubmit 之前；
 * - onSubmit 抛错 → 错误行显示 message 且 busy 复位（可重试）；
 * - 取消（次按钮 / 遮罩）走 onCancel 并摘掉根节点；
 * - inline 不挂遮罩类、不接管 ESC。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiSetupScreen } from '../../src/core/ui/setup-screen';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const mk = (over: Partial<Parameters<typeof uiSetupScreen>[0]> = {}) =>
  uiSetupScreen({ onSubmit: () => {}, ...over });

/** 填两遍密码 + 勾选 */
const fill = (su: ReturnType<typeof mk>, pw = 'hunter2', ack = true) => {
  su.input.value = pw;
  su.input2.value = pw;
  su.input.dispatchEvent(new Event('input'));
  su.input2.dispatchEvent(new Event('input'));
  su.ackBox.checked = ack;
  su.ackBox.dispatchEvent(new Event('change'));
};

describe('uiSetupScreen 结构与默认文案', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('槽位齐备：badge/title/sub/p1/p2/mark/warn/ack/err/go/cancel', () => {
    const su = mk();
    for (const slot of ['badge', 'title', 'sub', 'p1', 'p2', 'mark', 'warn', 'ack', 'err', 'go', 'cancel']) {
      expect(su.el.querySelector(`[data-su="${slot}"]`)).not.toBeNull();
    }
    expect(su.el.querySelector('[data-su="title"]')!.textContent).toBe('设置主密码');
    expect(su.el.querySelector('[data-su="go"]')!.textContent).toBe('设置并解锁');
    su.close();
  });

  it('默认副题讲明三域共用一把密码（从日记/密码本进来的人才知道自己在设全局主密码）', () => {
    const su = mk();
    const sub = su.el.querySelector('[data-su="sub"]')!.textContent || '';
    expect(sub).toContain('只设这一次');
    expect(sub).toContain('保险库');
    expect(sub).toContain('加密日记');
    expect(sub).toContain('密码本');
    su.close();
  });

  it('不显示统计卡（首设还没有任何数据，三张「—」是噪音）', () => {
    const su = mk();
    expect(su.el.querySelector('.bz-lockscreen-stats')).toBeNull();
    expect(su.el.querySelector('[data-ls]')).toBeNull();
    su.close();
  });
});

describe('uiSetupScreen 两遍输入是明文', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('两个框都是 text（首设没有正确值可对照，掩码下打错只能等提交）', () => {
    const su = mk();
    expect(su.input.type).toBe('text');
    expect(su.input2.type).toBe('text');
    su.close();
  });

  it('关掉拼写与首字母大写纠正（否则输入法会改写密码）', () => {
    const su = mk();
    for (const inp of [su.input, su.input2]) {
      expect(inp.spellcheck).toBe(false);
      expect(inp.getAttribute('autocapitalize')).toBe('off');
      expect(inp.getAttribute('autocorrect')).toBe('off');
      expect(inp.autocomplete).toBe('new-password');
    }
    su.close();
  });

  it('两个框各自一个 field，上下排列（不在同一行里并排）', () => {
    const su = mk();
    const fields = su.el.querySelectorAll('.bz-setup-field');
    expect(fields.length).toBe(2);
    expect(fields[0].contains(su.input)).toBe(true);
    expect(fields[1].contains(su.input2)).toBe(true);
    expect(fields[0].contains(su.input2)).toBe(false);
    su.close();
  });
});

describe('uiSetupScreen 实时一致性', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('第二遍为空时不表态；一致显示「一致」；不一致显示「不一致」并标红', () => {
    const su = mk();
    const mark = su.el.querySelector('[data-su="mark"]')!;
    expect(mark.classList.contains('is-shown')).toBe(false);

    su.input.value = 'abc';
    su.input2.value = 'abc';
    su.input2.dispatchEvent(new Event('input'));
    expect(mark.classList.contains('is-shown')).toBe(true);
    expect(mark.classList.contains('bz-setup-mark--ok')).toBe(true);
    expect(mark.textContent).toContain('一致');

    su.input2.value = 'abd';
    su.input2.dispatchEvent(new Event('input'));
    expect(mark.classList.contains('bz-setup-mark--bad')).toBe(true);
    expect(mark.textContent).toContain('不一致');
    expect(su.input2.parentElement!.classList.contains('is-bad')).toBe(true);
    su.close();
  });

  it('改回一致就撤掉红框（不是等提交才复位）', () => {
    const su = mk();
    su.input.value = 'abc';
    su.input2.value = 'abd';
    su.input2.dispatchEvent(new Event('input'));
    expect(su.input2.parentElement!.classList.contains('is-bad')).toBe(true);

    su.input2.value = 'abc';
    su.input2.dispatchEvent(new Event('input'));
    expect(su.input2.parentElement!.classList.contains('is-bad')).toBe(false);
    su.close();
  });
});

describe('uiSetupScreen 校验与提交', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('空密码不提交', async () => {
    const onSubmit = vi.fn();
    const su = mk({ onSubmit });
    su.actionBtn.click();
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(su.el.querySelector('[data-su="err"]')!.textContent).toBe('请输入主密码');
    su.close();
  });

  it('两遍不一致不提交', async () => {
    const onSubmit = vi.fn();
    const su = mk({ onSubmit });
    su.input.value = 'a1';
    su.input2.value = 'a2';
    su.ackBox.checked = true;
    su.actionBtn.click();
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(su.el.querySelector('[data-su="err"]')!.textContent).toBe('两次输入不一致');
    su.close();
  });

  it('未勾选不提交', async () => {
    const onSubmit = vi.fn();
    const su = mk({ onSubmit });
    fill(su, 'pw', false);
    su.actionBtn.click();
    await Promise.resolve();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(su.el.querySelector('[data-su="err"]')!.textContent).toBe('请先勾选确认');
    su.close();
  });

  it('不做长度限制：一个字符也能提交', async () => {
    const onSubmit = vi.fn(() => {});
    const su = mk({ onSubmit });
    fill(su, 'a');
    su.actionBtn.click();
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledWith('a');
    su.close();
  });

  it('通过后把密码交给域，按钮进「处理中…」且控件禁用', async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const su = mk({ onSubmit });
    fill(su, 'hunter2');
    su.actionBtn.click();
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledWith('hunter2');
    expect(su.actionBtn.textContent).toBe('处理中…');
    expect(su.actionBtn.disabled).toBe(true);
    expect(su.input.disabled).toBe(true);
    expect(su.input2.disabled).toBe(true);
    release();
    su.close();
  });

  it('onSubmit 抛错 → 错误行显示 message 且按钮复位可重试', async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('无法写入清单')));
    const su = mk({ onSubmit });
    fill(su, 'hunter2');
    su.actionBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(su.el.querySelector('[data-su="err"]')!.textContent).toBe('无法写入清单');
    expect(su.actionBtn.disabled).toBe(false);
    expect(su.actionBtn.textContent).toBe('设置并解锁');
    su.close();
  });

  it('回车等价点主按钮（两个框都是）', async () => {
    const onSubmit = vi.fn(() => {});
    const su = mk({ onSubmit });
    fill(su, 'hunter2');
    su.input2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledWith('hunter2');
    su.close();
  });
});

describe('uiSetupScreen 收场', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('次按钮：调 onCancel 并摘掉根节点', () => {
    const onCancel = vi.fn();
    const su = mk({ onCancel });
    document.body.appendChild(su.el);
    su.cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(su.el.isConnected).toBe(false);
  });

  it('busy 期不给退出（连点次按钮不生效）', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn(() => new Promise<void>(() => {}));
    const su = mk({ onSubmit, onCancel });
    fill(su, 'hunter2');
    su.actionBtn.click();
    await Promise.resolve();
    su.cancelBtn.click();
    expect(onCancel).not.toHaveBeenCalled();
    su.close();
  });

  it('全屏实例挂遮罩类；inline 不挂', () => {
    const full = mk();
    expect(full.el.classList.contains('bz-setup--mask')).toBe(true);
    expect(full.el.classList.contains('bz-setup--inline')).toBe(false);
    full.close();

    const inline = mk({ inline: true });
    expect(inline.el.classList.contains('bz-setup--inline')).toBe(true);
    expect(inline.el.classList.contains('bz-setup--mask')).toBe(false);
    inline.close();
  });

  it('点遮罩关闭 = 取消', () => {
    const onCancel = vi.fn();
    const su = mk({ onCancel });
    document.body.appendChild(su.el);
    // 完整一次手势：按下 → 抬起（落点仍在遮罩）→ click（bindMaskDismiss 的判据）
    su.el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    su.el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    su.el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
