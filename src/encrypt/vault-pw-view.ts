/**
 * 保险库·密码资产子视图（encrypt 域；ADR-0085 自 password-vault/ui.ts 迁入重组）
 * 统一保险库面板的「密码」资产视图渲染器：
 *  - 桌面：平台聚合列表（列表卡） + 详情区账号卡（复制账号/密码显隐/复制密码/备注/时间）
 *  - 搜索态：展平账号行；移动：资产过滤卡流 + 平台/账号详情页
 *  - 动作走宿主注入的服务（确认框/toast/编辑弹窗/复制），本模块只管渲染与动作意图分发。
 * 本模块不持有 SafeManager 解锁/锁屏——由统一面板（UIManager）负责。
 */
import { escManager } from '../core/esc-manager';
import { createSiteIcon } from '../core/dom';
import { attachItemActions, openItemSheet, type ItemAction, type ItemActionsOptions } from '../core/item-actions';
import { formatRelativeTime } from '../core/utils';
import { PasswordVaultDataManager, type PasswordVaultEntry, type PlatformGroup } from './vault-data';

/**
 * 相对时间（密码条目创建/更新展示）：收编 core formatRelativeTime（enh-sweep B 包，
 * 「N分钟前」无空格全站口径），本域仅保留空输入返回空串的兜底语义。
 */
export function relTime(iso: string): string {
  if (!iso) return '';
  return formatRelativeTime(iso);
}

/** 密码掩码圆点 */
export function dots(p: string): string {
  return '•'.repeat(Math.min((p || '').length, 18));
}

