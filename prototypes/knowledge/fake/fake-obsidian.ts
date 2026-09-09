/**
 * 知识盒行为单源 · 公共假 obsidian（issue 259，范式随 settings-panel/ADR-0106）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 fake-sim.ts 依赖链上的
 * `obsidian` 包替换为本文件——知识盒真实现（ui.ts 及其依赖链）用到的出口：
 *   - Platform.isMobile        → 视口 ≤768 判定（主窗真全屏 + 头栏 ✕ 随之生效）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.BZ_ICONS，prototype-icons.js）
 *   - MarkdownRenderer / MarkdownView / TFile 等 → 壳类（部叁主题只读渲染走 render 回退纯文本）
 *   - requestUrl               → 罐头回放：deepseek chat/completions 返回演示级 AI 结果
 *                                （术语生成/总结/领域判定可真跑；外部链接抓标题静默失败降级纯链接）
 *   - App / vault / metadataCache → localStorage 文件系统 + frontmatter 解析缓存
 *                                （FakeVault 额外补 adapter.exists / getFolderByPath ——
 *                                writeUniqueNote / 落卡建目录的写路径）
 * 不提供 setApp/getApp——评审壳统一走 core/app 真 setApp（fake-sim 注入 FakeApp），单源不裂。
 */
import moment from 'moment';

export { moment };

// ==================== 视口判定 ====================

export const Platform = {
  isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.BZ_ICONS） ====================

declare global {
  interface Window {
    BZ_ICONS?: Record<string, string>;
    BZ_SP_ICONS?: Record<string, string>;
  }
}

export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && (window.BZ_ICONS?.[iconId] || window.BZ_SP_ICONS?.[iconId])) || '';
  if (!d) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = d;
  container.replaceChildren(svg);
}

export type IconName = string;

// ==================== requestUrl：AI 罐头回放（deepseek chat/completions） ====================

/**
 * 知识盒原型无真实网络凭据：fetch 流式失败后降级走到这里（core/ai 非流式路径）。
 * 按提示词特征识别三类调用并回放演示级结果；其余请求抛错走各自降级。
 */
export async function requestUrl(opts?: { url?: string; body?: string }): Promise<{ status: number; text: string }> {
  const url = String(opts?.url ?? '');
  if (!/chat\/completions/.test(url)) throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
  let prompt = '';
  try {
    const body = JSON.parse(String(opts?.body ?? '{}')) as { messages?: Array<{ content?: string }> };
    prompt = (body.messages || []).map((m) => String(m.content ?? '')).join('\n');
  } catch { /* 原样空提示词 */ }
  let content: string;
  const term = /为术语「([^」]+)」生成一篇文献笔记/.exec(prompt);
  if (term) {
    const domains = /从以下领域选一个最贴近的：([^；」]+)/.exec(prompt);
    const domain = domains ? domains[1].split('、')[0] : '心理';
    content = JSON.stringify({
      summary: `（演示简介）${term[1]}：一段百科式介绍——定义、核心要点与必要背景。原型环境由 fake AI 罐头回放生成，用于评审术语录入、来源行与词典皮交互，内容本身不代表真实生成质量。`,
      domain,
    });
  } else if (prompt.includes('压缩成更精简')) {
    const src = /【原文】\n([\s\S]+)/.exec(prompt);
    content = `（演示总结）${(src ? src[1] : '').replace(/\s+/g, '').slice(0, 60)}……`;
  } else if (prompt.includes('所属的领域')) {
    content = JSON.stringify({ domain: '心理' });
  } else {
    throw new Error('原型环境无网络请求（fake obsidian requestUrl：未识别的 AI 调用）');
  }
  return { status: 200, text: JSON.stringify({ choices: [{ message: { content } }] }) };
}

// ==================== 依赖闭包壳类 ====================

export class TFile {}
export class TFolder {}
export class TAbstractFile {}

