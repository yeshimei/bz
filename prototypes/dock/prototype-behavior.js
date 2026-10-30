/* 源指纹 af259d2f17506cee · 仓内输入 65 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/dock/fake-sim.ts","prototypes/dock/fake/fake-obsidian.ts","src/core/app.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/external-tool.ts","src/core/item-actions.ts","src/core/mask-dismiss.ts","src/core/mobile.ts","src/core/notice.ts","src/core/path-picker.ts","src/core/plugin-path.ts","src/core/settings-provider.ts","src/core/storage-path.ts","src/core/storage.ts","src/core/tool-hint.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/focus-trap.ts","src/core/ui/help-tip.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/setlist.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/vault-key.ts","src/core/z-order.ts","src/dock/command.ts","src/dock/exec.ts","src/dock/exit-pulse.ts","src/dock/files.ts","src/dock/host.ts","src/dock/kernel.ts","src/dock/lock.ts","src/dock/parse.ts","src/dock/registry-file.ts","src/dock/registry.ts","src/dock/rules.ts","src/dock/tick-once.ts","src/dock/types.ts","src/dock/ui.ts","src/dock/vault-fs.ts","src/dock/view.ts","src/dock/watchdog-status.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/dock/fake-sim.ts → window.BZW_dock（行为单源预览包，issue 245/ADR-0106） */
var BZW_dock = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
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
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // prototypes/dock/fake/fake-obsidian.ts
  function setIcon(container, iconId) {
    var _a;
    const d = typeof window !== "undefined" && ((_a = window.DOCK_ICONS) == null ? void 0 : _a[iconId]) || "";
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
  var Platform, FakeVault, FakeApp;
  var init_fake_obsidian = __esm({
    "prototypes/dock/fake/fake-obsidian.ts"() {
      Platform = {
        isMobile: typeof window !== "undefined" && window.innerWidth <= 768,
        isDesktop: true,
        isDesktopApp: true,
        isMobileApp: false
      };
      FakeVault = class _FakeVault {
        constructor() {
          this.listeners = /* @__PURE__ */ new Map();
          /**
           * 适配器 —— 真实环境里工具坞靠 `adapter.getBasePath()` 算绝对路径。
           * 少了它，`registryPath()` 只能返回相对串，而种子数据是按绝对路径写的键，两边对不上，
           * 评审壳会显示一个空列表（看不出是「没有工具」还是「路径算歪了」）。
           *
           * `read()` 吃的是**相对库根的路径**，与真适配器一致。
           */
          this.adapter = {
            getBasePath: () => "/sim-vault",
            read: async (rel) => {
              const raw = localStorage.getItem(_FakeVault.key(`/sim-vault/${rel.replace(/^\/+/, "")}`));
              if (raw === null) throw new Error(`no such file: ${rel}`);
              return raw;
            },
            exists: async (rel) => localStorage.getItem(_FakeVault.key(`/sim-vault/${rel.replace(/^\/+/, "")}`)) !== null,
            write: async (rel, data) => {
              localStorage.setItem(_FakeVault.key(`/sim-vault/${rel.replace(/^\/+/, "")}`), data);
            }
          };
          if (typeof window !== "undefined") {
            window.addEventListener("storage", (e) => {
              var _a;
              if (!e.key || !e.key.startsWith("bz-sim:")) return;
              const path = e.key.slice("bz-sim:".length);
              for (const cb of (_a = this.listeners.get("modify")) != null ? _a : []) cb({ path });
            });
          }
        }
        static key(path) {
          return "bz-sim:" + path;
        }
        getAbstractFileByPath(path) {
          const raw = localStorage.getItem(_FakeVault.key(path));
          return raw == null ? null : { path, content: raw };
        }
        async read(f) {
          return f.content;
        }
        async modify(f, content) {
          f.content = content;
          localStorage.setItem(_FakeVault.key(f.path), content);
        }
        async create(path, content) {
          const f = { path, content };
          localStorage.setItem(_FakeVault.key(path), content);
          return f;
        }
        async createFolder(_path) {
          return void 0;
        }
        on(evt, cb) {
          var _a, _b;
          if (!this.listeners.has(evt)) this.listeners.set(evt, []);
          this.listeners.get(evt).push(cb);
          return { ref: (_b = (_a = crypto.randomUUID) == null ? void 0 : _a.call(crypto)) != null ? _b : String(Math.random()) };
        }
        offref(_ref) {
          this.listeners.clear();
        }
        /** 库名：真身份是「这个库叫什么」，评审壳里固定一个 */
        getName() {
          return "sim-vault";
        }
      };
      FakeApp = class {
        constructor() {
          this.vault = new FakeVault();
        }
      };
    }
  });

  // src/core/app.ts
  var app_exports = {};
  __export(app_exports, {
    getApp: () => getApp,
    setApp: () => setApp
  });
  function setApp(app2) {
    _app = app2;
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

  // src/dock/types.ts
  var CONTRACT_VERSION, SETTINGS_FILENAME, RUNS_FILENAME, HEARTBEAT_FILENAME, PANEL_FILENAME, INTENT_FILENAME, RUNTIME_FILENAME, LOCK_FILENAME, REGISTRY_FILENAME, REGISTRY_VERSION, VAULT_PATH_PREFIX, SETTINGS_VERSION, INTENT_VERSION, RUNTIME_VERSION, RUNS_TAIL_BYTES, HEARTBEAT_STALE_MS, RUN_TIMEOUT_MS, LOCK_STALE_MS, FAIL_COOLDOWN_MS, BREAKER_THRESHOLD, TOOL_ID_RE, TOOL_ID_MAX_LEN, TRIGGER_KINDS, TRIGGER_LABEL;
  var init_types = __esm({
    "src/dock/types.ts"() {
      CONTRACT_VERSION = 2;
      SETTINGS_FILENAME = "data.json";
      RUNS_FILENAME = "runs.jsonl";
      HEARTBEAT_FILENAME = "heartbeat.json";
      PANEL_FILENAME = "panel.html";
      INTENT_FILENAME = "dock.intent.json";
      RUNTIME_FILENAME = "dock.runtime.json";
      LOCK_FILENAME = "dock.lock";
      REGISTRY_FILENAME = "dock.json";
      REGISTRY_VERSION = 3;
      VAULT_PATH_PREFIX = "vault:";
      SETTINGS_VERSION = 2;
      INTENT_VERSION = 1;
      RUNTIME_VERSION = 1;
      RUNS_TAIL_BYTES = 256 * 1024;
      HEARTBEAT_STALE_MS = 6e4;
      RUN_TIMEOUT_MS = 10 * 6e4;
      LOCK_STALE_MS = 9e4;
      FAIL_COOLDOWN_MS = 15 * 6e4;
      BREAKER_THRESHOLD = 3;
      TOOL_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
      TOOL_ID_MAX_LEN = 64;
      TRIGGER_KINDS = [
        "daily",
        "interval",
        "on-launch",
        "panel-open",
        "obsidian-exit",
        "tool-ok",
        "tool-fail",
        "domain-event",
        "file-change",
        "value-threshold"
      ];
      TRIGGER_LABEL = {
        daily: "每天某时",
        interval: "每隔一段时间",
        "on-launch": "启动 Obsidian 后",
        "panel-open": "打开工具坞时",
        "obsidian-exit": "关闭 Obsidian 时",
        "tool-ok": "某个工具成功后",
        "tool-fail": "某个工具失败后",
        "domain-event": "某个事件发生时",
        "file-change": "某个目录有变动",
        "value-threshold": "某个数值达到条件"
      };
    }
  });

  // src/dock/files.ts
  function setDockFs(fs) {
    injected = fs;
  }
  function defaultFs() {
    if (typeof window === "undefined") return null;
    const w = window;
    if (!w.require) return null;
    try {
      const fs = w.require("fs");
      return {
        readText: (p) => {
          try {
            return fs.readFileSync(p, "utf8");
          } catch (e) {
            return null;
          }
        },
        writeText: (p, d) => fs.writeFileSync(p, d),
        rename: typeof fs.renameSync === "function" ? (a, b) => fs.renameSync(a, b) : void 0,
        createExclusive: typeof fs.openSync === "function" ? (p, d) => {
          try {
            const fd = fs.openSync(p, "wx");
            if (typeof fs.writeSync === "function") fs.writeSync(fd, d);
            if (typeof fs.closeSync === "function") fs.closeSync(fd);
            return true;
          } catch (e) {
            return false;
          }
        } : void 0,
        unlink: typeof fs.unlinkSync === "function" ? (p) => fs.unlinkSync(p) : void 0,
        exists: (() => {
          const existsSync = fs.existsSync;
          if (typeof existsSync !== "function") return void 0;
          return (p) => {
            try {
              if (!existsSync(p)) return false;
              return fs.statSync ? fs.statSync(p).isFile() : true;
            } catch (e) {
              return false;
            }
          };
        })(),
        mkdir: typeof fs.mkdirSync === "function" ? (p) => {
          try {
            fs.mkdirSync(p, { recursive: true });
          } catch (e) {
          }
        } : void 0,
        readTail: (p, bytes) => {
          try {
            const size = fs.statSync(p).size;
            const start = Math.max(0, size - bytes);
            const readSync = fs.readSync;
            if (typeof readSync !== "function" || typeof Buffer === "undefined") return fs.readFileSync(p, "utf8");
            const fd = fs.openSync(p, "r");
            try {
              const buf = Buffer.alloc(size - start);
              readSync(fd, buf, 0, buf.length, start);
              return buf.toString("utf8");
            } finally {
              fs.closeSync(fd);
            }
          } catch (e) {
            return null;
          }
        },
        size: (p) => {
          try {
            return fs.statSync(p).size;
          } catch (e) {
            return void 0;
          }
        }
      };
    } catch (e) {
      return null;
    }
  }
  function currentFs() {
    return injected !== void 0 ? injected : defaultFs();
  }
  function dirOf(p) {
    const s = p.replace(/\\/g, "/");
    const i = s.lastIndexOf("/");
    if (i < 0) return "";
    if (i === 0) return "/";
    if (s[i - 1] === ":") return s.slice(0, i + 1);
    return s.slice(0, i);
  }
  function joinPath(dir, name) {
    const d = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    return d === "" ? name : `${d}/${name}`;
  }
  function setDockVaultRoot(root) {
    dockVaultRoot = String(root != null ? root : "").replace(/\\/g, "/").replace(/\/+$/, "");
  }
  function isPortablePath(p) {
    return p.startsWith(VAULT_PATH_PREFIX);
  }
  function resolveToolPath(p) {
    if (!isPortablePath(p)) return p;
    const rel = p.slice(VAULT_PATH_PREFIX.length).replace(/^\/+/, "");
    return dockVaultRoot ? `${dockVaultRoot}/${rel}` : rel;
  }
  function portableToolPath(abs, root = dockVaultRoot) {
    const p = String(abs != null ? abs : "").replace(/\\/g, "/");
    const base = String(root != null ? root : "").replace(/\\/g, "/").replace(/\/+$/, "");
    if (!base) return p;
    if (p === base) return `${VAULT_PATH_PREFIX}.`;
    if (!p.startsWith(`${base}/`)) return p;
    return `${VAULT_PATH_PREFIX}${p.slice(base.length + 1)}`;
  }
  function pidText() {
    var _a, _b;
    try {
      return String((_b = (_a = globalThis.process) == null ? void 0 : _a.pid) != null ? _b : 0);
    } catch (e) {
      return "0";
    }
  }
  function writeAtomic(fs, target, text) {
    try {
      if (fs.rename) {
        const tmp = `${target}.${pidText()}.${writeSeq++}.tmp`;
        fs.writeText(tmp, text);
        fs.rename(tmp, target);
      } else {
        fs.writeText(target, text);
      }
      return true;
    } catch (e) {
      return false;
    }
  }
  function readTextOf(path, fs = currentFs()) {
    return fs ? fs.readText(path) : null;
  }
  function readRunsText(path, fs = currentFs(), tailBytes = 0) {
    if (!fs) return null;
    if (tailBytes > 0 && fs.readTail) return fs.readTail(path, tailBytes);
    return fs.readText(path);
  }
  function readPanelText(path, fs = currentFs()) {
    if (!fs) return null;
    const t = fs.readText(path);
    return t === null || t.trim() === "" ? null : t;
  }
  function writeSettings(declPath, toolId, values, fs = currentFs()) {
    if (!fs) return false;
    return writeAtomic(fs, pathOf.settings(declPath), JSON.stringify({ v: SETTINGS_VERSION, tool: toolId, values }, null, 2));
  }
  function writeIntent(declPath, intent, fs = currentFs()) {
    if (!fs) return false;
    const payload = { ...intent, v: INTENT_VERSION };
    return writeAtomic(fs, pathOf.intent(declPath), JSON.stringify(payload, null, 2));
  }
  function writeRuntime(declPath, runtime, fs = currentFs()) {
    if (!fs) return false;
    const target = pathOf.runtime(declPath);
    const payload = { ...runtime, v: RUNTIME_VERSION, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    const next = JSON.stringify(payload, null, 2);
    const prev = fs.readText(target);
    if (prev !== null && stripUpdatedAt(prev) === stripUpdatedAt(next)) return false;
    return writeAtomic(fs, target, next);
  }
  function stripUpdatedAt(json) {
    return json.replace(/^\s*"updatedAt":\s*"[^"]*",?\s*$/m, "");
  }
  var injected, dockVaultRoot, pathOf, writeSeq;
  var init_files = __esm({
    "src/dock/files.ts"() {
      init_types();
      dockVaultRoot = "";
      pathOf = {
        manifest: (declPath) => declPath,
        settings: (declPath) => joinPath(dirOf(declPath), SETTINGS_FILENAME),
        runs: (declPath) => joinPath(dirOf(declPath), RUNS_FILENAME),
        heartbeat: (declPath) => joinPath(dirOf(declPath), HEARTBEAT_FILENAME),
        panel: (declPath) => joinPath(dirOf(declPath), PANEL_FILENAME),
        intent: (declPath) => joinPath(dirOf(declPath), INTENT_FILENAME),
        runtime: (declPath) => joinPath(dirOf(declPath), RUNTIME_FILENAME)
      };
      writeSeq = 0;
    }
  });

  // src/core/tool-hint.ts
  function toolMissingHint(label = "外部工具") {
    return `未找到${label}：到${TOOL_SETTINGS_HINT}里下载它，下载完即可用`;
  }
  var TOOL_SETTINGS_HINT;
  var init_tool_hint = __esm({
    "src/core/tool-hint.ts"() {
      TOOL_SETTINGS_HINT = "「设置 → 通用 → 外部工具」";
    }
  });

  // src/core/external-tool.ts
  function parseAskBody(body) {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return null;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return null;
    const raw = typeof body.body === "string" ? body.body : "";
    const html = typeof body.bodyHtml === "string" ? body.bodyHtml.trim() : "";
    const sec = Number(body.timeoutSec);
    const timeoutSec = Number.isFinite(sec) ? Math.min(ASK_TIMEOUT_MAX_SEC, Math.max(ASK_TIMEOUT_MIN_SEC, Math.floor(sec))) : ASK_TIMEOUT_DEFAULT_SEC;
    return {
      id,
      title,
      body: raw,
      bodyHtml: html,
      confirmText: typeof body.confirmText === "string" && body.confirmText.trim() ? body.confirmText.trim() : "确认",
      cancelText: typeof body.cancelText === "string" && body.cancelText.trim() ? body.cancelText.trim() : "取消",
      timeoutSec
    };
  }
  function parseBzLine(line) {
    const text = line.endsWith("\r") ? line.slice(0, -1) : line;
    const m = text.match(BZ_LINE_PREFIX_RE);
    if (!m) {
      if (!text.trim()) return null;
      return { kind: "raw", text };
    }
    const body = text.slice(m[0].length).trim();
    switch (m[1]) {
      case "step":
        return body ? { kind: "step", text: body } : null;
      case "p": {
        const p = parseJsonObject(body);
        if (!p) return null;
        return {
          kind: "progress",
          phase: typeof p.phase === "string" ? p.phase : null,
          // pct 允许 null = 该阶段不可估；缺失/非有限数一律归 null（绝不假报）
          pct: Number.isFinite(p.pct) ? Number(p.pct) : null
        };
      }
      case "info": {
        const info = parseJsonObject(body);
        return info ? { kind: "info", data: info } : null;
      }
      case "ask": {
        const b = parseJsonObject(body);
        const ask = b ? parseAskBody(b) : null;
        return ask ? { kind: "ask", ask } : null;
      }
      default: {
        const r = parseJsonObject(body);
        return r ? { kind: "result", data: r } : null;
      }
    }
  }
  function parseJsonObject(body) {
    try {
      const v = JSON.parse(body);
      return v && typeof v === "object" && !Array.isArray(v) ? v : null;
    } catch (e) {
      return null;
    }
  }
  function defaultChildProcess() {
    if (typeof window === "undefined") return null;
    const w = window;
    if (!w.require) return null;
    try {
      return w.require("child_process");
    } catch (e) {
      return null;
    }
  }
  function runExternalTool(spec, cb, deps2) {
    var _a, _b;
    const cp = deps2 && deps2.cp ? deps2.cp : defaultChildProcess();
    const splitter = new BzLineSplitter();
    let stderrTail = "";
    let settled = false;
    let stopped = false;
    let child = null;
    let exitSeen = false;
    let exitCode = null;
    let forceTimer = null;
    let resolveDone;
    const done = new Promise((r) => {
      resolveDone = r;
    });
    const settle2 = (o) => {
      if (settled) return;
      settled = true;
      if (forceTimer !== null) {
        clearTimeout(forceTimer);
        forceTimer = null;
      }
      resolveDone(o);
    };
    const collectStderr = (d) => {
      stderrTail += String(d);
      if (stderrTail.length > STDERR_TAIL_CHARS) stderrTail = stderrTail.slice(-STDERR_TAIL_CHARS);
    };
    const dispatchLine = (line) => {
      var _a2;
      const ev = parseBzLine(line);
      if (!ev) return;
      switch (ev.kind) {
        case "step":
          cb.onStep(ev.text);
          break;
        case "progress":
          cb.onProgress(ev.phase, ev.pct);
          break;
        case "info":
          cb.onInfo(ev.data);
          break;
        case "result":
          cb.onResult(ev.data);
          break;
        case "ask":
          (_a2 = cb.onAsk) == null ? void 0 : _a2.call(cb, ev.ask);
          break;
        case "raw":
          if (cb.onRaw) cb.onRaw(ev.text);
          break;
      }
    };
    if (!cp) {
      settle2({ ok: false, stopped: false, code: null, stderr: "", error: new Error("仅桌面端可用：外部工具需要 Node.js 子进程") });
      return { stop: () => {
      }, answer: () => {
      }, done };
    }
    if (!String(spec.cmd || "").trim()) {
      settle2({ ok: false, stopped: false, code: null, stderr: "", error: new Error(toolMissingHint()) });
      return { stop: () => {
      }, answer: () => {
      }, done };
    }
    const spawnOpts = {
      shell: !!spec.shell,
      windowsHide: true,
      // stdin 只在交互运行下开 pipe（见 spec.interactive 的说明）：给所有工具无差别开管道，
      // 等于让一个「顺手读了 stdin」的工具凭空挂住——而它本来只是想要 /dev/null。
      stdio: [spec.interactive ? "pipe" : "ignore", "pipe", "pipe"]
    };
    if (spec.cwd) spawnOpts.cwd = spec.cwd;
    if (spec.env) spawnOpts.env = spec.env;
    try {
      child = cp.spawn(spec.cmd, spec.args || [], spawnOpts);
    } catch (e) {
      settle2({ ok: false, stopped: false, code: null, stderr: stderrTail.trim(), error: new Error(`外部工具启动失败：${(e == null ? void 0 : e.message) || String(e)}`) });
      return { stop: () => {
      }, answer: () => {
      }, done };
    }
    (_a = child.stdout) == null ? void 0 : _a.on("data", (d) => {
      for (const line of splitter.push(d)) dispatchLine(line);
    });
    (_b = child.stderr) == null ? void 0 : _b.on("data", collectStderr);
    child.on("error", (e) => {
      if (settled) return;
      settle2({ ok: false, stopped: false, code: null, stderr: stderrTail.trim(), error: new Error(`外部工具启动失败：${e.message}`) });
    });
    child.on("exit", (code) => {
      exitSeen = true;
      exitCode = code;
    });
    child.on("close", (code) => {
      if (settled) return;
      const rest = splitter.flush();
      if (rest !== null) dispatchLine(rest);
      const stderr = stderrTail.trim();
      if (stopped) {
        settle2({ ok: false, stopped: true, code, stderr, error: null });
        return;
      }
      if (code === 0) {
        settle2({ ok: true, stopped: false, code: 0, stderr, error: null });
        return;
      }
      const err = new Error(code === null ? `外部工具异常退出（无退出码）${stderr ? "：" + stderr : ""}` : `外部工具异常退出（退出码 ${code}）${stderr ? "：" + stderr : ""}`);
      err.stderr = stderr;
      settle2({ ok: false, stopped: false, code, stderr, error: err });
    });
    const isWindows = () => process.platform === "win32";
    const spawnSuppressed = (cmd, args) => {
      var _a2;
      try {
        const killer = cp.spawn(cmd, args, { stdio: "ignore", windowsHide: true });
        (_a2 = killer.on) == null ? void 0 : _a2.call(killer, "error", () => {
        });
      } catch (e) {
      }
    };
    const escalateForceKill = () => {
      forceTimer = null;
      if (settled) return;
      const pid = child == null ? void 0 : child.pid;
      if (typeof pid !== "number" || pid <= 0) return;
      if (exitSeen) {
        settle2({ ok: false, stopped: true, code: exitCode, stderr: stderrTail.trim(), error: null });
        return;
      }
      if (isWindows()) {
        spawnSuppressed("taskkill", ["/pid", String(pid), "/T", "/F"]);
        return;
      }
      try {
        process.kill(pid, "SIGKILL");
      } catch (e) {
      }
    };
    const stopChild = () => {
      var _a2;
      const pid = child == null ? void 0 : child.pid;
      if (spec.shell && isWindows() && typeof pid === "number" && pid > 0) {
        spawnSuppressed("taskkill", ["/pid", String(pid), "/T"]);
      } else {
        try {
          (_a2 = child == null ? void 0 : child.kill) == null ? void 0 : _a2.call(child);
        } catch (e) {
        }
      }
      if (typeof pid === "number" && pid > 0) {
        forceTimer = setTimeout(escalateForceKill, FORCE_KILL_GRACE_MS);
      }
    };
    return {
      stop: () => {
        if (settled || stopped) return;
        stopped = true;
        stopChild();
      },
      answer: (id, ok) => {
        const s = child == null ? void 0 : child.stdin;
        if (!s || s.destroyed || s.writableEnded) return;
        try {
          s.write(`[bz-answer] ${JSON.stringify({ id, ok: !!ok })}
`);
        } catch (e) {
        }
      },
      done
    };
  }
  var ASK_TIMEOUT_DEFAULT_SEC, ASK_TIMEOUT_MIN_SEC, ASK_TIMEOUT_MAX_SEC, BZ_LINE_PREFIX_RE, MAX_LINE_BYTES, BzLineSplitter, STDERR_TAIL_CHARS, FORCE_KILL_GRACE_MS;
  var init_external_tool = __esm({
    "src/core/external-tool.ts"() {
      init_tool_hint();
      ASK_TIMEOUT_DEFAULT_SEC = 300;
      ASK_TIMEOUT_MIN_SEC = 10;
      ASK_TIMEOUT_MAX_SEC = 600;
      BZ_LINE_PREFIX_RE = /^\[bz-(step|p|info|result|ask)\]/;
      MAX_LINE_BYTES = 1024 * 1024;
      BzLineSplitter = class {
        constructor(maxLineBytes = MAX_LINE_BYTES) {
          this.maxLineBytes = maxLineBytes;
          this.parts = [];
          this.len = 0;
          this.overflowed = false;
        }
        /** 喂一段 stdout（Buffer 或 string），返回其中切出的完整行（不含行尾符） */
        push(chunk) {
          const buf = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
          const lines = [];
          let pos = 0;
          while (pos < buf.length) {
            const nl = buf.indexOf(10, pos);
            if (nl === -1) {
              this.accumulate(buf.subarray(pos));
              break;
            }
            this.accumulate(buf.subarray(pos, nl));
            lines.push(this.takeLine());
            pos = nl + 1;
          }
          return lines;
        }
        /** 进程终结时冲刷残留半行（无残留返回 null）——无尾换行的最后一行靠这里出列 */
        flush() {
          return this.len > 0 || this.overflowed ? this.takeLine() : null;
        }
        /** 累积字节；超出单行上限后丢弃后续字节（截断语义，待换行时一并出列） */
        accumulate(part) {
          if (this.overflowed) return;
          const room = this.maxLineBytes - this.len;
          if (part.length <= room) {
            this.parts.push(part);
            this.len += part.length;
          } else {
            this.parts.push(part.subarray(0, room));
            this.len = this.maxLineBytes;
            this.overflowed = true;
          }
        }
        /** 出列一行（overflow 时为截断行）；CRLF 的 \r 在此剥除 */
        takeLine() {
          const s = Buffer.concat(this.parts).toString("utf8");
          this.parts = [];
          this.len = 0;
          this.overflowed = false;
          return s.endsWith("\r") ? s.slice(0, -1) : s;
        }
      };
      STDERR_TAIL_CHARS = 2048;
      FORCE_KILL_GRACE_MS = 3e3;
    }
  });

  // src/dock/parse.ts
  function isObj(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }
  function str(v) {
    if (typeof v !== "string") return void 0;
    const s = v.trim();
    return s === "" ? void 0 : s;
  }
  function num(v, min, max) {
    if (typeof v !== "number" || !Number.isFinite(v)) return void 0;
    const n = Math.floor(v);
    return n < min || n > max ? void 0 : n;
  }
  function bool(v) {
    return typeof v === "boolean" ? v : void 0;
  }
  function parseJsonObjectText(text) {
    if (typeof text !== "string" || text.trim() === "") return null;
    try {
      const v = JSON.parse(text);
      return isObj(v) ? v : null;
    } catch (e) {
      return null;
    }
  }
  function isToolId(v) {
    return typeof v === "string" && v.length <= TOOL_ID_MAX_LEN && TOOL_ID_RE.test(v);
  }
  function parseParam(raw) {
    if (!isObj(raw)) return null;
    const key = str(raw.key);
    if (!key || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) return null;
    const type = PARAM_TYPES.includes(raw.type) ? raw.type : "text";
    const out = { key, type };
    const label = str(raw.label);
    if (label) out.label = label;
    const hint = str(raw.hint);
    if (hint) out.hint = hint;
    const req = bool(raw.required);
    if (req !== void 0) out.required = req;
    if (raw.default !== void 0 && (typeof raw.default === "string" || typeof raw.default === "number" || typeof raw.default === "boolean" || Array.isArray(raw.default))) {
      out.default = raw.default;
    }
    if (Array.isArray(raw.options)) {
      const opts = raw.options.filter((o) => typeof o === "string");
      if (opts.length) out.options = opts;
    }
    if ((type === "choice" || type === "multichoice") && !out.options) return null;
    return out;
  }
  function parseParams(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of raw) {
      const p = parseParam(item);
      if (!p || seen.has(p.key)) continue;
      seen.add(p.key);
      out.push(p);
    }
    return out;
  }
  function parseEntry(raw) {
    if (!isObj(raw)) return null;
    const cmd = str(raw.cmd);
    if (!cmd) return null;
    const out = { cmd };
    if (Array.isArray(raw.args)) {
      const args = raw.args.filter((a) => typeof a === "string");
      if (args.length) out.args = args;
    }
    const cwd = str(raw.cwd);
    if (cwd) out.cwd = cwd;
    const shell = bool(raw.shell);
    if (shell !== void 0) out.shell = shell;
    return out;
  }
  function parseManifest(raw) {
    if (!isObj(raw)) return null;
    if (raw.v !== CONTRACT_VERSION) return null;
    if (!isToolId(raw.id)) return null;
    const name = str(raw.name);
    if (!name) return null;
    const out = { v: CONTRACT_VERSION, id: raw.id, name };
    const desc = str(raw.description);
    if (desc) out.description = desc;
    const icon = str(raw.icon);
    if (icon) out.icon = icon;
    const entry = parseEntry(raw.entry);
    if (entry) out.entry = entry;
    const params = parseParams(raw.params);
    if (params.length) out.params = params;
    const rules = parseRules(raw.defaultRules);
    if (rules.length) out.defaultRules = rules;
    return out;
  }
  function atSecondsOf(at) {
    if (!at) return void 0;
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(at.trim());
    if (!m) return void 0;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 23 || mi > 59) return void 0;
    return h * 3600 + mi * 60;
  }
  function parseTrigger(raw) {
    if (!isObj(raw)) return null;
    switch (raw.kind) {
      case "daily": {
        const at = str(raw.at);
        const sec = atSecondsOf(at);
        if (sec === void 0) return null;
        const h = String(Math.floor(sec / 3600)).padStart(2, "0");
        const mi = String(Math.floor(sec % 3600 / 60)).padStart(2, "0");
        return { kind: "daily", at: `${h}:${mi}` };
      }
      case "interval": {
        const m = num(raw.everyMin, 1, 43200);
        return m === void 0 ? null : { kind: "interval", everyMin: m };
      }
      case "on-launch": {
        const m = num(raw.delayMin, 0, 1440);
        return m === void 0 ? null : { kind: "on-launch", delayMin: m };
      }
      case "panel-open":
        return { kind: "panel-open" };
      case "obsidian-exit":
        return { kind: "obsidian-exit" };
      case "tool-ok": {
        const id = str(raw.toolId);
        return id ? { kind: "tool-ok", toolId: id } : null;
      }
      case "tool-fail": {
        const id = str(raw.toolId);
        return id ? { kind: "tool-fail", toolId: id } : null;
      }
      case "domain-event": {
        const ch = str(raw.channel);
        return ch ? { kind: "domain-event", channel: ch } : null;
      }
      case "file-change": {
        const t = str(raw.target);
        return t ? { kind: "file-change", target: t.replace(/\/+$/, "") } : null;
      }
      case "value-threshold": {
        const op = raw.op;
        if (op !== ">" && op !== "<" && op !== "=") return null;
        const value = raw.value;
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        const path = str(raw.path);
        const key = str(raw.key);
        if (!path || !key) return null;
        return { kind: "value-threshold", path, key, op, value };
      }
      default:
        return null;
    }
  }
  function parseAction(raw) {
    if (!isObj(raw)) return { kind: "run" };
    return raw.kind === "remind" ? { kind: "remind" } : { kind: "run" };
  }
  function parseRule(raw) {
    if (!isObj(raw)) return null;
    const id = str(raw.id);
    if (!id) return null;
    const trigger = parseTrigger(raw.trigger);
    if (!trigger) return null;
    const out = { id, trigger, action: parseAction(raw.action) };
    const name = str(raw.name);
    if (name) out.name = name;
    const enabled = bool(raw.enabled);
    if (enabled !== void 0) out.enabled = enabled;
    const jitter = num(raw.jitterMin, 0, 720);
    if (jitter !== void 0) out.jitterMin = jitter;
    return out;
  }
  function parseRules(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of raw) {
      const r = parseRule(item);
      if (!r || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out;
  }
  function makeRunId(now = Date.now()) {
    return `r${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function emptyIntent(tool) {
    return { v: INTENT_VERSION, tool };
  }
  function parseIntent(raw, toolId) {
    if (!isObj(raw) || raw.v !== INTENT_VERSION || raw.tool !== toolId) return emptyIntent(toolId);
    const out = emptyIntent(toolId);
    const enabled = bool(raw.enabled);
    if (enabled !== void 0) out.enabled = enabled;
    const auto = bool(raw.autoRun);
    if (auto !== void 0) out.autoRun = auto;
    const rules = parseRules(raw.rules);
    if (rules.length) out.rules = rules;
    return out;
  }
  function parseRuleRuntime(raw) {
    if (!isObj(raw)) return null;
    const out = {};
    const lastFired = str(raw.lastFiredAt);
    if (lastFired) out.lastFiredAt = lastFired;
    const lastRunId = str(raw.lastRunId);
    if (lastRunId) out.lastRunId = lastRunId;
    const lastStatus = str(raw.lastStatus);
    if (lastStatus) out.lastStatus = lastStatus;
    if (isObj(raw.pending)) {
      const runId = str(raw.pending.runId);
      const dueAt = str(raw.pending.dueAt);
      const claimedAt = str(raw.pending.claimedAt);
      if (runId && dueAt && claimedAt) {
        const pending = { runId, dueAt, claimedAt };
        const startedAt = str(raw.pending.startedAt);
        if (startedAt) pending.startedAt = startedAt;
        const attempts = num(raw.pending.attempts, 0, 1e3);
        if (attempts) pending.attempts = attempts;
        out.pending = pending;
      }
    }
    return Object.keys(out).length ? out : null;
  }
  function parseRunFacts(raw) {
    if (!isObj(raw)) return null;
    const out = {};
    const at = str(raw.lastAttemptAt);
    if (at) out.lastAttemptAt = at;
    const ok = bool(raw.lastAttemptOk);
    if (ok !== void 0) out.lastAttemptOk = ok;
    const fails = num(raw.consecutiveFailures, 0, 1e3);
    if (fails) out.consecutiveFailures = fails;
    const paused = str(raw.pausedAt);
    if (paused) out.pausedAt = paused;
    const runningAt = str(raw.runningAt);
    if (runningAt) out.runningAt = runningAt;
    const runningRunId = str(raw.runningRunId);
    if (runningRunId) out.runningRunId = runningRunId;
    return Object.keys(out).length ? out : null;
  }
  function emptyRuntime(tool) {
    return { v: RUNTIME_VERSION, tool };
  }
  function parseRuntime(raw, toolId) {
    if (!isObj(raw) || raw.v !== RUNTIME_VERSION || raw.tool !== toolId) return emptyRuntime(toolId);
    const out = emptyRuntime(toolId);
    const updatedAt = str(raw.updatedAt);
    if (updatedAt) out.updatedAt = updatedAt;
    if (isObj(raw.rules)) {
      const rules = {};
      for (const [id, v] of Object.entries(raw.rules)) {
        const r = parseRuleRuntime(v);
        if (r) rules[id] = r;
      }
      if (Object.keys(rules).length) out.rules = rules;
    }
    const run = parseRunFacts(raw.run);
    if (run) out.run = run;
    return out;
  }
  function parseRegistryEntry(raw) {
    if (!isObj(raw)) return null;
    if (!isToolId(raw.id)) return null;
    const path = str(raw.path);
    if (!path) return null;
    return { id: raw.id, path };
  }
  function emptyRegistry() {
    return { v: REGISTRY_VERSION, tools: [] };
  }
  function parseRegistry(raw) {
    const errors = [];
    const base = emptyRegistry();
    if (!isObj(raw)) {
      if (raw !== null && raw !== void 0) errors.push("登记表不是 JSON 对象，已按空处理");
      return { registry: base, errors };
    }
    if (raw.v !== REGISTRY_VERSION) {
      errors.push(`登记表版本是 ${String(raw.v)}，本版认 ${REGISTRY_VERSION} —— 已按空处理`);
      return { registry: base, errors };
    }
    const tools = [];
    const seen = /* @__PURE__ */ new Set();
    if (Array.isArray(raw.tools)) {
      for (const item of raw.tools) {
        const e = parseRegistryEntry(item);
        if (!e) continue;
        if (seen.has(e.id)) {
          errors.push(`登记表里有重复的 id：${e.id}（只留第一条）`);
          continue;
        }
        seen.add(e.id);
        tools.push(e);
      }
    }
    return { registry: { v: REGISTRY_VERSION, tools }, errors };
  }
  function parseStep(raw) {
    var _a;
    if (!isObj(raw)) return null;
    const text = str(raw.text);
    if (!text) return null;
    const at = (_a = str(raw.at)) != null ? _a : (/* @__PURE__ */ new Date(0)).toISOString();
    const status = raw.status === "failed" ? "failed" : "ok";
    return { text, at, status };
  }
  function parseRunRecord(raw, expectTool) {
    var _a, _b, _c;
    if (!isObj(raw)) return null;
    const runId = str(raw.runId);
    const status = str(raw.status);
    if (!runId || !status) return null;
    if (expectTool && raw.tool !== void 0 && raw.tool !== expectTool) return null;
    const STATUSES = ["ok", "failed", "timeout", "stopped", "abandoned", "running"];
    if (!STATUSES.includes(status)) return null;
    const startedAt = (_a = str(raw.startedAt)) != null ? _a : (/* @__PURE__ */ new Date(0)).toISOString();
    const out = {
      runId,
      tool: (_c = (_b = str(raw.tool)) != null ? _b : expectTool) != null ? _c : "",
      trigger: raw.trigger === "auto" ? "auto" : "manual",
      status,
      startedAt
    };
    const finishedAt = str(raw.finishedAt);
    if (finishedAt) out.finishedAt = finishedAt;
    if (typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs)) out.durationMs = raw.durationMs;
    if (typeof raw.exitCode === "number" || raw.exitCode === null) out.exitCode = raw.exitCode;
    const message = str(raw.message);
    if (message) out.message = message;
    if (isObj(raw.error)) {
      const kind = str(raw.error.kind);
      const KINDS = ["auth", "network", "config", "timeout", "aborted", "unknown"];
      const picked = kind && KINDS.includes(kind) ? kind : "unknown";
      out.error = { kind: picked, detail: str(raw.error.detail), stderr: str(raw.error.stderr) };
    }
    if (Array.isArray(raw.steps)) {
      const steps = raw.steps.map(parseStep).filter((s) => s !== null);
      if (steps.length) out.steps = steps;
    }
    if (Array.isArray(raw.info)) out.info = raw.info;
    if (raw.result !== void 0) out.result = raw.result;
    if (isObj(raw.metrics)) {
      const m = {};
      for (const [k, v] of Object.entries(raw.metrics)) {
        if (typeof v === "number" && Number.isFinite(v)) m[k] = v;
      }
      if (Object.keys(m).length) out.metrics = m;
    }
    if (Array.isArray(raw.artifacts)) {
      const a = raw.artifacts.filter((x) => isObj(x) && typeof x.path === "string").map((x) => ({ path: String(x.path), label: typeof x.label === "string" ? x.label : void 0 }));
      if (a.length) out.artifacts = a;
    }
    return out;
  }
  function parseRunLines(text, expectTool) {
    if (!text) return [];
    const out = [];
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const rec = parseRunRecord(JSON.parse(t), expectTool);
        if (rec) out.push(rec);
      } catch (e) {
      }
    }
    return out;
  }
  function parseHeartbeat(raw) {
    if (!isObj(raw)) return null;
    const at = str(raw.at);
    if (!at || !Number.isFinite(Date.parse(at))) return null;
    const out = { at };
    const runId = str(raw.runId);
    if (runId) out.runId = runId;
    const step = str(raw.step);
    if (step) out.step = step;
    return out;
  }
  function findByRunId(records, runId) {
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].runId === runId) return records[i];
    }
    return void 0;
  }
  function latestRun(records) {
    let best;
    let bestAt = -Infinity;
    for (const r of records) {
      const t = Date.parse(r.startedAt);
      if (!Number.isFinite(t)) continue;
      if (t >= bestAt) {
        bestAt = t;
        best = r;
      }
    }
    return best;
  }
  function parseSettingsText(text, toolId) {
    if (text === null || text === void 0) return null;
    const raw = parseJsonObjectText(text);
    if (!raw) return {};
    if (raw.v !== SETTINGS_VERSION || raw.tool !== toolId) return {};
    return isObj(raw.values) ? { ...raw.values } : {};
  }
  function buildArgs(manifest, values) {
    var _a;
    const args = [];
    for (const p of (_a = manifest.params) != null ? _a : []) {
      if (p.type === "secret") continue;
      const v = values[p.key];
      if (v === void 0 || v === null) continue;
      if (p.type === "bool") {
        if (v === true) args.push(`--${p.key}`);
        continue;
      }
      if (p.type === "multichoice") {
        const list = Array.isArray(v) ? v : [v];
        for (const item of list) {
          const s2 = String(item);
          if (s2 !== "") args.push(`--${p.key}=${s2}`);
        }
        continue;
      }
      const s = String(v);
      if (s === "" && !p.required) continue;
      args.push(`--${p.key}=${s}`);
    }
    return args;
  }
  function secretEnvOf(manifest, values) {
    var _a;
    const env = {};
    for (const p of (_a = manifest.params) != null ? _a : []) {
      if (p.type !== "secret") continue;
      const v = values[p.key];
      if (v === void 0 || v === null || String(v) === "") continue;
      const name = `BZ_DOCK_SECRET_${p.key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
      env[name] = String(v);
    }
    return env;
  }
  function runSignature(entry) {
    var _a, _b;
    if (!entry) return "";
    return [entry.cmd, entry.shell === true ? "shell" : "raw", (_a = entry.cwd) != null ? _a : "", ...(_b = entry.args) != null ? _b : []].join("\0");
  }
  var PARAM_TYPES;
  var init_parse = __esm({
    "src/dock/parse.ts"() {
      init_types();
      PARAM_TYPES = [
        "text",
        "number",
        "bool",
        "choice",
        "path",
        "secret",
        "multiline",
        "multichoice"
      ];
    }
  });

  // src/dock/exec.ts
  function dockEnv(input) {
    const env = {
      BZ_DOCK_CONTRACT: String(CONTRACT_VERSION),
      BZ_DOCK_TOOL: input.toolId,
      BZ_DOCK_RUN_ID: input.runId,
      BZ_DOCK_TRIGGER: input.trigger,
      BZ_DOCK_RUNS_FILE: pathOf.runs(input.declPath),
      BZ_DOCK_HEARTBEAT_FILE: pathOf.heartbeat(input.declPath)
    };
    if (input.vaultPath) env.BZ_DOCK_VAULT = input.vaultPath.replace(/[\\/]+$/, "");
    if (input.manifest) Object.assign(env, secretEnvOf(input.manifest, input.values));
    return env;
  }
  function judgeRun(input, records) {
    var _a, _b;
    const base = {
      runId: input.runId,
      code: input.code,
      signal: input.signal,
      stderr: input.stderr,
      error: input.error,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      durationMs: input.durationMs
    };
    if (input.stopped) {
      return { ...base, ok: false, status: "stopped", kind: "aborted", record: findByRunId(records, input.runId) };
    }
    if (input.timedOut) {
      return { ...base, ok: false, status: "timeout", kind: "timeout", record: findByRunId(records, input.runId) };
    }
    const record = findByRunId(records, input.runId);
    if (record) {
      const status = record.status === "running" ? "abandoned" : record.status;
      return {
        ...base,
        ok: status === "ok",
        status,
        kind: (_b = (_a = record.error) == null ? void 0 : _a.kind) != null ? _b : status === "ok" ? "unknown" : "unknown",
        record: { ...record, status }
      };
    }
    const ok = input.code === 0 && !input.error;
    const kind = input.code === null ? "config" : "unknown";
    return {
      ...base,
      ok,
      status: ok ? "ok" : "failed",
      kind,
      recordMissing: input.code === null ? "进程没能启动（命令或工作目录配错了）" : "工具没写这次运行的记录，多半没跑到写记录那一步"
    };
  }
  function hintOf(kind, recordMissing) {
    if (recordMissing) return recordMissing;
    switch (kind) {
      case "auth":
        return "登录态失效了，去重新填一次凭据";
      case "network":
        return "网络不通，检查代理或稍后重试";
      case "config":
        return "命令或参数配错了，检查启动命令与工作目录";
      case "timeout":
        return "跑超时了，可能是网络慢或任务量变大";
      case "aborted":
        return "被手动中止";
      default:
        return "打开运行记录看 stderr 尾部";
    }
  }
  function statusText(status) {
    switch (status) {
      case "ok":
        return "成功";
      case "failed":
        return "失败";
      case "timeout":
        return "超时";
      case "stopped":
        return "已中止";
      case "abandoned":
        return "没收尾";
      case "running":
        return "运行中";
    }
  }
  function setExecDeps(d) {
    deps = d;
  }
  function liveOf(toolId) {
    return live.get(toolId);
  }
  function liveAll() {
    return Array.from(live.values()).sort((a, b) => (Date.parse(a.startedAt) || 0) - (Date.parse(b.startedAt) || 0));
  }
  function onLiveChanged(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function fireLive() {
    for (const fn of listeners) {
      try {
        fn();
      } catch (e) {
      }
    }
  }
  function stopLive(toolId) {
    var _a;
    (_a = live.get(toolId)) == null ? void 0 : _a.handle.stop();
  }
  function runToolNow(args) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const runId = (_a = args.runId) != null ? _a : makeRunId();
    const trigger = (_b = args.trigger) != null ? _b : "manual";
    const startedMs = Date.now();
    const startedAt = new Date(startedMs).toISOString();
    const rawTail = [];
    const steps = [];
    const spec = {
      cmd: args.entry.cmd,
      args: [...(_c = args.entry.args) != null ? _c : [], ...buildArgs((_d = args.manifest) != null ? _d : { params: [] }, args.values), ...(_e = args.extraArgs) != null ? _e : []],
      shell: (_f = args.entry.shell) != null ? _f : /\.(cmd|bat)$/i.test(args.entry.cmd),
      /**
       * 工作目录，契约写的是「缺省 = 声明所在目录」。
       *
       * 这一句必须显式给：不给的话子进程继承宿主进程的 cwd —— 插件里是 Obsidian 的目录，
       * 值守里是仓库根。两种都不是工具目录，「`args: ['main.mjs']` 的相对路径」当场失效，
       * 症状是「面板上跑得起来、值守里报找不到文件」。
       */
      cwd: (_g = args.entry.cwd) != null ? _g : dirOf(args.declPath),
      env: dockEnv({
        toolId: args.toolId,
        declPath: args.declPath,
        runId,
        trigger,
        vaultPath: args.vaultPath,
        manifest: args.manifest,
        values: args.values
      }),
      interactive: typeof ((_h = args.cb) == null ? void 0 : _h.onAsk) === "function"
    };
    let phase = null;
    let pct = null;
    let timedOut = false;
    let handleRef = null;
    let runRef = null;
    const handle = runExternalTool(
      spec,
      {
        onStep: (text) => {
          var _a2, _b2;
          steps.push({ text, at: (/* @__PURE__ */ new Date()).toISOString(), status: "ok" });
          (_b2 = (_a2 = args.cb) == null ? void 0 : _a2.onStep) == null ? void 0 : _b2.call(_a2, text);
        },
        onProgress: (p, v) => {
          var _a2, _b2;
          phase = p;
          pct = v;
          if (runRef) {
            runRef.phase = p;
            runRef.pct = v;
          }
          (_b2 = (_a2 = args.cb) == null ? void 0 : _a2.onProgress) == null ? void 0 : _b2.call(_a2, p, v);
        },
        onInfo: (d) => {
          var _a2, _b2;
          return (_b2 = (_a2 = args.cb) == null ? void 0 : _a2.onInfo) == null ? void 0 : _b2.call(_a2, d);
        },
        onResult: (d) => {
          var _a2, _b2;
          return (_b2 = (_a2 = args.cb) == null ? void 0 : _a2.onResult) == null ? void 0 : _b2.call(_a2, d);
        },
        onRaw: (t) => {
          rawTail.push(t);
          if (rawTail.length > 200) rawTail.shift();
        },
        onAsk: (req) => {
          var _a2, _b2;
          const ask = (_a2 = args.cb) == null ? void 0 : _a2.onAsk;
          if (!ask) {
            (_b2 = handleRef == null ? void 0 : handleRef.answer) == null ? void 0 : _b2.call(handleRef, req.id, false);
            return;
          }
          void Promise.resolve().then(() => ask(req)).then((yes) => {
            var _a3;
            return (_a3 = handleRef == null ? void 0 : handleRef.answer) == null ? void 0 : _a3.call(handleRef, req.id, !!yes);
          }).catch(() => {
            var _a3;
            return (_a3 = handleRef == null ? void 0 : handleRef.answer) == null ? void 0 : _a3.call(handleRef, req.id, false);
          });
        }
      },
      deps
    );
    handleRef = handle;
    const run = {
      runId,
      toolId: args.toolId,
      trigger,
      startedAt,
      steps,
      phase,
      pct,
      rawTail,
      handle,
      done: Promise.resolve(void 0)
    };
    runRef = run;
    const timeoutMs = (_i = args.timeoutMs) != null ? _i : RUN_TIMEOUT_MS;
    const timer = timeoutMs > 0 ? setTimeout(() => {
      timedOut = true;
      handle.stop();
    }, timeoutMs) : null;
    run.done = handle.done.then((o) => {
      var _a2, _b2;
      if (timer) clearTimeout(timer);
      const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
      const outcome = judgeRun(
        {
          runId,
          toolId: args.toolId,
          startedAt,
          finishedAt,
          durationMs: Date.parse(finishedAt) - startedMs,
          code: o.code,
          stopped: o.stopped && !timedOut,
          timedOut,
          error: o.error,
          stderr: o.stderr
        },
        args.records()
      );
      live.delete(args.toolId);
      fireLive();
      (_b2 = (_a2 = args.cb) == null ? void 0 : _a2.onDone) == null ? void 0 : _b2.call(_a2, outcome);
      return outcome;
    });
    live.set(args.toolId, run);
    fireLive();
    return run;
  }
  var deps, live, listeners;
  var init_exec = __esm({
    "src/dock/exec.ts"() {
      init_external_tool();
      init_parse();
      init_files();
      init_types();
      live = /* @__PURE__ */ new Map();
      listeners = /* @__PURE__ */ new Set();
    }
  });

  // src/core/z-order.ts
  function syncAlwaysOnTop() {
    for (const el2 of alwaysOnTop) {
      if (!el2.isConnected) {
        alwaysOnTop.delete(el2);
        continue;
      }
      el2.style.zIndex = String(zCounter);
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
    const live3 = els.filter((el2) => !!el2);
    if (live3.length === 0) return;
    const base = allocZBlock(live3.length);
    live3.forEach((el2, i) => {
      el2.style.zIndex = String(base + i);
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
  function maxVisible() {
    const v = Number(noticePref("noticeMaxVisible"));
    return v === 3 || v === 8 ? v : MAX_VISIBLE_DEFAULT;
  }
  function notice(msg, type, duration) {
    notify(msg, { type: type || "info", duration });
  }
  function isMobileView() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
  }
  function defaultVariant() {
    if (isMobileView()) return "drop";
    const pos = noticePref("noticePosition");
    return pos === "top-left" || pos === "bottom-left" ? "slide-left" : "slide-right";
  }
  function noticePref(key) {
    var _a;
    try {
      const v = (_a = tryGetSettings()) == null ? void 0 : _a[key];
      return typeof v === "string" ? v : void 0;
    } catch (e) {
      return void 0;
    }
  }
  function durationGear() {
    const v = noticePref("noticeDuration");
    if (v === "quick") return { base: 2e3, persistent: false };
    if (v === "relaxed") return { base: 5e3, persistent: false };
    if (v === "persistent") return { base: 3e3, persistent: true };
    return { base: 3e3, persistent: false };
  }
  function defaultDuration(type) {
    const base = durationGear().base;
    return type === "error" ? base + 2e3 : base;
  }
  function suppressedByLevel(kind, opts) {
    const level = noticePref("noticeLevel");
    if (level !== "important" && level !== "error") return false;
    if (kind === "progress") return false;
    if (opts && (opts.action || opts.actions && opts.actions.length > 0)) return false;
    if (level === "error") return kind !== "error";
    return kind !== "warning" && kind !== "error";
  }
  function applyPositionClass(container) {
    const pos = noticePref("noticePosition");
    container.classList.remove(...POSITION_CLASSES);
    const cls = pos === "bottom-right" || pos === "bottom-left" || pos === "top-left" ? `bz-notice-pos--${pos}` : "";
    if (cls) container.classList.add(cls);
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
    const i = live2.indexOf(n);
    if (i !== -1) live2.splice(i, 1);
    if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
  }
  function evictOldest() {
    let quota = live2.length - maxVisible() + 1;
    for (let i = 0; quota > 0 && i < live2.length; ) {
      const candidate = live2[i];
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
      "bz-notice--delete",
      "bz-notice--restore",
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
    } else {
      const base = defaultDuration(kind);
      const dur = explicitDuration !== void 0 ? explicitDuration : text ? calcDuration(text, base) : base;
      if (dur <= 0) {
        n.persistent = true;
      } else if (explicitDuration === void 0 && durationGear().persistent) {
      } else {
        n.timer = window.setTimeout(() => hideNow(n), dur);
      }
    }
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
      setAction() {
      },
      hide() {
      }
    };
  }
  function appendActionBtn(n, action) {
    const btn = document.createElement("span");
    btn.className = "bz-notice-action";
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    btn.textContent = action.label;
    const fire = (e) => {
      e.stopPropagation();
      if (action.onClick) action.onClick();
      hideNow(n);
    };
    btn.addEventListener("click", fire);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fire(e);
      }
    });
    n.el.appendChild(btn);
  }
  function makeHandle(n) {
    return {
      el: n.el,
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
      setAction(actions) {
        const list = Array.isArray(actions) ? actions : [actions];
        const existing = new Set(
          Array.from(n.el.querySelectorAll(".bz-notice-action")).map((el2) => el2.textContent || "")
        );
        for (const a of list) {
          if (existing.has(a.label)) continue;
          appendActionBtn(n, a);
          existing.add(a.label);
        }
      },
      hide() {
        hideNow(n);
      }
    };
  }
  function notify(msg, opts) {
    const kind = opts && opts.type || "info";
    if (suppressedByLevel(kind, opts)) return noopHandle();
    const isProgress = kind === "progress";
    const type = isProgress ? "info" : kind;
    const variant = opts && opts.variant || defaultVariant();
    const container = ensureContainer();
    applyPositionClass(container);
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
        armTimer(r.n, kind, opts.duration, msg);
        const merged = makeHandle(r.n);
        if (mergeActions.length) merged.setAction(mergeActions);
        return merged;
      }
      if (r && now - r.at < DEDUPE_WINDOW_MS) {
        return noopHandle();
      }
      recent[key] = { at: now, n: null };
    }
    evictOldest();
    const el2 = document.createElement("div");
    el2.className = "bz-notice bz-notice--" + (isProgress ? "progress" : type) + " bz-notice--in-" + variant;
    el2.setAttribute("role", "status");
    el2.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    const icon = document.createElement("div");
    icon.className = "bz-notice-icon";
    if (isProgress) {
      icon.innerHTML = SPINNER_SVG;
    } else {
      icon.textContent = ICONS[type];
    }
    el2.appendChild(icon);
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
    el2.appendChild(body);
    let progressEl = null;
    if (isProgress) {
      progressEl = document.createElement("div");
      progressEl.className = "bz-notice-progress";
      el2.appendChild(progressEl);
    }
    const n = { el: el2, timer: null, msgEl, progressEl, iconEl: icon, variant, isProgress, persistent: false };
    const actions = [];
    if (opts && opts.action) actions.push(opts.action);
    if (opts && opts.actions) {
      for (const a of opts.actions) {
        if (!actions.some((x) => x.label === a.label)) actions.push(a);
      }
    }
    for (const a of actions) appendActionBtn(n, a);
    el2.addEventListener("click", () => hideNow(n));
    container.style.zIndex = String(allocZ());
    container.appendChild(el2);
    live2.push(n);
    if (opts && opts.dedupeKey) {
      const r = recent[opts.dedupeKey];
      if (r) r.n = n;
    }
    const fullText = (opts && opts.title ? opts.title + " " : "") + msg;
    armTimer(n, kind, opts && opts.duration, fullText);
    return makeHandle(n);
  }
  var MAX_VISIBLE_DEFAULT, LEAVE_MS, DEDUPE_WINDOW_MS, MOBILE_QUERY, ICONS, SPINNER_SVG, OUT_CLASS, POSITION_CLASSES, PER_CHAR_MS, SHORT_THRESHOLD, live2, recent;
  var init_notice = __esm({
    "src/core/notice.ts"() {
      init_z_order();
      init_settings_provider();
      MAX_VISIBLE_DEFAULT = 5;
      LEAVE_MS = 200;
      DEDUPE_WINDOW_MS = 3e4;
      MOBILE_QUERY = "(max-width: 768px)";
      ICONS = {
        info: "ℹ️",
        success: "✅",
        warning: "⚠️",
        error: "❌",
        pause: "⏸️",
        delete: "🗑️",
        restore: "↩️",
        archive: "📁"
      };
      SPINNER_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';
      OUT_CLASS = {
        drop: "bz-notice--out-drop",
        pop: "bz-notice--out-pop",
        "slide-left": "bz-notice--out-left",
        "slide-right": "bz-notice--out-right",
        bounce: "bz-notice--out-fade",
        shake: "bz-notice--out-fade"
      };
      POSITION_CLASSES = ["bz-notice-pos--bottom-right", "bz-notice-pos--bottom-left", "bz-notice-pos--top-left"];
      PER_CHAR_MS = 60;
      SHORT_THRESHOLD = 20;
      live2 = [];
      recent = {};
    }
  });

  // src/dock/view.ts
  function readManifestFile(path, fs) {
    const text = readTextOf(path, fs);
    if (text === null) return { manifest: null, error: "读不到 manifest.json" };
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { manifest: null, error: "manifest.json 不是合法 JSON" };
    }
    const manifest = parseManifest(raw);
    if (!manifest) {
      return { manifest: null, error: "manifest.json 校验不过（需要 v:2、合法 id、非空 name）" };
    }
    return { manifest };
  }
  function loadToolView(entry, opts = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const fs = opts.fs === void 0 ? currentFs() : opts.fs;
    const declPath = resolveToolPath(entry.path);
    const { manifest, error } = readManifestFile(declPath, fs != null ? fs : null);
    const intentRaw = fs ? readTextOf(pathOf.intent(declPath), fs) : null;
    const intent = parseIntent(safeJson(intentRaw), entry.id);
    const runtimeRaw = fs ? readTextOf(pathOf.runtime(declPath), fs) : null;
    const runtime = parseRuntime(safeJson(runtimeRaw), entry.id);
    const settingsRaw = fs ? readTextOf(pathOf.settings(declPath), fs) : null;
    const parsedValues = parseSettingsText(settingsRaw, entry.id);
    const values = parsedValues != null ? parsedValues : {};
    const records = fs ? parseRunLines(readRunsText(pathOf.runs(declPath), fs, RUNS_TAIL_BYTES), entry.id) : [];
    const beat = heartbeatOf(declPath, fs);
    const heartbeat = beat && !records.some((r) => r.runId === beat.runId) ? beat : null;
    const trust = (_a = opts.trust) == null ? void 0 : _a[entry.id];
    const signature = runSignature((_b = manifest == null ? void 0 : manifest.entry) != null ? _b : null);
    const trusted = !!trust && !!signature && trust.run === signature;
    const rules = ((_c = intent.rules) == null ? void 0 : _c.length) ? intent.rules : (_d = manifest == null ? void 0 : manifest.defaultRules) != null ? _d : [];
    return {
      id: entry.id,
      path: declPath,
      declaredPath: entry.path,
      dir: dirOf(declPath),
      manifest,
      error: error != null ? error : manifest && manifest.id !== entry.id ? `声明的 id 是 ${manifest.id}，登记的是 ${entry.id}` : void 0,
      entry: (_e = manifest == null ? void 0 : manifest.entry) != null ? _e : null,
      params: (_f = manifest == null ? void 0 : manifest.params) != null ? _f : [],
      values,
      intent,
      runtime,
      rules,
      trusted,
      trustStale: !!trust && !!signature && trust.run !== signature,
      lastRun: latestRun(records),
      heartbeat: heartbeat != null ? heartbeat : void 0,
      runnable: ((_g = opts.canRun) != null ? _g : true) && !!(manifest == null ? void 0 : manifest.entry)
    };
  }
  function loadToolViews(entries, opts = {}) {
    return entries.map((e) => loadToolView(e, opts));
  }
  function recentRunsOf(declPath, toolId, limit = 20, fs = currentFs()) {
    const all = parseRunLines(readRunsText(pathOf.runs(resolveToolPath(declPath)), fs, RUNS_TAIL_BYTES), toolId);
    return all.slice().sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0)).slice(0, limit);
  }
  function heartbeatOf(declPath, fs = currentFs()) {
    if (!fs) return null;
    return parseHeartbeat(safeJson(readTextOf(pathOf.heartbeat(resolveToolPath(declPath)), fs)));
  }
  function runningHeartbeatOf(declPath, fs = currentFs(), now = Date.now()) {
    const hb = heartbeatOf(declPath, fs);
    if (!hb) return null;
    const at = Date.parse(hb.at);
    if (!Number.isFinite(at) || now - at > HEARTBEAT_STALE_MS) return null;
    if (!fs) return hb;
    const records = parseRunLines(readRunsText(pathOf.runs(resolveToolPath(declPath)), fs, RUNS_TAIL_BYTES));
    return records.some((r) => r.runId === hb.runId) ? null : hb;
  }
  function panelOf(declPath, fs = currentFs()) {
    return readPanelText(pathOf.panel(declPath), fs);
  }
  function safeJson(text) {
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }
  function displayNameOf(view2) {
    var _a, _b;
    return ((_b = (_a = view2.manifest) == null ? void 0 : _a.name) == null ? void 0 : _b.trim()) || view2.id;
  }
  var init_view = __esm({
    "src/dock/view.ts"() {
      init_parse();
      init_files();
      init_parse();
      init_types();
    }
  });

  // src/dock/registry-file.ts
  function readRegistryAt(path, fs) {
    const text = readTextOf(path, fs);
    if (text === null) return { registry: emptyRegistry() };
    let raw = null;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { registry: emptyRegistry(), error: "登记表不是合法 JSON，已按空处理" };
    }
    const parsed = parseRegistry(raw);
    return { registry: parsed.registry, error: parsed.errors[0] };
  }
  function writeRegistryAt(path, reg, fs) {
    if (!fs) return false;
    return writeAtomic(fs, path, JSON.stringify(reg, null, 2));
  }
  function upsertToolAt(path, entry, fs) {
    const { registry } = readRegistryAt(path, fs);
    const i = registry.tools.findIndex((t) => t.id === entry.id);
    const tools = registry.tools.slice();
    if (i >= 0) tools[i] = entry;
    else tools.push(entry);
    const next = { ...registry, tools };
    writeRegistryAt(path, next, fs);
    return next;
  }
  function removeToolAt(path, id, fs) {
    const { registry } = readRegistryAt(path, fs);
    const next = { ...registry, tools: registry.tools.filter((t) => t.id !== id) };
    writeRegistryAt(path, next, fs);
    return next;
  }
  var init_registry_file = __esm({
    "src/dock/registry-file.ts"() {
      init_parse();
      init_files();
    }
  });

  // src/core/plugin-path.ts
  var plugin_path_exports = {};
  __export(plugin_path_exports, {
    injectedPluginRelDir: () => injectedPluginRelDir,
    pluginDirOf: () => pluginDirOf,
    pluginRelDirOf: () => pluginRelDirOf,
    pluginVaultPath: () => pluginVaultPath,
    setPluginRelDir: () => setPluginRelDir,
    vaultBasePathOf: () => vaultBasePathOf
  });
  function trimSlashes(p) {
    return String(p || "").replace(/^[\\/]+|[\\/]+$/g, "");
  }
  function setPluginRelDir(rel) {
    injectedRelDir = trimSlashes(String(rel || ""));
  }
  function injectedPluginRelDir() {
    return injectedRelDir;
  }
  function pluginRelDirOf(app2) {
    var _a, _b, _c, _d;
    if (injectedRelDir) return injectedRelDir;
    const fromManifests = trimSlashes(
      String(((_c = (_b = (_a = app2 == null ? void 0 : app2.plugins) == null ? void 0 : _a.manifests) == null ? void 0 : _b.bz) == null ? void 0 : _c.dir) || "")
    );
    if (fromManifests) return fromManifests;
    const configDir = trimSlashes(String(((_d = app2 == null ? void 0 : app2.vault) == null ? void 0 : _d.configDir) || ".obsidian"));
    return `${configDir || ".obsidian"}/plugins/bz`;
  }
  function vaultBasePathOf(app2) {
    var _a, _b;
    const adapter = (_a = app2 == null ? void 0 : app2.vault) == null ? void 0 : _a.adapter;
    try {
      const p = ((_b = adapter == null ? void 0 : adapter.getBasePath) == null ? void 0 : _b.call(adapter)) || (adapter == null ? void 0 : adapter.basePath) || "";
      return String(p || "").replace(/[\\/]+$/, "");
    } catch (e) {
      return "";
    }
  }
  function pluginDirOf(app2) {
    const base = vaultBasePathOf(app2);
    if (!base) return "";
    return `${base}/${pluginRelDirOf(app2)}`;
  }
  function pluginVaultPath(app2, rel) {
    const dir = pluginRelDirOf(app2);
    return `${dir}/${trimSlashes(rel)}`;
  }
  var injectedRelDir;
  var init_plugin_path = __esm({
    "src/core/plugin-path.ts"() {
      injectedRelDir = "";
    }
  });

  // src/core/storage-path.ts
  function normalizeStorageDir(value) {
    let dir = (value || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
    if (/\.json$/i.test(dir)) {
      const idx = dir.lastIndexOf("/");
      dir = idx >= 0 ? dir.slice(0, idx) : "";
    }
    return dir || DEFAULT_STORAGE_DIR;
  }
  var DEFAULT_STORAGE_DIR;
  var init_storage_path = __esm({
    "src/core/storage-path.ts"() {
      DEFAULT_STORAGE_DIR = ".obsidian/plugins/bz/storage";
    }
  });

  // src/core/storage.ts
  function storageDir() {
    const s = tryGetSettings();
    return normalizeStorageDir(s && s.storagePath);
  }
  function storageFile(name, base) {
    const dir = (base || storageDir()).trim().replace(/\/+$/, "");
    return `${dir}/${name}`;
  }
  var init_storage = __esm({
    "src/core/storage.ts"() {
      init_app();
      init_settings_provider();
      init_notice();
      init_plugin_path();
      init_storage_path();
    }
  });

  // src/dock/registry.ts
  function dockVaultRoot2() {
    var _a;
    try {
      const a = getApp();
      const adapter = a.vault.adapter;
      const base = (_a = adapter == null ? void 0 : adapter.getBasePath) == null ? void 0 : _a.call(adapter);
      return typeof base === "string" ? base.replace(/\\/g, "/").replace(/\/+$/, "") : "";
    } catch (e) {
      return "";
    }
  }
  function registryPath() {
    const rel = storageFile(REGISTRY_FILENAME);
    const root = dockVaultRoot2();
    setDockVaultRoot(root);
    return root ? `${root}/${rel}` : rel;
  }
  function readRegistry(fs = currentFs()) {
    return readRegistryAt(registryPath(), fs);
  }
  function upsertTool(entry, fs) {
    const portable = { ...entry, path: portableToolPath(entry.path) };
    return upsertToolAt(registryPath(), portable, fs === void 0 ? currentFs() : fs);
  }
  function removeTool(id, fs) {
    return removeToolAt(registryPath(), id, fs === void 0 ? currentFs() : fs);
  }
  function readTrust() {
    const raw = tryGetSettings()[DOCK_TRUST_KEY];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    for (const [id, v] of Object.entries(raw)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const r = v;
      const at = typeof r.at === "string" ? r.at : "";
      const run = typeof r.run === "string" ? r.run : "";
      if (!at) continue;
      out[id] = { at, run };
    }
    return out;
  }
  async function trustTool(id, entry) {
    const trust = readTrust();
    trust[id] = { at: (/* @__PURE__ */ new Date()).toISOString(), run: runSignature(entry) };
    const settings2 = tryGetSettings();
    settings2[DOCK_TRUST_KEY] = trust;
    await saveSettings();
  }
  async function untrustTool(id) {
    const trust = readTrust();
    if (!(id in trust)) return;
    delete trust[id];
    const settings2 = tryGetSettings();
    settings2[DOCK_TRUST_KEY] = trust;
    await saveSettings();
  }
  var DOCK_TRUST_KEY;
  var init_registry = __esm({
    "src/dock/registry.ts"() {
      init_types();
      init_parse();
      init_registry_file();
      init_files();
      init_storage();
      init_app();
      init_settings_provider();
      DOCK_TRUST_KEY = "dockTrust";
    }
  });

  // src/dock/rules.ts
  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function todayAt(trigger, now) {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(trigger.at);
    if (!m) return void 0;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 23 || mi > 59) return void 0;
    return startOfDay(now) + (h * 3600 + mi * 60) * 1e3;
  }
  function ruleDue(rule, ctx) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const t = rule.trigger;
    switch (t.kind) {
      case "daily": {
        const at = todayAt(t, ctx.now);
        if (at === void 0) return false;
        if (ctx.now < at) return false;
        return ((_a = ctx.lastFiredAt) != null ? _a : 0) < at;
      }
      case "interval": {
        if (!(t.everyMin > 0)) return false;
        if (ctx.lastFiredAt === void 0) return true;
        return ctx.now - ctx.lastFiredAt >= t.everyMin * 6e4;
      }
      case "on-launch": {
        if (ctx.sessionStart === void 0) return false;
        if (ctx.now < ctx.sessionStart + t.delayMin * 6e4) return false;
        return ((_b = ctx.lastFiredAt) != null ? _b : 0) < ctx.sessionStart;
      }
      case "panel-open":
        return ((_c = ctx.event) == null ? void 0 : _c.kind) === "panel-open";
      case "obsidian-exit":
        return ((_d = ctx.event) == null ? void 0 : _d.kind) === "obsidian-exit";
      case "tool-ok":
        return ((_e = ctx.event) == null ? void 0 : _e.kind) === "tool-ok" && ctx.event.toolId === t.toolId;
      case "tool-fail":
        return ((_f = ctx.event) == null ? void 0 : _f.kind) === "tool-fail" && ctx.event.toolId === t.toolId;
      case "domain-event":
        return ((_g = ctx.event) == null ? void 0 : _g.kind) === "domain-event" && ctx.event.channel === t.channel;
      case "file-change": {
        if (((_h = ctx.event) == null ? void 0 : _h.kind) !== "file-change") return false;
        const p = (_i = ctx.event.path) != null ? _i : "";
        if (!p) return false;
        return p === t.target || p.startsWith(`${t.target}/`);
      }
      case "value-threshold": {
        if (ctx.value === void 0) return false;
        if (t.op === ">") return ctx.value > t.value;
        if (t.op === "<") return ctx.value < t.value;
        return ctx.value === t.value;
      }
    }
  }
  function isEventTrigger(kind) {
    return kind !== "daily" && kind !== "interval" && kind !== "on-launch";
  }
  function nextDueOf(rule, ctx) {
    var _a, _b;
    const t = rule.trigger;
    switch (t.kind) {
      case "daily": {
        const today = todayAt(t, ctx.now);
        if (today === void 0) return null;
        if (((_a = ctx.lastFiredAt) != null ? _a : 0) < today) return today;
        return today + 864e5;
      }
      case "interval": {
        if (!(t.everyMin > 0)) return null;
        if (ctx.lastFiredAt === void 0) return ctx.now;
        return ctx.lastFiredAt + t.everyMin * 6e4;
      }
      case "on-launch": {
        if (ctx.sessionStart === void 0) return null;
        const at = ctx.sessionStart + t.delayMin * 6e4;
        return ((_b = ctx.lastFiredAt) != null ? _b : 0) < ctx.sessionStart ? at : null;
      }
      default:
        return null;
    }
  }
  function clockText(at) {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(at);
    if (!m) return at;
    return `${pad22(Number(m[1]))}:${pad22(Number(m[2]))}`;
  }
  function durationText(min) {
    if (min >= 60 && min % 60 === 0) return `${min / 60} 小时`;
    return `${min} 分钟`;
  }
  function triggerText(t, nameOf) {
    const name = (id) => nameOf ? nameOf(id) : id;
    switch (t.kind) {
      case "daily":
        return `每天 ${clockText(t.at)}`;
      case "interval":
        return `每 ${durationText(t.everyMin)}`;
      case "on-launch":
        return `启动后 ${durationText(t.delayMin)}`;
      case "panel-open":
        return "打开工具坞时";
      case "obsidian-exit":
        return "关闭 Obsidian 后";
      case "tool-ok":
        return `${name(t.toolId)} 成功后`;
      case "tool-fail":
        return `${name(t.toolId)} 失败后`;
      case "domain-event":
        return `事件 ${t.channel}`;
      case "file-change":
        return `${t.target} 有变动`;
      case "value-threshold":
        return `${t.path} 的 ${t.key} ${t.op} ${t.value}`;
    }
  }
  function actionText(a) {
    return a.kind === "remind" ? "只提醒" : "运行";
  }
  function defaultRule(now = Date.now()) {
    return {
      id: `r${now.toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`,
      trigger: { kind: "daily", at: "09:00" },
      action: { kind: "run" }
    };
  }
  var pad22;
  var init_rules = __esm({
    "src/dock/rules.ts"() {
      pad22 = (n) => String(n).padStart(2, "0");
    }
  });

  // src/dock/kernel.ts
  function thresholdKey(toolId, ruleId) {
    return `${toolId}\0${ruleId}`;
  }
  function missingParams(view2) {
    var _a;
    const out = [];
    for (const p of view2.params) {
      if (!p.required) continue;
      const v = view2.values[p.key];
      const empty = v === void 0 || v === null || typeof v === "string" && v.trim() === "" || Array.isArray(v) && v.length === 0;
      if (empty) out.push((_a = p.label) != null ? _a : p.key);
    }
    return out;
  }
  function runningElsewhere(view2, now) {
    var _a, _b;
    const at = Date.parse((_b = (_a = view2.runtime.run) == null ? void 0 : _a.runningAt) != null ? _b : "");
    if (!Number.isFinite(at)) return false;
    return now - at < RUN_TIMEOUT_MS + 6e4;
  }
  function planTick(input) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    const decisions = [];
    const ready = [];
    for (const view2 of input.views) {
      for (const rule of view2.rules) {
        const ruleState = (_b = (_a = view2.runtime.rules) == null ? void 0 : _a[rule.id]) != null ? _b : {};
        const action = rule.action.kind === "remind" ? "remind" : "run";
        const push = (kind, reason, dueAt2) => {
          decisions.push({ toolId: view2.id, ruleId: rule.id, action, kind, reason, dueAt: dueAt2 });
        };
        const pending = ruleState.pending;
        if (pending) {
          const due = Date.parse(pending.dueAt);
          const started = Date.parse((_c = pending.startedAt) != null ? _c : "");
          const inFlight = Number.isFinite(started) && input.now - started < RUN_TIMEOUT_MS + 6e4;
          if (Number.isFinite(due) && due <= input.now && !inFlight) {
            ready.push({ view: view2, rule, runId: pending.runId });
            push("run");
          } else {
            push("skip", "waiting", (_d = pending.startedAt) != null ? _d : pending.dueAt);
          }
          continue;
        }
        if (rule.enabled === false) {
          push("skip", "disabled");
          continue;
        }
        if (view2.intent.enabled === false) {
          push("skip", "disabled");
          continue;
        }
        if (view2.intent.autoRun === false) {
          push("skip", "tool-auto-off");
          continue;
        }
        if ((_e = view2.runtime.run) == null ? void 0 : _e.pausedAt) {
          push("skip", "paused");
          continue;
        }
        if (!view2.trusted) {
          push("skip", view2.trustStale ? "untrusted" : "untrusted");
          continue;
        }
        if (!view2.entry || !view2.runnable) {
          push("skip", "no-entry");
          continue;
        }
        if (action === "run" && missingParams(view2).length > 0) {
          push("skip", "missing-params");
          continue;
        }
        if (action === "run" && input.liveIds.has(view2.id)) {
          push("skip", "running");
          continue;
        }
        if (action === "run" && runningElsewhere(view2, input.now)) {
          push("skip", "running");
          continue;
        }
        const lastAttempt = Date.parse((_g = (_f = view2.runtime.run) == null ? void 0 : _f.lastAttemptAt) != null ? _g : "");
        if (action === "run" && ((_h = view2.runtime.run) == null ? void 0 : _h.lastAttemptOk) === false && Number.isFinite(lastAttempt) && input.now - lastAttempt < FAIL_COOLDOWN_MS) {
          push("skip", "cooldown");
          continue;
        }
        const ctx = {
          now: input.now,
          lastFiredAt: Number.isFinite(Date.parse((_i = ruleState.lastFiredAt) != null ? _i : "")) ? Date.parse(ruleState.lastFiredAt) : void 0,
          sessionStart: input.sessionStart,
          value: (_j = input.values) == null ? void 0 : _j.get(thresholdKey(view2.id, rule.id))
        };
        const hit = ruleDue(rule, ctx) || ((_k = input.events) != null ? _k : []).some((e) => {
          if ((e.kind === "tool-ok" || e.kind === "tool-fail") && e.toolId === view2.id) return false;
          return ruleDue(rule, { ...ctx, event: e });
        });
        if (!hit) continue;
        const jitterMin = (_l = rule.jitterMin) != null ? _l : 0;
        const delayMs = jitterMin > 0 ? Math.floor(Math.random() * jitterMin * 6e4) : 0;
        const dueAt = new Date(input.now + delayMs).toISOString();
        push("queue", delayMs > 0 ? "jitter" : void 0, dueAt);
      }
    }
    return { decisions, ready };
  }
  async function runTick(deps2) {
    var _a, _b, _c;
    const plan = planTick({
      views: deps2.views,
      now: deps2.now,
      sessionStart: deps2.sessionStart,
      events: deps2.events,
      liveIds: deps2.liveIds,
      values: deps2.values
    });
    const ran = [];
    let executed = 0;
    const jobs = plan.ready.map((r) => ({
      toolId: r.view.id,
      ruleId: r.rule.id,
      runId: r.runId
    }));
    for (const d of plan.decisions) {
      if (d.kind !== "queue" || !d.dueAt) continue;
      const view2 = deps2.views.find((v) => v.id === d.toolId);
      if (!view2) continue;
      const rule = view2.rules.find((r) => r.id === d.ruleId);
      if (!rule) continue;
      if (d.action === "remind") {
        (_a = deps2.remind) == null ? void 0 : _a.call(deps2, view2, rule);
        patchRule(view2, rule.id, { lastFiredAt: new Date(deps2.now).toISOString(), lastStatus: "ok" }, deps2.fs);
        continue;
      }
      const runId = makeRunId(deps2.now);
      patchRule(
        view2,
        rule.id,
        { pending: { runId, dueAt: d.dueAt, claimedAt: new Date(deps2.now).toISOString() } },
        deps2.fs
      );
      if (Date.parse(d.dueAt) <= deps2.now) jobs.push({ toolId: view2.id, ruleId: rule.id, runId });
    }
    while (jobs.length && executed < MAX_RUNS_PER_TICK) {
      if ((_b = deps2.shouldStop) == null ? void 0 : _b.call(deps2)) break;
      const job = jobs.shift();
      const view2 = deps2.views.find((v) => v.id === job.toolId);
      if (!view2) continue;
      const rule = view2.rules.find((r) => r.id === job.ruleId);
      if (!rule) continue;
      markStarted(view2, rule.id, job.runId, deps2.now, deps2.fs);
      executed += 1;
      const startedAt = (/* @__PURE__ */ new Date()).toISOString();
      let outcome;
      try {
        outcome = await deps2.execute(view2, rule, job.runId);
      } catch (e) {
        outcome = {
          ok: false,
          status: "failed",
          runId: job.runId,
          code: null,
          stderr: "",
          error: e instanceof Error ? e : new Error(String(e)),
          kind: "config",
          startedAt,
          finishedAt: (/* @__PURE__ */ new Date()).toISOString(),
          durationMs: 0,
          recordMissing: "bz 自己出错，没跑起来"
        };
      }
      if ((_c = deps2.shouldStop) == null ? void 0 : _c.call(deps2)) break;
      settle(view2, job.ruleId, job.runId, outcome, deps2.fs);
      ran.push({ toolId: view2.id, ruleId: job.ruleId, runId: job.runId, status: outcome.status });
    }
    return { decisions: plan.decisions, ran, executed };
  }
  function patchRule(view2, ruleId, patch, fs) {
    var _a, _b;
    const runtime = view2.runtime;
    const rules = { ...(_a = runtime.rules) != null ? _a : {} };
    rules[ruleId] = { ...(_b = rules[ruleId]) != null ? _b : {}, ...patch };
    view2.runtime = { ...runtime, rules };
    writeRuntime(view2.path, view2.runtime, fs != null ? fs : null);
  }
  function settle(view2, ruleId, runId, outcome, fs) {
    var _a, _b, _c;
    const now = outcome.finishedAt || (/* @__PURE__ */ new Date()).toISOString();
    const runtime = { ...view2.runtime, rules: { ...(_a = view2.runtime.rules) != null ? _a : {} } };
    const rules = runtime.rules;
    rules[ruleId] = { lastFiredAt: now, lastRunId: runId, lastStatus: outcome.status };
    const facts = { ...(_b = runtime.run) != null ? _b : {} };
    facts.lastAttemptAt = now;
    facts.lastAttemptOk = outcome.ok;
    delete facts.runningAt;
    delete facts.runningRunId;
    if (outcome.ok) {
      delete facts.consecutiveFailures;
      delete facts.pausedAt;
    } else if (outcome.status !== "stopped") {
      const fails = ((_c = facts.consecutiveFailures) != null ? _c : 0) + 1;
      facts.consecutiveFailures = fails;
      if (fails >= BREAKER_THRESHOLD) facts.pausedAt = now;
    }
    runtime.run = facts;
    view2.runtime = runtime;
    writeRuntime(view2.path, runtime, fs != null ? fs : null);
  }
  function markRunning(view2, runId, now, fs) {
    var _a;
    const facts = { ...(_a = view2.runtime.run) != null ? _a : {} };
    facts.runningAt = new Date(now).toISOString();
    facts.runningRunId = runId;
    view2.runtime = { ...view2.runtime, run: facts };
    writeRuntime(view2.path, view2.runtime, fs != null ? fs : null);
  }
  function clearRunning(view2, fs) {
    var _a;
    const facts = { ...(_a = view2.runtime.run) != null ? _a : {} };
    if (facts.runningAt === void 0 && facts.runningRunId === void 0) return;
    delete facts.runningAt;
    delete facts.runningRunId;
    view2.runtime = { ...view2.runtime, run: facts };
    writeRuntime(view2.path, view2.runtime, fs != null ? fs : null);
  }
  function clearBreaker(view2, fs) {
    const runtime = { ...view2.runtime };
    if (runtime.run) {
      const facts = { ...runtime.run };
      delete facts.pausedAt;
      delete facts.consecutiveFailures;
      runtime.run = facts;
    }
    view2.runtime = runtime;
    writeRuntime(view2.path, runtime, fs != null ? fs : null);
  }
  function markStarted(view2, ruleId, runId, now, fs) {
    var _a, _b, _c, _d, _e;
    const pending = (_b = (_a = view2.runtime.rules) == null ? void 0 : _a[ruleId]) == null ? void 0 : _b.pending;
    const at = new Date(now).toISOString();
    patchRule(
      view2,
      ruleId,
      {
        pending: {
          runId,
          dueAt: (_c = pending == null ? void 0 : pending.dueAt) != null ? _c : at,
          claimedAt: (_d = pending == null ? void 0 : pending.claimedAt) != null ? _d : at,
          startedAt: at,
          attempts: ((_e = pending == null ? void 0 : pending.attempts) != null ? _e : 0) + 1
        }
      },
      fs
    );
  }
  function reclaimStale(view2, now, fs) {
    var _a, _b, _c, _d;
    const rules = { ...(_a = view2.runtime.rules) != null ? _a : {} };
    let verdict = null;
    for (const [id, st] of Object.entries(rules)) {
      const pending = st.pending;
      if (!(pending == null ? void 0 : pending.startedAt)) continue;
      const started = Date.parse(pending.startedAt);
      if (!Number.isFinite(started) || now - started <= RUN_TIMEOUT_MS + 6e4) continue;
      if (((_b = pending.attempts) != null ? _b : 1) < MAX_ATTEMPTS) {
        rules[id] = { ...st, pending: { ...pending, startedAt: void 0 } };
        verdict = "requeue";
      } else {
        const facts = { ...(_c = view2.runtime.run) != null ? _c : {} };
        facts.lastAttemptAt = new Date(now).toISOString();
        facts.lastAttemptOk = false;
        facts.consecutiveFailures = ((_d = facts.consecutiveFailures) != null ? _d : 0) + 1;
        if (facts.consecutiveFailures >= BREAKER_THRESHOLD) {
          facts.pausedAt = new Date(now).toISOString();
        }
        rules[id] = { ...st, lastFiredAt: new Date(now).toISOString(), lastStatus: "abandoned" };
        delete rules[id].pending;
        view2.runtime = { ...view2.runtime, run: facts };
        verdict = "abandon";
      }
    }
    if (verdict) {
      view2.runtime = { ...view2.runtime, rules };
      writeRuntime(view2.path, view2.runtime, fs != null ? fs : null);
    }
    return verdict;
  }
  var MAX_RUNS_PER_TICK, MAX_ATTEMPTS;
  var init_kernel = __esm({
    "src/dock/kernel.ts"() {
      init_types();
      init_rules();
      init_parse();
      init_files();
      MAX_RUNS_PER_TICK = 8;
      MAX_ATTEMPTS = 3;
    }
  });

  // src/core/domain-bus.ts
  var init_domain_bus = __esm({
    "src/core/domain-bus.ts"() {
    }
  });

  // src/dock/lock.ts
  function pidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    const proc = globalThis.process;
    if (!(proc == null ? void 0 : proc.kill)) return true;
    try {
      proc.kill(pid, 0);
      return true;
    } catch (e) {
      return (e == null ? void 0 : e.code) === "EPERM";
    }
  }
  function newToken() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function currentBootId() {
    var _a, _b, _c, _d;
    try {
      const g = globalThis;
      const req = (_b = (_a = g.window) == null ? void 0 : _a.require) != null ? _b : g.require;
      const os = req == null ? void 0 : req("os");
      const sec = (_c = os == null ? void 0 : os.uptime) == null ? void 0 : _c.call(os);
      if (typeof sec !== "number" || !Number.isFinite(sec)) return "";
      const host = (_d = os == null ? void 0 : os.hostname) == null ? void 0 : _d.call(os);
      if (!host) return "";
      return `${host}:${Math.round((Date.now() - sec * 1e3) / 6e4)}`;
    } catch (e) {
      return "";
    }
  }
  function sameHostOf(a, b) {
    const cut = (v) => v.slice(0, v.lastIndexOf(":"));
    const ha = cut(a);
    return ha !== "" && ha === cut(b);
  }
  function readLock(fs, path) {
    const text = fs.readText(path);
    if (!text) return null;
    try {
      const v = JSON.parse(text);
      if (typeof v.owner !== "string" || typeof v.token !== "string" || typeof v.at !== "string") return null;
      return {
        owner: v.owner,
        pid: typeof v.pid === "number" ? v.pid : 0,
        bootId: typeof v.bootId === "string" ? v.bootId : "",
        at: v.at,
        token: v.token
      };
    } catch (e) {
      return null;
    }
  }
  function lockPathOf(dataDir2) {
    return joinPath(dataDir2, LOCK_FILENAME);
  }
  function acquireLock(dataDir2, owner, opts = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const fs = (_a = opts.fs) != null ? _a : currentFs();
    if (!fs) return null;
    const path = lockPathOf(dataDir2);
    const staleMs = (_b = opts.staleMs) != null ? _b : LOCK_STALE_MS;
    const now = (_c = opts.now) != null ? _c : Date.now();
    const token = newToken();
    const info = {
      owner,
      pid: (_e = (_d = globalThis.process) == null ? void 0 : _d.pid) != null ? _e : 0,
      bootId: (_f = opts.bootId) != null ? _f : currentBootId(),
      at: new Date(now).toISOString(),
      token
    };
    const text = JSON.stringify(info);
    if (fs.mkdir) fs.mkdir(dataDir2);
    const take = () => {
      const ok = fs.createExclusive ? fs.createExclusive(path, text) : false;
      if (ok) return handleOf(fs, path, token);
      if (!fs.createExclusive && fs.readText(path) === null) {
        fs.writeText(path, text);
        return handleOf(fs, path, token);
      }
      return null;
    };
    const first = take();
    if (first) return first;
    const held = readLock(fs, path);
    const expiredByTime = !held || now - Date.parse(held.at) > staleMs || !Number.isFinite(Date.parse((_g = held == null ? void 0 : held.at) != null ? _g : ""));
    const expiredByPid = !!held && held.pid > 0 && !pidAlive(held.pid);
    const expiredByBoot = !!held && held.bootId !== "" && info.bootId !== "" && sameHostOf(held.bootId, info.bootId) && held.bootId !== info.bootId;
    if (!expiredByTime && !expiredByPid && !expiredByBoot) return null;
    const saved = `${path}.stale`;
    if (fs.rename) {
      if (fs.unlink) {
        try {
          fs.unlink(saved);
        } catch (e) {
        }
      }
      try {
        fs.rename(path, saved);
      } catch (e) {
        return null;
      }
      if (fs.unlink) {
        try {
          fs.unlink(saved);
        } catch (e) {
        }
      }
    } else if (fs.unlink) {
      try {
        fs.unlink(path);
      } catch (e) {
        return null;
      }
    } else {
      return null;
    }
    return take();
  }
  function handleOf(fs, path, token) {
    let lost = false;
    return {
      token,
      lost() {
        return lost;
      },
      renew() {
        const held = readLock(fs, path);
        if (!held || held.token !== token) {
          lost = true;
          return false;
        }
        const next = JSON.stringify({ ...held, at: (/* @__PURE__ */ new Date()).toISOString() });
        if (fs.rename) {
          const tmp = `${path}.${token}.tmp`;
          try {
            fs.writeText(tmp, next);
            fs.rename(tmp, path);
          } catch (e) {
            return false;
          }
        } else {
          fs.writeText(path, next);
        }
        const after = readLock(fs, path);
        const mine = !!after && after.token === token;
        if (!mine) lost = true;
        return mine;
      },
      release() {
        const held = readLock(fs, path);
        if (!held || held.token !== token || !fs.unlink) return;
        for (let i = 0; i < 2; i += 1) {
          try {
            fs.unlink(path);
            return;
          } catch (e) {
          }
        }
      }
    };
  }
  async function withLock(dataDir2, owner, fn, opts = {}) {
    const lock = acquireLock(dataDir2, owner, opts);
    if (!lock) return null;
    const hb = opts.keepAliveMs && opts.keepAliveMs > 0 ? setInterval(() => {
      lock.renew();
    }, opts.keepAliveMs) : null;
    try {
      return await fn(lock);
    } finally {
      if (hb) clearInterval(hb);
      lock.release();
    }
  }
  var init_lock = __esm({
    "src/dock/lock.ts"() {
      init_types();
      init_files();
    }
  });

  // src/dock/exit-pulse.ts
  function exitPulsePath(dataDir2) {
    return joinPath(dataDir2, EXIT_PULSE_FILENAME);
  }
  function selfPid() {
    try {
      const p = globalThis.process;
      const n = p == null ? void 0 : p.pid;
      return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
    } catch (e) {
      return 0;
    }
  }
  function pidAlive2(pid) {
    if (!Number.isFinite(pid) || pid <= 0) return true;
    const p = globalThis.process;
    if (typeof (p == null ? void 0 : p.kill) !== "function") return true;
    try {
      p.kill(pid, 0);
      return true;
    } catch (e) {
      return (e == null ? void 0 : e.code) === "EPERM";
    }
  }
  function readExitPulse(dataDir2, fs = currentFs()) {
    if (!fs || !dataDir2) return null;
    const raw = fs.readText(exitPulsePath(dataDir2));
    if (raw === null) return null;
    try {
      const o = JSON.parse(raw);
      const at = typeof (o == null ? void 0 : o.at) === "string" ? o.at : "";
      const pid = typeof (o == null ? void 0 : o.pid) === "number" ? o.pid : Number(o == null ? void 0 : o.pid);
      if (!at || !Number.isFinite(Date.parse(at))) return null;
      return { at, pid: Number.isFinite(pid) ? pid : 0 };
    } catch (e) {
      return null;
    }
  }
  function clearExitPulse(dataDir2, fs = currentFs()) {
    if (!fs || !dataDir2 || !fs.unlink) return;
    try {
      fs.unlink(exitPulsePath(dataDir2));
    } catch (e) {
    }
  }
  function exitPulseFires(pulse, self = selfPid()) {
    if (!pulse) return false;
    if (!Number.isFinite(Date.parse(pulse.at))) return false;
    if (!Number.isFinite(pulse.pid) || pulse.pid <= 0) return false;
    if (self > 0 && pulse.pid === self) return false;
    return !pidAlive2(pulse.pid);
  }
  var EXIT_PULSE_FILENAME;
  var init_exit_pulse = __esm({
    "src/dock/exit-pulse.ts"() {
      init_files();
      EXIT_PULSE_FILENAME = "dock.exit.json";
    }
  });

  // src/dock/tick-once.ts
  async function tickOnce(opts) {
    var _a, _b, _c;
    const fs = opts.fs === void 0 ? currentFs() : opts.fs;
    if (!fs) return { skipped: "no-fs" };
    const now = (_a = opts.now) != null ? _a : Date.now();
    let inner;
    try {
      inner = await withLock(
        opts.dataDir,
        opts.owner,
        async (lock) => {
          var _a2, _b2, _c2, _d, _e;
          const { registry } = readRegistryAt(opts.registryPath, fs);
          const views2 = loadToolViews(registry.tools, { trust: opts.trust, fs });
          for (const view2 of views2) {
            try {
              reclaimStale(view2, now, fs);
            } catch (e) {
              (_a2 = opts.onError) == null ? void 0 : _a2.call(opts, e);
            }
          }
          const pulse = readExitPulse(opts.dataDir, fs);
          const exitFires = exitPulseFires(pulse);
          const events = exitFires ? [...(_b2 = opts.events) != null ? _b2 : [], { kind: "obsidian-exit" }] : [...(_c2 = opts.events) != null ? _c2 : []];
          const result = await runTick({
            dataDir: opts.dataDir,
            registry,
            views: views2,
            now,
            sessionStart: opts.sessionStart,
            events,
            liveIds: (_d = opts.liveIds) != null ? _d : /* @__PURE__ */ new Set(),
            values: readThresholds(views2, opts.vaultPath, fs),
            fs,
            execute: (view2, rule, runId) => executeOne(view2, rule, runId, opts, fs),
            remind: (view2, rule) => {
              var _a3;
              return (_a3 = opts.onRemind) == null ? void 0 : _a3.call(opts, view2, rule);
            },
            shouldStop: () => lock.lost()
          });
          if (exitFires) clearExitPulse(opts.dataDir, fs);
          (_e = opts.onPlan) == null ? void 0 : _e.call(opts, result.decisions, result);
          return { registry, views: views2, result };
        },
        { fs, now, keepAliveMs: (_b = opts.keepAliveMs) != null ? _b : KEEP_ALIVE_MS }
      );
    } catch (e) {
      (_c = opts.onError) == null ? void 0 : _c.call(opts, e);
      return { skipped: "error" };
    }
    if (inner === null) return { skipped: "locked" };
    return { skipped: inner.skip, registry: inner.registry, views: inner.views, result: inner.result };
  }
  function readThresholds(views2, vaultPath, fs) {
    var _a;
    const out = /* @__PURE__ */ new Map();
    const docs = /* @__PURE__ */ new Map();
    for (const view2 of views2) {
      for (const rule of view2.rules) {
        const t = rule.trigger;
        if (t.kind !== "value-threshold") continue;
        const file = vaultFileOf(t.path, vaultPath);
        if (!file) continue;
        let doc;
        if (docs.has(file)) {
          doc = docs.get(file);
        } else {
          doc = void 0;
          const size = (_a = fs.size) == null ? void 0 : _a.call(fs, file);
          const text = size !== void 0 && size > MAX_THRESHOLD_BYTES ? null : fs.readText(file);
          if (text !== null && text.length <= MAX_THRESHOLD_BYTES) {
            try {
              doc = JSON.parse(text);
            } catch (e) {
              doc = void 0;
            }
          }
          docs.set(file, doc);
        }
        const n = pickNumber(doc, t.key);
        if (n !== void 0) out.set(thresholdKey(view2.id, rule.id), n);
      }
    }
    return out;
  }
  function vaultFileOf(p, vaultPath) {
    const raw = String(p != null ? p : "").trim();
    if (!raw) return null;
    if (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith("//")) return raw;
    const root = vaultPath == null ? void 0 : vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
    if (raw.startsWith("/")) return root ? `${root}${raw}` : null;
    return root ? joinPath(root, raw) : null;
  }
  function pickNumber(doc, key) {
    const parts = String(key != null ? key : "").split(".").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return void 0;
    let cur = doc;
    for (const part of parts) {
      if (cur === null || typeof cur !== "object") return void 0;
      cur = cur[part];
    }
    return typeof cur === "number" && Number.isFinite(cur) ? cur : void 0;
  }
  async function executeOne(view2, rule, runId, opts, fs) {
    var _a;
    const at = (/* @__PURE__ */ new Date()).toISOString();
    if (!view2.entry) {
      return {
        ok: false,
        status: "failed",
        runId,
        code: null,
        stderr: "",
        error: new Error("没有可执行的启动命令"),
        kind: "config",
        startedAt: at,
        finishedAt: at,
        durationMs: 0,
        recordMissing: "声明里没有 entry，跑不起来"
      };
    }
    const live3 = runToolNow({
      toolId: view2.id,
      declPath: view2.path,
      entry: view2.entry,
      manifest: view2.manifest,
      values: view2.values,
      vaultPath: opts.vaultPath,
      trigger: "auto",
      // 工单号由内核定（pending 里已经记下），这里必须原样传
      runId,
      records: () => parseRunLines(readRunsText(pathOf.runs(view2.path), fs, RUNS_TAIL_BYTES), view2.id),
      cb: {
        onStep: (text) => {
          var _a2;
          return (_a2 = opts.onStep) == null ? void 0 : _a2.call(opts, view2, text, runId);
        }
        // 没人可问 = 立即按取消回（`exec` 的既有约定），这里不需要额外处理
      }
    });
    const outcome = await live3.done;
    (_a = opts.onOutcome) == null ? void 0 : _a.call(opts, view2, outcome);
    return outcome;
  }
  var KEEP_ALIVE_MS, MAX_THRESHOLD_BYTES;
  var init_tick_once = __esm({
    "src/dock/tick-once.ts"() {
      init_kernel();
      init_lock();
      init_view();
      init_registry_file();
      init_files();
      init_parse();
      init_exec();
      init_exit_pulse();
      init_types();
      KEEP_ALIVE_MS = 2e4;
      MAX_THRESHOLD_BYTES = 2 * 1024 * 1024;
    }
  });

  // src/dock/host.ts
  function vaultBasePath(a) {
    var _a;
    const adapter = a.vault.adapter;
    try {
      return (_a = adapter == null ? void 0 : adapter.getBasePath) == null ? void 0 : _a.call(adapter);
    } catch (e) {
      return void 0;
    }
  }
  function dataDir() {
    return dirOf(registryPath());
  }
  function kickDockScheduler() {
    return tick();
  }
  function notifyDockEvent(ev) {
    if (app === null) return;
    pendingEvents.push(ev);
    if (pendingEvents.length > 200) pendingEvents = pendingEvents.slice(-200);
    void kickDockScheduler();
  }
  async function tick() {
    const a = app;
    if (a === null || unloaded === null || ticking) return;
    if (unloaded()) return;
    ticking = true;
    try {
      const res = await tickOnce({
        dataDir: dataDir(),
        registryPath: registryPath(),
        trust: readTrust(),
        sessionStart,
        events: pendingEvents,
        vaultPath: vaultBasePath(a),
        owner: "plugin",
        liveIds: new Set(liveAll().map((r) => r.toolId)),
        onOutcome: (view2, outcome) => announce(view2, outcome),
        onRemind: remindOf
      });
      if (!res.result) return;
      pendingEvents = [];
      if (res.views) reportMissingParams(res.result.decisions, res.views);
    } catch (e) {
    } finally {
      ticking = false;
    }
  }
  function announce(view2, outcome) {
    var _a, _b, _c;
    const name = (_b = (_a = view2.manifest) == null ? void 0 : _a.name) != null ? _b : view2.id;
    if (outcome.ok) {
      notify(`${name} 跑完了`, { type: "success" });
      return;
    }
    if (outcome.status === "stopped") {
      notify(`${name} 已中止`, { type: "warning" });
      return;
    }
    notify(`${name} 失败：${(_c = outcome.recordMissing) != null ? _c : "看运行记录里的 stderr 尾部"}`, { type: "error" });
  }
  function remindOf(view2, rule) {
    var _a, _b, _c;
    const why = ((_a = rule.name) == null ? void 0 : _a.trim()) || "规则";
    notify(`${(_c = (_b = view2.manifest) == null ? void 0 : _b.name) != null ? _c : view2.id}：该手动跑一次了（${why}）`, { type: "info" });
  }
  function reportMissingParams(decisions, views2) {
    var _a, _b;
    for (const d of decisions) {
      if (d.reason !== "missing-params" || warned.has(d.toolId)) continue;
      warned.add(d.toolId);
      const v = views2.find((x) => x.id === d.toolId);
      if (v) notify(`${(_b = (_a = v.manifest) == null ? void 0 : _a.name) != null ? _b : v.id} 没自动跑：必填参数还没填`, { type: "warning" });
    }
  }
  async function runToolManually(view2, opts = {}) {
    var _a, _b;
    const a = app;
    if (!a) return null;
    const name = (_b = (_a = view2.manifest) == null ? void 0 : _a.name) != null ? _b : view2.id;
    if (liveOf(view2.id)) {
      notify(`${name} 正在跑，等它结束`, { type: "info" });
      return null;
    }
    const attempt = () => withLock(dataDir(), "plugin", async () => {
      if (!view2.entry) return null;
      const runId = makeRunId();
      markRunning(view2, runId, Date.now());
      try {
        return runToolNow({
          toolId: view2.id,
          declPath: view2.path,
          entry: view2.entry,
          manifest: view2.manifest,
          values: view2.values,
          vaultPath: vaultBasePath(a),
          trigger: "manual",
          extraArgs: opts.extraArgs,
          runId,
          records: () => parseRunLines(readRunsText(pathOf.runs(view2.path), currentFs(), RUNS_TAIL_BYTES), view2.id),
          cb: { onStep: opts.onStep }
        });
      } catch (e) {
        clearRunning(view2);
        throw e;
      }
    }, { keepAliveMs: KEEP_ALIVE_MS });
    let live3 = null;
    for (let i = 0; i < 4; i += 1) {
      live3 = await attempt();
      if (live3) break;
      if (i < 3) await new Promise((r) => setTimeout(r, 350));
    }
    if (!live3) {
      notify(`${name} 没能开始：调度权正被占用（值守在跑别的工具），过一会儿再点`, { type: "warning" });
      return null;
    }
    let outcome;
    try {
      outcome = await live3.done;
    } finally {
      clearRunning(view2);
    }
    announce(view2, outcome);
    return outcome;
  }
  async function clearBreakerSafely(view2) {
    const ok = await withLock(dataDir(), "plugin", () => {
      clearBreaker(view2);
      return true;
    }, { keepAliveMs: KEEP_ALIVE_MS });
    return ok === true;
  }
  var app, unloaded, sessionStart, ticking, pendingEvents, warned;
  var init_host = __esm({
    "src/dock/host.ts"() {
      init_fake_obsidian();
      init_notice();
      init_domain_bus();
      init_files();
      init_kernel();
      init_exec();
      init_lock();
      init_tick_once();
      init_view();
      init_registry();
      init_files();
      init_parse();
      init_types();
      app = null;
      unloaded = null;
      sessionStart = 0;
      ticking = false;
      pendingEvents = [];
      warned = /* @__PURE__ */ new Set();
    }
  });

  // prototypes/dock/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    boot: () => boot,
    closeDock: () => closeDock,
    openDock: () => openDock,
    unloadDock: () => unloadDock
  });
  init_fake_obsidian();
  init_app();
  init_settings_provider();
  init_files();
  init_exec();
  init_parse();

  // src/dock/ui.ts
  init_fake_obsidian();
  init_z_order();

  // src/core/mask-dismiss.ts
  var MASK_DISMISS_SLOP = 8;
  function bindMaskDismiss(mask, onDismiss) {
    let armed = null;
    let dragged = false;
    let upOnMask = false;
    let downX = 0;
    let downY = 0;
    const pointOf = (e) => {
      var _a;
      if (typeof TouchEvent !== "undefined" && e instanceof TouchEvent) {
        const t = (_a = e.changedTouches[0]) != null ? _a : e.touches[0];
        return t ? { x: t.clientX, y: t.clientY } : null;
      }
      const m = e;
      if (typeof m.clientX !== "number" || typeof m.clientY !== "number") return null;
      return { x: m.clientX, y: m.clientY };
    };
    const onDown = (e) => {
      const m = e;
      if (typeof m.button === "number" && m.button !== 0) {
        armed = null;
        return;
      }
      armed = e.target === mask;
      dragged = false;
      upOnMask = false;
      const p = pointOf(e);
      if (p) {
        downX = p.x;
        downY = p.y;
      }
    };
    const onUp = (e) => {
      upOnMask = e.target === mask;
    };
    const onMove = (e) => {
      if (armed !== true || dragged) return;
      const p = pointOf(e);
      if (!p) return;
      if (Math.abs(p.x - downX) > MASK_DISMISS_SLOP || Math.abs(p.y - downY) > MASK_DISMISS_SLOP) dragged = true;
    };
    const onCancel = () => {
      armed = false;
      dragged = true;
    };
    const onClick = (e) => {
      const wasArmed = armed;
      const wasDragged = dragged;
      const wasUpOnMask = upOnMask;
      armed = null;
      dragged = false;
      upOnMask = false;
      if (wasArmed === false) return;
      if (wasArmed === true && (wasDragged || !wasUpOnMask)) return;
      if (e.target === mask) onDismiss();
    };
    mask.addEventListener("mousedown", onDown, true);
    mask.addEventListener("mouseup", onUp, true);
    mask.addEventListener("mousemove", onMove, true);
    mask.addEventListener("touchstart", onDown, { capture: true, passive: true });
    mask.addEventListener("touchend", onUp, { capture: true, passive: true });
    mask.addEventListener("touchmove", onMove, { capture: true, passive: true });
    mask.addEventListener("touchcancel", onCancel, true);
    mask.addEventListener("click", onClick);
    return () => {
      mask.removeEventListener("mousedown", onDown, true);
      mask.removeEventListener("mouseup", onUp, true);
      mask.removeEventListener("mousemove", onMove, true);
      mask.removeEventListener("touchstart", onDown, true);
      mask.removeEventListener("touchend", onUp, true);
      mask.removeEventListener("touchmove", onMove, true);
      mask.removeEventListener("touchcancel", onCancel, true);
      mask.removeEventListener("click", onClick);
    };
  }

  // src/core/path-picker.ts
  init_fake_obsidian();
  init_app();

  // src/core/dom.ts
  init_notice();
  init_z_order();
  function longPress(el2, cb, dur, filter) {
    if (!dur) dur = 500;
    let timer = null, touching = false, fired = false, moved = false, sx = 0, sy = 0;
    let suppressClick = false;
    const M = 10;
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
      if (Math.abs(t.clientX - sx) > M || Math.abs(t.clientY - sy) > M) {
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
    el2.addEventListener("mousedown", start);
    el2.addEventListener("mouseup", endFromMouse);
    el2.addEventListener("mouseleave", endFromMouse);
    el2.addEventListener("touchstart", start, { passive: true });
    el2.addEventListener("touchend", endFromTouch);
    el2.addEventListener("touchmove", move, { passive: true });
    el2.addEventListener("touchcancel", endFromTouch);
    el2.addEventListener("click", onClick, true);
  }

  // src/core/esc-manager.ts
  var escManager = (() => {
    const layers = [];
    let disabled = false;
    const onKeydown = (e) => {
      if (disabled) return;
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
      /** 插件卸载时软关（N1）：只置 disabled 旗标——不摘 document 监听（模块 IIFE
       *  常驻单例，Obsidian 禁用→再启用不重新求值，摘了就全站 ESC 永久失效）、
       *  不清 layers（重启用后旧层由 isVisible 判活自愈）。恢复走 arm()。 */
      destroy() {
        disabled = true;
      },
      /** 插件（重）启用时恢复 ESC 处理（main.ts onload 调用；幂等） */
      arm() {
        disabled = false;
      }
    };
  })();

  // src/core/path-picker.ts
  init_notice();

  // src/core/ui/icon.ts
  init_fake_obsidian();
  function uiIcon(name, extraClass = "") {
    const i = document.createElement("span");
    i.className = "bz-ic" + (extraClass ? " " + extraClass : "");
    setIcon(i, name);
    return i;
  }

  // src/core/path-picker.ts
  function requireNode(moduleName) {
    var _a;
    try {
      const w = window;
      return w.require ? (_a = w.require(moduleName)) != null ? _a : null : null;
    } catch (e) {
      return null;
    }
  }
  function fileDiskPath(f) {
    var _a, _b;
    const legacy = f.path;
    if (typeof legacy === "string" && legacy) return legacy;
    const webUtils = (_a = requireNode("electron")) == null ? void 0 : _a.webUtils;
    if (webUtils == null ? void 0 : webUtils.getPathForFile) {
      try {
        return String((_b = webUtils.getPathForFile(f)) != null ? _b : "");
      } catch (e) {
      }
    }
    return "";
  }

  // src/core/mobile.ts
  init_fake_obsidian();
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
  }

  // src/core/ui/focus-trap.ts
  var FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function isHidden(el2) {
    let cur = el2;
    while (cur && cur !== document.body) {
      if (cur.classList.contains("bz-setting-hidden")) return true;
      if (cur.style.display === "none") return true;
      cur = cur.parentElement;
    }
    return false;
  }
  function firstFocusable(container) {
    const list = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el2) => {
      if (isHidden(el2)) return false;
      if (isMobileEnv()) {
        const tag = el2.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return false;
      }
      return true;
    });
    return list[0] || null;
  }
  function trapFocus(container) {
    const onKeydown = (e) => {
      if (e.key !== "Tab") return;
      const items = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el2) => !isHidden(el2) && !el2.hasAttribute("disabled")
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && active !== container && container.contains(active);
      if (e.shiftKey) {
        if (active === first || !inside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !inside) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKeydown);
    return () => container.removeEventListener("keydown", onKeydown);
  }
  var PANEL_FOCUS_CLASS = "bz-panel-focushost";
  function trapPanelFocus(panel) {
    panel.classList.add(PANEL_FOCUS_CLASS);
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    const release = trapFocus(panel);
    panel.focus({ preventScroll: true });
    return release;
  }

  // src/dock/ui.ts
  init_notice();

  // src/core/ui/icons.ts
  init_fake_obsidian();

  // src/core/ui/button.ts
  function uiBtn(opts) {
    const b = document.createElement("button");
    b.type = "button";
    const cls = ["bz-btn"];
    if (opts.tone && opts.tone !== "default") cls.push(`bz-btn--${opts.tone}`);
    if (opts.size && opts.size !== "md") cls.push(`bz-btn--${opts.size}`);
    if (opts.chip) cls.push("bz-btn--chip");
    if (opts.on) cls.push("is-on");
    if (opts.className) cls.push(opts.className);
    b.className = cls.join(" ");
    if (opts.title) b.title = opts.title;
    if (opts.disabled) b.disabled = true;
    if (opts.icon) {
      if (opts.chip) {
        const chip = document.createElement("span");
        chip.className = "bz-btn-chip";
        chip.appendChild(uiIcon(opts.icon));
        b.appendChild(chip);
      } else {
        b.appendChild(uiIcon(opts.icon));
      }
    }
    if (opts.label) {
      const span = document.createElement("span");
      span.textContent = opts.label;
      b.appendChild(span);
    }
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }
  function uiIconBtn(opts) {
    const b = document.createElement("button");
    b.type = "button";
    const cls = ["bz-icon-btn"];
    if (opts.on) cls.push("bz-icon-btn--on");
    if (opts.lg) cls.push("bz-icon-btn--lg");
    if (opts.xs) cls.push("bz-icon-btn--xs");
    if (opts.close) cls.push("bz-icon-btn--close");
    if (opts.className) cls.push(opts.className);
    b.className = cls.join(" ");
    if (opts.title) b.title = opts.title;
    if (opts.disabled) b.disabled = true;
    if (opts.danger) b.setAttribute("data-danger", "");
    b.appendChild(uiIcon(opts.icon));
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }
  function uiBtnRow(buttons, opts) {
    const row = document.createElement("div");
    const cls = ["bz-btn-row"];
    if (opts == null ? void 0 : opts.center) cls.push("bz-btn-row--center");
    if (opts == null ? void 0 : opts.grow) cls.push("bz-btn-row--grow");
    row.className = cls.join(" ");
    buttons.forEach((x) => row.appendChild(x));
    return row;
  }

  // src/core/ui/field.ts
  function uiInput(opts) {
    const inp = document.createElement("input");
    inp.className = "bz-input" + (opts.error ? " bz-input--error" : "");
    inp.type = opts.type || "text";
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    if (opts.value !== void 0) inp.value = opts.value;
    if (opts.disabled) inp.disabled = true;
    if (opts.onInput) inp.addEventListener("input", () => {
      var _a;
      return (_a = opts.onInput) == null ? void 0 : _a.call(opts, inp.value);
    });
    return inp;
  }
  function isLabelable(ctrl) {
    const tag = ctrl.tagName;
    if (tag === "BUTTON" || tag === "SELECT" || tag === "TEXTAREA") return true;
    if (tag === "INPUT") return ctrl.type !== "hidden";
    return false;
  }
  function uiField(opts) {
    const wrap = isLabelable(opts.control) ? document.createElement("label") : document.createElement("div");
    wrap.className = "bz-field";
    if (opts.label) {
      const l = document.createElement("span");
      l.className = "bz-field-label";
      l.textContent = opts.label;
      wrap.appendChild(l);
    }
    wrap.appendChild(opts.control);
    if (opts.error) {
      if (opts.control.classList.contains("bz-input")) opts.control.classList.add("bz-input--error");
      const e = document.createElement("span");
      e.className = "bz-field-error";
      e.textContent = opts.error;
      wrap.appendChild(e);
    } else if (opts.desc) {
      const d = document.createElement("span");
      d.className = "bz-field-desc";
      d.textContent = opts.desc;
      wrap.appendChild(d);
    }
    return wrap;
  }

  // src/core/ui/empty.ts
  function uiEmpty(opts) {
    const el2 = document.createElement("div");
    el2.className = "bz-empty";
    if (opts.icon) {
      const ic = uiIcon(opts.icon);
      ic.classList.add("bz-empty-ic");
      el2.appendChild(ic);
    }
    const t = document.createElement("div");
    t.className = "bz-empty-title";
    t.textContent = opts.title;
    el2.appendChild(t);
    if (opts.desc) {
      const d = document.createElement("div");
      d.className = "bz-empty-desc";
      d.textContent = opts.desc;
      el2.appendChild(d);
    }
    if (opts.actions) el2.appendChild(opts.actions);
    return el2;
  }

  // src/core/ui/choice.ts
  function uiChoice(opts) {
    const el2 = document.createElement("div");
    el2.className = "bz-choice" + (opts.float ? " bz-choice--float" : "") + (opts.className ? " " + opts.className : "");
    el2.setAttribute("role", "radiogroup");
    el2.setAttribute("aria-label", opts.label || "");
    const btns = /* @__PURE__ */ new Map();
    let cur = opts.value;
    const seg = document.createElement("span");
    seg.className = "bz-choice-seg";
    let segRAF = 0;
    let segTries = 0;
    const syncSeg = (animate) => {
      if (!opts.float) return;
      const on = el2.querySelector(".bz-choice-btn.is-on");
      if (!on) return;
      const tb = el2.getBoundingClientRect();
      const bb = on.getBoundingClientRect();
      if (!el2.isConnected || !tb.width || !bb.width) {
        if (segTries++ > 120) return;
        cancelAnimationFrame(segRAF);
        segRAF = requestAnimationFrame(() => syncSeg(false));
        return;
      }
      segTries = 0;
      if (!animate) seg.style.transition = "none";
      seg.style.width = `${bb.width}px`;
      seg.style.transform = `translateX(${bb.left - tb.left}px)`;
      if (!animate) {
        void seg.offsetWidth;
        seg.style.transition = "";
      }
    };
    const onWinResize = () => {
      if (!el2.isConnected) {
        window.removeEventListener("resize", onWinResize);
        return;
      }
      syncSeg(false);
    };
    if (opts.float) {
      window.addEventListener("resize", onWinResize);
    }
    opts.options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bz-choice-btn" + (o.value === opts.value ? " is-on" : "");
      b.dataset.value = String(o.value);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.value === opts.value));
      if (o.dot) {
        const d = document.createElement("span");
        d.className = "bz-choice-dot";
        d.style.background = o.dot;
        b.appendChild(d);
      }
      b.appendChild(document.createTextNode(o.label));
      b.addEventListener("click", () => {
        setValue(o.value);
        opts.onChange(o.value);
      });
      b.addEventListener("keydown", (e) => {
        var _a;
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const vals = opts.options.map((x) => x.value);
        const curIdx = vals.indexOf(cur);
        const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const nextIdx = (curIdx + delta + vals.length) % vals.length;
        setValue(vals[nextIdx]);
        opts.onChange(vals[nextIdx]);
        (_a = btns.get(vals[nextIdx])) == null ? void 0 : _a.focus();
      });
      btns.set(o.value, b);
      el2.appendChild(b);
    });
    if (opts.float) el2.appendChild(seg);
    function setValue(v) {
      cur = v;
      btns.forEach((b, k) => {
        const on = k === v;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(on));
      });
      if (opts.float) syncSeg(true);
    }
    syncSeg(false);
    const detach = () => {
      cancelAnimationFrame(segRAF);
      window.removeEventListener("resize", onWinResize);
    };
    return { el: el2, setValue, detach };
  }

  // src/core/ui/switch.ts
  function uiSwitch(opts) {
    const el2 = document.createElement("span");
    el2.className = "bz-sw" + (opts.checked ? " on" : "") + (opts.disabled ? " is-disabled" : "");
    el2.setAttribute("role", "switch");
    el2.setAttribute("aria-checked", String(!!opts.checked));
    el2.setAttribute("aria-disabled", String(!!opts.disabled));
    el2.tabIndex = opts.disabled ? -1 : 0;
    const setChecked = (v) => {
      el2.classList.toggle("on", v);
      el2.setAttribute("aria-checked", String(v));
    };
    const setDisabled = (v) => {
      el2.classList.toggle("is-disabled", v);
      el2.setAttribute("aria-disabled", String(v));
      el2.tabIndex = v ? -1 : 0;
    };
    const enabled = () => !el2.classList.contains("is-disabled");
    const toggle = () => {
      var _a;
      if (!enabled()) return;
      const next = !el2.classList.contains("on");
      setChecked(next);
      (_a = opts.onChange) == null ? void 0 : _a.call(opts, next);
    };
    el2.addEventListener("click", toggle);
    el2.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    });
    return { el: el2, setChecked, setDisabled };
  }

  // src/core/ui/select.ts
  function uiSelect(opts) {
    const el2 = document.createElement("div");
    el2.className = "bz-select" + (opts.className ? " " + opts.className : "");
    el2.setAttribute("role", "listbox");
    el2.setAttribute("aria-expanded", "false");
    el2.tabIndex = 0;
    const val = document.createElement("span");
    val.className = "bz-select-val";
    el2.appendChild(val);
    el2.appendChild(uiIcon("chevron-down", "bz-select-car"));
    let current = opts.value;
    let menu = null;
    let escHandle2 = null;
    const labelOf = (v) => {
      const o = opts.options.find((x) => x.value === v);
      return o ? o.label : "";
    };
    const renderVal = () => {
      val.textContent = labelOf(current) || opts.placeholder || "";
    };
    renderVal();
    const close = (notify2 = true) => {
      var _a;
      if (menu) {
        menu.remove();
        menu = null;
      }
      if (escHandle2) {
        escHandle2.unregister();
        escHandle2 = null;
      }
      el2.classList.remove("open");
      el2.setAttribute("aria-expanded", "false");
      if (notify2) (_a = opts.onOpenChange) == null ? void 0 : _a.call(opts, false);
    };
    const open = () => {
      var _a;
      close(false);
      el2.classList.add("open");
      el2.setAttribute("aria-expanded", "true");
      (_a = opts.onOpenChange) == null ? void 0 : _a.call(opts, true);
      const m = document.createElement("div");
      m.className = "bz-select-menu";
      m.setAttribute("role", "listbox");
      menu = m;
      opts.options.forEach((o, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bz-select-item" + (o.value === current ? " is-on" : "");
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(o.value === current));
        b.dataset.index = String(i);
        const span = document.createElement("span");
        span.textContent = o.label;
        b.appendChild(span);
        b.appendChild(uiIcon("check", "bz-select-item-ck"));
        b.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setValue(o.value);
          opts.onChange(o.value);
          close();
        });
        m.appendChild(b);
      });
      el2.appendChild(m);
      for (let round = 0; round < 3; round++) {
        let delta = 0;
        m.querySelectorAll(".bz-select-item > span").forEach((sp) => {
          delta = Math.max(delta, sp.scrollWidth - sp.clientWidth);
        });
        if (delta <= 0) break;
        const cs = getComputedStyle(m);
        const border = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
        m.style.minWidth = `${m.clientWidth + delta - border}px`;
      }
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const rect = m.getBoundingClientRect();
      const over = Math.ceil(rect.right - vw) + 2;
      if (over > 0) {
        m.style.right = `${over}px`;
        if (m.getBoundingClientRect().left < 2) m.style.right = "";
      }
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const mRect = m.getBoundingClientRect();
      const need = mRect.height || m.offsetHeight;
      const spaceBelow = vh - mRect.bottom;
      if (need > 0 && spaceBelow < need && spaceBelow < mRect.top) {
        m.classList.add("is-flip-up");
      }
      escHandle2 = escManager.register("bz-ui-select", {
        isVisible: () => !!menu && menu.isConnected,
        close: () => close()
      });
    };
    const setValue = (v) => {
      current = v;
      renderVal();
      if (menu) {
        opts.options.forEach((o, i) => {
          const item = menu == null ? void 0 : menu.querySelectorAll(".bz-select-item")[i];
          if (!item) return;
          const on = o.value === v;
          item.classList.toggle("is-on", on);
          item.setAttribute("aria-selected", String(on));
        });
      }
    };
    const moveFocus = (delta) => {
      if (!menu) return;
      const curIdx = opts.options.findIndex((o) => o.value === current);
      const nextIdx = Math.min(opts.options.length - 1, Math.max(0, (curIdx < 0 ? 0 : curIdx) + delta));
      opts.options.forEach((o, i) => {
        const item = menu == null ? void 0 : menu.querySelectorAll(".bz-select-item")[i];
        if (!item) return;
        const on = i === nextIdx;
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-selected", String(on));
      });
    };
    el2.addEventListener("click", () => {
      if (menu) close();
      else open();
    });
    el2.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (menu) {
          const on = menu == null ? void 0 : menu.querySelector(".bz-select-item.is-on");
          if (on && on !== el2) {
            const v = opts.options[Number(on.dataset.index)];
            if (v) {
              setValue(v.value);
              opts.onChange(v.value);
            }
          }
          close();
        } else open();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!menu) open();
        moveFocus(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    });
    const onDocClick = (e) => {
      if (menu && !el2.contains(e.target)) close();
    };
    document.addEventListener("click", onDocClick);
    return {
      el: el2,
      setValue,
      detach: () => {
        document.removeEventListener("click", onDocClick);
        close(false);
      }
    };
  }

  // src/core/ui/search.ts
  function uiSearch(opts) {
    const el2 = document.createElement("div");
    el2.className = "bz-search";
    el2.appendChild(uiIcon("search"));
    const input = uiInput({
      placeholder: opts.placeholder,
      value: opts.value,
      onInput: opts.onInput
    });
    el2.appendChild(input);
    let clearBtn = null;
    if (opts.clearable !== false) {
      clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "bz-search-clear";
      clearBtn.title = "清除搜索";
      clearBtn.setAttribute("aria-label", "清除搜索");
      clearBtn.hidden = !input.value.trim();
      clearBtn.appendChild(uiIcon("x"));
      clearBtn.addEventListener("click", () => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
      input.addEventListener("input", () => {
        if (clearBtn) clearBtn.hidden = !input.value.trim();
      });
      el2.appendChild(clearBtn);
    }
    const syncClear = () => {
      if (clearBtn) clearBtn.hidden = !input.value.trim();
    };
    const setValue = (v) => {
      input.value = v;
      syncClear();
    };
    return { el: el2, input, setValue, syncClear };
  }

  // src/core/ui/rail.ts
  init_fake_obsidian();

  // src/core/ui/progress.ts
  function uiProgress(opts = {}) {
    const el2 = document.createElement("div");
    const cls = ["bz-progress"];
    if (opts.thin) cls.push("bz-progress--thin");
    if (opts.tone) cls.push(`bz-progress--${opts.tone}`);
    el2.className = cls.join(" ");
    const fill = document.createElement("i");
    el2.appendChild(fill);
    const setValue = (n) => {
      const v = Math.min(100, Math.max(0, Number(n) || 0));
      fill.style.width = v + "%";
    };
    if (opts.value !== void 0) setValue(opts.value);
    return { el: el2, setValue };
  }

  // src/core/ui/help-tip.ts
  init_z_order();

  // src/core/ui/lightbox.ts
  init_z_order();

  // src/core/ui/modal.ts
  init_z_order();
  var liveModals = /* @__PURE__ */ new Set();
  function uiModal(opts) {
    var _a;
    const prevActive = document.activeElement;
    const focusEnabled = opts.autofocus !== false;
    const mask = document.createElement("div");
    mask.className = "bz-overlay-mask";
    mask.style.zIndex = String(allocZ());
    const popup = document.createElement("div");
    popup.className = "bz-overlay-popup" + (opts.className ? " " + opts.className : "");
    if (opts.maxWidth) popup.style.maxWidth = `min(${opts.maxWidth}px, calc(100vw - 32px))`;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    if (opts.title) popup.setAttribute("aria-label", opts.title);
    if (opts.head) {
      const head = document.createElement("div");
      head.className = "bz-dialog-head";
      const title = document.createElement("span");
      title.className = "bz-dialog-title";
      title.textContent = opts.title || "";
      head.appendChild(title);
      popup.appendChild(head);
    }
    const body = document.createElement("div");
    body.className = "bz-dialog-body";
    if (typeof opts.content === "string") body.innerHTML = opts.content;
    else body.appendChild(opts.content);
    popup.appendChild(body);
    mask.appendChild(popup);
    let closed = false;
    let escHandle2 = null;
    const releaseTrap = focusEnabled ? trapFocus(popup) : null;
    function close() {
      var _a2;
      if (closed) return;
      closed = true;
      liveModals.delete(close);
      releaseTrap == null ? void 0 : releaseTrap();
      mask.remove();
      escHandle2 == null ? void 0 : escHandle2.unregister();
      if (focusEnabled && prevActive instanceof HTMLElement && prevActive.isConnected) {
        prevActive.focus();
      }
      (_a2 = opts.onClose) == null ? void 0 : _a2.call(opts);
    }
    const attemptClose = () => {
      if (opts.requestClose) opts.requestClose();
      else close();
    };
    if (opts.closable !== false) {
      bindMaskDismiss(mask, attemptClose);
      escHandle2 = escManager.register("bz-modal", {
        isVisible: () => mask.isConnected,
        close: attemptClose
      });
    }
    document.body.appendChild(mask);
    if (focusEnabled) (_a = firstFocusable(popup)) == null ? void 0 : _a.focus();
    liveModals.add(close);
    return { mask, popup, close };
  }

  // src/core/ui/str.ts
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function relTime(s, now = Date.now()) {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T"));
    if (isNaN(d.getTime())) return s;
    const diff = now - d.getTime();
    const m = 6e4, h = 36e5, day = 864e5;
    if (diff < m) return "刚刚";
    if (diff < h) return Math.floor(diff / m) + " 分钟前";
    if (diff < day) return Math.floor(diff / h) + " 小时前";
    if (diff < 7 * day) return Math.floor(diff / day) + " 天前";
    return `${d.getMonth() + 1}-${pad2(d.getDate())}`;
  }

  // src/core/item-actions.ts
  init_z_order();
  init_fake_obsidian();
  function renderIcon(container, iconId) {
    try {
      setIcon(container, iconId);
    } catch (e) {
    }
  }
  var VIEWPORT_PAD = 8;
  var ANCHOR_GAP = 12;
  var ITEM_HEIGHT = 30;
  var MENU_PADDING = 10;
  var TOUCH_SETTLE_MS = 400;
  var popupEl = null;
  var sheetMask = null;
  var sheetBodyEl = null;
  var sheetHeadEl = null;
  var sheetCompanions = /* @__PURE__ */ new Set();
  var menuEsc = null;
  var prevFocus = null;
  var suppressNextClick = false;
  var residualClickArmed = false;
  var touchSettlePending = false;
  var touchSettleTimer = null;
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

  // src/dock/ui.ts
  init_view();
  init_registry();
  init_files();
  init_parse();
  init_rules();

  // src/dock/command.ts
  init_fake_obsidian();
  init_notice();
  init_view();
  init_registry();
  init_kernel();
  init_exec();
  function judgeRunGate(view2, canRun2) {
    if (!view2) return { ok: false, reason: "no-tool", text: "这个工具没登记" };
    if (!canRun2) return { ok: false, reason: "mobile", text: "手机上只能看，不能跑" };
    if (!view2.entry) return { ok: false, reason: "no-entry", text: "声明里没有启动命令（entry）" };
    if (!view2.trusted) return { ok: false, reason: "untrusted", text: "这条命令还没授权，先在面板里确认" };
    if (liveOf(view2.id)) return { ok: false, reason: "running", text: "它正在跑" };
    const missing = missingParams(view2);
    if (missing.length) return { ok: false, reason: "params", text: `还有必填参数没填：${missing.join("、")}` };
    return { ok: true };
  }

  // src/dock/ui.ts
  init_exec();
  init_host();

  // src/dock/vault-fs.ts
  init_files();
  init_registry_file();
  init_parse();
  init_storage();
  init_types();
  var mem = /* @__PURE__ */ new Map();
  var primed = false;
  var basePath = "";
  function norm(p) {
    return p.replace(/\\/g, "/");
  }
  var memoryFs = {
    readText: (p) => {
      var _a;
      return (_a = mem.get(norm(p))) != null ? _a : null;
    },
    writeText: () => {
    },
    exists: (p) => mem.has(norm(p))
  };
  function baseOf(app2) {
    var _a;
    try {
      const adapter = app2.vault.adapter;
      const b = (_a = adapter == null ? void 0 : adapter.getBasePath) == null ? void 0 : _a.call(adapter);
      return typeof b === "string" ? norm(b).replace(/\/+$/, "") : "";
    } catch (e) {
      return "";
    }
  }
  function put(abs, text) {
    const p = norm(abs);
    mem.set(p, text);
    if (basePath && p.startsWith(`${basePath}/`)) mem.set(p.slice(basePath.length + 1), text);
    else if (basePath) mem.set(`${basePath}/${p.replace(/^\/+/, "")}`, text);
  }
  function isAbsolutePath(p) {
    return /^[a-zA-Z]:\//.test(p) || p.startsWith("/");
  }
  function toVaultRelative(p) {
    const s = norm(p);
    if (isPortablePath(s)) return s.slice(VAULT_PATH_PREFIX.length).replace(/^\/+/, "");
    if (!isAbsolutePath(s)) return s.replace(/^\.\/+/, "");
    if (basePath && s.startsWith(`${basePath}/`)) return s.slice(basePath.length + 1);
    return null;
  }
  async function primeVaultFs(app2) {
    basePath = baseOf(app2);
    const registryRel = storageFile(REGISTRY_FILENAME);
    await primeOne(app2, registryRel);
    const fs = memoryFs;
    let entries = [];
    try {
      entries = readRegistryAt(registryRel, fs).registry.tools;
    } catch (e) {
      entries = [];
    }
    for (const entry of entries) {
      const declAbs = resolveToolPath(entry.path);
      await primeOne(app2, declAbs);
      const rel = toVaultRelative(declAbs);
      if (!rel) continue;
      const dir = rel.slice(0, rel.lastIndexOf("/") + 1);
      for (const name of ["data.json", "dock.intent.json", "dock.runtime.json", "runs.jsonl", "heartbeat.json", "panel.html"]) {
        await primeOne(app2, `${dir}${name}`);
      }
    }
    primed = true;
  }
  async function primeOne(app2, p) {
    const rel = toVaultRelative(p);
    if (!rel) return;
    try {
      const text = await app2.vault.adapter.read(rel);
      put(p, text);
    } catch (e) {
    }
  }

  // src/dock/watchdog-status.ts
  init_files();

  // src/core/vault-key.ts
  function normalizeVaultPath(vault) {
    return String(vault || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  }
  function vaultKeyOf(vault) {
    const text = normalizeVaultPath(vault);
    if (!text) return "";
    let h = 2166136261;
    for (const byte of new TextEncoder().encode(text)) {
      h ^= byte;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  // src/dock/watchdog-status.ts
  var WATCHDOG_DIRNAME = "bz-dock-watch";
  function watchdogDirOf(env = guessEnv()) {
    var _a, _b, _c;
    const local = String((_a = env.LOCALAPPDATA) != null ? _a : "").trim();
    if (local) return `${local.replace(/[\\/]+$/, "")}/${WATCHDOG_DIRNAME}`;
    const home = String((_c = (_b = env.USERPROFILE) != null ? _b : env.HOME) != null ? _c : "").trim();
    if (home) return `${home.replace(/[\\/]+$/, "")}/AppData/Local/${WATCHDOG_DIRNAME}`;
    return WATCHDOG_DIRNAME;
  }
  function watchdogVaultDirOf(vault, env = guessEnv()) {
    const key = vaultKeyOf(vault);
    const root = watchdogDirOf(env);
    return key ? `${root}/vaults/${key}` : root;
  }
  function currentVaultPath() {
    try {
      const { getApp: getApp2 } = (init_app(), __toCommonJS(app_exports));
      const { vaultBasePathOf: vaultBasePathOf2 } = (init_plugin_path(), __toCommonJS(plugin_path_exports));
      return vaultBasePathOf2(getApp2());
    } catch (e) {
      return "";
    }
  }
  function activeWatchdogVault(fs = currentFs()) {
    const text = fs ? fs.readText(`${watchdogDirOf()}/active.json`) : null;
    if (!text) return null;
    try {
      const raw = JSON.parse(text);
      const vault = String((raw == null ? void 0 : raw.vault) || "").trim().replace(/[\\/]+$/, "");
      return vault ? { vault, key: vaultKeyOf(vault) } : null;
    } catch (e) {
      return null;
    }
  }
  function guessEnv() {
    var _a, _b;
    const g = globalThis;
    const env = (_b = (_a = g.process) == null ? void 0 : _a.env) != null ? _b : {};
    return { LOCALAPPDATA: env.LOCALAPPDATA, USERPROFILE: env.USERPROFILE, HOME: env.HOME };
  }
  function liveLogFileOf(toolId, vault = currentVaultPath()) {
    const safe = String(toolId || "unknown").replace(/[^A-Za-z0-9._-]/g, "_");
    return `${watchdogVaultDirOf(vault)}/live/${safe}.jsonl`;
  }
  function parseLiveLog(text, limit = 40) {
    if (!text) return [];
    const out = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const raw = JSON.parse(line);
        if (!raw || typeof raw !== "object") continue;
        const t = typeof raw.text === "string" ? raw.text : "";
        if (!t) continue;
        const step = { text: t };
        if (typeof raw.runId === "string") step.runId = raw.runId;
        if (typeof raw.at === "string") step.at = raw.at;
        out.push(step);
      } catch (e) {
      }
    }
    return out.slice(-limit);
  }
  function liveLogOf(toolId, limit = 40, fs = currentFs(), vault = currentVaultPath()) {
    if (!fs) return [];
    const file = liveLogFileOf(toolId, vault);
    const text = fs.readTail ? fs.readTail(file, 64 * 1024) : fs.readText(file);
    if (text === null && !activeWatchdogVault(fs)) {
      const legacy = `${watchdogDirOf()}/live/${String(toolId || "unknown").replace(/[^A-Za-z0-9._-]/g, "_")}.jsonl`;
      const old = fs.readTail ? fs.readTail(legacy, 64 * 1024) : fs.readText(legacy);
      return parseLiveLog(old, limit);
    }
    return parseLiveLog(text, limit);
  }

  // src/dock/ui.ts
  init_types();
  var hostApp = null;
  var overlay = null;
  var escHandle = null;
  var view = { kind: "list" };
  var query = "";
  var searchOpen = false;
  var kpiFilter = "all";
  var views = [];
  var tickTimer = null;
  var liveOff = null;
  var lastTails = /* @__PURE__ */ new Map();
  var recPrints = /* @__PURE__ */ new Map();
  var hbPrints = /* @__PURE__ */ new Map();
  var boardPrints = /* @__PURE__ */ new Map();
  var openRuns = /* @__PURE__ */ new Map();
  function openRunsOf(toolId) {
    let set = openRuns.get(toolId);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      openRuns.set(toolId, set);
    }
    return set;
  }
  var LAST_SEEN_KEY = "bz-dock:lastSeen";
  var OVERLAY_ID = "bz-dock-mask";
  var FRAME_ID = "bz-dock-panel";
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== void 0) n.textContent = text;
    return n;
  }
  function canRun() {
    return !Platform.isMobile;
  }
  function viewById(id) {
    return views.find((v) => v.id === id);
  }
  function todayKey(iso2) {
    const d = iso2 ? new Date(iso2) : /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function isToday(iso2) {
    const t = Date.parse(iso2);
    return Number.isFinite(t) && todayKey(iso2) === todayKey();
  }
  function dotClass(state) {
    switch (state) {
      case "ok":
        return "bz-dock-dot bz-dock-dot--ok";
      case "due":
      case "failed":
      case "timeout":
      case "abandoned":
        return "bz-dock-dot bz-dock-dot--bad";
      case "pending":
      case "running":
      case "stopped":
        return "bz-dock-dot bz-dock-dot--warn";
      default:
        return "bz-dock-dot bz-dock-dot--idle";
    }
  }
  function lastOf(v) {
    return v.lastRun;
  }
  function rateOf(v) {
    const runs = recentRunsOf(v.path, v.id, 60).filter((r) => r.status !== "running");
    if (!runs.length) return null;
    return runs.filter((r) => r.status === "ok").length / runs.length;
  }
  function dueOf(v) {
    var _a, _b;
    const enabled = v.rules.filter((r) => r.enabled !== false);
    if (!enabled.length) return { due: false, detail: "" };
    if (v.intent.enabled === false) return { due: false, detail: "" };
    if (v.intent.autoRun === false) return { due: false, detail: "" };
    const now = Date.now();
    const last = lastOf(v);
    for (const rule of enabled) {
      const firedRaw = (_b = (_a = v.runtime.rules) == null ? void 0 : _a[rule.id]) == null ? void 0 : _b.lastFiredAt;
      const fired = firedRaw ? Date.parse(firedRaw) : void 0;
      if (rule.trigger.kind === "daily") {
        const m = /^(\d{1,2}):(\d{1,2})$/.exec(rule.trigger.at);
        if (!m) continue;
        const at = /* @__PURE__ */ new Date();
        at.setHours(Number(m[1]), Number(m[2]), 0, 0);
        const done = !!last && last.status === "ok" && isToday(last.startedAt);
        if (now > at.getTime() && !done && (fired != null ? fired : 0) < at.getTime()) {
          return { due: true, detail: "今日未跑" };
        }
      } else if (rule.trigger.kind === "interval") {
        const span = rule.trigger.everyMin * 6e4;
        const base = fired != null ? fired : last ? Date.parse(last.startedAt) : void 0;
        if (base !== void 0 && now > base + span + 5 * 6e4) {
          return { due: true, detail: "该跑没跑" };
        }
      }
    }
    return { due: false, detail: "" };
  }
  function isAlarmView(v) {
    var _a, _b;
    if (dueOf(v).due) return true;
    if ((_a = v.runtime.run) == null ? void 0 : _a.pausedAt) return true;
    if (!v.trusted) return false;
    const s = (_b = v.lastRun) == null ? void 0 : _b.status;
    return s === "failed" || s === "timeout" || s === "abandoned";
  }
  function trustTagOf(v) {
    if (!canRun()) return null;
    if (!v.trusted) return v.trustStale ? "命令已变，待重新确认" : "未授权";
    return null;
  }
  function whenTextOf(v, last) {
    if (!last) return "还没有运行过";
    return relTime(last.startedAt.replace("T", " "));
  }
  function messageTextOf(v, last) {
    var _a;
    if (!v.manifest) return (_a = v.error) != null ? _a : "声明文件读不到，先把路径修好";
    const live3 = liveOf(v.id);
    if (live3) return live3.phase ? `正在${live3.phase}…` : "正在运行…";
    const ext = freshOf(v.heartbeat);
    if (ext) return ext.step ? `后台跑：${ext.step}` : "后台值守正在跑…";
    if (!v.entry) return "声明里没写 entry —— 只能看";
    if (!last) return "等它按自己的节奏跑一次";
    return last.message || statusText(last.status);
  }
  function failHintOf(last) {
    if (!last || !last.error) return null;
    if (last.status === "ok" || last.status === "running") return null;
    return hintOf(last.error.kind);
  }
  function freshOf(hb) {
    if (!hb) return null;
    const at = Date.parse(hb.at);
    if (!Number.isFinite(at)) return null;
    return Date.now() - at <= HEARTBEAT_STALE_MS ? hb : null;
  }
  function externalRunOf(v) {
    if (liveOf(v.id)) return null;
    return freshOf(v.heartbeat);
  }
  function untilText(ms) {
    const m = ms / 6e4;
    if (m < 60) return { num: String(Math.max(1, Math.round(m))), unit: "m" };
    const h = m / 60;
    if (h < 24) return { num: String(Math.round(h)), unit: "h" };
    return { num: String(Math.round(h / 24)), unit: "d" };
  }
  function ensureDock(app2) {
    hostApp = app2;
    if (!overlay) build(app2);
  }
  function openDock(app2) {
    var _a;
    ensureDock(app2);
    if (!overlay) return;
    topifyZ(overlay);
    overlay.classList.remove("is-off");
    trapPanelFocus((_a = overlay.querySelector(`#${FRAME_ID}`)) != null ? _a : overlay);
    escHandle == null ? void 0 : escHandle.unregister();
    escHandle = escManager.register("bz-dock", {
      isVisible: () => isPanelVisible(),
      close: () => closeDock()
    });
    render();
    startTick();
    void refresh();
    notifyDockEvent({ kind: "panel-open" });
    if (Platform.isMobile) void primeVaultFs(app2).then(() => refresh());
    else maybeOfflineReport();
  }
  function closeDock() {
    overlay == null ? void 0 : overlay.classList.add("is-off");
    stopTick();
  }
  function unloadDock() {
    stopTick();
    liveOff == null ? void 0 : liveOff();
    liveOff = null;
    hostApp = null;
    escHandle == null ? void 0 : escHandle.unregister();
    escHandle = null;
    overlay == null ? void 0 : overlay.remove();
    overlay = null;
    views = [];
    view = { kind: "list" };
    searchOpen = false;
    query = "";
    lastTails.clear();
    recPrints.clear();
    hbPrints.clear();
    boardPrints.clear();
    openRuns.clear();
  }
  function isPanelVisible() {
    return !!overlay && !overlay.classList.contains("is-off");
  }
  function build(app2) {
    const ov = el("div", "bz-panel-overlay bz-dock-mask is-off");
    ov.id = OVERLAY_ID;
    const frame = el("div", "bz-panel-frame bz-dock-panel bz-panel-mtop");
    frame.id = FRAME_ID;
    const head = el("div", "bz-panel-head");
    const kpi = el("div", "bz-dock-kpi");
    kpi.id = "bz-dock-kpi";
    const runbar = el("div", "bz-dock-runbar");
    runbar.id = "bz-dock-runbar";
    const bar = el("div", "bz-dock-bar");
    bar.id = "bz-dock-bar";
    const body = el("div", "bz-dock-body");
    body.id = "bz-dock-body";
    frame.append(head, kpi, runbar, bar, body);
    ov.appendChild(frame);
    bindMaskDismiss(ov, closeDock);
    document.body.appendChild(ov);
    overlay = ov;
    liveOff = onLiveChanged(() => {
      rememberTails();
      if (view.kind === "detail") renderLiveInto(view.id);
      renderRunbar();
      updateCards();
    });
  }
  function headEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector(".bz-panel-head")) != null ? _a : null;
  }
  function kpiEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector("#bz-dock-kpi")) != null ? _a : null;
  }
  function runbarEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector("#bz-dock-runbar")) != null ? _a : null;
  }
  function barEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector("#bz-dock-bar")) != null ? _a : null;
  }
  function bodyEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector("#bz-dock-body")) != null ? _a : null;
  }
  function refresh() {
    const { registry } = readRegistry();
    views = loadToolViews(registry.tools, {
      trust: readTrust(),
      canRun: canRun(),
      fs: currentFs()
    });
    syncPrints(registry.tools);
    render();
  }
  function recPrintOf(declPath, fs) {
    if (!fs) return "";
    return [
      // runs.jsonl 可能很大（几百 KB），只看大小：它是**只在终态追加**的，追加必变
      filePrint(pathOf.runs(declPath), fs, true),
      // 其余都是小文件，看内容 —— 大小靠不住：`updatedAt`、`at` 这类 ISO 时间戳是定长的，
      // 内容换了大小却一模一样，只比大小就等于没比
      filePrint(declPath, fs, false),
      filePrint(pathOf.runtime(declPath), fs, false),
      filePrint(pathOf.intent(declPath), fs, false),
      filePrint(pathOf.settings(declPath), fs, false)
    ].join("|");
  }
  function boardPrintOf(declPath, fs) {
    if (!fs) return "";
    return filePrint(pathOf.panel(declPath), fs, true);
  }
  function hbPrintOf(declPath, fs) {
    if (!fs) return "";
    return filePrint(pathOf.heartbeat(declPath), fs, false);
  }
  function filePrint(path, fs, bySize) {
    var _a;
    if (bySize) {
      const size = (_a = fs.size) == null ? void 0 : _a.call(fs, path);
      if (size !== void 0) return `s${size}`;
    }
    const text = fs.readText(path);
    if (text === null) return "-";
    return `h${text.length}:${hashOf(text)}`;
  }
  function hashOf(text) {
    let h = 5381;
    for (let i = 0; i < text.length; i += 1) h = (h << 5) + h + text.charCodeAt(i) | 0;
    return (h >>> 0).toString(36);
  }
  function syncPrints(entries) {
    const fs = currentFs();
    recPrints.clear();
    hbPrints.clear();
    boardPrints.clear();
    for (const e of entries) {
      const decl = resolveToolPath(e.path);
      recPrints.set(e.id, recPrintOf(decl, fs));
      hbPrints.set(e.id, hbPrintOf(decl, fs));
      boardPrints.set(e.id, boardPrintOf(decl, fs));
    }
  }
  function reloadChanged() {
    const changed = { rec: /* @__PURE__ */ new Set(), hb: /* @__PURE__ */ new Set(), board: /* @__PURE__ */ new Set() };
    const fs = currentFs();
    if (!fs) return changed;
    const { registry } = readRegistry();
    if (registry.tools.length !== views.length) {
      refresh();
      return changed;
    }
    const trust = readTrust();
    for (const e of registry.tools) {
      const decl = resolveToolPath(e.path);
      const rec = recPrintOf(decl, fs);
      const hb = hbPrintOf(decl, fs);
      const board = boardPrintOf(decl, fs);
      const recDirty = recPrints.get(e.id) !== rec;
      const hbDirty = hbPrints.get(e.id) !== hb;
      const boardDirty = boardPrints.get(e.id) !== board;
      if (!recDirty && !hbDirty && !boardDirty) continue;
      recPrints.set(e.id, rec);
      hbPrints.set(e.id, hb);
      boardPrints.set(e.id, board);
      const i = views.findIndex((v) => v.id === e.id);
      if (i < 0) continue;
      views[i] = loadToolView(e, { trust, canRun: canRun(), fs });
      if (boardDirty) changed.board.add(e.id);
      if (recDirty) changed.rec.add(e.id);
      else if (hbDirty) changed.hb.add(e.id);
    }
    return changed;
  }
  function repaintChanged(changed) {
    if (!changed.rec.size && !changed.hb.size && !changed.board.size) return;
    if (view.kind === "detail") {
      const board = changed.board.has(view.id);
      if (changed.rec.has(view.id) || board) repaintDetail(view.id, { board });
      else if (changed.hb.has(view.id)) {
        renderLiveInto(view.id);
        repaintRunBtns(view.id);
      }
      return;
    }
    const body = bodyEl();
    if (!body) return;
    for (const id of /* @__PURE__ */ new Set([...changed.rec, ...changed.hb, ...changed.board])) {
      const v = viewById(id);
      if (!v) continue;
      const old = body.querySelector(`.bz-dock-card[data-tool="${id}"]`);
      if (old) old.replaceWith(makeCard(v));
    }
    if (changed.rec.size) {
      renderKpi();
      renderHeadSub();
    }
    renderRunbar();
    updateCards();
  }
  function renderHeadSub() {
    const sub = overlay == null ? void 0 : overlay.querySelector("#bz-dock-headsub");
    if (!sub) return;
    const alarms = views.filter(isAlarmView).length;
    sub.textContent = views.length ? `${views.length} 个工具${alarms ? ` · ${alarms} 个待关注` : ""}` : "还没有登记任何外部工具";
  }
  function repaintDetail(id, opts = {}) {
    var _a, _b, _c;
    const v = viewById(id);
    const wrap = (_a = bodyEl()) == null ? void 0 : _a.querySelector(".bz-dock-detail");
    if (!v || !wrap) return;
    if (opts.board) repaintBoard(v, wrap);
    (_b = wrap.querySelector(".bz-dock-toolstats")) == null ? void 0 : _b.replaceWith(toolStats(v));
    (_c = wrap.querySelector(".bz-dock-histpane")) == null ? void 0 : _c.replaceWith(histPane(v));
    repaintRunBtns(id);
    renderLiveInto(id);
    renderRunbar();
  }
  function repaintBoard(v, wrap) {
    const old = wrap.querySelector(".bz-dock-board");
    const next = boardSection(v);
    if (old && next) old.replaceWith(next);
    else if (old) old.remove();
    else if (next) {
      const warn = wrap.querySelector(".bz-dock-meta-warn");
      wrap.insertBefore(next, warn ? warn.nextSibling : wrap.firstChild);
    }
  }
  function repaintRunBtns(id) {
    var _a;
    const v = viewById(id);
    if (!v) return;
    const old = (_a = bodyEl()) == null ? void 0 : _a.querySelector(".bz-dock-runpane .bz-dock-runbtns");
    if (!old) return;
    old.replaceWith(runBtns(v));
  }
  function updateCards() {
    var _a;
    const body = bodyEl();
    if (!body || view.kind === "detail") return;
    const fs = currentFs();
    const beats = new Map(readRegistry().registry.tools.map((e) => [e.id, runningHeartbeatOf(e.path, fs)]));
    for (const card of Array.from(body.querySelectorAll(".bz-dock-card"))) {
      const id = (_a = card.dataset.tool) != null ? _a : "";
      const live3 = liveOf(id);
      const hb = beats.get(id);
      const ext = live3 || !hb ? null : freshOf(hb);
      const running = !!live3 || !!ext;
      card.classList.toggle("is-running", running);
      const dot = card.querySelector(".bz-dock-dot");
      if (dot) {
        const v = viewById(id);
        const last = v ? lastOf(v) : void 0;
        const want = running ? "bz-dock-dot bz-dock-dot--warn" : dotClass(last ? last.status : v && dueOf(v).due ? "due" : "none");
        if (dot.className !== want) dot.className = want;
      }
    }
  }
  function startTick() {
    stopTick();
    tickTimer = setInterval(() => {
      if (!isPanelVisible()) return;
      rememberTails();
      repaintChanged(reloadChanged());
      updateCards();
      if (view.kind === "detail") renderLiveInto(view.id);
    }, 3e3);
  }
  function stopTick() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  }
  function render() {
    renderHead();
    renderKpi();
    renderRunbar();
    renderBar();
    renderBody();
  }
  function renderHead() {
    const head = headEl();
    if (!head) return;
    if (view.kind === "detail") {
      const v = viewById(view.id);
      if (v) {
        renderToolHead(head, v);
        return;
      }
    }
    head.classList.remove("bz-dock-toolhead");
    head.innerHTML = "";
    const brand = el("div", "bz-panel-brand");
    brand.appendChild(uiIcon("square-terminal"));
    const sub = el("div", "bz-panel-head-sub");
    sub.id = "bz-dock-headsub";
    const btns = el("div", "bz-panel-head-btns");
    btns.id = "bz-dock-headbtns";
    head.append(brand, el("div", "bz-panel-title", "工具坞"), el("div", "bz-panel-head-pipe"), sub, el("div", "bz-panel-head-sp"), btns);
    renderHeadSub();
    btns.appendChild(
      uiIconBtn({
        icon: "search",
        title: "搜索工具",
        on: searchOpen,
        onClick: () => {
          searchOpen = !searchOpen;
          render();
        }
      })
    );
    if (canRun()) {
      btns.appendChild(
        uiIconBtn({
          icon: "refresh-cw",
          title: "重新读取运行记录",
          onClick: () => {
            refresh();
            notice("已重新读取");
          }
        })
      );
      btns.appendChild(uiIconBtn({ icon: "plus", title: "导入工具（选文件夹）", onClick: () => pickFolder() }));
    }
    btns.appendChild(uiIconBtn({ icon: "x", title: "关闭", className: "bz-dock-close", onClick: () => closeDock() }));
  }
  function renderToolHead(head, v) {
    var _a, _b, _c;
    head.innerHTML = "";
    head.classList.add("bz-dock-toolhead");
    const back = uiIconBtn({
      icon: "chevron-left",
      title: "返回列表",
      className: "bz-dock-back",
      onClick: () => {
        view = { kind: "list" };
        render();
      }
    });
    const main = el("div", "bz-dock-covermain");
    const ic = el("div", "bz-dock-coveric");
    ic.appendChild(uiIcon(((_a = v.manifest) == null ? void 0 : _a.icon) || "box", "bz-ic--lg"));
    const txt = el("div", "bz-dock-covertxt");
    const line = el("div", "bz-dock-coverline");
    line.appendChild(el("div", "bz-dock-detail-name", displayNameOf(v)));
    const tags = el("div", "bz-dock-detail-tags");
    const due = dueOf(v);
    if (due.due) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--due", due.detail));
    const trustTag = trustTagOf(v);
    if (trustTag) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--warn", trustTag));
    if ((_b = v.runtime.run) == null ? void 0 : _b.pausedAt) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--warn", "自动已暂停"));
    if (tags.children.length) line.appendChild(tags);
    txt.appendChild(line);
    const desc = (_c = v.manifest) == null ? void 0 : _c.description;
    if (desc) txt.appendChild(el("div", "bz-dock-detail-desc", desc));
    main.append(back, ic, txt);
    head.appendChild(main);
  }
  function renderKpi() {
    const host = kpiEl();
    if (!host) return;
    host.innerHTML = "";
    if (!views.length || view.kind === "detail") {
      host.classList.add("is-off");
      return;
    }
    host.classList.remove("is-off");
    const withRules = views.filter((v) => v.rules.some((r) => r.enabled !== false));
    const doneToday = withRules.filter((v) => {
      var _a;
      return ((_a = v.lastRun) == null ? void 0 : _a.status) === "ok" && isToday(v.lastRun.startedAt);
    }).length;
    const left = withRules.length - doneToday;
    let ok = 0;
    let total = 0;
    for (const v of views) {
      for (const r of recentRunsOf(v.path, v.id, 60)) {
        if (r.status === "running") continue;
        total += 1;
        if (r.status === "ok") ok += 1;
      }
    }
    const rate = total ? ok / total : null;
    const alarms = views.filter(isAlarmView);
    const alarmHint = alarms[0];
    const next = nextDueOfViews();
    const tile = (num2, unit, label, sub, tone, key) => {
      const t = el("div", tone ? `bz-dock-kpi-tile is-${tone}` : "bz-dock-kpi-tile");
      const v = el("div", "bz-dock-kpi-v", num2);
      if (unit) v.appendChild(el("small", void 0, unit));
      t.append(v, el("div", "bz-dock-kpi-l", label), el("div", tone === "up" ? "bz-dock-kpi-d is-up" : "bz-dock-kpi-d", sub));
      if (key) {
        t.classList.add("is-click");
        if (kpiFilter === key) t.classList.add("is-selected");
        t.addEventListener("click", () => {
          kpiFilter = kpiFilter === key ? "all" : key;
          renderKpi();
          renderBody();
        });
      }
      return t;
    };
    host.appendChild(
      tile(
        String(doneToday),
        ` / ${withRules.length}`,
        "今日自动化达标",
        withRules.length === 0 ? "还没有自动化工具" : left > 0 ? `还差 ${left} 个` : "今天都跑成了",
        withRules.length > 0 && left > 0 ? "warn" : void 0
      )
    );
    host.appendChild(
      tile(
        rate === null ? "—" : String(Math.round(rate * 100)),
        rate === null ? "" : "%",
        "近 7 天成功率",
        total ? `${total} 次里成功 ${ok} 次` : "还没有可比的记录"
      )
    );
    host.appendChild(
      tile(
        String(alarms.length),
        "",
        "待处理异常",
        alarmHint ? `${displayNameOf(alarmHint)} · ${dueOf(alarmHint).due ? dueOf(alarmHint).detail : "上次没跑成"}` : "没有要管的事",
        alarms.length ? "bad" : void 0,
        "alarms"
      )
    );
    if (next) {
      const left2 = untilText(next.at - Date.now());
      host.appendChild(tile(left2.num, left2.unit, "距下次到期", next.name));
    } else {
      host.appendChild(tile("—", "", "距下次到期", "没有能算出下次到期的工具"));
    }
  }
  function nextDueOfViews() {
    var _a, _b;
    let best = null;
    const now = Date.now();
    for (const v of views) {
      if (v.intent.enabled === false || v.intent.autoRun === false) continue;
      for (const rule of v.rules) {
        if (rule.enabled === false || isEventTrigger(rule.trigger.kind)) continue;
        const firedRaw = (_b = (_a = v.runtime.rules) == null ? void 0 : _a[rule.id]) == null ? void 0 : _b.lastFiredAt;
        const at = nextDueOf(rule, {
          now,
          lastFiredAt: firedRaw ? Date.parse(firedRaw) : void 0
        });
        if (at === null) continue;
        if (!best || at < best.at) best = { at, name: displayNameOf(v) };
      }
    }
    return best;
  }
  function renderRunbar() {
    const host = runbarEl();
    if (!host) return;
    host.innerHTML = "";
    const live3 = liveAll();
    const offs = view.kind === "detail" ? [] : views.map((v) => ({ v, hb: externalRunOf(v) })).filter((x) => x.hb !== null);
    if (!live3.length && !offs.length) {
      host.classList.add("is-off");
      return;
    }
    host.classList.remove("is-off");
    for (const run of live3) {
      const v = viewById(run.toolId);
      const row = el("div", "bz-dock-rb");
      row.appendChild(el("span", "bz-dock-rb-pulse"));
      row.appendChild(el("span", "bz-dock-rb-name", v ? displayNameOf(v) : run.toolId));
      if (run.phase) row.appendChild(el("span", "bz-dock-rb-phase", run.phase));
      const lastStep = run.steps.length ? run.steps[run.steps.length - 1].text : "正在跑…";
      row.appendChild(el("span", "bz-dock-rb-step", lastStep));
      if (run.pct !== null) {
        const track = el("div", "bz-dock-rb-track");
        track.appendChild(uiProgress({ thin: true, value: run.pct }).el);
        row.appendChild(track);
        row.appendChild(el("span", "bz-dock-rb-pct", `${run.pct}%`));
      }
      host.appendChild(row);
    }
    for (const { v, hb } of offs) {
      const row = el("div", "bz-dock-rb");
      row.dataset.tool = v.id;
      row.appendChild(el("span", "bz-dock-rb-pulse"));
      row.appendChild(el("span", "bz-dock-rb-name", displayNameOf(v)));
      row.appendChild(el("span", "bz-dock-rb-tag", "离线"));
      row.appendChild(el("span", "bz-dock-rb-step", hb.step || "值守进程正在跑"));
      host.appendChild(row);
    }
  }
  function renderBar() {
    const bar = barEl();
    if (!bar) return;
    bar.innerHTML = "";
    if (!searchOpen || view.kind === "detail") {
      bar.classList.add("is-off");
      return;
    }
    bar.classList.remove("is-off");
    const sp = el("div", "bz-dock-search");
    const search = uiSearch({
      placeholder: "搜工具名 / 描述 / 命令",
      value: query,
      onInput: (v) => {
        query = v;
        renderBody();
      }
    });
    sp.appendChild(search.el);
    bar.appendChild(sp);
    if (!Platform.isMobile) queueMicrotask(() => search.input.focus());
  }
  function filtered() {
    let list = views.slice();
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((v) => {
        var _a, _b, _c, _d, _e;
        const hay = [v.id, displayNameOf(v), (_b = (_a = v.manifest) == null ? void 0 : _a.description) != null ? _b : "", (_e = (_d = (_c = v.manifest) == null ? void 0 : _c.entry) == null ? void 0 : _d.cmd) != null ? _e : ""].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (kpiFilter === "alarms") list = list.filter(isAlarmView);
    return list;
  }
  function renderBody() {
    const body = bodyEl();
    if (!body) return;
    body.innerHTML = "";
    if (view.kind === "detail") {
      const v = viewById(view.id);
      if (v) {
        renderDetail(body, v);
        return;
      }
      if (views.length) view = { kind: "list" };
    }
    renderList(body);
  }
  function renderList(body) {
    if (!views.length) {
      body.appendChild(
        uiEmpty({
          icon: "square-terminal",
          title: "还没有外部工具",
          desc: canRun() ? "选一个工具文件夹，bz 会自己找里面的 manifest.json。工具坞据此知道它叫什么、有哪些参数、该怎么跑。" : "工具要在桌面端导入。手机上只读 —— 工具目录同步过来之后，这里就能看到它的声明、展示板与运行记录。",
          actions: canRun() ? uiBtnRow([uiBtn({ label: "导入工具", icon: "file-input", tone: "primary", onClick: () => pickFolder() })], {
            center: true
          }) : void 0
        })
      );
      return;
    }
    const list = filtered();
    if (!list.length) {
      body.appendChild(
        uiEmpty({
          icon: "search-x",
          title: "没有匹配的工具",
          desc: kpiFilter === "alarms" ? "这个口径下没有 —— 点顶上的 KPI 格回到全部" : "换个词试试"
        })
      );
      return;
    }
    const grid = el("div", "bz-dock-grid");
    for (const v of list) grid.appendChild(makeCard(v));
    body.appendChild(grid);
  }
  function makeCard(v) {
    var _a, _b, _c, _d;
    const id = v.id;
    const card = el("article", "bz-dock-card");
    card.dataset.tool = id;
    const due = dueOf(v);
    if (due.due) card.classList.add("is-due");
    if (v.intent.enabled === false) card.classList.add("is-disabled");
    if (liveOf(id) || externalRunOf(v)) card.classList.add("is-running");
    const top = el("div", "bz-dock-card-top");
    const ic = el("span", "bz-dock-card-ic");
    ic.appendChild(uiIcon(((_a = v.manifest) == null ? void 0 : _a.icon) || "box", "bz-ic--md"));
    const idbox = el("div", "bz-dock-card-idbox");
    const tags = el("div", "bz-dock-card-tags");
    if (due.due) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--due", due.detail));
    const trustTag = trustTagOf(v);
    if (trustTag) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--warn", trustTag));
    if (!v.manifest) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--muted", "声明读不到"));
    if (v.manifest && !v.entry) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--muted", "只能看"));
    if ((_b = v.runtime.run) == null ? void 0 : _b.pausedAt) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--warn", "自动已暂停"));
    idbox.append(el("div", "bz-dock-card-name", displayNameOf(v)), tags);
    top.append(ic, idbox);
    card.appendChild(top);
    const desc = (_c = v.manifest) == null ? void 0 : _c.description;
    if (desc) card.appendChild(el("div", "bz-dock-card-desc", desc));
    const state = el("div", "bz-dock-card-state");
    const last = lastOf(v);
    const running = !!liveOf(id) || !!externalRunOf(v);
    state.appendChild(el("span", running ? dotClass("running") : dotClass(last ? last.status : due.due ? "due" : "none")));
    state.appendChild(el("span", "bz-dock-card-when", whenTextOf(v, last)));
    state.appendChild(el("span", "bz-dock-card-msg", messageTextOf(v, last)));
    const rate = rateOf(v);
    if (rate !== null) {
      const rateEl = el("span", "bz-dock-rate", `${Math.round(rate * 100)}% 成功`);
      rateEl.title = "最近记录里成功了几条";
      if (rate < 1) rateEl.classList.add("is-warn");
      state.appendChild(rateEl);
    }
    card.appendChild(state);
    const hint = failHintOf(last);
    if (hint) {
      const box = el("div", "bz-dock-card-fail");
      box.appendChild(uiIcon("alert-triangle", "bz-ic--xs"));
      box.appendChild(el("span", "bz-dock-card-failtext", hint));
      card.appendChild(box);
    }
    const strip = el("div", "bz-dock-strip");
    strip.title = "最近 7 次运行（左旧右新）";
    const runs = recentRunsOf(v.path, v.id, 7).slice().reverse();
    for (let i = 0; i < 7; i++) {
      const r = runs[i];
      const pip = el("i", "bz-dock-pip");
      if (r) {
        pip.classList.add(`bz-dock-pip--${r.status}`);
        pip.title = `${relTime(r.startedAt.replace("T", " "))} · ${statusText(r.status)}${r.message ? ` · ${r.message}` : ""}`;
      } else {
        pip.title = "这一次没有运行记录";
      }
      strip.appendChild(pip);
    }
    card.appendChild(strip);
    const foot = el("div", "bz-dock-card-foot");
    if (canRun()) {
      if (liveOf(id)) {
        foot.appendChild(uiBtn({ label: "停止", icon: "square", tone: "danger", size: "sm", onClick: () => stopLive(id) }));
      } else {
        const gate = judgeRunGate(v, true);
        const runBtn = uiBtn({
          label: "运行",
          icon: "play",
          tone: "primary",
          size: "sm",
          disabled: !gate.ok || !!externalRunOf(v),
          onClick: () => void doRun(v)
        });
        runBtn.title = gate.ok ? "" : (_d = gate.text) != null ? _d : "";
        foot.appendChild(runBtn);
      }
    } else {
      foot.appendChild(el("span", "bz-dock-mobilehint", "移动端仅查看"));
    }
    card.appendChild(foot);
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      view = { kind: "detail", id };
      render();
    });
    attachItemActions(card, canRun() ? cardActions(v) : []);
    return card;
  }
  function cardActions(v) {
    var _a;
    const acts = [
      {
        icon: "chevron-right",
        label: "打开详情",
        onClick: () => {
          view = { kind: "detail", id: v.id };
          render();
        }
      }
    ];
    const gate = judgeRunGate(v, canRun());
    if (gate.ok && !externalRunOf(v)) {
      acts.push({ icon: "play", label: "运行", onClick: () => void doRun(v) });
    }
    if ((_a = v.runtime.run) == null ? void 0 : _a.pausedAt) {
      acts.push({
        icon: "rotate-ccw",
        label: "恢复自动运行",
        onClick: () => {
          void clearBreakerSafely(v).then((ok) => {
            if (!ok) {
              notice("有工具正在跑，等它跑完再恢复", "warning");
              return;
            }
            refresh();
          });
        }
      });
    }
    acts.push({ icon: "folder-input", label: "重新选目录", onClick: () => pickFolder() });
    acts.push({
      icon: v.intent.enabled === false ? "play-circle" : "pause-circle",
      label: v.intent.enabled === false ? "启用" : "停用",
      onClick: () => {
        writeIntent(v.path, { ...v.intent, v: 1, tool: v.id, enabled: v.intent.enabled === false });
        void kickDockScheduler();
        refresh();
      }
    });
    acts.push({
      icon: "x-circle",
      label: "移除登记",
      kind: "danger",
      onClick: () => {
        if (!window.confirm(`从工具坞移除「${displayNameOf(v)}」？
只删登记，不动磁盘上的文件。`)) return;
        removeTool(v.id);
        refresh();
      }
    });
    return acts;
  }
  function renderDetail(body, v) {
    const wrap = el("div", "bz-dock-detail");
    if (v.error) wrap.appendChild(el("div", "bz-dock-meta-warn", v.error));
    const board = boardSection(v);
    if (board) wrap.appendChild(board);
    wrap.appendChild(toolStats(v));
    wrap.appendChild(metaSection(v));
    wrap.appendChild(rulesPane(v));
    const cols = el("div", "bz-dock-cols");
    cols.appendChild(runPane(v));
    cols.appendChild(histPane(v));
    wrap.appendChild(cols);
    body.appendChild(wrap);
  }
  var FRAME_SCROLLBAR_CSS = "<style>html{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar{display:none;width:0;height:0}</style>";
  var BOARD_MAX_BYTES = 512 * 1024;
  var BOARD_MAX_HEIGHT = 560;
  var BOARD_THEME_VARS = [
    "--bz-surface-0",
    "--bz-surface-1",
    "--bz-surface-2",
    "--bz-surface-3",
    "--bz-text-1",
    "--bz-text-2",
    "--bz-text-3",
    "--bz-border",
    "--bz-brand",
    "--bz-brand-soft",
    "--bz-success",
    "--bz-warning",
    "--bz-danger",
    "--bz-radius-sm",
    "--bz-radius-md",
    "--bz-font-ui",
    "--bz-font-mono",
    "--bz-space-xs",
    "--bz-space-sm",
    "--bz-space-md",
    "--bz-space-lg"
  ];
  function escapeStyleAttr(v) {
    return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }
  function frameBaseStyle() {
    const cs = getComputedStyle(document.body);
    const parts = BOARD_THEME_VARS.map((name) => {
      const value = cs.getPropertyValue(name).trim();
      return value ? `${name}:${escapeStyleAttr(value)}` : "";
    }).filter(Boolean);
    parts.push(
      "margin:0",
      "padding:var(--bz-space-md)",
      "background:transparent",
      "color:var(--bz-text-1)",
      "font-family:var(--bz-font-ui)",
      "font-size:var(--bz-font-label)",
      "line-height:1.6"
    );
    return parts.join(";");
  }
  function frameRootStyle() {
    return "scrollbar-width:none";
  }
  function fitFrameHeight(frame) {
    const doc = frame.contentDocument;
    if (!doc) return;
    let last = -1;
    const measure = () => {
      var _a, _b, _c, _d;
      const h = Math.max((_b = (_a = doc.documentElement) == null ? void 0 : _a.scrollHeight) != null ? _b : 0, (_d = (_c = doc.body) == null ? void 0 : _c.scrollHeight) != null ? _d : 0);
      if (h > 0 && Math.abs(h - last) > 1) {
        last = h;
        frame.style.height = `${h}px`;
      }
    };
    measure();
    try {
      const ro = new ResizeObserver(measure);
      if (doc.body) ro.observe(doc.body);
      ro.observe(doc.documentElement);
    } catch (e) {
    }
  }
  function sandboxFrame(html, className, title, opts = {}) {
    const frame = document.createElement("iframe");
    frame.className = className;
    const sandbox = ["allow-same-origin"];
    if (opts.allowPopups) sandbox.push("allow-popups", "allow-popups-to-escape-sandbox");
    if (opts.allowScripts) sandbox.push("allow-scripts");
    frame.setAttribute("sandbox", sandbox.join(" "));
    frame.setAttribute("title", title);
    frame.setAttribute("referrerpolicy", "no-referrer");
    if (opts.maxHeight) frame.style.maxHeight = `${opts.maxHeight}px`;
    frame.srcdoc = `<html style="${frameRootStyle()}"><head>${FRAME_SCROLLBAR_CSS}</head><body style="${frameBaseStyle()}">${html}</body></html>`;
    frame.addEventListener("load", () => {
      fitFrameHeight(frame);
      if (opts.allowPopups) wireExternalLinks(frame);
    });
    return frame;
  }
  function wireExternalLinks(frame) {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener(
      "click",
      (ev) => {
        var _a, _b, _c;
        const target = ev.target;
        const a = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
        if (!a) return;
        const href = (_a = a.getAttribute("href")) != null ? _a : "";
        if (!/^https?:\/\//i.test(href)) return;
        ev.preventDefault();
        const shell = (_c = (_b = window.require) == null ? void 0 : _b.call(window, "electron")) == null ? void 0 : _c.shell;
        if (shell) shell.openExternal(href);
        else window.open(href, "_blank", "noopener");
      },
      true
    );
  }
  function boardSection(v) {
    const html = panelOf(v.path, currentFs());
    if (html === null) return null;
    const host = el("div", "bz-dock-board");
    const bytes = new TextEncoder().encode(html).length;
    if (bytes > BOARD_MAX_BYTES) {
      host.appendChild(
        el(
          "div",
          "bz-dock-board-warn",
          `panel.html 有 ${Math.round(bytes / 1024)} KB，超过 ${BOARD_MAX_BYTES / 1024} KB 就不渲染了 —— 展示板是「一眼看完的几行数」`
        )
      );
      return host;
    }
    host.appendChild(
      sandboxFrame(html, "bz-dock-board-frame", `${displayNameOf(v)} 的展示板`, {
        maxHeight: BOARD_MAX_HEIGHT,
        allowPopups: true,
        allowScripts: true
      })
    );
    return host;
  }
  function toolStats(v) {
    const box = el("div", "bz-dock-kpi bz-dock-toolstats");
    const runs = recentRunsOf(v.path, v.id, 60).filter((r) => r.status !== "running");
    const ok = runs.filter((r) => r.status === "ok").length;
    const single = (num2, unit, label, sub) => {
      const t = el("div", "bz-dock-kpi-tile");
      const val = el("div", "bz-dock-kpi-v", num2);
      if (unit) val.appendChild(el("small", void 0, unit));
      t.append(val, el("div", "bz-dock-kpi-l", label), el("div", "bz-dock-kpi-d", sub));
      return t;
    };
    box.append(
      single(String(v.params.length), "", "参数", v.params.length ? "在运行台里改" : "这个工具没有参数"),
      single(runs.length ? String(Math.round(ok / runs.length * 100)) : "—", runs.length ? "%" : "", "成功率", runs.length ? `${runs.length} 条记录` : "还没跑过"),
      single(v.rules.filter((r) => r.enabled !== false).length ? "自动" : "手动", "", "节奏", v.rules.length ? `${v.rules.length} 条规则` : "没有规则")
    );
    return box;
  }
  function metaRow(label, value, mono = false, onCopy) {
    const row = el("div", "bz-dock-meta-row");
    row.appendChild(el("span", "bz-dock-meta-label", label));
    const val = el("span", mono ? "bz-dock-meta-val is-mono" : "bz-dock-meta-val", value);
    val.title = value;
    row.appendChild(val);
    if (onCopy) {
      row.appendChild(uiIconBtn({ icon: "copy", title: "复制", xs: true, onClick: onCopy }));
    }
    return row;
  }
  function metaSection(v) {
    var _a;
    const meta = el("div", "bz-dock-meta");
    meta.appendChild(metaRow("声明文件", v.path, true, () => void copyText(v.path, "声明文件路径")));
    if (v.entry) {
      meta.appendChild(metaRow("命令", [v.entry.cmd, ...(_a = v.entry.args) != null ? _a : []].join(" "), true));
      if (v.entry.cwd) meta.appendChild(metaRow("工作目录", v.entry.cwd, true));
      if (v.entry.shell) meta.appendChild(metaRow("经 shell 启动", "是"));
    } else {
      meta.appendChild(metaRow("命令", "声明里没写 entry —— 能看，但不知道该怎么跑"));
    }
    const dir = v.dir;
    meta.appendChild(metaRow("参数值文件", `${dir}/data.json`, true, () => void copyText(`${dir}/data.json`, "参数值文件路径")));
    meta.appendChild(metaRow("运行记录", `${dir}/runs.jsonl`, true, () => void copyText(`${dir}/runs.jsonl`, "运行记录路径")));
    return meta;
  }
  function runPane(v) {
    var _a;
    const pane = el("section", "bz-dock-pane bz-dock-runpane");
    const head = el("div", "bz-dock-pane-head");
    head.appendChild(el("h3", "bz-dock-pane-title", "运行台"));
    if (!canRun()) head.appendChild(el("span", "bz-dock-pane-count", "只读"));
    pane.appendChild(head);
    if (!v.manifest) {
      const box = el("div", "bz-dock-noManifest");
      box.appendChild(el("div", "bz-dock-note", (_a = v.error) != null ? _a : "声明文件读不到。"));
      pane.appendChild(box);
      return pane;
    }
    if (v.params.length) {
      const form = el("div", "bz-dock-form");
      const values = { ...v.values };
      for (const p of v.params) form.appendChild(paramRow(p, values, v));
      pane.appendChild(form);
    } else {
      pane.appendChild(el("div", "bz-dock-note", "这个工具没有参数。"));
    }
    if (!v.entry) {
      pane.appendChild(el("div", "bz-dock-meta-warn", "这份声明没写 entry —— 能看它的记录，但不知道该怎么跑。"));
    }
    pane.appendChild(runBtns(v));
    const tail = lastTails.get(v.id);
    if (!liveOf(v.id) && (tail == null ? void 0 : tail.length)) {
      const box = el("div", "bz-dock-lastraw");
      box.appendChild(el("div", "bz-dock-lastraw-head", "上次现场输出（尾部）"));
      const pre = el("pre", "bz-dock-raw");
      pre.textContent = tail.slice(-12).join("\n");
      box.appendChild(pre);
      pane.appendChild(box);
    }
    const liveHost = el("div", "bz-dock-live");
    liveHost.dataset.tool = v.id;
    pane.appendChild(liveHost);
    renderLiveIntoEl(liveHost, v);
    return pane;
  }
  function runBtns(v) {
    var _a, _b;
    const btns = el("div", "bz-dock-runbtns");
    if (!canRun()) {
      btns.appendChild(el("span", "bz-dock-mobilehint", "移动端不能启动进程，只能看"));
      return btns;
    }
    const live3 = liveOf(v.id);
    const external = externalRunOf(v);
    if (live3) {
      btns.appendChild(uiBtn({ label: "停止", icon: "square", tone: "danger", onClick: () => stopLive(v.id) }));
    } else {
      const gate = judgeRunGate(v, true);
      const run = uiBtn({
        label: external ? "后台正在跑" : "运行",
        icon: "play",
        tone: "primary",
        disabled: !gate.ok || !!external,
        onClick: () => void doRun(v)
      });
      run.title = external ? "后台值守正在跑它，等它跑完" : gate.ok ? "" : (_a = gate.text) != null ? _a : "";
      btns.appendChild(run);
    }
    if (!v.trusted) {
      btns.appendChild(
        uiBtn({
          label: v.trustStale ? "重新授权" : "授权这条命令",
          icon: "shield-check",
          onClick: () => void doTrust(v)
        })
      );
    } else {
      btns.appendChild(uiBtn({ label: "撤销授权", size: "sm", onClick: () => void doUntrust(v) }));
    }
    if ((_b = v.runtime.run) == null ? void 0 : _b.pausedAt) {
      btns.appendChild(
        uiBtn({
          label: "恢复自动运行",
          size: "sm",
          onClick: () => {
            void clearBreakerSafely(v).then((ok) => {
              if (!ok) {
                notice("有工具正在跑，等它跑完再恢复", "warning");
                return;
              }
              refresh();
            });
          }
        })
      );
    }
    return btns;
  }
  function renderLiveInto(id) {
    var _a;
    const host = (_a = bodyEl()) == null ? void 0 : _a.querySelector(`.bz-dock-live[data-tool="${id}"]`);
    if (!host) return;
    const v = viewById(id);
    if (!v) return;
    renderLiveIntoEl(host, v);
  }
  function renderLiveIntoEl(host, v) {
    var _a, _b;
    host.innerHTML = "";
    const live3 = liveOf(v.id);
    const external = externalRunOf(v);
    if (!live3 && !external) return;
    const box = el("div", "bz-dock-livelog");
    if (live3) {
      box.appendChild(el("div", "bz-dock-livelog-head", `工单 ${live3.runId} · ${(_a = live3.phase) != null ? _a : "进行中"}${live3.pct !== null ? ` ${live3.pct}%` : ""}`));
      if (live3.pct !== null) box.appendChild(uiProgress({ thin: true, value: live3.pct }).el);
      const steps2 = live3.steps.slice(-40);
      if (!steps2.length) box.appendChild(el("div", "bz-dock-note", "还没有输出"));
      for (const s of steps2) box.appendChild(el("div", "bz-dock-liveline", s.text));
      host.appendChild(box);
      return;
    }
    const runId = (_b = external == null ? void 0 : external.runId) != null ? _b : "";
    box.appendChild(el("div", "bz-dock-livelog-head", `后台进程在跑 · 工单 ${runId || "（未标注）"}`));
    const steps = liveLogOf(v.id, 40).filter((s) => !runId || !s.runId || s.runId === runId);
    if (steps.length) {
      for (const s of steps) box.appendChild(el("div", "bz-dock-liveline", s.text));
    } else {
      if (external == null ? void 0 : external.step) box.appendChild(el("div", "bz-dock-liveline", external.step));
      box.appendChild(el("div", "bz-dock-note", "后台这一轮刚开始，还没输出；跑完会出现在右边的记录里"));
    }
    host.appendChild(box);
  }
  function paramRow(p, values, v) {
    var _a, _b, _c, _d, _e;
    const current = (_a = values[p.key]) != null ? _a : p.default;
    const commit = (val) => {
      values[p.key] = val;
      writeSettings(v.path, v.id, values);
    };
    const label = ((_b = p.label) != null ? _b : p.key) + (p.required ? " *" : "");
    const desc = p.hint;
    if (!canRun()) {
      return uiField({ label, control: readonlyValueOf(p, current), desc });
    }
    if (p.type === "bool") {
      const sw = uiSwitch({ checked: current === true, onChange: (on) => commit(on) });
      return uiField({ label, control: sw.el, desc });
    }
    if (p.type === "choice") {
      const opts = ((_c = p.options) != null ? _c : []).map((o) => ({ value: o, label: o }));
      const sel = uiSelect({ options: opts, value: String((_e = current != null ? current : (_d = p.options) == null ? void 0 : _d[0]) != null ? _e : ""), onChange: (val) => commit(val) });
      return uiField({ label, control: sel.el, desc });
    }
    if (p.type === "multiline") {
      const ta = el("textarea", "bz-input bz-dock-textarea");
      ta.value = current === void 0 ? "" : String(current);
      ta.addEventListener("change", () => commit(ta.value));
      return uiField({ label, control: ta, desc });
    }
    const inp = uiInput({
      type: p.type === "secret" ? "password" : p.type === "number" ? "number" : "text",
      value: current === void 0 ? "" : String(current)
    });
    inp.addEventListener("change", () => {
      if (p.type === "number") {
        const n = Number(inp.value);
        commit(Number.isFinite(n) ? n : void 0);
      } else {
        commit(inp.value);
      }
    });
    return uiField({
      label,
      control: inp,
      desc: p.type === "secret" ? "凭据只存本机工具目录，不进命令行、不写运行记录" : desc
    });
  }
  function readonlyValueOf(p, current) {
    const box = el("span", "bz-dock-roval");
    if (p.type === "secret") {
      const set = current !== void 0 && current !== null && String(current) !== "";
      if (!set) box.classList.add("is-empty");
      box.textContent = set ? "已设置（手机上不显示）" : "未填";
      return box;
    }
    if (p.type === "bool") {
      box.textContent = current === true ? "开" : "关";
      return box;
    }
    const text = current === void 0 || current === null ? "" : String(current).trim();
    if (!text) {
      box.classList.add("is-empty");
      box.textContent = "未填";
      return box;
    }
    if (p.type === "multiline") box.classList.add("bz-dock-roval--code");
    box.textContent = text;
    return box;
  }
  function rulesPane(v) {
    const pane = el("section", "bz-dock-pane bz-dock-rulespane");
    const head = el("div", "bz-dock-pane-head");
    head.appendChild(el("h3", "bz-dock-pane-title", "自动运行"));
    head.appendChild(el("span", "bz-dock-pane-count", v.rules.length ? `${v.rules.length} 条` : "只能手动跑"));
    pane.appendChild(head);
    if (!v.rules.length) pane.appendChild(el("div", "bz-dock-note", "没有规则 —— 加一条就有了"));
    const list = el("div", "bz-dock-rulelist");
    v.rules.forEach((rule, i) => list.appendChild(ruleRow(v, rule, i)));
    pane.appendChild(list);
    if (canRun()) {
      pane.appendChild(
        uiBtn({
          label: "添加规则",
          icon: "plus",
          size: "sm",
          onClick: () => {
            saveRules(v, v.rules.concat(defaultRule()));
          }
        })
      );
    }
    return pane;
  }
  function ruleRow(v, rule, index) {
    var _a, _b;
    const row = el("div", "bz-dock-rule");
    const main = el("div", "bz-dock-rulemain");
    const nameOf = (id) => {
      const t = viewById(id);
      return t ? displayNameOf(t) : id;
    };
    main.appendChild(el("div", "bz-dock-ruleline", triggerText(rule.trigger, nameOf)));
    const meta = [actionText(rule.action)];
    if (rule.jitterMin) meta.push(`抖 ${rule.jitterMin} 分钟`);
    if (rule.enabled === false) meta.push("已停用");
    main.appendChild(el("div", "bz-dock-rulemeta", meta.join(" · ")));
    const due = nextDueOf(rule, {
      now: Date.now(),
      lastFiredAt: ((_b = (_a = v.runtime.rules) == null ? void 0 : _a[rule.id]) == null ? void 0 : _b.lastFiredAt) ? Date.parse(v.runtime.rules[rule.id].lastFiredAt) : void 0
    });
    if (due && rule.enabled !== false && !isEventTrigger(rule.trigger.kind)) {
      main.appendChild(el("div", "bz-dock-rulemeta", `下次 ${new Date(due).toLocaleString()}`));
    }
    row.appendChild(main);
    if (!canRun()) {
      row.classList.add("is-readonly");
      return row;
    }
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.appendChild(el("span", "bz-dock-rulearrow", "›"));
    const open = () => openRuleEditor(v, rule, index);
    row.addEventListener("click", open);
    row.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      open();
    });
    return row;
  }
  function openRuleEditor(v, rule, index) {
    var _a;
    const draft = rule ? { ...rule, trigger: { ...rule.trigger }, action: { ...rule.action } } : { ...defaultRule(), trigger: defaultRule().trigger };
    const form = el("div", "bz-dock-ruleform");
    const params = el("div", "bz-dock-ruleparams");
    const err = el("div", "bz-dock-ruleformerr");
    const preview = el("div", "bz-dock-rulepreview");
    const syncPreview = () => {
      const jit = draft.jitterMin ? ` · 抖 ${draft.jitterMin} 分钟` : "";
      preview.textContent = `${triggerText(draft.trigger, (id) => viewById(id) ? displayNameOf(viewById(id)) : id)} → ${actionText(draft.action)}${jit}`;
    };
    const rebuild = () => {
      params.replaceChildren(...triggerFieldsOf(draft, rebuild));
      syncPreview();
    };
    const triggerPick = uiChoice({
      options: TRIGGER_KINDS.map((k) => ({ value: k, label: TRIGGER_LABEL[k] })),
      value: draft.trigger.kind,
      label: "触发条件",
      onChange: (kind) => {
        draft.trigger = blankTrigger(kind);
        rebuild();
      }
    });
    const actionPick = uiChoice({
      options: [
        { value: "run", label: "运行" },
        { value: "remind", label: "只提醒" }
      ],
      value: draft.action.kind,
      label: "执行",
      onChange: (kind) => {
        draft.action = { kind };
        syncPreview();
      }
    });
    const jitter = uiInput({ type: "number", value: String((_a = draft.jitterMin) != null ? _a : 0) });
    jitter.min = "0";
    jitter.max = "720";
    jitter.addEventListener("change", () => {
      const n = Number(jitter.value);
      draft.jitterMin = Number.isFinite(n) && n > 0 ? Math.min(720, Math.floor(n)) : void 0;
      syncPreview();
    });
    const enabled = uiSwitch({
      checked: draft.enabled !== false,
      onChange: (on) => {
        draft.enabled = on;
      }
    });
    const group = (title, children) => {
      const box = el("div", "bz-dock-ruleformsec");
      box.appendChild(el("div", "bz-dock-ruleformlegend", title));
      for (const c of children) box.appendChild(c);
      return box;
    };
    form.appendChild(group("触发条件", [triggerPick.el, params]));
    form.appendChild(group("执行", [actionPick.el, uiField({ label: "错峰：到点后再等（分钟）", control: jitter, desc: "0 = 不抖" })]));
    form.appendChild(group("状态", [uiField({ label: "这条规则生效", control: enabled.el })]));
    form.appendChild(preview);
    form.appendChild(err);
    rebuild();
    const modal = uiModal({ head: true, title: rule ? "编辑规则" : "新建规则", content: form, maxWidth: 480 });
    const problem = () => {
      const t = draft.trigger;
      if ((t.kind === "tool-ok" || t.kind === "tool-fail") && !t.toolId) return "还没选工具";
      if (t.kind === "domain-event" && !t.channel.trim()) return "还没填事件通道";
      if (t.kind === "file-change" && !t.target.trim()) return "还没填目录";
      if (t.kind === "value-threshold" && (!t.path.trim() || !t.key.trim())) return "还没填文件与键";
      return null;
    };
    const buttons = [];
    if (rule) {
      buttons.push(
        uiBtn({
          label: "删除",
          tone: "danger",
          onClick: () => {
            modal.close();
            saveRules(v, v.rules.filter((r) => r.id !== rule.id));
          }
        })
      );
    }
    buttons.push(
      uiBtn({ label: "取消", onClick: () => modal.close() }),
      uiBtn({
        label: "保存",
        tone: "primary",
        onClick: () => {
          const bad = problem();
          if (bad) {
            err.textContent = bad;
            return;
          }
          const next = v.rules.slice();
          if (rule) next[index] = { ...draft, id: rule.id };
          else next.push({ ...draft, id: `r${Date.now().toString(36)}` });
          modal.close();
          saveRules(v, next);
        }
      })
    );
    form.appendChild(uiBtnRow(buttons));
    syncPreview();
  }
  function triggerFieldsOf(draft, rebuild) {
    const t = draft.trigger;
    const out = [];
    if (t.kind === "daily") {
      const inp = uiInput({ type: "time", value: t.at });
      inp.addEventListener("change", () => {
        if (!/^\d{1,2}:\d{2}$/.test(inp.value)) return;
        draft.trigger = { kind: "daily", at: inp.value };
        rebuild();
      });
      out.push(uiField({ label: "每天几点", control: inp }));
    } else if (t.kind === "interval") {
      const inp = uiInput({ type: "number", value: String(t.everyMin) });
      inp.min = "1";
      inp.addEventListener("change", () => {
        const n = Number(inp.value);
        if (!Number.isFinite(n) || n < 1) return;
        draft.trigger = { kind: "interval", everyMin: Math.min(43200, Math.floor(n)) };
        rebuild();
      });
      out.push(uiField({ label: "每隔多少分钟", control: inp }));
    } else if (t.kind === "on-launch") {
      const inp = uiInput({ type: "number", value: String(t.delayMin) });
      inp.min = "0";
      inp.addEventListener("change", () => {
        const n = Number(inp.value);
        if (!Number.isFinite(n) || n < 0) return;
        draft.trigger = { kind: "on-launch", delayMin: Math.min(1440, Math.floor(n)) };
        rebuild();
      });
      out.push(uiField({ label: "启动 Obsidian 后多少分钟", control: inp }));
    } else if (t.kind === "tool-ok" || t.kind === "tool-fail") {
      const opts = [{ value: "", label: "（选一个工具）" }].concat(
        views.map((v) => ({ value: v.id, label: displayNameOf(v) }))
      );
      const sel = uiSelect({
        options: opts,
        value: t.toolId,
        onChange: (id) => {
          draft.trigger = t.kind === "tool-ok" ? { kind: "tool-ok", toolId: id } : { kind: "tool-fail", toolId: id };
          rebuild();
        }
      });
      out.push(uiField({ label: "哪个工具", control: sel.el }));
    } else if (t.kind === "domain-event") {
      const inp = uiInput({ value: t.channel });
      inp.addEventListener("change", () => {
        draft.trigger = { kind: "domain-event", channel: inp.value.trim() };
      });
      out.push(uiField({ label: "事件通道", control: inp, desc: "例如 memo-saved；填错了这条规则永远不会响" }));
    } else if (t.kind === "file-change") {
      const inp = uiInput({ value: t.target });
      inp.addEventListener("change", () => {
        draft.trigger = { kind: "file-change", target: inp.value.trim().replace(/\/+$/, "") };
      });
      out.push(uiField({ label: "vault 里的目录", control: inp, desc: "那个目录里有文件变动就跑一次" }));
    } else if (t.kind === "value-threshold") {
      const pathIn = uiInput({ value: t.path });
      const keyIn = uiInput({ value: t.key });
      const opSel = uiSelect({
        options: [
          { value: ">", label: "大于" },
          { value: "<", label: "小于" },
          { value: "=", label: "等于" }
        ],
        value: t.op,
        onChange: (op) => {
          draft.trigger = { ...t, op };
        }
      });
      const numIn = uiInput({ type: "number", value: String(t.value) });
      pathIn.addEventListener("change", () => {
        draft.trigger = { ...t, path: pathIn.value.trim() };
      });
      keyIn.addEventListener("change", () => {
        draft.trigger = { ...t, key: keyIn.value.trim() };
      });
      numIn.addEventListener("change", () => {
        const n = Number(numIn.value);
        if (Number.isFinite(n)) draft.trigger = { ...t, value: n };
      });
      out.push(uiField({ label: "文件", control: pathIn, desc: "vault 里的 JSON" }));
      out.push(uiField({ label: "键", control: keyIn }));
      const row = el("div", "bz-dock-rule-edit");
      row.append(opSel.el, numIn);
      out.push(uiField({ label: "条件", control: row }));
    } else {
      out.push(el("div", "bz-dock-note", "这条触发不需要参数。"));
    }
    return out;
  }
  function blankTrigger(kind) {
    switch (kind) {
      case "daily":
        return { kind: "daily", at: "09:00" };
      case "interval":
        return { kind: "interval", everyMin: 60 };
      case "on-launch":
        return { kind: "on-launch", delayMin: 5 };
      case "tool-ok":
        return { kind: "tool-ok", toolId: "" };
      case "tool-fail":
        return { kind: "tool-fail", toolId: "" };
      case "domain-event":
        return { kind: "domain-event", channel: "" };
      case "file-change":
        return { kind: "file-change", target: "" };
      case "value-threshold":
        return { kind: "value-threshold", path: "", key: "", op: ">", value: 0 };
      case "obsidian-exit":
        return { kind: "obsidian-exit" };
      default:
        return { kind: "panel-open" };
    }
  }
  function saveRules(v, rules) {
    writeIntent(v.path, { ...v.intent, v: 1, tool: v.id, rules });
    void kickDockScheduler();
    refresh();
  }
  function histPane(v) {
    const pane = el("section", "bz-dock-pane bz-dock-histpane");
    const runs = recentRunsOf(v.path, v.id, 60);
    const head = el("div", "bz-dock-pane-head");
    head.appendChild(el("h3", "bz-dock-pane-title", "运行记录"));
    head.appendChild(el("span", "bz-dock-pane-count", `${runs.length} 条`));
    pane.appendChild(head);
    if (!runs.length) {
      pane.appendChild(
        uiEmpty({
          icon: "history",
          title: "还没有运行记录",
          desc: "跑一次，或等它按规则自动跑完，记录就会出现"
        })
      );
      return pane;
    }
    const list = el("div", "bz-dock-histlist");
    for (const r of runs) list.appendChild(histRow(r, v.id));
    pane.appendChild(list);
    const open = openRuns.get(v.id);
    if (open == null ? void 0 : open.size) {
      const alive = new Set(runs.map((r) => r.runId));
      for (const id of open) if (!alive.has(id)) open.delete(id);
    }
    if (runs.length >= 60) pane.appendChild(el("div", "bz-dock-note", "只显示最近 60 条"));
    return pane;
  }
  function histRow(r, toolId) {
    var _a, _b, _c, _d, _e;
    const row = el("article", "bz-dock-histrow");
    row.dataset.run = r.runId;
    const openSet = openRunsOf(toolId);
    const wasOpen = openSet.has(r.runId);
    const head = el("div", "bz-dock-histhead");
    head.appendChild(el("span", dotClass(r.status)));
    head.appendChild(el("span", "bz-dock-histtime", relTime(r.startedAt.replace("T", " "))));
    head.appendChild(el("span", "bz-dock-histstatus", statusText(r.status)));
    if (r.durationMs) head.appendChild(el("span", "bz-dock-histdur", `${Math.round(r.durationMs / 1e3)}s`));
    head.appendChild(el("span", "bz-dock-histtrig", r.trigger === "auto" ? "自动" : "手动"));
    row.appendChild(head);
    if (r.message) row.appendChild(el("div", "bz-dock-histmsg", r.message));
    if (r.error) {
      const box = el("div", "bz-dock-histerr");
      box.appendChild(el("div", "bz-dock-histerr-hint", hintOf(r.error.kind)));
      if (r.error.detail) box.appendChild(el("div", "bz-dock-histerr-detail", r.error.detail));
      row.appendChild(box);
    }
    const hasMore = r.steps && r.steps.length > 0 || r.info && r.info.length > 0 || r.result !== void 0 || r.metrics !== void 0 || r.artifacts && r.artifacts.length > 0 || !!((_a = r.error) == null ? void 0 : _a.stderr);
    if (hasMore) {
      const btn = uiBtn({
        label: wasOpen ? "收起" : "展开",
        size: "sm",
        className: "bz-dock-histtoggle"
      });
      row.appendChild(btn);
      if (wasOpen) row.classList.add("is-open");
      const more = el("div", "bz-dock-histmore");
      if ((_b = r.steps) == null ? void 0 : _b.length) more.appendChild(block("步骤", r.steps.map((s) => s.text).join("\n")));
      if (r.metrics) more.appendChild(block("指标", JSON.stringify(r.metrics, null, 2)));
      if ((_c = r.artifacts) == null ? void 0 : _c.length) {
        const box = el("div", "bz-dock-block");
        box.appendChild(el("div", "bz-dock-block-label", "产物"));
        for (const a of r.artifacts) {
          const line = el("div", "bz-dock-artrow");
          line.appendChild(el("span", "bz-dock-artrow-path", `${a.label ? a.label + " · " : ""}${a.path}`));
          line.appendChild(uiIconBtn({ icon: "external-link", title: "打开 / 定位产物", xs: true, onClick: () => openArtifact(a.path) }));
          box.appendChild(line);
        }
        more.appendChild(box);
      }
      if (r.result !== void 0) more.appendChild(block("结果", JSON.stringify(r.result, null, 2)));
      if ((_d = r.info) == null ? void 0 : _d.length) more.appendChild(block("信息", JSON.stringify(r.info, null, 2)));
      if ((_e = r.error) == null ? void 0 : _e.stderr) more.appendChild(block("stderr 尾部", r.error.stderr));
      row.appendChild(more);
      btn.addEventListener("click", () => {
        const open = row.classList.toggle("is-open");
        if (open) openSet.add(r.runId);
        else openSet.delete(r.runId);
        const span = btn.querySelector("span");
        if (span) span.textContent = open ? "收起" : "展开";
      });
    }
    if (r.startedAt) {
      row.appendChild(el("div", "bz-dock-histexact", r.startedAt.replace("T", " ").replace(/\..*$/, "")));
    }
    return row;
  }
  function block(label, text) {
    const b = el("div", "bz-dock-block");
    b.appendChild(el("div", "bz-dock-block-label", label));
    const pre = el("pre", "bz-dock-json");
    pre.textContent = text;
    b.appendChild(pre);
    return b;
  }
  async function doRun(v) {
    const outcome = await runToolManually(v);
    if (outcome) notice(`${displayNameOf(v)}：${outcome.ok ? "跑完了" : "失败了"}`, outcome.ok ? "success" : "error");
    refresh();
  }
  function doTrust(v) {
    var _a;
    if (!v.entry) return;
    const content = document.createElement("div");
    content.className = "bz-dock-trust";
    content.appendChild(el("div", "bz-dock-note", "授权之后，工具坞可以按这条命令启动它。声明里的命令一改，这道授权就失效。"));
    const pre = el("pre", "bz-dock-json");
    pre.textContent = [v.entry.cmd, ...(_a = v.entry.args) != null ? _a : []].join(" ");
    content.appendChild(pre);
    const modal = uiModal({ content, head: true, title: "授权这条命令", maxWidth: 520 });
    content.appendChild(
      uiBtnRow(
        [
          uiBtn({ label: "取消", onClick: () => modal.close() }),
          uiBtn({
            label: "授权",
            tone: "primary",
            onClick: () => {
              modal.close();
              void trustTool(v.id, v.entry).then(() => {
                notice(`${displayNameOf(v)} 已授权`, "success");
                refresh();
              });
            }
          })
        ],
        { center: true }
      )
    );
  }
  async function doUntrust(v) {
    if (!window.confirm(`撤销「${displayNameOf(v)}」的授权？
撤销后它不能再跑，直到重新授权。`)) return;
    await untrustTool(v.id);
    refresh();
  }
  function pickFolder() {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.addEventListener("change", () => {
      var _a;
      const files = Array.from((_a = input.files) != null ? _a : []);
      const cands = files.filter((f) => f.name === "manifest.json").map((f) => ({ f, depth: (f.webkitRelativePath || f.name).split("/").length })).sort((a, b) => a.depth - b.depth);
      if (!cands.length) {
        notice("这个文件夹里没有 manifest.json", "warning");
        return;
      }
      const shallow = cands.filter((c) => c.depth === cands[0].depth);
      if (shallow.length > 1) {
        notice(`这个文件夹里有 ${shallow.length} 个工具，请选中具体的那一个工具目录`, "warning");
        return;
      }
      const abs = fileDiskPath(shallow[0].f);
      if (!abs) {
        notice("读不到文件夹路径（这个平台不支持）", "warning");
        return;
      }
      void importFrom(abs.replace(/\\/g, "/"));
    });
    input.click();
  }
  async function importFrom(manifestPath) {
    const fs = currentFs();
    if (!fs) {
      notice("桌面端才能导入", "warning");
      return;
    }
    const text = fs.readText(manifestPath);
    if (text === null) {
      notice("读不到这个文件", "warning");
      return;
    }
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      notice("manifest.json 不是合法 JSON", "warning");
      return;
    }
    const manifest = parseManifest(raw);
    if (!manifest) {
      notice("声明校验不过（需要 v:2、合法 id、非空 name）", "warning");
      return;
    }
    upsertTool({ id: manifest.id, path: manifestPath });
    notice(`已登记「${manifest.name}」，先看一眼它会跑什么，再授权`);
    view = { kind: "detail", id: manifest.id };
    refresh();
  }
  function rememberTails() {
    var _a;
    for (const run of liveAll()) {
      if ((_a = run.rawTail) == null ? void 0 : _a.length) lastTails.set(run.toolId, run.rawTail.slice(-12));
    }
  }
  function maybeOfflineReport() {
    let prev = 0;
    try {
      prev = Number(window.localStorage.getItem(LAST_SEEN_KEY) || 0);
      window.localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch (e) {
      return;
    }
    const now = Date.now();
    if (!Number.isFinite(prev) || prev <= 0 || now - prev < 6e4) return;
    const hits = [];
    for (const v of views) {
      for (const run of recentRunsOf(v.path, v.id, 60)) {
        if (run.trigger !== "auto") continue;
        const at = Date.parse(run.startedAt);
        if (!Number.isFinite(at) || at <= prev || at > now) continue;
        hits.push({ name: displayNameOf(v), run });
      }
    }
    if (!hits.length) return;
    hits.sort((a, b) => Date.parse(b.run.startedAt) - Date.parse(a.run.startedAt));
    const ok = hits.filter((h) => h.run.status === "ok").length;
    const bad = hits.length - ok;
    const box = el("div", "bz-dock-rep");
    const sum = el("div", "bz-dock-rep-sum");
    sum.appendChild(el("div", "bz-dock-rep-lead", `上次打开之后，自动跑了 ${hits.length} 次`));
    const tally = el("div", "bz-dock-rep-tally");
    tally.appendChild(el("span", "bz-dock-rep-ok", `成功 ${ok}`));
    if (bad) tally.appendChild(el("span", "bz-dock-rep-bad", `没跑成 ${bad}`));
    tally.appendChild(el("span", "bz-dock-rep-span", new Date(prev).toLocaleString()));
    sum.appendChild(tally);
    box.appendChild(sum);
    const list = el("div", "bz-dock-rep-list");
    for (const h of hits.slice(0, 12)) {
      const item = el("div", h.run.status === "ok" ? "bz-dock-rep-item" : "bz-dock-rep-item is-bad");
      const line = el("div", "bz-dock-rep-line");
      line.appendChild(el("span", "bz-dock-rep-dot"));
      line.appendChild(el("span", "bz-dock-rep-name", h.name));
      line.appendChild(el("span", "bz-dock-rep-fact", `${statusText(h.run.status)} · ${relTime(h.run.startedAt.replace("T", " "))}`));
      item.appendChild(line);
      if (h.run.message) item.appendChild(el("div", "bz-dock-rep-detail", h.run.message));
      list.appendChild(item);
    }
    box.appendChild(list);
    if (hits.length > 12) box.appendChild(el("div", "bz-dock-note", `只列最近 12 条，其余去各工具的记录里看`));
    box.appendChild(
      uiBtnRow([uiBtn({ label: "知道了", tone: "primary", onClick: () => modal.close() })], { center: true })
    );
    const modal = uiModal({ head: true, title: "自动运行简报", content: box, maxWidth: 460 });
  }
  async function copyText(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      notice(`已复制${what}`);
    } catch (e) {
      notice(`复制失败，请手动复制：${text}`, "warning");
    }
  }
  function openArtifact(p) {
    var _a, _b, _c, _d;
    const w = window;
    const shell = (_b = (_a = w.require) == null ? void 0 : _a.call(w, "electron")) == null ? void 0 : _b.shell;
    if (!shell) {
      void copyText(p, "产物路径");
      return;
    }
    const norm2 = p.replace(/\\/g, "/");
    const isAbsolute = /^[a-zA-Z]:\//.test(norm2) || norm2.startsWith("//") || norm2.startsWith("/");
    if (!isAbsolute && hostApp) {
      const file = hostApp.vault.getAbstractFileByPath(norm2);
      if (file) {
        void hostApp.workspace.openLinkText(norm2, "", true);
        return;
      }
    }
    const base = hostApp ? (_d = (_c = hostApp.vault.adapter) == null ? void 0 : _c.getBasePath) == null ? void 0 : _d.call(_c) : void 0;
    shell.showItemInFolder(isAbsolute || !base ? p : `${base}/${norm2}`);
  }

  // prototypes/dock/fake-sim.ts
  var MiniBuffer = class _MiniBuffer {
    constructor(bytes) {
      this.bytes = bytes;
    }
    static from(input, _encoding) {
      return input instanceof Uint8Array ? new _MiniBuffer(input) : new _MiniBuffer(new TextEncoder().encode(input));
    }
    static concat(parts) {
      const total = parts.reduce((n, p) => n + p.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const p of parts) {
        out.set(p.bytes, off);
        off += p.length;
      }
      return new _MiniBuffer(out);
    }
    get length() {
      return this.bytes.length;
    }
    indexOf(value, from = 0) {
      for (let i = from; i < this.bytes.length; i++) if (this.bytes[i] === value) return i;
      return -1;
    }
    subarray(start = 0, end = this.bytes.length) {
      return new _MiniBuffer(this.bytes.subarray(start, end));
    }
    toString(_encoding) {
      return new TextDecoder().decode(this.bytes);
    }
  };
  function installBufferPolyfill() {
    const w = window;
    if (!w.Buffer) w.Buffer = MiniBuffer;
  }
  var PREFIX = "bz-sim:";
  var VAULT = "/sim-vault";
  var ROOT = `${VAULT}/CONFIG/SCRIPTS/DockTools`;
  var SEED_FLAG = "bz-dock-sim-seeded-v3";
  function keyOf(p) {
    return PREFIX + p;
  }
  var simFs = {
    readText: (p) => localStorage.getItem(keyOf(p)),
    writeText: (p, d) => localStorage.setItem(keyOf(p), d),
    rename: (a, b) => {
      const v = localStorage.getItem(keyOf(a));
      if (v === null) throw new Error(`no such file: ${a}`);
      localStorage.removeItem(keyOf(a));
      localStorage.setItem(keyOf(b), v);
    },
    createExclusive: (p, d) => {
      if (localStorage.getItem(keyOf(p)) !== null) return false;
      localStorage.setItem(keyOf(p), d);
      return true;
    },
    unlink: (p) => localStorage.removeItem(keyOf(p)),
    exists: (p) => localStorage.getItem(keyOf(p)) !== null,
    mkdir: () => void 0
  };
  var HOUR = 36e5;
  var DAY = 24 * HOUR;
  var iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
  var SEEDS = [
    {
      id: "demo-signin",
      name: "每日签到",
      desc: "把签到和分享做完，记下积分",
      icon: "calendar-check",
      at: "09:30",
      params: [
        { key: "cookie", label: "登录凭据", type: "secret", required: true, hint: "从浏览器开发者工具复制整串 Cookie" }
      ],
      values: { cookie: "已保存" },
      runs: [
        { runId: "r-s1", trigger: "auto", status: "ok", startedAt: iso(2 * HOUR), durationMs: 42e3, message: "签到成功，积分 +12" },
        { runId: "r-s2", trigger: "auto", status: "ok", startedAt: iso(DAY + 2 * HOUR), durationMs: 39e3, message: "签到成功，连续 7 天" },
        { runId: "r-s3", trigger: "auto", status: "failed", startedAt: iso(2 * DAY), durationMs: 9e3, message: "凭据过期", error: { kind: "auth" } },
        { runId: "r-s4", trigger: "manual", status: "ok", startedAt: iso(3 * DAY), durationMs: 41e3, message: "签到成功" },
        { runId: "r-s5", trigger: "auto", status: "ok", startedAt: iso(4 * DAY), durationMs: 44e3, message: "签到成功" }
      ]
    },
    {
      id: "demo-radar",
      name: "比价雷达",
      desc: "挑十元内的好评游戏，比一遍渠道价",
      icon: "radar",
      at: "12:00",
      panel: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font:12px/1.6 system-ui;margin:0;padding:12px;color:#333;background:#faf9f7}
      h4{margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#8b6f4e}
      table{width:100%;border-collapse:collapse}
      td{padding:4px 0;border-bottom:1px solid #eee}
      .p{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
      .low{color:#b4472f}
    </style></head><body>
      <h4>本次最便宜的 3 款</h4>
      <table>
        <tr><td>Hades</td><td class="p low">¥8.4</td></tr>
        <tr><td>Stardew Valley</td><td class="p">¥9.9</td></tr>
        <tr><td>Hollow Knight</td><td class="p">¥9.5</td></tr>
      </table>
    </body></html>`,
      runs: [
        { runId: "r-r1", trigger: "manual", status: "ok", startedAt: iso(3 * HOUR), durationMs: 61e3, message: "捡到 3 款" },
        { runId: "r-r2", trigger: "auto", status: "ok", startedAt: iso(DAY + 3 * HOUR), durationMs: 58e3, message: "捡到 1 款" }
      ]
    },
    {
      id: "demo-backup",
      name: "笔记备份",
      desc: "把库里的笔记打包推到网盘",
      icon: "archive",
      at: "23:00",
      untrusted: true,
      runs: []
    },
    {
      id: "demo-broken",
      name: "声明坏了",
      desc: "用来演示「读不到声明」长什么样",
      icon: "file-warning",
      manifestRaw: '{ "v": 2, "id": "demo-broken", "name": "声明坏了", '
    },
    {
      id: "demo-missing",
      name: "缺参数的活",
      desc: "必填参数没填，自动运行会被跳过",
      icon: "key-round",
      at: "08:00",
      params: [{ key: "token", label: "接口密钥", type: "secret", required: true }],
      values: {}
    },
    {
      id: "demo-failing",
      name: "连续失败",
      desc: "熔断中：面板应给出「恢复自动运行」",
      icon: "triangle-alert",
      at: "07:00",
      runtime: {
        run: { lastAttemptAt: iso(20 * 6e4), lastAttemptOk: false, consecutiveFailures: 3, pausedAt: iso(20 * 6e4) },
        rules: {
          "r-demo-failing": { lastFiredAt: iso(20 * 6e4), lastStatus: "failed", lastRunId: "r-f1" }
        }
      },
      runs: [
        { runId: "r-f1", trigger: "auto", status: "failed", startedAt: iso(20 * 6e4), durationMs: 3e3, message: "接口 502" }
      ]
    },
    {
      id: "demo-live",
      name: "后台在跑",
      desc: "心跳新鲜 → 卡片「正在跑」、运行按钮禁用",
      icon: "activity",
      at: "06:00",
      beat: { runId: "r-live-1", step: "正在抓第 12 页" },
      runs: []
    },
    {
      id: "demo-off",
      name: "已停用",
      desc: "手动关掉的工具，卡片置灰",
      icon: "power",
      at: "05:00",
      intent: { enabled: false }
    }
  ];
  function manifestOf(t) {
    if (t.manifestRaw) return t.manifestRaw;
    return JSON.stringify(
      {
        v: 2,
        id: t.id,
        name: t.name,
        description: t.desc,
        icon: t.icon,
        entry: { cmd: "node", args: ["main.mjs"] },
        ...t.params ? { params: t.params } : {},
        ...t.at ? { defaultRules: [{ id: `r-${t.id}`, trigger: { kind: "daily", at: t.at }, action: { kind: "run" } }] } : {}
      },
      null,
      2
    );
  }
  function trustOfSeeds() {
    const out = {};
    const sig = runSignature({ cmd: "node", args: ["main.mjs"] });
    for (const t of SEEDS) {
      if (t.untrusted || t.manifestRaw) continue;
      out[t.id] = { at: iso(DAY * 3), run: sig };
    }
    return out;
  }
  function seed() {
    var _a, _b;
    if (localStorage.getItem(SEED_FLAG)) return;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
    for (const t of SEEDS) {
      const dir = `${ROOT}/${t.id}`;
      localStorage.setItem(keyOf(`${dir}/manifest.json`), manifestOf(t));
      if (t.panel) localStorage.setItem(keyOf(`${dir}/panel.html`), t.panel);
      if (t.values) {
        localStorage.setItem(keyOf(`${dir}/data.json`), JSON.stringify({ v: 2, tool: t.id, values: t.values }, null, 2));
      }
      if (t.intent) {
        localStorage.setItem(
          keyOf(`${dir}/dock.intent.json`),
          JSON.stringify({ v: 1, tool: t.id, ...t.intent }, null, 2)
        );
      }
      if (t.runtime) {
        localStorage.setItem(
          keyOf(`${dir}/dock.runtime.json`),
          JSON.stringify({ v: 1, tool: t.id, ...t.runtime, updatedAt: iso(0) }, null, 2)
        );
      }
      if (t.beat) {
        localStorage.setItem(
          keyOf(`${dir}/heartbeat.json`),
          JSON.stringify({ runId: t.beat.runId, at: iso(3e3), step: t.beat.step })
        );
      }
      for (const r of (_a = t.runs) != null ? _a : []) {
        const p = `${dir}/runs.jsonl`;
        const prev = (_b = localStorage.getItem(keyOf(p))) != null ? _b : "";
        localStorage.setItem(keyOf(p), prev + JSON.stringify({ tool: t.id, ...r }) + "\n");
      }
    }
    localStorage.setItem(
      keyOf(`${VAULT}/CONFIG/STORAGE/dock.json`),
      JSON.stringify(
        {
          v: 3,
          // 演示可移植形态：登记表跟着库走，换台机器也读得到（`vault:CONFIG/...`）
          tools: SEEDS.map((t) => ({
            id: t.id,
            path: `vault:CONFIG/SCRIPTS/DockTools/${t.id}/manifest.json`
          }))
        },
        null,
        2
      )
    );
    localStorage.setItem(SEED_FLAG, "1");
  }
  var Bus = class {
    constructor() {
      this.handlers = /* @__PURE__ */ new Map();
    }
    on(evt, cb) {
      if (!this.handlers.has(evt)) this.handlers.set(evt, []);
      this.handlers.get(evt).push(cb);
      return this;
    }
    emit(evt, arg) {
      var _a;
      for (const cb of (_a = this.handlers.get(evt)) != null ? _a : []) cb(arg);
    }
  };
  var DEMO_STEPS = [
    "打开登录页",
    "已登录，读到今日任务",
    "提交签到",
    "分享一次",
    "写运行记录"
  ];
  var fakeCp = {
    spawn(_cmd, _args, opts = {}) {
      var _a, _b, _c, _d, _e;
      const env = (_a = opts.env) != null ? _a : {};
      const runId = (_b = env.BZ_DOCK_RUN_ID) != null ? _b : "local";
      const runsFile = (_c = env.BZ_DOCK_RUNS_FILE) != null ? _c : "";
      const beatFile = (_d = env.BZ_DOCK_HEARTBEAT_FILE) != null ? _d : "";
      const toolId = (_e = env.BZ_DOCK_TOOL) != null ? _e : "";
      const stdout = new Bus();
      const stderr = new Bus();
      const child = new Bus();
      child.stdout = stdout;
      child.stderr = stderr;
      child.pid = 9e3 + Math.floor(Math.random() * 900);
      child.stdin = { write: () => void 0, end: () => void 0, destroyed: false, writableEnded: false, on: () => void 0 };
      const startedAt = (/* @__PURE__ */ new Date()).toISOString();
      let killed = false;
      const beat = (step) => {
        if (beatFile) {
          localStorage.setItem(
            keyOf(beatFile),
            JSON.stringify({ runId, at: (/* @__PURE__ */ new Date()).toISOString(), step })
          );
        }
      };
      child.kill = () => {
        killed = true;
      };
      let i = 0;
      const tick2 = () => {
        var _a2, _b2;
        if (killed) return;
        if (i < DEMO_STEPS.length) {
          const text = DEMO_STEPS[i];
          i += 1;
          beat(text);
          stdout.emit("data", `[bz-step] ${text}
`);
          window.setTimeout(tick2, 700);
          return;
        }
        const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
        if (runsFile) {
          const prev = (_a2 = localStorage.getItem(keyOf(runsFile))) != null ? _a2 : "";
          localStorage.setItem(
            keyOf(runsFile),
            prev + JSON.stringify({
              runId,
              tool: toolId,
              trigger: (_b2 = env.BZ_DOCK_TRIGGER) != null ? _b2 : "manual",
              status: "ok",
              startedAt,
              finishedAt,
              durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
              message: "演练完成（评审壳，没有真跑）"
            }) + "\n"
          );
        }
        child.emit("exit", 0);
        child.emit("close", 0);
      };
      beat("刚起跑");
      window.setTimeout(tick2, 400);
      return child;
    }
  };
  var settings = {};
  function boot() {
    installBufferPolyfill();
    seed();
    if (!localStorage.getItem(keyOf(`${VAULT}/CONFIG/STORAGE/dock.json`))) {
      localStorage.removeItem(SEED_FLAG);
      seed();
    }
    settings = { storagePath: "CONFIG/STORAGE", dockTrust: trustOfSeeds() };
    setApp(new FakeApp());
    setSettingsProvider(() => settings);
    setSettingsSaver(async () => void 0);
    setDockFs(simFs);
    setExecDeps({ cp: fakeCp });
    setDockVaultRoot(VAULT);
  }
  window.DOCK_SEED = { total: SEEDS.length, ids: SEEDS.map((t) => t.id) };
  window.BZW_dock = {
    boot,
    openDock: () => openDock(getApp()),
    closeDock,
    unloadDock
  };
  return __toCommonJS(fake_sim_exports);
})();
