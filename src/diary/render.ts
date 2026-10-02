/**
 * 日记本（diary）渲染纯层 · markup 单源（ADR-0104 / ADR-0230）。
 *
 * 「桌上那本」：一本书落在台灯下的桌面上，翻页即翻日记。原型评审壳
 * （prototypes/diary/prototype.html，经 fake-sim.ts 跑真 ui.ts）与插件 ui.ts 消费同一份 markup：
 * 改这里一处两侧生效；**禁 obsidian / moment / core 服务 import**（render-purity 守卫强制），
 * 类型一律取 ./types（零依赖）。行为（分页测量 / StPageFlip 建书 / 事件 / 懒加载 / markdown 水合）在 ui.ts。
 *
 * 移植来源：`.scratch/diary-quill/`（v43 探索稿）的纯渲染部分，**按单源口径重写**——数据不再是
 * 快照自解析的 `buildEntries()`，而是 data.ts 的 `WallEntry[]`（已带 `segments` 段序与 `extra` 余项）。
 *
 * 两条硬约束在本次移植里的落点：
 * 1. **类名一律 `bz-diary-` 前缀**——21 个域共用一个 document，原型的裸 `.photo` / `.ticket` /
 *    `.menu` / `.sheet` 会撞车（ADR-0122 界面级单源口径）；库自身的 `.stf__*` / `.sft__*` 不在前缀范围内。
 * 2. **零内联视觉样式**——原型的三处内联（`.photo` 的 `--tilt`、票根/藏书票 `onerror` 里的
 *    `style.opacity`、贴纸册计数 `<i style=…>`）分别改为**确定性倾角类**、**ui 侧注册的错误处理**
 *    （失败时把 `data-media-err` 的值当类名换上，值即目标类全名）、**专用类**；
 *    图片失败态一律走类切换，不写行内样式。
 */
import { esc, iconSpan } from '../core/ui/str';
import type { WallEntry, WallMedia } from './types';

// ===== 媒体地址解析（纯层不碰 vault：回调由 ui 侧给） =====

/** 媒体引用名 → 可加载 URL（ui 侧走 `vault.getResourcePath`） */
export type MediaSrc = (name: string) => string;

/** 渲染期上下文：纯层只调回调，不持有状态 */
export interface RenderCtx {
  /** 媒体引用名 → 可加载 URL */
  mediaSrc: MediaSrc;
  /** 媒体引用名 → 灯箱序号（ui 侧按**首次出现顺序**登记，重复引用复用同号，防灯箱重复计数） */
  lbIndexOf: (name: string) => number;
}

// ===== 日期 / 数字文案 =====

export const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

const NUM_CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export function pad2(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

/** 中文数字：0..9999（原型注释：旧版只会数到 19，「凡一百一十五则」曾印成「凡 undefined十五则」） */
export function cnNum(n: number): string {
  const v = Math.floor(Number(n));
  if (!isFinite(v) || v < 0) return '——';
  if (v <= 10) return NUM_CN[v];
  if (v < 20) return '十' + (v % 10 ? NUM_CN[v % 10] : '');
  if (v < 100) return NUM_CN[Math.floor(v / 10)] + '十' + (v % 10 ? NUM_CN[v % 10] : '');
  if (v < 1000) {
    const r = v % 100;
    const s = NUM_CN[Math.floor(v / 100)] + '百';
    if (!r) return s;
    if (r < 10) return s + '零' + NUM_CN[r];
    if (r < 20) return s + '一十' + (r % 10 ? NUM_CN[r % 10] : '');
    return s + cnNum(r);
  }
  if (v < 10000) {
    const r = v % 1000;
    const s = NUM_CN[Math.floor(v / 1000)] + '千';
    if (!r) return s;
    return s + (r < 100 ? '零' + cnNum(r) : cnNum(r));
  }
  return String(v);
}

/** `YYYY-MM-DD` → 「星期X」（正午取时避开时区跨日） */
export function weekdayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return '星期' + WEEK[d.getDay()];
}

// ===== 确定性微旋角（照片歪得稳定：同一序号每次排版一样） =====

