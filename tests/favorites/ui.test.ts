/**
 * 收藏本 UI 测试（ticket 11）：面板渲染/添加弹窗/编辑/长按/AI 整理/余额。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DataManager } from '../../src/favorites/data';
import { FavoritesAIService } from '../../src/favorites/ai';
import { UIManager } from '../../src/favorites/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices, requestUrl, Platform } from '../mock-obsidian-entry';
import { closeItemMenu } from '../../src/core/item-actions';
// ticket 078：收藏本 smartcat 观察挂点——mock notifyFavoritesAction，断言调用参数
vi.mock('../../src/smartcat', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/smartcat')>();
  return { ...mod, notifyFavoritesAction: vi.fn() };
});
import { notifyFavoritesAction } from '../../src/smartcat';

/** notifyFavoritesAction mock（ticket 078 挂点断言用；每用例前清调用记录） */
const mockNotify = vi.mocked(notifyFavoritesAction);

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
  } as any;
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 长按卡片打开浮层（桌面=跟手菜单 / 移动=底部抽屉，由 Platform.isMobile 决定）+ 消费残余 click */
function longPressOpen(card: HTMLElement) {
  card.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
  vi.advanceTimersByTime(550);
  card.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
  card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** 桌面右键开菜单（同步，无补发 click） */
function rightClickOpen(card: HTMLElement) {
  card.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
}

/** 长按打开浮层（自带 fake timers 包裹）+ 等待一拍 */
async function openByLongPress(card: HTMLElement) {
  vi.useFakeTimers();
  longPressOpen(card);
  vi.useRealTimers();
  await tick(10);
}

/** 当前浮层动作项文案列表 */
function actionLabels(): (string | null)[] {
  return [...document.querySelectorAll('.bz-item-menu-label, .bz-item-sheet-label')].map((e) => e.textContent);
}

/** 按文案点击浮层动作项 */
function clickAction(label: string) {
  const items = [...document.querySelectorAll('.bz-item-menu-item, .bz-item-sheet-item')] as HTMLElement[];
  const target = items.find((el) => el.querySelector('.bz-item-menu-label, .bz-item-sheet-label')?.textContent === label);
  if (!target) throw new Error('找不到动作项：' + label + '；现有=' + items.map((i) => i.textContent).join('|'));
  target.click();
}

function makeItem(partial: Partial<any> = {}): any {
  return {
    id: '1001', tags: ['GitHub'], title: '我的项目', description: '一个测试项目',
    pinned: false, url: 'https://github.com/a/b', balance: null, balanceCacheTime: null,
    balanceError: null, linkedNote: null, created: '2025-06-01 08:00:00', type: 'GitHub',
    ...partial,
  };
}

async function setup() {
  resetObsidianMocks();
  document.body.innerHTML = '';
  const vault = new MockVault();
  setApp(makeApp(vault));
  setSettingsProvider(() => ({ favoritesStoragePath: 'CONFIG/STORAGE' }) as any);
  const dm = new DataManager('CONFIG/STORAGE/favorites.json');
  const aiSvc = new FavoritesAIService();
  const ui = new UIManager(dm, aiSvc, null);
  return { vault, dm, aiSvc, ui };
}

describe('收藏本面板', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('build 创建 DOM + show 显示并渲染空态', async () => {
    const { ui } = await setup();
    ui.build();
    expect(document.getElementById('fav-mask')).not.toBeNull();
    expect(document.getElementById('fav-popup')).not.toBeNull();
    expect(document.getElementById('fav-add-mask')).not.toBeNull();
    // 类型栏容器挂 fav-tagbar 类（移动端多行平铺，styles.css 覆写；原单行滚动会藏类型）
    expect(document.querySelector('.fav-tagbar')).not.toBeNull();
    expect(document.querySelector('.fav-tagbar')!.querySelectorAll('.fav-tag-btn').length).toBeGreaterThan(0);

    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    expect(ui.mask!.style.display).toBe('flex');
    expect(document.querySelector('.fav-empty, #fav-entries-container')!.textContent).toContain('暂无收藏 🎉');
    ui.hide();
    expect(ui.mask!.style.display).toBe('none');
  });

  it('渲染条目卡片（标题纯文本/简介/标签 emoji/时间；无链接无跳转图标）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelector('.fav-card')).not.toBeNull();
    // 手势收敛：标题为纯文本 span，不再是 <a>，也无 📄 跳转图标
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('我的项目');
    expect(container.textContent).not.toContain('📄');
    expect(container.textContent).toContain('🐙 GitHub');
    expect(container.textContent).toContain('2025-06-01 08:00:00');
    expect(container.textContent).toContain('一个测试项目');
    // 卡片挂统一操作组件（长按出浮层/抽屉）
    expect(container.querySelector('.fav-card')!.classList.contains('bz-item-card')).toBe(true);
  });

  it('置顶卡片样式与排序（pinned 优先）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '1', title: '普通', pinned: false, created: '2025-06-02 00:00:00' }));
    await dm.add(makeItem({ id: '2', title: '置顶', pinned: true, created: '2025-06-01 00:00:00' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const cards = document.querySelectorAll('.fav-card');
    expect(cards[0].textContent).toContain('置顶');
    expect((cards[0] as HTMLElement).style.borderLeft).toContain('3px');
  });

  it('标签栏计数 + 点击过滤', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    await dm.add(makeItem({ id: '2', tags: ['网站'], title: '网页', url: '' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const tagBtns = [...document.querySelectorAll('.fav-tag-btn')] as HTMLElement[];
    const githubBtn = tagBtns.find((b) => b.dataset.tag === 'GitHub')!;
    expect(githubBtn.textContent).toContain('(1)');
    githubBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelectorAll('.fav-card').length).toBe(1);
    expect(container.textContent).toContain('我的项目');
  });

  it('搜索过滤（标题/简介/标签）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    await dm.add(makeItem({ id: '2', tags: ['网站'], title: '其他网页', url: '', description: '网页简介' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    ui.searchInput!.value = '项目';
    ui.searchInput!.dispatchEvent(new Event('input'));
    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelectorAll('.fav-card').length).toBe(1);
  });

  it('添加弹窗：未选分类/无标题 Notice + 成功保存', async () => {
    const { ui, dm } = await setup();
    ui.build();
    ui.openAddDialog();
    expect(document.getElementById('fav-add-popup')!.style.display).toBe('flex');

    // 未选分类
    ui.addTitleInput!.value = '测试';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请至少选择一个分类')).toBe(true);

    // 选分类但无标题
    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === 'GitHub')!.click();
    ui.addTitleInput!.value = '';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请输入标题')).toBe(true);

    // 完整保存
    ui.addTitleInput!.value = '新收藏';
    ui.addUrlInput!.value = 'https://github.com/x/y';
    ui.addDescInput!.value = '简介';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));
    const data = await dm.getAll();
    expect(data.length).toBe(1);
    expect(data[0].title).toBe('新收藏');
    expect(data[0].type).toBe('GitHub');
    expect(data[0].tags).toEqual(['GitHub']);
    expect(data[0].id).toBeTruthy();
    expect(data[0].created).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(hasNotice('收藏已添加')).toBe(true);
  });

  it('大模型标签 → LLM 配置区显示 + apiKeys 校验', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();

    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === '大模型')!.click();
    expect(ui.llmConfigSection!.style.display).toBe('flex');

    ui.addTitleInput!.value = 'LLM 收藏';
    ui.llmApiKeysInput!.value = '';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(hasNotice('请填写 API Keys')).toBe(true);

    // 填了 keys 无 URL → 保存成功（balanceUrl 空串）
    ui.llmApiKeysInput!.value = 'sk-abc';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));
    const data = await ui.dataManager.getAll();
    expect(data.length).toBe(1);
    expect(data[0].llmConfig).toEqual({ apiKeys: 'sk-abc', balanceUrl: '' });
  });

  it('编辑模式：右键卡片→动作「编辑」→ 回填 + saveBtn「更新」+ 保留 created', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '7', title: '原标题', tags: ['GitHub', '网站'] }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    // 整卡右键 → 跟手菜单 → 编辑
    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));

    clickAction('编辑');
    await new Promise((r) => setTimeout(r, 10));

    expect(ui.addPopup!.style.display).toBe('flex');
    expect(ui.addSaveBtn!.textContent).toBe('更新');
    expect(ui.addTitleInput!.value).toBe('原标题');
    expect(ui.addPopup!.querySelector('h4')!.textContent).toBe('编辑收藏');

    ui.addTitleInput!.value = '改后标题';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));
    const data = await dm.getAll();
    expect(data[0].title).toBe('改后标题');
    expect(data[0].created).toBe('2025-06-01 08:00:00'); // created 保留
    expect(hasNotice('收藏已更新')).toBe(true);
  });

  it('删除：右键卡片→动作「删除」→ confirm 确认删除', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));

    clickAction('删除');
    await new Promise((r) => setTimeout(r, 10));

    const confirmMask = document.getElementById('__shared_confirm_mask__');
    expect(confirmMask).not.toBeNull();
    expect(confirmMask!.textContent).toContain('确定删除收藏 "我的项目" 吗？');
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));
    expect((await dm.getAll()).length).toBe(0);
  });

  it('AI 整理：mock ai → 回填 + 标签选中', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    ui.addUrlInput!.value = 'https://github.com/foo/bar';
    ui.aiService.ai = {
      json: vi.fn().mockResolvedValue('{"title":"AI标题","url":"https://github.com/foo/bar","description":"AI简介","tags":["GitHub"]}'),
    } as any;

    ui.addAiBtn!.click();
    expect(ui.addAiBtn!.textContent).toBe('⏳ AI 整理中...');
    await new Promise((r) => setTimeout(r, 30));

    expect(ui.addTitleInput!.value).toBe('AI标题');
    expect(ui.addDescInput!.value).toBe('AI简介');
    expect(ui.addAiBtn!.textContent).toBe('✨ AI 整理');
    expect(hasNotice('AI 整理完成')).toBe(true);
    // 动态消息：完成态 toast 走 success 类型
    expect(document.querySelector('.bz-notice--success')).not.toBeNull();
    const active = [...document.querySelectorAll('.fav-type-btn.active')].map((b) => (b as HTMLElement).dataset.tag);
    expect(active).toContain('GitHub');
  });

  it('AI 整理：未知标签 Notice + AI reject → 失败 Notice', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    ui.addTitleInput!.value = 'x';
    ui.aiService.ai = {
      json: vi.fn().mockResolvedValue('{"title":"T","tags":["不存在标签"]}'),
    } as any;
    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(hasNotice(/不在列表中，已忽略/)).toBe(true);

    ui.aiService.ai = { json: vi.fn().mockRejectedValue(new Error('网络错误')) } as any;
    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector('.bz-notice--error')!.textContent).toContain('AI 整理失败：网络错误');
  });

  it('AI 整理：GitHub 链接 → 仓库名预填标题 + 简介翻译 + GitHub 类型自动选中', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    ui.addUrlInput!.value = 'https://github.com/hellowind777/helloagents';
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ name: 'helloagents', description: 'A collection of AI agent experiments' }),
    } as any);
    ui.aiService.ai = {
      json: vi.fn().mockResolvedValue('{"title":"helloagents","description":"一个 AI 智能体实验合集","tags":["GitHub","Claude"]}'),
    } as any;

    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 30));

    expect(ui.addTitleInput!.value).toBe('helloagents');
    expect(ui.addDescInput!.value).toBe('一个 AI 智能体实验合集');
    expect(ui.addAiBtn!.textContent).toBe('✨ AI 整理');
    expect(hasNotice('AI 整理完成')).toBe(true);
    const active = [...document.querySelectorAll('.fav-type-btn.active')].map((b) => (b as HTMLElement).dataset.tag);
    expect(active).toContain('GitHub');
    expect(active).toContain('Claude');
    // 提示词包含 GitHub API 取回的仓库简介原文，并要求忠实翻译成中文（不扩写凑字数）
    const prompt = (ui.aiService.ai as any).json.mock.calls[0][0] as string;
    expect(prompt).toContain('A collection of AI agent experiments');
    expect(prompt).toContain('忠实翻译成中文');
    expect(prompt).toContain('不扩写、不总结、不凑字数');
  });

  it('AI 整理：GitHub API 失败 → 降级（仓库名预填 + AI 漏选时 GitHub 标签兜底）', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    ui.addUrlInput!.value = 'https://github.com/abc/def';
    vi.mocked(requestUrl).mockRejectedValue(new Error('网络错误'));
    ui.aiService.ai = {
      json: vi.fn().mockResolvedValue('{"title":"自定义标题","description":"自定义简介","tags":["网站"]}'),
    } as any;

    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 30));

    // AI 结果优先覆盖预填的仓库名
    expect(ui.addTitleInput!.value).toBe('自定义标题');
    expect(ui.addDescInput!.value).toBe('自定义简介');
    // GitHub 标签兜底强制选中
    const active = [...document.querySelectorAll('.fav-type-btn.active')].map((b) => (b as HTMLElement).dataset.tag);
    expect(active).toContain('GitHub');
    expect(active).toContain('网站');
    // 提示词禁止编造简介（获取失败的提示并入动态消息阶段文案，完成态不保留）
    const prompt = (ui.aiService.ai as any).json.mock.calls[0][0] as string;
    expect(prompt).toContain('无简介或获取失败');
    expect(prompt).toContain('严禁编造或自行生成简介');
  });

  it('AI 整理：GitHub 链接 + AI 失败 → 简介降级填入仓库简介原文', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    ui.addUrlInput!.value = 'https://github.com/abc/def';
    vi.mocked(requestUrl).mockResolvedValue({
      status: 200,
      text: JSON.stringify({ name: 'def', description: 'Original English description' }),
    } as any);
    ui.aiService.ai = { json: vi.fn().mockRejectedValue(new Error('网络错误')) } as any;

    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 30));

    // 标题保留仓库名预填，简介降级为原文（未翻译）
    expect(ui.addTitleInput!.value).toBe('def');
    expect(ui.addDescInput!.value).toBe('Original English description');
    expect(hasNotice('AI 整理失败：网络错误')).toBe(true);
  });

  it('余额：列表纯展示不可点击，刷新走抽屉「刷新余额」（小字+头部同步更新）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({
      id: '9', tags: ['大模型'], title: 'LLM', url: '',
      llmConfig: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
      balance: null, balanceCacheTime: null, balanceError: null,
    }));
    ui.build();
    // 初始查询失败（未 mock 的真实 fetch 会抛错）→ 渲染 ❌ 错误态
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('网络不可达')));
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const container = document.getElementById('fav-entries-container')!;
    expect(container.textContent).toContain('(❌');

    // 抽屉「刷新余额」→ fetch 成功 → 小字与头部同步、数据写回（keepOpen 仅抽屉路径，切移动端）
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ balance: 42.5 }) }));
    Platform.isMobile = true;
    const card = container.querySelector('.fav-card') as HTMLElement;
    await openByLongPress(card);
    try {
      clickAction('刷新余额');
      await new Promise((r) => setTimeout(r, 30));
      const subs = [...document.querySelectorAll('.bz-item-sheet-item-sub')].map((e) => e.textContent);
      expect(subs).toContain('42.5');
      expect(document.querySelector('.bz-fav-sheet-balance')!.textContent).toContain('42.5');
      expect((await dm.getAll())[0].balance).toBe('42.5');
      expect(document.querySelector('.bz-item-sheet')).not.toBeNull(); // keepOpen：抽屉保持
    } finally {
      Platform.isMobile = false;
      closeItemMenu();
      vi.unstubAllGlobals();
    }
  });
});

