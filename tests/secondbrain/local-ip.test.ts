// @vitest-environment node
/**
 * 本机局域网 IP 枚举（ticket 122）纯函数测试：
 * 过滤 loopback / link-local / IPv6 / internal；URL 组装。
 */
import { describe, expect, it } from 'vitest';
import { enumerateLanIPs, formatRemoteOllamaUrl, pickPrimaryLanIp } from '../../src/secondbrain/local-ip';

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