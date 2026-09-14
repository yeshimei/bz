/**
 * 挂载树白板（issues 317 画布二 / 319 入口与壳）—— knowledge 域**渲染层唯一接线处**。
 *
 * 定位：把四个上游模块接起来画一张全屏白板，不注册 ItemView、不用 Modal——
 * 沿用 `.bz-kb-mask` + `.bz-kb-window` 先例（自绘遮罩 + 居中大窗，`topifyZ` 提层；
 * 移动端真全屏 `.bz-panel-mtop`）。关闭后知识盒主窗仍在下一层。
 *
 * 上游契约（一律只看 `mount-types` 类型，不猜字段）：
 * - `mount-data`：`buildMountTree(cardPath, { direction, ctx })`——边恒 `depth(to) > depth(from)`（不许再剪线），
 *   同名文献 `attached: true` 且**无边**、`parent` = 所属卡片；`missing` 节点灰、不展开、`id` 是原始目标文本；
 *   `body` 口径 card/note = 整篇、head/para = 片段、image/video = null；
 * - `mount-layout`：`layoutTree` 只吃我们量出的 w/h（必经接缝），`pos[id]` = **左上角**（含 PAD），
 *   **正常路径不传 `viewport`**（传了没有零重叠保证）；`maxNodes` 默认 120，超了进 `culled`（无坐标 → 跳过渲染）；
 * - `mount-route`：`routeEdges` 的 `anchor` = 锚点圆点世界坐标（缺省按源盒左上角兜底），`d` 直接塞 `<path d>`，
 *   `d === ''` 跳过；`fallback: true`（>120 盒 / 直连 / A* 无解 / 端点缺盒）→ **虚线 + 低透明度**，不当正常路由；
 * - `mount-suggest`：`generateSuggestions`（`off`/`no-index`/`no-ai` 是降级，不冒充「已缓存」）、
 *   `mergeSuggestions`（幽灵节点 `ai:<target>`、从根扯虚线）、`markSuggestion`（只动缓存留档）。
 *
 * 界面口径（spec §界面 + 原型 `transformer-real.html` 已验收观感）：
 * - 顶栏：面包屑（沿 `parent` 上溯，可点换根）+ 方向（下游 / 上游）+「重新生成」+ 建议状态；
 * - 画布：力导向网状 + 就近出盒 + A* 避障曲线；卡片完整正文常显（点标题折/展，折叠态只存内存）；
 *   文献吸附在所属卡片正下方 8px、**不拉线、不参与血缘高亮**；
 * - 交互：点卡血缘高亮（祖先琥珀 / 后代青，再点取消）、悬停三方联动（双链文字 / 连线 / 目标卡）、
 *   右键（移动端长按）菜单、缩放器 ＋ − ⟲、拖拽平移、滚轮/双指缩放（锚定指针）；
 * - **不做**卡片工具条、**不做**双击开笔记（issue 317 明确）。
 *
 * 「固定」是**唯一允许改正文**的路径（用户显式动作）：`markSuggestion` 留档 + 锚点处写 `[[目标]]`
 * （以锚点文本重定位，找不到就追加正文末尾；AI 绝不自动写）。纯函数 `insertLinkAtAnchor` 单测。
 *
 * 依赖方向（ADR-0002）：core ← mount-data/layout/route/suggest ← 本文件（渲染层，唯一接线处）。
 * 本文件不碰 `ui.ts`；入口按钮与命令由 ui.ts / main.ts 反向 import 本模块。
 */
import { Component, MarkdownRenderer } from 'obsidian';
import { getApp } from '../core/app';
import { escManager, type EscHandle } from '../core/esc-manager';
import { isMobileEnv } from '../core/mobile';
import { notice, type NoticeType } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { enqueueFileTask } from '../core/storage';
import { escapeHtml } from '../core/utils';
import { topifyZ } from '../core/z-order';
import { buildMountTree, mountCtx, relocateAnchor, type MountCtx } from './mount-data';
import { LAYOUT_PARAMS, layoutTree } from './mount-layout';
import { routeEdges } from './mount-route';
import { generateSuggestions, markSuggestion, mergeSuggestions } from './mount-suggest';
import type {
  AnchorRef,
  MountDirection,
  MountEdge,
  MountKind,
  MountNode,
  MountSuggestion,
  MountTree,
  RoutedEdge,
  SuggestRun,
  SuggestStatus,
} from './mount-types';

/* ------------------------------------------------------------------ *
 * 常量（视觉数值照原型；类名一律 bz-kb-mt-* 前缀，避免污染全局）
 * ------------------------------------------------------------------ */

const MASK_ID = 'bz-kb-mt-mask';
const WIN_ID = 'bz-kb-mt-window';
const ESC_ID = 'bz-kb-mt';

/** 画布测量兜底（jsdom / 隐藏容器里 clientWidth 恒 0） */
const CANVAS_FALLBACK_W = 960;
const CANVAS_FALLBACK_H = 620;
/** 缩放档（原型：0.3 ~ 2.5，适应窗口上限 1.15） */
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 1.2;
const ZOOM_FIT_MAX = 1.15;
const FIT_PAD = 90;
/** 拖拽判定阈值（原型的 6px：超过即视为拖拽，不触发选择） */
const DRAG_SLOP = 6;
/** 移动端长按弹菜单（core/dom longPress 同口径） */
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;
/** 文献吸附：与所属卡片留 8px 缝，多篇垂直堆叠 */
const DOCK_GAP = 8;

/** 卡片宽度（原型逐卡内联宽度的档位化：主卡 560 / 卡片 470 / 整篇 430 / 标题 400 / 段落 380 / 图与视频 320） */
const WIDTH_ROOT = 560;
const WIDTH_BY_KIND: Record<MountKind, number> = {
  card: 470,
  note: 430,
  head: 400,
  para: 380,
  image: 320,
  video: 320,
};
/** 内容高度兜底（量不到时用；真实环境高度由正文决定） */
const HEIGHT_BY_KIND: Record<MountKind, number> = {
  card: 220,
  note: 190,
  head: 170,
  para: 160,
  image: 130,
  video: 130,
};
/** 线色 = **目标内容形态**（原型 §3.2；值走主题变量兜底链，--bz-kb-mt-c-* 定义在本域 styles.css） */
const KIND_COLOR: Record<MountKind, string> = {
  note: '#5dcaa5',
  head: '#6ea8e8',
  card: '#a99ef0',
  para: '#8b8c94',
  image: '#d9a441',
  video: '#d4537e',
};
/** 形态短名（卡片头上的小徽章） */
const KIND_LABEL: Record<MountKind, string> = {
  card: '卡片',
  note: '整篇',
  head: '标题',
  para: '段落',
  image: '图片',
  video: '视频',
};
/** 来源标签（卡片头上的来源徽章） */
const SOURCE_LABEL: Record<string, string> = {
  self: '主卡',
  sameName: '文献',
  link: '双链',
  related: '关联',
  manual: '手动',
  ai: 'AI 建议',
};

/* ------------------------------------------------------------------ *
 * 对外 API
 * ------------------------------------------------------------------ */

/** 依赖接缝（测试注入；生产走默认实现）。`notice` 第二参 = core/notice 语义档（域内先例 ui.ts） */
export interface MountCanvasDeps {
  /** 尺寸测量接缝：jsdom 里 offsetWidth 恒 0，测试注入固定尺寸；默认读 DOM */
  measure?: (el: HTMLElement, kind: MountKind) => { w: number; h: number };
  /** 通知（测试用；`type` 缺省 info，成功动作走 success） */
  notice?: (msg: string, type?: NoticeType) => void;
  /** 打开笔记（测试用） */
  openNote?: (path: string) => void;
  /** 写剪贴板（测试用） */
  writeClipboard?: (text: string) => Promise<void>;
}

interface ResolvedDeps {
  measure: (el: HTMLElement, kind: MountKind) => { w: number; h: number };
  notice: (msg: string, type?: NoticeType) => void;
  openNote: (path: string) => void;
  writeClipboard: (text: string) => Promise<void>;
}

/** 白板运行态（模块单例：一张白板一个状态，关闭即复位） */
interface CanvasState {
  cardPath: string;
  direction: MountDirection;
  deps: ResolvedDeps;
  ctx: MountCtx;
  /** 当前渲染的树（已并入建议幽灵节点） */
  tree: MountTree;
  /** 建议链路产物（顶栏状态；null = 未跑） */
  run: SuggestRun | null;
  /** 幽灵节点 id → 建议（右键「固定 / 取消 / 看理由」用） */
  ghosts: Map<string, MountSuggestion>;
  /** 载入令牌：换根 / 重跑期间旧结果作废 */
  token: number;
  loading: boolean;
  /** 量出的尺寸（world 坐标换算与路由入参） */
  sizes: Map<string, { w: number; h: number }>;
  pos: Record<string, { x: number; y: number }>;
  world: { w: number; h: number };
  /** 已渲染的边（key = from\0to） */
  edges: Array<RoutedEdge & { key: string; color: string; suggested: boolean }>;
  /** 卡片元素（id → el） */
  cards: Map<string, HTMLElement>;
  /** 折叠的节点（只存内存；文献默认折起） */
  folded: Set<string>;
  selected: string | null;
  scale: number;
  tx: number;
  ty: number;
  drag: { x: number; y: number; tx: number; ty: number } | null;
  downPt: { x: number; y: number } | null;
  downNode: HTMLElement | null;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  longPressFired: boolean;
  pinch: { d: number; scale: number } | null;
  menu: HTMLElement | null;
  esc: EscHandle | null;
  mask: HTMLElement;
  win: HTMLElement;
  canvasEl: HTMLElement;
  worldEl: HTMLElement;
  svg: SVGSVGElement;
  loadingEl: HTMLElement;
}

