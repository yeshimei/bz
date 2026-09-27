// @vitest-environment jsdom
/**
 * 「在线资源」组（ADR-0203 / ADR-0205 / ADR-0207，issue 480 / 492；UI 层）测试。
 *
 * 钉住这些事：
 *  1. 组形状：name「在线资源」+ 恒在组首的「检查更新」（visibleWhen 门控）与「全部更新」两行 +
 *     清单驱动的资源行，全部通用 button 声明行；
 *  2. **清单驱动（ADR-0207）**：行集合与行序来自清单 docs + rowOrder（SKINS_ROW_ID 是皮肤聚合行），
 *     新增条目零代码改动；rowOrder 缺席回落「docs 顺序 + 皮肤末位」；漏登记的条目仍出行；
 *  3. 版本区间：doc 条目带 since / until 时按插件版本过滤（区间外不呈现该行）；
 *  4. 体积：清单条目带 size 时，就绪描述捎带体积（doc 单文件 / 皮肤合计）；
 *  5. 状态机：未下载 → 下载（皮肤带套数）、有更新 → 更新 N、已最新 → 已下载 禁用；
 *  6. 全部更新行：有待办 → 全部更新 N / 全部下载 N；无待办 → 已是最新（禁用）；无清单 → 等待检查更新（禁用）；
 *  7. 无缓存清单 → 只剩两行操作行并禁用 + 检查更新行（未检查/失败文案 + 重试）；核对失败但有缓存 → 缓存状态照常；
 *  8. 动作：下载完成后磁盘事实变了，按钮就地翻转成「已下载」（可感知性原则，不发成功通知）；
 *  9. 跨入口同步（issue 492）：下载事件（导航入口更新文档，经 writeAssetText 落盘）后已渲染行态跟着翻；
 * 10. 后台核对（构建期顺手一次）失败不炸渲染。
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
const remoteDoc = (file: string) => `https://raw.githubusercontent.com/yeshimei/bz/master/downloads/${file}`;

const HTML_V1 = '<!DOCTYPE html><html><body>日志 v1</body></html>';
const HTML_V2 = '<!DOCTYPE html><html><body>日志 v2</body></html>';
const CSS_NOIR = '/* noir */\n.bz-bs-skin-noir { --bz-brand: #d9b45f; }\n';

const tick = (ms = 25) => new Promise((r) => setTimeout(r, ms));

/** 组首两行：0 检查更新、1 全部更新；资源行从 2 起（顺序 = 清单 rowOrder） */
const CTRL_ROWS = 2;

/** 真实清单的行序（构建脚本 `pnpm manifest` 产出同口径）：文档 → 主题 → 其余 doc 追加末尾 */
const ROW_ORDER = ['changelog', 'manual', 'skins'];

function manifestJson(docs: unknown[], skins: unknown[], rowOrder?: string[] | null): string {
  const body: Record<string, unknown> = { version: 1, docs, skins };
  if (rowOrder !== null) body.rowOrder = rowOrder ?? ROW_ORDER;
  return JSON.stringify(body);
}

const FILE_OF: Record<string, string> = {
  changelog: 'bz-changelog.html',
  manual: 'bz-manual.html',
  'belongings-categories': 'belongings-categories.json',
};
const NAME_OF: Record<string, string> = {
  changelog: '更新日志',
  manual: '使用手册',
  'belongings-categories': '归物分类表',
};
interface DocOpts {
  name?: string;
  file?: string;
  since?: string;
  until?: string;
  size?: number;
}
const docEntry = (id: string, text: string, opts: DocOpts = {}) => ({
  id,
  name: opts.name ?? NAME_OF[id] ?? id,
  file: opts.file ?? FILE_OF[id] ?? `${id}.json`,
  sha256: textSha256(text),
  ...(opts.since ? { since: opts.since } : {}),
  ...(opts.until ? { until: opts.until } : {}),
  ...(opts.size ? { size: opts.size } : {}),
});
const skinEntry = (id: string, text: string, size?: number) => ({
  id,
  domain: 'bookshelf',
  name: '黑金夜曲',
  file: `skins/bookshelf/${id}.css`,
  sha256: textSha256(text),
  ...(size ? { size } : {}),
});

/** requestUrl 按 URL 分发的桩（未命中的 URL 抛错，暴露漏配） */
function routeFetch(map: Record<string, string | Error>): void {
  vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
    const hit = map[req.url];
    if (hit === undefined) throw new Error('unmocked url: ' + req.url);
    if (hit instanceof Error) throw hit;
    return { status: 200, text: hit } as any;
  }) as any);
}

