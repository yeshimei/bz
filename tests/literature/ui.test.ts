/**
 * 文献盒（literature 域）UI 测试（ticket 136 改版 + ticket 138 UX 修复）：
 * - 主面板（文献笔记列表）：标题/头部五按钮（emoji、🔍 在 ⚙️ 前，ticket 138 §3.1）/领域筛选行
 *   （类型分类栏已移除）/空态、卡片渲染（标题+领域徽标+简介+日期[formatRelativeTime 相对显示，ticket 146]，
 *   无类型徽章 ticket 138 §3.2）与
 *   最近创建降序、🔍 搜索 300ms 防抖、领域筛选、双击打开（click 计数 300ms）、
 *   抽屉（打开/复制双链/复制原文链接[video]/删除 danger+确认，删除同步清理指向该笔记的任务记录）、
 *   懒加载（批次 20 + 触底 + 尾部提示）、literature:file-* 四通道 300ms 防抖增量刷新、
 *   文献目录设置变更清缓存全量重载。
 * - 视频录入面板（任务队列）：去 ⚙️/⬇️ 与独立 ⏹ 终止钮；单钮态机 ➕/**纯 emoji ▶️ ↔ ⏹**（ticket 146 单钮态机 + ticket 148 按钮去文字，区分移到 title hover）/🕘/✕；
 *   移动端仅 ➕+✕；添加弹窗（校验/编辑回填/预填叠开）、历史独立弹窗（分组/清空历史）、批量处理行内进度
 *   （[bz-step]/[bz-p] 时间线 + STEP_DONE_MAP「AI 生成文献笔记中/笔记落盘中」完成态文案）。
 * - 术语生成面板（ticket 138 §2.1 契约变更 + ticket 142 简洁版 + ticket 155 自动生成/总结）：
 *   预填即自动生成（带词入口）/空术语不生成/生成纯 AI 预览（mock note-gen generateTermDraft，未确认不落盘）/
 *   生成后输入行按钮变「重新生成」/预览只读（无领域/正文输入框，上属性卡下内容卡，
 *   断言无 title/label/placeholder/状态行/textarea）/底部按钮「总结」AI 精简回填（mock summarizeTermSummary）/
 *   确认写入（generateTermNote 落盘一次 + 按面板预览值 + 自动打开 + term-generated 事件）/无预览直接确认
 *   提示先生成/AI 未配置提示。
 * - 设置 schema 五组键；主面板 ⚙️ 打开设置弹窗渲染。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { Platform } from 'obsidian';
import { UIManager, literatureSettingsSchema } from '../../src/literature/ui';
import { LiteratureData } from '../../src/literature/data';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { emitDomainEvent, onDomainEvent } from '../../src/core/domain-bus';
import { formatRelativeTime } from '../../src/core/utils';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, getNoticeMessages, hasNotice, resetObsidianMocks } from '../mock-obsidian-entry';

// ---- note-gen 打桩：generateTermNote/generateTermDraft/summarizeTermSummary/backfillNotes 由各用例注入实现，避免真实 AI ----
const noteGen = vi.hoisted(() => ({
  generateTermNote: vi.fn(),
  generateTermDraft: vi.fn(),
  summarizeTermSummary: vi.fn(),
  backfillNotes: vi.fn(),
}));
vi.mock('../../src/literature/note-gen', () => noteGen);

function strNotices(): string {
  return getNoticeMessages().join('\n');
}

/** 构造带 frontmatter 的文献笔记 markdown（title/type/domain/summary/date/url） */
function noteMd(opts: { title: string; type?: string; domain?: string; date?: string; summary?: string; url?: string }) {
  const lines = ['---', `title: "${opts.title}"`];
  if (opts.type) lines.push(`type: ${opts.type}`);
  if (opts.domain) lines.push(`domain: "${opts.domain}"`);
  lines.push(`summary: "${opts.summary ?? '一段简介'}"`);
  lines.push(`date: "${opts.date ?? '2026-08-01 10:00:00'}"`);
  if (opts.url) lines.push(`url: "${opts.url}"`);
  lines.push('---');
  return lines.join('\n') + '\n\n正文…' + opts.title;
}

function makeApp(vault: MockVault) {
  const openFile = vi.fn();
  const base = mockAppWithVault(vault) as any;
  base.workspace = { ...base.workspace, getLeaf: () => ({ openFile }) };
  base.openUrl = vi.fn();
  setApp(base);
  return { app: base, openFile };
}

const BASE_SETTINGS: Record<string, any> = {
  literatureDirectory: '文献盒',
  literatureDomainList: '',
  literatureMobileDefaultFullscreen: false,
  literatureProgressDetail: true,
  literatureKeepVideo: true,
  literatureQuality: 'highest',
  literatureStopOnFailure: false,
  literatureOutputDir: '',
  literatureCompress: true,
  literatureCrf: 23,
  literatureFfmpegPath: 'ffmpeg',
  literatureFfprobePath: 'ffprobe',
  literaturePythonPath: '',
  literatureWhisperModel: 'small',
  literatureCacheDir: '',
  literatureCacheRetentionDays: 7,
};