/** 平台色：品牌色映射 + 哈希回退（金库 UI 同款） */
const PLATFORM_COLOR_MAP: Record<string, string> = {
  github: '#5a5f73',
  微信: '#3eb575',
  支付宝: '#4f7cf7',
  notion: '#111111',
  哔哩哔哩: '#fb7299',
  招商银行: '#d43d3d',
  豆瓣: '#3fa34d',
};
const PALETTE = ['#7c6bd6', '#3e8e5a', '#c98a1e', '#4f7cf7', '#d43d3d', '#2a9d8f', '#b4551d', '#5a5f73'];
export function colorOf(platform: string): string {
  const k = Object.keys(PLATFORM_COLOR_MAP).find((x) => (platform || '').toLowerCase().includes(x.toLowerCase()));
  if (k) return PLATFORM_COLOR_MAP[k];
  let h = 0;
  for (let i = 0; i < (platform || '?').length; i++) h = (h * 31 + (platform || '?').charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** 平台头像 HTML：品牌色字母底 + favicon 真实图标盖层（hydratePwAvatars 注入 <img>） */
function avatarHTML(platform: string, url: string | null | undefined, cls = 'bz-pwv-avatar'): string {
  const ch = (platform || '?').slice(0, 1);
  return `<div class="${cls}" style="background:${colorOf(platform)}" data-pwv-avatar="1" data-url="${escAttr(url || '')}"><span>${escAttr(ch)}</span></div>`;
}

/** 属性值 HTML 转义 */
function escAttr(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 给容器内所有 [data-pwv-avatar] 注入真实 favicon（createSiteIcon）；失败保留字母回退 */
function hydratePwAvatars(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>('[data-pwv-avatar]').forEach((box) => {
    if (box.querySelector('img')) return;
    const url = box.getAttribute('data-url');
    let domain: string | null = null;
    try {
      domain = url ? new URL(url).hostname : null;
    } catch (e) {
      domain = null;
    }
    const img = createSiteIcon(domain, 64);
    if (img) {
      img.className = 'bz-pwv-favicon';
      img.removeAttribute('style'); // createSiteIcon 内联尺寸 → 交给 CSS
      img.addEventListener('load', () => {
        const ch = box.querySelector('span');
        if (ch) ch.style.display = 'none';
      });
      box.appendChild(img);
    }
  });
}

/** 宿主服务：密码子视图需要的全部外部能力（由统一面板 UIManager 注入） */
export interface PwViewHost {
  toast(msg: string, isErr?: boolean): void;
  /** 打开添加/编辑密码条目弹窗（prefill 预填平台/链接；edit 条目为编辑） */
  openPwEntryDialog(edit?: PasswordVaultEntry | null, prefill?: { platform?: string; url?: string }): void;
  /** 打开平台信息编辑弹窗 */
  openPwPlatformEdit(platform: string): void;
  askConfirm(title: string, message: string, okLabel: string, onYes: () => void): void;
  /** 复制敏感文本（60s 自动清空由宿主实现） */
  copySensitive(text: string): Promise<boolean>;
  openExternal(url: string): void;
  /** 密码数据/显隐状态变化后要求宿主整体重渲染 */
  onPwChanged(): void;
  /** （移动端）打开单账号详情页 */
  openPwAccountPage?(d: PasswordVaultEntry, st: PwViewState): void;
}

/** 密码子视图状态（UIManager 持有；桌面/移动共享） */
export interface PwViewState {
  asset: 'pw';
  /** 桌面列表：平台聚合 或 搜索展平 */
  view: 'all' | 'fav';
  searchKw: string;
  selPlatform: string | null;
  selAccount: string | null;
  /** 显隐密码的条目 id */
  shownIds: Record<string, boolean>;
}

export const DEFAULT_PW_STATE: PwViewState = {
  asset: 'pw',
  view: 'all',
  searchKw: '',
  selPlatform: null,
  selAccount: null,
  shownIds: {},
};

/** 密码条目操作按钮意图（宿主 handlePwAccountAction 分发） */
export type PwAccountAct = 'copy-ac' | 'copy-pw' | 'eye' | 'edit' | 'fav' | 'del';

/** 账号卡明文展示自动回遮时长（防偷看：显示密码 ~15 秒后自动回掩码） */
export const PW_REVEAL_AUTO_MASK_MS = 15_000;

export class VaultPwView {
  private dm: PasswordVaultDataManager;
  private host: PwViewHost;
  /** 密码生成配置（构造快照） */
  private charset: string;
  private length: number;
  /** 明文自动回遮计时器（按条目 id；手动隐藏/上锁即撤） */
  private revealTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  constructor(dm: PasswordVaultDataManager, host: PwViewHost, cfg: { charset?: string; length?: string | number }) {
    this.dm = dm;
    this.host = host;
    this.charset = cfg.charset || '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';
    this.length = parseInt(String(cfg.length)) || 16;
  }

  /** 收藏星内联图标（替代 ★ 文本符号；图标一律 lucide——ui-kit 手册铁律） */
  private starIc(): string {
    return `<span class="star">${this.ic('star', 11)}</span>`;
  }

  /** 撤销单条明文自动回遮计时 */
  private clearRevealTimer(id: string): void {
    if (this.revealTimers[id]) {
      clearTimeout(this.revealTimers[id]);
      delete this.revealTimers[id];
    }
  }

  /** 卸载清理：撤销全部明文自动回遮计时器（防插件禁用后定时器仍触发改 UI） */
  disposeRevealTimers(): void {
    for (const id of Object.keys(this.revealTimers)) {
      clearTimeout(this.revealTimers[id]);
      delete this.revealTimers[id];
    }
  }

  // ---------- 桌面列表 ----------
  /**
   * 渲染密码资产桌面列表（平台聚合行 / 搜索展平行）到 container。
   * row 点击 → onPick(platform 或 account)；右键/长按 → 统一抽屉（平台/账号动作）。
   */
  renderDeskList(container: HTMLElement, st: PwViewState, onPick: (p: string | null, a: string | null) => void): void {
    container.innerHTML = '';
    const kw = st.searchKw;
    if (kw) {
      const hits = this.dm
        .search(kw)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
      if (!hits.length) {
        container.innerHTML = '<div class="bz-pwv-empty"><div class="t">没有匹配的条目</div><div class="d">换个关键词，或清空搜索</div></div>';
        return;
      }
      for (const d of hits) {
        const r = document.createElement('div');
        r.className = 'bz-pwv-row' + (d.id === st.selAccount ? ' on' : '');
        r.innerHTML = `${avatarHTML(d.platform, d.url)}
          <div class="mid"><div class="pl">${this.esc(d.platform)}${d.fav ? ' ' + this.starIc() : ''}</div><div class="ac">${this.esc(d.account || '(无账号)')}</div></div>
          <div class="tm">${relTime(d.createdAt)}</div>`;
        r.addEventListener('click', () => onPick(d.platform, d.id));
        this.attachAccountActions(r, d);
        container.appendChild(r);
      }
      hydratePwAvatars(container);
      return;
    }
    let plats = this.dm.platforms();
    if (st.view === 'fav') plats = plats.filter((p) => this.dm.hasFav(p.platform));
    if (!plats.length) {
      if (st.view === 'fav') {
        container.innerHTML = '<div class="bz-pwv-empty"><div class="t">还没有收藏</div><div class="d">右键或长按条目可收藏，常用账号一目了然</div></div>';
      } else {
        container.innerHTML = `<div class="bz-pwv-empty"><div class="t">保险库还没有密码</div><div class="d">收录第一条账号开始使用</div><button class="bz-pwv-empty-add" data-pwv="empty-add">${this.ic('plus')} 新增密码</button></div>`;
        container.querySelector('[data-pwv="empty-add"]')?.addEventListener('click', () => this.host.openPwEntryDialog());
      }
      return;
    }
    for (const p of plats) {
      const r = document.createElement('div');
      r.className = 'bz-pwv-plrow' + (p.platform === st.selPlatform ? ' on' : '');
      const recent = p.accounts[0];
      const favStar = this.dm.hasFav(p.platform) ? ' ' + this.starIc() : '';
      const countBadge = p.accounts.length > 1 ? `<span class="bz-pwv-cnt">${p.accounts.length}</span>` : '';
      r.innerHTML = `${avatarHTML(p.platform, recent?.url)}
        <div class="mid"><div class="pl">${this.esc(p.platform)}${favStar}${countBadge}</div><div class="ac">${recent ? this.esc(recent.account || '(无账号)') : ''}</div></div>
        <div class="tm">${relTime(recent && recent.createdAt)}</div>`;
      r.addEventListener('click', () => onPick(p.platform, null));
      this.attachPlatformActions(r, p.platform);
      container.appendChild(r);
    }
    hydratePwAvatars(container);
  }

  /** 渲染密码资产桌面详情区（平台账号卡流 / 搜索态单卡） */
  renderDeskDetail(container: HTMLElement, st: PwViewState): void {
    container.innerHTML = '';
    const kw = st.searchKw;
    let d: PasswordVaultEntry | undefined;
    if (kw) {
      d = this.dm.pwData.find((x) => x.id === st.selAccount);
      if (!d) {
        container.innerHTML = '<div class="bz-pwv-empty"><div class="t">选择一条结果</div><div class="d">点击左侧结果查看详情</div></div>';
        return;
      }
    } else if (st.selPlatform) {
      const accs = this.dm.accountsOf(st.selPlatform);
      const filtered = st.view === 'fav' ? accs.filter((x) => x.fav) : accs;
      const first = accs[0];
      const favStar = this.dm.hasFav(st.selPlatform) ? ' ' + this.starIc() : '';
      container.innerHTML = `<div class="bz-pwv-dhead">
        <div class="av big">${avatarHTML(st.selPlatform, first?.url, 'bz-pwv-avatar big')}</div>
        <div class="ttl"><h2>${this.esc(st.selPlatform)}${favStar}</h2>
          ${first && first.url ? `<a class="url" href="${this.esc(first.url)}" target="_blank" rel="noopener">${this.esc(first.url)} ↗</a>` : '<div class="url faint">无链接</div>'}</div>
        <div class="acts">
          <button class="bz-pwv-ic" data-pwv="plat-edit" title="编辑平台信息">${this.ic('pencil')}</button>
        </div>
      </div>
      <div class="bz-pwv-accthead">
        <div class="t">${filtered.length} 个账号</div>
        <button class="bz-pwv-addacct" data-pwv="plat-add">${this.ic('plus', 12)} 在该平台新增账号</button>
      </div>
      <div class="bz-pwv-accts"></div>`;
      const acctsEl = container.querySelector('.bz-pwv-accts') as HTMLElement;
      if (!filtered.length) {
        acctsEl.innerHTML = '<div class="bz-pwv-empty"><div class="t">该平台暂无账号</div><div class="d">点上方「在该平台新增账号」录入</div></div>';
      } else {
        for (const x of filtered) acctsEl.appendChild(this.buildAccountCard(x, st));
      }
      container.querySelector('[data-pwv="plat-edit"]')?.addEventListener('click', () => this.host.openPwPlatformEdit(st.selPlatform!));
      container.querySelector('[data-pwv="plat-add"]')?.addEventListener('click', () =>
        this.host.openPwEntryDialog(null, { platform: st.selPlatform || '', url: first?.url || '' })
      );
      return;
    } else {
      container.innerHTML = `<div class="bz-pwv-empty">${this.ic('key', 40)}
        <div class="t">选择一个平台</div><div class="d">左侧选择平台后，这里显示其全部账号</div></div>`;
      return;
    }
    // 搜索态单卡
    container.appendChild(this.buildAccountCard(d, st, true));
  }

  /** 单张账号卡（详情区复用）：复制账号常驻 + 密码行（显隐/复制）+ 备注 + 创建时间 */
  private buildAccountCard(d: PasswordVaultEntry, st: PwViewState, withHead = false): HTMLElement {
    const card = document.createElement('div');
    card.className = 'bz-pwv-acctcard';
    const shown = !!st.shownIds[d.id];
    const accMeta = withHead
      ? `${this.esc(d.platform)}${d.fav ? ' ' + this.starIc() : ''}`
      : `${this.esc(d.account || '(无账号)')}${d.fav ? ' ' + this.starIc() : ''}`;
    card.innerHTML = `<div class="accrow">
      <div class="name">${accMeta}</div>
      <button class="copyac" data-pwv="copy-ac">${this.ic('copy')} 复制账号</button>
    </div>
    <div class="pwrow">
      <div class="pw ${shown ? '' : 'mask'}">${shown ? this.esc(d.password) : dots(d.password)}</div>
      <button class="mini" data-pwv="eye" title="${shown ? '隐藏密码' : '显示密码'}">${shown ? this.ic('eye-off') : this.ic('eye')}</button>
      <button class="mini" data-pwv="copy-pw" title="复制密码">${this.ic('copy')}</button>
    </div>
    ${d.note ? `<div class="note">${this.esc(d.note)}</div>` : ''}
    <div class="meta">创建于 ${this.esc(new Date(d.createdAt).toLocaleDateString('zh-CN'))}${d.url ? ' · <a href="' + this.esc(d.url) + '" target="_blank" rel="noopener">' + this.esc(d.url.replace('https://', '')) + ' ↗</a>' : ''}</div>`;
    card.querySelectorAll<HTMLElement>('[data-pwv]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dispatchAccountAction(d, b.dataset.pwv as PwAccountAct, st);
      })
    );
    // 右键/长按抽屉：复制账号/复制密码/收藏/打开链接/编辑/删除
    this.attachAccountActions(card, d);
    return card;
  }

  /** 账号动作分发（卡片按钮 + 抽屉共用） */
  private dispatchAccountAction(d: PasswordVaultEntry, act: PwAccountAct, st: PwViewState): void {
    const t = (m: string, err = false) => this.host.toast(m, err);
    if (act === 'copy-ac') {
      void this.host.copySensitive(d.account || '').then((ok) => (ok ? t('账号已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true)), () => t('复制失败，请手动复制', true));
    } else if (act === 'copy-pw') {
      void this.host.copySensitive(d.password || '').then((ok) => (ok ? t('密码已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true)), () => t('复制失败，请手动复制', true));
    } else if (act === 'eye') {
      const showing = !st.shownIds[d.id];
      st.shownIds[d.id] = showing;
      // 防偷看：明文展示 ~15 秒后自动回遮；手动提前隐藏即撤计时
      if (showing) {
        this.clearRevealTimer(d.id);
        this.revealTimers[d.id] = setTimeout(() => {
          delete this.revealTimers[d.id];
          if (st.shownIds[d.id]) {
            delete st.shownIds[d.id];
            this.host.onPwChanged?.();
          }
        }, PW_REVEAL_AUTO_MASK_MS);
      } else {
        this.clearRevealTimer(d.id);
      }
      this.host.onPwChanged?.();
    } else if (act === 'edit') {
      this.host.openPwEntryDialog(d);
    } else if (act === 'fav') {
      void this.dm.toggleFav(d.id).then(() => this.host.onPwChanged?.()).catch((e) => this.failToast(e));
    } else if (act === 'del') {
      this.host.askConfirm('删除密码条目', `确定删除账号「${d.account}」吗？此操作不可撤销。`, '删除', () => {
        void this.dm.deleteItem(d.id).then(() => {
          if (st.selAccount === d.id) st.selAccount = null;
          this.host.onPwChanged?.();
          t(`已删除账号「${d.account}」`);
        }).catch((e) => this.failToast(e));
      });
    }
  }

  /** E2：写动作失败统一提示 + 重渲染（数据层已回滚内存，按真实状态收敛） */
  private failToast(e: unknown): void {
    this.host.toast(`保存失败：${(e as Error)?.message || e}`, true);
    this.host.onPwChanged?.();
  }

  /** 账号动作集（行卡右键/长按与移动账号详情页 ⋮ 共用） */
  private accountActions(d: PasswordVaultEntry): ItemAction[] {
    return [
      {
        icon: 'copy',
        label: '复制账号',
        onClick: () => void this.host.copySensitive(d.account || '').then((ok) => this.host.toast(ok ? '账号已复制（60 秒后自动清空）' : '复制失败', !ok), () => this.host.toast('复制失败', true)),
      },
      {
        icon: 'key',
        label: '复制密码',
        onClick: () => void this.host.copySensitive(d.password || '').then((ok) => this.host.toast(ok ? '密码已复制（60 秒后自动清空）' : '复制失败', !ok), () => this.host.toast('复制失败', true)),
      },
      {
        icon: 'star',
        label: d.fav ? '取消收藏' : '收藏',
        onClick: () => void this.dm.toggleFav(d.id).then(() => this.host.onPwChanged?.()).catch((e) => this.failToast(e)),
      },
      {
        icon: 'external-link',
        label: '打开链接',
        onClick: () => (d.url ? this.host.openExternal(d.url) : this.host.toast('该条目没有链接', true)),
      },
      { icon: 'pencil', label: '编辑', onClick: () => this.host.openPwEntryDialog(d) },
      {
        icon: 'trash-2',
        label: '删除',
        kind: 'danger',
        onClick: () =>
          this.host.askConfirm('删除密码条目', `确定删除账号「${d.account}」吗？此操作不可撤销。`, '删除', () => {
            void this.dm.deleteItem(d.id).then(() => {
              this.host.onPwChanged?.();
              this.host.toast(`已删除账号「${d.account}」`);
            }).catch((e) => this.failToast(e));
          }),
      },
    ];
  }

  private attachAccountActions(el: HTMLElement, d: PasswordVaultEntry): void {
    attachItemActions(el, this.accountActions(d), { sheetHead: this.buildSheetHead(d) });
  }

  /** 移动端账号详情页 ⋮：直接开底部抽屉（抽屉手势挂行卡上，详情页按钮触达不了——E6） */
  openAccountSheet(d: PasswordVaultEntry): void {
    openItemSheet(this.accountActions(d), { sheetHead: this.buildSheetHead(d) });
  }

  /** 平台动作集（行卡右键/长按与移动平台详情页 ⋮ 共用） */
  private platformActions(platform: string): ItemAction[] {
    const accs = this.dm.accountsOf(platform);
    const recent = accs[0];
    const count = accs.length;
    const actions: ItemAction[] = [
      {
        icon: 'plus',
        label: '在该平台新增账号',
        onClick: () => this.host.openPwEntryDialog(null, { platform, url: recent?.url || '' }),
      },
    ];
    if (recent) {
      actions.push({
        icon: 'copy',
        label: '复制最近账号',
        onClick: () => void this.host.copySensitive(recent.account || '').then((ok) => this.host.toast(ok ? '最近账号已复制' : '复制失败', !ok), () => this.host.toast('复制失败', true)),
      });
      actions.push({
        icon: 'key',
        label: '复制最近密码',
        onClick: () => void this.host.copySensitive(recent.password || '').then((ok) => this.host.toast(ok ? '最近密码已复制' : '复制失败', !ok), () => this.host.toast('复制失败', true)),
      });
    }
    actions.push({ icon: 'pencil', label: '编辑平台信息', onClick: () => this.host.openPwPlatformEdit(platform) });
    actions.push({
      icon: 'trash-2',
      label: '删除整个平台',
      kind: 'danger',
      onClick: () =>
        this.host.askConfirm('删除整个平台', `将删除「${platform}」的 ${count} 个账号，此操作不可撤销。确定继续？`, '删除', () => {
          void this.dm.removePlatform(platform).then(() => {
            this.host.onPwChanged?.();
            this.host.toast(`已删除平台与 ${count} 个账号`);
          }).catch((e) => this.failToast(e));
        }),
    });
    return actions;
  }

  private platformSheetOpts(platform: string): ItemActionsOptions {
    const recent = this.dm.accountsOf(platform)[0];
    return { sheetHead: this.buildSheetHead(recent ?? { account: platform, platform, createdAt: '' }) };
  }

  private attachPlatformActions(el: HTMLElement, platform: string): void {
    attachItemActions(el, this.platformActions(platform), this.platformSheetOpts(platform));
  }

  /** 移动端平台详情页 ⋮：直接开底部抽屉（E6 同款） */
  openPlatformSheet(platform: string): void {
    openItemSheet(this.platformActions(platform), this.platformSheetOpts(platform));
  }

  // ---------- 移动端卡流 ----------
  /** 渲染移动端密码卡流（平台卡；fav 过滤 view 由调用方传入 st） */
  renderMobList(container: HTMLElement, st: PwViewState, onOpenPlatform: (p: PlatformGroup) => void): void {
    container.innerHTML = '';
    const kw = st.searchKw;
    if (kw) {
      const hits = this.dm
        .search(kw)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
      if (!hits.length) {
        container.innerHTML = '<div class="bz-pwv-empty"><div class="t">没有匹配的条目</div><div class="d">换个关键词试试</div></div>';
        return;
      }
      for (const d of hits) {
        const c = document.createElement('div');
        c.className = 'bz-pwv-mobcard';
        c.innerHTML = `${avatarHTML(d.platform, d.url, 'bz-pwv-avatar av')}
          <div class="mid"><div class="a">${this.esc(d.platform)}${d.fav ? ' ' + this.starIc() : ''}</div><div class="b">${this.esc(d.account || '(无账号)')}</div></div>
          <span class="go">${this.ic('chevron-right')}</span>`;
        c.addEventListener('click', () => this.host.openPwAccountPage?.(d, st));
        this.attachAccountActions(c, d);
        container.appendChild(c);
      }
      hydratePwAvatars(container);
      return;
    }
    let plats = this.dm.platforms();
    if (st.view === 'fav') plats = plats.filter((p) => this.dm.hasFav(p.platform));
    if (!plats.length) {
      if (st.view === 'fav') {
        container.innerHTML = '<div class="bz-pwv-empty"><div class="t">还没有收藏</div><div class="d">右键或长按条目可收藏，常用账号一目了然</div></div>';
      } else {
        container.innerHTML = `<div class="bz-pwv-empty"><div class="t">保险库还没有密码</div><div class="d">收录第一条账号开始使用</div><button class="bz-pwv-empty-add" data-pwv="empty-add">${this.ic('plus')} 新增密码</button></div>`;
        container.querySelector('[data-pwv="empty-add"]')?.addEventListener('click', () => this.host.openPwEntryDialog());
      }
      return;
    }
    for (const p of plats) {
      const recent = p.accounts[0];
      const c = document.createElement('div');
      c.className = 'bz-pwv-mobcard';
      const favStar = this.dm.hasFav(p.platform) ? ' ' + this.starIc() : '';
      const cnt = p.accounts.length > 1 ? `<span class="cnt">${p.accounts.length}</span>` : '';
      c.innerHTML = `${avatarHTML(p.platform, recent?.url, 'bz-pwv-avatar av')}
        <div class="mid"><div class="a">${this.esc(p.platform)}${favStar}${cnt}</div><div class="b">${recent ? this.esc(recent.account || '(无账号)') : ''}</div></div>
        <span class="go">${this.ic('chevron-right')}</span>`;
      c.addEventListener('click', () => onOpenPlatform(p));
      this.attachPlatformActions(c, p.platform);
      container.appendChild(c);
    }
    hydratePwAvatars(container);
  }

  /** 平台详情页（移动）HTML 注入 body；含账号卡与操作 */
  renderMobPlatformPage(body: HTMLElement, p: PlatformGroup, st: PwViewState): void {
    const accs = p.accounts;
    const first = accs[0];
    const favStar = this.dm.hasFav(p.platform) ? ' <span class="star">★</span>' : '';
    body.innerHTML = `<div class="bz-pwv-mobplathead">
      <div class="av big">${avatarHTML(p.platform, first?.url, 'bz-pwv-avatar big')}</div>
      <div><div class="nm">${this.esc(p.platform)}${favStar}</div>
        ${first && first.url ? `<a class="url" href="${this.esc(first.url)}" target="_blank" rel="noopener">${this.esc(first.url)} ↗</a>` : '<div class="url faint">无链接</div>'}</div>
      <button class="bz-pwv-btn gold" data-pwv="plat-add">${this.ic('plus', 12)} 新增账号</button>
    </div>
    <div class="bz-pwv-accts"></div>`;
    const acctsEl = body.querySelector('.bz-pwv-accts') as HTMLElement;
    if (!accs.length) {
      acctsEl.innerHTML = '<div class="bz-pwv-empty"><div class="t">该平台暂无账号</div><div class="d">点上方「在该平台新增账号」录入</div></div>';
    } else {
      for (const d of accs) acctsEl.appendChild(this.buildAccountCard(d, st));
    }
    body.querySelector('[data-pwv="plat-add"]')?.addEventListener('click', () =>
      this.host.openPwEntryDialog(null, { platform: p.platform, url: first?.url || '' })
    );
  }

  // ---------- 抽屉头 ----------
  private buildSheetHead(d: { account: string; platform: string; createdAt: string }): HTMLElement {
    const head = document.createElement('div');
    head.className = 'bz-item-sheet-entry';
    const body = document.createElement('div');
    body.style.cssText = 'display:flex; align-items:flex-start; gap:10px;';
    const emoji = document.createElement('span');
    emoji.className = 'bz-item-sheet-emoji';
    emoji.textContent = '🔑';
    body.appendChild(emoji);
    const info = document.createElement('div');
    info.style.cssText = 'flex:1; min-width:0;';
    const t = document.createElement('div');
    t.className = 'bz-item-sheet-title';
    t.textContent = d.account || d.platform;
    info.appendChild(t);
    const s = document.createElement('div');
    s.className = 'bz-item-sheet-sub';
    s.textContent = `${d.platform}${d.platform ? ' · ' : ''}${relTime(d.createdAt)}`;
    info.appendChild(s);
    body.appendChild(info);
    head.appendChild(body);
    return head;
  }

  // ---------- lucide 图标 ----------
  private ic(name: string, size = 14): string {
    const p = (name: string): string => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ''}</svg>`;
    return p(name);
  }

  private esc(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// 子视图可用的 lucide path（元素级，避免引 obsidian setIcon 的 DOM 依赖）
const ICON_PATHS: Record<string, string> = {
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/>',
  star: '<path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  'trash-2': '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
};
