/**
 * 第二大脑设置弹窗「本机局域网 IP」提示 + 一键填入（ticket 122，jsdom）：
 * 桌面端探测 IP 展示 + 确认后覆盖远程 URL；移动端不探测只给引导；无 IP 时不覆盖。
 * MockSetting 的 desc 存实例字段（__setting.desc），按钮在 __setting.controls（trigger() 模拟点击）。
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

function ipSetting(): any {
  const el = [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].find(
    (s) => (s as HTMLElement).dataset.name?.includes('本机局域网 IP')
  );
  expect(el).toBeTruthy();
  return (el as any).__setting;
}

function settingButton(setting: any, text: string): any {
  const btn = setting.controls.find((c: any) => c.text === text);
  expect(btn).toBeTruthy();
  return btn;
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

describe('第二大脑设置：本机局域网 IP（ticket 122）', () => {
  it('桌面端展示本机 IP，填入需确认后覆盖远程 URL', async () => {
    stubOsNetwork({
      WLAN: [{ address: '192.168.1.45', internal: false }],
      'Loopback Pseudo-Interface 1': [{ address: '127.0.0.1', internal: true }],
      vEthernet: [{ address: '169.254.10.2', internal: false }],
    });
    openSecondBrainSettings();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());

    const setting = ipSetting();
    // 只展示可用 IPv4（过滤回环/link-local）
    expect(setting.desc).toContain('192.168.1.45（WLAN）');
    expect(setting.desc).not.toContain('169.254');

    settingButton(setting, '填入远程 URL').trigger();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_popup__')).toBeTruthy());
    expect(document.getElementById('__shared_confirm_popup__')!.textContent).toContain('http://192.168.1.45:11434');
    (document.getElementById('__shared_confirm_ok__') as HTMLElement).click();

    expect(settings.secondBrainRemoteOllamaUrl).toBe('http://192.168.1.45:11434');
    expect(saveSpy).toHaveBeenCalled();

    // 输入框即时回显新值（confirm 覆盖后）
    const urlSettingEl = [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].find(
      (s) => (s as HTMLElement).dataset.name === '远程 Ollama URL（移动端）'
    );
    const urlTextCtrl = (urlSettingEl as any).__setting.controls.find((c: any) => typeof c?.setValue === 'function');
    expect(urlTextCtrl.value).toBe('http://192.168.1.45:11434');
  });

  it('移动端不探测 IP，仅显示引导文案', async () => {
    Platform.isMobile = true;
    const reqSpy = vi.fn();
    (window as any).require = reqSpy;
    openSecondBrainSettings();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());

    const setting = ipSetting();
    expect(setting.name).toContain('提示');
    expect(setting.desc).toContain('电脑上打开第二大脑设置');
    expect(setting.controls.some((c: any) => c.text === '填入远程 URL')).toBe(false);
    expect(reqSpy).not.toHaveBeenCalled();
  });

  it('未探测到 IP 时点按钮不覆盖，给出提示', async () => {
    stubOsNetwork({});
    openSecondBrainSettings();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());

    const setting = ipSetting();
    expect(setting.desc).toContain('未能探测本机局域网 IP');
    settingButton(setting, '填入远程 URL').trigger();
    expect(hasNotice('未探测到本机局域网 IP，请手动填写')).toBe(true);
    expect(settings.secondBrainRemoteOllamaUrl).toBe('http://192.168.1.8:11434');
    expect(saveSpy).not.toHaveBeenCalled();
  });
});