describe('文献盒 UI（ticket 136）', () => {
  let vault: MockVault;
  let openFile: ReturnType<typeof vi.fn>;
  let app: any;
  let ui: UIManager;
  let settings: Record<string, any>;
  let clipWrite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    vault = new MockVault();
    ({ app, openFile } = makeApp(vault));
    LiteratureData.init({ storagePath: 'CONFIG/STORAGE' });
    clearNotices();
    settings = { ...BASE_SETTINGS };
    setSettingsProvider(() => settings as any);
    setSettingsSaver(async () => {});
    clipWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipWrite }, configurable: true });
    noteGen.generateTermNote.mockReset();
    noteGen.generateTermDraft.mockReset();
    noteGen.summarizeTermSummary.mockReset();
    noteGen.backfillNotes.mockReset();
    noteGen.generateTermDraft.mockResolvedValue({ summary: '', domain: '' });
    noteGen.summarizeTermSummary.mockResolvedValue('精简版简介');
    noteGen.backfillNotes.mockResolvedValue({ scanned: 0, filled: 0, aiSkipped: false });
    ui = new UIManager(app);
  });

  afterEach(() => {
    ui.destroy();
    (Platform as any).isMobile = false;
    document.body.innerHTML = '';
  });

  // ==================== 主面板：结构与空态 ====================

  it('showMain 渲染主面板：标题文献盒（ticket 143 拍板保留）/头部五按钮（emoji、功能→🔍→⚙️→✕）/领域筛选行/空态', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.getElementById('literature-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('literature-popup')!;
    // ticket 143：主面板保留原标题（用户拍板）——bz-win-head「文献盒」+ 动作钮；chips 筛选行仍在下独立成行
    expect(popup.querySelector('.bz-win-head h3')!.textContent).toBe('文献盒');
    // 头部按钮秩序：📝文字 → 🎬视频 → 🔍搜索 → ⚙️设置 → ✕关闭（ticket 138 §3.1：emoji、🔍 在 ⚙️ 前）
    const btns = Array.from(popup.querySelectorAll<HTMLElement>('.bz-lit-head-btns button')).map((b) => b.id);
    expect(btns).toEqual(['lit-btn-text', 'lit-btn-video', 'lit-btn-search', 'lit-btn-settings', 'lit-btn-close']);
    expect((popup.querySelector('#lit-btn-text') as HTMLElement).textContent).toBe('📝');
    expect((popup.querySelector('#lit-btn-video') as HTMLElement).textContent).toBe('🎬');
    expect((popup.querySelector('#lit-btn-search') as HTMLElement).textContent).toBe('🔍');
    expect((popup.querySelector('#lit-btn-settings') as HTMLElement).textContent).toBe('⚙️');
    expect(popup.querySelector('#lit-btn-close')!.classList.contains('bz-win-close')).toBe(true);
    // 类型分类栏已移除（ticket 138 §3.1），仅保留领域筛选行
    expect(popup.querySelector('#literature-typebar')).toBeNull();
    expect(popup.querySelector('#literature-sitebar')).toBeTruthy();
    // 搜索框无 placeholder（简洁版：盒内 🔍 图标自明，ticket 143）
    expect((document.getElementById('literature-search-input') as HTMLInputElement).placeholder).toBe('');
    await vi.waitFor(() => expect(document.getElementById('literature-list')!.textContent).toContain('还没有文献笔记'));
  });

  it('主面板列表：标题 + 领域徽标（无类型徽章）+ 简介 + 日期，最近创建降序', async () => {
    vault.files.set('文献盒/视频A.md', noteMd({ title: '视频A', type: 'video', domain: '物理', date: '2026-08-30 10:00:00', summary: '简介A' }));
    vault.files.set('文献盒/术语B.md', noteMd({ title: '术语B', type: 'term', domain: '数学', date: '2026-08-28 10:00:00', summary: '简介B' }));
    vault.files.set('文献盒/视频C.md', noteMd({ title: '视频C', type: 'video', domain: '物理', date: '2026-09-01 10:00:00', summary: '简介C' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(3));
    const titles = Array.from(document.querySelectorAll('.bz-lit-card-title')).map((el) => el.textContent);
    expect(titles).toEqual(['视频C', '视频A', '术语B']); // 最近创建降序
    const first = document.querySelector('.bz-lit-card')!;
    // 类型徽章（视频/术语）不再渲染（ticket 138 §3.2），领域徽章保留
    expect(first.querySelector('.bz-lit-badge-type')).toBeNull();
    expect(first.querySelector('.bz-lit-badge-domain')!.textContent).toBe('物理');
    expect(first.textContent).toContain('简介C');
    // ticket 146：日期用 BZ 相对时间函数（输出与 formatRelativeTime 同参数一致）
    expect(first.querySelector('.bz-lit-card-date')!.textContent).toBe(formatRelativeTime('2026-09-01 10:00:00'));
  });

  it('主面板日期（ticket 146）：formatRelativeTime 相对显示；空日期不显示、无效日期回退原文', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: 'A', date: '2026-09-01 10:00:00' }));
    vault.files.set('文献盒/B.md', '---\ntitle: B\nsummary: "无日期"\n---\n\n正文');
    vault.files.set('文献盒/C.md', noteMd({ title: 'C', date: '不是日期' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(3));
    const dateOf = (marker: string) =>
      Array.from(document.querySelectorAll('.bz-lit-card'))
        .find((c) => c.textContent!.includes(marker))!
        .querySelector('.bz-lit-card-date')!.textContent!;
    expect(dateOf('A')).toBe(formatRelativeTime('2026-09-01 10:00:00'));
    expect(dateOf('无日期')).toBe('');
    expect(dateOf('C')).toBe('不是日期');
  });

  it('嵌套子目录笔记也显示（扫描口径与 backfillNotes 一致，P3-5）', async () => {
    vault.files.set('文献盒/物理课/量子.md', noteMd({ title: '量子', type: 'term', domain: '物理', date: '2026-08-02 10:00:00' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(1));
    expect(document.querySelector('.bz-lit-card')!.textContent).toContain('量子');
  });

  it('领域筛选行：全部 (N) + 各领域按钮带数量，按 count 降序；点击筛选/回退', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: 'A', type: 'video', domain: '物理' }));
    vault.files.set('文献盒/B.md', noteMd({ title: 'B', type: 'video', domain: '数学' }));
    vault.files.set('文献盒/C.md', noteMd({ title: 'C', type: 'term', domain: '物理' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(3));
    const bar = document.getElementById('literature-sitebar')!;
    expect(bar.textContent).toContain('全部 (3)');
    const domainBtns = Array.from(bar.querySelectorAll<HTMLElement>('button'));
    // 物理 2 条在前（count 降序），数学 1 条在后
    expect(domainBtns[1].textContent).toBe('物理 (2)');
    expect(domainBtns[2].textContent).toBe('数学 (1)');
    // 领域筛选：物理 → 2 条（A 与 C 同属物理，B 数学被排除）
    domainBtns[1].click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(2));
    const listTxt = document.getElementById('literature-list')!.textContent!;
    expect(listTxt).toContain('A');
    expect(listTxt).toContain('C');
    expect(listTxt).not.toContain('数学'); // B 被领域筛选排除
    // 回到全部（类型分类栏已移除，ticket 138 §3.1；领域筛选独立成立）
    domainBtns[0].click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(3));
    // 高亮同步回归（applyFilter 内 rebuildDomainBar）：切回「全部」后 active 必须回到全部按钮
    const bar2 = document.getElementById('literature-sitebar')!;
    const btns2 = Array.from(bar2.querySelectorAll<HTMLElement>('button'));
    expect(btns2[0].classList.contains('active')).toBe(true); // 全部高亮
    expect(btns2[1].classList.contains('active')).toBe(false); // 物理不再高亮
    // 再次点物理 → 高亮切到物理；再点物理（已选中）→ 回退全部
    btns2[1].click();
    await vi.waitFor(() => expect(bar2.querySelectorAll('button')[1].classList.contains('active')).toBe(true));
    bar2.querySelectorAll('button')[1].click();
    await vi.waitFor(() => expect(bar2.querySelectorAll('button')[0].classList.contains('active')).toBe(true));
  });

  it('🔍 搜索：切换显隐 + 300ms 防抖按标题/简介过滤', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: '黑洞', date: '2026-08-02 10:00:00' }));
    vault.files.set('文献盒/B.md', noteMd({ title: '贝叶斯', summary: '概率论方法', date: '2026-08-01 10:00:00' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(2));
    // 搜索框默认隐藏，🔍 打开
    const container = document.getElementById('literature-search-container')!;
    expect(container.style.display).toBe('none');
    (document.getElementById('lit-btn-search') as HTMLButtonElement).click();
    expect(container.style.display).toBe('block');
    const input = document.getElementById('literature-search-input') as HTMLInputElement;
    // 标题命中
    input.value = '黑洞';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(1));
    expect(document.querySelector('.bz-lit-card')!.textContent).toContain('黑洞');
    // 简介命中（前一步过滤后已是 1 张卡，须等内容变化而非卡片数量——防抖 300ms 后才生效）
    input.value = '概率论';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(document.querySelector('.bz-lit-card')!.textContent).toContain('贝叶斯'));
    // 无结果空态
    input.value = '不存在的词';
    input.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(document.getElementById('literature-list')!.textContent).toContain('没有符合条件的文献笔记'));
    // 再次点 🔍 收起：清空关键字恢复全部
    (document.getElementById('lit-btn-search') as HTMLButtonElement).click();
    expect(container.style.display).toBe('none');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(2));
  });

  it('双击卡片打开笔记（click 计数 300ms，单击不打开）', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: 'A' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelector('.bz-lit-card')).toBeTruthy());
    const card = document.querySelector('.bz-lit-card') as HTMLElement;
    card.click();
    expect(openFile).not.toHaveBeenCalled();
    card.click(); // 300ms 内第二次 → 打开
    expect(openFile).toHaveBeenCalledTimes(1);
  });

  // ==================== 主面板：抽屉与删除联动 ====================

  it('抽屉（桌面右键）：打开/复制双链/复制原文链接[video]/删除；术语笔记无原文链接', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: '视频A', type: 'video', domain: '物理', url: 'https://www.bilibili.com/video/BV1xx411c7mD' }));
    vault.files.set('文献盒/T.md', noteMd({ title: '术语T', type: 'term', domain: '数学' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(2));
    // 视频卡片
    (document.querySelectorAll('.bz-lit-card')[0] as HTMLElement).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    let menu = document.querySelector('.bz-item-menu')!;
    let menuText = menu.textContent!;
    expect(menuText).toContain('打开');
    expect(menuText).toContain('复制双链');
    expect(menuText).toContain('复制原文链接');
    expect(menuText).toContain('删除');
    // 复制双链
    const linkItem = Array.from(menu.querySelectorAll<HTMLElement>('.bz-item-menu-item')).find((el) => el.textContent!.includes('复制双链'))!;
    linkItem.click();
    await vi.waitFor(() => expect(clipWrite).toHaveBeenCalled());
    expect(String(clipWrite.mock.calls[0][0])).toContain('[[文献盒/A.md|视频A]]');
    // 复制原文链接
    clipWrite.mockClear();
    (document.querySelectorAll('.bz-lit-card')[0] as HTMLElement).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    menu = document.querySelector('.bz-item-menu')!;
    const urlItem = Array.from(menu.querySelectorAll<HTMLElement>('.bz-item-menu-item')).find((el) => el.textContent!.includes('复制原文链接'))!;
    urlItem.click();
    await vi.waitFor(() => expect(clipWrite).toHaveBeenCalled());
    expect(String(clipWrite.mock.calls[0][0])).toContain('BV1xx411c7mD');
    // 术语卡片：无「复制原文链接」
    (document.querySelectorAll('.bz-lit-card')[1] as HTMLElement).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    menuText = document.querySelector('.bz-item-menu')!.textContent!;
    expect(menuText).not.toContain('复制原文链接');
  });

  it('删除笔记（抽屉 danger + 确认）：删除文件 + 同步清理 literature.json 指向它的任务记录', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: '视频A', type: 'video', domain: '物理' }));
    const t = await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
    await LiteratureData.updateTask(t.id, { status: 'success', notePath: '文献盒/A.md' } as any);
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelector('.bz-lit-card')).toBeTruthy());
    (document.querySelector('.bz-lit-card') as HTMLElement).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
    const delItem = Array.from(document.querySelectorAll<HTMLElement>('.bz-item-menu-item')).find((el) => el.textContent!.includes('删除'))!;
    delItem.click();
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_ok__')).toBeTruthy());
    // 走查批 D：三段式标题（非问句）+ 正文无英文 vault
    expect(document.body.textContent).toContain('删除文献笔记');
    expect(document.body.textContent).not.toContain('从 vault 删除');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(vault.files.has('文献盒/A.md')).toBe(false));
    const tasks = await LiteratureData.loadTasks();
    expect(tasks).toHaveLength(0); // 指向该笔记的任务记录同步清理（避免悬挂 notePath）
  });

  // ==================== 主面板：懒加载 / 自动刷新 / 目录变更 ====================

  it('懒加载：首批 20 条，scroll 触底（50px 阈值）批次加载到 25，尾部「已显示所有笔记」', async () => {
    for (let i = 0; i < 25; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      vault.files.set(`文献盒/N${i}.md`, noteMd({ title: `笔记${i}`, date: `2026-08-${day} 10:00:00` }));
    }
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(20));
    expect(document.getElementById('literature-list')!.textContent).not.toContain('已显示所有笔记');
    const list = document.getElementById('literature-list')!;
    Object.defineProperty(list, 'scrollTop', { value: 25000, configurable: true });
    Object.defineProperty(list, 'scrollHeight', { value: 20000, configurable: true });
    Object.defineProperty(list, 'clientHeight', { value: 500, configurable: true });
    list.dispatchEvent(new Event('scroll'));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(25));
    expect(list.textContent).toContain('已显示所有笔记');
  });

  it('自动刷新：literature:file-* 四通道 + 300ms 防抖增量更新', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: 'A', date: '2026-08-02 10:00:00' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(1));
    // created：新增文件
    emitDomainEvent('literature:file-created', { path: '文献盒/B.md' });
    vault.files.set('文献盒/B.md', noteMd({ title: 'B', date: '2026-08-03 10:00:00' }));
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(2));
    // modified：改标题就地更新
    emitDomainEvent('literature:file-modified', { path: '文献盒/A.md' });
    vault.files.set('文献盒/A.md', noteMd({ title: 'A改', date: '2026-08-02 10:00:00' }));
    await vi.waitFor(() => expect(document.body.textContent).toContain('A改'));
    // deleted：移除卡片
    emitDomainEvent('literature:file-deleted', { path: '文献盒/B.md' });
    vault.files.delete('文献盒/B.md');
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(1));
    // renamed：旧路径移除 + 新路径增量（movedOut=false）
    emitDomainEvent('literature:file-renamed', { oldPath: '文献盒/A.md', newPath: '文献盒/A2.md', movedOut: false });
    vault.files.delete('文献盒/A.md');
    vault.files.set('文献盒/A2.md', noteMd({ title: 'A2', date: '2026-08-02 10:00:00' }));
    await vi.waitFor(() => expect(document.body.textContent).toContain('A2'));
    expect(document.body.textContent).not.toContain('A改');
    // 目录边界：非文献目录的 modify 不干扰
    emitDomainEvent('literature:file-modified', { path: '文献盒备选/x.md' });
    vault.files.set('文献盒备选/x.md', noteMd({ title: 'X' }));
    await new Promise((r) => setTimeout(r, 350));
    expect(document.querySelectorAll('.bz-lit-card').length).toBe(1);
  });

  it('文献目录设置变更：清缓存全量重载（旧目录内容不残留）', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: '旧目录笔记' }));
    vault.files.set('新文献库/B.md', noteMd({ title: '新目录笔记' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.body.textContent).toContain('旧目录笔记'));
    settings.literatureDirectory = '新文献库'; // 模拟设置面板改目录
    ui.showMain(); // refreshPanel 检测目录变更 → 清缓存重载
    await vi.waitFor(() => expect(document.body.textContent).toContain('新目录笔记'));
    expect(document.body.textContent).not.toContain('旧目录笔记');
  });

  // ==================== 视频录入面板（任务队列） ====================

  it('视频录入面板（ticket 146）：➕/▶️ 批量处理单钮/🕘/✕ 存在；去 ⏹ 独立终止钮、⚙️ 设置与 ⬇️ 下载', async () => {
    ui.showVideoEntry();
    expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex');
    const popup = document.getElementById('literature-video-popup')!;
    expect(popup.querySelector('#lit-btn-video-add')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-run')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-abort')).toBeNull(); // 单钮态机：初始无独立终止钮（ticket 146）
    expect(popup.querySelector('#lit-btn-video-history')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-close')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-settings')).toBeNull();
    expect(popup.querySelector('#lit-btn-video-download')).toBeNull();
    // 空闲态单钮 = 「▶️ 批量处理」（初始无工作 → 禁用，_syncRunButton 异步补齐）
    const run = document.getElementById('lit-btn-video-run') as HTMLButtonElement;
    expect(run.textContent).toBe('▶️');
    await vi.waitFor(() => expect(run.disabled).toBe(true));
    // ⚙️ 设置入口已移到主面板
    expect(document.getElementById('lit-btn-settings')).toBeTruthy();
  });

  it('showVideoEntry(prefill) 打开视频面板并叠开添加弹窗（聚合讯入口预填链接/标题/UP主，新增模式）', () => {
    ui.showVideoEntry({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '预填标题', uploader: '预填UP' });
    expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex');
    expect(document.getElementById('literature-add-popup')!.style.display).toBe('flex');
    // ticket 143：无标题，新增模式无编辑标签
    expect(document.getElementById('lit-add-mode')!.style.display).toBe('none');
    expect((document.getElementById('lit-add-url') as HTMLInputElement).value).toContain('BV1xx411c7mD');
    expect((document.getElementById('lit-add-vtitle') as HTMLInputElement).value).toBe('预填标题');
    expect((document.getElementById('lit-add-uploader') as HTMLInputElement).value).toBe('预填UP');
  });

  it('视频面板标题（ticket 143 拍板）：保留 h3「视频录入」+ 动作钮；标题后灰色计数小字去掉', () => {
    ui.showVideoEntry();
    const popup = document.getElementById('literature-video-popup')!;
    expect(popup.querySelector('.bz-win-head h3')!.textContent).toBe('视频录入');
    expect(document.getElementById('lit-video-counts')).toBeNull();
    expect(popup.querySelector('#lit-btn-video-add')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-close')).toBeTruthy();
  });

  it('添加弹窗简洁版（ticket 143）：无标题 h4、链接输入无 placeholder、分P 无括号、默认剪辑片段', () => {
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLButtonElement).click();
    expect(document.getElementById('lit-add-title')).toBeNull();
    expect((document.getElementById('lit-add-url') as HTMLInputElement).placeholder).toBe('');
    // 链接输入行：label 在上，整片/剪辑开关与输入同行
    expect(document.querySelector('#literature-add-popup .bz-lit-url-row #lit-add-range')).toBeTruthy();
    const labels = Array.from(document.querySelectorAll('#literature-add-popup label')).map((l) => l.textContent);
    expect(labels).toContain('视频链接 / BV 号');
    expect(labels.find((t) => t && t.startsWith('分P'))).toBe('分P'); // 无括号说明
    // 默认剪辑片段 + 时间输入可见
    expect(document.querySelector('#lit-add-range button[data-range="clip"]')!.classList.contains('active')).toBe(true);
    expect(document.getElementById('lit-add-clip-fields')!.style.display).toBe('block');
  });

  it('移动端视频面板仅 ➕ 添加 + ✕（单钮批量按钮/历史全部隐藏，ticket 139/144：移动端无此功能）', () => {
    ui.destroy();
    (Platform as any).isMobile = true;
    ui = new UIManager(app);
    expect((document.getElementById('lit-btn-video-run') as HTMLButtonElement).style.display).toBe('none');
    expect(document.getElementById('lit-btn-video-abort')).toBeNull();
    expect((document.getElementById('lit-btn-video-history') as HTMLButtonElement).style.display).toBe('none');
    expect(document.getElementById('lit-btn-video-add')).toBeTruthy();
    expect(document.getElementById('lit-btn-video-close')).toBeTruthy();
  });

  it('添加弹窗：无取消按钮、遮罩点击关闭；ESC 先关添加弹窗再关视频面板', () => {
    ui.showVideoEntry();
    (document.getElementById('lit-btn-video-add') as HTMLButtonElement).click();
    expect(document.getElementById('literature-add-popup')!.style.display).toBe('flex');
    expect(document.getElementById('lit-add-cancel')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('literature-add-popup')!.style.display).toBe('none');
    expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('literature-video-popup')!.style.display).toBe('none');
  });

  it('添加弹窗：保存入库 + 整片/剪辑开关 + 宽松时间归一 + 编辑回填', async () => {
    ui.showVideoEntry();
    await new Promise((r) => setTimeout(r, 0));
    (document.getElementById('lit-btn-video-add') as HTMLButtonElement).click();
    // 默认剪辑片段（ticket 143）：时间输入可见 + clip 高亮
    expect(document.getElementById('lit-add-clip-fields')!.style.display).toBe('block');
    expect(document.querySelector('#lit-add-range button[data-range="clip"]')!.classList.contains('active')).toBe(true);
    (document.getElementById('lit-add-url') as HTMLInputElement).value = 'https://www.bilibili.com/video/BV1xx411c7mD';
    // 剪辑模式下补一对时间（默认已剪辑）
    (document.getElementById('lit-add-start') as HTMLInputElement).value = '12.2';
    (document.getElementById('lit-add-end') as HTMLInputElement).value = '12-30';
    (document.getElementById('lit-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('已保存'));
    let all = await LiteratureData.loadTasks();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', start: '12:02', end: '12:30', status: 'pending' });
    // 点击待处理行 → 编辑回填（保存后弹窗已关闭，需点击行打开编辑态）；带 start/end → 剪辑模式回显
    await vi.waitFor(() => expect(document.querySelector('.bz-bili-task-card')).toBeTruthy());
    (document.querySelector('.bz-bili-task-card') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('literature-add-popup')!.style.display).toBe('flex'));
    expect((document.getElementById('lit-add-url') as HTMLInputElement).value).toContain('BV1xx411c7mD');
    expect((document.getElementById('lit-add-start') as HTMLInputElement).value).toBe('12:02');
    expect(document.querySelector('#lit-add-range button[data-range="clip"]')!.classList.contains('active')).toBe(true);
    expect(document.getElementById('lit-add-clip-fields')!.style.display).toBe('block');
    // ticket 143：无标题，编辑态以右上角小标签表意
    expect(document.getElementById('lit-add-title')).toBeNull();
    expect(document.getElementById('lit-add-mode')!.style.display).toBe('inline-block');
    expect(document.getElementById('lit-add-mode')!.textContent).toBe('编辑任务');
  });

  it('任务行渲染：状态徽标 + 时间范围 + 失败原因行内直显（头部灰色计数小字已去掉，ticket 143）', async () => {
    const t1 = await LiteratureData.addTask({ url: 'BV1xx411c7mD', start: '1:02:03', end: '1:05:00' });
    await LiteratureData.updateTask(t1.id, { status: 'processing', reason: '下载中…' } as any);
    const t2 = await LiteratureData.addTask({ url: 'BV1xx411c7mE' });
    await LiteratureData.updateTask(t2.id, { status: 'success', notePath: '文献盒/测试.md' } as any);
    await LiteratureData.updateTask(t2.id, { status: 'failed', reason: '视频已删除' } as any);
    await LiteratureData.addTask({ url: 'BV1xx411c7mG' });
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.getElementById('literature-video-list')!.children.length).toBeGreaterThan(0));
    const list = document.getElementById('literature-video-list')!;
    expect(list.textContent).toContain('待处理');
    expect(list.textContent).toContain('处理中');
    expect(list.textContent).toContain('失败');
    expect(list.textContent).toContain('1:02:03 ~ 1:05:00');
    expect(list.textContent).toContain('下载中…');
    expect(list.textContent).toContain('视频已删除');
    expect(document.getElementById('lit-video-counts')).toBeNull(); // 灰色计数小字已去掉（ticket 143）
  });

  it('批量处理：行内步骤时间线 + 完成态文案（含 STEP_DONE_MAP 两步）+ 百分比仅下载显示', async () => {
    const origRequire = (window as any).require;
    class FC extends EventEmitter { stdout = new EventEmitter(); stderr = new EventEmitter(); kill = vi.fn(); }
    const child = new FC();
    (window as any).require = () => ({ spawn: vi.fn(() => child) });
    try {
      ui.showVideoEntry();
      await new Promise((r) => setTimeout(r, 0));
      await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
      await ui.refreshVideoPanel();
      // ticket 146 单钮态机：空闲「▶️ 批量处理」→ 点击 → 运行中「⏹ 终止」
      const runBtn = document.getElementById('lit-btn-video-run') as HTMLButtonElement;
      expect(runBtn.textContent).toBe('▶️');
      runBtn.click();
      await vi.waitFor(() => expect(runBtn.textContent).toBe('⏹')); // 整批（含待处理）→ 终止
      await vi.waitFor(() => expect(document.querySelector('.bz-bili-progress-box')).toBeTruthy());
      child.stdout.emit('data', Buffer.from('[bz-step] 解析中\n[bz-step] 下载中\n'));
      child.stdout.emit('data', Buffer.from('[bz-p] {"phase":"download","pct":42}\n'));
      await vi.waitFor(() => {
        const box = document.querySelector('.bz-bili-progress-box')!;
        expect(box.textContent).toContain('已解析'); // 完成态「已…」文案
        expect(box.textContent).toContain('42%');
      });
      // 插件侧 AI 两步（ADR-0071）：STEP_DONE_MAP 完成态覆盖
      child.stdout.emit('data', Buffer.from('[bz-step] AI 生成文献笔记中\n[bz-step] 笔记落盘中\n'));
      await vi.waitFor(() => {
        const box = document.querySelector('.bz-bili-progress-box')!;
        expect(box.textContent).toContain('已生成文献笔记');
        expect(box.textContent).toContain('笔记落盘中');
      });
      // 非下载阶段不显示百分比
      child.stdout.emit('data', Buffer.from('[bz-p] {"phase":"ai","pct":77}\n'));
      await new Promise((r) => setTimeout(r, 10));
      expect(document.querySelector('.bz-bili-progress-box')!.textContent).not.toContain('77%');
    } finally {
      // 无论断言成败都收尾整批（防 BatchRunner.running 卡死重试）
      child.emit('close', 1);
      (window as any).require = origRequire;
    }
  });

  it('批量按钮单钮态机（ticket 146）：空闲按工作禁用/启用；运行中「⏹ 终止」；仅失败项续跑「⏹ 终止整批」；结束恢复可再点', async () => {
    const origRequire = (window as any).require;
    class FC extends EventEmitter { stdout = new EventEmitter(); stderr = new EventEmitter(); kill = vi.fn(); }
    const children: FC[] = [];
    (window as any).require = () => ({ spawn: vi.fn(() => { const c = new FC(); children.push(c); return c; }) });
    try {
      ui.showVideoEntry();
      await new Promise((r) => setTimeout(r, 0));
      const runBtn = document.getElementById('lit-btn-video-run') as HTMLButtonElement;
      // 无工作 → 禁用；有待处理 → 启用（初始无独立 ⏹ 按钮已由前面用例覆盖）
      await vi.waitFor(() => expect(runBtn.disabled).toBe(true));
      await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
      await ui.refreshVideoPanel();
      expect(runBtn.disabled).toBe(false);
      expect(runBtn.textContent).toBe('▶️');
      // 点击 → 运行中（整批含待处理）→ 按钮变「⏹」且可点（终止控制，title 提示区分，ticket 148 纯 emoji）
      runBtn.click();
      await vi.waitFor(() => expect(runBtn.textContent).toBe('⏹'));
      expect(runBtn.title).toBe('中止批量处理');
      expect(runBtn.disabled).toBe(false);
      // 第一个任务失败收尾（close 非 0）→ 整批结束 → 按钮恢复「▶️ 批量处理」且因失败仍在 → 可再点
      children[0].emit('close', 1);
      await vi.waitFor(() => expect(runBtn.textContent).toBe('▶️'));
      expect(runBtn.disabled).toBe(false);
      // 再点（work 仅失败项）→ 续跑失败任务 → 按钮变「⏹」（title 中止整批，ticket 148 纯 emoji）
      runBtn.click();
      await vi.waitFor(() => expect(runBtn.textContent).toBe('⏹'));
      expect(runBtn.title).toBe('中止整批（处理失败任务中）');
      children[1].emit('close', 1);
      await vi.waitFor(() => expect(runBtn.textContent).toBe('▶️'));
    } finally {
      for (const c of children) c.emit('close', 1);
      (window as any).require = origRequire;
    }
  });

  it('历史独立弹窗：🕘 打开 + 归档分组 + 清空历史（设置入口，确认后记录清空）', async () => {
    const ok = await LiteratureData.addTask({ url: 'https://www.bilibili.com/video/BV1xx411c7mD' });
    await LiteratureData.updateTask(ok.id, { status: 'success', archived: true, archivedAt: '2026-08-28 21:00:00', title: '从零开始学B站', notePath: '文献盒/从零开始学B站.md' } as any);
    const pend = await LiteratureData.addTask({ url: 'BV1xx411c7mE' });
    expect(pend).toBeTruthy();
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.getElementById('literature-video-list')!.textContent).toContain('BV1xx411c7mE'));
    expect(document.getElementById('literature-video-list')!.textContent).not.toContain('从零开始学B站');
    (document.getElementById('lit-btn-video-history') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('literature-history-popup')!.style.display).toBe('flex'));
    const hList = document.getElementById('literature-history-list')!;
    await vi.waitFor(() => expect(hList.textContent).toContain('从零开始学B站'));
    expect(hList.textContent).toContain('📄 从零开始学B站'); // 去目录去 .md（ticket 143）
    expect(hList.textContent).not.toContain('文献盒/从零开始学B站.md');
    expect(document.getElementById('lit-history-counts')!.textContent).toContain('共 1 条');
    expect(hList.querySelector('.bz-bili-status')).toBeNull(); // 无成功徽标
    // 清空历史（设置面板按钮行触发）
    const schema = literatureSettingsSchema({ onClearHistory: () => (ui as any).confirmClearHistory() });
    (schema.groups[4].rows[0] as any).onClick({});
    await vi.waitFor(() => expect(document.getElementById('__shared_confirm_ok__')).toBeTruthy());
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await vi.waitFor(async () => {
      const all = await LiteratureData.loadTasks();
      expect(all.some((x) => x.archived)).toBe(false);
    });
    await vi.waitFor(() => expect(hList.textContent).toContain('暂无历史记录'));
  });

  it('历史行展示（ticket 143）：组头无「UP主」前缀无条数计数；笔记行去目录去 .md；时间用 formatRelativeTime', async () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const past = new Date(Date.now() - 2 * 3600e3); // 2 小时前（相对时间稳定落在「N小时前」）
    const ts = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())} ${pad(past.getHours())}:${pad(past.getMinutes())}:${pad(past.getSeconds())}`;
    const a = await LiteratureData.addTask({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '量子纠缠' });
    await LiteratureData.updateTask(a.id, { status: 'success', archived: true, archivedAt: ts, processedAt: ts, uploader: '物理所', notePath: '文献盒/物理/量子纠缠.md', videoPath: 'D:/vids/纠缠.mp4' } as any);
    const b = await LiteratureData.addTask({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '量子纠缠' });
    await LiteratureData.updateTask(b.id, { status: 'success', archived: true, archivedAt: ts, processedAt: ts, uploader: '物理所', notePath: '文献盒/物理/量子纠缠_2.md' } as any);
    ui.showHistory();
    const hList = document.getElementById('literature-history-list')!;
    await vi.waitFor(() => expect(hList.textContent).toContain('量子纠缠'));
    // 组头：UP主名直接跟在标题后（无「UP主」前缀、无「N 条笔记」计数）
    const up = hList.querySelector('.bz-bili-hup') as HTMLElement;
    expect(up.textContent).toBe('物理所');
    expect(hList.textContent).not.toContain('UP主');
    expect(hList.querySelector('.bz-bili-hcount')).toBeNull();
    // 笔记行：去目录（含子目录）去 .md；时间用相对函数结果
    expect(hList.textContent).toContain('📄 量子纠缠');
    expect(hList.textContent).not.toContain('.md');
    expect(hList.textContent).toContain(formatRelativeTime(ts));
  });

  // ==================== 术语生成面板（文字录入） ====================

  it('showTermEntry：带词入口自动生成（ticket 155），生成后输入行按钮变「重新生成」', async () => {
    noteGen.generateTermDraft.mockResolvedValue({ summary: '贝叶斯定理的百科式简介', domain: '数学' });
    ui.showTermEntry('贝叶斯定理');
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('贝叶斯定理');
    // 预填即自动生成，无需点击
    await vi.waitFor(() => expect(noteGen.generateTermDraft).toHaveBeenCalledWith('贝叶斯定理'));
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    expect((document.getElementById('lit-term-content') as HTMLElement).textContent).toContain('贝叶斯定理的百科式简介');
    // 已有结果：输入行按钮文案变「重新生成」
    expect((document.getElementById('lit-term-generate') as HTMLButtonElement).textContent).toBe('重新生成');
  });

  it('showTermEntry：空术语不生成', () => {
    ui.showTermEntry();
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('');
    // 空术语点击生成 → 提示，不调 AI
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    expect(noteGen.generateTermDraft).not.toHaveBeenCalled();
    expect(noteGen.generateTermNote).not.toHaveBeenCalled();
    expect(strNotices()).toContain('请输入术语');
  });

  it('术语面板简洁版（ticket 142）：无标题/术语 label/placeholder/状态行，输入行下无提示文字', () => {
    ui.showTermEntry();
    // 无标题：bz-win-head 不再挂术语弹窗
    expect(document.querySelector('#literature-term-popup .bz-win-head')).toBeNull();
    // 无 label：术语 label 与预览字段 label 全部移除
    expect(document.querySelectorAll('#literature-term-popup label').length).toBe(0);
    // 输入框无 placeholder
    expect((document.getElementById('lit-term-input') as HTMLInputElement).placeholder).toBe('');
    // 无「生成中」状态行（ts 载并入按钮文案，输入行下方无文字节点）
    expect(document.getElementById('lit-term-status')).toBeNull();
    expect(document.getElementById('lit-term-generate')!.textContent).toBe('生成');
    // 生成中态并入按钮
    (ui as any).setTermGenLoading(true);
    expect(document.getElementById('lit-term-generate')!.textContent).toBe('生成中…');
  });

  it('术语流程（ticket 138 §2.1）：生成 → 纯 AI 预览（未确认不落盘）；确认写入 → generateTermNote 传面板值落盘 + 自动打开 + term-generated + 面板关闭', async () => {
    noteGen.generateTermDraft.mockImplementation(async (term: string) => ({ summary: `${term}的百科式简介`, domain: '物理' }));
    noteGen.generateTermNote.mockImplementation(async ({ term, summary, domain }: { term: string; summary?: string; domain?: string }) => {
      const path = `文献盒/${term}.md`;
      vault.files.set(path, `---