let state: CanvasState | null = null;

/* ------------------------------------------------------------------ *
 * 纯函数 helper（导出单测：不碰 DOM、不看时间）
 * ------------------------------------------------------------------ */

/** 形态短名 */
export function mountKindLabel(kind: MountKind): string {
  return KIND_LABEL[kind] ?? KIND_LABEL.card;
}

/** 连线色（主题变量兜底链：styles.css 里 --bz-kb-mt-c-* 可被主题覆写） */
export function mountKindColor(kind: MountKind): string {
  const fallback = KIND_COLOR[kind] ?? KIND_COLOR.para;
  return `var(--bz-kb-mt-c-${kind}, ${fallback})`;
}

/** 缩放钳制（0.3 ~ 2.5） */
export function clampMountScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
}

/** 建议状态文案（顶栏；`generating` 由渲染层自己管，不会被 generateSuggestions 返回） */
export function mountStatusText(status: SuggestStatus): string {
  switch (status) {
    case 'cached':
      return '已缓存建议';
    case 'fresh':
      return '新生成建议';
    case 'off':
      return '自动建议已关闭';
    case 'no-index':
      return '未建向量索引 · 只画双链';
    case 'no-ai':
      return 'AI 不可用 · 只画双链';
    case 'no-answer':
      return 'AI 未给出可用建议 · 只画双链（可点「重新生成」）';
    default:
      return '生成中 · 等建议齐再开';
  }
}

/** 双链文本（复制用；head/para 用 id 带上 `#子路径`，图/视频走嵌入语法） */
export function mountLinkText(node: Pick<MountNode, 'id' | 'path' | 'kind' | 'missing'>): string {
  const raw = String((node.missing ? node.path : node.id) || node.path || '').trim();
  const core = raw.replace(/\.md$/i, '');
  if (node.kind === 'image' || node.kind === 'video') return `![[${raw}]]`;
  return `[[${core}]]`;
}

/** 面包屑链：沿 `parent` 从主卡到目标节点（目标不在树上 → 只有主卡） */
export function crumbTrail(nodes: MountNode[], id: string | null): MountNode[] {
  if (!id) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: MountNode[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id) ?? null;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parent ? byId.get(cur.parent) ?? null : null;
  }
  return chain;
}

/** 血缘集合（祖先 / 后代；自身计入两者，与原型 relSets 同口径）。边 = 树边。 */
export function lineageOf(
  edges: MountEdge[],
  id: string,
): { anc: Set<string>; desc: Set<string> } {
  const push = (map: Map<string, string[]>, key: string, val: string): void => {
    const list = map.get(key);
    if (list) list.push(val);
    else map.set(key, [val]);
  };
  const par = new Map<string, string[]>();
  const chd = new Map<string, string[]>();
  for (const e of edges ?? []) {
    if (!e) continue;
    push(chd, e.from, e.to);
    push(par, e.to, e.from);
  }
  const walk = (map: Map<string, string[]>): Set<string> => {
    const out = new Set<string>([id]);
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const next of map.get(cur) ?? []) {
        if (out.has(next)) continue;
        out.add(next);
        stack.push(next);
      }
    }
    return out;
  };
  return { anc: walk(par), desc: walk(chd) };
}

/** 锚点文本的候选匹配串：原文（可能含 `[[…]]`）+ 双链显示文本（渲染后 DOM 里只剩显示文本） */
export function anchorNeedles(anchor: AnchorRef | null | undefined): string[] {
  const raw = String(anchor?.text ?? '');
  if (!raw) return [];
  const out = [raw];
  if (raw.includes('[[')) {
    const display = raw.replace(/!?\[\[([^\[\]]+)\]\]/g, (_m, inner: string) => {
      const afterAlias = inner.includes('|') ? inner.slice(inner.lastIndexOf('|') + 1) : inner;
      const noBlock = afterAlias.includes('^') ? afterAlias.slice(0, afterAlias.indexOf('^')) : afterAlias;
      const noHead = noBlock.includes('#') ? noBlock.slice(noBlock.lastIndexOf('#') + 1) : noBlock;
      return noHead || afterAlias || inner;
    });
    if (display && display !== raw) out.push(display);
  }
  return out;
}

/** 目标是否已在正文里是双链（`[[目标` / `[[目标|…` / `[[目标#…`；幂等闸） */
function alreadyLinked(body: string, link: string): boolean {
  const target = String(link ?? '').trim().replace(/\.md$/i, '');
  if (!target) return true;
  return new RegExp(`!?\\[\\[${escapeRegExp(target)}(\\||#|\\]\\])`, 'i').test(body);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 锚点处写入双链（「固定」动作的纯函数加工，唯一允许改正文的路径）。
 * 口径：① 目标已是双链 → 原样返回（幂等）；② 精确/去空白重定位锚点文本 → 紧随其后插入；
 * ③ 锚点文本因清洗（双链转显示文本 / 去标记）对不上 → 拿前 10/6/4/2 个非空字符逐级找句首，
 *    插到该句句读之后；④ 都找不到 → 追加到正文末尾（前置换行）；frontmatter 原样保留（调用方整篇传入）。
 */
export function insertLinkAtAnchor(body: string, anchor: AnchorRef | null | undefined, link: string): string {
  const src = String(body ?? '');
  const wiki = `[[${String(link ?? '').trim().replace(/\.md$/i, '')}]]`;
  if (wiki === '[[]]') return src;
  if (alreadyLinked(src, link)) return src;
  const text = String(anchor?.text ?? '').trim();
  if (text) {
    const at = relocateAnchor(src, { from: anchor?.from ?? 0, to: anchor?.to ?? 0, text });
    if (at !== null && at >= 0) return src.slice(0, at + text.length) + wiki + src.slice(at + text.length);
    const compact = text.replace(/\s+/g, '');
    const flat = src.replace(/\s+/g, '');
    for (const len of [10, 6, 4, 2]) {
      const head = compact.slice(0, len);
      if (head.length < len && len > 2) continue; // 锚点本身就短：等更短的档位再试
      const hit = head ? flat.indexOf(head) : -1;
      if (hit < 0) continue;
      // 去空白坐标 → 原文坐标：逐字符对齐
      let count = 0;
      let pos = -1;
      for (let i = 0; i < src.length; i++) {
        if (/\s/.test(src[i])) continue;
        if (count === hit) {
          pos = i;
          break;
        }
        count++;
      }
      if (pos < 0) continue;
      // 插到该句句读之后（最多前看 300 字），读起来像「这句话挂到那张卡」
      const tail = src.slice(pos, Math.min(src.length, pos + 300));
      const m = /[。！？；…!?;\n]/.exec(tail);
      const end = m ? pos + m.index + 1 : Math.min(src.length, pos + head.length);
      return src.slice(0, end) + wiki + src.slice(end);
    }
  }
  const trimmed = src.replace(/\s+$/, '');
  return `${trimmed}${trimmed ? '\n' : ''}${wiki}\n`;
}

/* ------------------------------------------------------------------ *
 * 默认依赖（生产路径）
 * ------------------------------------------------------------------ */

function defaultDeps(over?: MountCanvasDeps): ResolvedDeps {
  return {
    measure:
      over?.measure ??
      ((el: HTMLElement) => ({ w: el.offsetWidth || 0, h: el.offsetHeight || 0 })),
    notice: over?.notice ?? ((msg: string, type?: NoticeType) => notice(msg, type ?? 'info')),
    openNote:
      over?.openNote ??
      ((path: string) => {
        try {
          void getApp()?.workspace?.openLinkText?.(path, '', false, { active: true });
        } catch {
          /* 打开失败（路径失效 / 无工作区）静默：节点本身已是灰节点语义 */
        }
      }),
    writeClipboard: over?.writeClipboard ?? ((text: string) => writeClipboard(text)),
  };
}

/** 剪贴板写入（navigator.clipboard 优先，退回 textarea + execCommand） */
async function writeClipboard(text: string): Promise<void> {
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return;
    }
  } catch {
    /* 权限被拒 → 退回兜底路径 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand?.('copy');
    ta.remove();
  } catch {
    /* 完全不可用：调用方已给通知提示 */
  }
}

/* ------------------------------------------------------------------ *
 * 壳（遮罩 + 大窗；幂等创建，关闭只切 display）
 * ------------------------------------------------------------------ */

