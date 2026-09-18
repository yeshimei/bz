/**
 * 弹壳焦点管理回归（review-deep core-ui R13 + core-efficiency 2/6）：
 * - uiModal 内置焦点管理：打开聚焦首个可交互元素、Tab 圈闭（trapFocus）、关闭还原触发元素；
 * - autofocus: false 逃生口（完全跳过焦点接管）；
 * - trapFocus 工具：Tab 首尾循环、Shift 反向；
 * - openFlowDialog / openSettingsModal 两壳 trapFocus 接线冒烟。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiModal } from '../../src/core/ui/modal';
import { trapFocus } from '../../src/core/ui/focus-trap';
import { openFlowDialog, cancelActiveFlowDialog } from '../../src/core/flow-dialog';
import { openSettingsModal, closeSettingsModal } from '../../src/core/settings-modal';
import { resetObsidianMocks } from '../mock-obsidian-entry';

function tab(target: Element, shift = false): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, shiftKey: shift });
  target.dispatchEvent(ev);
  return ev;
}

describe('trapFocus 工具（效率6）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Tab 在最后一个元素上循环回首项；Shift+Tab 在首项反向到末项', () => {
    const box = document.createElement('div');
    const a = document.createElement('button');
    const b = document.createElement('button');
    box.append(a, b);
    document.body.appendChild(box);
    const release = trapFocus(box);
    b.focus();

    const ev = tab(box);
    expect(ev.defaultPrevented).toBe(true); // 钳制生效
    expect(document.activeElement).toBe(a); // 循环回首项

    const ev2 = tab(box, true);
    expect(ev2.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(b); // 反向到末项
    release();
  });

  it('非 Tab 键放行；解绑后不再钳制', () => {
    const box = document.createElement('div');
    const a = document.createElement('button');
    box.append(a);
    document.body.appendChild(box);
    const release = trapFocus(box);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    box.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(false);
    release();
    const ev = tab(box);
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('uiModal 焦点管理（R13 / 效率2）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function buildModal(autos: Parameters<typeof uiModal>[0] = { content: '' }) {
    const trigger = document.createElement('button');
    trigger.textContent = '触发';
    document.body.appendChild(trigger);
    trigger.focus();
    return { trigger, m: uiModal(autos) };
  }

  it('打开聚焦 popup 内首个可交互元素；关闭还原焦点到触发元素', () => {
    const { trigger, m } = buildModal({
      content: (() => {
        const c = document.createElement('div');
        const input = document.createElement('input');
        const save = document.createElement('button');
        save.textContent = '保存';
        c.append(input, save);
        return c;
      })(),
    });
    expect(document.activeElement).toBe(m.popup.querySelector('input')); // 首个可交互
    m.close();
    expect(document.activeElement).toBe(trigger); // 还原
  });

  it('autofocus: false 逃生口：不聚焦、Tab 不圈闭、关闭不还原', () => {
    const { trigger, m } = buildModal({ content: '<button>甲</button>', autofocus: false });
    expect(document.activeElement).toBe(trigger); // 焦点未被接管
    const ev = tab(m.popup);
    expect(ev.defaultPrevented).toBe(false); // 无圈闭
    m.close();
    expect(document.activeElement).toBe(trigger); // 保持原状（未挪动过）
  });

  it('Tab 圈闭在弹窗内：末元素 Tab 循环回首元素', () => {
    const { m } = buildModal({ content: '<button>甲</button><button>乙</button>' });
    const btns = m.popup.querySelectorAll('button');
    btns[1].focus();
    tab(m.popup);
    expect(document.activeElement).toBe(btns[0]);
    m.close();
  });

  it('requestClose 拦截后由消费方调 close()：焦点还原依旧生效', () => {
    const { trigger, m } = buildModal({
      content: '<button>确定</button>',
      requestClose: () => m.close(),
    });
    expect(document.activeElement).toBe(m.popup.querySelector('button'));
    m.mask.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 点遮罩 → requestClose → close
    expect(document.activeElement).toBe(trigger);
  });
});

describe('三壳 trapFocus 接线冒烟（效率6）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    cancelActiveFlowDialog();
    closeSettingsModal();
    document.body.innerHTML = '';
  });

  it('openFlowDialog：Tab 在弹窗按钮间循环，不落到遮罩外背景', async () => {
    const bg = document.createElement('button');
    document.body.appendChild(bg);
    const p = openFlowDialog({ message: '确认？', actions: [{ label: '取消', value: 'cancel' }, { label: '确定', value: 'ok' }] });
    await Promise.resolve();
    const cancelBtn = document.getElementById('__shared_confirm_cancel__')!;
    const okBtn = document.getElementById('__shared_confirm_ok__')!;
    okBtn.focus();
    const ev = tab(okBtn);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancelBtn); // 循环回首按钮，没跑出弹窗
    cancelActiveFlowDialog();
    await p;
  });

  it('openSettingsModal：Tab 圈闭在设置弹窗内；关闭后解除', () => {
    const bg = document.createElement('button');
    document.body.appendChild(bg);
    openSettingsModal({
      title: '测试设置',
      schema: {
        groups: [
          {
            name: '组',
            rows: [
              {
                type: 'custom',
                render: (body) => {
                  const row = document.createElement('div');
                  row.className = 'setting-item'; // 计入「可见设置项」，避免触发空态清空
                  const b = document.createElement('button');
                  b.textContent = '设置项按钮';
                  row.appendChild(b);
                  body.appendChild(row);
                },
              },
            ],
          },
        ],
      },
    });
    const popup = document.getElementById('bz-settings-modal-popup')!;
    popup.querySelector('button')!.focus();
    const ev = tab(popup);
    expect(ev.defaultPrevented).toBe(true); // 末项循环回首项（或拉回弹窗内）
    expect(popup.contains(document.activeElement)).toBe(true);
    closeSettingsModal();
    const ev2 = tab(bg);
    expect(ev2.defaultPrevented).toBe(false); // 关闭后圈闭解除
  });
});
