/**
 * 设置面板 UI（settings-panel，ADR-0080）
 * 一比一复刻原型 .scratch/global-settings-panel-prototype.html：
 * - 桌面端：B 侧栏工作台（左域导航 + 右内容区）；无底部快捷键提示、无右侧导航条
 * - 移动端：M1 命令面板（搜索 + 域列表）；主面板真全屏 + 关闭按钮
 * - 子面板（域设置 / 文件选择器）：一律复用既有 core 组件——
 *   域设置 → openSettingsModal + 各域既有 schema（功能性与 ⚙️ 完全一致）；
 *   路径行 → renderPathSettingRow + openPathPicker（ADR-0061）。
 * - 面板本身是聚合导航，不另造设置写入通道。
 */
import { App, setIcon } from 'obsidian';
import { createOverlay, topifyZ } from '../core/dom';
import { escManager } from '../core/esc-manager';
import { isMobileEnv, applyMobileWindowFullscreen } from '../core/mobile';
import { tryGetSettings } from '../core/settings-provider';
import { openSettingsModal } from '../core/settings-modal';
import { notice } from '../core/notice';
import { getApp } from '../core/app';
import type { SettingsSchema } from '../core/settings-schema';

/* ==================== 域清单（与原型一致，全局 + 20 域） ==================== */

interface DomainDef {
  id: string;
  name: string;
  icon: string; // lucide 图标名（setIcon 用）
  desc: string;
  /** 无任何设置项（归物本/收藏本） */
  noSettings?: boolean;
  /** 全局：打开 Obsidian 设置页（AI / 数据存储路径） */
  openMainTab?: boolean;
  /** 有真实设置 schema 的域：打开 openSettingsModal（与 ⚙️ 同源） */
  hasSchema?: boolean;
}

const DOMAINS: DomainDef[] = [
  { id: 'global', name: '全局', icon: 'settings-2', desc: 'AI、存储路径、移动端全屏与入口偏好', openMainTab: true },
  { id: 'diary', name: '日记本', icon: 'notebook', desc: '日记目录、显示与默认视图', hasSchema: true },
  { id: 'memo', name: '备忘录', icon: 'sticky-note', desc: '提醒与到期行为', hasSchema: true },
  { id: 'belongings', name: '归物本', icon: 'package', desc: '物品登记与查找', noSettings: true },
  { id: 'clipping', name: '剪藏本', icon: 'scissors', desc: '网页剪藏与聚合讯', hasSchema: true },
  { id: 'news', name: '聚合讯', icon: 'rss', desc: '资讯聚合', hasSchema: true },
  { id: 'password', name: '密码本', icon: 'key', desc: '账号密码管理', hasSchema: true },
  { id: 'favorites', name: '收藏本', icon: 'star', desc: '收藏条目', noSettings: true },
  { id: 'library', name: '书库', icon: 'library', desc: '藏书与读书笔记', hasSchema: true },
  { id: 'reading-report', name: '阅读报告', icon: 'bar-chart-3', desc: '阅读统计', hasSchema: true },
  { id: 'movie', name: '影视', icon: 'film', desc: '影视目录与海报', hasSchema: true },
  { id: 'review', name: '复习计划', icon: 'calendar', desc: '间隔重复与做题', hasSchema: true },
  { id: 'quiz', name: '做题家', icon: 'brain', desc: '题目练习（并入复习计划）', hasSchema: true },
  { id: 'secondbrain', name: '第二大脑', icon: 'brain', desc: '嵌入检索与对话', hasSchema: true },
  { id: 'auto-summary', name: '自动摘要', icon: 'sparkles', desc: '剪藏自动摘要', hasSchema: true },
  { id: 'launcher', name: '入口页', icon: 'layout-grid', desc: '命令磁贴入口', hasSchema: true },
  { id: 'pomodoro', name: '番茄钟', icon: 'timer', desc: '专注计时与休息', hasSchema: true },
  { id: 'attach', name: '附件搬移', icon: 'folder-down', desc: '附件整理', hasSchema: true },
  { id: 'bili-downloader', name: 'B站下载', icon: 'download', desc: 'B站视频下载任务', hasSchema: true },
  { id: 'encrypt', name: '加密保险箱', icon: 'lock', desc: '加密文件保险箱', hasSchema: true },
  { id: 'smartcat', name: '小橘陪伴猫', icon: 'cat', desc: '桌面宠物陪伴', hasSchema: true },
  { id: 'literature', name: '文献笔记', icon: 'book-open', desc: '文献管理与术语', hasSchema: true },
];

/**
 * 打开某域设置：与各域 ⚙️ 完全同源——复用既有声明式 schema + openSettingsModal。
 * review 的 schema 依赖 dataManager：走 reviewApp.ensure 惰性构造（与主面板同实例）。
 */