title: "${term}"
type: term
domain: "${domain ?? '物理'}"
term: "${term}"
date: "2026-08-30 10:00:00"
---

${summary ?? `${term}的百科式简介`}`);
      return path;
    });
    const events: any[] = [];
    const off = onDomainEvent<any>('literature:tasks', (e) => events.push(e));
    try {
      ui.showTermEntry();
      (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
      (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
      expect(noteGen.generateTermDraft).toHaveBeenCalledTimes(1);
      expect(noteGen.generateTermDraft).toHaveBeenCalledWith('黑洞');
      expect((document.getElementById('lit-term-meta-term') as HTMLElement).textContent).toBe('黑洞');
      expect((document.getElementById('lit-term-meta-domain') as HTMLElement).textContent).toBe('物理');
      expect((document.getElementById('lit-term-meta-date') as HTMLElement).textContent).not.toBe('');
      expect((document.getElementById('lit-term-content') as HTMLElement).textContent).toContain('黑洞的百科式简介');
      // 未确认不落盘：生成/预览后 vault 无新增 md、generateTermNote 未被调用
      expect(noteGen.generateTermNote).not.toHaveBeenCalled();
      expect(vault.files.has('文献盒/黑洞.md')).toBe(false);
      // 确认写入 → 此刻才落盘一次，且传的是面板当前值（所见即所得，P1-4 不重跑 AI）
      (document.getElementById('lit-term-save') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalledTimes(1));
      expect(noteGen.generateTermNote).toHaveBeenCalledWith({ term: '黑洞', summary: '黑洞的百科式简介', domain: '物理' });
      await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
      // term-generated 行为流事件
      expect(events).toContainEqual(expect.objectContaining({ kind: 'term-generated', term: '黑洞' }));
      // 面板关闭
      await vi.waitFor(() => expect(document.getElementById('literature-term-popup')!.style.display).toBe('none'));
      // 落盘文件存在（仅确认时落盘一次，未被误删）
      expect(vault.files.has('文献盒/黑洞.md')).toBe(true);
      expect(strNotices()).toContain('已生成术语文献笔记');
    } finally {
      off();
    }
  });

  it('术语流程：预览只读所见即所得——无领域/正文输入框，确认写入传 AI 预览值（不重跑 AI、无二次覆盖）', async () => {
    noteGen.generateTermDraft.mockResolvedValue({ summary: 'AI 生成的简介', domain: '物理' });
    noteGen.generateTermNote.mockImplementation(async ({ term, summary, domain }: { term: string; summary?: string; domain?: string }) => {
      const path = `文献盒/${term}.md`;
      vault.files.set(path, `---
