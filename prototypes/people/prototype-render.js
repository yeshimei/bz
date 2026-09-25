/* 源指纹 d4bf2fb991866ea0 · 仓内输入 1 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/people/render.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/people/render.ts → window.BZR_people（评审壳预览包，ADR-0104） */
var BZR_people = (() => {
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

  // src/people/render.ts
  var render_exports = {};
  __export(render_exports, {
    avatarColor: () => avatarColor,
    button: () => button,
    collectTags: () => collectTags,
    dsModal: () => dsModal,
    dsRow: () => dsRow,
    dsWatermark: () => dsWatermark,
    duoBar: () => duoBar,
    el: () => el,
    foldBook: () => foldBook,
    foldCard: () => foldCard,
    foldChronicleBody: () => foldChronicleBody,
    foldDataBody: () => foldDataBody,
    foldDetailHead: () => foldDetailHead,
    foldEventsBody: () => foldEventsBody,
    foldPortraitBody: () => foldPortraitBody,
    foldProfileBody: () => foldProfileBody,
    foldWall: () => foldWall,
    formatCount: () => formatCount,
    formatDay: () => formatDay,
    formatDuration: () => formatDuration,
    formatReplySec: () => formatReplySec,
    hourStrip: () => hourStrip,
    importMeta: () => importMeta,
    initials: () => initials,
    insRow: () => insRow,
    insightsCard: () => insightsCard,
    kindChips: () => kindChips,
    mdPlain: () => mdPlain,
    mediaLabel: () => mediaLabel,
    mergeBar: () => mergeBar,
    miniMarkdown: () => miniMarkdown,
    monthlyChart: () => monthlyChart,
    noMatch: () => noMatch,
    noteAddRow: () => noteAddRow,
    panelShell: () => panelShell,
    profileEditor: () => profileEditor,
    profileFilled: () => profileFilled,
    profileView: () => profileView,
    socialRow: () => socialRow,
    spillOf: () => spillOf,
    statsText: () => statsText,
    tagChip: () => tagChip,
    text: () => text,
    textEl: () => textEl,
    toolbar: () => toolbar,
    vtName: () => vtName,
    wallEmpty: () => wallEmpty
  });
  var AVATAR_COLORS = ["#b5534a", "#5a8f6d", "#4a7d9e", "#8a6bb0", "#b08a3e", "#7a8b4a", "#a05d7a", "#5f6b7a"];
  function el(tag, cls, arg, ...rest) {
    const flat = (ns) => ns.flatMap((n) => Array.isArray(n) ? n : [n]);
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (arg === void 0) {
      for (const c of flat(rest)) node.appendChild(c);
    } else if (Array.isArray(arg)) {
      for (const c of flat([...arg, ...rest])) node.appendChild(c);
    } else if (arg instanceof Node) {
      node.appendChild(arg);
      for (const c of flat(rest)) node.appendChild(c);
    } else {
      for (const [k, v] of Object.entries(arg)) node.setAttribute(k, v);
      for (const c of flat(rest)) node.appendChild(c);
    }
    return node;
  }
  function text(s) {
    return document.createTextNode(s);
  }
  function textEl(tag, s) {
    const node = document.createElement(tag);
    node.textContent = s;
    return node;
  }
  function button(cls, label, attrs) {
    const b = el("button", cls, attrs);
    b.type = "button";
    b.textContent = label;
    return b;
  }
  function initials(name) {
    const s = name.trim();
    return s ? [...s][0] : "?";
  }
  function avatarColor(name) {
    let h = 0;
    for (const ch of name) h = h * 31 + ch.codePointAt(0) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function formatDay(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function formatCount(n) {
    if (n >= 1e4) return `${(n / 1e4).toFixed(n % 1e4 >= 100 ? 1 : 0)} 万`;
    return n.toLocaleString("en-US");
  }
  function formatReplySec(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return "—";
    if (sec < 60) return `${Math.round(sec)} 秒`;
    if (sec < 3600) return `${Math.round(sec / 60)} 分`;
    return `${(sec / 3600).toFixed(1)} 时`;
  }
  function vtName(name) {
    const s = String(name != null ? name : "").trim();
    return [...s].length <= 7 ? s : `${[...s].slice(0, 6).join("")}…`;
  }
  function mediaLabel(s) {
    if (!s) return "";
    const parts = [];
    if (s.voiceCount > 0) {
      parts.push(`语音 ${s.voiceCount} 条`);
      if (s.voiceTotalSec > 0) parts.push(formatDuration(s.voiceTotalSec));
    }
    if (s.imageCount > 0) parts.push(`图片 ${s.imageCount} 张`);
    return parts.join(" · ");
  }
  function formatDuration(sec) {
    if (sec < 60) return `${Math.round(sec)} 秒`;
    if (sec < 3600) return `${Math.round(sec / 60)} 分`;
    return `${(sec / 3600).toFixed(1)} 时`;
  }
  function mdPlain(md) {
    return String(md != null ? md : "").replace(/```+/g, "").split(/\r?\n/).map((l) => l.replace(/^#{1,6}\s*/, "").replace(/^>\s?/, "").replace(/^-\s*/, "").replace(/\*\*/g, "").trim()).filter(Boolean).join(" ");
  }
  function spillOf(s, n = 40) {
    const t = mdPlain(s);
    return [...t].length <= n ? t : `${[...t].slice(0, n).join("")}…`;
  }
  function panelShell() {
    return el("div", "bz-people-panel", [
      el("div", "bz-people-head", [
        el("div", "bz-people-brand", [
          el("div", "bz-people-mark", { "aria-hidden": "true" }, text("脸")),
          el("div", "bz-people-brand-text", [
            el("h1", "bz-people-title", text("脸谱")),
            el("div", "bz-people-sub", text("微信聊天 · AI 人物画谱"))
          ])
        ]),
        el("div", "bz-people-head-actions", [
          button("bz-people-btn bz-people-btn-acc", "数据源", { "data-people-ds-open": "" }),
          button("bz-people-btn bz-people-btn-ghost", "关闭", { "data-people-close": "" })
        ])
      ]),
      el("div", "bz-people-stats", { "data-people-stats": "" }),
      el("div", "bz-people-runline", { "data-people-runline": "", hidden: "" }, [
        el("span", "bz-people-run-spin", { "aria-hidden": "true" }),
        el("span", "bz-people-run-main", { "data-people-run-main": "" }),
        el("span", "bz-people-run-sub", { "data-people-run-sub": "" })
      ]),
      el("div", "bz-people-body", { "data-people-body": "" }),
      el("div", "bz-people-ds-layer", { "data-people-ds-layer": "", hidden: "" })
    ]);
  }
  function statsText(people) {
    const total = people.reduce((s, p) => s + p.imports.reduce((x, r) => x + r.messageCount, 0), 0);
    const faces = people.filter((p) => p.digest).length;
    return people.length ? `${people.length} 位人物 · ${formatCount(total)} 条消息 · ${faces} 张脸谱` : "还没有人物";
  }
  var SORT_OPTIONS = [
    ["recent", "最近互动"],
    ["msgs", "消息量"],
    ["created", "建卡时间"],
    ["name", "名字"]
  ];
  function toolbar(people, sortKey, filterTag, searchText) {
    const tags = collectTags(people);
    const sortSel = document.createElement("select");
    sortSel.className = "bz-people-select";
    sortSel.setAttribute("data-people-sort", "");
    sortSel.setAttribute("aria-label", "排序方式");
    for (const [k, label] of SORT_OPTIONS) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = label;
      if (k === sortKey) o.selected = true;
      sortSel.appendChild(o);
    }
    const tagSel = document.createElement("select");
    tagSel.className = "bz-people-select";
    tagSel.setAttribute("data-people-tag", "");
    tagSel.setAttribute("aria-label", "按关系标签筛选");
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "全部标签";
    tagSel.appendChild(all);
    for (const tag of tags) {
      const o = document.createElement("option");
      o.value = tag;
      o.textContent = tag;
      if (tag === filterTag) o.selected = true;
      tagSel.appendChild(o);
    }
    const search = document.createElement("input");
    search.type = "search";
    search.className = "bz-people-search";
    search.placeholder = "搜称呼 / 标签 / 备注";
    search.value = searchText;
    search.setAttribute("data-people-search", "");
    search.setAttribute("aria-label", "搜索人物");
    return el("div", "bz-people-toolbar", [sortSel, tagSel, search]);
  }
  function collectTags(people) {
    var _a, _b;
    const set = /* @__PURE__ */ new Set();
    for (const p of people) for (const tag of (_b = (_a = p.profile) == null ? void 0 : _a.tags) != null ? _b : []) if (tag.trim()) set.add(tag.trim());
    return [...set].sort((a, b) => a.localeCompare(b, "zh"));
  }
  function mergeBar(fromName, toName) {
    return toName ? el("div", "bz-people-merge-bar", [
      el("div", "bz-people-merge-text", text(`确认合并：把「${fromName}」的导入记录与随手记并到「${toName}」，「${fromName}」将被删除；对方的脸谱不带入，合并后建议重画。`)),
      button("bz-people-btn bz-people-btn-acc", "确认合并", { "data-people-merge-confirm": "" }),
      button("bz-people-btn bz-people-btn-ghost", "取消", { "data-people-merge-cancel": "" })
    ]) : el("div", "bz-people-merge-bar", [
      el("div", "bz-people-merge-text", text(`合并重复人物：点选一张折子，把「${fromName}」的导入记录与随手记并过去——对方保留，「${fromName}」这本将删除。`)),
      button("bz-people-btn bz-people-btn-ghost", "取消合并", { "data-people-merge-cancel": "" })
    ]);
  }
  function foldCard(p, opts) {
    var _a, _b, _c;
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const from = p.imports.map((r) => r.timeFrom).sort()[0];
    const to = p.imports.map((r) => r.timeTo).sort().pop();
    const span = from && to ? `${from.slice(0, 7)} ~ ${to.slice(0, 7)}` : "";
    const rel = (_c = ((_b = (_a = p.profile) == null ? void 0 : _a.tags) != null ? _b : []).filter(Boolean)[0]) != null ? _c : "";
    const seal = p.digest ? el("div", "bz-people-seal", text(p.lastProcessedTs ? `画到
${formatDay(p.lastProcessedTs).slice(2)}` : "已画")) : el("div", "bz-people-seal bz-people-seal-todo", text("待画"));
    const label = mediaLabel(opts.media);
    const actions = el("div", "bz-people-fold-actions");
    if (opts.canMerge && !opts.mergeFrom) actions.appendChild(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "合并到…", { "data-people-merge": p.id }));
    if (!opts.mergeFrom) actions.appendChild(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm bz-people-del", opts.deleteArm ? "再点确认删除" : "删除", { "data-people-del": p.id }));
    const card = el("div", "bz-people-fold", [
      el("div", "bz-people-fold-inner", [
        seal,
        el("div", "bz-people-fold-title vt", { title: p.name }, text(vtName(p.name))),
        el("div", "bz-people-fold-who", text(rel || (span ? span : total ? `${formatCount(total)} 条` : "新折"))),
        el("div", "bz-people-fold-meta", text([
          total ? `${formatCount(total)} 条` : "尚无消息",
          label
        ].filter(Boolean).join(" · ")))
      ]),
      actions
    ]);
    if (opts.mergeFrom) card.classList.add("bz-people-fold-merge-src");
    else if (opts.mergePick) card.classList.add("bz-people-fold-merge-pick");
    card.setAttribute("data-people-card", p.id);
    return card;
  }
  function foldWall() {
    return el("div", "bz-people-wall", { "data-people-wall": "" });
  }
  function noMatch() {
    return el("div", "bz-people-nomatch", [
      el("div", "bz-people-empty-hint", text("没有匹配的人物")),
      button("bz-people-btn bz-people-btn-ghost", "清除筛选", { "data-people-filter-clear": "" })
    ]);
  }
  function wallEmpty() {
    return el("div", "bz-people-empty", [
      el("div", "bz-people-empty-mark", text("脸")),
      el("div", "bz-people-empty-title", text("还没有脸谱")),
      el("div", "bz-people-empty-hint", text("打开「数据源」勾选联系人导入预览，再点「画脸谱」——AI 会为对方修一册脸谱：画像、性格、共同回忆。聊天原文只在本机提炼，不落盘。")),
      button("bz-people-btn bz-people-btn-acc", "打开数据源", { "data-people-ds-open": "" })
    ]);
  }
  var FOLD_TITLES = [
    ["p", "画像", "画像与代表原话"],
    ["e", "事件", "交往事件与随手记"],
    ["c", "大事记", "关系时间线"],
    ["d", "数据", "互动统计与媒体"],
    ["f", "档案", "人物档案"]
  ];
  function foldDetailHead(p, media) {
    var _a, _b;
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const label = mediaLabel(media);
    const voice = (_a = media == null ? void 0 : media.voiceCount) != null ? _a : 0;
    return el("div", "bz-people-dt-head", [
      el("div", "bz-people-dt-seal", { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
      el("div", "bz-people-dt-id", [
        el("div", "bz-people-dt-name", text(p.name)),
        el("div", "bz-people-card-meta", text([
          total ? `${formatCount(total)} 条消息 · ${p.imports.length} 次导入` : "尚无导入",
          p.digest ? `脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}` : "脸谱未生成"
        ].join(" · "))),
        ...label ? [el("div", "bz-people-media-badge", text(label))] : []
      ]),
      el("div", "bz-people-dt-nums", [
        el("div", "", [el("div", "bz-people-dt-n", text(formatCount(total))), el("div", "bz-people-dt-t", text("消息"))]),
        el("div", "", [el("div", "bz-people-dt-n", text(voice ? String(voice) : "—")), el("div", "bz-people-dt-t", text(voice ? `语音 · ${formatDuration((_b = media == null ? void 0 : media.voiceTotalSec) != null ? _b : 0)}` : "语音"))]),
        el("div", "", [el("div", "bz-people-dt-n", text((media == null ? void 0 : media.imageCount) ? String(media.imageCount) : "—")), el("div", "bz-people-dt-t", text("图片"))])
      ]),
      p.lastProcessedTs ? el("div", "bz-people-dt-watermark", text(`已画到 ${formatDay(p.lastProcessedTs)}`)) : el("div", "bz-people-dt-watermark bz-people-dt-watermark-todo", text("未画脸谱")),
      el("div", "bz-people-dt-actions", [
        button("bz-people-btn bz-people-btn-ghost", "导出为笔记", { "data-people-export": "" }),
        button("bz-people-btn bz-people-btn-ghost", "从数据源补画", { "data-people-ds-open": "" }),
        button("bz-people-btn bz-people-btn-ghost", "返回列表", { "data-people-back-btn": "" })
      ])
    ]);
  }
  function foldBook(p, opts, bodies, spills) {
    var _a;
    const book = el("div", "bz-people-book", { "data-people-book": "" });
    for (const [id, title] of FOLD_TITLES) {
      const on = opts.fold === id;
      const leaf = el("div", `bz-people-leaf${on ? " bz-people-leaf-on" : ""}`, { "data-people-leaf": id });
      leaf.appendChild(el("div", "bz-people-leaf-spine", { "aria-hidden": "true" }));
      leaf.appendChild(el("div", "bz-people-leaf-head", { "data-people-leaf-head": id }, [
        el("span", "bz-people-leaf-zh", text(title)),
        el("span", "bz-people-leaf-cnt", text(spillMeta(p, id)))
      ]));
      if (on) {
        const body = el("div", "bz-people-leaf-body");
        for (const node of (_a = bodies[id]) != null ? _a : []) body.appendChild(node);
        leaf.appendChild(body);
      } else {
        leaf.appendChild(el("div", "bz-people-leaf-spill vt", text(spills[id] || title)));
      }
      book.appendChild(leaf);
    }
    return book;
  }
  function spillMeta(p, id) {
    var _a, _b, _c, _d, _e, _f;
    switch (id) {
      case "p":
        return ((_a = p.digest) == null ? void 0 : _a.portrait) ? "修" : "空";
      case "e":
        return `${(_c = (_b = p.digest) == null ? void 0 : _b.events.length) != null ? _c : 0} 事${((_e = (_d = p.manualEvents) == null ? void 0 : _d.length) != null ? _e : 0) ? ` · ${p.manualEvents.length} 记` : ""}`;
      case "c":
        return ((_f = p.digest) == null ? void 0 : _f.chronicle) ? "编年" : "空";
      case "d":
        return p.imports.length ? `${p.imports.length} 次导入` : "—";
      case "f":
        return profileFilled(p.profile) ? "有档" : "补档";
    }
  }
  function profileFilled(prof) {
    var _a, _b, _c, _d, _e, _f;
    if (!prof) return false;
    return Boolean(
      prof.socials && prof.socials.length || prof.tags && prof.tags.length || ((_a = prof.birthday) != null ? _a : "").trim() || ((_b = prof.metVia) != null ? _b : "").trim() || ((_c = prof.metAt) != null ? _c : "").trim() || ((_d = prof.hometown) != null ? _d : "").trim() || ((_e = prof.job) != null ? _e : "").trim() || ((_f = prof.note) != null ? _f : "").trim()
    );
  }
  function foldPortraitBody(mdRoot, p) {
    var _a, _b;
    const out = [mdRoot];
    if ((_b = (_a = p.digest) == null ? void 0 : _a.quotes) == null ? void 0 : _b.length) {
      out.push(el("div", "bz-people-section-title", text("代表原话")));
      const quotes = el("div", "bz-people-quotes");
      for (const q of p.digest.quotes) {
        quotes.appendChild(el("div", "bz-people-quote", [
          el("div", "bz-people-quote-text", text(`「${q.text}」`)),
          el("div", "bz-people-quote-meta", text(`${q.who === "我" ? "我" : p.name} · ${q.ts}`))
        ]));
      }
      out.push(quotes);
    }
    return out;
  }
  function foldEventsBody(p, noteAdd, today) {
    var _a, _b;
    const out = [];
    if ((_a = p.digest) == null ? void 0 : _a.events.length) {
      const events = el("div", "bz-people-events");
      for (const ev of p.digest.events) {
        events.appendChild(el("div", `bz-people-event${ev.kind === "major" ? " bz-people-event-major" : ""}`, [
          el("span", "bz-people-event-ts", text(ev.ts)),
          el("span", "bz-people-event-dot"),
          el("span", "bz-people-event-summary", text(ev.summary))
        ]));
      }
      out.push(events);
    } else {
      out.push(el("div", "bz-people-empty-hint", text("还没有交往事件。导入聊天生成脸谱后会提炼出来。")));
    }
    const evs = (_b = p.manualEvents) != null ? _b : [];
    if (noteAdd) out.push(noteAddRow(today));
    if (evs.length) {
      out.push(el("div", "bz-people-section-title", text("随手记")));
      const list = el("div", "bz-people-notes");
      for (const ev of evs) {
        list.appendChild(el("div", "bz-people-note", [
          el("span", "bz-people-note-ts", text(ev.ts)),
          el("span", "bz-people-note-summary", text(ev.summary)),
          button("bz-people-btn bz-people-btn-ghost bz-people-note-del", "删", { "data-people-ev-del": ev.id })
        ]));
      }
      out.push(list);
    }
    out.push(el("div", "bz-people-prof-entry", [
      ...noteAdd ? [] : [button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "记一笔", { "data-people-note-add": "" })]
    ]));
    return out;
  }
  function foldChronicleBody(mdRoot) {
    return mdRoot ? [mdRoot] : [el("div", "bz-people-empty-hint", text("还没有关系时间线。重画脸谱后会生成。"))];
  }
  function foldDataBody(card, p) {
    const out = [];
    if (card) out.push(card);
    else if (p.imports.length) out.push(el("div", "bz-people-empty-hint", text("这次导入还没有互动统计（旧版数据）。从数据源补画一次即可生成。")));
    else out.push(el("div", "bz-people-empty-hint", text("还没有导入记录。")));
    return out;
  }
  function insightsCard(range, file, chart, rows) {
    const card = el("div", "bz-people-insights", [
      el("div", "bz-people-ins-head", [
        el("div", "bz-people-ins-range", text(range)),
        el("div", "bz-people-ins-file", text(file))
      ])
    ]);
    if (chart) card.appendChild(chart);
    card.appendChild(rows);
    return card;
  }
  function monthlyChart(monthly) {
    if (!monthly.length) return null;
    const max = monthly.reduce((a, [, n]) => Math.max(a, n), 0);
    const wrap = el("div", "bz-people-chart-wrap");
    const chart = el("div", "bz-people-chart");
    for (const [month, n] of monthly) {
      const h = max > 0 ? Math.max(Math.round(n / max * 100), 4) : 0;
      chart.appendChild(el(
        "div",
        "bz-people-col",
        { title: `${month} · ${n} 条` },
        el("div", "bz-people-col-bar", { style: `height:${h}%` })
      ));
    }
    wrap.appendChild(chart);
    const labels = el("div", "bz-people-chart-labels");
    const step = monthly.length <= 8 ? 1 : Math.ceil(monthly.length / 6);
    monthly.forEach(([month], i) => {
      const show = i === 0 || i === monthly.length - 1 || i % step === 0;
      labels.appendChild(el("span", "", text(show ? month.slice(2) : "")));
    });
    wrap.appendChild(labels);
    return wrap;
  }
  function insRow(label, mid, val) {
    return el("div", "bz-people-ins-row", [
      el("span", "bz-people-ins-label", text(label)),
      typeof mid === "string" ? el("span", "", text("")) : mid,
      el("span", "bz-people-ins-val", text(val))
    ]);
  }
  function duoBar(mePct, otherPct) {
    return el("div", "bz-people-duo", [
      mePct > 0 ? el("div", "bz-people-duo-me", { style: `width:${mePct}%` }) : el("div", "bz-people-duo-me"),
      otherPct > 0 ? el("div", "bz-people-duo-other", { style: `width:${otherPct}%` }) : el("div", "bz-people-duo-other")
    ]);
  }
  function hourStrip(hourly) {
    const total = hourly.reduce((a, n) => a + n, 0);
    const max = Math.max(...hourly);
    const strip = el("div", "bz-people-strip", hourly.map((n, i) => {
      const h = max > 0 && n > 0 ? Math.max(Math.round(n / max * 100), 6) : 0;
      return el("div", "bz-people-strip-bar", { style: `height:${h}%`, title: `${i} 点 · ${n} 条` });
    }));
    return { strip, peak: hourly.indexOf(max), total };
  }
  function kindChips(kinds) {
    const total = kinds.reduce((a, [, n]) => a + n, 0);
    return el("div", "bz-people-kinds", kinds.map(([k, n]) => el("span", "bz-people-kind", text(`${k} ${formatCount(n)} · ${Math.round(n / total * 100)}%`))));
  }
  function profileView(prof) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const rows = [];
    const addRow = (label, value) => {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text(label)),
        el("span", "bz-people-prof-value", text(value))
      ]));
    };
    if ((_a = prof == null ? void 0 : prof.socials) == null ? void 0 : _a.length) {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("社交账号")),
        el("span", "bz-people-prof-value", text(prof.socials.map((s) => [s.platform, s.handle].filter(Boolean).join(" ")).filter(Boolean).join(" · ")))
      ]));
    }
    if ((_b = prof == null ? void 0 : prof.birthday) == null ? void 0 : _b.trim()) addRow("生日", prof.birthday.trim());
    if ((_c = prof == null ? void 0 : prof.metVia) == null ? void 0 : _c.trim()) addRow("认识方式", prof.metVia.trim());
    if ((_d = prof == null ? void 0 : prof.metAt) == null ? void 0 : _d.trim()) addRow("认识时间", prof.metAt.trim());
    if ((_e = prof == null ? void 0 : prof.hometown) == null ? void 0 : _e.trim()) addRow("家乡 / 现居", prof.hometown.trim());
    if ((_f = prof == null ? void 0 : prof.job) == null ? void 0 : _f.trim()) addRow("职业", prof.job.trim());
    if ((_g = prof == null ? void 0 : prof.tags) == null ? void 0 : _g.length) {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("标签")),
        el("span", "bz-people-prof-tags", prof.tags.filter(Boolean).map((t) => el("span", "bz-people-chip", text(t))))
      ]));
    }
    if ((_h = prof == null ? void 0 : prof.note) == null ? void 0 : _h.trim()) addRow("备注", prof.note.trim());
    rows.push(el("div", "bz-people-prof-actions", [
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "编辑档案", { "data-people-prof-edit": "" })
    ]));
    return el("div", "bz-people-prof", rows);
  }
  function profInput(value, placeholder, attr, cls = "bz-people-prof-input") {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = cls;
    inp.value = value;
    inp.placeholder = placeholder;
    inp.setAttribute(attr[0], attr[1]);
    return inp;
  }
  function socialRow(platform, handle) {
    return el("div", "bz-people-prof-social-row", [
      profInput(platform, "平台（微信 / 微博…）", ["data-people-prof-social-platform", ""], "bz-people-prof-input bz-people-prof-social-platform"),
      profInput(handle, "账号", ["data-people-prof-social-handle", ""], "bz-people-prof-input bz-people-prof-social-handle"),
      button("bz-people-btn bz-people-btn-ghost bz-people-prof-x", "×", { "data-people-prof-social-del": "", "aria-label": "删除这条社交账号" })
    ]);
  }
  function tagChip(t) {
    return el("span", "bz-people-prof-tag", [
      el("span", "bz-people-prof-tag-text", text(t)),
      button("bz-people-btn bz-people-btn-ghost bz-people-prof-x", "×", { "data-people-prof-tag-del": "", "aria-label": `删除标签 ${t}` })
    ]);
  }
  function profileEditor(prof) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const grid = (label, input) => el("div", "bz-people-prof-row", [el("span", "bz-people-prof-label", text(label)), input]);
    const socialList = el("div", "bz-people-prof-social-list", { "data-people-prof-social-list": "" });
    for (const s of (_a = prof == null ? void 0 : prof.socials) != null ? _a : []) socialList.appendChild(socialRow(s.platform, s.handle));
    const tagList = el("div", "bz-people-prof-tag-list", { "data-people-prof-tag-list": "" });
    for (const t of (_b = prof == null ? void 0 : prof.tags) != null ? _b : []) tagList.appendChild(tagChip(t));
    const tagInput = profInput("", "加标签…", ["data-people-prof-tag-input", ""], "bz-people-prof-input bz-people-prof-tag-input");
    return el("div", "bz-people-prof bz-people-prof-edit", [
      el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("社交账号")),
        el("div", "bz-people-prof-social", [
          socialList,
          el("div", "bz-people-prof-social-tools", [
            button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "+ 社交账号", { "data-people-prof-add-social": "" })
          ])
        ])
      ]),
      grid("生日", profInput((_c = prof == null ? void 0 : prof.birthday) != null ? _c : "", "YYYY-MM-DD 或 MM-DD", ["data-people-prof-field", "birthday"])),
      grid("认识方式", profInput((_d = prof == null ? void 0 : prof.metVia) != null ? _d : "", "怎么认识的", ["data-people-prof-field", "metVia"])),
      grid("认识时间", profInput((_e = prof == null ? void 0 : prof.metAt) != null ? _e : "", "比如 2023 年夏天", ["data-people-prof-field", "metAt"])),
      grid("家乡 / 现居", profInput((_f = prof == null ? void 0 : prof.hometown) != null ? _f : "", "家乡 · 现居", ["data-people-prof-field", "hometown"])),
      grid("职业", profInput((_g = prof == null ? void 0 : prof.job) != null ? _g : "", "职业", ["data-people-prof-field", "job"])),
      el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("标签")),
        el("div", "bz-people-prof-tags-edit", [
          tagList,
          el("div", "bz-people-prof-tag-tools", [
            tagInput,
            button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "+ 标签", { "data-people-prof-tag-add": "" })
          ])
        ])
      ]),
      grid("备注", profInput((_h = prof == null ? void 0 : prof.note) != null ? _h : "", "一句话备注", ["data-people-prof-field", "note"])),
      el("div", "bz-people-prof-actions", [
        button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "保存档案", { "data-people-prof-save": "" }),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "取消", { "data-people-prof-cancel": "" })
      ])
    ]);
  }
  function foldProfileBody(p, editing) {
    const out = [];
    const hasProf = profileFilled(p.profile);
    if (hasProf || editing) out.push(editing ? profileEditor(p.profile) : profileView(p.profile));
    if (!hasProf && !editing) {
      out.push(el("div", "bz-people-prof-entry bz-people-prof-entry-solo", [
        el("span", "bz-people-prof-entry-hint", text("聊天之外的也可以记：")),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "补人物档案", { "data-people-prof-new": "" })
      ]));
    }
    return out;
  }
  function noteAddRow(today) {
    const date = document.createElement("input");
    date.type = "date";
    date.className = "bz-people-prof-input bz-people-note-date";
    date.value = today;
    date.setAttribute("data-people-note-date", "");
    const txt = profInput("", "一句话记下这一天……", ["data-people-note-text", ""], "bz-people-prof-input bz-people-note-text");
    return el("div", "bz-people-note-add", [
      date,
      txt,
      button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "记一笔", { "data-people-note-save": "" }),
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "收起", { "data-people-note-cancel": "" })
    ]);
  }
  function miniMarkdown(md) {
    const root = el("div", "bz-people-portrait");
    let list = null;
    let quote = null;
    const appendInline = (elm, str) => {
      const parts = str.split(/\*\*(.+?)\*\*/g);
      parts.forEach((part, i) => {
        if (!part) return;
        if (i % 2 === 1) elm.appendChild(textEl("strong", part));
        else elm.appendChild(document.createTextNode(part));
      });
    };
    for (const raw of String(md != null ? md : "").replace(/```+/g, "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        list = null;
        quote = null;
        continue;
      }
      if (line.startsWith("### ")) {
        list = null;
        quote = null;
        root.appendChild(textEl("h5", line.slice(4)));
        continue;
      }
      if (line.startsWith("## ")) {
        list = null;
        quote = null;
        root.appendChild(textEl("h4", line.slice(3)));
        continue;
      }
      if (line.startsWith("- ")) {
        quote = null;
        if (!list) {
          list = document.createElement("ul");
          root.appendChild(list);
        }
        const li = document.createElement("li");
        appendInline(li, line.slice(2));
        list.appendChild(li);
        continue;
      }
      if (line.startsWith(">")) {
        list = null;
        if (!quote) {
          quote = document.createElement("blockquote");
          root.appendChild(quote);
        }
        const p2 = document.createElement("p");
        appendInline(p2, line.slice(1).replace(/^\s/, ""));
        quote.appendChild(p2);
        continue;
      }
      list = null;
      quote = null;
      const p = document.createElement("p");
      appendInline(p, line);
      root.appendChild(p);
    }
    return root;
  }
  function dsWatermark(row) {
    if (!row.previewCount) return "未导入";
    const drawn = row.processedTs ? ` · 画到 ${formatDay(row.processedTs).slice(2)}` : " · 未画脸谱";
    return `已导 ${formatCount(row.previewCount)} 条${drawn}`;
  }
  function dsRow(row, on) {
    const fresh = row.newCount > 0;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = on;
    cb.disabled = row.isGroup;
    cb.setAttribute("data-people-ds-check", row.name);
    const cls = `bz-people-ds-row${on ? " bz-people-ds-on" : ""}${fresh ? " bz-people-ds-fresh" : ""}${row.isGroup ? " bz-people-ds-off" : ""}`;
    return el("label", cls, [
      cb,
      el("div", "bz-people-ds-ava", { style: `background:${avatarColor(row.name)}` }, text(initials(row.name))),
      el("div", "bz-people-ds-main", [
        el("div", "bz-people-ds-name", text(row.name + (row.isGroup ? "（群）" : ""))),
        el("div", "bz-people-ds-meta", text([
          `${formatCount(row.rawCount)} 条`,
          row.media
        ].filter(Boolean).join(" · ")))
      ]),
      el("div", "bz-people-ds-side", [
        ...fresh ? [el("span", "bz-people-ds-new", text(`新 ${row.newCount} 条`))] : [],
        el("span", "bz-people-ds-mark", text(dsWatermark(row)))
      ])
    ]);
  }
  function dsModal(s) {
    const wrap = el("div", "bz-people-ds-pop", { "data-people-ds-pop": "" });
    wrap.appendChild(el("div", "bz-people-ds-dim", { "data-people-ds-dim": "" }));
    const pop = el("div", "bz-people-ds-panel", { role: "dialog", "aria-label": "数据源" });
    pop.appendChild(el("div", "bz-people-ds-head", [
      el("div", "bz-people-ds-title", text("数据源")),
      el("div", "bz-people-ds-headmeta", text([
        s.scanning ? "正在扫描…" : s.rows ? `${s.rows.length} 位联系人` : "",
        s.hiddenGroups > 0 ? `${s.hiddenGroups} 个群聊未纳入` : ""
      ].filter(Boolean).join(" · "))),
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", s.scanning ? "扫描中…" : "重扫", { "data-people-ds-scan": "" }),
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "关闭", { "data-people-ds-close": "" })
    ]));
    pop.appendChild(el("div", "bz-people-ds-path", text(s.dataDir || "尚未配置数据文件夹——到「设置 → 脸谱」粘贴预处理导出目录。" + (s.scannedAt ? ` · 扫描于 ${s.scannedAt}` : ""))));
    if (s.desktopOnly) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("数据源扫描仅桌面端支持（需要读取库外文件夹）。")));
    } else if (s.scanning) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("正在扫描数据文件夹…")));
    } else if (!s.rows) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("还没扫描。点「重扫」读取数据文件夹里的联系人。")));
    } else if (!s.rows.length) {
      pop.appendChild(el("div", "bz-people-ds-empty", text(
        s.hiddenGroups > 0 ? `没有可导入的单聊（另有 ${s.hiddenGroups} 个群聊未纳入，可在设置开启）。` : "数据文件夹里没有找到联系人（各联系人目录下需有 chat.json）。"
      )));
    } else {
      const list = el("div", "bz-people-ds-list");
      for (const r of s.rows) list.appendChild(dsRow(r, false));
      pop.appendChild(list);
      const hasFresh = s.rows.some((r) => r.newCount > 0);
      pop.appendChild(el("div", "bz-people-ds-legend", [
        el("span", "", [el("i", "bz-people-dot bz-people-dot-ok"), text("有更新")]),
        el("span", "", [el("i", "bz-people-dot bz-people-dot-idle"), text("已导无更新")]),
        el("span", "", [el("i", "bz-people-dot bz-people-dot-none"), text("未导入")]),
        ...hasFresh ? [button("bz-people-ds-pickfresh", "勾有更新的", { "data-people-ds-pickfresh": "" })] : []
      ]));
    }
    const foot = el("div", "bz-people-ds-foot", [
      el("span", "bz-people-ds-count", { "data-people-ds-count": "" }, text(footerLabel(s))),
      ...s.generateable && !s.importing ? [button("bz-people-btn bz-people-btn-acc", "画脸谱", { "data-people-ds-generate": "", title: "关闭弹窗，用预览素材生成脸谱" })] : [],
      button("bz-people-btn bz-people-btn-acc", s.importing ? "导入中…" : "导入所选", { "data-people-ds-import": "" })
    ]);
    pop.appendChild(foot);
    if (s.notice) pop.appendChild(el("div", "bz-people-ds-notice", { "data-people-ds-notice": "" }, text(s.notice)));
    wrap.appendChild(pop);
    return wrap;
  }
  function footerLabel(s) {
    if (!s.rows) return "";
    if (!s.selectedCount) return "未勾选联系人";
    return s.freshCount ? `已选 ${s.selectedCount} 位 · 新素材 ${s.freshCount} 条` : `已选 ${s.selectedCount} 位 · 所选暂无新素材`;
  }
  function importMeta(rec, textMsgs) {
    return `${rec.timeFrom.slice(0, 7)} ~ ${rec.timeTo.slice(0, 7)} · 共 ${formatCount(textMsgs)} 条文本（形态占比含图片/语音等全部消息形态）`;
  }
  return __toCommonJS(render_exports);
})();