async function openDomainSettings(domain: DomainDef): Promise<void> {
  const app = getApp();
  if (domain.noSettings) {
    notice(`「${domain.name}」暂无设置项`);
    return;
  }
  if (domain.openMainTab) {
    // 全局 → 打开 Obsidian 设置页（bz 区块：AI / 数据存储路径）
    (app as any).setting.open();
    notice('请在 bz 设置页配置 AI 与数据存储路径');
    return;
  }

  // 逐域懒加载真实 schema（与各域 ⚙️ 弹窗同一数据源）
  let schema: SettingsSchema | null = null;
  let title = `${domain.name}设置`;
  try {
    switch (domain.id) {
      case 'review': {
        const { reviewApp } = await import('../review/app');
        reviewApp.ensure(app);
        const { reviewSettingsSchema } = await import('../review/ui');
        schema = reviewSettingsSchema({ app, dataManager: reviewApp.dataManager! });
        title = '复习计划设置';
        break;
      }
      case 'secondbrain': {
        const { secondBrainSettingsSchema } = await import('../secondbrain/panel');
        schema = secondBrainSettingsSchema();
        title = '第二大脑设置';
        break;
      }
      case 'pomodoro': {
        const { pomodoroSettingsSchema } = await import('../pomodoro/ui');
        schema = pomodoroSettingsSchema();
        title = '番茄钟设置';
        break;
      }
      case 'global':
      case 'diary':
      case 'memo':
      case 'clipping':
      case 'news':
      case 'password':
      case 'library':
      case 'reading-report':
      case 'movie':
      case 'quiz':
      case 'auto-summary':
      case 'launcher':
      case 'attach':
      case 'bili-downloader':
      case 'encrypt':
      case 'smartcat':
      case 'literature':
      default:
        // 未接入真实 schema 的域：占位提示（后续逐步接入）
        notice(`「${domain.name}」设置将在此呈现（待接入各域 schema）`);
        return;
    }
  } catch (e) {
    notice(`打开「${domain.name}」设置失败：${(e as Error).message}`, 'error');
    return;
  }

  if (schema) {
    openSettingsModal({ title, maxWidth: 560, schema });
  }
}

/* ==================== 面板 UI（桌面 B + 移动 M1） ==================== */

export class SettingsPanelUI {
  private mask: HTMLElement | null = null;
  private popup: HTMLElement | null = null;
  private escHandle: { unregister: () => void } | null = null;
  private activeDomain = 0;

  open(): void {
    if (this.mask && this.popup) {
      // 已打开 → 顶置并显示（幂等）
      topifyZ(this.mask, this.popup);
      this.mask.style.display = 'block';
      this.popup.style.display = 'flex';
      return;
    }
    this.build();
  }

  private build(): void {
    const { mask, popup } = createOverlay({
      maskId: 'bz-settings-panel-mask',
      popupId: 'bz-settings-panel-popup',
      maxWidth: 920,
      onMaskClick: () => this.hide(),
    });
    this.mask = mask;
    this.popup = popup;

    // 移动端默认全屏（ADR-0019 同款键；原型：主面板真全屏 + 关闭按钮）
    applyMobileWindowFullscreen(popup, tryGetSettings().settingsPanelMobileDefaultFullscreen === true);

    if (isMobileEnv()) {
      this.buildMobile(popup);
    } else {
      this.buildDesktop(popup);
    }

    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = 'block';
    popup.style.display = 'flex';
    topifyZ(mask, popup);

    this.escHandle = escManager.register('bz-settings-panel', {
      isVisible: () => !!this.mask && this.mask.style.display === 'block',
      close: () => this.hide(),
    });
  }

  /** 桌面：B 侧栏工作台（左导航 + 右内容，无底部提示/右侧导航条） */
  private buildDesktop(popup: HTMLElement): void {
    popup.classList.add('bz-sp-desk');
    popup.innerHTML = `
      <div class="bz-sp-desk-side">
        <div class="bz-sp-brand">
          <span class="bz-sp-logo"></span>
          <span class="bz-sp-brand-name">设置</span>
        </div>
        <div class="bz-sp-search">
          <span class="bz-sp-search-ic"></span>
          <input class="bz-sp-search-in" placeholder="搜索设置…" />
        </div>
        <div class="bz-sp-nav"></div>
      </div>
      <div class="bz-sp-desk-main">
        <div class="bz-sp-pane"></div>
      </div>
    `;
    setIcon(popup.querySelector('.bz-sp-logo')!, 'settings-2');
    setIcon(popup.querySelector('.bz-sp-search-ic')!, 'search');

    const nav = popup.querySelector('.bz-sp-nav')!;
    const pane = popup.querySelector('.bz-sp-pane') as HTMLElement;
    const searchIn = popup.querySelector('.bz-sp-search-in') as HTMLInputElement;

    const renderNav = (q: string) => {
      const query = q.trim();
      nav.innerHTML = '';
      DOMAINS.forEach((d, i) => {
        if (query && !d.name.includes(query) && !d.desc.includes(query)) return;
        const b = document.createElement('button');
        b.className = 'bz-sp-nav-item' + (i === this.activeDomain && !query ? ' on' : '');
        b.dataset.i = String(i);
        const ic = document.createElement('span');
        ic.className = 'bz-sp-nav-ic';
        setIcon(ic, d.icon);
        const nm = document.createElement('span');
        nm.className = 'bz-sp-nav-name';
        nm.textContent = d.name;
        b.append(ic, nm);
        b.addEventListener('click', () => {
          this.activeDomain = i;
          renderNav(searchIn.value);
          this.renderPane(pane, d);
        });
        nav.appendChild(b);
      });
    };

    searchIn.addEventListener('input', () => renderNav(searchIn.value));
    renderNav('');
    this.renderPane(pane, DOMAINS[this.activeDomain]);
  }