title: "${term}"
type: term
domain: "${domain ?? '物理'}"
term: "${term}"
date: "2026-08-30 10:00:00"
---

${summary ?? 'AI 生成的简介'}`);
      return path;
    });
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    // 只读契约：预览内无任何可编辑控件（无领域输入框/简介 textarea）
    expect(document.getElementById('lit-term-domain')).toBeNull();
    expect(document.getElementById('lit-term-body')).toBeNull();
    expect(document.querySelector('#lit-term-preview input')).toBeNull();
    expect(document.querySelector('#lit-term-preview textarea')).toBeNull();
    (document.getElementById('lit-term-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
    expect(noteGen.generateTermNote).toHaveBeenCalledTimes(1); // 预览不落盘，确认仅落一次
    // 所见即所得：确认写入直接用 AI 预览值，不重跑 AI、无二次覆盖
    expect(noteGen.generateTermNote).toHaveBeenCalledWith({ term: '黑洞', summary: 'AI 生成的简介', domain: '物理' });
    const content = vault.files.get('文献盒/黑洞.md')!;
    expect(content).toContain('domain: "物理"');
    expect(content).toContain('AI 生成的简介');
  });

  it('术语流程（ticket 155）：输入行「重新生成」直接覆盖；底部「总结」AI 精简回填；无预览直接确认提示先生成；未确认关闭无落盘', async () => {
    let gen = 0;
    noteGen.generateTermDraft.mockImplementation(async (term: string) => {
      gen++;
      return { summary: `第${gen}版简介`, domain: '物理' };
    });
    noteGen.summarizeTermSummary.mockResolvedValue('第1版精简');
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect((document.getElementById('lit-term-content') as HTMLElement).textContent).toContain('第1版简介'));
    // 底部按钮语义已改「总结」（id 保留 DOM 契约）
    expect((document.getElementById('lit-term-regenerate') as HTMLButtonElement).textContent).toBe('总结');
    // 总结 → 对当前预览正文 AI 精简回填（不重跑生成），所见即所得
    (document.getElementById('lit-term-regenerate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect((document.getElementById('lit-term-content') as HTMLElement).textContent).toContain('第1版精简'));
    expect(noteGen.summarizeTermSummary).toHaveBeenCalledTimes(1);
    expect(noteGen.summarizeTermSummary).toHaveBeenCalledWith('第1版简介');
    expect(noteGen.generateTermDraft).toHaveBeenCalledTimes(1);
    expect(document.getElementById('__shared_confirm_ok__')).toBeNull();
    // 输入行「重新生成」→ 直接重跑覆盖（无确认弹窗），正文回到全新生成
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect((document.getElementById('lit-term-content') as HTMLElement).textContent).toContain('第2版简介'));
    expect(noteGen.generateTermDraft).toHaveBeenCalledTimes(2);
    // 全程只预览未落盘
    expect(noteGen.generateTermNote).not.toHaveBeenCalled();
    // 无预览直接确认 → 提示先点击「生成」
    (document.getElementById('literature-term-mask') as HTMLElement).click();
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞'; // 只有术语没有预览
    (document.getElementById('lit-term-save') as HTMLButtonElement).click();
    expect(strNotices()).toContain('请先点击「生成」');
    expect(noteGen.generateTermNote).not.toHaveBeenCalled();
    // 未确认关闭 → vault 无新增 md
    (document.getElementById('literature-term-mask') as HTMLElement).click();
    expect(vault.files.size).toBe(0);
    expect(openFile).not.toHaveBeenCalled();
  });

  it('术语流程（ticket 155）：总结后确认写入传精简正文；无预览点总结提示先生成', async () => {
    noteGen.generateTermDraft.mockResolvedValue({ summary: 'AI 生成的简介', domain: '物理' });
    noteGen.summarizeTermSummary.mockResolvedValue('精简后的简介');
    noteGen.generateTermNote.mockImplementation(async ({ term, summary, domain }: { term: string; summary?: string; domain?: string }) => {
      const path = `文献盒/${term}.md`;
      vault.files.set(path, `---
