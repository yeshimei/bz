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
import { AI_INDEX } from './ai-index';

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
 * B 站 view API 罐头（issue 278 / ADR-0133）：视频录入「解析」在评审壳可见——bvid → 演示标题/UP主
 * + duration 与三段 pages（多 P 下拉 + 双把手范围条可演示；档位查询要 cookie，原型不配故走固定列表回落）。
 * b23.tv 短链罐头（ADR-0134）：回放落地页 HTML（og:url + `__INITIAL_STATE__`）——评审壳里能看到
 * 「短链 → 补出 bvid → 写回规范链接」，无需真跑重定向。
 */
/* ---------------- 挂载建议三段链路 · 罐头回答 ---------------- */

/**
 * 三段链路的罐头回答（2026-09-15）：prompt 里已经把**片段 / 候选池 / 目标全文**都写全了，
 * 所以这里按 prompt 的形状现算，不写死答案——片段几句就答几句、候选池里有什么才选什么、
 * 目标笔记里有什么标题/段落才敢指到哪里。三条链路各回各的 JSON 数组（形状见 mount-suggest 的解析器）。
 *
 * 定位官刻意轮着给 unit：n1 整篇 / n2 小节 / n3 段落——壳里三种落链接形态都能看一遍
 * （标题与摘录都从 prompt 的目标全文里**逐字**取，链路本地会校验存在性，编不出来）。
 * 不是挂载建议的调用返回 null（其余罐头照旧）。
 */
function suggestCanned(prompt: string): string | null {
  if (/你是卡片盒挂载树的检索查询官/.test(prompt)) return cannedQuery(prompt);
  if (/你是卡片盒挂载树的采纳官/.test(prompt)) return cannedAdopt(prompt);
  if (/你是卡片盒挂载树的定位官/.test(prompt)) return cannedLocate(prompt);
  return null;
}

