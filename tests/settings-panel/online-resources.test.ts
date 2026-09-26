// @vitest-environment jsdom
/**
 * 「在线资源」组（ADR-0203 / issue 480，UI 层）测试。
 *
 * 钉住五件事：
 *  1. 组形状：name「在线资源」+ 单 custom 行自绘（整组内容不走声明行体系）；
 *  2. 三行状态机：未下载 → 下载（皮肤带套数）、有更新 → 更新 N、已最新 → 已下载 禁用；
 *  3. 无缓存清单 → 三行禁用 + 失败横条 + 检查/重试；核对失败但有缓存 → 缓存状态照常 + 细字提示；
 *  4. 动作：下载完成后磁盘事实变了，按钮就地翻转成「已下载」（可感知性原则，不发成功通知）；
 *  5. 后台核对（打开组顺手一次）失败不炸渲染。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { onlineResourcesGroup, resetOnlineResourcesState } from '../../src/settings-panel/online-resources';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';
import { textSha256 } from '../../src/core/sha256';

const MANIFEST_CACHE_PATH = '.obsidian/plugins/bz/downloads/manifest.json';
const PLUGIN_MANIFEST_PATH = '.obsidian/plugins/bz/manifest.json';
const REMOTE_MANIFEST = 'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/manifest.json';
const BACKUP_MANIFEST = 'https://cdn.jsdelivr.net/gh/yeshimei/bz@master/downloads/manifest.json';
const REMOTE_CSS = 'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/skins/bookshelf/noir.css';
const BACKUP_CSS = 'https://cdn.jsdelivr.net/gh/yeshimei/bz@master/downloads/skins/bookshelf/noir.css';

const HTML_V1 = '<!DOCTYPE html><html><body>日志 v1</body></html>';
const HTML_V2 = '<!DOCTYPE html><html><body>日志 v2</body></html>';
const CSS_NOIR = '/* noir */\n.bz-bs-skin-noir { --bz-brand: #d9b45f; }\n';

const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));

function manifestJson(docs: unknown[], skins: unknown[]): string {
  return JSON.stringify({ version: 1, docs, skins });
}

const docEntry = (id: string, text: string) => ({ id, name: id === 'manual' ? '使用手册' : '更新日志', file: id === 'manual' ? 'bz-manual.html' : 'bz-changelog.html', sha256: textSha256(text) });
const skinEntry = (id: string, text: string) => ({ id, domain: 'bookshelf', name: '黑金夜曲', file: `skins/bookshelf/${id}.css`, sha256: textSha256(text) });

/** requestUrl 按 URL 分发的桩（未命中的 URL 抛错，暴露漏配） */
function routeFetch(map: Record<string, string | Error>): void {
  vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
    const hit = map[req.url];
    if (hit === undefined) throw new Error('unmocked url: ' + req.url);
    if (hit instanceof Error) throw hit;
    return { status: 200, text: hit } as any;
  }) as any);
}

/** 渲染一组并等状态算齐（含打开组触发的后台核对） */
async function renderGroup(vault: MockVault): Promise<HTMLElement> {
  const group = onlineResourcesGroup();
  const body = document.createElement('div');
  document.body.appendChild(body);
  (group.rows[0] as any).render(body, { rowEl: body, refreshVisibility: () => {} });
  await tick(40);
  return body;
}

const rowBtn = (body: HTMLElement, i: number) => body.querySelectorAll<HTMLElement>('.bz-sp-res-row .bz-sp-res-btn')[i] as HTMLButtonElement;
const rowName = (body: HTMLElement, i: number) => body.querySelectorAll<HTMLElement>('.bz-sp-res-row .bz-sp-res-name')[i]?.textContent ?? '';

beforeEach(() => {
  resetObsidianMocks();
  clearNotices();
  document.body.innerHTML = '';
  resetOnlineResourcesState();
  setSettingsProvider(() => ({}) as any);
  vi.mocked(requestUrl).mockReset();
});

/** 建一个挂好 app 的 vault（每用例自配版本与缓存清单） */
function newVault(version = '1.0.0'): MockVault {
  const vault = new MockVault();
  vault.files.set(PLUGIN_MANIFEST_PATH, JSON.stringify({ id: 'bz', version }));
  setApp({ vault, workspace: {} } as any);
  return vault;
}