title: "${term}"
type: term
domain: "${domain ?? '物理'}"
term: "${term}"
date: "2026-08-30 10:00:00"
---

${summary ?? ''}`);
      return path;
    });
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('flex'));
    // 总结 → 确认写入落盘的是精简正文
    (document.getElementById('lit-term-regenerate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect((document.getElementById('lit-term-content') as HTMLElement).textContent).toContain('精简后的简介'));
    (document.getElementById('lit-term-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalledTimes(1));
    expect(noteGen.generateTermNote).toHaveBeenCalledWith({ term: '黑洞', summary: '精简后的简介', domain: '物理' });
    // 重开面板无预览：总结按钮提示先生成
    ui.showTermEntry();
    (document.getElementById('lit-term-regenerate') as HTMLButtonElement).click();
    expect(strNotices()).toContain('请先生成简介');
    expect(noteGen.summarizeTermSummary).toHaveBeenCalledTimes(1);
  });

  it('术语流程：AI 未配置 → 提示去设置，不进入预览', async () => {
    noteGen.generateTermDraft.mockRejectedValue(new Error('未配置 OpenCode Go API Key：插件设置 → AI 配置'));
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(hasNotice(/未配置 AI/)).toBe(true));
    expect(document.getElementById('lit-term-preview')!.style.display).toBe('none');
    expect(noteGen.generateTermNote).not.toHaveBeenCalled();
    // 生成按钮恢复可用，文案回到「生成」（无预览结果不显示「重新生成」）
    expect((document.getElementById('lit-term-generate') as HTMLButtonElement).disabled).toBe(false);
    expect((document.getElementById('lit-term-generate') as HTMLButtonElement).textContent).toBe('生成');
  });

  // ==================== 设置 schema 与设置弹窗 ====================

  it('literatureSettingsSchema：五组键齐全；清空历史 button 行回调', () => {
    const schema = literatureSettingsSchema({ onClearHistory: () => {} });
    expect(schema.groups).toHaveLength(5);
    expect(schema.groups[0].name).toBe('目录与分类');
    expect(schema.groups[1].name).toBe('视频处理');
    expect(schema.groups[2].name).toBe('工具');
    expect(schema.groups[3].name).toBe('移动端');
    expect(schema.groups[4].name).toBe('维护');
    // 视频处理组七项
    const rows2 = schema.groups[1].rows.map((r: any) => r.name);
    expect(rows2).toEqual(['详细进度提示', '保留视频原件', '下载清晰度', '遇错即停', '输出目录', '压缩', '压缩质量（CRF）']);
    // 工具组六项
    expect(schema.groups[2].rows).toHaveLength(6);
    // 清空历史回调
    const cleared = vi.fn();
    const schema2 = literatureSettingsSchema({ onClearHistory: cleared });
    const row = schema2.groups[4].rows[0] as any;
    expect(row.type).toBe('button');
    expect(row.buttonText).toBe('清空历史');
    row.onClick({});
    expect(cleared).toHaveBeenCalledTimes(1);
  });

  it('主面板 ⚙️ 打开文献盒设置弹窗（schema 渲染，目录与分类/视频处理/工具/维护）', async () => {
    ui.showMain();
    await new Promise((r) => setTimeout(r, 10));
    (document.getElementById('lit-btn-settings') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeTruthy());
    const txt = document.getElementById('bz-settings-modal-popup')!.textContent!;
    expect(txt).toContain('文献盒设置');
    expect(txt).toContain('目录与分类');
    expect(txt).toContain('视频处理');
    expect(txt).toContain('工具');
    expect(txt).toContain('维护');
    // 遮罩点击关闭（设置弹窗不放关闭按钮）
    (document.getElementById('bz-settings-modal-mask') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-settings-modal-popup')).toBeNull());
  });

  // ==================== ticket 139：增量卡片级刷新 / 白话失败 / 范围开关 / ❌ 统一 ====================

  it('增量刷新卡片级 patch：modified 只重建对应卡片，其余卡片节点引用不变（滚动不跳根因修复）', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: 'A', date: '2026-08-02 10:00:00' }));
    vault.files.set('文献盒/B.md', noteMd({ title: 'B', date: '2026-08-01 10:00:00' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(2));
    const cardA = document.querySelector('.bz-lit-card[data-path="文献盒/A.md"]') as HTMLElement;
    const cardB = document.querySelector('.bz-lit-card[data-path="文献盒/B.md"]') as HTMLElement;
    emitDomainEvent('literature:file-modified', { path: '文献盒/A.md' });
    vault.files.set('文献盒/A.md', noteMd({ title: 'A改', date: '2026-08-02 10:00:00' }));
    await vi.waitFor(() => expect(document.body.textContent).toContain('A改'));
    const cardA2 = document.querySelector('.bz-lit-card[data-path="文献盒/A.md"]');
    const cardB2 = document.querySelector('.bz-lit-card[data-path="文献盒/B.md"]');
    expect(cardA2).not.toBe(cardA); // A 内容变 → 替换节点
    expect(cardB2).toBe(cardB);     // B 未变 → 原节点复用（不清列表）
  });

  it('主面板加载中状态：首载显示「正在扫描文献目录…」，加载完替换为列表/空态', async () => {
    vault.files.set('文献盒/A.md', noteMd({ title: 'A', date: '2026-08-02 10:00:00' }));
    ui.showMain();
    // refreshPanel 同步段先渲染加载态
    expect(document.getElementById('literature-list')!.textContent).toContain('正在扫描文献目录…');
    await vi.waitFor(() => expect(document.querySelector('.bz-lit-card')).toBeTruthy());
    expect(document.getElementById('literature-list')!.textContent).not.toContain('正在扫描文献目录…');
  });

  it('humanizeError：常见失败模式白话化，未命中保留原文，原文超长截断（ticket 139）', async () => {
    const { humanizeError } = await import('../../src/literature/ui');
    expect(humanizeError('未找到 bili-dl。请先运行 npm install -g @jwbz/bili-downloader')).toContain('下载工具未安装');
    expect(humanizeError('ffmpeg exited with code 1')).toContain('ffmpeg');
    expect(humanizeError('ffprobe: No such file')).toContain('ffprobe');
    // whisper 失败细分（ticket 149）：未配置 pythonPath vs faster-whisper 环境缺失 vs 其它 whisper 类
    expect(humanizeError('转文字失败：rc 未配置 pythonPath（faster-whisper 所在 Python 路径）')).toContain('语音转写未配置');
    expect(humanizeError('转文字失败：找不到 Python（无法启动 Python：spawn python ENOENT）')).toContain('未找到 Python');
    expect(humanizeError('转文字失败：xxx（请确认 faster-whisper 环境已安装：目标 Python 已 pip install faster-whisper）')).toContain('faster-whisper 未安装');
    expect(humanizeError('Whisper 模型加载失败 unknown_model')).toContain('语音转写失败');
    expect(humanizeError('AI 生成文献笔记失败：未配置 OpenCode Go API Key：插件设置 → AI 配置')).toContain('AI 配置不可用');
    expect(humanizeError('AI 请求超时（领域判定，25000ms）')).toContain('AI 响应异常');
    expect(humanizeError('转录文件读取失败')).toContain('转写稿缺失');
    expect(humanizeError('connect ETIMEDOUT 1.2.3.4:443')).toContain('网络超时');
    expect(humanizeError('getaddrinfo ENOTFOUND b23.tv')).toContain('网络连接失败');
    expect(humanizeError('请求过于频繁(-352)')).toContain('风控');
    expect(humanizeError('某个完全未知的错误')).toBe('某个完全未知的错误');
    expect(humanizeError('x'.repeat(200))).toHaveLength(161);
    expect(humanizeError('')).toBe('');
  });

  it('失败任务点击 → 编辑弹窗带失败原因提示条（白话展示 + title 保留原文，ticket 139）', async () => {
    const t = await LiteratureData.addTask({ url: 'BV1xx411c7mD' });
    await LiteratureData.updateTask(t.id, { status: 'failed', reason: 'connect ETIMEDOUT 1.2.3.4:443' } as any);
    ui.showVideoEntry();
    await vi.waitFor(() => expect(document.querySelector('.bz-bili-task-card')).toBeTruthy());
    // 行内白话 + title 原文
    const errEl = document.querySelector('.bz-bili-progress-error') as HTMLElement;
    expect(errEl.textContent).toContain('网络超时');
    expect(errEl.title).toContain('ETIMEDOUT');
    // 点击失败卡片 → 编辑弹窗 + 提示条
    (document.querySelector('.bz-bili-task-card') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('literature-add-popup')!.style.display).toBe('flex'));
    const alert = document.getElementById('lit-add-fail')!;
    expect(alert.style.display).toBe('block');
    expect(alert.textContent).toContain('网络超时');
    expect(alert.title).toContain('ETIMEDOUT');
  });

  it('整片/剪辑开关（ticket 139 + 143）：显式切整片后有残留时间输入也按整片保存；剪辑缺时间报错不入库', async () => {
    ui.showVideoEntry();
    await new Promise((r) => setTimeout(r, 0));
    // 默认剪辑（ticket 143）；显式切「整片」后：时间输入框有残留值 → 保存仍为整片（start/end null）
    (document.getElementById('lit-btn-video-add') as HTMLButtonElement).click();
    (document.querySelector('#lit-add-range button[data-range="whole"]') as HTMLButtonElement).click();
    (document.getElementById('lit-add-url') as HTMLInputElement).value = 'BV1xx411c7mD';
    (document.getElementById('lit-add-start') as HTMLInputElement).value = '1:00';
    (document.getElementById('lit-add-end') as HTMLInputElement).value = '2:00';
    (document.getElementById('lit-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('已保存'));
    const all = await LiteratureData.loadTasks();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ start: null, end: null });
    // 剪辑模式缺时间 → 报错 + 不入库
    await LiteratureData.deleteTask(all[0].id);
    (document.getElementById('lit-btn-video-add') as HTMLButtonElement).click();
    (document.querySelector('#lit-add-range button[data-range="clip"]') as HTMLButtonElement).click();
    (document.getElementById('lit-add-url') as HTMLInputElement).value = 'BV1xx411c7mE';
    (document.getElementById('lit-add-save') as HTMLButtonElement).click();
    expect(strNotices()).toContain('剪辑片段需填写开始与结束时间');
    expect(await LiteratureData.loadTasks()).toHaveLength(0);
    // 填一对时间 → 入库成功（先清掉残留 notice，防 waitFor 撞上上一轮「已保存」）
    (document.getElementById('lit-add-start') as HTMLInputElement).value = '12.2';
    (document.getElementById('lit-add-end') as HTMLInputElement).value = '12-30';
    clearNotices();
    (document.getElementById('lit-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('已保存'));
    const saved = await LiteratureData.loadTasks();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ start: '12:02', end: '12:30' });
  });

  it('关闭按钮 ❌ 统一（ticket 139）：主面板/视频面板/历史弹窗三处 bz-win-close', () => {
    ui.showMain();
    expect(document.getElementById('lit-btn-close')!.textContent).toBe('❌');
    ui.showVideoEntry();
    expect(document.getElementById('lit-btn-video-close')!.textContent).toBe('❌');
    ui.showHistory();
    expect(document.getElementById('lit-history-close')!.textContent).toBe('❌');
  });

  it('移动端全屏：showVideoEntry 挂 bz-win-mfs（三件事补齐视频面板，ticket 139）', () => {
    ui.destroy();
    (Platform as any).isMobile = true;
    settings.literatureMobileDefaultFullscreen = true;
    ui = new UIManager(app);
    ui.showVideoEntry();
    expect(document.getElementById('literature-video-popup')!.classList.contains('bz-win-mfs')).toBe(true);
  });

  it('术语输入框 Enter 直接生成（ticket 139）', async () => {
    noteGen.generateTermDraft.mockResolvedValue({ summary: 'Enter简介', domain: '物理' });
    ui.showTermEntry();
    const input = document.getElementById('lit-term-input') as HTMLInputElement;
    input.value = '黑洞';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await vi.waitFor(() => expect((document.getElementById('lit-term-content') as HTMLElement).textContent).toBe('Enter简介'));
  });

  // ==================== 主面板入口按钮与清理 ====================

  it('主面板入口：文字录入 → 术语面板；视频录入 → 视频面板（主面板保持显示，ticket 139 叠开）', () => {
    ui.showMain();
    (document.getElementById('lit-btn-text') as HTMLButtonElement).click();
    expect(document.getElementById('literature-popup')!.style.display).toBe('flex'); // 不再隐藏主面板
    expect(document.getElementById('literature-term-popup')!.style.display).toBe('flex');
    (document.getElementById('literature-term-mask') as HTMLElement).click();
    // 关闭术语面板 → 主面板仍在（导航闭环）
    expect(document.getElementById('literature-popup')!.style.display).toBe('flex');
    expect(document.getElementById('literature-term-popup')!.style.display).toBe('none');
    (document.getElementById('lit-btn-video') as HTMLButtonElement).click();
    expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex');
    expect(document.getElementById('literature-popup')!.style.display).toBe('flex');
  });

  it('destroy 清空全部 DOM、退订文件监听与键盘监听', async () => {
    ui.showMain();
    await new Promise((r) => setTimeout(r, 10));
    ui.destroy();
    expect(document.getElementById('literature-popup')).toBeNull();
    expect(document.getElementById('literature-mask')).toBeNull();
    expect(document.getElementById('literature-video-popup')).toBeNull();
    expect(document.getElementById('literature-add-popup')).toBeNull();
    expect(document.getElementById('literature-history-popup')).toBeNull();
    expect(document.getElementById('literature-term-popup')).toBeNull();
    // 文件监听已退订：destroy 后 emit 事件不再有 handler 报错（总线空通道）
    expect(() => emitDomainEvent('literature:file-modified', { path: '文献盒/A.md' })).not.toThrow();
  });
});