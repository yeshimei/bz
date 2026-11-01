// @vitest-environment jsdom
/**
 * QQ 加群（core/qq-group.ts）。
 *
 * 2026-11-02 用户实测：桌面端点「加入」，NT 版 QQ 自己弹「很抱歉，你的QQ版本
 * 不支持本功能」——协议发出去了，客户端不认这个群卡片。用户看到的是我们的
 * 按钮坏了。所以这里钉两件事：
 *  - 桌面端**不发** mqqapi（发了就是请 QQ 弹那口锅），只复制群号 + 说清去哪粘；
 *  - 手机端照旧发（那条协议在手机 QQ 上是通的）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Platform } from 'obsidian';
import { clearNotices, resetObsidianMocks } from '../mock-obsidian-entry';
import { QQ_GROUP_NUMBER, openQqGroup, qqGroupUrl, qqJoinOneClick } from '../../src/core/qq-group';

/** app 壳：openExternalUrl 只会碰 openUrl */
function appSpy(): { openUrl: ReturnType<typeof vi.fn> } {
  return { openUrl: vi.fn(() => Promise.resolve()) };
}

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  (Platform as { isMobile: boolean }).isMobile = false;
});

describe('桌面端：不发协议，只把群号交到手里', () => {
  it('不调用 openUrl（调了 QQ 就弹「版本不支持本功能」）', () => {
    const app = appSpy();
    openQqGroup(app);
    expect(app.openUrl).not.toHaveBeenCalled();
  });

  it('通知里既有群号也有下一步（「到 QQ 里搜群号加入」）', async () => {
    const app = appSpy();
    openQqGroup(app);
    // 复制是异步的，通知在 clipboard 落定后才发
    await new Promise((r) => setTimeout(r, 0));
    const text = document.body.textContent || '';
    expect(text).toContain(QQ_GROUP_NUMBER);
    expect(text).toContain('到 QQ 里搜群号加入');
  });

  it('qqJoinOneClick() 为 false —— 调用方据此把按钮写成「复制群号」', () => {
    expect(qqJoinOneClick()).toBe(false);
  });
});

describe('手机端：那条 mqqapi 是通的，照旧唤起', () => {
  it('openUrl 收到群卡片协议，且群号正确', () => {
    (Platform as { isMobile: boolean }).isMobile = true;
    const app = appSpy();
    openQqGroup(app);
    expect(app.openUrl).toHaveBeenCalledTimes(1);
    const url = app.openUrl.mock.calls[0][0] as string;
    expect(url).toBe(qqGroupUrl());
    expect(url).toContain(`uin=${QQ_GROUP_NUMBER}`);
    expect(url.startsWith('mqqapi://card/show_pslcard?')).toBe(true);
  });
});
