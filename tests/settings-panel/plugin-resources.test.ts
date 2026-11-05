// @vitest-environment jsdom
/**
 * 「插件」组（settings-panel/plugin-resources.ts）——2026-11-05 用户要求：
 * - 组在「外部工具」上面：组首「全部更新」+ bz reader 一行；
 * - 行右侧 GitHub（带图标，跳仓库）+ 安装/更新；
 * - **已装就只剩 GitHub，不摆一枚灰的「已安装」**；只有确认有新版才露「更新」；
 * - 行里显示版本号，后台查到最新版后补成「已安装 x · 新版 y」；
 * - 关掉自动更新只是不自动装，版本号照旧显示（点「更新」才装）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import {
  PLUGIN_ENTRIES,
  PLUGIN_GROUP_NAME,
  pluginDescOf,
  pluginResourcesGroup,
  resetPluginResourcesState,
} from '../../src/settings-panel/plugin-resources';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

const PLUGIN_DIR = '.obsidian/plugins/bz-reader';
const MANIFEST = JSON.stringify({
  id: 'bz-reader',
  name: 'bz Reader',
  version: '0.2.0',
  minAppVersion: '1.8.7',
});
const MAIN_JS = 'console.log("bz reader");\n' + 'x'.repeat(2000);
const STYLES = '.bz-reader{color:red}\n' + 'x'.repeat(200);

const ok = (text: string) => ({ status: 200, text });
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

function newVault(): MockVault {
  const vault = new MockVault();
  setApp({ vault, workspace: {} } as any);
  return vault;
}

/** 按 URL 包含匹配；未命中的抛错，暴露漏配 */
function route(rules: Array<[string, string | Error]>): void {
  vi.mocked(requestUrl).mockImplementation((async (opts: { url: string }) => {
    for (const [needle, value] of rules) {
      if (!opts.url.includes(needle)) continue;
      if (value instanceof Error) throw value;
      return ok(value);
    }
    throw new Error(`unmocked url: ${opts.url}`);
  }) as never);
}

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  resetPluginResourcesState();
  setSettingsProvider(() => ({ autoUpdate: false }) as any);
  vi.mocked(requestUrl).mockReset();
});
afterEach(() => {
  document.body.innerHTML = '';
});

async function renderGroup(): Promise<{ el: HTMLElement; group: Awaited<ReturnType<typeof pluginResourcesGroup>> }> {
  const group = await pluginResourcesGroup();
  const el = document.createElement('div');
  document.body.appendChild(el);
  renderPanelSchema(el, { groups: [group] });
  await tick();
  return { el, group };
}

const rows = (el: HTMLElement) => el.querySelectorAll<HTMLElement>('.bz-sp-group-body > .bz-sp-set-row');
const rowName = (el: HTMLElement, i: number) =>
  rows(el)[i]?.querySelector('.bz-sp-set-name')?.textContent ?? '';
const rowDesc = (el: HTMLElement, i: number) =>
  rows(el)[i]?.querySelector('.bz-sp-set-desc')?.textContent ?? '';
const rowBtns = (el: HTMLElement, i: number): HTMLButtonElement[] =>
  Array.from(rows(el)[i]?.querySelectorAll<HTMLButtonElement>('.bz-sp-btn') ?? []);
/** 露在行里的按钮（被状态收起的按钮仍在 DOM 里，只是 display:none） */
const shownBtns = (el: HTMLElement, i: number): HTMLButtonElement[] =>
  rowBtns(el, i).filter((b) => b.style.display !== 'none');

describe('组形状', () => {
  it('组名「插件」、图标 puzzle；组首「全部更新」，下面 bz reader 一行', async () => {
    newVault();
    route([['/releases/latest/download/manifest.json', MANIFEST]]);
    const { el, group } = await renderGroup();
    expect(group.name).toBe(PLUGIN_GROUP_NAME);
    expect(group.icon).toBe('puzzle');
    expect(group.rows).toHaveLength(2);
    expect(group.rows[0].type).toBe('button');
    expect((group.rows[0] as { name: string }).name).toBe('全部更新');
    expect(group.rows[1].type).toBe('info');
    expect(rowName(el, 1)).toBe('bz reader');
  });

  it('未安装 → 行右侧两个按钮：GitHub（带图标）+ 安装', async () => {
    newVault();
    route([['/releases/latest/download/manifest.json', MANIFEST]]);
    const { el } = await renderGroup();
    const btns = rowBtns(el, 1);
    expect(btns).toHaveLength(2);
    expect(btns[0].textContent).toBe('GitHub');
    // 图标取「关于」组那只 GitHub（feather 描边标记）：字前面立一枚，认得出来是仓库入口
    const svg = btns[0].querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('path')?.getAttribute('d')).toMatch(/^M9 19c-5 1\.5/);
    expect(btns[1].textContent).toBe('安装');
    expect(shownBtns(el, 1).map((b) => b.textContent)).toEqual(['GitHub', '安装']);
  });
});

