// @vitest-environment jsdom
/**
 * 「在线资源」组（ADR-0203 / ADR-0205 / issue 480 / issue 492，UI 层）测试。
 *
 * 钉住六件事：
 *  1. 组形状：name「在线资源」+ 检查更新行（visibleWhen 门控）+ 四资源行，全部通用 button 声明行（issue 492 自绘退役）；
 *  2. 三行状态机：未下载 → 下载（皮肤带套数）、有更新 → 更新 N、已最新 → 已下载 禁用（皮肤行描述带已下载套数）；
 *  3. 无缓存清单 → 四行禁用 + 检查更新行（未检查/失败文案 + 重试）；核对失败但有缓存 → 缓存状态照常 + 检查更新行留档；
 *  4. 动作：下载完成后磁盘事实变了，按钮就地翻转成「已下载」（可感知性原则，不发成功通知）；
 *  5. 跨入口同步（issue 492）：下载事件（导航入口更新文档，经 writeAssetText 落盘）后已渲染行态跟着翻「已下载」；
 *  6. 后台核对（构建期顺手一次）失败不炸渲染。
 *
 * 渲染走真实渲染器（renderPanelSchema）——与面板同路径：rowHtml 骨架 + button 分支 + visibleWhen 门控。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { requestUrl } from 'obsidian';
import { resetObsidianMocks, clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { onlineResourcesGroup, resetOnlineResourcesState } from '../../src/settings-panel/online-resources';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import { writeAssetText } from '../../src/core/remote-asset';
import { setRowBtnState } from '../../src/core/settings-btn-state';
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

const docEntry = (id: string, text: string, name?: string) => ({
  id,
  name: name ?? (id === 'manual' ? '使用手册' : id === 'changelog' ? '更新日志' : id),
  file: id === 'manual' ? 'bz-manual.html' : id === 'changelog' ? 'bz-changelog.html' : 'belongings-categories.json',
  sha256: textSha256(text),
});
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

/** 经真实渲染器渲染一组并等构建期核对落地（行序：0 检查更新 + 1..4 更新日志/使用手册/主题/归物分类表） */
async function renderGroup(): Promise<HTMLElement> {
  const group = await onlineResourcesGroup();
  const el = document.createElement('div');
  document.body.appendChild(el);
  renderPanelSchema(el, { groups: [group] });
  await tick(40);
  return el;
}

const rowEl = (el: HTMLElement, i: number) => el.querySelectorAll<HTMLElement>('.bz-sp-group-body > .bz-sp-set-row')[i] as HTMLElement;
const rowName = (el: HTMLElement, i: number) => rowEl(el, i).querySelector('.bz-sp-set-name')?.textContent ?? '';
const rowDesc = (el: HTMLElement, i: number) => rowEl(el, i).querySelector('.bz-sp-set-desc')?.textContent ?? '';
const rowBtn = (el: HTMLElement, i: number) => rowEl(el, i).querySelector<HTMLButtonElement>('.bz-sp-btn') as HTMLButtonElement;
const rowVisible = (el: HTMLElement, i: number) => rowEl(el, i).style.display !== 'none';

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

describe('组形状（issue 492：通用声明行）', () => {
  it('检查更新 + 四资源行全部 button 行；有清单时检查更新行门控隐藏', async () => {
    const vault = newVault();
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([docEntry('changelog', HTML_V1)], []));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([docEntry('changelog', HTML_V1)], []) });

    const group = await onlineResourcesGroup();
    expect(group.name).toBe('在线资源');
    expect(group.icon).toBe('cloud-download');
    expect(group.rows).toHaveLength(5);
    expect(group.rows.every((r) => r.type === 'button')).toBe(true); // 无 custom 自绘行

    const el = document.createElement('div');
    document.body.appendChild(el);
    renderPanelSchema(el, { groups: [group] });
    await tick(40);
    expect(rowName(el, 0)).toBe('检查更新');
    expect([1, 2, 3, 4].map((i) => rowName(el, i))).toEqual(['更新日志', '使用手册', '主题', '归物分类表']);
    expect(rowVisible(el, 0)).toBe(false); // 有清单且未失败 → 门控隐藏（DOM 在位）
  });
});

