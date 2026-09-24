// @vitest-environment node
/**
 * 本机局域网 IP 枚举（ticket 122）纯函数测试：
 * 过滤 loopback / link-local / IPv6 / internal；URL 组装。
 * issue 423/ADR-0183 增：detect/ensure（桌面端启动自动补全「移动端远程地址」——只补空值，
 * 手改值不覆盖；手机端探测不到即不写）。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  enumerateLanIPs,
  formatRemoteOllamaUrl,
  pickPrimaryLanIp,
  detectRemoteOllamaUrl,
  ensureRemoteOllamaUrl,
} from '../../src/secondbrain/local-ip';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';

describe('enumerateLanIPs', () => {
  const interfaces: Record<string, Array<{ address: string; internal?: boolean }>> = {
    WLAN: [
      { address: '192.168.1.45', internal: false },
      { address: 'fe80::1%12', internal: false }, // IPv6 不参与
    ],
    'Loopback Pseudo-Interface 1': [{ address: '127.0.0.1', internal: true }],
    vEthernet: [{ address: '169.254.10.2', internal: false }], // link-local 过滤
    eth0: [{ address: '10.0.0.8', internal: false }],
  };

  it('过滤 internal/loopback/link-local/IPv6，保留可用局域网 IPv4', () => {
    const list = enumerateLanIPs(interfaces);
    expect(list).toEqual([
      { iface: 'WLAN', ip: '192.168.1.45' },
      { iface: 'eth0', ip: '10.0.0.8' },
    ]);
  });

  it('无接口/空输入返回空数组', () => {
    expect(enumerateLanIPs(undefined)).toEqual([]);
    expect(enumerateLanIPs({})).toEqual([]);
  });

  it('仅内部地址时返回空', () => {
    expect(enumerateLanIPs({ lo: [{ address: '127.0.0.1', internal: true }] })).toEqual([]);
  });
});

describe('formatRemoteOllamaUrl', () => {
  it('默认 Ollama 端口 11434', () => {
    expect(formatRemoteOllamaUrl('192.168.1.45')).toBe('http://192.168.1.45:11434');
  });
});

describe('pickPrimaryLanIp', () => {
  const lanList = [
    { iface: 'vEthernet (VMware Network Adapter VMnet8)', ip: '192.168.137.1' },
    { iface: 'WLAN', ip: '192.168.1.45' },
    { iface: 'vEthernet (Default Switch)', ip: '172.20.0.1' },
  ];

  it('虚拟网卡排前时优先选「WLAN」物理网卡（vEthernet 不误命中 ethernet）', () => {
    expect(pickPrimaryLanIp(lanList)).toEqual({ iface: 'WLAN', ip: '192.168.1.45' });
  });

  it('没有关键词命中时取列表第一个', () => {
    expect(pickPrimaryLanIp([{ iface: 'eth0', ip: '10.0.0.8' }])).toEqual({ iface: 'eth0', ip: '10.0.0.8' });
  });

  it('空列表返回 null', () => {
    expect(pickPrimaryLanIp([])).toBeNull();
  });
});

describe('detectRemoteOllamaUrl（issue 423）', () => {
  it('物理网卡优先并组装默认端口 URL；空列表返回 null', () => {
    expect(
      detectRemoteOllamaUrl([
        { iface: 'vEthernet (Default Switch)', ip: '172.20.0.1' },
        { iface: 'WLAN', ip: '192.168.1.45' },
      ])
    ).toBe('http://192.168.1.45:11434');
    expect(detectRemoteOllamaUrl([])).toBeNull();
  });
});

describe('ensureRemoteOllamaUrl（issue 423：桌面端启动自动补全，只补空值）', () => {
  let settings: Record<string, unknown>;
  let saveSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    settings = {};
    setSettingsProvider(() => settings as never);
    saveSpy = vi.fn(async () => {});
    setSettingsSaver(saveSpy as unknown as () => Promise<void>);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('设置为空 → 写入探测值并落盘（手机端读同步值）', () => {
    expect(ensureRemoteOllamaUrl([{ iface: 'WLAN', ip: '192.168.1.45' }])).toBe(true);
    expect(settings.secondBrainRemoteOllamaUrl).toBe('http://192.168.1.45:11434');
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('已有值（含手改的点对点地址）→ 一律不覆盖、不落盘', () => {
    settings.secondBrainRemoteOllamaUrl = 'http://10.0.0.9:11434';
    expect(ensureRemoteOllamaUrl([{ iface: 'WLAN', ip: '192.168.1.45' }])).toBe(false);
    expect(settings.secondBrainRemoteOllamaUrl).toBe('http://10.0.0.9:11434');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('探测不到网卡（手机端 / 未联网）→ 不写', () => {
    expect(ensureRemoteOllamaUrl([])).toBe(false);
    expect(settings.secondBrainRemoteOllamaUrl).toBeUndefined();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('空白值等同未设置（trim 后为空 → 补全）', () => {
    settings.secondBrainRemoteOllamaUrl = '   ';
    expect(ensureRemoteOllamaUrl([{ iface: 'eth0', ip: '10.0.0.8' }])).toBe(true);
    expect(settings.secondBrainRemoteOllamaUrl).toBe('http://10.0.0.8:11434');
  });
});