/**
 * 文献盒（literature 域）UI 测试（ticket 136 改版，重写 src/literature/ui.ts）：
 * - 主面板（文献笔记列表）：标题/头部五按钮/类型过滤/领域筛选行/空态、卡片渲染（标题+类型徽标+
 *   领域徽标+简介+日期）与最近创建降序、🔍 搜索 300ms 防抖、类型过滤与领域筛选叠加、
 *   双击打开（click 计数 300ms）、抽屉（打开/复制双链/复制原文链接[video]/删除 danger+确认，
 *   删除同步清理指向该笔记的任务记录）、懒加载（批次 20 + 触底 + 尾部提示）、
 *   literature:file-* 四通道 300ms 防抖增量刷新、文献目录设置变更清缓存全量重载。
 * - 视频录入面板（任务队列）：去 ⚙️/⬇️；保留 ➕/▶️/⏹/🕘/✕；移动端仅 ➕/🕘+✕；
 *   添加弹窗（校验/编辑回填/预填叠开）、历史独立弹窗（分组/清空历史）、批量处理行内进度
 *   （[bz-step]/[bz-p] 时间线 + STEP_DONE_MAP「AI 生成文献笔记中/笔记落盘中」完成态文案）。
 * - 术语生成面板：预填/空术语不生成/生成预览（mock note-gen generateTermNote）/重新生成丢弃手改/
 *   确认写入（generateTermNote 落盘 + 按面板当前值覆盖领域与正文 + 自动打开 + term-generated 事件）/
 *   未确认关闭清理草稿/AI 未配置提示。
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
import { MockVault, mockAppWithVault } from '../mock-vault';
import { clearNotices, getNoticeMessages, hasNotice, resetObsidianMocks } from '../mock-obsidian-entry';

// ---- note-gen 打桩：generateTermNote/backfillNotes 由各用例注入实现，避免真实 AI ----
const noteGen = vi.hoisted(() => ({
  generateTermNote: vi.fn(),
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
    noteGen.backfillNotes.mockReset();
    noteGen.backfillNotes.mockResolvedValue({ scanned: 0, filled: 0, aiSkipped: false });
    ui = new UIManager(app);
  });

  afterEach(() => {
    ui.destroy();
    (Platform as any).isMobile = false;
    document.body.innerHTML = '';
  });

  // ==================== 主面板：结构与空态 ====================

  it('showMain 渲染主面板：标题文献盒/五按钮/类型过滤/领域筛选行/空态', async () => {
    ui.showMain();
    await vi.waitFor(() => expect(document.getElementById('literature-popup')!.style.display).toBe('flex'));
    const popup = document.getElementById('literature-popup')!;
    expect(popup.querySelector('.bz-win-head h3')!.textContent).toBe('文献盒');
    // 头部按钮秩序：🔍搜索 → 文字录入 → 视频录入 → ⚙️设置 → ✕关闭
    const btns = Array.from(popup.querySelectorAll<HTMLElement>('.bz-lit-head-btns button')).map((b) => b.id);
    expect(btns).toEqual(['lit-btn-search', 'lit-btn-text', 'lit-btn-video', 'lit-btn-settings', 'lit-btn-close']);
    expect(popup.querySelector('#lit-btn-close')!.classList.contains('bz-win-close')).toBe(true);
    expect(popup.querySelector('#literature-typebar')).toBeTruthy();
    expect(popup.querySelector('#literature-sitebar')).toBeTruthy();
    expect(popup.querySelectorAll('#literature-typebar button')).toHaveLength(3);
    await vi.waitFor(() => expect(document.getElementById('literature-list')!.textContent).toContain('还没有文献笔记'));
  });

  it('主面板列表：标题 + 类型徽标 + 领域徽标 + 简介 + 日期，最近创建降序', async () => {
    vault.files.set('文献盒/视频A.md', noteMd({ title: '视频A', type: 'video', domain: '物理', date: '2026-08-30 10:00:00', summary: '简介A' }));
    vault.files.set('文献盒/术语B.md', noteMd({ title: '术语B', type: 'term', domain: '数学', date: '2026-08-28 10:00:00', summary: '简介B' }));
    vault.files.set('文献盒/视频C.md', noteMd({ title: '视频C', type: 'video', domain: '物理', date: '2026-09-01 10:00:00', summary: '简介C' }));
    ui.showMain();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(3));
    const titles = Array.from(document.querySelectorAll('.bz-lit-card-title')).map((el) => el.textContent);
    expect(titles).toEqual(['视频C', '视频A', '术语B']); // 最近创建降序
    const first = document.querySelector('.bz-lit-card')!;
    expect(first.querySelector('.bz-lit-badge-type')!.textContent).toBe('视频');
    expect(first.querySelector('.bz-lit-badge-domain')!.textContent).toBe('物理');
    expect(first.textContent).toContain('简介C');
    expect(first.textContent).toContain('2026-09-01');
  });

  it('领域筛选行：全部 (N) + 各领域按钮带数量，按 count 降序；类型过滤可叠加', async () => {
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
    // 领域筛选：物理 → 2 条
    domainBtns[1].click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(2));
    // 叠加类型过滤：物理 + 视频 → 仅剩 A（C 是术语、B 是数学）
    (document.querySelector<HTMLElement>('#literature-typebar button[data-type="video"]')!).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(1));
    const listTxt = document.getElementById('literature-list')!.textContent!;
    expect(listTxt).toContain('A');
    expect(listTxt).not.toContain('数学'); // B 被领域筛选排除
    expect(listTxt).not.toContain('C'); // C 被类型筛选排除
    // 关闭类型过滤回 2 条（物理 全部类型）
    (document.querySelector<HTMLElement>('#literature-typebar button[data-type=""]')!).click();
    await vi.waitFor(() => expect(document.querySelectorAll('.bz-lit-card').length).toBe(2));
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

  it('视频录入面板：➕/▶️/⏹/🕘/✕ 存在；去 ⚙️ 设置与 ⬇️ 下载', () => {
    ui.showVideoEntry();
    expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex');
    const popup = document.getElementById('literature-video-popup')!;
    expect(popup.querySelector('#lit-btn-video-add')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-run')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-abort')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-history')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-close')).toBeTruthy();
    expect(popup.querySelector('#lit-btn-video-settings')).toBeNull();
    expect(popup.querySelector('#lit-btn-video-download')).toBeNull();
    // ⚙️ 设置入口已移到主面板
    expect(document.getElementById('lit-btn-settings')).toBeTruthy();
  });

  it('showVideoEntry(prefill) 打开视频面板并叠开添加弹窗（聚合讯入口预填链接/标题/UP主，新增模式）', () => {
    ui.showVideoEntry({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', title: '预填标题', uploader: '预填UP' });
    expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex');
    expect(document.getElementById('literature-add-popup')!.style.display).toBe('flex');
    expect(document.getElementById('lit-add-title')!.textContent).toBe('添加转文献任务');
    expect((document.getElementById('lit-add-url') as HTMLInputElement).value).toContain('BV1xx411c7mD');
    expect((document.getElementById('lit-add-vtitle') as HTMLInputElement).value).toBe('预填标题');
    expect((document.getElementById('lit-add-uploader') as HTMLInputElement).value).toBe('预填UP');
  });

  it('移动端视频面板仅 ➕ 添加 / 🕘 历史 + ✕（隐藏处理/中止，原 isMobileEnv 逻辑扩展）', () => {
    ui.destroy();
    (Platform as any).isMobile = true;
    ui = new UIManager(app);
    expect((document.getElementById('lit-btn-video-run') as HTMLButtonElement).style.display).toBe('none');
    expect((document.getElementById('lit-btn-video-abort') as HTMLButtonElement).style.display).toBe('none');
    expect(document.getElementById('lit-btn-video-add')).toBeTruthy();
    expect(document.getElementById('lit-btn-video-history')).toBeTruthy();
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

  it('添加弹窗：保存入库 + 宽松时间归一 + 编辑回填', async () => {
    ui.showVideoEntry();
    await new Promise((r) => setTimeout(r, 0));
    (document.getElementById('lit-btn-video-add') as HTMLButtonElement).click();
    (document.getElementById('lit-add-url') as HTMLInputElement).value = 'https://www.bilibili.com/video/BV1xx411c7mD';
    (document.getElementById('lit-add-start') as HTMLInputElement).value = '12.2';
    (document.getElementById('lit-add-end') as HTMLInputElement).value = '12-30';
    (document.getElementById('lit-add-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(strNotices()).toContain('已保存'));
    let all = await LiteratureData.loadTasks();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', start: '12:02', end: '12:30', status: 'pending' });
    // 点击待处理行 → 编辑回填（保存后弹窗已关闭，需点击行打开编辑态）
    await vi.waitFor(() => expect(document.querySelector('.bz-bili-task-card')).toBeTruthy());
    (document.querySelector('.bz-bili-task-card') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('literature-add-popup')!.style.display).toBe('flex'));
    expect((document.getElementById('lit-add-url') as HTMLInputElement).value).toContain('BV1xx411c7mD');
    expect((document.getElementById('lit-add-start') as HTMLInputElement).value).toBe('12:02');
    expect(document.getElementById('lit-add-title')!.textContent).toBe('编辑转文献任务');
  });

  it('任务行渲染：状态徽标 + 时间范围 + 失败原因行内直显 + 头部状态计数', async () => {
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
    expect(document.getElementById('lit-video-counts')!.textContent).toBe('1 待处理 · 1 处理中 · 1 失败');
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
      (document.getElementById('lit-btn-video-run') as HTMLButtonElement).click();
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
    expect(hList.textContent).toContain('文献盒/从零开始学B站.md');
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

  // ==================== 术语生成面板（文字录入） ====================

  it('showTermEntry：预填术语 + 空术语不生成', () => {
    ui.showTermEntry('贝叶斯定理');
    expect(document.getElementById('literature-term-popup')!.style.display).toBe('flex');
    expect((document.getElementById('lit-term-input') as HTMLInputElement).value).toBe('贝叶斯定理');
    // 清空输入 → 空术语不生成
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '';
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    expect(noteGen.generateTermNote).not.toHaveBeenCalled();
    expect(strNotices()).toContain('请输入术语');
  });

  it('术语流程：生成 → 预览（领域/正文回填）→ 确认写入（generateTermNote 落盘 + 自动打开 + term-generated 事件 + 面板关闭）', async () => {
    noteGen.generateTermNote.mockImplementation(async ({ term }: { term: string }) => {
      const path = `文献盒/${term}.md`;
      vault.files.set(path, `---
title: "${term}"
type: term
domain: "物理"
term: "${term}"
date: "2026-08-30 10:00:00"
---

${term}的百科式简介`);
      return path;
    });
    const events: any[] = [];
    const off = onDomainEvent<any>('literature:tasks', (e) => events.push(e));
    try {
      ui.showTermEntry();
      (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
      (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('block'));
      expect(noteGen.generateTermNote).toHaveBeenCalledTimes(1);
      expect(noteGen.generateTermNote).toHaveBeenCalledWith({ term: '黑洞' });
      expect((document.getElementById('lit-term-domain') as HTMLInputElement).value).toBe('物理');
      expect((document.getElementById('lit-term-body') as HTMLTextAreaElement).value).toContain('黑洞的百科式简介');
      // 确认写入
      (document.getElementById('lit-term-save') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(noteGen.generateTermNote).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
      // term-generated 行为流事件
      expect(events).toContainEqual(expect.objectContaining({ kind: 'term-generated', term: '黑洞' }));
      // 面板关闭
      await vi.waitFor(() => expect(document.getElementById('literature-term-popup')!.style.display).toBe('none'));
      // 落盘文件存在（草稿清理后重新落盘，未被误删）
      expect(vault.files.has('文献盒/黑洞.md')).toBe(true);
      expect(strNotices()).toContain('已生成术语文献笔记');
    } finally {
      off();
    }
  });

  it('术语流程：确认写入按面板当前值覆盖领域与正文（generateTermNote 落盘 + vault.modify 写回）', async () => {
    noteGen.generateTermNote.mockImplementation(async ({ term }: { term: string }) => {
      const path = `文献盒/${term}.md`;
      vault.files.set(path, `---
title: "${term}"
type: term
domain: "物理"
term: "${term}"
date: "2026-08-30 10:00:00"
---

旧简介`);
      return path;
    });
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.getElementById('lit-term-preview')!.style.display).toBe('block'));
    // 手改领域与正文
    (document.getElementById('lit-term-domain') as HTMLInputElement).value = '天体物理';
    (document.getElementById('lit-term-body') as HTMLTextAreaElement).value = '手改后的简介';
    (document.getElementById('lit-term-save') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(openFile).toHaveBeenCalledTimes(1));
    const content = vault.files.get('文献盒/黑洞.md')!;
    expect(content).toContain('domain: "天体物理"');
    expect(content).not.toContain('domain: "物理"');
    expect(content).toContain('手改后的简介');
    expect(content).not.toContain('旧简介');
  });

  it('术语流程：重新生成 = 按当前术语重跑丢弃预览手改；未确认关闭清理草稿', async () => {
    let gen = 0;
    noteGen.generateTermNote.mockImplementation(async ({ term }: { term: string }) => {
      gen++;
      const path = `文献盒/${term}.md`;
      vault.files.set(path, `---
title: "${term}"
type: term
domain: "物理"
term: "${term}"
date: "2026-08-30 10:00:00"
---

第${gen}版简介`);
      return path;
    });
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect((document.getElementById('lit-term-body') as HTMLTextAreaElement).value).toContain('第1版简介'));
    // 手改后「重新生成」→ 手改被新 AI 结果覆盖
    (document.getElementById('lit-term-body') as HTMLTextAreaElement).value = '手改内容';
    (document.getElementById('lit-term-regenerate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect((document.getElementById('lit-term-body') as HTMLTextAreaElement).value).toContain('第2版简介'));
    expect((document.getElementById('lit-term-body') as HTMLTextAreaElement).value).not.toContain('手改内容');
    expect(noteGen.generateTermNote).toHaveBeenCalledTimes(2);
    // 未确认 → 关闭面板清理草稿（未确认不落盘）
    (document.getElementById('literature-term-mask') as HTMLElement).click();
    await vi.waitFor(() => expect(vault.files.has('文献盒/黑洞.md')).toBe(false));
    expect(openFile).not.toHaveBeenCalled();
  });

  it('术语流程：AI 未配置 → 提示去设置，不进入预览', async () => {
    noteGen.generateTermNote.mockRejectedValue(new Error('未配置 OpenCode Go API Key：插件设置 → AI 配置'));
    ui.showTermEntry();
    (document.getElementById('lit-term-input') as HTMLInputElement).value = '黑洞';
    (document.getElementById('lit-term-generate') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(hasNotice(/未配置 AI/)).toBe(true));
    expect(document.getElementById('lit-term-preview')!.style.display).toBe('none');
    // 生成按钮恢复可用
    expect((document.getElementById('lit-term-generate') as HTMLButtonElement).disabled).toBe(false);
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

  // ==================== 主面板入口按钮与清理 ====================

  it('主面板入口：文字录入 → 术语面板；视频录入 → 视频面板（本窗隐藏）', () => {
    ui.showMain();
    (document.getElementById('lit-btn-text') as HTMLButtonElement).click();
    expect(document.getElementById('literature-popup')!.style.display).toBe('none');
    expect(document.getElementById('literature-term-popup')!.style.display).toBe('flex');
    (document.getElementById('literature-term-mask') as HTMLElement).click();
    (document.getElementById('lit-btn-video') as HTMLButtonElement).click();
    expect(document.getElementById('literature-video-popup')!.style.display).toBe('flex');
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