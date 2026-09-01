/**
 * 回忆墙（diary-wall）UI —— 原型 v5「章节固定 + 滚动高亮 + 性能优化」一比一移植
 *
 * 布局（照搬原型）：
 * - 全屏/居中卡弹窗：桌面 = 980px 宽 82vh 居中卡（根容器遮罩 flex 居中）；
 *   移动端 = 真全屏（≤768px，根容器自带全屏 + 安全区避让；另支持 config.mobileDefaultFullscreen
 *   挂 .bz-win-mfs 统一真全屏类——设置键 diaryWallMobileDefaultFullscreen 由设置代理处理）。
 * - 头部行：品牌「日记本」+ 范围/计数 + 按钮组（🔍搜索、✏️写日记、⚙️设置、✕关闭）。
 * - 类型 chips 行：主标签胶囊（日记📖/摄影📸/骑行🚴/猫🐱…），可点选筛选，带计数；「加密」锁定态（🔒虚线）。
 * - 主体两栏：左 = 固定章节栏（月份列表，每项带缩略图胶卷小图，滚动自动高亮当前月份，点击平滑滚动定位）；
 *   右 = 瀑布流（masonry：图片/视频/音频块 + 纯文字窄条，按日期分节，节头 sticky 显示日期+周几+统计）。
 * - 媒体块：真实 <img>（object-fit:cover 按比例）、<video preload=none> 渐变海报+▶角标（点击开灯箱真播）、
 *   音频块 🎵（点击开灯箱内联播放）；渲染失败（mediaSrc 返回空）显示渐变占位（原型 .ph 逻辑）。
 * - 灯箱：全屏黑底，图片/视频/音频 controls 播放，Esc/点背景关闭。
 * - 空态：图标 + 一句话 + 动作按钮。
 * - 性能：媒体视口懒加载（IntersectionObserver，进视口才挂 src）、content-visibility:auto、
 *   滚动高亮用 rAF 节流。
 *
 * 数据层对接（src/diary-wall/data.ts，另一代理编写）：
 * - openManager() 时 loadWallEntries(app, DIARY_DIRECTORY)；
 * - 章节栏月份 = groupByMonth(entries) 的 key，倒序；
 * - 媒体块 src = mediaSrc(app, media.name)；mediaSrc 返回空 → 渐变占位（原型 .ph）。
 * 本文件只 import ./data，不自行读取数据。
 *
 * 未接线 TODO（后续由主实现统一接）：
 * - ✏️写日记：原型 openAdd 弹「写一页」；生产由主实现接 diary 既有 openAddDialog，此处暂 alert 占位。
 * - ⚙️设置：原型 alert 占位；生产接 settings 弹窗。
 * - 🔍搜索：原型 alert 占位。
 * - 底部抽屉动作（打开/复制双链/复制正文/改标签/加密/删除）：原型 alert 占位，后续接 bz 统一右键/长按抽屉。
 */
import { escManager } from '../core/esc-manager';
import { topifyZ } from '../core/dom';
import { notice } from '../core/notice';
import { applyMobileWindowFullscreen } from '../core/mobile';
import { getApp } from '../core/app';
import { DIARY_DIRECTORY, getSubTagsOfPrimary, getPrimaryTagsInDisplayOrder, getTagEmoji } from './config';
import { loadWallEntries, mediaSrc, groupByMonth, type WallEntry, type WallMedia } from './data';
// TODO(自包含)：以下 diary 域入口在「删除日记本域」时改为回忆墙自己的实现
import { openAddDialog } from '../diary/ui/dialogs';

/** UI 配置（设置代理传入） */
export interface DiaryWallUIConfig {
  /** 移动端默认真全屏（对应设置键 diaryWallMobileDefaultFullscreen；openManager 时决定挂不挂 .bz-win-mfs） */
  mobileDefaultFullscreen: boolean;
}

/** 媒体类型 → 图标/角标 */
const KIND_ICON: Record<WallMedia['kind'], string> = {
  img: '🖼',
  video: '🎬',
  audio: '🎵',
};

/** 周几中文 */
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 回忆墙 AppController（照搬 password-vault AppController 模式）：
 * 单例 getInstance(config) / init() / openManager() / cleanup()。
 * 根容器 position:fixed;inset:0;z-index:var(--bz-z-overlay,1000);display:none; 挂 body。
 * 桌面实例 + 移动实例双 DOM，CSS 断点 @media (max-width: 768px) 切真全屏；
 * ensureElements() 幂等创建；ESC 注册用 escManager；z-index 用 topifyZ。
 */
export class DiaryWallAppController {
  static instance: DiaryWallAppController | null = null;

  static getInstance(config: DiaryWallUIConfig): DiaryWallAppController {
    if (!DiaryWallAppController.instance) {
      DiaryWallAppController.instance = new DiaryWallAppController(config);
    }
    return DiaryWallAppController.instance;
  }

  /** 桌面实例 DOM */
  private desk!: {
    head: HTMLElement;
    range: HTMLElement;
    chipRow: HTMLElement;
    subRow: HTMLElement;
    searchRow: HTMLElement;
    searchBox: HTMLInputElement;
    body: HTMLElement;
    wall: HTMLElement;
    rail: HTMLElement;
    lb: HTMLElement;
    lbMedia: HTMLElement;
    lbCap: HTMLElement;
    lbSub: HTMLElement;
    sheet: HTMLElement;
    sheetEmoji: HTMLElement;
    sheetTime: HTMLElement;
    sheetContent: HTMLElement;
    sheetMedia: HTMLElement;
    sheetActions: HTMLElement;
  };
  /** 移动实例 DOM */
  private mob!: {
    head: HTMLElement;
    range: HTMLElement;
    chipRow: HTMLElement;
    subRow: HTMLElement;
    searchRow: HTMLElement;
    searchBox: HTMLInputElement;
    body: HTMLElement;
    wall: HTMLElement;
    rail: HTMLElement;
    lb: HTMLElement;
    lbMedia: HTMLElement;
    lbCap: HTMLElement;
    lbSub: HTMLElement;
    sheet: HTMLElement;
    sheetEmoji: HTMLElement;
    sheetTime: HTMLElement;
    sheetContent: HTMLElement;
    sheetMedia: HTMLElement;
    sheetActions: HTMLElement;
  };
  /** 根容器（固定全屏遮罩层） */
  root: HTMLDivElement | null = null;
  /** 数据 */
  entries: WallEntry[] = [];
  /** 当前筛选标签（null = 全部） */
  selTag: string | null = null;
  /** 搜索关键词（空 = 全部） */
  searchKeyword = '';
  /** 日期筛选（null = 全部；{ year } = 年份；{ year, month } = 某月）——回忆墙自包含，不再依赖 diary 面板 filter */
  selDateFilter: { year: string; month?: string } | null = null;
  /** 二级标签筛选（选中主标签后其子标签） */
  selSubTag: string | null = null;
  /** 加密条目是否可见（原型 S.locked：默认锁定隐藏） */
  lockedVisible = false;
  /** 移动端媒体 seed（原型 mediaSeed：比例轮换用） */
  private mediaSeed = 0;
  private escUnregister: { unregister: () => void } | null = null;
  private _initialized = false;
  /** 媒体懒加载 observer + 章节滚动高亮 cleanup：按 desk/mob 实例分存（双实例各自独立，互不覆盖） */
  private observers: Record<'desk' | 'mob', IntersectionObserver | null> = { desk: null, mob: null };
  private rafCleanups: Record<'desk' | 'mob', (() => void) | null> = { desk: null, mob: null };
  private sheetEntry: WallEntry | null = null;
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;
  private _contextMenu: HTMLElement | null = null;
  /** 日期筛选弹窗元素（null = 未打开） */
  private _dateFilterEl: HTMLElement | null = null;

