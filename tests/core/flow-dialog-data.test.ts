// @vitest-environment node
/**
 * 流程框声明内核·数据层（ADR-0064 决策 6，ticket 131 Wave-1）
 * buildFlowDialogParts 纯函数：actions → 按钮 id/类名/顺序/焦点 + popup HTML（escapeHtml 防注入）。
 * DOM 契约：标准双动作与旧 core/confirm 逐字节同构（取消左/确认右，无附加类）；
 * 其余数量动作用新 id `bz-flow-dialog-action-<i>` / 新类 `bz-flow-dialog-action`，既有 id/类名不破坏。
 */
import { describe, it, expect } from 'vitest';
import {
  buildFlowDialogParts,
  FLOW_DIALOG_CANCEL_ID,
  FLOW_DIALOG_OK_ID,
} from '../../src/core/flow-dialog';

describe('flow-dialog 数据层：标准双动作 DOM 契约', () => {
  it('双动作渲染旧 confirm 同构结构：h4/p/.confirm-actions + cancel 左 / ok 右，无附加类', () => {
    const parts = buildFlowDialogParts('确认删除', '该操作不可撤销', [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok', cta: true },
    ]);
    expect(parts.html).toBe(
      '<h4>确认删除</h4>' +
        '<p>该操作不可撤销</p>' +
        '<div class="confirm-actions">' +
        `<button id="${FLOW_DIALOG_CANCEL_ID}">取消</button>` +
        `<button id="${FLOW_DIALOG_OK_ID}">删除</button>` +
        '</div>'
    );
    expect(parts.buttons.map((b) => b.id)).toEqual([FLOW_DIALOG_CANCEL_ID, FLOW_DIALOG_OK_ID]);
    expect(parts.buttons.every((b) => b.className === '')).toBe(true); // 标准双动作不附加任何新类
  });

  it('按钮顺序恒为「取消左、确认右」（actions 数组顺序 = 左 → 右）', () => {
    const parts = buildFlowDialogParts('放弃本次做题？', '未完成的题目将丢弃', [
      { label: '继续做题', value: 'cancel' },
      { label: '放弃', value: 'ok', cta: true },
    ]);
    const okIdx = parts.html.indexOf(FLOW_DIALOG_OK_ID);
    const cancelIdx = parts.html.indexOf(FLOW_DIALOG_CANCEL_ID);
    expect(cancelIdx).toBeGreaterThan(-1);
    expect(okIdx).toBeGreaterThan(cancelIdx); // 确认钮出现在取消钮之后（右侧）
  });

  it('焦点默认落确认动作（cta 标记优先；无标记时最后一个动作）', () => {
    const withCta = buildFlowDialogParts('t', 'm', [
      { label: '取消', value: 'cancel' },
      { label: '确定', value: 'ok', cta: true },
    ]);
    expect(withCta.focusId).toBe(FLOW_DIALOG_OK_ID);
    const noFlag = buildFlowDialogParts('t', 'm', [
      { label: '取消', value: 'cancel' },
      { label: '确定', value: 'ok' },
    ]);
    expect(noFlag.focusId).toBe(FLOW_DIALOG_OK_ID); // 无标记双动作：最后一个=右侧确认钮
    const ctaLeft = buildFlowDialogParts('t', 'm', [
      { label: '左', value: 'a', cta: true },
      { label: '右', value: 'b' },
    ]);
    expect(ctaLeft.focusId).toBe(FLOW_DIALOG_CANCEL_ID); // cta 显式标在左侧动作 → 焦点随声明
  });

  it('空标题回退「确认」（旧 confirm 行为保持）', () => {
    const parts = buildFlowDialogParts(undefined, '正文', [
      { label: '取消', value: 'cancel' },
      { label: '确定', value: 'ok' },
    ]);
    expect(parts.html).toContain('<h4>确认</h4>');
  });
});

describe('flow-dialog 数据层：三动作及以上扩展', () => {
  it('三动作全部用新 id/类名，容器仍为 .confirm-actions，既有契约 id 不出现', () => {
    const parts = buildFlowDialogParts('分流', '选择去向', [
      { label: '甲', value: 'a' },
      { label: '乙', value: 'b', danger: true },
      { label: '丙', value: 'c', cta: true },
    ]);
    expect(parts.buttons.map((b) => b.id)).toEqual([
      'bz-flow-dialog-action-0',
      'bz-flow-dialog-action-1',
      'bz-flow-dialog-action-2',
    ]);
    expect(parts.buttons[0].className).toBe('bz-flow-dialog-action');
    expect(parts.buttons[1].className).toBe('bz-flow-dialog-action bz-flow-dialog-danger');
    expect(parts.buttons[2].className).toBe('bz-flow-dialog-action bz-flow-dialog-cta');
    expect(parts.html).toContain('<div class="confirm-actions">');
    expect(parts.html).not.toContain(FLOW_DIALOG_CANCEL_ID);
    expect(parts.html).not.toContain(FLOW_DIALOG_OK_ID);
    expect(parts.focusId).toBe('bz-flow-dialog-action-2'); // 焦点落 cta 动作
  });

  it('无 cta 标记的多动作：焦点落最后一个动作', () => {
    const parts = buildFlowDialogParts('t', 'm', [
      { label: '甲', value: 'a' },
      { label: '乙', value: 'b' },
      { label: '丙', value: 'c' },
    ]);
    expect(parts.focusId).toBe('bz-flow-dialog-action-2');
  });

  it('单动作：新 id/类名方案同样适用，焦点即该按钮', () => {
    const parts = buildFlowDialogParts('提示', '知道了', [{ label: '知道了', value: 'ok' }]);
    expect(parts.buttons).toHaveLength(1);
    expect(parts.buttons[0].id).toBe('bz-flow-dialog-action-0');
    expect(parts.focusId).toBe('bz-flow-dialog-action-0');
  });
});

describe('flow-dialog 数据层：escapeHtml 防注入（P0-8 承继）', () => {
  it('title/message/按钮 label 全部转义，恶意标签不保留原文', () => {
    const evil = '<img src=x onerror="window.__pwned=1">';
    const parts = buildFlowDialogParts(evil, '<script>window.__xss=1</script>', [
      { label: '"取消"', value: 'cancel' },
      { label: "<b>确定</b>", value: 'ok' },
    ]);
    expect(parts.html).not.toContain('<img');
    expect(parts.html).not.toContain('<script>');
    expect(parts.html).not.toContain('<b>确定</b></button>'); // 按钮文案同样不落原文标签
    expect(parts.html).toContain('&lt;img src=x onerror=&quot;window.__pwned=1&quot;&gt;');
    expect(parts.html).toContain('&lt;script&gt;window.__xss=1&lt;/script&gt;');
    expect(parts.html).toContain('&quot;取消&quot;');
    expect(parts.html).toContain('&lt;b&gt;确定&lt;/b&gt;');
  });

  it('spec.label 保留原文（转义只发生在 html 拼接层）', () => {
    const parts = buildFlowDialogParts('t', 'm', [
      { label: '<b>左</b>', value: 'cancel' },
      { label: '右', value: 'ok' },
    ]);
    expect(parts.buttons[0].label).toBe('<b>左</b>');
  });
});