function buildShell(): CanvasState | null {
  if (state) return state;
  if (typeof document === 'undefined') return null;
  const mask = document.createElement('div');
  mask.id = MASK_ID;
  mask.className = 'bz-kb-mask bz-kb-mt-mask';
  mask.style.display = 'none';
  mask.addEventListener('click', () => closeMountTree());

  const win = document.createElement('div');
  win.id = WIN_ID;
  win.className = 'bz-kb-window kb bz-kb-mt-window';
  if (isMobileEnv()) win.classList.add('bz-panel-mtop');
  win.style.display = 'none';
  win.innerHTML = `
    <div class="bz-kb-mt-top">
      <div class="bz-kb-mt-crumbs" id="bz-kb-mt-crumbs"></div>
      <div class="bz-kb-mt-dir" id="bz-kb-mt-dir"></div>
      <button class="bz-kb-mt-btn" data-mt-act="refresh" title="重跑当前主卡的挂载建议">重新生成</button>
      <div class="bz-kb-mt-status" id="bz-kb-mt-status"></div>
      <button class="bz-kb-mt-close bz-touch-target bz-touch-target--lg" data-mt-act="close" title="关闭挂载树">✕</button>
    </div>
    <div class="bz-kb-mt-canvas" id="bz-kb-mt-canvas">
      <div class="bz-kb-mt-world" id="bz-kb-mt-world"></div>
      <div class="bz-kb-mt-loading" id="bz-kb-mt-loading" style="display:none">生成中 · 等建议齐再开白板…</div>
    </div>
    <div class="bz-kb-mt-zoomer">
      <button class="bz-kb-mt-zbtn bz-touch-target" data-mt-act="zoom-in" title="放大">＋</button>
      <button class="bz-kb-mt-zbtn bz-touch-target" data-mt-act="zoom-out" title="缩小">−</button>
      <button class="bz-kb-mt-zbtn bz-touch-target" data-mt-act="zoom-fit" title="适应窗口">⟲</button>
    </div>
    <div class="bz-kb-mt-hint" id="bz-kb-mt-hint"></div>`;
  document.body.appendChild(mask);
  document.body.appendChild(win);

  const canvasEl = win.querySelector<HTMLElement>('#bz-kb-mt-canvas')!;
  const worldEl = win.querySelector<HTMLElement>('#bz-kb-mt-world')!;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'bz-kb-mt-lines');
  worldEl.appendChild(svg);

  const st: CanvasState = {
    cardPath: '',
    direction: 'downstream',
    deps: defaultDeps(),
    ctx: mountCtx(),
    tree: { root: '', direction: 'downstream', nodes: [], edges: [] },
    run: null,
    ghosts: new Map(),
    token: 0,
    loading: false,
    sizes: new Map(),
    pos: {},
    world: { w: CANVAS_FALLBACK_W, h: CANVAS_FALLBACK_H },
    edges: [],
    cards: new Map(),
    folded: new Set(),
    selected: null,
    scale: 1,
    tx: 0,
    ty: 0,
    drag: null,
    downPt: null,
    downNode: null,
    longPressTimer: null,
    longPressFired: false,
    pinch: null,
    menu: null,
    esc: null,
    mask,
    win,
    canvasEl,
    worldEl,
    svg,
    loadingEl: win.querySelector<HTMLElement>('#bz-kb-mt-loading')!,
  };
  state = st;
  bindShellEvents(st);
  return st;
}

