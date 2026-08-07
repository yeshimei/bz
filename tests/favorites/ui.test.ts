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
import { MockNotice, resetObsidianMocks } from '../mock-obsidian-entry';

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
  } as any;
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

    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    expect(ui.mask!.style.display).toBe('flex');
    expect(document.querySelector('.fav-empty, #fav-entries-container')!.textContent).toContain('暂无收藏 🎉');
    ui.hide();
    expect(ui.mask!.style.display).toBe('none');
  });

  it('渲染条目卡片（标题链接/简介/标签 emoji/时间）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelector('.fav-card')).not.toBeNull();
    const link = container.querySelector('a') as HTMLAnchorElement;
    expect(link!.textContent).toBe('我的项目');
    expect(link!.href).toBe('https://github.com/a/b');
    expect(container.textContent).toContain('🐙 GitHub');
    expect(container.textContent).toContain('2025-06-01 08:00:00');
    expect(container.textContent).toContain('一个测试项目');
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
    expect(MockNotice.instances.some((n) => n.message === '请至少选择一个分类')).toBe(true);

    // 选分类但无标题
    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === 'GitHub')!.click();
    ui.addTitleInput!.value = '';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(MockNotice.instances.some((n) => n.message === '请输入标题')).toBe(true);

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
    expect(MockNotice.instances.some((n) => n.message === '收藏已添加 ✅')).toBe(true);
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
    expect(MockNotice.instances.some((n) => n.message === '请填写API Keys')).toBe(true);

    // 填了 keys 无 URL → 保存成功（balanceUrl 空串）
    ui.llmApiKeysInput!.value = 'sk-abc';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));
    const data = await ui.dataManager.getAll();
    expect(data.length).toBe(1);
    expect(data[0].llmConfig).toEqual({ apiKeys: 'sk-abc', balanceUrl: '' });
  });

  it('编辑模式：回填 + saveBtn「更新」+ 保留 created', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '7', title: '原标题', tags: ['GitHub', '网站'] }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    // 长按标签徽章 → 编辑（fake timers）
    vi.useFakeTimers();
    const container = document.getElementById('fav-entries-container')!;
    const badge = [...container.querySelectorAll('span')].find((s) => (s as HTMLElement).style.borderRadius === '12px') as HTMLElement;
    badge.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(650);
    vi.useRealTimers();
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
    expect(MockNotice.instances.some((n) => n.message === '收藏已更新 ✅')).toBe(true);
  });

  it('长按时间 → 删除确认 → 确认删除', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    vi.useFakeTimers();
    const meta = document.querySelector('#fav-entries-container .fav-card span[style*="font-size:12px; color:var(--text-faint)"]') as HTMLElement;
    const timeSpan = meta || ([...document.querySelectorAll('#fav-entries-container span')].find((s) => s.textContent === '2025-06-01 08:00:00') as HTMLElement);
    timeSpan.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(650);
    vi.useRealTimers();
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
    expect(ui.addAiBtn!.textContent).toBe('✨ AI 推荐');
    expect(MockNotice.instances.some((n) => n.message === '✅ AI 智能整理完成！')).toBe(true);
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
    expect(MockNotice.instances.some((n) => n.message.includes('不在列表中，已忽略'))).toBe(true);

    ui.aiService.ai = { json: vi.fn().mockRejectedValue(new Error('网络错误')) } as any;
    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(MockNotice.instances.some((n) => n.message === 'AI 整理失败：网络错误')).toBe(true);
  });

  it('余额显示与点击刷新', async () => {
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

    // 点击刷新 → fetch 成功
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ balance: 42.5 }) }));
    const balanceSpan = [...container.querySelectorAll('span')].find((s) => s.textContent!.startsWith('(❌')) as HTMLElement;
    balanceSpan.click();
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toContain('(余额: 42.5)');
    const data = await dm.getAll();
    expect(data[0].balance).toBe('42.5');
    vi.unstubAllGlobals();
  });
});
