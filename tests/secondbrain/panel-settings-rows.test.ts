/**
 * 第二大脑设置弹窗「服务」组残留盘点（ticket 122 起；issue 424/ADR-0184 收口，jsdom）：
 * 连接面四行——「本机局域网 IP」「局域网 IP 提示」「Ollama 本地 URL」「移动端远程地址」——
 * 全部退场：IP 探测与远程地址写入改全自动（桌面端启动跟随本机 IP，secondbrain/local-ip），
 * 本地 URL 唯一入口 = AI 面板 Embedding 组。本页打开设置不该触发任何 os 探测。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openSecondBrainSettings, secondBrainSettingsSchema } from '../../src/secondbrain/panel';
import { RERANK_MAX_DOCS } from '../../src/secondbrain/rerank';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import type { NumberRow } from '../../src/core/settings-schema';
import { resetObsidianMocks, clearNotices, Platform } from '../mock-obsidian-entry';

let settings: any;
let saveSpy: any;

function stubOsNetwork(interfaces: Record<string, Array<{ address: string; internal?: boolean }>>) {
  (window as any).require = (m: string) =>
    m === 'os' ? { networkInterfaces: () => interfaces } : undefined;
}

async function rowNames(): Promise<string[]> {
  openSecondBrainSettings();
  await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());
  return [...document.querySelectorAll('#bz-settings-modal-popup .setting-item')].map(
    (s) => (s as HTMLElement).dataset.name!
  );
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

describe('第二大脑设置「服务」组：连接面四行退场（issue 424/ADR-0184）', () => {
  it('桌面端：四行一律不在本页（截图三/四要求删，IP 与远程地址全自动）', async () => {
    stubOsNetwork({ WLAN: [{ address: '192.168.1.45', internal: false }] });
    const names = await rowNames();
    expect(names).not.toContain('本机局域网 IP');
    expect(names).not.toContain('局域网 IP 提示');
    expect(names).not.toContain('Ollama 本地 URL');
    expect(names).not.toContain('移动端远程地址');
    // 服务组只剩「额外检索目录」——本页不再有连接面的人工入口
    expect(names).toContain('额外检索目录');
  });

  it('打开设置弹窗不触发 os 探测（探测只在 onload 的自动跟随里跑）', async () => {
    const reqSpy = vi.fn();
    (window as any).require = reqSpy;
    await rowNames();
    expect(reqSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('移动端：同样无 IP 引导行（指引文案随行删除；远程地址由桌面端同步过来）', async () => {
    Platform.isMobile = true;
    const names = await rowNames();
    expect(names).not.toContain('局域网 IP 提示');
    expect(names).not.toContain('本机局域网 IP');
  });
});

/**
 * TopK 上限与重排条数上限的不变式（issue 429 review 收口）：
 * 参考面板的百分比取自 `hit.rerankScore ?? hit.score`——若 TopK 能超过 RERANK_MAX_DOCS，
 * 列表就会整体跳过重排（applyRerank 的「要么整体重排、要么整体不重排」），
 * 用户调大的 TopK 反而让重排静默失效。两处数字分居两个域，靠本测试钉住「TopK 上限 ≤ 重排上限」。
 * （按行名认行：这两个 number 行用 numStrBinding，绑定上不带 key 字段。）
 */
describe('TopK 上限 ≤ 重排条数上限（issue 429）', () => {
  it('「参考结果数 TopK」「对话参考结果数」的 max 都不超过 RERANK_MAX_DOCS', () => {
    const rows = secondBrainSettingsSchema().groups.flatMap((g) => g.rows);
    const numbers = rows.filter((r) => r.type === 'number') as NumberRow[];
    const topKs = numbers.filter((r) => ['参考结果数 TopK', '对话参考结果数'].includes(r.name));
    expect(topKs).toHaveLength(2); // 两行改名/下线即本不变式失效，先在此炸掉
    for (const row of topKs) {
      // max 缺失 = 本不变式失去意义（`?? 0` 会让断言变成恒真），先炸掉而不是放行
      expect(row.max, `${row.name} 缺 max`).toBeTypeOf('number');
      expect(RERANK_MAX_DOCS).toBeGreaterThanOrEqual(row.max as number);
    }
  });
});
