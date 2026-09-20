/**
 * 保险库全域深审拍板后修复批（呈报 #59/E5 + #60/E4）回归测试。
 * 命名独立（bd-encrypt-fix-*）防撞其他批次。
 *
 * - E5（呈报#59）：vault-assets-view 手绘 ICON_PATHS 表退役——vIc 改产 core 统一
 *   `<i data-lucide>` 占位（mountIcons 兑现，随 Obsidian lucide 升级自动跟随）；
 *   语义一枚不丢：无对应者走别名归一并注记（more-h→more-horizontal、star-outline→star）。
 * - E4（呈报#60）：保险库搜索框壳样式收编 core `.bz-search` 公共壳（components.css E 段
 *   单源）+ input 走 `.bz-input` 基线；ESC 清词 / ✕ 清词等已修好的行为零改动。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { SafeManager } from '../../src/encrypt/data';
import { UIManager } from '../../src/encrypt/ui';
import { vIc, statusbarHtml, overviewHTML, noteRowHTML, noteDetailHTML } from '../../src/encrypt/vault-assets-view';
import { PasswordVaultDataManager } from '../../src/password-vault/data';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';

const CONFIG = {
  root: 'CONFIG/.ENCRYPT',
  previewEnabled: false,
  previewSize: 384,
  previewQuality: 0.5,
  autoLoadOriginal: false,
  securityMode: false,
};

describe('E5：vIc 收编 core 统一图标机制（data-lucide 占位）', () => {
  it('vIc 产出 <i data-lucide> 占位，不再内联手绘 path 表', () => {
    const html = vIc('lock', 14);
    expect(html).toContain('<i data-lucide="lock"');
    // 手绘表退役：占位串里不允许再出现内联 <path>/Path 数据
    expect(html).not.toContain('<path');
    expect(html).not.toContain('<svg');
  });

  it('统一体系无对应者的语义走别名归一并保留语义（more-h / star-outline）', () => {
    // lucide 无 more-h 短名 → 官方名 more-horizontal
    expect(vIc('more-h', 16)).toContain('data-lucide="more-horizontal"');
    // lucide 无独立描边星变体 → star 默认即描边形态，语义不丢
    expect(vIc('star-outline', 14)).toContain('data-lucide="star"');
  });

  it('语义一枚不丢：24 枚各自映射到统一体系 lucide 名（表驱动）', () => {
    const table: Array<[string, string]> = [
      // [域内语义名, 统一体系 lucide 名]（旁注 = 保险库内用途）
      ['lock', 'lock'], // 上锁/锁态
      ['lock-open', 'lock-open'], // 解锁态
      ['key', 'key'], // 主密码/钥匙
      ['file-lock', 'file-lock'], // 加密笔记（合并形官方图标）
      ['book-lock', 'book-lock'], // 加密日记（合并形官方图标）
      ['eye', 'eye'], // 解密预览
      ['download', 'download'], // 取出还原
      ['trash-2', 'trash-2'], // 销毁
      ['copy', 'copy'], // 复制正文
      ['more-h', 'more-horizontal'], // 移动页菜单（lucide 无 more-h 短名）
      ['stethoscope', 'stethoscope'], // 保险库体检
      ['search', 'search'], // 搜索
      ['refresh-cw', 'refresh-cw'], // 刷新
      ['settings', 'settings'], // 设置
      ['x', 'x'], // 关闭/清除
      ['chevron-left', 'chevron-left'], // 移动页返回
      ['star', 'star'], // 星标
      ['star-outline', 'star'], // 星标描边变体（lucide 默认即描边）
      ['layout-grid', 'layout-grid'], // 概览
      ['plus', 'plus'], // 新增
      ['eye-off', 'eye-off'], // 隐藏
      ['triangle-alert', 'triangle-alert'], // 首设风险提醒
      ['film', 'film'], // 预览占位（历史遗留语义位）
      ['image', 'image'], // 随库附件
    ];
    for (const [name, lucide] of table) {
      expect(vIc(name, 14), `语义名 ${name} 应映射到 lucide ${lucide}`).toContain(`data-lucide="${lucide}"`);
    }
  });

  it('占位带 bz-vault-ic 语义类与尺寸档（mountIcons 保留 class，尺寸由域 CSS 容器规则/档位接管）', () => {
    expect(vIc('lock', 14)).toContain('class="bz-vault-ic bz-vault-ic--14"');
  });

  it('静态 helper 全部走占位（statusbar/overview/noteRow/noteDetail 无内联 svg）', () => {
    for (const html of [
      statusbarHtml(false),
      statusbarHtml(true),
      overviewHTML({
        counts: { note: 0, diary: 0 },
        attachments: 0,
        attBytes: 0,
        recent: [],
        health: null,
      }),
      noteRowHTML(
        { id: 'n1', title: 't', path: 'p', createdAt: '2026-01-01T00:00:00.000Z', attachments: [], kind: 'note' } as any,
        'note',
        false
      ),
      noteDetailHTML(
        { id: 'n1', title: 't', path: 'p', createdAt: '2026-01-01T00:00:00.000Z', attachments: [], kind: 'note' } as any,
        'note'
      ),
    ]) {
      expect(html).not.toContain('<path');
      expect(html).toContain('data-lucide');
    }
  });
});

describe('E5：渲染路径占位兑现（mountIcons 补挂全覆盖）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: UIManager;

  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => CONFIG as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new UIManager(sm, CONFIG, dm);
    await sm.unlock('pw');
  });

  afterEach(() => {
    ui.popup?.remove();
    ui.mask?.remove();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('ensureElements：骨架占位全部兑现（左栏/移动壳/状态图标），无残留 data-lucide', () => {
    ui.ensureElements();
    const popup = ui.popup!;
    expect(popup.querySelector('[data-icon="lock"]')).toBeTruthy(); // 品牌 seal（setIcon mock 记名）
    expect(popup.querySelector('[data-icon="file-lock"]')).toBeTruthy(); // 笔记 nav
    expect(popup.querySelector('[data-icon="book-lock"]')).toBeTruthy(); // 加密日记 nav
    expect(popup.querySelector('[data-icon="x"]')).toBeTruthy(); // 移动关闭钮
    expect(popup.querySelectorAll('[data-lucide]').length).toBe(0); // 无未兑现占位
  });

  it('桌面列表头/移动搜索框渲染后占位兑现，且行为层引用不受替换影响', async () => {
    ui.ensureElements();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    // 默认概览无列表头 → 切到 note 资产（enh-ui 同款路径）
    (ui.popup!.querySelector('[data-asset="note"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    // note 资产列表头搜索框：图标已兑现、框可聚焦可输入
    const head = ui.popup!.querySelector('[data-vault-search]') as HTMLInputElement;
    expect(head).toBeTruthy();
    expect(head.parentElement!.querySelector('[data-icon="search"]')).toBeTruthy();
    head.value = 'abc';
    head.dispatchEvent(new Event('input', { bubbles: true }));
    // 移动常驻框同
    const mob = document.querySelector('[data-mob-search]') as HTMLInputElement;
    expect(mob.parentElement!.querySelector('[data-icon="search"]')).toBeTruthy();
  });
});

describe('E4：搜索框壳收编 core .bz-search 公共壳（行为零改动）', () => {
  let vault: MockVault;
  let sm: SafeManager;
  let dm: PasswordVaultDataManager;
  let ui: UIManager;

  /** 进 note 资产（桌面列表头只在该资产渲染），返回桌面列表头搜索框 */
  async function openDeskNoteSearch(): Promise<HTMLInputElement> {
    ui.ensureElements();
    ui.show();
    await new Promise((r) => setTimeout(r, 20));
    (ui.popup!.querySelector('[data-asset="note"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    return ui.popup!.querySelector('[data-vault-search]') as HTMLInputElement;
  }

  beforeEach(async () => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    localStorage.clear();
    vault = new MockVault();
    setApp(mockAppWithVault(vault) as any);
    setSettingsProvider(() => CONFIG as any);
    sm = new SafeManager('CONFIG/.ENCRYPT');
    dm = new PasswordVaultDataManager(sm);
    ui = new UIManager(sm, CONFIG, dm);
    await sm.unlock('pw');
  });

  afterEach(() => {
    ui.popup?.remove();
    ui.mask?.remove();
    sm.lock();
    document.body.innerHTML = '';
  });

  it('桌面列表头：壳 = core .bz-search，input 带 .bz-input 基线，旧自绘壳类退役', async () => {
    const input = await openDeskNoteSearch();
    expect(input).toBeTruthy();
    expect(input.classList.contains('bz-input')).toBe(true);
    expect(input.parentElement!.classList.contains('bz-search')).toBe(true);
    // 旧自绘壳类退役（壳样式单源 core components.css E 段）
    expect(document.querySelector('.bz-vault-search')).toBeNull();
  });

  it('移动常驻框：同一 core 壳（.bz-search）+ 域内布局类叠加', () => {
    ui.ensureElements();
    const input = document.querySelector('[data-mob-search]') as HTMLInputElement;
    expect(input.classList.contains('bz-input')).toBe(true);
    const box = input.parentElement!;
    expect(box.classList.contains('bz-search')).toBe(true);
    expect(box.classList.contains('bz-vault-msearch')).toBe(true); // 移动布局（边距/触达高）保留
  });

  it('行为零改动：ESC 有词清词且不冒泡关面板', async () => {
    const input = await openDeskNoteSearch();
    input.focus();
    input.value = '关键词';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const escEvt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    input.dispatchEvent(escEvt);
    expect(input.value).toBe('');
    expect(escEvt.defaultPrevented).toBe(true);
    // 面板未被 escManager 关掉
    expect(ui.popup!.isConnected).toBe(true);
  });

  it('行为零改动：尾部 ✕ 一键清词', async () => {
    const input = await openDeskNoteSearch();
    input.value = '词';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const clearBtn = input.parentElement!.querySelector('[data-search-clear]') as HTMLButtonElement;
    expect(clearBtn.hidden).toBe(false); // 有词 ✕ 显形（效率整改 3 维持）
    clearBtn.click();
    expect(input.value).toBe('');
    expect((document.querySelector('[data-mob-search]') as HTMLInputElement).value).toBe('');
  });

  it('行为零改动：搜索图标占位兑现后 ✕ 钮仍在（替换不丢兄弟节点）', async () => {
    const input = await openDeskNoteSearch();
    const box = input.parentElement!;
    expect(box.querySelector('[data-icon="search"]')).toBeTruthy();
    expect(box.querySelector('[data-search-clear]')).toBeTruthy();
  });
});
