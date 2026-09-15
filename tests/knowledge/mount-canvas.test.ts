/**
 * 挂载树白板 UI 测试（issues 317 画布二 / 319 入口与壳）
 *
 * 覆盖面（jsdom + MockVault；尺寸经 `deps.measure` 注入——jsdom 里 offsetWidth 恒 0）：
 * 开关、六类节点 + 失效灰节点 + 文献吸附（不拉线）、右键菜单项与禁用态、建议幽灵节点的固定 /
 * 取消 / 看理由、面包屑换根、方向翻转（看谁挂了我）、降级（开关关闭 / 缺索引 / 缺 AI）、
 * 移动端 .bz-panel-mtop + 长按菜单、缩放器三键、大图 culled 不崩、入口（卡片列表行 / 预览弹层 / 命令）。
 *
 * 建议链路全程 mock/stub（**不联网、不跑 AI**）：只替换 `generateSuggestions` / `markSuggestion`，
 * `mergeSuggestions` 等其余导出保持真实实现（用 importOriginal 展开）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Platform } from 'obsidian';
import BzPlugin from '../../src/main';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, hasNotice, mockMarkdownRenderer, resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { KnowledgeData } from '../../src/knowledge/data';
import { UIManager } from '../../src/knowledge/ui';
import {
  closeMountTree,
  destroyMountTree,
  mountTreeDirection,
  mountTreeOpen,
  mountTreeRoot,
  openMountTree,
} from '../../src/knowledge/mount-canvas';
import { suggestionId } from '../../src/knowledge/mount-suggest';

/* ---------- 建议链路替身（真实 mergeSuggestions 保留） ---------- */
const suggestMock = vi.hoisted(() => ({
  generateSuggestions: vi.fn(),
  markSuggestion: vi.fn(),
}));
vi.mock('../../src/knowledge/mount-suggest', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateSuggestions: suggestMock.generateSuggestions,
  markSuggestion: suggestMock.markSuggestion,
}));

/* ---------- ui.ts 依赖替身（同 ui.test.ts：note-gen 不真跑 AI，流程框不真弹） ---------- */
const noteGen = vi.hoisted(() => ({
  generateTermNote: vi.fn(),
  generateTermDraft: vi.fn(),
  generatePassageNote: vi.fn(),
  generatePassageDraft: vi.fn(),
  generateImageNote: vi.fn(),
  generateImageDraft: vi.fn(),
  resolveImageDir: vi.fn(() => '文献盒/assets'),
  summarizeTermSummary: vi.fn(),
  backfillNotes: vi.fn(),
}));
vi.mock('../../src/knowledge/note-gen', () => noteGen);
/** 流程框替身：缺省「确认」（'ok'），需要验取消时 mockResolvedValueOnce('cancel') */
const flowDialog = vi.hoisted(() => ({ openFlowDialog: vi.fn() }));
vi.mock('../../src/core/flow-dialog', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  openFlowDialog: flowDialog.openFlowDialog,
}));

/* ------------------------------------------------------------------ *
 * 夹具
 * ------------------------------------------------------------------ */

const ROOT = '卡片盒/主卡.md';

/** 主卡：六类目标各一条 + 一条断链；文献盒有同名文献（吸附用） */
function seedVault(vault: MockVault): void {
  vault.files.set(
    ROOT,
    [
      '---',
      'title: "主卡"',
      'category: "心理"',
      '---',
      '',
      '主卡正文一句话：先看 [[子卡]] 这张卡。',
      '整篇见 [[文献盒/整篇笔记]]，标题见 [[文献盒/标题片段#小节]]，段落见 [[文献盒/段落#^blk]]。',
      '图 [[附件/图.png]] 视频 [[附件/视频.mp4]]。',
      '断链 [[不存在]]。',
    ].join('\n'),
  );
  vault.files.set('卡片盒/子卡.md', '---\ntitle: "子卡"\n---\n\n子卡正文（回指 [[主卡]]，不画同级 / 回指边）。');
  vault.files.set('文献盒/主卡.md', '---\ntitle: "主卡"\ntype: term\n---\n\n同名文献正文（吸附在卡片正下方、不拉线）。');
  vault.files.set('文献盒/整篇笔记.md', '整篇笔记正文。');
  vault.files.set('文献盒/标题片段.md', '# 标题片段\n\n## 小节\n\n小节里的正文片段。');
  vault.files.set('文献盒/段落.md', '段落正文一段。 ^blk');
  vault.files.set('附件/图.png', 'binary');
  vault.files.set('附件/视频.mp4', 'binary');
}

/** 共享 mock 的原始 render 实现（本文件内局部替换后还原） */
const ORIGINAL_RENDER = mockMarkdownRenderer.render.getMockImplementation()!;

/**
 * 极简 markdown 替身：把 `[[目标|别名]]` 渲染成 `<a class="internal-link" data-href="目标">别名</a>`
 * （真 Obsidian 的渲染产物同形）——「悬停双链文字」这条腿只有在真有链接元素时才验得出来。
 */
function renderWithLinks(md: string, el: HTMLElement): void {
  const block = document.createElement('div');
  const re = /\[\[([^\[\]]+?)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) block.appendChild(document.createTextNode(md.slice(last, m.index)));
    const inner = m[1];
    const bar = inner.indexOf('|');
    const target = (bar >= 0 ? inner.slice(0, bar) : inner).split('#')[0].trim();
    const label = (bar >= 0 ? inner.slice(bar + 1) : inner).trim();
    const a = document.createElement('a');
    a.className = 'internal-link';
    a.setAttribute('data-href', target);
    a.setAttribute('href', target);
    a.textContent = label || target;
    block.appendChild(a);
    last = m.index + m[0].length;
  }
  if (last < md.length) block.appendChild(document.createTextNode(md.slice(last)));
  el.appendChild(block);
}

function makeApp(vault: MockVault) {
  const base = mockAppWithVault(vault) as any;
  const executeCommandById = vi.fn();
  base.commands = { registered: [], addCommand: vi.fn(), removeCommand: vi.fn(), executeCommandById, listCommands: () => [] };
  base.workspace = {
    ...base.workspace,
    getActiveFile: () => ({ path: ROOT, extension: 'md' }),
    getLeaf: () => ({ openFile: vi.fn() }),
    onLayoutReady: (cb: () => void) => cb(),
  };
  setApp(base);
  return { app: base, executeCommandById };
}