/** 顶栏/缩放器点击（委托）+ 画布交互（选择 / 平移 / 右键 / 长按 / 缩放） */
function bindShellEvents(st: CanvasState): void {
  st.win.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement)?.closest?.('[data-mt-act]') as HTMLElement | null;
    if (!btn) return;
    const act = btn.getAttribute('data-mt-act') || '';
    if (act === 'close') closeMountTree();
    else if (act === 'refresh') void reload(true);
    else if (act === 'zoom-in') zoomAtCenter(ZOOM_STEP);
    else if (act === 'zoom-out') zoomAtCenter(1 / ZOOM_STEP);
    else if (act === 'zoom-fit') fit();
    else if (act === 'crumb') {
      const path = btn.getAttribute('data-path') || '';
      const id = btn.getAttribute('data-id') || '';
      if (!path) return;
      if (id === st.tree.root) {
        // 点的是当前主卡（链首）：不重开，但要把选中态收掉（否则点了没反应）
        st.selected = null;
        applySelection(st);
        renderTop(st);
        return;
      }
      void openMountTree(path, { direction: st.direction, deps: depsOf(st) });
    } else if (act === 'build-index') requestBuildIndex(st);
  });

  const canvas = st.canvasEl;
  canvas.addEventListener('pointerdown', (e: any) => {
    if (st.menu) closeMenu();
    st.longPressFired = false;
    st.downPt = { x: num(e.clientX), y: num(e.clientY) };
    st.downNode = (e.target?.closest?.('.bz-kb-mt-node') as HTMLElement) ?? null;
    st.drag = { x: num(e.clientX), y: num(e.clientY), tx: st.tx, ty: st.ty };
    try {
      canvas.setPointerCapture?.(e.pointerId);
    } catch {
      /* jsdom / 老内核无指针捕获 */
    }
    // 移动端长按 → 菜单（拖拽 / 抬起取消）
    if (isMobileEnv() && st.downNode) {
      const x = num(e.clientX);
      const y = num(e.clientY);
      const id = st.downNode.getAttribute('data-mt-id') || '';
      st.longPressTimer = setTimeout(() => {
        st.longPressTimer = null;
        st.longPressFired = true;
        openNodeMenu(id, x, y);
      }, LONG_PRESS_MS);
    }
  });
  canvas.addEventListener('pointermove', (e: any) => {
    if (!st.drag) return;
    const dx = num(e.clientX) - st.drag.x;
    const dy = num(e.clientY) - st.drag.y;
    if (st.longPressTimer && Math.hypot(dx, dy) > LONG_PRESS_SLOP) cancelLongPress(st);
    st.tx = st.drag.tx + dx;
    st.ty = st.drag.ty + dy;
    applyTransform(st);
  });
  const endDrag = () => {
    cancelLongPress(st);
    st.drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('click', (e: any) => {
    if (st.longPressFired) {
      st.longPressFired = false;
      return;
    }
    if (st.downPt && Math.hypot(num(e.clientX) - st.downPt.x, num(e.clientY) - st.downPt.y) > DRAG_SLOP) return;
    const nodeEl = (e.target?.closest?.('.bz-kb-mt-node') as HTMLElement) ?? st.downNode;
    const id = nodeEl?.getAttribute('data-mt-id') || '';
    st.selected = id && st.selected !== id ? id : null;
    // 文献（吸附）不参与血缘高亮：选中吸附项只定位面包屑
    applySelection(st);
    renderTop(st);
  });

  canvas.addEventListener(
    'wheel',
    (e: any) => {
      e.preventDefault?.();
      const rect = canvas.getBoundingClientRect?.() ?? ({ left: 0, top: 0 } as any);
      zoomAt(st, num(e.clientX) - num(rect.left), num(e.clientY) - num(rect.top), (e.deltaY ?? 0) < 0 ? 1.1 : 0.9);
    },
    { passive: false },
  );

  canvas.addEventListener('contextmenu', (e: any) => {
    e.preventDefault?.();
    const nodeEl = (e.target?.closest?.('.bz-kb-mt-node') as HTMLElement) ?? null;
    if (nodeEl) {
      openNodeMenu(nodeEl.getAttribute('data-mt-id') || '', num(e.clientX), num(e.clientY));
      return;
    }
    const edgeEl = e.target?.closest?.('.bz-kb-mt-edge') as SVGElement | null;
    const key = edgeEl?.getAttribute('data-mt-key') || '';
    const hit = st.edges.find((x) => x.key === key);
    if (hit) {
      const targetId = st.direction === 'downstream' ? hit.to : hit.from;
      openNodeMenu(targetId, num(e.clientX), num(e.clientY));
      return;
    }
    if (st.menu) closeMenu();
  });

  // 双指缩放（移动端）：两指距离比 → 以两指中点为锚
  canvas.addEventListener(
    'touchstart',
    (e: any) => {
      if (e.touches?.length === 2) {
        cancelLongPress(st);
        st.pinch = { d: touchDistance(e.touches), scale: st.scale };
      }
    },
    { passive: true },
  );
  canvas.addEventListener(
    'touchmove',
    (e: any) => {
      if (!st.pinch || e.touches?.length !== 2) return;
      e.preventDefault?.();
      const d = touchDistance(e.touches);
      if (!st.pinch.d) return;
      const rect = canvas.getBoundingClientRect?.() ?? ({ left: 0, top: 0 } as any);
      const cx = (num(e.touches[0].clientX) + num(e.touches[1].clientX)) / 2 - num(rect.left);
      const cy = (num(e.touches[0].clientY) + num(e.touches[1].clientY)) / 2 - num(rect.top);
      const want = st.pinch.scale * (d / st.pinch.d);
      zoomAtAbsolute(st, cx, cy, want);
    },
    { passive: false },
  );
  canvas.addEventListener('touchend', () => {
    st.pinch = null;
  });

  // 悬停三方联动（双链文字 / 连线 / 目标卡）：mouseover 委托，元素按 data-mt-* 自带身份
  st.win.addEventListener('mouseover', (e: any) => {
    const el = e.target as HTMLElement;
    const dot = el?.closest?.('[data-mt-edge]') as HTMLElement | null;
    if (dot) {
      setHover(st, dot.getAttribute('data-mt-edge') || '', true);
      return;
    }
    const edgeEl = el?.closest?.('.bz-kb-mt-edge') as SVGElement | null;
    if (edgeEl) {
      setHover(st, edgeEl.getAttribute('data-mt-key') || '', true);
      return;
    }
    const nodeEl = el?.closest?.('.bz-kb-mt-node') as HTMLElement | null;
    if (nodeEl) setHover(st, edgeKeyTo(st, nodeEl.getAttribute('data-mt-id') || ''), true);
  });
  st.win.addEventListener('mouseout', (e: any) => {
    const el = e.target as HTMLElement;
    if (el?.closest?.('[data-mt-edge], .bz-kb-mt-edge, .bz-kb-mt-node')) setHover(st, '', false);
  });
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * 显示名：data 层的非根节点标题走 baseName（带 `.md`），白板上统一剥掉——
 * 卡片名是挂载点身份，界面上不该出现后缀（标题片段 / 图片视频文件名保持原样）。
 */
function displayTitle(node: MountNode): string {
  return String(node.title || node.path || node.id).replace(/\.md$/i, '');
}

function touchDistance(touches: any): number {
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(num(a.clientX) - num(b.clientX), num(a.clientY) - num(b.clientY));
}

function cancelLongPress(st: CanvasState): void {
  if (st.longPressTimer) {
    clearTimeout(st.longPressTimer);
    st.longPressTimer = null;
  }
}

/** 依赖对象回传（换根时沿用同一套注入） */
function depsOf(st: CanvasState): MountCanvasDeps {
  return {
    measure: st.deps.measure,
    notice: st.deps.notice,
    openNote: st.deps.openNote,
    writeClipboard: st.deps.writeClipboard,
  };
}

/* ------------------------------------------------------------------ *
 * 开关
 * ------------------------------------------------------------------ */

/** 白板是否打开（mask 可见即视为打开） */
export function mountTreeOpen(): boolean {
  return !!state && state.mask.style.display !== 'none';
}

/** 关闭白板（知识盒主窗留在下层；DOM 复用，只切 display） */
export function closeMountTree(): void {
  const st = state;
  if (!st) return;
  closeMenu();
  cancelLongPress(st);
  st.mask.style.display = 'none';
  st.win.style.display = 'none';
  st.selected = null;
  st.token++; // 在途载入作废
  // 关闭即收掉「生成中」遮罩：在途载入被 token 作废后没人再负责隐藏它（关掉再开会看到永久「生成中」）
  st.loading = false;
  st.loadingEl.style.display = 'none';
  st.esc?.unregister();
  st.esc = null;
}

/**
 * 打开挂载树白板（主卡 = `cardPath`）。
 * - 同一主卡同方向重复调用 = 抬层；
 * - `force` = 显式重跑建议（跳过缓存）；顶部「重新生成」同路径；
 * - 建议链路：命中缓存秒开；未命中顶栏「生成中」等生成完再画；`no-index` / `no-ai` **不等**（直接开，
 *   只画双链 + 顶栏提示；`no-index` 附「去建索引」入口，**绝不自动建索引**）；开关关闭显示「自动建议已关闭」。
 */
export async function openMountTree(
  cardPath: string,
  opts?: { direction?: MountDirection; force?: boolean; deps?: MountCanvasDeps },
): Promise<void> {
  const path = String(cardPath ?? '').trim();
  const st = buildShell();
  if (!st) return;
  if (!path) {
    defaultDeps(opts?.deps).notice('看挂载树：这张卡没有可解析的路径');
    return;
  }
  const direction: MountDirection = opts?.direction === 'upstream' ? 'upstream' : 'downstream';
  st.deps = defaultDeps(opts?.deps);
  topifyZ(st.mask, st.win);
  st.mask.style.display = 'block';
  st.win.style.display = 'flex';
  if (!st.esc) {
    st.esc = escManager.register(ESC_ID, {
      isVisible: () => mountTreeOpen() || !!st.menu,
      close: () => {
        if (st.menu) closeMenu();
        else closeMountTree();
      },
    });
  }
  // 「抬层」早退只认**同一张树**：`st.cardPath` 可能在上一轮载入被换根后与画布不一致
  // （换根 → 载入途中关闭 → 再开同一路径），只看 cardPath 会把上一张卡的画布当成新结果端出去。
  const sameTree =
    path === st.cardPath && direction === st.direction && st.tree.root === path && st.tree.nodes.length > 0;
  if (sameTree && !st.loading && !opts?.force) {
    st.loadingEl.style.display = 'none';
    renderTop(st);
    return;
  }
  st.cardPath = path;
  st.direction = direction;
  st.selected = null;
  st.folded = new Set();
  await load(st, !!opts?.force);
}

/** 重跑当前主卡的建议（命令 `bz-knowledge-mount-refresh`；无白板 / 无主卡时给通知） */
export async function refreshMountTree(): Promise<void> {
  const st = state;
  if (!st || !mountTreeOpen()) {
    notice('重跑挂载建议：先打开一张挂载树白板', 'info');
    return;
  }
  await reload(true);
}

async function reload(force: boolean): Promise<void> {
  const st = state;
  if (!st) return;
  await load(st, force);
}

/* ------------------------------------------------------------------ *
 * 载入（树 + 建议 → 渲染）
 * ------------------------------------------------------------------ */

async function load(st: CanvasState, force: boolean): Promise<void> {
  const token = ++st.token;
  const path = st.cardPath;
  const direction = st.direction;
  st.loading = true;
  st.edges = [];
  st.cards.clear();
  st.ghosts = new Map();
  st.run = null;
  st.loadingEl.style.display = '';
  renderTop(st);

  const ctx = mountCtx();
  st.ctx = ctx;
  let tree: MountTree;
  try {
    tree = await buildMountTree(path, { direction, ctx });
  } catch {
    tree = { root: path, direction, nodes: [], edges: [] };
  }
  if (token !== st.token) return;

  // 建议链路：开关关闭就不调（顶栏明说）
  const autoOn = (tryGetSettings() as { knowledgeMountAutoSuggest?: boolean } | null)?.knowledgeMountAutoSuggest !== false;
  let run: SuggestRun | null = null;
  if (autoOn) {
    run = await runSuggest(st, path, ctx, force);
    if (token !== st.token) return;
  }
  st.run = run;
  st.tree = tree;
  if (run && run.suggestions.length) {
    for (const s of run.suggestions) {
      if (s?.target) st.ghosts.set('ai:' + s.target, s);
    }
    st.tree = mergeSuggestions(tree, run);
  }
  st.loading = false;
  st.loadingEl.style.display = 'none';
  await renderCanvas(st);
  renderTop(st);
  fit();
}

/** 建议生成（异常一律按 AI 不可用降级，不打断白板） */
async function runSuggest(st: CanvasState, path: string, ctx: MountCtx, force: boolean): Promise<SuggestRun> {
  try {
    return await generateSuggestions(
      path,
      { app: ctx.app, cardboxDir: ctx.cardboxDir, litDir: ctx.litDir },
      { force },
    );
  } catch {
    return { status: 'no-ai', suggestions: [] };
  }
}

/** 只重算树（不动建议缓存）：固定 / 取消后本地刷新用 */
async function rebuildTreeOnly(st: CanvasState): Promise<void> {
  const token = ++st.token;
  const path = st.cardPath;
  let tree: MountTree;
  try {
    tree = await buildMountTree(path, { direction: st.direction, ctx: st.ctx });
  } catch {
    return;
  }
  if (token !== st.token) return;
  st.tree = st.run && st.run.suggestions.length ? mergeSuggestions(tree, st.run) : tree;
  await renderCanvas(st);
  renderTop(st);
}

/* ------------------------------------------------------------------ *
 * 顶栏
 * ------------------------------------------------------------------ */

function renderTop(st: CanvasState): void {
  const rootNode = st.tree.nodes.find((n) => n.id === st.tree.root) ?? null;
  const crumbs = crumbTrail(st.tree.nodes, st.selected ?? st.tree.root);
  const chain = crumbs.length ? crumbs : rootNode ? [rootNode] : [];
  st.win.querySelector<HTMLElement>('#bz-kb-mt-crumbs')!.innerHTML = chain
    .map((n, i) => {
      const last = i === chain.length - 1;
      const label = escapeHtml(displayTitle(n));
      const sep = i === 0 ? '' : '<span class="bz-kb-mt-sep">›</span>';
      if (last && !st.selected) return `${sep}<span class="bz-kb-mt-crumb is-cur">${label}</span>`;
      return `${sep}<button class="bz-kb-mt-crumb bz-touch-target" data-mt-act="crumb" data-path="${escapeHtml(n.path)}" data-id="${escapeHtml(n.id)}" title="以《${label}》为主卡重开">${label}</button>`;
    })
    .join('');

  const dirEl = st.win.querySelector<HTMLElement>('#bz-kb-mt-dir')!;
  dirEl.textContent = st.direction === 'upstream' ? '上游 · 谁挂了我' : '下游 · 我挂了谁';
  dirEl.setAttribute('data-mt-dir', st.direction);

  const statusEl = st.win.querySelector<HTMLElement>('#bz-kb-mt-status')!;
  const culled = st.sizes.size ? countCulled(st) : 0;
  let text: string;
  let extra = '';
  if (st.loading) text = mountStatusText('generating');
  else if (st.run) text = mountStatusText(st.run.status);
  else text = '本卡建议未跑（自动建议已关闭）';
  if (!st.loading && culled > 0) extra = `<span class="bz-kb-mt-kind">· 图大，已按 ${LAYOUT_PARAMS.MAX_NODES} 张封顶</span>`;
  statusEl.innerHTML = `<span class="bz-kb-mt-status-t">${escapeHtml(text)}</span>${extra}${
    !st.loading && st.run?.status === 'no-index'
      ? '<button class="bz-kb-mt-btn is-mini" data-mt-act="build-index" title="打开第二大脑重建索引（绝不自动建）">去建索引</button>'
      : ''
  }`;

  const hint = st.win.querySelector<HTMLElement>('#bz-kb-mt-hint')!;
  hint.textContent = isMobileEnv()
    ? '点卡片血缘高亮 · 长按卡片出菜单 · 双指缩放 · 单指拖拽平移'
    : '点卡片血缘高亮（再点取消）· 右键菜单 · 拖拽平移 · 滚轮缩放 · 点标题折/展';
}

function countCulled(st: CanvasState): number {
  const laid = st.tree.nodes.filter((n) => !n.attached && st.sizes.has(n.id)).length;
  return Math.max(0, laid - Math.min(laid, LAYOUT_PARAMS.MAX_NODES));
}

/** `no-index` 的「去建索引」入口：执行既有命令（用户显式点击才动，绝不自动建） */
function requestBuildIndex(st: CanvasState): void {
  try {
    const app: any = getApp();
    if (typeof app?.commands?.executeCommandById === 'function') {
      app.commands.executeCommandById('bz-secondbrain-rebuild-index');
      st.deps.notice('已转交「重建索引」——建完回到白板点「重新生成」');
      return;
    }
  } catch {
    /* 无命令通道（测试壳）→ 提示手动 */
  }
  st.deps.notice('未建向量索引：请先在第二大脑执行「重建索引」，再回白板点「重新生成」');
}

/* ------------------------------------------------------------------ *
 * 画布渲染：建卡 → 量尺寸 → 布局 → 吸附 → 路由 → 画线
 * ------------------------------------------------------------------ */

async function renderCanvas(st: CanvasState): Promise<void> {
  const worldEl = st.worldEl;
  for (const el of Array.from(worldEl.querySelectorAll('.bz-kb-mt-node'))) el.remove();
  st.svg.innerHTML = '';
  st.cards.clear();
  st.sizes.clear();
  st.edges = [];

  const nodes = st.tree.nodes ?? [];
  if (nodes.length === 0) {
    st.world = { w: CANVAS_FALLBACK_W, h: CANVAS_FALLBACK_H };
    syncWorld(st);
    return;
  }

  // 文献默认折起（原型：文献只露标题行）
  for (const n of nodes) if (n.attached && !st.folded.has(n.id)) st.folded.add(n.id);

  const rootId = st.tree.root;
  const jobs: Promise<void>[] = [];
  for (const node of nodes) {
    const el = buildCard(st, node, rootId);
    worldEl.appendChild(el);
    st.cards.set(node.id, el);
    jobs.push(fillBody(st, node, el));
  }
  // 连线层最后挂：卡片与线的层级靠 DOM 次序（ADR-0067：域内不写静态 z-index）
  worldEl.appendChild(st.svg);
  await Promise.all(jobs);

  // 量尺寸（注入接缝；量到 0 用档位兜底）
  for (const node of nodes) {
    const el = st.cards.get(node.id);
    if (!el) continue;
    const raw = st.deps.measure(el, node.kind);
    const w = raw?.w && raw.w > 0 ? raw.w : widthOf(st, node);
    const h = raw?.h && raw.h > 0 ? raw.h : HEIGHT_BY_KIND[node.kind] ?? HEIGHT_BY_KIND.card;
    st.sizes.set(node.id, { w, h });
  }

  // 布局：只有非吸附节点参与（文献吸附在卡片正下方，不参与力导向）
  const laid = nodes.filter((n) => !n.attached && st.sizes.has(n.id));
  const boxIds = new Set(laid.map((n) => n.id));
  const boxes = laid.map((n) => {
    const s = st.sizes.get(n.id)!;
    return { id: n.id, w: s.w, h: s.h, depth: n.depth, kind: n.kind };
  });
  const layoutEdges: Array<{ from: string; to: string }> = [];
  for (const e of st.tree.edges ?? []) {
    if (boxIds.has(e.from) && boxIds.has(e.to)) layoutEdges.push({ from: e.from, to: e.to });
  }
  // 正常路径**不传 viewport**（传了就没有零重叠保证）；>120 自动进 culled
  const layout = layoutTree(boxes, layoutEdges);
  st.pos = layout.pos;
  st.world = { w: layout.world.w, h: layout.world.h };

  for (const n of laid) {
    const el = st.cards.get(n.id)!;
    const p = layout.pos[n.id];
    if (!p) {
      el.style.display = 'none'; // 被 culled（无坐标）→ 跳过渲染
      continue;
    }
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  }

  // 吸附：同名文献贴所属卡片正下方（8px 缝，多篇垂直堆叠），宽度跟随卡片
  const dockGroups = new Map<string, MountNode[]>();
  for (const n of nodes) {
    if (!n.attached || !n.parent) continue;
    if (!dockGroups.has(n.parent)) dockGroups.set(n.parent, []);
    dockGroups.get(n.parent)!.push(n);
  }
  for (const [parentId, group] of dockGroups) {
    const parentPos = layout.pos[parentId];
    const parentEl = st.cards.get(parentId);
    if (!parentPos || !parentEl || parentEl.style.display === 'none') {
      for (const n of group) {
        const el = st.cards.get(n.id);
        if (el) el.style.display = 'none';
      }
      continue;
    }
    const pw = st.sizes.get(parentId)?.w ?? widthOf(st, { id: parentId, kind: 'card' });
    const ph = st.sizes.get(parentId)?.h ?? HEIGHT_BY_KIND.card;
    let top = parentPos.y + ph + DOCK_GAP;
    let right = parentPos.x + pw;
    for (const n of group) {
      const el = st.cards.get(n.id);
      const size = st.sizes.get(n.id);
      if (!el) continue;
      el.style.left = `${parentPos.x}px`;
      el.style.top = `${top}px`;
      el.style.width = `${pw}px`;
      if (size) size.w = pw;
      top += (size?.h ?? HEIGHT_BY_KIND.note) + DOCK_GAP;
      if (top > st.world.h) st.world.h = top;
    }
    if (right > st.world.w) st.world.w = right;
  }

  syncWorld(st);
  drawEdges(st);
  applySelection(st);
}

/** 卡片宽度（主卡 560；吸附项跟随所属卡片） */
function widthOf(st: CanvasState, node: { id?: string; kind: MountKind }): number {
  if (node.id && node.id === st.tree.root) return WIDTH_ROOT;
  return WIDTH_BY_KIND[node.kind] ?? WIDTH_BY_KIND.card;
}

function syncWorld(st: CanvasState): void {
  const { w, h } = st.world;
  st.worldEl.style.width = `${w}px`;
  st.worldEl.style.height = `${h}px`;
  st.svg.setAttribute('width', String(w));
  st.svg.setAttribute('height', String(h));
  st.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  applyTransform(st);
}

/** 建卡（结构 + 头徽章；正文异步填） */
function buildCard(st: CanvasState, node: MountNode, rootId: string): HTMLElement {
  const el = document.createElement('div');
  const ghost = st.ghosts.has(node.id);
  // 建议（幽灵）节点的目标存在性由**渲染层复核**——缓存命中的候选不复查目标是否还在（mount-suggest 口径）
  const stale = !!node.missing || (ghost && !ghostTargetExists(st, node));
  const classes = ['bz-kb-mt-node', `is-${node.kind}`];
  if (stale) classes.push('is-missing');
  if (node.attached) classes.push('is-dock');
  if (node.source === 'sameName') classes.push('is-lit');
  if (ghost) classes.push('is-ghost');
  if (node.id === rootId) classes.push('is-root');
  if (st.folded.has(node.id)) classes.push('is-folded');
  el.className = classes.join(' ');
  el.setAttribute('data-mt-id', node.id);
  el.setAttribute('data-mt-kind', node.kind);
  el.setAttribute('data-mt-source', node.source);
  el.style.width = `${widthOf(st, node)}px`;

  const head = document.createElement('div');
  head.className = 'bz-kb-mt-head';
  const ttl = document.createElement('span');
  ttl.className = 'bz-kb-mt-ttl';
  ttl.textContent = stale ? `${displayTitle(node)}（失效）` : displayTitle(node);
  ttl.title = '点击标题折 / 展这张卡';
  ttl.setAttribute('data-mt-fold', '1');
  head.appendChild(ttl);
  head.appendChild(chip(node.source === 'ai' ? 'AI 建议' : KIND_LABEL[node.kind] ?? '', 'kind'));
  if (node.source && node.source !== 'ai') head.appendChild(chip(SOURCE_LABEL[node.source] ?? '', `src src-${node.source}`));
  if (node.id === rootId) head.appendChild(chip('主 卡', 'root'));
  if (ghost) {
    const reason = st.ghosts.get(node.id)?.reason || '';
    if (reason) {
      const why = chip('看理由', 'why');
      why.setAttribute('data-mt-why', reason);
      why.title = reason;
      head.appendChild(why);
    }
  }
  el.appendChild(head);

  const body = document.createElement('div');
  body.className = 'bz-kb-mt-body';
  el.appendChild(body);

  // 点标题折/展（折叠态只存内存；避开卡片的选中判定）
  ttl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (st.folded.has(node.id)) st.folded.delete(node.id);
    else st.folded.add(node.id);
    const folded = st.folded.has(node.id);
    el.classList.toggle('is-folded', folded);
    // 文献折起时懒渲染：展开了补一次正文
    const body = el.querySelector<HTMLElement>('.bz-kb-mt-body');
    if (!folded && body && !body.querySelector('*')) void fillBody(st, node, el);
  });
  return el;
}

