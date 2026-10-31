/* ============================================================
 * bz · 「bz 依赖什么」弹窗（core/deps-guide.ts）
 *
 * 引导页的下载队列只管「搬得进插件目录」的东西。剩下几层（云端密钥、Ollama、
 * 向量模型、pip 依赖、转写模型）搬不动也不该搬——但它们是功能前提，用户必须知道
 * 存在、以及自己这台机器上还缺哪几样。
 *
 * 为什么单独成模块而不是留在 setup-wizard 里：**三个地方都要它**——
 * 引导完成屏的「还需要装什么」、设置 → AI → Embedding 的「怎么装」、
 * 第二大脑失败态的「Ollama 没装或没启动？」。同一份清单、同一套探测、同一段文案，
 * 分头写三遍必然漂。
 *
 * 皮肤的类名沿用 `bz-setup-*`（见 core/ui/components.css）：它就是引导页长出来的东西，
 * 换一套皮只会让「同一个插件里两种长相」。
 * ============================================================ */
import { uiModal } from './ui/modal';
import { embeddingServiceUrl } from './ai-models';
import { tryGetSettings } from './settings-provider';
import { getApp } from './app';
import { EXTRA_DEP_GUIDE, probeDep, type DepGuideRow } from './dep-runtime';

/* ---------- 最小 DOM 工具（与 setup-wizard 同一批类名） ---------- */

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 状态点：实心绿 = 正常，实心红 = 没就绪，空心 = 还没检出/不适用 */
function mark(state: 'ok' | 'bad' | 'idle'): HTMLElement {
  return el('span', `bz-setup-mark bz-setup-mark--${state}`);
}

/** 分组：小标题 + 一张卡 */
function group(title?: string): HTMLElement {
  const wrap = el('div', 'bz-setup-group');
  if (title) wrap.appendChild(el('div', 'bz-setup-group-h', title));
  wrap.appendChild(el('div', 'bz-setup-card'));
  return wrap;
}

/** 一行：状态点 + 名称（带一句用途）+ 右侧体积/状态 */
function row(name: string, serves: string, value: string): HTMLElement {
  const r = el('div', 'bz-setup-row bz-setup-row--guide');
  const key = el('span', 'bz-setup-key');
  key.innerHTML = `${escapeText(name)}<em>${escapeText(serves)}</em>`;
  r.append(mark('idle'), key, el('span', 'bz-setup-val', value));
  return r;
}

function escapeText(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** 把 `` `命令` `` 渲染成 <code>，其余文本原样（换行交给 CSS 的 pre-wrap） */
function renderCommandText(target: HTMLElement, text: string): void {
  for (const part of String(text).split(/(`[^`]*`)/g)) {
    if (!part) continue;
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      target.appendChild(el('code', '', part.slice(1, -1)));
    } else {
      target.appendChild(document.createTextNode(part));
    }
  }
}

/* ---------- 本机探测 ---------- */

/** 云端 AI 配没配（与 env-check 的 aiConfigured 同口径：本地 Ollama 无需密钥即视为已配） */
export function cloudAiConfigured(): boolean {
  try {
    const s = tryGetSettings() as Record<string, unknown>;
    const provider = String(s?.aiProvider || 'deepseek');
    if (provider === 'ollama') return true;
    const key = provider === 'zhipu-plan' ? s?.zhipuPlanApiKey : s?.deepseekApiKey;
    return !!String(key ?? '').trim();
  } catch {
    return false;
  }
}

/** Ollama 服务探活（超时 → 当没起；服务没起不是错误，只是这一项还没配） */
export async function probeOllamaService(timeoutMs = 3000): Promise<{ up: boolean; models: string[] }> {
  if (typeof fetch !== 'function') return { up: false, models: [] };
  const base = embeddingServiceUrl().replace(/\/+$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    if (!res.ok) return { up: false, models: [] };
    const data = (await res.json().catch(() => null)) as { models?: Array<{ name?: unknown }> } | null;
    const models = Array.isArray(data?.models) ? data.models.map((m) => String(m?.name || '')) : [];
    return { up: true, models };
  } catch {
    return { up: false, models: [] };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- 弹窗 ---------- */

/**
 * 打开「bz 依赖什么」。
 *
 * @param app 插件 app（用来探本机 Python 的绝对路径，好让命令可以直接复制）；
 *   不传就现取——调用方（设置页、面板）都不必自己持有 app 引用。
 */
export function openDepsGuide(app: unknown = getApp()): void {
  const content = el('div', 'bz-setup bz-setup-deps');
  uiModal({
    head: true,
    title: 'bz 依赖什么',
    content,
    maxWidth: 760,
    className: 'bz-setup-modal',
    autofocus: false,
  });

  // Python 命令用本机真实路径：引导页刚装完的那份就在插件目录里，用户复制走就能跑
  const py = probeDep(app, 'python');
  const pyCmd = py.ok && py.entries[0]?.path ? `"${py.entries[0].path}"` : 'python';

  // 按 group 聚合（顺序 = 首次出现顺序，数据表里已经排好了）
  const order: string[] = [];
  const byGroup = new Map<string, DepGuideRow[]>();
  for (const r of EXTRA_DEP_GUIDE) {
    if (!byGroup.has(r.group)) {
      byGroup.set(r.group, []);
      order.push(r.group);
    }
    byGroup.get(r.group)?.push(r);
  }

  /** 有探测判据的行（打开后再补状态，不阻塞弹窗） */
  const watched: Array<{ row: DepGuideRow; markEl: HTMLElement; valEl: HTMLElement }> = [];

  for (const g of order) {
    const wrap = group(g);
    const card = wrap.querySelector('.bz-setup-card') as HTMLElement;
    for (const r of byGroup.get(g) || []) {
      const node = row(r.name, r.serves, r.size || '');
      const how = el('div', 'bz-setup-how');
      renderCommandText(how, String(r.how).replace(/\{python\}/g, pyCmd));
      node.appendChild(how);
      card.appendChild(node);
      if (r.probe) {
        watched.push({
          row: r,
          markEl: node.querySelector('.bz-setup-mark') as HTMLElement,
          valEl: node.querySelector('.bz-setup-val') as HTMLElement,
        });
      }
    }
    content.appendChild(wrap);
  }

  content.appendChild(
    el(
      'div',
      'bz-setup-note',
      'Node、三个工具包、Python、ffmpeg、文档与皮肤在这一页之外已经处理过了；缺的可以在「设置 → 关于 → 环境自检」里补。',
    ),
  );

  // 本机状态：Ollama 探一次，云端的密钥读设置
  void (async () => {
    const aiOk = cloudAiConfigured();
    const svc = await probeOllamaService();
    const hasBge = svc.models.some((m) => /bge-m3/i.test(m));
    for (const w of watched) {
      if (w.row.probe === 'ai') {
        w.markEl.className = `bz-setup-mark bz-setup-mark--${aiOk ? 'ok' : 'idle'}`;
        if (aiOk) w.valEl.textContent = '已配置';
      } else if (w.row.probe === 'ollama') {
        w.markEl.className = `bz-setup-mark bz-setup-mark--${svc.up ? 'ok' : 'bad'}`;
        w.valEl.textContent = svc.up ? '已在运行' : '没检测到';
      } else if (w.row.probe === 'embedding') {
        const ok = svc.up && hasBge;
        w.markEl.className = `bz-setup-mark bz-setup-mark--${ok ? 'ok' : svc.up ? 'bad' : 'idle'}`;
        w.valEl.textContent = ok ? '已就绪' : svc.up ? '还没拉取' : w.row.size || '';
      }
    }
  })();
}