/** 经真实渲染器渲染一组并等构建期核对落地 */
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
/** 资源行（i 从 0 起，跳过两行操作行） */
const resName = (el: HTMLElement, i: number) => rowName(el, i + CTRL_ROWS);
const resDesc = (el: HTMLElement, i: number) => rowDesc(el, i + CTRL_ROWS);
const resBtn = (el: HTMLElement, i: number) => rowBtn(el, i + CTRL_ROWS);
/** 资源行总数（DOM 行数减去两行操作行） */
const resCount = (el: HTMLElement) => el.querySelectorAll('.bz-sp-group-body > .bz-sp-set-row').length - CTRL_ROWS;

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

describe('组形状（清单驱动 + 通用声明行）', () => {
  it('检查更新 + 全部更新恒在组首，资源行紧随；全部 button 行；有清单时检查更新行门控隐藏', async () => {
    const vault = newVault();
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([docEntry('changelog', HTML_V1)], []));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([docEntry('changelog', HTML_V1)], []) });

    const group = await onlineResourcesGroup();
    expect(group.name).toBe('在线资源');
    expect(group.icon).toBe('cloud-download');
    expect(group.rows).toHaveLength(4); // 2 行操作行 + 更新日志 + 主题（rowOrder 里的 skins）
    expect(group.rows.every((r) => r.type === 'button')).toBe(true); // 无 custom 自绘行

    const el = document.createElement('div');
    document.body.appendChild(el);
    renderPanelSchema(el, { groups: [group] });
    await tick(40);
    expect(rowName(el, 0)).toBe('检查更新');
    expect(rowName(el, 1)).toBe('全部更新');
    expect([0, 1].map((i) => resName(el, i))).toEqual(['更新日志', '主题']);
    expect(rowVisible(el, 0)).toBe(false); // 有清单且未失败 → 门控隐藏（DOM 在位）
  });
});

describe('清单驱动的行集合与顺序（ADR-0207）', () => {
  it('清单加一条 doc → 多一行，行名取清单 name，走同一状态机（零代码改动）', async () => {
    const vault = newVault();
    const tplText = '{"templates":[]}';
    const entries = [
      docEntry('changelog', HTML_V1),
      docEntry('manual', HTML_V1),
      docEntry('belongings-categories', '{"version":"0.1.0","groups":[]}', { name: '归物分类表' }),
      docEntry('templates', tplText, { name: '内容模板包' }),
    ];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, []));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, []), [remoteDoc('templates.json')]: tplText });

    const el = await renderGroup();
    expect(resCount(el)).toBe(5); // 3 条文档类 + 主题 + 新条目
    const idx = [0, 1, 2, 3, 4].map((i) => resName(el, i));
    expect(idx).toEqual(['更新日志', '使用手册', '主题', '归物分类表', '内容模板包']); // rowOrder 未提的追加末尾
    const tplRow = idx.indexOf('内容模板包');
    expect(resBtn(el, tplRow).textContent).toBe('下载');

    resBtn(el, tplRow).click();
    await tick(60);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/templates.json')).toBe(tplText);
    expect(resBtn(el, tplRow).textContent).toBe('已下载');
    expect(resBtn(el, tplRow).disabled).toBe(true);
  });

  it('rowOrder 决定行序（数据表排在主题之前也在清单里说得算）', async () => {
    const vault = newVault();
    const entries = [docEntry('changelog', HTML_V1), docEntry('belongings-categories', '{"version":"0.1.0","groups":[]}', { name: '归物分类表' })];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, [], ['belongings-categories', 'skins', 'changelog']));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, [], ['belongings-categories', 'skins', 'changelog']) });

    const el = await renderGroup();
    expect([0, 1, 2].map((i) => resName(el, i))).toEqual(['归物分类表', '主题', '更新日志']);
  });

  it('没有 rowOrder 的旧清单回落「docs 顺序 + 皮肤末位」，条目一个不少', async () => {
    const vault = newVault();
    const entries = [docEntry('changelog', HTML_V1), docEntry('manual', HTML_V1)];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, [], null));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, [], null) });

    const el = await renderGroup();
    expect([0, 1, 2].map((i) => resName(el, i))).toEqual(['更新日志', '使用手册', '主题']);
  });

  it('rowOrder 漏提皮肤也补在末尾（皮肤是分发主体，不该因漏登记消失）', async () => {
    const vault = newVault();
    const entries = [docEntry('changelog', HTML_V1)];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, [], ['changelog']));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, [], ['changelog']) });

    const el = await renderGroup();
    expect([0, 1].map((i) => resName(el, i))).toEqual(['更新日志', '主题']);
  });
});

