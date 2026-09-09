/**
 * 第二大脑渲染纯层（issue 251 / ADR-0110；ADR-0104 markup 单源）
 *
 * 三界面 markup 单源：主面板 / AI 对话 / 灵感参考（定稿原型
 * .zcode/ui-prototypes/secondbrain-final/，P1 布局 × P2 米白红棕主题）。
 * 零 obsidian 依赖：相对时间等环境串由行为层注入；图标出 data-lucide 占位
 * （行为层渲染后 mountIcons 统一物化）。统计纯函数（computeStats/buildSourceTree/
 * fmtCompact）自 panel.ts 收编，口径不变（statistics.test 同步改锚）。
 */

// ==================== 类型（口径与旧 panel.ts 一致） ====================

export interface SourceDistItem {
  name: string;
  notes: number;
  chunks: number;
}

export interface RecentNote {
  path: string;
  mtime: number;
  chunks: number;
}

export interface SecondBrainStats {
  chunkCount: number;
  noteCount: number;
  dim: number;
  lastIndexedAt: number | null;
  bySource: SourceDistItem[];
  recent: RecentNote[];
  trend12w: number[];
  totalChars: number;
  avgChunkLen: number;
  avgChunksPerNote: number;
  metaBytes: number;
  vecBytes: number;
}

export interface SourceTreeNode {
  name: string;
  path: string;
  notes: number;
  chunks: number;
  children: SourceTreeNode[];
}

// ==================== 统计纯函数（自 panel.ts 收编，口径不变） ====================

function topLevelDir(path: string): string {
  const i = path.indexOf('/');
  return i === -1 ? '（根目录）' : path.slice(0, i);
}

export function fmtCompact(n: number): string {
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (n >= 1_000_000_000) return `${trim((n / 1_000_000_000).toFixed(1))}B`;
  if (n >= 1_000_000) return `${trim((n / 1_000_000).toFixed(1))}M`;
  if (n >= 10_000) return `${trim((n / 1000).toFixed(1))}K`;
  return n.toLocaleString();
}

/** 由 meta.notes 聚合全部统计（本地计算，秒开） */
export function computeStats(meta: SecondBrainMeta, now = Date.now()): Omit<SecondBrainStats, 'metaBytes' | 'vecBytes'> {
  const bySource = new Map<string, SourceDistItem>();
  let chunkCount = 0;
  let totalChars = 0;
  const recent: RecentNote[] = [];
  // 12 周桶：桶 0=最早，桶 11=本周
  const weekMs = 7 * 24 * 3600 * 1000;
  const thisWeekStart = Math.floor(now / weekMs) * weekMs;
  const trend12w = new Array<number>(12).fill(0);

  for (const [path, entry] of Object.entries(meta.notes)) {
    const chunks = entry.chunks.length;
    chunkCount += chunks;
    let chars = 0;
    for (const c of entry.chunks) chars += c.text.length;
    totalChars += chars;
    const dir = topLevelDir(path);
    const item = bySource.get(dir) || { name: dir, notes: 0, chunks: 0 };
    item.notes++;
    item.chunks += chunks;
    bySource.set(dir, item);
    recent.push({ path, mtime: entry.mtime, chunks });
    const bucket = 11 - Math.floor((thisWeekStart - entry.mtime) / weekMs);
    if (bucket >= 0 && bucket <= 11) trend12w[bucket]++;
  }

  recent.sort((a, b) => b.mtime - a.mtime);
  const bySourceArr = [...bySource.values()].sort((a, b) => b.chunks - a.chunks);
  const noteCount = Object.keys(meta.notes).length;
  return {
    chunkCount,
    noteCount,
    dim: meta._dim || 0,
    lastIndexedAt: recent[0]?.mtime ?? null,
    bySource: bySourceArr,
    recent: recent.slice(0, 10),
    trend12w,
    totalChars,
    avgChunkLen: chunkCount ? Math.round(totalChars / chunkCount) : 0,
    avgChunksPerNote: noteCount ? Math.round((chunkCount / noteCount) * 10) / 10 : 0,
  };
}

