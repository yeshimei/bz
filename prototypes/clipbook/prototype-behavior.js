/* 源指纹 aa3dcff3aeda4941 · 仓内输入 73 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/clipbook/fake-sim.ts","prototypes/clipbook/fake/fake-obsidian.ts","src/auto-summary/index.ts","src/auto-summary/parser.ts","src/auto-summary/processor.ts","src/clipbook/constants.ts","src/clipbook/data.ts","src/clipbook/flow.ts","src/clipbook/index.ts","src/clipbook/loader.ts","src/clipbook/md.ts","src/clipbook/news-data.ts","src/clipbook/news-source-settings.ts","src/clipbook/news-sources-group.ts","src/clipbook/render.ts","src/clipbook/save.ts","src/clipbook/scan.ts","src/clipbook/state.ts","src/clipbook/store.ts","src/clipbook/ui.ts","src/clipbook/write-queue.ts","src/core/ai.ts","src/core/app.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/flow-dialog.ts","src/core/item-actions.ts","src/core/mobile.ts","src/core/notice.ts","src/core/obsidian-adapter.ts","src/core/path-classify.ts","src/core/path-picker.ts","src/core/settings-common.ts","src/core/settings-modal.ts","src/core/settings-provider.ts","src/core/settings-schema.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts","src/knowledge/data.ts","src/knowledge/index.ts","src/knowledge/note-gen.ts","src/knowledge/processor.ts","src/knowledge/source.ts","src/knowledge/ui.ts","src/knowledge/video-meta.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/clipbook/fake-sim.ts → window.BZW_clipbook（行为单源预览包，issue 245/ADR-0106） */
var BZW_clipbook = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
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
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // prototypes/clipbook/fake/fake-obsidian.ts
  function setIcon(container, iconId) {
    var _a;
    const d = typeof window !== "undefined" && ((_a = window.CLIP_ICONS) == null ? void 0 : _a[iconId]) || "";
    if (!d) return;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = d;
    container.replaceChildren(svg);
  }
  async function requestUrl() {
    throw new Error("原型环境无网络请求（fake obsidian requestUrl）");
  }
  function stripQuotes(v) {
    if (v.length >= 2 && (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }
  function parseYaml(text) {
    const fm = {};
    let lastKey = null;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (/^\s*-\s+/.test(line)) {
        const v = stripQuotes(line.replace(/^\s*-\s+/, "").trim());
        if (!lastKey) continue;
        const cur = fm[lastKey];
        if (Array.isArray(cur)) cur.push(v);
        else fm[lastKey] = cur === "" || cur === void 0 ? [v] : [String(cur), v];
        continue;
      }
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      lastKey = key;
      if (val.startsWith("[") && val.endsWith("]")) {
        const inner = val.slice(1, -1).trim();
        fm[key] = inner ? inner.split(",").map((s) => stripQuotes(s.trim())) : [];
      } else {
        fm[key] = stripQuotes(val);
      }
    }
    return fm;
  }
  function splitFrontmatter(content) {
    var _a;
    const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/.exec(content);
    if (!m) return { frontmatter: null, body: content };
    return { frontmatter: parseYaml(m[1]), body: (_a = m[2]) != null ? _a : "" };
  }
  function seedVaultFile(path, content, ctime) {
    localStorage.setItem(LS_PREFIX + path, content);
    if (ctime == null) return;
    let stats = {};
    try {
      stats = JSON.parse(localStorage.getItem(STAT_KEY) || "{}");
    } catch (e) {
      stats = {};
    }
    stats[path] = { ctime, mtime: ctime };
    localStorage.setItem(STAT_KEY, JSON.stringify(stats));
  }
  var Platform, TFile, Setting, Component, MarkdownView, MarkdownRenderer, LS_PREFIX, STAT_KEY, FakeVault, FakeApp;
  var init_fake_obsidian = __esm({
    "prototypes/clipbook/fake/fake-obsidian.ts"() {
      Platform = {
        isMobile: typeof window !== "undefined" && window.innerWidth <= 768
      };
      TFile = class {
        constructor() {
          this.path = "";
          this.name = "";
          this.basename = "";
          this.extension = "";
          this.stat = { ctime: 0, mtime: 0 };
        }
      };
      Setting = class {
        constructor(_container) {
          this.settingEl = document.createElement("div");
        }
      };
      Component = class {
      };
      MarkdownView = class {
        constructor() {
          this.file = null;
        }
        getViewData() {
          return "";
        }
      };
      MarkdownRenderer = class {
        /** 评审壳近似实现：正文以纯文本落入容器（Obsidian 真渲染仅插件环境可用，视觉看真机） */
        static render(_app2, md, el) {
          if (el) el.textContent = String(md != null ? md : "");
          return Promise.resolve();
        }
      };
      LS_PREFIX = "bz-sim:";
      STAT_KEY = "bz-sim:__stat__";
      FakeVault = class {
        constructor() {
          this.listeners = /* @__PURE__ */ new Map();
          this.idSeq = 0;
          if (typeof window !== "undefined") {
            window.addEventListener("storage", (e) => {
              if (!e.key || !e.key.startsWith(LS_PREFIX) || e.key === STAT_KEY) return;
              const path = e.key.slice(LS_PREFIX.length);
              this.emit(e.newValue == null ? "delete" : "modify", { path });
            });
          }
        }
        raw(path) {
          return localStorage.getItem(LS_PREFIX + path);
        }
        stats() {
          try {
            return JSON.parse(localStorage.getItem(STAT_KEY) || "{}");
          } catch (e) {
            return {};
          }
        }
        saveStats(stats) {
          localStorage.setItem(STAT_KEY, JSON.stringify(stats));
        }
        makeFile(path) {
          if (this.raw(path) == null) return null;
          const s = this.stats()[path] || { ctime: 0, mtime: 0 };
          const f = new TFile();
          f.path = path;
          f.name = path.split("/").pop() || path;
          f.basename = f.name.replace(/\.[^.]+$/, "");
          f.extension = f.name.includes(".") ? f.name.split(".").pop() : "";
          f.stat = { ...s };
          return f;
        }
        getAbstractFileByPath(path) {
          const f = this.makeFile(path);
          if (f) return f;
          const prefix = path + "/";
          const children = [];
          const seen = /* @__PURE__ */ new Set();
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(LS_PREFIX) || k === STAT_KEY) continue;
            const p = k.slice(LS_PREFIX.length);
            if (!p.startsWith(prefix)) continue;
            const rest = p.slice(prefix.length);
            const seg = rest.split("/")[0];
            if (!seg || seen.has(seg)) continue;
            seen.add(seg);
            if (rest.includes("/")) {
              children.push({ path: prefix + seg, name: seg, children: [] });
            } else {
              children.push(this.makeFile(p));
            }
          }
          if (!children.length) return null;
          return { path, name: path.split("/").pop() || path, children };
        }
        async read(f) {
          const raw = this.raw(f.path);
          if (raw == null) throw new Error("文件不存在：" + f.path);
          return raw;
        }
        /** 缓存读（ui.ts loadClipBody / deleteClipNote 快照消费面）：localStorage 即「缓存」，同 read */
        async cachedRead(f) {
          return this.read(f);
        }
        async modify(f, content) {
          localStorage.setItem(LS_PREFIX + f.path, content);
          const stats = this.stats();
          const cur = stats[f.path] || { ctime: Date.now(), mtime: Date.now() };
          stats[f.path] = { ctime: cur.ctime, mtime: Date.now() };
          this.saveStats(stats);
          this.emit("modify", { path: f.path });
        }
        async create(path, content) {
          if (this.raw(path) != null) throw new Error("文件已存在：" + path);
          localStorage.setItem(LS_PREFIX + path, content);
          const stats = this.stats();
          stats[path] = { ctime: Date.now(), mtime: Date.now() };
          this.saveStats(stats);
          const f = this.makeFile(path);
          this.emit("create", f);
          return f;
        }
        async createFolder(_path) {
          return void 0;
        }
        /** 回收站删除（deleteClipNote 的 vault.trash；system 参数与 Obsidian 同形，原型的回收站即消失） */
        async trash(f, _system) {
          localStorage.removeItem(LS_PREFIX + f.path);
          const stats = this.stats();
          delete stats[f.path];
          this.saveStats(stats);
          this.emit("delete", { path: f.path });
        }
        /** 事件订阅（core/obsidian-adapter 的 vault.on/offref 同形） */
        on(evt, cb) {
          if (!this.listeners.has(evt)) this.listeners.set(evt, []);
          this.listeners.get(evt).push(cb);
          const id = ++this.idSeq;
          return { ref: id };
        }
        offref(_ref) {
          this.listeners.clear();
        }
        emit(evt, ...args) {
          var _a;
          for (const cb of (_a = this.listeners.get(evt)) != null ? _a : []) cb(...args);
        }
      };
      FakeApp = class {
        constructor() {
          this.vault = new FakeVault();
          /** 打开笔记（openNote）：原型中不跳出，no-op */
          this.workspace = {
            openLinkText() {
            }
          };
          this.metadataCache = {
            /** scan.ts defaultCache 唯一消费面：现场解析 frontmatter（文件缺失/无 frontmatter → null） */
            getFileCache(file) {
              const content = localStorage.getItem(LS_PREFIX + file.path);
              if (content == null) return null;
              const { frontmatter } = splitFrontmatter(content);
              return frontmatter ? { frontmatter } : null;
            }
          };
        }
        /** 外链（openExternal 消费面）：原型中不弹浏览器，no-op */
        openUrl() {
        }
      };
    }
  });

  // src/core/app.ts
  function setApp(app) {
    _app = app;
  }
  function getApp() {
    if (!_app) {
      throw new Error("bz: app 未初始化（setApp 未调用）");
    }
    return _app;
  }
  var _app;
  var init_app = __esm({
    "src/core/app.ts"() {
      _app = null;
    }
  });

  // src/core/settings-provider.ts
  function setSettingsProvider(fn) {
    _provider = fn;
  }
  function setSettingsSaver(fn) {
    _saver = fn;
  }
  function saveSettings() {
    return _saver ? _saver() : Promise.resolve();
  }
  function getSettings() {
    if (!_provider) {
      throw new Error("bz: 设置提供者未注入（main.ts onload 应调用 setSettingsProvider）");
    }
    return _provider();
  }
  function tryGetSettings() {
    return _provider ? _provider() : {};
  }
  var _provider, _saver;
  var init_settings_provider = __esm({
    "src/core/settings-provider.ts"() {
      _provider = null;
      _saver = null;
    }
  });

  // src/core/domain-bus.ts
  function emitDomainEvent(channel, evt) {
    const handlers = channels.get(channel);
    if (!handlers || handlers.size === 0) return;
    for (const handler of [...handlers]) {
      try {
        handler(evt);
      } catch (e) {
        console.error(`bz: 域事件 handler 异常（channel=${channel}）`, e);
      }
    }
  }
  function onDomainEvent(channel, handler) {
    let set = channels.get(channel);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      channels.set(channel, set);
    }
    set.add(handler);
    let offed = false;
    return () => {
      if (offed) return;
      offed = true;
      const cur = channels.get(channel);
      if (!cur) return;
      cur.delete(handler);
      if (cur.size === 0) channels.delete(channel);
    };
  }
  var channels;
  var init_domain_bus = __esm({
    "src/core/domain-bus.ts"() {
      channels = /* @__PURE__ */ new Map();
    }
  });

  // src/core/z-order.ts
  function syncAlwaysOnTop() {
    for (const el of alwaysOnTop) {
      if (!el.isConnected) {
        alwaysOnTop.delete(el);
        continue;
      }
      el.style.zIndex = String(zCounter);
    }
  }
  function allocZBlock(n) {
    const base = ++zCounter;
    zCounter += n - 1;
    zCounter++;
    syncAlwaysOnTop();
    return base;
  }
  function allocZ() {
    return allocZBlock(1);
  }
  function topifyZ(...els) {
    const live2 = els.filter((el) => !!el);
    if (live2.length === 0) return;
    const base = allocZBlock(live2.length);
    live2.forEach((el, i) => {
      el.style.zIndex = String(base + i);
    });
  }
  var zCounter, alwaysOnTop;
  var init_z_order = __esm({
    "src/core/z-order.ts"() {
      zCounter = 1e5;
      alwaysOnTop = /* @__PURE__ */ new Set();
    }
  });

  // src/core/notice.ts
  function notice(msg, type, duration) {
    notify(msg, { type: type || "info", duration });
  }
  function notifyUndo(msg, onUndo, opts) {
    return notify(msg, {
      type: opts && opts.type || "delete",
      duration: opts && opts.duration !== void 0 ? opts.duration : UNDO_DURATION_MS,
      action: { label: "撤销", onClick: onUndo }
    });
  }
  function notifySaveError(err, what) {
    const msg = err instanceof Error ? err.message : String(err);
    notify(what ? `保存失败（${what}）：${msg}` : `保存失败：${msg}`, { type: "error" });
  }
  function isMobileView() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
  }
  function defaultVariant() {
    return isMobileView() ? "drop" : "slide-right";
  }
  function defaultDuration(type) {
    return type === "error" ? 5e3 : 3e3;
  }
  function calcDuration(text, base) {
    const len = text.length;
    if (len <= SHORT_THRESHOLD) return base;
    const extra = (len - SHORT_THRESHOLD) * PER_CHAR_MS;
    return Math.min(base + extra, 15e3);
  }
  function ensureContainer() {
    let container = document.getElementById("bz-notice-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "bz-notice-container";
      document.body.appendChild(container);
    }
    return container;
  }
  function removeInternal(n) {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    const i = live.indexOf(n);
    if (i !== -1) live.splice(i, 1);
    if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
  }
  function evictOldest() {
    let quota = live.length - MAX_VISIBLE + 1;
    for (let i = 0; quota > 0 && i < live.length; ) {
      const candidate = live[i];
      if (candidate.persistent) {
        i++;
        continue;
      }
      removeInternal(candidate);
      quota--;
    }
  }
  function applyTypeToEl(n, kind) {
    const isProgressNow = kind === "progress";
    n.el.classList.remove(
      "bz-notice--info",
      "bz-notice--success",
      "bz-notice--warning",
      "bz-notice--error",
      "bz-notice--pause",
      "bz-notice--accept",
      "bz-notice--delete",
      "bz-notice--confirm",
      "bz-notice--restore",
      "bz-notice--skip",
      "bz-notice--archive",
      "bz-notice--progress"
    );
    n.el.classList.add("bz-notice--" + (isProgressNow ? "progress" : kind));
    n.iconEl.innerHTML = "";
    if (isProgressNow) {
      n.iconEl.innerHTML = SPINNER_SVG;
    } else {
      n.iconEl.textContent = ICONS[kind];
    }
    n.isProgress = isProgressNow;
  }
  function hideNow(n) {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    if (!n.el.classList.contains("bz-notice--leaving")) {
      n.el.classList.add("bz-notice--leaving");
      const out = OUT_CLASS[n.variant];
      if (out) n.el.classList.add(out);
      window.setTimeout(() => removeInternal(n), LEAVE_MS);
    }
  }
  function armTimer(n, kind, explicitDuration, text) {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    n.persistent = false;
    if (kind === "progress") {
      if (explicitDuration !== void 0 && explicitDuration > 0) {
        n.timer = window.setTimeout(() => hideNow(n), explicitDuration);
      } else {
        n.persistent = true;
      }
      return;
    }
    const base = defaultDuration(kind);
    const dur = explicitDuration !== void 0 ? explicitDuration : text ? calcDuration(text, base) : base;
    if (dur <= 0) {
      n.persistent = true;
      return;
    }
    n.timer = window.setTimeout(() => hideNow(n), dur);
  }
  function noopHandle() {
    return {
      el: document.createElement("div"),
      setMessage() {
      },
      setProgress() {
      },
      setType() {
      },
      hide() {
      }
    };
  }
  function appendActionBtn(n, action) {
    const btn = document.createElement("span");
    btn.className = "bz-notice-action";
    btn.setAttribute("role", "button");
    btn.textContent = action.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (action.onClick) action.onClick();
      hideNow(n);
    });
    n.el.appendChild(btn);
  }
  function notify(msg, opts) {
    const kind = opts && opts.type || "info";
    const isProgress = kind === "progress";
    const type = isProgress ? "info" : kind;
    const variant = opts && opts.variant || defaultVariant();
    const container = ensureContainer();
    if (opts && opts.dedupeKey) {
      const key = opts.dedupeKey;
      const r = recent[key];
      const now = Date.now();
      if (r && r.n && r.n.el.isConnected) {
        r.n.msgEl.textContent = msg;
        if (r.n.isProgress !== isProgress || r.n.el.classList.contains("bz-notice--" + type) === false) {
          applyTypeToEl(r.n, kind);
        }
        const mergeActions = [];
        if (opts.action) mergeActions.push(opts.action);
        if (opts.actions) mergeActions.push(...opts.actions);
        const existingLabels = new Set(
          Array.from(r.n.el.querySelectorAll(".bz-notice-action")).map((el2) => el2.textContent || "")
        );
        for (const a of mergeActions) {
          if (!existingLabels.has(a.label)) appendActionBtn(r.n, a);
        }
        armTimer(r.n, kind, opts.duration, msg);
        return noopHandle();
      }
      if (r && now - r.at < DEDUPE_WINDOW_MS) {
        return noopHandle();
      }
      recent[key] = { at: now, n: null };
    }
    evictOldest();
    const el = document.createElement("div");
    el.className = "bz-notice bz-notice--" + (isProgress ? "progress" : type) + " bz-notice--in-" + variant;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    const icon = document.createElement("div");
    icon.className = "bz-notice-icon";
    if (isProgress) {
      icon.innerHTML = SPINNER_SVG;
    } else {
      icon.textContent = ICONS[type];
    }
    el.appendChild(icon);
    const body = document.createElement("div");
    body.className = "bz-notice-body";
    if (opts && opts.title) {
      const titleEl = document.createElement("div");
      titleEl.className = "bz-notice-title";
      titleEl.textContent = opts.title;
      body.appendChild(titleEl);
    }
    const msgEl = document.createElement("div");
    msgEl.className = "bz-notice-msg";
    msgEl.textContent = msg;
    body.appendChild(msgEl);
    el.appendChild(body);
    let progressEl = null;
    if (isProgress) {
      progressEl = document.createElement("div");
      progressEl.className = "bz-notice-progress";
      el.appendChild(progressEl);
    }
    const n = { el, timer: null, msgEl, progressEl, iconEl: icon, variant, isProgress, persistent: false };
    const actions = [];
    if (opts && opts.action) actions.push(opts.action);
    if (opts && opts.actions) {
      for (const a of opts.actions) {
        if (!actions.some((x) => x.label === a.label)) actions.push(a);
      }
    }
    for (const a of actions) appendActionBtn(n, a);
    el.addEventListener("click", () => hideNow(n));
    container.style.zIndex = String(allocZ());
    container.appendChild(el);
    live.push(n);
    if (opts && opts.dedupeKey) {
      const r = recent[opts.dedupeKey];
      if (r) r.n = n;
    }
    const fullText = (opts && opts.title ? opts.title + " " : "") + msg;
    armTimer(n, kind, opts && opts.duration, fullText);
    return {
      el,
      setMessage(text) {
        n.msgEl.textContent = text;
      },
      setType(t) {
        applyTypeToEl(n, t);
        armTimer(n, t, void 0, n.msgEl.textContent || void 0);
      },
      setProgress(pct) {
        if (!n.progressEl) return;
        if (pct === -1) {
          n.progressEl.classList.add("bz-notice-progress--indeterminate");
          return;
        }
        n.progressEl.classList.remove("bz-notice-progress--indeterminate");
        const clamped = Math.max(0, Math.min(100, pct));
        n.progressEl.style.width = clamped + "%";
        if (clamped >= 100) n.progressEl.classList.add("bz-notice-progress--done");
        else n.progressEl.classList.remove("bz-notice-progress--done");
      },
      hide() {
        hideNow(n);
      }
    };
  }
  var MAX_VISIBLE, LEAVE_MS, DEDUPE_WINDOW_MS, MOBILE_QUERY, ICONS, SPINNER_SVG, UNDO_DURATION_MS, OUT_CLASS, PER_CHAR_MS, SHORT_THRESHOLD, live, recent;
  var init_notice = __esm({
    "src/core/notice.ts"() {
      init_z_order();
      MAX_VISIBLE = 5;
      LEAVE_MS = 200;
      DEDUPE_WINDOW_MS = 3e4;
      MOBILE_QUERY = "(max-width: 768px)";
      ICONS = {
        info: "ℹ️",
        success: "✅",
        warning: "⚠️",
        error: "❌",
        pause: "⏸️",
        accept: "✨",
        delete: "🗑️",
        confirm: "✓",
        restore: "↩️",
        skip: "🚫",
        archive: "📁"
      };
      SPINNER_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';
      UNDO_DURATION_MS = 6e3;
      OUT_CLASS = {
        drop: "bz-notice--out-drop",
        pop: "bz-notice--out-pop",
        "slide-left": "bz-notice--out-left",
        "slide-right": "bz-notice--out-right",
        bounce: "bz-notice--out-fade",
        shake: "bz-notice--out-fade"
      };
      PER_CHAR_MS = 60;
      SHORT_THRESHOLD = 20;
      live = [];
      recent = {};
    }
  });

  // src/core/esc-manager.ts
  var escManager;
  var init_esc_manager = __esm({
    "src/core/esc-manager.ts"() {
      escManager = (() => {
        const layers = [];
        const onKeydown = (e) => {
          if (e.key !== "Escape") return;
          for (let i = layers.length - 1; i >= 0; i--) {
            const L = layers[i];
            try {
              if (L.isVisible()) {
                L.close();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
              }
            } catch (err) {
              layers.splice(i, 1);
            }
          }
        };
        if (typeof document !== "undefined") {
          document.addEventListener("keydown", onKeydown);
        }
        return {
          register(id, layer) {
            for (let i = layers.length - 1; i >= 0; i--) {
              if (layers[i].id === id && !layers[i].isVisible()) layers.splice(i, 1);
            }
            const rec = Object.assign({ id }, layer);
            layers.push(rec);
            return {
              unregister: () => {
                const i = layers.indexOf(rec);
                if (i !== -1) layers.splice(i, 1);
              }
            };
          },
          /** 插件卸载时移除全局监听 */
          destroy() {
            if (typeof document !== "undefined") {
              document.removeEventListener("keydown", onKeydown);
            }
          }
        };
      })();
    }
  });

  // node_modules/.pnpm/moment@2.30.1/node_modules/moment/moment.js
  var require_moment = __commonJS({
    "node_modules/.pnpm/moment@2.30.1/node_modules/moment/moment.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : global.moment = factory();
      })(exports, function() {
        "use strict";
        var hookCallback;
        function hooks() {
          return hookCallback.apply(null, arguments);
        }
        function setHookCallback(callback) {
          hookCallback = callback;
        }
        function isArray(input) {
          return input instanceof Array || Object.prototype.toString.call(input) === "[object Array]";
        }
        function isObject(input) {
          return input != null && Object.prototype.toString.call(input) === "[object Object]";
        }
        function hasOwnProp(a, b) {
          return Object.prototype.hasOwnProperty.call(a, b);
        }
        function isObjectEmpty(obj) {
          if (Object.getOwnPropertyNames) {
            return Object.getOwnPropertyNames(obj).length === 0;
          } else {
            var k;
            for (k in obj) {
              if (hasOwnProp(obj, k)) {
                return false;
              }
            }
            return true;
          }
        }
        function isUndefined(input) {
          return input === void 0;
        }
        function isNumber(input) {
          return typeof input === "number" || Object.prototype.toString.call(input) === "[object Number]";
        }
        function isDate(input) {
          return input instanceof Date || Object.prototype.toString.call(input) === "[object Date]";
        }
        function map(arr, fn) {
          var res = [], i, arrLen = arr.length;
          for (i = 0; i < arrLen; ++i) {
            res.push(fn(arr[i], i));
          }
          return res;
        }
        function extend(a, b) {
          for (var i in b) {
            if (hasOwnProp(b, i)) {
              a[i] = b[i];
            }
          }
          if (hasOwnProp(b, "toString")) {
            a.toString = b.toString;
          }
          if (hasOwnProp(b, "valueOf")) {
            a.valueOf = b.valueOf;
          }
          return a;
        }
        function createUTC(input, format2, locale2, strict) {
          return createLocalOrUTC(input, format2, locale2, strict, true).utc();
        }
        function defaultParsingFlags() {
          return {
            empty: false,
            unusedTokens: [],
            unusedInput: [],
            overflow: -2,
            charsLeftOver: 0,
            nullInput: false,
            invalidEra: null,
            invalidMonth: null,
            invalidFormat: false,
            userInvalidated: false,
            iso: false,
            parsedDateParts: [],
            era: null,
            meridiem: null,
            rfc2822: false,
            weekdayMismatch: false
          };
        }
        function getParsingFlags(m) {
          if (m._pf == null) {
            m._pf = defaultParsingFlags();
          }
          return m._pf;
        }
        var some;
        if (Array.prototype.some) {
          some = Array.prototype.some;
        } else {
          some = function(fun) {
            var t = Object(this), len = t.length >>> 0, i;
            for (i = 0; i < len; i++) {
              if (i in t && fun.call(this, t[i], i, t)) {
                return true;
              }
            }
            return false;
          };
        }
        function isValid(m) {
          var flags = null, parsedParts = false, isNowValid = m._d && !isNaN(m._d.getTime());
          if (isNowValid) {
            flags = getParsingFlags(m);
            parsedParts = some.call(flags.parsedDateParts, function(i) {
              return i != null;
            });
            isNowValid = flags.overflow < 0 && !flags.empty && !flags.invalidEra && !flags.invalidMonth && !flags.invalidWeekday && !flags.weekdayMismatch && !flags.nullInput && !flags.invalidFormat && !flags.userInvalidated && (!flags.meridiem || flags.meridiem && parsedParts);
            if (m._strict) {
              isNowValid = isNowValid && flags.charsLeftOver === 0 && flags.unusedTokens.length === 0 && flags.bigHour === void 0;
            }
          }
          if (Object.isFrozen == null || !Object.isFrozen(m)) {
            m._isValid = isNowValid;
          } else {
            return isNowValid;
          }
          return m._isValid;
        }
        function createInvalid(flags) {
          var m = createUTC(NaN);
          if (flags != null) {
            extend(getParsingFlags(m), flags);
          } else {
            getParsingFlags(m).userInvalidated = true;
          }
          return m;
        }
        var momentProperties = hooks.momentProperties = [], updateInProgress = false;
        function copyConfig(to2, from2) {
          var i, prop, val, momentPropertiesLen = momentProperties.length;
          if (!isUndefined(from2._isAMomentObject)) {
            to2._isAMomentObject = from2._isAMomentObject;
          }
          if (!isUndefined(from2._i)) {
            to2._i = from2._i;
          }
          if (!isUndefined(from2._f)) {
            to2._f = from2._f;
          }
          if (!isUndefined(from2._l)) {
            to2._l = from2._l;
          }
          if (!isUndefined(from2._strict)) {
            to2._strict = from2._strict;
          }
          if (!isUndefined(from2._tzm)) {
            to2._tzm = from2._tzm;
          }
          if (!isUndefined(from2._isUTC)) {
            to2._isUTC = from2._isUTC;
          }
          if (!isUndefined(from2._offset)) {
            to2._offset = from2._offset;
          }
          if (!isUndefined(from2._pf)) {
            to2._pf = getParsingFlags(from2);
          }
          if (!isUndefined(from2._locale)) {
            to2._locale = from2._locale;
          }
          if (momentPropertiesLen > 0) {
            for (i = 0; i < momentPropertiesLen; i++) {
              prop = momentProperties[i];
              val = from2[prop];
              if (!isUndefined(val)) {
                to2[prop] = val;
              }
            }
          }
          return to2;
        }
        function Moment(config) {
          copyConfig(this, config);
          this._d = new Date(config._d != null ? config._d.getTime() : NaN);
          if (!this.isValid()) {
            this._d = /* @__PURE__ */ new Date(NaN);
          }
          if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
          }
        }
        function isMoment(obj) {
          return obj instanceof Moment || obj != null && obj._isAMomentObject != null;
        }
        function warn(msg) {
          if (hooks.suppressDeprecationWarnings === false && typeof console !== "undefined" && console.warn) {
            console.warn("Deprecation warning: " + msg);
          }
        }
        function deprecate(msg, fn) {
          var firstTime = true;
          return extend(function() {
            if (hooks.deprecationHandler != null) {
              hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
              var args = [], arg, i, key, argLen = arguments.length;
              for (i = 0; i < argLen; i++) {
                arg = "";
                if (typeof arguments[i] === "object") {
                  arg += "\n[" + i + "] ";
                  for (key in arguments[0]) {
                    if (hasOwnProp(arguments[0], key)) {
                      arg += key + ": " + arguments[0][key] + ", ";
                    }
                  }
                  arg = arg.slice(0, -2);
                } else {
                  arg = arguments[i];
                }
                args.push(arg);
              }
              warn(
                msg + "\nArguments: " + Array.prototype.slice.call(args).join("") + "\n" + new Error().stack
              );
              firstTime = false;
            }
            return fn.apply(this, arguments);
          }, fn);
        }
        var deprecations = {};
        function deprecateSimple(name, msg) {
          if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
          }
          if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
          }
        }
        hooks.suppressDeprecationWarnings = false;
        hooks.deprecationHandler = null;
        function isFunction(input) {
          return typeof Function !== "undefined" && input instanceof Function || Object.prototype.toString.call(input) === "[object Function]";
        }
        function set(config) {
          var prop, i;
          for (i in config) {
            if (hasOwnProp(config, i)) {
              prop = config[i];
              if (isFunction(prop)) {
                this[i] = prop;
              } else {
                this["_" + i] = prop;
              }
            }
          }
          this._config = config;
          this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) + "|" + /\d{1,2}/.source
          );
        }
        function mergeConfigs(parentConfig, childConfig) {
          var res = extend({}, parentConfig), prop;
          for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
              if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                res[prop] = {};
                extend(res[prop], parentConfig[prop]);
                extend(res[prop], childConfig[prop]);
              } else if (childConfig[prop] != null) {
                res[prop] = childConfig[prop];
              } else {
                delete res[prop];
              }
            }
          }
          for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) && !hasOwnProp(childConfig, prop) && isObject(parentConfig[prop])) {
              res[prop] = extend({}, res[prop]);
            }
          }
          return res;
        }
        function Locale(config) {
          if (config != null) {
            this.set(config);
          }
        }
        var keys;
        if (Object.keys) {
          keys = Object.keys;
        } else {
          keys = function(obj) {
            var i, res = [];
            for (i in obj) {
              if (hasOwnProp(obj, i)) {
                res.push(i);
              }
            }
            return res;
          };
        }
        var defaultCalendar = {
          sameDay: "[Today at] LT",
          nextDay: "[Tomorrow at] LT",
          nextWeek: "dddd [at] LT",
          lastDay: "[Yesterday at] LT",
          lastWeek: "[Last] dddd [at] LT",
          sameElse: "L"
        };
        function calendar(key, mom, now2) {
          var output = this._calendar[key] || this._calendar["sameElse"];
          return isFunction(output) ? output.call(mom, now2) : output;
        }
        function zeroFill(number, targetLength, forceSign) {
          var absNumber = "" + Math.abs(number), zerosToFill = targetLength - absNumber.length, sign2 = number >= 0;
          return (sign2 ? forceSign ? "+" : "" : "-") + Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
        }
        var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|N{1,5}|YYYYYY|YYYYY|YYYY|YY|y{2,4}|yo?|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g, localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g, formatFunctions = {}, formatTokenFunctions = {};
        function addFormatToken(token2, padded, ordinal2, callback) {
          var func = callback;
          if (typeof callback === "string") {
            func = function() {
              return this[callback]();
            };
          }
          if (token2) {
            formatTokenFunctions[token2] = func;
          }
          if (padded) {
            formatTokenFunctions[padded[0]] = function() {
              return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
          }
          if (ordinal2) {
            formatTokenFunctions[ordinal2] = function() {
              return this.localeData().ordinal(
                func.apply(this, arguments),
                token2
              );
            };
          }
        }
        function removeFormattingTokens(input) {
          if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, "");
          }
          return input.replace(/\\/g, "");
        }
        function makeFormatFunction(format2) {
          var array = format2.match(formattingTokens), i, length;
          for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
              array[i] = formatTokenFunctions[array[i]];
            } else {
              array[i] = removeFormattingTokens(array[i]);
            }
          }
          return function(mom) {
            var output = "", i2;
            for (i2 = 0; i2 < length; i2++) {
              output += isFunction(array[i2]) ? array[i2].call(mom, format2) : array[i2];
            }
            return output;
          };
        }
        function formatMoment(m, format2) {
          if (!m.isValid()) {
            return m.localeData().invalidDate();
          }
          format2 = expandFormat(format2, m.localeData());
          formatFunctions[format2] = formatFunctions[format2] || makeFormatFunction(format2);
          return formatFunctions[format2](m);
        }
        function expandFormat(format2, locale2) {
          var i = 5;
          function replaceLongDateFormatTokens(input) {
            return locale2.longDateFormat(input) || input;
          }
          localFormattingTokens.lastIndex = 0;
          while (i >= 0 && localFormattingTokens.test(format2)) {
            format2 = format2.replace(
              localFormattingTokens,
              replaceLongDateFormatTokens
            );
            localFormattingTokens.lastIndex = 0;
            i -= 1;
          }
          return format2;
        }
        var defaultLongDateFormat = {
          LTS: "h:mm:ss A",
          LT: "h:mm A",
          L: "MM/DD/YYYY",
          LL: "MMMM D, YYYY",
          LLL: "MMMM D, YYYY h:mm A",
          LLLL: "dddd, MMMM D, YYYY h:mm A"
        };
        function longDateFormat(key) {
          var format2 = this._longDateFormat[key], formatUpper = this._longDateFormat[key.toUpperCase()];
          if (format2 || !formatUpper) {
            return format2;
          }
          this._longDateFormat[key] = formatUpper.match(formattingTokens).map(function(tok) {
            if (tok === "MMMM" || tok === "MM" || tok === "DD" || tok === "dddd") {
              return tok.slice(1);
            }
            return tok;
          }).join("");
          return this._longDateFormat[key];
        }
        var defaultInvalidDate = "Invalid date";
        function invalidDate() {
          return this._invalidDate;
        }
        var defaultOrdinal = "%d", defaultDayOfMonthOrdinalParse = /\d{1,2}/;
        function ordinal(number) {
          return this._ordinal.replace("%d", number);
        }
        var defaultRelativeTime = {
          future: "in %s",
          past: "%s ago",
          s: "a few seconds",
          ss: "%d seconds",
          m: "a minute",
          mm: "%d minutes",
          h: "an hour",
          hh: "%d hours",
          d: "a day",
          dd: "%d days",
          w: "a week",
          ww: "%d weeks",
          M: "a month",
          MM: "%d months",
          y: "a year",
          yy: "%d years"
        };
        function relativeTime(number, withoutSuffix, string, isFuture) {
          var output = this._relativeTime[string];
          return isFunction(output) ? output(number, withoutSuffix, string, isFuture) : output.replace(/%d/i, number);
        }
        function pastFuture(diff2, output) {
          var format2 = this._relativeTime[diff2 > 0 ? "future" : "past"];
          return isFunction(format2) ? format2(output) : format2.replace(/%s/i, output);
        }
        var aliases = {
          D: "date",
          dates: "date",
          date: "date",
          d: "day",
          days: "day",
          day: "day",
          e: "weekday",
          weekdays: "weekday",
          weekday: "weekday",
          E: "isoWeekday",
          isoweekdays: "isoWeekday",
          isoweekday: "isoWeekday",
          DDD: "dayOfYear",
          dayofyears: "dayOfYear",
          dayofyear: "dayOfYear",
          h: "hour",
          hours: "hour",
          hour: "hour",
          ms: "millisecond",
          milliseconds: "millisecond",
          millisecond: "millisecond",
          m: "minute",
          minutes: "minute",
          minute: "minute",
          M: "month",
          months: "month",
          month: "month",
          Q: "quarter",
          quarters: "quarter",
          quarter: "quarter",
          s: "second",
          seconds: "second",
          second: "second",
          gg: "weekYear",
          weekyears: "weekYear",
          weekyear: "weekYear",
          GG: "isoWeekYear",
          isoweekyears: "isoWeekYear",
          isoweekyear: "isoWeekYear",
          w: "week",
          weeks: "week",
          week: "week",
          W: "isoWeek",
          isoweeks: "isoWeek",
          isoweek: "isoWeek",
          y: "year",
          years: "year",
          year: "year"
        };
        function normalizeUnits(units) {
          return typeof units === "string" ? aliases[units] || aliases[units.toLowerCase()] : void 0;
        }
        function normalizeObjectUnits(inputObject) {
          var normalizedInput = {}, normalizedProp, prop;
          for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
              normalizedProp = normalizeUnits(prop);
              if (normalizedProp) {
                normalizedInput[normalizedProp] = inputObject[prop];
              }
            }
          }
          return normalizedInput;
        }
        var priorities = {
          date: 9,
          day: 11,
          weekday: 11,
          isoWeekday: 11,
          dayOfYear: 4,
          hour: 13,
          millisecond: 16,
          minute: 14,
          month: 8,
          quarter: 7,
          second: 15,
          weekYear: 1,
          isoWeekYear: 1,
          week: 5,
          isoWeek: 5,
          year: 1
        };
        function getPrioritizedUnits(unitsObj) {
          var units = [], u;
          for (u in unitsObj) {
            if (hasOwnProp(unitsObj, u)) {
              units.push({ unit: u, priority: priorities[u] });
            }
          }
          units.sort(function(a, b) {
            return a.priority - b.priority;
          });
          return units;
        }
        var match1 = /\d/, match2 = /\d\d/, match3 = /\d{3}/, match4 = /\d{4}/, match6 = /[+-]?\d{6}/, match1to2 = /\d\d?/, match3to4 = /\d\d\d\d?/, match5to6 = /\d\d\d\d\d\d?/, match1to3 = /\d{1,3}/, match1to4 = /\d{1,4}/, match1to6 = /[+-]?\d{1,6}/, matchUnsigned = /\d+/, matchSigned = /[+-]?\d+/, matchOffset = /Z|[+-]\d\d:?\d\d/gi, matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi, matchTimestamp = /[+-]?\d+(\.\d{1,3})?/, matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i, match1to2NoLeadingZero = /^[1-9]\d?/, match1to2HasZero = /^([1-9]\d|\d)/, regexes;
        regexes = {};
        function addRegexToken(token2, regex, strictRegex) {
          regexes[token2] = isFunction(regex) ? regex : function(isStrict, localeData2) {
            return isStrict && strictRegex ? strictRegex : regex;
          };
        }
        function getParseRegexForToken(token2, config) {
          if (!hasOwnProp(regexes, token2)) {
            return new RegExp(unescapeFormat(token2));
          }
          return regexes[token2](config._strict, config._locale);
        }
        function unescapeFormat(s) {
          return regexEscape(
            s.replace("\\", "").replace(
              /\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g,
              function(matched, p1, p2, p3, p4) {
                return p1 || p2 || p3 || p4;
              }
            )
          );
        }
        function regexEscape(s) {
          return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        }
        function absFloor(number) {
          if (number < 0) {
            return Math.ceil(number) || 0;
          } else {
            return Math.floor(number);
          }
        }
        function toInt(argumentForCoercion) {
          var coercedNumber = +argumentForCoercion, value = 0;
          if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
          }
          return value;
        }
        var tokens = {};
        function addParseToken(token2, callback) {
          var i, func = callback, tokenLen;
          if (typeof token2 === "string") {
            token2 = [token2];
          }
          if (isNumber(callback)) {
            func = function(input, array) {
              array[callback] = toInt(input);
            };
          }
          tokenLen = token2.length;
          for (i = 0; i < tokenLen; i++) {
            tokens[token2[i]] = func;
          }
        }
        function addWeekParseToken(token2, callback) {
          addParseToken(token2, function(input, array, config, token3) {
            config._w = config._w || {};
            callback(input, config._w, config, token3);
          });
        }
        function addTimeToArrayFromToken(token2, input, config) {
          if (input != null && hasOwnProp(tokens, token2)) {
            tokens[token2](input, config._a, config, token2);
          }
        }
        function isLeapYear(year) {
          return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
        }
        var YEAR = 0, MONTH = 1, DATE = 2, HOUR = 3, MINUTE = 4, SECOND = 5, MILLISECOND = 6, WEEK = 7, WEEKDAY = 8;
        addFormatToken("Y", 0, 0, function() {
          var y = this.year();
          return y <= 9999 ? zeroFill(y, 4) : "+" + y;
        });
        addFormatToken(0, ["YY", 2], 0, function() {
          return this.year() % 100;
        });
        addFormatToken(0, ["YYYY", 4], 0, "year");
        addFormatToken(0, ["YYYYY", 5], 0, "year");
        addFormatToken(0, ["YYYYYY", 6, true], 0, "year");
        addRegexToken("Y", matchSigned);
        addRegexToken("YY", match1to2, match2);
        addRegexToken("YYYY", match1to4, match4);
        addRegexToken("YYYYY", match1to6, match6);
        addRegexToken("YYYYYY", match1to6, match6);
        addParseToken(["YYYYY", "YYYYYY"], YEAR);
        addParseToken("YYYY", function(input, array) {
          array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
        });
        addParseToken("YY", function(input, array) {
          array[YEAR] = hooks.parseTwoDigitYear(input);
        });
        addParseToken("Y", function(input, array) {
          array[YEAR] = parseInt(input, 10);
        });
        function daysInYear(year) {
          return isLeapYear(year) ? 366 : 365;
        }
        hooks.parseTwoDigitYear = function(input) {
          return toInt(input) + (toInt(input) > 68 ? 1900 : 2e3);
        };
        var getSetYear = makeGetSet("FullYear", true);
        function getIsLeapYear() {
          return isLeapYear(this.year());
        }
        function makeGetSet(unit, keepTime) {
          return function(value) {
            if (value != null) {
              set$1(this, unit, value);
              hooks.updateOffset(this, keepTime);
              return this;
            } else {
              return get(this, unit);
            }
          };
        }
        function get(mom, unit) {
          if (!mom.isValid()) {
            return NaN;
          }
          var d = mom._d, isUTC = mom._isUTC;
          switch (unit) {
            case "Milliseconds":
              return isUTC ? d.getUTCMilliseconds() : d.getMilliseconds();
            case "Seconds":
              return isUTC ? d.getUTCSeconds() : d.getSeconds();
            case "Minutes":
              return isUTC ? d.getUTCMinutes() : d.getMinutes();
            case "Hours":
              return isUTC ? d.getUTCHours() : d.getHours();
            case "Date":
              return isUTC ? d.getUTCDate() : d.getDate();
            case "Day":
              return isUTC ? d.getUTCDay() : d.getDay();
            case "Month":
              return isUTC ? d.getUTCMonth() : d.getMonth();
            case "FullYear":
              return isUTC ? d.getUTCFullYear() : d.getFullYear();
            default:
              return NaN;
          }
        }
        function set$1(mom, unit, value) {
          var d, isUTC, year, month, date;
          if (!mom.isValid() || isNaN(value)) {
            return;
          }
          d = mom._d;
          isUTC = mom._isUTC;
          switch (unit) {
            case "Milliseconds":
              return void (isUTC ? d.setUTCMilliseconds(value) : d.setMilliseconds(value));
            case "Seconds":
              return void (isUTC ? d.setUTCSeconds(value) : d.setSeconds(value));
            case "Minutes":
              return void (isUTC ? d.setUTCMinutes(value) : d.setMinutes(value));
            case "Hours":
              return void (isUTC ? d.setUTCHours(value) : d.setHours(value));
            case "Date":
              return void (isUTC ? d.setUTCDate(value) : d.setDate(value));
            case "FullYear":
              break;
            default:
              return;
          }
          year = value;
          month = mom.month();
          date = mom.date();
          date = date === 29 && month === 1 && !isLeapYear(year) ? 28 : date;
          void (isUTC ? d.setUTCFullYear(year, month, date) : d.setFullYear(year, month, date));
        }
        function stringGet(units) {
          units = normalizeUnits(units);
          if (isFunction(this[units])) {
            return this[units]();
          }
          return this;
        }
        function stringSet(units, value) {
          if (typeof units === "object") {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units), i, prioritizedLen = prioritized.length;
            for (i = 0; i < prioritizedLen; i++) {
              this[prioritized[i].unit](units[prioritized[i].unit]);
            }
          } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
              return this[units](value);
            }
          }
          return this;
        }
        function mod(n, x) {
          return (n % x + x) % x;
        }
        var indexOf;
        if (Array.prototype.indexOf) {
          indexOf = Array.prototype.indexOf;
        } else {
          indexOf = function(o) {
            var i;
            for (i = 0; i < this.length; ++i) {
              if (this[i] === o) {
                return i;
              }
            }
            return -1;
          };
        }
        function daysInMonth(year, month) {
          if (isNaN(year) || isNaN(month)) {
            return NaN;
          }
          var modMonth = mod(month, 12);
          year += (month - modMonth) / 12;
          return modMonth === 1 ? isLeapYear(year) ? 29 : 28 : 31 - modMonth % 7 % 2;
        }
        addFormatToken("M", ["MM", 2], "Mo", function() {
          return this.month() + 1;
        });
        addFormatToken("MMM", 0, 0, function(format2) {
          return this.localeData().monthsShort(this, format2);
        });
        addFormatToken("MMMM", 0, 0, function(format2) {
          return this.localeData().months(this, format2);
        });
        addRegexToken("M", match1to2, match1to2NoLeadingZero);
        addRegexToken("MM", match1to2, match2);
        addRegexToken("MMM", function(isStrict, locale2) {
          return locale2.monthsShortRegex(isStrict);
        });
        addRegexToken("MMMM", function(isStrict, locale2) {
          return locale2.monthsRegex(isStrict);
        });
        addParseToken(["M", "MM"], function(input, array) {
          array[MONTH] = toInt(input) - 1;
        });
        addParseToken(["MMM", "MMMM"], function(input, array, config, token2) {
          var month = config._locale.monthsParse(input, token2, config._strict);
          if (month != null) {
            array[MONTH] = month;
          } else {
            getParsingFlags(config).invalidMonth = input;
          }
        });
        var defaultLocaleMonths = "January_February_March_April_May_June_July_August_September_October_November_December".split(
          "_"
        ), defaultLocaleMonthsShort = "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"), MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/, defaultMonthsShortRegex = matchWord, defaultMonthsRegex = matchWord;
        function localeMonths(m, format2) {
          if (!m) {
            return isArray(this._months) ? this._months : this._months["standalone"];
          }
          return isArray(this._months) ? this._months[m.month()] : this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format2) ? "format" : "standalone"][m.month()];
        }
        function localeMonthsShort(m, format2) {
          if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort : this._monthsShort["standalone"];
          }
          return isArray(this._monthsShort) ? this._monthsShort[m.month()] : this._monthsShort[MONTHS_IN_FORMAT.test(format2) ? "format" : "standalone"][m.month()];
        }
        function handleStrictParse(monthName, format2, strict) {
          var i, ii, mom, llc = monthName.toLocaleLowerCase();
          if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
              mom = createUTC([2e3, i]);
              this._shortMonthsParse[i] = this.monthsShort(
                mom,
                ""
              ).toLocaleLowerCase();
              this._longMonthsParse[i] = this.months(mom, "").toLocaleLowerCase();
            }
          }
          if (strict) {
            if (format2 === "MMM") {
              ii = indexOf.call(this._shortMonthsParse, llc);
              return ii !== -1 ? ii : null;
            } else {
              ii = indexOf.call(this._longMonthsParse, llc);
              return ii !== -1 ? ii : null;
            }
          } else {
            if (format2 === "MMM") {
              ii = indexOf.call(this._shortMonthsParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._longMonthsParse, llc);
              return ii !== -1 ? ii : null;
            } else {
              ii = indexOf.call(this._longMonthsParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._shortMonthsParse, llc);
              return ii !== -1 ? ii : null;
            }
          }
        }
        function localeMonthsParse(monthName, format2, strict) {
          var i, mom, regex;
          if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format2, strict);
          }
          if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
          }
          for (i = 0; i < 12; i++) {
            mom = createUTC([2e3, i]);
            if (strict && !this._longMonthsParse[i]) {
              this._longMonthsParse[i] = new RegExp(
                "^" + this.months(mom, "").replace(".", "") + "$",
                "i"
              );
              this._shortMonthsParse[i] = new RegExp(
                "^" + this.monthsShort(mom, "").replace(".", "") + "$",
                "i"
              );
            }
            if (!strict && !this._monthsParse[i]) {
              regex = "^" + this.months(mom, "") + "|^" + this.monthsShort(mom, "");
              this._monthsParse[i] = new RegExp(regex.replace(".", ""), "i");
            }
            if (strict && format2 === "MMMM" && this._longMonthsParse[i].test(monthName)) {
              return i;
            } else if (strict && format2 === "MMM" && this._shortMonthsParse[i].test(monthName)) {
              return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
              return i;
            }
          }
        }
        function setMonth(mom, value) {
          if (!mom.isValid()) {
            return mom;
          }
          if (typeof value === "string") {
            if (/^\d+$/.test(value)) {
              value = toInt(value);
            } else {
              value = mom.localeData().monthsParse(value);
              if (!isNumber(value)) {
                return mom;
              }
            }
          }
          var month = value, date = mom.date();
          date = date < 29 ? date : Math.min(date, daysInMonth(mom.year(), month));
          void (mom._isUTC ? mom._d.setUTCMonth(month, date) : mom._d.setMonth(month, date));
          return mom;
        }
        function getSetMonth(value) {
          if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
          } else {
            return get(this, "Month");
          }
        }
        function getDaysInMonth() {
          return daysInMonth(this.year(), this.month());
        }
        function monthsShortRegex(isStrict) {
          if (this._monthsParseExact) {
            if (!hasOwnProp(this, "_monthsRegex")) {
              computeMonthsParse.call(this);
            }
            if (isStrict) {
              return this._monthsShortStrictRegex;
            } else {
              return this._monthsShortRegex;
            }
          } else {
            if (!hasOwnProp(this, "_monthsShortRegex")) {
              this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ? this._monthsShortStrictRegex : this._monthsShortRegex;
          }
        }
        function monthsRegex(isStrict) {
          if (this._monthsParseExact) {
            if (!hasOwnProp(this, "_monthsRegex")) {
              computeMonthsParse.call(this);
            }
            if (isStrict) {
              return this._monthsStrictRegex;
            } else {
              return this._monthsRegex;
            }
          } else {
            if (!hasOwnProp(this, "_monthsRegex")) {
              this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ? this._monthsStrictRegex : this._monthsRegex;
          }
        }
        function computeMonthsParse() {
          function cmpLenRev(a, b) {
            return b.length - a.length;
          }
          var shortPieces = [], longPieces = [], mixedPieces = [], i, mom, shortP, longP;
          for (i = 0; i < 12; i++) {
            mom = createUTC([2e3, i]);
            shortP = regexEscape(this.monthsShort(mom, ""));
            longP = regexEscape(this.months(mom, ""));
            shortPieces.push(shortP);
            longPieces.push(longP);
            mixedPieces.push(longP);
            mixedPieces.push(shortP);
          }
          shortPieces.sort(cmpLenRev);
          longPieces.sort(cmpLenRev);
          mixedPieces.sort(cmpLenRev);
          this._monthsRegex = new RegExp("^(" + mixedPieces.join("|") + ")", "i");
          this._monthsShortRegex = this._monthsRegex;
          this._monthsStrictRegex = new RegExp(
            "^(" + longPieces.join("|") + ")",
            "i"
          );
          this._monthsShortStrictRegex = new RegExp(
            "^(" + shortPieces.join("|") + ")",
            "i"
          );
        }
        function createDate(y, m, d, h, M2, s, ms) {
          var date;
          if (y < 100 && y >= 0) {
            date = new Date(y + 400, m, d, h, M2, s, ms);
            if (isFinite(date.getFullYear())) {
              date.setFullYear(y);
            }
          } else {
            date = new Date(y, m, d, h, M2, s, ms);
          }
          return date;
        }
        function createUTCDate(y) {
          var date, args;
          if (y < 100 && y >= 0) {
            args = Array.prototype.slice.call(arguments);
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
              date.setUTCFullYear(y);
            }
          } else {
            date = new Date(Date.UTC.apply(null, arguments));
          }
          return date;
        }
        function firstWeekOffset(year, dow, doy) {
          var fwd = 7 + dow - doy, fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;
          return -fwdlw + fwd - 1;
        }
        function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
          var localWeekday = (7 + weekday - dow) % 7, weekOffset = firstWeekOffset(year, dow, doy), dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset, resYear, resDayOfYear;
          if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
          } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
          } else {
            resYear = year;
            resDayOfYear = dayOfYear;
          }
          return {
            year: resYear,
            dayOfYear: resDayOfYear
          };
        }
        function weekOfYear(mom, dow, doy) {
          var weekOffset = firstWeekOffset(mom.year(), dow, doy), week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1, resWeek, resYear;
          if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
          } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
          } else {
            resYear = mom.year();
            resWeek = week;
          }
          return {
            week: resWeek,
            year: resYear
          };
        }
        function weeksInYear(year, dow, doy) {
          var weekOffset = firstWeekOffset(year, dow, doy), weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
          return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
        }
        addFormatToken("w", ["ww", 2], "wo", "week");
        addFormatToken("W", ["WW", 2], "Wo", "isoWeek");
        addRegexToken("w", match1to2, match1to2NoLeadingZero);
        addRegexToken("ww", match1to2, match2);
        addRegexToken("W", match1to2, match1to2NoLeadingZero);
        addRegexToken("WW", match1to2, match2);
        addWeekParseToken(
          ["w", "ww", "W", "WW"],
          function(input, week, config, token2) {
            week[token2.substr(0, 1)] = toInt(input);
          }
        );
        function localeWeek(mom) {
          return weekOfYear(mom, this._week.dow, this._week.doy).week;
        }
        var defaultLocaleWeek = {
          dow: 0,
          // Sunday is the first day of the week.
          doy: 6
          // The week that contains Jan 6th is the first week of the year.
        };
        function localeFirstDayOfWeek() {
          return this._week.dow;
        }
        function localeFirstDayOfYear() {
          return this._week.doy;
        }
        function getSetWeek(input) {
          var week = this.localeData().week(this);
          return input == null ? week : this.add((input - week) * 7, "d");
        }
        function getSetISOWeek(input) {
          var week = weekOfYear(this, 1, 4).week;
          return input == null ? week : this.add((input - week) * 7, "d");
        }
        addFormatToken("d", 0, "do", "day");
        addFormatToken("dd", 0, 0, function(format2) {
          return this.localeData().weekdaysMin(this, format2);
        });
        addFormatToken("ddd", 0, 0, function(format2) {
          return this.localeData().weekdaysShort(this, format2);
        });
        addFormatToken("dddd", 0, 0, function(format2) {
          return this.localeData().weekdays(this, format2);
        });
        addFormatToken("e", 0, 0, "weekday");
        addFormatToken("E", 0, 0, "isoWeekday");
        addRegexToken("d", match1to2);
        addRegexToken("e", match1to2);
        addRegexToken("E", match1to2);
        addRegexToken("dd", function(isStrict, locale2) {
          return locale2.weekdaysMinRegex(isStrict);
        });
        addRegexToken("ddd", function(isStrict, locale2) {
          return locale2.weekdaysShortRegex(isStrict);
        });
        addRegexToken("dddd", function(isStrict, locale2) {
          return locale2.weekdaysRegex(isStrict);
        });
        addWeekParseToken(["dd", "ddd", "dddd"], function(input, week, config, token2) {
          var weekday = config._locale.weekdaysParse(input, token2, config._strict);
          if (weekday != null) {
            week.d = weekday;
          } else {
            getParsingFlags(config).invalidWeekday = input;
          }
        });
        addWeekParseToken(["d", "e", "E"], function(input, week, config, token2) {
          week[token2] = toInt(input);
        });
        function parseWeekday(input, locale2) {
          if (typeof input !== "string") {
            return input;
          }
          if (!isNaN(input)) {
            return parseInt(input, 10);
          }
          input = locale2.weekdaysParse(input);
          if (typeof input === "number") {
            return input;
          }
          return null;
        }
        function parseIsoWeekday(input, locale2) {
          if (typeof input === "string") {
            return locale2.weekdaysParse(input) % 7 || 7;
          }
          return isNaN(input) ? null : input;
        }
        function shiftWeekdays(ws, n) {
          return ws.slice(n, 7).concat(ws.slice(0, n));
        }
        var defaultLocaleWeekdays = "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), defaultLocaleWeekdaysShort = "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"), defaultLocaleWeekdaysMin = "Su_Mo_Tu_We_Th_Fr_Sa".split("_"), defaultWeekdaysRegex = matchWord, defaultWeekdaysShortRegex = matchWord, defaultWeekdaysMinRegex = matchWord;
        function localeWeekdays(m, format2) {
          var weekdays = isArray(this._weekdays) ? this._weekdays : this._weekdays[m && m !== true && this._weekdays.isFormat.test(format2) ? "format" : "standalone"];
          return m === true ? shiftWeekdays(weekdays, this._week.dow) : m ? weekdays[m.day()] : weekdays;
        }
        function localeWeekdaysShort(m) {
          return m === true ? shiftWeekdays(this._weekdaysShort, this._week.dow) : m ? this._weekdaysShort[m.day()] : this._weekdaysShort;
        }
        function localeWeekdaysMin(m) {
          return m === true ? shiftWeekdays(this._weekdaysMin, this._week.dow) : m ? this._weekdaysMin[m.day()] : this._weekdaysMin;
        }
        function handleStrictParse$1(weekdayName, format2, strict) {
          var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
          if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];
            for (i = 0; i < 7; ++i) {
              mom = createUTC([2e3, 1]).day(i);
              this._minWeekdaysParse[i] = this.weekdaysMin(
                mom,
                ""
              ).toLocaleLowerCase();
              this._shortWeekdaysParse[i] = this.weekdaysShort(
                mom,
                ""
              ).toLocaleLowerCase();
              this._weekdaysParse[i] = this.weekdays(mom, "").toLocaleLowerCase();
            }
          }
          if (strict) {
            if (format2 === "dddd") {
              ii = indexOf.call(this._weekdaysParse, llc);
              return ii !== -1 ? ii : null;
            } else if (format2 === "ddd") {
              ii = indexOf.call(this._shortWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            } else {
              ii = indexOf.call(this._minWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            }
          } else {
            if (format2 === "dddd") {
              ii = indexOf.call(this._weekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._shortWeekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._minWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            } else if (format2 === "ddd") {
              ii = indexOf.call(this._shortWeekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._weekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._minWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            } else {
              ii = indexOf.call(this._minWeekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._weekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._shortWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            }
          }
        }
        function localeWeekdaysParse(weekdayName, format2, strict) {
          var i, mom, regex;
          if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format2, strict);
          }
          if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
          }
          for (i = 0; i < 7; i++) {
            mom = createUTC([2e3, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
              this._fullWeekdaysParse[i] = new RegExp(
                "^" + this.weekdays(mom, "").replace(".", "\\.?") + "$",
                "i"
              );
              this._shortWeekdaysParse[i] = new RegExp(
                "^" + this.weekdaysShort(mom, "").replace(".", "\\.?") + "$",
                "i"
              );
              this._minWeekdaysParse[i] = new RegExp(
                "^" + this.weekdaysMin(mom, "").replace(".", "\\.?") + "$",
                "i"
              );
            }
            if (!this._weekdaysParse[i]) {
              regex = "^" + this.weekdays(mom, "") + "|^" + this.weekdaysShort(mom, "") + "|^" + this.weekdaysMin(mom, "");
              this._weekdaysParse[i] = new RegExp(regex.replace(".", ""), "i");
            }
            if (strict && format2 === "dddd" && this._fullWeekdaysParse[i].test(weekdayName)) {
              return i;
            } else if (strict && format2 === "ddd" && this._shortWeekdaysParse[i].test(weekdayName)) {
              return i;
            } else if (strict && format2 === "dd" && this._minWeekdaysParse[i].test(weekdayName)) {
              return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
              return i;
            }
          }
        }
        function getSetDayOfWeek(input) {
          if (!this.isValid()) {
            return input != null ? this : NaN;
          }
          var day = get(this, "Day");
          if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, "d");
          } else {
            return day;
          }
        }
        function getSetLocaleDayOfWeek(input) {
          if (!this.isValid()) {
            return input != null ? this : NaN;
          }
          var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
          return input == null ? weekday : this.add(input - weekday, "d");
        }
        function getSetISODayOfWeek(input) {
          if (!this.isValid()) {
            return input != null ? this : NaN;
          }
          if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
          } else {
            return this.day() || 7;
          }
        }
        function weekdaysRegex(isStrict) {
          if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, "_weekdaysRegex")) {
              computeWeekdaysParse.call(this);
            }
            if (isStrict) {
              return this._weekdaysStrictRegex;
            } else {
              return this._weekdaysRegex;
            }
          } else {
            if (!hasOwnProp(this, "_weekdaysRegex")) {
              this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ? this._weekdaysStrictRegex : this._weekdaysRegex;
          }
        }
        function weekdaysShortRegex(isStrict) {
          if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, "_weekdaysRegex")) {
              computeWeekdaysParse.call(this);
            }
            if (isStrict) {
              return this._weekdaysShortStrictRegex;
            } else {
              return this._weekdaysShortRegex;
            }
          } else {
            if (!hasOwnProp(this, "_weekdaysShortRegex")) {
              this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ? this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
          }
        }
        function weekdaysMinRegex(isStrict) {
          if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, "_weekdaysRegex")) {
              computeWeekdaysParse.call(this);
            }
            if (isStrict) {
              return this._weekdaysMinStrictRegex;
            } else {
              return this._weekdaysMinRegex;
            }
          } else {
            if (!hasOwnProp(this, "_weekdaysMinRegex")) {
              this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ? this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
          }
        }
        function computeWeekdaysParse() {
          function cmpLenRev(a, b) {
            return b.length - a.length;
          }
          var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [], i, mom, minp, shortp, longp;
          for (i = 0; i < 7; i++) {
            mom = createUTC([2e3, 1]).day(i);
            minp = regexEscape(this.weekdaysMin(mom, ""));
            shortp = regexEscape(this.weekdaysShort(mom, ""));
            longp = regexEscape(this.weekdays(mom, ""));
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
          }
          minPieces.sort(cmpLenRev);
          shortPieces.sort(cmpLenRev);
          longPieces.sort(cmpLenRev);
          mixedPieces.sort(cmpLenRev);
          this._weekdaysRegex = new RegExp("^(" + mixedPieces.join("|") + ")", "i");
          this._weekdaysShortRegex = this._weekdaysRegex;
          this._weekdaysMinRegex = this._weekdaysRegex;
          this._weekdaysStrictRegex = new RegExp(
            "^(" + longPieces.join("|") + ")",
            "i"
          );
          this._weekdaysShortStrictRegex = new RegExp(
            "^(" + shortPieces.join("|") + ")",
            "i"
          );
          this._weekdaysMinStrictRegex = new RegExp(
            "^(" + minPieces.join("|") + ")",
            "i"
          );
        }
        function hFormat() {
          return this.hours() % 12 || 12;
        }
        function kFormat() {
          return this.hours() || 24;
        }
        addFormatToken("H", ["HH", 2], 0, "hour");
        addFormatToken("h", ["hh", 2], 0, hFormat);
        addFormatToken("k", ["kk", 2], 0, kFormat);
        addFormatToken("hmm", 0, 0, function() {
          return "" + hFormat.apply(this) + zeroFill(this.minutes(), 2);
        });
        addFormatToken("hmmss", 0, 0, function() {
          return "" + hFormat.apply(this) + zeroFill(this.minutes(), 2) + zeroFill(this.seconds(), 2);
        });
        addFormatToken("Hmm", 0, 0, function() {
          return "" + this.hours() + zeroFill(this.minutes(), 2);
        });
        addFormatToken("Hmmss", 0, 0, function() {
          return "" + this.hours() + zeroFill(this.minutes(), 2) + zeroFill(this.seconds(), 2);
        });
        function meridiem(token2, lowercase) {
          addFormatToken(token2, 0, 0, function() {
            return this.localeData().meridiem(
              this.hours(),
              this.minutes(),
              lowercase
            );
          });
        }
        meridiem("a", true);
        meridiem("A", false);
        function matchMeridiem(isStrict, locale2) {
          return locale2._meridiemParse;
        }
        addRegexToken("a", matchMeridiem);
        addRegexToken("A", matchMeridiem);
        addRegexToken("H", match1to2, match1to2HasZero);
        addRegexToken("h", match1to2, match1to2NoLeadingZero);
        addRegexToken("k", match1to2, match1to2NoLeadingZero);
        addRegexToken("HH", match1to2, match2);
        addRegexToken("hh", match1to2, match2);
        addRegexToken("kk", match1to2, match2);
        addRegexToken("hmm", match3to4);
        addRegexToken("hmmss", match5to6);
        addRegexToken("Hmm", match3to4);
        addRegexToken("Hmmss", match5to6);
        addParseToken(["H", "HH"], HOUR);
        addParseToken(["k", "kk"], function(input, array, config) {
          var kInput = toInt(input);
          array[HOUR] = kInput === 24 ? 0 : kInput;
        });
        addParseToken(["a", "A"], function(input, array, config) {
          config._isPm = config._locale.isPM(input);
          config._meridiem = input;
        });
        addParseToken(["h", "hh"], function(input, array, config) {
          array[HOUR] = toInt(input);
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("hmm", function(input, array, config) {
          var pos = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos));
          array[MINUTE] = toInt(input.substr(pos));
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("hmmss", function(input, array, config) {
          var pos1 = input.length - 4, pos2 = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos1));
          array[MINUTE] = toInt(input.substr(pos1, 2));
          array[SECOND] = toInt(input.substr(pos2));
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("Hmm", function(input, array, config) {
          var pos = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos));
          array[MINUTE] = toInt(input.substr(pos));
        });
        addParseToken("Hmmss", function(input, array, config) {
          var pos1 = input.length - 4, pos2 = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos1));
          array[MINUTE] = toInt(input.substr(pos1, 2));
          array[SECOND] = toInt(input.substr(pos2));
        });
        function localeIsPM(input) {
          return (input + "").toLowerCase().charAt(0) === "p";
        }
        var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i, getSetHour = makeGetSet("Hours", true);
        function localeMeridiem(hours2, minutes2, isLower) {
          if (hours2 > 11) {
            return isLower ? "pm" : "PM";
          } else {
            return isLower ? "am" : "AM";
          }
        }
        var baseConfig = {
          calendar: defaultCalendar,
          longDateFormat: defaultLongDateFormat,
          invalidDate: defaultInvalidDate,
          ordinal: defaultOrdinal,
          dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
          relativeTime: defaultRelativeTime,
          months: defaultLocaleMonths,
          monthsShort: defaultLocaleMonthsShort,
          week: defaultLocaleWeek,
          weekdays: defaultLocaleWeekdays,
          weekdaysMin: defaultLocaleWeekdaysMin,
          weekdaysShort: defaultLocaleWeekdaysShort,
          meridiemParse: defaultLocaleMeridiemParse
        };
        var locales = {}, localeFamilies = {}, globalLocale;
        function commonPrefix(arr1, arr2) {
          var i, minl = Math.min(arr1.length, arr2.length);
          for (i = 0; i < minl; i += 1) {
            if (arr1[i] !== arr2[i]) {
              return i;
            }
          }
          return minl;
        }
        function normalizeLocale(key) {
          return key ? key.toLowerCase().replace("_", "-") : key;
        }
        function chooseLocale(names) {
          var i = 0, j, next, locale2, split;
          while (i < names.length) {
            split = normalizeLocale(names[i]).split("-");
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split("-") : null;
            while (j > 0) {
              locale2 = loadLocale(split.slice(0, j).join("-"));
              if (locale2) {
                return locale2;
              }
              if (next && next.length >= j && commonPrefix(split, next) >= j - 1) {
                break;
              }
              j--;
            }
            i++;
          }
          return globalLocale;
        }
        function isLocaleNameSane(name) {
          return !!(name && name.match("^[^/\\\\]*$"));
        }
        function loadLocale(name) {
          var oldLocale = null, aliasedRequire;
          if (locales[name] === void 0 && typeof module !== "undefined" && module && module.exports && isLocaleNameSane(name)) {
            try {
              oldLocale = globalLocale._abbr;
              aliasedRequire = __require;
              aliasedRequire("./locale/" + name);
              getSetGlobalLocale(oldLocale);
            } catch (e) {
              locales[name] = null;
            }
          }
          return locales[name];
        }
        function getSetGlobalLocale(key, values) {
          var data;
          if (key) {
            if (isUndefined(values)) {
              data = getLocale(key);
            } else {
              data = defineLocale(key, values);
            }
            if (data) {
              globalLocale = data;
            } else {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  "Locale " + key + " not found. Did you forget to load it?"
                );
              }
            }
          }
          return globalLocale._abbr;
        }
        function defineLocale(name, config) {
          if (config !== null) {
            var locale2, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
              deprecateSimple(
                "defineLocaleOverride",
                "use moment.updateLocale(localeName, config) to change an existing locale. moment.defineLocale(localeName, config) should only be used for creating a new locale See http://momentjs.com/guides/#/warnings/define-locale/ for more info."
              );
              parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
              if (locales[config.parentLocale] != null) {
                parentConfig = locales[config.parentLocale]._config;
              } else {
                locale2 = loadLocale(config.parentLocale);
                if (locale2 != null) {
                  parentConfig = locale2._config;
                } else {
                  if (!localeFamilies[config.parentLocale]) {
                    localeFamilies[config.parentLocale] = [];
                  }
                  localeFamilies[config.parentLocale].push({
                    name,
                    config
                  });
                  return null;
                }
              }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));
            if (localeFamilies[name]) {
              localeFamilies[name].forEach(function(x) {
                defineLocale(x.name, x.config);
              });
            }
            getSetGlobalLocale(name);
            return locales[name];
          } else {
            delete locales[name];
            return null;
          }
        }
        function updateLocale(name, config) {
          if (config != null) {
            var locale2, tmpLocale, parentConfig = baseConfig;
            if (locales[name] != null && locales[name].parentLocale != null) {
              locales[name].set(mergeConfigs(locales[name]._config, config));
            } else {
              tmpLocale = loadLocale(name);
              if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
              }
              config = mergeConfigs(parentConfig, config);
              if (tmpLocale == null) {
                config.abbr = name;
              }
              locale2 = new Locale(config);
              locale2.parentLocale = locales[name];
              locales[name] = locale2;
            }
            getSetGlobalLocale(name);
          } else {
            if (locales[name] != null) {
              if (locales[name].parentLocale != null) {
                locales[name] = locales[name].parentLocale;
                if (name === getSetGlobalLocale()) {
                  getSetGlobalLocale(name);
                }
              } else if (locales[name] != null) {
                delete locales[name];
              }
            }
          }
          return locales[name];
        }
        function getLocale(key) {
          var locale2;
          if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
          }
          if (!key) {
            return globalLocale;
          }
          if (!isArray(key)) {
            locale2 = loadLocale(key);
            if (locale2) {
              return locale2;
            }
            key = [key];
          }
          return chooseLocale(key);
        }
        function listLocales() {
          return keys(locales);
        }
        function checkOverflow(m) {
          var overflow, a = m._a;
          if (a && getParsingFlags(m).overflow === -2) {
            overflow = a[MONTH] < 0 || a[MONTH] > 11 ? MONTH : a[DATE] < 1 || a[DATE] > daysInMonth(a[YEAR], a[MONTH]) ? DATE : a[HOUR] < 0 || a[HOUR] > 24 || a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0) ? HOUR : a[MINUTE] < 0 || a[MINUTE] > 59 ? MINUTE : a[SECOND] < 0 || a[SECOND] > 59 ? SECOND : a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND : -1;
            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
              overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
              overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
              overflow = WEEKDAY;
            }
            getParsingFlags(m).overflow = overflow;
          }
          return m;
        }
        var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/, basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d|))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/, tzRegex = /Z|[+-]\d\d(?::?\d\d)?/, isoDates = [
          ["YYYYYY-MM-DD", /[+-]\d{6}-\d\d-\d\d/],
          ["YYYY-MM-DD", /\d{4}-\d\d-\d\d/],
          ["GGGG-[W]WW-E", /\d{4}-W\d\d-\d/],
          ["GGGG-[W]WW", /\d{4}-W\d\d/, false],
          ["YYYY-DDD", /\d{4}-\d{3}/],
          ["YYYY-MM", /\d{4}-\d\d/, false],
          ["YYYYYYMMDD", /[+-]\d{10}/],
          ["YYYYMMDD", /\d{8}/],
          ["GGGG[W]WWE", /\d{4}W\d{3}/],
          ["GGGG[W]WW", /\d{4}W\d{2}/, false],
          ["YYYYDDD", /\d{7}/],
          ["YYYYMM", /\d{6}/, false],
          ["YYYY", /\d{4}/, false]
        ], isoTimes = [
          ["HH:mm:ss.SSSS", /\d\d:\d\d:\d\d\.\d+/],
          ["HH:mm:ss,SSSS", /\d\d:\d\d:\d\d,\d+/],
          ["HH:mm:ss", /\d\d:\d\d:\d\d/],
          ["HH:mm", /\d\d:\d\d/],
          ["HHmmss.SSSS", /\d\d\d\d\d\d\.\d+/],
          ["HHmmss,SSSS", /\d\d\d\d\d\d,\d+/],
          ["HHmmss", /\d\d\d\d\d\d/],
          ["HHmm", /\d\d\d\d/],
          ["HH", /\d\d/]
        ], aspNetJsonRegex = /^\/?Date\((-?\d+)/i, rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/, obsOffsets = {
          UT: 0,
          GMT: 0,
          EDT: -4 * 60,
          EST: -5 * 60,
          CDT: -5 * 60,
          CST: -6 * 60,
          MDT: -6 * 60,
          MST: -7 * 60,
          PDT: -7 * 60,
          PST: -8 * 60
        };
        function configFromISO(config) {
          var i, l, string = config._i, match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string), allowTime, dateFormat, timeFormat, tzFormat, isoDatesLen = isoDates.length, isoTimesLen = isoTimes.length;
          if (match) {
            getParsingFlags(config).iso = true;
            for (i = 0, l = isoDatesLen; i < l; i++) {
              if (isoDates[i][1].exec(match[1])) {
                dateFormat = isoDates[i][0];
                allowTime = isoDates[i][2] !== false;
                break;
              }
            }
            if (dateFormat == null) {
              config._isValid = false;
              return;
            }
            if (match[3]) {
              for (i = 0, l = isoTimesLen; i < l; i++) {
                if (isoTimes[i][1].exec(match[3])) {
                  timeFormat = (match[2] || " ") + isoTimes[i][0];
                  break;
                }
              }
              if (timeFormat == null) {
                config._isValid = false;
                return;
              }
            }
            if (!allowTime && timeFormat != null) {
              config._isValid = false;
              return;
            }
            if (match[4]) {
              if (tzRegex.exec(match[4])) {
                tzFormat = "Z";
              } else {
                config._isValid = false;
                return;
              }
            }
            config._f = dateFormat + (timeFormat || "") + (tzFormat || "");
            configFromStringAndFormat(config);
          } else {
            config._isValid = false;
          }
        }
        function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
          var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
          ];
          if (secondStr) {
            result.push(parseInt(secondStr, 10));
          }
          return result;
        }
        function untruncateYear(yearStr) {
          var year = parseInt(yearStr, 10);
          if (year <= 49) {
            return 2e3 + year;
          } else if (year <= 999) {
            return 1900 + year;
          }
          return year;
        }
        function preprocessRFC2822(s) {
          return s.replace(/\([^()]*\)|[\n\t]/g, " ").replace(/(\s\s+)/g, " ").replace(/^\s\s*/, "").replace(/\s\s*$/, "");
        }
        function checkWeekday(weekdayStr, parsedInput, config) {
          if (weekdayStr) {
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr), weekdayActual = new Date(
              parsedInput[0],
              parsedInput[1],
              parsedInput[2]
            ).getDay();
            if (weekdayProvided !== weekdayActual) {
              getParsingFlags(config).weekdayMismatch = true;
              config._isValid = false;
              return false;
            }
          }
          return true;
        }
        function calculateOffset(obsOffset, militaryOffset, numOffset) {
          if (obsOffset) {
            return obsOffsets[obsOffset];
          } else if (militaryOffset) {
            return 0;
          } else {
            var hm = parseInt(numOffset, 10), m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
          }
        }
        function configFromRFC2822(config) {
          var match = rfc2822.exec(preprocessRFC2822(config._i)), parsedArray;
          if (match) {
            parsedArray = extractFromRFC2822Strings(
              match[4],
              match[3],
              match[2],
              match[5],
              match[6],
              match[7]
            );
            if (!checkWeekday(match[1], parsedArray, config)) {
              return;
            }
            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);
            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
            getParsingFlags(config).rfc2822 = true;
          } else {
            config._isValid = false;
          }
        }
        function configFromString(config) {
          var matched = aspNetJsonRegex.exec(config._i);
          if (matched !== null) {
            config._d = /* @__PURE__ */ new Date(+matched[1]);
            return;
          }
          configFromISO(config);
          if (config._isValid === false) {
            delete config._isValid;
          } else {
            return;
          }
          configFromRFC2822(config);
          if (config._isValid === false) {
            delete config._isValid;
          } else {
            return;
          }
          if (config._strict) {
            config._isValid = false;
          } else {
            hooks.createFromInputFallback(config);
          }
        }
        hooks.createFromInputFallback = deprecate(
          "value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are discouraged. Please refer to http://momentjs.com/guides/#/warnings/js-date/ for more info.",
          function(config) {
            config._d = /* @__PURE__ */ new Date(config._i + (config._useUTC ? " UTC" : ""));
          }
        );
        function defaults(a, b, c) {
          if (a != null) {
            return a;
          }
          if (b != null) {
            return b;
          }
          return c;
        }
        function currentDateArray(config) {
          var nowValue = new Date(hooks.now());
          if (config._useUTC) {
            return [
              nowValue.getUTCFullYear(),
              nowValue.getUTCMonth(),
              nowValue.getUTCDate()
            ];
          }
          return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
        }
        function configFromArray(config) {
          var i, date, input = [], currentDate, expectedWeekday, yearToUse;
          if (config._d) {
            return;
          }
          currentDate = currentDateArray(config);
          if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
          }
          if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);
            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
              getParsingFlags(config)._overflowDayOfYear = true;
            }
            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
          }
          for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
          }
          for (; i < 7; i++) {
            config._a[i] = input[i] = config._a[i] == null ? i === 2 ? 1 : 0 : config._a[i];
          }
          if (config._a[HOUR] === 24 && config._a[MINUTE] === 0 && config._a[SECOND] === 0 && config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
          }
          config._d = (config._useUTC ? createUTCDate : createDate).apply(
            null,
            input
          );
          expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();
          if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
          }
          if (config._nextDay) {
            config._a[HOUR] = 24;
          }
          if (config._w && typeof config._w.d !== "undefined" && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
          }
        }
        function dayOfYearFromWeekInfo(config) {
          var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow, curWeek;
          w = config._w;
          if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;
            weekYear = defaults(
              w.GG,
              config._a[YEAR],
              weekOfYear(createLocal(), 1, 4).year
            );
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
              weekdayOverflow = true;
            }
          } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;
            curWeek = weekOfYear(createLocal(), dow, doy);
            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);
            week = defaults(w.w, curWeek.week);
            if (w.d != null) {
              weekday = w.d;
              if (weekday < 0 || weekday > 6) {
                weekdayOverflow = true;
              }
            } else if (w.e != null) {
              weekday = w.e + dow;
              if (w.e < 0 || w.e > 6) {
                weekdayOverflow = true;
              }
            } else {
              weekday = dow;
            }
          }
          if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
          } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
          } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
          }
        }
        hooks.ISO_8601 = function() {
        };
        hooks.RFC_2822 = function() {
        };
        function configFromStringAndFormat(config) {
          if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
          }
          if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
          }
          config._a = [];
          getParsingFlags(config).empty = true;
          var string = "" + config._i, i, parsedInput, tokens2, token2, skipped, stringLength = string.length, totalParsedInputLength = 0, era, tokenLen;
          tokens2 = expandFormat(config._f, config._locale).match(formattingTokens) || [];
          tokenLen = tokens2.length;
          for (i = 0; i < tokenLen; i++) {
            token2 = tokens2[i];
            parsedInput = (string.match(getParseRegexForToken(token2, config)) || [])[0];
            if (parsedInput) {
              skipped = string.substr(0, string.indexOf(parsedInput));
              if (skipped.length > 0) {
                getParsingFlags(config).unusedInput.push(skipped);
              }
              string = string.slice(
                string.indexOf(parsedInput) + parsedInput.length
              );
              totalParsedInputLength += parsedInput.length;
            }
            if (formatTokenFunctions[token2]) {
              if (parsedInput) {
                getParsingFlags(config).empty = false;
              } else {
                getParsingFlags(config).unusedTokens.push(token2);
              }
              addTimeToArrayFromToken(token2, parsedInput, config);
            } else if (config._strict && !parsedInput) {
              getParsingFlags(config).unusedTokens.push(token2);
            }
          }
          getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
          if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
          }
          if (config._a[HOUR] <= 12 && getParsingFlags(config).bigHour === true && config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = void 0;
          }
          getParsingFlags(config).parsedDateParts = config._a.slice(0);
          getParsingFlags(config).meridiem = config._meridiem;
          config._a[HOUR] = meridiemFixWrap(
            config._locale,
            config._a[HOUR],
            config._meridiem
          );
          era = getParsingFlags(config).era;
          if (era !== null) {
            config._a[YEAR] = config._locale.erasConvertYear(era, config._a[YEAR]);
          }
          configFromArray(config);
          checkOverflow(config);
        }
        function meridiemFixWrap(locale2, hour, meridiem2) {
          var isPm;
          if (meridiem2 == null) {
            return hour;
          }
          if (locale2.meridiemHour != null) {
            return locale2.meridiemHour(hour, meridiem2);
          } else if (locale2.isPM != null) {
            isPm = locale2.isPM(meridiem2);
            if (isPm && hour < 12) {
              hour += 12;
            }
            if (!isPm && hour === 12) {
              hour = 0;
            }
            return hour;
          } else {
            return hour;
          }
        }
        function configFromStringAndArray(config) {
          var tempConfig, bestMoment, scoreToBeat, i, currentScore, validFormatFound, bestFormatIsValid = false, configfLen = config._f.length;
          if (configfLen === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = /* @__PURE__ */ new Date(NaN);
            return;
          }
          for (i = 0; i < configfLen; i++) {
            currentScore = 0;
            validFormatFound = false;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
              tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);
            if (isValid(tempConfig)) {
              validFormatFound = true;
            }
            currentScore += getParsingFlags(tempConfig).charsLeftOver;
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;
            getParsingFlags(tempConfig).score = currentScore;
            if (!bestFormatIsValid) {
              if (scoreToBeat == null || currentScore < scoreToBeat || validFormatFound) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
                if (validFormatFound) {
                  bestFormatIsValid = true;
                }
              }
            } else {
              if (currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
              }
            }
          }
          extend(config, bestMoment || tempConfig);
        }
        function configFromObject(config) {
          if (config._d) {
            return;
          }
          var i = normalizeObjectUnits(config._i), dayOrDate = i.day === void 0 ? i.date : i.day;
          config._a = map(
            [i.year, i.month, dayOrDate, i.hour, i.minute, i.second, i.millisecond],
            function(obj) {
              return obj && parseInt(obj, 10);
            }
          );
          configFromArray(config);
        }
        function createFromConfig(config) {
          var res = new Moment(checkOverflow(prepareConfig(config)));
          if (res._nextDay) {
            res.add(1, "d");
            res._nextDay = void 0;
          }
          return res;
        }
        function prepareConfig(config) {
          var input = config._i, format2 = config._f;
          config._locale = config._locale || getLocale(config._l);
          if (input === null || format2 === void 0 && input === "") {
            return createInvalid({ nullInput: true });
          }
          if (typeof input === "string") {
            config._i = input = config._locale.preparse(input);
          }
          if (isMoment(input)) {
            return new Moment(checkOverflow(input));
          } else if (isDate(input)) {
            config._d = input;
          } else if (isArray(format2)) {
            configFromStringAndArray(config);
          } else if (format2) {
            configFromStringAndFormat(config);
          } else {
            configFromInput(config);
          }
          if (!isValid(config)) {
            config._d = null;
          }
          return config;
        }
        function configFromInput(config) {
          var input = config._i;
          if (isUndefined(input)) {
            config._d = new Date(hooks.now());
          } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
          } else if (typeof input === "string") {
            configFromString(config);
          } else if (isArray(input)) {
            config._a = map(input.slice(0), function(obj) {
              return parseInt(obj, 10);
            });
            configFromArray(config);
          } else if (isObject(input)) {
            configFromObject(config);
          } else if (isNumber(input)) {
            config._d = new Date(input);
          } else {
            hooks.createFromInputFallback(config);
          }
        }
        function createLocalOrUTC(input, format2, locale2, strict, isUTC) {
          var c = {};
          if (format2 === true || format2 === false) {
            strict = format2;
            format2 = void 0;
          }
          if (locale2 === true || locale2 === false) {
            strict = locale2;
            locale2 = void 0;
          }
          if (isObject(input) && isObjectEmpty(input) || isArray(input) && input.length === 0) {
            input = void 0;
          }
          c._isAMomentObject = true;
          c._useUTC = c._isUTC = isUTC;
          c._l = locale2;
          c._i = input;
          c._f = format2;
          c._strict = strict;
          return createFromConfig(c);
        }
        function createLocal(input, format2, locale2, strict) {
          return createLocalOrUTC(input, format2, locale2, strict, false);
        }
        var prototypeMin = deprecate(
          "moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/",
          function() {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
              return other < this ? this : other;
            } else {
              return createInvalid();
            }
          }
        ), prototypeMax = deprecate(
          "moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/",
          function() {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
              return other > this ? this : other;
            } else {
              return createInvalid();
            }
          }
        );
        function pickBy(fn, moments) {
          var res, i;
          if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
          }
          if (!moments.length) {
            return createLocal();
          }
          res = moments[0];
          for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
              res = moments[i];
            }
          }
          return res;
        }
        function min() {
          var args = [].slice.call(arguments, 0);
          return pickBy("isBefore", args);
        }
        function max() {
          var args = [].slice.call(arguments, 0);
          return pickBy("isAfter", args);
        }
        var now = function() {
          return Date.now ? Date.now() : +/* @__PURE__ */ new Date();
        };
        var ordering = [
          "year",
          "quarter",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond"
        ];
        function isDurationValid(m) {
          var key, unitHasDecimal = false, i, orderLen = ordering.length;
          for (key in m) {
            if (hasOwnProp(m, key) && !(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
              return false;
            }
          }
          for (i = 0; i < orderLen; ++i) {
            if (m[ordering[i]]) {
              if (unitHasDecimal) {
                return false;
              }
              if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                unitHasDecimal = true;
              }
            }
          }
          return true;
        }
        function isValid$1() {
          return this._isValid;
        }
        function createInvalid$1() {
          return createDuration(NaN);
        }
        function Duration(duration) {
          var normalizedInput = normalizeObjectUnits(duration), years2 = normalizedInput.year || 0, quarters = normalizedInput.quarter || 0, months2 = normalizedInput.month || 0, weeks2 = normalizedInput.week || normalizedInput.isoWeek || 0, days2 = normalizedInput.day || 0, hours2 = normalizedInput.hour || 0, minutes2 = normalizedInput.minute || 0, seconds2 = normalizedInput.second || 0, milliseconds2 = normalizedInput.millisecond || 0;
          this._isValid = isDurationValid(normalizedInput);
          this._milliseconds = +milliseconds2 + seconds2 * 1e3 + // 1000
          minutes2 * 6e4 + // 1000 * 60
          hours2 * 1e3 * 60 * 60;
          this._days = +days2 + weeks2 * 7;
          this._months = +months2 + quarters * 3 + years2 * 12;
          this._data = {};
          this._locale = getLocale();
          this._bubble();
        }
        function isDuration(obj) {
          return obj instanceof Duration;
        }
        function absRound(number) {
          if (number < 0) {
            return Math.round(-1 * number) * -1;
          } else {
            return Math.round(number);
          }
        }
        function compareArrays(array1, array2, dontConvert) {
          var len = Math.min(array1.length, array2.length), lengthDiff = Math.abs(array1.length - array2.length), diffs = 0, i;
          for (i = 0; i < len; i++) {
            if (dontConvert && array1[i] !== array2[i] || !dontConvert && toInt(array1[i]) !== toInt(array2[i])) {
              diffs++;
            }
          }
          return diffs + lengthDiff;
        }
        function offset(token2, separator) {
          addFormatToken(token2, 0, 0, function() {
            var offset2 = this.utcOffset(), sign2 = "+";
            if (offset2 < 0) {
              offset2 = -offset2;
              sign2 = "-";
            }
            return sign2 + zeroFill(~~(offset2 / 60), 2) + separator + zeroFill(~~offset2 % 60, 2);
          });
        }
        offset("Z", ":");
        offset("ZZ", "");
        addRegexToken("Z", matchShortOffset);
        addRegexToken("ZZ", matchShortOffset);
        addParseToken(["Z", "ZZ"], function(input, array, config) {
          config._useUTC = true;
          config._tzm = offsetFromString(matchShortOffset, input);
        });
        var chunkOffset = /([\+\-]|\d\d)/gi;
        function offsetFromString(matcher, string) {
          var matches = (string || "").match(matcher), chunk, parts, minutes2;
          if (matches === null) {
            return null;
          }
          chunk = matches[matches.length - 1] || [];
          parts = (chunk + "").match(chunkOffset) || ["-", 0, 0];
          minutes2 = +(parts[1] * 60) + toInt(parts[2]);
          return minutes2 === 0 ? 0 : parts[0] === "+" ? minutes2 : -minutes2;
        }
        function cloneWithOffset(input, model) {
          var res, diff2;
          if (model._isUTC) {
            res = model.clone();
            diff2 = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            res._d.setTime(res._d.valueOf() + diff2);
            hooks.updateOffset(res, false);
            return res;
          } else {
            return createLocal(input).local();
          }
        }
        function getDateOffset(m) {
          return -Math.round(m._d.getTimezoneOffset());
        }
        hooks.updateOffset = function() {
        };
        function getSetOffset(input, keepLocalTime, keepMinutes) {
          var offset2 = this._offset || 0, localAdjust;
          if (!this.isValid()) {
            return input != null ? this : NaN;
          }
          if (input != null) {
            if (typeof input === "string") {
              input = offsetFromString(matchShortOffset, input);
              if (input === null) {
                return this;
              }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
              input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
              localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
              this.add(localAdjust, "m");
            }
            if (offset2 !== input) {
              if (!keepLocalTime || this._changeInProgress) {
                addSubtract(
                  this,
                  createDuration(input - offset2, "m"),
                  1,
                  false
                );
              } else if (!this._changeInProgress) {
                this._changeInProgress = true;
                hooks.updateOffset(this, true);
                this._changeInProgress = null;
              }
            }
            return this;
          } else {
            return this._isUTC ? offset2 : getDateOffset(this);
          }
        }
        function getSetZone(input, keepLocalTime) {
          if (input != null) {
            if (typeof input !== "string") {
              input = -input;
            }
            this.utcOffset(input, keepLocalTime);
            return this;
          } else {
            return -this.utcOffset();
          }
        }
        function setOffsetToUTC(keepLocalTime) {
          return this.utcOffset(0, keepLocalTime);
        }
        function setOffsetToLocal(keepLocalTime) {
          if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;
            if (keepLocalTime) {
              this.subtract(getDateOffset(this), "m");
            }
          }
          return this;
        }
        function setOffsetToParsedOffset() {
          if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
          } else if (typeof this._i === "string") {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
              this.utcOffset(tZone);
            } else {
              this.utcOffset(0, true);
            }
          }
          return this;
        }
        function hasAlignedHourOffset(input) {
          if (!this.isValid()) {
            return false;
          }
          input = input ? createLocal(input).utcOffset() : 0;
          return (this.utcOffset() - input) % 60 === 0;
        }
        function isDaylightSavingTime() {
          return this.utcOffset() > this.clone().month(0).utcOffset() || this.utcOffset() > this.clone().month(5).utcOffset();
        }
        function isDaylightSavingTimeShifted() {
          if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
          }
          var c = {}, other;
          copyConfig(c, this);
          c = prepareConfig(c);
          if (c._a) {
            other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() && compareArrays(c._a, other.toArray()) > 0;
          } else {
            this._isDSTShifted = false;
          }
          return this._isDSTShifted;
        }
        function isLocal() {
          return this.isValid() ? !this._isUTC : false;
        }
        function isUtcOffset() {
          return this.isValid() ? this._isUTC : false;
        }
        function isUtc() {
          return this.isValid() ? this._isUTC && this._offset === 0 : false;
        }
        var aspNetRegex = /^(-|\+)?(?:(\d*)[. ])?(\d+):(\d+)(?::(\d+)(\.\d*)?)?$/, isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;
        function createDuration(input, key) {
          var duration = input, match = null, sign2, ret, diffRes;
          if (isDuration(input)) {
            duration = {
              ms: input._milliseconds,
              d: input._days,
              M: input._months
            };
          } else if (isNumber(input) || !isNaN(+input)) {
            duration = {};
            if (key) {
              duration[key] = +input;
            } else {
              duration.milliseconds = +input;
            }
          } else if (match = aspNetRegex.exec(input)) {
            sign2 = match[1] === "-" ? -1 : 1;
            duration = {
              y: 0,
              d: toInt(match[DATE]) * sign2,
              h: toInt(match[HOUR]) * sign2,
              m: toInt(match[MINUTE]) * sign2,
              s: toInt(match[SECOND]) * sign2,
              ms: toInt(absRound(match[MILLISECOND] * 1e3)) * sign2
              // the millisecond decimal point is included in the match
            };
          } else if (match = isoRegex.exec(input)) {
            sign2 = match[1] === "-" ? -1 : 1;
            duration = {
              y: parseIso(match[2], sign2),
              M: parseIso(match[3], sign2),
              w: parseIso(match[4], sign2),
              d: parseIso(match[5], sign2),
              h: parseIso(match[6], sign2),
              m: parseIso(match[7], sign2),
              s: parseIso(match[8], sign2)
            };
          } else if (duration == null) {
            duration = {};
          } else if (typeof duration === "object" && ("from" in duration || "to" in duration)) {
            diffRes = momentsDifference(
              createLocal(duration.from),
              createLocal(duration.to)
            );
            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
          }
          ret = new Duration(duration);
          if (isDuration(input) && hasOwnProp(input, "_locale")) {
            ret._locale = input._locale;
          }
          if (isDuration(input) && hasOwnProp(input, "_isValid")) {
            ret._isValid = input._isValid;
          }
          return ret;
        }
        createDuration.fn = Duration.prototype;
        createDuration.invalid = createInvalid$1;
        function parseIso(inp, sign2) {
          var res = inp && parseFloat(inp.replace(",", "."));
          return (isNaN(res) ? 0 : res) * sign2;
        }
        function positiveMomentsDifference(base, other) {
          var res = {};
          res.months = other.month() - base.month() + (other.year() - base.year()) * 12;
          if (base.clone().add(res.months, "M").isAfter(other)) {
            --res.months;
          }
          res.milliseconds = +other - +base.clone().add(res.months, "M");
          return res;
        }
        function momentsDifference(base, other) {
          var res;
          if (!(base.isValid() && other.isValid())) {
            return { milliseconds: 0, months: 0 };
          }
          other = cloneWithOffset(other, base);
          if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
          } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
          }
          return res;
        }
        function createAdder(direction, name) {
          return function(val, period) {
            var dur, tmp;
            if (period !== null && !isNaN(+period)) {
              deprecateSimple(
                name,
                "moment()." + name + "(period, number) is deprecated. Please use moment()." + name + "(number, period). See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info."
              );
              tmp = val;
              val = period;
              period = tmp;
            }
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
          };
        }
        function addSubtract(mom, duration, isAdding, updateOffset) {
          var milliseconds2 = duration._milliseconds, days2 = absRound(duration._days), months2 = absRound(duration._months);
          if (!mom.isValid()) {
            return;
          }
          updateOffset = updateOffset == null ? true : updateOffset;
          if (months2) {
            setMonth(mom, get(mom, "Month") + months2 * isAdding);
          }
          if (days2) {
            set$1(mom, "Date", get(mom, "Date") + days2 * isAdding);
          }
          if (milliseconds2) {
            mom._d.setTime(mom._d.valueOf() + milliseconds2 * isAdding);
          }
          if (updateOffset) {
            hooks.updateOffset(mom, days2 || months2);
          }
        }
        var add = createAdder(1, "add"), subtract = createAdder(-1, "subtract");
        function isString(input) {
          return typeof input === "string" || input instanceof String;
        }
        function isMomentInput(input) {
          return isMoment(input) || isDate(input) || isString(input) || isNumber(input) || isNumberOrStringArray(input) || isMomentInputObject(input) || input === null || input === void 0;
        }
        function isMomentInputObject(input) {
          var objectTest = isObject(input) && !isObjectEmpty(input), propertyTest = false, properties = [
            "years",
            "year",
            "y",
            "months",
            "month",
            "M",
            "days",
            "day",
            "d",
            "dates",
            "date",
            "D",
            "hours",
            "hour",
            "h",
            "minutes",
            "minute",
            "m",
            "seconds",
            "second",
            "s",
            "milliseconds",
            "millisecond",
            "ms"
          ], i, property, propertyLen = properties.length;
          for (i = 0; i < propertyLen; i += 1) {
            property = properties[i];
            propertyTest = propertyTest || hasOwnProp(input, property);
          }
          return objectTest && propertyTest;
        }
        function isNumberOrStringArray(input) {
          var arrayTest = isArray(input), dataTypeTest = false;
          if (arrayTest) {
            dataTypeTest = input.filter(function(item) {
              return !isNumber(item) && isString(input);
            }).length === 0;
          }
          return arrayTest && dataTypeTest;
        }
        function isCalendarSpec(input) {
          var objectTest = isObject(input) && !isObjectEmpty(input), propertyTest = false, properties = [
            "sameDay",
            "nextDay",
            "lastDay",
            "nextWeek",
            "lastWeek",
            "sameElse"
          ], i, property;
          for (i = 0; i < properties.length; i += 1) {
            property = properties[i];
            propertyTest = propertyTest || hasOwnProp(input, property);
          }
          return objectTest && propertyTest;
        }
        function getCalendarFormat(myMoment, now2) {
          var diff2 = myMoment.diff(now2, "days", true);
          return diff2 < -6 ? "sameElse" : diff2 < -1 ? "lastWeek" : diff2 < 0 ? "lastDay" : diff2 < 1 ? "sameDay" : diff2 < 2 ? "nextDay" : diff2 < 7 ? "nextWeek" : "sameElse";
        }
        function calendar$1(time, formats) {
          if (arguments.length === 1) {
            if (!arguments[0]) {
              time = void 0;
              formats = void 0;
            } else if (isMomentInput(arguments[0])) {
              time = arguments[0];
              formats = void 0;
            } else if (isCalendarSpec(arguments[0])) {
              formats = arguments[0];
              time = void 0;
            }
          }
          var now2 = time || createLocal(), sod = cloneWithOffset(now2, this).startOf("day"), format2 = hooks.calendarFormat(this, sod) || "sameElse", output = formats && (isFunction(formats[format2]) ? formats[format2].call(this, now2) : formats[format2]);
          return this.format(
            output || this.localeData().calendar(format2, this, createLocal(now2))
          );
        }
        function clone() {
          return new Moment(this);
        }
        function isAfter(input, units) {
          var localInput = isMoment(input) ? input : createLocal(input);
          if (!(this.isValid() && localInput.isValid())) {
            return false;
          }
          units = normalizeUnits(units) || "millisecond";
          if (units === "millisecond") {
            return this.valueOf() > localInput.valueOf();
          } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
          }
        }
        function isBefore(input, units) {
          var localInput = isMoment(input) ? input : createLocal(input);
          if (!(this.isValid() && localInput.isValid())) {
            return false;
          }
          units = normalizeUnits(units) || "millisecond";
          if (units === "millisecond") {
            return this.valueOf() < localInput.valueOf();
          } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
          }
        }
        function isBetween(from2, to2, units, inclusivity) {
          var localFrom = isMoment(from2) ? from2 : createLocal(from2), localTo = isMoment(to2) ? to2 : createLocal(to2);
          if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
          }
          inclusivity = inclusivity || "()";
          return (inclusivity[0] === "(" ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) && (inclusivity[1] === ")" ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
        }
        function isSame(input, units) {
          var localInput = isMoment(input) ? input : createLocal(input), inputMs;
          if (!(this.isValid() && localInput.isValid())) {
            return false;
          }
          units = normalizeUnits(units) || "millisecond";
          if (units === "millisecond") {
            return this.valueOf() === localInput.valueOf();
          } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
          }
        }
        function isSameOrAfter(input, units) {
          return this.isSame(input, units) || this.isAfter(input, units);
        }
        function isSameOrBefore(input, units) {
          return this.isSame(input, units) || this.isBefore(input, units);
        }
        function diff(input, units, asFloat) {
          var that, zoneDelta, output;
          if (!this.isValid()) {
            return NaN;
          }
          that = cloneWithOffset(input, this);
          if (!that.isValid()) {
            return NaN;
          }
          zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;
          units = normalizeUnits(units);
          switch (units) {
            case "year":
              output = monthDiff(this, that) / 12;
              break;
            case "month":
              output = monthDiff(this, that);
              break;
            case "quarter":
              output = monthDiff(this, that) / 3;
              break;
            case "second":
              output = (this - that) / 1e3;
              break;
            case "minute":
              output = (this - that) / 6e4;
              break;
            case "hour":
              output = (this - that) / 36e5;
              break;
            case "day":
              output = (this - that - zoneDelta) / 864e5;
              break;
            case "week":
              output = (this - that - zoneDelta) / 6048e5;
              break;
            default:
              output = this - that;
          }
          return asFloat ? output : absFloor(output);
        }
        function monthDiff(a, b) {
          if (a.date() < b.date()) {
            return -monthDiff(b, a);
          }
          var wholeMonthDiff = (b.year() - a.year()) * 12 + (b.month() - a.month()), anchor = a.clone().add(wholeMonthDiff, "months"), anchor2, adjust;
          if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, "months");
            adjust = (b - anchor) / (anchor - anchor2);
          } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, "months");
            adjust = (b - anchor) / (anchor2 - anchor);
          }
          return -(wholeMonthDiff + adjust) || 0;
        }
        hooks.defaultFormat = "YYYY-MM-DDTHH:mm:ssZ";
        hooks.defaultFormatUtc = "YYYY-MM-DDTHH:mm:ss[Z]";
        function toString() {
          return this.clone().locale("en").format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
        }
        function toISOString(keepOffset) {
          if (!this.isValid()) {
            return null;
          }
          var utc = keepOffset !== true, m = utc ? this.clone().utc() : this;
          if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(
              m,
              utc ? "YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]" : "YYYYYY-MM-DD[T]HH:mm:ss.SSSZ"
            );
          }
          if (isFunction(Date.prototype.toISOString)) {
            if (utc) {
              return this.toDate().toISOString();
            } else {
              return new Date(this.valueOf() + this.utcOffset() * 60 * 1e3).toISOString().replace("Z", formatMoment(m, "Z"));
            }
          }
          return formatMoment(
            m,
            utc ? "YYYY-MM-DD[T]HH:mm:ss.SSS[Z]" : "YYYY-MM-DD[T]HH:mm:ss.SSSZ"
          );
        }
        function inspect() {
          if (!this.isValid()) {
            return "moment.invalid(/* " + this._i + " */)";
          }
          var func = "moment", zone = "", prefix, year, datetime, suffix;
          if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? "moment.utc" : "moment.parseZone";
            zone = "Z";
          }
          prefix = "[" + func + '("]';
          year = 0 <= this.year() && this.year() <= 9999 ? "YYYY" : "YYYYYY";
          datetime = "-MM-DD[T]HH:mm:ss.SSS";
          suffix = zone + '[")]';
          return this.format(prefix + year + datetime + suffix);
        }
        function format(inputString) {
          if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
          }
          var output = formatMoment(this, inputString);
          return this.localeData().postformat(output);
        }
        function from(time, withoutSuffix) {
          if (this.isValid() && (isMoment(time) && time.isValid() || createLocal(time).isValid())) {
            return createDuration({ to: this, from: time }).locale(this.locale()).humanize(!withoutSuffix);
          } else {
            return this.localeData().invalidDate();
          }
        }
        function fromNow(withoutSuffix) {
          return this.from(createLocal(), withoutSuffix);
        }
        function to(time, withoutSuffix) {
          if (this.isValid() && (isMoment(time) && time.isValid() || createLocal(time).isValid())) {
            return createDuration({ from: this, to: time }).locale(this.locale()).humanize(!withoutSuffix);
          } else {
            return this.localeData().invalidDate();
          }
        }
        function toNow(withoutSuffix) {
          return this.to(createLocal(), withoutSuffix);
        }
        function locale(key) {
          var newLocaleData;
          if (key === void 0) {
            return this._locale._abbr;
          } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
              this._locale = newLocaleData;
            }
            return this;
          }
        }
        var lang = deprecate(
          "moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.",
          function(key) {
            if (key === void 0) {
              return this.localeData();
            } else {
              return this.locale(key);
            }
          }
        );
        function localeData() {
          return this._locale;
        }
        var MS_PER_SECOND = 1e3, MS_PER_MINUTE = 60 * MS_PER_SECOND, MS_PER_HOUR = 60 * MS_PER_MINUTE, MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;
        function mod$1(dividend, divisor) {
          return (dividend % divisor + divisor) % divisor;
        }
        function localStartOfDate(y, m, d) {
          if (y < 100 && y >= 0) {
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
          } else {
            return new Date(y, m, d).valueOf();
          }
        }
        function utcStartOfDate(y, m, d) {
          if (y < 100 && y >= 0) {
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
          } else {
            return Date.UTC(y, m, d);
          }
        }
        function startOf(units) {
          var time, startOfDate;
          units = normalizeUnits(units);
          if (units === void 0 || units === "millisecond" || !this.isValid()) {
            return this;
          }
          startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;
          switch (units) {
            case "year":
              time = startOfDate(this.year(), 0, 1);
              break;
            case "quarter":
              time = startOfDate(
                this.year(),
                this.month() - this.month() % 3,
                1
              );
              break;
            case "month":
              time = startOfDate(this.year(), this.month(), 1);
              break;
            case "week":
              time = startOfDate(
                this.year(),
                this.month(),
                this.date() - this.weekday()
              );
              break;
            case "isoWeek":
              time = startOfDate(
                this.year(),
                this.month(),
                this.date() - (this.isoWeekday() - 1)
              );
              break;
            case "day":
            case "date":
              time = startOfDate(this.year(), this.month(), this.date());
              break;
            case "hour":
              time = this._d.valueOf();
              time -= mod$1(
                time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE),
                MS_PER_HOUR
              );
              break;
            case "minute":
              time = this._d.valueOf();
              time -= mod$1(time, MS_PER_MINUTE);
              break;
            case "second":
              time = this._d.valueOf();
              time -= mod$1(time, MS_PER_SECOND);
              break;
          }
          this._d.setTime(time);
          hooks.updateOffset(this, true);
          return this;
        }
        function endOf(units) {
          var time, startOfDate;
          units = normalizeUnits(units);
          if (units === void 0 || units === "millisecond" || !this.isValid()) {
            return this;
          }
          startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;
          switch (units) {
            case "year":
              time = startOfDate(this.year() + 1, 0, 1) - 1;
              break;
            case "quarter":
              time = startOfDate(
                this.year(),
                this.month() - this.month() % 3 + 3,
                1
              ) - 1;
              break;
            case "month":
              time = startOfDate(this.year(), this.month() + 1, 1) - 1;
              break;
            case "week":
              time = startOfDate(
                this.year(),
                this.month(),
                this.date() - this.weekday() + 7
              ) - 1;
              break;
            case "isoWeek":
              time = startOfDate(
                this.year(),
                this.month(),
                this.date() - (this.isoWeekday() - 1) + 7
              ) - 1;
              break;
            case "day":
            case "date":
              time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
              break;
            case "hour":
              time = this._d.valueOf();
              time += MS_PER_HOUR - mod$1(
                time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE),
                MS_PER_HOUR
              ) - 1;
              break;
            case "minute":
              time = this._d.valueOf();
              time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
              break;
            case "second":
              time = this._d.valueOf();
              time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
              break;
          }
          this._d.setTime(time);
          hooks.updateOffset(this, true);
          return this;
        }
        function valueOf() {
          return this._d.valueOf() - (this._offset || 0) * 6e4;
        }
        function unix() {
          return Math.floor(this.valueOf() / 1e3);
        }
        function toDate() {
          return new Date(this.valueOf());
        }
        function toArray() {
          var m = this;
          return [
            m.year(),
            m.month(),
            m.date(),
            m.hour(),
            m.minute(),
            m.second(),
            m.millisecond()
          ];
        }
        function toObject() {
          var m = this;
          return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
          };
        }
        function toJSON() {
          return this.isValid() ? this.toISOString() : null;
        }
        function isValid$2() {
          return isValid(this);
        }
        function parsingFlags() {
          return extend({}, getParsingFlags(this));
        }
        function invalidAt() {
          return getParsingFlags(this).overflow;
        }
        function creationData() {
          return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
          };
        }
        addFormatToken("N", 0, 0, "eraAbbr");
        addFormatToken("NN", 0, 0, "eraAbbr");
        addFormatToken("NNN", 0, 0, "eraAbbr");
        addFormatToken("NNNN", 0, 0, "eraName");
        addFormatToken("NNNNN", 0, 0, "eraNarrow");
        addFormatToken("y", ["y", 1], "yo", "eraYear");
        addFormatToken("y", ["yy", 2], 0, "eraYear");
        addFormatToken("y", ["yyy", 3], 0, "eraYear");
        addFormatToken("y", ["yyyy", 4], 0, "eraYear");
        addRegexToken("N", matchEraAbbr);
        addRegexToken("NN", matchEraAbbr);
        addRegexToken("NNN", matchEraAbbr);
        addRegexToken("NNNN", matchEraName);
        addRegexToken("NNNNN", matchEraNarrow);
        addParseToken(
          ["N", "NN", "NNN", "NNNN", "NNNNN"],
          function(input, array, config, token2) {
            var era = config._locale.erasParse(input, token2, config._strict);
            if (era) {
              getParsingFlags(config).era = era;
            } else {
              getParsingFlags(config).invalidEra = input;
            }
          }
        );
        addRegexToken("y", matchUnsigned);
        addRegexToken("yy", matchUnsigned);
        addRegexToken("yyy", matchUnsigned);
        addRegexToken("yyyy", matchUnsigned);
        addRegexToken("yo", matchEraYearOrdinal);
        addParseToken(["y", "yy", "yyy", "yyyy"], YEAR);
        addParseToken(["yo"], function(input, array, config, token2) {
          var match;
          if (config._locale._eraYearOrdinalRegex) {
            match = input.match(config._locale._eraYearOrdinalRegex);
          }
          if (config._locale.eraYearOrdinalParse) {
            array[YEAR] = config._locale.eraYearOrdinalParse(input, match);
          } else {
            array[YEAR] = parseInt(input, 10);
          }
        });
        function localeEras(m, format2) {
          var i, l, date, eras = this._eras || getLocale("en")._eras;
          for (i = 0, l = eras.length; i < l; ++i) {
            switch (typeof eras[i].since) {
              case "string":
                date = hooks(eras[i].since).startOf("day");
                eras[i].since = date.valueOf();
                break;
            }
            switch (typeof eras[i].until) {
              case "undefined":
                eras[i].until = Infinity;
                break;
              case "string":
                date = hooks(eras[i].until).startOf("day").valueOf();
                eras[i].until = date.valueOf();
                break;
            }
          }
          return eras;
        }
        function localeErasParse(eraName, format2, strict) {
          var i, l, eras = this.eras(), name, abbr, narrow;
          eraName = eraName.toUpperCase();
          for (i = 0, l = eras.length; i < l; ++i) {
            name = eras[i].name.toUpperCase();
            abbr = eras[i].abbr.toUpperCase();
            narrow = eras[i].narrow.toUpperCase();
            if (strict) {
              switch (format2) {
                case "N":
                case "NN":
                case "NNN":
                  if (abbr === eraName) {
                    return eras[i];
                  }
                  break;
                case "NNNN":
                  if (name === eraName) {
                    return eras[i];
                  }
                  break;
                case "NNNNN":
                  if (narrow === eraName) {
                    return eras[i];
                  }
                  break;
              }
            } else if ([name, abbr, narrow].indexOf(eraName) >= 0) {
              return eras[i];
            }
          }
        }
        function localeErasConvertYear(era, year) {
          var dir = era.since <= era.until ? 1 : -1;
          if (year === void 0) {
            return hooks(era.since).year();
          } else {
            return hooks(era.since).year() + (year - era.offset) * dir;
          }
        }
        function getEraName() {
          var i, l, val, eras = this.localeData().eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            val = this.clone().startOf("day").valueOf();
            if (eras[i].since <= val && val <= eras[i].until) {
              return eras[i].name;
            }
            if (eras[i].until <= val && val <= eras[i].since) {
              return eras[i].name;
            }
          }
          return "";
        }
        function getEraNarrow() {
          var i, l, val, eras = this.localeData().eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            val = this.clone().startOf("day").valueOf();
            if (eras[i].since <= val && val <= eras[i].until) {
              return eras[i].narrow;
            }
            if (eras[i].until <= val && val <= eras[i].since) {
              return eras[i].narrow;
            }
          }
          return "";
        }
        function getEraAbbr() {
          var i, l, val, eras = this.localeData().eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            val = this.clone().startOf("day").valueOf();
            if (eras[i].since <= val && val <= eras[i].until) {
              return eras[i].abbr;
            }
            if (eras[i].until <= val && val <= eras[i].since) {
              return eras[i].abbr;
            }
          }
          return "";
        }
        function getEraYear() {
          var i, l, dir, val, eras = this.localeData().eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            dir = eras[i].since <= eras[i].until ? 1 : -1;
            val = this.clone().startOf("day").valueOf();
            if (eras[i].since <= val && val <= eras[i].until || eras[i].until <= val && val <= eras[i].since) {
              return (this.year() - hooks(eras[i].since).year()) * dir + eras[i].offset;
            }
          }
          return this.year();
        }
        function erasNameRegex(isStrict) {
          if (!hasOwnProp(this, "_erasNameRegex")) {
            computeErasParse.call(this);
          }
          return isStrict ? this._erasNameRegex : this._erasRegex;
        }
        function erasAbbrRegex(isStrict) {
          if (!hasOwnProp(this, "_erasAbbrRegex")) {
            computeErasParse.call(this);
          }
          return isStrict ? this._erasAbbrRegex : this._erasRegex;
        }
        function erasNarrowRegex(isStrict) {
          if (!hasOwnProp(this, "_erasNarrowRegex")) {
            computeErasParse.call(this);
          }
          return isStrict ? this._erasNarrowRegex : this._erasRegex;
        }
        function matchEraAbbr(isStrict, locale2) {
          return locale2.erasAbbrRegex(isStrict);
        }
        function matchEraName(isStrict, locale2) {
          return locale2.erasNameRegex(isStrict);
        }
        function matchEraNarrow(isStrict, locale2) {
          return locale2.erasNarrowRegex(isStrict);
        }
        function matchEraYearOrdinal(isStrict, locale2) {
          return locale2._eraYearOrdinalRegex || matchUnsigned;
        }
        function computeErasParse() {
          var abbrPieces = [], namePieces = [], narrowPieces = [], mixedPieces = [], i, l, erasName, erasAbbr, erasNarrow, eras = this.eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            erasName = regexEscape(eras[i].name);
            erasAbbr = regexEscape(eras[i].abbr);
            erasNarrow = regexEscape(eras[i].narrow);
            namePieces.push(erasName);
            abbrPieces.push(erasAbbr);
            narrowPieces.push(erasNarrow);
            mixedPieces.push(erasName);
            mixedPieces.push(erasAbbr);
            mixedPieces.push(erasNarrow);
          }
          this._erasRegex = new RegExp("^(" + mixedPieces.join("|") + ")", "i");
          this._erasNameRegex = new RegExp("^(" + namePieces.join("|") + ")", "i");
          this._erasAbbrRegex = new RegExp("^(" + abbrPieces.join("|") + ")", "i");
          this._erasNarrowRegex = new RegExp(
            "^(" + narrowPieces.join("|") + ")",
            "i"
          );
        }
        addFormatToken(0, ["gg", 2], 0, function() {
          return this.weekYear() % 100;
        });
        addFormatToken(0, ["GG", 2], 0, function() {
          return this.isoWeekYear() % 100;
        });
        function addWeekYearFormatToken(token2, getter) {
          addFormatToken(0, [token2, token2.length], 0, getter);
        }
        addWeekYearFormatToken("gggg", "weekYear");
        addWeekYearFormatToken("ggggg", "weekYear");
        addWeekYearFormatToken("GGGG", "isoWeekYear");
        addWeekYearFormatToken("GGGGG", "isoWeekYear");
        addRegexToken("G", matchSigned);
        addRegexToken("g", matchSigned);
        addRegexToken("GG", match1to2, match2);
        addRegexToken("gg", match1to2, match2);
        addRegexToken("GGGG", match1to4, match4);
        addRegexToken("gggg", match1to4, match4);
        addRegexToken("GGGGG", match1to6, match6);
        addRegexToken("ggggg", match1to6, match6);
        addWeekParseToken(
          ["gggg", "ggggg", "GGGG", "GGGGG"],
          function(input, week, config, token2) {
            week[token2.substr(0, 2)] = toInt(input);
          }
        );
        addWeekParseToken(["gg", "GG"], function(input, week, config, token2) {
          week[token2] = hooks.parseTwoDigitYear(input);
        });
        function getSetWeekYear(input) {
          return getSetWeekYearHelper.call(
            this,
            input,
            this.week(),
            this.weekday() + this.localeData()._week.dow,
            this.localeData()._week.dow,
            this.localeData()._week.doy
          );
        }
        function getSetISOWeekYear(input) {
          return getSetWeekYearHelper.call(
            this,
            input,
            this.isoWeek(),
            this.isoWeekday(),
            1,
            4
          );
        }
        function getISOWeeksInYear() {
          return weeksInYear(this.year(), 1, 4);
        }
        function getISOWeeksInISOWeekYear() {
          return weeksInYear(this.isoWeekYear(), 1, 4);
        }
        function getWeeksInYear() {
          var weekInfo = this.localeData()._week;
          return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        }
        function getWeeksInWeekYear() {
          var weekInfo = this.localeData()._week;
          return weeksInYear(this.weekYear(), weekInfo.dow, weekInfo.doy);
        }
        function getSetWeekYearHelper(input, week, weekday, dow, doy) {
          var weeksTarget;
          if (input == null) {
            return weekOfYear(this, dow, doy).year;
          } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
              week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
          }
        }
        function setWeekAll(weekYear, week, weekday, dow, doy) {
          var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy), date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);
          this.year(date.getUTCFullYear());
          this.month(date.getUTCMonth());
          this.date(date.getUTCDate());
          return this;
        }
        addFormatToken("Q", 0, "Qo", "quarter");
        addRegexToken("Q", match1);
        addParseToken("Q", function(input, array) {
          array[MONTH] = (toInt(input) - 1) * 3;
        });
        function getSetQuarter(input) {
          return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
        }
        addFormatToken("D", ["DD", 2], "Do", "date");
        addRegexToken("D", match1to2, match1to2NoLeadingZero);
        addRegexToken("DD", match1to2, match2);
        addRegexToken("Do", function(isStrict, locale2) {
          return isStrict ? locale2._dayOfMonthOrdinalParse || locale2._ordinalParse : locale2._dayOfMonthOrdinalParseLenient;
        });
        addParseToken(["D", "DD"], DATE);
        addParseToken("Do", function(input, array) {
          array[DATE] = toInt(input.match(match1to2)[0]);
        });
        var getSetDayOfMonth = makeGetSet("Date", true);
        addFormatToken("DDD", ["DDDD", 3], "DDDo", "dayOfYear");
        addRegexToken("DDD", match1to3);
        addRegexToken("DDDD", match3);
        addParseToken(["DDD", "DDDD"], function(input, array, config) {
          config._dayOfYear = toInt(input);
        });
        function getSetDayOfYear(input) {
          var dayOfYear = Math.round(
            (this.clone().startOf("day") - this.clone().startOf("year")) / 864e5
          ) + 1;
          return input == null ? dayOfYear : this.add(input - dayOfYear, "d");
        }
        addFormatToken("m", ["mm", 2], 0, "minute");
        addRegexToken("m", match1to2, match1to2HasZero);
        addRegexToken("mm", match1to2, match2);
        addParseToken(["m", "mm"], MINUTE);
        var getSetMinute = makeGetSet("Minutes", false);
        addFormatToken("s", ["ss", 2], 0, "second");
        addRegexToken("s", match1to2, match1to2HasZero);
        addRegexToken("ss", match1to2, match2);
        addParseToken(["s", "ss"], SECOND);
        var getSetSecond = makeGetSet("Seconds", false);
        addFormatToken("S", 0, 0, function() {
          return ~~(this.millisecond() / 100);
        });
        addFormatToken(0, ["SS", 2], 0, function() {
          return ~~(this.millisecond() / 10);
        });
        addFormatToken(0, ["SSS", 3], 0, "millisecond");
        addFormatToken(0, ["SSSS", 4], 0, function() {
          return this.millisecond() * 10;
        });
        addFormatToken(0, ["SSSSS", 5], 0, function() {
          return this.millisecond() * 100;
        });
        addFormatToken(0, ["SSSSSS", 6], 0, function() {
          return this.millisecond() * 1e3;
        });
        addFormatToken(0, ["SSSSSSS", 7], 0, function() {
          return this.millisecond() * 1e4;
        });
        addFormatToken(0, ["SSSSSSSS", 8], 0, function() {
          return this.millisecond() * 1e5;
        });
        addFormatToken(0, ["SSSSSSSSS", 9], 0, function() {
          return this.millisecond() * 1e6;
        });
        addRegexToken("S", match1to3, match1);
        addRegexToken("SS", match1to3, match2);
        addRegexToken("SSS", match1to3, match3);
        var token, getSetMillisecond;
        for (token = "SSSS"; token.length <= 9; token += "S") {
          addRegexToken(token, matchUnsigned);
        }
        function parseMs(input, array) {
          array[MILLISECOND] = toInt(("0." + input) * 1e3);
        }
        for (token = "S"; token.length <= 9; token += "S") {
          addParseToken(token, parseMs);
        }
        getSetMillisecond = makeGetSet("Milliseconds", false);
        addFormatToken("z", 0, 0, "zoneAbbr");
        addFormatToken("zz", 0, 0, "zoneName");
        function getZoneAbbr() {
          return this._isUTC ? "UTC" : "";
        }
        function getZoneName() {
          return this._isUTC ? "Coordinated Universal Time" : "";
        }
        var proto = Moment.prototype;
        proto.add = add;
        proto.calendar = calendar$1;
        proto.clone = clone;
        proto.diff = diff;
        proto.endOf = endOf;
        proto.format = format;
        proto.from = from;
        proto.fromNow = fromNow;
        proto.to = to;
        proto.toNow = toNow;
        proto.get = stringGet;
        proto.invalidAt = invalidAt;
        proto.isAfter = isAfter;
        proto.isBefore = isBefore;
        proto.isBetween = isBetween;
        proto.isSame = isSame;
        proto.isSameOrAfter = isSameOrAfter;
        proto.isSameOrBefore = isSameOrBefore;
        proto.isValid = isValid$2;
        proto.lang = lang;
        proto.locale = locale;
        proto.localeData = localeData;
        proto.max = prototypeMax;
        proto.min = prototypeMin;
        proto.parsingFlags = parsingFlags;
        proto.set = stringSet;
        proto.startOf = startOf;
        proto.subtract = subtract;
        proto.toArray = toArray;
        proto.toObject = toObject;
        proto.toDate = toDate;
        proto.toISOString = toISOString;
        proto.inspect = inspect;
        if (typeof Symbol !== "undefined" && Symbol.for != null) {
          proto[Symbol.for("nodejs.util.inspect.custom")] = function() {
            return "Moment<" + this.format() + ">";
          };
        }
        proto.toJSON = toJSON;
        proto.toString = toString;
        proto.unix = unix;
        proto.valueOf = valueOf;
        proto.creationData = creationData;
        proto.eraName = getEraName;
        proto.eraNarrow = getEraNarrow;
        proto.eraAbbr = getEraAbbr;
        proto.eraYear = getEraYear;
        proto.year = getSetYear;
        proto.isLeapYear = getIsLeapYear;
        proto.weekYear = getSetWeekYear;
        proto.isoWeekYear = getSetISOWeekYear;
        proto.quarter = proto.quarters = getSetQuarter;
        proto.month = getSetMonth;
        proto.daysInMonth = getDaysInMonth;
        proto.week = proto.weeks = getSetWeek;
        proto.isoWeek = proto.isoWeeks = getSetISOWeek;
        proto.weeksInYear = getWeeksInYear;
        proto.weeksInWeekYear = getWeeksInWeekYear;
        proto.isoWeeksInYear = getISOWeeksInYear;
        proto.isoWeeksInISOWeekYear = getISOWeeksInISOWeekYear;
        proto.date = getSetDayOfMonth;
        proto.day = proto.days = getSetDayOfWeek;
        proto.weekday = getSetLocaleDayOfWeek;
        proto.isoWeekday = getSetISODayOfWeek;
        proto.dayOfYear = getSetDayOfYear;
        proto.hour = proto.hours = getSetHour;
        proto.minute = proto.minutes = getSetMinute;
        proto.second = proto.seconds = getSetSecond;
        proto.millisecond = proto.milliseconds = getSetMillisecond;
        proto.utcOffset = getSetOffset;
        proto.utc = setOffsetToUTC;
        proto.local = setOffsetToLocal;
        proto.parseZone = setOffsetToParsedOffset;
        proto.hasAlignedHourOffset = hasAlignedHourOffset;
        proto.isDST = isDaylightSavingTime;
        proto.isLocal = isLocal;
        proto.isUtcOffset = isUtcOffset;
        proto.isUtc = isUtc;
        proto.isUTC = isUtc;
        proto.zoneAbbr = getZoneAbbr;
        proto.zoneName = getZoneName;
        proto.dates = deprecate(
          "dates accessor is deprecated. Use date instead.",
          getSetDayOfMonth
        );
        proto.months = deprecate(
          "months accessor is deprecated. Use month instead",
          getSetMonth
        );
        proto.years = deprecate(
          "years accessor is deprecated. Use year instead",
          getSetYear
        );
        proto.zone = deprecate(
          "moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/",
          getSetZone
        );
        proto.isDSTShifted = deprecate(
          "isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information",
          isDaylightSavingTimeShifted
        );
        function createUnix(input) {
          return createLocal(input * 1e3);
        }
        function createInZone() {
          return createLocal.apply(null, arguments).parseZone();
        }
        function preParsePostFormat(string) {
          return string;
        }
        var proto$1 = Locale.prototype;
        proto$1.calendar = calendar;
        proto$1.longDateFormat = longDateFormat;
        proto$1.invalidDate = invalidDate;
        proto$1.ordinal = ordinal;
        proto$1.preparse = preParsePostFormat;
        proto$1.postformat = preParsePostFormat;
        proto$1.relativeTime = relativeTime;
        proto$1.pastFuture = pastFuture;
        proto$1.set = set;
        proto$1.eras = localeEras;
        proto$1.erasParse = localeErasParse;
        proto$1.erasConvertYear = localeErasConvertYear;
        proto$1.erasAbbrRegex = erasAbbrRegex;
        proto$1.erasNameRegex = erasNameRegex;
        proto$1.erasNarrowRegex = erasNarrowRegex;
        proto$1.months = localeMonths;
        proto$1.monthsShort = localeMonthsShort;
        proto$1.monthsParse = localeMonthsParse;
        proto$1.monthsRegex = monthsRegex;
        proto$1.monthsShortRegex = monthsShortRegex;
        proto$1.week = localeWeek;
        proto$1.firstDayOfYear = localeFirstDayOfYear;
        proto$1.firstDayOfWeek = localeFirstDayOfWeek;
        proto$1.weekdays = localeWeekdays;
        proto$1.weekdaysMin = localeWeekdaysMin;
        proto$1.weekdaysShort = localeWeekdaysShort;
        proto$1.weekdaysParse = localeWeekdaysParse;
        proto$1.weekdaysRegex = weekdaysRegex;
        proto$1.weekdaysShortRegex = weekdaysShortRegex;
        proto$1.weekdaysMinRegex = weekdaysMinRegex;
        proto$1.isPM = localeIsPM;
        proto$1.meridiem = localeMeridiem;
        function get$1(format2, index, field, setter) {
          var locale2 = getLocale(), utc = createUTC().set(setter, index);
          return locale2[field](utc, format2);
        }
        function listMonthsImpl(format2, index, field) {
          if (isNumber(format2)) {
            index = format2;
            format2 = void 0;
          }
          format2 = format2 || "";
          if (index != null) {
            return get$1(format2, index, field, "month");
          }
          var i, out = [];
          for (i = 0; i < 12; i++) {
            out[i] = get$1(format2, i, field, "month");
          }
          return out;
        }
        function listWeekdaysImpl(localeSorted, format2, index, field) {
          if (typeof localeSorted === "boolean") {
            if (isNumber(format2)) {
              index = format2;
              format2 = void 0;
            }
            format2 = format2 || "";
          } else {
            format2 = localeSorted;
            index = format2;
            localeSorted = false;
            if (isNumber(format2)) {
              index = format2;
              format2 = void 0;
            }
            format2 = format2 || "";
          }
          var locale2 = getLocale(), shift = localeSorted ? locale2._week.dow : 0, i, out = [];
          if (index != null) {
            return get$1(format2, (index + shift) % 7, field, "day");
          }
          for (i = 0; i < 7; i++) {
            out[i] = get$1(format2, (i + shift) % 7, field, "day");
          }
          return out;
        }
        function listMonths(format2, index) {
          return listMonthsImpl(format2, index, "months");
        }
        function listMonthsShort(format2, index) {
          return listMonthsImpl(format2, index, "monthsShort");
        }
        function listWeekdays(localeSorted, format2, index) {
          return listWeekdaysImpl(localeSorted, format2, index, "weekdays");
        }
        function listWeekdaysShort(localeSorted, format2, index) {
          return listWeekdaysImpl(localeSorted, format2, index, "weekdaysShort");
        }
        function listWeekdaysMin(localeSorted, format2, index) {
          return listWeekdaysImpl(localeSorted, format2, index, "weekdaysMin");
        }
        getSetGlobalLocale("en", {
          eras: [
            {
              since: "0001-01-01",
              until: Infinity,
              offset: 1,
              name: "Anno Domini",
              narrow: "AD",
              abbr: "AD"
            },
            {
              since: "0000-12-31",
              until: -Infinity,
              offset: 1,
              name: "Before Christ",
              narrow: "BC",
              abbr: "BC"
            }
          ],
          dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
          ordinal: function(number) {
            var b = number % 10, output = toInt(number % 100 / 10) === 1 ? "th" : b === 1 ? "st" : b === 2 ? "nd" : b === 3 ? "rd" : "th";
            return number + output;
          }
        });
        hooks.lang = deprecate(
          "moment.lang is deprecated. Use moment.locale instead.",
          getSetGlobalLocale
        );
        hooks.langData = deprecate(
          "moment.langData is deprecated. Use moment.localeData instead.",
          getLocale
        );
        var mathAbs = Math.abs;
        function abs() {
          var data = this._data;
          this._milliseconds = mathAbs(this._milliseconds);
          this._days = mathAbs(this._days);
          this._months = mathAbs(this._months);
          data.milliseconds = mathAbs(data.milliseconds);
          data.seconds = mathAbs(data.seconds);
          data.minutes = mathAbs(data.minutes);
          data.hours = mathAbs(data.hours);
          data.months = mathAbs(data.months);
          data.years = mathAbs(data.years);
          return this;
        }
        function addSubtract$1(duration, input, value, direction) {
          var other = createDuration(input, value);
          duration._milliseconds += direction * other._milliseconds;
          duration._days += direction * other._days;
          duration._months += direction * other._months;
          return duration._bubble();
        }
        function add$1(input, value) {
          return addSubtract$1(this, input, value, 1);
        }
        function subtract$1(input, value) {
          return addSubtract$1(this, input, value, -1);
        }
        function absCeil(number) {
          if (number < 0) {
            return Math.floor(number);
          } else {
            return Math.ceil(number);
          }
        }
        function bubble() {
          var milliseconds2 = this._milliseconds, days2 = this._days, months2 = this._months, data = this._data, seconds2, minutes2, hours2, years2, monthsFromDays;
          if (!(milliseconds2 >= 0 && days2 >= 0 && months2 >= 0 || milliseconds2 <= 0 && days2 <= 0 && months2 <= 0)) {
            milliseconds2 += absCeil(monthsToDays(months2) + days2) * 864e5;
            days2 = 0;
            months2 = 0;
          }
          data.milliseconds = milliseconds2 % 1e3;
          seconds2 = absFloor(milliseconds2 / 1e3);
          data.seconds = seconds2 % 60;
          minutes2 = absFloor(seconds2 / 60);
          data.minutes = minutes2 % 60;
          hours2 = absFloor(minutes2 / 60);
          data.hours = hours2 % 24;
          days2 += absFloor(hours2 / 24);
          monthsFromDays = absFloor(daysToMonths(days2));
          months2 += monthsFromDays;
          days2 -= absCeil(monthsToDays(monthsFromDays));
          years2 = absFloor(months2 / 12);
          months2 %= 12;
          data.days = days2;
          data.months = months2;
          data.years = years2;
          return this;
        }
        function daysToMonths(days2) {
          return days2 * 4800 / 146097;
        }
        function monthsToDays(months2) {
          return months2 * 146097 / 4800;
        }
        function as(units) {
          if (!this.isValid()) {
            return NaN;
          }
          var days2, months2, milliseconds2 = this._milliseconds;
          units = normalizeUnits(units);
          if (units === "month" || units === "quarter" || units === "year") {
            days2 = this._days + milliseconds2 / 864e5;
            months2 = this._months + daysToMonths(days2);
            switch (units) {
              case "month":
                return months2;
              case "quarter":
                return months2 / 3;
              case "year":
                return months2 / 12;
            }
          } else {
            days2 = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
              case "week":
                return days2 / 7 + milliseconds2 / 6048e5;
              case "day":
                return days2 + milliseconds2 / 864e5;
              case "hour":
                return days2 * 24 + milliseconds2 / 36e5;
              case "minute":
                return days2 * 1440 + milliseconds2 / 6e4;
              case "second":
                return days2 * 86400 + milliseconds2 / 1e3;
              case "millisecond":
                return Math.floor(days2 * 864e5) + milliseconds2;
              default:
                throw new Error("Unknown unit " + units);
            }
          }
        }
        function makeAs(alias) {
          return function() {
            return this.as(alias);
          };
        }
        var asMilliseconds = makeAs("ms"), asSeconds = makeAs("s"), asMinutes = makeAs("m"), asHours = makeAs("h"), asDays = makeAs("d"), asWeeks = makeAs("w"), asMonths = makeAs("M"), asQuarters = makeAs("Q"), asYears = makeAs("y"), valueOf$1 = asMilliseconds;
        function clone$1() {
          return createDuration(this);
        }
        function get$2(units) {
          units = normalizeUnits(units);
          return this.isValid() ? this[units + "s"]() : NaN;
        }
        function makeGetter(name) {
          return function() {
            return this.isValid() ? this._data[name] : NaN;
          };
        }
        var milliseconds = makeGetter("milliseconds"), seconds = makeGetter("seconds"), minutes = makeGetter("minutes"), hours = makeGetter("hours"), days = makeGetter("days"), months = makeGetter("months"), years = makeGetter("years");
        function weeks() {
          return absFloor(this.days() / 7);
        }
        var round = Math.round, thresholds = {
          ss: 44,
          // a few seconds to seconds
          s: 45,
          // seconds to minute
          m: 45,
          // minutes to hour
          h: 22,
          // hours to day
          d: 26,
          // days to month/week
          w: null,
          // weeks to month
          M: 11
          // months to year
        };
        function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale2) {
          return locale2.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
        }
        function relativeTime$1(posNegDuration, withoutSuffix, thresholds2, locale2) {
          var duration = createDuration(posNegDuration).abs(), seconds2 = round(duration.as("s")), minutes2 = round(duration.as("m")), hours2 = round(duration.as("h")), days2 = round(duration.as("d")), months2 = round(duration.as("M")), weeks2 = round(duration.as("w")), years2 = round(duration.as("y")), a = seconds2 <= thresholds2.ss && ["s", seconds2] || seconds2 < thresholds2.s && ["ss", seconds2] || minutes2 <= 1 && ["m"] || minutes2 < thresholds2.m && ["mm", minutes2] || hours2 <= 1 && ["h"] || hours2 < thresholds2.h && ["hh", hours2] || days2 <= 1 && ["d"] || days2 < thresholds2.d && ["dd", days2];
          if (thresholds2.w != null) {
            a = a || weeks2 <= 1 && ["w"] || weeks2 < thresholds2.w && ["ww", weeks2];
          }
          a = a || months2 <= 1 && ["M"] || months2 < thresholds2.M && ["MM", months2] || years2 <= 1 && ["y"] || ["yy", years2];
          a[2] = withoutSuffix;
          a[3] = +posNegDuration > 0;
          a[4] = locale2;
          return substituteTimeAgo.apply(null, a);
        }
        function getSetRelativeTimeRounding(roundingFunction) {
          if (roundingFunction === void 0) {
            return round;
          }
          if (typeof roundingFunction === "function") {
            round = roundingFunction;
            return true;
          }
          return false;
        }
        function getSetRelativeTimeThreshold(threshold, limit) {
          if (thresholds[threshold] === void 0) {
            return false;
          }
          if (limit === void 0) {
            return thresholds[threshold];
          }
          thresholds[threshold] = limit;
          if (threshold === "s") {
            thresholds.ss = limit - 1;
          }
          return true;
        }
        function humanize(argWithSuffix, argThresholds) {
          if (!this.isValid()) {
            return this.localeData().invalidDate();
          }
          var withSuffix = false, th = thresholds, locale2, output;
          if (typeof argWithSuffix === "object") {
            argThresholds = argWithSuffix;
            argWithSuffix = false;
          }
          if (typeof argWithSuffix === "boolean") {
            withSuffix = argWithSuffix;
          }
          if (typeof argThresholds === "object") {
            th = Object.assign({}, thresholds, argThresholds);
            if (argThresholds.s != null && argThresholds.ss == null) {
              th.ss = argThresholds.s - 1;
            }
          }
          locale2 = this.localeData();
          output = relativeTime$1(this, !withSuffix, th, locale2);
          if (withSuffix) {
            output = locale2.pastFuture(+this, output);
          }
          return locale2.postformat(output);
        }
        var abs$1 = Math.abs;
        function sign(x) {
          return (x > 0) - (x < 0) || +x;
        }
        function toISOString$1() {
          if (!this.isValid()) {
            return this.localeData().invalidDate();
          }
          var seconds2 = abs$1(this._milliseconds) / 1e3, days2 = abs$1(this._days), months2 = abs$1(this._months), minutes2, hours2, years2, s, total = this.asSeconds(), totalSign, ymSign, daysSign, hmsSign;
          if (!total) {
            return "P0D";
          }
          minutes2 = absFloor(seconds2 / 60);
          hours2 = absFloor(minutes2 / 60);
          seconds2 %= 60;
          minutes2 %= 60;
          years2 = absFloor(months2 / 12);
          months2 %= 12;
          s = seconds2 ? seconds2.toFixed(3).replace(/\.?0+$/, "") : "";
          totalSign = total < 0 ? "-" : "";
          ymSign = sign(this._months) !== sign(total) ? "-" : "";
          daysSign = sign(this._days) !== sign(total) ? "-" : "";
          hmsSign = sign(this._milliseconds) !== sign(total) ? "-" : "";
          return totalSign + "P" + (years2 ? ymSign + years2 + "Y" : "") + (months2 ? ymSign + months2 + "M" : "") + (days2 ? daysSign + days2 + "D" : "") + (hours2 || minutes2 || seconds2 ? "T" : "") + (hours2 ? hmsSign + hours2 + "H" : "") + (minutes2 ? hmsSign + minutes2 + "M" : "") + (seconds2 ? hmsSign + s + "S" : "");
        }
        var proto$2 = Duration.prototype;
        proto$2.isValid = isValid$1;
        proto$2.abs = abs;
        proto$2.add = add$1;
        proto$2.subtract = subtract$1;
        proto$2.as = as;
        proto$2.asMilliseconds = asMilliseconds;
        proto$2.asSeconds = asSeconds;
        proto$2.asMinutes = asMinutes;
        proto$2.asHours = asHours;
        proto$2.asDays = asDays;
        proto$2.asWeeks = asWeeks;
        proto$2.asMonths = asMonths;
        proto$2.asQuarters = asQuarters;
        proto$2.asYears = asYears;
        proto$2.valueOf = valueOf$1;
        proto$2._bubble = bubble;
        proto$2.clone = clone$1;
        proto$2.get = get$2;
        proto$2.milliseconds = milliseconds;
        proto$2.seconds = seconds;
        proto$2.minutes = minutes;
        proto$2.hours = hours;
        proto$2.days = days;
        proto$2.weeks = weeks;
        proto$2.months = months;
        proto$2.years = years;
        proto$2.humanize = humanize;
        proto$2.toISOString = toISOString$1;
        proto$2.toString = toISOString$1;
        proto$2.toJSON = toISOString$1;
        proto$2.locale = locale;
        proto$2.localeData = localeData;
        proto$2.toIsoString = deprecate(
          "toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)",
          toISOString$1
        );
        proto$2.lang = lang;
        addFormatToken("X", 0, 0, "unix");
        addFormatToken("x", 0, 0, "valueOf");
        addRegexToken("x", matchSigned);
        addRegexToken("X", matchTimestamp);
        addParseToken("X", function(input, array, config) {
          config._d = new Date(parseFloat(input) * 1e3);
        });
        addParseToken("x", function(input, array, config) {
          config._d = new Date(toInt(input));
        });
        hooks.version = "2.30.1";
        setHookCallback(createLocal);
        hooks.fn = proto;
        hooks.min = min;
        hooks.max = max;
        hooks.now = now;
        hooks.utc = createUTC;
        hooks.unix = createUnix;
        hooks.months = listMonths;
        hooks.isDate = isDate;
        hooks.locale = getSetGlobalLocale;
        hooks.invalid = createInvalid;
        hooks.duration = createDuration;
        hooks.isMoment = isMoment;
        hooks.weekdays = listWeekdays;
        hooks.parseZone = createInZone;
        hooks.localeData = getLocale;
        hooks.isDuration = isDuration;
        hooks.monthsShort = listMonthsShort;
        hooks.weekdaysMin = listWeekdaysMin;
        hooks.defineLocale = defineLocale;
        hooks.updateLocale = updateLocale;
        hooks.locales = listLocales;
        hooks.weekdaysShort = listWeekdaysShort;
        hooks.normalizeUnits = normalizeUnits;
        hooks.relativeTimeRounding = getSetRelativeTimeRounding;
        hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
        hooks.calendarFormat = getCalendarFormat;
        hooks.prototype = proto;
        hooks.HTML5_FMT = {
          DATETIME_LOCAL: "YYYY-MM-DDTHH:mm",
          // <input type="datetime-local" />
          DATETIME_LOCAL_SECONDS: "YYYY-MM-DDTHH:mm:ss",
          // <input type="datetime-local" step="1" />
          DATETIME_LOCAL_MS: "YYYY-MM-DDTHH:mm:ss.SSS",
          // <input type="datetime-local" step="0.001" />
          DATE: "YYYY-MM-DD",
          // <input type="date" />
          TIME: "HH:mm",
          // <input type="time" />
          TIME_SECONDS: "HH:mm:ss",
          // <input type="time" step="1" />
          TIME_MS: "HH:mm:ss.SSS",
          // <input type="time" step="0.001" />
          WEEK: "GGGG-[W]WW",
          // <input type="week" />
          MONTH: "YYYY-MM"
          // <input type="month" />
        };
        return hooks;
      });
    }
  });

  // src/core/utils.ts
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      if (m === '"') return "&quot;";
      return "&#39;";
    });
  }
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function generateId(prefix) {
    prefix = prefix || "item";
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }
  function formatRelativeTime(date, now = /* @__PURE__ */ new Date()) {
    const target = (0, import_moment.default)(date);
    if (!target.isValid()) return "无效日期";
    let hasExplicitTime = true;
    if (typeof date === "string") {
      hasExplicitTime = !/^\d{4}-\d{2}-\d{2}$/.test(date.trim());
    }
    const nowMoment = (0, import_moment.default)(now);
    const diffSeconds = nowMoment.diff(target, "seconds");
    function shouldShowTime() {
      const timeStr = target.format("HH:mm");
      if (timeStr !== "00:00") return true;
      return hasExplicitTime;
    }
    if (diffSeconds < 0) {
      return target.format(shouldShowTime() ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD");
    }
    if (diffSeconds < 60) return "刚刚";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const todayStart = (0, import_moment.default)(now).startOf("day");
    if (target.isSame(todayStart, "day") && diffMinutes >= 60) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}小时前`;
    }
    const yesterdayStart = (0, import_moment.default)(now).subtract(1, "days").startOf("day");
    const beforeYesterdayStart = (0, import_moment.default)(now).subtract(2, "days").startOf("day");
    if (target.isSame(yesterdayStart, "day")) {
      return shouldShowTime() ? `昨天 ${target.format("HH:mm")}` : "昨天";
    }
    if (target.isSame(beforeYesterdayStart, "day")) {
      return shouldShowTime() ? `前天 ${target.format("HH:mm")}` : "前天";
    }
    const weekStart = (0, import_moment.default)(now).startOf("week");
    if (target.isSameOrAfter(weekStart, "day") && target.isBefore(todayStart)) {
      return shouldShowTime() ? `${target.format("ddd")} ${target.format("HH:mm")}` : target.format("ddd");
    }
    const isThisYear = target.year() === nowMoment.year();
    if (isThisYear) {
      return shouldShowTime() ? target.format("MM-DD HH:mm") : target.format("MM-DD");
    }
    return shouldShowTime() ? target.format("YYYY-MM-DD HH:mm") : target.format("YYYY-MM-DD");
  }
  async function fetchPageTitle(url) {
    try {
      const r = await requestUrl({
        url,
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      if (r.status === 200) {
        const m = r.text.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (m && m[1]) return m[1].trim();
      }
    } catch (e) {
    }
    return null;
  }
  function localDayKey(ts = Date.now()) {
    const d = ts instanceof Date ? ts : new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function stripMdExt(name) {
    return String(name || "").replace(/\.md$/i, "");
  }
  function stripTitleMarks(s) {
    return String(s || "").replace(/^《|》$/g, "");
  }
  function cmpZh(a, b) {
    return String(a || "").localeCompare(String(b || ""), "zh");
  }
  var import_moment;
  var init_utils = __esm({
    "src/core/utils.ts"() {
      import_moment = __toESM(require_moment());
      init_fake_obsidian();
      init_app();
    }
  });

  // src/core/flow-dialog.ts
  function buildFlowDialogParts(title, message, actions) {
    let buttons;
    if (actions.length === 2) {
      buttons = [
        { id: FLOW_DIALOG_CANCEL_ID, className: "", label: actions[0].label, value: actions[0].value },
        { id: FLOW_DIALOG_OK_ID, className: "", label: actions[1].label, value: actions[1].value }
      ];
    } else {
      buttons = actions.map((a, i) => {
        const cls = ["bz-flow-dialog-action"];
        if (a.danger) cls.push("bz-flow-dialog-danger");
        if (a.cta) cls.push("bz-flow-dialog-cta");
        return { id: `bz-flow-dialog-action-${i}`, className: cls.join(" "), label: a.label, value: a.value };
      });
    }
    const ctaIdx = actions.findIndex((a) => a.cta);
    const focusIdx = ctaIdx >= 0 ? ctaIdx : actions.length - 1;
    const html = "<h4>" + escapeHtml(title || "确认") + "</h4><p>" + escapeHtml(message) + '</p><div class="confirm-actions">' + buttons.map((b) => {
      const clsAttr = b.className ? ' class="' + b.className + '"' : "";
      return '<button id="' + b.id + '"' + clsAttr + ">" + escapeHtml(b.label) + "</button>";
    }).join("") + "</div>";
    return { html, buttons, focusId: buttons[focusIdx].id };
  }
  function openFlowDialog(opts) {
    if (!opts.actions || opts.actions.length === 0) {
      return Promise.reject(new Error("openFlowDialog：actions 不能为空"));
    }
    return new Promise((resolve2) => {
      const prevActive = document.activeElement;
      if (activeSettle) activeSettle(void 0);
      const parts = buildFlowDialogParts(opts.title, opts.message, opts.actions);
      const mask = document.createElement("div");
      mask.id = "__shared_confirm_mask__";
      mask.style.zIndex = String(allocZ());
      mask.onclick = (e) => {
        if (e.target === mask) settle(void 0);
      };
      const popup = document.createElement("div");
      popup.id = "__shared_confirm_popup__";
      if (opts.className) popup.classList.add(opts.className);
      popup.setAttribute("role", "dialog");
      popup.setAttribute("aria-modal", "true");
      popup.innerHTML = parts.html;
      mask.appendChild(popup);
      document.body.appendChild(mask);
      const escHandle2 = escManager.register("q3-confirm", {
        isVisible: () => mask.isConnected,
        close: () => settle(void 0)
      });
      let settled = false;
      function restoreFocus() {
        if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
          prevActive.focus();
        }
      }
      function settle(v) {
        if (settled) return;
        settled = true;
        if (activeSettle === settle) activeSettle = null;
        escHandle2.unregister();
        mask.remove();
        restoreFocus();
        resolve2(v);
      }
      activeSettle = settle;
      for (const b of parts.buttons) {
        const btn = document.getElementById(b.id);
        if (btn) btn.onclick = () => settle(b.value);
      }
      const focusBtn = document.getElementById(parts.focusId);
      if (focusBtn) focusBtn.focus();
    });
  }
  var FLOW_DIALOG_CANCEL_ID, FLOW_DIALOG_OK_ID, activeSettle;
  var init_flow_dialog = __esm({
    "src/core/flow-dialog.ts"() {
      init_esc_manager();
      init_utils();
      init_z_order();
      FLOW_DIALOG_CANCEL_ID = "__shared_confirm_cancel__";
      FLOW_DIALOG_OK_ID = "__shared_confirm_ok__";
      activeSettle = null;
    }
  });

  // src/core/storage.ts
  function storageDir() {
    const s = tryGetSettings();
    return (s && s.storagePath || "CONFIG/STORAGE").trim().replace(/\/+$/, "");
  }
  function storageFile(name, base) {
    const dir = (base || storageDir()).trim().replace(/\/+$/, "");
    return `${dir}/${name}`;
  }
  function enqueueFileTask(filePath, task) {
    var _a;
    const prev = (_a = fileTaskQueues.get(filePath)) != null ? _a : Promise.resolve();
    const run = prev.then(task, task);
    const tail = run.then(
      () => void 0,
      () => void 0
    );
    fileTaskQueues.set(filePath, tail);
    void tail.then(() => {
      if (fileTaskQueues.get(filePath) === tail) fileTaskQueues.delete(filePath);
    });
    return run;
  }
  function isAlreadyExistsError(e) {
    const msg = e instanceof Error ? e.message : String(e);
    return /already exist/i.test(msg);
  }
  function corruptStamp(d = /* @__PURE__ */ new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
  function baseNameOf(p) {
    return p.includes("/") ? p.slice(p.lastIndexOf("/") + 1) : p;
  }
  async function backupOriginal(app, filePath, raw) {
    try {
      const f = app.vault.getAbstractFileByPath(filePath);
      if (!f) return null;
      const content = raw !== void 0 ? raw : await app.vault.read(f);
      if (!app.vault.getAbstractFileByPath(CORRUPT_BACKUP_DIR)) {
        try {
          await app.vault.createFolder(CORRUPT_BACKUP_DIR);
        } catch (e) {
        }
      }
      const base = baseNameOf(filePath);
      const stamp = corruptStamp();
      let backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}.bak`;
      for (let i = 2; app.vault.getAbstractFileByPath(backupPath); i++) {
        backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}-${i}.bak`;
      }
      await app.vault.create(backupPath, content);
      return backupPath;
    } catch (e) {
      console.warn("[storage] " + filePath + " 留档失败（" + CORRUPT_BACKUP_DIR + "），继续原流程", e);
      return null;
    }
  }
  function notifyBackup(filePath, backupPath, cause) {
    var _a;
    const now = Date.now();
    if (now - ((_a = corruptNotifyAt.get(filePath)) != null ? _a : 0) < CORRUPT_NOTIFY_DEDUPE_MS) return;
    corruptNotifyAt.set(filePath, now);
    try {
      const name = baseNameOf(filePath);
      const msg = cause === "解析失败" ? `数据文件 ${name} 解析失败，原内容已留档到 ${backupPath}，数据不会丢，已重建默认文件继续使用` : `数据文件 ${name} 写入失败，原内容已留档到 ${backupPath}，数据不会丢，请稍后重试`;
      notify(msg, { type: "warning" });
    } catch (e) {
    }
  }
  function serialize(v) {
    return JSON.stringify(v, null, 2);
  }
  function jsonFileStore(filePath, opts = {}) {
    const resolveApp = () => opts.app || getApp();
    const resolveDefault = () => {
      const d = opts.defaultValue;
      return typeof d === "function" ? d() : d === void 0 ? [] : d;
    };
    async function ensureDir(app) {
      const d = filePath.substring(0, filePath.lastIndexOf("/"));
      if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
    }
    async function createIfMissing(app, content) {
      await ensureDir(app);
      try {
        await app.vault.create(filePath, content);
        return true;
      } catch (e) {
        if (isAlreadyExistsError(e) && app.vault.getAbstractFileByPath(filePath)) return false;
        throw e;
      }
    }
    async function handleCorrupt(app, err, raw) {
      var _a;
      if (((_a = opts.onCorrupt) == null ? void 0 : _a.call(opts, filePath, err)) === false) {
        return null;
      }
      const backupPath = await backupOriginal(app, filePath, raw);
      if (backupPath && !opts.onCorrupt) notifyBackup(filePath, backupPath, "解析失败");
      const f = app.vault.getAbstractFileByPath(filePath);
      if (f) {
        await app.vault.modify(f, serialize(resolveDefault()));
      } else {
        await createIfMissing(app, serialize(resolveDefault()));
      }
      return resolveDefault();
    }
    async function modifyWithBackup(app, f, c) {
      try {
        await app.vault.modify(f, c);
      } catch (e) {
        const backupPath = await backupOriginal(app, filePath);
        if (backupPath) notifyBackup(filePath, backupPath, "写入失败");
        throw e;
      }
    }
    return {
      async read() {
        const app = resolveApp();
        let f = app.vault.getAbstractFileByPath(filePath);
        if (!f) {
          const created = await createIfMissing(app, serialize(resolveDefault()));
          if (created) return resolveDefault();
          f = app.vault.getAbstractFileByPath(filePath);
          if (!f) return resolveDefault();
        }
        const raw = await app.vault.read(f);
        try {
          return JSON.parse(raw);
        } catch (e) {
          return await handleCorrupt(app, e, raw);
        }
      },
      async write(data) {
        const app = resolveApp();
        const c = serialize(data);
        let f = app.vault.getAbstractFileByPath(filePath);
        if (f) {
          if (opts.writeIfChanged) {
            try {
              const cur2 = await app.vault.read(f);
              if (cur2 === c) return;
            } catch (e) {
            }
          }
          await modifyWithBackup(app, f, c);
          return;
        }
        const created = await createIfMissing(app, c);
        if (created) return;
        let cur = app.vault.getAbstractFileByPath(filePath);
        if (!cur) {
          const retried = await createIfMissing(app, c);
          if (retried) return;
          cur = app.vault.getAbstractFileByPath(filePath);
          if (!cur) throw new Error("storage: create 竞态降级失败（" + filePath + "）");
        }
        await modifyWithBackup(app, cur, c);
      }
    };
  }
  var fileTaskQueues, CORRUPT_BACKUP_DIR, CORRUPT_NOTIFY_DEDUPE_MS, corruptNotifyAt;
  var init_storage = __esm({
    "src/core/storage.ts"() {
      init_app();
      init_settings_provider();
      init_notice();
      fileTaskQueues = /* @__PURE__ */ new Map();
      CORRUPT_BACKUP_DIR = "CONFIG/.CORRUPT";
      CORRUPT_NOTIFY_DEDUPE_MS = 3e4;
      corruptNotifyAt = /* @__PURE__ */ new Map();
    }
  });

  // src/clipbook/constants.ts
  function articleKeyOf(a) {
    if (a && a.url) return "url:" + String(a.url);
    return "td:" + String(a && a.title || "") + "|" + String(a && a.date || "");
  }
  function excerpt(body, max = 90) {
    const s = String(body || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*`_~-]/g, "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    return s.length > max ? s.slice(0, max) + "…" : s;
  }
  function localDayKey2(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad22(d.getMonth() + 1)}-${pad22(d.getDate())}`;
  }
  function localDatetime(ts = Date.now()) {
    const d = new Date(ts);
    const hms = `${pad22(d.getHours())}:${pad22(d.getMinutes())}:${pad22(d.getSeconds())}`;
    return `${localDayKey2(ts)} ${hms}`;
  }
  function toDatetime(dateStr) {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19);
      return d.toISOString().replace("T", " ").substring(0, 19);
    } catch (e) {
      return (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19);
    }
  }
  function pad22(n) {
    return String(n).padStart(2, "0");
  }
  var init_constants = __esm({
    "src/clipbook/constants.ts"() {
    }
  });

  // src/clipbook/news-data.ts
  function getNewsFilePath() {
    return storageFile("news.json");
  }
  function emptyData() {
    return { articles: [], stats: DEFAULT_STATS(), bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: "", sources: { ...DEFAULT_SOURCES }, rssFeeds: [] };
  }
  function parseRssFeeds(raw) {
    var _a, _b;
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const it of raw) {
      if (!it || typeof it !== "object") continue;
      const url = String((_a = it.url) != null ? _a : "").trim();
      if (!url) continue;
      const title = String((_b = it.title) != null ? _b : "").trim();
      out.push(title ? { url, title } : { url });
    }
    return out;
  }
  function looksLikeFeedXml(xml) {
    return /<(rss|feed|RDF)[\s>]/i.test(String(xml || ""));
  }
  function extractFeedTitleFromXml(xml) {
    const m = String(xml || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m) return null;
    const t = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    return t || null;
  }
  function normalizeRssFeedUrl(text) {
    const t = String(text || "").trim();
    return /^https?:\/\/\S+$/i.test(t) ? t : null;
  }
  function parseBilibiliUpInfo(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for (const [uid, v] of Object.entries(raw)) {
      if (!v || typeof v !== "object") continue;
      const info = {};
      if (v.name) info.name = String(v.name);
      if (v.avatar) info.avatar = String(v.avatar).replace(/^http:/, "https:");
      out[uid] = info;
    }
    return out;
  }
  function parseBilibiliMaxItems(raw) {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 10;
  }
  function parseBilibiliCookie(raw) {
    return typeof raw === "string" ? raw.trim() : "";
  }
  function wrapArrayToNewsData(articles) {
    const data = emptyData();
    data.articles = Array.isArray(articles) ? articles : [];
    return data;
  }
  function mergeStatsInto(data, oldStats) {
    if (statsHasData(data.stats)) return data;
    const s = oldStats && typeof oldStats === "object" ? oldStats : null;
    if (!s) return data;
    return {
      ...data,
      stats: {
        totalRead: Number(s.totalRead) || 0,
        totalSaved: Number(s.totalSaved) || 0,
        totalSkipped: Number(s.totalSkipped) || 0,
        byPlatform: s.byPlatform && typeof s.byPlatform === "object" ? s.byPlatform : {},
        byDate: s.byDate && typeof s.byDate === "object" ? s.byDate : {}
      }
    };
  }
  function statsHasData(stats) {
    if (!stats || typeof stats !== "object") return false;
    return (Number(stats.totalRead) || 0) > 0 || (Number(stats.totalSaved) || 0) > 0 || (Number(stats.totalSkipped) || 0) > 0 || (stats.byPlatform && Object.keys(stats.byPlatform).length > 0) === true || (stats.byDate && Object.keys(stats.byDate).length > 0) === true;
  }
  function parseNewsFileContent(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    if (Array.isArray(parsed)) return wrapArrayToNewsData(parsed);
    if (parsed && typeof parsed === "object") {
      const obj = parsed;
      return {
        articles: Array.isArray(obj.articles) ? obj.articles : [],
        stats: obj.stats && typeof obj.stats === "object" ? obj.stats : DEFAULT_STATS(),
        bilibiliUps: Array.isArray(obj.bilibiliUps) ? obj.bilibiliUps.map((u) => String(u != null ? u : "").trim()).filter(Boolean) : [],
        bilibiliUpInfo: parseBilibiliUpInfo(obj.bilibiliUpInfo),
        bilibiliMaxItems: parseBilibiliMaxItems(obj.bilibiliMaxItems),
        bilibiliCookie: parseBilibiliCookie(obj.bilibiliCookie),
        sources: obj.sources && typeof obj.sources === "object" ? { ...DEFAULT_SOURCES, ...obj.sources } : { ...DEFAULT_SOURCES },
        rssFeeds: parseRssFeeds(obj.rssFeeds)
      };
    }
    return null;
  }
  async function readNewsData() {
    const missing = !getApp().vault.getAbstractFileByPath(getNewsFilePath());
    let corrupt = false;
    const parsed = await jsonFileStore(getNewsFilePath(), {
      defaultValue: () => emptyData(),
      onCorrupt: () => {
        corrupt = true;
        return false;
      }
    }).read().catch(() => null);
    if (parsed === null || corrupt) return { ok: false, missing: false, data: emptyData() };
    const content = parseNewsFileContent(JSON.stringify(parsed));
    if (!content) return { ok: false, missing: false, data: emptyData() };
    return { ok: true, missing, data: content };
  }
  async function writeNewsData(data) {
    try {
      await jsonFileStore(getNewsFilePath()).write(data);
    } catch (e) {
    }
  }
  async function writeNewsDataMerged(intent) {
    var _a;
    const res = await readNewsData();
    if (!res.ok) return;
    const base = res.data;
    const next = { ...base };
    if (intent.set.articles || ((_a = intent.removeArticleKeys) == null ? void 0 : _a.length)) {
      const patchList = intent.set.articles || [];
      const removeKeys = new Set(intent.removeArticleKeys || []);
      const patchByKey = /* @__PURE__ */ new Map();
      for (const a of patchList) patchByKey.set(articleKeyOf(a), a);
      const merged = [];
      const seen = /* @__PURE__ */ new Set();
      for (const a of base.articles || []) {
        const k = articleKeyOf(a);
        if (removeKeys.has(k)) continue;
        seen.add(k);
        merged.push(patchByKey.has(k) ? patchByKey.get(k) : a);
      }
      for (const a of patchList) {
        const k = articleKeyOf(a);
        if (!seen.has(k)) {
          merged.push(a);
          seen.add(k);
        }
      }
      next.articles = merged;
    }
    for (const seg of ["stats", "bilibiliUps", "bilibiliUpInfo", "bilibiliMaxItems", "bilibiliCookie", "sources", "rssFeeds"]) {
      if (intent.set[seg] !== void 0) {
        next[seg] = intent.set[seg];
      }
    }
    await writeNewsData(next);
  }
  function parseUidFromText(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    const pure = t.match(/^\d{1,10}$/);
    if (pure) return pure[0];
    const space = t.match(/space\.bilibili\.com[\/:]*(\d+)/i);
    if (space) return space[1];
    return null;
  }
  function parseBvidFromText(text) {
    const t = String(text || "").trim();
    const m = t.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/i);
    return m ? m[1] : null;
  }
  async function resolveUidFromInput(text) {
    var _a;
    const local = parseUidFromText(text);
    if (local) return local;
    const bvid = parseBvidFromText(text);
    if (!bvid) return null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1e4);
      const resp = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
        method: "GET",
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!resp.ok) return null;
      const json = await resp.json();
      const mid = json && json.data && json.data.owner ? String((_a = json.data.owner.mid) != null ? _a : "") : "";
      return mid || null;
    } catch (e) {
      return null;
    }
  }
  async function migrateLegacyStats(data) {
    if (statsHasData(data.stats)) return data;
    const app = getApp();
    const af = app.vault.getAbstractFileByPath(STATS_JSON_PATH);
    if (!af) return data;
    try {
      const raw = await app.vault.read(af);
      const old = JSON.parse(raw);
      const merged = mergeStatsInto(data, old);
      return merged === data ? data : merged;
    } catch (e) {
      return data;
    }
  }
  function applyRetention(articles, savedDays, skippedDays, now = Date.now()) {
    const DAY = 24 * 60 * 60 * 1e3;
    const kept = [];
    for (const a of articles) {
      if (!a || a.read !== true) {
        kept.push(a);
        continue;
      }
      const state = a.state === "saved" ? "saved" : "skipped";
      const days = state === "saved" ? savedDays : skippedDays;
      if (!Number.isFinite(days) || days <= 0) {
        kept.push(a);
        continue;
      }
      const t = new Date(a.fetchedAt || a.date || "").getTime();
      if (!Number.isFinite(t)) {
        kept.push(a);
        continue;
      }
      if (now - t > days * DAY) continue;
      kept.push(a);
    }
    return kept;
  }
  function normalizeRetentionDays(v) {
    const n = Number(String(v || "").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  var STATS_JSON_PATH, DEFAULT_SOURCES, DEFAULT_STATS;
  var init_news_data = __esm({
    "src/clipbook/news-data.ts"() {
      init_app();
      init_storage();
      init_constants();
      STATS_JSON_PATH = "CONFIG/STORAGE/news-stats.json";
      DEFAULT_SOURCES = { zhihu: true, guokr: true, bilibili: true, rss: true };
      DEFAULT_STATS = () => ({ totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} });
    }
  });

  // src/core/dom.ts
  function longPress(el, cb, dur, filter) {
    if (!dur) dur = 500;
    let timer = null, touching = false, fired = false, moved = false, sx = 0, sy = 0;
    let suppressClick = false;
    const M2 = 10;
    function start(e) {
      if (filter && !filter(e)) return;
      if (e.button !== void 0 && e.button !== 0) return;
      fired = false;
      moved = false;
      if (e.touches && e.touches.length) {
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
        touching = true;
      }
      timer = setTimeout(function() {
        timer = null;
        fired = true;
        cb(e);
      }, dur);
    }
    function cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function move(e) {
      if (!timer || !touching || !e.touches || !e.touches.length) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - sx) > M2 || Math.abs(t.clientY - sy) > M2) {
        moved = true;
        cancel();
      }
    }
    function endFromTouch() {
      if (fired) suppressClick = true;
      touching = false;
      cancel();
    }
    function endFromMouse() {
      touching = false;
      cancel();
    }
    function onClick(e) {
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", endFromMouse);
    el.addEventListener("mouseleave", endFromMouse);
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", endFromTouch);
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchcancel", endFromTouch);
    el.addEventListener("click", onClick, true);
  }
  function swallowNextClick() {
    const swallow = (e) => {
      document.removeEventListener("click", swallow, true);
      e.stopPropagation();
    };
    const disarm = () => {
      document.removeEventListener("click", swallow, true);
    };
    document.addEventListener("click", swallow, true);
    document.addEventListener("mousedown", disarm, { capture: true, once: true });
  }
  function createOverlay(opts) {
    const mask = document.createElement("div");
    mask.id = opts.maskId;
    mask.className = "bz-overlay-mask";
    mask.style.display = "none";
    mask.onclick = function(e) {
      if (e.target === mask && typeof opts.onMaskClick === "function") opts.onMaskClick();
    };
    const popup = document.createElement("div");
    popup.id = opts.popupId;
    popup.className = "bz-overlay-popup";
    popup.style.display = "none";
    popup.style.width = opts.width || "90%";
    popup.style.maxWidth = (opts.maxWidth || 400) + "px";
    topifyZ(mask, popup);
    return { mask, popup, topify: () => topifyZ(mask, popup) };
  }
  var init_dom = __esm({
    "src/core/dom.ts"() {
      init_notice();
      init_z_order();
    }
  });

  // src/clipbook/save.ts
  function clipDirOf() {
    const s = tryGetSettings();
    return s && s.articleDirectory || "归档/网页剪藏";
  }
  async function writeClipNote(raw, dirOverride) {
    const app = getApp();
    const dir = dirOverride || clipDirOf();
    const cleanTitle = String(raw.title || "").replace(/[\\/:*?"<>|]/g, "").trim();
    if (!cleanTitle) {
      notice("标题为空", "error");
      return false;
    }
    const filePath = `${dir}/${cleanTitle}.md`;
    if (app.vault.getAbstractFileByPath(filePath)) {
      const ok = await confirmOverwrite(filePath);
      if (!ok) return false;
    }
    const tagsYaml = (raw.tags || []).map((t) => `  - "${yamlEscape(t)}"`).join("\n");
    const now = localDatetime();
    const pubDate = raw.date ? toDatetime(String(raw.date)) : "";
    const body = String(raw.body || "").replace(/^\s*---[\s\S]*?---\s*/m, "").replace(/^\s*```dataviewjs[\s\S]*?```\s*/m, "").trim();
    const md = `---
url: "${yamlEscape(raw.url || "")}"
author: "${yamlEscape(raw.author || "")}"
site: "${yamlEscape(raw.platform || "")}"
summary: "${yamlEscape(raw.summary || "")}"
tags:
${tagsYaml}
date: "${yamlEscape(pubDate)}"
created: ${now}
---
\`\`\`dataviewjs
await dv.view(\`CONFIG/SCRIPTS/DataView/摘要\`)
\`\`\`

${body}`;
    try {
      const dirAf = app.vault.getAbstractFileByPath(dir);
      if (!dirAf) await app.vault.createFolder(dir);
      const existing = app.vault.getAbstractFileByPath(filePath);
      if (existing) await app.vault.modify(existing, md);
      else await app.vault.create(filePath, md);
      notice(`已保存：${cleanTitle}`, "success");
      return true;
    } catch (e) {
      console.error("[剪藏本] 保存剪藏失败", e);
      notice("保存失败，请稍后重试", "error");
      return false;
    }
  }
  function confirmOverwrite(filePath) {
    return new Promise((resolve2) => {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        background: "var(--background-primary)",
        borderRadius: "10px",
        padding: "20px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
        minWidth: "260px",
        textAlign: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif",
        zIndex: "10500"
      });
      el.innerHTML = `
      <div style="margin-bottom:14px;color:var(--text-normal);font-size:14px;">已存在同名剪藏，覆盖？</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="y" style="padding:6px 18px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);border-radius:4px;cursor:pointer;">覆盖</button>
        <button class="n" style="padding:6px 18px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-normal);border-radius:4px;cursor:pointer;">取消</button>
      </div>`;
      const ov = document.createElement("div");
      Object.assign(ov.style, { position: "fixed", inset: "0", background: "var(--background-modifier-cover)" });
      topifyZ(ov, el);
      document.body.appendChild(ov);
      document.body.appendChild(el);
      const close = (v) => {
        ov.remove();
        el.remove();
        resolve2(v);
      };
      ov.onclick = () => close(false);
      const h = escManager.register("clipbook-confirm", {
        isVisible: () => ov.isConnected,
        close: () => close(false)
      });
      el.querySelector(".y").onclick = () => {
        h.unregister();
        close(true);
      };
      el.querySelector(".n").onclick = () => {
        h.unregister();
        close(false);
      };
    });
  }
  var yamlEscape;
  var init_save = __esm({
    "src/clipbook/save.ts"() {
      init_app();
      init_esc_manager();
      init_dom();
      init_settings_provider();
      init_notice();
      init_constants();
      yamlEscape = (v) => String(v != null ? v : "").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
    }
  });

  // src/clipbook/data.ts
  function clipbookFilePath() {
    return storageFile(CLIPBOOK_JSON);
  }
  function resolve(data) {
    return {
      articleOverrides: data && data.articleOverrides !== null && typeof data.articleOverrides === "object" && !Array.isArray(data.articleOverrides) ? data.articleOverrides : {},
      savedArchive: Array.isArray(data && data.savedArchive) ? data.savedArchive.filter((s) => s && typeof s === "object" && s.url) : [],
      order: Array.isArray(data && data.order) ? data.order.map(String) : []
    };
  }
  async function readClipbookData() {
    const data = await jsonFileStore(clipbookFilePath(), { defaultValue: () => emptySidecar() }).read();
    return resolve(data || {});
  }
  async function writeClipbookData(data) {
    try {
      await jsonFileStore(clipbookFilePath(), { defaultValue: () => emptySidecar() }).write(data);
    } catch (e) {
    }
  }
  function updateClipbookData(mutate) {
    return enqueueFileTask(clipbookFilePath(), async () => {
      const cur = await readClipbookData();
      const next = mutate(cur);
      await writeClipbookData(next);
      return next;
    });
  }
  function emptySidecar() {
    return { articleOverrides: {}, savedArchive: [], order: [] };
  }
  var CLIPBOOK_JSON;
  var init_data = __esm({
    "src/clipbook/data.ts"() {
      init_storage();
      CLIPBOOK_JSON = "clipbook.json";
    }
  });

  // src/clipbook/write-queue.ts
  function enqueueNewsWrite(op) {
    return enqueueFileTask(getNewsFilePath(), op);
  }
  var init_write_queue = __esm({
    "src/clipbook/write-queue.ts"() {
      init_storage();
      init_news_data();
    }
  });

  // src/knowledge/source.ts
  function noteSourceName(path, name) {
    const explicit = String(name != null ? name : "").trim();
    if (explicit) return explicit;
    const base = String(path != null ? path : "").replace(/\\/g, "/").split("/").pop() || "";
    return stripMdExt(base) || String(path != null ? path : "");
  }
  function isUrlLikeSourceText(text) {
    const s = String(text != null ? text : "").trim();
    if (!s || /\s/.test(s)) return false;
    if (/^https?:\/\/\S+$/i.test(s)) return true;
    return URL_LIKE_RE.test(s);
  }
  function cleanUrlText(text) {
    return String(text != null ? text : "").trim().replace(/[，。！？；、,;.!?…'"’”\])}>】」』]+$/, "");
  }
  function normalizeSourceUrl(input) {
    const s = cleanUrlText(input);
    const m = s.match(/^(https?:\/\/)([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i);
    if (!m) return s;
    const [, scheme, host, path, query, hash] = m;
    const bare = host.toLowerCase().replace(/^www\./, "");
    if (bare === "b23.tv") return scheme + host + path;
    if (bare.endsWith("bilibili.com") && /^\/video\//.test(path)) {
      const keep = (query != null ? query : "").slice(1).split("&").filter((kv) => /^(p|t)=/.test(kv));
      return scheme + host + path + (keep.length ? "?" + keep.join("&") : "");
    }
    if (!query) return s;
    const kept = query.slice(1).split("&").filter(Boolean).filter((kv) => {
      const k = kv.split("=")[0].toLowerCase();
      return !k.startsWith("utm_") && !k.startsWith("spm_") && !TRACK_KEYS.has(k);
    });
    return scheme + host + path + (kept.length ? "?" + kept.join("&") : "") + (hash != null ? hash : "");
  }
  function decodeHtmlEntities(s) {
    return s.replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'").replace(/&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&");
  }
  function cleanSourceTitle(raw) {
    let t = decodeHtmlEntities(String(raw != null ? raw : "")).replace(/\s+/g, " ").trim();
    t = t.replace(/\s*[_\-–—|｜]\s*哔哩哔哩(?:_bilibili)?\s*$/i, "");
    t = t.replace(/\s*[_\-–—|｜]\s*bilibili\s*$/i, "");
    t = t.replace(/\s*[-–—|｜]\s*知乎(?:日报|专栏)?\s*$/, "");
    return t.trim();
  }
  function serializeTermSource(src) {
    var _a;
    if (!src) return null;
    if (src.kind === "external") {
      const url = normalizeSourceUrl(src.url);
      if (!url) return null;
      const out = { source: url };
      const title = src.title ? cleanSourceTitle(src.title) : "";
      if (title) out.sourceTitle = title;
      return out;
    }
    const path = String((_a = src.path) != null ? _a : "").trim();
    if (!path) return null;
    const name = noteSourceName(path, src.name);
    return { source: `[[${path}|${name}]]` };
  }
  var URL_LIKE_RE, TRACK_KEYS;
  var init_source = __esm({
    "src/knowledge/source.ts"() {
      init_utils();
      URL_LIKE_RE = /^(?:[\w-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/;
      TRACK_KEYS = /* @__PURE__ */ new Set([
        "vd_source",
        "vd_src",
        "seid",
        "unique_k",
        "from",
        "share_source",
        "share_medium",
        "share_token",
        "share_plat",
        "share_to",
        "share_from",
        "share_times",
        "gcid",
        "refer",
        "scene"
      ]);
    }
  });

  // src/knowledge/data.ts
  function normalizeLooseTime(t) {
    const s = (t != null ? t : "").trim();
    if (!s) return "";
    if (TIME_RE.test(s)) return s;
    const parts = s.split(/[:：.。\-—_、，,\s]+/).filter(Boolean);
    if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
    const [a, b, c] = parts;
    let canon;
    if (c !== void 0) canon = `${a}:${b.padStart(2, "0")}:${c.padStart(2, "0")}`;
    else if (b !== void 0) canon = `${a}:${b.padStart(2, "0")}`;
    else canon = `${a}:00`;
    return TIME_RE.test(canon) ? canon : null;
  }
  function normalizeUrl(raw) {
    return normalizeSourceUrl(cleanUrlText(raw));
  }
  var import_moment2, TIME_RE, KnowledgeData;
  var init_data2 = __esm({
    "src/knowledge/data.ts"() {
      import_moment2 = __toESM(require_moment());
      init_storage();
      init_settings_provider();
      init_utils();
      init_app();
      init_source();
      TIME_RE = /^\d{1,3}:\d{1,2}(:\d{1,2}(\.\d{1,3})?)?$/;
      KnowledgeData = {
        filePath: "",
        _store: null,
        /** 旧数据文件 literature.json → knowledge.json 一次性迁移（ADR-0112：只复制不改写，旧文件保留在原处） */
        _legacyMigrated: false,
        /** 初始化（幂等）：固化文件路径与 store。未调用时 read/write 按当前设置惰性补齐（统一数据读写重构） */
        init(settings) {
          const folder = (settings.storagePath || "CONFIG/STORAGE").trim().replace(/\/+$/, "");
          this.filePath = folder + "/knowledge.json";
          this._store = jsonFileStore(this.filePath);
        },
        /** 一次性迁移：knowledge.json 不存在而 literature.json 存在时原样复制一份（任务历史零丢失，ADR-0112） */
        async migrateLegacy() {
          if (this._legacyMigrated) return;
          this._legacyMigrated = true;
          try {
            const app = getApp();
            if (app.vault.getAbstractFileByPath(this.filePath)) return;
            const legacyPath = this.filePath.replace(/knowledge\.json$/, "literature.json");
            const legacy = app.vault.getAbstractFileByPath(legacyPath);
            if (legacy) await app.vault.create(this.filePath, await app.vault.read(legacy));
          } catch (e) {
          }
        },
        /** 惰性 store 获取：init 前调用时按当前设置补建（消除 init 前 _store 空指针） */
        _ensureStore() {
          var _a;
          if (!this._store) this.init({ storagePath: (_a = tryGetSettings()) == null ? void 0 : _a.storagePath });
          return this._store;
        },
        async read() {
          return this._ensureStore().read();
        },
        async write(data) {
          return this._ensureStore().write(data);
        },
        /** 读改写事务：fn 基于磁盘现值改动，整体入 per-path 串行队列（D3 原语 1） */
        async _mutate(fn) {
          return enqueueFileTask(this.filePath, async () => {
            const data = await this.read();
            const result = await fn(data);
            await this.write(data);
            return result;
          });
        },
        /** 全量读取并统一字段形状（缺省补默认值，旧/手改数据零迁移） */
        async loadTasks() {
          await this.migrateLegacy();
          return this._mutate(async (raw) => {
            let needWrite = false;
            const tasks = raw.map((item) => {
              if (!item.id) {
                item.id = generateId("knowledge-task");
                needWrite = true;
              }
              return {
                id: item.id,
                url: item.url || "",
                start: item.start || null,
                end: item.end || null,
                status: item.status || "pending",
                reason: item.reason || null,
                remark: item.remark || null,
                notePath: item.notePath || null,
                videoPath: item.videoPath || null,
                created: item.created || (0, import_moment2.default)().format("YYYY-MM-DD HH:mm:ss"),
                processedAt: item.processedAt || null,
                title: item.title || null,
                uploader: item.uploader || null,
                archived: item.archived === true,
                archivedAt: item.archivedAt || null,
                quality: item.quality || null,
                page: Number.isInteger(item.page) && Number(item.page) > 0 ? Number(item.page) : null
              };
            });
            if (needWrite) await this.write(raw);
            return tasks;
          });
        },
        /** 追加一条待处理任务（队列尾 = 处理顺序尾） */
        addTask(input) {
          var _a, _b, _c, _d, _e;
          const task = {
            id: generateId("knowledge-task"),
            url: normalizeUrl(input.url),
            start: ((_a = input.start) == null ? void 0 : _a.trim()) || null,
            end: ((_b = input.end) == null ? void 0 : _b.trim()) || null,
            status: "pending",
            reason: null,
            remark: ((_c = input.remark) == null ? void 0 : _c.trim()) || null,
            title: ((_d = input.title) == null ? void 0 : _d.trim()) || null,
            uploader: ((_e = input.uploader) == null ? void 0 : _e.trim()) || null,
            notePath: null,
            videoPath: null,
            created: (0, import_moment2.default)().format("YYYY-MM-DD HH:mm:ss"),
            processedAt: null,
            archived: false,
            archivedAt: null,
            quality: input.quality || null,
            page: Number.isInteger(input.page) && Number(input.page) > 0 ? Number(input.page) : null
          };
          return this._mutate((data) => {
            data.push(task);
            return task;
          });
        },
        updateTask(id, patch) {
          return this._mutate(async (data) => {
            const idx = data.findIndex((d) => d.id === id);
            if (idx === -1) throw new Error("任务不存在");
            data[idx] = { ...data[idx], ...patch, id: data[idx].id };
          }).then(() => void 0);
        },
        async deleteTask(id) {
          await this._mutate((data) => {
            const idx = data.findIndex((d) => d.id === id);
            if (idx !== -1) data.splice(idx, 1);
          });
        },
        /** 重试：失败/中止项回到待处理（保留旧结果字段，下次成功覆盖） */
        async retryTask(id) {
          await this.updateTask(id, {
            status: "pending",
            reason: null,
            processedAt: null
          });
        },
        /** 清空历史（archived 条目；主列表待处理/失败项不受影响，ADR-0067） */
        async clearHistory() {
          await this._mutate((data) => {
            for (let i = data.length - 1; i >= 0; i--) {
              if (data[i].archived === true) data.splice(i, 1);
            }
          });
        }
      };
    }
  });

  // src/core/mobile.ts
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
  }
  var init_mobile = __esm({
    "src/core/mobile.ts"() {
      init_fake_obsidian();
    }
  });

  // src/core/item-actions.ts
  function renderIcon(container, iconId) {
    try {
      setIcon(container, iconId);
    } catch (e) {
    }
  }
  function inSheetCompanion(target) {
    for (const c of sheetCompanions) {
      if (c.isConnected && c.contains(target)) return true;
    }
    return false;
  }
  function onMouseDownCapture(ev) {
    if (touchSettlePending) return;
    if (popupEl && popupEl.isConnected && !popupEl.contains(ev.target) && !inSheetCompanion(ev.target)) {
      closeItemMenu();
    }
  }
  function onMouseUpCapture(ev) {
    if (!suppressNextClick) return;
    if (popupEl && popupEl.isConnected && popupEl.contains(ev.target)) return;
    suppressNextClick = false;
    residualClickArmed = true;
  }
  function onClickCapture(ev) {
    const target = ev.target;
    if (residualClickArmed) {
      residualClickArmed = false;
      ev.stopImmediatePropagation();
      ev.preventDefault();
      return;
    }
    if (touchSettlePending) {
      const inPopup = popupEl != null && popupEl.contains(target) || sheetMask != null && sheetMask.contains(target);
      touchSettlePending = false;
      if (inPopup) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        return;
      }
    }
    if (popupEl && popupEl.isConnected && !popupEl.contains(target) && !inSheetCompanion(target)) {
      closeItemMenu();
    }
  }
  function closeItemMenu() {
    if (menuEsc) {
      menuEsc.unregister();
      menuEsc = null;
    }
    if (touchSettleTimer) {
      clearTimeout(touchSettleTimer);
      touchSettleTimer = null;
    }
    document.removeEventListener("mousedown", onMouseDownCapture, true);
    document.removeEventListener("mouseup", onMouseUpCapture, true);
    document.removeEventListener("click", onClickCapture, true);
    if (sheetMask) {
      sheetMask.remove();
      sheetMask = null;
    }
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
    sheetBodyEl = null;
    sheetHeadEl = null;
    suppressNextClick = false;
    residualClickArmed = false;
    touchSettlePending = false;
    if (prevFocus && prevFocus.isConnected && document.activeElement === document.body) {
      prevFocus.focus();
    }
    prevFocus = null;
  }
  function armTouchSettle() {
    touchSettlePending = true;
    if (touchSettleTimer) clearTimeout(touchSettleTimer);
    touchSettleTimer = setTimeout(() => {
      touchSettlePending = false;
      touchSettleTimer = null;
    }, TOUCH_SETTLE_MS);
  }
  function attachPopupListeners(id) {
    document.addEventListener("mousedown", onMouseDownCapture, true);
    document.addEventListener("mouseup", onMouseUpCapture, true);
    document.addEventListener("click", onClickCapture, true);
    menuEsc = escManager.register(id, {
      isVisible: () => !!(popupEl && popupEl.isConnected),
      close: closeItemMenu
    });
  }
  function positionMenu(m, x, y) {
    const mw = m.offsetWidth || 168;
    const mh = m.offsetHeight || m.children.length * ITEM_HEIGHT + MENU_PADDING;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    let left = x + ANCHOR_GAP;
    let top = y + ANCHOR_GAP;
    if (vw && left + mw > vw - VIEWPORT_PAD) left = Math.max(VIEWPORT_PAD, x - mw - ANCHOR_GAP);
    if (vh && top + mh > vh - VIEWPORT_PAD) top = Math.max(VIEWPORT_PAD, y - mh - ANCHOR_GAP);
    if (vw) left = Math.min(Math.max(left, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, vw - mw - VIEWPORT_PAD));
    if (vh) top = Math.min(Math.max(top, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, vh - mh - VIEWPORT_PAD));
    m.style.left = `${left}px`;
    m.style.top = `${top}px`;
  }
  function attachItemKeyboardNav(host, scope) {
    host.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(scope.querySelectorAll("button"));
      if (items.length === 0) return;
      e.preventDefault();
      const idx = items.indexOf(document.activeElement);
      const next = idx === -1 ? 0 : e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[next].focus();
    });
  }
  function focusMenuFirst(host, scope) {
    prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = scope.querySelector("button");
    if (first) first.focus();
    attachItemKeyboardNav(host, scope);
  }
  function openItemMenu(x, y, actions, suppressResidualClick = false, menuClass, menuHeadHtml) {
    closeItemMenu();
    const m = document.createElement("div");
    m.className = "bz-item-menu" + (menuClass ? " " + menuClass : "");
    m.style.visibility = "hidden";
    if (menuHeadHtml) {
      const head = document.createElement("div");
      head.className = "bz-item-menu-head";
      head.innerHTML = menuHeadHtml;
      m.appendChild(head);
      const sep = document.createElement("div");
      sep.className = "bz-item-menu-sep";
      m.appendChild(sep);
    }
    for (const a of actions) {
      const item = document.createElement("button");
      item.type = "button";
      if (a.title) item.title = a.title;
      item.className = "bz-item-menu-item" + (a.kind === "danger" ? " bz-item-menu-item--danger" : "") + (a.tone === "accent" ? " bz-item-menu-item--accent" : "");
      const itemIcon = document.createElement("span");
      itemIcon.className = "bz-item-menu-icon";
      renderIcon(itemIcon, a.icon);
      const itemLabel = document.createElement("span");
      itemLabel.className = "bz-item-menu-label";
      itemLabel.textContent = a.label;
      item.appendChild(itemIcon);
      item.appendChild(itemLabel);
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeItemMenu();
        a.onClick();
      });
      m.appendChild(item);
    }
    m.style.zIndex = String(allocZ());
    document.body.appendChild(m);
    positionMenu(m, x, y);
    m.style.visibility = "visible";
    popupEl = m;
    suppressNextClick = suppressResidualClick;
    residualClickArmed = false;
    if (!suppressResidualClick) armTouchSettle();
    attachPopupListeners("bz-item-menu");
    focusMenuFirst(m, m);
  }
  function buildSheetItem(a) {
    const item = document.createElement("button");
    item.type = "button";
    if (a.title) item.title = a.title;
    item.className = "bz-item-sheet-item" + (a.kind === "danger" ? " bz-item-sheet-item--danger" : "") + (a.tone === "accent" ? " bz-item-sheet-item--accent" : "");
    const itemIcon = document.createElement("span");
    itemIcon.className = "bz-item-sheet-icon";
    renderIcon(itemIcon, a.icon);
    const itemLabel = document.createElement("span");
    itemLabel.className = "bz-item-sheet-label";
    itemLabel.textContent = a.label;
    item.appendChild(itemIcon);
    item.appendChild(itemLabel);
    if (a.sub) {
      const itemSub = document.createElement("span");
      itemSub.className = "bz-item-sheet-item-sub";
      itemSub.textContent = a.sub;
      item.appendChild(itemSub);
    }
    item.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (a.keepOpen) {
        a.onClick();
        return;
      }
      closeItemMenu();
      a.onClick();
    });
    return item;
  }
  function openItemSheet(actions, opts, suppressResidualClick = false) {
    closeItemMenu();
    const mask = document.createElement("div");
    mask.className = "bz-item-sheet-mask";
    const sheet = document.createElement("div");
    sheet.className = "bz-item-sheet" + ((opts == null ? void 0 : opts.sheetClass) ? " " + opts.sheetClass : "");
    if (opts == null ? void 0 : opts.sheetHead) {
      const head = document.createElement("div");
      head.className = "bz-item-sheet-head";
      head.appendChild(opts.sheetHead);
      sheet.appendChild(head);
      sheetHeadEl = head;
    } else if (opts == null ? void 0 : opts.sheetTitle) {
      const head = document.createElement("div");
      head.className = "bz-item-sheet-head";
      const titleEl = document.createElement("div");
      titleEl.className = "bz-item-sheet-title";
      titleEl.textContent = opts.sheetTitle;
      head.appendChild(titleEl);
      if (opts.sheetSub) {
        const subEl = document.createElement("div");
        subEl.className = "bz-item-sheet-sub";
        subEl.textContent = opts.sheetSub;
        head.appendChild(subEl);
      }
      sheet.appendChild(head);
      sheetHeadEl = head;
    }
    const body = document.createElement("div");
    body.className = "bz-item-sheet-body";
    for (const a of actions) {
      body.appendChild(buildSheetItem(a));
    }
    sheet.appendChild(body);
    mask.style.zIndex = String(allocZ());
    sheet.style.zIndex = String(allocZ());
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    popupEl = sheet;
    sheetMask = mask;
    sheetBodyEl = body;
    suppressNextClick = suppressResidualClick;
    residualClickArmed = false;
    if (!suppressResidualClick) armTouchSettle();
    attachPopupListeners("bz-item-sheet");
    attachSheetDismiss(sheet, body);
    focusMenuFirst(sheet, body);
  }
  function attachSheetDismiss(sheet, body) {
    const CLOSE_AT = 80;
    let startY = 0;
    let dragging = false;
    let dy = 0;
    const reset = () => {
      dragging = false;
      dy = 0;
      sheet.style.transform = "";
      sheet.classList.remove("bz-item-sheet--dragging");
    };
    sheet.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        startY = t.clientY;
        dragging = true;
        dy = 0;
      },
      { passive: true }
    );
    sheet.addEventListener(
      "touchmove",
      (e) => {
        if (!dragging) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        const cur = t.clientY - startY;
        if (cur <= 0) {
          if (dy !== 0) reset();
          return;
        }
        if (body.scrollTop > 0 && body.contains(e.target)) {
          if (dy !== 0) reset();
          return;
        }
        dy = cur;
        e.preventDefault();
        sheet.classList.add("bz-item-sheet--dragging");
        sheet.style.transform = `translateY(${dy}px)`;
        if (sheetMask) sheetMask.style.opacity = String(Math.max(0, 1 - dy / 400));
      },
      { passive: false }
    );
    const onTouchEnd = () => {
      if (!dragging) return;
      const over = dy > CLOSE_AT;
      dragging = false;
      if (over) {
        sheet.classList.remove("bz-item-sheet--dragging");
        const s = sheet;
        s.style.transform = "translateY(100%)";
        if (sheetMask) sheetMask.style.opacity = "0";
        setTimeout(() => {
          if (popupEl === s) closeItemMenu();
        }, 180);
      } else {
        reset();
        if (sheetMask) sheetMask.style.opacity = "1";
      }
      dy = 0;
    };
    sheet.addEventListener("touchend", onTouchEnd);
    sheet.addEventListener("touchcancel", () => {
      reset();
      if (sheetMask) sheetMask.style.opacity = "1";
    });
  }
  function attachItemActions(card, actions, opts) {
    if (!card || actions.length === 0) return;
    card.classList.add("bz-item-card");
    card.addEventListener("contextmenu", (e) => {
      if (isMobileEnv()) return;
      if ((opts == null ? void 0 : opts.longPressFilter) && !opts.longPressFilter(e)) return;
      e.preventDefault();
      openItemMenu(e.clientX, e.clientY, actions, true, opts == null ? void 0 : opts.menuClass, opts == null ? void 0 : opts.menuHeadHtml);
      suppressNextClick = false;
    });
    longPress(
      card,
      (ev) => {
        if (!isMobileEnv()) return;
        openItemSheet(actions, opts, ev.type !== "touchstart");
      },
      void 0,
      opts == null ? void 0 : opts.longPressFilter
    );
  }
  var VIEWPORT_PAD, ANCHOR_GAP, ITEM_HEIGHT, MENU_PADDING, TOUCH_SETTLE_MS, popupEl, sheetMask, sheetBodyEl, sheetHeadEl, sheetCompanions, menuEsc, prevFocus, suppressNextClick, residualClickArmed, touchSettlePending, touchSettleTimer;
  var init_item_actions = __esm({
    "src/core/item-actions.ts"() {
      init_dom();
      init_esc_manager();
      init_z_order();
      init_mobile();
      init_fake_obsidian();
      VIEWPORT_PAD = 8;
      ANCHOR_GAP = 12;
      ITEM_HEIGHT = 30;
      MENU_PADDING = 10;
      TOUCH_SETTLE_MS = 400;
      popupEl = null;
      sheetMask = null;
      sheetBodyEl = null;
      sheetHeadEl = null;
      sheetCompanions = /* @__PURE__ */ new Set();
      menuEsc = null;
      prevFocus = null;
      suppressNextClick = false;
      residualClickArmed = false;
      touchSettlePending = false;
      touchSettleTimer = null;
    }
  });

  // src/core/ui/suggest.ts
  function uiSuggest(opts) {
    var _a;
    const anchor = opts.anchor;
    const max = (_a = opts.max) != null ? _a : 30;
    let layer = null;
    let skipNextOpen = false;
    const close = () => {
      if (!layer) return;
      layer.remove();
      layer = null;
      document.removeEventListener("mousedown", onDocDown, true);
    };
    const onDocDown = (e) => {
      const t = e.target;
      if (!anchor.isConnected) {
        close();
        return;
      }
      if ((layer == null ? void 0 : layer.contains(t)) || anchor.contains(t)) return;
      close();
    };
    const pick = (raw) => {
      var _a2;
      anchor.value = raw;
      close();
      (_a2 = opts.onPick) == null ? void 0 : _a2.call(opts, raw);
      if (document.activeElement !== anchor) {
        skipNextOpen = true;
        anchor.focus();
      }
    };
    const draw = () => {
      if (!layer) return;
      const cur = anchor.value.trim();
      const q2 = cur.toLowerCase();
      const matched = opts.source().filter((s) => (!opts.excludeCurrent || s !== cur) && (!q2 || s.toLowerCase().includes(q2))).slice(0, max);
      if (!matched.length) {
        close();
        return;
      }
      layer.replaceChildren();
      matched.forEach((raw) => {
        var _a2;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bz-popover-item";
        b.dataset.value = raw;
        b.setAttribute("role", "option");
        const on = raw === cur;
        if (on) b.classList.add("is-on");
        const icon = (_a2 = opts.iconOf) == null ? void 0 : _a2.call(opts, raw);
        if (icon) {
          const ic = document.createElement("span");
          ic.className = "bz-suggest-ic";
          if (typeof icon === "string") ic.textContent = icon;
          else ic.appendChild(icon);
          b.appendChild(ic);
        }
        const label = document.createElement("span");
        label.textContent = opts.labelOf ? opts.labelOf(raw) : raw;
        b.appendChild(label);
        b.addEventListener("click", () => pick(raw));
        layer.appendChild(b);
      });
    };
    const open = () => {
      if (skipNextOpen) {
        skipNextOpen = false;
        return;
      }
      if (layer) {
        draw();
        return;
      }
      const m = document.createElement("div");
      m.className = "bz-popover";
      m.setAttribute("role", "listbox");
      (anchor.parentElement || anchor).appendChild(m);
      layer = m;
      document.addEventListener("mousedown", onDocDown, true);
      draw();
    };
    const activeIdx = () => {
      var _a2;
      return [...(_a2 = layer == null ? void 0 : layer.querySelectorAll(".bz-popover-item")) != null ? _a2 : []].findIndex((o) => o.classList.contains("is-on"));
    };
    const moveActive = (to) => {
      var _a2, _b;
      const items = [...(_a2 = layer == null ? void 0 : layer.querySelectorAll(".bz-popover-item")) != null ? _a2 : []];
      if (!items.length) return;
      const next = items[Math.max(0, Math.min(items.length - 1, to))];
      items.forEach((o) => o.classList.toggle("is-on", o === next));
      (_b = next.scrollIntoView) == null ? void 0 : _b.call(next, { block: "nearest" });
    };
    anchor.addEventListener("focus", open);
    anchor.addEventListener("input", () => {
      skipNextOpen = false;
      open();
    });
    anchor.addEventListener("keydown", (e) => {
      if (!layer) return;
      if (e.key === "ArrowDown") {
        moveActive(activeIdx() + 1);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        moveActive(activeIdx() < 0 ? layer.querySelectorAll(".bz-popover-item").length - 1 : activeIdx() - 1);
        e.preventDefault();
      } else if (e.key === "Enter") {
        const on = layer.querySelector(".bz-popover-item.is-on");
        if (on) pick(on.dataset.value);
        e.preventDefault();
      } else if (e.key === "Escape") {
        close();
        e.stopPropagation();
      }
    });
    return {
      close,
      /** 清理：关浮层并摘 document 监听（宿主收尾用；anchor 随表单移除时下次外点自清） */
      detach: () => {
        close();
      }
    };
  }
  var init_suggest = __esm({
    "src/core/ui/suggest.ts"() {
    }
  });

  // src/core/ai.ts
  function getQ3Settings() {
    return _settingsProvider ? _settingsProvider() : {};
  }
  function getProviderDescriptor(id) {
    return AI_PROVIDER_REGISTRY.find((p) => p.id === id) || AI_PROVIDER_REGISTRY.find((p) => p.id === "custom") || AI_PROVIDER_REGISTRY[AI_PROVIDER_REGISTRY.length - 1];
  }
  async function getAIProvider(override) {
    var _a, _b, _c;
    if (!override && _aiProviderCache) return _aiProviderCache;
    const cacheable = !override;
    const cachePut = (p) => {
      if (cacheable) _aiProviderCache = p;
      return p;
    };
    const s = getQ3Settings();
    if (override && typeof override === "object" && override.apiKey) {
      return {
        endpoint: String(override.endpoint || "https://api.deepseek.com").replace(/\/+$/, ""),
        apiKey: override.apiKey,
        model: override.model || void 0,
        extraHeaders: override.extraHeaders || void 0,
        contextWindow: override.contextWindow,
        defaultMaxTokens: override.defaultMaxTokens
      };
    }
    const name = typeof override === "string" && override || s.aiProvider || "opencode-go";
    const desc = getProviderDescriptor(name);
    if (name === "custom") {
      const endpoint = (s.aiCustomEndpoint || "").replace(/\/+$/, "");
      if (!endpoint || !s.aiCustomApiKey) {
        throw new Error("未配置自定义 AI 服务：请填写 API 地址与密钥（插件设置 → AI 配置）");
      }
      return cachePut({
        endpoint,
        apiKey: s.aiCustomApiKey,
        model: s.aiCustomModel || void 0,
        extraHeaders: desc.extraHeaders,
        contextWindow: desc.defaultContextWindow,
        defaultMaxTokens: desc.defaultMaxTokens
      });
    }
    const key = s[desc.apiKeyKey];
    if (!key && name === "deepseek") {
      try {
        const raw = await getApp().vault.adapter.read(".obsidian/plugins/quickadd/data.json");
        const cfg = JSON.parse(raw);
        const provider = cfg.ai && cfg.ai.providers && cfg.ai.providers[0];
        if (provider && provider.endpoint && provider.apiKey) {
          return cachePut({
            endpoint: String(provider.endpoint).replace(/\/+$/, ""),
            apiKey: provider.apiKey,
            contextWindow: desc.defaultContextWindow,
            defaultMaxTokens: desc.defaultMaxTokens
          });
        }
      } catch (e) {
      }
    }
    if (!key && name !== "ollama") {
      throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
    }
    const overrideModel = (_a = s.aiModelOverrides) == null ? void 0 : _a[name];
    const overrideContext = (_b = s.aiContextOverrides) == null ? void 0 : _b[name];
    const overrideMaxTokens = (_c = s.aiMaxTokensOverrides) == null ? void 0 : _c[name];
    return cachePut({
      endpoint: desc.endpoint,
      apiKey: key || "",
      model: overrideModel || desc.model || void 0,
      noCors: desc.noCors,
      extraHeaders: desc.extraHeaders,
      contextWindow: overrideContext || desc.defaultContextWindow,
      defaultMaxTokens: overrideMaxTokens || desc.defaultMaxTokens
    });
  }
  function abortError() {
    const e = new Error("请求已取消");
    e.name = "AbortError";
    return e;
  }
  function timeoutError() {
    const e = new Error(`AI 请求超时（${AI_IDLE_TIMEOUT_MS / 1e3} 秒无响应）`);
    e.name = "TimeoutError";
    return e;
  }
  async function streamChatCompletions(provider, body, signal, onDelta) {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...provider.extraHeaders || {}
    };
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    let outerLinked = false;
    if (signal) {
      if (signal.aborted) controller.abort();
      else {
        signal.addEventListener("abort", onOuterAbort);
        outerLinked = true;
      }
    }
    let idleTimer = null;
    const armIdle = () => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), AI_IDLE_TIMEOUT_MS);
    };
    try {
      armIdle();
      const resp = await fetch(`${provider.endpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!resp.ok) {
        let msg = `API ${resp.status}`;
        try {
          const err = await resp.json();
          if (err.error && err.error.message) msg = err.error.message;
        } catch (e) {
        }
        throw new Error(msg);
      }
      if (!resp.body || typeof resp.body.getReader !== "function") {
        const data = await resp.json();
        return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "";
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "", buf = "";
      while (true) {
        armIdle();
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            try {
              reader.cancel();
            } catch (e) {
            }
            return full;
          }
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
            if (delta) {
              full += delta;
              try {
                onDelta == null ? void 0 : onDelta(delta);
              } catch (e) {
              }
            }
          } catch (e) {
          }
        }
      }
      return full;
    } catch (e) {
      if (controller.signal.aborted && !(signal && signal.aborted)) throw timeoutError();
      throw e;
    } finally {
      if (idleTimer !== null) clearTimeout(idleTimer);
      if (outerLinked && signal) signal.removeEventListener("abort", onOuterAbort);
    }
  }
  async function chatCompletionsNonStream(provider, body, signal) {
    if (signal == null ? void 0 : signal.aborted) throw abortError();
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...provider.extraHeaders || {}
    };
    const resp = await new Promise((resolve2, reject) => {
      let timer = null;
      const settle = (fn) => {
        if (timer !== null) clearTimeout(timer);
        fn();
      };
      timer = setTimeout(() => settle(() => reject(timeoutError())), AI_IDLE_TIMEOUT_MS);
      requestUrl({
        url: `${provider.endpoint}/chat/completions`,
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, stream: false })
      }).then(
        (r) => settle(() => resolve2(r)),
        (e) => settle(() => reject(e))
      );
    });
    if (signal == null ? void 0 : signal.aborted) throw abortError();
    const data = JSON.parse(resp.text);
    const errMsg = data.error && (data.error.message || data.error.type) || data.message && data.message;
    if (errMsg) throw new Error(`API ${resp.status}: ${errMsg}`);
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (content === void 0 || content === null) throw new Error(`API ${resp.status}: 响应缺少 content`);
    return content;
  }
  function createAI(params, defaultModel = "deepseek-v4-flash", defaultOptions = {}, defaultMaxTokens = 8192) {
    const internalDefaultOptions = {
      modelOptions: {
        max_tokens: defaultMaxTokens,
        ...defaultOptions.modelOptions || {}
      }
    };
    const mergedOptions = { ...internalDefaultOptions, ...defaultOptions };
    if (defaultOptions.modelOptions) {
      mergedOptions.modelOptions = {
        ...internalDefaultOptions.modelOptions,
        ...defaultOptions.modelOptions
      };
    }
    return new AIService(params, defaultModel, mergedOptions);
  }
  var _settingsProvider, AI_PROVIDER_REGISTRY, _aiProviderCache, AI_IDLE_TIMEOUT_MS, AIService;
  var init_ai = __esm({
    "src/core/ai.ts"() {
      init_fake_obsidian();
      init_app();
      _settingsProvider = null;
      AI_PROVIDER_REGISTRY = [
        {
          id: "deepseek",
          label: "DeepSeek",
          endpoint: "https://api.deepseek.com",
          model: "",
          // 空 = 沿用调用方默认模型（原行为：deepseek 不强制模型）
          defaultMaxTokens: 8192,
          defaultContextWindow: 65536,
          apiKeyKey: "deepseekApiKey",
          apiKeyLabel: "DeepSeek 密钥",
          apiKeyDesc: "留空则自动回退读取外部配置密钥"
        },
        {
          id: "opencode-go",
          label: "OpenCode Go",
          endpoint: "https://opencode.ai/zen/go/v1",
          model: "deepseek-v4-flash",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "opencodeGoApiKey",
          apiKeyLabel: "OpenCode 密钥",
          apiKeyDesc: "在订阅官网获取后填入这里",
          noCors: true
        },
        {
          id: "openai",
          label: "OpenAI",
          endpoint: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          defaultMaxTokens: 16384,
          defaultContextWindow: 128e3,
          apiKeyKey: "openaiApiKey",
          apiKeyLabel: "OpenAI 密钥",
          apiKeyDesc: "在 OpenAI 官网获取后填入这里"
        },
        {
          id: "anthropic",
          label: "Anthropic（Claude）",
          endpoint: "https://api.anthropic.com/v1",
          model: "claude-sonnet-4-5",
          defaultMaxTokens: 64e3,
          // claude-sonnet-4-5 最大输出上限 64K（ticket 172 默认最大值）
          defaultContextWindow: 2e5,
          apiKeyKey: "anthropicApiKey",
          apiKeyLabel: "Anthropic 密钥",
          apiKeyDesc: "在 Anthropic 官网获取后填入这里",
          extraHeaders: { "anthropic-version": "2023-06-01" }
        },
        {
          id: "google",
          label: "Google Gemini",
          endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
          model: "gemini-2.0-flash",
          defaultMaxTokens: 8192,
          defaultContextWindow: 1048576,
          apiKeyKey: "googleApiKey",
          apiKeyLabel: "Gemini 密钥",
          apiKeyDesc: "在 Google AI Studio 获取后填入这里"
        },
        {
          id: "moonshot",
          label: "Moonshot（Kimi）",
          endpoint: "https://api.moonshot.cn/v1",
          model: "kimi-k2-0711-preview",
          defaultMaxTokens: 131072,
          // kimi-k2 最大输出上限 128K（ticket 172 默认最大值）
          defaultContextWindow: 131072,
          apiKeyKey: "moonshotApiKey",
          apiKeyLabel: "Kimi 密钥",
          apiKeyDesc: "在 Moonshot 开放平台获取后填入这里"
        },
        {
          id: "zhipu",
          label: "智谱（GLM）",
          endpoint: "https://open.bigmodel.cn/api/paas/v4",
          model: "glm-4-flash",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "zhipuApiKey",
          apiKeyLabel: "智谱密钥",
          apiKeyDesc: "在智谱开放平台获取后填入这里"
        },
        {
          id: "dashscope",
          label: "阿里云百炼（通义）",
          endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          model: "qwen-plus",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "dashscopeApiKey",
          apiKeyLabel: "百炼密钥",
          apiKeyDesc: "在阿里云百炼获取 API Key 后填入这里"
        },
        {
          id: "siliconflow",
          label: "硅基流动",
          endpoint: "https://api.siliconflow.cn/v1",
          model: "deepseek-ai/DeepSeek-V3",
          defaultMaxTokens: 8192,
          defaultContextWindow: 65536,
          apiKeyKey: "siliconflowApiKey",
          apiKeyLabel: "硅基流动密钥",
          apiKeyDesc: "在硅基流动官网获取后填入这里"
        },
        {
          id: "openrouter",
          label: "OpenRouter",
          endpoint: "https://openrouter.ai/api/v1",
          model: "deepseek/deepseek-chat",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "openrouterApiKey",
          apiKeyLabel: "OpenRouter 密钥",
          apiKeyDesc: "在 OpenRouter 官网获取后填入这里"
        },
        {
          id: "xai",
          label: "xAI（Grok）",
          endpoint: "https://api.x.ai/v1",
          model: "grok-2-latest",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "xaiApiKey",
          apiKeyLabel: "xAI 密钥",
          apiKeyDesc: "在 xAI 控制台获取后填入这里"
        },
        {
          id: "groq",
          label: "Groq",
          endpoint: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "groqApiKey",
          apiKeyLabel: "Groq 密钥",
          apiKeyDesc: "在 Groq 控制台获取后填入这里"
        },
        {
          id: "mistral",
          label: "Mistral",
          endpoint: "https://api.mistral.ai/v1",
          model: "mistral-large-latest",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "mistralApiKey",
          apiKeyLabel: "Mistral 密钥",
          apiKeyDesc: "在 Mistral 控制台获取后填入这里"
        },
        {
          id: "together",
          label: "Together AI",
          endpoint: "https://api.together.xyz/v1",
          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "togetherApiKey",
          apiKeyLabel: "Together 密钥",
          apiKeyDesc: "在 Together AI 官网获取后填入这里"
        },
        {
          id: "ollama",
          label: "Ollama（本地）",
          endpoint: "http://localhost:11434/v1",
          model: "llama3.1",
          defaultMaxTokens: 8192,
          defaultContextWindow: 32768,
          apiKeyKey: "ollamaApiKey",
          apiKeyLabel: "Ollama 密钥",
          apiKeyDesc: "本地服务无需密钥，留空即可"
        },
        {
          id: "custom",
          label: "自定义（OpenAI 兼容）",
          endpoint: "",
          model: "",
          defaultMaxTokens: 8192,
          defaultContextWindow: 32768,
          apiKeyKey: "aiCustomApiKey",
          apiKeyLabel: "自定义 API 密钥",
          apiKeyDesc: "在服务官网获取后填入这里"
        }
      ];
      _aiProviderCache = null;
      AI_IDLE_TIMEOUT_MS = 6e4;
      AIService = class {
        constructor(params, defaultModel = "deepseek-v4-flash", defaultOptions = {}) {
          this.defaultModel = defaultModel;
          this.defaultOptions = defaultOptions;
        }
        /** 通用 AI 请求（fetch 流式，失败自动 fallback requestUrl 非流式）；
         *  options.signal（取消）/ options.onDelta（流式增量回调）为调用方选项（ticket 141），不进请求体，
         *  既有调用（不传这两项）行为零变化 */
        async prompt(promptText, model = this.defaultModel, options = {}) {
          var _a;
          const mergedOptions = this._mergeOptions(options);
          const provider = await getAIProvider(mergedOptions.provider);
          const s = getQ3Settings();
          const isExplicit = model !== this.defaultModel;
          const effModel = isExplicit ? model : provider.model || model;
          const mo = mergedOptions.modelOptions || {};
          const effMaxTokens = (_a = mo.max_tokens) != null ? _a : provider.defaultMaxTokens || 4096;
          const body = {
            model: effModel,
            messages: [{ role: "user", content: promptText }],
            max_tokens: effMaxTokens,
            stream: true
          };
          for (const k of Object.keys(mo)) {
            if (k === "max_tokens") continue;
            body[k] = mo[k];
          }
          const signal = mergedOptions.signal instanceof AbortSignal ? mergedOptions.signal : void 0;
          const onDelta = typeof mergedOptions.onDelta === "function" ? mergedOptions.onDelta : void 0;
          try {
            const content = provider.noCors ? await chatCompletionsNonStream(provider, body, signal) : await streamChatCompletions(provider, body, signal, onDelta);
            return content;
          } catch (streamError) {
            if (signal == null ? void 0 : signal.aborted) throw streamError;
            try {
              const content = await chatCompletionsNonStream(provider, body, signal);
              return content;
            } catch (e) {
              throw new Error(`AI 请求失败: ${streamError.message}（fallback: ${e.message}）`);
            }
          }
        }
        /** 普通对话模型（deepseek-v4-flash） */
        async chat(promptText, extraOptions = {}) {
          return this.prompt(promptText, "deepseek-v4-flash", extraOptions);
        }
        /** 推理模型，自动开启思考模式 */
        async reason(promptText, extraOptions = {}) {
          const options = this._prepareOptions(extraOptions, { enable_thinking: true });
          return this.prompt(promptText, "deepseek-v4-flash", options);
        }
        /** 联网搜索（实验性，第三方代理平台生效） */
        async search(promptText, extraOptions = {}) {
          const options = this._prepareOptions(extraOptions, { search: true });
          return this.prompt(promptText, "deepseek-v4-flash", options);
        }
        /** 要求 AI 返回 JSON 格式（设置 response_format） */
        async json(promptText, extraOptions = {}) {
          const options = this._prepareOptions(extraOptions, {
            response_format: { type: "json_object" }
          });
          return this.prompt(promptText, "deepseek-v4-flash", options);
        }
        /** 思考 + 联网搜索（实验性） */
        async reasonAndSearch(promptText, extraOptions = {}) {
          const options = this._prepareOptions(extraOptions, {
            enable_thinking: true,
            search: true
          });
          return this.prompt(promptText, "deepseek-v4-flash", options);
        }
        setDefaultModel(model) {
          this.defaultModel = model;
        }
        setDefaultOptions(options) {
          this.defaultOptions = options;
        }
        // ---------- 内部辅助方法 ----------
        _mergeOptions(options) {
          const merged = { ...this.defaultOptions, ...options };
          if (this.defaultOptions.modelOptions || options.modelOptions) {
            merged.modelOptions = {
              ...this.defaultOptions.modelOptions || {},
              ...options.modelOptions || {}
            };
          }
          return merged;
        }
        /** 准备选项：复制 extraOptions，并设置指定的 modelOptions 字段（用户显式传入优先） */
        _prepareOptions(extraOptions, modelSettings) {
          const options = { ...extraOptions };
          if (!options.modelOptions) options.modelOptions = {};
          const userModelOpts = options.modelOptions;
          options.modelOptions = { ...modelSettings, ...userModelOpts };
          return options;
        }
      };
    }
  });

  // src/knowledge/note-gen.ts
  function parseDomainList(raw) {
    return [...new Set(String(raw != null ? raw : "").split(/[,，、]/).map((s) => s.trim()).filter(Boolean))];
  }
  function quoteYaml(s) {
    return '"' + String(s != null ? s : "").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }
  function sanitizeMdTitle(s) {
    const t = String(s != null ? s : "").replace(/[\\/:*?"<>|#^[\]]/g, "_").replace(/\s+/g, " ").trim().slice(0, 50);
    return t || "文献笔记";
  }
  function chunkTranscript(text, maxLen = 4e3) {
    const src = String(text || "").trim();
    if (!src) return [];
    const segs = src.split(/(?<=[。！？!?；;])/).map((s) => s.trim()).filter(Boolean);
    const chunks = [];
    let cur = "";
    for (const seg of segs) {
      if (cur && (cur + seg).length > maxLen) {
        chunks.push(cur);
        cur = "";
      }
      if (seg.length <= maxLen) {
        cur += seg;
        continue;
      }
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      let rest = seg;
      while (rest.length > maxLen) {
        chunks.push(rest.slice(0, maxLen));
        rest = rest.slice(maxLen);
      }
      cur = rest;
    }
    if (cur) chunks.push(cur);
    return chunks;
  }
  function parseAiJson(raw) {
    const cleaned = String(raw || "").replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
    }
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e) {
      }
    }
    throw new Error("AI 返回的不是 JSON：" + cleaned.slice(0, 120));
  }
  function domainInstruction(list) {
    if (!list.length) return '"domain": "领域，用一个中文词（如 物理/医学/心理/计算机/经济/文史哲 等）"';
    return `"domain": "从以下领域选一个最贴近的：${list.join("、")}；都不贴切可写一个新的中文领域词"`;
  }
  function nowStamp() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function withTimeout(p, ms, label) {
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => reject(new Error(`AI 请求超时（${label}，${ms}ms）`)), ms);
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve2(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }
  async function writeUniqueNote(dir, baseName, content) {
    const app = getApp();
    const folder = String(dir || "文献盒").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    let path = `${folder}/${baseName}.md`;
    for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = `${folder}/${baseName}_${i}.md`;
    try {
      const exists = await app.vault.adapter.exists(folder);
      if (!exists) await app.vault.createFolder(folder);
    } catch (e) {
    }
    await app.vault.create(path, content);
    return path;
  }
  async function generateVideoNote(opts) {
    const ai = createAI();
    const s = tryGetSettings();
    const list = parseDomainList(s.knowledgeDomainList);
    const chunks = chunkTranscript(opts.transcript);
    const metaRaw = await ai.json(
      `你是文献整理助手。基于下方 B站视频《${opts.videoTitle || "未命名"}》的转写文稿片段，生成文献笔记元数据。只输出 JSON，不要任何解释：
{"title":"15-30字的中文完整陈述句，不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢），禁止冒号、破折号、句中句号问号，需要连接时用逗号","tags":["3-6个中文标签，每个不超过5个字，涵盖主题领域、关键概念、应用场景"],"summary":"一句话简介，不超过60字",${domainInstruction(list)}}
所有字段一律使用简体中文。

【转写文稿片段】
${chunks[0] || ""}`,
      { modelOptions: { max_tokens: 600 } }
    );
    const meta = parseAiJson(metaRaw);
    const title = String((meta == null ? void 0 : meta.title) || "").trim() || opts.videoTitle || "未命名";
    const tags = Array.isArray(meta == null ? void 0 : meta.tags) ? meta.tags.map(String).filter(Boolean).slice(0, 6) : [];
    const summary = String((meta == null ? void 0 : meta.summary) || "").trim();
    const domain = String((meta == null ? void 0 : meta.domain) || "").trim();
    const polished = [];
    for (const c of chunks) {
      const p = await ai.chat(
        `你是文字编辑。把下面的视频转写文稿轻度润色为书面语：口语转书面、删除口水词与重复内容，保持原顺序、原事实（数字与专名不变）。转写可能存在语音误听，专名与术语（如火箭型号、人名、地名、专业词）若明显是误听则按上下文纠正为最合理的写法；无法确定的保持原文。输出必须是简体中文（繁体转写一律转为简体）。直接输出润色后的正文，不要解释、不要加标题、不要列表。

【转写文稿】
${c}`,
        // deepseek-v4-flash（带思考）长文润色时 reasoning_content 会吃光 max_tokens 导致 content 空串
        // （ticket 复现：finish_reason=length、content=''）；deepseek-chat 无思考、输出直达 content，稳
        { model: "deepseek-chat", modelOptions: { max_tokens: 8192 } }
      );
      polished.push(String(p || "").trim());
    }
    const whole = polished.join("");
    const videoSection = opts.videoPath ? `![[${String(opts.videoPath).replace(/\\/g, "/")}]]` : null;
    const fm = [
      "---",
      `title: ${quoteYaml(title)}`,
      "tags:",
      tags.map((t) => `  - ${quoteYaml(t)}`).join("\n"),
      `summary: ${quoteYaml(summary)}`,
      `url: ${quoteYaml(opts.url)}`,
      `date: ${quoteYaml(nowStamp())}`,
      `author: ${quoteYaml(opts.uploader)}`,
      `videoTitle: ${quoteYaml(opts.videoTitle)}`,
      "type: video",
      `domain: ${quoteYaml(domain)}`,
      "---"
    ].join("\n");
    const body = [fm, whole, videoSection].filter(Boolean).join("\n\n");
    return writeUniqueNote(String(s.knowledgeDirectory || "文献盒"), sanitizeMdTitle(title), body);
  }
  function termPrompt(term, list) {
    return `你是百科知识整理助手。为术语「${term}」生成一篇文献笔记。只输出 JSON，不要任何解释：
{"summary":"一段关于该术语的简明介绍（百科总结式，150-300字简体中文，连贯成文，涵盖定义、核心要点与必要背景）","domain": ${domainInstruction(list)}}`;
  }
  async function generateTermDraft(term) {
    const ai = createAI();
    const s = tryGetSettings();
    const list = parseDomainList(s.knowledgeDomainList);
    const t = String(term || "").trim();
    if (!t) throw new Error("术语为空");
    const raw = await ai.json(termPrompt(t, list));
    const meta = parseAiJson(raw);
    return {
      summary: String((meta == null ? void 0 : meta.summary) || "").trim(),
      domain: String((meta == null ? void 0 : meta.domain) || "").trim()
    };
  }
  async function summarizeTermSummary(text) {
    const ai = createAI();
    const t = String(text || "").trim();
    if (!t) throw new Error("内容为空");
    const out = await ai.chat(
      `你是文字编辑。把下面的术语介绍压缩成更精简的一段话：保留术语定义与关键事实，删除冗余表述与重复内容，长度约为原文的一半。输出必须是简体中文。直接输出结果，不要解释、不要加标题、不要列表。

【原文】
${t}`,
      { modelOptions: { max_tokens: 1024 } }
    );
    const s = String(out || "").trim();
    if (!s) throw new Error("AI 返回为空");
    return s;
  }
  async function generateTermNote(opts) {
    var _a;
    const s = tryGetSettings();
    const term = String(opts.term || "").trim();
    if (!term) throw new Error("术语为空");
    let summary;
    let domain;
    if (opts.summary === void 0) {
      const draft = await generateTermDraft(term);
      summary = draft.summary;
      domain = draft.domain;
    } else {
      summary = String(opts.summary).trim();
      domain = String((_a = opts.domain) != null ? _a : "").trim();
    }
    const fm = [
      "---",
      `title: ${quoteYaml(term)}`,
      "type: term",
      `domain: ${quoteYaml(domain)}`,
      `term: ${quoteYaml(term)}`,
      `date: ${quoteYaml(nowStamp())}`
    ];
    const src = serializeTermSource(opts.source);
    if (src) {
      fm.push(`source: ${quoteYaml(src.source)}`);
      if (src.sourceTitle) fm.push(`sourceTitle: ${quoteYaml(src.sourceTitle)}`);
    }
    fm.push("---");
    const body = [fm.join("\n"), summary].filter(Boolean).join("\n\n");
    return writeUniqueNote(String(s.knowledgeDirectory || "文献盒"), sanitizeMdTitle(term), body);
  }
  function parseFrontmatter(content) {
    var _a;
    const out = {};
    const m = String(content || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return out;
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z\u4e00-\u9fa5_]+):\s*(.*)$/);
      if (kv) {
        const raw = String((_a = kv[2]) != null ? _a : "").trim();
        const quoted = raw.startsWith('"') && raw.endsWith('"') || raw.startsWith("'") && raw.endsWith("'");
        out[kv[1].trim()] = quoted ? raw.slice(1, -1) : raw;
      }
    }
    return out;
  }
  function injectFrontmatter(content, entries) {
    const head = entries.map((kv) => {
      const [k, ...rest] = kv.split(":");
      const v = rest.join(":").trim();
      return `${k}: ${quoteYaml(v.replace(/^"(.*)"$/, "$1"))}`;
    }).join("\n");
    const m = String(content || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (m) return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---
${m[1]}
${head}
---`);
    return `---
${head}
---

${content || ""}`;
  }
  async function backfillNotes(opts = {}) {
    var _a, _b;
    const app = getApp();
    const s = tryGetSettings();
    const aiTimeoutMs = (_a = opts.aiTimeoutMs) != null ? _a : BACKFILL_AI_TIMEOUT_MS;
    const dir = String(s.knowledgeDirectory || "文献盒").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const files = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(dir + "/") && f.path.endsWith(".md"));
    const needDomain = [];
    let filled = 0;
    for (const f of files) {
      const content = await app.vault.read(f);
      const fm = parseFrontmatter(content);
      const hasType = fm.type === "video" || fm.type === "term";
      const hasDomain = !!fm.domain;
      if (hasType && hasDomain) continue;
      const patch = [];
      if (!hasType) {
        const type = fm.url || fm.author || fm.videoTitle ? "video" : fm.term ? "term" : "";
        if (type) patch.push(`type:${type}`);
      }
      if (!hasDomain) needDomain.push({ file: f });
      if (patch.length) {
        const updated = injectFrontmatter(content, patch);
        if (updated !== content) {
          await app.vault.modify(f, updated);
          filled++;
        }
      }
    }
    let aiSkipped = false;
    if (needDomain.length) {
      const ai = createAI();
      const list = parseDomainList(s.knowledgeDomainList);
      for (const { file } of needDomain) {
        try {
          const latest = await app.vault.read(file);
          const sample = latest.replace(/^---[\s\S]*?---/, "").slice(0, 2e3);
          const raw = await withTimeout(
            ai.json(
              `请判断下面这段文字所属的领域（${domainInstruction(list)}）。只输出 JSON：{"domain":"<领域词>"}

【文本】
${sample}`,
              { modelOptions: { max_tokens: 80 } }
            ),
            aiTimeoutMs,
            "领域判定"
          );
          const domain = String(((_b = parseAiJson(raw)) == null ? void 0 : _b.domain) || "").trim();
          if (domain) {
            await app.vault.modify(file, injectFrontmatter(latest, [`domain:${domain}`]));
            filled++;
          }
        } catch (e) {
          if (/API Key|AI 配置/.test(String((e == null ? void 0 : e.message) || ""))) aiSkipped = true;
        }
      }
    }
    return { scanned: files.length, filled, aiSkipped };
  }
  var BACKFILL_AI_TIMEOUT_MS;
  var init_note_gen = __esm({
    "src/knowledge/note-gen.ts"() {
      init_ai();
      init_app();
      init_settings_provider();
      init_source();
      BACKFILL_AI_TIMEOUT_MS = 25e3;
    }
  });

  // src/knowledge/processor.ts
  function getChildProcess() {
    const w = window;
    if (!w.require) return null;
    try {
      return w.require("child_process");
    } catch (e) {
      return null;
    }
  }
  function getFs() {
    const w = window;
    if (!w.require) return null;
    try {
      return w.require("fs");
    } catch (e) {
      return null;
    }
  }
  function resolveBatchSpawn(taskJson) {
    const b64 = Buffer.from(taskJson, "utf8").toString("base64");
    return { cmd: "bili-dl", args: ["--batch", `b64:${b64}`], shell: true };
  }
  function tryUnlink(path) {
    if (!path) return;
    try {
      const fsMod = getFs();
      if (fsMod && typeof fsMod.unlinkSync === "function") fsMod.unlinkSync(path);
    } catch (e) {
    }
  }
  function getVaultBasePath() {
    var _a, _b, _c;
    try {
      const bp = (_c = (_b = (_a = getApp().vault) == null ? void 0 : _a.adapter) == null ? void 0 : _b.getBasePath) == null ? void 0 : _c.call(_b);
      return typeof bp === "string" ? bp : "";
    } catch (e) {
      return "";
    }
  }
  function tailStderr(chunks) {
    let s = "";
    for (const c of chunks) {
      s += String(c);
      if (s.length > 2048) s = s.slice(-2048);
    }
    return s.trim();
  }
  function nowTs() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  var INSTALL_HINT, STEP_RE, RESULT_RE, PROGRESS_RE, INFO_RE, AI_STEP_TEXT, NOTE_STEP_TEXT, BatchRunner;
  var init_processor = __esm({
    "src/knowledge/processor.ts"() {
      init_notice();
      init_domain_bus();
      init_settings_provider();
      init_app();
      init_data2();
      init_note_gen();
      INSTALL_HINT = "请先运行 npm install -g @jwbz/bili-downloader";
      STEP_RE = /^\[bz-step\]\s*(.+)$/;
      RESULT_RE = /^\[bz-result\]\s*(\{.*\})$/;
      PROGRESS_RE = /^\[bz-p\]\s*(\{.*\})$/;
      INFO_RE = /^\[bz-info\]\s*(\{.*\})$/;
      AI_STEP_TEXT = "AI 生成文献笔记中";
      NOTE_STEP_TEXT = "笔记落盘中";
      BatchRunner = {
        running: false,
        aborted: false,
        /** 遇错即停（设置 knowledgeStopOnFailure）：当前任务失败后中断整批，未开始项保持待处理 */
        stoppedFail: false,
        _child: null,
        _cp: null,
        /** 桌面端可用（window.require('child_process') 存在） */
        available() {
          return !!getChildProcess();
        },
        /**
         * 串行处理全部「待处理 + 失败」任务（按数组顺序，一次一部；ADR-0067 断点续跑：
         * 失败项重跑时工具自动跳过已成功步骤、从出错步骤继续）。
         * 已成功（归档）项不动；默认失败后继续（遇错即停设置开启时失败后中断）。
         */
        async runAll(tasks, events) {
          if (this.running) return;
          this.running = true;
          this.aborted = false;
          this.stoppedFail = false;
          const cp = getChildProcess();
          this._cp = cp;
          if (!cp) {
            notice("仅桌面端可用：文献盒处理需要 Node.js 外部进程", "error");
            this.running = false;
            return;
          }
          const stopOnFailure = tryGetSettings().knowledgeStopOnFailure === true;
          try {
            let success = 0;
            let failed = 0;
            for (const task of tasks) {
              if (this.aborted) break;
              if (task.status !== "pending" && task.status !== "failed") continue;
              let itemFailed = false;
              await this._runOne(cp, task, events, (ok) => {
                if (ok) success++;
                else {
                  failed++;
                  itemFailed = true;
                }
              });
              if (itemFailed && stopOnFailure) {
                this.stoppedFail = true;
                break;
              }
            }
            events.onBatchDone({ success, failed, aborted: this.aborted, stopped: this.stoppedFail });
          } finally {
            this.running = false;
          }
        },
        /** 中止整批：杀死当前子进程，未开始项保持待处理，当前项由 close 标记失败「已中止」 */
        abort() {
          var _a, _b;
          this.aborted = true;
          try {
            (_b = (_a = this._child) == null ? void 0 : _a.kill) == null ? void 0 : _b.call(_a);
          } catch (e) {
          }
        },
        /** 单部执行：spawn → 解析步骤/进度/信息/结果行 → CLI 终态 → 插件侧 AI 阶段 → 落库；Promise 在终态落库后 resolve */
        _runOne(cp, task, events, onEnd) {
          return new Promise((resolve2) => {
            var _a, _b, _c, _d;
            const s = tryGetSettings();
            const nonEmpty = (v) => {
              const t = typeof v === "string" ? v.trim() : "";
              return t ? t : void 0;
            };
            const taskJson = JSON.stringify({
              url: task.url,
              start: (_a = task.start) != null ? _a : null,
              end: (_b = task.end) != null ? _b : null,
              page: task.page && task.page > 0 ? task.page : null,
              options: {
                quality: task.quality || s && s.knowledgeQuality || "highest",
                keepVideo: !s || s.knowledgeKeepVideo !== false,
                outputDir: nonEmpty(s && s.knowledgeOutputDir),
                compress: !s || s.knowledgeCompress !== false,
                crf: s && s.knowledgeCrf || 23,
                vaultPath: getVaultBasePath(),
                ffmpegPath: nonEmpty(s && s.knowledgeFfmpegPath),
                ffprobePath: nonEmpty(s && s.knowledgeFfprobePath),
                pythonPath: nonEmpty(s && s.knowledgePythonPath),
                whisperModel: nonEmpty(s && s.knowledgeWhisperModel),
                cacheDir: nonEmpty(s && s.knowledgeCacheDir),
                cacheRetentionDays: s && s.knowledgeCacheRetentionDays || 7
              }
            });
            void KnowledgeData.updateTask(task.id, { status: "processing", reason: "启动中…", processedAt: null }).then(() => {
              task.status = "processing";
              task.reason = "启动中…";
              events.onTaskProgress({ ...task }, "启动中…");
            });
            const { cmd, args, shell } = resolveBatchSpawn(taskJson);
            let child;
            let settled = false;
            let transcriptPath = null;
            let videoPath = null;
            const finish = (ok, reason, notePath, video) => {
              if (settled) return;
              settled = true;
              void this._finish(task, events, onEnd, ok, reason, notePath, video).then(resolve2, () => {
                onEnd(false);
                resolve2();
              });
            };
            try {
              child = cp.spawn(cmd, args, { shell, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
            } catch (e) {
              const reason = /ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}。${INSTALL_HINT}`;
              finish(false, reason, null, null);
              return;
            }
            this._child = child;
            const errChunks = [];
            const onData = (d) => {
              const text = String(d);
              for (const line of text.split(/\r?\n/)) {
                let m = line.match(STEP_RE);
                if (m) {
                  const stepText = m[1].trim();
                  task.reason = stepText;
                  void KnowledgeData.updateTask(task.id, { reason: stepText });
                  events.onTaskProgress({ ...task }, stepText, null);
                  continue;
                }
                m = line.match(PROGRESS_RE);
                if (m) {
                  try {
                    const p = JSON.parse(m[1]);
                    const progress = {
                      phase: p && typeof p.phase === "string" ? p.phase : null,
                      pct: p && Number.isFinite(p.pct) ? Number(p.pct) : null
                    };
                    events.onTaskProgress({ ...task }, task.reason || "", progress);
                  } catch (e) {
                  }
                  continue;
                }
                m = line.match(INFO_RE);
                if (m) {
                  try {
                    const info = JSON.parse(m[1]);
                    const infoTitle = info && typeof info.title === "string" ? String(info.title).trim() : "";
                    const infoUploader = info && typeof info.uploader === "string" ? String(info.uploader).trim() : "";
                    if (infoTitle || infoUploader) {
                      const prevTitle = task.title || "";
                      const prevUploader = task.uploader || "";
                      task.title = prevTitle || infoTitle;
                      task.uploader = prevUploader || infoUploader;
                      if (task.title !== prevTitle || task.uploader !== prevUploader) {
                        const patch = { title: task.title || null, uploader: task.uploader || null };
                        void KnowledgeData.updateTask(task.id, patch).then(() => {
                          events.onTaskInfo({ ...task });
                        });
                      }
                    }
                  } catch (e) {
                  }
                  continue;
                }
                m = line.match(RESULT_RE);
                if (m) {
                  try {
                    const r = JSON.parse(m[1]);
                    transcriptPath = r && typeof r.transcript === "string" && r.transcript ? r.transcript : null;
                    videoPath = r && typeof r.video === "string" && r.video ? r.video : null;
                  } catch (e) {
                  }
                }
              }
            };
            (_c = child.stdout) == null ? void 0 : _c.on("data", onData);
            (_d = child.stderr) == null ? void 0 : _d.on("data", (d) => {
              errChunks.push(d);
            });
            child.on("error", (e) => {
              if (settled) return;
              const reason = /ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}`;
              finish(false, reason, null, null);
            });
            child.on("close", (code) => {
              if (settled) return;
              if (this.aborted) {
                finish(false, "已中止", null, null);
                return;
              }
              if (code === 0) {
                void this._aiStep(task, events, transcriptPath, videoPath, finish);
              } else {
                tryUnlink(transcriptPath);
                const errTail = tailStderr(errChunks);
                const reason = errTail || `处理失败（退出码 ${code}）。${INSTALL_HINT}`;
                finish(false, reason, null, null);
              }
            });
          });
        },
        /**
         * 插件侧 AI 阶段（ADR-0071）：CLI close(0) 后由插件接管——
         * 「AI 生成文献笔记中」→ 读转录临时文件 → generateVideoNote（元数据 + 分块润色 + 落盘）→
         * 读毕删临时文件 → 「笔记落盘中」→ 成功终态。
         * 转录读取失败 / AI 失败（含 AI 未配置）→ 该任务 failed（reason 中文、不落半成品笔记），
         * 转录临时文件尽力清理；单部失败即整批语义与 CLI 失败一致（继续剩余 / 遇错即停）。
         */
        async _aiStep(task, events, transcriptPath, videoPath, finish) {
          task.reason = AI_STEP_TEXT;
          void KnowledgeData.updateTask(task.id, { reason: AI_STEP_TEXT });
          events.onTaskProgress({ ...task }, AI_STEP_TEXT);
          let transcript;
          try {
            const fsMod = getFs();
            if (!fsMod || typeof fsMod.readFileSync !== "function" || !transcriptPath) {
              throw new Error("无转录文件");
            }
            transcript = fsMod.readFileSync(transcriptPath, "utf8");
          } catch (e) {
            tryUnlink(transcriptPath);
            finish(false, "转录文件读取失败", null, null);
            return;
          }
          let notePath;
          try {
            notePath = await generateVideoNote({
              transcript,
              videoTitle: task.title || "",
              url: task.url,
              uploader: task.uploader || "",
              // ticket 151：CLI 交付的 mp4 路径随笔记落盘（正文视频双链）；keepVideo=false 时为 null → 无视频段
              videoPath
            });
          } catch (e) {
            tryUnlink(transcriptPath);
            finish(false, `AI 生成文献笔记失败：${(e == null ? void 0 : e.message) || String(e)}`, null, null);
            return;
          }
          tryUnlink(transcriptPath);
          task.reason = NOTE_STEP_TEXT;
          void KnowledgeData.updateTask(task.id, { reason: NOTE_STEP_TEXT });
          events.onTaskProgress({ ...task }, NOTE_STEP_TEXT);
          finish(true, null, notePath, videoPath);
        },
        /** 终态落库 + 事件（resolve 于落库完成后）；成功 → 自动归档历史（archived+归档时间，ADR-0067） */
        async _finish(task, events, onEnd, ok, reason, notePath, videoPath) {
          var _a;
          task.status = ok ? "success" : "failed";
          task.reason = reason;
          task.notePath = ok ? notePath : task.notePath;
          task.videoPath = ok ? videoPath : task.videoPath;
          task.processedAt = nowTs();
          if (ok) {
            task.archived = true;
            task.archivedAt = task.processedAt;
          }
          try {
            await KnowledgeData.updateTask(task.id, {
              status: task.status,
              reason,
              notePath: task.notePath,
              videoPath: task.videoPath,
              processedAt: task.processedAt,
              archived: task.archived,
              archivedAt: task.archivedAt,
              // 内存态解析信息一并落库（ADR-0067）：终态写与信息写并发时，终态写携带新字段，
              // 避免读-改-写竞态把已落库的 title/uploader 覆盖丢失
              title: task.title,
              uploader: task.uploader
            });
          } catch (e) {
          }
          events.onTaskDone({ ...task });
          if (ok) {
            emitDomainEvent("knowledge:tasks", { kind: "converted", id: task.id, url: task.url, notePath: task.notePath });
          } else {
            emitDomainEvent("knowledge:tasks", { kind: "failed", id: task.id, url: task.url, notePath: (_a = task.notePath) != null ? _a : null });
          }
          onEnd(ok);
        }
      };
    }
  });

  // src/knowledge/video-meta.ts
  function isBiliUrl(text) {
    const m = text.match(/^https?:\/\/([^/?#]+)/i);
    return !!m && BILI_HOST_RE.test(m[1].toLowerCase().replace(/^www\./i, ""));
  }
  function parseBvid(input) {
    const m = String(input != null ? input : "").match(BVID_RE);
    return m ? m[0] : null;
  }
  async function fetchFromViewApi(bvid) {
    try {
      const timer = new Promise((resolve2) => setTimeout(() => resolve2(null), VIEW_TIMEOUT_MS));
      const req = requestUrl({ url: `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, method: "GET" }).then(
        (resp) => {
          if (!resp || resp.status < 200 || resp.status >= 300) return null;
          let json = null;
          try {
            json = JSON.parse(resp.text);
          } catch (e) {
            return null;
          }
          if (!json || json.code !== 0 || !json.data) return null;
          const title = typeof json.data.title === "string" ? json.data.title.trim() : "";
          const ownerName = json.data.owner && typeof json.data.owner.name === "string" ? json.data.owner.name.trim() : "";
          const meta = {};
          if (title) meta.title = title;
          if (ownerName) meta.uploader = ownerName;
          return title || ownerName ? meta : null;
        }
      );
      return await Promise.race([req, timer]);
    } catch (e) {
      return null;
    }
  }
  async function fetchFromPageTitle(url) {
    try {
      const raw = await fetchPageTitle(url);
      const title = raw ? cleanSourceTitle(raw) : "";
      return title ? { title } : null;
    } catch (e) {
      return null;
    }
  }
  async function fetchVideoMeta(input) {
    const text = String(input != null ? input : "").trim();
    if (!text) return null;
    const bvid = parseBvid(text);
    if (bvid) {
      const viaApi = await fetchFromViewApi(bvid);
      if (viaApi) return viaApi;
      return isBiliUrl(text) ? await fetchFromPageTitle(text) : null;
    }
    if (!isUrlLikeSourceText(text)) return null;
    const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    if (!isBiliUrl(url)) return null;
    return await fetchFromPageTitle(url);
  }
  var BVID_RE, BILI_HOST_RE, VIEW_TIMEOUT_MS;
  var init_video_meta = __esm({
    "src/knowledge/video-meta.ts"() {
      init_fake_obsidian();
      init_utils();
      init_source();
      BVID_RE = /BV[0-9A-Za-z]{10}/;
      BILI_HOST_RE = /(^|\.)(bilibili\.com|b23\.tv)$/i;
      VIEW_TIMEOUT_MS = 1e4;
    }
  });

  // src/knowledge/ui.ts
  function q(root, sel) {
    return root.querySelector(sel);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function shortNoteName(path) {
    const base = String(path || "").replace(/\\/g, "/").split("/").pop() || "";
    return stripMdExt(base) || String(path || "");
  }
  function humanizeError(reason) {
    const s = String(reason != null ? reason : "").trim();
    if (!s) return "";
    if (/未找到 bili-dl|npm install -g @jwbz\/bili-downloader|ENOENT.*bili-dl/i.test(s)) {
      return "下载工具未安装：在电脑上运行 npm install -g @jwbz/bili-downloader 后重试";
    }
    if (/ffmpeg/i.test(s)) return "视频处理工具（ffmpeg）不可用：检查电脑是否已安装，或设置里的「ffmpeg 路径」";
    if (/ffprobe/i.test(s)) return "视频探测工具（ffprobe）不可用：检查电脑是否已安装，或设置里的「ffprobe 路径」";
    if (/找不到 Python|无法启动 Python|python.*ENOENT/i.test(s)) {
      return "语音转写失败：未找到 Python——设置里「Python 路径」填 python（一般装了 Python 即可），或运行 where python 查绝对路径填入";
    }
    if (/未配置 pythonPath/i.test(s)) {
      return "语音转写未配置：知识盒设置「Python 路径」填 python 即可（一般装了 Python 就能用，走系统 PATH），或填绝对路径（Windows 在命令提示符运行 where python 可查）";
    }
    if (/pip install faster-whisper|faster-whisper 环境已安装/i.test(s)) {
      return "语音转写失败：faster-whisper 未安装，请在目标 Python 中运行 pip install faster-whisper";
    }
    if (/whisper|faster.whisper|no module/i.test(s)) {
      return "语音转写失败：检查设置里的「Python 路径」与「Whisper 模型」";
    }
    if (/API Key|AI 配置|未配置|Unauthorized|\b401\b|invalid_api_key|insufficient|quota/i.test(s)) {
      return "AI 配置不可用：请在插件设置 → AI 配置里检查 API Key";
    }
    if (/AI 请求超时|AI 返回的不是 JSON/i.test(s)) return "AI 响应异常：网络不稳定或服务繁忙，稍后重试";
    if (/转录文件读取失败|无转录文件/i.test(s)) return "转写稿缺失：视频处理步骤未完成，可重试";
    if (/ETIMEDOUT|ESOCKETTIMEDOUT|timed? ?out|超时/i.test(s)) return "网络超时：请检查网络连接后重试";
    if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed/i.test(s)) {
      return "网络连接失败：请检查网络或代理设置后重试";
    }
    if (/^-352|\b412\b|风控|请求过于频繁/i.test(s)) return "B 站风控拦截：稍后再试，或在设置里配置登录 Cookie";
    if (/视频不存在|稿件不存在|\b404\b|not found/i.test(s)) return "视频不存在或已删除：请检查链接是否正确";
    return s.length > 160 ? s.slice(0, 160) + "…" : s;
  }
  function stepDoneLabel(step) {
    const mapped = STEP_DONE_MAP[step];
    if (mapped) return mapped;
    return step.endsWith("中") ? `已${step.slice(0, -1)}` : `已${step}`;
  }
  function shortUrlText(url) {
    const m = url.match(/BV[0-9A-Za-z]{8,12}/i) || url.match(/b23\.tv\/([0-9A-Za-z]+)/i);
    if (m) return m[0];
    return url.length > 28 ? url.slice(0, 28) + "…" : url;
  }
  function dateStamp() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function litDirOf(s) {
    const raw = s && s.knowledgeDirectory ? String(s.knowledgeDirectory) : "文献盒";
    return raw.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }
  function cardboxDirOf(s) {
    const raw = s && s.knowledgeCardboxDirectory ? String(s.knowledgeCardboxDirectory) : "卡片盒";
    return raw.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }
  function topicDirOf(s) {
    const raw = s && s.knowledgeTopicDirectory ? String(s.knowledgeTopicDirectory) : "主题盒";
    return raw.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }
  function parseDateRaw(raw) {
    const s = String(raw != null ? raw : "").trim();
    if (!s) return NaN;
    const d1 = new Date(s.replace(" ", "T"));
    if (!isNaN(d1.valueOf())) return d1.valueOf();
    const d2 = new Date(s);
    return d2.valueOf();
  }
  function stripFrontmatter(text) {
    const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return text.slice(m ? m[0].length : 0).replace(/^\r?\n+/, "");
  }
  function appendRelatedLine(text, link) {
    var _a;
    const lines = text.split(/\r?\n/);
    if (((_a = lines[0]) == null ? void 0 : _a.trim()) !== "---") return text;
    let close = -1;
    let relatedAt = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        close = i;
        break;
      }
      if (/^related:/.test(lines[i])) relatedAt = i;
    }
    if (close === -1) return text;
    if (relatedAt === -1) {
      lines.splice(close, 0, "related:", `  - "${link}"`);
    } else {
      let end = relatedAt + 1;
      while (end < close && /^\s*-\s/.test(lines[end])) end++;
      lines.splice(end, 0, `  - "${link}"`);
    }
    return lines.join("\n");
  }
  var STATUS_META, STEP_DONE_MAP, fmtElapsed, UIManager;
  var init_ui = __esm({
    "src/knowledge/ui.ts"() {
      init_fake_obsidian();
      init_mobile();
      init_settings_provider();
      init_item_actions();
      init_flow_dialog();
      init_notice();
      init_utils();
      init_suggest();
      init_z_order();
      init_domain_bus();
      init_app();
      init_data2();
      init_processor();
      init_note_gen();
      init_source();
      init_video_meta();
      STATUS_META = {
        pending: { label: "待处理", cls: "bz-kb-pending" },
        processing: { label: "处理中", cls: "bz-kb-processing" },
        success: { label: "成功", cls: "bz-kb-success" },
        failed: { label: "失败", cls: "bz-kb-failed" }
      };
      STEP_DONE_MAP = {
        "AI 生成文献笔记中": "已生成文献笔记",
        "笔记落盘中": "已落盘笔记"
      };
      fmtElapsed = (ms) => {
        const s = Math.max(0, Math.floor(ms / 1e3));
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        return h > 0 ? `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
      };
      UIManager = class {
        constructor(app) {
          // ---- 主壳（三部）----
          this.mask = null;
          this.popup = null;
          this.contentEl = null;
          this.part = "z1";
          this.allNotes = [];
          this.allCards = [];
          this.allTopics = [];
          this.cardsShown = 0;
          this.editor = null;
          this.sessionNewPaths = /* @__PURE__ */ new Set();
          this.loadedLitDir = "";
          this.loadedCardDir = "";
          this.loadedTopicDir = "";
          this.backfilledDir = "";
          // ---- 视频录入面板（任务队列）----
          this.videoMask = null;
          this.videoPopup = null;
          this.videoList = null;
          // ---- 添加任务弹窗 / 历史弹窗 ----
          this.addMask = null;
          this.addPopup = null;
          /** 录入 URL 防抖定时器与解析序列号（issue 278：450ms 防抖回填 + 过期响应丢弃） */
          this.addUrlTimer = null;
          this.addUrlSeq = 0;
          this.historyMask = null;
          this.historyPopup = null;
          this.historyList = null;
          // ---- 术语生成面板 ----
          this.termMask = null;
          this.termPopup = null;
          this.termPreview = null;
          this.termGenerating = false;
          this.termSummarizing = false;
          this.termHasDraft = false;
          this.termSource = null;
          // 术语来源（ADR-0116；null = 未填）
          this.termSrcSuggest = null;
          this.termSrcTimer = null;
          this.editingId = null;
          this.onKeydown = () => {
          };
          this.batchAbortLabel = null;
          this.runState = /* @__PURE__ */ new Map();
          this.runTimer = null;
          this.fileListenerRefs = [];
          this.fileListenerAttached = false;
          this.refreshTimer = null;
          this.pendingRefreshPaths = /* @__PURE__ */ new Set();
          this.pendingDeletePaths = /* @__PURE__ */ new Set();
          this._previewNote = null;
          this.app = app;
          this.createMainUI();
          this.createVideoUI();
          this.createAddDialog();
          this.createHistoryUI();
          this.createTermUI();
          this.onKeydown = (e) => {
            if (e.key !== "Escape") return;
            if (this.termPopup && this.termPopup.style.display === "flex") this.hideTermEntry();
            else if (this.historyPopup && this.historyPopup.style.display === "flex") this.hideHistory();
            else if (this.addPopup && this.addPopup.style.display === "flex") this.hideAddDialog();
            else if (this.videoPopup && this.videoPopup.style.display === "flex") this.hideVideo();
            else if (this.popup && this.popup.style.display === "flex") this.hideMain();
          };
          document.addEventListener("keydown", this.onKeydown);
        }
        // ==================== 主壳（三部） ====================
        createMainUI() {
          var _a;
          if (this.mask && this.mask.isConnected || this.popup && this.popup.isConnected) return;
          const mask = document.createElement("div");
          mask.id = "knowledge-mask";
          mask.className = "bz-kb-mask";
          mask.style.display = "none";
          mask.onclick = () => this.hideMain();
          const popup = document.createElement("div");
          popup.id = "knowledge-popup";
          popup.className = "bz-kb-window kb";
          if (isMobileEnv()) popup.classList.add("bz-panel-mtop");
          popup.style.display = "none";
          const partBtns = `
          <button class="bz-kb-part is-on" data-kb-act="part" data-part="z1">部壹 · 文献</button>
          <button class="bz-kb-part" data-kb-act="part" data-part="z2">部贰 · 卡片</button>
          <button class="bz-kb-part" data-kb-act="part" data-part="z3">部叁 · 主题</button>`;
          popup.innerHTML = isMobileEnv() ? `
      <div class="bz-kb-head">
        <div class="bz-kb-brand">
          <div class="bz-kb-top">LEXICON · BOX OF NOTES</div>
          <div class="bz-kb-title">知 识 盒</div>
        </div>
        <button class="bz-kb-mclose" data-kb-act="kb-close" title="关闭知识盒">✕</button>
      </div>
      <div class="bz-kb-parts">${partBtns}
      </div>
      <div class="bz-kb-sc" id="kb-sc"></div>` : `
      <div class="bz-kb-head">
        <div class="bz-kb-parts">${partBtns}
        </div>
        <div class="bz-kb-brand">
          <div class="bz-kb-top">LEXICON · BOX OF NOTES</div>
          <div class="bz-kb-title">知 识 盒</div>
        </div>
      </div>
      <div class="bz-kb-sc" id="kb-sc"></div>`;
          document.body.appendChild(mask);
          document.body.appendChild(popup);
          this.mask = mask;
          this.popup = popup;
          this.contentEl = q(popup, "#kb-sc");
          popup.addEventListener("click", (e) => this.onShellClick(e));
          (_a = this.contentEl) == null ? void 0 : _a.addEventListener("scroll", () => this.onContentScroll());
          this.attachFileListener();
        }
        /** 主壳点击委托（部切换 / 录入入口 / 文献行 / 主题行 / 返回） */
        onShellClick(e) {
          const t = e.target.closest("[data-kb-act]");
          if (!t) return;
          const act = t.getAttribute("data-kb-act");
          if (act === "part") {
            this.part = t.getAttribute("data-part") || "z1";
            void this.refreshCurrent();
            this.syncPartButtons();
          } else if (act === "term-entry") this.showTermEntry();
          else if (act === "video-entry") this.showVideoEntry();
          else if (act === "lit-peek") {
            const p = t.getAttribute("data-path") || "";
            const n = this.allNotes.find((x) => x.path === p);
            if (n) void this.openPreview(n);
          } else if (act === "card-peek") {
            const p = t.getAttribute("data-path") || "";
            const c = this.allCards.find((x) => x.path === p);
            if (c) void this.openPreview(c, "card");
          } else if (act === "topic-open") {
            const p = t.getAttribute("data-path") || "";
            const tp = this.allTopics.find((x) => x.path === p);
            if (tp) void this.openPreview({ file: tp.file, path: tp.path, title: tp.title, domain: tp.where }, "topic");
          } else if (act === "kb-close") this.hideMain();
        }
        syncPartButtons() {
          if (!this.popup) return;
          this.popup.querySelectorAll(".bz-kb-part").forEach((b) => {
            b.classList.toggle("is-on", b.getAttribute("data-part") === this.part);
          });
        }
        showMain() {
          this.createMainUI();
          if (!this.popup || !this.mask || !this.contentEl) return;
          topifyZ(this.mask, this.popup);
          this.mask.style.display = "block";
          this.popup.style.display = "flex";
          void this.refreshCurrent();
          void this.runBackfill();
        }
        hideMain() {
          if (this.mask) this.mask.style.display = "none";
          if (this.popup) this.popup.style.display = "none";
        }
        /** 当前部数据 + 渲染（目录变更检测 → 清缓存重扫） */
        async refreshCurrent() {
          if (!this.contentEl) return;
          const s = tryGetSettings();
          if (this.part === "z1") {
            const dir = litDirOf(s);
            if (this.loadedLitDir && this.loadedLitDir !== dir) this.allNotes = [];
            await this.loadLiterature(dir);
            this.renderLiterature();
          } else if (this.part === "z2") {
            const dir = cardboxDirOf(s);
            if (this.loadedCardDir && this.loadedCardDir !== dir) this.allCards = [];
            await this.loadCards(dir);
            this.cardsShown = 0;
            this.renderCards();
          } else {
            const dir = topicDirOf(s);
            if (this.loadedTopicDir && this.loadedTopicDir !== dir) this.allTopics = [];
            await this.loadTopics(dir);
            this.renderTopics();
          }
        }
        /** 部壹文献扫描：文献目录下全部 .md（含子目录），metadataCache 解析 frontmatter */
        async loadLiterature(dir) {
          const app = getApp();
          this.loadedLitDir = dir;
          const prefix = dir + "/";
          const mdFiles = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(prefix) && f.extension === "md");
          const entries = [];
          for (const f of mdFiles) {
            const e = await this.parseNoteFile(f);
            if (e) entries.push(e);
          }
          entries.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
          this.allNotes = entries;
        }
        async parseNoteFile(file) {
          const app = getApp();
          try {
            const cache = app.metadataCache.getFileCache(file);
            const fm = cache && cache.frontmatter;
            const title = fm && fm.title ? String(fm.title) : file.basename;
            const date = fm && fm.date ? String(fm.date) : "";
            let created = parseDateRaw(date);
            if (isNaN(created)) {
              try {
                const st = file.stat;
                created = st && st.ctime ? new Date(st.ctime).valueOf() : 0;
              } catch (e) {
                created = 0;
              }
            }
            return {
              file,
              path: file.path,
              title,
              type: fm && fm.type ? String(fm.type) : "",
              domain: fm && fm.domain ? String(fm.domain) : "",
              summary: fm && fm.summary ? String(fm.summary) : "",
              url: fm && fm.url ? String(fm.url) : "",
              source: fm && fm.source ? String(fm.source) : "",
              sourceTitle: fm && fm.sourceTitle ? String(fm.sourceTitle) : "",
              date,
              created
            };
          } catch (e) {
            console.warn("解析文献笔记失败:", file.path, e);
            return null;
          }
        }
        renderLiterature() {
          if (!this.contentEl) return;
          const rows = this.allNotes.map((n, i) => {
            const no = String(i + 1).padStart(2, "0");
            const kind = n.type === "video" ? "影 像" : "词 条";
            return `<div class="bz-kb-lexrow" data-kb-act="lit-peek" data-path="${esc(n.path)}">
        <div class="bz-kb-hw"><span class="bz-kb-w">${esc(n.title)}</span><span class="bz-kb-pos ${n.type === "video" ? "hot" : ""}">${kind}</span><span class="bz-kb-dom">${esc(n.domain || "未分类")}</span></div>
        <div class="bz-kb-tail"><span class="bz-kb-meta">LIT-${no} · ${esc(n.date || "")}</span></div>
      </div>`;
          }).join("");
          this.contentEl.innerHTML = `
      <div class="bz-kb-pd">
        <div class="bz-kb-entryrow">
          <button class="bz-kb-entrybtn" data-kb-act="term-entry"><b>文字录入 · 术语</b><span>想到一个概念，当场落成一张术语卡</span></button>
          <button class="bz-kb-entrybtn" data-kb-act="video-entry"><b>视频录入 · 任务</b><span>丢进来一个 B 站链接，文献笔记自动长出来</span></button>
        </div>
        ${rows || '<div class="bz-kb-empty">「文献目录」还没有文献笔记——从上面的两种录入开始。</div>'}
      </div>`;
        }
        /** 三部共用预览弹层（文献/卡片/主题同一样式）：正文真 Markdown 渲染（视频 ![[mp4]] 内嵌可播）+ 关联 + 可点来源（只读；关闭走 ✕/ESC） */
        async openPreview(n, kind = "lit") {
          const app = getApp();
          let raw = "";
          try {
            raw = await app.vault.read(n.file);
          } catch (e) {
            raw = "";
          }
          const body = stripFrontmatter(raw);
          const parasHtml = body.split(/\r?\n\r?\n+/).map((b) => b.trim()).filter(Boolean).map((b) => `<p>${esc(b)}</p>`).join("") || "<p>（无正文）</p>";
          const rels = await this.noteRels(n);
          const srcHtml = n.url ? `<div class="bz-kb-sec">原 文</div><div class="bz-kb-cliplink"><a class="bz-lit-srcopen" data-lit-src-url="${esc(n.url)}" href="#">${esc(n.url)}</a></div>` : n.source && !n.source.startsWith("[[") ? `<div class="bz-kb-sec">来 源</div><div class="bz-kb-cliplink"><a class="bz-lit-srcopen" data-lit-src-url="${esc(n.source)}" href="#">${esc(n.sourceTitle || n.source)}</a></div>` : "";
          const head = kind === "card" ? { title: "卡片预览 · 卡片盒", badge: "卡 片", hot: false } : kind === "topic" ? { title: "主题预览 · 主题笔记", badge: "主 题", hot: false } : { title: `文献预览 · ${n.type === "video" ? "影像" : "词条"}`, badge: n.type === "video" ? "影 像" : "词 条", hot: n.type === "video" };
          this.openSheet(this.sheetWrap(head.title, `
      <div class="bz-kb-hw"><span class="bz-kb-w" style="font-size:17px">${esc(n.title)}</span>
        <span class="bz-kb-pos ${head.hot ? "hot" : ""}">${head.badge}</span>
        <span class="bz-kb-dom">${esc(n.domain || "未分类")}</span></div>
      <div class="bz-kb-tail"><span class="bz-kb-meta">${esc(n.date || "")}</span></div>
      <div class="bz-kb-paras" id="bz-kb-preview-body"></div>
      ${rels.length ? `<div class="bz-kb-sec">关 联</div><div class="bz-kb-rels">${rels.map((r) => `<span class="bz-kb-cite">${esc(r)}</span>`).join("")}</div>` : ""}
      ${srcHtml}`));
          this._previewNote = n;
          const bodyEl = this.popup ? q(this.popup, "#bz-kb-preview-body") : null;
          if (bodyEl) {
            bodyEl.textContent = "";
            if (body) {
              try {
                const comp = new Component();
                await MarkdownRenderer.render(this.app, body, bodyEl, n.path, comp);
                comp.unload();
              } catch (e) {
              }
              if (!bodyEl.querySelector("*")) {
                bodyEl.innerHTML = parasHtml;
              }
            } else {
              bodyEl.innerHTML = parasHtml;
            }
          }
          const srcLinks = this.popup ? this.popup.querySelectorAll("[data-lit-src-url]") : [];
          srcLinks.forEach((a) => {
            a.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              this._openExternal(a.getAttribute("data-lit-src-url") || "");
            });
          });
        }
        /** 提炼成卡编辑弹层（原型唯一真理：词头可改 / 源文献+领域自动带，落 related 双链互链 / 连一张旧卡 / 为什么相关） */
        async openCardEditor(n) {
          await this.ensureCards();
          const dom = n.domain || "未分类";
          const sameDom = this.allCards.filter((c) => c.domain === dom).map((c) => c.title);
          const others = this.allCards.map((c) => c.title).filter((t) => !sameDom.includes(t));
          const olds = [...sameDom.slice(0, 5)];
          for (const t of others) {
            if (olds.length >= 6) break;
            olds.push(t);
          }
          if (olds.length === 0) olds.push(n.title);
          const whySug = `《${n.title}》与这张旧卡讨论同一主题——读后补全了机制细节，整理为显式连接。`;
          const oldsHtml = olds.map((o, i) => `<button class="bz-kb-old" data-kb-old="${esc(o)}">${esc(o)}${i === 0 ? '<span class="bz-kb-rec">推荐</span>' : ""}</button>`).join("");
          this.openSheet(this.sheetWrap("提炼成卡 → 卡片盒", `
      <div class="bz-kb-f"><div class="bz-kb-flb">词 头（可 改）</div>
        <input type="text" data-kb-role="cardtitle" value="${esc(n.title)}"></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">来 源 与 领 域（自 动 带，落 related 双链）</div>
        <div class="bz-kb-srcline"><span class="bz-kb-srchip"><b>源</b>${esc(n.path)}</span>
        <span class="bz-kb-srchip"><b>领域</b>〔${esc(dom)}〕自动继承</span></div></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">连 一 张 旧 卡（铁律：不 解 释 的 链 接 不 产 生 知 识）</div>
        <div class="bz-kb-olds">${oldsHtml}</div></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">为 什 么 相 关（一 句 话，可 改）</div>
        <input type="text" data-kb-role="why" value="${esc(whySug)}"></div>
      <div style="margin-top:18px;display:flex;gap:10px">
        <button class="bz-kb-bigbtn" data-kb-act="card-save" disabled>落 卡</button>
        <button class="bz-kb-ghost" data-kb-close>取消</button>
      </div>
      <div class="bz-kb-note" style="font-size:11px;margin-top:14px">落卡后它躺在卡片盒，随时被任何笔记引用——不强迫挂进哪篇，也不强迫复习。</div>`));
          this.editor = { source: n, pick: null, why: whySug, title: n.title };
        }
        syncSaveBtn() {
          var _a;
          const btn = (_a = this.popup) == null ? void 0 : _a.querySelector("[data-kb-act=card-save]");
          if (btn && this.editor) btn.disabled = !(this.editor.pick && this.editor.why.trim());
        }
        /** 落卡：写卡片盒笔记（category=领域、related=源文献）+ 源文献 related 追加新卡（互链） */
        async saveCard() {
          var _a;
          if (!this.editor || !this.editor.pick || !this.editor.why.trim()) return;
          const app = getApp();
          const s = tryGetSettings();
          const dir = cardboxDirOf(s);
          const src = this.editor.source;
          const why = this.editor.why.trim();
          let base = this.editor.title.trim() || src.title;
          const stamp = dateStamp();
          try {
            let idx = 2;
            while (app.vault.getAbstractFileByPath(`${dir}/${base}.md`)) {
              base = `${this.editor.title.trim() || src.title} ${idx}`;
              idx++;
            }
            const path = `${dir}/${base}.md`;
            try {
              if (!app.vault.getFolderByPath(dir)) await app.vault.createFolder(dir);
            } catch (e) {
            }
            const md = ["---", "tags: []", `category: ${src.domain || "未分类"}`, "related:", `  - "[[${src.path}|${src.title}]]"`, `date: "${stamp}"`, "---", "", why, ""].join("\n");
            await app.vault.create(path, md);
            const srcFile = app.vault.getAbstractFileByPath(src.path);
            if (srcFile) {
              const text = await app.vault.read(srcFile);
              const linkText = `[[${stripMdExt(path)}|${base}]]`;
              const updated = appendRelatedLine(text, linkText);
              if (updated !== text) await app.vault.modify(srcFile, updated);
            }
            this.allCards.unshift({ file: null, path, title: base, domain: src.domain || "未分类", review: false, created: Date.now() });
            this.sessionNewPaths.add(path);
            this.editor = null;
            this.closeSheet();
            notice("已落卡 卡片盒/" + base + ".md · 它随时被任何笔记引用", "success");
            if (this.part === "z2") {
              this.cardsShown = 0;
              this.renderCards();
            }
          } catch (e) {
            notice("落卡失败：" + ((_a = e == null ? void 0 : e.message) != null ? _a : String(e)), "error");
          }
        }
        /** 部贰卡片扫描（存量零迁移：领域读序 domain → category → 未分类） */
        async loadCards(dir) {
          var _a;
          const app = getApp();
          this.loadedCardDir = dir;
          const prefix = dir + "/";
          const mdFiles = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(prefix) && f.extension === "md");
          const out = [];
          for (const f of mdFiles) {
            try {
              const cache = app.metadataCache.getFileCache(f);
              const fm = cache && cache.frontmatter || {};
              let created = 0;
              try {
                created = ((_a = f.stat) == null ? void 0 : _a.ctime) ? new Date(f.stat.ctime).valueOf() : 0;
              } catch (e) {
                created = 0;
              }
              out.push({
                file: f,
                path: f.path,
                title: fm && fm.title ? String(fm.title) : f.basename,
                domain: fm && fm.domain ? String(fm.domain) : fm && fm.category ? String(fm.category) : "未分类",
                review: fm && fm.reviewStart != null,
                created
              });
            } catch (e) {
            }
          }
          out.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
          this.allCards = out;
        }
        renderCards() {
          if (!this.contentEl) return;
          this.cardsShown = Math.max(this.cardsShown, 80);
          const shown = this.allCards.slice(0, this.cardsShown);
          const rows = shown.map((c) => `<div class="bz-kb-lexrow" data-kb-act="card-peek" data-path="${esc(c.path)}">
      <div class="bz-kb-hw"><span class="bz-kb-w">${esc(c.title)}</span>${this.sessionNewPaths.has(c.path) ? '<span class="bz-kb-pos ok">新 落</span>' : ""}<span class="bz-kb-dom">${esc(c.domain)}</span></div>
      <div class="bz-kb-tail"><span>${c.review ? "复习中 · 到期由闹钟安排" : "未入复习"}</span><span style="margin-left:auto">连 1 张旧卡</span></div>
    </div>`).join("");
          const rest = this.allCards.length - shown.length;
          this.contentEl.innerHTML = `<div class="bz-kb-pd">
      ${rows || '<div class="bz-kb-empty">卡片目录还没有卡片——在部壹文献预览里「提炼成卡」。</div>'}
      ${rest > 0 ? `<div class="bz-kb-empty" data-kb-act="cards-more">↓ 还有 ${rest} 张，滚动或点此加载</div>` : ""}
    </div>`;
        }
        moreCards() {
          if (this.cardsShown >= this.allCards.length) return;
          this.cardsShown += 80;
          this.renderCards();
        }
        onContentScroll() {
          const sc = this.contentEl;
          if (!sc || this.part !== "z2") return;
          if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 60) this.moreCards();
        }
        /** 部叁主题扫描（仅展示） */
        async loadTopics(dir) {
          const app = getApp();
          this.loadedTopicDir = dir;
          const prefix = dir + "/";
          const mdFiles = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(prefix) && f.extension === "md");
          const out = mdFiles.map((f) => {
            var _a;
            let created = 0;
            try {
              created = ((_a = f.stat) == null ? void 0 : _a.mtime) ? new Date(f.stat.mtime).valueOf() : 0;
            } catch (e) {
              created = 0;
            }
            return { file: f, path: f.path, title: f.basename, where: dir, created };
          });
          out.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
          this.allTopics = out;
        }
        renderTopics() {
          if (!this.contentEl) return;
          const rows = this.allTopics.map((t) => {
            const rel = formatRelativeTime(String(t.created || ""));
            return `<div class="bz-kb-lexrow" data-kb-act="topic-open" data-path="${esc(t.path)}">
      <div class="bz-kb-hw"><span class="bz-kb-w">${esc(t.title)}</span><span class="bz-kb-dom">${esc(t.where)}</span></div>
      <div class="bz-kb-tail"><span class="bz-kb-meta">${rel === "无效日期" ? "" : esc(rel)}</span></div>
    </div>`;
          }).join("");
          this.contentEl.innerHTML = `<div class="bz-kb-pd">
      ${rows || '<div class="bz-kb-empty">主题目录还没有笔记。</div>'}
    </div>`;
        }
        async ensureCards() {
          const dir = cardboxDirOf(tryGetSettings());
          if (!this.loadedCardDir || this.loadedCardDir !== dir || this.allCards.length === 0) await this.loadCards(dir);
        }
        /** 读笔记 frontmatter related 展示名列表（预览「关联」区；行扫描实现） */
        async noteRels(n) {
          var _a;
          try {
            const app = getApp();
            const text = await app.vault.read(n.file);
            const lines = text.split(/\r?\n/);
            if (((_a = lines[0]) == null ? void 0 : _a.trim()) !== "---") return [];
            const out = [];
            let inRelated = false;
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i];
              if (line.trim() === "---") break;
              if (/^related:/.test(line)) {
                inRelated = true;
                continue;
              }
              if (inRelated) {
                if (/^\s+-\s/.test(line)) {
                  const mm = line.match(/^\s*-\s*"?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]"?\s*$/);
                  if (mm) out.push(mm[2] || mm[1]);
                } else if (line.trim() !== "") {
                  break;
                }
              }
            }
            return out;
          } catch (e) {
            return [];
          }
        }
        /** 弹层（面板内覆盖） */
        openSheet(html) {
          this.closeSheet();
          if (!this.popup) return;
          const ovl = document.createElement("div");
          ovl.className = "bz-kb-ovl";
          ovl.innerHTML = `<div class="bz-kb-sheet">${html}</div>`;
          ovl.addEventListener("click", (e) => {
            var _a, _b;
            const t = e.target.closest("[data-kb-act],[data-kb-close]");
            if (e.target === ovl || t && t.hasAttribute("data-kb-close")) {
              this.closeSheet();
              return;
            }
            if (!t) return;
            const act = t.getAttribute("data-kb-act");
            if (act === "card-new") {
              const w = ((_b = (_a = t.closest(".bz-kb-sheet")) == null ? void 0 : _a.querySelector(".bz-kb-hw .bz-kb-w")) == null ? void 0 : _b.textContent) || "";
              const n = this.allNotes.find((x) => x.title === w);
              if (n) void this.openCardEditor(n);
            } else if (act === "card-save") {
              void this.saveCard();
            }
          });
          this.popup.appendChild(ovl);
          const titleInput = ovl.querySelector("[data-kb-role=cardtitle]");
          if (titleInput) titleInput.addEventListener("input", () => {
            if (this.editor) this.editor.title = titleInput.value;
            this.syncSaveBtn();
          });
          const whyInput = ovl.querySelector("[data-kb-role=why]");
          if (whyInput) whyInput.addEventListener("input", () => {
            if (this.editor) this.editor.why = whyInput.value;
            this.syncSaveBtn();
          });
          ovl.querySelectorAll("[data-kb-old]").forEach((b) => {
            b.addEventListener("click", () => {
              if (!this.editor) return;
              this.editor.pick = b.getAttribute("data-kb-old");
              ovl.querySelectorAll("[data-kb-old]").forEach((x) => x.classList.toggle("is-on", x === b));
              this.syncSaveBtn();
            });
          });
          this.syncSaveBtn();
        }
        closeSheet() {
          var _a;
          (_a = this.popup) == null ? void 0 : _a.querySelectorAll(".bz-kb-ovl").forEach((x) => x.remove());
          this.editor = null;
        }
        sheetWrap(title, body) {
          return `<div class="bz-kb-sheet-head"><span class="bz-kb-sheet-title">${esc(title)}</span></div><div class="bz-kb-sheet-body">${body}</div>`;
        }
        /** 旧笔记自动补全（note-gen；AI 未配置跳过并提示一句）；每目录至多跑一次 */
        async runBackfill() {
          const dir = litDirOf(tryGetSettings());
          if (this.backfilledDir === dir) return;
          this.backfilledDir = dir;
          try {
            const res = await backfillNotes();
            if (res && res.aiSkipped) {
              notice("AI 未配置：部分旧笔记缺少领域分类，已跳过补全（配置 AI 后重新打开面板可补全）", "info");
            }
            if (res && res.filled > 0 && this.part === "z1") await this.refreshCurrent();
          } catch (e) {
          }
        }
        // ---- 主面板增量刷新（knowledge:file-* 四通道 300ms 防抖） ----
        scheduleRefreshFlush() {
          if (this.refreshTimer) clearTimeout(this.refreshTimer);
          this.refreshTimer = setTimeout(async () => {
            const deletes = Array.from(this.pendingDeletePaths);
            const modifies = Array.from(this.pendingRefreshPaths);
            this.pendingDeletePaths.clear();
            this.pendingRefreshPaths.clear();
            for (const p of deletes) this.removeCached(p);
            for (const p of modifies) this.invalidateCached(p);
            if (this.popup && this.popup.style.display === "flex") await this.refreshCurrent();
          }, 300);
        }
        removeCached(path) {
          this.allNotes = this.allNotes.filter((n) => n.path !== path);
          this.allCards = this.allCards.filter((c) => c.path !== path);
          this.allTopics = this.allTopics.filter((t) => t.path !== path);
        }
        invalidateCached(_path) {
          this.loadedLitDir = "";
          this.loadedCardDir = "";
          this.loadedTopicDir = "";
        }
        attachFileListener() {
          if (this.fileListenerAttached) return;
          const inAnyDir = (path) => {
            const s = tryGetSettings();
            return path.startsWith(litDirOf(s) + "/") || path.startsWith(cardboxDirOf(s) + "/") || path.startsWith(topicDirOf(s) + "/");
          };
          const modifyHandler = (p) => {
            if (inAnyDir(p)) {
              this.pendingRefreshPaths.add(p);
              this.scheduleRefreshFlush();
            }
          };
          const deleteHandler = (evt) => {
            if (inAnyDir(evt.path)) {
              this.pendingDeletePaths.add(evt.path);
              this.scheduleRefreshFlush();
            }
          };
          const renameHandler = (evt) => {
            if (inAnyDir(evt.oldPath)) this.pendingDeletePaths.add(evt.oldPath);
            if (!evt.movedOut && inAnyDir(evt.newPath)) this.pendingRefreshPaths.add(evt.newPath);
            this.scheduleRefreshFlush();
          };
          this.fileListenerRefs = [
            onDomainEvent("knowledge:file-created", (evt) => modifyHandler(evt.path)),
            onDomainEvent("knowledge:file-modified", (evt) => modifyHandler(evt.path)),
            onDomainEvent("knowledge:file-deleted", deleteHandler),
            onDomainEvent("knowledge:file-renamed", renameHandler)
          ];
          this.fileListenerAttached = true;
        }
        // ==================== 视频录入面板（任务队列） ====================
        createVideoUI() {
          const mask = document.createElement("div");
          mask.id = "knowledge-video-mask";
          mask.className = "bz-kb-mask";
          mask.style.display = "none";
          mask.onclick = () => this.hideVideo();
          const popup = document.createElement("div");
          popup.id = "knowledge-video-popup";
          popup.className = "bz-kb-window kb";
          popup.style.display = "none";
          const header = document.createElement("div");
          header.className = "bz-kb-vhead";
          header.innerHTML = `
      <h3 class="bz-kb-vtitle">视频录入</h3>
      <div class="bz-lit-head-btns">
        <button id="lit-btn-video-add" title="添加转文献任务">➕</button>
        <button id="lit-btn-video-run" class="bz-lit-run-btn" title="批量处理（桌面端）">▶️</button>
        <button id="lit-btn-video-history" title="历史">🕘</button>
      </div>`;
          const list = document.createElement("div");
          list.id = "knowledge-video-list";
          list.className = "bz-kb-list";
          popup.appendChild(header);
          popup.appendChild(list);
          document.body.appendChild(mask);
          document.body.appendChild(popup);
          this.videoMask = mask;
          this.videoPopup = popup;
          this.videoList = list;
          this._bindVideoHeaderEvents();
          if (isMobileEnv()) {
            const run = q(popup, "#lit-btn-video-run");
            const history = q(popup, "#lit-btn-video-history");
            if (run) run.style.display = "none";
            if (history) history.style.display = "none";
          }
        }
        _bindVideoHeaderEvents() {
          const p = this.videoPopup;
          if (!p) return;
          q(p, "#lit-btn-video-add").onclick = () => this.showAddDialog();
          q(p, "#lit-btn-video-run").onclick = () => {
            if (BatchRunner.running) void this.onAbortBatch();
            else void this.onRunBatch();
          };
          q(p, "#lit-btn-video-history").onclick = () => this.showHistory();
        }
        /** 打开视频录入面板；prefill 存在则叠开添加弹窗（聚合讯「保存至文献」入口） */
        showVideoEntry(prefill) {
          var _a, _b;
          if (!this.videoPopup || !this.videoMask) return;
          topifyZ(this.videoMask, this.videoPopup);
          this.videoMask.style.display = "block";
          this.videoPopup.style.display = "flex";
          void this.refreshVideoPanel();
          if (prefill) this.showAddDialog({ url: prefill.url, title: (_a = prefill.title) != null ? _a : null, uploader: (_b = prefill.uploader) != null ? _b : null });
        }
        hideVideo() {
          if (this.videoMask) this.videoMask.style.display = "none";
          if (this.videoPopup) this.videoPopup.style.display = "none";
        }
        async refreshVideoPanel() {
          const tasks = await KnowledgeData.loadTasks();
          if (!this.videoList) return;
          this.videoList.innerHTML = "";
          const active = tasks.filter((t) => !t.archived);
          const running = BatchRunner.running;
          if (running) {
            const idx = active.findIndex((t) => t.status === "processing");
            const banner = document.createElement("div");
            banner.className = "bz-kb-banner";
            banner.textContent = idx >= 0 ? `⏳ 正在处理 第 ${idx + 1}/${active.length} 部…` : "⏳ 正在准备处理…";
            this.videoList.appendChild(banner);
          }
          this._syncStatusCounts(active);
          if (active.length === 0) {
            const empty = document.createElement("div");
            empty.className = "bz-kb-empty";
            empty.textContent = "暂无转文献任务。点击 ➕ 添加视频链接与起止时间，回到桌面端即可批量处理。";
            this.videoList.appendChild(empty);
            this._syncRunButton(active);
            return;
          }
          for (const t of active) this.videoList.appendChild(this.renderRow(t));
          this._syncRunButton(active);
        }
        _syncStatusCounts(tasks) {
          const el = this.videoPopup ? q(this.videoPopup, "#lit-video-counts") : null;
          if (!el) return;
          const count = (s) => tasks.filter((t) => t.status === s).length;
          const parts = [];
          if (count("pending")) parts.push(`${count("pending")} 待处理`);
          if (count("processing")) parts.push(`${count("processing")} 处理中`);
          if (count("failed")) parts.push(`${count("failed")} 失败`);
          el.textContent = parts.join(" · ");
        }
        /** 单钮态机：空闲「▶️」/运行中「⏹」（终止靠 title hover 区分），移动端整钮隐藏 */
        _syncRunButton(tasks) {
          if (!this.videoPopup) return;
          const run = q(this.videoPopup, "#lit-btn-video-run");
          if (!run) return;
          const running = BatchRunner.running;
          const hasWork = tasks.some((t) => t.status === "pending" || t.status === "failed");
          if (running) {
            run.disabled = false;
            const retry = this.batchAbortLabel === "终止整批";
            run.textContent = "⏹";
            run.title = retry ? "中止整批（处理失败任务中）" : "中止批量处理";
          } else {
            run.disabled = !hasWork;
            run.textContent = "▶️";
            run.title = "批量处理（桌面端）";
          }
        }
        renderRow(task) {
          var _a;
          const card = document.createElement("div");
          card.className = "bz-kb-taskcard";
          card.dataset.id = task.id;
          const meta = (_a = STATUS_META[task.status]) != null ? _a : STATUS_META.pending;
          const timeText = task.start && task.end ? `${task.start} ~ ${task.end}` : "整片";
          const linkLine = task.title ? `<a class="bz-kb-tlink" href="${esc(task.url)}" title="${esc(task.url)}">${esc(task.title)}</a>` : `<span class="bz-kb-turl" title="${esc(task.url)}">${esc(shortUrlText(task.url))}</span>`;
          const upText = task.uploader ? ` · UP主 ${esc(task.uploader)}` : "";
          card.innerHTML = `
      <div class="bz-kb-trow">
        <span class="bz-kb-status ${meta.cls}">${meta.label}</span>
        ${linkLine}
      </div>
      <div class="bz-kb-tmeta">${timeText}${upText}${task.remark ? " · " + esc(task.remark) : ""}</div>
      ${task.status === "processing" ? this.runState.has(task.id) ? '<div class="bz-kb-progress-box"></div>' : task.reason ? `<div class="bz-kb-progress">${esc(task.reason)}</div>` : "" : ""}
      ${task.status === "failed" && task.reason ? `<div class="bz-kb-progress bz-kb-progress-error" title="${esc(task.reason)}">${esc(humanizeError(task.reason))}</div>` : ""}
      ${task.status === "success" && task.notePath ? `<div class="bz-kb-notepath">📄 ${esc(task.notePath)}</div>` : ""}`;
          const actions = this.buildCardActions(task);
          if (actions.length) attachItemActions(card, actions);
          const titleLink = q(card, ".bz-kb-tlink");
          if (titleLink) titleLink.onclick = (e) => {
            e.stopPropagation();
            this._openExternal(titleLink.href || task.url);
          };
          card.addEventListener("click", () => {
            if (task.status === "success" && task.notePath) this.openNote(task.notePath);
            else if (task.status === "pending" || task.status === "failed") this.showAddDialog(task);
          });
          return card;
        }
        buildCardActions(task) {
          const actions = [];
          if (task.status === "success") {
            if (task.notePath) actions.push({ icon: "book-open", label: "打开文献笔记", onClick: () => this.openNote(task.notePath) });
            if (task.videoPath) actions.push({ icon: "copy", label: "复制视频路径", onClick: () => void this.copyText(task.videoPath) });
            actions.push({ icon: "pencil", label: "编辑", onClick: () => this.showAddDialog(task) });
          } else if (task.status === "failed" || task.status === "pending") {
            actions.push({ icon: "pencil", label: "编辑", onClick: () => this.showAddDialog(task) });
          }
          actions.push({ icon: "trash-2", label: "删除", kind: "danger", onClick: () => void this.confirmDelete(task) });
          return actions;
        }
        /** 行内进度定点更新（不等 storage 落库，一到立即刷 DOM） */
        updateRowProgress(id) {
          if (!this.videoList) return;
          const st = this.runState.get(id);
          const card = q(this.videoList, `.bz-kb-taskcard[data-id="${id}"]`);
          if (!card || !st) return;
          let box = q(card, ".bz-kb-progress-box");
          if (!box) {
            box = document.createElement("div");
            box.className = "bz-kb-progress-box";
            const meta = q(card, ".bz-kb-tmeta");
            if (meta) meta.after(box);
            else card.appendChild(box);
          }
          if (tryGetSettings().knowledgeProgressDetail === false) {
            const cur = st.steps[st.steps.length - 1] || "处理中…";
            box.innerHTML = `<div class="bz-kb-progress">${esc(cur)}</div>`;
            return;
          }
          const segs = st.steps.map(
            (s, i) => i === st.steps.length - 1 ? `<span class="bz-kb-step-cur">${esc(s)}</span>` : `<span class="bz-kb-step-done">✓ ${esc(stepDoneLabel(s))}</span>`
          );
          const pct = st.phase === "download" ? st.pct : null;
          const bar = pct != null ? `<div class="bz-kb-progress-track"><div class="bz-kb-progress-fill" style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>` : "";
          box.innerHTML = `
      <div class="bz-kb-steps">${segs.join('<span class="bz-kb-step-arrow">→</span>')}${pct != null ? ` <span class="bz-kb-step-pct">${Math.round(pct)}%</span>` : ""}</div>
      ${bar}
      <div class="bz-kb-elapsed">⌛ ${fmtElapsed(Date.now() - st.startAt)}</div>`;
        }
        startRunTimer() {
          this.clearRunTimer();
          this.runTimer = setInterval(() => {
            for (const id of Array.from(this.runState.keys())) this.updateRowProgress(id);
          }, 1e3);
        }
        clearRunTimer() {
          if (this.runTimer !== null) {
            clearInterval(this.runTimer);
            this.runTimer = null;
          }
        }
        async onRunBatch() {
          if (!BatchRunner.available()) {
            notice("仅桌面端可用：批量处理需要 Node.js 外部进程", "error");
            return;
          }
          if (BatchRunner.running) return;
          const tasks = await KnowledgeData.loadTasks();
          const work = tasks.filter((t) => !t.archived && (t.status === "pending" || t.status === "failed"));
          if (work.length === 0) {
            notice("没有待处理或失败的任务", "info");
            return;
          }
          this.batchAbortLabel = work.every((t) => t.status === "failed") ? "终止整批" : "终止";
          const ui = this;
          ui.startRunTimer();
          const events = {
            onTaskProgress: (t, stepText, progress) => {
              let st = ui.runState.get(t.id);
              if (!st) {
                st = { steps: [], phase: null, pct: null, startAt: Date.now() };
                ui.runState.set(t.id, st);
              }
              if (stepText && stepText !== "启动中…" && !st.steps.includes(stepText)) st.steps.push(stepText);
              if (progress) {
                if (progress.phase) st.phase = progress.phase;
                if (progress.pct != null) st.pct = progress.pct;
              }
              ui.updateRowProgress(t.id);
            },
            onTaskInfo: () => {
              void ui.refreshVideoPanel();
            },
            onTaskDone: () => {
              void ui.refreshVideoPanel();
            },
            onBatchDone: (summary) => {
              ui.clearRunTimer();
              ui.runState.clear();
              const head = `处理完成：成功 ${summary.success} 部`;
              const tail = summary.failed ? `，失败 ${summary.failed} 部` : "";
              const end = summary.aborted ? "（已中止）" : summary.stopped ? "（遇错即停）" : "";
              notice(head + tail + end, summary.failed || summary.aborted || summary.stopped ? "warning" : "success");
              void ui.refreshVideoPanel();
            }
          };
          const runP = BatchRunner.runAll(work, events);
          void this.refreshVideoPanel();
          try {
            await runP;
          } finally {
            this.batchAbortLabel = null;
          }
        }
        async onAbortBatch() {
          if (!BatchRunner.running) return;
          const v = await openFlowDialog({
            title: "中止批量处理？",
            message: "当前正在处理的视频将停止，已成功的保留在列表；未开始的项保持待处理，可稍后继续。",
            actions: [
              { label: "取消", value: "cancel" },
              { label: "中止", value: "ok", danger: true }
            ]
          });
          if (v !== "ok") return;
          BatchRunner.abort();
          await this.refreshVideoPanel();
        }
        async confirmDelete(task) {
          const v = await openFlowDialog({
            title: "删除转文献任务",
            message: "仅从列表移除记录，已生成的文献笔记与视频不受影响。",
            actions: [
              { label: "取消", value: "cancel" },
              { label: "删除", value: "ok", danger: true }
            ]
          });
          if (v !== "ok") return;
          await KnowledgeData.deleteTask(task.id);
          await this.refreshVideoPanel();
          await this.refreshHistory();
        }
        async confirmClearHistory() {
          const v = await openFlowDialog({
            title: "清空历史",
            message: "将移除全部「成功」归档记录；文献笔记与视频文件保留在原处。",
            actions: [
              { label: "取消", value: "cancel" },
              { label: "清空", value: "ok", danger: true }
            ]
          });
          if (v !== "ok") return;
          await KnowledgeData.clearHistory();
          await this.refreshHistory();
        }
        // ==================== 添加任务弹窗 ====================
        createAddDialog() {
          var _a;
          const addMask = document.createElement("div");
          addMask.id = "knowledge-add-mask";
          addMask.className = "bz-kb-mask";
          addMask.style.display = "none";
          addMask.onclick = () => this.hideAddDialog();
          const popup = document.createElement("div");
          popup.id = "knowledge-add-popup";
          popup.className = "bz-lit-dialog kb";
          popup.style.display = "none";
          popup.innerHTML = `
      <div id="lit-add-mode" class="bz-lit-mode-tag" style="display:none;">编辑任务</div>
      <div id="lit-add-fail" class="bz-lit-form-alert" style="display:none;"></div>
      <div class="bz-lit-form-col bz-lit-url-col">
        <label>视频链接 / BV 号</label>
        <div class="bz-lit-url-row">
          <input id="lit-add-url" type="text">
          <div class="bz-lit-range-toggle" id="lit-add-range">
            <button type="button" data-range="whole">整片</button>
            <button type="button" data-range="clip">剪辑片段</button>
          </div>
        </div>
      </div>
      <div class="bz-lit-form-row">
        <div class="bz-lit-form-col"><label>视频标题（可选）</label>
          <input id="lit-add-vtitle" type="text"></div>
        <div class="bz-lit-form-col"><label>UP主（可选）</label>
          <input id="lit-add-uploader" type="text"></div>
      </div>
      <div class="bz-lit-form-row">
        <div class="bz-lit-form-col"><label>下载清晰度</label>
          <select id="lit-add-quality">
            <option value="">跟随全局设置</option>
            <option value="highest">最高</option>
            <option value="1080">1080P</option>
            <option value="720">720P</option>
          </select></div>
        <div class="bz-lit-form-col"><label>分P</label>
          <input id="lit-add-page" type="number" min="1" step="1"></div>
      </div>
      <div id="lit-add-clip-fields" style="display:none;">
        <div class="bz-lit-form-row">
          <div class="bz-lit-form-col"><label>开始时间</label>
            <input id="lit-add-start" type="text"></div>
          <div class="bz-lit-form-col"><label>结束时间</label>
            <input id="lit-add-end" type="text"></div>
        </div>
      </div>
      <div class="bz-lit-form-actions">
        <button id="lit-add-save" class="bz-lit-accent-btn">保存</button>
      </div>`;
          document.body.appendChild(addMask);
          document.body.appendChild(popup);
          this.addMask = addMask;
          this.addPopup = popup;
          q(popup, "#lit-add-save").onclick = () => void this._handleAddSave();
          const rangeBox = q(popup, "#lit-add-range");
          if (rangeBox) {
            rangeBox.addEventListener("click", (e) => {
              const btn = e.target.closest("button[data-range]");
              if (btn) this._setAddRangeMode(btn.getAttribute("data-range") === "clip" ? "clip" : "whole");
            });
          }
          for (const sel of ["#lit-add-url", "#lit-add-vtitle", "#lit-add-uploader", "#lit-add-page", "#lit-add-start", "#lit-add-end"]) {
            (_a = q(popup, sel)) == null ? void 0 : _a.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void this._handleAddSave();
              }
            });
          }
          const addUrlInput = q(popup, "#lit-add-url");
          if (addUrlInput) {
            addUrlInput.addEventListener("input", () => {
              if (this.addUrlTimer) clearTimeout(this.addUrlTimer);
              this.addUrlSeq++;
              this.addUrlTimer = setTimeout(() => {
                this.addUrlTimer = null;
                void this.addUrlResolve(addUrlInput);
              }, 450);
            });
          }
        }
        showAddDialog(editItem) {
          var _a, _b, _c, _d, _e, _f, _g;
          if (!this.addPopup || !this.addMask) return;
          this.addUrlReset();
          this.editingId = (_a = editItem == null ? void 0 : editItem.id) != null ? _a : null;
          const modeTag = q(this.addPopup, "#lit-add-mode");
          if (modeTag) modeTag.style.display = this.editingId ? "inline-block" : "none";
          q(this.addPopup, "#lit-add-url").value = (_b = editItem == null ? void 0 : editItem.url) != null ? _b : "";
          q(this.addPopup, "#lit-add-start").value = (_c = editItem == null ? void 0 : editItem.start) != null ? _c : "";
          q(this.addPopup, "#lit-add-end").value = (_d = editItem == null ? void 0 : editItem.end) != null ? _d : "";
          q(this.addPopup, "#lit-add-quality").value = (_e = editItem == null ? void 0 : editItem.quality) != null ? _e : "";
          q(this.addPopup, "#lit-add-page").value = (editItem == null ? void 0 : editItem.page) ? String(editItem.page) : "";
          q(this.addPopup, "#lit-add-vtitle").value = (_f = editItem == null ? void 0 : editItem.title) != null ? _f : "";
          q(this.addPopup, "#lit-add-uploader").value = (_g = editItem == null ? void 0 : editItem.uploader) != null ? _g : "";
          this._setAddRangeMode(this.editingId ? (editItem == null ? void 0 : editItem.start) || (editItem == null ? void 0 : editItem.end) ? "clip" : "whole" : "clip");
          const fail = q(this.addPopup, "#lit-add-fail");
          if (fail) {
            const reason = (editItem == null ? void 0 : editItem.status) === "failed" ? editItem.reason || "" : "";
            fail.style.display = reason ? "block" : "none";
            fail.textContent = reason ? `上次处理失败：${humanizeError(reason)}` : "";
            fail.title = reason;
          }
          topifyZ(this.addMask, this.addPopup);
          this.addMask.style.display = "block";
          this.addPopup.style.display = "flex";
          const urlInput = q(this.addPopup, "#lit-add-url");
          if (urlInput) setTimeout(() => urlInput.focus(), 100);
        }
        _setAddRangeMode(mode) {
          if (!this.addPopup) return;
          const box = q(this.addPopup, "#lit-add-range");
          if (box) {
            for (const btn of Array.from(box.querySelectorAll("button[data-range]"))) {
              btn.classList.toggle("active", btn.getAttribute("data-range") === mode);
            }
          }
          const clipFields = q(this.addPopup, "#lit-add-clip-fields");
          if (clipFields) clipFields.style.display = mode === "clip" ? "block" : "none";
        }
        hideAddDialog() {
          if (this.addMask) this.addMask.style.display = "none";
          if (this.addPopup) this.addPopup.style.display = "none";
          this.editingId = null;
          this.addUrlReset();
        }
        /** 录入 URL 解析清理：防抖定时器归零 + 序列号失效在途响应（开/关弹窗共用） */
        addUrlReset() {
          if (this.addUrlTimer) {
            clearTimeout(this.addUrlTimer);
            this.addUrlTimer = null;
          }
          this.addUrlSeq++;
        }
        /**
         * 录入 URL 防抖触发（issue 278）：先净化写回（值有变才写，用户可见），再抓元信息。
         * 回填只补空字段（trim 后为空才算空）；序列号 + 输入值双校验丢弃过期响应；全程静默。
         */
        async addUrlResolve(input) {
          const popup = this.addPopup;
          if (!popup) return;
          const seq = this.addUrlSeq;
          const cleaned = normalizeSourceUrl(input.value);
          if (cleaned && cleaned !== input.value) input.value = cleaned;
          const meta = await fetchVideoMeta(cleaned);
          if (seq !== this.addUrlSeq || this.addPopup !== popup || input.value !== cleaned) return;
          const titleEl = q(popup, "#lit-add-vtitle");
          const upEl = q(popup, "#lit-add-uploader");
          if ((meta == null ? void 0 : meta.title) && titleEl && !titleEl.value.trim()) titleEl.value = meta.title;
          if ((meta == null ? void 0 : meta.uploader) && upEl && !upEl.value.trim()) upEl.value = meta.uploader;
        }
        async _handleAddSave() {
          var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q;
          if (!this.addPopup) return;
          const url = normalizeSourceUrl(((_b = (_a = q(this.addPopup, "#lit-add-url")) == null ? void 0 : _a.value) != null ? _b : "").trim());
          const clipMode = ((_d = (_c = q(this.addPopup, "#lit-add-range")) == null ? void 0 : _c.querySelector("button[data-range].active")) == null ? void 0 : _d.getAttribute("data-range")) === "clip";
          const startRaw = ((_f = (_e = q(this.addPopup, "#lit-add-start")) == null ? void 0 : _e.value) != null ? _f : "").trim();
          const endRaw = ((_h = (_g = q(this.addPopup, "#lit-add-end")) == null ? void 0 : _g.value) != null ? _h : "").trim();
          const start = clipMode ? normalizeLooseTime(startRaw) : "";
          const end = clipMode ? normalizeLooseTime(endRaw) : "";
          const quality = ((_j = (_i = q(this.addPopup, "#lit-add-quality")) == null ? void 0 : _i.value) != null ? _j : "").trim() || null;
          const pageRaw = ((_l = (_k = q(this.addPopup, "#lit-add-page")) == null ? void 0 : _k.value) != null ? _l : "").trim();
          const vtitle = ((_n = (_m = q(this.addPopup, "#lit-add-vtitle")) == null ? void 0 : _m.value) != null ? _n : "").trim();
          const uploader = ((_p = (_o = q(this.addPopup, "#lit-add-uploader")) == null ? void 0 : _o.value) != null ? _p : "").trim();
          const focusField = (sel) => {
            var _a2;
            return (_a2 = q(this.addPopup, sel)) == null ? void 0 : _a2.focus();
          };
          if (!url) {
            notice("请填写视频链接或 BV 号", "error");
            focusField("#lit-add-url");
            return;
          }
          if (clipMode && !startRaw && !endRaw) {
            notice("剪辑片段需填写开始与结束时间", "error");
            focusField("#lit-add-start");
            return;
          }
          if (start === null || end === null) {
            notice("时间格式看不懂：支持 12.2 / 12-2 / 1:30:05 等，单个数字按分钟算", "error");
            focusField(start === null ? "#lit-add-start" : "#lit-add-end");
            return;
          }
          if (!start && end || start && !end) {
            notice("开始与结束时间需成对填写", "error");
            focusField(start ? "#lit-add-end" : "#lit-add-start");
            return;
          }
          let page = null;
          if (pageRaw) {
            const n = Number(pageRaw);
            if (!Number.isInteger(n) || n < 1) {
              notice("分P 应为正整数（留空 = 第 1 P）", "error");
              focusField("#lit-add-page");
              return;
            }
            page = n;
          }
          try {
            const patch = { url, start: start || null, end: end || null, quality, page, title: vtitle || null, uploader: uploader || null };
            if (this.editingId) {
              await KnowledgeData.updateTask(this.editingId, patch);
            } else {
              await KnowledgeData.addTask(patch);
            }
            this.hideAddDialog();
            await this.refreshVideoPanel();
          } catch (e) {
            notice("保存失败：" + ((_q = e == null ? void 0 : e.message) != null ? _q : String(e)), "error");
          }
        }
        // ==================== 历史弹窗 ====================
        createHistoryUI() {
          const mask = document.createElement("div");
          mask.id = "knowledge-history-mask";
          mask.className = "bz-kb-mask";
          mask.style.display = "none";
          mask.onclick = () => this.hideHistory();
          const popup = document.createElement("div");
          popup.id = "knowledge-history-popup";
          popup.className = "bz-kb-window kb";
          popup.style.display = "none";
          const toolbar = document.createElement("div");
          toolbar.className = "bz-kb-vhead";
          const counts = document.createElement("span");
          counts.id = "lit-history-counts";
          counts.className = "bz-kb-vmeta";
          toolbar.appendChild(counts);
          const list = document.createElement("div");
          list.id = "knowledge-history-list";
          list.className = "bz-kb-list";
          popup.appendChild(toolbar);
          popup.appendChild(list);
          document.body.appendChild(mask);
          document.body.appendChild(popup);
          this.historyMask = mask;
          this.historyPopup = popup;
          this.historyList = list;
        }
        showHistory() {
          if (!this.historyPopup || !this.historyMask) return;
          topifyZ(this.historyMask, this.historyPopup);
          this.historyMask.style.display = "block";
          this.historyPopup.style.display = "flex";
          void this.refreshHistory();
        }
        hideHistory() {
          if (this.historyMask) this.historyMask.style.display = "none";
          if (this.historyPopup) this.historyPopup.style.display = "none";
        }
        async refreshHistory() {
          if (!this.historyList) return;
          const tasks = await KnowledgeData.loadTasks();
          if (!this.historyList) return;
          this.historyList.innerHTML = "";
          const rows = tasks.filter((t) => t.archived);
          const countsEl = this.historyPopup ? q(this.historyPopup, "#lit-history-counts") : null;
          if (countsEl) countsEl.textContent = `🕘 历史 · 共 ${rows.length} 条`;
          if (rows.length === 0) {
            const empty = document.createElement("div");
            empty.className = "bz-kb-empty";
            empty.textContent = "暂无历史记录。成功的任务完成时会自动归档到这里。";
            this.historyList.appendChild(empty);
            return;
          }
          const groups = /* @__PURE__ */ new Map();
          for (const t of rows) {
            const key = t.url || t.id;
            const g = groups.get(key);
            if (g) g.push(t);
            else groups.set(key, [t]);
          }
          const sortedGroups = Array.from(groups.values()).map((g) => {
            g.sort((a, b) => String(a.processedAt || a.created).localeCompare(String(b.processedAt || b.created)));
            return g;
          });
          sortedGroups.sort((a, b) => {
            var _a, _b, _c, _d;
            const la = String(((_a = a[a.length - 1]) == null ? void 0 : _a.processedAt) || ((_b = a[a.length - 1]) == null ? void 0 : _b.created) || "");
            const lb = String(((_c = b[b.length - 1]) == null ? void 0 : _c.processedAt) || ((_d = b[b.length - 1]) == null ? void 0 : _d.created) || "");
            return lb.localeCompare(la);
          });
          for (const g of sortedGroups) this.historyList.appendChild(this.renderHistoryGroup(g));
        }
        renderHistoryGroup(group) {
          const head = group[0];
          const card = document.createElement("div");
          card.className = "bz-kb-taskcard bz-kb-hgroup";
          card.dataset.url = head.url || "";
          const href = head.url ? `href="${esc(head.url)}"` : "";
          const upText = head.uploader ? `<span class="bz-kb-hup">${esc(head.uploader)}</span>` : "";
          card.innerHTML = `
      <div class="bz-kb-trow">
        ${head.title ? `<a class="bz-kb-tlink" ${href} title="${esc(head.url || "")}">${esc(head.title)}</a>` : `<span class="bz-kb-turl" title="${esc(head.url || "")}">${esc(shortUrlText(head.url || ""))}</span>`}
        ${upText}
      </div>`;
          for (const task of group) {
            const line = document.createElement("div");
            line.className = "bz-kb-hnote";
            line.innerHTML = `📄 ${esc(shortNoteName(task.notePath || ""))}<span class="bz-kb-hnote-time">⏱ ${esc(formatRelativeTime(task.processedAt || task.created || ""))}</span>`;
            line.addEventListener("click", () => {
              if (task.notePath) this.openNote(task.notePath);
            });
            const actions = [];
            if (task.notePath) actions.push({ icon: "book-open", label: "打开文献笔记", onClick: () => this.openNote(task.notePath) });
            if (task.videoPath) actions.push({ icon: "copy", label: "复制视频路径", onClick: () => void this.copyText(task.videoPath) });
            actions.push({ icon: "trash-2", label: "移出历史", kind: "danger", onClick: () => void this.confirmDelete(task) });
            attachItemActions(line, actions);
            card.appendChild(line);
          }
          const link = q(card, ".bz-kb-tlink");
          if (link && head.url) link.onclick = (e) => {
            e.stopPropagation();
            this._openExternal(head.url);
          };
          return card;
        }
        // ==================== 术语生成面板（文字录入；142 简洁版 + 155 总结） ====================
        createTermUI() {
          var _a;
          const mask = document.createElement("div");
          mask.id = "knowledge-term-mask";
          mask.className = "bz-kb-mask";
          mask.style.display = "none";
          mask.onclick = () => this.hideTermEntry();
          const popup = document.createElement("div");
          popup.id = "knowledge-term-popup";
          popup.className = "bz-lit-dialog bz-lit-term-dialog kb";
          popup.style.display = "none";
          const body = document.createElement("div");
          body.className = "bz-lit-term-body";
          body.innerHTML = `
      <div class="bz-lit-sheet-head">
        <span class="bz-lit-sheet-title">文字录入 · 术语</span>
      </div>
      <div class="bz-lit-term-row">
        <span class="bz-lit-term-meta-k">术语</span>
        <input id="lit-term-input" type="text" autocomplete="off">
      </div>
      <div class="bz-lit-term-row">
        <span class="bz-lit-term-meta-k">来源</span>
        <input id="lit-term-src" type="text" autocomplete="off">
        <span id="lit-term-src-chip" class="bz-lit-srcchip" style="display:none;"></span>
      </div>
      <div class="bz-lit-term-actions">
        <button id="lit-term-generate" class="bz-lit-accent-btn">生成</button>
        <button id="lit-term-cancel" class="bz-lit-ghost-btn">取消</button>
      </div>
      <div id="lit-term-preview" style="display:none;">
        <div class="bz-lit-term-card">
          <div class="bz-lit-term-meta">
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">术语</span><span id="lit-term-meta-term" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">领域</span><span id="lit-term-meta-domain" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">日期</span><span id="lit-term-meta-date" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row" id="lit-term-meta-srcrow" style="display:none;"><span class="bz-lit-term-meta-k">来源</span><span id="lit-term-meta-src" class="bz-lit-term-meta-v bz-lit-srcopen" data-term-src-open="1"></span></div>
          </div>
        </div>
        <div class="bz-lit-term-card">
          <div id="lit-term-content" class="bz-lit-term-content"></div>
        </div>
        <div class="bz-lit-term-actions">
          <button id="lit-term-regenerate">总结</button>
          <button id="lit-term-save" class="bz-lit-accent-btn">确认写入</button>
        </div>
      </div>`;
          popup.appendChild(body);
          document.body.appendChild(mask);
          document.body.appendChild(popup);
          this.termMask = mask;
          this.termPopup = popup;
          mask.addEventListener("click", (e) => {
            if (e.target === mask) this.hideTermEntry();
          });
          q(popup, "#lit-term-generate").onclick = () => void this.onTermGenerate();
          q(popup, "#lit-term-cancel").onclick = () => this.hideTermEntry();
          q(popup, "#lit-term-regenerate").onclick = () => void this.onTermSummarize();
          q(popup, "#lit-term-save").onclick = () => void this.onTermConfirm();
          (_a = q(popup, "#lit-term-input")) == null ? void 0 : _a.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void this.onTermGenerate();
            }
          });
          const srcInput = q(popup, "#lit-term-src");
          if (srcInput) {
            srcInput.addEventListener("input", () => {
              if (this.termSrcTimer) clearTimeout(this.termSrcTimer);
              this.termSrcTimer = setTimeout(() => this.termSrcTryCommit(srcInput), 450);
            });
            srcInput.addEventListener("keydown", (e) => {
              if (e.key !== "Enter") return;
              const raw = (srcInput.value || "").trim();
              if (raw && isUrlLikeSourceText(raw)) {
                e.preventDefault();
                this.termSrcSet({ kind: "external", url: normalizeSourceUrl(raw) }, srcInput);
              }
            });
            this.termSrcSuggest = uiSuggest({
              anchor: srcInput,
              max: 12,
              iconOf: () => "📄",
              labelOf: (p) => noteSourceName(p),
              source: () => {
                if (!srcInput.value.trim()) return [];
                return (getApp().vault.getFiles() || []).filter((f) => f.extension === "md").map((f) => f.path);
              },
              onPick: (p) => this.termSrcSet({ kind: "note", path: p }, srcInput)
            });
          }
          popup.addEventListener("click", (e) => {
            const t = e.target.closest("[data-term-src-clear],[data-term-src-open]");
            if (!t) return;
            e.stopPropagation();
            if (t.hasAttribute("data-term-src-clear")) {
              const input = q(popup, "#lit-term-src");
              this.termSrcClear(input);
            } else if (this.termSource) {
              if (this.termSource.kind === "note") this.openNote(this.termSource.path);
              else this._openExternal(this.termSource.url);
            }
          });
        }
        /**
         * 打开术语录入弹层；term 预填（命令带选中词时自动生成）；src 预填来源（ADR-0116——
         * 仅命令入口带当前笔记，主窗按钮入口不预填）。
         */
        showTermEntry(term, src) {
          if (!this.termPopup || !this.termMask) return;
          this.termPreview = null;
          this.termHasDraft = false;
          const input = q(this.termPopup, "#lit-term-input");
          if (input) input.value = (term != null ? term : "").trim();
          this.termSrcReset(q(this.termPopup, "#lit-term-src"));
          if (src) this.termSrcSet(src, q(this.termPopup, "#lit-term-src"));
          this.setTermPreviewVisible(false);
          this.setTermGenLoading(false);
          topifyZ(this.termMask, this.termPopup);
          this.termMask.style.display = "block";
          this.termPopup.style.display = "flex";
          if (input && !input.value) setTimeout(() => input.focus(), 100);
          if (input && input.value) void this.onTermGenerate();
        }
        /** 来源状态清空（chip 收起、输入框复位、计时器/联想层归零）——每次打开弹层即全新 */
        termSrcReset(input) {
          if (this.termSrcTimer) {
            clearTimeout(this.termSrcTimer);
            this.termSrcTimer = null;
          }
          this.termSource = null;
          if (input) {
            input.value = "";
            input.style.display = "";
          }
          this.renderTermSrcChip(input);
          this.termSrcRefreshMeta();
        }
        termSrcClear(input) {
          this.termSrcReset(input);
          if (input) setTimeout(() => input.focus(), 0);
        }
        /** 输入惰性提交：整串 URL 字样 → 外部 chip；其余文本等联想点选（不自动认领） */
        termSrcTryCommit(input) {
          this.termSrcTimer = null;
          const raw = (input.value || "").trim();
          if (!raw || !isUrlLikeSourceText(raw)) return;
          this.termSrcSet({ kind: "external", url: normalizeSourceUrl(raw) }, input);
        }
        /** 落来源：记录 + chip 渲染 + meta 行同步；外部来源异步抓标题（失败静默降级为纯链接） */
        termSrcSet(src, input) {
          this.termSource = src;
          this.renderTermSrcChip(input);
          this.termSrcRefreshMeta();
          if (src.kind === "external") void this.termSrcFetchTitle(src);
        }
        async termSrcFetchTitle(src) {
          try {
            const t = await fetchPageTitle(src.url);
            if (!t || this.termSource !== src) return;
            src.title = cleanSourceTitle(t);
            const inp = this.termPopup ? q(this.termPopup, "#lit-term-src") : null;
            this.renderTermSrcChip(inp);
            this.termSrcRefreshMeta();
          } catch (e) {
          }
        }
        /** chip 渲染：有来源 → 徽标（内/外）+ 名称 + ✕；无 → 输入框可见 */
        renderTermSrcChip(input) {
          const popup = this.termPopup;
          if (!popup) return;
          const chip = q(popup, "#lit-term-src-chip");
          if (!chip) return;
          const src = this.termSource;
          if (!src) {
            chip.style.display = "none";
            chip.textContent = "";
            if (input) input.style.display = "";
            return;
          }
          const isNote = src.kind === "note";
          const label = isNote ? noteSourceName(src.path) : src.title || shortUrlText(src.url);
          chip.title = isNote ? src.path : src.url;
          chip.style.display = "inline-flex";
          chip.innerHTML = `<b>${isNote ? "内 部" : "外 部"}</b><span>${esc(label)}</span><button type="button" data-term-src-clear title="清除来源" aria-label="清除来源">✕</button>`;
          if (input) input.style.display = "none";
        }
        /** 预览属性卡第 4 行「来源」：有来源显行（可点开），无来源隐行 */
        termSrcRefreshMeta() {
          const popup = this.termPopup;
          if (!popup) return;
          const row = q(popup, "#lit-term-meta-srcrow");
          const val = q(popup, "#lit-term-meta-src");
          if (!row || !val) return;
          const src = this.termSource;
          if (!src) {
            row.style.display = "none";
            val.textContent = "";
            return;
          }
          row.style.display = "";
          val.textContent = src.kind === "note" ? noteSourceName(src.path) : src.title || src.url;
          val.title = src.kind === "note" ? src.path : src.url;
        }
        setTermPreviewVisible(v) {
          if (!this.termPopup) return;
          const p = q(this.termPopup, "#lit-term-preview");
          if (p) p.style.display = v ? "flex" : "none";
        }
        setTermGenLoading(loading2) {
          if (!this.termPopup) return;
          const gen = q(this.termPopup, "#lit-term-generate");
          if (gen) {
            gen.disabled = loading2;
            gen.textContent = loading2 ? "生成中…" : this.termHasDraft ? "重新生成" : "生成";
          }
          const regen = q(this.termPopup, "#lit-term-regenerate");
          if (regen) regen.disabled = loading2;
          const save = q(this.termPopup, "#lit-term-save");
          if (save) save.disabled = loading2;
        }
        setTermSummarizing(s) {
          if (!this.termPopup) return;
          const regen = q(this.termPopup, "#lit-term-regenerate");
          if (regen) {
            regen.disabled = s;
            regen.textContent = s ? "总结中…" : "总结";
          }
          const save = q(this.termPopup, "#lit-term-save");
          if (save) save.disabled = s;
          const gen = q(this.termPopup, "#lit-term-generate");
          if (gen) gen.disabled = s;
        }
        noticeTermError(e) {
          const msg = String(e && e.message || e || "未知错误");
          if (/API Key|AI 配置|未配置/.test(msg)) {
            notice("未配置 AI：请到插件设置「AI 配置」页填 API Key 后再生成", "error");
          } else {
            notice("生成失败：" + msg, "error");
          }
        }
        async onTermGenerate() {
          var _a, _b;
          if (!this.termPopup || this.termGenerating) return;
          const term = ((_b = (_a = q(this.termPopup, "#lit-term-input")) == null ? void 0 : _a.value) != null ? _b : "").trim();
          if (!term) {
            notice("请输入术语", "error");
            return;
          }
          this.termGenerating = true;
          this.setTermGenLoading(true);
          try {
            const draft = await generateTermDraft(term);
            this.presentTermPreview(draft);
          } catch (e) {
            this.noticeTermError(e);
          } finally {
            this.termGenerating = false;
            this.setTermGenLoading(false);
          }
        }
        async onTermSummarize() {
          if (!this.termPopup || this.termSummarizing || this.termGenerating) return;
          if (!this.termPreview || !this.termPreview.body.trim()) {
            notice("请先生成简介", "info");
            return;
          }
          this.termSummarizing = true;
          this.setTermSummarizing(true);
          try {
            const summarized = await summarizeTermSummary(this.termPreview.body);
            this.termPreview.body = summarized;
            const contentEl = q(this.termPopup, "#lit-term-content");
            if (contentEl) contentEl.textContent = summarized;
          } catch (e) {
            this.noticeTermError(e);
          } finally {
            this.termSummarizing = false;
            this.setTermSummarizing(false);
          }
        }
        presentTermPreview(draft) {
          var _a, _b, _c;
          this.termPreview = { domain: draft.domain, body: draft.summary };
          this.termHasDraft = true;
          if (!this.termPopup) return;
          const term = ((_b = (_a = q(this.termPopup, "#lit-term-input")) == null ? void 0 : _a.value) != null ? _b : "").trim();
          const termEl = q(this.termPopup, "#lit-term-meta-term");
          if (termEl) termEl.textContent = term || "—";
          const domainEl = q(this.termPopup, "#lit-term-meta-domain");
          if (domainEl) domainEl.textContent = draft.domain || "—";
          const dateEl = q(this.termPopup, "#lit-term-meta-date");
          if (dateEl) dateEl.textContent = dateStamp();
          const contentEl = q(this.termPopup, "#lit-term-content");
          if (contentEl) contentEl.textContent = draft.summary;
          this.setTermPreviewVisible(true);
          const prev = q(this.termPopup, "#lit-term-preview");
          (_c = prev == null ? void 0 : prev.scrollIntoView) == null ? void 0 : _c.call(prev, { behavior: "smooth", block: "nearest" });
        }
        async onTermConfirm() {
          var _a, _b;
          if (!this.termPopup || this.termGenerating) return;
          const term = ((_b = (_a = q(this.termPopup, "#lit-term-input")) == null ? void 0 : _a.value) != null ? _b : "").trim();
          if (!term) {
            notice("请输入术语", "error");
            return;
          }
          if (!this.termPreview) {
            notice("请先点击「生成」获取简介预览", "info");
            return;
          }
          this.termGenerating = true;
          this.setTermGenLoading(true);
          try {
            const path = await generateTermNote({
              term,
              summary: this.termPreview.body,
              domain: this.termPreview.domain,
              source: this.termSource
              // 术语来源随确认时刻的值落库（ADR-0116）
            });
            this.openNote(path);
            emitDomainEvent("knowledge:tasks", { kind: "term-generated", term, title: term });
            this.termPreview = null;
            this.hideTermEntry();
            notice("已生成术语文献笔记：" + term, "success");
          } catch (e) {
            this.noticeTermError(e);
          } finally {
            this.termGenerating = false;
            this.setTermGenLoading(false);
          }
        }
        hideTermEntry() {
          this.termPreview = null;
          const srcInput = this.termPopup ? q(this.termPopup, "#lit-term-src") : null;
          this.termSrcReset(srcInput);
          if (this.termMask) this.termMask.style.display = "none";
          if (this.termPopup) this.termPopup.style.display = "none";
        }
        // ==================== 通用小工具 ====================
        openNote(path) {
          const app = getApp();
          const file = app.vault.getAbstractFileByPath(path);
          if (file) {
            void app.workspace.getLeaf(false).openFile(file);
            this.hideMain();
            this.hideVideo();
            this.hideHistory();
          } else {
            notice("文献笔记不存在：" + path, "error");
          }
        }
        async copyText(text) {
          try {
            await navigator.clipboard.writeText(text);
            notice("已复制：" + text, "success");
          } catch (e) {
            notice("复制失败", "error");
          }
        }
        _openExternal(url) {
          const app = getApp();
          try {
            app.openUrl(url);
          } catch (e) {
            const w = window;
            const electron = w.require && w.require("electron");
            if (electron && electron.shell) electron.shell.openExternal(url);
          }
        }
        destroy() {
          var _a;
          this.clearRunTimer();
          this.runState.clear();
          if (this.termSrcTimer) {
            clearTimeout(this.termSrcTimer);
            this.termSrcTimer = null;
          }
          this.addUrlReset();
          try {
            (_a = this.termSrcSuggest) == null ? void 0 : _a.detach();
          } catch (e) {
          }
          this.termSrcSuggest = null;
          if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
          }
          for (const unsub of this.fileListenerRefs) {
            try {
              unsub();
            } catch (e) {
            }
          }
          this.fileListenerRefs = [];
          this.fileListenerAttached = false;
          document.removeEventListener("keydown", this.onKeydown);
          this.termPreview = null;
          for (const el of [this.mask, this.popup, this.videoMask, this.videoPopup, this.addMask, this.addPopup, this.historyMask, this.historyPopup, this.termMask, this.termPopup]) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          }
          this.mask = null;
          this.popup = null;
          this.contentEl = null;
          this.videoMask = null;
          this.videoPopup = null;
          this.videoList = null;
          this.addMask = null;
          this.addPopup = null;
          this.historyMask = null;
          this.historyPopup = null;
          this.historyList = null;
          this.termMask = null;
          this.termPopup = null;
        }
      };
    }
  });

  // src/knowledge/index.ts
  var knowledge_exports = {};
  __export(knowledge_exports, {
    ensureKnowledge: () => ensureKnowledge,
    openKnowledgeAddTask: () => openKnowledgeAddTask,
    openKnowledgePanel: () => openKnowledgePanel,
    openTermNote: () => openTermNote,
    unloadKnowledge: () => unloadKnowledge
  });
  function ensureKnowledge(app) {
    var _a;
    if (initialized) return;
    try {
      KnowledgeData.init({ storagePath: (_a = tryGetSettings()) == null ? void 0 : _a.storagePath });
      uiManager = new UIManager(app);
      initialized = true;
    } catch (e) {
      console.error("bz: 文献盒初始化失败（下次打开命令将自动重试）", e);
      uiManager = null;
    }
  }
  function openKnowledgePanel(app) {
    ensureKnowledge(app);
    uiManager == null ? void 0 : uiManager.showMain();
  }
  function openKnowledgeAddTask(app, prefill) {
    ensureKnowledge(app);
    uiManager == null ? void 0 : uiManager.showVideoEntry(prefill);
  }
  function openTermNote(app, term) {
    var _a, _b;
    ensureKnowledge(app);
    let t = term == null ? void 0 : term.trim();
    let src;
    if (!t) {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      t = ((_b = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.getSelection()) == null ? void 0 : _b.trim()) || void 0;
      const file = view == null ? void 0 : view.file;
      if (file && file.extension === "md") src = { kind: "note", path: file.path };
    }
    uiManager == null ? void 0 : uiManager.showTermEntry(t, src);
  }
  function unloadKnowledge() {
    uiManager == null ? void 0 : uiManager.destroy();
    uiManager = null;
    initialized = false;
  }
  var initialized, uiManager;
  var init_knowledge = __esm({
    "src/knowledge/index.ts"() {
      init_fake_obsidian();
      init_settings_provider();
      init_data2();
      init_ui();
      initialized = false;
      uiManager = null;
    }
  });

  // src/clipbook/flow.ts
  function setReadingSession(key) {
    if (key !== curKey) {
      curKey = key;
      accumMs = 0;
      openedAt = Date.now();
    } else if (!openedAt) {
      openedAt = Date.now();
    }
  }
  function pauseReadingSession() {
    if (openedAt) {
      accumMs += Date.now() - openedAt;
      openedAt = 0;
    }
  }
  function durationMin() {
    const now = Date.now();
    const total = (openedAt ? now - openedAt : 0) + accumMs;
    return Math.max(1, Math.round(total / 6e4));
  }
  function markHandledAndBump(raw, action) {
    const key = articleKeyOf(raw);
    const platform = raw.platform || "未知";
    const today = localDayKey2();
    return enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      let touched = false;
      let changed = false;
      const list = (res.data.articles || []).map((a) => {
        if (articleKeyOf(a) !== key) return a;
        touched = true;
        if (a.read === true) return a;
        changed = true;
        return { ...a, read: true, state: action };
      });
      if (!touched || !changed) return;
      const s = res.data.stats || { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
      s.totalRead = (Number(s.totalRead) || 0) + 1;
      if (action === "saved") s.totalSaved = (Number(s.totalSaved) || 0) + 1;
      else s.totalSkipped = (Number(s.totalSkipped) || 0) + 1;
      s.byPlatform[platform] = (s.byPlatform[platform] || 0) + 1;
      s.byDate[today] = (s.byDate[today] || 0) + 1;
      await writeNewsDataMerged({ set: { articles: list, stats: s } });
    });
  }
  function removeArticle(raw) {
    const key = articleKeyOf(raw);
    return enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      const list = (res.data.articles || []).filter((a) => articleKeyOf(a) !== key);
      await writeNewsDataMerged({ set: { articles: list }, removeArticleKeys: [key] });
    });
  }
  function emitReadEvt(raw, state) {
    const evt = { title: raw.title, platform: raw.platform, state, durationMin: durationMin() };
    emitDomainEvent("news", { kind: "read", evt });
    return evt;
  }
  async function flowSave(article) {
    const raw = article && article.raw;
    if (!raw) return false;
    const isBili = raw.platform === "B站" && !!String(raw.url || "").trim();
    if (isBili) {
      const { openKnowledgeAddTask: openKnowledgeAddTask2 } = await Promise.resolve().then(() => (init_knowledge(), knowledge_exports));
      openKnowledgeAddTask2(getApp(), { url: raw.url, title: raw.title || null, uploader: raw.author || null });
      await markHandledAndBump(raw, "saved");
      notice("已转入文献盒", "success");
      return true;
    }
    pauseReadingSession();
    try {
      const ok = await writeClipNote(raw);
      if (!ok) return false;
      await markHandledAndBump(raw, "saved");
      const evt = emitReadEvt(raw, "saved");
      emitDomainEvent("news", { kind: "saved", evt, clipPath: `${dirOf()}/${String(raw.title || "").replace(/[\\/:*?"<>|]/g, "").trim()}.md` });
      return true;
    } catch (e) {
      console.error("[剪藏本] 保存失败", e);
      return false;
    }
  }
  async function flowMarkRead(article) {
    const raw = article && article.raw;
    if (!raw) return;
    pauseReadingSession();
    await markHandledAndBump(raw, "skipped");
    emitReadEvt(raw, "skipped");
  }
  async function flowDeleteNews(article) {
    const raw = article && article.raw;
    if (!raw) return;
    await removeArticle(raw);
    try {
      await updateClipbookData((sidecar) => {
        const overrides = { ...sidecar.articleOverrides };
        delete overrides[articleKeyOf(raw)];
        return { ...sidecar, articleOverrides: overrides };
      });
    } catch (e) {
    }
  }
  async function flowMarkAllRead(raws) {
    const keys = new Set(raws.filter(Boolean).map((r) => articleKeyOf(r)));
    if (!keys.size) return;
    pauseReadingSession();
    await enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      const today = localDayKey2();
      const s = res.data.stats || { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
      let bumped = 0;
      const list = (res.data.articles || []).map((a) => {
        if (a.read === true || !keys.has(articleKeyOf(a))) return a;
        bumped++;
        const next = { ...a, read: true, state: "skipped" };
        const platform = a.platform || "未知";
        s.byPlatform[platform] = (Number(s.byPlatform[platform]) || 0) + 1;
        s.byDate[today] = (Number(s.byDate[today]) || 0) + 1;
        return next;
      });
      if (!bumped) return;
      s.totalRead = (Number(s.totalRead) || 0) + bumped;
      s.totalSkipped = (Number(s.totalSkipped) || 0) + bumped;
      await writeNewsDataMerged({ set: { articles: list, stats: s } });
    });
  }
  async function flowUndoHandled(rawBefore) {
    if (!rawBefore) return;
    const key = articleKeyOf(rawBefore);
    await enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      const s = res.data.stats;
      let touched = false;
      const list = (res.data.articles || []).map((a) => {
        if (articleKeyOf(a) !== key) return a;
        touched = true;
        if (s && a.read === true) {
          s.totalRead = Math.max(0, (Number(s.totalRead) || 0) - 1);
          if (a.state === "saved") s.totalSaved = Math.max(0, (Number(s.totalSaved) || 0) - 1);
          else s.totalSkipped = Math.max(0, (Number(s.totalSkipped) || 0) - 1);
          const platform = a.platform || "未知";
          s.byPlatform[platform] = Math.max(0, (Number(s.byPlatform[platform]) || 0) - 1);
          const day = localDayKey2();
          s.byDate[day] = Math.max(0, (Number(s.byDate[day]) || 0) - 1);
        }
        const restored = { ...a };
        if (rawBefore.read === void 0) delete restored.read;
        else restored.read = rawBefore.read;
        if (rawBefore.state === void 0) delete restored.state;
        else restored.state = rawBefore.state;
        if (rawBefore.body === void 0) delete restored.body;
        else restored.body = rawBefore.body;
        return restored;
      });
      if (!touched) return;
      await writeNewsDataMerged({ set: s ? { articles: list, stats: s } : { articles: list } });
    });
  }
  async function flowUndoDeleteNews(rawBefore) {
    if (!rawBefore) return;
    await enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      const list = res.data.articles || [];
      if (list.some((a) => articleKeyOf(a) === articleKeyOf(rawBefore))) return;
      await writeNewsDataMerged({ set: { articles: [...list, rawBefore] } });
    });
  }
  function dirOf() {
    const s = tryGetSettings();
    return (s && s.articleDirectory || "归档/网页剪藏").replace(/\/+$/, "");
  }
  var curKey, openedAt, accumMs;
  var init_flow = __esm({
    "src/clipbook/flow.ts"() {
      init_app();
      init_notice();
      init_domain_bus();
      init_settings_provider();
      init_news_data();
      init_constants();
      init_save();
      init_constants();
      init_data();
      init_write_queue();
      curKey = "";
      openedAt = 0;
      accumMs = 0;
    }
  });

  // src/core/ui/icon.ts
  function uiIcon(name, extraClass = "") {
    const i = document.createElement("span");
    i.className = "bz-ic" + (extraClass ? " " + extraClass : "");
    setIcon(i, name);
    return i;
  }
  var init_icon = __esm({
    "src/core/ui/icon.ts"() {
      init_fake_obsidian();
    }
  });

  // src/core/ui/icons.ts
  function uiIconSpan(name, extraClass = "") {
    const i = document.createElement("span");
    i.className = "bz-ic" + (extraClass ? " " + extraClass : "");
    setIcon(i, name);
    return i;
  }
  function mountIcons(root) {
    root.querySelectorAll("[data-lucide]").forEach((el) => {
      const name = el.getAttribute("data-lucide") || "";
      if (!name) return;
      try {
        const fresh = uiIconSpan(name);
        const cls = el.className;
        if (cls && cls !== "bz-ic") fresh.className = cls;
        el.replaceWith(fresh);
      } catch (e) {
      }
    });
  }
  var init_icons = __esm({
    "src/core/ui/icons.ts"() {
      init_fake_obsidian();
    }
  });

  // src/core/ui/button.ts
  var init_button = __esm({
    "src/core/ui/button.ts"() {
      init_icon();
    }
  });

  // src/core/ui/chip.ts
  var init_chip = __esm({
    "src/core/ui/chip.ts"() {
      init_icon();
    }
  });

  // src/core/ui/field.ts
  var init_field = __esm({
    "src/core/ui/field.ts"() {
    }
  });

  // src/core/ui/slider.ts
  var init_slider = __esm({
    "src/core/ui/slider.ts"() {
    }
  });

  // src/core/ui/empty.ts
  function uiEmpty(opts) {
    const el = document.createElement("div");
    el.className = "bz-empty";
    if (opts.icon) {
      const ic = uiIcon(opts.icon);
      ic.classList.add("bz-empty-ic");
      el.appendChild(ic);
    }
    const t = document.createElement("div");
    t.className = "bz-empty-title";
    t.textContent = opts.title;
    el.appendChild(t);
    if (opts.desc) {
      const d = document.createElement("div");
      d.className = "bz-empty-desc";
      d.textContent = opts.desc;
      el.appendChild(d);
    }
    if (opts.actions) el.appendChild(opts.actions);
    return el;
  }
  var init_empty = __esm({
    "src/core/ui/empty.ts"() {
      init_icon();
    }
  });

  // src/core/ui/segmented.ts
  var init_segmented = __esm({
    "src/core/ui/segmented.ts"() {
    }
  });

  // src/core/ui/choice.ts
  var init_choice = __esm({
    "src/core/ui/choice.ts"() {
    }
  });

  // src/core/ui/cardpick.ts
  function uiCardChoice(opts) {
    const el = document.createElement("div");
    el.className = "bz-cardpick" + (opts.className ? " " + opts.className : "");
    el.setAttribute("role", "radiogroup");
    if (opts.label) el.setAttribute("aria-label", opts.label);
    const btns = /* @__PURE__ */ new Map();
    let cur = opts.value;
    const sync = (v) => {
      cur = v;
      btns.forEach((b, val) => {
        const on = val === v;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(on));
      });
    };
    opts.options.forEach((o) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "bz-cardpick-card" + (o.value === opts.value ? " is-on" : "");
      card.dataset.value = String(o.value);
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(o.value === opts.value));
      const prev = document.createElement("div");
      prev.className = "bz-cardpick-prev" + (o.prevClass ? ` ${o.prevClass}` : "");
      prev.setAttribute("aria-hidden", "true");
      prev.style.height = "62px";
      const name = document.createElement("span");
      name.className = "bz-cardpick-name";
      name.textContent = o.label;
      card.append(prev, name);
      card.addEventListener("click", () => {
        if (cur === o.value) return;
        sync(o.value);
        opts.onChange(o.value);
      });
      btns.set(o.value, card);
      el.appendChild(card);
    });
    el.addEventListener("keydown", (e) => {
      var _a;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const list = opts.options.map((o) => o.value);
      const idx = list.indexOf(cur);
      const next = e.key === "ArrowRight" ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
      (_a = btns.get(list[next])) == null ? void 0 : _a.focus();
      e.preventDefault();
    });
    return { el, setValue: sync };
  }
  var init_cardpick = __esm({
    "src/core/ui/cardpick.ts"() {
    }
  });

  // src/core/ui/switch.ts
  var init_switch = __esm({
    "src/core/ui/switch.ts"() {
    }
  });

  // src/core/ui/select.ts
  var init_select = __esm({
    "src/core/ui/select.ts"() {
      init_icon();
      init_esc_manager();
    }
  });

  // src/core/ui/search.ts
  var init_search = __esm({
    "src/core/ui/search.ts"() {
      init_icon();
      init_field();
    }
  });

  // src/core/ui/mainhead.ts
  var init_mainhead = __esm({
    "src/core/ui/mainhead.ts"() {
      init_button();
    }
  });

  // src/core/ui/rail.ts
  var init_rail = __esm({
    "src/core/ui/rail.ts"() {
      init_fake_obsidian();
      init_icon();
    }
  });

  // src/core/ui/mobstrip.ts
  var init_mobstrip = __esm({
    "src/core/ui/mobstrip.ts"() {
    }
  });

  // src/core/ui/stat.ts
  var init_stat = __esm({
    "src/core/ui/stat.ts"() {
      init_icon();
    }
  });

  // src/core/ui/progress.ts
  var init_progress = __esm({
    "src/core/ui/progress.ts"() {
    }
  });

  // src/core/ui/popover.ts
  var init_popover = __esm({
    "src/core/ui/popover.ts"() {
      init_icon();
      init_esc_manager();
    }
  });

  // src/core/ui/lightbox.ts
  var init_lightbox = __esm({
    "src/core/ui/lightbox.ts"() {
      init_icon();
      init_esc_manager();
      init_z_order();
    }
  });

  // src/core/ui/modal.ts
  var init_modal = __esm({
    "src/core/ui/modal.ts"() {
      init_esc_manager();
      init_z_order();
    }
  });

  // src/core/ui/resize.ts
  function hitRegion(rect, x, y, edge) {
    const onE = x >= rect.width - edge;
    const onS = y >= rect.height - edge;
    const onW = x <= edge;
    const onN = y <= edge;
    if (onE && onS) return "se";
    if (onE && !onW) return "e";
    if (onS && !onN) return "s";
    return null;
  }
  function uiResizable(el, opts = {}) {
    var _a, _b, _c, _d, _e;
    const isCoarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (isCoarse) {
      return { flush: () => {
      }, detach: () => {
      } };
    }
    const edge = (_a = opts.edge) != null ? _a : 8;
    const minW = (_b = opts.minW) != null ? _b : 320;
    const minH = (_c = opts.minH) != null ? _c : 240;
    const maxW = (_d = opts.maxW) != null ? _d : Number.POSITIVE_INFINITY;
    const maxH = (_e = opts.maxH) != null ? _e : Number.POSITIVE_INFINITY;
    let dir = null;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    const cap = (isW) => {
      const view = (isW ? window.innerWidth : window.innerHeight) * 0.92;
      return Math.floor(Math.min(isW ? maxW : maxH, view));
    };
    const persist = opts.persist;
    let persistTimer = null;
    let lastW = 0;
    let lastH = 0;
    if (persist == null ? void 0 : persist.load) {
      const saved = persist.load();
      if (saved && saved.w > 0 && saved.h > 0) {
        lastW = Math.min(Math.max(saved.w, minW), cap(true));
        lastH = Math.min(Math.max(saved.h, minH), cap(false));
        el.style.width = lastW + "px";
        el.style.height = lastH + "px";
      }
    }
    const regionAt = (e) => {
      const rect = el.getBoundingClientRect();
      return hitRegion(rect, e.clientX - rect.left, e.clientY - rect.top, edge);
    };
    const setCursor = (d) => {
      el.style.cursor = d === "e" ? "ew-resize" : d === "s" ? "ns-resize" : d === "se" ? "nwse-resize" : "";
    };
    const onHover = (e) => {
      if (dragging) return;
      setCursor(regionAt(e));
    };
    const onDragMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let w = dir === "e" || dir === "se" ? startW + dx : startW;
      let h = dir === "s" || dir === "se" ? startH + dy : startH;
      w = Math.min(Math.max(w, minW), cap(true));
      h = Math.min(Math.max(h, minH), cap(false));
      el.style.width = w + "px";
      el.style.height = h + "px";
      if (opts.onChange) opts.onChange(w, h);
      if (persist == null ? void 0 : persist.save) {
        lastW = w;
        lastH = h;
        if (persistTimer !== null) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
          var _a2;
          persistTimer = null;
          (_a2 = persist.save) == null ? void 0 : _a2.call(persist, w, h);
        }, 300);
      }
    };
    const onMouseLeave = () => {
      if (!dragging) setCursor(null);
    };
    const onMouseDown = (e) => {
      const d = regionAt(e);
      if (!d) return;
      e.preventDefault();
      dir = d;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = el.getBoundingClientRect().width;
      startH = el.getBoundingClientRect().height;
      document.body.style.userSelect = "none";
    };
    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      dir = null;
      document.body.style.userSelect = "";
      setCursor(null);
      swallowNextClick();
    };
    el.addEventListener("mousemove", onHover);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onMouseUp);
    const flush = () => {
      if (persistTimer === null) return;
      clearTimeout(persistTimer);
      persistTimer = null;
      if ((persist == null ? void 0 : persist.save) && lastW > 0 && lastH > 0) persist.save(lastW, lastH);
    };
    return {
      flush,
      detach: () => {
        flush();
        el.removeEventListener("mousemove", onHover);
        el.removeEventListener("mouseleave", onMouseLeave);
        el.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.userSelect = "";
        setCursor(null);
      }
    };
  }
  var init_resize = __esm({
    "src/core/ui/resize.ts"() {
      init_dom();
    }
  });

  // src/core/ui/splitter.ts
  function uiVSplitter(opts) {
    var _a, _b;
    const left = opts.left;
    const minLeft = (_a = opts.minLeft) != null ? _a : 220;
    const minRight = (_b = opts.minRight) != null ? _b : 320;
    const persist = opts.persist;
    const el = document.createElement("div");
    el.className = "bz-vsplit";
    el.setAttribute("role", "separator");
    el.setAttribute("aria-orientation", "vertical");
    el.title = "拖动调整两侧宽度";
    const isCoarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (isCoarse) {
      return { el, restore: () => {
      }, flush: () => {
      }, detach: () => {
      } };
    }
    let dragging = false;
    let startX = 0;
    let startW = 0;
    let persistTimer = null;
    let lastW = 0;
    let restored = false;
    const availW = () => {
      const parent = left.parentElement;
      if (!parent) return 0;
      return parent.clientWidth - el.offsetWidth;
    };
    const clampW = (w) => {
      const avail = availW();
      const max = avail > 0 ? avail - minRight : Number.POSITIVE_INFINITY;
      return Math.min(Math.max(w, minLeft), Math.max(minLeft, max));
    };
    const applyW = (w) => {
      left.style.width = w + "px";
    };
    const debSave = (w) => {
      if (!(persist == null ? void 0 : persist.save)) return;
      lastW = w;
      if (persistTimer !== null) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        var _a2;
        persistTimer = null;
        (_a2 = persist.save) == null ? void 0 : _a2.call(persist, w);
      }, 300);
    };
    const restore = () => {
      if (restored || !(persist == null ? void 0 : persist.load) || !el.isConnected) return;
      if (availW() <= 0) return;
      const saved = persist.load();
      restored = true;
      if (saved != null && saved > 0) {
        const w = clampW(saved);
        applyW(w);
        lastW = w;
      }
    };
    const onDragMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const w = clampW(startW + (e.clientX - startX));
      if (w === lastW) return;
      applyW(w);
      lastW = w;
      if (opts.onChange) opts.onChange(w);
      debSave(w);
    };
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = left.getBoundingClientRect().width;
      el.classList.add("is-drag");
      document.body.style.userSelect = "none";
    };
    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-drag");
      document.body.style.userSelect = "";
      swallowNextClick();
    };
    document.addEventListener("mousemove", onDragMove);
    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    const flush = () => {
      if (persistTimer === null) return;
      clearTimeout(persistTimer);
      persistTimer = null;
      if ((persist == null ? void 0 : persist.save) && lastW > 0) persist.save(lastW);
    };
    return {
      el,
      restore,
      flush,
      detach: () => {
        flush();
        document.removeEventListener("mousemove", onDragMove);
        el.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.userSelect = "";
        el.classList.remove("is-drag");
      }
    };
  }
  var init_splitter = __esm({
    "src/core/ui/splitter.ts"() {
      init_dom();
    }
  });

  // src/core/ui/index.ts
  var init_ui2 = __esm({
    "src/core/ui/index.ts"() {
      init_icon();
      init_icons();
      init_button();
      init_chip();
      init_field();
      init_slider();
      init_empty();
      init_segmented();
      init_choice();
      init_cardpick();
      init_switch();
      init_select();
      init_search();
      init_mainhead();
      init_rail();
      init_mobstrip();
      init_stat();
      init_progress();
      init_popover();
      init_suggest();
      init_lightbox();
      init_modal();
      init_resize();
      init_splitter();
    }
  });

  // src/core/path-picker.ts
  function isExcludedPath(p) {
    if (!p) return false;
    for (const seg of p.split("/")) {
      if (EXCLUDED_DIR_NAMES.has(seg)) return true;
    }
    return false;
  }
  function foldersFromFiles(paths) {
    const out = /* @__PURE__ */ new Set([""]);
    for (const p of paths) {
      if (isExcludedPath(p)) continue;
      const sep = p.lastIndexOf("/");
      if (sep === -1) continue;
      let dir = p.slice(0, sep);
      while (dir) {
        if (!isExcludedPath(dir)) out.add(dir);
        const i = dir.lastIndexOf("/");
        dir = i === -1 ? "" : dir.slice(0, i);
      }
    }
    return [...out].sort();
  }
  async function collectVaultFolders(app) {
    var _a, _b, _c, _d;
    const out = /* @__PURE__ */ new Set([""]);
    try {
      const files = ((_c = (_b = (_a = app == null ? void 0 : app.vault) == null ? void 0 : _a.getFiles) == null ? void 0 : _b.call(_a)) != null ? _c : []).map((f) => f.path);
      for (const p of foldersFromFiles(files)) out.add(p);
    } catch (e) {
    }
    const adapter = (_d = app == null ? void 0 : app.vault) == null ? void 0 : _d.adapter;
    if (adapter && typeof adapter.list === "function") {
      const walk = async (dir, depth) => {
        var _a2;
        if (depth > 40) return;
        let listed = null;
        try {
          listed = await adapter.list(dir);
        } catch (e) {
          if (dir === "") {
            try {
              listed = await adapter.list("/");
            } catch (e2) {
              return;
            }
          } else {
            return;
          }
        }
        for (const f of (_a2 = listed == null ? void 0 : listed.folders) != null ? _a2 : []) {
          const p = String(f).replace(/^\/+|\/+$/g, "");
          if (!p) continue;
          if (isExcludedPath(p)) continue;
          if (!out.has(p)) out.add(p);
          await walk(p, depth + 1);
        }
      };
      try {
        await walk("", 0);
      } catch (e) {
      }
    }
    return [...out].sort();
  }
  function normalizePicked(list) {
    const out = [];
    for (const item of list) {
      const raw = String(item);
      if (raw === "") {
        if (!out.includes("")) out.push("");
        continue;
      }
      const trimmed = raw.trim();
      if (trimmed === "") continue;
      const p = trimmed.replace(/^\/+|\/+$/g, "");
      if (p === "") {
        if (!out.includes("")) out.push("");
        continue;
      }
      if (!out.includes(p)) out.push(p);
    }
    return out;
  }
  function renderPathChips(container, selected, onChange, emptyText = "未选择", onChipClick) {
    container.innerHTML = "";
    container.classList.add("bz-path-picker-chips");
    if (selected.length === 0) {
      if (!emptyText) return;
      const empty = document.createElement("span");
      empty.className = "bz-path-picker-chips-empty";
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    for (const path of selected) {
      const label = path === "" ? "（库根目录）" : path;
      const chip = document.createElement("span");
      chip.className = "bz-path-picker-chip" + (onChipClick ? " bz-path-picker-chip--click" : "");
      chip.title = label;
      const name = document.createElement("span");
      name.className = "bz-path-picker-chip-name";
      name.textContent = label;
      if (onChipClick) name.onclick = () => onChipClick(path);
      const x = document.createElement("button");
      x.className = "bz-path-picker-chip-x";
      x.textContent = "✕";
      x.setAttribute("aria-label", `移除 ${label}`);
      x.onclick = () => onChange(selected.filter((p) => p !== path));
      chip.appendChild(name);
      chip.appendChild(x);
      container.appendChild(chip);
    }
  }
  function renderPathSettingRow(opts) {
    const readValue = () => {
      const v = opts.value;
      return Array.isArray(v) ? [...v] : v ? [v] : [];
    };
    let current = readValue();
    const setting = new Setting(opts.parent).setName(opts.name);
    if (opts.desc) setting.setDesc(opts.desc);
    setting.settingEl.classList.add("bz-path-picker-setting-row");
    const chipsWrap = document.createElement("div");
    chipsWrap.className = "bz-path-picker-chips--setting";
    const apply = (list) => {
      const res = opts.onChange(list);
      if (res && typeof res.then === "function") {
        return Promise.resolve(res).then((final) => {
          current = Array.isArray(final) ? final : list;
          renderAll2();
        });
      }
      current = Array.isArray(res) ? res : list;
      renderAll2();
    };
    const openPicker = () => openPathPicker({
      title: opts.pickerTitle || opts.name,
      desc: opts.pickerDesc,
      mode: opts.mode,
      selected: current,
      okText: opts.okText,
      onConfirm: (list) => {
        void apply(list);
      }
    });
    const render = () => renderPathChips(chipsWrap, current, (next) => {
      void apply(next);
    }, "", openPicker);
    let btn = null;
    setting.addButton((b) => {
      b.setButtonText(opts.buttonText || (opts.mode === "multi" ? "添加…" : "选择…")).onClick(openPicker);
      b.buttonEl.classList.add("bz-path-picker-btn--slim");
      btn = b.buttonEl;
    });
    const control = setting.settingEl.querySelector(".setting-item-control");
    if (control) control.appendChild(chipsWrap);
    const syncBtn = () => {
      setting.settingEl.dataset.filled = current.length > 0 ? "1" : "0";
      if (!btn || !control) return;
      if (current.length === 0) {
        if (!btn.isConnected) control.appendChild(btn);
      } else if (btn.isConnected) {
        btn.remove();
      }
    };
    const renderAll2 = () => {
      syncBtn();
      render();
    };
    const refresh = () => {
      current = readValue();
      renderAll2();
    };
    renderAll2();
    return { refresh, settingEl: setting.settingEl };
  }
  function closePathPicker() {
    if (currentMask) {
      currentMask.remove();
      currentMask = null;
    }
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
    if (currentHandle) {
      currentHandle.unregister();
      currentHandle = null;
    }
    if (focusTimer !== null) {
      window.clearTimeout(focusTimer);
      focusTimer = null;
    }
  }
  function openPathPicker(opts) {
    var _a, _b, _c;
    closePathPicker();
    const app = getApp();
    const mode = opts.mode || "single";
    const selected = new Set(normalizePicked(opts.selected || []));
    const pinnedAtOpen = [...selected];
    const { mask, popup } = createOverlay({
      maskId: "bz-path-picker-mask",
      popupId: "bz-path-picker-popup",
      // ticket 133：桌面/移动端统一一张居中卡——左右各 16px 外边距，宽视口封顶 440px（不分两套样式）
      width: "min(calc(100vw - 32px), 440px)",
      maxWidth: 440,
      onMaskClick: () => closePathPicker()
    });
    currentMask = mask;
    currentPopup = popup;
    popup.classList.add("bz-path-picker");
    popup.style.height = "min(560px, 82vh)";
    const head = document.createElement("div");
    head.className = "bz-path-picker-head";
    const title = document.createElement("h3");
    title.className = "bz-path-picker-title";
    title.textContent = opts.title || "选择文件夹";
    head.appendChild(title);
    if (opts.desc) {
      const desc = document.createElement("div");
      desc.className = "bz-path-picker-desc";
      desc.textContent = opts.desc;
      head.appendChild(desc);
    }
    const search = document.createElement("input");
    search.type = "text";
    search.className = "bz-path-picker-search";
    search.placeholder = "搜索目录…";
    search.spellcheck = false;
    search.setAttribute("aria-label", "搜索目录");
    const listEl2 = document.createElement("div");
    listEl2.className = "bz-path-picker-list";
    const state = { folders: [], q: "" };
    const foot = document.createElement("div");
    foot.className = "bz-path-picker-foot";
    const selinfo = document.createElement("span");
    selinfo.className = "bz-path-picker-selinfo";
    const btns = document.createElement("div");
    btns.className = "bz-path-picker-foot-btns";
    foot.appendChild(selinfo);
    foot.appendChild(btns);
    const mkBtn = (label, primary, onclick) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = "bz-path-picker-btn" + (primary ? " bz-path-picker-btn--primary" : "");
      b.onclick = onclick;
      btns.appendChild(b);
      return b;
    };
    if (mode === "multi") mkBtn("清空", false, () => {
      selected.clear();
      renderList2();
      updateSel();
    });
    mkBtn(opts.okText || "下一步", true, () => {
      const list = normalizePicked([...selected]);
      closePathPicker();
      opts.onConfirm(list);
    });
    function orderedList() {
      const pinned = [];
      const rest = [];
      const pinSet = new Set(pinnedAtOpen);
      for (const f of state.folders) {
        if (pinSet.has(f)) pinned.push(f);
        else rest.push(f);
      }
      const rootIdx = rest.indexOf("");
      const root = rootIdx >= 0 ? rest.splice(rootIdx, 1)[0] : null;
      rest.reverse();
      return [...pinned, ...root === null ? [] : [root], ...rest];
    }
    function renderList2() {
      listEl2.innerHTML = "";
      const q2 = state.q.trim().toLowerCase();
      const exact = !!q2 && state.folders.includes(q2);
      const LIMIT = 300;
      let n = 0;
      let total = 0;
      for (const folder of orderedList()) {
        if (q2 && !exact && !folder.toLowerCase().includes(q2)) continue;
        total++;
        if (n >= LIMIT) continue;
        n++;
        const on = selected.has(folder);
        const row = document.createElement("div");
        row.className = "bz-path-picker-row" + (on ? " bz-path-picker-row--sel" : "");
        row.dataset.path = folder;
        row.setAttribute("role", mode === "multi" ? "checkbox" : "option");
        row.setAttribute("aria-checked", on ? "true" : "false");
        const box = document.createElement("span");
        box.className = "bz-path-picker-check";
        box.textContent = on ? "✓" : "";
        const name = document.createElement("span");
        name.className = "bz-path-picker-name";
        name.textContent = folder === "" ? "（库根目录）" : folder;
        name.title = folder === "" ? "（库根目录）" : folder;
        row.appendChild(box);
        row.appendChild(name);
        row.onclick = () => {
          if (mode === "single") {
            selected.clear();
            selected.add(folder);
          } else if (selected.has(folder)) {
            selected.delete(folder);
          } else {
            selected.add(folder);
          }
          renderList2();
          updateSel();
        };
        listEl2.appendChild(row);
      }
      if (!total) {
        const empty = document.createElement("div");
        empty.className = "bz-path-picker-empty";
        empty.textContent = "没有匹配的目录";
        listEl2.appendChild(empty);
      } else if (total > LIMIT) {
        const more = document.createElement("div");
        more.className = "bz-path-picker-empty";
        more.textContent = `已显示前 ${LIMIT} 个（共 ${total} 个匹配目录），请输入关键词缩小范围`;
        listEl2.appendChild(more);
      }
    }
    function updateSel() {
      if (mode === "single") {
        const first = [...selected][0];
        selinfo.textContent = first === void 0 ? "未选择" : first === "" ? "已选（库根目录）" : `已选 ${first}`;
      } else {
        selinfo.textContent = `已选 ${selected.size} 项`;
      }
    }
    search.oninput = () => {
      state.q = search.value;
      renderList2();
    };
    try {
      const files = ((_c = (_b = (_a = app == null ? void 0 : app.vault) == null ? void 0 : _a.getFiles) == null ? void 0 : _b.call(_a)) != null ? _c : []).map((f) => f.path);
      state.folders = foldersFromFiles(files);
    } catch (e) {
    }
    void collectVaultFolders(app).then((folders) => {
      if (!mask.isConnected) return;
      state.folders = folders;
      popup.dataset.ready = "1";
      renderList2();
    });
    renderList2();
    updateSel();
    popup.append(head, search, listEl2, foot);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = "block";
    popup.style.display = "flex";
    currentHandle = escManager.register("bz-path-picker", {
      isVisible: () => !!currentMask,
      close: () => closePathPicker()
    });
    focusTimer = window.setTimeout(() => {
      focusTimer = null;
      if (mask.isConnected) search.focus();
    }, 30);
  }
  var EXCLUDED_DIR_NAMES, currentMask, currentPopup, currentHandle, focusTimer;
  var init_path_picker = __esm({
    "src/core/path-picker.ts"() {
      init_fake_obsidian();
      init_app();
      init_dom();
      init_esc_manager();
      EXCLUDED_DIR_NAMES = /* @__PURE__ */ new Set([".obsidian", ".trash", "node_modules", ".git"]);
      currentMask = null;
      currentPopup = null;
      currentHandle = null;
      focusTimer = null;
    }
  });

  // src/core/settings-schema.ts
  function bindValue(binding) {
    if ("key" in binding) {
      const key = binding.key;
      return {
        read: () => getSettings()[key],
        write: (v) => {
          getSettings()[key] = v;
        },
        persist: () => saveSettings()
      };
    }
    return { read: () => binding.get(), write: (v) => binding.set(v), persist: () => binding.save() };
  }
  function currentSnapshot() {
    return tryGetSettings();
  }
  function parseClampedNumber(raw, min, max) {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    let out = n;
    if (min !== void 0) out = Math.max(min, out);
    if (max !== void 0) out = Math.min(max, out);
    return out;
  }
  function renderSettingsInto(container, schema) {
    var _a;
    const entries = [];
    const customRefreshes = [];
    const reevaluate = () => {
      const snap = currentSnapshot();
      for (const e of entries) {
        e.el.classList.toggle("bz-setting-hidden", e.visibleWhen ? !e.visibleWhen(snap) : false);
      }
      for (const fn of customRefreshes) {
        try {
          fn();
        } catch (e) {
        }
      }
      refreshSettingsGroupCounts(container);
      markSettingSplitRows(container);
    };
    const newRowSetting = (body, row) => {
      const setting = new Setting(body).setName(row.name);
      if (row.desc) setting.setDesc(row.desc);
      if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
      return setting;
    };
    const renderTextualRow = (body, row) => {
      var _a2;
      const ctx = { rowEl: body, refreshVisibility: reevaluate };
      const setting = newRowSetting(body, row);
      const isNumber = row.type === "number";
      const acc = isNumber ? bindValue(row.binding) : bindValue(row.binding);
      const changeCb = row.onChange;
      const initial = String((_a2 = acc.read()) != null ? _a2 : "");
      let pending = null;
      let last = initial;
      let dirty2 = false;
      const warn = new CommitWarn(initial, row.onCommit);
      const commit = () => {
        if (pending !== null) {
          clearTimeout(pending);
          pending = null;
        }
        if (!dirty2) return;
        void acc.persist();
        warn.fire(last);
        reevaluate();
      };
      let currentText = null;
      const addInto = (t) => {
        currentText = t;
        t.setValue(initial);
        const place = (snap) => typeof row.placeholder === "function" ? row.placeholder(snap) : row.placeholder;
        const applyPlaceholder = () => {
          if (t.setPlaceholder) {
            const p = place(currentSnapshot());
            if (p !== void 0) t.setPlaceholder(p);
          }
        };
        applyPlaceholder();
        t.onChange((v) => {
          dirty2 = true;
          if (isNumber) {
            const n = parseClampedNumber(v, row.min, row.max);
            if (n === null) return;
            acc.write(n);
          } else {
            acc.write(v);
          }
          last = v;
          changeCb == null ? void 0 : changeCb(isNumber ? acc.read() : v, ctx);
          if (pending !== null) clearTimeout(pending);
          pending = setTimeout(commit, TEXT_COMMIT_DELAY);
        });
        const inputEl = t.inputEl;
        if (inputEl) {
          if (isNumber) {
            const num = row;
            inputEl.type = "number";
            if (num.min !== void 0) inputEl.min = String(num.min);
            if (num.max !== void 0) inputEl.max = String(num.max);
            if (num.step !== void 0) inputEl.step = String(num.step);
          }
          inputEl.addEventListener("blur", commit);
          if (row.type !== "textarea") {
            inputEl.addEventListener("keydown", (e) => {
              if (e.key === "Enter") commit();
            });
          }
        }
        if (typeof row.placeholder === "function") {
          const origReevaluate = ctx.refreshVisibility;
          ctx.refreshVisibility = () => {
            applyPlaceholder();
            origReevaluate();
          };
        }
        if (row.refreshKey !== void 0) {
          const ref = row.refreshKey;
          customRefreshes.push(() => {
            if (currentText) {
              const snap = currentSnapshot();
              const fresh = typeof ref === "function" ? ref(snap) : String(snap[ref]);
              if (currentText.setValue) {
                dirty2 = false;
                currentText.setValue(String(fresh != null ? fresh : ""));
              }
            }
          });
        }
      };
      const actions = row.actions;
      if (actions) {
        for (const a of actions) {
          setting.addButton((b) => {
            if (a.cta) b.setCta();
            b.setButtonText(a.text).onClick(() => {
              void (async () => {
                var _a3;
                await a.onClick(last, ctx);
                if (currentText && currentText.setValue) {
                  dirty2 = false;
                  currentText.setValue(String((_a3 = acc.read()) != null ? _a3 : ""));
                }
                reevaluate();
              })();
            });
          });
        }
      }
      if (row.type === "text") setting.addText(addInto);
      else if (row.type === "textarea") setting.addTextArea(addInto);
      else setting.addText(addInto);
    };
    const renderRow = (body, rowArg, parentToggleKey) => {
      var _a2, _b, _c;
      const ctx = { rowEl: body, refreshVisibility: reevaluate };
      let row = rowArg;
      if (row.isChild && parentToggleKey) {
        row = {
          ...row,
          visibleWhen: (snap) => snap[parentToggleKey] === true && (rowArg.visibleWhen ? rowArg.visibleWhen(snap) : true)
        };
      }
      switch (row.type) {
        case "custom": {
          const wrap = document.createElement("div");
          body.appendChild(wrap);
          if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
          row.render(wrap, { rowEl: wrap, refreshVisibility: reevaluate });
          if (row.onRefresh) customRefreshes.push(() => row.onRefresh({ rowEl: wrap, refreshVisibility: reevaluate }));
          return;
        }
        case "path": {
          const acc = bindValue(row.binding);
          const multi = row.mode === "multi";
          const initialRaw = acc.read();
          const initialKey = multi ? JSON.stringify(initialRaw != null ? initialRaw : []) : String(initialRaw != null ? initialRaw : "");
          const warn = new CommitWarn(initialKey, row.onCommit);
          const wrap = document.createElement("div");
          body.appendChild(wrap);
          if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
          renderPathSettingRow({
            parent: wrap,
            name: row.name,
            desc: row.desc,
            mode: row.mode,
            value: multi ? Array.isArray(initialRaw) ? [...initialRaw] : [] : String(initialRaw != null ? initialRaw : ""),
            pickerTitle: row.pickerTitle,
            pickerDesc: row.pickerDesc,
            buttonText: row.buttonText,
            okText: row.okText,
            emptyText: row.emptyText,
            onChange: (list) => {
              var _a3;
              const v = multi ? list : (list[0] || "").trim().replace(/^\/+|\/+$/g, "");
              acc.write(v);
              void acc.persist();
              const res = (_a3 = row.onChange) == null ? void 0 : _a3.call(row, list, ctx);
              warn.fire(multi ? JSON.stringify(v) : String(v));
              reevaluate();
              if (res && typeof res.then === "function") {
                return Promise.resolve(res).then(
                  (final) => Array.isArray(final) ? final : list
                );
              }
              return Array.isArray(res) ? res : void 0;
            }
          });
          return;
        }
        case "toggle": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          setting.addToggle(
            (t) => t.setValue(acc.read() === true).onChange(async (v) => {
              var _a3;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a3 = row.onChange) == null ? void 0 : _a3.call(row, v, ctx);
            })
          );
          return;
        }
        case "select": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          setting.addDropdown((dd) => {
            var _a3;
            for (const opt of row.options) dd.addOption(opt.value, opt.label);
            dd.setValue(String((_a3 = acc.read()) != null ? _a3 : "") || row.options[0].value);
            dd.onChange(async (v) => {
              var _a4;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a4 = row.onChange) == null ? void 0 : _a4.call(row, v, ctx);
            });
          });
          return;
        }
        case "choiceCards": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          const pick = uiCardChoice({
            value: String((_a2 = acc.read()) != null ? _a2 : "") || row.options[0].value,
            options: row.options,
            label: row.name,
            onChange: async (v) => {
              var _a3;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a3 = row.onChange) == null ? void 0 : _a3.call(row, v, ctx);
            }
          });
          setting.controlEl.appendChild(pick.el);
          return;
        }
        case "slider": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          setting.addSlider((sl) => {
            var _a3;
            sl.setLimits(row.min, row.max, (_a3 = row.step) != null ? _a3 : 1);
            sl.setValue(Number(acc.read()) || 0);
            sl.setDynamicTooltip();
            sl.onChange(async (v) => {
              var _a4;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a4 = row.onChange) == null ? void 0 : _a4.call(row, v, ctx);
            });
          });
          for (const a of (_b = row.actions) != null ? _b : []) {
            setting.addButton((b) => {
              if (a.cta) b.setCta();
              b.setButtonText(a.text).onClick(() => void a.onClick(void 0, ctx));
            });
          }
          return;
        }
        case "button": {
          const setting = newRowSetting(body, row);
          setting.addButton((b) => {
            if (row.cta) b.setCta();
            b.setButtonText(row.buttonText).onClick(() => row.onClick(ctx));
          });
          setting.settingEl.classList.add("bz-setting-action-row");
          return;
        }
        case "info": {
          const setting = newRowSetting(body, row);
          for (const a of (_c = row.actions) != null ? _c : []) {
            setting.addButton((b) => {
              if (a.cta) b.setCta();
              b.setButtonText(a.text).onClick(() => void a.onClick(void 0, ctx));
            });
          }
          return;
        }
        case "list": {
          const wrap = document.createElement("div");
          wrap.className = "bz-setlist-wrap";
          body.appendChild(wrap);
          const setting = new Setting(wrap).setName(row.name);
          if (row.desc) setting.setDesc(row.desc);
          if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
          const box = document.createElement("div");
          box.className = "bz-setlist";
          wrap.appendChild(box);
          const readItems = () => typeof row.items === "function" ? row.items() : row.items;
          const renderItems = () => {
            const items = readItems();
            box.innerHTML = "";
            if (items.length === 0) {
              if (row.emptyText) {
                const empty = document.createElement("div");
                empty.className = "bz-setlist-empty";
                empty.textContent = row.emptyText;
                box.appendChild(empty);
              }
              return;
            }
            for (const it of items) {
              const item = document.createElement("div");
              item.className = "bz-setlist-item";
              item.dataset.key = it.key;
              if (it.imageUrl) {
                const img = document.createElement("img");
                img.className = "bz-setlist-avatar";
                img.src = it.imageUrl;
                img.alt = "";
                img.onerror = () => img.remove();
                item.appendChild(img);
              }
              const text = document.createElement("div");
              text.className = "bz-setlist-text";
              const name = document.createElement("div");
              name.className = "bz-setlist-name";
              name.textContent = it.label;
              text.appendChild(name);
              if (it.sub) {
                const sub = document.createElement("div");
                sub.className = "bz-setlist-sub";
                sub.textContent = it.sub;
                text.appendChild(sub);
              }
              item.appendChild(text);
              const remove = document.createElement("button");
              remove.className = "bz-setlist-remove bz-touch-target--xl";
              remove.textContent = row.removeLabel || "移除";
              remove.onclick = () => {
                void (async () => {
                  var _a3;
                  const remaining = readItems().map((x) => x.key).filter((k) => k !== it.key);
                  try {
                    await ((_a3 = row.onChange) == null ? void 0 : _a3.call(row, remaining, ctx));
                  } catch (e) {
                    notifySaveError(e, row.name || "列表项");
                  } finally {
                    renderItems();
                    reevaluate();
                  }
                })();
              };
              item.appendChild(remove);
              box.appendChild(item);
            }
          };
          renderItems();
          return;
        }
        case "text":
        case "textarea":
        case "number":
          renderTextualRow(body, row);
          return;
      }
    };
    const renderGroupRows = (body, rows) => {
      var _a2, _b;
      const firstToggleKey = (_b = (_a2 = rows.find((r) => r.type === "toggle" && "key" in r.binding)) == null ? void 0 : _a2.binding.key) != null ? _b : null;
      for (const row of rows) renderRow(body, row, firstToggleKey);
    };
    for (const group of schema.groups) {
      if (group.icon) {
        const body = createSettingsGroup(container, { icon: group.icon, name: group.name });
        const groupEl = (_a = body.parentElement) != null ? _a : container;
        if (group.visibleWhen) entries.push({ el: groupEl, visibleWhen: group.visibleWhen });
        renderGroupRows(body, group.rows);
      } else {
        const title = document.createElement("div");
        title.className = "bz-setting-section-title";
        title.textContent = group.name;
        container.appendChild(title);
        if (group.visibleWhen) entries.push({ el: title, visibleWhen: group.visibleWhen });
        renderGroupRows(container, group.rows);
      }
    }
    reevaluate();
    return { refresh: reevaluate };
  }
  var TEXT_COMMIT_DELAY, CommitWarn;
  var init_settings_schema = __esm({
    "src/core/settings-schema.ts"() {
      init_fake_obsidian();
      init_settings_provider();
      init_path_picker();
      init_settings_modal();
      init_ui2();
      init_notice();
      TEXT_COMMIT_DELAY = 800;
      CommitWarn = class {
        constructor(initial, onCommit) {
          this.initial = initial;
          this.onCommit = onCommit;
          this.warnedInitial = null;
        }
        fire(current) {
          if (!this.onCommit) return;
          if (current !== this.initial) {
            if (this.warnedInitial !== this.initial) {
              this.warnedInitial = this.initial;
              this.onCommit();
            }
          } else {
            this.warnedInitial = null;
          }
        }
      };
    }
  });

  // src/core/settings-modal.ts
  function createSettingsGroup(container, opts) {
    const group = document.createElement("div");
    group.className = "bz-settings-group";
    const head = document.createElement("div");
    head.className = "bz-settings-group-head";
    const icon = document.createElement("span");
    icon.className = "bz-settings-group-icon";
    setIcon(icon, opts.icon);
    const name = document.createElement("span");
    name.className = "bz-settings-group-name";
    name.textContent = opts.name;
    const count = document.createElement("span");
    count.className = "bz-settings-group-count";
    count.textContent = "0 项";
    head.append(icon, name, count);
    const body = document.createElement("div");
    body.className = "bz-settings-group-body";
    group.append(head, body);
    container.appendChild(group);
    return body;
  }
  function isItemHidden(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      if (cur.classList.contains("bz-setting-hidden")) return true;
      if (cur.style.display === "none") return true;
      cur = cur.parentElement;
    }
    return false;
  }
  function refreshSettingsGroupCounts(content) {
    content.querySelectorAll(".bz-settings-group").forEach((g) => {
      const body = g.querySelector(".bz-settings-group-body");
      const countEl = g.querySelector(".bz-settings-group-count");
      if (!body || !countEl) return;
      const n = [...body.querySelectorAll(".setting-item")].filter((el) => {
        const h = el;
        return !h.classList.contains("bz-setting-action-row") && !isItemHidden(h);
      }).length;
      countEl.textContent = `${n} 项`;
      countEl.style.display = n > 0 ? "" : "none";
    });
  }
  function markSettingSplitRows(container) {
    container.querySelectorAll(".setting-item").forEach((el) => {
      if (el.classList.contains("bz-path-picker-setting-row")) return;
      const ctl = el.querySelector(".setting-item-control");
      el.classList.toggle("bz-setting-split", !!ctl && ctl.children.length >= 2);
    });
  }
  function closeSettingsModal() {
    var _a;
    if (currentModal) {
      const m = currentModal;
      currentModal = null;
      m.dispose();
      (_a = m.onClose) == null ? void 0 : _a.call(m);
    }
  }
  function openSettingsModal(opts) {
    var _a;
    closeSettingsModal();
    const prevActive = document.activeElement;
    const { mask, popup } = createOverlay({
      maskId: "bz-settings-modal-mask",
      popupId: "bz-settings-modal-popup",
      // z-index 动态发号（ADR-0067）：原静态层规家族表随动态层级制退役，
      // 全站规则只有一条——谁后显示谁在上（settings-modal 每次打开新建 DOM，创建即显示）
      maxWidth: opts.maxWidth,
      onMaskClick: () => closeSettingsModal()
    });
    const header = document.createElement("div");
    header.className = "bz-settings-header";
    const title = document.createElement("h3");
    title.className = "bz-settings-title";
    title.textContent = opts.title;
    header.appendChild(title);
    const content = document.createElement("div");
    content.className = "bz-settings-content";
    renderSettingsInto(content, (_a = opts.schema) != null ? _a : { groups: [] });
    const hasVisibleItem = Array.from(content.querySelectorAll(".setting-item")).some(
      (el) => !el.classList.contains("bz-setting-action-row") && !isItemHidden(el)
    );
    if (!hasVisibleItem) {
      content.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "bz-settings-empty";
      empty.textContent = opts.emptyText || "暂无设置项";
      if (opts.emptyDesc) {
        const desc = document.createElement("div");
        desc.className = "bz-settings-empty-desc";
        desc.textContent = opts.emptyDesc;
        empty.appendChild(desc);
      }
      content.appendChild(empty);
    }
    popup.appendChild(header);
    popup.appendChild(content);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = "block";
    popup.style.display = "flex";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    const firstFocusable = Array.from(popup.querySelectorAll(FOCUSABLE_SELECTOR)).find((el) => {
      if (isItemHidden(el)) return false;
      if (isMobileEnv()) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return false;
      }
      return true;
    });
    if (firstFocusable) firstFocusable.focus();
    const handle = escManager.register("bz-settings-modal", {
      isVisible: () => !!currentModal,
      close: () => closeSettingsModal()
    });
    currentModal = {
      mask,
      popup,
      onClose: opts.onClose,
      dispose: () => {
        mask.remove();
        popup.remove();
        handle.unregister();
        if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
          prevActive.focus();
        }
      }
    };
  }
  var FOCUSABLE_SELECTOR, currentModal;
  var init_settings_modal = __esm({
    "src/core/settings-modal.ts"() {
      init_fake_obsidian();
      init_dom();
      init_esc_manager();
      init_mobile();
      init_settings_schema();
      FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      currentModal = null;
    }
  });

  // src/auto-summary/parser.ts
  function unquote(v) {
    if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    return v;
  }
  function parseFrontmatter2(content) {
    const m = content.match(/^\s*---\s*\n([\s\S]*?)\n\s*---\s*\n/);
    if (!m) return { fm: null, body: content, extraLines: [] };
    const fm = {};
    const extraLines = [];
    const lines = m[1].split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const kv = line.match(KEY_LINE_RE);
      if (kv) {
        const key = kv[1].trim();
        let val = kv[2].trim();
        if (BLOCK_SCALAR_RE.test(val)) {
          const bodyLines = [];
          let indent = null;
          let j = i + 1;
          for (; j < lines.length; j++) {
            const l = lines[j];
            if (l.trim() === "") {
              bodyLines.push("");
              continue;
            }
            const lm = l.match(/^([ \t]+)\S/);
            if (!lm) break;
            if (indent === null) indent = lm[1];
            bodyLines.push(l.startsWith(indent) ? l.slice(indent.length) : l.replace(/^[ \t]+/, ""));
          }
          fm[key] = bodyLines.join("\n").replace(/\n+$/, "");
          i = j - 1;
          continue;
        }
        if (val === "") {
          const nested = [];
          let sawNested = false;
          let j = i + 1;
          for (; j < lines.length; j++) {
            const l = lines[j];
            if (l.trim() === "") {
              nested.push(l);
              continue;
            }
            if (LIST_ITEM_RE.test(l)) break;
            if (/^[ \t]/.test(l)) {
              sawNested = true;
              nested.push(l);
              continue;
            }
            break;
          }
          if (sawNested) {
            extraLines.push(line, ...nested);
            i = j - 1;
            continue;
          }
          fm[key] = "";
          continue;
        }
        if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (val.startsWith("[")) {
          try {
            val = JSON.parse(val);
          } catch (e) {
          }
        }
        fm[key] = val;
      } else if (LIST_ITEM_RE.test(line)) {
        const lastKey = Object.keys(fm).pop();
        if (lastKey && !Array.isArray(fm[lastKey])) fm[lastKey] = [];
        if (lastKey) {
          fm[lastKey].push(unquote(line.replace(LIST_ITEM_RE, "$1").trim()));
        } else {
          extraLines.push(line);
        }
      } else {
        extraLines.push(line);
      }
    }
    const body = content.slice(m[0].length);
    return { fm, body, extraLines };
  }
  function buildFrontmatter(fm, extraLines = []) {
    const lines = ["---"];
    for (const [k, v] of Object.entries(fm)) {
      if (Array.isArray(v)) {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - "${item}"`);
      } else if (v === null || v === void 0 || v === "") {
        lines.push(`${k}: ""`);
      } else {
        lines.push(`${k}: "${String(v).replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`);
      }
    }
    lines.push(...extraLines);
    lines.push("---");
    return lines.join("\n");
  }
  function extractBodyForAI(body) {
    return body.replace(/^\s*```dataviewjs[\s\S]*?```\s*/m, "").trim();
  }
  var KEY_LINE_RE, LIST_ITEM_RE, BLOCK_SCALAR_RE;
  var init_parser = __esm({
    "src/auto-summary/parser.ts"() {
      KEY_LINE_RE = /^([^\s:#-][^:]*):(.*)$/;
      LIST_ITEM_RE = /^[ \t]*-[ \t]+(.*)$/;
      BLOCK_SCALAR_RE = /^[|>][+-]?$/;
    }
  });

  // src/auto-summary/processor.ts
  function dedupeKeyFor(file) {
    return `auto-summary:${file.path}#${++attemptSeq}`;
  }
  async function humanizeFailReason() {
    try {
      await getAIProvider();
      return "摘要生成失败，请重试";
    } catch (e) {
      return "AI 服务未配置或不可用，请到设置页配置";
    }
  }
  function buildTagsRule(tagRange) {
    return `tags 规则：
- ${tagRange || "3-6"} 个中文标签，每个不超过 5 个字
- 涵盖：主题领域、关键技术/概念、应用场景`;
  }
  async function aiProcess(ai, bodyText, missing, opts = {}) {
    const length = opts.summaryLength || "standard";
    const summaryRule = SUMMARY_LENGTH_RULES[length] || SUMMARY_LENGTH_RULES.standard;
    const needed = missing.filter((f) => f !== "tags" || opts.tagsEnabled !== false);
    const fieldLines = needed.filter((f) => FIELD_DEFS[f]).map((f) => "  " + (f === "summary" ? summaryRule : FIELD_DEFS[f]));
    if (fieldLines.length === 0) return null;
    const prompt = `你是一个资讯文章分析助手。以下是一篇已转换为 Markdown 的文章正文。请分析内容，返回一个 JSON 对象（只返回 JSON，不要其他文字）：

{
${fieldLines.join(",\n")}
}

${needed.includes("tags") ? buildTagsRule(opts.tagCount || "3-6") + "\n\n" : ""}文章正文：
${bodyText.substring(0, 6e3)}`;
    try {
      const result = await ai.prompt(prompt, "deepseek-v4-flash", {
        modelOptions: { max_tokens: length === "detailed" ? 2048 : 1024, temperature: 0.3 }
      });
      const jsonMatch = (result || "").match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn("[自动摘要] AI 处理失败:", e);
    }
    return null;
  }
  async function renameToTitle(app, file, title) {
    const clean = String(title).replace(/[\\/:*?"<>|\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!clean || clean === file.basename) return { target: file, renamed: false, failed: false };
    const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "/";
    let newPath = `${dir}/${clean}.md`;
    let n = 1;
    while (app.vault.getAbstractFileByPath(newPath)) {
      newPath = `${dir}/${clean} (${n++}).md`;
    }
    try {
      await app.vault.rename(file, newPath);
      return { target: app.vault.getAbstractFileByPath(newPath) || file, renamed: true, failed: false };
    } catch (e) {
      console.warn("[自动摘要] 重命名失败，仅写 frontmatter title:", e);
      return { target: file, renamed: false, failed: true };
    }
  }
  function formatSummaryNotice(fm) {
    const parts = [];
    if (fm.title) parts.push(`《${fm.title}》`);
    if (fm.summary) parts.push(String(fm.summary));
    if (Array.isArray(fm.tags) && fm.tags.length) parts.push(fm.tags.map((t) => `#${t}`).join(" "));
    return parts.join("\n\n");
  }
  async function processFile(app, ai, file, opts = {}) {
    const force = opts.force === true;
    let h = null;
    const s = tryGetSettings();
    const summaryLength = String(s.autoSummaryLength || "standard");
    const tagsEnabled = s.autoSummaryTagsEnabled !== false;
    const tagCount = String(s.autoSummaryTagCount || "3-6");
    try {
      const content = await app.vault.read(file);
      const { fm, body } = parseFrontmatter2(content);
      const bodyText = extractBodyForAI(body);
      if (!bodyText || bodyText.length < 100) return;
      const missing = [];
      if (force) {
        missing.push("summary");
        if (tagsEnabled !== false) missing.push("tags");
      } else {
        if (!fm || !fm.title) missing.push("title");
        if (!fm || !fm.summary) missing.push("summary");
        if (tagsEnabled !== false && (!fm || !Array.isArray(fm.tags) || fm.tags.length === 0)) missing.push("tags");
        if (missing.length === 0) return;
      }
      const startName = fm && fm.title ? fm.title : file.basename;
      const key = dedupeKeyFor(file);
      if (!opts.quiet) {
        h = notify(`正在为《${startName}》生成摘要…`, { type: "progress", dedupeKey: key });
      }
      const aiResult = await aiProcess(ai, bodyText, missing, { summaryLength, tagsEnabled, tagCount });
      if (!aiResult) {
        const reason = await humanizeFailReason();
        if (h) h.hide();
        const errHandle = notify(reason, { type: "error", duration: 0 });
        const retryBtn = document.createElement("span");
        retryBtn.className = "bz-notice-action";
        retryBtn.setAttribute("role", "button");
        retryBtn.textContent = "重试";
        retryBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          retryBtn.remove();
          errHandle.hide();
          void Promise.resolve().then(() => (init_auto_summary(), auto_summary_exports)).then((m) => m.retrySummaryWithAI(app, ai, file, force)).catch(() => {
          });
        });
        errHandle.el.appendChild(retryBtn);
        return;
      }
      let targetFile = file;
      let renameFailed = false;
      if (missing.includes("title") && aiResult.title) {
        const outcome = await renameToTitle(app, file, aiResult.title);
        targetFile = outcome.target;
        if (outcome.renamed) {
          notify(`已重命名为《${aiResult.title}》`, { type: "success" });
        } else if (outcome.failed) {
          renameFailed = true;
        }
      }
      const latest = await app.vault.read(targetFile);
      const latestParsed = parseFrontmatter2(latest);
      const mergedFm = { ...latestParsed.fm || {} };
      if (missing.includes("title") && aiResult.title) mergedFm.title = aiResult.title;
      if (missing.includes("summary") && aiResult.summary) mergedFm.summary = aiResult.summary;
      if (missing.includes("tags") && Array.isArray(aiResult.tags) && aiResult.tags.length) {
        mergedFm.tags = aiResult.tags;
      }
      const newContent = buildFrontmatter(mergedFm, latestParsed.extraLines) + "\n\n" + latestParsed.body;
      await app.vault.modify(targetFile, newContent);
      if (renameFailed) {
        notify("自动改名失败，标题已写入笔记，请手动重命名", { type: "warning" });
      }
      const msg = formatSummaryNotice(mergedFm);
      if (msg) {
        notify(msg, {
          type: "success",
          dedupeKey: key,
          duration: 8e3,
          action: {
            label: "查看",
            onClick: () => {
              Promise.resolve().then(() => (init_ui3(), ui_exports)).then((m) => m.revealClipArticle(targetFile.path)).catch(() => {
              });
            }
          }
        });
      } else if (h) {
        h.hide();
      }
    } catch (e) {
      if (h) h.hide();
      console.error(`[自动摘要] 处理失败: ${file.basename}`, e);
    }
  }
  var attemptSeq, FIELD_DEFS, SUMMARY_LENGTH_RULES;
  var init_processor2 = __esm({
    "src/auto-summary/processor.ts"() {
      init_parser();
      init_notice();
      init_ai();
      init_settings_provider();
      attemptSeq = 0;
      FIELD_DEFS = {
        title: '"title": "生成中文标题，15-30字，完整陈述句，不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢）。禁止冒号、破折号、句中句号问号，需要连接时用逗号"',
        summary: `"summary": "150-250字的详细摘要。包含核心观点、关键事实、重要数据和结论。直接陈述内容，绝对禁止使用'本文'、'本文章'、'这篇文章'、'文章指出'、'作者认为'等前缀词"`,
        tags: '"tags": ["标签1", "标签2", "标签3"]'
      };
      SUMMARY_LENGTH_RULES = {
        simple: `"summary": "50-100字的简短摘要。提炼核心观点与关键结论。直达内容，禁止使用'本文'、'本文章'、'文章'、'作者认为'等前缀词"`,
        standard: `"summary": "150-250字的详细摘要。包含核心观点、关键事实、重要数据和结论。直接陈述内容，绝对禁止使用'本文'、'本文章'、'这篇文章'、'文章指出'、'作者认为'等前缀词"`,
        detailed: `"summary": "300-400字的详尽摘要。完整覆盖核心观点、关键事实、重要数据、推论与结论，条理清晰。直接陈述内容，绝对禁止使用'本文'、'本文章'、'这篇文章'、'文章指出'、'作者认为'等前缀词"`
      };
    }
  });

  // src/auto-summary/index.ts
  var auto_summary_exports = {};
  __export(auto_summary_exports, {
    ensureAutoSummary: () => ensureAutoSummary,
    isAutoSummaryInitialized: () => isAutoSummaryInitialized,
    redoSummaryForActiveFile: () => redoSummaryForActiveFile,
    regenerateSummary: () => regenerateSummary,
    retrySummaryWithAI: () => retrySummaryWithAI,
    stopAutoSummary: () => stopAutoSummary,
    unloadAutoSummary: () => unloadAutoSummary
  });
  function getWatchDir() {
    const s = tryGetSettings();
    return s && s.articleDirectory || "归档/网页剪藏";
  }
  function enqueueJob(job) {
    return new Promise((resolve2) => {
      if (processingPaths.has(job.file.path)) {
        resolve2();
        return;
      }
      processingPaths.add(job.file.path);
      jobQueue.push({ ...job, resolve: resolve2 });
      batchTotal++;
      if (drainTimer === null) {
        drainTimer = setTimeout(() => {
          drainTimer = null;
          void drainQueue();
        }, 0);
      }
    });
  }
  async function drainQueue() {
    var _a;
    if (draining) return;
    draining = true;
    try {
      while (jobQueue.length > 0) {
        const job = jobQueue.shift();
        batchDone++;
        updateBatchNotice();
        try {
          await processFile(job.app, job.ai, job.file, { force: job.force === true, quiet: batchTotal > 1 });
        } catch (e) {
        } finally {
          processingPaths.delete(job.file.path);
          (_a = job.resolve) == null ? void 0 : _a.call(job);
        }
      }
    } finally {
      draining = false;
      if (batchNotice) {
        batchNotice.hide();
        batchNotice = null;
      }
      batchTotal = 0;
      batchDone = 0;
    }
  }
  function updateBatchNotice() {
    if (batchTotal <= 1) return;
    const msg = `正在生成摘要 ${batchDone}/${batchTotal}…`;
    if (batchNotice) {
      batchNotice.setMessage(msg);
    } else {
      batchNotice = notify(msg, { type: "progress", dedupeKey: "auto-summary:batch" });
    }
  }
  function queueProcess(app, ai, file) {
    if (!file || file.extension !== "md") return;
    if (!file.path.startsWith(getWatchDir() + "/")) return;
    if (pendingPaths.has(file.path)) return;
    const timer = setTimeout(() => {
      pendingPaths.delete(file.path);
      void enqueueJob({ app, ai, file });
    }, 1500);
    pendingPaths.set(file.path, timer);
  }
  function regenerateSummary(app, file) {
    if (!file || file.extension !== "md") return Promise.resolve();
    return enqueueJob({ app, ai: createAI(), file, force: true });
  }
  function retrySummaryWithAI(app, ai, file, force) {
    if (!file || file.extension !== "md") return Promise.resolve();
    return enqueueJob({ app, ai, file, force });
  }
  async function redoSummaryForActiveFile(app) {
    const ws = app && app.workspace;
    const file = ws && typeof ws.getActiveFile === "function" ? ws.getActiveFile() : null;
    if (!file || file.extension !== "md" || !String(file.path || "").startsWith(getWatchDir() + "/")) {
      notify("当前打开的不是剪藏笔记，无法重新生成摘要", { type: "info" });
      return;
    }
    await regenerateSummary(app, file);
  }
  function scheduleRegister(app) {
    const ai = createAI();
    registerTimer = setTimeout(() => {
      var _a;
      registerTimer = null;
      if (!vaultRef) return;
      const timing = ((_a = tryGetSettings()) == null ? void 0 : _a.autoSummaryTiming) || "immediate";
      if (timing !== "lazy") {
        fileListenerRef = vaultRef.on("create", (file) => queueProcess(app, ai, file));
      }
      if (workspaceRef && typeof workspaceRef.on === "function") {
        openListenerRef = workspaceRef.on("file-open", (file) => queueProcess(app, ai, file));
      }
    }, 2e3);
  }
  function ensureAutoSummary(app) {
    if (initialized2) {
      if (!registerTimer && !fileListenerRef) scheduleRegister(app);
      return;
    }
    initialized2 = true;
    vaultRef = app.vault;
    workspaceRef = app.workspace;
    scheduleRegister(app);
  }
  function isAutoSummaryInitialized() {
    return initialized2;
  }
  function stopAutoSummary() {
    if (registerTimer) {
      clearTimeout(registerTimer);
      registerTimer = null;
    }
    if (fileListenerRef && vaultRef) {
      try {
        vaultRef.offref(fileListenerRef);
      } catch (e) {
      }
      fileListenerRef = null;
    }
    if (openListenerRef && workspaceRef) {
      try {
        workspaceRef.offref(openListenerRef);
      } catch (e) {
      }
      openListenerRef = null;
    }
    for (const timer of pendingPaths.values()) clearTimeout(timer);
    pendingPaths.clear();
    if (drainTimer !== null) {
      clearTimeout(drainTimer);
      drainTimer = null;
    }
    jobQueue.length = 0;
    if (batchNotice) {
      batchNotice.hide();
      batchNotice = null;
    }
    batchTotal = 0;
    batchDone = 0;
    processingPaths.clear();
  }
  function unloadAutoSummary() {
    stopAutoSummary();
    initialized2 = false;
    vaultRef = null;
    workspaceRef = null;
  }
  var initialized2, vaultRef, workspaceRef, fileListenerRef, openListenerRef, registerTimer, pendingPaths, processingPaths, jobQueue, draining, drainTimer, batchTotal, batchDone, batchNotice;
  var init_auto_summary = __esm({
    "src/auto-summary/index.ts"() {
      init_ai();
      init_settings_provider();
      init_notice();
      init_processor2();
      initialized2 = false;
      vaultRef = null;
      workspaceRef = null;
      fileListenerRef = null;
      openListenerRef = null;
      registerTimer = null;
      pendingPaths = /* @__PURE__ */ new Map();
      processingPaths = /* @__PURE__ */ new Set();
      jobQueue = [];
      draining = false;
      drainTimer = null;
      batchTotal = 0;
      batchDone = 0;
      batchNotice = null;
    }
  });

  // src/core/settings-common.ts
  function numStrBinding(key, def) {
    return {
      get: () => {
        const raw = tryGetSettings()[key];
        if (raw === "" || raw === null || raw === void 0) return def;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : def;
      },
      set: (v) => {
        getSettings()[key] = String(v);
      },
      save: () => saveSettings()
    };
  }
  var init_settings_common = __esm({
    "src/core/settings-common.ts"() {
      init_notice();
      init_settings_provider();
    }
  });

  // src/clipbook/news-source-settings.ts
  function emptyDataSourceState(exists = false) {
    return { exists, sources: { ...DEFAULT_SOURCES }, bilibiliUps: [], bilibiliUpInfo: {}, bilibiliMaxItems: 10, bilibiliCookie: "", lastFetchAt: null, totalArticles: 0, rssFeeds: [] };
  }
  async function readDataSourceState() {
    const res = await readNewsData();
    if (res.missing) {
      return emptyDataSourceState(false);
    }
    if (!res.ok) {
      return emptyDataSourceState(true);
    }
    let lastFetchAt = null;
    for (const a of res.data.articles) {
      if (a && a.fetchedAt && (!lastFetchAt || String(a.fetchedAt) > lastFetchAt)) lastFetchAt = String(a.fetchedAt);
    }
    return {
      exists: true,
      sources: { ...res.data.sources },
      bilibiliUps: [...res.data.bilibiliUps],
      bilibiliUpInfo: { ...res.data.bilibiliUpInfo },
      bilibiliMaxItems: res.data.bilibiliMaxItems,
      bilibiliCookie: res.data.bilibiliCookie,
      lastFetchAt,
      totalArticles: res.data.articles.length,
      rssFeeds: [...res.data.rssFeeds]
    };
  }
  async function writeSources(sources) {
    await enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok) return;
      await writeNewsDataMerged({ set: { sources: { ...sources } } });
    });
  }
  async function addBilibiliUp(uid) {
    const id = String(uid || "").trim();
    if (!id) return false;
    return enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok) return false;
      if (res.data.bilibiliUps.includes(id)) return false;
      await writeNewsDataMerged({ set: { bilibiliUps: [...res.data.bilibiliUps, id] } });
      return true;
    });
  }
  async function writeBilibiliMaxItems(v) {
    const n = Math.floor(Number(v));
    const maxItems = Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : 10;
    await enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok) return;
      await writeNewsDataMerged({ set: { bilibiliMaxItems: maxItems } });
    });
  }
  async function writeBilibiliCookie(cookie) {
    const c = String(cookie || "").trim();
    await enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok) return;
      await writeNewsDataMerged({ set: { bilibiliCookie: c } });
    });
  }
  async function addRssFeed(url, title) {
    const u = normalizeRssFeedUrl(url);
    if (!u) return false;
    const t = String(title || "").trim();
    return enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok) return false;
      if (res.data.rssFeeds.some((f) => f.url === u)) return false;
      const feed = t ? { url: u, title: t } : { url: u };
      await writeNewsDataMerged({ set: { rssFeeds: [...res.data.rssFeeds, feed] } });
      return true;
    });
  }
  async function removeRssFeed(url) {
    const u = String(url || "").trim();
    if (!u) return;
    await enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      await writeNewsDataMerged({ set: { rssFeeds: res.data.rssFeeds.filter((f) => f.url !== u) } });
    });
  }
  async function removeBilibiliUp(uid) {
    await enqueueNewsWrite(async () => {
      const res = await readNewsData();
      if (!res.ok || res.missing) return;
      const info = { ...res.data.bilibiliUpInfo };
      delete info[uid];
      await writeNewsDataMerged({
        set: { bilibiliUps: res.data.bilibiliUps.filter((u) => u !== uid), bilibiliUpInfo: info }
      });
    });
  }
  var init_news_source_settings = __esm({
    "src/clipbook/news-source-settings.ts"() {
      init_news_data();
      init_write_queue();
    }
  });

  // src/clipbook/news-sources-group.ts
  function dataSourceGroupRows(init) {
    const box = {
      ...init,
      sources: { ...init.sources },
      bilibiliUps: [...init.bilibiliUps],
      bilibiliUpInfo: { ...init.bilibiliUpInfo }
    };
    if (!box.exists) {
      return [
        { type: "info", name: "尚未启用新闻数据源", desc: "聚合讯数据由外部「数据源守护」进程（obsidian-news）抓取入库。安装并启动后此处会显示数据源设置。" },
        { type: "button", name: "安装数据源", buttonText: "复制安装命令", cta: true, onClick: () => {
          const cmd = "npm install -g @jwbz/obsidian-news && obsidian-news start";
          navigator.clipboard.writeText(cmd).then(
            () => notice("安装命令已复制", "success"),
            () => notice("复制失败，请手动复制", "error")
          );
        } }
      ];
    }
    const bilibiliOn = () => box.sources.bilibili === true;
    const rssOn = () => box.sources.rss === true;
    const sourceBinding = (key) => ({
      get: () => box.sources[key] === true,
      set: (v) => {
        box.sources[key] = v;
      },
      save: () => writeSources({ ...box.sources })
    });
    const upListDesc = () => box.bilibiliUps.length > 0 ? `已跟踪 ${box.bilibiliUps.length} 位 UP 主，添加与移除在管理弹窗` : "暂未跟踪 UP 主，添加与移除在管理弹窗";
    const rssListDesc = () => box.rssFeeds.length > 0 ? `已订阅 ${box.rssFeeds.length} 个 RSS 源，添加与移除在管理弹窗` : "暂未订阅 RSS 源，添加与移除在管理弹窗";
    return [
      { type: "toggle", name: "知乎日报", desc: "抓取知乎日报每日文章", binding: sourceBinding("zhihu") },
      { type: "toggle", name: "果壳科学人", desc: "抓取果壳科学人最新文章", binding: sourceBinding("guokr") },
      { type: "toggle", name: "B站 UP 主", desc: "抓取名单内 UP 主的视频投稿", binding: sourceBinding("bilibili") },
      {
        type: "button",
        name: "UP 主名单",
        desc: upListDesc(),
        buttonText: "管理",
        cta: true,
        visibleWhen: bilibiliOn,
        onClick: (ctx) => openUpManagerModal({
          ups: [...box.bilibiliUps],
          upInfo: { ...box.bilibiliUpInfo },
          cookie: box.bilibiliCookie,
          onChanged: async () => {
            const fresh = await readDataSourceState();
            box.bilibiliUps = [...fresh.bilibiliUps];
            box.bilibiliUpInfo = { ...fresh.bilibiliUpInfo };
            box.bilibiliCookie = fresh.bilibiliCookie;
            setRowDesc(ctx, upListDesc());
            ctx.refreshVisibility();
          }
        })
      },
      { type: "toggle", name: "RSS 订阅", desc: "抓取订阅列表内 RSS 源的文章", binding: sourceBinding("rss") },
      {
        type: "button",
        name: "RSS 订阅源",
        desc: rssListDesc(),
        buttonText: "管理",
        cta: true,
        visibleWhen: rssOn,
        onClick: (ctx) => openRssManagerModal({
          feeds: box.rssFeeds.map((f) => ({ ...f })),
          onChanged: async () => {
            const fresh = await readDataSourceState();
            box.rssFeeds = fresh.rssFeeds.map((f) => ({ ...f }));
            setRowDesc(ctx, rssListDesc());
            ctx.refreshVisibility();
          }
        })
      },
      {
        type: "number",
        name: "B站抓取条数",
        desc: "每位 UP 主抓取最近动态的条数上限，默认 10",
        min: 1,
        max: 50,
        step: 1,
        visibleWhen: bilibiliOn,
        binding: {
          get: () => box.bilibiliMaxItems,
          set: (v) => {
            box.bilibiliMaxItems = v;
          },
          save: () => writeBilibiliMaxItems(box.bilibiliMaxItems)
        }
      },
      {
        type: "number",
        name: "文章保留天数",
        desc: "已读与跳过文章的数据超期自动清理，默认 30 天",
        min: 1,
        step: 1,
        binding: numStrBinding("newsRetentionUnsavedDays", 30)
      }
    ];
  }
  function setRowDesc(ctx, text) {
    const el = ctx.rowEl.querySelector(".bz-sp-set-desc") || ctx.rowEl.querySelector(".setting-item-description");
    if (el) el.textContent = text;
  }
  function upManagerSettingsSchema(opts) {
    const box = {
      inputValue: "",
      cookieInput: String(opts.cookie || ""),
      ups: [...opts.ups],
      upInfo: { ...opts.upInfo }
    };
    return {
      groups: [
        {
          icon: "users",
          name: "UP 主名单",
          rows: [
            {
              type: "text",
              name: "添加 UP 主",
              desc: "粘贴主页链接或视频链接，自动解析后入库",
              placeholder: "粘贴链接或 UID",
              binding: {
                get: () => box.inputValue,
                set: (v) => {
                  box.inputValue = v;
                },
                save: () => {
                }
              },
              actions: [{
                text: "添加",
                cta: true,
                onClick: (value) => addUpUid(value, box, opts)
              }]
            },
            {
              type: "text",
              name: "B 站 Cookie 可选",
              desc: cookieDesc(box.cookieInput),
              placeholder: "粘贴 buvid3 或 SESSDATA 等 Cookie",
              binding: {
                get: () => box.cookieInput,
                set: (v) => {
                  box.cookieInput = v;
                },
                save: () => {
                }
              },
              actions: [
                { text: "保存", onClick: (value) => saveCookie(value || "", box, opts) },
                { text: "清除", onClick: () => saveCookie("", box, opts) }
              ]
            },
            {
              type: "list",
              name: "名单列表",
              desc: "已跟踪的 UP 主，移除后不再抓取其投稿",
              items: () => box.ups.map((uid) => {
                var _a;
                return {
                  key: uid,
                  label: upDisplayName(uid, box.upInfo[uid]),
                  sub: `UID ${uid}`,
                  imageUrl: (_a = box.upInfo[uid]) == null ? void 0 : _a.avatar
                };
              }),
              emptyText: "暂无跟踪 UP 主，在上方粘贴主页链接或视频链接添加",
              onChange: (keys) => {
                void (async () => {
                  const removed = box.ups.filter((u) => !keys.includes(u));
                  for (const uid of removed) {
                    await removeBilibiliUp(uid);
                    box.ups = box.ups.filter((u) => u !== uid);
                    delete box.upInfo[uid];
                    notice(`已移除 UP 主 ${uid}`, "success");
                  }
                  if (removed.length > 0) opts.onChanged();
                })();
              }
            }
          ]
        }
      ]
    };
  }
  function upDisplayName(uid, info) {
    return info && info.name ? info.name : `UP ${uid}`;
  }
  function cookieDesc(current) {
    return `遇到风控时需粘贴登录后的 Cookie。当前${current ? "已配置" : "未配置"}`;
  }
  async function addUpUid(raw, box, opts) {
    const input = String(raw || "").trim();
    if (!input) return;
    const uid = await resolveUidFromInput(input);
    if (!uid) {
      notice("无法识别 UID，请粘贴 space.bilibili.com 内的主页链接", "error");
      return;
    }
    const added = await addBilibiliUp(uid);
    if (!added) {
      notice("该 UP 主已在名单中", "info");
      return;
    }
    box.inputValue = "";
    box.ups = [...box.ups, uid];
    opts.onChanged();
    notice(`已添加 UP 主 ${uid}`, "success");
  }
  async function saveCookie(value, box, opts) {
    await writeBilibiliCookie(value);
    box.cookieInput = value;
    opts.onChanged();
    notice(value ? "B 站 Cookie 已保存" : "已清除 B 站 Cookie，回自动引导", "success");
  }
  function openUpManagerModal(opts) {
    let handle = null;
    function close() {
      mask.remove();
      popup.remove();
      if (handle) handle.unregister();
    }
    const { mask, popup } = createOverlay({
      maskId: "bz-up-manager-mask",
      popupId: "bz-up-manager-popup",
      maxWidth: 560,
      // ticket 170 方案 A：加宽让描述换行，文字不再拥挤
      onMaskClick: close
    });
    const header = document.createElement("div");
    header.className = "bz-settings-header";
    const title = document.createElement("h3");
    title.className = "bz-settings-title";
    title.textContent = "UP 主名单管理";
    header.appendChild(title);
    const content = document.createElement("div");
    content.className = "bz-settings-content";
    renderSettingsInto(content, upManagerSettingsSchema(opts));
    popup.appendChild(header);
    popup.appendChild(content);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = "block";
    popup.style.display = "flex";
    const handleReg = escManager.register("bz-up-manager", {
      isVisible: () => true,
      close
    });
    handle = handleReg;
  }
  async function fetchRssFeedTitle(url) {
    try {
      const timer = new Promise((resolve2) => setTimeout(() => resolve2(null), 1e4));
      const req = requestUrl({ url, method: "GET" }).then((resp) => {
        if (resp.status < 200 || resp.status >= 300) return null;
        if (!looksLikeFeedXml(resp.text)) return null;
        return extractFeedTitleFromXml(resp.text);
      });
      return await Promise.race([req, timer]);
    } catch (e) {
      return null;
    }
  }
  function rssManagerSettingsSchema(opts) {
    const box = {
      inputValue: "",
      feeds: opts.feeds.map((f) => ({ ...f }))
    };
    return {
      groups: [
        {
          icon: "rss",
          name: "RSS 订阅源",
          rows: [
            { type: "info", name: "守护需更新", desc: "RSS 抓取由 obsidian-news 守护执行，请更新到最新版并重启守护后生效" },
            {
              type: "text",
              name: "添加 RSS 源",
              desc: "粘贴 RSS 订阅地址，保存前先试拉校验并读取源名称",
              placeholder: "https://example.com/rss.xml",
              binding: {
                get: () => box.inputValue,
                set: (v) => {
                  box.inputValue = v;
                },
                save: () => {
                }
              },
              actions: [{
                text: "添加",
                cta: true,
                onClick: (value) => addRssFeedUrl(value, box, opts)
              }]
            },
            {
              type: "list",
              name: "订阅列表",
              desc: "已订阅的 RSS 源，移除后不再抓取",
              items: () => box.feeds.map((f) => ({
                key: f.url,
                label: f.title || f.url,
                sub: f.title ? f.url : ""
              })),
              emptyText: "暂无订阅源，在上方粘贴 RSS 地址添加",
              onChange: (keys) => (async () => {
                const removed = box.feeds.filter((f) => !keys.includes(f.url));
                for (const f of removed) {
                  await removeRssFeed(f.url);
                  box.feeds = box.feeds.filter((x) => x.url !== f.url);
                  notice(`已移除 RSS 源 ${f.title || f.url}`, "success");
                }
                if (removed.length > 0) opts.onChanged();
              })()
            }
          ]
        }
      ]
    };
  }
  async function addRssFeedUrl(raw, box, opts) {
    const input = String(raw || "").trim();
    if (!input) return;
    const url = normalizeRssFeedUrl(input);
    if (!url) {
      notice("无效的 RSS 地址，请粘贴 http/https 开头的订阅链接", "error");
      return;
    }
    if (box.feeds.some((f) => f.url === url)) {
      notice("该 RSS 源已在订阅列表中", "info");
      return;
    }
    notice("正在校验 RSS 地址…", "info");
    const title = await fetchRssFeedTitle(url);
    if (title === null) {
      notice("试拉失败：地址不可达或不是有效的 RSS 源，未添加", "error");
      return;
    }
    const added = await addRssFeed(url, title);
    if (!added) {
      notice("该 RSS 源已在订阅列表中", "info");
      return;
    }
    box.inputValue = "";
    box.feeds = [...box.feeds, { url, title }];
    opts.onChanged();
    notice(`已订阅 ${title || url}`, "success");
  }
  function openRssManagerModal(opts) {
    let handle = null;
    function close() {
      mask.remove();
      popup.remove();
      if (handle) handle.unregister();
    }
    const { mask, popup } = createOverlay({
      maskId: "bz-rss-manager-mask",
      popupId: "bz-rss-manager-popup",
      maxWidth: 560,
      onMaskClick: close
    });
    const header = document.createElement("div");
    header.className = "bz-settings-header";
    const title = document.createElement("h3");
    title.className = "bz-settings-title";
    title.textContent = "RSS 订阅管理";
    header.appendChild(title);
    const content = document.createElement("div");
    content.className = "bz-settings-content";
    renderSettingsInto(content, rssManagerSettingsSchema(opts));
    popup.appendChild(header);
    popup.appendChild(content);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = "block";
    popup.style.display = "flex";
    const handleReg = escManager.register("bz-rss-manager", {
      isVisible: () => true,
      close
    });
    handle = handleReg;
  }
  var init_news_sources_group = __esm({
    "src/clipbook/news-sources-group.ts"() {
      init_fake_obsidian();
      init_notice();
      init_settings_common();
      init_dom();
      init_esc_manager();
      init_settings_schema();
      init_news_source_settings();
      init_news_data();
    }
  });

  // src/clipbook/md.ts
  function stripClipChrome(raw) {
    return String(raw || "").replace(/^\s*---[\s\S]*?---/, "").replace(/```dataviewjs[\s\S]*?```/g, "").trim();
  }
  var init_md = __esm({
    "src/clipbook/md.ts"() {
    }
  });

  // src/clipbook/store.ts
  function siteName(a) {
    return a.site ? String(a.site) : a.platform ? String(a.platform) : "未知";
  }
  function upName(a, info) {
    const uid = String(a && a.bvid || a && a.author || "");
    const name = info && typeof info === "object" ? info.name : null;
    return name || uid || "";
  }
  function platformOf(a) {
    const p = a.platform || "";
    if (p === "B站") return "B站";
    if (p === "果壳" || p === "果壳科学人") return "果壳科学人";
    if (p === "知乎日报" || p === "知乎") return "知乎日报";
    return p || "未知";
  }
  function siteDomain(a) {
    const u = String(a.url || "").trim();
    if (u) {
      try {
        return new URL(u).hostname;
      } catch (e) {
      }
      try {
        return new URL("https://" + u.replace(/^\/+/, "")).hostname;
      } catch (e) {
      }
    }
    return PLATFORM_DOMAIN[platformOf(a)] || "";
  }
  function cleanBody(body) {
    return String(body || "").trim();
  }
  function clipArticle(a, opts) {
    const clipByUrl = opts.clipByUrl || /* @__PURE__ */ new Set();
    const upInfo = opts.upInfo || {};
    const savedKeys = opts.savedKeys || /* @__PURE__ */ new Set();
    const key = articleKeyOf(a);
    const platform = platformOf(a);
    const newsSaved = a.state === "saved";
    const archived = savedKeys.has(String(a.url || ""));
    const clipped = !!a.url && clipByUrl.has(String(a.url));
    const saved = newsSaved || archived || clipped;
    const title = String(a.title || "(无标题)");
    const body = cleanBody(a.body);
    const isBili = platform === "B站";
    const feedUp = isBili ? upName(a, upInfo[String(a.author || "")]) : "";
    const srcName = feedUp || platform;
    const typeLabel = feedUp ? "UP主" : platform;
    let timeText = String(a.fetchedAt || a.date || "");
    let timeTs = new Date(a.fetchedAt || a.date || "").valueOf();
    if (isNaN(timeTs)) {
      timeText = "";
      timeTs = Date.now();
    }
    const st = saved ? "saved" : a.read === true ? "read" : "unread";
    return {
      id: key,
      origin: "news",
      title,
      url: String(a.url || ""),
      site: siteName(a),
      domain: siteDomain(a),
      author: String(a.author || ""),
      srcName,
      typeLabel,
      timeText,
      timeTs,
      summary: excerpt(body, 110),
      body,
      tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
      notePath: null,
      st,
      clipped,
      raw: a,
      backlinks: []
    };
  }
  function clipFromNote(n) {
    return {
      id: "clip:" + n.path,
      origin: "clip",
      title: String(n.title || "(无标题)"),
      url: n.url ? String(n.url) : "",
      site: String(n.site || "未知"),
      domain: n.domain || "",
      author: n.author || "",
      srcName: n.site || "剪藏",
      typeLabel: "",
      timeText: "",
      timeTs: n.created || 0,
      summary: String(n.summary || ""),
      body: "",
      tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
      notePath: n.path || null,
      st: "saved",
      clipped: true,
      note: n,
      backlinks: Array.isArray(n.backlinkNames) ? n.backlinkNames : []
    };
  }
  function clipUrlSet(notes) {
    const s = /* @__PURE__ */ new Set();
    for (const n of notes) if (n && n.url) s.add(String(n.url));
    return s;
  }
  function queryBySource(articles, sidecar, clipByUrl, clipNotes, source, upInfoMap = {}) {
    if (source.kind === "clip") {
      return (clipNotes || []).map((n) => clipFromNote(n));
    }
    const pool = (articles || []).filter((a) => !a.read);
    const savedKeys = new Set((sidecar.savedArchive || []).map((s) => s.url));
    if (source.kind === "site") {
      const s = normSite(source.site);
      const newsPart = pool.filter((a) => normSite(siteName(a)) === s).map((a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys, upInfo: upInfoMap })).filter((a) => a.st !== "saved");
      const clipPart = (clipNotes || []).filter((n) => normSite(String(n && n.site || "")) === s).map((n) => clipFromNote(n));
      return [...newsPart, ...clipPart].sort((a, b) => b.timeTs - a.timeTs);
    }
    let out = [];
    if (source.kind === "all") {
      out = pool.map((a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys, upInfo: upInfoMap }));
    } else {
      const isBili = source.platform === "B站";
      const list = pool.filter((a) => {
        const p = platformOf(a);
        if (p !== source.platform) return false;
        if (isBili && source.up && String(a.author || "") !== source.up) return false;
        return true;
      });
      out = list.map((a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys, upInfo: upInfoMap }));
    }
    return out.filter((a) => a.st !== "saved").sort((a, b) => b.timeTs - a.timeTs);
  }
  function queryBySourceFull(articles, sidecar, clipByUrl, clipNotes, source, upInfoMap = {}) {
    if (source.kind === "clip") {
      return (clipNotes || []).map((n) => clipFromNote(n));
    }
    const savedKeys = new Set((sidecar.savedArchive || []).map((s) => s.url));
    const isClippedNews = (a) => !!a && !!a.url && (savedKeys.has(String(a.url)) || clipByUrl.has(String(a.url)));
    const mapNews = (a) => clipArticle(a, { overrides: sidecar.articleOverrides, clipByUrl, savedKeys, upInfo: upInfoMap });
    let news = [];
    let clips = [];
    if (source.kind === "all") {
      news = (articles || []).filter((a) => !isClippedNews(a));
    } else if (source.kind === "site") {
      const s = normSite(source.site);
      news = (articles || []).filter((a) => !isClippedNews(a) && normSite(siteName(a)) === s);
      clips = (clipNotes || []).filter((n) => normSite(String(n && n.site || "")) === s).map((n) => clipFromNote(n));
    } else {
      const isBili = source.platform === "B站";
      news = (articles || []).filter((a) => {
        if (isClippedNews(a)) return false;
        const p = platformOf(a);
        if (p !== source.platform) return false;
        if (isBili && source.up && String(a.author || "") !== source.up) return false;
        return true;
      });
    }
    return [...news.map(mapNews), ...clips].sort((x, y) => y.timeTs - x.timeTs);
  }
  function bucketByState(list) {
    const unread = [];
    const read = [];
    const saved = [];
    for (const a of list) {
      if (a.st === "saved") saved.push(a);
      else if (a.st === "read") read.push(a);
      else unread.push(a);
    }
    return { unread, read, saved };
  }
  function normSite(s) {
    const t = String(s || "").trim();
    return t || "未知";
  }
  function aggregateSites(articles, clipNotes, savedUrls, clipUrls) {
    const saved = savedUrls || /* @__PURE__ */ new Set();
    const byUrl = clipUrls || /* @__PURE__ */ new Set();
    const rows = /* @__PURE__ */ new Map();
    const bump = (rawSite, unread) => {
      const site = normSite(rawSite);
      let r = rows.get(site);
      if (!r) {
        r = { site, total: 0, unread: 0 };
        rows.set(site, r);
      }
      r.total++;
      if (unread) r.unread++;
    };
    for (const n of clipNotes || []) bump(String(n && n.site || ""), false);
    for (const a of articles || []) {
      if (!a || a.read) continue;
      if (saved.has(String(a.url || ""))) continue;
      if (a.url && byUrl.has(String(a.url))) continue;
      bump(siteName(a), true);
    }
    return [...rows.values()].sort((x, y) => y.total - x.total || y.unread - x.unread || cmpZh(x.site, y.site));
  }
  var PLATFORM_DOMAIN;
  var init_store = __esm({
    "src/clipbook/store.ts"() {
      init_utils();
      init_news_data();
      init_constants();
      init_write_queue();
      PLATFORM_DOMAIN = {
        "B站": "bilibili.com",
        "果壳科学人": "guokr.com",
        "知乎日报": "zhihu.com"
      };
    }
  });

  // src/core/ui/str.ts
  function escapeHtml2(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc2(s) {
    return escapeHtml2(String(s != null ? s : ""));
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }
  var ESC_MAP;
  var init_str = __esm({
    "src/core/ui/str.ts"() {
      ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    }
  });

  // src/clipbook/render.ts
  function panelHtml() {
    return `
    <div class="bz-panel-frame bz-clip-frame bz-panel-mtop">
      <!-- 桌面三栏 -->
      <div class="bz-clip-desk">
        <div class="bz-panel-head bz-panel-head--tall">
          <div class="bz-panel-title">剪藏本</div>
          <div class="bz-panel-head-sp"></div>
          <div class="bz-clip-issue" data-clip-issue></div>
          <div class="bz-clip-head-search bz-search">${iconSpan(ICO.search)}<input class="bz-input" type="text" data-clip-desk-search placeholder="检索标题、摘要、站点…"></div>
        </div>
        <div class="bz-clip-desk-body">
          <div class="bz-rail bz-rail--wide bz-clip-rail">
            <div class="bz-clip-rail-label">SITE 站点</div>
            <div class="bz-rail-scroll" data-clip-rail></div>
            <div class="bz-clip-rail-foot" data-clip-rail-foot></div>
          </div>
          <div class="bz-clip-mid">
            <div class="bz-clip-toc-head">目录</div>
            <div class="bz-clip-list" data-clip-list></div>
          </div>
          <div class="bz-clip-read" data-clip-read-pane tabindex="0">
            <div class="bz-clip-read-scroll"><div class="bz-clip-read-body" data-clip-reader></div></div>
          </div>
        </div>
      </div>
      <!-- 移动双屏 -->
      <div class="bz-clip-mob" data-clip-mob>
        <div class="bz-clip-mob-top">
          <div class="bz-clip-mob-title">剪藏本</div>
          <span class="bz-clip-mob-act" data-clip-mob-search role="button">搜索</span>
          <span class="bz-clip-mob-act" data-clip-mob-close role="button">关闭</span>
        </div>
        <div class="bz-clip-mob-searchbar" data-clip-mob-searchbar style="display:none">
          <input class="bz-input" type="text" data-clip-mob-input placeholder="检索标题、摘要、站点…">
        </div>
        <div class="bz-clip-mob-list" data-clip-mob-list></div>
      </div>
      <!-- 移动详情 overlay（屏2） -->
      <div class="bz-clip-mob-detail bz-panel-mtop" data-clip-mob-detail style="display:none">
        <div class="bz-clip-mob-detail-top">
          <span class="bz-clip-mob-d-back" data-clip-mob-back role="button">‹ 返回</span>
          <div class="bz-clip-mob-detail-title" data-clip-mob-title></div>
          <span class="bz-clip-mob-save" data-clip-mob-save role="button">存为剪藏</span>
        </div>
        <div class="bz-clip-mob-detail-body" data-clip-mob-detail-body></div>
      </div>
    </div>
  `;
  }
  function siteShort(s) {
    return String(s || "").replace("果壳科学人", "果壳");
  }
  function siteTint(site) {
    let h = 0;
    const t = String(site || "");
    for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) >>> 0;
    return `hsl(${h % 360}, 42%, 52%)`;
  }
  function railItemHtml(sel, label, unread, total, icon, color, active, sub) {
    const badge = icon === "feed" ? `<span class="bz-rail-badge" style="--bz-rail-tint:${color || "#58a6ff"}">${esc2(sub || label.slice(0, 1))}</span>` : icon === "bili" ? `<span class="bz-rail-badge bili">${esc2(sub || label.slice(0, 1))}</span>` : icon === "clip" ? `<span class="bz-rail-ic">${iconSpan("scissors")}</span>` : `<span class="bz-rail-ic${sel.kind === "all" ? " bz-rail-ic--accent" : ""}">${icon ? iconSpan(icon) : ""}</span>`;
    const count = `<span class="bz-rail-count">${unread > 0 ? `<b>${unread}</b>` : unread}/${total}</span>`;
    return `
    <div class="bz-rail-item${active ? " on" : ""}" data-src='${esc2(JSON.stringify(sel))}' title="${esc2(label)}">
      ${badge}
      <span class="bz-rail-name">${esc2(label)}</span>
      <span class="bz-clip-lead"></span>
      ${count}
    </div>`;
  }
  function railFootHtml(todayRead) {
    return `今日已读<br><b>${todayRead}</b> 篇`;
  }
  function tocListHtml(list, curId, timeOf) {
    return list.map((a, i) => `
    <div class="bz-clip-item bz-clip-item--${a.st}${curId && curId === a.id ? " on" : ""}" data-id="${esc2(a.id)}">
      <span class="bz-clip-no">${String(i + 1).padStart(2, "0")}</span>
      <div class="bz-clip-item-main">
        <div class="bz-clip-item-t"><span>${esc2(a.title)}</span></div>
        <div class="bz-clip-item-meta">${esc2(siteShort(a.srcName))} · ${esc2(timeOf(a))}</div>
      </div>
    </div>`).join("");
  }
  function deskFoldRowHtml(kind, n, open) {
    const label = kind === "read" ? "已读" : "已收";
    const lab = open ? "收起" : `${label} <b>${n}</b> 篇`;
    return `
    <div class="bz-clip-desk-fold${open ? " on" : ""}" data-desk-fold="${kind}" role="button" aria-expanded="${open}">
      <span class="bz-clip-desk-fold-rule"></span>
      <span class="bz-clip-desk-fold-lab">${lab}</span>
      <span class="bz-clip-desk-fold-ar"></span>
      <span class="bz-clip-desk-fold-rule"></span>
    </div>`;
  }
  function foldBodyHtml(html, open) {
    return html ? `<div class="bz-clip-desk-fold-body"${open ? "" : " hidden"}>${html}</div>` : "";
  }
  function summaryHtml(summary) {
    return `<div class="bz-clip-art-sum"><span class="bz-clip-art-sum-h">${iconSpan("sparkles", "bz-ic--xs")}摘要</span>${esc2(summary)}</div>`;
  }
  function readerHtml(a, opts) {
    const openNoteFoot = a.origin === "clip" && a.notePath ? `<div class="bz-clip-art-foot"><span role="button" tabindex="0" data-clip-open-note>打开笔记 ${iconSpan(ICO.external, "bz-ic--xs")}</span></div>` : "";
    return `
    <div class="bz-clip-art-title">${esc2(a.title)}</div>
    <div class="bz-clip-art-meta">
      <span>${esc2(opts.time)}</span>
      <span class="bz-clip-art-site"><span class="bz-clip-art-site-name">${esc2(siteShort(a.srcName))}</span></span>
    </div>
    ${a.summary ? summaryHtml(a.summary) : ""}
    <div class="bz-clip-art-md markdown-rendered" data-clip-md>${opts.note ? `<p class="dim">${esc2(opts.note)}</p>` : ""}</div>
    ${openNoteFoot}
  `;
  }
  function mobListHtml(list, timeOf) {
    return list.map((a) => `
    <div class="bz-clip-mob-item ${a.st}" data-id="${esc2(a.id)}">
      <span class="bz-clip-mob-dot ${a.st}"></span>
      <span class="bz-clip-mob-ttl">${esc2(a.title)}</span>
      ${a.st === "reading" ? '<span class="bz-clip-mob-tag">在读</span>' : ""}
      <span class="bz-clip-mob-time">${esc2(timeOf(a))}</span>
    </div>`).join("");
  }
  function mobChHeadHtml(site, unread, readN, savedN) {
    const seg = [];
    if (unread > 0) seg.push(`${unread} 未读`);
    if (readN > 0) seg.push(`${readN} 已读`);
    if (savedN > 0) seg.push(`${savedN} 已收`);
    const cntTxt = seg.join(" · ");
    return `
    <div class="bz-clip-mob-ch-hd" data-src='${esc2(JSON.stringify({ kind: "site", site }))}' title="${esc2(site)}">
      <span class="bz-clip-mob-ch-name">${esc2(site)}</span>
      <span class="bz-clip-mob-ch-n">${cntTxt}</span>
      <span class="bz-clip-mob-ch-rule"></span>
    </div>`;
  }
  function mobFoldHtml(kind, n, open) {
    const label = kind === "read" ? "已读" : "已收";
    return `
    <div class="bz-clip-mob-fold${open ? " on" : ""}" data-fold data-fold-kind="${kind}" role="button" aria-expanded="${open}">
      <span class="bz-clip-mob-fold-rule"></span>
      <span class="bz-clip-mob-fold-lab">${open ? "收起" : `${label} <b>${n}</b> 篇`}</span>
      <span class="bz-clip-mob-fold-ar"></span>
      <span class="bz-clip-mob-fold-rule"></span>
    </div>`;
  }
  function mobFoldBodyHtml(kind, html, open) {
    return html ? open ? `<div class="bz-clip-mob-arch" data-arch-kind="${kind}">${html}</div>` : `<div class="bz-clip-mob-arch" data-arch-kind="${kind}" hidden>${html}</div>` : "";
  }
  function mobTocHtml(chapters, searching, expanded) {
    return chapters.map((ch) => {
      const readOpen = expanded.has("read:" + ch.site);
      const savedOpen = expanded.has("saved:" + ch.site);
      const foldRead = !searching && ch.readN > 0 ? mobFoldHtml("read", ch.readN, readOpen) : "";
      const foldSaved = !searching && ch.savedN > 0 ? mobFoldHtml("saved", ch.savedN, savedOpen) : "";
      const readBody = mobFoldBodyHtml("read", ch.readHtml, searching || readOpen);
      const savedBody = mobFoldBodyHtml("saved", ch.savedHtml, searching || savedOpen);
      return `
      <div class="bz-clip-mob-ch">
        ${mobChHeadHtml(ch.site, ch.unread, ch.readN, ch.savedN)}
        <div class="bz-clip-mob-ch-items">${ch.activeHtml}${foldRead}${readBody}${foldSaved}${savedBody}</div>
      </div>`;
    }).join("");
  }
  function mobNoHitHtml(text) {
    return `<div class="bz-clip-mob-no-hit">${esc2(text)}</div>`;
  }
  function mobDetailHtml(a, opts) {
    return `
    <div class="bz-clip-mob-d-kicker"><span>${esc2(siteShort(a.srcName))} · ${esc2(opts.time)}</span><span>${esc2(opts.seq)}</span></div>
    <div class="bz-clip-mob-d-title">${esc2(a.title)}</div>
    <hr class="bz-clip-mob-d-rule">
    <div class="bz-clip-mob-d-md markdown-rendered" data-clip-mob-md>${opts.note ? `<p>${esc2(opts.note)}</p>` : ""}</div>
    <div class="bz-clip-mob-d-foot"><span class="bz-clip-mob-d-next" data-clip-mob-next>↓ 读下一则</span><span class="bz-clip-mob-d-fch">${esc2(siteShort(a.srcName))}</span></div>
  `;
  }
  var ICO;
  var init_render = __esm({
    "src/clipbook/render.ts"() {
      init_str();
      ICO = {
        inbox: "inbox",
        feed: "rss",
        clip: "scissors",
        bili: "play-square",
        mail: "mail",
        book: "book-open",
        check: "check",
        download: "download",
        external: "external-link",
        trash: "trash-2",
        search: "search",
        x: "x",
        arrow: "arrow-left",
        link: "link",
        globe: "globe",
        folder: "folder-open",
        rotate: "rotate-ccw",
        radio: "radio"
      };
    }
  });

  // src/clipbook/state.ts
  function defaultSel() {
    return { kind: "all", platform: "", up: null, site: "" };
  }
  function resetClipbookState() {
    M.appRef = null;
    M.overlay = null;
    M.open = false;
    M.articles = [];
    M.stats = { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} };
    M.sidecar = { articleOverrides: {}, savedArchive: [], order: [] };
    M.clipNotes = null;
    M.clipUrls = /* @__PURE__ */ new Set();
    M.sel = defaultSel();
    M.cur = null;
    M.list = [];
    M.upInfo = {};
    M.mobDetailOpen = false;
  }
  var M;
  var init_state = __esm({
    "src/clipbook/state.ts"() {
      M = {
        appRef: null,
        overlay: null,
        dir: "归档/网页剪藏",
        open: false,
        articles: [],
        stats: { totalRead: 0, totalSaved: 0, totalSkipped: 0, byPlatform: {}, byDate: {} },
        sidecar: { articleOverrides: {}, savedArchive: [], order: [] },
        clipNotes: null,
        clipUrls: /* @__PURE__ */ new Set(),
        sel: defaultSel(),
        cur: null,
        list: [],
        upInfo: {},
        mobDetailOpen: false,
        isMobile: false
      };
    }
  });

  // src/clipbook/scan.ts
  function defaultCache(f) {
    var _a;
    try {
      const app = getApp();
      if (app && typeof ((_a = app.metadataCache) == null ? void 0 : _a.getFileCache) === "function") {
        return app.metadataCache.getFileCache(f);
      }
    } catch (e) {
    }
    return f && f.frontmatter;
  }
  function parseClipFile(file, getCache, getBacklinks) {
    const cache = (getCache || defaultCache)(file);
    const fm = cache && cache.frontmatter;
    if (!fm) return null;
    if (!fm.url || !fm.created) return null;
    const title = file.basename || stripMdExt(String(file.name || ""));
    let created = new Date(fm.created).valueOf();
    if (isNaN(created)) created = Date.now();
    let backlinkNames = [];
    try {
      const bl = (getBacklinks || (() => null))(file);
      if (bl && bl.data && typeof bl.data.size === "number" && bl.data.size > 0) {
        backlinkNames = Array.from(bl.data.keys()).map((p) => String(p || "").split("/").pop() || "").map((n) => stripTitleMarks(stripMdExt(n)));
      }
    } catch (e) {
    }
    let domain = "";
    try {
      if (fm.url) domain = new URL(String(fm.url)).hostname;
    } catch (e) {
    }
    return {
      path: file.path,
      file,
      url: String(fm.url),
      author: fm.author ? String(fm.author) : "",
      site: fm.site ? String(fm.site) : "未知",
      summary: fm.summary ? String(fm.summary) : "",
      tags: Array.isArray(fm.tags) ? fm.tags.map(String) : fm.tags ? [String(fm.tags)] : [],
      title,
      created,
      backlinkNames,
      domain
    };
  }
  async function scanClipDirectory(dirPath, deps) {
    const dir = deps.vault.getAbstractFileByPath(dirPath);
    if (!dir || !Array.isArray(dir.children)) return null;
    const mdFiles = dir.children.filter((f) => f && f.extension === "md");
    const parse = deps.parse || ((f) => parseClipFile(f));
    const notes = [];
    for (const f of mdFiles) {
      try {
        const n = parse(f);
        if (n) notes.push(n);
      } catch (e) {
      }
    }
    notes.sort((a, b) => b.created - a.created);
    return notes;
  }
  var init_scan = __esm({
    "src/clipbook/scan.ts"() {
      init_utils();
      init_app();
    }
  });

  // src/clipbook/loader.ts
  function clipDir() {
    const s = tryGetSettings();
    return (s && s.articleDirectory || "归档/网页剪藏").replace(/\/+$/, "");
  }
  async function readNewsAndSidecar() {
    var _a;
    const res = await readNewsData();
    if (res.missing) {
      M.articles = [];
      M.clipNotes = null;
      M.clipUrls = /* @__PURE__ */ new Set();
      M.sidecar = { articleOverrides: {}, savedArchive: [], order: [] };
      M.upInfo = {};
      return { status: "missing", articles: [], sidecar: M.sidecar, clipNotes: null, clipUrls: M.clipUrls, upInfo: {} };
    }
    if (!res.ok) {
      M.articles = [];
      M.clipNotes = null;
      M.clipUrls = /* @__PURE__ */ new Set();
      M.sidecar = { articleOverrides: {}, savedArchive: [], order: [] };
      M.upInfo = {};
      return { status: "corrupt", articles: [], sidecar: M.sidecar, clipNotes: null, clipUrls: M.clipUrls, upInfo: {} };
    }
    const s = tryGetSettings();
    const days = (_a = normalizeRetentionDays(s == null ? void 0 : s.newsRetentionUnsavedDays)) != null ? _a : 30;
    let data = res.data;
    const cleaned = applyRetention(data.articles, days, days);
    const retentionChanged = cleaned.length !== data.articles.length;
    let removedKeys = [];
    if (retentionChanged) {
      const kept = new Set(cleaned.map((a) => articleKeyOf(a)));
      removedKeys = (data.articles || []).map((a) => articleKeyOf(a)).filter((k) => !kept.has(k));
      data = { ...data, articles: cleaned };
    }
    let statsChanged = false;
    if (!statsHasData(data.stats)) {
      const migrated = await migrateLegacyStats(data);
      if (statsHasData(migrated.stats)) {
        data = migrated;
        statsChanged = true;
      }
    }
    if (retentionChanged || statsChanged) {
      const set = {};
      if (retentionChanged) set.articles = data.articles;
      if (statsChanged) set.stats = data.stats;
      await enqueueNewsWrite(() => writeNewsDataMerged({ set, removeArticleKeys: removedKeys }));
    }
    const sidecar = await readClipbookData();
    const clipNotes = await scanClipDirectory(M.dir || clipDir(), {
      vault: getApp().vault
    });
    const clipUrls = clipUrlSet(clipNotes || []);
    M.articles = data.articles;
    M.stats = data.stats;
    M.sidecar = sidecar;
    M.clipNotes = clipNotes;
    M.clipUrls = clipUrls;
    M.upInfo = data.bilibiliUpInfo || {};
    return { status: "ok", articles: data.articles, sidecar, clipNotes, clipUrls, upInfo: M.upInfo };
  }
  var init_loader = __esm({
    "src/clipbook/loader.ts"() {
      init_news_data();
      init_data();
      init_scan();
      init_store();
      init_constants();
      init_settings_provider();
      init_app();
      init_state();
      init_write_queue();
    }
  });

  // src/clipbook/ui.ts
  var ui_exports = {};
  __export(ui_exports, {
    clipbookSettingsSchema: () => clipbookSettingsSchema,
    closePanel: () => closePanel,
    initPanel: () => initPanel,
    invalidateClipBodyCache: () => invalidateClipBodyCache,
    openSettings: () => openSettings,
    reloadIfOpen: () => reloadIfOpen,
    revealClipArticle: () => revealClipArticle,
    showPanel: () => showPanel,
    unloadPanel: () => unloadPanel
  });
  function initPanel(app, showNow = false) {
    M.appRef = app;
    M.dir = clipDir();
    M.isMobile = typeof window.Platform !== "undefined" && !!window.Platform.isMobile || navigator && navigator.maxTouchPoints > 0 && (window.innerWidth || 0) <= 768;
    if (!overlayEl) buildDom(app);
    if (showNow) showPanel();
    else void loadIfNeeded();
  }
  function showPanel() {
    if (!overlayEl) {
      buildDom(M.appRef);
    }
    overlayEl.style.display = "flex";
    panelSplit == null ? void 0 : panelSplit.restore();
    M.open = true;
    beginSession();
    if (dirty || !loaded) void loadIfNeeded();
    else renderAll();
  }
  function loadIfNeeded() {
    if (loading) return loadPromise || Promise.resolve();
    if (!M.open && overlayEl) return Promise.resolve();
    loading = true;
    loadPromise = readNewsAndSidecar().then(() => {
      dirty = false;
      loaded = true;
      beginSession();
      renderAll();
    }).catch((e) => {
      console.error("[剪藏本] 装载失败", e);
      notice("剪藏本数据读取失败", "error");
    }).finally(() => {
      loading = false;
      loadPromise = null;
    });
    return loadPromise;
  }
  function reloadIfOpen() {
    dirty = true;
    if (!M.open) return;
    void loadIfNeeded();
  }
  async function revealClipArticle(notePath) {
    const p = String(notePath || "");
    if (!p) return;
    selectSource({ kind: "clip" });
    showPanel();
    if (loading && loadPromise) {
      try {
        await loadPromise;
      } catch (e) {
      }
    }
    const a = currentList().find((x) => x.id === "clip:" + p);
    if (a) selectArticle(a.id);
  }
  function closePanel() {
    pauseReadingSession();
    panelResizeDetach == null ? void 0 : panelResizeDetach.flush();
    panelSplit == null ? void 0 : panelSplit.flush();
    M.open = false;
    M.mobDetailOpen = false;
    if (overlayEl) overlayEl.style.display = "none";
  }
  function unloadPanel() {
    pauseReadingSession();
    closeItemMenu();
    if (escHandle) {
      try {
        escHandle.unregister();
      } catch (e) {
      }
      escHandle = null;
    }
    if (searchDebounceTimer !== null) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }
    if (panelResizeDetach) {
      panelResizeDetach.detach();
      panelResizeDetach = null;
    }
    if (panelSplit) {
      panelSplit.detach();
      panelSplit = null;
    }
    clipBodyCache.clear();
    setSearchKw("");
    M.open = false;
    M.mobDetailOpen = false;
    loading = false;
    loadPromise = null;
    dirty = false;
    loaded = false;
    if (overlayEl) overlayEl.remove();
    overlayEl = null;
    readerEl = null;
    readPaneEl = null;
    railListEl = null;
    railFootEl = null;
    listEl = null;
    mobListEl = null;
    mobDetailEl = null;
    mobSearchbarEl = null;
    deskSearchEl = null;
    expandedMobArch.clear();
    mobItemById = /* @__PURE__ */ new Map();
    mobItemOrder = [];
    resetClipbookState();
  }
  function buildDom(app) {
    overlayEl = document.createElement("div");
    overlayEl.className = "bz-panel-overlay";
    overlayEl.style.display = "none";
    overlayEl.innerHTML = panelHtml();
    mountIcons(overlayEl);
    document.body.appendChild(overlayEl);
    railListEl = overlayEl.querySelector("[data-clip-rail]");
    railFootEl = overlayEl.querySelector("[data-clip-rail-foot]");
    listEl = overlayEl.querySelector("[data-clip-list]");
    readerEl = overlayEl.querySelector("[data-clip-reader]");
    readPaneEl = overlayEl.querySelector("[data-clip-read-pane]");
    mobListEl = overlayEl.querySelector("[data-clip-mob-list]");
    mobDetailEl = overlayEl.querySelector("[data-clip-mob-detail]");
    mobTitleEl = overlayEl.querySelector("[data-clip-mob-title]");
    mobSaveBtnEl = overlayEl.querySelector("[data-clip-mob-save]");
    const mobSearchBtn = overlayEl.querySelector("[data-clip-mob-search]");
    const mobCloseBtn = overlayEl.querySelector("[data-clip-mob-close]");
    const mobBackBtn = overlayEl.querySelector("[data-clip-mob-back]");
    mobSearchbarEl = overlayEl.querySelector("[data-clip-mob-searchbar]");
    const mobSearchbar = mobSearchbarEl;
    const mobInput = overlayEl.querySelector("[data-clip-mob-input]");
    deskSearchEl = overlayEl.querySelector("[data-clip-desk-search]");
    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) closePanel();
    });
    railListEl.addEventListener("click", (e) => {
      const row = e.target.closest("[data-src]");
      if (!row) return;
      toggleSource(JSON.parse(row.dataset.src || "null"));
    });
    deskSearchEl.addEventListener("input", () => {
      if (searchDebounceTimer !== null) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchDebounceTimer = null;
        setSearchKw(deskSearchEl ? deskSearchEl.value.trim() : "");
        renderList();
        renderRail();
      }, SEARCH_DEBOUNCE_MS);
    });
    readPaneEl.addEventListener("click", (e) => {
      const t = e.target;
      const ext = t.closest("a[data-clip-ext]");
      if (ext) {
        e.preventDefault();
        try {
          window.open(ext.href, "_blank");
        } catch (e2) {
        }
        return;
      }
      if (t.closest("[data-clip-open-note]") && M.cur) openNote(M.cur);
    });
    readPaneEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        stepArticle(-1);
      } else if (e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        stepArticle(1);
      }
    });
    mobSearchBtn.addEventListener("click", () => {
      const show = mobSearchbarEl.style.display === "none";
      mobSearchbarEl.style.display = show ? "block" : "none";
      if (show) mobInput.focus();
      else {
        mobInput.value = "";
        setSearchKw("");
        renderMobToc();
      }
    });
    mobInput.addEventListener("input", () => {
      searchKw = mobInput.value.trim();
      renderMobToc();
    });
    mobCloseBtn.addEventListener("click", () => {
      const barOpen = mobSearchbarEl ? mobSearchbarEl.style.display === "block" : false;
      if (searchKw || barOpen || expandedMobArch.size) {
        searchKw = "";
        expandedMobArch.clear();
        if (mobInput) mobInput.value = "";
        if (mobSearchbarEl) mobSearchbarEl.style.display = "none";
        renderMobToc();
      } else {
        closePanel();
      }
    });
    mobBackBtn.addEventListener("click", () => {
      M.mobDetailOpen = false;
      mobDetailEl.style.display = "none";
      renderAll();
    });
    mobSaveBtnEl.addEventListener("click", () => {
      void doSave(M.cur);
    });
    mobDetailEl.addEventListener("click", (e) => {
      const t = e.target;
      const ext = t.closest("a[data-clip-ext]");
      if (ext) {
        e.preventDefault();
        try {
          window.open(ext.href, "_blank");
        } catch (e2) {
        }
        return;
      }
      if (!t.closest("[data-clip-mob-next]") || !M.cur) return;
      const grp = mobItemOrder.filter((x) => x.srcName === M.cur.srcName);
      const idx = grp.findIndex((x) => x.id === M.cur.id);
      const next = grp[idx + 1];
      if (next) openMobDetail(next.id);
      else mobBackBtn.click();
    });
    escKey = "bz-clipbook";
    escHandle = escManager.register(escKey, {
      isVisible: () => !!overlayEl && overlayEl.style.display !== "none",
      close: () => closePanel()
    });
    const frameEl = overlayEl.querySelector(".bz-clip-frame");
    if (!isMobileEnv()) {
      panelResizeDetach = uiResizable(frameEl, {
        minW: PANEL_MIN_W,
        minH: PANEL_MIN_H,
        maxW: PANEL_MAX_W,
        maxH: PANEL_MAX_H,
        persist: { load: savedPanelSize, save: rememberPanelSize }
      });
      const midEl = overlayEl.querySelector(".bz-clip-mid");
      const readEl = overlayEl.querySelector(".bz-clip-read");
      panelSplit = uiVSplitter({
        left: midEl,
        right: readEl,
        minLeft: SPLIT_MIN_MID,
        minRight: SPLIT_MIN_READ,
        persist: { load: savedSplitWidth, save: rememberSplitWidth }
      });
      midEl.insertAdjacentElement("afterend", panelSplit.el);
    }
    mobListEl.addEventListener("click", (e) => {
      const fold = e.target.closest("[data-fold]");
      if (fold) {
        toggleMobArch(fold);
        return;
      }
      const item = e.target.closest("[data-id]");
      if (!item) return;
      openMobDetail(item.dataset.id || "");
    });
  }
  function selectSource(src) {
    M.sel = {
      kind: src.kind,
      platform: String(src.platform || ""),
      up: src.up ? String(src.up) : null,
      site: String(src.site || "")
    };
    M.mobDetailOpen = false;
    setSearchKw("");
    if (deskSearchEl) deskSearchEl.value = "";
    renderAll();
  }
  function toggleSource(src) {
    const same = src && src.kind !== "all" && src.kind === M.sel.kind && String(src.platform || "") === M.sel.platform && (src.up ? String(src.up) : null) === M.sel.up && String(src.site || "") === M.sel.site;
    selectSource(same ? { kind: "all" } : src);
  }
  function setSearchKw(kw) {
    searchKw = kw;
  }
  function renderAll() {
    if (!M.open) return;
    renderHeadIssue();
    renderRail();
    renderList();
    renderReader();
    renderMobToc();
    if (M.mobDetailOpen && M.cur) {
      renderMobDetail();
    }
  }
  function renderHeadIssue() {
    const el = overlayEl ? overlayEl.querySelector("[data-clip-issue]") : null;
    if (!el) return;
    const d = /* @__PURE__ */ new Date();
    el.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 第 ${M.articles.length} 期`;
  }
  function currentSrc() {
    const s = M.sel;
    if (s.kind === "clip") return { kind: "clip" };
    if (s.kind === "site") return { kind: "site", site: s.site };
    if (s.kind === "inbox") return { kind: "inbox", platform: s.platform, up: s.up || void 0 };
    return { kind: "all" };
  }
  function currentList() {
    return queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], currentSrc(), M.upInfo);
  }
  function epochReset() {
    dirEpoch++;
    snapEpochs.clear();
  }
  function srcKey(src) {
    if (src.kind === "all") return "all";
    if (src.kind === "clip") return "clip";
    if (src.kind === "site") return "site:" + src.site;
    return `inbox:${src.platform}:${src.up || ""}`;
  }
  function snapDirFor(src) {
    const key = srcKey(src);
    const cur = dirSnap.get(key);
    if (cur && snapEpochs.get(key) === dirEpoch) return cur;
    const b = bucketByState(queryBySourceFull(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], src, M.upInfo));
    const snap = { unread: b.unread.map((a) => a.id), read: b.read.map((a) => a.id), saved: b.saved.map((a) => a.id) };
    dirSnap.set(key, snap);
    snapEpochs.set(key, dirEpoch);
    return snap;
  }
  function resolveSnap(snap, src) {
    const live2 = /* @__PURE__ */ new Map();
    for (const a of queryBySourceFull(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], src, M.upInfo)) live2.set(a.id, a);
    const pick = (ids) => ids.map((id) => live2.get(id)).filter((a) => !!a);
    return { unread: pick(snap.unread), read: pick(snap.read), saved: pick(snap.saved) };
  }
  function dirFor(src) {
    return resolveSnap(snapDirFor(src), src);
  }
  function deskFlat() {
    const b = dirFor(currentSrc());
    return [...b.unread, ...b.read, ...b.saved];
  }
  function deskFoldIsOpen(kind, n, savedN, snapUnreadN) {
    const key = srcKey(currentSrc()) + "#" + kind;
    if (deskFoldTouched.has(key)) return deskFoldOpen.has(key);
    if (snapUnreadN > 0 || n <= 0) return false;
    if (kind === "saved") return true;
    return savedN <= 0;
  }
  function toggleDeskFold(kind) {
    const key = srcKey(currentSrc()) + "#" + kind;
    deskFoldTouched.add(key);
    if (deskFoldOpen.has(key)) deskFoldOpen.delete(key);
    else deskFoldOpen.add(key);
    renderList();
  }
  function beginSession() {
    epochReset();
    deskFoldOpen.clear();
    deskFoldTouched.clear();
  }
  function matchesSearch(a) {
    const kw = (searchKw || "").toLowerCase();
    if (!kw) return true;
    return a.title.toLowerCase().includes(kw) || a.summary.toLowerCase().includes(kw) || a.site.toLowerCase().includes(kw) || a.srcName.toLowerCase().includes(kw) || a.author.toLowerCase().includes(kw) || a.tags.some((t) => t.toLowerCase().includes(kw));
  }
  function renderRail() {
    var _a, _b, _c, _d;
    if (!railListEl) return;
    const arts = M.articles;
    const clipNotes = M.clipNotes || [];
    const countOf = (source) => queryBySource(arts, M.sidecar, M.clipUrls, clipNotes, source, M.upInfo).filter(matchesSearch).length;
    const allHit = countOf({ kind: "all" });
    let html = railItemHtml({ kind: "all" }, "全部未读", allHit, arts.length, "inbox", "#58a6ff", M.sel.kind === "all", "");
    for (const row of aggregateSites(arts, clipNotes, new Set((M.sidecar.savedArchive || []).map((x) => x.url)), M.clipUrls)) {
      const full = queryBySource(arts, M.sidecar, M.clipUrls, clipNotes, { kind: "site", site: row.site }, M.upInfo);
      const unreadN = full.filter((a) => a.st !== "saved").length;
      const hit = countOf({ kind: "site", site: row.site });
      const active = M.sel.kind === "site" && M.sel.site === row.site;
      html += railItemHtml({ kind: "site", site: row.site }, row.site, searchKw ? hit : unreadN, full.length, "feed", siteTint(row.site), active, "");
    }
    const biliUps = /* @__PURE__ */ new Map();
    for (const a of arts) {
      if (!a.read && a.platform === "B站" && a.author) {
        const uid = String(a.author);
        const backfilled = (_b = (_a = M.upInfo) == null ? void 0 : _a[uid]) == null ? void 0 : _b.name;
        if (!biliUps.has(uid)) biliUps.set(uid, backfilled ? String(backfilled) : uid);
      }
    }
    for (const [uid, name] of biliUps) {
      const cnt = countOf({ kind: "inbox", platform: "B站", up: uid });
      const upTotal = arts.filter((a) => a.platform === "B站" && String(a.author || "") === uid).length;
      const active = M.sel.kind === "inbox" && M.sel.platform === "B站" && M.sel.up === uid;
      html += railItemHtml({ kind: "inbox", platform: "B站", up: uid }, name, cnt, upTotal, "bili", "", active, name.slice(0, 1));
    }
    const clipActive = M.sel.kind === "clip";
    const clipHit = countOf({ kind: "clip" });
    html += railItemHtml({ kind: "clip" }, "剪藏本", clipHit, clipNotes.length, "clip", "", clipActive, "");
    railListEl.innerHTML = html;
    mountIcons(railListEl);
    if (railFootEl) {
      railFootEl.innerHTML = railFootHtml(((_d = (_c = M.stats) == null ? void 0 : _c.byDate) == null ? void 0 : _d[localDayKey()]) || 0);
    }
    const rows = railListEl.querySelectorAll("[data-src]");
    rows.forEach((row) => {
      let sel = null;
      try {
        sel = JSON.parse(row.dataset.src || "null");
      } catch (e) {
        return;
      }
      if (!sel) return;
      const source = sel.kind === "clip" ? { kind: "clip" } : sel.kind === "inbox" ? { kind: "inbox", platform: String(sel.platform || ""), up: sel.up ? String(sel.up) : void 0 } : { kind: "all" };
      const actions = buildRailActions(String(row.title || ""), source);
      if (actions.length) attachItemActions(row, actions, { sheetTitle: String(row.title || ""), menuClass: "bz-clip-menu-editorial" });
    });
  }
  function buildRailActions(label, source) {
    const unreadList = queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], source, M.upInfo).filter((a) => a.origin === "news");
    if (!unreadList.length) return [];
    const n = unreadList.length;
    return [{
      icon: "check",
      label: `全部标为已读（${n} 篇）`,
      title: `把「${label}」的 ${n} 篇未读标为已读`,
      onClick: () => void markAllRead(label, unreadList)
    }];
  }
  async function markAllRead(label, items) {
    const ok = await openFlowDialog({
      className: "bz-clip-dialog-editorial",
      title: "全部标为已读",
      message: `将把「${label}」的 ${items.length} 篇未读全部标为已读。`,
      actions: [
        { label: "取消", value: "cancel" },
        { label: `全部已读（${items.length} 篇）`, value: "ok", cta: true }
      ]
    });
    if (ok !== "ok") return;
    await flowMarkAllRead(items.map((a) => a.raw).filter(Boolean));
    notice(`已把 ${items.length} 篇标为已读`, "success");
    await refreshAfterAction();
  }
  function renderList() {
    if (!listEl) return;
    const src = currentSrc();
    if (src.kind === "clip") {
      const list = queryBySource(M.articles, M.sidecar, M.clipUrls, M.clipNotes || [], src, M.upInfo).filter((a) => !searchKw || matchesSearch(a));
      if (!list.length) {
        listEl.innerHTML = "";
        listEl.appendChild(uiEmpty({ icon: "scissors", title: "剪藏本为空" }));
        M.cur = null;
        if (readerEl) renderReader();
        return;
      }
      if (!list.some((a) => a.id === (M.cur && M.cur.id))) {
        M.cur = list[0];
        if (readerEl) renderReader();
      }
      listEl.innerHTML = tocListHtml(list, M.cur ? M.cur.id : null, (a) => relTime(a.timeTs));
      M.list = list;
      bindItemMenus();
      return;
    }
    const flat = deskFlat();
    if (!flat.length) {
      listEl.innerHTML = "";
      listEl.appendChild(uiEmpty({ icon: "inbox", title: "这个源暂无内容" }));
      M.cur = null;
      if (readerEl) renderReader();
      return;
    }
    if (!flat.some((a) => a.id === (M.cur && M.cur.id))) {
      M.cur = flat[0];
    }
    const timeOf = (a) => relTime(a.timeTs);
    const curId = M.cur ? M.cur.id : null;
    if (searchKw) {
      const hit = flat.filter(matchesSearch);
      if (!hit.length) {
        listEl.innerHTML = "";
        listEl.appendChild(uiEmpty({ icon: "search-x", title: "查无此条" }));
        M.cur = null;
        if (readerEl) renderReader();
        M.list = [];
        return;
      }
      listEl.innerHTML = tocListHtml(hit, curId, timeOf);
      M.list = hit;
      bindItemMenus();
      return;
    }
    const b = dirFor(src);
    const snapUnreadN = b.unread.length;
    let html = tocListHtml(b.unread, curId, timeOf);
    if (b.read.length) {
      const open = deskFoldIsOpen("read", b.read.length, b.saved.length, snapUnreadN);
      html += deskFoldRowHtml("read", b.read.length, open);
      html += foldBodyHtml(tocListHtml(b.read, curId, timeOf), open);
    }
    if (b.saved.length) {
      const open = deskFoldIsOpen("saved", b.saved.length, b.saved.length, snapUnreadN);
      html += deskFoldRowHtml("saved", b.saved.length, open);
      html += foldBodyHtml(tocListHtml(b.saved, curId, timeOf), open);
    }
    listEl.innerHTML = html;
    M.list = flat;
    bindItemMenus();
  }
  function relTime(ts) {
    if (!ts) return "";
    try {
      return formatRelativeTime(new Date(ts));
    } catch (e) {
      return "";
    }
  }
  function bindItemMenus() {
    if (!listEl) return;
    const all = M.list;
    const cards = listEl.querySelectorAll(".bz-clip-item");
    cards.forEach((card) => {
      const art = all.find((x) => x.id === card.dataset.id) || M.cur;
      if (!art || art.id !== card.dataset.id) return;
      const actions = buildItemActions(art);
      attachItemActions(card, actions, { sheetHead: buildSheetHead(art), menuClass: "bz-clip-menu-editorial" });
      card.addEventListener("click", (e) => {
        if (e.target && e.target.closest(".bz-item-sheet")) return;
        selectArticle(art.id);
      });
    });
    listEl.querySelectorAll("[data-desk-fold]").forEach((row) => {
      row.addEventListener("click", () => {
        const kind = row.getAttribute("data-desk-fold") || "saved";
        toggleDeskFold(kind);
      });
    });
  }
  function buildSheetHead(a) {
    const head = document.createElement("div");
    head.className = "bz-clip-sheet-head";
    const t = document.createElement("div");
    t.className = "bz-clip-sheet-title";
    t.textContent = a.title;
    const s = document.createElement("div");
    s.className = "bz-clip-sheet-sum";
    s.textContent = a.summary || "";
    head.appendChild(t);
    head.appendChild(s);
    return head;
  }
  function buildItemActions(a) {
    const out = [];
    if (a.origin === "clip") {
      out.push(
        { icon: "external-link", label: "打开笔记", title: "打开剪藏笔记", onClick: () => openNote(a) },
        { icon: "link", label: "复制双链", title: "复制双链引用", onClick: () => void copyText(`[[${a.notePath}|${a.title}]]`, "双链已复制") },
        { icon: "globe", label: "复制原文链接", sub: a.domain || void 0, onClick: () => void copyText(a.url, "原文链接已复制") }
      );
      if (a.note && a.note.file) {
        out.push({
          icon: "sparkles",
          label: "重新生成摘要",
          title: "AI 重新生成该剪藏的摘要与标签，不改动已有标题",
          onClick: () => {
            void regenerateSummary(getApp(), a.note.file);
          }
        });
        out.push({ icon: "trash-2", label: "删除", kind: "danger", title: "删除剪藏笔记", onClick: () => deleteClipNote(a) });
      }
      return out;
    }
    if (a.st !== "saved") {
      out.push({ icon: "download", label: "保存到剪藏本", title: "保存为正式剪藏", onClick: () => void doSave(a) });
    }
    out.push({ icon: "check", label: "标记为已读", title: "不再出现在收件流", onClick: () => void doMarkRead(a) });
    out.push({ icon: "trash-2", label: "删除", kind: "danger", title: "从收件流删除", onClick: () => deleteNewsItem(a) });
    return out;
  }
  async function hydrateArticleMarkdown(el, md, sourcePath, alive) {
    var _a;
    try {
      const comp = new Component();
      await MarkdownRenderer.render(getApp(), md, el, sourcePath, comp);
      comp.unload();
    } catch (e) {
    }
    if (!alive()) return;
    if (!el.querySelector("*") || !((_a = el.textContent) == null ? void 0 : _a.trim())) el.textContent = md;
  }
  function bindImgFallback(container) {
    container.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => img.remove(), { once: true });
    });
  }
  function renderReader() {
    if (!readerEl) return;
    const a = M.cur;
    applyReaderFontSize();
    if (!a) {
      readerEl.innerHTML = "";
      readerEl.appendChild(uiEmpty({ icon: "book-open", title: "从列表选择一篇文章开始阅读" }));
      return;
    }
    setReadingSession(a.id);
    let body = "";
    let note = "";
    if (a.origin === "clip") {
      const cached = a.notePath ? clipBodyCache.get(a.notePath) : void 0;
      if (cached !== void 0) {
        body = cached;
        if (!body) note = "（笔记暂无正文）";
      } else {
        note = "正在读取剪藏正文…";
      }
    } else {
      body = a.body;
      if (!body) note = "正文已清空（已处理条目）";
    }
    readerEl.innerHTML = readerHtml(a, { time: a.timeText || relTime(a.timeTs), note });
    mountIcons(readerEl);
    bindImgFallback(readerEl);
    const mdEl = readerEl.querySelector("[data-clip-md]");
    if (mdEl && body) {
      void hydrateArticleMarkdown(mdEl, body, a.notePath || "", () => !!M.cur && M.cur.id === a.id && !!readerEl && readerEl.contains(mdEl));
    }
    if (a.origin === "clip") void loadClipBody(a);
  }
  async function loadClipBody(a) {
    const path = a.notePath;
    if (!path || clipBodyCache.has(path)) return;
    const note = a.note;
    if (!note || !note.file) return;
    let body = "";
    try {
      body = stripClipChrome(await getApp().vault.cachedRead(note.file));
    } catch (e) {
      if (M.cur && M.cur.id === a.id && readerEl) {
        const md = readerEl.querySelector("[data-clip-md]");
        if (md) md.innerHTML = `<p class="dim">正文读取失败，可打开笔记查看</p>`;
      }
      return;
    }
    clipBodyCache.set(path, body);
    if (M.cur && M.cur.id === a.id && readerEl) {
      const md = readerEl.querySelector("[data-clip-md]");
      if (!md) return;
      if (!body) {
        md.innerHTML = `<p class="dim">（笔记暂无正文）</p>`;
        return;
      }
      void hydrateArticleMarkdown(md, body, path, () => !!M.cur && M.cur.id === a.id && !!readerEl && readerEl.contains(md));
    }
  }
  function invalidateClipBodyCache(path) {
    clipBodyCache.delete(String(path || ""));
  }
  function readerFontSize() {
    var _a;
    const v = String(((_a = tryGetSettings()) == null ? void 0 : _a.clipbookReaderFontSize) || "");
    return v === "small" || v === "large" ? v : "medium";
  }
  function applyReaderFontSize() {
    if (!readerEl) return;
    const fs = readerFontSize();
    readerEl.classList.toggle("fs-sm", fs === "small");
    readerEl.classList.toggle("fs-lg", fs === "large");
  }
  function stepArticle(delta) {
    const list = dirFor(currentSrc()).unread;
    if (!list.length) return;
    const idx = M.cur ? list.findIndex((x) => x.id === M.cur.id) : -1;
    const nextIdx = idx === -1 ? 0 : Math.min(list.length - 1, Math.max(0, idx + delta));
    const next = list[nextIdx];
    if (next && (!M.cur || next.id !== M.cur.id)) selectArticle(next.id);
  }
  function resetReadScroll() {
    const sc = readPaneEl ? readPaneEl.querySelector(".bz-clip-read-scroll") : null;
    if (sc) sc.scrollTop = 0;
  }
  function selectArticle(id) {
    const a = deskFlat().find((x) => x.id === id);
    if (!a) return;
    const changed = !M.cur || M.cur.id !== a.id;
    M.cur = a;
    markReadOnOpen(a);
    renderList();
    renderReader();
    renderMobDetail();
    if (changed) resetReadScroll();
  }
  async function doSave(a) {
    if (!a) return;
    if (a.origin !== "news") return;
    const ok = await flowSave(a);
    if (!ok) return;
    await refreshAfterAction();
  }
  async function doMarkRead(a) {
    if (!a || a.origin !== "news") return;
    if (a.st !== "unread") return;
    const rawBefore = { ...a.raw || {} };
    await flowMarkRead(a);
    notifyUndo(`已将「${a.title}」标为已读`, () => void undoMarkRead(rawBefore));
    await refreshAfterAction();
  }
  async function undoMarkRead(rawBefore) {
    await flowUndoHandled(rawBefore);
    notice("已撤销：条目恢复未读", "success");
    await refreshAfterAction();
  }
  async function deleteNewsItem(a) {
    const ok = await openFlowDialog({
      className: "bz-clip-dialog-editorial",
      title: "删除条目",
      message: `确定从收件流删除「${a.title}」吗？删除后可在通知中撤销。`,
      actions: [
        { label: "取消", value: "cancel" },
        { label: "删除", value: "ok", cta: true }
      ]
    });
    if (ok !== "ok") return;
    const rawBefore = { ...a.raw || {} };
    await flowDeleteNews(a);
    notifyUndo(`已删除条目「${a.title}」`, () => void undoDeleteNews(rawBefore));
    await refreshAfterAction();
  }
  async function undoDeleteNews(rawBefore) {
    await flowUndoDeleteNews(rawBefore);
    notice("已撤销删除：条目已恢复", "success");
    await refreshAfterAction();
  }
  async function deleteClipNote(a) {
    const ok = await openFlowDialog({
      className: "bz-clip-dialog-editorial",
      title: "删除剪藏",
      message: `确定删除剪藏「${a.title}」吗？文件将移入系统回收站。`,
      actions: [
        { label: "取消", value: "cancel" },
        { label: "删除", value: "ok", cta: true }
      ]
    });
    if (ok !== "ok") return;
    const note = a.note;
    if (note && note.file) {
      try {
        const path = a.notePath || note.path || "";
        let content = "";
        try {
          content = await getApp().vault.cachedRead(note.file);
        } catch (e) {
        }
        await getApp().vault.trash(note.file, true);
        clipBodyCache.delete(path);
        notifyUndo(`已删除剪藏「${a.title}」（已移入系统回收站）`, () => void undoTrashClip(path, content));
        await refreshAfterAction();
      } catch (e) {
        notice("删除失败，请检查文件权限", "error");
      }
    }
  }
  async function undoTrashClip(path, content) {
    if (!path) return;
    try {
      await getApp().vault.create(path, content);
      clipBodyCache.delete(path);
      notice("已撤销删除：剪藏已恢复", "success");
      await refreshAfterAction();
    } catch (e) {
      notice("撤销失败：原路径已存在同名文件", "error");
    }
  }
  function openNote(a) {
    if (!a.notePath) return;
    getApp().workspace.openLinkText(a.notePath, "", false, { active: true });
    closePanel();
  }
  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      notice(okMsg, "success");
    } catch (e) {
      notice("复制失败", "error");
    }
  }
  async function refreshAfterAction() {
    const prevIdx = M.cur ? deskFlat().findIndex((x) => x.id === M.cur.id) : -1;
    await readNewsAndSidecar();
    const flat = deskFlat();
    if (M.cur && flat.some((x) => x.id === M.cur.id)) {
      M.cur = flat.find((x) => x.id === M.cur.id) || M.cur;
    } else if (flat.length) {
      M.cur = flat[Math.min(Math.max(prevIdx, 0), flat.length - 1)];
    } else {
      M.cur = null;
    }
    renderAll();
  }
  function savedPanelSize() {
    const s = tryGetSettings();
    const w = Number(s == null ? void 0 : s.clipbookPanelWidth) || 0;
    const h = Number(s == null ? void 0 : s.clipbookPanelHeight) || 0;
    if (w < PANEL_MIN_W || h < PANEL_MIN_H) return null;
    return { w, h };
  }
  function rememberPanelSize(w, h) {
    const s = tryGetSettings();
    if (!s) return;
    s.clipbookPanelWidth = w;
    s.clipbookPanelHeight = h;
    void saveSettings();
  }
  function savedSplitWidth() {
    var _a;
    const v = Number((_a = tryGetSettings()) == null ? void 0 : _a.clipbookMidWidth) || 0;
    return v > 0 ? v : null;
  }
  function rememberSplitWidth(w) {
    const s = tryGetSettings();
    if (!s) return;
    s.clipbookMidWidth = w;
    void saveSettings();
  }
  function renderMobToc() {
    if (!mobListEl) return;
    const arts = M.articles;
    const clipNotes = M.clipNotes || [];
    const savedUrls = new Set((M.sidecar.savedArchive || []).map((x) => x.url));
    const searching = !!searchKw;
    const timeOf = (a) => relTime(a.timeTs);
    const chapters = [];
    const byId = /* @__PURE__ */ new Map();
    const order = [];
    const siteSet = /* @__PURE__ */ new Set();
    for (const a of arts) {
      const s = String(a && (a.site || a.platform) || "").trim() || "未知";
      siteSet.add(s);
    }
    for (const n of clipNotes || []) {
      const s = String(n && n.site || "").trim() || "未知";
      siteSet.add(s);
    }
    for (const site of siteSet) {
      const snap = snapDirFor({ kind: "site", site });
      const b = resolveSnap(snap, { kind: "site", site });
      const unread = b.unread.filter(matchesSearch);
      const read = b.read.filter(matchesSearch);
      const saved = b.saved.filter(matchesSearch);
      if (!unread.length && !read.length && !saved.length) continue;
      const unreadN = unread.filter((a) => a.st === "unread").length;
      chapters.push({
        site,
        unread: unreadN,
        activeN: unread.length,
        readN: read.length,
        savedN: saved.length,
        activeHtml: mobListHtml(unread, timeOf),
        readHtml: read.length ? mobListHtml(read, timeOf) : "",
        savedHtml: saved.length ? mobListHtml(saved, timeOf) : ""
      });
      [...unread, ...read, ...saved].forEach((a) => {
        byId.set(a.id, a);
        order.push(a);
      });
    }
    chapters.sort((x, y) => y.activeN + y.readN + y.savedN - (x.activeN + x.readN + x.savedN) || y.unread - x.unread || cmpZh(x.site, y.site));
    mobItemById = byId;
    mobItemOrder = order;
    if (!chapters.length) {
      mobListEl.innerHTML = mobNoHitHtml(searching ? "查无此条" : "暂无剪藏内容");
      return;
    }
    mobListEl.innerHTML = mobTocHtml(chapters, searching, expandedMobArch);
    mobListEl.querySelectorAll("[data-id]").forEach((card) => {
      const art = byId.get(String(card.dataset.id || ""));
      if (!art) return;
      attachItemActions(card, buildItemActions(art), { sheetHead: buildSheetHead(art) });
    });
    mobListEl.querySelectorAll(".bz-clip-mob-ch-hd").forEach((hd) => {
      let sel = null;
      try {
        sel = JSON.parse(hd.dataset.src || "null");
      } catch (e) {
        return;
      }
      if (!sel || sel.kind !== "site") return;
      const actions = buildRailActions(String(sel.site), { kind: "site", site: String(sel.site) });
      if (actions.length) attachItemActions(hd, actions, { sheetTitle: String(sel.site), menuClass: "bz-clip-menu-editorial" });
    });
  }
  function toggleMobArch(foldEl) {
    const ch = foldEl.closest(".bz-clip-mob-ch");
    const hd = ch ? ch.querySelector("[data-src]") : null;
    let site = "";
    if (hd) {
      try {
        site = String(JSON.parse(hd.dataset.src || "null").site || "");
      } catch (e) {
        site = "";
      }
    }
    const kind = foldEl.getAttribute("data-fold-kind") || "saved";
    const key = `${kind}:${site}`;
    const arch = ch ? ch.querySelector(`[data-arch-kind="${kind}"]`) : null;
    const opening = !!arch && arch.hidden;
    if (arch) arch.hidden = !opening;
    foldEl.classList.toggle("on", opening);
    foldEl.setAttribute("aria-expanded", String(opening));
    const lab = foldEl.querySelector(".bz-clip-mob-fold-lab");
    if (lab) {
      const n = arch ? arch.childElementCount : 0;
      const label = kind === "read" ? "已读" : "已收";
      lab.innerHTML = opening ? "收起" : `${label} <b>${n}</b> 篇`;
    }
    if (site) {
      if (opening) expandedMobArch.add(key);
      else expandedMobArch.delete(key);
    }
  }
  function openMobDetail(id) {
    let a = currentList().find((x) => x.id === id);
    if (!a) a = mobItemById.get(id);
    if (!a) return;
    M.cur = a;
    M.mobDetailOpen = true;
    renderMobDetail();
    if (mobDetailEl) mobDetailEl.style.display = "flex";
    const body = mobDetailEl ? mobDetailEl.querySelector("[data-clip-mob-detail-body]") : null;
    if (body) body.scrollTop = 0;
    markReadOnOpen(a);
  }
  function markReadOnOpen(a) {
    if (!a || a.st !== "unread") return;
    if (a.origin !== "news") return;
    const raw = a.raw || M.articles.find((n) => articleKeyOf(n) === a.id);
    if (!raw || raw.read === true) return;
    raw.read = true;
    void flowMarkRead(a).then(() => {
      if (M.open && !M.mobDetailOpen) {
        renderList();
        renderRail();
      }
    }).catch(() => {
    });
  }
  function renderMobDetail() {
    if (!mobDetailEl || !M.cur) return;
    const a = M.cur;
    if (mobTitleEl) mobTitleEl.textContent = `${a.srcName} · 目录`;
    if (mobSaveBtnEl) {
      const saved = a.st === "saved";
      mobSaveBtnEl.style.display = a.origin !== "news" ? "none" : "";
      mobSaveBtnEl.classList.toggle("saved", saved);
      mobSaveBtnEl.textContent = saved ? "已存" : "存为剪藏";
    }
    const mdBody = a.origin === "news" ? a.body : "";
    const note = mdBody ? "" : a.origin === "clip" ? "剪藏笔记正文请在 Obsidian 中打开" : "正文已清空";
    const idx = mobItemOrder.indexOf(a);
    const seq = idx >= 0 ? `第 ${idx + 1} 则 / ${mobItemOrder.length}` : "";
    const detailBody = mobDetailEl.querySelector("[data-clip-mob-detail-body]");
    detailBody.innerHTML = mobDetailHtml(a, { time: a.timeText || relTime(a.timeTs), note, seq });
    mountIcons(detailBody);
    bindImgFallback(detailBody);
    const mdEl = detailBody.querySelector("[data-clip-mob-md]");
    if (mdEl && mdBody) {
      void hydrateArticleMarkdown(mdEl, mdBody, a.notePath || "", () => M.mobDetailOpen && !!M.cur && M.cur.id === a.id && !!mobDetailEl && mobDetailEl.contains(mdEl));
    }
  }
  function clipbookSettingsSchema(dataSource) {
    return {
      groups: [
        {
          // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
          icon: "palette",
          name: "外观",
          rows: [
            { type: "choiceCards", name: "面板布局", binding: { key: "clipbookSkin" }, options: [{ value: "default", label: "编辑部", prevClass: "bz-sp-prev-panel" }] },
            { type: "choiceCards", name: "面板主题", binding: { key: "clipbookSkinTheme" }, layoutKey: "clipbookSkin", options: [{ value: "newsprint", label: "新闻纸", layout: "default", prevClass: "bz-sp-prev-newsprint" }] }
          ]
        },
        {
          icon: "folder-open",
          name: "基础",
          rows: [
            { type: "select", name: "阅读字号", desc: "桌面阅读面正文字号", binding: { key: "clipbookReaderFontSize" }, options: [
              { value: "small", label: "小" },
              { value: "medium", label: "中" },
              { value: "large", label: "大" }
            ], onChange: () => applyReaderFontSize() },
            { type: "path", mode: "single", name: "剪藏目录", desc: "存放网页剪藏文章的文件夹", binding: { key: "articleDirectory" } },
            { type: "number", name: "面板宽度记忆", desc: "桌面拖拽面板边缘缩放后自动记忆，0 为未拖过", binding: { key: "clipbookPanelWidth" }, min: 0, step: 10 },
            { type: "number", name: "面板高度记忆", desc: "桌面拖拽面板边缘缩放后自动记忆，0 为未拖过", binding: { key: "clipbookPanelHeight" }, min: 0, step: 10 },
            { type: "number", name: "目录栏宽度记忆", desc: "拖动目录与阅读分隔线后自动记忆，0 为未拖过", binding: { key: "clipbookMidWidth" }, min: 0, step: 10 }
          ]
        },
        {
          icon: "sparkles",
          name: "智能",
          rows: [
            {
              type: "toggle",
              name: "自动摘要",
              desc: "新剪藏的文章自动生成 AI 摘要",
              binding: { key: "autoSummaryEnabled" },
              onChange: (v) => {
                if (v) ensureAutoSummary(getApp());
                else stopAutoSummary();
              }
            },
            { type: "select", name: "摘要长度", desc: "控制生成的摘要详略程度", binding: { key: "autoSummaryLength" }, options: [
              { value: "simple", label: "简短（50-100 字）" },
              { value: "standard", label: "标准（150-250 字）" },
              { value: "detailed", label: "详细（300-400 字）" }
            ], visibleWhen: (s) => s.autoSummaryEnabled === true, isChild: true },
            { type: "toggle", name: "生成标签", desc: "为剪藏生成中文标签", binding: { key: "autoSummaryTagsEnabled" }, visibleWhen: (s) => s.autoSummaryEnabled === true, isChild: true },
            { type: "text", name: "标签数量", desc: "生成的标签个数写成区间，如 3-6", binding: { key: "autoSummaryTagCount" }, visibleWhen: (s) => s.autoSummaryEnabled === true && s.autoSummaryTagsEnabled === true, isChild: true },
            {
              type: "select",
              name: "摘要时机",
              desc: "保存后立刻生成，或仅打开文件时才补全",
              binding: { key: "autoSummaryTiming" },
              options: [
                { value: "immediate", label: "保存后立刻" },
                { value: "lazy", label: "懒触发（打开时）" }
              ],
              visibleWhen: (s) => s.autoSummaryEnabled === true,
              isChild: true,
              // 时机变更即时生效：重注册监听（lazy↔immediate 切换无需重启；对齐上方自动摘要开关）
              onChange: () => {
                stopAutoSummary();
                ensureAutoSummary(getApp());
              }
            }
          ]
        },
        {
          icon: "radio",
          name: "数据源",
          rows: dataSourceGroupRows(dataSource)
        }
      ]
    };
  }
  async function openSettings(app) {
    const dataSource = await readDataSourceState();
    const schema = clipbookSettingsSchema(dataSource);
    openSettingsModal({
      title: "剪藏本设置",
      maxWidth: 560,
      schema,
      onClose: () => {
        const s = tryGetSettings();
        const next = (s && s.articleDirectory || "归档/网页剪藏").replace(/\/+$/, "");
        if (next !== M.dir) {
          M.dir = next;
          M.clipNotes = null;
          M.clipUrls = /* @__PURE__ */ new Set();
          void reloadIfOpen();
        }
      }
    });
  }
  var overlayEl, railListEl, railFootEl, listEl, readerEl, readPaneEl, mobListEl, mobDetailEl, mobTitleEl, mobSaveBtnEl, mobSearchbarEl, deskSearchEl, escKey, escHandle, loading, dirty, loaded, SEARCH_DEBOUNCE_MS, PANEL_MIN_W, PANEL_MIN_H, PANEL_MAX_W, PANEL_MAX_H, clipBodyCache, searchDebounceTimer, panelResizeDetach, panelSplit, SPLIT_MIN_MID, SPLIT_MIN_READ, loadPromise, searchKw, expandedMobArch, mobItemById, mobItemOrder, dirEpoch, dirSnap, snapEpochs, deskFoldOpen, deskFoldTouched;
  var init_ui3 = __esm({
    "src/clipbook/ui.ts"() {
      init_fake_obsidian();
      init_app();
      init_notice();
      init_ui2();
      init_utils();
      init_mobile();
      init_esc_manager();
      init_item_actions();
      init_flow_dialog();
      init_settings_modal();
      init_settings_provider();
      init_auto_summary();
      init_news_sources_group();
      init_constants();
      init_news_source_settings();
      init_md();
      init_store();
      init_render();
      init_state();
      init_loader();
      init_flow();
      overlayEl = null;
      railListEl = null;
      railFootEl = null;
      listEl = null;
      readerEl = null;
      readPaneEl = null;
      mobListEl = null;
      mobDetailEl = null;
      mobTitleEl = null;
      mobSaveBtnEl = null;
      mobSearchbarEl = null;
      deskSearchEl = null;
      escKey = "";
      escHandle = null;
      loading = false;
      dirty = false;
      loaded = false;
      SEARCH_DEBOUNCE_MS = 180;
      PANEL_MIN_W = 760;
      PANEL_MIN_H = 520;
      PANEL_MAX_W = 1600;
      PANEL_MAX_H = 1e3;
      clipBodyCache = /* @__PURE__ */ new Map();
      searchDebounceTimer = null;
      panelResizeDetach = null;
      panelSplit = null;
      SPLIT_MIN_MID = 220;
      SPLIT_MIN_READ = 320;
      loadPromise = null;
      searchKw = "";
      expandedMobArch = /* @__PURE__ */ new Set();
      mobItemById = /* @__PURE__ */ new Map();
      mobItemOrder = [];
      dirEpoch = 0;
      dirSnap = /* @__PURE__ */ new Map();
      snapEpochs = /* @__PURE__ */ new Map();
      deskFoldOpen = /* @__PURE__ */ new Set();
      deskFoldTouched = /* @__PURE__ */ new Set();
    }
  });

  // prototypes/clipbook/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootClipbookSim: () => bootClipbookSim,
    closePanel: () => closePanel2,
    openPanel: () => openPanel,
    unload: () => unload
  });
  init_fake_obsidian();
  init_app();
  init_settings_provider();

  // src/core/obsidian-adapter.ts
  init_domain_bus();

  // src/core/path-classify.ts
  init_settings_provider();
  function normalizeDir(dir) {
    return (dir || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  }
  function isUnderDir(dir, p) {
    const d = normalizeDir(dir);
    if (!d) return false;
    return p === d || p.startsWith(d + "/");
  }
  function matchSettingDir(value, p, fallback) {
    const raw = typeof value === "string" && value.trim() ? value : fallback;
    return isUnderDir(raw, p);
  }
  function classifyFilePath(path) {
    if (!path) return null;
    const p = String(path).replace(/\\/g, "/");
    if (!p.endsWith(".md")) return null;
    const s = tryGetSettings();
    if (matchSettingDir(s.diaryDirectory, p, "我的/日记")) return "diary";
    if (isUnderDir("卡片盒", p)) return "flash";
    if (matchSettingDir(s.articleDirectory, p, "归档/网页剪藏")) return "clipping";
    if (matchSettingDir(s.cinemaFolderPath, p, "我的/影视")) return "cinema";
    if (isUnderDir("我的/现代诗", p)) return "poem";
    if (matchSettingDir(s.letterDirectory, p, "我的/信")) return "letter";
    if (matchSettingDir(s.knowledgeDirectory, p, "文献盒")) return "knowledge";
    return null;
  }
  function diaryDateFromPath(path) {
    const base = (path || "").replace(/\\/g, "/").split("/").pop() || "";
    const m = base.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    return m ? m[1] : null;
  }

  // src/core/obsidian-adapter.ts
  var attached = false;
  var boundVault = null;
  var boundRefs = [];
  function isMarkdownFile(file, path) {
    if (file && typeof file.extension === "string") return file.extension === "md";
    if (file && Array.isArray(file.children)) return false;
    return path.endsWith(".md");
  }
  function dispatchBasic(action, file) {
    const path = file && typeof file.path === "string" ? file.path : void 0;
    if (!path || !isMarkdownFile(file, path)) return;
    emitDomainEvent(`vault:md-${action}`, { path });
    const kind = classifyFilePath(path);
    if (!kind) return;
    if (kind === "diary") {
      const date = diaryDateFromPath(path);
      emitDomainEvent(`diary:file-${action}`, date ? { path, date } : { path });
      return;
    }
    emitDomainEvent(`${kind}:file-${action}`, { path });
  }
  function isFolder(file) {
    return !!(file && Array.isArray(file.children));
  }
  function dispatchRename(file, oldPath) {
    const newPath = file && typeof file.path === "string" ? file.path : void 0;
    if (!newPath || typeof oldPath !== "string" || !oldPath) return;
    if (isFolder(file)) return;
    const wasMd = oldPath.endsWith(".md");
    if (!wasMd && !isMarkdownFile(file, newPath)) return;
    emitDomainEvent("vault:md-renamed", { oldPath, newPath });
    const after = classifyFilePath(newPath);
    if (!after) return;
    const before = classifyFilePath(oldPath);
    const payload = {
      oldPath,
      newPath,
      movedOut: before !== after
      // 含旧无新有（移入域）；旧有新无时 after 为空、本事件不派发
    };
    if (after === "diary") {
      const date = diaryDateFromPath(newPath);
      if (date) payload.date = date;
    }
    emitDomainEvent(`${after}:file-renamed`, payload);
  }
  function attachObsidianAdapter(app, registerRef) {
    if (attached) return;
    const vault = app && app.vault;
    if (!vault || typeof vault.on !== "function") return;
    attached = true;
    boundVault = vault;
    const subscribe = (name, cb) => {
      const ref = vault.on(name, cb);
      boundRefs.push(ref);
      if (registerRef) registerRef(ref);
    };
    subscribe("create", (file) => dispatchBasic("created", file));
    subscribe("modify", (file) => dispatchBasic("modified", file));
    subscribe("delete", (file) => dispatchBasic("deleted", file));
    subscribe("rename", (file, oldPath) => dispatchRename(file, oldPath));
  }

  // src/clipbook/index.ts
  init_settings_provider();
  init_domain_bus();
  init_notice();
  init_flow_dialog();
  init_news_data();
  init_flow();
  init_ui3();
  var initialized3 = false;
  var autoRefreshRegistered = false;
  function openClipbook(app) {
    if (!initialized3) {
      initialized3 = true;
      registerAutoRefresh(app);
      initPanel(app, true);
    } else {
      showPanel();
    }
  }
  function unloadClipbook() {
    if (!initialized3) return;
    initialized3 = false;
    unloadPanel();
    autoRefreshRegistered = false;
  }
  function registerAutoRefresh(app) {
    if (autoRefreshRegistered) return;
    autoRefreshRegistered = true;
    let timer = null;
    const dir = () => {
      const s = tryGetSettings();
      return (s && s.articleDirectory || "归档/网页剪藏").replace(/\/+$/, "");
    };
    const schedule = (path) => {
      if (path) invalidateClipBodyCache(path);
      const d = dir();
      if (path && !path.startsWith(d + "/")) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void reloadIfOpen();
      }, 300);
    };
    onDomainEvent("clipping:file-created", (e) => schedule(e && e.path));
    onDomainEvent("clipping:file-modified", (e) => schedule(e && e.path));
    onDomainEvent("clipping:file-deleted", (e) => schedule(e && e.path));
    onDomainEvent("clipping:file-renamed", (e) => schedule(e && e.newPath));
  }

  // prototypes/clipbook/fake-sim.ts
  init_ui3();
  var CLIP_DIR = "归档/网页剪藏";
  var SEED_MARK = "bz-sim:__clipbook-seed-v3";
  var SETTINGS_KEY = "bz-sim:__settings";
  var NEWS_PATH = "CONFIG/STORAGE/news.json";
  var SIDECAR_PATH = "CONFIG/STORAGE/clipbook.json";
  function dayKey(offsetDays = 0) {
    const d = new Date(Date.now() - offsetDays * 864e5);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function buildByDate() {
    return {
      [dayKey(0)]: 7,
      [dayKey(1)]: 12,
      [dayKey(2)]: 5
    };
  }
  function seedDatabase() {
    const src = window.CLIP_DATA || window.parent && window.parent.CLIP_DATA || null;
    if (!src || localStorage.getItem(SEED_MARK)) return;
    seedVaultFile(NEWS_PATH, JSON.stringify({
      articles: src.NEWS.articles,
      stats: { totalRead: 24, totalSaved: 8, totalSkipped: 16, byPlatform: {}, byDate: buildByDate() },
      bilibiliUps: [],
      bilibiliUpInfo: src.NEWS.upInfo || {},
      bilibiliMaxItems: 10,
      bilibiliCookie: "",
      sources: { zhihu: true, guokr: true, bilibili: true, rss: true },
      rssFeeds: [{ url: "https://daily.juya.uk/rss.xml", title: "橘鸦AI早报" }]
    }));
    seedVaultFile(SIDECAR_PATH, JSON.stringify(src.SIDECAR));
    const base = 17e11;
    const n = src.NOTES.length;
    src.NOTES.forEach((note, i) => {
      seedVaultFile(note.path, note.md, base + (n - i) * 1e3);
    });
    localStorage.setItem(SEED_MARK, (/* @__PURE__ */ new Date()).toISOString());
  }
  var settingsStore = {
    storagePath: "CONFIG/STORAGE",
    articleDirectory: CLIP_DIR,
    clipbookReaderFontSize: "medium",
    newsRetentionUnsavedDays: 30,
    clipbookPanelWidth: 0,
    clipbookPanelHeight: 0,
    clipbookMidWidth: 0
  };
  function injectSettings() {
    setSettingsProvider(() => settingsStore);
    setSettingsSaver(async () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsStore));
    });
  }
  var simApp = null;
  function bootClipbookSim() {
    const g = window;
    if (g.__bzClipSimBooted) return;
    g.__bzClipSimBooted = true;
    seedDatabase();
    const app = new FakeApp();
    simApp = app;
    setApp(app);
    injectSettings();
    attachObsidianAdapter(app);
  }
  function openPanel() {
    if (!simApp) bootClipbookSim();
    openClipbook(simApp);
  }
  function closePanel2() {
    closePanel();
  }
  function unload() {
    unloadClipbook();
  }
  return __toCommonJS(fake_sim_exports);
})();
/*! Bundled license information:

moment/moment.js:
  (*! moment.js *)
  (*! version : 2.30.1 *)
  (*! authors : Tim Wood, Iskren Chernev, Moment.js contributors *)
  (*! license : MIT *)
  (*! momentjs.com *)
*/