describe('版本区间与体积（ADR-0207）', () => {
  it('doc 条目声明 since 高于插件版本 → 该行不呈现；版本满足则呈现', async () => {
    const vault = newVault('1.2.0');
    const future = docEntry('templates', '{}', { name: '内容模板包', since: '1.3.0' });
    const entries = [docEntry('changelog', HTML_V1), future];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, []));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, []) });

    const el = await renderGroup();
    expect([0, 1].map((i) => resName(el, i))).toEqual(['更新日志', '主题']); // 需 1.3.0 的那条不呈现
    expect(resCount(el)).toBe(2);
  });

  it('doc 条目声明 until 已过期 → 同样不呈现', async () => {
    const vault = newVault('1.5.0');
    const old = docEntry('legacy-notes', '{}', { name: '旧版说明', until: '1.5.0' });
    const entries = [docEntry('changelog', HTML_V1), old];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, []));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, []) });

    const el = await renderGroup();
    expect([0, 1].map((i) => resName(el, i))).toEqual(['更新日志', '主题']);
  });

  it('清单登记 size 时，就绪描述捎带体积（doc 单文件；皮肤按区间内合计）', async () => {
    const vault = newVault();
    const noir = skinEntry('noir', CSS_NOIR, 1024);
    const ghost = skinEntry('ghost', '/* ghost */', 1024);
    const entry = docEntry('changelog', HTML_V1, { size: 2048 });
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], [noir, ghost]));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML_V1);
    vault.files.set('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css', CSS_NOIR);
    vault.files.set('.obsidian/plugins/bz/downloads/skins/bookshelf/ghost.css', '/* ghost */');
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([entry], [noir, ghost]) });

    const el = await renderGroup();
    expect(resDesc(el, 0)).toBe('已是最新版本（2 KB）');
    expect(resDesc(el, 1)).toContain('共 2 KB'); // 主题行：两套各 1 KB
  });

  it('清单没登记 size 时不提体积（描述与旧口径逐字一致）', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V1);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML_V1);
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([entry], []) });

    const el = await renderGroup();
    expect(resDesc(el, 0)).toBe('已是最新版本');
  });
});

