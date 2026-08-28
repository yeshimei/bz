/**
 * 流程框声明内核·UI 层（ADR-0064 决策 6，ticket 131 Wave-1；承继旧 core/confirm 回归）
 * openFlowDialog 端到端：双动作 DOM 契约 / 三动作扩展 / ESC·遮罩取消 / 焦点管理 /
 * Promise resolve 语义 / escapeHtml 防注入。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { openFlowDialog } from '../../src/core/flow-dialog';

const MASK_ID = '__shared_confirm_mask__';
const POPUP_ID = '__shared_confirm_popup__';
const CANCEL_ID = '__shared_confirm_cancel__';
const OK_ID = '__shared_confirm_ok__';

function openDouble(message = '该操作不可撤销') {
  return openFlowDialog({
    title: '确认操作',
    message,
    actions: [
      { label: '取消', value: 'cancel' },
      { label: '确定', value: 'ok', cta: true },
    ],
  });
}

describe('flow-dialog UI 层：标准双动作 DOM 契约（铁律 3）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mask/popup id、role=dialog + aria-modal、h4/p 文本、.confirm-actions 容器全部保持', () => {
    void openDouble();
    const mask = document.getElementById(MASK_ID)!;
    expect(mask).not.toBeNull();
    const popup = document.getElementById(POPUP_ID)!;
    expect(popup).not.toBeNull();
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-modal')).toBe('true');
    expect(popup.querySelector('h4')!.textContent).toBe('确认操作');
    expect(popup.querySelector('p')!.textContent).toBe('该操作不可撤销');
    expect(popup.querySelector('.confirm-actions')).not.toBeNull();
    // popup 是 mask 子节点（样式层级由 mask 承载）
    expect(mask.contains(popup)).toBe(true);
  });

  it('按钮 id 与顺序：取消左、确认右；标准双动作按钮无附加类（与旧 confirm 逐字节同构）', () => {
    void openDouble();
    const btns = [...document.querySelectorAll('.confirm-actions button')] as HTMLElement[];
    expect(btns.map((b) => b.id)).toEqual([CANCEL_ID, OK_ID]);
    expect(btns.map((b) => b.textContent)).toEqual(['取消', '确定']);
    expect(btns.every((b) => b.className === '')).toBe(true);
  });

  it('焦点管理（UX 整改 37）：打开默认聚焦确认钮（回车=确认）；关闭还原焦点到触发元素', () => {
    const trigger = document.createElement('button');
    trigger.textContent = '触发';
    document.body.appendChild(trigger);
    trigger.focus();
    const p = openDouble();
    expect(document.activeElement).toBe(document.getElementById(OK_ID));
    expect(document.activeElement).not.toBe(document.getElementById(CANCEL_ID));
    (document.getElementById(OK_ID) as HTMLElement).click();
    return p.then((v) => {
      expect(v).toBe('ok');
      expect(document.getElementById(MASK_ID)).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('空标题回退「确认」（旧 confirm 行为保持）', () => {
    void openFlowDialog({ message: '正文', actions: [{ label: '取消', value: 'c' }, { label: '确定', value: 'ok' }] });
    expect(document.querySelector(`#${POPUP_ID} h4`)!.textContent).toBe('确认');
  });
});

describe('flow-dialog UI 层：Promise resolve 语义', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('点击动作按钮 → resolve 该动作 value；再次打开互不串扰', async () => {
    const p1 = openDouble();
    (document.getElementById(OK_ID) as HTMLElement).click();
    await expect(p1).resolves.toBe('ok');

    const p2 = openDouble();
    (document.getElementById(CANCEL_ID) as HTMLElement).click();
    await expect(p2).resolves.toBe('cancel');
  });

  it('遮罩点击 → resolve undefined（取消语义）；popup 内点击不触发取消', async () => {
    const p = openDouble();
    const mask = document.getElementById(MASK_ID) as HTMLElement;
    // popup 内部（h4）点击：不冒泡为取消
    (document.querySelector(`#${POPUP_ID} h4`) as HTMLElement).click();
    expect(document.getElementById(MASK_ID)).not.toBeNull();
    // 遮罩本体点击：取消
    mask.click();
    await expect(p).resolves.toBeUndefined();
    expect(document.getElementById(MASK_ID)).toBeNull();
  });

  it('ESC → resolve undefined（escManager q3-confirm 通道）；焦点还原', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const p = openDouble();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(p).resolves.toBeUndefined();
    expect(document.getElementById(MASK_ID)).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('ESC/遮罩路径同样把焦点还原到触发元素（共走 settle）', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const p = openDouble();
    (document.getElementById(MASK_ID) as HTMLElement).click();
    await p;
    expect(document.activeElement).toBe(trigger);
  });

  it('新流程框顶替在途流程框：旧框按取消语义 resolve undefined（Promise 不悬挂）', async () => {
    const p1 = openDouble();
    const p2 = openFlowDialog({
      title: '第二条',
      message: 'm',
      actions: [{ label: '取消', value: 'cancel' }, { label: '确定', value: 'ok', cta: true }],
    });
    await expect(p1).resolves.toBeUndefined();
    // 旧框已移除，只剩新框
    expect(document.querySelectorAll(`#${MASK_ID}`).length).toBe(1);
    expect(document.querySelector(`#${POPUP_ID} h4`)!.textContent).toBe('第二条');
    (document.getElementById(OK_ID) as HTMLElement).click();
    await expect(p2).resolves.toBe('ok');
  });

  it('actions 为空 → 拒绝（编程错误显式暴露，不弹空框）', async () => {
    await expect(openFlowDialog({ message: 'm', actions: [] })).rejects.toThrow(/actions 不能为空/);
    expect(document.getElementById(MASK_ID)).toBeNull();
  });
});

describe('flow-dialog UI 层：三动作扩展', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('三动作以新 id/类名渲染，点击中间动作 resolve 其 value；焦点落 cta 动作', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const p = openFlowDialog({
      title: '分流',
      message: '选择去向',
      actions: [
        { label: '甲', value: 'a' },
        { label: '乙', value: 'b', danger: true },
        { label: '丙', value: 'c', cta: true },
      ],
    });
    const btns = [...document.querySelectorAll('.confirm-actions button')] as HTMLButtonElement[];
    expect(btns.map((b) => b.id)).toEqual(['bz-flow-dialog-action-0', 'bz-flow-dialog-action-1', 'bz-flow-dialog-action-2']);
    expect(btns[1].classList.contains('bz-flow-dialog-danger')).toBe(true);
    expect(btns[2].classList.contains('bz-flow-dialog-cta')).toBe(true);
    expect(document.activeElement).toBe(btns[2]); // 焦点=cta 动作
    btns[1].click();
    await expect(p).resolves.toBe('b');
    expect(document.activeElement).toBe(trigger);
    // 既有契约 id 不出现在扩展布局
    expect(document.getElementById(CANCEL_ID)).toBeNull();
    expect(document.getElementById(OK_ID)).toBeNull();
  });
});

describe('flow-dialog UI 层：escapeHtml 防注入（P0-8 承继）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('含 <img src=x onerror=…> 的 title 渲染为纯文本，不产生可执行元素', () => {
    const evil = '<img src=x onerror="window.__pwned=1">';
    void openFlowDialog({
      title: evil,
      message: '正文',
      actions: [{ label: '取消', value: 'cancel' }, { label: '确定', value: 'ok' }],
    });
    const popup = document.getElementById(POPUP_ID)!;
    const h4 = popup.querySelector('h4')!;
    expect(h4.textContent).toBe(evil); // 文本内容逐字保留，未解析为元素
    expect(popup.querySelector('img')).toBeNull();
    expect((window as any).__pwned).toBeUndefined();
  });

  it('message 与按钮文案同样转义（script 标签不进入 DOM）', () => {
    void openFlowDialog({
      title: '确认删除？',
      message: '<script>window.__xss=1</script>',
      actions: [
        { label: '"取消"', value: 'cancel' },
        { label: '<b>确定</b>', value: 'ok' },
      ],
    });
    const popup = document.getElementById(POPUP_ID)!;
    expect(popup.querySelector('p')!.textContent).toBe('<script>window.__xss=1</script>');
    expect(popup.querySelector('script')).toBeNull();
    expect(document.getElementById(OK_ID)!.textContent).toBe('<b>确定</b>');
    expect(document.getElementById(CANCEL_ID)!.textContent).toBe('"取消"');
    expect((window as any).__xss).toBeUndefined();
  });
});