export class MarkdownRenderer {
  /** 演示级 Markdown 渲染：视频 ![[mp4]] 内嵌为可播放 <video>（统一映射壳内 demo 片段）+ 基础排版 */
  static async render(_app: unknown, markdown: string, el: HTMLElement, _sourcePath?: string, _component?: unknown): Promise<void> {
    const md = String(markdown ?? '');
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const inline = (s: string): string => {
      let t = esc(s);
      t = t.replace(/!\[\[([^\]]+)\]\]/g, (_m, p1: string) =>
        /\.(mp4|webm|mkv)$/i.test(p1)
          ? '<video controls preload="metadata" src="./assets/demo.mp4"></video>'
          : `<span class="bz-kb-cite">${p1}</span>`);
      t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, p1: string, p2: string) => `<span class="bz-kb-cite">${p2 || p1}</span>`);
      t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      return t;
    };
    const out: string[] = [];
    let list: 'ul' | 'ol' | null = null;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const rawLine of md.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) { closeList(); continue; }
      const fullEmbed = /^!\[\[([^\]]+)\]\]$/.exec(line);
      if (fullEmbed) {
        closeList();
        if (/\.(mp4|webm|mkv)$/i.test(fullEmbed[1])) {
          out.push('<video controls preload="metadata" src="./assets/demo.mp4"></video>');
        } else {
          out.push(`<p><span class="bz-kb-cite">${esc(fullEmbed[1])}</span></p>`);
        }
        continue;
      }
      const h = /^(#{1,3})\s+(.*)$/.exec(line);
      if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
      if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
      const ul = /^[-*]\s+(.*)$/.exec(line);
      if (ul) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
      const ol = /^\d+[.、]\s+(.*)$/.exec(line);
      if (ol) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
      if (line === '---') { closeList(); out.push('<hr>'); continue; }
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    el.innerHTML = out.join('\n');
  }
}

export class MarkdownView {}
export class Component {
  load(): void {}
  unload(): void {}
}
export class Notice {
  constructor(_msg?: string, _duration?: number) {}
  hide(): void {}
}
export class Modal {
  constructor(_app?: unknown) {}
  open(): void {}
  close(): void {}
}
export function normalizePath(p: string): string {
  return p.replace(/([\\/])+/g, '/');
}

// ==================== localStorage 文件系统 ====================

export interface FakeStat {
  ctime: number;
  mtime: number;
}

export interface FakeFile {
  path: string;
  basename: string;
  extension: string;
  name: string;
  stat: FakeStat;
  content: string;
}

interface Envelope {
  c: string;
  ct: number;
  mt: number;
}

const KEY_PREFIX = 'bz-sim:';

export function encodeSeedFile(content: string, stat?: { ctime?: number; mtime?: number }): string {
  const now = Date.now();
  const env: Envelope = { c: content, ct: stat?.ctime ?? now, mt: stat?.mtime ?? stat?.ctime ?? now };
  return JSON.stringify(env);
}

export class FakeVault {
  static key(path: string): string {
    return KEY_PREFIX + path;
  }

  /** localStorage 封套 → FakeFile（内容内藏，read 吐 content） */
  private toFile(path: string, raw: string): FakeFile {
    let content = raw;
    let ct = Date.now();
    let mt = ct;
    try {
      const env = JSON.parse(raw) as Envelope | null;
      if (env && typeof env === 'object' && typeof env.c === 'string') {
        content = env.c;
        ct = Number(env.ct) || ct;
        mt = Number(env.mt) || mt;
      }
    } catch {
      /* 纯文本内容原样 */
    }
    const base = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;
    const dot = base.lastIndexOf('.');
    return {
      path,
      basename: dot > 0 ? base.slice(0, dot) : base,
      extension: dot > 0 ? base.slice(dot + 1) : '',
      name: base,
      stat: { ctime: ct, mtime: mt },
      content,
    };
  }

  getAbstractFileByPath(path: string): FakeFile | null {
    const raw = localStorage.getItem(FakeVault.key(path));
    return raw == null ? null : this.toFile(path, raw);
  }