/** 由 meta.notes 构建来源目录树（纯函数）：每级节点聚合其下全部笔记/块数，子节点按 chunks 降序 */
export function buildSourceTree(meta: SecondBrainMeta): SourceTreeNode[] {
  const roots = new Map<string, SourceTreeNode>();
  const childOf = new Map<string, SourceTreeNode[]>(); // dirPath → children
  const nodeOf = new Map<string, SourceTreeNode>();

  const ensureDir = (dir: string): SourceTreeNode => {
    let node = nodeOf.get(dir);
    if (node) return node;
    const segs = dir.split('/').filter(Boolean);
    node = {
      name: segs[segs.length - 1] || dir,
      path: dir,
      notes: 0,
      chunks: 0,
      children: [],
    };
    nodeOf.set(dir, node);
    if (segs.length === 1) {
      roots.set(dir, node);
    } else {
      const parent = ensureDir(segs.slice(0, -1).join('/'));
      const siblings = childOf.get(parent.path) || [];
      siblings.push(node);
      childOf.set(parent.path, siblings);
    }
    return node;
  };

  for (const [path, entry] of Object.entries(meta.notes)) {
    // 根目录文件（无 '/'）归入「（根目录）」；注意 lastIndexOf=-1 时不能 slice(0,-1) 切掉末字符
    const idx = path.lastIndexOf('/');
    const dir = idx === -1 ? '（根目录）' : path.slice(0, idx);
    // 逐级向上聚合：每一级目录节点都计入其下全部笔记与块（树形口径，ticket 108）
    let cursor: SourceTreeNode | null = ensureDir(dir);
    while (cursor) {
      cursor.notes++;
      cursor.chunks += entry.chunks.length;
      const segs = cursor.path.split('/').filter(Boolean);
      if (segs.length <= 1) break; // 到达顶层（含「（根目录）」）即止
      cursor = nodeOf.get(segs.slice(0, -1).join('/')) ?? null;
    }
  }

  // 物化父子连接：ensureDir 期间子节点挂到 childOf[父 path]，此处回填到各节点 .children
  for (const node of nodeOf.values()) {
    node.children = childOf.get(node.path) || [];
  }

  const sortChildren = (arr: SourceTreeNode[]): void => {
    arr.sort((a, b) => b.chunks - a.chunks);
    for (const c of arr) sortChildren(c.children);
  };
  const rootsArr = [...roots.values()];
  sortChildren(rootsArr);
  return rootsArr;
}

// ==================== 来源色板（定稿原型四色 + 兜底） ====================

/** 来源四色（定稿原型）：按 bySource 排序位取色，超出调色板循环取中性色 */
export const SB_PALETTE = ['#0f766e', '#6366f1', '#d97706', '#db2777', '#0e7490', '#7c3aed', '#b45309', '#be185d'];
const SB_FALLBACK = '#a39b8c';

