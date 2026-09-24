/**
 * 第二大脑设置弹窗「本机局域网 IP」自查行（ticket 122；issue 423/ADR-0183 改造，jsdom）：
 * - 桌面端：动态 desc 展示本机 IP + 行内「填入远程 URL」一键刷新（确认后覆盖 + 落盘）；
 * - 移动端：只给引导 info 行（指向 AI 面板），不做 os 探测；
 * - 迁移无残留：两行 Ollama 地址输入框（唯一入口 = AI 面板 Embedding 组）不再出现在本页 DOM。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openSecondBrainSettings } from '../../src/secondbrain/panel';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, clearNotices, hasNotice, Platform } from '../mock-obsidian-entry';

let settings: any;
let saveSpy: any;

function stubOsNetwork(interfaces: Record<string, Array<{ address: string; internal?: boolean }>>) {
  (window as any).require = (m: string) =>
    m === 'os' ? { networkInterfaces: () => interfaces } : undefined;
}

function rowByName(name: string): any {
  const el = [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].find(
    (s) => (s as HTMLElement).dataset.name === name
  );
  expect(el, `行 ${name} 应在场`).toBeTruthy();
  return (el as any).__setting;
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetObsidianMocks();
  clearNotices();
  Platform.isMobile = false;
  settings = { secondBrainRemoteOllamaUrl: 'http://192.168.1.8:11434' };
  setSettingsProvider(() => settings);
  saveSpy = vi.fn(async () => {});
  setSettingsSaver(saveSpy);
  delete (window as any).require;
});

describe('第二大脑设置：本机局域网 IP（ticket 122 / issue 423）', () => {
  it('桌面端展示本机 IP，行内「填入远程 URL」确认后覆盖设置并落盘', async () => {
    stubOsNetwork({
      WLAN: [{ address: '192.168.1.45', internal: false }],
      'Loopback Pseudo-Interface 1': [{ address: '127.0.0.1', internal: true }],
      vEthernet: [{ address: '169.254.10.2', internal: false }],
    });
    openSecondBrainSettings();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());

    // 只展示可用 IPv4（过滤回环/link-local），desc 里点名按钮（就地自查自修）
    const ipRow = rowByName('本机局域网 IP');
    expect(ipRow.desc).toContain('192.168.1.45');
    expect(ipRow.desc).not.toContain('169.254');
    expect(ipRow.desc).toContain('填入远程 URL');

    // 按钮就在本行（issue 423：随探测展示同处），确认后覆盖 + 落盘
    const btn = ipRow.controls.find((c: any) => c.text === '填入远程 URL');
    expect(btn).toBeTruthy();
    btn.trigger();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    expect(document.getElementById('__shared_confirm_popup__')!.textContent).toContain('http://192.168.1.45:11434');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();
    // 确认链走 Promise 微任务（ticket 131）——waitFor 等全链落定
    await vi.waitFor(() => expect(settings.secondBrainRemoteOllamaUrl).toBe('http://192.168.1.45:11434'));
    expect(saveSpy).toHaveBeenCalled();
  });

  it('迁移无残留：两行 Ollama 地址输入框不在本页（唯一入口 = AI 面板 Embedding 组）', async () => {
    stubOsNetwork({ WLAN: [{ address: '192.168.1.45', internal: false }] });
    openSecondBrainSettings();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());

    const names = [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].map(
      (s) => (s as HTMLElement).dataset.name
    );
    expect(names).not.toContain('Ollama 本地 URL');
    expect(names).not.toContain('移动端远程地址');
  });

  it('移动端 IP 行只给引导文案（无填入按钮），打开设置不触发探测', async () => {
    Platform.isMobile = true;
    const reqSpy = vi.fn();
    (window as any).require = reqSpy;
    openSecondBrainSettings();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());

    const ipRow = rowByName('局域网 IP 提示');
    expect(ipRow.desc).toContain('在电脑端 AI 面板核对远程地址');
    expect(ipRow.controls.some((c: any) => c.text === '填入远程 URL')).toBe(false);
    expect(reqSpy).not.toHaveBeenCalled();
  });

  it('未探测到 IP 时点填入不覆盖，给出提示', async () => {
    stubOsNetwork({});
    openSecondBrainSettings();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());

    const ipRow = rowByName('本机局域网 IP');
    const btn = ipRow.controls.find((c: any) => c.text === '填入远程 URL');
    btn.trigger();
    expect(hasNotice('未探测到本机局域网 IP，请在 AI 面板手动填写')).toBe(true);
    expect(settings.secondBrainRemoteOllamaUrl).toBe('http://192.168.1.8:11434');
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