  constructor(private config: DiaryWallUIConfig) {}

  // ---------- 创建 DOM（桌面 + 移动双实例，幂等） ----------
  ensureElements() {
    if (this._initialized) return;
    this._initialized = true;
    // 根容器：固定全屏遮罩层（Obsidian 弹窗层之上）
    this.root = document.createElement('div');
    this.root.className = 'bz-diary-wall';
    this.root.style.cssText = 'position:fixed;inset:0;z-index:var(--bz-z-overlay,1000);display:none;';
    document.body.appendChild(this.root);

    // 桌面实例（面板卡，无关闭按钮——靠 mask + ESC）
    const desk = document.createElement('div');
    desk.className = 'bz-diary-wall-desk';
    desk.innerHTML = this.deskHTML();
    this.root.appendChild(desk);
    this.desk = this.bindRefs(desk);
    // 移动实例（真全屏）
    const mob = document.createElement('div');
    mob.className = 'bz-diary-wall-mob';
    mob.innerHTML = this.mobHTML();
    this.root.appendChild(mob);
    this.mob = this.bindRefs(mob);

    this.bindPanel(this.desk, false);
    this.bindPanel(this.mob, true);
    this.bindLightbox();
    this.bindSheet();
    this.registerEscape();
  }

  /** 从实例 HTML 收集 DOM 引用 */
  private bindRefs(scope: HTMLElement) {
    const q = <T extends HTMLElement = HTMLElement>(sel: string) => scope.querySelector<T>(sel)!;
    return {
      head: q('.bz-diary-wall-head'),
      range: q('.bz-diary-wall-range'),
      chipRow: q('.bz-diary-wall-chiprow'),
      subRow: q('.bz-diary-wall-subrow'),
      searchRow: q('.bz-diary-wall-searchrow'),
      searchBox: q<HTMLInputElement>('.bz-diary-wall-searchbox'),
      body: q('.bz-diary-wall-body'),
      wall: q('.bz-diary-wall-wall'),
      rail: q('.bz-diary-wall-rail'),
      lb: q('.bz-diary-wall-lb'),
      lbMedia: q('.bz-diary-wall-lbmedia'),
      lbCap: q('.bz-diary-wall-lbcap'),
      lbSub: q('.bz-diary-wall-lbsub'),
      sheet: q('.bz-diary-wall-sheet'),
      sheetEmoji: q('.bz-diary-wall-sheet-emoji'),
      sheetTime: q('.bz-diary-wall-sheet-time'),
      sheetContent: q('.bz-diary-wall-sheet-content'),
      sheetMedia: q('.bz-diary-wall-sheet-media'),
      sheetActions: q('.bz-diary-wall-sheet-actions'),
    };
  }

  private deskHTML(): string {
    return `
      <div class="bz-diary-wall-head bz-win-head">
        <div class="bz-diary-wall-brand" data-act="date-picker" title="按日期筛选">
          <span class="bz-diary-wall-bookname">日记本</span>
          <span class="bz-diary-wall-range"></span>
        </div>
        <div class="bz-diary-wall-btns">
          <button class="bz-diary-wall-icon-btn" data-act="add" title="写日记">✏️</button>
          <button class="bz-diary-wall-icon-btn" data-act="search" title="搜索">🔍</button>
          <button class="bz-diary-wall-icon-btn bz-diary-wall-close bz-win-close" data-act="close" title="关闭">✕</button>
        </div>
      </div>
      <div class="bz-diary-wall-chiprow"></div>
      <div class="bz-diary-wall-subrow" style="display:none"></div>
      <div class="bz-diary-wall-searchrow" style="display:none">
        <input class="bz-diary-wall-searchbox" type="text" placeholder="搜索日记（正文、类型、时间）…" />
      </div>
      <div class="bz-diary-wall-body">
        <div class="bz-diary-wall-rail"></div>
        <div class="bz-diary-wall-wall"></div>
      </div>
      <div class="bz-diary-wall-lb">
        <button class="bz-diary-wall-lbclose" data-act="lb-close">✕</button>
        <div class="bz-diary-wall-lbmedia"></div>
        <div class="bz-diary-wall-lbcap"></div>
        <div class="bz-diary-wall-lbsub"></div>
      </div>
      <div class="bz-diary-wall-sheet">
        <div class="bz-diary-wall-sheet-grip"></div>
        <div class="bz-diary-wall-sheet-head">
          <span class="bz-diary-wall-sheet-emoji"></span>
          <div class="bz-diary-wall-sheet-info">
            <div class="bz-diary-wall-sheet-time"></div>
            <div class="bz-diary-wall-sheet-content"></div>
            <div class="bz-diary-wall-sheet-media"></div>
          </div>
        </div>
        <div class="bz-diary-wall-sheet-actions"></div>
      </div>
    `;
  }

  private mobHTML(): string {
    // 移动端与桌面共用面板骨架（真全屏由 CSS ≤768px 控制；头部带显式关闭按钮）
    return `
      <div class="bz-diary-wall-head bz-win-head">
        <div class="bz-diary-wall-brand" data-act="date-picker" title="按日期筛选">
          <span class="bz-diary-wall-bookname">日记本</span>
          <span class="bz-diary-wall-range"></span>
        </div>
        <div class="bz-diary-wall-btns">
          <button class="bz-diary-wall-icon-btn" data-act="add" title="写日记">✏️</button>
          <button class="bz-diary-wall-icon-btn" data-act="search" title="搜索">🔍</button>
          <button class="bz-diary-wall-icon-btn bz-diary-wall-close bz-win-close" data-act="close" title="关闭">✕</button>
        </div>
      </div>
      <div class="bz-diary-wall-chiprow"></div>
      <div class="bz-diary-wall-subrow" style="display:none"></div>
      <div class="bz-diary-wall-searchrow" style="display:none">
        <input class="bz-diary-wall-searchbox" type="text" placeholder="搜索日记（正文、类型、时间）…" />
      </div>
      <div class="bz-diary-wall-body">
        <div class="bz-diary-wall-rail"></div>
        <div class="bz-diary-wall-wall"></div>
      </div>
      <div class="bz-diary-wall-lb">
        <button class="bz-diary-wall-lbclose" data-act="lb-close">✕</button>
        <div class="bz-diary-wall-lbmedia"></div>
        <div class="bz-diary-wall-lbcap"></div>
        <div class="bz-diary-wall-lbsub"></div>
      </div>
      <div class="bz-diary-wall-sheet">
        <div class="bz-diary-wall-sheet-grip"></div>
        <div class="bz-diary-wall-sheet-head">
          <span class="bz-diary-wall-sheet-emoji"></span>
          <div class="bz-diary-wall-sheet-info">
            <div class="bz-diary-wall-sheet-time"></div>
            <div class="bz-diary-wall-sheet-content"></div>
            <div class="bz-diary-wall-sheet-media"></div>
          </div>
        </div>
        <div class="bz-diary-wall-sheet-actions"></div>
      </div>
    `;
  }

