/**
 * uiLockScreen 共享解锁屏测试（审查缺口架#4 + 修复批 B 效率13）：
 * - 结构槽位（dataset.ls）与 kind 作用域类；
 * - firstSetup 三态显隐与 showSecondInput 切换；
 * - setBusy 文案交换与控件 disabled 对称；
 * - setSec tone 先清后挂、空文案隐藏；
 * - inline 不挂 mask 类、close() 移除根节点；
 * - setStats 空数组隐藏；
 * - 内置回车提交（效率13）：input/input2 Enter → 主按钮，busy 期天然防重。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiLockScreen } from '../../src/core/ui/lock-screen';
import { resetObsidianMocks } from '../mock-obsidian-entry';

describe('uiLockScreen 结构槽位与作用域类', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('槽位齐备：seal/title/sub/stats/warning/ack/p1/p2/go/err/sec/hint', () => {
    const ls = uiLockScreen({
      kind: 'vault',
      title: '保险库已锁定',
      sub: '输入主密码解锁',
      action: '解锁',
      stats: [{ num: '3', label: '条目' }],
      secText: '完整性正常',
      secTone: 'ok',
      hint: '提示行',
    });
    for (const slot of ['seal', 'title', 'sub', 'stats', 'warning', 'ack', 'p1', 'p2', 'go', 'err', 'sec', 'hint']) {
      expect(ls.el.querySelector(`[data-ls="${slot}"]`)).not.toBeNull();
    }
    expect(ls.el.querySelector('[data-ls="title"]')!.textContent).toBe('保险库已锁定');
    expect(ls.el.querySelector('[data-ls="go"]')!.textContent).toBe('解锁');
  });

  it('kind 作用域类：bz-lockscreen bz-lockscreen--<kind>；非 inline 挂 mask 类', () => {
    for (const kind of ['vault', 'password-vault', 'diary'] as const) {
      const ls = uiLockScreen({ kind, title: 't', action: 'a' });
      expect(ls.el.classList.contains('bz-lockscreen')).toBe(true);
      expect(ls.el.classList.contains(`bz-lockscreen--${kind}`)).toBe(true);
      expect(ls.el.classList.contains('bz-lockscreen--mask')).toBe(true);
      expect(ls.el.classList.contains('bz-lockscreen--inline')).toBe(false);
      ls.close();
    }
  });
});

describe('uiLockScreen 首设三态与显隐切换', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('firstSetup：warning/ack/input2 显示；非首设三者隐藏', () => {
    const first = uiLockScreen({ kind: 'diary', title: 't', action: 'a', firstSetup: true, warningHtml: '<b>风险</b>' });
    const fw = first.el.querySelector('[data-ls="warning"]') as HTMLElement;
    expect(fw.style.display).toBe('');
    expect(fw.innerHTML).toContain('<b>风险</b>');
    expect((first.el.querySelector('[data-ls="ack"]') as HTMLElement).style.display).toBe('');
    expect(first.input2.style.display).toBe('');
    first.close();

    const normal = uiLockScreen({ kind: 'diary', title: 't', action: 'a' });
    expect((normal.el.querySelector('[data-ls="warning"]') as HTMLElement).style.display).toBe('none');
    expect((normal.el.querySelector('[data-ls="ack"]') as HTMLElement).style.display).toBe('none');
    expect(normal.input2.style.display).toBe('none');
    normal.close();
  });

  it('showSecondInput：功能性显隐切换', () => {
    const ls = uiLockScreen({ kind: 'vault', title: 't', action: 'a' });
    expect(ls.input2.style.display).toBe('none');
    ls.showSecondInput(true);
    expect(ls.input2.style.display).toBe('');
    ls.showSecondInput(false);
    expect(ls.input2.style.display).toBe('none');
    ls.close();
  });
});

describe('uiLockScreen setBusy / setSec / setStats', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('setBusy：文案交换 + 三个控件 disabled 对称；解除后恢复原文案', () => {
    const ls = uiLockScreen({ kind: 'vault', title: 't', action: '解锁' });
    ls.setBusy(true);
    expect(ls.actionBtn.disabled).toBe(true);
    expect(ls.input.disabled).toBe(true);
    expect(ls.input2.disabled).toBe(true);
    expect(ls.actionBtn.textContent).toBe('处理中…');
    ls.setBusy(false);
    expect(ls.actionBtn.disabled).toBe(false);
    expect(ls.input.disabled).toBe(false);
    expect(ls.input2.disabled).toBe(false);
    expect(ls.actionBtn.textContent).toBe('解锁'); // 原文案恢复
    ls.close();
  });

  it('setSec：tone 先清后挂；空文案隐藏整行', () => {
    const ls = uiLockScreen({ kind: 'vault', title: 't', action: 'a', secText: '初始', secTone: 'ok' });
    const sec = ls.el.querySelector('[data-ls="sec"]') as HTMLElement;
    expect(sec.classList.contains('bz-lockscreen-sec--ok')).toBe(true);
    ls.setSec('告警', 'warn');
    expect(sec.classList.contains('bz-lockscreen-sec--ok')).toBe(false); // 旧 tone 清掉
    expect(sec.classList.contains('bz-lockscreen-sec--warn')).toBe(true);
    expect(sec.style.display).toBe('');
    ls.setSec('');
    expect(sec.style.display).toBe('none');
    expect(sec.classList.contains('bz-lockscreen-sec--warn')).toBe(false);
    ls.close();
  });

  it('setStats：渲染卡片；空数组隐藏统计行', () => {
    const ls = uiLockScreen({
      kind: 'password-vault',
      title: 't',
      action: 'a',
      stats: [
        { num: '12', label: '条目' },
        { num: '—', label: '未知' },
      ],
    });
    const wrap = ls.el.querySelector('[data-ls="stats"]') as HTMLElement;
    expect(wrap.querySelectorAll('.bz-lockscreen-stat')).toHaveLength(2);
    expect(wrap.style.display).toBe('');
    ls.setStats([]);
    expect(wrap.querySelectorAll('.bz-lockscreen-stat')).toHaveLength(0);
    expect(wrap.style.display).toBe('none');
    ls.close();
  });
});

describe('uiLockScreen inline 与 close', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('inline：不挂 mask 类、挂 inline 类；close() 移除根节点（幂等安全）', () => {
    const ls = uiLockScreen({ kind: 'vault', title: 't', action: 'a', inline: true });
    expect(ls.el.classList.contains('bz-lockscreen--inline')).toBe(true);
    expect(ls.el.classList.contains('bz-lockscreen--mask')).toBe(false);
    document.body.appendChild(ls.el);
    expect(ls.el.isConnected).toBe(true);
    ls.close();
    expect(ls.el.isConnected).toBe(false);
    expect(() => ls.close()).not.toThrow(); // 重复 close 幂等
  });
});

describe('uiLockScreen 内置回车提交（效率13）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function build(firstSetup = false) {
    const ls = uiLockScreen({ kind: 'vault', title: 't', action: '解锁', firstSetup });
    document.body.appendChild(ls.el);
    const clicks = vi.fn();
    ls.actionBtn.addEventListener('click', clicks);
    return { ls, clicks };
  }

  it('input / input2 的 Enter 触发主按钮 click', () => {
    const { ls, clicks } = build();
    ls.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clicks).toHaveBeenCalledTimes(1);
    ls.input2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clicks).toHaveBeenCalledTimes(2);
  });

  it('busy 期按钮 disabled：Enter 不再触发（天然防重复提交）', () => {
    const { ls, clicks } = build();
    ls.setBusy(true);
    ls.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clicks).not.toHaveBeenCalled();
    ls.setBusy(false);
    ls.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it('非 Enter 键不触发', () => {
    const { ls, clicks } = build();
    ls.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(clicks).not.toHaveBeenCalled();
  });
});