function chip(text: string, kind: string): HTMLElement {
  const s = document.createElement('span');
  s.className = `bz-kb-mt-chip ${kind}`;
  s.textContent = text;
  return s;
}

/** 正文（ADR-0122：render 是追加语义，渲染前容器必须为空；纯文本只能是渲染失败后的兜底） */
async function fillBody(st: CanvasState, node: MountNode, cardEl: HTMLElement): Promise<void> {
  const bodyEl = cardEl.querySelector<HTMLElement>('.bz-kb-mt-body');
  if (!bodyEl) return;
  if (node.attached && st.folded.has(node.id)) return; // 折起时懒渲染（展开了点标题会补渲染）
  const stale = !!node.missing || (st.ghosts.has(node.id) && !ghostTargetExists(st, node));
  if (stale) {
    bodyEl.innerHTML = '<div class="bz-kb-mt-ph is-missing">失效：目标已不存在（改名或删除后残留）</div>';
    return;
  }
  if (node.kind === 'image' || node.kind === 'video') {
    // 图片 / 视频节点：文件名 + 类型徽章即可（原型同款占位块，不加载真媒体）
    bodyEl.innerHTML = `<div class="bz-kb-mt-ph">${escapeHtml(node.path)}</div>`;
    return;
  }
  const md = bodyMarkdown(st, node);
  if (md === null) {
    bodyEl.innerHTML = '<div class="bz-kb-mt-ph">（无正文）</div>';
    return;
  }
  if (!md.trim()) {
    bodyEl.innerHTML = '<div class="bz-kb-mt-ph">（无正文）</div>';
    return;
  }
  const app: any = st.ctx.app ?? getApp();
  let ok = false;
  if (app?.vault) {
    try {
      const comp = new Component();
      await MarkdownRenderer.render(app, md, bodyEl, node.path, comp);
      comp.unload();
      ok = true;
    } catch {
      ok = false;
    }
  }
  // 兜底判据 =「是否产出元素」（嵌入型正文渲染成功也可能无文本，见 ADR-0122）
  if (ok && bodyEl.querySelector('*')) {
    tagBodyLinks(st, node, bodyEl);
    return;
  }
  bodyEl.textContent = '';
  for (const part of md.split(/\r?\n\r?\n+/)) {
    const t = part.trim();
    if (!t) continue;
    const p = document.createElement('div');
    p.className = 'bz-kb-mt-ptext';
    p.textContent = t;
    bodyEl.appendChild(p);
  }
  tagBodyLinks(st, node, bodyEl);
}