describe('状态机（有缓存清单）', () => {
  it('已最新 → 已下载禁用；有更新 → 更新；未下载 → 下载', async () => {
    const vault = newVault();
    const catText = '{"version":"0.1.0","groups":[]}';
    const entries = [
      docEntry('changelog', HTML_V1),
      docEntry('manual', HTML_V1),
      docEntry('belongings-categories', catText, { name: '归物分类表' }),
    ];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML_V1); // ready
    vault.files.set('.obsidian/plugins/bz/downloads/bz-manual.html', '<!DOCTYPE html><html>旧版</html>'); // updated
    // belongings-categories 未下载 → missing
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, []) });

    const el = await renderGroup();
    expect([0, 1, 2, 3].map((i) => resName(el, i))).toEqual(['更新日志', '使用手册', '主题', '归物分类表']);
    expect(resBtn(el, 0).disabled).toBe(true);
    expect(resBtn(el, 0).textContent).toBe('已下载');
    expect(resBtn(el, 1).disabled).toBe(false);
    expect(resBtn(el, 1).textContent).toBe('更新');
    expect(resBtn(el, 3).disabled).toBe(false);
    expect(resBtn(el, 3).textContent).toBe('下载');
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
    expect(resBtn(el, 0).textContent).toBe('更新 1'); // 主题是唯一资源行
    expect(resBtn(el, 0).disabled).toBe(false);
    expect(resDesc(el, 0)).toContain('另有 1 套未下载');
  });

  it('主题全部就绪 → 「已下载」禁用，描述带已下载套数（issue 492）', async () => {
    const vault = newVault();
    const noir = skinEntry('noir', CSS_NOIR);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([], [noir]));
    vault.files.set('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css', CSS_NOIR);
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([], [noir]) });

    const el = await renderGroup();
    expect(resBtn(el, 0).textContent).toBe('已下载');
    expect(resBtn(el, 0).disabled).toBe(true);
    expect(resDesc(el, 0)).toBe('全部主题已是最新（已下载 1 套）');
  });
});

describe('全部更新行（组级动作）', () => {
  it('有待办 → 全部更新 N／只未下载 → 全部下载 N；全部就绪 → 已是最新 禁用', async () => {
    const vault = newVault();
    const entries = [docEntry('changelog', HTML_V1), docEntry('manual', HTML_V1)];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, []));
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', '<!DOCTYPE html><html>旧版</html>'); // updated
    // manual 未下载 → missing
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, []) });

    const el = await renderGroup();
    expect(rowBtn(el, 1).textContent).toBe('全部更新 2');
    expect(rowBtn(el, 1).disabled).toBe(false);

    // 全部补齐 → 无待办 → 「已是最新」禁用
    vault.files.set('.obsidian/plugins/bz/downloads/bz-changelog.html', HTML_V1);
    vault.files.set('.obsidian/plugins/bz/downloads/bz-manual.html', HTML_V1);
    await writeAssetText({ vault } as any, 'manifest.json', manifestJson(entries, []));
    await tick(40);
    expect(rowBtn(el, 1).textContent).toBe('已是最新');
    expect(rowBtn(el, 1).disabled).toBe(true);
  });

  it('只有未下载（无更新）→ 「全部下载 N」', async () => {
    const vault = newVault();
    const entries = [docEntry('changelog', HTML_V1), docEntry('manual', HTML_V1)];
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, []));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson(entries, []) });

    const el = await renderGroup();
    expect(rowBtn(el, 1).textContent).toBe('全部下载 2');
  });

  it('无清单 → 「等待检查更新」禁用（状态未知，不假装已是最新）', async () => {
    const vault = newVault();
    routeFetch({ [REMOTE_MANIFEST]: new Error('ENOTFOUND'), [BACKUP_MANIFEST]: new Error('ETIMEDOUT') });

    const el = await renderGroup();
    expect(rowBtn(el, 1).textContent).toBe('等待检查更新');
    expect(rowBtn(el, 1).disabled).toBe(true);
  });

  it('点一下把全部未就绪的都拉下来：逐条落盘、逐行翻「已下载」', async () => {
    const vault = newVault();
    const catText = '{"version":"0.1.0","groups":[{"id":"g001","name":"数码","icon":"package","items":[{"id":"c0001","name":"手机","icon":"package","aliases":[]}]}]}\n';
    const entries = [docEntry('changelog', HTML_V1), docEntry('manual', HTML_V1), docEntry('belongings-categories', catText, { name: '归物分类表' })];
    const noir = skinEntry('noir', CSS_NOIR);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson(entries, [noir]));
    routeFetch({
      [REMOTE_MANIFEST]: manifestJson(entries, [noir]),
      [remoteDoc('bz-changelog.html')]: HTML_V1,
      [remoteDoc('bz-manual.html')]: HTML_V1,
      [remoteDoc('belongings-categories.json')]: catText,
      [REMOTE_CSS]: CSS_NOIR,
    });

    const el = await renderGroup();
    expect(rowBtn(el, 1).textContent).toBe('全部下载 4'); // 三份文档 + 主题

    rowBtn(el, 1).click();
    await tick(200);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/bz-changelog.html')).toBe(HTML_V1);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/bz-manual.html')).toBe(HTML_V1);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/belongings-categories.json')).toBe(catText);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/skins/bookshelf/noir.css')).toBe(CSS_NOIR);
    for (let i = 0; i < resCount(el); i++) {
      expect(resBtn(el, i).textContent).toBe('已下载');
      expect(resBtn(el, i).disabled).toBe(true);
    }
    expect(rowBtn(el, 1).textContent).toBe('已是最新');
    expect(rowBtn(el, 1).classList.contains('bz-rowbtn--busy')).toBe(false); // 转圈摘干净
  });

  it('动作重入拦下：连点两次也只跑一轮', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    let fetches = 0;
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      if (req.url === REMOTE_MANIFEST) return { status: 200, text: manifestJson([entry], []) } as any;
      if (req.url.includes('bz-changelog.html')) {
        fetches++;
        return { status: 200, text: HTML_V2 } as any;
      }
      throw new Error('unmocked url: ' + req.url);
    }) as any);

    const el = await renderGroup();
    const btn = rowBtn(el, 1);
    expect(btn.textContent).toBe('全部下载 1');

    btn.click();
    btn.click(); // 第二击落在首个 await 之前/之内
    await tick(120);
    expect(fetches).toBe(1);
    expect(btn.textContent).toBe('已是最新');
  });
});

