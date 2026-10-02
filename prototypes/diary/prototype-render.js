/* 源指纹 d023b9e21371cb37 · 仓内输入 2 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/core/ui/str.ts","src/diary/render.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/diary/render.ts → window.BZR_diary（评审壳预览包，ADR-0104） */
var BZR_diary = (() => {
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

  // src/diary/render.ts
  var render_exports = {};
  __export(render_exports, {
    WEEK: () => WEEK,
    blockPlainText: () => blockPlainText,
    blockRootClass: () => blockRootClass,
    bookPanelHTML: () => bookPanelHTML,
    cnNum: () => cnNum,
    daystampHTML: () => daystampHTML,
    entryBlockHTMLs: () => entryBlockHTMLs,
    exlibrisHTML: () => exlibrisHTML,
    inlineMd: () => inlineMd,
    mimeOfMediaName: () => mimeOfMediaName,
    pad2: () => pad2,
    photoHTML: () => photoHTML,
    sealHTML: () => sealHTML,
    splitTextBlocks: () => splitTextBlocks,
    stripHashInto: () => stripHashInto,
    ticketHTML: () => ticketHTML,
    tiltClassOf: () => tiltClassOf,
    weekdayOf: () => weekdayOf
  });

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }

  // src/diary/render.ts
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  var NUM_CN = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function cnNum(n) {
    const v = Math.floor(Number(n));
    if (!isFinite(v) || v < 0) return "——";
    if (v <= 10) return NUM_CN[v];
    if (v < 20) return "十" + (v % 10 ? NUM_CN[v % 10] : "");
    if (v < 100) return NUM_CN[Math.floor(v / 10)] + "十" + (v % 10 ? NUM_CN[v % 10] : "");
    if (v < 1e3) {
      const r = v % 100;
      const s = NUM_CN[Math.floor(v / 100)] + "百";
      if (!r) return s;
      if (r < 10) return s + "零" + NUM_CN[r];
      if (r < 20) return s + "一十" + (r % 10 ? NUM_CN[r % 10] : "");
      return s + cnNum(r);
    }
    if (v < 1e4) {
      const r = v % 1e3;
      const s = NUM_CN[Math.floor(v / 1e3)] + "千";
      if (!r) return s;
      return s + (r < 100 ? "零" + cnNum(r) : cnNum(r));
    }
    return String(v);
  }
  function weekdayOf(dateStr) {
    const d = /* @__PURE__ */ new Date(dateStr + "T12:00:00");
    return "星期" + WEEK[d.getDay()];
  }
  var TILT_BUCKETS = 6;
  function tiltClassOf(seed) {
    const x = Math.sin(seed * 997) * 1e4;
    const t = (x - Math.floor(x) - 0.5) * 4;
    const k = Math.min(TILT_BUCKETS - 1, Math.max(0, Math.floor((t + 2) / 4 * TILT_BUCKETS)));
    return `bz-diary-tilt-${k}`;
  }
  function inlineMd(s) {
    let t = esc(s);
    t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => {
      const label = alias || target.split("/").pop().replace(/\.md$/, "");
      return '<span class="bz-diary-wikilink" data-target="' + esc(target) + '">' + esc(label) + "</span>";
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
    t = t.replace(/==([^=]+)==/g, '<mark class="bz-diary-hl">$1</mark>');
    t = t.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    return t;
  }
  function splitTextBlocks(text) {
    const blocks = [];
    const lines = String(text).split(/\r?\n/);
    let i = 0;
    let pendingBlank = 0;
    const emit = (b) => {
      if (pendingBlank) {
        blocks.push({ t: "blank", n: Math.min(pendingBlank, 3) });
        pendingBlank = 0;
      }
      blocks.push(b);
    };
    const pushPara = (s) => {
      if (s.length <= 240) {
        emit({ t: "para", text: s });
        return;
      }
      let cur = "";
      let first = true;
      const segs = s.split(/(?<=[。!?;~」”…])/);
      for (const seg of segs) {
        cur += seg;
        if (cur.length > 200) {
          emit({ t: "para", text: cur, cont: !first });
          first = false;
          cur = "";
        }
      }
      if (cur) emit({ t: "para", text: cur, cont: !first });
    };
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line)) {
        const buf2 = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          buf2.push(lines[i]);
          i++;
        }
        i++;
        emit({ t: "code", text: buf2.join("\n") });
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        emit({ t: "head", level: h[1].length, text: h[2] });
        i++;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const buf2 = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          buf2.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        emit({ t: "quote", text: buf2.join("\n") });
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
          if (!m) break;
          items.push(m[1]);
          i++;
        }
        emit({ t: "list", ordered: false, items });
        continue;
      }
      if (/^\s*\d+[.、]\s+/.test(line)) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^\s*\d+[.、]\s+(.*)$/);
          if (!m) break;
          items.push(m[1]);
          i++;
        }
        emit({ t: "list", ordered: true, items });
        continue;
      }
      if (/^(---+|\*\*\*+)$/.test(line.trim())) {
        emit({ t: "hr" });
        i++;
        continue;
      }
      if (line.trim() === "") {
        pendingBlank++;
        i++;
        continue;
      }
      const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+[.、]\s|```|!\[\[)/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      pushPara(buf.join(""));
    }
    return blocks;
  }
  var HASH_RE = new RegExp("(^|[\\s(（【\\[])#([^\\s#,.!?;:、,。!?~»」』”…]+)", "g");
  function stripHashInto(t, out) {
    return String(t).replace(HASH_RE, (_m, pre, tag) => {
      out.push(tag);
      return pre;
    });
  }
  function sealHTML(e, hashes) {
    const tags = e.tags.map((t) => '<span class="bz-diary-seal-tag">' + esc(t) + "</span>").join("");
    const hs = hashes.length ? '<span class="bz-diary-seal-hashes">' + hashes.map((t) => '<span class="bz-diary-seal-hash">#' + esc(t) + "</span>").join("") + "</span>" : "";
    const time = e.kind === "diary" || e.kind === "letter" ? '<span class="bz-diary-seal-time">' + esc(e.time) + "</span>" : "";
    return time + '<span class="bz-diary-seal-tags">' + tags + "</span>" + hs;
  }
  function photoHTML(m, e, lbIndex, ctx) {
    const name = m.name;
    const lazy = !!e.encrypted;
    const hook = lazy ? ' data-enc-name="' + esc(name) + '" data-enc-kind="' + m.kind + '"' : "";
    const src = lazy ? "" : ' src="' + esc(ctx.mediaSrc(name)) + '"';
    if (m.kind === "audio") {
      const label = name.split("/").pop() || name;
      return '<div class="bz-diary-b-audio" data-eid="' + esc(e.id || "") + '"><div class="bz-diary-ba-card"><span class="bz-diary-ba-play">▷</span><span class="bz-diary-ba-mid"><span class="bz-diary-ba-name">♪ ' + esc(label) + '</span><span class="bz-diary-ba-bar"><i></i></span></span><span class="bz-diary-ba-time">--:--</span></div><audio preload="none"' + src + hook + "></audio></div>";
    }
    const stem = String(name.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
    const alt = esc(
      /[^\d\s_\-.]/.test(stem) ? stem.slice(0, 16) : e.date.slice(5).replace("-", "/") + " " + e.time
    );
    const inner = m.kind === "video" ? "<video" + src + ' preload="metadata" muted playsinline' + hook + "></video>" : "<img" + src + ' loading="lazy" alt="' + alt + '"' + hook + ">";
    return '<div class="bz-diary-b-photo" data-eid="' + esc(e.id || "") + '"><figure class="bz-diary-photo ' + tiltClassOf(lbIndex) + '"' + (lazy ? "" : ' data-lb="' + lbIndex + '"') + '><div class="bz-diary-ph-media">' + inner + "</div></figure></div>";
  }
  var TICKET_META_ROWS = [
    ["导演", "导演"],
    ["类型", "类型"],
    ["片长", "片长"],
    ["上映日期", "上映"]
  ];
  function ticketHTML(e, ctx) {
    const x = e.extra || {};
    const meta = x.meta || {};
    const rows = [];
    for (const [key, label] of TICKET_META_ROWS) {
      const v = meta[key];
      if (!v) continue;
      rows.push("<b>" + esc(label) + "</b> " + esc(label === "上映" ? v.slice(0, 10) : v.slice(0, 40)));
    }
    const score = meta["豆瓣评分"] ? '<span class="bz-diary-tk-score">★ ' + esc(meta["豆瓣评分"]) + "</span>" : "";
    const poster = x.poster ? '<img class="bz-diary-tk-poster" data-media-err="bz-diary-ph-empty" src="' + esc(ctx.mediaSrc(x.poster)) + '" loading="lazy" alt="">' : '<i class="bz-diary-tk-poster bz-diary-ph-empty"></i>';
    return '<div class="bz-diary-ticket" data-eid="' + esc(e.id || "") + '"><div class="bz-diary-tk-main"><span class="bz-diary-tk-kind">' + esc(e.tags[0] || "") + ' · 观影票根</span><div class="bz-diary-tk-title">《' + esc(x.title || "") + '》</div><div class="bz-diary-tk-meta">' + rows.join("　") + (rows.length ? "　" : "") + score + '</div><div class="bz-diary-tk-review">' + inlineMd(x.review || "") + '</div><span class="bz-diary-tk-more">… 影评全文</span></div><div class="bz-diary-tk-stub">' + poster + '<span class="bz-diary-tk-date">' + esc(e.date) + "</span>" + esc(e.emoji) + "</div></div>";
  }
  function exlibrisHTML(e, ctx) {
    const x = e.extra || {};
    const cover = x.cover ? '<img class="bz-diary-ex-cover" data-media-err="bz-diary-ex-nothing" src="' + esc(ctx.mediaSrc(x.cover)) + '" loading="lazy" alt="">' : '<i class="bz-diary-ex-nothing"></i>';
    const byline = x.author ? esc(x.author) + (x.category ? " · " + esc(x.category) : "") : esc(x.category || "");
    return '<div class="bz-diary-exlibris" data-eid="' + esc(e.id || "") + '">' + cover + '<div class="bz-diary-ex-main"><div class="bz-diary-ex-title">《' + esc(x.title || "") + '》</div><div class="bz-diary-ex-author">' + byline + '</div><div class="bz-diary-ex-review">' + inlineMd(x.review || "") + '</div><div class="bz-diary-ex-date">读毕 ' + esc(e.date) + " · " + esc(e.emoji) + "</div></div></div>";
  }
  function paraHTML(b, e) {
    return '<div class="bz-diary-b-para ' + (b.cont ? "bz-diary-p-cont" : "bz-diary-p-indent") + '" data-eid="' + esc(e.id || "") + '">' + inlineMd(b.text) + "</div>";
  }
  function envelopeHTML(e) {
    return '<div class="bz-diary-b-envelope"><div class="bz-diary-envelope" data-eid="' + esc(e.id || "") + '"><div class="bz-diary-env-body"><div class="bz-diary-env-flap"></div><div class="bz-diary-env-split"><i class="bz-diary-es-l"></i><i class="bz-diary-es-r"></i></div><div class="bz-diary-env-wax">🔐</div><div class="bz-diary-env-label">火漆封缄 · 拆信需主密码</div></div><span class="bz-diary-env-reseal">重新封缄</span></div></div>';
  }
  function entryBlockHTMLs(e, ctx, opts = {}) {
    const eid = esc(e.id || "");
    const wrap = (cls, inner) => '<div class="' + cls + '" data-eid="' + eid + '">' + inner + "</div>";
    if (e.encrypted && !opts.unwrap) return [envelopeHTML(e)];
    const hashes = [];
    for (const seg of e.segments) {
      if (seg.kind !== "text") continue;
      for (const b of splitTextBlocks(seg.text)) {
        if (b.t === "para" || b.t === "quote") stripHashInto(b.text, hashes);
      }
    }
    const out = [];
    out.push('<div class="bz-diary-b-seal" data-eid="' + eid + '">' + sealHTML(e, hashes) + "</div>");
    if (e.kind === "movie") return out.concat(wrap("bz-diary-b-ticket", ticketHTML(e, ctx)));
    if (e.kind === "book") return out.concat(wrap("bz-diary-b-exlibris", exlibrisHTML(e, ctx)));
    if (e.kind === "letter") {
      out.push(
        '<div class="bz-diary-b-head" data-eid="' + eid + '">' + esc(basenameOf(e.filename)) + "</div>"
      );
    }
    for (const seg of e.segments) {
      if (seg.kind === "media") {
        out.push(photoHTML(seg.media, e, ctx.lbIndexOf(seg.media.name), ctx));
        continue;
      }
      for (const b of splitTextBlocks(seg.text)) {
        switch (b.t) {
          case "blank":
            out.push(
              '<div class="bz-diary-b-blank bz-diary-blank-' + b.n + '" data-eid="' + eid + '"></div>'
            );
            break;
          case "para": {
            const t = stripHashInto(b.text, []);
            if (t.trim()) out.push(paraHTML({ text: t, cont: b.cont }, e));
            break;
          }
          case "head":
            out.push(
              '<div class="bz-diary-b-head' + (b.level > 2 ? " bz-diary-h2" : "") + '" data-eid="' + eid + '">' + esc(b.text.replace(/[#*]/g, "")) + "</div>"
            );
            break;
          case "quote": {
            const t = stripHashInto(b.text, []);
            out.push(wrap("bz-diary-b-quote", inlineMd(t).replace(/\n/g, "<br>")));
            break;
          }
          case "list":
            out.push(
              '<ul class="bz-diary-b-list' + (b.ordered ? " bz-diary-ordered" : "") + '" data-eid="' + eid + '">' + b.items.map((it) => "<li>" + inlineMd(it) + "</li>").join("") + "</ul>"
            );
            break;
          case "code":
            out.push(wrap("bz-diary-b-code", esc(b.text)));
            break;
          case "hr":
            out.push('<hr class="bz-diary-b-hr" data-eid="' + eid + '">');
            break;
        }
      }
    }
    return out;
  }
  function blockRootClass(html) {
    const m = /^<[a-z][^>]*\sclass="([^"]*)"/i.exec(html);
    return m ? m[1] : "";
  }
  function blockPlainText(html) {
    return html.replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  }
  function daystampHTML(date, count) {
    const [y, m, dd] = date.split("-");
    return '<div class="bz-diary-b-daystamp" data-date="' + esc(date) + '"><div class="bz-diary-dstamp"><span class="bz-diary-ds-day">' + Number(dd) + '</span><span class="bz-diary-ds-side"><b>' + parseInt(m, 10) + "月</b><i>" + weekdayOf(date) + "</i><em>" + cnNum(count) + ' 则</em></span><span class="bz-diary-ds-year">' + esc(y) + '</span></div><div class="bz-diary-ds-wave"></div></div>';
  }
  function basenameOf(p) {
    return String(p || "").split("/").pop().replace(/\.md$/, "");
  }
  function bookPanelHTML() {
    return `
  <!-- 收起整本：右上角常驻一枚出口（另两条路：点遮罩、Esc——先翻回最新那篇，再按一次收起） -->
  <button class="bz-diary-close" type="button" title="收起日记本（Esc）" aria-label="收起日记本">${iconSpan("x")}</button>

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
      <div class="bz-diary-pass-wax">${iconSpan("lock")}</div>
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
  var MIME_BY_EXT = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    wav: "audio/wav",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    aac: "audio/aac",
    ogg: "audio/ogg"
  };
  function mimeOfMediaName(name) {
    const dot = name.lastIndexOf(".");
    const ext = dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
    return MIME_BY_EXT[ext] || "application/octet-stream";
  }
  return __toCommonJS(render_exports);
})();
