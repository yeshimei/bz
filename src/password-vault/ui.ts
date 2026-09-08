/**
 * 保险库（password-vault）UI — 原型 v1「保险库」一比一移植
 * 桌面三栏工作台（导航+列表+详情）+ 移动端（列表卡+详情页+FAB）+ 原型自绘
 * 右键菜单 / 底部抽屉 / 确认框 / toast / 解锁屏（金色印章 + 安全机制嵌入）。
 * 数据经 PasswordVaultDataManager（保险箱 password-vault SafeNote 共享）；
 * 解锁底层走保险箱 SafeManager（同一主密码），原型锁屏仅作视觉壳，
 * 安全机制（首设风险确认/失败冷却/损坏重设/自愈提示）完整保留（Q13）。
 * 命令入口由 index.ts 注册（bz-password-vault-open）。
 * markup 单源（issue 251/ADR-0110）：全部 HTML 出自 ./render.ts（本文件零模板串）。
 */
import { escManager } from '../core/esc-manager';
import { topifyZ, createSiteIcon } from '../core/dom';
import { openFlowDialog } from '../core/flow-dialog';
import { notice } from '../core/notice';
import { attachItemActions, openItemSheet, type ItemAction } from '../core/item-actions';
import type { IconName } from 'obsidian';
import {
  PasswordVaultDataManager,
  type PasswordVaultEntry,
  type PlatformGroup,
} from './data';
import {
  ICONS,
  relTime,
  colorOf,
  deskHTML,
  mobHTML,
  hitRowHtml,
  platRowHtml,
  platDetailShellHtml,
  acctCardHtml,
  mobHitCardHtml,
  mobPlatCardHtml,
  mobPlatHeadHtml,
  mobSegHtml,
  emptyHtml,
} from './render';

/** 展示工具再导出（原 ui.ts 公共面；实现居 render.ts 纯层） */
export { relTime, colorOf };
export type { PasswordVaultEntry } from './data';

/** 安全机制状态（Q13：完整保留保险箱行为） */
interface LockSecurity {
  unlockFailStreak: number;
  unlockCooldownUntil: number;
}

const DEFAULT_CHARSET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+';

/** 加密安全随机密码（拒绝采样，与密码本同款） */
export function secureRandomPassword(length: number, charset: string): string {
  const n = charset.length;
  if (!(length > 0) || n === 0) return '';
  const LIMIT = Math.floor(0x100000000 / n) * n;
  let pwd = '';
  while (pwd.length < length) {
    const buf = new Uint32Array(length - pwd.length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && pwd.length < length; i++) {
      if (buf[i] >= LIMIT) continue;
      pwd += charset.charAt(buf[i] % n);
    }
  }
  return pwd;
}

/** 复制敏感内容 + 60s 自动清空剪贴板 */
const CLIPBOARD_CLEAR_DELAY_MS = 60_000;
let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;
export function armClipboardClear(): void {
  if (clipboardClearTimer !== null) clearTimeout(clipboardClearTimer);
  clipboardClearTimer = setTimeout(() => {
    clipboardClearTimer = null;
    try {
      void navigator.clipboard.writeText('').catch(() => {});
    } catch (e) {
      /* 尽力而为 */
    }
  }, CLIPBOARD_CLEAR_DELAY_MS);
}
export function copySensitiveText(text: string): Promise<void> {
  try {
    return navigator.clipboard.writeText(text).then(() => armClipboardClear());
  } catch (e) {
    return Promise.reject(e);
  }
}

/**
 * 给容器内所有 [data-avatar] 注入真实 favicon 图标（域名从 url 解析）：
 * - createSiteIcon 加载成功（onload）→ 隐藏字母 span，完整显示真实图标（object-fit: contain）；
 * - 加载失败（onerror，createSiteIcon 内部隐藏 img）→ 保留字母回退。
 */
function hydrateAvatars(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>('[data-avatar]').forEach((box) => {
    if (box.querySelector('img')) return; // 已注入
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
      // createSiteIcon 内部强加内联尺寸（width/height=size），内联样式优先级高于 CSS，
      // 会导致图被固定 size 塞进容器、overflow 裁剪只剩一部分 → 清除由 CSS 全权控制
      img.removeAttribute('style');
      // 图标加载成功 → 隐藏字母；列表小头像（.bz-password-vault-av）去掉品牌色底（图标自带颜色）
      img.addEventListener('load', () => {
        const ch = box.querySelector('span');
        if (ch) ch.style.display = 'none';
        if (box.classList.contains('bz-password-vault-av')) box.removeAttribute('style');
      });
      box.appendChild(img);
    }
  });
}

export interface PasswordVaultUIConfig {
  charset: string;
  length: string;
  securityMode: boolean;
}

export class PasswordVaultUIManager {
  dataManager: PasswordVaultDataManager;
  config: PasswordVaultUIConfig;
  root: HTMLDivElement | null = null;
  // 状态
  view: 'all' | 'fav' = 'all';
  searchKw = '';
  selPlatform: string | null = null;
  selAccount: string | null = null;
  shownIds: Record<string, boolean> = {};
  pendingPassword: string | null = null;
  editingId: string | null = null;
  // 安全机制（Q13）
  security: LockSecurity = { unlockFailStreak: 0, unlockCooldownUntil: 0 };
  // 计时器
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private escUnregister: { unregister: () => void } | null = null;
  private _initialized = false;
  // DOM 引用（桌面）
  private desk!: {
    rows: HTMLElement;
    detail: HTMLElement;
    search: HTMLInputElement;
    count: HTMLElement;
    shown: HTMLElement;
    title: HTMLElement;
    lock: HTMLElement;
    toast: HTMLElement;
    modal: HTMLElement;
    confirm: HTMLElement;
    platEdit: HTMLElement;
  };
  // DOM 引用（移动）
  private mob!: {
    list: HTMLElement;
    search: HTMLInputElement;
    page: HTMLElement;
    pageBody: HTMLElement;
    pageTitle: HTMLElement;
    lock: HTMLElement;
    toast: HTMLElement;
    modal: HTMLElement;
    confirm: HTMLElement;
    platEdit: HTMLElement;
  };