describe('失败态（半自动铁则的 UI 面）', () => {
  it('无缓存清单且核对失败 → 检查更新行置顶（失败文案 + 重试），资源行为零、操作行禁用', async () => {
    const vault = newVault();
    routeFetch({ [REMOTE_MANIFEST]: new Error('ENOTFOUND'), [BACKUP_MANIFEST]: new Error('ETIMEDOUT') });

    const el = await renderGroup();
    expect(rowVisible(el, 0)).toBe(true);
    expect(rowDesc(el, 0)).toContain('检查更新失败');
    expect(rowBtn(el, 0).textContent).toBe('重试');
    expect(resCount(el)).toBe(0); // 无清单 → 没有资源行（不假装有四行）
    expect(rowBtn(el, 1).disabled).toBe(true);
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
    expect(resBtn(el, 0).textContent).toBe('已下载'); // 缓存状态照常可用
    expect(resBtn(el, 0).disabled).toBe(true);
  });

  it('检查更新行点「重试」拉到清单后 → 行消失，资源行出现并解禁', async () => {
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
    expect(resCount(el)).toBe(0);

    rowBtn(el, 0).click();
    await tick(80);
    // 行集合变了（无清单 → 有清单）→ 补丁不接手，等面板重开按新清单重建整组
    const el2 = await renderGroup();
    expect(rowVisible(el2, 0)).toBe(false); // 核对成功 → 检查更新行门控隐藏
    expect(resBtn(el2, 0).textContent).toBe('下载');
    expect(resBtn(el2, 0).disabled).toBe(false);
  });

  it('重试再失败：转圈摘掉、按钮回到「重试」可再点（不卡 busy）', async () => {
    const vault = newVault();
    routeFetch({ [REMOTE_MANIFEST]: new Error('ENOTFOUND'), [BACKUP_MANIFEST]: new Error('ETIMEDOUT') });

    const el = await renderGroup();
    const btn = rowBtn(el, 0);
    expect(btn.textContent).toBe('重试');

    btn.click();
    await tick(80);
    expect(btn.classList.contains('bz-rowbtn--busy')).toBe(false);
    expect(btn.textContent).toBe('重试');
    expect(btn.disabled).toBe(false);

    btn.click(); // 第二击同样失败：仍要回到可再点的「重试」，不能停成禁用
    await tick(80);
    expect(btn.classList.contains('bz-rowbtn--busy')).toBe(false);
    expect(btn.textContent).toBe('重试');
    expect(btn.disabled).toBe(false);
  });
});

