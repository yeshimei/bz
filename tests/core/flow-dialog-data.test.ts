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

  it('危险主动作：焦点反落取消动作（Enter=取消），dangerPrimary 仍按主动作判定（效率审查#1）', () => {
    const parts = buildFlowDialogParts('删除影视', '该操作不可撤销', [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'del', cta: true, danger: true },
    ]);
    // 焦点不落删除钮：弹窗一开回车不再直通危险动作，须 Tab 或鼠标触达
    expect(parts.focusId).toBe(FLOW_DIALOG_CANCEL_ID);
    // bz-flow-dialog--danger 中性形制只看主动作是否危险，不受焦点反落影响
    expect(parts.dangerPrimary).toBe(true);
    // 非主动作位的 danger（左侧取消是 danger）不触发反焦：焦点照旧落最后动作
    const notPrimary = buildFlowDialogParts('t', 'm', [
      { label: '取消', value: 'cancel', danger: true },
      { label: '确定', value: 'ok' },
    ]);
    expect(notPrimary.focusId).toBe(FLOW_DIALOG_OK_ID);
  });

  it('非危险主动作保持「cta 优先、缺省最后动作」（回车=确认的效率语义不变，回归保护）', () => {
    const withCta = buildFlowDialogParts('t', 'm', [
      { label: '取消', value: 'cancel' },
      { label: '确定', value: 'ok', cta: true },
    ]);
    expect(withCta.focusId).toBe(FLOW_DIALOG_OK_ID);
    expect(withCta.dangerPrimary).toBe(false);
  });

  it('三动作且主动作危险：焦点落首个非危险动作；全部动作皆危险时保持主动作（保底不炸）', () => {
    const mixed = buildFlowDialogParts('t', 'm', [
      { label: '甲', value: 'a' },
      { label: '乙', value: 'b', danger: true, cta: true },
      { label: '丙', value: 'c', danger: true },
    ]);
    expect(mixed.focusId).toBe('bz-flow-dialog-action-0'); // 首个非危险动作
    expect(mixed.dangerPrimary).toBe(true);
    const allDanger = buildFlowDialogParts('t', 'm', [
      { label: '甲', value: 'a', danger: true },
      { label: '乙', value: 'b', danger: true, cta: true },
      { label: '丙', value: 'c', danger: true },
    ]);
    expect(allDanger.focusId).toBe('bz-flow-dialog-action-1'); // 无安全侧可落 → 焦点留在主动作
  });

  it('confirmDiscard 安全聚焦语义不受影响：无 danger 双动作焦点落「继续编辑」（最后动作）', () => {
    const parts = buildFlowDialogParts('放弃未保存的内容？', '弹窗内有未保存的输入，关闭后将丢失', [
      { label: '放弃', value: 'ok' },
      { label: '继续编辑', value: 'cancel' },
    ]);
    expect(parts.focusId).toBe(FLOW_DIALOG_OK_ID); // 右侧（后渲染）= 继续编辑
  });

  it('空标题回退「确认」（旧 confirm 行为保持）', () => {
    const parts = buildFlowDialogParts(undefined, '正文', [
      { label: '取消', value: 'cancel' },
      { label: '确定', value: 'ok' },
    ]);
    expect(parts.html).toContain('<h4>确认</h4>');
  });

  it('dangerPrimary：主动作（cta 优先，否则最后一个）带 danger 才为 true（issue 291 慎重决策中性按钮依据）', () => {
    // 删除类确认：右侧确认钮 danger → true
    expect(buildFlowDialogParts('删除', 'm', [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'del', danger: true, cta: true },
    ]).dangerPrimary).toBe(true);
    // 无 danger 标记的安全确认 → false（主按钮保持高亮）
    expect(buildFlowDialogParts('归档', 'm', [
      { label: '取消', value: 'cancel' },
      { label: '归档', value: 'ok', cta: true },
    ]).dangerPrimary).toBe(false);
    // danger 不在主动作位（左侧取消是 danger）→ false
    expect(buildFlowDialogParts('t', 'm', [
      { label: '取消', value: 'cancel', danger: true },
      { label: '确定', value: 'ok' },
    ]).dangerPrimary).toBe(false);
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

describe('flow-dialog 数据层：message 换行渲染（效率审查#4）', () => {
  it('message 的 \\n 渲染为 <br>：多段确认文案分行，不再挤成一行', () => {
    const parts = buildFlowDialogParts('确认删除', '第一行\n\n第二行', [
      { label: '取消', value: 'cancel' },
      { label: '删除', value: 'ok' },
    ]);
    expect(parts.html).toContain('<p>第一行<br><br>第二行</p>');
    // 无换行的 message 不引入 <br>（现状不变）
    const plain = buildFlowDialogParts('t', '单行文案', [
      { label: '取消', value: 'cancel' },
      { label: '确定', value: 'ok' },
    ]);
    expect(plain.html).toContain('<p>单行文案</p>');
  });

  it('\\n 替换发生在 escapeHtml 之后：注入内容仍被转义，<br> 是唯一放行的标签', () => {
    const evil = '第一段 <img src=x onerror="window.__pwned=1">\n第二段 <script>window.__xss=1</script>';
    const parts = buildFlowDialogParts('t', evil, [
      { label: '取消', value: 'cancel' },
      { label: '确定', value: 'ok' },
    ]);
    expect(parts.html).toContain(
      '&lt;img src=x onerror=&quot;window.__pwned=1&quot;&gt;<br>第二段 &lt;script&gt;window.__xss=1&lt;/script&gt;'
    );
    expect(parts.html).not.toContain('<img');
    expect(parts.html).not.toContain('<script>');
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
