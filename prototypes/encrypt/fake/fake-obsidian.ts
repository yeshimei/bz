/**
 * 保险库行为单源 · 公共假 obsidian（encrypt 域，2026-09-12）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的 `obsidian`
 * 替换为本文件。保险库与密码本本就是**同一个 SafeManager、一把主密码、一份 .safe.enc**
 * （ADR-0085），文件系统面语义完全同构，故这里整体转发密码本壳的 fake 层（clipbook 范式），
 * 只覆盖两处域特有差异，避免两份 fake vault 漂移：
 *
 *   1. setIcon → 表改挂 window.VLT_ICONS（prototype-icons.js）：保险库壳自带图标表，
 *      不与密码本壳的 window.PWV_ICONS 串味（两壳可能同开在一个浏览器里）；
 *   2. MarkdownRenderer.render → **真渲染**：密码本壳不预览加密笔记，只给了空桩；而保险库
 *      面板的笔记详情就是 Markdown 正文预览——空桩 = 详情区静默空白。语义严格对齐 core 的
 *      「追加、不清空容器」契约（AGENTS 铁律 6：渲染前不许藏脏、纯文本只作兜底）。
 *
 * 其余出口（Platform / requestUrl / TFile / Setting / Component / FakeVault /
 * FakeApp / seedVaultFile）逐个转发。
 */
export {
  Platform,
  requestUrl,
  TFile,
  Setting,
  Component,
  FakeVault,
  seedVaultFile,
  FakeApp,
} from '../../password-vault/fake/fake-obsidian';
export type { IconName, App } from '../../password-vault/fake/fake-obsidian';

// ==================== 图标（表 = prototype-icons.js 的 window.VLT_ICONS） ====================

declare global {
  interface Window {
    VLT_ICONS?: Record<string, string>;
  }
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
  const d = (typeof window !== 'undefined' && window.VLT_ICONS?.[iconId]) || '';
  if (!d) return;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // 表里存的是内层 path/circle 片段——注入 innerHTML（内容为受控图标表）
  svg.innerHTML = d;
  container.replaceChildren(svg);
}

// ==================== Markdown 渲染（评审用极简实现，追加语义） ====================

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 行内标记（先转义再替换，顺序不可颠倒） */
function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

/**
 * 极简 md → HTML（标题/引用/列表/代码块/分割线/段落）。
 * 只求「评审时能看清正文结构」，不做 Obsidian 扩展语法——链接、嵌入、callout 等
 * 在插件里由真 MarkdownRenderer 渲染，这里不模拟。
 */
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let inCode = false;
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    out.push(`<${list.type}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw;
    if (/^\s*```/.test(line)) {
      flushList();
      out.push(inCode ? '</code></pre>' : '<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }
    if (!line.trim()) {
      flushList();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushList();
      const lv = h[1].length;
      out.push(`<h${lv}>${inlineMd(h[2])}</h${lv}>`);
      continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flushList();
      out.push('<hr>');
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flushList();
      out.push(`<blockquote>${inlineMd(q[1])}</blockquote>`);
      continue;
    }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      const type: 'ul' | 'ol' = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(inlineMd((ul || ol)![1]));
      continue;
    }
    flushList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  flushList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

/**
 * MarkdownRenderer 浏览器实现。签名与 Obsidian 同形；**追加**到 el 末尾（不清空），
 * 与真实现同语义——调用方（encrypt/ui.ts 的笔记预览）依赖这一点：它先建空容器再渲染。
 */
export class MarkdownRenderer {
  static async render(
    _app: unknown,
    markdown: string,
    el: HTMLElement,
    _sourcePath?: string,
    _component?: unknown,
  ): Promise<void> {
    const box = document.createElement('div');
    box.className = 'bz-sim-md';
    box.innerHTML = mdToHtml(String(markdown ?? ''));
    el.appendChild(box);
  }
}