describe('版本号与按钮文字', () => {
  it('未安装 → 「未安装」/「安装」', async () => {
    newVault();
    route([['/releases/latest/download/manifest.json', MANIFEST]]);
    const { el } = await renderGroup();
    expect(rowDesc(el, 1)).toBe('未安装');
    expect(shownBtns(el, 1).map((b) => b.textContent)).toEqual(['GitHub', '安装']);
  });

  it('已装且已是最新 → 只留 GitHub，安装钮不露（不摆灰钮）', async () => {
    const vault = newVault();
    vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-reader', version: '0.2.0' }));
    route([['/releases/latest/download/manifest.json', MANIFEST]]);
    const { el } = await renderGroup();
    // 打开面板那一刻就已经是「已装」——不等联网核对，安装钮就不该出现（否则先闪一下再收起）
    expect(shownBtns(el, 1).map((b) => b.textContent)).toEqual(['GitHub']);
    await vi.waitFor(() => expect(rowDesc(el, 1)).toBe('已安装 0.2.0'));
    expect(shownBtns(el, 1).map((b) => b.textContent)).toEqual(['GitHub']);
  });

  it('最新版查不到（网络坏）→ 同样只留 GitHub，不摆灰钮', async () => {
    const vault = newVault();
    vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-reader', version: '0.2.0' }));
    route([['github.com', new Error('ENOTFOUND')], ['gitee.com', new Error('ENOTFOUND')]]);
    const { el } = await renderGroup();
    await vi.waitFor(() => expect(rowDesc(el, 1)).toBe('已安装 0.2.0'));
    expect(shownBtns(el, 1).map((b) => b.textContent)).toEqual(['GitHub']);
  });

  it('已装 + 有新版 → 「更新」露出来（可点）', async () => {
    const vault = newVault();
    vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-reader', version: '0.2.0' }));
    const newer = JSON.stringify({ id: 'bz-reader', name: 'bz reader', version: '0.2.1' });
    route([['/releases/latest/download/manifest.json', newer]]);
    const { el } = await renderGroup();
    await vi.waitFor(() => expect(rowBtns(el, 1)[1].textContent).toBe('更新'));
    const shown = shownBtns(el, 1);
    expect(shown.map((b) => b.textContent)).toEqual(['GitHub', '更新']);
    expect(shown[1].disabled).toBe(false);
  });

  it('后台查到新版 → 补成「已安装 0.2.0 · 新版 0.2.1」', async () => {
    const vault = newVault();
    vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-reader', version: '0.2.0' }));
    const newer = JSON.stringify({ id: 'bz-reader', name: 'bz Reader', version: '0.2.1' });
    route([['/releases/latest/download/manifest.json', newer]]);
    const { el } = await renderGroup();
    await vi.waitFor(() => expect(rowDesc(el, 1)).toBe('已安装 0.2.0 · 新版 0.2.1'));
    // 有新版 → 「全部更新」可点
    expect(rowBtns(el, 0)[0].disabled).toBe(false);
  });

  it('已是最新 → 「全部更新」禁用（没有可做的）', async () => {
    const vault = newVault();
    vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-reader', version: '0.2.0' }));
    route([['/releases/latest/download/manifest.json', MANIFEST]]);
    const { el } = await renderGroup();
    await vi.waitFor(() => expect(rowBtns(el, 0)[0].disabled).toBe(true));
  });

  it('最新版查不到（网络坏）→ 只显示本机版本，不报错', async () => {
    const vault = newVault();
    vault.files.set(`${PLUGIN_DIR}/manifest.json`, JSON.stringify({ id: 'bz-reader', version: '0.2.0' }));
    route([['github.com', new Error('ENOTFOUND')], ['gitee.com', new Error('ENOTFOUND')]]);
    const { el } = await renderGroup();
    await vi.waitFor(() => expect(rowDesc(el, 1)).toBe('已安装 0.2.0'));
  });
});

describe('点「安装」真的装', () => {
  it('未安装 → 点安装：下载三件套、写盘、装完收起安装钮', async () => {
    const vault = newVault();
    route([
      ['/releases/latest/download/manifest.json', MANIFEST],
      ['/releases/download/0.2.0/main.js', MAIN_JS],
      ['/releases/download/0.2.0/styles.css', STYLES],
    ]);
    const { el } = await renderGroup();
    rowBtns(el, 1)[1].click();
    await vi.waitFor(() => expect(vault.files.get(`${PLUGIN_DIR}/main.js`)).toBe(MAIN_JS));
    await vi.waitFor(() => expect(rowDesc(el, 1)).toBe('已安装 0.2.0'));
    // 装完就没什么可点的了：行里只剩 GitHub
    await vi.waitFor(() => expect(shownBtns(el, 1).map((b) => b.textContent)).toEqual(['GitHub']));
    // 装完有一条通知（文案随是否首次安装/能否自动启用而不同，这里只钉「有反馈」）
    expect(getNoticeMessages().length).toBeGreaterThan(0);
  });
});

describe('pluginDescOf', () => {
  const base = {
    id: 'bz-reader',
    dir: PLUGIN_DIR,
    installed: true,
    version: '0.2.0',
    enabled: true,
    broken: false,
  };

  it('未安装 / 已安装 / 有新版 / 半装', () => {
    expect(pluginDescOf({ ...base, installed: false }, null)).toBe('未安装');
    expect(pluginDescOf(base, null)).toBe('已安装 0.2.0');
    expect(pluginDescOf(base, '0.2.1')).toBe('已安装 0.2.0 · 新版 0.2.1');
    expect(pluginDescOf(base, '0.2.0')).toBe('已安装 0.2.0');
    expect(pluginDescOf({ ...base, broken: true }, '0.2.1')).toBe('未安装');
  });

  it('插件目录里现在就一个 bz reader', () => {
    expect(PLUGIN_ENTRIES.map((e) => e.id)).toEqual(['bz-reader']);
  });
});