const TILT_BUCKETS = 6;

/** 序号 → 倾角类名（**类而非内联样式**：原型那套 `style="--tilt:…"` 违反「禁内联视觉样式」） */
export function tiltClassOf(seed: number): string {
  const x = Math.sin(seed * 997) * 10000;
  const t = (x - Math.floor(x) - 0.5) * 4; // (-2, 2)
  const k = Math.min(TILT_BUCKETS - 1, Math.max(0, Math.floor(((t + 2) / 4) * TILT_BUCKETS)));
  return `bz-diary-tilt-${k}`;
}

// ===== Markdown 迷你渲染（真实正文语法；纯层不得依赖 Obsidian MarkdownRenderer 服务） =====

/** 行内 markdown：`[[链接]]` / `**粗**` / `*斜*` / `==高亮==` / `~~删~~` / `` `码` `` */
export function inlineMd(s: string): string {
  let t = esc(s);
  t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => {
    const label = alias || target.split('/').pop()!.replace(/\.md$/, '');
    return '<span class="bz-diary-wikilink" data-target="' + esc(target) + '">' + esc(label) + '</span>';
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
  t = t.replace(/==([^=]+)==/g, '<mark class="bz-diary-hl">$1</mark>');
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  return t;
}

// ===== 块切分（正文段的 markdown → 块序列） =====

export type Block =
  | { t: 'para'; text: string; cont?: boolean }
  | { t: 'blank'; n: number }
  | { t: 'head'; level: number; text: string }
  | { t: 'quote'; text: string }
  | { t: 'list'; ordered: boolean; items: string[] }
  | { t: 'code'; text: string }
  | { t: 'hr' };

/**
 * 把**一段文字**（`WallEntry.segments` 里的 text 段，已去媒体嵌入）切成块。
 *
 * 与原型 `splitBlocks` 的差别只有一处：原型自己从 `![[…]]` 行切出媒体块；
 * 这里媒体已由 `segments` 段序给出，故本函数只管文字块（媒体段由 `entryBlockHTMLs` 归位）。
 */
export function splitTextBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = String(text).split(/\r?\n/);
  let i = 0;
  let pendingBlank = 0;
  /* 实际块前把累计的空行落成 blank 块（真实日记的段落空行，不做吸附；上限 3 段） */
  const emit = (b: Block) => {
    if (pendingBlank) {
      blocks.push({ t: 'blank', n: Math.min(pendingBlank, 3) });
      pendingBlank = 0;
    }
    blocks.push(b);
  };
  /* 超长段落按句读硬切；切出来的续块不缩进（缩进只表示原文真有的新段） */
  const pushPara = (s: string) => {
    if (s.length <= 240) {
      emit({ t: 'para', text: s });
      return;
    }
    let cur = '';
    let first = true;
    const segs = s.split(/(?<=[。!?;~」”…])/);
    for (const seg of segs) {
      cur += seg;
      if (cur.length > 200) {
        emit({ t: 'para', text: cur, cont: !first });
        first = false;
        cur = '';
      }
    }
    if (cur) emit({ t: 'para', text: cur, cont: !first });
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      emit({ t: 'code', text: buf.join('\n') });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      emit({ t: 'head', level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      emit({ t: 'quote', text: buf.join('\n') });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      emit({ t: 'list', ordered: false, items });
      continue;
    }
    if (/^\s*\d+[.、]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*\d+[.、]\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      emit({ t: 'list', ordered: true, items });
      continue;
    }
    if (/^(---+|\*\*\*+)$/.test(line.trim())) {
      emit({ t: 'hr' });
      i++;
      continue;
    }
    if (line.trim() === '') {
      pendingBlank++;
      i++;
      continue;
    }
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+[.、]\s|```|!\[\[)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    pushPara(buf.join(''));
  }
  return blocks;
}

// ===== 正文里的 `#标签`（提取到条目头部；正文中剥掉） =====

const HASH_RE = new RegExp('(^|[\\s(（【\\[])#([^\\s#,.!?;:、,。!?~»」』”…]+)', 'g');

/** 剥出正文里的 `#标签` 追加进 out，返回剥净后的文本 */
export function stripHashInto(t: string, out: string[]): string {
  return String(t).replace(HASH_RE, (_m, pre: string, tag: string) => {
    out.push(tag);
    return pre;
  });
}

// ===== 条目头（类型签） =====

/**
 * 条目头：时间 + 标签 + 正文 `#标签`（**纯文字，不带 emoji**）。
 * 时间只有日记/信才有真值——影视与书的解析里没有时刻（一律占位 `00:00`），
 * 原样渲染会在每一则影评/书评条头印出「00:00 · 电影」，把内部占位当成了内容。
 */
export function sealHTML(e: WallEntry, hashes: string[]): string {
  const tags = e.tags.map((t) => '<span class="bz-diary-seal-tag">' + esc(t) + '</span>').join('');
  const hs = hashes.length
    ? '<span class="bz-diary-seal-hashes">' +
      hashes.map((t) => '<span class="bz-diary-seal-hash">#' + esc(t) + '</span>').join('') +
      '</span>'
    : '';
  const time =
    e.kind === 'diary' || e.kind === 'letter'
      ? '<span class="bz-diary-seal-time">' + esc(e.time) + '</span>'
      : '';
  return time + '<span class="bz-diary-seal-tags">' + tags + '</span>' + hs;
}

// ===== 媒体块 =====

/** 照片 / 视频 / 录音卡。`lbIndex` 为灯箱序号（音频块不入灯箱）。 */
export function photoHTML(m: WallMedia, e: WallEntry, lbIndex: number, ctx: RenderCtx): string {
  const name = m.name;
  /*
   * 加密条目的媒体在保险箱里，vault 里没有可解析的文件——纸面**先只留挂载点**
   * （`data-enc-name` / `data-enc-kind`），拆信后由 `ui.ts::mountEncryptedMedia` 按需解密再补 src。
   * 这类媒体也不入灯箱（`collectPhotoRefs` 只收明文条目），故不发 `data-lb`。
   */
  const lazy = !!e.encrypted;
  const hook = lazy ? ' data-enc-name="' + esc(name) + '" data-enc-kind="' + m.kind + '"' : '';
  const src = lazy ? '' : ' src="' + esc(ctx.mediaSrc(name)) + '"';
  if (m.kind === 'audio') {
    /* 录音卡：自绘播放键 + 进度条 + 时辰，原生播放器不贴在纸上 */
    const label = name.split('/').pop() || name;
    return (
      '<div class="bz-diary-b-audio" data-eid="' +
      esc(e.id || '') +
      '"><div class="bz-diary-ba-card"><span class="bz-diary-ba-play">▷</span>' +
      '<span class="bz-diary-ba-mid"><span class="bz-diary-ba-name">♪ ' +
      esc(label) +
      '</span><span class="bz-diary-ba-bar"><i></i></span></span>' +
      '<span class="bz-diary-ba-time">--:--</span></div>' +
      '<audio preload="none"' +
      src +
      hook +
      '></audio></div>'
    );
  }
  /* 照片上没有字：文件名只在 alt 里（无障碍用），看得见的是按相片大小描的一圈白框 */
  const stem = String(name.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
  const alt = esc(
    /[^\d\s_\-.]/.test(stem) ? stem.slice(0, 16) : e.date.slice(5).replace('-', '/') + ' ' + e.time,
  );
  const inner =
    m.kind === 'video'
      ? '<video' + src + ' preload="metadata" muted playsinline' + hook + '></video>'
      : '<img' + src + ' loading="lazy" alt="' + alt + '"' + hook + '>';
  return (
    '<div class="bz-diary-b-photo" data-eid="' +
    esc(e.id || '') +
    '"><figure class="bz-diary-photo ' +
    tiltClassOf(lbIndex) +
    '"' +
    (lazy ? '' : ' data-lb="' + lbIndex + '"') +
    '><div class="bz-diary-ph-media">' +
    inner +
    '</div></figure></div>'
  );
}

// ===== 票根（影视）与藏书票（书） =====
// 两者的展示余项取自 `entry.extra`（ADR-0230 加性字段）：content 里这些 FM 项早被压平丢掉；
// 海报/封面则在 content 里以 `![[…]]` 出现过一次——纸面上**跳过那条媒体段**，改贴在票根/藏书票上。

const TICKET_META_ROWS: [string, string][] = [
  ['导演', '导演'],
  ['类型', '类型'],
  ['片长', '片长'],
  ['上映日期', '上映'],
];

/** 观影票根（`extra` 缺失时退化为空签，不抛） */
export function ticketHTML(e: WallEntry, ctx: RenderCtx): string {
  const x = e.extra || {};
  const meta = x.meta || {};
  const rows: string[] = [];
  for (const [key, label] of TICKET_META_ROWS) {
    const v = meta[key];
    if (!v) continue;
    rows.push('<b>' + esc(label) + '</b> ' + esc(label === '上映' ? v.slice(0, 10) : v.slice(0, 40)));
  }
  const score = meta['豆瓣评分']
    ? '<span class="bz-diary-tk-score">★ ' + esc(meta['豆瓣评分']) + '</span>'
    : '';
  const poster = x.poster
    ? '<img class="bz-diary-tk-poster" data-media-err="bz-diary-ph-empty" src="' +
      esc(ctx.mediaSrc(x.poster)) +
      '" loading="lazy" alt="">'
    : '<i class="bz-diary-tk-poster bz-diary-ph-empty"></i>';
  return (
    '<div class="bz-diary-ticket" data-eid="' +
    esc(e.id || '') +
    '">' +
    '<div class="bz-diary-tk-main"><span class="bz-diary-tk-kind">' +
    esc(e.tags[0] || '') +
    ' · 观影票根</span>' +
    '<div class="bz-diary-tk-title">《' +
    esc(x.title || '') +
    '》</div>' +
    '<div class="bz-diary-tk-meta">' +
    rows.join('　') +
    (rows.length ? '　' : '') +
    score +
    '</div>' +
    '<div class="bz-diary-tk-review">' +
    inlineMd(x.review || '') +
    '</div>' +
    '<span class="bz-diary-tk-more">… 影评全文</span></div>' +
    '<div class="bz-diary-tk-stub">' +
    poster +
    '<span class="bz-diary-tk-date">' +
    esc(e.date) +
    '</span>' +
    esc(e.emoji) +
    '</div></div>'
  );
}

/** 藏书票（书） */
export function exlibrisHTML(e: WallEntry, ctx: RenderCtx): string {
  const x = e.extra || {};
  const cover = x.cover
    ? '<img class="bz-diary-ex-cover" data-media-err="bz-diary-ex-nothing" src="' +
      esc(ctx.mediaSrc(x.cover)) +
      '" loading="lazy" alt="">'
    : '<i class="bz-diary-ex-nothing"></i>';
  const byline = x.author
    ? esc(x.author) + (x.category ? ' · ' + esc(x.category) : '')
    : esc(x.category || '');
  return (
    '<div class="bz-diary-exlibris" data-eid="' +
    esc(e.id || '') +
    '">' +
    cover +
    '<div class="bz-diary-ex-main"><div class="bz-diary-ex-title">《' +
    esc(x.title || '') +
    '》</div>' +
    '<div class="bz-diary-ex-author">' +
    byline +
    '</div>' +
    '<div class="bz-diary-ex-review">' +
    inlineMd(x.review || '') +
    '</div>' +
    '<div class="bz-diary-ex-date">读毕 ' +
    esc(e.date) +
    ' · ' +
    esc(e.emoji) +
    '</div></div></div>'
  );
}

// ===== 段块 =====

function paraHTML(b: { text: string; cont?: boolean }, e: WallEntry): string {
  return (
    '<div class="bz-diary-b-para ' +
    (b.cont ? 'bz-diary-p-cont' : 'bz-diary-p-indent') +
    '" data-eid="' +
    esc(e.id || '') +
    '">' +
    inlineMd(b.text) +
    '</div>'
  );
}

/** 火漆信封（加密条目：全文不装在纸面上，拆开后在「抽出的一张纸」里读） */
function envelopeHTML(e: WallEntry): string {
  return (
    '<div class="bz-diary-b-envelope"><div class="bz-diary-envelope" data-eid="' +
    esc(e.id || '') +
    '"><div class="bz-diary-env-body"><div class="bz-diary-env-flap"></div>' +
    '<div class="bz-diary-env-split"><i class="bz-diary-es-l"></i><i class="bz-diary-es-r"></i></div>' +
    '<div class="bz-diary-env-wax">🔐</div><div class="bz-diary-env-label">火漆封缄 · 拆信需主密码</div></div>' +
    '<span class="bz-diary-env-reseal">重新封缄</span></div></div>'
  );
}

/**
 * 条目 → 块 HTML 串（按纸面顺序）。日戳不在此列——由分页器在日界处插 `daystampHTML`。
 *
 * 派生规则（与原型一致）：
 * - 加密条目 → 只有信封一块（`opts.unwrap` 时例外，见下）；
 * - 影视/书 → 类型签 + 票根/藏书票（**正文段整体跳过**：那两类的 content 是解析期压平的
 *   `影评 + ![[海报]]` / `书名 + 书评 + ![[封面]]`，正文已由票根/藏书票承载，再渲一遍就是重复）；
 * - 信 → 类型签 + 标题行 + 正文段流（与日记同构，不截断）；
 * - 日记 → 类型签 + 正文段流。
 *
 * `opts.unwrap`：拆信后那张纸要的是**加密条目的全文**——跳过信封分支，但仍以「加密」身份渲染，
 * 这样媒体段会发出 `data-enc-name` 挂载点（`photoHTML`）供按需解密。
 */
export function entryBlockHTMLs(
  e: WallEntry,
  ctx: RenderCtx,
  opts: { unwrap?: boolean } = {},
): string[] {
  const eid = esc(e.id || '');
  const wrap = (cls: string, inner: string) =>
    '<div class="' + cls + '" data-eid="' + eid + '">' + inner + '</div>';

  if (e.encrypted && !opts.unwrap) return [envelopeHTML(e)];

  /* `#标签` 先收集（供类型签展示），正文里不要再出现 */
  const hashes: string[] = [];
  for (const seg of e.segments) {
    if (seg.kind !== 'text') continue;
    for (const b of splitTextBlocks(seg.text)) {
      if (b.t === 'para' || b.t === 'quote') stripHashInto(b.text, hashes);
    }
  }

  const out: string[] = [];
  out.push('<div class="bz-diary-b-seal" data-eid="' + eid + '">' + sealHTML(e, hashes) + '</div>');

  if (e.kind === 'movie') return out.concat(wrap('bz-diary-b-ticket', ticketHTML(e, ctx)));
  if (e.kind === 'book') return out.concat(wrap('bz-diary-b-exlibris', exlibrisHTML(e, ctx)));
  if (e.kind === 'letter') {
    out.push(
      '<div class="bz-diary-b-head" data-eid="' + eid + '">' + esc(basenameOf(e.filename)) + '</div>',
    );
  }

  for (const seg of e.segments) {
    if (seg.kind === 'media') {
      out.push(photoHTML(seg.media, e, ctx.lbIndexOf(seg.media.name), ctx));
      continue;
    }
    for (const b of splitTextBlocks(seg.text)) {
      switch (b.t) {
        case 'blank':
          out.push(
            '<div class="bz-diary-b-blank bz-diary-blank-' + b.n + '" data-eid="' + eid + '"></div>',
          );
          break;
        case 'para': {
          const t = stripHashInto(b.text, []);
          if (t.trim()) out.push(paraHTML({ text: t, cont: b.cont }, e));
          break;
        }
        case 'head':
          out.push(
            '<div class="bz-diary-b-head' +
              (b.level > 2 ? ' bz-diary-h2' : '') +
              '" data-eid="' +
              eid +
              '">' +
              esc(b.text.replace(/[#*]/g, '')) +
              '</div>',
          );
          break;
        case 'quote': {
          const t = stripHashInto(b.text, []);
          out.push(wrap('bz-diary-b-quote', inlineMd(t).replace(/\n/g, '<br>')));
          break;
        }
        case 'list':
          out.push(
            '<ul class="bz-diary-b-list' +
              (b.ordered ? ' bz-diary-ordered' : '') +
              '" data-eid="' +
              eid +
              '">' +
              b.items.map((it) => '<li>' + inlineMd(it) + '</li>').join('') +
              '</ul>',
          );
          break;
        case 'code':
          out.push(wrap('bz-diary-b-code', esc(b.text)));
          break;
        case 'hr':
          out.push('<hr class="bz-diary-b-hr" data-eid="' + eid + '">');
          break;
      }
    }
  }
  return out;
}

/** 日戳（新的一天：大日号 + 月/星期/则数 + 年份 + 一道水纹） */
export function daystampHTML(date: string, count: number): string {
  const [y, m, dd] = date.split('-');
  return (
    '<div class="bz-diary-b-daystamp" data-date="' +
    esc(date) +
    '"><div class="bz-diary-dstamp">' +
    '<span class="bz-diary-ds-day">' +
    Number(dd) +
    '</span>' +
    '<span class="bz-diary-ds-side"><b>' +
    parseInt(m, 10) +
    '月</b><i>' +
    weekdayOf(date) +
    '</i><em>' +
    cnNum(count) +
    ' 则</em></span>' +
    '<span class="bz-diary-ds-year">' +
    esc(y) +
    '</span></div>' +
    '<div class="bz-diary-ds-wave"></div></div>'
  );
}

/**
 * 写作内页的日戳（ADR-0233）：与正文日戳**同源同款**（大日号 + 月/星期 + 年份 + 一道水纹），
 * 只把「N 则」那句换成「改日子 · 时辰」那枚小签——写作时它是可点的，读的时候它是计数。
 */
export function writeDaystampHTML(date: string): string {
  const [y, m, dd] = date.split('-');
  return (
    '<div class="bz-diary-dstamp">' +
    '<span class="bz-diary-ds-day">' +
    Number(dd) +
    '</span>' +
    '<span class="bz-diary-ds-side"><b>' +
    parseInt(m, 10) +
    '月</b><i>' +
    weekdayOf(date) +
    '</i><em><span class="bz-diary-wsp-datebtn">改日子 · 时辰</span></em></span>' +
    '<span class="bz-diary-ds-year">' +
    esc(y) +
    '</span></div>' +
    '<div class="bz-diary-ds-wave"></div>'
  );
}

/** 文件名（信笺标题用）：取路径末段去扩展名 */
function basenameOf(p: string | undefined): string {
  return String(p || '')
    .split('/')
    .pop()!
    .replace(/\.md$/, '');
}

// ===== 面板壳（书桌全景；ui 侧只负责挂事件与填内容） =====

/**
 * 书桌 markup：书（底壳/厚度/书口/书芯）+ 文具排 + 明信片 + 引导便签 +
 * 六个弹层（便签菜单/抽出的纸/纸条/贴纸册/台历/灯箱）+ 吐司。全是空壳，数据与文案由 ui 侧填。
 */
export function bookPanelHTML(): string {
  return `
  <!-- 收起整本：右上角常驻一枚出口（另两条路：点遮罩、Esc——先翻回最新那篇，再按一次收起） -->
  <button class="bz-diary-close" type="button" title="收起日记本（Esc）" aria-label="收起日记本">${iconSpan('x')}</button>

    <div class="bz-diary-desk">
    <!-- 遮罩层（token 底色 + blur）：点空白处收起整本；书：打开就落在最新那篇（第 0 页 = 最近一则） -->
    <div class="bz-diary-book" tabindex="0">
      <!-- 底壳与厚度 -->
      <div class="bz-diary-bk-shell"></div>
      <div class="bz-diary-bk-under"></div>
      <!-- 书口：书页那一摞的侧面，压在书页底下只探出右沿几像素——点它抽出册页索引 -->
      <div class="bz-diary-bk-edge"></div>
      <span class="bz-diary-eb-hint">抽出册页索引</span>

      <!-- 芯：StPageFlip 书（全是正文页，无扉页；库管理翻页动画/拖拽） -->
      <div class="bz-diary-bk-block">
        <div class="bz-diary-flipbook"></div>
      </div>

      <!-- 分类书签条（筛选态） -->
      <div class="bz-diary-filter-tab"><span class="bz-diary-ft-name"></span><span class="bz-diary-ft-x">取下</span></div>

      <!-- 写作内页（ADR-0233）：点「写」就在书上摊开一张素纸，正文写在这一页上。
           摆这一层（书页之上、书壳之内）而不是进 StPageFlip 的书页流：草稿不该被分页，
           而它盖住书页的指针区，「草稿在时不翻页」也就落成了物理事实。
           日戳由 ui 侧填（与 daystampHTML 同源），贴纸 chips 与正文区在这里只是空壳。 -->
      <div class="bz-diary-wsp" hidden>
        <div class="bz-diary-wsp-sheet">
          <div class="bz-diary-wsp-day"></div>
          <textarea class="bz-diary-wsp-area" spellcheck="false" placeholder="笔递给你了，写吧……"></textarea>
          <div class="bz-diary-wsp-tools"></div>
          <div class="bz-diary-wsp-acts">
            <span class="bz-diary-wsp-act" data-wact="discard">揉掉</span>
            <span class="bz-diary-wsp-act bz-diary-wsp-primary" data-wact="save">落笔</span>
          </div>
        </div>
        <div class="bz-diary-wsp-pageno">— 新的一页 —</div>
      </div>
    </div>

    <!-- 开册进度：读全量之前书还是空的（上千篇正文走磁盘读、每批 10），
         桌上先摆一张「正在翻找」的纸条报读到哪儿了，读完换「正在装订」，成册即收。
         不吃指针（pointer-events: none）：读盘期间点遮罩照样能收起整本。 -->
    <div class="bz-diary-loading" hidden>
      <div class="bz-diary-ld-paper">
        <div class="bz-diary-ld-title"></div>
        <div class="bz-diary-ld-bar"></div>
        <div class="bz-diary-ld-count"></div>
      </div>
    </div>

    <!-- 案头文具挂在桌上、不挂在书里：书在窄桌面下会被整体缩小，
         文具跟着缩就成了「小一号的纸签」。挂在桌上按缩放后的书沿定位，尺寸永远是真的。
         文具共四件：写 / 找 / 跳 / 类 —— 原型第五件「抹（抹掉全部本地涂改）」处置见 ADR-0230
         决策 9：那是探索稿 localStorage 覆盖层专有的概念，单源没有对应的真对象，故不搬。 -->
    <div class="bz-diary-tools">
      <span class="bz-diary-tl" data-tact="pencil" title="写一篇"><b>写</b></span>
      <span class="bz-diary-tl" data-tact="lens" title="找一找"><b>找</b></span>
      <span class="bz-diary-tl" data-tact="calendar" title="跳日子"><b>跳</b></span>
      <span class="bz-diary-tl" data-tact="stickers" title="按类翻"><b>类</b></span>
    </div>

    <!-- 明信片（那年今日）与引导便签已整件退役：开册就往桌上摆的非请求物件，
         与「只要日记本本身」冲突（桌面端关闭钮也摘了，收起走 Esc / 点遮罩） -->
  </div>

  <!-- 便签菜单（条目操作） -->
  <div class="bz-diary-menu" hidden>
    <div class="bz-diary-mn-item" data-act="retype">换张贴纸</div>
    <div class="bz-diary-mn-item" data-act="envelope">收进信封</div>
    <div class="bz-diary-mn-item" data-act="unseal">拆信看</div>
    <div class="bz-diary-mn-item" data-act="takeout">从信封取出</div>
    <div class="bz-diary-mn-item" data-act="copytext">誊录正文</div>
    <div class="bz-diary-mn-item" data-act="copylink">誊录位置</div>
    <div class="bz-diary-mn-item bz-diary-danger" data-act="tear">撕掉</div>
  </div>

  <!-- 抽出的一张纸：全文阅读（影评/书评/拆开的信） -->
  <div class="bz-diary-sheet" hidden>
    <div class="bz-diary-sheet-paper">
      <div class="bz-diary-sheet-head"><span class="bz-diary-sh-title"></span><span class="bz-diary-sh-close">收回去</span></div>
      <div class="bz-diary-sheet-body"></div>
    </div>
  </div>

  <!-- 纸条层：输入/确认 通用 -->
  <div class="bz-diary-slip" hidden>
    <div class="bz-diary-slip-paper">
      <div class="bz-diary-slip-title"></div>
      <div class="bz-diary-slip-body"></div>
      <div class="bz-diary-slip-row"></div>
    </div>
  </div>

  <!-- 火漆密码框：拆信/收进信封/看加密照片都要过这道（主密码交给真保险箱校验，
       本域只负责收，绝不碰密码学——原型那个演示用假密码框不搬，见 ui.ts 头部注记） -->
  <div class="bz-diary-pass" hidden>
    <div class="bz-diary-pass-paper">
      <div class="bz-diary-pass-wax">${iconSpan('lock')}</div>
      <div class="bz-diary-pass-title">火漆封缄</div>
      <div class="bz-diary-pass-desc">这一下要动保险箱，先报主密码</div>
      <input class="bz-diary-pass-input" type="password" spellcheck="false"
             autocomplete="off" placeholder="主密码">
      <div class="bz-diary-pass-err"></div>
      <div class="bz-diary-pass-row">
        <span class="bz-diary-pass-btn" data-pact="cancel">算了</span>
        <span class="bz-diary-pass-btn bz-diary-primary" data-pact="ok">拆封</span>
      </div>
    </div>
  </div>

  <!-- 贴纸册弹层 -->
  <div class="bz-diary-album-pop" hidden>
    <div class="bz-diary-ap-book">
      <div class="bz-diary-ap-head">贴纸册<span class="bz-diary-ap-sub"></span></div>
      <div class="bz-diary-ap-grid"></div>
      <div class="bz-diary-ap-foot"><span class="bz-diary-ap-confirm bz-diary-slip-btn bz-diary-primary" hidden>盖上去</span><span class="bz-diary-ap-cancel">合上</span></div>
    </div>
  </div>

  <!-- 台历弹层 -->
  <div class="bz-diary-cal-pop" hidden>
    <div class="bz-diary-cal">
      <div class="bz-diary-cal-head">
        <span class="bz-diary-cal-nav" data-nav="-1">◂</span>
        <span class="bz-diary-cal-ym"></span>
        <span class="bz-diary-cal-nav" data-nav="1">▸</span>
      </div>
      <div class="bz-diary-cal-grid"></div>
      <div class="bz-diary-cal-time-row" hidden>
        <span class="bz-diary-ct-label">时辰</span>
        <input class="bz-diary-ct-input" spellcheck="false" placeholder="21:30 或「1 分钟前」">
        <span class="bz-diary-ct-err"></span>
      </div>
      <div class="bz-diary-cal-foot"><span class="bz-diary-cal-ok">就这天</span><span class="bz-diary-cal-cancel">合上</span></div>
    </div>
  </div>

  <!-- 灯箱：相片显影 -->
  <div class="bz-diary-lightbox" hidden>
    <figure class="bz-diary-lb-photo">
      <div class="bz-diary-lb-media"></div>
      <figcaption class="bz-diary-lb-cap"></figcaption>
    </figure>
    <div class="bz-diary-lb-nav bz-diary-lb-prev">◂</div>
    <div class="bz-diary-lb-nav bz-diary-lb-next">▸</div>
    <div class="bz-diary-lb-count"></div>
  </div>

  <div class="bz-diary-toast" hidden></div>
  <div class="bz-diary-fallback" hidden><div class="bz-diary-fb-paper">册子的数据没读出来。<br>可以把日记本关掉再开一次试试。</div></div>
    `;
}

// ===== 媒体 MIME（灯箱/音频块用；按扩展名判定） =====

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
};

/** 媒体引用名 → MIME（未知扩展名回落 application/octet-stream） */
export function mimeOfMediaName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}