  constructor(dataManager: PasswordVaultDataManager, config: PasswordVaultUIConfig) {
    this.dataManager = dataManager;
    this.config = config;
  }

  // ---------- 创建 DOM（桌面 + 移动双实例，共享同一 DataManager） ----------
  ensureElements() {
    if (this._initialized) return;
    this._initialized = true;
    // 根容器：固定全屏遮罩层（Obsidian 弹窗层之上）
    this.root = document.createElement('div');
    this.root.className = 'bz-password-vault';
    this.root.style.cssText =
      'position:fixed;inset:0;z-index:var(--bz-z-overlay,1000);display:none;';
    document.body.appendChild(this.root);

    // 桌面实例
    const desk = document.createElement('div');
    desk.className = 'bz-password-vault-desk';
    desk.innerHTML = deskHTML();
    this.root.appendChild(desk);
    this.desk = {
      rows: desk.querySelector('.bz-password-vault-rows')!,
      detail: desk.querySelector('.bz-password-vault-detail')!,
      search: desk.querySelector('.bz-password-vault-search input')!,
      count: desk.querySelector('.bz-password-vault-count')!,
      shown: desk.querySelector('.bz-password-vault-count')!,
      title: desk.querySelector('.bz-password-vault-listhead h1')!,
      lock: desk.querySelector('.bz-password-vault-lock')!,
      toast: desk.querySelector('.bz-password-vault-toast')!,
      modal: desk.querySelector('.bz-password-vault-modal')!,
      confirm: desk.querySelector('.bz-password-vault-pop2')!,
      platEdit: desk.querySelector('.bz-password-vault-platedit')!,
    };
    // 移动实例
    const mob = document.createElement('div');
    mob.className = 'bz-password-vault-mob';
    mob.innerHTML = mobHTML();
    this.root.appendChild(mob);
    this.mob = {
      list: mob.querySelector('.bz-password-vault-moblist')!,
      search: mob.querySelector('.bz-password-vault-mobsearch input')!,
      page: mob.querySelector('.bz-password-vault-mobpage')!,
      pageBody: mob.querySelector('.bz-password-vault-mobbody')!,
      pageTitle: mob.querySelector('.bz-password-vault-mobpage .head .t')!,
      lock: mob.querySelector('.bz-password-vault-lock')!,
      toast: mob.querySelector('.bz-password-vault-toast')!,
      modal: mob.querySelector('.bz-password-vault-modal')!,
      confirm: mob.querySelector('.bz-password-vault-pop2')!,
      platEdit: mob.querySelector('.bz-password-vault-platedit')!,
    };

    // 绑定交互
    this.bindDesk();
    this.bindMob();
    this.bindDialogs();
    this.registerEscape();
    // 外部变更（保险箱/旧密码本）→ 重绘
    this.dataManager.onExternalChange = () => {
      this.renderAll();
    };
  }