describe('三行状态机（有缓存清单）', () => {
  it('已最新 → 已下载禁用；有更新 → 更新；未下载 → 下载', async () => {
    const vault = newVault();
    const catText = '{"version":"0.1.0","groups":[]}';
    vault.files.set(
      MANIFEST_CACHE_PATH,
      manifestJson([docEntry('changelog', HTML_V1), docEntry('manual', HTML_V1), docEntry('belongings-categories', catText, '归物分类表')], []),
    );
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML_V1); // ready
    vault.files.set('.obsidian/plugins/bz/downloads/bz-manual.html', '<!DOCTYPE html><html>旧版</html>'); // updated
    // belongings-categories 未下载 → missing
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([docEntry('changelog', HTML_V1), docEntry('manual', HTML_V1), docEntry('belongings-categories', catText, '归物分类表')], []) });

    const el = await renderGroup();
    expect(rowBtn(el, 1).disabled).toBe(true);
    expect(rowBtn(el, 1).textContent).toBe('已下载');
    expect(rowBtn(el, 2).disabled).toBe(false);
    expect(rowBtn(el, 2).textContent).toBe('更新');
    expect(rowBtn(el, 4).disabled).toBe(false);
    expect(rowBtn(el, 4).textContent).toBe('下载');
  });

  it('主题：有缺失有更新 → 「更新 N」（更新优先，差额在描述里）', async () => {
    const vault = newVault();
    const noir = skinEntry('noir', CSS_NOIR);
    const ghost = skinEntry('ghost', '/* ghost */');
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([], [noir, ghost]));
    vault.files.set('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css', '/* 被改过 */'); // updated
    // ghost 未下载 → missing
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([], [noir, ghost]) });

    const el = await renderGroup();
    expect(rowBtn(el, 3).textContent).toBe('更新 1');
    expect(rowBtn(el, 3).disabled).toBe(false);
    expect(rowDesc(el, 3)).toContain('另有 1 套未下载');
  });

  it('主题全部就绪 → 「已下载」禁用，描述带已下载套数（issue 492）', async () => {
    const vault = newVault();
    const noir = skinEntry('noir', CSS_NOIR);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([], [noir]));
    vault.files.set('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([], [noir]) });

    const el = await renderGroup();
    expect(rowBtn(el, 3).textContent).toBe('已下载');
    expect(rowBtn(el, 3).disabled).toBe(true);
    expect(rowDesc(el, 3)).toBe('全部主题已是最新（已下载 1 套）');
  });
});

describe('失败态（半自动铁则的 UI 面）', () => {
  it('无缓存清单且核对失败 → 检查更新行置顶（失败文案 + 重试），四行禁用', async () => {
    const vault = newVault();
    routeFetch({ [REMOTE_MANIFEST]: new Error('ENOTFOUND'), [BACKUP_MANIFEST]: new Error('ETIMEDOUT') });

    const el = await renderGroup();
    expect(rowVisible(el, 0)).toBe(true);
    expect(rowDesc(el, 0)).toContain('检查更新失败');
    expect(rowBtn(el, 0).textContent).toBe('重试');
    for (let i = 1; i <= 4; i++) expect(rowBtn(el, i).disabled).toBe(true);
  });

  it('有缓存但核对失败 → 缓存状态照常渲染 + 检查更新行留档（重试）', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V1);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML_V1);
    routeFetch({ [REMOTE_MANIFEST]: new Error('ENOTFOUND'), [BACKUP_MANIFEST]: new Error('ETIMEDOUT') });

    const el = await renderGroup();
    expect(rowVisible(el, 0)).toBe(true);
    expect(rowDesc(el, 0)).toContain('检查更新失败');
    expect(rowBtn(el, 1).textContent).toBe('已下载'); // 缓存状态照常可用
    expect(rowBtn(el, 1).disabled).toBe(true);
  });

  it('检查更新行点「重试」拉到清单后 → 行消失，按钮解禁翻转', async () => {
    const vault = newVault();
    // 首次核对失败（无缓存），重试时拉到
    let calls = 0;
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      if (req.url === REMOTE_MANIFEST && calls++ === 0) throw new Error('ENOTFOUND');
      if (req.url === BACKUP_MANIFEST) throw new Error('ETIMEDOUT');
      if (req.url === REMOTE_MANIFEST) return { status: 200, text: manifestJson([docEntry('changelog', HTML_V1)], []) } as any;
      throw new Error('unmocked url: ' + req.url);
    }) as any);

    const el = await renderGroup();
    expect(rowVisible(el, 0)).toBe(true);

    rowBtn(el, 0).click();
    await tick(60);
    expect(rowVisible(el, 0)).toBe(false);
    expect(rowBtn(el, 1).textContent).toBe('下载');
    expect(rowBtn(el, 1).disabled).toBe(false);
  });
});

