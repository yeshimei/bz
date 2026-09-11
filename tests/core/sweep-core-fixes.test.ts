/**
 * 全域审查共享基座修复批回归（C5/C6/C8/C9/C10/C11/C12/C14，src/core）：
 * - C5 uiSelect/uiPopover ESC 走 escManager 层（私挂 document 级 ESC 监听退役——面板开着时
 *   按 ESC 整面板直关、下拉不动的层序倒挂）；
 * - C6 长按静置窗口只吞落在浮层内的合成 click（浮层外真实点击不再被盲吞）；
 * - C8 z-order 恒顶集补 unregister + 离场清扫（Set 只进不出的 DOM 子树滞留）；
 * - C9 closeLightbox() 一并注销 esc 层；
 * - C10 list 行移除 onChange 抛错 → 通知 + 回滚重绘（不再 unhandled rejection）；
 * - C11 模型选择器 onPick 抛错也关闭（finally），不再卡死；
 * - C12 uiChoice float 的 window resize 监听离场自摘；
 * - C14 cancelActiveFlowDialog：插件卸载前在途确认框按取消语义结算。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uiSelect } from '../../src/core/ui/select';
import { uiPopover } from '../../src/core/ui/popover';
import { uiChoice } from '../../src/core/ui/choice';
import { escManager } from '../../src/core/esc-manager';
import { openItemSheet, closeItemMenu } from '../../src/core/item-actions';
import { registerAlwaysOnTop, unregisterAlwaysOnTop, allocZ } from '../../src/core/z-order';
import { openLightbox, closeLightbox } from '../../src/core/ui/lightbox';
import { renderSettingsInto } from '../../src/core/settings-schema';
import type { SettingsSchema } from '../../src/core/settings-schema';
import { openModelPicker, closeModelPicker } from '../../src/core/settings-model-picker';
import { openFlowDialog, cancelActiveFlowDialog } from '../../src/core/flow-dialog';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';

describe('sweep-core 共享基座修复批（C5-C14）', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    closeItemMenu();
  });

  afterEach(() => {
    closeItemMenu();
    closeLightbox();
    closeModelPicker();
    cancelActiveFlowDialog();
    document.body.innerHTML = '';
  });

  // ---------- C5 ----------

  it('C5 uiSelect：面板 esc 层开着时按 ESC，先关下拉、面板保留（层序不再倒挂）', () => {
    let panelOpen = true;
    const closePanel = vi.fn(() => {
      panelOpen = false;
    });
    const panelHandle = escManager.register('bz-test-panel-c5', { isVisible: () => panelOpen, close: closePanel });
    const el = uiSelect({
      value: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      onChange: () => {},
    }).el;
    document.body.appendChild(el);
    el.click(); // 开下拉
    expect(el.classList.contains('open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.classList.contains('open')).toBe(false); // 下拉（后开的层）先关
    expect(closePanel).not.toHaveBeenCalled(); // 面板不动

    // 第二次 ESC：轮到面板层
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closePanel).toHaveBeenCalledTimes(1);
    panelHandle.unregister();
  });

  it('C5 uiSelect：菜单关闭后 ESC 无残留副作用；detach 幂等', () => {
    const comp = uiSelect({
      value: 'a',
      options: [{ value: 'a', label: 'A' }],
      onChange: () => {},
    });
    document.body.appendChild(comp.el);
    comp.el.click();
    comp.el.click(); // 再点收起（close 已注销 esc 层）
    expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))).not.toThrow();
    expect(() => comp.detach()).not.toThrow();
  });

  it('C5 uiPopover：面板 esc 层开着时按 ESC，先关浮层、面板保留', () => {
    let panelOpen = true;
    const closePanel = vi.fn(() => {
      panelOpen = false;
    });
    const panelHandle = escManager.register('bz-test-panel-c5b', { isVisible: () => panelOpen, close: closePanel });
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    const anchor = document.createElement('button');
    wrap.appendChild(anchor);
    document.body.appendChild(wrap);
    const pop = uiPopover({ anchor, options: [{ id: 'a', label: 'A' }], onPick: () => {} });
    pop.open();
    expect(wrap.querySelector('.bz-popover')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrap.querySelector('.bz-popover')).toBeNull(); // 浮层先关
    expect(closePanel).not.toHaveBeenCalled();
    panelHandle.unregister();
  });

  // ---------- C6 ----------

  it('C6 长按静置窗口：浮层外真实点击放行（不被盲吞），外部点击关闭照常', () => {
    openItemSheet([{ icon: 'pencil', label: '编辑', onClick: () => {} }], { sheetTitle: '条目' });
    const card = document.createElement('div');
    document.body.appendChild(card);
    const realClick = vi.fn();
    card.addEventListener('click', realClick);

    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(realClick).toHaveBeenCalledTimes(1); // 真实点击未被吞
    expect(document.querySelector('.bz-item-sheet')).toBeNull(); // 外部点击照常关闭抽屉
    closeItemMenu();
  });

  it('C6 长按静置窗口：落在遮罩/抽屉内的合成 click 仍被吞（防浮层闪关的原始语义保留）', () => {
    openItemSheet([{ icon: 'pencil', label: '编辑', onClick: () => {} }], { sheetTitle: '条目' });
    const mask = document.querySelector('.bz-item-sheet-mask') as HTMLElement;
    expect(mask).not.toBeNull();
    const maskClick = vi.fn();
    mask.addEventListener('click', maskClick);

    mask.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(maskClick).not.toHaveBeenCalled(); // 合成 click 被吞
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull(); // 抽屉未被误关
    closeItemMenu();
  });

  // ---------- C8 ----------

  it('C8 unregisterAlwaysOnTop 显式出队：注销后不再抬顶', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    registerAlwaysOnTop(el);
    expect(el.style.zIndex).not.toBe('');
    unregisterAlwaysOnTop(el);
    const z = el.style.zIndex;
    allocZ(); // 分配触发 sync：el 已出队，不再抬
    expect(el.style.zIndex).toBe(z);
  });

  it('C8 离场元素由 sync 自动清扫：remove 后 Set 不再滞留（style 不再被更新）', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    registerAlwaysOnTop(el);
    const zBefore = el.style.zIndex;
    el.remove();
    allocZ(); // 清扫离场元素
    const zAfter = el.style.zIndex;
    allocZ(); // 再分配：el 已不在集合，zIndex 冻结
    expect(el.style.zIndex).toBe(zAfter);
    expect(zAfter).toBe(zBefore); // 离场期间没人再抬它
    // 重新挂载 + 重新注册（smartcat 重挂载路径）恢复恒顶
    document.body.appendChild(el);
    registerAlwaysOnTop(el);
    allocZ();
    expect(el.style.zIndex).not.toBe(zAfter);
  });

  // ---------- C9 ----------

  it('C9 closeLightbox() 一并注销 esc 层（handle.unregister 被调用）', () => {
    const regSpy = vi.spyOn(escManager, 'register');
    const { close } = openLightbox({ src: 'a.png', title: '图' });
    const handle = regSpy.mock.results[regSpy.mock.results.length - 1].value;
    const unSpy = vi.spyOn(handle, 'unregister');
    closeLightbox(); // 导出的直关路径（非内部 close）
    expect(unSpy).toHaveBeenCalledTimes(1);
    regSpy.mockRestore();
    unSpy.mockRestore();
    void close;
  });

  // ---------- C10 ----------

  it('C10 list 行移除 onChange 抛错：通知 + 回滚重绘（条目恢复显示，不悬挂 rejection）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = { notes: ['a.md', 'b.md'] };
    setSettingsProvider(() => ({}) as any);
    setSettingsSaver(async () => {});
    const schema: SettingsSchema = {
      groups: [
        {
          name: '名单',
          rows: [
            {
              type: 'list',
              name: '名单行',
              items: () => state.notes.map((n) => ({ key: n, label: n })),
              onChange: () => {
                throw new Error('移除失败（域内约束）');
              },
            },
          ],
        },
      ],
    };
    const container = document.createElement('div');
    renderSettingsInto(container, schema);
    const removeBtn = container.querySelector('.bz-setlist-remove') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    expect(() => removeBtn.click()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // 异步 IIFE 走完 try/catch/finally
    expect(container.querySelectorAll('.bz-setlist-item')).toHaveLength(2); // 回滚重绘：条目仍在
    errSpy.mockRestore();
  });

  it('C10 list 行移除成功路径不受影响：onChange 成功后条目移除（回归保护）', async () => {
    const state = { notes: ['a.md', 'b.md'] };
    setSettingsProvider(() => ({}) as any);
    setSettingsSaver(async () => {});
    const schema: SettingsSchema = {
      groups: [
        {
          name: '名单',
          rows: [
            {
              type: 'list',
              name: '名单行',
              items: () => state.notes.map((n) => ({ key: n, label: n })),
              onChange: (keys) => {
                state.notes = keys as string[];
              },
            },
          ],
        },
      ],
    };
    const container = document.createElement('div');
    renderSettingsInto(container, schema);
    (container.querySelector('.bz-setlist-remove') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(state.notes).toEqual(['b.md']);
    expect(container.querySelectorAll('.bz-setlist-item')).toHaveLength(1);
  });

  // ---------- C11 ----------

  it('C11 模型选择器 onPick 抛错（同步）：选择器仍关闭，不卡死', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    openModelPicker({
      providerLabel: 'DeepSeek',
      current: 'm1',
      models: [{ id: 'm1' }, { id: 'm2' }],
      onPick: () => {
        throw new Error('onPick 崩了');
      },
    });
    const row = document.querySelector('.bz-model-picker-row') as HTMLElement;
    expect(row).not.toBeNull();
    row.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.bz-model-picker-mask')).toBeNull(); // 已关闭
    errSpy.mockRestore();
  });

  it('C11 模型选择器 onPick Promise reject：选择器仍关闭', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    openModelPicker({
      providerLabel: 'DeepSeek',
      current: 'm1',
      models: [{ id: 'm1' }],
      onPick: () => Promise.reject(new Error('写入失败')),
    });
    (document.querySelector('.bz-model-picker-row') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.bz-model-picker-mask')).toBeNull();
    errSpy.mockRestore();
  });

  it('C11 onPick 成功路径：选择后关闭（回归保护）', async () => {
    openModelPicker({
      providerLabel: 'DeepSeek',
      current: 'm1',
      models: [{ id: 'm1' }, { id: 'm2' }],
      onPick: () => {},
    });
    (document.querySelector('.bz-model-picker-row') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelector('.bz-model-picker-mask')).toBeNull();
  });

  // ---------- C12 ----------

  it('C12 uiChoice float：元素离场后触发 resize 自摘 window 监听', () => {
    const rmSpy = vi.spyOn(window, 'removeEventListener');
    const choice = uiChoice({
      float: true,
      value: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      onChange: () => {},
    });
    // el 未挂载（或已移除）：resize 触发自清理
    window.dispatchEvent(new Event('resize'));
    expect(rmSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    rmSpy.mockRestore();
    // detach 仍可主动清理（幂等，不抛错）
    expect(() => choice.detach()).not.toThrow();
  });

  it('C12 uiChoice float：在挂状态下 resize 正常重算不摘监听（回归保护）', () => {
    const rmSpy = vi.spyOn(window, 'removeEventListener');
    const choice = uiChoice({
      float: true,
      value: 'a',
      options: [{ value: 'a', label: 'A' }],
      onChange: () => {},
    });
    document.body.appendChild(choice.el);
    window.dispatchEvent(new Event('resize'));
    expect(rmSpy).not.toHaveBeenCalledWith('resize', expect.any(Function));
    rmSpy.mockRestore();
    choice.detach();
  });

  // ---------- C14 ----------

  it('C14 cancelActiveFlowDialog：在途确认框按取消语义结算（resolve undefined + DOM 清理），幂等', async () => {
    const pending = openFlowDialog({
      message: '确认删除？',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: '确定', value: 'ok' },
      ],
    });
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
    cancelActiveFlowDialog();
    await expect(pending).resolves.toBeUndefined(); // 不再悬挂
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();
    expect(() => cancelActiveFlowDialog()).not.toThrow(); // 无在途框幂等
  });

  // ---------- C7 ----------

  it('C7 派生密钥缓存命中语义保留：同 (密码, salt) 返回同一密钥实例', async () => {
    const { CryptoService, clearCryptoKeyCache } = await import('../../src/core/crypto');
    clearCryptoKeyCache();
    const salt = new Uint8Array(16).fill(7);
    const a = await CryptoService.deriveKey('pw', salt);
    const b = await CryptoService.deriveKey('pw', salt);
    expect(b).toBe(a); // 缓存命中：同一 CryptoKey 实例（重开预览/重复渲染不重复派生）
    const c = await CryptoService.deriveKey('pw2', salt); // 同 salt 换密码：重新派生（校验 pw）
    expect(c).not.toBe(a);
    clearCryptoKeyCache();
  });

  it('C7 缓存 LRU 有界：超过上限后条数不再增长（明文密码副本不无限堆积）', async () => {
    const { CryptoService, clearCryptoKeyCache, __keyCacheSizeForTests, KEY_CACHE_MAX } = await import(
      '../../src/core/crypto'
    );
    clearCryptoKeyCache();
    // 派生 KEY_CACHE_MAX + 20 条（每条独立 salt）：size 恒 ≤ 上限
    for (let i = 0; i < KEY_CACHE_MAX + 20; i++) {
      const salt = new Uint8Array(16).fill(i % 256);
      salt[0] = i & 0xff;
      salt[1] = (i >> 8) & 0xff;
      await CryptoService.deriveKey('pw', salt);
    }
    expect(__keyCacheSizeForTests()).toBeLessThanOrEqual(KEY_CACHE_MAX);
    // 淘汰后同 (密码, salt) 重新派生仍正确（返回新实例，不抛错）
    const salt = new Uint8Array(16).fill(3);
    await expect(CryptoService.deriveKey('pw', salt)).resolves.toBeInstanceOf(CryptoKey);
    clearCryptoKeyCache();
  }, 30000);

  it('C7 encrypt→decrypt roundtrip 正确性不受影响（回归保护）', async () => {
    const { CryptoService } = await import('../../src/core/crypto');
    const cipher = await CryptoService.encrypt('机密内容', '主密码');
    await expect(CryptoService.decrypt(cipher, '主密码')).resolves.toBe('机密内容');
    await expect(CryptoService.decrypt(cipher, '错密码')).rejects.toThrow();
  });
});