  // ---------- 交互绑定 ----------
  private bindDesk() {
    const root = this.root!;
    // 导航
    root.querySelectorAll('.bz-password-vault-navitem').forEach((it) => {
      it.addEventListener('click', () => {
        root.querySelectorAll('.bz-password-vault-navitem').forEach((x) => x.classList.remove('on'));
        it.classList.add('on');
        this.view = (it.getAttribute('data-view') as 'all' | 'fav');
        this.renderAll();
      });
    });
    // 搜索防抖
    this.desk.search.addEventListener('input', (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchKw = v;
        this.renderAll();
      }, 180);
    });
    // 点击卡片外遮罩 → 关闭窗口
    root.addEventListener('click', (e) => {
      if (e.target === root && this.root!.style.display === 'flex') {
        this.hide();
      }
    });
  }

  private bindMob() {
    const root = this.root!;
    // 搜索
    this.mob.search.addEventListener('input', (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchKw = v;
        this.renderAll();
      }, 180);
    });
    // FAB 添加
    root.querySelector('.bz-password-vault-fab')?.addEventListener('click', () => this.openEntryDialog(null));
    // 移动端顶栏关闭按钮（无系统级手势，显式关闭入口）
    root.querySelector('[data-act="mob-close"]')?.addEventListener('click', () => this.hide());
    // 返回
    root.querySelector('.bz-password-vault-back')?.addEventListener('click', () => this.mob.page.classList.remove('open'));
    // 次级面板遮罩点击关闭（点击遮罩本身才关闭，面板内不关）
    this.mob.page.addEventListener('click', (e) => {
      if (e.target === this.mob.page) this.mob.page.classList.remove('open');
    });
    // 详情页右上菜单
    root.querySelector('.bz-password-vault-mobpage .head [data-act="menu"]')?.addEventListener('click', () => {
      const cur = this.mobPagePlatform;
      if (cur) {
        openItemSheet(this.buildPlatformActions(cur), {
          sheetHead: this.buildSheetHead(cur, '', ''),
        });
      }
    });
  }

  private mobPagePlatform: string | null = null;

  /** 绑定添加/编辑弹窗的保存/取消/生成按钮（双实例各一份） */
  private bindDialogs() {
    this.root!.querySelectorAll('.bz-password-vault-modal').forEach((modal) => {
      const dlg = modal.querySelector('.bz-password-vault-dialog')!;
      const errEl = dlg.querySelector('[data-f-err]') as HTMLElement;
      const get = (f: string) => (dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value.trim();
      // 点击遮罩（非弹窗本体）关闭
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeEntryDialog();
      });
      // 生成
      dlg.querySelector('[data-act="gen"]')?.addEventListener('click', () => {
        (dlg.querySelector('[data-f="password"]') as HTMLInputElement).value = this.generatePassword();
        this.toast('已生成新密码');
      });
      // 取消
      dlg.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
        this.closeEntryDialog();
      });
      // 保存
      dlg.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
        const platform = get('platform');
        if (!platform) {
          errEl.textContent = '平台不能为空';
          return;
        }
        if (!get('account') || !get('password')) {
          errEl.textContent = '账号和密码不能为空';
          return;
        }
        const item = {
          platform,
          url: get('url'),
          account: get('account'),
          password: get('password'),
          note: get('note'),
        };
        try {
          if (this.editingId) {
            await this.dataManager.updateItem(this.editingId, item);
            this.selPlatform = item.platform;
            this.selAccount = this.editingId;
          } else {
            await this.dataManager.addItem(item);
            this.selPlatform = item.platform;
            this.selAccount = this.dataManager.pwData[0]?.id ?? null;
          }
          this.closeEntryDialog();
          this.renderAll();
          this.toast('已保存');
        } catch (e: any) {
          errEl.textContent = '保存失败：' + e.message;
        }
      });
    });
    // 平台编辑弹窗
    this.root!.querySelectorAll('.bz-password-vault-platedit').forEach((el) => {
      const card = el as HTMLElement;
      const errEl = card.querySelector('.err') as HTMLElement;
      let currentPlatform: string | null = null;
      // 点击遮罩（非弹窗本体）关闭
      card.addEventListener('click', (e) => {
        if (e.target === card) card.classList.remove('open');
      });
      card.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
        card.classList.remove('open');
      });
      card.querySelector('[data-act="save"]')?.addEventListener('click', async () => {
        const name = (card.querySelector('[data-f="platform"]') as HTMLInputElement).value.trim();
        if (!name) {
          errEl.textContent = '平台名不能为空';
          return;
        }
        if (!currentPlatform) return;
        const url = (card.querySelector('[data-f="url"]') as HTMLInputElement).value;
        try {
          await this.dataManager.updatePlatform(currentPlatform, { platform: name, url });
          this.selPlatform = name;
          this.selAccount = null;
          card.classList.remove('open');
          this.renderAll();
          this.toast('平台信息已更新');
        } catch (e: any) {
          errEl.textContent = '保存失败：' + e.message;
        }
      });
      // openPlatformEdit 需回写当前平台
      (card as any).__setCurrent = (p: string) => {
        currentPlatform = p;
      };
    });
  }

  // ---------- 渲染 ----------
  renderAll() {
    if (!this.root) return;
    this.renderLock();
    this.renderDeskList();
    this.renderDeskDetail();
    this.renderMobList();
  }

  private renderLock() {
    const unlocked = this.dataManager.unlocked;
    const mode = unlocked ? '' : 'open';
    this.root!.querySelectorAll('.bz-password-vault-lock').forEach((el) => {
      (el as HTMLElement).classList.toggle('open', !!mode);
    });
    if (unlocked) return;
    // 首设/解锁标题与副文本
    const first = !this.dataManager.unlocked; // 未解锁时无法知道首设；由 SafeManager.exists 判定（异步）
    // 解锁态由 unlock 流程控制；这里只负责锁屏显示
  }

  /** 解锁成功后重载数据：锁屏打开时 load() 因未解锁而失败，pwData 为空，
   *  解锁成功必须重新 load 才能渲染出清单（回归：解锁不重载 → 空列表） */
  private async reloadAfterUnlock(): Promise<void> {
    try {
      await this.dataManager.load();
    } catch (e: any) {
      notice('加载数据失败：' + e.message, 'error');
    }
  }

  /** 渲染桌面列表（平台聚合 / 搜索展平） */
  private renderDeskList() {
    const rows = this.desk.rows;
    const kw = this.searchKw;
    const count = this.dataManager.pwData.length;
    this.desk.count.textContent = count + ' 条';
    this.root!.querySelector('[data-cnt="all"]')!.textContent = String(count);
    this.root!.querySelector('[data-cnt="fav"]')!.textContent = String(this.dataManager.pwData.filter((d) => d.fav).length);
    this.desk.title.textContent = this.view === 'fav' ? '已收藏' : '全部条目';

    if (kw) {
      // 搜索态：展平为账号行
      const hits = this.dataManager
        .search(kw)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
      this.desk.shown.textContent = hits.length + ' 条匹配';
      rows.innerHTML = '';
      if (!hits.length) {
        rows.innerHTML = emptyHtml('bz-password-vault-empty', '没有匹配的条目', '换个关键词，或清空搜索', { style: 'flex:1' });
        return;
      }
      hits.forEach((d) => {
        const r = document.createElement('div');
        r.className = 'bz-password-vault-row' + (d.id === this.selAccount ? ' on' : '');
        r.innerHTML = hitRowHtml(d);
        r.addEventListener('click', (e) => {
          this.selAccount = d.id;
          this.renderAll();
        });
        // bz 统一右键菜单 / 长按抽屉（item-actions）
        attachItemActions(r, this.buildAccountActions(d), {
          sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
        });
        rows.appendChild(r);
      });
      hydrateAvatars(rows);
      return;
    }
    // 非搜索：平台聚合行
    let plats = this.dataManager.platforms();
    if (this.view === 'fav') plats = plats.filter((p) => this.dataManager.hasFav(p.platform));
    this.desk.shown.textContent = plats.length + ' 个平台';
    rows.innerHTML = '';
    if (!plats.length) {
      rows.innerHTML =
        this.view === 'fav'
          ? emptyHtml('bz-password-vault-empty', '还没有收藏', '点条目里的 ★ 收藏常用账号', { style: 'flex:1' })
          : emptyHtml('bz-password-vault-empty', '保险库还是空的', '点击右上角「添加密码」开始收录', { style: 'flex:1', ctaLabel: '添加第一条密码', ctaAct: 'add-first' });
      rows.querySelector('[data-act="add-first"]')?.addEventListener('click', () => this.openEntryDialog(null));
      return;
    }
    plats.forEach((p) => {
      const recent = p.accounts[0];
      const r = document.createElement('div');
      r.className = 'bz-password-vault-plrow' + (p.platform === this.selPlatform ? ' on' : '');
      r.innerHTML = platRowHtml({
        platform: p.platform,
        url: recent?.url || '',
        account: recent?.account || '',
        count: p.accounts.length,
        time: recent?.createdAt || '',
        fav: this.dataManager.hasFav(p.platform),
        selected: p.platform === this.selPlatform,
      });
      r.addEventListener('click', (e) => {
        this.selPlatform = p.platform;
        this.selAccount = null;
        this.renderAll();
      });
      // bz 统一右键菜单 / 长按抽屉（item-actions）
      attachItemActions(r, this.buildPlatformActions(p.platform), {
        sheetHead: this.buildSheetHead(p.platform, recent?.account || '', recent?.createdAt || ''),
      });
      rows.appendChild(r);
    });
    hydrateAvatars(rows);
  }

  /** 渲染桌面详情（平台视图 / 账号详情） */
  private renderDeskDetail() {
    const detail = this.desk.detail;
    const kw = this.searchKw;
    if (kw) {
      const d = this.dataManager.pwData.find((x) => x.id === this.selAccount);
      if (d) {
        this.renderAccountDetail(d);
        return;
      }
      detail.innerHTML = emptyHtml('bz-password-vault-empty', '选择一条结果', '点击左侧结果查看详情');
      return;
    }
    const platform = this.selPlatform;
    if (!platform) {
      detail.innerHTML = emptyHtml('bz-password-vault-empty', '选择一个平台', '左侧选择平台后，这里显示其全部账号', { icon: ICONS.lock });
      return;
    }
    let accs = this.dataManager.accountsOf(platform);
    if (this.view === 'fav') accs = accs.filter((d) => d.fav);
    detail.innerHTML = platDetailShellHtml({
      platform,
      url: accs[0]?.url || '',
      fav: this.dataManager.hasFav(platform),
      count: accs.length,
    });
    detail.querySelector('[data-act="plat-add"]')?.addEventListener('click', () =>
      this.openEntryDialog(null, { platform, url: accs[0]?.url || '' })
    );
    const acctsEl = detail.querySelector('.bz-password-vault-accts')!;
    if (!accs.length) {
      acctsEl.innerHTML = emptyHtml('bz-password-vault-empty', '该平台暂无账号', '');
      return;
    }
    this.appendAcctCards(acctsEl as HTMLElement, accs);
  }

  /** 账号卡序列（桌面详情容器复用：卡 DOM + 动作绑定同构） */
  private appendAcctCards(acctsEl: HTMLElement, accs: PasswordVaultEntry[]) {
    accs.forEach((d) => {
      const shown = !!this.shownIds[d.id];
      const card = document.createElement('div');
      card.className = 'bz-password-vault-acctcard';
      card.innerHTML = acctCardHtml(d, shown);
      card.querySelectorAll('[data-act]').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.handleAccountAction(d, b.getAttribute('data-act') || '', 'desk');
        })
      );
      // bz 统一右键菜单 / 长按抽屉（编辑/删除/收藏收在这里，无 ⋮ 按钮）
      attachItemActions(card, this.buildAccountActions(d), {
        sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
      });
      acctsEl.appendChild(card);
    });
  }

  /** 渲染账号详情（搜索态，同构单卡） */
  private renderAccountDetail(d: PasswordVaultEntry) {
    const shown = !!this.shownIds[d.id];
    const accs = this.dataManager.accountsOf(d.platform);
    this.desk.detail.innerHTML = platDetailShellHtml({
      platform: d.platform,
      url: d.url || '',
      fav: this.dataManager.hasFav(d.platform),
      count: accs.length,
    });
    this.desk.detail.querySelector('[data-act="plat-add"]')?.addEventListener('click', () =>
      this.openEntryDialog(null, { platform: d.platform, url: accs[0]?.url || '' })
    );
    const acctsEl = this.desk.detail.querySelector('.bz-password-vault-accts') as HTMLElement;
    const card = document.createElement('div');
    card.className = 'bz-password-vault-acctcard';
    card.innerHTML = acctCardHtml(d, shown);
    card.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.handleAccountAction(d, b.getAttribute('data-act') || '', 'desk');
      })
    );
    attachItemActions(card, this.buildAccountActions(d), {
      sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
    });
    acctsEl.appendChild(card);
  }

  /** 账号级动作分发（桌面卡片/详情/搜索态共用） */
  private async handleAccountAction(d: PasswordVaultEntry, act: string, which: 'desk' | 'mob') {
    const t = (m: string, err = false) => this.toast(m, err);
    if (act === 'copy-ac') {
      (await this.copy(d.account || '')) ? t('账号已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
    } else if (act === 'copy-pw') {
      (await this.copy(d.password || '')) ? t('密码已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
    } else if (act === 'eye') {
      this.shownIds[d.id] = !this.shownIds[d.id];
      this.renderAll();
    } else if (act === 'edit') {
      this.openEntryDialog(d);
    } else if (act === 'fav') {
      await this.dataManager.toggleFav(d.id);
      this.renderAll();
    } else if (act === 'del') {
      this.askConfirm('删除密码条目', `确定删除账号 "${d.account}" 吗？此操作不可撤销。`, true, async () => {
        await this.dataManager.deleteItem(d.id);
        if (this.selAccount === d.id) this.selAccount = null;
        this.renderAll();
        t('已删除');
      });
    }
  }

  // ---------- 移动端渲染 ----------
  private renderMobList() {
    const list = this.mob.list;
    const kw = this.searchKw;
    list.innerHTML = '';
    if (kw) {
      const hits = this.dataManager
        .search(kw)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') * -1);
      if (!hits.length) {
        list.innerHTML = emptyHtml('bz-password-vault-mobempty', '没有匹配的条目', '换个关键词试试');
        return;
      }
      hits.forEach((d) => {
        const c = document.createElement('div');
        c.className = 'bz-password-vault-mobcard';
        c.innerHTML = mobHitCardHtml(d);
        this.bindAccountCard(c, d);
        list.appendChild(c);
      });
      hydrateAvatars(list);
      return;
    }
    let plats = this.dataManager.platforms();
    if (this.view === 'fav') plats = plats.filter((p) => this.dataManager.hasFav(p.platform));
    if (!plats.length) {
      list.innerHTML =
        this.view === 'fav'
          ? emptyHtml('bz-password-vault-mobempty', '还没有收藏', '点条目里的 ★ 收藏常用账号')
          : emptyHtml('bz-password-vault-mobempty', '保险库还是空的', '点击右下角 + 添加第一条密码', { ctaLabel: '添加密码', ctaAct: 'add-first' });
      list.querySelector('[data-act="add-first"]')?.addEventListener('click', () => this.openEntryDialog(null));
      return;
    }
    plats.forEach((p) => {
      const recent = p.accounts[0];
      const c = document.createElement('div');
      c.className = 'bz-password-vault-mobcard';
      c.innerHTML = mobPlatCardHtml({
        platform: p.platform,
        url: recent?.url || '',
        account: recent?.account || '',
        count: p.accounts.length,
        fav: this.dataManager.hasFav(p.platform),
      });
      this.bindCard(c, p);
      list.appendChild(c);
    });
    hydrateAvatars(list);
  }

  /** 平台卡：bz 统一右键/长按抽屉；点击 → 平台详情页 */
  private bindCard(card: HTMLElement, p: PlatformGroup) {
    // bz 统一右键菜单（桌面）/ 长按抽屉（移动）
    attachItemActions(card, this.buildPlatformActions(p.platform), {
      sheetHead: this.buildSheetHead(p.platform, p.accounts[0]?.account || '', p.accounts[0]?.createdAt || ''),
    });
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) return;
      this.openPage(p);
    });
  }

  /** 账号卡（搜索态）：bz 统一右键/长按抽屉；点击 → 账号详情页 */
  private bindAccountCard(card: HTMLElement, d: PasswordVaultEntry) {
    // bz 统一右键菜单（桌面）/ 长按抽屉（移动）
    attachItemActions(card, this.buildAccountActions(d), {
      sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
    });
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) return;
      this.openAccountPage(d);
    });
  }

  /** 平台详情页 */
  private openPage(p: PlatformGroup) {
    const accs = p.accounts;
    let body = mobPlatHeadHtml({
      platform: p.platform,
      url: accs[0]?.url || '',
      fav: this.dataManager.hasFav(p.platform),
    });
    if (!accs.length) {
      body += emptyHtml('bz-password-vault-mobempty', '该平台暂无账号', '');
    } else {
      accs.forEach((d) => {
        const shown = !!this.shownIds[d.id];
        body += mobSegHtml(d, shown, true);
      });
    }
    this.mob.pageBody.innerHTML = body;
    this.mob.pageBody.querySelector('[data-act="add"]')?.addEventListener('click', () => {
      this.mob.page.classList.remove('open');
      this.openEntryDialog(null, { platform: p.platform, url: accs[0]?.url || '' });
    });
    this.mob.pageBody.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = b.getAttribute('data-act') || '';
        const id = b.getAttribute('data-id') || '';
        const d = this.dataManager.pwData.find((x) => x.id === id);
        if (!d && a !== 'menu') return;
        void this.handleAccountAction(d!, a, 'mob');
      })
    );
    // 长按抽屉（编辑/删除/收藏收在这里，无 ⋮ 按钮）
    this.mob.pageBody.querySelectorAll('.bz-password-vault-seg').forEach((seg) => {
      const id = seg.querySelector('[data-id]')?.getAttribute('data-id') || '';
      const d = this.dataManager.pwData.find((x) => x.id === id);
      if (d) attachItemActions(seg as HTMLElement, this.buildAccountActions(d), {
        sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
      });
    });
    this.mob.pageTitle.textContent = p.platform;
    this.mobPagePlatform = p.platform;
    this.mob.page.classList.add('open');
  }

  /** 账号详情页（搜索态点账号卡，同构单卡） */
  private openAccountPage(d: PasswordVaultEntry) {
    const shown = !!this.shownIds[d.id];
    this.mob.pageBody.innerHTML = mobPlatHeadHtml({
      platform: d.platform,
      url: d.url || '',
      fav: this.dataManager.hasFav(d.platform),
    }) + mobSegHtml(d, shown, false);
    this.mob.pageBody.querySelector('[data-act="add"]')?.addEventListener('click', () => {
      this.mob.page.classList.remove('open');
      this.openEntryDialog(null, { platform: d.platform, url: d.url || '' });
    });
    this.mob.pageBody.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = b.getAttribute('data-act') || '';
        void this.handleAccountAction(d, a, 'mob');
      })
    );
    const seg = this.mob.pageBody.querySelector('.bz-password-vault-seg') as HTMLElement;
    attachItemActions(seg, this.buildAccountActions(d), {
      sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
    });
    this.mob.pageTitle.textContent = d.platform;
    this.mobPagePlatform = d.platform;
    this.mob.page.classList.add('open');
  }

  // ---------- 动作定义（bz 统一右键菜单 / 长按抽屉，item-actions） ----------
  /** 抽屉头部（bz 统一抽屉样式：标题 + 副标题） */
  private buildSheetHead(title: string, sub: string, time: string): HTMLElement {
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
    t.textContent = title;
    info.appendChild(t);
    const s = document.createElement('div');
    s.className = 'bz-item-sheet-sub';
    s.textContent = `${sub}${sub ? ' · ' : ''}${relTime(time)}`;
    info.appendChild(s);
    body.appendChild(info);
    head.appendChild(body);
    return head;
  }

  // ---------- 动作定义（bz 统一右键菜单 / 长按抽屉，item-actions） ----------
  private buildAccountActions(d: PasswordVaultEntry): ItemAction[] {
    const t = (m: string, err = false) => this.toast(m, err);
    return [
      {
        icon: 'copy',
        label: '复制账号',
        onClick: () => {
          void (async () => {
            (await this.copy(d.account || '')) ? t('账号已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
          })();
        },
      },
      {
        icon: 'key',
        label: '复制密码',
        onClick: () => {
          void (async () => {
            (await this.copy(d.password || '')) ? t('密码已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
          })();
        },
      },
      {
        icon: 'star',
        label: d.fav ? '取消收藏' : '收藏',
        onClick: () => {
          void (async () => {
            await this.dataManager.toggleFav(d.id);
            this.renderAll();
          })();
        },
      },
      {
        icon: 'external-link',
        label: '打开链接',
        onClick: () => {
          if (d.url) this.openExternal(d.url);
          else t('该条目没有链接', true);
        },
      },
      { icon: 'pencil', label: '编辑', onClick: () => this.openEntryDialog(d) },
      {
        icon: 'trash-2',
        label: '删除',
        kind: 'danger',
        onClick: () =>
          this.askConfirm('删除密码条目', `确定删除账号 "${d.account}" 吗？此操作不可撤销。`, true, () => {
            void (async () => {
              await this.dataManager.deleteItem(d.id);
              this.renderAll();
              t('已删除');
            })();
          }),
      },
    ];
  }

  private buildPlatformActions(platform: string): ItemAction[] {
    const accs = this.dataManager.accountsOf(platform);
    const recent = accs[0];
    const count = accs.length;
    const t = (m: string, err = false) => this.toast(m, err);
    const actions: ItemAction[] = [
      {
        icon: 'plus',
        label: '在该平台新增账号',
        onClick: () => this.openEntryDialog(null, { platform, url: recent?.url || '' }),
      },
    ];
    if (recent) {
      actions.push({
        icon: 'copy',
        label: '复制最近账号',
        onClick: () => {
          void (async () => {
            (await this.copy(recent.account || '')) ? t('最近账号已复制（60 秒后自动清空）') : t('复制失败', true);
          })();
        },
      });
      actions.push({
        icon: 'key',
        label: '复制最近密码',
        onClick: () => {
          void (async () => {
            (await this.copy(recent.password || '')) ? t('最近密码已复制（60 秒后自动清空）') : t('复制失败', true);
          })();
        },
      });
    }
    actions.push({ icon: 'pencil', label: '编辑平台信息', onClick: () => this.openPlatformEdit(platform) });
    actions.push({
      icon: 'trash-2',
      label: '删除整个平台',
      kind: 'danger',
      onClick: () =>
        this.askConfirm('删除整个平台', `将删除「${platform}」的 ${count} 个账号，此操作不可撤销。确定继续？`, true, () => {
          void (async () => {
            const n = await this.dataManager.removePlatform(platform);
            this.selPlatform = null;
            this.renderAll();
            t(`已删除平台与 ${n} 个账号`);
          })();
        }),
    });
    return actions;
  }

  // ---------- 添加/编辑弹窗 ----------
  openEntryDialog(editItem: PasswordVaultEntry | null = null, preset?: { platform?: string; url?: string }) {
    if (!this.dataManager.unlocked) {
      notice('请先解锁保险库');
      return;
    }
    // 双实例同步显示（桌面 + 移动共享同一数据，同一弹窗内容）
    this.editingId = editItem ? editItem.id : null;
    const title = editItem ? '编辑密码条目' : '添加密码条目';
    const subtitle = '带 * 为必填 · 平台与账号密码不可为空';
    this.root!.querySelectorAll('.bz-password-vault-modal').forEach((modal) => {
      const dlg = modal.querySelector('.bz-password-vault-dialog')!;
      dlg.querySelector('h3')!.textContent = title;
      dlg.querySelector('.sub')!.textContent = subtitle;
      const fields = ['platform', 'url', 'account', 'password', 'note'] as const;
      fields.forEach((f) => {
        const input = dlg.querySelector(`[data-f="${f}"]`) as HTMLInputElement;
        input.value = editItem ? editItem[f] || '' : preset && f !== 'password' ? preset[f as 'platform' | 'url'] || '' : '';
      });
      if (!editItem) {
        const staged = this.pendingPassword;
        this.pendingPassword = null;
        (dlg.querySelector('[data-f="password"]') as HTMLInputElement).value = staged || this.generatePassword();
      }
      (dlg.querySelector('[data-f-err]') as HTMLElement).textContent = '';
      modal.classList.add('open');
    });
    // 焦点
    const first = this.root!.querySelector('.bz-password-vault-modal [data-f="platform"]') as HTMLInputElement;
    first?.focus();
  }

  private closeEntryDialog() {
    this.root!.querySelectorAll('.bz-password-vault-modal').forEach((m) => m.classList.remove('open'));
    this.editingId = null;
    this.pendingPassword = null;
  }

  // ---------- 平台编辑弹窗 ----------
  private openPlatformEdit(platform: string) {
    const accs = this.dataManager.accountsOf(platform);
    const d = accs[0] || ({} as PasswordVaultEntry);
    this.root!.querySelectorAll('.bz-password-vault-platedit').forEach((el) => {
      const card = el as HTMLElement;
      card.querySelector('h3')!.textContent = '编辑平台 · ' + platform;
      (card.querySelector('[data-f="platform"]') as HTMLInputElement).value = platform === '(无平台)' ? '' : platform;
      (card.querySelector('[data-f="url"]') as HTMLInputElement).value = d.url || '';
      (card.querySelector('.err') as HTMLElement).textContent = '';
      (card as any).__setCurrent?.(platform);
      card.classList.add('open');
    });
  }

  // ---------- 确认框（原型自绘，双实例同步） ----------
  askConfirm(title: string, message: string, danger: boolean, onYes: () => void) {
    this.root!.querySelectorAll('.bz-password-vault-pop2:not(.bz-password-vault-platedit)').forEach((pop) => {
      const card = pop.querySelector('.card')!;
      card.querySelector('h3')!.textContent = title;
      card.querySelector('.msg')!.textContent = message;
      const ok = card.querySelector('.ok') as HTMLButtonElement;
      ok.textContent = danger ? '删除' : '确定';
      ok.classList.toggle('danger', !!danger);
      pop.classList.add('open');
      (pop as HTMLElement).dataset.confirmCb = 'pending';
      // 点击遮罩（非弹窗本体）关闭
      if (!(pop as HTMLElement).dataset.maskBound) {
        (pop as HTMLElement).dataset.maskBound = '1';
        pop.addEventListener('click', (e) => {
          if (e.target === pop) {
            pop.classList.remove('open');
            (pop as HTMLElement).dataset.confirmCb = '';
          }
        });
      }
    });
    // 绑定确认按钮（一次性）
    this.root!.querySelectorAll('.bz-password-vault-pop2:not(.bz-password-vault-platedit) .ok').forEach((ok) => {
      ok.addEventListener('click', () => {
        const pop = ok.closest('.bz-password-vault-pop2') as HTMLElement;
        pop.classList.remove('open');
        if (pop.dataset.confirmCb === 'pending') {
          pop.dataset.confirmCb = '';
          onYes();
        }
      });
    });
  }

  // ---------- toast（原型自绘） ----------
  toast(msg: string, isErr = false) {
    this.root!.querySelectorAll('.bz-password-vault-toast').forEach((el) => {
      el.textContent = msg;
      el.classList.toggle('err', !!isErr);
      el.classList.add('show');
    });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.root!.querySelectorAll('.bz-password-vault-toast').forEach((el) => el.classList.remove('show'));
    }, 1800);
  }

  // ---------- 复制 ----------
  private async copy(text: string): Promise<boolean> {
    try {
      await copySensitiveText(text);
      return true;
    } catch (e) {
      // 降级：textarea 选中法
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        if (ok) armClipboardClear();
        return ok;
      } catch (e2) {
        return false;
      }
    }
  }

  /** 打开外链（electron shell 优先，Obsidian 环境） */
  private openExternal(url: string): void {
    try {
      const w = window as any;
      const electron = w.require && w.require('electron');
      if (electron && electron.shell) {
        electron.shell.openExternal(url);
        return;
      }
    } catch (e) {
      /* fallthrough */
    }
    window.open(url, '_blank');
  }

  // ---------- 生成器 ----------
  generatePassword(): string {
    const length = parseInt(this.config.length) || 16;
    const charset = this.config.charset || DEFAULT_CHARSET;
    return secureRandomPassword(length, charset);
  }

  // ---------- 显示/隐藏 ----------
  show() {
    if (!this._initialized) this.ensureElements();
    this.root!.style.display = 'flex';
    topifyZ(this.root!); // ADR-0067
    void this.loadAndRender();
  }

  hide() {
    if (!this.root) return;
    this.root.style.display = 'none';
    if (this.config.securityMode) {
      this.dataManager.lock();
      this.toast('安全模式：已自动上锁');
    }
  }

  private async loadAndRender() {
    // 未解锁：静默（锁屏本身就是等待输入主密码，不弹「未解锁」错误通知）
    if (!this.dataManager.unlocked) {
      this.renderAll();
      this.showLock();
      return;
    }
    try {
      await this.dataManager.load();
    } catch (e: any) {
      notice('加载数据失败：' + e.message, 'error');
    }
    this.renderAll();
  }

  /** 显示锁屏（未解锁态）；锁屏绑定一次 */
  private showLock() {
    // 由 SafeManager 判定首设：exists()
    void this.isFirstTime().then((firstTime) => {
      this.root!.querySelectorAll('.bz-password-vault-lock').forEach((lockEl) => {
        const lock = lockEl as HTMLElement;
        lock.classList.add('open');
        const title = lock.querySelector('[data-lock-title]')!;
        const p1 = lock.querySelector('[data-lock-p1]') as HTMLInputElement;
        const p2 = lock.querySelector('[data-lock-p2]') as HTMLInputElement;
        const go = lock.querySelector('[data-lock-go]') as HTMLButtonElement;
        const err = lock.querySelector('[data-lock-err]') as HTMLElement;
        title.textContent = firstTime ? '设置主密码' : '输入主密码';
        p1.value = '';
        p2.value = '';
        p2.style.display = firstTime ? 'block' : 'none';
        err.textContent = '';
        go.textContent = firstTime ? '设置并解锁' : '解锁保险库';
        // 绑定（一次性）
        if (!lock.dataset.bound) {
          lock.dataset.bound = '1';
          this.bindLock(lock);
        }
        // 打开输入框自动聚焦（requestAnimationFrame 确保可见后再聚焦）
        requestAnimationFrame(() => {
          try {
            p1.focus();
          } catch (e) {
            /* 忽略 */
          }
        });
      });
    });
  }

  private async isFirstTime(): Promise<boolean> {
    const safe = this.dataManager.safeManager;
    try {
      return !(await safe.exists());
    } catch (e) {
      return false;
    }
  }

  /** 锁屏交互（原型视觉 + 保险箱安全机制） */
  private bindLock(lock: HTMLElement) {
    const p1 = lock.querySelector('[data-lock-p1]') as HTMLInputElement;
    const p2 = lock.querySelector('[data-lock-p2]') as HTMLInputElement;
    const err = lock.querySelector('[data-lock-err]') as HTMLElement;
    const go = lock.querySelector('[data-lock-go]') as HTMLButtonElement;
    const title = lock.querySelector('[data-lock-title]') as HTMLElement;
    const safe = this.dataManager.safeManager;
    let busy = false; // 解锁处理中防重入
    const showErr = (m: string) => {
      err.textContent = m;
      setTimeout(() => {
        if (err.textContent === m) err.textContent = '';
      }, 2600);
    };
    const setMode = () => {
      void this.isFirstTime().then((first) => {
        title.textContent = first ? '设置主密码' : '输入主密码';
        p2.style.display = first ? 'block' : 'none';
        go.textContent = first ? '设置并解锁' : '解锁保险库';
      });
    };
    go.addEventListener('click', async () => {
      if (busy) return;
      const first = await this.isFirstTime();
      const pw = p1.value;
      if (!pw) {
        showErr('请输入主密码');
        return;
      }
      if (first) {
        if (pw !== p2.value) {
          showErr('两次密码不一致');
          return;
        }
        if (pw.length < 4) {
          showErr('主密码至少 4 位');
          return;
        }
        // 首设风险确认（Q13 保留）：勾选后才能继续
        void openFlowDialog({
          title: '设置主密码',
          message:
            '主密码不会存储，也无法找回。若遗忘密码，保险库及加密数据将永久丢失。确定继续吗？',
          actions: [
            { label: '取消', value: 'cancel' },
            { label: '我已了解并继续', value: 'ok', cta: true },
          ],
        }).then(async (v) => {
          if (v !== 'ok') {
            p1.value = '';
            p2.value = '';
            showErr('已取消设置');
            return;
          }
          busy = true;
          go.textContent = '处理中…';
          try {
            const ok = await safe.unlock(pw);
            if (ok) {
              this.closeLock();
              this.toast('保险库已解锁');
              await this.reloadAfterUnlock();
              this.renderAll();
            } else {
              showErr('设置失败：无法写入清单，请检查磁盘空间后重试');
            }
          } catch (e: any) {
            showErr('设置失败：' + e.message);
          } finally {
            busy = false;
            go.textContent = first ? '设置并解锁' : '解锁保险库';
          }
        });
        return;
      }
      // 非首设：冷却节流（P2）
      const remainMs = this.security.unlockCooldownUntil - Date.now();
      if (remainMs > 0) {
        showErr(`尝试过于频繁，请再等 ${Math.ceil(remainMs / 1000)} 秒`);
        return;
      }
      busy = true;
      go.textContent = '处理中…';
      try {
        const ok = await safe.unlock(pw);
        if (ok) {
          this.security.unlockFailStreak = 0;
          this.security.unlockCooldownUntil = 0;
          this.closeLock();
          this.toast('保险库已解锁');
          await this.reloadAfterUnlock();
          this.renderAll();
        } else {
          // 清单损坏（empty/corrupt）→ 重设确认
          const issue = safe.manifestIssue;
          if (issue === 'empty' || issue === 'corrupt') {
            void openFlowDialog({
              title: '清单疑似损坏',
              message:
                '保险箱清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。' +
                '重设主密码将生成全新空清单，旧加密数据将永久无法恢复。确定重设吗？',
              actions: [
                { label: '暂不重设', value: 'cancel' },
                { label: '仍要重设', value: 'ok', cta: true },
              ],
            }).then((v) => {
              if (v === 'ok') {
                void safe.unlock(pw, true).then(async (ok) => {
                  if (ok) {
                    this.security.unlockFailStreak = 0;
                    this.security.unlockCooldownUntil = 0;
                    this.closeLock();
                    this.toast('已重设主密码（旧数据不可恢复）', true);
                    await this.reloadAfterUnlock();
                    this.renderAll();
                  } else {
                    showErr('重设失败：无法写入清单');
                  }
                });
              } else {
                showErr('未重设：请先检查或备份数据文件');
              }
            });
            return;
          }
          showErr('密码错误，请重试');
          // 连续失败递增冷却（1/2/4/8s 封顶）
          this.security.unlockFailStreak += 1;
          const delaySec = Math.min(2 ** (this.security.unlockFailStreak - 1), 8);
          this.security.unlockCooldownUntil = Date.now() + delaySec * 1000;
          showErr(`${delaySec} 秒后可再次尝试`);
          p1.value = '';
          p1.focus();
        }
      } finally {
        busy = false;
        go.textContent = first ? '设置并解锁' : '解锁保险库';
      }
    });
    p1.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (p2.style.display === 'block') p2.focus();
        else go.click();
      }
    });
    p2.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go.click();
    });
  }

  private closeLock() {
    this.root!.querySelectorAll('.bz-password-vault-lock').forEach((l) => l.classList.remove('open'));
  }

  // ---------- ESC ----------
  private registerEscape() {
    this.escUnregister = escManager.register('password-vault', {
      isVisible: () => !!this.root && this.root.style.display === 'flex',
      close: () => {
        // 弹窗优先
        const openModal = this.root!.querySelector('.bz-password-vault-modal.open');
        if (openModal) {
          this.closeEntryDialog();
          return;
        }
        const openConfirm = this.root!.querySelector('.bz-password-vault-pop2.open');
        if (openConfirm) {
          openConfirm.classList.remove('open');
          return;
        }
        this.hide();
      },
    });
  }

  // ---------- 卸载 ----------
  cleanup() {
    if (clipboardClearTimer !== null) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.escUnregister?.unregister();
    this.escUnregister = null;
    this.dataManager.destroy();
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this._initialized = false;
  }
}

// ==================== Controller（命令入口由 index.ts 管理） ====================

export class PasswordVaultAppController {
  static instance: PasswordVaultAppController | null = null;

  static getInstance(config: PasswordVaultUIConfig): PasswordVaultAppController {
    if (!PasswordVaultAppController.instance) {
      PasswordVaultAppController.instance = new PasswordVaultAppController(config);
    }
    return PasswordVaultAppController.instance;
  }

  dataManager: PasswordVaultDataManager;
  uiManager: PasswordVaultUIManager;
  _initialized = false;

  constructor(config: PasswordVaultUIConfig) {
    this.dataManager = new PasswordVaultDataManager();
    this.uiManager = new PasswordVaultUIManager(this.dataManager, config);
  }

  async init() {
    if (this._initialized) return;
    this.uiManager.ensureElements();
    this._initialized = true;
  }

  /** 打开：未解锁 → 先解锁（原型锁屏），解锁后进入 */
  async openManager() {
    await this.init();
    this.uiManager.show();
    // show() 内部会 loadAndRender；若未解锁显示锁屏
  }

  cleanup() {
    this.uiManager.cleanup();
    PasswordVaultAppController.instance = null;
  }
}