describe('挂载树白板（317 渲染与交互 / 319 壳与入口）', () => {
  let vault: MockVault;
  let app: any;
  let executeCommandById: ReturnType<typeof vi.fn>;
  let settings: Record<string, any>;
  /** 通知（正文 + 语义档；issue 319 复用 core/notice 的 success / error 档） */
  let noticeCalls: Array<{ msg: string; type?: string }>;
  let opened: string[];
  let copied: string[];

  const said = (frag: string): boolean => noticeCalls.some((n) => n.msg.includes(frag));
  const typeOf = (frag: string): string | undefined => noticeCalls.find((n) => n.msg.includes(frag))?.type;

  /** 注入接缝：固定尺寸（jsdom 量不到）+ 通知 / 打开笔记 / 剪贴板全部可断言 */
  const deps = () => ({
    measure: () => ({ w: 240, h: 120 }),
    notice: (msg: string, type?: string) => noticeCalls.push({ msg, type }),
    openNote: (path: string) => opened.push(path),
    writeClipboard: async (text: string) => {
      copied.push(text);
    },
  });
  const open = (path: string, opts: Record<string, any> = {}) => openMountTree(path, { deps: deps(), ...opts });

  const win = (): HTMLElement => document.getElementById('bz-kb-mt-window')!;
  const loading = (): HTMLElement => document.getElementById('bz-kb-mt-loading') as HTMLElement;
  const card = (id: string): HTMLElement | null => win().querySelector<HTMLElement>(`.bz-kb-mt-node[data-mt-id="${id}"]`);
  const menuItems = (): HTMLButtonElement[] =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('#bz-kb-mt-ctx [data-mt-menu]'));
  const byAct = (act: string): HTMLButtonElement => menuItems().find((b) => b.getAttribute('data-mt-menu') === act)!;
  const fireCtx = (el: HTMLElement | null): void => {
    expect(el).toBeTruthy();
    el!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
  };
  const rootId = (): string | null => document.querySelector('.bz-kb-mt-node.is-root')?.getAttribute('data-mt-id') ?? null;
  const clickCard = (id: string): void => {
    card(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    seedVault(vault);
    const made = makeApp(vault);
    app = made.app;
    executeCommandById = made.executeCommandById;
    KnowledgeData.init({ storagePath: 'CONFIG/STORAGE' });
    clearNotices();
    settings = {
      storagePath: 'CONFIG/STORAGE',
      knowledgeCardboxDirectory: '卡片盒',
      knowledgeDirectory: '文献盒',
      knowledgeMountAutoSuggest: true,
    };
    setSettingsProvider(() => settings as any);
    setSettingsSaver(async () => {});
    noticeCalls = [];
    opened = [];
    copied = [];
    suggestMock.generateSuggestions.mockReset().mockResolvedValue({ status: 'cached', suggestions: [] });
    suggestMock.markSuggestion.mockReset().mockResolvedValue(undefined);
    flowDialog.openFlowDialog.mockReset().mockResolvedValue('ok');
    destroyMountTree();
  });

  afterEach(() => {
    destroyMountTree();
    (Platform as any).isMobile = false;
    // 极简 markdown 替身只在本文件的「双链文字」用例里装，用完还原共享 mock
    mockMarkdownRenderer.render.mockImplementation(ORIGINAL_RENDER);
    document.body.innerHTML = '';
  });

  /* ==================== shell ==================== */

  it('白板开关：遮罩挂载 / 关闭、mountTreeOpen 与主卡可读；关闭后 DOM 保留可再开', async () => {
    expect(mountTreeOpen()).toBe(false);
    expect(document.getElementById('bz-kb-mt-mask')).toBeNull();

    await open(ROOT);
    expect(mountTreeOpen()).toBe(true);
    expect(mountTreeRoot()).toBe(ROOT);
    const mask = document.getElementById('bz-kb-mt-mask')!;
    expect(mask.style.display).toBe('block');
    expect(win().style.display).toBe('flex');
    expect(win().className).toContain('bz-kb-window');

    closeMountTree();
    expect(mountTreeOpen()).toBe(false);
    expect(mask.style.display).toBe('none');
    expect(mountTreeRoot()).toBeNull();

    await open(ROOT);
    expect(mountTreeOpen()).toBe(true);
  });

  it('关掉再开同一张卡：不复用旧树、不留「生成中」遮罩（审查回归）', async () => {
    await open(ROOT);
    closeMountTree();
    await open(ROOT);
    expect(mountTreeOpen()).toBe(true);
    expect(mountTreeRoot()).toBe(ROOT);
    expect(rootId()).toBe(ROOT);
    expect(loading().style.display).toBe('none');
  });

  it('换根途中关闭再开：抬层早退只认「同一张树」，不端出上一张卡的画布（审查回归）', async () => {
    await open(ROOT);
    // 换根是命令式发起（不 await）：载入在途时关闭，`st.cardPath` 已是新卡、`st.tree` 还是旧树
    void openMountTree('卡片盒/子卡.md', { deps: deps() });
    closeMountTree();
    await open('卡片盒/子卡.md');
    await vi.waitFor(() => expect(rootId()).toBe('卡片盒/子卡.md'));
    expect(mountTreeRoot()).toBe('卡片盒/子卡.md');
    expect(loading().style.display).toBe('none');
  });

  it('六类节点齐备 + 失效灰节点 + 文献吸附（正下方 8px、默认折起、不拉线）', async () => {
    await open(ROOT);
    expect(card(ROOT)!.className).toContain('is-card');
    expect(card(ROOT)!.className).toContain('is-root');
    expect(card('文献盒/整篇笔记.md')!.className).toContain('is-note');
    expect(card('文献盒/标题片段.md#小节')!.className).toContain('is-head');
    expect(card('文献盒/段落.md#^blk')!.className).toContain('is-para');
    expect(card('附件/图.png')!.className).toContain('is-image');
    expect(card('附件/视频.mp4')!.className).toContain('is-video');
    // 图片 / 视频 = 小卡节点：文件名 + 类型徽章
    expect(card('附件/图.png')!.querySelector('.bz-kb-mt-ph')!.textContent).toContain('附件/图.png');
    expect(Array.from(card('附件/图.png')!.querySelectorAll('.bz-kb-mt-chip')).map((c) => c.textContent)).toContain('图片');
    expect(Array.from(card('附件/视频.mp4')!.querySelectorAll('.bz-kb-mt-chip')).map((c) => c.textContent)).toContain('视频');
    // 标题 / 段落节点的显示形态：标题名 + 片段正文
    expect(card('文献盒/标题片段.md#小节')!.querySelector('.bz-kb-mt-ttl')!.textContent).toBe('小节');
    expect(card('文献盒/标题片段.md#小节')!.querySelector('.bz-kb-mt-body')!.textContent).toContain('小节里的正文片段');
    expect(card('文献盒/段落.md#^blk')!.querySelector('.bz-kb-mt-body')!.textContent).toContain('段落正文一段');

    // 失效灰节点：id = 原始目标文本；灰 + 不展开
    const miss = card('不存在')!;
    expect(miss.className).toContain('is-missing');
    expect(miss.querySelector('.bz-kb-mt-ph.is-missing')).toBeTruthy();
    expect(miss.querySelector('.bz-kb-mt-ttl')!.textContent).toContain('失效');

    // 文献吸附：贴所属卡片正下方 8px、宽度跟随卡片、默认只露标题行
    const root = card(ROOT)!;
    const dock = card('文献盒/主卡.md')!;
    expect(dock.className).toContain('is-dock');
    expect(dock.className).toContain('is-lit');
    expect(dock.className).toContain('is-folded');
    expect(dock.style.left).toBe(root.style.left);
    // 宽度跟随所属卡片（jsdom 里量出的宽 = 注入的 240px，真实环境 = 卡的实测宽）
    expect(dock.style.width).toBe('240px');
    expect(Number.parseFloat(dock.style.top)).toBeCloseTo(Number.parseFloat(root.style.top) + 120 + 8, 5);

    // 边数 = 7（主卡 → 子卡 / 整篇 / 标题 / 段落 / 图 / 视频 / 失效）：文献吸附不产边、回指也不产边
    expect(win().querySelectorAll('.bz-kb-mt-edge').length).toBe(7);
    // 各线起点 = 主卡正文里的锚点圆点（7 条边都在主卡身上挂点）
    expect(root.querySelectorAll('.bz-kb-mt-anch').length).toBeGreaterThanOrEqual(6);

    // 卡片完整正文常显；点标题折 / 展（折叠态只存内存）
    expect(root.querySelector('.bz-kb-mt-body')!.textContent).toContain('主卡正文一句话');
    const ttl = root.querySelector('.bz-kb-mt-ttl') as HTMLElement;
    ttl.click();
    expect(root.className).toContain('is-folded');
    ttl.click();
    expect(root.className).not.toContain('is-folded');
  });

  it('血缘高亮：点卡片出祖先琥珀 / 后代青、其余降透明度；再点取消', async () => {
    await open(ROOT);
    const child = card('卡片盒/子卡.md')!;
    child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(child.className).toContain('is-sel');
    expect(card(ROOT)!.className).toContain('is-anc');
    expect(card('文献盒/整篇笔记.md')!.className).toContain('is-dim');
    expect(win().querySelector('.bz-kb-mt-edge.is-anc')).toBeTruthy();
    // 文献吸附不参与血缘高亮（不降透明度、不着色）
    const dock = card('文献盒/主卡.md')!;
    expect(dock.className).not.toContain('is-dim');
    expect(dock.className).not.toContain('is-anc');
    // 再点同一张 → 取消
    child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(child.className).not.toContain('is-sel');
    expect(card('文献盒/整篇笔记.md')!.className).not.toContain('is-dim');
  });

  it('悬停三方联动：悬停目标卡 → 对应连线与锚点圆点一起点亮', async () => {
    await open(ROOT);
    const target = card('文献盒/整篇笔记.md')!;
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(win().querySelector('.bz-kb-mt-edge.is-hot')).toBeTruthy();
    expect(win().querySelector('.bz-kb-mt-anch.is-hot')).toBeTruthy();
    target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(win().querySelector('.bz-kb-mt-edge.is-hot')).toBeNull();
  });

  it('悬停正文双链文字：该链接 / 其连线 / 目标卡一起点亮（原型 .lnk:hover 这条腿）', async () => {
    // 真 Obsidian 会把 [[…]] 渲染成 a.internal-link，mock 默认是纯文本 → 这里局部换成同形替身
    mockMarkdownRenderer.render.mockImplementation(async (_app: any, md: string, el: HTMLElement) => {
      renderWithLinks(String(md ?? ''), el);
    });
    await open(ROOT);
    const link = card(ROOT)!.querySelector<HTMLAnchorElement>('a.internal-link[data-href="子卡"]');
    expect(link).toBeTruthy();
    const key = link!.getAttribute('data-mt-edge');
    expect(key).toBeTruthy(); // 正文双链已回填 DOM 键

    link!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(link!.className).toContain('is-hot');
    expect(card('卡片盒/子卡.md')!.className).toContain('is-hot');
    expect(win().querySelector(`.bz-kb-mt-edge[data-mt-key="${key}"]`)!.getAttribute('class')).toContain('is-hot');

    link!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(link!.className).not.toContain('is-hot');
    expect(card('卡片盒/子卡.md')!.className).not.toContain('is-hot');
  });

  it('点吸附文献（attached）：不触发血缘高亮、整图不变暗（选中态只服务面包屑 / 菜单）', async () => {
    await open(ROOT);
    clickCard('文献盒/主卡.md');
    expect(win().querySelectorAll('.bz-kb-mt-node.is-dim').length).toBe(0);
    expect(win().querySelectorAll('.bz-kb-mt-node.is-sel').length).toBe(0);
    expect(win().querySelectorAll('.bz-kb-mt-edge.is-off').length).toBe(0);
    expect(mountTreeRoot()).toBe(ROOT); // 选中吸附项不换根
  });

  /* ==================== 右键菜单 ==================== */

  it('右键菜单：八项动作齐备；非建议禁用固定/取消/看理由，无同名文献禁用看文献笔记，主卡与失效节点禁用改根', async () => {
    await open(ROOT);
    fireCtx(card('卡片盒/子卡.md'));
    expect(menuItems().map((b) => b.getAttribute('data-mt-menu'))).toEqual([
      'open',
      'lit',
      'copy',
      'root',
      'who',
      'pin',
      'dismiss',
      'why',
    ]);
    expect(byAct('open').disabled).toBe(false);
    expect(byAct('lit').disabled).toBe(true); // 子卡没有同名文献
    expect(byAct('root').disabled).toBe(false);
    expect(byAct('who').disabled).toBe(false);
    expect(byAct('pin').disabled).toBe(true); // 非建议节点
    expect(byAct('dismiss').disabled).toBe(true);
    expect(byAct('why').disabled).toBe(true);

    // 主卡自己：设为主卡禁用；有同名文献 → 看文献笔记可用
    fireCtx(card(ROOT));
    expect(byAct('root').disabled).toBe(true);
    expect(byAct('lit').disabled).toBe(false);
    byAct('copy').click();
    await vi.waitFor(() => expect(copied).toEqual(['[[卡片盒/主卡]]']));
    expect(said('已复制')).toBe(true);
    expect(typeOf('已复制')).toBe('success'); // 通知语义照域内先例（ui.ts 落卡用 success）

    // 失效节点：打开 / 改根 / 翻向全禁用（不自动清理，等体检）
    fireCtx(card('不存在'));
    expect(byAct('open').disabled).toBe(true);
    expect(byAct('root').disabled).toBe(true);
    expect(byAct('who').disabled).toBe(true);

    // 打开笔记 / 看文献笔记的动作落点
    fireCtx(card('文献盒/整篇笔记.md'));
    byAct('open').click();
    fireCtx(card(ROOT));
    byAct('lit').click();
    expect(opened).toEqual(['文献盒/整篇笔记.md', '文献盒/主卡.md']);
  });

  it('AI 建议：幽灵节点虚线 + 从主卡扯线；看理由给理由、「取消」留档并移除、「固定」把 [[目标]] 写进正文锚点', async () => {
    vault.files.set('文献盒/建议目标.md', '建议目标的正文。');
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        {
          anchor: { from: 0, to: 8, text: '主卡正文一句话' },
          target: '文献盒/建议目标.md',
          kind: 'card',
          reason: '两卡同讲注意力机制',
          score: 0.82,
          state: 'pending',
        },
      ],
    });
    await open(ROOT);
    const ghostId = 'ai:文献盒/建议目标.md';
    const ghost = card(ghostId)!;
    expect(ghost.className).toContain('is-ghost');
    expect(win().querySelector('.bz-kb-mt-edge.is-sug')!.getAttribute('stroke-dasharray')).toBe('6 5');
    expect(document.querySelector('.bz-kb-mt-status')!.textContent).toContain('新生成建议');

    fireCtx(ghost);
    expect(document.querySelector('#bz-kb-mt-ctx .bz-kb-mt-ctx-reason')!.textContent).toContain('注意力机制');
    expect(byAct('pin').disabled).toBe(false);
    expect(byAct('dismiss').disabled).toBe(false);
    expect(byAct('why').disabled).toBe(false);
    byAct('why').click();
    expect(said('建议理由：两卡同讲注意力机制')).toBe(true);

    // 取消：留档 dismissed + 本图移除（不再画虚线）
    fireCtx(card(ghostId));
    byAct('dismiss').click();
    await vi.waitFor(() => expect(document.querySelector('.bz-kb-mt-node.is-ghost')).toBeNull());
    expect(suggestMock.markSuggestion).toHaveBeenCalledWith(ROOT, expect.objectContaining({ target: '文献盒/建议目标.md' }), 'dismissed', expect.anything());
    expect(said('已取消建议')).toBe(true);
    expect(typeOf('已取消建议')).toBe('success');

    // 固定：正文锚点处写 [[文献盒/建议目标]]（去 .md），frontmatter 不动；留档 fixed
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        {
          anchor: { from: 0, to: 8, text: '主卡正文一句话' },
          target: '文献盒/建议目标.md',
          kind: 'card',
          reason: '两卡同讲注意力机制',
          score: 0.82,
          state: 'pending',
        },
      ],
    });
    await open(ROOT, { force: true });
    fireCtx(card(ghostId));
    byAct('pin').click();
    // 词级锚点（≤12 字）→ **别名替换** `[[目标|原词]]`（ADR-0140 决策 3：不做句中追加）
    await vi.waitFor(() => expect(vault.files.get(ROOT)!).toContain('[[文献盒/建议目标|主卡正文一句话]]'));
    expect(vault.files.get(ROOT)!).toContain('[[文献盒/建议目标|主卡正文一句话]]：先看 [[子卡]] 这张卡。');
    expect(vault.files.get(ROOT)!.startsWith('---\ntitle: "主卡"\n')).toBe(true);
    expect(suggestMock.markSuggestion).toHaveBeenCalledWith(ROOT, expect.objectContaining({ target: '文献盒/建议目标.md' }), 'fixed', expect.anything());
    await vi.waitFor(() => expect(said('已固定')).toBe(true));
    expect(typeOf('已固定')).toBe('success');
    expect(said('正文写入 [[文献盒/建议目标|主卡正文一句话]]')).toBe(true);
  });

  it('空卡首开：只有主卡的卡跑建议时先出空板 + 生成中，不把孤零零一张主卡当结果画出来', async () => {
    const BARE = '卡片盒/空卡.md';
    vault.files.set(BARE, '---\ntitle: "空卡"\n---\n\n这张卡一句话都没有挂，先看看 AI 怎么说。');
    vault.files.set('文献盒/建议目标.md', '建议目标的正文。');
    let release: (v: unknown) => void = () => {};
    suggestMock.generateSuggestions.mockImplementation(() => new Promise((r) => { release = r; }));
    const pending = open(BARE);
    // 生成中：画布上一个节点都没有（主卡也不画），进度带空板说明
    await vi.waitFor(() => expect(loading().style.display).not.toBe('none'));
    expect(card(BARE)).toBeNull();
    expect(document.querySelectorAll('.bz-kb-mt-node').length).toBe(0);
    expect(loading().classList.contains('is-bare')).toBe(true);
    expect(loading().querySelector('.bz-kb-mt-pempty')!.textContent).toContain('还没有挂载');
    // 建议回来 → 主卡 + 幽灵一起上屏
    release({
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: 8, text: '这张卡一句话都没有挂' }, target: '文献盒/建议目标.md', kind: 'note', reason: '相关', score: 0.8, state: 'pending' },
      ],
    });
    await pending;
    expect(card(BARE)).toBeTruthy();
    expect(card('ai:文献盒/建议目标.md')).toBeTruthy();
    expect(loading().style.display).toBe('none');
  });

  it('空卡首开：建议没出来（降级 / 无关联）→ 照实把这张只有主卡的树画出来', async () => {
    const BARE = '卡片盒/空卡二.md';
    vault.files.set(BARE, '---\ntitle: "空卡二"\n---\n\n同样没有挂载。');
    await open(BARE); // 缺省 stub 返回 { status: 'cached', suggestions: [] }
    expect(card(BARE)!.classList.contains('is-root')).toBe(true);
    expect(loading().style.display).toBe('none');
  });

  it('AI 建议锚点句高亮：正文里那句包进 .bz-kb-mt-anch-hl，圆点落在句末；实体双链不加底纹', async () => {
    const anchorText = '主卡正文一句话';
    vault.files.set('文献盒/建议目标.md', '建议目标的正文。');
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: anchorText.length, text: anchorText }, target: '文献盒/建议目标.md', kind: 'card', reason: '理由', score: 0.82, state: 'pending' },
      ],
    });
    await open(ROOT);
    const body = card(ROOT)!.querySelector<HTMLElement>('.bz-kb-mt-body')!;
    const hl = body.querySelector<HTMLElement>('.bz-kb-mt-anch-hl')!;
    expect(hl).toBeTruthy();
    expect(hl.textContent).toBe(anchorText); // 锚点那句被整句包住
    expect(hl.getAttribute('data-mt-sug')).toBe('1');
    expect(hl.querySelector('.bz-kb-mt-anch')).toBeTruthy(); // 圆点在句末
    // 正文里六条实体双链照旧只有圆点：整篇只有这一处建议底纹
    expect(body.querySelectorAll('.bz-kb-mt-anch-hl').length).toBe(1);
    expect(body.querySelectorAll('.bz-kb-mt-anch').length).toBeGreaterThanOrEqual(6);
  });

  it('锚点句里含双链时的高亮：整句覆盖（跨文本节点也包全），圆点落在句末', async () => {
    // 真机渲染把 [[睡眠纺锤波]] 变成 <a>，锚点句因此被切成「文本 + <a> + 文本」——只在起点节点包 span 会只亮半截
    mockMarkdownRenderer.render.mockImplementation(async (_app: any, md: string, el: HTMLElement) => {
      renderWithLinks(String(md ?? ''), el);
    });
    const anchorText = '深睡集中在头两个周期，睡眠纺锤波 这一段';
    vault.files.set(ROOT, `---\ntitle: "主卡"\n---\n\n${'深睡集中在头两个周期，[[睡眠纺锤波]] 这一段'}，后面还有别的。`);
    vault.files.set('文献盒/建议目标.md', '建议目标的正文。');
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: anchorText.length, text: anchorText }, target: '文献盒/建议目标.md', kind: 'note', reason: '理由', score: 0.82, state: 'pending' },
      ],
    });
    await open(ROOT);
    const body = card(ROOT)!.querySelector<HTMLElement>('.bz-kb-mt-body')!;
    const hls = Array.from(body.querySelectorAll<HTMLElement>('.bz-kb-mt-anch-hl'));
    expect(hls.length).toBeGreaterThanOrEqual(2); // 链接两侧各包一层
    const covered = hls.map((el) => el.textContent).join('');
    expect(covered).toContain('深睡集中在头两个周期');
    expect(covered).toContain('这一段');
    // 圆点在最后一个高亮片段的末尾（正文里还有别的锚点圆点——实体双链各一枚，故按高亮内定位）
    const last = hls[hls.length - 1];
    expect(last.lastElementChild?.className).toContain('bz-kb-mt-anch');
  });

  it('锚点句里含双链时固定：正文一个字不丢（不套别名，退回句中追加）', async () => {
    const anchorText = 'N1/N2 是浅睡，睡眠纺锤波 出现在 N2'; // 清洗后的锚点（双链变显示文本）
    vault.files.set(
      ROOT,
      ['---', 'title: "主卡"', '---', '', '## 分期', '', '- N1/N2 是浅睡，[[睡眠纺锤波]] 出现在 N2', '- N3 又叫慢波睡眠，跟 [[记忆巩固]] 有关系', ''].join('\n'),
    );
    vault.files.set('文献盒/建议目标.md', '建议目标的正文。');
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: anchorText.length, text: anchorText }, target: '文献盒/建议目标.md', kind: 'note', reason: '理由', score: 0.82, state: 'pending' },
      ],
    });
    await open(ROOT);
    fireCtx(card('ai:文献盒/建议目标.md'));
    byAct('pin').click();
    await vi.waitFor(() => expect(said('已固定')).toBe(true));
    const after = vault.files.get(ROOT)!;
    expect(after).toContain('- N3 又叫慢波睡眠，跟 [[记忆巩固]] 有关系'); // 别的段落一个字没丢
    expect(after).toContain('[[睡眠纺锤波]]'); // 原有双链还在
  });

  it('固定套整句：长句锚点走别名替换 `[[目标|原句]]`，不做句末追加', async () => {
    const sentence = '人们在算命时倾向于认为模糊的人格描述精准对应自己';
    vault.files.set(ROOT, `---\ntitle: "主卡"\n---\n\n${sentence}。后面还有别的句子。`);
    vault.files.set('文献盒/建议目标.md', '建议目标的正文。');
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: sentence.length, text: sentence }, target: '文献盒/建议目标.md', kind: 'card', reason: '理由', score: 0.82, state: 'pending' },
      ],
    });
    await open(ROOT);
    fireCtx(card('ai:文献盒/建议目标.md'));
    byAct('pin').click();
    await vi.waitFor(() => expect(said('已固定')).toBe(true));
    expect(vault.files.get(ROOT)!).toContain(`[[文献盒/建议目标|${sentence}]]。后面还有别的句子。`);
    expect(vault.files.get(ROOT)!.startsWith('---\ntitle: "主卡"\n')).toBe(true);
  });

  it('换卡：先清画布再画新卡（建议还在跑也先给真实双链，不留旧卡视图）', async () => {
    await open(ROOT);
    expect(card(ROOT)).toBeTruthy();

    // 建议链路挂住（模拟 40–60s 生成中）：旧口径要等它跑完才清画布，旧卡节点会一直挂着
    let release: (v: unknown) => void = () => {};
    suggestMock.generateSuggestions.mockImplementation(() => new Promise((r) => { release = r; }));
    const pending = open('卡片盒/子卡.md');
    // 建议还在跑：新卡的真实双链已上屏，旧视图（主卡为根的整棵树）整棵被清掉
    await vi.waitFor(() => expect(rootId()).toBe('卡片盒/子卡.md'));
    expect(card('卡片盒/子卡.md')).toBeTruthy();
    expect(card(ROOT)?.classList.contains('is-root')).toBe(false); // 旧卡的「主卡」徽章不再在
    expect((document.getElementById('bz-kb-mt-loading') as HTMLElement).style.display).not.toBe('none'); // 进度还在跑
    release({ status: 'fresh', suggestions: [] });
    await pending;
    // 跑完仍是「以子卡为根」这张树（主卡以子卡的回指出现在树里，但不再是主卡）
    expect(rootId()).toBe('卡片盒/子卡.md');
    expect(card(ROOT)?.classList.contains('is-root')).toBe(false);
  });

  it('重新生成：先二次确认（取消不跑）；确认后画布清空 + 进度，跑完才画', async () => {
    await open(ROOT);
    expect(card(ROOT)).toBeTruthy();

    // ① 取消：不进链路、画布照旧
    flowDialog.openFlowDialog.mockResolvedValueOnce('cancel');
    suggestMock.generateSuggestions.mockClear();
    win().querySelector<HTMLButtonElement>('[data-mt-act="refresh"]')!.click();
    await vi.waitFor(() => expect(flowDialog.openFlowDialog).toHaveBeenCalled());
    expect(suggestMock.generateSuggestions).not.toHaveBeenCalled();
    expect(card(ROOT)).toBeTruthy();

    // ② 确认：清空画布 + 进度 + 空板说明；跑完连同建议一起画（缺省 mock 给 'ok'）
    let release: (v: unknown) => void = () => {};
    suggestMock.generateSuggestions.mockImplementation(() => new Promise((r) => { release = r; }));
    win().querySelector<HTMLButtonElement>('[data-mt-act="refresh"]')!.click();
    await vi.waitFor(() => expect((document.getElementById('bz-kb-mt-loading') as HTMLElement).style.display).not.toBe('none'));
    expect(document.querySelectorAll('.bz-kb-mt-node').length).toBe(0);
    expect(win().querySelector('#bz-kb-mt-pempty')!.textContent).toContain('重新生成中');
    expect(suggestMock.generateSuggestions).toHaveBeenCalledWith(ROOT, expect.anything(), expect.objectContaining({ force: true }));
    release({ status: 'fresh', suggestions: [] });
    await vi.waitFor(() => expect(card(ROOT)).toBeTruthy());
    expect((document.getElementById('bz-kb-mt-loading') as HTMLElement).style.display).toBe('none');
  });

  it('issue 322 进度：onProgress 驱动进度条宽度与阶段文字；链路结束即收起', async () => {
    suggestMock.generateSuggestions.mockImplementation(async (_p: string, _c: unknown, opts: any) => {
      opts?.onProgress?.({ stage: 'query', label: '查询官：为正文片段生成检索查询', done: 2, total: 2 });
      opts?.onProgress?.({ stage: 'locate', label: '定位官：现读全文定粒度（1/3）', done: 1, total: 3 });
      return { status: 'fresh', suggestions: [] };
    });
    await open(ROOT);
    const bar = document.getElementById('bz-kb-mt-pbar') as HTMLElement;
    const stage = document.getElementById('bz-kb-mt-pstage') as HTMLElement;
    expect(stage.textContent).toBe('定位官：现读全文定粒度（1/3）');
    const w = parseInt(bar.style.width, 10);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(100);
    // 链路结束 → 进度遮罩收起（不留常驻「生成中」）
    expect((document.getElementById('bz-kb-mt-loading') as HTMLElement).style.display).toBe('none');
  });

  it('ADR-0140 幽灵正文 = 现读单元原文（小节）+ 理由（长文不受索引截断影响）', async () => {
    const target = '文献盒/小节目标.md';
    vault.files.set(target, '# 总则\n\n总述一段。\n\n## 巴纳姆效应\n\n人们倾向于认为模糊描述精准对应自己，这是关键句。\n\n## 其它\n\n其它内容。');
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        {
          anchor: { from: 0, to: 6, text: '主卡正文一句话' },
          target,
          kind: 'head',
          reason: '小节相关',
          score: 0.9,
          state: 'pending',
          unit: 'heading',
          heading: '巴纳姆效应',
          subpath: '巴纳姆效应',
        },
      ],
    });
    await open(ROOT);
    const body = card(`ai:${target}#${suggestionId({ target, subpath: '巴纳姆效应' }).split('#')[1]}`)?.querySelector('.bz-kb-mt-body');
    expect(body?.textContent).toContain('小节相关'); // 理由
    expect(body?.textContent).toContain('人们倾向于认为模糊描述精准对应自己'); // 该小节原文
    expect(body?.textContent).not.toContain('其它内容。'); // 不是整篇
  });

  it('ADR-0140 固定三形态：标题写 [[路径#标题]]；段落先补 ^bz- 块 id 再写 [[路径#^块id]]', async () => {
    const target = '文献盒/小节目标.md';
    const quote = '人们倾向于认为模糊描述精准对应自己，这是关键句。';
    vault.files.set(target, `# 总则\n\n总述一段。\n\n## 巴纳姆效应\n\n${quote}\n\n## 其它\n\n其它内容。`);
    // 2026-09-15 起长句锚点同样走别名套句（`[[目标#子路径|原句]]`），形态只由 unit 决定
    const anchorText = '人们在算命时倾向于认为模糊的人格描述精准对应自己';
    vault.files.set(ROOT, `---\ntitle: "主卡"\n---\n\n${anchorText}，这是主卡的句子。`);

    // ① 标题形态
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        {
          anchor: { from: 0, to: anchorText.length, text: anchorText },
          target,
          kind: 'head',
          reason: '小节相关',
          score: 0.9,
          state: 'pending',
          unit: 'heading',
          heading: '巴纳姆效应',
          subpath: '巴纳姆效应',
        },
      ],
    });
    await open(ROOT, { force: true });
    fireCtx(card(suggestionId({ target, subpath: '巴纳姆效应' })));
    byAct('pin').click();
    await vi.waitFor(() => expect(vault.files.get(ROOT)!).toContain(`[[文献盒/小节目标#巴纳姆效应|${anchorText}]]`));
    expect(said(`正文写入 [[文献盒/小节目标#巴纳姆效应|${anchorText}]]`)).toBe(true);
    expect(vault.files.get(target)!).not.toContain('^bz-'); // 标题形态不动目标文件

    // ② 段落形态（换一个目标：① 已固定的目标进了真实双链，不会再被当建议推）
    const target2 = '文献盒/段落目标.md';
    vault.files.set(target2, `# 总则\n\n总述一段。\n\n## 巴纳姆效应\n\n${quote}\n\n## 其它\n\n其它内容。`);
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        {
          anchor: { from: 0, to: anchorText.length, text: anchorText },
          target: target2,
          kind: 'para',
          reason: '段落相关',
          score: 0.9,
          state: 'pending',
          unit: 'paragraph',
          quote,
        },
      ],
    });
    await open(ROOT, { force: true });
    fireCtx(card(suggestionId({ target: target2, quote })));
    byAct('pin').click();
    await vi.waitFor(() => expect(vault.files.get(ROOT)!).toContain(`[[文献盒/段落目标#^bz-`));
    expect(vault.files.get(ROOT)!).toContain(`|${anchorText}]]`); // 段落形态同样别名套句
    expect(vault.files.get(target2)!).toContain('^bz-'); // 块 id 挂在段落尾
    expect(vault.files.get(target2)!).toContain(`${quote} ^bz-`); // 块 id 挂在段落尾（原文不动）
  });

  it('固定幂等：正文里已经有该双链时不谎报写入（提示只留档，且不重复插一条）', async () => {
    vault.files.set('文献盒/建议目标.md', '建议目标的正文。');
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'fresh',
      suggestions: [
        { anchor: { from: 0, to: 8, text: '主卡正文一句话' }, target: '文献盒/建议目标.md', kind: 'card', reason: '理由', score: 0.8, state: 'pending' },
      ],
    });
    await open(ROOT);
    // 白板开着时用户自己把双链写进正文了 → 固定动作落到幂等早退分支
    vault.files.set(ROOT, vault.files.get(ROOT)!.replace('主卡正文一句话', '主卡正文一句话 [[文献盒/建议目标]]'));
    fireCtx(card('ai:文献盒/建议目标.md'));
    byAct('pin').click();
    await vi.waitFor(() => expect(said('已固定')).toBe(true));
    expect(said('本次只留档')).toBe(true);
    expect(said('正文写入')).toBe(false);
    expect(vault.files.get(ROOT)!.match(/\[\[文献盒\/建议目标\]\]/g)!.length).toBe(1);
  });

  it('建议目标已不在库里（缓存命中的残留）→ 渲染层复核存在性，画成灰节点', async () => {
    suggestMock.generateSuggestions.mockResolvedValue({
      status: 'cached',
      suggestions: [
        { anchor: { from: 0, to: 4, text: '主卡正文' }, target: '文献盒/已删除.md', kind: 'card', reason: '旧缓存', score: 0.9, state: 'pending' },
      ],
    });
    await open(ROOT);
    const ghost = card('ai:文献盒/已删除.md')!;
    expect(ghost.className).toContain('is-missing');
    expect(ghost.querySelector('.bz-kb-mt-ph')).toBeTruthy();
  });

  /* ==================== 面包屑与方向 ==================== */

  it('面包屑：选中卡片出「主卡 › 当前」链，点面包屑换根重开', async () => {
    await open(ROOT);
    clickCard('卡片盒/子卡.md');
    const crumbs = (): string[] =>
      Array.from(document.querySelectorAll('#bz-kb-mt-crumbs .bz-kb-mt-crumb')).map((c) => c.textContent || '');
    expect(crumbs()).toEqual(['主卡', '子卡']);

    (document.querySelector('#bz-kb-mt-crumbs [data-mt-act=crumb][data-id="卡片盒/子卡.md"]') as HTMLElement).click();
    await vi.waitFor(() => expect(rootId()).toBe('卡片盒/子卡.md'));
    expect(mountTreeRoot()).toBe('卡片盒/子卡.md');
    expect(crumbs()).toEqual(['子卡']); // 换根后选中态清空
  });

  it('选中态下点链首面包屑（= 当前主卡）：清掉选中态，不重开（点了要有反应）', async () => {
    await open(ROOT);
    clickCard('卡片盒/子卡.md');
    expect(card('卡片盒/子卡.md')!.className).toContain('is-sel');
    const first = document.querySelector('#bz-kb-mt-crumbs [data-mt-act=crumb][data-id="卡片盒/主卡.md"]');
    expect(first).toBeTruthy();
    (first as HTMLElement).click();
    expect(win().querySelectorAll('.bz-kb-mt-node.is-sel').length).toBe(0);
    expect(win().querySelectorAll('.bz-kb-mt-node.is-dim').length).toBe(0);
    expect(mountTreeRoot()).toBe(ROOT);
  });

  it('方向翻转：右键「看谁挂了我」→ 换根并翻向上游，顶栏方向常显', async () => {
    await open(ROOT);
    const dir = (): HTMLElement => document.querySelector('.bz-kb-mt-dir')!;
    expect(dir().textContent).toContain('下游');
    expect(dir().getAttribute('data-mt-dir')).toBe('downstream');

    fireCtx(card('卡片盒/子卡.md'));
    byAct('who').click();
    await vi.waitFor(() => expect(dir().getAttribute('data-mt-dir')).toBe('upstream'));
    expect(dir().textContent).toContain('上游');
    expect(mountTreeRoot()).toBe('卡片盒/子卡.md');
    expect(mountTreeDirection()).toBe('upstream');
    // 上游树：主卡作为「谁挂了它」的挂载方出现在图上（渐进呈现：树一建完就上屏）
    await vi.waitFor(() => expect(card(ROOT)).toBeTruthy());
    expect(win().querySelectorAll('.bz-kb-mt-edge').length).toBeGreaterThan(0);
  });

  /* ==================== 降级 ==================== */

  it('缺索引（no-index）：只画双链 + 顶栏提示 + 「去建索引」入口；绝不自动建索引', async () => {
    suggestMock.generateSuggestions.mockResolvedValue({ status: 'no-index', suggestions: [] });
    await open(ROOT);
    expect(document.querySelector('.bz-kb-mt-status')!.textContent).toContain('未建向量索引');
    expect(win().querySelectorAll('.bz-kb-mt-node.is-ghost').length).toBe(0);
    expect(win().querySelectorAll('.bz-kb-mt-edge.is-sug').length).toBe(0);
    expect(win().querySelectorAll('.bz-kb-mt-edge').length).toBe(7); // 双链照画

    expect(executeCommandById).not.toHaveBeenCalled(); // 打开白板不自动建索引
    (document.querySelector('[data-mt-act=build-index]') as HTMLElement).click();
    expect(executeCommandById).toHaveBeenCalledWith('bz-secondbrain-rebuild-index');
  });

  it('AI 不可用（no-ai）：照常开板、只画双链，顶栏给降级文案', async () => {
    suggestMock.generateSuggestions.mockResolvedValue({ status: 'no-ai', suggestions: [] });
    await open(ROOT);
    expect(document.querySelector('.bz-kb-mt-status')!.textContent).toContain('AI 不可用');
    expect(win().querySelectorAll('.bz-kb-mt-edge').length).toBe(7);
  });

  it('开关关闭（knowledgeMountAutoSuggest=false）：不调建议链路，顶栏明说已关闭', async () => {
    settings.knowledgeMountAutoSuggest = false;
    await open(ROOT);
    expect(suggestMock.generateSuggestions).not.toHaveBeenCalled();
    expect(document.querySelector('.bz-kb-mt-status')!.textContent).toContain('自动建议已关闭');
    expect(win().querySelectorAll('.bz-kb-mt-edge').length).toBe(7);
  });

  it('大图降级：>120 节点被 culled（不渲染、无坐标），白板照常显示且路径无 NaN', async () => {
    vault.files.delete('文献盒/主卡.md');
    const links: string[] = [];
    for (let i = 0; i < 124; i++) {
      vault.files.set(`卡片盒/卡${i}.md`, `卡${i} 正文。`);
      links.push(`[[卡${i}]]`);
    }
    vault.files.set(ROOT, `---\ntitle: "主卡"\n---\n\n${links.join('，')}。`);
    await open(ROOT);

    const nodes = Array.from(win().querySelectorAll<HTMLElement>('.bz-kb-mt-node'));
    expect(nodes.length).toBeGreaterThan(120);
    const shown = nodes.filter((n) => n.style.display !== 'none');
    const culled = nodes.filter((n) => n.style.display === 'none');
    expect(culled.length).toBeGreaterThan(0);
    expect(culled.length).toBe(nodes.length - 120); // 布局上限 120
    for (const n of shown) {
      expect(Number.isFinite(Number.parseFloat(n.style.left))).toBe(true);
      expect(Number.isFinite(Number.parseFloat(n.style.top))).toBe(true);
    }
    expect(document.querySelector('.bz-kb-mt-status')!.textContent).toContain('封顶');
    const paths = Array.from(win().querySelectorAll('.bz-kb-mt-edge'));
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(p.getAttribute('d') || '').not.toContain('NaN');
  });

  /* ==================== 移动端 / 缩放器 ==================== */

  it('移动端：窗口挂 .bz-panel-mtop 真全屏；长按卡片出菜单', async () => {
    (Platform as any).isMobile = true;
    await open(ROOT);
    expect(win().className).toContain('bz-panel-mtop');
    expect(win().querySelector('.bz-kb-mt-close')).toBeTruthy();

    const child = card('卡片盒/子卡.md')!;
    vi.useFakeTimers();
    child.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(600);
    vi.useRealTimers();
    expect(document.querySelector('#bz-kb-mt-ctx')).toBeTruthy();
    closeMountTree();
    expect(document.getElementById('bz-kb-mt-ctx')).toBeNull();
  });

  it('缩放器三键：＋ 放大 / − 缩小 / ⟲ 回到适应窗口', async () => {
    await open(ROOT);
    const scale = (): number => {
      const m = /scale\(([\d.]+)\)/.exec(document.getElementById('bz-kb-mt-world')!.style.transform || '');
      return m ? Number(m[1]) : Number.NaN;
    };
    const base = scale();
    expect(base).toBeGreaterThan(0);
    (document.querySelector('[data-mt-act=zoom-in]') as HTMLElement).click();
    const zoomed = scale();
    expect(zoomed).toBeGreaterThan(base);
    (document.querySelector('[data-mt-act=zoom-out]') as HTMLElement).click();
    expect(scale()).toBeLessThan(zoomed);
    (document.querySelector('[data-mt-act=zoom-fit]') as HTMLElement).click();
    expect(scale()).toBeCloseTo(base, 5);
  });

  it('destroyMountTree：菜单开着时卸载也清干净（不留菜单与「点外关闭」监听）', async () => {
    await open(ROOT);
    fireCtx(card(ROOT));
    expect(document.getElementById('bz-kb-mt-ctx')).toBeTruthy();
    destroyMountTree();
    expect(document.getElementById('bz-kb-mt-ctx')).toBeNull();
    expect(document.getElementById('bz-kb-mt-mask')).toBeNull();
    expect(document.getElementById('bz-kb-mt-window')).toBeNull();
    expect(mountTreeOpen()).toBe(false);
  });

  /* ==================== 入口（317/319 三步可达） ==================== */

  it('入口：卡片列表行与卡片预览弹层各一粒「看挂载树」，都开同一张白板', async () => {
    noteGen.backfillNotes.mockResolvedValue({ scanned: 0, filled: 0, aiSkipped: false });
    const ui = new UIManager(app);
    try {
      ui.showMain();
      await vi.waitFor(() => expect(document.getElementById('knowledge-popup')!.style.display).toBe('flex'));
      // 部壹先落定（首屏 refresh 是在途异步，抢跑会被它回写覆盖成文献行）
      await vi.waitFor(() => expect(document.querySelectorAll('.bz-kb-lexrow[data-kb-act=lit-peek]').length).toBeGreaterThan(0));
      (document.querySelector('[data-kb-act=part][data-part=z2]') as HTMLElement).click();
      const cardRow = (): HTMLElement | null =>
        document.querySelector<HTMLElement>(`.bz-kb-lexrow[data-kb-act=card-peek][data-path="${ROOT}"]`);
      await vi.waitFor(() => expect(cardRow()).toBeTruthy());
      expect(cardRow()!.querySelector('[data-kb-act=mount-tree]')).toBeTruthy();

      // ① 卡片列表行那粒
      (cardRow()!.querySelector('[data-kb-act=mount-tree]') as HTMLElement).click();
      await vi.waitFor(() => expect(mountTreeOpen()).toBe(true));
      await vi.waitFor(() => expect(rootId()).toBe(ROOT)); // 载入结算完再关，别把在途载入漏给下一个用例
      expect(mountTreeRoot()).toBe(ROOT);
      closeMountTree();

      // ② 卡片预览弹层那粒（预览留在下层，白板关掉后回到知识盒主窗）
      cardRow()!.click();
      await vi.waitFor(() => expect(document.querySelector('.bz-kb-ovl')).toBeTruthy());
      const btn = document.querySelector('.bz-kb-ovl [data-kb-act=mount-tree]') as HTMLElement;
      expect(btn).toBeTruthy();
      btn.click();
      await vi.waitFor(() => expect(mountTreeOpen()).toBe(true));
      await vi.waitFor(() => expect(rootId()).toBe(ROOT));
      expect(mountTreeRoot()).toBe(ROOT);
      expect(document.querySelector('.bz-kb-ovl')).toBeTruthy(); // 主窗与预览仍在
    } finally {
      ui.destroy();
    }
  });

  it('命令：bz-knowledge-mount-tree（主卡 = 当前打开的笔记；无打开笔记只提示）/ bz-knowledge-mount-refresh', async () => {
    const registered: any[] = [];
    const diskData: Record<string, any> = {};
    const pluginApp = { ...app, commands: { ...app.commands, addCommand: (c: any) => registered.push(c), removeCommand: () => {} } };
    pluginApp.workspace = { ...app.workspace, onLayoutReady: () => {}, on: () => ({ ref: 'ref' }) };
    const plugin: any = new BzPlugin(pluginApp, {} as any);
    plugin.app = pluginApp;
    plugin.loadData = async () => diskData['bz'] ?? null;
    plugin.saveData = async (d: any) => {
      diskData['bz'] = d;
    };
    await plugin.onload();
    try {
      expect(registered.map((c) => c.id)).toContain('bz-knowledge-mount-tree');
      const cmd = registered.find((c) => c.id === 'bz-knowledge-mount-tree');
      const refresh = registered.find((c) => c.id === 'bz-knowledge-mount-refresh');
      expect(cmd.name).toBe('看挂载树');
      expect(cmd.icon).toBe('network');
      expect(refresh.icon).toBe('refresh-cw');

      cmd.callback();
      await vi.waitFor(() => expect(rootId()).toBe(ROOT)); // 渲染完成（不是只等 mask 可见）
      await vi.waitFor(() => expect(suggestMock.generateSuggestions).toHaveBeenCalled()); // 建议链路已起跑
      expect(mountTreeRoot()).toBe(ROOT);
      closeMountTree();

      // 无打开笔记：只提示、不开板（先把上一步的在途链路清零，断言才是确定性的）
      suggestMock.generateSuggestions.mockClear();
      pluginApp.workspace.getActiveFile = () => null;
      clearNotices();
      cmd.callback();
      expect(hasNotice('看挂载树：先打开一张笔记，它会作为主卡')).toBe(true);
      expect(mountTreeOpen()).toBe(false);

      // 重跑建议：没开白板 → 提示（等通知落地，再看建议链路确实没被调用）
      clearNotices();
      refresh.callback();
      await vi.waitFor(() => expect(hasNotice('重跑挂载建议：先打开一张挂载树白板')).toBe(true));
      expect(mountTreeOpen()).toBe(false);
      expect(suggestMock.generateSuggestions).not.toHaveBeenCalled();

      // 同一张卡再开一次 = 抬层（不重跑建议）；要重跑走 refresh 命令
      pluginApp.workspace.getActiveFile = () => ({ path: ROOT, extension: 'md' });
      cmd.callback();
      await vi.waitFor(() => expect(mountTreeOpen()).toBe(true));
      await vi.waitFor(() => expect(rootId()).toBe(ROOT));
      expect(suggestMock.generateSuggestions).not.toHaveBeenCalled();

      // 重跑：force 重跑当前主卡（321 起第三个参数还带 onProgress 回调，故用 objectContaining）
      refresh.callback();
      await vi.waitFor(() =>
        expect(suggestMock.generateSuggestions).toHaveBeenCalledWith(
          ROOT,
          expect.anything(),
          expect.objectContaining({ force: true }),
        )
      );
    } finally {
      await plugin.onunload();
    }
  });
});
