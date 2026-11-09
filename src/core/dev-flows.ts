/**
 * 测试合集 · 步骤回放器（开发工作流，ADR-0276）——只在测试库构建里存在。
 *
 * esbuild `define: { __BZ_DEV__ }` 为 false 时（主库 watch / production / 发布七步），
 * main.ts 里的动态 import 分支被整体摇树，本文件一个字节都不进产物。
 *
 * 用途（用户拍板 2026-11-02）：**不用手点，肉眼看**。打开 Obsidian 自己把一条流程从头播到尾，
 * 每步停一会儿，人盯着屏幕上发生的事判断「流程对不对」；觉得不对就暂停、退回、重播。
 * 所以步骤名写准、每步 `hold` 给够看的时间——「第 N 步〈步骤名〉没反应」就是一句能直接修的报修。
 *
 * 形态（原型稿 .scratch/dev-replay-prototypes v2 一比一）：
 *   底部条 = 磁带计数器：mono LCD `STEP n/N`（hover 浮出完整步骤清单毛玻璃卡）+
 *   分段胶带（弹性能缩，多步不增高）+ 当前步名单行省略 + 运输键。
 *   →/← 前进退回（退回 = 调上一步 undo；无 undo 不可越过）· 空格 自动/暂停 ·
 *   ESC 退出：反向跑 undo 链 + 流程 cleanup，还原进流程前的状态。
 *
 * 合集面板 = uiModal + 命令面板式清单，按流程的 domain 字段分组折叠收纳。
 * 两者都是开发工具不进发布版，样式类 .bz-dev-* 见 core/styles.css 开发工具段。
 */
import { setIcon } from 'obsidian';
import type { App } from 'obsidian';
import { notice } from './notice';
import { openSetupWizard } from './setup-wizard';
import { setupDoneStorageKey, SETUP_DONE_FALLBACK_KEY } from './setup-state';
import { vaultBasePathOf } from './plugin-path';
import { registerAlwaysOnTop, unregisterAlwaysOnTop } from './z-order';
import { uiModal, closeAllModals } from './ui/modal';
import { CHANGELOG_RELEASES } from './changelog-data';
import { openDiary } from '../diary';
import { resetDiaryTutorialState } from '../diary/tutorial';

/** 一条可演步骤：name 写准（报修引用点）；hold = 自动播放时这一步做完停多久给人看；
 *  undo 缺省 = 该步不可回退 */
export interface DevStep {
  name: string;
  run: (ctx: ReplayCtx) => void | Promise<void>;
  undo?: (ctx: ReplayCtx) => void | Promise<void>;
  /** 自动播放时本步停多久（ms）。缺省 AUTO_STEP_MS；给人看的步骤写大一点 */
  hold?: number;
  /** 本步超时（ms）。缺省 STEP_TIMEOUT_MS；超时只跳过这一步，不会让整条流程卡死 */
  timeoutMs?: number;
}

/** 流程：domain = 合集面板的分组名（同 domain 折叠在一组） */
export interface DevFlow {
  id: string;
  name: string;
  domain: string;
  steps: DevStep[];
  cleanup?: () => void | Promise<void>;
}

/** 回放上下文：步骤间传递「进流程前的原值」等现场 */
export interface ReplayCtx {
  app: unknown;
  plugin: any;
  saved: Record<string, unknown>;
}

// ==================== 流程清单（新流程往这里加） ====================

/**
 * 回放纪律（用户拍板 2026-10-31）：**初始化步骤之外的步骤不许改任何状态、不许私改数据**——
 * 只允许「点击真实按钮」「在表单里输入」这类明文交互（回放本身就是找 bug 用的，
 * 脚本绕过 UI 直调服务会把 bug 藏起来）。初始化步骤（数据播种/清标记）放流程第一步，
 * 名字里带「初始化」；其后的步骤一律走真 DOM。
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 等条件成立（fn 返回 true），interval 200ms、超时抛错——超时本身就是要看的现象 */
async function waitUntil(fn: () => boolean, timeoutMs = 6000, what = ''): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return;
    await sleep(200);
  }
  throw new Error(`等待超时：${what || '条件未在时限内成立'}`);
}

/** 更新提示小窗本体（判「弹没弹」的唯一判据） */
const notePopup = (): HTMLElement | null => document.querySelector<HTMLElement>('.bz-chg-note');

