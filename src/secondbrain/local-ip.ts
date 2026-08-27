/**
 * 本机局域网 IP 枚举（ticket 122）：桌面端展示「远程 Ollama URL（移动端）」应填的电脑 IP，
 * 帮助移动端连不上时的自查自修（根因常是 DHCP 漂移导致旧 IP 失效）。
 *
 * 运行时取数走 window.require('os')（Obsidian 桌面端 renderer 可用——obsidian42-brat / pdf-plus
 * 既有先例；esbuild 侧已将 "os" external 化，勿 bundle）。测试注入 interfaces 对象走 enumerateLanIPs。
 */

export interface LanIp {
  iface: string;
  ip: string;
}

/** IPv4 局域网判定：去除 loopback / link-local / 非 IPv4（IPv6 不在移动端连接考量内） */
function isUsableLanIp(ip: string): boolean {
  if (!ip) return false;
  if (ip.includes(':')) return false; // 仅 IPv4
  if (ip.startsWith('127.') || ip.startsWith('169.254.')) return false;
  return true;
}

/** 从 os.networkInterfaces() 输出中枚举可用局域网 IPv4（纯函数，可测） */
export function enumerateLanIPs(
  interfaces?: Record<string, Array<{ address: string; internal?: boolean }>>
): LanIp[] {
  const list: LanIp[] = [];
  if (!interfaces) return list;
  for (const [iface, addrs] of Object.entries(interfaces)) {
    for (const a of addrs || []) {
      if (a.internal) continue;
      if (isUsableLanIp(a.address)) list.push({ iface, ip: a.address });
    }
  }
  return list;
}

/** 运行时取本机网卡（桌面端 Obsidian）；非桌面端 / require 不可用返回空数组 */
export function getLanIPs(): LanIp[] {
  try {
    const os = (window as any).require && (window as any).require('os');
    if (!os || typeof os.networkInterfaces !== 'function') return [];
    return enumerateLanIPs(os.networkInterfaces());
  } catch {
    return [];
  }
}

/** 组装远程 Ollama URL（默认 Ollama 端口 11434） */
export function formatRemoteOllamaUrl(ip: string, port = 11434): string {
  return `http://${ip}:${port}`;
}

/** 网卡名优先关键词（真实物理网卡常见命名；虚拟网卡 VMware/Docker/WSL 不在列） */
const PREFERRED_IFACE_KEYWORDS = ['wlan', 'wi-fi', 'wifi', 'wireless', 'ethernet', '以太网', '有线'];

/** 关键词命中：ASCII 关键词按词边界（防 vEthernet 误命中 ethernet）；含中文用包含即可 */
function ifaceMatches(iface: string, keyword: string): boolean {
  if (keyword !== keyword.toLowerCase()) return iface.toLowerCase().includes(keyword.toLowerCase());
  return new RegExp(`\\b${keyword}\\b`, 'i').test(iface);
}

/**
 * 从枚举结果中挑选最可能可达的物理网卡 IP：
 * 优先 iface 名含常见物理网卡关键词（WLAN/Wi-Fi/Ethernet/以太网）者，否则取列表第一个。
 */
export function pickPrimaryLanIp(list: LanIp[]): LanIp | null {
  if (!list.length) return null;
  const hit = list.find((l) => PREFERRED_IFACE_KEYWORDS.some((k) => ifaceMatches(l.iface, k)));
  return hit || list[0];
}