describe('收藏本抽屉（统一手势组件接入）', () => {
  beforeEach(() => {
    Platform.isMobile = true; // 底部抽屉路径
  });

  afterEach(() => {
    Platform.isMobile = false;
    closeItemMenu();
  });

  async function seedTwo(ui: UIManager, dm: DataManager) {
    await dm.add(makeItem()); // 我的项目：有 url（GitHub）
    await dm.add(makeItem({ id: '2', title: '网页', tags: ['网站'], type: '网站', url: '', linkedNote: '笔记库/说明.md' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    return [...document.querySelectorAll('#fav-entries-container .fav-card')] as HTMLElement[];
  }

  it('动作条件显示与顺序：打开→置顶→跳转笔记→刷新余额→编辑→删除', async () => {
    const { ui, dm } = await setup();
    const cards = await seedTwo(ui, dm);
    expect(cards.length).toBe(2);

    // 网页卡（无 url、有 linkedNote）：无「打开」「刷新余额」，跳转小字=笔记名
    await openByLongPress(cards[0]);
    expect(actionLabels()).toEqual(['置顶', '跳转笔记', '编辑', '删除']);
    const subs0 = [...document.querySelectorAll('.bz-item-sheet-item-sub')].map((e) => e.textContent);
    expect(subs0).toContain('说明.md');
    closeItemMenu();

    // 项目卡（有 url、无 llm）：打开在首位，小字=域名；无「跳转笔记」「刷新余额」
    await openByLongPress(cards[1]);
    expect(actionLabels()).toEqual(['打开', '置顶', '编辑', '删除']);
    const subs1 = [...document.querySelectorAll('.bz-item-sheet-item-sub')].map((e) => e.textContent);
    expect(subs1).toContain('github.com');

    // 头部：分类 emoji + 标题 + 标签徽章
    expect(document.querySelector('.bz-fav-sheet-title')!.textContent).toBe('我的项目');
    expect(document.querySelector('.bz-fav-sheet-emoji')!.textContent).toBe('🐙');
    const badges = [...document.querySelectorAll('.bz-fav-sheet-tag')].map((e) => e.textContent);
    expect(badges).toEqual(['🐙 GitHub']);
  });

  it('置顶：keepOpen 原地翻转 + 数据写回 + 头部📌 + 列表重排', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '1', title: '甲', created: '2025-06-02 00:00:00' }));
    await dm.add(makeItem({ id: '2', title: '乙', created: '2025-06-01 00:00:00' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    let cards = [...document.querySelectorAll('#fav-entries-container .fav-card')] as HTMLElement[];
    expect(cards[0].textContent).toContain('甲'); // 新创建在前

    await openByLongPress(cards[0]);
    clickAction('置顶');
    await tick(30);

    expect((await dm.getAll()).find((d) => d.id === '1')!.pinned).toBe(true);
    expect(actionLabels()).toContain('取消置顶'); // 动作翻转
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull(); // 抽屉保持
    expect(document.querySelector('.bz-fav-sheet-title')!.textContent).toContain('📌 甲'); // 头部同步

    closeItemMenu();
    await tick(30);
    cards = [...document.querySelectorAll('#fav-entries-container .fav-card')] as HTMLElement[];
    expect(cards[0].textContent).toContain('甲'); // 列表重排：置顶优先
  });

  it('编辑：弹窗叠抽屉（companion 防误关）；保存后自动关抽屉', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '7', title: '原标题' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    await openByLongPress(card);
    clickAction('编辑');
    await tick(10);
    expect(ui.addPopup!.style.display).toBe('flex');
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull(); // 弹窗开着，抽屉也在

    // 点弹窗本体不触发外部点击关闭抽屉（companion）
    ui.addPopup!.click();
    await tick(10);
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull();

    ui.addTitleInput!.value = '改后标题';
    ui.addSaveBtn!.click();
    await tick(30);
    expect(ui.addPopup!.style.display).toBe('none');
    expect(document.querySelector('.bz-item-sheet')).toBeNull(); // Q8：保存后关抽屉
    expect((await dm.getAll())[0].title).toBe('改后标题');
    expect(hasNotice('收藏已更新')).toBe(true);
  });

  it('删除：抽屉项先收抽屉再 confirm，确认后删除', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    await openByLongPress(card);
    clickAction('删除');
    await tick(10);
    // 非 keepOpen：点删除即收抽屉，confirm 叠上
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    const confirmMask = document.getElementById('__shared_confirm_mask__');
    expect(confirmMask).not.toBeNull();

    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(30);
    expect((await dm.getAll()).length).toBe(0);
    expect(hasNotice('已删除收藏')).toBe(true);
  });
});