/** 小窗里「更早的版本」那一整块的开关（点一下全部旧版本铺成文本流） */
const oldHead = (): HTMLElement | null =>
  notePopup()?.querySelector<HTMLElement>('.bz-chg-old-h') || null;

/** 小窗的内容滚动容器 */
const chgScroll = (): HTMLElement | null =>
  notePopup()?.querySelector<HTMLElement>('.bz-chg-scroll') || null;

/** 当前插件版本 */
const curVersion = (ctx: ReplayCtx): string => String(ctx.plugin?.manifest?.version || '');

export function devFlows(): DevFlow[] {
  return [
    {
      id: 'setup-wizard',
      name: '首次引导重来',
      domain: '核心',
      steps: [
        {
          name: '初始化：清本库引导完成标记（设置 + localStorage 兜底键）',
          run: async (ctx) => {
            ctx.saved.setupDone = ctx.plugin.settings.setupDone;
            ctx.plugin.settings.setupDone = false;
            await ctx.plugin.saveSettings();
            const key = setupDoneStorageKey(vaultBasePathOf(ctx.app));
            try {
              ctx.saved.lsKey = localStorage.getItem(key);
              ctx.saved.lsFallback = localStorage.getItem(SETUP_DONE_FALLBACK_KEY);
              localStorage.removeItem(key);
              localStorage.removeItem(SETUP_DONE_FALLBACK_KEY);
            } catch { /* 非 window 环境忽略 */ }
          },
          undo: async (ctx) => {
            ctx.plugin.settings.setupDone = ctx.saved.setupDone;
            await ctx.plugin.saveSettings();
            try {
              const key = setupDoneStorageKey(vaultBasePathOf(ctx.app));
              const set = (k: string, v: unknown) => {
                if (v === null || v === undefined) localStorage.removeItem(k);
                else localStorage.setItem(k, String(v));
              };
              set(key, ctx.saved.lsKey);
              set(SETUP_DONE_FALLBACK_KEY, ctx.saved.lsFallback);
            } catch { /* 同上 */ }
          },
        },
        {
          name: '弹出首次引导（关掉它走正常关闭路径，不提供回退）',
          run: (ctx) => {
            openSetupWizard(ctx.app, { firstRun: true });
          },
          hold: 4000,
        },
      ],
    },
    /**
     * 更新提示小窗 · 流程演示
     *
     * 一条流程把「什么时候该弹、弹出来长什么样、怎么关、下次还弹不弹」走一遍，
     * 全是屏幕上看得到的东西：四段判定（新装 / 老库首启 / 跨版本 / 降级）+ 首屏排版 +
     * 折叠行连点 + 滚动渐隐 + 点遮罩关闭 + 关闭后再触发。
     * 每一步都真点、真滚、真落盘；不调私有方法判定（读者拿眼睛看，不看返回值）。
     */
    {
      id: 'changelog-note',
      name: '更新提示小窗 · 流程演示',
      domain: '核心',
      steps: [
        {
          name: '初始化：备份「已看版本」与安装状态，清掉挂起的提示',
          run: (ctx) => {
            closeAllModals();
            ctx.saved.seen = ctx.plugin.settings.changelogSeenVersion;
            ctx.saved.fileExisted = ctx.plugin.settingsFileExisted;
            ctx.saved.pending = ctx.plugin.pendingNoteVersion;
            ctx.plugin.pendingNoteVersion = null;
          },
          undo: async (ctx) => {
            closeAllModals();
            ctx.plugin.settings.changelogSeenVersion = ctx.saved.seen;
            ctx.plugin.settingsFileExisted = ctx.saved.fileExisted;
            ctx.plugin.pendingNoteVersion = ctx.saved.pending ?? null;
            await ctx.plugin.saveSettings();
          },
          hold: 1500,
        },
        {
          name: '一 · 真新装（没有 data.json）：不该弹，只默默记下当前版本',
          run: async (ctx) => {
            closeAllModals();
            ctx.plugin.settingsFileExisted = false;
            ctx.plugin.settings.changelogSeenVersion = '';
            ctx.plugin.pendingNoteVersion = null;
            ctx.plugin.armChangelogNote();
            await sleep(400);
            ctx.plugin.noteBzUsed(); // 真实触发点
            await sleep(800);
          },
          hold: 2500,
        },
        {
          name: '二 · 老库首启（从没看过日志）：第一次打开 bz 界面时弹出小窗',
          run: async (ctx) => {
            closeAllModals();
            await ctx.plugin.markChangelogSeen(''); // 真落盘：模拟本功能上线前的老库
            ctx.plugin.settingsFileExisted = true;
            ctx.plugin.pendingNoteVersion = null;
            ctx.plugin.armChangelogNote();
            await sleep(200);
            ctx.plugin.noteBzUsed();
            await waitUntil(() => !!notePopup(), 4000, '小窗出现');
          },
          hold: 5000,
        },
        {
          name: '三 · 首屏：最上面是最新版，底部一行「更早的版本 · N 版」默认收起',
          run: async () => {
            chgScroll()?.scrollTo({ top: 0 });
            await sleep(400);
          },
          hold: 3500,
        },
        {
          name: '四 · 点开「更早的版本」：整块一次铺成连续文本流，看有没有错位或卡顿',
          run: async () => {
            const head = oldHead();
            if (!head) {
              notice('小窗里没有「更早的版本」可点（旧版本没渲染出来）', 'warning');
              return;
            }
            head.click();
            await sleep(700);
          },
          hold: 4000,
        },
        {
          name: '五 · 顺着文本流滚到底：看旧版本是否连续、底部渐隐是否出现',
          run: async () => {
            const sc = chgScroll();
            if (!sc) {
              notice('小窗的内容区不见了', 'warning');
              return;
            }
            sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
            await sleep(1200);
          },
          hold: 4000,
        },
        {
          name: '六 · 再点一次收起：几十版收成一行，滚动位置是否还在（不跳顶）',
          run: async () => {
            oldHead()?.click();
            await sleep(500);
          },
          hold: 2500,
        },
        {
          name: '七 · 滚回顶部：看顶部渐隐是否恢复、有没有卡住不回弹',
          run: async () => {
            chgScroll()?.scrollTo({ top: 0, behavior: 'smooth' });
            await sleep(900);
          },
          hold: 2500,
        },
        {
          name: '八 · 点遮罩：先弹「支持作者」提醒，日志窗停在下面不动',
          run: async () => {
            const maskEl = notePopup()?.parentElement;
            maskEl?.click();
            await waitUntil(() => !!document.querySelector('.bz-sup'), 3000, '提醒窗出现');
            await sleep(900);
          },
          hold: 4000,
        },
        {
          name: '九 · 点「以后再说」：提醒窗与日志窗一起收掉，别留下透明挡板',
          run: async () => {
            document.querySelector<HTMLElement>('.bz-sup-later')?.click();
            await waitUntil(
              () => !notePopup() && !document.querySelector('.bz-sup'),
              3000,
              '两个窗都消失',
            );
            await sleep(400);
          },
          hold: 2500,
        },
        {
          name: '十 · 再关一次，这回点「支持作者」：日志窗收掉，落进赞赏扫码窗',
          run: async () => {
            closeAllModals();
            const { openChangelogNote } = await import('../settings-panel/changelog-note');
            openChangelogNote(CHANGELOG_RELEASES);
            await sleep(600);
            document.querySelector<HTMLElement>('.bz-chgn-close')?.click();
            await waitUntil(() => !!document.querySelector('.bz-sup'), 3000, '提醒窗出现');
            await sleep(700);
            document.querySelector<HTMLElement>('.bz-sup-go')?.click();
            await waitUntil(
              () => !notePopup() && !!document.querySelector('.bz-rw'),
              5000,
              '赞赏扫码窗出现',
            );
            await sleep(900);
          },
          hold: 5000,
        },
        {
          name: '十一 · 同一会话里再触发 5 次：本次已经看过，不该再弹',
          run: async (ctx) => {
            closeAllModals();
            for (let i = 0; i < 5; i++) {
              ctx.plugin.noteBzUsed();
              await sleep(250);
            }
            await sleep(600);
          },
          hold: 2500,
        },
        {
          name: '十二 · 跨版本更新（上次看的是几个月前的老版本）：再弹一次，中间版本的日志一起列出来',
          run: async (ctx) => {
            closeAllModals();
            // 拿一个确实早于当前的版本，模拟「用户几个月没更新，这次一口气跨好几个版本」
            const older = CHANGELOG_RELEASES[3]?.version || CHANGELOG_RELEASES[0]?.version || '';
            await ctx.plugin.markChangelogSeen(older);
            ctx.plugin.settingsFileExisted = true;
            ctx.plugin.pendingNoteVersion = null;
            ctx.plugin.armChangelogNote();
            await sleep(200);
            ctx.plugin.noteBzUsed();
            await waitUntil(() => !!notePopup(), 4000, `跨版本（上次看过 v${older}）弹窗`);
            await sleep(600);
          },
          hold: 5000,
        },
        {
          name: '十三 · 降级回旧版（当前版本比「已看过」还旧）：不弹，安静记账',
          run: async (ctx) => {
            closeAllModals();
            await ctx.plugin.markChangelogSeen('99.0.0');
            ctx.plugin.settingsFileExisted = true;
            ctx.plugin.pendingNoteVersion = null;
            ctx.plugin.armChangelogNote();
            await sleep(200);
            ctx.plugin.noteBzUsed();
            await sleep(900);
          },
          hold: 2500,
        },
        {
          name: '收尾：关掉小窗，还原「已看版本」与安装状态',
          run: async (ctx) => {
            closeAllModals();
            ctx.plugin.settings.changelogSeenVersion = ctx.saved.seen ?? '';
            ctx.plugin.settingsFileExisted = ctx.saved.fileExisted;
            ctx.plugin.pendingNoteVersion = ctx.saved.pending ?? null;
            await ctx.plugin.saveSettings();
            console.log('[bz] 更新提示演示跑完，当前版本', curVersion(ctx), '· 内置日志', CHANGELOG_RELEASES.length, '版');
          },
          hold: 1500,
        },
      ],
    },
    /**
     * 日记本首次教程弹窗 · 流程演示
     *
     * 只演四屏：清两个标记 → 真命令打开日记本（册子非空时教程应盖在摊开的书上）
     * → 点「先翻翻」收壳 → 再打开一次（不该重弹）。
     *
     * 前提：测试库里得有日记。空册时按设计**不弹**（入口常驻在空册那页上），
     * 这时第二步会等不到弹窗——不是 bug；想看弹窗先在测试库写一篇或 seed 一批。
     */
    {
      id: 'diary-tutorial',
      name: '日记本首次教程弹窗',
      domain: '日记本',
      steps: [
        {
          name: '初始化：清「首次打开」与「教程已弹」两个标记，收起可能开着的弹窗',
          run: async (ctx) => {
            closeAllModals();
            resetDiaryTutorialState();
            ctx.saved.diaryFirstOpened = ctx.plugin.settings.diaryFirstOpened;
            ctx.saved.diaryTutorialSeen = ctx.plugin.settings.diaryTutorialSeen;
            ctx.plugin.settings.diaryFirstOpened = false;
            ctx.plugin.settings.diaryTutorialSeen = false;
            await ctx.plugin.saveSettings();
          },
          undo: async (ctx) => {
            closeAllModals();
            ctx.plugin.settings.diaryFirstOpened = ctx.saved.diaryFirstOpened;
            ctx.plugin.settings.diaryTutorialSeen = ctx.saved.diaryTutorialSeen;
            await ctx.plugin.saveSettings();
          },
          hold: 1500,
        },
        {
          name: '命令打开日记本：书先摊开，册子非空时教程票根随后盖上来',
          run: async (ctx) => {
            openDiary(ctx.app as App);
            await waitUntil(
              () => !!document.querySelector('.bz-diary-tutorial-popup'),
              15000,
              '教程弹窗出现（空册不会弹，属设计）'
            );
            await sleep(500);
          },
          hold: 5000,
        },
        {
          name: '点「先翻翻」收起教程：下面应是摊开的册子，不是白屏',
          run: async () => {
            document.querySelector<HTMLButtonElement>('.bz-diary-tut-dismiss')?.click();
            await sleep(500);
          },
          hold: 4000,
        },
        {
          name: '再执行一次打开命令：首次已判过、也弹过，教程不该再弹',
          run: async (ctx) => {
            openDiary(ctx.app as App);
            await sleep(1500);
          },
          hold: 2500,
        },
      ],
    },
  ];
}

