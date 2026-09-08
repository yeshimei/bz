/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/secondbrain/fake-sim.ts → window.BZW_secondbrain（行为单源预览包，issue 245/ADR-0106） */
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

  // src/secondbrain/fake/fake-obsidian.ts
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
  var Platform, MarkdownRenderer, Component, Setting, FakeVault, FakeApp;
  var init_fake_obsidian = __esm({
    "src/secondbrain/fake/fake-obsidian.ts"() {
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
      Setting = class {
        constructor(_container) {
        }
        setName() {
          return this;
        }
        setDesc() {
          return this;
        }
        addText() {
          return this;
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
  function notifyActionError(err, action) {
    const msg = err instanceof Error ? err.message : String(err);
    notify(`${action}失败：${msg}，请重试`, { type: "error" });
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
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
  }
  var init_mobile = __esm({
    "src/core/mobile.ts"() {
      init_fake_obsidian();
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
      const ic2 = uiIcon(opts.icon);
      ic2.classList.add("bz-empty-ic");
      el.appendChild(ic2);
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
      var _a2;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const list = opts.options.map((o) => o.value);
      const idx = list.indexOf(cur);
      const next = e.key === "ArrowRight" ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
      (_a2 = btns.get(list[next])) == null ? void 0 : _a2.focus();
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
  function uiProgress(opts = {}) {
    const el = document.createElement("div");
    const cls = ["bz-progress"];
    if (opts.thin) cls.push("bz-progress--thin");
    if (opts.tone) cls.push(`bz-progress--${opts.tone}`);
    el.className = cls.join(" ");
    const fill = document.createElement("i");
    el.appendChild(fill);
    const setValue = (n) => {
      const v = Math.min(100, Math.max(0, Number(n) || 0));
      fill.style.width = v + "%";
    };
    if (opts.value !== void 0) setValue(opts.value);
    return { el, setValue };
  }
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
  function longPress(el, cb, dur, filter) {
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
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", endFromMouse);
    el.addEventListener("mouseleave", endFromMouse);
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", endFromTouch);
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchcancel", endFromTouch);
    el.addEventListener("click", onClick, true);
  }
  function createSiteIcon(domain, size = 16) {
    if (!domain) return null;
    const mappedDomain = DOMAIN_MAP[domain] || domain;
    const cacheKey = `favicon_v2_${mappedDomain}_${size}`;
    const img = document.createElement("img");
    img.className = "bz-site-icon";
    img.style.cssText = `width:${size}px; height:${size}px;`;
    img.alt = "";
    img.crossOrigin = "anonymous";
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        img.src = cached;
        return img;
      }
    } catch (e) {
    }
    const networkUrl = `https://favicon.yandex.net/favicon/v2/${mappedDomain}?size=${size}`;
    img.src = networkUrl;
    img.onload = function() {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        try {
          localStorage.setItem(cacheKey, dataUrl);
        } catch (e) {
        }
      } catch (e) {
      }
      img.onload = null;
    };
    img.onerror = function() {
      img.style.display = "none";
      img.onerror = null;
    };
    return img;
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
  var DOMAIN_MAP;
  var init_dom = __esm({
    "src/core/dom.ts"() {
      init_notice();
      init_z_order();
      DOMAIN_MAP = {
        "guokrapp.guokr.com": "guokr.com",
        "daily.zhihu.com": "zhihu.com"
      };
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
    var _a2, _b2, _c, _d;
    const out = /* @__PURE__ */ new Set([""]);
    try {
      const files = ((_c = (_b2 = (_a2 = app == null ? void 0 : app.vault) == null ? void 0 : _a2.getFiles) == null ? void 0 : _b2.call(_a2)) != null ? _c : []).map((f) => f.path);
      for (const p of foldersFromFiles(files)) out.add(p);
    } catch (e) {
    }
    const adapter = (_d = app == null ? void 0 : app.vault) == null ? void 0 : _d.adapter;
    if (adapter && typeof adapter.list === "function") {
      const walk = async (dir, depth) => {
        var _a3;
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
        for (const f of (_a3 = listed == null ? void 0 : listed.folders) != null ? _a3 : []) {
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
          renderAll();
        });
      }
      current = Array.isArray(res) ? res : list;
      renderAll();
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
    const renderAll = () => {
      syncBtn();
      render();
    };
    const refresh = () => {
      current = readValue();
      renderAll();
    };
    renderAll();
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
    var _a2, _b2, _c;
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
    const listEl = document.createElement("div");
    listEl.className = "bz-path-picker-list";
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
      renderList();
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
    function renderList() {
      listEl.innerHTML = "";
      const q = state.q.trim().toLowerCase();
      const exact = !!q && state.folders.includes(q);
      const LIMIT2 = 300;
      let n = 0;
      let total = 0;
      for (const folder of orderedList()) {
        if (q && !exact && !folder.toLowerCase().includes(q)) continue;
        total++;
        if (n >= LIMIT2) continue;
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
          renderList();
          updateSel();
        };
        listEl.appendChild(row);
      }
      if (!total) {
        const empty = document.createElement("div");
        empty.className = "bz-path-picker-empty";
        empty.textContent = "没有匹配的目录";
        listEl.appendChild(empty);
      } else if (total > LIMIT2) {
        const more = document.createElement("div");
        more.className = "bz-path-picker-empty";
        more.textContent = `已显示前 ${LIMIT2} 个（共 ${total} 个匹配目录），请输入关键词缩小范围`;
        listEl.appendChild(more);
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
      renderList();
    };
    try {
      const files = ((_c = (_b2 = (_a2 = app == null ? void 0 : app.vault) == null ? void 0 : _a2.getFiles) == null ? void 0 : _b2.call(_a2)) != null ? _c : []).map((f) => f.path);
      state.folders = foldersFromFiles(files);
    } catch (e) {
    }
    void collectVaultFolders(app).then((folders) => {
      if (!mask.isConnected) return;
      state.folders = folders;
      popup.dataset.ready = "1";
      renderList();
    });
    renderList();
    updateSel();
    popup.append(head, search, listEl, foot);
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
    var _a2;
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
    const renderTextualRow = (body, row) => {
      var _a3;
      const ctx = { rowEl: body, refreshVisibility: reevaluate };
      const setting = new Setting(body).setName(row.name);
      if (row.desc) setting.setDesc(row.desc);
      if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
      const isNumber = row.type === "number";
      const acc = isNumber ? bindValue(row.binding) : bindValue(row.binding);
      const changeCb = row.onChange;
      const initial = String((_a3 = acc.read()) != null ? _a3 : "");
      let pending = null;
      let last = initial;
      let dirty = false;
      const warn = new CommitWarn(initial, row.onCommit);
      const commit = () => {
        if (pending !== null) {
          clearTimeout(pending);
          pending = null;
        }
        if (!dirty) return;
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
          dirty = true;
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
                dirty = false;
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
                var _a4;
                await a.onClick(last, ctx);
                if (currentText && currentText.setValue) {
                  dirty = false;
                  currentText.setValue(String((_a4 = acc.read()) != null ? _a4 : ""));
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
      var _a3, _b2, _c;
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
              var _a4;
              const v = multi ? list : (list[0] || "").trim().replace(/^\/+|\/+$/g, "");
              acc.write(v);
              void acc.persist();
              const res = (_a4 = row.onChange) == null ? void 0 : _a4.call(row, list, ctx);
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
          const setting = new Setting(body).setName(row.name);
          if (row.desc) setting.setDesc(row.desc);
          if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
          setting.addToggle(
            (t) => t.setValue(acc.read() === true).onChange(async (v) => {
              var _a4;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a4 = row.onChange) == null ? void 0 : _a4.call(row, v, ctx);
            })
          );
          return;
        }
        case "select": {
          const acc = bindValue(row.binding);
          const setting = new Setting(body).setName(row.name);
          if (row.desc) setting.setDesc(row.desc);
          if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
          setting.addDropdown((dd) => {
            var _a4;
            for (const opt of row.options) dd.addOption(opt.value, opt.label);
            dd.setValue(String((_a4 = acc.read()) != null ? _a4 : "") || row.options[0].value);
            dd.onChange(async (v) => {
              var _a5;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a5 = row.onChange) == null ? void 0 : _a5.call(row, v, ctx);
            });
          });
          return;
        }
        case "choiceCards": {
          const acc = bindValue(row.binding);
          const setting = new Setting(body).setName(row.name);
          if (row.desc) setting.setDesc(row.desc);
          if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
          const pick = uiCardChoice({
            value: String((_a3 = acc.read()) != null ? _a3 : "") || row.options[0].value,
            options: row.options,
            label: row.name,
            onChange: async (v) => {
              var _a4;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a4 = row.onChange) == null ? void 0 : _a4.call(row, v, ctx);
            }
          });
          setting.controlEl.appendChild(pick.el);
          return;
        }
        case "slider": {
          const acc = bindValue(row.binding);
          const setting = new Setting(body).setName(row.name);
          if (row.desc) setting.setDesc(row.desc);
          if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
          setting.addSlider((sl) => {
            var _a4;
            sl.setLimits(row.min, row.max, (_a4 = row.step) != null ? _a4 : 1);
            sl.setValue(Number(acc.read()) || 0);
            sl.setDynamicTooltip();
            sl.onChange(async (v) => {
              var _a5;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a5 = row.onChange) == null ? void 0 : _a5.call(row, v, ctx);
            });
          });
          for (const a of (_b2 = row.actions) != null ? _b2 : []) {
            setting.addButton((b) => {
              if (a.cta) b.setCta();
              b.setButtonText(a.text).onClick(() => void a.onClick(void 0, ctx));
            });
          }
          return;
        }
        case "button": {
          const setting = new Setting(body).setName(row.name);
          if (row.desc) setting.setDesc(row.desc);
          if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
          setting.addButton((b) => {
            if (row.cta) b.setCta();
            b.setButtonText(row.buttonText).onClick(() => row.onClick(ctx));
          });
          setting.settingEl.classList.add("bz-setting-action-row");
          return;
        }
        case "info": {
          const setting = new Setting(body).setName(row.name);
          if (row.desc) setting.setDesc(row.desc);
          if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
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
                  var _a4;
                  const remaining = readItems().map((x) => x.key).filter((k) => k !== it.key);
                  await ((_a4 = row.onChange) == null ? void 0 : _a4.call(row, remaining, ctx));
                  renderItems();
                  reevaluate();
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
      var _a3, _b2;
      const firstToggleKey = (_b2 = (_a3 = rows.find((r) => r.type === "toggle" && "key" in r.binding)) == null ? void 0 : _a3.binding.key) != null ? _b2 : null;
      for (const row of rows) renderRow(body, row, firstToggleKey);
    };
    for (const group of schema.groups) {
      if (group.icon) {
        const body = createSettingsGroup(container, { icon: group.icon, name: group.name });
        const groupEl = (_a2 = body.parentElement) != null ? _a2 : container;
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
      init_ui();
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
    var _a2;
    if (currentModal) {
      const m = currentModal;
      currentModal = null;
      m.dispose();
      (_a2 = m.onClose) == null ? void 0 : _a2.call(m);
    }
  }
  function openSettingsModal(opts) {
    var _a2;
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
    renderSettingsInto(content, (_a2 = opts.schema) != null ? _a2 : { groups: [] });
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
    var _a2;
    const prev = (_a2 = fileTaskQueues.get(filePath)) != null ? _a2 : Promise.resolve();
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
  var fileTaskQueues, CORRUPT_BACKUP_DIR;
  var init_storage = __esm({
    "src/core/storage.ts"() {
      init_app();
      init_settings_provider();
      init_notice();
      fileTaskQueues = /* @__PURE__ */ new Map();
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
  function parsePathList(raw) {
    if (raw === null || raw === void 0) return [];
    const out = [];
    for (const part of String(raw).split(",")) {
      const p = part.trim().replace(/^\/+|\/+$/g, "");
      if (p && !out.includes(p)) out.push(p);
    }
    return out;
  }
  function formatPathList(list) {
    return normalizeSelection(list).join(",");
  }
  function normalizeSelection(list) {
    const cleaned = [];
    for (const item of list) {
      const p = String(item).trim().replace(/^\/+|\/+$/g, "");
      if (p && !cleaned.includes(p)) cleaned.push(p);
    }
    return cleaned.filter((p) => !cleaned.some((other) => other !== p && p.startsWith(other + "/")));
  }
  var init_whitelist = __esm({
    "src/secondbrain/whitelist.ts"() {
    }
  });

  // src/secondbrain/local-ip.ts
  function isUsableLanIp(ip) {
    if (!ip) return false;
    if (ip.includes(":")) return false;
    if (ip.startsWith("127.") || ip.startsWith("169.254.")) return false;
    return true;
  }
  function enumerateLanIPs(interfaces) {
    const list = [];
    if (!interfaces) return list;
    for (const [iface, addrs] of Object.entries(interfaces)) {
      for (const a of addrs || []) {
        if (a.internal) continue;
        if (isUsableLanIp(a.address)) list.push({ iface, ip: a.address });
      }
    }
    return list;
  }
  function getLanIPs() {
    try {
      const os = window.require && window.require("os");
      if (!os || typeof os.networkInterfaces !== "function") return [];
      return enumerateLanIPs(os.networkInterfaces());
    } catch (e) {
      return [];
    }
  }
  function formatRemoteOllamaUrl(ip, port = 11434) {
    return `http://${ip}:${port}`;
  }
  function ifaceMatches(iface, keyword) {
    if (keyword !== keyword.toLowerCase()) return iface.toLowerCase().includes(keyword.toLowerCase());
    return new RegExp(`\\b${keyword}\\b`, "i").test(iface);
  }
  function pickPrimaryLanIp(list) {
    if (!list.length) return null;
    const hit = list.find((l) => PREFERRED_IFACE_KEYWORDS.some((k) => ifaceMatches(l.iface, k)));
    return hit || list[0];
  }
  var PREFERRED_IFACE_KEYWORDS;
  var init_local_ip = __esm({
    "src/secondbrain/local-ip.ts"() {
      PREFERRED_IFACE_KEYWORDS = ["wlan", "wi-fi", "wifi", "wireless", "ethernet", "以太网", "有线"];
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
    const panel3 = d.panel && typeof d.panel === "object" ? d.panel : null;
    return {
      version: d.version === STORE_VERSION ? STORE_VERSION : void 0,
      meta: d.meta && typeof d.meta === "object" ? d.meta : {},
      panel: panel3,
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
    const store3 = emptyStore();
    for (const name of LEGACY_FILES) {
      const legacyPath = storeDir() + "/" + name;
      const raw = await readJsonIfExists(app, legacyPath).catch(() => null);
      if (raw === null) continue;
      anyLegacy = true;
      if (name === "secondbrain_meta.json" && raw && typeof raw === "object") store3.meta = raw;
      else if (name === "secondbrain_panel.json" && raw && typeof raw === "object") store3.panel = raw;
      else if (name === "secondbrain_link_queue.json") {
        if (Array.isArray(raw)) store3.link.queue = raw;
      } else if (name === "secondbrain_link_state.json") {
        if (raw && typeof raw === "object" && !Array.isArray(raw)) store3.link.state = raw;
      }
    }
    if (!anyLegacy) return false;
    await adapter.write(storePath, JSON.stringify(store3));
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
    let panel3 = primary.panel;
    if (conflict.panel && (!panel3 || conflict.panel.generatedAt > panel3.generatedAt)) panel3 = conflict.panel;
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
    return { version: primary.version, meta, panel: panel3, link: { queue, state }, chatHistory: chatTrimmed };
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
  async function reconcileConflicts(a, store3) {
    var _a2;
    const adapter = (_a2 = a == null ? void 0 : a.vault) == null ? void 0 : _a2.adapter;
    if (!adapter || typeof adapter.list !== "function") return store3;
    let listed = [];
    try {
      const r = await adapter.list(storeDir());
      listed = Array.isArray(r == null ? void 0 : r.files) ? r.files : [];
    } catch (e) {
      return store3;
    }
    const conflictJson = listed.filter((f) => isConflictJsonName(f.split("/").pop() || f));
    const conflictVec = listed.filter((f) => isConflictVecName(f.split("/").pop() || f));
    if (!conflictJson.length && !conflictVec.length) return store3;
    const primaryMeta = store3.meta;
    const conflictMetas = [];
    let merged = store3;
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
    const store3 = await readStoreRawInner(a);
    return reconcileConflicts(a, store3);
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
      const store3 = await readStoreRaw(app);
      fn(store3);
      await saveStoreRaw(store3, app);
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
      <button class="bz-sb-panel-func bz-sb-fbtn" id="bz-sb-open-chat">${ic("message-square", 14)}AI 对话</button>
      <button class="bz-sb-panel-func bz-sb-fbtn" id="bz-sb-open-ref">${ic("radar", 14)}灵感参考</button>
      <button class="bz-sb-panel-gear bz-sb-fbtn bz-sb-fbtn--icon" id="bz-sb-open-settings" aria-label="第二大脑设置">${ic("settings", 14)}</button>
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
        <button class="bz-sb-fbtn bz-sb-fbtn--primary" id="bz-sb-incr">${ic("refresh-cw", 14)}增量更新</button>
        <button class="bz-sb-fbtn" id="bz-sb-rebuild">${ic("database", 14)}全量重建</button>
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
  function panelDistHtml(nodes, expanded, colorOf2, maxChunks, depth = 0) {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const open = expanded.has(node.path);
      const row = `<div class="bz-sb-dist-row${hasChildren ? " bz-sb-dist-row--dir" : ""}" data-path="${escapeHtml2(node.path)}" style="padding-left:${10 + depth * 16}px"><span class="bz-sb-dist-caret${hasChildren ? "" : " bz-sb-dist-caret--leaf"}">${hasChildren ? ic("chevron-right", 12) : ""}</span><span class="bz-sb-dist-name">${escapeHtml2(node.name)}</span><span class="bz-sb-dist-bar"><span class="bz-sb-dist-fill" style="width:${Math.round(node.chunks / maxChunks * 100)}%;background:${colorOf2(node.name)}"></span></span><span class="bz-sb-dist-num">${node.notes} 篇 / ${node.chunks} 段</span></div>`;
      const kids = hasChildren && open ? panelDistHtml(node.children, expanded, colorOf2, maxChunks, depth + 1) : "";
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
  function chatShellHtml(topK, model) {
    return `
  <div class="bz-sb-chat-head">
    <div class="bz-sb-glyph bz-sb-chat-glyph">${ic("brain", 17)}</div>
    <div class="bz-sb-head-title">
      <h3>AI 对话</h3>
      <div class="bz-sb-cnt">以库为底作答 · 单次检索 ${topK} 条相关段落</div>
    </div>
    <div class="bz-sb-head-sp"></div>
    <div class="bz-sb-chat-model">${ic("sparkles", 11)}${escapeHtml2(model)}</div>
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

  // src/secondbrain/binary.ts
  var MobileBuffer;
  var init_binary = __esm({
    "src/secondbrain/binary.ts"() {
      MobileBuffer = class _MobileBuffer {
        constructor(data) {
          this._data = data;
          this._view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        }
        static alloc(size) {
          return new _MobileBuffer(new Uint8Array(size));
        }
        static concat(parts) {
          const arrays = parts.map((p) => p instanceof _MobileBuffer ? p._data : p);
          const total = arrays.reduce((s, a) => s + a.byteLength, 0);
          const out = new Uint8Array(total);
          let offset = 0;
          for (const a of arrays) {
            out.set(a, offset);
            offset += a.byteLength;
          }
          return new _MobileBuffer(out);
        }
        writeUInt32LE(value, offset) {
          this._view.setUint32(offset, value, true);
        }
      };
    }
  });

  // src/secondbrain/chunk.ts
  function stripFrontmatter(text) {
    return text.replace(FRONTMATTER_RE, "");
  }
  function noteTitleFromPath(path) {
    return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  }
  function embedChunks(content, title, minChunk = 50) {
    const body = stripFrontmatter(content);
    const chunks = smartChunk(body, minChunk);
    if (chunks.length === 0 && body.trim().length > 0) chunks.push(body.trim().slice(0, CHUNK_SIZE));
    if (chunks.length > 0 && title) chunks[0] = title + "\n" + chunks[0];
    return chunks;
  }
  function smartChunk(text, minChunk = 50) {
    const blocks = text.split(/\n\s*\n/);
    const chunks = [];
    let buffer = "";
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      if ((buffer + "\n" + trimmed).length <= CHUNK_SIZE) {
        buffer = buffer ? buffer + "\n" + trimmed : trimmed;
      } else {
        if (buffer.length >= minChunk) chunks.push(buffer);
        buffer = "";
        if (trimmed.length > CHUNK_SIZE) {
          const sentences = trimmed.split(SENTENCE_BOUNDARY);
          let sbuf = "";
          for (const s of sentences) {
            if ((sbuf + s).length > CHUNK_SIZE) {
              if (sbuf.length >= minChunk) chunks.push(sbuf.trim());
              sbuf = s;
            } else {
              sbuf += s;
            }
          }
          if (sbuf.trim().length >= minChunk) chunks.push(sbuf.trim());
        } else {
          buffer = trimmed;
        }
      }
    }
    if (buffer.trim().length >= minChunk) chunks.push(buffer.trim());
    return chunks;
  }
  var CHUNK_SIZE, SENTENCE_BOUNDARY, FRONTMATTER_RE;
  var init_chunk = __esm({
    "src/secondbrain/chunk.ts"() {
      CHUNK_SIZE = 256;
      SENTENCE_BOUNDARY = /[。！？!?\n]+/;
      FRONTMATTER_RE = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
    }
  });

  // src/secondbrain/vptree.ts
  function euclideanSq(a, b) {
    let sum = 0;
    const n = a.length;
    for (let i = 0; i < n; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return sum;
  }
  function normalizeVec(v) {
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return Array.from(v);
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
    return out;
  }
  function vptree_build(items, idxs) {
    if (idxs.length === 0) return null;
    return buildRecursive(idxs, 0);
    function buildRecursive(idxList, depth) {
      if (idxList.length === 0) return null;
      if (idxList.length === 1) {
        return { idx: idxList[0], mu: 0, minD: 0, maxD: 0, left: null, right: null };
      }
      const vpIdx = idxList[depth % idxList.length];
      const vp = items[vpIdx];
      const dists = idxList.map((i) => ({ i, d: euclideanSq(items[i], vp) })).sort((a, b) => a.d - b.d);
      const mid = dists.length >> 1;
      return {
        idx: vpIdx,
        mu: dists[mid].d,
        minD: dists[0].d,
        maxD: dists[dists.length - 1].d,
        left: buildRecursive(
          dists.slice(0, mid).map((x) => x.i),
          depth + 1
        ),
        right: buildRecursive(
          dists.slice(mid).map((x) => x.i),
          depth + 1
        )
      };
    }
  }
  function vptree_search(node, items, query, k) {
    let best = [];
    let tau = Infinity;
    (function searchNode(n) {
      if (!n) return;
      const d = euclideanSq(query, items[n.idx]);
      if (d < tau) {
        best.push({ idx: n.idx, dist: d });
        if (best.length > k) {
          best.sort((a, b) => a.dist - b.dist);
          best.pop();
          tau = best[best.length - 1].dist;
        }
      }
      const diff = d - n.mu;
      const first = diff < 0 ? n.left : n.right;
      const second = diff < 0 ? n.right : n.left;
      searchNode(first);
      if (second && n.minD - tau <= diff && diff <= n.maxD + tau) {
        searchNode(second);
      }
    })(node);
    return best.sort((a, b) => a.dist - b.dist);
  }
  var init_vptree = __esm({
    "src/secondbrain/vptree.ts"() {
    }
  });

  // src/secondbrain/parallel.ts
  async function parallelMap(array, initConcurrency, asyncFn) {
    const results = [];
    let index = 0;
    const inProgress = /* @__PURE__ */ new Set();
    let concurrency = initConcurrency;
    let emaMs = 0;
    const ALPHA = 0.3;
    let minLatency = Infinity;
    let rampUpDone = false;
    return new Promise((resolve) => {
      function next() {
        if (index >= array.length && inProgress.size === 0) {
          resolve(results);
          return;
        }
        while (index < array.length && inProgress.size < concurrency) {
          const i = index++;
          const t0 = Date.now();
          const promise = asyncFn(array[i], i).then((result) => {
            const ms = Date.now() - t0;
            emaMs = emaMs ? ALPHA * ms + (1 - ALPHA) * emaMs : ms;
            if (ms < minLatency) minLatency = ms;
            if (!rampUpDone && emaMs < minLatency * 1.3 && concurrency < 60) concurrency++;
            if (!rampUpDone && emaMs > minLatency * 1.5) {
              rampUpDone = true;
              console.log(`[secondbrain] 并发锁定: ${concurrency}, 均延迟: ${Math.round(emaMs)}ms`);
            }
            results[i] = result;
          }).catch((err) => {
            var _a2;
            results[i] = { error: String((_a2 = err == null ? void 0 : err.message) != null ? _a2 : err) };
          }).finally(() => {
            inProgress.delete(promise);
            next();
          });
          inProgress.add(promise);
        }
      }
      next();
    });
  }
  var init_parallel = __esm({
    "src/secondbrain/parallel.ts"() {
    }
  });

  // src/secondbrain/tfidf.ts
  var TFIDF_STOP_WORDS, STOP_SET, TFIDF;
  var init_tfidf = __esm({
    "src/secondbrain/tfidf.ts"() {
      TFIDF_STOP_WORDS = "的了是在我有和人这中大为上个国不以到说时要就出会也年对自其他里去子后也得着与把等";
      STOP_SET = new Set(TFIDF_STOP_WORDS);
      TFIDF = class _TFIDF {
        constructor() {
          this.docs = [];
          this.df = /* @__PURE__ */ new Map();
          this.N = 0;
          this.avgDl = 1;
        }
        static tokenize(text) {
          const tokens = [];
          const cjk = text.match(/[一-鿿]/g) || [];
          const eng = text.toLowerCase().match(/[a-z]{2,}/g) || [];
          for (const c of cjk) {
            if (!STOP_SET.has(c)) tokens.push(c);
          }
          for (const w of eng) {
            if (!STOP_SET.has(w)) tokens.push(w);
          }
          return tokens;
        }
        /** docs 必须是 chunk 粒度（path=所属笔记路径，text=chunk 原文） */
        build(docs) {
          this.docs = [];
          this.df = /* @__PURE__ */ new Map();
          let totalLen = 0;
          for (const doc of docs) {
            const tokens = _TFIDF.tokenize(doc.text);
            if (!tokens.length) continue;
            const tf = /* @__PURE__ */ new Map();
            for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
            const seen = new Set(tokens);
            for (const t of seen) this.df.set(t, (this.df.get(t) || 0) + 1);
            this.docs.push({ path: doc.path, text: doc.text, tf, len: tokens.length });
            totalLen += tokens.length;
          }
          this.N = this.docs.length;
          this.avgDl = this.N > 0 ? totalLen / this.N : 1;
        }
        /** BM25 式检索；返回含 chunk 原文，最高分归一化 */
        search(query, topK = 20) {
          if (!this.N || !query) return [];
          const qTokens = _TFIDF.tokenize(query);
          if (!qTokens.length) return [];
          const k1 = 1.5;
          const b = 0.75;
          const scores = [];
          for (const doc of this.docs) {
            let score = 0;
            for (const qt of qTokens) {
              const tf = doc.tf.get(qt);
              if (!tf) continue;
              const df = this.df.get(qt) || 0;
              const idf = Math.log((this.N - df + 0.5) / (df + 0.5) + 1);
              const tfNorm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * doc.len / this.avgDl));
              score += idf * tfNorm;
            }
            if (score > 0) scores.push({ path: doc.path, chunk: doc.text, score });
          }
          scores.sort((a, b2) => b2.score - a.score);
          if (scores.length > 0 && scores[0].score > 0) {
            const maxS = scores[0].score;
            for (const s of scores) s.score = s.score / maxS;
          }
          return scores.slice(0, topK);
        }
      };
    }
  });

  // src/secondbrain/text-search.ts
  function extractTerms(q) {
    const terms = [];
    const cjk = q.match(/[一-鿿]/g) || [];
    const eng = q.toLowerCase().match(/[a-z]{2,}/g) || [];
    for (const c of cjk) {
      if (!STOP_WORDS.has(c)) terms.push(c);
    }
    for (const w of eng) {
      if (!STOP_WORDS.has(w)) terms.push(w);
    }
    if (terms.length === 0) terms.push(q.toLowerCase());
    return terms;
  }
  function searchTextIndex(query, notes, topK = 20) {
    const q = query.trim();
    if (!q) return [];
    const noteCount = Object.keys(notes).length;
    let chunkCount = 0;
    for (const n of Object.values(notes)) chunkCount += n.chunks.length;
    console.log(`[文本检索] query="${q}" notes=${noteCount} chunks=${chunkCount}`);
    if (noteCount === 0) return [];
    const terms = extractTerms(q);
    const qLower = q.toLowerCase();
    const results = [];
    for (const [path, note] of Object.entries(notes)) {
      for (const chunk of note.chunks) {
        const text = chunk.text || "";
        if (!text) continue;
        const lower = text.toLowerCase();
        let score = 0;
        if (lower.includes(qLower)) {
          score = 0.7 + 0.3 * Math.min(1, q.length / text.length);
        } else {
          let matched = 0;
          let totalFreq = 0;
          for (const term of terms) {
            const idx = lower.indexOf(term);
            if (idx !== -1) {
              matched++;
              let freq = 0;
              let pos = 0;
              while ((pos = lower.indexOf(term, pos)) !== -1) {
                freq++;
                pos += term.length;
              }
              totalFreq += freq;
            }
          }
          if (matched === 0) continue;
          const hitRate = matched / terms.length;
          const avgFreq = totalFreq / matched;
          const freqScore = Math.min(1, avgFreq / 5);
          const coverLen = terms.filter((t) => lower.includes(t)).reduce((s, t) => s + t.length, 0);
          const density = Math.min(1, coverLen / Math.max(1, text.length) * 10);
          score = hitRate * 0.5 + freqScore * 0.25 + density * 0.25;
        }
        if (text.length < 20) score *= 0.7;
        if (score > 0.25) {
          results.push({ path, chunk: text, score });
        }
      }
    }
    const seen = /* @__PURE__ */ new Set();
    const deduped = [];
    for (const item of results.sort((a, b) => b.score - a.score)) {
      const key = item.path + "::" + item.chunk;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    const final = deduped.slice(0, topK);
    console.log(`[文本检索] 命中 ${results.length} 条，去重后 ${deduped.length} 条，返回 ${final.length} 条`);
    return final;
  }
  var STOP_WORDS;
  var init_text_search = __esm({
    "src/secondbrain/text-search.ts"() {
      STOP_WORDS = new Set("的了是在我有和人这中大为上个国不以到说时要就出会也年对自其");
    }
  });

  // src/secondbrain/ollama.ts
  async function httpFetch(url, opts, timeoutMs = EMBED_TIMEOUT_MS) {
    const controller2 = new AbortController();
    const timer = setTimeout(() => controller2.abort(), timeoutMs);
    try {
      return await fetch(url, { ...opts, signal: controller2.signal });
    } catch (e) {
      if (controller2.signal.aborted) {
        throw new Error(`Ollama 无响应（超过 ${timeoutMs / 1e3}s 未应答）：${url}`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  async function getEmbedding(text, isQuery, baseUrl, model) {
    const CONFIG = buildConfig();
    const url = baseUrl || CONFIG.OLLAMA_URL;
    const prompt = isQuery ? `Represent this sentence for searching relevant passages: ${text}` : text;
    const resp = await httpFetch(`${url}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || CONFIG.EMBEDDING_MODEL, prompt })
    });
    if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
    const data = await resp.json();
    const vec = data.embedding;
    if (!vec || !vec.length) throw new Error("向量为空");
    return vec;
  }
  async function getEmbeddingsBatch(texts, baseUrl) {
    const CONFIG = buildConfig();
    const resp = await httpFetch(`${baseUrl || CONFIG.OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: CONFIG.EMBEDDING_MODEL, input: texts })
    });
    if (!resp.ok) throw new Error(`Ollama 错误: ${resp.status}`);
    const data = await resp.json();
    const vec = data.embeddings;
    if (!vec || !vec.length) throw new Error("向量为空");
    return vec;
  }
  async function checkRemoteOllama(url) {
    try {
      const resp = await httpFetch(`${url}/api/tags`, { method: "GET" });
      return resp.ok;
    } catch (e) {
      return false;
    }
  }
  var EMBED_BATCH_SIZE, EMBED_TIMEOUT_MS, SEARCH_TIMEOUT_MS;
  var init_ollama = __esm({
    "src/secondbrain/ollama.ts"() {
      init_config();
      EMBED_BATCH_SIZE = 64;
      EMBED_TIMEOUT_MS = 3e4;
      SEARCH_TIMEOUT_MS = 1e4;
    }
  });

  // src/secondbrain/vector-store.ts
  var VECTOR_STORE_VERSION, CHECKPOINT_POLICY, VectorStore;
  var init_vector_store = __esm({
    "src/secondbrain/vector-store.ts"() {
      init_config();
      init_store_file();
      init_binary();
      init_chunk();
      init_vptree();
      init_parallel();
      init_tfidf();
      init_text_search();
      init_ollama();
      init_utils();
      VECTOR_STORE_VERSION = 9;
      CHECKPOINT_POLICY = { minIntervalMs: 5e3, minNewChunks: 200 };
      VectorStore = class {
        constructor(app) {
          this.meta = { version: VECTOR_STORE_VERSION, notes: {}, _dim: 0 };
          this.vectors = new Float32Array(0);
          this.dim = 0;
          this.tfidf = new TFIDF();
          this.searchMode = "text";
          this.updateProgress = () => {
          };
          /** 初始 load 完成信号（域入口注入；主面板打开时等待，防启动竞态误入引导态——ticket 107） */
          this.initialLoad = null;
          /** VP 索引缓存：树 + 归一化向量 + 缓存键 + 来源数组身份（内容变更即失效） */
          this.vpTree = null;
          this.vpVecs = null;
          this.vpMetaKey = null;
          this.vpSrc = null;
          /** 进行中的 refresh（并发去重：重复调用复用同一 promise，ticket 107） */
          this.refreshPromise = null;
          this.app = app;
        }
        get notes() {
          return this.meta.notes;
        }
        async load() {
          const data = await loadStore(this.app);
          const parsed = data.meta;
          if (parsed && typeof parsed === "object" && parsed.version === VECTOR_STORE_VERSION) {
            this.meta = parsed;
            this.dim = parsed._dim || 0;
            await this.loadVectors();
            return;
          }
          if (parsed && typeof parsed === "object") {
            console.log(`[secondbrain] 向量库版本升级: ${parsed.version || 0} → ${VECTOR_STORE_VERSION}，触发重建`);
          }
          this.meta = { version: VECTOR_STORE_VERSION, notes: {}, _dim: 0 };
          this.vectors = new Float32Array(0);
          this.dim = 0;
        }
        async loadVectors() {
          const CONFIG = buildConfig();
          try {
            const buf = await this.app.vault.adapter.readBinary(CONFIG.VEC_PATH);
            const arr = new Uint8Array(buf);
            const dim = new DataView(arr.buffer, arr.byteOffset, 4).getUint32(0, true);
            const payload = arr.slice(4);
            this.vectors = new Float32Array(payload.buffer, payload.byteOffset, payload.byteLength >> 2);
            this.dim = dim;
          } catch (e) {
            this.vectors = new Float32Array(0);
            this.dim = 0;
          }
        }
        /**
         * 索引是否就绪（ticket 107）：meta 有条目且向量已装载。
         * 空库 / meta 残留但 .vec 丢失（损坏态）返回 false——主面板据此进入引导态，
         * 参考侧边栏与 AI 对话命令据此统一转开主面板。
         */
        isIndexReady() {
          return Object.keys(this.meta.notes).length > 0 && this.vectors.length > 0 && this.dim > 0;
        }
        /** 是否有 refresh 正在进行（ticket 114）：主面板重开时据此恢复进度视图而非引导死按钮 */
        isRefreshing() {
          return this.refreshPromise !== null;
        }
        /** 白名单过滤后的 md 文件列表（doRefresh / hasPendingChanges / 主面板覆盖率共用） */
        whitelistedFiles() {
          const CONFIG = buildConfig();
          const allowPaths = CONFIG.ALLOW_PATHS || [];
          return this.app.vault.getMarkdownFiles().filter((f) => {
            if (allowPaths.length === 0) return false;
            for (const allow of allowPaths) {
              if (f.path.startsWith(allow + "/") || f.path === allow) return true;
            }
            return false;
          });
        }
        /**
         * 是否有增量索引待处理项（ticket 108）：新文件 / mtime 变化 / 已删除文件，任一即 true。
         * 主面板打开时据此决定是否显示增量索引进度视图（纯扫描不读文件内容，开销可忽略）。
         */
        hasPendingChanges() {
          const files = this.whitelistedFiles();
          const filePaths = new Set(files.map((f) => f.path));
          for (const path of Object.keys(this.meta.notes)) {
            if (!filePaths.has(path)) return true;
          }
          for (const f of files) {
            const entry = this.meta.notes[f.path];
            if (!entry || entry.mtime !== f.stat.mtime) return true;
          }
          return false;
        }
        /**
         * 全量重建（ticket 108「重新索引」）：清空元数据与向量后整库重嵌。
         * 先等待进行中的 refresh 结束再清空，避免与增量刷新交错写坏布局。
         */
        async rebuildAll(updateProgress2) {
          if (this.refreshPromise) {
            try {
              await this.refreshPromise;
            } catch (e) {
            }
          }
          this.meta.notes = {};
          this.vectors = new Float32Array(0);
          this.dim = 0;
          this.meta._dim = 0;
          this.vpTree = null;
          this.vpVecs = null;
          this.vpMetaKey = null;
          this.vpSrc = null;
          await this.refresh(updateProgress2);
        }
        async saveVectors() {
          const CONFIG = buildConfig();
          const dim = this.dim;
          const header = MobileBuffer.alloc(4);
          header.writeUInt32LE(dim, 0);
          const payload = new Uint8Array(this.vectors.buffer, this.vectors.byteOffset, this.vectors.byteLength);
          const data = MobileBuffer.concat([header._data, payload]);
          try {
            const adapter = this.app.vault.adapter;
            if (typeof (adapter == null ? void 0 : adapter.readBinary) === "function") {
              const cur = new Uint8Array(await adapter.readBinary(CONFIG.VEC_PATH));
              if (bytesEqual(cur, data._data)) return;
            }
          } catch (e) {
          }
          await this.app.vault.adapter.writeBinary(CONFIG.VEC_PATH, data._data.buffer);
        }
        async saveStore() {
          await mutateStore(
            (s) => {
              s.meta = this.meta;
            },
            this.app
          );
        }
        /**
         * 按 meta.notes 当前键序紧凑重排向量段并落盘。
         * @param srcOffsets 删除前布局的 path→行偏移；无源偏移的条目（理论不出现在删除-only 路径）跳过其向量段。
         */
        async compactAndSave(srcOffsets) {
          const dim = this.dim;
          if (dim > 0) {
            let total = 0;
            for (const note of Object.values(this.meta.notes)) total += note.chunks.length;
            const merged = new Float32Array(total * dim);
            let offset = 0;
            for (const [path, note] of Object.entries(this.meta.notes)) {
              const srcRow = srcOffsets.get(path);
              if (srcRow === void 0) continue;
              const count = note.chunks.length;
              merged.set(this.vectors.subarray(srcRow * dim, srcRow * dim + count * dim), offset);
              offset += count * dim;
            }
            this.vectors = merged;
            await this.saveVectors();
          }
          await this.saveStore();
        }
        /**
         * 合并写回（ticket 114：最终写回与中途断点暂存共用同一实现）。
         * 按 meta.notes 当前键序重建整段向量：本轮新完成文件（embedded）写入新嵌入向量，
         * 未变文件按「删除前」源偏移从 srcVectors（本轮开始时的原始缓冲，永不原地改写）拷贝旧段，
         * 随后 saveVectors + saveStore。中间无论暂存多少次，最终布局与一次到位完全一致。
         */
        async mergeWrite(srcVectors, srcOffsets, embedded, dim) {
          if (dim > 0) {
            let totalVecs = 0;
            for (const note of Object.values(this.meta.notes)) totalVecs += note.chunks.length;
            const merged = new Float32Array(totalVecs * dim);
            let offset = 0;
            for (const [path, note] of Object.entries(this.meta.notes)) {
              const vecs = embedded.get(path);
              if (vecs) {
                for (const v of vecs) {
                  merged.set(v, offset);
                  offset += v.length;
                }
              } else {
                const srcRow = srcOffsets.get(path);
                if (srcRow === void 0) continue;
                const srcStart = srcRow * dim;
                merged.set(srcVectors.subarray(srcStart, srcStart + note.chunks.length * dim), offset);
                offset += note.chunks.length * dim;
              }
            }
            this.vectors = merged;
            this.dim = dim;
            this.meta._dim = dim;
            await this.saveVectors();
          }
          await this.saveStore();
        }
        /** 增量重建向量库（并发去重：进行中重复调用复用同一 promise——ticket 107） */
        refresh(updateProgress2) {
          if (updateProgress2) this.updateProgress = updateProgress2;
          if (this.refreshPromise) return this.refreshPromise;
          this.refreshPromise = this.doRefresh().finally(() => {
            this.refreshPromise = null;
          });
          return this.refreshPromise;
        }
        async doRefresh() {
          const CONFIG = buildConfig();
          const allowPaths = CONFIG.ALLOW_PATHS || [];
          const allFiles = this.app.vault.getMarkdownFiles();
          const files = this.whitelistedFiles();
          console.log(`[secondbrain] 全库 ${allFiles.length} 篇，白名单 [${allowPaths}] → 过滤后 ${files.length} 篇`);
          const srcOffsets = /* @__PURE__ */ new Map();
          let srcOff = 0;
          for (const [path, note] of Object.entries(this.meta.notes)) {
            srcOffsets.set(path, srcOff);
            srcOff += note.chunks.length;
          }
          if (files.length === 0) {
            if (Object.keys(this.meta.notes).length > 0) {
              this.meta.notes = {};
              this.vectors = new Float32Array(0);
              this.dim = 0;
              this.meta._dim = 0;
              await this.saveVectors();
              await this.saveStore();
              this.updateProgress("✅ 向量库已清空（白名单为空）");
            } else {
              this.updateProgress("⚠️ 没有符合条件的文件");
            }
            return;
          }
          const filePaths = new Set(files.map((f) => f.path));
          let deleted = 0;
          for (const path of Object.keys(this.meta.notes)) {
            if (!filePaths.has(path)) {
              delete this.meta.notes[path];
              deleted++;
            }
          }
          const indexIncomplete = Object.keys(this.meta.notes).length > 0 && (this.vectors.length === 0 || !this.dim);
          let vectors = this.vectors;
          let dim = this.meta._dim || this.dim || 0;
          if (srcOff === 0 || indexIncomplete) {
            vectors = new Float32Array(0);
            dim = 0;
          }
          let toProcess = files.filter((f) => {
            const entry = this.meta.notes[f.path];
            return !entry || entry.mtime !== f.stat.mtime;
          });
          if (indexIncomplete) toProcess = files.slice();
          if (toProcess.length === 0) {
            if (deleted > 0) {
              await this.compactAndSave(srcOffsets);
              this.updateProgress(`✅ 向量库已最新（清理 ${deleted} 个失效条目）`);
            } else {
              this.updateProgress("✅ 向量库已最新");
            }
            return;
          }
          const minChunk = CONFIG.CHUNK_MIN_LENGTH || 50;
          const fileChunksMap = /* @__PURE__ */ new Map();
          const globalTasks = [];
          for (const file of toProcess) {
            try {
              const content = await this.app.vault.read(file);
              const chunks = embedChunks(content, noteTitleFromPath(file.path), minChunk);
              fileChunksMap.set(file.path, chunks.map(() => null));
              chunks.forEach((text, idx) => globalTasks.push({ filePath: file.path, chunkIdx: idx, text }));
            } catch (err) {
              console.error(`[secondbrain] 读取失败 [${file.path}]`, err);
              delete this.meta.notes[file.path];
            }
          }
          if (globalTasks.length === 0) {
            this.updateProgress("✅ 向量化完成（无新内容）");
            return;
          }
          const embedBase = IS_MOBILE ? CONFIG.OLLAMA_REMOTE_URL || CONFIG.OLLAMA_URL : CONFIG.OLLAMA_URL;
          const batches = [];
          for (let i = 0; i < globalTasks.length; i += EMBED_BATCH_SIZE) {
            batches.push(globalTasks.slice(i, i + EMBED_BATCH_SIZE));
          }
          let processed = 0;
          const total = toProcess.length;
          let failed = 0;
          const ckptEmbedded = /* @__PURE__ */ new Map();
          const ckptDoneFiles = /* @__PURE__ */ new Set();
          let lastCkptAt = Date.now();
          let ckptChunks = 0;
          let ckptChain = Promise.resolve();
          const maybeCheckpoint = () => {
            if (dim <= 0) return;
            let doneChunks = 0;
            for (const slots of fileChunksMap.values()) {
              for (const s of slots) if (s) doneChunks++;
            }
            if (doneChunks - ckptChunks < CHECKPOINT_POLICY.minNewChunks) return;
            const now = Date.now();
            if (now - lastCkptAt < CHECKPOINT_POLICY.minIntervalMs) return;
            lastCkptAt = now;
            ckptChunks = doneChunks;
            ckptChain = ckptChain.then(async () => {
              let newly = 0;
              for (const file of toProcess) {
                const slots = fileChunksMap.get(file.path);
                if (!slots || slots.some((s) => !s || !s.embedding)) continue;
                if (ckptDoneFiles.has(file.path)) continue;
                ckptDoneFiles.add(file.path);
                newly++;
                const tasks = slots;
                this.meta.notes[file.path] = { mtime: file.stat.mtime, chunks: tasks.map((c) => ({ text: c.text })) };
                const vecs = tasks.map((t) => t.embedding);
                ckptEmbedded.set(file.path, vecs);
              }
              if (newly === 0) return;
              await this.mergeWrite(vectors, srcOffsets, ckptEmbedded, dim);
              let regTotal = 0;
              for (const v of ckptEmbedded.values()) regTotal += v.length;
              this.updateProgress(`已暂存 ${regTotal}/${globalTasks.length} 段（此时关闭也会保留进度，重开自动继续）`);
            }).catch((e) => console.warn("[secondbrain] 断点暂存失败（索引继续，不影响最终结果）", e));
          };
          await parallelMap(batches, 3, async (batch) => {
            var _a2;
            try {
              const embeddings = await getEmbeddingsBatch(batch.map((t) => t.text), embedBase);
              for (let j = 0; j < batch.length; j++) {
                fileChunksMap.get(batch[j].filePath)[batch[j].chunkIdx] = batch[j];
                batch[j].embedding = new Float32Array(embeddings[j]);
              }
              if (dim === 0 && ((_a2 = batch[0]) == null ? void 0 : _a2.embedding)) dim = batch[0].embedding.length;
              processed += batch.length;
              this.updateProgress(
                `向量化: ${processed}/${globalTasks.length} chunks (${total} 篇文件, ${Math.round(processed / globalTasks.length * 100)}%)`
              );
              maybeCheckpoint();
            } catch (err) {
              console.warn("[secondbrain] 批量向量化失败，回退逐条处理", err);
              for (const task of batch) {
                try {
                  const embedding = await getEmbedding(task.text, false, embedBase);
                  fileChunksMap.get(task.filePath)[task.chunkIdx] = task;
                  task.embedding = new Float32Array(embedding);
                  if (dim === 0 && task.embedding.length) dim = task.embedding.length;
                  processed++;
                } catch (e) {
                  failed++;
                  console.warn(`[secondbrain] 段落向量化失败 [${task.filePath}]`, e);
                }
              }
              maybeCheckpoint();
            }
          });
          await ckptChain;
          const newChunksPerFile = /* @__PURE__ */ new Map();
          for (const file of toProcess) {
            const slots = fileChunksMap.get(file.path);
            if (!slots) continue;
            if (slots.some((s) => !s || !s.embedding)) {
              if (!slots.some((s) => s == null ? void 0 : s.embedding)) delete this.meta.notes[file.path];
              continue;
            }
            const vecs = slots.map((s) => s.embedding);
            if (dim === 0) dim = vecs[0].length;
            const keptTexts = slots.map((c) => ({ text: c.text }));
            this.meta.notes[file.path] = { mtime: file.stat.mtime, chunks: keptTexts };
            newChunksPerFile.set(file.path, vecs);
          }
          await this.mergeWrite(vectors, srcOffsets, newChunksPerFile, dim);
          console.log(`[secondbrain] 向量库已保存: ${Object.keys(this.meta.notes).length} 个文件, dim=${dim}`);
          if (failed === 0) {
            this.updateProgress(`✅ 向量化完成：${total} 篇文件，${globalTasks.length} 个段落`);
          } else {
            this.updateProgress(`⚠️ ${failed} 段向量化失败，请检查 Ollama 服务`);
          }
        }
        /** VP 索引缓存（QA L645-654）：键含 dim/count/noteCount，另加来源数组身份校验（内容变即重建） */
        buildVPIndex(vecs) {
          const metaKey = JSON.stringify({ dim: this.meta._dim, count: vecs.length, hash: Object.keys(this.meta.notes).length });
          if (this.vpMetaKey === metaKey && this.vpSrc === this.vectors && this.vpTree && this.vpVecs) return;
          const normalized = vecs.map((v) => normalizeVec(v));
          this.vpTree = vptree_build(
            normalized,
            normalized.map((_, i) => i)
          );
          this.vpVecs = normalized.map((v) => Float32Array.from(v));
          this.vpMetaKey = metaKey;
          this.vpSrc = this.vectors;
          console.log(`[secondbrain] VP-Tree built: ${normalized.length} vecs`);
        }
        /** 向量检索：查询嵌入 → VP-Tree topK×3 候选 → cos=1−d²/2 → 去重 → topK → score^0.35（QA L655-691） */
        async vectorSearch(query, topK = 20, baseUrl) {
          const queryEmbedding = await getEmbedding(query, true, baseUrl);
          if (!queryEmbedding) return [];
          const dim = this.meta._dim || this.dim;
          if (!dim || this.vectors.length === 0) return [];
          const vecs = [];
          for (let i = 0; i < this.vectors.length; i += dim) {
            vecs.push(this.vectors.subarray(i, i + dim));
          }
          this.buildVPIndex(vecs);
          const k = Math.min(topK * 3, vecs.length);
          const queryNorm = normalizeVec(queryEmbedding);
          const candidates = vptree_search(this.vpTree, this.vpVecs, queryNorm, k);
          const paths = Object.keys(this.meta.notes);
          const hits = candidates.map((r) => {
            var _a2, _b2, _c;
            let vecIdx = r.idx;
            let accPath = (_a2 = paths[0]) != null ? _a2 : "";
            for (const p of paths) {
              const count = this.meta.notes[p].chunks.length;
              if (vecIdx < count) {
                accPath = p;
                break;
              }
              vecIdx -= count;
            }
            const cosSim = Math.max(0, 1 - r.dist / 2);
            return { path: accPath, chunk: ((_c = (_b2 = this.meta.notes[accPath]) == null ? void 0 : _b2.chunks[vecIdx]) == null ? void 0 : _c.text) || "", score: cosSim };
          });
          const seen = /* @__PURE__ */ new Set();
          const deduped = [];
          for (const item of hits) {
            const key = item.path + "::" + item.chunk;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(item);
          }
          const topResults = deduped.sort((a, b) => b.score - a.score).slice(0, topK);
          for (const r of topResults) r.score = Math.pow(r.score, 0.35);
          return topResults;
        }
        /** 桌面检索：向量优先，异常降级文本；移动端直走文本索引（QA L694-699 + bz 降级改进） */
        async search(query, topK = 20, onDegraded) {
          if (IS_MOBILE) return searchTextIndex(query, this.meta.notes, topK);
          try {
            return await this.withSearchTimeout(this.vectorSearch(query, topK));
          } catch (e) {
            console.warn("[secondbrain] 向量检索失败，降级为文本检索", e);
            onDegraded == null ? void 0 : onDegraded(e);
            return searchTextIndex(query, this.meta.notes, topK);
          }
        }
        /** [46] 检索级超时封装：超时按失败降级处理（不吞掉原错误，仅兜住挂起请求）；
         *  10s（SEARCH_TIMEOUT_MS）与嵌入端点 30s 分离——检索降级快，嵌入不因慢推理误报失败 */
        async withSearchTimeout(p) {
          let timer;
          const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`向量检索超时（${SEARCH_TIMEOUT_MS / 1e3}s）`)), SEARCH_TIMEOUT_MS);
          });
          try {
            return await Promise.race([p, timeout]);
          } finally {
            clearTimeout(timer);
          }
        }
        searchText(query, topK = 20) {
          return searchTextIndex(query, this.meta.notes, topK);
        }
        /** 移动端三级检索：远程向量 → TF-IDF（复用已建索引）→ 文本（QA L704-718） */
        async searchMobile(query, topK = 20) {
          const CONFIG = buildConfig();
          if (this.searchMode === "remote" && CONFIG.OLLAMA_REMOTE_URL) {
            try {
              const results = await this.vectorSearch(query, topK, CONFIG.OLLAMA_REMOTE_URL);
              if (results.length) return results;
            } catch (e) {
              console.warn("[secondbrain] 远程向量检索失败，降级", e);
            }
          }
          if (this.searchMode === "tfidf" && this.tfidf.N > 0) {
            return this.tfidf.search(query, topK);
          }
          return this.searchText(query, topK);
        }
        /** 移动端初始化：探活远程 Ollama，否则建 chunk 粒度 TF-IDF 索引（构建一次，检索期复用） */
        async initMobile() {
          const CONFIG = buildConfig();
          if (CONFIG.OLLAMA_REMOTE_URL) {
            const ok = await checkRemoteOllama(CONFIG.OLLAMA_REMOTE_URL);
            if (ok) {
              this.searchMode = "remote";
              console.log(`[secondbrain][移动端] 远程 Ollama 就绪: ${CONFIG.OLLAMA_REMOTE_URL}`);
              return "✅ 远程 Ollama 已连接";
            }
          }
          const docs = [];
          for (const [path, note] of Object.entries(this.meta.notes)) {
            for (const chunk of note.chunks) {
              if (chunk.text) docs.push({ path, text: chunk.text });
            }
          }
          this.tfidf.build(docs);
          if (this.tfidf.N > 0) {
            this.searchMode = "tfidf";
            console.log(`[secondbrain][移动端] TF-IDF 就绪: ${this.tfidf.N} docs`);
            return `✅ TF-IDF 就绪（${this.tfidf.N} 段）`;
          }
          this.searchMode = "text";
          console.log("[secondbrain][移动端] TF-IDF 无数据，使用文本匹配");
          return "⚠️ 没有符合条件的文件";
        }
      };
    }
  });

  // src/secondbrain/ai.ts
  function getDeepseekAI() {
    if (!deepseek) deepseek = createAI({}, "deepseek-v4-flash", {}, 16384);
    return deepseek;
  }
  function resetDeepseekAI() {
    deepseek = null;
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
        constructor(app, store3, existingWin) {
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
          this.store = store3;
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
          const panel3 = this;
          const card = document.createElement("div");
          card.className = "bz-sb-ref-card";
          card.innerHTML = refCardHtml(item.path.replace(/^.*[\\/]/, "").replace(/\.md$/i, ""), Math.round(item.score * 100), "#a33d2a");
          const topRow = card.querySelector(".bz-sb-ref-card-top");
          const bodyDiv = card.querySelector(".bz-sb-ref-card-body");
          renderMarkdown(bodyDiv, item.chunk, panel3.app);
          panel3.resultsDiv.appendChild(card);
          const isFloating = () => card.classList.contains("bz-sb-ref-card--float");
          card.addEventListener("mouseenter", () => {
            var _a2;
            if (isFloating()) return;
            clearTimeout((_a2 = panel3.hoverTimer) != null ? _a2 : void 0);
            panel3.hoverTimer = setTimeout(() => {
              if (isFloating() || !card.isConnected) return;
              panel3.showHoverPreview(item, card);
            }, 300);
          });
          card.addEventListener("mouseleave", () => {
            var _a2;
            clearTimeout((_a2 = panel3.hoverTimer) != null ? _a2 : void 0);
            panel3.hoverTimer = null;
            if (!isFloating()) panel3.hideHoverPreview();
          });
          card.addEventListener("dblclick", () => {
            if (isFloating()) {
              collapseCard();
              return;
            }
            const file = panel3.app.vault.getAbstractFileByPath(item.path);
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
              panel3.activeFollows.delete(detach);
            };
            const up = () => detach();
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
            panel3.activeFollows.add(detach);
          };
          const floatCard = () => {
            if (!card.isConnected || isFloating()) return;
            card.classList.add("bz-sb-ref-card--float");
            card.style.zIndex = String(allocZ());
            panel3.floatingCards.add(card);
            panel3.hideHoverPreview();
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
            panel3.floatDetachers.set(card, () => {
              if (detachDrag) detachDrag();
              if (detachResize) detachResize();
            });
          };
          const collapseCard = () => {
            card.classList.remove("bz-sb-ref-card--float");
            panel3.floatingCards.delete(card);
            if (detachDrag) detachDrag();
            if (detachResize) detachResize();
            detachDrag = null;
            detachResize = null;
            panel3.floatDetachers.delete(card);
            topRow.classList.remove("bz-sb-ref-card-top--grip");
            card.style.cssText = "";
            if (originalNext && originalNext.parentNode === panel3.resultsDiv) {
              panel3.resultsDiv.insertBefore(card, originalNext);
            } else {
              panel3.resultsDiv.appendChild(card);
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
              panel3.hideHoverPreview();
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
          panel3.cardTeardowns.set(card, () => cancelHold());
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
        constructor(store3, app) {
          this.history = [];
          this.escHandle = null;
          /** 进行中的对话请求（ticket 141）：非空时发送钮呈「停止」态，点击中止 */
          this.inFlight = null;
          /** 轮次序号：清空对话 / 销毁后，旧轮的回调不再写 UI 与历史 */
          this.seq = 0;
          var _a2, _b2;
          this.app = app;
          this.store = store3;
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
          this.popup.innerHTML = chatShellHtml(CONFIG.CHAT_TOP_K, CONFIG.DEEPSEEK_MODEL);
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
          const controller2 = new AbortController();
          const seq = ++this.seq;
          this.inFlight = controller2;
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
              signal: controller2.signal,
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
            if (controller2.signal.aborted) {
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
            } else if (this.inFlight === controller2) {
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

  // src/secondbrain/mobile-panel.ts
  var SNAP_MID, SNAP_HIGH, COLLAPSE_THRESHOLD, MobilePanel;
  var init_mobile_panel = __esm({
    "src/secondbrain/mobile-panel.ts"() {
      init_esc_manager();
      init_notice();
      init_config();
      init_z_order();
      init_context();
      init_ui_tools();
      init_ai2();
      SNAP_MID = 45;
      SNAP_HIGH = 75;
      COLLAPSE_THRESHOLD = 18;
      MobilePanel = class {
        constructor(app, store3) {
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
          this.store = store3;
          const CONFIG = buildConfig();
          this.sheet = document.createElement("div");
          this.sheet.className = "bz-sb-mb-sheet";
          const topbar = document.createElement("div");
          topbar.className = "bz-sb-mb-topbar";
          this.pillRef = document.createElement("button");
          this.pillRef.className = "bz-sb-mb-pill active";
          this.pillRef.textContent = "📚";
          this.pillRef.title = "参考";
          this.pillChat = document.createElement("button");
          this.pillChat.className = "bz-sb-mb-pill";
          this.pillChat.textContent = "🤖";
          this.pillChat.title = "AI";
          const dragStrip = document.createElement("div");
          dragStrip.className = "bz-sb-mb-drag-strip";
          const dragDot = document.createElement("div");
          dragDot.className = "bz-sb-mb-drag-dot";
          dragStrip.appendChild(dragDot);
          topbar.appendChild(this.pillRef);
          topbar.appendChild(dragStrip);
          topbar.appendChild(this.pillChat);
          this.sheet.appendChild(topbar);
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
          void store3.initMobile().catch((e) => console.warn("[secondbrain] initMobile 失败", e));
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
        /** AI tab：重建 DOM 并重放历史；空历史显示欢迎语（QA L2103-2162） */
        renderChatTab() {
          const CONFIG = buildConfig();
          const chat3 = document.createElement("div");
          chat3.className = "bz-sb-mb-chat";
          this.chatMessagesDiv = document.createElement("div");
          this.chatMessagesDiv.className = "bz-sb-mb-chat-messages bz-sb-scroll-y";
          chat3.appendChild(this.chatMessagesDiv);
          const inputArea = document.createElement("div");
          inputArea.className = "bz-sb-mb-chat-input-area";
          const input = document.createElement("input");
          input.className = "bz-sb-mb-chat-input";
          input.type = "text";
          input.placeholder = "检索笔记后回答...";
          const sendBtn = document.createElement("button");
          sendBtn.className = "bz-sb-mb-chat-send";
          sendBtn.textContent = "发送";
          inputArea.appendChild(input);
          inputArea.appendChild(sendBtn);
          chat3.appendChild(inputArea);
          this.body.appendChild(chat3);
          for (const msg of this.chatHistory) this.appendChatMsg(msg.role, msg.content);
          if (!this.chatHistory.length) {
            this.appendChatMsg("assistant", `已加载 ${Object.keys(this.store.notes).length} 篇笔记`);
          }
          const send = async () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = "";
            this.appendChatMsg("user", text);
            this.chatHistory.push({ role: "user", content: text });
            sendBtn.disabled = true;
            sendBtn.textContent = "···";
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
              if (this.chatHistory.length > CONFIG.MAX_HISTORY * 2) {
                this.chatHistory = this.chatHistory.slice(-CONFIG.MAX_HISTORY * 2);
              }
            } catch (e) {
              this.appendChatMsg("assistant", "出错了：" + ((e == null ? void 0 : e.message) || e));
            } finally {
              sendBtn.disabled = false;
              sendBtn.textContent = "发送";
            }
          };
          sendBtn.addEventListener("click", () => void send());
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") void send();
          });
        }
        appendChatMsg(role, content) {
          if (!this.chatMessagesDiv) return;
          const div = document.createElement("div");
          div.className = `bz-sb-mb-chat-msg ${role}`;
          if (role === "assistant") {
            renderMarkdown(div, content, this.app);
          } else {
            div.textContent = content;
          }
          this.chatMessagesDiv.appendChild(div);
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

  // src/secondbrain/link-agent/data.ts
  function parseScopeList(raw) {
    const list = String(raw != null ? raw : "").split(",").map((x) => x.trim()).filter(Boolean);
    return [...new Set(list)];
  }
  function getLinkAgentScopes() {
    return parseScopeList(tryGetSettings().linkAgentScopes);
  }
  function matchesScope(scopes, path) {
    if (!scopes.length) return false;
    return scopes.some((dir) => isUnderFolder(dir, path));
  }
  function computeBackfillTargets(allPaths, opts) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const p of [...allPaths].sort()) {
      if (!p.endsWith(".md") || seen.has(p)) continue;
      seen.add(p);
      if (!opts.inScope(p) || opts.hasRelated(p) || opts.excluded(p)) continue;
      out.push(p);
    }
    return out;
  }
  function isUnderFolder(folder, path) {
    const f = (folder || "").trim().replace(/\/+$/, "");
    if (!f) return false;
    return path === f || path.startsWith(f + "/");
  }
  function computeHash(content) {
    let h = 2166136261;
    for (let i = 0; i < content.length; i++) {
      h ^= content.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0") + ":" + content.length.toString(16);
  }
  function parseRelatedEntries(value) {
    if (value === null || value === void 0) return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw.map((v) => String(v != null ? v : "").trim()).filter((v) => v.length > 0);
  }
  function hasRelatedEntries(value) {
    return parseRelatedEntries(value).length > 0;
  }
  function toRelatedEntry(targetPath) {
    return `[[${targetPath.replace(/\.md$/i, "")}]]`;
  }
  function normalizeRelatedEntry(entry) {
    const m = String(entry != null ? entry : "").match(/\[\[\s*([^\][]+?)\s*(?:#[^\][]*)?(?:\|[^\][]*)?\]\]/);
    if (!m) return null;
    const p = m[1].trim().replace(/\.md$/i, "");
    return p || null;
  }
  function mergeRelated(existing, additions, maxLinks = 0) {
    const have = new Set(existing.map((e) => e.trim()).filter(Boolean));
    const appended = [];
    for (const a of additions) {
      const key = a.trim();
      if (!key || have.has(key)) continue;
      have.add(key);
      appended.push(key);
    }
    let entries = [...existing, ...appended];
    let added = appended;
    if (maxLinks > 0 && entries.length > maxLinks) {
      entries = entries.slice(0, maxLinks);
      const kept = new Set(entries);
      added = appended.filter((a) => kept.has(a));
    }
    return { entries, added };
  }
  function planRemovals(entries, isAlive) {
    const keep = [];
    const removed = [];
    for (const e of entries) {
      const target = normalizeRelatedEntry(e);
      if (target === null || isAlive(target)) keep.push(e);
      else removed.push(e);
    }
    return { keep, removed };
  }
  async function loadQueue() {
    const store3 = await loadStore();
    const data = store3.link.queue;
    if (!Array.isArray(data)) return [];
    return data.filter((it) => it && typeof it.path === "string" && it.path.endsWith(".md")).map((it) => ({
      path: it.path,
      hash: typeof it.hash === "string" ? it.hash : void 0,
      queuedAt: typeof it.queuedAt === "string" ? it.queuedAt : void 0
    }));
  }
  async function enqueuePaths(paths, hashes) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await mutateStore((s) => {
      const items = Array.isArray(s.link.queue) ? s.link.queue : [];
      for (const path of paths) {
        if (!path || !path.endsWith(".md")) continue;
        const cur = items.find((i) => i.path === path);
        const hash = hashes == null ? void 0 : hashes[path];
        if (cur) {
          if (hash !== void 0) cur.hash = hash;
          cur.queuedAt = now;
        } else {
          items.push({ path, ...hash !== void 0 ? { hash } : {}, queuedAt: now });
        }
      }
      s.link.queue = items;
    });
  }
  async function dequeuePath(path) {
    await mutateStore((s) => {
      const items = Array.isArray(s.link.queue) ? s.link.queue : [];
      const next = items.filter((i) => i.path !== path);
      if (next.length !== items.length) s.link.queue = next;
    });
  }
  async function pruneQueueByExists(exists) {
    let removed = 0;
    await mutateStore((s) => {
      const items = Array.isArray(s.link.queue) ? s.link.queue : [];
      const next = items.filter((i) => exists(i.path));
      removed = items.length - next.length;
      if (removed > 0) s.link.queue = next;
    });
    return removed;
  }
  async function loadLinkState() {
    const store3 = await loadStore();
    const data = store3.link.state;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out = {};
    for (const [path, entry] of Object.entries(data)) {
      const e = entry;
      if (e && typeof e === "object" && typeof e.hash === "string" && e.hash) {
        out[path] = { hash: e.hash, linkedAt: typeof e.linkedAt === "string" ? e.linkedAt : "" };
      }
    }
    return out;
  }
  async function upsertLinkState(path, hash) {
    if (!path || !hash) return;
    await mutateStore((s) => {
      s.link.state[path] = { hash, linkedAt: (/* @__PURE__ */ new Date()).toISOString() };
    });
  }
  async function removeLinkState(path) {
    await mutateStore((s) => {
      if (path in s.link.state) delete s.link.state[path];
    });
  }
  function parseJudgeOutput(text, maxId) {
    if (!text) return [];
    let body = String(text).trim();
    const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) body = fence[1].trim();
    const arrMatch = body.match(/\[[\s\S]*\]/);
    if (!arrMatch) return [];
    let parsed;
    try {
      parsed = JSON.parse(arrMatch[0]);
    } catch (e) {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const id = item.id;
      const reason = item.reason;
      if (!Number.isInteger(id) || id < 1 || id > maxId) continue;
      if (typeof reason !== "string" || !reason.trim()) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, reason: reason.trim() });
    }
    return out;
  }
  var init_data = __esm({
    "src/secondbrain/link-agent/data.ts"() {
      init_store_file();
      init_settings_provider();
    }
  });

  // src/core/item-actions.ts
  function renderIcon(container, iconId) {
    try {
      setIcon(container, iconId);
    } catch (e) {
    }
  }
  function registerSheetCompanion(el) {
    sheetCompanions.add(el);
  }
  function unregisterSheetCompanion(el) {
    sheetCompanions.delete(el);
  }
  function inSheetCompanion(target) {
    for (const c of sheetCompanions) {
      if (c.isConnected && c.contains(target)) return true;
    }
    return false;
  }
  function onMouseDownCapture(ev) {
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
      touchSettlePending = false;
      ev.stopImmediatePropagation();
      ev.preventDefault();
      return;
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
  function openItemMenu(x, y, actions, suppressResidualClick = false, menuClass) {
    closeItemMenu();
    const m = document.createElement("div");
    m.className = "bz-item-menu" + (menuClass ? " " + menuClass : "");
    m.style.visibility = "hidden";
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
    sheet.className = "bz-item-sheet";
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
      openItemMenu(e.clientX, e.clientY, actions, true, opts == null ? void 0 : opts.menuClass);
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
  function makeReloadWarnOnce() {
    let reloadWarned = false;
    return () => {
      if (reloadWarned) return;
      reloadWarned = true;
      notice(RELOAD_SETTINGS_NOTICE, "info");
    };
  }
  var RELOAD_SETTINGS_NOTICE;
  var init_settings_common = __esm({
    "src/core/settings-common.ts"() {
      init_notice();
      init_settings_provider();
      RELOAD_SETTINGS_NOTICE = "设置已保存，重载插件后生效";
    }
  });

  // src/core/crypto.ts
  function toBase64(bytes) {
    const CHUNK = 32768;
    let bin = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function clearCryptoKeyCache() {
    keyCache.clear();
  }
  var CryptoService, keyCache;
  var init_crypto = __esm({
    "src/core/crypto.ts"() {
      CryptoService = class {
        static async deriveKey(password, salt) {
          const cacheKey = toBase64(salt);
          const hit = keyCache.get(cacheKey);
          if (hit && hit.pw === password) return hit.key;
          const enc = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
            "deriveKey"
          ]);
          const key = await crypto.subtle.deriveKey(
            {
              name: "PBKDF2",
              salt,
              iterations: 1e5,
              hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
          );
          keyCache.set(cacheKey, { pw: password, key });
          return key;
        }
        static async encrypt(plainText, password) {
          const encoder = new TextEncoder();
          const data = encoder.encode(plainText);
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const key = await this.deriveKey(password, salt);
          const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
          const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
          combined.set(salt, 0);
          combined.set(iv, salt.length);
          combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
          return toBase64(combined);
        }
        static async decrypt(encryptedBase64, password) {
          const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
          const salt = combined.slice(0, 16);
          const iv = combined.slice(16, 28);
          const ciphertext = combined.slice(28);
          const key = await this.deriveKey(password, salt);
          const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
          );
          return new TextDecoder().decode(decrypted);
        }
      };
      keyCache = /* @__PURE__ */ new Map();
    }
  });

  // src/encrypt/data.ts
  function bytesToBase64(bytes) {
    const CHUNK = 32768;
    let bin = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function fingerprintOf(data) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
    return bytesToBase64(new Uint8Array(digest));
  }
  function randToken(len) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let s = "";
    for (let i = 0; i < len; i++) s += RAND_CHARS[bytes[i] % 64];
    return s;
  }
  function flatName() {
    return "." + randToken(11) + ".enc";
  }
  function genNoteId() {
    return "enc-" + Date.now() + "-" + randToken(6);
  }
  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const workers = [];
    const n = Math.min(limit, items.length);
    for (let w = 0; w < n; w++) {
      workers.push(
        (async () => {
          while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i], i);
          }
        })()
      );
    }
    const settled = await Promise.allSettled(workers);
    const firstReject = settled.find((s) => s.status === "rejected");
    if (firstReject) throw firstReject.reason;
    return out;
  }
  var ENCRYPT_CHANGED_CHANNEL, ENCRYPT_UNLOCK_CHANGED_CHANNEL, RAND_CHARS, STAGING_DIR, PENDING_FILE, BLOB_CONCURRENCY, SafeManager;
  var init_data2 = __esm({
    "src/encrypt/data.ts"() {
      init_app();
      init_domain_bus();
      init_crypto();
      init_storage();
      ENCRYPT_CHANGED_CHANNEL = "encrypt:changed";
      ENCRYPT_UNLOCK_CHANGED_CHANNEL = "encrypt:unlock-changed";
      RAND_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
      STAGING_DIR = ".staging";
      PENDING_FILE = "pending.json";
      BLOB_CONCURRENCY = 3;
      SafeManager = class {
        constructor(root) {
          /** encryptRoot（vault 相对路径，默认 CONFIG/.ENCRYPT——点前缀目录 Obsidian 侧栏隐藏） */
          this.root = "CONFIG/.ENCRYPT";
          /** 主密码（只存内存，锁定时清空） */
          this.password = null;
          this.unlocked = false;
          this.manifest = { version: 1, notes: [] };
          /**
           * 最近一次解锁时自愈回滚的条目数（ADR-0018；UI 解锁成功提示用，无自愈为 0）。
           * unlock 入口复位，selfHeal 结束时写回本次实际回滚数。
           */
          this.selfHealRolledBack = 0;
          /** 解锁态变化回调（UI 状态栏等订阅；unlock 成功 / 首设成功 / lock() 时触发） */
          this.onUnlockChange = null;
          /**
           * 操作级互斥（P1-6）：lockNote/restoreNote 实例级串行的 promise 链尾。
           * 并发调用按发起顺序排队；前序失败不断链（错误只回给其自己的调用方）。
           */
          this.opQueue = Promise.resolve();
          if (root) this.root = root.replace(/\/+$/, "");
        }
        /** 清单文件完整路径（点前缀，侧栏隐藏） */
        get manifestPath() {
          return this.root + "/.safe.enc";
        }
        /** 镜像相对路径 → vault 完整路径 */
        resolveRef(ref) {
          return this.root + "/" + ref;
        }
        /** 点前缀兼容适配器：Obsidian 对点前缀路径不索引，getAbstractFileByPath 返回 null；
         *  因此加密根目录内的清单/镜像一律走 vault.adapter（直读磁盘，无视隐藏） */
        get adapter() {
          return getApp().vault.adapter || getApp().vault;
        }
        /** 清单是否存在（用于首设判断；adapter 直读磁盘，点前缀可用） */
        async exists() {
          return await this.adapter.exists(this.manifestPath);
        }
        /**
         * 解锁：读 .safe.enc → 解密 → 解析清单。首设（无文件）时创建空清单并设密码。
         * 校验方式=解密成功即通过（GCM 认证，同密码本）。
         * @param password 主密码
         * @param forceReset 清单损坏（空/解析失败）时是否强制重设新密码——
         *   重设会丢弃旧清单（旧密文永久不可解），必须由 UI 在用户明确确认后传入。
         *   返回 false 时用 manifestIssue 区分「密码错误（无 issue）」与「清单损坏（empty/corrupt）」。
         */
        async unlock(password, forceReset = false) {
          var _a2;
          this.manifestIssue = void 0;
          this.selfHealRolledBack = 0;
          await this.recoverManifestWrite();
          const existsManifest = await this.exists();
          if (!existsManifest) return this.firstTimeSetup(password);
          const content = await this.adapter.read(this.manifestPath);
          if (!content.trim()) {
            this.manifestIssue = "empty";
            if (!forceReset) return false;
            return this.firstTimeSetup(password);
          }
          try {
            const plain = await CryptoService.decrypt(content.trim(), password);
            let parsed;
            try {
              parsed = JSON.parse(plain);
            } catch (e) {
              this.manifestIssue = "corrupt";
              if (!forceReset) return false;
              return this.firstTimeSetup(password);
            }
            if (!parsed || !Array.isArray(parsed.notes)) parsed.notes = [];
            parsed.version = parsed.version || 1;
            this.manifest = parsed;
            this.password = password;
            this.unlocked = true;
            (_a2 = this.onUnlockChange) == null ? void 0 : _a2.call(this, true);
            emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
            try {
              await this.selfHeal();
            } catch (e) {
            }
            return true;
          } catch (e) {
            return false;
          }
        }
        /** 首设/强制重设：写空清单。写失败必须回滚解锁态（否则下次打开又误判无清单） */
        async firstTimeSetup(password) {
          var _a2;
          this.password = password;
          this.unlocked = true;
          (_a2 = this.onUnlockChange) == null ? void 0 : _a2.call(this, true);
          emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
          this.manifest = { version: 1, notes: [] };
          try {
            await this.saveManifest();
            return true;
          } catch (e) {
            this.unlocked = false;
            this.password = null;
            this.manifest = { version: 1, notes: [] };
            return false;
          }
        }
        /** 加锁：清内存态（含派生密钥缓存，密钥不残留） */
        lock() {
          var _a2;
          this.unlocked = false;
          this.password = null;
          this.manifest = { version: 1, notes: [] };
          (_a2 = this.onUnlockChange) == null ? void 0 : _a2.call(this, false);
          emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: false });
          clearCryptoKeyCache();
        }
        /**
         * 持久化清单（整体加密写回 .safe.enc；adapter 直写磁盘，点前缀可用）。
         * D2 可靠写契约原语 1 收编：整段落盘入 core per-path 串行队列（键 = .safe.enc 路径）——
         * 密文为点前缀文件，vault API 不可见、无法走 jsonFileStore，收编对象即队列原语本身；
         * 此前仅 lockNote/restoreNote 经实例 opQueue 串行，removeNote/updateNotePayload/
         * selfHeal/resolveHealth 的清单写可与 opQueue 内操作并发交错三段式 rename（tmp/bak
         * 互踩），统一入队后同路径清单写全局串行。任务不可重入：任务体内勿再对本清单入队。
         * 原子写，三段式 rename——
         * Obsidian adapter.rename 不支持覆盖已存在目标（报「Destination file already exists」），
         * 故 rename 目标恒为唯一名：S1 写 `.tmp` 完整密文 → S2 旧清单挪走为 `.bak`
         * → S3 `.tmp` 搬入为正本 → S4 删 `.bak`。任一中断点由解锁时 recoverManifestWrite 恢复：
         *   - S2 后崩溃：tmp+bak 在，manifest 缺（用 tmp 恢复，删 bak）
         *   - S3 后崩溃：manifest 新 + bak 旧（删 bak，保留新清单）
         *   - S1 后崩溃：仅 tmp 残留（清理）
         */
        async saveManifest() {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法保存清单");
          const json = JSON.stringify(this.manifest);
          const encrypted = await CryptoService.encrypt(json, this.password);
          await enqueueFileTask(this.manifestPath, async () => {
            await this.ensureDirFor(this.manifestPath);
            const tmp = this.manifestPath + ".tmp";
            const bak = this.manifestPath + ".bak";
            try {
              await this.adapter.remove(tmp);
            } catch (e) {
            }
            try {
              await this.adapter.remove(bak);
            } catch (e) {
            }
            await this.adapter.write(tmp, encrypted);
            await this.adapter.rename(this.manifestPath, bak);
            try {
              await this.adapter.rename(tmp, this.manifestPath);
            } catch (e) {
              try {
                await this.adapter.rename(bak, this.manifestPath);
              } catch (err) {
              }
              throw e;
            }
            try {
              await this.adapter.remove(bak);
            } catch (e) {
            }
          });
          emitDomainEvent(ENCRYPT_CHANGED_CHANNEL, { noteId: null });
        }
        /**
         * 原子写中断恢复（解锁前调用）：把清单恢复到一致状态，防「清单缺失被误判为首设」
         * 或「旧清单残留覆盖新清单」。失败静默（下次解锁重试；无残留时零开销）。
         */
        async recoverManifestWrite() {
          const adapter = this.adapter;
          const tmp = this.manifestPath + ".tmp";
          const bak = this.manifestPath + ".bak";
          try {
            const hasBak = await adapter.exists(bak);
            const hasTmp = await adapter.exists(tmp);
            if (hasBak) {
              if (hasTmp) {
                await adapter.rename(tmp, this.manifestPath);
              }
              await adapter.remove(bak);
            } else if (hasTmp) {
              await adapter.remove(tmp);
            }
          } catch (e) {
          }
        }
        /** 确保加密根目录存在（平铺布局只需根目录；adapter.mkdir 递归建，点前缀可用） */
        async ensureSafeRootDir() {
          await this.ensureDirFor(this.root + "/x");
        }
        /**
         * 递归确保目标 filePath 的父目录全部存在（用 adapter 直查磁盘 mkdir，
         * 点前缀目录 vault.getAbstractFileByPath 查不到，故不走 vault）。幂等。
         */
        async ensureDirFor(filePath) {
          const adapter = this.adapter;
          const idx = filePath.lastIndexOf("/");
          if (idx <= 0) return;
          let dir = filePath.slice(0, idx);
          const missing = [];
          let probe = dir;
          while (probe && probe !== "." && probe !== "/") {
            let exists = false;
            try {
              exists = await adapter.exists(probe);
            } catch (e) {
              exists = false;
            }
            if (exists) break;
            missing.unshift(probe);
            const slash = probe.lastIndexOf("/");
            if (slash <= 0) break;
            probe = probe.slice(0, slash);
          }
          for (const p of missing) {
            await adapter.mkdir(p);
          }
        }
        /**
         * 递归确保目标文件的父目录全部存在（Obsidian vault 路径、非点前缀，
         * 还原写回原路径用；走 vault 使 Obsidian 认可目录）。
         */
        async ensureVaultParentFolder(filePath) {
          const app = getApp();
          const idx = filePath.lastIndexOf("/");
          if (idx <= 0) return;
          let dir = filePath.slice(0, idx);
          const missing = [];
          let probe = dir;
          while (probe && probe !== "." && probe !== "/") {
            if (app.vault.getAbstractFileByPath(probe)) break;
            missing.unshift(probe);
            const slash = probe.lastIndexOf("/");
            if (slash <= 0) break;
            probe = probe.slice(0, slash);
          }
          for (const p of missing) {
            await app.vault.createFolder(p);
          }
        }
        /**
         * 原子覆盖写镜像密文（P0-1）：新密文先整体落暂存区，再 rename 换入正式位——
         * 复用 writeStaged/promoteStaged（与 .safe.enc 三段式同款思想），任何一步失败
         * （含 adapter.write 半写中断）正式位都保持旧完整密文，绝不出现半截文件。
         * 换入序列：旧镜像先挪 `.bak`（rename 目标恒不存在）→ 暂存镜像搬入正位 → 删 `.bak`；
         * 搬入失败回滚 `.bak`。无旧镜像时直接 promoteStaged（与 lockNote 提交同语义）。
         */
        async replaceMirrorAtomic(ref, ciphertext) {
          const finalPath = this.resolveRef(ref);
          const stagedPath = this.stagingPath + "/" + ref;
          const bakPath = finalPath + ".bak";
          try {
            await this.adapter.remove(bakPath);
          } catch (e) {
          }
          try {
            await this.adapter.remove(stagedPath);
          } catch (e) {
          }
          await this.writeStaged(ref, ciphertext);
          const hasOld = await this.adapter.exists(finalPath);
          if (!hasOld) {
            try {
              await this.promoteStaged(ref);
            } catch (e) {
              try {
                await this.adapter.remove(stagedPath);
              } catch (err) {
              }
              throw e;
            }
            return;
          }
          await this.adapter.rename(finalPath, bakPath);
          try {
            await this.promoteStaged(ref);
          } catch (e) {
            try {
              await this.adapter.rename(bakPath, finalPath);
            } catch (err) {
            }
            try {
              await this.adapter.remove(stagedPath);
            } catch (err) {
            }
            throw e;
          }
          try {
            await this.adapter.remove(bakPath);
          } catch (e) {
          }
        }
        /** 读镜像密文文件 → base64 密文字符串（adapter，点前缀可用） */
        async readMirror(ref) {
          const path = this.resolveRef(ref);
          try {
            if (!await this.adapter.exists(path)) return null;
            const c = await this.adapter.read(path);
            return c.trim();
          } catch (e) {
            return null;
          }
        }
        /** 删除点前缀密文镜像文件（adapter，幂等） */
        async deleteSafeFile(ref) {
          const path = this.resolveRef(ref);
          try {
            if (await this.adapter.exists(path)) await this.adapter.remove(path);
          } catch (e) {
          }
        }
        /**
         * 删除一条条目的全部密文镜像（正文 + 附件原始层/预览层）。
         * 自愈回滚 / 彻底取出 / 失效条目清理共用；deleteSafeFile 幂等，正文缺失时为无害空操作。
         */
        async deleteNoteMirrors(note) {
          if (note.contentRef) await this.deleteSafeFile(note.contentRef);
          for (const a of note.attachments) {
            await this.deleteSafeFile(a.blobRef);
            if (a.hasPreview) await this.deleteSafeFile(a.previewRef);
          }
        }
        /** 删除 vault 原文件（非点前缀，走 vault 使 Obsidian 认可删除；幂等） */
        async deleteVaultFile(path) {
          const app = getApp();
          const file = app.vault.getAbstractFileByPath(path);
          if (file && file.isFolder !== true) {
            await app.vault.delete(file);
          }
        }
        /** 是否存在 vault 文件（非点前缀原路径判断用） */
        fileExists(path) {
          const f = getApp().vault.getAbstractFileByPath(path);
          return !!f && f.isFolder !== true;
        }
        // ---------- 提交式加密（ADR-0018）：暂存区 / 挂起标记 / 自愈 / 手动清理 ----------
        /** 暂存目录 vault 路径（点前缀隐藏，与最终镜像同盘保证 rename 高效） */
        get stagingPath() {
          return this.root + "/" + STAGING_DIR;
        }
        /** 挂起标记文件 vault 路径（暂存区内，明文 noteId 列表） */
        get pendingPath() {
          return this.stagingPath + "/" + PENDING_FILE;
        }
        /** 确保暂存目录存在 */
        async ensureStagingDir() {
          await this.ensureDirFor(this.stagingPath + "/x");
        }
        /** 写镜像密文到暂存区（提交前不触碰数据文件夹正式布局、不占内存） */
        async writeStaged(ref, ciphertext) {
          await this.ensureStagingDir();
          await this.adapter.write(this.stagingPath + "/" + ref, ciphertext);
        }
        /** 暂存镜像搬入正式顶层（同盘 rename；失败抛出 → 整笔放弃，挂起态留待解锁自愈兜底） */
        async promoteStaged(ref) {
          const staged = this.stagingPath + "/" + ref;
          const final = this.resolveRef(ref);
          if (!await this.adapter.exists(staged)) throw new Error("暂存镜像缺失：" + ref);
          await this.adapter.rename(staged, final);
        }
        /** 清空暂存区全部内容（含挂起标记；目录缺失/单文件失败一律幂等，不依赖目录注册） */
        async clearStaging() {
          try {
            const listing = await this.adapter.list(this.stagingPath);
            for (const f of listing.files) {
              try {
                await this.adapter.remove(f);
              } catch (e) {
              }
            }
          } catch (e) {
          }
        }
        /** 读挂起标记（pending.json 的 noteId 列表；缺失/损坏返回空） */
        async readPending() {
          try {
            if (!await this.adapter.exists(this.pendingPath)) return [];
            const raw = await this.adapter.read(this.pendingPath);
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
          } catch (e) {
            return [];
          }
        }
        /**
         * 追加一条挂起标记（读-改-写；P1-6）：整写 `[id]` 覆盖会把并发另一笔已登记的
         * 标记互吞掉（其半提交从此失去自愈线索），故先读现列表再追加写回。
         * D2 收编：读改写整体入 core per-path 串行队列（键 = pending.json 路径），
         * 与 removePending 及未来任何同路径写者互斥（原语 1）。
         */
        async addPending(id) {
          await enqueueFileTask(this.pendingPath, async () => {
            const list = await this.readPending();
            if (!list.includes(id)) list.push(id);
            await this.ensureStagingDir();
            await this.adapter.write(this.pendingPath, JSON.stringify(list));
          });
        }
        /**
         * 移除单条挂起标记（读-改-写；P1-6）：只摘除自己的 id，其余笔的标记原样保留；
         * 列表清空则删除文件（对齐原「清除标记」语义，暂存区回归无标记状态）。
         * D2 收编：读改写整体入 pending.json per-path 串行队列（原语 1）。
         */
        async removePending(id) {
          await enqueueFileTask(this.pendingPath, async () => {
            const list = await this.readPending();
            const idx = list.indexOf(id);
            if (idx !== -1) list.splice(idx, 1);
            if (list.length === 0) {
              if (await this.adapter.exists(this.pendingPath)) await this.adapter.remove(this.pendingPath);
              return;
            }
            await this.ensureStagingDir();
            await this.adapter.write(this.pendingPath, JSON.stringify(list));
          });
        }
        /**
         * 自愈回滚（ADR-0018）：对挂起标记仍在的条目判定「半提交」——删除其引用的顶层镜像
         * （已搬入的清掉、未搬入的自然无文件）、从清单丢弃该条目，随后清空暂存区与标记。
         * 关键不变量：标记于删原文件前清除，故标记存在 ⇒ 原文件未删 ⇒ 回滚永远安全、
         * 不产生密文孤儿。无挂起条目时仅清空遗留暂存。解锁成功后调用；失败不阻塞解锁。
         * @returns 本次实际回滚的条目数（挂起标记无对应条目的不计入；无挂起为 0）
         */
        async selfHeal() {
          if (!this.unlocked || !this.password) return 0;
          const pending = await this.readPending();
          let rolledBack = 0;
          if (pending.length) {
            for (const id of pending) {
              const idx = this.manifest.notes.findIndex((n) => n.id === id);
              if (idx === -1) continue;
              const note = this.manifest.notes[idx];
              await this.deleteNoteMirrors(note);
              this.manifest.notes.splice(idx, 1);
              rolledBack += 1;
            }
            if (rolledBack > 0) await this.saveManifest();
          }
          await this.clearStaging();
          this.selfHealRolledBack = rolledBack;
          return rolledBack;
        }
        /**
         * 体检扫描（用户拍板：右上角「体检」按钮替换原「清理」，先报告后勾选清理）。
         * 扫描分两段：
         * 1. 对账段（不依赖解锁，锁定态也可体检）：
         *    - dead-entry：正文镜像（contentRef）缺失的条目 = 失效条目（正文不可解、还原无意义）；
         *    - orphan-file：顶层未被任何清单条目 contentRef/blobRef/previewRef 引用的
         *      点前缀 `.随机.enc` 形态密文（`.safe.enc` 与目录结构一律不碰）。
         *    仅附件镜像缺失但正文可读的条目保留（预览不受影响）。
         * 2. 完整性段（需解锁，解锁后自动执行）：
         *    - corrupted-body：正文镜像解密失败（文件在但内容损坏/被替换）；
         *    - corrupted-attachment：附件原始层解密失败或指纹与加密时不符（被篡改）；
         *    - missing-attachment：附件原始层镜像缺失（正文可读，还原时该附件不可用）。
         *    预览层不校验——还原不依赖预览层，缺失不致命。
         *    损坏/缺失类只报告、不清理（删了就是真丢数据，由用户决定从备份恢复），
         *    只有 dead-entry 与 orphan-file 可勾选清理。
         * @param onProgress 进度回调（逐项检查时调用：done/total/当前对象/本次新增发现，UI 动态显示）
         * @returns { items: 问题清单, integrityChecked: 是否执行了解密完整性检测（未解锁为 false） }
         */
        async scanHealth(onProgress) {
          const items = [];
          if (!this.unlocked || !this.password) return { items, integrityChecked: false };
          let total = 1;
          for (const n of this.manifest.notes) total += 2 + n.attachments.length;
          let done = 0;
          const emit = (current, fresh) => {
            done += 1;
            if (fresh.length) items.push(...fresh);
            onProgress == null ? void 0 : onProgress({ done, total, current, found: fresh });
          };
          for (const n of this.manifest.notes) {
            let bodyExists = false;
            if (n.contentRef) {
              try {
                bodyExists = await this.adapter.exists(this.resolveRef(n.contentRef));
              } catch (e) {
                bodyExists = false;
              }
            }
            const fresh = [];
            if (!bodyExists) {
              fresh.push({ cat: "dead-entry", key: "entry:" + n.id, label: n.title, noteId: n.id });
            }
            emit(n.title, fresh);
          }
          const referenced = /* @__PURE__ */ new Set();
          for (const n of this.manifest.notes) {
            if (n.contentRef) referenced.add(n.contentRef);
            for (const a of n.attachments) {
              if (a.blobRef) referenced.add(a.blobRef);
              if (a.hasPreview && a.previewRef) referenced.add(a.previewRef);
            }
          }
          {
            const fresh = [];
            try {
              if (await this.adapter.exists(this.root)) {
                const listing = await this.adapter.list(this.root);
                for (const f of listing.files) {
                  const name = f.slice(f.lastIndexOf("/") + 1);
                  if (name === ".safe.enc") continue;
                  if (!name.startsWith(".") || !name.endsWith(".enc")) continue;
                  if (referenced.has(name)) continue;
                  fresh.push({ cat: "orphan-file", key: "file:" + name, label: name, ref: name });
                }
              }
            } catch (e) {
            }
            emit("孤儿密文文件", fresh);
          }
          const integrityChecked = !!(this.unlocked && this.password);
          if (integrityChecked) {
            const password = this.password;
            for (const n of this.manifest.notes) {
              if (items.some((i) => i.cat === "dead-entry" && i.noteId === n.id)) {
                emit(n.title + "（失效，跳过校验）", []);
                continue;
              }
              if (!n.contentRef) {
                emit(n.title, []);
                continue;
              }
              const fresh = [];
              try {
                const cipher = await this.readMirror(n.contentRef);
                if (cipher !== null) await CryptoService.decrypt(cipher, password);
              } catch (e) {
                fresh.push({ cat: "corrupted-body", key: "body:" + n.id, label: n.title, noteId: n.id, ref: n.contentRef });
              }
              emit(n.title, fresh);
            }
            for (const n of this.manifest.notes) {
              for (const a of n.attachments) {
                if (!a.blobRef) {
                  emit(a.path, []);
                  continue;
                }
                const key = "att:" + n.id + ":" + a.path;
                const fresh = [];
                try {
                  const cipher = await this.readMirror(a.blobRef);
                  if (cipher === null) {
                    fresh.push({ cat: "missing-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                  } else {
                    const plain = await CryptoService.decrypt(cipher, password);
                    const fp = await fingerprintOf(plain);
                    if (fp !== a.fingerprint) {
                      fresh.push({ cat: "corrupted-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                    }
                  }
                } catch (e) {
                  fresh.push({ cat: "corrupted-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                }
                emit(a.path, fresh);
              }
            }
          }
          return { items, integrityChecked };
        }
        /**
         * 按勾选 key 清理（体检页「清理勾选项」执行；只处理可清理类，损坏/缺失类防御性忽略）：
         * 1. dead-entry（key `entry:<id>`）：正文镜像当前仍缺失 → 整条清除（残留附件镜像一并删除）——
         *    判定以当前磁盘为准（幂等：重复执行无副作用）；
         * 2. orphan-file（key `file:<name>`）：删除该顶层密文文件（形态校验同扫描，绝不越界）。
         * 有清单变更时持久化（落盘失败向上抛，下次重试判定幂等）；并清空暂存区。
         * @returns { files: 删除的孤儿密文文件数, notes: 清除的失效条目数 }
         */
        async resolveHealth(keys) {
          if (!this.unlocked) throw new Error("未解锁，无法清理");
          const want = new Set(keys);
          let notes = 0;
          let files = 0;
          const kept = [];
          for (const n of this.manifest.notes) {
            let bodyExists = false;
            if (n.contentRef) {
              try {
                bodyExists = await this.adapter.exists(this.resolveRef(n.contentRef));
              } catch (e) {
                bodyExists = false;
              }
            }
            if (want.has("entry:" + n.id) && !bodyExists) {
              await this.deleteNoteMirrors(n);
              notes += 1;
            } else {
              kept.push(n);
            }
          }
          if (notes > 0) this.manifest.notes = kept;
          for (const key of keys) {
            if (!key.startsWith("file:")) continue;
            const name = key.slice("file:".length);
            if (!name.startsWith(".") || !name.endsWith(".enc")) continue;
            try {
              if (await this.adapter.exists(this.resolveRef(name))) {
                await this.adapter.remove(this.resolveRef(name));
                files += 1;
              }
            } catch (e) {
            }
          }
          if (notes > 0) await this.saveManifest();
          await this.clearStaging();
          return { files, notes };
        }
        enqueueOp(op) {
          const run = this.opQueue.then(op, op);
          this.opQueue = run.catch(() => void 0);
          return run;
        }
        /**
         * 加锁一篇笔记（操作级互斥入口，P1-6）：实例级 promise 链串行——
         * 并发 lockNote/restoreNote 按发起顺序排队执行，杜绝挂起标记/清单/暂存区的并发互吞。
         */
        lockNote(input, onProgress, onDeleteFailed) {
          return this.enqueueOp(() => this.lockNoteSerial(input, onProgress, onDeleteFailed));
        }
        /**
         * 加锁一篇笔记：把当前笔记正文 + 双链附件移入保险库（ADR-0018 提交式加密）。
         * 加密阶段密文流式写入暂存区 `.staging/`（不占内存、不进入数据文件夹正式布局）；
         * 全部加密成功后才进入提交序列：
         *   S1 写挂起标记 → S2 清单先行（saveManifest，提交点）→ S3 暂存镜像搬入顶层
         *   → S4 清除挂起标记 → S5 尽力删原文件（失败仅提示，onDeleteFailed 收集，不回滚）。
         * 关键不变量：挂起标记存在 ⇒ 原文件未删 ⇒ 解锁自愈回滚永远安全；标记于删原文件前清除，
         * 标记清除后的意外一律视为已提交、绝不回滚（Q4-A）。
         * 任一失败（附件/正文加密、写暂存、清单写入、搬入、清标记）→ 整笔放弃：清理本次暂存、
         * 原文件不动；清单先行已残留的挂起态由解锁自愈兜底。
         * onProgress：按文件回调（附件逐个 + 笔记本身），UI 驱动进度通知。
         */
        async lockNoteSerial(input, onProgress, onDeleteFailed) {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法加密笔记");
          await this.ensureSafeRootDir();
          await this.ensureStagingDir();
          const password = this.password;
          const total = input.attachments.length + 1;
          let done = 0;
          const attachments = [];
          const finalRefs = [];
          const stagedRefs = [];
          let note = null;
          let manifestSaved = false;
          try {
            const results = await mapLimit(input.attachments, BLOB_CONCURRENCY, async (a) => {
              const fp = await fingerprintOf(a.data);
              const enc = await CryptoService.encrypt(a.data, password);
              const blobRef = flatName();
              await this.writeStaged(blobRef, enc);
              stagedRefs.push(blobRef);
              finalRefs.push(blobRef);
              let hasPreview = false;
              let previewRef = "";
              if (a.previewData) {
                const encP = await CryptoService.encrypt(a.previewData, password);
                previewRef = flatName();
                await this.writeStaged(previewRef, encP);
                stagedRefs.push(previewRef);
                finalRefs.push(previewRef);
                hasPreview = true;
              }
              done += 1;
              onProgress == null ? void 0 : onProgress({ done, total, current: a.path });
              return {
                path: a.path,
                kind: a.kind || "image",
                blobRef,
                blobSize: enc.length,
                fingerprint: fp,
                hasPreview,
                previewRef
              };
            });
            for (const r of results) attachments.push(r);
            done += 1;
            onProgress == null ? void 0 : onProgress({ done, total, current: input.path });
            const bodyRef = flatName();
            const bodyCipher = await CryptoService.encrypt(input.content, this.password);
            await this.writeStaged(bodyRef, bodyCipher);
            stagedRefs.push(bodyRef);
            finalRefs.push(bodyRef);
            note = {
              id: genNoteId(),
              kind: input.kind || void 0,
              path: input.path,
              title: input.title,
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              contentRef: bodyRef,
              attachments
            };
            await this.addPending(note.id);
            this.manifest.notes.push(note);
            await this.saveManifest();
            manifestSaved = true;
            for (const ref of finalRefs) await this.promoteStaged(ref);
            try {
              await this.removePending(note.id);
            } catch (e) {
              throw new Error("清除挂起标记失败：" + e.message);
            }
            const deleteFailed = [];
            for (const a of input.attachments) {
              try {
                await this.deleteVaultFile(a.path);
              } catch (e) {
                deleteFailed.push(a.path);
              }
            }
            if (input.kind !== "diary-entry" && input.kind !== "password-vault") {
              try {
                await this.deleteVaultFile(input.path);
              } catch (e) {
                deleteFailed.push(input.path);
              }
            }
            onDeleteFailed == null ? void 0 : onDeleteFailed(deleteFailed);
            return note;
          } catch (e) {
            for (const ref of stagedRefs) {
              try {
                await this.adapter.remove(this.stagingPath + "/" + ref);
              } catch (err) {
              }
            }
            if (!manifestSaved && note) {
              const ghostId = note.id;
              const idx = this.manifest.notes.findIndex((n) => n.id === ghostId);
              if (idx !== -1) this.manifest.notes.splice(idx, 1);
            }
            throw e;
          }
        }
        /**
         * 还原（取出即删）一篇笔记（操作级互斥入口，P1-6）：与 lockNote 共享同一串行链。
         *
         * 解原文 + 原质量附件写回原路径。
         * 原子语义（用户决策修订）：阶段一并行解密全部附件 + 正文并完成全部校验
         * （指纹冲突/目标被占/镜像缺失/解密失败），**任一失败 → 整体放弃，零落盘**；
         * 阶段二才批量写回明文（写回中途失败尽力回滚本次创建的文件）。
         * 全部成功（无冲突）后：删除本文全部加密镜像（正文+附件原始层/预览层）、从清单移除，彻底取出。
         * onProgress：按文件回调（附件逐个 + 笔记本身），UI 驱动进度通知。
         */
        restoreNote(noteId, onProgress) {
          return this.enqueueOp(() => this.restoreNoteSerial(noteId, onProgress));
        }
        async restoreNoteSerial(noteId, onProgress) {
          var _a2, _b2;
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法还原笔记");
          const app = getApp();
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note) throw new Error("未找到该加密笔记");
          const conflicts = [];
          const total = note.attachments.length + 1;
          let done = 0;
          const plainAttachments = await mapLimit(note.attachments, BLOB_CONCURRENCY, async (a) => {
            const plainB64 = await this.prepareRestoreAttachment(a);
            done += 1;
            onProgress == null ? void 0 : onProgress({ done, total, current: a.path });
            return plainB64;
          });
          note.attachments.forEach((a, i) => {
            if (plainAttachments[i] === null) conflicts.push(a.path);
          });
          done += 1;
          onProgress == null ? void 0 : onProgress({ done, total, current: note.path });
          const plain = await this.decryptNoteBody(note);
          if (plain === null || plain === void 0) {
            conflicts.push(note.path);
          } else if (note.kind === "diary-entry") {
          } else if (this.fileExists(note.path)) {
            const sameContent = await this.isSameTextFile(note.path, plain);
            if (!sameContent) conflicts.push(note.path);
          }
          if (conflicts.length > 0) return { note, conflicts, removed: false };
          const created = [];
          try {
            for (let i = 0; i < note.attachments.length; i++) {
              const a = note.attachments[i];
              const wasCreated = await this.commitRestoreAttachment(a, plainAttachments[i]);
              if (wasCreated) created.push(a.path);
            }
            if (note.kind === "diary-entry") {
              const mergeOk = await this.mergeDiaryBlock(note.path, plain);
              if (!mergeOk) throw new Error("日记块 merge 失败");
            } else {
              await this.ensureVaultParentFolder(note.path);
              const file = await app.vault.create(note.path, plain);
              created.push(note.path);
              (_b2 = (_a2 = app.metadataCache) == null ? void 0 : _a2.trigger) == null ? void 0 : _b2.call(_a2, "changed", file);
            }
          } catch (e) {
            for (const p of created) {
              try {
                await this.deleteVaultFile(p);
              } catch (err) {
              }
            }
            return { note, conflicts: [...conflicts, note.path], removed: false };
          }
          await this.deleteNoteMirrors(note);
          const idx = this.manifest.notes.indexOf(note);
          if (idx !== -1) this.manifest.notes.splice(idx, 1);
          try {
            await this.saveManifest();
          } catch (e) {
            return { note, conflicts, removed: false, manifestSaveFailed: true };
          }
          return { note, conflicts, removed: true };
        }
        /** 目标文件内容与待还原明文是否一致（归一化行尾；占用幂等放行判断用） */
        async isSameTextFile(path, plain) {
          try {
            const app = getApp();
            const f = app.vault.getAbstractFileByPath(path);
            if (!f) return false;
            const existing = await app.vault.read(f);
            return existing.replace(/\r\n/g, "\n") === plain.replace(/\r\n/g, "\n");
          } catch (e) {
            return false;
          }
        }
        /** 解笔记正文明文（contentRef 镜像；无镜像返回 null） */
        async decryptNoteBody(note) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          if (!note.contentRef) return null;
          const cipher = await this.readMirror(note.contentRef);
          if (!cipher) return null;
          return CryptoService.decrypt(cipher, this.password);
        }
        /**
         * 读条目标题镜像的原始密文字符串（不解密，零 PBKDF2 开销）。
         * 供密码本等高频读侧做「内容未变」判等（密文字节相同 ⇒ 载荷未变，可复用上次解密结果）。
         * 无镜像返回 null。
         */
        async readNotePayloadRaw(note) {
          if (!note.contentRef) return null;
          return this.readMirror(note.contentRef);
        }
        /**
         * 加密日记条目还原：还原附件 → 把 finalBlock（由调用方准备，可为原文或改分类降级后重建）merge 回原日期 md → 取出即删。
         * 原子语义同 restoreNote：全部附件解密/校验成功且块就绪才写回；任一失败零落盘。
         */
        async restoreDiaryEntry(noteId, finalBlock) {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法还原加密日记");
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note || note.kind !== "diary-entry") throw new Error("未找到该加密日记条目");
          const conflicts = [];
          const plainAttachments = await mapLimit(
            note.attachments,
            BLOB_CONCURRENCY,
            async (a) => this.prepareRestoreAttachment(a)
          );
          note.attachments.forEach((a, i) => {
            if (plainAttachments[i] === null) conflicts.push(a.path);
          });
          if (!finalBlock) conflicts.push(note.path);
          if (conflicts.length > 0) return false;
          const created = [];
          try {
            for (let i = 0; i < note.attachments.length; i++) {
              const a = note.attachments[i];
              const wasCreated = await this.commitRestoreAttachment(a, plainAttachments[i]);
              if (wasCreated) created.push(a.path);
            }
            const ok = await this.mergeDiaryBlock(note.path, finalBlock);
            if (!ok) throw new Error("日记块 merge 失败");
          } catch (e) {
            for (const p of created) {
              try {
                await this.deleteVaultFile(p);
              } catch (err) {
              }
            }
            return false;
          }
          await this.deleteNoteMirrors(note);
          const idx = this.manifest.notes.indexOf(note);
          if (idx !== -1) this.manifest.notes.splice(idx, 1);
          try {
            await this.saveManifest();
          } catch (e) {
            return false;
          }
          return true;
        }
        /** 解加密日记正文明文（供日记域准备还原块；退回 null 表示解密失败） */
        async getDiaryEntryPlain(noteId) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note || note.kind !== "diary-entry") return null;
          return this.decryptNoteBody(note);
        }
        /**
         * 加密日记条目还原辅助：把 `# emoji HH:mm\n正文` 块 merge 回目标日期 md 文件。
         * 解析块首行标题取时间 → 按时间序把块重插进该日期文件（文件已删则新建）；非整文件覆盖（ADR-0017 Q23-A）。
         * @returns 成功写入返回 true；目标路径被占且非本系统（fingerprint 冲突）由附件层处理，正文 merge 属幂等写回。
         */
        async mergeDiaryBlock(datePath, block) {
          var _a2, _b2;
          const app = getApp();
          if (!datePath || !block) return false;
          const md = block.replace(/\r\n/g, "\n");
          const lines = md.split("\n");
          const headMatch = lines[0] ? lines[0].match(/^#\s+\S+\s+(\d{2}:\d{2})$/) : null;
          const time = headMatch ? headMatch[1] : null;
          const timeValue = time ? parseInt(time.slice(0, 2), 10) * 100 + parseInt(time.slice(3, 5), 10) : null;
          if (timeValue === null || Number.isNaN(timeValue)) return false;
          await this.ensureVaultParentFolder(datePath);
          const existing = app.vault.getAbstractFileByPath(datePath);
          let existingText = "";
          if (existing && existing.isFolder !== true) {
            existingText = await app.vault.read(existing);
          }
          const existingLines = existingText ? existingText.replace(/\r\n/g, "\n").split("\n") : [];
          const blockRows = [lines[0].trim()];
          const blockLines = [];
          for (let i = 1; i < lines.length; i++) blockLines.push(lines[i]);
          while (blockLines.length && blockLines[blockLines.length - 1].trim() === "") blockLines.pop();
          while (blockLines.length && blockLines[0].trim() === "") blockLines.shift();
          if (blockLines.length) {
            blockRows.push("");
            blockRows.push(...blockLines);
          }
          const headingRe = /^#\s+\S+\s+(\d{2}:\d{2})$/;
          const sigLines = (ls) => ls.map((l) => l.trim()).filter((l) => l !== "");
          const blockSig = sigLines(blockRows);
          let alreadyMerged = false;
          for (let i = 0; i < existingLines.length; i++) {
            if (existingLines[i].trim() !== lines[0].trim()) continue;
            const seg = [];
            for (let k = i + 1; k < existingLines.length && !headingRe.test(existingLines[k]); k++) seg.push(existingLines[k]);
            if (sigLines(seg).join("\n") === blockSig.slice(1).join("\n")) {
              alreadyMerged = true;
              break;
            }
          }
          if (alreadyMerged) return true;
          let insertIdx = existingLines.length;
          for (let i = 0; i < existingLines.length; i++) {
            const m = existingLines[i].match(headingRe);
            if (m) {
              const tv = parseInt(m[1].slice(0, 2), 10) * 100 + parseInt(m[1].slice(3, 5), 10);
              if (tv >= timeValue) {
                insertIdx = i;
                break;
              }
            }
          }
          const out = [];
          for (let i = 0; i < insertIdx; i++) out.push(existingLines[i]);
          if (insertIdx > 0 && existingLines[insertIdx - 1].trim() !== "") out.push("");
          out.push(...blockRows);
          if (insertIdx < existingLines.length && existingLines[insertIdx].trim() !== "") out.push("");
          for (let i = insertIdx; i < existingLines.length; i++) out.push(existingLines[i]);
          const clean = [];
          for (const ln of out) {
            if (ln.trim() === "") {
              if (clean.length && clean[clean.length - 1] !== "") clean.push("");
            } else {
              clean.push(ln);
            }
          }
          while (clean.length && clean[0] === "") clean.shift();
          while (clean.length && clean[clean.length - 1] === "") clean.pop();
          const finalText = clean.join("\n");
          if (existing && existing.isFolder !== true) {
            await app.vault.modify(existing, finalText);
          } else {
            const file = await app.vault.create(datePath, finalText);
            (_b2 = (_a2 = app.metadataCache) == null ? void 0 : _a2.trigger) == null ? void 0 : _b2.call(_a2, "changed", file);
          }
          return true;
        }
        /**
         * 还原准备（原子语义）：解镜像 → 完整性指纹校验 → 目标占用检查。
         * 完整性：镜像解密内容指纹必须与加密时记录一致（防镜像被篡改/替换），与目标是否被占无关；
         * 占用：目标已有文件时读其内容比对指纹——相同 = 本系统还原残留（幂等覆盖），不同 = 用户文件（冲突）。
         * @returns 明文 base64；null = 镜像缺失 / 解密失败 / 完整性不符 / 目标被用户占用（整体不落盘）
         */
        async prepareRestoreAttachment(a) {
          const password = this.password;
          if (!password) return null;
          const cipher = await this.readMirror(a.blobRef);
          if (cipher === null) return null;
          let plainB64;
          try {
            plainB64 = await CryptoService.decrypt(cipher, password);
          } catch (e) {
            return null;
          }
          const currentFp = await fingerprintOf(plainB64);
          if (currentFp !== a.fingerprint) return null;
          if (this.fileExists(a.path)) {
            try {
              const app = getApp();
              const existing = app.vault.getAbstractFileByPath(a.path);
              const buf = await app.vault.readBinary(existing);
              const existingFp = await fingerprintOf(bytesToBase64(new Uint8Array(buf)));
              if (existingFp !== a.fingerprint) return null;
            } catch (e) {
              return null;
            }
          }
          return plainB64;
        }
        /**
         * 还原提交（仅在全部分解/校验成功后调用）：把准备阶段解出的明文写回原路径（二进制）。
         * @returns 是否本次新建（true 时失败回滚可安全删除；false = 覆盖既有同指纹文件，不删）
         */
        async commitRestoreAttachment(a, plainB64) {
          var _a2, _b2;
          const app = getApp();
          const data = base64ToBytes(plainB64);
          const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          const existing = app.vault.getAbstractFileByPath(a.path);
          if (existing) {
            await app.vault.writeBinary(existing, buf);
            return false;
          }
          await this.ensureVaultParentFolder(a.path);
          const file = await app.vault.createBinary(a.path, buf);
          (_b2 = (_a2 = app.metadataCache) == null ? void 0 : _a2.trigger) == null ? void 0 : _b2.call(_a2, "changed", file);
          return true;
        }
        /** 删除一条加密笔记（连同镜像文件、清单记录）。谨慎：真删除不可恢复。 */
        async removeNote(noteId) {
          if (!this.unlocked) throw new Error("未解锁");
          const idx = this.manifest.notes.findIndex((n) => n.id === noteId);
          if (idx === -1) return;
          const note = this.manifest.notes[idx];
          if (note.contentRef) await this.deleteSafeFile(note.contentRef);
          for (const a of note.attachments) {
            await this.deleteSafeFile(a.blobRef);
            if (a.hasPreview) await this.deleteSafeFile(a.previewRef);
          }
          this.manifest.notes.splice(idx, 1);
          await this.saveManifest();
        }
        /**
         * 更新条目正文镜像（覆盖同一 contentRef，不产生孤儿镜像；清单同步持久化）。
         * 供密码本整表（password-vault）等高频改写载荷用：重用既有镜像名，避免每次新镜像堆积。
         * 覆盖走 replaceMirrorAtomic（P0-1）：暂存+rename 原子换入，任何写失败正式位保持旧完整密文。
         */
        async updateNotePayload(noteId, plainContent) {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法保存");
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note) throw new Error("未找到清单条目");
          const encrypted = await CryptoService.encrypt(plainContent, this.password);
          if (note.contentRef) {
            await this.replaceMirrorAtomic(note.contentRef, encrypted);
          } else {
            const ref = flatName();
            await this.replaceMirrorAtomic(ref, encrypted);
            note.contentRef = ref;
          }
          await this.saveManifest();
        }
        /** 解附件预览层 → dataUrl 明文（预览窗用；无预览层返回 null） */
        async decryptPreview(a) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          if (!a.hasPreview) return null;
          const cipher = await this.readMirror(a.previewRef);
          if (!cipher) return null;
          return CryptoService.decrypt(cipher, this.password);
        }
        /**
         * 解附件原始层 → 原始 base64（预览窗缩略图点击按需加载原图/视频用）。
         * 与预览层不同：走 blobRef 解原质量密文；无密文返回 null，解密失败向上抛（调用方兜底）。
         */
        async decryptAttachmentOriginal(a) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          const cipher = await this.readMirror(a.blobRef);
          if (!cipher) return null;
          return CryptoService.decrypt(cipher, this.password);
        }
      };
    }
  });

  // src/encrypt/preview.ts
  function canvasAvailable() {
    try {
      const c = document.createElement("canvas");
      return !!c.getContext && !!c.getContext("2d");
    } catch (e) {
      return false;
    }
  }
  function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(label + " 超时")), timeoutMs);
      promise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }
  function isEmptySrc(src) {
    return !src || !src.trim();
  }
  async function compressImage(src, maxSize = PREVIEW_OMIT_SIZE, quality = PREVIEW_OMIT_QUALITY) {
    if (!canvasAvailable() || isEmptySrc(src)) return null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = src;
    });
    try {
      await withTimeout(loaded, PREVIEW_TIMEOUT_MS, "图片加载");
    } catch (e) {
      return null;
    }
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, width: w, height: h };
  }
  async function videoFrame(src, maxSize = PREVIEW_OMIT_SIZE, quality = PREVIEW_OMIT_QUALITY) {
    if (!canvasAvailable() || !document.createElement("video") || isEmptySrc(src)) return null;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    const meta = new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("视频加载失败"));
      video.src = src;
    });
    try {
      await withTimeout(meta, PREVIEW_TIMEOUT_MS, "视频元数据加载");
    } catch (e) {
      return null;
    }
    const seek = new Promise((resolve, reject) => {
      const t = video.duration ? Math.min(0.1, video.duration / 2) : 0.1;
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("视频抽帧失败"));
      try {
        video.currentTime = t;
      } catch (e) {
        resolve();
      }
    });
    try {
      await withTimeout(seek, PREVIEW_TIMEOUT_MS, "视频抽帧");
    } catch (e) {
      return null;
    }
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (!vw || !vh) return null;
    const scale = Math.min(1, maxSize / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, width: w, height: h };
  }
  var PREVIEW_TIMEOUT_MS, PREVIEW_OMIT_SIZE, PREVIEW_OMIT_QUALITY;
  var init_preview = __esm({
    "src/encrypt/preview.ts"() {
      PREVIEW_TIMEOUT_MS = 5e3;
      PREVIEW_OMIT_SIZE = 384;
      PREVIEW_OMIT_QUALITY = 0.5;
    }
  });

  // src/encrypt/vault-data.ts
  var PASSWORD_VAULT_CHANNEL, ENCRYPT_CHANGED_CHANNEL2, VAULT_KIND, VAULT_PATH, VAULT_TITLE, PasswordVaultDataManager;
  var init_vault_data = __esm({
    "src/encrypt/vault-data.ts"() {
      init_domain_bus();
      PASSWORD_VAULT_CHANNEL = "password-vault:changed";
      ENCRYPT_CHANGED_CHANNEL2 = "encrypt:changed";
      VAULT_KIND = "password-vault";
      VAULT_PATH = "CONFIG/.ENCRYPT/passwords";
      VAULT_TITLE = "密码本";
      PasswordVaultDataManager = class {
        /** 显式注入 SafeManager（ADR-0085：encrypt Controller 装配同一单例，避免域内循环依赖默认取单例） */
        constructor(safe) {
          this.pwData = [];
          /** load 缓存（ticket 43 同款）：清单条目 + 原始密文字节；密文未变不重解密 */
          this.loadCache = null;
          /** 域事件退订 */
          this.offChanged = null;
          this.offEncryptChanged = null;
          /** 自身写盘中标志：save() 期间跳过外部事件重载（自己写的 encrypt:changed 广播不触发自重载） */
          this.saving = false;
          /** 外部变更回调（UI 订阅；外部改动 → 重载后回调） */
          this.onExternalChange = null;
          this.safe = safe;
          this.offChanged = onDomainEvent(PASSWORD_VAULT_CHANNEL, (evt) => {
            if ((evt == null ? void 0 : evt.source) === "password-vault") return;
            void this.reloadFromExternal();
          });
          this.offEncryptChanged = onDomainEvent(ENCRYPT_CHANGED_CHANNEL2, (evt) => {
            const note = this.vaultNote;
            if (!note || (evt == null ? void 0 : evt.noteId) && evt.noteId !== note.id) return;
            void this.reloadFromExternal();
          });
        }
        /** 解锁态 = 保险库解锁态（同一把主密码） */
        get unlocked() {
          return this.safe.unlocked;
        }
        /** 底层 SafeManager（锁屏/首设判定用；与数据层同一实例） */
        get safeManager() {
          return this.safe;
        }
        get vaultNote() {
          return this.safe.manifest.notes.find((n) => n.kind === VAULT_KIND) || null;
        }
        /** 外部变更处理：尝试重载（未解锁/失败静默，由 UI 自行决定展示） */
        async reloadFromExternal() {
          var _a2;
          if (this.saving) return;
          if (!this.safe.unlocked) return;
          try {
            await this.load();
            (_a2 = this.onExternalChange) == null ? void 0 : _a2.call(this);
          } catch (e) {
          }
        }
        async load() {
          if (!this.safe.unlocked) {
            throw new Error("未解锁，无法加载数据");
          }
          const note = this.vaultNote;
          if (!note) {
            this.pwData = [];
            this.loadCache = null;
            return;
          }
          const cipher = await this.safe.readNotePayloadRaw(note);
          if (this.loadCache && this.loadCache.noteId === note.id && this.loadCache.cipher === cipher) {
            return;
          }
          const plain = await this.safe.decryptNoteBody(note);
          if (plain === null) throw new Error("保险库数据解密失败");
          let parsed;
          try {
            parsed = JSON.parse(plain);
          } catch (e) {
            throw new Error("保险库数据损坏");
          }
          this.pwData = Array.isArray(parsed) ? parsed.filter((x) => !!x && typeof x === "object" && !Array.isArray(x)) : [];
          this.pwData = this.pwData.map((item) => {
            if (!item.id) item.id = `pw-${Date.now()}-${Math.random()}`;
            if (!item.platform) item.platform = "";
            if (!item.url) item.url = "";
            if (!item.account) item.account = "";
            if (!item.password) item.password = "";
            if (!item.note) item.note = "";
            if (!item.createdAt) item.createdAt = (/* @__PURE__ */ new Date()).toISOString();
            if (item.fav === void 0) item.fav = false;
            return item;
          });
          this.loadCache = { noteId: note.id, cipher };
        }
        async save() {
          if (!this.safe.unlocked) {
            throw new Error("未解锁，无法保存数据");
          }
          this.saving = true;
          try {
            const json = JSON.stringify(this.pwData, null, 2);
            const note = this.vaultNote;
            if (note) {
              await this.safe.updateNotePayload(note.id, json);
            } else {
              await this.safe.lockNote({
                path: VAULT_PATH,
                title: VAULT_TITLE,
                kind: VAULT_KIND,
                content: json,
                attachments: []
              });
            }
          } finally {
            this.saving = false;
          }
          emitDomainEvent(PASSWORD_VAULT_CHANNEL, { source: "password-vault" });
        }
        lock() {
          this.safe.lock();
          this.pwData = [];
          this.loadCache = null;
        }
        // ---------- 平台聚合 ----------
        platforms() {
          const map = /* @__PURE__ */ new Map();
          for (const d of this.pwData) {
            const key = d.platform || "(无平台)";
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(d);
          }
          const list = [];
          for (const [platform, accounts] of map) {
            accounts.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
            list.push({ platform, accounts });
          }
          list.sort((a, b) => {
            var _a2, _b2;
            return (((_a2 = a.accounts[0]) == null ? void 0 : _a2.createdAt) || "").localeCompare(((_b2 = b.accounts[0]) == null ? void 0 : _b2.createdAt) || "") * -1;
          });
          return list;
        }
        accountsOf(platform) {
          const key = platform || "(无平台)";
          return this.pwData.filter((d) => (d.platform || "(无平台)") === key).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
        }
        hasFav(platform) {
          return this.accountsOf(platform).some((d) => d.fav);
        }
        favCount(platform) {
          return this.accountsOf(platform).filter((d) => d.fav).length;
        }
        // ---------- 条目操作 ----------
        /** 内存快照（E1）：逐条浅拷贝——就地改对象的 mutator（toggleFav/updatePlatform）可回滚 */
        snapshot() {
          return this.pwData.map((d) => ({ ...d }));
        }
        /** 写事务（E1）：save 失败回滚内存到快照再 rethrow——磁盘/加密/清单写任一环节失败
         *  不残留幽灵条目/半改态（改盘前先恢复内存，交由 UI 层兜底提示 + 重渲染） */
        async saveWithRollback(snap) {
          try {
            await this.save();
          } catch (e) {
            this.pwData = snap;
            throw e;
          }
        }
        async addItem(item) {
          if (!this.unlocked) throw new Error("未解锁");
          const snap = this.snapshot();
          item.id = `pw-${Date.now()}-${Math.random()}`;
          item.createdAt = (/* @__PURE__ */ new Date()).toISOString();
          if (item.fav === void 0) item.fav = false;
          this.pwData.unshift(item);
          await this.saveWithRollback(snap);
        }
        async updateItem(id, newData) {
          if (!this.unlocked) throw new Error("未解锁");
          const index = this.pwData.findIndex((d) => d.id === id);
          if (index === -1) throw new Error("条目不存在");
          const snap = this.snapshot();
          this.pwData[index] = { ...this.pwData[index], ...newData };
          await this.saveWithRollback(snap);
        }
        async deleteItem(id) {
          if (!this.unlocked) throw new Error("未解锁");
          const index = this.pwData.findIndex((d) => d.id === id);
          if (index === -1) throw new Error("条目不存在");
          const snap = this.snapshot();
          this.pwData.splice(index, 1);
          await this.saveWithRollback(snap);
        }
        /** 删除整个平台（返回删除的账号数） */
        async removePlatform(platform) {
          if (!this.unlocked) throw new Error("未解锁");
          const key = platform || "(无平台)";
          const n = this.accountsOf(key).length;
          const snap = this.snapshot();
          this.pwData = this.pwData.filter((d) => (d.platform || "(无平台)") !== key);
          await this.saveWithRollback(snap);
          return n;
        }
        /** 编辑平台信息：改名/改链接应用到该平台全部账号 */
        async updatePlatform(platform, patch) {
          if (!this.unlocked) throw new Error("未解锁");
          const key = platform || "(无平台)";
          const target = (patch.platform || "").trim() || key;
          const snap = this.snapshot();
          for (const d of this.pwData) {
            if ((d.platform || "(无平台)") === key) {
              d.platform = target;
              if (patch.url !== void 0) d.url = patch.url.trim();
            }
          }
          await this.saveWithRollback(snap);
        }
        async toggleFav(id) {
          if (!this.unlocked) throw new Error("未解锁");
          const d = this.pwData.find((x) => x.id === id);
          if (!d) throw new Error("条目不存在");
          const snap = this.snapshot();
          d.fav = !d.fav;
          await this.saveWithRollback(snap);
        }
        async clearAll() {
          if (!this.unlocked) throw new Error("未解锁");
          const snap = this.snapshot();
          this.pwData = [];
          await this.saveWithRollback(snap);
        }
        /** 搜索：平台/账号/备注（与旧密码本同口径） */
        search(keyword) {
          if (!this.unlocked) throw new Error("未解锁");
          if (!keyword) return this.pwData;
          const lower = keyword.toLowerCase();
          return this.pwData.filter(
            (item) => (item.platform || "").toLowerCase().includes(lower) || (item.account || "").toLowerCase().includes(lower) || (item.note || "").toLowerCase().includes(lower)
          );
        }
        /** 卸载清理：退订域事件 */
        destroy() {
          var _a2, _b2;
          (_a2 = this.offChanged) == null ? void 0 : _a2.call(this);
          this.offChanged = null;
          (_b2 = this.offEncryptChanged) == null ? void 0 : _b2.call(this);
          this.offEncryptChanged = null;
        }
      };
    }
  });

  // src/encrypt/vault-pw-view.ts
  function relTime(iso) {
    if (!iso) return "";
    return formatRelativeTime(iso);
  }
  function dots(p) {
    return "•".repeat(Math.min((p || "").length, 18));
  }
  function colorOf(platform) {
    const k = Object.keys(PLATFORM_COLOR_MAP).find((x) => (platform || "").toLowerCase().includes(x.toLowerCase()));
    if (k) return PLATFORM_COLOR_MAP[k];
    let h = 0;
    for (let i = 0; i < (platform || "?").length; i++) h = h * 31 + (platform || "?").charCodeAt(i) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function avatarHTML(platform, url, cls = "bz-pwv-avatar") {
    const ch = (platform || "?").slice(0, 1);
    return `<div class="${cls}" style="background:${colorOf(platform)}" data-pwv-avatar="1" data-url="${escAttr(url || "")}"><span>${escAttr(ch)}</span></div>`;
  }
  function escAttr(s) {
    return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function hydratePwAvatars(scope) {
    scope.querySelectorAll("[data-pwv-avatar]").forEach((box) => {
      if (box.querySelector("img")) return;
      const url = box.getAttribute("data-url");
      let domain = null;
      try {
        domain = url ? new URL(url).hostname : null;
      } catch (e) {
        domain = null;
      }
      const img = createSiteIcon(domain, 64);
      if (img) {
        img.className = "bz-pwv-favicon";
        img.removeAttribute("style");
        img.addEventListener("load", () => {
          const ch = box.querySelector("span");
          if (ch) ch.style.display = "none";
        });
        box.appendChild(img);
      }
    });
  }
  var PLATFORM_COLOR_MAP, PALETTE, DEFAULT_PW_STATE, PW_REVEAL_AUTO_MASK_MS, VaultPwView, ICON_PATHS;
  var init_vault_pw_view = __esm({
    "src/encrypt/vault-pw-view.ts"() {
      init_dom();
      init_item_actions();
      init_utils();
      init_ui();
      PLATFORM_COLOR_MAP = {
        github: "#5a5f73",
        微信: "#3eb575",
        支付宝: "#4f7cf7",
        notion: "#111111",
        哔哩哔哩: "#fb7299",
        招商银行: "#d43d3d",
        豆瓣: "#3fa34d"
      };
      PALETTE = ["#7c6bd6", "#3e8e5a", "#c98a1e", "#4f7cf7", "#d43d3d", "#2a9d8f", "#b4551d", "#5a5f73"];
      DEFAULT_PW_STATE = {
        asset: "pw",
        view: "all",
        searchKw: "",
        selPlatform: null,
        selAccount: null,
        shownIds: {}
      };
      PW_REVEAL_AUTO_MASK_MS = 15e3;
      VaultPwView = class {
        constructor(dm, host, cfg) {
          /** 明文自动回遮计时器（按条目 id；手动隐藏/上锁即撤） */
          this.revealTimers = {};
          this.dm = dm;
          this.host = host;
          this.charset = cfg.charset || "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+";
          this.length = parseInt(String(cfg.length)) || 16;
        }
        /** 收藏星内联图标（替代 ★ 文本符号；图标一律 lucide——ui-kit 手册铁律） */
        starIc() {
          return `<span class="star">${this.ic("star", 11)}</span>`;
        }
        /** 撤销单条明文自动回遮计时 */
        clearRevealTimer(id) {
          if (this.revealTimers[id]) {
            clearTimeout(this.revealTimers[id]);
            delete this.revealTimers[id];
          }
        }
        /** 卸载清理：撤销全部明文自动回遮计时器（防插件禁用后定时器仍触发改 UI） */
        disposeRevealTimers() {
          for (const id of Object.keys(this.revealTimers)) {
            clearTimeout(this.revealTimers[id]);
            delete this.revealTimers[id];
          }
        }
        // ---------- 桌面列表 ----------
        /**
         * 渲染密码资产桌面列表（平台聚合行 / 搜索展平行）到 container。
         * row 点击 → onPick(platform 或 account)；右键/长按 → 统一抽屉（平台/账号动作）。
         */
        renderDeskList(container, st, onPick) {
          var _a2;
          container.innerHTML = "";
          const kw = st.searchKw;
          if (kw) {
            const hits = this.dm.search(kw).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
            if (!hits.length) {
              container.replaceChildren(this.emptyState("没有匹配的条目", "换个关键词，或清空搜索"));
              return;
            }
            for (const d of hits) {
              const r = document.createElement("div");
              r.className = "bz-pwv-row" + (d.id === st.selAccount ? " on" : "");
              r.innerHTML = `${avatarHTML(d.platform, d.url)}
          <div class="mid"><div class="pl">${this.esc(d.platform)}${d.fav ? " " + this.starIc() : ""}</div><div class="ac">${this.esc(d.account || "(无账号)")}</div></div>
          <div class="tm">${relTime(d.createdAt)}</div>`;
              r.addEventListener("click", () => onPick(d.platform, d.id));
              this.attachAccountActions(r, d);
              container.appendChild(r);
            }
            hydratePwAvatars(container);
            return;
          }
          let plats = this.dm.platforms();
          if (st.view === "fav") plats = plats.filter((p) => this.dm.hasFav(p.platform));
          if (!plats.length) {
            if (st.view === "fav") {
              container.replaceChildren(this.emptyState("还没有收藏", "右键或长按条目可收藏，常用账号一目了然"));
            } else {
              container.replaceChildren(this.emptyState("保险库还没有密码", "收录第一条账号开始使用", { add: true }));
              (_a2 = container.querySelector('[data-pwv="empty-add"]')) == null ? void 0 : _a2.addEventListener("click", () => this.host.openPwEntryDialog());
            }
            return;
          }
          for (const p of plats) {
            const r = document.createElement("div");
            r.className = "bz-pwv-plrow" + (p.platform === st.selPlatform ? " on" : "");
            const recent2 = p.accounts[0];
            const favStar = this.dm.hasFav(p.platform) ? " " + this.starIc() : "";
            const countBadge = p.accounts.length > 1 ? `<span class="bz-pwv-cnt">${p.accounts.length}</span>` : "";
            r.innerHTML = `${avatarHTML(p.platform, recent2 == null ? void 0 : recent2.url)}
        <div class="mid"><div class="pl">${this.esc(p.platform)}${favStar}${countBadge}</div><div class="ac">${recent2 ? this.esc(recent2.account || "(无账号)") : ""}</div></div>
        <div class="tm">${relTime(recent2 && recent2.createdAt)}</div>`;
            r.addEventListener("click", () => onPick(p.platform, null));
            this.attachPlatformActions(r, p.platform);
            container.appendChild(r);
          }
          hydratePwAvatars(container);
        }
        /** 渲染密码资产桌面详情区（平台账号卡流 / 搜索态单卡） */
        renderDeskDetail(container, st) {
          var _a2, _b2;
          container.innerHTML = "";
          const kw = st.searchKw;
          let d;
          if (kw) {
            d = this.dm.pwData.find((x) => x.id === st.selAccount);
            if (!d) {
              container.replaceChildren(this.emptyState("选择一条结果", "点击左侧结果查看详情"));
              return;
            }
          } else if (st.selPlatform) {
            const accs = this.dm.accountsOf(st.selPlatform);
            const filtered = st.view === "fav" ? accs.filter((x) => x.fav) : accs;
            const first = accs[0];
            const favStar = this.dm.hasFav(st.selPlatform) ? " " + this.starIc() : "";
            container.innerHTML = `<div class="bz-pwv-dhead">
        <div class="av big">${avatarHTML(st.selPlatform, first == null ? void 0 : first.url, "bz-pwv-avatar big")}</div>
        <div class="ttl"><h2>${this.esc(st.selPlatform)}${favStar}</h2>
          ${first && first.url ? `<a class="url" href="${this.esc(first.url)}" target="_blank" rel="noopener">${this.esc(first.url)} ↗</a>` : '<div class="url faint">无链接</div>'}</div>
        <div class="acts">
          <button class="bz-pwv-ic" data-pwv="plat-edit" title="编辑平台信息">${this.ic("pencil")}</button>
        </div>
      </div>
      <div class="bz-pwv-accthead">
        <div class="t">${filtered.length} 个账号</div>
        <button class="bz-pwv-addacct" data-pwv="plat-add">${this.ic("plus", 12)} 在该平台新增账号</button>
      </div>
      <div class="bz-pwv-accts"></div>`;
            const acctsEl = container.querySelector(".bz-pwv-accts");
            if (!filtered.length) {
              acctsEl.replaceChildren(this.emptyState("该平台暂无账号", "点上方「在该平台新增账号」录入"));
            } else {
              for (const x of filtered) acctsEl.appendChild(this.buildAccountCard(x, st));
            }
            (_a2 = container.querySelector('[data-pwv="plat-edit"]')) == null ? void 0 : _a2.addEventListener("click", () => this.host.openPwPlatformEdit(st.selPlatform));
            (_b2 = container.querySelector('[data-pwv="plat-add"]')) == null ? void 0 : _b2.addEventListener(
              "click",
              () => this.host.openPwEntryDialog(null, { platform: st.selPlatform || "", url: (first == null ? void 0 : first.url) || "" })
            );
            return;
          } else {
            container.replaceChildren(this.emptyState("选择一个平台", "左侧选择平台后，这里显示其全部账号", { icon: "key" }));
            return;
          }
          container.appendChild(this.buildAccountCard(d, st, true));
        }
        /** 单张账号卡（详情区复用）：复制账号常驻 + 密码行（显隐/复制）+ 备注 + 创建时间 */
        buildAccountCard(d, st, withHead = false) {
          const card = document.createElement("div");
          card.className = "bz-pwv-acctcard";
          const shown = !!st.shownIds[d.id];
          const accMeta = withHead ? `${this.esc(d.platform)}${d.fav ? " " + this.starIc() : ""}` : `${this.esc(d.account || "(无账号)")}${d.fav ? " " + this.starIc() : ""}`;
          card.innerHTML = `<div class="accrow">
      <div class="name">${accMeta}</div>
      <button class="copyac bz-touch-target--lg" data-pwv="copy-ac">${this.ic("copy")} 复制账号</button>
    </div>
    <div class="pwrow">
      <div class="pw ${shown ? "" : "mask"}">${shown ? this.esc(d.password) : dots(d.password)}</div>
      <button class="mini" data-pwv="eye" title="${shown ? "隐藏密码" : "显示密码"}">${shown ? this.ic("eye-off") : this.ic("eye")}</button>
      <button class="mini" data-pwv="copy-pw" title="复制密码">${this.ic("copy")}</button>
    </div>
    ${d.note ? `<div class="note">${this.esc(d.note)}</div>` : ""}
    <div class="meta">创建于 ${this.esc(new Date(d.createdAt).toLocaleDateString("zh-CN"))}${d.url ? ' · <a href="' + this.esc(d.url) + '" target="_blank" rel="noopener">' + this.esc(d.url.replace("https://", "")) + " ↗</a>" : ""}</div>`;
          card.querySelectorAll("[data-pwv]").forEach(
            (b) => b.addEventListener("click", (e) => {
              e.stopPropagation();
              this.dispatchAccountAction(d, b.dataset.pwv, st);
            })
          );
          this.attachAccountActions(card, d);
          return card;
        }
        /** 账号动作分发（卡片按钮 + 抽屉共用） */
        dispatchAccountAction(d, act, st) {
          var _a2, _b2;
          const t = (m, err = false) => this.host.toast(m, err);
          if (act === "copy-ac") {
            void this.host.copySensitive(d.account || "").then((ok) => ok ? t("账号已复制（60 秒后自动清空）") : t("复制失败，请手动复制", true), () => t("复制失败，请手动复制", true));
          } else if (act === "copy-pw") {
            void this.host.copySensitive(d.password || "").then((ok) => ok ? t("密码已复制（60 秒后自动清空）") : t("复制失败，请手动复制", true), () => t("复制失败，请手动复制", true));
          } else if (act === "eye") {
            const showing = !st.shownIds[d.id];
            st.shownIds[d.id] = showing;
            if (showing) {
              this.clearRevealTimer(d.id);
              this.revealTimers[d.id] = setTimeout(() => {
                var _a3, _b3;
                delete this.revealTimers[d.id];
                if (st.shownIds[d.id]) {
                  delete st.shownIds[d.id];
                  (_b3 = (_a3 = this.host).onPwChanged) == null ? void 0 : _b3.call(_a3);
                }
              }, PW_REVEAL_AUTO_MASK_MS);
            } else {
              this.clearRevealTimer(d.id);
            }
            (_b2 = (_a2 = this.host).onPwChanged) == null ? void 0 : _b2.call(_a2);
          } else if (act === "edit") {
            this.host.openPwEntryDialog(d);
          } else if (act === "fav") {
            void this.dm.toggleFav(d.id).then(() => {
              var _a3, _b3;
              return (_b3 = (_a3 = this.host).onPwChanged) == null ? void 0 : _b3.call(_a3);
            }).catch((e) => this.failToast(e));
          } else if (act === "del") {
            this.host.askConfirm("删除密码条目", `确定删除账号「${d.account}」吗？此操作不可撤销。`, "删除", () => {
              void this.dm.deleteItem(d.id).then(() => {
                var _a3, _b3;
                if (st.selAccount === d.id) st.selAccount = null;
                (_b3 = (_a3 = this.host).onPwChanged) == null ? void 0 : _b3.call(_a3);
                t(`已删除账号「${d.account}」`);
              }).catch((e) => this.failToast(e));
            });
          }
        }
        /** E2：写动作失败统一提示 + 重渲染（数据层已回滚内存，按真实状态收敛） */
        failToast(e) {
          var _a2, _b2;
          this.host.toast(`保存失败：${(e == null ? void 0 : e.message) || e}`, true);
          (_b2 = (_a2 = this.host).onPwChanged) == null ? void 0 : _b2.call(_a2);
        }
        /** 账号动作集（行卡右键/长按与移动账号详情页 ⋮ 共用） */
        accountActions(d) {
          return [
            {
              icon: "copy",
              label: "复制账号",
              onClick: () => void this.host.copySensitive(d.account || "").then((ok) => this.host.toast(ok ? "账号已复制（60 秒后自动清空）" : "复制失败", !ok), () => this.host.toast("复制失败", true))
            },
            {
              icon: "key",
              label: "复制密码",
              onClick: () => void this.host.copySensitive(d.password || "").then((ok) => this.host.toast(ok ? "密码已复制（60 秒后自动清空）" : "复制失败", !ok), () => this.host.toast("复制失败", true))
            },
            {
              icon: "star",
              label: d.fav ? "取消收藏" : "收藏",
              onClick: () => void this.dm.toggleFav(d.id).then(() => {
                var _a2, _b2;
                return (_b2 = (_a2 = this.host).onPwChanged) == null ? void 0 : _b2.call(_a2);
              }).catch((e) => this.failToast(e))
            },
            {
              icon: "external-link",
              label: "打开链接",
              onClick: () => d.url ? this.host.openExternal(d.url) : this.host.toast("该条目没有链接", true)
            },
            { icon: "pencil", label: "编辑", onClick: () => this.host.openPwEntryDialog(d) },
            {
              icon: "trash-2",
              label: "删除",
              kind: "danger",
              onClick: () => this.host.askConfirm("删除密码条目", `确定删除账号「${d.account}」吗？此操作不可撤销。`, "删除", () => {
                void this.dm.deleteItem(d.id).then(() => {
                  var _a2, _b2;
                  (_b2 = (_a2 = this.host).onPwChanged) == null ? void 0 : _b2.call(_a2);
                  this.host.toast(`已删除账号「${d.account}」`);
                }).catch((e) => this.failToast(e));
              })
            }
          ];
        }
        attachAccountActions(el, d) {
          attachItemActions(el, this.accountActions(d), { sheetHead: this.buildSheetHead(d) });
        }
        /** 移动端账号详情页 ⋮：直接开底部抽屉（抽屉手势挂行卡上，详情页按钮触达不了——E6） */
        openAccountSheet(d) {
          openItemSheet(this.accountActions(d), { sheetHead: this.buildSheetHead(d) });
        }
        /** 平台动作集（行卡右键/长按与移动平台详情页 ⋮ 共用） */
        platformActions(platform) {
          const accs = this.dm.accountsOf(platform);
          const recent2 = accs[0];
          const count = accs.length;
          const actions = [
            {
              icon: "plus",
              label: "在该平台新增账号",
              onClick: () => this.host.openPwEntryDialog(null, { platform, url: (recent2 == null ? void 0 : recent2.url) || "" })
            }
          ];
          if (recent2) {
            actions.push({
              icon: "copy",
              label: "复制最近账号",
              onClick: () => void this.host.copySensitive(recent2.account || "").then((ok) => this.host.toast(ok ? "最近账号已复制" : "复制失败", !ok), () => this.host.toast("复制失败", true))
            });
            actions.push({
              icon: "key",
              label: "复制最近密码",
              onClick: () => void this.host.copySensitive(recent2.password || "").then((ok) => this.host.toast(ok ? "最近密码已复制" : "复制失败", !ok), () => this.host.toast("复制失败", true))
            });
          }
          actions.push({ icon: "pencil", label: "编辑平台信息", onClick: () => this.host.openPwPlatformEdit(platform) });
          actions.push({
            icon: "trash-2",
            label: "删除整个平台",
            kind: "danger",
            onClick: () => this.host.askConfirm("删除整个平台", `将删除「${platform}」的 ${count} 个账号，此操作不可撤销。确定继续？`, "删除", () => {
              void this.dm.removePlatform(platform).then(() => {
                var _a2, _b2;
                (_b2 = (_a2 = this.host).onPwChanged) == null ? void 0 : _b2.call(_a2);
                this.host.toast(`已删除平台与 ${count} 个账号`);
              }).catch((e) => this.failToast(e));
            })
          });
          return actions;
        }
        platformSheetOpts(platform) {
          const recent2 = this.dm.accountsOf(platform)[0];
          return { sheetHead: this.buildSheetHead(recent2 != null ? recent2 : { account: platform, platform, createdAt: "" }) };
        }
        attachPlatformActions(el, platform) {
          attachItemActions(el, this.platformActions(platform), this.platformSheetOpts(platform));
        }
        /** 移动端平台详情页 ⋮：直接开底部抽屉（E6 同款） */
        openPlatformSheet(platform) {
          openItemSheet(this.platformActions(platform), this.platformSheetOpts(platform));
        }
        // ---------- 移动端卡流 ----------
        /** 渲染移动端密码卡流（平台卡；fav 过滤 view 由调用方传入 st） */
        renderMobList(container, st, onOpenPlatform) {
          var _a2;
          container.innerHTML = "";
          const kw = st.searchKw;
          if (kw) {
            const hits = this.dm.search(kw).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
            if (!hits.length) {
              container.replaceChildren(this.emptyState("没有匹配的条目", "换个关键词试试"));
              return;
            }
            for (const d of hits) {
              const c = document.createElement("div");
              c.className = "bz-pwv-mobcard";
              c.innerHTML = `${avatarHTML(d.platform, d.url, "bz-pwv-avatar av")}
          <div class="mid"><div class="a">${this.esc(d.platform)}${d.fav ? " " + this.starIc() : ""}</div><div class="b">${this.esc(d.account || "(无账号)")}</div></div>
          <span class="go">${this.ic("chevron-right")}</span>`;
              c.addEventListener("click", () => {
                var _a3, _b2;
                return (_b2 = (_a3 = this.host).openPwAccountPage) == null ? void 0 : _b2.call(_a3, d, st);
              });
              this.attachAccountActions(c, d);
              container.appendChild(c);
            }
            hydratePwAvatars(container);
            return;
          }
          let plats = this.dm.platforms();
          if (st.view === "fav") plats = plats.filter((p) => this.dm.hasFav(p.platform));
          if (!plats.length) {
            if (st.view === "fav") {
              container.replaceChildren(this.emptyState("还没有收藏", "右键或长按条目可收藏，常用账号一目了然"));
            } else {
              container.replaceChildren(this.emptyState("保险库还没有密码", "收录第一条账号开始使用", { add: true }));
              (_a2 = container.querySelector('[data-pwv="empty-add"]')) == null ? void 0 : _a2.addEventListener("click", () => this.host.openPwEntryDialog());
            }
            return;
          }
          for (const p of plats) {
            const recent2 = p.accounts[0];
            const c = document.createElement("div");
            c.className = "bz-pwv-mobcard";
            const favStar = this.dm.hasFav(p.platform) ? " " + this.starIc() : "";
            const cnt = p.accounts.length > 1 ? `<span class="cnt">${p.accounts.length}</span>` : "";
            c.innerHTML = `${avatarHTML(p.platform, recent2 == null ? void 0 : recent2.url, "bz-pwv-avatar av")}
        <div class="mid"><div class="a">${this.esc(p.platform)}${favStar}${cnt}</div><div class="b">${recent2 ? this.esc(recent2.account || "(无账号)") : ""}</div></div>
        <span class="go">${this.ic("chevron-right")}</span>`;
            c.addEventListener("click", () => onOpenPlatform(p));
            this.attachPlatformActions(c, p.platform);
            container.appendChild(c);
          }
          hydratePwAvatars(container);
        }
        /** 平台详情页（移动）HTML 注入 body；含账号卡与操作 */
        renderMobPlatformPage(body, p, st) {
          var _a2;
          const accs = p.accounts;
          const first = accs[0];
          const favStar = this.dm.hasFav(p.platform) ? ' <span class="star">★</span>' : "";
          body.innerHTML = `<div class="bz-pwv-mobplathead">
      <div class="av big">${avatarHTML(p.platform, first == null ? void 0 : first.url, "bz-pwv-avatar big")}</div>
      <div><div class="nm">${this.esc(p.platform)}${favStar}</div>
        ${first && first.url ? `<a class="url" href="${this.esc(first.url)}" target="_blank" rel="noopener">${this.esc(first.url)} ↗</a>` : '<div class="url faint">无链接</div>'}</div>
      <button class="bz-pwv-btn gold" data-pwv="plat-add">${this.ic("plus", 12)} 新增账号</button>
    </div>
    <div class="bz-pwv-accts"></div>`;
          const acctsEl = body.querySelector(".bz-pwv-accts");
          if (!accs.length) {
            acctsEl.replaceChildren(this.emptyState("该平台暂无账号", "点上方「在该平台新增账号」录入"));
          } else {
            for (const d of accs) acctsEl.appendChild(this.buildAccountCard(d, st));
          }
          (_a2 = body.querySelector('[data-pwv="plat-add"]')) == null ? void 0 : _a2.addEventListener(
            "click",
            () => this.host.openPwEntryDialog(null, { platform: p.platform, url: (first == null ? void 0 : first.url) || "" })
          );
        }
        // ---------- 抽屉头 ----------
        buildSheetHead(d) {
          const head = document.createElement("div");
          head.className = "bz-item-sheet-entry";
          const body = document.createElement("div");
          body.style.cssText = "display:flex; align-items:flex-start; gap:10px;";
          const emoji = document.createElement("span");
          emoji.className = "bz-item-sheet-emoji";
          emoji.textContent = "🔑";
          body.appendChild(emoji);
          const info = document.createElement("div");
          info.style.cssText = "flex:1; min-width:0;";
          const t = document.createElement("div");
          t.className = "bz-item-sheet-title";
          t.textContent = d.account || d.platform;
          info.appendChild(t);
          const s = document.createElement("div");
          s.className = "bz-item-sheet-sub";
          s.textContent = `${d.platform}${d.platform ? " · " : ""}${relTime(d.createdAt)}`;
          info.appendChild(s);
          body.appendChild(info);
          head.appendChild(body);
          return head;
        }
        // ---------- lucide 图标 ----------
        ic(name, size = 14) {
          const p = (name2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name2] || ""}</svg>`;
          return p(name);
        }
        /** 空态（组件库 uiEmpty = .bz-empty 基线）；add = 附「新增密码」金色 CTA（金库主题色，域内样式） */
        emptyState(title, desc, opts) {
          const empty = uiEmpty((opts == null ? void 0 : opts.icon) ? { icon: opts.icon, title, desc } : { title, desc });
          if (opts == null ? void 0 : opts.add) {
            const add = document.createElement("button");
            add.className = "bz-pwv-empty-add bz-touch-target--lg";
            add.setAttribute("data-pwv", "empty-add");
            add.innerHTML = `${this.ic("plus")} 新增密码`;
            empty.appendChild(add);
          }
          return empty;
        }
        esc(s) {
          return escapeHtml(String(s != null ? s : ""));
        }
      };
      ICON_PATHS = {
        copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/>',
        star: '<path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/>',
        "external-link": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        "trash-2": '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        "eye-off": '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        "chevron-right": '<path d="m9 18 6-6-6-6"/>'
      };
    }
  });

  // src/encrypt/pw-picker.ts
  function fuzzyScore(hay, query) {
    if (!query) return 0;
    const h = (hay || "").toLowerCase();
    const q = query.toLowerCase();
    const idx = h.indexOf(q);
    if (idx >= 0) return 1e3 - idx;
    let hi = 0;
    for (let qi = 0; qi < q.length; qi++) {
      hi = h.indexOf(q[qi], hi);
      if (hi === -1) return -1;
      hi++;
    }
    return 100;
  }
  function fuzzyFilterEntries(entries, query) {
    const hits = [];
    for (const e of entries) {
      const score = Math.max(
        fuzzyScore(e.platform || "", query),
        fuzzyScore(e.account || "", query),
        fuzzyScore(e.note || "", query)
      );
      if (score >= 0) hits.push({ e, score });
    }
    hits.sort((a, b) => b.score - a.score || (b.e.createdAt || "").localeCompare(a.e.createdAt || ""));
    return hits.map((h) => h.e);
  }
  function closePasswordQuickPicker() {
    if (currentMask2) {
      currentMask2.remove();
      currentMask2 = null;
    }
    if (currentPopup2) {
      currentPopup2.remove();
      currentPopup2 = null;
    }
    if (currentHandle2) {
      currentHandle2.unregister();
      currentHandle2 = null;
    }
    if (focusTimer2 !== null) {
      window.clearTimeout(focusTimer2);
      focusTimer2 = null;
    }
  }
  function openPasswordQuickPicker(entries, onPick) {
    closePasswordQuickPicker();
    const { mask, popup } = createOverlay({
      maskId: "bz-encrypt-pw-picker-mask",
      popupId: "bz-encrypt-pw-picker-popup",
      width: "min(calc(100vw - 32px), 420px)",
      maxWidth: 420,
      onMaskClick: () => closePasswordQuickPicker()
    });
    currentMask2 = mask;
    currentPopup2 = popup;
    popup.classList.add("bz-encrypt-pwqp");
    popup.style.height = "min(420px, 72vh)";
    const head = document.createElement("div");
    head.className = "bz-encrypt-pwqp-head";
    const title = document.createElement("h3");
    title.className = "bz-encrypt-pwqp-title";
    title.textContent = "快速复制密码";
    head.appendChild(title);
    const search = document.createElement("input");
    search.type = "text";
    search.className = "bz-input bz-encrypt-pwqp-search";
    search.placeholder = "搜索平台 / 账号…";
    search.spellcheck = false;
    search.setAttribute("aria-label", "搜索密码条目");
    const listEl = document.createElement("div");
    listEl.className = "bz-encrypt-pwqp-list";
    const state = { hits: [], active: 0 };
    const setActive = (i) => {
      var _a2;
      if (!state.hits.length) return;
      state.active = Math.max(0, Math.min(state.hits.length - 1, i));
      listEl.querySelectorAll(".bz-popover-item").forEach((el, k) => {
        el.classList.toggle("is-on", k === state.active);
      });
      (_a2 = listEl.querySelector(".bz-popover-item.is-on")) == null ? void 0 : _a2.scrollIntoView({ block: "nearest" });
    };
    const renderList = () => {
      listEl.innerHTML = "";
      state.hits = fuzzyFilterEntries(entries, search.value.trim());
      state.active = 0;
      if (!state.hits.length) {
        const empty = document.createElement("div");
        empty.className = "bz-popover-empty";
        empty.textContent = "没有匹配的密码条目";
        listEl.appendChild(empty);
        return;
      }
      const shown = state.hits.slice(0, LIMIT);
      shown.forEach((d, i) => {
        const row = document.createElement("div");
        row.className = "bz-popover-item" + (i === 0 ? " is-on" : "");
        row.setAttribute("role", "option");
        const mid = document.createElement("div");
        mid.className = "mid";
        const pl = document.createElement("div");
        pl.className = "pl";
        pl.textContent = d.platform || "(无平台)";
        const ac = document.createElement("div");
        ac.className = "ac";
        ac.textContent = d.account || "(无账号)";
        mid.appendChild(pl);
        mid.appendChild(ac);
        const key = document.createElement("span");
        key.className = "key";
        key.textContent = "Enter 复制";
        row.appendChild(mid);
        row.appendChild(key);
        row.addEventListener("click", () => {
          closePasswordQuickPicker();
          onPick(d);
        });
        listEl.appendChild(row);
      });
      if (state.hits.length > LIMIT) {
        const more = document.createElement("div");
        more.className = "bz-popover-empty";
        more.textContent = `已显示前 ${LIMIT} 条（共 ${state.hits.length} 条命中），请输入关键词缩小范围`;
        listEl.appendChild(more);
      }
    };
    search.addEventListener("input", () => renderList());
    search.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(state.active + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(state.active - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const d = state.hits[state.active];
        if (d) {
          closePasswordQuickPicker();
          onPick(d);
        }
      }
    });
    popup.append(head, search, listEl);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = "block";
    popup.style.display = "flex";
    currentHandle2 = escManager.register("bz-encrypt-pw-picker", {
      isVisible: () => !!currentMask2,
      close: () => closePasswordQuickPicker()
    });
    renderList();
    focusTimer2 = window.setTimeout(() => {
      focusTimer2 = null;
      if (mask.isConnected) search.focus();
    }, 30);
  }
  var LIMIT, currentMask2, currentPopup2, currentHandle2, focusTimer2;
  var init_pw_picker = __esm({
    "src/encrypt/pw-picker.ts"() {
      init_dom();
      init_esc_manager();
      LIMIT = 100;
      currentMask2 = null;
      currentPopup2 = null;
      currentHandle2 = null;
      focusTimer2 = null;
    }
  });

  // src/encrypt/vault-assets-view.ts
  function vIc(name, size = 14) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS2[name] || ""}</svg>`;
  }
  function overviewHTML(stats) {
    const { counts, pwPlatforms, pwFavPlatforms, attachments, recent: recent2, health } = stats;
    const total = counts.pw + counts.note + counts.diary;
    const pwFav = counts.pw ? `${pwFavPlatforms} 个平台已收藏 · ` : "";
    const noteCd = counts.note ? `含 ${attachments} 个附件镜像` : "还没有加密笔记";
    const pwCd = counts.pw ? `${pwFav}${pwPlatforms} 个平台` : "还没有密码";
    const healthRows = health == null ? `<div class="bz-vault-hrow"><span class="dot" style="background:var(--bz-text-3)"></span><span class="lbl">待处理</span><span class="n">未体检</span></div>` : `<div class="bz-vault-hrow"><span class="dot" style="background:${health.issues ? "var(--bz-danger)" : "var(--bz-success)"}"></span><span class="lbl">待处理</span><span class="n">${health.issues}</span></div>`;
    const recentRows = recent2.length ? recent2.map((r) => {
      const color = r.kind === "pw" ? ASSET_COLOR.pw : r.kind === "note" ? ASSET_COLOR.note : ASSET_COLOR.diary;
      const iconName = r.kind === "pw" ? "key" : r.kind === "note" ? "file-lock" : "book-lock";
      return `<div class="bz-vault-minirow" data-recent="${r.kind}">
            <span class="av" style="background:${color}">${vIc(iconName, 14)}</span>
            <div class="mid"><div class="a">${escapeHtml(r.title)}</div><div class="b">${escapeHtml(r.sub)}</div></div>
            <span class="tm">${escapeHtml(r.time)}</span></div>`;
    }).join("") : '<div class="bz-empty"><span class="bz-empty-ic">' + vIc("lock", 28) + '</span><div class="bz-empty-title">还没有加密资产</div><div class="bz-empty-desc">录入密码、加密笔记或加密日记后，最近动态在这里显示</div></div>';
    return `
  <div class="bz-vault-hero">
    <div class="ht">${vIc("lock", 14)} 保险库已解锁 · 三类资产集中管理</div>
    <div class="hn">${total} 项资产${total > 0 ? " · 尽在掌握" : ""}</div>
    <div class="hd">密码 · 加密笔记 · 加密日记 — 同一把主密码，AES-256-GCM</div>
    <div class="hbtns">
      <button class="hbtn" data-hero="lock-note">${vIc("file-lock", 14)} 加密当前笔记</button>
      <button class="hbtn" data-hero="add-pw">${vIc("key", 14)} 新增密码</button>
      <button class="hbtn" data-hero="health">${vIc("stethoscope", 14)} 体检</button>
    </div>
  </div>
  <div class="bz-vault-cards">
    <div class="card" data-nav="pw">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.pw}">${vIc("key", 13)}</span>密码条目</div>
      <div class="num">${counts.pw}<small>个账号</small></div>
      <div class="cd">${pwCd}</div>
    </div>
    <div class="card" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc("file-lock", 13)}</span>加密笔记</div>
      <div class="num">${counts.note}<small>篇</small></div>
      <div class="cd">${noteCd}</div>
    </div>
    <div class="card" data-nav="diary">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.diary}">${vIc("book-lock", 13)}</span>加密日记</div>
      <div class="num">${counts.diary}<small>篇</small></div>
      <div class="cd">随日记面板「加密」分类移入</div>
    </div>
  </div>
  <div class="bz-vault-two">
    <div class="panel">
      <div class="pt">最近加密<span class="more" data-hero="recent-all">查看全部 →</span></div>
      ${recentRows}
    </div>
    <div class="panel" data-hero="health" title="打开保险库体检">
      <div class="pt">保险库体检<span class="more">查看 →</span></div>
      ${healthRows}
      <div class="bz-vault-hrow"><span class="dot" style="background:var(--bz-text-3)"></span><span class="lbl">完整性校验</span><span class="n">${(health == null ? void 0 : health.lastChecked) || "—"}</span></div>
    </div>
  </div>`;
  }
  function noteRowHTML(note, kind, active) {
    const color = ASSET_COLOR[kind];
    const iconName = kind === "note" ? "file-lock" : "book-lock";
    const sub = kind === "note" ? `${note.attachments.length} 个附件 · ${escapeHtml(note.path)}` : (note.path.split("/").pop() || note.title) + (note.attachments.length ? ` · ${note.attachments.length} 个附件` : "");
    return `
    <div class="bz-vault-row ${active ? "on" : ""}" data-noteid="${escapeHtml(note.id)}" data-kind="${kind}">
      <span class="av" style="background:${color}">${vIc(iconName, 16)}</span>
      <div class="mid"><div class="t1">${escapeHtml(note.title)}</div><div class="t2">${sub}</div></div>
      <span class="tm">${escapeHtml(formatRelativeTime(note.createdAt))}</span>
    </div>`;
  }
  function noteDetailHTML(note, kind, plainPreview) {
    const color = ASSET_COLOR[kind];
    const iconName = kind === "note" ? "file-lock" : "book-lock";
    const attChips = note.attachments.length ? note.attachments.slice(0, 6).map((a) => {
      const kb = a.blobSize ? Math.max(1, Math.round(a.blobSize / 1024)) : 0;
      const kindIc = vIc(a.kind === "video" ? "film" : "image", 12);
      return `<span class="chip att">${kindIc} ${escapeHtml(a.path.split("/").pop() || a.path)}${kb ? ` · ${kb} KB` : ""}</span>`;
    }).join("") + (note.attachments.length > 6 ? `<span class="chip">+${note.attachments.length - 6} 更多</span>` : "") : '<span class="chip">无附件</span>';
    const pathLine = kind === "note" ? `${escapeHtml(note.path)} · 已移出` : `${escapeHtml(note.path)} · 已还原该段`;
    const created = new Date(note.createdAt).toLocaleString("zh-CN", { hour12: false });
    const actionBtns = kind === "note" ? `<button class="bbtn teal" data-detail="preview">${vIc("eye", 14)} 预览</button>
         <button class="bbtn" data-detail="restore">${vIc("download", 14)} 还原到原路径</button>
         <button class="bbtn danger" data-detail="delete">${vIc("trash-2", 14)} 删除</button>` : `<button class="bbtn" style="background:${color};color:#fff" data-detail="restore-diary">${vIc("download", 14)} 还原回日记</button>
         <button class="bbtn" data-detail="copy-diary">${vIc("copy", 14)} 复制正文</button>
         <button class="bbtn danger" data-detail="destroy-diary">${vIc("trash-2", 14)} 彻底销毁</button>`;
    return `
    <div class="bz-vault-dhead">
      <span class="big" style="background:${color}">${vIc(iconName, 21)}</span>
      <div class="ttl"><h2>${escapeHtml(note.title)}</h2><div class="url">${pathLine}</div></div>
      <div class="acts"><button class="ic" data-detail="menu" title="更多操作">${vIc("more-h", 15)}</button></div>
    </div>
    <div class="bz-vault-dcontent">
      ${kind === "note" ? `<div class="field"><div class="lab">附件镜像</div><div class="valrow chips">${attChips}</div></div>
           <div class="field"><div class="lab">加密时间</div><div class="valrow"><span class="val">${escapeHtml(created)}</span></div></div>
           <div class="note hint">原笔记正文已 100% 密文化；双击列表行可压缩预览（原图按需加载原层）。</div>` : `<div class="field"><div class="lab">正文预览</div><div class="note pre">${plainPreview ? escapeHtml(plainPreview).replace(/\n/g, "<br>") : "（未解密预览）"}</div></div>
           <div class="field"><div class="lab">加密于</div><div class="valrow"><span class="val">${escapeHtml(created)}</span></div></div>`}
      <div class="bigbtns">${actionBtns}</div>
    </div>`;
  }
  var ASSET_COLOR, ICON_PATHS2;
  var init_vault_assets_view = __esm({
    "src/encrypt/vault-assets-view.ts"() {
      init_utils();
      ASSET_COLOR = {
        pw: "var(--bz-brand)",
        note: "#2e7d68",
        diary: "#5a63a8"
      };
      ICON_PATHS2 = {
        lock: '<rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        "lock-open": '<rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 7.9-.9"/>',
        key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/>',
        "file-lock": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 12v4"/><circle cx="12" cy="9" r="1.4" fill="currentColor" stroke="none"/>',
        "book-lock": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
        "trash-2": '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
        copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        "more-h": '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
        stethoscope: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
        "refresh-cw": '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        "chevron-left": '<path d="m15 18-6-6 6-6"/>',
        star: '<path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/>',
        "star-outline": '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
        "layout-grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        "eye-off": '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/>',
        "triangle-alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.73-2"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
        image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'
      };
    }
  });

  // src/encrypt/ui.ts
  function statusbarHtml(unlocked) {
    return `${vIc(unlocked ? "lock-open" : "lock", 12)} 保险库`;
  }
  function secureRandomPassword(length, charset) {
    const n = charset.length;
    if (!(length > 0) || n === 0) return "";
    const LIMIT2 = Math.floor(4294967296 / n) * n;
    let pwd = "";
    while (pwd.length < length) {
      const buf = new Uint32Array(length - pwd.length);
      crypto.getRandomValues(buf);
      for (let i = 0; i < buf.length && pwd.length < length; i++) {
        if (buf[i] >= LIMIT2) continue;
        pwd += charset.charAt(buf[i] % n);
      }
    }
    return pwd;
  }
  function cancelClipboardClear() {
    if (clipboardClearTimer !== null) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }
  }
  function armClipboardClear() {
    if (clipboardClearTimer !== null) clearTimeout(clipboardClearTimer);
    clipboardClearTimer = setTimeout(() => {
      clipboardClearTimer = null;
      try {
        void navigator.clipboard.writeText("").catch(() => {
        });
      } catch (e) {
      }
    }, CLIPBOARD_CLEAR_DELAY_MS);
  }
  function copySensitiveText(text) {
    try {
      return navigator.clipboard.writeText(text).then(() => armClipboardClear());
    } catch (e) {
      return Promise.reject(e);
    }
  }
  function passwordStrength(pw) {
    if (!pw) return "weak";
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score <= 2 ? "weak" : score <= 4 ? "mid" : "strong";
  }
  function pwStrengthLabel(s) {
    return s === "weak" ? "弱" : s === "mid" ? "中" : "强";
  }
  function collectNoteAttachments(content, embedLinks, vaultFiles) {
    const refs = /* @__PURE__ */ new Set();
    for (const l of embedLinks) {
      if (l && typeof l === "string") refs.add(l.trim());
    }
    const wiki = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
    let m;
    while ((m = wiki.exec(content)) !== null) refs.add(m[1].trim());
    const mdImg = /!\[[^\]]*\]\(([^)\s]+)\)/g;
    while ((m = mdImg.exec(content)) !== null) refs.add(m[1].trim());
    const vid = /<video[^>]*src=["']([^"']+)["']/g;
    while ((m = vid.exec(content)) !== null) refs.add(m[1].trim());
    const paths = /* @__PURE__ */ new Set();
    const byName = /* @__PURE__ */ new Map();
    for (const f of vaultFiles) {
      paths.add(f.path);
      const name = f.path.slice(f.path.lastIndexOf("/") + 1);
      if (name && !byName.has(name)) byName.set(name, f.path);
    }
    const valid = /* @__PURE__ */ new Set();
    for (const r of refs) {
      if (!r) continue;
      const clean = decodeURIComponent(r).replace(/^\.\//, "");
      let hit;
      if (paths.has(clean)) hit = clean;
      else if (!clean.includes("/")) hit = byName.get(clean);
      else {
        for (const p of paths) {
          if (p.endsWith("/" + clean)) {
            hit = p;
            break;
          }
        }
      }
      if (hit) valid.add(hit);
    }
    return [...valid];
  }
  function collectNoteAttachmentPaths(app, file, content) {
    var _a2, _b2, _c;
    const embedLinks = [];
    try {
      const cache = (_b2 = (_a2 = app == null ? void 0 : app.metadataCache) == null ? void 0 : _a2.getFileCache) == null ? void 0 : _b2.call(_a2, file);
      const embeds = cache && Array.isArray(cache.embeds) ? cache.embeds : [];
      for (const e of embeds) {
        if (e && typeof e.link === "string") embedLinks.push(e.link);
      }
    } catch (e) {
    }
    const vaultFiles = ((_c = app == null ? void 0 : app.vault) == null ? void 0 : _c.getFiles) && app.vault.getFiles() || [];
    return collectNoteAttachments(content, embedLinks, vaultFiles);
  }
  function kindOf(path) {
    var _a2;
    const ext = ((_a2 = path.split(".").pop()) == null ? void 0 : _a2.toLowerCase()) || "";
    return /^(mp4|webm|mov|mkv|avi|m4v|ogv)$/.test(ext) ? "video" : "image";
  }
  function mimeOf(path) {
    var _a2;
    const ext = ((_a2 = path.split(".").pop()) == null ? void 0 : _a2.toLowerCase()) || "";
    const IMG = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      avif: "image/avif"
    };
    const VID = {
      mp4: "video/mp4",
      m4v: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      avi: "video/x-msvideo",
      ogv: "video/ogg"
    };
    return IMG[ext] || VID[ext] || "application/octet-stream";
  }
  function collectMediaSlots(md, attachments) {
    const re = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\(([^)\s]+)\)|<video[^>]*src=["']([^"']+)["']/g;
    const slots = [];
    const inlined = /* @__PURE__ */ new Set();
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(md)) !== null) {
      const target = (m[1] || m[2] || m[3] || "").trim().replace(/^\.\//, "");
      const att = findAttachment(target, attachments);
      const token = "@@ENC_MEDIA_" + slots.length + "@@";
      slots.push({ attachment: att != null ? att : null, token });
      if (att) inlined.add(att.path);
      out += md.slice(last, m.index) + token;
      last = m.index + m[0].length;
    }
    out += md.slice(last);
    return { text: out, slots, inlined };
  }
  function findAttachment(target, attachments) {
    const t = decodeURIComponent(target).trim();
    return attachments.find((a) => a.path === t || a.path.endsWith("/" + t));
  }
  function mediaHtml(a, dataUrl) {
    if (!a) return "";
    const alt = escapeHtml(a.path || "");
    const key = encodeURIComponent(a.path);
    const kindLabel = a.kind === "video" ? "视频" : "图";
    let inner;
    if (dataUrl) {
      inner = `<img class="bz-encrypt-preview-media" src="${dataUrl}" alt="${alt}" loading="lazy">`;
    } else {
      inner = `<div class="bz-encrypt-preview-missing" title="${alt}">
      <span class="bz-encrypt-preview-missing-name">${alt}</span>
      <span>${a.kind === "video" ? "视频抽帧预览不可用" : "无压缩预览"}，点击加载原${kindLabel}</span>
    </div>`;
    }
    return `<span class="bz-encrypt-preview-slot" data-attach="${key}">${inner}<span class="bz-encrypt-preview-spinner"></span></span>`;
  }
  function progressKey() {
    return "encrypt-progress-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  }
  function progressNotify(title) {
    try {
      return notify("0/0", { type: "progress", title, dedupeKey: progressKey(), duration: -1 });
    } catch (e) {
      return null;
    }
  }
  function truncateName(current, maxLen = 20) {
    let name = current.split("/").pop() || current;
    if (name.length > maxLen) name = name.slice(0, maxLen) + "…";
    return name;
  }
  function updateProgress(h, done, total, current) {
    if (!h) return;
    const base = `已处理 ${done}/${total}`;
    h.setMessage(`${base} · 当前：${truncateName(current)}`);
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round(done / total * 100))) : 0;
    h.setProgress(pct);
  }
  function finishProgress(h, done, msg) {
    if (!h) return;
    h.setMessage(`${msg}（${done} 个文件）`);
    h.setType("success");
  }
  function encryptSettingsSchema() {
    const warnReload = makeReloadWarnOnce();
    return {
      groups: [
        {
          // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
          icon: "palette",
          name: "外观",
          rows: [
            { type: "choiceCards", name: "面板布局", binding: { key: "encryptSkin" }, options: [{ value: "default", label: "三栏", prevClass: "bz-sp-prev-panel" }] },
            { type: "choiceCards", name: "面板主题", binding: { key: "encryptSkinTheme" }, layoutKey: "encryptSkin", options: [{ value: "steel", label: "钢灰", layout: "default", prevClass: "bz-sp-prev-steel" }] }
          ]
        },
        {
          icon: "shield",
          name: "安全",
          rows: [
            // 统一「安全模式」：密码(securityMode)与加密(encryptSecurityMode)历史双键 OR 读取、
            // 同步双写（键位冻结兼容老用户任一键开启状态；ADR-0085 统一行为=关闭保险库立即自动上锁）
            {
              type: "toggle",
              name: "安全模式",
              desc: "关闭保险库窗口立即自动上锁",
              binding: {
                get: () => !!tryGetSettings().securityMode || !!tryGetSettings().encryptSecurityMode,
                set: (v) => {
                  const s = getSettings();
                  s.securityMode = v;
                  s.encryptSecurityMode = v;
                },
                save: () => saveSettings()
              },
              onChange: warnReload
            }
          ]
        },
        {
          icon: "folder-open",
          name: "存储",
          rows: [
            // ticket 128：保险库根目录（统一路径选择器录入，无手输文本框；点前缀目录可选自 CONFIG/.ENCRYPT）
            {
              type: "path",
              mode: "single",
              name: "保险库根目录",
              desc: "加密文件的存放位置",
              binding: { key: "encryptRoot" },
              onCommit: warnReload
            }
          ]
        },
        {
          icon: "image",
          name: "预览",
          rows: [
            { type: "toggle", name: "生成压缩预览", desc: "加密时生成图片视频的压缩预览", binding: { key: "encryptPreviewEnabled" }, onChange: warnReload },
            { type: "number", name: "预览长边", desc: "预览图目标长边像素", binding: numStrBinding("encryptPreviewSize", 384), min: 64, max: 1024, step: 16, onCommit: warnReload, isChild: true },
            { type: "number", name: "预览质量", desc: "JPEG 图像压缩质量", binding: numStrBinding("encryptPreviewQuality", 0.5), min: 0.1, max: 1, step: 0.1, onCommit: warnReload, isChild: true },
            { type: "toggle", name: "预览自动加载原图", desc: "打开预览自动解密原图", binding: { key: "encryptAutoLoadOriginal" }, onChange: warnReload, isChild: true }
          ]
        }
      ]
    };
  }
  var DEFAULT_PW_CHARSET, CLIPBOARD_CLEAR_DELAY_MS, clipboardClearTimer, lastVisitedAsset, _UIManager, UIManager, _EncryptAppController, EncryptAppController;
  var init_ui2 = __esm({
    "src/encrypt/ui.ts"() {
      init_fake_obsidian();
      init_notice();
      init_app();
      init_esc_manager();
      init_flow_dialog();
      init_dom();
      init_item_actions();
      init_utils();
      init_ui();
      init_settings_provider();
      init_settings_modal();
      init_settings_common();
      init_data2();
      init_preview();
      init_vault_data();
      init_vault_pw_view();
      init_pw_picker();
      init_vault_assets_view();
      DEFAULT_PW_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+";
      CLIPBOARD_CLEAR_DELAY_MS = 6e4;
      clipboardClearTimer = null;
      lastVisitedAsset = "pw";
      _UIManager = class _UIManager {
        constructor(dataManager, config, pwDataManager) {
          /** 顶部「加密当前笔记」按钮回调（由 Controller 注入，调 lockCurrentNote） */
          this.onLockCurrentNote = null;
          // DOM
          this.mask = null;
          this.popup = null;
          this.listContainer = null;
          this.previewMask = null;
          this.previewPopup = null;
          /** 体检弹窗（右上角 🩺 替换原清理扫把：先报告后勾选清理，用户拍板） */
          this.healthMask = null;
          this.healthPopup = null;
          /** 缩略图按需加载产生的 Blob URL（预览窗关闭时统一 revoke，防泄漏） */
          this._previewUrls = [];
          this._initialized = false;
          /** 解锁连续失败次数（P2 节流：冷却 = min(2^(n-1) 秒, 8 秒)；成功复位） */
          this.unlockFailStreak = 0;
          /** 当前冷却截止时间戳（ms）；早于此的尝试被拒绝并提示剩余等待 */
          this.unlockCooldownUntil = 0;
          /** 搜索防抖计时器 */
          this.searchTimer = null;
          /** 密码资产状态（列表筛选/选中/显隐） */
          this.pwState = { ...DEFAULT_PW_STATE };
          /** 当前资产视图（概览/密码/笔记/日记） */
          this.asset = "overview";
          /** 加密日记详情临时明文缓存（渲染详情时惰性解密） */
          this._diaryPlain = {};
          /** 最近一次体检结果缓存（E5：概览健康卡随 scanHealth 更新，未体检为 null；上锁清空） */
          this.lastHealth = null;
          /** 本次解锁会话起点（ms；notifyUnlockUi 同步，上锁清空）——左栏「已解锁时长」计时用 */
          this.unlockedAt = null;
          /** 已解锁时长刷新计时器（面板可见时每秒跳一次） */
          this.sessionTimer = null;
          /** 安全模式无交互自动上锁计时器（15 分钟；面板内交互重置） */
          this.idleLockTimer = null;
          this._selNoteId = null;
          this._pwEditingId = null;
          /** 同平台+账号查重命中后的放行标志（同一弹窗会话内再点一次保存即放行） */
          this._pwDupConfirmed = false;
          /** 弹窗内联动刷新（强度提示等）；ensurePwDialog 首建时注入 */
          this.pwDlgSyncUi = null;
          this.pwDlg = null;
          /** 密码添加/编辑弹窗的 ESC 层（E7：弹窗可见时 ESC 只关弹窗，不穿透关掉主面板） */
          this.pwDlgEsc = null;
          this.dataManager = dataManager;
          this.config = config;
          this.pwDataManager = pwDataManager || new PasswordVaultDataManager(dataManager);
          this.pwView = new VaultPwView(
            this.pwDataManager,
            {
              toast: (m, err) => this.toast(m, err),
              openPwEntryDialog: (edit, prefill) => this.openPwEntryDialog(edit, prefill),
              openPwPlatformEdit: (p) => this.openPwPlatformEdit(p),
              askConfirm: (t, m, okLabel, cb) => this.askPwConfirm(t, m, okLabel, cb),
              copySensitive: (t) => this.copySensitive(t),
              openExternal: (u) => this.openExternal(u),
              onPwChanged: () => this.renderAll(),
              openPwAccountPage: (d, st) => this.openPwAccountPage(d, st)
            },
            { charset: config.pwCharset, length: config.pwLength }
          );
          this.pwDataManager.onExternalChange = () => this.renderAll();
        }
        /** 解锁成功后复位节流状态 */
        resetUnlockThrottle() {
          this.unlockFailStreak = 0;
          this.unlockCooldownUntil = 0;
        }
        /** 登记一次密码错误：递增失败连击并按 1s/2s/4s…封顶 8s 设置下次可试时间，返回本次冷却秒数 */
        registerUnlockFailure() {
          this.unlockFailStreak += 1;
          const delaySec = Math.min(2 ** (this.unlockFailStreak - 1), 8);
          this.unlockCooldownUntil = Date.now() + delaySec * 1e3;
          return delaySec;
        }
        ensureElements() {
          if (this._initialized) return;
          this.mask = this.createMask("bz-encrypt-mask");
          this.popup = this.createPopup("bz-encrypt-popup");
          this.popup.classList.add("bz-panel-mtop");
          this.popup.innerHTML = `
      <div class="bz-vault-desk">
        <div class="bz-vault-nav">
          <div class="bz-vault-brand">
            <div class="seal">${vIc("lock", 19)}</div>
            <div class="nm">保险库<small>VAULT</small></div>
          </div>
          <div class="bz-vault-item on" data-asset="overview">${vIc("layout-grid", 16)}概览<span class="cnt" data-cnt="overview"></span></div>
          <div class="bz-vault-sec">资产档案</div>
          <div class="bz-vault-item" data-asset="pw">${vIc("key", 16)}密码<span class="cnt" data-cnt="pw"></span></div>
          <div class="bz-vault-item k-note" data-asset="note">${vIc("file-lock", 16)}加密笔记<span class="cnt" data-cnt="note"></span></div>
          <div class="bz-vault-item k-diary" data-asset="diary">${vIc("book-lock", 16)}加密日记<span class="cnt" data-cnt="diary"></span></div>
          <div class="grow"></div>
          <div class="bz-vault-health" data-act="health-card" title="打开保险库体检">
            <div class="ht"><span class="okdot"></span><span data-health-t>保险库健康</span></div>
            <div class="hd" data-health-d>未体检</div>
          </div>
          <div class="bz-vault-lockbtn" data-act="lock"><span class="lbl">${vIc("lock", 14)} 立即上锁</span><span class="dur" data-unlock-dur></span><span class="dot"></span></div>
        </div>
        <div class="bz-vault-main">
          <div class="bz-vault-bar">
            <h1 data-vault-title>保险库</h1>
            <div class="sub" data-vault-sub></div>
            <div class="bz-vault-search">${vIc("search", 14)}<input placeholder="搜索全部资产…" data-vault-search></div>
            <button class="bz-vault-ic" data-act="gen" title="生成密码">${vIc("refresh-cw", 15)}</button>
            <button class="bz-vault-ic" data-act="lock-note" title="加密当前笔记">${vIc("file-lock", 15)}</button>
            <button class="bz-vault-ic" data-act="health" title="保险库体检">${vIc("stethoscope", 15)}</button>
            <button class="bz-vault-ic" data-act="settings" title="保险库设置">${vIc("settings", 15)}</button>
            <button class="bz-vault-ic close" data-act="close" title="关闭">${vIc("x", 15)}</button>
          </div>
          <div class="bz-vault-pane">
            <div class="bz-vault-listcol" data-vault-list></div>
            <div class="bz-vault-detail" data-vault-detail></div>
          </div>
        </div>
      </div>
      <div class="bz-vault-mob">
        <div class="bz-vault-mbar">
          <div class="seal">${vIc("lock", 15)}</div>
          <div class="t">保险库</div>
          <span class="st" data-mob-unlock>已解锁</span>
          <button class="bz-vault-mobclose bz-touch-target--xl" data-act="mob-close" aria-label="关闭">${vIc("x", 15)}</button>
        </div>
        <div class="bz-vault-msearch">${vIc("search", 13)}<input placeholder="搜索全部资产…" data-mob-search></div>
        <div class="bz-vault-mseg" data-mob-seg>
          <span class="sg on" data-masset="overview">概览</span>
          <span class="sg" data-masset="pw">密码</span>
          <span class="sg" data-masset="note">笔记</span>
          <span class="sg" data-masset="diary">日记</span>
        </div>
        <div class="bz-vault-mbody" data-mob-body></div>
      </div>`;
          this.popup.style.display = "none";
          const desk = this.popup.querySelector(".bz-vault-desk");
          this.desk = {
            nav: desk.querySelector(".bz-vault-nav"),
            area: desk.querySelector(".bz-vault-pane"),
            list: desk.querySelector("[data-vault-list]"),
            detail: desk.querySelector("[data-vault-detail]"),
            count: desk.querySelector('[data-cnt="overview"]'),
            search: desk.querySelector("[data-vault-search]")
          };
          const mob = this.popup.querySelector(".bz-vault-mob");
          this.mob = {
            body: mob.querySelector("[data-mob-body]"),
            search: mob.querySelector("[data-mob-search]"),
            seg: mob.querySelector("[data-mob-seg]")
          };
          this.listContainer = this.desk.list;
          document.body.appendChild(this.mask);
          document.body.appendChild(this.popup);
          const ov = createOverlay({ maskId: "bz-encrypt-preview-mask", popupId: "bz-encrypt-preview-popup", maxWidth: 640, onMaskClick: () => this.closePreview() });
          this.previewMask = ov.mask;
          this.previewPopup = ov.popup;
          document.body.appendChild(this.previewMask);
          document.body.appendChild(this.previewPopup);
          this.bindVaultShell();
          this.registerEscape();
          this._initialized = true;
        }
        /** 统一骨架交互：资产导航 / 顶栏动作 / 搜索防抖 / 移动端 seg */
        bindVaultShell() {
          var _a2, _b2, _c, _d, _e, _f, _g, _h;
          const setAsset = (a) => {
            this.asset = a;
            lastVisitedAsset = a;
            this.pwState.searchKw = "";
            this.desk.search.value = "";
            this.mob.search.value = "";
            this.renderAll();
          };
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach((el) => {
            el.addEventListener("click", () => setAsset(el.getAttribute("data-asset") || "overview"));
          });
          this.mob.seg.querySelectorAll(".sg").forEach((el) => {
            el.addEventListener("click", () => setAsset(el.getAttribute("data-masset") || "overview"));
          });
          (_a2 = this.popup.querySelector('[data-act="lock"]')) == null ? void 0 : _a2.addEventListener("click", () => this.lockNow());
          (_b2 = this.popup.querySelector('[data-act="close"]')) == null ? void 0 : _b2.addEventListener("click", () => this.hide());
          (_c = this.popup.querySelector('[data-act="mob-close"]')) == null ? void 0 : _c.addEventListener("click", () => this.hide());
          (_d = this.popup.querySelector('[data-act="settings"]')) == null ? void 0 : _d.addEventListener("click", () => this.openSettings());
          (_e = this.popup.querySelector('[data-act="health"]')) == null ? void 0 : _e.addEventListener("click", () => void this.openHealthDialog());
          (_f = this.popup.querySelector('[data-act="health-card"]')) == null ? void 0 : _f.addEventListener("click", () => void this.openHealthDialog());
          (_g = this.popup.querySelector('[data-act="lock-note"]')) == null ? void 0 : _g.addEventListener("click", () => {
            var _a3;
            return (_a3 = this.onLockCurrentNote) == null ? void 0 : _a3.call(this);
          });
          (_h = this.popup.querySelector('[data-act="gen"]')) == null ? void 0 : _h.addEventListener("click", () => this.genAndToast());
          const bindSearch = (input, isMob) => {
            input.addEventListener("input", () => {
              const v = input.value.trim();
              if (this.asset === "overview" && v) {
                this.asset = "pw";
                lastVisitedAsset = "pw";
              }
              this.pwState.searchKw = v;
              this.desk.search.value = isMob ? v : this.desk.search.value;
              this.mob.search.value = isMob ? this.mob.search.value : v;
              if (this.searchTimer) clearTimeout(this.searchTimer);
              this.searchTimer = setTimeout(() => this.renderAll(), 180);
            });
          };
          bindSearch(this.desk.search, false);
          bindSearch(this.mob.search, true);
          this.mask.addEventListener("click", () => {
            if (this.mask.style.display === "block") this.hide();
          });
          const bump = () => this.bumpIdleLock();
          this.popup.addEventListener("pointerdown", bump, true);
          this.popup.addEventListener("keydown", bump, true);
        }
        createMask(id) {
          const mask = document.createElement("div");
          mask.id = id;
          mask.className = "bz-overlay-mask";
          mask.style.display = "none";
          return mask;
        }
        createPopup(id) {
          const popup = document.createElement("div");
          popup.id = id;
          popup.className = "bz-overlay-popup";
          popup.style.display = "none";
          return popup;
        }
        // ---------- 显示/隐藏 ----------
        show() {
          if (!this._initialized) this.ensureElements();
          topifyZ(this.mask, this.popup);
          this.mask.style.display = "block";
          this.popup.style.display = "flex";
          this.notifyUnlockUi();
          void this.renderList();
          this.startSessionTimers();
        }
        hide() {
          if (this.mask) this.mask.style.display = "none";
          if (this.popup) this.popup.style.display = "none";
          this.stopSessionTimers();
          if (this.isSecurityMode()) {
            this.dataManager.lock();
            this.pwDataManager.lock();
            this.pwState = { ...DEFAULT_PW_STATE };
            this._selNoteId = null;
            this._diaryPlain = {};
            this.noticeAutoLock();
          }
        }
        /** 安全模式双口径（config 快照可能落后于设置实时值：单读 config 会漏，历史双键 OR） */
        isSecurityMode() {
          var _a2;
          return !!this.config.securityMode || !!((_a2 = tryGetSettings()) == null ? void 0 : _a2.securityMode);
        }
        // ---------- 解锁会话可见性（已解锁时长 + 安全模式无交互自动上锁） ----------
        /** 面板可见期间：每秒刷新「已解锁时长」+ 布防无交互自动上锁 */
        startSessionTimers() {
          this.stopSessionTimers();
          if (!this.dataManager.unlocked) return;
          if (this.unlockedAt === null) this.unlockedAt = Date.now();
          this.updateUnlockDuration();
          this.sessionTimer = setInterval(() => this.updateUnlockDuration(), 1e3);
          this.bumpIdleLock();
        }
        /** 停会话计时（时长刷新 + 无交互自动上锁；hide/上锁/卸载共用） */
        stopSessionTimers() {
          if (this.sessionTimer !== null) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
          }
          this.clearIdleLock();
        }
        /** 左栏「立即上锁」旁的已解锁时长（mm:ss，超 1 小时 h:mm:ss） */
        updateUnlockDuration() {
          var _a2;
          const el = (_a2 = this.popup) == null ? void 0 : _a2.querySelector("[data-unlock-dur]");
          if (!el) return;
          if (!this.dataManager.unlocked || this.unlockedAt === null) {
            el.textContent = "";
            return;
          }
          const s = Math.max(0, Math.floor((Date.now() - this.unlockedAt) / 1e3));
          const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
          const ss = String(s % 60).padStart(2, "0");
          const h = Math.floor(s / 3600);
          el.textContent = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
          el.title = "已解锁时长";
        }
        bumpIdleLock() {
          this.clearIdleLock();
          if (!this.isSecurityMode() || !this.dataManager.unlocked) return;
          if (!this.rootVisible()) return;
          this.idleLockTimer = setTimeout(() => {
            this.idleLockTimer = null;
            if (!this.isSecurityMode() || !this.dataManager.unlocked || !this.rootVisible()) return;
            notice("安全模式：15 分钟无操作，已自动上锁");
            this.lockNow();
          }, _UIManager.IDLE_LOCK_MS);
        }
        clearIdleLock() {
          if (this.idleLockTimer !== null) {
            clearTimeout(this.idleLockTimer);
            this.idleLockTimer = null;
          }
        }
        noticeAutoLock() {
          notice("安全模式：已自动上锁");
        }
        // ---------- 体检弹窗 ----------
        /**
         * 体检（用户拍板：右上角 🩺 按钮替换原清理扫把，先报告后勾选清理）。
         * 体检需解锁（对账依赖清单明文，完整性检测需解密）——未解锁先弹主密码，取消则不进入。
         * 可清理类（失效条目/孤儿密文）默认不全选、勾选后二次确认才删（ticket 18）；损坏/缺失类只展示不清理（删了就是真丢数据）。
         * 清理后自动重新体检，报告收敛。
         */
        async openHealthDialog() {
          if (!this.dataManager.unlocked) {
            const ok = await this.showPasswordDialog();
            if (!ok) return;
          }
          if (!this.healthMask) this.ensureHealthElements();
          topifyZ(this.healthMask, this.healthPopup);
          this.healthMask.style.display = "flex";
          this.healthPopup.style.display = "flex";
          void this.runHealthScan();
        }
        ensureHealthElements() {
          const mask = document.createElement("div");
          mask.id = "bz-encrypt-health-mask";
          mask.className = "bz-encrypt-health-mask";
          mask.style.display = "none";
          const popup = document.createElement("div");
          popup.id = "bz-encrypt-health-popup";
          popup.className = "bz-encrypt-health-box";
          popup.style.display = "none";
          const head = document.createElement("div");
          head.className = "bz-encrypt-health-head";
          const title = document.createElement("h4");
          title.textContent = "保险库体检";
          head.appendChild(title);
          popup.appendChild(head);
          const body = document.createElement("div");
          body.id = "bz-encrypt-health-body";
          body.className = "bz-encrypt-health-body";
          popup.appendChild(body);
          const foot = document.createElement("div");
          foot.className = "bz-encrypt-health-foot";
          const cleanBtn = document.createElement("button");
          cleanBtn.id = "bz-encrypt-health-clean";
          cleanBtn.className = "bz-encrypt-dialog-btn bz-encrypt-dialog-btn--primary";
          cleanBtn.textContent = "清理勾选项 (0)";
          cleanBtn.onclick = () => void this.confirmHealthCleanup();
          const rescanBtn = document.createElement("button");
          rescanBtn.className = "bz-encrypt-dialog-btn";
          rescanBtn.textContent = "重新体检";
          rescanBtn.onclick = () => void this.runHealthScan();
          foot.appendChild(cleanBtn);
          foot.appendChild(rescanBtn);
          popup.appendChild(foot);
          mask.appendChild(popup);
          document.body.appendChild(mask);
          mask.onclick = (e) => {
            if (e.target === mask) this.hideHealthDialog();
          };
          escManager.register("encrypt-health", {
            isVisible: () => !!(this.healthMask && this.healthMask.style.display === "flex"),
            close: () => this.hideHealthDialog()
          });
          this.healthMask = mask;
          this.healthPopup = popup;
        }
        hideHealthDialog() {
          if (this.healthMask) this.healthMask.style.display = "none";
          if (this.healthPopup) this.healthPopup.style.display = "none";
        }
        /** 体检执行：动态显示（用户拍板）——扫描是长任务（逐镜像 PBKDF2），
         *  顶部实时进度（计数 + 当前对象），发现的问题即时追加，扫完再整理成完整勾选报告。 */
        async runHealthScan() {
          if (!this.healthPopup) return;
          const body = this.healthPopup.querySelector("#bz-encrypt-health-body");
          if (!body) return;
          body.innerHTML = "";
          const progress = document.createElement("div");
          progress.className = "bz-encrypt-health-progress";
          progress.textContent = "体检中…";
          const bar = uiProgress({ value: 0 });
          bar.el.classList.add("bz-encrypt-health-bar");
          body.appendChild(progress);
          body.appendChild(bar.el);
          const live2 = document.createElement("div");
          live2.className = "bz-encrypt-health-live";
          const liveTitle = document.createElement("div");
          liveTitle.className = "bz-encrypt-health-section-title";
          liveTitle.textContent = "发现的异常";
          live2.appendChild(liveTitle);
          body.appendChild(live2);
          try {
            const report = await this.dataManager.scanHealth((p) => {
              progress.textContent = `检查中 ${p.done}/${p.total} · ${truncateName(p.current)}`;
              bar.setValue(Math.round(p.done / p.total * 100));
              for (const item of p.found) {
                const row = document.createElement("div");
                row.className = "bz-encrypt-health-item " + (item.cat === "corrupted-body" || item.cat === "corrupted-attachment" ? "bz-encrypt-health-item--bad" : item.cat === "missing-attachment" ? "bz-encrypt-health-item--warn" : "");
                row.textContent = item.label;
                live2.appendChild(row);
              }
            });
            this.lastHealth = { issues: report.items.length, lastChecked: (/* @__PURE__ */ new Date()).toLocaleString() };
            this.renderHealthReport(report, body);
            this.renderNav();
          } catch (e) {
            body.innerHTML = "";
            const err = document.createElement("div");
            err.textContent = "体检失败：" + e.message;
            body.appendChild(err);
          }
        }
        /** 渲染体检报告（UI 保证解锁后调用，integrityChecked 恒 true）：可清理类默认不全选；损坏/缺失只展示 */
        renderHealthReport(report, body) {
          body.innerHTML = "";
          const cleanable = report.items.filter((i) => i.cat === "dead-entry" || i.cat === "orphan-file");
          const bad = report.items.filter((i) => i.cat === "corrupted-body" || i.cat === "corrupted-attachment");
          const missing = report.items.filter((i) => i.cat === "missing-attachment");
          const summary = document.createElement("div");
          summary.className = "bz-encrypt-health-summary";
          summary.textContent = "体检完成：" + report.items.length + " 个问题";
          body.appendChild(summary);
          this.appendCleanableSection(body, cleanable);
          if (bad.length) {
            const sec = document.createElement("div");
            sec.className = "bz-encrypt-health-section bz-encrypt-health-section--bad";
            const t = document.createElement("div");
            t.className = "bz-encrypt-health-section-title";
            t.textContent = "损坏镜像（" + bad.length + "）——不可清理，请从备份恢复后重试还原";
            sec.appendChild(t);
            for (const item of bad) {
              const row = document.createElement("div");
              row.className = "bz-encrypt-health-item bz-encrypt-health-item--bad";
              row.textContent = item.label;
              row.title = "损坏的密文镜像，删除即丢失数据";
              sec.appendChild(row);
            }
            body.appendChild(sec);
          }
          if (missing.length) {
            const sec = document.createElement("div");
            sec.className = "bz-encrypt-health-section";
            const t = document.createElement("div");
            t.className = "bz-encrypt-health-section-title";
            t.textContent = "附件镜像缺失（" + missing.length + "）——还原时该附件将不可用";
            sec.appendChild(t);
            for (const item of missing) {
              const row = document.createElement("div");
              row.className = "bz-encrypt-health-item bz-encrypt-health-item--warn";
              row.textContent = item.label;
              sec.appendChild(row);
            }
            body.appendChild(sec);
          }
          if (!bad.length && !missing.length) {
            const ok = document.createElement("div");
            ok.className = "bz-encrypt-health-hint";
            ok.textContent = "全部镜像完整（解密+指纹校验通过）";
            body.appendChild(ok);
          }
          this.updateHealthCleanCount();
        }
        /** 可清理区块：失效条目 + 孤儿密文（checkbox 默认不全选，勾选才计入清理） */
        appendCleanableSection(body, items) {
          const sec = document.createElement("div");
          sec.className = "bz-encrypt-health-section bz-encrypt-health-section--clean";
          const t = document.createElement("div");
          t.className = "bz-encrypt-health-section-title";
          const dead = items.filter((i) => i.cat === "dead-entry").length;
          const orphan = items.filter((i) => i.cat === "orphan-file").length;
          t.textContent = items.length ? "可清理（" + items.length + "）：" + dead + " 个失效条目、" + orphan + " 个孤儿密文" : "可清理：无";
          sec.appendChild(t);
          for (const item of items) {
            const row = document.createElement("label");
            row.className = "bz-encrypt-health-item";
            const box = document.createElement("input");
            box.type = "checkbox";
            box.className = "bz-encrypt-health-check";
            box.value = item.key;
            box.checked = false;
            box.addEventListener("change", () => this.updateHealthCleanCount());
            row.appendChild(box);
            row.appendChild(document.createTextNode(item.label));
            sec.appendChild(row);
          }
          body.appendChild(sec);
        }
        updateHealthCleanCount() {
          const btn = document.getElementById("bz-encrypt-health-clean");
          if (!btn) return;
          btn.textContent = "清理勾选项 (" + this.collectCheckedKeys().length + ")";
        }
        collectCheckedKeys() {
          const popup = this.healthPopup;
          if (!popup) return [];
          return [...popup.querySelectorAll("input.bz-encrypt-health-check:checked")].map((i) => i.value);
        }
        /**
         * 清理勾选项（ticket 18）：执行前二次确认——写明将永久删除的数量（失效条目含残余附件镜像、
         * 孤儿密文），确认后才执行；只处理可清理类（resolveHealth 对损坏/缺失类防御性忽略），
         * 完成后自动重新体检。
         */
        async confirmHealthCleanup() {
          const keys = this.collectCheckedKeys();
          if (!keys.length) {
            notice("未勾选任何可清理项");
            return;
          }
          const dead = keys.filter((k) => k.startsWith("entry:")).length;
          const orphan = keys.filter((k) => k.startsWith("file:")).length;
          const parts = [];
          if (dead > 0) parts.push(dead + " 条失效条目（含残余附件镜像）");
          if (orphan > 0) parts.push(orphan + " 个孤儿密文");
          void openFlowDialog({
            title: "清理确认",
            message: parts.join("、") + "将永久删除，不可恢复",
            actions: [
              { label: "取消", value: "cancel" },
              { label: "永久删除", value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v === "ok") void this.executeHealthCleanup(keys);
          });
        }
        /** 执行清理（二次确认通过后）：resolveHealth 只处理可清理类，完成后自动重新体检 */
        async executeHealthCleanup(keys) {
          try {
            const { notes, files } = await this.dataManager.resolveHealth(keys);
            const parts = [];
            if (notes > 0) parts.push(notes + " 个失效条目");
            if (files > 0) parts.push(files + " 个孤儿密文");
            notice(parts.length ? "已清理：" + parts.join("、") : "已清理所选项", "success");
            void this.renderList();
            void this.runHealthScan();
          } catch (e) {
            notifyActionError(e, "清理");
          }
        }
        // ---------- 解锁弹窗 ----------
        /**
         * 主密码弹窗（首设两次确认 + 损坏清单重设确认）。视觉样式已收敛至 styles.css
         * （铁律 9：.bz-encrypt-dialog-* 类）；内联仅保留功能性 zIndex/显隐（display）。
         */
        async showPasswordDialog() {
          const exists = await this.dataManager.exists();
          return new Promise((resolve) => {
            const mask = document.createElement("div");
            mask.className = "bz-encrypt-dialog-mask";
            topifyZ(mask);
            mask.style.display = "flex";
            const box = document.createElement("div");
            box.className = "bz-encrypt-dialog-box";
            const title = document.createElement("h4");
            title.className = "bz-encrypt-dialog-title";
            const message = document.createElement("p");
            message.className = "bz-encrypt-dialog-msg";
            const input = document.createElement("input");
            input.type = "password";
            input.placeholder = "输入主密码";
            input.className = "bz-encrypt-dialog-input";
            const input2 = document.createElement("input");
            input2.type = "password";
            input2.placeholder = "再次输入";
            input2.className = "bz-encrypt-dialog-input";
            input2.style.display = "none";
            const warning = document.createElement("div");
            warning.className = "bz-encrypt-dialog-warning";
            warning.style.display = "none";
            warning.innerHTML = `${vIc("triangle-alert", 14)} <strong>重要提醒</strong><br>• 主密码 <b>不会存储</b>，也无法找回，请务必牢记！<br>• 若遗忘密码，加密笔记及其附件将永久丢失。<br>• 建议使用密码本（如 Bitwarden）保存此密码。`;
            const ack = document.createElement("label");
            ack.className = "bz-encrypt-dialog-ack";
            ack.style.display = "none";
            const ackBox = document.createElement("input");
            ackBox.type = "checkbox";
            ack.appendChild(ackBox);
            ack.appendChild(document.createTextNode("我已了解：主密码无法找回，遗忘将导致密文永久无法恢复"));
            if (exists) {
              title.textContent = "输入主密码";
              message.textContent = "请输入您设置的主密码以解锁保险库";
              input2.style.display = "none";
              warning.style.display = "none";
              ack.style.display = "none";
            } else {
              title.textContent = "设置主密码";
              message.textContent = "请设置一个主密码（用于加密所有数据）";
              input2.style.display = "block";
              input2.placeholder = "再次输入";
              warning.style.display = "block";
              ack.style.display = "block";
            }
            const btnContainer = document.createElement("div");
            btnContainer.className = "bz-encrypt-dialog-btns";
            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "取消";
            cancelBtn.className = "bz-encrypt-dialog-btn";
            cancelBtn.onclick = () => {
              document.body.removeChild(mask);
              resolve(false);
            };
            const confirmBtn = document.createElement("button");
            confirmBtn.textContent = "确认";
            confirmBtn.className = "bz-encrypt-dialog-btn bz-encrypt-dialog-btn--primary";
            confirmBtn.onclick = async () => {
              const pw = input.value;
              if (!pw) {
                notice("请输入密码");
                return;
              }
              if (!exists) {
                if (input2.style.display === "none") {
                  input2.style.display = "block";
                  input2.value = "";
                  this.focusUnlockInput(input2);
                  message.textContent = "请再次输入主密码确认";
                  return;
                } else {
                  if (pw !== input2.value) {
                    notice("两次密码不一致");
                    return;
                  }
                  if (!ackBox.checked) {
                    notice("请先勾选风险确认");
                    return;
                  }
                  try {
                    const ok = await this.dataManager.unlock(pw);
                    if (ok) {
                      document.body.removeChild(mask);
                      resolve(true);
                      notice("密码已设置，数据已加密", "success");
                    } else {
                      notice("设置失败：无法写入清单，请检查磁盘空间后重试", "error");
                      resolve(false);
                    }
                  } catch (e) {
                    notifyActionError(e, "设置主密码");
                    resolve(false);
                  }
                  return;
                }
              } else {
                const remainMs = this.unlockCooldownUntil - Date.now();
                if (remainMs > 0) {
                  notice(`尝试过于频繁，请再等 ${Math.ceil(remainMs / 1e3)} 秒`, "warning");
                  return;
                }
                const success = await this.dataManager.unlock(pw);
                if (success) {
                  this.resetUnlockThrottle();
                  document.body.removeChild(mask);
                  resolve(true);
                  const healMsg = this.dataManager.selfHealRolledBack > 0 ? "；上次未完成的加密已自动回滚，原文未动" : "";
                  notice("解锁成功" + healMsg, "success");
                } else {
                  const issue = this.dataManager.manifestIssue;
                  if (issue === "empty" || issue === "corrupt") {
                    void openFlowDialog({
                      title: "清单疑似损坏",
                      message: "保险库清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。重设主密码将生成全新空清单，旧加密数据将永久无法恢复。确定重设吗？",
                      actions: [
                        { label: "暂不重设", value: "cancel" },
                        { label: "仍要重设", value: "ok", cta: true }
                      ]
                    }).then((v) => {
                      if (v === "ok") {
                        void this.dataManager.unlock(pw, true).then((ok) => {
                          if (ok) {
                            this.resetUnlockThrottle();
                            document.body.removeChild(mask);
                            resolve(true);
                            notice("已重设主密码（旧数据不可恢复）", "warning");
                          } else {
                            notice("重设失败：无法写入清单", "error");
                          }
                        });
                      } else {
                        notice("未重设：请先检查或备份数据文件", "warning");
                      }
                    });
                  } else {
                    notice("密码错误，请重试", "error");
                    const delaySec = this.registerUnlockFailure();
                    notice(`${delaySec} 秒后可再次尝试`, "warning");
                    input.value = "";
                    this.focusUnlockInput(input);
                  }
                }
              }
            };
            input.addEventListener("keydown", (e) => {
              if (e.key === "Enter") confirmBtn.click();
            });
            input2.addEventListener("keydown", (e) => {
              if (e.key === "Enter") confirmBtn.click();
            });
            btnContainer.appendChild(cancelBtn);
            btnContainer.appendChild(confirmBtn);
            box.appendChild(title);
            box.appendChild(warning);
            box.appendChild(ack);
            box.appendChild(message);
            box.appendChild(input);
            box.appendChild(input2);
            box.appendChild(btnContainer);
            mask.appendChild(box);
            document.body.appendChild(mask);
            mask.onclick = (e) => {
              if (e.target === mask) {
                try {
                  document.body.removeChild(mask);
                } catch (err) {
                }
                resolve(false);
              }
            };
            this.focusUnlockInput(input);
            setTimeout(() => this.focusUnlockInput(input), 150);
          });
        }
        /** 输入框聚焦（不滚动页面）+ 兼容性兜底；移动端靠二次聚焦触发系统键盘 */
        focusUnlockInput(el) {
          try {
            el.focus({ preventScroll: true });
          } catch (e) {
            el.focus();
          }
        }
        // ---------- 统一工作台渲染 ----------
        /** show/解锁/外部变更/资产切换统一入口：加载 → 全量重绘 */
        async renderList() {
          if (!this.listContainer) return;
          if (this.dataManager.unlocked) {
            try {
              await this.pwDataManager.load();
            } catch (e) {
            }
          }
          this.renderAll();
        }
        /** 全量重绘：导航计数 + 概览/资产内容 + 移动端 + 健康卡 + 顶栏标题 */
        renderAll() {
          if (!this.rootVisible()) return;
          this.renderNav();
          this.renderDesktop();
          this.renderMobile();
        }
        rootVisible() {
          return !!(this.popup && this.popup.style.display === "flex");
        }
        /** 资产计数 + 导航高亮 */
        counts() {
          const notes = this.dataManager.manifest.notes;
          return {
            pw: this.pwDataManager.pwData.length,
            note: notes.filter((n) => n.kind !== "diary-entry" && n.kind !== "password-vault").length,
            diary: notes.filter((n) => n.kind === "diary-entry").length
          };
        }
        renderNav() {
          const c = this.counts();
          const setCnt = (a, v) => {
            const el = this.popup.querySelector(`[data-cnt="${a}"]`);
            if (el) el.textContent = String(v);
          };
          setCnt("overview", c.pw + c.note + c.diary);
          setCnt("pw", c.pw);
          setCnt("note", c.note);
          setCnt("diary", c.diary);
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach((el) => {
            el.classList.toggle("on", el.getAttribute("data-asset") === this.asset);
          });
          this.mob.seg.querySelectorAll(".sg").forEach((el) => {
            el.classList.toggle("on", el.getAttribute("data-masset") === this.asset);
          });
          const ht = this.popup.querySelector("[data-health-t]");
          const hd = this.popup.querySelector("[data-health-d]");
          const dot = this.popup.querySelector(".bz-vault-health .okdot");
          if (ht) ht.textContent = c.pw + c.note + c.diary ? "保险库健康" : "保险库为空";
          if (hd) {
            if (!this.lastHealth) hd.textContent = "未体检 · 点此体检";
            else if (this.lastHealth.issues === 0) hd.textContent = `体检通过 · ${this.lastHealth.lastChecked}`;
            else hd.textContent = `${this.lastHealth.issues} 个待处理 · 点此查看`;
          }
          if (dot) {
            const color = !this.lastHealth ? "var(--bz-text-3)" : this.lastHealth.issues > 0 ? "var(--bz-warning)" : "var(--bz-success)";
            dot.style.background = color;
            dot.style.boxShadow = "none";
          }
        }
        /** 概览统计（供 overviewHTML） */
        overviewStats() {
          const c = this.counts();
          const allNotes = [...this.dataManager.manifest.notes].filter((n) => n.kind !== "password-vault");
          const attachments = allNotes.reduce((s, n) => s + n.attachments.length, 0);
          const pwPlats = this.pwDataManager.platforms();
          const recent2 = [];
          const pushRecent = (kind, title, sub, time, ts) => recent2.push({ kind, title, sub, time, ts });
          for (const p of pwPlats.slice(0, 3)) {
            const r = p.accounts[0];
            const created = r && r.createdAt || "";
            pushRecent("pw", p.platform, r ? r.account || "(无账号)" : "", relTime(created), Date.parse(created) || 0);
          }
          for (const n of allNotes.slice(0, 3)) {
            const kind = n.kind === "diary-entry" ? "diary" : "note";
            pushRecent(kind, n.title, `${n.attachments.length} 个附件`, formatRelativeTime(n.createdAt), Date.parse(n.createdAt || "") || 0);
          }
          recent2.sort((a, b) => b.ts - a.ts);
          return {
            counts: c,
            pwPlatforms: pwPlats.length,
            pwFavPlatforms: pwPlats.filter((p) => this.pwDataManager.hasFav(p.platform)).length,
            attachments,
            recent: recent2.slice(0, 6).map(({ kind, title, sub, time }) => ({ kind, title, sub, time })),
            health: this.lastHealth
            // E5：随最近一次体检结果更新（未体检 null → 显示「未体检」）
          };
        }
        /** 桌面区渲染（中列表 + 右详情按资产分发） */
        renderDesktop() {
          var _a2, _b2, _c, _d, _e;
          const list = this.desk.list;
          const detail = this.desk.detail;
          const kw = this.pwState.searchKw;
          list.innerHTML = "";
          detail.innerHTML = "";
          const titleEl = this.popup.querySelector("[data-vault-title]");
          const subEl = this.popup.querySelector("[data-vault-sub]");
          const c = this.counts();
          if (this.asset !== "pw") {
            (_a2 = this.popup.querySelector('.bz-vault-bar [data-act="pw-fav"]')) == null ? void 0 : _a2.remove();
          }
          if (this.asset === "overview") {
            titleEl.textContent = "保险库";
            subEl.textContent = `${c.pw} 密码 · ${c.note} 笔记 · ${c.diary} 日记`;
            const area = document.createElement("div");
            area.className = "bz-vault-area";
            area.innerHTML = overviewHTML(this.overviewStats());
            area.querySelectorAll(".card[data-nav]").forEach(
              (el) => el.addEventListener("click", () => this.setAssetFromNav(el.getAttribute("data-nav")))
            );
            (_b2 = area.querySelector('[data-hero="lock-note"]')) == null ? void 0 : _b2.addEventListener("click", () => {
              var _a3;
              return (_a3 = this.onLockCurrentNote) == null ? void 0 : _a3.call(this);
            });
            (_c = area.querySelector('[data-hero="add-pw"]')) == null ? void 0 : _c.addEventListener("click", () => this.openPwEntryDialog());
            area.querySelectorAll('[data-hero="health"]').forEach(
              (el) => el.addEventListener("click", () => void this.openHealthDialog())
            );
            (_d = area.querySelector('[data-hero="recent-all"]')) == null ? void 0 : _d.addEventListener("click", () => this.setAssetFromNav("pw"));
            area.querySelectorAll(".bz-vault-minirow[data-recent]").forEach(
              (el) => el.addEventListener("click", () => this.setAssetFromNav(el.getAttribute("data-recent")))
            );
            detail.appendChild(area);
            return;
          }
          if (this.asset === "pw") {
            titleEl.textContent = "密码";
            const plats = this.pwDataManager.platforms();
            subEl.textContent = kw ? `${this.pwDataManager.search(kw).length} 条匹配` : `${plats.length} 平台 · ${c.pw} 账号`;
            const barActs = this.popup.querySelector(".bz-vault-bar");
            const hasPwFav = !!barActs.querySelector('[data-act="pw-fav"]');
            if (!hasPwFav) {
              const favBtn = document.createElement("button");
              favBtn.className = "bz-vault-ic";
              favBtn.dataset.act = "pw-fav";
              favBtn.title = this.pwState.view === "fav" ? "全部平台" : "只看收藏";
              favBtn.innerHTML = vIc(this.pwState.view === "fav" ? "star" : "star-outline", 15);
              barActs.appendChild(favBtn);
              favBtn.addEventListener("click", () => {
                this.pwState.view = this.pwState.view === "fav" ? "all" : "fav";
                this.renderAll();
              });
            } else {
              const b = barActs.querySelector('[data-act="pw-fav"]');
              b.title = this.pwState.view === "fav" ? "全部平台" : "只看收藏";
              b.innerHTML = vIc(this.pwState.view === "fav" ? "star" : "star-outline", 15);
            }
            const listHead2 = document.createElement("div");
            listHead2.className = "bz-vault-lc-head";
            listHead2.innerHTML = `<div class="t">平台</div><button class="lc-add" data-lc-add="pw" title="新增密码">${vIc("plus", 13)} 新增密码</button>`;
            (_e = listHead2.querySelector('[data-lc-add="pw"]')) == null ? void 0 : _e.addEventListener("click", () => this.openPwEntryDialog());
            const listBody2 = document.createElement("div");
            listBody2.className = "bz-vault-lc-body";
            list.appendChild(listHead2);
            list.appendChild(listBody2);
            this.pwView.renderDeskList(listBody2, this.pwState, (p, a) => {
              this.pwState.selPlatform = p;
              this.pwState.selAccount = a;
              this.renderDesktop();
            });
            this.pwView.renderDeskDetail(detail, this.pwState);
            return;
          }
          const kind = this.asset;
          let notes = [...this.dataManager.manifest.notes].filter((n) => kind === "diary" ? n.kind === "diary-entry" : n.kind !== "diary-entry" && n.kind !== "password-vault").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          titleEl.textContent = kind === "note" ? "加密笔记" : "加密日记";
          subEl.textContent = kind === "note" ? `${notes.length} 篇 · 原路径已移出` : `${notes.length} 篇 · 日记面板「加密」分类移入`;
          if (kw) {
            const lower = kw.toLowerCase();
            notes = notes.filter((n) => (n.title || "").toLowerCase().includes(lower) || (n.path || "").toLowerCase().includes(lower));
          }
          const listHead = document.createElement("div");
          listHead.className = "bz-vault-lc-head";
          listHead.innerHTML = `<div class="t">${kind === "note" ? "全部加密笔记" : "加密日记条目"}</div><span class="lc-count">${notes.length} 项</span>`;
          const listBody = document.createElement("div");
          listBody.className = "bz-vault-lc-body";
          list.appendChild(listHead);
          list.appendChild(listBody);
          if (!notes.length) {
            listBody.replaceChildren(
              uiEmpty(
                kind === "note" ? { title: "还没有加密笔记", desc: "用「加密当前笔记」把整篇笔记移入保险库" } : { title: "还没有加密日记", desc: "日记面板把条目改分类为「加密」后移入这里" }
              )
            );
            return;
          }
          const selId = this._selNoteId && notes.some((n) => n.id === this._selNoteId) ? this._selNoteId : notes[0].id;
          for (const n of notes) {
            const row = document.createElement("div");
            row.innerHTML = noteRowHTML(n, kind, n.id === selId);
            const el = row.firstElementChild;
            el.addEventListener("click", () => {
              this._selNoteId = n.id;
              this.renderDesktop();
            });
            el.addEventListener("dblclick", () => {
              if (this.previewMask) registerSheetCompanion(this.previewMask);
              void this.openPreview(n);
            });
            this.attachNoteDrawer(el, n, kind);
            listBody.appendChild(el);
          }
          this.renderNoteDetail(detail, notes.find((n) => n.id === selId) || notes[0], kind);
        }
        /** 详情 ⋮ → 弹行级抽屉（attachItemActions 需要真实元素承载，临时挂到 detail 根再触发 contextmenu） */
        openNoteDetailMenu(note, kind) {
          const holder = document.createElement("div");
          holder.style.display = "none";
          this.desk.detail.appendChild(holder);
          this.attachNoteDrawer(holder, note, kind);
          holder.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }));
        }
        /** 加密笔记/日记详情（异步解密日记正文预览） */
        renderNoteDetail(detail, note, kind) {
          const plain = kind === "diary" ? this._diaryPlain[note.id] : void 0;
          detail.innerHTML = noteDetailHTML(note, kind, plain);
          const bind = (a, fn) => {
            var _a2;
            (_a2 = detail.querySelector(`[data-detail="${a}"]`)) == null ? void 0 : _a2.addEventListener("click", (e) => {
              e.stopPropagation();
              fn();
            });
          };
          bind("preview", () => {
            if (this.previewMask) registerSheetCompanion(this.previewMask);
            void this.openPreview(note);
          });
          bind("restore", () => this.confirmRestore(note));
          bind("delete", () => this.confirmDeleteNote(note));
          bind("restore-diary", () => this.confirmRestoreDiary(note));
          bind("copy-diary", () => this.copyDiaryText(note));
          bind("destroy-diary", () => this.confirmDestroyDiary(note));
          bind("menu", () => this.openNoteDetailMenu(note, kind));
          if (kind === "diary" && !this._diaryPlain[note.id]) {
            void this.dataManager.decryptNoteBody(note).then((t) => {
              if (t !== null && this._selNoteId === note.id) {
                this._diaryPlain[note.id] = t;
                this.renderNoteDetail(detail, note, kind);
              }
            }).catch(() => {
            });
          }
        }
        /** 笔记/日记动作集（行卡抽屉与移动详情页 ⋮ 共用） */
        noteDrawerActions(note, kind) {
          const isDiary = kind === "diary";
          const actions = [];
          actions.push({
            icon: "eye",
            label: isDiary ? "预览正文" : "预览",
            keepOpen: true,
            onClick: () => {
              if (this.previewMask) registerSheetCompanion(this.previewMask);
              void this.openPreview(note);
            }
          });
          if (isDiary) {
            actions.push({
              icon: "download",
              label: "还原回日记",
              onClick: () => this.confirmRestoreDiary(note)
            });
            actions.push({
              icon: "trash-2",
              label: "彻底销毁",
              kind: "danger",
              onClick: () => this.confirmDestroyDiary(note)
            });
          } else {
            actions.push({
              icon: "undo-2",
              label: "还原",
              kind: "danger",
              onClick: () => this.confirmRestore(note)
            });
            actions.push({
              icon: "trash-2",
              label: "删除",
              kind: "danger",
              onClick: () => this.confirmDeleteNote(note)
            });
          }
          return { actions, opts: { sheetHead: this.buildSheetHead(note, isDiary) } };
        }
        /** 笔记行/详情统一右键抽屉（预览/还原/删除） */
        attachNoteDrawer(el, note, kind) {
          const { actions, opts } = this.noteDrawerActions(note, kind);
          attachItemActions(el, actions, opts);
        }
        buildSheetHead(note, isDiary = false) {
          const head = document.createElement("div");
          head.className = "bz-item-sheet-entry";
          const body = document.createElement("div");
          body.style.cssText = "display:flex; align-items:flex-start; gap:10px;";
          const emoji = document.createElement("span");
          emoji.className = "bz-item-sheet-emoji";
          emoji.innerHTML = vIc(isDiary ? "book-lock" : "file-lock", 16);
          body.appendChild(emoji);
          const info = document.createElement("div");
          info.style.cssText = "flex:1; min-width:0;";
          const t = document.createElement("div");
          t.className = "bz-item-sheet-title";
          t.textContent = note.title;
          info.appendChild(t);
          const s = document.createElement("div");
          s.className = "bz-item-sheet-sub";
          s.textContent = `${formatRelativeTime(note.createdAt)} · ${note.attachments.length} 个附件`;
          info.appendChild(s);
          body.appendChild(info);
          head.appendChild(body);
          return head;
        }
        // ---------- 密码条目弹窗（添加/编辑/平台编辑/确认/toast） ----------
        /** 密码添加/编辑弹窗（移动端复用桌面弹窗 DOM；双端共享 pwDataManager） */
        openPwEntryDialog(edit, prefill) {
          var _a2;
          if (!this.dataManager.unlocked) {
            notice("请先解锁保险库");
            return;
          }
          this._pwEditingId = edit ? edit.id : null;
          this._pwDupConfirmed = false;
          const dlg = this.ensurePwDialog();
          const title = dlg.querySelector(".bz-vault-dlg h3");
          title.textContent = edit ? "编辑密码条目" : "添加密码条目";
          const fields = ["platform", "url", "account", "password", "note"];
          fields.forEach((f) => {
            const input = dlg.querySelector(`[data-f="${f}"]`);
            input.value = edit ? edit[f] || "" : prefill && f !== "password" ? prefill[f] || "" : "";
          });
          const pw = edit ? edit.password : this.generatePassword();
          const pwInput = dlg.querySelector('[data-f="password"]');
          pwInput.value = pw;
          pwInput.type = "password";
          const eyeBtn = dlg.querySelector('[data-pwv-dlg="eye"]');
          if (eyeBtn) {
            eyeBtn.title = "显示密码";
            eyeBtn.innerHTML = vIc("eye", 14);
          }
          dlg.querySelector("[data-f-err]").textContent = "";
          (_a2 = this.pwDlgSyncUi) == null ? void 0 : _a2.call(this);
          this.openPwDialogOverlay(true);
          const first = dlg.querySelector('[data-f="platform"]');
          first == null ? void 0 : first.focus();
        }
        ensurePwDialog() {
          var _a2, _b2, _c, _d, _e;
          if (this.pwDlg && document.body.contains(this.pwDlg)) return this.pwDlg;
          const dlg = document.createElement("div");
          dlg.className = "bz-vault-dlg-mask";
          dlg.innerHTML = `
      <div class="bz-vault-dlg">
        <h3>添加密码条目</h3>
        <div class="sub">带 * 为必填 · 平台与账号密码不可为空</div>
        <label>平台 *</label><input data-f="platform" placeholder="如 GitHub">
        <label>链接（可选）</label><input data-f="url" placeholder="https://…">
        <label>账号 *</label><input data-f="account" placeholder="登录账号 / 邮箱 / 手机号">
        <label>密码 *</label>
        <div class="pwdrow"><input data-f="password" type="password" placeholder="密码" autocomplete="new-password"><button class="gen" data-pwv-dlg="gen">生成</button><button class="mini" data-pwv-dlg="eye" type="button" title="显示密码">${vIc("eye", 14)}</button></div>
        <div class="pwstrength" data-pw-strength></div>
        <label>备注（可选）</label><input data-f="note" placeholder="备用信息…">
        <div class="err" data-f-err></div>
        <div class="btns"><button class="cancel" data-pwv-dlg="cancel">取消</button><button class="save" data-pwv-dlg="save">保存</button></div>
      </div>`;
          const errEl = dlg.querySelector("[data-f-err]");
          const get = (f) => dlg.querySelector(`[data-f="${f}"]`).value.trim();
          (_a2 = dlg.querySelector('[data-pwv-dlg="eye"]')) == null ? void 0 : _a2.addEventListener("click", () => {
            const input = dlg.querySelector('[data-f="password"]');
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            const eye = dlg.querySelector('[data-pwv-dlg="eye"]');
            eye.title = show ? "隐藏密码" : "显示密码";
            eye.innerHTML = vIc(show ? "eye-off" : "eye", 14);
            input.focus();
          });
          const strengthEl = dlg.querySelector("[data-pw-strength]");
          const syncStrength = () => {
            const v = dlg.querySelector('[data-f="password"]').value;
            if (!v) {
              strengthEl.textContent = "";
              delete strengthEl.dataset.level;
              return;
            }
            const s = passwordStrength(v);
            strengthEl.textContent = "强度：" + pwStrengthLabel(s);
            strengthEl.dataset.level = s;
          };
          this.pwDlgSyncUi = syncStrength;
          dlg.querySelector('[data-f="password"]').addEventListener("input", syncStrength);
          const flow = [
            ["platform", "url"],
            ["url", "account"],
            ["account", "password"],
            ["password", "note"],
            ["note", null]
          ];
          for (const [f, next] of flow) {
            (_b2 = dlg.querySelector(`[data-f="${f}"]`)) == null ? void 0 : _b2.addEventListener("keydown", (e) => {
              var _a3, _b3;
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (next) (_a3 = dlg.querySelector(`[data-f="${next}"]`)) == null ? void 0 : _a3.focus();
              else (_b3 = dlg.querySelector('[data-pwv-dlg="save"]')) == null ? void 0 : _b3.click();
            });
          }
          dlg.addEventListener("click", (e) => {
            if (e.target === dlg) this.openPwDialogOverlay(false);
          });
          (_c = dlg.querySelector('[data-pwv-dlg="gen"]')) == null ? void 0 : _c.addEventListener("click", () => {
            dlg.querySelector('[data-f="password"]').value = this.generatePassword();
            syncStrength();
            this.toast("已生成新密码");
          });
          (_d = dlg.querySelector('[data-pwv-dlg="cancel"]')) == null ? void 0 : _d.addEventListener("click", () => this.openPwDialogOverlay(false));
          (_e = dlg.querySelector('[data-pwv-dlg="save"]')) == null ? void 0 : _e.addEventListener("click", async () => {
            var _a3, _b3;
            const platform = get("platform");
            if (!platform) {
              errEl.textContent = "平台不能为空";
              return;
            }
            if (!get("account") || !get("password")) {
              errEl.textContent = "账号和密码不能为空";
              return;
            }
            const account = get("account");
            const dup = this.pwDataManager.pwData.find(
              (d) => d.id !== this._pwEditingId && (d.platform || "").trim() === platform && (d.account || "").trim() === account
            );
            if (dup && !this._pwDupConfirmed) {
              this._pwDupConfirmed = true;
              errEl.textContent = `该平台已有同名账号（${dup.account || account}），再次点击保存将放行`;
              return;
            }
            const item = { platform, url: get("url"), account, password: get("password"), note: get("note") };
            try {
              if (this._pwEditingId) {
                await this.pwDataManager.updateItem(this._pwEditingId, item);
                this.pwState.selPlatform = item.platform;
                this.pwState.selAccount = this._pwEditingId;
              } else {
                await this.pwDataManager.addItem(item);
                this.pwState.selPlatform = item.platform;
                this.pwState.selAccount = (_b3 = (_a3 = this.pwDataManager.pwData[0]) == null ? void 0 : _a3.id) != null ? _b3 : null;
              }
              this.openPwDialogOverlay(false);
              this.renderAll();
              this.toast("已保存");
            } catch (e) {
              errEl.textContent = "保存失败：" + e.message;
            }
          });
          document.body.appendChild(dlg);
          this.pwDlg = dlg;
          return dlg;
        }
        openPwDialogOverlay(open) {
          var _a2;
          if (!this.pwDlg) return;
          if (open) {
            topifyZ(this.pwDlg);
            if (!this.pwDlgEsc) {
              this.pwDlgEsc = escManager.register("bz-vault-pw-dlg", {
                isVisible: () => !!this.pwDlg && this.pwDlg.style.display !== "none" && document.body.contains(this.pwDlg),
                close: () => this.openPwDialogOverlay(false)
              });
            }
          } else {
            (_a2 = this.pwDlgEsc) == null ? void 0 : _a2.unregister();
            this.pwDlgEsc = null;
          }
          this.pwDlg.style.display = open ? "flex" : "none";
        }
        /** 卸载辅助：关密码弹窗（注销 ESC 层）并移除 body 上无 id 的弹窗遮罩（G：cleanup 此前不清） */
        closeAllDialogs() {
          this.openPwDialogOverlay(false);
          document.querySelectorAll("body > .bz-vault-dlg-mask").forEach((el) => el.remove());
        }
        /** 平台信息编辑弹窗（独立自绘） */
        openPwPlatformEdit(platform) {
          var _a2, _b2;
          const accs = this.pwDataManager.accountsOf(platform);
          const d = accs[0];
          const mask = document.createElement("div");
          mask.className = "bz-vault-dlg-mask";
          topifyZ(mask);
          mask.style.display = "flex";
          mask.innerHTML = `
      <div class="bz-vault-dlg">
        <h3>编辑平台 · ${escapeHtml(platform)}</h3>
        <div class="sub">改名/改链接将应用到该平台全部账号</div>
        <label>平台名 *</label><input data-pf="platform" value="${escapeHtml(platform === "(无平台)" ? "" : platform)}">
        <label>链接（可选）</label><input data-pf="url" value="${escapeHtml((d == null ? void 0 : d.url) || "")}">
        <div class="err" data-pf-err></div>
        <div class="btns"><button class="cancel" data-pf-act="cancel">取消</button><button class="save" data-pf-act="save">保存</button></div>
      </div>`;
          const errEl = mask.querySelector("[data-pf-err]");
          let escH = null;
          const closePf = () => {
            escH == null ? void 0 : escH.unregister();
            escH = null;
            mask.remove();
          };
          escH = escManager.register("bz-vault-pw-platform-edit", {
            isVisible: () => mask.isConnected,
            close: closePf
          });
          mask.addEventListener("click", (e) => {
            if (e.target === mask) closePf();
          });
          (_a2 = mask.querySelector('[data-pf-act="cancel"]')) == null ? void 0 : _a2.addEventListener("click", () => closePf());
          (_b2 = mask.querySelector('[data-pf-act="save"]')) == null ? void 0 : _b2.addEventListener("click", async () => {
            const name = mask.querySelector('[data-pf="platform"]').value.trim();
            if (!name) {
              errEl.textContent = "平台名不能为空";
              return;
            }
            const url = mask.querySelector('[data-pf="url"]').value;
            try {
              await this.pwDataManager.updatePlatform(platform, { platform: name, url });
              this.pwState.selPlatform = name;
              this.pwState.selAccount = null;
              closePf();
              this.renderAll();
              this.toast("平台信息已更新");
            } catch (e) {
              errEl.textContent = "保存失败：" + e.message;
            }
          });
          document.body.appendChild(mask);
        }
        askPwConfirm(title, message, okLabel, onYes) {
          void openFlowDialog({
            title,
            message,
            actions: [
              { label: "取消", value: "cancel" },
              { label: okLabel, value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v === "ok") onYes();
          });
        }
        /** 敏感文本复制 + 60s 自动清空（密码资产与日记共用） */
        async copySensitive(text) {
          try {
            await copySensitiveText(text);
            return true;
          } catch (e) {
            try {
              const ta = document.createElement("textarea");
              ta.value = text;
              ta.style.cssText = "position:fixed;opacity:0";
              document.body.appendChild(ta);
              ta.select();
              const ok = document.execCommand("copy");
              ta.remove();
              if (ok) armClipboardClear();
              return ok;
            } catch (e2) {
              return false;
            }
          }
        }
        openExternal(url) {
          try {
            const w = window;
            const electron = w.require && w.require("electron");
            if (electron && electron.shell) {
              electron.shell.openExternal(url);
              return;
            }
          } catch (e) {
          }
          window.open(url, "_blank");
        }
        generatePassword() {
          const length = parseInt(this.config.pwLength || "") || 16;
          const charset = this.config.pwCharset || DEFAULT_PW_CHARSET;
          return secureRandomPassword(length, charset);
        }
        genAndToast() {
          if (!this.dataManager.unlocked) {
            notice("请先解锁保险库");
            return;
          }
          void this.copySensitive(this.generatePassword()).then((ok) => {
            if (ok) this.toast("新密码已生成并复制（60 秒后自动清空），可「新增密码」粘贴使用");
            else this.toast("生成失败，请重试", true);
          });
        }
        setAssetFromNav(a) {
          this.asset = a;
          lastVisitedAsset = a;
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach(
            (el) => el.classList.toggle("on", el.getAttribute("data-asset") === a)
          );
          this.mob.seg.querySelectorAll(".sg").forEach(
            (el) => el.classList.toggle("on", el.getAttribute("data-masset") === a)
          );
          this.renderAll();
        }
        /**
         * 快速取密落点（解锁成功后调用）：直接切到密码资产并聚焦搜索框——
         * 打开面板就是为了取密/管密，不再停留在概览多点一步。
         */
        enterPwQuickAccess() {
          if (!this._initialized) return;
          this.setAssetFromNav("pw");
          this.desk.search.value = "";
          try {
            this.desk.search.focus({ preventScroll: true });
          } catch (e) {
            this.desk.search.focus();
          }
        }
        /** 直落上次停留资产（已解锁直接打开面板时；无记忆回落密码资产） */
        restoreLastAsset() {
          if (!this._initialized) return;
          this.setAssetFromNav(lastVisitedAsset);
        }
        /** 立即上锁（锁屏接管） */
        lockNow() {
          this.dataManager.lock();
          this.pwDataManager.lock();
          this.pwState = { ...DEFAULT_PW_STATE };
          this._selNoteId = null;
          this._diaryPlain = {};
          this._pwEditingId = null;
          this.asset = "overview";
          this.lastHealth = null;
          this.unlockedAt = null;
          this.stopSessionTimers();
          this.notifyUnlockUi();
          if (this.isSecurityMode()) {
            this.hide();
          }
        }
        /** 解锁态变更后 UI 同步（Controller attachStatusBar 也调；锁屏/已解锁文本 + 重绘）。未建 DOM 时静默 */
        notifyUnlockUi() {
          if (!this.popup || !this._initialized) return;
          const st = this.popup.querySelector("[data-mob-unlock]");
          if (st) st.textContent = this.dataManager.unlocked ? "已解锁" : "已锁定";
          if (this.dataManager.unlocked) {
            if (this.unlockedAt === null) this.unlockedAt = Date.now();
          } else {
            this.unlockedAt = null;
          }
          this.updateUnlockDuration();
          this.renderAll();
        }
        // ---------- 移动端渲染 ----------
        renderMobile() {
          const body = this.mob.body;
          body.innerHTML = "";
          const c = this.counts();
          if (this.asset === "overview") {
            const area = document.createElement("div");
            area.className = "bz-vault-mob-overview";
            area.innerHTML = overviewHTML(this.overviewStats());
            body.appendChild(area);
            return;
          }
          if (this.asset === "pw") {
            const card = document.createElement("div");
            card.className = "bz-vault-mob-pwlist";
            this.pwView.renderMobList(card, this.pwState, (p) => this.openPwMobPage(p));
            body.appendChild(card);
            return;
          }
          const kind = this.asset;
          const notes = [...this.dataManager.manifest.notes].filter((n) => kind === "diary" ? n.kind === "diary-entry" : n.kind !== "diary-entry" && n.kind !== "password-vault").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          const kw = this.pwState.searchKw;
          const filtered = kw ? notes.filter((n) => (n.title || "").toLowerCase().includes(kw.toLowerCase()) || (n.path || "").toLowerCase().includes(kw.toLowerCase())) : notes;
          if (!filtered.length) {
            body.replaceChildren(
              uiEmpty(
                kind === "diary" ? { title: "还没有加密日记", desc: "日记面板把条目改分类为「加密」后移入这里" } : { title: "还没有加密笔记", desc: "用「加密当前笔记」把整篇笔记移入保险库" }
              )
            );
            return;
          }
          for (const n of filtered) {
            const row = document.createElement("div");
            row.innerHTML = noteRowHTML(n, kind, false);
            const el = row.firstElementChild;
            el.addEventListener("click", () => {
              this._selNoteId = n.id;
              this.openNoteMobPage(n, kind);
            });
            this.attachNoteDrawer(el, n, kind);
            body.appendChild(el);
          }
        }
        openNoteMobPage(note, kind) {
          var _a2, _b2;
          const page = document.createElement("div");
          page.className = "bz-vault-mobpage";
          page.innerHTML = `<div class="head"><button class="back bz-touch-target--xl" data-mob-back>${vIc("chevron-left", 16)}</button><div class="t">${kind === "note" ? "加密笔记" : "加密日记"}</div><button class="ic" data-mob-menu>${vIc("more-h", 16)}</button></div><div class="body"></div>`;
          const body = page.querySelector(".body");
          body.innerHTML = noteDetailHTML(note, kind);
          const bind = (a, fn) => {
            var _a3;
            (_a3 = body.querySelector(`[data-detail="${a}"]`)) == null ? void 0 : _a3.addEventListener("click", (e) => {
              e.stopPropagation();
              fn();
            });
          };
          bind("preview", () => void this.openPreview(note));
          bind("restore", () => this.confirmRestore(note));
          bind("delete", () => this.confirmDeleteNote(note));
          bind("restore-diary", () => this.confirmRestoreDiary(note));
          bind("copy-diary", () => this.copyDiaryText(note));
          bind("destroy-diary", () => this.confirmDestroyDiary(note));
          (_a2 = page.querySelector("[data-mob-back]")) == null ? void 0 : _a2.addEventListener("click", () => page.remove());
          (_b2 = page.querySelector("[data-mob-menu]")) == null ? void 0 : _b2.addEventListener("click", () => {
            const { actions, opts } = this.noteDrawerActions(note, kind);
            openItemSheet(actions, opts);
          });
          this.mob.body.appendChild(page);
          if (kind === "diary") {
            void this.dataManager.decryptNoteBody(note).then((t) => {
              const pre = body.querySelector(".note.pre");
              if (pre && t !== null) pre.innerHTML = escapeHtml(t).replace(/\n/g, "<br>");
            }).catch(() => {
            });
          }
        }
        openPwMobPage(p) {
          var _a2, _b2;
          const page = document.createElement("div");
          page.className = "bz-vault-mobpage";
          page.innerHTML = `<div class="head"><button class="back bz-touch-target--xl" data-mob-back>${vIc("chevron-left", 16)}</button><div class="t">${escapeHtml(p.platform)}</div><button class="ic" data-mob-menu>${vIc("more-h", 16)}</button></div><div class="body"></div>`;
          this.pwView.renderMobPlatformPage(page.querySelector(".body"), p, this.pwState);
          (_a2 = page.querySelector("[data-mob-back]")) == null ? void 0 : _a2.addEventListener("click", () => page.remove());
          (_b2 = page.querySelector("[data-mob-menu]")) == null ? void 0 : _b2.addEventListener("click", () => this.pwView.openPlatformSheet(p.platform));
          this.mob.body.appendChild(page);
        }
        openPwAccountPage(d, st) {
          var _a2, _b2;
          const page = document.createElement("div");
          page.className = "bz-vault-mobpage";
          page.innerHTML = `<div class="head"><button class="back bz-touch-target--xl" data-mob-back>${vIc("chevron-left", 16)}</button><div class="t">${escapeHtml(d.platform)}</div><button class="ic" data-mob-menu>${vIc("more-h", 16)}</button></div><div class="body"></div>`;
          const body = page.querySelector(".body");
          this.pwView.renderDeskDetail(body, { ...st, selPlatform: d.platform, selAccount: d.id });
          (_a2 = page.querySelector("[data-mob-back]")) == null ? void 0 : _a2.addEventListener("click", () => page.remove());
          (_b2 = page.querySelector("[data-mob-menu]")) == null ? void 0 : _b2.addEventListener("click", () => this.pwView.openAccountSheet(d));
          this.mob.body.appendChild(page);
        }
        /** 轻量 toast（保险库窗口内） */
        toast(msg, isErr = false) {
          notice(msg, isErr ? "error" : void 0);
        }
        // ---------- 加密笔记/日记销毁/还原 ----------
        confirmDeleteNote(note) {
          void openFlowDialog({
            title: "删除加密笔记",
            message: `将永久删除「${note.title}」的正文与全部附件密文，不可恢复。确定删除？`,
            actions: [
              { label: "取消", value: "cancel" },
              { label: "永久删除", value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v !== "ok") return;
            void this.dataManager.removeNote(note.id).then(() => {
              if (this._selNoteId === note.id) this._selNoteId = null;
              this.renderList();
              this.toast(`已删除加密笔记「${note.title}」`);
            }).catch((e) => this.toast("删除失败：" + e.message, true));
          });
        }
        /** 日记还原回日记（复用 diary reclassifyEntry 语义：还原块 merge 回原日期 md） */
        confirmRestoreDiary(note) {
          void openFlowDialog({
            title: "还原回日记",
            message: `将「${note.title}」的正文与附件还原到 ${note.path} 的时间序位置？`,
            actions: [
              { label: "取消", value: "cancel" },
              { label: "还原", value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v !== "ok") return;
            const h = progressNotify("还原日记 " + note.title);
            void this.restoreDiaryEntry(note, h);
          });
        }
        /** 实际执行日记还原（调 SafeManager.restoreDiaryEntry——diary 域同款语义） */
        async restoreDiaryEntry(note, h) {
          try {
            const plain = await this.dataManager.decryptNoteBody(note);
            if (plain === null) {
              if (h) h.hide();
              this.toast("正文解密失败，无法还原", true);
              return;
            }
            const ok = await this.dataManager.restoreDiaryEntry(note.id, plain);
            if (h) h.hide();
            if (ok) {
              if (this._selNoteId === note.id) this._selNoteId = null;
              this.renderList();
              this.toast("已还原回日记");
            } else {
              this.toast("还原失败：附件冲突或写回失败", true);
            }
          } catch (e) {
            if (h) h.hide();
            this.toast("还原失败：" + e.message, true);
          }
        }
        copyDiaryText(note) {
          void this.dataManager.decryptNoteBody(note).then((t) => {
            if (t === null) {
              this.toast("正文解密失败", true);
              return;
            }
            void this.copySensitive(t).then((ok) => this.toast(ok ? "正文已复制（60 秒后自动清空）" : "复制失败", !ok));
          }).catch(() => this.toast("正文解密失败", true));
        }
        confirmDestroyDiary(note) {
          void openFlowDialog({
            title: "彻底销毁日记",
            message: `将永久销毁「${note.title}」的密文（含附件）。此操作不可撤销，确定继续吗？`,
            actions: [
              { label: "取消", value: "cancel" },
              { label: "永久销毁", value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v !== "ok") return;
            void this.dataManager.removeNote(note.id).then(() => {
              delete this._diaryPlain[note.id];
              if (this._selNoteId === note.id) this._selNoteId = null;
              this.renderList();
              this.toast(`已销毁「${note.title}」`);
            }).catch((e) => this.toast("销毁失败：" + e.message, true));
          });
        }
        confirmRestore(note) {
          void openFlowDialog({
            title: "还原",
            message: `将「${note.title}」的原文${note.attachments.length ? "与 " + note.attachments.length + " 个原质量附件" : ""}还原到原路径？`,
            actions: [
              { label: "取消", value: "cancel" },
              { label: "还原", value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v !== "ok") return;
            const h = progressNotify("还原 " + note.title);
            void this.dataManager.restoreNote(note.id, (p) => updateProgress(h, p.done, p.total, p.current)).then(({ conflicts, removed, manifestSaveFailed }) => {
              const total = note.attachments.length + 1;
              if (removed) {
                finishProgress(h, total, "还原完成");
                this.hide();
                this.openRestoredNote(note);
              } else if (manifestSaveFailed) {
                finishProgress(h, total, "文件已还原（清单保存失败）");
                notice(
                  "笔记与附件已还原到原位置，但保险库清单保存失败（磁盘异常）；下次解锁后重试还原将自动完成清理",
                  "warning"
                );
              } else {
                finishProgress(h, total, "还原未完成（" + conflicts.length + " 个目标有冲突）");
                const cap = (p) => p.length > 48 ? p.slice(0, 48) + "…" : p;
                const paths = conflicts.map(cap).join("、");
                notice(
                  `还原中止：${conflicts.length} 个目标被占用或不可用（${paths}），未写入任何文件，条目保留在保险库`,
                  "warning"
                );
              }
              void this.renderList();
            }).catch((e) => {
              if (h) h.hide();
              notifyActionError(e, "还原");
            });
          });
        }
        /** 还原成功后打开该笔记（Obsidian 当前叶子页打开） */
        openRestoredNote(note) {
          var _a2, _b2;
          const app = getApp();
          try {
            const file = app.vault.getAbstractFileByPath(note.path);
            if (file && file.isFolder !== true) {
              (_b2 = (_a2 = app.workspace).openLinkText) == null ? void 0 : _b2.call(_a2, note.path, note.path);
            }
          } catch (e) {
          }
        }
        // ---------- 预览窗 ----------
        /**
         * 打开预览窗。关键：先同步显示弹窗骨架再异步填充正文——
         * 真实 Obsidian 里 MarkdownRenderer.render 可能挂起（历史 b0831de 修过预览挂起），
         * 若把所有 await 跑完才设 display，挂起时单击就毫无反应；故拆成「先显骨架 + 异步填充」。
         */
        async openPreview(note) {
          if (!this.previewPopup) this.ensureElements();
          if (!this.dataManager.unlocked || !this.dataManager.password) return;
          this.revokePreviewUrls();
          const popup = this.previewPopup;
          const mask = this.previewMask;
          popup.innerHTML = "";
          const header = document.createElement("div");
          header.className = "bz-encrypt-preview-head";
          const title = document.createElement("h4");
          title.textContent = note.title;
          const closeBtn = document.createElement("button");
          closeBtn.innerHTML = vIc("x", 14);
          closeBtn.className = "bz-encrypt-btn bz-win-close";
          closeBtn.title = "关闭";
          closeBtn.setAttribute("aria-label", "关闭");
          closeBtn.onclick = () => this.closePreview();
          header.appendChild(title);
          header.appendChild(closeBtn);
          popup.appendChild(header);
          const body = document.createElement("div");
          body.className = "bz-encrypt-preview-body";
          const loadHint = document.createElement("div");
          loadHint.className = "bz-encrypt-preview-loading";
          loadHint.textContent = "解密中…";
          body.appendChild(loadHint);
          popup.appendChild(body);
          topifyZ(this.previewMask, this.previewPopup);
          mask.style.display = "block";
          popup.style.display = "flex";
          void this.fillPreviewBody(note, body);
        }
        /** 预览窗正文异步填充：解密 → 渲染（带超时兜底）→ 图随文走 → 画廊 */
        async fillPreviewBody(note, body) {
          try {
            const bodyP = this.dataManager.decryptNoteBody(note);
            const previewP = [];
            const seen = /* @__PURE__ */ new Set();
            for (const a of note.attachments) {
              if (!a.hasPreview || seen.has(a.path)) continue;
              seen.add(a.path);
              previewP.push(
                this.dataManager.decryptPreview(a).then(
                  (du) => ({ path: a.path, du: du || "" }),
                  () => ({ path: a.path, du: "" })
                )
              );
            }
            const [plain, previewResults] = await Promise.all([bodyP, Promise.all(previewP)]);
            const dataUrls = /* @__PURE__ */ new Map();
            for (const r of previewResults) dataUrls.set(r.path, r.du);
            const { text, slots, inlined } = collectMediaSlots(plain != null ? plain : "", note.attachments);
            const mdEl = document.createElement("div");
            mdEl.className = "bz-encrypt-preview-md";
            const rendered = await this.renderWithTimeout(getApp(), text, mdEl, note.path);
            if (rendered) {
              let html = mdEl.innerHTML;
              for (const slot of slots) {
                const a = slot.attachment;
                if (a) html = html.split(slot.token).join(mediaHtml(a, dataUrls.get(a.path)));
                else html = html.split(slot.token).join("");
              }
              mdEl.innerHTML = html;
            } else {
              mdEl.textContent = plain;
            }
            body.innerHTML = "";
            body.appendChild(mdEl);
            const residuals = note.attachments.filter((a) => !inlined.has(a.path));
            if (residuals.length) {
              const gallery = document.createElement("div");
              gallery.className = "bz-encrypt-preview-gallery";
              for (const a of residuals) {
                const wrap = document.createElement("div");
                wrap.innerHTML = mediaHtml(a, dataUrls.get(a.path));
                gallery.appendChild(wrap);
              }
              body.appendChild(gallery);
            }
            this.bindMediaClicks(body, note.attachments);
            if (this.config.autoLoadOriginal) {
              body.querySelectorAll(".bz-encrypt-preview-slot").forEach((slot) => slot.click());
            }
          } catch (e) {
            body.innerHTML = "";
            const err = document.createElement("div");
            err.textContent = "正文解密失败";
            body.appendChild(err);
          }
        }
        /** 渲染带超时：3000ms 内不完成视为失败（防真实环境 render 挂起导致弹窗永久空白/不可关） */
        async renderWithTimeout(app, text, el, path, timeoutMs = 3e3) {
          let finished = false;
          const render = MarkdownRenderer.render(app, text, el, path, new Component()).then(
            () => {
              finished = true;
            },
            () => {
              finished = true;
            }
          );
          await Promise.race([render, new Promise((r) => setTimeout(r, timeoutMs))]);
          return finished;
        }
        /** 预览窗内所有缩略图/占位 slot 绑定点击：只加载被点的那一张原始层 */
        bindMediaClicks(root, attachments) {
          const slots = root.querySelectorAll(".bz-encrypt-preview-slot");
          for (const slot of slots) {
            const key = slot.getAttribute("data-attach");
            if (!key) continue;
            const a = attachments.find((x) => x.path === decodeURIComponent(key));
            if (!a) continue;
            slot.addEventListener("click", () => void this.loadOriginal(a, slot));
          }
        }
        /**
         * 点击缩略图：该图 slot 显示转圈 → 解密原始层 → 原地替换为原始质量图片 / 可播放视频。
         * 不弹通知（缩略图内加载态更直观）；失败恢复缩略图并提示 title 可重试。
         */
        async loadOriginal(a, slot) {
          if (slot.dataset.loaded === "1" || slot.dataset.loading === "1") return;
          slot.dataset.loading = "1";
          slot.classList.add("bz-encrypt-preview-slot--loading");
          try {
            const b64 = await this.dataManager.decryptAttachmentOriginal(a);
            if (!b64) throw new Error("无密文");
            const url = await this.blobUrlOf(b64, mimeOf(a.path));
            const img = slot.querySelector("img.bz-encrypt-preview-media");
            const missing = slot.querySelector(".bz-encrypt-preview-missing");
            if (a.kind === "video") {
              const video = document.createElement("video");
              video.className = "bz-encrypt-preview-video";
              video.controls = true;
              video.preload = "metadata";
              video.src = url;
              if (img) img.replaceWith(video);
              else if (missing) missing.replaceWith(video);
              else slot.appendChild(video);
            } else if (img) {
              img.src = url;
            } else if (missing) {
              const im = document.createElement("img");
              im.className = "bz-encrypt-preview-media";
              im.alt = escapeHtml(a.path || "");
              im.src = url;
              missing.replaceWith(im);
            }
            slot.dataset.loaded = "1";
            slot.classList.add("bz-encrypt-preview-slot--loaded");
          } catch (e) {
            const img = slot.querySelector("img.bz-encrypt-preview-media");
            const missing = slot.querySelector(".bz-encrypt-preview-missing");
            if (img) img.title = "加载失败，点击重试";
            if (missing) missing.title = "加载失败，点击重试";
          } finally {
            delete slot.dataset.loading;
            slot.classList.remove("bz-encrypt-preview-slot--loading");
          }
        }
        /** 原始 base64 → 展示 URL：优先 Blob URL（大视频/大图不撑坏内存），环境不支持时退回 dataURL */
        async blobUrlOf(b64, mime) {
          try {
            const bytes = base64ToBytes(b64);
            const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
            if (url) {
              this._previewUrls.push(url);
              return url;
            }
          } catch (e) {
          }
          return `data:${mime};base64,${b64}`;
        }
        /** 释放本次预览积累的全部 Blob URL（关预览/换预览共用，防内存泄漏） */
        revokePreviewUrls() {
          for (const u of this._previewUrls) {
            try {
              URL.revokeObjectURL(u);
            } catch (e) {
            }
          }
          this._previewUrls = [];
        }
        closePreview() {
          this.revokePreviewUrls();
          if (this.previewMask) unregisterSheetCompanion(this.previewMask);
          if (this.previewMask) this.previewMask.style.display = "none";
          if (this.previewPopup) this.previewPopup.style.display = "none";
        }
        // ---------- 设置弹窗 ----------
        openSettings() {
          openSettingsModal({ title: "保险库设置", maxWidth: 560, schema: encryptSettingsSchema() });
        }
        registerEscape() {
          escManager.register("encrypt", {
            isVisible: () => !!(this.mask && this.mask.style.display === "block") || !!(this.previewMask && this.previewMask.style.display === "block"),
            close: () => {
              if (this.previewMask && this.previewMask.style.display === "block") this.closePreview();
              else if (this.mask && this.mask.style.display === "block") this.hide();
            }
          });
        }
      };
      /** 安全模式：15 分钟无面板交互自动上锁（交互即重置；非安全模式/未解锁不布防） */
      _UIManager.IDLE_LOCK_MS = 15 * 60 * 1e3;
      UIManager = _UIManager;
      _EncryptAppController = class _EncryptAppController {
        constructor(config) {
          this._initialized = false;
          /** 加密进行中标志（重入保护：处理中拒绝再次触发 lockCurrentNote） */
          this._locking = false;
          /** 状态栏元素（main.ts mount 注入；解锁态变化时刷新，补丁：状态栏锁状态提示） */
          this.statusBarEl = null;
          this.config = config;
          this.dataManager = new SafeManager(config.root);
          this.uiManager = new UIManager(this.dataManager, config);
          this.uiManager.onLockCurrentNote = () => {
            void this.lockCurrentNote();
          };
        }
        static getInstance(config) {
          if (!_EncryptAppController.instance) {
            _EncryptAppController.instance = new _EncryptAppController(config);
          }
          return _EncryptAppController.instance;
        }
        /**
         * 状态栏挂载（main.ts onload 调用）：初始为锁定态；订阅解锁态变化刷新，
         * 点击打开统一保险库面板（openEncrypt 有解锁引导）。
         */
        attachStatusBar(el) {
          this.statusBarEl = el;
          this.dataManager.onUnlockChange = (unlocked) => {
            var _a2, _b2;
            if (this.statusBarEl) this.statusBarEl.innerHTML = statusbarHtml(unlocked);
            (_b2 = (_a2 = this.uiManager).notifyUnlockUi) == null ? void 0 : _b2.call(_a2);
          };
          this.dataManager.onUnlockChange(this.dataManager.unlocked);
        }
        async init() {
          if (this._initialized) return;
          this.uiManager.ensureElements();
          this._initialized = true;
        }
        /** 打开保险库主面板：解锁成功直落密码资产并聚焦搜索（快速取密路径）；
         *  已解锁直接打开则恢复上次停留资产（会话级记忆）。 */
        async openManager() {
          if (!this.dataManager.unlocked) {
            const ok = await this.uiManager.showPasswordDialog();
            if (ok) {
              this.uiManager.show();
              this.uiManager.enterPwQuickAccess();
            }
          } else {
            this.uiManager.show();
            this.uiManager.restoreLastAsset();
          }
        }
        /**
         * 快速复制密码（命令 bz-encrypt-copy-password；不打开主面板）：
         * 未解锁先弹主密码 → 轻量 fuzzy 选择器选条目 → 复制到剪贴板（60s 自动清空）。
         */
        async quickCopyPassword() {
          if (!this.dataManager.unlocked) {
            const ok = await this.uiManager.showPasswordDialog();
            if (!ok) return;
          }
          try {
            await this.uiManager.pwDataManager.load();
          } catch (e) {
          }
          const entries = this.uiManager.pwDataManager.pwData;
          if (!entries.length) {
            notice("保险库还没有密码，打开面板后可新增");
            return;
          }
          void openPasswordQuickPicker(entries, (d) => {
            void this.uiManager.copySensitive(d.password).then((ok) => {
              notice(
                ok ? `已复制「${d.platform}」${d.account ? `（${d.account}）` : ""}的密码，60 秒后自动清空` : "复制失败，请手动复制",
                ok ? "success" : "error"
              );
            });
          });
        }
        /** 二次确认：正文与附件将移入保险库（原路径消失），点确认才开始 */
        async confirmLockProceed(file, attCount) {
          return await openFlowDialog({
            title: "加密到保险库",
            message: `把「${file.basename}」的正文${attCount ? "与 " + attCount + " 个附件" : ""}加密移入保险库？加密后原笔记与附件将从原路径移出（保险库内为密文）。`,
            actions: [
              { label: "取消", value: "cancel" },
              { label: "加密", value: "ok", cta: true }
            ]
          }) === "ok";
        }
        /**
         * 读取附件原始内容并按设置生成预览层。
         * Q3-A：任一附件读取失败 → 整笔放弃（返回 null，不落任何东西、原文件不动）；预览失败不算失败（可选增强）。
         */
        async readAttachmentInputs(app, attPaths) {
          var _a2, _b2;
          const attachments = [];
          const size = this.config.previewSize || 384;
          const quality = this.config.previewQuality || 0.5;
          for (const p of attPaths) {
            try {
              const f = app.vault.getAbstractFileByPath(p);
              if (!f) throw new Error("附件不存在");
              const buf = await app.vault.readBinary(f);
              const data = bytesToBase64(new Uint8Array(buf));
              let previewData;
              if (this.config.previewEnabled) {
                try {
                  const resourceUrl = ((_b2 = (_a2 = app.vault).getResourcePath) == null ? void 0 : _b2.call(_a2, f)) || "";
                  const result = kindOf(p) === "video" ? await videoFrame(resourceUrl, size, quality) : await compressImage(resourceUrl, size, quality);
                  if (result) previewData = result.dataUrl;
                } catch (e) {
                  previewData = void 0;
                }
              }
              attachments.push({ path: p, kind: kindOf(p), data, previewData });
            } catch (e) {
              notice("加密失败：附件读取失败（" + p + "）", "error");
              return null;
            }
          }
          return attachments;
        }
        /** 加锁当前打开笔记（正文 + 双链图片/视频附件；执行前弹确认）。重入保护：处理中拒绝再次触发 */
        async lockCurrentNote() {
          if (this._locking) {
            notice("正在加密当前笔记，请稍候");
            return;
          }
          this._locking = true;
          try {
            const app = getApp();
            const file = app.workspace.getActiveFile();
            if (!file) {
              notice("请先打开要加密的笔记");
              return;
            }
            if (!this.dataManager.unlocked || !this.dataManager.password) {
              const ok = await this.uiManager.showPasswordDialog();
              if (!ok) {
                notice("未解锁，已取消加密");
                return;
              }
            }
            const content = await app.vault.read(file);
            const attPaths = collectNoteAttachmentPaths(app, file, content);
            if (!await this.confirmLockProceed(file, attPaths.length)) return;
            const attachments = await this.readAttachmentInputs(app, attPaths);
            if (!attachments) return;
            const h = progressNotify("加密 " + file.basename);
            try {
              await this.dataManager.lockNote(
                {
                  path: file.path,
                  title: file.basename,
                  content,
                  attachments
                },
                (p) => updateProgress(h, p.done, p.total, p.current),
                (failed) => {
                  if (failed.length) {
                    notice(failed.length + " 个原文件删除失败（已保留在原位置，可手动删除）", "warning");
                  }
                }
              );
              finishProgress(h, attachments.length + 1, "加密完成");
              this.uiManager.show();
            } catch (e) {
              if (h) h.hide();
              notifyActionError(e, "加密");
            }
          } finally {
            this._locking = false;
          }
        }
        /** 卸载清理 */
        cleanup() {
          const ids = ["bz-encrypt-mask", "bz-encrypt-popup", "bz-encrypt-preview-mask", "bz-encrypt-preview-popup", "bz-encrypt-health-mask", "bz-encrypt-health-popup"];
          for (const id of ids) {
            const el = document.getElementById(id);
            if (el) el.remove();
          }
          this.uiManager.closeAllDialogs();
          cancelClipboardClear();
          this.uiManager.stopSessionTimers();
          this.uiManager.pwView.disposeRevealTimers();
          this.uiManager.pwDataManager.destroy();
          this.uiManager.mask = null;
          this.uiManager.popup = null;
          this.uiManager.previewMask = null;
          this.uiManager.previewPopup = null;
          this.uiManager.healthMask = null;
          this.uiManager.healthPopup = null;
          this.uiManager._initialized = false;
          this.dataManager.onUnlockChange = null;
          this.dataManager.lock();
        }
      };
      _EncryptAppController.instance = null;
      EncryptAppController = _EncryptAppController;
    }
  });

  // src/encrypt/index.ts
  var encrypt_exports = {};
  __export(encrypt_exports, {
    copyVaultPassword: () => copyVaultPassword,
    encryptCurrentNote: () => encryptCurrentNote,
    ensureEncrypt: () => ensureEncrypt,
    ensureSafeUnlocked: () => ensureSafeUnlocked,
    getSafeManager: () => getSafeManager,
    mountEncryptStatusBar: () => mountEncryptStatusBar,
    openEncrypt: () => openEncrypt,
    unloadEncrypt: () => unloadEncrypt,
    unmountEncryptStatusBar: () => unmountEncryptStatusBar
  });
  function getController() {
    if (!controller) {
      const s = getSettings();
      const config = {
        root: (s.encryptRoot || "CONFIG/.ENCRYPT").replace(/\/+$/, ""),
        previewEnabled: s.encryptPreviewEnabled !== false,
        previewSize: parseInt(s.encryptPreviewSize) || 384,
        previewQuality: parseFloat(s.encryptPreviewQuality) || 0.5,
        autoLoadOriginal: !!s.encryptAutoLoadOriginal,
        securityMode: !!s.encryptSecurityMode,
        // ADR-0085：密码资产并入保险库；生成器沿用全局键（旧密码本同源）
        pwCharset: s.passwordCharset || "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+",
        pwLength: String(parseInt(s.passwordLength) || 16)
      };
      controller = EncryptAppController.getInstance(config);
    }
    return controller;
  }
  async function ensureEncrypt(app) {
    if (initialized) return;
    initialized = true;
    await getController().init();
  }
  function statusbarHtml2(unlocked) {
    return `${vIc(unlocked ? "lock-open" : "lock", 12)} 保险库`;
  }
  function mountEncryptStatusBar(container) {
    if (statusBarEl) return;
    const el = document.createElement("span");
    el.className = "bz-encrypt-statusbar";
    el.title = "保险库：点击打开";
    el.innerHTML = statusbarHtml2(false);
    el.addEventListener("click", () => openEncrypt(getApp()));
    container.appendChild(el);
    statusBarEl = el;
    void ensureEncrypt(getApp()).then(() => getController().attachStatusBar(el));
  }
  function unmountEncryptStatusBar() {
    if (statusBarEl) {
      statusBarEl.remove();
      statusBarEl = null;
    }
  }
  function openEncrypt(app) {
    void ensureEncrypt(app).then(() => getController().openManager());
  }
  function encryptCurrentNote(app) {
    void ensureEncrypt(app).then(() => getController().lockCurrentNote());
  }
  function copyVaultPassword(app) {
    void ensureEncrypt(app).then(() => getController().quickCopyPassword());
  }
  function getSafeManager() {
    return getController().dataManager;
  }
  async function ensureSafeUnlocked() {
    const controller2 = getController();
    if (controller2.dataManager.unlocked) return true;
    const ok = await controller2.uiManager.showPasswordDialog();
    return ok;
  }
  function unloadEncrypt() {
    if (controller) controller.cleanup();
    controller = null;
    initialized = false;
  }
  var initialized, controller, statusBarEl;
  var init_encrypt = __esm({
    "src/encrypt/index.ts"() {
      init_settings_provider();
      init_app();
      init_ui2();
      init_vault_assets_view();
      initialized = false;
      controller = null;
      statusBarEl = null;
    }
  });

  // src/secondbrain/link-agent/pipeline.ts
  function settingNumber(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }
  function boolSetting(v, fallback) {
    return v === void 0 || v === null ? fallback : v === true;
  }
  function bodyExcerpt(content, maxLen) {
    const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\s*(?:\r?\n|$)/, "");
    return body.replace(/\s+/g, " ").trim().slice(0, maxLen);
  }
  async function probeEmbeddingReachable(baseUrl) {
    const cfg = buildConfig();
    const url = baseUrl || (IS_MOBILE ? cfg.OLLAMA_REMOTE_URL || cfg.OLLAMA_URL : cfg.OLLAMA_URL);
    if (!url) return false;
    const controller2 = new AbortController();
    const timer = setTimeout(() => controller2.abort(), LINK_PROBE_TIMEOUT_MS);
    try {
      const resp = await fetch(`${url.replace(/\/+$/, "")}/api/tags`, { method: "GET", signal: controller2.signal });
      return resp.ok;
    } catch (e) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  function isEncryptLockedPath(app, path) {
    const s = tryGetSettings();
    const root = String(s.encryptRoot || "CONFIG/.ENCRYPT").replace(/\/+$/, "");
    return isUnderFolder(root, path);
  }
  var LINK_PROBE_TIMEOUT_MS, LINK_BATCH_DELAY_MS, LINK_BATCH_NOTICE_KEY, LINK_ERROR_NOTICE_KEY, JUDGE_PROMPT_PREFIX, CANDIDATE_POOL_MIN, LINK_QUERY_MAX_CHARS, LinkAgent;
  var init_pipeline = __esm({
    "src/secondbrain/link-agent/pipeline.ts"() {
      init_notice();
      init_settings_provider();
      init_config();
      init_ai2();
      init_data();
      LINK_PROBE_TIMEOUT_MS = 1500;
      LINK_BATCH_DELAY_MS = 6e4;
      LINK_BATCH_NOTICE_KEY = "bz-sb-link-agent-batch";
      LINK_ERROR_NOTICE_KEY = "bz-sb-link-agent-error";
      JUDGE_PROMPT_PREFIX = [
        "你是笔记库的双链裁判。给定一篇新笔记的档案卡和若干候选笔记的档案卡，",
        "逐一判断候选与新笔记是否存在实质的知识关联（共同主题、直接引用、同一事件或人物、强互补上下文）。",
        "标准：只链实质关联，存疑不链；宁缺勿滥。",
        '输出要求：严格 JSON 数组 [{"id":<候选编号>,"reason":"一句话理由"}]，按关联强度降序；无关联输出 []；不要输出 JSON 以外的任何文字。'
      ].join("");
      CANDIDATE_POOL_MIN = 24;
      LINK_QUERY_MAX_CHARS = 8e3;
      LinkAgent = class {
        constructor(deps) {
          /**
           * 批次串行锁（ticket 115）：启停补链、监听批次共用同一 agent 实例时，
           * 批次级管线（refresh + 向量检索 + AI 裁判）只允许一端执行，其余排队串行——
           * 避免并发 refresh 争抢 embedding 与裁判请求交错（store.refresh 自带并发去重仍不保证整体串行）。
           */
          this.serialChain = Promise.resolve();
          this.app = deps.app;
          this.store = deps.store;
          this.probeFn = deps.probe || (() => probeEmbeddingReachable());
        }
        get maxTopK() {
          const s = tryGetSettings();
          return settingNumber(s.linkAgentTopK, 8) || 8;
        }
        get maxLinks() {
          const s = tryGetSettings();
          return settingNumber(s.linkAgentMaxLinks, 0);
        }
        get notifyEnabled() {
          const s = tryGetSettings();
          return boolSetting(s.linkAgentNotify, true);
        }
        /**
         * 尊重「已有 related 不再自动建链」（v1.7/ticket 167）：默认开（缺省兜底 true）。
         * 开启时 processNote 对 related 非空的笔记一律跳过；手动命令传 respectRelated:false 豁免。
         */
        get respectRelated() {
          const s = tryGetSettings();
          return boolSetting(s.linkAgentRespectRelated, true);
        }
        /**
         * 单篇完整管线；assumeReachable=true 时跳过探测（队列消费已在入口统一探过）。
         * v1.7/ticket 167：respectRelated !== false 时，frontmatter related 非空 → `skipped-related` 跳过
         * （创建 / 修改 / 队列消费三条自动路径统一；存量补链目标天然只收缺 related 者，此门不触发）。
         */
        async processNote(path, opts) {
          var _a2, _b2, _c;
          const s = tryGetSettings();
          if (s.linkAgentEnabled === false) return { status: "skipped" };
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!file || file.extension !== "md") return { status: "skipped" };
          if (isEncryptLockedPath(this.app, path)) return { status: "skipped" };
          let content = "";
          try {
            content = await this.app.vault.read(file);
          } catch (e) {
            return { status: "skipped" };
          }
          const hash = computeHash(content);
          if ((opts == null ? void 0 : opts.respectRelated) !== false && this.respectRelated) {
            const fm = (_c = (_b2 = (_a2 = this.app.metadataCache) == null ? void 0 : _a2.getFileCache) == null ? void 0 : _b2.call(_a2, file)) == null ? void 0 : _c.frontmatter;
            if (hasRelatedEntries(fm == null ? void 0 : fm.related)) return { status: "skipped-related" };
          }
          if (!(opts == null ? void 0 : opts.assumeReachable)) {
            const ok = await this.probeFn();
            if (!ok) {
              await enqueuePaths([path], { [path]: hash });
              return { status: "queued" };
            }
          }
          await this.store.refresh();
          const candidates = await this.findCandidates(path, content);
          let picks = [];
          if (candidates.length > 0) {
            const prompt = this.buildJudgePrompt(file, content, candidates);
            let text = "";
            try {
              text = await AI.ask(prompt);
            } catch (e) {
              await enqueuePaths([path], { [path]: hash });
              return { status: "failed", error: e instanceof Error ? e.message : String(e) };
            }
            picks = parseJudgeOutput(text, candidates.length);
          }
          const links = picks.map((p) => candidates[p.id - 1]).filter((c) => !!c && c.path !== path && !!this.app.vault.getAbstractFileByPath(c.path));
          const created = await this.writeRelated(file, links.map((c) => c.path));
          await this.recordLinkBaseline(path);
          return { status: "done", created };
        }
        /**
         * v1.4/ticket 119：记录某篇的正文基准哈希（写盘成功后调用）。
         * - 只记录"当前文件内容"（含本次写入的 related）——这样自写触发的 vault:md-modified
         *   到冲刷时哈希与基准相同 → 被过滤跳过，不会循环重跑；
         * - 失败静默（下一次成功建链会重记）。
         */
        async recordLinkBaseline(path) {
          try {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (!file) return;
            const content = await this.app.vault.read(file);
            await upsertLinkState(path, computeHash(content));
          } catch (e) {
            console.warn("[link-agent] 基准哈希记录失败", e);
          }
        }
        /**
         * v1.4/ticket 119：修改事件冲刷过滤——输入候选路径，返回**需要重跑建链**的子集：
         * - 与基准哈希相同（内容未实质变化 / 自写 related / Obsidian 高频保存）→ 剔除；
         * - 无基准（升级前存量已连接笔记 / 首次见到）→ 保留（重跑一次并从成功结果重建基准）；
         * - 文件已删 / 非 md / encrypt 锁定 → 剔除（管线本来会跳过，省一次读取）。
         */
        async filterChangedForRelink(paths) {
          var _a2;
          let state = {};
          try {
            state = await loadLinkState();
          } catch (e) {
          }
          const out = [];
          for (const p of [...paths].sort()) {
            const file = this.app.vault.getAbstractFileByPath(p);
            if (!file || file.extension !== "md") continue;
            if (isEncryptLockedPath(this.app, p)) continue;
            let content = "";
            try {
              content = await this.app.vault.read(file);
            } catch (e) {
              continue;
            }
            if (((_a2 = state[p]) == null ? void 0 : _a2.hash) === computeHash(content)) continue;
            out.push(p);
          }
          return out;
        }
        /** v1.4/ticket 119：文件删除时移除基准条目（死链/删除清理顺带） */
        async dropLinkBaseline(path) {
          try {
            await removeLinkState(path);
          } catch (e) {
          }
        }
        /**
         * 候选生成（ticket 116：来源 = 白名单索引库全部笔记，不再按 linkAgentScopes 过滤）：
         * 全局大池近邻 → 去自身 → 剔除已不存在文件与 encrypt 锁定 → 按 path 去重取最优 → Top-K。
         * 关联范围（linkAgentScopes）只决定"哪些笔记会被关联"（目标/触发侧），不限制候选来源。
         * 查询端（ticket 118）：**全文嵌入**——正文全文（剥 frontmatter、去空白，超长按 LINK_QUERY_MAX_CHARS 安全截尾）
         * 送向量模型生成查询向量，而非 800 字摘要，提高召回。
         */
        async findCandidates(selfPath, content) {
          const topK = this.maxTopK;
          const cfg = buildConfig();
          const baseUrl = IS_MOBILE ? cfg.OLLAMA_REMOTE_URL || cfg.OLLAMA_URL : void 0;
          const pool = Math.max(topK * 3, CANDIDATE_POOL_MIN);
          let hits = [];
          try {
            hits = await this.store.vectorSearch(bodyExcerpt(content, LINK_QUERY_MAX_CHARS), pool, baseUrl);
          } catch (e) {
            console.warn("[link-agent] 近邻检索失败", e);
            return [];
          }
          const bestByPath = /* @__PURE__ */ new Map();
          for (const hit of hits) {
            if (hit.path === selfPath) continue;
            if (!this.app.vault.getAbstractFileByPath(hit.path)) continue;
            if (isEncryptLockedPath(this.app, hit.path)) continue;
            const cur = bestByPath.get(hit.path);
            if (!cur || hit.score > cur.score) bestByPath.set(hit.path, hit);
          }
          return [...bestByPath.values()].sort((a, b) => b.score - a.score).slice(0, topK);
        }
        /** 组档案卡调 core AI 裁判；maxLinks>0 时提示附上限（写入侧仍截断兜底） */
        buildJudgePrompt(selfFile, selfContent, candidates) {
          const s = tryGetSettings();
          const maxLinks = settingNumber(s.linkAgentMaxLinks, 0);
          const lines = [JUDGE_PROMPT_PREFIX];
          if (maxLinks > 0) lines.push(`本次最多选择 ${maxLinks} 条。`);
          lines.push("", "## 新笔记");
          lines.push(this.dossierCard(selfFile, bodyExcerpt(selfContent, 400)));
          lines.push("", "## 候选笔记");
          candidates.forEach((c, i) => {
            const f = this.app.vault.getAbstractFileByPath(c.path);
            lines.push(`### id=${i + 1}`);
            lines.push(this.dossierCard(f, (c.chunk || "").slice(0, 200)));
          });
          return lines.join("\n");
        }
        /** 档案卡紧凑格式：标题/tags/summary/首块截断 */
        dossierCard(file, firstChunk) {
          var _a2, _b2, _c, _d, _e;
          if (!file) return "-（文件缺失）";
          let tags = "";
          let summary = "";
          let title = file.basename;
          try {
            const fm = (_a2 = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a2.frontmatter;
            if (fm) {
              if (typeof fm.title === "string" && fm.title.trim()) title = fm.title.trim();
              else if (typeof fm["标题"] === "string" && fm["标题"].trim()) title = fm["标题"].trim();
              const rawTags = (_c = (_b2 = fm.tags) != null ? _b2 : fm.tag) != null ? _c : fm["标签"];
              if (Array.isArray(rawTags)) tags = rawTags.map((t) => String(t)).join(", ");
              else if (typeof rawTags === "string") tags = rawTags;
              const rawSummary = (_e = (_d = fm.summary) != null ? _d : fm["简介"]) != null ? _e : fm["一句话简介"];
              if (typeof rawSummary === "string") summary = rawSummary;
            }
          } catch (e) {
          }
          const parts = [
            `标题：${title}`,
            tags ? `标签：${tags}` : "",
            summary ? `简介：${summary.slice(0, 120)}` : "",
            firstChunk ? `首块：${firstChunk}` : ""
          ].filter(Boolean);
          return `- ${parts.join("｜")}`;
        }
        /** 幂等写入 related（只写本笔记侧）；返回实际新增条数 */
        async writeRelated(file, targetPaths) {
          if (!targetPaths.length) return 0;
          let addedCount = 0;
          try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
              const existing = parseRelatedEntries(fm.related);
              const additions = targetPaths.map(toRelatedEntry);
              const merged = mergeRelated(existing, additions, this.maxLinks);
              addedCount = merged.added.length;
              if (merged.added.length > 0) {
                if (merged.entries.length > 0) fm.related = merged.entries;
                else delete fm.related;
              }
            });
          } catch (e) {
            console.warn("[link-agent] related 写入失败", e);
            return 0;
          }
          return addedCount;
        }
        runSerial(fn) {
          const run = this.serialChain.then(
            () => fn(),
            () => fn()
          );
          this.serialChain = run.then(
            () => void 0,
            () => void 0
          );
          return run;
        }
        /**
         * 批次处理：逐篇跑管线；批次进行中以 dedupeKey 合并动态更新单条 progress toast，
         * 结束时同键切换为完成通知（新建 0 条静默——隐藏进行中帧），失败合并提示一次。
         * 经串行锁执行：与存量补链批次排队互斥。
         * @param assumeReachable 已在上游探测过可达（存量补链），批内不再逐篇探测（同队列消费语义）
         * @param silent 启动路径静默（ticket 6）：批次进度/完成 toast 一律不弹，仅汇总照常返回
         */
        async processBatch(paths, opts) {
          return this.runSerial(() => this.runBatch(paths, opts));
        }
        async runBatch(paths, opts) {
          const summary = { total: paths.length, processed: 0, created: 0, queued: 0, failed: 0 };
          if (!paths.length) return summary;
          const notifyOn = this.notifyEnabled && !(opts == null ? void 0 : opts.silent);
          let handle = null;
          if (notifyOn) {
            handle = notify(`自动双链：处理中 0/${paths.length} 篇`, { type: "progress", dedupeKey: LINK_BATCH_NOTICE_KEY });
          }
          for (let i = 0; i < paths.length; i++) {
            const outcome = await this.processNote(paths[i], opts);
            if (outcome.status === "done") {
              summary.processed++;
              summary.created += outcome.created;
            } else if (outcome.status === "queued") {
              summary.queued++;
            } else if (outcome.status === "failed") {
              summary.failed++;
            }
            if (notifyOn) {
              notify(`自动双链：处理中 ${i + 1}/${paths.length} 篇`, { type: "progress", dedupeKey: LINK_BATCH_NOTICE_KEY });
            }
          }
          if (notifyOn) {
            if (summary.created > 0) {
              notify(`本批新建关联 ${summary.created} 条`, { type: "success", dedupeKey: LINK_BATCH_NOTICE_KEY });
            } else {
              handle == null ? void 0 : handle.hide();
            }
            if (summary.failed > 0) {
              notify(`${summary.failed} 篇笔记关联处理失败，已入队稍后自动重试`, {
                type: "warning",
                dedupeKey: LINK_ERROR_NOTICE_KEY
              });
            }
          }
          return summary;
        }
        /**
         * 队列消费（域初始化调用）：队列非空且 embedding 可达 → 自动消费无需询问；
         * 成功移除条目、失败保留；全部完成后通知「待处理关联已处理完毕：N 篇 / 新建 M 条」。
         * @param silent 启动静默（ticket 6）：批次进度/完成 toast 不弹（启动路径由 index 传 silent:true）
         */
        async consumeQueue(opts) {
          try {
            await pruneQueueByExists((p) => !!this.app.vault.getAbstractFileByPath(p));
          } catch (e) {
            console.warn("[link-agent] 队列清理失败", e);
          }
          let items;
          try {
            items = await loadQueue();
          } catch (e) {
            console.warn("[link-agent] 队列读取失败", e);
            return null;
          }
          if (!items.length) return null;
          const reachable = await this.probeFn();
          if (!reachable) return null;
          const summary = { total: items.length, processed: 0, created: 0, queued: 0, failed: 0 };
          const notifyOn = this.notifyEnabled && !(opts == null ? void 0 : opts.silent);
          let handle = null;
          if (notifyOn) {
            handle = notify(`待处理关联：处理中 0/${items.length} 篇`, { type: "progress", dedupeKey: LINK_BATCH_NOTICE_KEY });
          }
          for (let i = 0; i < items.length; i++) {
            const outcome = await this.processNote(items[i].path, { assumeReachable: true });
            if (outcome.status === "done") {
              summary.processed++;
              summary.created += outcome.created;
              await dequeuePath(items[i].path);
            } else if (outcome.status === "failed") {
              summary.failed++;
            } else if (outcome.status === "queued") {
              summary.queued++;
            } else if (outcome.status === "skipped-related") {
              await dequeuePath(items[i].path);
            }
            if (notifyOn) {
              notify(`待处理关联：处理中 ${i + 1}/${items.length} 篇`, { type: "progress", dedupeKey: LINK_BATCH_NOTICE_KEY });
            }
          }
          if (notifyOn) {
            if (summary.processed > 0) {
              notify(`待处理关联已处理完毕：${summary.processed} 篇 / 新建 ${summary.created} 条`, {
                type: "success",
                dedupeKey: LINK_BATCH_NOTICE_KEY
              });
            } else {
              handle == null ? void 0 : handle.hide();
            }
            if (summary.failed > 0) {
              notify(`${summary.failed} 篇待处理关联处理失败，已保留队列下次重试`, {
                type: "warning",
                dedupeKey: LINK_ERROR_NOTICE_KEY
              });
            }
          }
          return summary;
        }
        /**
         * 存量补链（ticket 115）：扫描关联范围内**缺 related** 的存量笔记批量建链。
         * - 探测 embedding 可达：不可达 → 返回 unreachable（启动调用方静默跳过，下次启动重试）；
         * - 目标清单 = scope 内 md、frontmatter 无 related、排除 encrypt 锁定与队列内待重试条目；
         *   related 即进度检查点——中断/重启后续跑只处理仍未连接的，天然增量；
         * - 批次走 processBatch（入口已探测，批内 assumeReachable 不再逐篇探测），与监听批次串行互斥；
         * - 启动调用忽略结果且批次全程静默（ticket 6，index 传 silent:true）；手动命令 bz-secondbrain-link-all 按 status 通知。
         */
        async backfillMissingLinks(opts) {
          if (tryGetSettings().linkAgentEnabled === false) return { status: "disabled" };
          const reachable = await this.probeFn();
          if (!reachable) return { status: "unreachable" };
          const targets = await this.computeBackfillTargets();
          if (!targets.length) return { status: "no-targets" };
          const summary = await this.processBatch(targets, { assumeReachable: true, ...opts });
          return { status: "done", summary };
        }
        /** 存量补链目标清单（app 层把 vault / metadataCache / encrypt 边界 / 队列翻译成纯谓词） */
        async computeBackfillTargets() {
          const vault = this.app.vault;
          const cache = this.app.metadataCache;
          const scopes = getLinkAgentScopes();
          let queued;
          try {
            queued = new Set((await loadQueue()).map((i) => i.path));
          } catch (e) {
            queued = /* @__PURE__ */ new Set();
          }
          const files = typeof vault.getMarkdownFiles === "function" ? vault.getMarkdownFiles() : [];
          return computeBackfillTargets(
            files.map((f) => f.path),
            {
              inScope: (p) => matchesScope(scopes, p),
              hasRelated: (p) => {
                var _a2, _b2;
                try {
                  const fm = (_b2 = (_a2 = cache == null ? void 0 : cache.getFileCache) == null ? void 0 : _a2.call(cache, vault.getAbstractFileByPath(p))) == null ? void 0 : _b2.frontmatter;
                  return parseRelatedEntries(fm == null ? void 0 : fm.related).length > 0;
                } catch (e) {
                  return true;
                }
              },
              excluded: (p) => isEncryptLockedPath(this.app, p) || queued.has(p)
            }
          );
        }
        /**
         * 死链清理：解析关联范围（linkAgentScopes，空 = 不扫描）内各笔记 related，移除指向不存在文件的失效条目（非 wikilink 条目不动）。
         * encrypt 域锁定文件一律跳过：保险箱锁定态无法区分「已删除」与「已加密」，整体跳过本次清理；
         * 解锁态下清单内路径视为存活。返回实际移除条数；有移除才通知（零变化静默）。
         */
        async cleanDeadLinks(opts) {
          var _a2, _b2, _c, _d;
          const s = tryGetSettings();
          if (s.linkAgentAutoClean === false) return 0;
          const cache = this.app.metadataCache;
          if (!(cache == null ? void 0 : cache.getFileCache)) return 0;
          let encryptedPaths = null;
          try {
            const root = String(tryGetSettings().encryptRoot || "CONFIG/.ENCRYPT").replace(/\/+$/, "");
            let safeExists = false;
            try {
              const existsFn = (_a2 = this.app.vault.adapter) == null ? void 0 : _a2.exists;
              safeExists = typeof existsFn === "function" ? !!await existsFn.call(this.app.vault.adapter, `${root}/.safe.enc`) : false;
            } catch (e) {
              safeExists = false;
            }
            if (safeExists) {
              const enc = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
              const sm = enc.getSafeManager();
              if (sm.unlocked) {
                encryptedPaths = new Set(((_c = (_b2 = sm.manifest) == null ? void 0 : _b2.notes) != null ? _c : []).map((n) => String(n.path)));
              } else {
                return 0;
              }
            }
          } catch (e) {
            console.warn("[link-agent] encrypt 边界检查失败，按无保险箱处理", e);
          }
          const mdFiles = this.app.vault.getMarkdownFiles().filter(Boolean);
          const basenameCounts = /* @__PURE__ */ new Map();
          for (const f of mdFiles) {
            const b = f.basename;
            basenameCounts.set(b, (basenameCounts.get(b) || 0) + 1);
          }
          const isAlive = (target) => {
            var _a3;
            const full = target.endsWith(".md") ? target : `${target}.md`;
            if (this.app.vault.getAbstractFileByPath(full)) return true;
            if (((encryptedPaths == null ? void 0 : encryptedPaths.has(full)) || (encryptedPaths == null ? void 0 : encryptedPaths.has(target))) === true) return true;
            const base = ((_a3 = full.split("/").pop()) == null ? void 0 : _a3.replace(/\.md$/i, "")) || "";
            return (basenameCounts.get(base) || 0) > 0;
          };
          let removedTotal = 0;
          const scopedFiles = mdFiles.filter((f) => matchesScope(getLinkAgentScopes(), f.path));
          for (const file of scopedFiles) {
            let entries;
            try {
              const fm = (_d = cache.getFileCache(file)) == null ? void 0 : _d.frontmatter;
              entries = parseRelatedEntries(fm == null ? void 0 : fm.related);
            } catch (e) {
              continue;
            }
            if (!entries.length) continue;
            const { keep, removed } = planRemovals(entries, isAlive);
            if (!removed.length) continue;
            try {
              await this.app.fileManager.processFrontMatter(file, (fmo) => {
                if (keep.length > 0) fmo.related = keep;
                else delete fmo.related;
              });
              removedTotal += removed.length;
            } catch (e) {
              console.warn(`[link-agent] 死链清理写回失败 [${file.path}]`, e);
            }
          }
          if (removedTotal > 0 && !(opts == null ? void 0 : opts.silent) && this.notifyEnabled) {
            notice(`已清理 ${removedTotal} 条失效关联`, "delete");
          }
          return removedTotal;
        }
      };
    }
  });

  // src/secondbrain/link-agent/watch.ts
  async function startQueueConsumption(agent, initialLoad, opts) {
    try {
      await initialLoad;
    } catch (e) {
    }
    try {
      await agent.consumeQueue(opts);
    } catch (e) {
      console.warn("[link-agent] 队列消费失败", e);
    }
  }
  async function startStartupBackfill(agent, initialLoad, opts) {
    try {
      await initialLoad;
    } catch (e) {
    }
    try {
      const result = await agent.backfillMissingLinks(opts);
      if (result.status === "done" || result.status === "unreachable" || result.status === "no-targets") return;
      console.warn("[link-agent] 启动补链跳过（自动双链已关闭）");
    } catch (e) {
      console.warn("[link-agent] 启动补链失败", e);
    }
  }
  var LINK_CLEAN_DEBOUNCE_MS, LINK_SWEEP_INTERVAL_MS, allowPathsGuideShown, LinkAgentWatcher;
  var init_watch = __esm({
    "src/secondbrain/link-agent/watch.ts"() {
      init_domain_bus();
      init_notice();
      init_settings_provider();
      init_data();
      init_pipeline();
      LINK_CLEAN_DEBOUNCE_MS = 5e3;
      LINK_SWEEP_INTERVAL_MS = 30 * 60 * 1e3;
      allowPathsGuideShown = false;
      LinkAgentWatcher = class {
        constructor(app, agent) {
          /** 防抖批次缓冲（创建事件聚合） */
          this.pendingCreates = /* @__PURE__ */ new Set();
          /** 防抖批次缓冲（修改事件聚合，v1.4/ticket 119） */
          this.pendingModifies = /* @__PURE__ */ new Set();
          this.batchTimer = null;
          /** 死链清理防抖定时器 */
          this.cleanTimer = null;
          /** 低频巡检定时器 */
          this.sweepTimer = null;
          /** 总线退订函数账本 */
          this.unsubs = [];
          /** 批次重入保护（上一批未完成时丢弃新触发的 flush） */
          this.running = false;
          this.app = app;
          this.agent = agent;
        }
        get enabled() {
          return tryGetSettings().linkAgentEnabled !== false;
        }
        /** 注册事件订阅与巡检（linkAgentEnabled=false 时整体不注册——无任何监听与写入） */
        start() {
          if (!this.enabled) return;
          this.unsubs.push(
            onDomainEvent("vault:md-created", (evt) => this.onCreated(evt.path)),
            onDomainEvent("vault:md-modified", (evt) => this.onModified(evt.path)),
            onDomainEvent("vault:md-deleted", (evt) => this.onDeleted(evt.path))
          );
          this.sweepTimer = setInterval(() => {
            void this.runDeadLinkSweep();
          }, LINK_SWEEP_INTERVAL_MS);
          this.maybeGuideAllowPaths();
        }
        /** 关联范围内（空 = 不触发任何监听）新笔记落盘 → 入缓冲并重置防抖计时（约 60 秒聚合一批）；范围随 linkAgentScopes 实时生效 */
        onCreated(path) {
          if (!this.enabled) return;
          if (!matchesScope(getLinkAgentScopes(), path)) return;
          this.pendingCreates.add(path);
          if (this.batchTimer) clearTimeout(this.batchTimer);
          this.batchTimer = setTimeout(() => {
            this.batchTimer = null;
            void this.flushBatch();
          }, LINK_BATCH_DELAY_MS);
        }
        /**
         * 修改事件（v1.4/ticket 119 正文大改自动重跑）：范围内已有笔记被修改 → 入缓冲防抖聚合；
         * 冲刷时经 agent.filterChangedForRelink 基准哈希过滤，只重跑真正变化的笔记
         * （Obsidian 高频保存 / 自写 related 触发的 modify 被哈希挡掉，不空转裁判）。
         */
        onModified(path) {
          if (!this.enabled) return;
          if (!matchesScope(getLinkAgentScopes(), path)) return;
          this.pendingModifies.add(path);
          if (this.batchTimer) clearTimeout(this.batchTimer);
          this.batchTimer = setTimeout(() => {
            this.batchTimer = null;
            void this.flushBatch();
          }, LINK_BATCH_DELAY_MS);
        }
        /** 删除事件：缓冲内顺带剔除；死链清理防抖合并触发；该篇基准哈希一并移除 */
        onDeleted(path) {
          this.pendingCreates.delete(path);
          this.pendingModifies.delete(path);
          if (!this.enabled) return;
          if (this.cleanTimer) clearTimeout(this.cleanTimer);
          this.cleanTimer = setTimeout(() => {
            this.cleanTimer = null;
            void this.runDeadLinkSweep();
          }, LINK_CLEAN_DEBOUNCE_MS);
          void this.agent.dropLinkBaseline(path);
        }
        /** 冲刷防抖批次：只处理仍存在的文件；上一批未完成时本次跳过（下一事件重新聚合） */
        async flushBatch() {
          const batch = [...this.pendingCreates].filter((p) => !!this.app.vault.getAbstractFileByPath(p));
          this.pendingCreates.clear();
          if (this.pendingModifies.size > 0) {
            const mods = [...this.pendingModifies].filter((p) => !!this.app.vault.getAbstractFileByPath(p));
            this.pendingModifies.clear();
            try {
              const changed = await this.agent.filterChangedForRelink(mods);
              for (const p of changed) if (!batch.includes(p)) batch.push(p);
            } catch (e) {
              console.warn("[link-agent] 修改过滤失败，按全部修改保留", e);
              for (const p of mods) if (!batch.includes(p)) batch.push(p);
            }
          }
          if (!batch.length || this.running) return;
          this.running = true;
          try {
            await this.agent.processBatch(batch);
          } catch (e) {
            console.warn("[link-agent] 批次处理失败", e);
          } finally {
            this.running = false;
          }
        }
        /** 死链清理入口（删除防抖 + 低频巡检共用）；顺带清理队列中已删文件条目 */
        async runDeadLinkSweep() {
          if (!this.enabled) return 0;
          try {
            return await this.agent.cleanDeadLinks();
          } catch (e) {
            console.warn("[link-agent] 死链清理失败", e);
            return 0;
          }
        }
        /**
         * 一次性引导提示（泛化版）：linkAgentScopes 中出现 secondBrainAllowPaths 未包含的目录时，
         * 提示用户把目录加入第二大脑索引范围；只提示，绝不代改用户 data.json 配置。
         */
        maybeGuideAllowPaths() {
          if (allowPathsGuideShown) return;
          const s = tryGetSettings();
          const allow = String(s.secondBrainAllowPaths || "").split(",").map((x) => x.trim()).filter(Boolean);
          const missing = getLinkAgentScopes().filter((dir) => !allow.includes(dir));
          if (missing.length > 0) {
            allowPathsGuideShown = true;
            notice(
              `自动双链已开启：关联范围中的「${missing.join("」「")}」不在第二大脑白名单目录内，候选检索不会命中这些目录，可在第二大脑设置的白名单目录中补充。`,
              "warning"
            );
          }
        }
        /** 卸载清理（定时器/退订/缓冲） */
        destroy() {
          if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
          }
          if (this.cleanTimer) {
            clearTimeout(this.cleanTimer);
            this.cleanTimer = null;
          }
          if (this.sweepTimer) {
            clearInterval(this.sweepTimer);
            this.sweepTimer = null;
          }
          for (const off of this.unsubs) {
            try {
              off();
            } catch (e) {
            }
          }
          this.unsubs = [];
          this.pendingCreates.clear();
          this.pendingModifies.clear();
        }
      };
    }
  });

  // src/secondbrain/index.ts
  var secondbrain_exports = {};
  __export(secondbrain_exports, {
    ensureSecondBrain: () => ensureSecondBrain,
    openSecondBrainChat: () => openSecondBrainChat,
    openSecondBrainPanel: () => openSecondBrainPanel,
    openSecondBrainReference: () => openSecondBrainReference,
    rebuildSecondBrainIndex: () => rebuildSecondBrainIndex,
    rebuildSecondBrainLinks: () => rebuildSecondBrainLinks,
    runSecondBrainLinkAll: () => runSecondBrainLinkAll,
    unloadSecondBrain: () => unloadSecondBrain
  });
  function ensureSecondBrain(app) {
    if (initialized2) return;
    initialized2 = true;
    appRef = app;
    const s = new VectorStore(app);
    store = s;
    s.initialLoad = (async () => {
      try {
        await s.load();
        if (IS_MOBILE) {
          const msg = await s.initMobile();
          if (msg) console.log(`[secondbrain] ${msg}`);
        } else if (s.isIndexReady()) {
          await s.refresh();
        } else {
          console.log("[secondbrain] 本地暂无向量数据，等待用户在主面板初始化");
        }
      } catch (e) {
        console.warn("[secondbrain] 初始化失败", e);
      }
    })();
    unsubVault = onDomainEvent("vault:md-modified", () => {
      if (!(store == null ? void 0 : store.isIndexReady())) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        store == null ? void 0 : store.refresh().catch((e) => console.warn("[secondbrain] 后台刷新失败", e));
      }, 5e3);
    });
    try {
      if (tryGetSettings().linkAgentEnabled !== false) {
        linkAgent = new LinkAgent({ app, store: s });
        linkWatcher = new LinkAgentWatcher(app, linkAgent);
        linkWatcher.start();
        void (async () => {
          try {
            await startQueueConsumption(linkAgent, s.initialLoad, { silent: true });
          } catch (e) {
            console.warn("[secondbrain] 队列消费失败", e);
          }
          try {
            await startStartupBackfill(linkAgent, s.initialLoad, { silent: true });
          } catch (e) {
            console.warn("[secondbrain] 启动补链失败", e);
          }
        })();
      }
    } catch (e) {
      console.warn("[secondbrain] 自动双链初始化失败", e);
    }
  }
  function unloadSecondBrain() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    unsubVault == null ? void 0 : unsubVault();
    unsubVault = null;
    panel == null ? void 0 : panel.destroy();
    panel = null;
    reference == null ? void 0 : reference.close();
    reference = null;
    chat == null ? void 0 : chat.destroy();
    chat = null;
    mobile == null ? void 0 : mobile.close();
    mobile = null;
    linkWatcher == null ? void 0 : linkWatcher.destroy();
    linkWatcher = null;
    linkAgent = null;
    store = null;
    appRef = null;
    initialized2 = false;
    resetDeepseekAI();
  }
  function ensureReference() {
    if (!appRef || !store) return;
    if (reference && !reference.alive) reference = null;
    if (reference) return;
    if (IS_MOBILE) {
      mobile != null ? mobile : mobile = new MobilePanel(appRef, store);
      return;
    }
    reference = new ReferencePanel(appRef, store);
  }
  function openReferenceInternal() {
    ensureReference();
    if (IS_MOBILE) {
      mobile == null ? void 0 : mobile.show();
    } else {
      reference == null ? void 0 : reference.fw.show();
    }
  }
  function ensureChat() {
    if (!appRef || !store || chat) return;
    chat = new ChatPanel(store, appRef);
  }
  function openChatInternal() {
    if (IS_MOBILE) {
      ensureReference();
      mobile == null ? void 0 : mobile.switchTab("chat");
      mobile == null ? void 0 : mobile.show();
      return;
    }
    ensureChat();
    chat == null ? void 0 : chat.show();
  }
  function openSecondBrainPanel(app) {
    ensureSecondBrain(app);
    if (!store) return;
    panel != null ? panel : panel = new SecondBrainPanel(app, store, {
      onOpenReference: () => openReferenceInternal(),
      onOpenChat: () => openChatInternal()
    });
    void panel.open();
  }
  function rebuildSecondBrainIndex(app) {
    ensureSecondBrain(app);
    if (!store) return;
    panel != null ? panel : panel = new SecondBrainPanel(app, store, {
      onOpenReference: () => openReferenceInternal(),
      onOpenChat: () => openChatInternal()
    });
    panel.requestRebuild();
    void panel.open();
  }
  function openSecondBrainReference(app) {
    ensureSecondBrain(app);
    if (!(store == null ? void 0 : store.isIndexReady())) {
      openSecondBrainPanel(app);
      return;
    }
    openReferenceInternal();
  }
  function openSecondBrainChat(app) {
    ensureSecondBrain(app);
    if (!(store == null ? void 0 : store.isIndexReady())) {
      openSecondBrainPanel(app);
      return;
    }
    openChatInternal();
  }
  async function runSecondBrainLinkAll(app) {
    if (tryGetSettings().linkAgentEnabled === false) {
      notice("自动双链已在第二大脑设置中关闭");
      return;
    }
    ensureSecondBrain(app);
    if (!linkAgent) return;
    try {
      const result = await linkAgent.backfillMissingLinks();
      if (result.status === "done") {
        const { summary } = result;
        notice(
          summary.created > 0 ? `批量补链完成：处理 ${summary.processed} 篇 / 新建关联 ${summary.created} 条` : "批量补链完成：未发现实质关联，未新建",
          "success"
        );
      } else if (result.status === "unreachable") {
        notice("embedding 服务不可达，无法补链；服务恢复后可在下次启动自动补链", "info");
      } else if (result.status === "no-targets") {
        notice("当前无待补链笔记：关联范围内未连接的笔记已处理完", "info");
      } else {
        notice("批量补链跳过（自动双链已关闭）", "info");
      }
    } catch (e) {
      console.warn("[secondbrain] 批量补链失败", e);
      notice(`批量补链失败：${e instanceof Error ? e.message : String(e)}`, "error");
    }
  }
  async function rebuildSecondBrainLinks(app) {
    var _a2, _b2;
    const file = (_b2 = (_a2 = app.workspace).getActiveFile) == null ? void 0 : _b2.call(_a2);
    if (!file) {
      notice("请先打开一个笔记");
      return;
    }
    if (tryGetSettings().linkAgentEnabled === false) {
      notice("自动双链已在第二大脑设置中关闭");
      return;
    }
    ensureSecondBrain(app);
    if (!linkAgent) return;
    try {
      const outcome = await linkAgent.processNote(file.path, { respectRelated: false });
      if (outcome.status === "done") {
        notice(outcome.created > 0 ? `已新建关联 ${outcome.created} 条` : "未发现实质关联，未新建", "success");
      } else if (outcome.status === "queued") {
        notice("embedding 服务不可达，已加入待处理队列，服务可达后自动处理", "info");
      } else if (outcome.status === "failed") {
        notice(`关联处理失败：${outcome.error}`, "error");
      } else {
        notice("该笔记暂无法处理（文件缺失或位于加密目录）", "info");
      }
    } catch (e) {
      console.warn("[secondbrain] 重跑关联失败", e);
      notice(`关联处理失败：${e instanceof Error ? e.message : String(e)}`, "error");
    }
  }
  var appRef, store, initialized2, panel, reference, chat, mobile, linkAgent, linkWatcher, unsubVault, refreshTimer;
  var init_secondbrain = __esm({
    "src/secondbrain/index.ts"() {
      init_domain_bus();
      init_notice();
      init_settings_provider();
      init_config();
      init_vector_store();
      init_ai2();
      init_panel();
      init_reference_panel();
      init_chat_panel();
      init_mobile_panel();
      init_pipeline();
      init_watch();
      appRef = null;
      store = null;
      initialized2 = false;
      panel = null;
      reference = null;
      chat = null;
      mobile = null;
      linkAgent = null;
      linkWatcher = null;
      unsubVault = null;
      refreshTimer = null;
    }
  });

  // src/secondbrain/panel.ts
  function topLevelName(path) {
    const i = path.indexOf("/");
    return i === -1 ? "（根目录）" : path.slice(0, i);
  }
  function lanIpDesc() {
    if (isMobileEnv()) return "";
    const lanIPs = getLanIPs();
    if (lanIPs.length === 0) {
      return "未能探测本机局域网 IP，请确认电脑已联网，移动端远程地址需手动填写电脑的局域网 IP";
    }
    const primary = pickPrimaryLanIp(lanIPs);
    return `本机当前局域网 IP 为 ${lanIPs.map((l) => `${l.ip}，${l.iface}`).join("；")}。移动端连不上时，把远程地址填为${primary ? ` ${formatRemoteOllamaUrl(primary.ip)}` : "此处 IP"}`;
  }
  function secondBrainSettingsSchema() {
    let reloadWarned = false;
    const warnReload = () => {
      if (reloadWarned) return;
      reloadWarned = true;
      notice("第二大脑设置已保存，重载插件后生效", "info");
    };
    const trimStore = (key) => (v) => {
      getSettings()[key] = v.trim();
    };
    const boolDefaultOn = (key) => ({
      get: () => tryGetSettings()[key] !== false,
      set: (v) => {
        getSettings()[key] = v;
      },
      save: () => saveSettings()
    });
    const pathsOf = (key) => ({
      get: () => {
        var _a2;
        return parsePathList(String((_a2 = tryGetSettings()[key]) != null ? _a2 : ""));
      },
      set: (v) => {
        getSettings()[key] = formatPathList(v);
      },
      save: () => saveSettings()
    });
    return {
      groups: [
        {
          // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
          icon: "palette",
          name: "外观",
          rows: [
            { type: "choiceCards", name: "面板布局", binding: { key: "secondbrainSkin" }, options: [{ value: "default", label: "对话", prevClass: "bz-sp-prev-panel" }] },
            { type: "choiceCards", name: "面板主题", binding: { key: "secondbrainSkinTheme" }, layoutKey: "secondbrainSkin", options: [{ value: "graphite", label: "石墨", layout: "default", prevClass: "bz-sp-prev-graphite" }] }
          ]
        },
        {
          icon: "folder-open",
          name: "基础",
          rows: [
            { type: "text", name: "Ollama 本地 URL", binding: { key: "secondBrainOllamaUrl" }, onChange: trimStore("secondBrainOllamaUrl") },
            // 远程 Ollama URL（移动端）：声明 text 行 + 行内「填入远程 URL」按钮（actions 统一实现，
            // 动作完成后渲染器重读绑定回填显示——custom 输入框引用持快手已退役）
            {
              type: "text",
              name: "移动端远程地址",
              desc: "手机上连本地向量库走这个地址",
              binding: { key: "secondBrainRemoteOllamaUrl" },
              onChange: (v) => trimStore("secondBrainRemoteOllamaUrl")(v),
              actions: [{
                text: "填入远程 URL",
                cta: true,
                onClick: () => {
                  const lanIPs = getLanIPs();
                  const primary = pickPrimaryLanIp(lanIPs);
                  if (!primary) {
                    notice("未探测到本机局域网 IP，请手动填写");
                    return;
                  }
                  const target = formatRemoteOllamaUrl(primary.ip);
                  return openFlowDialog({
                    title: "填入远程 Ollama URL",
                    message: `将「移动端远程地址」覆盖为 ${target}？`,
                    actions: [
                      { label: "取消", value: "cancel" },
                      { label: "覆盖", value: "ok", cta: true }
                    ]
                  }).then((v) => {
                    if (v === "ok") {
                      getSettings().secondBrainRemoteOllamaUrl = target;
                      void saveSettings();
                    }
                  });
                }
              }]
            },
            // 本机局域网 IP（展示行，actions 已并上侧「填入远程 URL」按钮；custom 双分支已退役）
            {
              type: "info",
              name: "本机局域网 IP",
              visibleWhen: () => !isMobileEnv(),
              desc: lanIpDesc()
            },
            {
              type: "info",
              name: "局域网 IP 提示",
              visibleWhen: () => isMobileEnv(),
              desc: "连不上远程库时，在电脑上查看本机 IP 并核对上方地址"
            },
            { type: "text", name: "Embedding 模型", binding: { key: "secondBrainEmbeddingModel" }, onChange: trimStore("secondBrainEmbeddingModel") },
            // 白名单目录（ticket 128 统一选择器：chips + 选择按钮；存储格式冻结——英文逗号分隔字符串）
            {
              type: "path",
              mode: "multi",
              name: "白名单目录",
              desc: "纳入第二大脑检索与候选来源的笔记目录，留空则不索引",
              binding: pathsOf("secondBrainAllowPaths"),
              pickerTitle: "选择白名单目录",
              pickerDesc: "白名单为目录前缀语义：勾选祖先目录即覆盖其下全部子目录",
              buttonText: "选择",
              emptyText: "暂未选择（留空 = 不索引任何目录）"
            },
            { type: "toggle", name: "启用", desc: "仅控制启动时自动加载，关闭后仍可从命令面板手动打开", binding: { key: "secondBrainEnabled" }, onChange: warnReload }
          ]
        },
        {
          icon: "link",
          name: "自动双链",
          rows: [
            // 自动双链（ticket 111）：总开关为明细设置的显隐开关（visibleWhen 声明式联动 + 徽标自动刷新）
            { type: "toggle", name: "自动双链", desc: "关联范围内新笔记落盘时自动建双链，候选近邻经 AI 裁判筛选", binding: boolDefaultOn("linkAgentEnabled"), onChange: warnReload },
            {
              type: "text",
              name: "单篇候选数量 TopK",
              desc: "每篇笔记的近邻候选数，来源为白名单索引库的全部笔记",
              // number 键（linkAgentTopK）不走键直绑（收窄到 string），三函数绑定 + onChange 钳制复写
              binding: {
                get: () => {
                  var _a2;
                  return String((_a2 = getSettings().linkAgentTopK) != null ? _a2 : 8);
                },
                set: (v) => {
                  getSettings().linkAgentTopK = v;
                },
                save: () => saveSettings()
              },
              visibleWhen: (s) => s.linkAgentEnabled !== false,
              isChild: true,
              onChange: (v) => {
                const n = Math.floor(Number(v));
                getSettings().linkAgentTopK = Number.isFinite(n) && n > 0 ? n : 8;
              }
            },
            {
              type: "text",
              name: "每篇关联上限",
              desc: "0 表示不限量，由 AI 裁判自行决定，沿用复习域惯例",
              // number 键（linkAgentMaxLinks）同上
              binding: {
                get: () => {
                  var _a2;
                  return String((_a2 = getSettings().linkAgentMaxLinks) != null ? _a2 : 0);
                },
                set: (v) => {
                  getSettings().linkAgentMaxLinks = v;
                },
                save: () => saveSettings()
              },
              visibleWhen: (s) => s.linkAgentEnabled !== false,
              isChild: true,
              onChange: (v) => {
                const n = Math.floor(Number(v));
                getSettings().linkAgentMaxLinks = Number.isFinite(n) && n > 0 ? n : 0;
              }
            },
            { type: "toggle", name: "完成通知", desc: "处理完成后通知提醒，关闭则全程静默", binding: boolDefaultOn("linkAgentNotify"), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
            { type: "toggle", name: "失效关联自动清理", desc: "笔记删除后自动移除指向它的失效 related 条目", binding: boolDefaultOn("linkAgentAutoClean"), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
            { type: "toggle", name: "已有关联不再建链", desc: "笔记已有关联时自动跳过处理", binding: boolDefaultOn("linkAgentRespectRelated"), visibleWhen: (s) => s.linkAgentEnabled !== false, isChild: true },
            // 关联范围（ticket 128 统一选择器：chips + 选择按钮；格式冻结——英文逗号分隔字符串）
            {
              type: "path",
              mode: "multi",
              name: "关联范围",
              desc: "决定哪些笔记会被自动关联，并作为落盘监听与补链目标",
              binding: pathsOf("linkAgentScopes"),
              visibleWhen: (s) => s.linkAgentEnabled !== false,
              isChild: true,
              pickerTitle: "选择关联范围目录",
              buttonText: "选择",
              // ticket 170：去 emoji
              emptyText: "暂未选择（留空 = 不自动关联）"
            }
          ]
        },
        {
          icon: "search",
          name: "检索",
          rows: [
            { type: "text", name: "参考结果数 TopK", binding: { key: "secondBrainTopK" }, onChange: trimStore("secondBrainTopK") },
            { type: "text", name: "对话参考结果数", binding: { key: "secondBrainChatTopK" }, onChange: trimStore("secondBrainChatTopK") },
            { type: "text", name: "段落最小长度", binding: { key: "secondBrainChunkMinLength" }, onChange: trimStore("secondBrainChunkMinLength") },
            { type: "text", name: "上下文限制", binding: { key: "secondBrainContextLimit" }, onChange: trimStore("secondBrainContextLimit") },
            { type: "text", name: "防抖延迟毫秒", binding: { key: "secondBrainDebounceDelay" }, onChange: trimStore("secondBrainDebounceDelay") },
            { type: "text", name: "光标轮询毫秒", binding: { key: "secondBrainCursorPollInterval" }, onChange: trimStore("secondBrainCursorPollInterval") }
          ]
        },
        {
          icon: "message-square",
          name: "对话",
          rows: [
            { type: "text", name: "最大历史记录", binding: { key: "secondBrainMaxHistory" }, onChange: trimStore("secondBrainMaxHistory") },
            {
              type: "button",
              name: "AI 通道",
              // ticket 141：「AI 生成概括」移除后描述同步收敛（仅剩对话走主设置页 AI）
              desc: "对话统一走主设置页 AI 服务商，Embedding 仍走 Ollama",
              buttonText: "前往配置",
              onClick: () => {
                var _a2, _b2;
                closeSettingsModal();
                (_b2 = (_a2 = getApp().setting) == null ? void 0 : _a2.open) == null ? void 0 : _b2.call(_a2);
              }
            }
          ]
        },
        {
          icon: "layout-dashboard",
          name: "面板",
          rows: [
            // 重新索引（ticket 108）：确认已 flow 化（openFlowDialog），此处仅保留按钮与文案
            {
              type: "button",
              name: "重新索引",
              desc: "清空现有向量索引并按当前白名单重嵌入，期间检索降级为文本匹配",
              buttonText: "开始",
              onClick: () => {
                void openFlowDialog({
                  title: "重新索引",
                  message: "将清空现有向量索引，按当前白名单全部重嵌入（约等于首次初始化全量跑一遍）。期间参考侧边栏与对话的向量检索会降级为文本匹配。确定继续吗？",
                  actions: [
                    { label: "取消", value: "cancel" },
                    { label: "开始重建", value: "ok", cta: true }
                  ]
                }).then((v) => {
                  if (v === "ok") {
                    closeSettingsModal();
                    void Promise.resolve().then(() => (init_secondbrain(), secondbrain_exports)).then((m) => m.rebuildSecondBrainIndex(getApp()));
                  }
                });
              }
            }
          ]
        }
      ]
    };
  }
  function openSecondBrainSettings(_app2) {
    openSettingsModal({ title: "第二大脑设置", maxWidth: 520, schema: secondBrainSettingsSchema() });
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
        constructor(app, store3, opts) {
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
          this.store = store3;
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
          var _a2, _b2, _c, _d, _e, _f;
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
          (_c = popup.querySelector("#bz-sb-open-settings")) == null ? void 0 : _c.addEventListener("click", () => this.openSettings());
          (_d = popup.querySelector("#bz-sb-incr")) == null ? void 0 : _d.addEventListener("click", () => {
            if (this.refreshing || this.initializing) return;
            void this.runIncremental();
          });
          (_e = popup.querySelector("#bz-sb-rebuild")) == null ? void 0 : _e.addEventListener("click", () => {
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
          (_f = popup.querySelector("#bz-sb-dist")) == null ? void 0 : _f.addEventListener("click", (e) => {
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
          const colorOf2 = (name) => sbSourceColor(name, order);
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
                color: colorOf2(topLevelName(r.path))
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
          const colorOf2 = (name) => sbSourceColor(name, order);
          const rootMax = Math.max(1, ...tree.map((n) => n.chunks));
          dist.innerHTML = panelDistHtml(tree, this.expandedDirs, colorOf2, rootMax);
          const distN = popup.querySelector("#bz-sb-dist-n");
          if (distN) distN.textContent = `${tree.length} 个来源`;
          mountIcons(dist);
        }
        /** AI 库摘要 + 自动建链数（secondbrain.json panel/link 段，异步回填；生成入口已移除，旧值仍可展示） */
        async loadSummaryAndLinks() {
          var _a2, _b2, _c;
          try {
            const store3 = await loadStore(this.app);
            const popup = this.popup;
            if (!popup || !popup.isConnected) return;
            const summary = ((_a2 = store3.panel) == null ? void 0 : _a2.summary) || "";
            const aiCard = popup.querySelector("#bz-sb-ai-card");
            const aiTxt = popup.querySelector("#bz-sb-ai-txt");
            if (aiCard) aiCard.style.display = summary ? "" : "none";
            if (aiTxt && summary) {
              aiTxt.innerHTML = panelSummaryHtml(summary, ((_b2 = store3.panel) == null ? void 0 : _b2.generatedAt) ? formatRelativeTime(store3.panel.generatedAt) : "");
            }
            const linkedTotal = Object.keys(((_c = store3.link) == null ? void 0 : _c.state) || {}).length;
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
        /** ⚙️ 域设置弹窗（共享实现见 openSecondBrainSettings） */
        openSettings() {
          openSecondBrainSettings(this.app);
        }
      };
    }
  });

  // src/secondbrain/fake-sim.ts
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
  var store2 = null;
  var panel2 = null;
  var chat2 = null;
  var reference2 = null;
  var mobile2 = null;
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
    if (!store2) {
      store2 = new SimVectorStore();
      await new Promise((r) => setTimeout(r, 120));
    }
    return store2;
  }
  async function openPanel() {
    const s = await ensureStore();
    if (!panel2) {
      panel2 = new SecondBrainPanel(simApp, s, {
        onOpenReference: () => void openRef(),
        onOpenChat: () => void openChat()
      });
    }
    await panel2.open();
  }
  async function openChat() {
    const s = await ensureStore();
    if (IS_MOBILE) {
      mobile2 != null ? mobile2 : mobile2 = new MobilePanel(simApp, s);
      mobile2.switchTab("chat");
      mobile2.show();
      return;
    }
    if (!chat2) chat2 = new ChatPanel(s, simApp);
    chat2.show();
  }
  async function openRef() {
    const s = await ensureStore();
    if (IS_MOBILE) {
      mobile2 != null ? mobile2 : mobile2 = new MobilePanel(simApp, s);
      mobile2.show();
      return;
    }
    if (!reference2 || !reference2.alive) reference2 = new ReferencePanel(simApp, s);
    reference2.fw.show();
  }
  function demoReferenceQuery(query) {
    if (!simApp) bootSecondBrainSim();
    const editor = {
      getCursor: () => ({ line: 0, ch: 3 }),
      getLine: () => query,
      getValue: () => query
    };
    simApp.workspace.activeEditor = { editor };
    void openRef().then(() => reference2 == null ? void 0 : reference2.refreshWithDebounce());
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