describe('收藏本 smartcat 观察挂点（ticket 078 方法监听）', () => {
  beforeEach(() => {
    mockNotify.mockClear();
  });

  afterEach(() => {
    closeItemMenu();
  });

  it('添加挂点：保存成功后通知 {kind: add, item}（最终落盘的 data 对象）', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === 'GitHub')!.click();
    ui.addTitleInput!.value = 'TokenLedger';
    ui.addUrlInput!.value = 'https://github.com/zh667/TokenLedger';
    ui.addDescInput!.value = '面向DeepSeek Harness的中继站点';
    ui.addPinBtn!.click(); // 置顶
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(mockNotify).toHaveBeenCalledTimes(1);
    const evt: any = mockNotify.mock.calls[0][0]; // union 窄化靠运行期断言（kind === 'add'）
    expect(evt.kind).toBe('add');
    expect(evt.item).toMatchObject({
      title: 'TokenLedger', url: 'https://github.com/zh667/TokenLedger',
      description: '面向DeepSeek Harness的中继站点', tags: ['GitHub'], pinned: true,
    });
    expect(evt.item.id).toBeTruthy();
  });

  it('编辑挂点：保存成功后通知 {kind: edit, title, changes}（old vs data 变化列表）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '7', title: '原标题', description: '旧简介', url: 'https://github.com/a/b', tags: ['GitHub', '网站'] }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('编辑');
    await new Promise((r) => setTimeout(r, 10));

    ui.addTitleInput!.value = '改后标题';
    ui.addDescInput!.value = '新简介';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith({ kind: 'edit', title: '改后标题', changes: ['改了标题', '改了简介'] });
  });

  it('编辑挂点：仅置顶翻转 → changes 空数组（置顶不参与比较，也不单独发观察）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '7', title: '原标题' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('编辑');
    await new Promise((r) => setTimeout(r, 10));

    ui.addPinBtn!.click(); // 弹窗内切换置顶
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith({ kind: 'edit', title: '原标题', changes: [] });
  });

  it('删除挂点：确认删除成功后通知 {kind: delete, title}', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('删除');
    await new Promise((r) => setTimeout(r, 10));
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith({ kind: 'delete', title: '我的项目' });
  });

  it('保存失败（add 抛错）→ 不通知（挂点在 try 成功路径）', async () => {
    const { ui, dm } = await setup();
    ui.build();
    ui.openAddDialog();
    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === 'GitHub')!.click();
    ui.addTitleInput!.value = 'X';
    vi.spyOn(dm, 'add').mockRejectedValue(new Error('磁盘错误'));
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(mockNotify).not.toHaveBeenCalled();
    expect(hasNotice('保存失败：磁盘错误')).toBe(true);
  });
});
