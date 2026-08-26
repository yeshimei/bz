/**
 * 通用确认弹窗回归（P0-8 防注入）：title/message/confirmText/cancelText
 * 全部经 escapeHtml 后拼 HTML——恶意文案渲染为纯文本，不产生可执行元素。
 * DOM 结构/id（__shared_confirm_*）/类名不变。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { confirm } from '../../src/core/confirm';

describe('confirm 防注入（P0-8）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('含 <img src=x onerror=…> 的 title 渲染为纯文本', () => {
    const evil = '<img src=x onerror="window.__pwned=1">';
    confirm({ title: evil, message: '正文' });
    const popup = document.getElementById('__shared_confirm_popup__')!;
    expect(popup).not.toBeNull();
    const h4 = popup.querySelector('h4')!;
    // 文本内容逐字保留，未解析为元素
    expect(h4.textContent).toBe(evil);
    expect(popup.querySelector('img')).toBeNull();
    expect((window as any).__pwned).toBeUndefined();
    // 结构不变：h4 + p + confirm-actions（cancel/ok 两按钮）
    expect(popup.querySelectorAll('.confirm-actions button')).toHaveLength(2);
    expect(document.getElementById('__shared_confirm_ok__')).not.toBeNull();
    expect(document.getElementById('__shared_confirm_cancel__')).not.toBeNull();
  });

  it('message 与按钮文案同样转义（onerror 属性不进入 DOM）', () => {
    confirm({
      title: '确认删除？',
      message: '<script>window.__xss=1</script>',
      confirmText: '<b>确定</b>',
      cancelText: '"取消"',
    });
    const popup = document.getElementById('__shared_confirm_popup__')!;
    expect(popup.querySelector('p')!.textContent).toBe('<script>window.__xss=1</script>');
    expect(popup.querySelector('script')).toBeNull();
    expect(document.getElementById('__shared_confirm_ok__')!.textContent).toBe('<b>确定</b>');
    expect(document.getElementById('__shared_confirm_cancel__')!.textContent).toBe('"取消"');
    expect((window as any).__xss).toBeUndefined();
  });

  it('正常文案与确认/取消回调不受影响（行为保持）', () => {
    let ok = false;
    let no = false;
    confirm({
      title: '确认操作',
      message: '该操作不可撤销',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: () => (ok = true),
      onCancel: () => (no = true),
    });
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    expect(ok).toBe(true);
    expect(no).toBe(false);
    confirm({ title: '第二条', onCancel: () => (no = true) });
    (document.getElementById('__shared_confirm_cancel__') as HTMLElement).click();
    expect(no).toBe(true);
  });

  it('焦点管理（UX 整改 37）：popup 挂 role=dialog + aria-modal；打开聚焦首个可交互元素；关闭还原焦点', () => {
    const trigger = document.createElement('button');
    trigger.textContent = '触发';
    document.body.appendChild(trigger);
    trigger.focus();
    confirm({ title: '确认', message: '正文' });
    const popup = document.getElementById('__shared_confirm_popup__')!;
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-modal')).toBe('true');
    // 首个可交互元素 = 取消钮（DOM 序在前，确认钮在后；默认焦点不落确认钮防误删）
    expect(document.activeElement).toBe(document.getElementById('__shared_confirm_cancel__'));
    // 点确认关闭 → 焦点还原到触发元素
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    expect(popup.isConnected).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('焦点管理：ESC/遮罩关闭同样还原焦点', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    confirm({ title: '确认' });
    (document.getElementById('__shared_confirm_mask__') as HTMLElement).click();
    expect(document.activeElement).toBe(trigger);
  });
});