export function sbSourceColor(name: string, order: Map<string, number>): string {
  const i = order.get(name);
  if (i === undefined) return SB_FALLBACK;
  return SB_PALETTE[i % SB_PALETTE.length];
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const ic = (name: string, size = 15) => `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;

// ==================== 主面板 markup ====================

export interface PanelCardItem {
  v: string;
  k: string;
  tip?: string;
  acc?: boolean;
  warn?: boolean;
}

/** 主面板完整骨架：头行 + 内容态（统计带/趋势+最近｜来源树+摘要/底部操作）+ 引导态 */
export function panelShellHtml(): string {
  return `
  <div class="bz-sb-head">
    <div class="bz-sb-glyph">${ic('brain', 19)}</div>
    <div class="bz-sb-head-title">
      <h3>第二大脑</h3>
      <div class="bz-sb-cnt" id="bz-sb-cnt"></div>
    </div>
    <div class="bz-sb-pill"><i class="bz-sb-pill-dot"></i><span id="bz-sb-pill-txt">索引健康</span></div>
    <div class="bz-sb-head-sp"></div>
    <div class="bz-sb-panel-btns">
      <button class="bz-sb-panel-func bz-sb-fbtn bz-sb-fbtn--icon" id="bz-sb-open-chat" aria-label="AI 对话" title="AI 对话">${ic('message-square', 14)}</button>
      <button class="bz-sb-panel-func bz-sb-fbtn bz-sb-fbtn--icon" id="bz-sb-open-ref" aria-label="灵感参考" title="灵感参考">${ic('radar', 14)}</button>
    </div>
  </div>
  <div class="bz-sb-panel-body">
    <div class="bz-sb-panel-content" id="bz-sb-content" style="display:none">
      <div class="bz-sb-cards" id="bz-sb-cards"></div>
      <div class="bz-sb-grid">
        <div class="bz-sb-col">
          <div class="bz-sb-section bz-sb-section-trend">
            <div class="bz-sb-ct">${ic('activity', 13)}近 12 周向量化<span class="bz-sb-ct-n" id="bz-sb-trend-sum"></span></div>
            <div id="bz-sb-trend" class="bz-sb-trend"></div>
          </div>
          <div class="bz-sb-section bz-sb-section-recent">
            <div class="bz-sb-ct">${ic('history', 13)}最近向量化<span class="bz-sb-ct-n" id="bz-sb-recent-n"></span></div>
            <div id="bz-sb-recent" class="bz-sb-recent"></div>
          </div>
        </div>
        <div class="bz-sb-col">
          <div class="bz-sb-section bz-sb-section-dist">
            <div class="bz-sb-ct">${ic('layers', 13)}来源分布<span class="bz-sb-ct-n" id="bz-sb-dist-n"></span></div>
            <div id="bz-sb-dist" class="bz-sb-dist"></div>
          </div>
          <div class="bz-sb-section bz-sb-ai" id="bz-sb-ai-card">
            <div class="bz-sb-ct bz-sb-ai-ct">${ic('sparkles', 13)}库摘要<span class="bz-sb-ct-n" id="bz-sb-ai-when"></span></div>
            <div class="bz-sb-ai-txt" id="bz-sb-ai-txt"></div>
          </div>
        </div>
      </div>
      <div class="bz-sb-foot">
        <button class="bz-sb-fbtn bz-sb-fbtn--primary" id="bz-sb-incr" aria-label="增量更新">${ic('refresh-cw', 14)}<span class="bz-sb-fbtn-txt">增量更新</span></button>
        <button class="bz-sb-fbtn" id="bz-sb-rebuild" aria-label="全量重建">${ic('database', 14)}<span class="bz-sb-fbtn-txt">全量重建</span></button>
        <div class="bz-sb-log" id="bz-sb-log"></div>
      </div>
    </div>
    <div class="bz-sb-onboard" id="bz-sb-onboard" style="display:none">
      <div class="bz-sb-onboard-icon">${ic('brain', 34)}</div>
      <div class="bz-sb-onboard-title" id="bz-sb-progress-title">初始化向量数据库</div>
      <div class="bz-sb-onboard-desc" id="bz-sb-onboard-desc"></div>
      <button class="bz-sb-init-btn" id="bz-sb-init-btn">开始向量化</button>
      <div class="bz-sb-init-progress" id="bz-sb-init-progress">
        <div class="bz-sb-init-bar"><span class="bz-sb-init-fill" id="bz-sb-init-fill"></span></div>
        <div class="bz-sb-init-status" id="bz-sb-init-status">准备中…</div>
      </div>
    </div>
  </div>`;
}

/** 统计带六卡（值/标签/hover 精确值） */
export function panelCardsHtml(items: PanelCardItem[]): string {
  return items
    .map(
      (it) =>
        `<div class="bz-sb-card${it.acc ? ' bz-sb-card--acc' : ''}"${it.tip ? ` title="${escapeHtml(it.tip)}"` : ''}>` +
        `<div class="bz-sb-card-value${it.warn ? ' bz-sb-card-value--warn' : ''}">${it.v}</div>` +
        `<div class="bz-sb-card-label">${escapeHtml(it.k)}</div></div>`
    )
    .join('');
}

/** 近 12 周趋势（红棕柱，本周墨色） */
export function panelTrendHtml(trend: number[]): string {
  const max = Math.max(...trend, 1);
  return trend
    .map((n, i) => {
      const label = i === 11 ? '本周' : i === 5 || i === 0 ? `${11 - i}周` : '';
      const weeksAgo = 11 - i;
      return `<div class="bz-sb-trend-col${i === 11 ? ' bz-sb-trend-col--last' : ''}" title="${weeksAgo === 0 ? '本周' : `${weeksAgo} 周前`}：${n} 篇" aria-label="${n} 篇">` +
        `<div class="bz-sb-trend-bar" style="height:${Math.max(2, Math.round((n / max) * 62))}px"></div>` +
        `<span>${label}</span></div>`;
    })
    .join('');
}

/** 来源分布树（递归；expanded 为会话内记忆的展开目录集） */
export function panelDistHtml(nodes: SourceTreeNode[], expanded: Set<string>, colorOf: (name: string) => string, maxChunks: number, depth = 0): string {
  return nodes
    .map((node) => {
      const hasChildren = node.children.length > 0;
      const open = expanded.has(node.path);
      const row = `<div class="bz-sb-dist-row${hasChildren ? ' bz-sb-dist-row--dir' : ''}" data-path="${escapeHtml(node.path)}" style="padding-left:${10 + depth * 16}px">` +
        `<span class="bz-sb-dist-caret${hasChildren ? '' : ' bz-sb-dist-caret--leaf'}">${hasChildren ? ic('chevron-right', 12) : ''}</span>` +
        `<span class="bz-sb-dist-name">${escapeHtml(node.name)}</span>` +
        `<span class="bz-sb-dist-bar"><span class="bz-sb-dist-fill" style="width:${Math.round((node.chunks / maxChunks) * 100)}%;background:${colorOf(node.name)}"></span></span>` +
        `<span class="bz-sb-dist-num">${node.notes} 篇 / ${node.chunks} 段</span></div>`;
      const kids = hasChildren && open ? panelDistHtml(node.children, expanded, colorOf, maxChunks, depth + 1) : '';
      return row + kids;
    })
    .join('');
}

/** 最近向量化列表（相对时间由行为层注入） */
export function panelRecentHtml(rows: Array<{ path: string; name: string; chunks: number; when: string; color: string }>): string {
  if (!rows.length) return '<div class="bz-sb-empty">没有符合条件的文件</div>';
  return rows
    .map(
      (r) =>
        `<div class="bz-sb-recent-row" data-path="${escapeHtml(r.path)}">` +
        `<span class="bz-sb-dot" style="background:${r.color}"></span>` +
        `<span class="bz-sb-recent-name">${escapeHtml(r.name)}</span>` +
        `<span class="bz-sb-recent-time">${r.chunks} 段 · ${escapeHtml(r.when)}</span></div>`
    )
    .join('');
}

/** AI 库摘要卡（panel.summary 段；无文本返回空串，行为层整卡隐藏） */
export function panelSummaryHtml(text: string, when: string): string {
  if (!text) return '';
  return `<div class="bz-sb-ai-txt">${escapeHtml(text)}</div>` + (when ? `<div class="bz-sb-ai-when">${escapeHtml(when)}</div>` : '');
}

/** 底部状态行内容 */
export function panelLogHtml(parts: Array<{ text: string; warn?: boolean }>): string {
  return parts
    .map((p) => `<span class="bz-sb-log-item${p.warn ? ' bz-sb-log-item--warn' : ''}">${escapeHtml(p.text)}</span>`)
    .join('<span class="bz-sb-log-sep">·</span>');
}

// ==================== AI 对话 markup ====================

/** 推荐问法（静态引导集，原型常驻 chips） */
export const CHAT_CHIPS = ['为什么会遗忘', '享乐适应', '怎么高效记笔记', '睡不好怎么补救', '闪电', '王阳明'];

/** 对话弹窗骨架（头行/消息区/输入区；模型徽标已按用户要求摘除——头部只留清空对话） */
export function chatShellHtml(topK: number): string {
  return `
  <div class="bz-sb-chat-head">
    <div class="bz-sb-glyph bz-sb-chat-glyph">${ic('brain', 17)}</div>
    <div class="bz-sb-head-title">
      <h3>AI 对话</h3>
      <div class="bz-sb-cnt">以库为底作答 · 单次检索 ${topK} 条相关段落</div>
    </div>
    <div class="bz-sb-head-sp"></div>
    <button class="bz-sb-chat-clear bz-sb-fbtn" id="bz-sb-chat-clear">${ic('history', 13)}清空对话</button>
  </div>
  <div class="bz-sb-chat-messages bz-sb-scroll-y" id="bz-sb-chat-messages"></div>
  <div class="bz-sb-chat-input-area">
    <div class="bz-sb-chat-input-row">
      <span class="bz-sb-chat-lens">${ic('sparkles', 15)}</span>
      <textarea class="bz-sb-chat-input" id="bz-sb-chat-input" rows="1" placeholder="向第二大脑提问，回车发送…"></textarea>
      <button class="bz-sb-chat-send" id="bz-sb-chat-send" aria-label="发送">${ic('send', 14)}</button>
    </div>
    <div class="bz-sb-chat-chips" id="bz-sb-chat-chips">
      ${CHAT_CHIPS.map((c) => `<button class="bz-sb-chat-chip" data-q="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}
    </div>
  </div>`;
}

/** 用户气泡壳（内容由行为层 textContent 填充） */
export function chatUserMsgHtml(): string {
  return `<div class="bz-sb-chat-who">${ic('send', 10)}刚问</div><div class="bz-sb-chat-bubble"></div>`;
}

/** assistant 气泡壳（正文节点由行为层渲染 markdown；检索中态/引用卡可追加） */
export function chatAiMsgHtml(): string {
  return `<div class="bz-sb-chat-who">${ic('brain', 10)}第二大脑</div><div class="bz-sb-chat-bubble"></div>`;
}

/** 检索中态（呼吸点；topK 注入文案） */
export function chatThinkingHtml(topK: number): string {
  return `<div class="bz-sb-chat-thinking"><span class="bz-sb-chat-thinking-dots"><i></i><i></i><i></i></span>正在检索 ${topK} 条相关段落…</div>`;
}

/** 引用卡列表（会话内展示，不落盘） */
export function chatCitesHtml(hits: Array<{ path: string; pct: number; color: string }>): string {
  if (!hits.length) return '';
  return (
    `<div class="bz-sb-chat-cites">` +
    hits
      .map(
        (h) =>
          `<button class="bz-sb-chat-cite" data-path="${escapeHtml(h.path)}">` +
          `<span class="bz-sb-chat-cite-score">${h.pct}%</span>` +
          `<span class="bz-sb-dot" style="background:${h.color}"></span>` +
          `<span class="bz-sb-chat-cite-name">${escapeHtml(h.path.replace(/^.*[\\/]/, '').replace(/\.md$/i, ''))}</span>` +
          `</button>`
      )
      .join('') +
    `</div>`
  );
}

// ==================== 灵感参考 markup ====================

/** 参考卡（正文容器由行为层 renderMarkdown 填充；分数条为定稿原型新元素） */
export function refCardHtml(name: string, pct: number, color: string): string {
  return (
    `<div class="bz-sb-ref-card-top">` +
    `<div class="bz-sb-ref-card-path">${escapeHtml(name)}</div>` +
    `<span class="bz-sb-ref-card-score">${pct}%</span>` +
    `</div>` +
    `<div class="bz-sb-ref-card-bar"><span class="bz-sb-ref-card-bar-fill" style="width:${pct}%;background:${color}"></span></div>` +
    `<div class="bz-sb-ref-card-body"></div>`
  );
}

/** 列表占位态（检索中/空态/失败/降级脚注共用样式） */
export function refStateHtml(text: string): string {
  return `<div class="bz-sb-ref-empty">${escapeHtml(text)}</div>`;
}

// ==================== SecondBrainMeta 结构（收编声明，供纯函数引用） ====================

export interface SecondBrainMeta {
  version: number;
  notes: Record<string, { mtime: number; chunks: { text: string }[] }>;
  _dim: number;
}
