// @vitest-environment node
/**
 * settings-common 数据层测试（review-deep 架#6 测试缺口收口）：
 * numStrBinding 空值/非正数回退默认与 set 落字符串 / makeReloadWarnOnce 一次性提示 /
 * SYNC_WATCHED_FOLDERS 常量值冻结。node 环境（notice 以 mock 顶替，不触 DOM）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// makeReloadWarnOnce 依赖 notice（DOM 通道）——node 环境以空实现顶替
vi.mock('../../src/core/notice', () => ({ notice: vi.fn() }));

import { notice } from '../../src/core/notice';
import { numStrBinding, makeReloadWarnOnce, SYNC_WATCHED_FOLDERS } from '../../src/core/settings-common';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';

const state: Record<string, unknown> = {};

beforeEach(() => {
  for (const k of Object.keys(state)) delete state[k];
  setSettingsProvider(() => state as any);
  setSettingsSaver(async () => {});
  (notice as ReturnType<typeof vi.fn>).mockClear();
});

describe('numStrBinding：string 键 ↔ number 值绑定（ticket 170 回退语义）', () => {
  it('空串/null/undefined 回退默认（用户没填值就填默认值）', () => {
    state.encryptedPreview = '';
    expect(numStrBinding('encryptedPreview', 800).get()).toBe(800);
    delete state.encryptedPreview;
    expect(numStrBinding('encryptedPreview', 800).get()).toBe(800); // undefined
    state.encryptedPreview = null;
    expect(numStrBinding('encryptedPreview', 1024).get()).toBe(1024);
  });

  it('0/负数/NaN/非有限数回退默认（非正数一律不认）', () => {
    state.encryptedPreview = '0';
    expect(numStrBinding('encryptedPreview', 800).get()).toBe(800);
    state.encryptedPreview = '-5';
    expect(numStrBinding('encryptedPreview', 800).get()).toBe(800);
    state.encryptedPreview = 'abc';
    expect(numStrBinding('encryptedPreview', 800).get()).toBe(800);
    state.encryptedPreview = 'NaN';
    expect(numStrBinding('encryptedPreview', 800).get()).toBe(800);
  });

  it('合法正数原样返回（字符串形态读取）', () => {
    state.encryptedPreview = '1920';
    expect(numStrBinding('encryptedPreview', 800).get()).toBe(1920);
    state.encryptedPreview = '3.5';
    expect(numStrBinding('encryptedPreview', 800).get()).toBe(3.5);
  });

  it('set 落字符串（数据格式冻结）；save 透传 saveSettings', async () => {
    const save = vi.fn(async () => {});
    setSettingsSaver(save);
    const b = numStrBinding('encryptedPreview', 800);
    b.set(1080);
    expect(state.encryptedPreview).toBe('1080');
    await b.save();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('makeReloadWarnOnce：重载提示一次性上限', () => {
  it('首次触发弹一次通知，二次触发不再弹（弹窗会话内至多一次）', () => {
    const warn = makeReloadWarnOnce();
    warn();
    expect(notice).toHaveBeenCalledTimes(1);
    warn();
    warn();
    expect(notice).toHaveBeenCalledTimes(1);
  });

  it('每次 makeReloadWarnOnce() 独立计数（新弹窗会话可再次提示）', () => {
    makeReloadWarnOnce()();
    expect(notice).toHaveBeenCalledTimes(1);
    makeReloadWarnOnce()();
    expect(notice).toHaveBeenCalledTimes(2);
  });
});

describe('SYNC_WATCHED_FOLDERS 常量（issue 187）', () => {
  it('值冻结为固定默认（原 aiAgentWatchedFolders 退役值，改动即破坏存量行为）', () => {
    expect(typeof SYNC_WATCHED_FOLDERS).toBe('string');
    expect(SYNC_WATCHED_FOLDERS).toBe('卡片盒,归档/网页剪藏');
    // 原始值不可扩属性（string primitive 的冻结语义：Object.isFrozen 恒真，作形态守卫）
    expect(Object.isFrozen(SYNC_WATCHED_FOLDERS)).toBe(true);
  });
});
