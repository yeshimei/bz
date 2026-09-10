/* 源指纹 a09dc6f1b6f5442a · 仓内输入 1 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/secondbrain/render.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/secondbrain/render.ts → window.BZR_secondbrain（评审壳预览包，ADR-0104） */
var BZR_secondbrain = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/secondbrain/render.ts
  var render_exports = {};
  __export(render_exports, {
    CHAT_CHIPS: () => CHAT_CHIPS,
    SB_PALETTE: () => SB_PALETTE,
    buildSourceTree: () => buildSourceTree,
    chatAiMsgHtml: () => chatAiMsgHtml,
    chatCitesHtml: () => chatCitesHtml,
    chatShellHtml: () => chatShellHtml,
    chatThinkingHtml: () => chatThinkingHtml,
    chatUserMsgHtml: () => chatUserMsgHtml,
    computeStats: () => computeStats,
    escapeHtml: () => escapeHtml,
    fmtCompact: () => fmtCompact,
    panelCardsHtml: () => panelCardsHtml,
    panelDistHtml: () => panelDistHtml,
    panelLogHtml: () => panelLogHtml,
    panelRecentHtml: () => panelRecentHtml,
    panelShellHtml: () => panelShellHtml,
    panelSummaryHtml: () => panelSummaryHtml,
    panelTrendHtml: () => panelTrendHtml,
    refCardHtml: () => refCardHtml,
    refStateHtml: () => refStateHtml,
    sbSourceColor: () => sbSourceColor
  });
  function topLevelDir(path) {
    const i = path.indexOf("/");
    return i === -1 ? "（根目录）" : path.slice(0, i);
  }
  function fmtCompact(n) {
    const trim = (s) => s.replace(/\.0$/, "");
    if (n >= 1e9) return `${trim((n / 1e9).toFixed(1))}B`;
    if (n >= 1e6) return `${trim((n / 1e6).toFixed(1))}M`;
    if (n >= 1e4) return `${trim((n / 1e3).toFixed(1))}K`;
    return n.toLocaleString();
  }
  function computeStats(meta, now = Date.now()) {
    var _a, _b;
    const bySource = /* @__PURE__ */ new Map();
    let chunkCount = 0;
    let totalChars = 0;
    const recent = [];
    const weekMs = 7 * 24 * 3600 * 1e3;
    const thisWeekStart = Math.floor(now / weekMs) * weekMs;
    const trend12w = new Array(12).fill(0);
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
      lastIndexedAt: (_b = (_a = recent[0]) == null ? void 0 : _a.mtime) != null ? _b : null,
      bySource: bySourceArr,
      recent: recent.slice(0, 10),
      trend12w,
      totalChars,
      avgChunkLen: chunkCount ? Math.round(totalChars / chunkCount) : 0,
      avgChunksPerNote: noteCount ? Math.round(chunkCount / noteCount * 10) / 10 : 0
    };
  }
  function buildSourceTree(meta) {
    var _a;
    const roots = /* @__PURE__ */ new Map();
    const childOf = /* @__PURE__ */ new Map();
    const nodeOf = /* @__PURE__ */ new Map();
    const ensureDir = (dir) => {
      let node = nodeOf.get(dir);
      if (node) return node;
      const segs = dir.split("/").filter(Boolean);
      node = {
        name: segs[segs.length - 1] || dir,
        path: dir,
        notes: 0,
        chunks: 0,
        children: []
      };
      nodeOf.set(dir, node);
      if (segs.length === 1) {
        roots.set(dir, node);
      } else {
        const parent = ensureDir(segs.slice(0, -1).join("/"));
        const siblings = childOf.get(parent.path) || [];
        siblings.push(node);
        childOf.set(parent.path, siblings);
      }
      return node;
    };
    for (const [path, entry] of Object.entries(meta.notes)) {
      const idx = path.lastIndexOf("/");
      const dir = idx === -1 ? "（根目录）" : path.slice(0, idx);
      let cursor = ensureDir(dir);
      while (cursor) {
        cursor.notes++;
        cursor.chunks += entry.chunks.length;
        const segs = cursor.path.split("/").filter(Boolean);
        if (segs.length <= 1) break;
        cursor = (_a = nodeOf.get(segs.slice(0, -1).join("/"))) != null ? _a : null;
      }
    }
    for (const node of nodeOf.values()) {
      node.children = childOf.get(node.path) || [];
    }
    const sortChildren = (arr) => {
      arr.sort((a, b) => b.chunks - a.chunks);
      for (const c of arr) sortChildren(c.children);
    };
    const rootsArr = [...roots.values()];
    sortChildren(rootsArr);
    return rootsArr;
  }
  var SB_PALETTE = ["#0f766e", "#6366f1", "#d97706", "#db2777", "#0e7490", "#7c3aed", "#b45309", "#be185d"];
  var SB_FALLBACK = "#a39b8c";
  function sbSourceColor(name, order) {
    const i = order.get(name);
    if (i === void 0) return SB_FALLBACK;
    return SB_PALETTE[i % SB_PALETTE.length];
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  var ic = (name, size = 15) => `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
  function panelShellHtml() {
    return `
  <div class="bz-sb-head">
    <div class="bz-sb-glyph">${ic("brain", 19)}</div>
    <div class="bz-sb-head-title">
      <h3>第二大脑</h3>
      <div class="bz-sb-cnt" id="bz-sb-cnt"></div>
    </div>
    <div class="bz-sb-pill"><i class="bz-sb-pill-dot"></i><span id="bz-sb-pill-txt">索引健康</span></div>
    <div class="bz-sb-head-sp"></div>
    <div class="bz-sb-panel-btns">
      <button class="bz-sb-panel-func bz-sb-fbtn bz-sb-fbtn--icon" id="bz-sb-open-chat" aria-label="AI 对话" title="AI 对话">${ic("message-square", 14)}</button>
      <button class="bz-sb-panel-func bz-sb-fbtn bz-sb-fbtn--icon" id="bz-sb-open-ref" aria-label="灵感参考" title="灵感参考">${ic("radar", 14)}</button>
    </div>
  </div>
  <div class="bz-sb-panel-body">
    <div class="bz-sb-panel-content" id="bz-sb-content" style="display:none">
      <div class="bz-sb-cards" id="bz-sb-cards"></div>
      <div class="bz-sb-grid">
        <div class="bz-sb-col">
          <div class="bz-sb-section bz-sb-section-trend">
            <div class="bz-sb-ct">${ic("activity", 13)}近 12 周向量化<span class="bz-sb-ct-n" id="bz-sb-trend-sum"></span></div>
            <div id="bz-sb-trend" class="bz-sb-trend"></div>
          </div>
          <div class="bz-sb-section bz-sb-section-recent">
            <div class="bz-sb-ct">${ic("history", 13)}最近向量化<span class="bz-sb-ct-n" id="bz-sb-recent-n"></span></div>
            <div id="bz-sb-recent" class="bz-sb-recent"></div>
          </div>
        </div>
        <div class="bz-sb-col">
          <div class="bz-sb-section bz-sb-section-dist">
            <div class="bz-sb-ct">${ic("layers", 13)}来源分布<span class="bz-sb-ct-n" id="bz-sb-dist-n"></span></div>
            <div id="bz-sb-dist" class="bz-sb-dist"></div>
          </div>
          <div class="bz-sb-section bz-sb-ai" id="bz-sb-ai-card">
            <div class="bz-sb-ct bz-sb-ai-ct">${ic("sparkles", 13)}库摘要<span class="bz-sb-ct-n" id="bz-sb-ai-when"></span></div>
            <div class="bz-sb-ai-txt" id="bz-sb-ai-txt"></div>
          </div>
        </div>
      </div>
      <div class="bz-sb-foot">
        <button class="bz-sb-fbtn bz-sb-fbtn--primary" id="bz-sb-incr" aria-label="增量更新">${ic("refresh-cw", 14)}<span class="bz-sb-fbtn-txt">增量更新</span></button>
        <button class="bz-sb-fbtn" id="bz-sb-rebuild" aria-label="全量重建">${ic("database", 14)}<span class="bz-sb-fbtn-txt">全量重建</span></button>
        <div class="bz-sb-log" id="bz-sb-log"></div>
      </div>
    </div>
    <div class="bz-sb-onboard" id="bz-sb-onboard" style="display:none">
      <div class="bz-sb-onboard-icon">${ic("brain", 34)}</div>
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
  function panelCardsHtml(items) {
    return items.map(
      (it) => `<div class="bz-sb-card${it.acc ? " bz-sb-card--acc" : ""}"${it.tip ? ` title="${escapeHtml(it.tip)}"` : ""}><div class="bz-sb-card-value${it.warn ? " bz-sb-card-value--warn" : ""}">${it.v}</div><div class="bz-sb-card-label">${escapeHtml(it.k)}</div></div>`
    ).join("");
  }
  function panelTrendHtml(trend) {
    const max = Math.max(...trend, 1);
    return trend.map((n, i) => {
      const label = i === 11 ? "本周" : i === 5 || i === 0 ? `${11 - i}周` : "";
      const weeksAgo = 11 - i;
      return `<div class="bz-sb-trend-col${i === 11 ? " bz-sb-trend-col--last" : ""}" title="${weeksAgo === 0 ? "本周" : `${weeksAgo} 周前`}：${n} 篇" aria-label="${n} 篇"><div class="bz-sb-trend-bar" style="height:${Math.max(2, Math.round(n / max * 62))}px"></div><span>${label}</span></div>`;
    }).join("");
  }
  function panelDistHtml(nodes, expanded, colorOf, maxChunks, depth = 0) {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const open = expanded.has(node.path);
      const row = `<div class="bz-sb-dist-row${hasChildren ? " bz-sb-dist-row--dir" : ""}" data-path="${escapeHtml(node.path)}" style="padding-left:${10 + depth * 16}px"><span class="bz-sb-dist-caret${hasChildren ? "" : " bz-sb-dist-caret--leaf"}">${hasChildren ? ic("chevron-right", 12) : ""}</span><span class="bz-sb-dist-name">${escapeHtml(node.name)}</span><span class="bz-sb-dist-bar"><span class="bz-sb-dist-fill" style="width:${Math.round(node.chunks / maxChunks * 100)}%;background:${colorOf(node.name)}"></span></span><span class="bz-sb-dist-num">${node.notes} 篇 / ${node.chunks} 段</span></div>`;
      const kids = hasChildren && open ? panelDistHtml(node.children, expanded, colorOf, maxChunks, depth + 1) : "";
      return row + kids;
    }).join("");
  }
  function panelRecentHtml(rows) {
    if (!rows.length) return '<div class="bz-sb-empty">没有符合条件的文件</div>';
    return rows.map(
      (r) => `<div class="bz-sb-recent-row" data-path="${escapeHtml(r.path)}"><span class="bz-sb-dot" style="background:${r.color}"></span><span class="bz-sb-recent-name">${escapeHtml(r.name)}</span><span class="bz-sb-recent-time">${r.chunks} 段 · ${escapeHtml(r.when)}</span></div>`
    ).join("");
  }
  function panelSummaryHtml(text, when) {
    if (!text) return "";
    return `<div class="bz-sb-ai-txt">${escapeHtml(text)}</div>` + (when ? `<div class="bz-sb-ai-when">${escapeHtml(when)}</div>` : "");
  }
  function panelLogHtml(parts) {
    return parts.map((p) => `<span class="bz-sb-log-item${p.warn ? " bz-sb-log-item--warn" : ""}">${escapeHtml(p.text)}</span>`).join('<span class="bz-sb-log-sep">·</span>');
  }
  var CHAT_CHIPS = ["为什么会遗忘", "享乐适应", "怎么高效记笔记", "睡不好怎么补救", "闪电", "王阳明"];
  function chatShellHtml(topK) {
    return `
  <div class="bz-sb-chat-head">
    <div class="bz-sb-glyph bz-sb-chat-glyph">${ic("brain", 17)}</div>
    <div class="bz-sb-head-title">
      <h3>AI 对话</h3>
      <div class="bz-sb-cnt">以库为底作答 · 单次检索 ${topK} 条相关段落</div>
    </div>
    <div class="bz-sb-head-sp"></div>
    <button class="bz-sb-chat-clear bz-sb-fbtn" id="bz-sb-chat-clear">${ic("history", 13)}清空对话</button>
  </div>
  <div class="bz-sb-chat-messages bz-sb-scroll-y" id="bz-sb-chat-messages"></div>
  <div class="bz-sb-chat-input-area">
    <div class="bz-sb-chat-input-row">
      <span class="bz-sb-chat-lens">${ic("sparkles", 15)}</span>
      <textarea class="bz-sb-chat-input" id="bz-sb-chat-input" rows="1" placeholder="向第二大脑提问，回车发送…"></textarea>
      <button class="bz-sb-chat-send" id="bz-sb-chat-send" aria-label="发送">${ic("send", 14)}</button>
    </div>
    <div class="bz-sb-chat-chips" id="bz-sb-chat-chips">
      ${CHAT_CHIPS.map((c) => `<button class="bz-sb-chat-chip" data-q="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("")}
    </div>
  </div>`;
  }
  function chatUserMsgHtml() {
    return `<div class="bz-sb-chat-who">${ic("send", 10)}刚问</div><div class="bz-sb-chat-bubble"></div>`;
  }
  function chatAiMsgHtml() {
    return `<div class="bz-sb-chat-who">${ic("brain", 10)}第二大脑</div><div class="bz-sb-chat-bubble"></div>`;
  }
  function chatThinkingHtml(topK) {
    return `<div class="bz-sb-chat-thinking"><span class="bz-sb-chat-thinking-dots"><i></i><i></i><i></i></span>正在检索 ${topK} 条相关段落…</div>`;
  }
  function chatCitesHtml(hits) {
    if (!hits.length) return "";
    return `<div class="bz-sb-chat-cites">` + hits.map(
      (h) => `<button class="bz-sb-chat-cite" data-path="${escapeHtml(h.path)}"><span class="bz-sb-chat-cite-score">${h.pct}%</span><span class="bz-sb-dot" style="background:${h.color}"></span><span class="bz-sb-chat-cite-name">${escapeHtml(h.path.replace(/^.*[\\/]/, "").replace(/\.md$/i, ""))}</span></button>`
    ).join("") + `</div>`;
  }
  function refCardHtml(name, pct, color) {
    return `<div class="bz-sb-ref-card-top"><div class="bz-sb-ref-card-path">${escapeHtml(name)}</div><span class="bz-sb-ref-card-score">${pct}%</span></div><div class="bz-sb-ref-card-bar"><span class="bz-sb-ref-card-bar-fill" style="width:${pct}%;background:${color}"></span></div><div class="bz-sb-ref-card-body"></div>`;
  }
  function refStateHtml(text) {
    return `<div class="bz-sb-ref-empty">${escapeHtml(text)}</div>`;
  }
  return __toCommonJS(render_exports);
})();
