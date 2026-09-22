/**
 * 保险库（password-vault）UI — 原型 v1「保险库」一比一移植
 * 桌面三栏工作台（导航+列表+详情）+ 移动端（列表卡+详情页+FAB）+ 原型自绘
 * 右键菜单 / 底部抽屉 / 解锁屏（金色印章 + 安全机制嵌入）；
 * 确认框走 core 流程框（openFlowDialog）、提示走 core 全局通知（issue 365 收编）。
 * 数据经 PasswordVaultDataManager（保险箱 password-vault SafeNote 共享）；
 * 解锁底层走保险箱 SafeManager（同一主密码），原型锁屏仅作视觉壳，
 * 安全机制（首设风险确认/失败冷却/损坏重设/自愈提示）完整保留（Q13）。
 * 命令入口由 index.ts 注册（bz-password-vault-open）。
 * markup 单源（issue 251/ADR-0110）：全部 HTML 出自 ./render.ts（本文件零模板串）。
 */
import { escManager } from '../core/esc-manager';
import { secureRandomPassword, copySensitiveWithFallback, cancelClipboardClear, debounce, openExternalUrl } from '../core/utils';
import { getApp } from '../core/app';
import { getSafeManager } from '../encrypt';
import { ENCRYPT_UNLOCK_CHANGED_CHANNEL } from '../encrypt/data';
import { onDomainEvent } from '../core/domain-bus';
import { topifyZ, createSiteIcon } from '../core/dom';
import { openFlowDialog, cancelActiveFlowDialog } from '../core/flow-dialog';
import { tryGetSettings } from '../core/settings-provider';
import { uiLockScreen } from '../core/ui/lock-screen';
import type { LockScreenHandle, LockScreenStat } from '../core/ui/lock-screen';
import { bindFormSubmit } from '../core/ui/modal';
import { readLockStats, writeLockStats } from '../core/lock-stats';
import { notice, notifyUndo, notifyActionError } from '../core/notice';
import { attachItemActions, openItemSheet, type ItemAction } from '../core/item-actions';
import {
  PasswordVaultDataManager,
  DEFAULT_PW_CHARSET,
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
import {
  motionArmBoot, motionArmSwitch, motionArmSearch, motionArmReveal, motionArmFav,
  motionRendered, motionPanelIn, motionPanelCollapse,
  motionLockIn, motionLockIdle, motionUnlockBurst,
  motionDialogIn, motionGenFlash, motionCopyBurst,
  motionQuickPickIn, motionQpPick, motionMobPageIn,
  motionTeardown,
} from './motion';

// （arch 新-5 清仓：relTime/colorOf/PasswordVaultEntry 再导出零外部消费，已删——
//   消费方请直接走 ./render 与 ./data 单源）

/** 安全机制状态（Q13：完整保留保险箱行为） */
interface LockSecurity {
  unlockFailStreak: number;
  unlockCooldownUntil: number;
}

// secureRandomPassword / copySensitiveWithFallback / cancelClipboardClear 收口 core/utils（批次 G 单源 + issue 365 剪贴板兜底单源）
// DEFAULT_CHARSET 域内副本已删（深审口径批）：生成字符集单源 data.ts DEFAULT_PW_CHARSET，本文件 import 消费

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
  editingId: string | null = null;
  // 安全机制（Q13）
  security: LockSecurity = { unlockFailStreak: 0, unlockCooldownUntil: 0 };
  // 搜索防抖（core debounce 单源收编，自带 cancel；桌面/移动双实例输入共用一支）
  private applySearch = debounce((kw: string) => {
    this.searchKw = kw;
    this.syncSearchInputs(); // 新-6：提交时写回双实例输入框（一侧输入另一侧不同步）
    motionArmSearch(); // 动效层：搜索刷新——行快级联
    this.renderAll();
  }, 180);
  /** 安全模式无交互自动上锁计时器（15 分钟；document 捕获阶段交互重置，cons 新-3 对齐 encrypt 形制） */
  private idleLockTimer: ReturnType<typeof setTimeout> | null = null;
  /** idle bump 的 document 捕获监听（不随 DOM 摘除回收，cleanup 摘除） */
  private idleBump: (() => void) | null = null;
  /** 锁屏错误/冷却计时器收场句柄（bindLock 注册，cleanup 统一清） */
  private lockTimerDisposers: Array<() => void> = [];
  private escUnregister: { unregister: () => void } | null = null;
  /** 共锁订阅（E2）：encrypt:unlock-changed 退订句柄（show 挂 / hide+cleanup 摘） */
  private unlockOff: (() => void) | null = null;
  private _initialized = false;
  // DOM 引用（桌面）
  private desk!: {
    rows: HTMLElement;
    detail: HTMLElement;
    search: HTMLInputElement;
    count: HTMLElement;
    title: HTMLElement;
    lock: HTMLElement;
    modal: HTMLElement;
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
    modal: HTMLElement;
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
      title: desk.querySelector('.bz-password-vault-listhead h1')!,
      lock: desk.querySelector('.bz-password-vault-lock')!,
      modal: desk.querySelector('.bz-password-vault-modal')!,
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
      modal: mob.querySelector('.bz-password-vault-modal')!,
      platEdit: mob.querySelector('.bz-password-vault-platedit')!,
    };

    // 绑定交互
    this.bindDesk();
    this.bindMob();
    this.bindDialogs();
    this.registerEscape();
    // 外部变更（保险箱/旧密码本）→ 重绘；移动详情页停驻时同步重建（新-9，refreshMobPage 同 E6 口径）
    this.dataManager.onExternalChange = () => {
      this.renderAll();
      this.refreshMobPage();
    };
    // 安全模式无交互自动上锁（cons 新-3）：任何交互重置 15 分钟倒计时（捕获阶段兜底输入框事件，
    // N9 教训——body 弹层内的持续操作同样算「活跃使用」）。document 级监听不随 DOM 摘除回收，
    // 摘除走 cleanup。
    this.idleBump = () => this.bumpIdleLock();
    document.addEventListener('pointerdown', this.idleBump, true);
    document.addEventListener('keydown', this.idleBump, true);
  }

  /** 视图切换单出口（呈报#16/P4）：双端实例（桌面导航 + 移动 tabs）高亮联动后重绘 */
  private setView(v: 'all' | 'fav'): void {
    if (v !== 'all' && v !== 'fav') return;
    this.view = v;
    motionArmSwitch(); // 动效层：视图切换——行级联 + 详情揭出
    const root = this.root!;
    root.querySelectorAll('.bz-password-vault-navitem').forEach((x) =>
      x.classList.toggle('on', x.getAttribute('data-view') === v)
    );
    root.querySelectorAll('[data-mobview]').forEach((x) => {
      const on = x.getAttribute('data-mobview') === v;
      x.classList.toggle('on', on);
      x.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    this.renderAll();
  }

  // ---------- 交互绑定 ----------
  private bindDesk() {
    const root = this.root!;
    // 导航（呈报#16/P4：切换统一走 setView，双端实例高亮联动）
    root.querySelectorAll('.bz-password-vault-navitem').forEach((it) => {
      it.addEventListener('click', () => this.setView(it.getAttribute('data-view') as 'all' | 'fav'));
    });
    // 搜索防抖（双实例共用一支 applySearch）
    this.desk.search.addEventListener('input', (e) => {
      this.applySearch((e.target as HTMLInputElement).value.trim());
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
    // 视图切换（呈报#16/P4：移动端「已收藏」此前无入口，顶栏下补 全部/收藏 分段）
    root.querySelectorAll('[data-mobview]').forEach((it) => {
      it.addEventListener('click', () => this.setView(it.getAttribute('data-mobview') as 'all' | 'fav'));
    });
    // 搜索（双实例共用一支 applySearch）
    this.mob.search.addEventListener('input', (e) => {
      this.applySearch((e.target as HTMLInputElement).value.trim());
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
    // 呈报#16/P5：移动详情页网址可点——委托拦截 a[data-extlink] 走 core openExternalUrl
    // 单源（preventDefault 截断浏览器默认跳转 + stopPropagation 防冒泡开卡）；
    // pageBody 是持久节点，委托在此绑一次，页面内容重建不叠加监听
    this.mob.pageBody.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('a[data-extlink]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      openExternalUrl(getApp(), a.getAttribute('href') || '');
    });
  }

  private mobPagePlatform: string | null = null;
  /** 当前移动详情页若是「账号详情页」，记录其条目（E6：重建页内容时区分平台页/账号页） */
  private mobPageAccount: PasswordVaultEntry | null = null;

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
      // 生成（呈报#3/P6）：密码框为空直接生成；已手填非空 → 先经 core 流程框确认一声，
      // 防手滑把手工密码无声顶掉（确认/取消均不动原值，确认后才覆盖）
      dlg.querySelector('[data-act="gen"]')?.addEventListener('click', () => {
        const pwInput = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
        if (pwInput.value) {
          this.askConfirm('覆盖已填密码？', '密码框已有内容，生成新密码将替换它，替换后无法找回。', false, () => {
            pwInput.value = this.generatePassword();
            motionGenFlash(pwInput); // 动效层：新密码亮一记
            this.toast('已生成新密码');
          });
          return;
        }
        pwInput.value = this.generatePassword();
        motionGenFlash(pwInput); // 动效层：新密码亮一记
        this.toast('已生成新密码');
      });
      // eye 切换（E5）：默认掩码，点击明文/掩码互换（对齐 encrypt 侧同弹窗）
      dlg.querySelector('[data-act="pw-eye"]')?.addEventListener('click', () => {
        const input = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
        const eye = dlg.querySelector('[data-act="pw-eye"]') as HTMLElement;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        if (show) motionGenFlash(input); // 动效层：明文显影亮一记（掩回不演——瞬间归掩更安全）
        eye.title = show ? '隐藏密码' : '显示密码';
        eye.innerHTML = show ? ICONS.eyeoff : ICONS.eye;
      });
      // 取消
      dlg.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
        this.closeEntryDialog();
      });
      // 保存（func 新-4 防重入：写盘含整表 PBKDF2 重加密为秒级窗口，busy 旗标 + 按钮
      // disabled 双保险，快速双击只落一条不产重复条目）
      let saving = false;
      const saveBtn = dlg.querySelector('[data-act="save"]') as HTMLButtonElement | null;
      saveBtn?.addEventListener('click', async () => {
        if (saving) return;
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
        saving = true;
        if (saveBtn) saveBtn.disabled = true;
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
        } finally {
          saving = false;
          if (saveBtn) saveBtn.disabled = false;
        }
      });
      // 回车提交（深审新-13，core bindFormSubmit 全域范式单源）：单行 input 聚焦时
      // Enter/Ctrl+Enter=保存（转接保存按钮，校验/错误行/落盘链路原样复用）；本弹窗无 textarea
      bindFormSubmit(dlg as HTMLElement, () => (dlg.querySelector('[data-act="save"]') as HTMLButtonElement).click());
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
      // 回车提交（深审新-13）：平台编辑弹窗同款接 core bindFormSubmit
      bindFormSubmit(card, () => (card.querySelector('[data-act="save"]') as HTMLButtonElement).click());
    });
  }

  // ---------- 渲染 ----------
  /**
   * 搜索词写回双实例输入框（深审新-6）：桌面/移动双实例各有搜索框、共享同一 searchKw——
   * 一侧输入防抖提交后，另一侧（重开面板/切端可见时）不再出现「筛选在生效、框却是空的」。
   * 只在防抖提交时调用：渲染路径不清输入框，不打断另一侧未提交的输入中内容。
   */
  private syncSearchInputs(): void {
    const kw = this.searchKw;
    for (const inp of [this.desk.search, this.mob.search]) {
      if (inp && inp.value.trim() !== kw) inp.value = kw;
    }
  }

  renderAll() {
    if (!this.root) return;
    // T12 对齐 encrypt：renderAll 不落盘（本域最高频入口，原先搜索防抖/点眼/收藏每次都写
    // lock-stats.json）——只刷内存快照供上锁消费点取用，写盘收敛到消费点（hide/外部上锁/lockNow）
    this.refreshLockStatsCache();
    this.renderLock();
    this.renderDeskList();
    this.renderDeskDetail();
    this.renderMobList();
    // 动效层：按意图播编排（boot/switch/search/默认轻揭出）+ eye·fav 锚点消费
    motionRendered(this.root);
    // 解锁态即布防 idle 自动上锁（安全模式；交互经 document 捕获 bump 重置）——
    // 布防收口在此：show / 解锁重载 / 域内动作后的重绘都汇经此处（对齐 encrypt renderList→startSessionTimers）
    if (this.dataManager.unlocked) this.bumpIdleLock();
  }

  private renderLock() {
    const unlocked = this.dataManager.unlocked;
    this.root!.querySelectorAll('.bz-password-vault-lock').forEach((el) => {
      (el as HTMLElement).classList.toggle('open', !unlocked);
    });
  }

  /** 解锁成功后重载数据：锁屏打开时 load() 因未解锁而失败，pwData 为空，
   *  解锁成功必须重新 load 才能渲染出清单（回归：解锁不重载 → 空列表） */
  private async reloadAfterUnlock(): Promise<void> {
    try {
      await this.dataManager.load();
    } catch (e: any) {
      // 深审口径批：手拼错误串收编 core notifyActionError（人话错误 + 重试出口）
      notifyActionError(e, '加载数据', { onRetry: () => void this.loadAndRender() });
    }
  }

  /** 渲染桌面列表（平台聚合 / 搜索展平） */
  private renderDeskList() {
    const rows = this.desk.rows;
    if (!this.dataManager.unlocked) {
      // 锁定态守卫（func 新-1 症状 B）：search(kw) 未解锁即 throw，kw 残留会炸断渲染链
      // （renderAll 中断 + unhandled rejection + showLock 被跳过）——清空容器直接返回，
      // 锁屏随后由 showLock 接管
      rows.innerHTML = '';
      this.desk.count.textContent = '';
      this.desk.title.textContent = '';
      this.root!.querySelector('[data-cnt="all"]')!.textContent = '0';
      this.root!.querySelector('[data-cnt="fav"]')!.textContent = '0';
      return;
    }
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
      this.desk.count.textContent = hits.length + ' 条匹配';
      rows.innerHTML = '';
      if (!hits.length) {
        rows.innerHTML = emptyHtml('bz-password-vault-empty', '没有匹配的条目', '换个关键词，或清空搜索', { style: 'flex:1' });
        return;
      }
      hits.forEach((d) => {
        const r = document.createElement('div');
        r.className = 'bz-password-vault-row' + (d.id === this.selAccount ? ' on' : '');
        r.innerHTML = hitRowHtml(d);
        r.dataset.pwvEntry = d.id; // 动效层锚点：收藏点亮按 id 找回行（无视觉影响）
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
    this.desk.count.textContent = plats.length + ' 个平台';
    rows.innerHTML = '';
    if (!plats.length) {
      rows.innerHTML =
        this.view === 'fav'
          ? emptyHtml('bz-password-vault-empty', '还没有收藏', '点条目里的 ★ 收藏常用账号', { style: 'flex:1' })
          : emptyHtml('bz-password-vault-empty', '密码本还是空的', '点击右上角「添加密码」开始收录', { style: 'flex:1', ctaLabel: '添加第一条密码', ctaAct: 'add-first' });
      rows.querySelector('[data-act="add-first"]')?.addEventListener('click', () => this.openEntryDialog(null));
      return;
    }
    plats.forEach((p) => {
      const recent = p.accounts[0];
      const r = document.createElement('div');
      r.className = 'bz-password-vault-plrow' + (p.platform === this.selPlatform ? ' on' : '');
      r.dataset.pwvPlat = p.platform; // 动效层锚点：收藏点亮按平台找回行（无视觉影响）
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
      // 深审新-11：fav 视图下「账号被 fav 过滤光」≠ 平台无账号（普通视图同平台明明有），
      // 空态文案按视图分叉，不再口径打架
      acctsEl.innerHTML = emptyHtml(
        'bz-password-vault-empty',
        this.view === 'fav' ? '该平台暂无收藏账号' : '该平台暂无账号',
        ''
      );
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
      card.dataset.pwvEntry = d.id; // 动效层锚点：eye 显影/收藏点亮按 id 找回卡片（无视觉影响）
      card.querySelectorAll('[data-act]').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const act = b.getAttribute('data-act') || '';
          if (act === 'copy-ac' || act === 'copy-pw') motionCopyBurst(b as HTMLElement); // 动效层：复制金屑
          void this.handleAccountAction(d, act);
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
    card.dataset.pwvEntry = d.id; // 动效层锚点：eye 显影/收藏点亮按 id 找回卡片（无视觉影响）
    card.querySelectorAll('[data-act]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.getAttribute('data-act') || '';
        if (act === 'copy-ac' || act === 'copy-pw') motionCopyBurst(b as HTMLElement); // 动效层：复制金屑
        void this.handleAccountAction(d, act);
      })
    );
    attachItemActions(card, this.buildAccountActions(d), {
      sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
    });
    acctsEl.appendChild(card);
  }

  /** 账号级动作分发（桌面卡片/详情/搜索态共用） */
  private async handleAccountAction(d: PasswordVaultEntry, act: string) {
    const t = (m: string, err = false) => this.toast(m, err);
    if (act === 'copy-ac') {
      // 呈报#21/P2：空值不执行复制（复制到空气还报成功），提示真实状态
      if (!d.account) {
        t('该条目无账号');
        return;
      }
      (await copySensitiveWithFallback(d.account)) ? t('账号已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
    } else if (act === 'copy-pw') {
      if (!d.password) {
        t('该条目无密码');
        return;
      }
      (await copySensitiveWithFallback(d.password)) ? t('密码已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
    } else if (act === 'eye') {
      const revealing = !this.shownIds[d.id];
      this.shownIds[d.id] = revealing;
      if (revealing) motionArmReveal(d.id); // 动效层：明文显影锚点（掩回不演——瞬间归掩更安全）
      this.renderAll();
      this.refreshMobPage(); // E6：移动详情页重建，明文/掩码立即生效
    } else if (act === 'edit') {
      this.openEntryDialog(d);
    } else if (act === 'fav') {
      try {
        await this.dataManager.toggleFav(d.id); // E16：失败 toast + 回滚重绘（dataManager 内存快照回退）
        motionArmFav(d.id); // 动效层：星标点亮弹跳锚点
      } catch (e: any) {
        t('操作失败：' + (e?.message || e), true);
      }
      this.renderAll();
      this.refreshMobPage(); // E6：收藏星标立即生效
    } else if (act === 'del') {
      this.askConfirm('删除密码条目', `确定删除账号「${d.account}」吗？删除后可在通知中撤销。`, true, () => {
        void (async () => {
          try {
            await this.dataManager.deleteItem(d.id); // E16：失败 toast（回滚由数据层负责）
          } catch (e: any) {
            t('删除失败：' + (e?.message || e), true);
            this.renderAll();
            return;
          }
          if (this.selAccount === d.id) this.selAccount = null;
          this.clearSelPlatformIfEmpty(); // 新-10：删到平台最后一个账号 → 清选中回列表，详情不留空壳
          this.renderAll();
          this.refreshMobPage(); // E6：已删条目从移动详情页消失
          this.notifyDeleteOne(d); // 新-10：撤销链（替代「已删除」单向 toast）
        })();
      });
    }
  }

  // ---------- 删除撤销链（新-10，core notifyUndo 单源；确认框保留为用户拍板项） ----------
  /** 单账号删除通知：挂「撤销」按钮，点击原样塞回刚删条目（保 id/createdAt/fav）。 */
  private notifyDeleteOne(d: PasswordVaultEntry): void {
    notifyUndo(`已删除「${d.account || '(无账号)'}」`, () => {
      void this.undoRestore([d]);
    });
  }

  /**
   * 恢复刚删条目（新-10）：数据原样塞回（区别于 addItem——不重发 id/createdAt，选中态与
   * 展示引用不失效）+ save 失败回滚内存（saveWithRollback 同款口径）。不动 data.ts 接口，
   * 用公开面（pwData 字段 + save()）在 ui 层组合实现；恢复后重绘双端。
   */
  private async undoRestore(entries: PasswordVaultEntry[]): Promise<void> {
    const snap = this.dataManager.pwData.map((d) => ({ ...d }));
    try {
      const ids = new Set(entries.map((e) => e.id));
      const rest = this.dataManager.pwData.filter((d) => !ids.has(d.id));
      rest.unshift(...entries.map((e) => ({ ...e })));
      this.dataManager.pwData = rest;
      await this.dataManager.save();
    } catch (e: any) {
      this.dataManager.pwData = snap; // 写盘失败回滚内存，不留半恢复态
      this.toast('撤销失败：' + (e?.message || e), true);
      this.renderAll();
      return;
    }
    this.renderAll();
    this.refreshMobPage();
  }

  /** 删除后清悬空选中（新-10）：平台已无账号 → selPlatform/selAccount 回列表（详情区不再空壳）。 */
  private clearSelPlatformIfEmpty(): void {
    if (this.selPlatform && this.dataManager.accountsOf(this.selPlatform).length === 0) {
      this.selPlatform = null;
      this.selAccount = null;
    }
  }

  /**
   * 重建当前移动端详情页（E6）：renderAll 只重绘列表，已打开的 pageBody 不重建——
   * eye/fav 等内存态变化后页面内容要等下次进入才更新（点眼睛/收藏无可见反应）。
   * 页未打开为幂等空操作；条目/平台已被删光则收起页面。
   */
  private refreshMobPage(): void {
    if (!this.mobPagePlatform || !this.mob.page.classList.contains('open')) return;
    const plat = this.mobPagePlatform;
    if (this.mobPageAccount && this.mobPageAccount.id) {
      const d = this.dataManager.pwData.find((x) => x.id === this.mobPageAccount!.id);
      if (d) {
        this.openAccountPage(d);
        return;
      }
    }
    const group = this.dataManager.platforms().find((p) => p.platform === plat);
    if (group) {
      this.openPage(group);
      return;
    }
    this.mob.page.classList.remove('open');
    this.mobPagePlatform = null;
    this.mobPageAccount = null;
  }

  // ---------- 移动端渲染 ----------
  private renderMobList() {
    const list = this.mob.list;
    if (!this.dataManager.unlocked) {
      // 锁定态守卫：同 renderDeskList（search 未解锁即 throw，防 kw 残留炸断渲染链）
      list.innerHTML = '';
      return;
    }
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
        c.dataset.pwvEntry = d.id; // 动效层锚点（同桌面搜索态行）
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
          : emptyHtml('bz-password-vault-mobempty', '密码本还是空的', '点击右下角 + 添加第一条密码', { ctaLabel: '添加密码', ctaAct: 'add-first' });
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
      c.dataset.pwvPlat = p.platform; // 动效层锚点（同桌面平台行）
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
        void this.handleAccountAction(d!, a);
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
    this.mobPageAccount = null; // E6：平台页
    // 动效层锚点：seg 按 DOM 序回填条目 id（页体为字符串拼接，无 id 载体；无视觉影响）
    this.mob.pageBody.querySelectorAll<HTMLElement>('.bz-password-vault-seg').forEach((seg, i) => {
      if (accs[i]) seg.dataset.pwvEntry = accs[i].id;
    });
    this.mob.page.classList.add('open');
    motionMobPageIn(this.mob.pageBody); // 动效层：页内 seg 卡接力（壳体 sheetup 走既有 CSS）
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
        void this.handleAccountAction(d, a);
      })
    );
    const seg = this.mob.pageBody.querySelector('.bz-password-vault-seg') as HTMLElement;
    if (seg) seg.dataset.pwvEntry = d.id; // 动效层锚点（同平台页）
    attachItemActions(seg, this.buildAccountActions(d), {
      sheetHead: this.buildSheetHead(d.account, d.platform, d.createdAt),
    });
    this.mob.pageTitle.textContent = d.platform;
    this.mobPagePlatform = d.platform;
    this.mobPageAccount = d; // E6：账号页
    this.mob.page.classList.add('open');
    motionMobPageIn(this.mob.pageBody); // 动效层：页内内容接力
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

  private buildAccountActions(d: PasswordVaultEntry): ItemAction[] {
    const t = (m: string, err = false) => this.toast(m, err);
    return [
      {
        icon: 'copy',
        label: '复制账号',
        onClick: () => {
          void (async () => {
            // 呈报#21/P2：空值不执行复制（同卡片按钮口径）
            if (!d.account) {
              t('该条目无账号');
              return;
            }
            (await copySensitiveWithFallback(d.account)) ? t('账号已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
          })();
        },
      },
      {
        icon: 'key',
        label: '复制密码',
        onClick: () => {
          void (async () => {
            if (!d.password) {
              t('该条目无密码');
              return;
            }
            (await copySensitiveWithFallback(d.password)) ? t('密码已复制（60 秒后自动清空）') : t('复制失败，请手动复制', true);
          })();
        },
      },
      {
        icon: 'star',
        label: d.fav ? '取消收藏' : '收藏',
        onClick: () => {
          void (async () => {
            try {
              await this.dataManager.toggleFav(d.id); // E16：失败 toast，不再裸 await 吞成 unhandled rejection
              motionArmFav(d.id); // 动效层：星标点亮弹跳锚点
            } catch (e: any) {
              t('操作失败：' + (e?.message || e), true);
            }
            this.renderAll();
            this.refreshMobPage();
          })();
        },
      },
      {
        icon: 'external-link',
        label: '打开链接',
        onClick: () => {
          if (d.url) openExternalUrl(getApp(), d.url); // 补派收编：core openExternalUrl 单源
          else t('该条目没有链接', true);
        },
      },
      { icon: 'pencil', label: '编辑', onClick: () => this.openEntryDialog(d) },
      {
        icon: 'trash-2',
        label: '删除',
        kind: 'danger',
        onClick: () =>
          this.askConfirm('删除密码条目', `确定删除账号「${d.account}」吗？删除后可在通知中撤销。`, true, () => {
            void (async () => {
              try {
                await this.dataManager.deleteItem(d.id); // E16：失败 toast
              } catch (e: any) {
                t('删除失败：' + (e?.message || e), true);
                this.renderAll();
                return;
              }
              if (this.selAccount === d.id) this.selAccount = null;
              this.clearSelPlatformIfEmpty(); // 新-10：删到平台最后一个账号 → 清选中回列表
              this.renderAll();
              this.refreshMobPage();
              this.notifyDeleteOne(d); // 新-10：撤销链（替代「已删除」单向 toast）
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
            // 呈报#21/P2：空值不执行复制（同卡片按钮口径）
            if (!recent.account) {
              t('该条目无账号');
              return;
            }
            (await copySensitiveWithFallback(recent.account)) ? t('最近账号已复制（60 秒后自动清空）') : t('复制失败', true);
          })();
        },
      });
      actions.push({
        icon: 'key',
        label: '复制最近密码',
        onClick: () => {
          void (async () => {
            if (!recent.password) {
              t('该条目无密码');
              return;
            }
            (await copySensitiveWithFallback(recent.password)) ? t('最近密码已复制（60 秒后自动清空）') : t('复制失败', true);
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
        this.askConfirm('删除整个平台', `将删除「${platform}」的 ${count} 个账号，删除后可在通知中撤销。确定继续？`, true, () => {
          void (async () => {
            // 撤销快照先于删除捕获（浅拷贝条目；removePlatform 只滤数组不动条目对象）
            const removed = this.dataManager.accountsOf(platform).map((d) => ({ ...d }));
            let n = 0;
            try {
              n = await this.dataManager.removePlatform(platform); // E16：失败 toast
            } catch (e: any) {
              t('删除失败：' + (e?.message || e), true);
              this.renderAll();
              return;
            }
            this.selPlatform = null;
            this.renderAll();
            this.refreshMobPage(); // E6：整平台删除后收起其移动详情页
            // 新-10：撤销链——整平台原样塞回（保 id/createdAt/fav）
            notifyUndo(`已删除平台「${platform}」与 ${n} 个账号`, () => {
              void this.undoRestore(removed);
            });
          })();
        }),
    });
    return actions;
  }

  // ---------- 添加/编辑弹窗 ----------
  /** 当前生效实例（desk/mob）：与 styles.css 移动断点（max-width:768px）同口径（深审新-3）。
   *  matchMedia 缺失（异常环境）回落 desk——notice.isMobileView 同款守卫。 */
  private activeWhich(): 'desk' | 'mob' {
    try {
      if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(max-width: 768px)').matches ? 'mob' : 'desk';
      }
    } catch (e) {
      /* fallthrough */
    }
    return 'desk';
  }

  /**
   * 聚焦弹窗在当前生效实例上的目标输入框（深审新-3）：querySelector 恒取 DOM 序靠前的
   * 桌面实例，移动端桌面实例 display:none 时 focus 无效、软键盘不弹——按断点选实例取字段，
   * 查不到（异常环境）回落首个命中。
   */
  private focusDialogField(sel: string, attr: 'modal' | 'plat-edit', fieldSel: string): void {
    const which = this.activeWhich();
    const el =
      this.root!.querySelector(`${sel}[data-${attr}="${which}"] ${fieldSel}`) ||
      this.root!.querySelector(`${sel} ${fieldSel}`);
    (el as HTMLInputElement | null)?.focus();
  }

  openEntryDialog(editItem: PasswordVaultEntry | null = null, preset?: { platform?: string; url?: string }) {
    if (!this.dataManager.unlocked) {
      notice('请先解锁密码本');
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
      // N13：弹窗重开复位 eye 三件套——上次点过明文后，再开弹窗（含添加态自动生成的
      // 新密码）不得以明文示人
      const pwInput = dlg.querySelector('[data-f="password"]') as HTMLInputElement;
      pwInput.type = 'password';
      const eye = dlg.querySelector('[data-act="pw-eye"]') as HTMLElement | null;
      if (eye) {
        eye.innerHTML = ICONS.eye;
        eye.title = '显示密码';
      }
      if (!editItem) {
        pwInput.value = this.generatePassword();
        motionGenFlash(pwInput); // 动效层：自动生成的密码亮一记
      }
      (dlg.querySelector('[data-f-err]') as HTMLElement).textContent = '';
      modal.classList.add('open');
      motionDialogIn(dlg as HTMLElement); // 动效层：弹窗升起 + 封蜡金线（不可见实例内部自跳过）
    });
    // 焦点（深审新-3）：落当前生效实例，移动端软键盘才弹得起
    this.focusDialogField('.bz-password-vault-modal', 'modal', '[data-f="platform"]');
  }

  private closeEntryDialog() {
    this.root!.querySelectorAll('.bz-password-vault-modal').forEach((m) => m.classList.remove('open'));
    this.editingId = null;
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
      motionDialogIn(card.querySelector<HTMLElement>('.card')!); // 动效层：平台编辑卡升起 + 封蜡金线
    });
    // 聚焦（深审新-3）：平台编辑弹窗此前全平台无 focus，打开后焦点落 body——补当前生效实例聚焦
    this.focusDialogField('.bz-password-vault-platedit', 'plat-edit', '[data-f="platform"]');
  }

  // ---------- 确认框（core 流程框单源，issue 365 收编） ----------
  /**
   * 确认框：原 E1 时代为域内自绘双实例同步弹层（回调覆写 + pending 消费，曾因确定按钮
   * 监听器逐次叠加而删错条目）；现收编 core openFlowDialog——每次新建 DOM、取消按钮 /
   * ESC / 遮罩点击一律按取消语义 resolve undefined，仅 value==='ok' 执行 onYes，
   * 监听器叠加隐患随自绘 DOM 一并消失。danger 时确认钮文案「删除」并挂危险修饰
   * （bz-flow-dialog--danger：主钮中性底 + 红字，对齐原 .ok.danger 语义）；
   * 域皮类 bz-pwv-flow-dialog 让金色材质随行（弹窗挂 document.body，见域 CSS 说明）。
   */
  askConfirm(title: string, message: string, danger: boolean, onYes: () => void) {
    void openFlowDialog({
      title,
      message,
      className: 'bz-pwv-flow-dialog',
      actions: [
        { label: '取消', value: 'cancel' },
        { label: danger ? '删除' : '确定', value: 'ok', cta: true, danger },
      ],
    }).then((v) => {
      if (v === 'ok') onYes();
    });
  }

  // ---------- 提示（core 全局通知单源，issue 365 收编） ----------
  /**
   * 提示：原为面板内自绘 toast（双实例同步 + 1800ms 定时器），收编 core 全局通知——
   * 面板最小化/隐藏时提示仍可见（E15 同款教训）。档位对齐 encrypt 域（深审口径漂移批）：
   * isErr → error（❌）；常规动作走 info（ℹ️）——success（✅）仅大节点（解锁成功等），
   * 由调用方直接 notice(msg, 'success')，不再经本封装一律抬成 success。
   */
  toast(msg: string, isErr = false) {
    notice(msg, isErr ? 'error' : 'info');
  }

  // ---------- 复制（core 剪贴板兜底单源，issue 365 收编） ----------
  // 复制链路（copySensitiveText 失败 → textarea+execCommand 兜底 + 60s 自动清空）
  // 收口 core/utils 的 copySensitiveWithFallback；本域 encrypt 双域消费同一实现。
  // 打开外链原私有 openExternal 副本已删（补派收编单源）：electron→window.open 两链缺
  // app.openUrl 首选与全链失败提示，改消费 core/utils openExternalUrl（memo/favorites 同范式）。

  // ---------- 生成器 ----------
  generatePassword(): string {
    const length = parseInt(this.config.length) || 16;
    const charset = this.config.charset || DEFAULT_PW_CHARSET; // 单源 data.ts（域内副本已删）
    return secureRandomPassword(length, charset);
  }

  // ---------- 显示/隐藏 ----------
  show() {
    if (!this._initialized) this.ensureElements();
    this.root!.style.display = 'flex';
    topifyZ(this.root!); // ADR-0067
    motionArmBoot(); // 动效层：boot 意图置位（首个渲染消费即熄）
    motionPanelIn(this.root!); // 动效层：工作台卡升起 + 金印压落 + FAB 弹入
    this.subscribeUnlockEvents(); // E2：面板打开期间感知别域上锁/解锁（保险库「立即上锁」/安全模式/日记域）
    this.bumpIdleLock(); // 开屏即布防 idle 自动上锁（安全模式）；后续交互经 renderAll/document bump 重置
    void this.loadAndRender();
  }

  /** 上锁/关面板收场：面板内双实例弹窗 + body 流程框一并收起（cons 新-2 对齐 encrypt N9 形制）——
   *  明文密码/账号不得随弹窗浮在锁屏上方，安全承诺不被弹窗 DOM 击穿 */
  private closeAllDialogs(): void {
    this.closeEntryDialog();
    this.root!.querySelectorAll('.bz-password-vault-platedit.open').forEach((el) => el.classList.remove('open'));
    // body 级流程确认框（首设风险告知/删除确认/损坏重设）随上锁收场，按取消语义结算不悬挂
    cancelActiveFlowDialog();
  }

  /** 收移动详情页（N14/新-4）：页体 + 平台/账号记录一并清，明文详情不跨 hide/上锁残留 */
  private closeMobPage(): void {
    this.mob.page.classList.remove('open');
    this.mobPagePlatform = null;
    this.mobPageAccount = null;
  }

  /** 清搜索过滤态（func 新-1 症状 B 配套）：kw 残留 + 两实例搜索框值一并复位 */
  private resetSearchFilter(): void {
    this.applySearch.cancel(); // 在途防抖一并收口（core debounce，批 C 收编后取代 searchTimer）
    this.searchKw = '';
    this.desk.search.value = '';
    this.mob.search.value = '';
  }

  /** 安全模式双口径（N18②/cons 新-1 对齐 encrypt isSecurityMode）：config 是构造期快照可能
   *  落后于设置实时值，且历史双键（securityMode/encryptSecurityMode）任一开启都生效 */
  private isSecurityModeLive(): boolean {
    return (
      !!this.config.securityMode ||
      !!(tryGetSettings() as any)?.securityMode ||
      !!(tryGetSettings() as any)?.encryptSecurityMode
    );
  }

  hide(suppressAutoLockNotice = false) {
    if (!this.root) return;
    this.unsubscribeUnlockEvents(); // E2：先摘订阅再走安全模式自锁，避免自己锁自己再触发一轮重绘
    this.closeAllDialogs(); // 收场（N9 对齐）：面板内弹窗 + body 流程框随面板关闭收起
    this.closeMobPage(); // N14：移动详情页不跨 hide/show 残留旧明文
    this.clearIdleLock(); // 关面板即撤 idle 布防
    // 动效层：同步收 display 前让 body 替身覆层演「金印卡沉入暗场」（同步语义不变）
    if (this.root.style.display === 'flex') motionPanelCollapse(this.root);
    this.root.style.display = 'none';
    if (this.isSecurityModeLive()) {
      // T12：统计落盘收敛到消费点——写最近一次解锁期内存快照（渲染期已备好，不依赖此刻 pwData）
      this.flushLockStats();
      this.dataManager.lock();
      this.shownIds = {}; // N14：明文开关随上锁清空
      this.resetSearchFilter();
      // E15：toast 挂在已隐藏面板内部永远看不见，改走全局通知；E11：一次上锁只发一条
      if (!suppressAutoLockNotice) notice('安全模式：已自动上锁');
    }
  }

  /**
   * 共锁感知（E2）：保险库与密码本同一把主密码，别域上锁/解锁后面板必须实时跟随——
   * - 上锁：清数据 + 锁屏接管（此前明文照常可看可复制、写操作静默无效）；
   * - 解锁：重载数据并重绘（锁后同会话再解锁的路径）。
   * 事件到达时 SafeManager 已翻转解锁态，本域仅对「订阅期间见过解锁」的首次 false
   * 补一次 lock()（清密码本明文缓存）；lock() 内部的重复广播由此旗标自然收敛。
   */
  private lastUnlockSeen = false;

  private subscribeUnlockEvents(): void {
    if (this.unlockOff) return;
    this.lastUnlockSeen = this.dataManager.unlocked;
    this.unlockOff = onDomainEvent<{ unlocked: boolean }>(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
      void this.onSharedLockChanged(!!evt?.unlocked);
    });
  }

  private unsubscribeUnlockEvents(): void {
    if (this.unlockOff) {
      this.unlockOff();
      this.unlockOff = null;
    }
  }

  private async onSharedLockChanged(unlocked: boolean): Promise<void> {
    if (unlocked) {
      this.lastUnlockSeen = true;
      await this.loadAndRender();
      return;
    }
    // 上锁收场（N9 对齐）：面板内弹窗 + body 流程框先收，明文不再浮在锁屏上方
    this.closeAllDialogs();
    this.closeMobPage(); // N14：移动详情页随上锁收起
    if (this.lastUnlockSeen) {
      this.lastUnlockSeen = false; // 先落旗标再 lock：lock() 的重复广播由此短路
      // T12：外部上锁也落盘统计——数据层订阅（批 A）在同一广播上先清 pwData，此处只落内存快照
      this.flushLockStats();
      this.dataManager.lock(); // 清本域明文缓存（pwData/loadCache）
      this.shownIds = {}; // N14：明文开关随上锁清空，重解锁不得直出
      this.resetSearchFilter(); // kw 残留会炸断未解锁渲染链（func 新-1 症状 B），随上锁一并清
    }
    this.renderAll();
    void this.showLock(); // N16/新-2：幂等重入——空锁屏容器建内容（修复空白锁屏卡死）、旧锁屏刷 title/stats/清输入
  }

  private async loadAndRender() {
    // 未解锁：静默（锁屏本身就是等待输入主密码，不弹「未解锁」错误通知）
    if (!this.dataManager.unlocked) {
      try {
        this.renderAll();
      } finally {
        this.showLock(); // 锁屏装配必达（func 新-1：renderAll 中途异常不得跳过 showLock 致空锁屏）
      }
      return;
    }
    try {
      await this.dataManager.load();
    } catch (e: any) {
      // 深审口径批：手拼错误串收编 core notifyActionError（人话错误 + 重试出口）
      notifyActionError(e, '加载数据', { onRetry: () => void this.loadAndRender() });
    }
    this.renderAll();
  }

  /** 锁屏句柄（desk/mob 双实例各一份；结构由 core/ui/lock-screen 提供，三域同源） */
  private lockHandles = new WeakMap<HTMLElement, LockScreenHandle>();
  /** 统计快照：清单是密文，锁定态读不到 —— 用解锁期间的快照，冷启动回落 lock-stats.json 上次快照 */
  private pwLockStatsCache: LockScreenStat[] = [
    { num: '—', label: '平台' },
    { num: '—', label: '口令条目' },
    { num: '—', label: '收藏' },
  ];
  /** 冷启动已从 lock-stats.json 回落过（仅首显 hydrate 一次，此后由 refreshLockStatsCache 维护） */
  private pwLockStatsHydrated = false;
  /** 解锁期间刷新过真值快照（flush 前置条件：占位「—」/锁定态不落盘，防垃圾覆写） */
  private pwLockStatsFresh = false;

  /** 解锁态刷新内存统计快照（渲染期只备值不落盘——本域最高频入口，写盘收敛到上锁消费点） */
  private refreshLockStatsCache(): void {
    if (!this.dataManager.unlocked) return;
    try {
      const plats = this.dataManager.platforms();
      this.pwLockStatsCache = [
        { num: String(plats.length), label: '平台' },
        { num: String(this.dataManager.pwData.length), label: '口令条目' },
        { num: String(plats.filter((x) => this.dataManager.hasFav(x.platform)).length), label: '收藏' },
      ];
      this.pwLockStatsFresh = true;
    } catch {
      /* 保持上一次快照 */
    }
  }

  /** 上锁消费点落盘（hide 安全模式分支 / 外部上锁事件侧 / lockNow）：写最近一次解锁期快照。
   *  不读 pwData——批 A 起数据层订阅在同一广播上先于 UI 自清明文，事件时刻 pwData 已空 */
  private flushLockStats(): void {
    if (!this.pwLockStatsFresh) return;
    void writeLockStats('password-vault', this.pwLockStatsCache).catch(() => {});
  }

  /** 冷启动从 lock-stats.json 回落上次快照（ADR-0124 决策 4 修订；读到才覆盖「—」初值） */
  private async hydrateLockStats(): Promise<void> {
    if (this.pwLockStatsHydrated) return;
    this.pwLockStatsHydrated = true;
    const hit = await readLockStats('password-vault');
    // 解锁渲染已刷出真值快照时不用文件旧值回写（晚到的 hydrate 不得倒灌）
    if (hit && !this.pwLockStatsFresh) this.pwLockStatsCache = hit;
  }

  // ---------- 安全模式 idle 自动上锁（cons 新-3，对齐 encrypt 形制） ----------

  /** 无交互自动上锁阈值（15 分钟，与 encrypt 同滩） */
  static readonly IDLE_LOCK_MS = 15 * 60 * 1000;

  private rootVisible(): boolean {
    return !!this.root && this.root.style.display === 'flex';
  }

  /** 空闲计时 bump（document 捕获阶段，见 ensureElements 尾部；交互即重置倒计时） */
  private bumpIdleLock(): void {
    this.clearIdleLock();
    if (!this.isSecurityModeLive() || !this.dataManager.unlocked) return;
    if (!this.rootVisible()) return;
    this.idleLockTimer = setTimeout(() => {
      this.idleLockTimer = null;
      if (!this.isSecurityModeLive() || !this.dataManager.unlocked || !this.rootVisible()) return;
      notice('安全模式：15 分钟无操作，已自动上锁');
      this.lockNow(true); // 单通知口径：安静上锁，通知由本处发一次
    }, PasswordVaultUIManager.IDLE_LOCK_MS);
  }

  private clearIdleLock(): void {
    if (this.idleLockTimer !== null) {
      clearTimeout(this.idleLockTimer);
      this.idleLockTimer = null;
    }
  }

  /** 立即上锁（idle 自动上锁入口；对齐 encrypt lockNow 形制）：
   *  快照统计 → 收场弹层 → 清明文缓存/明文开关/搜索态 → 单通知 → 安全模式随锁收面板 */
  lockNow(silent = false): void {
    if (!this.root) return;
    // T12：lock() 会清空清单，锁前落盘最近一次解锁期统计快照
    this.flushLockStats();
    this.closeAllDialogs();
    this.closeMobPage();
    this.dataManager.lock(); // 广播触发事件侧 onSharedLockChanged(false) 收场（重挂锁屏等）
    this.shownIds = {};
    this.resetSearchFilter();
    if (!silent) notice('安全模式：已自动上锁');
    if (this.isSecurityModeLive()) this.hide(true); // E11：安静收面板，不补发第二条通知
  }

  /** 显示锁屏（未解锁态）：core 共享骨架 + 本域口径（平台/口令条目/收藏）与金色风格；
   *  幂等可重入——已建 handle 只刷 title/message/action/stats 并清空输入（N16/新-2） */
  private showLock() {
    void this.hydrateLockStats().then(() => this.isFirstTime()).then((firstTime) => {
      if (!this.root) return; // arch 新-2：卸载竞态守卫（cleanup 置空 root 后异步链不得解引用）
      this.root.querySelectorAll<HTMLElement>('.bz-password-vault-lock').forEach((lockEl) => {
        lockEl.classList.add('open');
        let ls = this.lockHandles.get(lockEl);
        const fresh = !ls;
        if (!ls) {
          ls = uiLockScreen({
            kind: 'password-vault',
            icon: 'key',
            title: '',
            sub: '',
            stats: this.pwLockStatsCache,
            action: '',
            inline: true,
          });
          lockEl.appendChild(ls.el);
          this.lockHandles.set(lockEl, ls);
          this.bindLock(ls);
        }
        ls.setTitle(firstTime ? '设置主密码' : '密码本已上锁');
        ls.setMessage(firstTime ? '请设置一个主密码（用于加密密码本数据）' : '解锁后可查看平台与口令');
        ls.actionBtn.textContent = firstTime ? '设置并解锁' : '解锁';
        ls.showSecondInput(firstTime);
        ls.setError('');
        ls.input.value = '';
        ls.input2.value = '';
        ls.setStats(this.pwLockStatsCache);
        motionLockIn(lockEl, fresh); // 动效层：金印压落（首装）或正冠（重入）+ 候场辉光
        requestAnimationFrame(() => ls.focus());
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

  /** 锁屏交互（首设双输入 + 冷却节流；语义留本域，结构走 core 共享组件） */
  private bindLock(ls: LockScreenHandle) {
    const safe = this.dataManager.safeManager;
    let busy = false;
    // 错误行/冷却计时器（T8/N15 + ui 新-7）：错误行同一时刻只归一个来源；
    // 收场句柄登记到 lockTimerDisposers，cleanup 统一清（防卸载后计时器孤悬）
    let errTimer: ReturnType<typeof setTimeout> | null = null;
    let cooldownTimer: ReturnType<typeof setInterval> | null = null;
    let btnHeldByCooldown = false;
    const clearErrTimer = () => {
      if (errTimer !== null) {
        clearTimeout(errTimer);
        errTimer = null;
      }
    };
    const clearCooldownTimer = () => {
      if (cooldownTimer !== null) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    };
    const cancelLockTimers = () => {
      clearErrTimer();
      clearCooldownTimer();
      btnHeldByCooldown = false;
    };
    this.lockTimerDisposers.push(cancelLockTimers);
    const showErr = (m: string) => {
      clearCooldownTimer(); // 与冷却倒计时互斥
      clearErrTimer();
      ls.setError(m);
      errTimer = setTimeout(() => {
        errTimer = null;
        // 条件反转（ui 新-7）：空输入错误（请输入主密码）自动消失不永驻；
        // 输入中的错误（两次不一致等）保留待用户改完再试
        if (!ls.input.value) ls.setError('');
      }, 2600);
    };
    /** 冷却倒计时（N15 + ui 新-7）：单条「密码错误，N 秒后可重试」按秒刷新，归零清错误并复位按钮 */
    const startCooldownCountdown = (totalSec: number) => {
      clearErrTimer();
      clearCooldownTimer();
      btnHeldByCooldown = true;
      ls.actionBtn.disabled = true;
      let remain = totalSec;
      const tick = () => {
        if (remain <= 0) {
          clearCooldownTimer();
          btnHeldByCooldown = false;
          ls.setError('');
          ls.actionBtn.disabled = false;
          return;
        }
        ls.setError(`密码错误，${remain} 秒后可重试`);
        remain -= 1;
      };
      tick();
      cooldownTimer = setInterval(tick, 1000);
    };
    const resetBtn = () => {
      void this.isFirstTime().then((f) => {
        ls.actionBtn.textContent = f ? '设置并解锁' : '解锁';
      });
    };
    ls.actionBtn.addEventListener('click', async () => {
      if (busy) return;
      const first = await this.isFirstTime();
      const pw = ls.input.value;
      if (!pw) {
        showErr('请输入主密码');
        return;
      }
      if (first) {
        if (ls.input2.style.display === 'none') {
          ls.showSecondInput(true);
          ls.input2.value = '';
          ls.setMessage('请再次输入主密码确认');
          ls.focus();
          return;
        }
        if (pw !== ls.input2.value) {
          showErr('两次密码不一致');
          return;
        }
        if (pw.length < 4) {
          showErr('主密码至少 4 位');
          return;
        }
        // 首设风险确认（Q13 保留）：勾选流程确认后才能继续
        // func 新-4 防重入：确认框打开期间动作钮置 busy——流程框可被反复点开叠加，
        // 逐个确认后连环 unlock/reload、通知翻倍
        ls.setBusy(true);
        void openFlowDialog({
          title: '设置主密码',
          message:
            '主密码不会存储，也无法找回。若遗忘密码，保险库及加密数据将永久丢失。确定继续吗？',
          // issue 291：流程框挂 document.body，脱离 .bz-password-vault 根后 --pwv-* token
          // 全部失效（金色主钮会掉回 core 默认品牌色）。本类既在域 CSS 里复制一份 token，
          // 又供 id 选择器把共享壳映射成本域材质 —— 缺它确认框与面板不同皮（同 issue 257 事故）。
          className: 'bz-pwv-flow-dialog',
          actions: [
            { label: '取消', value: 'cancel' },
            // 刻意不标 danger（issue 291 评审）：本框是「风险告知门」，主动作是把主密码设下去
            // 的正向路径，动作本身不破坏任何数据（与下方「仍要重设」的破坏性重设不同），
            // 故保留金色主钮——域 CSS 的 :not(.bz-flow-dialog--danger) 就是为它保留的通路。
            { label: '我已了解并继续', value: 'ok', cta: true },
          ],
        }).then(async (v) => {
          if (v !== 'ok') {
            ls.input.value = '';
            ls.input2.value = '';
            ls.setBusy(false);
            showErr('已取消设置');
            return;
          }
          busy = true;
          try {
            const ok = await safe.unlock(pw);
            if (ok) {
              cancelLockTimers();
              ls.input.value = '';
              ls.input2.value = ''; // arch 新-1 纵深防御：口令不残留在已关闭的锁屏 DOM 里
              motionUnlockBurst(ls.el.querySelector<HTMLElement>('[data-ls="seal"]')); // 动效层：金印拧开余韵
              motionArmBoot(); // 动效层：开锁后的首渲染播 boot 全编排
              this.closeLock();
              notice('密码本已解锁', 'success'); // 深审口径批：自称「密码本」；大节点走 success 档
              await this.reloadAfterUnlock();
              this.renderAll();
            } else {
              showErr('设置失败：无法写入清单，请检查磁盘空间后重试');
            }
          } catch (e: any) {
            showErr('设置失败：' + (e?.message || ''));
          } finally {
            busy = false;
            ls.setBusy(false);
            if (btnHeldByCooldown) ls.actionBtn.disabled = true; // setBusy(false) 会重开按钮，冷却期按住
            resetBtn();
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
      ls.setBusy(true);
      try {
        const ok = await safe.unlock(pw);
        if (ok) {
          this.security.unlockFailStreak = 0;
          this.security.unlockCooldownUntil = 0;
          cancelLockTimers();
          ls.input.value = '';
          ls.input2.value = ''; // arch 新-1 纵深防御：口令不残留在已关闭的锁屏 DOM 里
          motionUnlockBurst(ls.el.querySelector<HTMLElement>('[data-ls="seal"]')); // 动效层：金印拧开余韵
          motionArmBoot(); // 动效层：开锁后的首渲染播 boot 全编排
          this.closeLock();
          notice('密码本已解锁', 'success'); // 深审口径批：自称「密码本」；大节点走 success 档
          await this.reloadAfterUnlock();
          this.renderAll();
        } else {
          // 清单损坏（empty/corrupt）→ 重设确认
          const issue = safe.manifestIssue;
          if (issue === 'empty' || issue === 'corrupt') {
            void openFlowDialog({
              title: '清单疑似损坏',
              message:
                '密码本清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。' +
                '重设主密码将生成全新空清单，旧加密数据将永久无法恢复。确定重设吗？',
              // issue 291：同上——挂 body 的流程框须显式带域类才拿到 --pwv-* 与域材质
              className: 'bz-pwv-flow-dialog',
              actions: [
                { label: '暂不重设', value: 'cancel' },
                // danger（issue 291 评审补）：重设会生成全新空清单、旧加密数据永久无法恢复 ——
                // 破坏性主动作，主按钮降中性底 + 红字（手册 §9/§10）。
                // 对照上方「设置主密码」：那句是风险告知门、动作本身是首设正向路径，
                // 故刻意不标 danger，域 CSS 的 :not(.bz-flow-dialog--danger) 金色主钮正是给它用。
                { label: '仍要重设', value: 'ok', cta: true, danger: true },
              ],
            }).then((v) => {
              if (v === 'ok') {
                void safe.unlock(pw, true).then(async (ok2) => {
                  if (ok2) {
                    this.security.unlockFailStreak = 0;
                    this.security.unlockCooldownUntil = 0;
                    cancelLockTimers();
                    ls.input.value = '';
                    ls.input2.value = '';
                    motionUnlockBurst(ls.el.querySelector<HTMLElement>('[data-ls="seal"]')); // 动效层：金印拧开余韵
                    motionArmBoot(); // 动效层：重设后的首渲染播 boot 全编排
                    this.closeLock();
                    // 对齐 encrypt 域同款 warning 档（重设属警示性结果，非纯失败）
                    notice('已重设主密码（旧数据不可恢复）', 'warning');
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
          // N15/ui 新-7：合并单条通知——「密码错误，请重试」原被冷却提示覆盖成两连发互顶，
          // 现由倒计时统一刷新「密码错误，N 秒后可重试」，归零清错误并复位按钮
          this.security.unlockFailStreak += 1;
          const delaySec = Math.min(2 ** (this.security.unlockFailStreak - 1), 8); // 1/2/4/8s 封顶
          this.security.unlockCooldownUntil = Date.now() + delaySec * 1000;
          startCooldownCountdown(delaySec);
          ls.input.value = '';
          ls.focus();
        }
      } finally {
        busy = false;
        ls.setBusy(false);
        if (btnHeldByCooldown) ls.actionBtn.disabled = true; // setBusy(false) 会重开按钮，冷却期按住（归零由倒计时复位）
        resetBtn();
      }
    });
    // （输入框回车提交已由 uiLockScreen 内置：Enter → 主按钮，效率整改 13；
    //   首设双输入态回车同样走主按钮的「请再次输入」分支，与原 focus input2 收敛为同一步）
  }
  private closeLock() {
    this.root!.querySelectorAll<HTMLElement>('.bz-password-vault-lock').forEach((l) => {
      motionLockIdle(l, false); // 动效层：候场辉光必收（长驻循环句柄池摘除）
      l.classList.remove('open');
    });
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
        // 平台编辑弹窗（原 pop2 确认框分支随收编 core 流程框消失：确认框的 ESC
        // 由 openFlowDialog 自带的 'q3-confirm' 层处理，且层级更新、天然优先本面板）
        const openPlatEdit = this.root!.querySelector('.bz-password-vault-platedit.open');
        if (openPlatEdit) {
          openPlatEdit.classList.remove('open');
          return;
        }
        this.hide();
      },
    });
  }

  // ---------- 卸载 ----------
  cleanup() {
    cancelClipboardClear();
    this.unsubscribeUnlockEvents(); // E2：退订共锁事件
    this.applySearch.cancel(); // 防抖收口（core debounce 自带 cancel，语义同原 clearTimeout）
    this.clearIdleLock(); // idle 自动上锁计时器
    if (this.idleBump) {
      // document 捕获监听不随 DOM 摘除回收，卸载时显式摘除（对齐 encrypt detachGlobalListeners）
      document.removeEventListener('pointerdown', this.idleBump, true);
      document.removeEventListener('keydown', this.idleBump, true);
      this.idleBump = null;
    }
    this.lockTimerDisposers.splice(0).forEach((dispose) => dispose()); // 锁屏错误/冷却计时器
    motionTeardown(); // 动效层清场：延时编排 + 长驻循环（金印候场辉光）一并无孤儿
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
    this.dataManager = new PasswordVaultDataManager(getSafeManager());
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