/* ---------- 正文双链 → 悬停联动的「文字」这条腿 ---------- */

/** 引用比较键：统一斜杠、去 `./` 与 `.md`、大小写不敏感（Obsidian 的 data-href 写法不一） */
function normRef(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\.md$/i, '')
    .replace(/^\/+/, '')
    .toLowerCase();
}

/** 目标节点的可匹配标识：路径 / id（含 `#子路径`）/ 标题 / 基名 的多种写法 */
function refKeys(node: MountNode): Set<string> {
  const out = new Set<string>();
  const add = (v: unknown): void => {
    const k = normRef(v);
    if (k) out.add(k);
  };
  add(node.path);
  add(node.id);
  add(node.title);
  const base = String(node.path || '').replace(/\\/g, '/').split('/').pop() || '';
  add(base);
  const hash = String(node.id).indexOf('#');
  if (hash >= 0) {
    const sub = String(node.id).slice(hash);
    add(base.replace(/\.md$/i, '') + sub);
  }
  return out;
}

/**
 * 正文里的双链（真 Obsidian 渲染出的 `a.internal-link`）打上 `data-mt-to`（= 该链接指向的节点 id）。
 * 悬停「双链文字」这条腿靠它：drawEdges 拿到最终 DOM 键后再回填 `data-mt-edge`。
 * 匹配不上（别名 / 盒外路径写法）的链接不打标——正文照常、只是没有联动。
 */
function tagBodyLinks(st: CanvasState, node: MountNode, bodyEl: HTMLElement): void {
  const links = Array.from(bodyEl.querySelectorAll<HTMLAnchorElement>('a.internal-link, a[data-href]'));
  if (!links.length) return;
  const outgoing = (st.tree.edges ?? []).filter(
    (e) => (st.direction === 'downstream' ? e.from : e.to) === node.id,
  );
  if (!outgoing.length) return;
  for (const a of links) {
    const href = normRef(a.getAttribute('data-href') || a.getAttribute('href') || '');
    if (!href) continue;
    for (const e of outgoing) {
      const otherId = st.direction === 'downstream' ? e.to : e.from;
      const other = st.tree.nodes.find((n) => n.id === otherId);
      if (!other) continue;
      const keys = refKeys(other);
      const hit = [...keys].some((k) => k === href || k.endsWith('/' + href) || href.endsWith('/' + k));
      if (hit) {
        a.setAttribute('data-mt-to', otherId);
        break;
      }
    }
  }
}

/** 卡片正文来源（幽灵节点 = 建议理由；其余取 data 层给的 body） */
function bodyMarkdown(st: CanvasState, node: MountNode): string | null {
  if (node.missing) return null;
  const ghost = st.ghosts.get(node.id);
  if (ghost) return `> ${ghost.reason || 'AI 建议：这张卡与主卡有实质关联。'}`;
  if (node.body && node.body.trim()) return node.body;
  return null;
}

/** 幽灵（建议）节点的目标存在性复核：缓存命中的候选不复核目标是否还在，渲染层按 vault 兜一道 */
function ghostTargetExists(st: CanvasState, node: MountNode): boolean {
  if (!node.suggested) return true;
  const app: any = st.ctx.app ?? getApp();
  try {
    return !!app?.vault?.getAbstractFileByPath?.(node.path);
  } catch {
    return true; // 无 vault（测试壳）：按存在处理，不误画灰
  }
}

/* ------------------------------------------------------------------ *
 * 连线：锚点圆点 → 路由 → SVG
 * ------------------------------------------------------------------ */

/**
 * 边身份（**仅作 Map 键**；写进 DOM 的是 `e<序号>`——`\0` 不是合法 CSS 字符，
 * 塞进属性选择器会让 querySelector 抛错，故两者分开）。
 */