  getFiles(): FakeFile[] {
    const out: FakeFile[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(KEY_PREFIX)) continue;
      const path = k.slice(KEY_PREFIX.length);
      if (!path || path.split('/').some((seg) => seg.startsWith('.'))) continue;
      out.push(this.toFile(path, localStorage.getItem(k) as string));
    }
    return out;
  }

  getMarkdownFiles(): FakeFile[] {
    return this.getFiles().filter((f) => f.extension === 'md');
  }

  async read(f: FakeFile): Promise<string> {
    return f.content;
  }

  async modify(f: FakeFile, content: string): Promise<void> {
    f.content = content;
    localStorage.setItem(FakeVault.key(f.path), encodeSeedFile(content, f.stat));
  }

  async create(path: string, content: string): Promise<FakeFile> {
    localStorage.setItem(FakeVault.key(path), encodeSeedFile(content));
    return this.toFile(path, encodeSeedFile(content));
  }

  async createFolder(_path: string): Promise<void> {
    return undefined as never; // localStorage 无目录概念
  }

  /** 落卡建目录守卫用（saveCard：不存在则 createFolder）——localStorage 视目录恒存在 */
  getFolderByPath(_path: string): null {
    return null;
  }

  adapter = {
    /** writeUniqueNote 建目录守卫：目录下任一文件存在（或自身是文件）即视为存在 */
    exists: async (path: string): Promise<boolean> => {
      const clean = String(path).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (!clean) return true;
      if (localStorage.getItem(FakeVault.key(clean)) != null) return true;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${FakeVault.key(clean)}/`)) return true;
      }
      return false;
    },
  };
}

/** frontmatter 极简解析（种子笔记专用）：`key: value` / `key:` + `- item` 列表 / `key: [a, b]` */
export function parseFrontmatter(content: string): Record<string, unknown> | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return null;
  const strip = (s: string): string => {
    const t = s.trim();
    if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
      return t.slice(1, -1);
    }
    return t;
  };
  const fm: Record<string, unknown> = {};
  let lastKey: string | null = null;
  for (const line of content.slice(3, end).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const listItem = /^\s*-\s*(.+)$/.exec(line);
    if (listItem && lastKey) {
      const arr = Array.isArray(fm[lastKey]) ? (fm[lastKey] as unknown[]) : [];
      arr.push(strip(listItem[1]));
      fm[lastKey] = arr;
      continue;
    }
    const kv = /^([^\s:][^:]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].trim();
    const rawVal = kv[2].trim();
    lastKey = key;
    if (rawVal === '') {
      fm[key] = [];
    } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      fm[key] = rawVal.slice(1, -1).split(',').map((s) => strip(s)).filter(Boolean);
    } else {
      fm[key] = strip(rawVal);
    }
  }
  return fm;
}

/** metadataCache：getFileCache(file).frontmatter（部壹扫描/parseNoteFile 读取面），按路径 memo */
export class FakeMetadataCache {
  private cache = new Map<string, Record<string, unknown> | null>();

  getFileCache(file: { path: string; content?: string }): { frontmatter?: Record<string, unknown> } | null {
    if (!file || typeof file.path !== 'string') return null;
    if (!this.cache.has(file.path)) {
      const raw = typeof file.content === 'string' ? file.content : this.readThrough(file.path);
      this.cache.set(file.path, parseFrontmatter(raw));
    }
    const fm = this.cache.get(file.path);
    return fm ? { frontmatter: fm } : null;
  }

  private readThrough(path: string): string {
    try {
      const raw = localStorage.getItem(FakeVault.key(path));
      if (raw == null) return '';
      const env = JSON.parse(raw) as Envelope | null;
      return env && typeof env === 'object' && typeof env.c === 'string' ? env.c : raw;
    } catch {
      return '';
    }
  }
}

/** 评审壳 App：vault + metadataCache + workspace/openUrl（知识盒链的完整读取面） */
export class FakeApp {
  vault = new FakeVault();
  metadataCache = new FakeMetadataCache();
  workspace = {
    getLeaf: () => ({
      openFile: async (f: unknown) => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bz-sim:open-file', { detail: f }));
      },
    }),
  };
  openUrl(url: string): void {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  }
}

export type App = FakeApp;