describe('动作（下载只听用户点）', () => {
  it('点「下载」→ 落盘 → 按钮就地翻「已下载」；不发成功通知', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([entry], []), [remoteDoc('bz-changelog.html')]: HTML_V2 });

    const el = await renderGroup();
    expect(resBtn(el, 0).textContent).toBe('下载'); // missing

    resBtn(el, 0).click();
    await tick(60);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/bz-changelog.html')).toBe(HTML_V2);
    expect(resBtn(el, 0).textContent).toBe('已下载');
    expect(resBtn(el, 0).disabled).toBe(true);
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
    const entry = docEntry('belongings-categories', tableText, { name: '归物分类表' });
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    routeFetch({ [REMOTE_MANIFEST]: manifestJson([entry], []), [remoteDoc('belongings-categories.json')]: tableText });

    const el = await renderGroup();
    expect(resName(el, 1)).toBe('归物分类表'); // 排在主题之后（rowOrder 未提 → 追加末尾）
    expect(resBtn(el, 1).textContent).toBe('下载');

    resBtn(el, 1).click();
    await tick(60);
    expect(vault.files.get('.obsidian/plugins/bz/downloads/belongings-categories.json')).toBe(tableText);
    expect(resBtn(el, 1).textContent).toBe('已下载');
    expect(resBtn(el, 1).disabled).toBe(true);
    // 就绪描述带表规模（loadCategoryTable 实测，不硬编码）
    expect(resDesc(el, 1)).toContain('1 组 1 条');
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
    expect(resBtn(el, 0).textContent).toBe('更新 1');
    resBtn(el, 0).click();
    await tick(60);
    expect(getNoticeMessages().some((m) => (m as string).includes('1 套主题下载失败'))).toBe(true);
    // 内容仍是坏的 → 依旧不算就绪，按钮回到「更新 1」等下次
    expect(resBtn(el, 0).textContent).toBe('更新 1');
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
    expect(resBtn(el, 0).textContent).toBe('更新');

    // 模拟「打开更新日志」入口更新：与查看器同通道落盘（writeAssetText → 下载事件）
    await writeAssetText({ vault } as any, 'bz-changelog.html', HTML_V2);
    await tick(40);
    expect(resBtn(el, 0).textContent).toBe('已下载');
    expect(resBtn(el, 0).disabled).toBe(true);
    expect(resDesc(el, 0)).toBe('已是最新版本');
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
    const btn = resBtn(el, 0);
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
    const desc = rowEl(el, CTRL_ROWS).querySelector<HTMLElement>('.bz-sp-set-desc') as HTMLElement;
    desc.dataset.spOrig = desc.textContent ?? ''; // 模拟搜索高亮已存快照（markHitText 语义）

    await writeAssetText({ vault } as any, 'bz-changelog.html', HTML_V2);
    await tick(40);
    expect(desc.textContent).toBe('已是最新版本');
    expect(desc.dataset.spOrig).toBe('已是最新版本'); // 快照跟着走：下次敲键按新文还原
  });

  it('动作中重渲（切域再回来）：新渲染的钮按 schema 禁用态重建，不给重复点击面', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    let release: () => void = () => {};
    const gate = new Promise<void>((res) => {
      release = res;
    });
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      if (req.url === REMOTE_MANIFEST) return { status: 200, text: manifestJson([entry], []) } as any;
      if (req.url.includes('bz-changelog.html')) {
        await gate; // 下载挂起：动作停在 busy 窗口内
        return { status: 200, text: HTML_V2 } as any;
      }
      throw new Error('unmocked url: ' + req.url);
    }) as any);

    const group = await onlineResourcesGroup();
    const el = document.createElement('div');
    document.body.appendChild(el);
    renderPanelSchema(el, { groups: [group] });
    await tick(40);
    expect(resBtn(el, 0).textContent).toBe('下载');

    resBtn(el, 0).click();
    await tick(20);
    expect(resBtn(el, 0).classList.contains('bz-rowbtn--busy')).toBe(true);

    // 批量下载是逐条落盘：动作期间来一发事件（重算不得把置忙抹掉）
    await writeAssetText({ vault } as any, 'bz-manual.html', HTML_V1);
    await tick(40);
    expect(resBtn(el, 0).classList.contains('bz-rowbtn--busy')).toBe(true);

    // 切域再回来 = 同一组对象重渲（新 DOM，busy 类不在）——禁用态必须来自行对象
    const el2 = document.createElement('div');
    document.body.appendChild(el2);
    renderPanelSchema(el2, { groups: [group] });
    await tick(20);
    expect(resBtn(el2, 0).classList.contains('bz-rowbtn--busy')).toBe(false);
    expect(resBtn(el2, 0).disabled).toBe(true);

    release();
    await tick(60);
    expect(resBtn(el2, 0).textContent).toBe('已下载'); // 动作收尾按新落定的行态写回
    expect(resBtn(el2, 0).disabled).toBe(true);
  });

  it('动作重入拦下：读缓存清单的让位点（慢盘）上再点一次，也只跑一轮下载', async () => {
    const vault = newVault();
    const entry = docEntry('changelog', HTML_V2);
    vault.files.set(MANIFEST_CACHE_PATH, manifestJson([entry], []));
    let fetches = 0;
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      if (req.url === REMOTE_MANIFEST) return { status: 200, text: manifestJson([entry], []) } as any;
      if (req.url.includes('bz-changelog.html')) {
        fetches++;
        return { status: 200, text: HTML_V2 } as any;
      }
      throw new Error('unmocked url: ' + req.url);
    }) as any);

    const el = await renderGroup();
    const btn = resBtn(el, 0);
    expect(btn.textContent).toBe('下载');

    // 武装慢盘：动作里那次「读缓存清单」挂住（renderGroup 的构建期读已过，不影响）
    const origRead = vault.adapter.read.bind(vault.adapter);
    let release: () => void = () => {};
    const gate = new Promise<void>((res) => {
      release = res;
    });
    let gated = false;
    (vault.adapter as { read: (p: string) => Promise<string> }).read = async (p: string) => {
      if (!gated && p.endsWith('downloads/manifest.json')) {
        gated = true;
        await gate;
      }
      return origRead(p);
    };

    btn.click();
    await tick(5); // 第一轮停在让位点上
    btn.click(); // 第二击落在这个窗口里（置忙若晚于首个 await 落定，这里就是并发第二轮）
    release();
    await tick(60);
    expect(fetches).toBe(1);
    expect(btn.textContent).toBe('已下载');
    expect(btn.disabled).toBe(true);
  });

  it('检查更新行动作中重渲：重试钮按 schema 禁用态重建，收尾后回到可再点', async () => {
    const vault = newVault();
    let hung = false;
    let release: () => void = () => {};
    const gate = new Promise<void>((res) => {
      release = res;
    });
    vi.mocked(requestUrl).mockImplementation((async (req: { url: string }) => {
      if (hung) await gate; // 重试期间挂住：动作停在 busy 窗口内
      throw new Error('ENOTFOUND'); // 双源都失败 → checkFailed（无缓存 → 检查更新行置顶）
    }) as any);

    const group = await onlineResourcesGroup();
    const el = document.createElement('div');
    document.body.appendChild(el);
    renderPanelSchema(el, { groups: [group] });
    await tick(40);
    expect(rowVisible(el, 0)).toBe(true);
    expect(rowBtn(el, 0).textContent).toBe('重试');

    hung = true;
    rowBtn(el, 0).click();
    await tick(20);
    expect(rowBtn(el, 0).classList.contains('bz-rowbtn--busy')).toBe(true);

    // 切域再回来 = 重渲：新钮的禁用态必须来自行对象（busy 类只是 DOM 瞬态，不在新 DOM 上）
    const el2 = document.createElement('div');
    document.body.appendChild(el2);
    renderPanelSchema(el2, { groups: [group] });
    await tick(20);
    expect(rowBtn(el2, 0).classList.contains('bz-rowbtn--busy')).toBe(false);
    expect(rowBtn(el2, 0).disabled).toBe(true);

    release();
    await tick(80);
    expect(rowBtn(el2, 0).textContent).toBe('重试'); // 失败态照旧可再点，不留下永久禁用
    expect(rowBtn(el2, 0).disabled).toBe(false);
  });
});
