/**
 * 本机局域网 IP 枚举（ticket 122）：桌面端探测本机 IP，写入「移动端远程地址」（手机自身
 * 探测不到电脑 IP，只能读同步来的设置值）。
 *
 * 运行时取数走 window.require('os')（Obsidian 桌面端 renderer 可用——obsidian42-brat / pdf-plus
 * 既有先例；esbuild 侧已将 "os" external 化，勿 bundle）。测试注入 interfaces 对象走 enumerateLanIPs。
 *
 * issue 423/ADR-0183：新增 detect/ensure——桌面端启动自动补全「移动端远程地址」。
 * issue 424/ADR-0184：改为**自动跟随本机 IP**（DHCP 漂移自愈，两处人工入口——第二大脑
 * 「本机局域网 IP」行与 AI 面板「移动端远程地址」行——随之全部删除）。
 */
import { tryGetSettings, saveSettings } from '../core/settings-provider';

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

/** 本机远程 Ollama 地址（主网卡 IP + 默认 11434 端口）；探测不到返回 null。
 *  入参可注入网卡列表（纯函数口径，测试直接喂数据）。 */
export function detectRemoteOllamaUrl(lanIPs: LanIp[] = getLanIPs()): string | null {
  const primary = pickPrimaryLanIp(lanIPs);
  return primary ? formatRemoteOllamaUrl(primary.ip) : null;
}

/** 插件自己写出的远程地址形态（默认端口 + IPv4 字面量）——存量值归属判定的依据，见下 */
const PLUGIN_WRITTEN_URL = /^http:\/\/\d{1,3}(?:\.\d{1,3}){3}:11434$/;

/**
 * 桌面端启动自动跟随本机 IP（issue 423/ADR-0183 补空值 → issue 424/ADR-0184 跟随）：
 * 「移动端远程地址」写入探测值，本机 IP 变了就跟着刷新（DHCP 漂移自愈，用户不必再管）。
 *
 * 归属判定——只有**插件管的**值才刷新：
 * - 当前值为空 → 归插件管（首次自动填）；
 * - 当前值 = `secondBrainRemoteOllamaAuto`（上次自动写下的值）→ 归插件管，IP 变了即跟随；
 * - 存量升级场景（自动值记录为空）：当前值形如 `http://<ip>:11434`（即插件口径——原
 *   「填入远程 URL」按钮与旧默认值都产出这一形态）→ 认领为插件管，随后跟随；
 * - 其余（指向他机的自定地址，如 `http://192.168.1.99:8080`）→ 人填值，一律不动。
 *
 * 手机端 getLanIPs 恒空 → 探测不到即不写（只读桌面同步过去的设置值）。
 * 返回是否发生写入（写内存 + saveSettings 落盘）。
 */
export function ensureRemoteOllamaUrl(lanIPs: LanIp[] = getLanIPs()): boolean {
  const url = detectRemoteOllamaUrl(lanIPs);
  if (!url) return false;
  const s = tryGetSettings() as Record<string, unknown>;
  const current = String(s.secondBrainRemoteOllamaUrl ?? '').trim();
  const auto = String(s.secondBrainRemoteOllamaAuto ?? '').trim();
  const managed = !current || current === auto || (!auto && PLUGIN_WRITTEN_URL.test(current));
  if (!managed || current === url) return false;
  s.secondBrainRemoteOllamaUrl = url;
  s.secondBrainRemoteOllamaAuto = url;
  void saveSettings();
  console.log(`[secondbrain] 移动端远程地址已跟随本机 IP：${current || '（空）'} → ${url}`);
  return true;
}