// ==================== 回放器（单例底部条） ====================

/** 自动播放时每步默认停留 */
const AUTO_STEP_MS = 2000;
/** 单步默认超时：一步卡住不该让整条流程无声停住 */
const STEP_TIMEOUT_MS = 20000;

let hud: ReplayHud | null = null;

export function startReplay(plugin: any, flow: DevFlow, opts: { auto?: boolean } = {}): void {
  if (hud) hud.destroy(false);
  hud = new ReplayHud(plugin, flow);
  hud.mount();
  if (opts.auto) hud.play();
}

class ReplayHud {
  private index = -1; // 已执行到的步骤下标（-1 = 尚未开始）
  private playing = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private bad = new Set<number>(); // 失败/超时的步骤下标（胶带上标红）
  private ctx: ReplayCtx;
  private root: HTMLElement | null = null;
  private segEls: HTMLElement[] = [];
  private floatEls: HTMLElement[] = [];
  private lcd: HTMLElement | null = null;
  private lbl: HTMLElement | null = null;
  private playBtn: HTMLElement | null = null;
  private onKey = (e: KeyboardEvent) => void this.handleKey(e);

  constructor(private plugin: any, private flow: DevFlow) {
    this.ctx = { app: plugin.app, plugin, saved: {} };
  }

  mount(): void {
    const root = document.createElement('div');
    root.className = 'bz-dev-replay';
    // 左：LCD 计数器（hover 浮出完整步骤清单）
    const counter = root.createDiv();
    counter.className = 'counter';
    this.lcd = counter.createDiv();
    this.lcd.className = 'lcd';
    const floater = counter.createDiv();
    floater.className = 'floater';
    this.floatEls = this.flow.steps.map((s, i) => {
      const fi = floater.createDiv();
      fi.className = 'fi';
      fi.createSpan({ text: String(i + 1).padStart(2, '0') });
      fi.createSpan({ text: s.name });
      return fi;
    });
    // 中：分段胶带（弹性能缩，多步不增高）
    const tape = root.createDiv();
    tape.className = 'tape';
    this.segEls = this.flow.steps.map(() => {
      const seg = tape.createDiv();
      seg.className = 'seg';
      return seg;
    });
    // 当前步名单行省略 + 播放状态小字
    this.lbl = root.createDiv();
    this.lbl.className = 'lbl';
    // 右：运输键（Obsidian 内置图标；播放键 primary 实底成视觉重点，其余 ghost）
    const transport = root.createDiv();
    transport.className = 'transport';
    const mk = (icon: string, onclick: () => void, tone?: string): HTMLElement => {
      const b = transport.createEl('button');
      b.className = tone ? `bz-btn bz-btn--${tone}` : 'bz-btn';
      b.setAttribute('aria-label', icon);
      setIcon(b, icon);
      b.onclick = (e) => { (e.target as HTMLElement).blur(); onclick(); };
      return b;
    };
    mk('skip-back', () => void this.stepBack(), 'ghost');
    this.playBtn = mk('play', () => this.togglePlay(), 'primary');
    mk('skip-forward', () => void this.stepForward(), 'ghost');
    mk('x', () => this.destroy(true), 'ghost');
    this.root = root;
    document.body.appendChild(root);
    // z 固定值赢不了动态发号器（ADR-0067 计数器从 100000 单调递增，弹窗一多就越过任何静态档）
    // ——走分配器的恒顶注册：每次有新 overlay 发号，分配器自动把本条抬到最新档之上
    registerAlwaysOnTop(root);
    window.addEventListener('keydown', this.onKey, true);
    this.render();
  }

