/**
 * 测试合集 · 步骤回放器（开发工作流，ADR-0276）——只在测试库构建里存在。
 *
 * esbuild `define: { __BZ_DEV__ }` 为 false 时（主库 watch / production / 发布七步），
 * main.ts 里的动态 import 分支被整体摇树，本文件一个字节都不进产物。
 *
 * 形态（原型稿 .scratch/dev-replay-prototypes v2 一比一）：
 *   底部条 = 磁带计数器：mono LCD `STEP n/N`（hover 浮出完整步骤清单毛玻璃卡）+
 *   分段胶带（弹性能缩，多步不增高）+ 当前步名单行省略 + 运输键。
 *   →/← 前进退回（退回 = 调上一步 undo；无 undo 不可越过）· 空格 自动/暂停（1.5s 一步）·
 *   ESC 退出：反向跑 undo 链 + 流程 cleanup，还原进流程前的状态。
 *   步骤名写准——报修时「第 N 步〈步骤名〉没反应」即可精准定位。
 *
 * 合集面板 = uiModal + 命令面板式清单，按流程的 domain 字段分组折叠收纳。
 * 两者都是开发工具不进发布版，样式类 .bz-dev-* 见 core/styles.css 开发工具段。
 */
import { setIcon } from 'obsidian';
import { notice } from './notice';
import { openSetupWizard } from './setup-wizard';
import { setupDoneStorageKey, SETUP_DONE_FALLBACK_KEY } from './setup-state';
import { vaultBasePathOf } from './plugin-path';
import { registerAlwaysOnTop, unregisterAlwaysOnTop } from './z-order';
import { uiModal } from './ui/modal';

/** 一条可复现步骤：name 写准（报修引用点）；undo 缺省 = 该步不可回退 */
export interface DevStep {
  name: string;
  run: (ctx: ReplayCtx) => void | Promise<void>;
  undo?: (ctx: ReplayCtx) => void | Promise<void>;
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
 * 名字里带「初始化」；其后的步骤一律走 DOM：clickBtnByText 点真按钮、waitUntil 等真实反馈。
 */

/** 在屏幕上找文本含 text 的按钮（限定 bz 面板/弹层树内，避免误点 Obsidian 自家按钮） */
function clickBtnByText(text: string): HTMLElement | null {
  const scopes = document.querySelectorAll('.bz-panel-overlay, .bz-panel-frame, .bz-overlay-popup, body');
  for (const scope of scopes) {
    for (const b of scope.querySelectorAll('button')) {
      if ((b.textContent || '').includes(text) && !b.disabled) {
        b.click();
        return b;
      }
    }
  }
  return null;
}

/** 等条件成立（fn 返回 true），interval 250ms、超时抛错（找 bug 用：等待超时本身就是要看的现象） */
async function waitUntil(fn: () => boolean, timeoutMs = 8000, what = ''): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`等待超时：${what || '条件未在时限内成立'}`);
}

export function devFlows(): DevFlow[] {
  return [
    {
      id: 'setup-wizard',
      name: '首次引导重来',
      domain: '核心',
      steps: [
        {
          name: '清本库引导完成标记（设置 + localStorage 兜底键）',
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
        },
      ],
    },
  ];
}

// ==================== 回放器（单例底部条） ====================

const AUTO_STEP_MS = 1500;

let hud: ReplayHud | null = null;

export function startReplay(plugin: any, flow: DevFlow): void {
  if (hud) hud.destroy(true);
  hud = new ReplayHud(plugin, flow);
  hud.mount();
}

class ReplayHud {
  private index = -1; // 已执行到的步骤下标（-1 = 尚未开始）
  private playing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private ctx: ReplayCtx;
  private root: HTMLElement | null = null;
  private segEls: HTMLElement[] = [];
  private floatEls: HTMLElement[] = [];
  private lcd: HTMLElement | null = null;
  private lbl: HTMLElement | null = null;
  private playBtn: HTMLElement | null = null;
  private onKey = (e: KeyboardEvent) => this.handleKey(e);

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

  private async handleKey(e: KeyboardEvent): Promise<void> {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); await this.stepForward(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); await this.stepBack(); }
    else if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.togglePlay(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.destroy(true); }
    this.render();
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    if (this.playing) {
      this.timer = setInterval(() => { void this.stepForward(); }, AUTO_STEP_MS);
      void this.stepForward(); // 播下立即走一步，别干等一个周期
    } else if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.render();
  }

  private async stepForward(): Promise<void> {
    if (this.busy || this.index >= this.flow.steps.length - 1) { if (this.playing && this.index >= this.flow.steps.length - 1) this.togglePlay(); return; }
    this.busy = true;
    try { await this.flow.steps[this.index + 1].run(this.ctx); this.index++; }
    catch (err) { console.warn('[bz] dev-replay 步骤失败:', this.flow.id, this.index + 2, err); notice(`回放步骤失败：${this.flow.steps[this.index + 1].name}——${(err as Error)?.message || err}`, 'error'); }
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

  /** ESC 清场：停表 → 反向跑 undo 链 → 流程 cleanup → 摘条摘监听 */
  destroy(restore: boolean): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
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
      this.lbl.innerHTML = `${escapeHtml(cur)}<small>${this.playing ? '自动播放中 · 空格暂停' : '已暂停 · 空格播放'}</small>`;
    }
    this.segEls.forEach((el, i) => {
      el.className = `seg${i < this.index ? ' done' : ''}${i === this.index && this.playing ? ' cur' : ''}`;
    });
    if (this.playBtn) setIcon(this.playBtn, this.playing ? 'pause' : 'play');
    this.floatEls.forEach((el, i) => {
      el.className = `fi${i < this.index ? ' done' : ''}${i === this.index ? ' on' : ''}`;
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