describe('组形状', () => {
  it('name「在线资源」+ 单 custom 行', () => {
    const g = onlineResourcesGroup();
    expect(g.name).toBe('在线资源');
    expect(g.icon).toBe('cloud-download');
    expect(g.rows).toHaveLength(1);
    expect(g.rows[0].type).toBe('custom');
  });
});

describe('三行状态机（有缓存清单）', () => {
  it('已最新 → 已下载禁用；有更新 → 更新；未下载 → 下载', async () => {
    const vault = newVault();
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([docEntry('changelog', HTML_V1), docEntry('manual', HTML_V1)], []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML_V1); // ready
    vault.files.set('.obsidian/plugins/bz/downloads/bz-manual.html', '<!DOCTYPE html><html>旧版</html>'); // updated
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([docEntry('changelog', HTML_V1), docEntry('manual', HTML_V1)], []) });

    const body = await renderGroup(vault);
    expect([0, 1, 2].map((i) => rowName(body, i))).toEqual(['更新日志', '使用手册', '主题']);
    expect(rowBtn(body, 0).disabled).toBe(true);
    expect(rowBtn(body, 0).textContent).toBe('已下载');
    expect(rowBtn(body, 1).disabled).toBe(false);
    expect(rowBtn(body, 1).textContent).toBe('更新');
  });

  it('主题：有缺失有更新 → 「更新 N」（更新优先，差额在描述里）；全缺 → 「下载 N」；全就绪 → 已下载禁用', async () => {
    const vault = newVault();
    const noir = skinEntry('noir', CSS_NOIR);
    const ghost = skinEntry('ghost', '/* ghost */');
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([], [noir, ghost]));
    vault.files.set('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css', '/* 被改过 */'); // updated
    // ghost 未下载 → missing；noir 已就绪的对照用例见下
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([], [noir, ghost]) });

    const body = await renderGroup(vault);
    expect(rowBtn(body, 2).textContent).toBe('更新 1');
    expect(rowBtn(body, 2).disabled).toBe(false);
    expect(body.querySelectorAll('.bz-sp-res-row')[2].textContent).toContain('另有 1 套未下载');
  });

  it('主题全部就绪 → 「已下载」禁用，描述「全部皮肤已是最新」', async () => {
    const vault = newVault();
    const noir = skinEntry('noir', CSS_NOIR);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([], [noir]));
    vault.files.set('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([], [noir]) });

    const body = await renderGroup(vault);
    expect(rowBtn(body, 2).textContent).toBe('已下载');
    expect(rowBtn(body, 2).disabled).toBe(true);
  });
});

describe('失败态（半自动铁则的 UI 面）', () => {
  it('无缓存清单且核对失败 → 三行禁用 + 横条「检查更新失败」+ 重试', async () => {
    const vault = newVault();
    routeFetch({ [REMOTE_MANIFEST]: new Error('ENOTFOUND'), [BACKUP_MANIFEST]: new Error('ETIMEDOUT') });

    const body = await renderGroup(vault);
    expect(body.querySelector('.bz-sp-res-fail')).toBeTruthy();
    // 打开组触发的隐式核对失败后，横条从「尚未检查更新」翻转为失败态
    expect(body.querySelector('.bz-sp-res-fail-text')?.textContent).toContain('检查更新失败');
    expect(body.querySelector('.bz-sp-res-fail-retry')?.textContent).toBe('重试');
    for (let i = 0; i < 3; i++) expect(rowBtn(body, i).disabled).toBe(true);
  });

  it('有缓存但核对失败 → 缓存状态照常渲染 + 细字「检查更新失败」+ 重试', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V1);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML_V1);
    routeFetch({ [REMOTE_MANIFEST]: new Error('ENOTFOUND'), [BACKUP_MANIFEST]: new Error('ETIMEDOUT') });

    const body = await renderGroup(vault);
    expect(body.querySelector('.bz-sp-res-stale')).toBeTruthy();
    expect(body.querySelector('.bz-sp-res-stale')?.textContent).toContain('检查更新失败');
    expect(rowBtn(body, 0).textContent).toBe('已下载'); // 缓存状态照常可用
    expect(rowBtn(body, 0).disabled).toBe(true);
  });

  it('横条上的「检查更新」拉到清单后 → 横条消失，按钮解禁翻转', async () => {
    const vault = newVault();
    // 首次核对失败（无缓存），重试时拉到
    let calls = 0;
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      if (req.url === REMOTE_MANIFEST && calls++ === 0) throw new Error('ENOTFOUND');
      if (req.url === BACKUP_MANIFEST) throw new Error('ETIMEDOUT');
      if (req.url === REMOTE_MANIFEST) return { status: 200, text: manifestJson([docEntry('changelog', HTML_V1)], []) } as any;
      throw new Error('unmocked url: ' + req.url);
    }) as any);

    const body = await renderGroup(vault);
    expect(body.querySelector('.bz-sp-res-fail')).toBeTruthy();

    (body.querySelector('.bz-sp-res-fail-retry') as HTMLButtonElement).click();
    await tick(40);
    expect(body.querySelector('.bz-sp-res-fail')).toBeNull();
    expect(rowBtn(body, 0).textContent).toBe('下载');
    expect(rowBtn(body, 0).disabled).toBe(false);
  });
});