  /** 桌面右侧内容区：当前域预览 + 「打开设置」（点开走真实设置弹窗，与 ⚙️ 同源） */
  private renderPane(pane: HTMLElement, domain: DomainDef): void {
    pane.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'bz-sp-pane-head';
    const ic = document.createElement('span');
    ic.className = 'bz-sp-pane-ic';
    setIcon(ic, domain.icon);
    const title = document.createElement('h3');
    title.className = 'bz-sp-pane-title';
    title.textContent = domain.name;
    head.append(ic, title);
    pane.appendChild(head);

    const desc = document.createElement('div');
    desc.className = 'bz-sp-pane-desc';
    desc.textContent = domain.desc;
    pane.appendChild(desc);

    const openBtn = document.createElement('button');
    openBtn.className = 'bz-sp-open-btn';
    openBtn.textContent = domain.noSettings ? '查看设置' : '打开设置';
    openBtn.addEventListener('click', () => void openDomainSettings(domain));
    pane.appendChild(openBtn);

    const hint = document.createElement('div');
    hint.className = 'bz-sp-pane-hint';
    hint.textContent = domain.noSettings
      ? '该域没有可配置的设置。'
      : domain.openMainTab
        ? 'AI 服务商与数据存储路径在 bz 设置页配置，点击上方按钮直达。'
        : '点击「打开设置」进入该域设置（与面板右上角 ⚙️ 完全一致）。';
    pane.appendChild(hint);
  }

  /** 移动端：M1 命令面板（搜索 + 域列表，主面板全屏 + 关闭按钮） */
  private buildMobile(popup: HTMLElement): void {
    popup.classList.add('bz-sp-mobile');
    popup.innerHTML = `
      <div class="bz-sp-mob-head">
        <h2>⚙️ 设置</h2>
        <span class="bz-sp-mob-count">${DOMAINS.length} 域</span>
        <button class="bz-sp-mob-close" title="关闭">❌</button>
      </div>
      <div class="bz-sp-mob-search">
        <span class="bz-sp-search-ic"></span>
        <input class="bz-sp-search-in" placeholder="搜索设置、域…" />
      </div>
      <div class="bz-sp-mob-list"></div>
    `;
    setIcon(popup.querySelector('.bz-sp-mob-search .bz-sp-search-ic')!, 'search');

    const list = popup.querySelector('.bz-sp-mob-list')!;
    const searchIn = popup.querySelector('.bz-sp-mob-search .bz-sp-search-in') as HTMLInputElement;
    popup.querySelector('.bz-sp-mob-close')!.addEventListener('click', () => this.hide());

    const render = (q: string) => {
      const query = q.trim();
      list.innerHTML = '';
      DOMAINS.forEach((d) => {
        if (query && !d.name.includes(query) && !d.desc.includes(query)) return;
        const item = document.createElement('button');
        item.className = 'bz-sp-mob-item';
        const ic = document.createElement('span');
        ic.className = 'bz-sp-mob-ic';
        setIcon(ic, d.icon);
        const t = document.createElement('span');
        t.className = 'bz-sp-mob-t';
        const nm = document.createElement('span');
        nm.className = 'bz-sp-mob-name';
        nm.textContent = d.name;
        const ds = document.createElement('span');
        ds.className = 'bz-sp-mob-desc';
        ds.textContent = d.desc;
        t.append(nm, ds);
        const chev = document.createElement('span');
        chev.className = 'bz-sp-mob-chev';
        chev.textContent = '›';
        item.append(ic, t, chev);
        item.addEventListener('click', () => void openDomainSettings(d));
        list.appendChild(item);
      });
      if (!list.children.length) {
        const empty = document.createElement('div');
        empty.className = 'bz-sp-mob-empty';
        empty.textContent = `没有匹配「${query}」的设置或域`;
        list.appendChild(empty);
      }
    };

    searchIn.addEventListener('input', () => render(searchIn.value));
    render('');
  }

  hide(): void {
    if (this.mask) this.mask.style.display = 'none';
    if (this.popup) this.popup.style.display = 'none';
  }

  cleanup(): void {
    if (this.escHandle) {
      this.escHandle.unregister();
      this.escHandle = null;
    }
    if (this.mask) {
      this.mask.remove();
      this.mask = null;
    }
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
  }
}