  // ---------- 交互绑定 ----------
  private bindPanel(ui: typeof this.desk, mobile: boolean) {
    // 关闭
    ui.head.querySelector('[data-act="close"]')?.addEventListener('click', () => this.hide());
    // 标题（品牌）点击 → 打开日期选择器（diary 既有，展示全部年份/月份筛选）
    ui.head.querySelector('[data-act="date-picker"]')?.addEventListener('click', () => this.openDatePicker());
    // 写日记：接 diary 既有 openAddDialog（自包含前先复用 diary 域；自包含后改自己的实现）
    ui.head.querySelector('[data-act="add"]')?.addEventListener('click', () => this.openAddEntry());
    // 搜索：toggle 真搜索框
    ui.head.querySelector('[data-act="search"]')?.addEventListener('click', () => this.toggleSearch(ui));
    // 灯箱关闭按钮（双实例）
    ui.lb.querySelector('[data-act="lb-close"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeLightbox();
    });
    // 遮罩点击关闭（点击灯箱背景本身）
    ui.lb.addEventListener('click', (e) => {
      if (e.target === ui.lb) this.closeLightbox();
    });
    // 根遮罩点击关闭（点击面板外）
    this.root!.addEventListener('click', (e) => {
      if (e.target === this.root && this.root!.style.display === 'flex') this.hide();
    });
    // 章节栏（仅桌面有）事件委托：月份点击 → 平滑滚动定位
    ui.rail.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.bz-diary-wall-month');
      if (!item) return;
      this.scrollToMonth(item.dataset.month || '', ui.wall);
    });
    // 搜索输入：防抖过滤
    ui.searchBox.addEventListener('input', () => {
      if (this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this._searchTimer = null;
        this.searchKeyword = ui.searchBox.value;
        this.renderAll();
      }, 250);
    });
    // ESC 在搜索框内：只清空/失焦（不关面板）
    ui.searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        ui.searchBox.value = '';
        this.searchKeyword = '';
        this.renderAll();
        ui.searchBox.blur();
      }
    });
    void mobile;
  }

  /** 灯箱通用绑定（双实例各一份） */
  private bindLightbox() {
    [this.desk, this.mob].forEach((ui) => {
      // 点击背景关闭（lb-media 之外）
      ui.lb.addEventListener('click', (e) => {
        if (e.target === ui.lb) this.closeLightbox();
      });
    });
  }

  // ---------- 渲染 ----------
  /** 重新渲染（筛选变化 / 数据加载后） */
  renderAll() {
    if (!this.root) return;
    this.renderChips();
    this.renderWall(this.desk, false);
    this.renderWall(this.mob, true);
    const range = `${this.entries.length} 条`;
    this.desk.range.textContent = range;
    this.mob.range.textContent = range;
  }

  /** 过滤后的条目（加密条目默认隐藏，选中「加密」标签时显示；支持标签/二级标签/搜索/日期） */
  private filtered(): WallEntry[] {
    const kw = this.searchKeyword.trim().toLowerCase();
    const df = this.selDateFilter;
    return this.entries.filter((e) => {
      if (this.selTag === '加密') {
        if (!e.tags.includes('加密')) return false;
      } else {
        // 二级标签已选中：只按二级标签精确过滤（日记条目标的是子标签而非主标签，如「四川」而非「旅游」）
        if (this.selSubTag) {
          if (!e.tags.includes(this.selSubTag)) return false;
        } else {
          if (this.selTag && !e.tags.includes(this.selTag)) return false;
        }
        if (!this.lockedVisible && e.tags.includes('加密')) return false;
      }
      if (df) {
        if (df.month) {
          if (!e.date.startsWith(`${df.year}-${df.month}`)) return false;
        } else if (!e.date.startsWith(df.year)) {
          return false;
        }
      }
      if (kw) {
        const hit =
          (e.text || '').toLowerCase().includes(kw) ||
          e.tags.some((t) => t.toLowerCase().includes(kw)) ||
          e.time.toLowerCase().includes(kw) ||
          e.date.includes(kw);
        if (!hit) return false;
      }
      return true;
    });
  }

  /** 类型 chips 行（主标签胶囊 + 计数；「加密」锁定态 🔒 虚线）——标签表取自 config（含旅游/收藏等带二级标签的主标签），非硬编码 */
  private renderChips() {
    const countFor = (tag: string) => this.entries.filter((e) => e.tags.includes(tag)).length;
    // 全量主标签（展示顺序固定 + 「加密」垫底），emoji 走 config 映射（getTagEmoji 兜底 📖）
    const tagChips: [string, string][] = getPrimaryTagsInDisplayOrder().map((tag) => [tag, getTagEmoji(tag)]);
    [this.desk.chipRow, this.mob.chipRow].forEach((row) => {
      row.innerHTML = '';
      tagChips.forEach(([tag, emoji]) => {
        const locked = tag === '加密' && !this.lockedVisible;
        const b = document.createElement('button');
        b.className =
          'bz-diary-wall-chip' +
          (locked ? ' bz-diary-wall-chip--locked' : '') +
          (this.selTag === tag ? ' bz-diary-wall-chip--on' : '');
        b.dataset.tag = tag;
        // 「加密」锁定态显示 🔒（未解锁）；其余显示配置 emoji
        const icon = locked ? '🔒' : emoji;
        b.innerHTML = `${icon} ${tag} <span class="bz-diary-wall-chip-cnt">${countFor(tag)}</span>`;
        b.addEventListener('click', () => {
          if (tag === '加密') {
            // 点击锁定态「加密」→ 解锁并筛选加密条目（原型 S.locked 翻转）；再点取消
            if (locked) {
              this.lockedVisible = true;
              this.selTag = '加密';
            } else {
              this.selTag = this.selTag === '加密' ? null : '加密';
            }
          } else {
            // 切主标签：重置二级标签选中
            if (this.selTag !== tag) this.selSubTag = null;
            this.selTag = this.selTag === tag ? null : tag;
          }
          this.renderAll();
        });
        row.appendChild(b);
      });
      // 「加密」chip 常驻显示（不再因无加密条目而隐藏——用户需要入口测试加密流程；计数 0 照常显示）
    });
    this.renderSubRow(this.desk);
    this.renderSubRow(this.mob);
  }

  /** 二级标签行：选中的主标签有二级标签时显示（如 旅游 → 四川/大理） */
  private renderSubRow(ui: typeof this.desk) {
    const row = ui.subRow;
    if (!row) return;
    row.innerHTML = '';
    if (!this.selTag) {
      row.style.display = 'none';
      return;
    }
    const subs = getSubTagsOfPrimary(this.selTag);
    if (!subs || subs.length === 0) {
      row.style.display = 'none';
      return;
    }
    row.style.display = 'flex';
    subs.forEach((sub) => {
      const b = document.createElement('button');
      b.className =
        'bz-diary-wall-subchip' + (this.selSubTag === sub.tag ? ' bz-diary-wall-subchip--on' : '');
      b.dataset.tag = sub.tag;
      b.innerHTML = `${sub.emoji} ${sub.tag}`;
      b.addEventListener('click', () => {
        this.selSubTag = this.selSubTag === sub.tag ? null : sub.tag;
        this.renderAll();
      });
      row.appendChild(b);
    });
  }

  /** 渲染章节栏 + 瀑布（桌面/移动各一份） */
  private renderWall(ui: typeof this.desk, mobile: boolean) {
    this.teardownScrollers(mobile ? 'mob' : 'desk');
    ui.wall.innerHTML = '';
    ui.rail.innerHTML = '';
    ui.lbMedia.innerHTML = '';
    const list = this.filtered();
    if (!list.length) {
      ui.wall.appendChild(this.mkEmpty());
      return;
    }
    // 章节栏（仅桌面）
    if (!mobile) {
      const title = document.createElement('div');
      title.className = 'bz-diary-wall-rail-title';
      title.textContent = '章 节';
      ui.rail.appendChild(title);
      // 章节栏月份 = groupByMonth(list) 的 key，倒序（对齐数据层契约）
      const byMonth = groupByMonth(list);
      const months = [...byMonth.keys()].sort().reverse();
      months.forEach((mk) => {
        const it = document.createElement('div');
        it.className = 'bz-diary-wall-month';
        it.dataset.month = mk;
        const row = document.createElement('div');
        row.className = 'bz-diary-wall-month-row';
        const name = document.createElement('span');
        name.className = 'bz-diary-wall-month-name';
        name.textContent = `${Number(mk.slice(5))}月`;
        const cnt = document.createElement('span');
        cnt.className = 'bz-diary-wall-month-count';
        cnt.textContent = `${byMonth.get(mk)!.length} 条`;
        row.append(name, cnt);
        it.appendChild(row);
        // 胶卷缩略图条（前 6 条，各取首个媒体/emoji）
        const strip = document.createElement('div');
        strip.className = 'bz-diary-wall-month-strip';
        byMonth
          .get(mk)!
          .slice(0, 6)
          .forEach((e) => {
            const m = e.media[0];
            strip.appendChild(this.thumbEl(m, e));
          });
        it.appendChild(strip);
        it.addEventListener('click', () => this.scrollToMonth(mk, ui.wall));
        ui.rail.appendChild(it);
      });
    }
    // 瀑布：按日期分节
    let lastDate: string | null = null;
    list.forEach((e) => {
      if (e.date !== lastDate) {
        lastDate = e.date;
        const dayList = list.filter((x) => x.date === e.date);
        const head = document.createElement('div');
        head.className = 'bz-diary-wall-day-head';
        head.dataset.date = e.date;
        const date = document.createElement('span');
        date.className = 'bz-diary-wall-day-date';
        date.textContent = e.date;
        const week = document.createElement('span');
        week.className = 'bz-diary-wall-day-week';
        week.textContent = '周' + WEEK[new Date(e.date + 'T00:00:00').getDay()];
        const stat = document.createElement('span');
        stat.className = 'bz-diary-wall-day-stat';
        stat.innerHTML = this.statHtml(this.dayStats(dayList));
        head.append(date, week, stat);
        ui.wall.appendChild(head);
        // 稀疏铺满：当天条目极少时跨列占满横向空白（文字条跨列、媒体块不放大居中）
        const n = dayList.length;
        const sparseCls =
          n === 1 ? ' bz-diary-wall-masonry--sparse-1' : n === 2 ? ' bz-diary-wall-masonry--sparse-2' : '';
        const m = document.createElement('div');
        m.className = 'bz-diary-wall-masonry' + (mobile ? ' bz-diary-wall-masonry--mob' : '') + sparseCls;
        ui.wall.appendChild(m);
      }
      const hasMedia = e.media.length > 0;
      const container = ui.wall.lastChild as HTMLElement;
      if (hasMedia) {
        e.media.forEach((k) => {
          const item = document.createElement('div');
          item.className = 'bz-diary-wall-item bz-diary-wall-media-wrap';
          item.appendChild(this.mediaEl(k, e));
          if (e.text) {
            const tx = document.createElement('div');
            tx.className = 'bz-diary-wall-tx bz-diary-wall-md';
            void this.renderText(tx, e.text, e);
            item.appendChild(tx);
          }
          // 媒体块不挂 ⋯ 按钮（用户要求去掉右上角三点；动作入口 = 右键菜单 / 双击）
          this.bindItem(item, e, mobile);
          container.appendChild(item);
        });
      } else {
        const item = document.createElement('div');
        item.className = 'bz-diary-wall-item bz-diary-wall-text';
        const row = document.createElement('div');
        row.className = 'bz-diary-wall-text-row';
        const t = document.createElement('span');
        t.className = 'bz-diary-wall-text-t';
        t.textContent = e.time;
        const em = document.createElement('span');
        em.className = 'bz-diary-wall-text-em';
        em.textContent = e.emoji;
        row.append(t, em);
        const tx = document.createElement('div');
        tx.className = 'bz-diary-wall-text-tx bz-diary-wall-md';
        if (e.tags.includes('加密') && !this.lockedVisible) {
          tx.textContent = '（已加密）';
        } else {
          void this.renderText(tx, e.text, e);
        }
        item.append(row, tx);
        this.bindItem(item, e, mobile);
        container.appendChild(item);
      }
    });
    this.setupLazy(ui.wall, mobile ? 'mob' : 'desk');
    if (!mobile && ui.rail.children.length > 1) {
      this.setupRailHighlight(ui.wall, ui.rail, 'desk');
    }
  }

  /**
   * Markdown 渲染正文（支持 Obsidian 语法；sourcePath 用条目 filename 供链接解析）。
   * 竞态保护：渲染前检查 container 是否仍在文档中（renderWall 重渲染会清空旧 DOM，
   * 异步渲染结果不得写入已脱离文档的容器）；渲染完卸载 Component（防 Obsidian 泄漏）。
   */
  private async renderText(container: HTMLElement, md: string, e: WallEntry) {
    if (!md) {
      container.textContent = '';
      return;
    }
    container.textContent = ''; // 先纯文本兜底（防注入）
    try {
      const { Component, MarkdownRenderer } = await import('obsidian');
      const sourcePath = e.filename && e.filename.includes('/') ? e.filename : `${DIARY_DIRECTORY}/${e.date}.md`;
      const comp = new Component();
      await MarkdownRenderer.render(this.app(), md, container, sourcePath, comp);
      comp.unload();
      if (!container.isConnected) {
        // 渲染期间容器已被 renderWall 重建清空——结果丢弃（新 DOM 会重新渲染本条）
        return;
      }
    } catch (err) {
      if (container.isConnected) container.textContent = md; // 渲染失败回退纯文本
    }
  }

  /** 条目级交互：移动端单击 → 抽屉；双击 → 跳转原文；右键 → 跟手上下文菜单（桌面）；加密隐藏时不弹 */
  private bindItem(item: HTMLElement, e: WallEntry, mobile: boolean) {
    // 单击：仅移动端开抽屉（桌面端动作入口 = 右键菜单 / 双击跳转，避免误触底部抽屉）
    // 双击跳转（300ms 内两次点击）
    let lastClick = 0;
    item.addEventListener('click', (ev) => {
      if (e.tags.includes('加密') && !this.lockedVisible) return;
      const now = Date.now();
      if (now - lastClick < 300) {
        lastClick = 0;
        void this.jumpTo(e);
        return;
      }
      lastClick = now;
      if (mobile) this.openSheet(e);
    });
    // 桌面右键 → 跟手菜单（capture 捕获阶段拦截，防止 Obsidian 全局右键菜单抢先处理）
    item.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      if (e.tags.includes('加密') && !this.lockedVisible) return;
      this.openContextMenu(ev.clientX, ev.clientY, e);
    }, true);
  }

  /** 双击跳转原文（diary jumpToEntry；自包含后改自己的实现） */
  private async jumpTo(e: WallEntry) {
    try {
      // 书（book）：filename 是完整路径，直接打开文件（diary 不识别 book 条目）
      if (e.kind === 'book' && e.filename) {
        const file = this.app().vault.getAbstractFileByPath(e.filename);
        if (!file) {
          notice('找不到书文件', 'error');
          return;
        }
        await this.app().workspace.openLinkText(file.path, '', false, { active: true });
        this.hide();
        return;
      }
      const { jumpToEntry } = await import('../diary/ui/entries') as typeof import('../diary/ui/entries');
      const entry = this.toDiaryEntry(e);
      if (!entry) {
        notice('找不到原文', 'error');
        return;
      }
      await jumpToEntry(entry as any);
      this.hide(); // 跳转后关回忆墙（对齐 diary 面板行为）
    } catch (err) {
      notice('跳转失败', 'error');
    }
  }

  /** WallEntry → DiaryEntry（透传字段组装；id 可能为空，diary 侧按 filename/lineNumber 定位） */
  private toDiaryEntry(e: WallEntry): any {
    const kind = e.kind;
    if ((kind === 'diary' || !kind) && e.filename) {
      return { ...e, filename: e.filename };
    }
    return {
      date: e.date,
      time: e.time,
      timeValue: parseInt(e.time.replace(':', ''), 10) || 0,
      tags: e.tags,
      emoji: e.emoji,
      content: e.content,
      filename: e.filename || e.date,
      lineNumber: e.lineNumber || 0,
      id: e.id,
    };
  }

  /** 右键上下文菜单（自绘，跟手；动作与抽屉同源） */
  private openContextMenu(x: number, y: number, e: WallEntry) {
    this.closeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'bz-diary-wall-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    const mk = (icon: string, label: string, cls: string | null, fn: () => void) => {
      const b = document.createElement('button');
      b.className = 'bz-diary-wall-menu-item' + (cls ? ' ' + cls : '');
      b.innerHTML = `<span class="bz-diary-wall-menu-ic">${icon}</span>${label}`;
      b.addEventListener('click', () => {
        this.closeContextMenu();
        fn();
      });
      menu.appendChild(b);
    };
    mk('↗', '打开原文', null, () => void this.jumpTo(e));
    mk('⧉', '复制双链', null, () => this.copyLink(e));
    mk('▤', '复制正文', null, () => this.copyContent(e));
    if (!e.tags.includes('加密')) {
      mk('⌘', '改标签', null, () => this.editTags(e));
      mk('🔒', '加密', 'bz-diary-wall-menu-item--accent', () => void this.encryptEntryAction(e));
    } else {
      mk('🔓', '解密', 'bz-diary-wall-menu-item--accent', () => void this.decryptEntryAction(e));
    }
    mk('🗑', '删除', 'bz-diary-wall-menu-item--danger', () => void this.deleteEntryAction(e));
    document.body.appendChild(menu);
    this._contextMenu = menu;
    // 点击别处 / ESC 关闭
    setTimeout(() => {
      document.addEventListener('click', this._onMenuOutside, { once: true });
    }, 0);
  }

  private closeContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.remove();
      this._contextMenu = null;
    }
    document.removeEventListener('click', this._onMenuOutside);
  }

  private _onMenuOutside = () => this.closeContextMenu();

  /** 空态 */
  private mkEmpty(): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'bz-diary-wall-empty';
    const ic = document.createElement('div');
    ic.className = 'bz-diary-wall-empty-ic';
    ic.textContent = '📖';
    const t = document.createElement('div');
    t.className = 'bz-diary-wall-empty-title';
    t.textContent = this.selTag ? '这个类型还没有记录' : '这一页还空着';
    const d = document.createElement('div');
    d.className = 'bz-diary-wall-empty-desc';
    d.textContent = '写下第一篇，或放上第一张照片';
    const b = document.createElement('button');
    b.className = 'bz-diary-wall-empty-btn';
    b.textContent = '写第一篇';
    b.addEventListener('click', () => {
      this.openAddEntry();
    });
    empty.append(ic, t, d, b);
    return empty;
  }

  // ---------- 媒体构建（视口懒加载） ----------
  /** 媒体 URL：带 sourcePath 解析（日记条目 → 我的/日记/日期.md；影视/信/书 → filename 完整路径），修复纯文件名全局解析失败 */
  private mediaSrcFor(entry: WallEntry, name: string): string {
    const src = entry.kind === 'diary' ? `${DIARY_DIRECTORY}/${entry.date}.md` : entry.filename || '';
    return mediaSrc(this.app(), name, src);
  }

  /** 媒体块（图片/视频/音频 + 渐变占位 + 角标 + 描述） */
  private mediaEl(k: WallMedia, entry: WallEntry): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'bz-diary-wall-media';
    // 功能性内联（动态计算）：宽高比——视频 16/9，图片/音频按 seed 轮换 1/1 与 4/3
    wrap.style.aspectRatio = k.kind === 'video' ? '16 / 9' : this.mediaSeed++ % 3 === 0 ? '1 / 1' : '4 / 3';
    const ph = document.createElement('div');
    ph.className = 'bz-diary-wall-ph';
    ph.textContent = KIND_ICON[k.kind];
    wrap.appendChild(ph);
    if (k.kind === 'img') {
      // 懒加载：占位 → 进视口才加载真实图
      const src = this.mediaSrcFor(entry, k.name);
      const img = document.createElement('img');
      img.alt = k.name;
      img.style.opacity = '0';
      if (src) {
        img.dataset.lazy = src;
        img.onload = () => {
          ph.style.opacity = '0';
          img.style.opacity = '1';
        };
        img.onerror = () => {
          ph.style.opacity = '1';
        };
      }
      wrap.appendChild(img);
      const att = document.createElement('span');
      att.className = 'bz-diary-wall-att';
      att.textContent = '🖼';
      wrap.appendChild(att);
    } else if (k.kind === 'video') {
      // 视频：不预载（preload=none），进视口才挂 src 读首帧；点击灯箱真播
      const src = this.mediaSrcFor(entry, k.name);
      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'none';
      v.playsInline = true;
      if (src) v.dataset.src = src;
      v.onerror = () => {
        ph.style.opacity = '1';
      };
      wrap.appendChild(v);
      const play = document.createElement('div');
      play.className = 'bz-diary-wall-play';
      play.textContent = '▶';
      wrap.appendChild(play);
      const dur = document.createElement('span');
      dur.className = 'bz-diary-wall-dur';
      dur.textContent = '▶';
      wrap.appendChild(dur);
    } else {
      ph.textContent = '🎵';
      ph.style.fontSize = '28px';
    }
    if (k.name) {
      const cap = document.createElement('div');
      cap.className = 'bz-diary-wall-cap';
      cap.innerHTML = `<span style="opacity:.75">${this.esc(entry.emoji)} ${this.esc(entry.time)}</span>　${this.esc(k.name)}`;
      wrap.appendChild(cap);
    }
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openLightbox(k, entry);
    });
    return wrap;
  }

  /** 章节栏缩略图（胶卷小图：图片显示真实图、视频 ▶ 渐变、音频 🎵、无媒体 emoji） */
  private thumbEl(m: WallMedia | undefined, entry: WallEntry): HTMLElement {
    const t = document.createElement('span');
    if (!m) {
      t.className = 'bz-diary-wall-month-thumb bz-diary-wall-month-thumb--t';
      t.textContent = entry.emoji.slice(0, 1);
      return t;
    }
    t.className =
      'bz-diary-wall-month-thumb' +
      (m.kind === 'video' ? ' bz-diary-wall-month-thumb--v' : m.kind === 'audio' ? ' bz-diary-wall-month-thumb--a' : '');
    if (m.kind === 'video') t.textContent = '▶';
    else if (m.kind === 'audio') t.textContent = '🎵';
    else {
      const src = this.mediaSrcFor(entry, m.name);
      if (src) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.dataset.lazy = src;
        img.onerror = () => {
          t.textContent = '🖼';
        };
        t.appendChild(img);
      } else {
        t.textContent = '🖼';
      }
    }
    return t;
  }

  // ---------- 视口懒加载控制器 ----------
  private setupLazy(wall: HTMLElement, key: 'desk' | 'mob') {
    if (this.observers[key]) this.observers[key]!.disconnect();
    if (typeof IntersectionObserver === 'undefined') {
      // jsdom/旧环境无 IO：直接挂载 src（可见性由浏览器兜底）
      wall.querySelectorAll<HTMLElement>('img[data-lazy], video[data-src]').forEach((el) => {
        const lazySrc = el.dataset.lazy;
        if (lazySrc && el.tagName === 'IMG' && !el.getAttribute('src')) {
          el.setAttribute('src', lazySrc);
          delete el.dataset.lazy;
        }
        const vidSrc = el.dataset.src;
        if (el.tagName === 'VIDEO' && vidSrc && el.getAttribute('src') === null) {
          el.setAttribute('src', vidSrc);
          delete el.dataset.src;
          (el as HTMLVideoElement).preload = 'metadata';
        }
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          const el = en.target as HTMLElement;
          if (en.isIntersecting) {
            const lazySrc = el.dataset.lazy;
            if (lazySrc && el.tagName === 'IMG' && !el.getAttribute('src')) {
              el.setAttribute('src', lazySrc);
              delete el.dataset.lazy;
            }
            const vidSrc = el.dataset.src;
            if (el.tagName === 'VIDEO' && vidSrc && el.getAttribute('src') === null) {
              el.setAttribute('src', vidSrc);
              delete el.dataset.src;
              (el as HTMLVideoElement).preload = 'metadata';
            }
          } else {
            // 离开视口的视频暂停（释放解码资源）
            const v = el as HTMLVideoElement;
            if (el.tagName === 'VIDEO' && !v.paused) v.pause();
          }
        });
      },
      { root: wall, rootMargin: '200px 0px 200px 0px', threshold: 0 }
    );
    wall.querySelectorAll<HTMLElement>('img[data-lazy], video[data-src]').forEach((el) => io.observe(el));
    this.observers[key] = io;
  }

  // ---------- 滚动 → 章节自动高亮 ----------
  /** 章节点击：平滑滚动定位到该月的第一个 day-head（不重渲染、不切过滤） */
  private scrollToMonth(mk: string, wall: HTMLElement) {
    const head = wall.querySelector<HTMLElement>(`.bz-diary-wall-day-head[data-date^="${mk}"]`);
    if (!head) return;
    wall.scrollTo({ top: head.offsetTop - 6, behavior: 'smooth' });
  }

  /** 滚动高亮：rAF 节流，当前月份在章节栏高亮并滚到可见 */
  private setupRailHighlight(wall: HTMLElement, rail: HTMLElement, key: 'desk' | 'mob') {
    let raf: number | null = null;
    const onScroll = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const heads = wall.querySelectorAll<HTMLElement>('.bz-diary-wall-day-head');
        if (!heads.length) return;
        let currentMonth: string | null = null;
        const scrollTop = wall.scrollTop;
        for (let i = 0; i < heads.length; i++) {
          const h = heads[i];
          if (h.offsetTop <= scrollTop + 8) {
            currentMonth = h.dataset.date!.slice(0, 7);
          } else break;
        }
        if (!currentMonth) currentMonth = heads[0].dataset.date!.slice(0, 7);
        rail.querySelectorAll('.bz-diary-wall-month').forEach((it) => {
          it.classList.toggle('bz-diary-wall-month--on', it.getAttribute('data-month') === currentMonth);
        });
        const active = rail.querySelector<HTMLElement>(`.bz-diary-wall-month[data-month="${currentMonth}"]`);
        if (active) {
          const railRect = rail.getBoundingClientRect();
          const actRect = active.getBoundingClientRect();
          if (actRect.top < railRect.top || actRect.bottom > railRect.bottom) {
            rail.scrollTop += actRect.top - railRect.top - (rail.clientHeight - actRect.height) / 2;
          }
        }
      });
    };
    wall.addEventListener('scroll', onScroll, { passive: true });
    this.rafCleanups[key] = () => wall.removeEventListener('scroll', onScroll);
  }

  private teardownScrollers(key: 'desk' | 'mob') {
    if (this.rafCleanups[key]) {
      this.rafCleanups[key]!();
      this.rafCleanups[key] = null;
    }
    if (this.observers[key]) {
      this.observers[key]!.disconnect();
      this.observers[key] = null;
    }
  }

  // ---------- 灯箱 ----------
  /** 打开灯箱：图片/视频/音频 controls 播放（真实 src = mediaSrc） */
  private openLightbox(k: WallMedia, entry: WallEntry) {
    const box = this.desk.lbMedia;
    box.innerHTML = '';
    const src = this.mediaSrcFor(entry, k.name);
    const errHtml = `<div class="bz-diary-wall-lberr">${KIND_ICON[k.kind]} 无法加载</div>`;
    if (k.kind === 'img') {
      if (!src) {
        box.innerHTML = errHtml;
      } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = k.name;
        img.className = 'bz-diary-wall-lb-media';
        img.onerror = () => {
          box.innerHTML = errHtml;
        };
        box.appendChild(img);
      }
    } else if (k.kind === 'video') {
      if (!src) {
        box.innerHTML = errHtml;
      } else {
        const v = document.createElement('video');
        v.src = src;
        v.controls = true;
        v.autoplay = true;
        v.className = 'bz-diary-wall-lb-media';
        v.onerror = () => {
          box.innerHTML = errHtml;
        };
        box.appendChild(v);
      }
    } else {
      if (!src) {
        box.innerHTML = errHtml;
      } else {
        const a = document.createElement('audio');
        a.src = src;
        a.controls = true;
        a.autoplay = true;
        a.className = 'bz-diary-wall-lb-media';
        a.onerror = () => {
          box.innerHTML = errHtml;
        };
        box.appendChild(a);
      }
    }
    this.desk.lbCap.textContent = k.name || `${entry.date} ${entry.time} · ${entry.tags.join(' ')}`;
    this.desk.lbSub.textContent = src || '（无法解析媒体路径）';
    this.desk.lb.classList.add('bz-diary-wall-lb--show');
    this.mob.lbMedia.innerHTML = box.innerHTML;
    this.mob.lbCap.textContent = this.desk.lbCap.textContent;
    this.mob.lbSub.textContent = this.desk.lbSub.textContent;
    this.mob.lb.classList.add('bz-diary-wall-lb--show');
  }

  private closeLightbox() {
    [this.desk, this.mob].forEach((ui) => {
      ui.lb.classList.remove('bz-diary-wall-lb--show');
      ui.lbMedia.innerHTML = '';
    });
  }

  // ---------- 条目动作（复制/改标签/加密/删除；自包含前复用 diary 域） ----------
  private async copyLink(e: WallEntry) {
    try {
      const { copyLink } = await import('../diary/ui/entries') as typeof import('../diary/ui/entries');
      const entry = this.toDiaryEntry(e);
      await copyLink(entry.id || '');
    } catch (err) {
      notice('复制双链失败', 'error');
    }
  }

  private async copyContent(e: WallEntry) {
    try {
      await navigator.clipboard.writeText(e.content || e.text || '');
      notice('已复制日记正文', 'success');
    } catch (err) {
      notice('复制失败', 'error');
    }
  }

  /**
   * 改标签：接 diary showTagPicker。
   * 提速：优先在 diary state 里按 filename+lineNumber 定位真实条目（回忆墙与 diary 同源解析，行号一致），
   * 找到即弹窗，**不做全量 loadAll**（原实现每次改标签都全量重读日记，数据多时很慢）；
   * 仅当 diary state 无该条目时才 loadAll 一次并重试。
   */
  private editTags(e: WallEntry) {
    void this.openTagPicker(e, false);
  }

  private async openTagPicker(e: WallEntry, afterLoad: boolean) {
    try {
      const diaryState = (await import('../diary/state')).state;
      const entry = diaryState.data.originalDiaryEntries.find(
        (x: any) => x.filename === e.filename && x.lineNumber === e.lineNumber
      );
      if (entry && entry.id) {
        const { showTagPicker } = await import('../diary/ui/dialogs') as typeof import('../diary/ui/dialogs');
        showTagPicker(entry.id);
        return;
      }
      if (!afterLoad) {
        // state 里没有（diary 未加载或条目特殊）→ 全量加载一次后重试
        await this.ensureDiaryLoaded();
        await this.openTagPicker(e, true);
        return;
      }
      notice('改标签暂不可用（找不到原文条目）', 'error');
    } catch (err) {
      notice('改标签暂不可用', 'error');
    }
  }

  /** 加密：接 diary encryptEntry（需保险箱解锁，diary 流程处理） */
  private async encryptEntryAction(e: WallEntry) {
    try {
      const { ensureSafeUnlocked } = await import('../encrypt') as typeof import('../encrypt');
      const unlocked = await ensureSafeUnlocked();
      if (!unlocked) return;
      const diary = await import('../diary/ui/entries') as typeof import('../diary/ui/entries');
      // 复用 diary 抽屉里的加密流程（encryptFromSheet 未导出，走完整 encryptEntry + deleteEntry）
      const { encryptEntry } = await import('../diary/encrypt') as typeof import('../diary/encrypt');
      const { deleteEntry } = await import('../diary/store') as typeof import('../diary/store');
      const entry = this.toDiaryEntry(e);
      const enc = await encryptEntry(entry);
      if (enc && entry.id) {
        await deleteEntry(entry.id);
        notice('已加密移入保险箱', 'success');
        void this.loadAndRender();
      }
    } catch (err) {
      notice('加密失败', 'error');
    }
  }

  /** 解密：接 diary 流程（reclassifyEntry 降级） */
  private async decryptEntryAction(e: WallEntry) {
    try {
      const { reclassifyEntry } = await import('../diary/encrypt') as typeof import('../diary/encrypt');
      const noteId = e.noteId;
      if (!noteId) {
        notice('无法解密（缺少保险箱记录）', 'error');
        return;
      }
      const newTags = e.tags.filter((t) => t !== '加密');
      const ok = await reclassifyEntry(noteId, newTags);
      if (ok) {
        notice('已解密还原', 'success');
        void this.loadAndRender();
      } else {
        notice('解密失败', 'error');
      }
    } catch (err) {
      notice('解密失败', 'error');
    }
  }

  /** 删除：接 diary showConfirm 流程 */
  private async deleteEntryAction(e: WallEntry) {
    try {
      const { showConfirm } = await import('../diary/ui/entries') as typeof import('../diary/ui/entries');
      const entry = this.toDiaryEntry(e);
      showConfirm(entry.id || '');
    } catch (err) {
      notice('删除暂不可用', 'error');
    }
  }

  /** 确保 diary 数据已加载（改标签/删除依赖 diary state 有对应条目） */
  private async ensureDiaryLoaded() {
    try {
      const { loadAll } = await import('../diary/store') as typeof import('../diary/store');
      await loadAll();
    } catch (e) {
      /* 忽略：diary 未初始化时降级 */
    }
  }

  // ---------- 底部抽屉（动作占位） ----------
  private openSheet(e: WallEntry) {
    this.sheetEntry = e;
    [this.desk, this.mob].forEach((ui) => {
      ui.sheetEmoji.textContent = e.emoji;
      ui.sheetTime.textContent = `${e.date}  ${e.time}  ·  ${e.tags.join(' ')}`;
      ui.sheetContent.textContent = e.content || '（仅媒体）';
      const mbox = ui.sheetMedia;
      mbox.innerHTML = '';
      e.media.forEach((k) => {
        const mt = document.createElement('div');
        mt.className = 'bz-diary-wall-sheet-thumb';
        const src = this.mediaSrcFor(e, k.name);
        if (k.kind === 'img' && src) {
          const img = document.createElement('img');
          img.src = src;
          img.alt = k.name;
          mt.appendChild(img);
        } else {
          mt.textContent = k.kind === 'video' ? '▶' : '🎵';
        }
        mt.addEventListener('click', () => this.openLightbox(k, e));
        mbox.appendChild(mt);
      });
      const acts = ui.sheetActions;
      acts.innerHTML = '';
      const mk = (icon: string, label: string, sub: string | null, cls: string | null, fn: () => void) => {
        const b = document.createElement('button');
        b.className = 'bz-diary-wall-sheet-act' + (cls ? ' ' + cls : '');
        b.innerHTML = `<span class="bz-diary-wall-sheet-act-ic">${icon}</span>${label}${sub ? `<span class="bz-diary-wall-sheet-act-sub">${sub}</span>` : ''}`;
        b.addEventListener('click', fn);
        acts.appendChild(b);
      };
      mk('↗', '打开', null, '', () => {
        this.closeSheet();
        void this.jumpTo(e);
      });
      mk('⧉', '复制双链', null, '', () => {
        this.closeSheet();
        void this.copyLink(e);
      });
      mk('▤', '复制正文', `${(e.content || '').trim().length} 字`, '', () => {
        this.closeSheet();
        void this.copyContent(e);
      });
      if (e.media.length) {
        mk('📎', '附件', `${e.media.length} 个媒体`, '', () => {
          this.closeSheet();
          notice(`附件：${e.media.map((m) => m.name).join('、')}`);
        });
      }
      if (!e.tags.includes('加密')) {
        mk('⌘', '改标签', null, '', () => {
          this.closeSheet();
          this.editTags(e);
        });
        mk('🔒', '加密', null, 'bz-diary-wall-sheet-act--accent', () => {
          this.closeSheet();
          void this.encryptEntryAction(e);
        });
      } else {
        mk('🔓', '解密', null, 'bz-diary-wall-sheet-act--accent', () => {
          this.closeSheet();
          void this.decryptEntryAction(e);
        });
      }
      mk('🗑', '删除', null, 'bz-diary-wall-sheet-act--danger', () => {
        this.closeSheet();
        void this.deleteEntryAction(e);
      });
      ui.sheet.classList.add('bz-diary-wall-sheet--show');
    });
  }

  private closeSheet() {
    [this.desk, this.mob].forEach((ui) => ui.sheet.classList.remove('bz-diary-wall-sheet--show'));
    this.sheetEntry = null;
  }

  private bindSheet() {
    [this.desk, this.mob].forEach((ui) => {
      // 点遮罩（sheet 自身背景）关闭
      ui.sheet.addEventListener('click', (e) => {
        if (e.target === ui.sheet) this.closeSheet();
      });
    });
  }

  // ---------- 统计 ----------
  /** HTML 转义（防注入，原型直接用 innerHTML 有风险） */
  private esc(s: string): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private dayStats(list: WallEntry[]) {
    let imgs = 0;
    let vids = 0;
    let auds = 0;
    let texts = 0;
    list.forEach((e) => {
      e.media.forEach((k) => {
        if (k.kind === 'video') vids++;
        else if (k.kind === 'audio') auds++;
        else imgs++;
      });
      if (e.content) texts++;
    });
    return { imgs, vids, auds, texts };
  }

  private statHtml(s: { imgs: number; vids: number; auds: number; texts: number }): string {
    const parts: string[] = [];
    if (s.imgs) parts.push(`<b>${s.imgs}</b> 图`);
    if (s.vids) parts.push(`<b>${s.vids}</b> 视频`);
    if (s.auds) parts.push(`<b>${s.auds}</b> 音频`);
    if (s.texts) parts.push(`<b>${s.texts}</b> 条文字`);
    return parts.join(' · ') || '空';
  }

  // ---------- ESC ----------
  private registerEscape() {
    this.escUnregister = escManager.register('diary-wall', {
      isVisible: () => !!this.root && this.root.style.display === 'flex',
      close: () => {
        // 日期弹窗优先，其次抽屉，其次灯箱，最后整体关闭
        if (this._dateFilterEl) {
          this.closeDateFilter();
          return;
        }
        if (this.desk.sheet.classList.contains('bz-diary-wall-sheet--show')) {
          this.closeSheet();
          return;
        }
        if (this.desk.lb.classList.contains('bz-diary-wall-lb--show')) {
          this.closeLightbox();
          return;
        }
        this.hide();
      },
    });
  }

  // ---------- 显示/隐藏 ----------
  /** 幂等初始化（ensureElements 创建 DOM + 绑定事件） */
  async init() {
    if (this._initialized) return;
    this.ensureElements();
  }

  /** 打开回忆墙：加载数据并渲染 */
  async openManager() {
    await this.init();
    this.show();
  }

  show() {
    if (!this._initialized) this.ensureElements();
    // 移动端默认全屏：开关开=挂 .bz-win-mfs 真全屏类（幂等），关=常规卡
    applyMobileWindowFullscreen(this.root!.querySelector('.bz-diary-wall-desk') as HTMLElement, this.config.mobileDefaultFullscreen);
    applyMobileWindowFullscreen(this.root!.querySelector('.bz-diary-wall-mob') as HTMLElement, this.config.mobileDefaultFullscreen);
    this.root!.style.display = 'flex';
    topifyZ(this.root!); // ADR-0067
    void this.loadAndRender();
  }

  hide() {
    if (!this.root) return;
    this.closeDateFilter();
    this.closeLightbox();
    this.closeSheet();
    this.root.style.display = 'none';
  }

  /** 加载数据并渲染（openManager 主路径） */
  private async loadAndRender() {
    try {
      this.entries = await loadWallEntries(this.app());
    } catch (e: any) {
      this.entries = [];
      notice('加载日记失败：' + (e && e.message ? e.message : String(e)), 'error');
    }
    this.renderAll();
  }

  // ---------- 头部动作（写日记 / 搜索 / 日期选择器） ----------
  /** 写日记：接 diary 既有 openAddDialog（自包含前复用 diary 域） */
  private openAddEntry() {
    try {
      openAddDialog();
    } catch (e) {
      notice('写日记暂不可用：' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  }

  /** 标题点击 → 回忆墙自包含日期选择器（按年份/月份过滤本域数据；不再调 diary showDatePicker——那是 diary 面板的 filter） */
  private openDatePicker() {
    this._dateFilterEl = this.mkDateFilter();
    document.body.appendChild(this._dateFilterEl);
    topifyZ(this._dateFilterEl); // ADR-0067：后显示在上
    this._dateFilterEl.style.display = 'flex';
  }

  /** 自绘日期筛选弹窗（年份行 + 月份网格 + 全部/关闭） */
  private mkDateFilter(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'bz-diary-wall-datefilter';
    const card = document.createElement('div');
    card.className = 'bz-diary-wall-datefilter-card';
    const years = Array.from(new Set(this.entries.map((e) => e.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
    const cur = this.selDateFilter;

    // 头部：标题 + 全部按钮 + 关闭
    const head = document.createElement('div');
    head.className = 'bz-diary-wall-datefilter-head';
    const title = document.createElement('div');
    title.className = 'bz-diary-wall-datefilter-title';
    title.textContent = '按日期筛选';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'bz-diary-wall-datefilter-reset';
    resetBtn.textContent = '全部';
    resetBtn.addEventListener('click', () => {
      this.selDateFilter = null;
      this.closeDateFilter();
      this.renderAll();
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bz-diary-wall-datefilter-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.closeDateFilter());
    head.append(title, resetBtn, closeBtn);
    card.appendChild(head);

    // 年份行（chips）
    const yearRow = document.createElement('div');
    yearRow.className = 'bz-diary-wall-datefilter-years';
    years.forEach((y) => {
      const b = document.createElement('button');
      b.className = 'bz-diary-wall-datefilter-year' + (cur?.year === y ? ' bz-diary-wall-datefilter-year--on' : '');
      b.dataset.year = y;
      b.textContent = y;
      b.addEventListener('click', () => {
        // 两段式：点年份 → 选中该年并（重）渲染月份网格（弹窗保持打开）；点月份才应用过滤并关闭
        this.selDateFilter = { year: y };
        this.closeDateFilter();
        this._dateFilterEl = this.mkDateFilter();
        document.body.appendChild(this._dateFilterEl);
        topifyZ(this._dateFilterEl);
        this._dateFilterEl.style.display = 'flex';
      });
      yearRow.appendChild(b);
    });
    card.appendChild(yearRow);

    // 当前年份的月份网格（若已选年份）
    if (cur?.year && years.includes(cur.year)) {
      const monthRow = document.createElement('div');
      monthRow.className = 'bz-diary-wall-datefilter-months';
      const monthCounts = new Map<string, number>();
      this.entries
        .filter((e) => e.date.startsWith(cur.year))
        .forEach((e) => {
          const m = e.date.slice(5, 7);
          monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
        });
      for (let i = 1; i <= 12; i++) {
        const ms = String(i).padStart(2, '0');
        const cnt = monthCounts.get(ms) || 0;
        const cardEl = document.createElement('button');
        cardEl.className =
          'bz-diary-wall-datefilter-month' +
          (cnt === 0 ? ' bz-diary-wall-datefilter-month--empty' : '') +
          (cur.month === ms ? ' bz-diary-wall-datefilter-month--on' : '');
        cardEl.innerHTML = `<span class="bz-diary-wall-datefilter-month-name">${i}月</span><span class="bz-diary-wall-datefilter-month-cnt">${cnt} 条</span>`;
        cardEl.addEventListener('click', () => {
          if (cnt === 0) return;
          this.selDateFilter = { year: cur.year, month: ms };
          this.closeDateFilter();
          this.renderAll();
        });
        monthRow.appendChild(cardEl);
      }
      card.appendChild(monthRow);
    } else {
      const hint = document.createElement('div');
      hint.className = 'bz-diary-wall-datefilter-hint';
      hint.textContent = '点击年份查看该年各月';
      card.appendChild(hint);
    }

    wrap.appendChild(card);
    // 遮罩点击关闭（点卡片外）
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) this.closeDateFilter();
    });
    return wrap;
  }

  private closeDateFilter() {
    if (this._dateFilterEl) {
      this._dateFilterEl.remove();
      this._dateFilterEl = null;
    }
  }

  /** 搜索：toggle 搜索框（桌面/移动各一），输入过滤；打开/收起同步按钮高亮态 */
  private toggleSearch(ui: typeof this.desk) {
    const row = ui.searchRow;
    const box = ui.searchBox;
    const btn = ui.head.querySelector<HTMLElement>('[data-act="search"]');
    if (!row || !box) return;
    if (row.style.display === 'none') {
      row.style.display = 'block';
      box.focus();
      box.select();
      btn?.classList.add('bz-diary-wall-icon-btn--on');
    } else {
      row.style.display = 'none';
      box.value = '';
      this.searchKeyword = '';
      this.renderAll();
      btn?.classList.remove('bz-diary-wall-icon-btn--on');
    }
  }

  /** App 实例（生产由主实现注入；测试 setApp——diary/app.ts 单例，与 diary 域同口径） */
  private app(): any {
    return getApp();
  }

  // ---------- 卸载 ----------
  cleanup() {
    this.closeDateFilter();
    this.closeContextMenu();
    this.teardownScrollers('desk');
    this.teardownScrollers('mob');
    this.escUnregister?.unregister();
    this.escUnregister = null;
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this._initialized = false;
    // 单例清空（对齐 password-vault AppController：cleanup 后 getInstance 重建）
    DiaryWallAppController.instance = null;
  }
}

// 便捷导入（供 index.ts / 测试）
export type { WallEntry, WallMedia } from './data';
