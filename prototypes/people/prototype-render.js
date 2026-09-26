/* 源指纹 4dff88550f1ebd2c · 仓内输入 1 个（校验见 tests/preview-freshness.test.ts） */
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
    avatarUri: () => avatarUri,
    button: () => button,
    dsModal: () => dsModal,
    dsRow: () => dsRow,
    dsWatermark: () => dsWatermark,
    duoBar: () => duoBar,
    el: () => el,
    foldBondBody: () => foldBondBody,
    foldBook: () => foldBook,
    foldCard: () => foldCard,
    foldDetailHead: () => foldDetailHead,
    foldEventsBody: () => foldEventsBody,
    foldHint: () => foldHint,
    foldPersonBody: () => foldPersonBody,
    foldSeal: () => foldSeal,
    foldSealNode: () => foldSealNode,
    foldWall: () => foldWall,
    formatCount: () => formatCount,
    formatDay: () => formatDay,
    formatDuration: () => formatDuration,
    formatReplySec: () => formatReplySec,
    hourStrip: () => hourStrip,
    iconButton: () => iconButton,
    importMeta: () => importMeta,
    initials: () => initials,
    insRow: () => insRow,
    insightsCard: () => insightsCard,
    jobsFallbackMessage: () => jobsFallbackMessage,
    jobsPercent: () => jobsPercent,
    jobsQueueLabel: () => jobsQueueLabel,
    jobsStagesDone: () => jobsStagesDone,
    kindChips: () => kindChips,
    localResourceUri: () => localResourceUri,
    mdPlain: () => mdPlain,
    mediaLabel: () => mediaLabel,
    mergeBar: () => mergeBar,
    miniMarkdown: () => miniMarkdown,
    monthlyChart: () => monthlyChart,
    noteAddRow: () => noteAddRow,
    panelShell: () => panelShell,
    popShell: () => popShell,
    profileEditor: () => profileEditor,
    profileFilled: () => profileFilled,
    profilePopBody: () => profilePopBody,
    profileView: () => profileView,
    progressBlock: () => progressBlock,
    replyLatencySec: () => replyLatencySec,
    socialRow: () => socialRow,
    spillOf: () => spillOf,
    statsPopBody: () => statsPopBody,
    statsText: () => statsText,
    tagChip: () => tagChip,
    text: () => text,
    textEl: () => textEl,
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
  function replyLatencySec(median, avg) {
    var _a;
    return (_a = median != null ? median : avg) != null ? _a : 0;
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
  function localResourceUri(path) {
    var _a, _b;
    const norm = path.replace(/\\/g, "/");
    const escape = (s) => s.replace(/#/g, "%23").replace(/\?/g, "%3F");
    if (typeof window !== "undefined") {
      const base = window.BZW_MEDIA_BASE;
      if (base) return base + escape(encodeURI(norm));
      const w = window;
      const adapter = (_b = (_a = w.app) == null ? void 0 : _a.vault) == null ? void 0 : _b.adapter;
      const res = adapter == null ? void 0 : adapter.getResourcePath;
      if (adapter && res && !/^[A-Za-z]:/.test(norm) && !/^(https?:)?\/\//.test(norm) && !norm.startsWith("/")) {
        try {
          return res.call(adapter, norm);
        } catch (e) {
        }
      }
    }
    if (/^(https?:)?\/\//.test(norm) || norm.startsWith("/")) return norm;
    const rel = norm.replace(/^[A-Za-z]:/, "").replace(/^\/+/, "");
    return `app://local/${escape(encodeURI(rel))}`;
  }
  function avatarUri(a) {
    return a.startsWith("data:") ? a : localResourceUri(a);
  }
  function mdPlain(md) {
    return String(md != null ? md : "").replace(/```+/g, "").split(/\r?\n/).map((l) => l.replace(/^#{1,6}\s*/, "").replace(/^>\s?/, "").replace(/^-\s*/, "").replace(/\*\*/g, "").trim()).filter(Boolean).join(" ");
  }
  function spillOf(s, n = 40) {
    const t = mdPlain(s);
    return [...t].length <= n ? t : `${[...t].slice(0, n).join("")}…`;
  }
  function iconButton(icon, cls, attrs) {
    const b = el("button", cls, attrs);
    b.type = "button";
    b.appendChild(el("i", "bz-ic", { "data-lucide": icon, "aria-hidden": "true" }));
    return b;
  }
  function panelShell() {
    return el("div", "bz-people-panel", [
      el("div", "bz-people-head", [
        el("div", "bz-people-brand", [
          el("div", "bz-people-mark", { "aria-hidden": "true" }, el("i", "bz-ic", { "data-lucide": "smile" })),
          el("div", "bz-people-brand-text", [
            el("h1", "bz-people-title", text("脸谱")),
            el("div", "bz-people-sub", text("人物消息脸谱"))
          ])
        ]),
        el("div", "bz-people-head-actions", [
          iconButton("database", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-ds-open": "", "aria-label": "数据源", title: "数据源" })
        ])
      ]),
      el("div", "bz-people-stats", { "data-people-stats": "" }),
      el("div", "bz-people-jobs-slot", { "data-people-jobs-slot": "", hidden: "" }),
      el("div", "bz-people-body", { "data-people-body": "" }),
      el("div", "bz-people-ds-layer", { "data-people-ds-layer": "", hidden: "" }),
      el("div", "bz-people-pop-layer", { "data-people-pop-layer": "", hidden: "" })
    ]);
  }
  function jobsPercent(batchesDone, batchesTotal, stagesDone) {
    const denom = (batchesTotal > 0 ? batchesTotal : 0) + 3;
    const numer = Math.max(0, batchesDone || 0) + Math.max(0, stagesDone || 0);
    return Math.min(100, Math.round(numer / denom * 100));
  }
  function jobsStagesDone(stage, status) {
    if (status === "done") return 3;
    if (stage === "chronicle") return 2;
    if (stage === "bond") return 1;
    return 0;
  }
  function jobsQueueLabel(queueIndex, queueTotal, name) {
    const pos = queueTotal > 1 ? `（${Math.max(1, queueIndex)}/${queueTotal} 人）` : "";
    return `${pos}当前：${name}`;
  }
  function jobsFallbackMessage(status, name) {
    switch (status) {
      case "running":
        return `正在生成「${name}」的脸谱…`;
      case "paused":
        return "已暂停——点「继续生成」接着画";
      case "interrupted":
        return `上次「${name}」生成中断了——点「继续生成」接着画（已完成的批次不重画）`;
      case "error":
        return `「${name}」生成失败`;
      case "done":
        return `「${name}」的脸谱已生成`;
    }
  }
  var JOBS_ACTIONS = {
    running: { label: "暂停", hook: "data-people-jobs-pause" },
    paused: { label: "继续生成", hook: "data-people-jobs-resume" },
    interrupted: { label: "继续生成", hook: "data-people-jobs-resume" },
    // issue 453：error 也出「继续生成」——451 已放宽 resume 接受 error（从 batchesDone 续跑）。
    // 450 时这里只有「删除任务」，把用户逼到别的入口（详情头 / 数据源弹窗）去「重新画」，那才是重烧。
    error: { label: "继续生成", hook: "data-people-jobs-resume" },
    done: null
  };
  function jobsActionOf(s) {
    if (s.status === "error" && s.resumable === false) return { label: "删除任务", hook: "data-people-jobs-dismiss" };
    return JOBS_ACTIONS[s.status];
  }
  function progressBlock(s) {
    const pct = jobsPercent(s.batchesDone, s.batchesTotal, s.stagesDone);
    const block = el("div", "bz-people-jobs", {
      "data-people-jobs": "",
      "data-people-jobs-talker": s.talker,
      role: "status"
    });
    block.appendChild(el("div", "bz-people-jobs-meter", [
      el(
        "div",
        "bz-people-jobs-bar",
        { "aria-hidden": "true" },
        el("div", "bz-people-jobs-fill", { style: `width:${pct}%` })
      ),
      el("span", "bz-people-jobs-pct", text(`${pct}%`))
    ]));
    const next = Math.min(s.batchesDone + 1, s.batchesTotal);
    const main = s.status === "error" ? `生成失败 · 已完成 ${s.batchesDone}/${s.batchesTotal} 批` : s.status === "paused" ? "已暂停" : s.status === "interrupted" ? "上次生成中断了" : s.status === "done" ? "脸谱已生成" : `正在生成 · 第 ${next}/${s.batchesTotal} 批`;
    block.appendChild(el("div", "bz-people-jobs-main", text(main)));
    const action = jobsActionOf(s);
    const foot = [];
    if (s.status === "error" && s.errorText) foot.push(el("span", "bz-people-jobs-err", text(s.errorText)));
    if (action) foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", action.label, { [action.hook]: "" }));
    if (foot.length) block.appendChild(el("div", "bz-people-jobs-foot", foot));
    return block;
  }
  function statsText(people) {
    const total = people.reduce((s, p) => s + p.imports.reduce((x, r) => x + r.messageCount, 0), 0);
    const faces = people.filter((p) => p.digest).length;
    return people.length ? `${people.length} 位人物 · ${formatCount(total)} 条消息 · ${faces} 张脸谱` : "还没有人物";
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
  function foldSeal(p, job) {
    const name = p.name || p.id;
    if (job && job.status !== "done") {
      const prog = job.batchesTotal ? `${job.batchesDone}/${job.batchesTotal} 批` : "尚未切批";
      if (job.status === "running") {
        const pct = jobsPercent(job.batchesDone, job.batchesTotal, job.stagesDone);
        return {
          state: "running",
          text: `画谱中
${pct}%`,
          title: `正在生成「${name}」的脸谱（${prog}）——点这里在本批做完后暂停`,
          action: { kind: "pause", label: "暂停" }
        };
      }
      if (job.status === "error" && !job.resumable) {
        return {
          state: "halted",
          text: "画谱中断",
          title: `「${name}」上次生成中断且接不上（消息集已变）——点这里重新生成`,
          action: { kind: "redraw", label: "重新生成" }
        };
      }
      return {
        state: "halted",
        text: `画谱中断
${job.batchesTotal ? `${job.batchesDone}/${job.batchesTotal}` : "待续"}`,
        title: `「${name}」${job.status === "error" ? "上次生成失败" : "上次没画完"}（${prog}）——点这里从断点继续，已画完的批次不重画`,
        action: { kind: "resume", label: "继续生成" }
      };
    }
    if (p.digest) {
      return {
        state: "done",
        text: p.lastProcessedTs ? `画到
${formatDay(p.lastProcessedTs).slice(2)}` : "已画",
        title: `「${name}」的脸谱已画到这天——点这里用新导入的消息补画（没有新消息会跳过）`,
        action: { kind: "redraw", label: "补画" }
      };
    }
    return {
      state: "todo",
      text: "待画",
      title: `「${name}」还没有脸谱——点这里用已导入的消息画一张`,
      action: { kind: "draw", label: "画脸谱" }
    };
  }
  function foldSealNode(p, job) {
    const seal = foldSeal(p, job);
    const b = el("button", `bz-people-seal bz-people-seal-${seal.state}`, {
      "data-people-seal-act": seal.action.kind,
      "aria-label": `${seal.action.label}：${p.name || p.id}`,
      title: seal.title
    });
    b.type = "button";
    b.textContent = seal.text;
    return b;
  }
  function foldAvaNode(p, seal, avatar) {
    const b = el("button", `bz-people-seal bz-people-seal-${seal.state} bz-people-fold-ava`, {
      "data-people-seal-act": seal.action.kind,
      "aria-label": `${seal.action.label}：${p.name || p.id}`,
      title: seal.title
    });
    b.type = "button";
    b.appendChild(el("img", "", { src: avatarUri(avatar), alt: p.name }));
    return b;
  }
  function foldCard(p, opts) {
    var _a, _b, _c, _d, _e;
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const from = p.imports.map((r) => r.timeFrom).sort()[0];
    const to = p.imports.map((r) => r.timeTo).sort().pop();
    const span = from && to ? `${from.slice(0, 7)} ~ ${to.slice(0, 7)}` : "";
    const rel = (_c = ((_b = (_a = p.profile) == null ? void 0 : _a.tags) != null ? _b : []).filter(Boolean)[0]) != null ? _c : "";
    const label = mediaLabel(opts.media);
    const seal = foldSeal(p, (_d = opts.job) != null ? _d : null);
    const card = el("div", "bz-people-fold", [
      el("div", "bz-people-fold-inner", [
        opts.avatar ? foldAvaNode(p, seal, opts.avatar) : foldSealNode(p, (_e = opts.job) != null ? _e : null),
        el("div", "bz-people-fold-title vt", { title: p.name }, text(vtName(p.name))),
        // 无关系、无跨度时不再兜底「N 条」——meta 行已有同一数字，卡面重复（448 评审 P2）
        el("div", "bz-people-fold-who", text(rel || (span ? span : "新折"))),
        el("div", "bz-people-fold-meta", text([
          total ? `${formatCount(total)} 条` : "尚无消息",
          label,
          seal.state === "done" && p.lastProcessedTs ? `画到 ${formatDay(p.lastProcessedTs).slice(2)}` : ""
        ].filter(Boolean).join(" · ")))
      ])
    ]);
    if (opts.mergeFrom) card.classList.add("bz-people-fold-merge-src");
    else if (opts.mergePick) card.classList.add("bz-people-fold-merge-pick");
    card.setAttribute("data-people-card", p.id);
    return card;
  }
  function foldWall() {
    return el("div", "bz-people-wall", { "data-people-wall": "" });
  }
  function wallEmpty() {
    return el("div", "bz-people-empty", [
      el("div", "bz-people-empty-mark", { "aria-hidden": "true" }, el("i", "bz-ic", { "data-lucide": "smile" })),
      el("div", "bz-people-empty-title", text("还没有脸谱")),
      el("div", "bz-people-empty-hint", text("打开「数据源」勾选联系人导入预览，再点「画脸谱」——AI 会为对方修一册脸谱：画像、性格、共同回忆。聊天原文只在本机提炼，不落盘。")),
      button("bz-people-btn bz-people-btn-acc", "打开数据源", { "data-people-ds-open": "" })
    ]);
  }
  var FOLD_TITLES = [
    ["p", "其人", "卷一 · 人物画像与代表原话"],
    ["b", "相交", "卷二 · 关系画像"],
    ["e", "纪事", "关系时间线（编年）+ 交往事件（按月）"]
  ];
  function foldDetailHead(p, media, opts) {
    var _a, _b;
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const job = opts.job && opts.job.status !== "done" ? opts.job : null;
    const action = job ? iconButton("refresh-cw", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", {
      "data-people-generate-one": "",
      "aria-label": job.status === "running" ? "正在生成" : "继续生成",
      title: job.status === "running" ? `正在生成「${p.name}」的脸谱（${job.batchesDone}/${job.batchesTotal} 批）——进度看面板顶部` : `继续生成（已完成 ${job.batchesDone}/${job.batchesTotal} 批，不会从头重烧）`
    }) : opts.canGenerate ? iconButton("paintbrush", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-generate-one": "", "aria-label": "画脸谱", title: "画脸谱（用已导入的消息生成）" }) : null;
    const tags = ((_b = (_a = p.profile) == null ? void 0 : _a.tags) != null ? _b : []).filter(Boolean).slice(0, 3);
    const meta = el("div", "bz-people-card-meta");
    if (total) {
      meta.appendChild(textEl("b", formatCount(total)));
      meta.appendChild(text(` 条消息 · ${p.imports.length} 次导入`));
      if (p.digest) meta.appendChild(text(` · 脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}`));
    } else meta.appendChild(text("尚无导入"));
    const id = el("div", "bz-people-dt-id", [
      el("div", "bz-people-dt-name", [
        text(p.name),
        ...tags.length ? [el("span", "bz-people-dt-tags", tags.map((t) => el("span", "bz-people-dt-tag", [text(t)])))] : []
      ]),
      meta
    ]);
    return el("div", "bz-people-dt-head", [
      opts.avatar ? el("img", "bz-people-dt-avatar", { src: avatarUri(opts.avatar), alt: p.name }) : el("div", "bz-people-dt-seal", { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
      id,
      el("div", "bz-people-dt-actions", [
        ...action ? [action] : [],
        // 455 评审：记一笔自纪事折抽出，独立弹窗，入口在互动统计之前
        iconButton("pencil", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-note-open": "", "aria-label": "记一笔", title: "记一笔" }),
        // issue 455：数据统计 / 补充背景两页折改独立弹窗，入口收进详情头工具条（返回钮在前、DOM 序居其左）
        iconButton("bar-chart-3", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-stats-open": "", "aria-label": "互动统计", title: "互动统计" }),
        iconButton("contact", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-prof-open": "", "aria-label": "补充背景", title: "补充背景" }),
        iconButton("arrow-left", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-back-btn": "", "aria-label": "返回列表", title: "返回列表" })
      ])
    ]);
  }
  function foldBook(p, opts, bodies) {
    var _a;
    const book = el("div", "bz-people-book", { "data-people-book": "" });
    for (const [id, title] of FOLD_TITLES) {
      const on = opts.fold === id;
      const leaf = el("div", `bz-people-leaf${on ? " bz-people-leaf-on" : ""}`, on ? { "data-people-leaf": id } : { "data-people-leaf": id, "data-people-leaf-head": id });
      leaf.appendChild(el("div", "bz-people-leaf-spine", { "aria-hidden": "true" }));
      leaf.appendChild(el("div", "bz-people-leaf-head", [
        el("span", "bz-people-leaf-zh", text(title))
      ]));
      if (on) {
        const body = el("div", "bz-people-leaf-body");
        for (const node of (_a = bodies[id]) != null ? _a : []) body.appendChild(node);
        leaf.appendChild(body);
      }
      book.appendChild(leaf);
    }
    return book;
  }
  function profileFilled(prof) {
    var _a, _b, _c, _d, _e, _f;
    if (!prof) return false;
    return Boolean(
      prof.socials && prof.socials.length || prof.tags && prof.tags.length || ((_a = prof.birthday) != null ? _a : "").trim() || ((_b = prof.metVia) != null ? _b : "").trim() || ((_c = prof.metAt) != null ? _c : "").trim() || ((_d = prof.hometown) != null ? _d : "").trim() || ((_e = prof.job) != null ? _e : "").trim() || ((_f = prof.note) != null ? _f : "").trim()
    );
  }
  function foldHint(msg, action) {
    const d = el("div", "bz-people-empty-hint");
    d.appendChild(text(msg));
    if (action) {
      d.appendChild(el("br"));
      d.appendChild(button("bz-people-btn bz-people-btn-ghost", action, { "data-people-ds-open": "" }));
    }
    return d;
  }
  function foldPersonBody(mdRoot, p) {
    var _a, _b;
    const out = mdRoot ? [mdRoot] : [foldHint("还没有其人画像。从数据源导入一次即可生成。", "打开数据源")];
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
  function foldBondBody(mdRoot) {
    return mdRoot ? [mdRoot] : [foldHint("还没有关系画像。从数据源导入一次即可生成。", "打开数据源")];
  }
  function foldEventsBody(p) {
    var _a, _b, _c;
    const out = [];
    if ((_a = p.digest) == null ? void 0 : _a.chronicle) {
      out.push(el("div", "bz-people-chronicle", [miniMarkdown(p.digest.chronicle)]));
      out.push(el("div", "bz-people-ev-divider", [el("span", "", [text("纪事 · 按月")])]));
    }
    if ((_b = p.digest) == null ? void 0 : _b.events.length) {
      const byMonth = /* @__PURE__ */ new Map();
      for (const ev of p.digest.events) {
        const month = ev.ts.slice(0, 7);
        const list = byMonth.get(month);
        if (list) list.push(ev);
        else byMonth.set(month, [ev]);
      }
      const months = el("div", "bz-people-ev-months");
      for (const [month, evs2] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        evs2.sort((a, b) => (a.kind === "major" ? 0 : 1) - (b.kind === "major" ? 0 : 1));
        const group = el("div", "bz-people-ev-mon");
        group.appendChild(el("button", "bz-people-ev-mon-head", { "data-people-ev-mon": "", "aria-label": `展开 ${month}` }, [
          el("span", "bz-people-ev-mon-plus", text("+")),
          el("span", "bz-people-ev-mon-name", text(month)),
          el("span", "bz-people-ev-mon-cnt", text(`${evs2.length} 条`))
        ]));
        const body = el("div", "bz-people-ev-mon-body");
        for (const ev of evs2) {
          body.appendChild(el("div", `bz-people-event${ev.kind === "major" ? " bz-people-event-major" : ""}`, [
            el("span", "bz-people-event-ts", text(ev.ts)),
            el("span", "bz-people-event-dot"),
            el("span", "bz-people-event-summary", text(ev.summary))
          ]));
        }
        group.appendChild(body);
        months.appendChild(group);
      }
      out.push(months);
    } else if (!out.length) {
      out.push(el("div", "bz-people-empty-hint", text("还没有交往纪事。导入聊天生成脸谱后会提炼出来。")));
    }
    const evs = (_c = p.manualEvents) != null ? _c : [];
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
    return out;
  }
  function statsPopBody(card, p) {
    const out = [];
    if (card) out.push(card);
    else if (p.imports.length) {
      const poolOnly = p.imports.some((r) => {
        var _a;
        return r.stats && !((_a = r.stats.monthly) == null ? void 0 : _a.length);
      });
      out.push(el("div", "bz-people-empty-hint", { "data-people-data-hint": "" }, text(poolOnly ? "这些消息还没画过脸谱——画完脸谱后这里会有完整的互动统计（月度分布 / 回复时延 / 活跃时段）。" : "这次导入还没有互动统计（旧版数据）。从数据源再导入一次即可生成。")));
    } else out.push(el("div", "bz-people-empty-hint", { "data-people-data-hint": "" }, text("还没有导入记录。")));
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
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "编辑档案", { "data-people-prof-edit": "" }),
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "AI 补充", { "data-people-prof-ai": "", title: "AI 读交往素材推断缺失字段，填进表单待你确认" })
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
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "AI 补充", { "data-people-prof-ai": "", title: "AI 只填空白字段，填完你可检查再保存" }),
        button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "保存档案", { "data-people-prof-save": "" }),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "取消", { "data-people-prof-cancel": "" })
      ])
    ]);
  }
  function profilePopBody(p, editing) {
    const out = [];
    const hasProf = profileFilled(p.profile);
    if (hasProf || editing) out.push(editing ? profileEditor(p.profile) : profileView(p.profile));
    if (!hasProf && !editing) {
      out.push(el("div", "bz-people-prof-entry bz-people-prof-entry-solo", [
        el("span", "bz-people-prof-entry-hint", text("聊天之外的也可以记：")),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "补人物档案", { "data-people-prof-new": "" }),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "AI 补充", { "data-people-prof-ai": "", title: "AI 读交往素材推断档案，填进表单待你确认" })
      ]));
    }
    return out;
  }
  function popShell(title, rootHook, body) {
    const wrap = el("div", "bz-people-pop", { [rootHook]: "" });
    wrap.appendChild(el("div", "bz-people-pop-dim", { "data-people-pop-close": "" }));
    const pop = el("div", "bz-people-pop-panel", { role: "dialog", "aria-label": title });
    pop.appendChild(el("div", "bz-people-pop-head", [
      el("div", "bz-people-pop-title", text(title)),
      iconButton("x", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-pop-close": "", "aria-label": "关闭", title: "关闭" })
    ]));
    const content = el("div", "bz-people-pop-body");
    for (const node of body) content.appendChild(node);
    pop.appendChild(content);
    wrap.appendChild(pop);
    return wrap;
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
  var MD_SEALS = {
    画像速写: "速",
    性格与思维: "性",
    "表达 DNA": "言",
    兴趣爱好: "趣",
    价值观与红线: "则",
    习惯: "常",
    情感倾向: "情",
    关系定性: "定",
    互动结构: "动",
    演变阶段: "变",
    我们的语言: "语",
    共同记忆: "忆",
    冲突与修复: "克",
    未竟之事: "未",
    经营建议: "营"
  };
  var MD_CN_NO = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  var MD_DATE_RE = /^（([-\d至~\/\s年]+?)）\s*/;
  function miniMarkdown(md) {
    const root = el("div", "bz-people-portrait");
    let sec = null;
    let body = null;
    let list = null;
    let quote = null;
    let no = 0;
    const appendInline = (elm, str) => {
      const parts = str.split(/\*\*(.+?)\*\*/g);
      parts.forEach((part, i) => {
        if (!part) return;
        if (i % 2 === 1) elm.appendChild(textEl("strong", part));
        else elm.appendChild(document.createTextNode(part));
      });
    };
    const openSec = (title) => {
      var _a, _b;
      sec = document.createElement("section");
      sec.className = "bz-md-sec";
      const head = document.createElement("div");
      head.className = "bz-md-sec-h";
      const seal = document.createElement("span");
      seal.className = "bz-md-seal";
      seal.textContent = (_b = (_a = MD_SEALS[title]) != null ? _a : MD_CN_NO[no]) != null ? _b : "·";
      const rule = document.createElement("i");
      rule.className = "bz-md-rule";
      head.append(seal, textEl("h4", title), rule);
      body = document.createElement("div");
      body.className = "bz-md-sec-b";
      sec.append(head, body);
      root.appendChild(sec);
      list = null;
      quote = null;
      no++;
    };
    for (const raw of String(md != null ? md : "").replace(/```+/g, "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        list = null;
        quote = null;
        continue;
      }
      if (line.startsWith("## ")) {
        openSec(line.slice(3).trim());
        continue;
      }
      if (!sec) openSec("概述");
      if (line.startsWith("### ")) {
        list = null;
        quote = null;
        body.appendChild(textEl("h5", line.slice(4)));
        continue;
      }
      if (line.startsWith("- ")) {
        quote = null;
        if (!list) {
          list = document.createElement("div");
          list.className = "bz-md-items";
          body.appendChild(list);
        }
        const it = document.createElement("div");
        it.className = "bz-md-it";
        it.appendChild(el("span", "bz-md-mk"));
        let rest = line.slice(2).trim();
        const m = rest.match(MD_DATE_RE);
        if (m) {
          it.appendChild(el("span", "bz-md-date", [text(m[1])]));
          rest = rest.slice(m[0].length);
        }
        const tx = document.createElement("span");
        tx.className = "bz-md-tx";
        appendInline(tx, rest);
        it.appendChild(tx);
        list.appendChild(it);
        continue;
      }
      if (line.startsWith(">")) {
        list = null;
        if (!quote) {
          quote = document.createElement("div");
          quote.className = "bz-md-quote";
          body.appendChild(quote);
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
      body.appendChild(p);
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
      row.avatar ? el("img", "bz-people-ds-ava bz-people-ds-ava-img", { src: avatarUri(row.avatar), alt: row.name }) : el("div", "bz-people-ds-ava", { style: `background:${avatarColor(row.name)}` }, text(initials(row.name))),
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
      iconButton(
        "refresh-cw",
        `bz-people-btn bz-people-btn-ghost bz-people-icon-btn bz-people-ds-rescan${s.scanning ? " bz-people-spin" : ""}`,
        { "data-people-ds-scan": "", "aria-label": s.scanning ? "扫描中" : "重扫", title: s.scanning ? "扫描中…" : "重扫" }
      )
    ]));
    pop.appendChild(el("div", "bz-people-ds-path", text(s.dataDir || "尚未配置数据根目录——到「设置 → 脸谱」粘贴预处理导出目录。" + (s.scannedAt ? ` · 扫描于 ${s.scannedAt}` : ""))));
    if (s.desktopOnly) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("数据源扫描仅桌面端支持（需要读取库外文件夹）。")));
    } else if (s.scanning) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("正在扫描数据根目录…")));
    } else if (!s.rows) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("还没扫描。点右上刷新图标读取数据根目录里的联系人。")));
    } else if (!s.rows.length) {
      pop.appendChild(el("div", "bz-people-ds-empty", text(
        s.hiddenGroups > 0 ? `没有可导入的单聊（另有 ${s.hiddenGroups} 个群聊未纳入，可在设置开启）。` : "数据根目录里没有找到联系人（各联系人目录下需有 chat.json）。"
      )));
    } else {
      const list = el("div", "bz-people-ds-list");
      for (const r of s.rows) list.appendChild(dsRow(r, s.selected.includes(r.name)));
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