describe('动作（下载只听用户点）', () => {
  it('点「下载」→ 落盘 → 全量重绘按钮翻「已下载」；不发成功通知', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    routeFetch({
      [REMOTE_MANIFEST]: manifestJson([entry], []),
      'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/bz-changelog.html': HTML_V2,
    });

    const body = await renderGroup(vault);
    expect(rowBtn(body, 0).textContent).toBe('下载'); // missing

    rowBtn(body, 0).click();
    await tick(60);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/bz-changelog.html')).toBe(HTML_V2);
    expect(rowBtn(body, 0).textContent).toBe('已下载');
    expect(rowBtn(body, 0).disabled).toBe(true);
    expect(getNoticeMessages().some((m) => (m as string).includes('已下载'))).toBe(false);
  });

  it('归物分类表（issue 478）：作为 doc 条目走同一状态机——下载落盘、描述带组条数', async () => {
    const vault = newVault();
    const tableText =
      JSON.stringify(
        {
          version: '0.1.0',
          groups: [
            { id: 'g001', name: '数码影音', icon: 'smartphone', items: [{ id: 'c0001', name: '智能手机', icon: 'smartphone', aliases: ['手机'] }] },
          ],
        },
        null,
        2,
      ) + '\n';
    const entry = { id: 'belongings-categories', name: '归物分类表', file: 'belongings-categories.json', sha256: textSha256(tableText) };
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    routeFetch({
      [REMOTE_MANIFEST]: manifestJson([entry], []),
      'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/belongings-categories.json': tableText,
    });

    const body = await renderGroup(vault);
    expect(rowName(body, 3)).toBe('归物分类表'); // 排在主题之后
    expect(rowBtn(body, 3).textContent).toBe('下载');

    rowBtn(body, 3).click();
    await tick(60);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/belongings-categories.json')).toBe(tableText);
    expect(rowBtn(body, 3).textContent).toBe('已下载');
    expect(rowBtn(body, 3).disabled).toBe(true);
    // 就绪描述带表规模（loadCategoryTable 实测，不硬编码）
    expect(body.querySelectorAll('.bz-sp-res-row')[3].textContent).toContain('1 组 1 条');
  });

  it('主题行点「更新 N」→ 只拉非就绪套数并注入；失败套数出 error 通知', async () => {
    const vault = newVault();
    const noir = skinEntry('noir', CSS_NOIR);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([], [noir]));
    vault.files.set('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css', '/* 被改过 */');
    // 双源都给坏内容 → failed=1 → error 通知
    routeFetch({
      [REMOTE_MANIFEST]: manifestJson([], [noir]),
      [REMOTE_CSS]: '.bz-bs-skin-noir{color:red}',
      [BACKUP_CSS]: '.bz-bs-skin-noir{color:red}',
    });

    const body = await renderGroup(vault);
    expect(rowBtn(body, 2).textContent).toBe('更新 1');
    rowBtn(body, 2).click();
    await tick(60);
    expect(getNoticeMessages().some((m) => (m as string).includes('1 套主题下载失败'))).toBe(true);
    // 内容仍是坏的 → 依旧不算就绪，按钮回到「更新 1」等下次
    expect(rowBtn(body, 2).textContent).toBe('更新 1');
  });
});
