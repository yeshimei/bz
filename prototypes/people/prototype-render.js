/* 源指纹 561add073b37bdc6 · 仓内输入 2 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/people/render.ts","src/people/types.ts"]*/
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
    AL_PER_PAGE: () => AL_PER_PAGE,
    FOLD_TITLES: () => FOLD_TITLES,
    PER_SPREAD: () => PER_SPREAD,
    albumBlankPage: () => albumBlankPage,
    albumEmpty: () => albumEmpty,
    albumGutter: () => albumGutter,
    albumLoad: () => albumLoad,
    albumPage: () => albumPage,
    albumPhoto: () => albumPhoto,
    albumRow: () => albumRow,
    albumSealNode: () => albumSealNode,
    albumSealOf: () => albumSealOf,
    albumSleeve: () => albumSleeve,
    albumSpread: () => albumSpread,
    albumVacant: () => albumVacant,
    appendSuppImageGridPage: () => appendSuppImageGridPage,
    applyRecStageChain: () => applyRecStageChain,
    avatarColor: () => avatarColor,
    avatarNode: () => avatarNode,
    avatarUri: () => avatarUri,
    button: () => button,
    clipList: () => clipList,
    dateRow: () => dateRow,
    delPage: () => delPage,
    deleteTierOf: () => deleteTierOf,
    detailPage: () => detailPage,
    dsPage: () => dsPage,
    dsRow: () => dsRow,
    dsSyncLineNode: () => dsSyncLineNode,
    dsWaterOf: () => dsWaterOf,
    dsWatermark: () => dsWatermark,
    dueSoonOf: () => dueSoonOf,
    duoBar: () => duoBar,
    el: () => el,
    findPage: () => findPage,
    foldBondBody: () => foldBondBody,
    foldEventsBody: () => foldEventsBody,
    foldHint: () => foldHint,
    foldPersonBody: () => foldPersonBody,
    formatCount: () => formatCount,
    formatDay: () => formatDay,
    formatDuration: () => formatDuration,
    formatReplySec: () => formatReplySec,
    genPage: () => genPage,
    headChip: () => headChip,
    hourStrip: () => hourStrip,
    iconButton: () => iconButton,
    importMeta: () => importMeta,
    initials: () => initials,
    insRow: () => insRow,
    insightsCard: () => insightsCard,
    jobsMainLine: () => jobsMainLine,
    jobsNote: () => jobsNote,
    jobsPercent: () => jobsPercent,
    jobsStageLabel: () => jobsStageLabel,
    jobsStagesDone: () => jobsStagesDone,
    kindChips: () => kindChips,
    lastCur: () => lastCur,
    localResourceUri: () => localResourceUri,
    lockCover: () => lockCover,
    mdPlain: () => mdPlain,
    mediaLabel: () => mediaLabel,
    mergeBanner: () => mergeBanner,
    miniMarkdown: () => miniMarkdown,
    monthlyChart: () => monthlyChart,
    noteAddRow: () => noteAddRow,
    pageTotal: () => pageTotal,
    panelShell: () => panelShell,
    profLeaveAsk: () => profLeaveAsk,
    profPage: () => profPage,
    profileEditor: () => profileEditor,
    profileFilled: () => profileFilled,
    profilePopBody: () => profilePopBody,
    profileView: () => profileView,
    recNote: () => recNote,
    relationRow: () => relationRow,
    replyLatencySec: () => replyLatencySec,
    socialRow: () => socialRow,
    spillOf: () => spillOf,
    statsPage: () => statsPage,
    statsPopBody: () => statsPopBody,
    statsText: () => statsText,
    subPage: () => subPage,
    suppLocalTsValue: () => suppLocalTsValue,
    suppPage: () => suppPage,
    suppRecStageLabel: () => suppRecStageLabel,
    tagChip: () => tagChip,
    tagStk: () => tagStk,
    text: () => text,
    textEl: () => textEl,
    turnLoad: () => turnLoad,
    vtName: () => vtName
  });

  // src/people/types.ts
  function personOf(d) {
    var _a, _b;
    return (_b = (_a = d == null ? void 0 : d.person) != null ? _a : d == null ? void 0 : d.portrait) != null ? _b : "";
  }
  function bondOf(d) {
    var _a;
    return (_a = d == null ? void 0 : d.bond) != null ? _a : "";
  }

  // src/people/render.ts
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
    if (n >= 1e4) {
      const w = (n / 1e4).toFixed(n % 1e4 >= 100 ? 1 : 0);
      return `${w.endsWith(".0") ? w.slice(0, -2) : w} 万`;
    }
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
      el("div", "bz-people-page-wrap", { "data-people-scroll": "wrap" }, [
        el("div", "bz-people-spread", { "data-people-spread": "" })
      ]),
      el("div", "bz-people-tabs", [
        button("bz-people-tab", "找一找", { "data-people-dialog": "find" }),
        button("bz-people-tab", "数据源", { "data-people-dialog": "ds" })
      ]),
      el("div", "bz-people-jobs-slot", { "data-people-jobs-slot": "" }),
      el("div", "bz-people-banner-slot", { "data-people-banner-slot": "" })
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
  var JOBS_ACTIONS = {
    // 运行中不再给「暂停」钮（issue 502 续）：画谱是一次想看完的连续过程，
    // 摆在眼前的暂停反而诱发误触；要中断就关面板 / 换人跑，任务本身留断点可续。
    running: null,
    paused: { label: "继续生成", hook: "data-people-jobs-resume" },
    interrupted: { label: "继续生成", hook: "data-people-jobs-resume" },
    // issue 453：error 也出「继续生成」——451 已放宽 resume 接受 error（从 batchesDone 续跑）。
    // 450 时这里只有「删除任务」，把用户逼到别的入口（详情头 / 数据源弹窗）去「重新画」，那才是重烧。
    error: { label: "继续生成", hook: "data-people-jobs-resume" },
    done: null
  };
  function jobsActionsOf(s) {
    if (s.status === "error" && s.resumable === false) return [{ label: "删除任务", hook: "data-people-jobs-dismiss" }];
    const main = JOBS_ACTIONS[s.status];
    if (!main) return [];
    return s.status === "done" ? [main] : [main, { label: "取消", hook: "data-people-jobs-cancel" }];
  }
  function prepStagePart(s) {
    var _a, _b;
    return (_b = (_a = s.prep) == null ? void 0 : _a.stageText) != null ? _b : null;
  }
  function describeStagePart(s) {
    var _a, _b;
    return (_b = (_a = s.describe) == null ? void 0 : _a.stageText) != null ? _b : null;
  }
  function jobsStageLabel(stage) {
    switch (stage) {
      case "chunked":
        return "正在切批组装素材…";
      case "person":
        return "正在生成《其人》…";
      case "bond":
        return "正在生成《相交》…";
      case "chronicle":
        return "正在生成《纪事》…";
      default:
        return null;
    }
  }
  function jobsStatusPrefix(status) {
    switch (status) {
      case "paused":
        return "已暂停";
      case "interrupted":
        return "上次中断";
      case "error":
        return "生成失败";
      default:
        return "";
    }
  }
  function jobsAnchor(s) {
    const prep = prepStagePart(s);
    if (prep) return prep;
    const desc = describeStagePart(s);
    if (desc) return desc;
    if (s.status === "error") return `已完成 ${s.batchesDone}/${s.batchesTotal} 批`;
    if (s.status === "interrupted") return "";
    const stage = jobsStageLabel(s.stage);
    if (stage) return stage;
    if (s.status === "paused") return "";
    return s.batchesTotal > 0 ? `第 ${Math.min(s.batchesDone + 1, s.batchesTotal)}/${s.batchesTotal} 批` : "";
  }
  function skeleton(line) {
    return line.replace(/正在|生成|·|\s/g, "").replace(/…$/, "");
  }
  function stripStatusWord(detail, status) {
    const word = jobsStatusPrefix(status);
    if (!detail || !word || !detail.startsWith(word)) return detail;
    const rest = detail.slice(word.length).replace(/^[ ·：:，,、—-]+/, "").trim();
    return /^[（(][^）)]*[）)]$/.test(rest) ? rest.slice(1, -1).trim() : rest;
  }
  function mergeAnchorDetail(anchor, detail) {
    if (!detail) return { anchor, detail: "" };
    if (!anchor) return { anchor: "", detail };
    const key = skeleton(anchor);
    const bare = skeleton(detail);
    if (key && bare.includes(key)) return { anchor: detail, detail: "" };
    if (key && key.includes(bare)) return { anchor, detail: "" };
    const tag = anchor.split(" ")[0];
    if (tag && detail.startsWith(tag)) return { anchor: detail, detail: "" };
    return { anchor, detail };
  }
  function jobsMainLine(s) {
    var _a;
    if (s.status === "done") return { head: "脸谱已生成", detail: "" };
    const anchor = jobsAnchor(s);
    const detail = s.status === "error" ? "" : stripStatusWord(((_a = s.message) != null ? _a : "").trim(), s.status);
    const merged = mergeAnchorDetail(anchor, detail);
    const head = [jobsStatusPrefix(s.status), merged.anchor].filter(Boolean).join(" · ");
    return { head: head || "正在生成", detail: merged.detail };
  }
  function jobsNote(s) {
    const stagePart = prepStagePart(s);
    const descPart = describeStagePart(s);
    const pct = stagePart ? s.prep.overall : descPart ? s.describe.overall : jobsPercent(s.batchesDone, s.batchesTotal, s.stagesDone);
    const block = el("div", "bz-people-jobs", {
      "data-people-jobs": "",
      "data-people-jobs-talker": s.talker,
      role: "status"
    });
    if (s.queueTotal > 1) {
      const who = el("div", "bz-people-jobs-who");
      who.append(
        text("第 "),
        textEl("b", String(Math.min(Math.max(1, s.queueIndex), s.queueTotal))),
        text("/"),
        textEl("span", String(s.queueTotal)),
        text(` 位 · ${s.name || s.talker}`)
      );
      block.appendChild(who);
    }
    const meter = el("div", "bz-people-jobs-meter");
    meter.appendChild(el(
      "div",
      "bz-people-jobs-track",
      { "aria-hidden": "true" },
      el("div", "bz-people-jobs-fill", { style: `width:${pct}%` })
    ));
    meter.appendChild(el("span", "bz-people-jobs-pct", text(`${pct}%`)));
    block.appendChild(meter);
    const line = jobsMainLine(s);
    const mainEl = el("div", "bz-people-jobs-main", text(line.head));
    if (line.detail) mainEl.appendChild(el("span", "bz-people-jobs-detail", text(` · ${line.detail}`)));
    block.appendChild(mainEl);
    const foot = [];
    if (s.status === "error" && s.errorText) foot.push(el("span", "bz-people-jobs-err", text(s.errorText)));
    if (s.prep && s.prep.failed > 0 && s.status !== "running" && s.status !== "done") {
      foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "重试失败项", { "data-people-jobs-prep-retry": "" }));
    }
    for (const action of jobsActionsOf(s)) {
      foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", action.label, { [action.hook]: "" }));
    }
    if (foot.length) block.appendChild(el("div", "bz-people-jobs-foot", foot));
    return block;
  }
  var AL_PER_PAGE = 6;
  var PER_SPREAD = 2;
  function pageTotal(count) {
    return Math.max(1, Math.ceil(count / AL_PER_PAGE));
  }
  function lastCur(total) {
    return total % PER_SPREAD === 0 ? Math.max(0, total - PER_SPREAD) : total - 1;
  }
  function turnLoad(cur, total) {
    const lp = cur;
    const rp = Math.max(0, total - cur - PER_SPREAD);
    return { left: { pages: lp, flips: Math.ceil(lp / PER_SPREAD) }, right: { pages: rp, flips: Math.ceil(rp / PER_SPREAD) } };
  }
  function stackSide(side, flips) {
    const box = el("div", `bz-people-stack bz-people-stack-${side}`, flips ? { "data-people-turn": side === "l" ? "prev" : "next" } : void 0);
    for (let i = 1; i <= Math.min(flips, 4); i++) box.appendChild(el("i", "", { style: `--i:${i}` }));
    return box;
  }
  function turnStrip(dir, side) {
    if (side.flips <= 0) return null;
    const b = el("button", `bz-people-turn bz-people-turn-${dir === "prev" ? "l" : "r"}`, {
      "data-people-turn": dir,
      "aria-label": dir === "prev" ? `往前翻一摊（前面还有 ${side.pages} 页）` : `往后翻一摊（后面还有 ${side.pages} 页）`
    });
    b.type = "button";
    return b;
  }
  function albumSpread(inner, load, opts = {}) {
    var _a;
    const cls = ["bz-people-spread", opts.boot ? "bz-people-boot" : "", opts.turn ? `bz-people-turn-${opts.turn}` : "", (_a = opts.mod) != null ? _a : ""].filter(Boolean).join(" ");
    const wrap = el("div", "bz-people-page-wrap", { "data-people-scroll": "wrap" });
    const spread = el("div", cls, { "data-people-spread": "" });
    for (const n of inner) spread.appendChild(n);
    const left = turnStrip("prev", load.left);
    if (left) spread.appendChild(left);
    const right = turnStrip("next", load.right);
    if (right) spread.appendChild(right);
    spread.appendChild(stackSide("l", load.left.flips));
    spread.appendChild(stackSide("r", load.right.flips));
    wrap.appendChild(spread);
    return wrap;
  }
  function albumGutter() {
    return el("div", "bz-people-gutter");
  }
  function headChip(inner) {
    return el("span", "bz-people-head-count", typeof inner === "string" ? text(inner) : inner);
  }
  function albumSealOf(p, job) {
    var _a, _b;
    const name = p.name || p.id;
    if (job && job.status !== "done" && job.queued) {
      return { state: "queued", text: "等", title: `「${name}」排在队里，等着画`, action: null };
    }
    if (job && job.status !== "done") {
      const prog = job.batchesTotal ? `${job.batchesDone}/${job.batchesTotal} 批` : "尚未切批";
      if (job.status === "running") {
        const pct = (_b = (_a = job.describePct) != null ? _a : job.prepPct) != null ? _b : jobsPercent(job.batchesDone, job.batchesTotal, job.stagesDone);
        return {
          state: "running",
          text: "画",
          pct,
          title: `正在生成「${name}」的脸谱（${prog}）——点这里在本批做完后暂停`,
          action: "pause"
        };
      }
      if (job.status === "error" && !job.resumable) {
        return { state: "halted", text: "停", title: `「${name}」上次生成中断且接不上（消息集已变）——去详情页重新生成`, action: null };
      }
      return {
        state: "halted",
        text: job.status === "error" ? "停" : "歇",
        title: `「${name}」${job.status === "error" ? "上次生成失败" : "上次没画完"}（${prog}）——去详情页从断点继续，已画完的批次不重画`,
        action: null
      };
    }
    if (isLegacyFace(p)) return { state: "legacy", text: "旧", title: `「${name}」的脸谱还是旧版单卷——去详情页重画一次`, action: null };
    if (p.digest) {
      return {
        state: "drawn",
        text: p.lastProcessedTs ? "画" : "绘",
        title: `「${name}」的脸谱已画到这天——去详情页用新导入的消息补画（没有新消息会跳过）`,
        action: null
      };
    }
    return { state: "none", text: "", title: "", action: null };
  }
  function isLegacyFace(p) {
    return !!p.digest && !p.digest.person && !!p.digest.portrait;
  }
  function albumSealNode(p, job) {
    var _a;
    const seal = albumSealOf(p, job);
    if (seal.state === "none") return null;
    if (seal.state === "running") {
      const b = el("button", "bz-people-seal bz-people-seal-run", {
        "data-people-seal-act": "pause",
        "aria-label": `暂停生成：${p.name || p.id}`,
        title: seal.title
      });
      b.type = "button";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "bz-people-seal-ring");
      svg.setAttribute("viewBox", "0 0 36 36");
      const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      track.setAttribute("cx", "18");
      track.setAttribute("cy", "18");
      track.setAttribute("r", "15.6");
      track.setAttribute("pathLength", "100");
      const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      arc.setAttribute("class", "bz-people-seal-arc");
      arc.setAttribute("cx", "18");
      arc.setAttribute("cy", "18");
      arc.setAttribute("r", "15.6");
      arc.setAttribute("pathLength", "100");
      arc.setAttribute("style", `stroke-dasharray:${Math.max(0, Math.min(100, (_a = seal.pct) != null ? _a : 0))} 100`);
      svg.append(track, arc);
      b.append(svg, el("span", "", text(seal.text)));
      return b;
    }
    return el("div", `bz-people-seal bz-people-seal-${seal.state}`, { title: seal.title }, text(seal.text));
  }
  function avatarNode(name, avatar, sizeCls = "") {
    if (avatar) return el("img", sizeCls, { src: avatarUri(avatar), alt: name });
    const s = el("span", `${sizeCls} bz-people-ava-txt`.trim(), {
      style: `background:hsl(${avatarHue(name)} 34% 46%)`
    }, text(initials(name)));
    return s;
  }
  function avatarHue(name) {
    let h = 0;
    for (const ch of name) h = h * 31 + ch.codePointAt(0) >>> 0;
    return h % 360;
  }
  function msgsOf(p) {
    return p.imports.reduce((s, r) => s + r.messageCount, 0);
  }
  function albumPhoto(ph, opts = {}) {
    var _a, _b, _c;
    const { p, avatar, index, fresh, due, job } = ph;
    const name = p.name || p.id;
    const seal = albumSealOf(p, job);
    const todo = seal.state === "none";
    const cell = el("div", [
      "bz-people-cell",
      todo ? "bz-people-todo" : "",
      seal.state === "queued" ? "bz-people-wait" : "",
      ((_a = opts.drop) == null ? void 0 : _a.includes(p.id)) ? "bz-people-drop" : "",
      opts.dev && opts.dev === p.id ? "bz-people-dev" : ""
    ].filter(Boolean).join(" "), {
      "data-people-pocket": p.id,
      tabindex: "0",
      role: "button",
      style: `--i:${index}`,
      "aria-label": `${name} · ${formatCount(msgsOf(p))} 条消息`
    });
    const print = el("div", "bz-people-print");
    print.appendChild(el("div", "bz-people-photo", avatarNode(name, avatar)));
    if (todo) print.appendChild(el("div", "bz-people-blank", text("还没洗出来")));
    const sealNode = albumSealNode(p, job);
    if (sealNode) print.appendChild(sealNode);
    if (fresh > 0) print.appendChild(el("div", "bz-people-fresh", text(`新 ${formatCount(fresh)}`)));
    if (due) print.appendChild(el("div", "bz-people-due", { title: `${due.what} · ${due.date}` }, text(`${due.what} ${due.days} 天`)));
    const meta = job && job.status !== "done" ? job.queued ? "排队中" : job.status === "running" ? `画谱中 ${(_c = (_b = job.describePct) != null ? _b : job.prepPct) != null ? _c : jobsPercent(job.batchesDone, job.batchesTotal, job.stagesDone)}%` : job.status === "error" ? "失败待续" : "已暂停" : `${formatCount(msgsOf(p))} 条`;
    print.appendChild(el("div", "bz-people-cap", [
      el("span", "bz-people-name", text(vtName(name))),
      el("span", `bz-people-meta${job && job.status === "running" ? " bz-people-meta-run" : ""}`, text(meta))
    ]));
    cell.appendChild(print);
    return cell;
  }
  function albumVacant() {
    const s = el("span", "bz-people-vacs");
    s.append(text("空位"), el("br"), text("等新照片"));
    return el("div", "bz-people-cell bz-people-vacant", s);
  }
  function albumBlankPage() {
    const rows = [];
    for (let i = 0; i < AL_PER_PAGE; i += 2) {
      const r = el("div", "bz-people-row");
      r.append(albumVacant(), albumVacant(), el("div", "bz-people-row-note"));
      rows.push(r);
    }
    return el("div", "bz-people-page", [
      el("div", "bz-people-page-head", [
        headChip("空页"),
        el("span", "bz-people-head-right", el("span", "bz-people-head-note", text("还没贴到这一页")))
      ]),
      albumSleeve(rows)
    ]);
  }
  function rowEra(a, b) {
    var _a, _b;
    const from = (_b = (_a = a == null ? void 0 : a.p.imports.map((r) => r.timeFrom).sort()[0]) != null ? _a : b == null ? void 0 : b.p.imports.map((r) => r.timeFrom).sort()[0]) != null ? _b : "";
    const y = Number(from.slice(0, 4)) || 0;
    if (!y) return 0;
    return y >= 2024 ? 0 : y >= 2022 ? 1 : y >= 2020 ? 2 : 3;
  }
  function rowNote(a, b) {
    var _a, _b, _c, _d, _e, _f;
    if (!a || !b) return "";
    const ta = ((_b = (_a = a.p.profile) == null ? void 0 : _a.tags) != null ? _b : []).filter(Boolean);
    const tb = ((_d = (_c = b.p.profile) == null ? void 0 : _c.tags) != null ? _d : []).filter(Boolean);
    for (const t of ta) if (tb.includes(t)) return `都算「${t}」`;
    const ya = ((_e = a.p.imports.map((r) => r.timeFrom).sort()[0]) != null ? _e : "").slice(0, 4);
    const yb = ((_f = b.p.imports.map((r) => r.timeFrom).sort()[0]) != null ? _f : "").slice(0, 4);
    if (ya && ya === yb) return `${ya} 年认识的`;
    return "";
  }
  function albumRow(a, b, opts = {}) {
    const row = el("div", "bz-people-row", { "data-era": String(rowEra(a, b)) });
    row.appendChild(a ? albumPhoto(a, opts) : albumVacant());
    row.appendChild(b ? albumPhoto(b, opts) : albumVacant());
    row.appendChild(el("div", "bz-people-row-note", text(rowNote(a, b))));
    return row;
  }
  function albumSleeve(rows) {
    return el("div", "bz-people-boardarea", [
      el("div", "bz-people-sleeve", [
        el("div", "bz-people-board", rows),
        el("div", "bz-people-film")
      ])
    ]);
  }
  function albumPage(cells, no, totalPeople, ledger, opts = {}) {
    const slots = cells.slice(0, AL_PER_PAGE);
    while (slots.length < AL_PER_PAGE) slots.push(null);
    const rows = [];
    for (let i = 0; i < slots.length; i += 2) rows.push(albumRow(slots[i], slots[i + 1], opts));
    const head = el("div", "bz-people-page-head");
    head.appendChild(headChip(el("span", "bz-people-head-count-in", [
      textEl("b", String(no)),
      text(" / "),
      textEl("span", String(pageTotal(totalPeople)))
    ])));
    if (no === 1) {
      head.appendChild(el("span", "bz-people-head-label", text("最近说过话的")));
      const l = el("span", "bz-people-head-ledger");
      l.append(
        text("共 "),
        textEl("b", formatCount(totalPeople)),
        text(" 位 · "),
        textEl("b", formatCount(ledger.msgs)),
        text(" 条 · "),
        textEl("b", String(ledger.faces)),
        text(" 张脸谱")
      );
      head.appendChild(el("span", "bz-people-head-right", l));
    } else {
      const names = cells.filter((c) => !!c).map((c) => c.p.name);
      const span = names.length ? `${names[names.length - 1]} ~ ${names[0]}` : "";
      head.appendChild(el("span", "bz-people-head-right", el("span", "bz-people-head-note", text(span))));
    }
    const page = el("div", "bz-people-page", head);
    page.appendChild(albumSleeve(rows));
    return page;
  }
  function lockCover(boot = false) {
    const spread = el("div", `bz-people-spread bz-people-lockwrap${boot ? " bz-people-boot" : ""}`);
    const cover = el("div", "bz-people-cover", [
      el("div", "bz-people-cover-band"),
      el("div", "bz-people-cover-title", text("脸谱")),
      el("div", "bz-people-cover-sub", text("人物消息脸谱")),
      el("div", "bz-people-clasp", el("i", "bz-ic", { "data-lucide": "lock", "aria-hidden": "true" })),
      el("div", "bz-people-cover-hint", text("脸谱数据在加密保库里 —— 解锁后才能查看。聊天原文只在本机提炼，不落盘。"))
    ]);
    const acts = el("div", "bz-people-cover-acts", [
      button("bz-people-btn", "取消", { "data-people-lock": "cancel" }),
      iconButton("unlock", "bz-people-btn bz-people-btn-acc", { "data-people-lock": "unlock" })
    ]);
    acts.lastElementChild.appendChild(text(" 解锁保险库"));
    cover.appendChild(acts);
    spread.appendChild(cover);
    const wrap = el("div", "bz-people-page-wrap", { "data-people-scroll": "wrap" }, spread);
    return wrap;
  }
  function emptyMark() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "bz-people-empty-ico");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const add = (tag, attrs) => {
      const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      svg.appendChild(n);
    };
    add("circle", { cx: "12", cy: "12", r: "9.4", pathLength: "100" });
    add("path", { d: "M8 14.3s1.6 2.2 4 2.2 4-2.2 4-2.2", pathLength: "100" });
    add("path", { d: "M9 9.4h.02", pathLength: "100" });
    add("path", { d: "M15 9.4h.02", pathLength: "100" });
    return svg;
  }
  function writeOut(s) {
    return el("div", "bz-people-empty-title", [...s].map((c, i) => el("span", "bz-people-w", { style: `--i:${i}` }, text(c))));
  }
  function albumEmpty() {
    const vac = [];
    for (let i = 0; i < AL_PER_PAGE; i++) vac.push(albumVacant());
    const rows = [];
    for (let i = 0; i < vac.length; i += 2) {
      const r = el("div", "bz-people-row");
      r.append(vac[i], vac[i + 1], el("div", "bz-people-row-note"));
      rows.push(r);
    }
    const left = el("div", "bz-people-page", [
      el("div", "bz-people-page-head", [
        headChip("空册"),
        el("span", "bz-people-head-label", text("相册簿还是空的")),
        el("span", "bz-people-head-right", el("span", "bz-people-head-note", text("空位都留着")))
      ]),
      albumSleeve(rows)
    ]);
    const right = el("div", "bz-people-page", [
      el("div", "bz-people-page-head", [headChip("空册"), el("span", "bz-people-head-label", text("第一张照片等着贴"))]),
      el("div", "bz-people-empty", [
        el("div", "bz-people-empty-mark", emptyMark()),
        writeOut("还没贴一张照片"),
        el("div", "bz-people-empty-hint", text("打开「数据源」勾选联系人导入，再点「画脸谱」——AI 会为对方修一册脸谱：画像、性格、共同回忆，洗成照片贴进来。聊天原文只在本机提炼，不落盘。")),
        button("bz-people-btn bz-people-btn-acc", "打开数据源", { "data-people-dialog": "ds" })
      ])
    ]);
    const spread = el("div", "bz-people-spread", { "data-people-spread": "" }, [left, albumGutter(), right]);
    return el("div", "bz-people-page-wrap", { "data-people-scroll": "wrap" }, spread);
  }
  function albumLoad(done, total) {
    const rows = [];
    for (let i = 0; i < AL_PER_PAGE; i += 2) {
      const r = el("div", "bz-people-row");
      r.append(
        el("div", "bz-people-cell bz-people-wait", el("div", "bz-people-print")),
        el("div", "bz-people-cell bz-people-wait", el("div", "bz-people-print")),
        el("div", "bz-people-row-note")
      );
      rows.push(r);
    }
    const pct = total && total > 0 ? Math.min(100, Math.round(done / total * 100)) : null;
    const left = el("div", "bz-people-page", [
      el("div", "bz-people-page-head", [
        headChip("解密中"),
        el("span", "bz-people-head-label", text("正在解密联系人数据")),
        el("span", "bz-people-head-right", el("span", "bz-people-head-note", text("解密完就摊开")))
      ]),
      el("div", "bz-people-empty", [
        el("div", "bz-people-load-figure", [
          el("span", "bz-people-load-num", { "data-people-load-num": "" }, text(String(done))),
          // 分母 span 常驻（清单未读到先只显「位」，paintLoadCount 读到后原位补 `/ N 位`）
          el("span", "bz-people-load-total", text(total ? `/ ${total} 位` : "位"))
        ]),
        el(
          "div",
          "bz-people-load-bar",
          { "aria-hidden": "true" },
          el("div", "bz-people-load-fill", { "data-people-load-fill": "", style: `width:${pct != null ? pct : 0}%` })
        ),
        el("div", "bz-people-empty-hint", text(total ? "保库记录逐位解密中——先不急着看，摊开就好。" : "保库记录逐位解密中——清单还在读，先不急着看。"))
      ])
    ]);
    const right = el("div", "bz-people-page", [
      el("div", "bz-people-page-head", [headChip("解密中"), el("span", "bz-people-head-label", text("解密完就摊开")), el("span", "bz-people-head-right", el("span", "bz-people-head-note", text("先不急着看")))]),
      albumSleeve(rows)
    ]);
    const spread = el("div", "bz-people-spread bz-people-spread-load", { "data-people-spread": "" }, [left, albumGutter(), right]);
    return el("div", "bz-people-page-wrap", { "data-people-scroll": "wrap" }, spread);
  }
  function statsText(people) {
    const total = people.reduce((s, p) => s + p.imports.reduce((x, r) => x + r.messageCount, 0), 0);
    const faces = people.filter((p) => p.digest).length;
    return people.length ? `${people.length} 位人物 · ${formatCount(total)} 条消息 · ${faces} 张脸谱` : "还没有人物";
  }
  var FOLD_TITLES = [
    ["p", "其人", "卷一 · 人物画像与代表原话"],
    ["b", "相交", "卷二 · 关系画像"],
    ["e", "纪事", "编年 + 按月交往事件"]
  ];
  function stampNode(p, job) {
    const seal = albumSealOf(p, job);
    if (seal.state === "none") return text("待画");
    if (seal.state === "legacy") return text("旧版");
    if (seal.state === "queued" || seal.state === "running" || seal.state === "halted") return text("画谱中");
    if (!p.lastProcessedTs) return text("已画");
    const [y, mo, day] = formatDay(p.lastProcessedTs).split("-");
    return [text("画到 "), el("em", void 0, text(`${y}-`)), el("em", void 0, text(`${mo}-${day}`))];
  }
  function detailFacts(p, facts) {
    const out = [];
    const me = Math.max(0, Math.min(100, Math.round(facts.mePct)));
    const duoVal = el("span", "bz-people-fact-v");
    duoVal.append(text("我 "), textEl("b", `${me}%`), text(" · TA "), textEl("b", `${100 - me}%`));
    out.push(el("div", "bz-people-fact", [
      el("span", "bz-people-fact-k", text("谁先开口")),
      el("span", "bz-people-fact-bar", el("i", "", { style: `width:${me}%` })),
      duoVal
    ]));
    if (facts.month) {
      const v = el("span", "bz-people-fact-v");
      v.append(text(`${facts.month[0]} · `), textEl("b", formatCount(facts.month[1])), text(" 条"));
      out.push(el("div", "bz-people-fact", [el("span", "bz-people-fact-k", text("最热的一月")), v]));
    }
    if (facts.images || facts.voices) {
      const v = el("span", "bz-people-fact-v");
      v.append(text("图 "), textEl("b", formatCount(facts.images)), text(" · 语 "), textEl("b", formatCount(facts.voices)));
      out.push(el("div", "bz-people-fact", [el("span", "bz-people-fact-k", text("素材水位")), v]));
    }
    return out.length ? el("div", "bz-people-dt-facts", out) : null;
  }
  function detailPage(p, opts) {
    var _a, _b, _c, _d, _e, _f, _g;
    const name = p.name || p.id;
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const from = (_a = p.imports.map((r) => r.timeFrom).sort()[0]) != null ? _a : "";
    const to = (_b = p.imports.map((r) => r.timeTo).sort().pop()) != null ? _b : "";
    const page = el("div", `bz-people-page bz-people-dpage bz-people-sit-${opts.side === "left" ? "l" : "r"}`, { "data-people-detail": p.id });
    const head = el("div", "bz-people-page-head");
    head.appendChild(el("span", "bz-people-head-label", text(`脸谱 · ${name}`)));
    head.appendChild(el(
      "span",
      "bz-people-head-right",
      button("bz-people-close", "合上这页", { "data-people-act": "back" })
    ));
    page.appendChild(head);
    const body = el("div", "bz-people-pagebody", { "data-people-scroll": "detail" });
    const frame = el("div", "bz-people-bigframe", [
      el("div", "bz-people-tape", { style: "--tr:calc(var(--t2) * -2)" }),
      el("div", "bz-people-bigphoto", avatarNode(name, opts.avatar)),
      el("div", "bz-people-dt-stamp", stampNode(p, opts.job)),
      el("div", "bz-people-bigname", text(name))
    ]);
    const side = el("div", "bz-people-dt-side");
    const tags = ((_d = (_c = p.profile) == null ? void 0 : _c.tags) != null ? _d : []).filter(Boolean);
    if (tags.length) side.appendChild(el("div", "bz-people-dt-tags", tags.map((t) => tagStk(t))));
    const due = dueSoonOf(p);
    if (due) {
      const line = el("div", "bz-people-due-line");
      line.append(el("i", "bz-ic", { "data-lucide": "gift", "aria-hidden": "true" }), el("span", "", text(`${due.what} · ${due.date}（还有 ${due.days} 天）`)));
      side.appendChild(line);
    }
    const meta = el("div", "bz-people-dt-meta");
    meta.append(
      textEl("b", formatCount(total)),
      text(" 条消息 · "),
      textEl("span", formatCount(p.imports.length)),
      text(" 次导入")
    );
    meta.appendChild(el("br"));
    meta.append(text(((_e = p.digest) == null ? void 0 : _e.generatedAt) ? `脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}` : "还没画过脸谱"));
    if (from && to) {
      meta.appendChild(el("br"));
      meta.append(text(`交往 ${from.slice(0, 10)} ~ ${to.slice(0, 10)}`));
    }
    side.appendChild(meta);
    const facts = opts.facts ? detailFacts(p, opts.facts) : null;
    if (facts) side.appendChild(facts);
    body.appendChild(el("div", "bz-people-dttop", [el("div", "bz-people-bigph", frame), side]));
    const gen = genActionOf(p, opts.job);
    const acts = el("div", "bz-people-acts", [
      el("button", "bz-people-act", { "data-people-act": "generate" }, [
        el("i", "bz-ic", { "data-lucide": gen.icon, "aria-hidden": "true" }),
        el("span", "", text(gen.label)),
        el("span", "bz-people-act-hint", text(gen.hint))
      ]),
      el("button", "bz-people-act", { "data-people-act": "note" }, [
        el("i", "bz-ic", { "data-lucide": "import", "aria-hidden": "true" }),
        el("span", "", text("补充素材"))
      ]),
      el("button", "bz-people-act", { "data-people-act": "stats" }, [
        el("i", "bz-ic", { "data-lucide": "bar-chart-3", "aria-hidden": "true" }),
        el("span", "", text("互动统计"))
      ]),
      el("button", "bz-people-act", { "data-people-act": "prof" }, [
        el("i", "bz-ic", { "data-lucide": "contact", "aria-hidden": "true" }),
        el("span", "", text("补充背景"))
      ]),
      el("button", "bz-people-act", { "data-people-act": "del", "data-people-del": p.id }, [
        el("i", "bz-ic", { "data-lucide": "trash-2", "aria-hidden": "true" }),
        el("span", "", text("删除联系人"))
      ]),
      el("button", "bz-people-act", { "data-people-act": "back" }, [
        el("i", "bz-ic", { "data-lucide": "arrow-left", "aria-hidden": "true" }),
        el("span", "", text("合上这页"))
      ])
    ]);
    for (const b of Array.from(acts.children)) b.type = "button";
    body.appendChild(acts);
    const tabs = el("div", "bz-people-ftabs", FOLD_TITLES.map(([id, label]) => button(`bz-people-ftab${opts.fold === id ? " on" : ""}`, label, { "data-people-fold": id, "data-people-leaf-head": id })));
    body.appendChild(tabs);
    const title = (_g = (_f = FOLD_TITLES.find(([id]) => id === opts.fold)) == null ? void 0 : _f[2]) != null ? _g : "";
    body.appendChild(el("div", "bz-people-fsheet", [
      el("div", "bz-people-fsheet-head", el("span", "bz-people-fsheet-title", text(title))),
      el("div", `bz-people-fsheet-body${opts.foldIn ? " bz-people-in" : ""}`, opts.body)
    ]));
    page.appendChild(body);
    return page;
  }
  function genActionOf(p, job) {
    const seal = albumSealOf(p, job);
    if (seal.state === "running" || seal.state === "queued" || seal.state === "halted") {
      return { label: "继续生成", hint: "不从头重烧", icon: "refresh-cw" };
    }
    if (seal.state === "drawn" || seal.state === "legacy") return { label: "补画脸谱", hint: "用新导入的消息", icon: "paintbrush" };
    return { label: "画脸谱", hint: "用已导入的消息生成", icon: "paintbrush" };
  }
  function tagStk(t) {
    const kinds = /* @__PURE__ */ new Set(["前同事", "大学同学", "室友", "旅伴", "表妹", "游戏搭子"]);
    const cls = `bz-people-stk${kinds.has(t) ? " bz-people-stk-red" : ""}`;
    return el("span", cls, { style: `transform:rotate(${[...t].length % 2 ? 3 : -3}deg)` }, text(t));
  }
  function dueSoonOf(p, today = /* @__PURE__ */ new Date()) {
    var _a, _b, _c;
    const list = (_b = (_a = p.profile) == null ? void 0 : _a.importantDates) != null ? _b : [];
    let best = null;
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    for (const d of list) {
      const m = /^(\d{2})-(\d{2})$/.exec(String((_c = d.date) != null ? _c : ""));
      if (!m) continue;
      let when = new Date(base);
      when.setMonth(Number(m[1]) - 1, Number(m[2]));
      if (when.getTime() < base) when = new Date(today.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]));
      const days = Math.round((when.getTime() - base) / 864e5);
      if (days >= 0 && days <= 30 && (!best || days < best.days)) best = { what: d.what, date: d.date, days };
    }
    return best;
  }
  function foldHint(msg) {
    return el("div", "bz-people-empty-hint", text(msg));
  }
  function secTitle(t) {
    return el("div", "bz-people-sec-title", text(t));
  }
  function noteRow(m, pendingDel = false) {
    const row = el("div", "bz-people-note-row", [
      el("span", "bz-people-note-ts", text(m.ts)),
      el("span", "bz-people-note-sum", text(m.summary))
    ]);
    if (pendingDel) {
      row.appendChild(el("span", "bz-people-note-ask", [
        textEl("span", "撕掉这张？"),
        button("bz-people-note-del-ok", "撕掉", { "data-people-note-del-ok": m.id }),
        button("bz-people-note-del-no", "取消", { "data-people-note-del-cancel": m.id })
      ]));
    } else {
      row.appendChild(button("bz-people-note-del", "撕掉", { "data-people-note-del": m.id }));
    }
    return row;
  }
  function clipList(cls, items, first, moreText) {
    const box = el("div", cls);
    items.forEach((n, i) => {
      if (i >= first) n.classList.add("bz-people-more-hide");
      box.appendChild(n);
    });
    if (items.length > first) box.appendChild(button("bz-people-more", moreText, { "data-people-more": "" }));
    return box;
  }
  function foldPersonBody(mdRoot, p) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const out = [mdRoot != null ? mdRoot : foldHint("其人画像还没生成——画一次脸谱就会写出来。")];
    const traits = (_b = (_a = p.digest) == null ? void 0 : _a.traits) != null ? _b : [];
    if (traits.length) {
      out.push(secTitle("性格特质"), clipList(
        "bz-people-traits",
        traits.map((t) => el("span", "bz-people-trait", text(t))),
        12,
        `…另有 ${traits.length - 12} 条`
      ));
    }
    const quotes = (_d = (_c = p.digest) == null ? void 0 : _c.quotes) != null ? _d : [];
    if (quotes.length) {
      out.push(secTitle("代表原话"), clipList(
        "bz-people-quotes",
        quotes.map((q) => el("div", "bz-people-quote-card", [
          el("div", "bz-people-quote-text", text(`「${q.text}」`)),
          el("div", "bz-people-quote-meta", text(`${q.who === "我" ? "我" : p.name} · ${q.ts}`))
        ])),
        8,
        `…另有 ${quotes.length - 8} 条`
      ));
    }
    const interests = (_f = (_e = p.digest) == null ? void 0 : _e.interests) != null ? _f : [];
    if (interests.length) {
      out.push(secTitle("最近在聊什么"), clipList(
        "bz-people-md bz-people-ints",
        interests.map((t) => el("div", "bz-people-it", [el("span", "bz-people-date", text(t.ts)), el("span", "", text(t.topic))])),
        10,
        `…另有 ${interests.length - 10} 条`
      ));
    }
    const moments = (_h = (_g = p.digest) == null ? void 0 : _g.moments) != null ? _h : [];
    if (moments.length) {
      out.push(secTitle("留下的片刻"), clipList(
        "bz-people-md bz-people-moms",
        moments.map((t) => el("div", "bz-people-it", [el("span", "bz-people-date", text(t.ts)), el("span", "", text(t.summary))])),
        6,
        `…另有 ${moments.length - 6} 个片刻`
      ));
    }
    return out;
  }
  function foldBondBody(mdRoot, p) {
    var _a, _b;
    const out = [mdRoot != null ? mdRoot : foldHint("关系画像还没生成——画一次脸谱就会写出来。")];
    const threads = (_b = (_a = p.digest) == null ? void 0 : _a.threads) != null ? _b : [];
    if (threads.length) {
      out.push(secTitle("未竟之事"), clipList(
        // 与另两处同形列表（`bz-people-ints` / `bz-people-moms`）保持一致，给一枚专有类名好让调用方锚定
        "bz-people-md bz-people-thr",
        threads.map((t) => el("div", "bz-people-it", [el("span", "bz-people-date", text(t.ts)), el("span", "", text(t.text))])),
        8,
        `…另有 ${threads.length - 8} 条`
      ));
    }
    return out;
  }
  function foldEventsBody(p, noteDelPending = null) {
    var _a, _b, _c, _d, _e, _f;
    const out = [];
    const chron = (_b = (_a = p.digest) == null ? void 0 : _a.chronicle) != null ? _b : "";
    if (chron) {
      out.push(el("div", "bz-people-chron", miniMarkdown(chron)));
      out.push(el("div", "bz-people-ev-divider", el("span", "", text("纪事 · 按月"))));
    }
    const events = (_d = (_c = p.digest) == null ? void 0 : _c.events) != null ? _d : [];
    if (events.length) {
      const by = /* @__PURE__ */ new Map();
      for (const e of events) {
        const m = e.ts.slice(0, 7);
        const arr = (_e = by.get(m)) != null ? _e : [];
        arr.push(e);
        by.set(m, arr);
      }
      const months = [...by.keys()].sort();
      const wrap = el("div", "bz-people-months");
      months.forEach((m) => {
        var _a2;
        const evs = [...(_a2 = by.get(m)) != null ? _a2 : []].sort((a, b) => (a.kind === "major" ? 0 : 1) - (b.kind === "major" ? 0 : 1));
        const inner = clipList("bz-people-mon-in", evs.map((e) => el("div", `bz-people-ev${e.kind === "major" ? " bz-people-major" : ""}`, [
          el("span", "bz-people-ev-ts", text(e.ts)),
          el("span", "bz-people-ev-sum", text(e.summary))
        ])), 14, `…同月另有 ${evs.length - 14} 条`);
        const head = el("button", "bz-people-mon-head", { "data-people-mon": m });
        head.type = "button";
        head.append(el("span", "bz-people-mon-plus", text("+")), el("span", "bz-people-mon-chip", text(m)), el("span", "bz-people-mon-cnt", text(`${evs.length} 条`)));
        wrap.appendChild(el("div", "bz-people-mon", [head, el("div", "bz-people-mon-body", inner)]));
      });
      out.push(wrap);
    } else if (!out.length) {
      out.push(foldHint("交往纪事还没生成——画一次脸谱就会排出来。"));
    }
    const manual = (_f = p.manualEvents) != null ? _f : [];
    if (manual.length) {
      out.push(secTitle("随手记"), el("div", "bz-people-notes", manual.map((m) => noteRow(m, noteDelPending === m.id))));
    }
    return out;
  }
  function deleteTierOf(p, job) {
    const d = p.digest;
    if (personOf(d) || bondOf(d) || (d == null ? void 0 : d.chronicle)) return "drawn";
    return job && job.status !== "done" ? "unfinished" : "undrawn";
  }
  function profileFilled(prof) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    if (!prof) return false;
    return Boolean(
      ((_a = prof.tags) == null ? void 0 : _a.length) || ((_b = prof.birthday) == null ? void 0 : _b.trim()) || ((_c = prof.nickname) == null ? void 0 : _c.trim()) || ((_d = prof.metVia) == null ? void 0 : _d.trim()) || ((_e = prof.job) == null ? void 0 : _e.trim()) || ((_f = prof.personality) == null ? void 0 : _f.trim()) || ((_g = prof.likes) == null ? void 0 : _g.length) || ((_h = prof.interests) == null ? void 0 : _h.length) || ((_i = prof.hometown) == null ? void 0 : _i.trim()) || ((_j = prof.habits) == null ? void 0 : _j.trim()) || ((_k = prof.quote) == null ? void 0 : _k.trim()) || ((_l = prof.dislikes) == null ? void 0 : _l.length) || ((_m = prof.recentLife) == null ? void 0 : _m.trim()) || ((_n = prof.note) == null ? void 0 : _n.trim()) || ((_o = prof.metAt) == null ? void 0 : _o.trim()) || ((_p = prof.socials) == null ? void 0 : _p.length) || ((_q = prof.relationships) == null ? void 0 : _q.length) || ((_r = prof.importantDates) == null ? void 0 : _r.length)
    );
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
    const card = el("div", "bz-people-ins", [
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
    const labels = el("div", "bz-people-chart-labels");
    const step = monthly.length <= 8 ? 1 : Math.ceil(monthly.length / 6);
    monthly.forEach(([month], i) => {
      const show = i === 0 || i === monthly.length - 1 || i % step === 0;
      labels.appendChild(el("span", "", text(show ? month.slice(2) : "")));
    });
    return el("div", void 0, [chart, labels]);
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    const rows = [];
    const addRow = (label, value) => {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text(label)),
        el("span", "bz-people-prof-value", text(value))
      ]));
    };
    const listText = (arr) => (arr != null ? arr : []).filter(Boolean).join("、");
    if ((_a = prof == null ? void 0 : prof.socials) == null ? void 0 : _a.length) {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("社交账号")),
        el("span", "bz-people-prof-value", text(prof.socials.map((s) => [s.platform, s.handle].filter(Boolean).join(" ")).filter(Boolean).join(" · ")))
      ]));
    }
    if ((_b = prof == null ? void 0 : prof.birthday) == null ? void 0 : _b.trim()) addRow("生日", prof.birthday.trim());
    if ((_c = prof == null ? void 0 : prof.nickname) == null ? void 0 : _c.trim()) addRow("称呼", prof.nickname.trim());
    if ((_d = prof == null ? void 0 : prof.metVia) == null ? void 0 : _d.trim()) addRow("认识方式", prof.metVia.trim());
    if ((_e = prof == null ? void 0 : prof.metAt) == null ? void 0 : _e.trim()) addRow("认识时间", prof.metAt.trim());
    if ((_f = prof == null ? void 0 : prof.hometown) == null ? void 0 : _f.trim()) addRow("家乡 / 现居", prof.hometown.trim());
    if ((_g = prof == null ? void 0 : prof.job) == null ? void 0 : _g.trim()) addRow("职业", prof.job.trim());
    if ((_h = prof == null ? void 0 : prof.personality) == null ? void 0 : _h.trim()) addRow("性格", prof.personality.trim());
    if ((_i = prof == null ? void 0 : prof.interests) == null ? void 0 : _i.length) addRow("兴趣爱好", listText(prof.interests));
    if ((_j = prof == null ? void 0 : prof.habits) == null ? void 0 : _j.trim()) addRow("作息 / 习惯", prof.habits.trim());
    if ((_k = prof == null ? void 0 : prof.quote) == null ? void 0 : _k.trim()) addRow("口头禅", prof.quote.trim());
    if ((_l = prof == null ? void 0 : prof.likes) == null ? void 0 : _l.length) addRow("喜欢", listText(prof.likes));
    if ((_m = prof == null ? void 0 : prof.dislikes) == null ? void 0 : _m.length) addRow("反感 / 雷点", listText(prof.dislikes));
    if ((_n = prof == null ? void 0 : prof.recentLife) == null ? void 0 : _n.trim()) addRow("近况", prof.recentLife.trim());
    if ((_o = prof == null ? void 0 : prof.relationships) == null ? void 0 : _o.length) {
      addRow("身边人", prof.relationships.map((r) => r.who && r.relation ? `${r.who}（${r.relation}）` : r.who || r.relation).filter(Boolean).join("、"));
    }
    if ((_p = prof == null ? void 0 : prof.importantDates) == null ? void 0 : _p.length) {
      addRow("重要日子", prof.importantDates.map((d) => [d.date, d.what].filter(Boolean).join(" ")).filter(Boolean).join("、"));
    }
    if ((_q = prof == null ? void 0 : prof.tags) == null ? void 0 : _q.length) {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("标签")),
        el("span", "bz-people-prof-tags", prof.tags.filter(Boolean).map((t) => el("span", "bz-people-chip", text(t))))
      ]));
    }
    if ((_r = prof == null ? void 0 : prof.note) == null ? void 0 : _r.trim()) addRow("备注", prof.note.trim());
    rows.push(el("div", "bz-people-prof-actions", [
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "编辑档案", { "data-people-prof-edit": "" }),
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "AI 补充", { "data-people-prof-ai": "", title: "AI 读交往素材推断缺失字段，填进表单待你确认" })
    ]));
    return el("div", "bz-people-prof", rows);
  }
  function profInput(value, placeholder, attr, cls = "bz-people-input") {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = cls;
    inp.value = value;
    inp.placeholder = placeholder;
    inp.setAttribute(attr[0], attr[1]);
    return inp;
  }
  function socialRow(platform, handle) {
    return el("div", "bz-people-prof-subrow", [
      profInput(platform, "平台（微信 / 微博…）", ["data-people-prof-social-platform", ""]),
      profInput(handle, "账号", ["data-people-prof-social-handle", ""]),
      button("bz-people-ico bz-people-ico-sm", "×", { "data-people-prof-social-del": "", "aria-label": "删除这条社交账号" })
    ]);
  }
  function relationRow(who, relation) {
    return el("div", "bz-people-prof-subrow", [
      profInput(who, "称呼（如 老妈）", ["data-people-prof-rel-who", ""]),
      profInput(relation, "关系（如 母亲）", ["data-people-prof-rel-relation", ""]),
      button("bz-people-ico bz-people-ico-sm", "×", { "data-people-prof-rel-del": "", "aria-label": "删除这条身边人" })
    ]);
  }
  function dateRow(date, what) {
    return el("div", "bz-people-prof-subrow", [
      profInput(date, "日子（如 05-20 / 每年立冬）", ["data-people-prof-date-date", ""]),
      profInput(what, "是什么日子", ["data-people-prof-date-what", ""]),
      button("bz-people-ico bz-people-ico-sm", "×", { "data-people-prof-date-del": "", "aria-label": "删除这条重要日子" })
    ]);
  }
  function tagChip(t) {
    return el("span", "bz-people-tag-chip", [
      el("span", "bz-people-prof-tag-text", text(t)),
      button("bz-people-ico bz-people-ico-sm", "×", { "data-people-prof-tag-del": "", "aria-label": `删除标签 ${t}` })
    ]);
  }
  function profileEditor(prof) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const grid = (label, input) => el("div", "bz-people-prof-row", [el("span", "bz-people-prof-label", text(label)), input]);
    const listText = (arr) => (arr != null ? arr : []).join("、");
    const group = (label, hook, addLabel, addHook, rows) => {
      const list = el("div", "bz-people-prof-sub", { [hook]: "" }, rows);
      return el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text(label)),
        list,
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", addLabel, { [addHook]: "" })
      ]);
    };
    const socialRows = ((_a = prof == null ? void 0 : prof.socials) != null ? _a : []).map((s) => socialRow(s.platform, s.handle));
    const relRows = ((_b = prof == null ? void 0 : prof.relationships) != null ? _b : []).map((r) => relationRow(r.who, r.relation));
    const dateRows = ((_c = prof == null ? void 0 : prof.importantDates) != null ? _c : []).map((d) => dateRow(d.date, d.what));
    const tagList = el("div", "bz-people-tag-edit", { "data-people-prof-tag-list": "" }, ((_d = prof == null ? void 0 : prof.tags) != null ? _d : []).map((t) => tagChip(t)));
    const tagInput = profInput("", "加标签…", ["data-people-prof-tag-input", ""], "bz-people-input bz-people-tag-input");
    return el("div", "bz-people-prof bz-people-prof-edit", [
      group("社交账号", "data-people-prof-social-list", "+ 社交账号", "data-people-prof-add-social", socialRows),
      grid("生日", profInput((_e = prof == null ? void 0 : prof.birthday) != null ? _e : "", "YYYY-MM-DD 或 MM-DD", ["data-people-prof-field", "birthday"])),
      grid("称呼", profInput((_f = prof == null ? void 0 : prof.nickname) != null ? _f : "", "TA 喜欢被怎么称呼", ["data-people-prof-field", "nickname"])),
      grid("认识方式", profInput((_g = prof == null ? void 0 : prof.metVia) != null ? _g : "", "怎么认识的", ["data-people-prof-field", "metVia"])),
      grid("认识时间", profInput((_h = prof == null ? void 0 : prof.metAt) != null ? _h : "", "比如 2023 年夏天", ["data-people-prof-field", "metAt"])),
      grid("家乡 / 现居", profInput((_i = prof == null ? void 0 : prof.hometown) != null ? _i : "", "家乡 · 现居", ["data-people-prof-field", "hometown"])),
      grid("职业", profInput((_j = prof == null ? void 0 : prof.job) != null ? _j : "", "职业", ["data-people-prof-field", "job"])),
      grid("性格", profInput((_k = prof == null ? void 0 : prof.personality) != null ? _k : "", "性格特点，一段话", ["data-people-prof-field", "personality"])),
      grid("兴趣爱好", profInput(listText(prof == null ? void 0 : prof.interests), "顿号分隔，如 爬山、摇滚、推理小说", ["data-people-prof-field", "interests"])),
      grid("口头禅", profInput((_l = prof == null ? void 0 : prof.quote) != null ? _l : "", "口头禅 / 代表句", ["data-people-prof-field", "quote"])),
      grid("喜欢", profInput(listText(prof == null ? void 0 : prof.likes), "顿号分隔：话题 / 送礼参考", ["data-people-prof-field", "likes"])),
      grid("反感 / 雷点", profInput(listText(prof == null ? void 0 : prof.dislikes), "顿号分隔：反感的事 / 雷点", ["data-people-prof-field", "dislikes"])),
      grid("作息 / 习惯", profInput((_m = prof == null ? void 0 : prof.habits) != null ? _m : "", "作息 / 生活习惯", ["data-people-prof-field", "habits"])),
      grid("近况", profInput((_n = prof == null ? void 0 : prof.recentLife) != null ? _n : "", "最近在忙什么 / 状态", ["data-people-prof-field", "recentLife"])),
      group("身边人", "data-people-prof-rel-list", "+ 身边人", "data-people-prof-add-rel", relRows),
      group("重要日子", "data-people-prof-date-list", "+ 重要日子", "data-people-prof-add-date", dateRows),
      el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("标签")),
        tagList,
        tagInput,
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "+ 标签", { "data-people-prof-tag-add": "" })
      ]),
      grid("备注", profInput((_o = prof == null ? void 0 : prof.note) != null ? _o : "", "一句话备注", ["data-people-prof-field", "note"])),
      el("div", "bz-people-prof-actions", [
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "AI 补充", { "data-people-prof-ai": "", title: "AI 只填空白字段，填完你可检查再保存" }),
        button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "保存档案", { "data-people-prof-save": "" }),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "取消", { "data-people-prof-cancel": "" })
      ])
    ]);
  }
  function profilePopBody(p, editing, leaveConfirm = false) {
    const out = [];
    if (editing && leaveConfirm) out.push(profLeaveAsk());
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
  function subPage(opts, body) {
    var _a;
    const cls = ["bz-people-page", "bz-people-dpage", "bz-people-sub", opts.side ? `bz-people-sit-${opts.side === "left" ? "l" : "r"}` : ""].filter(Boolean).join(" ");
    const page = el("div", cls, { "data-people-sub": opts.hook });
    const head = el("div", "bz-people-page-head");
    head.appendChild(el("span", "bz-people-head-label", text(opts.title)));
    if (opts.meta) head.appendChild(el("span", "bz-people-head-note", text(opts.meta)));
    const right = el("span", "bz-people-head-right");
    for (const n of (_a = opts.head) != null ? _a : []) right.appendChild(n);
    right.appendChild(button("bz-people-close", "合上这页", { "data-people-close": "" }));
    head.appendChild(right);
    page.appendChild(head);
    page.appendChild(el("div", "bz-people-pagebody", { "data-people-scroll": "pop" }, body));
    if (opts.foot) page.appendChild(opts.foot);
    return page;
  }
  function dsPage(s) {
    const body = [];
    body.push(el("div", "bz-people-ds-path", text(`${s.dataDir}${s.scannedAt ? ` · 扫描于 ${s.scannedAt}` : ""}`)));
    if (s.notice) body.push(el("div", "bz-people-notice bz-people-ds-notice", { "data-people-ds-notice": "" }, text(s.notice)));
    if (s.sync) body.push(dsSyncLineNode(s.sync));
    if (!s.rows) {
      body.push(el("div", "bz-people-empty-hint", text(s.desktopOnly ? "数据源导入仅桌面端支持（要读库外文件夹）——手机 / 平板上仍可查看已画好的脸谱。" : s.scanning ? "正在扫描联系人目录…" : !s.dataDir ? "还没扫描。到「设置 → 脸谱 → 数据源」粘贴数据根目录路径，再点右上「同步」。" : "还没扫描。点右上「同步」从微信取数，或等同步完成后自动刷新。")));
    } else {
      const fbox = el("div", "bz-people-findbox");
      fbox.appendChild(el("i", "bz-ic", { "data-lucide": "search", "aria-hidden": "true" }));
      const finp = document.createElement("input");
      finp.className = "bz-people-input";
      finp.value = s.filter;
      finp.setAttribute("data-people-ds-filter", "");
      finp.setAttribute("placeholder", "按名字过滤联系人…");
      fbox.appendChild(finp);
      if (s.filter.trim()) fbox.appendChild(iconButton("x", "bz-people-ico bz-people-ico-sm", { "data-people-ds-filter-clear": "", "aria-label": "清空过滤" }));
      body.push(fbox);
      if (!s.rows.length) {
        body.push(el("div", "bz-people-empty-hint", text(`没匹配「${s.filter.trim()}」的联系人——清掉过滤字再看全名单。`)));
      } else {
        const list = el("div", "bz-people-ds-list", { "data-people-ds-list": "" });
        for (const r of s.rows) list.appendChild(dsRow(r, s.selected.includes(r.name)));
        body.push(list);
        const legend = el("div", "bz-people-ds-legend");
        legend.append(
          el("span", "", [el("i", "bz-people-ds-dot-ok"), text("有更新")]),
          el("span", "", [el("i", "bz-people-ds-dot-idle"), text("已导无更新")]),
          el("span", "", [el("i", "bz-people-ds-dot-none"), text("未导入")])
        );
        if (s.rows.some((r) => {
          var _a;
          return ((_a = r.newCount) != null ? _a : 0) > 0;
        })) {
          legend.appendChild(button("bz-people-ds-pickfresh", "勾有更新的", { "data-people-ds-pickfresh": "" }));
        }
        body.push(legend);
      }
    }
    const foot = el("div", "bz-people-pop-foot");
    foot.appendChild(el("span", "bz-people-ds-count", { "data-people-ds-count": "" }, text(footerLabel(s))));
    foot.appendChild(el("span", "bz-people-spacer"));
    const imp = button("bz-people-btn bz-people-btn-acc", s.importing ? "导入中…" : "导入所选", { "data-people-ds-import": "" });
    if (s.importing || s.syncing) imp.setAttribute("disabled", "");
    foot.appendChild(imp);
    const head = [];
    head.push(s.syncing ? button("bz-people-btn bz-people-btn-sm", "停止", { "data-people-ds-sync-stop": "", title: "停止同步——已导出的部分保留，重跑可续传" }) : button("bz-people-btn bz-people-btn-sm", "同步", { "data-people-ds-sync": "", title: "从微信重新解密并导出，需要微信已登录" }));
    const meta = s.syncing ? "正在同步…" : s.scanning ? "正在扫描…" : s.rows ? s.filter.trim() ? `${s.rows.length} / 共 ${s.totalRows} 位` : `${s.rows.length} 位联系人${s.hiddenGroups ? ` · ${s.hiddenGroups} 个群聊未纳入` : ""}` : "";
    return subPage({ title: "数据源", meta, head, foot, hook: "ds" }, body);
  }
  function genPage(info) {
    const body = [];
    body.push(el("div", "bz-people-gen-line", text(`为 ${info.items.length} 位联系人生成脸谱`)));
    const rows = [];
    if (info.images > 0) rows.push(["图片描述", `待描述 ${info.images} 张 · 已描述过的自动跳过 · 至多 ${info.describeCalls} 次调用（每批 ${info.batchSize} 张）`]);
    if (info.voices > 0) rows.push(["语音转写", `待转写 ${info.voices} 条 · 本地离线不花钱，已转写的自动跳过`]);
    rows.push(["画像生成", `${info.provider} / ${info.model} · 约 ${info.portraitCalls} 次调用`]);
    body.push(el("div", "bz-people-gen-rows", rows.map(([k, v]) => el("div", "bz-people-gen-row", [el("span", "bz-people-gen-k", text(k)), el("span", "bz-people-gen-v", text(v))]))));
    const list = el("ul", "bz-people-gen-list");
    for (const it of info.items) {
      const bits = [it.mode === "newer" ? `新增素材 ${it.materials} 条` : `素材 ${it.materials} 条`];
      if (it.mode === "older") bits.push("补录 · 与已有画像合并重画");
      else if (it.mode === "newer") bits.push("增量提炼");
      list.appendChild(el("li", "bz-people-gen-item", text(`「${it.name}」 · ${bits.join(" · ")}`)));
    }
    body.push(list);
    body.push(el("div", "bz-people-pop-note", text("确认后自动完成全部步骤——媒体预处理、图片描述、语音转写、素材采集与画像，中途不再询问；每批原子落盘、可随时暂停。")));
    const actions = el("div", "bz-people-prof-actions", [
      button("bz-people-btn", "取消", { "data-people-gen-cancel": "" }),
      button("bz-people-btn bz-people-btn-acc", "开始生成", { "data-people-gen-start": "" })
    ]);
    body.push(actions);
    return subPage({ title: "开始生成脸谱", hook: "gen" }, body);
  }
  function statsPage(p, body) {
    return subPage({ title: "互动统计", meta: p.name, hook: "stats" }, body);
  }
  function profPage(p, body, editing) {
    return subPage({ title: "补充背景", meta: editing ? `${p.name} · 编辑中` : p.name, hook: "prof" }, body);
  }
  function profLeaveAsk() {
    return el("div", "bz-people-prof-leaveask", [
      el("span", "bz-people-prof-leaveask-tx", text("改动还没保存——放弃？")),
      el("span", "bz-people-prof-leaveask-acts", [
        button("bz-people-btn bz-people-btn-sm bz-people-btn-danger", "放弃", { "data-people-prof-leave-ok": "" }),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "继续编辑", { "data-people-prof-leave-cancel": "" })
      ])
    ]);
  }
  var SUPP_TABS = [
    ["text", "记一笔", "随手记一件事"],
    ["image", "留影", "补画谱素材图"],
    ["rec", "原声", "通话 / 见面录音"]
  ];
  var SUPP_REC_LABEL = {
    pending: "待处理",
    queued: "排队中",
    running: "转写中",
    interrupted: "已中断",
    failed: "失败",
    "awaiting-merge": "待并仓",
    merged: "已并入"
  };
  var SUPP_REC_STAGES = [
    { key: "load", label: "启动模型" },
    { key: "vad", label: "VAD 切窗" },
    { key: "voiceprint", label: "声纹分离" },
    { key: "transcribe", label: "逐轮转写" }
  ];
  function suppRecStageLabel(key) {
    var _a, _b;
    return (_b = (_a = SUPP_REC_STAGES.find((s) => s.key === key)) == null ? void 0 : _a.label) != null ? _b : key;
  }
  function recStageChain(cur) {
    const chain = el("div", "bz-people-supp-stagechain", { "data-rec-chain": "" });
    SUPP_REC_STAGES.forEach((s, i) => {
      if (i) chain.appendChild(el("span", "bz-people-supp-stage-sep", text("→")));
      chain.appendChild(el("span", "bz-people-supp-stage", { "data-stage-key": s.key }, text(s.label)));
    });
    applyRecStageChain(chain, cur);
    return chain;
  }
  function applyRecStageChain(chain, cur) {
    const curIdx = SUPP_REC_STAGES.findIndex((s) => s.key === cur);
    chain.querySelectorAll("[data-stage-key]").forEach((sEl) => {
      const i = SUPP_REC_STAGES.findIndex((s) => s.key === sEl.getAttribute("data-stage-key"));
      if (i < 0) return;
      sEl.className = i === curIdx ? "bz-people-supp-stage on" : i < curIdx ? "bz-people-supp-stage done" : "bz-people-supp-stage";
    });
  }
  function suppPage(p, tab, image, rec, today, noteDelPending = null) {
    var _a;
    const body = [];
    body.push(el("div", "bz-people-ftabs bz-people-supp-tabs", SUPP_TABS.map(([id, label, hint]) => button(`bz-people-ftab${tab === id ? " on" : ""}`, label, { "data-people-supp-tab": id, title: hint }))));
    if (tab === "text") {
      body.push(noteAddRow(today));
      const notes = [...(_a = p.manualEvents) != null ? _a : []].sort((a, b) => b.ts.localeCompare(a.ts));
      body.push(el("div", "bz-people-supp-stat", text(
        notes.length ? `已记 ${notes.length} 笔` : "还没记过——上面写一条，就落在这一列。"
      )));
      if (notes.length) {
        body.push(el("div", "bz-people-notes bz-people-supp-notes", notes.map((m) => noteRow(m, noteDelPending === m.id))));
      }
    } else if (tab === "image") {
      body.push(...suppImageBody(image));
    } else {
      body.push(...suppRecBody(rec));
    }
    return subPage({ title: "补充素材", meta: p.name, hook: "note" }, body);
  }
  function suppImageBody(s) {
    const out = [];
    out.push(el("div", "bz-people-supp-acts", [
      button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "选图片…", { "data-people-supp-img-pick": "" })
    ]));
    if (s.queue.length) {
      const list = el("div", "bz-people-supp-qlist");
      s.queue.forEach((it, i) => {
        const row = el("div", "bz-people-supp-qrow");
        row.appendChild(el("span", "bz-people-supp-qname", { title: it.path }, text(it.name)));
        const ts = document.createElement("input");
        ts.type = "datetime-local";
        ts.className = "bz-people-input bz-people-supp-qts";
        ts.value = suppLocalTsValue(it.ts);
        ts.setAttribute("data-people-supp-img-ts", String(i));
        row.appendChild(ts);
        row.appendChild(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", it.peer ? "对方发的" : "我发的", {
          "data-people-supp-img-peer": String(i),
          title: "点一下换归属（默认对方发的）"
        }));
        row.appendChild(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "×", { "data-people-supp-img-drop": String(i), "aria-label": "移除" }));
        list.appendChild(row);
      });
      out.push(list);
      out.push(el("div", "bz-people-supp-acts", [
        button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", `落盘并导入 ${s.queue.length} 张`, { "data-people-supp-img-import": "" })
      ]));
    }
    const unusable = s.broken + s.missing;
    const unusableNote = unusable > 0 ? ` · ${[s.broken > 0 ? `源图损坏 ${s.broken} 张` : "", s.missing > 0 ? `源图缺失 ${s.missing} 张` : ""].filter(Boolean).join("、")}（无法描述）` : "";
    out.push(el("div", "bz-people-supp-stat", text(
      s.imported > 0 ? `已入库图片 ${s.imported} 张${s.undescribed > 0 ? ` · 未描述 ${s.undescribed} 张` : " · 全部有描述"}${unusableNote}` : "还没补过图片。"
    )));
    if (s.imported > 0 && s.undescribed > 0) {
      out.push(el("div", "bz-people-supp-acts", [
        button("bz-people-btn bz-people-btn-sm", s.describeBusy ? "描述进行中…" : `生成描述（${s.modelLabel}）`, {
          "data-people-supp-img-desc": "",
          ...s.describeBusy ? { disabled: "" } : {},
          title: "用 AI 面板当前模型给未描述的图片写画面描述，按张计费"
        })
      ]));
    }
    if (s.items.length) {
      const grid = el("div", "bz-people-supp-imggrid");
      for (const it of s.items) grid.appendChild(suppImgCell(s.imgDel, it));
      if (s.hidden > 0) grid.appendChild(suppImgMore(s.hidden));
      out.push(grid);
    }
    return out;
  }
  function suppImgCell(imgDel, it) {
    var _a, _b;
    const cap = it.text.replace(/^\[图片\]\s*/, "");
    const box = el("div", "bz-people-supp-imgbox");
    box.appendChild(el("img", "bz-people-supp-imgthumb", {
      src: it.url,
      alt: cap,
      loading: "lazy",
      "data-people-supp-img-view": it.img,
      title: "点开看大图"
    }));
    box.appendChild(button("bz-people-supp-imgdel", "×", {
      "data-people-supp-img-del": it.img,
      "aria-label": "删掉这张",
      title: "从时间线里删掉这张（原件留在数据根，不会动）"
    }));
    if (it.skip) box.appendChild(el("div", "bz-people-supp-imgsens", text((_a = it.label) != null ? _a : "敏感")));
    if (imgDel === it.img) {
      box.appendChild(el("div", "bz-people-supp-imgask", [
        el("div", "bz-people-supp-imgask-tx", text("删掉这张？")),
        el("div", "bz-people-supp-imgask-acts", [
          button("bz-people-supp-imgask-yes", "删掉", { "data-people-supp-img-del-ok": it.img }),
          button("bz-people-supp-imgask-no", "取消", { "data-people-supp-img-del-cancel": "" })
        ])
      ]));
    }
    const cell = el("div", "bz-people-supp-imgcell", [box]);
    if (it.skip === "sensitive") {
      cell.appendChild(button("bz-people-supp-imgcap bz-people-supp-imgcap-sens", "敏感 · 解除", {
        "data-people-supp-img-unsens": it.img,
        title: "这张被判为敏感内容、已跳过描述——点一下解除标注并重试"
      }));
    } else if (it.skip) {
      cell.appendChild(el("div", "bz-people-supp-imgcap bz-people-supp-imgcap-none", {
        title: `${it.skip === "broken" ? "源图打不开（文件本身损坏）" : "源图没导出（数据根里只有微信缩略图）"}，无法生成描述——重新导出媒体后会自动重试`
      }, text((_b = it.label) != null ? _b : "无法描述")));
    } else {
      cell.appendChild(el(
        "div",
        `bz-people-supp-imgcap${cap ? "" : " bz-people-supp-imgcap-none"}`,
        { title: cap || "未描述" },
        text(cap || "未描述")
      ));
    }
    return cell;
  }
  function suppImgMore(hidden) {
    return el(
      "button",
      "bz-people-supp-imgmore",
      { "data-people-supp-img-more": "", type: "button" },
      text(`还有 ${hidden} 张 · 继续看`)
    );
  }
  function appendSuppImageGridPage(grid, page, hidden, imgDel) {
    for (const it of page) grid.appendChild(suppImgCell(imgDel, it));
    const fresh = hidden > 0 ? suppImgMore(hidden) : null;
    const old = grid.querySelector("[data-people-supp-img-more]");
    if (fresh) {
      if (old) old.replaceWith(fresh);
      else grid.appendChild(fresh);
    } else {
      old == null ? void 0 : old.remove();
    }
    return fresh;
  }
  function suppRecBody(s) {
    var _a, _b;
    const out = [];
    const refLine = el("div", "bz-people-supp-ref");
    refLine.append(
      text("声纹参考："),
      textEl("b", s.ref === "building" ? "构建中…" : s.ref === "ready" ? "已建" : "未建")
    );
    if (s.ref !== "building" && !s.refConfirm) {
      refLine.appendChild(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", s.ref === "ready" ? "重建质心" : "建质心", {
        "data-people-supp-rec-ref": "",
        title: "从该联系人的微信语音按归属建声纹参考（本地跑，几分钟）"
      }));
    }
    out.push(refLine);
    if (s.ref === "ready" && s.refConfirm) {
      out.push(el("div", "bz-people-supp-reffirm", [
        el("div", "bz-people-supp-reffirm-tx", text("重建会覆盖现在的声纹质心——确认重建？")),
        el("div", "bz-people-supp-reffirm-acts", [
          button("bz-people-btn bz-people-btn-sm bz-people-btn-danger", "确认重建", { "data-people-supp-rec-ref-ok": "" }),
          button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "取消", { "data-people-supp-rec-ref-cancel": "" })
        ])
      ]));
    }
    out.push(el("div", "bz-people-supp-acts", [
      button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "添加录音…", { "data-people-supp-rec-add": "" })
    ]));
    if (s.queue.length) out.push(...suppRecQueueBody(s.queue));
    const dups = (_a = s.dupGroups) != null ? _a : [];
    if (dups.length) {
      const warn = el("div", "bz-people-supp-dups");
      warn.appendChild(el("div", "bz-people-supp-dupshead", text(
        `库里有 ${dups.length} 组疑似重复（内容一样、名字不同）——没有自动删，你看过再定：`
      )));
      for (const g of dups) {
        warn.appendChild(el("div", "bz-people-supp-duprow", { title: "这些文件字节完全相同" }, text(g.join("  ＝  "))));
      }
      out.push(warn);
    }
    if (!s.rows.length) {
      out.push(el("div", "bz-people-empty-hint", text("还没有录音。AAC / M4A / MP3 都行——时间默认取文件名或文件属性，说话人分离与转写交给本地管线。")));
      return out;
    }
    const list = el("div", "bz-people-supp-list");
    for (const r of s.rows) {
      list.appendChild(suppRecRow(r, ((_b = s.del) == null ? void 0 : _b.file) === r.file ? s.del : void 0, s.startEdit === r.file, s.turnsView));
    }
    out.push(list);
    return out;
  }
  function recDelConfirm(r, del) {
    const box = el("div", "bz-people-supp-delbox");
    const inLedger = r.status === "merged" || r.status === "awaiting-merge";
    box.appendChild(el("div", "bz-people-del-line", text(
      inLedger ? `删除会把这条录音的转写轮次从聊天仓一并清掉${del.drawn ? "；脸谱正文不会跟着变，要反映得重新画谱（花钱）" : ""}。` : `这条还没进聊天仓——删除只清账本与派生档${del.drawn ? "；脸谱正文不会跟着变" : ""}。`
    )));
    const label = document.createElement("label");
    label.className = "bz-people-supp-delchk";
    const ck = document.createElement("input");
    ck.type = "checkbox";
    ck.checked = del.alsoFile;
    ck.setAttribute("data-people-supp-rec-del-file", r.file);
    label.appendChild(ck);
    label.appendChild(text(" 同时删除录音原件（不勾只清账本，之后可重跑）"));
    box.appendChild(label);
    box.appendChild(el("div", "bz-people-supp-rowfoot", [
      button("bz-people-btn bz-people-btn-sm bz-people-btn-danger", "确认删除", { "data-people-supp-rec-del-ok": r.file }),
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "取消", { "data-people-supp-rec-del-cancel": r.file })
    ]));
    return box;
  }
  function suppRecQueueBody(queue) {
    const out = [];
    const list = el("div", "bz-people-supp-qlist");
    queue.forEach((it, i) => {
      const row = el("div", `bz-people-supp-qrow${it.startMs === null ? " need-ts" : ""}${it.suspect && !it.keep ? " suspect" : ""}`);
      row.appendChild(el("span", "bz-people-supp-qname", { title: it.path }, text(it.name)));
      if (it.dupOf) row.appendChild(el("span", "bz-people-supp-qwarn", { title: `与库里「${it.dupOf}」内容相同` }, text("重复")));
      if (it.checking) row.appendChild(el("span", "bz-people-supp-qwarn", text("抽检中…")));
      else if (it.suspect) {
        row.appendChild(el("span", "bz-people-supp-qwarn bz-people-supp-qwarn-hard", {
          title: `抽检听不出「我」或该联系人的声音（可能选错了录音）——默认跳过，确认要导就点右钮`
        }, text(it.keep ? "存疑·已允许" : "听着不像你们俩")));
        row.appendChild(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", it.keep ? "仍然导入：已允许" : "仍然导入", {
          "data-people-supp-rec-keep": String(i)
        }));
      }
      if (it.candidates.length > 1) {
        const sel = document.createElement("select");
        sel.className = "bz-people-input bz-people-supp-qcand";
        sel.setAttribute("data-people-supp-rec-cand", String(i));
        sel.setAttribute("data-people-supp-rec-path", it.path);
        sel.setAttribute("title", "文件名只给了「周X / N点N分」这类相对信息——选一个候选日期");
        it.candidates.forEach((c) => {
          const o = document.createElement("option");
          o.value = String(c);
          o.textContent = suppLocalTsValue(c).replace("T", " ");
          if (c === it.startMs) o.selected = true;
          sel.appendChild(o);
        });
        row.appendChild(sel);
      }
      const ts = document.createElement("input");
      ts.type = "datetime-local";
      ts.className = "bz-people-input bz-people-supp-qts";
      ts.value = it.startMs === null ? "" : suppLocalTsValue(it.startMs);
      ts.setAttribute("data-people-supp-rec-ts", String(i));
      ts.setAttribute("data-people-supp-rec-path", it.path);
      if (it.startMs === null) ts.setAttribute("placeholder", "必填：这条录音的起点");
      row.appendChild(ts);
      row.appendChild(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "×", { "data-people-supp-rec-drop": String(i), "aria-label": "移除" }));
      list.appendChild(row);
    });
    out.push(list);
    const miss = queue.filter((q) => q.startMs === null).length;
    const suspect = queue.filter((q) => q.suspect && !q.keep).length;
    out.push(el("div", "bz-people-supp-acts", [
      button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", `落盘并导入 ${queue.length - suspect} 条`, { "data-people-supp-rec-import": "" })
    ]));
    out.push(el("div", "bz-people-pop-note", text(
      miss > 0 ? `有 ${miss} 条还没确认起点（标红处）——录音起点决定整条转写的绝对时间，填完再落盘。` : suspect > 0 ? `有 ${suspect} 条抽检听不出你或该联系人的声音（可能选错了录音）——默认不导入；确认没错就点「仍然导入」。` : "起点 = 这条录音开始录的时刻（不是复制进来的时刻）；转写轮次的绝对时间靠它推。之后也能在行上改。"
    )));
    return out;
  }
  function recTurnsPreview(lines, meAvatar, otherAvatar) {
    const box = el("div", "bz-people-supp-turns");
    if (!lines.length) {
      box.appendChild(el("div", "bz-people-pop-note", text("账本里还没有轮次——转写跑完才会有。")));
      return box;
    }
    const sideN = lines.filter((l) => l.side).length;
    const segN = lines.reduce((m, l) => {
      var _a;
      return Math.max(m, (_a = l.segHead) != null ? _a : 0);
    }, 0);
    box.appendChild(el("div", "bz-people-supp-turnhead", text(
      `逐轮时间轴 · ${lines.length} 轮 · 并成 ${segN} 段${sideN ? ` · 旁音 ${sideN}（不进聊天仓）` : ""}`
    )));
    const list = el("div", "bz-people-supp-turnlist");
    for (const l of lines) {
      const me = l.speaker === "我";
      const line = el("div", `bz-people-supp-turn${l.side ? " side" : ""}${me ? " me" : ""}`);
      const ava = el("div", "bz-people-supp-turnava");
      ava.appendChild(avatarNode(l.speaker, me ? meAvatar : l.side ? "" : otherAvatar));
      line.appendChild(ava);
      line.appendChild(el("div", "bz-people-supp-turnbubble", text(l.text || "（空转写）")));
      list.appendChild(line);
    }
    box.appendChild(list);
    return box;
  }
  function suppRecRow(r, del, startEdit = false, turnsView) {
    var _a;
    const row = el("div", "bz-people-supp-row", { "data-people-supp-row": r.file });
    const head = el("div", "bz-people-supp-rowhead");
    head.appendChild(el("span", "bz-people-supp-qname", { title: r.file }, text(r.file)));
    head.appendChild(el("span", `bz-people-supp-badge bz-people-supp-badge-${r.status}`, text(SUPP_REC_LABEL[r.status])));
    row.appendChild(head);
    if (del) {
      row.appendChild(recDelConfirm(r, del));
      return row;
    }
    if ((turnsView == null ? void 0 : turnsView.file) === r.file) {
      row.appendChild(recTurnsPreview(turnsView.lines, turnsView.meAvatar, turnsView.otherAvatar));
      row.appendChild(el("div", "bz-people-supp-rowfoot", [
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "收起", { "data-people-supp-rec-turns-close": r.file })
      ]));
      return row;
    }
    if (r.status === "running" || r.status === "interrupted" || r.status === "awaiting-merge") {
      const meter = el("div", "bz-people-jobs-meter");
      if (r.pct !== null) {
        meter.appendChild(el("div", "bz-people-jobs-track", { "aria-hidden": "true" }, el("div", "bz-people-jobs-fill", { style: `width:${r.pct}%` })));
        meter.appendChild(el("span", "bz-people-jobs-pct", text(`${r.pct}%`)));
      }
      row.appendChild(meter);
    }
    if (r.status === "running" && r.stage) row.appendChild(recStageChain(r.stage));
    if (r.status === "running") {
      const meta = el("div", "bz-people-supp-rowmeta");
      meta.appendChild(el("span", void 0, { "data-rec-ptext": "" }, text(r.phaseText)));
      if (r.mode === "me-only") meta.appendChild(text(" · 单质心：非我即对方"));
      if (r.mode === "blind") meta.appendChild(text(" · 无质心：盲分"));
      if (r.turns !== void 0) meta.appendChild(text(` · ${r.turns} 轮`));
      if (r.elapsed) {
        meta.appendChild(text(" · "));
        meta.appendChild(el("span", void 0, { "data-rec-elapsed": "" }, text(`已 ${r.elapsed}`)));
      }
      row.appendChild(meta);
      const stop = button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "停止", { "data-people-supp-rec-stop": r.file });
      row.appendChild(el("div", "bz-people-supp-rowfoot", [stop]));
      return row;
    }
    if (r.status === "queued") {
      row.appendChild(el("div", "bz-people-supp-rowmeta", text(`排队中 · 第 ${(_a = r.queuePos) != null ? _a : 1} 位`)));
      const out = button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "移出队列", { "data-people-supp-rec-dequeue": r.file });
      row.appendChild(el("div", "bz-people-supp-rowfoot", [out]));
      return row;
    }
    const bits = [];
    if (r.phaseText) bits.push(r.phaseText);
    if (r.mode === "me-only") bits.push("单质心：非我即对方");
    if (r.mode === "blind") bits.push("无质心：盲分");
    if (r.turns !== void 0) bits.push(`${r.turns} 轮`);
    if (r.sideSpeaks) bits.push(`已滤 ${r.sideSpeaks} 轮旁音`);
    if (bits.length) row.appendChild(el("div", "bz-people-supp-rowmeta", text(bits.join(" · "))));
    if (startEdit) {
      const line = el("div", "bz-people-supp-startrow");
      line.appendChild(el("span", void 0, text("起点")));
      const inp = document.createElement("input");
      inp.type = "datetime-local";
      inp.className = "bz-people-input bz-people-supp-qts";
      inp.value = r.startMs ? suppLocalTsValue(r.startMs) : "";
      inp.setAttribute("data-people-supp-rec-start", r.file);
      line.appendChild(inp);
      row.appendChild(line);
    } else if (r.startMs !== void 0) {
      row.appendChild(el("div", "bz-people-supp-rowmeta", text(`起点 ${suppLocalTsValue(r.startMs).replace("T", " ")}`)));
    }
    const foot = [];
    if (r.status === "failed" && r.errText) foot.push(el("span", "bz-people-jobs-err", text(r.errText)));
    if (r.status === "pending") foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "处理", { "data-people-supp-rec-run": r.file }));
    if (r.status === "interrupted") foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "续跑", { "data-people-supp-rec-run": r.file }));
    if (r.status === "failed") foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "重试", { "data-people-supp-rec-run": r.file }));
    if (r.status === "awaiting-merge") foot.push(button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "并仓", { "data-people-supp-rec-merge": r.file, title: "转写完成但还没进时间线——点这里按轮次并仓" }));
    if (startEdit) foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "收起", { "data-people-supp-rec-start-cancel": r.file }));
    else foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "改起点", { "data-people-supp-rec-start-edit": r.file, title: "录音开始录的时刻——改完绝对时间跟着重排（已并仓的同步回写）" }));
    if (r.turns !== void 0) {
      foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "查看轮次", { "data-people-supp-rec-turns": r.file, title: "逐轮时间轴（含被滤的旁音轮）——复核我们没误杀" }));
    }
    foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "删除", { "data-people-supp-rec-del": r.file, title: "删掉这条录音（二次确认里可勾选是否连原件一起删）" }));
    if (foot.length) row.appendChild(el("div", "bz-people-supp-rowfoot", foot));
    return row;
  }
  function suppLocalTsValue(ts) {
    const d = new Date(ts);
    const p2 = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
  function recNote(rows) {
    var _a;
    const block = el("div", "bz-people-jobs", { "data-people-rec-note": "", role: "status" });
    const running = rows.filter((r) => r.status === "running").length;
    const waiting = rows.filter((r) => r.status === "queued").length;
    block.appendChild(el("div", "bz-people-jobs-who", text(`录音处理 · ${running} 条在跑${waiting ? ` · ${waiting} 条等待` : ""}`)));
    for (const r of rows) {
      if (r.status !== "running" && r.status !== "queued" && r.status !== "interrupted") continue;
      const line = el("div", "bz-people-jobs-main", text(r.file));
      const detail = r.status === "queued" ? `排队中 · 第 ${(_a = r.queuePos) != null ? _a : 1} 位` : r.phaseText;
      if (detail) line.appendChild(el("span", "bz-people-jobs-detail", text(` · ${detail}`)));
      block.appendChild(line);
    }
    if (waiting) {
      block.appendChild(el("div", "bz-people-jobs-foot", [
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "清空队列", { "data-people-rec-clear-queue": "" })
      ]));
    }
    return block;
  }
  function delPage(p, tier) {
    const body = [el("div", "bz-people-del-who", text(`「${p.name}」`))];
    body.push(el("div", "bz-people-del-line", text(tier === "drawn" ? "这个人已经有画成的脸谱——删除会连同脸谱正文、聊天仓、随手记与头像一起销毁，不可恢复。" : tier === "unfinished" ? "这个人的脸谱还没画完——删掉要从头再画，未完成的任务一并停掉。" : "这个人还没画过脸谱——删掉之后要重新导入才能再画。")));
    body.push(el("div", "bz-people-del-note", text(tier === "drawn" ? "要删除，请重输主密码确认。" : "数据源目录与聊天原文不动，之后可以重新导入。")));
    if (tier === "drawn") {
      const pw = document.createElement("input");
      pw.type = "password";
      pw.className = "bz-people-input bz-people-del-pw-input";
      pw.placeholder = "主密码";
      pw.autocomplete = "off";
      pw.setAttribute("data-people-del-pw", "");
      body.push(el("div", "bz-people-del-pw", [
        pw,
        // 错误行常驻 DOM（`data-people-del-err` 是 ui 侧写文案的锚），空串时靠 CSS 收起
        el("div", "bz-people-del-err", { "data-people-del-err": "" })
      ]));
    }
    const actions = el("div", "bz-people-del-actions", [
      button("bz-people-btn", "取消", { "data-people-del-cancel": "" }),
      button("bz-people-btn bz-people-btn-acc", "删除", { "data-people-del-ok": "" })
    ]);
    body.push(actions);
    return subPage({ title: "删除联系人", hook: "del", side: void 0 }, body);
  }
  function findPage(opts) {
    var _a, _b;
    const q = opts.q.trim();
    const body = [];
    const box = el("div", "bz-people-findbox");
    box.appendChild(el("i", "bz-ic", { "data-lucide": "search", "aria-hidden": "true" }));
    const inp = document.createElement("input");
    inp.className = "bz-people-input";
    inp.value = q;
    inp.setAttribute("data-people-find", "");
    inp.setAttribute("placeholder", "名字或标签，比如「摄影」「表妹」「阿澈」…");
    box.appendChild(inp);
    if (q) box.appendChild(iconButton("x", "bz-people-ico bz-people-ico-sm", { "data-people-find-clear": "", "aria-label": "清空" }));
    body.push(box);
    if (!q) {
      body.push(el("div", "bz-people-empty-hint", text(`共 ${opts.total} 位，输一个字就能把人捞出来，点一下就翻到 TA 那页。`)));
      if (opts.tags.length) body.push(el("div", "bz-people-find-tags", opts.tags.map((t) => button("bz-people-stk", t, { "data-people-find-tag": t }))));
    } else if (!opts.rows.length) {
      body.push(el("div", "bz-people-empty-hint", text(`没找到「${q}」这个人。换个字试试，或者去「数据源」看看是不是还没导进来。`)));
    } else {
      body.push(el("div", "bz-people-find-n", text(`找到 ${opts.rows.length} 位`)));
      const list = el("div", "bz-people-ds-list");
      for (const r of opts.rows) {
        const name = r.p.name || r.p.id;
        const tags = ((_b = (_a = r.p.profile) == null ? void 0 : _a.tags) != null ? _b : []).filter(Boolean).join(" · ");
        const state = r.state === "todo" ? "待画" : r.state === "drawing" ? "画谱中" : r.state === "legacy" ? "旧版" : "已画";
        const row = el("button", "bz-people-find-row", { "data-people-find-open": r.p.id });
        row.type = "button";
        row.append(
          el("span", "bz-people-find-ava", avatarNode(name, r.avatar)),
          el("span", "bz-people-find-main", [
            el("span", "bz-people-find-name", text(name)),
            el("span", "bz-people-find-meta", text(tags))
          ]),
          el("span", "bz-people-find-side", text(`第 ${r.page} 页 ${r.half} · ${state}`))
        );
        list.appendChild(row);
      }
      body.push(list);
    }
    return subPage({ title: "找一找", meta: q ? `「${q}」` : `共 ${opts.total} 位`, hook: "find" }, body);
  }
  function mergeBanner(msg, calm = false) {
    const box = el("div", `bz-people-banner${calm ? " bz-people-banner-calm" : ""}`);
    box.appendChild(el("i", "bz-ic", { "data-lucide": calm ? "database" : "layers", "aria-hidden": "true" }));
    box.appendChild(el("span", "bz-people-banner-tx", text(msg)));
    box.appendChild(button("bz-people-banner-x", "×", { "data-people-banner-close": "", "aria-label": "收起" }));
    return box;
  }
  function noteAddRow(today) {
    const date = document.createElement("input");
    date.type = "date";
    date.className = "bz-people-input bz-people-note-date";
    date.value = today;
    date.setAttribute("data-people-note-date", "");
    const txt = profInput("", "一句话记下这一天……", ["data-people-note-text", ""], "bz-people-input bz-people-note-text");
    return el("div", "bz-people-note-add", [
      date,
      txt,
      button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "记一笔", { "data-people-note-save": "" })
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
  function dsWaterOf(row) {
    if (row.isGroup) return null;
    if (row.exported && !row.imported) return { k: "exported", label: "已导出 · 待入库" };
    if (!row.imported) return { k: "full", label: `全新 · ${formatCount(row.rawCount)} 条` };
    if (row.newCount > 0) return { k: "newer", label: row.newApprox ? "增量 · 有新消息" : `增量 · ${formatCount(row.newCount)} 条` };
    return { k: "skip", label: "无新素材" };
  }
  function dsWatermark(row) {
    if (!row.imported) return "未导入";
    const drawn = row.processedTs ? `画到 ${formatDay(row.processedTs).slice(5)}` : "未画脸谱";
    return `已导 ${formatCount(row.rawCount)} 条 · ${drawn}`;
  }
  function dsRow(row, on) {
    var _a;
    const fresh = row.newCount > 0 && row.imported;
    const water = dsWaterOf(row);
    const cls = `bz-people-ds-row${on ? " bz-people-ds-on" : ""}${fresh ? " bz-people-ds-fresh" : ""}${row.isGroup ? " bz-people-ds-off" : ""}${(water == null ? void 0 : water.k) === "skip" ? " bz-people-ds-skip" : ""}`;
    const box = el(
      "span",
      "bz-people-ds-box",
      { "data-people-ds-check": row.name, role: "checkbox", tabindex: "0", "aria-checked": on ? "true" : "false" },
      on ? el("i", "bz-ic", { "data-lucide": "check", "aria-hidden": "true" }) : text("")
    );
    const name = row.displayName + (row.isGroup ? "（群）" : "");
    return el("label", cls, [
      box,
      row.isGroup ? text("") : el("span", "bz-people-ds-ava", avatarNode(row.displayName || row.name, (_a = row.avatar) != null ? _a : "")),
      el("span", "bz-people-ds-main", [
        el("span", "bz-people-ds-name", text(name)),
        el("span", "bz-people-ds-meta", text([`${formatCount(row.rawCount)} 条`, row.media].filter(Boolean).join(" · ")))
      ]),
      el("span", "bz-people-ds-side", [
        water ? el("span", `bz-people-ds-water bz-people-ds-w-${water.k}`, text(water.label)) : text(""),
        el("span", "bz-people-ds-mark", text(row.isGroup ? "未纳入" : dsWatermark(row)))
      ])
    ]);
  }
  function footerLabel(s) {
    var _a, _b;
    const picked = ((_b = (_a = s.allRows) != null ? _a : s.rows) != null ? _b : []).filter((r) => s.selected.includes(r.name) && !r.isGroup);
    if (!picked.length) return "未勾选联系人";
    const n = { full: 0, newer: 0, skip: 0, exported: 0 };
    let msgs = 0;
    for (const r of picked) {
      const w = dsWaterOf(r);
      if (!w) continue;
      if (w.k === "full") {
        n.full++;
        msgs += r.rawCount;
      } else if (w.k === "exported") {
        n.exported++;
        msgs += r.rawCount;
      } else if (w.k === "newer") {
        n.newer++;
        msgs += r.newCount;
      } else if (w.k === "skip") n.skip++;
    }
    if (picked.length && n.skip === picked.length) return "所选暂无新素材（已导过的会被跳过）";
    const bits = [
      n.full ? `全新 ${n.full} 位` : "",
      n.newer ? `增量 ${n.newer} 位` : "",
      n.exported ? `待入库 ${n.exported} 位` : "",
      n.skip ? `跳过 ${n.skip} 位` : ""
    ].filter(Boolean);
    return `已选 ${picked.length} 位 · 将并入 ${formatCount(msgs)} 条${bits.length ? `（${bits.join(" · ")}）` : ""}`;
  }
  function dsSyncLineNode(line) {
    const box = el("div", `bz-people-syncline${line.status === "error" ? " bz-people-syncline-err" : ""}`, { "data-people-ds-sync-line": line.status });
    const main = line.pct === null ? line.text : `${line.text} ${line.pct}%`;
    box.appendChild(el("div", "bz-people-sync-text", { "data-people-ds-sync-text": "" }, text(main)));
    if (line.status === "running") {
      const track = el("div", "bz-people-sync-track");
      track.appendChild(line.pct === null ? el("div", "bz-people-sync-indet") : el("div", "bz-people-sync-bar", { style: `width:${line.pct}%` }));
      box.appendChild(track);
    }
    const contact = el("div", "bz-people-sync-contact", { "data-people-ds-sync-contact": "" }, text(line.contact));
    if (!line.contact) contact.hidden = true;
    box.appendChild(contact);
    for (const f of line.failures) box.appendChild(el("div", "bz-people-sync-fail", { "data-people-ds-sync-fail": "" }, text(f)));
    const sub = el("div", "bz-people-sync-sub", { "data-people-ds-sync-sub": "" }, text(line.sub));
    if (!line.sub) sub.hidden = true;
    box.appendChild(sub);
    if (line.hint) box.appendChild(el("div", "bz-people-sync-sub", text(line.hint)));
    return box;
  }
  function importMeta(rec, textMsgs) {
    return `${rec.timeFrom.slice(0, 7)} ~ ${rec.timeTo.slice(0, 7)} · 共 ${formatCount(textMsgs)} 条文本（形态占比含图片/语音等全部消息形态）`;
  }
  return __toCommonJS(render_exports);
})();
