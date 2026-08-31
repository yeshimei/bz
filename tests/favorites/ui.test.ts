/**
 * 收藏本 UI 测试（ticket 11）：面板渲染/添加弹窗/编辑/长按/AI 整理/余额。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { DataManager } from '../../src/favorites/data';
import { FavoritesAIService } from '../../src/favorites/ai';
import { UIManager } from '../../src/favorites/ui';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks, getNoticeMessages, hasNotice, clearNotices, requestUrl, Platform } from '../mock-obsidian-entry';
import { closeItemMenu } from '../../src/core/item-actions';
import { onDomainEvent } from '../../src/core/domain-bus';
// ticket 078 观测点换线（域事件派发）：真实总线 + onDomainEvent('favorites', spy) 挂间谍，
// 断言 UI 动作发出的载荷（挂点契约不变，只换观测点；ui.ts 不再 import smartcat barrel）。
let mockNotify: import('vitest').Mock<(evt?: unknown) => void>;
let offNotifySpy: () => void = () => {};

function makeApp(vault: MockVault) {
  return {
    vault,
    metadataCache: {},
    workspace: { openLinkText: vi.fn() },
    // 打开可见入口（ticket 61）：app.openUrl spy（_openExternal 直调）
    openUrl: vi.fn(),
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
  // ticket 23：AI 整理守卫真实读取插件 AI 配置——默认带 opencode-go key（缺配置拦截的用例自行覆盖）
  setSettingsProvider(
    () => ({ favoritesStoragePath: 'CONFIG/STORAGE', aiProvider: 'opencode-go', opencodeGoApiKey: 'sk-test' }) as any
  );
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
    // 空态首步引导（ticket l6-fav 解冻）：暂无收藏 + 第一步引导
    expect(document.querySelector('.fav-empty, #fav-entries-container')!.textContent).toContain('暂无收藏 🎉');
    expect(document.querySelector('.fav-empty, #fav-entries-container')!.textContent).toContain('添加第一个收藏');
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
    // 置顶视觉走类（ticket 141 样式收敛：原内联 border-left/background）
    expect(cards[0].classList.contains('bz-fav-card--pinned')).toBe(true);
    expect(cards[1].classList.contains('bz-fav-card--pinned')).toBe(false);
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
    // ticket 42：搜索防抖 180ms——输入后需等静置窗口渲染
    await new Promise((r) => setTimeout(r, 250));
    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelectorAll('.fav-card').length).toBe(1);
  });

  it('搜索防抖（ticket 42）：连续输入合并为一次渲染，只按最终关键词筛选', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    await dm.add(makeItem({ id: '2', tags: ['网站'], title: '其他网页', url: '', description: '网页简介' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    ui.searchInput!.value = '项目';
    ui.searchInput!.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('.fav-card').length).toBe(2); // 防抖窗口内不立即渲染
    ui.searchInput!.value = '网页';
    ui.searchInput!.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));

    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelectorAll('.fav-card').length).toBe(1);
    expect(container.textContent).toContain('其他网页');
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
    // 非 GitHub 地址：无仓库名预填干扰，验证 AI 对空字段的补全（ticket 22 改当前值语义后）
    ui.addUrlInput!.value = 'https://example.com/x';
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

    // 仓库名预填（def）视为已存在的输入内容，AI 结果不覆盖（ticket 22 当前值语义）；简介空字段照常回填
    expect(ui.addTitleInput!.value).toBe('def');
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

  it('AI 整理不覆盖手写（ticket 22）：手填字段保持原样，仅补全空字段', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    ui.addTitleInput!.value = '我的手写标题';
    ui.addUrlInput!.value = 'https://github.com/foo/bar';
    ui.addDescInput!.value = '我的手写简介';
    ui.aiService.ai = {
      json: vi.fn().mockResolvedValue('{"title":"AI标题","url":"https://evil.example/x","description":"AI简介","tags":["GitHub"]}'),
    } as any;

    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 30));

    // 用户手填字段不被 AI 覆盖（url 连协议头补全也不改）
    expect(ui.addTitleInput!.value).toBe('我的手写标题');
    expect(ui.addUrlInput!.value).toBe('https://github.com/foo/bar');
    expect(ui.addDescInput!.value).toBe('我的手写简介');
    // 标签照常由 AI 处理（未知标签 notice 逻辑不受影响）
    const active = [...document.querySelectorAll('.fav-type-btn.active')].map((b) => (b as HTMLElement).dataset.tag);
    expect(active).toContain('GitHub');
    expect(hasNotice('AI 整理完成')).toBe(true);
  });

  it('AI 整理不覆盖手写（ticket 22）：仅手填标题 → 空字段照常补全', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    ui.addTitleInput!.value = '我的手写标题';
    ui.aiService.ai = {
      json: vi.fn().mockResolvedValue('{"title":"AI标题","url":"https://github.com/foo/bar","description":"AI简介","tags":["网站"]}'),
    } as any;

    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 30));

    expect(ui.addTitleInput!.value).toBe('我的手写标题'); // 手写保留
    expect(ui.addUrlInput!.value).toBe('https://github.com/foo/bar'); // 空字段补全
    expect(ui.addDescInput!.value).toBe('AI简介');
  });

  it('AI 整理不覆盖手写（审查竞态 D）：处理期间用户补填的字段不被 AI 覆盖', async () => {
    const { ui } = await setup();
    ui.build();
    ui.openAddDialog();
    ui.addUrlInput!.value = 'https://example.com/x'; // 非 GitHub：无预填干扰
    let resolveAi: (v: string) => void = () => {};
    ui.aiService.ai = {
      json: vi.fn().mockImplementation(
        () => new Promise<string>((res) => { resolveAi = res; })
      ),
    } as any;

    ui.addAiBtn!.click();
    // AI 处理中（快照时为空）用户补填标题
    ui.addTitleInput!.value = '处理中补填';
    await new Promise((r) => setTimeout(r, 10)); // 让 AI 调用挂起（resolveAi 就位）
    resolveAi('{"title":"AI标题","url":"https://evil.example/y","description":"AI简介","tags":["网站"]}');
    await new Promise((r) => setTimeout(r, 30));

    expect(ui.addTitleInput!.value).toBe('处理中补填'); // 处理中手填不被 AI 覆盖
    expect(ui.addUrlInput!.value).toBe('https://example.com/x'); // 用户既有内容不被覆盖
    expect(ui.addDescInput!.value).toBe('AI简介'); // 仍为空的字段照常补全
    expect(hasNotice('AI 整理完成')).toBe(true);
  });

  it('AI 未配置（ticket 23）：直接 warning 拦截，不弹 progress、不转整理中态、不调用 AI', async () => {
    const { ui } = await setup();
    // 覆盖设置：清空 AI 配置（setup 默认带 key）
    setSettingsProvider(
      () => ({ favoritesStoragePath: 'CONFIG/STORAGE', aiProvider: 'opencode-go', opencodeGoApiKey: '' }) as any
    );
    ui.build();
    ui.openAddDialog();
    ui.addTitleInput!.value = 'x';
    const aiJson = vi.fn();
    ui.aiService.ai = { json: aiJson } as any;

    ui.addAiBtn!.click();
    await new Promise((r) => setTimeout(r, 10));

    expect(hasNotice('AI 服务未配置或不可用')).toBe(true);
    expect(aiJson).not.toHaveBeenCalled();
    expect(document.querySelector('.bz-notice--progress')).toBeNull(); // 不弹 progress
    expect(ui.addAiBtn!.textContent).toBe('✨ AI 整理'); // 按钮未进入整理中态
    expect(ui.addAiBtn!.disabled).toBe(false);
  });

  it('打开可见入口（ticket 61）：单击卡片直接打开链接；无链接卡片点击无动作', async () => {
    const { ui, dm } = await setup();
    const app = getApp() as any;
    await dm.add(makeItem()); // 有 url（GitHub）
    await dm.add(makeItem({ id: '2', title: '无链接', url: '' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const cards = [...document.querySelectorAll('#fav-entries-container .fav-card')] as HTMLElement[];
    // add() 用 unshift：后加的在前；按文案定位（避免依赖排序）
    const urlCard = cards.find((c) => c.textContent.includes('我的项目'))!;
    const noUrlCard = cards.find((c) => c.textContent.includes('无链接'))!;
    urlCard.click();
    expect(app.openUrl).toHaveBeenCalledTimes(1);
    expect(app.openUrl).toHaveBeenCalledWith('https://github.com/a/b');
    urlCard.click(); // 300ms 窗口内同卡重复点击不重开（防双击双开）
    noUrlCard.click(); // 无链接不动作
    expect(app.openUrl).toHaveBeenCalledTimes(1);
    // 可见入口提示：有链接挂 bz-fav-card--link（cursor pointer），无链接不挂（无 hover 图标排）
    expect(urlCard.classList.contains('bz-fav-card--link')).toBe(true);
    expect(noUrlCard.classList.contains('bz-fav-card--link')).toBe(false);
  });

  it('打开可见入口（ticket 61）：双击窗口内同卡重复点击不重开（防双击连开两个标签页）', async () => {
    const { ui, dm } = await setup();
    const app = getApp() as any;
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    card.click();
    card.click(); // 快速双击（同毫秒，300ms 窗口内）
    expect(app.openUrl).toHaveBeenCalledTimes(1);
  });

  it('打开可见入口（ticket 61）：长按抽屉的合成 click 被吞，不触发直开（手势不冲突）', async () => {
    Platform.isMobile = true; // 移动端：长按开抽屉
    const { ui, dm } = await setup();
    const app = getApp() as any;
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    await openByLongPress(card);
    expect(document.querySelector('.bz-item-sheet')).not.toBeNull(); // 抽屉正常弹出
    expect(app.openUrl).not.toHaveBeenCalled(); // 长按松手的残余 click 未穿透到直开
    Platform.isMobile = false;
    closeItemMenu();
  });

  it('打开可见入口（审查阻断 A）：右键菜单开着时点卡片 = 关菜单手势，不顺带直开链接', async () => {
    const { ui, dm } = await setup();
    const app = getApp() as any;
    await dm.add(makeItem()); // 有 url
    await dm.add(makeItem({ id: '2', title: '无链接', url: '' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const cards = [...document.querySelectorAll('#fav-entries-container .fav-card')] as HTMLElement[];
    const urlCard = cards.find((c) => c.textContent.includes('我的项目'))!;
    const menuAnchor = cards.find((c) => c.textContent.includes('无链接'))!;

    // 在无链接卡上右键开菜单（锚在它上面；点它不会直开，便于隔离「关菜单」这一步的副作用）
    rightClickOpen(menuAnchor);
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector('.bz-item-menu')).not.toBeNull();

    // 菜单开着时点另一张卡：完整鼠标序（mousedown 在 window 捕获层记「关菜单手势」→ document 捕获层关菜单 → click）
    urlCard.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    urlCard.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    urlCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(app.openUrl).not.toHaveBeenCalled(); // 关菜单的点击不直开
    expect(document.querySelector('.bz-item-menu')).toBeNull(); // 菜单已关

    // 菜单已关后再点 → 正常直开
    urlCard.click();
    expect(app.openUrl).toHaveBeenCalledTimes(1);
  });

  it('打开可见入口（审查建议 B）：有文本选择时不直开（允许复制标题）', async () => {
    const { ui, dm } = await setup();
    const app = getApp() as any;
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    // 模拟拖选/双击选标题后松手：正文处于选中态
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(card);
    sel.addRange(range);

    card.click();
    expect(app.openUrl).not.toHaveBeenCalled(); // 选中态不直开

    sel.removeAllRanges();
    card.click();
    expect(app.openUrl).toHaveBeenCalledTimes(1); // 清除选择后正常直开
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

  it('动作条件显示与顺序：打开→置顶→跳转笔记→刷新余额→编辑→归档→删除', async () => {
    const { ui, dm } = await setup();
    const cards = await seedTwo(ui, dm);
    expect(cards.length).toBe(2);

    // 网页卡（无 url、有 linkedNote）：无「打开」「刷新余额」，跳转小字=笔记名
    await openByLongPress(cards[0]);
    expect(actionLabels()).toEqual(['置顶', '跳转笔记', '编辑', '归档', '删除']);
    const subs0 = [...document.querySelectorAll('.bz-item-sheet-item-sub')].map((e) => e.textContent);
    expect(subs0).toContain('说明.md');
    closeItemMenu();

    // 项目卡（有 url、无 llm）：打开在首位，小字=域名；无「跳转笔记」「刷新余额」
    await openByLongPress(cards[1]);
    expect(actionLabels()).toEqual(['打开', '置顶', '编辑', '归档', '删除']);
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
    // 撤销删除（ticket 141 通病 1）：toast 带标题与「撤销」按钮
    expect(hasNotice('已删除收藏「我的项目」')).toBe(true);
    expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(true);
  });

  it('归档：抽屉项先收抽屉再 confirm，确认后冷存消失（ticket 140，ADR-0074）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    await openByLongPress(card);
    clickAction('归档');
    await tick(10);
    // 非 keepOpen：点归档即收抽屉，confirm 叠上
    expect(document.querySelector('.bz-item-sheet')).toBeNull();
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();

    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await tick(30);
    const saved = (await dm.getAll())[0];
    expect(saved.archived).toBe(true);
    expect(saved.archivedAt).toBeTruthy();
    expect(hasNotice('已归档收藏')).toBe(true);
    // 纯冷存：确认后列表即不再渲染该条目
    expect(document.querySelectorAll('#fav-entries-container .fav-card').length).toBe(0);
  });

  it('归档：confirm 取消 → 条目原样保留', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    await openByLongPress(card);
    clickAction('归档');
    await tick(10);
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await tick(30);
    expect((await dm.getAll())[0].archived).toBeUndefined();
    expect(document.querySelectorAll('#fav-entries-container .fav-card').length).toBe(1);
  });
});

describe('收藏本归档冷存（ticket 140，ADR-0074 纯冷存不可见）', () => {
  it('冷存条目全排除：主列表/搜索/标签计数均不含', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '1', title: '活条目' }));
    await dm.add(makeItem({ id: '2', title: '冷存条目', archived: true, archivedAt: '2026-08-30 10:00:00' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelectorAll('.fav-card').length).toBe(1);
    expect(container.textContent).toContain('活条目');
    expect(container.textContent).not.toContain('冷存条目');
    // 标签计数只数未归档（两条同属 GitHub）
    const tagBtns = [...document.querySelectorAll('.fav-tag-btn')] as HTMLElement[];
    expect(tagBtns.find((b) => b.dataset.tag === 'GitHub')!.textContent).toContain('(1)');

    // 搜索命中的已归档条目同样不出现
    ui.searchInput!.value = '冷存';
    ui.searchInput!.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(container.querySelectorAll('.fav-card').length).toBe(0);
  });

  it('批量余额只喂未归档条目（冷存不发 API）', async () => {
    const { ui, dm } = await setup();
    const llm = { apiKeys: 'sk', balanceUrl: 'https://api.example.com/balance' };
    await dm.add(makeItem({ id: '1', tags: ['大模型'], type: '大模型', llmConfig: llm }));
    await dm.add(makeItem({ id: '2', title: '冷存模型', tags: ['大模型'], type: '大模型', archived: true, llmConfig: llm }));
    const spy = vi.spyOn(ui.balanceService, 'fetchAllBalances').mockResolvedValue({});
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].map((i: any) => i.id)).toEqual(['1']);
  });
});

describe('收藏本 smartcat 观察挂点（ticket 078 域事件派发）', () => {
  beforeEach(() => {
    mockNotify = vi.fn((_evt?: unknown) => {});
    offNotifySpy = onDomainEvent('favorites', (evt) => mockNotify(evt));
  });

  afterEach(() => {
    offNotifySpy();
    closeItemMenu();
  });

  it('添加挂点：保存成功后发 {kind: add, item}（最终落盘的 data 对象）', async () => {
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

  it('归档挂点：确认归档成功后通知 {kind: archive, title}（ticket 140）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('归档');
    await new Promise((r) => setTimeout(r, 10));
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));

    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith({ kind: 'archive', title: '我的项目' });
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

describe('收藏本修复回归（P0-7 层级 / P1-36 余额状态 / P1-37 并发写回）', () => {
  afterEach(() => {
    closeItemMenu();
    vi.unstubAllGlobals();
  });

  it('添加弹窗遮罩/弹窗 z 动态发号（ADR-0067）：遮罩在下、本体在上', async () => {
    const { ui } = await setup();
    ui.build();
    const mz = parseInt(ui.addMask!.style.zIndex, 10);
    expect(Number.isFinite(mz)).toBe(true);
    expect(parseInt(ui.addPopup!.style.zIndex, 10)).toBeGreaterThan(mz); // 后创建/后显示者在上
  });

  it('P1-36：查询失败后自动刷新成功 → balanceError 清空（内存+落盘），卡片不再显示错误态', async () => {
    const { ui, dm } = await setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ balance: 42.5 }) }));
    await dm.add(makeItem({
      id: '9', tags: ['大模型'], type: '大模型', title: 'LLM', url: '',
      llmConfig: { apiKeys: 'sk-1', balanceUrl: 'https://api.example.com/balance' },
      balance: null, balanceCacheTime: null, balanceError: 'HTTP 500',
    }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 30));

    const saved = (await dm.getAll())[0];
    expect(saved.balance).toBe('42.5');
    expect(saved.balanceError).toBeNull(); // 落盘清空（不再粘滞）
    expect(ui.currentItems.find((i) => i.id === '9')!.balanceError).toBeNull(); // 内存清空
    const container = document.getElementById('fav-entries-container')!;
    expect(container.textContent).toContain('(余额: 42.5)');
    expect(container.textContent).not.toContain('❌');
  });

  it('P1-36：编辑时取消「大模型」标签保存 → llmConfig/balance/balanceCacheTime 显式置 null，无幽灵查询', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { ui, dm } = await setup();
    await dm.add(makeItem({
      id: '7', title: 'LLM 条目', tags: ['大模型', '网站'], type: '大模型', url: '',
      llmConfig: { apiKeys: 'sk-old', balanceUrl: '' },
      balance: '9.9', balanceCacheTime: Date.now(), balanceError: null,
    }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    // 打开编辑弹窗，取消「大模型」标签（保留「网站」）后保存
    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('编辑');
    await new Promise((r) => setTimeout(r, 10));
    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === '大模型')!.click(); // 取消选中
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 30));

    const saved = (await dm.getAll())[0];
    expect(saved.tags).toEqual(['网站']);
    expect(saved.llmConfig).toBeNull();
    expect(saved.balance).toBeNull();
    expect(saved.balanceCacheTime).toBeNull();
    // 无幽灵查询：保存后的自动刷新不再对该条目发起余额请求
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('P1-36：更换 apiKeys 保存（无余额URL）→ 旧余额缓存一并失效置空', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { ui, dm } = await setup();
    await dm.add(makeItem({
      id: '7', title: 'LLM 条目', tags: ['大模型'], type: '大模型', url: '',
      llmConfig: { apiKeys: 'sk-old', balanceUrl: '' },
      balance: '9.9', balanceCacheTime: Date.now(), balanceError: null,
    }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('编辑');
    await new Promise((r) => setTimeout(r, 10));
    ui.llmApiKeysInput!.value = 'sk-new';
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 30));

    const saved = (await dm.getAll())[0];
    expect(saved.llmConfig).toMatchObject({ apiKeys: 'sk-new' });
    expect(saved.balance).toBeNull(); // 旧 key 的 9.9 不残留
    expect(saved.balanceCacheTime).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled(); // 未取到新值前不携带旧余额
  });

  it('P1-37：_batchUpdate 写前重读比对——读后并发变更基于最新值重套本批结果再写', async () => {
    const { ui } = await setup();
    let store: any[] = [makeItem({ id: '1', title: 'A' }), makeItem({ id: '2', title: 'B' })];
    let reads = 0;
    const writeMock = vi.fn(async (data: any[]) => {
      store = data.map((x) => ({ ...x }));
    });
    ui.dataManager = {
      read: vi.fn(async () => {
        reads++;
        if (reads === 2) store = store.map((x) => (x.id === '2' ? { ...x, title: 'B-并发改' } : x)); // 第一次读后被并发写入者改
        return store.map((x) => ({ ...x }));
      }),
      write: writeMock,
    } as any;

    await ui._batchUpdate({ '1': { balance: '42.5', balanceCacheTime: 1234567890 } });

    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(store.find((x) => x.id === '1')!.balance).toBe('42.5');   // 本批结果落盘
    expect(store.find((x) => x.id === '2')!.title).toBe('B-并发改'); // 并发写入者的变更未丢
  });
});

describe('收藏本设置弹窗（ticket 131 声明式）', () => {
  afterEach(() => {
    vi.useRealTimers();
    Platform.isMobile = false;
  });

  async function openSettings(ui: UIManager): Promise<HTMLElement> {
    ui.build();
    const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.title === '收藏本设置')!;
    settingsBtn.click();
    return document.getElementById('bz-settings-modal-popup') as HTMLElement;
  }

  it('桌面端：空态域（emptyText/emptyDesc 保留）；无任何可见设置项（移动端组被空态整体替换）', async () => {
    const { ui } = await setup();
    const popup = await openSettings(ui);
    expect(popup.textContent).toContain('收藏本设置');
    // 空态（ticket 131 Q11：分组卡片方案下桌面端无可见设置项 → 照常显示空态文案，
    // openSettingsModal 空态判定把隐藏的移动端组整体替换为 emptyText/emptyDesc）
    expect(popup.querySelector('.bz-settings-empty')!.textContent).toContain('收藏本没有可配置的设置项');
    expect(popup.querySelector('.bz-settings-empty-desc')!.textContent).toContain('数据文件路径由全局设置「数据存储路径」统一管理');
    // 无任何分组卡片/设置项残留
    expect(popup.querySelector('.bz-settings-group')).toBeNull();
    expect(popup.querySelector('.setting-item')).toBeNull();
  });

  it('移动端：显示「移动端」分组卡片 + 「移动端默认全屏」行（多数派逐字文案），开关键直绑写 data.json', async () => {
    Platform.isMobile = true;
    const state = { favoritesStoragePath: 'CONFIG/STORAGE', favoritesMobileDefaultFullscreen: true } as Record<string, unknown>;
    setSettingsProvider(() => state as any);
    const dm = new DataManager('CONFIG/STORAGE/favorites.json');
    const ui = new UIManager(dm, new FavoritesAIService(), null);
    const popup = await openSettings(ui);
    // 移动端可见组唯一：分组卡片（向 520 看齐——maxWidth 由弹窗壳承担）
    const heads = [...popup.querySelectorAll('.bz-settings-group-head')];
    expect(heads.map((el) => (el as HTMLElement).textContent!.trim())).toEqual(['移动端1 项']);
    expect(popup.querySelector('.bz-settings-empty')).toBeNull(); // 有可见设置项 → 无空态
    const row = [...popup.querySelectorAll('.setting-item')].find(
      (el) => (el as HTMLElement).dataset.name === '移动端默认全屏'
    ) as HTMLElement;
    // 文案与现网一致（ticket 100 收敛为多数派逐字文案，同归物本）
    // ticket 170：移动端组去描述
    expect((row as any).__setting.desc).toBeFalsy();
    const toggle = (row as any).__setting.controls.find((c: any) => typeof c.trigger === 'function');
    expect(toggle.value).toBe(true); // 键直绑初始值回填
    toggle.trigger(false); // 即时写内存 + 落盘
    expect(state.favoritesMobileDefaultFullscreen).toBe(false);
  });
});

describe('收藏本 ticket 141 UX 批次（分页/空态区分/排序/撤销/防重入/脏拦截）', () => {
  afterEach(() => {
    closeItemMenu();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Platform.isMobile = false;
  });

  /** 注入可变设置对象 + 保存计数（排序持久化验证用） */
  function useSettingsState(extra: Record<string, unknown> = {}) {
    const state: Record<string, unknown> = { favoritesStoragePath: 'CONFIG/STORAGE', ...extra };
    let saveCount = 0;
    setSettingsProvider(() => state as any);
    setSettingsSaver(async () => { saveCount++; });
    return {
      state,
      get saveCount() { return saveCount; },
    };
  }

  it('分页：超 50 条首屏只渲 50 + 加载指示，滚动到底自动加载全量', async () => {
    const { ui, dm } = await setup();
    for (let i = 0; i < 60; i++) {
      await dm.add(makeItem({ id: String(i), title: '条目' + i, created: `2025-01-01 00:00:${String(i).padStart(2, '0')}` }));
    }
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelectorAll('.fav-card').length).toBe(50);
    expect(container.querySelector('.bz-fav-load-more')).not.toBeNull();
    expect(container.querySelector('.bz-fav-load-more')!.textContent).toBe('滚动加载更多...');
    expect(container.querySelector('.fav-card')!.textContent).toContain('条目59'); // 默认创建时间最新优先

    // 滚动到底（jsdom 无布局：scrollHeight/clientHeight 为 0，阈值恒满足）→ 追加至全量
    container.dispatchEvent(new Event('scroll'));
    expect(container.querySelectorAll('.fav-card').length).toBe(60);
    expect(container.querySelector('.bz-fav-load-more')).toBeNull();
    // 全量后滚动不重复渲染
    container.dispatchEvent(new Event('scroll'));
    expect(container.querySelectorAll('.fav-card').length).toBe(60);

    // 搜索词变化重置分页：命中 11 条 < 50 无指示器
    ui.searchInput!.value = '条目5';
    ui.searchInput!.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(container.querySelectorAll('.fav-card').length).toBe(11); // 条目5/50..59
    expect(container.querySelector('.bz-fav-load-more')).toBeNull();
  });

  it('分页：标签筛选变化同样重置分页', async () => {
    const { ui, dm } = await setup();
    for (let i = 0; i < 55; i++) {
      await dm.add(makeItem({ id: 'g' + i, title: 'G' + i, created: `2025-01-01 00:00:${String(i).padStart(2, '0')}` }));
    }
    await dm.add(makeItem({ id: 'w1', title: '网页', tags: ['网站'], type: '网站', url: '' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const container = document.getElementById('fav-entries-container')!;
    expect(container.querySelectorAll('.fav-card').length).toBe(50);

    const tagBtns = [...document.querySelectorAll('.fav-tag-btn')] as HTMLElement[];
    tagBtns.find((b) => b.dataset.tag === '网站')!.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelectorAll('.fav-card').length).toBe(1);
  });

  it('搜索无结果与空库文案区分：无结果带关键词 + 小字提示；清空恢复', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem());
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const container = document.getElementById('fav-entries-container')!;

    // 命中：正常卡片
    ui.searchInput!.value = '项目';
    ui.searchInput!.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(container.querySelectorAll('.fav-card').length).toBe(1);

    // 无结果：没有匹配「关键词」的收藏 + 试试其他关键词小字（不出现空库欢迎语）
    ui.searchInput!.value = '不存在的词';
    ui.searchInput!.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(container.textContent).toContain('没有匹配「不存在的词」的收藏');
    expect(container.textContent).toContain('试试其他关键词，或清除搜索');
    expect(container.textContent).not.toContain('暂无收藏');

    // 清空搜索恢复列表
    ui.searchInput!.value = '';
    ui.searchInput!.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 250));
    expect(container.querySelectorAll('.fav-card').length).toBe(1);
  });

  it('空库保留原欢迎文案（ticket 141 只改搜索无结果分支）', async () => {
    const { ui } = await setup();
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    const container = document.getElementById('fav-entries-container')!;
    expect(container.textContent).toContain('暂无收藏 🎉');
    expect(container.textContent).toContain('点右上角 ✏️ 添加第一个收藏');
  });

  it('排序：弹窗三选项实时生效 + 持久化 favoritesSortKey + 置顶优先于排序', async () => {
    const { ui, dm } = await setup();
    // 注入可变设置对象须在 setup 之后（setup 自带 provider 会覆盖）
    const settings = useSettingsState({ favoritesSortKey: 'created' });
    await dm.add(makeItem({ id: '1', title: 'Banana', url: 'https://a.com/x', created: '2025-01-01 00:00:00' }));
    await dm.add(makeItem({ id: '2', title: 'Apple', url: 'https://z.com/x', created: '2025-01-02 00:00:00' }));
    await dm.add(makeItem({ id: '3', title: 'Cherry', url: 'https://m.com/x', created: '2025-01-03 00:00:00', pinned: true }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    const titles = () => [...document.querySelectorAll('#fav-entries-container .bz-fav-title')].map((e) => e.textContent);
    // 默认 created 最新优先：置顶 Cherry 在前，其后 Apple(01-02)、Banana(01-01)
    expect(titles()).toEqual(['Cherry', 'Apple', 'Banana']);

    // 头部 🔀 打开排序弹窗
    const sortBtn = [...document.querySelectorAll('.fav-header button')].find((b) => (b as HTMLButtonElement).title === '排序') as HTMLButtonElement;
    sortBtn.click();
    const mask = document.querySelector('.bz-fav-sort-mask') as HTMLElement;
    expect(mask).not.toBeNull();
    const options = [...mask.querySelectorAll('.bz-fav-sort-option')] as HTMLElement[];
    expect(options.map((b) => b.textContent)).toEqual(['创建时间最新优先', '标题', '域名']);
    expect(options[0].classList.contains('bz-fav-sort-option--active')).toBe(true);

    // 标题：实时重排（置顶仍优先）+ 持久化
    options.find((b) => b.textContent === '标题')!.click();
    expect(titles()).toEqual(['Cherry', 'Apple', 'Banana']); // Cherry 置顶优先于标题排序
    expect(settings.state.favoritesSortKey).toBe('title');
    expect(settings.saveCount).toBe(1);
    expect(mask.querySelector('.bz-fav-sort-option--active')!.textContent).toBe('标题'); // 弹窗保持 + 高亮更新

    // 域名：a.com(Banana) → m.com(Cherry) → z.com(Apple)，置顶 Cherry 仍最前
    options.find((b) => b.textContent === '域名')!.click();
    expect(titles()).toEqual(['Cherry', 'Banana', 'Apple']);
    expect(settings.state.favoritesSortKey).toBe('domain');
    expect(settings.saveCount).toBe(2);

    // ❌ 关闭弹窗
    (mask.querySelector('.bz-fav-sort-close') as HTMLButtonElement).click();
    expect(document.querySelector('.bz-fav-sort-mask')).toBeNull();
  });

  it('排序：无 favoritesSortKey / 非法值回退默认最新优先（无字段=默认）', async () => {
    const { ui } = await setup();
    const settings = useSettingsState();
    expect(ui.sortKey).toBe('created'); // 无字段 = 默认
    settings.state.favoritesSortKey = 'bogus';
    expect(ui.sortKey).toBe('created'); // 非法值回退
    settings.state.favoritesSortKey = 'domain';
    expect(ui.sortKey).toBe('domain');
  });

  it('删除可撤销：撤销 toast 点击「撤销」→ restoreItem 原样插回 + 列表刷新', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '9', title: '被删条目' }));
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
    expect((await dm.getAll()).length).toBe(0);
    expect(document.querySelectorAll('#fav-entries-container .fav-card').length).toBe(0);

    const undoBtn = [...document.querySelectorAll('.bz-notice-action')].find((b) => b.textContent === '撤销') as HTMLButtonElement;
    expect(undoBtn).toBeTruthy();
    undoBtn.click();
    await new Promise((r) => setTimeout(r, 20));

    const restored = await dm.getAll();
    expect(restored.length).toBe(1);
    expect(restored[0].title).toBe('被删条目');
    expect(restored[0].created).toBe('2025-06-01 08:00:00'); // 完整条目原样插回
    expect(document.querySelectorAll('#fav-entries-container .fav-card').length).toBe(1); // 撤销后刷新列表
    expect(document.querySelector('#fav-entries-container .fav-card')!.textContent).toContain('被删条目');
  });

  it('删除写盘失败（通病 2）：notifySaveError 人话提示，不弹撤销 toast，数据仍在', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '9', title: '删不掉' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    vi.spyOn(dm, 'delete').mockRejectedValue(new Error('磁盘只读'));
    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('删除');
    await new Promise((r) => setTimeout(r, 10));
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 20));

    expect(hasNotice('保存失败（删除收藏）：磁盘只读')).toBe(true);
    expect([...document.querySelectorAll('.bz-notice-action')].some((b) => b.textContent === '撤销')).toBe(false);
    expect((await dm.getAll()).length).toBe(1); // 数据仍在
  });

  it('保存防重入：保存中禁用确定 + 文案「保存中…」，重复点击不重复入库，完成恢复', async () => {
    const { ui, dm } = await setup();
    ui.build();
    ui.openAddDialog();
    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === 'GitHub')!.click();
    ui.addTitleInput!.value = '防重入条目';

    let resolveAdd: (v: any[]) => void = () => {};
    const addSpy = vi.spyOn(dm, 'add').mockImplementation(() => new Promise<any[]>((res) => { resolveAdd = res; }));
    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(ui.addSaveBtn!.disabled).toBe(true);
    expect(ui.addSaveBtn!.textContent).toBe('保存中…');

    ui.addSaveBtn!.click(); // 保存中再点：_saving 防重入拦截
    await new Promise((r) => setTimeout(r, 10));
    expect(addSpy).toHaveBeenCalledTimes(1);

    resolveAdd([]);
    await new Promise((r) => setTimeout(r, 20));
    expect(ui.addSaveBtn!.disabled).toBe(false);
    expect(ui.addSaveBtn!.textContent).toBe('确定'); // 弹窗已关，复位添加态文案
    expect(ui.addPopup!.style.display).toBe('none');
  });

  it('保存失败恢复按钮：add 抛错 → 按钮恢复可点 + 文案复位 + 弹窗保持', async () => {
    const { ui, dm } = await setup();
    ui.build();
    ui.openAddDialog();
    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === 'GitHub')!.click();
    ui.addTitleInput!.value = '会失败的条目';
    vi.spyOn(dm, 'add').mockRejectedValue(new Error('磁盘错误'));

    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(hasNotice('保存失败：磁盘错误')).toBe(true);
    expect(ui.addSaveBtn!.disabled).toBe(false);
    expect(ui.addSaveBtn!.textContent).toBe('确定');
    expect(ui.addPopup!.style.display).toBe('flex'); // 弹窗保持打开可重试
  });

  it('保存态文案区分：大模型 + 余额URL → 「查询余额中…」，查询完成入库关窗', async () => {
    const { ui, dm } = await setup();
    // fetch 挂起可控行：捕获「查询余额中…」中间态
    let resolveFetch: (v: any) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<any>((res) => { resolveFetch = res; })));
    ui.build();
    ui.openAddDialog();
    const typeBtns = [...document.querySelectorAll('.fav-type-btn')] as HTMLElement[];
    typeBtns.find((b) => b.dataset.tag === '大模型')!.click();
    ui.addTitleInput!.value = 'LLM 条目';
    ui.llmApiKeysInput!.value = 'sk-1';
    ui.llmBalanceUrlInput!.value = 'https://api.example.com/balance';

    ui.addSaveBtn!.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.addSaveBtn!.disabled).toBe(true);
    expect(ui.addSaveBtn!.textContent).toBe('查询余额中…');

    resolveFetch({ ok: true, json: async () => ({ balance: 42.5 }) });
    await new Promise((r) => setTimeout(r, 30));
    expect(ui.addPopup!.style.display).toBe('none');
    expect((await dm.getAll())[0].balance).toBe('42.5');
    expect(ui.addSaveBtn!.disabled).toBe(false);
  });

  it('脏表单拦截：空白直接关；有输入点遮罩 → confirm「放弃」才关、「继续编辑」保持', async () => {
    const { ui } = await setup();
    ui.build();

    // 空白：点遮罩直接关，无 confirm
    ui.openAddDialog();
    ui.addMask!.click();
    expect(ui.addMask!.style.display).toBe('none');
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();

    // 有输入：confirm 弹出
    ui.openAddDialog();
    ui.addTitleInput!.value = '未保存草稿';
    ui.addMask!.click();
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
    expect(ui.addMask!.style.display).toBe('flex'); // 未直接关

    // 继续编辑 → 弹窗保持 + 草稿还在
    // （flow-dialog 双动作按位置定 id：第一动作「放弃」=__shared_confirm_cancel__（左），
    //   第二动作「继续编辑」=__shared_confirm_ok__（右）——确认框 DOM 契约「取消左、确认右」）
    (document.getElementById('__shared_confirm_ok__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.addMask!.style.display).toBe('flex');
    expect(ui.addTitleInput!.value).toBe('未保存草稿');

    // 放弃 → 关闭
    ui.addMask!.click();
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.addMask!.style.display).toBe('none');
  });

  it('脏表单拦截：ESC 关闭同样拦截；编辑模式未改动不误拦（基线=回填值）', async () => {
    const { ui, dm } = await setup();
    await dm.add(makeItem({ id: '7', title: '原标题' }));
    ui.build();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));

    // ESC + 有输入 → confirm；「放弃」（第一动作 = __shared_confirm_cancel__）→ 关闭
    ui.openAddDialog();
    ui.addTitleInput!.value = '草稿';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((r) => setTimeout(r, 10));
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.addMask!.style.display).toBe('none');

    // 编辑模式：未改动 → 遮罩直接关（回填值=基线，不算脏）
    const card = document.querySelector('#fav-entries-container .fav-card') as HTMLElement;
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('编辑');
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.addSaveBtn!.textContent).toBe('更新');
    ui.addMask!.click();
    expect(ui.addMask!.style.display).toBe('none');
    expect(document.getElementById('__shared_confirm_mask__')).toBeNull();

    // 编辑模式：改动标题 → 拦截
    rightClickOpen(card);
    await new Promise((r) => setTimeout(r, 10));
    clickAction('编辑');
    await new Promise((r) => setTimeout(r, 10));
    ui.addTitleInput!.value = '改了一半';
    ui.addMask!.click();
    expect(document.getElementById('__shared_confirm_mask__')).not.toBeNull();
    (document.getElementById('__shared_confirm_cancel__') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 10));
    expect(ui.addMask!.style.display).toBe('none');
  });
});