/** 剥掉双链/加粗/列表符，留可读的纯文本（检索句子用） */
function plainText(s: string): string {
  return String(s ?? '')
    .replace(/!?\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g, (_m, target: string, alias?: string) => (alias || target).replace(/#\^?[^\]]*$/, ''))
    .replace(/[*`>]/g, '')
    .replace(/^[-•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 轮 1 查询官：把每段改写成一句 20–40 字短句 + 3–6 个关键词（关键词取假索引里真能命中的词） */
function cannedQuery(prompt: string): string {
  const segs = [...prompt.matchAll(/^### s(\d+)：(.+)$/gm)].map((m) => ({ n: Number(m[1]), text: m[2].trim() }));
  const items = segs.map((s) => {
    const plain = plainText(s.text);
    const first = plain.split(/[。！？；]/)[0] ?? plain;
    const sentence = (first.length > 40 ? `${first.slice(0, 39)}…` : first) || plain.slice(0, 40);
    const lower = plain.toLowerCase();
    const keys = AI_INDEX.flatMap((it) => it.keys).filter((k) => lower.includes(k.toLowerCase()));
    return {
      seg: s.n,
      sentence: /[。！？]$/.test(sentence) ? sentence : `${sentence}。`,
      keywords: [...new Set(keys)].slice(0, 5).join(' '),
      why: `这一段在讲「${sentence.slice(0, 18)}」`,
    };
  });
  return JSON.stringify(items);
}

/** 2-gram 重合度（候选 ↔ 片段配对用；中文按双字切片足够分辨「像不像」） */
function ngramOverlap(a: string, b: string): number {
  const grams = (s: string): Set<string> => {
    const t = plainText(s).replace(/\s+/g, '');
    const out = new Set<string>();
    for (let i = 0; i + 1 < t.length; i++) out.add(t.slice(i, i + 2));
    return out;
  };
  const ga = grams(a);
  const gb = grams(b);
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return hit;
}

/**
 * 轮 2 采纳官：候选池按最高分排序，逐个配给**最像的那一段**（2-gram 重合度，只在候选自己命中过的片段里挑）。
 * 宁缺勿滥：一段只配一条、最多 3 条。分数沿用候选池的最高分（本地还有 ≥0.7 的闸）。
 */
function cannedAdopt(prompt: string): string {
  const segs = [...prompt.matchAll(/^### s(\d+)：(.+)$/gm)].map((m) => ({ n: Number(m[1]), text: m[2] }));
  const cands = [...prompt.matchAll(/^- c\d+：(.*?)（(.+?)）命中 (\d+) 次 · 最高分 ([\d.]+)｜片段 ([^\n]*)$/gm)].map((m) => ({
    name: m[1].trim(),
    path: m[2].trim(),
    hits: Number(m[3]),
    score: Number(m[4]),
    segs: [...m[5].matchAll(/s(\d+)/g)].map((x) => Number(x[1])),
    chunk: m[5].split('｜').pop()?.trim() ?? '',
  }));
  const ranked = cands.slice().sort((a, b) => b.score - a.score || b.hits - a.hits || a.path.localeCompare(b.path));
  const used = new Set<number>();
  const out: Array<{ seg: number; path: string; score: number; reason: string }> = [];
  for (const c of ranked) {
    if (out.length >= 3) break;
    const pool = (c.segs.length ? c.segs : segs.map((s) => s.n)).filter((n) => !used.has(n));
    if (!pool.length) continue;
    let best = pool[0];
    let bestHit = -1;
    for (const n of pool) {
      const seg = segs.find((s) => s.n === n);
      if (!seg) continue;
      const hit = ngramOverlap(seg.text, `${c.name} ${c.chunk}`);
      if (hit > bestHit) {
        bestHit = hit;
        best = n;
      }
    }
    used.add(best);
    out.push({
      seg: best,
      path: c.path,
      score: Math.min(0.95, Math.max(0.75, c.score)),
      reason: `这一段与《${c.name}》讲的是同一件事（召回命中 ${c.hits} 次）`,
    });
  }
  return JSON.stringify(out.sort((a, b) => a.seg - b.seg));
}

/**
 * 轮 3 定位官：现读目标全文后定粒度。n1 整篇 / n2 小节 / n3 段落轮着来，
 * 标题与摘录都从 prompt 里的目标全文**逐字**抄（抄不到就退回整篇，绝不编）。
 * anchor 回填主卡锚点原文——链路本地三级回定位后采用，锚点因此与高亮位置一致。
 */
function cannedLocate(prompt: string): string {
  const parts = prompt.split(/^## n(\d+) · .*$/gm);
  const out: Array<Record<string, unknown>> = [];
  // split 后形如 [前言, '1', 块1, '2', 块2, …]
  for (let i = 1; i < parts.length; i += 2) {
    const n = Number(parts[i]);
    const block = parts[i + 1] ?? '';
    const anchor = (/^主卡锚点原文：(.*)$/m.exec(block)?.[1] ?? '').trim();
    const body = block.split('### 目标笔记全文')[1] ?? '';
    const heading = (/^#{1,6}[ \t]+(.+)$/m.exec(body)?.[1] ?? '').trim();
    const para = (/^（\d+）(.+)$/m.exec(body)?.[1] ?? '').trim();
    // 第一条给整篇（最常见的形态），其余按目标笔记自己有没有标题/段落定粒度——
    // 三种形态在壳里都能看到，且都指得到真实存在的小节 / 段落（链路本地会校验，编不出来）
    const idx = out.length;
    const unit = idx === 0 ? 'whole' : heading ? 'heading' : para ? 'paragraph' : 'whole';
    out.push({
      n,
      unit,
      heading: unit === 'heading' ? heading : '',
      quote: unit === 'paragraph' ? para.slice(0, 60) : '',
      anchor,
      reason: unit === 'heading' ? `只有「${heading}」这一节与主卡相关` : unit === 'paragraph' ? '目标笔记里这一段与主卡直接呼应' : '整篇都与主卡同一主题',
      skip: false,
    });
  }
  return JSON.stringify(out);
}

export async function requestUrl(opts?: { url?: string; body?: string }): Promise<{ status: number; text: string }> {
  const url = String(opts?.url ?? '');
  if (/^https:\/\/(www\.)?b23\.tv\//.test(url)) {
    return {
      status: 200,
      text: '<html><head><title>（演示）短链落地页_哔哩哔哩_bilibili</title>'
        + '<meta property="og:url" content="https://www.bilibili.com/video/BV1awbg6XELn/"></head><body><script>'
        + 'window.__INITIAL_STATE__=' + JSON.stringify({
          videoData: {
            bvid: 'BV1awbg6XELn', title: '（演示）短链落地页', owner: { name: '短链 UP 主' }, duration: 1800,
            pages: [
              { cid: 1, page: 1, part: '上集 · 开场', duration: 720 },
              { cid: 2, page: 2, part: '中集 · 展开', duration: 600 },
              { cid: 3, page: 3, part: '下集 · 收尾', duration: 480 },
            ],
          },
        }) + ';(function(){})();</script></body></html>',
    };
  }
  const view = /web-interface\/view\?bvid=(BV[0-9A-Za-z]{10})/.exec(url);
  if (view) {
    return {
      status: 200,
      text: JSON.stringify({
        code: 0,
        message: '0',
        data: {
          bvid: view[1],
          title: `（演示标题）${view[1]}：一条可回放的 B 站视频`,
          owner: { mid: 42, name: '演示 UP 主' },
          duration: 1800,
          pages: [
            { cid: 1, page: 1, part: '上集 · 开场', duration: 720 },
            { cid: 2, page: 2, part: '中集 · 展开', duration: 600 },
            { cid: 3, page: 3, part: '下集 · 收尾', duration: 480 },
          ],
        },
      }),
    };
  }
  if (!/chat\/completions/.test(url)) throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
  let prompt = '';
  /** 多模态部件里真的收到了几张图（issue 312 图版：评审壳要能证明图确实发到了 AI 层） */
  let imgCount = 0;
  let imgChars = 0;
  try {
    const body = JSON.parse(String(opts?.body ?? '{}')) as { messages?: Array<{ content?: unknown }> };
    const texts: string[] = [];
    for (const m of body.messages || []) {
      const c = m?.content;
      if (typeof c === 'string') { texts.push(c); continue; }
      if (!Array.isArray(c)) continue;
      // 带图消息：content 是 OpenAI 多模态数组（{type:'text'} / {type:'image_url'}）
      for (const part of c) {
        const p = part as { type?: string; text?: string; image_url?: { url?: string } } | null;
        if (!p) continue;
        if (p.type === 'text') texts.push(String(p.text ?? ''));
        else if (p.type === 'image_url') { imgCount++; imgChars += String(p.image_url?.url ?? '').length; }
      }
    }
    prompt = texts.join('\n');
  } catch { /* 原样空提示词 */ }
  let content: string;
  const suggest = suggestCanned(prompt);
  const passage = /把下方这段文字整理成一篇文献笔记/.exec(prompt);
  const term = /为术语「([^」]+)」生成一篇文献笔记/.exec(prompt);
  const img = /看这张图片|看下面这 \d+ 张图片/.exec(prompt);
  if (suggest !== null) {
    content = suggest;
  } else if (img) {
    // 图版录入（issue 312；多图 issue 313）：读图 → 演示级「自动图题 + 读图解读 + 领域」；
    // 回包里带上实际收到的图片数量与 base64 长度，自检据此断言「图真的走到了 AI 层」
    const domains = /从以下领域选一个最贴近的：([^；」]+)/.exec(prompt);
    const domain = domains ? domains[1].split('、')[0] : '艺术';
    const multi = imgCount > 1;
    content = JSON.stringify({
      title: `（演示图题）${multi ? `${imgCount} 张图` : '一张图'}的内容整理`,
      summary: `（演示读图）已收到图片（${imgCount} 张，base64 ${imgChars} 字符）——这里回放的是图版录入的读图结果，用于评审拖图 / 粘贴 / 多图、自动图题与关联行；图片本体在确认写入时落进图片目录（默认文献目录下的 assets/，可在设置里改）。`,
      domain,
    });
  } else if (passage) {
    // 段落录入（issue 309）：一段文字 → 演示级「自动标题 + 整理正文 + 领域」
    const src = (/【原文】\n([\s\S]+)/.exec(prompt)?.[1] ?? '').replace(/\s+/g, ' ').trim();
    const domains = /从以下领域选一个最贴近的：([^；」]+)/.exec(prompt);
    const domain = domains ? domains[1].split('、')[0] : '心理';
    content = JSON.stringify({
      title: `（演示标题）${src.slice(0, 14)}${src.length > 14 ? '…' : ''}的要点整理`,
      summary: `（演示整理）${src.slice(0, 120)}……原型环境由 fake AI 罐头回放生成，用于评审段落录入、自动标题与关联行交互。`,
      domain,
    });
  } else if (term) {
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
      t = t.replace(/!\[\[([^\]]+)\]\]/g, (_m, p1: string) => {
        if (/\.(mp4|webm|mkv)$/i.test(p1)) return '<video controls preload="metadata" src="./assets/demo.mp4"></video>';
        const url = fakeResourceUrl(p1); // 图版落盘的图片本体（data URL）
        if (url) return `<img class="bz-kb-embed-img" src="${url}" alt="">`;
        return `<span class="bz-kb-cite">${p1}</span>`;
      });
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
          // 图片嵌入（图版）：壳里的图片本体就是 data URL，直接出 <img>（评审壳要看得见图）
          const imgUrl = fakeResourceUrl(fullEmbed[1]);
          if (imgUrl) out.push(`<p><img class="bz-kb-embed-img" src="${imgUrl}" alt=""></p>`);
          else out.push(`<p><span class="bz-kb-cite">${esc(fullEmbed[1])}</span></p>`);
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
    // 追加语义（ADR-0122）：真 Obsidian 的 render 是「追加到容器」而非覆盖——
    // 经 template 解析后逐节点追加，容器已有内容（如预填纯文本）时叠加，评审壳可复现真机双份（issue 275）
    const tpl = document.createElement('template');
    tpl.innerHTML = out.join('\n');
    el.appendChild(tpl.content);
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

/**
 * 壳内文件内容直读（localStorage 封套解包）——图片资源解析用（issue 312）。
 * 落盘的二进制在壳里就是 data URL 字符串，故这里原样返回；不存在返回空串。
 */
export function fakeFileContent(path: string): string {
  const raw = localStorage.getItem(KEY_PREFIX + path);
  if (raw == null) return '';
  try {
    const env = JSON.parse(raw) as Envelope | null;
    if (env && typeof env === 'object' && typeof env.c === 'string') return env.c;
  } catch {
    /* 纯文本内容原样 */
  }
  return raw;
}

/** 图片资源 URL（data URL）：笔记正文 `![[…]]` 与面板缩略图共用；非图片资源返回空串 */
export function fakeResourceUrl(path: string): string {
  const v = fakeFileContent(path);
  return /^data:image\//i.test(v) ? v : '';
}

/** Uint8Array → base64（分块防大图爆栈，同 core/ai imageDataUrl 的做法） */
function bytesToBase64(u8: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)) as unknown as number[]);
  }
  return btoa(bin);
}

export class FakeVault {
  static key(path: string): string {
    return KEY_PREFIX + path;
  }

  getResourcePath(file: { path?: string } | string): string {
    const path = typeof file === 'string' ? file : String(file?.path ?? '');
    return path ? fakeResourceUrl(path) : '';
  }

  /** 二进制落盘（图版 issue 312）：壳里存成 data URL，getResourcePath / MarkdownRenderer 直接可用 */
  async createBinary(path: string, data: ArrayBuffer): Promise<FakeFile> {
    const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const ext = String(path).split('.').pop()?.toLowerCase() || '';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext || 'png'}`;
    const raw = encodeSeedFile(`data:${mime};base64,${bytesToBase64(u8)}`);
    localStorage.setItem(KEY_PREFIX + path, raw);
    return this.toFile(path, raw);
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
