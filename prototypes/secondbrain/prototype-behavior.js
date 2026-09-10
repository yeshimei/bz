/* 源指纹 6679dc8859f8e468 · 仓内输入 78 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/secondbrain/fake-sim.ts","prototypes/secondbrain/fake/fake-obsidian.ts","src/core/ai.ts","src/core/app.ts","src/core/crypto.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/flow-dialog.ts","src/core/item-actions.ts","src/core/mobile.ts","src/core/notice.ts","src/core/path-picker.ts","src/core/settings-common.ts","src/core/settings-modal.ts","src/core/settings-provider.ts","src/core/settings-schema.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts","src/encrypt/data.ts","src/encrypt/index.ts","src/encrypt/preview.ts","src/encrypt/pw-picker.ts","src/encrypt/ui.ts","src/encrypt/vault-assets-view.ts","src/encrypt/vault-data.ts","src/encrypt/vault-pw-view.ts","src/secondbrain/ai.ts","src/secondbrain/binary.ts","src/secondbrain/chat-panel.ts","src/secondbrain/chunk.ts","src/secondbrain/config.ts","src/secondbrain/context.ts","src/secondbrain/float-window.ts","src/secondbrain/index.ts","src/secondbrain/link-agent/data.ts","src/secondbrain/link-agent/pipeline.ts","src/secondbrain/link-agent/watch.ts","src/secondbrain/local-ip.ts","src/secondbrain/mobile-panel.ts","src/secondbrain/ollama.ts","src/secondbrain/panel.ts","src/secondbrain/parallel.ts","src/secondbrain/reference-panel.ts","src/secondbrain/render.ts","src/secondbrain/store-file.ts","src/secondbrain/text-search.ts","src/secondbrain/tfidf.ts","src/secondbrain/ui-tools.ts","src/secondbrain/vector-store.ts","src/secondbrain/vptree.ts","src/secondbrain/whitelist.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/secondbrain/fake-sim.ts → window.BZW_secondbrain（行为单源预览包，issue 245/ADR-0106） */
var BZW_secondbrain = (() => {
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

  // prototypes/secondbrain/fake/fake-obsidian.ts
  function setIcon(container, iconId) {
    var _a2;
    const d = typeof window !== "undefined" && ((_a2 = window.SB_ICONS) == null ? void 0 : _a2[iconId]) || "";
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
    throw new Error("原型环境无 Obsidian requestUrl（fake obsidian）");
  }
  var Platform, MarkdownRenderer, Component, FakeVault, FakeApp;
  var init_fake_obsidian = __esm({
    "prototypes/secondbrain/fake/fake-obsidian.ts"() {
      Platform = {
        isMobile: typeof window !== "undefined" && window.innerWidth <= 768
      };
      if (typeof globalThis !== "undefined") {
        globalThis.obsidian = globalThis.obsidian || { Platform };
      }
      MarkdownRenderer = {
        async render(_app2, md, el) {
          const html = String(md).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
          el.innerHTML = html;
        }
      };
      Component = class {
        onload() {
        }
        unload() {
        }
      };
      FakeVault = class _FakeVault {
        constructor() {
          this.listeners = /* @__PURE__ */ new Map();
          /** 存储面（core/storage jsonFileStore / vector-store 二进制 / 主面板存储占用） */
          this.adapter = {
            exists: async (path) => localStorage.getItem(_FakeVault.key(path)) != null,
            read: async (path) => {
              const raw = localStorage.getItem(_FakeVault.key(path));
              if (raw == null) throw new Error("file not found: " + path);
              return raw;
            },
            write: async (path, data) => {
              localStorage.setItem(_FakeVault.key(path), data);
            },
            /** 与 Obsidian adapter.stat 同形：{ size } 或抛错（调用方 try/catch） */
            stat: async (path) => {
              const raw = localStorage.getItem(_FakeVault.key(path));
              if (raw == null) throw new Error("file not found: " + path);
              return { size: raw.length, type: "file" };
            },
            /** 二进制面（vector-store 专用；原型以 base64 存取，行为代码原样跑） */
            readBinary: async (path) => {
              const raw = localStorage.getItem(_FakeVault.key(path));
              if (raw == null) throw new Error("file not found: " + path);
              const bin = atob(raw);
              const buf = new ArrayBuffer(bin.length);
              const view = new Uint8Array(buf);
              for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
              return buf;
            },
            writeBinary: async (path, data) => {
              const view = new Uint8Array(data);
              let bin = "";
              for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
              localStorage.setItem(_FakeVault.key(path), btoa(bin));
            }
          };
        }
        static key(path) {
          return "bz-sb-sim:" + path;
        }
        getAbstractFileByPath(path) {
          const raw = localStorage.getItem(_FakeVault.key(path));
          return raw == null ? null : { path, content: raw };
        }
        /** 白名单扫描面（vector-store.refresh 链）：种子库无 md 笔记 → 无变更，refresh 快速完成 */
        getMarkdownFiles() {
          const out = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(_FakeVault.key("")) && k.endsWith(".md")) {
              const path = k.slice(_FakeVault.key("").length);
              out.push({ path, content: localStorage.getItem(k) || "" });
            }
          }
          return out;
        }
        async read(f) {
          return f.content;
        }
        async modify(f, content) {
          f.content = content;
          localStorage.setItem(_FakeVault.key(f.path), content);
        }
        async create(path, content) {
          localStorage.setItem(_FakeVault.key(path), content);
          return { path, content };
        }
        async createFolder(_path) {
          return void 0;
        }
        on(evt, cb) {
          if (!this.listeners.has(evt)) this.listeners.set(evt, []);
          this.listeners.get(evt).push(cb);
          return { ref: this.listeners.get(evt).length };
        }
        offref(_ref) {
        }
        emit(evt, file) {
          var _a2;
          for (const cb of (_a2 = this.listeners.get(evt)) != null ? _a2 : []) cb(file);
        }
      };
      FakeApp = class {
        constructor() {
          this.vault = new FakeVault();
          /** 参考面板的光标轮询在无编辑器时静默空转（真行为同语义）；演示检索由 fake-sim 的
           *  「换一篇当前笔记」驱动 refreshWithDebounce */
          this.workspace = {
            activeEditor: null,
            getActiveFile: () => null,
            getLeaf: () => ({
              openFile: async () => {
              }
            }),
            on: () => ({ ref: 0 }),
            offref() {
            }
          };
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

  // src/core/ai.ts
  function setAISettingsProvider(fn) {
    _settingsProvider = fn;
  }
  function getQ3Settings() {
    return _settingsProvider ? _settingsProvider() : {};
  }
  function getProviderDescriptor(id) {
    return AI_PROVIDER_REGISTRY.find((p) => p.id === id) || AI_PROVIDER_REGISTRY.find((p) => p.id === "custom") || AI_PROVIDER_REGISTRY[AI_PROVIDER_REGISTRY.length - 1];
  }
  async function getAIProvider(override) {
    var _a2, _b2, _c;
    if (!override && _aiProviderCache) return _aiProviderCache;
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
      _aiProviderCache = {
        endpoint,
        apiKey: s.aiCustomApiKey,
        model: s.aiCustomModel || void 0,
        extraHeaders: desc.extraHeaders,
        contextWindow: desc.defaultContextWindow,
        defaultMaxTokens: desc.defaultMaxTokens
      };
      return _aiProviderCache;
    }
    const key = s[desc.apiKeyKey];
    if (!key && name === "deepseek") {
      try {
        const raw = await getApp().vault.adapter.read(".obsidian/plugins/quickadd/data.json");
        const cfg = JSON.parse(raw);
        const provider = cfg.ai && cfg.ai.providers && cfg.ai.providers[0];
        if (provider && provider.endpoint && provider.apiKey) {
          _aiProviderCache = {
            endpoint: String(provider.endpoint).replace(/\/+$/, ""),
            apiKey: provider.apiKey,
            contextWindow: desc.defaultContextWindow,
            defaultMaxTokens: desc.defaultMaxTokens
          };
          return _aiProviderCache;
        }
      } catch (e) {
      }
    }
    if (!key && name !== "ollama") {
      throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
    }
    const overrideModel = (_a2 = s.aiModelOverrides) == null ? void 0 : _a2[name];
    const overrideContext = (_b2 = s.aiContextOverrides) == null ? void 0 : _b2[name];
    const overrideMaxTokens = (_c = s.aiMaxTokensOverrides) == null ? void 0 : _c[name];
    _aiProviderCache = {
      endpoint: desc.endpoint,
      apiKey: key || "",
      model: overrideModel || desc.model || void 0,
      noCors: desc.noCors,
      extraHeaders: desc.extraHeaders,
      contextWindow: overrideContext || desc.defaultContextWindow,
      defaultMaxTokens: overrideMaxTokens || desc.defaultMaxTokens
    };
    return _aiProviderCache;
  }
  function abortError() {
    const e = new Error("请求已取消");
    e.name = "AbortError";
    return e;
  }
  async function streamChatCompletions(provider, body, signal, onDelta) {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...provider.extraHeaders || {}
    };
    const resp = await fetch(`${provider.endpoint}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal
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
  }
  async function chatCompletionsNonStream(provider, body, signal) {
    if (signal == null ? void 0 : signal.aborted) throw abortError();
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...provider.extraHeaders || {}
    };
    const resp = await requestUrl({
      url: `${provider.endpoint}/chat/completions`,
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, stream: false })
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
  var _settingsProvider, AI_PROVIDER_REGISTRY, _aiProviderCache, AIService;
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
      AIService = class {
        constructor(params, defaultModel = "deepseek-v4-flash", defaultOptions = {}) {
          this.defaultModel = defaultModel;
          this.defaultOptions = defaultOptions;
        }
        /** 通用 AI 请求（fetch 流式，失败自动 fallback requestUrl 非流式）；
         *  options.signal（取消）/ options.onDelta（流式增量回调）为调用方选项（ticket 141），不进请求体，
         *  既有调用（不传这两项）行为零变化 */
        async prompt(promptText, model = this.defaultModel, options = {}) {
          var _a2;
          const mergedOptions = this._mergeOptions(options);
          const provider = await getAIProvider(mergedOptions.provider);
          const s = getQ3Settings();
          const isExplicit = model !== this.defaultModel;
          const effModel = isExplicit ? model : provider.model || model;
          const mo = mergedOptions.modelOptions || {};
          const effMaxTokens = (_a2 = mo.max_tokens) != null ? _a2 : provider.defaultMaxTokens || 4096;
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

  // src/core/z-order.ts
  function syncAlwaysOnTop() {
    for (const el of alwaysOnTop) {
      if (el.isConnected) el.style.zIndex = String(zCounter);
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
  var MAX_VISIBLE, LEAVE_MS, DEDUPE_WINDOW_MS, MOBILE_QUERY, ICONS, SPINNER_SVG, OUT_CLASS, PER_CHAR_MS, SHORT_THRESHOLD, live, recent;
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

  // src/core/mobile.ts
  var init_mobile = __esm({
    "src/core/mobile.ts"() {
      init_fake_obsidian();
    }
  });

  // src/core/ui/icon.ts
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
    }
  });

  // src/core/ui/suggest.ts
  var init_suggest = __esm({
    "src/core/ui/suggest.ts"() {
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
      init_icon();
    }
  });

  // src/core/dom.ts
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

  // src/core/ui/resize.ts
  var init_resize = __esm({
    "src/core/ui/resize.ts"() {
      init_dom();
    }
  });

  // src/core/ui/splitter.ts
  var init_splitter = __esm({
    "src/core/ui/splitter.ts"() {
      init_dom();
    }
  });

  // src/core/ui/index.ts
  var init_ui = __esm({
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
        function createDate(y, m, d, h, M, s, ms) {
          var date;
          if (y < 100 && y >= 0) {
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
              date.setFullYear(y);
            }
          } else {
            date = new Date(y, m, d, h, M, s, ms);
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
  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
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
    return new Promise((resolve) => {
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
      const escHandle = escManager.register("q3-confirm", {
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
        escHandle.unregister();
        mask.remove();
        restoreFocus();
        resolve(v);
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

  // src/core/path-picker.ts
  var init_path_picker = __esm({
    "src/core/path-picker.ts"() {
      init_fake_obsidian();
      init_app();
      init_dom();
      init_esc_manager();
    }
  });

  // src/core/settings-schema.ts
  var init_settings_schema = __esm({
    "src/core/settings-schema.ts"() {
      init_fake_obsidian();
      init_settings_provider();
      init_path_picker();
      init_settings_modal();
      init_ui();
    }
  });

  // src/core/settings-modal.ts
  var init_settings_modal = __esm({
    "src/core/settings-modal.ts"() {
      init_fake_obsidian();
      init_dom();
      init_esc_manager();
      init_mobile();
      init_settings_schema();
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
  var CORRUPT_BACKUP_DIR;
  var init_storage = __esm({
    "src/core/storage.ts"() {
      init_app();
      init_settings_provider();
      init_notice();
      CORRUPT_BACKUP_DIR = "CONFIG/.CORRUPT";
    }
  });

  // src/secondbrain/config.ts
  function buildConfig() {
    const s = tryGetSettings();
    return {
      OLLAMA_URL: s.secondBrainOllamaUrl || "http://localhost:11434",
      EMBEDDING_MODEL: s.secondBrainEmbeddingModel || "bge-m3",
      STORE_PATH: storageFile("secondbrain.json"),
      VEC_PATH: storageFile("secondbrain.vec"),
      TOP_K: Number(s.secondBrainTopK) || 20,
      CHAT_TOP_K: Number(s.secondBrainChatTopK) || 20,
      CHUNK_MIN_LENGTH: Number(s.secondBrainChunkMinLength) || 50,
      ALLOW_PATHS: s.secondBrainAllowPaths ? String(s.secondBrainAllowPaths).split(",").map((p) => p.trim()).filter(Boolean) : [],
      // ticket 116：空 = 什么也不录（不索引任何目录），不再是缺省目录清单
      CONTEXT_LIMIT: Number(s.secondBrainContextLimit) || 600,
      DEBOUNCE_DELAY: Number(s.secondBrainDebounceDelay) || 300,
      CURSOR_POLL_INTERVAL: Number(s.secondBrainCursorPollInterval) || 500,
      OLLAMA_CHAT_MODEL: s.secondBrainChatModel || "qwen2.5:14b-instruct",
      DEEPSEEK_MODEL: s.secondBrainDeepseekModel || "deepseek-v4-flash",
      DEFAULT_USE_DEEPSEEK: s.secondBrainDefaultUseDeepseek === "true",
      MAX_HISTORY: Number(s.secondBrainMaxHistory) || 10,
      // 空 = 未配置远程（enh-sweep-a：不再回落写死内网 IP；消费方均有 || OLLAMA_URL/真值判断兜底）
      OLLAMA_REMOTE_URL: s.secondBrainRemoteOllamaUrl || ""
    };
  }
  var _a, _b, IS_MOBILE;
  var init_config = __esm({
    "src/secondbrain/config.ts"() {
      init_settings_provider();
      init_storage();
      IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "") || ((_b = (_a = globalThis.obsidian) == null ? void 0 : _a.Platform) == null ? void 0 : _b.isMobile) === true;
    }
  });

  // src/secondbrain/whitelist.ts
  var init_whitelist = __esm({
    "src/secondbrain/whitelist.ts"() {
    }
  });

  // src/secondbrain/local-ip.ts
  var init_local_ip = __esm({
    "src/secondbrain/local-ip.ts"() {
    }
  });

  // src/secondbrain/store-file.ts
  function storeDir() {
    return storageDir();
  }
  function getSecondBrainStorePath() {
    return storageFile("secondbrain.json");
  }
  function getSecondBrainVecPath() {
    return storageFile("secondbrain.vec");
  }
  function emptyStore() {
    return { version: STORE_VERSION, meta: null, panel: null, link: { queue: [], state: {} }, chatHistory: [] };
  }
  function normalizeChatHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const valid = raw.filter(
      (e) => !!e && typeof e === "object" && (e.role === "user" || e.role === "assistant") && typeof e.content === "string"
    );
    return valid.slice(-CHAT_HISTORY_LIMIT);
  }
  function normalizeStore(raw) {
    const d = raw && typeof raw === "object" ? raw : {};
    const linkRaw = d.link && typeof d.link === "object" ? d.link : {};
    const panel2 = d.panel && typeof d.panel === "object" ? d.panel : null;
    return {
      version: d.version === STORE_VERSION ? STORE_VERSION : void 0,
      meta: d.meta && typeof d.meta === "object" ? d.meta : {},
      panel: panel2,
      link: {
        queue: Array.isArray(linkRaw.queue) ? linkRaw.queue : [],
        state: linkRaw.state && typeof linkRaw.state === "object" && !Array.isArray(linkRaw.state) ? linkRaw.state : {}
      },
      chatHistory: normalizeChatHistory(d.chatHistory)
    };
  }
  function hasFn(adapter, name) {
    return typeof (adapter == null ? void 0 : adapter[name]) === "function";
  }
  async function readJsonIfExists(app, path) {
    const adapter = app.vault.adapter;
    try {
      if (hasFn(adapter, "exists") && !await adapter.exists(path)) return null;
      if (!hasFn(adapter, "read")) return null;
      const text = await adapter.read(path);
      if (typeof text !== "string") return null;
      try {
        return JSON.parse(text);
      } catch (e) {
        return null;
      }
    } catch (e) {
      return null;
    }
  }
  async function migrateLegacy(app) {
    const adapter = app.vault.adapter;
    const storePath = getSecondBrainStorePath();
    try {
      if (hasFn(adapter, "exists") && await adapter.exists(storePath)) return false;
    } catch (e) {
      return false;
    }
    let anyLegacy = false;
    const store2 = emptyStore();
    for (const name of LEGACY_FILES) {
      const legacyPath = storeDir() + "/" + name;
      const raw = await readJsonIfExists(app, legacyPath).catch(() => null);
      if (raw === null) continue;
      anyLegacy = true;
      if (name === "secondbrain_meta.json" && raw && typeof raw === "object") store2.meta = raw;
      else if (name === "secondbrain_panel.json" && raw && typeof raw === "object") store2.panel = raw;
      else if (name === "secondbrain_link_queue.json") {
        if (Array.isArray(raw)) store2.link.queue = raw;
      } else if (name === "secondbrain_link_state.json") {
        if (raw && typeof raw === "object" && !Array.isArray(raw)) store2.link.state = raw;
      }
    }
    if (!anyLegacy) return false;
    await adapter.write(storePath, JSON.stringify(store2));
    for (const name of LEGACY_FILES) {
      const legacyPath = storeDir() + "/" + name;
      try {
        if (hasFn(adapter, "remove")) await adapter.remove(legacyPath);
      } catch (e) {
      }
    }
    const legacyVec = storeDir() + "/" + LEGACY_VEC;
    try {
      const vecExists = hasFn(adapter, "exists") ? await adapter.exists(legacyVec) : false;
      if (vecExists) {
        const newVec = getSecondBrainVecPath();
        let renamed = false;
        try {
          if (hasFn(adapter, "rename")) {
            await adapter.rename(legacyVec, newVec);
            renamed = true;
          }
        } catch (e) {
          renamed = false;
        }
        if (!renamed && hasFn(adapter, "readBinary") && hasFn(adapter, "writeBinary")) {
          const buf = await adapter.readBinary(legacyVec);
          await adapter.writeBinary(newVec, buf);
          try {
            if (hasFn(adapter, "remove")) await adapter.remove(legacyVec);
          } catch (e) {
          }
        }
      }
    } catch (e) {
    }
    return true;
  }
  function enqueue(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => void 0,
      () => void 0
    );
    return run;
  }
  function resolveApp(app) {
    return app != null ? app : getApp();
  }
  function isConflictJsonName(name) {
    return /^secondbrain\.sync-conflict-.*\.json$/.test(name);
  }
  function isConflictVecName(name) {
    return /^secondbrain\.sync-conflict-.*\.vec$/.test(name);
  }
  function mergeStoreWithConflict(primary, conflict) {
    var _a2, _b2, _c;
    const priMeta = primary.meta && typeof primary.meta === "object" ? primary.meta : {};
    const confMeta = conflict.meta && typeof conflict.meta === "object" ? conflict.meta : {};
    const notes = { ...priMeta.notes || {} };
    for (const [path, confNote] of Object.entries(confMeta.notes || {})) {
      const priNote = (_a2 = priMeta.notes) == null ? void 0 : _a2[path];
      if (!priNote || ((_b2 = confNote.mtime) != null ? _b2 : 0) > ((_c = priNote.mtime) != null ? _c : 0)) {
        notes[path] = confNote;
      }
    }
    const meta = { ...priMeta, notes };
    let panel2 = primary.panel;
    if (conflict.panel && (!panel2 || conflict.panel.generatedAt > panel2.generatedAt)) panel2 = conflict.panel;
    const queue = [...primary.link.queue];
    const seen = new Set(queue.map((q) => q.path));
    for (const q of conflict.link.queue) {
      if (!seen.has(q.path)) {
        seen.add(q.path);
        queue.push(q);
      }
    }
    const state = { ...primary.link.state };
    for (const [path, s] of Object.entries(conflict.link.state)) {
      const cur = state[path];
      if (!cur || s.linkedAt && (!cur.linkedAt || s.linkedAt > cur.linkedAt)) state[path] = s;
    }
    const histSeen = new Set(primary.chatHistory.map((e) => e.role + "\0" + e.content));
    const chatHistory = [...primary.chatHistory];
    for (const e of conflict.chatHistory) {
      const key = e.role + "\0" + e.content;
      if (!histSeen.has(key)) {
        histSeen.add(key);
        chatHistory.push(e);
      }
    }
    const chatTrimmed = chatHistory.slice(-CHAT_HISTORY_LIMIT);
    return { version: primary.version, meta, panel: panel2, link: { queue, state }, chatHistory: chatTrimmed };
  }
  function buildRowOffsets(meta) {
    const map = /* @__PURE__ */ new Map();
    const notes = (meta == null ? void 0 : meta.notes) || {};
    let offset = 0;
    for (const [path, entry] of Object.entries(notes)) {
      const count = Array.isArray(entry == null ? void 0 : entry.chunks) ? entry.chunks.length : 0;
      map.set(path, { offset, count });
      offset += count;
    }
    return map;
  }
  function requiredRows(meta) {
    const notes = (meta == null ? void 0 : meta.notes) || {};
    let n = 0;
    for (const entry of Object.values(notes)) n += Array.isArray(entry == null ? void 0 : entry.chunks) ? entry.chunks.length : 0;
    return n;
  }
  async function readVecBytes(adapter, path) {
    try {
      if (typeof (adapter == null ? void 0 : adapter.readBinary) !== "function") return null;
      const buf = await adapter.readBinary(path);
      return new Uint8Array(buf);
    } catch (e) {
      return null;
    }
  }
  function mergeVecByMeta(primaryMeta, primaryVec, conflictMeta, conflictVec, mergedMeta) {
    var _a2, _b2, _c, _d;
    const parseVec = (v) => {
      if (!v || v.length < 4) return null;
      const dim2 = new DataView(v.buffer, v.byteOffset, 4).getUint32(0, true);
      if (!dim2 || dim2 > 1e5) return null;
      return { dim: dim2, payload: v.slice(4) };
    };
    const pv = parseVec(primaryVec);
    const cv = parseVec(conflictVec);
    const dim = (pv == null ? void 0 : pv.dim) || (cv == null ? void 0 : cv.dim);
    if (!dim) return null;
    if (pv && cv && pv.dim !== cv.dim) return null;
    const priOff = buildRowOffsets(primaryMeta);
    const confOff = buildRowOffsets(conflictMeta);
    const need = requiredRows(mergedMeta);
    const out = new Float32Array(need * dim);
    let outIdx = 0;
    let complete = true;
    const copyFrom = (src, offset, count, outIdx2) => {
      if (!src || offset === void 0) return false;
      const srcStart = offset * dim * 4;
      const srcLen = count * dim * 4;
      if (srcStart + srcLen > src.length) return false;
      const row = new Float32Array(src.buffer, src.byteOffset + srcStart, count * dim);
      out.set(row, outIdx2);
      return true;
    };
    for (const [path, entry] of Object.entries((mergedMeta == null ? void 0 : mergedMeta.notes) || {})) {
      const count = Array.isArray(entry == null ? void 0 : entry.chunks) ? entry.chunks.length : 0;
      const outStart = outIdx;
      if (count > 0) {
        const priEntry = ((primaryMeta == null ? void 0 : primaryMeta.notes) || {})[path];
        const confEntry = ((conflictMeta == null ? void 0 : conflictMeta.notes) || {})[path];
        if (!confEntry || priEntry && ((_a2 = priEntry.mtime) != null ? _a2 : 0) >= ((_b2 = confEntry.mtime) != null ? _b2 : 0)) {
          if (!copyFrom(pv == null ? void 0 : pv.payload, (_c = priOff.get(path)) == null ? void 0 : _c.offset, count, outStart)) complete = false;
        } else {
          if (!copyFrom(cv == null ? void 0 : cv.payload, (_d = confOff.get(path)) == null ? void 0 : _d.offset, count, outStart)) complete = false;
        }
      }
      outIdx += count * dim;
    }
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, dim, true);
    const payload = new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
    const data = new Uint8Array(4 + payload.byteLength);
    data.set(header, 0);
    data.set(payload, 4);
    return { data, complete };
  }
  async function nukeVectorsForRebuild(a, conflictVecNames) {
    var _a2;
    const adapter = (_a2 = a == null ? void 0 : a.vault) == null ? void 0 : _a2.adapter;
    if (!adapter) return;
    const vecPath = getSecondBrainVecPath();
    try {
      await adapter.remove(vecPath);
    } catch (e) {
    }
    for (const n of conflictVecNames) {
      try {
        await adapter.remove(n);
      } catch (e) {
      }
    }
  }
  async function reconcileVecConflicts(a, primaryMeta, merged, conflictVecNames, conflictMetas) {
    var _a2, _b2, _c, _d, _e;
    const adapter = (_a2 = a == null ? void 0 : a.vault) == null ? void 0 : _a2.adapter;
    if (!adapter || !conflictVecNames.length) return;
    const vecPath = getSecondBrainVecPath();
    const notesUnchanged = JSON.stringify((_b2 = primaryMeta == null ? void 0 : primaryMeta.notes) != null ? _b2 : null) === JSON.stringify((_d = (_c = merged.meta) == null ? void 0 : _c.notes) != null ? _d : null);
    if (notesUnchanged) {
      for (const name of conflictVecNames) {
        try {
          await adapter.remove(name);
        } catch (e) {
        }
      }
      return;
    }
    const primaryVec = await readVecBytes(adapter, vecPath);
    let curVec = primaryVec;
    for (let i = 0; i < conflictVecNames.length; i++) {
      const name = conflictVecNames[i];
      const conflictVec = await readVecBytes(adapter, name);
      if (!conflictVec) continue;
      const confMeta = (_e = conflictMetas[i]) != null ? _e : null;
      const result = mergeVecByMeta(primaryMeta, curVec, confMeta, conflictVec, merged.meta);
      if (!result || !result.complete) {
        await nukeVectorsForRebuild(a, conflictVecNames);
        console.warn("[secondbrain] 冲突 .vec 无法安全合并，已清空向量文件——下次 refresh 全量重建（ticket 107 自愈）");
        return;
      }
      curVec = result.data;
    }
    const pri = await readVecBytes(adapter, vecPath);
    if (!bytesEqual(pri != null ? pri : new Uint8Array(0), curVec)) {
      try {
        await adapter.writeBinary(vecPath, curVec.buffer);
      } catch (e) {
      }
    }
    for (const name of conflictVecNames) {
      try {
        await adapter.remove(name);
      } catch (e) {
      }
    }
  }
  async function reconcileConflicts(a, store2) {
    var _a2;
    const adapter = (_a2 = a == null ? void 0 : a.vault) == null ? void 0 : _a2.adapter;
    if (!adapter || typeof adapter.list !== "function") return store2;
    let listed = [];
    try {
      const r = await adapter.list(storeDir());
      listed = Array.isArray(r == null ? void 0 : r.files) ? r.files : [];
    } catch (e) {
      return store2;
    }
    const conflictJson = listed.filter((f) => isConflictJsonName(f.split("/").pop() || f));
    const conflictVec = listed.filter((f) => isConflictVecName(f.split("/").pop() || f));
    if (!conflictJson.length && !conflictVec.length) return store2;
    const primaryMeta = store2.meta;
    const conflictMetas = [];
    let merged = store2;
    let jsonMerged = false;
    for (const name of conflictJson) {
      try {
        const text = await adapter.read(name);
        const conflict = normalizeStore(JSON.parse(text));
        conflictMetas.push(conflict.meta || null);
        merged = mergeStoreWithConflict(merged, conflict);
        jsonMerged = true;
      } catch (e) {
        console.warn("[secondbrain] 冲突 JSON 解析失败，保留待人工处理: " + name);
        conflictMetas.push(null);
      }
    }
    if (jsonMerged) {
      await saveStoreRaw(merged, a);
      for (const name of conflictJson) {
        try {
          await adapter.remove(name);
        } catch (e) {
        }
      }
    }
    if (conflictVec.length) await reconcileVecConflicts(a, primaryMeta, merged, conflictVec, conflictMetas);
    return merged;
  }
  async function readStoreRawInner(app) {
    var _a2;
    const a = resolveApp(app);
    const adapter = (_a2 = a == null ? void 0 : a.vault) == null ? void 0 : _a2.adapter;
    if (!adapter) return emptyStore();
    const storePath = getSecondBrainStorePath();
    let text = null;
    let exists = false;
    try {
      if (hasFn(adapter, "exists")) exists = await adapter.exists(storePath);
      else exists = true;
    } catch (e) {
      exists = false;
    }
    if (!exists) {
      const migrated = await migrateLegacy(a);
      if (migrated) {
        try {
          text = await adapter.read(storePath);
        } catch (e) {
          text = null;
        }
      }
      if (typeof text !== "string") return emptyStore();
      try {
        return normalizeStore(JSON.parse(text));
      } catch (e) {
        return emptyStore();
      }
    }
    try {
      text = await adapter.read(storePath);
    } catch (e) {
      return emptyStore();
    }
    if (typeof text !== "string") return emptyStore();
    try {
      return normalizeStore(JSON.parse(text));
    } catch (e) {
      const backupPath = await backupOriginal(a, storePath, text);
      if (backupPath) {
        try {
          if (hasFn(adapter, "remove")) await adapter.remove(storePath);
        } catch (e2) {
        }
        return emptyStore();
      }
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      try {
        if (hasFn(adapter, "rename")) await adapter.rename(storePath, storePath + ".corrupt-" + stamp);
      } catch (e2) {
      }
      return emptyStore();
    }
  }
  async function readStoreRaw(app) {
    const a = resolveApp(app);
    const store2 = await readStoreRawInner(a);
    return reconcileConflicts(a, store2);
  }
  async function saveStoreRaw(data, app) {
    var _a2;
    const a = resolveApp(app);
    const adapter = (_a2 = a == null ? void 0 : a.vault) == null ? void 0 : _a2.adapter;
    if (!adapter) return;
    const next = JSON.stringify(data);
    try {
      if (typeof adapter.read === "function" && await adapter.read(getSecondBrainStorePath()) === next) return;
    } catch (e) {
    }
    await adapter.write(getSecondBrainStorePath(), next);
  }
  async function loadStore(app) {
    return enqueue(() => readStoreRaw(app));
  }
  async function mutateStore(fn, app) {
    await enqueue(async () => {
      const store2 = await readStoreRaw(app);
      fn(store2);
      await saveStoreRaw(store2, app);
    });
  }
  async function loadChatHistory(app) {
    return (await loadStore(app)).chatHistory;
  }
  async function appendChatHistory(entries, app) {
    const list = Array.isArray(entries) ? entries : [entries];
    let result = [];
    await mutateStore((s) => {
      s.chatHistory = [...s.chatHistory, ...list].slice(-CHAT_HISTORY_LIMIT);
      result = s.chatHistory;
    }, app);
    return result;
  }
  async function clearChatHistory(app) {
    await mutateStore((s) => {
      s.chatHistory = [];
    }, app);
  }
  var STORE_VERSION, CHAT_HISTORY_LIMIT, LEGACY_FILES, LEGACY_VEC, chain;
  var init_store_file = __esm({
    "src/secondbrain/store-file.ts"() {
      init_app();
      init_storage();
      init_utils();
      STORE_VERSION = 1;
      CHAT_HISTORY_LIMIT = 100;
      LEGACY_FILES = [
        "secondbrain_meta.json",
        "secondbrain_panel.json",
        "secondbrain_link_queue.json",
        "secondbrain_link_state.json"
      ];
      LEGACY_VEC = "secondbrain_vectors.vec";
      chain = Promise.resolve();
    }
  });

  // src/secondbrain/render.ts
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
    var _a2, _b2;
    const bySource = /* @__PURE__ */ new Map();
    let chunkCount = 0;
    let totalChars = 0;
    const recent2 = [];
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
      recent2.push({ path, mtime: entry.mtime, chunks });
      const bucket = 11 - Math.floor((thisWeekStart - entry.mtime) / weekMs);
      if (bucket >= 0 && bucket <= 11) trend12w[bucket]++;
    }
    recent2.sort((a, b) => b.mtime - a.mtime);
    const bySourceArr = [...bySource.values()].sort((a, b) => b.chunks - a.chunks);
    const noteCount = Object.keys(meta.notes).length;
    return {
      chunkCount,
      noteCount,
      dim: meta._dim || 0,
      lastIndexedAt: (_b2 = (_a2 = recent2[0]) == null ? void 0 : _a2.mtime) != null ? _b2 : null,
      bySource: bySourceArr,
      recent: recent2.slice(0, 10),
      trend12w,
      totalChars,
      avgChunkLen: chunkCount ? Math.round(totalChars / chunkCount) : 0,
      avgChunksPerNote: noteCount ? Math.round(chunkCount / noteCount * 10) / 10 : 0
    };
  }
  function buildSourceTree(meta) {
    var _a2;
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
        cursor = (_a2 = nodeOf.get(segs.slice(0, -1).join("/"))) != null ? _a2 : null;
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
  function sbSourceColor(name, order) {
    const i = order.get(name);
    if (i === void 0) return SB_FALLBACK;
    return SB_PALETTE[i % SB_PALETTE.length];
  }
  function escapeHtml2(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
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
      (it) => `<div class="bz-sb-card${it.acc ? " bz-sb-card--acc" : ""}"${it.tip ? ` title="${escapeHtml2(it.tip)}"` : ""}><div class="bz-sb-card-value${it.warn ? " bz-sb-card-value--warn" : ""}">${it.v}</div><div class="bz-sb-card-label">${escapeHtml2(it.k)}</div></div>`
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
      const row = `<div class="bz-sb-dist-row${hasChildren ? " bz-sb-dist-row--dir" : ""}" data-path="${escapeHtml2(node.path)}" style="padding-left:${10 + depth * 16}px"><span class="bz-sb-dist-caret${hasChildren ? "" : " bz-sb-dist-caret--leaf"}">${hasChildren ? ic("chevron-right", 12) : ""}</span><span class="bz-sb-dist-name">${escapeHtml2(node.name)}</span><span class="bz-sb-dist-bar"><span class="bz-sb-dist-fill" style="width:${Math.round(node.chunks / maxChunks * 100)}%;background:${colorOf(node.name)}"></span></span><span class="bz-sb-dist-num">${node.notes} 篇 / ${node.chunks} 段</span></div>`;
      const kids = hasChildren && open ? panelDistHtml(node.children, expanded, colorOf, maxChunks, depth + 1) : "";
      return row + kids;
    }).join("");
  }
  function panelRecentHtml(rows) {
    if (!rows.length) return '<div class="bz-sb-empty">没有符合条件的文件</div>';
    return rows.map(
      (r) => `<div class="bz-sb-recent-row" data-path="${escapeHtml2(r.path)}"><span class="bz-sb-dot" style="background:${r.color}"></span><span class="bz-sb-recent-name">${escapeHtml2(r.name)}</span><span class="bz-sb-recent-time">${r.chunks} 段 · ${escapeHtml2(r.when)}</span></div>`
    ).join("");
  }
  function panelSummaryHtml(text, when) {
    if (!text) return "";
    return `<div class="bz-sb-ai-txt">${escapeHtml2(text)}</div>` + (when ? `<div class="bz-sb-ai-when">${escapeHtml2(when)}</div>` : "");
  }
  function panelLogHtml(parts) {
    return parts.map((p) => `<span class="bz-sb-log-item${p.warn ? " bz-sb-log-item--warn" : ""}">${escapeHtml2(p.text)}</span>`).join('<span class="bz-sb-log-sep">·</span>');
  }
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
      ${CHAT_CHIPS.map((c) => `<button class="bz-sb-chat-chip" data-q="${escapeHtml2(c)}">${escapeHtml2(c)}</button>`).join("")}
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
      (h) => `<button class="bz-sb-chat-cite" data-path="${escapeHtml2(h.path)}"><span class="bz-sb-chat-cite-score">${h.pct}%</span><span class="bz-sb-dot" style="background:${h.color}"></span><span class="bz-sb-chat-cite-name">${escapeHtml2(h.path.replace(/^.*[\\/]/, "").replace(/\.md$/i, ""))}</span></button>`
    ).join("") + `</div>`;
  }
  function refCardHtml(name, pct, color) {
    return `<div class="bz-sb-ref-card-top"><div class="bz-sb-ref-card-path">${escapeHtml2(name)}</div><span class="bz-sb-ref-card-score">${pct}%</span></div><div class="bz-sb-ref-card-bar"><span class="bz-sb-ref-card-bar-fill" style="width:${pct}%;background:${color}"></span></div><div class="bz-sb-ref-card-body"></div>`;
  }
  function refStateHtml(text) {
    return `<div class="bz-sb-ref-empty">${escapeHtml2(text)}</div>`;
  }
  var SB_PALETTE, SB_FALLBACK, ic, CHAT_CHIPS;
  var init_render = __esm({
    "src/secondbrain/render.ts"() {
      SB_PALETTE = ["#0f766e", "#6366f1", "#d97706", "#db2777", "#0e7490", "#7c3aed", "#b45309", "#be185d"];
      SB_FALLBACK = "#a39b8c";
      ic = (name, size = 15) => `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
      CHAT_CHIPS = ["为什么会遗忘", "享乐适应", "怎么高效记笔记", "睡不好怎么补救", "闪电", "王阳明"];
    }
  });

  // src/secondbrain/panel.ts
  function topLevelName(path) {
    const i = path.indexOf("/");
    return i === -1 ? "（根目录）" : path.slice(0, i);
  }
  var SecondBrainPanel;
  var init_panel = __esm({
    "src/secondbrain/panel.ts"() {
      init_notice();
      init_z_order();
      init_mobile();
      init_ui();
      init_flow_dialog();
      init_esc_manager();
      init_app();
      init_utils();
      init_settings_provider();
      init_settings_modal();
      init_config();
      init_whitelist();
      init_local_ip();
      init_store_file();
      init_render();
      init_render();
      SecondBrainPanel = class {
        constructor(app, store2, opts) {
          this.mask = null;
          this.popup = null;
          /** ESC 层级句柄（ticket 141 迁移：原私挂 document keydown 废弃） */
          this.escHandle = null;
          this.refreshing = false;
          /** 初始向量化视图进行中标记（ticket 114：runInitialIndexView 持有；进行中重复点击接回进度视图而非静默失效） */
          this.initializing = false;
          /** 来源分布树已展开的目录（ticket 108，会话内记忆） */
          this.expandedDirs = /* @__PURE__ */ new Set();
          /** 设置页「重新索引」意图标记（ticket 108：确认后打开面板即自动全量重建） */
          this.rebuildRequested = false;
          this.app = app;
          this.store = store2;
          this.opts = opts;
        }
        /** 设置页「重新索引」调用（index.ts 入口转发）：标记意图后打开面板自动跑 */
        requestRebuild() {
          this.rebuildRequested = true;
        }
        async open() {
          this.createUI();
          this.attachEscapeListener();
          topifyZ(this.mask, this.popup);
          this.mask.style.display = "block";
          this.popup.style.display = "flex";
          await this.render();
        }
        close() {
          this.removeEscapeListener();
          if (this.mask) this.mask.style.display = "none";
          if (this.popup) this.popup.style.display = "none";
        }
        /** [l2-sb] ESC 关闭走 escManager 层级（ticket 141 迁移）：open 注册、close 注销成对（幂等）——
         *  ⚙️ 设置弹窗叠开时其 'bz-settings-modal' 层后注册在上，ESC 先关设置、再 ESC 才关面板 */
        attachEscapeListener() {
          if (this.escHandle) return;
          this.escHandle = escManager.register("bz-sb-panel", {
            isVisible: () => !!this.popup && this.popup.isConnected && this.popup.style.display === "flex",
            close: () => this.close()
          });
        }
        removeEscapeListener() {
          var _a2;
          (_a2 = this.escHandle) == null ? void 0 : _a2.unregister();
          this.escHandle = null;
        }
        destroy() {
          var _a2, _b2;
          this.removeEscapeListener();
          (_a2 = this.mask) == null ? void 0 : _a2.remove();
          (_b2 = this.popup) == null ? void 0 : _b2.remove();
          this.mask = null;
          this.popup = null;
        }
        /** 打开形态分派：重建意图 → 全量重建进度；空库+初始索引进行中 → 恢复进度（fire-and-forget，不阻塞 panel.open）；空库 → 引导态；
         *  就绪 + 待处理 → 增量进度；就绪无变更 → 统计（ticket 114 补「空库但 refresh 在途」分支） */
        async render() {
          if (this.store.initialLoad) {
            try {
              await this.store.initialLoad;
            } catch (e) {
            }
          }
          const rebuild = this.rebuildRequested;
          this.rebuildRequested = false;
          if (rebuild && this.store.isIndexReady()) {
            await this.runRebuild();
            return;
          }
          if (!this.store.isIndexReady()) {
            if (this.store.isRefreshing()) {
              this.enterProgressView("正在初始化向量数据库");
              void this.runInitialIndexView();
              return;
            }
            this.showInitGuidance();
            return;
          }
          if (this.store.hasPendingChanges()) {
            await this.runIncremental();
            return;
          }
          this.showContent();
        }
        showContent(skipRefresh = false) {
          var _a2, _b2;
          const onboard = document.getElementById("bz-sb-onboard");
          const content = document.getElementById("bz-sb-content");
          if (onboard) onboard.style.display = "none";
          if (content) content.style.display = "flex";
          for (const b of (_b2 = (_a2 = this.popup) == null ? void 0 : _a2.querySelectorAll(".bz-sb-panel-func")) != null ? _b2 : []) b.classList.remove("bz-sb-btn-hidden");
          if (!skipRefresh && !this.refreshing) void this.autoRefreshThenRender();
        }
        /** 空库首次引导：说明 + 开始按钮（进度视图的 init 形态） */
        showInitGuidance() {
          var _a2, _b2;
          const onboard = document.getElementById("bz-sb-onboard");
          const content = document.getElementById("bz-sb-content");
          const title = document.getElementById("bz-sb-progress-title");
          const desc = document.getElementById("bz-sb-onboard-desc");
          const btn = document.getElementById("bz-sb-init-btn");
          const box = document.getElementById("bz-sb-init-progress");
          if (title) title.textContent = "初始化向量数据库";
          if (desc) desc.style.display = "block";
          if (btn) {
            btn.style.display = "block";
            btn.disabled = false;
            btn.textContent = "开始向量化";
          }
          if (box) box.style.display = "none";
          if (onboard) onboard.style.display = "flex";
          if (content) content.style.display = "none";
          for (const b of (_b2 = (_a2 = this.popup) == null ? void 0 : _a2.querySelectorAll(".bz-sb-panel-func")) != null ? _b2 : []) b.classList.add("bz-sb-btn-hidden");
        }
        /** 进入纯进度形态（自动运行，无按钮；title 由调用方给定） */
        enterProgressView(titleText, resetStatus = true) {
          var _a2, _b2;
          const onboard = document.getElementById("bz-sb-onboard");
          const content = document.getElementById("bz-sb-content");
          const title = document.getElementById("bz-sb-progress-title");
          const desc = document.getElementById("bz-sb-onboard-desc");
          const btn = document.getElementById("bz-sb-init-btn");
          const box = document.getElementById("bz-sb-init-progress");
          const fill = document.getElementById("bz-sb-init-fill");
          const status = document.getElementById("bz-sb-init-status");
          if (title) title.textContent = titleText;
          if (desc) desc.style.display = "none";
          if (btn) btn.style.display = "none";
          if (box) box.style.display = "flex";
          if (fill) fill.style.width = "0%";
          if (resetStatus && status) status.textContent = "准备中…";
          if (onboard) onboard.style.display = "flex";
          if (content) content.style.display = "none";
          for (const b of (_b2 = (_a2 = this.popup) == null ? void 0 : _a2.querySelectorAll(".bz-sb-panel-func")) != null ? _b2 : []) b.classList.add("bz-sb-btn-hidden");
        }
        /** 进度回调解析：把 store.updateProgress 文案换算成进度条（面板销毁后不再写 DOM） */
        progressObserver() {
          const status = document.getElementById("bz-sb-init-status");
          const fill = document.getElementById("bz-sb-init-fill");
          return (msg) => {
            if (!(status == null ? void 0 : status.isConnected)) return;
            const m = msg.match(/向量化:\s*(\d+)\/(\d+)/);
            if (m && Number(m[2]) > 0) {
              fill.style.width = Math.min(100, Math.round(Number(m[1]) / Number(m[2]) * 100)) + "%";
            }
            status.textContent = msg;
          };
        }
        /** 自动增量索引（ticket 108）：有待处理块 → 进度视图 → 完成后统计；
         *  ticket 3 假成功修复：有失败段 → toast 明示失败数（进度视图随即被内容态替代，仅靠状态行不可见） */
        async runIncremental() {
          this.enterProgressView("正在同步索引");
          let lastMsg = "";
          try {
            await this.store.refresh((msg) => {
              lastMsg = msg;
              this.progressObserver()(msg);
            });
          } catch (e) {
            console.warn("[secondbrain] 面板增量索引失败", e);
          }
          if (!this.store.isIndexReady()) {
            this.showInitGuidance();
            return;
          }
          this.showContent(true);
          await this.renderStats();
          const fail = lastMsg.match(/^⚠️\s*(\d+)\s*段向量化失败/);
          if (fail) {
            notice(`第二大脑：${fail[1]} 段向量化失败，请检查 Ollama 服务`, "warning");
          }
        }
        /** 全量重建（ticket 108「重新索引」）：清空 → 整库重嵌 → 统计；失败给原因可重试 */
        async runRebuild() {
          this.enterProgressView("正在重建向量数据库");
          const status = document.getElementById("bz-sb-init-status");
          this.initializing = true;
          try {
            await this.store.rebuildAll(this.progressObserver());
            if (this.store.isIndexReady()) {
              this.showContent(true);
              await this.renderStats();
            } else {
              const box = document.getElementById("bz-sb-init-progress");
              if (box) box.style.display = "flex";
              if (status) status.textContent = "重建未完成：请确认 Ollama 服务与 Embedding 模型可用后重试";
              this.revealInitBtn("重试重建");
            }
          } catch (e) {
            console.warn("[secondbrain] 全量重建失败", e);
            if (status == null ? void 0 : status.isConnected) {
              status.textContent = "重建失败：" + ((e == null ? void 0 : e.message) || e);
              this.revealInitBtn("重试重建");
            }
          } finally {
            this.initializing = false;
          }
        }
        /** 组装弹窗 DOM（markup 全部出自 render.ts；本方法只绑定事件） */
        createUI() {
          var _a2, _b2, _c, _d, _e;
          if (this.mask && document.body.contains(this.mask)) return;
          const mask = document.createElement("div");
          mask.className = "bz-sb-panel-mask";
          mask.onclick = () => this.close();
          const popup = document.createElement("div");
          popup.className = "bz-sb-panel";
          popup.innerHTML = panelShellHtml();
          (_a2 = popup.querySelector("#bz-sb-open-chat")) == null ? void 0 : _a2.addEventListener("click", () => {
            this.close();
            this.opts.onOpenChat();
          });
          (_b2 = popup.querySelector("#bz-sb-open-ref")) == null ? void 0 : _b2.addEventListener("click", () => {
            this.close();
            this.opts.onOpenReference();
          });
          (_c = popup.querySelector("#bz-sb-incr")) == null ? void 0 : _c.addEventListener("click", () => {
            if (this.refreshing || this.initializing) return;
            void this.runIncremental();
          });
          (_d = popup.querySelector("#bz-sb-rebuild")) == null ? void 0 : _d.addEventListener("click", () => {
            void openFlowDialog({
              title: "重新索引",
              message: "将清空现有向量索引，按当前白名单全部重嵌入（约等于首次初始化全量跑一遍）。期间参考侧边栏与对话的向量检索会降级为文本匹配。确定继续吗？",
              actions: [
                { label: "取消", value: "cancel" },
                { label: "开始重建", value: "ok", cta: true }
              ]
            }).then((v) => {
              if (v === "ok") void this.runRebuild();
            });
          });
          const initBtn = popup.querySelector("#bz-sb-init-btn");
          if (initBtn) initBtn.onclick = () => void this.startInitialIndex();
          (_e = popup.querySelector("#bz-sb-dist")) == null ? void 0 : _e.addEventListener("click", (e) => {
            const row = e.target.closest(".bz-sb-dist-row--dir");
            if (!row) return;
            const path = row.dataset.path;
            if (!path) return;
            if (this.expandedDirs.has(path)) this.expandedDirs.delete(path);
            else this.expandedDirs.add(path);
            this.renderDist();
          });
          document.body.appendChild(mask);
          document.body.appendChild(popup);
          this.mask = mask;
          this.popup = popup;
        }
        /** 内容态打开时自动增量刷新，完成后重渲统计（修复：原先渲染不等 refresh，展示的总是上一轮旧数据） */
        async autoRefreshThenRender() {
          if (this.refreshing) return;
          this.refreshing = true;
          try {
            await this.store.refresh((msg) => {
              if (msg.startsWith("向量化:") || msg.startsWith("✅ 向量化完成")) console.log(`[secondbrain] ${msg}`);
            });
          } catch (e) {
            console.warn("[secondbrain] 面板自动刷新失败", e);
          } finally {
            this.refreshing = false;
          }
          await this.renderStats();
        }
        /**
         * 初始向量化运行器（ticket 114 自按钮处理器抽出共用）：进入进度视图并接住 refresh 实时进度，
         * 完成切内容态渲染统计；失败给出原因并可重试。
         * 按钮点击与「关页重开恢复」（render 分派）两条路都走这里——store.refresh 并发去重保证
         * 重复调用只是把进度回调重新接到同一个进行中的 promise 上，不会二次跑库。
         * 注意：refresh 全部嵌入失败时不抛错也不登记任何条目（QA 同语义），故以 isIndexReady 判定成败。
         */
        async runInitialIndexView() {
          const status = document.getElementById("bz-sb-init-status");
          if (!status || !status.isConnected) return;
          this.enterProgressView("正在初始化向量数据库");
          this.initializing = true;
          let sawCountedDone = false;
          let sawWarning = false;
          let sawFail = false;
          try {
            await this.store.refresh((msg) => {
              if (!status.isConnected) return;
              if (msg.startsWith("⚠️")) sawWarning = true;
              if (msg.includes("段向量化失败")) sawFail = true;
              if (msg.startsWith("✅ 向量化完成：")) sawCountedDone = true;
              this.progressObserver()(msg);
            });
            if (!status.isConnected) return;
            if (this.store.isIndexReady()) {
              this.showContent(true);
              await this.renderStats();
            } else if (sawFail || sawCountedDone) {
              status.textContent = "没有成功向量化任何内容：请确认 Ollama 服务与 Embedding 模型可用" + (IS_MOBILE ? "（移动端需配置「远程 Ollama URL」）" : "") + "后重试";
              this.revealInitBtn("重试初始化");
            } else if (sawWarning) {
              status.textContent = "白名单目录内没有可索引的 Markdown 笔记：请检查 ⚙️ 设置中的「白名单目录」";
              this.revealInitBtn("重试初始化");
            } else {
              status.textContent = "未发现可索引的笔记内容";
              this.revealInitBtn("重试初始化");
            }
          } catch (e) {
            console.warn("[secondbrain] 初始向量化失败", e);
            if (status.isConnected) {
              status.textContent = "初始化失败：" + ((e == null ? void 0 : e.message) || e);
              this.revealInitBtn("重试初始化");
            }
          } finally {
            this.initializing = false;
          }
        }
        /**
         * 引导按钮（ticket 107/108；ticket 114 修「点了没反应」）：首次全量向量化。
         * 已在进行中（关页重开后的引导态残留 / 双击）时不再静默吞掉——只要后台确有 refresh 在跑，
         * 就切回进度视图接回实时进度；否则维持原守卫语义不动。
         */
        startInitialIndex() {
          if (!document.getElementById("bz-sb-init-progress")) return;
          if (this.initializing || this.refreshing) {
            if (this.store.isRefreshing()) void this.runInitialIndexView();
            return;
          }
          void this.runInitialIndexView();
        }
        /** 失败路径恢复「开始按钮」可见并复位文案（进度形态时按钮被隐藏） */
        revealInitBtn(label) {
          const btn = document.getElementById("bz-sb-init-btn");
          if (!btn) return;
          btn.style.display = "block";
          btn.disabled = false;
          btn.textContent = label;
          btn.onclick = () => void this.startInitialIndex();
        }
        /** 内容态统计渲染：markup 出 render.ts，本方法只算数与注入 */
        async renderStats() {
          var _a2, _b2, _c, _d, _e;
          const popup = this.popup;
          if (!popup || !popup.isConnected) return;
          const CONFIG = buildConfig();
          let metaBytes = 0;
          let vecBytes = 0;
          try {
            metaBytes = (_b2 = (_a2 = await this.app.vault.adapter.stat(CONFIG.STORE_PATH)) == null ? void 0 : _a2.size) != null ? _b2 : 0;
          } catch (e) {
          }
          try {
            vecBytes = (_d = (_c = await this.app.vault.adapter.stat(CONFIG.VEC_PATH)) == null ? void 0 : _c.size) != null ? _d : 0;
          } catch (e) {
          }
          const stats = { ...computeStats(this.store.meta), metaBytes, vecBytes };
          const vecRows = stats.dim && vecBytes > 0 ? this.store.vectors.length / stats.dim : 0;
          const healthy = vecRows === 0 || vecRows === stats.chunkCount;
          const fmtBytes = (n) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
          const order = new Map(stats.bySource.map((s, i) => [s.name, i]));
          const colorOf = (name) => sbSourceColor(name, order);
          const cnt = popup.querySelector("#bz-sb-cnt");
          if (cnt) cnt.textContent = `${fmtCompact(stats.noteCount)} 篇 · ${fmtCompact(stats.chunkCount)} 段已入脑`;
          const pill = popup.querySelector("#bz-sb-pill-txt");
          if (pill) pill.textContent = healthy ? "索引健康" : `索引偏差 ${Math.abs(vecRows - stats.chunkCount)} 行`;
          (_e = popup.querySelector(".bz-sb-pill-dot")) == null ? void 0 : _e.classList.toggle("bz-sb-pill-dot--warn", !healthy);
          const cards = popup.querySelector("#bz-sb-cards");
          if (cards) {
            cards.innerHTML = panelCardsHtml([
              { v: fmtCompact(stats.noteCount), k: "笔记", tip: `共 ${stats.noteCount.toLocaleString()} 篇笔记`, acc: true },
              { v: fmtCompact(stats.chunkCount), k: "段落", tip: `共 ${stats.chunkCount.toLocaleString()} 个向量块`, acc: true },
              { v: fmtCompact(stats.totalChars), k: "字符", tip: `共 ${stats.totalChars.toLocaleString()} 字` },
              { v: stats.dim > 0 ? `${stats.dim} 维` : "—", k: "向量维度", tip: `嵌入模型 ${CONFIG.EMBEDDING_MODEL} · 维度变更需重建索引` },
              { v: `${stats.avgChunkLen} 字`, k: "平均段长", tip: `平均每篇 ${stats.avgChunksPerNote} 段` },
              { v: vecBytes ? fmtBytes(metaBytes + vecBytes) : "—", k: "存储占用", tip: `meta ${fmtBytes(metaBytes)} + 向量 ${fmtBytes(vecBytes)}` }
            ]);
          }
          const trend = popup.querySelector("#bz-sb-trend");
          if (trend) {
            trend.innerHTML = panelTrendHtml(stats.trend12w);
            const sum = popup.querySelector("#bz-sb-trend-sum");
            if (sum) sum.textContent = stats.trend12w.reduce((a, b) => a + b, 0) + " 篇";
          }
          this.renderDist();
          const recentEl = popup.querySelector("#bz-sb-recent");
          if (recentEl) {
            recentEl.innerHTML = panelRecentHtml(
              stats.recent.map((r) => ({
                path: r.path,
                name: r.path.split("/").pop() || r.path,
                chunks: r.chunks,
                when: formatRelativeTime(r.mtime),
                color: colorOf(topLevelName(r.path))
              }))
            );
            const recentN = popup.querySelector("#bz-sb-recent-n");
            if (recentN) recentN.textContent = `最新 ${stats.recent.length} 条`;
          }
          const log = popup.querySelector("#bz-sb-log");
          if (log) {
            log.innerHTML = panelLogHtml([
              { text: `上次索引 ${stats.lastIndexedAt ? formatRelativeTime(stats.lastIndexedAt) : "—"}` },
              { text: healthy ? "索引一致" : `向量 ${Math.round(vecRows)} 行 / 块 ${stats.chunkCount} 个`, warn: !healthy },
              { text: vecBytes ? `占用 ${fmtBytes(metaBytes + vecBytes)}` : "暂无向量文件" }
            ]);
          }
          mountIcons(popup);
          void this.loadSummaryAndLinks();
        }
        /** 来源树渲染（renderStats 与展开点击共用；展开集会话内记忆） */
        renderDist() {
          const popup = this.popup;
          const dist = popup == null ? void 0 : popup.querySelector("#bz-sb-dist");
          if (!popup || !dist) return;
          const tree = buildSourceTree(this.store.meta);
          const order = new Map(computeStats(this.store.meta).bySource.map((s, i) => [s.name, i]));
          const colorOf = (name) => sbSourceColor(name, order);
          const rootMax = Math.max(1, ...tree.map((n) => n.chunks));
          dist.innerHTML = panelDistHtml(tree, this.expandedDirs, colorOf, rootMax);
          const distN = popup.querySelector("#bz-sb-dist-n");
          if (distN) distN.textContent = `${tree.length} 个来源`;
          mountIcons(dist);
        }
        /** AI 库摘要 + 自动建链数（secondbrain.json panel/link 段，异步回填；生成入口已移除，旧值仍可展示） */
        async loadSummaryAndLinks() {
          var _a2, _b2, _c;
          try {
            const store2 = await loadStore(this.app);
            const popup = this.popup;
            if (!popup || !popup.isConnected) return;
            const summary = ((_a2 = store2.panel) == null ? void 0 : _a2.summary) || "";
            const aiCard = popup.querySelector("#bz-sb-ai-card");
            const aiTxt = popup.querySelector("#bz-sb-ai-txt");
            if (aiCard) aiCard.style.display = summary ? "" : "none";
            if (aiTxt && summary) {
              aiTxt.innerHTML = panelSummaryHtml(summary, ((_b2 = store2.panel) == null ? void 0 : _b2.generatedAt) ? formatRelativeTime(store2.panel.generatedAt) : "");
            }
            const linkedTotal = Object.keys(((_c = store2.link) == null ? void 0 : _c.state) || {}).length;
            const log = popup.querySelector("#bz-sb-log");
            if (log && linkedTotal) {
              log.insertAdjacentHTML(
                "beforeend",
                `<span class="bz-sb-log-sep">·</span>${panelLogHtml([{ text: `自动建链 ${linkedTotal} 条` }])}`
              );
            }
          } catch (e) {
          }
        }
      };
    }
  });

  // src/secondbrain/ui-tools.ts
  function jumpToChunk(file, chunkText, highlight = false) {
    try {
      const app = getApp();
      const f = app.vault.getAbstractFileByPath(file.path);
      if (!f) return;
      const leaf = app.workspace.getLeaf();
      leaf.openFile(f).then(() => {
        if (highlight) {
          const view = leaf.view;
          const ed = view == null ? void 0 : view.editor;
          if (ed) {
            const text = ed.getValue();
            const idx = text.indexOf(chunkText);
            if (idx !== -1) {
              const from = ed.offsetToPos(idx);
              const to = ed.offsetToPos(idx + chunkText.length);
              ed.setSelection(from, to);
            }
          }
        }
      }).catch(() => {
      });
    } catch (e) {
    }
  }
  function renderMarkdown(el, md, app) {
    try {
      const ctx = new Component();
      Promise.resolve(MarkdownRenderer.render(app, md, el, "", ctx)).catch(() => {
        el.textContent = md;
      });
    } catch (e) {
      el.textContent = md;
    }
  }
  function makeDraggable(el, handle, onMove) {
    let dragging = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;
    const onDown = (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    };
    const onMoveHandler = (e) => {
      if (!dragging) return;
      let x = origX + (e.clientX - startX);
      let y = origY + (e.clientY - startY);
      x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x));
      y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y));
      el.style.left = x + "px";
      el.style.top = y + "px";
      onMove == null ? void 0 : onMove(x, y);
    };
    const onUp = () => {
      dragging = false;
    };
    handle.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMoveHandler);
    document.addEventListener("mouseup", onUp);
    return () => {
      handle.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMoveHandler);
      document.removeEventListener("mouseup", onUp);
    };
  }
  function makeResizable(el, minW = 200, minH = 120) {
    const dirs = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    const handles = [];
    let dragging = null;
    let startX = 0, startY = 0, origW = 0, origH = 0, origLeft = 0, origTop = 0;
    const onResizeDown = (dir) => (e) => {
      dragging = dir;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origW = rect.width;
      origH = rect.height;
      origLeft = rect.left;
      origTop = rect.top;
      e.preventDefault();
    };
    const onResizeMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let { w, h, l, t } = { w: origW, h: origH, l: origLeft, t: origTop };
      if (dragging.includes("e")) w = Math.max(minW, origW + dx);
      if (dragging.includes("s")) h = Math.max(minH, origH + dy);
      if (dragging.includes("w")) {
        w = Math.max(minW, origW - dx);
        l = origLeft + (origW - w);
      }
      if (dragging.includes("n")) {
        h = Math.max(minH, origH - dy);
        t = origTop + (origH - h);
      }
      el.style.width = w + "px";
      el.style.height = h + "px";
      el.style.left = l + "px";
      el.style.top = t + "px";
    };
    const onResizeUp = () => {
      dragging = null;
    };
    for (const dir of dirs) {
      const h = document.createElement("div");
      h.style.cssText = `position:absolute;${dir.includes("n") ? "top:-3px;" : ""}${dir.includes("s") ? "bottom:-3px;" : ""}${dir.includes("w") ? "left:-3px;" : ""}${dir.includes("e") ? "right:-3px;" : ""}width:7px;height:7px;cursor:${dir}-resize;z-index:10;`;
      h.addEventListener("mousedown", onResizeDown(dir));
      el.appendChild(h);
      handles.push(h);
    }
    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeUp);
    return () => {
      handles.forEach((h) => h.remove());
      document.removeEventListener("mousemove", onResizeMove);
      document.removeEventListener("mouseup", onResizeUp);
    };
  }
  var init_ui_tools = __esm({
    "src/secondbrain/ui-tools.ts"() {
      init_fake_obsidian();
      init_app();
    }
  });

  // src/secondbrain/ai.ts
  function getDeepseekAI() {
    if (!deepseek) deepseek = createAI({}, "deepseek-v4-flash", {}, 16384);
    return deepseek;
  }
  var deepseek, AI;
  var init_ai2 = __esm({
    "src/secondbrain/ai.ts"() {
      init_ai();
      deepseek = null;
      AI = {
        /** 统一入口：失败直接抛出，由调用方 toast 报错（不静默回退 Ollama——ticket 108）；
         *  opts 可选（既有单参调用零兼容负担），透传取消/流式（ticket 141） */
        async ask(prompt, opts) {
          return getDeepseekAI().prompt(prompt, void 0, opts != null ? opts : {});
        }
      };
    }
  });

  // src/secondbrain/chat-panel.ts
  function welcomeText(topK) {
    return `你好！每次提问会独立检索 ${topK} 条笔记辅助回答。`;
  }
  var ChatPanel;
  var init_chat_panel = __esm({
    "src/secondbrain/chat-panel.ts"() {
      init_dom();
      init_esc_manager();
      init_flow_dialog();
      init_ui();
      init_config();
      init_ui_tools();
      init_ai2();
      init_store_file();
      init_render();
      ChatPanel = class {
        constructor(store2, app) {
          this.history = [];
          this.escHandle = null;
          /** 进行中的对话请求（ticket 141）：非空时发送钮呈「停止」态，点击中止 */
          this.inFlight = null;
          /** 轮次序号：清空对话 / 销毁后，旧轮的回调不再写 UI 与历史 */
          this.seq = 0;
          var _a2, _b2;
          this.app = app;
          this.store = store2;
          const CONFIG = buildConfig();
          const { mask, popup } = createOverlay({
            maskId: "bz-sb-chat-mask",
            popupId: "bz-sb-chat-panel",
            onMaskClick: () => this.close(),
            width: "760px",
            // createOverlay 以内联样式设宽（优先级高于类规则），必须在此定尺寸
            maxWidth: 760
          });
          this.mask = mask;
          this.popup = popup;
          this.popup.classList.add("bz-sb-chat-modal");
          this.popup.innerHTML = chatShellHtml(CONFIG.CHAT_TOP_K);
          mountIcons(this.popup);
          this.messagesDiv = this.popup.querySelector("#bz-sb-chat-messages");
          this.input = this.popup.querySelector("#bz-sb-chat-input");
          this.sendBtn = this.popup.querySelector("#bz-sb-chat-send");
          (_a2 = this.popup.querySelector("#bz-sb-chat-clear")) == null ? void 0 : _a2.addEventListener("click", () => void this.confirmClear());
          this.sendBtn.addEventListener("click", () => {
            if (this.inFlight) {
              this.inFlight.abort();
              return;
            }
            void this.sendChatMessage();
          });
          this.input.addEventListener("keydown", (e) => {
            if (e.isComposing || e.keyCode === 229) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void this.sendChatMessage();
            }
          });
          this.input.addEventListener("input", () => this.autoGrowInput());
          (_b2 = this.popup.querySelector("#bz-sb-chat-chips")) == null ? void 0 : _b2.addEventListener("click", (e) => {
            const chip = e.target.closest(".bz-sb-chat-chip");
            if (!chip || this.inFlight) return;
            this.input.value = chip.dataset.q || "";
            void this.sendChatMessage();
          });
          this.messagesDiv.addEventListener("click", (e) => {
            const cite = e.target.closest(".bz-sb-chat-cite");
            if (!cite) return;
            const path = cite.dataset.path;
            const f = path ? this.app.vault.getAbstractFileByPath(path) : null;
            if (f) void this.app.workspace.getLeaf(false).openFile(f);
            else if (path) this.appendAiNote("文件不存在或已被移动");
          });
          document.body.appendChild(mask);
          document.body.appendChild(popup);
          this.escHandle = escManager.register("bz-sb-chat-modal", {
            isVisible: () => this.popup.style.display === "flex" && !!this.popup.isConnected,
            close: () => this.close()
          });
          this.addChatMessage("assistant", welcomeText(CONFIG.CHAT_TOP_K));
          this.restorePersistedHistory();
        }
        get alive() {
          return !!this.popup.isConnected;
        }
        /** 显示弹窗并聚焦输入框 */
        show() {
          if (!this.alive) return;
          this.mask.style.display = "block";
          this.popup.style.display = "flex";
          this.input.focus();
        }
        close() {
          this.mask.style.display = "none";
          this.popup.style.display = "none";
        }
        /** 完全销毁（unload 调用）：摘 ESC 层、中止在途请求并移除 DOM */
        destroy() {
          var _a2, _b2;
          this.seq++;
          (_a2 = this.inFlight) == null ? void 0 : _a2.abort();
          this.inFlight = null;
          (_b2 = this.escHandle) == null ? void 0 : _b2.unregister();
          this.escHandle = null;
          this.mask.remove();
          this.popup.remove();
        }
        /** 历史仅 UI 展示用；裁剪 MAX_HISTORY×2 条，不进 prompt（每问独立检索） */
        addChatMessage(role, content, hits) {
          const div = document.createElement("div");
          div.className = `bz-sb-chat-msg ${role}`;
          if (role === "assistant") {
            div.innerHTML = chatAiMsgHtml();
            const bubble = div.querySelector(".bz-sb-chat-bubble");
            renderMarkdown(bubble, content, this.app);
            if (hits == null ? void 0 : hits.length) bubble.insertAdjacentHTML("beforeend", chatCitesHtml(this.citeRows(hits)));
          } else {
            div.innerHTML = chatUserMsgHtml();
            div.querySelector(".bz-sb-chat-bubble").textContent = content;
          }
          this.messagesDiv.appendChild(div);
          this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
          this.history.push({ role, content });
          const CONFIG = buildConfig();
          if (this.history.length > CONFIG.MAX_HISTORY * 2) {
            this.history = this.history.slice(-CONFIG.MAX_HISTORY * 2);
          }
          return div;
        }
        /** 引用卡行（来源色点按来源分布序取色板） */
        citeRows(hits) {
          const order = new Map(computeStats(this.store.meta).bySource.map((s, i) => [s.name, i]));
          return hits.slice(0, 5).map((h) => ({
            path: h.path,
            pct: Math.round(h.score * 100),
            color: sbSourceColor(h.path.split("/")[0] || "（根目录）", order)
          }));
        }
        /** 轻量 assistant 提示（不进历史；用于错误/停止等纯 UI 文案之外的补充说明） */
        appendAiNote(text) {
          const note = document.createElement("div");
          note.className = "bz-sb-ref-empty";
          note.textContent = text;
          this.messagesDiv.appendChild(note);
        }
        // ==================== ticket 141：多行输入 / 取消 / 流式 / 历史持久化 ====================
        /** textarea 自增高度：随内容长高，CSS max-height 钳制上限，超出内部滚动 */
        autoGrowInput() {
          this.input.style.height = "auto";
          this.input.style.height = this.input.scrollHeight + "px";
        }
        /** 每轮写盘（fire-and-forget；失败仅告警，不阻断对话） */
        persistHistory(entries) {
          appendChatHistory(entries, this.app).catch(
            (e) => console.warn("[secondbrain] 对话历史写盘失败", e)
          );
        }
        /** 打开读回持久化历史（旧数据无 chatHistory 段 → []，保持欢迎语，零迁移） */
        async restorePersistedHistory() {
          let entries;
          try {
            entries = await loadChatHistory(this.app);
          } catch (e) {
            console.warn("[secondbrain] 对话历史读回失败", e);
            return;
          }
          if (!entries.length || !this.alive) return;
          for (const m of entries) this.addChatMessage(m.role, m.content);
        }
        async sendChatMessage() {
          if (this.inFlight) return;
          const userMsg = this.input.value.trim();
          if (!userMsg) return;
          this.input.value = "";
          this.autoGrowInput();
          this.addChatMessage("user", userMsg);
          this.persistHistory([{ role: "user", content: userMsg }]);
          const CONFIG = buildConfig();
          const controller = new AbortController();
          const seq = ++this.seq;
          this.inFlight = controller;
          this.sendBtn.disabled = false;
          this.sendBtn.setAttribute("data-state", "stop");
          this.sendBtn.title = "停止";
          const live2 = document.createElement("div");
          live2.className = "bz-sb-chat-msg assistant";
          live2.innerHTML = chatAiMsgHtml();
          live2.querySelector(".bz-sb-chat-bubble").innerHTML = chatThinkingHtml(CONFIG.CHAT_TOP_K);
          this.messagesDiv.appendChild(live2);
          this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
          let acc = "";
          try {
            const results = await this.store.search(userMsg, CONFIG.CHAT_TOP_K);
            if (seq !== this.seq) return;
            const context = results.length > 0 ? results.map((r) => `[${r.path}] (${Math.round(r.score * 100)}%)
${r.chunk}`).join("\n\n") : "（未找到相关笔记）";
            const fullPrompt = `你是知识助手。参考笔记库中 ${results.length} 条检索结果回答问题。不相关可忽略。

【参考内容】
${context}

【问题】
${userMsg}`;
            const answer = await AI.ask(fullPrompt, {
              signal: controller.signal,
              onDelta: (delta) => {
                acc += delta;
                const bubble = live2.querySelector(".bz-sb-chat-bubble");
                if (bubble) bubble.textContent = acc;
                this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
              }
            });
            live2.remove();
            if (seq === this.seq) {
              this.addChatMessage("assistant", answer, results);
              this.persistHistory([{ role: "assistant", content: answer }]);
            }
          } catch (e) {
            live2.remove();
            if (seq !== this.seq) return;
            if (controller.signal.aborted) {
              this.addChatMessage("assistant", "已停止生成。");
            } else {
              this.addChatMessage("assistant", "出错了：" + ((e == null ? void 0 : e.message) || e));
            }
          } finally {
            if (seq === this.seq) {
              this.inFlight = null;
              this.sendBtn.disabled = false;
              this.sendBtn.removeAttribute("data-state");
              this.sendBtn.title = "发送";
            } else if (this.inFlight === controller) {
              this.inFlight = null;
            }
          }
        }
        /** 「清空对话」（ticket 141）：flow 确认 → 中止在途请求 → 清内存与 UI → 写盘空段 */
        async confirmClear() {
          var _a2;
          const v = await openFlowDialog({
            title: "清空对话",
            message: "将清空全部对话历史并写盘，确定继续吗？",
            actions: [
              { label: "取消", value: "cancel" },
              { label: "清空", value: "ok", cta: true }
            ]
          });
          if (v !== "ok") return;
          this.seq++;
          (_a2 = this.inFlight) == null ? void 0 : _a2.abort();
          this.inFlight = null;
          this.sendBtn.disabled = false;
          this.sendBtn.removeAttribute("data-state");
          this.sendBtn.title = "发送";
          this.history = [];
          this.messagesDiv.innerHTML = "";
          this.addChatMessage("assistant", welcomeText(buildConfig().CHAT_TOP_K));
          try {
            await clearChatHistory(this.app);
          } catch (e) {
            console.warn("[secondbrain] 对话历史清空写盘失败", e);
          }
        }
      };
    }
  });

  // src/secondbrain/float-window.ts
  var FloatWindow;
  var init_float_window = __esm({
    "src/secondbrain/float-window.ts"() {
      init_esc_manager();
      init_z_order();
      init_ui_tools();
      FloatWindow = class {
        constructor(title, opts = {}) {
          this.isHidden = false;
          this.isMaximized = false;
          this.onClose = null;
          this.restoreRect = null;
          this.hoverExpandTimer = null;
          this.detachFns = [];
          this.escHandle = null;
          this.closed = false;
          var _a2;
          this.onClose = opts.onClose || null;
          this.origWidth = (_a2 = opts.width) != null ? _a2 : 300;
          this.el = document.createElement("div");
          this.el.className = "bz-sb-float-win bz-sb-float-enter";
          this.el.style.width = this.origWidth + "px";
          this.header = document.createElement("div");
          this.header.className = "bz-sb-float-head";
          this.stripEl = document.createElement("span");
          this.stripEl.className = "bz-sb-float-strip";
          this.stripEl.textContent = "📖";
          this.titleEl = document.createElement("span");
          this.titleEl.className = "bz-sb-float-title";
          this.titleEl.textContent = title;
          this.headerRight = document.createElement("div");
          this.headerRight.className = "bz-sb-float-headright";
          const resetBtn = document.createElement("button");
          resetBtn.className = "bz-sb-float-btn";
          resetBtn.textContent = "🔄";
          resetBtn.title = "复位位置";
          resetBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.reset();
          });
          this.hideBtn = document.createElement("button");
          this.hideBtn.className = "bz-sb-float-btn";
          this.hideBtn.textContent = "◀️";
          this.hideBtn.title = "隐藏到右侧";
          this.hideBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleHide();
          });
          if (opts.headerRight) this.headerRight.appendChild(opts.headerRight);
          const closeBtn = document.createElement("button");
          closeBtn.className = "bz-sb-float-btn bz-sb-float-btn-close";
          closeBtn.textContent = "❌";
          closeBtn.title = "关闭 (Esc)";
          closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.close();
          });
          this.headerRight.appendChild(resetBtn);
          this.headerRight.appendChild(this.hideBtn);
          this.headerRight.appendChild(closeBtn);
          this.headerRight.addEventListener("mousedown", (e) => e.stopPropagation());
          this.header.appendChild(this.stripEl);
          this.header.appendChild(this.titleEl);
          this.header.appendChild(this.headerRight);
          this.body = document.createElement("div");
          this.body.className = "bz-sb-float-body";
          this.el.appendChild(this.header);
          this.el.appendChild(this.body);
          topifyZ(this.el);
          document.body.appendChild(this.el);
          this.el.addEventListener(
            "mousedown",
            () => {
              if (!this.el.style.left) {
                const r = this.el.getBoundingClientRect();
                this.el.style.left = r.left + "px";
                this.el.style.top = r.top + "px";
                this.el.style.right = "auto";
              }
            },
            true
          );
          this.detachFns.push(makeDraggable(this.el, this.header));
          this.detachFns.push(makeResizable(this.el, 30, 180));
          this.header.addEventListener("dblclick", (e) => {
            if (e.target instanceof Element && e.target.closest("button")) return;
            this.toggleMaximize();
          });
          this.el.addEventListener("mouseenter", () => {
            if (this.hoverExpandTimer) clearTimeout(this.hoverExpandTimer);
            if (this.isHidden) {
              this.hoverExpandTimer = setTimeout(() => this.show(), 200);
            }
          });
          this.el.addEventListener("mouseleave", () => {
            if (this.hoverExpandTimer) clearTimeout(this.hoverExpandTimer);
          });
          this.escHandle = escManager.register("bz-sb-float-win", {
            isVisible: () => !!this.el.isConnected,
            close: () => this.close()
          });
        }
        get alive() {
          return !!this.el.isConnected;
        }
        /** 展开等价于触发一次悬停（隐藏态 200ms 后弹出；QA L1237 同构） */
        expand() {
          this.el.dispatchEvent(new Event("mouseenter"));
        }
        /** 复位到右贴边基线：清空内联定位回归 CSS 基线 */
        reset() {
          const c = this.el;
          c.style.right = "";
          c.style.left = "";
          c.style.top = "";
          c.style.transform = "";
          c.style.width = this.origWidth + "px";
          c.style.height = window.innerHeight + "px";
          c.classList.remove("bz-sb-float-max");
          this.isMaximized = false;
          this.isHidden = false;
          this.syncHiddenUI(false);
        }
        toggleMaximize() {
          const c = this.el;
          if (!this.isMaximized) {
            this.restoreRect = {
              left: c.style.left,
              top: c.style.top,
              right: c.style.right,
              width: c.style.width,
              height: c.style.height,
              transform: c.style.transform
            };
            c.style.left = "0";
            c.style.top = "0";
            c.style.right = "auto";
            c.style.width = "100vw";
            c.style.height = "100vh";
            c.style.transform = "translateX(0)";
            c.classList.add("bz-sb-float-max");
            this.isMaximized = true;
            this.isHidden = false;
            this.syncHiddenUI(false);
          } else {
            const r = this.restoreRect;
            if (r) {
              c.style.left = r.left;
              c.style.top = r.top;
              c.style.right = r.right;
              c.style.width = r.width;
              c.style.height = r.height;
              c.style.transform = r.transform || "translateX(0)";
            }
            c.classList.remove("bz-sb-float-max");
            this.restoreRect = null;
            this.isMaximized = false;
          }
        }
        toggleHide() {
          if (this.isMaximized) return;
          if (this.isHidden) this.show();
          else this.hide();
        }
        /** 收缩为右侧 30px 边条（transform 平移属动态几何） */
        hide() {
          if (this.isHidden || this.isMaximized) return;
          this.isHidden = true;
          const rect = this.el.getBoundingClientRect();
          this.el.style.transform = `translateX(${window.innerWidth - rect.left - 30}px)`;
          this.syncHiddenUI(true);
        }
        show() {
          if (!this.isHidden) return;
          this.isHidden = false;
          topifyZ(this.el);
          this.el.style.transform = "translateX(0)";
          this.syncHiddenUI(false);
        }
        /** 隐藏态 UI：标题/按钮/内容淡出只留 📖 边条标识（视觉切换收敛 CSS hidden 类） */
        syncHiddenUI(hidden) {
          this.el.classList.toggle("bz-sb-float-hidden", hidden);
          this.hideBtn.textContent = hidden ? "▶️" : "◀️";
          this.hideBtn.title = hidden ? "展开" : "隐藏到右侧";
        }
        close() {
          var _a2, _b2;
          if (this.closed || !this.alive) return;
          this.closed = true;
          this.el.style.opacity = "0";
          if (this.hoverExpandTimer) clearTimeout(this.hoverExpandTimer);
          this.detachFns.forEach((fn) => fn());
          this.detachFns = [];
          (_a2 = this.escHandle) == null ? void 0 : _a2.unregister();
          this.escHandle = null;
          setTimeout(() => this.el.remove(), 150);
          (_b2 = this.onClose) == null ? void 0 : _b2.call(this);
        }
      };
    }
  });

  // src/secondbrain/context.ts
  function getCurrentContext(ed) {
    if (!ed) return "";
    try {
      const cursor = ed.getCursor();
      const line = ed.getLine(cursor.line);
      if (!line || line.trim().length === 0) {
        if (cursor.line > 0) {
          const prevLine = ed.getLine(cursor.line - 1);
          if (prevLine && prevLine.trim().length > 0) {
            return prevLine.trim().slice(-300);
          }
        }
        return "";
      }
      const fullText = line;
      const cursorPos = cursor.ch;
      const sentenceBreaks = /[。！？!?；;…\n]/;
      let start = 0;
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (sentenceBreaks.test(fullText[i])) {
          start = i + 1;
          break;
        }
      }
      let end = fullText.length;
      for (let i = cursorPos; i < fullText.length; i++) {
        if (sentenceBreaks.test(fullText[i])) {
          end = i + 1;
          break;
        }
      }
      let sentence = fullText.substring(start, end).trim();
      if (!sentence) sentence = fullText.trim();
      return sentence;
    } catch (e) {
      return "";
    }
  }
  var init_context = __esm({
    "src/secondbrain/context.ts"() {
    }
  });

  // src/secondbrain/reference-panel.ts
  var ReferencePanel;
  var init_reference_panel = __esm({
    "src/secondbrain/reference-panel.ts"() {
      init_notice();
      init_z_order();
      init_float_window();
      init_config();
      init_context();
      init_ui_tools();
      init_render();
      init_ui();
      ReferencePanel = class {
        constructor(app, store2, existingWin) {
          this.lastQuery = "";
          this.floatingCards = /* @__PURE__ */ new Set();
          /** 密度态：false=标题+省略内容（默认），true=仅标题（会话内有效，不持久化） */
          this.denseMode = false;
          this.isClosed = false;
          this.pollTimer = null;
          this.debounceTimer = null;
          this.hoverTimer = null;
          this.lastCursor = null;
          this.vaultRef = null;
          this.leafRef = null;
          this.editorRef = null;
          /** 浮卡拖出跟随的 document 级监听卸载器（close 时兜底清理） */
          this.activeFollows = /* @__PURE__ */ new Set();
          /** 每张卡片的未决态清理器：列表整页重建/面板关闭前统一执行——长按计时器不得跨重建存活（左上角幽灵卡根因） */
          this.cardTeardowns = /* @__PURE__ */ new Map();
          /** 浮卡的拖拽/缩放 document 级监听卸载器：close 时对仍在漂浮的卡片兜底解绑 */
          this.floatDetachers = /* @__PURE__ */ new Map();
          this.app = app;
          this.store = store2;
          this.denseBtn = document.createElement("button");
          this.denseBtn.className = "bz-sb-float-btn";
          this.denseBtn.innerHTML = '<i data-lucide="file-text"></i>';
          this.denseBtn.title = "切换：仅标题 / 标题+内容";
          if (existingWin) {
            this.fw = existingWin;
            this.fw.headerRight.appendChild(this.denseBtn);
          } else {
            this.fw = new FloatWindow("灵感参考", { headerRight: this.denseBtn, onClose: () => this.destroyResources() });
          }
          this.denseBtn.addEventListener("click", () => this.toggleDensity());
          mountIcons(this.denseBtn);
          this.resultsDiv = document.createElement("div");
          this.resultsDiv.className = "bz-sb-ref-list bz-sb-scroll-y";
          this.fw.body.appendChild(this.resultsDiv);
          try {
            this.vaultRef = app.vault.on("modify", (f) => {
              if (f.extension === "md") this.refreshWithDebounce();
            });
            this.leafRef = app.workspace.on("active-leaf-change", () => this.refreshWithDebounce());
            this.editorRef = app.workspace.on("editor-change", () => this.refreshWithDebounce());
          } catch (e) {
          }
          const CONFIG = buildConfig();
          this.pollTimer = setInterval(() => {
            var _a2;
            if (!this.fw.alive || this.fw.isHidden) return;
            const ed = (_a2 = app.workspace.activeEditor) == null ? void 0 : _a2.editor;
            if (!ed) return;
            const c = ed.getCursor();
            const k = `${c.line}:${c.ch}`;
            if (this.lastCursor !== k) {
              this.lastCursor = k;
              this.refreshWithDebounce();
            }
          }, CONFIG.CURSOR_POLL_INTERVAL);
        }
        get alive() {
          return !this.isClosed && this.fw.alive;
        }
        expand() {
          this.fw.expand();
        }
        /** 密度切换（ticket 108）：📃 仅标题 / 📑 标题+省略内容；CSS 类整体切换，会话内有效 */
        toggleDensity() {
          this.denseMode = !this.denseMode;
          this.resultsDiv.classList.toggle("bz-sb-ref-dense", this.denseMode);
          this.denseBtn.innerHTML = `<i data-lucide="${this.denseMode ? "list-tree" : "file-text"}"></i>`;
          mountIcons(this.denseBtn);
          this.denseBtn.title = this.denseMode ? "切换：标题+内容" : "切换：仅标题";
        }
        refreshWithDebounce() {
          if (this.isClosed) return;
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          const CONFIG = buildConfig();
          this.debounceTimer = setTimeout(() => void this.refreshContent(), CONFIG.DEBOUNCE_DELAY);
        }
        async refreshContent() {
          var _a2;
          if (this.isClosed) return;
          const ed = (_a2 = this.app.workspace.activeEditor) == null ? void 0 : _a2.editor;
          if (!ed) {
            this.resultsDiv.innerHTML = "";
            return;
          }
          const query = getCurrentContext(ed);
          if (query.length < 2 || query === this.lastQuery) return;
          this.lastQuery = query;
          this.showListState("检索中…");
          let degraded = false;
          try {
            const CONFIG = buildConfig();
            const results = await this.store.search(query, CONFIG.TOP_K, () => {
              degraded = true;
            });
            if (this.isClosed) return;
            this.renderResults(results);
            if (degraded) this.appendListHint("⚠ 向量检索暂不可用，已降级为文本匹配");
          } catch (err) {
            console.warn("[secondbrain] 参考面板检索失败", err);
            if (this.isClosed) return;
            this.showListState("检索失败：请检查 Ollama 服务后重试");
          }
        }
        /** [46] 列表整体占位/错误提示（loading / 失败态，复用空态样式） */
        showListState(text) {
          this.cancelPendingCardStates();
          this.resultsDiv.innerHTML = "";
          this.resultsDiv.insertAdjacentHTML("beforeend", refStateHtml(text));
        }
        /** [46] 降级脚注：不打断结果列表，在列表末追加一行说明 */
        appendListHint(text) {
          this.resultsDiv.insertAdjacentHTML("beforeend", refStateHtml(text));
        }
        renderResults(results) {
          var _a2;
          this.cancelPendingCardStates();
          this.resultsDiv.innerHTML = "";
          const currentPath = ((_a2 = this.app.workspace.getActiveFile()) == null ? void 0 : _a2.path) || "";
          const filtered = (results || []).filter((item) => item.path !== currentPath);
          if (!filtered.length) {
            const empty = document.createElement("div");
            empty.className = "bz-sb-ref-empty";
            empty.textContent = "暂无相关笔记";
            this.resultsDiv.appendChild(empty);
            return;
          }
          for (const item of filtered) {
            this.createResultCard(item);
          }
        }
        /** 列表重建/关闭前清场：取消所有卡片的未决长按与悬停计时（卡片即将被摘除，计时器不得存活） */
        cancelPendingCardStates() {
          for (const teardown of this.cardTeardowns.values()) teardown();
          this.cardTeardowns.clear();
          if (this.hoverTimer) clearTimeout(this.hoverTimer);
          this.hoverTimer = null;
        }
        /** 单张卡片：悬停预览 / 双击跳转 / 长按浮出拖出独立浮卡 */
        createResultCard(item) {
          const panel2 = this;
          const card = document.createElement("div");
          card.className = "bz-sb-ref-card";
          card.innerHTML = refCardHtml(item.path.replace(/^.*[\\/]/, "").replace(/\.md$/i, ""), Math.round(item.score * 100), "#a33d2a");
          const topRow = card.querySelector(".bz-sb-ref-card-top");
          const bodyDiv = card.querySelector(".bz-sb-ref-card-body");
          renderMarkdown(bodyDiv, item.chunk, panel2.app);
          panel2.resultsDiv.appendChild(card);
          const isFloating = () => card.classList.contains("bz-sb-ref-card--float");
          card.addEventListener("mouseenter", () => {
            var _a2;
            if (isFloating()) return;
            clearTimeout((_a2 = panel2.hoverTimer) != null ? _a2 : void 0);
            panel2.hoverTimer = setTimeout(() => {
              if (isFloating() || !card.isConnected) return;
              panel2.showHoverPreview(item, card);
            }, 300);
          });
          card.addEventListener("mouseleave", () => {
            var _a2;
            clearTimeout((_a2 = panel2.hoverTimer) != null ? _a2 : void 0);
            panel2.hoverTimer = null;
            if (!isFloating()) panel2.hideHoverPreview();
          });
          card.addEventListener("dblclick", () => {
            if (isFloating()) {
              collapseCard();
              return;
            }
            const file = panel2.app.vault.getAbstractFileByPath(item.path);
            if (!file) {
              notice("文件不存在");
              return;
            }
            jumpToChunk(file, item.chunk.slice(0, 30).trim(), true);
          });
          let holdTimer = null;
          let isHeld = false;
          let holdStartX = 0;
          let holdStartY = 0;
          let detachDrag = null;
          let detachResize = null;
          let originalNext = null;
          const cancelHold = () => {
            if (holdTimer) clearTimeout(holdTimer);
            holdTimer = null;
            isHeld = false;
            card.classList.remove("bz-sb-ref-card--held");
          };
          const attachFollow = (sx, sy) => {
            const r = card.getBoundingClientRect();
            const baseLeft = r.left;
            const baseTop = r.top;
            const move = (e) => {
              card.style.left = Math.max(0, baseLeft + e.clientX - sx) + "px";
              card.style.top = Math.max(0, baseTop + e.clientY - sy) + "px";
            };
            const detach = () => {
              document.removeEventListener("mousemove", move);
              document.removeEventListener("mouseup", up);
              panel2.activeFollows.delete(detach);
            };
            const up = () => detach();
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
            panel2.activeFollows.add(detach);
          };
          const floatCard = () => {
            if (!card.isConnected || isFloating()) return;
            card.classList.add("bz-sb-ref-card--float");
            card.style.zIndex = String(allocZ());
            panel2.floatingCards.add(card);
            panel2.hideHoverPreview();
            cancelHold();
            const r = card.getBoundingClientRect();
            card.style.position = "fixed";
            card.style.left = r.left + "px";
            card.style.top = r.top + "px";
            card.style.width = r.width + "px";
            originalNext = card.nextElementSibling;
            document.body.appendChild(card);
            topRow.classList.add("bz-sb-ref-card-top--grip");
            detachDrag = makeDraggable(card, topRow);
            detachResize = makeResizable(card, 180, 120);
            panel2.floatDetachers.set(card, () => {
              if (detachDrag) detachDrag();
              if (detachResize) detachResize();
            });
          };
          const collapseCard = () => {
            card.classList.remove("bz-sb-ref-card--float");
            panel2.floatingCards.delete(card);
            if (detachDrag) detachDrag();
            if (detachResize) detachResize();
            detachDrag = null;
            detachResize = null;
            panel2.floatDetachers.delete(card);
            topRow.classList.remove("bz-sb-ref-card-top--grip");
            card.style.cssText = "";
            if (originalNext && originalNext.parentNode === panel2.resultsDiv) {
              panel2.resultsDiv.insertBefore(card, originalNext);
            } else {
              panel2.resultsDiv.appendChild(card);
            }
            originalNext = null;
            card.classList.add("bz-sb-ref-card--return");
            setTimeout(() => card.classList.remove("bz-sb-ref-card--return"), 400);
          };
          card.addEventListener("mousedown", (e) => {
            if (isFloating() || e.button !== 0) return;
            holdStartX = e.clientX;
            holdStartY = e.clientY;
            holdTimer = setTimeout(() => {
              holdTimer = null;
              if (!card.isConnected) return;
              isHeld = true;
              card.classList.add("bz-sb-ref-card--held");
              panel2.hideHoverPreview();
            }, 250);
          });
          card.addEventListener("mousemove", (e) => {
            if (isFloating() || !card.isConnected) return;
            if (!isHeld) {
              if (holdTimer && (Math.abs(e.clientX - holdStartX) > 8 || Math.abs(e.clientY - holdStartY) > 8)) {
                clearTimeout(holdTimer);
                holdTimer = null;
              }
              return;
            }
            if (Math.abs(e.clientX - holdStartX) > 15 || Math.abs(e.clientY - holdStartY) > 15) {
              floatCard();
              attachFollow(e.clientX, e.clientY);
            }
          });
          card.addEventListener("mouseup", () => {
            if (isFloating()) return;
            cancelHold();
          });
          card.addEventListener("mouseleave", () => {
            if (isFloating()) return;
            if (!card.isConnected) {
              cancelHold();
              return;
            }
            if (isHeld) {
              cancelHold();
              floatCard();
            }
          });
          panel2.cardTeardowns.set(card, () => cancelHold());
          return card;
        }
        /** 悬停预览：带路径与匹配度，按窄窗在屏左/右智能定位（QA L1599-1637） */
        showHoverPreview(item, cardEl) {
          this.hideHoverPreview();
          const refRect = this.fw.el.getBoundingClientRect();
          const cardRect = cardEl.getBoundingClientRect();
          const isRightSide = refRect.left > window.innerWidth / 2;
          const preview = document.createElement("div");
          preview.className = "bz-sb-ref-preview";
          preview.style.zIndex = String(allocZ());
          const PW = 460;
          let left = isRightSide ? refRect.left - (PW + 8) : refRect.right + 8;
          left = Math.max(8, Math.min(left, window.innerWidth - PW - 8));
          preview.style.left = left + "px";
          this.clampPreviewTop(preview, cardRect.top - 20);
          const pathLabel = document.createElement("div");
          pathLabel.className = "bz-sb-ref-preview-path";
          pathLabel.textContent = item.path;
          const scoreLabel = document.createElement("div");
          scoreLabel.className = "bz-sb-ref-preview-score";
          scoreLabel.textContent = `匹配度 ${Math.round(item.score * 100)}%`;
          const bodyDiv = document.createElement("div");
          bodyDiv.className = "bz-sb-ref-preview-body";
          renderMarkdown(bodyDiv, item.chunk, this.app);
          preview.appendChild(pathLabel);
          preview.appendChild(scoreLabel);
          preview.appendChild(bodyDiv);
          document.body.appendChild(preview);
          setTimeout(() => {
            if (preview.isConnected) this.clampPreviewTop(preview, cardRect.top - 20);
          }, 120);
        }
        /** 不限高随内容生长（ticket 109）：top 钳制进视口，尽量多显示全文 */
        clampPreviewTop(preview, desiredTop) {
          const maxTop = window.innerHeight - preview.offsetHeight - 10;
          preview.style.top = Math.max(10, Math.min(desiredTop, maxTop)) + "px";
        }
        hideHoverPreview() {
          var _a2;
          document.querySelectorAll(".bz-sb-ref-preview").forEach((el) => el.remove());
          clearTimeout((_a2 = this.hoverTimer) != null ? _a2 : void 0);
          this.hoverTimer = null;
        }
        /** 关闭并释放全部资源（幂等） */
        close() {
          this.destroyResources();
          this.fw.close();
        }
        destroyResources() {
          var _a2, _b2;
          if (this.isClosed) return;
          this.isClosed = true;
          clearTimeout((_a2 = this.debounceTimer) != null ? _a2 : void 0);
          clearInterval((_b2 = this.pollTimer) != null ? _b2 : void 0);
          this.debounceTimer = null;
          this.pollTimer = null;
          if (this.vaultRef || this.leafRef || this.editorRef) {
            try {
              if (this.vaultRef) this.app.vault.offref(this.vaultRef);
              if (this.leafRef) this.app.workspace.offref(this.leafRef);
              if (this.editorRef) this.app.workspace.offref(this.editorRef);
            } catch (e) {
            }
          }
          this.cancelPendingCardStates();
          this.hideHoverPreview();
          for (const detach of this.activeFollows) detach();
          this.activeFollows.clear();
          for (const detach of this.floatDetachers.values()) detach();
          this.floatDetachers.clear();
          for (const fc of this.floatingCards) fc.remove();
          this.floatingCards.clear();
        }
      };
    }
  });

  // src/secondbrain/mobile-panel.ts
  var SNAP_MID, SNAP_HIGH, COLLAPSE_THRESHOLD, MobilePanel;
  var init_mobile_panel = __esm({
    "src/secondbrain/mobile-panel.ts"() {
      init_esc_manager();
      init_notice();
      init_ui();
      init_config();
      init_z_order();
      init_context();
      init_ui_tools();
      init_ai2();
      init_render();
      init_store_file();
      SNAP_MID = 45;
      SNAP_HIGH = 75;
      COLLAPSE_THRESHOLD = 18;
      MobilePanel = class {
        constructor(app, store2) {
          this.mode = "ref";
          this.collapsed = false;
          this.chatHistory = [];
          this.refResults = [];
          /** 检索失败提示（ticket 141：不再吞错成「暂无相关笔记」，与桌面参考面板同款文案与形态；成功检索后清空） */
          this.refError = null;
          this.chatMessagesDiv = null;
          this.cursorPoll = null;
          this.debounceTimer = null;
          this.evLeaf = null;
          this.escHandle = null;
          this.lastCursor = null;
          this.lastQuery = "";
          var _a2;
          this.app = app;
          this.store = store2;
          const CONFIG = buildConfig();
          this.sheet = document.createElement("div");
          this.sheet.className = "bz-sb-mb-sheet";
          const topbar = document.createElement("div");
          topbar.className = "bz-sb-mb-topbar";
          this.pillRef = document.createElement("button");
          this.pillRef.className = "bz-sb-mb-pill active";
          this.pillRef.title = "参考";
          this.pillRef.setAttribute("aria-label", "参考");
          this.pillRef.innerHTML = '<i data-lucide="radar"></i>';
          this.pillChat = document.createElement("button");
          this.pillChat.className = "bz-sb-mb-pill";
          this.pillChat.title = "AI";
          this.pillChat.setAttribute("aria-label", "AI");
          this.pillChat.innerHTML = '<i data-lucide="message-square"></i>';
          const dragStrip = document.createElement("div");
          dragStrip.className = "bz-sb-mb-drag-strip";
          const dragDot = document.createElement("div");
          dragDot.className = "bz-sb-mb-drag-dot";
          dragStrip.appendChild(dragDot);
          topbar.appendChild(this.pillRef);
          topbar.appendChild(dragStrip);
          topbar.appendChild(this.pillChat);
          this.sheet.appendChild(topbar);
          mountIcons(topbar);
          this.body = document.createElement("div");
          this.body.className = "bz-sb-mb-body bz-sb-scroll-y";
          this.sheet.appendChild(this.body);
          this.mini = document.createElement("div");
          this.mini.className = "bz-sb-mb-mini";
          const miniDot = document.createElement("span");
          miniDot.className = "bz-sb-mb-mini-dot";
          const miniLabel = document.createElement("span");
          miniLabel.className = "bz-sb-mb-mini-label";
          miniLabel.textContent = "参考";
          this.mini.appendChild(miniDot);
          this.mini.appendChild(miniLabel);
          document.body.appendChild(this.sheet);
          document.body.appendChild(this.mini);
          this.pillRef.addEventListener("click", () => this.switchTab("ref"));
          this.pillChat.addEventListener("click", () => this.switchTab("chat"));
          this.mini.addEventListener("click", () => this.expand());
          void store2.initMobile().catch((e) => console.warn("[secondbrain] initMobile 失败", e));
          this.escHandle = escManager.register("bz-sb-mb-sheet", {
            isVisible: () => !this.collapsed && !!this.sheet.isConnected,
            close: () => this.collapse()
          });
          let dragging = false;
          let dragStartY = 0;
          let dragStartH = 0;
          topbar.addEventListener(
            "touchstart",
            (e) => {
              if (this.collapsed) return;
              dragging = true;
              dragStartY = e.touches[0].clientY;
              dragStartH = this.sheet.getBoundingClientRect().height;
              this.sheet.classList.add("bz-sb-mb-dragging");
            },
            { passive: true }
          );
          this.onTouchMove = (e) => {
            if (!dragging) return;
            const dy = dragStartY - e.touches[0].clientY;
            const vh = window.innerHeight;
            const pct = Math.max(6, Math.min(88, (dragStartH + dy) / vh * 100));
            this.sheet.style.height = pct + "vh";
          };
          this.onTouchEnd = () => {
            if (!dragging) return;
            dragging = false;
            this.sheet.classList.remove("bz-sb-mb-dragging");
            const pct = this.sheet.getBoundingClientRect().height / window.innerHeight * 100;
            if (pct < COLLAPSE_THRESHOLD) {
              this.collapse();
              return;
            }
            const closest = Math.abs(SNAP_MID - pct) <= Math.abs(SNAP_HIGH - pct) ? SNAP_MID : SNAP_HIGH;
            this.sheet.style.height = closest + "vh";
          };
          document.addEventListener("touchmove", this.onTouchMove, { passive: true });
          document.addEventListener("touchend", this.onTouchEnd);
          this.cursorPoll = setInterval(() => {
            if (this.collapsed) return;
            this.checkCursor();
          }, CONFIG.CURSOR_POLL_INTERVAL);
          try {
            this.evLeaf = app.workspace.on("active-leaf-change", () => this.checkCursor());
          } catch (e) {
          }
          this.onSelectionChange = () => {
            setTimeout(() => this.checkCursor(), 50);
          };
          document.addEventListener("selectionchange", this.onSelectionChange);
          this.renderBody();
          if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => this.expand());
          else this.expand();
          const initEd = (_a2 = app.workspace.activeEditor) == null ? void 0 : _a2.editor;
          if (initEd) {
            const q = getCurrentContext(initEd);
            if (q.length >= 2) {
              this.lastQuery = q;
              const c = initEd.getCursor();
              this.lastCursor = `${c.line}:${c.ch}`;
              void this.refreshResults(q);
            }
          }
          void loadChatHistory(app).then((entries) => {
            if (!entries.length) return;
            this.chatHistory = entries.slice(-buildConfig().MAX_HISTORY * 2);
            if (this.mode === "chat") this.renderBody();
          }).catch(() => {
          });
        }
        get alive() {
          return !!this.sheet.isConnected;
        }
        /** 展开抽屉（expand 的对外别名，与 FloatWindow.show 语义对齐，index 接线使用） */
        show() {
          this.expand();
        }
        /** 展开（45vh），隐藏 mini */
        expand() {
          this.collapsed = false;
          topifyZ(this.sheet);
          this.sheet.classList.remove("bz-sb-mb-dragging");
          this.sheet.style.height = SNAP_MID + "vh";
          this.sheet.classList.add("bz-sb-mb-open");
          this.mini.classList.remove("bz-sb-mb-visible");
        }
        /** 收起为底部 mini 胶囊 */
        collapse() {
          this.collapsed = true;
          this.sheet.classList.remove("bz-sb-mb-open");
          this.sheet.classList.remove("bz-sb-mb-dragging");
          topifyZ(this.mini);
          this.mini.classList.add("bz-sb-mb-visible");
        }
        updateMiniLabel() {
          const label = this.mini.querySelector(".bz-sb-mb-mini-label");
          if (label) label.textContent = this.mode === "ref" ? "参考" : "AI";
        }
        switchTab(tab) {
          this.mode = tab;
          this.pillRef.classList.toggle("active", tab === "ref");
          this.pillChat.classList.toggle("active", tab === "chat");
          this.updateMiniLabel();
          this.renderBody();
        }
        /** 光标变化 → 防抖 → 上下文变化才重新检索（QA L2016-2031） */
        checkCursor() {
          var _a2, _b2;
          const ed = (_a2 = this.app.workspace.activeEditor) == null ? void 0 : _a2.editor;
          if (!ed) return;
          const c = ed.getCursor();
          const k = `${c.line}:${c.ch}`;
          if (this.lastCursor === k) return;
          this.lastCursor = k;
          clearTimeout((_b2 = this.debounceTimer) != null ? _b2 : void 0);
          this.debounceTimer = setTimeout(() => {
            void (async () => {
              const q = getCurrentContext(ed);
              if (q === this.lastQuery) return;
              this.lastQuery = q;
              await this.refreshResults(q);
            })();
          }, buildConfig().DEBOUNCE_DELAY);
        }
        async refreshResults(query) {
          const CONFIG = buildConfig();
          if (!query || query.length < 2) {
            this.refResults = [];
            this.refError = null;
            if (this.mode === "ref") this.renderRefTab();
            return;
          }
          try {
            this.refResults = await this.store.searchMobile(query, CONFIG.TOP_K);
            this.refError = null;
          } catch (e) {
            console.warn("[secondbrain] 移动端检索失败", e);
            this.refResults = [];
            this.refError = "检索失败：请检查 Ollama 服务后重试";
          }
          if (this.mode === "ref") this.renderRefTab();
        }
        renderBody() {
          this.body.innerHTML = "";
          if (this.mode === "ref") this.renderRefTab();
          else this.renderChatTab();
        }
        /** 参考 tab：过滤当前文件 + 单击懒渲染展开 + 长按震动跳转并收起（QA L2050-2100） */
        renderRefTab() {
          var _a2;
          this.body.innerHTML = "";
          const currentPath = ((_a2 = this.app.workspace.getActiveFile()) == null ? void 0 : _a2.path) || "";
          const filtered = this.refResults.filter((r) => r.path !== currentPath);
          if (!filtered.length) {
            const empty = document.createElement("div");
            empty.className = "bz-sb-mb-empty";
            empty.textContent = this.refError || "暂无相关笔记";
            this.body.appendChild(empty);
            return;
          }
          for (const item of filtered) {
            const card = document.createElement("div");
            card.className = "bz-sb-mb-card";
            const topRow = document.createElement("div");
            topRow.className = "bz-sb-mb-card-top";
            const pathDiv = document.createElement("div");
            pathDiv.className = "bz-sb-mb-card-path";
            pathDiv.textContent = item.path.replace(/^.*[\\/]/, "").replace(/\.md$/i, "");
            const scoreDiv = document.createElement("div");
            scoreDiv.className = "bz-sb-mb-card-score";
            scoreDiv.textContent = `${Math.round(item.score * 100)}%`;
            topRow.appendChild(pathDiv);
            topRow.appendChild(scoreDiv);
            card.appendChild(topRow);
            const bar = document.createElement("div");
            bar.className = "bz-sb-mb-card-bar";
            const barFill = document.createElement("span");
            barFill.style.width = `${Math.round(item.score * 100)}%`;
            bar.appendChild(barFill);
            card.appendChild(bar);
            const chunkDiv = document.createElement("div");
            chunkDiv.className = "bz-sb-mb-card-chunk";
            card.appendChild(chunkDiv);
            this.body.appendChild(card);
            let expanded = false;
            let rendered = false;
            card.addEventListener("click", () => {
              expanded = !expanded;
              if (expanded && !rendered) {
                chunkDiv.innerHTML = "";
                renderMarkdown(chunkDiv, item.chunk, this.app);
                rendered = true;
              }
              chunkDiv.classList.toggle("expanded", expanded);
            });
            let holdTimer = null;
            card.addEventListener(
              "touchstart",
              () => {
                holdTimer = setTimeout(() => {
                  holdTimer = null;
                  if (navigator.vibrate) navigator.vibrate(30);
                  const file = this.app.vault.getAbstractFileByPath(item.path);
                  if (!file) {
                    notice("文件不存在");
                    return;
                  }
                  jumpToChunk(file, item.chunk.slice(0, 30).trim(), false);
                  this.collapse();
                }, 500);
              },
              { passive: true }
            );
            card.addEventListener("touchend", () => {
              if (holdTimer) clearTimeout(holdTimer);
              holdTimer = null;
            });
            card.addEventListener("touchmove", () => {
              if (holdTimer) clearTimeout(holdTimer);
              holdTimer = null;
            });
          }
        }
        /** AI tab：桌面同构重排（issue 251 移动对齐）——标签气泡 + 推荐问法 + 带聚焦态输入行 */
        renderChatTab() {
          const CONFIG = buildConfig();
          const chat2 = document.createElement("div");
          chat2.className = "bz-sb-mb-chat";
          this.chatMessagesDiv = document.createElement("div");
          this.chatMessagesDiv.className = "bz-sb-mb-chat-messages bz-sb-scroll-y";
          chat2.appendChild(this.chatMessagesDiv);
          const inputArea = document.createElement("div");
          inputArea.className = "bz-sb-mb-chat-input-area";
          const inputRow = document.createElement("div");
          inputRow.className = "bz-sb-mb-chat-input-row";
          const lens = document.createElement("span");
          lens.className = "bz-sb-mb-chat-lens";
          lens.innerHTML = '<i data-lucide="sparkles"></i>';
          const input = document.createElement("input");
          input.className = "bz-sb-mb-chat-input";
          input.type = "text";
          input.placeholder = "向第二大脑提问，回车发送…";
          const sendBtn = document.createElement("button");
          sendBtn.className = "bz-sb-mb-chat-send";
          sendBtn.setAttribute("aria-label", "发送");
          sendBtn.title = "发送";
          sendBtn.innerHTML = '<i data-lucide="send"></i>';
          inputRow.appendChild(lens);
          inputRow.appendChild(input);
          inputRow.appendChild(sendBtn);
          inputArea.appendChild(inputRow);
          const chips = document.createElement("div");
          chips.className = "bz-sb-mb-chat-chips";
          for (const q of CHAT_CHIPS) {
            const chip = document.createElement("button");
            chip.className = "bz-sb-mb-chat-chip";
            chip.textContent = q;
            chip.addEventListener("click", () => {
              if (sendBtn.disabled) return;
              input.value = q;
              void send();
            });
            chips.appendChild(chip);
          }
          inputArea.appendChild(chips);
          chat2.appendChild(inputArea);
          this.body.appendChild(chat2);
          for (const msg of this.chatHistory) this.appendChatMsg(msg.role, msg.content);
          if (!this.chatHistory.length) {
            this.appendChatMsg("assistant", `你好！每次提问会独立检索 ${Object.keys(this.store.notes).length} 篇笔记作答。`);
          }
          const send = async () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = "";
            this.appendChatMsg("user", text);
            this.chatHistory.push({ role: "user", content: text });
            void appendChatHistory([{ role: "user", content: text }], this.app).catch(() => {
            });
            sendBtn.disabled = true;
            try {
              const results = await this.store.searchMobile(text, CONFIG.CHAT_TOP_K);
              const ctx = results.length > 0 ? results.map((r) => `[${r.path}] (${Math.round(r.score * 100)}%)
${r.chunk}`).join("\n\n") : "（未找到相关笔记）";
              const prompt = `你是知识助手。参考 ${results.length} 条检索结果回答。不相关可忽略。

【参考】
${ctx}

【问题】
${text}`;
              const answer = await AI.ask(prompt);
              this.appendChatMsg("assistant", answer);
              this.chatHistory.push({ role: "assistant", content: answer });
              void appendChatHistory([{ role: "assistant", content: answer }], this.app).catch(() => {
              });
              if (this.chatHistory.length > CONFIG.MAX_HISTORY * 2) {
                this.chatHistory = this.chatHistory.slice(-CONFIG.MAX_HISTORY * 2);
              }
            } catch (e) {
              this.appendChatMsg("assistant", "出错了：" + ((e == null ? void 0 : e.message) || e));
            } finally {
              sendBtn.disabled = false;
            }
          };
          sendBtn.addEventListener("click", () => void send());
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") void send();
          });
          mountIcons(chat2);
        }
        appendChatMsg(role, content) {
          if (!this.chatMessagesDiv) return;
          const div = document.createElement("div");
          div.className = `bz-sb-mb-chat-msg ${role}`;
          const who = document.createElement("div");
          who.className = "bz-sb-mb-chat-who";
          who.innerHTML = `<i data-lucide="${role === "user" ? "send" : "brain"}"></i>${role === "user" ? "刚问" : "第二大脑"}`;
          const bubble = document.createElement("div");
          bubble.className = "bz-sb-mb-chat-bubble";
          if (role === "assistant") {
            renderMarkdown(bubble, content, this.app);
          } else {
            bubble.textContent = content;
          }
          div.appendChild(who);
          div.appendChild(bubble);
          this.chatMessagesDiv.appendChild(div);
          mountIcons(div);
          this.chatMessagesDiv.scrollTop = this.chatMessagesDiv.scrollHeight;
        }
        /** 完全关闭（区别于收起）：清理监听与定时器后移除 DOM */
        close() {
          var _a2, _b2, _c;
          (_a2 = this.escHandle) == null ? void 0 : _a2.unregister();
          this.escHandle = null;
          if (this.evLeaf) {
            try {
              this.app.workspace.offref(this.evLeaf);
            } catch (e) {
            }
          }
          document.removeEventListener("selectionchange", this.onSelectionChange);
          document.removeEventListener("touchmove", this.onTouchMove);
          document.removeEventListener("touchend", this.onTouchEnd);
          clearInterval((_b2 = this.cursorPoll) != null ? _b2 : void 0);
          clearTimeout((_c = this.debounceTimer) != null ? _c : void 0);
          this.cursorPoll = null;
          this.debounceTimer = null;
          this.sheet.classList.remove("bz-sb-mb-open");
          this.mini.classList.remove("bz-sb-mb-visible");
          setTimeout(() => {
            this.sheet.remove();
            this.mini.remove();
          }, 300);
        }
      };
    }
  });

  // prototypes/secondbrain/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootSecondBrainSim: () => bootSecondBrainSim,
    demoReferenceQuery: () => demoReferenceQuery,
    openChat: () => openChat,
    openPanel: () => openPanel,
    openRef: () => openRef
  });
  init_fake_obsidian();
  init_app();
  init_settings_provider();
  init_ai();
  init_panel();
  init_chat_panel();
  init_reference_panel();
  init_mobile_panel();
  init_config();
  var SimVectorStore = class {
    constructor() {
      this.dim = 1024;
      this.vectors = new Float32Array(0);
      this.initialLoad = Promise.resolve();
      this.refreshPromise = null;
      const sim = window.SBD_SIM;
      this.meta = sim.store.meta;
      const rows = Object.keys(this.meta.notes).length;
      this.vectors = new Float32Array(rows * this.dim);
    }
    isIndexReady() {
      return Object.keys(this.meta.notes).length > 0;
    }
    isRefreshing() {
      return this.refreshPromise !== null;
    }
    hasPendingChanges() {
      return false;
    }
    /** 移动端检索面（mobile-panel 消费）：与桌面 search 同一演示匹配链 */
    async searchMobile(query, topK = 20) {
      return this.search(query, topK);
    }
    /** mobile-panel AI tab 欢迎语消费面（store.notes 键数） */
    get notes() {
      return this.meta.notes;
    }
    async refresh(cb) {
      if (this.refreshPromise) return this.refreshPromise;
      this.refreshPromise = (async () => {
        cb == null ? void 0 : cb("扫描 vault 变更…");
        await new Promise((r) => setTimeout(r, 350));
        cb == null ? void 0 : cb("✅ 向量化完成：演示快照无变更");
      })();
      await this.refreshPromise;
      this.refreshPromise = null;
    }
    async rebuildAll(cb) {
      const total = Object.keys(this.meta.notes).length;
      for (let i = 1; i <= 5; i++) {
        cb == null ? void 0 : cb(`向量化: ${Math.round(i / 5 * total)}/${total}`);
        await new Promise((r) => setTimeout(r, 280));
      }
      cb == null ? void 0 : cb("✅ 向量化完成：演示快照（全量重嵌）");
    }
    /** 移动端初始化（index.ts IS_MOBILE 分支调用；演示快照已就绪，无事可做） */
    async initMobile() {
      return null;
    }
    /** 演示检索：标题+段落包含计分（真 search 的降级文本匹配同形态输出） */
    async search(query, topK = 20) {
      var _a2;
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const termSet = /* @__PURE__ */ new Set();
      for (const t of q.split(/\s+|，|,|？|\?|。|、/)) if (t.length >= 2) termSet.add(t);
      for (let i = 0; i < q.length - 1; i++) {
        const g = q.slice(i, i + 2);
        if (/[一-鿿]/.test(g)) termSet.add(g);
      }
      const terms = [...termSet];
      const scored = [];
      for (const [path, entry] of Object.entries(this.meta.notes)) {
        const name = path.split("/").pop().replace(/\.md$/i, "");
        let score = 0;
        for (const t of terms) {
          if (name.toLowerCase().includes(t)) score += 0.45;
          for (const c of entry.chunks) {
            if (c.text.toLowerCase().includes(t)) score += 0.2;
          }
        }
        if (score > 0) {
          score = Math.min(0.95, score);
          scored.push({ path, chunk: ((_a2 = entry.chunks[0]) == null ? void 0 : _a2.text) || "", score: Math.round(score * 100) / 100 });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    }
  };
  var STORE_JSON = "CONFIG/STORAGE/secondbrain.json";
  var STORE_VEC = "CONFIG/STORAGE/secondbrain.vec";
  var simApp = null;
  var store = null;
  var panel = null;
  var chat = null;
  var reference = null;
  var mobile = null;
  var DEMO_ANSWERS = [
    [
      ["遗忘", "记不住", "记忆"],
      "根据库内检索结果，与遗忘直接相关的记录有几条：\n\n1. **艾宾浩斯遗忘曲线**（92%）——遗忘在学习之后立即开始，先快后慢。\n2. **短时记忆遗忘**（86%）——短时记忆未复述约 30 秒内消退。\n\n综合来看：对抗遗忘的核心是**在遗忘临界点前主动提取**（复述/测试），这与费曼学习法的「讲给别人听」是同一原理。"
    ],
    [
      ["享乐", "快乐", "幸福"],
      "库里关于享乐适应积累较厚：**享乐适应**——无论发生什么好事或坏事，幸福感都会回归基线；**PERMA模型**给出了幸福感可操作的五个支柱。\n\n换个角度看，它提醒人们的或许不是快乐终将消失，而是**快乐太容易融入日常，以至于不再被察觉**。"
    ],
    [
      ["笔记", "记笔记", "卢曼"],
      "与记笔记最相关的是**卢曼卡片笔记法**：知识网络的价值来自笔记之间的连接而非数量。配合**费曼学习法**（以教代学）效果最好。"
    ],
    [
      ["睡", "失眠", "REM"],
      "库内与睡眠相关的记录：**REM睡眠**（快速眼动期与记忆巩固相关）、**褪黑素**（昼夜节律）、**CBTI**（失眠的认知行为疗法，一线非药物方案）。"
    ],
    [["闪电"], "库里有两篇与闪电相关：**闪电化石**（雷击石英留下的管状玻璃，可用于追溯远古雷暴）与**精灵闪电**（雷暴云顶上方的短暂放电现象）。"],
    [
      ["王阳明", "心学"],
      "与王阳明相关：**王阳明心学精要**（知行合一/致良知）、**安心立命**。心学强调「事上磨练」——知识与行动在第二大脑里也是同一件事。"
    ]
  ];
  function pickAnswer(q) {
    for (const [kws, ans] of DEMO_ANSWERS) if (kws.some((k) => q.includes(k))) return ans;
    return `已检索库内相关段落（演示环境走降级文本匹配）。这个问题在当前演示快照里的直接命中不多——试试「遗忘」「享乐」「记笔记」「睡眠」「闪电」「王阳明」这些库里积累较厚的方向。`;
  }
  function patchFetch() {
    if (globalThis.__bzSbFetchPatched) return;
    globalThis.__bzSbFetchPatched = true;
    const orig = globalThis.fetch.bind(globalThis);
    globalThis.fetch = async (input, init) => {
      var _a2, _b2;
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/chat/completions")) {
        let q = "";
        try {
          const body = JSON.parse(String((init == null ? void 0 : init.body) || "{}"));
          const m = String(((_b2 = (_a2 = body.messages) == null ? void 0 : _a2[0]) == null ? void 0 : _b2.content) || "").match(/【问题】\n([\s\S]*)$/);
          q = m ? m[1] : "";
        } catch (e) {
        }
        const text = pickAnswer(q);
        const sse = text.match(/[\s\S]{1,24}/g).map((piece) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}

`).join("") + "data: [DONE]\n\n";
        const stream = new Response(sse).body;
        return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
      }
      return orig(input, init);
    };
  }
  function seed() {
    const sim = window.SBD_SIM;
    if (!sim) throw new Error("prototype-data.js 未载入（window.SBD_SIM 缺失）");
    const set = (path, content) => localStorage.setItem("bz-sb-sim:" + path, content);
    if (!localStorage.getItem("bz-sb-sim:" + STORE_JSON)) {
      set(STORE_JSON, JSON.stringify(sim.store));
      set(STORE_VEC, sim.fakeVecB64);
    }
  }
  function injectSettings() {
    const settings = {
      secondBrainEnabled: true,
      aiProvider: "deepseek",
      // 对话走 deepseek 通道；网络层由 patchFetch 拦截（无真实请求）
      deepseekApiKey: "demo-key",
      linkAgentEnabled: false,
      // 原型不跑自动双链（避免空转队列）
      secondBrainTopK: "20",
      secondBrainChatTopK: "20",
      secondBrainChunkMinLength: "50",
      secondBrainContextLimit: "600",
      secondBrainDebounceDelay: "300",
      secondBrainCursorPollInterval: "500",
      secondBrainMaxHistory: "10",
      secondBrainOllamaUrl: "http://localhost:11434",
      secondBrainEmbeddingModel: "bge-m3",
      secondBrainDeepseekModel: "deepseek-v4-flash",
      secondbrainSkin: "default",
      secondbrainSkinTheme: "graphite"
    };
    setSettingsProvider(() => settings);
    setSettingsSaver(async () => {
    });
    setAISettingsProvider(() => ({ aiProvider: "deepseek", deepseekApiKey: "demo-key" }));
  }
  function bootSecondBrainSim() {
    const g = globalThis;
    if (g.__bzSbSimBooted) return;
    g.__bzSbSimBooted = true;
    seed();
    patchFetch();
    const app = new FakeApp();
    simApp = app;
    setApp(app);
    injectSettings();
  }
  async function ensureStore() {
    if (!simApp) bootSecondBrainSim();
    if (!store) {
      store = new SimVectorStore();
      await new Promise((r) => setTimeout(r, 120));
    }
    return store;
  }
  async function openPanel() {
    const s = await ensureStore();
    if (!panel) {
      panel = new SecondBrainPanel(simApp, s, {
        onOpenReference: () => void openRef(),
        onOpenChat: () => void openChat()
      });
    }
    await panel.open();
  }
  async function openChat() {
    const s = await ensureStore();
    if (IS_MOBILE) {
      mobile != null ? mobile : mobile = new MobilePanel(simApp, s);
      mobile.switchTab("chat");
      mobile.show();
      return;
    }
    if (!chat) chat = new ChatPanel(s, simApp);
    chat.show();
  }
  async function openRef() {
    const s = await ensureStore();
    if (IS_MOBILE) {
      mobile != null ? mobile : mobile = new MobilePanel(simApp, s);
      mobile.show();
      return;
    }
    if (!reference || !reference.alive) reference = new ReferencePanel(simApp, s);
    reference.fw.show();
  }
  function demoReferenceQuery(query) {
    if (!simApp) bootSecondBrainSim();
    const editor = {
      getCursor: () => ({ line: 0, ch: 3 }),
      getLine: () => query,
      getValue: () => query
    };
    simApp.workspace.activeEditor = { editor };
    void openRef().then(() => {
      if (IS_MOBILE) {
        void (mobile == null ? void 0 : mobile.refreshResults(query));
        return;
      }
      void (reference == null ? void 0 : reference.refreshWithDebounce());
    });
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