function edgeId(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

/** DOM 键：按可见边序号（`data-mt-key` / `data-mt-edge`） */
function domKeys(list: MountEdge[]): Map<string, string> {
  const map = new Map<string, string>();
  list.forEach((e, i) => map.set(edgeId(e.from, e.to), `e${i}`));
  return map;
}

/** 逐条边：承载链接的卡（下游 = from / 上游 = to）里插锚点圆点，返回锚点世界坐标 */
function placeAnchors(
  st: CanvasState,
  list: MountEdge[],
  keys: Map<string, string>,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const cursor = new Map<HTMLElement, number>();
  const kindById = new Map(st.tree.nodes.map((n) => [n.id, n.kind]));
  for (const e of list) {
    const id = edgeId(e.from, e.to);
    const key = keys.get(id) ?? '';
    const bearerId = st.direction === 'downstream' ? e.from : e.to;
    const colorKind = (kindById.get(st.direction === 'downstream' ? e.to : e.from) ?? 'para') as MountKind;
    const cardEl = st.cards.get(bearerId);
    if (!cardEl || cardEl.style.display === 'none') continue;
    const bodyEl = cardEl.querySelector<HTMLElement>('.bz-kb-mt-body');
    if (!bodyEl) continue;
    const anchor = st.tree.nodes.find((n) => n.id === e.to)?.anchor ?? null;
    const point = measureDot(st, cardEl, bodyEl, anchor, key, colorKind, cursor);
    if (point) out.set(id, point);
  }
  return out;
}

/** 插一枚锚点圆点（正文里找不到锚点文本就不插，边退回盒式起点兜底） */
function measureDot(
  st: CanvasState,
  cardEl: HTMLElement,
  bodyEl: HTMLElement,
  anchor: AnchorRef | null,
  key: string,
  colorKind: MountKind,
  cursor: Map<HTMLElement, number>,
): { x: number; y: number } | null {
  if (!anchor) return null;
  const needles = anchorNeedles(anchor);
  if (needles.length === 0) return null;
  const dot = insertAnchorDot(bodyEl, needles, key, cursor.get(bodyEl) ?? 0);
  if (!dot) return null;
  cursor.set(bodyEl, Number(dot.getAttribute('data-mt-at') || 0));
  dot.style.color = mountKindColor(colorKind);
  const nodeId = cardEl.getAttribute('data-mt-id') || '';
  const base = st.pos[nodeId];
  const size = st.sizes.get(nodeId);
  if (!base || !size) return null;
  // 量不到（jsdom）→ 交给路由层按源盒左上角兜底
  if (!dot.offsetWidth && !dot.offsetHeight) return null;
  return {
    x: base.x + dot.offsetLeft + dot.offsetWidth / 2,
    y: base.y + dot.offsetTop + dot.offsetHeight / 2,
  };
}

/** 在正文里定位锚点文本并插入圆点；命中返回圆点元素（`data-mt-at` = 游标位置，供同卡下一条接着找） */
function insertAnchorDot(
  bodyEl: HTMLElement,
  needles: string[],
  key: string,
  from: number,
): HTMLElement | null {
  const idx = textIndexOf(bodyEl);
  const hit = locateInText(idx.text, needles, from);
  if (!hit) return null;
  const part = [...idx.parts].reverse().find((p) => hit.at >= p.start);
  if (!part) return null;
  const offset = Math.min(Math.max(0, hit.at - part.start), part.node.data.length);
  const after = part.node.splitText(offset);
  const len = Math.min(hit.len, after.data.length);
  const tail = after.splitText(len);
  const dot = document.createElement('i');
  dot.className = 'bz-kb-mt-anch';
  dot.setAttribute('data-mt-edge', key);
  dot.setAttribute('data-mt-at', String(hit.at + hit.len));
  dot.setAttribute('title', '挂载点：这条线从这句话扯出');
  after.parentNode?.insertBefore(dot, tail);
  return dot;
}

/** 正文纯文本索引（文本节点 + 各自起始下标） */
function textIndexOf(container: HTMLElement): { text: string; parts: Array<{ node: Text; start: number }> } {
  const walker = document.createTreeWalker(container, 4 /* NodeFilter.SHOW_TEXT */);
  const parts: Array<{ node: Text; start: number }> = [];
  let text = '';
  let cur = walker.nextNode() as Text | null;
  while (cur) {
    const data = cur.data ?? '';
    if (data) {
      parts.push({ node: cur, start: text.length });
      text += data;
    }
    cur = walker.nextNode() as Text | null;
  }
  return { text, parts };
}

/** 定位锚点文本：先游标之后，再全文兜底（同一句话挂多条建议时都能落点） */
function locateInText(text: string, needles: string[], from: number): { at: number; len: number } | null {
  if (!text) return null;
  const start = Math.min(Math.max(0, from), text.length);
  for (const needle of needles) {
    if (!needle) continue;
    const seg = text.slice(start);
    if (seg) {
      const rel = relocateAnchor(seg, { from: 0, to: needle.length, text: needle });
      if (rel !== null && rel >= 0) return { at: start + rel, len: needle.length };
    }
    const abs = relocateAnchor(text, { from: 0, to: needle.length, text: needle });
    if (abs !== null && abs >= 0) return { at: abs, len: needle.length };
  }
  return null;
}

/** 路由 + 画线（fallback 走虚线 + 低透明度；d === '' 跳过） */
function drawEdges(st: CanvasState): void {
  const boxes: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];
  for (const n of st.tree.nodes) {
    if (n.attached) continue;
    const p = st.pos[n.id];
    const s = st.sizes.get(n.id);
    const el = st.cards.get(n.id);
    if (!p || !s || !el || el.style.display === 'none') continue;
    boxes.push({ id: n.id, x: p.x, y: p.y, w: s.w, h: s.h });
  }
  const boxIds = new Set(boxes.map((b) => b.id));
  const list = (st.tree.edges ?? []).filter((e) => boxIds.has(e.from) && boxIds.has(e.to));
  st.edges = [];
  if (list.length === 0) {
    st.svg.innerHTML = '';
    return;
  }
  const keys = domKeys(list);
  const anchors = placeAnchors(st, list, keys);
  const inputs = list.map((e) => ({
    from: e.from,
    to: e.to,
    anchor: anchors.get(edgeId(e.from, e.to)) ?? null,
  }));
  const routed = routeEdges(boxes, inputs);
  const kindById = new Map(st.tree.nodes.map((n) => [n.id, n.kind]));
  const suggestedOf = new Map(list.map((e) => [edgeId(e.from, e.to), !!e.suggested]));
  let html = '';
  routed.forEach((r, i) => {
    if (!r?.d) return;
    const id = edgeId(r.from, r.to);
    const key = keys.get(id) ?? `e${i}`;
    // 正文里的双链文字回填 DOM 键（悬停三方联动的「文字」这条腿；fillBody 时打过 data-mt-to）
    const bearerId = st.direction === 'downstream' ? r.from : r.to;
    const otherId = st.direction === 'downstream' ? r.to : r.from;
    st.cards.get(bearerId)?.querySelectorAll('[data-mt-to]').forEach((el) => {
      if (el.getAttribute('data-mt-to') === otherId) el.setAttribute('data-mt-edge', key);
    });
    const colorKind = (kindById.get(st.direction === 'downstream' ? r.to : r.from) ?? 'para') as MountKind;
    const color = mountKindColor(colorKind);
    const isSug = suggestedOf.get(id) ?? false;
    const isFb = !!r.fallback;
    const entry = lastPoint(r.d);
    const cls = `bz-kb-mt-edge${isSug ? ' is-sug' : ''}${isFb ? ' is-fb' : ''}`;
    html += `<path class="${cls}" data-mt-key="${key}" data-i="${i}" d="${r.d}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.6"${
      isSug || isFb ? ' stroke-dasharray="6 5"' : ''
    }/>`;
    if (entry) {
      html += `<circle class="bz-kb-mt-edot" data-mt-key="${key}" cx="${entry.x.toFixed(1)}" cy="${entry.y.toFixed(
        1,
      )}" r="3" fill="${isSug ? 'none' : color}" stroke="${isSug ? color : 'none'}" stroke-width="1.5" opacity="0.85"/>`;
    }
    st.edges.push({ ...r, key, color, suggested: isSug });
  });
  st.svg.innerHTML = html;
}