  /** 自动播放（点播放键 / debug-flow.json 的 auto） */
  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.render();
    void this.tick();
  }

  private handleKey(e: KeyboardEvent): void {
    // 只认真人按键：流程自己发的合成 ESC/空格不能把自己按掉（真踩过，整条流程无声消失）
    if (!e.isTrusted) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); void this.stepForward(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); void this.stepBack(); }
    else if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.togglePlay(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.destroy(true); }
    this.render();
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    if (this.playing) {
      void this.tick();
    } else if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.render();
  }

  /** 自动播放一拍：跑下一步 → 按这一步的 hold 停一会儿 → 再下一拍 */
  private async tick(): Promise<void> {
    this.timer = null;
    if (!this.playing) return;
    if (this.index >= this.flow.steps.length - 1) {
      this.playing = false;
      this.render();
      notice(`「${this.flow.name}」播完了（共 ${this.flow.steps.length} 步）`);
      return;
    }
    await this.stepForward();
    if (!this.playing) return;
    const wait = this.flow.steps[this.index]?.hold ?? AUTO_STEP_MS;
    this.timer = setTimeout(() => void this.tick(), wait);
  }

  private async stepForward(): Promise<void> {
    const next = this.index + 1;
    if (this.busy || next >= this.flow.steps.length) return;
    this.busy = true;
    const step = this.flow.steps[next];
    this.render();
    try {
      await this.withTimeout(step);
    } catch (err) {
      this.bad.add(next);
      console.warn('[bz] dev-replay 步骤没走完:', this.flow.id, next + 1, step.name, err);
      notice(`第 ${next + 1} 步没走完：${step.name}`, 'warning');
    }
    this.index = next;
    this.busy = false;
    this.render();
  }

  private async stepBack(): Promise<void> {
    if (this.busy || this.index < 0) return;
    const step = this.flow.steps[this.index];
    if (!step.undo) { notice(`第 ${this.index + 1} 步不可回退`, 'warning'); return; }
    this.busy = true;
    try { await step.undo(this.ctx); this.index--; }
    catch (err) { console.warn('[bz] dev-replay 回退失败:', this.flow.id, this.index + 1, err); }
    this.busy = false;
    this.render();
  }

  /** 单步超时：卡住就跳过这一步（跳过去才知道后面坏没坏），别让整条流程停在半路 */
  private withTimeout(step: DevStep): Promise<void> {
    const ms = step.timeoutMs ?? STEP_TIMEOUT_MS;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`超过 ${ms}ms 没走完`)), ms);
      Promise.resolve()
        .then(() => step.run(this.ctx))
        .then(() => { clearTimeout(timer); resolve(); }, (e) => { clearTimeout(timer); reject(e); });
    });
  }

  /** ESC 清场：停表 → 反向跑 undo 链 → 流程 cleanup → 摘条摘监听 */
  destroy(restore: boolean): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.playing = false;
    window.removeEventListener('keydown', this.onKey, true);
    if (this.root) unregisterAlwaysOnTop(this.root);
    if (restore) {
      void (async () => {
        for (let i = this.index; i >= 0; i--) {
          const step = this.flow.steps[i];
          if (!step.undo) continue;
          try { await step.undo(this.ctx); } catch (err) { console.warn('[bz] dev-replay 清场回退失败:', i + 1, err); }
        }
        try { await this.flow.cleanup?.(); } catch (err) { console.warn('[bz] dev-replay cleanup 失败:', err); }
      })();
    }
    this.root?.remove();
    this.root = null;
    if (hud === this) hud = null;
  }

  private render(): void {
    if (this.lcd) this.lcd.innerHTML = `<small>STEP</small>${String(Math.max(this.index + 1, 0)).padStart(2, '0')} / ${String(this.flow.steps.length).padStart(2, '0')}`;
    if (this.lbl) {
      const cur = this.index >= 0 ? this.flow.steps[this.index].name : '未开始 · → 或空格开始';
      const state = this.busy ? '执行中…' : this.playing ? '自动播放中 · 空格暂停' : '已暂停 · 空格播放';
      this.lbl.innerHTML = `${escapeHtml(cur)}<small>${state}</small>`;
    }
    this.segEls.forEach((el, i) => {
      el.className = `seg${this.bad.has(i) ? ' bad' : ''}${i < this.index ? ' done' : ''}${i === this.index && this.playing ? ' cur' : ''}`;
    });
    if (this.playBtn) setIcon(this.playBtn, this.playing ? 'pause' : 'play');
    this.floatEls.forEach((el, i) => {
      el.className = `fi${this.bad.has(i) ? ' bad' : ''}${i < this.index ? ' done' : ''}${i === this.index ? ' on' : ''}`;
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 开机自动播（`<插件目录>/storage/debug-flow.json` 写 `{"flow":"<id>","auto":true}`）。
 * 文件不存在 = 常规启动，零行为差；JSON 坏了只在 console 提一句。
 */
export function autoStartDevFlow(plugin: any, storageDirPath: string): void {
  try {
    const adapter = (plugin?.app?.vault as { adapter?: any })?.adapter;
    if (!adapter?.read) return;
    const file = `${String(storageDirPath || '').replace(/\/+$/, '')}/debug-flow.json`;
    void (async () => {
      try {
        if (adapter.exists && !(await adapter.exists(file))) return;
        const raw = JSON.parse(await adapter.read(file)) as { flow?: unknown; auto?: unknown };
        const id = typeof raw.flow === 'string' ? raw.flow.trim() : '';
        if (!id) return;
        const flow = devFlows().find((f) => f.id === id);
        if (!flow) {
          console.warn('[bz] debug-flow.json 里的流程不存在：', id);
          return;
        }
        // 稍候一拍：布局与首屏初始化先落定，流程里的弹窗才不会被别的东西顶掉
        setTimeout(() => startReplay(plugin, flow, { auto: raw.auto !== false }), 900);
      } catch (e) {
        console.warn('[bz] debug-flow.json 解析失败：', e);
      }
    })();
  } catch {
    /* 拿不到 adapter 就当没有这回事 */
  }
}

// ==================== 命令注册 ====================

/** main.ts 在 __BZ_DEV__ 分支里调用：注册合集面板 + 每条流程的独立命令 */
export function registerDevFlows(plugin: any): void {
  const flows = devFlows();
  const app = plugin.app;
  for (const flow of flows) {
    app.commands.addCommand({
      id: `dev-${flow.id}`,
      name: `开发：${flow.name}`,
      callback: () => startReplay(plugin, flow),
    });
  }
  app.commands.addCommand({
    id: 'dev-flows',
    name: '开发：测试合集面板',
    callback: () => {
      // 命令面板式清单，按 domain 分组折叠收纳（原型稿 v2 一比一）
      const list = document.createElement('div');
      list.className = 'bz-dev-panel';
      const search = list.createDiv();
      search.className = 'search';
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = '筛选流程…';
      input.className = 'bz-dev-panel-input';
      search.appendChild(input);
      const kbds = search.createDiv();
      const k1 = kbds.createSpan({ text: '↑↓' });
      k1.className = 'kbd';
      const k2 = kbds.createSpan({ text: '↵' });
      k2.className = 'kbd';

      // 分组：保持 devFlows() 顺序，同 domain 归一组
      const groups: { domain: string; flows: DevFlow[] }[] = [];
      for (const flow of flows) {
        let g = groups.find((x) => x.domain === flow.domain);
        if (!g) { g = { domain: flow.domain, flows: [] }; groups.push(g); }
        g.flows.push(flow);
      }
      const groupEls: { root: HTMLElement; items: HTMLElement[]; name: string }[] = [];
      let seq = 0;
      for (const g of groups) {
        const grp = list.createDiv();
        grp.className = 'grp';
        const head = grp.createDiv();
        head.className = 'grp-head';
        head.createSpan({ text: g.domain });
        const cnt = head.createSpan({ text: String(g.flows.length) });
        cnt.className = 'cnt';
        const chev = head.createSpan();
        chev.className = 'chev';
        setIcon(chev, 'chevron-down');
        const items = grp.createDiv();
        items.className = 'grp-items';
        const rows: HTMLElement[] = [];
        for (const flow of g.flows) {
          seq++;
          const item = items.createDiv();
          item.className = 'pitem';
          item.dataset.text = `${flow.name} ${flow.domain}`.toLowerCase();
          item.createDiv({ text: String(seq).padStart(2, '0') });
          const body = item.createDiv();
          const t = body.createDiv({ text: flow.name });
          t.className = 't';
          const d = body.createDiv({ text: `${flow.steps.length} 步 · →←空格 ESC` });
          d.className = 'd';
          const go = item.createDiv();
          go.className = 'go';
          setIcon(go, 'chevron-right');
          item.onclick = () => { close(); startReplay(plugin, flow); };
          rows.push(item);
        }
        head.onclick = () => grp.classList.toggle('closed');
        groupEls.push({ root: grp, items: rows, name: g.domain });
      }
      // 筛选：命中条目保留、组内全空隐藏组头
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        for (const g of groupEls) {
          let visible = 0;
          for (const row of g.items) {
            const hit = !q || (row.dataset.text || '').includes(q);
            row.style.display = hit ? '' : 'none';
            if (hit) visible++;
          }
          g.root.style.display = visible === 0 ? 'none' : '';
        }
      });

      const { close } = uiModal({ content: list, title: 'bz 开发 · 测试合集', maxWidth: 480, head: true });
    },
  });
}