describe('动作（下载只听用户点）', () => {
  it('点「下载」→ 落盘 → 按钮就地翻「已下载」；不发成功通知', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    routeFetch({
      [REMOTE_MANIFEST]: manifestJson([entry], []),
      'https://raw.githubusercontent.com/yeshimei/bz/master/downloads/bz-changelog.html': HTML_V2,
    });

    const el = await renderGroup();
    expect(rowBtn(el, 1).textContent).toBe('下载'); // missing

    rowBtn(el, 1).click();
    await tick(60);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/bz-changelog.html')).toBe(HTML_V2);
    expect(rowBtn(el, 1).textContent).toBe('已下载');
    expect(rowBtn(el, 1).disabled).toBe(true);
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

    const el = await renderGroup();
    expect(rowName(el, 4)).toBe('归物分类表'); // 排在主题之后
    expect(rowBtn(el, 4).textContent).toBe('下载');

    rowBtn(el, 4).click();
    await tick(60);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/belongings-categories.json')).toBe(tableText);
    expect(rowBtn(el, 4).textContent).toBe('已下载');
    expect(rowBtn(el, 4).disabled).toBe(true);
    // 就绪描述带表规模（loadCategoryTable 实测，不硬编码）
    expect(rowDesc(el, 4)).toContain('1 组 1 条');
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

    const el = await renderGroup();
    expect(rowBtn(el, 3).textContent).toBe('更新 1');
    rowBtn(el, 3).click();
    await tick(60);
    expect(getNoticeMessages().some((m) => (m as string).includes('1 套主题下载失败'))).toBe(true);
    // 内容仍是坏的 → 依旧不算就绪，按钮回到「更新 1」等下次
    expect(rowBtn(el, 3).textContent).toBe('更新 1');
  });
});

describe('跨入口同步（issue 492：下载事件）', () => {
  it('导航入口更新文档落盘 → 已渲染行态同步翻「已下载」', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', '<!DOCTYPE html><html>旧版</html>'); // updated
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([entry], []) });

    const el = await renderGroup();
    expect(rowBtn(el, 1).textContent).toBe('更新');

    // 模拟「打开更新日志」入口更新：与查看器同通道落盘（writeAssetText → 下载事件）
    await writeAssetText({ vault } as any, 'bz-changelog.html', HTML_V2);
    await tick(40);
    expect(rowBtn(el, 1).textContent).toBe('已下载');
    expect(rowBtn(el, 1).disabled).toBe(true);
    expect(rowDesc(el, 1)).toBe('已是最新版本');
  });
});

describe('补丁边界（issue 492 review：与动作态/搜索态的交界）', () => {
  it('动作中转圈不被下载事件拍掉：busy 钮补丁绕过，摘转圈后下一次同步才落定', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', '<!DOCTYPE html><html>旧版</html>'); // updated
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([entry], []) });

    const el = await renderGroup();
    const btn = rowBtn(el, 1);
    expect(btn.textContent).toBe('更新');

    // 动作进行中（点「更新」后转圈窗口）＋下载事件扑面：转圈与禁用必须保持，别成重复点击面
    setRowBtnState(btn, 'busy', '更新');
    await writeAssetText({ vault } as any, 'bz-changelog.html', HTML_V2);
    await tick(40);
    expect(btn.classList.contains('bz-rowbtn--busy')).toBe(true);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('更新'); // 文案没被补丁改写（磁盘已就绪，但补丁刻意绕过 busy 钮）

    // 动作收尾摘转圈 → 再次落盘事件把新态落定（已下载 禁用）
    setRowBtnState(btn, 'idle', '更新');
    await writeAssetText({ vault } as any, 'bz-changelog.html', HTML_V2);
    await tick(40);
    expect(btn.classList.contains('bz-rowbtn--busy')).toBe(false);
    expect(btn.textContent).toBe('已下载');
    expect(btn.disabled).toBe(true);
  });

  it('描述变更同源刷新高亮快照（data-sp-orig）：搜索还原底稿不吞掉本次更新', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', '<!DOCTYPE html><html>旧版</html>');
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([entry], []) });

    const el = await renderGroup();
    const desc = rowEl(el, 1).querySelector<HTMLElement>('.bz-sp-set-desc') as HTMLElement;
    desc.dataset.spOrig = desc.textContent ?? ''; // 模拟搜索高亮已存快照（markHitText 语义）

    await writeAssetText({ vault } as any, 'bz-changelog.html', HTML_V2);
    await tick(40);
    expect(desc.textContent).toBe('已是最新版本');
    expect(desc.dataset.spOrig).toBe('已是最新版本'); // 快照跟着走：下次敲键按新文还原
  });
});