function lastPoint(d: string): { x: number; y: number } | null {
  const m = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/.exec(d);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** 节点 → 它作为「另一端」的第一条边（悬停卡片联动用） */
function edgeKeyTo(st: CanvasState, nodeId: string): string {
  if (!nodeId) return '';
  const hit = st.edges.find((e) => (st.direction === 'downstream' ? e.to === nodeId : e.from === nodeId));
  return hit?.key ?? '';
}

/* ------------------------------------------------------------------ *
 * 血缘高亮 / 悬停联动
 * ------------------------------------------------------------------ */

function applySelection(st: CanvasState): void {
  const sel = st.selected;
  // 吸附文献**不参与血缘高亮**（ADR-0137 §4）：选中它时整图保持原样（选中态只服务面包屑 / 菜单），
  // 否则 lineageOf 只剩它自己 → 其余全被压成 is-dim、所有边 is-off（整图变暗）
  const dockSelected = !!sel && !!st.cards.get(sel)?.classList.contains('is-dock');
  const set = sel && !dockSelected ? lineageOf(st.tree.edges ?? [], sel) : null;
  for (const [id, el] of st.cards) {
    el.classList.remove('is-sel', 'is-anc', 'is-desc', 'is-dim');
    if (!set || el.classList.contains('is-dock')) continue;
    if (id === sel) el.classList.add('is-sel');
    else if (set.anc.has(id)) el.classList.add('is-anc');
    else if (set.desc.has(id)) el.classList.add('is-desc');
    else el.classList.add('is-dim');
  }
  for (const e of st.edges) {
    const path = st.svg.querySelector<SVGPathElement>(`.bz-kb-mt-edge[data-mt-key="${cssEscape(e.key)}"]`);
    if (!path) continue;
    path.classList.remove('is-anc', 'is-desc', 'is-off');
    if (!set) continue;
    const isAnc = set.anc.has(e.from) && (e.to === sel || set.anc.has(e.to));
    const isDesc = (e.from === sel || set.desc.has(e.from)) && set.desc.has(e.to);
    if (isAnc) path.classList.add('is-anc');
    else if (isDesc) path.classList.add('is-desc');
    else path.classList.add('is-off');
  }
}

function setHover(st: CanvasState, key: string, on: boolean): void {
  if (!key) {
    st.win.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
    return;
  }
  const edge = st.edges.find((e) => e.key === key);
  if (!edge) return;
  const otherId = st.direction === 'downstream' ? edge.to : edge.from;
  // 三方联动：连线 / 锚点圆点 / **正文里的双链文字**（同一 data-mt-edge）/ 目标卡
  const list = [
    st.svg.querySelector(`.bz-kb-mt-edge[data-mt-key="${cssEscape(key)}"]`),
    st.svg.querySelector(`.bz-kb-mt-edot[data-mt-key="${cssEscape(key)}"]`),
    ...Array.from(st.win.querySelectorAll(`[data-mt-edge="${cssEscape(key)}"]`)),
    st.cards.get(otherId) ?? null,
  ];
  for (const el of list) {
    if (!el) continue;
    el.classList.toggle('is-hot', on);
  }
}

function cssEscape(s: string): string {
  return String(s).replace(/["\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ *
 * 缩放 / 平移
 * ------------------------------------------------------------------ */

function applyTransform(st: CanvasState): void {
  st.worldEl.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.scale})`;
}

function zoomAt(st: CanvasState, px: number, py: number, factor: number): void {
  zoomAtAbsolute(st, px, py, st.scale * factor);
}

/** 缩放锚定（原型 zoomAt：先钳制再换算平移，指针下的世界点不动） */
function zoomAtAbsolute(st: CanvasState, px: number, py: number, want: number): void {
  const ns = clampMountScale(want);
  const k = ns / st.scale;
  st.tx = px - (px - st.tx) * k;
  st.ty = py - (py - st.ty) * k;
  st.scale = ns;
  applyTransform(st);
}

function zoomAtCenter(factor: number): void {
  const st = state;
  if (!st) return;
  const w = st.canvasEl.clientWidth || CANVAS_FALLBACK_W;
  const h = st.canvasEl.clientHeight || CANVAS_FALLBACK_H;
  zoomAt(st, w / 2, h / 2, factor);
}

/** 适应窗口（原型 fit：0.3 ~ 1.15，居中） */
function fit(): void {
  const st = state;
  if (!st) return;
  const cw = st.canvasEl.clientWidth || CANVAS_FALLBACK_W;
  const ch = st.canvasEl.clientHeight || CANVAS_FALLBACK_H;
  const w = Math.max(1, st.world.w);
  const h = Math.max(1, st.world.h);
  st.scale = Math.min(ZOOM_FIT_MAX, Math.max(ZOOM_MIN, Math.min((cw - FIT_PAD) / w, (ch - FIT_PAD) / h)));
  st.tx = (cw - w * st.scale) / 2;
  st.ty = (ch - h * st.scale) / 2;
  applyTransform(st);
}

/* ------------------------------------------------------------------ *
 * 右键 / 长按菜单
 * ------------------------------------------------------------------ */

interface MenuEntry {
  act: string;
  label: string;
  disabled?: boolean;
  title?: string;
}

function openNodeMenu(nodeId: string, x: number, y: number): void {
  const st = state;
  if (!st || !nodeId) return;
  const node = st.tree.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  closeMenu();
  const ghost = st.ghosts.get(nodeId) ?? null;
  const litChild = st.tree.nodes.find((n) => n.attached && n.parent === nodeId) ?? null;
  const isAttachment = node.kind === 'image' || node.kind === 'video';
  const entries: MenuEntry[] = [
    { act: 'open', label: '打开笔记', disabled: !!node.missing },
    { act: 'lit', label: '看文献笔记', disabled: !litChild, title: litChild ? litChild.path : '这篇卡片没有同名文献' },
    { act: 'copy', label: '复制双链', disabled: false },
    { act: 'root', label: '设为主卡', disabled: !!node.missing || isAttachment || node.id === st.tree.root },
    { act: 'who', label: '看谁挂了我（翻向上游）', disabled: !!node.missing || isAttachment },
    { act: 'pin', label: '固定（正文写入双链）', disabled: !ghost },
    { act: 'dismiss', label: '取消建议', disabled: !ghost },
    { act: 'why', label: '看理由', disabled: !ghost },
  ];
  const menu = document.createElement('div');
  menu.className = 'bz-kb-mt-ctx';
  menu.id = 'bz-kb-mt-ctx';
  const head = document.createElement('div');
  head.className = 'bz-kb-mt-ctx-head';
  head.textContent = displayTitle(node);
  menu.appendChild(head);
  if (ghost?.reason) {
    const reason = document.createElement('div');
    reason.className = 'bz-kb-mt-ctx-reason';
    reason.textContent = ghost.reason;
    menu.appendChild(reason);
  }
  for (const item of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-kb-mt-ctx-item';
    b.setAttribute('data-mt-menu', item.act);
    b.textContent = item.label;
    if (item.disabled) {
      b.disabled = true;
      b.classList.add('is-dis');
    }
    if (item.title) b.title = item.title;
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (item.disabled) return;
      closeMenu();
      runMenuAction(st, item.act, node, ghost);
    });
    menu.appendChild(b);
  }
  st.win.appendChild(menu);
  const rect = st.win.getBoundingClientRect?.() ?? ({ left: 0, top: 0, width: CANVAS_FALLBACK_W, height: CANVAS_FALLBACK_H } as any);
  const mw = menu.offsetWidth || 240;
  const mh = menu.offsetHeight || 280;
  const left = Math.max(8, Math.min(x - num(rect.left), (rect.width || CANVAS_FALLBACK_W) - mw - 8));
  const top = Math.max(8, Math.min(y - num(rect.top), (rect.height || CANVAS_FALLBACK_H) - mh - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  st.menu = menu;
  const outside = (ev: any) => {
    if (!st.menu) return;
    if (ev.target?.closest?.('#bz-kb-mt-ctx')) return;
    closeMenu();
  };
  setOutsideHandler(outside);
}

/** 菜单外点击关闭（document 捕获；打开时挂、关闭时摘，绝不留残留监听） */
let menuOutsideHandler: ((ev: any) => void) | null = null;
function setOutsideHandler(fn: (ev: any) => void): void {
  if (menuOutsideHandler) document.removeEventListener('pointerdown', menuOutsideHandler, true);
  menuOutsideHandler = fn;
  document.addEventListener('pointerdown', fn, true);
}

function closeMenu(): void {
  const st = state;
  st?.menu?.remove();
  if (st) st.menu = null;
  if (menuOutsideHandler) {
    document.removeEventListener('pointerdown', menuOutsideHandler, true);
    menuOutsideHandler = null;
  }
}

function runMenuAction(
  st: CanvasState,
  act: string,
  node: MountNode,
  ghost: MountSuggestion | null,
): void {
  if (act === 'open') {
    st.deps.openNote(node.path);
    return;
  }
  if (act === 'lit') {
    const lit = st.tree.nodes.find((n) => n.attached && n.parent === node.id);
    if (lit) st.deps.openNote(lit.path);
    return;
  }
  if (act === 'copy') {
    const text = mountLinkText(node);
    void st.deps
      .writeClipboard(text)
      .then(() => st.deps.notice(`已复制：${text}`, 'success'))
      .catch(() => st.deps.notice('复制失败：剪贴板不可用', 'error'));
    return;
  }
  if (act === 'root') {
    void openMountTree(node.path, { direction: st.direction, deps: depsOf(st) });
    return;
  }
  if (act === 'who') {
    void openMountTree(node.path, { direction: 'upstream', deps: depsOf(st) });
    return;
  }
  if (act === 'why') {
    if (ghost) st.deps.notice(`建议理由：${ghost.reason || '（无理由）'}`);
    return;
  }
  if (act === 'pin' && ghost) {
    void pinSuggestion(st, ghost);
    return;
  }
  if (act === 'dismiss' && ghost) {
    void dismissSuggestion(st, ghost);
  }
}

/** 固定：缓存留档 + 锚点处写 `[[目标]]`（用户显式动作；AI 绝不自动写） */
async function pinSuggestion(st: CanvasState, ghost: MountSuggestion): Promise<void> {
  const rootPath = st.tree.root;
  const app: any = st.ctx.app ?? getApp();
  const link = ghost.target.replace(/\.md$/i, '');
  let found = false;
  let changed = false;
  try {
    // D3 可靠写契约：用户文档的「读-改-写」走 core/storage 的 per-path 串行队列（enqueueFileTask），
    // 与提炼成卡 / 自动摘要 / 用户手编等写方串行，避免同文件互吞
    await enqueueFileTask(rootPath, async () => {
      const file = app?.vault?.getAbstractFileByPath?.(rootPath);
      if (!file) return;
      found = true;
      const text = await app.vault.read(file);
      const next = insertLinkAtAnchor(text, ghost.anchor, link);
      if (next !== text) {
        await app.vault.modify(file, next);
        changed = true;
      }
    });
  } catch (e: any) {
    st.deps.notice(`固定失败：${e?.message ?? String(e)}`, 'error');
    return;
  }
  if (!found) {
    st.deps.notice('固定失败：读不到主卡文件', 'error');
    return;
  }
  try {
    await markSuggestion(rootPath, ghost, 'fixed', { app, cardboxDir: st.ctx.cardboxDir, litDir: st.ctx.litDir });
  } catch {
    /* 留档失败不影响正文已写入的事实 */
  }
  if (st.run) st.run = { ...st.run, suggestions: st.run.suggestions.filter((s) => s.target !== ghost.target) };
  st.ghosts.delete(ghostId(ghost));
  // 幂等早退（正文里已有这条双链）与真写入分开报：不谎报「正文已写入」
  st.deps.notice(
    changed ? `已固定：正文写入 [[${link}]]` : `已固定：正文里已有 [[${link}]]，本次只留档`,
    'success',
  );
  await rebuildTreeOnly(st);
}

/** 幽灵节点 id（与 mergeSuggestions 同口径） */
function ghostId(ghost: Pick<MountSuggestion, 'target'>): string {
  return 'ai:' + ghost.target;
}

/** 取消：缓存留档（永久不再推）+ 本图移除幽灵节点 */
async function dismissSuggestion(st: CanvasState, ghost: MountSuggestion): Promise<void> {
  const rootPath = st.tree.root;
  const app: any = st.ctx.app ?? getApp();
  try {
    await markSuggestion(rootPath, ghost, 'dismissed', { app, cardboxDir: st.ctx.cardboxDir, litDir: st.ctx.litDir });
  } catch {
    /* 留档失败：本图仍移除，下次生成可能重推 */
  }
  if (st.run) st.run = { ...st.run, suggestions: st.run.suggestions.filter((s) => s.target !== ghost.target) };
  st.deps.notice('已取消建议：永久不再推荐这条', 'success');
  await rebuildTreeOnly(st);
}

/** 测试 / 卸载用：清掉白板 DOM 与单例（不通知） */
export function destroyMountTree(): void {
  const st = state;
  if (!st) return;
  closeMenu(); // 菜单开着时卸载：连 document 级「点外关闭」监听一起摘掉
  st.esc?.unregister();
  st.esc = null;
  st.token++; // 在途载入作废（别让它在 DOM 摘除后继续写状态）
  cancelLongPress(st);
  st.mask.remove();
  st.win.remove();
  state = null;
}

/** 当前主卡路径（命令 / 测试用；未打开返回 null） */
export function mountTreeRoot(): string | null {
  return state && state.mask.style.display !== 'none' ? state.cardPath : null;
}

/** 当前方向（命令 / 测试用） */
export function mountTreeDirection(): MountDirection | null {
  return state && state.mask.style.display !== 'none' ? state.direction : null;
}
